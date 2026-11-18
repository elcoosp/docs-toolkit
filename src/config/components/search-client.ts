import { animate, spring } from 'motion';

interface SubResult {
  title: string;
  url: string;
  excerpt: string;
}

interface PagefindData {
  url: string;
  excerpt: string;
  meta?: { title?: string };
  sub_results?: SubResult[];
}

interface RecentPage {
  title: string;
  url: string;
  section: string;
}

interface SitePageEntry {
  title: string;
  url: string;
  headings?: Array<{ title: string; slug: string }>;
}

interface FlatItem {
  type: 'page' | 'sub' | 'action' | 'recent' | 'recent-page' | 'pinned' | 'nav';
  title: string;
  subtitle?: string;
  section?: string;
  sectionKey?: string;
  breadcrumb?: string;
  excerptHtml?: string;
  subResults?: SubResult[];
  url?: string;
  query?: string;
  actionId?: string;
}

const RECENT_KEY = 'sl-cmdk-recent-v1';
const RECENT_PAGES_KEY = 'sl-cmdk-recent-pages-v1';
const PINNED_PAGES_KEY = 'sl-cmdk-pinned-pages-v1';
const SVG_NS = ['http:', '', 'www.w3.org', '2000', 'svg'].join('/');

function lucideIcon(paths: Array<[string, Record<string, string>]>, size = 15): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.width = size + 'px';
  svg.style.height = size + 'px';
  svg.style.display = 'block';
  svg.style.flexShrink = '0';
  for (const [tag, attrs] of paths) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    svg.appendChild(node);
  }
  return svg;
}

function iconHistory(): SVGSVGElement {
  return lucideIcon([
    ['path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }],
    ['path', { d: 'M3 3v5h5' }],
    ['path', { d: 'M12 7v5l4 2' }],
  ]);
}

function iconZap(): SVGSVGElement {
  return lucideIcon([
    ['path', { d: 'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z' }],
  ]);
}

function iconBookOpen(): SVGSVGElement {
  return lucideIcon([
    ['path', { d: 'M12 7v14' }],
    ['path', { d: 'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z' }],
  ]);
}

function iconBraces(): SVGSVGElement {
  return lucideIcon([
    ['path', { d: 'M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1' }],
    ['path', { d: 'M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1' }],
  ]);
}

function iconNewspaper(): SVGSVGElement {
  return lucideIcon([
    ['path', { d: 'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2' }],
    ['path', { d: 'M18 14h-8' }],
    ['path', { d: 'M15 18h-5' }],
    ['path', { d: 'M10 6h8v4h-8V6Z' }],
  ]);
}

function iconFileText(): SVGSVGElement {
  return lucideIcon([
    ['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }],
    ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }],
    ['path', { d: 'M10 9H8' }],
    ['path', { d: 'M16 13H8' }],
    ['path', { d: 'M16 17H8' }],
  ]);
}

function iconHash(): SVGSVGElement {
  return lucideIcon(
    [
      ['line', { x1: '4', x2: '20', y1: '9', y2: '9' }],
      ['line', { x1: '4', x2: '20', y1: '15', y2: '15' }],
      ['line', { x1: '10', x2: '8', y1: '3', y2: '21' }],
      ['line', { x1: '16', x2: '14', y1: '3', y2: '21' }],
    ],
    14,
  );
}

function iconArrowUpRight(): SVGSVGElement {
  return lucideIcon(
    [
      ['path', { d: 'M7 17 17 7' }],
      ['path', { d: 'M7 7h10v10' }],
    ],
    14,
  );
}

function iconBookmark(filled = false): SVGSVGElement {
  const svg = lucideIcon(
    [
      [
        "path",
        {
          d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z",
        },
      ],
    ],
    14,
  );
  if (filled) svg.setAttribute("fill", "currentColor");
  return svg;
}

