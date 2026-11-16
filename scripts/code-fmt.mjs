#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const config = path.join(root, '.oxfmtrc.json');
const res = spawnSync('oxfmt', ['-c', config, ...process.argv.slice(2)], { stdio: 'inherit', shell: true });
process.exit(res.status ?? 1);
