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

        // Walk up from the built file location to find the toolkit root.
        // Works whether bundled into dist/config-X.mjs or dist/config/index.mjs.
        // No module resolution, no @elcoosp/docs-toolkit self-reference.
        let toolkitRoot = path.dirname(fileURLToPath(import.meta.url));
        while (toolkitRoot !== '/') {
          const candidate = path.join(toolkitRoot, 'src', 'config', 'changelog', 'page.astro');
          if (fs.existsSync(candidate)) break;
          toolkitRoot = path.dirname(toolkitRoot);
        }
        const pageEntry = path.join(toolkitRoot, 'src', 'config', 'changelog', 'page.astro');
        if (!fs.existsSync(pageEntry)) {
          throw new Error(`[changelog] could not locate page.astro (searched from ${fileURLToPath(import.meta.url)})`);
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
