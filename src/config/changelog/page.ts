import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { loadChangelog } from './parse.js';

export async function GET() {
  const cfg = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), '.astro', 'changelog.json'), 'utf8'),
  );
  const releases = loadChangelog(cfg.absPath, cfg.repo);

  // Build collapsible <details> blocks
  const html = releases.map(r => `
    <details class="changelog-entry">
      <summary>
        <h2 id="v${r.version}">
          <a href="${r.link}">v${r.version}</a>
          <small>${r.date}</small>
        </h2>
      </summary>
      <div class="changelog-body">
        ${marked.parse(r.body)}
      </div>
    </details>
  `).join('\n');

  const page = `<!doctype html><html><head><meta charset="utf-8">
  <title>${cfg.title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
    details { border-bottom: 1px solid #eee; padding: 1rem 0; }
    details:last-child { border-bottom: none; }
    summary { cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; }
    summary::-webkit-details-marker { display: none; }
    summary h2 { margin: 0; font-size: 1.25rem; }
    summary h2 small { font-size: 0.9rem; font-weight: normal; color: #666; margin-left: 0.5rem; }
    details[open] summary { margin-bottom: 1rem; border-bottom: 1px solid #f0f0f0; padding-bottom: 0.5rem; }
    .changelog-body h3 { font-size: 1rem; text-transform: uppercase; margin-top: 1rem; }
  </style>
  </head><body>
  <h1>${cfg.title}</h1>
  ${html}
  </body></html>`;

  return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
