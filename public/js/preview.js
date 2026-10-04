// Animated osu!standard gameplay mock-up drawn with the skin's own textures.
// env.tex(name, timeMs) -> { img, s } | null   (s = size factor: 0.5 for @2x)
// env.ini(section, key)  -> string | undefined
// env.has(name)          -> boolean, true when the skin itself contains the element

import { parseColour } from './ini.js';

const LOOP = 5200, PREEMPT = 700, FADE_IN = 300;
const OBJECTS = [
  { t: 700, x: 96, y: 110, combo: 0, n: 1 },
  { t: 1100, x: 226, y: 80, combo: 0, n: 2 },
  { t: 1500, x: 356, y: 130, combo: 0, n: 3 },
  { t: 2000, x: 420, y: 270, combo: 1, n: 1, slider: { cx: 300, cy: 190, x2: 170, y2: 300, dur: 900 } },
  { t: 3400, x: 96, y: 250, combo: 1, n: 2 },
  { t: 3800, x: 256, y: 192, combo: 2, n: 1 },
];
const DEFAULT_COMBOS = [[255, 192, 0], [0, 202, 0], [18, 124, 255], [242, 24, 57]];
const GLYPHS = { ',': 'comma', '.': 'dot', '%': 'percent', x: 'x' };

const clamp = v => Math.max(0, Math.min(1, v));
const endOf = o => o.t + (o.slider ? o.slider.dur : 0);

function sliderPos(o, u) {
  const s = o.slider, v = 1 - u;
  return [v * v * o.x + 2 * v * u * s.cx + u * u * s.x2, v * v * o.y + 2 * v * u * s.cy + u * u * s.y2];
}
const endPos = o => (o.slider ? [o.slider.x2, o.slider.y2] : [o.x, o.y]);

