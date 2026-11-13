import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import type { AstroUserConfig } from 'astro';
import starlight from '@astrojs/starlight';
import type { StarlightUserConfig } from '@astrojs/starlight/types';
import astroTakumi from '@elcoosp/astro-takumi';
import { makeRender } from '../og/og-render';
import { deriveAccent } from '../og/accent';
import { resolveLlmsConfig, llmsIntegration, llmsHeadLink } from './llms';
import type { LlmsTxtConfig } from './llms';
import { ROBOTO_BASE64 } from '../assets/font-b64';
import starlightChangelogs, { makeChangelogsSidebarLinks } from 'starlight-changelogs';
import starlightBlog from 'starlight-blog';
import starlightViewModes from 'starlight-view-modes';
import starlightTelescope from 'starlight-telescope';
import starlightSeo from 'starlight-seo';
import starlightAnnouncement from 'starlight-announcement';
import starlightScrollToTop from 'starlight-scroll-to-top';
import GithubSlugger from 'github-slugger';
import { autoTranslateSidebar } from './i18n/sidebar-labels';

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
  llmsTxt?: LlmsTxtConfig | false;
  giscus?: any;
  blog?: boolean | Record<string, unknown>;
}

export async function defineDocsConfig(
  options: DocsConfigOptions,
): Promise<AstroUserConfig> {
  const {
    site, domain, title, projectName = title, description,
    logoPath = './src/assets/logo.png', favicon = '/favicon.png',
    customCss = ['./src/styles/custom.css'], social = [], editLink,
    locales, defaultLocale = 'root', plugins = [], sidebar,
    routeMiddleware = './src/routeData.ts', base, accentOverride,
    expressiveCode = { themes: ['github-light', 'github-dark'] },
    extraStarlight = {}, extraIntegrations = [], extraVite = {}, llmsTxt = {},
  } = options;

  const accent = accentOverride ? { hex: accentOverride, hexA12: accentOverride + '1a' } : await deriveAccent(logoPath);
  const logoB64 = fs.readFileSync(logoPath).toString('base64');
  const render = makeRender({ logoDataUrl: 'data:image/png;base64,' + logoB64, accentHex: accent.hex, accentHexA12: accent.hexA12, domain, projectName });
  const fontBuf = Buffer.from(ROBOTO_BASE64, 'base64');

  const starlightPlugins: any[] = [];

  starlightPlugins.push(starlightTelescope());
  starlightPlugins.push(starlightBlog({ title: { en: 'Blog', fr: 'Blog' }, prefix: 'blog', authors: { elcoosp: { name: 'Elcoosp Core Maintainer', title: 'Core Maintainer', picture: 'https://github.com/elcoosp.png?size=200', url: 'https://github.com/elcoosp' } } }));
  starlightPlugins.push(starlightViewModes({ zenModeEnabled: true }));
starlightPlugins.push(starlightSeo({ audit: { failOn: 'off' }, publisher: { name: 'Elcoosp', url: 'https://github.com/elcoosp' } }));
  starlightPlugins.push(starlightScrollToTop());
  starlightPlugins.push(starlightChangelogs());

  // Auto-expiring announcement
  let announcement = null;
  try {
    const changelogPath = fs.existsSync('../../CHANGELOG.md') ? '../../CHANGELOG.md' : fs.existsSync('../CHANGELOG.md') ? '../CHANGELOG.md' : null;
    if (changelogPath) {
      const changelog = fs.readFileSync(changelogPath, 'utf8');
      const lines = changelog.split('\n');
      const versionLine = lines.find(l => l.startsWith('## ') && !l.toLowerCase().includes('unreleased'));
      if (versionLine) {
        const headingText = versionLine.replace(/^##\s+/, '').trim();
        const versionMatch = headingText.match(/\d+\.\d+\.\d+/);
        const version = versionMatch ? versionMatch[0] : null;
        const dateMatch = headingText.match(/\d{4}-\d{2}-\d{2}/);
        const releaseDate = dateMatch ? dateMatch[0] : null;
        if (version) {
          const slugger = new GithubSlugger();
          const slug = slugger.slug(headingText.replace(/\./g, '-'));
          let startDate, endDate;
          if (releaseDate) {
            startDate = releaseDate;
            const end = new Date(releaseDate);
            end.setDate(end.getDate() + 30);
            endDate = end.toISOString().split('T')[0];
          }
          announcement = { id: 'latest-release', content: { en: `New release: v${version} — see what changed.`, fr: `Nouvelle version : v${version} — voir les changements.` }, link: { href: `/changelog/#${slug}`, text: { en: 'Read changelog', fr: 'Lire le journal' } }, variant: 'note', ...(startDate ? { startDate, endDate } : {}) };
        }
      }
    }
  } catch (e) {}

  if (announcement) {
    starlightPlugins.push(starlightAnnouncement({ announcements: [announcement] }));
  }

  const changelogGroup = { label: 'Changelog', items: makeChangelogsSidebarLinks([{ type: 'all', base: 'changelog', label: 'All versions' }]) };
  let headLink: any = undefined;
  let resolvedLlms: any = undefined;

  if (llmsTxt !== false) {
    resolvedLlms = resolveLlmsConfig(llmsTxt ?? {}, { title, description, site, source: undefined });
    if (resolvedLlms.outputs.headLink) headLink = llmsHeadLink();
  }

  const { plugins: _extraPlugins = [], sidebar: _extraSidebar, ...extraStarlightRest } = (extraStarlight as any) ?? {};
  const mergedPlugins = [...((_extraPlugins as any[]) ?? []), ...starlightPlugins];
  const mergedSidebar = autoTranslateSidebar((Array.isArray(_extraSidebar) && _extraSidebar.length > 0) ? [..._extraSidebar, changelogGroup] : [...sidebar, changelogGroup]);

  const starlightOptions: StarlightUserConfig = {
    components: { MarkdownContent: '@elcoosp/docs-toolkit/src/config/components/MarkdownContent.astro' },
    routeMiddleware, disable404Route: true, expressiveCode, title, description,
    logo: { src: logoPath }, favicon, customCss, social,
    ...(editLink ? { editLink } : {}),
    locales: locales || { root: { label: 'English', lang: 'en' }, fr: { label: 'Français', lang: 'fr' } },
    ...(defaultLocale ? { defaultLocale } : {}),
    plugins: mergedPlugins,
    head: [...((extraStarlight as any)?.head ?? []), ...(headLink ? [headLink] : [])],
    sidebar: mergedSidebar,
    ...extraStarlightRest,
  };

  const integrations: NonNullable<AstroUserConfig['integrations']> = [
    starlight(starlightOptions), ...extraIntegrations,
    astroTakumi({ options: { domBackend: 'linkedom', fonts: [fontBuf], width: 1200, height: 630, format: 'png' }, render } as unknown as Parameters<typeof astroTakumi>[0]),
  ];

  if (llmsTxt !== false && resolvedLlms) integrations.push(llmsIntegration(resolvedLlms));

  return defineConfig({
    vite: {
      optimizeDeps: {
        exclude: ['@takumi-rs/core'],
        include: ['@elcoosp/docs-toolkit > @elcoosp/astro-takumi'],
      },
      ssr: {
        external: ['@takumi-rs/core'],
        noExternal: true,
      }, ...extraVite },
    ...(site ? { site } : {}), ...(base ? { base } : {}), integrations,
  });
}
