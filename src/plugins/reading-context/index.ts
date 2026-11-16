import type { StarlightPlugin } from '@astrojs/starlight/types';

export interface ReadingContextData {
  minutes: number;
  readingLabel: string;
  sectionLabel: string;
  status?: 'stable' | 'experimental' | 'beta' | 'deprecated';
  statusLabel?: string;
  since?: string;
  updatedLabel?: string;
  editUrl?: string;
  editLabel: string;
}

export function starlightReadingContext(): StarlightPlugin {
  return {
    name: 'starlight-reading-context',
    hooks: {
      'config:setup'({ addRouteMiddleware }) {
        addRouteMiddleware({
          entrypoint: '@elcoosp/docs-toolkit/src/plugins/reading-context/middleware.ts',
          order: 'post',
        });
      },
    },
  };
}

export default starlightReadingContext;
