import { starlightDiataxisLint } from '../plugins/diataxis-lint/index.js';
import { starlightRelatedPages } from '../plugins/related-pages/index.js';
import { starlightI18nParity } from '../plugins/i18n-parity/index.js';
import { starlightTermGlossary } from '../plugins/term-glossary/index.js';
import { starlightSmartTocProgress } from '../plugins/smart-toc-progress/index.js';
import { createRequire } from 'node:module';
const _toolkitRequire = createRequire(import.meta.url);
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { inlineBashIntegration } from './rehype-inline-bash';
import { starlightLinkPreview } from '../plugins/link-preview/index';
import { starlightReadingContext } from '../plugins/reading-context/index';

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
  topics?: boolean | 'diataxis' | any[];
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

function normalizeShikiLangs(langs: unknown): unknown {
  if (!Array.isArray(langs)) return langs;
  return langs.map((lang) => {
    if (!lang || typeof lang !== 'object' || typeof (lang as { name?: unknown }).name !== 'string')
      return lang;
    const obj = lang as { name: string; aliases?: string[] };
    const lower = obj.name.toLowerCase();
    if (lower === obj.name) return lang;
    return { ...obj, name: lower, aliases: Array.from(new Set([...(obj.aliases ?? []), obj.name])) };
  });
}
function resolveBareEntrypoint(ep: unknown): unknown {
  if (
    typeof ep !== 'string' ||
    ep.startsWith('.') ||
    ep.startsWith('/') ||
    ep.startsWith('@elcoosp/docs-toolkit')
  )
    return ep;
  try {
    return _toolkitRequire.resolve(ep);
  } catch {
    return ep;
  }
}

function resolvePluginEntrypoints(plugin: any): any {
  const setup = plugin?.hooks?.['config:setup'];
  if (typeof setup !== 'function') return plugin;
  return {
    ...plugin,
    hooks: {
      ...plugin.hooks,
      'config:setup'(ctx: any) {
        const wrappedCtx = Object.assign(Object.create(ctx), {
          ...(typeof ctx.injectRoute === 'function'
            ? {
                injectRoute(route: any) {
                  return ctx.injectRoute({ ...route, entrypoint: resolveBareEntrypoint(route?.entrypoint) });
                },
              }
            : {}),
          ...(typeof ctx.addRouteMiddleware === 'function'
            ? {
                addRouteMiddleware(mw: any) {
                  return ctx.addRouteMiddleware({ ...mw, entrypoint: resolveBareEntrypoint(mw?.entrypoint) });
                },
              }
            : {}),
        });
        return setup(wrappedCtx);
      },
    },
  };
}

function resolveToolkitEntrypoint(entrypoint: unknown): unknown {
  if (typeof entrypoint !== 'string' || entrypoint.startsWith('.') || entrypoint.startsWith('/')) {
    return entrypoint;
  }
  try {
    return _toolkitRequire.resolve(entrypoint);
  } catch {
    return entrypoint;
  }
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
                if (typeof message === 'string' && componentNames.some((name) => message.includes(name))) {
                  return;
                }
                return origWarn(message, ...args);
              },
            })
          : ctx.logger;
        const wrapInject = (fn: any) => (route: any) =>
          fn({ ...route, entrypoint: resolveToolkitEntrypoint(route?.entrypoint) });
        const wrappedCtx = Object.assign(Object.create(Object.getPrototypeOf(ctx)), ctx, {
          logger: filteredLogger,
          ...(typeof ctx.injectRoute === 'function'
            ? { injectRoute: wrapInject(ctx.injectRoute.bind(ctx)) }
            : {}),
          ...(typeof ctx.addIntegration === 'function'
            ? {
                addIntegration(integration: any) {
                  const origSetup = integration?.hooks?.['astro:config:setup'];
                  if (typeof origSetup !== 'function') return ctx.addIntegration(integration);
                  return ctx.addIntegration({
                    ...integration,
                    hooks: {
                      ...integration.hooks,
                      'astro:config:setup'(astroCtx: any) {
                        const nextAstroCtx =
                          typeof astroCtx?.injectRoute === 'function'
                            ? { ...astroCtx, injectRoute: wrapInject(astroCtx.injectRoute.bind(astroCtx)) }
                            : astroCtx;
                        return origSetup(nextAstroCtx);
                      },
                    },
                  });
                },
              }
            : {}),
        });
        return setup(wrappedCtx);
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

