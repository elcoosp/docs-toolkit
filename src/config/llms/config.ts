import type { LlmsTxtConfig, ResolvedLlmsConfig } from './types.js';
import { detectSections, DEFAULT_SECTIONS } from './sections.js';

export function resolveLlmsConfig(
  input: LlmsTxtConfig,
  ctx: { title: string; description: string; site?: string; source?: string; locales?: string[] },
): ResolvedLlmsConfig {
  const sets = input.sets || detectSections() || DEFAULT_SECTIONS;
  const cleanUrl = (input.url ?? ctx.site ?? '').replace(/\/+$/, '');
  return {
    title: input.title ?? ctx.title,
    description: input.description ?? ctx.description,
    url: cleanUrl,
    source: input.source ?? ctx.source ?? '',
    locales: ctx.locales ?? [],
    sets,
    exclude: input.exclude ?? ['404', '**/404', 'zen-mode/**'],
    optional: input.optional ?? ['blog/**', 'changelog/**'],
    outputs: {
      index: input.outputs?.index ?? true,
      full: input.outputs?.full ?? true,
      small: input.outputs?.small ?? true,
      json: input.outputs?.json ?? true,
      pages: input.outputs?.pages ?? true,
      robots: input.outputs?.robots ?? true,
      headLink: input.outputs?.headLink ?? true,
    },
  };
}
