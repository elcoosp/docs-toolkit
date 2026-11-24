import { buildAiProviderHref, type AiProviderSpec } from './ai-providers';
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
  actionHref?: string;
  actionIconPath?: string;
  shortTitle?: string;
}

const RECENT_KEY = 'sl-cmdk-recent-v1';
const RECENT_PAGES_KEY = 'sl-cmdk-recent-pages-v1';
const PINNED_PAGES_KEY = 'sl-cmdk-pinned-pages-v1';
const SVG_NS = ['http:', '', 'www.w3.org', '2000', 'svg'].join('/');

function lucideIcon(paths: Array<[string, Record<string, string>]>, size = 15): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
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
    svg.append(node);
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
    [
      'path',
      {
        d: 'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z',
      },
    ],
  ]);
}

function iconBookOpen(): SVGSVGElement {
  return lucideIcon([
    ['path', { d: 'M12 7v14' }],
    [
      'path',
      {
        d: 'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
      },
    ],
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
    [
      'path',
      {
        d: 'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2',
      },
    ],
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
        'path',
        {
          d: 'm19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z',
        },
      ],
    ],
    14,
  );
  if (filled) svg.setAttribute('fill', 'currentColor');
  return svg;
}

function matchesCurrentLocale(url: string): boolean {
  const prefix = document.documentElement.lang === 'fr' ? '/fr' : '';
  if (prefix) return url === prefix || url.startsWith(prefix + '/');
  return !/^\/[a-z]{2}(?:-[a-z]{2})?(?:\/|$)/i.test(url);
}

