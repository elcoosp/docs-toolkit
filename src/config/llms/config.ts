import { LlmsTxtConfig, ResolvedLlmsConfig } from './types.js';
import { detectSections, DEFAULT_SECTIONS } from './sections.js';

export function resolveLlmsConfig(input: LlmsTxtConfig, ctx: { title: string, description: string, site?: string, source?: string }): ResolvedLlmsConfig {
  const sets = input.sets || detectSections() || DEFAULT_SECTIONS;
  return {
    title: input.title ?? ctx.title,
    description: input.description ?? ctx.description,
    url: input.url ?? ctx.site ?? '',
    source: input.source ?? ctx.source ?? '',
    sets,
    exclude: input.exclude ?? [],
    optional: input.optional ?? [],
    outputs: {
      index: input.outputs?.index ?? true,
      full: input.outputs?.full ?? true,
      small: input.outputs?.small ?? true,
      json: input.outputs?.json ?? true,       // Default TRUE for state-of-the-art
      pages: input.outputs?.pages ?? true,     // Default TRUE for state-of-the-art
      robots: input.outputs?.robots ?? true,
      headLink: input.outputs?.headLink ?? true,
    }
  };
}
