#!/usr/bin/env node
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const runTypecheck = args.includes('--typecheck');
const cleanDist = args.includes('--clean');
const onlyArg = args.find((a) => a.startsWith('--only='));
const onlySet = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',').filter(Boolean)) : null;
const workersArg = args.find((a) => a.startsWith('--workers='));
const workers = workersArg ? Math.max(1, Number(workersArg.slice('--workers='.length)) || 3) : 3;

const reposRoot = path.resolve(import.meta.dirname, '../..');
const compileCacheDir =
  process.env.NODE_COMPILE_CACHE || path.join(os.homedir(), '.cache/node-compile-cache');
fs.mkdirSync(compileCacheDir, { recursive: true });

const sites = [];
for (const entry of fs.readdirSync(reposRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const subDir = path.join(reposRoot, entry.name);
  for (const child of fs.readdirSync(subDir, { withFileTypes: true })) {
    if (!child.isDirectory() || !child.name.endsWith('-docs')) continue;
    if (onlySet && !onlySet.has(child.name)) continue;
    const siteDir = path.join(subDir, child.name);
    const pkgPath = path.join(siteDir, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (!allDeps['@elcoosp/docs-toolkit']) continue;
    const distDir = path.join(siteDir, 'dist');
    const weight = fs.existsSync(distDir)
      ? fs.readdirSync(distDir, { recursive: true }).length
      : fs.readdirSync(path.join(siteDir, 'src/content'), { recursive: true }).length;
    sites.push({ name: child.name, dir: siteDir, weight });
  }
}

// Longest Processing Time (LPT) scheduling
sites.sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));

console.log(`Building ${sites.length} fleet site(s) (${workers} LPT workers, NODE_COMPILE_CACHE=${compileCacheDir})...
`);

function runCmd(bin, cmdArgs, cwd) {
  return new Promise((resolve) => {
    execFile(
      bin,
      cmdArgs,
      {
        cwd,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', NODE_COMPILE_CACHE: compileCacheDir },
      },
      (err, stdout, stderr) => {
        resolve({ err, out: `${stdout || ''}\n${stderr || ''}` });
      },
    );
  });
}

let idx = 0;
const results = [];
const fleetStart = performance.now();

await Promise.all(
  Array.from({ length: Math.min(workers, sites.length || 1) }, async () => {
    while (idx < sites.length) {
      const site = sites[idx++];
      const t0 = performance.now();
      if (cleanDist) {
        fs.rmSync(path.join(site.dir, 'dist'), { recursive: true, force: true });
      }
      if (runTypecheck) {
        const chk = await runCmd('./node_modules/.bin/astro', ['check', '--minimumFails', 'error'], site.dir);
        if (chk.err) {
          const dt = ((performance.now() - t0) / 1000).toFixed(2);
          results.push({ name: site.name, ok: false, dt });
          console.log(`  ✗ ${site.name.padEnd(26)} ${dt.padStart(5)}s | typecheck FAILED`);
          continue;
        }
      }
      const res = await runCmd('./node_modules/.bin/astro', ['build'], site.dir);
      const dt = ((performance.now() - t0) / 1000).toFixed(2);
      const pagesLine =
        res.out
          .split(/\r?\n/)
          .find((l) => /page\(s\) built in/.test(l))
          ?.replace(/^.*\[build\]\s*/, '')
          .trim() || (res.err ? 'FAILED' : 'OK');
      results.push({ name: site.name, ok: !res.err, dt: Number(dt) });
      console.log(`  ${!res.err ? '✓' : '✗'} ${site.name.padEnd(26)} ${dt.padStart(5)}s | ${pagesLine}`);
    }
  }),
);

const wall = ((performance.now() - fleetStart) / 1000).toFixed(2);
const okCount = results.filter((r) => r.ok).length;
console.log(`\n=== FLEET BUILD: ${okCount}/${results.length} succeeded in ${wall}s wall-clock ===`);
if (okCount !== results.length) process.exit(1);
