import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { AstroIntegration } from 'astro';
import { ResolvedLlmsConfig } from './types.js';
import { collectPages } from './collect.js';
import { emitAll } from './emit.js';

export function llmsIntegration(cfg: ResolvedLlmsConfig): AstroIntegration {
  return {
    name: '@elcoosp/docs-toolkit/llms',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const distDir = fileURLToPath(dir);
        const contentRoot = path.resolve(process.cwd(), 'src/content/docs');
        logger.info('Generating llms.txt artifacts...');

        try {
          const pages = collectPages(contentRoot);
          emitAll(distDir, pages, cfg);
          logger.info(`Generated: llms.txt, llms-full.txt, llms-small.txt, llms.json, and ${pages.length} .md twins.`);
        } catch (e) {
          logger.error(`Failed to generate llms.txt: ${e}`);
        }
      }
    }
  };
}
