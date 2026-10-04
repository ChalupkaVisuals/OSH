// Catalog of every skinnable element, used to group files and to show
// what a skin is missing. A trailing * marks elements that can be animated
// (name-0.png, name-1.png …).

export const CATEGORIES = [
  ['cursor', 'Cursor'],
  ['circles', 'Hit circles'],
  ['sliders', 'Sliders'],
  ['spinner', 'Spinner'],
  ['numbers', 'Numbers / fonts'],
  ['judgements', 'Hit bursts'],
  ['hud', 'Gameplay HUD'],
  ['pause', 'Pause, fail & countdown'],
  ['menu', 'Menu & song select'],
  ['ranking', 'Ranking screen'],
  ['mods', 'Mod icons'],
  ['taiko', 'osu!taiko'],
  ['catch', 'osu!catch'],
  ['mania', 'osu!mania'],
  ['sounds-hit', 'Hitsounds'],
  ['sounds-ui', 'UI & gameplay sounds'],
  ['other', 'Other files'],
];

const IMAGES = {
  cursor: 'cursor cursormiddle cursortrail cursor-smoke cursor-ripple',
  circles: `hitcircle hitcircleoverlay* hitcircleselect approachcircle followpoint* lighting
    sliderstartcircle sliderstartcircleoverlay* sliderendcircle sliderendcircleoverlay*`,
  sliders: `sliderb* sliderb-nd sliderb-spec sliderfollowcircle* sliderscorepoint reversearrow
    sliderpoint10 sliderpoint30 sliderendmiss slidertickmiss`,
  spinner: `spinner-approachcircle spinner-rpm spinner-clear spinner-spin spinner-glow spinner-bottom
    spinner-top spinner-middle spinner-middle2 spinner-background spinner-circle spinner-metre
    spinner-osu spinner-warning`,
  judgements: `hit0* hit50* hit100* hit100k* hit300* hit300k* hit300g* particle50 particle100 particle300`,
  hud: `scorebar-bg scorebar-colour* scorebar-ki scorebar-kidanger scorebar-kidanger2 scorebar-marker
    inputoverlay-background inputoverlay-key play-skip* play-unranked play-warningarrow arrow-pause
    arrow-warning masking-border multi-skipped section-fail section-pass comboburst* star2`,
  pause: `pause-overlay fail-background pause-back pause-continue pause-replay pause-retry
    count1 count2 count3 go ready`,
  menu: `menu-background menu-back* menu-button-background menu-snow welcome_text selection-mode
    selection-mode-over selection-mods selection-mods-over selection-random selection-random-over
    selection-options selection-options-over selection-tab star button-left button-middle button-right
    options-offset-tick mode-osu mode-osu-med mode-osu-small mode-taiko mode-taiko-med mode-taiko-small
    mode-fruits mode-fruits-med mode-fruits-small mode-mania mode-mania-med mode-mania-small`,
  ranking: `ranking-xh ranking-xh-small ranking-x ranking-x-small ranking-sh ranking-sh-small
    ranking-s ranking-s-small ranking-a ranking-a-small ranking-b ranking-b-small ranking-c
    ranking-c-small ranking-d ranking-d-small ranking-accuracy ranking-graph ranking-maxcombo
    ranking-panel ranking-perfect ranking-title ranking-replay ranking-retry ranking-winner`,
  mods: ['autoplay', 'cinema', 'doubletime', 'easy', 'fadein', 'flashlight', 'halftime', 'hardrock',
    'hidden', 'key1', 'key2', 'key3', 'key4', 'key5', 'key6', 'key7', 'key8', 'key9', 'keycoop',
    'mirror', 'nightcore', 'nofail', 'perfect', 'random', 'relax', 'relax2', 'scorev2', 'spunout',
    'suddendeath', 'target', 'freemodallowed', 'touchdevice'].map(m => 'selection-mod-' + m).join(' '),
  taiko: `taiko-bar-left taiko-bar-right taiko-bar-right-glow taiko-drum-inner taiko-drum-outer
    taiko-barline taikohitcircle taikohitcircleoverlay* taikobigcircle taikobigcircleoverlay*
    taiko-roll-middle taiko-roll-end taiko-slider taiko-slider-fail taiko-flower-group taiko-glow
    taiko-hit0* taiko-hit100* taiko-hit100k* taiko-hit300* taiko-hit300k* taiko-hit300g*
    pippidonclear* pippidonfail* pippidonidle* pippidonkiai*`,
  catch: `fruit-apple fruit-apple-overlay fruit-grapes fruit-grapes-overlay fruit-orange
    fruit-orange-overlay fruit-pear fruit-pear-overlay fruit-bananas fruit-bananas-overlay fruit-drop
    fruit-drop-overlay fruit-catcher-idle* fruit-catcher-kiai* fruit-catcher-fail* comboburst-fruits*`,
  mania: `mania-key1 mania-key1d mania-key2 mania-key2d mania-keys mania-keysd
    mania-note1* mania-note1h* mania-note1l* mania-note1t* mania-note2* mania-note2h* mania-note2l*
    mania-note2t* mania-notes* mania-notesh* mania-notesl* mania-notest*
    mania-stage-left mania-stage-right mania-stage-bottom* mania-stage-hint* mania-stage-light*
    mania-hit0* mania-hit50* mania-hit100* mania-hit200* mania-hit300* mania-hit300g*
    lightingn* lightingl* mania-warningarrow comboburst-mania*`,
};

