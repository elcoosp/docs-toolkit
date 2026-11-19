import { animate, spring } from 'motion';

function resolveMarkdownUrl(pathname: string): string {
  const clean = pathname.replace(/\/+$/, '');
  if (clean === '') return '/index.md';
  if (clean === '/fr') return '/fr.md';
  return clean + '.md';
}

function serializeInlineMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }
  if (!(node instanceof HTMLElement)) return '';
  if (node.closest('[data-pagefind-ignore], .sl-anchor-link, .page-actions-container')) return '';
  const tag = node.tagName;
  if (tag === 'CODE' && !node.closest('pre')) {
    return '`' + (node.textContent || '') + '`';
  }
  if (tag === 'STRONG' || tag === 'B') {
    const inner = Array.from(node.childNodes).map(serializeInlineMarkdown).join('');
    return inner ? '**' + inner + '**' : '';
  }
  if (tag === 'EM' || tag === 'I') {
    const inner = Array.from(node.childNodes).map(serializeInlineMarkdown).join('');
    return inner ? '*' + inner + '*' : '';
  }
  if (tag === 'A') {
    const label = Array.from(node.childNodes).map(serializeInlineMarkdown).join('').trim();
    const href = node.getAttribute('href') || '';
    if (!label) return '';
    return href ? '[' + label + '](' + href + ')' : label;
  }
  return Array.from(node.childNodes).map(serializeInlineMarkdown).join('');
}

function extractFallbackPageMarkdown(): string {
  const blocks: string[] = [];
  const h1 = document.querySelector('main h1')?.textContent?.trim();
  if (h1) blocks.push('# ' + h1);
  const contentRoot = document.querySelector('.sl-markdown-content') || document.querySelector('main');
  if (!contentRoot) return blocks.join('\n\n');

  contentRoot.querySelectorAll('h2, h3, h4, p, li, pre').forEach((el) => {
    if (el.closest('[data-pagefind-ignore], .page-actions-container, nav, header, footer')) return;
    if (el.tagName === 'P' && el.closest('li')) return;
    const tag = el.tagName;
    if (tag === 'H2' || tag === 'H3' || tag === 'H4') {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.sl-anchor-link, [aria-hidden="true"]').forEach((n) => n.remove());
      const heading = clone.textContent?.replace(/\s+/g, ' ').trim() || '';
      if (heading) {
        const prefix = tag === 'H2' ? '## ' : tag === 'H3' ? '### ' : '#### ';
        blocks.push(prefix + heading);
      }
    } else if (tag === 'LI') {
      const line = serializeInlineMarkdown(el).replace(/\s+/g, ' ').trim();
      if (line) blocks.push('- ' + line);
    } else if (tag === 'P') {
      const para = serializeInlineMarkdown(el).replace(/\s+/g, ' ').trim();
      if (para) blocks.push(para);
    } else if (tag === 'PRE') {
      const ecLines = Array.from(el.querySelectorAll('.ec-line .code'));
      const code =
        ecLines.length > 0
          ? ecLines
              .map((l) => l.textContent || '')
              .join('\n')
              .trim()
          : el.textContent?.trim() || '';
      if (code) blocks.push('```\n' + code + '\n```');
    }
  });
  return blocks.join('\n\n').trim();
}

function morphButtonToSuccess(
  btn: HTMLButtonElement,
  defaultLabel: string,
  successLabel: string,
  timerMap: WeakMap<HTMLButtonElement, number>,
): void {
  const prevTimer = timerMap.get(btn);
  if (prevTimer) window.clearTimeout(prevTimer);

  const baseSvg = btn.querySelector<SVGElement>('.morph-icon__base');
  const checkSvg = btn.querySelector<SVGElement>('.morph-icon__check');
  const checkPath = checkSvg?.querySelector<SVGPathElement>('path');
  const defaultEl = btn.querySelector<HTMLElement>('.morph-label__default');
  const successEl = btn.querySelector<HTMLElement>('.morph-label__success');

  btn.dataset.state = 'success';
  if (successEl) successEl.textContent = successLabel;

  animate(btn, { scale: [0.95, 1.02, 1] }, { type: spring, stiffness: 520, damping: 28 });

  if (baseSvg) {
    animate(baseSvg, { opacity: 0, scale: 0.45, rotate: -24 }, { duration: 0.18, ease: 'easeOut' });
  }
  if (checkSvg) {
    animate(
      checkSvg,
      { opacity: 1, scale: [0.5, 1.12, 1], rotate: [-14, 0] },
      { type: spring, stiffness: 540, damping: 26 },
    );
  }
  if (checkPath) {
    const len = typeof checkPath.getTotalLength === 'function' ? checkPath.getTotalLength() : 24;
    checkPath.style.strokeDasharray = String(len);
    checkPath.style.strokeDashoffset = String(len);
    animate(checkPath, { strokeDashoffset: [len, 0] }, { duration: 0.28, ease: 'easeOut', delay: 0.05 });
  }

  const timer = window.setTimeout(() => {
    delete btn.dataset.state;
    if (defaultEl) defaultEl.textContent = defaultLabel;
    if (checkSvg) {
      animate(checkSvg, { opacity: 0, scale: 0.5, rotate: 16 }, { duration: 0.18, ease: 'easeIn' });
    }
    if (baseSvg) {
      animate(
        baseSvg,
        { opacity: 1, scale: [0.6, 1], rotate: [18, 0] },
        { type: spring, stiffness: 480, damping: 30 },
      );
    }
  }, 2000);
  timerMap.set(btn, timer);
}

