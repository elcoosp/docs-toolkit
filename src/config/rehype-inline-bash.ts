import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { AstroIntegration } from 'astro';

const CLI_BINARIES = new Set([
  'cargo',
  'rustc',
  'rustup',
  'flux',
  'glyip',
  'kod',
  'navi',
  'nexum',
  'quoin',
  'rsmack',
  'sourcier',
  'takumi-motion',
  'vautr-cli',
  'git',
  'gh',
  'pnpm',
  'npm',
  'npx',
  'yarn',
  'bun',
  'deno',
  'node',
  'python',
  'python3',
  'pip',
  'uv',
  'docker',
  'podman',
  'kubectl',
  'astro',
  'brew',
  'apt',
  'curl',
  'wget',
  'chmod',
  'mkdir',
  'cp',
  'mv',
  'rm',
  'cat',
  'grep',
  'rg',
  'find',
  'ls',
  'cd',
  'export',
  'env',
  'sudo',
  'ssh',
  'tar',
  'unzip',
]);

const EXPLICIT_SUFFIX_RE = /\{:(?:sh|bash|shell|zsh)\}$/;

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, any>;
  children?: HastNode[];
  value?: string;
}

function span(light: string, dark: string, value: string): HastNode {
  return {
    type: 'element',
    tagName: 'span',
    properties: {
      style: `color:light-dark(${light},${dark})`,
    },
    children: [{ type: 'text', value }],
  };
}

function isInlineShellCommand(raw: string): { text: string; forced: boolean } | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('\n') || trimmed.length > 140) return null;

  if (EXPLICIT_SUFFIX_RE.test(trimmed)) {
    return { text: trimmed.replace(EXPLICIT_SUFFIX_RE, '').trimEnd(), forced: true };
  }

  // Must have at least 2 tokens so bare words like `cargo` or `git` stay normal inline code
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return null;

  let idx = 0;
  if (parts.at(0) === '$') {
    idx = 1;
    if (parts.length <= idx) return null;
  }

  // Skip leading ENV=VALUE assignments
  while (idx < parts.length && /^[A-Z_][A-Z0-9_]*=/.test(parts.at(idx) ?? '')) {
    idx++;
  }
  const bin = parts.at(idx);
  if (!bin) return null;

  if (CLI_BINARIES.has(bin) || /^\.\/[a-zA-Z0-9_./-]+$/.test(bin) || /^~\/[a-zA-Z0-9_./-]+$/.test(bin)) {
    return { text: trimmed, forced: false };
  }

  return null;
}

