import fs from 'node:fs';
import path from 'node:path';
import type { AstroIntegrationLogger } from 'astro';
import type { StarlightPlugin } from '@astrojs/starlight/types';

export interface GlossaryEntry {
  term: string;
  definition: string;
  href: string;
  locale: string;
}

export interface TermGlossaryOptions {
  maxTermsPerPage?: number;
  strict?: boolean;
}

const GENERIC_HEADINGS = new Set([
  'overview',
  'summary',
  'introduction',
  'conclusion',
  'see also',
  'next steps',
  'prerequisites',
  'consequences',
  'working today',
  'converging',
  'vue d’ensemble',
  "vue d'ensemble",
  'résumé',
  'voir aussi',
  'prochaines étapes',
]);

function isWordChar(ch: string): boolean {
  return (ch >= '0' && ch <= '9') || ch.toLowerCase() !== ch.toUpperCase();
}

const SENTENCE_PREFIX = /^(why|how|what|where|when|which|who|pourquoi|comment|quoi|où|quand)\b/i;

function stripMdx(raw: string): string {
  return raw
    .replaceAll(/^import\s.+$/gm, '')
    .replaceAll(/^export\s.+$/gm, '')
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll(/`([^`]+)`/g, '$1')
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replaceAll(/[*_~#>]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .replaceAll(/[^a-z0-9\s-]/g, '')
    .trim()
    .replaceAll(/\s+/g, '-');
}

function isValidConceptTerm(term: string): boolean {
  if (term.length < 4 || term.length > 36) return false;
  if (term.endsWith('?') || term.endsWith('.')) return false;
  if (SENTENCE_PREFIX.test(term)) return false;
  if (GENERIC_HEADINGS.has(term.toLowerCase())) return false;
  return term.split(/\s+/).length <= 4;
}

function deriveTerms(rawTitle: string, extraAliases: string[]): string[] {
  const terms = new Set<string>();
  const cleaned = rawTitle.replace(/\s*\([A-Z]{2,5}\)\s*$/, '').trim();
  if (isValidConceptTerm(cleaned)) terms.add(cleaned);
  const noSuffix = cleaned.replace(/,\s*(explained|overview)$/i, '').trim();
  if (isValidConceptTerm(noSuffix)) terms.add(noSuffix);
  const noArticle = noSuffix.replace(/^(the|le|la|les|l’|l')\s+/i, '').trim();
  if (isValidConceptTerm(noArticle)) terms.add(noArticle);
  const head =
    noArticle
      .split(/\s+(?:and|et|vs\.?|—|–|:)\s+/i)
      .at(0)
      ?.trim() ?? '';
  if (isValidConceptTerm(head)) terms.add(head);
  for (const alias of extraAliases) {
    const t = alias.trim();
    if (t.length >= 3) terms.add(t);
  }
  return Array.from(terms);
}

function unquote(val: string): string {
  const t = val.trim();
  return (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))
    ? t.slice(1, -1).trim()
    : t;
}

function parseDoc(content: string): { title: string; aliases: string[]; body: string } {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { title: '', aliases: [], body: content };
  const fm = m.at(1) ?? '';
  const body = m.at(2) ?? '';
  const title =
    fm
      .match(/^title:\s*["']?(.+?)["']?\s*$/m)
      ?.at(1)
      ?.trim() ?? '';
  const aliasRaw = fm.match(/^(?:glossary|aliases):\s*\[([^\]]+)\]/m)?.at(1) ?? '';
  const aliases = aliasRaw
    ? aliasRaw
        .split(',')
        .map((s) => unquote(s))
        .filter(Boolean)
    : [];
  return { title, aliases, body };
}

function firstParagraph(lines: string[]): string {
  const buf: string[] = [];
  let fence = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('```') || t.startsWith(':::')) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    if (!t) {
      if (buf.length > 0) break;
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
      if (buf.length > 0) break;
      continue;
    }
    buf.push(t);
  }
  const clean = stripMdx(buf.join(' '));
  return clean.length > 220 ? clean.slice(0, 217).trimEnd() + '…' : clean;
}

