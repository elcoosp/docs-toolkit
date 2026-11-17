import fs from 'node:fs';
import path from 'node:path';
import type { AstroIntegrationLogger } from 'astro';
import type { StarlightPlugin } from '@astrojs/starlight/types';
import { hasNativePipeline, registerNativePipelinePlugin, runNativePipelineOnce } from '../shared/pipeline-host.js';

export interface RelatedPagesOptions {
  maxRelated?: number;
}

interface RelatedItem {
  href: string;
  title: string;
  description: string;
  category: string;
}

interface DocRecord {
  href: string;
  locale: string;
  category: string;
  title: string;
  description: string;
  tf: Map<string, number>;
  docLen: number;
}

const BSLASH = String.fromCharCode(92);
const FENCE = String.fromCharCode(96).repeat(3);
const Q = String.fromCharCode(34);
const SQ = String.fromCharCode(39);

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'your',
  'when',
  'where',
  'what',
  'which',
  'how',
  'why',
  'are',
  'was',
  'were',
  'will',
  'can',
  'could',
  'should',
  'would',
  'have',
  'has',
  'had',
  'not',
  'but',
  'use',
  'using',
  'les',
  'des',
  'une',
  'dans',
  'pour',
  'avec',
  'sans',
  'sur',
  'par',
  'est',
  'sont',
  'cette',
  'ces',
  'qui',
  'que',
  'quoi',
  'comment',
  'pourquoi',
  'quand',
  'plus',
  'tout',
  'tous',
  'chaque',
  'entre',
  'vers',
  'aux',
  'vous',
  'nous',
]);

function tokenize(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '');
  const tokens: string[] = [];
  for (const m of normalized.matchAll(/[a-z][a-z0-9_-]{2,}/g)) {
    const w = m.at(0) ?? '';
    if (!STOPWORDS.has(w)) tokens.push(w);
  }
  return tokens;
}

function unquote(val: string): string {
  const t = val.trim();
  return (t.startsWith(Q) && t.endsWith(Q)) || (t.startsWith(SQ) && t.endsWith(SQ))
    ? t.slice(1, -1).trim()
    : t;
}

function parseMarkdownDoc(raw: string): { title: string; description: string; body: string } {
  const m = raw.match(new RegExp('^---\\r?\\n([\\s\\S]*?)\\r?\\n---\\r?\\n([\\s\\S]*)$'));
  if (!m) return { title: '', description: '', body: raw };
  const fm = m.at(1) ?? '';
  const body = m.at(2) ?? '';
  const title = unquote(fm.match(/^title:\s*(.+)$/m)?.at(1) ?? '');
  const description = unquote(fm.match(/^description:\s*(.+)$/m)?.at(1) ?? '');
  return { title, description, body };
}

function stripCodeAndTags(body: string): string {
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  let inFence = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith(FENCE)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (t.startsWith('import ') || t.startsWith('export ')) continue;
    out.push(
      t
        .replaceAll(/<[^>]+>/g, ' ')
        .replaceAll(new RegExp(String.fromCharCode(96) + '[^`]+' + String.fromCharCode(96), 'g'), ' '),
    );
  }
  return out.join(' ');
}

function detectCategory(relNoLocale: string): string {
  const seg = relNoLocale.split('/').at(0) ?? '';
  if (seg === 'tutorials' || seg === 'guides' || seg === 'explanation' || seg === 'reference') return seg;
  return 'docs';
}

