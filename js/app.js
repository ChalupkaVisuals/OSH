import { unzip, zip } from './zip.js';
import { decodeText, parseIni, serializeIni, iniGet, iniSet, SCHEMA, MANIA_KEYS, maniaSchema, parseColour, rgbToHex, hexToRgb } from './ini.js';
import { CATEGORIES, buildCatalog } from './catalog.js';
import { GEN_TYPES, FONTS, presetFor, drawGen } from './gen.js';
import { DEFAULT_ADJ, adjustImage, canvasBytes, scaleCanvas, silentWav } from './imageops.js';
import { decodeAudio, processAudio, encodeWav, playAudio } from './audioops.js';
import { Preview } from './preview.js';

const $ = s => document.querySelector(s);

/** Tiny DOM builder: h('div', {class:'x', onclick: fn}, ...children) */
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'value') value = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k in e) e[k] = v;
    else if (v != null && v !== false) e.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false && c !== '') e.append(c);
  if (value !== undefined) e.value = value;
  if (tag === 'input' && e.type === 'range') fillRange(e);
  return e;
}

// 24×24 stroke icons
const ICONS = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  sun: '<circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  replace: '<path d="M20 11a8 8 0 0 0-14.3-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  download: '<path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  play: '<path d="M8.5 5.5v13l10.5-6.5z" fill="currentColor"/>',
  pause: '<path d="M8.5 6v12M15.5 6v12" stroke-width="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chevL: '<path d="m14 6-6 6 6 6"/>',
  chevR: '<path d="m10 6 6 6-6 6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  pointer: '<path d="M5 3.5 18.5 11l-6 1.5-2 6z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>',
  sliders: '<path d="M3 8h9M17 8h4M3 16h4M12 16h9"/><circle cx="14.5" cy="8" r="2.5"/><circle cx="9.5" cy="16" r="2.5"/>',
  rings: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/>',
  numbers: '<text x="12" y="16" text-anchor="middle" fill="currentColor" stroke="none">123</text>',
  burst: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" fill="currentColor"/>',
  monitor: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/>',
  pausec: '<circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/>',
  list: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M8 9h8M8 12.5h8M8 16h5"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.500a3 3 0 0 1-3.5 4"/><path d="M12 13v4M8.5 20h7M10 17h4"/>',
  gear: '<circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.5"/><path d="M12 3v3.500M12 17.500V21M3 12h3.500M17.5 12H21M5.6 5.600l2.5 2.500M15.9 15.900l2.5 2.500M5.6 18.400l2.5-2.500M15.9 8.100l2.5-2.5"/>',
  drum: '<ellipse cx="12" cy="8" rx="8" ry="3.5"/><path d="M4 8v8c0 2 3.6 3.5 8 3.500s8-1.5 8-3.500V8"/>',
  fruit: '<path d="M12 8c-3-2-7 0-7 5s3.5 7.5 7 6c3.5 1.5 7-1 7-6s-4-7-7-5z"/><path d="M12 8c0-2 1-3.5 3-4"/>',
  columns: '<rect x="4" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><rect x="16" y="4" width="4" height="16" rx="1"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  volume: '<path d="M4 10v4h3l5 4V6l-5 4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.500a8 8 0 0 1 0 11"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
};

function icon(name, cls = '') {
  const s = document.createElement('span');
  s.className = `ic ${cls}`.trim();
  s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
  return s;
}

// short label, icon and accent colour of each category chip
const CAT_META = {
  all: ['All', 'grid', '#8b8ff7'],
  cursor: ['Cursor', 'pointer', '#6c70f2'],
  circles: ['Hit circles', 'target', '#f0609a'],
  sliders: ['Sliders', 'sliders', '#f59a4a'],
  spinner: ['Spinner', 'rings', '#8e7bf0'],
  numbers: ['Numbers', 'numbers', '#2fbf8f'],
  judgements: ['Hit bursts', 'burst', '#f5b82e'],
  hud: ['HUD', 'monitor', '#4aa3f0'],
  pause: ['Pause & fail', 'pausec', '#9b7bea'],
  menu: ['Menu', 'list', '#ef6a8a'],
  ranking: ['Ranking', 'trophy', '#7d86f0'],
  mods: ['Mod icons', 'gear', '#f0705a'],
  taiko: ['osu!taiko', 'drum', '#e8604c'],
  catch: ['osu!catch', 'fruit', '#4fc46a'],
  mania: ['osu!mania', 'columns', '#b06ae8'],
  'sounds-hit': ['Hitsounds', 'music', '#35c28a'],
  'sounds-ui': ['UI sounds', 'volume', '#3fb4d8'],
  other: ['Other files', 'file', '#8a86a8'],
};

const S = {
  loaded: false,
  files: new Map(),       // lower-case path -> { path, bytes }
  ini: parseIni(''),
  elements: [],
  byKey: new Map(),       // "img:hitcircle" -> element
  recEl: new WeakMap(),   // file record -> element
  tab: 'elements',
  cat: 'all',
  sel: null,
  search: '',
  missingOnly: false,
  undo: [],
  redo: [],
  adj: { ...DEFAULT_ADJ },
  aud: { gain: 100, delay: 0 },
  gen: null,
  iniSec: 'General',
  maniaKeys: 4,
};

const IMG = /\.(png|jpe?g|gif)$/i, SND = /\.(wav|ogg|mp3)$/i, TXT = /\.(ini|json|txt|cfg)$/i;
const kindOf = p => (IMG.test(p) ? 'img' : SND.test(p) ? 'snd' : TXT.test(p) ? 'txt' : 'bin');
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', wav: 'audio/wav', ogg: 'audio/ogg', mp3: 'audio/mpeg' };
const mimeOf = p => MIME[p.split('.').pop().toLowerCase()] || 'application/octet-stream';
const keyOf = p => p.toLowerCase();
const elKey = el => `${el.kind}:${el.name.toLowerCase()}`;
const stemOf = p => p.replace(/\.[^./]+$/, '');
const extOf = p => (p.match(/\.[^./]+$/) || [''])[0];
const fmtSize = n => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const fileBytes = async f => new Uint8Array(await f.arrayBuffer());
const catLabel = id => (CATEGORIES.find(c => c[0] === id) || [])[1];

