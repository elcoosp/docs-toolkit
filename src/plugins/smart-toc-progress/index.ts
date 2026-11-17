import type { StarlightPlugin } from '@astrojs/starlight/types';

export interface SmartTocProgressOptions {
  minHeadings?: number;
  wordsPerMinute?: number;
}

export function starlightSmartTocProgress(options: SmartTocProgressOptions = {}): StarlightPlugin {
  const minHeadings = options.minHeadings ?? 3;
  const wordsPerMinute = options.wordsPerMinute ?? 210;

  return {
    name: 'starlight-smart-toc-progress',
    hooks: {
      'config:setup'({ addIntegration }) {
        addIntegration({
          name: 'starlight-smart-toc-progress-integration',
          hooks: {
            'astro:config:setup'({ injectScript }) {
              injectScript(
                'page',
                'import { initSmartTocProgress } from "@elcoosp/docs-toolkit/src/plugins/smart-toc-progress/client.ts"; initSmartTocProgress({ minHeadings: ' +
                  minHeadings +
                  ', wordsPerMinute: ' +
                  wordsPerMinute +
                  ' });',
              );
            },
          },
        });
      },
    },
  };
}
