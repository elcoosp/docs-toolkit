import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

type SidebarEntry = {
  type: string;
  href?: string;
  entries?: SidebarEntry[];
};

function insertModePrefix(href: string, mode: string, locale: string | undefined): string {
  if (!href.startsWith('/')) return href;
  if (locale && href.startsWith(`/${locale}/`)) {
    if (href.startsWith(`/${locale}/${mode}/`)) return href;
    return `/${locale}/${mode}${href.slice(locale.length + 1)}`;
  }
  if (href.startsWith(`/${mode}/`)) return href;
  return `/${mode}${href}`;
}

function restoreSidebar(
  entries: SidebarEntry[],
  mode: string,
  locale: string | undefined,
  saved: WeakMap<object, string> | undefined,
): void {
  for (const entry of entries) {
    if (entry.type === 'group' && Array.isArray(entry.entries)) {
      restoreSidebar(entry.entries, mode, locale, saved);
    } else if (entry.type === 'link' && typeof entry.href === 'string' && entry.href.startsWith('/')) {
      const original = saved?.get(entry);
      entry.href = original ?? insertModePrefix(entry.href, mode, locale);
    }
  }
}

export const onRequest = defineRouteMiddleware((context) => {
  const locals = context.locals as any;
  const mode: string | undefined = locals.__docsToolkitViewMode;
  if (!mode || mode === 'default') return;

  const route = locals.starlightRoute;
  const saved: WeakMap<object, string> | undefined = locals.__docsToolkitViewModeHrefs;
  restoreSidebar(route.sidebar, mode, route.locale, saved);

  if (route.pagination?.prev?.href) {
    route.pagination.prev.href = insertModePrefix(route.pagination.prev.href, mode, route.locale);
  }
  if (route.pagination?.next?.href) {
    route.pagination.next.href = insertModePrefix(route.pagination.next.href, mode, route.locale);
  }
});
