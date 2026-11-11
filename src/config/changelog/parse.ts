import fs from 'node:fs';
import type { Release } from './types.js';

const HEADING = /^##\s+\[([^\]]+)\](?:\s*[-—–]\s*(.+))?$/;

export function parseChangelog(content: string, repo: string): Release[] {
  const releases: Release[] = [];
  let cur: { version: string; date: string | null; body: string[] } | null = null;

  const flush = () => {
    if (!cur || !cur.date) return;
    releases.push({
      version: cur.version,
      date: cur.date,
      body: cur.body.join('\n').trim(),
      link: `https://github.com/${repo}/releases/tag/v${cur.version}`,
    });
  };

  for (const line of content.split('\n')) {
    const m = line.match(HEADING);
    if (m) {
      flush();
      const [, version, suffix] = m;
      if (version.toLowerCase() === 'unreleased') { cur = null; continue; }
      const date = suffix?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
      cur = { version, date, body: [] };
    } else if (cur) {
      cur.body.push(line);
    }
  }
  flush();
  return releases.sort((a, b) => b.date.localeCompare(a.date));
}

export function loadChangelog(absPath: string, repo: string): Release[] {
  return parseChangelog(fs.readFileSync(absPath, 'utf8'), repo);
}
