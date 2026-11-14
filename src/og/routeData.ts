import { getImagePath } from '@elcoosp/astro-takumi';

interface MetaTag {
  tag: 'meta';
  attrs: Record<string, string>;
}

interface StarlightRoute {
  head: MetaTag[];
  entry?: { data?: { title?: string; description?: string } };
}

export interface RouteContext {
  url: URL;
  site?: URL;
  locals: { starlightRoute?: StarlightRoute };
}

/**
 * Owns og:image for every page.
 *
 * starlight-seo's image.src pattern and takumi's getImagePath cannot agree
 * on homepages (`index/index.png` vs `index.png`) or view-mode variants.
 * So the plugin writes JSON-LD, titles, descriptions, breadcrumbs, and audit
 * (its image option is not set), while this module writes og:image using
 * `getImagePath` — the exact path takumi writes to disk. Mismatch is
 * structurally impossible.
 */
export const onRequest = (context: RouteContext): void => {
  const route = context.locals.starlightRoute;
  if (!route) return;
  const ogImageUrl = getImagePath({ url: context.url, site: context.site });
  route.head.push({ tag: 'meta', attrs: { property: 'og:image', content: ogImageUrl } });
};
