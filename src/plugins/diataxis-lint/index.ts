import fs from 'node:fs';
import path from 'node:path';
import type { AstroIntegrationLogger } from 'astro';
import type { StarlightPlugin } from '@astrojs/starlight/types';

export interface DiataxisLintOptions {
  strict?: boolean;
  minDescriptionLength?: number;
  maxDescriptionLength?: number;
  minExplanationWords?: number;
}

const BSLASH = String.fromCharCode(92);
const FENCE = String.fromCharCode(96).repeat(3);
const Q = String.fromCharCode(34);
const SQ = String.fromCharCode(39);

function unquote(val: string): string {
  const t = val.trim();
  return (t.startsWith(Q) && t.endsWith(Q)) || (t.startsWith(SQ) && t.endsWith(SQ))
    ? t.slice(1, -1).trim()
    : t;
}

function runDiataxisLint(
  docsDir: string,
  locales: Set<string>,
  options: Required<DiataxisLintOptions>,
  logger: AstroIntegrationLogger,
): void {
  if (!fs.existsSync(docsDir)) return;
  let warnings = 0;
  let errors = 0;
  let audited = 0;
  const seenTitles = new Map<string, string>();

  const walk = (dir: string): void => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        walk(full);
        continue;
      }
      if (!item.name.endsWith('.md') && !item.name.endsWith('.mdx')) continue;
      const rel = path.relative(docsDir, full).split(BSLASH).join('/');
      if (rel.endsWith('404.md') || rel.endsWith('404.mdx')) continue;
      const firstSeg = rel.split('/').at(0) ?? '';
      const locale = firstSeg && locales.has(firstSeg) ? firstSeg : 'en';
      const relNoLocale =
        locale !== 'en' && rel.startsWith(locale + '/') ? rel.slice(locale.length + 1) : rel;
      if (relNoLocale === 'index.md' || relNoLocale === 'index.mdx' || relNoLocale.startsWith('blog/'))
        continue;

      const raw = fs.readFileSync(full, 'utf8');
      const m = raw.match(new RegExp('^---\\r?\\n([\\s\\S]*?)\\r?\\n---\\r?\\n([\\s\\S]*)$'));
      if (!m) {
        logger.error('Missing YAML frontmatter in ' + Q + rel + Q + '.');
        errors++;
        continue;
      }

      audited++;
      const fm = m.at(1) ?? '';
      const body = m.at(2) ?? '';
      const title = unquote(fm.match(/^title:\s*(.+)$/m)?.at(1) ?? '');
      const description = unquote(fm.match(/^description:\s*(.+)$/m)?.at(1) ?? '');

      if (!title) {
        logger.error('Missing frontmatter title in ' + Q + rel + Q + '.');
        errors++;
      } else {
        const titleKey = locale + ':' + title.toLowerCase();
        const prev = seenTitles.get(titleKey);
        if (prev) {
          logger.warn(
            'Duplicate title ' +
              Q +
              title +
              Q +
              ' [' +
              locale +
              '] in ' +
              Q +
              rel +
              Q +
              ' (already used in ' +
              Q +
              prev +
              Q +
              ').',
          );
          warnings++;
        } else {
          seenTitles.set(titleKey, rel);
        }
      }

      if (description.length < options.minDescriptionLength) {
        logger.warn('Short/missing description (' + description.length + ' chars) in ' + Q + rel + Q + '.');
        warnings++;
      } else if (description.length > options.maxDescriptionLength) {
        logger.warn(
          'Long description (' +
            description.length +
            ' > ' +
            options.maxDescriptionLength +
            ' chars) in ' +
            Q +
            rel +
            Q +
            '.',
        );
        warnings++;
      }

      let inFence = false;
      let h2Count = 0;
      let codeBlocks = 0;
      let hasTable = false;
      let hasTodo = false;
      let wordCount = 0;

      for (const line of body.split(/\r?\n/)) {
        const t = line.trim();
        if (t.startsWith(FENCE)) {
          if (!inFence) codeBlocks++;
          inFence = !inFence;
          continue;
        }
        if (inFence) continue;
        if (t.includes('<Code ') || t.includes('<Code>')) codeBlocks++;
        if (t.startsWith('## ')) h2Count++;
        if (t.startsWith('|') && t.endsWith('|')) hasTable = true;
        if (/\b(TODO|FIXME|TBD|LOREM IPSUM)\b/.test(t)) hasTodo = true;
        if (t && !t.startsWith('import ') && !t.startsWith('export ') && !t.startsWith('<')) {
          wordCount += t.split(/\s+/).length;
        }
      }

      if (hasTodo) {
        logger.warn('Unfinished placeholder (TODO/FIXME/TBD) found in ' + Q + rel + Q + '.');
        warnings++;
      }

      const quadrant = relNoLocale.split('/').at(0) ?? '';
      if (quadrant === 'tutorials') {
        if (codeBlocks === 0) {
          logger.warn('Tutorial ' + Q + rel + Q + ' has 0 runnable code blocks.');
          warnings++;
        }
        if (h2Count < 2) {
          logger.warn('Tutorial ' + Q + rel + Q + ' has fewer than 2 step sections (H2).');
          warnings++;
        }
      } else if (quadrant === 'guides') {
        if (codeBlocks === 0 && !hasTable) {
          logger.warn('How-to guide ' + Q + rel + Q + ' has no code block or configuration table.');
          warnings++;
        }
      } else if (quadrant === 'reference') {
        if (codeBlocks === 0 && !hasTable) {
          logger.warn('Reference page ' + Q + rel + Q + ' has no signature block or reference table.');
          warnings++;
        }
      } else if (quadrant === 'explanation') {
        if (wordCount < options.minExplanationWords) {
          logger.warn(
            'Explanation page ' +
              Q +
              rel +
              Q +
              ' is thin (' +
              wordCount +
              ' < ' +
              options.minExplanationWords +
              ' words).',
          );
          warnings++;
        }
      }
    }
  };
  walk(docsDir);

  logger.info(
    'Audited ' + audited + ' Diátaxis pages · ' + warnings + ' warning(s), ' + errors + ' error(s).',
  );
  if (options.strict && (errors > 0 || warnings > 0)) {
    throw new Error(
      '[starlight-diataxis-lint] Build failed with ' + errors + ' error(s) and ' + warnings + ' warning(s).',
    );
  }
}

export function starlightDiataxisLint(options: DiataxisLintOptions = {}): StarlightPlugin {
  const resolved: Required<DiataxisLintOptions> = {
    strict: options.strict ?? false,
    minDescriptionLength: options.minDescriptionLength ?? 24,
    maxDescriptionLength: options.maxDescriptionLength ?? 180,
    minExplanationWords: options.minExplanationWords ?? 200,
  };
  return {
    name: 'starlight-diataxis-lint',
    hooks: {
      'config:setup'({ addIntegration, config }) {
        const rootDir = config.root ? new URL(config.root).pathname : process.cwd();
        const docsDir = path.join(rootDir, 'src/content/docs');
        const locales = new Set<string>(['en', 'fr', ...Object.keys(config.locales ?? {})]);
        addIntegration({
          name: 'starlight-diataxis-lint',
          hooks: {
            'astro:build:done'({ logger }) {
              runDiataxisLint(docsDir, locales, resolved, logger);
            },
          },
        });
      },
    },
  };
}
