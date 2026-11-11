import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_SECTIONS = [
  { label: 'Tutorials', paths: ['tutorials/**'] },
  { label: 'How-to Guides', paths: ['guides/**'] },
  { label: 'Reference', paths: ['reference/**'] },
  { label: 'Explanation', paths: ['explanation/**'] },
];

export function humanize(name: string): string {
  return name.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function detectSections(contentRoot = 'src/content/docs') {
  try {
    const entries = fs.readdirSync(contentRoot, { withFileTypes: true });
    const sections: Array<{ label: string; paths: string[] }> = [];
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || e.name === '_') continue;
      const hasContent = (function walk(dir: string): boolean {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) return true;
          if (entry.isDirectory() && walk(path.join(dir, entry.name))) return true;
        }
        return false;
      })(path.join(contentRoot, e.name));
      if (hasContent) sections.push({ label: humanize(e.name), paths: [`${e.name}/**`] });
    }
    return sections.length > 0 ? sections : null;
  } catch {
    return null;
  }
}
