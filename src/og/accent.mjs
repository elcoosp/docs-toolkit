import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (mx === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r, g, b].map(v => Math.round((v + m) * 255));
}

const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
const hslToHex = (h, s, l) => rgbToHex(...hslToRgb(h, s, l));

export async function deriveAccent(logoPath, opts = {}) {
  const { fallbackHex = '#404040', style: forceStyle } = opts;

  let logoBuf;
  try { logoBuf = await readFile(logoPath); }
  catch { return { hex: fallbackHex, hexA12: fallbackHex + '1a', style: 'fallback' }; }

  const { data } = await sharp(logoBuf).resize(64, 64, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const px = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    if (r > 240 && g > 240 && b > 240) continue;
    if (r < 15 && g < 15 && b < 15) continue;
    px.push({ r, g, b });
  }
  if (!px.length) return { hex: fallbackHex, hexA12: fallbackHex + '1a', style: 'empty' };

  const med = ['r', 'g', 'b'].map(ch => {
    const s = px.map(x => x[ch]).sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  });
  const { h, s, l } = rgbToHsl(...med);
  const chroma = px.filter(q => rgbToHsl(q.r, q.g, q.b).s > 15).length / px.length * 100;

  const style = forceStyle ?? (chroma < 20 ? 'graydark' : 'chroma');
  const lightL = style === 'graydark'
    ? clamp(Math.round(l / 5) * 5, 20, 35)
    : clamp(Math.round(l / 5) * 5, 30, 40);
  const lightH = style === 'graydark' ? 0 : h;
  const lightS = style === 'graydark' ? 0 : clamp(Math.round(s / 5) * 5, 45, 70);

  const hex = hslToHex(lightH, lightS, lightL);

  return {
    hex,
    hexA12: hex + '1a',
    style,
    chroma: Math.round(chroma),
    logoHex: rgbToHex(...med),
    hsl: {
      light: { h: lightH, s: lightS, l: lightL, low: Math.min(lightL + 60, 95), high: Math.max(lightL - 8, 2) },
      dark:  { h: lightH, s: lightS, l: 100 - lightL, low: lightL + 20, high: Math.min(100 - lightL + 10, 98) },
    },
  };
}
