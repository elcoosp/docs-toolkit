import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import astroTakumi from 'astro-takumi';
import { makeRender, deriveAccent } from '../og/index.mjs';

export async function defineDocsConfig(options) {
  const {
    site, domain, title, projectName = title, description,
    logoPath = './src/assets/logo.png',
    favicon = '/favicon.png',
    customCss = ['./src/styles/custom.css'],
    social = [], editLink, locales, defaultLocale = 'root',
    plugins = [], sidebar, routeMiddleware = './src/routeData.mjs',
    base, accentOverride,
    extraStarlight = {}, extraIntegrations = [], extraVite = {},
    expressiveCode = { themes: ['github-light', 'github-dark'] },
  } = options;

  const accent = accentOverride
    ? { hex: accentOverride, hexA12: accentOverride + '1a' }
    : await deriveAccent(logoPath);

  const logoB64 = fs.readFileSync(logoPath).toString('base64');
  const render = makeRender({
    logoDataUrl: 'data:image/png;base64,' + logoB64,
    accentHex: accent.hex,
    accentHexA12: accent.hexA12,
    domain, projectName,
  });

  const fontPath = fileURLToPath(new URL('../assets/roboto-latin-400-normal.woff2', import.meta.url));
  const fontBuf = fs.readFileSync(fontPath);

  const starlightOptions = {
    routeMiddleware, expressiveCode, title, description,
    logo: { src: logoPath }, favicon, customCss, social,
    ...(editLink ? { editLink } : {}),
    ...(locales ? { locales } : {}),
    ...(defaultLocale ? { defaultLocale } : {}),
    plugins, sidebar,
    ...extraStarlight,
  };

  return defineConfig({
    vite: { ssr: { external: ['jsdom', 'astro-takumi'] }, ...extraVite },
    ...(site ? { site } : {}),
    ...(base ? { base } : {}),
    integrations: [
      starlight(starlightOptions),
      ...extraIntegrations,
      astroTakumi({
        options: { domBackend: 'linkedom', fonts: [fontBuf], width: 1200, height: 630, format: 'png' },
        render,
      }),
    ],
  });
}