const urlOf = rec => (rec.url ||= URL.createObjectURL(new Blob([rec.bytes], { type: mimeOf(rec.path) })));
function decode(rec) {
  return (rec.bmpP ||= createImageBitmap(new Blob([rec.bytes], { type: mimeOf(rec.path) })).then(b => (rec.bmp = b)));
}

// the filled part of a range track is drawn from the --p custom property
function fillRange(r) {
  const min = Number(r.min || 0), max = Number(r.max || 100);
  r.style.setProperty('--p', `${((Number(r.value) - min) / (max - min || 1)) * 100}%`);
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const downloadRec = rec => download(new Blob([rec.bytes], { type: mimeOf(rec.path) }), rec.path.split('/').pop());

function pickFiles(accept, opts = {}) {
  return new Promise(resolve => {
    const inp = h('input', { type: 'file', accept: accept || '', multiple: !!opts.multiple });
    if (opts.directory) inp.webkitdirectory = true;
    inp.addEventListener('change', () => resolve([...inp.files]));
    inp.click();
  });
}

// ───────────────────────── file store + undo / redo ─────────────────────────

function setFile(path, bytes, batch) {
  const k = keyOf(path);
  batch.push({ k, prev: S.files.get(k) });
  S.files.set(k, { path, bytes });
}

function delFile(path, batch) {
  const k = keyOf(path);
  if (!S.files.has(k)) return;
  batch.push({ k, prev: S.files.get(k) });
  S.files.delete(k);
}

function commit(batch) {
  if (batch.length) { S.undo.push(batch); S.redo = []; }
  refresh();
}

/** Restores the state recorded in a batch and returns the batch that reverts it again. */
function applyBatch(batch) {
  const inverse = [];
  for (const { k, prev } of [...batch].reverse()) {
    inverse.push({ k, prev: S.files.get(k) });
    if (prev) S.files.set(k, prev);
    else S.files.delete(k);
  }
  return inverse;
}

function undo() {
  const batch = S.undo.pop();
  if (!batch) return;
  S.redo.push(applyBatch(batch));
  refresh();
}

function redo() {
  const batch = S.redo.pop();
  if (!batch) return;
  S.undo.push(applyBatch(batch));
  refresh();
}

// ───────────────────────── element index ─────────────────────────

function reindex() {
  const catalog = buildCatalog({
    hit: iniGet(S.ini, 'Fonts', 'HitCirclePrefix'),
    score: iniGet(S.ini, 'Fonts', 'ScorePrefix'),
    combo: iniGet(S.ini, 'Fonts', 'ComboPrefix'),
  });
  S.elements = [];
  S.byKey = new Map();
  S.recEl = new WeakMap();
  const add = el => { S.elements.push(el); S.byKey.set(elKey(el), el); return el; };
  for (const c of catalog) add({ ...c, variants: [] });

  for (const rec of S.files.values()) {
    const kind = kindOf(rec.path);
    let stem = stemOf(rec.path).toLowerCase(), hd = false, frame = null, el;
    if (kind === 'img' && stem.endsWith('@2x')) { hd = true; stem = stem.slice(0, -3); }
    if (kind === 'img' || kind === 'snd') {
      el = S.byKey.get(`${kind}:${stem}`);
      if (!el) {
        const m = stem.match(/^(.*?)-?(\d+)$/);
        const animEl = m && S.byKey.get(`${kind}:${m[1]}`);
        if (animEl && animEl.anim) { el = animEl; frame = Number(m[2]); }
      }
      if (!el) el = add({ name: stem, cat: 'other', kind, anim: false, desc: '', variants: [] });
    } else {
      el = add({ name: rec.path, cat: 'other', kind, anim: false, desc: '', variants: [] });
    }
    el.variants.push({ rec, hd, frame });
    S.recEl.set(rec, el);
  }
  for (const el of S.elements) el.variants.sort((a, b) => (a.frame ?? -1) - (b.frame ?? -1) || a.hd - b.hd);
}

function refresh() {
  reindex();
  render();
}

// ───────────────────────── import / export ─────────────────────────

function loadEntries(list, fallbackName) {
  list = list
    .map(e => ({ path: e.path.replace(/\\/g, '/').replace(/^\/+/, ''), bytes: e.bytes }))
    .filter(e => e.path && !/(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|desktop\.ini$)/i.test(e.path));
  // The skin root is wherever skin.ini lives, or the single top-level folder.
  const ini = list.filter(e => /(^|\/)skin\.ini$/i.test(e.path)).sort((a, b) => a.path.length - b.path.length)[0];
  let root = '';
  if (ini) root = ini.path.slice(0, -'skin.ini'.length);
  else {
    const tops = new Set(list.map(e => (e.path.includes('/') ? e.path.split('/')[0] : '')));
    if (tops.size === 1 && !tops.has('')) root = [...tops][0] + '/';
  }
  if (root) list = list.filter(e => e.path.startsWith(root)).map(e => ({ ...e, path: e.path.slice(root.length) }));

  S.files = new Map();
  S.ini = parseIni('');
  for (const e of list) {
    if (keyOf(e.path) === 'skin.ini') S.ini = parseIni(decodeText(e.bytes));
    else S.files.set(keyOf(e.path), { path: e.path, bytes: e.bytes });
  }
  const name = iniGet(S.ini, 'General', 'Name') || fallbackName || 'New Skin';
  if (list.length) iniSet(S.ini, 'General', 'Name', `${name} (custom)`);
  else {
    iniSet(S.ini, 'General', 'Name', name);
    iniSet(S.ini, 'General', 'Version', 'latest');
  }
  Object.assign(S, { loaded: true, undo: [], redo: [], sel: null, cat: 'all', tab: 'elements', search: '', missingOnly: false });
  $('#search').value = '';
  $('#missingOnly').checked = false;
  syncTop();
  refresh();
  if (list.length) toast(`Loaded ${S.files.size} files`);
}

async function importZip(file) {
  try {
    loadEntries(await unzip(await file.arrayBuffer()), file.name.replace(/\.(osk|zip)$/i, ''));
  } catch (err) {
    toast(`Import failed: ${err.message}`);
  }
}

async function importFolder(files) {
  if (!files.length) return;
  const list = [];
  for (const f of files) list.push({ path: f.webkitRelativePath || f.name, bytes: await fileBytes(f) });
  loadEntries(list, (files[0].webkitRelativePath || '').split('/')[0]);
}

async function addLooseFiles(files) {
  const batch = [];
  for (const f of files) {
    if (keyOf(f.name) === 'skin.ini') { S.ini = parseIni(decodeText(await fileBytes(f))); syncTop(); }
    else setFile(f.name, await fileBytes(f), batch);
  }
  commit(batch);
  toast(`Added ${files.length} file${files.length === 1 ? '' : 's'}`);
}

async function exportSkin() {
  const name = (iniGet(S.ini, 'General', 'Name') || 'New Skin').trim();
  const entries = [{ path: 'skin.ini', bytes: new TextEncoder().encode(serializeIni(S.ini)) }];
  for (const r of S.files.values()) entries.push({ path: r.path, bytes: r.bytes });
  download(await zip(entries), name.replace(/[\\/:*?"<>|]/g, '_') + '.osk');
  toast('Saved. Double-click the .osk (or drag it into osu!lazer) to import it.');
}

async function confirmReplace() {
  return !S.loaded || confirm('Replace the skin that is currently open? Unsaved changes will be lost.');
}

// drag & drop of files or folders
async function collectDrop(dt) {
  const entries = [...dt.items].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  const out = [];
  const walk = async (entry, prefix) => {
    if (entry.isFile) {
      const f = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ path: prefix + f.name, file: f });
    } else {
      const reader = entry.createReader();
      for (;;) {
        const chunk = await new Promise((res, rej) => reader.readEntries(res, rej));
        if (!chunk.length) break;
        for (const e of chunk) await walk(e, prefix + entry.name + '/');
      }
    }
  };
  const plain = [...dt.files]; // read before awaiting, the list is emptied after the event
  for (const e of entries) await walk(e, '');
  return out.length ? out : plain.map(f => ({ path: f.name, file: f }));
}

async function handleDrop(dt) {
  const items = await collectDrop(dt);
  if (!items.length) return;
  if (items.length === 1 && /\.(osk|zip)$/i.test(items[0].path)) {
    if (await confirmReplace()) importZip(items[0].file);
    return;
  }
  const isSkin = items.some(i => i.path.includes('/') || keyOf(i.path) === 'skin.ini');
  if (!S.loaded || (isSkin && items.some(i => i.path.includes('/')))) {
    if (!(await confirmReplace())) return;
    const list = [];
    for (const i of items) list.push({ path: i.path, bytes: await fileBytes(i.file) });
    loadEntries(list, items[0].path.split('/')[0]);
  } else {
    addLooseFiles(items.map(i => i.file));
  }
}

// ───────────────────────── rendering ─────────────────────────

function syncTop() {
  $('#skinName').value = iniGet(S.ini, 'General', 'Name') || '';
  $('#skinAuthor').value = iniGet(S.ini, 'General', 'Author') || '';
}

function render() {
  $('#welcome').hidden = S.loaded;
  $('#work').hidden = !S.loaded;
  $('#tabs').hidden = $('#progress').hidden = !S.loaded;
  for (const id of ['#skinName', '#skinAuthor', '#btnExport']) $(id).disabled = !S.loaded;
  $('#btnUndo').disabled = !S.undo.length;
  $('#btnRedo').disabled = !S.redo.length;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === S.tab);
  for (const t of ['elements', 'ini', 'files']) $(`#view-${t}`).hidden = S.tab !== t;
  $('#chipsRow').hidden = $('#insp').hidden = S.tab !== 'elements';
  if (S.loaded) preview.start();
  else preview.stop();
  if (!S.loaded) return;
  renderProgress();
  if (S.tab === 'elements') { renderChips(); renderGrid(); renderInspector(); }
  if (S.tab === 'ini') renderIni();
  if (S.tab === 'files') renderFiles();
}

function renderProgress() {
  const known = S.elements.filter(e => e.cat !== 'other');
  const have = known.filter(e => e.variants.length).length;
  const p = $('#progress');
  p.querySelector('.bar').style.width = `calc(${(have / (known.length || 1)) * 100}% - 8px)`;
  p.querySelector('span').textContent = `${have} / ${known.length} elements`;
  p.title = `${have} of ${known.length} skinnable elements present, ${S.files.size} files in total`;
}

function renderChips() {
  const chip = (id, els) => {
    const [label, ic, color] = CAT_META[id];
    const have = els.filter(e => e.variants.length).length;
    return h('button', { class: 'chip' + (S.cat === id ? ' on' : ''), style: `--c:${color}`, title: catLabel(id) || 'All elements',
      onclick: () => { S.cat = id; renderChips(); renderGrid(); } },
      icon(ic), h('span', {}, h('b', {}, label), h('small', {}, `${have}/${els.length}`)),
      have === els.length && id !== 'other' && icon('check', 'done'));
  };
  const chips = [chip('all', S.elements)];
  for (const [id] of CATEGORIES) {
    const els = S.elements.filter(e => e.cat === id);
    if (els.length) chips.push(chip(id, els));
  }
  const box = $('#chips'), x = box.scrollLeft;
  box.replaceChildren(...chips);
  box.scrollLeft = x;
}

const audio = new Audio();
function play(rec) { audio.src = urlOf(rec); audio.play().catch(() => {}); }

let cards = new Map();
function renderGrid() {
  const q = S.search.trim().toLowerCase();
  const list = S.elements.filter(e =>
    (S.cat === 'all' || e.cat === S.cat) && (!q || e.name.toLowerCase().includes(q)) && (!S.missingOnly || !e.variants.length));
  cards = new Map();
  const nodes = list.map(el => {
    const k = elKey(el), v = el.variants[0];
    let thumb;
    if (!v) thumb = h('div', { class: 'plus' }, icon('plus'));
    else if (el.kind === 'img') thumb = h('img', { loading: 'lazy', src: urlOf(v.rec), alt: '' });
    else if (el.kind === 'snd') thumb = h('button', { class: 'thumbbtn', title: 'Play', onclick: e => { e.stopPropagation(); play(v.rec); } }, icon('play'));
    else thumb = icon('file', 'thumbic');
    const frames = el.variants.filter(x => x.frame != null && !x.hd).length || el.variants.filter(x => x.frame != null).length;
    const card = h('div', { class: 'el' + (v ? '' : ' missing') + (S.sel === k ? ' sel' : ''), title: el.desc || el.name, onclick: () => select(k) },
      h('div', { class: 'thumb checker' }, thumb),
      h('div', { class: 'nm' }, el.name),
      h('div', { class: 'badges' },
        !v && h('span', { class: 'badge miss' }, 'missing'),
        el.variants.some(x => x.hd) && h('span', { class: 'badge hd' }, '@2x'),
        frames > 0 && h('span', { class: 'badge anim' }, `${frames} frames`),
        v && el.kind === 'snd' && h('span', { class: 'badge' }, extOf(v.rec.path).slice(1))));
    cards.set(k, card);
    return card;
  });
  $('#grid').replaceChildren(...(nodes.length ? nodes : [h('div', { class: 'empty' }, 'Nothing matches. Try another category or clear the search.')]));
}

function select(k) {
  cards.get(S.sel)?.classList.remove('sel');
  S.sel = k;
  S.adj = { ...DEFAULT_ADJ };
  S.aud = { gain: 100, delay: 0 };
  S.gen = null;
  cards.get(k)?.classList.add('sel');
  renderInspector();
}

// ───────────────────────── inspector ─────────────────────────

function renderInspector() {
  const box = $('#insp'), el = S.byKey.get(S.sel);
  if (!el) {
    box.replaceChildren(h('div', { class: 'inspEmpty' }, h('h2', {}, 'Pick an element'),
      'Select a card to edit it. Dashed cards are elements this skin does not have yet: click one to upload or generate it. You can also drop image and sound files anywhere to add them.'));
    return;
  }
  const parts = [
    h('h2', {}, el.name),
    el.desc && h('div', { class: 'desc' }, el.desc),
    h('div', { class: 'badges' },
      h('span', { class: 'badge' }, catLabel(el.cat) || el.cat),
      el.anim && h('span', { class: 'badge anim' }, 'animatable'),
      !el.variants.length && h('span', { class: 'badge miss' }, 'missing')),
  ];
  if (el.kind === 'img') parts.push(imageInspector(el));
  else if (el.kind === 'snd') parts.push(soundInspector(el));
  else parts.push(fileInspector(el));
  box.replaceChildren(...parts.flat(Infinity).filter(Boolean));
  if (el.kind === 'img' && el.variants.length) drawAdjPreview(el);
}

async function toPng(bytes, type) {
  const bmp = await createImageBitmap(new Blob([bytes], { type }));
  return canvasBytes(scaleCanvas(bmp, 1));
}

async function replaceVariant(v) {
  const kind = kindOf(v.rec.path);
  const [f] = await pickFiles(kind === 'img' ? 'image/*' : kind === 'snd' ? '.wav,.ogg,.mp3' : '');
  if (!f) return;
  const batch = [];
  let bytes = await fileBytes(f), path = v.rec.path;
  if (kind === 'img' && /\.png$/i.test(path) && f.type !== 'image/png') bytes = await toPng(bytes, f.type);
  else if (extOf(f.name) && extOf(f.name).toLowerCase() !== extOf(path).toLowerCase()) {
    delFile(path, batch);
    path = stemOf(path) + extOf(f.name).toLowerCase();
  }
  setFile(path, bytes, batch);
  commit(batch);
}

async function addToElement(el, hd) {
  const files = await pickFiles(el.kind === 'img' ? 'image/*' : '.wav,.ogg,.mp3', { multiple: el.anim });
  if (!files.length) return;
  const batch = [], nm = el.name.toLowerCase();
  for (const [i, f] of files.entries()) {
    const st = stemOf(f.name).toLowerCase().replace(/@2x$/, ''), m = st.match(/^(.*?)-?(\d+)$/);
    let bytes = await fileBytes(f), path;
    if (st === nm || (el.anim && m && m[1] === nm)) path = f.name; // already named for this element
    else if (el.kind === 'snd') {
      for (const v of el.variants) delFile(v.rec.path, batch);
      path = el.name + extOf(f.name).toLowerCase();
    } else {
      if (files.length === 1) for (const v of el.variants) if (v.hd === hd) delFile(v.rec.path, batch);
      const frame = files.length > 1 ? (nm === 'sliderb' ? i : `-${i}`) : '';
      path = `${el.name}${frame}${hd ? '@2x' : ''}.png`;
      if (f.type !== 'image/png') bytes = await toPng(bytes, f.type);
    }
    setFile(path, bytes, batch);
  }
  commit(batch);
}

function removeElement(el) {
  const batch = [];
  for (const v of el.variants) delFile(v.rec.path, batch);
  commit(batch);
}

function variantRow(v) {
  const kind = kindOf(v.rec.path), dims = h('span', {}, fmtSize(v.rec.bytes.length));
  const mini = kind === 'img'
    ? h('div', { class: 'mini checker' }, h('img', { src: urlOf(v.rec), alt: '', onload: e => { dims.textContent = `${e.target.naturalWidth}×${e.target.naturalHeight} · ${fmtSize(v.rec.bytes.length)}`; } }))
    : kind === 'snd' ? h('button', { class: 'icon', title: 'Play', onclick: () => play(v.rec) }, icon('play')) : null;
  return h('div', { class: 'vrow' }, mini,
    h('div', { class: 'vinfo' }, h('div', { title: v.rec.path }, v.rec.path), dims),
    h('button', { class: 'icon', title: 'Replace with a file', onclick: () => replaceVariant(v) }, icon('replace')),
    h('button', { class: 'icon', title: 'Download', onclick: () => downloadRec(v.rec) }, icon('download')),
    h('button', { class: 'icon del', title: 'Delete', onclick: () => { const b = []; delFile(v.rec.path, b); commit(b); } }, icon('trash')));
}

// Creates the @2x file for every 1x-only variant and the other way round.
async function fillPairs(el) {
  const batch = [];
  for (const v of el.variants) {
    const stem = stemOf(v.rec.path);
    const other = v.hd ? stem.slice(0, -3) + '.png' : stem + '@2x.png';
    if (el.variants.some(o => stemOf(o.rec.path).toLowerCase() === stemOf(other).toLowerCase())) continue;
    setFile(other, await canvasBytes(scaleCanvas(await decode(v.rec), v.hd ? 0.5 : 2)), batch);
  }
  commit(batch);
  toast(batch.length ? `Created ${batch.length} file(s)` : 'Every variant already has its pair');
}

let adjToken = 0;
async function drawAdjPreview(el) {
  const token = ++adjToken, v = el.variants.find(x => x.hd) || el.variants[0];
  const bmp = await decode(v.rec).catch(() => null);
  const cv = $('#adjCanvas');
  if (token !== adjToken || !bmp || !cv) return;
  const out = adjustImage(bmp, S.adj);
  cv.width = out.width; cv.height = out.height;
  cv.getContext('2d').drawImage(out, 0, 0);
}

async function applyAdjust(els) {
  const batch = [];
  for (const el of els) {
    for (const v of el.variants) {
      try {
        const out = adjustImage(await decode(v.rec), S.adj);
        const path = stemOf(v.rec.path) + '.png';
        if (keyOf(path) !== keyOf(v.rec.path)) delFile(v.rec.path, batch);
        setFile(path, await canvasBytes(out), batch);
      } catch { /* undecodable image, leave untouched */ }
    }
  }
  S.adj = { ...DEFAULT_ADJ };
  commit(batch);
  toast(`Updated ${batch.length} file(s)`);
}

function imageInspector(el) {
  const has = el.variants.length > 0, A = S.adj;
  const slider = (label, key, min, max, unit = '') => {
    const val = h('span', { class: 'val' }, A[key] + unit);
    return h('label', { class: 'sl' }, h('span', {}, label),
      h('input', { type: 'range', min, max, value: A[key], oninput: e => { A[key] = Number(e.target.value); val.textContent = A[key] + unit; drawAdjPreview(el); } }), val);
  };
  const toggle = (label, key) => h('label', {}, h('input', { type: 'checkbox', checked: A[key], onchange: e => { A[key] = e.target.checked; drawAdjPreview(el); } }), label);
  const inCat = S.elements.filter(e => e.cat === el.cat && e.kind === 'img' && e.variants.length);

  return [
    has && el.variants.map(variantRow),
    h('div', { class: 'row' },
      h('button', { class: 'sm', onclick: () => addToElement(el, true) }, has ? 'Upload @2x…' : 'Upload image (@2x)…'),
      h('button', { class: 'sm', onclick: () => addToElement(el, false) }, has ? 'Upload 1x…' : 'Upload image (1x)…'),
      has && h('button', { class: 'sm', title: 'Create the missing 1x or @2x version of each file', onclick: () => fillPairs(el) }, 'Fill 1x / @2x'),
      has && h('button', { class: 'sm danger', onclick: () => removeElement(el) }, 'Remove')),
    has && [
      h('div', { class: 'stage checker' }, h('canvas', { id: 'adjCanvas' })),
      slider('Hue', 'hue', -180, 180, '°'), slider('Saturation', 'sat', 0, 300, '%'),
      slider('Brightness', 'bri', 0, 300, '%'), slider('Contrast', 'con', 0, 300, '%'),
      slider('Opacity', 'opa', 0, 100, '%'), slider('Size', 'scale', 10, 400, '%'),
      h('label', { class: 'sl' }, h('span', {}, 'Colorize'),
        h('input', { type: 'range', min: 0, max: 100, value: A.tintAmt, oninput: e => { A.tintAmt = Number(e.target.value); drawAdjPreview(el); } }),
        h('input', { type: 'color', value: A.tint, oninput: e => { A.tint = e.target.value; drawAdjPreview(el); } })),
      h('label', { class: 'sl' }, h('span', {}, 'Rotate'),
        h('select', { value: String(A.rot), onchange: e => { A.rot = Number(e.target.value); drawAdjPreview(el); } },
          [0, 90, 180, 270].map(d => h('option', { value: String(d) }, `${d}°`))), h('span')),
      h('div', { class: 'checks' }, toggle('Flip horizontal', 'flipH'), toggle('Flip vertical', 'flipV')),
      h('div', { class: 'actions' },
        h('button', { class: 'primary', onclick: () => applyAdjust([el]) }, 'Apply'),
        h('button', { onclick: () => { S.adj = { ...DEFAULT_ADJ }; renderInspector(); } }, 'Reset'),
        h('button', { title: 'Apply these adjustments to every image in this category',
          onclick: () => confirm(`Apply to all ${inCat.length} elements in "${catLabel(el.cat)}"?`) && applyAdjust(inCat) }, `Apply to category (${inCat.length})`)),
    ],
    generatorBlock(el),
  ];
}

function generatorBlock(el) {
  const G = (S.gen ||= presetFor(el.name));
  const cv = h('canvas');
  const redraw = () => { const o = drawGen(G); cv.width = o.width; cv.height = o.height; cv.getContext('2d').drawImage(o, 0, 0); };
  const field = (label, key, type, extra = {}) => h('label', { class: 'fld' }, h('span', {}, label),
    h('input', { type, ...extra, value: G[key], oninput: e => { G[key] = type === 'number' ? Number(e.target.value) || 0 : e.target.value; redraw(); } }));
  const pick = (label, key, options) => h('label', { class: 'fld' }, h('span', {}, label),
    h('select', { value: G[key], onchange: e => { G[key] = e.target.value; redraw(); } }, options.map(o => h('option', { value: o }, o))));
  redraw();
  const save = async () => {
    const batch = [];
    for (const v of el.variants) delFile(v.rec.path, batch);
    const out = drawGen(G);
    if (G.type === 'blank') setFile(`${el.name}.png`, await canvasBytes(out), batch);
    else {
      setFile(`${el.name}@2x.png`, await canvasBytes(out), batch);
      setFile(`${el.name}.png`, await canvasBytes(scaleCanvas(out, 0.5)), batch);
    }
    commit(batch);
  };
  return h('details', { open: !el.variants.length },
    h('summary', {}, el.variants.length ? 'Generate a replacement' : 'Generate this element'),
    pick('Shape', 'type', GEN_TYPES),
    h('label', { class: 'fld' }, h('span', {}, 'Colours'), h('span', { class: 'row', style: 'margin:0' },
      h('input', { type: 'color', value: G.color, title: 'Fill', oninput: e => { G.color = e.target.value; redraw(); } }),
      h('input', { type: 'color', value: G.color2, title: 'Outline', oninput: e => { G.color2 = e.target.value; redraw(); } }))),
    field('Width @2x', 'w', 'number', { min: 1, max: 4096 }),
    field('Height @2x', 'h', 'number', { min: 1, max: 4096 }),
    field('Thickness', 'thick', 'number', { min: 0, max: 200 }),
    field('Text', 'text', 'text'),
    pick('Font', 'font', FONTS),
    h('div', { class: 'stage checker' }, cv),
    h('div', { class: 'hint' }, 'Sizes are for the @2x file; a 1x copy is created too. "blank" writes a 1×1 transparent image, which hides the element in game.'),
    h('div', { class: 'row' }, h('button', { class: 'primary', onclick: save }, 'Generate & save')));
}

const audParams = () => ({ gain: S.aud.gain / 100, delayMs: S.aud.delay });

async function previewSound(el) {
  try {
    playAudio(processAudio(await decodeAudio(el.variants[0].rec.bytes), audParams()));
  } catch {
    toast('This sound could not be decoded');
  }
}

async function applySound(els) {
  const batch = [];
  let failed = 0;
  for (const el of els) {
    for (const v of el.variants) {
      try {
        const out = encodeWav(processAudio(await decodeAudio(v.rec.bytes), audParams()));
        const path = stemOf(v.rec.path) + '.wav';
        if (keyOf(path) !== keyOf(v.rec.path)) delFile(v.rec.path, batch);
        setFile(path, out, batch);
      } catch { failed++; }
    }
  }
  S.aud = { gain: 100, delay: 0 };
  commit(batch);
  toast(`Updated ${els.length - failed} sound(s)` + (failed ? `, ${failed} could not be decoded` : ''));
}

function soundInspector(el) {
  const has = el.variants.length > 0, A = S.aud;
  const slider = (label, key, min, max, step, fmt) => {
    const val = h('span', { class: 'val' }, fmt(A[key]));
    return h('label', { class: 'sl' }, h('span', {}, label),
      h('input', { type: 'range', min, max, step, value: A[key], oninput: e => { A[key] = Number(e.target.value); val.textContent = fmt(A[key]); } }), val);
  };
  const inCat = S.elements.filter(e => e.cat === el.cat && e.kind === 'snd' && e.variants.length);
  const silence = () => {
    const batch = [];
    for (const v of el.variants) delFile(v.rec.path, batch);
    setFile(`${el.name}.wav`, silentWav(), batch);
    commit(batch);
  };
  return [
    el.variants.map(v => [variantRow(v), h('div', { class: 'vrow' }, h('audio', { controls: true, src: urlOf(v.rec) }))]),
    h('div', { class: 'actions' },
      h('button', { class: 'primary', onclick: () => addToElement(el, false) }, el.variants.length ? 'Replace sound…' : 'Upload sound…'),
      h('button', { title: 'Write a silent wav so this sound is muted in game', onclick: silence }, 'Make silent'),
      h('button', { class: 'danger', disabled: !has, onclick: () => removeElement(el) }, 'Remove')),
    has && [
      h('h3', {}, 'Edit sound'),
      slider('Volume', 'gain', 0, 400, 5, v => `${v}%`),
      slider('Delay', 'delay', -300, 300, 5, v => `${v > 0 ? '+' : ''}${v} ms`),
      h('div', { class: 'hint' }, 'Positive delay adds silence so the sound plays later; negative delay trims the start so it plays earlier. Edited sounds are saved as wav.'),
      h('div', { class: 'actions' },
        h('button', { class: 'primary', onclick: () => applySound([el]) }, 'Apply'),
        h('button', { onclick: () => previewSound(el) }, icon('play'), 'Preview'),
        h('button', { title: 'Apply this volume and delay to every sound in this category',
          onclick: () => confirm(`Apply to all ${inCat.length} sounds in "${catLabel(el.cat)}"?`) && applySound(inCat) }, `Apply to category (${inCat.length})`)),
    ],
  ];
}

function fileInspector(el) {
  const v = el.variants[0];
  if (!v) return [];
  if (el.kind !== 'txt') return [variantRow(v)];
  const ta = h('textarea', { spellcheck: false, value: decodeText(v.rec.bytes) });
  const save = () => {
    if (/\.json$/i.test(v.rec.path)) {
      try { JSON.parse(ta.value); } catch (err) {
        if (!confirm(`This is not valid JSON (${err.message}). Save anyway?`)) return;
      }
    }
    const batch = [];
    setFile(v.rec.path, new TextEncoder().encode(ta.value), batch);
    commit(batch);
    toast('Saved');
  };
  return [variantRow(v), h('h3', {}, 'Contents'), ta, h('div', { class: 'row' }, h('button', { class: 'primary', onclick: save }, 'Save text'))];
}

// ───────────────────────── skin.ini tab ─────────────────────────

function iniChanged() {
  syncTop();
  reindex(); // font prefixes change which elements exist
  renderProgress();
}

function iniRow(section, [key, type, def, desc, options], maniaKeys) {
  const cur = iniGet(S.ini, section, key, maniaKeys) ?? '';
  const row = h('div', { class: 'irow' + (cur !== '' ? ' set' : '') });
  const set = v => { iniSet(S.ini, section, key, v.trim(), maniaKeys); row.classList.toggle('set', v.trim() !== ''); iniChanged(); };
  let ctl;
  if (type === 'bool') {
    const dflt = def === '' ? 'default' : `default: ${def === '1' ? 'on' : 'off'}`;
    ctl = h('select', { value: cur === '' ? '' : cur.trim() === '0' ? '0' : '1', onchange: e => set(e.target.value) },
      h('option', { value: '' }, `(${dflt})`), h('option', { value: '1' }, 'On'), h('option', { value: '0' }, 'Off'));
  } else if (type === 'select') {
    const opts = options.includes(cur) || cur === '' ? options : [cur, ...options];
    ctl = h('select', { value: cur, onchange: e => set(e.target.value) },
      h('option', { value: '' }, `(default: ${def})`), opts.map(o => h('option', { value: o }, o)));
  } else if (type === 'color') {
    const text = h('input', { type: 'text', value: cur, placeholder: def || 'not set', oninput: () => { set(text.value); sync(); } });
    const pick = h('input', { type: 'color', oninput: () => {
      const alpha = text.value.split(',')[3];
      text.value = hexToRgb(pick.value).join(',') + (alpha !== undefined ? ',' + alpha.trim() : '');
      set(text.value);
    } });
    const sync = () => { pick.value = rgbToHex(parseColour(text.value) || parseColour(def) || [255, 255, 255]); };
    sync();
    ctl = [pick, text, h('button', { class: 'icon del', title: 'Use the default', onclick: () => { text.value = ''; set(''); sync(); } }, icon('trash'))];
  } else {
    ctl = h('input', { type: 'text', inputMode: type === 'num' ? 'decimal' : 'text', value: cur, placeholder: def || 'not set', oninput: e => set(e.target.value) });
  }
  row.append(h('div', { class: 'k', title: key }, key), h('div', { class: 'ctl' }, ctl), h('div', { class: 'desc' }, desc || ''));
  return row;
}

function renderIni() {
  const sections = [...Object.keys(SCHEMA), 'Mania', 'Raw text'];
  const nav = h('div', { class: 'pagehead' }, h('h2', {}, 'skin.ini'), h('div', { class: 'seg wrap' }, sections.map(s =>
    h('button', { class: s === S.iniSec ? 'on' : '', onclick: () => { S.iniSec = s; renderIni(); } }, s === 'Raw text' ? s : `[${s}]`))));
  let body;
  if (S.iniSec === 'Raw text') {
    const ta = h('textarea', { class: 'raw', spellcheck: false, value: serializeIni(S.ini), oninput: () => { S.ini = parseIni(ta.value); iniChanged(); } });
    body = [h('div', { class: 'hint' }, 'Edit skin.ini directly. Keys this editor does not know about are kept as they are.'), ta];
  } else if (S.iniSec === 'Mania') {
    const has = k => S.ini.sections.some(s => s.name.toLowerCase() === 'mania' && s.lines.some(l => l.key && l.key.toLowerCase() === 'keys' && Number(l.value) === k));
    body = [
      h('div', { class: 'pagehead' }, h('span', { class: 'hint' }, 'Key count'), h('div', { class: 'seg wrap' }, MANIA_KEYS.map(k =>
        h('button', { class: k === S.maniaKeys ? 'on' : '', onclick: () => { S.maniaKeys = k; renderIni(); } }, `${k}K${has(k) ? ' •' : ''}`)))),
      h('div', {}, maniaSchema(S.maniaKeys).map(f => iniRow('Mania', f, S.maniaKeys))),
    ];
  } else {
    body = [
      h('div', { class: 'hint' }, 'Empty fields are left out of the file, so the game default applies. Changes show in the live preview right away.'),
      h('div', {}, SCHEMA[S.iniSec].map(f => iniRow(S.iniSec, f))),
    ];
  }
  $('#view-ini').replaceChildren(nav, ...body);
}

// ───────────────────────── files tab ─────────────────────────

function renderFiles() {
  const recs = [...S.files.values()].sort((a, b) => a.path.localeCompare(b.path));
  const rename = rec => {
    const to = prompt('New file name', rec.path);
    if (!to || !to.trim() || to === rec.path) return;
    const batch = [];
    delFile(rec.path, batch);
    setFile(to.trim(), rec.bytes, batch);
    commit(batch);
  };
  const show = rec => {
    const el = S.recEl.get(rec);
    S.tab = 'elements'; S.cat = el.cat; S.search = ''; S.missingOnly = false;
    $('#search').value = ''; $('#missingOnly').checked = false;
    S.sel = elKey(el); S.adj = { ...DEFAULT_ADJ }; S.gen = null;
    render();
    cards.get(S.sel)?.scrollIntoView({ block: 'center' });
  };
  const total = recs.reduce((a, r) => a + r.bytes.length, 0);
  $('#view-files').replaceChildren(
    h('div', { class: 'pagehead' }, h('h2', {}, 'All files'),
      h('button', { class: 'primary', onclick: async () => { const f = await pickFiles('', { multiple: true }); if (f.length) addLooseFiles(f); } }, icon('plus'), 'Add files'),
      h('span', { class: 'hint' }, `${recs.length} files, ${fmtSize(total)}. skin.ini is written from the skin.ini tab when you save.`)),
    h('table', { class: 'files' },
      h('thead', {}, h('tr', {}, h('th', {}, 'File'), h('th', {}, 'Type'), h('th', {}, 'Size'), h('th', {}))),
      h('tbody', {}, recs.map(rec => h('tr', {},
        h('td', {}, rec.path), h('td', {}, { img: 'image', snd: 'sound', txt: 'text', bin: 'other' }[kindOf(rec.path)]), h('td', {}, fmtSize(rec.bytes.length)),
        h('td', { class: 'act' },
          h('button', { class: 'sm', onclick: () => show(rec) }, 'Edit'),
          h('button', { class: 'sm', onclick: () => rename(rec) }, 'Rename'),
          h('button', { class: 'icon', title: 'Download', onclick: () => downloadRec(rec) }, icon('download')),
          h('button', { class: 'icon del', title: 'Delete', onclick: () => { const b = []; delFile(rec.path, b); commit(b); } }, icon('trash'))))))));
}

// ───────────────────────── preview ─────────────────────────

const fallbackTex = new Map();
const preview = new Preview($('#pv'), {
  ini: (section, key) => iniGet(S.ini, section, key),
  has: name => !!S.byKey.get(`img:${name.toLowerCase()}`)?.variants.length,
  tex(name, now) {
    const el = S.byKey.get(`img:${name.toLowerCase()}`);
    if (el && el.variants.length) {
      const hd = el.variants.some(v => v.hd);
      const list = el.variants.filter(v => v.hd === hd), frames = list.filter(v => v.frame != null);
      let v = list[0];
      if (frames.length) {
        const fps = Number(iniGet(S.ini, 'General', 'AnimationFramerate'));
        v = frames[Math.floor(now / 1000 * (fps > 0 ? fps : Math.max(frames.length, 1))) % frames.length];
      }
      if (!v.rec.bmp) { decode(v.rec).catch(() => {}); return null; }
      return { img: v.rec.bmp, s: hd ? 0.5 : 1 };
    }
    if (!fallbackTex.has(name)) {
      const p = presetFor(name);
      fallbackTex.set(name, p.type === 'blank' ? null : { img: drawGen(p), s: 0.5 });
    }
    return fallbackTex.get(name);
  },
});

// ───────────────────────── wiring ─────────────────────────

for (const n of document.querySelectorAll('[data-icon]')) n.replaceChildren(icon(n.dataset.icon));

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('osh-theme', theme); } catch { /* storage unavailable */ }
  for (const b of document.querySelectorAll('#theme button')) b.classList.toggle('on', b.dataset.theme === theme);
}
for (const b of document.querySelectorAll('#theme button')) b.addEventListener('click', () => setTheme(b.dataset.theme));
setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