export function initPageActions(): void {
  const container = document.querySelector<HTMLElement>('.page-actions-container');
  if (!container || container.dataset.bound === 'true') return;
  container.dataset.bound = 'true';

  const copyLabel = container.dataset.copyLabel ?? 'Copy';
  const copiedLabel = container.dataset.copiedLabel ?? 'Copied';
  const copyError = container.dataset.copyError ?? 'Copy failed';
  const shareLabel = container.dataset.shareLabel ?? 'Share';
  const linkCopied = container.dataset.linkCopied ?? 'Copied';
  const timers = new WeakMap<HTMLButtonElement, number>();

  const copyBtn = container.querySelector<HTMLButtonElement>('#copy-markdown');
  copyBtn?.addEventListener('click', async () => {
    const mdUrl = resolveMarkdownUrl(window.location.pathname);
    try {
      let text = '';
      const res = await fetch(mdUrl);
      if (res.ok) {
        text = await res.text();
      } else {
        text = extractFallbackPageMarkdown();
      }
      if (!text) throw new Error('Empty markdown');
      await navigator.clipboard.writeText(text);
      morphButtonToSuccess(copyBtn, copyLabel, copiedLabel, timers);
    } catch {
      const labelEl = copyBtn.querySelector<HTMLElement>('.morph-label__default');
      if (labelEl) {
        labelEl.textContent = copyError;
        window.setTimeout(() => {
          labelEl.textContent = copyLabel;
        }, 2000);
      }
    }
  });

  const shareBtn = container.querySelector<HTMLButtonElement>('#share-page');
  shareBtn?.addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
      }
      morphButtonToSuccess(shareBtn, shareLabel, linkCopied, timers);
    } catch {}
  });

  const dropdown = container.querySelector<HTMLElement>('.action-dropdown');
  const trigger = dropdown?.querySelector<HTMLButtonElement>('#open-ai-trigger');
  const menu = dropdown?.querySelector<HTMLElement>('.dropdown-menu');
  const chevron = dropdown?.querySelector<SVGElement>('.ai-chevron');
  let open = false;
  let closeTimer = 0;

  function setOpen(next: boolean): void {
    if (!dropdown || !trigger || !menu || open === next) return;
    open = next;
    dropdown.dataset.open = open ? 'true' : 'false';
    trigger.setAttribute('aria-expanded', String(open));
    if (chevron) {
      animate(chevron, { rotate: open ? 180 : 0 }, { type: spring, stiffness: 520, damping: 32 });
    }
    if (open) {
      animate(
        menu,
        { opacity: [0, 1], scale: [0.95, 1], y: [-6, 0] },
        { type: spring, stiffness: 520, damping: 30 },
      );
    }
  }

  trigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!open);
  });
  dropdown?.addEventListener('mouseenter', () => {
    window.clearTimeout(closeTimer);
    setOpen(true);
  });
  dropdown?.addEventListener('mouseleave', () => {
    closeTimer = window.setTimeout(() => setOpen(false), 140);
  });
  document.addEventListener('click', (e) => {
    if (open && dropdown && e.target instanceof Node && !dropdown.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) {
      setOpen(false);
      trigger?.focus();
    }
  });
}

initPageActions();
document.addEventListener('astro:page-load', initPageActions);
