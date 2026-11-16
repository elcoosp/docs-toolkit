import { chromium } from 'playwright';
import { readdir, mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import sharp from 'sharp';

const OUT = '.qa/screenshots';
const CONCURRENCY = Math.max(2, Math.min(8, Number(process.env.QA_CONCURRENCY) || 6));
const SAMPLE_MODE = process.env.QA_SAMPLE === '1';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

function startStaticServer(rootDir: string): Promise<{ url: string; close: () => Promise<void> }> {
  const absRoot = path.resolve(rootDir);
  const server = http.createServer(async (req, res) => {
    const rawPath = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    let candidate = path.join(absRoot, rawPath);
    if (!candidate.startsWith(absRoot)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const st = await stat(candidate);
      if (st.isDirectory()) candidate = path.join(candidate, 'index.html');
      const data = await readFile(candidate);
      const ext = path.extname(candidate).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' }).end(data);
    } catch {
      try {
        const notFound = await readFile(path.join(absRoot, '404.html'));
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }).end(notFound);
      } catch {
        res.writeHead(404).end('Not Found');
      }
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        url: 'http://127.0.0.1:' + addr.port,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else if (e.name === 'index.html') files.push(p);
  }
  return files;
}

function selectSampleRoutes(allRoutes: string[]): string[] {
  const nonFrNonZen = allRoutes.filter((r) => !r.startsWith('/fr/') && !r.startsWith('/zen-mode/'));
  const picks = new Set<string>();
  if (nonFrNonZen.includes('/')) picks.add('/');
  const firstGuide = nonFrNonZen.find((r) => r.startsWith('/guides/'));
  if (firstGuide) picks.add(firstGuide);
  const firstRef = nonFrNonZen.find((r) => r.startsWith('/reference/'));
  if (firstRef) picks.add(firstRef);
  if (nonFrNonZen.includes('/blog/')) picks.add('/blog/');
  const firstPost = nonFrNonZen.find(
    (r) =>
      r.startsWith('/blog/') &&
      r !== '/blog/' &&
      !r.startsWith('/blog/authors/') &&
      !r.startsWith('/blog/tags/'),
  );
  if (firstPost) picks.add(firstPost);
  if (nonFrNonZen.includes('/changelog/')) picks.add('/changelog/');
  return [...picks];
}

async function routes() {
  const files = await walk('dist');
  const list = files.map((f) => {
    const rel = path.relative('dist', path.dirname(f));
    return '/' + (rel === '.' || rel === '' ? '' : rel + '/');
  });
  if (!SAMPLE_MODE) {
    try {
      await stat('dist/404.html');
      list.push('/404.html');
    } catch {}
  }
  const sorted = [...new Set(list)].sort((a, b) =>
    a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b),
  );
  return SAMPLE_MODE ? selectSampleRoutes(sorted) : sorted;
}

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

type Failure = { kind: string; detail: string; route: string; viewport: string; theme: string };
const failures: Failure[] = [];
const fail = (route: string, viewport: string, theme: string, kind: string, detail: string): void => {
  failures.push({ route, viewport, theme, kind, detail });
};

const srv = process.env.QA_BASE_URL
  ? { url: process.env.QA_BASE_URL, close: async () => {} }
  : await startStaticServer('dist');

const browser = await chromium.launch();
const all = await routes();
await mkdir(OUT, { recursive: true });

type Job = { route: string; vpName: keyof typeof VIEWPORTS; theme: 'light' | 'dark' };
const jobs: Job[] = [];
for (const route of all) {
  for (const vpName of Object.keys(VIEWPORTS) as Array<keyof typeof VIEWPORTS>) {
    for (const theme of ['light', 'dark'] as const) {
      jobs.push({ route, vpName, theme });
    }
  }
}

process.stdout.write(
  'QA start: ' + all.length + ' routes (' + jobs.length + ' captures, concurrency=' + CONCURRENCY + ', sample=' + SAMPLE_MODE + ')\n',
);

