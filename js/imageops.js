// Canvas-based image operations.

export const DEFAULT_ADJ = {
  hue: 0, sat: 100, bri: 100, con: 100, opa: 100,
  tint: '#ff66aa', tintAmt: 0, scale: 100, rot: 0, flipH: false, flipV: false,
};

export function canvasBytes(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(
    b => (b ? b.arrayBuffer().then(a => resolve(new Uint8Array(a))) : reject(new Error('Could not encode image'))),
    'image/png'));
}

export function scaleCanvas(src, k) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * k));
  c.height = Math.max(1, Math.round(src.height * k));
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/** Returns a new canvas with the adjustments in `a` applied to `src`. */
export function adjustImage(src, a) {
  const k = a.scale / 100;
  const w = Math.max(1, Math.round(src.width * k)), h = Math.max(1, Math.round(src.height * k));
  const swap = a.rot % 180 !== 0;
  const c = document.createElement('canvas');
  c.width = swap ? h : w;
  c.height = swap ? w : h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.translate(c.width / 2, c.height / 2);
  g.rotate(a.rot * Math.PI / 180);
  g.scale(a.flipH ? -1 : 1, a.flipV ? -1 : 1);
  g.drawImage(src, -w / 2, -h / 2, w, h);
  if (!a.hue && a.sat === 100 && a.bri === 100 && a.con === 100 && a.opa === 100 && !a.tintAmt) return c;

  const id = g.getImageData(0, 0, c.width, c.height), d = id.data;
  const dh = a.hue / 360, ks = a.sat / 100, kb = a.bri / 100, kc = a.con / 100, ko = a.opa / 100, kt = a.tintAmt / 100;
  const tr = parseInt(a.tint.slice(1, 3), 16) / 255, tg = parseInt(a.tint.slice(3, 5), 16) / 255, tb = parseInt(a.tint.slice(5, 7), 16) / 255;
  const hsl = dh !== 0 || ks !== 1;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    let r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
    if (hsl) {
      const max = Math.max(r, gg, b), min = Math.min(r, gg, b), l = (max + min) / 2;
      let hh = 0, s = 0;
      if (max !== min) {
        const dd = max - min;
        s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
        if (max === r) hh = (gg - b) / dd + (gg < b ? 6 : 0);
        else if (max === gg) hh = (b - r) / dd + 2;
        else hh = (r - gg) / dd + 4;
        hh /= 6;
      }
      hh = (hh + dh + 1) % 1;
      s = Math.min(1, s * ks);
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      r = hue2rgb(p, q, hh + 1 / 3); gg = hue2rgb(p, q, hh); b = hue2rgb(p, q, hh - 1 / 3);
    }
    if (kt) {
      const lum = 0.299 * r + 0.587 * gg + 0.114 * b;
      r += (tr * lum - r) * kt; gg += (tg * lum - gg) * kt; b += (tb * lum - b) * kt;
    }
    r = ((r * kb) - 0.5) * kc + 0.5; gg = ((gg * kb) - 0.5) * kc + 0.5; b = ((b * kb) - 0.5) * kc + 0.5;
    d[i] = r * 255; d[i + 1] = gg * 255; d[i + 2] = b * 255; // Uint8ClampedArray clamps
    d[i + 3] *= ko;
  }
  g.putImageData(id, 0, 0);
  return c;
}

/** 16-bit mono wav containing a few milliseconds of silence. */
export function silentWav() {
  const samples = 441, dv = new DataView(new ArrayBuffer(44 + samples * 2));
  const str = (o, s) => [...s].forEach((ch, i) => dv.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF'); dv.setUint32(4, 36 + samples * 2, true); str(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 44100, true); dv.setUint32(28, 88200, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, samples * 2, true);
  return new Uint8Array(dv.buffer);
}
