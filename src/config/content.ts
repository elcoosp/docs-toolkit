import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { seoSchema } from 'starlight-seo/schema';

/**
 * Build the Starlight `docs` collection with `seoSchema()` merged in.
 *
 * Typed as `any`:
 *  - `docsSchema({ extend })` returns a *schema factory*, not a `ZodType`
 *    (TS2322 if annotated as ZodType).
 *  - The factory's fully-inferred return references `LinkHTMLAttributes`
 *    from starlight's internal sidebar schema, which tsdown's DTS
 *    generator (TS 7 `tsgo`) cannot name portably (TS2883).
 *  - `CollectionConfig` is not exported from `astro:content` (TS2305).
 *
 * Casting the schema argument to `any` breaks the deep inference chain in
 * `defineCollection`; annotating the return as `any` guarantees the emitted
 * `.d.mts` is name-able. Runtime unchanged — the `as any` and the type
 * annotation are erased at compile time. Consumers only place the returned
 * value into their `collections` export, so no ergonomic loss.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeDocsCollection(): any {
  return defineCollection({
    loader: docsLoader(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: docsSchema({ extend: seoSchema() }) as any,
  });
}
