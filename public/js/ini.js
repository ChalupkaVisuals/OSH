// skin.ini parser / serializer that keeps unknown keys, comments and order,
// plus the schema used to build the settings form.

export function parseIni(text) {
  const sections = [{ name: '', lines: [] }];
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const cur = sections[sections.length - 1];
    const t = raw.trim();
    const m = t.match(/^\[(.+)\]$/);
    if (m) { sections.push({ name: m[1].trim(), lines: [] }); continue; }
    const i = t.indexOf(':');
    if (!t || t.startsWith('//') || i < 0) { cur.lines.push({ raw }); continue; }
    cur.lines.push({ key: t.slice(0, i).trim(), value: t.slice(i + 1).trim() });
  }
  return { sections };
}

export function serializeIni(ini) {
  const out = [];
  for (const s of ini.sections) {
    const lines = s.lines.map(l => (l.key !== undefined ? `${l.key}: ${l.value}` : l.raw));
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (!s.name && !lines.length) continue;
    if (s.name) out.push(`[${s.name}]`);
    out.push(...lines, '');
  }
  return out.join('\r\n');
}

const same = (a, b) => a.toLowerCase() === b.toLowerCase();

// [Mania] appears once per key count, identified by its Keys value.
function findSection(ini, name, maniaKeys) {
  return ini.sections.find(s => same(s.name, name) &&
    (maniaKeys == null || s.lines.some(l => l.key && same(l.key, 'Keys') && Number(l.value) === maniaKeys)));
}

export function iniGet(ini, section, key, maniaKeys) {
  const s = findSection(ini, section, maniaKeys);
  const l = s && s.lines.find(l => l.key && same(l.key, key));
  return l ? l.value : undefined;
}

/** Empty value removes the key so the game default applies. */
export function iniSet(ini, section, key, value, maniaKeys) {
  let s = findSection(ini, section, maniaKeys);
  if (value === '' || value == null) {
    if (s) s.lines = s.lines.filter(l => !(l.key && same(l.key, key)));
    return;
  }
  if (!s) {
    s = { name: section, lines: maniaKeys != null ? [{ key: 'Keys', value: String(maniaKeys) }] : [] };
    ini.sections.push(s);
  }
  const l = s.lines.find(l => l.key && same(l.key, key));
  if (l) l.value = String(value);
  else s.lines.push({ key, value: String(value) });
}

export function parseColour(str) {
  if (!str) return null;
  const p = str.split('//')[0].split(',').map(v => parseInt(v.trim(), 10));
  if (p.length < 3 || p.slice(0, 3).some(Number.isNaN)) return null;
  return p.slice(0, 3).map(v => Math.max(0, Math.min(255, v)));
}
export const rgbToHex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
export const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

