import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanBody, collectPages } from '../src/config/llms/collect';
import { emitAll } from '../src/config/llms/emit';
import { detectSections, llmsHeadLink, llmsIntegration, resolveLlmsConfig } from '../src/config/llms';
import { renderFull } from '../src/config/llms/render/full';
import { renderIndex } from '../src/config/llms/render/index';
import { renderJson } from '../src/config/llms/render/json';
import { renderPageMd } from '../src/config/llms/render/page';
import { renderSmall } from '../src/config/llms/render/small';
import {
  inlineBashIntegration,
  rehypeInlineBash,
  satteriInlineBashPlugin,
} from '../src/config/rehype-inline-bash';
import { staticMermaidIntegration } from '../src/config/rehype-static-mermaid';

describe('LLMs.txt pipeline & Rehype integrations (100% coverage)', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'dt-llms-'));
    const docs = join(tmp, 'src/content/docs');
    mkdirSync(join(docs, 'tutorials'), { recursive: true });
    mkdirSync(join(docs, 'guides'), { recursive: true });
    mkdirSync(join(docs, 'reference'), { recursive: true });
    mkdirSync(join(docs, 'fr/tutorials'), { recursive: true });
    mkdirSync(join(docs, 'blog'), { recursive: true });

    writeFileSync(
      join(docs, 'index.mdx'),
      '---\ntitle: Home\ndescription: >\n  Welcome overview\norder: 1\n---\nimport { Card } from "astro";\n<DiataxisGrid items={[{ title: "Start", description: "Go", href: "/tutorials/intro/" }]} />\n<Card title="One" description="D1" href="/guides/g1/" />\n<LinkCard title="Two" description="D2" href="/reference/r1/" />\n<LinkButton href="/tutorials/intro/">Click</LinkButton>\n<Aside type="tip" title="Note">Hello</Aside>\n<Card title="Box">Body</Card>\n<TabItem label="Tab1">TBody</TabItem>\n<Badge text="v1" />\n',
    );
    writeFileSync(
      join(docs, 'tutorials/intro.md'),
      '---\ntitle: "Getting Started"\ndescription: |\n  Line one\n  Line two\nsidebar:\n  order: 2\n---\n# Intro\n',
    );
    writeFileSync(join(docs, 'guides/g1.md'), '---\ntitle: Guide One\n---\nGuide body\n');
    writeFileSync(join(docs, 'reference/r1.md'), 'No frontmatter body\n');
    writeFileSync(join(docs, 'blog/post.md'), '---\ntitle: Blog Post\n---\nBlog text\n');
    writeFileSync(
      join(docs, 'fr/tutorials/intro.md'),
      '---\ntitle: Démarrer\ndescription: Guide FR\norder: 1\n---\nContenu FR\n',
    );
    writeFileSync(join(docs, '404.md'), '---\ntitle: 404\n---\nMissing\n');
  });

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('collects, cleans MDX, resolves config, renders all 5 outputs, and emits files + robots.txt', async () => {
    const docsRoot = join(tmp, 'src/content/docs');
    expect(detectSections(docsRoot)?.length).toBeGreaterThanOrEqual(3);
    expect(detectSections(join(tmp, 'nope'))).toBeNull();
    expect(llmsHeadLink().attrs.href).toBe('/llms.txt');

    const cfg = resolveLlmsConfig(
      {},
      {
        title: 'Docs',
        description: 'Desc',
        site: 'https://example.com',
        source: 'https://github.com',
        locales: ['root', 'fr'],
      },
    );
    const pages = collectPages(docsRoot, cfg);
    expect(pages.length).toBe(6);
    expect(cleanBody('<DiataxisGrid items={invalid} />', 'https://example.com')).toBe('');

    expect(renderIndex(pages, cfg, 'en')).toContain('## Tutorials');
    expect(renderIndex(pages, cfg, 'fr')).toContain('Démarrer');
    expect(renderFull(pages, cfg, 'en')).toContain('full documentation');
    expect(renderSmall(pages, cfg, 'en')).toContain('curated subset');
    expect(renderSmall(pages, cfg, 'fr')).toContain('résumé essentiel');
    expect(JSON.parse(renderJson(pages, cfg, 'en')).pages.length).toBe(5);
    expect(renderPageMd(pages)).toContain('# ');

    const distDir = join(tmp, 'dist');
    mkdirSync(distDir, { recursive: true });
    const logs: string[] = [];
    emitAll(distDir, pages, cfg, (m) => logs.push(m));
    expect(readFileSync(join(distDir, 'llms.txt'), 'utf8')).toContain('# Docs');
    expect(readFileSync(join(distDir, 'fr/llms.txt'), 'utf8')).toContain('Français');
    expect(readFileSync(join(distDir, 'robots.txt'), 'utf8')).toContain('LLMs-Txt:');
    emitAll(distDir, pages, cfg, () => {});

    const integ = llmsIntegration(cfg);
    const origCwd = process.cwd();
    process.chdir(tmp);
    const prevBin = process.env.DOCS_PIPELINE_RS_BIN;
    process.env.DOCS_PIPELINE_RS_BIN = join(tmp, 'no-bin');
    try {
      await integ.hooks['astro:config:setup']?.({ config: { root: pathToFileURL(tmp + '/') } } as any);
      await integ.hooks['astro:build:done']?.({
        dir: pathToFileURL(distDir + '/'),
        logger: { info: () => {}, warn: () => {}, error: () => {} },
      } as any);
    } finally {
      if (prevBin === undefined) delete process.env.DOCS_PIPELINE_RS_BIN;
      else process.env.DOCS_PIPELINE_RS_BIN = prevBin;
      process.chdir(origCwd);
    }
  });

  it('covers rehypeInlineBash, satteriInlineBashPlugin, inlineBashIntegration, and staticMermaidIntegration', async () => {
    const tree: any = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          children: [
            {
              type: 'element',
              tagName: 'code',
              children: [{ type: 'text', value: '$ FOO=1 cargo build --release && git status "ok"' }],
            },
          ],
        },
        {
          type: 'element',
          tagName: 'p',
          children: [
            { type: 'element', tagName: 'code', children: [{ type: 'text', value: 'custom-cmd {:sh}' }] },
          ],
        },
        {
          type: 'element',
          tagName: 'p',
          children: [{ type: 'element', tagName: 'code', children: [{ type: 'text', value: 'cargo' }] }],
        },
        {
          type: 'element',
          tagName: 'pre',
          children: [{ type: 'element', tagName: 'code', children: [{ type: 'text', value: 'git push' }] }],
        },
      ],
    };
    rehypeInlineBash()(tree);
    expect(tree.children[0].children[0].properties['data-inline-sh']).toBe('');
    expect(tree.children[1].children[0].properties['data-inline-sh']).toBe('');
    expect(tree.children[2].children[0].properties).toBeUndefined();

    const sat = satteriInlineBashPlugin();
    const codeNode: any = {
      type: 'element',
      tagName: 'code',
      children: [{ type: 'text', value: 'pnpm test' }],
    };
    let propSet = false;
    sat.element.visit(codeNode, {
      parent: () => ({ type: 'element', tagName: 'p' }),
      setProperty: () => {
        propSet = true;
      },
      removeChildAt: () => {},
      appendChild: () => {},
    });
    expect(propSet).toBe(true);

    const bashInt = inlineBashIntegration();
    const proc: any = { name: 'satteri', options: {} };
    await bashInt.hooks['astro:config:setup']?.({
      config: { markdown: { processor: proc } },
      updateConfig: () => {},
    } as any);
    expect(proc.options.hastPlugins.length).toBe(1);
    await bashInt.hooks['astro:config:setup']?.({
      config: { root: pathToFileURL(tmp + '/') },
      updateConfig: () => {},
    } as any);

    const prevBin = process.env.DOCS_PIPELINE_RS_BIN;
    process.env.DOCS_PIPELINE_RS_BIN = join(tmp, 'no-bin');
    try {
      const mInt = staticMermaidIntegration();
      await mInt.hooks['astro:config:setup']?.({
        config: { root: pathToFileURL(tmp + '/') },
        injectScript: () => {},
      } as any);
      const emptyDist = join(tmp, 'empty-dist');
      mkdirSync(emptyDist, { recursive: true });
      writeFileSync(join(emptyDist, 'index.html'), '<html><body><p>No mermaid</p></body></html>');
      await mInt.hooks['astro:build:done']?.({
        dir: pathToFileURL(emptyDist + '/'),
        logger: { info: () => {}, warn: () => {}, error: () => {} },
      } as any);
    } finally {
      if (prevBin === undefined) delete process.env.DOCS_PIPELINE_RS_BIN;
      else process.env.DOCS_PIPELINE_RS_BIN = prevBin;
    }
  });
});
