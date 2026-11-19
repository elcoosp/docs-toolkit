import { createServer, type Server } from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import * as esbuild from 'esbuild';
import sharp from 'sharp';
import { AI_PROVIDERS } from '../../src/config/components/ai-providers';
import { emitAll } from '../../src/config/llms/emit';
import { resolveLlmsConfig } from '../../src/config/llms/config';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

export interface E2eFixtureHandle {
  distDir: string;
  baseUrl: string;
  close: () => Promise<void>;
}

function newestMtime(dir: string): number {
  let max = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      const m = newestMtime(p);
      if (m > max) max = m;
    } else {
      const m = statSync(p).mtimeMs;
      if (m > max) max = m;
    }
  }
  return max;
}

async function ensureFixtureBuilt(repoRoot: string): Promise<string> {
  const cacheRoot = join(repoRoot, '.vitest/e2e-fixture-cache');
  const distDir = join(cacheRoot, 'dist');
  const stampFile = join(cacheRoot, '.stamp');
  const srcMtime = Math.max(newestMtime(join(repoRoot, 'src')), statSync(import.meta.filename).mtimeMs);

  if (existsSync(stampFile) && existsSync(join(distDir, 'assets/bundle.js'))) {
    const builtAt = Number(readFileSync(stampFile, 'utf8').trim());
    if (builtAt >= srcMtime) return distDir;
  }

  mkdirSync(join(distDir, 'assets'), { recursive: true });
  mkdirSync(join(distDir, 'pagefind'), { recursive: true });
  mkdirSync(join(distDir, 'og'), { recursive: true });
  mkdirSync(join(distDir, 'guides/macro'), { recursive: true });
  mkdirSync(join(distDir, 'guides/install'), { recursive: true });
  mkdirSync(join(distDir, 'fr/guides/macro'), { recursive: true });

  const entryFile = join(cacheRoot, 'client-entry.ts');
  writeFileSync(
    entryFile,
    [
      `import { initCommandSearch } from ${JSON.stringify(join(repoRoot, 'src/config/components/search-client.ts'))};`,
      `import { initPageActions } from ${JSON.stringify(join(repoRoot, 'src/config/components/page-actions-client.ts'))};`,
      `import { initZenMode } from ${JSON.stringify(join(repoRoot, 'src/config/components/zen-mode-client.ts'))};`,
      `import { initLinkPreview } from ${JSON.stringify(join(repoRoot, 'src/plugins/link-preview/client.ts'))};`,
      `import { initTermGlossary } from ${JSON.stringify(join(repoRoot, 'src/plugins/term-glossary/client.ts'))};`,
      `import { initRelatedPages } from ${JSON.stringify(join(repoRoot, 'src/plugins/related-pages/client.ts'))};`,
      `import { initSmartTocProgress } from ${JSON.stringify(join(repoRoot, 'src/plugins/smart-toc-progress/client.ts'))};`,
      'initCommandSearch();',
      'initPageActions();',
      'initZenMode();',
      'initLinkPreview({ hoverDelay: 20 });',
      'initTermGlossary({ hoverDelay: 20 });',
      'initRelatedPages();',
      'initSmartTocProgress();',
    ].join('\n'),
  );

  await esbuild.build({
    entryPoints: [entryFile],
    bundle: true,
    format: 'esm',
    outfile: join(distDir, 'assets/bundle.js'),
    plugins: [
      {
        name: 'virtual-e2e-data',
        setup(build) {
          build.onResolve({ filter: /^simple-icons$/ }, () => ({
            path: 'simple-icons',
            namespace: 'si-stub',
          }));
          build.onLoad({ filter: /.*/, namespace: 'si-stub' }, () => ({
            contents:
              'export const siOpenai={path:""};export const siAnthropic={path:""};export const siGooglegemini={path:""};export const siPerplexity={path:""};export const siMistralai={path:""};export const siHuggingface={path:""};export const siMeta={path:""};export const siDuckduckgo={path:""};',
            loader: 'js',
          }));
          build.onResolve(
            { filter: /^virtual:starlight-(link-preview|term-glossary|related-pages)$/ },
            (args) => ({
              path: args.path,
              namespace: 'virtual-e2e',
            }),
          );
          build.onLoad({ filter: /.*/, namespace: 'virtual-e2e' }, () => ({
            contents: `export const LINK_PREVIEWS = ${JSON.stringify({
              '/guides/install/': {
                title: 'Installation Guide',
                description: 'Install the toolkit in under one minute.',
                section: 'How-to Guide',
                readingTime: '2 min read',
                headings: { setup: 'Setup' },
              },
            })};`,
            loader: 'js',
          }));
        },
      },
    ],
  });

  writeFileSync(
    join(distDir, 'glossary-index.json'),
    JSON.stringify([
      {
        term: 'TokenStream',
        definition: 'Stream of lexical tokens parsed by procedural macros.',
        href: '/guides/install/',
        locale: 'en',
      },
    ]),
  );
  writeFileSync(
    join(distDir, 'related-pages.json'),
    JSON.stringify({
      '/guides/macro/': [
        {
          href: '/guides/install/',
          title: 'Installation Guide',
          description: 'Install the toolkit.',
          category: 'guides',
        },
      ],
    }),
  );

  writeFileSync(
    join(distDir, 'pagefind/pagefind.js'),
    [
      'export async function init() {}',
      'export async function search(q) {',
      '  const items = [',
      "    { id: 'p1', data: async () => ({ url: '/guides/macro/', meta: { title: 'Macro Guide', section: 'Guides' }, excerpt: 'Build <mark>macro</mark> pipelines.', content: '# Macro Guide\\n\\nFull macro documentation.', sub_results: [{ title: 'Syntax', url: '/guides/macro/#syntax', excerpt: 'Macro syntax' }] }) },",
      "    { id: 'p2', data: async () => ({ url: '/guides/install/', meta: { title: 'Installation Guide', section: 'Guides' }, excerpt: 'Quick <mark>macro</mark> installation.', content: '# Installation Guide\\n\\nInstall steps.', sub_results: [] }) },",
      '  ];',
      '  return { results: q ? items : [] };',
      '}',
    ].join('\n'),
  );

  const llmsCfg = resolveLlmsConfig(
    {},
    { title: 'Fixture Docs', description: 'Self-contained CI docs', site: 'https://example.com' },
  );
  emitAll(
    distDir,
    [
      {
        slug: 'guides/macro',
        route: '/guides/macro/',
        title: 'Macro Guide',
        description: 'Write macros',
        section: 'Guides',
        locale: 'en',
        markdown: '# Macro Guide\n\nTokenStream macro guide content.',
        headings: [{ depth: 2, text: 'Syntax', slug: 'syntax' }],
        optional: false,
      },
      {
        slug: 'guides/install',
        route: '/guides/install/',
        title: 'Installation Guide',
        description: 'Install guide',
        section: 'Guides',
        locale: 'en',
        markdown: '# Installation Guide\n\nInstall steps.',
        headings: [{ depth: 2, text: 'Setup', slug: 'setup' }],
        optional: false,
      },
    ],
    llmsCfg,
  );

  const png = await sharp({
    create: { width: 1200, height: 630, channels: 4, background: { r: 37, g: 99, b: 235, alpha: 1 } },
  })
    .png()
    .toBuffer();
  writeFileSync(join(distDir, 'og/guides-macro.png'), png);

  const cmdkPages = JSON.stringify([
    { title: 'Macro Guide', url: '/guides/macro/', headings: [{ title: 'Syntax', slug: 'syntax' }] },
    { title: 'Installation Guide', url: '/guides/install/', headings: [{ title: 'Setup', slug: 'setup' }] },
  ]);

  const renderPage = (locale: 'en' | 'fr', route: string, title: string) => {
    const cmdkCfg = JSON.stringify({
      locale,
      localePrefix: locale === 'fr' ? '/fr' : '',
      ui: {},
      aiProviders: AI_PROVIDERS,
    });
    return [
      '<!doctype html>',
      '<html lang="' + locale + '">',
      '<head><meta charset="utf-8" /><title>' + title + '</title>',
      '<style>[data-zen-mode="true"] .sidebar-pane { display: none; }</style>',
      '</head>',
      '<body>',
      '  <header class="header">',
      '    <div data-cmdk-root data-locale="' + locale + '" data-current-route="' + route + '">',
      '      <button type="button" data-cmdk-open>Search</button>',
      '      <dialog id="sl-cmdk-dialog">',
      '        <div class="sl-cmdk-panel">',
      '          <div class="sl-cmdk-header">',
      '            <input id="sl-cmdk-input" type="search" />',
      '            <button id="sl-cmdk-clear" type="button">Clear</button>',
      '          </div>',
      '          <div id="sl-cmdk-tabs" role="tablist"></div>',
      '          <div class="sl-cmdk-body">',
      '            <div id="sl-cmdk-list" role="listbox"></div>',
      '            <aside id="sl-cmdk-preview"></aside>',
      '          </div>',
      '          <div class="sl-cmdk-footer"><span id="sl-cmdk-status"></span></div>',
      '        </div>',
      '      </dialog>',
      '      <script type="application/json" data-cmdk-config>' + cmdkCfg + '</script>',
      '      <script type="application/json" data-cmdk-pages>' + cmdkPages + '</script>',
      '    </div>',
      '    <button type="button" data-zen-toggle aria-pressed="false">Zen</button>',
      '  </header>',
      '  <aside class="sidebar-pane">Sidebar</aside>',
      '  <nav class="right-sidebar"><starlight-toc><nav><h2>On this page</h2><ul><li><a href="#_top">Top</a></li><li><a href="#syntax">Syntax</a></li><li><a href="#examples">Examples</a></li></ul></nav></starlight-toc></nav>',
      '  <main>',
      '    <div class="sl-reading-context" data-reading-minutes="3">3 min read · Guides</div>',
      '    <div class="page-actions-container" data-copy-label="Copy" data-copied-label="Copied" data-copy-error="Error" data-share-label="Share" data-link-copied="Link Copied">',
      '      <button id="copy-markdown" type="button"><span class="morph-icon__base"></span><span class="morph-icon__check"><svg><path d="M0 0 L10 10"/></svg></span><span class="morph-label__default">Copy Markdown</span><span class="morph-label__success"></span></button>',
      '      <div class="action-dropdown" data-open="false">',
      '        <button id="open-ai-trigger" type="button"><svg class="ai-chevron"></svg>Open in AI</button>',
      '        <div class="dropdown-menu"><a href="https://chatgpt.com">ChatGPT</a></div>',
      '      </div>',
      '      <button id="share-page" type="button"><span class="morph-label__default">Share</span><span class="morph-label__success"></span></button>',
      '    </div>',
      '    <h1>' + title + '</h1>',
      '    <div class="sl-markdown-content" style="min-height: 1600px;">',
      '      <h2 id="syntax">Syntax</h2>',
      '      <p>Learn how TokenStream works and check the <a href="/guides/install/">Installation Guide</a>.</p>',
      '      <h2 id="examples">Examples</h2>',
      '      <p>Detailed examples for ' + title + '.</p>',
      '    </div>',
      '    <section class="sl-related-pages" data-related-route="' + route + '"></section>',
      '  </main>',
      '  <script type="module" src="/assets/bundle.js"></script>',
      '</body>',
      '</html>',
    ].join('\n');
  };
  writeFileSync(join(distDir, 'index.html'), renderPage('en', '/', 'Fixture Docs Home'));
  writeFileSync(join(distDir, 'guides/macro/index.html'), renderPage('en', '/guides/macro/', 'Macro Guide'));
  writeFileSync(
    join(distDir, 'guides/install/index.html'),
    renderPage('en', '/guides/install/', 'Installation Guide'),
  );
  writeFileSync(
    join(distDir, 'fr/guides/macro/index.html'),
    renderPage('fr', '/fr/guides/macro/', 'Guide des Macros'),
  );
  writeFileSync(stampFile, String(Date.now()));
  return distDir;
}
export async function startE2eFixtureSite(): Promise {
  const repoRoot = resolve(import.meta.dirname, '../..');
  const distDir = await ensureFixtureBuilt(repoRoot);
  const server: Server = createServer((req, res) => {
    const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
    let filePath = join(distDir, pathname);
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, 'index.html');
    }
    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address();
  const baseUrl = typeof addr === 'object' && addr ? 'http://127.0.0.1:' + addr.port : '';
  return {
    distDir,
    baseUrl,
    async close() {
      server.close();
    },
  };
}