// Field: [key, type, default, description, options]
const VERSIONS = ['1.0', '2.0', '2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', 'latest'];
export const SCHEMA = {
  General: [
    ['Name', 'text', '', 'Skin name shown in the skin list'],
    ['Author', 'text', '', 'Skin author'],
    ['Version', 'select', '1.0', 'Legacy behaviour version. Use "latest" for new skins', VERSIONS],
    ['AnimationFramerate', 'num', '-1', 'FPS of animated elements, -1 = automatic'],
    ['AllowSliderBallTint', 'bool', '0', 'Tint the slider ball with the combo colour'],
    ['ComboBurstRandom', 'bool', '0', 'Show combo bursts in random order'],
    ['CursorCentre', 'bool', '1', 'Cursor origin is the image centre (off = top-left)'],
    ['CursorExpand', 'bool', '1', 'Cursor grows when clicking'],
    ['CursorRotate', 'bool', '1', 'Cursor rotates constantly'],
    ['CursorTrailRotate', 'bool', '1', 'Cursor trail rotates'],
    ['CustomComboBurstSounds', 'text', '', 'Comma-separated combo counts that play comboburst sounds'],
    ['HitCircleOverlayAboveNumber', 'bool', '1', 'Draw hitcircleoverlay above the combo number'],
    ['LayeredHitSounds', 'bool', '1', 'Always play hitnormal under other hitsounds'],
    ['SliderBallFlip', 'bool', '1', 'Flip the slider ball on reverse'],
    ['SpinnerFadePlayfield', 'bool', '0', 'Fade the playfield during spinners'],
    ['SpinnerFrequencyModulate', 'bool', '1', 'Spinner sound rises in pitch'],
    ['SpinnerNoBlink', 'bool', '0', 'Spinner metre does not blink'],
  ],
  Colours: [
    ['Combo1', 'color', '255,192,0', 'Combo colour 1'],
    ['Combo2', 'color', '0,202,0', 'Combo colour 2'],
    ['Combo3', 'color', '18,124,255', 'Combo colour 3'],
    ['Combo4', 'color', '242,24,57', 'Combo colour 4'],
    ['Combo5', 'color', '', 'Combo colour 5 (optional)'],
    ['Combo6', 'color', '', 'Combo colour 6 (optional)'],
    ['Combo7', 'color', '', 'Combo colour 7 (optional)'],
    ['Combo8', 'color', '', 'Combo colour 8 (optional)'],
    ['SliderBorder', 'color', '255,255,255', 'Slider border colour'],
    ['SliderTrackOverride', 'color', '', 'Slider body colour (default: combo colour)'],
    ['SliderBall', 'color', '2,170,255', 'Default slider ball colour'],
    ['SpinnerBackground', 'color', '100,100,100', 'Tint of spinner-background'],
    ['StarBreakAdditive', 'color', '255,182,193', 'Colour of star2 during breaks'],
    ['MenuGlow', 'color', '0,78,155', 'Spectrum bar colour in the main menu'],
    ['InputOverlayText', 'color', '0,0,0', 'Key overlay text colour'],
    ['SongSelectActiveText', 'color', '0,0,0', 'Text colour of the selected song panel'],
    ['SongSelectInactiveText', 'color', '255,255,255', 'Text colour of unselected song panels'],
  ],
  Fonts: [
    ['HitCirclePrefix', 'text', 'default', 'File prefix of hit circle numbers (default-0.png …)'],
    ['HitCircleOverlap', 'num', '-2', 'Pixels the hit circle digits overlap'],
    ['ScorePrefix', 'text', 'score', 'File prefix of score numbers'],
    ['ScoreOverlap', 'num', '0', 'Pixels the score digits overlap'],
    ['ComboPrefix', 'text', 'score', 'File prefix of combo counter numbers'],
    ['ComboOverlap', 'num', '0', 'Pixels the combo digits overlap'],
  ],
  CatchTheBeat: [
    ['HyperDash', 'color', '255,0,0', 'Catcher colour while hyperdashing'],
    ['HyperDashFruit', 'color', '', 'Outline colour of hyperdash fruit'],
    ['HyperDashAfterImage', 'color', '', 'Catcher after-image colour'],
  ],
};

export const MANIA_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18];

