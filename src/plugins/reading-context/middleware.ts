import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import type { ReadingContextData } from './index';

function estimateTechnicalReadingMinutes(body: string): number {
  if (!body) return 1;
  let codeWords = 0;
  const proseOnly = body.replaceAll(/```[\s(\S)]*?```/g, (block) => {
    const inner = block.replaceAll(/^```[^\n]*\n?|```$/g, '');
    codeWords += inner.trim().split(/\s+/).filter(Boolean).length;
    return ' ';
  });
  const cleanedProse = proseOnly
    .replace(/^---[\s\S]*?---/, '')
    .replaceAll(/^import\s+.*$/gm, '')
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll(/[#>*_`[\]()|-]/g, ' ');
  const proseWords = cleanedProse.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(proseWords / 220 + codeWords / 110));
}

function detectSection(pathname: string, isFr: boolean): string {
  const p = isFr ? pathname.replace(/^\/fr/, '') || '/' : pathname;
  if (p.startsWith('/tutorials/')) return isFr ? 'Tutoriel' : 'Tutorial';
  if (p.startsWith('/guides/')) return isFr ? 'Guide pratique' : 'How-to Guide';
  if (p.startsWith('/reference/')) return isFr ? 'Référence' : 'Reference';
  if (p.startsWith('/explanation/')) return isFr ? 'Explication' : 'Explanation';
  if (p.startsWith('/blog/')) return 'Blog';
  if (p.startsWith('/changelog/')) return 'Changelog';
  return isFr ? 'Aperçu' : 'Overview';
}

function formatStatusLabel(status: string, isFr: boolean): string {
  if (status === 'experimental') return isFr ? 'Expérimental' : 'Experimental';
  if (status === 'beta') return isFr ? 'Bêta' : 'Beta';
  if (status === 'deprecated') return isFr ? 'Déprécié' : 'Deprecated';
  return 'Stable';
}

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  if (!route) return;

  const pathname = context.url.pathname;
  const isFr = route.locale === 'fr' || pathname === '/fr' || pathname.startsWith('/fr/');
  const entry = route.entry as any;
  const data = (entry?.data ?? {}) as Record<string, any>;
  const body = typeof entry?.body === 'string' ? entry.body : '';

  const minutes = estimateTechnicalReadingMinutes(body);
  const readingLabel = isFr ? `${minutes} min de lecture` : `${minutes} min read`;

  const rawStatus = typeof data.status === 'string' ? data.status.toLowerCase() : undefined;
  const valid = new Set(['stable', 'experimental', 'beta', 'deprecated']);
  const status = rawStatus && valid.has(rawStatus) ? (rawStatus as ReadingContextData['status']) : undefined;
  const statusLabel = status ? formatStatusLabel(status, isFr) : undefined;
  const since = typeof data.since === 'string' && data.since.trim() ? data.since.trim() : undefined;

  let updatedLabel: string | undefined;
  if (route.lastUpdated instanceof Date && !Number.isNaN(route.lastUpdated.getTime())) {
    const formatted = new Intl.DateTimeFormat(isFr ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(route.lastUpdated);
    updatedLabel = isFr ? `Mis à jour le ${formatted}` : `Updated ${formatted}`;
  }

  const editUrl = route.editUrl ? String(route.editUrl) : undefined;
  const editLabel = isFr ? 'Modifier cette page' : 'Edit page';

  (context.locals as any).readingContext = {
    minutes,
    readingLabel,
    sectionLabel: detectSection(pathname, isFr),
    ...(status ? { status, statusLabel } : {}),
    ...(since ? { since } : {}),
    ...(updatedLabel ? { updatedLabel } : {}),
    ...(editUrl ? { editUrl } : {}),
    editLabel,
  } satisfies ReadingContextData;
});
