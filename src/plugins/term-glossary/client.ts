import { animate, spring } from 'motion';
import { createHoverCardController, isReducedMotion } from '../shared/hover-card';

export interface TermGlossaryClientOptions {
  maxTermsPerPage?: number;
  hoverDelay?: number;
}

interface GlossaryItem {
  term: string;
  definition: string;
  href: string;
  locale: string;
}

const LABELS: Record<string, { badge: string; sub: string; readMore: string }> = {
  en: { badge: 'Glossary', sub: 'Concept', readMore: 'Read explanation →' },
  fr: { badge: 'Glossaire', sub: 'Concept', readMore: "Lire l'explication →" },
};

const REGEX_SPECIAL = new Set(['.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\']);

const TERM_CSS = [
  'button.sl-glossary-term { all: unset !important; display: inline !important; font: inherit !important; color: inherit !important; border-bottom: 1.5px dotted color-mix(in srgb, var(--sl-color-accent-high, var(--sl-color-accent)) 72%, transparent) !important; cursor: help !important; transition: background-color 140ms ease, border-color 140ms ease !important; }',
  'button.sl-glossary-term:hover, button.sl-glossary-term:focus-visible { background: color-mix(in srgb, var(--sl-color-accent) 12%, transparent) !important; border-bottom-color: var(--sl-color-accent-high, var(--sl-color-accent)) !important; border-radius: 3px !important; }',
  '.sl-glossary-arrival { display: inline-block !important; padding: 0.05em 0.35em !important; margin: 0 -0.15em !important; border-radius: 6px !important; background: var(--sl-color-accent-low) !important; color: var(--sl-color-accent-high) !important; box-shadow: 0 0 0 2px color-mix(in srgb, var(--sl-color-accent) 45%, transparent) !important; transition: background-color 650ms ease, box-shadow 650ms ease, color 650ms ease !important; }',
  '.sl-glossary-arrival.is-fading { background: transparent !important; box-shadow: 0 0 0 0 transparent !important; color: inherit !important; }',
].join('\n');

let styleInjected = false;
let cachedEntries: GlossaryItem[] | null = null;

function getCurrentLocale(): string {
  const base = (document.documentElement.lang ?? '').toLowerCase().trim().split('-').at(0);
  if (base) return base;
  return window.location.pathname.split('/').at(1) === 'fr' ? 'fr' : 'en';
}

function escapeRegExp(value: string): string {
  let out = '';
  for (const ch of value) out += REGEX_SPECIAL.has(ch) ? '\\' + ch : ch;
  return out;
}

function normalizePath(p: string): string {
  const clean = p.split('#').at(0) ?? p;
  return clean.endsWith('/') ? clean : clean + '/';
}

function buildArrivalHref(href: string, term: string): string {
  const url = new URL(href, window.location.origin);
  url.searchParams.set('highlight', term);
  return url.pathname + url.search + url.hash;
}

async function loadGlossary(): Promise<GlossaryItem[]> {
  if (cachedEntries) return cachedEntries;
  try {
    const res = await fetch('/glossary-index.json');
    if (!res.ok) return [];
    const data = (await res.json()) as GlossaryItem[];
    cachedEntries = Array.isArray(data) ? data : [];
    return cachedEntries;
  } catch {
    return [];
  }
}

function pulseArrivalTarget(el: HTMLElement): void {
  el.classList.add('sl-glossary-arrival');
  window.setTimeout(() => {
    el.scrollIntoView({ behavior: isReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    if (!isReducedMotion()) {
      animate(
        el,
        { scale: [0.95, 1.04, 1], opacity: [0.45, 1] },
        { type: spring, stiffness: 460, damping: 26, mass: 0.7 },
      );
    }
  }, 80);
  window.setTimeout(() => el.classList.add('is-fading'), 2800);
  window.setTimeout(() => el.classList.remove('sl-glossary-arrival', 'is-fading'), 3500);
}

function handleArrivalHighlight(): void {
  const url = new URL(window.location.href);
  const term = url.searchParams.get('highlight')?.trim();
  if (!term) return;

  url.searchParams.delete('highlight');
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);

  const container = document.querySelector('.sl-markdown-content');
  if (!container) return;

  const hashId = url.hash ? decodeURIComponent(url.hash.slice(1)) : '';
  if (hashId) {
    const heading = document.querySelector('#' + CSS.escape(hashId));
    if (heading) {
      pulseArrivalTarget(heading as HTMLElement);
      return;
    }
  }

  const pattern = new RegExp('\\b(' + escapeRegExp(term) + 's?)\\b', 'iu');
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const text = current.nodeValue ?? '';
    const match = text.match(pattern);
    if (match && match.index !== undefined && !current.parentElement?.closest('pre, script, style')) {
      const matched = match.at(1) ?? match.at(0) ?? term;
      const mark = document.createElement('mark');
      mark.textContent = matched;
      const frag = document.createDocumentFragment();
      if (match.index > 0) frag.append(document.createTextNode(text.slice(0, match.index)));
      frag.append(mark);
      const after = text.slice(match.index + matched.length);
      if (after) frag.append(document.createTextNode(after));
      (current as ChildNode).replaceWith(frag);
      pulseArrivalTarget(mark);
      return;
    }
    current = walker.nextNode();
  }
}

export function initTermGlossary(opts: TermGlossaryClientOptions = {}): void {
  if (typeof window === 'undefined') return;
  if (!styleInjected && !document.querySelector('#sl-term-glossary-style')) {
    styleInjected = true;
    const style = document.createElement('style');
    style.id = 'sl-term-glossary-style';
    style.textContent = TERM_CSS;
    document.head.append(style);
  }

  const maxTerms = opts.maxTermsPerPage ?? 12;
  const hoverDelay = opts.hoverDelay ?? 180;
  const card = createHoverCardController();
  let showTimer: number | null = null;
  let activeTrigger: HTMLElement | null = null;

  function showForTrigger(trigger: HTMLElement, entry: GlossaryItem): void {
    const labels = LABELS[entry.locale] ?? LABELS.en;
    card.show(trigger, (el) => {
      const meta = document.createElement('div');
      meta.className = 'sl-hover-card-meta';
      const badge = document.createElement('span');
      badge.className = 'sl-hover-card-badge';
      badge.textContent = labels.badge;
      const sub = document.createElement('span');
      sub.className = 'sl-hover-card-sub';
      sub.textContent = labels.sub;
      meta.append(badge, sub);

      const title = document.createElement('div');
      title.className = 'sl-hover-card-title';
      title.textContent = entry.term;

      const desc = document.createElement('p');
      desc.className = 'sl-hover-card-desc';
      desc.textContent = entry.definition;

      const footer = document.createElement('a');
      footer.className = 'sl-hover-card-footer';
      footer.href = buildArrivalHref(entry.href, entry.term);
      footer.textContent = labels.readMore;

      el.append(meta, title, desc, footer);
    });
  }

  function annotatePage(entries: GlossaryItem[]): void {
    if (Object.hasOwn(document.documentElement.dataset, 'hasHero')) return;
    const container = document.querySelector('.sl-markdown-content');
    if (!container) return;

    const locale = getCurrentLocale();
    const currentPath = normalizePath(window.location.pathname);
    const candidates = entries.filter((e) => e.locale === locale && normalizePath(e.href) !== currentPath);
    if (candidates.length === 0) return;

    const usedHrefs = new Set<string>();
    const blocks = Array.from(container.querySelectorAll('p, li')) as HTMLElement[];

    for (const block of blocks) {
      if (usedHrefs.size >= maxTerms) break;
      if (block.closest('a, pre, code, h1, h2, h3, h4, .sl-link-card')) continue;

      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      let current = walker.nextNode();
      while (current) {
        if (!current.parentElement?.closest('a, code, pre, kbd, samp, .sl-glossary-term'))
          textNodes.push(current as Text);
        current = walker.nextNode();
      }

      for (const textNode of textNodes) {
        if (usedHrefs.size >= maxTerms) break;
        const text = textNode.nodeValue ?? '';
        if (text.trim().length < 3) continue;

        for (const entry of candidates) {
          if (usedHrefs.has(entry.href)) continue;
          const pattern = new RegExp('\\b(' + escapeRegExp(entry.term) + 's?)\\b', 'iu');
          const match = text.match(pattern);
          if (!match || match.index === undefined) continue;

          const before = text.slice(0, match.index);
          const matchedText = match.at(1) ?? match.at(0) ?? entry.term;
          const after = text.slice(match.index + matchedText.length);

          const trigger = document.createElement('button');
          trigger.type = 'button';
          trigger.className = 'sl-glossary-term';
          trigger.textContent = matchedText;
          trigger.setAttribute('aria-label', entry.term);

          trigger.addEventListener('mouseenter', () => {
            if (activeTrigger === trigger) return;
            if (showTimer !== null) window.clearTimeout(showTimer);
            activeTrigger = trigger;
            showTimer = window.setTimeout(() => showForTrigger(trigger, entry), hoverDelay);
          });
          trigger.addEventListener('focus', () => {
            activeTrigger = trigger;
            showForTrigger(trigger, entry);
          });
          trigger.addEventListener('mouseleave', (e) => {
            if (e.relatedTarget instanceof Node && card.contains(e.relatedTarget)) return;
            if (showTimer !== null) {
              window.clearTimeout(showTimer);
              showTimer = null;
            }
            activeTrigger = null;
            card.scheduleHide(120);
          });
          trigger.addEventListener('blur', () => {
            activeTrigger = null;
            card.scheduleHide(120);
          });
          const frag = document.createDocumentFragment();
          if (before) frag.append(document.createTextNode(before));
          frag.append(trigger);
          if (after) frag.append(document.createTextNode(after));
          (textNode as ChildNode).replaceWith(frag);
          usedHrefs.add(entry.href);
          break;
        }
      }
    }
  }
  const run = async () => {
    handleArrivalHighlight();
    const entries = await loadGlossary();
    if (entries.length > 0) annotatePage(entries);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void run(), { once: true });
  } else {
    void run();
  }
  document.addEventListener('astro:page-load', () => void run());
}
