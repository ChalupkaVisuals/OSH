import { unzip, zip } from './zip.js';
import { parseIni, serializeIni, iniGet, iniSet, SCHEMA, MANIA_KEYS, maniaSchema, parseColour, rgbToHex, hexToRgb } from './ini.js';
import { CATEGORIES, buildCatalog } from './catalog.js';
import { GEN_TYPES, FONTS, presetFor, drawGen } from './gen.js';
import { DEFAULT_ADJ, adjustImage, canvasBytes, scaleCanvas, silentWav } from './imageops.js';
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
  return e;
}

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
  adj: { ...DEFAULT_ADJ },
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

const urlOf = rec => (rec.url ||= URL.createObjectURL(new Blob([rec.bytes], { type: mimeOf(rec.path) })));
function decode(rec) {
  return (rec.bmpP ||= createImageBitmap(new Blob([rec.bytes], { type: mimeOf(rec.path) })).then(b => (rec.bmp = b)));
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

function pickFiles(accept, opts = {}) {
  return new Promise(resolve => {
    const inp = h('input', { type: 'file', accept: accept || '', multiple: !!opts.multiple });
    if (opts.directory) inp.webkitdirectory = true;
    inp.addEventListener('change', () => resolve([...inp.files]));
    inp.click();
  });
}

// ───────────────────────── file store + undo ─────────────────────────

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
  if (batch.length) S.undo.push(batch);
  refresh();
}

function undo() {
  const batch = S.undo.pop();
  if (!batch) return;
  for (const { k, prev } of batch.reverse()) {
    if (prev) S.files.set(k, prev);
    else S.files.delete(k);
  }
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
  $('#btnUndo').disabled = !S.undo.length;
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
    if (keyOf(e.path) === 'skin.ini') S.ini = parseIni(new TextDecoder().decode(e.bytes));
    else S.files.set(keyOf(e.path), { path: e.path, bytes: e.bytes });
  }
  const name = iniGet(S.ini, 'General', 'Name') || fallbackName || 'New Skin';
  if (list.length) iniSet(S.ini, 'General', 'Name', `${name} (custom)`);
  else {
    iniSet(S.ini, 'General', 'Name', name);
    iniSet(S.ini, 'General', 'Author', '');
    iniSet(S.ini, 'General', 'Version', 'latest');
  }
  Object.assign(S, { loaded: true, undo: [], sel: null, cat: 'all', tab: 'elements' });
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
    if (keyOf(f.name) === 'skin.ini') { S.ini = parseIni(await f.text()); syncTop(); }
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
  $('#tabs').hidden = !S.loaded;
  for (const el of ['#skinName', '#skinAuthor', '#btnExport']) $(el).disabled = !S.loaded;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === S.tab);
  for (const t of ['elements', 'ini', 'preview', 'files']) $(`#view-${t}`).hidden = !S.loaded || S.tab !== t;
  if (S.tab === 'preview' && S.loaded) preview.start();
  else preview.stop();
  if (!S.loaded) return;
  if (S.tab === 'elements') { renderSide(); renderGrid(); renderInspector(); }
  if (S.tab === 'ini') renderIni();
  if (S.tab === 'files') renderFiles();
}

function renderSide() {
  const row = (id, label, els) => {
    const have = els.filter(e => e.variants.length).length;
    return h('button', { class: S.cat === id ? 'on' : '', onclick: () => { S.cat = id; renderSide(); renderGrid(); } },
      h('span', {}, label), h('span', { class: 'cnt' + (have === els.length ? ' full' : '') }, `${have}/${els.length}`));
  };
  const rows = [row('all', 'All elements', S.elements)];
  for (const [id, label] of CATEGORIES) {
    const els = S.elements.filter(e => e.cat === id);
    if (els.length) rows.push(row(id, label, els));
  }
  $('#side').replaceChildren(...rows);
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
    if (!v) thumb = '+';
    else if (el.kind === 'img') thumb = h('img', { loading: 'lazy', src: urlOf(v.rec), alt: '' });
    else if (el.kind === 'snd') thumb = h('button', { title: 'Play', onclick: e => { e.stopPropagation(); play(v.rec); } }, '▶');
    else thumb = '≡';
    const frames = el.variants.filter(x => x.frame != null && !x.hd).length || el.variants.filter(x => x.frame != null).length;
    const card = h('div', { class: 'card' + (v ? '' : ' missing') + (S.sel === k ? ' sel' : ''), title: el.desc || el.name, onclick: () => select(k) },
      h('div', { class: 'thumb' + (el.kind === 'img' && v ? ' checker' : '') }, thumb),
      h('div', { class: 'nm' }, el.name),
      h('div', { class: 'badges' },
        !v && h('span', { class: 'badge miss' }, 'missing'),
        el.variants.some(x => x.hd) && h('span', { class: 'badge hd' }, '@2x'),
        frames > 0 && h('span', { class: 'badge anim' }, `${frames} frames`)));
    cards.set(k, card);
    return card;
  });
  $('#grid').replaceChildren(...nodes);
  const have = S.elements.filter(e => e.cat !== 'other' && e.variants.length).length;
  const total = S.elements.filter(e => e.cat !== 'other').length;
  $('#stat').textContent = `${have} of ${total} skinnable elements present · ${S.files.size} files`;
}

