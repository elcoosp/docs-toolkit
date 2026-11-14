import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Loader for `_meta.{yml,yaml}` files consumed by `starlight-auto-sidebar`.
 * Import this from a site's `content.config.ts` — never from `astro.config.mjs`
 * — because `astro:content` is only resolvable inside Astro's content pipeline.
 *
 *   import { docsMetadataCollection } from '@elcoosp/docs-toolkit/src/config/content.ts';
 */
export const docsMetadataCollection = defineCollection({
  loader: glob({ base: './src/content/docs', pattern: '**/_meta.{yml,yaml}' }),
  schema: z
    .object({
      label: z.string().optional(),
      order: z.array(z.string()).optional(),
      sort: z.enum(['label', 'filename']).optional(),
      collapsed: z.boolean().optional(),
      hidden: z.boolean().optional(),
      depth: z.number().optional(),
      cascade: z.record(z.unknown()).optional(),
    })
    .passthrough(),
});
