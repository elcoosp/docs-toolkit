import { animate, spring } from 'motion';
import { LINK_PREVIEWS } from 'virtual:starlight-link-preview';

interface LinkPreviewEntry {
  title: string;
  description: string;
  section: string;
  readingTime: string;
  headings: Record<string, string>;
}

const STYLE_CSS = `
.sl-link-preview-card {
  position: fixed !important;
  inset: auto !important;
  margin: 0 !important;
  z-index: 2147483647 !important;
  width: min(350px, calc(100vw - 24px)) !important;
  padding: 0.85rem 0.95rem !important;
  border-radius: 12px !important;
  background: var(--sl-color-bg, #ffffff) !important;
  border: 1px solid var(--sl-color-gray-5, rgba(128, 128, 128, 0.32)) !important;
  box-shadow: 0 16px 38px -8px rgba(0, 0, 0, 0.24), 0 4px 12px -2px rgba(0, 0, 0, 0.12) !important;
  color: var(--sl-color-text, #18181b) !important;
  font-family: var(--sl-font, system-ui, sans-serif) !important;
  pointer-events: auto !important;
  box-sizing: border-box !important;
  text-align: left !important;
  will-change: transform, opacity !important;
}
:root[data-theme='dark'] .sl-link-preview-card {
  background: var(--sl-color-bg-nav, #18191e) !important;
  border-color: var(--sl-color-gray-5, rgba(255, 255, 255, 0.16)) !important;
  box-shadow: 0 18px 44px -8px rgba(0, 0, 0, 0.65), 0 4px 14px -2px rgba(0, 0, 0, 0.4) !important;
}
.sl-link-preview-meta {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 0.5rem !important;
  margin-bottom: 0.42rem !important;
  font-size: 0.72rem !important;
  line-height: 1.2 !important;
}
.sl-link-preview-badge {
  display: inline-flex !important;
  align-items: center !important;
  padding: 0.16rem 0.5rem !important;
  border-radius: 999px !important;
  font-weight: 600 !important;
  color: var(--sl-color-accent-high) !important;
  background: var(--sl-color-accent-low) !important;
  border: 1px solid color-mix(in srgb, var(--sl-color-accent) 28%, transparent) !important;
}
.sl-link-preview-time {
  color: var(--sl-color-gray-3) !important;
  font-variant-numeric: tabular-nums !important;
}
.sl-link-preview-title {
  font-size: 0.92rem !important;
  font-weight: 650 !important;
  line-height: 1.35 !important;
  color: var(--sl-color-white) !important;
  margin: 0 0 0.32rem 0 !important;
}
.sl-link-preview-desc {
  font-size: 0.8rem !important;
  line-height: 1.45 !important;
  color: var(--sl-color-gray-2) !important;
  margin: 0 !important;
  display: -webkit-box !important;
  -webkit-line-clamp: 2 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}
.sl-link-preview-anchor {
  margin-top: 0.52rem !important;
  padding-top: 0.44rem !important;
  border-top: 1px solid var(--sl-color-hairline, rgba(128, 128, 128, 0.2)) !important;
  display: flex !important;
  align-items: center !important;
  gap: 0.35rem !important;
  font-size: 0.76rem !important;
  font-weight: 550 !important;
  color: var(--sl-color-accent-high) !important;
}
@media (hover: none) {
  .sl-link-preview-card { display: none !important; }
}
`;

let initialized = false;

