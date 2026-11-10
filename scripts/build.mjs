import { build } from 'esbuild';
import { mkdir, cp, readdir } from 'node:fs/promises';
import path from 'node:path';

await mkdir('dist', { recursive: true });

// Transpile JSX → ESM without bundling; imports like "react/jsx-runtime" stay intact.
await build({
  entryPoints: ['src/og/og-render.jsx'],
  outfile: 'dist/og/og-render.mjs',
  bundle: false,
  format: 'esm',
  jsx: 'automatic',
  target: 'node22',
});

async function copyDir(src, dst) {
  await mkdir(dst, { recursive: true });
  for (const e of await readdir(src, { withFileTypes: true })) {
    const sp = path.join(src, e.name);
    const dp = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(sp, dp);
    else if (e.name.endsWith('.mjs') || e.name.endsWith('.js')) await cp(sp, dp);
  }
}

await copyDir('src/og', 'dist/og');
await copyDir('src/config', 'dist/config');
await copyDir('src/qa', 'dist/qa');
await copyDir('src/bin', 'dist/bin');
await cp('src/index.mjs', 'dist/index.mjs');
await mkdir('dist/assets', { recursive: true });
await cp('src/assets/roboto-latin-400-normal.woff2', 'dist/assets/roboto-latin-400-normal.woff2');

console.log('build: dist/ ready');
