import test from 'node:test';
import assert from 'node:assert/strict';
import { zip, unzip } from '../public/js/zip.js';
import { decodeText, parseIni, serializeIni, iniGet, iniSet, parseColour, rgbToHex, hexToRgb, maniaSchema } from '../public/js/ini.js';
import { processAudio, encodeWav } from '../public/js/audioops.js';
import { buildCatalog, CATEGORIES } from '../public/js/catalog.js';

test('zip round-trips stored and deflated entries', async () => {
  const entries = [
    { path: 'skin.ini', bytes: new TextEncoder().encode('[General]\r\nName: x\r\n'.repeat(40)) },
    { path: 'hitcircle@2x.png', bytes: Uint8Array.from({ length: 300 }, (_, i) => (i * 37) % 256) },
    { path: 'sub/ünïcode.wav', bytes: new Uint8Array(0) },
  ];
  const back = await unzip(await (await zip(entries)).arrayBuffer());
  assert.deepEqual(back.map(e => e.path), entries.map(e => e.path));
  back.forEach((e, i) => assert.deepEqual([...e.bytes], [...entries[i].bytes]));
});

test('unzip rejects data that is not a zip', async () => {
  await assert.rejects(unzip(new Uint8Array(64).buffer), /Not a zip/);
});

test('ini keeps unknown keys, comments and order', () => {
  const src = '// made by someone\r\n\r\n[General]\r\nName: Test\r\nWeirdKey: keep\r\n// note\r\n\r\n[Colours]\r\nCombo1: 1,2,3\r\n';
  const ini = parseIni(src);
  assert.equal(serializeIni(ini), src);
  assert.equal(iniGet(ini, 'general', 'name'), 'Test');
  iniSet(ini, 'General', 'Name', 'Renamed');
  iniSet(ini, 'Fonts', 'HitCirclePrefix', 'num');
  iniSet(ini, 'Colours', 'Combo1', '');
  const out = serializeIni(ini);
  assert.match(out, /Name: Renamed/);
  assert.match(out, /WeirdKey: keep/);
  assert.match(out, /\[Fonts\]\r\nHitCirclePrefix: num/);
  assert.doesNotMatch(out, /Combo1/);
});

test('mania sections are addressed by key count', () => {
  const ini = parseIni('[Mania]\nKeys: 4\nHitPosition: 400\n[Mania]\nKeys: 7\nHitPosition: 420\n');
  assert.equal(iniGet(ini, 'Mania', 'HitPosition', 4), '400');
  assert.equal(iniGet(ini, 'Mania', 'HitPosition', 7), '420');
  iniSet(ini, 'Mania', 'HitPosition', '410', 5);
  assert.equal(iniGet(ini, 'Mania', 'HitPosition', 5), '410');
  assert.equal(iniGet(ini, 'Mania', 'Keys', 5), '5');
  assert.ok(maniaSchema(4).some(f => f[0] === 'NoteImage3L'));
});

test('colour helpers', () => {
  assert.deepEqual(parseColour('255, 0,128 // pink'), [255, 0, 128]);
  assert.deepEqual(parseColour('10,20,30,200'), [10, 20, 30]);
  assert.equal(parseColour('nope'), null);
  assert.equal(rgbToHex([255, 0, 128]), '#ff0080');
  assert.deepEqual(hexToRgb('#ff0080'), [255, 0, 128]);
});

test('catalog has unique elements in known categories and follows font prefixes', () => {
  const cat = buildCatalog({ hit: 'num', score: 'sc', combo: 'cb' });
  const keys = cat.map(e => `${e.kind}:${e.name.toLowerCase()}`);
  assert.equal(new Set(keys).size, keys.length);
  const ids = new Set(CATEGORIES.map(c => c[0]));
  assert.ok(cat.every(e => ids.has(e.cat)));
  for (const name of ['num-0', 'sc-percent', 'cb-x', 'hitcircle', 'cursor']) assert.ok(cat.some(e => e.name === name), name);
  assert.ok(!cat.some(e => e.name === 'default-0'));
  assert.ok(cat.find(e => e.name === 'sliderb').anim);
});

test('decodeText handles UTF-8 and UTF-16 skin.ini files', () => {
  const text = '[General]\r\nName: 『Mikan』\r\n';
  const le = new Uint8Array(text.length * 2), be = new Uint8Array(text.length * 2);
  [...text].forEach((ch, i) => {
    const c = ch.charCodeAt(0);
    le[i * 2] = be[i * 2 + 1] = c & 255;
    le[i * 2 + 1] = be[i * 2] = c >> 8;
  });
  assert.equal(decodeText(new TextEncoder().encode(text)), text);
  assert.equal(decodeText(new Uint8Array([0xEF, 0xBB, 0xBF, ...new TextEncoder().encode(text)])), text);
  assert.equal(decodeText(new Uint8Array([0xFF, 0xFE, ...le])), text);
  assert.equal(decodeText(new Uint8Array([0xFE, 0xFF, ...be])), text);
  assert.equal(decodeText(le), text); // no BOM
  assert.equal(iniGet(parseIni(decodeText(new Uint8Array([0xFF, 0xFE, ...le]))), 'General', 'Name'), '『Mikan』');
});

test('processAudio applies gain and shifts timing', () => {
  const src = { channels: [Float32Array.from([0.1, 0.2, 0.3, 0.4])], sampleRate: 1000 };
  const near = (a, b) => assert.ok(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6), `${[...a]} vs ${b}`);
  near(processAudio(src, { gain: 2 }).channels[0], [0.2, 0.4, 0.6, 0.8]);
  near(processAudio(src, { gain: 4 }).channels[0], [0.4, 0.8, 1, 1]); // clipped
  near(processAudio(src, { delayMs: 2 }).channels[0], [0, 0, 0.1, 0.2, 0.3, 0.4]);
  near(processAudio(src, { delayMs: -3 }).channels[0], [0.4]);
  near(processAudio(src, { delayMs: -50 }).channels[0], []);
});

test('encodeWav writes a valid 16-bit header and samples', () => {
  const wav = encodeWav({ channels: [Float32Array.from([0, 1, -1]), Float32Array.from([0.5, 0, 0])], sampleRate: 44100 });
  const dv = new DataView(wav.buffer);
  assert.equal(String.fromCharCode(...wav.subarray(0, 4)), 'RIFF');
  assert.equal(wav.length, 44 + 3 * 2 * 2);
  assert.equal(dv.getUint16(22, true), 2);
  assert.equal(dv.getUint32(24, true), 44100);
  assert.equal(dv.getUint32(40, true), 12);
  assert.deepEqual([0, 2, 4, 6, 8, 10].map(o => dv.getInt16(44 + o, true)), [0, 16384, 32767, 0, -32768, 0]);
});
