import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { AstroIntegration } from 'astro';
import type { ResolvedLlmsConfig } from './types.js';
import { collectPages } from './collect.js';
import { emitAll } from './emit.js';
import {
  hasNativePipeline,
  registerNativePipelinePlugin,
  runNativePipelineOnce,
} from '../../plugins/shared/pipeline-host.js';
export function llmsIntegration(cfg: ResolvedLlmsConfig): AstroIntegration {
  let rootDir = process.cwd();
  return {
    name: '@elcoosp/docs-toolkit/llms',
    hooks: {
      'astro:config:setup': ({ config }) => {
        if (config?.root) rootDir = fileURLToPath(config.root);
        if (hasNativePipeline()) {
          registerNativePipelinePlugin(rootDir, 'llms', {
            title: cfg.title,
            description: cfg.description,
            url: cfg.url ?? '',
            source: cfg.source ?? '',
            exclude: cfg.exclude ?? [],
            optional: cfg.optional ?? [],
            outputs: cfg.outputs,
          });
        }
      },
      'astro:build:done': async ({ dir, logger }) => {
        if (await runNativePipelineOnce(rootDir, dir, logger)) {
          return;
        }
        const distDir = fileURLToPath(dir);
        const contentRoot = path.resolve(process.cwd(), 'src/content/docs');
        logger.info('llms: collecting pages...');
        try {
          const pages = collectPages(contentRoot, cfg);
          logger.info('llms: ' + pages.length + ' pages collected');
          emitAll(distDir, pages, cfg, (msg) => logger.info('llms:' + msg));
        } catch (e) {
          logger.error('llms: FAILED — ' + (e instanceof Error ? e.stack : String(e)));
        }
      },
    },
  };
}
