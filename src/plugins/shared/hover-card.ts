import { animate, spring } from 'motion';

export const SHARED_HOVER_CARD_CSS = [
  '.sl-hover-card { position: fixed !important; inset: auto !important; margin: 0 !important; z-index: 2147483647 !important; width: min(350px, calc(100vw - 24px)) !important; padding: 0.85rem 0.95rem !important; border-radius: 12px !important; background: var(--sl-color-bg, #ffffff) !important; border: 1px solid var(--sl-color-gray-5, rgba(128, 128, 128, 0.32)) !important; box-shadow: 0 16px 38px -8px rgba(0, 0, 0, 0.24), 0 4px 12px -2px rgba(0, 0, 0, 0.12) !important; color: var(--sl-color-text, #18181b) !important; font-family: var(--sl-font, system-ui, sans-serif) !important; pointer-events: auto !important; box-sizing: border-box !important; text-align: left !important; will-change: transform, opacity !important; }',
  ":root[data-theme='dark'] .sl-hover-card { background: var(--sl-color-bg-nav, #18191e) !important; border-color: var(--sl-color-gray-5, rgba(255, 255, 255, 0.16)) !important; box-shadow: 0 18px 44px -8px rgba(0, 0, 0, 0.65), 0 4px 14px -2px rgba(0, 0, 0, 0.4) !important; }",
  '.sl-hover-card-meta { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 0.5rem !important; margin-bottom: 0.42rem !important; font-size: 0.72rem !important; line-height: 1.2 !important; }',
  '.sl-hover-card-badge { display: inline-flex !important; align-items: center !important; padding: 0.16rem 0.5rem !important; border-radius: 999px !important; font-weight: 600 !important; color: var(--sl-color-accent-high) !important; background: var(--sl-color-accent-low) !important; border: 1px solid color-mix(in srgb, var(--sl-color-accent) 28%, transparent) !important; }',
  '.sl-hover-card-sub { color: var(--sl-color-gray-3) !important; font-variant-numeric: tabular-nums !important; }',
  '.sl-hover-card-title { font-size: 0.92rem !important; font-weight: 650 !important; line-height: 1.35 !important; color: var(--sl-color-white) !important; margin: 0 0 0.32rem 0 !important; }',
  '.sl-hover-card-desc { font-size: 0.8rem !important; line-height: 1.45 !important; color: var(--sl-color-gray-2) !important; margin: 0 !important; display: -webkit-box !important; -webkit-line-clamp: 3 !important; -webkit-box-orient: vertical !important; overflow: hidden !important; }',
  '.sl-hover-card-footer { margin-top: 0.52rem !important; padding-top: 0.44rem !important; border-top: 1px solid var(--sl-color-hairline, rgba(128, 128, 128, 0.2)) !important; display: flex !important; align-items: center !important; gap: 0.35rem !important; font-size: 0.76rem !important; font-weight: 550 !important; color: var(--sl-color-accent-high) !important; text-decoration: none !important; }',
  'a.sl-hover-card-footer:hover { text-decoration: underline !important; }',
  '@media (hover: none) { .sl-hover-card { display: none !important; } }',
].join('\n');

export function isReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function injectSharedHoverCardStyles(): void {
  if (typeof document === 'undefined' || document.querySelector('#sl-shared-hover-card-style')) return;
  const style = document.createElement('style');
  style.id = 'sl-shared-hover-card-style';
  style.textContent = SHARED_HOVER_CARD_CSS;
  document.head.append(style);
}

export interface HoverCardController {
  show: (trigger: HTMLElement, render: (card: HTMLDivElement) => void) => void;
  scheduleHide: (delayMs?: number) => void;
  hideNow: (immediate?: boolean) => void;
  contains: (node: Node | null) => boolean;
}

export function createHoverCardController(): HoverCardController {
  injectSharedHoverCardStyles();
  let card: HTMLDivElement | null = null;
  let hideTimer: number | null = null;
  let isVisible = false;
  let lastCoords: { top: number; left: number } | null = null;
  let currentAnim: { stop?: () => void } | null = null;

  function ensureCard(): HTMLDivElement {
    if (!card) {
      card = document.createElement('div');
      card.className = 'sl-hover-card';
      card.setAttribute('role', 'tooltip');
      card.setAttribute('popover', 'manual');
      card.addEventListener('mouseenter', () => {
        if (hideTimer !== null) {
          window.clearTimeout(hideTimer);
          hideTimer = null;
        }
      });
      card.addEventListener('mouseleave', () => scheduleHide(120));
      document.body.append(card);
    }
    return card;
  }

  function closeDom(el: HTMLDivElement): void {
    isVisible = false;
    lastCoords = null;
    try {
      el.hidePopover();
    } catch {}
    el.style.display = 'none';
  }

  function hideNow(immediate = false): void {
    if (hideTimer !== null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (!card || !isVisible) return;
    const el = card;
    currentAnim?.stop?.();
    if (immediate || isReducedMotion()) {
      closeDom(el);
      return;
    }
    isVisible = false;
    currentAnim = animate(el, { opacity: 0, y: 3, scale: 0.985 }, { duration: 0.11, ease: 'easeOut' });
    window.setTimeout(() => {
      if (!isVisible && card) closeDom(card);
    }, 115);
  }

  function scheduleHide(delayMs = 120): void {
    if (hideTimer !== null) window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => hideNow(false), delayMs);
  }

  function show(trigger: HTMLElement, render: (el: HTMLDivElement) => void): void {
    if (hideTimer !== null) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    const el = ensureCard();
    const wasVisible = isVisible;
    el.replaceChildren();
    render(el);
    el.style.display = 'block';
    try {
      el.showPopover();
    } catch {}

    const rect = trigger.getBoundingClientRect();
    const cardRect = el.getBoundingClientRect();
    const margin = 10;
    const placeAbove =
      window.innerHeight - rect.bottom < cardRect.height + 16 && rect.top > cardRect.height + 16;
    const top = Math.round(
      placeAbove
        ? Math.max(margin, rect.top - cardRect.height - 8)
        : Math.min(window.innerHeight - cardRect.height - margin, rect.bottom + 8),
    );
    const left = Math.round(
      Math.min(window.innerWidth - cardRect.width - margin, Math.max(margin, rect.left)),
    );

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

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideNow(false);
  });
  window.addEventListener('scroll', () => hideNow(true), { passive: true });
  document.addEventListener('astro:before-preparation', () => hideNow(true));

  return {
    show,
    scheduleHide,
    hideNow,
    contains: (node) => Boolean(node && card?.contains(node)),
  };
}
