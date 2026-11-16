import { PageEntry, ResolvedLlmsConfig } from '../types.js';

const CANONICAL_SECTION_ORDER = ['index', 'tutorials', 'guides', 'reference', 'explanation', 'blog', 'changelog'];
const NL = String.fromCharCode(10);

export function renderFull(pages: PageEntry[], cfg: ResolvedLlmsConfig, locale = 'en', subtitle = 'full documentation'): string {
  const scoped = pages.filter((p) => p.locale === locale);
  const ordered = [...scoped].sort((a, b) => {
    const ia = CANONICAL_SECTION_ORDER.indexOf(a.sectionKey);
    const ib = CANONICAL_SECTION_ORDER.indexOf(b.sectionKey);
    const sa = ia === -1 ? 50 : ia;
    const sb = ib === -1 ? 50 : ib;
    return sa - sb || a.order - b.order || a.title.localeCompare(b.title);
  });

  const title = locale === 'fr' ? cfg.title + ' (Français) — ' + subtitle : cfg.title + ' — ' + subtitle;
  let out = '# ' + title + NL + NL;
  if (cfg.description) out += '> ' + cfg.description + NL + NL;
  if (cfg.source) out += 'Source: ' + cfg.source + NL + NL;

  for (const p of ordered) {
    out += '---' + NL + NL + '# ' + p.title + NL + NL;
    if (p.description) out += '> ' + p.description + NL + NL;
    if (p.body) out += p.body + NL + NL;
  }
  return out.trim() + NL;
}
