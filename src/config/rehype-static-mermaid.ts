import type { AstroIntegration } from 'astro';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasNativePipeline,
  registerNativePipelinePlugin,
  runNativePipelineOnce,
} from '../plugins/shared/pipeline-host.js';

const SEP = '\n===MERMAID_SEP===\n';

function resolveLegacyBinary(): string {
  const candidates = [
    fileURLToPath(new URL('../assets/bin/static-mermaid-rs', import.meta.url)),
    fileURLToPath(new URL('../../assets/bin/static-mermaid-rs', import.meta.url)),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates.at(0) ?? 'static-mermaid-rs';
}

function decodeHtmlEntities(s: string): string {
  return s
    .replaceAll('&quot;', '"')
    .replaceAll('&#34;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function extractDiagramSource(figureHtml: string): string | null {
  const lineMatches = [...figureHtml.matchAll(/<div class="code">([\s\S]*?)<\/div><\/div>/g)];
  let rawText = '';
  if (lineMatches.length > 0) {
    rawText = lineMatches
      .map((m) => decodeHtmlEntities((m.at(1) ?? '').replaceAll(/<[^>]+>/g, '')))
      .join('\n');
  } else {
    const codeMatch = figureHtml.match(/<code[^>]*>([\s\S]*?)<\/code>/);
    if (!codeMatch) return null;
    rawText = decodeHtmlEntities((codeMatch.at(1) ?? '').replaceAll(/<[^>]+>/g, ''));
  }
  const trimmed = rawText.trim();
  if (/^(?:flowchart|graph)\s+(?:TD|TB|BT|LR|RL)\b/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function walkHtml(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkHtml(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

export function staticMermaidIntegration(): AstroIntegration {
  let rootDir = process.cwd();
  return {
    name: '@elcoosp/docs-toolkit/static-mermaid',
    hooks: {
      'astro:config:setup'({ config, injectScript }) {
        if (config?.root) rootDir = fileURLToPath(config.root);
        if (hasNativePipeline()) {
          registerNativePipelinePlugin(rootDir, 'mermaid', true);
        }
        injectScript(
          'head-inline',
          '(() => { if (document.getElementById("sl-static-diagram-css")) return; const s = document.createElement("style"); s.id = "sl-static-diagram-css"; s.textContent = ".sl-static-diagram{margin:1.5rem 0;padding:1.25rem;border:1px solid var(--sl-color-hairline);border-radius:0.75rem;background:var(--sl-color-bg-sidebar);overflow-x:auto;text-align:center}.sl-static-diagram>span{display:inline-block;max-width:none}.sl-static-diagram svg{width:auto;max-width:none;height:auto;display:block;margin:0 auto}.sl-mermaid-dark{display:none}:root[data-theme=dark] .sl-mermaid-light{display:none}:root[data-theme=dark] .sl-mermaid-dark{display:block}"; document.head.appendChild(s); })();',
        );
      },
      async 'astro:build:done'({ dir, logger }) {
        if (await runNativePipelineOnce(rootDir, dir, logger)) {
          return;
        }
        const outDir = fileURLToPath(dir);
        const htmlFiles = walkHtml(outDir);
        const matches: Array<{ file: string; start: number; end: number; source: string }> = [];
        const fileCache = new Map<string, string>();
        const figureRe = /<div class="expressive-code">[\s\S]*?<\/figure><\/div>/g;

        for (const file of htmlFiles) {
          const html = fs.readFileSync(file, 'utf8');
          if (!html.includes('flowchart ') && !html.includes('graph ')) continue;
          let foundInFile = false;
          for (const m of html.matchAll(figureRe)) {
            const block = m.at(0) ?? '';
            const idx = m.index ?? -1;
            if (idx < 0) continue;
            const src = extractDiagramSource(block);
            if (src) {
              matches.push({ file, start: idx, end: idx + block.length, source: src });
              foundInFile = true;
            }
          }
          if (foundInFile) fileCache.set(file, html);
        }

        if (matches.length === 0) return;

        const bin = resolveLegacyBinary();
        const input = matches.map((m) => m.source).join(SEP);
const rendered = execFileSync(bin, [], { input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const svgs = rendered.split(SEP);
const byFile = new Map<string, Array<{ start: number; end: number; svg: string }>>();
for (let i = 0; i < matches.length; i++) {
const m = matches[i];
const svg = (svgs[i] ?? '').trim();
if (!m || !svg) continue;
const list = byFile.get(m.file) ?? [];
list.push({ start: m.start, end: m.end, svg });
byFile.set(m.file, list);
}
for (const [file, edits] of byFile) {
let html = fileCache.get(file) ?? '';
for (const edit of edits.toSorted((a, b) => b.start - a.start)) {
html = html.slice(0, edit.start) + edit.svg + html.slice(edit.end);
}
fs.writeFileSync(file, html);
}
logger.info('Rendered ' + matches.length + ' static SVG diagram(s) via static-mermaid-rs.');
},
},
};
}
