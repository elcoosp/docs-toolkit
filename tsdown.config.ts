import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/og/index.ts',
    'src/og/routeData.ts',
    'src/config/index.ts',
    'src/config/collections.ts',
    'src/plugins/link-preview/index.ts',
    'src/plugins/reading-context/index.ts',
    'src/qa/components.ts',
    'src/qa/bootstrap-artifacts.ts',
    'src/qa/screenshots.ts',
    'src/qa/lint.ts',
  ],
  format: ['esm'],
  target: 'node22',
  dts: true,
  deps: {
    onlyBundle: false,
    neverBundle: [
      /^astro$/,
      /^astro:/,
      /^@astrojs\//,
      /^virtual:/,
      /\.astro$/,
      /\.css$/,
      'astro-mermaid',
      'astro-d2',
      '@d2lang/d2',
      '@elcoosp/astro-takumi',
      /^starlight-/,
    ],
  },
});
