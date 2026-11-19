import { z } from 'astro/zod';
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
      schema: i18nSchema({
        extend: z.object({
          'pageActions.copy': z.string(),
          'pageActions.copyTitle': z.string(),
          'pageActions.copied': z.string(),
          'pageActions.copyError': z.string(),
          'pageActions.openAi': z.string(),
          'pageActions.aiHeader': z.string(),
          'pageActions.share': z.string(),
          'pageActions.shareTitle': z.string(),
          'pageActions.linkCopied': z.string(),
          'pageActions.source': z.string(),
          'pageActions.sourceTitle': z.string(),
          'cmdk.button': z.string(),
          'cmdk.ariaLabel': z.string(),
          'cmdk.placeholder': z.string(),
          'cmdk.clear': z.string(),
          'cmdk.nav': z.string(),
          'cmdk.open': z.string(),
          'cmdk.newTab': z.string(),
          'cmdk.copy': z.string(),
          'cmdk.pin': z.string(),
          'cmdk.filter': z.string(),
          'cmdk.close': z.string(),
          'cmdk.changelog': z.string(),
          'cmdk.actionZen': z.string(),
          'cmdk.actionZenDesc': z.string(),
          'cmdk.actionTheme': z.string(),
          'cmdk.actionThemeDesc': z.string(),
          'cmdk.actionChangelog': z.string(),
          'cmdk.actionChangelogDesc': z.string(),
          'cmdk.actionCopyMd': z.string(),
          'cmdk.actionCopyMdDesc': z.string(),
          'cmdk.actionLangSwitch': z.string(),
          'cmdk.actionLangSwitchDesc': z.string(),
          'cmdk.actionAskAi': z.string(),
          'cmdk.actionAskAiDesc': z.string(),
          'cmdk.groupWorkspace': z.string(),
          'cmdk.groupLanguage': z.string(),
          'cmdk.groupAi': z.string(),
          'cmdk.moreAi': z.string(),
          'cmdk.lessAi': z.string(),
          'sinceBadges.new': z.string(),
          'sinceBadges.breaking': z.string(),
          'sinceBadges.deprecated': z.string(),
          'linkPreview.overview': z.string(),
          'linkPreview.tutorial': z.string(),
          'linkPreview.guide': z.string(),
          'linkPreview.reference': z.string(),
          'linkPreview.explanation': z.string(),
          'linkPreview.blog': z.string(),
          'linkPreview.changelog': z.string(),
          'llms.overview': z.string(),
          'llms.tutorials': z.string(),
          'llms.guides': z.string(),
          'llms.reference': z.string(),
          'llms.explanation': z.string(),
          'llms.changelog': z.string(),
          'llms.optional': z.string(),
          'llms.fullSubtitle': z.string(),
          'llms.smallSubtitle': z.string(),
          'llms.localeLabel': z.string(),
        }).partial(),
      }),
    }),
  };
}
