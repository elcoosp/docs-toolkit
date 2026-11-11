import { PageEntry, ResolvedLlmsConfig } from '../types.js';

export function renderSmall(pages: PageEntry[], cfg: ResolvedLlmsConfig): string {
  // Curated subset: pages with `order: N` where N < 99, OR type === 'overview'
  const curated = pages.filter(p => p.order < 99 || p.type === 'overview');
  return renderFull(curated, cfg).replace('— full documentation', '— curated subset');
}
