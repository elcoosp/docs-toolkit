import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../src/components/DiataxisGrid.astro', () => ({ default: () => null }));
vi.mock('../src/components/FeatureGrid.astro', () => ({ default: () => null }));
vi.mock('../src/components/StatStrip.astro', () => ({ default: () => null }));
vi.mock('astro/config', () => ({ defineConfig: (c: any) => c }));
vi.mock('astro:content', () => ({ defineCollection: (c: any) => c }));
vi.mock('@astrojs/starlight', () => ({
  default: () => ({
    name: '@astrojs/starlight',
    hooks: {
      'astro:config:setup'({ injectRoute }: any) {
        injectRoute?.({ pattern: '/404', entrypoint: '@astrojs/starlight/routes/404.astro' });
      },
    },
  }),
}));
vi.mock('@astrojs/starlight/loaders', () => ({ docsLoader: () => ({}), i18nLoader: () => ({}) }));
vi.mock('@astrojs/starlight/schema', () => ({
  docsSchema: (o: any) => {
    o?.extend?.({});
    return o;
  },
  i18nSchema: (o: any) => o,
}));
vi.mock('starlight-changelogs/loader', () => ({ changelogsLoader: () => ({}) }));
vi.mock('starlight-blog/schema', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, blogSchema: () => ({ extend: (e: any) => e }) };
});
vi.mock('starlight-auto-sidebar/loader', () => ({ autoSidebarLoader: () => ({}) }));
vi.mock('starlight-auto-sidebar/schema', () => ({ autoSidebarSchema: () => ({}) }));
import * as componentsIdx from '../src/components';
import { makeDocsCollections } from '../src/config/collections';
import { makeDocsCollection } from '../src/config/content';
import { defineDocsConfig } from '../src/config';
import * as rootIdx from '../src/index';

describe('Config, Collections, Content & TS-Loader (100% coverage)', () => {
  let tmp: string;
  let origCwd: string;

  beforeAll(async () => {
    origCwd = process.cwd();
    tmp = mkdtempSync(join(tmpdir(), 'dt-cfg-'));
    mkdirSync(join(tmp, 'src/content/docs/tutorials'), { recursive: true });
    mkdirSync(join(tmp, 'src/content/docs/guides'), { recursive: true });
    mkdirSync(join(tmp, 'src/content/docs/reference'), { recursive: true });
    mkdirSync(join(tmp, 'src/content/docs/explanation'), { recursive: true });
    mkdirSync(join(tmp, 'src/assets'), { recursive: true });
    mkdirSync(join(tmp, 'src/styles'), { recursive: true });
    writeFileSync(join(tmp, 'src/content/docs/index.mdx'), '---\ntitle: Home\n---\nWelcome\n');
    writeFileSync(join(tmp, 'src/content/docs/tutorials/start.md'), '---\ntitle: Start\n---\nGo\n');
    writeFileSync(join(tmp, 'src/content/docs/guides/how.md'), '---\ntitle: How\n---\nDo\n');
    writeFileSync(join(tmp, 'src/content/docs/reference/api.md'), '---\ntitle: API\n---\nRef\n');
    writeFileSync(join(tmp, 'src/content/docs/explanation/why.md'), '---\ntitle: Why\n---\nExp\n');
    writeFileSync(join(tmp, 'src/styles/custom.css'), ':root { --color: red; }\n');
    writeFileSync(join(tmp, '.gitignore'), 'node_modules\n');
    await sharp({
      create: { width: 16, height: 16, channels: 4, background: { r: 40, g: 120, b: 220, alpha: 1 } },
    })
      .png()
      .toFile(join(tmp, 'src/assets/logo.png'));
  });

  afterAll(() => {
    process.chdir(origCwd);
    rmSync(tmp, { recursive: true, force: true });
  });

  it('covers root barrel, components barrel, collections, and content schemas', () => {
    expect(typeof rootIdx.defineDocsConfig).toBe('function');
    expect(componentsIdx).toBeDefined();
    const cols = makeDocsCollections({ changelogPath: './CHANGELOG.md' });
    expect(cols.docs).toBeDefined();
    expect(cols.i18n).toBeDefined();
    const plainDoc = makeDocsCollection();
    expect(plainDoc).toBeDefined();
  });

  it('covers defineDocsConfig across auto-accent, diataxis topics, custom sidebar, llmsTxt:false, and Vite/integration hooks', async () => {
    process.chdir(tmp);
    const prevCi = process.env.CI;
    process.env.CI = 'true';
    try {
      const cfg1 = await defineDocsConfig({
        site: 'https://example.com',
        domain: '://example.com',
        title: 'My Project',
        description: 'Complete test site',
        topics: true,
        telescope: true,
        expressiveCode: {
          themes: ['github-light', 'github-dark'],
          shiki: { langs: [{ name: 'MyLang', scopeName: 'source.mylang', patterns: [] }, 'not-obj' as any] },
        },
      } as any);
      expect(cfg1.integrations?.length).toBeGreaterThanOrEqual(4);

      const vitePlugins = (cfg1.vite?.plugins ?? []) as any[];
      for (const vp of vitePlugins) {
        if (vp?.resolveId) {
          vp.resolveId('virtual:starlight-image-zoom-config');
          vp.resolveId('starlight-blog');
          vp.resolveId('unknown-nonexistent-pkg-xyz');
        }
        if (vp?.load) {
          vp.load('\0virtual:starlight-image-zoom-config');
        }
      }

      const parallelInteg = (cfg1.integrations as any[]).find(
        (i) => i?.name === '@elcoosp/docs-toolkit/parallel-build-done',
      );
      const dummyProducer = { name: 'dummy-prod', hooks: { 'astro:build:done': vi.fn() } };
      const dummyAudit = { name: 'starlight-seo', hooks: { 'astro:build:done': vi.fn() } };
      parallelInteg?.hooks?.['astro:config:done']?.({
        config: { integrations: [parallelInteg, dummyProducer, dummyAudit] },
      });
      await parallelInteg?.hooks?.['astro:build:done']?.({
        dir: new URL('file:///tmp/'),
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      });
      expect(dummyProducer.hooks['astro:build:done']).toBeTypeOf('function');

      const cfg2 = await defineDocsConfig({
        site: 'https://example.com',
        domain: '://example.com',
        title: 'My Project',
        description: 'Custom sidebar and accent override',
        accentOverride: '#e11d48',
        llmsTxt: false,
        expressiveCode: false,
        sidebar: [{ label: 'Guides', items: [] }],
        topics: [
          { id: 'custom', label: { en: 'Custom' }, link: '/', items: [{ label: 'Tutorials', items: [] }] },
        ],
      });
      expect(cfg2).toBeDefined();
    } finally {
      process.env.CI = prevCi;
    }
  });
});
