import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import type { AstroUserConfig } from 'astro';
import starlight from '@astrojs/starlight';
import type { StarlightUserConfig } from '@astrojs/starlight/types';
import astroTakumi from 'astro-takumi';
import { makeRender } from '../og/og-render';
import { deriveAccent } from '../og/accent';
import { makeLlmsTxtPlugin, llmsManifestAppender, DEFAULT_LLMS_SETS, detectSections } from './llms';
import type { LlmsTxtConfig } from './llms';

export type { LlmsTxtConfig } from './llms';
export { DEFAULT_LLMS_SETS, detectSections } from './llms';

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

  const fontPath = fileURLToPath(
    new URL('../assets/roboto-latin-400-normal.woff2', import.meta.url),
  );
  const fontBuf = fs.readFileSync(fontPath);

  const starlightPlugins = [...plugins];
  if (llmsTxt !== false) {
    starlightPlugins.push(makeLlmsTxtPlugin(llmsTxt));
  }

  const starlightOptions: StarlightUserConfig = {
    routeMiddleware,
    expressiveCode,
    title,
    description,
    logo: { src: logoPath },
    favicon,
    customCss,
    social,
    ...(editLink ? { editLink } : {}),
    ...(locales ? { locales } : {}),
    ...(defaultLocale ? { defaultLocale } : {}),
    plugins: starlightPlugins,
    sidebar,
    ...extraStarlight,
  };

  const integrations: NonNullable<AstroUserConfig['integrations']> = [
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

  if (llmsTxt !== false) {
    integrations.push(llmsManifestAppender());
  }

  return defineConfig({
    vite: { ssr: { external: ['jsdom', 'astro-takumi'] }, ...extraVite },
    ...(site ? { site } : {}),
    ...(base ? { base } : {}),
    integrations,
  });
}
