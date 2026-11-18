import type { StarlightPlugin } from '@astrojs/starlight/types';
import { hasNativePipeline, registerNativePipelinePlugin, runNativePipelineOnce } from '../shared/pipeline-host.js';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';

export interface LinkPreviewEntry {
  title: string;
  description: string;
  section: string;
  readingTime: string;
  headings: Record<string, string>;
}

export interface LinkPreviewPluginOptions {
  hoverDelay?: number;
  codeSymbols?: boolean | { maxLinksPerBlock?: number };
}

function normalizeRoute(route: string): string {
  let clean = route.replace(/[#?].*$/, '');
  if (!clean.startsWith('/')) clean = '/' + clean;
  if (clean.endsWith('/index.html')) clean = clean.slice(0, -10);
  else if (clean.endsWith('.html')) clean = clean.slice(0, -5);
  if (clean.length > 1 && !clean.endsWith('/')) clean += '/';
  return clean;
}

function detectSectionLabel(route: string): string {
  const isFr = route === '/fr/' || route.startsWith('/fr/');
  const p = isFr ? route.replace(/^\/fr/, '') || '/' : route;
  if (p.startsWith('/tutorials/')) return isFr ? 'Tutoriel' : 'Tutorial';
  if (p.startsWith('/guides/')) return isFr ? 'Guide pratique' : 'How-to Guide';
  if (p.startsWith('/reference/')) return isFr ? 'Référence' : 'Reference';
  if (p.startsWith('/explanation/')) return isFr ? 'Explication' : 'Explanation';
  if (p.startsWith('/blog/')) return 'Blog';
  if (p.startsWith('/changelog/')) return 'Changelog';
  return isFr ? 'Documentation' : 'Overview';
}

function estimateReadingLabel(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 210)) + ' min';
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .replaceAll(/[^a-z0-9\s-]/g, '')
    .trim()
    .replaceAll(/\s+/g, '-');
}

function buildSourcePreviewIndex(docsDir: string): Record<string, LinkPreviewEntry> {
  const index: Record<string, LinkPreviewEntry> = {};
  if (!fs.existsSync(docsDir)) return index;

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(md|mdx)$/i.test(entry.name)) continue;
      const rel = path.relative(docsDir, full).replaceAll('\\', '/');
      const noExt = rel.replace(/\.(md|mdx)$/i, '');
      const route = normalizeRoute(
        noExt === 'index'
          ? '/'
          : noExt.endsWith('/index')
            ? '/' + noExt.slice(0, -6) + '/'
            : '/' + noExt + '/',
      );

      const raw = fs.readFileSync(full, 'utf8');
      const [, fm = '', body = raw] = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/) ?? [];

      const [, rawTitle = ''] = fm.match(/^title:\s*["']?(.+?)["']?\s*$/m) ?? [];
      const [, rawDesc = ''] = fm.match(/^description:\s*["']?(.+?)["']?\s*$/m) ?? [];
      const title = rawTitle.trim() || path.basename(noExt);

      const strippedBody = body
        .replaceAll(/```[\s\S]*?```/g, ' ')
        .replaceAll(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, ' ')
        .replaceAll(/<[^>]+>/g, ' ')
        .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replaceAll(/[`*_>#-]/g, ' ');

      let description = rawDesc.trim();
      if (!description) {
        description = strippedBody.replaceAll(/\s+/g, ' ').trim().slice(0, 177);
      }
      if (description.length > 180) {
        description = description.slice(0, 177).replace(/\s+\S*$/, '') + '…';
      }

      const headings: Record<string, string> = {};
      for (const line of body.split(/\r?\n/)) {
        const [, rawHeading = ''] = line.match(/^#{2,4}\s+(.+)$/) ?? [];
        if (rawHeading) {
          const cleanH = rawHeading
            .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replaceAll(/[`*_]/g, '')
            .trim();
          const slug = slugifyHeading(cleanH);
          if (slug && cleanH) headings[slug] = cleanH;
        }
      }

      index[route] = {
        title,
        description,
        section: detectSectionLabel(route),
        readingTime: estimateReadingLabel(strippedBody),
        headings,
      };
    }
  }

  walk(docsDir);
  return index;
}

