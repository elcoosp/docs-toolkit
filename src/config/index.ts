import fs from 'node:fs';
import path from 'node:path';
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
import mermaid from 'astro-mermaid';
import starlightChangelogs, { makeChangelogsSidebarLinks } from 'starlight-changelogs';
import starlightAutoSidebar from 'starlight-auto-sidebar';
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

export interface SectionSpec {
  key: string;
  en: string;
  fr: string;
  collapsed?: boolean;
}

export interface DocsConfigOptions {
  site: string;
  github?: string;
  sections?: SectionSpec[];
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
  sidebar?: StarlightUserConfig['sidebar'];
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

function findDocsRoot(): string {
  let dir = process.cwd();
  while (dir !== '/') {
    const candidate = path.join(dir, 'src/content/docs');
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return path.join(process.cwd(), 'src/content/docs');
}

function extractGitHubRepo(options: DocsConfigOptions): string | null {
  const social = options.social as any[] | undefined;
  if (social?.[0]?.href) {
    const m = String(social[0].href).match(/github\.com\/([^/]+\/[^/]+)/);
    if (m) return m[1];
  }
  if (options.editLink?.baseUrl) {
    const m = options.editLink.baseUrl.match(/github\.com\/([^/]+\/[^/]+)/);
    if (m) return m[1];
  }
  return null;
}

function buildSectionsSidebar(
  sections: SectionSpec[],
  docsRoot: string,
): NonNullable<StarlightUserConfig['sidebar']> {
  const items: any[] = [];
  if (fs.existsSync(path.join(docsRoot, 'index.mdx')) || fs.existsSync(path.join(docsRoot, 'index.md'))) {
    items.push({ label: 'Overview', translations: { fr: 'Aperçu' }, link: '/' });
  }
  for (const sec of sections) {
    if (!fs.existsSync(path.join(docsRoot, sec.key))) continue;
    const collapsed = sec.collapsed ?? (sec.key === 'reference' || sec.key === 'explanation');
    items.push({
      label: sec.en,
      translations: { fr: sec.fr },
      collapsed,
      items: [{ autogenerate: { directory: sec.key, collapsed } }],
    });
  }
  return items;
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

  const githubRepo =
    options.github ??
    extractGitHubRepo(options) ??
    `elcoosp/${projectName.toLowerCase().replace(/\s+/g, '-')}`;
  const finalSocial = social.length > 0
    ? social
    : [{
        icon: 'github' as const,
        label: 'GitHub',
        translations: { fr: 'GitHub' },
        href: `https://github.com/${githubRepo}`,
      }];
  const finalEditLink = editLink ?? {
    baseUrl: `https://github.com/${githubRepo}/edit/main/${path.basename(process.cwd())}/src/content/docs/`,
  };

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
  starlightPlugins.push(starlightAutoSidebar());
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
  let finalSidebarSource: any[];
  if (options.sections) {
    finalSidebarSource = buildSectionsSidebar(options.sections, findDocsRoot());
  } else if (Array.isArray(_extraSidebar) && _extraSidebar.length > 0) {
    finalSidebarSource = _extraSidebar;
  } else {
    finalSidebarSource = sidebar ?? [];
  }
  const mergedSidebar = autoTranslateSidebar([...finalSidebarSource, changelogGroup]);

  const starlightOptions: StarlightUserConfig = {
    components: { MarkdownContent: '@elcoosp/docs-toolkit/src/config/components/MarkdownContent.astro' },
    routeMiddleware, disable404Route: true, expressiveCode, title, description,
    logo: { src: logoPath }, favicon, customCss, social: finalSocial,
    editLink: finalEditLink,
    locales: locales || { root: { label: 'English', lang: 'en' }, fr: { label: 'Français', lang: 'fr' } },
    ...(defaultLocale ? { defaultLocale } : {}),
    plugins: mergedPlugins,
    head: [...((extraStarlight as any)?.head ?? []), ...(headLink ? [headLink] : [])],
    sidebar: mergedSidebar,
    ...extraStarlightRest,
  };

  const integrations: NonNullable<AstroUserConfig['integrations']> = [
    mermaid(), starlight(starlightOptions), ...extraIntegrations,
    astroTakumi({ options: { domBackend: 'linkedom', fonts: [fontBuf], width: 1200, height: 630, format: 'png' }, render } as unknown as Parameters<typeof astroTakumi>[0]),
  ];

  if (llmsTxt !== false && resolvedLlms) integrations.push(llmsIntegration(resolvedLlms));

  return defineConfig({
    vite: {
      plugins: [

    {
      name: 'docs-toolkit:resolve-image-zoom-virtual',
      resolveId(id) {
        if (id === 'virtual:starlight-image-zoom-config') {
          return '\0virtual:starlight-image-zoom-config';
        }
      },
      load(id) {
        if (id === '\0virtual:starlight-image-zoom-config') {
          return 'export default {};';
        }
      },
    },
      ], build: { chunkSizeWarningLimit: 1000 }, ssr: { noExternal: [] }, ...extraVite },
    ...(site ? { site } : {}), ...(base ? { base } : {}), integrations,
  });
}
