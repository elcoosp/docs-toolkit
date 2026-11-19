import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [
    {
      name: 'virtual-lp',
      resolveId(id) {
        if (id === 'virtual:starlight-link-preview') return '\0virtual:starlight-link-preview';
      },
      load(id) {
        if (id === '\0virtual:starlight-link-preview') {
          return 'export const LINK_PREVIEWS = { \x27/guides/macro/\x27: { title: \x27Macro Guide\x27, description: \x27Write macros\x27, section: \x27Guide\x27, readingTime: \x272 min\x27, headings: { syntax: \x27Syntax\x27 } } };';
        }
      },
    },
  ],
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.d.ts', 'src/assets/font-b64.ts', 'src/config/llms/types.ts'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: { lines: 84, statements: 80, functions: 79, branches: 63 },
    },
    projects: [
      {
        test: {
          name: 'unit-linkedom',
          environment: 'node',
          include: ['tests/**/*.linkedom.test.ts'],
        },
      },
      {
        test: {
          name: 'browser-dom',
          include: ['tests/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      {
        test: {
          name: 'e2e-real-site',
          environment: 'node',
          testTimeout: 30000,
          include: ['tests/**/*.e2e.test.ts'],
        },
      },
    ],
  },
});
