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
    // 0.7: ♥-Punkte aus jedem System werden in „max. %“ gezählt; jede Aktion läuft ohne Absturz
    try {
      const pp = VN.migrate({ title: 'A', scenes: [], assets: [], vars: [{ id: 'v', name: 'V', type: 'num', start: 0 }], currencies: [{ id: 'g', name: 'Gold', start: 100 }], items: [{ id: 'it', name: 'Rose', use: { actions: [] } }] });
      VN.project = pp;
      pp.relations.enabled = true;
      pp.relations.chars.push({ id: 'nv', name: 'Neon', start: 0, likes: {}, itemPrefs: {}, reactions: {}, rewards: { 1: { text: 'x' } } });
      const R = (n) => ({ type: 'rel', char: 'nv', amount: n });
      const st = VN.newStoryScene('S');
      st.tracks.dialog.push({ id: 'd1', start: 0, len: 1, speaker: 'Neon', text: 'Hi', actions: [R(1)] });
      st.tracks.choice.push({ id: 'c1', start: 0, len: 1, options: [{ id: 'op', text: 'A', actions: [], rel: [{ char: 'nv', amount: 2 }] }] });
      const hb = VN.newHubScene('H');
      hb.objects.push({ id: 'o1', name: 'Tür', x: 1, y: 1, w: 5, h: 5, actions: [R(4)] });
      pp.items[0].use.actions.push(R(8));
      VN.Idle.cfg().enabled = true; pp.idle.milestones.push({ id: 'm1', name: 'Dorf', conds: [], actions: [R(16)], target: 1, message: '' });
      pp.combat = { enabled: true, heroes: [], enemies: [], skills: [], party: [], battles: [{ id: 'b1', name: 'K', enemies: [], win: { actions: [R(32)] }, lose: { actions: [] } }] };
      pp.quests = { enabled: true, list: [{ id: 'qs', name: 'Q', single: true, reward: [], quests: [{ id: 'q1', name: 'Q1', reward: [R(64)], steps: [{ id: 'st1', name: 'A', reward: [R(128)] }] }] }] };
      VN.migrate(pp);
      const src = VN.Life.relSources('nv');
      const sum = src.reduce((n, x) => n + x.pos, 0);
      ok(sum === 255, 'Beziehungen: nicht alle ♥-Quellen gezählt (' + sum + ' statt 255: ' + src.map((x) => x.label + '+' + x.pos).join(', ') + ')');
      ok(VN.Life.relIssues().length === 0, 'Beziehungen: Meldung trotz genug Punkten');
      pp.relations.chars[0].rewards = { 4: { text: 'y' } };
      pp.relations.ladder[4] = pp.relations.ladder[4] || { name: 'X', min: 100 };
      // Jede Aktion: Standardwerte anlegen und ausführen, ohne Fehler
      const types = [...VN.ACTION_TYPES, ...VN.Life.actionTypes(), ...Object.keys(VN.ext.actions).map((k) => [k])].map((x) => x[0]);
      const rsA = VN.newRunState();
      for (const t of types) {
        const xd = VN.ext.actions[t];
        const a = Object.assign({ type: t }, xd && xd.make ? xd.make() : { value: 1, count: 1, amount: 1 });
        try { VN.applyActions([a], rsA, 'test'); } catch (e) { out.push('Aktion „' + t + '“ stürzt ab: ' + e.message); }
        try { VN.actionText(a); } catch (e) { out.push('Aktion „' + t + '“: Text stürzt ab'); }
      }
      // Kaufen: Gebäude per Aktion freischalten
      const ID = VN.Idle;
      const b = Object.assign(ID.newBuilding(), { id: 'bk', name: 'Bäckerei', unlockBy: 'action', costs: [], prods: [{ cur: 'g', amount: 1 }] });
      pp.idle.buildings.push(b);
      const rsB = VN.newRunState();
      ok(ID.status(rsB, b) === 'locked', 'Aufbau: Gebäude „durch Aktion“ ist von Anfang an frei');
      ok(ID.issues().some((x) => /Bäckerei/.test(x.text)), 'Aufbau: fehlende Freischalt-Aktion wird nicht gemeldet');
      VN.applyActions([{ type: 'idleUnlock', building: 'bk', build: true }], rsB, 't');
      ok(ID.level(rsB, b) === 1 && ID.status(rsB, b) !== 'locked', 'Aufbau: „Gebäude freischalten“ wirkt nicht');
      hb.objects[0].actions.push({ type: 'idleUnlock', building: 'bk', build: true });
      ok(!ID.issues().some((x) => /Bäckerei/.test(x.text)), 'Aufbau: Freischalt-Aktion am Hub-Objekt wird nicht erkannt');
      // Umweg-Erkennung: Bedingung Geld ≥ X + Aktion Geld −X
      hb.objects.push({ id: 'o2', name: 'Haus', x: 1, y: 1, w: 5, h: 5, conds: [{ type: 'money', currency: 'g', op: '>=', amount: 50 }], actions: [{ type: 'money', currency: 'g', amount: -50 }] });
      ok(window.Connect && Connect.detours().length === 1, 'Umweg Geld prüfen + abziehen wird nicht erkannt');
      // Hilfe: alle Meldungen lassen sich sammeln
      try { Help.all(); } catch (e) { out.push('Fehlerliste stürzt ab: ' + e.message); }
    } catch (e) { out.push('0.7-Prüfung stürzt ab: ' + String(e && e.stack || e).split('\\n').slice(0, 3).join(' | ')); }
    // 0.7.4: Aufbau-Start und Takt, Hub-Dialog, Format kopieren, Galerie mit mehreren Figuren, Storyboard, Farbfilter, KI-Anleitung
    try {
      VN.project = VN.migrate({ title: 'T074', scenes: [], assets: [{ id: 'img1', kind: 'image', name: 'Bild', file: 'assets/b.png' }], vars: [{ id: 'v1', name: 'Tag', type: 'num', start: 0 }], currencies: [{ id: 'g', name: 'Gold', start: 0 }] });
      const pp = VN.project;
      pp.idle = { enabled: true, mode: 'realtime', catchup: 0, tick: 'sec', startWhen: 'cond', startConds: [{ type: 'var', var: 'v1', op: '>=', value: 1 }],
        buildings: [{ id: 'A', name: 'Hütte', max: 5, start: 1, costs: [{ cur: 'g', amount: 10 }], grow: 2, prods: [{ cur: 'g', amount: 1 }], conds: [] }], milestones: [] };
      VN.migrate(pp);
      const I = VN.Idle, r = VN.newRunState();
      { const c0 = I.cfg(); I.issues(); c0.tick = 'sec'; ok(I.cfg() === c0 && pp.idle.tick === 'sec', '0.7.5 Aufbau: Einstellungen gehen verloren (Kopie statt Original)'); }
      I.produce(r, 1);
      ok((r.money.g || 0) === 0, '0.7.4 Aufbau: produziert, obwohl er noch nicht gestartet ist');
      r.vars.v1 = 1;
      ok(I.checkStart(r) === true && I.running(r), '0.7.4 Aufbau: startet nicht, wenn die Bedingung stimmt');
      I.produce(r, 1);
      ok(r.money.g === 60, '0.7.4 Aufbau: Takt pro Sekunde falsch (' + r.money.g + ' statt 60 pro Minute)');
      pp.idle.tick = 'hour'; I.produce(r, 60);
      ok(r.money.g === 61, '0.7.4 Aufbau: Takt pro Stunde falsch (' + r.money.g + ')');
      pp.idle.startWhen = 'action'; const r2 = VN.newRunState();
      ok(!I.running(r2) && I.issues().some((x) => /nie starten/.test(x.text)), '0.7.4 Aufbau: fehlende Start-Aktion wird nicht gemeldet');
      VN.applyActions([{ type: 'idleStart' }], r2, 't');
      ok(I.running(r2), '0.7.4 Aufbau: Aktion „Aufbau starten“ wirkt nicht');
      // Hub-Dialog: Szene mit @return, über dem Hub, Kanten im Pfad
      const hub = VN.newHubScene('Hub');
      const d = VN.newHubDialog(hub);
      hub.events = hub.events || [];
      hub.events.push({ id: 'e1', trigger: 'first', mode: 'scene', scene: d.id, conds: [], lines: [] });
      ok(d.next === '@return' && d.overHub && d.tracks.dialog.length === 2, '0.7.4 Hub-Dialog: neue Szene falsch angelegt');
      ok(VN.edgesOf(hub).some((x) => x.to === d.id) && VN.edgesOf(d).some((x) => x.to === hub.id), '0.7.4 Hub-Dialog: fehlt im Pfad-Graph');
      ok(!VN.Schema.check(pp).some((x) => x.level === 'error'), '0.7.4 Hub-Dialog: Projektprüfung meldet Fehler');
      // Format kopieren
      const c1 = { id: 'c1', start: 0, len: 3, x: 20, y: 5, scale: 140, rot: 10, flip: true, styles: { glow: { on: true } }, keys: [{ beat: 1, x: 40 }] };
      const c2 = { id: 'c2', start: 2, len: 3, x: 80, scale: 100 };
      FmtCopy.copy(c1); FmtCopy.apply(c2, { pos: true, scale: true, rot: false, flip: true, look: true, trans: false, idle: false, keys: true });
      ok(c2.x === 20 && c2.scale === 140 && c2.rot == null && c2.flip === true && c2.styles.glow.on && c2.keys[0].beat === 3, '0.7.4 Format kopieren: überträgt falsch ' + JSON.stringify(c2));
      // Galerie: mehrere Figuren, Bild-Geschenk
      const a = pp.assets[0];
      VN.Extras.setGalChars(a, ['r1', 'r2']);
      ok(VN.Extras.galChars(a).join() === 'r1,r2' && a.galleryChar === 'r1', '0.7.4 Galerie: mehrere Figuren werden nicht gespeichert');
      // Storyboard wird nicht exportiert, Farbfilter, KI-Anleitung
      pp.storyboard = { items: [{ id: 'sb1', kind: 'note', x: 0, y: 0, w: 10, h: 10, text: 'x' }] };
      ok(Storyboard.cfg().items.length === 1, '0.7.4 Storyboard: Karten gehen verloren');
      const m = VN.A11y.matrix('deutan', 'fix');
      ok(m.length === 3 && m.every((row) => Math.abs(row[0] + row[1] + row[2] - 1) < 0.02) && Math.abs(m[0][0] - 1) > 0.05, '0.7.4 Farbhilfe: Matrix unplausibel (Grau bleibt nicht grau)');
      const guide = VN.AIGuide.build();
      ok(guide.includes('project.json') && guide.includes('idleStart') && guide.includes(d.id), '0.7.4 KI-Anleitung unvollständig');
      // 0.7.6: Gliederpuppen – Kinder folgen dem Eltern-Teil, IK erreicht das Ziel, Umriss
      {
        const pup = { id: 'pz', name: 'P', parts: [
          { id: 't', name: 'Torso', asset: null, parent: null, x: -50, y: 0, w: 100, h: 200, ax: 50, ay: 190, rot: 0, idle: { type: 'none' } },
          { id: 'o', name: 'Oberarm', asset: null, parent: 't', x: 40, y: 0, w: 20, h: 100, ax: 10, ay: 10, rot: 0, idle: { type: 'none' } },
          { id: 'u', name: 'Unterarm', asset: null, parent: 'o', x: 40, y: 90, w: 20, h: 100, ax: 10, ay: 10, rot: 0, idle: { type: 'none' } }] };
        pp.puppets = [pup];
        const ap = Puppet.m.ap;
        const m0 = Puppet.solve(pup, {}, null, null, 0);
        const elbow0 = ap(m0.u, 10, 10);
        ok(Math.abs(elbow0[0] - 50) < 0.01 && Math.abs(elbow0[1] - 100) < 0.01, '0.7.6 Gliederpuppe: Ruhe-Lage falsch ' + elbow0);
        const m1 = Puppet.solve(pup, { o: { r: 90, x: 0, y: 0 } }, null, null, 0);
        const elbow1 = ap(m1.u, 10, 10);
        ok(Math.abs(elbow1[0] - (-40)) < 0.5 && Math.abs(elbow1[1] - 10) < 0.5, '0.7.6 Gliederpuppe: Kind folgt dem gedrehten Eltern-Teil nicht ' + elbow1.map(Math.round));
        const pose = {};
        Puppet.ik(pup, pose, 'u', Puppet.tip(pup.parts[2]), [120, 60], { links: 2 });
        const tip = Puppet.tipWorld(pup, pose, 'u');
        ok(Math.hypot(tip[0] - 120, tip[1] - 60) < 2, '0.7.6 Gliederpuppe: IK erreicht das Ziel nicht ' + tip.map(Math.round));
        const bb = Puppet.bounds(pup);
        ok(bb.h >= 200 && bb.w >= 100, '0.7.6 Gliederpuppe: Umriss falsch');
        pup.parts[0].parent = 'u';
        Puppet.order(pup);
        ok(!pup.parts[0].parent || !pup.parts[1].parent, '0.7.6 Gliederpuppe: Kreis aus Eltern-Teilen wird nicht aufgelöst');
        // Erreichbarkeit: Orte der Weltkarte zählen als erreichbar
        const loc = VN.newHubScene('Ort'); loc.loc = { unlock: 'start' };
        pp.world = pp.world || {}; pp.world.enabled = true;
        ok(VN.reachable().has(loc.id), '0.7.6 Pfade: Ort der Weltkarte gilt als nicht erreichbar');
        pp.world.enabled = false;
      }
      // 0.8.0: Auswahl nach Wahl, Position, Ordner, Jahreszeit, Hub-Hintergrund, Ambient, Sprung-Aktion, Kopieren
      {
        ok(VN.afterPick({ afterPick: 'grey' }, {}) === 'grey' && VN.afterPick({ afterPick: 'grey' }, { afterPick: 'hide' }) === 'hide', '0.8.0 Auswahl: „Nach dem Wählen“ falsch');
        const bx = document.createElement('div'); VN.placeChoices(bx, { chX: 5 });
        ok(parseFloat(bx.style.left) >= 25, '0.8.0 Auswahl: links verschoben ragt über den Rand ' + bx.style.left);
        const by = document.createElement('div'); VN.placeChoices(by, { chY: 80, chW: 30 });
        ok(by.style.top === '80%' && by.style.width === '30%', '0.9.1 Auswahl: senkrechte Position / Breite fehlt');
        ok(App.folderOf({ file: 'assets/Bilder/Figuren/ray.png' }) === 'Bilder/Figuren' && App.folderOf({ file: 'assets/x.png' }) === '' && App.folderOf({ file: 'assets/a/b.png', folder: 'Eigen' }) === 'Eigen', '0.8.0 Ordner: Zuordnung falsch');
        pp.time = Object.assign(pp.time || {}, { enabled: true, seasonsOn: true, seasonDays: 2, startSeason: 0 }); VN.migrate(pp);
        const rt = { time: { day: 3, slot: 1 } };
        ok(VN.Life.season(rt) === 1, '0.8.0 Jahreszeit falsch berechnet: ' + VN.Life.season(rt));
        const h2 = VN.newHubScene('Zimmer'); h2.bg = 'img1'; h2.bgSlots = { 1: 'img1x' };
        pp.assets.push({ id: 'img1x', kind: 'image', name: 'Nacht', file: 'assets/n.png' });
        ok(VN.Life.hubBg(h2, rt) === 'img1x' && VN.Life.hubBg(h2, { time: { day: 1, slot: 0 } }) === 'img1', '0.8.0 Hub-Hintergrund je Tageszeit falsch');
        pp.time.ambient = [{ id: 'a1', asset: 'x', slot: 1, season: '', where: 'hubs', vol: 40 }];
        ok(VN.Life.ambientNow(rt, h2).length === 1 && VN.Life.ambientNow({ time: { day: 3, slot: 0 } }, h2).length === 0 && VN.Life.ambientNow(rt, { type: 'story' }).length === 0, '0.8.0 Ambient-Sounds falsch gefiltert');
        const st2 = VN.newStoryScene('Sprung'); st2.tracks.dialog = [{ id: 'gj', start: 0, len: 1, text: 'x', actions: [{ type: 'goto', scene: h2.id }] }];
        ok(VN.edgesOf(st2).some((e) => e.to === h2.id), '0.8.0 Aktion „Zu Szene oder Hub“ fehlt im Pfad-Graph');
        const st3 = VN.newStoryScene('Ziel'); st3.beats = 1;
        Story.copyClips(st2, [{ clip: st2.tracks.dialog[0], track: VN.tracksOf(st2).find((t) => t.key === 'dialog') }], 'Test');
        VN.project = pp; Story.pasteClips(st3, 0); Story.pasteClips(st3, 0);
        ok(st3.tracks.dialog.length === 2 && st3.tracks.dialog[0].id !== 'gj' && st3.tracks.dialog[1].start === 1, '0.8.0 Kopieren/Einfügen falsch');
        pp.time.enabled = false;
      }
      // 0.9.5: Hub-Ereignisse – alte „trigger“-Werte bleiben gleich
      ok(VN.evWhen({ trigger: 'cond' }) === 'cond' && VN.evRepeat({ trigger: 'always' }) === 'always' && VN.evRepeat({ trigger: 'first' }) === 'once' && VN.evRepeat({}) === 'once' && VN.evWhen({ when: 'enter', trigger: 'cond' }) === 'enter', '0.9.5 Hub-Ereignisse: Umrechnung falsch');
      // 0.9.0: Geräte (Handy/Computer) und Nachrichten über Szenen hinweg
      {
        const D = VN.Devices;
        VN.migrate(pp);
        ok(pp.devices && pp.devices.enabled === false && Array.isArray(pp.chats.threads), '0.9.0 Geräte: Grunddaten fehlen');
        pp.devices.enabled = true;
        const ph = D.newDevice('phone'), pc = D.newDevice('desktop');
        pp.devices.list = [ph, pc];
        ok(ph.apps.some((a) => a.type === 'messages') && ph.look.size === 88 && pc.look.iconShape === 'square', '0.9.0 Geräte: neues Gerät unvollständig');
        pp.vars.push({ id: 'v_rt', name: 'Route', type: 'flag', start: false });
        pp.chats.contacts = [{ id: 'c_a', name: 'Ray' }];
        pp.chats.threads = [
          { id: 't_a', name: 'A', contact: 'c_a', auto: true, conds: [], msgs: [{ id: 'm_a', from: 'them', text: 'Hi' }, { id: 'm_r', from: 'them', text: 'nur Route', conds: [{ type: 'var', var: 'v_rt', value: true }] }], replies: [{ id: 'r_a', text: 'Ja', actions: [{ type: 'setVar', var: 'v_rt', value: true }], next: 't_b' }] },
          { id: 't_b', name: 'B', contact: 'c_a', msgs: [{ id: 'm_b', from: 'them', text: 'Route jetzt da' , conds: [{ type: 'var', var: 'v_rt', value: true }] }] }];
        VN.migrate(pp);
        const rr = VN.newRunState();
        ok(D.autoCheck(rr).length === 1 && D.log(rr, 'c_a').length === 1 && D.unread(rr, 'c_a') === 1, '0.9.0 Nachrichten: automatische Zustellung / Routen-Zeile falsch');
        ok(D.autoCheck(rr).length === 0, '0.9.0 Nachrichten: doppelt zugestellt');
        ok(D.replies(rr, 'c_a').length === 1 && VN.checkConds([{ type: 'chat', thread: 't_a', state: 'open' }], rr), '0.9.0 Nachrichten: Antwort wird nicht angeboten');
        const pk = D.pickReply(rr, 'c_a', 'r_a');
        VN.applyActions(pk.reply.actions, rr, 'x');
        const nx = D.deliver(rr, pk.reply.next);
        ok(nx && nx.added.length === 1 && D.log(rr, 'c_a').length === 3 && !D.waiting(rr, 'c_a'), '0.9.0 Nachrichten: Antwort/Folge-Unterhaltung falsch');
        ok(VN.checkConds([{ type: 'chat', thread: 't_a', state: 'replied', reply: 'r_a' }], rr) && VN.checkConds([{ type: 'chat', thread: 't_b', state: 'got' }], rr) && !VN.checkConds([{ type: 'chat', thread: 't_b', state: 'read' }], rr), '0.9.0 Bedingung „💬 Nachricht“ falsch');
        D.markRead(rr, 'c_a');
        ok(VN.checkConds([{ type: 'chat', thread: 't_b', state: 'read' }], rr) && D.unreadAll(rr) === 0, '0.9.0 Nachrichten: gelesen falsch');
        const rr2 = JSON.parse(JSON.stringify(rr));
        ok(D.log(rr2, 'c_a').length === 3, '0.9.0 Nachrichten: Verlauf übersteht Speichern nicht');
        ok(VN.collectTexts().some((x) => x.id === 'm_b:text') && VN.collectTexts().some((x) => x.id === 'r_a:text'), '0.9.0 Nachrichten fehlen im Transkript');
        ok(VN.ext.actions.device && VN.ext.actions.chatSend && VN.ext.conds.chat, '0.9.0 Aktionen/Bedingung fehlen');
        const hb = document.createElement('div'); hb.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:360px'; document.body.appendChild(hb);
        const c1 = D.open(hb, { dev: ph, rs: rr, preview: true });
        ok(hb.querySelector('.dv-phone .dv-grid .dv-app[data-app=messages]'), '0.9.0 Handy: Startbildschirm fehlt');
        c1.close();
        const c2 = D.open(hb, { dev: pc, rs: rr, preview: true, app: 'messages' });
        ok(hb.querySelector('.dv-desk .dv-win .dv-crow') && hb.querySelectorAll('.dv-desk .dv-msg').length === 3, '0.9.0 Computer: Nachrichten-Fenster falsch');
        c2.close(); hb.remove();
        // 0.9.4: Aktionen beim Lesen einer Nachricht (einmal)
        pp.chats.threads.push({ id: 't_ra', name: 'RA', contact: 'c_a', msgs: [{ id: 'm_ra', from: 'them', text: 'Tipp', actions: [{ type: 'setVar', var: 'v_rt', value: false }] }] });
        VN.migrate(pp); D.deliver(rr, 't_ra');
        ok(D.readActions(rr, 'c_a').length === 0, '0.9.4 Aktion läuft schon vor dem Lesen');
        D.markRead(rr, 'c_a', ph);
        ok(D.readActions(rr, 'c_a').length === 1 && D.readActions(rr, 'c_a').length === 0, '0.9.4 Aktion beim Lesen nicht genau einmal');
        // 0.9.3: Unterhaltung nur für den Computer
        pp.chats.threads.push({ id: 't_pc', name: 'PC', contact: 'c_a', devs: [pc.id], msgs: [{ id: 'm_pc', from: 'them', text: 'nur am PC' }], replies: [{ id: 'r_pc', text: 'ok' }] });
        VN.migrate(pp);
        D.deliver(rr, 't_pc');
        ok(D.unread(rr, 'c_a', pc) === 1 && D.unread(rr, 'c_a', ph) === 0 && !D.waiting(rr, 'c_a', ph) && D.waiting(rr, 'c_a', pc) === 't_pc', '0.9.3 Nachrichten: nur-PC-Unterhaltung erscheint auf dem Handy');
        D.markRead(rr, 'c_a', ph);
        ok(D.unread(rr, 'c_a', pc) === 1, '0.9.3 Nachrichten: Lesen am Handy markiert PC-Nachricht als gelesen');
        ok(!VN.checkConds([{ type: 'chat', thread: 't_pc', state: 'read' }], rr), '0.9.3 Bedingung gelesen falsch');
        D.markRead(rr, 'c_a', pc);
        ok(D.unreadAll(rr, pc) === 0 && VN.checkConds([{ type: 'chat', thread: 't_pc', state: 'read' }], rr), '0.9.3 Nachrichten: am PC gelesen falsch');
        const hb2 = document.createElement('div'); hb2.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:360px'; document.body.appendChild(hb2);
        const c3 = D.open(hb2, { dev: ph, rs: rr, preview: true, app: 'messages', contact: 'c_a' });
        ok(![...hb2.querySelectorAll('.dv-msg')].some((x) => /nur am PC/.test(x.textContent)) && !hb2.querySelector('.dv-reply'), '0.9.3 Handy zeigt PC-Nachricht');
        c3.close(); hb2.remove();
        // 0.9.3: stille Unterhaltung, Gerätesperre
        pp.chats.threads.push({ id: 't_q', name: 'Q', contact: 'c_a', silent: true, msgs: [{ id: 'm_q', from: 'them', text: 'versteckt' }] });
        VN.migrate(pp);
        const nq = D.unreadAll(rr, pc); D.deliver(rr, 't_q');
        ok(D.unreadAll(rr, pc) === nq && D.log(rr, 'c_a').some((e) => e.th === 't_q'), '0.9.3 stille Nachricht zählt als ungelesen oder fehlt');
        pc.lock = { on: true, code: '4711', mode: 'once', hint: '', title: '' };
        ok(D.locked(pc, rr) && !VN.checkConds([{ type: 'devOpen', device: pc.id }], rr), '0.9.3 Sperre: Gerät nicht gesperrt');
        VN.applyActions([{ type: 'devUnlock', device: pc.id }], rr, 'x');
        ok(!D.locked(pc, rr) && VN.checkConds([{ type: 'devOpen', device: pc.id }], rr), '0.9.3 Sperre: Entsperren wirkt nicht');
        pc.lock.mode = 'always';
        ok(D.locked(pc, rr), '0.9.3 Sperre: „jedes Mal“ bleibt nicht gesperrt');
        const hb3 = document.createElement('div'); hb3.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:360px'; document.body.appendChild(hb3);
        const c4 = D.open(hb3, { dev: pc, rs: rr, preview: true });
        ok(hb3.querySelectorAll('.dv-pin-key').length === 11 && !hb3.querySelector('.dv-icons .dv-app'), '0.9.3 Sperrbildschirm fehlt');
        c4.close(); hb3.remove(); pc.lock.on = false;
        pp.chats.threads.push({ id: 't_c', name: 'C', contact: 'nix', msgs: [], replies: [] });
        ok(D.issues().some((x) => /keinen Kontakt/.test(x.text)), '0.9.0 Prüfung: Unterhaltung ohne Kontakt nicht gemeldet');
        pp.devices.enabled = false;
      }
    } catch (e) { out.push('0.7.4-Prüfung stürzt ab: ' + String(e && e.stack || e).split('\\n').slice(0, 3).join(' | ')); }
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
        for (const v of ['menu', 'transcript', 'storyboard', 'figures', 'anim']) await tryIt('Ansicht ' + v, () => { VN.ui.view = v; });
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
      for (const v of ['scene', 'graph', 'systems', 'menu', 'design', 'transcript', 'storyboard', 'figures', 'anim']) { VN.ui.view = v; VN.render(); await new Promise((r) => setTimeout(r, 80)); scan(); }
      VN.ui.view = 'scene'; VN.render();
      return JSON.stringify([...found]);
    })()`));
    await js(`VN.I18n.set('de'); 1`);
    log(`${left.length ? '!' : '✓'} Englische Oberfläche: ${left.length} Stellen mit deutschen Wörtern (Projektinhalte können dabei sein)`);
    for (const l of left.slice(0, Number(process.env.VN_LEFT_MAX) || 15)) log('    · ' + l);
  }

  // 6b. Spanische und japanische Oberfläche: alle Ansichten bauen sich fehlerfrei auf und sind übersetzt
  if (lastRich) {
    for (const [l, want] of [['es', 'Probar escena'], ['ja', 'シーンをテスト']]) {
      const r = JSON.parse(await js(`(async () => {
        const err = [];
        VN.I18n.set(${JSON.stringify(l)}); await new Promise((r) => setTimeout(r, 150));
        for (const v of ['scene', 'graph', 'systems', 'menu', 'design', 'transcript', 'storyboard', 'figures', 'anim']) { try { VN.ui.view = v; VN.render(); } catch (e) { err.push(v + ': ' + e.message); } await new Promise((r) => setTimeout(r, 60)); }
        VN.ui.view = 'scene'; VN.render(); await new Promise((r) => setTimeout(r, 100));
        const btn = document.getElementById('b-play-scene').textContent;
        const t = VN.t('Neues Projekt');
        VN.I18n.set('de');
        return JSON.stringify({ err, btn, t });
      })()`));
      if (r.err.length || !r.btn.includes(want)) general.push(`Oberfläche ${l}: ` + (r.err.join('; ') || 'Knopf „' + r.btn + '“'));
      else log(`✓ Oberfläche ${l}: alle Ansichten, „${r.btn.trim()}“, ${r.t}`);
    }
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

  // 8. Gepackte Spieldateien (0.9.7): Paket enthält Projekt und alle Dateien, nichts liegt offen, Inhalt stimmt
  try {
    const VNPak = require('../renderer/js/vnpak.js');
    const proj = JSON.parse(await js('JSON.stringify(VN.project)'));
    proj.export = Object.assign({}, proj.export || {}, { pack: 'pack' });
    const pdir = JSON.parse(await js('JSON.stringify(VN.dir)'));
    // Eine echte Datei (auch in einem Unterordner mit Umlaut), damit das Paket sicher Inhalt hat
    const testRel = 'assets/Bilder Ä/__pak_test.png';
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    fs.mkdirSync(path.join(pdir, 'assets', 'Bilder Ä'), { recursive: true });
    fs.writeFileSync(path.join(pdir, testRel), png);
    proj.assets = (proj.assets || []).concat([{ id: '__paktest', name: '__pak_test', kind: 'image', file: testRel }]);
    const dest = path.join(tmpRoot, 'webpak');
    await exportWebTo(dest, proj);
    const pak = VNPak.openInMemory(new Uint8Array(fs.readFileSync(path.join(dest, 'data.vnpak'))));
    const html = fs.readFileSync(path.join(dest, 'index.html'), 'utf8');
    // Nur Dateien, die es im Projekt wirklich gibt (alte Testprojekte enthalten Verweise auf fehlende Dateien)
    const rels = [...new Set((proj.assets || []).map((a) => a.file).filter(Boolean))].filter((r) => fs.existsSync(path.join(pdir, r)));
    const missing = rels.filter((r) => !pak.files[r]);
    const open = rels.filter((r) => fs.existsSync(path.join(dest, r)));
    const raw = fs.readFileSync(path.join(dest, 'data.vnpak')).toString('latin1');
    const leak = proj.title && proj.title.length > 3 && raw.includes(proj.title);
    const errs = [];
    if (pak.project.title !== proj.title) errs.push('Projekt im Paket falsch');
    if (!pak.files[testRel] || Buffer.compare(Buffer.from(pak.files[testRel]), png) !== 0) errs.push('Testdatei im Paket falsch');
    if (missing.length) errs.push(missing.length + ' Dateien fehlen im Paket');
    if (open.length) errs.push(open.length + ' Dateien liegen offen');
    if (leak) errs.push('Klartext im Paket');
    if (fs.existsSync(path.join(dest, 'engine', 'game-data.js')) || !html.includes('startPacked')) errs.push('index.html/game-data.js');
    if (errs.length) general.push('Gepackt: ' + errs.join(', '));
    else log('✓ Gepackte Spieldateien: ' + rels.length + ' Dateien verschlüsselt in data.vnpak');
    try { fs.rmSync(path.join(pdir, 'assets', 'Bilder Ä'), { recursive: true, force: true }); } catch (e) { /* egal */ }
  } catch (e) { general.push('Gepackt: ' + e.message); }

  // 9. Figuren (0.9.8): Puppen-Vorlage „Mensch“, feste Gelenke, Ebenen-Figur mit Bones
  try {
    const r = JSON.parse(await js(`(async () => {
      const p = VN.project, out = [];
      const keepP = p.puppets, keepF = p.figures;
      p.puppets = [];
      PupEd.newFromTemplate();
      const pup = p.puppets[0];
      if (!pup || pup.parts.length !== 14) out.push('Vorlage: ' + (pup ? pup.parts.length : 0) + ' Teile');
      else {
        const ua = pup.parts.find((x) => x.slot === 'Unterarm L'), oa = pup.parts.find((x) => x.slot === 'Oberarm L');
        const pose = { [oa.id]: { r: 60 }, [ua.id]: { r: 30, x: 50, y: 50 } };
        const m = Puppet.solve(pup, pose, 1.3, {}, 0.016);
        const elbow = Puppet.m.ap(m[oa.id], oa.ax + (ua.x + ua.ax - oa.x - oa.ax), oa.ay + (ua.y + ua.ay - oa.y - oa.ay));
        const pin = Puppet.m.ap(m[ua.id], ua.ax, ua.ay);
        if (Math.hypot(elbow[0] - pin[0], elbow[1] - pin[1]) > 0.5) out.push('Gelenk nicht fest');
        // Puppenspiel: Füße festgepinnt, Körper runter = Knie beugen, Füße bleiben; Körper hoch = bleibt stehen
        const P = (n) => pup.parts.find((x) => x.slot === n);
        const pins = [P('Fuß L').id, P('Fuß R').id], fixed = {};
        for (const id of pins) fixed[id] = Puppet.tipWorld(pup, {}, id);
        const down = Puppet.moveBody(pup, {}, P('Torso').id, { x: 0, y: 200 }, pins, fixed);
        const err = Math.max(...pins.map((id) => { const t = Puppet.tipWorld(pup, down, id); return Math.hypot(t[0] - fixed[id][0], t[1] - fixed[id][1]); }));
        if (Math.abs(down[P('Torso').id].y - 200) > 2 || err > 1) out.push('Puppenspiel runter: ' + Math.round(down[P('Torso').id].y) + '/' + Math.round(err));
        const kl = (down[P('Unterschenkel L').id] || {}).r || 0, lim = Puppet.lim(P('Unterschenkel L'));
        if (!lim || kl < lim[0] - 0.1 || kl > lim[1] + 0.1 || Math.abs(kl) < 20) out.push('Knie: ' + Math.round(kl));
        const up = Puppet.moveBody(pup, {}, P('Torso').id, { x: 0, y: -250 }, pins, fixed);
        if (Math.abs(up[P('Torso').id].y) > 3) out.push('Puppenspiel hoch: ' + Math.round(up[P('Torso').id].y));
      }
      p.puppets = keepP;
      // Ebenen-Figur: Bones des untersten Bildes mit Bones
      const img = p.assets.find((a) => a.kind === 'image');
      if (img) {
        const hadRig = p.rigs[img.id];
        p.rigs[img.id] = p.rigs[img.id] || { bones: [{ id: 'b1', name: 'x', parent: null, hx: 0.5, hy: 0.9, tx: 0.5, ty: 0.1 }], pins: [], global: {} };
        p.figures = [{ id: '__f', name: 'T', layers: [{ id: 'l1', name: 'A', options: [{ id: 'o1', asset: img.id }] }, { id: 'l2', name: 'B', options: [{ id: 'o2', asset: img.id }] }] }];
        const clip = { set: '__f', pick: {}, start: 0, len: 1, x: 50 };
        if (Stage.figureRigBase(clip, 0) !== img.id) out.push('Bones-Basis nicht gefunden');
        const box = document.createElement('div');
        const node = Stage.figureEl(clip, 0, null, box);
        if (!node.classList.contains('rig-canvas')) out.push('keine Bones-Leinwand');
        if (hadRig) p.rigs[img.id] = hadRig; else delete p.rigs[img.id];
      }
      p.figures = keepF;
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Figuren: ' + r.join(', '));
    else log('✓ Figuren: Puppen-Vorlage, feste Gelenke, Puppenspiel mit Pins, Ebenen-Figur mit Bones');
  } catch (e) { general.push('Figuren: ' + e.message); }

  // 10. Licht (0.9.9): Lichtform, Ebenen in der Spielwelt, Kantenlicht-Filter auf einer Figur
  try {
    const r = JSON.parse(await js(`(async () => {
      const out = [];
      const s = Light.defaults('spot'); s.id = 't1'; s.lx = 50; s.ly = 0; s.lAngle = 90;
      const G = Light.geom(s, 16 / 9);
      if (!(G.I(16 / 9 / 2, 0.5) > 0.3)) out.push('Kegel unten zu dunkel');
      if (!(G.I(0.05, 0.5) < 0.01)) out.push('Kegel zu breit');
      const n = Light.defaults('neon'); n.id = 't2';
      const Gn = Light.geom(n, 16 / 9);
      if (!(Gn.haze(Gn.X0 + 0.02, Gn.Y0) > 0.8)) out.push('Röhre unsichtbar');
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:360px';
      const chars = document.createElement('div'); chars.className = 'chars-box'; host.appendChild(chars);
      const fig = document.createElement('div'); fig.style.cssText = 'position:absolute;left:280px;top:100px;width:80px;height:220px';
      const inner = document.createElement('canvas'); inner.width = 80; inner.height = 220; inner.style.cssText = 'width:80px;height:220px;display:block';
      fig.appendChild(inner); chars.appendChild(fig);
      const front = document.createElement('div'); host.appendChild(front);
      document.body.appendChild(host);
      const b = Light.defaults('back'); b.id = 't3'; b.lx = 50; b.ly = 55;
      Light.sync(host, [s, b], { back: chars, front, figs: () => [[inner, false]] });
      await new Promise((ok) => setTimeout(ok, 120));
      if (host.querySelectorAll('.light-l').length < 4) out.push('Lichtebenen fehlen: ' + host.querySelectorAll('.light-l').length);
      if (!host.querySelector('.light-dim')) out.push('keine Abdunklung');
      const order = Array.from(host.children);
      const back = host.querySelector('.light-l[data-light="t3"]'), spot = host.querySelector('.light-l[data-light="t1"]');
      if (!(order.indexOf(back) < order.indexOf(chars) && order.indexOf(spot) > order.indexOf(chars))) out.push('Reihenfolge falsch');
      if (!/url\\(/.test(inner.style.filter)) out.push('kein Figuren-Filter');
      Light.sync(host, [], { figs: () => [[inner, false]] });
      if (host.querySelectorAll('.light-l').length) out.push('Lichter bleiben übrig');
      if (/url\\(/.test(inner.style.filter)) out.push('Filter bleibt');
      // Bildrate (0.9.9): bei 12 Bildern/s nur 12 neue Bilder pro Sekunde, Figur erbt vom Projekt
      const keepFps = VN.project.animFps; VN.project.animFps = 12;
      const o = {}; let nf = 0; for (let t = 0; t < 1; t += 1 / 60) if (VN.fpsStep(o, t, VN.clipFps({}))) nf++;
      if (nf !== 12) out.push('Bildrate: ' + nf + ' statt 12 Bilder');
      if (VN.clipFps({ fps: 0 }) !== 0 || VN.clipFps({ fps: 8 }) !== 8) out.push('Bildrate der Figur');
      if (keepFps) VN.project.animFps = keepFps; else delete VN.project.animFps;
      // Smear-Bilder (0.9.9): schneller Punkt wird erkannt, langsamer nicht; Bild landet hinter der Figur
      const cfg = Smear.cfgFor({ on: true, multi: true, stretch: true, lines: true, sens: 50 }), st = {};
      Smear.fast(st, [['a', 100, 100, 20], ['b', 50, 300, 20]], 0, 400, cfg, false);
      const f = Smear.fast(st, [['a', 300, 100, 20], ['b', 51, 300, 20]], 0.1, 400, cfg, false);
      if (f.length !== 1 || f[0].x !== 300) out.push('Smear erkennt ' + f.length + ' Punkte');
      const scv = document.createElement('canvas'); scv.width = 400; scv.height = 400;
      const sg = scv.getContext('2d'); sg.fillStyle = '#f00'; sg.fillRect(290, 90, 20, 20);
      const st2 = {}; Smear.inPlace(scv, st2, [['a', 100, 100, 20]], 0, 400, cfg, false); Smear.inPlace(scv, st2, [['a', 300, 100, 20]], 0.1, 400, cfg, false);
      if (!(sg.getImageData(200, 100, 1, 1).data[3] > 0)) out.push('Smear-Bild fehlt');
      if (!Smear.marked({ dur: 2, smearAt: [0.5] }, 0.45, 0.55) || Smear.marked({ dur: 2, smearAt: [0.5] }, 0.6, 0.7)) out.push('Smear von Hand');
      host.remove();
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Licht: ' + r.join(', '));
    else log('✓ Licht: Scheinwerfer, Neon, Gegenlicht, Reihenfolge der Ebenen, Kantenlicht auf Figuren, Bildrate, Smear-Bilder');
  } catch (e) { general.push('Licht: ' + e.message); }

  // 11. Orte (0.9.10): frei per Bedingung, gesperrt solange …, gesperrt und weg
  try {
    const r = JSON.parse(await js(`(() => {
      const p = VN.project, W = VN.World, out = [];
      const keep = { scenes: p.scenes.slice(), vars: p.vars.slice(), world: JSON.parse(JSON.stringify(p.world || {})) };
      p.vars.push({ id: '__f', name: 'Test', type: 'flag', start: false }, { id: '__n', name: 'Nacht', type: 'flag', start: false });
      const mk = (name, loc) => { const s = VN.newHubScene(name); s.loc = loc; return s; };
      const A = mk('A', { unlock: 'cond', unlockConds: [{ type: 'var', var: '__f', value: true }], whenLocked: 'hidden' });
      const B = mk('B', { unlock: 'start', whenLocked: 'visible', lockMode: 'lock', lockConds: [{ type: 'var', var: '__n', value: true }] });
      const C = mk('C', { unlock: 'start', whenLocked: 'visible', lockMode: 'gone', lockConds: [{ type: 'var', var: '__f', value: true }] });
      const D = mk('D', { unlock: 'start', whenLocked: 'visible' });
      const rs = { vars: { __f: false, __n: false }, seen: {}, items: {}, money: {} };
      if (W.status(rs, A.id) !== 'hidden') out.push('A sollte versteckt sein');
      rs.vars.__f = true;
      if (W.status(rs, A.id) !== 'open') out.push('A sollte frei sein');
      rs.vars.__f = false;
      if (W.status(rs, A.id) !== 'open') out.push('A sollte frei bleiben');
      rs.vars.__n = true;
      if (W.status(rs, B.id) !== 'locked') out.push('B sollte nachts gesperrt sein');
      rs.vars.__n = false;
      if (W.status(rs, B.id) !== 'open') out.push('B sollte wieder frei sein');
      rs.vars.__f = true;
      if (W.status(rs, C.id) !== 'hidden') out.push('C sollte weg sein');
      rs.vars.__f = false;
      VN.ext.actions.unlockLoc.apply({ scene: C.id, value: true }, rs);
      if (W.status(rs, C.id) !== 'hidden') out.push('C kommt zurück');
      VN.ext.actions.unlockLoc.apply({ scene: D.id, value: 'gone' }, rs);
      if (W.status(rs, D.id) !== 'hidden' || W.unlocked(rs, D.id)) out.push('D per Aktion nicht weg');
      p.scenes = keep.scenes; p.vars = keep.vars; p.world = keep.world;
      // Doppelklick selbst erkannt (0.9.12): zweiter Klick am selben Teil kurz danach = doppelt, anderes Teil nicht
      VN._dbl = null;
      const ev = { clientX: 100, clientY: 100 };
      if (VN.isDouble(ev, 'a') || !VN.isDouble(ev, 'a')) out.push('Doppelklick nicht erkannt');
      if (VN.isDouble(ev, 'a') || VN.isDouble(ev, 'b')) out.push('Doppelklick falsch erkannt');
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Orte: ' + r.join(', '));
    else log('✓ Orte: frei per Bedingung, gesperrt solange …, gesperrt und weg (auch per Aktion); Doppelklick zum Festpinnen');
  } catch (e) { general.push('Orte: ' + e.message); }

  // 12. Nähte (0.9.12): Gewichte an der Naht, verformtes Zeichnen, Naht an eine andere Figur
  try {
    const r = JSON.parse(await js(`(() => {
      const out = [], P = Puppet;
      const A = Object.assign(P.newPart(null, 200, 260, 0, 0), { id: 'tA', name: 'Torso', ax: 100, ay: 130 });
      const B = Object.assign(P.newPart(null, 90, 240, 55, 200), { id: 'tB', name: 'Bein', parent: 'tA', ax: 45, ay: 40, seams: [{ id: 's1', to: 'tA', pts: [[0, 30], [90, 30]], soft: 60 }] });
      const pup = { id: 'tp', parts: [A, B] };
      const rest = P.solve(pup, null, null, null, 0);
      const mesh = P.seamMesh(pup, B, rest);
      if (!mesh) out.push('kein Gitter');
      else {
        const top = mesh.vs.find((v) => v.iv === 0), mid = mesh.vs.find((v) => Math.abs(v.iv - 30) < 15 && v.iu > 30 && v.iu < 60), bot = mesh.vs[mesh.vs.length - 1];
        if (!(top.ws[0].w === 1)) out.push('oberhalb der Naht nicht fest: ' + top.ws[0].w);
        if (!(mid.ws[0].w > 0.6)) out.push('an der Naht zu schwach: ' + mid.ws[0].w);
        if (!(bot.ws[0].w === 0)) out.push('unten nicht frei: ' + bot.ws[0].w);
      }
      // Zeichnen mit Bild: das Bein dreht sich, die Naht bleibt am Torso
      const im = document.createElement('canvas'); im.width = 90; im.height = 240; const g = im.getContext('2d'); g.fillStyle = '#00f'; g.fillRect(0, 0, 90, 240);
      const cv = document.createElement('canvas'); cv.width = 600; cv.height = 600; const ctx = cv.getContext('2d');
      const res = { imgs: { tB: im }, rigs: {} };
      P.draw(ctx, pup, res, [1, 0, 0, 1, 200, 100], null, 0, { tB: { r: 60 } }, {});
      const M = rest.tB; const p0 = P.m.ap(M, 45, 10);
      const px = ctx.getImageData(Math.round(p0[0] + 200), Math.round(p0[1] + 100), 1, 1).data;
      if (!(px[2] > 200 && px[3] > 200)) out.push('Naht-Stelle nicht mehr am Torso');
      // Naht an eine andere Figur: Ziel-Matrix verschoben → Bein-Oberkante wandert mit
      const pup2 = { id: 'tq', parts: [Object.assign({}, B, { seams: [] })] };
      const cv2 = document.createElement('canvas'); cv2.width = 600; cv2.height = 600; const c2 = cv2.getContext('2d');
      const rel = [1, 0, 0, 1, 0, 0];
      P.draw(c2, pup2, res, [1, 0, 0, 1, 100, 100], null, 0, {}, {}, { extSeams: [{ id: 'x1', part: 'tB', pts: [[0, 30], [90, 30]], soft: 60, rel }], ext: { x1: [1, 0, 0, 1, 250, 100] } });
      const q = c2.getImageData(250 + 45, 100 + 5, 1, 1).data;
      if (!(q[2] > 200 && q[3] > 200)) out.push('Naht an andere Figur folgt nicht');
      // Haftpunkt (0.9.13): Stelle wird an einen festen Punkt gezogen (Dehnen), weit weg bleibt das Bild, wo es war
      const pup4 = { id: 't4', parts: [Object.assign({}, B, { seams: [], holdPts: [{ id: 'hp1', u: 45, v: 220, soft: 40 }] })] };
      const cv4 = document.createElement('canvas'); cv4.width = 600; cv4.height = 600; const c4 = cv4.getContext('2d');
      const M4 = P.solve(pup4, null, null, null, 0).tB, h0 = P.m.ap(M4, 45, 220);
      P.draw(c4, pup4, res, [1, 0, 0, 1, 100, 100], null, 0, {}, {}, { holds: [{ id: 'hp1', part: 'tB', u: 45, v: 220, soft: 40, x: h0[0] + 100 + 80, y: h0[1] + 100 }] });
      const hpx = c4.getImageData(Math.round(h0[0] + 100 + 80), Math.round(h0[1] + 100), 1, 1).data;
      if (!(hpx[2] > 200 && hpx[3] > 200)) out.push('Haftpunkt zieht nicht');
      // Naht als Gelenk (0.9.13): Teil ohne Eltern hängt danach am Ziel, Pin auf der Mitte der Naht, Bild bleibt an seinem Platz
      const L2 = Object.assign(P.newPart(null, 90, 240, 30, 220), { id: 'tL', ax: 45, ay: 150 });
      const pup3 = { id: 't3', parts: [Object.assign({}, A), L2] };
      const before = P.rest(L2).slice();
      const s3 = { id: 's3', to: 'tA', pts: [[0, 30], [90, 30]], soft: 60 };
      if (!PupEd.seamJoint(pup3, L2, s3)) out.push('Naht-Gelenk nicht gesetzt');
      if (L2.parent !== 'tA' || Math.abs(L2.ax - 45) > 0.2 || Math.abs(L2.ay - 30) > 0.2) out.push('Gelenk nicht auf der Naht: ' + L2.ax + '/' + L2.ay);
      if (P.rest(L2).some((n, i) => Math.abs(n - before[i]) > 0.01)) out.push('Teil verrutscht beim Gelenk-Setzen');
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Nähte: ' + r.join(', '));
    else log('✓ Nähte: Gewichte, verformtes Zeichnen, Naht an eine andere Figur');
  } catch (e) { general.push('Nähte: ' + e.message); }

  // 13. Gitter bearbeiten (0.9.14): Kästchen hinzufügen/entfernen ändert das Bones-Gitter
  try {
    // Testbild mit Bones anlegen (Rechteck in der Mitte, Rand durchsichtig)
    const png = await js(`(() => { const c = document.createElement('canvas'); c.width = 120; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#c47'; g.fillRect(30, 20, 60, 160); return c.toDataURL('image/png').split(',')[1]; })()`);
    const pd = JSON.parse(await js('JSON.stringify(VN.dir)'));
    fs.writeFileSync(path.join(pd, 'assets', 'gittertest.png'), Buffer.from(png, 'base64'));
    await js(`(() => { const a = VN.registerAssets([{ name: 'gittertest', kind: 'image', file: 'assets/gittertest.png' }])[0]; VN.project.rigs[a.id] = { bones: [{ id: 'b1', name: 'x', parent: null, hx: 0.5, hy: 0.9, tx: 0.5, ty: 0.1 }], pins: [], global: {}, grid: 20 }; return 1; })()`);
    const r = JSON.parse(await js(`(async () => {
      const out = [], p = VN.project;
      let id = null, m0 = null;
      for (const k of Object.keys(p.rigs)) { if (!p.assets.some((x) => x.id === k)) continue; const keep0 = p.rigs[k].cellEdit; delete p.rigs[k].cellEdit; try { m0 = (await Rig.mesh(k)).mesh; id = k; } catch (e) { m0 = null; } if (keep0) p.rigs[k].cellEdit = keep0; if (m0) break; }
      if (!id || !m0) return JSON.stringify(['SKIP']);
      const rig = p.rigs[id], keep = rig.cellEdit;
      delete rig.cellEdit;
      const C = m0.cells;
      const free = C.auto.findIndex((x) => !x), full = C.auto.findIndex((x) => x);
      rig.cellEdit = { nx: C.nx, ny: C.ny, add: [free], del: [] };
      const m1 = (await Rig.mesh(id)).mesh;
      if (m1.idx.length !== m0.idx.length + 6) out.push('Hinzufügen: ' + (m1.idx.length - m0.idx.length));
      rig.cellEdit = { nx: C.nx, ny: C.ny, add: [], del: [full] };
      const m2 = (await Rig.mesh(id)).mesh;
      if (m2.idx.length !== m0.idx.length - 6) out.push('Entfernen: ' + (m2.idx.length - m0.idx.length));
      rig.cellEdit = { nx: C.nx + 1, ny: C.ny, add: [free], del: [] };
      const m3 = (await Rig.mesh(id)).mesh;
      if (m3.idx.length !== m0.idx.length) out.push('Falsche Gitter-Feinheit nicht ignoriert');
      if (keep) rig.cellEdit = keep; else delete rig.cellEdit;
      return JSON.stringify(out);
    })()`));
    if (r[0] === 'SKIP') log('– Gitter bearbeiten: kein Bild mit Bones im Testprojekt, übersprungen');
    else if (r.length) general.push('Gitter: ' + r.join(', '));
    else log('✓ Gitter bearbeiten: Kästchen hinzufügen und entfernen');
  } catch (e) { general.push('Gitter: ' + e.message); }

  // 14. Inpaint-Stift (0.9.15): Lücke füllen mit Verlauf, fester Farbe und Verlauf A → B
  try {
    const r = JSON.parse(await js(`(() => {
      const out = [], W = 60, H = 40;
      const mk = () => { const data = new Uint8ClampedArray(W * H * 4); for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) { const q = (y * W + x) * 4; const left = x < 30; data[q] = left ? 200 : 40; data[q + 1] = 60; data[q + 2] = left ? 40 : 200; data[q + 3] = 255; } return { data, width: W, height: H }; };
      const hole = (img) => { const m = new Uint8Array(W * H); for (let y = 10; y < 30; y++) for (let x = 20; x < 40; x++) { m[y * W + x] = 255; img.data[(y * W + x) * 4 + 3] = 0; } return m; };
      const px = (img, x, y) => Array.from(img.data.slice((y * W + x) * 4, (y * W + x) * 4 + 4));
      let a = mk(), m = hole(a);
      let res = Inpaint.run(a, m, { mode: 'auto', soft: 50 });
      if (!res.ok) out.push('Verlauf: nicht gefüllt');
      for (let y = 10; y < 30; y++) for (let x = 20; x < 40; x++) if (a.data[(y * W + x) * 4 + 3] !== 255) { out.push('Loch nicht ganz deckend'); y = 99; break; }
      const L = px(a, 22, 20), M = px(a, 30, 20), R = px(a, 37, 20);
      if (!(L[0] > M[0] && M[0] > R[0] && L[2] < M[2] && M[2] < R[2])) out.push('Kein Verlauf von links nach rechts: ' + [L, M, R].join(' | '));
      if (px(a, 5, 5)[0] !== 200 || px(a, 55, 5)[2] !== 200) out.push('Bild außerhalb der Maske verändert');
      a = mk(); m = hole(a);
      Inpaint.run(a, m, { mode: 'color', color: [1, 2, 3], soft: 0 });
      if (px(a, 30, 20).join() !== '1,2,3,255') out.push('Feste Farbe: ' + px(a, 30, 20));
      a = mk(); m = hole(a);
      Inpaint.run(a, m, { mode: 'grad', a: { x: 20, y: 20, c: [0, 0, 0] }, b: { x: 40, y: 20, c: [200, 200, 200] }, soft: 0 });
      if (Math.abs(px(a, 30, 20)[0] - 100) > 3) out.push('Verlauf A → B: ' + px(a, 30, 20));
      // Dunkler Umriss neben der Lücke darf die Füllung nicht verschmutzen
      a = mk(); for (let i = 0; i < W * H; i++) { const q = i * 4; a.data[q] = 220; a.data[q + 1] = 180; a.data[q + 2] = 150; }
      m = hole(a);
      for (let x = 0; x < W; x++) for (const y of [9, 30]) { const q = (y * W + x) * 4; a.data[q] = a.data[q + 1] = a.data[q + 2] = 10; }
      Inpaint.run(a, m, { mode: 'auto', soft: 50 });
      if (px(a, 30, 12)[0] < 200) out.push('Umriss färbt die Füllung: ' + px(a, 30, 12));
      const none = new Uint8Array(W * H);
      if (Inpaint.run(mk(), none, { mode: 'auto' }).reason !== 'empty') out.push('Leere Maske nicht erkannt');
      const clear = { data: new Uint8ClampedArray(W * H * 4), width: W, height: H };
      if (Inpaint.run(clear, new Uint8Array(W * H).fill(255), { mode: 'auto' }).reason !== 'nosource') out.push('Fehlende Farben nicht erkannt');
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Inpaint: ' + r.join(', '));
    else log('✓ Inpaint-Stift: Verlauf, feste Farbe, Verlauf A → B, Fehlerfälle');
    // Mehr Platz am Rand: Gelenk, Haftpunkt und Naht bleiben an derselben Stelle
    const g = JSON.parse(await js(`(async () => {
      const out = [];
      const c = document.createElement('canvas'); c.width = 80; c.height = 60; c.getContext('2d').fillRect(0, 0, 80, 60);
      const bytes = new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/png'))).arrayBuffer());
      const rel = await VN.api.writeAsset(VN.dir, 'assets/randtest.png', bytes);
      const a = { id: VN.uid('a'), name: 'randtest', kind: 'image', file: rel }; VN.project.assets.push(a);
      const p = Puppet.newPart(a.id, 80, 60, 10, 20); p.rot = 30; p.tx = 50; p.ty = 40; p.holdPts = [{ id: 'h', u: 20, v: 10, soft: 60 }]; p.seams = [{ id: 's', to: 'x', pts: [[1, 2], [3, 4]], soft: 60 }];
      const pup = { id: VN.uid('pup'), name: 'Rand', parts: [p] }; VN.project.puppets = VN.project.puppets || []; VN.project.puppets.push(pup);
      const w0 = Puppet.m.ap(Puppet.rest(p), 20, 10);
      if (!(await PupEd.growPart(pup, p, 40))) out.push('nicht erweitert');
      const w1 = Puppet.m.ap(Puppet.rest(p), p.holdPts[0].u, p.holdPts[0].v);
      if (Math.hypot(w0[0] - w1[0], w0[1] - w1[1]) > 0.01) out.push('Stelle verschoben');
      if (p.w !== 160 || p.h !== 140 || p.tx !== 90 || p.seams[0].pts[0][0] !== 41) out.push('Maße falsch');
      const im = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = VN.assetUrl(p.asset); });
      if (!im || im.naturalWidth !== 160 || im.naturalHeight !== 140) out.push('Bildgröße ' + (im && im.naturalWidth));
      VN.project.puppets = VN.project.puppets.filter((x) => x !== pup);
      return JSON.stringify(out);
    })()`));
    if (g.length) general.push('Inpaint Rand: ' + g.join(', '));
    else log('✓ Inpaint-Stift: mehr Platz am Rand');
  } catch (e) { general.push('Inpaint: ' + e.message); }

  // 15. Spielhalle (Dart, Billard, Spielautomat): Zählen, Physik, Computer-Gegner, Auszahlung
  try {
    await js(fs.readFileSync(path.join(__dirname, '..', 'templates', 'spielhalle.js'), 'utf8') + '\n;1');
    const r = JSON.parse(await js(`(() => {
      const out = [], P = VNPlugin.plugins.spielhalle, I = P && P._intern;
      if (!I) return JSON.stringify(['Plugin nicht geladen']);
      ['dart', 'billard', 'automat'].forEach((k) => { if (!VNPlugin.actionDef('spielhalle.' + k)) out.push('Aktion ' + k + ' fehlt'); });
      // Dart: Zielpunkte zählen richtig
      for (const [code, want] of [['T20', 60], ['D16', 32], ['S5', 5], ['BULL', 50], ['25', 25], ['T19', 57], ['D1', 2]]) { const [x, y] = I.dartTarget(code); const s = I.dartScore(x, y); if (s.pts !== want) out.push('Dart ' + code + ' = ' + s.pts); }
      if (I.dartScore(0, -180).pts !== 0) out.push('Dart daneben');
      if (!I.dartScore(...I.dartTarget('D20')).dbl) out.push('Dart Doppel');
      if (I.aiDartAim({ taktik: 90 }, 32, 'x01', true) !== 'D16') out.push('Dart-Gegner Checkout');
      if (I.aiDartAim({ taktik: 90 }, 50, 'x01', true) !== 'BULL') out.push('Dart-Gegner Bull');
      // Billard: gerader Stoß versenkt die Kugel vor der Tasche, Kugeln bleiben auf dem Tisch
      const C = I.consts;
      const cue = { n: 0, x: 300, y: 250, vx: 1500, vy: 0, in: false }, ob = { n: 1, x: 900, y: 250, vx: 0, vy: 0, in: false };
      const tg = { n: 2, x: C.BL - 60, y: C.BW - 60, vx: 0, vy: 0, in: false };
      const balls = [cue, ob, tg], pots = [];
      const ev = { hit() {}, pot: (b) => pots.push(b.n), rail() {} };
      for (let k = 0; k < 2000 && balls.some((b) => !b.in && (b.vx || b.vy)); k++) for (let i = 0; i < 8; i++) I.physStep(balls, 1 / 480, ev);
      if (balls.some((b) => !b.in && (b.x < 0 || b.x > C.BL || b.y < 0 || b.y > C.BW))) out.push('Billard: Kugel außerhalb');
      if (balls.some((b) => b.vx || b.vy)) out.push('Billard: Kugeln rollen ewig');
      const cb = { n: 0, x: C.BL - 300, y: C.BW - 300, in: false }; const sh = I.aiShot([cb, { n: 1, x: C.BL - 120, y: C.BW - 120, in: false }], cb, (b) => b.n > 0, { taktik: 100 });
      if (!sh || Math.abs(sh.ang - Math.PI / 4) > 0.05) out.push('Billard-Gegner zielt falsch ' + (sh && sh.ang));
      const rk = I.rack(15, true);
      if (rk.length !== 15 || rk[4].n !== 8 || new Set(rk.map((b) => b.n)).size !== 15) out.push('8-Ball-Dreieck');
      // Automat: Auszahlung der Vorlage zwischen 80 und 100 %, Joker zählt
      VNPlugin.actionDef('spielhalle.automat').params[0].options;
      const auto = VN.project.pluginData.spielhalle.automaten[0];
      const R = I.rtp(auto, 60000);
      if (!(R.rtp > 80 && R.rtp < 100)) out.push('Automat-Auszahlung ' + R.rtp.toFixed(1));
      const jm = { walzen: 3, joker: 'j', gewinne: [{ symbol: 'a', anzahl: 3, faktor: 10 }] };
      if (I.evalSpin(jm, [['a'], ['j'], ['a']], [[0, 0, 0]]).win !== 10) out.push('Joker');
      if (I.evalSpin(jm, [['a'], ['b'], ['a']], [[0, 0, 0]]).win !== 0) out.push('Automat zählt falsch');
      if (I.lines({ walzen: 5, reihen: 3, linien: 'fuenf' }).length !== 5) out.push('Gewinnlinien');
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Spielhalle: ' + r.join(', '));
    else log('✓ Spielhalle: Dart zählt, Billard-Physik und -Gegner, Automat-Auszahlung');
  } catch (e) { general.push('Spielhalle: ' + e.message); }

  // 14. Neu in 0.9.16: GIF-Encoder, Formeln/Code, Ordner im Puppen-Modus
  try {
    const r = JSON.parse(await js(`(async () => {
      const out = [];
      // GIF: 2 Bilder 5×4, Palette mit Durchsichtig – erstes Bild zurücklesen
      const w = 5, h = 4, pal = [[0, 0, 0], [255, 0, 0], [0, 0, 255]];
      const f1 = new Uint8Array(w * h).fill(1); f1[0] = 0; f1[w * h - 1] = 2;
      const f2 = new Uint8Array(w * h).fill(2);
      const bytes = GifEnc.encode([{ px: f1, delay: 10 }, { px: f2, delay: 10 }], w, h, pal);
      if (String.fromCharCode(...bytes.slice(0, 6)) !== 'GIF89a') out.push('GIF-Kopf');
      const url = URL.createObjectURL(new Blob([bytes], { type: 'image/gif' }));
      const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
      if (!im) out.push('GIF lädt nicht');
      else {
        const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
        const d = x.getImageData(0, 0, w, h).data, px = (i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]].join(',');
        if (px(0).split(',')[3] !== '0') out.push('GIF durchsichtig ' + px(0));
        if (px(1) !== '255,0,0,255') out.push('GIF rot ' + px(1));
        if (px(w * h - 1) !== '0,0,255,255') out.push('GIF blau ' + px(w * h - 1));
      }
      // Große Fläche mit Rauschen (LZW-Wörterbuch läuft über 4096)
      const W = 120, H = 90, big = new Uint8Array(W * H); let seed = 7; for (let i = 0; i < big.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; big[i] = seed % 16; }
      const pal16 = Array.from({ length: 16 }, (_, i) => [i * 16, 255 - i * 16, (i * 37) & 255]);
      const im2 = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = URL.createObjectURL(new Blob([GifEnc.encode([{ px: big, delay: 5 }], W, H, pal16)], { type: 'image/gif' })); });
      if (!im2) out.push('großes GIF lädt nicht');
      else {
        const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(im2, 0, 0);
        const d = x.getImageData(0, 0, W, H).data; let bad = 0;
        for (let i = 1; i < big.length; i++) { const p = pal16[big[i]]; if (big[i] && (d[i * 4] !== p[0] || d[i * 4 + 1] !== p[1] || d[i * 4 + 2] !== p[2])) bad++; }
        if (bad) out.push('großes GIF: ' + bad + ' falsche Pixel');
      }
      // Formeln und Code
      const F = VN.Formula, P = VN.project;
      const saved = JSON.stringify({ vars: P.vars, items: P.items, cur: P.currencies });
      P.vars.push({ id: 'vt_gold', name: 'gold', type: 'number', start: 0, max: 50 }, { id: 'vt_reich', name: 'Ganz reich', type: 'flag', start: false });
      P.items = P.items || []; P.items.push({ id: 'it_tst', name: 'Testschlüssel' });
      const rs = { vars: { vt_gold: 8, vt_reich: false }, inv: {}, money: {}, seen: {} };
      const g = F.run('# Kommentar\\ngold += 5 * 2\\nif gold > 15 and not [Ganz reich]: [Ganz reich] = wahr\\ngive("Testschlüssel", 2)\\ngold = gold * 10', rs);
      if (rs.vars.vt_gold !== 50) out.push('Code gold ' + rs.vars.vt_gold + ' (max 50 erwartet)');
      if (rs.vars.vt_reich !== true) out.push('Code Wenn-Dann');
      if (rs.inv.it_tst !== 2 || !g.some((x) => x.kind === 'item' && x.count === 2)) out.push('Code give');
      if (!F.check('gold >= 50 und item("Testschlüssel") == 2', rs)) out.push('Formel und/item');
      if (F.check('gold < 10 oder nicht [Ganz reich]', rs)) out.push('Formel oder/nicht');
      if (F.check('kaputt ((', rs)) out.push('kaputte Formel gilt als erfüllt');
      if (!F.problem('gold >', false)) out.push('Fehler nicht erkannt');
      if (!/(Zeile|Line|Línea|行) 2/.test(F.problem('gold += 1\\nunbekannt = 3', true) || '')) out.push('Zeilennummer im Fehler');
      if (F.missingVars('gold + mut').join() !== 'mut') out.push('fehlende Variablen');
      if (!VN.checkConds([{ type: 'formula', expr: 'gold == 50' }], rs)) out.push('Bedingung „Formel“');
      const rs2 = { vars: { vt_gold: 1 }, inv: {}, money: {}, seen: {} };
      VN.applyActions([{ type: 'code', code: 'gold += 2' }], rs2, 'x');
      if (rs2.vars.vt_gold !== 3) out.push('Aktion „Code“');
      if (!VN.tracksOf({ type: 'story' }).some((t) => t.key === 'code')) out.push('Code-Spur fehlt');
      const sv = JSON.parse(saved); P.vars = sv.vars; P.items = sv.items; P.currencies = sv.cur;
      // Ordner: Teile eines Ordners liegen zusammen, ausgeblendet/gesperrt erbt sich
      const mk = (id, folder) => ({ id, folder });
      const pup = { parts: [mk('a'), mk('b', 'f1'), mk('c'), mk('d', 'f2'), mk('e', 'f1')], folders: [{ id: 'f1', name: 'Arm' }, { id: 'f2', name: 'Hand', parent: 'f1', hidden: true }] };
      PupEd.normalize(pup);
      if (pup.parts.map((p) => p.id).join('') !== 'abdec') out.push('Ordner-Reihenfolge ' + pup.parts.map((p) => p.id).join(''));
      if ([...PupEd.fFlag(pup, 'hidden')].join() !== 'd') out.push('Ordner ausgeblendet');
      pup.folders[0].locked = true;
      if ([...PupEd.fFlag(pup, 'locked')].sort().join() !== 'b,d,e') out.push('Ordner gesperrt erbt nicht');
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('0.9.16: ' + r.join(', '));
    else log('✓ GIF-Encoder, Formeln & Code-Spur, Ordner im Puppen-Modus');
  } catch (e) { general.push('0.9.16: ' + e.message); }

  const failed = results.filter((r) => r.errors.length);
  for (const g of general) log('✗ ' + g);
  log(`\n${failed.length || general.length ? 'FEHLGESCHLAGEN' : 'ALLES BESTANDEN'}: ${results.length - failed.length}/${results.length} Projekte ok${general.length ? ', ' + general.length + ' allgemeine Fehler' : ''} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) { /* egal */ }
  app.exit(failed.length || general.length ? 1 : 0);
};
