import { defineCollection } from 'astro:content';
import { z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

type BlogSchemaFn = (ctx: any) => any;
interface MakeDocsOpts { blogSchema?: BlogSchemaFn }

/**
 * Passthrough for the site's blogSchema, with one addition: `date` gets a
 * Zod default. starlight-blog's `validateBlogEntry` throws "Missing date
 * for blog entry" at build time even though its Zod schema marks date
 * optional via `.partial()`. A Zod default satisfies both Zod and the
 * runtime validator.
 *
 * No seoSchema. `seo:` frontmatter isn't needed — plugin's title.templates
 * + description: frontmatter + routeData og:image + JSON-LD @graph cover
 * all SEO output. seoSchema was the trigger for a `sidebar` ZodEffects
 * collision against starlight 0.42.11 + starlight-blog 0.30.2 that we
 * couldn't compose around.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeDocsCollection(opts: MakeDocsOpts = {}): any {
  return defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extend: (ctx: any) => {
        if (!opts.blogSchema) return z.object({});
        return (opts.blogSchema(ctx) as any).extend({
          date: z.date().default(() => new Date()),
        });
      },
    }) as any,
  });
}
