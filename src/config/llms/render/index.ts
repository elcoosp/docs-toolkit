import { PageEntry, ResolvedLlmsConfig } from '../types.js';

export function renderIndex(pages: PageEntry[], cfg: ResolvedLlmsConfig): string {
  let out = `# ${cfg.title}\n\n> ${cfg.description}\n\nSource: ${cfg.source}\n`;

  const sections = [...new Set(pages.map(p => p.section))].filter(s => s !== 'Overview' && s !== 'Optional');

  for (const section of sections) {
    const group = pages.filter(p => p.section === section);
    out += `\n## ${section}\n\n`;
    for (const p of group) {
      out += `- [${p.title}](${cfg.url}${p.route}): ${p.description}\n`;
    }
  }

  const optional = pages.filter(p => p.section === 'Optional' || cfg.optional.includes(p.slug));
  if (optional.length > 0) {
    out += `\n## Optional\n\n`;
    for (const p of optional) {
      out += `- [${p.title}](${cfg.url}${p.route}): ${p.description}\n`;
    }
  }

  return out.trim() + '\n';
}
