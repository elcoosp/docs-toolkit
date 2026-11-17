import fs from 'node:fs';
import path from 'node:path';
import type { AstroIntegrationLogger } from 'astro';
import type { StarlightPlugin } from '@astrojs/starlight/types';

export interface I18nParityOptions {
  strict?: boolean;
  ignorePaths?: string[];
}

interface DocStructure {
  relPath: string;
  h2Count: number;
  codeBlockCount: number;
  admonitionCount: number;
  tabsCount: number;
  internalLinks: string[];
  paragraphs: Set<string>;
}

const FENCE = String.fromCharCode(96).repeat(3);
const Q = String.fromCharCode(34);
const BSLASH = String.fromCharCode(92);

function analyzeMarkdown(relPath: string, raw: string, locales: Set<string>): DocStructure {
  const bodyMatch = raw.match(new RegExp('^---\\r?\\n([\\s\\S]*?)\\r?\\n---\\r?\\n([\\s\\S]*)$'));
  const body = bodyMatch ? (bodyMatch.at(2) ?? '') : raw;
  const lines = body.split(/\r?\n/);

  let inFence = false;
  let h2Count = 0;
  let codeBlockCount = 0;
  let admonitionCount = 0;
  let tabsCount = 0;
  const proseLines: string[] = [];
  const paragraphs = new Set<string>();
  let paraBuf: string[] = [];

  const flushPara = (): void => {
    if (paraBuf.length === 0) return;
    const joined = paraBuf.join(' ').replaceAll(/\s+/g, ' ').trim();
    if (joined.length >= 60) paragraphs.add(joined);
    paraBuf = [];
  };

  for (const rawLine of lines) {
    const t = rawLine.trim();
    if (t.startsWith(FENCE)) {
      flushPara();
      if (!inFence) codeBlockCount++;
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (t.includes('<Code ') || t.includes('<Code>')) codeBlockCount++;

    if (t.startsWith('## ')) {
      flushPara();
      h2Count++;
      continue;
    }
    if (t.startsWith(':::')) {
      flushPara();
      if (t.length > 3) admonitionCount++;
      continue;
    }
    if (t.includes('<Tabs')) tabsCount++;

    proseLines.push(t);
    if (!t) {
      flushPara();
      continue;
    }
    if (
      t.startsWith('#') ||
      t.startsWith('import ') ||
      t.startsWith('export ') ||
      t.startsWith('<') ||
      t.startsWith('|') ||
      t.startsWith('-') ||
      t.startsWith('*')
    ) {
      flushPara();
      continue;
    }
    paraBuf.push(t);
  }
  flushPara();

  const proseJoined = proseLines.join('\n');
  const links = new Set<string>();
  for (const m of proseJoined.matchAll(new RegExp('\\]\\((/[^)#\\s]+)', 'g'))) {
    let href = m.at(1) ?? '';
    const seg = href.split('/').at(1) ?? '';
    if (seg && locales.has(seg)) {
      href = href.slice(seg.length + 1) || '/';
    }
    if (!href.endsWith('/')) href += '/';
    links.add(href);
  }

  return {
    relPath,
    h2Count,
    codeBlockCount,
    admonitionCount,
    tabsCount,
    internalLinks: Array.from(links).toSorted(),
    paragraphs,
  };
}

function runI18nParityAudit(
  docsDir: string,
  secondaryLocales: string[],
  allLocales: Set<string>,
  ignorePaths: string[],
  strict: boolean,
  logger: AstroIntegrationLogger,
): void {
  if (!fs.existsSync(docsDir) || secondaryLocales.length === 0) return;

  const defaultDocs = new Map<string, string>();
  const localizedDocs = new Map<string, Map<string, string>>();
  for (const loc of secondaryLocales) localizedDocs.set(loc, new Map());

  const isIgnored = (rel: string): boolean => {
    if (rel === '404.md' || rel === '404.mdx' || rel.endsWith('/404.md') || rel.endsWith('/404.mdx'))
      return true;
    return ignorePaths.some((prefix) => rel.startsWith(prefix));
  };

  const walk = (dir: string): void => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        walk(full);
        continue;
      }
      if (!item.name.endsWith('.md') && !item.name.endsWith('.mdx')) continue;
      const rel = path.relative(docsDir, full).split(BSLASH).join('/');
      const firstSeg = rel.split('/').at(0) ?? '';
      if (localizedDocs.has(firstSeg)) {
        const subRel = rel.slice(firstSeg.length + 1);
        if (isIgnored(subRel)) continue;
        localizedDocs.get(firstSeg)?.set(subRel, full);
      } else {
        if (isIgnored(rel)) continue;
        defaultDocs.set(rel, full);
      }
    }
  };
  walk(docsDir);

  let warnings = 0;
  let errors = 0;
  let auditedPairs = 0;

  for (const [loc, locMap] of localizedDocs.entries()) {
    for (const [rel, enFile] of defaultDocs.entries()) {
      const locFile = locMap.get(rel);
      if (!locFile) {
        logger.error(
          'Missing ' +
            Q +
            loc +
            Q +
            ' translation for ' +
            Q +
            rel +
            Q +
            ' (expected src/content/docs/' +
            loc +
            '/' +
            rel +
            ').',
        );
        errors++;
        continue;
      }

      auditedPairs++;
      const enDoc = analyzeMarkdown(rel, fs.readFileSync(enFile, 'utf8'), allLocales);
      const locDoc = analyzeMarkdown(loc + '/' + rel, fs.readFileSync(locFile, 'utf8'), allLocales);

      if (enDoc.h2Count !== locDoc.h2Count) {
        logger.warn(
          'Section count drift on ' +
            Q +
            rel +
            Q +
            ': default has ' +
            enDoc.h2Count +
            ' H2, ' +
            Q +
            loc +
            Q +
            ' has ' +
            locDoc.h2Count +
            '.',
        );
        warnings++;
      }
      if (enDoc.codeBlockCount !== locDoc.codeBlockCount) {
        logger.warn(
          'Code block drift on ' +
            Q +
            rel +
            Q +
            ': default has ' +
            enDoc.codeBlockCount +
            ' blocks, ' +
            Q +
            loc +
            Q +
            ' has ' +
            locDoc.codeBlockCount +
            '.',
        );
        warnings++;
      }
      if (enDoc.admonitionCount !== locDoc.admonitionCount) {
        logger.warn(
          'Admonition drift on ' +
            Q +
            rel +
            Q +
            ': default has ' +
            enDoc.admonitionCount +
            ' ::: blocks, ' +
            Q +
            loc +
            Q +
            ' has ' +
            locDoc.admonitionCount +
            '.',
        );
        warnings++;
      }
      if (enDoc.tabsCount !== locDoc.tabsCount) {
        logger.warn(
          'Tabs drift on ' +
            Q +
            rel +
            Q +
            ': default has ' +
            enDoc.tabsCount +
            ' <Tabs>, ' +
            Q +
            loc +
            Q +
            ' has ' +
            locDoc.tabsCount +
            '.',
        );
        warnings++;
      }

      if (enDoc.internalLinks.join(',') !== locDoc.internalLinks.join(',')) {
        logger.warn('Internal link drift on ' + Q + rel + Q + ' between default and ' + Q + loc + Q + '.');
        warnings++;
      }

      let untranslated = 0;
      for (const p of locDoc.paragraphs) {
        if (enDoc.paragraphs.has(p)) untranslated++;
      }
      if (untranslated > 0) {
        logger.warn(
          'Possible untranslated English prose in ' +
            Q +
            loc +
            '/' +
            rel +
            Q +
            ' (' +
            untranslated +
            ' identical paragraph(s)).',
        );
        warnings++;
      }
    }

    for (const rel of locMap.keys()) {
      if (!defaultDocs.has(rel)) {
        logger.warn(
          'Orphan translated page ' + Q + loc + '/' + rel + Q + ' has no counterpart in default locale.',
        );
        warnings++;
      }
    }
  }

  logger.info(
    'Audited ' + auditedPairs + ' i18n page pairs · ' + warnings + ' warning(s), ' + errors + ' error(s).',
  );
  if (strict && errors > 0) {
    throw new Error('[starlight-i18n-parity] Build failed with ' + errors + ' missing translation(s).');
  }
}

export function starlightI18nParity(options: I18nParityOptions = {}): StarlightPlugin {
  const strict = options.strict ?? true;
  const ignorePaths = options.ignorePaths ?? ['blog/'];
  return {
    name: 'starlight-i18n-parity',
    hooks: {
      'config:setup'({ addIntegration, config }) {
        const rootDir = config.root ? new URL(config.root).pathname : process.cwd();
        const docsDir = path.join(rootDir, 'src/content/docs');
        const localeKeys = Object.keys(config.locales ?? {});
        const defaultLocale = config.defaultLocale || 'en';
        const secondaryLocales = localeKeys.filter((k) => k !== defaultLocale && k !== 'root');
        const allLocales = new Set<string>([defaultLocale, ...secondaryLocales]);
        addIntegration({
          name: 'starlight-i18n-parity',
          hooks: {
            'astro:build:done'({ logger }) {
              runI18nParityAudit(docsDir, secondaryLocales, allLocales, ignorePaths, strict, logger);
            },
          },
        });
      },
    },
  };
}