function getPinnedPages(): RecentPage[] {
  try {
    const raw = localStorage.getItem(PINNED_PAGES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (x): x is RecentPage =>
              Boolean(x && typeof x.url === 'string' && typeof x.title === 'string') &&
              matchesCurrentLocale(x.url),
          )
          .slice(0, 8)
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

function iconCheck(): SVGSVGElement {
  return lucideIcon([['polyline', { points: '20 6 9 17 4 12' }]], 13);
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
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function appendHighlightedText(target: HTMLElement, text: string, rawQuery: string): void {
  const cleanQ = rawQuery
    .replace(/^(?:docs|guides?|ref|reference|blog|logs?):\s*/i, '')
    .replace(/^[\/#>]+/, '')
    .trim();
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
  const escaped = tokens
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\' + String.fromCharCode(36) + '&'))
    .join('|');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  for (const part of parts) {
    if (!part) continue;
    if (tokens.some((t) => part.toLowerCase() === t.toLowerCase())) {
      const mark = document.createElement('mark');
      mark.textContent = part;
      target.append(mark);
    } else {
      target.append(document.createTextNode(part));
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
      target.append(mark);
    } else {
      const plain = decodeEntities(part.replace(/<[^>]*>/g, ''));
      if (plain) target.append(document.createTextNode(plain));
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
    const next = [
      trimmed,
      ...getRecent().filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
    ].slice(0, 4);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

function getRecentPages(): RecentPage[] {
  try {
    const raw = localStorage.getItem(RECENT_PAGES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .filter(
            (x): x is RecentPage =>
              Boolean(x && typeof x.url === 'string' && typeof x.title === 'string') &&
              matchesCurrentLocale(x.url),
          )
          .slice(0, 4)
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
  const clean =
    url
      .split('#')
      .at(0)
      ?.replace(/^\/fr(?=\/|$)/, '')
      .replace(/^\/|\/$/g, '') || '';
  if (!clean) return isFr ? 'Accueil' : 'Home';
  if (clean === 'changelog') return isFr ? 'Toutes les versions' : 'All releases';
  const verMatch = /^changelog\/version\/(.+)$/.exec(clean);
  if (verMatch) {
    const ver = verMatch.at(1)?.replace(/-/g, '.') || '';
    return isFr ? `Notes de version · v${ver}` : `Release notes · v${ver}`;
  }
  const segs = clean.split('/').map((seg) =>
    seg
      .split('-')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' '),
  );
  return segs.join(' › ');
}

function modeLabelForPrefix(prefix: string, isFr: boolean): string {
  if (!prefix) return '';
  if (prefix === '/') return isFr ? 'Commandes' : 'Commands';
  if (prefix === '#') return isFr ? 'Titres' : 'Headings';
  const key = prefix.replace(/:$/, '').toLowerCase();
  if (key === 'log' || key === 'logs') return 'Changelog';
  if (key === 'ref' || key === 'reference') return isFr ? 'Référence' : 'Reference';
  if (key === 'guide' || key === 'guides') return 'Guides';
  if (key === 'docs') return 'Docs';
  if (key === 'blog') return 'Blog';
  return '';
}

export function initCommandSearch(): void {
  const root = document.querySelector<HTMLElement>('[data-cmdk-root]');
  if (!root || root.dataset.bound === 'true') return;
  root.dataset.bound = 'true';

  const isFr = root.dataset.locale === 'fr';
  let cmdkCfg: {
    locale?: string;
    localePrefix?: string;
    ui?: Record<string, string>;
    aiProviders?: AiProviderSpec[];
  } = {};
  try {
    const cfgRaw = root.querySelector<HTMLScriptElement>('script[data-cmdk-config]')?.textContent;
    if (cfgRaw) cmdkCfg = JSON.parse(cfgRaw);
  } catch {}
  const ui = cmdkCfg.ui || {};
  const tr = (key: string, fallback: string, vars?: Record<string, string>): string => {
    let out = ui[key] || fallback;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) out = out.replaceAll('{' + k + '}', v);
    }
    return out;
  };
  function iconBrandPath(d: string): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    svg.setAttribute('width', '15');
    svg.setAttribute('height', '15');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.width = '15px';
    svg.style.height = '15px';
    svg.style.display = 'block';
    svg.style.flexShrink = '0';
    const pathEl = document.createElementNS(SVG_NS, 'path');
    pathEl.setAttribute('d', d);
    svg.append(pathEl);
    return svg;
  }
  const dialog = root.querySelector<HTMLDialogElement>('#sl-cmdk-dialog');
  const panel = root.querySelector<HTMLElement>('.sl-cmdk-panel');
  const input = root.querySelector<HTMLInputElement>('#sl-cmdk-input');
  const clearBtn = root.querySelector<HTMLButtonElement>('#sl-cmdk-clear');
  const tabsEl = root.querySelector<HTMLElement>('#sl-cmdk-tabs');
  const listEl = root.querySelector<HTMLElement>('#sl-cmdk-list');
  const previewEl = root.querySelector<HTMLElement>('#sl-cmdk-preview');

  const statusEl = root.querySelector<HTMLElement>('#sl-cmdk-status');
  const hintsEl = root.querySelector<HTMLElement>('#sl-cmdk-hints');
  const modePillEl = root.querySelector<HTMLElement>('#sl-cmdk-mode-pill');
  const shortcutsBtn = root.querySelector<HTMLButtonElement>('#sl-cmdk-shortcuts-btn');
  const shortcutsPopover = root.querySelector<HTMLElement>('#sl-cmdk-shortcuts-popover');

  function updateContextualChrome(): void {
    const curVal = input?.value ?? '';
    const raw = (activeModePrefix ? activeModePrefix + curVal : curVal).trim();
    const isCmd = raw.startsWith('/') || raw.startsWith('>');
    if (modePillEl) {
      const label = modeLabelForPrefix(activeModePrefix, isFr);
      if (label) {
        modePillEl.hidden = false;
        modePillEl.replaceChildren(
          document.createTextNode(label + ' '),
          el('span', 'sl-cmdk-mode-pill__x', '×'),
        );
      } else {
        modePillEl.hidden = true;
        modePillEl.replaceChildren();
      }
    }
    if (!hintsEl) return;
    const mod = isMac ? '⌘' : 'Ctrl ';
    let pairs: Array<[string, string]>;
    if (markedItems.size > 0) {
      pairs = [
        [mod + '⇧C', isFr ? 'Copier Markdown' : 'Copy Markdown'],
        [mod + '↵', isFr ? 'Tout ouvrir' : 'Open all'],
        ['ESC', isFr ? 'Tout décocher' : 'Clear marks'],
      ];
    } else if (isCmd) {
      pairs = [
        ['↑↓', ui.nav || (isFr ? 'Naviguer' : 'Navigate')],
        ['↵', isFr ? 'Exécuter' : 'Run'],
        ['ESC', ui.close || (isFr ? 'Fermer' : 'Close')],
      ];
    } else {
      pairs = [
        ['↑↓', ui.nav || (isFr ? 'Naviguer' : 'Navigate')],
        ['↵', ui.open || (isFr ? 'Ouvrir' : 'Open')],
        [mod + '↵', ui.newTab || (isFr ? 'Nouvel onglet' : 'New tab')],
        [mod + 'D', ui.pin || (isFr ? 'Favori' : 'Pin')],
      ];
    }
    hintsEl.replaceChildren();
    for (const [k, label] of pairs) {
      const span = el('span', 'sl-cmdk-hint');
      span.append(el('kbd', 'sl-cmdk-kbd', k));
      span.append(document.createTextNode(' ' + label));
      hintsEl.append(span);
    }
  }

  modePillEl?.addEventListener('click', () => {
    if (!input) return;
    activeModePrefix = '';
    input.value = '';
    input.focus();
    void handleQuery();
  });
  shortcutsPopover?.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-cmdk-trigger]') : null;
    const trig = btn?.dataset.cmdkTrigger;
    if (!trig || !input) return;
    shortcutsPopover.hidden = true;
    shortcutsBtn?.setAttribute('aria-expanded', 'false');
    activeModePrefix = '';
    input.value = trig;
    input.focus();
    void handleQuery();
  });
  shortcutsBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!shortcutsPopover) return;
    const nextOpen = shortcutsPopover.hidden;
    shortcutsPopover.hidden = !nextOpen;
    shortcutsBtn.setAttribute('aria-expanded', String(nextOpen));
  });
  dialog?.addEventListener('click', (e) => {
    if (
      shortcutsPopover &&
      !shortcutsPopover.hidden &&
      e.target instanceof Element &&
      !e.target.closest('.sl-cmdk-shortcuts-wrap')
    ) {
      shortcutsPopover.hidden = true;
      shortcutsBtn?.setAttribute('aria-expanded', 'false');
    }
  });

  if (!dialog || !panel || !input || !tabsEl || !listEl) return;

  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
  root.querySelectorAll<HTMLElement>('[data-cmdk-shortcut]').forEach((node) => {
    node.textContent = isMac ? '⌘K' : 'Ctrl K';
  });
  root.querySelectorAll<HTMLElement>('[data-cmdk-copy-kbd]').forEach((node) => {
    node.textContent = isMac ? '⌘C' : 'Ctrl C';
  });
  root.querySelectorAll<HTMLElement>('[data-cmdk-pin-kbd]').forEach((node) => {
    node.textContent = isMac ? '⌘D' : 'Ctrl D';
  });
  root.querySelectorAll<HTMLElement>('[data-cmdk-newtab-kbd]').forEach((node) => {
    node.textContent = isMac ? '⌘↵' : 'Ctrl ↵';
  });

  let pagefind: any = null;
  let pagefindFailed = false;
  let activeFilter = 'all';
  let activeModePrefix = '';
  let activeIndex = 0;
  let aiCommandsExpanded = false;
  let lastToggleClickAt = 0;
  const markedItems = new Map<string, { title: string; url: string; section: string }>();
  let historyCursor = -1;
  let historyDraft = '';
  let previewThemeOriginal: string | null = null;
  let currentResults: PagefindData[] = [];
  let renderedItems: FlatItem[] = [];
  let searchSeq = 0;
  const queryCache = new Map<string, PagefindData[]>();
  interface CodeToken {
    text: string;
    light?: string;
    dark?: string;
  }
  interface PreviewBlock {
    kind: 'p' | 'code';
    html?: string;
    text?: string;
    lang?: string;
    lines?: CodeToken[][];
  }
  interface DocGraphEntry {
    title: string;
    pageRank: number;
    incoming: Array<{ route: string; title: string }>;
    outgoing: Array<{ route: string; title: string }>;
  }
  const docGraphMap = new Map<string, DocGraphEntry>();
  let docGraphLoaded = false;
  let docGraphLoading = false;
  async function ensureDocGraph(): Promise<void> {
    if (docGraphLoaded || docGraphLoading) return;
    docGraphLoading = true;
    try {
      const res = await fetch('/graph.json', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        nodes?: Array<{ route: string; title: string; pageRank: number }>;
        edges?: Array<{ source: string; target: string }>;
      };
      const nodes = Array.isArray(data.nodes) ? data.nodes : [];
      const edges = Array.isArray(data.edges) ? data.edges : [];
      const titleByRoute = new Map<string, string>();
      for (const n of nodes) {
        const key = normalizePath(n.route);
        titleByRoute.set(key, n.title || n.route);
        docGraphMap.set(key, {
          title: n.title || n.route,
          pageRank: n.pageRank || 0,
          incoming: [],
          outgoing: [],
        });
      }
      for (const e of edges) {
        const src = normalizePath(e.source);
        const dst = normalizePath(e.target);
        const srcNode = docGraphMap.get(src);
        const dstNode = docGraphMap.get(dst);
        if (srcNode && dstNode) {
          if (srcNode.outgoing.length < 4 && !srcNode.outgoing.some((x) => x.route === dst)) {
            srcNode.outgoing.push({ route: dst, title: titleByRoute.get(dst) || dst });
          }
          if (dstNode.incoming.length < 4 && !dstNode.incoming.some((x) => x.route === src)) {
            dstNode.incoming.push({ route: src, title: titleByRoute.get(src) || src });
          }
        }
      }
      docGraphLoaded = true;
    } catch {
    } finally {
      docGraphLoading = false;
    }
  }
  const pageMetaCache = new Map<string, { blocks: PreviewBlock[]; subs: SubResult[] }>();
  const pendingMetaUrls = new Set<string>();
  let lastPreviewKey = '';
  const previewStack: FlatItem[] = [];
  let copyToastTimer: number | undefined;
  let searchListAnimTimer: number | undefined;
  let lastAnimatedSearchSig = '';
  const indicatorEl = el('div', 'sl-cmdk-indicator');
  indicatorEl.setAttribute('aria-hidden', 'true');
  const tabsPillEl = el('div', 'sl-cmdk-tabs__pill');
  tabsPillEl.setAttribute('aria-hidden', 'true');
  let prevTabPillRect: { left: number; width: number; height: number } | null = null;

  function syncTabsPill(instant = false): void {
    const activeTab = tabsEl!.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!activeTab || tabsEl!.hidden) {
      tabsPillEl.style.opacity = '0';
      prevTabPillRect = null;
      return;
    }
    const left = activeTab.offsetLeft;
    const width = activeTab.offsetWidth;
    const height = activeTab.offsetHeight;
    if (!tabsPillEl.parentElement) {
      tabsEl!.prepend(tabsPillEl);
    }
    if (!instant && prevTabPillRect && (prevTabPillRect.left !== left || prevTabPillRect.width !== width)) {
      tabsPillEl.style.transition = 'none';
      tabsPillEl.style.opacity = '1';
      tabsPillEl.style.width = prevTabPillRect.width + 'px';
      tabsPillEl.style.height = prevTabPillRect.height + 'px';
      tabsPillEl.style.transform = `translate3d(${prevTabPillRect.left}px, -50%, 0)`;
      void tabsPillEl.offsetWidth;
      tabsPillEl.style.transition = '';
    } else if (instant || !prevTabPillRect) {
      tabsPillEl.style.transition = 'none';
      tabsPillEl.style.opacity = '1';
      tabsPillEl.style.width = width + 'px';
      tabsPillEl.style.height = height + 'px';
      tabsPillEl.style.transform = `translate3d(${left}px, -50%, 0)`;
      void tabsPillEl.offsetWidth;
      tabsPillEl.style.transition = '';
      prevTabPillRect = { left, width, height };
      return;
    }
    tabsPillEl.style.opacity = '1';
    tabsPillEl.style.width = width + 'px';
    tabsPillEl.style.height = height + 'px';
    tabsPillEl.style.transform = `translate3d(${left}px, -50%, 0)`;
    prevTabPillRect = { left, width, height };
  }

  function refreshMarkedUI(): void {
    listEl!.querySelectorAll<HTMLElement>('[data-cmdk-idx]').forEach((row) => {
      const item = renderedItems[Number(row.dataset.cmdkIdx)];
      const on = Boolean(item?.url && markedItems.has(normalizePath(item.url)));
      row.dataset.marked = String(on);
      const btn = row.querySelector<HTMLButtonElement>('.sl-cmdk-row__mark');
      if (btn) {
        btn.dataset.marked = String(on);
        btn.setAttribute('aria-pressed', String(on));
      }
    });
    if (statusEl) {
      statusEl.textContent =
        markedItems.size > 0
          ? isFr
            ? markedItems.size + ' sélectionné(s) · ⌘C liens · ⌘⇧C Markdown · Esc effacer'
            : markedItems.size + ' selected · ⌘C links · ⌘⇧C Markdown · Esc clear'
          : isFr
            ? 'Tapez pour rechercher dans toute la documentation'
            : 'Type to search across all documentation';
      statusEl.style.color = markedItems.size > 0 ? 'var(--sl-color-accent-high)' : '';
      statusEl.style.fontWeight = markedItems.size > 0 ? '600' : '';
    }
  }
  function toggleMarkItem(item: FlatItem | undefined, advance = false): void {
    if (!item?.url) return;
    const k = normalizePath(item.url);
    if (markedItems.has(k)) markedItems.delete(k);
    else
      markedItems.set(k, {
        title: item.title,
        url: item.url,
        section: item.section || classifySection(item.url, isFr).label,
      });
    refreshMarkedUI();
    if (advance && renderedItems.length > 0) {
      activeIndex = (activeIndex + 1) % renderedItems.length;
      updateActiveRow(true);
    }
  }
  function applyThemePreviewForItem(_item: FlatItem | undefined): void {}
  function syncSelectionIndicator(instant = false): void {
    const selected = listEl!.querySelector<HTMLElement>('[data-cmdk-idx][aria-selected="true"]');
    if (
      !selected ||
      selected.closest('.sl-cmdk-card') ||
      selected.closest('.sl-cmdk-ai-grid') ||
      selected.classList.contains('sl-cmdk-row--expand-ai')
    ) {
      indicatorEl.style.opacity = '0';
      indicatorEl.style.height = '0px';
      indicatorEl.style.transform = 'translate3d(0, 0, 0)';
      return;
    }
    if (!indicatorEl.parentElement) {
      listEl!.prepend(indicatorEl);
    }
    const listRect = listEl!.getBoundingClientRect();
    const rowRect = selected.getBoundingClientRect();
    const top = rowRect.top - listRect.top + listEl!.scrollTop;
    const left = rowRect.left - listRect.left + listEl!.scrollLeft;
    const width = rowRect.width;
    const height = rowRect.height;
    const wasHidden = indicatorEl.style.opacity === '0' || !indicatorEl.style.opacity;
    if (instant || wasHidden) {
      indicatorEl.style.transition = 'none';
    }
    indicatorEl.style.opacity = '1';
    indicatorEl.style.left = left + 'px';
    indicatorEl.style.right = 'auto';
    indicatorEl.style.width = width + 'px';
    indicatorEl.style.height = height + 'px';
    indicatorEl.style.transform = `translate3d(0, ${top}px, 0)`;
    if (instant || wasHidden) {
      void indicatorEl.offsetHeight;
      indicatorEl.style.transition = '';
    }
  }

  async function ensurePagefind(): Promise<any> {
    if (pagefind) return pagefind;
    if (pagefindFailed) return null;
    try {
      const pfUrl = '/pagefind/pagefind.js';
      const mod = await import(/* @vite-ignore */ pfUrl);
      if (typeof mod.options === 'function') {
        await mod.options({ excerptLength: 18 });
      }
      if (typeof mod.init === 'function') {
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
    const jsonEl = root?.querySelector<HTMLScriptElement>('script[data-cmdk-pages]');
    if (jsonEl?.textContent) {
      try {
        const parsed = JSON.parse(jsonEl.textContent) as SitePageEntry[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [];
  }

  function collectSidebarPages(): FlatItem[] {
    const jsonEl = root?.querySelector<HTMLScriptElement>('script[data-cmdk-pages]');
    if (jsonEl?.textContent) {
      try {
        const parsed = JSON.parse(jsonEl.textContent) as Array<{ title: string; url: string }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p) => {
            const sec = classifySection(p.url, isFr);
            return {
              type: 'nav' as const,
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
    document.querySelectorAll<HTMLAnchorElement>('nav.sidebar a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      const title = a.textContent?.replace(/\s+/g, ' ').trim() || '';
      if (!href || !title || href.startsWith('#') || seen.has(href)) return;
      seen.add(href);
      const sec = classifySection(href, isFr);
      out.push({
        type: 'nav',
        title,
        url: href,
        section: sec.label,
        sectionKey: sec.key,
        breadcrumb: formatBreadcrumb(href, isFr),
      });
    });
    for (const entry of getSitePagesRaw()) {
      if (!entry.url || seen.has(entry.url)) continue;
      if (!entry.url.includes('/changelog')) continue;
      const entryIsFr = entry.url === '/fr/' || entry.url.startsWith('/fr/');
      if (isFr ? !entryIsFr : entryIsFr) continue;
      seen.add(entry.url);
      const sec = classifySection(entry.url, isFr);
      out.push({
        type: 'nav',
        title: entry.title,
        url: entry.url,
        section: sec.label,
        sectionKey: sec.key,
        breadcrumb: formatBreadcrumb(entry.url, isFr),
      });
    }
    return out;
  }

  function fuzzyScore(q: string, t: string): number {
    q = q.trim().toLowerCase();
    if (!q) return 1;
    t = t.toLowerCase();
    if (t === q) return 120;
    if (t.startsWith(q)) return 100 - Math.min(20, t.length - q.length);
    const i = t.indexOf(q);
    if (i !== -1) return 80 - Math.min(25, i);
    let qi = 0,
      s = 0,
      c = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) {
        qi++;
        c++;
        s += 4 + c * 3;
      } else c = 0;
    }
    return qi === q.length ? Math.max(10, s - Math.floor((t.length - q.length) * 0.25)) : 0;
  }
  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function highlightFuzzyHtml(text: string, q: string): string {
    q = q.trim().toLowerCase();
    if (!q) return escapeHtml(text);
    const lo = text.toLowerCase();
    const di = lo.indexOf(q);
    if (di !== -1)
      return (
        escapeHtml(text.slice(0, di)) +
        '<mark>' +
        escapeHtml(text.slice(di, di + q.length)) +
        '</mark>' +
        escapeHtml(text.slice(di + q.length))
      );
    let qi = 0,
      out = '';
    for (let i = 0; i < text.length; i++) {
      if (qi < q.length && lo[i] === q[qi]) {
        out += '<mark>' + escapeHtml(text[i]) + '</mark>';
        qi++;
      } else out += escapeHtml(text[i]);
    }
    return qi === q.length ? out : escapeHtml(text);
  }
  async function copyItemMarkdown(item?: FlatItem): Promise<void> {
    if (!item?.url) return;
    const u = new URL(item.url, window.location.origin);
    const clean = u.pathname.replace(/\/+$/, '');
    const getMd = async (rawUrl: string) => {
      const pu = new URL(rawUrl, window.location.origin);
      const cl = pu.pathname.replace(/\/+$/, '');
      const m = cl === '' ? '/index.md' : cl === '/fr' ? '/fr.md' : cl + '.md';
      try {
        const r = await fetch(m, { credentials: 'same-origin' });
        return r.ok ? (await r.text()).trim() : '';
      } catch {
        return '';
      }
    };
    if (markedItems.size > 0) {
      const parts = (await Promise.all(Array.from(markedItems.values()).map((t) => getMd(t.url)))).filter(
        Boolean,
      );
      if (parts.length > 0) {
        await copyTextFallback(parts.join('\n\n---\n\n'));
        if (statusEl)
          statusEl.textContent = isFr
            ? parts.length + ' fichiers Markdown copiés (⌘⇧C)'
            : parts.length + ' Markdown files copied (⌘⇧C)';
      }
      return;
    }
    if (!item || !item.url) return;
    const txt = await getMd(item.url);
    if (txt) {
      await copyTextFallback(txt);
      if (statusEl) statusEl.textContent = isFr ? 'Markdown copié (⌘⇧C)' : 'Markdown copied (⌘⇧C)';
    }
  }
  function getQuickActions(): FlatItem[] {
    const actions: FlatItem[] = [
      {
        type: 'action',
        actionId: 'zen',
        title: tr('cmdk.actionZen', 'Toggle Zen Mode'),
        subtitle: 'Alt+Z',
        section: 'Action',
        excerptHtml: tr(
          'cmdk.actionZenDesc',
          'Hide sidebars and header chrome for distraction-free reading.',
        ),
      },
      {
        type: 'action',
        actionId: 'theme',
        title: tr('cmdk.actionTheme', 'Switch Color Theme (Light / Dark)'),
        subtitle: 'Theme',
        section: 'Action',
        excerptHtml: tr('cmdk.actionThemeDesc', 'Toggle immediately between light and dark color schemes.'),
      },
      {
        type: 'action',
        actionId: 'changelog',
        title: tr('cmdk.actionChangelog', 'Browse Release Changelog'),
        subtitle: 'log:',
        section: 'Action',
        excerptHtml: tr(
          'cmdk.actionChangelogDesc',
          'Filter all version release notes right inside the palette.',
        ),
      },
      {
        type: 'action',
        actionId: 'copy-md',
        title: tr('cmdk.actionCopyMd', 'Copy Current Page as Markdown'),
        subtitle: '.md',
        section: 'Action',
        excerptHtml: tr('cmdk.actionCopyMdDesc', 'Copy the clean Markdown source of the current page.'),
      },
    ];
    const langSelect = document.querySelector<HTMLSelectElement>('starlight-lang-select select');
    if (langSelect) {
      for (const opt of Array.from(langSelect.options)) {
        if (opt.selected || !opt.value) continue;
        const rawLangName = (opt.textContent || opt.label || opt.value).trim();
        const targetCode = (
          opt.getAttribute('lang') ||
          opt.value.replace(/^\/|\/$/g, '').split('/')[0] ||
          'en'
        ).toLowerCase();
        const shortCode = targetCode.toUpperCase();
        let localizedLang = rawLangName;
        try {
          const uiLocale = document.documentElement.lang || root.dataset.locale || 'en';
          const dn = new Intl.DisplayNames([uiLocale], { type: 'language' });
          localizedLang = dn.of(targetCode) || rawLangName;
        } catch {}
        actions.push({
          type: 'action',
          actionId: 'lang-switch',
          actionHref: opt.value,
          title: tr('cmdk.actionLangSwitch', 'Switch language to {lang}', { lang: localizedLang }),
          subtitle: shortCode.length <= 5 ? shortCode : rawLangName,
          section: 'Language',
          excerptHtml: tr('cmdk.actionLangSwitchDesc', 'Open this page in {lang}.', { lang: localizedLang }),
        });
      }
    }
    for (const provider of cmdkCfg.aiProviders || []) {
      actions.push({
        type: 'action',
        actionId: 'ai-provider',
        actionHref: buildAiProviderHref(provider, window.location.href),
        actionIconPath: provider.path,
        title: tr('cmdk.actionAskAi', 'Ask {provider}', { provider: provider.name }),
        shortTitle: provider.name,
        subtitle: provider.tag,
        section: 'AI',
        excerptHtml: tr(
          'cmdk.actionAskAiDesc',
          'Open {provider} ({tag}) with a summary prompt for this page.',
          { provider: provider.name, tag: provider.tag },
        ),
      });
    }
    return actions;
  }
  function copyTextFallback(text: string): Promise<void> {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } finally {
      ta.remove();
    }
    return Promise.resolve();
  }

  function normalizePath(u: string): string {
    try {
      return new URL(u, window.location.origin).pathname.replace(/\/+$/, '') || '/';
    } catch {
      return u;
    }
  }

  function updateBookmarkIconsForUrl(url: string, pinned: boolean): void {
    const targetPath = normalizePath(url);
    listEl!.querySelectorAll<HTMLAnchorElement>('a.sl-cmdk-row').forEach((row) => {
      if (normalizePath(row.href) !== targetPath) return;
      const pinBtn = row.querySelector<HTMLButtonElement>('.sl-cmdk-row__pin');
      if (!pinBtn) return;
      pinBtn.dataset.pinned = pinned ? 'true' : 'false';
      pinBtn.setAttribute(
        'aria-label',
        pinned ? (isFr ? 'Retirer des favoris' : 'Unpin page') : isFr ? 'Ajouter aux favoris' : 'Pin page',
      );
      pinBtn.replaceChildren(iconBookmark(pinned));

      pinBtn.removeAttribute('data-burst');
      void pinBtn.offsetWidth;
      if (pinned) {
        pinBtn.dataset.burst = 'true';
        window.setTimeout(() => pinBtn.removeAttribute('data-burst'), 480);
      }

      const svg = pinBtn.querySelector('svg');
      if (svg) {
        animate(
          svg,
          pinned ? { y: [0, -3.5, 0.8, 0], scale: [0.88, 1.22, 0.96, 1] } : { scale: [1, 0.86, 1] },
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
      const defaultStatus = isFr
        ? 'Tapez pour rechercher dans toute la documentation'
        : 'Type to search across all documentation';
      statusEl.textContent = pinned
        ? isFr
          ? 'Ajouté aux favoris'
          : 'Pinned to favorites'
        : isFr
          ? 'Retiré des favoris'
          : 'Removed from favorites';
      statusEl.style.color = 'var(--sl-color-accent-high)';
      statusEl.style.fontWeight = '600';
      copyToastTimer = window.setTimeout(() => {
        statusEl.textContent = defaultStatus;
        statusEl.style.color = '';
        statusEl.style.fontWeight = '';
      }, 1400);
    }

    if (!pinned && item.type === 'pinned' && !input!.value.trim()) {
      const activeRow = listEl!.querySelector<HTMLElement>('[data-cmdk-idx][aria-selected="true"]');
      if (activeRow) {
        activeRow.style.overflow = 'hidden';
        const startH = activeRow.offsetHeight;
        animate(
          activeRow,
          { height: [startH + 'px', '0px'], opacity: 0, paddingTop: '0px', paddingBottom: '0px' },
          { duration: 0.18, ease: 'easeOut' },
        ).finished.then(() => {
          const prevScroll = listEl!.scrollTop;
          renderEmptyState(true);
          activeIndex = Math.min(activeIndex, Math.max(0, renderedItems.length - 1));
          listEl!.querySelectorAll<HTMLElement>('[data-cmdk-idx]').forEach((r) => {
            r.setAttribute('aria-selected', Number(r.dataset.cmdkIdx) === activeIndex ? 'true' : 'false');
          });
          listEl!.scrollTop = prevScroll;
          renderPreview(renderedItems[activeIndex]);
        });
        return;
      }
    }

    updateBookmarkIconsForUrl(targetUrl, pinned);
    if (!input!.value.trim()) {
      const countNow = getPinnedPages().length;
      const badge = tabsEl!.querySelector<HTMLElement>('[data-empty-view="pinned"] span');
      if (badge) badge.textContent = String(countNow);
    }
    renderPreview(renderedItems[activeIndex]);
  }

  function copyItemUrl(item: FlatItem | undefined, triggerBtn?: HTMLButtonElement): void {
    if (markedItems.size > 0) {
      const urls = Array.from(markedItems.values()).map((m) => new URL(m.url, window.location.origin).href);
      copyTextFallback(urls.join('\n'))
        .then(() => {
          if (statusEl)
            statusEl.textContent = isFr ? urls.length + ' liens copiés' : urls.length + ' links copied';
        })
        .catch(() => {});
      return;
    }
    if (!item?.url) return;
    const fullUrl = new URL(item.url, window.location.origin).href;
    copyTextFallback(fullUrl)
      .then(() => {
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
      })
      .catch(() => {});
  }
  function runAction(itemOrId?: FlatItem | string): void {
    const actionId = typeof itemOrId === 'string' ? itemOrId : itemOrId?.actionId;
    const actionHref = typeof itemOrId === 'object' ? itemOrId?.actionHref : undefined;
    if (actionId === 'toggle-ai-more') {
      lastToggleClickAt = performance.now();
      aiCommandsExpanded = !aiCommandsExpanded;
      const toggleBtn = listEl!.querySelector<HTMLElement>('.sl-cmdk-row--expand-ai');
      const aiGroup = toggleBtn?.closest<HTMLElement>('.sl-cmdk-group');
      const allActions = getQuickActions();
      const aiActs = allActions.filter((a) => a.section === 'AI');
      if (aiGroup && toggleBtn && aiActs.length > 2) {
        const existingDrawer = aiGroup.querySelector('.sl-cmdk-ai-drawer');
        if (existingDrawer) existingDrawer.remove();
        const toggleIdxBefore = renderedItems.findIndex((x) => x.actionId === 'toggle-ai-more');
        if (toggleIdxBefore !== -1) {
          const extraIds = new Set(aiActs.slice(2).map((e) => e.actionId));
          const baseItems = renderedItems.slice(0, toggleIdxBefore).filter((x) => !extraIds.has(x.actionId));
          const toggleItem = renderedItems[toggleIdxBefore];
          const hiddenCount = aiActs.length - 2;
          toggleItem.title = aiCommandsExpanded
            ? tr('cmdk.lessAi', 'Show fewer AI assistants')
            : tr('cmdk.moreAi', 'Show all {total} AI assistants', {
                total: String(aiActs.length),
                count: String(hiddenCount),
              });
          toggleItem.subtitle = aiCommandsExpanded ? '−' : '+' + hiddenCount;
          if (aiCommandsExpanded) {
            const drawer = el('div', 'sl-cmdk-ai-drawer');
            drawer.dataset.open = 'true';
            const drawerInner = el('div', 'sl-cmdk-ai-drawer__inner');
            const extraGrid = el('div', 'sl-cmdk-ai-grid');
            const extraItems: FlatItem[] = [];
            for (const act of aiActs.slice(2)) {
              const idx = baseItems.length + extraItems.length;
              extraItems.push(act);
              const tile = document.createElement('button');
              tile.type = 'button';
              tile.className = 'sl-cmdk-row sl-cmdk-bento-tile';
              tile.dataset.cmdkIdx = String(idx);
              tile.setAttribute('role', 'option');
              tile.setAttribute('aria-selected', 'false');
              const left = el('span', 'sl-cmdk-bento-tile__left');
              const iconWrap = el('span', 'sl-cmdk-bento-tile__icon');
              iconWrap.append(act.actionIconPath ? iconBrandPath(act.actionIconPath) : iconZap());
              const nameEl = el('span', 'sl-cmdk-bento-tile__name', act.shortTitle || act.title);
              left.append(iconWrap);
              left.append(nameEl);
              const extWrap = el('span', 'sl-cmdk-bento-tile__ext');
              extWrap.append(iconArrowUpRight());
              tile.append(left);
              tile.append(extWrap);
              tile.addEventListener('pointermove', (ev) => {
                const rect = tile.getBoundingClientRect();
                tile.style.setProperty('--mx', ev.clientX - rect.left + 'px');
                tile.style.setProperty('--my', ev.clientY - rect.top + 'px');
              });
              extraGrid.append(tile);
            }
            drawerInner.append(extraGrid);
            drawer.append(drawerInner);
            aiGroup.insertBefore(drawer, toggleBtn);
            renderedItems = [...baseItems, ...extraItems, toggleItem];
          } else {
            renderedItems = [...baseItems, toggleItem];
          }
          const newToggleIdx = renderedItems.length - 1;
          toggleBtn.dataset.cmdkIdx = String(newToggleIdx);
          const titleNode = toggleBtn.querySelector('.sl-cmdk-row__title');
          if (titleNode) titleNode.textContent = toggleItem.title;
          const kbdNode = toggleBtn.querySelector('.sl-cmdk-kbd');
          if (kbdNode) kbdNode.textContent = toggleItem.subtitle || '';
          activeIndex = newToggleIdx;
          updateActiveRow(false);
          if (statusEl) {
            statusEl.textContent = isFr
              ? renderedItems.length + ' actions'
              : renderedItems.length + ' actions';
          }
          input!.focus({ preventScroll: true });
          return;
        }
      }
      void handleQuery();
      return;
    }
    if (actionId === 'changelog') {
      input!.value = 'log: ';
      handleQuery();
      input!.focus();
      return;
    }
    closeModal();
    if (actionId === 'zen') {
      document.querySelector<HTMLElement>('[data-zen-toggle]')?.click();
    } else if (actionId === 'theme') {
      const base = previewThemeOriginal ?? (document.documentElement.dataset.theme || 'light');
      previewThemeOriginal = null;
      const next = base === 'dark' ? 'light' : 'dark';
      const sel = document.querySelector<HTMLSelectElement>('starlight-theme-select select');
      if (sel) {
        sel.value = next;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem('starlight-theme', next);
        } catch {}
      }
    } else if (actionId === 'lang-switch' && actionHref) {
      window.location.assign(actionHref);
    } else if (actionId === 'copy-md') {
      document.querySelector<HTMLElement>('#copy-markdown')?.click();
    } else if (actionId === 'ai-provider' && actionHref) {
      window.open(actionHref, '_blank', 'noopener,noreferrer');
    }
  }
  async function hydratePagePreview(url: string): Promise<void> {
    if (pageMetaCache.has(url) || pendingMetaUrls.has(url)) return;
    pendingMetaUrls.add(url);
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) return;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const blocks: PreviewBlock[] = [];
      const isChangelogPage = url.includes('/changelog');
      let paraCount = 0;
      let codeCount = 0;
      for (const node of doc.querySelectorAll(
        isChangelogPage
          ? '.sl-markdown-content li, .sl-markdown-content p'
          : '.sl-markdown-content p, .sl-markdown-content pre, main p, main pre',
      )) {
        if (node.closest('aside, .starlight-aside, [data-pagefind-ignore]')) continue;
        if (
          (node.tagName === 'P' || (isChangelogPage && node.tagName === 'LI')) &&
          paraCount < (isChangelogPage ? 4 : 3)
        ) {
          const cleanText = node.textContent?.replace(/\s+/g, ' ').trim() || '';
          if (cleanText.length > 24) {
            blocks.push({ kind: 'p', html: node.innerHTML.replace(/\s+/g, ' ').trim() });
            paraCount += 1;
          }
        } else if (node.tagName === 'PRE' && codeCount < 1) {
          const lang = node.getAttribute('data-language') || '';
          const ecLines = Array.from(node.querySelectorAll('.ec-line .code'));
          if (ecLines.length > 0) {
            const hexRe = /^#[0-9a-fA-F]{3,8}$/;
            const lines: CodeToken[][] = [];
            for (const lineEl of ecLines.slice(0, 10)) {
              const tokens: CodeToken[] = [];
              lineEl.childNodes.forEach((child) => {
                if (child.nodeType === Node.TEXT_NODE) {
                  if (child.textContent) tokens.push({ text: child.textContent });
                } else if (child instanceof HTMLElement) {
                  if (child.classList.contains('indent')) return;
                  const text = child.textContent || '';
                  if (!text) return;
                  const c0 = child.style.getPropertyValue('--0').trim();
                  const c1 = child.style.getPropertyValue('--1').trim();
                  tokens.push({
                    text,
                    light: hexRe.test(c0) ? c0 : undefined,
                    dark: hexRe.test(c1) ? c1 : undefined,
                  });
                }
              });
              lines.push(tokens);
            }
            while (lines.length > 0 && lines.at(-1)!.every((t) => !t.text.trim())) {
              lines.pop();
            }
            if (lines.length > 0) {
              blocks.push({
                kind: 'code',
                lang,
                lines,
                text: lines.map((l) => l.map((t) => t.text).join('')).join('\n'),
              });
              codeCount += 1;
            }
          } else {
            const rawCode = node.textContent?.trim() || '';
            if (rawCode) {
              blocks.push({ kind: 'code', lang, text: rawCode.split('\n').slice(0, 10).join('\n') });
              codeCount += 1;
            }
          }
        }
        if (paraCount >= 3 && codeCount >= 1) break;
      }
      if (blocks.length === 0) {
        const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
        if (metaDesc) blocks.push({ kind: 'p', html: metaDesc });
      }
      const baseUrl = url.split('#')[0];
      const subs: SubResult[] = [];
      doc
        .querySelectorAll('.sl-markdown-content h2[id], .sl-markdown-content h3[id], main h2[id]')
        .forEach((h) => {
          if (subs.length >= 6) return;
          const id = h.getAttribute('id');
          const clone = h.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('.sl-anchor-link, [aria-hidden="true"]').forEach((n) => n.remove());
          const title = clone.textContent?.replace(/\s+/g, ' ').trim() || '';
          if (id && title) {
            subs.push({ title, url: baseUrl + '#' + id, excerpt: '' });
          }
        });
      pageMetaCache.set(url, { blocks, subs });
      const activePreviewPath = previewEl?.querySelector<HTMLElement>('.sl-cmdk-preview__path')?.textContent;
      if (renderedItems[activeIndex]?.url === url || activePreviewPath === url) {
        const currentPreviewItem =
          previewEl?.querySelector<HTMLElement>('.sl-cmdk-preview__path')?.textContent === url &&
          renderedItems[activeIndex]?.url !== url
            ? {
                type: 'nav' as const,
                title: previewEl?.querySelector<HTMLElement>('.sl-cmdk-preview__title')?.textContent || url,
                url,
                section: classifySection(url, isFr).label,
                sectionKey: classifySection(url, isFr).key,
                breadcrumb: formatBreadcrumb(url, isFr),
              }
            : renderedItems[activeIndex];
        renderPreview(currentPreviewItem);
      }
    } catch {
      pageMetaCache.set(url, { blocks: [], subs: [] });
    } finally {
      pendingMetaUrls.delete(url);
    }
  }

  function renderPreview(item: FlatItem | undefined): void {
    if (!previewEl) return;
    previewEl.replaceChildren();
    if (!item) {
      lastPreviewKey = '';
      const empty = el(
        'div',
        'sl-cmdk-empty',
        isFr ? 'Sélectionnez un élément pour l’aperçu' : 'Select an item to preview',
      );
      previewEl.append(empty);
      return;
    }
    const nextPreviewKey = (item.url || '') + '::' + item.title;
    lastPreviewKey = nextPreviewKey;

    const cachedMeta = item.url ? pageMetaCache.get(item.url) : undefined;
    if (item.url && !cachedMeta) {
      void hydratePagePreview(item.url);
    }

    const top = el('div', 'sl-cmdk-preview__top');
    if (previewStack.length > 0) {
      const prevItem = previewStack.at(-1)!;
      const backBtn = el('button', 'sl-cmdk-preview__back');
      backBtn.type = 'button';
      backBtn.dataset.previewBack = 'true';
      backBtn.textContent = (isFr ? '← Retour à ' : '← Back to ') + prevItem.title;
      top.append(backBtn);
    }
    const eyebrow = el('div', 'sl-cmdk-preview__eyebrow');
    eyebrow.append(
      item.actionIconPath
        ? iconBrandPath(item.actionIconPath)
        : item.type === 'action'
          ? actionSemanticIcon(item.actionId)
          : item.type === 'sub'
            ? iconHash()
            : sectionIcon(item.sectionKey),
    );
    eyebrow.append(
      document.createTextNode(
        item.section || (item.type === 'recent' ? (isFr ? 'Recherche récente' : 'Recent query') : 'Docs'),
      ),
    );
    top.append(eyebrow);

    top.append(el('h3', 'sl-cmdk-preview__title', item.title));
    if (item.url) {
      top.append(el('div', 'sl-cmdk-preview__path', item.url));
    }

    const appendSafe = (node: Node, target: HTMLElement): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const parts = text.split(/(`[^`]+`)/g);
        for (const part of parts) {
          if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            target.append(el('code', undefined, part.slice(1, -1)));
          } else if (part) {
            target.append(document.createTextNode(part));
          }
        }
      } else if (node instanceof HTMLElement) {
        if (node.tagName === 'CODE') {
          target.append(el('code', undefined, node.textContent || ''));
        } else {
          node.childNodes.forEach((child) => appendSafe(child, target));
        }
      }
    };

    if (item.excerptHtml) {
      const excerpt = el('p', 'sl-cmdk-preview__excerpt');
      appendHighlightedExcerpt(excerpt, item.excerptHtml);
      top.append(excerpt);
    }
    if (item.type === 'action') {
      if (item.actionId === 'theme') {
        const curTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
        const nextTheme = curTheme === 'dark' ? 'light' : 'dark';
        const card = el('div', 'sl-cmdk-preview__meta-card');
        card.append(
          el(
            'div',
            'sl-cmdk-preview__meta-label',
            isFr ? 'Basculer vers le thème cible' : 'Target color scheme',
          ),
        );
        const swatches = el('div', 'sl-cmdk-theme-swatches');
        const lightSw = el('div', 'sl-cmdk-theme-swatch sl-cmdk-theme-swatch--light');
        lightSw.dataset.target = String(nextTheme === 'light');
        lightSw.append(el('span', undefined, isFr ? 'Clair' : 'Light'));
        lightSw.append(
          el(
            'span',
            'sl-cmdk-theme-swatch__tag',
            curTheme === 'light' ? (isFr ? 'Actuel' : 'Current') : isFr ? 'Suivant' : 'Next',
          ),
        );
        const darkSw = el('div', 'sl-cmdk-theme-swatch sl-cmdk-theme-swatch--dark');
        darkSw.dataset.target = String(nextTheme === 'dark');
        darkSw.append(el('span', undefined, isFr ? 'Sombre' : 'Dark'));
        darkSw.append(
          el(
            'span',
            'sl-cmdk-theme-swatch__tag',
            curTheme === 'dark' ? (isFr ? 'Actuel' : 'Current') : isFr ? 'Suivant' : 'Next',
          ),
        );
        swatches.append(lightSw);
        swatches.append(darkSw);
        card.append(swatches);
        top.append(card);
      } else if (item.actionId === 'ai-provider') {
        const card = el('div', 'sl-cmdk-preview__meta-card');
        card.append(
          el('div', 'sl-cmdk-preview__meta-label', isFr ? 'Prompt pré-rempli' : 'Pre-filled prompt'),
        );
        const pageTitle = document.title.split('|')[0].trim() || window.location.pathname;
        const promptPreview = isFr
          ? `Résume « ${pageTitle} » (${window.location.href}) et explique les points clés.`
          : `Summarize "${pageTitle}" (${window.location.href}) and explain the key takeaways.`;
        card.append(el('div', 'sl-cmdk-preview__prompt-box', promptPreview));
        top.append(card);
      } else if (item.subtitle && item.actionId !== 'toggle-ai-more') {
        const card = el('div', 'sl-cmdk-preview__meta-card');
        card.append(
          el('div', 'sl-cmdk-preview__meta-label', isFr ? 'Raccourci ou déclencheur' : 'Shortcut / trigger'),
        );
        const kbdRow = el('div', undefined);
        kbdRow.append(el('kbd', 'sl-cmdk-kbd', item.subtitle));
        card.append(kbdRow);
        top.append(card);
      } else if (item.url && item.actionId !== 'toggle-ai-more') {
        const card = el('div', 'sl-cmdk-preview__meta-card');
        card.append(el('div', 'sl-cmdk-preview__meta-label', isFr ? 'Destination' : 'Destination'));
        card.append(el('div', 'sl-cmdk-preview__prompt-box', item.url));
        top.append(card);
      }
    } else if (cachedMeta && cachedMeta.blocks.length > 0) {
      for (const blk of cachedMeta.blocks) {
        if (blk.kind === 'code' && (blk.lines?.length || blk.text)) {
          const wrap = el('div', 'sl-cmdk-preview__code-wrap');
          const head = el('div', 'sl-cmdk-preview__code-head');
          head.append(el('span', 'sl-cmdk-preview__code-lang', blk.lang || 'code'));
          if (blk.text) {
            const copyCodeBtn = el('button', 'sl-cmdk-preview__code-copy');
            copyCodeBtn.type = 'button';
            copyCodeBtn.setAttribute('aria-label', isFr ? 'Copier le code' : 'Copy code');
            const setCopyIdle = () => {
              copyCodeBtn.dataset.copied = 'false';
              copyCodeBtn.replaceChildren(
                iconCopy(),
                el('span', undefined, isFr ? 'Copier' : 'Copy'),
                el('kbd', 'sl-cmdk-kbd sl-cmdk-preview__code-kbd', '⌥C'),
              );
            };
            setCopyIdle();
            let codeCopyTimer: number | undefined;
            copyCodeBtn.addEventListener('click', () => {
              void copyTextFallback(blk.text!).then(() => {
                copyCodeBtn.dataset.copied = 'true';
                copyCodeBtn.replaceChildren(iconCheck(), el('span', undefined, isFr ? 'Copié' : 'Copied'));
                if (codeCopyTimer) window.clearTimeout(codeCopyTimer);
                codeCopyTimer = window.setTimeout(setCopyIdle, 1200);
              });
            });
            head.append(copyCodeBtn);
          }
          wrap.append(head);
          const pre = el('pre', 'sl-cmdk-preview__code');
          if (blk.lines && blk.lines.length > 0) {
            const code = el('code');
            blk.lines.forEach((lineTokens, lineIdx) => {
              if (lineIdx > 0) code.append(document.createTextNode('\n'));
              for (const tok of lineTokens) {
                if (tok.light || tok.dark) {
                  const span = el('span', 'sl-cmdk-ec-tok', tok.text);
                  if (tok.light) span.style.setProperty('--ec-0', tok.light);
                  if (tok.dark) span.style.setProperty('--ec-1', tok.dark);
                  code.append(span);
                } else {
                  code.append(document.createTextNode(tok.text));
                }
              }
            });
            pre.append(code);
          } else if (blk.text) {
            pre.textContent = blk.text;
          }
          wrap.append(pre);
          top.append(wrap);
        } else if (blk.kind === 'p' && blk.html) {
          const excerpt = el('p', 'sl-cmdk-preview__excerpt');
          const parsed = new DOMParser().parseFromString(blk.html, 'text/html');
          parsed.body.childNodes.forEach((n) => appendSafe(n, excerpt));
          top.append(excerpt);
        }
      }
    } else if (item.breadcrumb) {
      top.append(el('p', 'sl-cmdk-preview__excerpt', item.breadcrumb));
    }

    const effectiveSubs = item.subResults || cachedMeta?.subs;
    if (effectiveSubs && effectiveSubs.length > 0) {
      const subsBox = el('div', 'sl-cmdk-preview__subs');
      subsBox.append(el('div', 'sl-cmdk-preview__subs-label', isFr ? 'Sections de la page' : 'On this page'));
      effectiveSubs.forEach((sub, subIdx) => {
        const a = el('a', 'sl-cmdk-preview__sub-link');
        a.href = sub.url;
        a.dataset.subJump = String(subIdx + 1);
        const left = el('span', 'sl-cmdk-preview__sub-left');
        left.append(iconHash());
        left.append(document.createTextNode(sub.title));
        a.append(left);
        a.append(el('kbd', 'sl-cmdk-kbd', '^' + String(subIdx + 1)));
        subsBox.append(a);
      });
      top.append(subsBox);
    }

    const graphInfo = item.url ? docGraphMap.get(normalizePath(item.url)) : undefined;
    if (graphInfo && (graphInfo.outgoing.length > 0 || graphInfo.incoming.length > 0)) {
      const graphBox = el('div', 'sl-cmdk-preview__subs sl-cmdk-preview__graph');
      graphBox.append(
        el('div', 'sl-cmdk-preview__subs-label', tr('cmdk.graphConnections', 'Connected pages')),
      );
      let graphJumpIdx = 0;
      const appendGraphLink = (ref: { route: string; title: string }, dir: 'out' | 'in') => {
        graphJumpIdx += 1;
        const a = el('a', 'sl-cmdk-preview__sub-link sl-cmdk-preview__graph-link');
        a.href = ref.route;
        a.dataset.graphJump = String(graphJumpIdx);
        a.dataset.graphTitle = ref.title;
        const left = el('span', 'sl-cmdk-preview__sub-left');
        left.append(document.createTextNode((dir === 'out' ? '→ ' : '← ') + ref.title));
        a.append(left);
        a.append(el('kbd', 'sl-cmdk-kbd', '⌥' + String(graphJumpIdx)));
        graphBox.append(a);
      };
      for (const outRef of graphInfo.outgoing.slice(0, 3)) appendGraphLink(outRef, 'out');
      for (const inRef of graphInfo.incoming.slice(0, 3)) appendGraphLink(inRef, 'in');
      top.append(graphBox);
    }

    previewEl.append(top);

    const actions = el('div', 'sl-cmdk-preview__actions');
    if (item.url) {
      const openLink = el(
        'a',
        'sl-cmdk-preview__btn sl-cmdk-preview__btn--primary',
        isFr ? 'Ouvrir la page' : 'Open page',
      );
      openLink.href = item.url;
      actions.append(openLink);

      const copyBtn = el('button', 'sl-cmdk-preview__btn');
      copyBtn.type = 'button';
      copyBtn.append(iconCopy());
      copyBtn.append(document.createTextNode(isFr ? 'Copier' : 'Copy link'));
      copyBtn.addEventListener('click', () => copyItemUrl(item, copyBtn));
      actions.append(copyBtn);
    } else {
      const runBtn = el(
        'button',
        'sl-cmdk-preview__btn sl-cmdk-preview__btn--primary',
        isFr ? 'Exécuter' : 'Run',
      );
      runBtn.type = 'button';
      runBtn.addEventListener('click', () => activateItem(item));
      actions.append(runBtn);
    }
    previewEl.append(actions);
  }

  function renderTabs(results: PagefindData[]): void {
    tabsEl!.replaceChildren();
    if (!input!.value.trim() || results.length === 0) {
      tabsEl!.hidden = true;
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
    tabsEl!.hidden = false;
    tabsEl!.dataset.collapsed = 'false';
    for (const [key, info] of counts.entries()) {
      const btn = el('button', 'sl-cmdk-tab');
      btn.type = 'button';
      btn.dataset.filter = key;
      btn.setAttribute('aria-selected', String(key === activeFilter));
      btn.append(document.createTextNode(info.label + ' '));
      btn.append(el('span', undefined, String(info.count)));
      tabsEl!.append(btn);
    }
    requestAnimationFrame(() => syncTabsPill(false));
  }
  function updateActiveRow(shouldScroll = true): void {
    const rows = listEl!.querySelectorAll<HTMLElement>('[data-cmdk-idx]');
    rows.forEach((row) => {
      const idx = Number(row.dataset.cmdkIdx);
      const selected = idx === activeIndex;
      row.setAttribute('aria-selected', selected ? 'true' : 'false');
      if (selected && shouldScroll) {
        row.scrollIntoView({ block: 'nearest' });
      }
    });

    previewStack.length = 0;
    applyThemePreviewForItem(renderedItems[activeIndex]);
    updateContextualChrome();
    renderPreview(renderedItems[activeIndex]);
    syncSelectionIndicator(false);
  }
  function actionSemanticIcon(actionId?: string): SVGSVGElement {
    if (actionId === 'zen') {
      return lucideIcon([
        ['polyline', { points: '15 3 21 3 21 9' }],
        ['polyline', { points: '9 21 3 21 3 15' }],
        ['line', { x1: '21', y1: '3', x2: '14', y2: '10' }],
        ['line', { x1: '3', y1: '21', x2: '10', y2: '14' }],
      ]);
    }
    if (actionId === 'theme') {
      return lucideIcon([
        ['circle', { cx: '12', cy: '12', r: '4' }],
        ['path', { d: 'M12 2v2' }],
        ['path', { d: 'M12 20v2' }],
        ['path', { d: 'm4.93 4.93 1.41 1.41' }],
        ['path', { d: 'm17.66 17.66 1.41 1.41' }],
        ['path', { d: 'M2 12h2' }],
        ['path', { d: 'M20 12h2' }],
        ['path', { d: 'm6.34 17.66-1.41 1.41' }],
        ['path', { d: 'm19.07 4.93-1.41 1.41' }],
      ]);
    }
    if (actionId === 'changelog') {
      return lucideIcon([
        ['path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }],
        ['path', { d: 'M3 3v5h5' }],
        ['path', { d: 'M12 7v5l4 2' }],
      ]);
    }
    if (actionId === 'copy-md') {
      return lucideIcon([
        ['path', { d: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z' }],
        ['polyline', { points: '14 2 14 8 20 8' }],
        ['path', { d: 'm10 13-2 2 2 2' }],
        ['path', { d: 'm14 17 2-2-2-2' }],
      ]);
    }
    if (actionId === 'lang-switch') {
      return lucideIcon([
        ['circle', { cx: '12', cy: '12', r: '10' }],
        ['path', { d: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' }],
        ['path', { d: 'M2 12h20' }],
      ]);
    }
    if (actionId === 'toggle-ai-more') {
      return lucideIcon([
        [
          'path',
          {
            d: 'm12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z',
          },
        ],
      ]);
    }
    return iconZap();
  }

  function makeRow(opts: {
    idx: number;
    href?: string;
    extraClass?: string;
    icon: SVGSVGElement;
    iconClass?: string;
    title: string;
    titleHtml?: string;
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
    iconBox.append(opts.icon);
    row.append(iconBox);
    const body = el('span', 'sl-cmdk-row__body');
    const head = el('span', 'sl-cmdk-row__head');
    const titleEl = el('span', 'sl-cmdk-row__title');
    if (opts.titleHtml) {
      appendHighlightedExcerpt(titleEl, opts.titleHtml);
    } else {
      appendHighlightedText(titleEl, opts.title, input!.value);
    }
    head.append(titleEl);
    body.append(head);
    if (opts.breadcrumb) {
      const crumbEl = el('span', 'sl-cmdk-row__crumb');
      appendHighlightedText(crumbEl, opts.breadcrumb, input!.value);
      body.append(crumbEl);
    }
    if (opts.excerptHtml) {
      const excerptEl = el('span', 'sl-cmdk-row__excerpt');
      appendHighlightedExcerpt(excerptEl, opts.excerptHtml);
      body.append(excerptEl);
    }
    row.append(body);
    const trail = el('span', 'sl-cmdk-row__trail');
    if (opts.badge) {
      trail.append(el('span', 'sl-cmdk-row__badge', opts.badge));
    }
    if (opts.kbd) {
      trail.append(el('kbd', 'sl-cmdk-kbd', opts.kbd));
    }
    if (opts.showArrow) {
      const pinned = opts.href && opts.href !== '#' ? isPagePinned(opts.href) : false;
      if (opts.href && opts.href !== '#') {
        const on = markedItems.has(normalizePath(opts.href));
        row.dataset.marked = String(on);
        const markBtn = el('button', 'sl-cmdk-row__mark');
        markBtn.type = 'button';
        markBtn.dataset.markIdx = String(opts.idx);
        markBtn.dataset.marked = String(on);
        markBtn.setAttribute('aria-pressed', String(on));
        markBtn.setAttribute('aria-label', isFr ? 'Sélectionner' : 'Select');
        markBtn.textContent = '✓';
        trail.append(markBtn);
        const pinStar = el('button', 'sl-cmdk-row__pin');
        pinStar.type = 'button';
        pinStar.dataset.pinIdx = String(opts.idx);
        pinStar.dataset.pinned = pinned ? 'true' : 'false';
        pinStar.setAttribute(
          'aria-label',
          pinned ? (isFr ? 'Retirer des favoris' : 'Unpin page') : isFr ? 'Ajouter aux favoris' : 'Pin page',
        );
        pinStar.append(iconBookmark(pinned));
        trail.append(pinStar);
      }
      const arrowBox = el('span', 'sl-cmdk-row__arrow');
      arrowBox.append(iconArrowUpRight());
      trail.append(arrowBox);
    }
    if (trail.childNodes.length > 0) {
      row.append(trail);
    }
    return row;
  }
  function renderEmptyState(skipEntrance = false): void {
    const pinnedPages = getPinnedPages();
    const pinnedCount = pinnedPages.length;
    const allPages = collectSidebarPages();
    const catMap = new Map<string, { key: string; label: string; count: number }>();
    for (const p of allPages) {
      const sec = classifySection(p.url || '/', isFr);
      const prev = catMap.get(sec.key);
      if (prev) prev.count += 1;
      else catMap.set(sec.key, { key: sec.key, label: sec.label, count: 1 });
    }

    const validFilters = new Set(['all', 'pinned', ...catMap.keys()]);
    if (!validFilters.has(activeFilter)) activeFilter = 'all';

    tabsEl!.hidden = false;
    tabsEl!.dataset.collapsed = 'false';
    tabsEl!.replaceChildren();

    const makeEmptyTab = (filterKey: string, label: string, count?: number): HTMLButtonElement => {
      const btn = el('button', 'sl-cmdk-tab');
      btn.type = 'button';
      btn.dataset.emptyView = filterKey;
      btn.setAttribute('aria-selected', String(activeFilter === filterKey));
      btn.append(document.createTextNode(label));
      if (typeof count === 'number') {
        btn.append(document.createTextNode(' '));
        btn.append(el('span', undefined, String(count)));
      }
      return btn;
    };

    tabsEl!.append(makeEmptyTab('all', isFr ? 'Tout' : 'All'));
    tabsEl!.append(makeEmptyTab('pinned', isFr ? 'Favoris' : 'Pinned', pinnedCount));
    for (const cat of catMap.values()) {
      tabsEl!.append(makeEmptyTab(cat.key, cat.label, cat.count));
    }
    requestAnimationFrame(() => syncTabsPill(false));

    listEl!.replaceChildren();
    renderedItems = [];

    if (activeFilter === 'pinned') {
      if (pinnedPages.length === 0) {
        const empty = el(
          'div',
          'sl-cmdk-empty',
          isFr
            ? 'Aucune page favorite. Appuyez sur ⌘D pour en épingler une.'
            : 'No pinned pages yet. Press ⌘D or click the bookmark icon to pin a page.',
        );
        listEl!.append(empty);
        renderPreview(undefined);
        if (!skipEntrance) animateListCards();
        if (statusEl) statusEl.textContent = isFr ? '0 page favorite' : '0 pinned pages';
        return;
      }
      const group = el('div', 'sl-cmdk-group');
      const header = el('div', 'sl-cmdk-group__title');
      header.append(el('span', undefined, isFr ? 'Pages favorites' : 'Pinned pages'));
      group.append(header);
      for (const pp of pinnedPages) {
        const idx = renderedItems.length;
        const sec = classifySection(pp.url, isFr);
        renderedItems.push({
          type: 'pinned',
          title: pp.title,
          url: pp.url,
          section: pp.section || sec.label,
          sectionKey: sec.key,
          breadcrumb: formatBreadcrumb(pp.url, isFr),
        });
        group.append(
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
      listEl!.append(group);
      renderPreview(renderedItems.at(activeIndex));
      requestAnimationFrame(() => syncSelectionIndicator(true));
      if (statusEl) {
        statusEl.textContent = isFr
          ? pinnedPages.length +
            ' page' +
            (pinnedPages.length > 1 ? 's' : '') +
            ' favorite' +
            (pinnedPages.length > 1 ? 's' : '')
          : pinnedPages.length + ' pinned page' + (pinnedPages.length > 1 ? 's' : '');
      }
      return;
    }

    if (activeFilter !== 'all' && catMap.has(activeFilter)) {
      const cat = catMap.get(activeFilter)!;
      const filteredPages = allPages.filter((p) => classifySection(p.url || '/', isFr).key === activeFilter);
      const group = el('div', 'sl-cmdk-group');
      const header = el('div', 'sl-cmdk-group__title');
      header.append(el('span', undefined, cat.label));
      group.append(header);
      for (const page of filteredPages) {
        const idx = renderedItems.length;
        const item: FlatItem = {
          ...page,
          section: cat.label,
          sectionKey: cat.key,
          breadcrumb: formatBreadcrumb(page.url || '/', isFr),
        };
        renderedItems.push(item);
        group.append(
          makeRow({
            idx,
            href: item.url || '/',
            icon: sectionIcon(cat.key),
            title: item.title,
            breadcrumb: item.breadcrumb,
            badge: cat.label,
            showArrow: true,
          }),
        );
      }
      listEl!.append(group);
      renderPreview(renderedItems.at(activeIndex));
      if (!skipEntrance) animateListCards();
      if (statusEl) {
        statusEl.textContent = isFr
          ? cat.label + ' · ' + filteredPages.length + ' page' + (filteredPages.length > 1 ? 's' : '')
          : cat.label + ' · ' + filteredPages.length + ' page' + (filteredPages.length > 1 ? 's' : '');
      }
      return;
    }

    const recentPages = getRecentPages();
    if (recentPages.length > 0) {
      const group = el('div', 'sl-cmdk-group');
      const header = el('div', 'sl-cmdk-group__title');
      header.append(el('span', undefined, isFr ? 'Pages récentes' : 'Recent pages'));
      const clearBtnEl = el('button', 'sl-cmdk-clear-recent', isFr ? 'Effacer' : 'Clear');
      clearBtnEl.type = 'button';
      clearBtnEl.dataset.clearRecent = 'true';
      header.append(clearBtnEl);
      group.append(header);
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
        group.append(
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
      listEl!.append(group);
    }
    const recents = getRecent();
    if (recents.length > 0) {
      const group = el('div', 'sl-cmdk-group');
      const header = el('div', 'sl-cmdk-group__title');
      header.append(el('span', undefined, isFr ? 'Recherches récentes' : 'Recent searches'));
      if (recentPages.length === 0) {
        const clearRecentBtn = el('button', 'sl-cmdk-clear-recent', isFr ? 'Effacer' : 'Clear');
        clearRecentBtn.type = 'button';
        clearRecentBtn.dataset.clearRecent = 'true';
        header.append(clearRecentBtn);
      }
      group.append(header);
      for (const q of recents) {
        const idx = renderedItems.length;
        renderedItems.push({ type: 'recent', title: q, query: q });
        group.append(
          makeRow({
            idx,
            icon: iconHistory(),
            title: q,
            badge: isFr ? 'Récent' : 'Recent',
          }),
        );
      }
      listEl!.append(group);
    }
    const actionGroup = el('div', 'sl-cmdk-group');
    const actionHeader = el('div', 'sl-cmdk-group__title');
    actionHeader.append(el('span', undefined, isFr ? 'Actions rapides' : 'Quick actions'));
    actionGroup.append(actionHeader);
    for (const act of getQuickActions().filter((a) => a.actionId !== 'ai-provider')) {
      const idx = renderedItems.length;
      renderedItems.push(act);
      actionGroup.append(
        makeRow({
          idx,
          icon: act.actionIconPath ? iconBrandPath(act.actionIconPath) : actionSemanticIcon(act.actionId),
          title: act.title,
          kbd: act.subtitle,
        }),
      );
    }
    listEl!.append(actionGroup);
    const pages = collectSidebarPages();
    if (pages.length > 0) {
      const navGroup = el('div', 'sl-cmdk-group');
      const navHeader = el('div', 'sl-cmdk-group__title');
      navHeader.append(el('span', undefined, isFr ? 'Navigation rapide' : 'Jump to page'));
      navGroup.append(navHeader);
      for (const p of pages) {
        const idx = renderedItems.length;
        renderedItems.push(p);
        navGroup.append(
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
      listEl!.append(navGroup);
    }
    updateContextualChrome();
    renderPreview(renderedItems[activeIndex]);
    requestAnimationFrame(() => syncSelectionIndicator(true));
    const searchSig = input!.value.trim() + '::' + activeFilter + '::' + renderedItems.length;
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
  function renderSearchResults(_skipEntrance = false): void {
    renderTabs(currentResults);
    listEl!.replaceChildren();
    const qLow = input!.value.trim().toLowerCase();
    const matchedActions =
      activeFilter === 'all'
        ? getQuickActions().filter(
            (a) =>
              a.title.toLowerCase().includes(qLow) || (a.subtitle && a.subtitle.toLowerCase().includes(qLow)),
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
      actionHeader.append(el('span', undefined, isFr ? 'Commandes correspondantes' : 'Matching commands'));
      actionGroup.append(actionHeader);
      for (const act of matchedActions) {
        const idx = renderedItems.length;
        renderedItems.push(act);
        actionGroup.append(
          makeRow({
            idx,
            icon: act.actionIconPath ? iconBrandPath(act.actionIconPath) : actionSemanticIcon(act.actionId),
            title: act.title,
            kbd: act.subtitle,
          }),
        );
      }
      listEl!.append(actionGroup);
    }
    if (filtered.length === 0 && matchedActions.length === 0) {
      const empty = el('div', 'sl-cmdk-empty');
      empty.append(document.createTextNode(isFr ? 'Aucun résultat pour « ' : 'No results found for “'));
      empty.append(el('strong', undefined, input!.value.trim()));
      empty.append(document.createTextNode(isFr ? ' »' : '”'));
      listEl!.append(empty);
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
      card.append(
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
        card.append(
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
      listEl!.append(card);
    }
    renderPreview(renderedItems[activeIndex]);
    requestAnimationFrame(() => syncSelectionIndicator(true));
    const searchSig = input!.value.trim() + '::' + activeFilter + '::' + renderedItems.length;
    if (searchListAnimTimer) window.clearTimeout(searchListAnimTimer);
    if (searchSig !== lastAnimatedSearchSig) {
      searchListAnimTimer = window.setTimeout(() => {
        lastAnimatedSearchSig = searchSig;
        animateListCards();
      }, 190);
    }
    if (statusEl) {
      statusEl.textContent = isFr
        ? filtered.length +
          ' page' +
          (filtered.length > 1 ? 's' : '') +
          ' trouvée' +
          (filtered.length > 1 ? 's' : '')
        : filtered.length + ' matching page' + (filtered.length > 1 ? 's' : '');
    }
  }
  function parseScopedQuery(raw: string): { scope?: string; query: string } {
    const m = /^(docs|guides?|ref|reference|blog|logs?):\s*(.*)$/i.exec(raw);
    if (!m) return { query: raw };
    const token = m[1].toLowerCase();
    const scope =
      token === 'guide' || token === 'guides'
        ? 'guides'
        : token === 'ref' || token === 'reference'
          ? 'reference'
          : token === 'log' || token === 'logs'
            ? 'changelog'
            : token;
    return { scope, query: m[2].trim() };
  }

  async function handleQuery(_preserveScrollTop?: number): Promise<void> {
    const rawTyped = input!.value;
    if (!activeModePrefix) {
      if (rawTyped.startsWith('/')) {
        activeModePrefix = '/';
        input!.value = rawTyped.slice(1);
      } else if (rawTyped.startsWith('#')) {
        activeModePrefix = '#';
        input!.value = rawTyped.slice(1);
      } else {
        const scopeMatch = /^(docs|guides?|ref|reference|blog|logs?):\s*(.*)$/i.exec(rawTyped);
        if (scopeMatch) {
          activeModePrefix = scopeMatch[1].toLowerCase() + ':';
          input!.value = scopeMatch[2];
        }
      }
    }
    const q = (activeModePrefix ? activeModePrefix + input!.value : input!.value).trim();
    if (clearBtn) {
      const vis = q.length > 0;
      clearBtn.dataset.visible = vis ? 'true' : 'false';
      clearBtn.tabIndex = vis ? 0 : -1;
      clearBtn.setAttribute('aria-hidden', vis ? 'false' : 'true');
    }
    activeIndex = 0;
    updateContextualChrome();
    if (!q) {
      currentResults = [];
      activeFilter = 'all';
      renderEmptyState();
      return;
    }

    if (q.startsWith('/') || q.startsWith('>')) {
      const cmdQ = q.slice(1).trim().toLowerCase();
      tabsEl!.hidden = true;
      tabsEl!.dataset.collapsed = 'true';
      tabsEl!.replaceChildren();
      listEl!.replaceChildren();
      renderedItems = [];
      const allActions = getQuickActions();
      const renderActionRow = (act: FlatItem, extraClass?: string): HTMLElement => {
        const idx = renderedItems.length;
        renderedItems.push(act);
        const row = makeRow({
          idx,
          icon: act.actionIconPath ? iconBrandPath(act.actionIconPath) : actionSemanticIcon(act.actionId),
          title: act.title,
          titleHtml: cmdQ ? highlightFuzzyHtml(act.title, cmdQ) : undefined,
          kbd: act.subtitle,
        });
        if (extraClass) row.classList.add(extraClass);
        return row;
      };
      const renderBentoTile = (act: FlatItem): HTMLElement => {
        const idx = renderedItems.length;
        renderedItems.push(act);
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'sl-cmdk-row sl-cmdk-bento-tile';
        tile.dataset.cmdkIdx = String(idx);
        tile.setAttribute('role', 'option');
        tile.setAttribute('aria-selected', 'false');

        const left = el('span', 'sl-cmdk-bento-tile__left');
        const iconWrap = el('span', 'sl-cmdk-bento-tile__icon');
        iconWrap.append(act.actionIconPath ? iconBrandPath(act.actionIconPath) : iconZap());
        const nameEl = el('span', 'sl-cmdk-bento-tile__name');
        const displayTitle = act.shortTitle || act.title;
        if (cmdQ) {
          appendHighlightedExcerpt(nameEl, highlightFuzzyHtml(displayTitle, cmdQ));
        } else {
          nameEl.textContent = displayTitle;
        }
        left.append(iconWrap);
        left.append(nameEl);

        const extWrap = el('span', 'sl-cmdk-bento-tile__ext');
        extWrap.append(iconArrowUpRight());

        tile.append(left);
        tile.append(extWrap);

        tile.addEventListener('pointermove', (ev) => {
          const rect = tile.getBoundingClientRect();
          tile.style.setProperty('--mx', ev.clientX - rect.left + 'px');
          tile.style.setProperty('--my', ev.clientY - rect.top + 'px');
        });
        return tile;
      };

      if (!cmdQ) {
        const workspaceActs = allActions.filter((a) => a.section === 'Action');
        const langActs = allActions.filter((a) => a.section === 'Language');
        const aiActs = allActions.filter((a) => a.section === 'AI');
        if (workspaceActs.length > 0) {
          const g = el('div', 'sl-cmdk-group');
          const h = el('div', 'sl-cmdk-group__title');
          h.append(el('span', undefined, tr('cmdk.groupWorkspace', 'Workspace & Navigation')));
          g.append(h);
          for (const act of workspaceActs) g.append(renderActionRow(act));
          listEl!.append(g);
        }
        if (langActs.length > 0) {
          const g = el('div', 'sl-cmdk-group');
          const h = el('div', 'sl-cmdk-group__title');
          h.append(el('span', undefined, tr('cmdk.groupLanguage', 'Language')));
          g.append(h);
          for (const act of langActs) g.append(renderActionRow(act));
          listEl!.append(g);
        }
        if (aiActs.length > 0) {
          const g = el('div', 'sl-cmdk-group');
          const h = el('div', 'sl-cmdk-group__title');
          h.append(el('span', undefined, tr('cmdk.groupAi', 'Ask AI Assistant')));
          h.append(el('span', 'sl-cmdk-group__count', String(aiActs.length)));
          g.append(h);
          const primaryGrid = el('div', 'sl-cmdk-ai-grid');
          for (const act of aiActs.slice(0, 2)) primaryGrid.append(renderBentoTile(act));
          g.append(primaryGrid);
          if (aiCommandsExpanded && aiActs.length > 2) {
            const drawer = el('div', 'sl-cmdk-ai-drawer');
            drawer.dataset.open = 'false';
            const drawerInner = el('div', 'sl-cmdk-ai-drawer__inner');
            const extraGrid = el('div', 'sl-cmdk-ai-grid');
            for (const act of aiActs.slice(2)) extraGrid.append(renderBentoTile(act));
            drawerInner.append(extraGrid);
            drawer.append(drawerInner);
            g.append(drawer);
            requestAnimationFrame(() => {
              drawer.dataset.open = 'true';
            });
          }
          if (aiActs.length > 2) {
            const hiddenCount = aiActs.length - 2;
            const toggleItem: FlatItem = {
              type: 'action',
              actionId: 'toggle-ai-more',
              title: aiCommandsExpanded
                ? tr('cmdk.lessAi', 'Show fewer AI assistants')
                : tr('cmdk.moreAi', 'Show all {total} AI assistants', {
                    total: String(aiActs.length),
                    count: String(hiddenCount),
                  }),
              subtitle: aiCommandsExpanded ? '−' : '+' + hiddenCount,
              section: tr('cmdk.groupAi', 'Ask AI Assistant'),
              excerptHtml: aiActs.map((x) => x.shortTitle || x.title).join(' · '),
            };
            g.append(renderActionRow(toggleItem, 'sl-cmdk-row--expand-ai'));
          }
          listEl!.append(g);
        }
        activeIndex = 0;
        updateContextualChrome();
        applyThemePreviewForItem(renderedItems[0]);
        renderPreview(renderedItems[0]);
        syncSelectionIndicator(true);
        if (statusEl) {
          statusEl.textContent = renderedItems.length + ' actions';
        }
        return;
      }
      const matchedActions = allActions
        .map((a) => ({
          a,
          s: Math.max(fuzzyScore(cmdQ, a.title), a.subtitle ? fuzzyScore(cmdQ, a.subtitle) : 0),
        }))
        .filter((x) => x.s > 0)
        .toSorted((x, y) => y.s - x.s)
        .map((x) => x.a);
      if (matchedActions.length === 0) {
        const empty = el('div', 'sl-cmdk-empty');
        empty.append(document.createTextNode(isFr ? 'Aucune commande pour « ' : 'No commands matching “'));
        empty.append(el('strong', undefined, q.slice(1).trim()));
        empty.append(document.createTextNode(isFr ? ' »' : '”'));
        listEl!.append(empty);
        renderPreview(undefined);
        if (statusEl)
          statusEl.textContent = isFr ? 'Mode commandes (/) · 0 résultat' : 'Commands mode (/) · 0 matches';
        return;
      }
      const nonAi = matchedActions.filter((a) => a.section !== 'AI');
      const aiMatched = matchedActions.filter((a) => a.section === 'AI');
      if (nonAi.length > 0) {
        const g = el('div', 'sl-cmdk-group');
        const h = el('div', 'sl-cmdk-group__title');
        h.append(el('span', undefined, tr('cmdk.groupWorkspace', 'Workspace & Navigation')));
        g.append(h);
        for (const act of nonAi) g.append(renderActionRow(act));
        listEl!.append(g);
      }
      if (aiMatched.length > 0) {
        const g = el('div', 'sl-cmdk-group');
        const h = el('div', 'sl-cmdk-group__title');
        h.append(el('span', undefined, tr('cmdk.groupAi', 'Ask AI Assistant')));
        h.append(el('span', 'sl-cmdk-group__count', String(aiMatched.length)));
        g.append(h);
        const grid = el('div', 'sl-cmdk-ai-grid');
        for (const act of aiMatched) grid.append(renderBentoTile(act));
        g.append(grid);
        listEl!.append(g);
      }
      activeIndex = 0;
      updateActiveRow(false);
      if (statusEl) {
        statusEl.textContent = isFr
          ? 'Mode commandes (/) · ' +
            renderedItems.length +
            ' résultat' +
            (renderedItems.length > 1 ? 's' : '')
          : 'Commands mode (/) · ' + renderedItems.length + ' match' + (renderedItems.length > 1 ? 'es' : '');
      }
      return;
    }
    if (q.startsWith('#')) {
      const headQ = q.slice(1).trim().toLowerCase();
      tabsEl!.dataset.collapsed = 'true';
      listEl!.replaceChildren();
      renderedItems = [];
      const scoredHeadings: Array<{ item: FlatItem; score: number }> = [];
      for (const page of getSitePagesRaw()) {
        const sec = classifySection(page.url, isFr);
        for (const h of page.headings || []) {
          const score = !headQ
            ? 1
            : Math.max(fuzzyScore(headQ, h.title), Math.floor(fuzzyScore(headQ, page.title) * 0.85));
          if (score > 0) {
            scoredHeadings.push({
              score,
              item: {
                type: 'sub',
                title: h.title,
                url: page.url + '#' + h.slug,
                section: sec.label,
                sectionKey: sec.key,
                breadcrumb: page.title,
              },
            });
          }
        }
      }
      scoredHeadings.sort((a, b) => b.score - a.score);
      const allHeadings = scoredHeadings.map((s) => s.item);
      const shown = allHeadings.slice(0, 24);
      if (shown.length === 0) {
        const empty = el('div', 'sl-cmdk-empty');
        empty.append(document.createTextNode(isFr ? 'Aucune section pour « ' : 'No headings matching “'));
        empty.append(el('strong', undefined, q));
        empty.append(document.createTextNode(isFr ? ' »' : '”'));
        listEl!.append(empty);
        renderPreview(undefined);
        if (statusEl)
          statusEl.textContent = isFr ? 'Mode sections (#) · 0 résultat' : 'Headings mode (#) · 0 matches';
        return;
      }
      const group = el('div', 'sl-cmdk-group');
      const header = el('div', 'sl-cmdk-group__title');
      header.append(el('span', undefined, isFr ? 'Sections (#)' : 'Headings (#)'));
      group.append(header);
      for (const item of shown) {
        const idx = renderedItems.length;
        renderedItems.push(item);
        group.append(
          makeRow({
            idx,
            href: item.url || '#',
            icon: iconHash(),
            title: item.title,
            titleHtml: headQ ? highlightFuzzyHtml(item.title, headQ) : undefined,
            breadcrumb: item.breadcrumb,
            badge: item.section,
            showArrow: true,
          }),
        );
      }
      listEl!.append(group);
      renderPreview(renderedItems.at(0));
      animateListCards();
      if (statusEl) {
        statusEl.textContent = isFr
          ? `Mode sections (#) · ${allHeadings.length} section${allHeadings.length > 1 ? 's' : ''}`
          : `Headings mode (#) · ${allHeadings.length} heading${allHeadings.length > 1 ? 's' : ''}`;
      }
      return;
    }
    const parsedScope = parseScopedQuery(q);
    if (parsedScope.scope) {
      activeFilter = parsedScope.scope;
    }
    const effectiveQ = parsedScope.query;
    if (parsedScope.scope === 'changelog') {
      const entries = collectSidebarPages().filter((item) => item.sectionKey === 'changelog');
      const matched = effectiveQ
        ? entries
            .map((item) => ({
              item,
              s: Math.max(
                fuzzyScore(effectiveQ, item.title),
                item.url ? fuzzyScore(effectiveQ, item.url) : 0,
              ),
            }))
            .filter((x) => x.s > 0)
            .toSorted((a, b) => b.s - a.s)
            .map((x) => x.item)
        : entries;
      currentResults = matched.map((m) => ({
        url: m.url || (isFr ? '/fr/changelog/' : '/changelog/'),
        meta: { title: m.title },
        excerpt: '',
      }));
      renderSearchResults();
      return;
    }
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
    const cacheKey = (isFr ? 'fr:' : 'en:') + effectiveQ.toLowerCase();
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
    if (docGraphMap.size > 1 && finalResults.length > 1) {
      const head = finalResults[0]!;
      const tail = finalResults.slice(1).toSorted((a, b) => {
        const pa = docGraphMap.get(normalizePath(a.url))?.pageRank ?? 0;
        const pb = docGraphMap.get(normalizePath(b.url))?.pageRank ?? 0;
        return pb - pa;
      });
      finalResults = [head, ...tail];
    }
    if (finalResults.length === 0 && parsedScope.scope === 'changelog') {
      const qLow = effectiveQ.toLowerCase();
      finalResults = collectSidebarPages()
        .filter(
          (item) =>
            item.sectionKey === 'changelog' &&
            (!qLow ||
              item.title.toLowerCase().includes(qLow) ||
              (item.url && item.url.toLowerCase().includes(qLow))),
        )
        .map((m) => ({
          url: m.url || '/changelog/',
          meta: { title: m.title },
          excerpt: m.breadcrumb || 'Changelog',
        }));
    }
    currentResults = finalResults;
    queryCache.set(cacheKey, currentResults);
    renderSearchResults();
  }
  function openModal(): void {
    if (dialog!.open) return;
    dialog!.showModal();
    activeIndex = 0;
    previewStack.length = 0;
    if (!input!.value.trim()) renderEmptyState();

    ensurePagefind();
    void ensureDocGraph();
    animate(panel, { opacity: new Array(0, 1), scale: [0.985, 1], y: [-4, 0] }, { duration: 0.16 });
    requestAnimationFrame(() => input!.focus());
  }
  function closeModal(): void {
    if (!dialog!.open) return;
    if (previewThemeOriginal !== null) {
      document.documentElement.dataset.theme = previewThemeOriginal;
      previewThemeOriginal = null;
    }
    markedItems.clear();
    prevTabPillRect = null;
    historyCursor = -1;
    activeModePrefix = '';
    aiCommandsExpanded = false;
    if (shortcutsPopover) {
      shortcutsPopover.hidden = true;
      shortcutsBtn?.setAttribute('aria-expanded', 'false');
    }
    dialog!.close();
  }
  function activateItem(item: FlatItem | undefined, newTab = false): void {
    if (newTab && markedItems.size > 0) {
      const urls = Array.from(markedItems.values()).map((m) => m.url);
      closeModal();
      for (const u of urls) window.open(u, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!item) return;
    if (item.type === 'recent' && item.query) {
      input!.value = item.query;
      handleQuery();
      return;
    }
    if (item.type === 'action') {
      runAction(item);
      return;
    }
    if (item.url) {
      if (input!.value.trim()) pushRecent(input!.value.trim());
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
  root.querySelectorAll<HTMLElement>('[data-cmdk-open]').forEach((btn) => {
    const icon = btn.querySelector<SVGElement>('svg');
    btn.addEventListener('pointermove', (ev) => {
      const rect = btn.getBoundingClientRect();
      btn.style.setProperty('--mx', ev.clientX - rect.left + 'px');
      btn.style.setProperty('--my', ev.clientY - rect.top + 'px');
    });
    btn.addEventListener('pointerenter', () => {
      if (icon) animate(icon, { rotate: -8 }, { type: spring, stiffness: 460, damping: 24 });
    });
    btn.addEventListener('pointerleave', () => {
      if (icon) animate(icon, { rotate: 0 }, { type: spring, stiffness: 460, damping: 24 });
    });
    btn.addEventListener('pointerdown', () => {
      animate(btn, { y: 1 }, { duration: 0.08 });
    });
    btn.addEventListener('pointerup', () => {
      animate(btn, { y: 0 }, { type: spring, stiffness: 520, damping: 28 });
    });
    btn.addEventListener('click', openModal);
  });
  dialog!.addEventListener('keydown', (e) => {
    if (((isMac && e.metaKey && !e.ctrlKey) || (!isMac && e.altKey)) && e.key.toLowerCase() === 'd') {
      const current = renderedItems[activeIndex];
      if (current?.url) {
        e.preventDefault();
        e.stopPropagation();
        handleTogglePin(current);
        return;
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
      const current = renderedItems[activeIndex];
      if (current?.url) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          void copyItemMarkdown(current);
        } else {
          copyItemUrl(current);
        }
      }
    }
  });

  dialog!.addEventListener('click', (e) => {
    if (e.target === dialog) closeModal();
  });
  dialog!.addEventListener('cancel', (e) => {
    if (markedItems.size > 0) {
      e.preventDefault();
      markedItems.clear();
      refreshMarkedUI();
      return;
    }
    if (input!.value.trim().length > 0) {
      e.preventDefault();
      input!.value = '';
      handleQuery();
      input!.focus();
    }
  });
  clearBtn?.addEventListener('click', () => {
    activeModePrefix = '';
    input!.value = '';
    handleQuery();
    input!.focus();
  });
  tabsEl!.addEventListener('click', (e) => {
    const emptyTab =
      e.target instanceof Element ? e.target.closest<HTMLButtonElement>('[data-empty-view]') : null;
    if (emptyTab && emptyTab.dataset.emptyView) {
      activeFilter = emptyTab.dataset.emptyView;
      activeIndex = 0;
      renderEmptyState(false);
      return;
    }
    const tab = e.target instanceof Element ? e.target.closest<HTMLButtonElement>('[data-filter]') : null;
    if (!tab || !tab.dataset.filter) return;
    activeFilter = tab.dataset.filter;
    activeIndex = 0;
    renderSearchResults();
  });

  function pivotPreviewToGraphLink(link: HTMLAnchorElement): void {
    const targetUrl = link.getAttribute('href') || link.href;
    if (!targetUrl) return;
    const curTitle = previewEl?.querySelector<HTMLElement>('.sl-cmdk-preview__title')?.textContent || '';
    const curUrl =
      previewEl?.querySelector<HTMLElement>('.sl-cmdk-preview__path')?.textContent ||
      renderedItems[activeIndex]?.url;
    if (curUrl) {
      const sec = classifySection(curUrl, isFr);
      previewStack.push({
        type: 'nav',
        title: curTitle || curUrl,
        url: curUrl,
        section: sec.label,
        sectionKey: sec.key,
        breadcrumb: formatBreadcrumb(curUrl, isFr),
      });
    }
    const nextSec = classifySection(targetUrl, isFr);
    const nextTitle =
      link.dataset.graphTitle || link.textContent?.replace(/^[→←]\s*/, '').trim() || targetUrl;
    renderPreview({
      type: 'nav',
      title: nextTitle,
      url: targetUrl,
      section: nextSec.label,
      sectionKey: nextSec.key,
      breadcrumb: formatBreadcrumb(targetUrl, isFr),
    });
  }

  previewEl?.addEventListener('click', (e) => {
    const backBtn =
      e.target instanceof Element ? e.target.closest<HTMLButtonElement>('[data-preview-back]') : null;
    if (backBtn) {
      e.preventDefault();
      const prev = previewStack.pop();
      renderPreview(prev || renderedItems[activeIndex]);
      return;
    }
    const graphLink =
      e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('[data-graph-jump]') : null;
    if (graphLink) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) {
        closeModal();
        return;
      }
      e.preventDefault();
      pivotPreviewToGraphLink(graphLink);
      return;
    }
    const subLink =
      e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('.sl-cmdk-preview__sub-link') : null;
    if (subLink) {
      closeModal();
    }
  });
  listEl!.addEventListener('click', (e) => {
    const markToggle = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-mark-idx]') : null;
    if (markToggle) {
      e.preventDefault();
      e.stopPropagation();
      toggleMarkItem(renderedItems[Number(markToggle.dataset.markIdx)], false);
      return;
    }
    const pinToggle = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-pin-idx]') : null;
    if (pinToggle) {
      e.preventDefault();
      e.stopPropagation();
      const targetItem = renderedItems[Number(pinToggle.dataset.pinIdx)];
      handleTogglePin(targetItem);
      return;
    }
    const clearRecent = e.target instanceof Element ? e.target.closest('[data-clear-recent]') : null;
    if (clearRecent) {
      e.preventDefault();
      try {
        localStorage.removeItem(RECENT_KEY);
        localStorage.removeItem(RECENT_PAGES_KEY);
      } catch {}
      renderEmptyState();
      return;
    }
    const row = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-cmdk-idx]') : null;
    if (!row) return;
    const item = renderedItems[Number(row.dataset.cmdkIdx)];
    if (item?.type === 'recent' || item?.type === 'action') {
      e.preventDefault();
      activateItem(item);
    } else if (item?.url) {
      if (input!.value.trim()) pushRecent(input!.value.trim());
      pushRecentPage({
        title: item.title,
        url: item.url,
        section: item.section || classifySection(item.url, isFr).label,
      });
    }
  });
  listEl!.addEventListener('mousemove', (e) => {
    if (performance.now() - lastToggleClickAt < 120) return;
    const row = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-cmdk-idx]') : null;
    if (!row) return;
    const idx = Number(row.dataset.cmdkIdx);
    if (!Number.isNaN(idx) && idx !== activeIndex) {
      activeIndex = idx;
      updateActiveRow(false);
    }
  });
  input!.addEventListener('input', () => {
    if (searchListAnimTimer) window.clearTimeout(searchListAnimTimer);
    const rawVal = input!.value.trim();
    if (clearBtn) {
      const hasVal = input!.value.length > 0;
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
  input!.addEventListener('keydown', (e) => {
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
    } else if (
      e.key === 'PageDown' ||
      (e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'd')
    ) {
      const prevTop = previewEl?.querySelector<HTMLElement>('.sl-cmdk-preview__top');
      if (prevTop) {
        e.preventDefault();
        prevTop.scrollBy({ top: Math.max(120, Math.round(prevTop.clientHeight * 0.65)), behavior: 'smooth' });
      }
    } else if (e.key === 'PageUp' || (e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'u')) {
      const prevTop = previewEl?.querySelector<HTMLElement>('.sl-cmdk-preview__top');
      if (prevTop) {
        e.preventDefault();
        prevTop.scrollBy({
          top: -Math.max(120, Math.round(prevTop.clientHeight * 0.65)),
          behavior: 'smooth',
        });
      }
    } else if (
      e.altKey &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.shiftKey &&
      (/^[1-6]$/.test(e.key) || /^Digit[1-6]$/.test(e.code))
    ) {
      const digit = /^[1-6]$/.test(e.key) ? e.key : e.code.slice(5);
      const graphLink = previewEl?.querySelector<HTMLAnchorElement>(`[data-graph-jump="${digit}"]`);
      if (graphLink) {
        e.preventDefault();
        e.stopPropagation();
        pivotPreviewToGraphLink(graphLink);
      }
    } else if (
      e.altKey &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.shiftKey &&
      (e.key.toLowerCase() === 'c' || e.code === 'KeyC')
    ) {
      const copyCodeBtn = previewEl?.querySelector<HTMLButtonElement>('.sl-cmdk-preview__code-copy');
      if (copyCodeBtn) {
        e.preventDefault();
        e.stopPropagation();
        copyCodeBtn.click();
      }
    } else if (e.altKey && !e.metaKey && !e.ctrlKey && e.key === 'ArrowLeft' && previewStack.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      const prev = previewStack.pop();
      renderPreview(prev || renderedItems[activeIndex]);
    } else if (
      e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      (/^[1-6]$/.test(e.key) || /^Digit[1-6]$/.test(e.code))
    ) {
      const digit = /^[1-6]$/.test(e.key) ? e.key : e.code.slice(5);
      const jumpLink = previewEl?.querySelector<HTMLAnchorElement>(`[data-sub-jump="${digit}"]`);
      if (jumpLink) {
        e.preventDefault();
        e.stopPropagation();
        const targetHref = jumpLink.getAttribute('href') || jumpLink.href;
        closeModal();
        if (targetHref) window.location.assign(targetHref);
      }
    } else if (e.key === '?' && !activeModePrefix && input?.value === '' && shortcutsPopover) {
      e.preventDefault();
      const nextOpen = shortcutsPopover.hidden;
      shortcutsPopover.hidden = !nextOpen;
      shortcutsBtn?.setAttribute('aria-expanded', String(nextOpen));
    } else if (
      e.key === 'Backspace' &&
      activeModePrefix &&
      ((input?.value.length ?? 0) === 0 ||
        ((input?.selectionStart ?? 0) === 0 && (input?.selectionEnd ?? 0) === 0))
    ) {
      e.preventDefault();
      e.stopPropagation();
      activeModePrefix = '';
      void handleQuery();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activateItem(renderedItems[activeIndex], e.metaKey || e.ctrlKey);
    } else if (
      (e.metaKey || e.ctrlKey) &&
      e.key.toLowerCase() === 'c' &&
      !window.getSelection()?.toString()
    ) {
      const current = renderedItems[activeIndex];
      if (current?.url) {
        e.preventDefault();
        if (e.shiftKey) {
          void copyItemMarkdown(current);
        } else {
          copyItemUrl(current);
        }
      }
    } else if (
      e.altKey &&
      !e.metaKey &&
      !e.ctrlKey &&
      (e.key.toLowerCase() === 'p' || e.key.toLowerCase() === 'n')
    ) {
      const rec = getRecent();
      if (rec.length > 0) {
        e.preventDefault();
        if (e.key.toLowerCase() === 'p') {
          if (historyCursor === -1) historyDraft = input!.value;
          historyCursor = Math.min(rec.length - 1, historyCursor + 1);
          input!.value = rec[historyCursor];
        } else if (historyCursor >= 0) {
          historyCursor -= 1;
          input!.value = historyCursor >= 0 ? rec[historyCursor] : historyDraft;
        }
        void handleQuery();
      }
    } else if (
      ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'm') ||
      (e.altKey && e.code === 'Space')
    ) {
      const cur = renderedItems[activeIndex];
      if (cur?.url) {
        e.preventDefault();
        toggleMarkItem(cur, true);
      }
    } else if (e.key === 'Tab' && !tabsEl!.hidden) {
      const tabs = Array.from(tabsEl!.querySelectorAll<HTMLElement>('[data-filter], [data-empty-view]'));
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
  document.addEventListener(
    'keydown',
    (e) => {
      if (!dialog!.isConnected) return;
      if (
        dialog!.open &&
        ((isMac && e.metaKey && !e.ctrlKey) || (!isMac && e.altKey)) &&
        e.key.toLowerCase() === 'd'
      ) {
        const current = renderedItems[activeIndex];
        if (current?.url) {
          e.preventDefault();
          e.stopImmediatePropagation();
          handleTogglePin(current);
        }
        return;
      }
    },
    { capture: true },
  );

  document.addEventListener('keydown', (e) => {
    if (!dialog!.isConnected) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (dialog!.open) closeModal();
      else openModal();
      return;
    }
    if (
      e.key === '/' &&
      !dialog!.open &&
      !(
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      )
    ) {
      e.preventDefault();
      openModal();
    }
  });
}
initCommandSearch();
document.addEventListener('astro:page-load', initCommandSearch);
