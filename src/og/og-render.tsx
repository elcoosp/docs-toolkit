import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import sharp from 'sharp';
import {
  createDataUrlResolver,
  type OgAssetSource,
  type OgFontSpec,
} from './assets';

export interface OgIllustration {
  src: OgAssetSource;
  placement?: 'right-hero' | 'watermark';
  size?: number;
}

export type OgIllustrationResolver = (
  ctx: RenderProps & { section: string },
) => OgIllustration | OgAssetSource | null | undefined;

export interface OgOptions {
  fonts?: Array<OgAssetSource | OgFontSpec>;
  fontFamily?: string;
  monoFontFamily?: string;
  illustration?: OgIllustrationResolver;
  render?: (
    props: RenderProps,
    ctx: MakeRenderOptions & { defaultRender: (props: RenderProps) => Promise<React.ReactElement> },
  ) => Promise<React.ReactElement> | React.ReactElement;
}

export interface MakeRenderOptions {
  logoDataUrl: string;
  accentHex: string;
  accentHexA12: string;
  domain: string;
  projectName: string;
  cwd?: string;
  fontFamily?: string;
  monoFontFamily?: string;
  illustration?: OgIllustrationResolver;
  render?: OgOptions['render'];
}

export interface RenderProps {
  title?: string;
  description?: string | null;
  pathname?: string;
  [key: string]: unknown;
}

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function getSection(pathname: string): string {
  const p = '/' + (pathname || '').toLowerCase().replace(/^\/+/, '');
  if (p.includes('404')) return '404';
  if (p.startsWith('/tutorials/') || p.startsWith('/getting-started/')) return 'Tutorial';
  if (p.startsWith('/guides/')) return 'Guide';
  if (p.startsWith('/reference/')) return 'Reference';
  if (p.startsWith('/explanation/') || p.startsWith('/concepts/')) return 'Explanation';
  return 'Overview';
}

function computeTitleSize(title: string, description?: string | null, hasRightHero = false): number {
  const tl = title.length;
  const dl = description ? description.length : 0;
  const total = tl + dl;
  let size;
  if (tl <= 6) size = hasRightHero ? 140 : 190;
  else if (tl <= 12) size = hasRightHero ? 112 : 145;
  else if (tl <= 22) size = hasRightHero ? 88 : 108;
  else if (tl <= 35) size = hasRightHero ? 66 : 78;
  else if (tl <= 55) size = hasRightHero ? 52 : 60;
  else size = hasRightHero ? 42 : 46;
  if (total > 260) size = Math.min(size, 42);
  else if (total > 200) size = Math.min(size, 52);
  else if (total > 150) size = Math.min(size, 64);
  else if (total > 100) size = Math.min(size, hasRightHero ? 74 : 88);
  return size;
}

const PARTICLES = [
  { x: 1150, y: 42, r: 3, o: 0.55 },
  { x: 1108, y: 78, r: 2, o: 0.45 },
  { x: 1172, y: 122, r: 2, o: 0.4 },
  { x: 1068, y: 156, r: 4, o: 0.32 },
  { x: 1140, y: 194, r: 2, o: 0.5 },
  { x: 1080, y: 240, r: 3, o: 0.38 },
  { x: 1180, y: 278, r: 2, o: 0.42 },
  { x: 1008, y: 302, r: 2, o: 0.35 },
  { x: 1112, y: 346, r: 3, o: 0.3 },
  { x: 1160, y: 400, r: 2, o: 0.45 },
  { x: 940, y: 220, r: 2, o: 0.28 },
  { x: 880, y: 320, r: 2, o: 0.24 },
  { x: 820, y: 140, r: 2, o: 0.22 },
  { x: 760, y: 400, r: 3, o: 0.2 },
  { x: 700, y: 260, r: 2, o: 0.18 },
  { x: 1000, y: 480, r: 2, o: 0.22 },
  { x: 1080, y: 540, r: 3, o: 0.25 },
  { x: 200, y: 120, r: 2, o: 0.15 },
  { x: 340, y: 480, r: 2, o: 0.15 },
];

