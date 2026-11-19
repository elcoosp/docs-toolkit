import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { registerNativePipelinePlugin, runNativePipelineOnce } from '../src/plugins/shared/pipeline-host.js';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('doc-graph native pipeline plugin', () => {
  it('computes directed edges, PageRank scores, and orphan status in dist/graph.json', async () => {
    const root = mkdtempSync(join(tmpdir(), 'doc-graph-test-'));
    tmpDirs.push(root);

    const docsDir = join(root, 'src/content/docs');
    const distDir = join(root, 'dist');
    mkdirSync(join(docsDir, 'guides'), { recursive: true });
    mkdirSync(join(docsDir, 'reference'), { recursive: true });
    mkdirSync(distDir, { recursive: true });

    writeFileSync(
      join(docsDir, 'index.mdx'),
      '---\ntitle: Home\n---\nStart with the [Install Guide](/guides/install/).\n',
    );
    writeFileSync(
      join(docsDir, 'guides/install.mdx'),
      '---\ntitle: Install\n---\nSee [API Reference](/reference/api/) and return [Home](/).\n',
    );
    writeFileSync(
      join(docsDir, 'reference/api.mdx'),
      '---\ntitle: API\n---\nBack to [Install Guide](/guides/install/).\n',
    );
    writeFileSync(
      join(docsDir, 'reference/orphan.mdx'),
      '---\ntitle: Orphan Page\n---\nLinks to [API Reference](/reference/api/) but has no incoming links.\n',
    );

    const warnings: string[] = [];
    const errors: string[] = [];
    const logger: any = {
      info: () => {},
      warn: (msg: string) => warnings.push(msg),
      error: (msg: string) => errors.push(msg),
    };
    logger.fork = () => logger;

    registerNativePipelinePlugin(root, 'docGraph', { strict: false, warnOrphans: true }, ['en'], 'en');
    const ok = await runNativePipelineOnce(root, distDir, logger);
    expect(ok).toBe(true);

    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes('/reference/orphan/'))).toBe(true);

    const graph = JSON.parse(readFileSync(join(distDir, 'graph.json'), 'utf8'));
    expect(graph.nodes).toHaveLength(4);
    expect(graph.orphanCount).toBe(1);
    expect(graph.deadEndCount).toBe(0);

    const apiNode = graph.nodes.find((n: any) => n.route === '/reference/api/');
    const orphanNode = graph.nodes.find((n: any) => n.route === '/reference/orphan/');
    expect(apiNode.inDegree).toBe(2);
    expect(apiNode.pageRank).toBeGreaterThan(orphanNode.pageRank);
    expect(orphanNode.orphan).toBe(true);
  });
});