function getPinnedPages(): RecentPage[] {
  try {
    const raw = localStorage.getItem(PINNED_PAGES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is RecentPage => Boolean(x && typeof x.url === "string" && typeof x.title === "string")).slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

function isPagePinned(url?: string): boolean {
  if (!url) return false;
  return getPinnedPages().some((p) => p.url === url);
}

function togglePinnedPage(page: RecentPage): boolean {
  const existing = getPinnedPages();
  const exists = existing.some((p) => p.url === page.url);
  const next = exists ? existing.filter((p) => p.url !== page.url) : [page, ...existing].slice(0, 8);
  try {
    localStorage.setItem(PINNED_PAGES_KEY, JSON.stringify(next));
  } catch {}
  return !exists;
}

function iconCopy(): SVGSVGElement {
  return lucideIcon(
    [
      ['rect', { width: '14', height: '14', x: '8', y: '8', rx: '2', ry: '2' }],
      ['path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }],
    ],
    13,
  );
}

function sectionIcon(key?: string): SVGSVGElement {
  if (key === 'guides') return iconBookOpen();
  if (key === 'reference') return iconBraces();
  if (key === 'blog') return iconNewspaper();
  if (key === 'changelog') return iconHistory();
  return iconFileText();
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function decodeEntities(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function appendHighlightedText(target: HTMLElement, text: string, rawQuery: string): void {
  const cleanQ = rawQuery.replace(/^(?:docs|guides?|ref|reference|blog|logs?):\s*/i, "").replace(/^[\/#>]+/, "").trim();
  if (!cleanQ) {
    target.textContent = text;
    return;
  }
  const tokens = Array.from(
    new Set(
      cleanQ
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  );
  if (tokens.length === 0) {
    target.textContent = text;
    return;
  }
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\function appendHighlightedExcerpt(")).join("|");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  for (const part of parts) {
    if (!part) continue;
    if (tokens.some((t) => part.toLowerCase() === t.toLowerCase())) {
      const mark = document.createElement("mark");
      mark.textContent = part;
      target.appendChild(mark);
    } else {
      target.appendChild(document.createTextNode(part));
    }
  }
}

function appendHighlightedExcerpt(target: HTMLElement, rawExcerpt: string): void {
  const parts = rawExcerpt.split(/(<mark>[\s\S]*?<\/mark>)/gi);
  for (const part of parts) {
    if (!part) continue;
    const m = /^<mark>([\s\S]*?)<\/mark>$/i.exec(part);
    if (m) {
      const mark = document.createElement('mark');
      mark.textContent = m[1].replace(/<[^>]*>/g, '');
      target.appendChild(mark);
    } else {
      const plain = decodeEntities(part.replace(/<[^>]*>/g, ''));
      if (plain) target.appendChild(document.createTextNode(plain));
    }
  }
}

function getRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, 4) : [];
  } catch {
    return [];
  }
}

function pushRecent(q: string): void {
  const trimmed = q.trim();
  if (trimmed.length < 2) return;
  try {
    const next = [trimmed, ...getRecent().filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 4);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

function getRecentPages(): RecentPage[] {
  try {
    const raw = localStorage.getItem(RECENT_PAGES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is RecentPage => Boolean(x && typeof x.url === 'string' && typeof x.title === 'string')).slice(0, 4)
      : [];
  } catch {
    return [];
  }
}

function pushRecentPage(page: RecentPage): void {
  if (!page.url || page.url === '#') return;
  try {
    const next = [page, ...getRecentPages().filter((p) => p.url !== page.url)].slice(0, 4);
    localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(next));
  } catch {}
}

function classifySection(url: string, isFr: boolean): { key: string; label: string } {
  const clean = url.replace(/^\/fr(?=\/|$)/, '') || '/';
  if (clean.startsWith('/guides')) return { key: 'guides', label: 'Guides' };
  if (clean.startsWith('/reference')) return { key: 'reference', label: isFr ? 'Référence' : 'Reference' };
  if (clean.startsWith('/blog')) return { key: 'blog', label: 'Blog' };
  if (clean.startsWith('/changelog')) return { key: 'changelog', label: 'Changelog' };
  return { key: 'docs', label: isFr ? 'Documentation' : 'Docs' };
}

function formatBreadcrumb(url: string, isFr: boolean): string {
  const clean = url.split('#')[0].replace(/^\/fr(?=\/|$)/, '').replace(/^\/|\/$/g, '');
  if (!clean) return isFr ? 'Accueil' : 'Home';
  const segs = clean.split('/').map((seg) =>
    seg
      .split('-')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' '),
  );
  return segs.join(' › ');
}

export function initCommandSearch(): void {
  const root = document.querySelector<HTMLElement>('[data-cmdk-root]');
  if (!root || root.dataset.bound === 'true') return;
  root.dataset.bound = 'true';

  const isFr = root.dataset.locale === 'fr';
  const dialog = root.querySelector<HTMLDialogElement>('#sl-cmdk-dialog');
  const panel = root.querySelector<HTMLElement>('.sl-cmdk-panel');
  const input = root.querySelector<HTMLInputElement>('#sl-cmdk-input');
  const clearBtn = root.querySelector<HTMLButtonElement>('#sl-cmdk-clear');
  const tabsEl = root.querySelector<HTMLElement>('#sl-cmdk-tabs');
  const listEl = root.querySelector<HTMLElement>('#sl-cmdk-list');
  const previewEl = root.querySelector<HTMLElement>('#sl-cmdk-preview');
  
  const statusEl = root.querySelector<HTMLElement>('#sl-cmdk-status');

  if (!dialog || !panel || !input || !tabsEl || !listEl) return;

  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
  root.querySelectorAll<HTMLElement>('[data-cmdk-shortcut]').forEach((node) => {
    node.textContent = isMac ? '⌘K' : 'Ctrl K';
  });
  root.querySelectorAll<HTMLElement>("[data-cmdk-copy-kbd]").forEach((node) => {
    node.textContent = isMac ? "⌘C" : "Ctrl C";
  });
  root.querySelectorAll<HTMLElement>("[data-cmdk-pin-kbd]").forEach((node) => {
    node.textContent = isMac ? "⌘D" : "Ctrl D";
  });
  root.querySelectorAll<HTMLElement>("[data-cmdk-newtab-kbd]").forEach((node) => {
    node.textContent = isMac ? "⌘↵" : "Ctrl ↵";
  });

  let pagefind: any = null;
  let pagefindFailed = false;
  let activeFilter = 'all';
  let activeIndex = 0;
  let currentResults: PagefindData[] = [];
  let renderedItems: FlatItem[] = [];
  let searchSeq = 0;
  const queryCache = new Map<string, PagefindData[]>();
  const pageMetaCache = new Map<string, { excerpt: string; subs: SubResult[] }>();
  const pendingMetaUrls = new Set<string>();
  let previewCopyBtn: HTMLButtonElement | null = null;
  let lastPreviewKey = '';
  let copyToastTimer: number | undefined;
  let searchListAnimTimer: number | undefined;
  let lastAnimatedSearchSig = '';
  const indicatorEl = el('div', 'sl-cmdk-indicator');
  indicatorEl.setAttribute('aria-hidden', 'true');

  function syncSelectionIndicator(instant = false): void {
    const selected = listEl.querySelector<HTMLElement>('[data-cmdk-idx][aria-selected="true"]');
    if (!selected) {
      indicatorEl.style.opacity = '0';
      return;
    }
    if (!indicatorEl.parentElement) {
      listEl.prepend(indicatorEl);
    }
    const listRect = listEl.getBoundingClientRect();
    const rowRect = selected.getBoundingClientRect();
    const top = rowRect.top - listRect.top + listEl.scrollTop;
    const height = rowRect.height;
    if (instant) {
      indicatorEl.style.transition = 'none';
    }
    indicatorEl.style.opacity = '1';
    indicatorEl.style.height = height + 'px';
    indicatorEl.style.transform = `translate3d(0, ${top}px, 0)`;
    if (instant) {
      void indicatorEl.offsetHeight;
      indicatorEl.style.transition = '';
    }
  }

  async function ensurePagefind(): Promise<any> {
    if (pagefind) return pagefind;
    if (pagefindFailed) return null;
    try {
      const pfUrl = "/pagefind/pagefind.js";
      const mod = await import(/* @vite-ignore */ pfUrl);
      if (typeof mod.options === "function") {
        await mod.options({ excerptLength: 18 });
      }
      if (typeof mod.init === "function") {
        await mod.init();
      }
      pagefind = mod;
      return pagefind;
    } catch {
      pagefindFailed = true;
      return null;
    }
  }

  function animateListCards(): void {}

  function getSitePagesRaw(): SitePageEntry[] {
    const jsonEl = root?.querySelector<HTMLScriptElement>("script[data-cmdk-pages]");
    if (jsonEl?.textContent) {
      try {
        const parsed = JSON.parse(jsonEl.textContent) as SitePageEntry[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [];
  }

  function collectSidebarPages(): FlatItem[] {
    const jsonEl = root?.querySelector<HTMLScriptElement>("script[data-cmdk-pages]");
    if (jsonEl?.textContent) {
      try {
        const parsed = JSON.parse(jsonEl.textContent) as Array<{ title: string; url: string }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p) => {
            const sec = classifySection(p.url, isFr);
            return {
              type: "nav" as const,
              title: p.title,
              url: p.url,
              section: sec.label,
              sectionKey: sec.key,
              breadcrumb: formatBreadcrumb(p.url, isFr),
            };
          });
        }
      } catch {}
    }

    const seen = new Set<string>();
    const out: FlatItem[] = [];
    document.querySelectorAll<HTMLAnchorElement>("nav.sidebar a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      const title = a.textContent?.replace(/\s+/g, " ").trim() || "";
      if (!href || !title || href.startsWith("#") || seen.has(href)) return;
      seen.add(href);
      const sec = classifySection(href, isFr);
      out.push({
        type: "nav",
        title,
        url: href,
        section: sec.label,
        sectionKey: sec.key,
        breadcrumb: formatBreadcrumb(href, isFr),
      });
    });
    for (const entry of getSitePagesRaw()) {
      if (!entry.url || seen.has(entry.url)) continue;
      if (!entry.url.includes("/changelog")) continue;
      const entryIsFr = entry.url === "/fr/" || entry.url.startsWith("/fr/");
      if (isFr ? !entryIsFr : entryIsFr) continue;
      seen.add(entry.url);
      const sec = classifySection(entry.url, isFr);
      out.push({
        type: "nav",
        title: entry.title,
        url: entry.url,
        section: sec.label,
        sectionKey: sec.key,
        breadcrumb: formatBreadcrumb(entry.url, isFr),
      });
    }
    return out;
  }

  function getQuickActions(): FlatItem[] {
return [
{
type: 'action',
actionId: 'zen',
title: isFr ? 'Basculer le mode Zen' : 'Toggle Zen Mode',
subtitle: 'Alt+Z',
section: 'Action',
excerptHtml: isFr
? 'Masque les barres latérales et l’en-tête pour une lecture sans distraction.'
: 'Hide sidebars and header chrome for distraction-free reading.',
},
{
type: 'action',
actionId: 'theme',
title: isFr ? 'Changer de thème (Clair / Sombre)' : 'Switch Color Theme (Light / Dark)',
subtitle: isFr ? 'Apparence' : 'Appearance',
section: 'Action',
excerptHtml: isFr
? 'Bascule instantanément entre le thème clair et le thème sombre.'
: 'Toggle immediately between light and dark color schemes.',
},
{
type: 'action',
actionId: 'copy-md',
title: isFr ? 'Copier la page en Markdown' : 'Copy Current Page as Markdown',
subtitle: '.md',
section: 'Action',
excerptHtml: isFr
? 'Copie le contenu Markdown brut de la page active dans le presse-papiers.'
: 'Copy the clean Markdown source of the current documentation page.',
},
];
}
function copyTextFallback(text: string): Promise<void> {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } finally { ta.remove(); }
    return Promise.resolve();
  }

  function normalizePath(u: string): string {
    try {
      return new URL(u, window.location.origin).pathname.replace(/\/+$/, "") || "/";
    } catch {
      return u;
    }
  }

  function updateBookmarkIconsForUrl(url: string, pinned: boolean): void {
    const targetPath = normalizePath(url);
    listEl.querySelectorAll<HTMLAnchorElement>("a.sl-cmdk-row").forEach((row) => {
      if (normalizePath(row.href) !== targetPath) return;
      const pinBtn = row.querySelector<HTMLButtonElement>(".sl-cmdk-row__pin");
      if (!pinBtn) return;
      pinBtn.dataset.pinned = pinned ? "true" : "false";
      pinBtn.setAttribute("aria-label", pinned ? (isFr ? "Retirer des favoris" : "Unpin page") : (isFr ? "Ajouter aux favoris" : "Pin page"));
      pinBtn.replaceChildren(iconBookmark(pinned));

      pinBtn.removeAttribute("data-burst");
      void pinBtn.offsetWidth;
      if (pinned) {
        pinBtn.dataset.burst = "true";
        window.setTimeout(() => pinBtn.removeAttribute("data-burst"), 480);
      }

      const svg = pinBtn.querySelector("svg");
      if (svg) {
        animate(
          svg,
          pinned
            ? { y: [0, -3.5, 0.8, 0], scale: [0.88, 1.22, 0.96, 1] }
            : { scale: [1, 0.86, 1] },
          { type: spring, stiffness: 460, damping: 24 },
        );
      }
    });
  }

  function handleTogglePin(item: FlatItem | undefined): void {
    if (!item?.url) return;
    const targetUrl = item.url;
    const pinned = togglePinnedPage({
      title: item.title,
      url: targetUrl,
      section: item.section || classifySection(targetUrl, isFr).label,
    });

    if (statusEl) {
      if (copyToastTimer) window.clearTimeout(copyToastTimer);
      const defaultStatus = isFr ? "Tapez pour rechercher dans toute la documentation" : "Type to search across all documentation";
      statusEl.textContent = pinned
        ? isFr ? "Ajouté aux favoris" : "Pinned to favorites"
        : isFr ? "Retiré des favoris" : "Removed from favorites";
      statusEl.style.color = "var(--sl-color-accent-high)";
      statusEl.style.fontWeight = "600";
      copyToastTimer = window.setTimeout(() => {
        statusEl.textContent = defaultStatus;
        statusEl.style.color = "";
        statusEl.style.fontWeight = "";
      }, 1400);
    }

    if (!pinned && item.type === "pinned" && !input.value.trim()) {
      const activeRow = listEl.querySelector<HTMLElement>("[data-cmdk-idx][aria-selected=\"true\"]");
      if (activeRow) {
        activeRow.style.overflow = "hidden";
        const startH = activeRow.offsetHeight;
        animate(
          activeRow,
          { height: [startH + "px", "0px"], opacity: 0, paddingTop: "0px", paddingBottom: "0px" },
          { duration: 0.18, easing: "ease-out" },
        ).finished.then(() => {
          const prevScroll = listEl.scrollTop;
          renderEmptyState(true);
          activeIndex = Math.min(activeIndex, Math.max(0, renderedItems.length - 1));
          listEl.querySelectorAll<HTMLElement>("[data-cmdk-idx]").forEach((r) => {
            r.setAttribute("aria-selected", Number(r.dataset.cmdkIdx) === activeIndex ? "true" : "false");
          });
          listEl.scrollTop = prevScroll;
          renderPreview(renderedItems[activeIndex]);
        });
        return;
      }
    }

    updateBookmarkIconsForUrl(targetUrl, pinned);
    if (!input.value.trim()) {
      const countNow = getPinnedPages().length;
      const badge = tabsEl.querySelector<HTMLElement>("[data-empty-view=\"pinned\"] span");
      if (badge) badge.textContent = String(countNow);
    }
    renderPreview(renderedItems[activeIndex]);
  }

  function copyItemUrl(item: FlatItem | undefined, triggerBtn?: HTMLButtonElement): void {
if (!item?.url) return;
const fullUrl = new URL(item.url, window.location.origin).href;
copyTextFallback(fullUrl).then(() => {
if (statusEl) {
statusEl.textContent = isFr ? 'Lien copié' : 'Link copied';
}
if (triggerBtn) {
const orig = triggerBtn.textContent || '';
triggerBtn.textContent = isFr ? 'Lien copié' : 'Link copied';
setTimeout(() => {
triggerBtn.textContent = orig;
}, 1200);
}
}).catch(() => {});
}
function runAction(actionId?: string): void {
closeModal();
if (actionId === 'zen') {
document.querySelector('[data-zen-toggle]')?.click();
} else if (actionId === 'theme') {
const select = document.querySelector('starlight-theme-select select');
if (select) {
select.value = select.value === 'dark' ? 'light' : 'dark';
select.dispatchEvent(new Event('change', { bubbles: true }));
} else {
const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
document.documentElement.dataset.theme = next;
try { localStorage.setItem('starlight-theme', next); } catch {}
}
} else if (actionId === 'copy-md') {
document.querySelector('#copy-markdown')?.click();
}
}
async function hydratePagePreview(url: string): Promise<void> {
    if (pageMetaCache.has(url) || pendingMetaUrls.has(url)) return;
    pendingMetaUrls.add(url);
    try {
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) return;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const firstParaEl = Array.from(doc.querySelectorAll(".sl-markdown-content > p, main > p"))
        .find((p) => !p.closest("aside, .starlight-aside") && (p.textContent?.replace(/\s+/g, " ").trim().length || 0) > 24);
      const metaDesc = doc.querySelector("meta[name=\"description\"]")?.getAttribute("content")?.trim() || "";
      const excerpt = firstParaEl ? firstParaEl.innerHTML.replace(/\s+/g, " ").trim() : metaDesc;
      const baseUrl = url.split("#")[0];
      const subs: SubResult[] = [];
      doc.querySelectorAll(".sl-markdown-content h2[id], .sl-markdown-content h3[id], main h2[id]").forEach((h) => {
        if (subs.length >= 6) return;
        const id = h.getAttribute("id");
        const clone = h.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(".sl-anchor-link, [aria-hidden=\"true\"]").forEach((n) => n.remove());
        const title = clone.textContent?.replace(/\s+/g, " ").trim() || "";
        if (id && title) {
          subs.push({ title, url: baseUrl + "#" + id, excerpt: "" });
        }
      });
      pageMetaCache.set(url, { excerpt, subs });
      if (renderedItems[activeIndex]?.url === url) {
        renderPreview(renderedItems[activeIndex]);
      }
    } catch {
      pageMetaCache.set(url, { subs: [] });
    } finally {
      pendingMetaUrls.delete(url);
    }
  }

  function renderPreview(item: FlatItem | undefined): void {
    if (!previewEl) return;
    previewEl.replaceChildren();
    previewCopyBtn = null;
    if (!item) {
      lastPreviewKey = '';
      const empty = el('div', 'sl-cmdk-empty', isFr ? 'Sélectionnez un élément pour l’aperçu' : 'Select an item to preview');
      previewEl.appendChild(empty);
      return;
    }
    const nextPreviewKey = (item.url || '') + '::' + item.title;
    const isNewPreviewItem = nextPreviewKey !== lastPreviewKey;
    lastPreviewKey = nextPreviewKey;

    const cachedMeta = item.url ? pageMetaCache.get(item.url) : undefined;
    if (item.url && !cachedMeta) {
      void hydratePagePreview(item.url);
    }

    const top = el('div', 'sl-cmdk-preview__top');
    const eyebrow = el('div', 'sl-cmdk-preview__eyebrow');
    eyebrow.appendChild(item.type === 'action' ? iconZap() : item.type === 'sub' ? iconHash() : sectionIcon(item.sectionKey));
    eyebrow.appendChild(document.createTextNode(item.section || (item.type === 'recent' ? (isFr ? 'Recherche récente' : 'Recent query') : 'Docs')));
    top.appendChild(eyebrow);

    top.appendChild(el('h3', 'sl-cmdk-preview__title', item.title));
    if (item.url) {
      top.appendChild(el('div', 'sl-cmdk-preview__path', item.url));
    }

    const hasUiChromeNoise = item.excerptHtml && /Open in AI|ChatGPT|min read\./i.test(item.excerptHtml);
    if (item.excerptHtml && (!hasUiChromeNoise || !cachedMeta?.excerpt)) {
      const excerpt = el('p', 'sl-cmdk-preview__excerpt');
      appendHighlightedExcerpt(excerpt, item.excerptHtml);
      top.appendChild(excerpt);
    } else if (cachedMeta?.excerpt) {
      const excerpt = el('p', 'sl-cmdk-preview__excerpt');
      const parsed = new DOMParser().parseFromString(cachedMeta.excerpt, 'text/html');
      const appendSafe = (node: Node, target: HTMLElement): void => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          const parts = text.split(/(`[^`]+`)/g);
          for (const part of parts) {
            if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
              target.appendChild(el('code', undefined, part.slice(1, -1)));
            } else if (part) {
              target.appendChild(document.createTextNode(part));
            }
          }
        } else if (node instanceof HTMLElement) {
          if (node.tagName === 'CODE') {
            target.appendChild(el('code', undefined, node.textContent || ''));
          } else {
            node.childNodes.forEach((child) => appendSafe(child, target));
          }
        }
      };
      parsed.body.childNodes.forEach((n) => appendSafe(n, excerpt));
      top.appendChild(excerpt);
    } else if (item.breadcrumb) {
      top.appendChild(el('p', 'sl-cmdk-preview__excerpt', item.breadcrumb));
    }

    const effectiveSubs = item.subResults || cachedMeta?.subs;
    if (effectiveSubs && effectiveSubs.length > 0) {
      const subsBox = el('div', 'sl-cmdk-preview__subs');
      subsBox.appendChild(el('div', 'sl-cmdk-preview__subs-label', isFr ? 'Sections de la page' : 'On this page'));
      effectiveSubs.forEach((sub, subIdx) => {
        const a = el('a', 'sl-cmdk-preview__sub-link');
        a.href = sub.url;
        a.dataset.subJump = String(subIdx + 1);
        const left = el('span', 'sl-cmdk-preview__sub-left');
        left.appendChild(iconHash());
        left.appendChild(document.createTextNode(sub.title));
        a.appendChild(left);
        a.appendChild(el('kbd', 'sl-cmdk-kbd', '^' + String(subIdx + 1)));
        subsBox.appendChild(a);
      });
      top.appendChild(subsBox);
    }

    previewEl.appendChild(top);

    const actions = el('div', 'sl-cmdk-preview__actions');
    if (item.url) {
      const openLink = el('a', 'sl-cmdk-preview__btn sl-cmdk-preview__btn--primary', isFr ? 'Ouvrir la page' : 'Open page');
      openLink.href = item.url;
      actions.appendChild(openLink);

      const copyBtn = el('button', 'sl-cmdk-preview__btn');
      previewCopyBtn = copyBtn;
      copyBtn.type = 'button';
      copyBtn.appendChild(iconCopy());
      copyBtn.appendChild(document.createTextNode(isFr ? 'Copier' : 'Copy link'));
      copyBtn.addEventListener('click', () => copyItemUrl(item, copyBtn));
      actions.appendChild(copyBtn);
    } else {
      const runBtn = el('button', 'sl-cmdk-preview__btn sl-cmdk-preview__btn--primary', isFr ? 'Exécuter' : 'Run');
      runBtn.type = 'button';
      runBtn.addEventListener('click', () => activateItem(item));
      actions.appendChild(runBtn);
    }
    previewEl.appendChild(actions);
    
  }

  function renderTabs(results: PagefindData[]): void {
tabsEl.replaceChildren();
if (!input.value.trim() || results.length === 0) {
tabsEl.hidden = true;
return;
}
const counts = new Map<string, { label: string; count: number }>();
counts.set('all', { label: isFr ? 'Tout' : 'All', count: results.length });
for (const r of results) {
const sec = classifySection(r.url, isFr);
const prev = counts.get(sec.key);
counts.set(sec.key, { label: sec.label, count: (prev?.count ?? 0) + 1 });
}
if (!counts.has(activeFilter)) activeFilter = 'all';
tabsEl.hidden = false;
tabsEl.dataset.collapsed = 'false';
for (const [key, info] of counts.entries()) {
const btn = el('button', 'sl-cmdk-tab');
btn.type = 'button';
btn.dataset.filter = key;
btn.setAttribute('aria-selected', String(key === activeFilter));
btn.appendChild(document.createTextNode(info.label + ' '));
btn.appendChild(el('span', undefined, String(info.count)));
tabsEl.appendChild(btn);
}
}
function updateActiveRow(pulse = false): void {
const rows = listEl.querySelectorAll('[data-cmdk-idx]');
rows.forEach((row) => {
const idx = Number(row.dataset.cmdkIdx);
const selected = idx === activeIndex;
row.setAttribute('aria-selected', selected ? 'true' : 'false');
if (selected) {
row.scrollIntoView({ block: 'nearest' });

}
});

renderPreview(renderedItems[activeIndex]);
syncSelectionIndicator(false);
}
function makeRow(opts: {
idx: number;
href?: string;
extraClass?: string;
icon: SVGSVGElement;
iconClass?: string;
title: string;
breadcrumb?: string;
badge?: string;
kbd?: string;
excerptHtml?: string;
showArrow?: boolean;
}): HTMLElement {
const row = opts.href ? el('a', 'sl-cmdk-row') : el('button', 'sl-cmdk-row');
if (opts.extraClass) row.classList.add(opts.extraClass);
if (opts.href) {
(row as HTMLAnchorElement).href = opts.href;
} else {
(row as HTMLButtonElement).type = 'button';
}
row.dataset.cmdkIdx = String(opts.idx);
row.setAttribute('aria-selected', String(opts.idx === activeIndex));
const iconBox = el('span', opts.iconClass || 'sl-cmdk-row__icon');
iconBox.appendChild(opts.icon);
row.appendChild(iconBox);
const body = el('span', 'sl-cmdk-row__body');
const head = el('span', 'sl-cmdk-row__head');
const titleEl = el('span', 'sl-cmdk-row__title');
appendHighlightedText(titleEl, opts.title, input.value);
head.appendChild(titleEl);
body.appendChild(head);
if (opts.breadcrumb) {
const crumbEl = el('span', 'sl-cmdk-row__crumb');
appendHighlightedText(crumbEl, opts.breadcrumb, input.value);
body.appendChild(crumbEl);
}
if (opts.excerptHtml) {
const excerptEl = el('span', 'sl-cmdk-row__excerpt');
appendHighlightedExcerpt(excerptEl, opts.excerptHtml);
body.appendChild(excerptEl);
}
row.appendChild(body);
const trail = el('span', 'sl-cmdk-row__trail');
if (opts.badge) {
trail.appendChild(el('span', 'sl-cmdk-row__badge', opts.badge));
}
if (opts.kbd) {
trail.appendChild(el('kbd', 'sl-cmdk-kbd', opts.kbd));
}
if (opts.showArrow) {
const pinned = opts.href && opts.href !== "#" ? isPagePinned(opts.href) : false;
if (opts.href && opts.href !== "#") {
  const pinStar = el("button", "sl-cmdk-row__pin");
  pinStar.type = "button";
  pinStar.dataset.pinIdx = String(opts.idx);
  pinStar.dataset.pinned = pinned ? "true" : "false";
  pinStar.setAttribute("aria-label", pinned ? (isFr ? "Retirer des favoris" : "Unpin page") : (isFr ? "Ajouter aux favoris" : "Pin page"));
  pinStar.appendChild(iconBookmark(pinned));
  trail.appendChild(pinStar);
}
const arrowBox = el('span', 'sl-cmdk-row__arrow');
arrowBox.appendChild(iconArrowUpRight());
trail.appendChild(arrowBox);
}
if (trail.childNodes.length > 0) {
row.appendChild(trail);
}
return row;
}
function renderEmptyState(skipEntrance = false): void {
    const pinnedPages = getPinnedPages();
    const pinnedCount = pinnedPages.length;
    const allPages = collectSidebarPages();
    const catMap = new Map<string, { key: string; label: string; count: number }>();
    for (const p of allPages) {
      const sec = classifySection(p.url || "/", isFr);
      const prev = catMap.get(sec.key);
      if (prev) prev.count += 1;
      else catMap.set(sec.key, { key: sec.key, label: sec.label, count: 1 });
    }

    const validFilters = new Set(["all", "pinned", ...catMap.keys()]);
    if (!validFilters.has(activeFilter)) activeFilter = "all";

    tabsEl.hidden = false;
    tabsEl.dataset.collapsed = "false";
    tabsEl.replaceChildren();

    const makeEmptyTab = (filterKey: string, label: string, count?: number): HTMLButtonElement => {
      const btn = el("button", "sl-cmdk-tab");
      btn.type = "button";
      btn.dataset.emptyView = filterKey;
      btn.setAttribute("aria-selected", String(activeFilter === filterKey));
      btn.appendChild(document.createTextNode(label));
      if (typeof count === "number") {
        btn.appendChild(document.createTextNode(" "));
        btn.appendChild(el("span", undefined, String(count)));
      }
      return btn;
    };

    tabsEl.appendChild(makeEmptyTab("all", isFr ? "Tout" : "All"));
    tabsEl.appendChild(makeEmptyTab("pinned", isFr ? "Favoris" : "Pinned", pinnedCount));
    for (const cat of catMap.values()) {
      tabsEl.appendChild(makeEmptyTab(cat.key, cat.label, cat.count));
    }

    listEl.replaceChildren();
    renderedItems = [];

    if (activeFilter === "pinned") {
      if (pinnedPages.length === 0) {
        const empty = el("div", "sl-cmdk-empty", isFr ? "Aucune page favorite. Appuyez sur ⌘D pour en épingler une." : "No pinned pages yet. Press ⌘D or click the bookmark icon to pin a page.");
        listEl.appendChild(empty);
        renderPreview(undefined);
        if (!skipEntrance) animateListCards();
        if (statusEl) statusEl.textContent = isFr ? "0 page favorite" : "0 pinned pages";
        return;
      }
      const group = el("div", "sl-cmdk-group");
      const header = el("div", "sl-cmdk-group__title");
      header.appendChild(el("span", undefined, isFr ? "Pages favorites" : "Pinned pages"));
      group.appendChild(header);
      for (const pp of pinnedPages) {
        const idx = renderedItems.length;
        const sec = classifySection(pp.url, isFr);
        renderedItems.push({
          type: "pinned",
          title: pp.title,
          url: pp.url,
          section: pp.section || sec.label,
          sectionKey: sec.key,
          breadcrumb: formatBreadcrumb(pp.url, isFr),
        });
        group.appendChild(
          makeRow({
            idx,
            href: pp.url,
            icon: sectionIcon(sec.key),
            title: pp.title,
            breadcrumb: formatBreadcrumb(pp.url, isFr),
            badge: pp.section || sec.label,
            showArrow: true,
          }),
        );
      }
      listEl.appendChild(group);
      renderPreview(renderedItems.at(activeIndex));
      requestAnimationFrame(() => syncSelectionIndicator(true));
      if (statusEl) {
        statusEl.textContent = isFr
          ? pinnedPages.length + " page" + (pinnedPages.length > 1 ? "s" : "") + " favorite" + (pinnedPages.length > 1 ? "s" : "")
          : pinnedPages.length + " pinned page" + (pinnedPages.length > 1 ? "s" : "");
      }
      return;
    }

    if (activeFilter !== "all" && catMap.has(activeFilter)) {
      const cat = catMap.get(activeFilter)!;
      const filteredPages = allPages.filter((p) => classifySection(p.url || "/", isFr).key === activeFilter);
      const group = el("div", "sl-cmdk-group");
      const header = el("div", "sl-cmdk-group__title");
      header.appendChild(el("span", undefined, cat.label));
      group.appendChild(header);
      for (const page of filteredPages) {
        const idx = renderedItems.length;
        const item: FlatItem = {
          ...page,
          section: cat.label,
          sectionKey: cat.key,
          breadcrumb: formatBreadcrumb(page.url || "/", isFr),
        };
        renderedItems.push(item);
        group.appendChild(
          makeRow({
            idx,
            href: item.url || "/",
            icon: sectionIcon(cat.key),
            title: item.title,
            breadcrumb: item.breadcrumb,
            badge: cat.label,
            showArrow: true,
          }),
        );
      }
      listEl.appendChild(group);
      renderPreview(renderedItems.at(activeIndex));
      if (!skipEntrance) animateListCards();
      if (statusEl) {
        statusEl.textContent = isFr
          ? cat.label + " · " + filteredPages.length + " page" + (filteredPages.length > 1 ? "s" : "")
          : cat.label + " · " + filteredPages.length + " page" + (filteredPages.length > 1 ? "s" : "");
      }
      return;
    }

    const recentPages = getRecentPages();
if (recentPages.length > 0) {
const group = el('div', 'sl-cmdk-group');
const header = el('div', 'sl-cmdk-group__title');
header.appendChild(el('span', undefined, isFr ? 'Pages récentes' : 'Recent pages'));
const clearBtnEl = el('button', 'sl-cmdk-clear-recent', isFr ? 'Effacer' : 'Clear');
clearBtnEl.type = 'button';
clearBtnEl.dataset.clearRecent = 'true';
header.appendChild(clearBtnEl);
group.appendChild(header);
for (const rp of recentPages) {
const idx = renderedItems.length;
const sec = classifySection(rp.url, isFr);
renderedItems.push({
type: 'recent-page',
title: rp.title,
url: rp.url,
section: rp.section || sec.label,
sectionKey: sec.key,
breadcrumb: formatBreadcrumb(rp.url, isFr),
});
group.appendChild(
makeRow({
idx,
href: rp.url,
icon: sectionIcon(sec.key),
title: rp.title,
breadcrumb: formatBreadcrumb(rp.url, isFr),
badge: rp.section || sec.label,
showArrow: true,
}),
);
}
listEl.appendChild(group);
}
const recents = getRecent();
if (recents.length > 0) {
const group = el('div', 'sl-cmdk-group');
const header = el('div', 'sl-cmdk-group__title');
header.appendChild(el('span', undefined, isFr ? 'Recherches récentes' : 'Recent searches'));
if (recentPages.length === 0) {
const clearRecentBtn = el('button', 'sl-cmdk-clear-recent', isFr ? 'Effacer' : 'Clear');
clearRecentBtn.type = 'button';
clearRecentBtn.dataset.clearRecent = 'true';
header.appendChild(clearRecentBtn);
}
group.appendChild(header);
for (const q of recents) {
const idx = renderedItems.length;
renderedItems.push({ type: 'recent', title: q, query: q });
group.appendChild(
makeRow({
idx,
icon: iconHistory(),
title: q,
badge: isFr ? 'Récent' : 'Recent',
}),
);
}
listEl.appendChild(group);
}
const actionGroup = el('div', 'sl-cmdk-group');
const actionHeader = el('div', 'sl-cmdk-group__title');
actionHeader.appendChild(el('span', undefined, isFr ? 'Actions rapides' : 'Quick actions'));
actionGroup.appendChild(actionHeader);
for (const act of getQuickActions()) {
const idx = renderedItems.length;
renderedItems.push(act);
actionGroup.appendChild(
makeRow({
idx,
icon: iconZap(),
title: act.title,
kbd: act.subtitle,
}),
);
}
listEl.appendChild(actionGroup);
const pages = collectSidebarPages();
if (pages.length > 0) {
const navGroup = el('div', 'sl-cmdk-group');
const navHeader = el('div', 'sl-cmdk-group__title');
navHeader.appendChild(el('span', undefined, isFr ? 'Navigation rapide' : 'Jump to page'));
navGroup.appendChild(navHeader);
for (const p of pages) {
const idx = renderedItems.length;
renderedItems.push(p);
navGroup.appendChild(
makeRow({
idx,
href: p.url ?? '#',
icon: sectionIcon(p.sectionKey),
title: p.title,
breadcrumb: p.breadcrumb,
badge: p.section,
showArrow: true,
}),
);
}
listEl.appendChild(navGroup);
}
renderPreview(renderedItems[activeIndex]);
requestAnimationFrame(() => syncSelectionIndicator(true));
const searchSig = input.value.trim() + "::" + activeFilter + "::" + renderedItems.length;
if (searchSig !== lastAnimatedSearchSig) {
  lastAnimatedSearchSig = searchSig;
  animateListCards();
}
if (statusEl) {
statusEl.textContent = pagefindFailed
? isFr
? 'Index Pagefind disponible après pnpm build'
: 'Full-text Pagefind index activates after pnpm build'
: isFr
? 'Tapez pour rechercher dans toute la documentation'
: 'Type to search across all documentation';
}
}
function renderSearchResults(skipEntrance = false): void {
renderTabs(currentResults);
listEl.replaceChildren();
const qLow = input.value.trim().toLowerCase();
const matchedActions =
activeFilter === 'all'
? getQuickActions().filter(
(a) =>
a.title.toLowerCase().includes(qLow) ||
(a.subtitle && a.subtitle.toLowerCase().includes(qLow)),
)
: [];
const filtered =
activeFilter === 'all'
? currentResults
: currentResults.filter((r) => classifySection(r.url, isFr).key === activeFilter);
renderedItems = [];
if (matchedActions.length > 0) {
const actionGroup = el('div', 'sl-cmdk-group');
const actionHeader = el('div', 'sl-cmdk-group__title');
actionHeader.appendChild(el('span', undefined, isFr ? 'Commandes correspondantes' : 'Matching commands'));
actionGroup.appendChild(actionHeader);
for (const act of matchedActions) {
const idx = renderedItems.length;
renderedItems.push(act);
actionGroup.appendChild(
makeRow({
idx,
icon: iconZap(),
title: act.title,
kbd: act.subtitle,
}),
);
}
listEl.appendChild(actionGroup);
}
if (filtered.length === 0 && matchedActions.length === 0) {
const empty = el('div', 'sl-cmdk-empty');
empty.appendChild(document.createTextNode(isFr ? 'Aucun résultat pour « ' : 'No results found for “'));
empty.appendChild(el('strong', undefined, input.value.trim()));
empty.appendChild(document.createTextNode(isFr ? ' »' : '”'));
listEl.appendChild(empty);
renderPreview(undefined);
if (statusEl) statusEl.textContent = isFr ? '0 résultat' : '0 results';
return;
}
for (const res of filtered) {
const sec = classifySection(res.url, isFr);
const title = res.meta?.title || res.url;
const crumb = formatBreadcrumb(res.url, isFr);
const subs = (res.sub_results || []).filter((s) => s.url !== res.url && s.title).slice(0, 3);
const pageIdx = renderedItems.length;
renderedItems.push({
type: 'page',
title,
url: res.url,
section: sec.label,
sectionKey: sec.key,
breadcrumb: crumb,
excerptHtml: res.excerpt || '',
subResults: subs,
});
const card = el('div', 'sl-cmdk-card');
card.appendChild(
makeRow({
idx: pageIdx,
href: res.url,
extraClass: 'sl-cmdk-row--page',
icon: sectionIcon(sec.key),
title,
breadcrumb: crumb,
badge: sec.label,
excerptHtml: res.excerpt || '',
showArrow: true,
}),
);
for (const sub of subs) {
const subIdx = renderedItems.length;
renderedItems.push({
type: 'sub',
title: sub.title,
url: sub.url,
section: title,
sectionKey: sec.key,
breadcrumb: crumb + ' › ' + sub.title,
excerptHtml: sub.excerpt || '',
});
card.appendChild(
makeRow({
idx: subIdx,
href: sub.url,
extraClass: 'sl-cmdk-row--sub',
icon: iconHash(),
iconClass: 'sl-cmdk-sub-branch',
title: sub.title,
excerptHtml: sub.excerpt || '',
showArrow: true,
}),
);
}
listEl.appendChild(card);
}
renderPreview(renderedItems[activeIndex]);
const searchSig = input.value.trim() + "::" + activeFilter + "::" + renderedItems.length;
if (searchListAnimTimer) window.clearTimeout(searchListAnimTimer);
if (searchSig !== lastAnimatedSearchSig) {
  searchListAnimTimer = window.setTimeout(() => {
    lastAnimatedSearchSig = searchSig;
    animateListCards();
  }, 190);
}
if (statusEl) {
statusEl.textContent = isFr
? filtered.length + ' page' + (filtered.length > 1 ? 's' : '') + ' trouvée' + (filtered.length > 1 ? 's' : '')
: filtered.length + ' matching page' + (filtered.length > 1 ? 's' : '');
}
}
function parseScopedQuery(raw: string): { scope?: string; query: string } {
    const m = /^(docs|guides?|ref|reference|blog|logs?):\s*(.*)$/i.exec(raw);
    if (!m) return { query: raw };
    const token = m[1].toLowerCase();
    const scope =
      token === "guide" || token === "guides"
        ? "guides"
        : token === "ref" || token === "reference"
          ? "reference"
          : token === "log" || token === "logs"
            ? "changelog"
            : token;
    return { scope, query: m[2].trim() };
  }

  async function handleQuery(): Promise {
const q = input.value.trim();
if (clearBtn) {
const vis = q.length > 0;
clearBtn.dataset.visible = vis ? 'true' : 'false';
clearBtn.tabIndex = vis ? 0 : -1;
clearBtn.setAttribute('aria-hidden', vis ? 'false' : 'true');
}
activeIndex = 0;
if (!q) {
currentResults = [];
activeFilter = 'all';
renderEmptyState();
return;
}

if (q.startsWith("/") || q.startsWith(">")) {
  const cmdQ = q.slice(1).trim().toLowerCase();
  tabsEl.dataset.collapsed = "true";
  listEl.replaceChildren();
  renderedItems = [];
  const matchedActions = getQuickActions().filter(
    (a) =>
      !cmdQ ||
      a.title.toLowerCase().includes(cmdQ) ||
      (a.subtitle && a.subtitle.toLowerCase().includes(cmdQ)),
  );
  if (matchedActions.length === 0) {
    const empty = el("div", "sl-cmdk-empty");
    empty.appendChild(document.createTextNode(isFr ? "Aucune commande pour « " : "No commands matching “"));
    empty.appendChild(el("strong", undefined, q.slice(1).trim()));
    empty.appendChild(document.createTextNode(isFr ? " »" : "”"));
    listEl.appendChild(empty);
    renderPreview(undefined);
    if (statusEl) statusEl.textContent = isFr ? "Mode commandes (/) · 0 résultat" : "Commands mode (/) · 0 matches";
    return;
  }
  const group = el("div", "sl-cmdk-group");
  const header = el("div", "sl-cmdk-group__title");
  header.appendChild(el("span", undefined, isFr ? "Commandes (/)" : "Commands (/)"));
  group.appendChild(header);
  for (const act of matchedActions) {
    const idx = renderedItems.length;
    renderedItems.push(act);
    group.appendChild(
      makeRow({
        idx,
        icon: iconZap(),
        title: act.title,
        kbd: act.subtitle,
      }),
    );
  }
  listEl.appendChild(group);
  renderPreview(renderedItems.at(0));
  requestAnimationFrame(() => syncSelectionIndicator(true));
  if (statusEl) {
    statusEl.textContent = isFr
      ? `Mode commandes (/) · ${matchedActions.length} action${matchedActions.length > 1 ? "s" : ""}`
      : `Commands mode (/) · ${matchedActions.length} command${matchedActions.length > 1 ? "s" : ""}`;
  }
  return;
}

if (q.startsWith("#")) {
  const headQ = q.slice(1).trim().toLowerCase();
  tabsEl.dataset.collapsed = "true";
  listEl.replaceChildren();
  renderedItems = [];
  const allHeadings: FlatItem[] = [];
  for (const page of getSitePagesRaw()) {
    const sec = classifySection(page.url, isFr);
    for (const h of page.headings || []) {
      if (
        !headQ ||
        h.title.toLowerCase().includes(headQ) ||
        page.title.toLowerCase().includes(headQ)
      ) {
        allHeadings.push({
          type: "sub",
          title: h.title,
          url: page.url + "#" + h.slug,
          section: sec.label,
          sectionKey: sec.key,
          breadcrumb: page.title,
        });
      }
    }
  }
  const shown = allHeadings.slice(0, 24);
  if (shown.length === 0) {
    const empty = el("div", "sl-cmdk-empty");
    empty.appendChild(document.createTextNode(isFr ? "Aucune section pour « " : "No headings matching “"));
    empty.appendChild(el("strong", undefined, q));
    empty.appendChild(document.createTextNode(isFr ? " »" : "”"));
    listEl.appendChild(empty);
    renderPreview(undefined);
    if (statusEl) statusEl.textContent = isFr ? "Mode sections (#) · 0 résultat" : "Headings mode (#) · 0 matches";
    return;
  }
  const group = el("div", "sl-cmdk-group");
  const header = el("div", "sl-cmdk-group__title");
  header.appendChild(el("span", undefined, isFr ? "Sections (#)" : "Headings (#)"));
  group.appendChild(header);
  for (const item of shown) {
    const idx = renderedItems.length;
    renderedItems.push(item);
    group.appendChild(
      makeRow({
        idx,
        href: item.url || "#",
        icon: iconHash(),
        title: item.title,
        breadcrumb: item.breadcrumb,
        badge: item.section,
        showArrow: true,
      }),
    );
  }
  listEl.appendChild(group);
  renderPreview(renderedItems.at(0));
  animateListCards();
  if (statusEl) {
    statusEl.textContent = isFr
      ? `Mode sections (#) · ${allHeadings.length} section${allHeadings.length > 1 ? "s" : ""}`
      : `Headings mode (#) · ${allHeadings.length} heading${allHeadings.length > 1 ? "s" : ""}`;
  }
  return;
}
const parsedScope = parseScopedQuery(q);
if (parsedScope.scope) {
  activeFilter = parsedScope.scope;
}
const effectiveQ = parsedScope.query;
if (!effectiveQ && parsedScope.scope) {
  activeFilter = parsedScope.scope;
  renderEmptyState(false);
  return;
}
const seq = ++searchSeq;
const pf = await ensurePagefind();
if (!pf) {
const qLow = effectiveQ.toLowerCase();
const navMatches = collectSidebarPages().filter((p) => p.title.toLowerCase().includes(qLow));
currentResults = navMatches.map((m) => ({
url: m.url || '/',
meta: { title: m.title },
excerpt: isFr ? 'Correspondance dans le menu latéral' : 'Matched in sidebar navigation',
}));
renderSearchResults();
return;
}
const cacheKey = (isFr ? "fr:" : "en:") + effectiveQ.toLowerCase();
    const cachedQuery = queryCache.get(cacheKey);
    if (cachedQuery) {
      currentResults = cachedQuery;
      renderSearchResults();
      return;
    }
    const search = await pf.search(effectiveQ);
if (!search || seq !== searchSeq) return;
const loaded: PagefindData[] = await Promise.all(search.results.slice(0, 14).map((r: any) => r.data()));
if (seq !== searchSeq) return;
const localeFiltered = loaded.filter((item) => {
const itemIsFr = item.url === '/fr/' || item.url.startsWith('/fr/');
return isFr ? itemIsFr : !itemIsFr;
});
let finalResults = localeFiltered.length > 0 ? localeFiltered : loaded;
if (finalResults.length === 0 && parsedScope.scope === "changelog") {
  const qLow = effectiveQ.toLowerCase();
  finalResults = collectSidebarPages()
    .filter((item) => item.sectionKey === "changelog" && (!qLow || item.title.toLowerCase().includes(qLow) || (item.url && item.url.toLowerCase().includes(qLow))))
    .map((m) => ({
      url: m.url || "/changelog/",
      meta: { title: m.title },
      excerpt: m.breadcrumb || "Changelog",
    }));
}
currentResults = finalResults;
queryCache.set(cacheKey, currentResults);
renderSearchResults();
}
function openModal(): void {
if (dialog.open) return;
dialog.showModal();
activeIndex = 0;
if (!input.value.trim()) renderEmptyState();

ensurePagefind();
animate(panel, { opacity: new Array(0, 1), scale: [0.985, 1], y: [-4, 0] }, { duration: 0.16 });
requestAnimationFrame(() => input.focus());
}
function closeModal(): void {
if (!dialog.open) return;
dialog.close();
}
function activateItem(item: FlatItem | undefined, newTab = false): void {
if (!item) return;
if (item.type === 'recent' && item.query) {
input.value = item.query;
handleQuery();
return;
}
if (item.type === 'action') {
runAction(item.actionId);
return;
}
if (item.url) {
if (input.value.trim()) pushRecent(input.value.trim());
pushRecentPage({
title: item.title,
url: item.url,
section: item.section || classifySection(item.url, isFr).label,
});
closeModal();
if (newTab) {
window.open(item.url, '_blank', 'noopener,noreferrer');
} else {
window.location.assign(item.url);
}
}
}
root.querySelectorAll('[data-cmdk-open]').forEach((btn) => {
btn.addEventListener('pointerenter', () => {
animate(btn, { scale: 1.015 }, { type: spring, stiffness: 500, damping: 28 });
});
btn.addEventListener('pointerleave', () => {
animate(btn, { scale: 1 }, { type: spring, stiffness: 500, damping: 28 });
});
btn.addEventListener('pointerdown', () => {
animate(btn, { scale: 0.985 }, { type: spring, stiffness: 600, damping: 30 });
});
btn.addEventListener('click', openModal);
});
dialog.addEventListener("keydown", (e) => {
    if (((isMac && e.metaKey && !e.ctrlKey) || (!isMac && e.altKey)) && e.key.toLowerCase() === "d") {
      const current = renderedItems[activeIndex];
      if (current?.url) {
        e.preventDefault();
        e.stopPropagation();
        handleTogglePin(current);
        return;
      }
    }
if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
      const current = renderedItems[activeIndex];
      if (current?.url) {
        e.preventDefault();
        e.stopPropagation();
        copyItemUrl(current);
      }
    }
  });

  dialog.addEventListener('click', (e) => {
if (e.target === dialog) closeModal();
});
dialog.addEventListener('cancel', (e) => {
if (input.value.trim().length > 0) {
e.preventDefault();
input.value = '';
handleQuery();
input.focus();
}
});
clearBtn?.addEventListener('click', () => {
input.value = '';
handleQuery();
input.focus();
});
tabsEl.addEventListener('click', (e) => {
    const emptyTab = e.target instanceof Element ? e.target.closest<HTMLButtonElement>("[data-empty-view]") : null;
    if (emptyTab && emptyTab.dataset.emptyView) {
      activeFilter = emptyTab.dataset.emptyView;
      activeIndex = 0;
      renderEmptyState(false);
      return;
    }
    const tab = e.target instanceof Element ? e.target.closest<HTMLButtonElement>("[data-filter]") : null;
    if (!tab || !tab.dataset.filter) return;
    activeFilter = tab.dataset.filter;
    activeIndex = 0;
    renderSearchResults();
  });

  previewEl?.addEventListener('click', (e) => {
    const subLink = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('.sl-cmdk-preview__sub-link') : null;
    if (subLink) {
      closeModal();
    }
  });
  listEl.addEventListener('click', (e) => {
const pinToggle = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-pin-idx]") : null;
    if (pinToggle) {
      e.preventDefault();
      e.stopPropagation();
      const targetItem = renderedItems[Number(pinToggle.dataset.pinIdx)];
      handleTogglePin(targetItem);
      return;
    }
    const clearRecent = e.target instanceof Element ? e.target.closest("[data-clear-recent]") : null;
if (clearRecent) {
e.preventDefault();
try {
localStorage.removeItem(RECENT_KEY);
localStorage.removeItem(RECENT_PAGES_KEY);
} catch {}
renderEmptyState();
return;
}
const row = e.target instanceof Element ? e.target.closest('[data-cmdk-idx]') : null;
if (!row) return;
const item = renderedItems[Number(row.dataset.cmdkIdx)];
if (item?.type === 'recent' || item?.type === 'action') {
e.preventDefault();
activateItem(item);
} else if (item?.url) {
if (input.value.trim()) pushRecent(input.value.trim());
pushRecentPage({
title: item.title,
url: item.url,
section: item.section || classifySection(item.url, isFr).label,
});
}
});
listEl.addEventListener('mousemove', (e) => {
const row = e.target instanceof Element ? e.target.closest('[data-cmdk-idx]') : null;
if (!row) return;
const idx = Number(row.dataset.cmdkIdx);
if (!Number.isNaN(idx) && idx !== activeIndex) {
activeIndex = idx;
updateActiveRow(false);
}
});
input.addEventListener('input', () => {
if (searchListAnimTimer) window.clearTimeout(searchListAnimTimer);
const rawVal = input.value.trim();
if (clearBtn) {
  const hasVal = input.value.length > 0;
  clearBtn.dataset.visible = hasVal ? 'true' : 'false';
  clearBtn.tabIndex = hasVal ? 0 : -1;
  clearBtn.setAttribute('aria-hidden', String(!hasVal));
}
if (!rawVal || rawVal === '/' || rawVal === '#') {
  handleQuery();
  return;
}
searchListAnimTimer = window.setTimeout(() => {
  handleQuery();
}, 95);
});
input.addEventListener('keydown', (e) => {
if (e.key === 'ArrowDown' || (e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n')) {
e.preventDefault();
if (renderedItems.length > 0) {
activeIndex = (activeIndex + 1) % renderedItems.length;
updateActiveRow(true);
}
} else if (e.key === 'ArrowUp' || (e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'p')) {
e.preventDefault();
if (renderedItems.length > 0) {
activeIndex = (activeIndex - 1 + renderedItems.length) % renderedItems.length;
updateActiveRow(true);
}
} else if (e.key === 'PageDown' || (e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'd')) {
const prevTop = previewEl?.querySelector<HTMLElement>('.sl-cmdk-preview__top');
if (prevTop) {
e.preventDefault();
prevTop.scrollBy({ top: Math.max(120, Math.round(prevTop.clientHeight * 0.65)), behavior: 'smooth' });
}
} else if (e.key === 'PageUp' || (e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'u')) {
const prevTop = previewEl?.querySelector<HTMLElement>('.sl-cmdk-preview__top');
if (prevTop) {
e.preventDefault();
prevTop.scrollBy({ top: -Math.max(120, Math.round(prevTop.clientHeight * 0.65)), behavior: 'smooth' });
}
} else if (e.ctrlKey && !e.metaKey && !e.altKey && (/^[1-6]$/.test(e.key) || /^Digit[1-6]$/.test(e.code))) {
const digit = /^[1-6]$/.test(e.key) ? e.key : e.code.slice(5);
const jumpLink = previewEl?.querySelector<HTMLAnchorElement>(`[data-sub-jump="${digit}"]`);
if (jumpLink) {
e.preventDefault();
e.stopPropagation();
const targetHref = jumpLink.getAttribute("href") || jumpLink.href;
closeModal();
if (targetHref) window.location.assign(targetHref);
}
} else if (e.key === 'Enter') {
e.preventDefault();
activateItem(renderedItems[activeIndex], e.metaKey || e.ctrlKey);
} else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
const current = renderedItems[activeIndex];
if (current?.url) {
e.preventDefault();
copyItemUrl(current);
}
} else if (e.key === 'Tab' && !tabsEl.hidden) {
const tabs = Array.from(tabsEl.querySelectorAll<HTMLElement>('[data-filter], [data-empty-view]'));
if (tabs.length > 1) {
e.preventDefault();
const cur = tabs.findIndex((t) => (t.dataset.filter || t.dataset.emptyView) === activeFilter);
const next = tabs[(cur + (e.shiftKey ? -1 : 1) + tabs.length) % tabs.length];
const nextKey = next?.dataset.filter || next?.dataset.emptyView;
if (nextKey) {
activeFilter = nextKey;
activeIndex = 0;
if (next?.dataset.emptyView) renderEmptyState(false);
else renderSearchResults();
}
}
}
});
document.addEventListener("keydown", (e) => {
    if (dialog.open && ((isMac && e.metaKey && !e.ctrlKey) || (!isMac && e.altKey)) && e.key.toLowerCase() === "d") {
      const current = renderedItems[activeIndex];
      if (current?.url) {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleTogglePin(current);
      }
      return;
    }
  }, { capture: true });

  document.addEventListener('keydown', (e) => {
if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
e.preventDefault();
if (dialog.open) closeModal();
else openModal();
return;
}
if (
e.key === '/' &&
!dialog.open &&
!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLElement && e.target.isContentEditable))
) {
e.preventDefault();
openModal();
}
});
}
initCommandSearch();
document.addEventListener('astro:page-load', initCommandSearch);
