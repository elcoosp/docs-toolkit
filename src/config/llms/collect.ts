import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PageEntry, ResolvedLlmsConfig } from './types.js';

const SECTION_LABELS_EN: Record<string, string> = {
  index: 'Overview',
  tutorials: 'Tutorials',
  guides: 'How-to Guides',
  reference: 'Reference',
  explanation: 'Explanation',
  blog: 'Blog',
  changelog: 'Changelog',
};

const SECTION_LABELS_FR: Record<string, string> = {
  index: "Vue d'ensemble",
  tutorials: 'Tutoriels',
  guides: 'Guides pratiques',
  reference: 'Référence',
  explanation: 'Explications',
  blog: 'Blog',
  changelog: 'Journal des modifications',
};

function humanizeDir(d: string): string {
  return d
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function stripFrontmatter(text: string): { fm: string; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { fm: '', body: text };
  return { fm: m[1], body: text.slice(m[0].length) };
}

function unquoteYaml(val: string): string {
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).replaceAll('\\"', '"').replaceAll("''", "'").trim();
  }
  return trimmed;
}

function extractYamlField(fm: string, key: string): string {
  const lines = fm.split(/\r?\n/);
  const keyRe = new RegExp('^' + key + ':\\s*(.*)$');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(keyRe);
    if (!m) continue;
    const rest = m[1].trim();
    if (rest === '>' || rest === '|' || rest === '>-' || rest === '|-') {
      const collected: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (/^\s+\S/.test(lines[j])) collected.push(lines[j].trim());
        else if (lines[j].trim() === '') collected.push('');
        else break;
      }
      return collected.join(rest.startsWith('|') ? '\n' : ' ').trim();
    }
    if (rest.length > 0) return unquoteYaml(rest);
  }
  return '';
}

function extractOrder(fm: string): number {
  const topLevel = fm.match(/^order:\s*(\d+)\s*$/m);
  if (topLevel) return Number(topLevel[1]);
  const sidebarOrder = fm.match(/^sidebar:\s*\r?\n(?:[ \t]+[^\r\n]+\r?\n)*?[ \t]+order:\s*(\d+)\s*$/m);
  if (sidebarOrder) return Number(sidebarOrder[1]);
  return 99;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replaceAll(/[.+^${}()|[\]\\]/g, '\\$&')
    .replaceAll('**', '___DOUBLESTAR___')
    .replaceAll('*', '[^/]*')
    .replaceAll('___DOUBLESTAR___', '.*');
  return new RegExp('^' + escaped + '$');
}

function matchesAny(slug: string, patterns: string[]): boolean {
  return patterns.some((p) => globToRegex(p).test(slug));
}

function renderDiataxisItemsToMarkdown(rawTag: string, baseUrl: string): string {
  const itemsMatch = rawTag.match(/items=\{\s*(\[[\s\S]*\])\s*\}/);
  if (!itemsMatch) return '';
  try {
    const parsed = Function('"use strict"; return (' + itemsMatch[1] + ');')();
    if (!Array.isArray(parsed)) return '';
    return parsed
      .map((item: { title?: string; description?: string; href?: string }) => {
        const title = String(item.title ?? '').trim();
        const desc = String(item.description ?? '').trim();
        const rawHref = String(item.href ?? '').trim();
        const href = rawHref.startsWith('/') && baseUrl ? baseUrl + rawHref : rawHref;
        if (!title) return '';
        return href
          ? '- [' + title + '](' + href + ')' + (desc ? ': ' + desc : '')
          : '- **' + title + '**' + (desc ? ': ' + desc : '');
      })
      .filter(Boolean)
      .join('\n');
  } catch {
    return '';
  }
}

