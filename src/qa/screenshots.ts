import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { readdir, mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import sharp from 'sharp';

const OUT = '.qa/screenshots';
const COLLAGES_DIR = '.qa/collages';
const args = new Set(process.argv.slice(2));
const CONCURRENCY = Math.max(2, Math.min(12, Number(process.env.QA_CONCURRENCY) || 8));
const SAMPLE_MODE = process.env.QA_SAMPLE === '1' || args.has('--sample');
const MAX_COLLAGES = Math.max(1, Math.min(10, Number(process.env.QA_MAX_COLLAGES) || 10));
const CLEAN_RAW = process.env.QA_CLEAN_RAW === '1' || args.has('--clean-raw');
const OPEN_DIR =
  !process.env.VITEST &&
  process.env.QA_OPEN !== '0' &&
  (process.env.QA_OPEN === '1' || args.has('--open') || process.stdout.isTTY);

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

function escXml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

async function makeLabelPng(
  width: number,
  height: number,
  label: string,
  hasError: boolean,
): Promise<Buffer> {
  const bg = hasError ? { r: 127, g: 29, b: 29, alpha: 1 } : { r: 30, g: 41, b: 59, alpha: 1 };
  const fg = hasError ? '#fecaca' : '#e2e8f0';
  const badge = hasError ? 'ERR' : 'OK';
  const markup = `<span foreground="${fg}" font_desc="Menlo Bold 11">[${badge}] ${escXml(label)}</span>`;
  const textImg = await sharp({
    text: {
      text: markup,
      width: width - 16,
      height: height - 4,
      rgba: true,
    },
  })
    .png()
    .toBuffer();

  return sharp({
    create: { width, height, channels: 4, background: bg },
  })
    .composite([{ input: textImg, left: 8, top: 3 }])
    .png()
    .toBuffer();
}

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
  const sorted = [...new Set(list)].toSorted((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
  return SAMPLE_MODE ? selectSampleRoutes(sorted) : sorted;
}

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

type Failure = { kind: string; detail: string; route: string; viewport: string; theme: string };
const failures: Failure[] = [];
const failedKeys = new Set<string>();
const fail = (route: string, viewport: string, theme: string, kind: string, detail: string): void => {
  failures.push({ route, viewport, theme, kind, detail });
  failedKeys.add(`${route}::${viewport}::${theme}`);
};

const t0 = performance.now();
const srv = process.env.QA_BASE_URL
  ? { url: process.env.QA_BASE_URL, close: async () => {} }
  : await startStaticServer('dist');

const browser = await chromium.launch();
const all = await routes();
await rm(OUT, { recursive: true, force: true });
await rm(COLLAGES_DIR, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await mkdir(COLLAGES_DIR, { recursive: true });

type Job = { route: string; vpName: keyof typeof VIEWPORTS; theme: 'light' | 'dark'; outFile: string };
const jobs: Job[] = [];
for (const route of all) {
  const slug = route === '/' ? 'index' : route.replaceAll(/^\/|\/$/g, '').replaceAll('/', '_');
  for (const vpName of Object.keys(VIEWPORTS) as Array<keyof typeof VIEWPORTS>) {
    for (const theme of ['light', 'dark'] as const) {
      jobs.push({
        route,
        vpName,
        theme,
        outFile: path.join(OUT, `${slug}--${vpName}--${theme}.jpg`),
      });
    }
  }
}

process.stdout.write(
  'QA start: ' +
    all.length +
    ' routes (' +
    jobs.length +
    ' captures, concurrency=' +
    CONCURRENCY +
    ', sample=' +
    SAMPLE_MODE +
    ')\n',
);

let cursor = 0;
let done = 0;
async function worker() {
  const pool = new Map<
    string,
    {
      ctx: Awaited<ReturnType<typeof browser.newContext>>;
      page: Awaited<ReturnType<Awaited<ReturnType<typeof browser.newContext>>['newPage']>>;
      activeJob: Job | null;
    }
  >();

  for (const vpName of Object.keys(VIEWPORTS) as Array<keyof typeof VIEWPORTS>) {
    for (const theme of ['light', 'dark'] as const) {
      const ctx = await browser.newContext({ viewport: VIEWPORTS[vpName], reducedMotion: 'reduce' });
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem('starlight-theme', t);
        } catch {}
      }, theme);
      await ctx.route('**/*', (routeReq) => {
        const u = routeReq.request().url();
        if (u.startsWith(srv.url) || u.startsWith('data:') || u.startsWith('blob:')) {
          return routeReq.continue();
        }
        return routeReq.fulfill({ status: 204, body: '' });
      });
      const page = await ctx.newPage();
      const slot = { ctx, page, activeJob: null as Job | null };
      page.on('console', (m) => {
        if (m.type() === 'error' && slot.activeJob) {
          fail(slot.activeJob.route, slot.activeJob.vpName, slot.activeJob.theme, 'console', m.text());
        }
      });
      page.on('pageerror', (e) => {
        if (slot.activeJob) {
          fail(slot.activeJob.route, slot.activeJob.vpName, slot.activeJob.theme, 'pageerror', e.message);
        }
      });
      page.on('response', (r) => {
        if (r.status() >= 400 && r.url().startsWith(srv.url) && slot.activeJob) {
          fail(
            slot.activeJob.route,
            slot.activeJob.vpName,
            slot.activeJob.theme,
            'http',
            r.status() + ' ' + r.url(),
          );
        }
      });
      pool.set(vpName + ':' + theme, slot);
    }
  }

  while (true) {
    const idx = cursor++;
    if (idx >= jobs.length) break;
    const job = jobs[idx]!;
    const { route, vpName, theme, outFile } = job;
    const isNotFound = route === '/404.html';
    const slot = pool.get(vpName + ':' + theme)!;
    slot.activeJob = job;
    const { page } = slot;

    await page.goto(srv.url + route, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.evaluate(() => document.fonts.ready);

    const applied = await page.evaluate(() => document.documentElement.dataset.theme);
    if (applied !== theme) {
      const toggle = page.locator('starlight-theme-select button, button[data-theme-toggle]').first();
      if (await toggle.count()) {
        await toggle.click();
        await page.waitForTimeout(20);
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
          'render ' +
            probe.logo.renderW +
            'x' +
            probe.logo.renderH +
            ' > natural ' +
            probe.logo.naturalW +
            'x' +
            probe.logo.naturalH,
        );
      }
    }
    await page.screenshot({ path: outFile, fullPage: false, type: 'jpeg', quality: 85 });
    slot.activeJob = null;
    done++;
    if (done % 25 === 0 || done === jobs.length) {
      process.stdout.write('  [qa] ' + done + '/' + jobs.length + '\n');
    }
  }
  for (const slot of pool.values()) {
    await slot.page.close();
    await slot.ctx.close();
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, () => worker()));
await browser.close();
await srv.close();
// Group by route (4 columns per row: Desktop Light | Desktop Dark | Mobile Light | Mobile Dark)
const capturedJobs: Job[] = [];
for (const j of jobs) {
  try {
    await stat(j.outFile);
    capturedJobs.push(j);
  } catch {}
}
if (capturedJobs.length > 0) {
  const cols = 4;
  const rowsPerSheet = Math.max(1, Math.ceil(all.length / MAX_COLLAGES));
  const perSheet = rowsPerSheet * cols;
  const sheetCount = Math.min(MAX_COLLAGES, Math.ceil(capturedJobs.length / perSheet));
  const cellW = 520;
  const headerH = 24;
  const imgH = 340;
  const cellH = headerH + imgH;
  const pad = 10;
  await Promise.all(
    Array.from({ length: sheetCount }, async (_, sheetIdx) => {
      const slice = capturedJobs.slice(sheetIdx * perSheet, (sheetIdx + 1) * perSheet);
      if (slice.length === 0) return;
      const rows = Math.ceil(slice.length / cols);
      const composites: Array<{ input: Buffer; left: number; top: number }> = [];
      await Promise.all(
        slice.map(async (job, i) => {
          const left = pad + (i % cols) * (cellW + pad);
          const top = pad + Math.floor(i / cols) * (cellH + pad);
          const hasErr = failedKeys.has(`${job.route}::${job.vpName}::${job.theme}`);
          const shortRoute = job.route.length > 42 ? '…' + job.route.slice(-41) : job.route;
          const label = `${shortRoute} · ${job.vpName === 'desktop' ? 'DT' : 'MB'} · ${job.theme}`;
          const imgBuf = await sharp(job.outFile)
            .resize({
              width: cellW,
              height: imgH,
              fit: 'contain',
              background: { r: 15, g: 23, b: 42, alpha: 1 },
            })
            .png()
            .toBuffer();
          composites.push(
            { input: await makeLabelPng(cellW, headerH, label, hasErr), left, top },
            { input: imgBuf, left, top: top + headerH },
          );
        }),
      );
      const sheetName = `collage-${String(sheetIdx + 1).padStart(2, '0')}.png`;
      await sharp({
        create: {
          width: pad + cols * (cellW + pad),
          height: pad + rows * (cellH + pad),
          channels: 4,
          background: { r: 9, g: 13, b: 24, alpha: 1 },
        },
      })
        .composite(composites)
        .png({ compressionLevel: 6 })
        .toFile(path.join(COLLAGES_DIR, sheetName));
    }),
  );
  await writeFile('.qa/collage.png', await readFile(path.join(COLLAGES_DIR, 'collage-01.png')));
}
if (CLEAN_RAW) {
  await rm(OUT, { recursive: true, force: true });
}
await writeFile('.qa/failures.json', JSON.stringify(failures, null, 2));
const elapsedSec = ((performance.now() - t0) / 1000).toFixed(2);
if (OPEN_DIR && capturedJobs.length > 0) {
  const opener =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  execFile(opener, [path.resolve(COLLAGES_DIR)], () => {});
}
if (failures.length) {
  console.error('QA FAILED — ' + failures.length + ' issue(s):');
  for (const f of failures) {
    console.error('  [' + f.kind + '] ' + f.route + ' (' + f.viewport + '/' + f.theme + '): ' + f.detail);
  }
  process.exit(1);
}
console.log(
  'QA PASSED — ' +
    all.length +
    ' routes × 2 viewports × 2 themes in ' +
    elapsedSec +
    's → ' +
    Math.min(
      MAX_COLLAGES,
      Math.ceil(capturedJobs.length / (Math.max(1, Math.ceil(all.length / MAX_COLLAGES)) * 4)),
    ) +
    ' collage(s) in ' +
    COLLAGES_DIR +
    ' (concurrency=' +
    CONCURRENCY +
    ', sample=' +
    SAMPLE_MODE +
    ')',
);
