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
 * 404-only metadata.
 *
 * starlight-seo excludes /404/ and /404.html by default ("the 404 page
 * always keeps whatever the site gives it"). Every other page is written
 * by the plugin middleware. This branch keeps the 404's social card —
 * which the plugin intentionally does not touch — and uses takumi's
 * getImagePath so the 404's og:image matches the file actually emitted
 * to disk (the recon shows every site's 404 emits /index.png).
 *
 * Fixes the previous bug: the old `is404` check only matched /404 and
 * missed /<locale>/404, which caused the wrong inLanguage on French
 * 404 pages (recon §5, INLANG BAD: /fr/404 html=fr jsonld=en).
 */
export const onRequest = (context: RouteContext): void => {
  const route = context.locals.starlightRoute;
  if (!route) return;

  const pathname = context.url.pathname;
  if (!/(^|\/)([a-z]{2}\/)?404(\/|\.html)?$/.test(pathname)) return;

  const ogImageUrl = getImagePath({ url: context.url, site: context.site });
  const title = route.entry?.data?.title ?? '';
  const description = route.entry?.data?.description;

  route.head.push({ tag: 'meta', attrs: { property: 'og:title', content: title } });
  route.head.push({ tag: 'meta', attrs: { property: 'og:image', content: ogImageUrl } });
  route.head.push({ tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } });
  route.head.push({ tag: 'meta', attrs: { name: 'twitter:image', content: ogImageUrl } });
  if (description) {
    route.head.push({ tag: 'meta', attrs: { property: 'og:description', content: description } });
  }
};
