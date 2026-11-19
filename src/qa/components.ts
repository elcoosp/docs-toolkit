import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const CLS: Record<string, string> = {
  Aside: 'sl-aside',
  Badge: 'sl-badge',
  Card: 'sl-card',
  CardGrid: 'card-grid',
  Code: 'expressive-code',
  DiataxisGrid: 'dt-diataxis',
  FeatureGrid: 'dt-fg',
  FileTree: 'file-tree',
  LinkButton: 'sl-link-button',
  LinkCard: 'sl-link-card',
  StatStrip: 'dt-stats',
  Steps: 'sl-steps',
  Tabs: 'sl-tabs',
};
async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name === 'index.html') out.push(p);
  }
  return out;
}
let fails = 0;
for (const f of await walk('dist')) {
  const html = await readFile(f, 'utf8');
  const rel = path.relative('dist', f).replace('/index.html', '/');
  const found = Object.keys(CLS).filter((c) => html.includes(CLS[c]));
  for (const reqId of ['sl-cmdk-dialog', 'sl-cmdk-input', 'sl-cmdk-list', 'sl-cmdk-preview']) {
    if (!html.includes(`id="${reqId}"`)) {
      console.log(`  ${rel}: missing #${reqId}`);
      fails++;
    }
  }
  for (const uiCls of ['sl-zen-toggle', 'sl-reading-context', 'page-actions-container']) {
    const tagMatch = html.match(new RegExp(`<[^>]*class="[^"]*\\b${uiCls}\\b[^"]*"[^>]*>`));
    if (tagMatch && !tagMatch[0].includes('data-pagefind-ignore="all"')) {
      console.log(`  ${rel}: .${uiCls} missing data-pagefind-ignore="all"`);
      fails++;
    }
  }
  if (found.length === 0 && !rel.endsWith('/404/')) {
    console.log(`  ${rel}: 0 comps`);
    fails++;
  }
}
if (fails) {
  console.error(`✗ ${fails} page(s)`);
  process.exit(1);
}
console.log('✓ all pages ≥1 component + command palette & pagefind-ignore QA passed');
