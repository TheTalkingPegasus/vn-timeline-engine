// Tutorial-Projekt: sieben einfache Szenen, jede zeigt genau ein Thema
const fs = require('fs');
const path = require('path');
const { createDemoProject } = require('./demo');

function createTutorialProject(dir) {
  // Bilder, Töne und Schrift aus dem Beispielprojekt wiederverwenden
  const demo = createDemoProject(dir);
  let n = 0;
  const id = (p) => p + '_t' + (++n);
  const empty = () => ({ bg: [], char1: [], char2: [], fx: [], cam: [], video: [], dialog: [], choice: [], music: [], voice: [], sfx: [] });
  const say = (start, speaker, color, text, extra) => Object.assign({ id: id('c'), start, len: 1, speaker, color, text, speed: 45, actions: [] }, extra || {});
  const RAY = '#c4b2ff', WACHE = '#ff9a8a', INFO = '#9fe0b0';
  const story = (sid, name, x, y, beats, next) => ({ id: sid, type: 'story', name, x, y, beats, next, tracks: empty() });

  // 01 · Bild und Figur
  const s1 = story('t1', '01 Bild und Figur', 60, 80, 2, 't2');
  s1.tracks.bg.push({ id: id('c'), start: 0, len: 2, asset: 'a_bg_keller', trans: 'fade', dur: 1 });
  s1.tracks.char1.push({ id: id('c'), start: 0, len: 2, asset: 'a_ray', x: 50, scale: 100, trans: 'fade', dur: 0.6, idle: 'breathe', name: 'Ray' });
  s1.tracks.dialog.push(
    say(0, 'Tutorial', INFO, 'Diese Szene hat nur zwei Clips: einen Hintergrund und eine Figur. Beide liegen unten auf der Timeline.'),
    say(1, 'Tutorial', INFO, 'Zieh ein Bild aus der Dateiliste auf eine Spur, und es erscheint hier auf der Bühne.'));

  // 02 · Dialog
  const s2 = story('t2', '02 Dialog', 300, 80, 3, 't3');
  s2.tracks.bg.push({ id: id('c'), start: 0, len: 3, asset: 'a_bg_keller', trans: 'cut', dur: 0 });
  s2.tracks.char1.push({ id: id('c'), start: 0, len: 3, asset: 'a_ray', x: 28, scale: 100, trans: 'cut', dur: 0, idle: 'none', name: 'Ray' });
  s2.tracks.char2.push({ id: id('c'), start: 0, len: 3, asset: 'a_wache', x: 72, scale: 100, trans: 'cut', dur: 0, idle: 'none', name: 'Wache' });
  s2.tracks.dialog.push(
    say(0, 'Ray', RAY, 'Jeder Klick ist ein Schritt. Jeder Dialog-Clip ist eine Zeile.'),
    say(1, 'Wache', WACHE, 'Und jeder Sprecher kann seine eigene Sprechblase haben.'),
    say(2, 'Ray', RAY, 'Rechtsklick auf die Blase öffnet ihr Design.'));

  // 03 · Ton
  const s3 = story('t3', '03 Ton', 540, 80, 3, 't4');
  s3.tracks.bg.push({ id: id('c'), start: 0, len: 3, asset: 'a_bg_hof', trans: 'fade', dur: 1 });
  s3.tracks.char1.push({ id: id('c'), start: 0, len: 3, asset: 'a_ray', x: 50, scale: 100, trans: 'fade', dur: 0.6, idle: 'breathe', name: 'Ray' });
  s3.tracks.music.push({ id: id('c'), start: 0, len: 3, asset: 'a_musik', vol: 55, loop: true, carry: false, fade: 1 });
  s3.tracks.voice.push({ id: id('c'), start: 0, len: 1, asset: 'a_voice_ray', vol: 80, in: 0.02, out: 1.0 });
  s3.tracks.sfx.push({ id: id('c'), start: 2, len: 1, asset: 'a_klick', vol: 90 });
  s3.tracks.dialog.push(
    say(0, 'Ray', RAY, 'Hörst du mich? Das ist die Voice-Spur.'),
    say(1, 'Tutorial', INFO, 'Die Musik läuft auf ihrer eigenen Spur über alle drei Schritte.'),
    say(2, 'Tutorial', INFO, 'Und das Klicken eben war ein Soundeffekt auf Schritt 3.'));

  // 04 · Auswahl (zwei Wege)
  const s4 = story('t4', '04 Auswahl', 780, 80, 1, null);
  s4.tracks.bg.push({ id: id('c'), start: 0, len: 1, asset: 'a_bg_keller', trans: 'fade', dur: 0.6 });
  s4.tracks.char1.push({ id: id('c'), start: 0, len: 1, asset: 'a_ray', x: 50, scale: 100, trans: 'cut', dur: 0, idle: 'none', name: 'Ray' });
  s4.tracks.dialog.push(say(0, 'Ray', RAY, 'Links oder rechts? Beide Wege siehst du oben im Reiter „Pfade“.'));
  s4.tracks.choice.push({ id: id('c'), start: 0, len: 1, options: [
    { id: 'opt_t_links', text: 'Links entlang', target: 't4a', conds: [], actions: [] },
    { id: 'opt_t_rechts', text: 'Rechts entlang', target: 't4b', conds: [], actions: [] }
  ] });
  const s4a = story('t4a', '04a Weg links', 1020, 0, 1, 't5');
  s4a.tracks.bg.push({ id: id('c'), start: 0, len: 1, asset: 'a_bg_hof', trans: 'fade', dur: 0.6 });
  s4a.tracks.dialog.push(say(0, 'Tutorial', INFO, 'Du hast den linken Weg genommen. Beide Wege führen danach zur nächsten Szene.'));
  const s4b = story('t4b', '04b Weg rechts', 1020, 170, 1, 't5');
  s4b.tracks.bg.push({ id: id('c'), start: 0, len: 1, asset: 'a_bg_gilde', trans: 'fade', dur: 0.6 });
  s4b.tracks.dialog.push(say(0, 'Tutorial', INFO, 'Du hast den rechten Weg genommen. Beide Wege führen danach zur nächsten Szene.'));

  // 05 · Wenn → Dann
  const s5 = story('t5', '05 Wenn → Dann', 1260, 80, 2, null);
  s5.tracks.bg.push({ id: id('c'), start: 0, len: 2, asset: 'a_bg_keller', trans: 'fade', dur: 0.8 });
  s5.tracks.char1.push({ id: id('c'), start: 0, len: 2, asset: 'a_ray', x: 30, scale: 100, trans: 'fade', dur: 0.6, idle: 'none', name: 'Ray' });
  s5.tracks.dialog.push(
    say(0, 'Ray', RAY, 'Hier, nimm den Dietrich. Dieser Dialog gibt dir einen Gegenstand.', { actions: [{ type: 'giveItem', item: 'it_dietrich', count: 1 }] }),
    say(1, 'Ray', RAY, 'Die erste Antwort geht nur, wenn du einen Dietrich hast.'));
  s5.tracks.choice.push({ id: id('c'), start: 1, len: 1, options: [
    { id: 'opt_t_tuer', text: 'Tür aufschließen (braucht Dietrich)', target: 'th', conds: [{ type: 'item', item: 'it_dietrich', op: '>=', count: 1 }], actions: [{ type: 'setVar', var: 'v_tuer', value: true }] },
    { id: 'opt_t_klopfen', text: 'Einfach klopfen', target: 'th', conds: [], actions: [] }
  ] });

  // 06 · Hub
  const hub = {
    id: 'th', type: 'hub', name: '06 Hub', x: 1500, y: 80, bg: 'a_bg_gilde', music: null, bgLook: { vignette: 30 }, events: [],
    objects: [
      { id: 'o_t_truhe', name: 'Truhe', asset: 'a_truhe', x: 14, y: 64, w: 18, h: 20, rot: 0, shape: 'rect', hover: 'glow', target: null, message: 'Ein Hub-Objekt kann Meldungen zeigen, Loot geben oder zu einer Szene führen.', sfx: 'a_glocke', conds: [], actions: [], styles: {} },
      { id: 'o_t_tuer', name: 'Weiter', asset: 'a_tuer', x: 76, y: 22, w: 12, h: 50, rot: 0, shape: 'rect', hover: 'glow', target: 't7', message: '', sfx: null, conds: [], actions: [], styles: {} }
    ]
  };
  hub.events.push({ id: 'ev_t', trigger: 'first', spotlight: 'o_t_truhe', lock: false, conds: [], lines: [
    { id: 'ln_t1', speaker: 'Tutorial', color: INFO, text: 'Ein Hub ist ein Ort, an dem man frei herumklickt. Klick die Truhe an, dann die Tür.' }
  ] });

  // 07 · Hauptmenü
  const s7 = story('t7', '07 Hauptmenü', 1740, 80, 2, null);
  s7.tracks.bg.push({ id: id('c'), start: 0, len: 2, asset: 'a_bg_gilde', trans: 'fade', dur: 1 });
  s7.tracks.dialog.push(
    say(0, 'Tutorial', INFO, 'Geschafft! Das Hauptmenü dieses Tutorials gestaltest du oben im Reiter „Hauptmenü“.'),
    say(1, 'Tutorial', INFO, 'Probier alles aus und lösch, was du nicht brauchst. Viel Spaß beim Bauen!'));

  const data = {
    version: 1, title: 'Tutorial', startScene: 't1', tutorial: true,
    assets: demo.assets.filter((a) => ['a_bg_keller', 'a_bg_hof', 'a_bg_gilde', 'a_ray', 'a_wache', 'a_truhe', 'a_tuer', 'a_musik', 'a_klick', 'a_glocke', 'a_voice_ray', 'a_i_dietrich', 'a_c_gold'].includes(a.id)),
    scenes: [s1, s2, s3, s4, s4a, s4b, s5, hub, s7], counter: n + 20,
    vars: [{ id: 'v_tuer', name: 'Tür offen', type: 'flag', start: false, note: 'wird in Szene 05 gesetzt' }],
    items: [{ id: 'it_dietrich', name: 'Dietrich', cat: 'Werkzeug', stack: true, max: 10, value: 15, desc: 'Damit gehen Türen auf.', image: 'a_i_dietrich' }],
    currencies: [], lootTables: [],
    inventory: { title: 'Inventar', cols: 6, rows: 2, bg: null, slot: null, showMoney: true, hudMoney: true, enabled: true },
    languages: ['de'], translations: {}, rigs: {}, blinks: {}, plugins: {},
    mainMenu: {
      enabled: true, bg: 'a_bg_gilde', bgLook: { vignette: 45, styles: { blur: { on: true, amount: 2 } } }, music: null,
      title: 'Tutorial', titleColor: '#ffffff', titleSize: 10, titleY: 26, titleFont: 'serif', logo: null, logoW: 30,
      buttons: [['Neues Spiel', 'new'], ['Laden', 'load'], ['Beenden', 'quit']].map(([label, action], i) => ({ id: 'mb_' + action, label, action, x: 50, y: 54 + i * 10, w: 26 })),
      btn: { bg: '#14141c', alpha: 85, color: '#ffffff', border: '#e8a43a', radius: 1.4, size: 3.4, hover: 'glow' }
    },
    theme: { bubble: { preset: 'dunkel' }, speakers: { Tutorial: { preset: 'hell' } }, choice: {}, sys: {}, gain: {}, sounds: {}, cursor: {}, fonts: {}, logo: {}, presets: [] }
  };
  // Plugins des Beispielprojekts hier nicht nötig
  try { fs.rmSync(path.join(dir, 'plugins'), { recursive: true, force: true }); } catch (e) { /* egal */ }
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(data, null, 2), 'utf8');
  return data;
}

module.exports = { createTutorialProject };