let cursor = 0;
let done = 0;
async function worker() {
  const contexts = new Map<string, Awaited<ReturnType<typeof browser.newContext>>>();
  for (const vpName of Object.keys(VIEWPORTS) as Array<keyof typeof VIEWPORTS>) {
    for (const theme of ['light', 'dark'] as const) {
      const ctx = await browser.newContext({ viewport: VIEWPORTS[vpName], reducedMotion: 'reduce' });
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem('starlight-theme', t);
        } catch {}
      }, theme);
      contexts.set(vpName + ':' + theme, ctx);
    }
  }

  while (true) {
    const idx = cursor++;
    if (idx >= jobs.length) break;
    const { route, vpName, theme } = jobs[idx]!;
    const isNotFound = route === '/404.html';
    const ctx = contexts.get(vpName + ':' + theme)!;
    const page = await ctx.newPage();

    page.on('console', (m) => {
      if (m.type() === 'error') fail(route, vpName, theme, 'console', m.text());
    });
    page.on('pageerror', (e) => fail(route, vpName, theme, 'pageerror', e.message));
    page.on('response', (r) => {
      if (r.status() >= 400 && r.url().startsWith(srv.url)) {
        fail(route, vpName, theme, 'http', r.status() + ' ' + r.url());
      }
    });

    await page
      .goto(srv.url + route, { waitUntil: 'networkidle', timeout: 15000 })
      .catch(() => page.goto(srv.url + route, { waitUntil: 'domcontentloaded', timeout: 10000 }));
    await page.evaluate(() => document.fonts.ready);

    const applied = await page.evaluate(() => document.documentElement.dataset.theme);
    if (applied !== theme) {
      const toggle = page.locator('starlight-theme-select button, button[data-theme-toggle]').first();
      if (await toggle.count()) {
        await toggle.click();
        await page.waitForTimeout(30);
      }
    }

    const probe = await page.evaluate(() => {
      const main = document.querySelector('main');
      const imgs = [...document.querySelectorAll('img')];
      const logo = document.querySelector('.site-title img, header img');
      return {
        theme: document.documentElement.dataset.theme,
        h1: document.querySelectorAll('h1').length,
        textLen: (main?.innerText ?? '').trim().length,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        brokenImgs: imgs
          .filter((i) => {
            const src = (i as HTMLImageElement).currentSrc || (i as HTMLImageElement).src;
            if (!src.startsWith(window.location.origin)) return false;
            return !i.complete || (i as HTMLImageElement).naturalWidth === 0;
          })
          .map((i) => (i as HTMLImageElement).currentSrc || (i as HTMLImageElement).src),
        logo: logo
          ? {
              src: (logo as HTMLImageElement).currentSrc || (logo as HTMLImageElement).src,
              naturalW: (logo as HTMLImageElement).naturalWidth,
              naturalH: (logo as HTMLImageElement).naturalHeight,
              renderW: logo.clientWidth,
              renderH: logo.clientHeight,
            }
          : null,
      };
    });

    if (probe.theme !== theme) fail(route, vpName, theme, 'theme', 'applied=' + probe.theme);
    if (!isNotFound) {
      if (probe.h1 !== 1) fail(route, vpName, theme, 'h1', 'count=' + probe.h1);
      if (probe.textLen < 200) fail(route, vpName, theme, 'empty', 'text=' + probe.textLen);
    }
    if (probe.overflow) fail(route, vpName, theme, 'overflow', 'horizontal scrollbar');
    for (const src of probe.brokenImgs) fail(route, vpName, theme, 'image', src);

    if (probe.logo) {
      if (!/\.png(\?|$)/i.test(probe.logo.src)) fail(route, vpName, theme, 'logo-format', probe.logo.src);
      if (probe.logo.renderW > probe.logo.naturalW + 1 || probe.logo.renderH > probe.logo.naturalH + 1) {
        fail(
          route,
          vpName,
          theme,
          'logo-upscale',
          'render ' + probe.logo.renderW + 'x' + probe.logo.renderH + ' > natural ' + probe.logo.naturalW + 'x' + probe.logo.naturalH,
        );
      }
    }

    const slug = route === '/' ? 'index' : route.replace(/^\/|\/$/g, '').replace(/\//g, '_');
    await page.screenshot({
      path: path.join(OUT, slug + '--' + vpName + '--' + theme + '.png'),
      fullPage: true,
    });
    await page.close();

    done++;
    if (done % 25 === 0 || done === jobs.length) {
      process.stdout.write('  [qa] ' + done + '/' + jobs.length + '\n');
    }
  }

  for (const ctx of contexts.values()) await ctx.close();
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, () => worker()));
await browser.close();
await srv.close();

const candidateSlugs = all.map((r) => (r === '/' ? 'index' : r.replace(/^\/|\/$/g, '').replace(/\//g, '_')));
const guideSlug = candidateSlugs.find((s) => s.startsWith('guides_')) ?? candidateSlugs[1] ?? 'index';
const blogSlug = candidateSlugs.find((s) => s === 'blog') ?? candidateSlugs[1] ?? 'index';
const postSlug = candidateSlugs.find((s) => s.startsWith('blog_') && s !== 'blog') ?? blogSlug;
const tileFiles = [
guideSlug + '--desktop--dark.png',
postSlug + '--desktop--light.png',
'index--desktop--dark.png',
guideSlug + '--mobile--dark.png',
];
const tiles: { buf: Buffer; left: number; top: number }[] = [];
const TILE_W = 720;
const TILE_H = 700;
for (let idx = 0; idx < tileFiles.length; idx++) {
const file = path.join(OUT, tileFiles[idx]!);
try {
const buf = await sharp(file)
.resize({ width: TILE_W })
.extract({ left: 0, top: 0, width: TILE_W, height: TILE_H })
.png()
.toBuffer();
tiles.push({
buf,
left: (idx % 2) * TILE_W,
top: Math.floor(idx / 2) * TILE_H,
});
} catch {}
}
if (tiles.length > 0) {
await sharp({
create: {
width: TILE_W * 2,
height: TILE_H * Math.ceil(tiles.length / 2),
channels: 4,
background: { r: 15, g: 23, b: 42, alpha: 1 },
},
})
.composite(tiles.map((t) => ({ input: t.buf, left: t.left, top: t.top })))
.png()
.toFile('.qa/collage.png');
}
await writeFile('.qa/failures.json', JSON.stringify(failures, null, 2));
if (failures.length) {
console.error('QA FAILED — ' + failures.length + ' issue(s):');
for (const f of failures) {
console.error('  [' + f.kind + '] ' + f.route + ' (' + f.viewport + '/' + f.theme + '): ' + f.detail);
}
process.exit(1);
}
console.log(
'QA PASSED — ' + all.length + ' routes × 2 viewports × 2 themes (concurrency=' + CONCURRENCY + ', sample=' + SAMPLE_MODE + ')',
);