function extractConceptsFromBody(body: string, pageHref: string, locale: string): GlossaryEntry[] {
  const lines = body.split(/\r?\n/);
  const out: GlossaryEntry[] = [];
  let currentAnchor = '';

  for (let i = 0; i < lines.length; i++) {
    const line = (lines.at(i) ?? '').trim();
    if (line.startsWith('## ')) {
      const heading = stripMdx(line.slice(3));
      currentAnchor = slugify(heading);
      const def = firstParagraph(lines.slice(i + 1));
      if (def.length >= 30) {
        const href = currentAnchor ? pageHref + '#' + currentAnchor : pageHref;
        for (const term of deriveTerms(heading, [])) {
          out.push({ term, definition: def, href, locale });
        }
      }
      continue;
    }

    const boldBullet = line.match(/^[-*]\s+\*\*([^*]{3,36})\*\*\s*(?:[—–:-]|\.\s)\s*(.{24,})$/);
    if (boldBullet) {
      const rawTerm = stripMdx(boldBullet.at(1) ?? '');
      const rawDef = stripMdx(boldBullet.at(2) ?? '');
      if (isValidConceptTerm(rawTerm) && rawDef.length >= 24) {
        const href = currentAnchor ? pageHref + '#' + currentAnchor : pageHref;
        const def = rawDef.length > 220 ? rawDef.slice(0, 217).trimEnd() + '…' : rawDef;
        out.push({ term: rawTerm, definition: def, href, locale });
      }
    }
  }
  return out;
}