function cleanProseSegment(segment: string, baseUrl: string): string {
  return segment
    .replaceAll(/^(?:import|export)\s+.*?;?\s*$/gm, '')
    .replaceAll(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replaceAll(/<DiataxisGrid\b[\s\S]*?\/>/g, (m) => '\n' + renderDiataxisItemsToMarkdown(m, baseUrl) + '\n')
    .replaceAll(/<Card\b([^>]*?)\/>/g, (_m, attrs: string) => {
      const title = (attrs.match(/\btitle=["']([^"']+)["']/) || []).at(1) ?? '';
      const desc = (attrs.match(/\bdescription=["']([^"']+)["']/) || []).at(1) ?? '';
      const rawHref = (attrs.match(/\bhref=["']([^"']+)["']/) || []).at(1) ?? '';
      const href = rawHref.startsWith('/') && baseUrl ? baseUrl + rawHref : rawHref;
      if (!title) return '';
      return href
        ? '- [' + title + '](' + href + ')' + (desc ? ': ' + desc : '')
        : '- **' + title + '**' + (desc ? ': ' + desc : '');
    })
    .replaceAll(/<LinkCard\b([^>]*?)\/>/g, (_m, attrs: string) => {
      const title = attrs.match(/\btitle=["']([^"']+)["']/)?.[1] ?? '';
      const desc = attrs.match(/\bdescription=["']([^"']+)["']/)?.[1] ?? '';
      const rawHref = attrs.match(/\bhref=["']([^"']+)["']/)?.[1] ?? '';
      const href = rawHref.startsWith('/') && baseUrl ? baseUrl + rawHref : rawHref;
      if (!title) return '';
      return href
        ? '- [' + title + '](' + href + ')' + (desc ? ': ' + desc : '')
        : '- **' + title + '**' + (desc ? ': ' + desc : '');
    })
    .replaceAll(/<LinkButton\b([^>]*)>([\s\S]*?)<\/LinkButton>/g, (_m, attrs: string, label: string) => {
      const rawHref = attrs.match(/\bhref=["']([^"']+)["']/)?.[1] ?? '';
      const href = rawHref.startsWith('/') && baseUrl ? baseUrl + rawHref : rawHref;
      const cleanLabel = label.trim();
      return href && cleanLabel ? '[' + cleanLabel + '](' + href + ')' : cleanLabel;
    })
    .replaceAll(/<Aside\b([^>]*)>([\s\S]*?)<\/Aside>/g, (_m, attrs: string, inner: string) => {
      const type = attrs.match(/\btype=["']([^"']+)["']/)?.[1] ?? 'note';
      const title = attrs.match(/\btitle=["']([^"']+)["']/)?.[1];
      const heading = title ? type.toUpperCase() + ': ' + title : type.toUpperCase();
      const lines = inner
        .trim()
        .split(/\r?\n/)
        .map((l) => ('> ' + l).trimEnd());
      return '\n> **' + heading + '**\n' + lines.join('\n') + '\n';
    })
    .replaceAll(/<Card\b([^>]*)>([\s\S]*?)<\/Card>/g, (_m, attrs: string, inner: string) => {
      const title = attrs.match(/\btitle=["']([^"']+)["']/)?.[1] ?? '';
      const body = inner.trim();
      return title ? '\n### ' + title + '\n\n' + body + '\n' : '\n' + body + '\n';
    })
    .replaceAll(/<TabItem\b([^>]*)>([\s\S]*?)<\/TabItem>/g, (_m, attrs: string, inner: string) => {
      const label = attrs.match(/\blabel=["']([^"']+)["']/)?.[1] ?? '';
      const body = inner.trim();
      return label ? '\n#### ' + label + '\n\n' + body + '\n' : '\n' + body + '\n';
    })
    .replaceAll(/<Badge\b([^>]*?)\/>/g, (_m, attrs: string) => {
      const text = attrs.match(/\btext=["']([^"']+)["']/)?.[1] ?? '';
      return text ? String.fromCharCode(96) + text + String.fromCharCode(96) : '';
    })
    .replaceAll(
      /<\/?(?:CardGrid|Tabs|Steps|FileTree|ShowcaseProfile|ShowcaseText|ShowcaseImage|ShowcaseCTA)\b[^>]*>/g,
      '',
    )
    .replaceAll(/<(?:Icon|CardGrid|Tabs|Steps|FileTree)\b[^>]*\/>/g, '')
    .replaceAll(/\n{3,}/g, '\n\n');
}

export function cleanBody(body: string, baseUrl = ''): string {
  const fence = String.fromCharCode(96).repeat(3);
  const fenceRe = new RegExp('(' + fence + '[s\S]?' + fence + '|~~~[s\S]?~~~)', 'g');
  const parts = body.split(fenceRe);
  return parts
    .map((part, idx) => (idx % 2 === 1 ? part : cleanProseSegment(part, baseUrl)))
    .join('')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}

export function collectPages(contentRoot: string, cfg?: ResolvedLlmsConfig): PageEntry[] {
  const pages: PageEntry[] = [];
  const knownLocales = new Set((cfg?.locales ?? []).filter((l) => l && l !== 'root'));
  if (knownLocales.size === 0) knownLocales.add('fr');

  const excludePatterns = cfg?.exclude ?? ['404', '/404', 'zen-mode/'];
  const baseUrl = cfg?.url ?? '';

  function walk(dir: string, prefix: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, prefix + entry.name + '/');
      } else if (/.(md|mdx)$/.test(entry.name)) {
        const rel = prefix + entry.name;
        const noExt = rel.replace(/.(md|mdx)$/, '');
        const normalizedSlug =
          noExt.endsWith('/index') && noExt !== 'index' ? noExt.slice(0, -'/index'.length) : noExt;

        if (matchesAny(normalizedSlug, excludePatterns)) continue;

        const raw = readFileSync(full, 'utf8');
        const { fm, body } = stripFrontmatter(raw);

        const title = extractYamlField(fm, 'title') || entry.name.replace(/.(md|mdx)$/, '');
        const description = extractYamlField(fm, 'description');
        const type = extractYamlField(fm, 'type');
        const order = extractOrder(fm);

        const segments = normalizedSlug.split('/');
        const firstSeg = segments[0];
        const isSecondaryLocale = knownLocales.has(firstSeg);
        const locale = isSecondaryLocale ? firstSeg : 'en';
        const unlocalizedSlug = isSecondaryLocale
          ? segments.length === 1
            ? 'index'
            : segments.slice(1).join('/')
          : normalizedSlug;

        const route = normalizedSlug === 'index' ? '/' : '/' + normalizedSlug + '/';
        const markdownRoute = normalizedSlug === 'index' ? '/index.md' : '/' + normalizedSlug + '.md';

        const sectionKey = unlocalizedSlug === 'index' ? 'index' : unlocalizedSlug.split('/')[0];
        const labelMap = locale === 'fr' ? SECTION_LABELS_FR : SECTION_LABELS_EN;
        const section = labelMap[sectionKey] ?? humanizeDir(sectionKey);

        pages.push({
          slug: normalizedSlug,
          locale,
          route,
          markdownRoute,
          title,
          description,
          type,
          order,
          sectionKey,
          section,
          body: cleanBody(body, baseUrl),
        });
      }
    }
  }

  walk(contentRoot, '');
  return pages.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}
