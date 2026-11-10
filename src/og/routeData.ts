import { getImagePath } from 'astro-takumi';

interface MetaTag {
  tag: 'meta';
  attrs: Record<string, string>;
}

interface ScriptTag {
  tag: 'script';
  attrs: Record<string, string>;
  content: string;
}

interface StarlightRoute {
  head: Array<MetaTag | ScriptTag>;
  entry?: { data?: { title?: string; description?: string } };
}

export interface RouteContext {
  url: URL;
  site?: URL;
  locals: { starlightRoute: StarlightRoute };
}

export const onRequest = (context: RouteContext): void => {
  const route = context.locals.starlightRoute;
  const pathname = context.url.pathname;
  const is404 =
    pathname === '/404' ||
    pathname === '/404/' ||
    pathname === '/404.html';

  const ogImageUrl = getImagePath({ url: context.url, site: context.site });
  const title = route.entry?.data?.title ?? '';
  const description = route.entry?.data?.description;

  route.head.push({ tag: 'meta', attrs: { property: 'og:title', content: title } });
  route.head.push({ tag: 'meta', attrs: { property: 'og:type', content: 'website' } });
  route.head.push({ tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } });

  route.head.push({ tag: 'meta', attrs: { property: 'og:image', content: ogImageUrl } });
  route.head.push({ tag: 'meta', attrs: { name: 'twitter:image', content: ogImageUrl } });

  if (description) {
    route.head.push({ tag: 'meta', attrs: { property: 'og:description', content: description } });
  }

  if (is404 || !context.site) return;

  const fullUrl = new URL(pathname, context.site).toString();

  const techArticle = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description: description ?? undefined,
    url: fullUrl,
    image: ogImageUrl,
    inLanguage: 'en',
    isPartOf: {
      '@type': 'WebSite',
      name: context.site.hostname,
      url: context.site.origin,
    },
  };

  // Breadcrumb only makes sense on non-home pages.
  if (pathname !== '/' && pathname !== '') {
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: context.site.origin },
        { '@type': 'ListItem', position: 2, name: title || pathname, item: fullUrl },
      ],
    };
    route.head.push({ tag: 'script', attrs: { type: 'application/ld+json' }, content: JSON.stringify(breadcrumb) });
  }
};
