import { animate, spring } from 'motion';

export interface SmartTocClientOptions {
  minHeadings?: number;
  wordsPerMinute?: number;
}

interface TocSection {
  id: string;
  link: HTMLAnchorElement;
  heading: HTMLElement;
  words: number;
  startY: number;
  endY: number;
  checkEl: HTMLSpanElement;
}

const RING_CIRCUMFERENCE = 31.416;

const STYLE_CSS = `
.sl-smart-toc-header {
  display: flex !important;
  align-items: baseline !important;
  justify-content: space-between !important;
  gap: 0.5rem !important;
}
.sl-smart-toc-meta {
  display: inline-flex !important;
  align-items: center !important;
  gap: 0.35rem !important;
  font-size: 0.72rem !important;
  font-weight: 450 !important;
  line-height: 1 !important;
  letter-spacing: 0.01em !important;
  color: var(--sl-color-gray-3) !important;
  font-variant-numeric: tabular-nums !important;
  white-space: nowrap !important;
  user-select: none !important;
  transition: color 180ms ease !important;
}
.sl-smart-toc-meta[data-done='true'] {
  color: var(--sl-color-accent-high, var(--sl-color-accent)) !important;
}
.sl-smart-toc-ring {
  width: 13px !important;
  height: 13px !important;
  flex-shrink: 0 !important;
  transform: rotate(-90deg) !important;
  overflow: visible !important;
}
.sl-smart-toc-ring-track {
  stroke: var(--sl-color-gray-5, rgba(128, 128, 128, 0.28)) !important;
}
.sl-smart-toc-ring-progress {
  stroke: var(--sl-color-accent-high, var(--sl-color-accent)) !important;
  stroke-linecap: round !important;
  transition: stroke-dashoffset 140ms ease-out !important;
}
.sl-smart-toc-list {
  position: relative !important;
  padding-left: 0.7rem !important;
}
.sl-smart-toc-rail {
  position: absolute !important;
  left: 0 !important;
  top: 0.25rem !important;
  bottom: 0.25rem !important;
  width: 2px !important;
  border-radius: 999px !important;
  background: var(--sl-color-gray-5, rgba(128, 128, 128, 0.22)) !important;
  overflow: hidden !important;
  pointer-events: none !important;
}
.sl-smart-toc-rail-fill {
  width: 100% !important;
  height: 100% !important;
  background: color-mix(in srgb, var(--sl-color-accent) 52%, transparent) !important;
  transform-origin: top center !important;
  transform: scaleY(0);
}
.sl-smart-toc-pill {
  position: absolute !important;
  left: -0.5px !important;
  top: 0 !important;
  width: 3px !important;
  height: 18px !important;
  border-radius: 999px !important;
  background: var(--sl-color-accent-high, var(--sl-color-accent)) !important;
  box-shadow: 0 0 8px color-mix(in srgb, var(--sl-color-accent) 45%, transparent) !important;
  pointer-events: none !important;
  will-change: transform, height !important;
}
.sl-smart-toc-link {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 0.35rem !important;
  transition: color 140ms ease, opacity 140ms ease !important;
}
.sl-smart-toc-link[data-state='read'] {
  color: var(--sl-color-gray-3) !important;
  opacity: 0.72 !important;
}
.sl-smart-toc-link[data-state='read']:hover {
  opacity: 1 !important;
}
.sl-smart-toc-link[data-state='active'] {
  color: var(--sl-color-white) !important;
  font-weight: 600 !important;
  opacity: 1 !important;
}
.sl-smart-toc-check {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex-shrink: 0 !important;
  width: 12px !important;
  height: 12px !important;
  color: var(--sl-color-accent-high, var(--sl-color-accent)) !important;
  opacity: 0 !important;
  transform: scale(0.6) !important;
  transition: opacity 150ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1) !important;
}
.sl-smart-toc-link[data-state='read'] .sl-smart-toc-check {
  opacity: 0.85 !important;
  transform: scale(1) !important;
}
`;

let styleInjected = false;
let cleanupCurrent: (() => void) | null = null;

function isReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isFrenchPage(): boolean {
  const lang = document.documentElement.lang?.toLowerCase() ?? '';
  return (
    lang.startsWith('fr') || window.location.pathname === '/fr' || window.location.pathname.startsWith('/fr/')
  );
}

function createCheckBadge(): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'sl-smart-toc-check';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML =
    '<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.3L4.9 8.7L9.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return span;
}