function tokenizeShell(cmd: string): HastNode[] {
  const tokens = cmd.match(/(\s+|"[^"]*"|'[^']*'|[^\s"']+)/g) ?? [cmd];
  const nodes: HastNode[] = [];
  let seenCommand = false;
  let seenSubcommand = false;

  for (const tok of tokens) {
    if (/^\s+$/.test(tok)) {
      nodes.push({ type: 'text', value: tok });
      continue;
    }

    if (!seenCommand && tok === '$') {
      nodes.push(span('#6e7781', '#8b949e', tok));
      continue;
    }

    if (!seenCommand && /^[A-Z_][A-Z0-9_]*=/.test(tok)) {
      nodes.push(span('#953800', '#ffa657', tok));
      continue;
    }

    if (!seenCommand) {
      seenCommand = true;
      nodes.push(span('#8250df', '#d2a8ff', tok));
      continue;
    }

    if (
      tok === '&&' ||
      tok === '||' ||
      tok === '|' ||
      tok === ';' ||
      tok === '>' ||
      tok === '>>' ||
      tok === '<'
    ) {
      seenCommand = false;
      seenSubcommand = false;
      nodes.push(span('#cf222e', '#ff7b72', tok));
      continue;
    }

    if ((tok.startsWith('"') && tok.endsWith('"')) || (tok.startsWith("'") && tok.endsWith("'"))) {
      nodes.push(span('#0a3069', '#a5d6ff', tok));
      continue;
    }

    if (tok.startsWith('-')) {
      nodes.push(span('#0550ae', '#79c0ff', tok));
      continue;
    }

    if (!seenSubcommand && /^[a-z][a-z0-9_-]*$/.test(tok)) {
      seenSubcommand = true;
      nodes.push(span('#0550ae', '#79c0ff', tok));
      continue;
    }

    nodes.push({ type: 'text', value: tok });
  }

  return nodes;
}

export function satteriInlineBashPlugin() {
  return {
    name: 'docs-toolkit:inline-bash',
    element: {
      filter: ['code'],
      visit(
        node: HastNode,
        ctx: {
          parent: (n: HastNode) => HastNode | undefined;
          setProperty: (n: HastNode, key: string, value: unknown) => void;
          removeChildAt: (n: HastNode, index: number) => void;
          appendChild: (n: HastNode, child: HastNode | HastNode[]) => void;
        },
      ) {
        const parent = ctx.parent(node);
        if (parent?.type === 'element' && parent.tagName === 'pre') return;
        if (!Array.isArray(node.children) || node.children.length !== 1) return;
        const firstChild = node.children.at(0);
        if (firstChild?.type !== 'text') return;

        const raw = firstChild.value ?? '';
        const match = isInlineShellCommand(raw);
        if (!match) return;

        ctx.setProperty(node, 'data-inline-sh', '');
        ctx.removeChildAt(node, 0);
        ctx.appendChild(node, tokenizeShell(match.text));
      },
    },
  };
}

async function loadSatteriFactory(rootDir: string): Promise<((opts?: any) => any) | null> {
  const candidates = [rootDir, process.cwd()];
  for (const dir of candidates) {
    try {
      const hostReq = createRequire(path.join(dir, 'package.json'));
      const astroEntry = hostReq.resolve('astro');
      const astroReq = createRequire(astroEntry);
      const satteriEntry = astroReq.resolve('@astrojs/markdown-satteri');
      const mod = await import(pathToFileURL(satteriEntry).href);
      if (typeof mod.satteri === 'function') {
        return mod.satteri;
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
}

export function inlineBashIntegration(): AstroIntegration {
  return {
    name: 'docs-toolkit:inline-bash',
    hooks: {
      'astro:config:setup': async ({ config, updateConfig }) => {
        const plugin = satteriInlineBashPlugin();
        const existing = config.markdown?.processor as
          | { name?: string; options?: { hastPlugins?: unknown[] } }
          | undefined;

        if (existing?.name === 'satteri' && existing.options) {
          existing.options.hastPlugins = [...(existing.options.hastPlugins ?? []), plugin];
          return;
        }

        if (!existing) {
          const rootDir = config.root ? fileURLToPath(config.root) : process.cwd();
          const satteri = await loadSatteriFactory(rootDir);
          if (satteri) {
            updateConfig({
              markdown: {
                processor: satteri({
                  hastPlugins: [plugin],
                }),
              },
            });
          }
        }
      },
    },
  };
}

export function rehypeInlineBash() {
  return (tree: HastNode) => {
    const walk = (node: HastNode, inPre: boolean) => {
      if (!node || !Array.isArray(node.children)) return;
      const nextInPre = inPre || (node.type === 'element' && node.tagName === 'pre');

      for (const child of node.children) {
        if (
          !nextInPre &&
          child.type === 'element' &&
          child.tagName === 'code' &&
          Array.isArray(child.children) &&
          child.children.length === 1 &&
          child.children.at(0)?.type === 'text'
        ) {
          const raw = child.children.at(0)?.value ?? '';
          const match = isInlineShellCommand(raw);
          if (match) {
            child.properties = {
              ...child.properties,
              'data-inline-sh': '',
            };
            child.children = tokenizeShell(match.text);
            continue;
          }
        }
        walk(child, nextInPre);
      }
    };

    walk(tree, false);
  };
}
