// Feste Testreihe der VN Timeline Engine.
// Start: npm test   (unter Linux ohne Bildschirm: xvfb-run -a npm test)
// Lädt jedes Projekt aus tests/fixtures (Projekte aus alten Versionen, ein minimales und ein absichtlich
// kaputtes), wandelt es ins aktuelle Format um, öffnet jede Ansicht, spielt jede Szene an, speichert,
// lädt wieder und exportiert einmal als Web-Spiel. Am Ende eine Zusammenfassung; Fehler → Exit-Code 1.
const path = require('path');
const fs = require('fs');
const os = require('os');

module.exports = async function selftest({ win, app, approve, exportWebTo, BrowserWindow }) {
  const js = (code) => win.webContents.executeJavaScript(code);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fixDir = path.join(__dirname, 'fixtures');
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vn-selftest-'));
  const only = process.env.VN_TEST_ONLY || '';
  const files = fs.readdirSync(fixDir).filter((f) => f.endsWith('.json') && (!only || f.includes(only))).sort();
  const results = [];
  const log = (...a) => console.log(...a);
  const t0 = Date.now();

  await js(`VN.I18n.set('de'); 1`);
  const schemaNow = await js('VN.Schema.CURRENT');
  const engineVer = await js('VN.Schema.ENGINE');
  const pkgVer = require('../package.json').version;
  log(`VN Timeline Engine – Testreihe · Engine ${engineVer} · Format ${schemaNow} · ${files.length} Projekte`);
  const general = [];
  if (!pkgVer.startsWith(engineVer.replace(/\.0$/, ''))) general.push(`Version passt nicht: package.json ${pkgVer}, Schema.ENGINE ${engineVer}`);

  // Kleine Logik-Prüfungen (unabhängig von Projekten)
  const logic = JSON.parse(await js(`(() => {
    const out = [];
    const ok = (cond, text) => { if (!cond) out.push(text); };
    const prev = VN.project;
    VN.project = VN.migrate({ title: 'L', scenes: [], assets: [], vars: [{ id: 'v1', name: 'Mut', type: 'num', start: 2 }, { id: 'v2', name: 'Tür', type: 'flag', start: false }] });
    const rs = VN.newRunState();
    ok(VN.checkCond({ type: 'var', var: 'v1', op: '>=', value: 2 }, rs) === true, 'Bedingung Zahl >= stimmt nicht');
    ok(VN.checkCond({ type: 'var', var: 'v1', op: '>', value: 2 }, rs) === false, 'Bedingung Zahl > stimmt nicht');
    ok(VN.checkCond({ type: 'var', var: 'weg', op: '>=', value: 0 }, rs) === false, 'Bedingung mit gelöschter Variable gilt als erfüllt');
    ok(!!VN.condProblem({ type: 'var', var: 'weg', op: '>=', value: 0 }), 'Kaputte Bedingung wird nicht gemeldet');
    ok(!!VN.condProblem({ type: 'var', var: 'v1', op: '<>', value: 0 }), 'Ungültiger Vergleich wird nicht gemeldet');
    VN.applyActions([{ type: 'setVar', var: 'v1', value: 5 }], rs, 't');
    ok(rs.vars.v1 === 5 || rs.vars.v1 === '5', 'Aktion Variable setzen wirkt nicht');
    const twice = JSON.stringify(VN.migrate(JSON.parse(JSON.stringify(VN.project))));
    ok(twice === JSON.stringify(VN.migrate(JSON.parse(twice))), 'Umwandlung ist nicht stabil (zweimal umwandeln ändert etwas)');
    // Skilltree: kaufen, Kosten, Bonus, Stufen-Punkte, Zurücksetzen
    {
      const pp = VN.project;
      pp.currencies = [{ id: 'g', name: 'Gold', start: 100 }];
      pp.vars.push({ id: 'lv', name: 'Stufe', type: 'num', start: 1 });
      pp.skills = { enabled: true, key: 't', points: [{ id: 'sp', name: 'SP', start: 0, levelVar: 'lv', perLevel: 2 }], trees: [{ id: 'T', name: 'Baum', pay: { kind: 'currency', ref: 'g' }, respec: 'half', cats: [], nodes: [
        { id: 'a', name: 'A', max: 2, cost: 10, grow: 2, reqs: [], gate: [], effects: [{ type: 'moneyPct', cur: '', pct: 50 }] },
        { id: 'b', name: 'B', max: 1, cost: 5, grow: 1, reqs: ['a'], gate: [], effects: [{ type: 'statAdd', var: 'v1', amount: 3 }] } ] }] };
      VN.migrate(pp);
      const r2 = VN.newRunState();
      const SKx = VN.Skills, T = SKx.tree('T');
      ok(SKx.status(r2, T, SKx.node(T, 'b')) === 'locked', 'Skilltree: Voraussetzung wird nicht beachtet');
      ok(!!SKx.buy(r2, T, SKx.node(T, 'a')) && r2.money.g === 90, 'Skilltree: Kaufen zieht die Kosten nicht ab');
      ok(SKx.cost(SKx.node(T, 'a'), 1) === 20, 'Skilltree: Kostensteigerung falsch');
      VN.addMoney(r2, 'g', 10);
      ok(r2.money.g === 105, 'Skilltree: Geld-Bonus wirkt nicht (+50 %)');
      SKx.buy(r2, T, SKx.node(T, 'b'));
      ok(r2.vars.v1 === 5, 'Skilltree: Wert erhöhen wirkt nicht');
      SKx.update(r2); r2.vars.lv = 3; const up = SKx.update(r2);
      ok(up.length === 1 && SKx.state(r2).pts.sp === 4, 'Skilltree: Punkte durch Stufenaufstieg falsch');
      const before = r2.money.g;
      ok(SKx.respec(r2, T) && r2.money.g === before + Math.floor(15 / 2) && r2.vars.v1 === 2, 'Skilltree: Zurücksetzen falsch');
      ok(!SKx.treeProblems(T).length, 'Skilltree: Prüfung meldet Fehler, wo keiner ist');
    }
    // Kampf: Schaden, Schwächen, Story-Modus, Sieg mit Erfahrung, Stufen, Bedingungen, Simulation, Pfade
    {
      const pp = VN.project;
      pp.combat = { enabled: true, growth: 10, xpBase: 10, maxLevel: 50, heal: 'full', maxParty: 4, party: ['h1'],
        heroes: [{ id: 'h1', name: 'Held', hp: 100, mp: 20, atk: 20, def: 10, mag: 10, spd: 10, skills: [{ id: 'fire', at: 1 }, { id: 'ice', at: 3 }], levelVar: 'lv' }],
        enemies: [{ id: 'e1', name: 'Schleim', hp: 30, mp: 0, atk: 10, def: 0, mag: 0, spd: 1, weak: ['fire'], xp: 25, gold: 7 }, { id: 'e2', name: 'Drache', hp: 9999, mp: 0, atk: 500, def: 50, mag: 50, spd: 99, xp: 1, gold: 1 }],
        skills: [{ id: 'fire', name: 'Feuer', kind: 'magic', target: 'one', power: 100, mp: 5, element: 'fire' }, { id: 'ice', name: 'Eis', kind: 'magic', target: 'all', power: 100, mp: 5, element: 'ice' }],
        battles: [{ id: 'b1', name: 'Leicht', enemies: ['e1'], win: { scene: 'sw', actions: [] }, lose: { scene: '', mode: 'end', actions: [] }, flee: { scene: '' } }, { id: 'b2', name: 'Schwer', enemies: ['e2'] }] };
      VN.migrate(pp);
      const CBx = VN.Combat;
      const r3 = VN.newRunState();
      const fi = CBx.newFight(CBx.battle('b1'), r3, { rng: () => 0.5 });
      const hero = fi.units.find((u) => u.side === 'hero'), foe = fi.units.find((u) => u.side === 'enemy');
      ok(fi.units.length === 2 && hero.maxHp === 100 && hero.skills.length === 1, 'Kampf: Einheiten falsch aufgebaut (Fähigkeit ab Stufe 3 schon da?)');
      CBx.act(fi, hero, { kind: 'attack', targets: [foe] });
      ok(foe.hp === 10, 'Kampf: Angriffsschaden falsch (erwartet 20, war ' + (30 - foe.hp) + ')');
      foe.hp = 30;
      CBx.act(fi, hero, { kind: 'skill', ab: CBx.skill('fire'), targets: [foe] });
      ok(foe.hp === 12 && hero.mp === 15, 'Kampf: Schwäche (×1,5) oder MP-Kosten falsch');
      const fs = CBx.newFight(CBx.battle('b1'), r3, { rng: () => 0.5, story: true });
      const h2 = fs.units[0], f2 = fs.units[1];
      CBx.act(fs, f2, { kind: 'attack', targets: [h2] });
      const fn = CBx.newFight(CBx.battle('b1'), r3, { rng: () => 0.5 });
      CBx.act(fn, fn.units[1], { kind: 'attack', targets: [fn.units[0]] });
      ok(100 - h2.hp < 100 - fn.units[0].hp, 'Kampf: Story-Modus macht Gegner nicht schwächer');
      foe.hp = 0; foe.ko = true;
      ok(CBx.over(fi) === 'win', 'Kampf: Sieg wird nicht erkannt');
      const fin = CBx.finish(fi, r3, 'win');
      ok(fin.xp === 25 && r3.money.g >= 7 && CBx.heroState(r3, CBx.hero('h1')).lvl === 2 && r3.vars.lv === 2, 'Kampf: Erfahrung, Geld oder Stufenaufstieg falsch');
      ok(VN.checkCond({ type: 'battleWon', battle: 'b1' }, r3) && !VN.checkCond({ type: 'battleWon', battle: 'b2' }, r3), 'Kampf: Bedingung „Kampf gewonnen“ falsch');
      ok(CBx.simulate(CBx.battle('b1'), { level: 5, n: 20 }).rate === 100 && CBx.simulate(CBx.battle('b2'), { level: 1, n: 20 }).rate === 0, 'Kampf: Simulation unplausibel');
      pp.skills.trees[0].nodes[0].effects.push({ type: 'combatStat', stat: 'atk', pct: 50 });
      const r4 = VN.newRunState(); VN.Skills.buy(r4, VN.Skills.tree('T'), VN.Skills.node(VN.Skills.tree('T'), 'a'), true);
      ok(CBx.heroStat(CBx.hero('h1'), 'atk', 1, r4) === 30, 'Kampf: Skilltree-Bonus auf Kampfwerte wirkt nicht');
      VN.project.scenes = [{ id: 'sa', type: 'hub', name: 'A', objects: [{ id: 'o', actions: [{ type: 'battle', battle: 'b1' }] }] }, { id: 'sw', type: 'story', name: 'W', tracks: { choice: [] }, beats: 1 }];
      ok(!CBx.issues().length, 'Kampf: Prüfung meldet Fehler, wo keiner ist: ' + CBx.issues().map((x) => x.text).join(', '));
      pp.combat.battles[0].win.scene = 'weg';
      ok(CBx.battleProblems(pp.combat.battles[0]).length === 1, 'Kampf: fehlende Szene wird nicht gemeldet');
      pp.combat.battles[0].win.scene = 'sw';
      ok(VN.edgesOf(VN.project.scenes[0]).some((e) => e.to === 'sw' && e.kind === 'battle'), 'Kampf: Sieg-Szene fehlt in den Pfaden');
      VN.project.scenes = [];
    }
    // Aufbau: bauen, Kosten, Produktion mit Bruchteilen, Ziele, Spielzeit-Modus, Zeitvorschau
    {
      const pp = VN.project;
      pp.currencies.push({ id: 'w', name: 'Holz', start: 0 });
      pp.idle = { enabled: true, mode: 'realtime', catchup: 0, click: true, buildings: [
        { id: 'A', name: 'Hütte', max: 5, start: 0, costs: [{ cur: 'g', amount: 10 }], grow: 2, prods: [{ cur: 'w', amount: 6 }], clickable: true, clickAmount: 2, conds: [] },
        { id: 'B', name: 'Hof', max: 5, start: 1, costs: [{ cur: 'g', amount: 30 }], grow: 1.5, prods: [{ cur: 'g', amount: 5 }], conds: [{ type: 'idleLevel', building: 'A', level: 1 }] }],
        milestones: [{ id: 'M', name: 'Dorf', conds: [{ type: 'idleLevel', building: 'A', level: 2 }], actions: [{ type: 'setVar', var: 'v1', value: 9 }], target: 5 }] };
      VN.migrate(pp);
      const I = VN.Idle;
      const r5 = VN.newRunState();
      r5.money.g = 100;
      const A = I.building('A'), B = I.building('B');
      ok(I.level(r5, B) === 1 && I.status(r5, B) === 'locked', 'Aufbau: Startstufe oder Freischalten falsch');
      ok(I.build(r5, A) && r5.money.g === 90 && I.cost(A, 1)[0].amount === 20, 'Aufbau: Bauen oder Kostensteigerung falsch');
      I.produce(r5, 1.5);
      ok(r5.money.w === 9 && r5.money.g === 97, 'Aufbau: Produktion falsch (Holz ' + r5.money.w + ', Gold ' + r5.money.g + ')');
      I.produce(r5, 0.5);
      ok(r5.money.g === 100, 'Aufbau: Bruchteile gehen verloren');
      const cg = I.click(r5, A);
      ok(cg && cg.amount === 2 && r5.money.w === 14, 'Aufbau: Klicken bringt nichts');
      I.build(r5, A);
      const g5 = I.checkMilestones(r5);
      ok(g5.reached.length === 1 && r5.vars.v1 === 9 && VN.checkCond({ type: 'idleGoal', ms: 'M' }, r5), 'Aufbau: Ziel wird nicht erreicht oder Aktion fehlt');
      pp.idle.mode = 'gametime';
      const w0 = r5.money.w;
      VN.Life.advance(r5, { mode: 'add', amount: 2 });
      ok(r5.money.w === w0 + 24, 'Aufbau: Spielzeit-Modus produziert nicht pro Tageszeit');
      pp.idle.mode = 'realtime';
      const pv = I.preview();
      ok(pv.length === 1 && pv[0].at != null && pv[0].at < 5, 'Aufbau: Zeitvorschau unplausibel');
      ok(!I.issues().length, 'Aufbau: Prüfung meldet Fehler, wo keiner ist: ' + I.issues().map((x) => x.text).join(', '));
      // Prüfung zu 0.6.11: doppelte Währung bei den Kosten, Startstufe über dem Maximum, Zeitvorschau ohne Nebenwirkungen
      pp.idle.buildings.push({ id: 'C', name: 'Doppelt', max: 2, start: 5, costs: [{ cur: 'g', amount: 10 }, { cur: 'g', amount: 10 }], grow: 1, prods: [{ cur: 'w', amount: 1 }], conds: [] });
      const C = I.building('C');
      const r6 = VN.newRunState(); r6.money.g = 18;
      ok(I.level(r6, C) === 2, 'Aufbau: Startstufe über dem Maximum wird nicht begrenzt');
      r6.idle.lv.C = 0;
      ok(I.status(r6, C) === 'poor' && !I.build(r6, C) && r6.money.g === 18, 'Aufbau: doppelte Währung bei den Kosten wird einzeln statt zusammen geprüft');
      ok(I.buildingProblems(C).some((x) => /Startstufe/.test(x)), 'Aufbau: Startstufe über dem Maximum wird nicht gemeldet');
      pp.idle.buildings.pop();
      const keepPl = VNPlugin.plugins; window.__simRuns = 0;
      VNPlugin.plugins = Object.assign({}, keepPl, { __p: { id: '__p', hooks: {}, actions: { act: { label: 'x', run() { window.__simRuns++; } } } } });
      pp.idle.milestones[0].actions.push({ type: 'plugin', ref: '__p.act', params: {} });
      I.preview();
      ok(window.__simRuns === 0, 'Aufbau: Zeitvorschau führt Plugin-Aktionen aus');
      pp.idle.milestones[0].actions.pop();
      VNPlugin.plugins = keepPl;
    }

    // Text-Import: Ren'Py und eigenes Format
    const rp = 'define r = Character("Ray")\\nlabel a:\\n    r "Hallo{w} [name]"\\n    "Erzähler"\\n    menu:\\n        "Links":\\n            jump b\\n        "Rechts":\\n            return\\nlabel b:\\n    r "Da"\\n    return\\n';
    const pr = VN.TextImport.parse(rp);
    ok(pr.mode === 'renpy', 'Text-Import erkennt Ren\\'Py nicht');
    ok(pr.items.filter((x) => x.kind === 'line').length === 3, 'Text-Import: falsche Zeilenzahl (Ren\\'Py)');
    ok(pr.items.some((x) => x.kind === 'line' && x.who === 'Ray' && x.text === 'Hallo{pause=0.6} {name}'), 'Text-Import: Sprecher/Tags falsch');
    VN.project.scenes = [];
    const res = VN.TextImport.apply(pr, 'new', null, {});
    ok(res.scenes.length === 2 && res.choices === 1, 'Text-Import: Szenen/Auswahl falsch angelegt');
    ok(res.scenes[0].tracks.choice[0].options[0].target === res.scenes[1].id, 'Text-Import: Sprung nicht verknüpft');
    const ps = VN.TextImport.parse('Ray: Hi\\nDas hier ist ein Satz: ohne Namen, weil zu viele Wörter davor\\n> A\\n> B');
    ok(ps.mode === 'simple' && ps.items.length === 3 && ps.items[1].who === '' && ps.items[2].kind === 'choice', 'Text-Import: eigenes Format falsch erkannt');
    VN.project = prev;
    return JSON.stringify(out);
  })()`));
  for (const l of logic) general.push('Logik: ' + l);

  for (const file of files) {
    const name = file.replace(/\.json$/, '');
    const expectBroken = /kaputt/i.test(file);
    const r = { name, errors: [], warnings: [], info: '' };
    results.push(r);
    try {
      const dir = path.join(tmpRoot, name);
      fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
      const text = fs.readFileSync(path.join(fixDir, file), 'utf8');
      fs.writeFileSync(path.join(dir, 'project.json'), text);
      const before = JSON.parse(text);
      approve(dir);
      await js(`window.__vnErrors = []; document.querySelectorAll('.modal-back').forEach((m) => m.remove()); if (window.Player && Player.running) Player.close(); 1`);
      await js(`window.__vnLoad(${JSON.stringify(dir)}, ${JSON.stringify(before)}).then(() => 1)`);
      await wait(500);

      // 1. Format und Prüfung
      const st = JSON.parse(await js(`JSON.stringify({ schema: VN.project.schema, last: VN.Schema.last, check: VN.Schema.check(VN.project), scenes: VN.project.scenes.map((s) => [s.id, s.type, s.beats || 0]) })`));
      if (st.schema !== schemaNow) r.errors.push('Format nach dem Laden: ' + st.schema);
      const errs = st.check.filter((c) => c.level === 'error');
      if (expectBroken) { if (!errs.length) r.errors.push('Kaputtes Projekt: Prüfung findet nichts'); else r.info += errs.length + ' Fehler erkannt (erwartet) · '; }
      else for (const c of errs) r.errors.push('Prüfung: ' + c.where + ' – ' + c.text);
      r.warnings.push(...st.check.filter((c) => c.level === 'warn').map((c) => c.where + ' – ' + c.text));
      if ((Number(before.schema) || 0) < schemaNow) {
        if (!fs.readdirSync(dir).some((f) => f.startsWith('project.backup-'))) r.errors.push('Keine Sicherungskopie vor der Umwandlung');
      }

      // 2. Jede Ansicht öffnen
      const views = await js(`(async () => {
        const fail = [];
        const tryIt = async (label, fn) => { try { fn(); VN.render(); await new Promise((r) => setTimeout(r, 30)); } catch (e) { fail.push(label + ': ' + e.message); } };
        for (const s of VN.project.scenes) await tryIt('Szene ' + s.name, () => App.openScene(s.id));
        for (const s of VN.project.scenes.filter((x) => x.type === 'story')) for (const k of Object.keys(s.tracks)) for (const c of s.tracks[k].slice(0, 3)) await tryIt('Clip ' + k, () => { App.openScene(s.id); VN.ui.sel = c.id; VN.ui.beat = c.start; });
        await tryIt('Pfade', () => { VN.ui.sel = null; VN.ui.view = 'graph'; });
        VN.ui.view = 'systems'; VN.ui.sysTab = 'overview'; VN.render();
        const nav = document.querySelector('#center button.active');
        const tabs = nav ? Array.from(nav.parentElement.children) : [];
        for (let i = 0; i < tabs.length; i++) await tryIt('Spielsysteme ' + i, () => { document.querySelector('#center button.active').parentElement.children[i].click(); });
        for (const v of ['menu', 'transcript', 'figures', 'anim']) await tryIt('Ansicht ' + v, () => { VN.ui.view = v; });
        if (window.Design) for (const [id] of Design.SECTIONS) await tryIt('Design ' + id, () => { VN.ui.view = 'design'; VN.ui.designSec = id; });
        VN.ui.view = 'scene'; VN.render();
        return JSON.stringify(fail);
      })()`);
      r.errors.push(...JSON.parse(views));

      // 3. Jede Szene im Spiel anspielen
      for (const [id, type, beats] of st.scenes) {
        await js(`Player.start(${JSON.stringify(id)}, 0); 1`);
        await wait(type === 'story' ? 350 : 250);
        if (type === 'story') { await js(`__vnTest('advance', ${Math.min(beats, 6)}); 1`); await wait(Math.min(beats, 6) * 240 + 300); }
        await js(`if (Player.running) Player.close(); document.querySelectorAll('.plugin-overlay').forEach((e) => e.remove()); 1`);
      }
      await js(`Player.start(null, 0, { menu: true }); 1`); await wait(2600);
      await js(`if (Player.running) Player.close(); 1`);

      // 4. Speichern, Datei lesen, erneut umwandeln: muss stabil sein
      await js(`VN.save().then(() => 1)`);
      const saved = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8'));
      if (saved.schema !== schemaNow) r.errors.push('Gespeichertes Format: ' + saved.schema);
      if (saved.engine !== engineVer) r.errors.push('Gespeicherte Engine-Version fehlt');
      const stable = await js(`(() => { const a = JSON.stringify(VN.project); const b = JSON.stringify(VN.migrate(JSON.parse(a))); return a === b; })()`);
      if (!stable) r.errors.push('Erneutes Umwandeln verändert das Projekt');

      // 4b. Rückgängig / Wiederholen: muss exakt zum vorherigen Stand zurückführen
      const undoOk = await js(`(() => {
        const a = JSON.stringify(VN.project);
        VN.mutate(() => { VN.project.title = (VN.project.title || '') + ' (Test)'; const s = VN.project.scenes[0]; if (s) s.name = s.name + ' *'; });
        const b = JSON.stringify(VN.project);
        VN.undo(); const a2 = JSON.stringify(VN.project);
        VN.redo(); const b2 = JSON.stringify(VN.project);
        VN.undo();
        return a === a2 && b === b2 && a !== b;
      })()`);
      if (!undoOk) r.errors.push('Rückgängig/Wiederholen stellt den Stand nicht exakt wieder her');

      // 5. Fehler, die während des Ganzen aufgetreten sind
      const jsErr = JSON.parse(await js('JSON.stringify(window.__vnErrors || [])'));
      for (const e of jsErr) r.errors.push('Laufzeitfehler: ' + e);
      r.info += st.scenes.length + ' Szenen';
    } catch (e) {
      r.errors.push('Abbruch: ' + (e && e.message || e));
    }
    log(`${r.errors.length ? '✗' : '✓'} ${name} · ${r.info}${r.warnings.length ? ' · ' + r.warnings.length + ' Hinweise' : ''}`);
    for (const e of r.errors.slice(0, 12)) log('    ✗ ' + e);
  }

  // 5b. Stabilität (Prüfung zu 0.6.9): große Dateien als Strom, Speichern während Änderungen,
  // Ton-Elemente aufräumen, Kampf-Abbruch, Plugin-Aufräumen
  try {
    const dir = await js('VN.dir');
    const big = Buffer.alloc(3 * 1024 * 1024);
    for (let i = 0; i < big.length; i += 4096) big[i] = i % 251;
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'assets', 'big.bin'), big);
    const st = JSON.parse(await js(`(async () => {
      const out = [];
      const u = 'vnasset://project/assets/big.bin';
      const a = await fetch(u, { headers: { Range: 'bytes=4096-4195' } });
      const ab = new Uint8Array(await a.arrayBuffer());
      if (a.status !== 206 || ab.length !== 100 || ab[0] !== 4096 % 251 || a.headers.get('content-range') !== 'bytes 4096-4195/${big.length}') out.push('Dateibereich (Range) falsch: ' + a.status + ' / ' + ab.length);
      const f = await fetch(u);
      if (f.status !== 200 || (await f.arrayBuffer()).byteLength !== ${big.length}) out.push('Große Datei als Strom unvollständig');
      const z = await fetch(u, { headers: { Range: 'bytes=${big.length + 10}-' } });
      if (z.status !== 416) out.push('Ungültiger Dateibereich wird nicht abgelehnt');
      // Speichern: Änderung während des Schreibens darf nicht als gespeichert gelten
      const old = VN.project.title;
      VN.markDirty();
      const p1 = VN.save();
      VN.mutate(() => { VN.project.title = old + ' (geändert beim Speichern)'; });
      await p1;
      if (!VN.dirty) out.push('Änderung während des Speicherns wird als gespeichert angezeigt');
      await VN.save();
      if (VN.dirty) out.push('Nachspeichern klappt nicht');
      // Ton: beendete Elemente werden ausgetragen
      if (VN.Audio && 'mediaCount' in VN.Audio) {
        const n0 = VN.Audio.mediaCount;
        const au = new Audio(u); au.play().catch(() => {});
        const n1 = VN.Audio.mediaCount;
        au.dispatchEvent(new Event('ended'));
        if (!(n1 === n0 + 1 && VN.Audio.mediaCount === n0)) out.push('Beendetes Ton-Element bleibt in der Verwaltung');
      }
      // Kampf: Schließen während des Kampfes beendet den Ablauf
      const keepCombat = VN.project.combat;
      if (!(VN.Combat.on() && VN.Combat.cfg().battles.length && VN.Combat.cfg().party.length)) VN.project.combat = { enabled: true, party: ['th'], heroes: [{ id: 'th', name: 'H', hp: 50, mp: 0, atk: 5, def: 5, mag: 5, spd: 1, skills: [] }], enemies: [{ id: 'te', name: 'E', hp: 50, mp: 0, atk: 5, def: 5, mag: 5, spd: 1, skills: [] }], skills: [], battles: [{ id: 'tb', name: 'T', enemies: ['te'] }] };
      if (VN.Combat && VN.Combat.on() && VN.Combat.cfg().battles.length && VN.Combat.cfg().party.length) {
        const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:450px;container-type:size'; document.body.appendChild(host);
        const sc = VN.CombatScreen.open({ host, rs: VN.newRunState(), battle: VN.Combat.cfg().battles[0], level: 1, test: true });
        const pr = sc.run();
        await new Promise((r) => setTimeout(r, 900));
        sc.close();
        const res = await Promise.race([pr, new Promise((r) => setTimeout(() => r({ res: 'hängt' }), 2500))]);
        if (res.res !== 'abort') out.push('Abgebrochener Kampf endet nicht sauber (' + res.res + ')');
        host.remove();
      } else out.push('Kampf-Abbruch nicht geprüft');
      VN.project.combat = keepCombat;
      // Plugins: Aufräumen vor dem Neuladen
      const saved = VNPlugin.plugins; let n = 0; window.__unl = 0;
      VNPlugin.plugins = Object.assign({}, saved, { __t: { id: '__t', hooks: { onUnload() { window.__unl++; } } } });
      const ctx = VNPlugin.makeCtx(VN.newRunState(), '__t');
      ctx.listen(window, 'vn-selftest', () => n++);
      ctx.every(50, () => n++);
      VNPlugin.unloadAll();
      VNPlugin.plugins = saved;
      window.dispatchEvent(new Event('vn-selftest'));
      await new Promise((r) => setTimeout(r, 160));
      if (n !== 0 || window.__unl !== 1) out.push('Plugin-Aufräumen unvollständig (Listener/Timer/onUnload)');
      VN.mutate(() => { VN.project.title = old; }); await VN.save();
      return JSON.stringify(out);
    })()`));
    for (const e of st) general.push('Stabilität: ' + e);
    if (!st.length) log('✓ Stabilität: Dateibereiche, Speichern, Ton, Kampf-Abbruch, Plugin-Aufräumen');
  } catch (e) { general.push('Stabilität: ' + e.message); }

  // 6. Englische Oberfläche: übrig gebliebene deutsche Wörter suchen (nur Hinweis)
  const lastRich = files.filter((f) => !/kaputt|minimal/.test(f)).pop();
  if (lastRich) {
    await js(`VN.I18n.set('en'); 1`); await wait(300);
    const left = JSON.parse(await js(`(async () => {
      const D = window.VN_I18N_EN || {};
      const en = new Set(Object.values(D).join(' ').toLowerCase().match(/[a-z]+/g));
      const de = new Set(); for (const k of Object.keys(D)) for (const w of (k.match(/[A-Za-zÄÖÜäöüß]{4,}/g) || [])) if (!en.has(w.toLowerCase())) de.add(w);
      const found = new Set();
      const scan = () => { const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) { const p = n.parentElement; if (!p || p.closest('script,style,textarea,[data-notr],.dlg-text,.dlg-name,.choice-btn,.clip-user') || !p.getClientRects().length) continue; const t = n.data.trim(); if (t && ((t.match(/[A-Za-zÄÖÜäöüß]{4,}/g) || []).some((w) => de.has(w)) || /[äöüß]/.test(t))) found.add(VN.ui.view + ' | ' + t.slice(0, 80)); } };
      for (const v of ['scene', 'graph', 'systems', 'menu', 'design', 'transcript', 'figures', 'anim']) { VN.ui.view = v; VN.render(); await new Promise((r) => setTimeout(r, 80)); scan(); }
      VN.ui.view = 'scene'; VN.render();
      return JSON.stringify([...found]);
    })()`));
    await js(`VN.I18n.set('de'); 1`);
    log(`${left.length ? '!' : '✓'} Englische Oberfläche: ${left.length} Stellen mit deutschen Wörtern (Projektinhalte können dabei sein)`);
    for (const l of left.slice(0, 15)) log('    · ' + l);
  }

  // 7. Web-Export eines Projekts und Start im Browser-Fenster
  try {
    const proj = JSON.parse(await js('JSON.stringify(VN.project)'));
    const dest = path.join(tmpRoot, 'web');
    await exportWebTo(dest, proj);
    const w2 = new BrowserWindow({ width: 960, height: 540, show: false, webPreferences: { contextIsolation: true } });
    await w2.loadFile(path.join(dest, 'index.html'));
    await wait(2500);
    await w2.webContents.executeJavaScript(`(document.querySelector('.mm-btn') || { click() {} }).click(); 1`);
    await wait(1500);
    const webErr = JSON.parse(await w2.webContents.executeJavaScript('JSON.stringify(window.__vnErrors || [])'));
    w2.destroy();
    if (webErr.length) general.push('Web-Export: ' + webErr.join(' | '));
    else log('✓ Web-Export startet ohne Fehler');
  } catch (e) { general.push('Web-Export: ' + e.message); }

  const failed = results.filter((r) => r.errors.length);
  for (const g of general) log('✗ ' + g);
  log(`\n${failed.length || general.length ? 'FEHLGESCHLAGEN' : 'ALLES BESTANDEN'}: ${results.length - failed.length}/${results.length} Projekte ok${general.length ? ', ' + general.length + ' allgemeine Fehler' : ''} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) { /* egal */ }
  app.exit(failed.length || general.length ? 1 : 0);
};
