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
        logger.info('llms: collecting pages...');
        try {
          const pages = collectPages(contentRoot);
          logger.info(`llms: ${pages.length} pages collected`);
          emitAll(distDir, pages, cfg, (msg) => logger.info(`llms:${msg}`));
        } catch (e) {
          logger.error(`llms: FAILED — ${e instanceof Error ? e.stack : String(e)}`);
        }
      }
    }
  };
}