const doImport = async () => { const [f] = await pickFiles('.osk,.zip'); if (f && await confirmReplace()) importZip(f); };
const doFolder = async () => { const f = await pickFiles('', { directory: true }); if (f.length && await confirmReplace()) importFolder(f); };
const doNew = async () => { if (await confirmReplace()) loadEntries([], 'New Skin'); };
for (const id of ['#btnImport', '#wImport']) $(id).addEventListener('click', doImport);
for (const id of ['#btnFolder', '#wFolder']) $(id).addEventListener('click', doFolder);
for (const id of ['#btnNew', '#wNew']) $(id).addEventListener('click', doNew);
$('#btnOpen').addEventListener('click', e => { e.stopPropagation(); $('#openMenu').hidden = !$('#openMenu').hidden; });
addEventListener('click', () => { $('#openMenu').hidden = true; });

$('#btnUndo').addEventListener('click', undo);
$('#btnRedo').addEventListener('click', redo);
$('#btnExport').addEventListener('click', exportSkin);
$('#skinName').addEventListener('input', e => iniSet(S.ini, 'General', 'Name', e.target.value));
$('#skinAuthor').addEventListener('input', e => iniSet(S.ini, 'General', 'Author', e.target.value));
$('#search').addEventListener('input', e => { S.search = e.target.value; renderGrid(); });
$('#missingOnly').addEventListener('change', e => { S.missingOnly = e.target.checked; renderGrid(); });
$('#chipL').addEventListener('click', () => $('#chips').scrollBy({ left: -420 }));
$('#chipR').addEventListener('click', () => $('#chips').scrollBy({ left: 420 }));
for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => { S.tab = b.dataset.tab; render(); });

$('#pvCs').addEventListener('input', e => { preview.cs = Number(e.target.value); });
$('#pvBg').addEventListener('input', e => { preview.bg = e.target.value; });
$('#pvPlay').addEventListener('click', () => {
  preview.paused = !preview.paused;
  $('#pvPlay').replaceChildren(icon(preview.paused ? 'play' : 'pause'));
});
const SPEEDS = [0.25, 0.5, 1, 1.5, 2];
$('#pvSpeed').addEventListener('click', () => {
  preview.speed = SPEEDS[(SPEEDS.indexOf(preview.speed) + 1) % SPEEDS.length];
  $('#pvSpeed').textContent = `${preview.speed.toFixed(preview.speed % 1 === 0.25 || preview.speed % 1 === 0.75 ? 2 : 1)}x`;
});

fillRange($('#pvCs'));
addEventListener('input', e => { if (e.target.type === 'range') fillRange(e.target); });
addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
});
addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dragging'); });
addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dragging'); });
addEventListener('drop', e => { e.preventDefault(); document.body.classList.remove('dragging'); handleDrop(e.dataTransfer); });
addEventListener('beforeunload', e => { if (S.loaded && S.undo.length) e.preventDefault(); });

render();
