// Procedural generators for missing elements. Everything is drawn at
// @2x resolution; the caller downsizes for the 1x file.

export const GEN_TYPES = ['circle', 'ring', 'dot', 'glow', 'arrow', 'star', 'rect', 'text', 'blank'];
export const FONTS = ['Arial', 'Segoe UI', 'Verdana', 'Trebuchet MS', 'Impact', 'Georgia', 'Courier New', 'Comic Sans MS'];

const base = { type: 'blank', w: 256, h: 256, color: '#ffffff', color2: '#000000', thick: 0, text: '', font: 'Arial' };
const P = o => ({ ...base, ...o });
const txt = (text, h, color = '#ffffff', thick = 0) => P({ type: 'text', text, h, color, thick });

const RANK = { xh: ['SS', '#e0e6f0'], x: ['SS', '#ffd23e'], sh: ['S', '#e0e6f0'], s: ['S', '#ffd23e'],
  a: ['A', '#7be04a'], b: ['B', '#4aa8ff'], c: ['C', '#c66bff'], d: ['D', '#ff4f5e'] };
const GLYPH = { comma: ',', dot: '.', percent: '%', x: 'x' };

const RULES = [
  [/^(hitcircle|sliderstartcircle|sliderendcircle|taikohitcircle|taikobigcircle)$/, () => P({ type: 'circle' })],
  [/^(hitcircleoverlay|sliderstartcircleoverlay|sliderendcircleoverlay|taikohitcircleoverlay|taikobigcircleoverlay|hitcircleselect)$/,
    () => P({ type: 'ring', thick: 14 })],
  [/^approachcircle$/, () => P({ type: 'ring', thick: 6 })],
  [/^spinner-approachcircle$/, () => P({ type: 'ring', w: 768, h: 768, thick: 8 })],
  [/^cursor$/, () => P({ type: 'dot', w: 128, h: 128, color: '#ffd84d' })],
  [/^cursormiddle$/, () => P({ type: 'dot', w: 24, h: 24 })],
  [/^cursortrail$/, () => P({ type: 'glow', w: 64, h: 64, color: '#ffd84d' })],
  [/^sliderb$/, () => P({ type: 'circle', thick: 10, color2: '#ffffff' })],
  [/^sliderfollowcircle$/, () => P({ type: 'ring', w: 512, h: 512, thick: 10 })],
  [/^reversearrow$/, () => P({ type: 'arrow', thick: 22 })],
  [/^(followpoint|sliderscorepoint)$/, () => P({ type: 'dot', w: 32, h: 32 })],
  [/^particle\d+$/, () => P({ type: 'dot', w: 24, h: 24 })],
  [/^lighting$/, () => P({ type: 'glow', w: 512, h: 512 })],
  [/^star2?$/, () => P({ type: 'star', w: 96, h: 96, color: '#ffd23e' })],
  [/^scorebar-bg$/, () => P({ type: 'rect', w: 1280, h: 80, color: '#20202c', thick: 16 })],
  [/^scorebar-colour$/, () => P({ type: 'rect', w: 1240, h: 28, color: '#ff66aa', thick: 12 })],
  [/^(taiko-|mania-)?hit0$/, () => txt('✕', 130, '#ff4f5e')],
  [/^(taiko-|mania-)?hit50$/, () => txt('50', 110, '#ffb347')],
  [/^(taiko-|mania-)?hit(100|200)k?$/, m => txt(m[2], 110, '#7be04a')],
  [/^(taiko-|mania-)?hit300[kg]?$/, () => txt('300', 110, '#66ccff')],
  [/^ranking-(xh|x|sh|s|a|b|c|d)(-small)?$/, m => txt(RANK[m[1]][0], m[2] ? 68 : 400, RANK[m[1]][1])],
  [/^count([123])$/, m => txt(m[1], 300)],
  [/^go$/, () => txt('GO!', 300)],
  [/^ready$/, () => txt('READY', 220)],
  [/^scoreentry-(\d|comma|dot|percent|x)$/, m => txt(GLYPH[m[1]] || m[1], 30)],
  [/^score-(\d|comma|dot|percent|x)$/, m => txt(GLYPH[m[1]] || m[1], 92)],
  [/-(\d)$/, m => txt(m[1], 104)],
  [/-(comma|dot|percent|x)$/, m => txt(GLYPH[m[1]], 92)],
];