function extractPreviewFromHtml(route: string, html: string): LinkPreviewEntry | null {
  const { document } = parseHTML(html);
  const main = document.querySelector('main') ?? document.body;
  if (!main) return null;

  const h1 = main.querySelector('h1');
  const rawTitle = (h1?.textContent ?? document.title ?? '').trim();
  const title = rawTitle.replace(/\s+[—–-]\s+[^—–-]+$/, '').trim();
  if (!title) return null;

  let description = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? '';
  if (!description) {
    for (const p of Array.from(main.querySelectorAll('.sl-markdown-content p, p'))) {
      const txt = (p.textContent ?? '').replaceAll(/\s+/g, ' ').trim();
      if (txt.length >= 24) {
        description = txt;
        break;
      }
    }
  }
  if (description.length > 180) {
    description = description.slice(0, 177).replace(/\s+\S*$/, '') + '…';
  }

  const headings: Record<string, string> = {};
  for (const h of Array.from(main.querySelectorAll('h2[id], h3[id], h4[id]'))) {
    const id = h.getAttribute('id');
    const hText = (h.textContent ?? '').replace(/#$/, '').replaceAll(/\s+/g, ' ').trim();
    if (id && hText) headings[id] = hText;
  }

  const contentEl = main.querySelector('.sl-markdown-content') ?? main;
  return {
    title,
    description,
    section: detectSectionLabel(route),
    readingTime: estimateReadingLabel(contentEl.textContent ?? ''),
    headings,
  };
}

function walkHtmlFiles(dir: string, baseDir = dir, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtmlFiles(full, baseDir, out);
    else if (entry.name.endsWith('.html')) out.push(path.relative(baseDir, full));
  }
  return out;
}

export function starlightLinkPreview(options: LinkPreviewPluginOptions = {}): StarlightPlugin {
  let rootDir = process.cwd();
  const hoverDelay = options.hoverDelay ?? 180;
  const virtualId = 'virtual:starlight-link-preview';
  const resolvedVirtualId = '\0' + virtualId;

  return {
    name: 'starlight-link-preview',
    hooks: {
      'config:setup'({ addIntegration, config }) {
        rootDir = (config as { root?: string }).root ? fileURLToPath((config as { root?: string }).root!) : process.cwd();
        if (hasNativePipeline()) {
          registerNativePipelinePlugin(rootDir, 'linkPreview', true);
          if (options.codeSymbols !== false) {
            registerNativePipelinePlugin(rootDir, 'codeSymbols', typeof options.codeSymbols === 'object' ? options.codeSymbols : { maxLinksPerBlock: 8 });
          }
        }
        addIntegration({
          name: 'starlight-link-preview-integration',
          hooks: {
            'astro:config:setup'({ injectScript, updateConfig }) {
              updateConfig({
                vite: {
                  plugins: [
                    {
                      name: 'starlight-link-preview-virtual',
                      resolveId(id) {
                        if (id === virtualId) return resolvedVirtualId;
                      },
                      load(id) {
                        if (id === resolvedVirtualId) {
                          const docsDir = path.resolve(process.cwd(), 'src/content/docs');
                          const data = buildSourcePreviewIndex(docsDir);
                          return 'export const LINK_PREVIEWS = ' + JSON.stringify(data) + ';';
                        }
                      },
                    },
                  ],
                },
              });
              injectScript(
                'page',
                'import { initLinkPreview } from "@elcoosp/docs-toolkit/src/plugins/link-preview/client.ts"; initLinkPreview({ hoverDelay: ' +
                  hoverDelay +
                  ' });',
              );
            },
            async 'astro:build:done'({ dir, logger }) {
              if (await runNativePipelineOnce(rootDir, dir, logger)) return;
              const outDir = fileURLToPath(dir);
              const index: Record<string, LinkPreviewEntry> = {};
              let count = 0;
              for (const rel of walkHtmlFiles(outDir)) {
                const route = normalizeRoute('/' + rel.replaceAll('\\', '/'));
                if (
                  route.includes('/404/') ||
                  route.includes('/zen-mode/') ||
                  route.includes('/presentation-mode/')
                )
                  continue;
                const entry = extractPreviewFromHtml(route, fs.readFileSync(path.join(outDir, rel), 'utf8'));
                if (entry) {
                  index[route] = entry;
                  count++;
                }
              }
              fs.writeFileSync(path.join(outDir, '_link-previews.json'), JSON.stringify(index));
              logger.info('starlight-link-preview: indexed ' + count + ' pages');
            },
          },
        });
      },
    },
  };
}

export default starlightLinkPreview;
