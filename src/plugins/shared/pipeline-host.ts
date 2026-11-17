import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegrationLogger } from 'astro';

export interface PipelineHostState {
  siteRoot: string;
  defaultLocale: string;
  locales: Set<string>;
  plugins: Record<string, unknown>;
  executed: boolean;
}

const SITE_PIPELINES = new Map<string, PipelineHostState>();

function getHostState(siteRoot: string): PipelineHostState {
  const key = path.resolve(siteRoot);
  let state = SITE_PIPELINES.get(key);
  if (!state) {
    state = {
      siteRoot: key,
      defaultLocale: 'en',
      locales: new Set(['en']),
      plugins: {},
      executed: false,
    };
    SITE_PIPELINES.set(key, state);
  }
  return state;
}

export function resolvePipelineBinary(): string | null {
  if (process.env.DOCS_PIPELINE_RS_BIN && fs.existsSync(process.env.DOCS_PIPELINE_RS_BIN)) {
    return process.env.DOCS_PIPELINE_RS_BIN;
  }
  const suffix = `${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`;
  const candidates = [
    fileURLToPath(new URL(`../assets/bin/docs-pipeline-rs-${suffix}`, import.meta.url)),
    fileURLToPath(new URL(`../../assets/bin/docs-pipeline-rs-${suffix}`, import.meta.url)),
    fileURLToPath(new URL(`../../../assets/bin/docs-pipeline-rs-${suffix}`, import.meta.url)),
    path.resolve(process.cwd(), `node_modules/@elcoosp/docs-toolkit/dist/assets/bin/docs-pipeline-rs-${suffix}`),
    path.resolve(process.cwd(), `node_modules/@elcoosp/docs-toolkit/assets/bin/docs-pipeline-rs-${suffix}`),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function hasNativePipeline(): boolean {
  return resolvePipelineBinary() !== null;
}

export function registerNativePipelinePlugin(
  siteRoot: string,
  pluginKey: string,
  pluginConfig: unknown,
  locales?: Iterable<string>,
  defaultLocale?: string,
): void {
  const state = getHostState(siteRoot);
  if (defaultLocale && defaultLocale !== 'root') {
    state.defaultLocale = defaultLocale;
    state.locales.add(defaultLocale);
  }
  if (locales) {
    for (const loc of locales) {
      if (loc && loc !== 'root') state.locales.add(loc);
    }
  }
  state.plugins[pluginKey] = pluginConfig;
}

/**
 * Executes the shared Rust pipeline once per build for all registered plugins.
 * Returns `true` if the native pipeline handled execution (either on this call or a sibling plugin's call),
 * or `false` if no native binary is available for the current platform (triggering JS fallback).
 */
export function runNativePipelineOnce(
  siteRoot: string,
  dir: URL | string,
  logger: AstroIntegrationLogger,
): boolean {
  const binPath = resolvePipelineBinary();
  if (!binPath) return false;

  const state = getHostState(siteRoot);
  if (state.executed) return true;
  state.executed = true;

  if (Object.keys(state.plugins).length === 0) return true;

  const distDir = typeof dir === 'string' ? dir : fileURLToPath(dir);
  const payload = {
    siteRoot: state.siteRoot,
    distDir,
    defaultLocale: state.defaultLocale,
    locales: Array.from(state.locales),
    ...state.plugins,
  };

  const tmpFile = path.join(os.tmpdir(), `docs-pipeline-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(payload), 'utf8');

  let proc;
  try {
    proc = spawnSync(binPath, [tmpFile], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
  }

  if (proc.error) {
    throw proc.error;
  }

  let report: {
    elapsedMs: number;
    htmlPages: number;
    mdDocs: number;
    mermaidRendered: number;
    linkPreviewsIndexed: number;
    glossaryIndexed: number;
    glossaryCoveragePct: number;
    glossaryAvgPerPage: string;
    relatedPagesCount: number;
    relatedAvgLinks: string;
    llmsPages: number;
    i18nPairs: number;
    diataxisAudited: number;
    warnings: string[];
    errors: string[];
  };

  try {
    report = JSON.parse((proc.stdout || '').trim());
  } catch {
    throw new Error(
      `[docs-pipeline-rs] Failed to parse output (exit ${proc.status}):\n${proc.stderr || proc.stdout}`,
    );
  }

  const metrics = [`${report.htmlPages} HTML`, `${report.mdDocs} MD`];
  if (report.mermaidRendered > 0) metrics.push(`${report.mermaidRendered} diagrams`);
  if (report.linkPreviewsIndexed > 0) metrics.push(`${report.linkPreviewsIndexed} previews`);
  if (report.glossaryIndexed > 0) {
    metrics.push(
      `${report.glossaryIndexed} glossary (${report.glossaryCoveragePct}% cov, ${report.glossaryAvgPerPage}/page)`,
    );
  }
  if (report.relatedPagesCount > 0) {
    metrics.push(`${report.relatedPagesCount} related (${report.relatedAvgLinks}/page)`);
  }
  if (report.llmsPages > 0) metrics.push(`${report.llmsPages} llms`);
  if (report.i18nPairs > 0) metrics.push(`${report.i18nPairs} i18n pairs`);
  if (report.diataxisAudited > 0) metrics.push(`${report.diataxisAudited} diataxis`);

  logger.info(`Rust pipeline completed in ${report.elapsedMs}ms (${metrics.join(' · ')})`);

  for (const w of report.warnings) logger.warn(w);
  for (const e of report.errors) logger.error(e);

  if (proc.status !== 0 || report.errors.length > 0) {
    throw new Error(`[docs-pipeline-rs] Build failed with ${report.errors.length || 1} error(s).`);
  }

  return true;
}