function createHeaderMeta(): {
  root: HTMLSpanElement;
  ringProgress: SVGCircleElement;
  labelEl: HTMLSpanElement;
} {
  const root = document.createElement('span');
  root.className = 'sl-smart-toc-meta';
  root.innerHTML =
    '<svg class="sl-smart-toc-ring" viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
    '<circle class="sl-smart-toc-ring-track" cx="7" cy="7" r="5" stroke-width="1.5" />' +
    '<circle class="sl-smart-toc-ring-progress" cx="7" cy="7" r="5" stroke-width="1.5" stroke-dasharray="' +
    RING_CIRCUMFERENCE +
    '" stroke-dashoffset="' +
    RING_CIRCUMFERENCE +
    '" />' +
    '</svg>';
  const labelEl = document.createElement('span');
  root.append(labelEl);
  const ringProgress = root.querySelector('.sl-smart-toc-ring-progress') as SVGCircleElement;
  return { root, ringProgress, labelEl };
}

function collectSections(tocNav: HTMLElement): TocSection[] {
  const links = Array.from(tocNav.querySelectorAll('a[href^="#"]')) as HTMLAnchorElement[];
  const raw: Array<{ id: string; link: HTMLAnchorElement; heading: HTMLElement }> = [];
  for (const link of links) {
    const rawId = decodeURIComponent((link.getAttribute('href') ?? '').slice(1));
    if (!rawId) continue;
    const heading =
      rawId === '_top'
        ? ((document.querySelector('main h1') ??
            document.querySelector('.sl-markdown-content')) as HTMLElement | null)
        : (document.querySelector('#' + CSS.escape(rawId)) as HTMLElement | null);
    if (heading) raw.push({ id: rawId, link, heading });
  }
  return raw.map((item) => {
    const checkEl = createCheckBadge();
    item.link.classList.add('sl-smart-toc-link');
    item.link.append(checkEl);
    return {
      id: item.id,
      link: item.link,
      heading: item.heading,
      words: 0,
      startY: 0,
      endY: 0,
      checkEl,
    };
  });
}

function measureSectionGeometry(sections: TocSection[]): void {
  const main = document.querySelector('.sl-markdown-content') ?? document.querySelector('main');
  const mainRect = main?.getBoundingClientRect();
  const docEnd = mainRect ? mainRect.bottom + window.scrollY : document.documentElement.scrollHeight;

  for (let i = 0; i < sections.length; i++) {
    const cur = sections[i];
    const next = sections[i + 1];
    const top = cur.heading.getBoundingClientRect().top + window.scrollY;
    const bottom = next ? next.heading.getBoundingClientRect().top + window.scrollY : docEnd;
    cur.startY = top;
    cur.endY = Math.max(top + 40, bottom);
  }
}

function measureSectionWords(sections: TocSection[]): void {
  for (let i = 0; i < sections.length; i++) {
    const cur = sections[i];
    const nextHeading = sections[i + 1]?.heading ?? null;
    let text = cur.heading.textContent ?? '';
    let node: Element | null = cur.heading.nextElementSibling;
    while (node && node !== nextHeading && !node.contains(nextHeading)) {
      text += ' ' + (node.textContent ?? '');
      node = node.nextElementSibling;
    }
    const count = text.trim().split(/\s+/u).filter(Boolean).length;
    cur.words = Math.max(15, count);
  }
}

function formatRemaining(minutes: number, isFr: boolean): string {
  if (minutes <= 0) return isFr ? 'Lu' : 'Read';
  return '~' + minutes + ' min';
}