const V_LINES = Array.from({ length: 11 }, (_, i) => 108 + i * 100);
const H_LINES_TOP = Array.from({ length: 3 }, (_, i) => (i + 1) * 90);

function isOgIllustration(val: OgIllustration | OgAssetSource): val is OgIllustration {
  return typeof val === 'object' && val !== null && !Buffer.isBuffer(val) && !(val instanceof URL) && 'src' in val;
}

const svgPngCache = new Map<string, Promise<string>>();

async function resolveIllustrationDataUrl(
  src: OgAssetSource,
  cwd: string,
  toDataUrl: (s: OgAssetSource) => string,
): Promise<string> {
  if (typeof src === 'string' && src.toLowerCase().endsWith('.svg')) {
    const fullPath = path.resolve(cwd, src);
    if (fs.existsSync(fullPath)) {
      let pending = svgPngCache.get(fullPath);
      if (!pending) {
        pending = sharp(fullPath, { density: 288 })
          .png()
          .toBuffer()
          .then((buf) => `data:image/png;base64,${buf.toString('base64')}`);
        svgPngCache.set(fullPath, pending);
      }
      return pending;
    }
  }
  return toDataUrl(src);
}

export const makeRender = (opts: MakeRenderOptions) => {
  const {
    logoDataUrl,
    accentHex,
    accentHexA12,
    domain,
    projectName,
    cwd = process.cwd(),
    fontFamily,
    monoFontFamily = 'monospace',
    illustration,
    render: customRender,
  } = opts;

  const toDataUrl = createDataUrlResolver(cwd);

  const defaultRender = async (props: RenderProps) => {
    const { title = '', description = null, pathname = '' } = props;
    const section = getSection(pathname);
    const cleanPath = pathname === '/' ? '' : pathname.replaceAll(/^\/|\/$/g, '');
    const is404 = section === '404';

    const displayTitle = title
      .replace(new RegExp(`\\s*[—–-]\\s*(?:Documentation\\s+)?${projectName}(?:\\s+documentation)?$`, 'i'), '')
      .trim();

    const resolvedRaw = illustration?.({ ...props, section });
    let illDataUrl: string | undefined;
    let illPlacement: 'right-hero' | 'watermark' = 'right-hero';
    let illSize = 310;

    if (resolvedRaw) {
      const spec: OgIllustration = isOgIllustration(resolvedRaw) ? resolvedRaw : { src: resolvedRaw };
      illDataUrl = await resolveIllustrationDataUrl(spec.src, cwd, toDataUrl);
      illPlacement = spec.placement ?? 'right-hero';
      illSize = spec.size ?? (illPlacement === 'watermark' ? 440 : 310);
    }

    const hasRightHero = Boolean(illDataUrl && illPlacement === 'right-hero');
    const titleSize = computeTitleSize(displayTitle, description, hasRightHero);
    const contentMaxWidth = hasRightHero ? 650 : 1020;

    return (
      <div
        tw="flex flex-col w-full h-full bg-white relative overflow-hidden"
        style={fontFamily ? { fontFamily } : undefined}
      >
        <div tw="absolute" style={{ left: 0, top: 0, bottom: 0, width: 8, backgroundColor: accentHex }} />

        <div
          tw={`absolute top-0 right-0 w-full h-full bg-linear-to-bl from-[${accentHexA12}] via-transparent to-transparent`}
        />

        {V_LINES.map((x) => (
          <div
            key={`v${x}`}
            style={{
              position: 'absolute',
              left: x,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: 'rgba(0,0,0,0.02)',
            }}
          />
        ))}

        {H_LINES_TOP.map((y) => (
          <div
            key={`h${y}`}
            style={{
              position: 'absolute',
              top: y,
              left: 8,
              right: 0,
              height: 1,
              backgroundColor: 'rgba(0,0,0,0.025)',
            }}
          />
        ))}

        {PARTICLES.map((p, i) => (
          <div
            key={`p${i}`}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: p.r * 2,
              height: p.r * 2,
              borderRadius: '50%',
              backgroundColor: hexToRgba(accentHex, p.o),
            }}
          />
        ))}

        {illDataUrl && illPlacement === 'watermark' && (
          <img
            src={illDataUrl}
            style={{
              position: 'absolute',
              right: 48,
              bottom: 72,
              width: illSize,
              height: illSize,
              objectFit: 'contain',
              opacity: 0.16,
            }}
            alt=""
          />
        )}

        <div
          tw="flex flex-col h-full relative"
          style={{ paddingTop: 60, paddingBottom: 48, paddingRight: 72, paddingLeft: 108, zIndex: 10 }}
        >
          <div tw="flex items-center justify-between">
            <div tw="flex items-center" style={{ gap: 20, alignItems: 'center' }}>
              <img
                src={logoDataUrl}
                style={{ width: 160, height: 160, objectFit: 'contain', display: 'block' }}
                alt=""
              />
              <span
                style={{
                  fontSize: 58,
                  fontWeight: 700,
                  color: '#09090b',
                  letterSpacing: '-0.045em',
                  lineHeight: 1,
                  marginTop: 0,
                }}
              >
                {projectName}
              </span>
            </div>
            <div
              tw="flex items-center"
              style={{
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: hexToRgba(accentHex, 0.35),
                paddingLeft: 14,
                paddingRight: 18,
                paddingTop: 9,
                paddingBottom: 9,
                borderRadius: 4,
                gap: 10,
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: accentHex }} />
              <span
                style={{
                  color: accentHex,
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                }}
              >
                {section}
              </span>
            </div>
          </div>

          <div tw="flex items-end justify-between" style={{ gap: 32, flex: 1 }}>
            <div tw="flex flex-col" style={{ maxWidth: contentMaxWidth }}>
              <div style={{ width: 60, height: 5, backgroundColor: accentHex, marginBottom: 20 }} />
              <h1
                style={{
                  fontSize: titleSize,
                  fontWeight: 700,
                  lineHeight: 0.95,
                  letterSpacing: '-0.05em',
                  color: '#09090b',
                  maxWidth: contentMaxWidth,
                  margin: 0,
                }}
              >
                {displayTitle}
              </h1>
              {description && !is404 && (
                <p
                  style={{
                    fontSize: hasRightHero ? 30 : 34,
                    lineHeight: 1.35,
                    color: '#3f3f46',
                    letterSpacing: '-0.008em',
                    maxWidth: contentMaxWidth,
                    margin: 0,
                    marginTop: 20,
                  }}
                >
                  {description}
                </p>
              )}
            </div>

            {hasRightHero && illDataUrl && (
              <img
                src={illDataUrl}
                style={{
                  width: illSize,
                  height: illSize,
                  objectFit: 'contain',
                  flexShrink: 0,
                  display: 'block',
                }}
                alt=""
              />
            )}
          </div>

          <div
            tw="flex items-center justify-between"
            style={{
              marginTop: 28,
              paddingTop: 20,
              borderTopWidth: 1,
              borderTopStyle: 'solid',
              borderTopColor: 'rgba(0,0,0,0.14)',
            }}
          >
            <span style={{ fontSize: 15, letterSpacing: '0.22em', color: '#71717a', fontWeight: 700 }}>
              DOCUMENTATION
            </span>
            <span
              style={{ fontSize: 24, fontFamily: monoFontFamily, color: '#52525b', letterSpacing: '-0.01em' }}
            >
              {domain}
              {cleanPath ? '/' + cleanPath : ''}
            </span>
          </div>
        </div>
      </div>
    );
  };

  if (!customRender) return defaultRender;
  return async (props: RenderProps) => customRender(props, { ...opts, defaultRender });
};
