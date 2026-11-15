import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

const VIEW_MODES = new Set(['zen-mode', 'presentation-mode']);

type SidebarEntry = {
  type: string;
  href?: string;
  entries?: SidebarEntry[];
};

function stripModeFromHref(href: string): string {
  const parts = href.split('/');
  const idx = parts.findIndex((seg) => VIEW_MODES.has(seg));
  if (idx === -1) return href;
  const cleaned = [...parts.slice(0, idx), ...parts.slice(idx + 1)].join('/');
  return cleaned === '' ? '/' : cleaned;
}

function walkSidebar(
  entries: SidebarEntry[],
  saved: WeakMap<object, string>,
): void {
  for (const entry of entries) {
    if (entry.type === 'group' && Array.isArray(entry.entries)) {
      walkSidebar(entry.entries, saved);
    } else if (entry.type === 'link' && typeof entry.href === 'string' && entry.href.startsWith('/')) {
      const stripped = stripModeFromHref(entry.href);
      if (stripped !== entry.href) {
        saved.set(entry, entry.href);
        entry.href = stripped;
      }
    }
  }
}

export const onRequest = defineRouteMiddleware((context) => {
  const locals = context.locals as any;
  const segments = context.url.pathname.split('/');
  const modeFromUrl = segments.find((seg) => VIEW_MODES.has(seg));
  const mode: string | undefined = locals.starlightViewModes?.currentMode ?? modeFromUrl;
  if (!mode || mode === 'default') return;

  const saved = new WeakMap<object, string>();
  walkSidebar(locals.starlightRoute.sidebar, saved);
  locals.__docsToolkitViewMode = mode;
  locals.__docsToolkitViewModeHrefs = saved;
});