const sets = ['normal', 'soft', 'drum'];
const hits = ['hitnormal', 'hitclap', 'hitfinish', 'hitwhistle', 'slidertick', 'sliderslide', 'sliderwhistle'];
const SOUNDS = {
  'sounds-hit': [
    ...sets.flatMap(s => hits.map(h => `${s}-${h}`)),
    ...sets.flatMap(s => ['hitnormal', 'hitclap', 'hitfinish', 'hitwhistle'].map(h => `taiko-${s}-${h}`)),
    'spinnerspin', 'spinnerbonus', 'spinnerbonus-max', 'combobreak', 'comboburst',
  ].join(' '),
  'sounds-ui': `applause failsound sectionpass sectionfail pause-loop count1s count2s count3s gos readys
    menuhit menuback menuclick menu-back-click menu-back-hover menu-play-click menu-play-hover
    menu-edit-click menu-edit-hover menu-direct-click menu-direct-hover menu-options-click
    menu-options-hover menu-exit-click menu-exit-hover menu-freeplay-click menu-freeplay-hover
    menu-multiplayer-click menu-multiplayer-hover menu-charts-click menu-charts-hover
    back-button-click back-button-hover click-short click-short-confirm click-close check-on check-off
    select-expand select-difficulty shutter key-confirm key-delete key-movement key-press-1
    key-press-2 key-press-3 key-press-4 pause-back-click pause-back-hover pause-continue-click
    pause-continue-hover pause-retry-click pause-retry-hover heartbeat seeya welcome metronomelow
    match-confirm match-join match-leave match-notready match-ready match-start
    nightcore-kick nightcore-clap nightcore-hat nightcore-finish`,
};

const DESC = {
  cursor: 'Main cursor image',
  cursormiddle: 'Static dot drawn on top of the cursor',
  cursortrail: 'Trail left behind the cursor',
  hitcircle: 'Hit circle base, tinted with the combo colour',
  hitcircleoverlay: 'Drawn over the hit circle, not tinted',
  approachcircle: 'Ring that shrinks onto the hit circle, tinted',
  followpoint: 'Dots connecting consecutive hit objects',
  sliderb: 'Slider ball',
  sliderfollowcircle: 'Ring around the slider ball while it is held',
  reversearrow: 'Arrow on repeating slider ends',
  sliderscorepoint: 'Slider tick',
  'menu-background': 'Main menu background (png or jpg)',
  'scorebar-bg': 'Health bar background',
  'scorebar-colour': 'Health bar fill',
  hit0: 'Miss', hit50: '50 (meh)', hit100: '100 (ok)', hit300: '300 (great)',
};

const digits = '0123456789'.split('');

/** @returns {{name:string, cat:string, kind:'img'|'snd', anim:boolean, desc:string}[]} */
export function buildCatalog(prefixes) {
  const out = [];
  const add = (cat, kind, token) => {
    const anim = token.endsWith('*');
    const name = anim ? token.slice(0, -1) : token;
    out.push({ name, cat, kind, anim, desc: DESC[name] || '' });
  };
  for (const [cat, list] of Object.entries(IMAGES)) list.split(/\s+/).filter(Boolean).forEach(t => add(cat, 'img', t));

  const hit = prefixes.hit || 'default', score = prefixes.score || 'score', combo = prefixes.combo || 'score';
  const extras = ['comma', 'dot', 'percent', 'x'];
  const fonts = [[hit, digits], [score, [...digits, ...extras]]];
  if (combo.toLowerCase() !== score.toLowerCase()) fonts.push([combo, [...digits, 'x']]);
  fonts.push(['scoreentry', [...digits, ...extras]]);
  const seen = new Set();
  for (const [prefix, glyphs] of fonts) {
    for (const g of glyphs) {
      const name = `${prefix}-${g}`;
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      out.push({ name, cat: 'numbers', kind: 'img', anim: false, desc: `Font glyph "${g}"` });
    }
  }
  for (const [cat, list] of Object.entries(SOUNDS)) list.split(/\s+/).filter(Boolean).forEach(t => add(cat, 'snd', t));
  return out;
}