function loadYaml(siteRoot: string): GlossaryEntry[] {
  for (const name of ['glossary.yml', 'glossary.yaml']) {
    const file = path.join(siteRoot, 'src/content', name);
    if (!fs.existsSync(file)) continue;
    const entries: GlossaryEntry[] = [];
    let cur: Partial<GlossaryEntry> | null = null;
    for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const t = rawLine.trim();
      if (!t || t.startsWith('#')) continue;
      const item = t.match(/^-\s*([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (item) {
        if (cur?.term && cur?.definition && cur?.href)
          entries.push({
            term: cur.term,
            definition: cur.definition,
            href: cur.href,
            locale: cur.locale || 'en',
          });
        cur = {};
        const k = item.at(1);
        const v = unquote(item.at(2) ?? '');
        if (k === 'term' || k === 'definition' || k === 'href' || k === 'locale')
          cur[k] = k === 'locale' ? v.toLowerCase() : v;
        continue;
      }
      const kv = t.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (kv && cur) {
        const k = kv.at(1);
        const v = unquote(kv.at(2) ?? '');
        if (k === 'term' || k === 'definition' || k === 'href' || k === 'locale')
          cur[k] = k === 'locale' ? v.toLowerCase() : v;
      }
    }
    if (cur?.term && cur?.definition && cur?.href)
      entries.push({
        term: cur.term,
        definition: cur.definition,
        href: cur.href,
        locale: cur.locale || 'en',
      });
    return entries;
  }
  return [];
}

function collectEntries(siteRoot: string, locales: Set<string>): GlossaryEntry[] {
  const curated = loadYaml(siteRoot);
  if (curated.length > 0) {
    return curated.toSorted((a, b) => b.term.length - a.term.length);
  }
  const docsDir = path.join(siteRoot, 'src/content/docs');
  const entries: GlossaryEntry[] = [];
  if (fs.existsSync(docsDir)) {
    const walk = (dir: string): void => {
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          walk(full);
          continue;
        }
        if (!item.name.endsWith('.md') && !item.name.endsWith('.mdx')) continue;
        const rel = path.relative(docsDir, full).replaceAll('\\', '/');
        if (!rel.includes('explanation/')) continue;
        const { title, aliases, body } = parseDoc(fs.readFileSync(full, 'utf8'));
        const def = firstParagraph(body.split(/\r?\n/));
        if (!title || title.length < 3 || def.length < 24) continue;
        const seg = rel.split('/').at(0) ?? '';
        const locale = seg && locales.has(seg) ? seg : 'en';
        const href = '/' + rel.replace(/\.(md|mdx)$/, '').replace(/\/index$/, '') + '/';
        for (const term of deriveTerms(title, aliases)) entries.push({ term, definition: def, href, locale });
        entries.push(...extractConceptsFromBody(body, href, locale));
      }
    };
    walk(docsDir);
  }
  const seen = new Set<string>();
  return entries
    .toSorted((a, b) => b.term.length - a.term.length)
    .filter((e) => {
      const k = e.locale + ':' + e.term.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

function runGlossaryQaAudit(
  distDir: string,
  entries: GlossaryEntry[],
  locales: Set<string>,
  logger: AstroIntegrationLogger,
  strict: boolean,
): void {
  if (entries.length === 0) {
    logger.warn('0 glossary entries indexed (add src/content/glossary.yml or explanation/ pages).');
    return;
  }

  let warnings = 0;
  let errors = 0;
  const seenKeys = new Set<string>();

  for (const e of entries) {
    const dupKey = e.locale + ':' + e.term.toLowerCase();
    if (seenKeys.has(dupKey)) {
      logger.warn('Duplicate glossary term "' + e.term + '" [' + e.locale + '].');
      warnings++;
    }
    seenKeys.add(dupKey);

    if (e.definition.length < 24) {
      logger.warn(
        'Short definition (' + e.definition.length + ' chars) for "' + e.term + '" [' + e.locale + '].',
      );
      warnings++;
    } else if (e.definition.length > 260) {
      logger.warn(
        'Long definition (' +
          e.definition.length +
          ' chars, will clamp) for "' +
          e.term +
          '" [' +
          e.locale +
          '].',
      );
      warnings++;
    }

    const parts = e.href.split('#');
    let cleanPath = parts.at(0) ?? '';
    while (cleanPath.startsWith('/')) cleanPath = cleanPath.slice(1);
    const anchor = parts.at(1) ?? '';
    const htmlPath = path.join(distDir, cleanPath, 'index.html');
    if (!fs.existsSync(htmlPath)) {
      logger.error('Broken glossary href "' + e.href + '" for "' + e.term + '" [' + e.locale + '].');
      errors++;
    } else if (anchor) {
      const targetHtml = fs.readFileSync(htmlPath, 'utf8');
      if (!targetHtml.includes('id="' + anchor + '"')) {
        logger.warn(
          'Missing anchor "#' + anchor + '" on target page for "' + e.term + '" [' + e.locale + '].',
        );
        warnings++;
      }
    }
  }
  const htmlFiles: string[] = [];
  const walkHtml = (dir: string): void => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) walkHtml(full);
      else if (item.name === 'index.html' && !full.includes('/zen-mode/') && !full.includes('/404'))
        htmlFiles.push(full);
    }
  };
  walkHtml(distDir);
  let pagesWithMatches = 0;
  let totalMatches = 0;
  const termCounts = new Map<string, number>();
  for (const hf of htmlFiles) {
    const html = fs.readFileSync(hf, 'utf8');
    const marker = 'class="sl-markdown-content"';
    const idx = html.indexOf(marker);
    const endIdx = idx >= 0 ? html.indexOf('</main>', idx) : -1;
    const slice = idx >= 0 ? html.slice(idx, endIdx > idx ? endIdx : undefined) : html;
    const prose = slice
      .replaceAll(new RegExp('<pre[\\s\\S]*?</pre>', 'g'), ' ')
      .replaceAll(new RegExp('<code[\\s\\S]*?</code>', 'g'), ' ')
      .replaceAll(new RegExp('<a\\b[\\s\\S]*?</a>', 'g'), ' ')
      .replaceAll(/<[^>]+>/g, ' ');
    const relUrl =
      '/' + path.relative(distDir, path.dirname(hf)).split(String.fromCharCode(92)).join('/') + '/';
    const firstSeg = relUrl.split('/').at(1) ?? '';
    const locale = firstSeg && locales.has(firstSeg) ? firstSeg : 'en';
    const candidates = entries.filter(
      (e) => e.locale === locale && (e.href.split('#').at(0) ?? '') !== relUrl,
    );
    let pageHits = 0;
    for (const c of candidates) {
      const key = c.locale + ':' + c.term;
      const hay = prose.toLowerCase();
      const needle = c.term.toLowerCase();
      let pos = hay.indexOf(needle);
      let found = false;
      while (pos !== -1) {
        const prev = pos > 0 ? hay.charAt(pos - 1) : ' ';
        let end = pos + needle.length;
        if (hay.charAt(end) === 's') end++;
        const next = end < hay.length ? hay.charAt(end) : ' ';
        if (!isWordChar(prev) && !isWordChar(next)) {
          found = true;
          break;
        }
        pos = hay.indexOf(needle, pos + 1);
      }
      if (found) {
        pageHits++;
        termCounts.set(key, (termCounts.get(key) ?? 0) + 1);
      }
    }
    if (pageHits > 0) pagesWithMatches++;
    totalMatches += pageHits;
  }
  const orphans: string[] = [];
  for (const e of entries) {
    const key = e.locale + ':' + e.term;
    const count = termCounts.get(key) ?? 0;
    if (count === 0) {
      orphans.push(e.term + '[' + e.locale + ']');
    } else if (htmlFiles.length >= 8 && count / htmlFiles.length > 0.65) {
      logger.warn(
        'Over-broad glossary term "' +
          e.term +
          '" [' +
          e.locale +
          '] matches ' +
          count +
          '/' +
          htmlFiles.length +
          ' pages; consider a more specific phrase.',
      );
      warnings++;
    }
  }
  if (orphans.length > 0) {
    logger.warn('Unmatched glossary terms (0 prose hits): ' + orphans.join(', ') + '.');
    warnings += orphans.length;
  }
  const coveragePct = htmlFiles.length > 0 ? Math.round((pagesWithMatches / htmlFiles.length) * 100) : 0;
  const avgPerPage = htmlFiles.length > 0 ? (totalMatches / htmlFiles.length).toFixed(2) : '0.00';
  logger.info(
    'Indexed ' +
      entries.length +
      ' terms · ' +
      coveragePct +
      '% page coverage (avg ' +
      avgPerPage +
      '/page) · ' +
      warnings +
      ' warning(s), ' +
      errors +
      ' error(s).',
  );
  if (strict && errors > 0) {
    throw new Error('[starlight-term-glossary] Build failed with ' + errors + ' broken glossary link(s).');
  }
}
export function starlightTermGlossary(options: TermGlossaryOptions = {}): StarlightPlugin {
  const maxTermsPerPage = options.maxTermsPerPage ?? 12;
  const strict = options.strict ?? true;
  let cachedEntries: GlossaryEntry[] = [];
  let cachedPayload = '[]';
  let cachedLocales = new Set(['en', 'fr']);
  return {
    name: 'starlight-term-glossary',
    hooks: {
      'config:setup'({ addIntegration, config }) {
        const rootDir = config.root ? new URL(config.root).pathname : process.cwd();
        cachedLocales = new Set(['en', 'fr', ...Object.keys(config.locales ?? {})]);
        cachedEntries = collectEntries(rootDir, cachedLocales);
        cachedPayload = JSON.stringify(cachedEntries);
        addIntegration({
          name: 'starlight-term-glossary',
          hooks: {
            'astro:config:setup'({ injectScript, updateConfig }) {
              injectScript(
                'page',
                'import { initTermGlossary } from "@elcoosp/docs-toolkit/src/plugins/term-glossary/client.ts"; initTermGlossary({ maxTermsPerPage: ' +
                  maxTermsPerPage +
                  ' });',
              );
              updateConfig({
                vite: {
                  plugins: [
                    {
                      name: 'starlight-term-glossary-dev',
                      configureServer(server) {
                        server.middlewares.use('/glossary-index.json', (_req, res) => {
                          res.setHeader('Content-Type', 'application/json; charset=utf-8');
                          res.end(cachedPayload);
                        });
                      },
                    },
                  ],
                },
              });
            },
            'astro:build:done'({ dir, logger }) {
              const distDir = new URL(dir).pathname;
              fs.writeFileSync(path.join(distDir, 'glossary-index.json'), cachedPayload);
              runGlossaryQaAudit(distDir, cachedEntries, cachedLocales, logger, strict);
            },
          },
        });
      },
    },
  };
}
