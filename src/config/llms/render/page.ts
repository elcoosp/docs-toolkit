import { PageEntry } from '../types.js';

export function renderPageMd(p: PageEntry): string {
  let out = `# ${p.title}\n\n`;
  if (p.description) out += `> ${p.description}\n\n`;
  out += p.body;
  return out.trim() + '\n';
}
