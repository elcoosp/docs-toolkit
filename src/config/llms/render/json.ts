import { PageEntry, ResolvedLlmsConfig } from '../types.js';

export function renderJson(pages: PageEntry[], cfg: ResolvedLlmsConfig, locale = 'en'): string {
  const scoped = pages.filter((p) => p.locale === locale);
  return JSON.stringify(
    {
      $schema: 'llmstxt.org',
      title: locale === 'fr' ? cfg.title + ' (Français)' : cfg.title,
      description: cfg.description,
      locale,
      url: cfg.url,
      source: cfg.source || undefined,
      pages: scoped.map((p) => ({
        slug: p.slug,
        locale: p.locale,
        route: p.route,
        markdownRoute: p.markdownRoute,
        title: p.title,
        description: p.description,
        type: p.type || undefined,
        order: p.order,
        section: p.section,
      })),
    },
    null,
    2,
  );
}
