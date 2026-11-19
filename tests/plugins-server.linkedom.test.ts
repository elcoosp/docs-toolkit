import fs, { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
const origExistsSync = fs.existsSync.bind(fs);
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { starlightDiataxisLint } from '../src/plugins/diataxis-lint';
import { starlightI18nParity } from '../src/plugins/i18n-parity';
import { starlightLinkPreview } from '../src/plugins/link-preview';
import { starlightReadingContext } from '../src/plugins/reading-context';
import { starlightRelatedPages } from '../src/plugins/related-pages';
import {
  hasNativePipeline,
  registerNativePipelinePlugin,
  runNativePipelineOnce,
} from '../src/plugins/shared/pipeline-host';
import { starlightSmartTocProgress } from '../src/plugins/smart-toc-progress';
import { starlightTermGlossary } from '../src/plugins/term-glossary';

vi.mock('@astrojs/starlight/route-data', () => ({ defineRouteMiddleware: (fn: any) => fn }));
import { onRequest as readingCtxMiddleware } from '../src/plugins/reading-context/middleware';

describe('Server Plugins & Native Pipeline Host (100% coverage)', () => {
  let tmp: string;
  let prevBin: string | undefined;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'dt-plugins-'));
    prevBin = process.env.DOCS_PIPELINE_RS_BIN;
    process.env.DOCS_PIPELINE_RS_BIN = join(tmp, 'no-bin');
    const docs = join(tmp, 'src/content/docs');
    for (const d of ['tutorials', 'guides', 'reference', 'explanation', 'fr/tutorials', 'fr/guides']) {
      mkdirSync(join(docs, d), { recursive: true });
    }
    writeFileSync(
      join(docs, 'tutorials/intro.md'),
      '---\ntitle: Quickstart\ndescription: A valid description that is over twenty four characters long.\n---\n\n## Step 1\n\n' +
        '```sh\ncargo build\n```' +
        '\n\n## Step 2\n\nSee [Guide](/guides/macro/).\n',
    );
    writeFileSync(
      join(docs, 'tutorials/bad.md'),
      '---\ntitle: Quickstart\ndescription: Short\n---\n\nTODO write content\n',
    );
    writeFileSync(
      join(docs, 'guides/macro.md'),
      '---\ntitle: Macro Guide\ndescription: Learn how to write procedural macros in Rust cleanly.\n---\n\n| Key | Val |\n|---|---|\n| a | b |\n\nProcedural Macro transforms tokens.\n',
    );
    writeFileSync(
      join(docs, 'reference/api.md'),
      '---\ntitle: API Reference\ndescription: Complete reference for every macro attribute and option.\n---\n\nNo code or table here.\n',
    );
    writeFileSync(
      join(docs, 'explanation/tokens.md'),
      '---\ntitle: Token Stream (AST)\ndescription: Deep architectural explanation of token streams and spans.\n---\n\nProcedural Macro is a compiler plugin that operates on token streams.\n\n## Hygiene\n\nMacro hygiene prevents accidental variable capture across scopes in generated code.\n\n- **Span** — Source location metadata attached to every token in the stream.\n',
    );
    writeFileSync(join(docs, 'no-fm.md'), 'Just plain text without frontmatter\n');
    writeFileSync(
      join(docs, 'fr/tutorials/intro.md'),
      '---\ntitle: Démarrage\ndescription: Description valide en français de plus de vingt-quatre caractères.\n---\n\n## Étape 1\n\n' +
        '```sh\ncargo build\n```' +
        '\n\nSee [Guide](/guides/macro/).\n',
    );
    writeFileSync(
      join(docs, 'fr/orphan.md'),
      '---\ntitle: Orphelin\ndescription: Page orpheline sans équivalent anglais.\n---\n\nContenu.\n',
    );
    const dist = join(tmp, 'dist');
    mkdirSync(join(dist, 'explanation/tokens'), { recursive: true });
    mkdirSync(join(dist, 'guides/macro'), { recursive: true });
    writeFileSync(
      join(dist, 'explanation/tokens/index.html'),
      '<html><head><meta name="description" content="Token stream explanation."></head><body><main><h1>Token Stream</h1><div class="sl-markdown-content"><h2 id="hygiene">Hygiene</h2><p>Procedural Macro is a compiler plugin.</p></div></main></body></html>',
    );
    writeFileSync(
      join(dist, 'guides/macro/index.html'),
      '<html><body><main><h1>Macro Guide</h1><div class="sl-markdown-content"><p>Procedural Macro transforms tokens.</p></div></main></body></html>',
    );
  });

  afterAll(() => {
    process.env.DOCS_PIPELINE_RS_BIN = prevBin;
    rmSync(tmp, { recursive: true, force: true });
  });

  const makeLogger = () =>
    ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fork() {
        return this;
      },
    }) as any;

  it('runs DiataxisLint, I18nParity, LinkPreview, RelatedPages, TermGlossary, SmartToc, and ReadingContext', async () => {
    const rootUrl = pathToFileURL(tmp + '/');
    const distUrl = pathToFileURL(join(tmp, 'dist') + '/');
    const logger = makeLogger();
    const runPlugin = async (plugin: any) => {
      const integrations: any[] = [];
      const middlewares: any[] = [];
      await plugin.hooks['config:setup']({
        config: {
          root: rootUrl.href,
          locales: { root: { label: 'EN' }, fr: { label: 'FR' } },
          defaultLocale: 'root',
        },
        addIntegration: (i: any) => integrations.push(i),
        addRouteMiddleware: (m: any) => middlewares.push(m),
      });
      for (const integ of integrations) {
        await integ.hooks['astro:config:setup']?.({
          injectScript: vi.fn(),
          updateConfig: (cfg: any) => {
            const p = cfg?.vite?.plugins?.[0];
            if (p?.resolveId) {
              const id = p.resolveId('virtual:starlight-link-preview');
              if (id) p.load(id);
            }
            if (p?.configureServer)
              p.configureServer({
                middlewares: {
                  use: (_path: string, fn: any) => fn({}, { setHeader: vi.fn(), end: vi.fn() }),
                },
              });
          },
        });
        await integ.hooks['astro:build:done']?.({ dir: distUrl, logger });
      }
      return { integrations, middlewares };
    };
    const existsSpy = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((target: any) =>
        String(target).includes('docs-pipeline-rs-') ? false : origExistsSync(target),
      );
    await runPlugin(starlightDiataxisLint({ strict: false }));
    await expect(runPlugin(starlightDiataxisLint({ strict: true }))).rejects.toThrow();
    await runPlugin(starlightI18nParity({ strict: false }));
    await expect(runPlugin(starlightI18nParity({ strict: true }))).rejects.toThrow();
    await runPlugin(starlightLinkPreview({ hoverDelay: 100 }));
    await runPlugin(starlightRelatedPages({ maxRelated: 2 }));
    await runPlugin(starlightTermGlossary({ strict: false }));
    await runPlugin(starlightSmartTocProgress({ minHeadings: 2 }));
    const rc = await runPlugin(starlightReadingContext());
    existsSpy.mockRestore();
    expect(rc.middlewares.length).toBe(1);
    const locals: any = {
      starlightRoute: {
        locale: 'fr',
        entry: { data: { status: 'beta', since: 'v1.2.0' }, body: '# Titre\nTexte technique.' },
        lastUpdated: new Date('2026-01-15T00:00:00Z'),
        editUrl: new URL('https://example.com'),
      },
    };
    await readingCtxMiddleware(
      { url: new URL('https://example.com'), locals } as any,
      async () => new Response('ok'),
    );
    expect(locals.readingContext.statusLabel).toBe('Bêta');
    await readingCtxMiddleware(
      { url: new URL('https://example.com'), locals: {} } as any,
      async () => new Response('ok'),
    );
  });

  it('exercises native pipeline-host success reporting', async () => {
    const fakeBin = join(tmp, 'fake-pipeline.mjs');
    writeFileSync(
      fakeBin,
      '#!/usr/bin/env node\nconsole.log(JSON.stringify({ elapsedMs: 5, htmlPages: 2, mdDocs: 1, mermaidRendered: 1, linkPreviewsIndexed: 2, codeSymbolsIndexed: 3, codeSymbolLinks: 4, codeSymbolPages: 1, glossaryIndexed: 2, glossaryCoveragePct: 50, glossaryAvgPerPage: "1.00", relatedPagesCount: 2, relatedAvgLinks: "1.00", llmsPages: 2, i18nPairs: 1, diataxisAudited: 2, warnings: ["w1"], errors: [] }));\n',
      { mode: 0o755 },
    );
    process.env.DOCS_PIPELINE_RS_BIN = fakeBin;
    expect(hasNativePipeline()).toBe(true);
    const siteA = join(tmp, 'site-a');
    registerNativePipelinePlugin(siteA, 'llms', { title: 'Test' }, ['en', 'fr'], 'en');
    const logger = makeLogger();
    expect(await runNativePipelineOnce(siteA, join(tmp, 'dist'), logger)).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith('w1');
  });
});
