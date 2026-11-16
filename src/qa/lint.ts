#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const rumdlPkgDir = dirname(require.resolve('rumdl/package.json'));
const rumdlBin = join(rumdlPkgDir, 'bin', process.platform === 'win32' ? 'rumdl.exe' : 'rumdl');
const configPath = fileURLToPath(new URL('../../rumdl.toml', import.meta.url));
const extraArgs = process.argv.slice(2).filter((a) => a !== '--');

const res = spawnSync(rumdlBin, ['check', '--config', configPath, ...extraArgs, 'src/content/docs'], {
  stdio: 'inherit',
});

process.exit(res.status ?? 1);
