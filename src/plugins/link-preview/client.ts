import { LINK_PREVIEWS } from 'virtual:starlight-link-preview';
import { createHoverCardController } from '../shared/hover-card';

interface LinkPreviewEntry {
  title: string;
  description: string;
  section: string;
  readingTime: string;
  headings: Record<string, string>;
}

let initialized = false;
const CODE_SYM_CSS = `
.sl-markdown-content pre code a.dt-code-symbol,
.expressive-code pre code a.dt-code-symbol {
  color: inherit !important;
  font: inherit !important;
  text-decoration: none !important;
  background-image: linear-gradient(to right, color-mix(in srgb, currentColor 38%, transparent) 55%, transparent 0%) !important;
  background-position: 0 100% !important;
  background-size: 4px 1px !important;
  background-repeat: repeat-x !important;
  padding-bottom: 1px !important;
  border-radius: 2px !important;
  transition: background-color 140ms ease, background-image 140ms ease !important;
}
.sl-markdown-content pre code a.dt-code-symbol:hover,
.sl-markdown-content pre code a.dt-code-symbol:focus-visible,
.expressive-code pre code a.dt-code-symbol:hover,
.expressive-code pre code a.dt-code-symbol:focus-visible {
  color: inherit !important;
  text-decoration: none !important;
  background-color: color-mix(in srgb, var(--sl-color-accent) 14%, transparent) !important;
  background-image: linear-gradient(to right, var(--sl-color-accent-high, var(--sl-color-accent)) 100%, transparent 0%) !important;
  background-size: 100% 1.5px !important;
}
`;

function normalizePathname(pathname: string): string {
  let p = pathname.replace(/[#?].*$/, '');
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1 && !p.endsWith('/')) p += '/';
  return p;
}

function findPreviewableLink(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  if (Object.hasOwn(document.documentElement.dataset, 'hasHero')) return null;
  const anchor = target.closest('.sl-markdown-content a[href]') as HTMLAnchorElement | null;
  if (
    !anchor ||
    anchor.classList.contains('sl-anchor-link') ||
    anchor.classList.contains('sl-context-edit') ||
    anchor.classList.contains('sl-link-button') ||
    anchor.closest('.hero, .sl-link-card, .pagination-links')
  ) {
    return null;
  }
  const href = anchor.getAttribute('href') ?? '';
  if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || anchor.hasAttribute('download')) {
    return null;
  }
  return anchor;
}

export function initLinkPreview(opts: { hoverDelay?: number } = {}): void {
  if (typeof window === 'undefined' || initialized) return;
  initialized = true;

  if (!document.querySelector('#dt-code-symbol-style')) {
    const st = document.createElement('style');
    st.id = 'dt-code-symbol-style';
    st.textContent = CODE_SYM_CSS;
    document.head.append(st);
  }
  const hoverDelay = opts.hoverDelay ?? 180;
  const index = (LINK_PREVIEWS ?? {}) as Record<string, LinkPreviewEntry>;
  const card = createHoverCardController();
  let showTimer: number | null = null;
  let activeAnchor: HTMLAnchorElement | null = null;

  function showForAnchor(anchor: HTMLAnchorElement): void {
    const url = new URL(anchor.href, window.location.origin);
    if (url.origin !== window.location.origin) return;
    const targetPath = normalizePathname(url.pathname);
    const currentPath = normalizePathname(window.location.pathname);
    const hash = url.hash ? decodeURIComponent(url.hash.slice(1)) : '';
    if (targetPath === currentPath && !hash) return;

    const entry = index[targetPath];
    if (!entry) return;

    card.show(anchor, (el) => {
      const meta = document.createElement('div');
      meta.className = 'sl-hover-card-meta';
      const badge = document.createElement('span');
      badge.className = 'sl-hover-card-badge';
      badge.textContent = entry.section;
      const time = document.createElement('span');
      time.className = 'sl-hover-card-sub';
      time.textContent = entry.readingTime;
      meta.append(badge, time);

      const title = document.createElement('div');
      title.className = 'sl-hover-card-title';
      title.textContent = entry.title;
      el.append(meta, title);

      if (entry.description) {
        const desc = document.createElement('p');
        desc.className = 'sl-hover-card-desc';
        desc.textContent = entry.description;
        el.append(desc);
      }

      if (hash && entry.headings[hash]) {
        const footer = document.createElement('div');
        footer.className = 'sl-hover-card-footer';
        const hashSym = document.createElement('span');
        hashSym.textContent = '#';
        const hashTitle = document.createElement('span');
        hashTitle.textContent = entry.headings[hash];
        footer.append(hashSym, hashTitle);
        el.append(footer);
      }
    });
  }

  document.addEventListener('mouseover', (e) => {
    const anchor = findPreviewableLink(e.target);
    if (!anchor) return;
    if (activeAnchor === anchor) return;
    if (showTimer !== null) window.clearTimeout(showTimer);
    activeAnchor = anchor;
    showTimer = window.setTimeout(() => showForAnchor(anchor), hoverDelay);
  });

  document.addEventListener('mouseout', (e) => {
    const anchor = findPreviewableLink(e.target);
    if (!anchor) return;
    const related = e.relatedTarget;
    if (related instanceof Node && (anchor.contains(related) || card.contains(related))) return;
    if (showTimer !== null) {
      window.clearTimeout(showTimer);
      showTimer = null;
    }
    activeAnchor = null;
    card.scheduleHide(120);
  });
}