function mountSmartToc(opts: SmartTocClientOptions): () => void {
  if (Object.hasOwn(document.documentElement.dataset, 'hasHero')) return () => {};
  const tocNav = document.querySelector('starlight-toc nav') as HTMLElement | null;
  const list = tocNav?.querySelector('ul') as HTMLUListElement | null;
  if (!tocNav || !list) return () => {};

  const minHeadings = opts.minHeadings ?? 3;
  const wpm = opts.wordsPerMinute ?? 210;
  const sections = collectSections(tocNav);
  if (sections.length < minHeadings) return () => {};
  if (document.documentElement.scrollHeight < window.innerHeight * 1.25) return () => {};

  measureSectionWords(sections);
  const totalWords = sections.reduce((sum, s) => sum + s.words, 0);
  const isFr = isFrenchPage();

  const headerEl = tocNav.querySelector('h2') as HTMLElement | null;
  const meta = headerEl ? createHeaderMeta() : null;
  if (headerEl && meta) {
    headerEl.classList.add('sl-smart-toc-header');
    headerEl.append(meta.root);
  }

  list.classList.add('sl-smart-toc-list');
  const rail = document.createElement('div');
  rail.className = 'sl-smart-toc-rail';
  const railFill = document.createElement('div');
  railFill.className = 'sl-smart-toc-rail-fill';
  rail.append(railFill);

  const pill = document.createElement('div');
  pill.className = 'sl-smart-toc-pill';
  list.prepend(rail, pill);

  let activeIdx = -1;
  let wasDone = false;
  let rafPending = false;
  let pillAnim: { stop?: () => void } | null = null;

  function syncRailAndPill(link: HTMLAnchorElement, immediate: boolean, atBottom: boolean): void {
    const listRect = list.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const targetY = Math.max(0, linkRect.top - listRect.top + 3);
    const targetH = Math.max(14, linkRect.height - 6);
    const railRect = rail.getBoundingClientRect();
    const railHeight = Math.max(1, railRect.height);
    const pillBottomInRail = Math.min(railHeight, Math.max(0, linkRect.bottom - railRect.top - 3));
    const fillRatio = atBottom ? 1 : Math.min(1, pillBottomInRail / railHeight);
    railFill.style.transform = 'scaleY(' + fillRatio.toFixed(4) + ')';
    pillAnim?.stop?.();
    if (immediate || isReducedMotion()) {
      pill.style.transform = 'translateY(' + Math.round(targetY) + 'px)';
      pill.style.height = Math.round(targetH) + 'px';
      return;
    }
    pillAnim = animate(
      pill,
      { y: Math.round(targetY), height: Math.round(targetH) },
      { type: spring, stiffness: 520, damping: 36, mass: 0.7 },
    );
  }
  function updateProgress(immediate = false): void {
    rafPending = false;
    measureSectionGeometry(sections);
    const viewportProbe = window.scrollY + window.innerHeight * 0.34;
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 24;
    let nextActive = 0;
    for (let i = 0; i < sections.length; i++) {
      if (viewportProbe >= sections[i].startY) nextActive = i;
    }
    if (atBottom) nextActive = sections.length - 1;
    let remainingWords = 0;
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const state = atBottom || i < nextActive ? 'read' : i === nextActive ? 'active' : 'upcoming';
      if (sec.link.dataset.state !== state) {
        sec.link.dataset.state = state;
      }
      if (state === 'active') {
        const span = Math.max(1, sec.endY - sec.startY);
        const secRatio = Math.min(1, Math.max(0, (viewportProbe - sec.startY) / span));
        remainingWords += sec.words * (1 - secRatio);
      } else if (state === 'upcoming') {
        remainingWords += sec.words;
      }
    }
    if (meta) {
      const done = atBottom;
      const ratio = done ? 1 : Math.min(1, Math.max(0, 1 - remainingWords / Math.max(1, totalWords)));
      const offset = RING_CIRCUMFERENCE * (1 - ratio);
      meta.ringProgress.style.strokeDashoffset = offset.toFixed(2);
      const minsLeft = done ? 0 : Math.max(1, Math.ceil(remainingWords / wpm));
      const label = formatRemaining(minsLeft, isFr);
      if (meta.labelEl.textContent !== label) meta.labelEl.textContent = label;
      meta.root.dataset.done = done ? 'true' : 'false';
      if (done && !wasDone && !isReducedMotion()) {
        animate(meta.root, { scale: Array.of(0.92, 1.06, 1) }, { type: spring, stiffness: 560, damping: 28 });
      }
      wasDone = done;
    }
    if (nextActive !== activeIdx || immediate || atBottom) {
      activeIdx = nextActive;
      syncRailAndPill(sections[activeIdx].link, immediate, atBottom);
    }
  }
  function onScrollOrResize(): void {
    if (rafPending) return;
    rafPending = true;
    window.requestAnimationFrame(() => updateProgress(false));
  }
  for (const sec of sections) {
    sec.link.addEventListener('click', () => {
      if (isReducedMotion()) return;
      window.setTimeout(() => {
        animate(
          sec.heading,
          { opacity: Array.of(0.65, 1), x: Array.of(4, 0) },
          { duration: 0.28, ease: 'easeOut' },
        );
      }, 180);
    });
  }
  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });
  updateProgress(true);
  return () => {
    window.removeEventListener('scroll', onScrollOrResize);
    window.removeEventListener('resize', onScrollOrResize);
    pillAnim?.stop?.();
    meta?.root.remove();
    rail.remove();
    pill.remove();
    list.classList.remove('sl-smart-toc-list');
    headerEl?.classList.remove('sl-smart-toc-header');
    for (const sec of sections) {
      sec.checkEl.remove();
      sec.link.classList.remove('sl-smart-toc-link');
      delete sec.link.dataset.state;
    }
  };
}
export function initSmartTocProgress(opts: SmartTocClientOptions = {}): void {
  if (typeof window === 'undefined') return;
  if (!styleInjected && !document.querySelector('#sl-smart-toc-style')) {
    styleInjected = true;
    const style = document.createElement('style');
    style.id = 'sl-smart-toc-style';
    style.textContent = STYLE_CSS;
    document.head.append(style);
  }
  const run = () => {
    cleanupCurrent?.();
    cleanupCurrent = mountSmartToc(opts);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
  document.addEventListener('astro:page-load', run);
}
