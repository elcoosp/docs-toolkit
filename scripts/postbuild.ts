import { readdir, readFile, writeFile, copyFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

// 1) copy runtime assets
await mkdir('dist/assets', { recursive: true });
for (const f of await readdir('src/assets')) {
  await copyFile(path.join('src/assets', f), path.join('dist/assets', f));
}

// 2) guarantee shebangs on every emitted bin (tsdown normally preserves them)
const SHEBANG = '#!/usr/bin/env node\n';
for (const f of await readdir('dist/qa')) {
  if (!f.endsWith('.mjs')) continue;
  const p = path.join('dist/qa', f);
  const src = await readFile(p, 'utf8');
  if (!src.startsWith('#!')) await writeFile(p, SHEBANG + src);
}

// 3) regenerate exports/main/types from what was actually emitted
const SUBS = {
  '.': 'dist/index.mjs',
  './og': 'dist/og/index.mjs',
  './og/routeData': 'dist/og/routeData.mjs',
  './config': 'dist/config/index.mjs',
  './package.json': './package.json',
};

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const exportsMap = {};

for (const [sub, target] of Object.entries(SUBS)) {
  if (target === './package.json') { exportsMap[sub] = './package.json'; continue; }
  if (!(await exists(target))) throw new Error(`postbuild: missing output ${target}`);
  const base = target.replace(/\.mjs$/, '');
  const dts = (await exists(base + '.d.mts')) ? base + '.d.mts'
            : (await exists(base + '.d.ts'))  ? base + '.d.ts'
            : null;
  exportsMap[sub] = dts ? { types: './' + dts, import: './' + target } : './' + target;
}

const rootTypes = exportsMap['.'].types;
pkg.exports = exportsMap;
// [fleet-roll] Preserve hand-curated ./src/* passthrough. Astro/Vite consumers
// resolve PageActions.astro, llms/*, changelog/* directly from src/ — this
// subpath is not derivable from dist/ and must not be clobbered by postbuild.
pkg.exports['./src/*'] = './src/*';
pkg.exports['./PageActions.astro'] = './src/config/components/PageActions.astro';
pkg.main = './' + SUBS['.'];
pkg.types = rootTypes;
pkg.bin = {
  'docs-toolkit-qa-components': './dist/qa/components.mjs',
  'docs-toolkit-qa-screenshots': './dist/qa/screenshots.mjs',
  'docs-toolkit-bootstrap-artifacts': './dist/qa/bootstrap-artifacts.mjs',
};

await writeFile('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('postbuild: assets copied, shebangs ensured, exports regenerated');






console.log('postbuild: root types =', pkg.types);
