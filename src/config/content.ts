import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { seoSchema } from 'starlight-seo/schema';

type SchemaExtend = (ctx: unknown) => { merge: (other: unknown) => unknown };

interface MakeDocsOpts {
  /**
   * The site's blog schema extension (from `starlight-blog/schema`). Passed
   * in by the caller so the toolkit does NOT import `starlight-blog` — that
   * would bundle it eagerly into `dist/index.mjs`, breaking sites without
   * the package installed and tripping the toolkit's own `check:dist` guard.
   */
  blogSchema?: SchemaExtend;
}

/**
 * Build the Starlight `docs` collection with `seoSchema` merged in, plus the
 * site's `blogSchema` if provided.
 *
 * **The toolkit has no direct import of `starlight-blog`.** The caller passes
 * `blogSchema` in (they already import it for their own use). This keeps the
 * toolkit's bundle clean.
 *
 * Sites must:
 *   1. Import `blogSchema` (already done for sites with `/blog/**`)
 *   2. Call `makeDocsCollection({ blogSchema })`
 *   3. NOT define a second `docs:` key in `collections` — the second one
 *      would override this and silently strip seoSchema (JS object literal
 *      last-key-wins semantics; the bug this whole rollout fixes).
 *
 * Return type is `any` — the emitted DTS must be name-able without dragging
 * in starlight-internal types (TS2883, TS2322 on tsdown's generator).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeDocsCollection(opts: MakeDocsOpts = {}): any {
  const seo = seoSchema();
  return defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extend: (ctx: any) => {
        const base = opts.blogSchema ? (opts.blogSchema(ctx) as any) : seo;
        return opts.blogSchema ? base.merge(seo) : seo;
      },
    }) as any,
  });
}
