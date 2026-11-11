import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PageEntry } from './types.js';

const TITLE_RE = /^title:\s*(?:["'](.+?)["']|(.+?))\s*$/m;
const DESC_RE = /^description:\s*(?:["'](.+?)["']|(.+?))\s*$/m;
const TYPE_RE = /^type:\s*(?:["'](.+?)["']|(.+?))\s*$/m;
const ORDER_RE = /^order:\s*(\d+)/;

function stripFrontmatter(text: string) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { fm: '', body: text };
  return { fm: m[1], body: text.slice(m[0].length) };
}

function cleanBody(body: string) {
  return body
    .replace(/^import\s+.*?;?\s*$/gm, '')
    .replace(/<\/?(Card|CardGrid|LinkCard|Tabs|TabItem|Steps|FileTree|Aside|Badge)[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function collectPages(contentRoot: string): PageEntry[] {
  const pages: PageEntry[] = [];
  function walk(dir: string, prefix: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, prefix + entry.name + '/');
      } else if (/\.(md|mdx)$/.test(entry.name)) {
        const rel = prefix + entry.name;
        const raw = readFileSync(full, 'utf8');
        const { fm, body } = stripFrontmatter(raw);

        const titleMatch = fm.match(TITLE_RE);
        const title = (titleMatch?.[1] || titleMatch?.[2] || entry.name.replace(/\.(md|mdx)$/, '')).trim();

        const descMatch = fm.match(DESC_RE);
        const description = (descMatch?.[1] || descMatch?.[2] || '').trim();

        const typeMatch = fm.match(TYPE_RE);
        const type = (typeMatch?.[1] || typeMatch?.[2] || '').trim();

        const orderMatch = fm.match(ORDER_RE);
        const order = orderMatch ? Number(orderMatch[1]) : 99;

        const noExt = rel.replace(/\.(md|mdx)$/, '');
        const slug = noExt === 'index' ? 'index' : noExt;
        const route = slug === 'index' ? '/' : `/${slug}/`;
        const markdownRoute = slug === 'index' ? '/index.md' : `/${slug}.md`;
        const section = slug === 'index' ? 'Overview' : humanizeDir(slug.split('/')[0]);

        pages.push({ slug, route, markdownRoute, title, description, type, order, section, body: cleanBody(body) });
      }
    }
  }

  function humanizeDir(d: string) {
     return d.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  walk(contentRoot, '');
  return pages.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}
