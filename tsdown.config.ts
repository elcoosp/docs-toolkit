import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'og/index': 'src/og/index.ts',
    'og/routeData': 'src/og/routeData.ts',
    'config/index': 'src/config/index.ts',
    'qa/components': 'src/qa/components.ts',
    'qa/bootstrap-artifacts': 'src/qa/bootstrap-artifacts.ts',
    'qa/screenshots': 'src/qa/screenshots.ts',
  },
  outDir: 'dist',
  format: 'esm',
  platform: 'node',
  target: 'node22',
  dts: true,
  sourcemap: true,
  clean: true,
  // Must be false: 3 bin entries all carry shebangs, auto-detection errors on that.
  // ESM-only: default is already false, set explicitly so it never drifts.

  deps: {
    neverBundle: [
      'astro',
      'astro/config',
      '@astrojs/starlight',
      'astro-takumi',
      'starlight-llms-txt',
      'react',
      'react/jsx-runtime',
      'playwright',
    ],
  },
});
