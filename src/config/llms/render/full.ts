import { PageEntry, ResolvedLlmsConfig } from '../types.js';

export function renderFull(pages: PageEntry[], cfg: ResolvedLlmsConfig): string {
  let out = `# ${cfg.title} — full documentation\n\n> ${cfg.description}\n\nSource: ${cfg.source}\n\n`;
  for (const p of pages) {
    out += `---\n\n# ${p.title}\n\n`;
    if (p.description) out += `${p.description}\n\n`;
    out += `${p.body}\n\n`;
  }
  return out.trim() + '\n';
}
