import fs from 'node:fs';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { starlightDiataxisLint } from '../src/plugins/diataxis-lint';
import { starlightI18nParity } from '../src/plugins/i18n-parity';
import { starlightLinkPreview } from '../src/plugins/link-preview';
import { starlightTermGlossary } from '../src/plugins/term-glossary';

describe('Full Plugin Feature Suite (Diataxis, i18n Parity, ReadingContext, Glossary, LinkPreview)', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'dt-feat-'));
    const docs = join(tmp, 'src/content/docs');
    mkdirSync(join(docs, 'tutorials'), { recursive: true });
    mkdirSync(join(docs, 'guides'), { recursive: true });
    mkdirSync(join(docs, 'reference'), { recursive: true });
    mkdirSync(join(docs, 'explanation'), { recursive: true });
    mkdirSync(join(docs, 'fr/guides'), { recursive: true });

    writeFileSync(
      join(docs, 'tutorials/bad-tut.mdx'),
      '---\ntitle: Bad Tutorial\n---\nTODO finish this tutorial.\n',
    );
    writeFileSync(
      join(docs, 'guides/bad-guide.md'),
      '---\ntitle: Bad Guide\n---\nNo code or table here.\n<Tabs><TabItem label="A">x</TabItem></Tabs>\nSee [ref](/reference/bad-ref/).\n',
    );
    writeFileSync(join(docs, 'reference/bad-ref.md'), '---\ntitle: Bad Ref\n---\nNo signature block.\n');
    writeFileSync(join(docs, 'explanation/short-exp.md'), '---\ntitle: Short Exp\n---\nToo short.\n');

    writeFileSync(
      join(docs, 'fr/guides/bad-guide.md'),
      '---\ntitle: Mauvais Guide\n---\nNo code or table here.\nSee [other](/guides/other/).\n',
    );
    writeFileSync(join(docs, 'fr/guides/orphan.md'), '---\ntitle: Orphelin\n---\nPage orpheline.\n');

    writeFileSync(
      join(tmp, 'src/content/glossary.yml'),
      '- term: CommonWord\n  definition: Appears on almost every page.\n  href: /guides/bad-guide/\n  locale: en\n- term: NeverUsedTerm\n  definition: Never appears anywhere.\n  href: /guides/bad-guide/\n  locale: en\n',
    );

    for (let i = 1; i <= 9; i++) {
      const p = join(tmp, 'dist/page-' + i);
      mkdirSync(p, { recursive: true });
      writeFileSync(
        join(p, 'index.html'),
        '<html><body><main><h1>Page ' +
          i +
          '</h1><div class="sl-markdown-content"><p>This page mentions CommonWord in prose.</p></div></main></body></html>',
      );
    }
  });

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('exercises all diataxis-lint rules and strict failure', async () => {
    const origExists = fs.existsSync.bind(fs);
    const spy = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((p: any) => (String(p).includes('docs-pipeline-rs-') ? false : origExists(p)));
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
    const rootUrl = pathToFileURL(tmp + '/');
    const distUrl = pathToFileURL(join(tmp, 'dist') + '/');
    try {
      const plugin = starlightDiataxisLint({ strict: true, minExplanationWords: 120 });
      const integrations: any[] = [];
      await plugin.hooks['config:setup']({
        config: {
          root: rootUrl.href,
          locales: { root: { label: 'EN' }, fr: { label: 'FR' } },
          defaultLocale: 'root',
        },
        addIntegration: (i: any) => integrations.push(i),
      } as any);
      await expect(integrations[0].hooks['astro:build:done']({ dir: distUrl, logger })).rejects.toThrow(
        /diataxis-lint/i,
      );
      expect(logger.warn).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('exercises all i18n-parity drift checks (tabs, links, untranslated prose, orphans) and strict failure', async () => {
    const origExists = fs.existsSync.bind(fs);
    const spy = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((p: any) => (String(p).includes('docs-pipeline-rs-') ? false : origExists(p)));
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
    const rootUrl = pathToFileURL(tmp + '/');
    const distUrl = pathToFileURL(join(tmp, 'dist') + '/');
    try {
      const plugin = starlightI18nParity({ strict: true });
      const integrations: any[] = [];
      await plugin.hooks['config:setup']({
        config: {
          root: rootUrl.href,
          locales: { root: { label: 'EN' }, fr: { label: 'FR' } },
          defaultLocale: 'root',
        },
        addIntegration: (i: any) => integrations.push(i),
      } as any);
      await expect(integrations[0].hooks['astro:build:done']({ dir: distUrl, logger })).rejects.toThrow(
        /i18n-parity/i,
      );
      expect(logger.warn).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('exercises link-preview & term-glossary Vite virtual modules, over-broad & orphan term diagnostics', async () => {
    const origExists = fs.existsSync.bind(fs);
    const spy = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((p: any) => (String(p).includes('docs-pipeline-rs-') ? false : origExists(p)));
    const origCwd = process.cwd();
    process.chdir(tmp);
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
    const rootUrl = pathToFileURL(tmp + '/');
    const distUrl = pathToFileURL(join(tmp, 'dist') + '/');
    try {
      for (const [plugin, vid] of [
        [starlightLinkPreview({ codeSymbols: { maxLinksPerBlock: 4 } }), 'virtual:starlight-link-preview'],
        [starlightTermGlossary({ strict: false }), 'virtual:starlight-term-glossary'],
      ] as const) {
        const integrations: any[] = [];
        await plugin.hooks['config:setup']({
          config: {
            root: rootUrl.href,
            locales: { root: { label: 'EN' }, fr: { label: 'FR' } },
            defaultLocale: 'root',
          },
          addIntegration: (i: any) => integrations.push(i),
        } as any);
        let updatedCfg: any = null;
        await integrations[0].hooks['astro:config:setup']?.({
          injectScript: vi.fn(),
          updateConfig: (c: any) => {
            updatedCfg = c;
          },
        });
        const vp = updatedCfg?.vite?.plugins?.[0];
        if (typeof vp?.resolveId === 'function') {
          const resolved = vp.resolveId(vid);
          if (resolved) expect(vp.load(resolved)).toBeTruthy();
        }
        await integrations[0].hooks['astro:build:done']?.({ dir: distUrl, logger });
      }
      expect(logger.warn).toHaveBeenCalled();
    } finally {
      process.chdir(origCwd);
      spy.mockRestore();
    }
  });

  it('exercises reading-context middleware across all sections, locales, statuses, since, lastUpdated, and editUrl', async () => {
    vi.doMock('@astrojs/starlight/route-data', () => ({
      defineRouteMiddleware: (fn: any) => fn,
    }));
    const { onRequest } = await import('../src/plugins/reading-context/middleware');
    const cases = [
      { path: '/tutorials/intro/', locale: 'en', status: 'experimental', since: 'v1.2.0' },
      { path: '/fr/guides/install/', locale: 'fr', status: 'beta', since: 'v2.0.0' },
      { path: '/reference/cli/', locale: 'en', status: 'deprecated' },
      { path: '/explanation/arch/', locale: 'en', status: 'stable' },
      { path: '/blog/release/', locale: 'en' },
      { path: '/changelog/', locale: 'en' },
      { path: '/', locale: 'en' },
    ];
    for (const c of cases) {
      const ctx: any = {
        url: new URL('https://example.com' + c.path),
        locals: {
          starlightRoute: {
            locale: c.locale,
            lastUpdated: new Date('2026-06-15T00:00:00Z'),
            editUrl: new URL('https://github.com'),
            entry: {
              body: '---\ntitle: T\n---\n' + 'word '.repeat(450) + '\n```ts\nconst x = 1;\n```\n',
              data: { status: c.status, since: c.since },
            },
          },
        },
      };
      await onRequest(ctx, vi.fn());
      expect(ctx.locals.readingContext.readingLabel).toContain('min');
    }
  });
});
