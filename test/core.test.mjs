import test from 'node:test';
import assert from 'node:assert/strict';
import { zip, unzip } from '../public/js/zip.js';
import { parseIni, serializeIni, iniGet, iniSet, parseColour, rgbToHex, hexToRgb, maniaSchema } from '../public/js/ini.js';
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
