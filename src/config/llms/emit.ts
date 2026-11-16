import fs from 'node:fs';
import path from 'node:path';
import type { PageEntry, ResolvedLlmsConfig } from './types.js';
import { renderIndex } from './render/index.js';
import { renderFull } from './render/full.js';
import { renderSmall } from './render/small.js';
import { renderJson } from './render/json.js';
import { renderPageMd } from './render/page.js';

const NL = String.fromCharCode(10);

export function emitAll(
  distDir: string,
  pages: PageEntry[],
  cfg: ResolvedLlmsConfig,
  log: (msg: string) => void = console.log,
): void {
  const safeWrite = (file: string, fn: () => string) => {
    try {
      const content = fn();
      const p = path.join(distDir, file);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, content);
      log('  ✓ ' + file + ' (' + content.length + ' bytes)');
    } catch (e) {
      log('  ✗ ' + file + ' — ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  if (cfg.outputs.index) safeWrite('llms.txt', () => renderIndex(pages, cfg, 'en'));
  if (cfg.outputs.full) safeWrite('llms-full.txt', () => renderFull(pages, cfg, 'en'));
  if (cfg.outputs.small) safeWrite('llms-small.txt', () => renderSmall(pages, cfg, 'en'));
  if (cfg.outputs.json) safeWrite('llms.json', () => renderJson(pages, cfg, 'en'));

  const secondaryLocales = [...new Set(pages.map((p) => p.locale))].filter((l) => l !== 'en');
  for (const loc of secondaryLocales) {
    if (cfg.outputs.index) safeWrite(loc + '/llms.txt', () => renderIndex(pages, cfg, loc));
    if (cfg.outputs.full) safeWrite(loc + '/llms-full.txt', () => renderFull(pages, cfg, loc));
    if (cfg.outputs.small) safeWrite(loc + '/llms-small.txt', () => renderSmall(pages, cfg, loc));
    if (cfg.outputs.json) safeWrite(loc + '/llms.json', () => renderJson(pages, cfg, loc));
  }

  if (cfg.outputs.pages) {
    for (const p of pages) {
      const target = p.slug === 'index' ? 'index.md' : p.slug + '.md';
      safeWrite(target, () => renderPageMd(p));
    }
  }

  if (cfg.outputs.robots) {
    try {
      const robotsPath = path.join(distDir, 'robots.txt');
      const baseUrl = cfg.url.replace(/\/+$/, '');
      const llmsLocation = baseUrl ? baseUrl + '/llms.txt' : '/llms.txt';
      const directive = NL + '# LLMs' + NL + 'LLMs-Txt: ' + llmsLocation + NL;
      if (fs.existsSync(robotsPath)) {
        const content = fs.readFileSync(robotsPath, 'utf8');
        if (!content.includes('LLMs-Txt:') && !content.includes('LLM:')) fs.appendFileSync(robotsPath, directive);
        log('  ✓ robots.txt (LLMs-Txt: ' + llmsLocation + ')');
      } else {
        fs.writeFileSync(robotsPath, 'User-agent: *' + NL + 'Allow: /' + NL + directive);
        log('  ✓ robots.txt (created with LLMs-Txt: ' + llmsLocation + ')');
      }
    } catch (e) {
      log('  ✗ robots.txt — ' + (e instanceof Error ? e.message : String(e)));
    }
  }
}