function select(k) {
  cards.get(S.sel)?.classList.remove('sel');
  S.sel = k;
  S.adj = { ...DEFAULT_ADJ };
  S.gen = null;
  cards.get(k)?.classList.add('sel');
  renderInspector();
}

// ───────────────────────── inspector ─────────────────────────

function renderInspector() {
  const box = $('#insp'), el = S.byKey.get(S.sel);
  if (!el) {
    box.replaceChildren(h('p', { class: 'hint' },
      'Select an element to edit it. Dashed cards are elements this skin does not have yet: click one to upload or generate it. You can also drop image and sound files anywhere to add them.'));
    return;
  }
  const cat = CATEGORIES.find(c => c[0] === el.cat);
  const parts = [
    h('h2', {}, el.name),
    el.desc && h('div', { class: 'desc' }, el.desc),
    h('div', { class: 'badges' },
      h('span', { class: 'badge' }, cat ? cat[1] : el.cat),
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
    : kind === 'snd' ? h('button', { class: 'sm', onclick: () => play(v.rec) }, '▶') : null;
  return h('div', { class: 'vrow' }, mini,
    h('div', { class: 'vinfo' }, h('div', { title: v.rec.path }, v.rec.path), dims),
    h('button', { class: 'sm', title: 'Replace with a file', onclick: () => replaceVariant(v) }, 'Replace'),
    h('button', { class: 'sm', title: 'Download', onclick: () => download(new Blob([v.rec.bytes], { type: mimeOf(v.rec.path) }), v.rec.path.split('/').pop()) }, '↓'),
    h('button', { class: 'sm danger', title: 'Delete', onclick: () => { const b = []; delFile(v.rec.path, b); commit(b); } }, '✕'));
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
  const toggle = (label, key) => h('label', {}, h('input', { type: 'checkbox', checked: A[key], onchange: e => { A[key] = e.target.checked; drawAdjPreview(el); } }), ' ' + label);
  const inCat = S.elements.filter(e => e.cat === el.cat && e.kind === 'img' && e.variants.length);

  return [
    has && h('div', { class: 'stage checker' }, h('canvas', { id: 'adjCanvas' })),
    has && [h('h3', {}, 'Files'), el.variants.map(variantRow)],
    h('div', { class: 'row' },
      h('button', { onclick: () => addToElement(el, true) }, has ? 'Upload @2x…' : 'Upload image (@2x)…'),
      h('button', { onclick: () => addToElement(el, false) }, has ? 'Upload 1x…' : 'Upload image (1x)…'),
      has && h('button', { title: 'Create the missing 1x or @2x version of each file', onclick: () => fillPairs(el) }, 'Fill 1x / @2x'),
      has && h('button', { class: 'danger', onclick: () => removeElement(el) }, 'Remove')),
    has && [
      h('h3', {}, 'Adjust'),
      slider('Hue', 'hue', -180, 180, '°'), slider('Saturation', 'sat', 0, 300, '%'),
      slider('Brightness', 'bri', 0, 300, '%'), slider('Contrast', 'con', 0, 300, '%'),
      slider('Opacity', 'opa', 0, 100, '%'),
      h('label', { class: 'sl' }, h('span', {}, 'Colorize'),
        h('input', { type: 'range', min: 0, max: 100, value: A.tintAmt, oninput: e => { A.tintAmt = Number(e.target.value); drawAdjPreview(el); } }),
        h('input', { type: 'color', value: A.tint, oninput: e => { A.tint = e.target.value; drawAdjPreview(el); } })),
      slider('Size', 'scale', 10, 400, '%'),
      h('label', { class: 'sl' }, h('span', {}, 'Rotate'),
        h('select', { value: String(A.rot), onchange: e => { A.rot = Number(e.target.value); drawAdjPreview(el); } },
          [0, 90, 180, 270].map(d => h('option', { value: String(d) }, `${d}°`))), h('span')),
      h('div', { class: 'row' }, toggle('Flip horizontal', 'flipH'), toggle('Flip vertical', 'flipV')),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: () => applyAdjust([el]) }, 'Apply'),
        h('button', { onclick: () => { S.adj = { ...DEFAULT_ADJ }; renderInspector(); } }, 'Reset'),
        cat(el) && h('button', { title: 'Apply these adjustments to every image in this category',
          onclick: () => confirm(`Apply to all ${inCat.length} elements in "${cat(el)}"?`) && applyAdjust(inCat) }, `Apply to category (${inCat.length})`)),
    ],
    generatorBlock(el),
  ];
}

