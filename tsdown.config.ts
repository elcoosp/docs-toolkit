import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/og/index.ts',
    'src/og/routeData.ts',
    'src/config/index.ts',
    'src/config/changelog/rss.ts',
    'src/qa/components.ts',
    'src/qa/bootstrap-artifacts.ts',
    'src/qa/screenshots.ts',
  ],
  format: ['esm'],
  target: 'node22',
  dts: true,
  deps: {
    neverBundle: [
      'starlight-telescope',
      'starlight-scroll-to-top',
      'starlight-view-modes',
      'starlight-blog',
      'starlight-seo',
      'starlight-announcement',
      'starlight-changelogs',
      'starlight-image-zoom',
      'starlight-heading-badges',
      'astro-d2',
      '@d2lang/d2',
      '@elcoosp/astro-takumi',
    ],
  },
});
