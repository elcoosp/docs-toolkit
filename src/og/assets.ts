import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROBOTO_BASE64 } from '../assets/font-b64';

export type OgAssetSource = string | Buffer | URL;

export interface OgFontSpec {
  src: OgAssetSource;
  family?: string;
  role?: 'sans' | 'mono';
}

const MIME_BY_EXT: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

function inferMime(src: OgAssetSource): string {
  if (Buffer.isBuffer(src)) return 'image/png';
  const raw = src instanceof URL ? src.pathname : src;
  const clean = raw.split(/[?#]/).at(0) ?? raw;
  const ext = path.extname(clean).toLowerCase();
  return MIME_BY_EXT[ext] ?? 'image/png';
}

export function resolveAssetBuffer(src: OgAssetSource, cwd: string = process.cwd()): Buffer {
  if (Buffer.isBuffer(src)) return src;
  if (src instanceof URL) return fs.readFileSync(fileURLToPath(src));
  if (src.startsWith('file://')) return fs.readFileSync(fileURLToPath(src));
  const localPath = path.resolve(cwd, src);
  if (fs.existsSync(localPath)) return fs.readFileSync(localPath);
  const req = createRequire(path.join(cwd, 'package.json'));
  return fs.readFileSync(req.resolve(src));
}

export function createDataUrlResolver(cwd: string = process.cwd()) {
  const cache = new Map<string, string>();
  return (src: OgAssetSource, mimeOverride?: string): string => {
    if (typeof src === 'string' && src.startsWith('data:')) return src;
    if (typeof src === 'string' && cache.has(src)) return cache.get(src)!;
    const buf = resolveAssetBuffer(src, cwd);
    const mime = mimeOverride ?? inferMime(src);
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    if (typeof src === 'string') cache.set(src, dataUrl);
    return dataUrl;
  };
}

export interface ResolvedOgFonts {
  buffers: Buffer[];
  sansFamily?: string;
  monoFamily?: string;
}

export function resolveOgFonts(
  fonts: Array<OgAssetSource | OgFontSpec> | undefined,
  cwd: string = process.cwd(),
): ResolvedOgFonts {
  if (!fonts || fonts.length === 0) {
    return { buffers: [Buffer.from(ROBOTO_BASE64, 'base64')] };
  }
  const buffers: Buffer[] = [];
  let sansFamily: string | undefined;
  let monoFamily: string | undefined;

  for (const entry of fonts) {
    const spec: OgFontSpec =
      typeof entry === 'object' && entry !== null && !Buffer.isBuffer(entry) && !(entry instanceof URL)
        ? entry
        : { src: entry };
    buffers.push(resolveAssetBuffer(spec.src, cwd));
    if (spec.family) {
      if (spec.role === 'mono') monoFamily ??= spec.family;
      else sansFamily ??= spec.family;
    }
  }

  return { buffers, sansFamily, monoFamily };
}
