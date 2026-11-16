import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
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
        const extraFields = {
          status: z.enum(['stable', 'experimental', 'beta', 'deprecated']).optional(),
          since: z.string().optional(),
        };
        if (!opts.blogSchema) return z.object(extraFields);
        const blog = opts.blogSchema(ctx) as any;
        if (blog && typeof blog === 'object' && typeof blog.extend === 'function') {
          return blog.extend({ ...extraFields, date: z.coerce.date().default(() => new Date()) });
        }
        return blog;
      },
    }) as any,
  });
}