export function presetFor(name) {
  const n = name.toLowerCase();
  for (const [re, make] of RULES) {
    const m = n.match(re);
    if (m) return make(m);
  }
  return P({});
}

export function drawGen(p) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  if (p.type === 'blank') { c.width = c.height = 1; return c; }
  if (p.type === 'text') {
    const px = Math.max(8, p.h * 0.82);
    const font = `900 ${px}px "${p.font || 'Arial'}", sans-serif`;
    const text = p.text || ' ';
    g.font = font;
    c.width = Math.max(1, Math.ceil(g.measureText(text).width + (p.thick + px * 0.08) * 2));
    c.height = Math.max(1, Math.ceil(p.h));
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    const y = c.height / 2 + px * 0.04;
    if (p.thick > 0) { g.lineWidth = p.thick * 2; g.strokeStyle = p.color2; g.strokeText(text, c.width / 2, y); }
    g.fillStyle = p.color;
    g.fillText(text, c.width / 2, y);
    return c;
  }
  c.width = Math.max(1, p.w);
  c.height = Math.max(1, p.h);
  const cx = c.width / 2, cy = c.height / 2, R = Math.max(1, Math.min(c.width, c.height) / 2 - 2);
  const disc = r => { g.beginPath(); g.arc(cx, cy, Math.max(0.5, r), 0, Math.PI * 2); };
  switch (p.type) {
    case 'circle': {
      disc(R); g.fillStyle = p.color; g.fill();
      const sh = g.createRadialGradient(cx, cy - R * 0.35, R * 0.1, cx, cy, R);
      sh.addColorStop(0, 'rgba(255,255,255,0.25)');
      sh.addColorStop(0.6, 'rgba(255,255,255,0)');
      sh.addColorStop(1, 'rgba(0,0,0,0.25)');
      g.fillStyle = sh; g.fill();
      if (p.thick > 0) { disc(R - p.thick / 2); g.lineWidth = p.thick; g.strokeStyle = p.color2; g.stroke(); }
      break;
    }
    case 'ring':
      disc(R - p.thick / 2); g.lineWidth = Math.max(1, p.thick); g.strokeStyle = p.color; g.stroke();
      break;
    case 'dot': {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.4, p.color);
      gr.addColorStop(0.62, p.color + 'cc');
      gr.addColorStop(1, p.color + '00');
      disc(R); g.fillStyle = gr; g.fill();
      break;
    }
    case 'glow': {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
      gr.addColorStop(0, p.color + 'cc');
      gr.addColorStop(1, p.color + '00');
      disc(R); g.fillStyle = gr; g.fill();
      break;
    }
    case 'arrow':
      g.lineWidth = p.thick || R * 0.18; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = p.color;
      g.beginPath();
      g.moveTo(cx - R * 0.5, cy); g.lineTo(cx + R * 0.5, cy);
      g.moveTo(cx + R * 0.1, cy - R * 0.4); g.lineTo(cx + R * 0.5, cy); g.lineTo(cx + R * 0.1, cy + R * 0.4);
      g.stroke();
      break;
    case 'star':
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * 0.45 : R - p.thick;
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.closePath(); g.fillStyle = p.color; g.fill();
      if (p.thick > 0) { g.lineWidth = p.thick; g.lineJoin = 'round'; g.strokeStyle = p.color2; g.stroke(); }
      break;
    case 'rect':
      g.beginPath(); g.roundRect(0, 0, c.width, c.height, Math.min(p.thick, cy)); g.fillStyle = p.color; g.fill();
      break;
  }
  return c;
}