export class Preview {
  constructor(canvas, env) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.layer = document.createElement('canvas');
    this.env = env;
    this.cs = 4;
    this.bg = '#191530';
    this.paused = false;
    this.speed = 1;
    this.clock = 0;
    this.last = 0;
    this.running = false;
    this.mouse = null;
    this.trail = [];
    this.tints = new WeakMap();
    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      this.mouse = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    });
    canvas.addEventListener('mouseleave', () => { this.mouse = null; });
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = now => {
      if (!this.running) return;
      this.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; this.last = 0; }

  bool(key, def) {
    const v = this.env.ini('General', key);
    return v === undefined ? def : v.trim() !== '0';
  }

  tinted(img, rgb) {
    let m = this.tints.get(img);
    if (!m) this.tints.set(img, m = new Map());
    const k = rgb.join(',');
    let c = m.get(k);
    if (!c) {
      c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = `rgb(${k})`;
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(img, 0, 0);
      m.set(k, c);
    }
    return c;
  }

  spr(name, x, y, sc, o = {}) {
    const t = this.env.tex(name, this.now);
    if (!t) return false;
    const img = o.tint ? this.tinted(t.img, o.tint) : t.img;
    const w = img.width * t.s * sc, h = img.height * t.s * sc, g = this.g;
    g.save();
    g.globalAlpha = clamp(o.alpha ?? 1);
    g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    if (o.topLeft) g.drawImage(img, 0, 0, w, h);
    else g.drawImage(img, -w / 2, -h / 2, w, h);
    g.restore();
    return true;
  }

  // align: -1 left, 0 centre, 1 right; valign: -1 top, 0 middle, 1 bottom
  text(prefix, str, x, y, sc, overlap, align, valign, alpha = 1) {
    const gl = [...str].map(ch => this.env.tex(`${prefix}-${GLYPHS[ch] || ch}`, this.now)).filter(Boolean);
    if (!gl.length) return;
    const ws = gl.map(t => t.img.width * t.s * sc);
    const total = ws.reduce((a, b) => a + b, 0) - overlap * sc * (gl.length - 1);
    let cx = align === 0 ? x - total / 2 : align === 1 ? x - total : x;
    const g = this.g;
    g.save();
    g.globalAlpha = clamp(alpha);
    gl.forEach((t, i) => {
      const h = t.img.height * t.s * sc;
      g.drawImage(t.img, cx, valign === 0 ? y - h / 2 : valign === 1 ? y - h : y, ws[i], h);
      cx += ws[i] - overlap * sc;
    });
    g.restore();
  }

  cursorTarget(t) {
    let prev = OBJECTS[OBJECTS.length - 1], prevEnd = endOf(prev) - LOOP;
    for (const o of OBJECTS) {
      if (t < o.t) {
        const u = clamp((t - prevEnd) / (o.t - prevEnd)), e = u * u * (3 - 2 * u), [px, py] = endPos(prev);
        return [px + (o.x - px) * e, py + (o.y - py) * e];
      }
      if (t <= endOf(o)) return o.slider ? sliderPos(o, (t - o.t) / o.slider.dur) : [o.x, o.y];
      prev = o; prevEnd = endOf(o);
    }
    return endPos(prev);
  }

  frame(real) {
    // scene time runs on its own clock so it can be paused and sped up
    if (this.last && !this.paused) this.clock += Math.min(100, real - this.last) * this.speed;
    this.last = real;
    const now = this.clock;
    const c = this.c, dpr = window.devicePixelRatio || 1;
    const W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
    if (!W || !H) return;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = this.g;
    this.now = now;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = this.bg;
    g.fillRect(0, 0, W, H);

    const S = H / 480, ox = (W - 512 * S) / 2, oy = (H - 384 * S) / 2 + 8 * S;
    const pt = ([x, y]) => [ox + x * S, oy + y * S];
    const k = (1 - 0.7 * (this.cs - 5) / 5) / 2 * S; // scale of a 1x sprite pixel
    const t = now % LOOP;

    const combos = [];
    for (let i = 1; i <= 8; i++) {
      const col = parseColour(this.env.ini('Colours', 'Combo' + i));
      if (col) combos.push(col);
    }
    if (!combos.length) combos.push(...DEFAULT_COMBOS);
    const border = parseColour(this.env.ini('Colours', 'SliderBorder')) || [255, 255, 255];
    const track = parseColour(this.env.ini('Colours', 'SliderTrackOverride'));
    const hitPrefix = this.env.ini('Fonts', 'HitCirclePrefix') || 'default';
    const hitOverlap = Number(this.env.ini('Fonts', 'HitCircleOverlap') ?? -2) || 0;
    const overlayAbove = this.bool('HitCircleOverlayAboveNumber', true);

    const circle = (o, x, y, alpha, scale, number) => {
      const col = combos[o.combo % combos.length];
      this.spr('hitcircle', x, y, k * scale, { alpha, tint: col });
      if (!overlayAbove) this.spr('hitcircleoverlay', x, y, k * scale, { alpha });
      if (number) this.text(hitPrefix, String(o.n), x, y, k * 0.8, hitOverlap, 0, 0, alpha);
      if (overlayAbove) this.spr('hitcircleoverlay', x, y, k * scale, { alpha });
    };

    // follow points
    for (let i = 1; i < OBJECTS.length; i++) {
      const a = OBJECTS[i - 1], b = OBJECTS[i];
      if (a.combo !== b.combo) continue;
      const [x1, y1] = endPos(a), dx = b.x - x1, dy = b.y - y1, len = Math.hypot(dx, dy);
      const alpha = Math.min(clamp((t - (b.t - PREEMPT)) / 200), clamp((b.t - t) / 200 + 0.2));
      if (alpha <= 0 || t > b.t) continue;
      for (let d = 48; d < len - 32; d += 32) {
        const [px, py] = pt([x1 + dx * d / len, y1 + dy * d / len]);
        this.spr('followpoint', px, py, S, { alpha, rot: Math.atan2(dy, dx) });
      }
    }

    for (let i = OBJECTS.length - 1; i >= 0; i--) {
      const o = OBJECTS[i], appear = o.t - PREEMPT, end = endOf(o);
      if (t < appear || t > end + 900) continue;
      const [x, y] = pt([o.x, o.y]), col = combos[o.combo % combos.length];
      const alphaIn = clamp((t - appear) / FADE_IN);

      if (o.slider) {
        const bodyAlpha = t <= end ? alphaIn : 1 - (t - end) / 200;
        if (bodyAlpha > 0) {
          const L = this.layer;
          if (L.width !== W || L.height !== H) { L.width = W; L.height = H; }
          const lg = L.getContext('2d');
          lg.clearRect(0, 0, W, H);
          lg.lineCap = lg.lineJoin = 'round';
          lg.beginPath();
          for (let u = 0; u <= 1.0001; u += 0.04) lg.lineTo(...pt(sliderPos(o, u)));
          lg.lineWidth = 118 * k;
          lg.strokeStyle = `rgb(${border.join(',')})`;
          lg.stroke();
          // body: track colour at the edge, slightly lighter towards the centre
          const edge = track || col.map(v => Math.round(v * 0.55));
          for (let step = 0; step < 6; step++) {
            lg.lineWidth = 100 * k * (1 - step / 6.5);
            lg.strokeStyle = `rgb(${edge.map(v => Math.round(v + (255 - v) * 0.035 * step)).join(',')})`;
            lg.stroke();
          }
          g.globalAlpha = clamp(bodyAlpha) * 0.85;
          g.drawImage(L, 0, 0);
          g.globalAlpha = 1;
          const [ex, ey] = pt(endPos(o));
          // the slider tail is only drawn when the skin ships its own end circle
          if (this.env.has('sliderendcircle')) this.spr('sliderendcircle', ex, ey, k, { alpha: bodyAlpha, tint: col });
          if (this.env.has('sliderendcircleoverlay')) this.spr('sliderendcircleoverlay', ex, ey, k, { alpha: bodyAlpha });
        }
      }

      if (t <= o.t) {
        circle(o, x, y, alphaIn, 1, true);
        this.spr('approachcircle', x, y, k * (1 + 3 * (o.t - t) / PREEMPT), { alpha: alphaIn * 0.9, tint: col });
      } else if (t - o.t < 240) {
        const u = (t - o.t) / 240;
        circle(o, x, y, 1 - u, 1 + 0.4 * u, false);
      }

      if (o.slider && t > o.t && t <= end) {
        const [bx, by] = pt(sliderPos(o, (t - o.t) / o.slider.dur));
        this.spr('sliderb', bx, by, k, { tint: this.bool('AllowSliderBallTint', false) ? col : null });
        this.spr('sliderfollowcircle', bx, by, k, { alpha: clamp((t - o.t) / 120) });
      }

      const dt = t - end;
      if (dt > 0 && dt < 900) {
        const [hx, hy] = pt(endPos(o));
        this.spr('hit300', hx, hy, k * (0.9 + 0.1 * clamp(dt / 120)), { alpha: Math.min(dt / 100, (900 - dt) / 400) });
      }
    }

    // HUD
    this.spr('scorebar-bg', 0, 0, S, { topLeft: true });
    const hasMarker = !!this.env.tex('scorebar-marker', now);
    const fill = this.env.tex('scorebar-colour', now);
    if (fill) {
      const hp = 0.55 + 0.4 * Math.sin(now / 1500) ** 2;
      const fx = (hasMarker ? 12 : 5) * S, fy = (hasMarker ? 13 : 16) * S;
      const fw = fill.img.width * fill.s * S, fh = fill.img.height * fill.s * S;
      g.save();
      g.beginPath(); g.rect(fx, fy, fw * hp, fh); g.clip();
      g.drawImage(fill.img, fx, fy, fw, fh);
      g.restore();
    }
    const scorePrefix = this.env.ini('Fonts', 'ScorePrefix') || 'score';
    const scoreOverlap = Number(this.env.ini('Fonts', 'ScoreOverlap')) || 0;
    const comboPrefix = this.env.ini('Fonts', 'ComboPrefix') || 'score';
    const comboOverlap = Number(this.env.ini('Fonts', 'ComboOverlap')) || 0;
    const hits = OBJECTS.filter(o => endOf(o) <= t).length;
    this.text(scorePrefix, String(1234500 + hits * 300).padStart(8, '0'), W - 8 * S, 4 * S, S * 0.9, scoreOverlap, 1, -1);
    this.text(scorePrefix, '98.76%', W - 8 * S, 46 * S, S * 0.55, scoreOverlap, 1, -1);
    this.text(comboPrefix, `${120 + hits}x`, 8 * S, H - 6 * S, S * 1.1, comboOverlap, -1, 1);

    // cursor
    const target = this.mouse ? [this.mouse[0] * W, this.mouse[1] * H] : pt(this.cursorTarget(t));
    this.trail.push({ x: target[0], y: target[1], at: real });
    while (this.trail.length && real - this.trail[0].at > 180) this.trail.shift();
    for (const p of this.trail) this.spr('cursortrail', p.x, p.y, S, { alpha: (1 - (real - p.at) / 180) * 0.6 });
    const centre = this.bool('CursorCentre', true);
    this.spr('cursor', target[0], target[1], S, {
      rot: centre && this.bool('CursorRotate', true) ? now / 1600 : 0, topLeft: !centre,
    });
    this.spr('cursormiddle', target[0], target[1], S, { topLeft: !centre });
  }
}