function buildRelatedGraph(
  docsDir: string,
  locales: Set<string>,
  maxRelated: number,
): Record<string, RelatedItem[]> {
  if (!fs.existsSync(docsDir)) return {};
  const records: DocRecord[] = [];

  const walk = (dir: string): void => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        walk(full);
        continue;
      }
      if (!item.name.endsWith('.md') && !item.name.endsWith('.mdx')) continue;
      const rel = path.relative(docsDir, full).split(BSLASH).join('/');
      if (rel.endsWith('404.md') || rel.endsWith('404.mdx')) continue;
      const firstSeg = rel.split('/').at(0) ?? '';
      const locale = firstSeg && locales.has(firstSeg) ? firstSeg : 'en';
      const relNoLocale =
        locale !== 'en' && rel.startsWith(locale + '/') ? rel.slice(locale.length + 1) : rel;
      if (relNoLocale === 'index.md' || relNoLocale === 'index.mdx' || relNoLocale.startsWith('blog/'))
        continue;

      const { title, description, body } = parseMarkdownDoc(fs.readFileSync(full, 'utf8'));
      if (!title) continue;

      const href = '/' + rel.replace(/\.(md|mdx)$/, '').replace(/\/index$/, '') + '/';
      const tf = new Map<string, number>();
      const addTokens = (toks: string[], weight: number): void => {
        for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + weight);
      };
      addTokens(tokenize(title), 4);
      addTokens(tokenize(description), 2);
      addTokens(tokenize(stripCodeAndTags(body)), 1);
      let docLen = 0;
      for (const v of tf.values()) docLen += v;

      records.push({
        href,
        locale,
        category: detectCategory(relNoLocale),
        title,
        description,
        tf,
        docLen: Math.max(docLen, 1),
      });
    }
  };
  walk(docsDir);

  const result: Record<string, RelatedItem[]> = {};
  const byLocale = new Map<string, DocRecord[]>();
  for (const r of records) {
    const list = byLocale.get(r.locale) ?? [];
    list.push(r);
    byLocale.set(r.locale, list);
  }

  for (const group of byLocale.values()) {
    const nDocs = group.length;
    if (nDocs <= 1) continue;
    const df = new Map<string, number>();
    let totalLen = 0;
    for (const d of group) {
      totalLen += d.docLen;
      for (const term of d.tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
    }
    const avgdl = Math.max(totalLen / nDocs, 1);
    const k1 = 1.4;
    const b = 0.65;

    for (const src of group) {
      const scored: Array<{ doc: DocRecord; score: number }> = [];
      for (const cand of group) {
        if (cand.href === src.href) continue;
        let score = 0;
        for (const [term, srcW] of src.tf.entries()) {
          const candTf = cand.tf.get(term);
          if (!candTf) continue;
          const termDf = df.get(term) ?? 1;
          const idf = Math.log(1 + (nDocs - termDf + 0.5) / (termDf + 0.5));
          const normTf = (candTf * (k1 + 1)) / (candTf + k1 * (1 - b + b * (cand.docLen / avgdl)));
          score += idf * normTf * Math.min(srcW, 4);
        }
        if (cand.category !== src.category) score *= 1.18;
        if (score > 0.2) scored.push({ doc: cand, score });
      }
      scored.sort((a, bItem) => bItem.score - a.score);

      const picked: DocRecord[] = [];
      const usedCats = new Set<string>([src.category]);
      for (const item of scored) {
        if (picked.length >= maxRelated) break;
        if (!usedCats.has(item.doc.category)) {
          picked.push(item.doc);
          usedCats.add(item.doc.category);
        }
      }
      for (const item of scored) {
        if (picked.length >= maxRelated) break;
        if (!picked.some((p) => p.href === item.doc.href)) picked.push(item.doc);
      }

      result[src.href] = picked.map((p) => ({
        href: p.href,
        title: p.title,
        description: p.description,
        category: p.category,
      }));
    }
  }

  return result;
}

function runRelatedQaAudit(graph: Record<string, RelatedItem[]>, logger: AstroIntegrationLogger): void {
  const pages = Object.keys(graph);
  if (pages.length === 0) return;
  let totalLinks = 0;
  let isolated = 0;
  for (const p of pages) {
    const count = graph[p]?.length ?? 0;
    totalLinks += count;
    if (count === 0) isolated++;
  }
  const avg = (totalLinks / pages.length).toFixed(2);
  if (isolated > 0) {
    logger.warn(isolated + ' page(s) have 0 related recommendations.');
  }
  logger.info('Built related graph for ' + pages.length + ' pages (avg ' + avg + ' links/page).');
}

export function starlightRelatedPages(options: RelatedPagesOptions = {}): StarlightPlugin {
  const maxRelated = options.maxRelated ?? 3;
  let cachedGraph: Record<string, RelatedItem[]> = {};
  let cachedPayload = '{}';
  return {
    name: 'starlight-related-pages',
    hooks: {
      'config:setup'({ addIntegration, config }) {
        const rootDir = (config as { root?: string }).root ? new URL((config as { root?: string }).root!).pathname : process.cwd();
        const docsDir = path.join(rootDir, 'src/content/docs');
        const locales = new Set(['en', 'fr', ...Object.keys(config.locales ?? {})]);
        if (hasNativePipeline()) {
          registerNativePipelinePlugin(rootDir, 'relatedPages', { maxRelated }, locales, config.defaultLocale);
        } else {
          cachedGraph = buildRelatedGraph(docsDir, locales, maxRelated);
        }
        cachedPayload = JSON.stringify(cachedGraph);
        addIntegration({
          name: 'starlight-related-pages',
          hooks: {
            'astro:config:setup'({ injectScript, updateConfig }) {
              injectScript(
                'page',
                'import { initRelatedPages } from ' +
                  Q +
                  '@elcoosp/docs-toolkit/src/plugins/related-pages/client.ts' +
                  Q +
                  '; initRelatedPages();',
              );
              updateConfig({
                vite: {
                  plugins: [
                    {
                      name: 'starlight-related-pages-dev',
                      configureServer(server) {
                        server.middlewares.use('/related-pages.json', (_req, res) => {
                          res.setHeader('Content-Type', 'application/json; charset=utf-8');
                          res.end(cachedPayload);
                        });
                      },
                    },
                  ],
                },
              });
            },
            async 'astro:build:done'({ dir, logger }) {
              if (await runNativePipelineOnce(rootDir, dir, logger)) return;
              fs.writeFileSync(path.join(new URL(dir).pathname, 'related-pages.json'), cachedPayload);
              runRelatedQaAudit(cachedGraph, logger);
            },
          },
        });
      },
    },
  };
}