export function maniaSchema(k) {
  const f = [
    ['ColumnStart', 'num', '136', 'Where the left column starts'],
    ['ColumnRight', 'num', '19', 'Up to which point columns can be drawn'],
    ['ColumnSpacing', 'text', '0', 'Comma list: distance between columns'],
    ['ColumnWidth', 'text', '30', 'Comma list: width of each column'],
    ['ColumnLineWidth', 'text', '2', 'Comma list: thickness of column separators'],
    ['BarlineHeight', 'num', '1.2', 'Thickness of the bar line'],
    ['LightingNWidth', 'text', '', 'Comma list: widths of LightingN per column'],
    ['LightingLWidth', 'text', '', 'Comma list: widths of LightingL per column'],
    ['WidthForNoteHeightScale', 'num', '', 'Note height scale when columns differ in width'],
    ['HitPosition', 'num', '402', 'Height of the judgement line'],
    ['LightPosition', 'num', '413', 'Height of the stage lights'],
    ['ScorePosition', 'num', '', 'Height of hit bursts'],
    ['ComboPosition', 'num', '', 'Height of the combo counter'],
    ['JudgementLine', 'bool', '0', 'Draw an extra judgement line'],
    ['LightFramePerSecond', 'num', '', 'FPS of stage light animations'],
    ['SpecialStyle', 'select', '0', '0 none, 1 left lane SP, 2 right lane SP', ['0', '1', '2']],
    ['ComboBurstStyle', 'select', '1', '0 left, 1 right, 2 both', ['0', '1', '2']],
    ['SplitStages', 'bool', '', 'Split the stage in two'],
    ['StageSeparation', 'num', '40', 'Distance between split stages'],
    ['SeparateScore', 'bool', '1', 'Show hit bursts only on the stage they were scored on'],
    ['KeysUnderNotes', 'bool', '0', 'Keys are covered by notes'],
    ['UpsideDown', 'bool', '0', 'Flip the stage vertically'],
    ['KeyFlipWhenUpsideDown', 'bool', '1', 'Flip keys when upside down'],
    ['NoteFlipWhenUpsideDown', 'bool', '1', 'Flip notes when upside down'],
    ['NoteBodyStyle', 'select', '1', '0 stretch, 1 cascade from top, 2 cascade from bottom', ['0', '1', '2']],
    ['ColourColumnLine', 'color', '255,255,255,255', 'Column separator colour'],
    ['ColourBarline', 'color', '255,255,255,255', 'Bar line colour'],
    ['ColourJudgementLine', 'color', '255,255,255', 'Judgement line colour'],
    ['ColourKeyWarning', 'color', '0,0,0', 'Key binding reminder colour'],
    ['ColourHold', 'color', '255,191,51,255', 'Combo colour during a hold'],
    ['ColourBreak', 'color', '255,0,0', 'Combo colour on combo break'],
    ['StageLeft', 'text', 'mania-stage-left', 'Image: left stage border'],
    ['StageRight', 'text', 'mania-stage-right', 'Image: right stage border'],
    ['StageBottom', 'text', 'mania-stage-bottom', 'Image: stage bottom'],
    ['StageHint', 'text', 'mania-stage-hint', 'Image: judgement line'],
    ['StageLight', 'text', 'mania-stage-light', 'Image: stage light'],
    ['LightingN', 'text', 'LightingN', 'Image: note hit lighting'],
    ['LightingL', 'text', 'LightingL', 'Image: hold hit lighting'],
    ['WarningArrow', 'text', '', 'Image: warning arrow'],
    ['Hit0', 'text', 'mania-hit0', 'Image: miss burst'],
    ['Hit50', 'text', 'mania-hit50', 'Image: 50 burst'],
    ['Hit100', 'text', 'mania-hit100', 'Image: 100 burst'],
    ['Hit200', 'text', 'mania-hit200', 'Image: 200 burst'],
    ['Hit300', 'text', 'mania-hit300', 'Image: 300 burst'],
    ['Hit300g', 'text', 'mania-hit300g', 'Image: rainbow 300 burst'],
  ];
  for (let i = 1; i <= k; i++) {
    f.push([`Colour${i}`, 'color', '0,0,0,255', `Column ${i} background colour`]);
    f.push([`ColourLight${i}`, 'color', '255,255,255', `Column ${i} light colour`]);
  }
  for (let i = 0; i < k; i++) {
    f.push([`KeyImage${i}`, 'text', '', `Image: column ${i + 1} key`]);
    f.push([`KeyImage${i}D`, 'text', '', `Image: column ${i + 1} key pressed`]);
    f.push([`NoteImage${i}`, 'text', '', `Image: column ${i + 1} note`]);
    f.push([`NoteImage${i}H`, 'text', '', `Image: column ${i + 1} hold head`]);
    f.push([`NoteImage${i}L`, 'text', '', `Image: column ${i + 1} hold body`]);
    f.push([`NoteImage${i}T`, 'text', '', `Image: column ${i + 1} hold tail`]);
  }
  return f;
}
