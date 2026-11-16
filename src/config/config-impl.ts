import { createRequire } from 'node:module';
const _toolkitRequire = createRequire(import.meta.url);
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import { defineConfig } from 'astro/config';
import type { AstroUserConfig } from 'astro';
import starlight from '@astrojs/starlight';
import type { StarlightUserConfig } from '@astrojs/starlight/types';
import astroTakumi from '@elcoosp/astro-takumi';
import { makeRender } from '../og/og-render';
import { deriveAccent, accentFromHex } from '../og/accent';
import { resolveLlmsConfig, llmsIntegration, llmsHeadLink } from './llms';
import type { LlmsTxtConfig } from './llms';
import { ROBOTO_BASE64 } from '../assets/font-b64';
import mermaid from 'astro-mermaid';


import { autoTranslateSidebar } from './i18n/sidebar-labels';



export type { LlmsTxtConfig } from './llms';
export { DEFAULT_SECTIONS as DEFAULT_LLMS_SETS, detectSections } from './llms';

export interface SectionSpec {
  key: string;
  en: string;
  fr: string;
  collapsed?: boolean;
}

const CANONICAL_SECTIONS: SectionSpec[] = [
  { key: 'tutorials', en: 'Tutorials', fr: 'Tutoriels', collapsed: false },
  { key: 'guides', en: 'How-to Guides', fr: 'Guides pratiques', collapsed: false },
  { key: 'reference', en: 'Reference', fr: 'Référence', collapsed: true },
  { key: 'explanation', en: 'Explanation', fr: 'Explication', collapsed: true },
];

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