function findFirstDocLink(docsRoot: string, dir: string): string | null {
  const fullDir = path.join(docsRoot, dir);
  if (!fs.existsSync(fullDir)) return null;
  const entries = fs
    .readdirSync(fullDir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    if (e.isFile() && /\.(md|mdx)$/.test(e.name)) {
      const base = e.name.replace(/\.(md|mdx)$/, '');
      return base === 'index' ? `/${dir}/` : `/${dir}/${base}/`;
    }
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      const nested = findFirstDocLink(docsRoot, `${dir}/${e.name}`);
      if (nested) return nested;
    }
  }
  return null;
}

function buildDiataxisTopics(sections: SectionSpec[], docsRoot: string, changelogGroup: any): any[] {
  const byKey = new Map(sections.map((s) => [s.key, s]));
  const learnItems: any[] = [];
  if (fs.existsSync(path.join(docsRoot, 'index.mdx')) || fs.existsSync(path.join(docsRoot, 'index.md'))) {
    learnItems.push({ label: 'Overview', translations: { fr: 'Aperçu' }, link: '/' });
  }
  for (const key of ['tutorials', 'guides']) {
    const sec = byKey.get(key);
    if (sec && fs.existsSync(path.join(docsRoot, sec.key))) {
      learnItems.push({
        label: sec.en,
        translations: { fr: sec.fr },
        collapsed: false,
        items: [{ autogenerate: { directory: sec.key, collapsed: false } }],
      });
    }
  }

  const refSec = byKey.get('reference');
  const refLink = findFirstDocLink(docsRoot, 'reference') ?? '/changelog/';
  const refItems: any[] = [];
  if (refSec && fs.existsSync(path.join(docsRoot, 'reference'))) {
    refItems.push({
      label: refSec.en,
      translations: { fr: refSec.fr },
      collapsed: false,
      items: [{ autogenerate: { directory: 'reference', collapsed: false } }],
    });
  }
  refItems.push(changelogGroup);

  const expSec = byKey.get('explanation');
  const expLink = findFirstDocLink(docsRoot, 'explanation') ?? '/blog/';
  const expItems: any[] = [];
  if (expSec && fs.existsSync(path.join(docsRoot, 'explanation'))) {
    expItems.push({
      label: expSec.en,
      translations: { fr: expSec.fr },
      collapsed: false,
      items: [{ autogenerate: { directory: 'explanation', collapsed: false } }],
    });
  }
  expItems.push({ label: 'Blog', translations: { fr: 'Blog' }, link: '/blog/' });

  const learnLink = findFirstDocLink(docsRoot, 'tutorials') ?? findFirstDocLink(docsRoot, 'guides') ?? '/';
  const topics: any[] = [];
  if (learnItems.length > 0) {
    topics.push({
      id: 'learn',
      label: { en: 'Learn', fr: 'Apprendre' },
      link: learnLink,
      icon: 'rocket',
      items: learnItems,
    });
  }
  topics.push({
    id: 'reference',
    label: { en: 'Reference', fr: 'Référence' },
    link: refLink,
    icon: 'open-book',
    items: refItems,
  });
  topics.push({
    id: 'architecture',
    label: { en: 'Architecture', fr: 'Architecture' },
    link: expLink,
    icon: 'puzzle',
    items: expItems,
  });
  return topics;
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

export async function defineDocsConfig(options: DocsConfigOptions): Promise<AstroUserConfig> {
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
    routeMiddleware,
    base,
    accentOverride,
    expressiveCode = {
      themes: ['github-light', 'github-dark'],
      shiki: { langAlias: { 'github-actions': 'yaml' } },
    },
    extraStarlight = {},
    extraIntegrations = [],
    extraVite = {},
    llmsTxt = {},
  } = options;

  const rawShikiLangs =
    (extraStarlight as any)?.expressiveCode?.shiki?.langs ??
    (typeof expressiveCode === 'object' ? (expressiveCode as any)?.shiki?.langs : undefined);
  if (Array.isArray(rawShikiLangs) && rawShikiLangs.length > 0) {
    (globalThis as any).__docsToolkitShikiLangs = normalizeShikiLangs(rawShikiLangs);
  }
  const resolvedRouteMiddleware =
    routeMiddleware ??
    (fs.existsSync(path.resolve(process.cwd(), 'src/routeData.ts'))
      ? './src/routeData.ts'
      : '@elcoosp/docs-toolkit/og/routeData');
  const ecConfigFile = path.resolve(process.cwd(), 'ec.config.mjs');
  const srcEcConfigFile = path.resolve(process.cwd(), 'src/ec.config.mjs');
  if (!fs.existsSync(ecConfigFile) && !fs.existsSync(srcEcConfigFile)) {
    fs.writeFileSync(ecConfigFile, "export { default } from '@elcoosp/docs-toolkit/ec.config';\n");
    const gitignorePath = path.resolve(process.cwd(), '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gi = fs.readFileSync(gitignorePath, 'utf8');
      if (!gi.split(/\r?\n/).includes('ec.config.mjs')) {
        fs.writeFileSync(gitignorePath, gi.replace(/\n?$/, '\nec.config.mjs\n'));
      }
    }
  }

  const landingCss = '@elcoosp/docs-toolkit/src/styles/landing.css';
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
    { default: starlightAutoDrafts },
    { default: starlightCodeblockFullscreen },
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
    import('starlight-auto-drafts'),
    import('starlight-codeblock-fullscreen'),
  ]);

  const rawGithubRepo =
    options.github ??
    extractGitHubRepo(options) ??
    extractGitHubRepo(extraStarlight as any) ??
    `elcoosp/${projectName.toLowerCase().replaceAll(/\s+/g, '-')}`;
  const rawRepo =
    options.github ??
    extractGitHubRepo(options) ??
    extractGitHubRepo(extraStarlight as any) ??
    `elcoosp/${projectName.toLowerCase().replaceAll(/\s+/g, '-')}`;
  const githubRepo = (rawRepo.includes('/') ? rawRepo : `elcoosp/${rawRepo}`).replace(
    /^([^/]+)\/\1\//,
    '$1/',
  );
  const finalSocial =
    social.length > 0
      ? social
      : [
          {
            icon: 'github' as const,
            label: 'GitHub',
            href: `https://github.com/${githubRepo}`,
          },
        ];
  const cwdFolder = path.basename(process.cwd());
  const finalEditLink = {
    baseUrl: `https://github.com/${githubRepo}/edit/main/${cwdFolder}/`,
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
  const render = makeRender({
    logoDataUrl: 'data:image/png;base64,' + logoB64,
    accentHex: accent.hex,
    accentHexA12: accent.hexA12,
    domain,
    projectName,
  });
  const fontBuf = Buffer.from(ROBOTO_BASE64, 'base64');

  const starlightPlugins: any[] = [];

  // Mandatory: starlight-links-validator runs only on `astro build` and fails
  // the production build on broken internal links. `astro dev` and
  // `astro preview` are unaffected. There is no opt-out — every fleet site
  // is link-checked, and a broken internal link blocks deploy.
  starlightPlugins.push(unwrapPlugin(starlightLinksValidator)());

  starlightPlugins.push(unwrapPlugin(starlightTelescope)());
  starlightPlugins.push(
    suppressHandledOverrideWarnings(
      unwrapPlugin(starlightBlog)({
        title: { en: 'Blog', fr: 'Blog' },
        prefix: 'blog',
        authors: {
          elcoosp: {
            name: 'elcoosp',
            picture: 'https://github.com/elcoosp.png?size=200',
            url: 'https://github.com/elcoosp',
          },
        },
      }),
      ['MarkdownContent'],
    ),
  );
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
  starlightPlugins.push(
    suppressHandledOverrideWarnings(
      unwrapPlugin(starlightViewModes)({
        zenModeSettings: { enabled: true },
        presentationModeSettings: { enabled: false },
      }),
      ['TableOfContents'],
    ),
  );
  starlightPlugins.push(
    unwrapPlugin(starlightSeo)({
      site: {
        name: title,
        alternateName: domain,
        description: description,
        about: {
          name: projectName ?? title,
          url: `https://github.com/${githubRepo}`,
          sameAs: `https://github.com/${githubRepo}`,
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
          '/404/',
          '/404.html',
          '/**/404/',
          '/**/404.html',
          '/presentation-mode/**',
          '/**/presentation-mode/**',
          '/zen-mode/**',
          '/**/zen-mode/**',
          '/blog/**',
          '/**/blog/**',
          '/fr/blog/**',
          '/**/fr/blog/**',
          '/changelog/**',
          '/**/changelog/**',
          '/fr/changelog/**',
          '/**/fr/changelog/**',
        ],
      },
    }),
  );
  starlightPlugins.push(unwrapPlugin(starlightScrollToTop)());
  starlightPlugins.push(unwrapPlugin(starlightAutoDrafts)());
  starlightPlugins.push(unwrapPlugin(starlightCodeblockFullscreen)());
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
  const changelogGroup = {
    label: 'Changelog',
    items: makeChangelogsSidebarLinks([{ type: 'all', base: 'changelog', label: 'All versions' }]),
  };
  const docsRoot = findDocsRoot();
  const resolvedSections = options.sections ?? CANONICAL_SECTIONS;
  const hasTopics =
    options.topics === true ||
    options.topics === 'diataxis' ||
    (Array.isArray(options.topics) && options.topics.length > 0);
  if (hasTopics) {
    const { default: starlightSidebarTopics } = await import('starlight-sidebar-topics');
    const rawTopics = Array.isArray(options.topics)
      ? options.topics
      : buildDiataxisTopics(resolvedSections, docsRoot, changelogGroup);
    const translatedTopics = rawTopics.map((t: any) => ({
      ...t,
      ...(Array.isArray(t.items) ? { items: autoTranslateSidebar(t.items) } : {}),
    }));
    const defaultExclude = [
      '/404',
      '/fr/404',
      '/zen-mode',
      '/zen-mode/**/*',
      '/fr/zen-mode',
      '/fr/zen-mode/**/*',
      '/presentation-mode',
      '/presentation-mode/**/*',
      '/fr/presentation-mode',
      '/fr/presentation-mode/**/*',
    ];
    const topicOptions = Array.isArray(options.topics)
      ? { exclude: defaultExclude }
      : {
          exclude: defaultExclude,
          topics: {
            reference: ['/changelog', '/changelog/**/*', '/fr/changelog', '/fr/changelog/**/*'],
            architecture: ['/blog', '/blog/**/*', '/fr/blog', '/fr/blog/**/*'],
          },
        };
    starlightPlugins.push(unwrapPlugin(starlightSidebarTopics)(translatedTopics, topicOptions));
  }
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
  starlightPlugins.push(starlightLinkPreview());
  starlightPlugins.push(
    starlightReadingContext(),
    starlightSmartTocProgress(),
    starlightTermGlossary(),
    starlightI18nParity(),
    starlightRelatedPages(),
    starlightDiataxisLint(),
  );

  let headLink: any = undefined;
  let resolvedLlms: any = undefined;

  if (llmsTxt !== false) {
    const inferredSource =
      typeof finalEditLink?.baseUrl === 'string'
        ? finalEditLink.baseUrl.replace(/\/(?:edit|blob|tree)\/[^/]+.*$/, '')
        : undefined;
    const configuredLocales = locales ? Object.keys(locales) : undefined;
    resolvedLlms = resolveLlmsConfig(llmsTxt ?? {}, {
      title,
      description,
      site,
      source: inferredSource,
      locales: configuredLocales,
    });
    if (resolvedLlms.outputs.headLink) headLink = llmsHeadLink();
  }

  const {
    plugins: _extraPlugins = [],
    sidebar: _extraSidebar,
    editLink: _extraEditLink,
    ...extraStarlightRest
  } = (extraStarlight as any) ?? {};
  // Both `plugins` (documented) and `extraStarlight.plugins` (escape hatch) are
  // honored. Previously `options.plugins` was destructured but silently dropped.
  const mergedPlugins = [
    ...((plugins as any[]) ?? []),
    ...((_extraPlugins as any[]) ?? []),
    ...starlightPlugins,
  ].map((p) =>
    resolvePluginEntrypoints(
      suppressHandledOverrideWarnings(p, ['Banner', 'PageTitle', 'MarkdownContent', 'TableOfContents']),
    ),
  );

  let finalSidebarSource: any[];
  if (Array.isArray(_extraSidebar) && _extraSidebar.length > 0) {
    finalSidebarSource = _extraSidebar;
  } else if (Array.isArray(sidebar) && sidebar.length > 0) {
    finalSidebarSource = sidebar;
  } else {
    finalSidebarSource = buildSectionsSidebar(resolvedSections, docsRoot);
  }
  const mergedSidebar = hasTopics ? [] : autoTranslateSidebar([...finalSidebarSource, changelogGroup]);

  const existingCustomCss = customCss.filter((rel) => fs.existsSync(path.resolve(process.cwd(), rel)));
  const starlightOptions: StarlightUserConfig = {
    routeMiddleware: resolvedRouteMiddleware,
    disable404Route: true,
    title,
    description,
    logo: { src: logoPath },
    favicon,
    customCss: [landingCss, ...autoAccentCss, ...existingCustomCss],
    social: finalSocial,
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
    ...(hasTopics ? {} : { sidebar: mergedSidebar }),
    ...extraStarlightRest,
    expressiveCode:
      expressiveCode === false
        ? false
        : {
            ...(typeof expressiveCode === 'object' ? expressiveCode : {}),
            ...(extraStarlight as any)?.expressiveCode,
            shiki: {
              ...((typeof expressiveCode === 'object' ? (expressiveCode as any)?.shiki : {}) ?? {}),
              ...(extraStarlight as any)?.expressiveCode?.shiki,
              langAlias: {
                'github-actions': 'yaml',
                ...((typeof expressiveCode === 'object' ? (expressiveCode as any)?.shiki?.langAlias : {}) ??
                  {}),
                ...(extraStarlight as any)?.expressiveCode?.shiki?.langAlias,
              },
            },
          },
    // Safe merge: keep toolkit defaults, let site overrides win only for specific components
    components: {
      Banner: '@elcoosp/docs-toolkit/src/config/components/Banner.astro',
      PageTitle: '@elcoosp/docs-toolkit/src/config/components/PageTitle.astro',
      MarkdownContent: '@elcoosp/docs-toolkit/src/config/components/MarkdownContent.astro',
      TableOfContents: '@elcoosp/docs-toolkit/src/config/components/TableOfContents.astro',
      ...(extraStarlight as any)?.components,
    },
  };

  const integrations: NonNullable<AstroUserConfig['integrations']> = [
    inlineBashIntegration(),
    astroTakumi({
      options: { domBackend: 'linkedom', fonts: [fontBuf], width: 1200, height: 630, format: 'png' },
      render,
    } as unknown as Parameters<typeof astroTakumi>[0]),
    mermaid({ mermaidConfig: { layout: 'dagre', look: 'classic' } }),
    (() => {
      const sl = starlight(starlightOptions);
      const origSetup = sl.hooks?.['astro:config:setup'];
      if (typeof origSetup !== 'function') return sl;
      return {
        ...sl,
        hooks: {
          ...sl.hooks,
          'astro:config:setup'(astroCtx: any) {
            const nextAstroCtx =
              typeof astroCtx?.injectRoute === 'function'
                ? {
                    ...astroCtx,
                    injectRoute(route: any) {
                      return astroCtx.injectRoute({
                        ...route,
                        entrypoint: resolveToolkitEntrypoint(route?.entrypoint),
                      });
                    },
                  }
                : astroCtx;
            return origSetup(nextAstroCtx);
          },
        },
      };
    })(),
    ...extraIntegrations,
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
      resolve: {
        alias: {
          mermaid: fileURLToPath(import.meta.resolve('mermaid')),
        },
      },
      plugins: [
        {
          name: 'docs-toolkit:resolve-starlight-plugins',
          enforce: 'pre',
          resolveId(id: string) {
            if (
              /^(?:starlight-[^/]+|astro-d2|astro-mermaid|@elcoosp\/astro-takumi|mermaid|react|react-dom)(?:\/|$)/.test(
                id,
              )
            ) {
              try {
                return fileURLToPath(import.meta.resolve(id));
              } catch {
                try {
                  return _toolkitRequire.resolve(id);
                } catch {
                  return null;
                }
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
      ],
      build: {
        chunkSizeWarningLimit: 2500,
        rolldownOptions: {
          onwarn(warning, defaultHandler) {
            const id = warning.id ?? warning.loc?.file ?? '';
            if (
              id.includes('node_modules') &&
              (warning.code === 'MODULE_LEVEL_DIRECTIVE' || warning.code === 'SOURCEMAP_ERROR')
            ) {
              return;
            }
            defaultHandler(warning);
          },
        },
      },
      ssr: { noExternal: [] },
      ...extraVite,
    },
    ...(site ? { site } : {}),
    ...(base ? { base } : {}),
    integrations,
  });
}
