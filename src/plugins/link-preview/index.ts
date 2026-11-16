import type { StarlightPlugin } from '@astrojs/starlight/types';
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
}

function normalizeRoute(route: string): string {
  let clean = route.split('#')[0].split('?')[0];
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
  return `${Math.max(1, Math.round(words / 210))} min`;
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
      const txt = (p.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (txt.length >= 24) { description = txt; break; }
    }
  }
  if (description.length > 180) {
    description = description.slice(0, 177).replace(/\s+\S*$/, '') + '…';
  }

  const headings: Record<string, string> = {};
  for (const h of Array.from(main.querySelectorAll('h2[id], h3[id], h4[id]'))) {
    const id = h.getAttribute('id');
    const hText = (h.textContent ?? '').replace(/#$/, '').replace(/\s+/g, ' ').trim();
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
  const hoverDelay = options.hoverDelay ?? 180;
  return {
    name: 'starlight-link-preview',
    hooks: {
      'config:setup'({ addIntegration }) {
        addIntegration({
          name: 'starlight-link-preview-integration',
          hooks: {
            'astro:config:setup'({ injectScript }) {
              injectScript(
                'page',
                `import { initLinkPreview } from '@elcoosp/docs-toolkit/src/plugins/link-preview/client.ts'; initLinkPreview({ hoverDelay: ${hoverDelay} });`,
              );
            },
            'astro:build:done'({ dir, logger }) {
              const outDir = fileURLToPath(dir);
              const index: Record<string, LinkPreviewEntry> = {};
              let count = 0;
              for (const rel of walkHtmlFiles(outDir)) {
                const route = normalizeRoute('/' + rel.replace(/\\/g, '/'));
                if (route.includes('/404/') || route.includes('/zen-mode/') || route.includes('/presentation-mode/')) continue;
                const entry = extractPreviewFromHtml(route, fs.readFileSync(path.join(outDir, rel), 'utf8'));
                if (entry) { index[route] = entry; count++; }
              }
              fs.writeFileSync(path.join(outDir, '_link-previews.json'), JSON.stringify(index));
              logger.info(`starlight-link-preview: indexed ${count} pages`);
            },
          },
        });
      },
    },
  };
}

export default starlightLinkPreview;
