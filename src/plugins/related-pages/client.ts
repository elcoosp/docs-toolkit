export interface RelatedItem {
  href: string;
  title: string;
  description: string;
  category: string;
}

type RelatedMap = Record<string, RelatedItem[]>;

let cachedMap: RelatedMap | null = null;
let inflight: Promise<RelatedMap> | null = null;

const LABELS: Record<string, Record<string, string>> = {
  en: {
    heading: 'Related reading',
    tutorials: 'Tutorial',
    guides: 'Guide',
    explanation: 'Explanation',
    reference: 'Reference',
    docs: 'Docs',
  },
  fr: {
    heading: 'Pour aller plus loin',
    tutorials: 'Tutoriel',
    guides: 'Guide',
    explanation: 'Explication',
    reference: 'Référence',
    docs: 'Doc',
  },
};

function loadRelated(): Promise<RelatedMap> {
  if (cachedMap) return Promise.resolve(cachedMap);
  if (inflight) return inflight;
  inflight = fetch('/related-pages.json')
    .then((r) => (r.ok ? (r.json() as Promise<RelatedMap>) : {}))
    .then((data) => {
      cachedMap = data ?? {};
      return cachedMap;
    })
    .catch(() => ({}));
  return inflight;
}

function ensureStyles(): void {
  if (document.querySelector('#sl-related-pages-style')) return;
  const style = document.createElement('style');
  style.id = 'sl-related-pages-style';
  style.textContent = [
    '.sl-related-wrap { margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid var(--sl-color-hairline); }',
    '.sl-related-title { font-size: var(--sl-text-sm); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--sl-color-gray-2); margin: 0 0 0.85rem 0; }',
    '.sl-related-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0.75rem; }',
    '.sl-related-card { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.85rem 1rem; border-radius: 0.5rem; border: 1px solid var(--sl-color-hairline); background: var(--sl-color-bg-nav); text-decoration: none; color: inherit; transition: border-color 0.15s ease, transform 0.15s ease; }',
    '.sl-related-card:hover { border-color: var(--sl-color-accent); transform: translateY(-1px); }',
    '.sl-related-badge { align-self: flex-start; font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.12rem 0.45rem; border-radius: 999px; background: var(--sl-color-accent-low); color: var(--sl-color-text-accent); }',
    '.sl-related-card-title { font-weight: 600; font-size: var(--sl-text-base); color: var(--sl-color-white); line-height: 1.3; }',
    '.sl-related-card-desc { font-size: var(--sl-text-xs); color: var(--sl-color-gray-3); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }',
  ].join('\n');
  document.head.append(style);
}

function normPath(p: string): string {
  let out = p.split('#').at(0)?.split('?').at(0) ?? '/';
  if (!out.endsWith('/')) out += '/';
  return out;
}

async function renderRelated(): Promise<void> {
  const path = normPath(window.location.pathname);
  if (path.startsWith('/zen-mode/') || path.includes('/404/')) return;
  const main = document.querySelector('main');
  if (!main) return;
  if (document.querySelector('.sl-related-wrap[data-ssr="true"]')) return;
  document.querySelector('.sl-related-wrap')?.remove();

  const map = await loadRelated();
  const items = map[path];
  if (!items || items.length === 0) return;

  ensureStyles();
  const isFr = path.startsWith('/fr/');
  const dict = isFr ? LABELS.fr : LABELS.en;

  const wrap = document.createElement('section');
  wrap.className = 'sl-related-wrap not-content';
  wrap.setAttribute('aria-label', dict.heading);

  const h = document.createElement('h2');
  h.className = 'sl-related-title';
  h.textContent = dict.heading;
  wrap.append(h);

  const grid = document.createElement('div');
  grid.className = 'sl-related-grid';

  for (const item of items) {
    const card = document.createElement('a');
    card.className = 'sl-related-card';
    card.href = item.href;

    const badge = document.createElement('span');
    badge.className = 'sl-related-badge';
    badge.textContent = dict[item.category] ?? dict.docs;
    card.append(badge);

    const title = document.createElement('span');
    title.className = 'sl-related-card-title';
    title.textContent = item.title;
    card.append(title);

    if (item.description) {
      const desc = document.createElement('span');
      desc.className = 'sl-related-card-desc';
      desc.textContent = item.description;
      card.append(desc);
    }
    grid.append(card);
  }

  wrap.append(grid);
  const anchor = main.querySelector('footer') ?? main.querySelector('.pagination-links');
  if (anchor && anchor.parentElement) {
    anchor.parentElement.insertBefore(wrap, anchor);
  } else {
    main.append(wrap);
  }
}

export function initRelatedPages(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void renderRelated());
  } else {
    void renderRelated();
  }
  document.addEventListener('astro:page-load', () => void renderRelated());
}
