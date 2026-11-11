import { PageEntry, ResolvedLlmsConfig } from '../types.js';

export function renderJson(pages: PageEntry[], cfg: ResolvedLlmsConfig): string {
  return JSON.stringify({
    $schema: "https://llmstxt.org/schema.json",
    title: cfg.title,
    description: cfg.description,
    url: cfg.url,
    source: cfg.source,
    pages: pages.map(p => ({
      slug: p.slug,
      route: p.route,
      markdownRoute: p.markdownRoute,
      title: p.title,
      description: p.description,
      type: p.type,
      order: p.order,
      section: p.section
    }))
  }, null, 2);
}
