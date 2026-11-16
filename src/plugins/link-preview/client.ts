import './styles.css';

interface LinkPreviewEntry {
  title: string;
  description: string;
  section: string;
  readingTime: string;
  headings: Record<string, string>;
}

let cachePromise: Promise<Record<string, LinkPreviewEntry>> | null = null;
let initialized = false;

function loadPreviews(): Promise<Record<string, LinkPreviewEntry>> {
  if (!cachePromise) {
    cachePromise = fetch('/_link-previews.json')
      .then((res) => (res.ok ? res.json() : {}))
      .catch(() => ({}));
  }
  return cachePromise;
}

function normalizePathname(pathname: string): string {
  let p = pathname.replace(/[#?].*$/, '');
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1 && !p.endsWith('/')) p += '/';
  return p;
}

export function initLinkPreview(opts: { hoverDelay?: number } = {}): void {
  if (typeof window === 'undefined' || initialized) return;
  initialized = true;
  const hoverDelay = opts.hoverDelay ?? 180;

  let card: HTMLDivElement | null = null;
  let showTimer: number | null = null;
  let hideTimer: number | null = null;
  let activeAnchor: HTMLAnchorElement | null = null;

  function ensureCard(): HTMLDivElement {
    if (!card) {
      card = document.createElement('div');
      card.className = 'sl-link-preview-card';
      card.setAttribute('role', 'tooltip');
      card.hidden = true;
      card.addEventListener('mouseenter', () => {
        if (hideTimer !== null) { window.clearTimeout(hideTimer); hideTimer = null; }
      });
      card.addEventListener('mouseleave', () => scheduleHide());
      document.body.appendChild(card);
    }
    return card;
  }

  function hideNow(): void {
    if (showTimer !== null) { window.clearTimeout(showTimer); showTimer = null; }
    if (hideTimer !== null) { window.clearTimeout(hideTimer); hideTimer = null; }
    activeAnchor = null;
    if (card) { card.removeAttribute('data-visible'); card.hidden = true; }
  }

  function scheduleHide(): void {
    if (showTimer !== null) { window.clearTimeout(showTimer); showTimer = null; }
    hideTimer = window.setTimeout(hideNow, 110);
  }

  function positionCard(anchor: HTMLAnchorElement, el: HTMLDivElement): void {
    const rect = anchor.getBoundingClientRect();
    const cardRect = el.getBoundingClientRect();
    const margin = 10;
    const placeAbove = (window.innerHeight - rect.bottom) < cardRect.height + 16 && rect.top > cardRect.height + 16;
    const top = placeAbove
      ? Math.max(margin, rect.top - cardRect.height - 8)
      : Math.min(window.innerHeight - cardRect.height - margin, rect.bottom + 8);
    const left = Math.min(window.innerWidth - cardRect.width - margin, Math.max(margin, rect.left));
    el.style.top = `${Math.round(top)}px`;
    el.style.left = `${Math.round(left)}px`;
  }

  async function showForAnchor(anchor: HTMLAnchorElement): Promise<void> {
    const url = new URL(anchor.href, window.location.origin);
    if (url.origin !== window.location.origin) return;
    const targetPath = normalizePathname(url.pathname);
    const currentPath = normalizePathname(window.location.pathname);
    const hash = url.hash ? decodeURIComponent(url.hash.slice(1)) : '';
    if (targetPath === currentPath && !hash) return;

    const index = await loadPreviews();
    if (activeAnchor !== anchor) return;
    const entry = index[targetPath];
    if (!entry) return;

    const el = ensureCard();
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
      el.appendChild(desc);
    }

    if (hash && entry.headings[hash]) {
      const anchorRow = document.createElement('div');
      anchorRow.className = 'sl-link-preview-anchor';
      const hashSym = document.createElement('span');
      hashSym.className = 'sl-link-preview-anchor-hash';
      hashSym.textContent = '#';
      const hashTitle = document.createElement('span');
      hashTitle.textContent = entry.headings[hash];
      anchorRow.append(hashSym, hashTitle);
      el.appendChild(anchorRow);
    }

    el.hidden = false;
    positionCard(anchor, el);
    requestAnimationFrame(() => {
      if (activeAnchor === anchor && card) card.setAttribute('data-visible', 'true');
    });
  }

  function findPreviewableLink(target: EventTarget | null): HTMLAnchorElement | null {
    if (!(target instanceof Element)) return null;
    const anchor = target.closest('.sl-markdown-content a[href]') as HTMLAnchorElement | null;
    if (!anchor) return null;
    const href = anchor.getAttribute('href') ?? '';
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || anchor.hasAttribute('download')) return null;
    return anchor;
  }

  document.addEventListener('mouseover', (e) => {
    const anchor = findPreviewableLink(e.target);
    if (!anchor) return;
    if (hideTimer !== null) { window.clearTimeout(hideTimer); hideTimer = null; }
    if (activeAnchor === anchor) return;
    if (showTimer !== null) window.clearTimeout(showTimer);
    activeAnchor = anchor;
    showTimer = window.setTimeout(() => { void showForAnchor(anchor); }, hoverDelay);
  });

  document.addEventListener('mouseout', (e) => {
    const anchor = findPreviewableLink(e.target);
    if (!anchor) return;
    const related = e.relatedTarget;
    if (related instanceof Node && (anchor.contains(related) || card?.contains(related))) return;
    scheduleHide();
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideNow(); });
  window.addEventListener('scroll', hideNow, { passive: true });
  document.addEventListener('astro:before-preparation', hideNow);
}