const cat = el => (CATEGORIES.find(c => c[0] === el.cat) || [])[1];

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
    h('label', { class: 'fld' }, h('span', {}, 'Colours'), h('span', { class: 'row' },
      h('input', { type: 'color', value: G.color, title: 'Fill', oninput: e => { G.color = e.target.value; redraw(); } }),
      h('input', { type: 'color', value: G.color2, title: 'Outline', oninput: e => { G.color2 = e.target.value; redraw(); } }))),
    field('Width @2x', 'w', 'number', { min: 1, max: 4096 }),
    field('Height @2x', 'h', 'number', { min: 1, max: 4096 }),
    field('Thickness', 'thick', 'number', { min: 0, max: 200 }),
    field('Text', 'text', 'text'),
    pick('Font', 'font', FONTS),
    h('div', { class: 'stage checker', style: 'margin-top:8px' }, cv),
    h('div', { class: 'hint' }, 'Sizes are for the @2x file; a 1x copy is created too. "blank" writes a 1×1 transparent image, which hides the element in game.'),
    h('div', { class: 'row' }, h('button', { class: 'primary', onclick: save }, 'Generate & save')));
}

function soundInspector(el) {
  const silence = () => {
    const batch = [];
    for (const v of el.variants) delFile(v.rec.path, batch);
    setFile(`${el.name}.wav`, silentWav(), batch);
    commit(batch);
  };
  return [
    el.variants.map(v => [variantRow(v), h('div', { class: 'vrow' }, h('audio', { controls: true, src: urlOf(v.rec) }))]),
    h('div', { class: 'row' },
      h('button', { onclick: () => addToElement(el, false) }, el.variants.length ? 'Replace sound…' : 'Upload sound…'),
      h('button', { title: 'Write a silent wav so this sound is muted in game', onclick: silence }, 'Make silent'),
      el.variants.length > 0 && h('button', { class: 'danger', onclick: () => removeElement(el) }, 'Remove')),
  ];
}

function fileInspector(el) {
  const v = el.variants[0];
  if (!v) return [];
  if (el.kind !== 'txt') return [variantRow(v)];
  const ta = h('textarea', { spellcheck: false, value: new TextDecoder().decode(v.rec.bytes) });
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
    ctl = [pick, text, h('button', { class: 'sm', title: 'Use the default', onclick: () => { text.value = ''; set(''); sync(); } }, '✕')];
  } else {
    ctl = h('input', { type: 'text', inputMode: type === 'num' ? 'decimal' : 'text', value: cur, placeholder: def || 'not set', oninput: e => set(e.target.value) });
  }
  row.append(h('div', { class: 'k' }, key), h('div', { class: 'ctl' }, ctl), h('div', { class: 'desc' }, desc || ''));
  return row;
}

