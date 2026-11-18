import { animate, spring } from 'motion';

function animateZenToggle(btn: HTMLButtonElement, on: boolean): void {
  const expandIcon = btn.querySelector<SVGElement>('.sl-zen-icon--expand');
  const compressIcon = btn.querySelector<SVGElement>('.sl-zen-icon--compress');
  const dot = btn.querySelector<HTMLElement>('.sl-zen-dot');

  animate(
    btn,
    { scale: on ? [0.92, 1.06, 1] : [0.94, 1.03, 1] },
    { type: spring, stiffness: 540, damping: 26 },
  );

  if (dot) {
    animate(
      dot,
      { scale: on ? [0.4, 1.35, 1] : [1, 0.4], opacity: on ? 1 : 0.45 },
      { type: spring, stiffness: 500, damping: 24 },
    );
  }

  if (expandIcon && compressIcon) {
    if (on) {
      animate(expandIcon, { opacity: 0, scale: 0.45, rotate: -45 }, { duration: 0.18, ease: 'easeOut' });
      animate(compressIcon, { opacity: 1, scale: [0.5, 1.15, 1], rotate: [45, 0] }, { type: spring, stiffness: 520, damping: 26 });
    } else {
      animate(compressIcon, { opacity: 0, scale: 0.45, rotate: 45 }, { duration: 0.18, ease: 'easeOut' });
      animate(expandIcon, { opacity: 1, scale: [0.5, 1.15, 1], rotate: [-45, 0] }, { type: spring, stiffness: 520, damping: 26 });
    }
  }
}

function setZenState(on: boolean, shouldAnimate: boolean): void {
  const root = document.documentElement;
  if (on) {
    root.setAttribute('data-zen-mode', 'true');
  } else {
    root.removeAttribute('data-zen-mode');
  }
  try {
    localStorage.setItem('sl-zen-mode', on ? '1' : '0');
  } catch {}

  document.querySelectorAll<HTMLButtonElement>('[data-zen-toggle]').forEach((btn) => {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (shouldAnimate) animateZenToggle(btn, on);
  });
}

export function initZenMode(): void {
  const root = document.documentElement;
  const params = new URLSearchParams(window.location.search);
  const initial = params.get('zen') === '1' || localStorage.getItem('sl-zen-mode') === '1' || root.getAttribute('data-zen-mode') === 'true';
  setZenState(initial, false);

  if (root.dataset.zenBound === 'true') return;
  root.dataset.zenBound = 'true';

  document.addEventListener('click', (e) => {
    const target = e.target;
    const btn = target instanceof Element ? target.closest<HTMLButtonElement>('[data-zen-toggle]') : null;
    if (!btn) return;
    setZenState(root.getAttribute('data-zen-mode') !== 'true', true);
  });

  document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      setZenState(root.getAttribute('data-zen-mode') !== 'true', true);
    }
  });
}

initZenMode();
document.addEventListener('astro:page-load', initZenMode);
