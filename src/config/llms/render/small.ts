import type { PageEntry, ResolvedLlmsConfig } from '../types.js';
import { renderFull } from './full.js';

const CORE_SECTIONS = ['tutorials', 'guides', 'reference', 'explanation'];

export function renderSmall(pages: PageEntry[], cfg: ResolvedLlmsConfig, locale = 'en'): string {
  const scoped = pages.filter((p) => p.locale === locale);
  const selected: PageEntry[] = [];
  const add = (p: PageEntry) => {
    if (!selected.includes(p)) selected.push(p);
  };

  for (const p of scoped) {
    if (p.sectionKey === 'index' || p.type === 'overview' || p.order <= 2) add(p);
  }

  for (const sec of CORE_SECTIONS) {
    const first = scoped.find((p) => p.sectionKey === sec);
    if (first) add(first);
  }

  const label = locale === 'fr' ? 'résumé essentiel' : 'curated subset';
  return renderFull(selected, cfg, locale, label);
}
