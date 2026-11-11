import rss from '@astrojs/rss';
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { loadChangelog } from './parse.js';

export async function GET(context: { site: URL }) {
  const cfg = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), '.astro', 'changelog.json'), 'utf8'),
  );
  const releases = loadChangelog(cfg.absPath, cfg.repo);
  return rss({
    title: cfg.title,
    description: cfg.description,
    site: context.site,
    items: releases.map((r) => ({
      title: `v${r.version}`,
      pubDate: new Date(r.date),
      link: r.link,
      content: marked.parse(r.body),
    })),
  });
}