function renderIni() {
  const sections = [...Object.keys(SCHEMA), 'Mania', 'Raw text'];
  const nav = h('div', { class: 'subnav' }, sections.map(s =>
    h('button', { class: s === S.iniSec ? 'on' : '', onclick: () => { S.iniSec = s; renderIni(); } }, s === 'Raw text' ? s : `[${s}]`)));
  let body;
  if (S.iniSec === 'Raw text') {
    const ta = h('textarea', { class: 'raw', spellcheck: false, value: serializeIni(S.ini), oninput: () => { S.ini = parseIni(ta.value); iniChanged(); } });
    body = [h('p', { class: 'hint' }, 'Edit skin.ini directly. Keys this editor does not know about are kept as they are.'), ta];
  } else if (S.iniSec === 'Mania') {
    const has = k => S.ini.sections.some(s => s.name.toLowerCase() === 'mania' && s.lines.some(l => l.key && l.key.toLowerCase() === 'keys' && Number(l.value) === k));
    body = [
      h('div', { class: 'subnav' }, h('span', { class: 'hint' }, 'Key count:'), MANIA_KEYS.map(k =>
        h('button', { class: 'sm' + (k === S.maniaKeys ? ' on' : ''), onclick: () => { S.maniaKeys = k; renderIni(); } }, `${k}K${has(k) ? ' •' : ''}`))),
      h('div', {}, maniaSchema(S.maniaKeys).map(f => iniRow('Mania', f, S.maniaKeys))),
    ];
  } else {
    body = h('div', {}, SCHEMA[S.iniSec].map(f => iniRow(S.iniSec, f)));
  }
  $('#view-ini').replaceChildren(nav, ...[body].flat());
}

// ───────────────────────── files tab ─────────────────────────

function renderFiles() {
  const recs = [...S.files.values()].sort((a, b) => a.path.localeCompare(b.path));
  const rename = rec => {
    const to = prompt('New file name', rec.path);
    if (!to || to === rec.path) return;
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
    h('div', { class: 'subnav' },
      h('button', { onclick: async () => { const f = await pickFiles('', { multiple: true }); if (f.length) addLooseFiles(f); } }, 'Add files…'),
      h('span', { class: 'hint' }, `${recs.length} files, ${fmtSize(total)}. skin.ini is written from the skin.ini tab when you save.`)),
    h('table', { class: 'files' },
      h('thead', {}, h('tr', {}, h('th', {}, 'File'), h('th', {}, 'Type'), h('th', {}, 'Size'), h('th', {}))),
      h('tbody', {}, recs.map(rec => h('tr', {},
        h('td', {}, rec.path), h('td', {}, { img: 'image', snd: 'sound', txt: 'text', bin: 'other' }[kindOf(rec.path)]), h('td', {}, fmtSize(rec.bytes.length)),
        h('td', { class: 'act' },
          h('button', { class: 'sm', onclick: () => show(rec) }, 'Edit'),
          h('button', { class: 'sm', onclick: () => rename(rec) }, 'Rename'),
          h('button', { class: 'sm', onclick: () => download(new Blob([rec.bytes], { type: mimeOf(rec.path) }), rec.path.split('/').pop()) }, '↓'),
          h('button', { class: 'sm danger', onclick: () => { const b = []; delFile(rec.path, b); commit(b); } }, '✕')))))));
}

// ───────────────────────── preview ─────────────────────────

const fallbackTex = new Map();
const preview = new Preview($('#pv'), {
  ini: (section, key) => iniGet(S.ini, section, key),
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

const doImport = async () => { const [f] = await pickFiles('.osk,.zip'); if (f && await confirmReplace()) importZip(f); };
const doFolder = async () => { const f = await pickFiles('', { directory: true }); if (f.length && await confirmReplace()) importFolder(f); };
const doNew = async () => { if (await confirmReplace()) loadEntries([], 'New Skin'); };
for (const id of ['#btnImport', '#wImport']) $(id).addEventListener('click', doImport);
for (const id of ['#btnFolder', '#wFolder']) $(id).addEventListener('click', doFolder);
for (const id of ['#btnNew', '#wNew']) $(id).addEventListener('click', doNew);
$('#btnUndo').addEventListener('click', undo);
$('#btnExport').addEventListener('click', exportSkin);
$('#skinName').addEventListener('input', e => iniSet(S.ini, 'General', 'Name', e.target.value));
$('#skinAuthor').addEventListener('input', e => iniSet(S.ini, 'General', 'Author', e.target.value));
$('#search').addEventListener('input', e => { S.search = e.target.value; renderGrid(); });
$('#missingOnly').addEventListener('change', e => { S.missingOnly = e.target.checked; renderGrid(); });
$('#pvCs').addEventListener('input', e => { preview.cs = Number(e.target.value); });
$('#pvBg').addEventListener('input', e => { preview.bg = e.target.value; });
for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => { S.tab = b.dataset.tab; render(); });

addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { e.preventDefault(); undo(); }
});
addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('dragging'); });
addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dragging'); });
addEventListener('drop', e => { e.preventDefault(); document.body.classList.remove('dragging'); handleDrop(e.dataTransfer); });
addEventListener('beforeunload', e => { if (S.loaded && S.undo.length) e.preventDefault(); });

render();
