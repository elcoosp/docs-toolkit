import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StarlightUserConfig } from '@astrojs/starlight/types';
import type { AstroIntegration } from 'astro';

type StarlightPlugin = NonNullable<StarlightUserConfig['plugins']>[number];

export interface LlmsTxtConfig {
  customSets?: Array<{ label: string; paths: string[]; description?: string }>;
  promote?: string[];
  demote?: string[];
  domain?: string;
  /** Override the content root used to auto-detect sections. Default: src/content/docs */
  contentRoot?: string;
  /** If true, skip auto-detection and use flat output (no custom sets). */
  flat?: boolean;
}

const SKIP_DIRS = new Set(['_', 'node_modules', '.git', '.astro']);

/**
 * Turns a folder name into a human label.
 *   guides → Guides
 *   getting-started → Getting Started
 *   how-to → How To
 */
function humanize(name: string): string {
  return name
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Auto-detect top-level section folders from a content root.
 * Reads at config time, so each project gets sets matching its own structure.
 * Returns null if detection fails — caller falls back to plugin defaults.
 */
export function detectSections(
  contentRoot = 'src/content/docs',
): Array<{ label: string; paths: string[] }> | null {
  try {
    const entries = fs.readdirSync(contentRoot, { withFileTypes: true });
    const sections: Array<{ label: string; paths: string[] }> = [];

    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (SKIP_DIRS.has(e.name)) continue;
      // Must contain at least one md/mdx file (recursively)
      const hasContent = (function walk(dir: string): boolean {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) return true;
          if (entry.isDirectory() && walk(path.join(dir, entry.name))) return true;
        }
        return false;
      })(path.join(contentRoot, e.name));

      if (!hasContent) continue;
      sections.push({ label: humanize(e.name), paths: [`${e.name}/**`] });
    }

    return sections.length > 0 ? sections : null;
  } catch {
    return null;
  }
}

/** Preserved export for projects that want the classic 4-section default. */
export const DEFAULT_LLMS_SETS = [
  { label: 'Tutorials', paths: ['tutorials/**'] },
  { label: 'How-to Guides', paths: ['guides/**'] },
  { label: 'Reference', paths: ['reference/**'] },
  { label: 'Explanation', paths: ['explanation/**'] },
];


/**
 * Integration that appends a "## Documentation Sets" section to llms.txt.
 * Handles arbitrary set labels — reads whatever files are actually in
 * dist/_llms-txt/ and derives humanized labels from filenames.
 */
export function llmsManifestAppender(): AstroIntegration {
  return {
    name: 'llms-manifest-appender',
    hooks: {
      'astro:build:done': async ({ dir }: { dir: URL }) => {
        const distDir = fileURLToPath(dir);
        const llmsPath = path.join(distDir, 'llms.txt');
        const setsDir = path.join(distDir, '_llms-txt');

        if (!fs.existsSync(llmsPath)) return;
        if (!fs.existsSync(setsDir)) return;

        const content = fs.readFileSync(llmsPath, 'utf8');
        if (content.includes('## Documentation Sets')) return;

        const sets = fs
          .readdirSync(setsDir)
          .filter((f) => f.endsWith('.txt'))
          .sort();

        if (sets.length === 0) return;

        const lines = sets.map((f) => {
          const slug = f.replace(/\.txt$/, '');
          const label = humanize(slug);
          return `- [${label}](/_llms-txt/${f})`;
        });

        const appended =
          content.trimEnd() +
          '\n\n## Documentation Sets\n\n' +
          lines.join('\n') +
          '\n';

        fs.writeFileSync(llmsPath, appended);
        console.log(
          `[llms-manifest-appender] appended ${sets.length} set link(s) to llms.txt`,
        );
      },
    },
  };
}
