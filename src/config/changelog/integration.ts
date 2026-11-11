import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import type { ChangelogConfig } from './types.js';

export function changelogIntegration(opts: Required<ChangelogConfig>): AstroIntegration {
  return {
    name: '@elcoosp/docs-toolkit/changelog',
    hooks: {
      'astro:config:setup': ({ config, injectRoute }) => {
        const absPath = path.resolve(
          fileURLToPath(config.root),
          opts.changelogPath,
        );
        if (!fs.existsSync(absPath)) {
          console.warn(`[changelog] CHANGELOG.md not found at ${absPath} — skipping changelog route`);
          return;
        })`);
        }
        // tsdown emits the entry as dist/config/changelog/rss.mjs.
        // integration.ts is bundled into dist/config-XXXX.mjs,
        // so we must locate the emitted file explicitly.
        let rssRoot = path.dirname(fileURLToPath(import.meta.url));
        while (rssRoot !== '/') {
          const candidate = path.join(rssRoot, 'config', 'changelog', 'rss.mjs');
          if (fs.existsSync(candidate)) break;
          rssRoot = path.dirname(rssRoot);
        }
        const rssEntry = path.join(rssRoot, 'config', 'changelog', 'rss.mjs');
        if (!fs.existsSync(rssEntry)) {
          throw new Error(`[changelog] could not locate rss.mjs (searched from ${fileURLToPath(import.meta.url)})`);
        }

        if (!opts.disablePage) {
          injectRoute({ pattern: opts.pagePath, entrypoint: pageEntry });
        }
        if (!opts.disableRss) {
          injectRoute({ pattern: opts.rssPath, entrypoint: rssEntry });
        }
      },
    },
  };
}
