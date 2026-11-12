import fs from 'node:fs';
import { ROBOTO_BASE64 } from '../assets/font-b64';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import type { AstroUserConfig } from 'astro';
import starlight from '@astrojs/starlight';
import type { StarlightUserConfig } from '@astrojs/starlight/types';
import astroTakumi from 'astro-takumi';
import { makeRender } from '../og/og-render';
import { deriveAccent } from '../og/accent';
import { resolveLlmsConfig, llmsIntegration, llmsHeadLink } from './llms';
import type { LlmsTxtConfig } from './llms';

import starlightTelescope from 'starlight-telescope';
import starlightFullviewMode from 'starlight-fullview-mode';
import starlightTags from 'starlight-tags';
import starlightScrollToTop from 'starlight-scroll-to-top';
import starlightAnnouncement from 'starlight-announcement';

import starlightSeo from 'starlight-seo';
import mermaid from 'astro-mermaid';
import starlightChangelogs, { makeChangelogsSidebarLinks } from 'starlight-changelogs';



export type { LlmsTxtConfig } from './llms';
export { DEFAULT_SECTIONS as DEFAULT_LLMS_SETS, detectSections } from './llms';

export interface DocsConfigOptions {
  site: string;
  domain: string;
  title: string;
  projectName?: string;
  description: string;
  logoPath?: string;
  favicon?: string;
  customCss?: string[];
  social?: StarlightUserConfig['social'];
  editLink?: StarlightUserConfig['editLink'];
  locales?: StarlightUserConfig['locales'];
  defaultLocale?: StarlightUserConfig['defaultLocale'];
  plugins?: StarlightUserConfig['plugins'];
  sidebar: StarlightUserConfig['sidebar'];
  routeMiddleware?: string;
  base?: string;
  accentOverride?: string;
  expressiveCode?: StarlightUserConfig['expressiveCode'];
  extraStarlight?: Partial<StarlightUserConfig>;
  extraIntegrations?: NonNullable<AstroUserConfig['integrations']>;
  extraVite?: Record<string, unknown>;
  /** Configure starlight-llms-txt. `false` disables the plugin entirely. */
  llmsTxt?: LlmsTxtConfig | false;
  giscus?: any;
  blog?: boolean | Record<string, unknown>;
}

export async function defineDocsConfig(
  options: DocsConfigOptions,
): Promise<AstroUserConfig> {
  const {
    site,
    domain,
    title,
    projectName = title,
    description,
    logoPath = './src/assets/logo.png',
    favicon = '/favicon.png',
    customCss = ['./src/styles/custom.css'],
    social = [],
    editLink,
    locales,
    defaultLocale = 'root',
    plugins = [],
    sidebar,
    routeMiddleware = './src/routeData.ts',
    base,
    accentOverride,
    expressiveCode = { themes: ['github-light', 'github-dark'] },
    extraStarlight = {},
    extraIntegrations = [],
    extraVite = {},
    llmsTxt = {},
  } = options;

  const accent = accentOverride
    ? { hex: accentOverride, hexA12: accentOverride + '1a' }
    : await deriveAccent(logoPath);

  const logoB64 = fs.readFileSync(logoPath).toString('base64');
  const render = makeRender({
    logoDataUrl: 'data:image/png;base64,' + logoB64,
    accentHex: accent.hex,
    accentHexA12: accent.hexA12,
    domain,
    projectName,
  });

  const fontBuf = Buffer.from(ROBOTO_BASE64, 'base64');

  const starlightPlugins = [...plugins, starlightChangelogs()];
  // Giscus — lazy-loaded only when opted in. Dynamic import avoids resolving
  // starlight-giscus's raw .ts entry at config-load time (Node >= 22.18 refuses
  // type-stripping under node_modules: ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING).
  if (options.giscus) {
    const giscusMod: any = await import('starlight-giscus');
    starlightPlugins.push(giscusMod.default(options.giscus));
  }
  // Blog — same rationale.
  if ((options as any).blog) {
    const blogMod: any = await import('starlight-blog');
    const blogOpts = (options as any).blog === true ? {} : (options as any).blog;
    starlightPlugins.push(blogMod.default(blogOpts));
  }



  const changelogGroup = {
    label: 'Changelog',
    items: makeChangelogsSidebarLinks([
      { type: 'all', base: 'changelog', label: 'All versions' },
    ]),
  };

  let headLink: any = undefined;
  let resolvedLlms: any = undefined;
  if (llmsTxt !== false) {
    resolvedLlms = resolveLlmsConfig(llmsTxt ?? {}, { title, description, site, source: undefined });
    if (resolvedLlms.outputs.headLink) headLink = llmsHeadLink();
  }

  // Merge plugins/sidebar from extraStarlight instead of letting the trailing
  // extraStarlight spread clobber injected plugins or the changelog sidebar.
  const {
    plugins: _extraPlugins = [] as StarlightUserConfig['plugins'],
    sidebar: _extraSidebar,
    ...extraStarlightRest
  } = (extraStarlight as any) ?? {};

  const mergedPlugins = [...((_extraPlugins as any[]) ?? []), ...starlightPlugins];
  const mergedSidebar = (Array.isArray(_extraSidebar) && _extraSidebar.length > 0)
    ? [..._extraSidebar, changelogGroup]
    : [...sidebar, changelogGroup];

  const starlightOptions: StarlightUserConfig = {
    components: {
      PageTitle: '@elcoosp/docs-toolkit/PageActions.astro',
    },
    routeMiddleware,
    disable404Route: true,
    expressiveCode,
    title,
    description,
    logo: { src: logoPath },
    favicon,
    customCss,
    social,
    ...(editLink ? { editLink } : {}),
    locales: locales || { root: { label: 'English', lang: 'en' }, fr: { label: 'Français', lang: 'fr' } },
    ...(defaultLocale ? { defaultLocale } : {}),
    plugins: mergedPlugins,
    head: [...((extraStarlight as any)?.head ?? []), ...(headLink ? [headLink] : [])],
    sidebar: mergedSidebar,
    ...extraStarlightRest,
  };

  const integrations: NonNullable<AstroUserConfig['integrations']> = [
    mermaid(), // MUST be before starlight
    starlight(starlightOptions),
    ...extraIntegrations,
    astroTakumi({
      options: {
        domBackend: 'linkedom',
        fonts: [fontBuf],
        width: 1200,
        height: 630,
        format: 'png',
      },
      render,
    } as unknown as Parameters<typeof astroTakumi>[0]),
  ];

  if (llmsTxt !== false && resolvedLlms) {
    integrations.push(llmsIntegration(resolvedLlms));
  }

  return defineConfig({
    vite: { build: { chunkSizeWarningLimit: 1000 }, ssr: { external: ['jsdom', 'astro-takumi'], noExternal: ['starlight-llms-txt'] }, ...extraVite },
    ...(site ? { site } : {}),
    ...(base ? { base } : {}),
    integrations,
  });
}
