import { PageEntry, ResolvedLlmsConfig } from '../types.js';

const CANONICAL_SECTION_ORDER = ['tutorials', 'guides', 'reference', 'explanation'];
const NL = String.fromCharCode(10);

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .split('**').join('___DOUBLESTAR___')
    .split('*').join('[^/]*')
    .split('___DOUBLESTAR___').join('.*');
  return new RegExp('^' + escaped + '$');
}

function isOptionalPage(p: PageEntry, optionalPatterns: string[]): boolean {
  if (p.sectionKey === 'blog' || p.sectionKey === 'changelog') return true;
  const unlocalized = p.locale !== 'en' && p.slug.startsWith(p.locale + '/')
    ? p.slug.slice(p.locale.length + 1)
    : p.slug;
  return optionalPatterns.some((pat) => globToRegex(pat).test(p.slug) || globToRegex(pat).test(unlocalized));
}

export function renderIndex(pages: PageEntry[], cfg: ResolvedLlmsConfig, locale = 'en'): string {
  const scoped = pages.filter((p) => p.locale === locale);
  const title = locale === 'fr' ? cfg.title + ' (Français)' : cfg.title;
  let out = '# ' + title + NL + NL;
  if (cfg.description) out += '> ' + cfg.description + NL + NL;
  if (cfg.source) out += 'Source: ' + cfg.source + NL;

  const baseUrl = cfg.url.replace(/\/+$/, '');
  const formatLink = (p: PageEntry) => {
    const target = baseUrl + p.markdownRoute;
    return p.description ? '- [' + p.title + '](' + target + '): ' + p.description + NL : '- [' + p.title + '](' + target + ')' + NL;
  };

  const optionalPages = scoped.filter((p) => isOptionalPage(p, cfg.optional));
  const corePages = scoped.filter((p) => p.sectionKey !== 'index' && !isOptionalPage(p, cfg.optional));

  const distinctKeys = [...new Set(corePages.map((p) => p.sectionKey))];
  const orderedKeys = [
    ...CANONICAL_SECTION_ORDER.filter((k) => distinctKeys.includes(k)),
    ...distinctKeys.filter((k) => !CANONICAL_SECTION_ORDER.includes(k)),
  ];

  for (const key of orderedKeys) {
    const group = corePages.filter((p) => p.sectionKey === key);
    if (group.length === 0) continue;
    out += NL + '## ' + group[0].section + NL + NL;
    for (const p of group) out += formatLink(p);
  }

  if (optionalPages.length > 0) {
    out += NL + '## ' + (locale === 'fr' ? 'Optionnel' : 'Optional') + NL + NL;
    for (const p of optionalPages) out += formatLink(p);
  }

  return out.trim() + NL;
}
