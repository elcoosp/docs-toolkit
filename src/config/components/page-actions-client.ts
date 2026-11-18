import { animate, spring } from 'motion';

function resolveMarkdownUrl(pathname: string): string {
  const clean = pathname.replace(/\/+$/, '');
  if (clean === '') return '/index.md';
  if (clean === '/fr') return '/fr/index.md';
  return clean + '.md';
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
    animate(checkSvg, { opacity: 1, scale: [0.5, 1.12, 1], rotate: [-14, 0] }, { type: spring, stiffness: 540, damping: 26 });
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
      animate(baseSvg, { opacity: 1, scale: [0.6, 1], rotate: [18, 0] }, { type: spring, stiffness: 480, damping: 30 });
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
      const res = await fetch(mdUrl);
      if (!res.ok) throw new Error('Not found');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      morphButtonToSuccess(copyBtn, copyLabel, copiedLabel, timers);
    } catch {
      const labelEl = copyBtn.querySelector<HTMLElement>('.morph-label__default');
      if (labelEl) {
        labelEl.textContent = copyError;
        window.setTimeout(() => { labelEl.textContent = copyLabel; }, 2000);
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
      animate(menu, { opacity: [0, 1], scale: [0.95, 1], y: [-6, 0] }, { type: spring, stiffness: 520, damping: 30 });
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