function suppressHandledOverrideWarnings(plugin: any, componentNames: string[]): any {
  const setup = plugin?.hooks?.['config:setup'];
  if (typeof setup !== 'function') return plugin;
  return {
    ...plugin,
    hooks: {
      ...plugin.hooks,
      'config:setup'(ctx: any) {
        const origWarn = ctx.logger?.warn?.bind(ctx.logger);
        const filteredLogger = origWarn
          ? Object.assign(Object.create(ctx.logger), {
              warn(message: string, ...args: any[]) {
                if (
                  typeof message === 'string' &&
                  componentNames.some((name) => message.includes(name))
                ) {
                  return;
                }
                return origWarn(message, ...args);
              },
            })
          : ctx.logger;
        return setup({ ...ctx, logger: filteredLogger });
      },
    },
  };
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

const unwrapPlugin = <T>(m: T): T => {
  let cur: any = m;
  while (cur && typeof cur === 'object' && 'default' in cur) cur = cur.default;
  return cur;
};

export async function defineDocsConfig(
  options: DocsConfigOptions,
): Promise<AstroUserConfig> {
  const {
    site, domain, title, projectName = title, description,
    logoPath = './src/assets/logo.png', favicon = '/favicon.png',
    customCss = ['./src/styles/custom.css'], social = [], editLink,
    locales, defaultLocale = 'root', plugins = [], sidebar,
    routeMiddleware = './src/routeData.ts', base, accentOverride,
    expressiveCode = { themes: ['github-light', 'github-dark'], shiki: { langAlias: { 'github-actions': 'yaml' } } },
    extraStarlight = {}, extraIntegrations = [], extraVite = {}, llmsTxt = {},
  } = options;

  const toolkitI18nDir = fileURLToPath(new URL('../../i18n', import.meta.url));
  const siteI18nDir = path.join(path.dirname(findDocsRoot()), 'i18n');
  if (fs.existsSync(toolkitI18nDir)) {
    fs.mkdirSync(siteI18nDir, { recursive: true });
    for (const file of fs.readdirSync(toolkitI18nDir)) {
      if (!file.endsWith('.json')) continue;
      const srcContent = fs.readFileSync(path.join(toolkitI18nDir, file), 'utf8');
      const dstFile = path.join(siteI18nDir, file);
      if (!fs.existsSync(dstFile) || fs.readFileSync(dstFile, 'utf8') !== srcContent) {
        fs.writeFileSync(dstFile, srcContent);
      }
    }
  }

  const [
    { default: starlightChangelogs, makeChangelogsSidebarLinks },
    { default: starlightAutoSidebar },
    { default: starlightLinksValidator },
    { default: starlightBlog },
    { default: starlightViewModes },
    { default: starlightTelescope },
    { default: starlightSeo },
    { default: starlightAnnouncement },
    { default: starlightScrollToTop },
    { default: starlightImageZoom },
    { default: starlightHeadingBadges },
    { default: starlightGitHubAlerts },
    { default: starlightKbd },
  ] = await Promise.all([
    import('starlight-changelogs'),
    import('starlight-auto-sidebar'),
    import('starlight-links-validator'),
    import('starlight-blog'),
    import('starlight-view-modes'),
    import('starlight-telescope'),
    import('starlight-seo'),
    import('starlight-announcement'),
    import('starlight-scroll-to-top'),
    import('starlight-image-zoom'),
    import('starlight-heading-badges'),
    import('starlight-github-alerts'),
    import('starlight-kbd'),
  ]);

  const githubRepo =
    options.github ??
    extractGitHubRepo(options) ??
    `elcoosp/${projectName.toLowerCase().replace(/\s+/g, '-')}`;
  const finalSocial = social.length > 0
    ? social
    : [{
        icon: 'github' as const,
        label: 'GitHub',
        href: `https://github.com/${githubRepo}`,
      }];
  const finalEditLink = editLink ?? {
    baseUrl: `https://github.com/${githubRepo}/edit/main/${path.basename(process.cwd())}/src/content/docs/`,
  };

  const accent = accentOverride ? accentFromHex(accentOverride) : await deriveAccent(logoPath);
  const hasCustomAccent = customCss.some((rel) => {
    const abs = path.resolve(process.cwd(), rel);
    return fs.existsSync(abs) && fs.readFileSync(abs, 'utf8').includes('--sl-color-accent');
  });
  const autoAccentCss: string[] = [];
  if (!hasCustomAccent) {
    const astroCacheDir = path.resolve(process.cwd(), '.astro');
    fs.mkdirSync(astroCacheDir, { recursive: true });
    const generatedAccentCss = path.join(astroCacheDir, 'docs-toolkit-accent.css');
    const { light: al, dark: ad } = accent.hsl;
    fs.writeFileSync(
      generatedAccentCss,
      `:root {
  --sl-color-accent-low: hsl(${al.h} ${al.s}% ${al.low}%);
  --sl-color-accent: hsl(${al.h} ${al.s}% ${al.l}%);
  --sl-color-accent-high: hsl(${al.h} ${al.s}% ${al.high}%);
}
[data-theme="dark"] {
  --sl-color-accent-low: hsl(${ad.h} ${ad.s}% ${ad.low}%);
  --sl-color-accent: hsl(${ad.h} ${ad.s}% ${ad.l}%);
  --sl-color-accent-high: hsl(${ad.h} ${ad.s}% ${ad.high}%);
}
`,
    );
    autoAccentCss.push('./.astro/docs-toolkit-accent.css');
  }
  const logoB64 = fs.readFileSync(logoPath).toString('base64');
  const render = makeRender({ logoDataUrl: 'data:image/png;base64,' + logoB64, accentHex: accent.hex, accentHexA12: accent.hexA12, domain, projectName });
  const fontBuf = Buffer.from(ROBOTO_BASE64, 'base64');

  const starlightPlugins: any[] = [];

  // Mandatory: starlight-links-validator runs only on `astro build` and fails
  // the production build on broken internal links. `astro dev` and
  // `astro preview` are unaffected. There is no opt-out — every fleet site
  // is link-checked, and a broken internal link blocks deploy.
  starlightPlugins.push(unwrapPlugin(starlightLinksValidator)());

  starlightPlugins.push(unwrapPlugin(starlightTelescope)());
  starlightPlugins.push(suppressHandledOverrideWarnings(unwrapPlugin(starlightBlog)({ title: { en: 'Blog', fr: 'Blog' }, prefix: 'blog', authors: { elcoosp: { name: 'Elcoosp Core Maintainer', title: 'Core Maintainer', picture: 'https://github.com/elcoosp.png?size=200', url: 'https://github.com/elcoosp' } } }), ['MarkdownContent']));
  starlightPlugins.push(unwrapPlugin(starlightImageZoom)());
  starlightPlugins.push(unwrapPlugin(starlightHeadingBadges)());
  starlightPlugins.push(unwrapPlugin(starlightGitHubAlerts)());
  starlightPlugins.push(
    unwrapPlugin(starlightKbd)({
      globalPicker: false,
      types: [
        { id: 'mac', label: { en: 'macOS', fr: 'macOS' }, detector: 'apple', default: true },
        { id: 'windows', label: { en: 'Windows', fr: 'Windows' }, detector: 'windows' },
        { id: 'linux', label: { en: 'Linux', fr: 'Linux' }, detector: 'linux' },
      ],
    }),
  );
        starlightPlugins.push(suppressHandledOverrideWarnings(unwrapPlugin(starlightViewModes)({ zenModeSettings: { enabled: true }, presentationModeSettings: { enabled: false } }), ['TableOfContents']));
  starlightPlugins.push(unwrapPlugin(starlightSeo)({
    site: {
      name: title,
      alternateName: domain,
      description: description,
      about: {
        name: projectName ?? title,
        url: `https://github.com/elcoosp/${githubRepo}`,
        sameAs: `https://github.com/elcoosp/${githubRepo}`,
      },
    },
    publisher: {
      type: 'Organization',
      name: 'Elcoosp',
      url: 'https://github.com/elcoosp',
      logo: `https://${domain}/logo.png`,
      sameAs: ['https://github.com/elcoosp'],
    },
    title: {
      max: 60,
      min: 30,
      brand: 'auto',
      templates: [
        { match: '/fr/**', template: '{title} — {site} (FR)' },
        { match: '/**', template: '{title} — {site} documentation' },
      ],
    },
    types: [
      { match: '/blog/*/', type: 'BlogPosting', section: 'Blog' },
      { match: '/changelog/*/', type: 'Article', section: 'Changelog' },
    ],
    audit: {
      failOn: 'error',
      rules: {
        'title.duplicate': 'warn',
        'description.duplicate': 'warn',
      },
      exclude: [
        '/404/', '/404.html', '/**/404/', '/**/404.html',
        '/presentation-mode/**', '/**/presentation-mode/**',
        '/zen-mode/**', '/**/zen-mode/**',
        '/blog/**', '/**/blog/**', '/fr/blog/**', '/**/fr/blog/**',
        '/changelog/**', '/**/changelog/**',
        '/fr/changelog/**', '/**/fr/changelog/**',
      ],
    },
  }));
  starlightPlugins.push(unwrapPlugin(starlightScrollToTop)());
  starlightPlugins.push({
    name: 'docs-toolkit:view-modes-sidebar-strip',
    hooks: {
      'config:setup'({ addRouteMiddleware }: any) {
        addRouteMiddleware({
          entrypoint: '@elcoosp/docs-toolkit/src/config/view-modes-sidebar-strip.ts',
          order: 'post',
        });
      },
    },
  });
  starlightPlugins.push(unwrapPlugin(starlightAutoSidebar)());
  starlightPlugins.push({
    name: 'docs-toolkit:view-modes-sidebar-restore',
    hooks: {
      'config:setup'({ addRouteMiddleware }: any) {
        addRouteMiddleware({
          entrypoint: '@elcoosp/docs-toolkit/src/config/view-modes-sidebar-restore.ts',
          order: 'post',
        });
      },
    },
  });
  starlightPlugins.push(unwrapPlugin(starlightChangelogs)());

  starlightPlugins.push(unwrapPlugin(starlightAnnouncement)());

  const changelogGroup = { label: 'Changelog', items: makeChangelogsSidebarLinks([{ type: 'all', base: 'changelog', label: 'All versions' }]) };
  let headLink: any = undefined;
  let resolvedLlms: any = undefined;

  if (llmsTxt !== false) {
    resolvedLlms = resolveLlmsConfig(llmsTxt ?? {}, { title, description, site, source: undefined });
    if (resolvedLlms.outputs.headLink) headLink = llmsHeadLink();
  }

  const { plugins: _extraPlugins = [], sidebar: _extraSidebar, ...extraStarlightRest } = (extraStarlight as any) ?? {};
  // Both `plugins` (documented) and `extraStarlight.plugins` (escape hatch) are
  // honored. Previously `options.plugins` was destructured but silently dropped.
  const mergedPlugins = [
    ...((plugins as any[]) ?? []),
    ...((_extraPlugins as any[]) ?? []),
    ...starlightPlugins,
  ].map((p) => suppressHandledOverrideWarnings(p, ['Banner', 'PageTitle', 'MarkdownContent', 'TableOfContents']));
  let finalSidebarSource: any[];
  if (Array.isArray(_extraSidebar) && _extraSidebar.length > 0) {
    finalSidebarSource = _extraSidebar;
  } else if (Array.isArray(sidebar) && sidebar.length > 0) {
    finalSidebarSource = sidebar;
  } else {
    finalSidebarSource = buildSectionsSidebar(options.sections ?? CANONICAL_SECTIONS, findDocsRoot());
  }
  const mergedSidebar = autoTranslateSidebar([...finalSidebarSource, changelogGroup]);

  const starlightOptions: StarlightUserConfig = {
    routeMiddleware, disable404Route: true, title, description,
    logo: { src: logoPath }, favicon, customCss, social: finalSocial,
    editLink: finalEditLink,
    locales: locales || { root: { label: 'English', lang: 'en' }, fr: { label: 'Français', lang: 'fr' } },
    ...(defaultLocale ? { defaultLocale } : {}),
    plugins: mergedPlugins,
    head: [
      { tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: favicon } },
      { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } },
      ...((extraStarlight as any)?.head ?? []),
      ...(headLink ? [headLink] : []),
    ],
    sidebar: mergedSidebar,
    ...extraStarlightRest,
    expressiveCode: {
      ...(typeof expressiveCode === 'object' ? expressiveCode : {}),
      ...((extraStarlight as any)?.expressiveCode ?? {}),
      defaultProps: {
        showLineNumbers: false,
        ...((typeof expressiveCode === 'object' ? (expressiveCode as any)?.defaultProps : {}) ?? {}),
        ...((extraStarlight as any)?.expressiveCode?.defaultProps ?? {}),
      },
      plugins: [
        pluginLineNumbers(),
        ...((typeof expressiveCode === 'object' ? (expressiveCode as any)?.plugins : []) ?? []),
        ...((extraStarlight as any)?.expressiveCode?.plugins ?? []),
      ],
      shiki: {
        ...((typeof expressiveCode === 'object' ? (expressiveCode as any)?.shiki : {}) ?? {}),
        ...((extraStarlight as any)?.expressiveCode?.shiki ?? {}),
        langAlias: {
          'github-actions': 'yaml',
          ...((typeof expressiveCode === 'object' ? (expressiveCode as any)?.shiki?.langAlias : {}) ?? {}),
          ...((extraStarlight as any)?.expressiveCode?.shiki?.langAlias ?? {}),
        },
      },
    },
    // Safe merge: keep toolkit defaults, let site overrides win only for specific components
    components: {
      Banner: '@elcoosp/docs-toolkit/src/config/components/Banner.astro',
      PageTitle: '@elcoosp/docs-toolkit/src/config/components/PageTitle.astro',
      MarkdownContent: '@elcoosp/docs-toolkit/src/config/components/MarkdownContent.astro',
      TableOfContents: '@elcoosp/docs-toolkit/src/config/components/TableOfContents.astro',
      ...((extraStarlight as any)?.components ?? {}),
    },
  };

