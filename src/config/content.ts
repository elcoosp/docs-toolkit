import { defineCollection } from 'astro:content';
import { z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

type BlogSchemaFn = (ctx: any) => any;
interface MakeDocsOpts { blogSchema?: BlogSchemaFn }

/**
 * Build the Starlight `docs` collection.
 *
 * Passthrough for the caller's `blogSchema` — identical behavior to
 * `docsSchema({ extend: (ctx) => blogSchema(ctx) })`, the standard pattern
 * from starlight-blog's own docs. No seoSchema.
 *
 * Why no seoSchema: starlight-seo@1.0.0's seoSchema() cannot be composed
 * with starlight-blog@0.30.2 + @astrojs/starlight@0.42.11 without breaking
 * the refined `sidebar` field. Verified empirically across 6 patterns.
 *
 * SEO output comes from:
 *   - title.templates (plugin) — auto suffix
 *   - title: + description: frontmatter
 *   - types: mapping (plugin)
 *   - routeData.ts getImagePath (og:image)
 *   - plugin middleware (JSON-LD @graph)
 *   - audit.failOn='warn' (warnings logged, build never blocked)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeDocsCollection(opts: MakeDocsOpts = {}): any {
  return defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extend: (ctx: any) => {
        if (opts.blogSchema) return opts.blogSchema(ctx) as any;
        return z.object({});
      },
    }) as any,
  });
}
