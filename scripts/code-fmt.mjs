#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const bin = path.join(root, 'node_modules', '.bin', 'oxfmt');
const config = path.join(root, '.oxfmtrc.json');
const res = spawnSync(bin, ['-c', config, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(res.status ?? 1);
