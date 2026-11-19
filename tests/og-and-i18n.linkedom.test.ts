import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AI_PROVIDERS, buildAiProviderHref } from '../src/config/components/ai-providers';
import { autoTranslateSidebar } from '../src/config/i18n/sidebar-labels';
import { deriveAccent, makeRender, onRequest } from '../src/og';
import { accentFromHex } from '../src/og/accent';

describe('OG, Accent, RouteData, i18n Sidebar & AI Providers (100% coverage)', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'dt-og-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  async function makePng(name: string, rgba: { r: number; g: number; b: number; alpha: number }) {
    const p = join(dir, name);
    await sharp({ create: { width: 8, height: 8, channels: 4, background: rgba } })
      .png()
      .toFile(p);
    return p;
  }

  it('covers deriveAccent across missing, empty, graydark, and chroma branches', async () => {
    const missing = await deriveAccent(join(dir, 'missing.png'), { fallbackHex: '#123456' });
    expect(missing.style).toBe('fallback');
    expect(missing.hex).toBe('#123456');

    const emptyImg = await makePng('white.png', { r: 255, g: 255, b: 255, alpha: 1 });
    expect((await deriveAccent(emptyImg)).style).toBe('empty');

    const blackImg = await makePng('black.png', { r: 2, g: 2, b: 2, alpha: 1 });
    expect((await deriveAccent(blackImg)).style).toBe('empty');

    const transpImg = await makePng('transp.png', { r: 100, g: 50, b: 20, alpha: 0 });
    expect((await deriveAccent(transpImg)).style).toBe('empty');

    const grayImg = await makePng('gray.png', { r: 90, g: 92, b: 91, alpha: 1 });
    const grayRes = await deriveAccent(grayImg);
    expect(grayRes.style).toBe('graydark');

    const redImg = await makePng('red.png', { r: 220, g: 30, b: 40, alpha: 1 });
    expect((await deriveAccent(redImg)).style).toBe('chroma');

    const greenImg = await makePng('green.png', { r: 30, g: 200, b: 50, alpha: 1 });
    expect((await deriveAccent(greenImg)).style).toBe('chroma');

    const blueImg = await makePng('blue.png', { r: 30, g: 60, b: 220, alpha: 1 });
    expect((await deriveAccent(blueImg, { style: 'graydark' })).style).toBe('graydark');
  });

  it('covers accentFromHex across all HSL hue sectors and invalid hex fallback', () => {
    for (const hex of [
      '#ff2200',
      '#aaff00',
      '#00ff44',
      '#00aaff',
      '#4400ff',
      '#ff00aa',
      '#808080',
      '#000000',
    ]) {
      const res = accentFromHex(hex);
      expect(res.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('covers makeRender title sizing, sections, 404, and routeData onRequest', async () => {
    const render = makeRender({
      logoDataUrl: 'data:image/png;base64,AA==',
      accentHex: '#2563eb',
      accentHexA12: '#2563eb1a',
      domain: '://example.com',
      projectName: 'Rsmack',
    });

    const paths = [
      '/',
      '/tutorials/intro/',
      '/guides/how/',
      '/reference/api/',
      '/explanation/arch/',
      '/404/',
      '',
    ];
    const titles = [
      'Hi',
      'Short Title',
      'Medium Length Title',
      'A Rather Long Section Title Here',
      'A Very Long Title That Spans Multiple Words Easily',
      'An Extremely Verbose Title Exceeding Fifty Five Characters In Total Length',
    ];
    for (let i = 0; i < paths.length; i++) {
      const tree = await render({
        title: titles[i % titles.length],
        description: 'Desc'.repeat((i + 1) * 18),
        pathname: paths[i],
      });
      expect(tree).toBeTruthy();
    }
    expect(await render({})).toBeTruthy();

    const head: Array<{ tag: string; attrs: Record<string, string> }> = [];
    onRequest({
      url: new URL('https://example.com/guides/test/'),
      site: new URL('https://example.com'),
      locals: { starlightRoute: { head } },
    });
    expect(head.length).toBe(1);
    expect(head[0].attrs.property).toBe('og:image');
    onRequest({ url: new URL('https://example.com/'), locals: {} });
  });

  it('covers autoTranslateSidebar and buildAiProviderHref', () => {
    expect(autoTranslateSidebar('not-array' as any)).toBe('not-array');
    const out = autoTranslateSidebar([
      'raw-string',
      {
        label: 'Guides',
        items: [
          { label: 'Reference' },
          { label: 'Custom', translations: { fr: 'Perso' } },
          { label: 'Unknown' },
        ],
      },
    ]);
    expect(out[1].translations.fr).toBe('Guides');
    expect(out[1].items[0].translations.fr).toBe('Référence');
    expect(out[1].items[1].translations.fr).toBe('Perso');

    for (const p of AI_PROVIDERS) {
      const href = buildAiProviderHref(p, 'https://example.com/intro/');
      expect(href).toContain('https://');
    }
  });
});