const integrations: NonNullable<AstroUserConfig['integrations']> = [
    astroTakumi({ options: { domBackend: 'linkedom', fonts: [fontBuf], width: 1200, height: 630, format: 'png' }, render } as unknown as Parameters<typeof astroTakumi>[0]),
    mermaid({ mermaidConfig: { layout: 'dagre', look: 'classic' } }), starlight(starlightOptions),  ...extraIntegrations,
  ];

  if (llmsTxt !== false && resolvedLlms) integrations.push(llmsIntegration(resolvedLlms));
return defineConfig({
    markdown: {
      shikiConfig: {
        langAlias: {
          'github-actions': 'yaml',
        },
      },
    },
    vite: {
      plugins: [
        {
          name: 'docs-toolkit:resolve-starlight-plugins',
          resolveId(id: string) {
            if (/^(?:starlight-[^/]+|astro-d2|astro-mermaid|@elcoosp\/astro-takumi)(?:\/|$)/.test(id)) {
              try {
                return _toolkitRequire.resolve(id);
              } catch {
                return null;
              }
            }
            return null;
          },
        },
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

      ], build: {
        chunkSizeWarningLimit: 2500,
        rolldownOptions: {
          onwarn(warning, defaultHandler) {
            const id = warning.id ?? warning.loc?.file ?? '';
            if (
              id.includes('node_modules') &&
              (warning.code === 'MODULE_LEVEL_DIRECTIVE' ||
                warning.code === 'SOURCEMAP_ERROR')
            ) {
              return;
            }
            defaultHandler(warning);
          },
        },
      }, ssr: { noExternal: [] }, ...extraVite },
    ...(site ? { site } : {}), ...(base ? { base } : {}), integrations,
  });
}