function normalizePathname(pathname: string): string {
  let p = pathname.replace(/[#?].*$/, '');
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1 && !p.endsWith('/')) p += '/';
  return p;
}

function isReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function computeCardPosition(
  anchor: HTMLAnchorElement,
  el: HTMLDivElement,
): { top: number; left: number; placeAbove: boolean } {
  const rect = anchor.getBoundingClientRect();
  const cardRect = el.getBoundingClientRect();
  const margin = 10;
  const placeAbove =
    window.innerHeight - rect.bottom < cardRect.height + 16 && rect.top > cardRect.height + 16;
  const top = placeAbove
    ? Math.max(margin, rect.top - cardRect.height - 8)
    : Math.min(window.innerHeight - cardRect.height - margin, rect.bottom + 8);
  const left = Math.min(window.innerWidth - cardRect.width - margin, Math.max(margin, rect.left));
  return { top: Math.round(top), left: Math.round(left), placeAbove };
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

  if (!document.querySelector('#sl-link-preview-style')) {
    const style = document.createElement('style');
    style.id = 'sl-link-preview-style';
    style.textContent = STYLE_CSS;
    document.head.append(style);
  }

  const hoverDelay = opts.hoverDelay ?? 180;
  const index = (LINK_PREVIEWS ?? {}) as Record<string, LinkPreviewEntry>;

  let card: HTMLDivElement | null = null;
  let showTimer: number | null = null;
  let hideTimer: number | null = null;
  let activeAnchor: HTMLAnchorElement | null = null;
  let isVisible = false;
  let lastCoords: { top: number; left: number } | null = null;
  let currentAnim: { stop?: () => void } | null = null;

  function ensureCard(): HTMLDivElement {
    if (!card) {
      card = document.createElement('div');
      card.className = 'sl-link-preview-card';
      card.setAttribute('role', 'tooltip');
      card.setAttribute('popover', 'manual');
      card.addEventListener('mouseenter', () => {
        if (hideTimer !== null) {
          window.clearTimeout(hideTimer);
          hideTimer = null;
        }
      });
      card.addEventListener('mouseleave', () => scheduleHide());
      document.body.append(card);
    }
    return card;
  }

  function closeCardDom(el: HTMLDivElement): void {
    isVisible = false;
    lastCoords = null;
    try {
      el.hidePopover();
    } catch {}
    el.style.display = 'none';
  }

  function hideNow(immediate = false): void {
    if (showTimer !== null) {
      window.clearTimeout(showTimer);
      showTimer = null;
    }
    if (hideTimer !== null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    activeAnchor = null;
    if (!card || !isVisible) return;
    const el = card;
    currentAnim?.stop?.();
    if (immediate || isReducedMotion()) {
      closeCardDom(el);
      return;
    }
    isVisible = false;
    currentAnim = animate(el, { opacity: 0, y: 3, scale: 0.985 }, { duration: 0.11, ease: 'easeOut' });
    window.setTimeout(() => {
      if (!activeAnchor && card) closeCardDom(card);
    }, 115);
  }

  function scheduleHide(): void {
    if (showTimer !== null) {
      window.clearTimeout(showTimer);
      showTimer = null;
    }
    hideTimer = window.setTimeout(() => hideNow(false), 120);
  }

  function showForAnchor(anchor: HTMLAnchorElement): void {
    const url = new URL(anchor.href, window.location.origin);
    if (url.origin !== window.location.origin) return;
    const targetPath = normalizePathname(url.pathname);
    const currentPath = normalizePathname(window.location.pathname);
    const hash = url.hash ? decodeURIComponent(url.hash.slice(1)) : '';
    if (targetPath === currentPath && !hash) return;

    const entry = index[targetPath];
    if (!entry) return;

    const el = ensureCard();
    const wasVisible = isVisible;
    el.replaceChildren();

    const meta = document.createElement('div');
    meta.className = 'sl-link-preview-meta';
    const badge = document.createElement('span');
    badge.className = 'sl-link-preview-badge';
    badge.textContent = entry.section;
    const time = document.createElement('span');
    time.className = 'sl-link-preview-time';
    time.textContent = entry.readingTime;
    meta.append(badge, time);

    const title = document.createElement('div');
    title.className = 'sl-link-preview-title';
    title.textContent = entry.title;
    el.append(meta, title);

    if (entry.description) {
      const desc = document.createElement('p');
      desc.className = 'sl-link-preview-desc';
      desc.textContent = entry.description;
      el.append(desc);
    }

    if (hash && entry.headings[hash]) {
      const anchorRow = document.createElement('div');
      anchorRow.className = 'sl-link-preview-anchor';
      const hashSym = document.createElement('span');
      hashSym.textContent = '#';
      const hashTitle = document.createElement('span');
      hashTitle.textContent = entry.headings[hash];
      anchorRow.append(hashSym, hashTitle);
      el.append(anchorRow);
    }
    el.style.display = 'block';
    try {
      el.showPopover();
    } catch {}
    const { top, left, placeAbove } = computeCardPosition(anchor, el);
    el.style.setProperty('top', top + 'px', 'important');
    el.style.setProperty('left', left + 'px', 'important');
    isVisible = true;
    currentAnim?.stop?.();
    if (isReducedMotion()) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    } else if (wasVisible && lastCoords) {
      const dx = lastCoords.left - left;
      const dy = lastCoords.top - top;
      currentAnim = animate(
        el,
        { opacity: [0.85, 1], x: [dx, 0], y: [dy, 0], scale: [0.99, 1] },
        { type: spring, stiffness: 560, damping: 36, mass: 0.65 },
      );
    } else {
      currentAnim = animate(
        el,
        { opacity: Array.of(0, 1), x: Array.of(0, 0), y: [placeAbove ? -6 : 6, 0], scale: [0.965, 1] },
        { type: spring, stiffness: 520, damping: 32, mass: 0.7 },
      );
    }
    lastCoords = { top, left };
  }
  document.addEventListener('mouseover', (e) => {
    const anchor = findPreviewableLink(e.target);
    if (!anchor) return;
    if (hideTimer !== null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (activeAnchor === anchor) return;
    if (showTimer !== null) window.clearTimeout(showTimer);
    activeAnchor = anchor;
    showTimer = window.setTimeout(() => {
      showForAnchor(anchor);
    }, hoverDelay);
  });
  document.addEventListener('mouseout', (e) => {
    const anchor = findPreviewableLink(e.target);
    if (!anchor) return;
    const related = e.relatedTarget;
    if (related instanceof Node && (anchor.contains(related) || card?.contains(related))) return;
    scheduleHide();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideNow(false);
  });
  window.addEventListener('scroll', () => hideNow(true), { passive: true });
  document.addEventListener('astro:before-preparation', () => hideNow(true));
}
