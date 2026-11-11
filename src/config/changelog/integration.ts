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
          throw new Error(`[changelog] CHANGELOG.md not found at ${absPath}`);
        }

        const tmpDir = path.join(fileURLToPath(config.root), '.astro');
        fs.mkdirSync(tmpDir, { recursive: true });
        fs.writeFileSync(
          path.join(tmpDir, 'changelog.json'),
          JSON.stringify({
            absPath,
            repo: opts.repo,
            title: opts.pageTitle,
            description: opts.description,
          }),
        );

        const pageEntry = fileURLToPath(
          new URL('../../../src/config/changelog/page.astro', import.meta.url)
        );
        const rssEntry = fileURLToPath(
          new URL('./rss.mjs', import.meta.url)
        );

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
