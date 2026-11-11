import fs from 'node:fs';
import path from 'node:path';
import { PageEntry, ResolvedLlmsConfig } from './types.js';
import { renderIndex } from './render/index.js';
import { renderFull } from './render/full.js';
import { renderSmall } from './render/small.js';
import { renderJson } from './render/json.js';
import { renderPageMd } from './render/page.js';

export function emitAll(distDir: string, pages: PageEntry[], cfg: ResolvedLlmsConfig) {
  const write = (file: string, content: string) => {
    const p = path.join(distDir, file);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  };

  if (cfg.outputs.index) write('llms.txt', renderIndex(pages, cfg));
  if (cfg.outputs.full) write('llms-full.txt', renderFull(pages, cfg));
  if (cfg.outputs.small) write('llms-small.txt', renderSmall(pages, cfg));
  if (cfg.outputs.json) write('llms.json', renderJson(pages, cfg));

  if (cfg.outputs.pages) {
    for (const p of pages) {
      const target = p.slug === 'index' ? 'index.md' : `${p.slug}.md`;
      write(target, renderPageMd(p));
    }
  }

  if (cfg.outputs.robots) {
    const robotsPath = path.join(distDir, 'robots.txt');
    const line = 'LLM: /llms.txt\n';
    if (fs.existsSync(robotsPath)) {
      const content = fs.readFileSync(robotsPath, 'utf8');
      if (!content.includes('LLM:')) fs.appendFileSync(robotsPath, `\n${line}`);
    } else {
      fs.writeFileSync(robotsPath, line);
    }
  }
}
