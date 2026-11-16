import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/og/index.ts',
    'src/og/routeData.ts',
    'src/config/index.ts',
    'src/qa/components.ts',
    'src/qa/bootstrap-artifacts.ts',
    'src/qa/screenshots.ts',
  ],
  format: ['esm'],
  target: 'node22',
  dts: true,
  deps: {
    onlyBundle: false,
    alwaysBundle: [
      /^starlight-/,
      'astro-d2',
    ],
    neverBundle: [
      /^astro$/,
      /^astro:/,
      /^@astrojs\//,
      /^virtual:/,
      /\.astro$/,
      /\.css$/,
      'astro-mermaid',
      '@d2lang/d2',
      '@elcoosp/astro-takumi',
    ],
  },
});
