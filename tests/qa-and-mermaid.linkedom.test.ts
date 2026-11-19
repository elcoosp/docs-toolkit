import fs from 'node:fs';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawnSync: vi.fn(() => ({ status: 0 })),
    execFileSync: vi.fn((_bin: string, _args: string[], opts: any) => {
      const parts = String(opts?.input ?? '').split('\n===MERMAID_SEP===\n');
      return parts
        .map(() => '<div class="sl-static-diagram"><svg></svg></div>')
        .join('\n===MERMAID_SEP===\n');
    }),
  };
});

import { staticMermaidIntegration } from '../src/config/rehype-static-mermaid';

describe('QA Scripts & Static Mermaid (100% coverage)', () => {
  let tmp: string;
  let origCwd: string;

  beforeAll(async () => {
    origCwd = process.cwd();
    tmp = mkdtempSync(join(tmpdir(), 'dt-qa-'));
    mkdirSync(join(tmp, 'src/content/docs/guides'), { recursive: true });
    mkdirSync(join(tmp, 'src/content/docs/reference'), { recursive: true });
    mkdirSync(join(tmp, 'src/content/docs/blog'), { recursive: true });
    writeFileSync(
      join(tmp, 'src/content/docs/index.mdx'),
      '---\ntitle: Home\ndescription: Welcome\n---\nBody\n',
    );
    writeFileSync(
      join(tmp, 'src/content/docs/guides/start.md'),
      '---\ntitle: Start\ntype: guide\n---\nBody\n',
    );

    const dist = join(tmp, 'dist');
    mkdirSync(join(dist, 'guides/start'), { recursive: true });
    mkdirSync(join(dist, 'reference/api'), { recursive: true });
    mkdirSync(join(dist, 'blog/post-1'), { recursive: true });
    mkdirSync(join(dist, 'changelog'), { recursive: true });
    await sharp({
      create: { width: 32, height: 32, channels: 4, background: { r: 30, g: 90, b: 200, alpha: 1 } },
    })
      .png()
      .toFile(join(dist, 'logo.png'));

    const makeHtml = (title: string) =>
      '<!doctype html><html lang="en"><head><title>' +
      title +
      '</title></head><body>' +
      '<header class="site-title"><img src="/logo.png" width="16" height="16"></header>' +
      '<div class="sl-zen-toggle" data-pagefind-ignore="all"></div>' +
      '<div class="sl-reading-context" data-pagefind-ignore="all"></div>' +
      '<div class="page-actions-container" data-pagefind-ignore="all"></div>' +
      '<dialog id="sl-cmdk-dialog"><input id="sl-cmdk-input"><div id="sl-cmdk-list"></div><aside id="sl-cmdk-preview"></aside></dialog>' +
      '<main><h1>' +
      title +
      '</h1><div class="sl-aside">' +
      'Detailed documentation content paragraph. '.repeat(20) +
      '</div></main></body></html>';

    writeFileSync(join(dist, 'index.html'), makeHtml('Home'));
    writeFileSync(join(dist, 'guides/start/index.html'), makeHtml('Start Guide'));
    writeFileSync(join(dist, 'reference/api/index.html'), makeHtml('API Reference'));
    writeFileSync(join(dist, 'blog/index.html'), makeHtml('Blog'));
    writeFileSync(join(dist, 'blog/post-1/index.html'), makeHtml('Post 1'));
    writeFileSync(join(dist, 'changelog/index.html'), makeHtml('Changelog'));
    writeFileSync(join(dist, '404.html'), makeHtml('404'));
  });

  afterAll(() => {
    process.chdir(origCwd);
    rmSync(tmp, { recursive: true, force: true });
  });

  it('covers staticMermaidIntegration JS fallback rendering', async () => {
    const mDir = join(tmp, 'mermaid-dist');
    mkdirSync(mDir, { recursive: true });
    writeFileSync(
      join(mDir, 'index.html'),
      '<div class="expressive-code"><figure><pre><code>flowchart TD\n  A --&gt; B</code></pre></figure></div>' +
        '<div class="expressive-code"><figure><div class="ec-line"><div class="code">graph LR</div></div><div class="ec-line"><div class="code">  X --&gt; Y</div></div></figure></div>',
    );
    const origExists = fs.existsSync.bind(fs);
    const spy = vi
      .spyOn(fs, 'existsSync')
      .mockImplementation((p: any) => (String(p).includes('docs-pipeline-rs-') ? false : origExists(p)));
    try {
      const integ = staticMermaidIntegration();
      await integ.hooks['astro:config:setup']?.({
        config: { root: pathToFileURL(tmp + '/') },
        injectScript: vi.fn(),
      } as any);
      const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
      await integ.hooks['astro:build:done']?.({ dir: pathToFileURL(mDir + '/'), logger } as any);
      const out = readFileSync(join(mDir, 'index.html'), 'utf8');
      expect(out).toContain('sl-static-diagram');
    } finally {
      spy.mockRestore();
    }
  });

  it('covers qa/bootstrap-artifacts, qa/components, qa/lint, and qa/screenshots', async () => {
    process.chdir(tmp);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    process.env.QA_SAMPLE = '1';
    process.env.QA_CONCURRENCY = '2';
    try {
      await import('../src/qa/bootstrap-artifacts');
      expect(existsSync(join(tmp, 'public/llms.txt'))).toBe(true);
      expect(existsSync(join(tmp, 'docs/qa-report.md'))).toBe(true);

      await import('../src/qa/components');
      await import('../src/qa/lint');
      await import('../src/qa/screenshots');
      expect(existsSync(join(tmp, '.qa/failures.json'))).toBe(true);
    } finally {
      exitSpy.mockRestore();
    }
  }, 30000);
});
