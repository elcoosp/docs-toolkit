import { defineCollection } from 'astro:content';
import { z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

type BlogSchemaFn = (ctx: any) => any;
interface MakeDocsOpts {
  blogSchema?: BlogSchemaFn;
}

export function makeDocsCollection(opts: MakeDocsOpts = {}): any {
  return defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: (ctx: any) => {
        if (!opts.blogSchema) return z.object({});
        const blog = opts.blogSchema(ctx) as any;
        if (blog && typeof blog === 'object' && typeof blog.extend === 'function') {
          return blog.extend({
            date: z.coerce.date().default(() => new Date()),
          });
        }
        return blog;
      },
    }) as any,
  });
}
