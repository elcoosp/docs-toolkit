import fs from 'node:fs';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { llmsIntegration } from '../src/config/llms/integration';
import { starlightLinkPreview } from '../src/plugins/link-preview';
import { starlightTermGlossary } from '../src/plugins/term-glossary';

describe('Server Edge Branches (LLMs Integration, LinkPreview HTML, Glossary YAML, TS-Loader)', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'dt-edge-'));
    mkdirSync(join(tmp, 'src/content/docs/guides'), { recursive: true });
    mkdirSync(join(tmp, 'dist/guides/start'), { recursive: true });
    writeFileSync(
      join(tmp, 'src/content/docs/guides/start.md'),
      '---\ntitle: Start\ndescription: Start guide description\n---\n\n## Install\n\nRun install.\n',
    );
    writeFileSync(
      join(tmp, 'src/content/glossary.yml'),
      '- term: TokenStream\n  definition: Lexical stream of tokens produced by the lexer.\n  href: /guides/start/#missing-anchor\n  locale: en\n- term: BrokenTerm\n  definition: Points to missing page.\n  href: /guides/does-not-exist/\n  locale: en\n',
    );
    writeFileSync(
      join(tmp, 'dist/guides/start/index.html'),
      '<html><head><title>Start — Docs</title></head><body><main><h1>Start — Docs</h1><div class="sl-markdown-content"><h2 id="install">Install</h2><p>TokenStream is parsed here with a long enough paragraph.</p></div></main></body></html>',
    );
  });

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('covers llmsTxtIntegration JS fallback, linkPreview HTML extraction, glossary YAML audit, and ts-loader hooks', async () => {
    const origExists = fs.existsSync.bind(fs);
    const spy = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((p: any) => (String(p).includes('docs-pipeline-rs-') ? false : origExists(p)));
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
    const rootUrl = pathToFileURL(tmp + '/');
    const distUrl = pathToFileURL(join(tmp, 'dist') + '/');
    try {
      const origCwd = process.cwd();
      process.chdir(tmp);
      const llmsInt = llmsIntegration({
        title: 'Docs',
        description: 'Desc',
        url: 'https://example.com',
        exclude: [],
        optional: [],
        outputs: { root: true, full: true, small: true, perPage: true, json: true, headLink: true },
      } as any);
      await llmsInt.hooks['astro:config:setup']?.({
        config: { root: rootUrl },
        injectScript: vi.fn(),
      } as any);
      await llmsInt.hooks['astro:build:done']?.({ dir: distUrl, logger } as any);
      process.chdir(origCwd);

      const runPlugin = async (plugin: any) => {
        const integrations: any[] = [];
        await plugin.hooks['config:setup']({
          config: {
            root: rootUrl.href,
            locales: { root: { label: 'EN' }, fr: { label: 'FR' } },
            defaultLocale: 'root',
          },
          addIntegration: (i: any) => integrations.push(i),
        });
        for (const integ of integrations) {
          let updatedCfg: any = null;
          await integ.hooks['astro:config:setup']?.({
            injectScript: vi.fn(),
            updateConfig: (c: any) => {
              updatedCfg = c;
            },
          });
          const vPlugin = updatedCfg?.vite?.plugins?.[0][0];
          if (vPlugin) {
            const vid = vPlugin.resolveId('virtual:starlight-link-preview');
            if (vid) expect(vPlugin.load(vid)).toContain('LINK_PREVIEWS');
          }
          await integ.hooks['astro:build:done']?.({ dir: distUrl, logger });
        }
      };

      await runPlugin(starlightLinkPreview());
      await expect(runPlugin(starlightTermGlossary({ strict: true }))).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }

    // TS-loader real ESM hook execution on node_modules/starlight-test/
    const modDir = join(tmp, 'node_modules/starlight-test');
    mkdirSync(modDir, { recursive: true });
    writeFileSync(
      join(modDir, 'index.ts'),
      'import { val } from \x27./sub.js\x27; export const res: number = val + 1;\n',
    );
    writeFileSync(join(modDir, 'sub.ts'), 'export const val: number = 41;\n');
    await import('../src/config/ts-loader');
    const loaded: any = await import(pathToFileURL(join(modDir, 'index.ts')).href);
    expect(loaded.res).toBe(42);
  });
});
