import { defineCollection } from 'astro:content';
import { i18nLoader } from '@astrojs/starlight/loaders';
import { i18nSchema } from '@astrojs/starlight/schema';
import { changelogsLoader } from 'starlight-changelogs/loader';
import { blogSchema } from 'starlight-blog/schema';
import { autoSidebarLoader } from 'starlight-auto-sidebar/loader';
import { autoSidebarSchema } from 'starlight-auto-sidebar/schema';
import { makeDocsCollection } from './content.js';

export interface MakeCollectionsOpts {
  changelogPath?: string;
}

export function makeDocsCollections(opts: MakeCollectionsOpts = {}): any {
  return {
    docs: makeDocsCollection({ blogSchema }),
    autoSidebar: defineCollection({
      loader: autoSidebarLoader(),
      schema: autoSidebarSchema(),
    }),
    changelogs: defineCollection({
      loader: changelogsLoader([
        {
          provider: 'keep-a-changelog',
          base: 'changelog',
          changelog: opts.changelogPath ?? '../CHANGELOG.md',
          title: 'Changelog',
        },
      ]),
    }),
    i18n: defineCollection({
      loader: i18nLoader(),
      schema: i18nSchema(),
    }),
  };
}
