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

  // 16. Tresor, Rohre (Minispiele 1.5) und Blackjack
  try {
    await js(fs.readFileSync(path.join(__dirname, '..', 'templates', 'minispiele.js'), 'utf8') + '\n;1');
    const r = JSON.parse(await js(`(() => {
      const out = [], M = VNPlugin.plugins.minispiele, S = VNPlugin.plugins.spielhalle;
      if (!M || !M._intern) return JSON.stringify(['Minispiele nicht geladen']);
      ['tresor', 'rohre'].forEach((k) => { if (!VNPlugin.actionDef('minispiele.' + k)) out.push('Aktion ' + k + ' fehlt'); });
      // Rohre: 200 Felder – gemischt nie schon gelöst, mit den richtigen Drehungen immer lösbar
      for (let t = 0; t < 200; t++) {
        const n = 4 + (t % 5), F = M._intern.pipeField(n);
        if (F.flow().done) { out.push('Rohre schon gelöst'); break; }
        for (const c of F.cells) c.r = [0, 1, 2, 3].find((k) => F.rot(c.shape, k) === c.base);
        if (!F.flow().done) { out.push('Rohre nicht lösbar (' + n + ')'); break; }
      }
      // Blackjack: Werte und Grundstrategie
      const B = S && S._intern;
      if (!B || !B.handVal) out.push('Blackjack fehlt');
      else {
        const H = (...r) => r.map((x) => ({ r: x, s: '♠' }));
        if (B.handVal(H('A', 'K')).total !== 21) out.push('Ass + König');
        if (B.handVal(H('A', 'A', '9')).total !== 21) out.push('Ass + Ass + 9');
        if (B.handVal(H('K', 'Q', '5')).total !== 25) out.push('über 21');
        const v = B.handVal(H('A', '6')); if (v.total !== 17 || !v.soft) out.push('weiche 17');
        if (B.bjTip(H('8', '8'), { r: '10' }, true, true) !== 'teilen') out.push('Tipp 8+8');
        if (B.bjTip(H('6', '5'), { r: '6' }, true, false) !== 'verdoppeln') out.push('Tipp 11');
        if (B.bjTip(H('10', '6'), { r: '10' }, false, false) !== 'ziehen') out.push('Tipp 16 gegen 10');
        if (B.bjTip(H('10', '3'), { r: '4' }, false, false) !== 'stehen') out.push('Tipp 13 gegen 4');
        if (!VNPlugin.actionDef('spielhalle.blackjack')) out.push('Aktion blackjack fehlt');
      }
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Tresor/Rohre/Blackjack: ' + r.join(', '));
    else log('✓ Tresor, Rohre (immer lösbar) und Blackjack (Werte, Tipps)');
  } catch (e) { general.push('Tresor/Rohre/Blackjack: ' + e.message); }

  // 21. Websites: Adressen finden, Seiten, Bedingungen
  try {
    const r = JSON.parse(await js(`(() => {
      const out = [], p = VN.project, DV = VN.Devices;
      const keep = JSON.stringify({ d: p.devices, w: p.web });
      p.devices.enabled = true;
      const w = DV.newSite(); w.domain = 'gildenmarkt.ra'; w.pages.push(DV.newPage('Login'));
      p.web = { sites: [w] }; VN.migrate(p);
      if (!DV.webOn() || !DV.BUILTIN.web.on()) out.push('Browser nicht verfügbar');
      const a = DV.findPage('https://www.GildenMarkt.ra/'), b = DV.findPage('gildenmarkt.ra/login'), c = DV.findPage('gildenmarkt.ra/gibtsnicht');
      if (!a || a.page !== w.pages[0]) out.push('Startseite');
      if (!b || b.page !== w.pages[1]) out.push('Unterseite (' + JSON.stringify(w.pages.map((g) => g.path)) + ')');
      if (c) out.push('falsche Seite gefunden');
      if (DV.addrOf(w, w.pages[1]) !== 'gildenmarkt.ra/login') out.push('Adresse ' + DV.addrOf(w, w.pages[1]));
      const rs = VN.newRunState(); DV.wst(rs).visited['gildenmarkt.ra/login'] = 1; DV.wst(rs).ok.x = 1;
      if (!VN.checkConds([{ type: 'webVisited', addr: 'www.gildenmarkt.ra/login' }], rs) || !VN.checkConds([{ type: 'webUnlocked', el: 'x' }], rs)) out.push('Bedingungen');
      const t = JSON.parse(keep); p.devices = t.d; p.web = t.w; VN.migrate(p);
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Websites: ' + r.join(', '));
    else log('✓ Websites: Adressen, Unterseiten, Bedingungen');
  } catch (e) { general.push('Websites: ' + e.message); }

  // 22. Paket 1 (0.9.24): Transkript mit Apps/Websites, Mischmodus + Weichzeichner, Minispiel-Belohnung, Keyframes kopieren, Darsteller doppeln, Hub-Idle
  try {
    const r = JSON.parse(await js(`(() => {
      const out = [], p = VN.project, DV = VN.Devices;
      const keep = JSON.stringify({ d: p.devices, w: p.web, c: p.chats, s: p.social, v: p.vars, an: p.anims });
      p.devices.enabled = true;
      p.chats.contacts = [{ id: 'cT', name: 'Tess', bio: 'Hallo #welt' }];
      p.social = { name: 'Pixgram', posts: [{ id: 'spT', author: 'cT', text: 'Mein Beitrag', comments: [{ id: 'scT', author: 'cT', text: 'Kommentar' }], replies: [{ id: 'srT', text: 'Antwort' }] }] };
      const w = DV.newSite(); w.domain = 'test.ra'; p.web = { sites: [w] }; VN.migrate(p);
      const e = w.pages[0].els[0]; e.text = 'Seitentext';
      const img = DV.fixEl({ kind: 'image', blur: 8, blend: 'multiply', blurHint: 'Gesperrt', blurConds: [{ type: 'webVisited', addr: 'test.ra' }] });
      w.pages[0].els.push(img);
      const ids = new Set(VN.collectTexts().map((x) => x.id));
      for (const id of ['spT', 'scT', 'srT', 'cT:bio', 'social:name', e.id, w.id + ':name', img.id + ':hint']) if (!ids.has(id)) out.push('Transkript ohne ' + id);
      const rs = VN.newRunState();
      const st = DV.elStyle(img, 140, rs);
      if (!/blur\\(/.test(st.filter || '')) out.push('kein Weichzeichner');
      if (st.mixBlendMode !== 'multiply') out.push('Mischmodus');
      DV.wst(rs).visited['test.ra'] = 1;
      if (/blur\\(/.test(DV.elStyle(img, 140, rs).filter || '')) out.push('Weichzeichner bleibt trotz Bedingung');
      if (!/blur\\(/.test(DV.elStyle(img, 140).filter || '')) out.push('Editor zeigt nicht verschwommen');
      // Minispiel-Belohnung
      VNPlugin.plugins.tstmg = { id: 'tstmg', name: 'T', actions: { w: { minigame: true, run: () => ({ score: 1, ok: true }) }, l: { minigame: true, run: () => ({ score: 0, ok: false }) } } };
      p.vars.push({ id: 'v_rew', name: 'rew', type: 'number', value: 0 });
      const rs2 = VN.newRunState();
      VN.applyActions([{ type: 'plugin', ref: 'tstmg.w', winActs: [{ type: 'addVar', var: 'v_rew', value: 5 }], loseActs: [{ type: 'addVar', var: 'v_rew', value: 100 }] }], rs2, 'x');
      VN.applyActions([{ type: 'plugin', ref: 'tstmg.l', winActs: [{ type: 'addVar', var: 'v_rew', value: 1000 }], loseActs: [{ type: 'addVar', var: 'v_rew', value: 2 }] }], rs2, 'y');
      const got = rs2.vars ? rs2.vars.v_rew : null;
      if (got !== 7) out.push('Belohnung ' + JSON.stringify(got));
      delete VNPlugin.plugins.tstmg;
      // Keyframes kopieren / einfügen, Darsteller doppeln
      const an = { id: 'an_t', name: 'T', type: 'scene', dur: 3, actors: [{ id: 'ac_t', asset: null, x: 50, y: 0, scale: 100, bones: { Kopf: [{ t: 0, a: 0, e: 'ease-in-out' }, { t: 0.5, a: 10, e: 'ease-in-out' }] }, move: [] }], cam: [] };
      p.anims.push(an);
      VN.ui.animSel = 'an_t'; VN.ui.animActor = 'ac_t';
      VN.ui.animKeys = [{ row: 'bone:Kopf', t: 0 }, { row: 'bone:Kopf', t: 0.5 }];
      if (!AnimEd.copyKeys()) out.push('Kopieren');
      VN.ui.animT = 1;
      AnimEd.pasteKeys();
      const ks = p.anims.find((x) => x.id === 'an_t').actors[0].bones.Kopf.map((k) => k.t + ':' + k.a).join(',');
      if (ks !== '0:0,0.5:10,1:0,1.5:10') out.push('Einfügen ' + ks);
      AnimEd.dupActor(p.anims.find((x) => x.id === 'an_t'), p.anims.find((x) => x.id === 'an_t').actors[0]);
      const A2 = p.anims.find((x) => x.id === 'an_t').actors;
      if (A2.length !== 2 || A2[0].id === A2[1].id || JSON.stringify(A2[0].bones) !== JSON.stringify(A2[1].bones)) out.push('Doppeln');
      // Figur bewegen in Idle/Geste
      const hold = document.createElement('div'); hold.appendChild(document.createElement('canvas')); document.body.appendChild(hold); hold.style.height = '100px';
      Anim.applyMove(hold, { x: 60, y: 10, scale: 110, rot: 5, opacity: 100 });
      const cs = hold.firstChild.style;
      if (!cs.translate || parseFloat(cs.rotate) !== 5 || parseFloat(cs.scale) !== 1.1) out.push('Figur bewegen ' + cs.translate + '/' + cs.rotate + '/' + cs.scale);
      Anim.applyMove(hold, null); if (hold.firstChild.style.translate) out.push('Bewegung nicht zurückgesetzt'); hold.remove();
      // Hub-Idle
      const wr = VN.hubIdleWrap({ id: 'o1', idle: 'float', idleSpeed: 2 }, document.createElement('img'));
      if (wr.length !== 1 || !wr[0].classList.contains('hi-float') || wr[0].style.getPropertyValue('--hi-dur') !== '2s') out.push('Hub-Idle');
      if (VN.hubIdleWrap({ id: 'o2' }, 'x')[0] !== 'x') out.push('Hub ohne Idle');
      const t = JSON.parse(keep); p.devices = t.d; p.web = t.w; p.chats = t.c; p.social = t.s; p.vars = t.v; p.anims = t.an; VN.migrate(p);
      VN.ui.animKeys = []; VN.ui.animSel = null;
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Paket 1: ' + r.join(', '));
    else log('✓ Transkript (Apps/Websites), Mischmodus + Weichzeichner, Minispiel-Belohnung, Keyframes kopieren, Doppeln, Hub-Idle');
  } catch (e) { general.push('Paket 1: ' + e.message); }

  // 23. Paket 2 (0.9.24): Follower-Wachstum und Währung, Live-Chat, Ausdauer, Masken, Vorlagen, Bibliothek
  try {
    const r = JSON.parse(await js(`(() => {
      const out = [], p = VN.project, DV = VN.Devices;
      const keep = JSON.stringify({ d: p.devices, c: p.chats, s: p.social, cur: p.currencies, t: p.time, lc: p.liveChats, st: p.stamina });
      p.devices.enabled = true; p.time.enabled = true;
      p.chats.contacts = [{ id: 'cF', name: 'Fia', followers: 1000, folGrow: [{ when: 'day', mode: 'pct', amount: 10, conds: [] }, { when: 'weekday', wd: 6, mode: 'add', amount: 500, conds: [] }] }];
      p.social = { name: 'P', posts: [{ id: 'spF', author: 'cF', text: 'x' }] }; VN.migrate(p);
      const rs = VN.newRunState(); VN.Life.initRun(rs);
      VN.Life.advance(rs, { mode: 'nextDay' });
      const f1 = DV.followers(DV.contact('cF'), rs);
      if (f1 !== 1100) out.push('Wachstum Tag ' + f1);
      // Als Währung: Zahl = Kontostand, Aktion ändert die Währung
      p.currencies.push({ id: 'cur_fol', name: 'Follower', start: 50 }); p.chats.contacts[0].folCur = 'cur_fol';
      const rs2 = VN.newRunState();
      if (DV.followers(DV.contact('cF'), rs2) !== 50) out.push('Währung Start ' + DV.followers(DV.contact('cF'), rs2));
      VN.applyActions([{ type: 'socialFollowers', contact: 'cF', op: 'add', amount: 25 }], rs2, 'x');
      if (rs2.money.cur_fol !== 75) out.push('Währung Aktion ' + rs2.money.cur_fol);
      if (!VN.checkConds([{ type: 'socialFollowers', contact: 'cF', cmp: '>=', value: 70 }], rs2)) out.push('Bedingung');
      // Live-Chat: Daten, Texte, Bedingung
      const LC = VN.LiveChat, c = LC.newChat(); c.msgs = [{ id: 'lmT', user: c.users[0].id, text: 'Hallo Chat', gap: 1 }]; c.replies = [{ id: 'lrT', text: 'Hi!', at: 0 }]; p.liveChats = [c]; VN.migrate(p);
      const ids = new Set(VN.collectTexts().map((x) => x.id));
      if (!ids.has('lmT') || !ids.has('lrT')) out.push('Live-Chat im Transkript');
      const rs3 = VN.newRunState(); LC.st(rs3).replied.lrT = 1;
      if (!VN.checkConds([{ type: 'liveChatReplied', reply: 'lrT' }], rs3)) out.push('Live-Chat Bedingung');
      if (LC.color(c, c.users[0]) !== LC.color(c, c.users[0]) || !/^#/.test(LC.color(c, c.users[0]))) out.push('Chat-Farbe');
      // Ausdauer
      const ST = VN.Stamina; p.stamina.enabled = true; p.stamina.max = 50; p.stamina.start = 40; p.stamina.empty.mode = 'none'; p.stamina.costMinigame = 5;
      const rs4 = VN.newRunState();
      VN.applyActions([{ type: 'stamina', op: 'add', amount: -15 }], rs4, 'y');
      if (ST.get(rs4) !== 25) out.push('Ausdauer ' + ST.get(rs4));
      if (VN.checkConds([{ type: 'stamina', cmp: '>=', value: 30 }], rs4)) out.push('Ausdauer-Bedingung');
      VN.applyActions([{ type: 'stamina', op: 'add', amount: -999 }], rs4, 'y');
      if (ST.get(rs4) !== 0) out.push('Ausdauer unter 0');
      p.stamina.below = 20; p.stamina.tired.below = 50; ST.set(rs4, 20);
      if (!ST.tired(rs4)) out.push('müde');
      ST.set(rs4, 10); VN.Life.initRun(rs4); VN.Life.advance(rs4, { mode: 'nextDay' });
      if (ST.get(rs4) !== 50) out.push('neuer Tag nicht voll ' + ST.get(rs4));
      // Maske schneidet aus
      const cv = document.createElement('canvas'); cv.width = 100; cv.height = 100; const g = cv.getContext('2d');
      const act = { mask: { on: true, shape: 'rect', x: 0, y: 0, w: 50, h: 100, rot: 0, keys: [{ t: 0, x: 0, y: 0, w: 50, h: 100, rot: 0 }, { t: 1, x: 50, y: 0, w: 50, h: 100, rot: 0 }] } };
      g.save(); Anim.clipMask(g, act, 0, 100, 100); g.fillStyle = '#f00'; g.fillRect(0, 0, 100, 100); g.restore();
      const px = (x) => g.getImageData(x, 50, 1, 1).data[3];
      if (!(px(20) > 0 && px(80) === 0)) out.push('Maske t=0');
      const mid = Anim.maskAt(act, 0.5); if (Math.abs(mid.x - 25) > 0.5) out.push('Maske Keyframe ' + mid.x);
      act.mask.invert = true; g.clearRect(0, 0, 100, 100); g.save(); Anim.clipMask(g, act, 0, 100, 100); g.fillRect(0, 0, 100, 100); g.restore();
      if (!(px(20) === 0 && px(80) > 0)) out.push('Maske umgekehrt');
      // Vorlagen
      if (!DV.PRESETS || DV.PRESETS.PHONE.length < 6 || !DV.WEB_TPL || DV.WEB_TPL.length < 6) out.push('Vorlagen fehlen');
      for (const t of DV.WEB_TPL || []) { const pg = t.make(); if (!pg.els.length || pg.els.some((e) => !e.id || e.x == null)) out.push('Vorlage ' + t.id); }
      if (!(VN.api && VN.api.library && VN.api.library.list)) out.push('Bibliothek fehlt');
      // Aufbau-Ansicht (0.9.27): mehrfach kaufen, Klick-Objekt
      const keepIdle = JSON.stringify(p.idle);
      p.idle = undefined; VN.Idle.example(); VN.Idle.cfg().enabled = true;
      const rsI = VN.newRunState(); VN.Idle.start(rsI);
      const bI = VN.Idle.cfg().buildings[0], curI = (bI.costs[0] || {}).cur;
      rsI.money[curI] = 1e9;
      const q10 = VN.Idle.costN(rsI, bI, 10);
      if (q10.count !== Math.min(10, VN.Idle.max(bI) - VN.Idle.level(rsI, bI)) || !q10.ok) out.push('Aufbau ×10 ' + JSON.stringify(q10));
      const lv0 = VN.Idle.level(rsI, bI);
      let sum10 = 0; for (let k = 0; k < q10.count; k++) sum10 += (VN.Idle.cost(bI, lv0 + k, rsI).find((x) => x.cur === curI) || { amount: 0 }).amount;
      if (Math.abs(sum10 - q10.cost.find((x) => x.cur === curI).amount) > 0.5) out.push('Aufbau ×10 Kosten');
      const k10 = VN.Idle.buildN(rsI, bI, 10);
      if (VN.Idle.level(rsI, bI) !== lv0 + k10 || k10 < 1) out.push('Aufbau ×10 bauen');
      rsI.money[curI] = 0;
      if (VN.Idle.costN(rsI, bI, 'max').ok) out.push('Aufbau Max ohne Geld');
      VN.Idle.view().clicker.cur = curI; VN.Idle.view().clicker.amount = 3;
      const gI = VN.Idle.clickMain(rsI);
      if (!gI || rsI.money[curI] !== 3) out.push('Klick-Objekt');
      // Kurven: Cookie Clicker 1,15^n, AdCap-Sprünge, Potenz, linear
      const bC = VN.Idle.cfg().buildings[0];
      VN.Idle.applyCurvePreset(VN.Idle.CURVE_PRESETS.find((x) => x.id === 'cookie'), true);
      if (Math.abs(VN.Idle.costFactor(bC, 10) - Math.pow(1.15, 10)) > 1e-9) out.push('Kurve Cookie');
      VN.Idle.applyCurvePreset(VN.Idle.CURVE_PRESETS.find((x) => x.id === 'adcap'), true);
      if (VN.Idle.prodFactor(bC, 24) !== 24 || VN.Idle.prodFactor(bC, 25) !== 50 || VN.Idle.prodFactor(bC, 50) !== 200) out.push('Kurve AdCap ' + VN.Idle.prodFactor(bC, 25));
      VN.Idle.applyCurvePreset(VN.Idle.CURVE_PRESETS.find((x) => x.id === 'gentle'), false);
      if (VN.Idle.costFactor(bC, 3) !== 16) out.push('Kurve Potenz');
      VN.Idle.curve().cost = 'linear'; VN.Idle.curve().lin = 50;
      if (VN.Idle.costFactor(bC, 4) !== 3) out.push('Kurve linear');
      bC.costCurve = 'exp'; if (Math.abs(VN.Idle.costFactor(bC, 2) - Math.pow(bC.grow, 2)) > 1e-9) out.push('Kurve pro Gebäude');
      p.idle = JSON.parse(keepIdle); VN.migrate(p);
      const t = JSON.parse(keep); p.devices = t.d; p.chats = t.c; p.social = t.s; p.currencies = t.cur; p.time = t.t; p.liveChats = t.lc; p.stamina = t.st; VN.migrate(p);
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Paket 2: ' + r.join(', '));
    else log('✓ Follower (Wachstum, Währung), Live-Chat, Ausdauer, Masken, Design-Vorlagen, Bibliothek');
  } catch (e) { general.push('Paket 2: ' + e.message); }

  // 24. Weich-Physik (0.9.28): Masken-Gewicht, Feder kommt zur Ruhe, Bühne nutzt Canvas
  try {
    const r = JSON.parse(await js(`(() => {
      const out = [], S = window.Soft, p = VN.project;
      const r0 = S.newRegion('chest', 0.5, 0.4, 0.1, 0.05), P = S.par(r0);
      let L = S.local(r0, 0.5, 0.4, 0.6); if (S.weight(P, L[0], L[1]) <= 0.4) out.push('Gewicht Mitte');
      L = S.local(r0, 0.9, 0.4, 0.6); if (S.weight(P, L[0], L[1]) !== 0) out.push('außerhalb nicht ruhig');
      L = S.local(r0, 0.5, 0.36, 0.6); const top = S.weight(P, L[0], L[1]); L = S.local(r0, 0.5, 0.44, 0.6); if (!(top < S.weight(P, L[0], L[1]))) out.push('Anker oben');
      const sim = S.newSim(); S.poke(sim, 'down', 1);
      S.step(sim, [r0], { x: 0, y: 0 }, 0.016); const v1 = Math.abs(sim.regs[r0.id].y);
      for (let i = 0; i < 300; i++) S.step(sim, [r0], { x: 0, y: 0 }, 0.016);
      if (!(v1 > 0) || Math.abs(sim.regs[r0.id].y) > 1e-4) out.push('Feder ' + v1 + ' ' + sim.regs[r0.id].y);
      const sim2 = S.newSim(); S.feed(sim2, 0, 0, 0.016); S.feed(sim2, 0, 0, 0.016); const a = S.feed(sim2, 0, -0.01, 0.016);
      S.step(sim2, [r0], a, 0.016); if (!(sim2.regs[r0.id].y > 0)) out.push('Trägheit');
      const img = VN.assetsOf('image')[0];
      if (img) {
        const keep = p.softs; p.softs = { [img.id]: { on: true, regions: [r0] } };
        const box = Stage.charEl({ asset: img.id, x: 50, start: 0 }, 'char', {});
        if (!box.querySelector('.soft-canvas')) out.push('Bühne ohne Canvas');
        p.softs = { [img.id]: { on: false, regions: [r0] } };
        if (Stage.charEl({ asset: img.id, x: 50, start: 0 }, 'char', {}).querySelector('.soft-canvas')) out.push('aus, aber Canvas');
        p.softs = keep;
      }
      if (!VN.ext.actions.softPoke) out.push('Aktion fehlt');
      // freie Form (Lasso / Zeichenstift): innen bewegt, außen ruhig, Ecken bleiben spitz
      const rp = Object.assign(S.newRegion('chest', 0, 0, 0, 0), { shape: 'poly', smooth: true, pts: [[0.3, 0.3], [0.7, 0.3, 1], [0.7, 0.6], [0.3, 0.6]] });
      const Pp = S.par(rp);
      L = S.local(rp, 0.5, 0.45, 1); if (!(L[2] < 0.2) || S.weight(Pp, L[0], L[1], L[2]) <= 0) out.push('Form innen ' + L[2]);
      L = S.local(rp, 0.9, 0.45, 1); if (S.weight(Pp, L[0], L[1], L[2]) !== 0) out.push('Form außen');
      const rq = Object.assign({}, rp, { smooth: false }); L = S.local(rq, 0.3, 0.45, 1); if (Math.abs(L[2] - 1) > 0.02) out.push('Form Rand ' + L[2]);
      if (!S.outline(rp).some((q) => Math.abs(q[0] - 0.7) < 1e-9 && Math.abs(q[1] - 0.3) < 1e-9)) out.push('Ecke');
      const ep = S.toPoly({ cx: 0.5, cy: 0.5, rx: 0.1, ry: 0.05, rot: 0 }, 0.5, 8);
      if (ep.length !== 8 || Math.abs(ep[0][0] - 0.6) > 1e-6) out.push('Ellipse → Form');
      // Ankerpunkt und Pendeln: am Pin fest, an der Spitze voll; Pendeln dreht um den Pin
      const rt = Object.assign(S.newRegion('tail', 0.5, 0.5, 0.1, 0.4), { pin: [0.5, 0.1] }), Pt = S.par(rt);
      if (S.pinQ(rt, 0.5, 0.1, 1) !== 0 || Math.abs(S.pinQ(rt, 0.5, 0.9, 1) - 1) > 1e-6) out.push('Pin-Abstand');
      const mt = { dx: 0.05, dy: 0, sq: 0, wave: 0, t: 0, sp: 1 };
      const dPin = S.disp(rt, Pt, mt, 0, -0.9, 1, 1, { r: rt, u: 0.5, v: 0.12, aspect: 1 }), dTip = S.disp(rt, Pt, mt, 0, 0.9, 1, 1, { r: rt, u: 0.5, v: 0.86, aspect: 1 });
      if (!(Math.hypot(dPin[0], dPin[1]) < Math.hypot(dTip[0], dTip[1]) * 0.1) || !(Math.abs(dTip[0]) > 0.01)) out.push('Pendeln ' + JSON.stringify([dPin, dTip]));
      const Pa = Object.assign({}, Pt, { pendulum: false });
      // Zucken und Puls (0.9.29)
      const rz = Object.assign(S.newRegion('chest', 0.5, 0.5, 0.1, 0.05), { twitch: 1.5, pulse: 1, idleAmp: 0 }), simz = S.newSim();
      let tz = 0; for (let i = 0; i < 300; i++) { S.step(simz, [rz], { x: 0, y: 0 }, 1 / 60); tz = Math.max(tz, Math.hypot(simz.regs[rz.id].x, simz.regs[rz.id].y)); }
      if (!(tz > 0.002)) out.push('Zucken ' + tz);
      if (!(S.heart(0.05, 60) > 0.8) || !(S.heart(0.5, 60) < 0.05) || !(S.heart(0.24, 60) > 0.4)) out.push('Herzschlag-Kurve');
      let swm = 0; for (let i = 0; i < 120; i++) swm = Math.max(swm, S.regionMove(rz, S.par(rz), null, i / 100).sw);
      if (!(swm > 0.03)) out.push('Puls ' + swm);
      if (S.regionMove(Object.assign({}, rz, { pulse: 0 }), S.par(Object.assign({}, rz, { pulse: 0 })), null, 0.05).sw !== 0) out.push('Puls aus');
      if (!(S.anchorW(Pa, 0, 0, { r: rt, u: 0.5, v: 0.15, aspect: 1 }) < S.anchorW(Pa, 0, 0, { r: rt, u: 0.5, v: 0.85, aspect: 1 }))) out.push('Pin-Anker');
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Weich-Physik: ' + r.join(', '));
    else log('✓ Weich-Physik: Masken-Gewicht, Anker, Feder, Trägheit, Bühne, Aktion, freie Formen, Ankerpunkt, Pendeln, Zucken, Puls');
  } catch (e) { general.push('Weich-Physik: ' + e.message); }

  // 25. Mausrad-Zoom (0.9.29): Punkt unter der Maus bleibt stehen, Zoom überlebt Neuaufbau, Zurücksetzen
  try {
    const r = JSON.parse(await js(`(() => {
      const out = [];
      if (!window.Zoom) return JSON.stringify(['Zoom fehlt']);
      // eigene Test-Bühne im Mittelbereich (unabhängig davon, welche Ansicht gerade offen ist)
      const center = document.getElementById('center');
      const vp = document.createElement('div'); vp.className = 'stage-wrap'; Object.assign(vp.style, { position: 'fixed', left: '100px', top: '100px', width: '600px', height: '400px' });
      const st = document.createElement('div'); st.className = 'stage'; Object.assign(st.style, { width: '480px', height: '270px' });
      vp.appendChild(st); center.appendChild(vp);
      const f = Zoom.find(st);
      if (!f) { vp.remove(); return JSON.stringify(['keine Bühne']); }
      const keep = JSON.stringify(Zoom.state());
      Zoom.reset();
      const r0 = st.getBoundingClientRect(), mx = r0.left + r0.width * 0.3, my = r0.top + r0.height * 0.6;
      Zoom.zoomAt(st, mx, my, 2);
      const r1 = st.getBoundingClientRect();
      if (Math.abs(r1.width / r0.width - 2) > 0.01) out.push('Faktor ' + r1.width / r0.width);
      if (Math.abs((mx - r1.left) / r1.width - 0.3) > 0.005 || Math.abs((my - r1.top) / r1.height - 0.6) > 0.005) out.push('Punkt wandert');
      if (!vp.querySelector('.vz-badge')) out.push('Anzeige fehlt');
      st.style.scale = ''; st.style.translate = ''; Zoom.apply();
      if (Math.abs(st.getBoundingClientRect().width / r0.width - 2) > 0.01) out.push('erneut anwenden');
      Zoom.reset(); if (Math.abs(st.getBoundingClientRect().width - r0.width) > 0.5) out.push('Zurücksetzen');
      // Inhalt mit eigenem transform (z. B. Geräte-Vorschau): Punkt bleibt trotzdem unter der Maus
      st.style.transform = 'translateX(-20%) scale(0.8)';
      const q0 = st.getBoundingClientRect(), qx = q0.left + q0.width * 0.7, qy = q0.top + q0.height * 0.2;
      Zoom.zoomAt(st, qx, qy, 2.5);
      const q1 = st.getBoundingClientRect();
      if (Math.abs((qx - q1.left) / q1.width - 0.7) > 0.005 || Math.abs((qy - q1.top) / q1.height - 0.2) > 0.005) out.push('eigenes transform');
      Zoom.reset();
      vp.remove(); Object.assign(Zoom.state(), JSON.parse(keep));
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Mausrad-Zoom: ' + r.join(', '));
    else log('✓ Mausrad-Zoom: zur Maus, Anzeige, erneut anwenden, Zurücksetzen, eigenes transform');
  } catch (e) { general.push('Mausrad-Zoom: ' + e.message); }

  // 26. Gesicht-Rig (0.9.31): Mund verformt sich nur in der Maske, Lid deckt das Auge ab, Bühne und Lippensync
  try {
    const r = JSON.parse(await js(`(() => {
      const out = [];
      if (!window.Face) return JSON.stringify(['Face fehlt']);
      // Testbild: Hautfarbe, dunkle Mundlinie, Auge mit dunklen Wimpern und grüner Iris
      const c = document.createElement('canvas'); c.width = 200; c.height = 200; const g = c.getContext('2d');
      g.fillStyle = '#f3d9c4'; g.fillRect(0, 0, 200, 200);
      g.fillStyle = '#222'; g.fillRect(70, 139, 60, 3);
      g.fillStyle = '#2a8a3a'; g.fillRect(45, 72, 30, 22); g.fillStyle = '#111'; g.fillRect(40, 66, 40, 6);
      g.fillStyle = '#7a4a2a'; g.fillRect(140, 20, 40, 4);
      c.naturalWidth = 0;
      const f = Face.blank();
      f.mouth.up = [[0.35, 0.7], [0.5, 0.695], [0.65, 0.7]];
      f.eyes.push({ bot: [[0.2, 0.36], [0.3, 0.355], [0.4, 0.36]], low: [[0.2, 0.37], [0.3, 0.48], [0.4, 0.37]] });
      f.src = { x: 0.45, y: 0.05, w: 0.2, h: 0.1 };
      VN.project.faces = VN.project.faces || {};
      const keep = VN.project.faces.__t; VN.project.faces.__t = f;
      if (!Face.cfg('__t')) out.push('cfg');
      const W = 200, H = 200, render = (vals) => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const v = Object.assign({}, Face.snap(f, 'neutral', 0).vals, vals); Face.render(cv.getContext('2d'), c, f, v, {}, W, H, {}); return cv.getContext('2d').getImageData(0, 0, W, H).data; };
      const base = render({}), smile = render({ s: 1 });
      const px = (d, x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
      const diff = (a, b, x0, y0, x1, y1) => { let n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const p = px(a, x, y), q = px(b, x, y); if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) > 30) n++; } return n; };
      if (!(diff(base, smile, 60, 120, 140, 160) > 5)) out.push('Lächeln ändert den Mund nicht');
      if (diff(base, smile, 0, 0, 200, 60) > 0) out.push('außerhalb der Maske verändert');
      // geschlossener Mund: „öffnen“ darf nicht schließen (o < 0 wird ignoriert)
      if (diff(base, render({ o: -0.8 }), 60, 120, 140, 160) > 0) out.push('geschlossener Mund schließt weiter');
      // Lid zu: grüne Iris ist abgedeckt (Haut aus der Quelle)
      const shut = render({ e: 1 }); const iris = px(shut, 60, 80);
      if (!(iris[0] > 150 && iris[1] > 150)) out.push('Lid deckt Iris nicht ab ' + iris.join(','));
      const open = px(base, 60, 80); if (!(open[1] > open[0])) out.push('Iris fehlt im Ausgangsbild');
      // Ausdrücke, Mischen, eigene Ausdrücke
      f.exprs.push({ id: 'my', name: 'Mein', vals: { s: 0.5 }, offs: { up: [[0, -0.01], [0, 0], [0, 0]] } });
      const sn = Face.snap(f, 'my', 0.5); if (Math.abs(sn.vals.s - 0.25) > 1e-9 || Math.abs(sn.offs.up[0][1] + 0.005) > 1e-9) out.push('snap');
      const mx = Face.mix(Face.snap(f, 'neutral', 0), Face.snap(f, 'smile', 1), 0.5); if (Math.abs(mx.vals.s - 0.45) > 1e-9) out.push('mix');
      if (!Face.exprList(f).some((x) => x.id === 'my')) out.push('eigener Ausdruck fehlt');
      if (!VN.ext.actions.faceExpr) out.push('Aktion fehlt');
      if (keep) VN.project.faces.__t = keep; else delete VN.project.faces.__t;
      // Bühne: Bild-Figur mit Gesicht bekommt Canvas, Gesicht und echten Mund für den Lippensync
      const img = VN.assetsOf('image')[0];
      if (img) {
        const kf = VN.project.faces[img.id];
        VN.project.faces[img.id] = Object.assign(Face.blank(), { mouth: Object.assign(Face.blank().mouth, { up: [[0.4, 0.5], [0.5, 0.49], [0.6, 0.5]] }) });
        const box = Stage.charEl({ asset: img.id, x: 50, start: 0, faceExpr: 'smile' }, 'char', {});
        if (!box.querySelector('.soft-canvas')) out.push('Bühne ohne Canvas');
        if (!box._face || !box._mouth || !box._mouth.set) out.push('Gesicht oder Mund fehlt');
        else { box._mouth.set(0.8); if (Math.abs(box._face.talk - 0.8) > 1e-9) out.push('Lippensync'); }
        if (kf) VN.project.faces[img.id] = kf; else delete VN.project.faces[img.id];
      }
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Gesicht-Rig: ' + r.join(', '));
    else log('✓ Gesicht-Rig: Mund nur in der Maske, Lid mit Haut-Stempel, eigene Ausdrücke, Bühne und Lippensync');
  } catch (e) { general.push('Gesicht-Rig: ' + e.message); }

  // 28. Weich-Physik mit Bones (0.9.35): Bereiche wippen auch auf Figuren mit Knochen; Gewichte zwischengespeichert
  try {
    const r = JSON.parse(await js(`(async () => {
      const out = [];
      if (!window.Soft || !window.Rig) return JSON.stringify(['Soft/Rig fehlt']);
      const cfg = { on: true, regions: [{ id: 'q1', preset: 'chest', cx: 0.5, cy: 0.4, rx: 0.2, ry: 0.1, rot: 0, on: true, idle: 'breathe', idleAmp: 3 }] };
      const mesh = { w: 200, h: 400, count: 3, pos: new Float32Array([100, 160, 100, 390, 5, 5]) };
      const sim = Soft.newSim(), d = new Float32Array(6);
      Soft.offsets(cfg, sim, 0.75, mesh, d);
      if (!(Math.abs(d[1]) > 0.01)) out.push('Mitte bewegt sich nicht ' + d[1]);
      if (d[3] || d[5]) out.push('Punkte außerhalb bewegen sich');
      // je Bereich eigene Beschleunigung
      Soft.step(sim, cfg.regions, { x: 0, y: 0, byId: { q1: { x: 40, y: 0 } } }, 0.05);
      if (!(Math.abs(sim.regs.q1.vx) > 0)) out.push('Beschleunigung je Bereich wirkt nicht');
      // Zwischenspeicher: geänderte Form wird erkannt
      cfg.regions[0].cy = 0.95; Soft.offsets(cfg, Soft.newSim(), 0.75, mesh, d);
      if (Math.abs(d[1]) > 1e-6 || !(Math.abs(d[3]) > 0.01)) out.push('Formänderung nicht erkannt');
      // Figur mit Bones: Weich-Physik läuft mit
      const p = VN.project;
      for (const id of Object.keys(p.rigs || {}).filter((k) => Rig.has(k) && p.assets.some((a) => a.id === k && !/gittertest/.test(a.name || '')))) {
        const had = p.softs && p.softs[id];
        p.softs = p.softs || {}; p.softs[id] = { on: true, regions: [{ id: 'q2', preset: 'chest', cx: 0.5, cy: 0.4, rx: 0.2, ry: 0.15, rot: 0, on: true, idle: 'breathe', idleAmp: 3 }] };
        const cv = Rig.canvasFor(id, { boneAmp: 100 }, { manual: true });
        const inst = await cv._inst.ready;
        if (!inst) { if (had) p.softs[id] = had; else delete p.softs[id]; continue; }
        Rig.renderAt(inst, 0.2, 1 / 60); Rig.renderAt(inst, 0.95, 1 / 60);
        let m = 0; if (inst.soft) for (const v of inst.soft.d) m = Math.max(m, Math.abs(v));
        if (!(m > 0.01)) out.push('Bones-Figur ohne Weich-Physik');
        if (had) p.softs[id] = had; else delete p.softs[id];
        break;
      }
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Weich-Physik mit Bones: ' + r.join(', '));
    else log('✓ Weich-Physik mit Bones: Bereiche wippen auf Figuren mit Knochen, Beschleunigung je Bereich, Zwischenspeicher erkennt Änderungen');
  } catch (e) { general.push('Weich-Physik mit Bones: ' + e.message); }

  // 29. Freie Sprechblase und Text-Effekte (0.9.35)
  try {
    const r = JSON.parse(await js(`(async () => {
      const out = [];
      // Matrix legt die Ecken eines Rechtecks genau auf das Viereck
      const P = [[10, 20], [300, 5], [280, 140], [30, 180]], w = 200, h = 100;
      const m = Theme.quadMatrix(w, h, P).match(/[-\\d.e]+/g).map(Number).slice(1);
      const ap = (x, y) => { const X = m[0] * x + m[4] * y + m[12], Y = m[1] * x + m[5] * y + m[13], W = m[3] * x + m[7] * y + m[15]; return [X / W, Y / W]; };
      [[0, 0], [w, 0], [w, h], [0, h]].forEach((c, i) => { const q = ap(c[0], c[1]); if (Math.hypot(q[0] - P[i][0], q[1] - P[i][1]) > 0.01) out.push('Ecke ' + i + ' ' + q.map((v) => v.toFixed(2))); });
      // Blase aufbauen
      const t = Theme.t(), keep = JSON.stringify(t.bubble);
      t.bubble = { preset: 'dunkel', free: true, freeImg: 'builtin:tilt', dots: true, edge: true, letters: 'wave', cap: true };
      const stage = document.createElement('div'); stage.className = 'stage'; stage.style.width = '640px'; stage.style.height = '360px'; document.body.appendChild(stage);
      const box = Stage.dialogEl({ id: 'x', speaker: 'Ray', color: '#fff', text: 'Hallo du da' }, null, null, { tailX: 40, full: 'Hallo du da' });
      stage.appendChild(box);
      await new Promise((res) => setTimeout(res, 300));
      if (!box.classList.contains('free')) out.push('keine freie Blase');
      if (!box.querySelector('.free-img') || !box.querySelector('.free-tq .dlg-text') || !box.querySelector('.free-nq .dlg-name')) out.push('Aufbau fehlt');
      if (!/matrix3d/.test(box.querySelector('.free-tq').style.transform)) out.push('Textfläche nicht verzerrt');
      const te = box.querySelector('.dlg-text');
      if (te.querySelectorAll('.tch').length !== 11) out.push('Buchstaben nicht einzeln ' + te.querySelectorAll('.tch').length);
      const fid = (te.style.filter.match(/#([^")]+)/) || [])[1];
      const f = fid && document.getElementById(fid);
      if (!f || !f.querySelector('feTile') || f.querySelectorAll('feMorphology').length < 1) out.push('Filter fehlt');
      if (!te.classList.contains('tcap')) out.push('Initiale fehlt');
      stage.remove();
      t.bubble = JSON.parse(keep);
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Freie Sprechblase: ' + r.join(', '));
    else log('✓ Freie Sprechblase: Text perspektivisch in 4 Ecken, Namensfeld, Comic-Punkte, einseitige Kontur, Buchstaben-Animation, Initiale');
  } catch (e) { general.push('Freie Sprechblase: ' + e.message); }

  // 30. Zuletzt geöffnete Projekte (0.9.37)
  try {
    const r = JSON.parse(await js(`(async () => {
      const out = [];
      if (!VN.api.recentList) return JSON.stringify(['API fehlt']);
      await VN.save();
      await new Promise((res) => setTimeout(res, 300));
      const l = await VN.api.recentList();
      const me = l.find((x) => x.dir === VN.dir);
      if (!me) out.push('aktuelles Projekt fehlt in der Liste');
      else if (!me.ok || me.title !== VN.project.title) out.push('Eintrag falsch ' + JSON.stringify([me.ok, me.title]));
      const o = await VN.api.recentOpen(VN.dir);
      if (!o || !o.data || o.dir !== VN.dir) out.push('Öffnen klappt nicht');
      if (await VN.api.recentOpen('/gibt/es/nicht')) out.push('fremder Ordner geöffnet');
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Zuletzt geöffnet: ' + r.join(', '));
    else log('✓ Zuletzt geöffnet: Projekt landet in der Liste, lässt sich direkt öffnen, fremde Ordner nicht');
  } catch (e) { general.push('Zuletzt geöffnet: ' + e.message); }

  // 31. Weich-Physik von Figur zu Figur kopieren (0.9.37)
  try {
    const r = JSON.parse(await js(`(async () => {
      const out = [];
      const p = VN.project, imgs = p.assets.filter((a) => a.kind === 'image');
      if (imgs.length < 2 || !window.FmtCopy) return JSON.stringify(['zu wenig Bilder']);
      const A = imgs[0].id, B = imgs[1].id, keep = JSON.stringify(p.softs || {});
      p.softs = p.softs || {};
      p.softs[A] = { on: true, regions: [{ id: 'sa1', preset: 'chest', cx: 0.5, cy: 0.4, rx: 0.1, ry: 0.05, rot: 0, on: true }, { id: 'sa2', preset: 'cloth', cx: 0.5, cy: 0.7, rx: 0.2, ry: 0.1, rot: 0, on: true }] };
      delete p.softs[B];
      const menu = FmtCopy.softItems({ asset: A });
      if (!menu.length) out.push('kein Menüpunkt zum Kopieren');
      FmtCopy.copySoft(A);
      if (!FmtCopy.softItems({ asset: B }).some((x) => /einfügen/i.test(x.label) || /Paste/i.test(x.label))) out.push('kein Menüpunkt zum Einfügen');
      FmtCopy.pasteSoft(B);
      const d = p.softs[B];
      if (!d || d.regions.length !== 2) out.push('nicht eingefügt');
      else if (d.regions.some((x) => x.id === 'sa1' || x.id === 'sa2')) out.push('gleiche IDs');
      else if (d.regions[0].cx !== 0.5 || d.regions[1].preset !== 'cloth') out.push('Werte falsch');
      d.regions[0].cx = 0.3;
      if (p.softs[A].regions[0].cx !== 0.5) out.push('nicht unabhängig');
      VN.undo();
      if ((VN.project.softs || {})[B]) out.push('Rückgängig klappt nicht');
      VN.project.softs = JSON.parse(keep);
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Weich-Physik kopieren: ' + r.join(', '));
    else log('✓ Weich-Physik kopieren: Masken von einer Figur auf eine andere übertragen, unabhängig und rückgängig machbar');
  } catch (e) { general.push('Weich-Physik kopieren: ' + e.message); }

  // 32. Endlos-Schleife mit Überblenden und Dämpfen (0.9.37)
  try {
    const r = JSON.parse(await js(`(async () => {
      const out = [];
      if (!VN.Looper || !Fx.muffleFreq) return JSON.stringify(['fehlt']);
      if (Fx.muffleFreq(0) !== 0 || !(Fx.muffleFreq(50) > Fx.muffleFreq(100)) || Fx.muffleFreq(100) > 400) out.push('Dämpf-Kurve');
      const L = VN.Looper('vnasset://x/none.ogg', { xf: 0.4 });
      L.volume = 0.5;
      if (L.volume !== 0.5 || L.els.length !== 2 || !L.paused) out.push('Looper-Grundwerte');
      // Soundeffekt mit Wiederholen: zählt nur, solange der Clip den Schritt abdeckt
      const s = VN.project.scenes.find((x) => x.type === 'story' && x.tracks.sfx && x.tracks.sfx.length);
      if (s) {
        const c = s.tracks.sfx[0], keep = JSON.stringify(c);
        Object.assign(c, { loop: true, start: 0, len: 2 });
        const st = Stage.state(s, 1);
        if (!st) out.push('Zustand');
        Object.assign(c, JSON.parse(keep));
        delete c.loop; if (JSON.parse(keep).loop) c.loop = JSON.parse(keep).loop;
      }
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Schleife/Dämpfen: ' + r.join(', '));
    else log('✓ Schleife und Dämpfen: Looper mit zwei Elementen, Dämpf-Kurve');
  } catch (e) { general.push('Schleife/Dämpfen: ' + e.message); }

  // 33. Auslöser-Spur (0.9.38)
  try {
    const r = JSON.parse(await js(`(async () => {
      const out = [];
      const s = VN.project.scenes.find((x) => x.type === 'story');
      const t = VN.tracksOf(s).find((x) => x.key === 'trigger');
      if (!t) return JSON.stringify(['Spur fehlt']);
      if (!Array.isArray(s.tracks.trigger)) out.push('Spur nicht im Projekt');
      const c = Story.addClip(s, t, 0);
      if (!c || !Array.isArray(c.actions) || c.once !== true) out.push('neuer Clip falsch');
      const v = VN.project.vars.find((x) => x.type !== 'flag');
      if (v && c) {
        VN.mutate(() => { c.actions.push({ type: 'addVar', var: v.id, value: 7 }); });
        Player.start(s.id, 0, {});
        await new Promise((res) => setTimeout(res, 900));
        const got = Player.state && Player.state.rs && Player.state.rs.vars ? Player.state.rs.vars[v.id] : null;
        const want = (v.type === 'flag' ? 0 : Number(v.start) || 0) + 7;
        if (got == null || Number(got) !== want) out.push('Aktion nicht ausgelöst ' + got + ' statt ' + want);
        if (!Player.state.rs.fired[c.id]) out.push('nicht als ausgelöst gemerkt');
        Player.close(true);
      }
      VN.mutate(() => { s.tracks.trigger = s.tracks.trigger.filter((x) => x !== c && x.id !== (c && c.id)); });
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Auslöser-Spur: ' + r.join(', '));
    else log('✓ Auslöser-Spur: Clip anlegen, Aktion wird beim Erreichen des Schritts ausgelöst');
  } catch (e) { general.push('Auslöser-Spur: ' + e.message); }

  // 34. Anhänger an der Weich-Physik (0.9.38)
  try {
    const r = JSON.parse(await js(`(async () => {
      const out = [];
      const p = VN.project, img = p.assets.find((a) => a.kind === 'image');
      if (!img || !Soft.newHang) return JSON.stringify(['fehlt']);
      const keep = JSON.stringify(p.softs || {});
      p.softs = p.softs || {};
      const h = Soft.newHang(img.id, [0.5, 0.3]);
      p.softs.__t = { on: true, regions: [], hangs: [h] };
      const cfg = Soft.cfg('__t');
      if (!cfg || Soft.hangsOf(cfg).length !== 1) out.push('nur mit Anhänger nicht aktiv');
      // eigenes Testbild (die Test-Projekte haben keine Bilddateien)
      const c0 = document.createElement('canvas'); c0.width = 20; c0.height = 40; const g0 = c0.getContext('2d'); g0.fillStyle = '#f00'; g0.fillRect(0, 0, 20, 40);
      const im = new Image(); im.src = c0.toDataURL(); await new Promise((res) => { im.onload = res; setTimeout(res, 500); });
      im._url = VN.assetUrl(img.id); Soft._himg.set(img.id, im);
      if (!Soft.hangImg(img.id)) out.push('Bild lädt nicht');
      const sim = Soft.newSim();
      const pin = (u, v) => [u * 100, v * 200];
      Soft.hangFrame(cfg, sim, 0, pin, 100, 200, { x: 0, y: 0 });
      let ops;
      for (let i = 1; i <= 10; i++) ops = Soft.hangFrame(cfg, sim, i / 60, pin, 100, 200, { x: 40, y: 0 });
      if (!ops || !ops.length) return JSON.stringify(out.concat(['keine Zeichen-Angaben']));
      if (!(Math.abs(ops[0].th) > 0.01)) out.push('schwingt nicht ' + ops[0].th);
      // Biegung: Kette folgt verzögert, wird verformt gezeichnet
      h.bend = 0.8;
      for (let i = 11; i <= 30; i++) ops = Soft.hangFrame(cfg, sim, i / 60, pin, 100, 200, { x: i < 20 ? 40 : -40, y: 0 });
      if (!ops[0].chain || !ops[0].chain.some((x) => Math.abs(x) > 0.002)) out.push('Biegung bewegt sich nicht');
      else if (ops[0].chain.some((x) => !isFinite(x) || Math.abs(x) > 4)) out.push('Biegung instabil');
      const cb = document.createElement('canvas'); cb.width = 100; cb.height = 200;
      Soft.paintHangs(cb.getContext('2d'), ops, false);
      { const dd = cb.getContext('2d').getImageData(0, 0, 100, 200).data; let nn = 0; for (let i = 3; i < dd.length; i += 4) if (dd[i] > 10) nn++; if (nn < 20) out.push('gebogen nichts gezeichnet'); }
      h.bend = 0;
      // zwei Pins: liegt zwischen beiden
      h.pins = [[0.2, 0.5], [0.8, 0.5]];
      ops = Soft.hangFrame(cfg, sim, 0.5, pin, 100, 200, { x: 0, y: 0 });
      if (!ops.length || !ops[0].P2 || ops[0].th !== 0) out.push('zwei Pins falsch');
      const cv = document.createElement('canvas'); cv.width = 100; cv.height = 200;
      Soft.paintHangs(cv.getContext('2d'), ops, false);
      const d = cv.getContext('2d').getImageData(0, 0, 100, 200).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 10) n++;
      if (n < 20) out.push('nichts gezeichnet');
      p.softs = JSON.parse(keep);
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Anhänger: ' + r.join(', '));
    else log('✓ Anhänger: PNG an einem Pin schwingt bei Bewegung, zwischen zwei Pins aufgespannt, wird gezeichnet');
  } catch (e) { general.push('Anhänger: ' + e.message); }

  // 27. Kulissen-Raum (0.9.32): 3D-Flächen, Kamera, Licht durch Fenster mit Jalousie, Bühne und Spieler
  try {
    const r = JSON.parse(await js(`(async () => {
      const out = [], K = window.Kulisse;
      if (!K) return JSON.stringify(['Kulisse fehlt']);
      const k = K.blank('Test', 'room');
      if (k.planes.length !== 5) out.push('Raum-Vorlage ' + k.planes.length);
      const floor = k.planes.find((p) => p.kind === 'floor'), wall = k.planes.find((p) => p.kind === 'wall');
      if (Math.abs(Math.abs(K.frame(floor).N[1]) - 1) > 1e-6) out.push('Boden liegt nicht waagrecht');
      if (Math.abs(K.local(floor, 0, floor.h)[2] - 150) > 1e-6) out.push('Boden reicht nicht nach vorn');
      const beam = K.plane({ kind: 'beam', x: 0, y: 0, z: 164, w: 70, h: 820 });
      if (!K.isFront(beam) || K.isFront(wall)) out.push('Vordergrund falsch');
      // Kamera: Schwenk 10 % = 128 px, Zoom 200 % = halber Abstand
      const c = K.camOf(k, { panX: 10, zoom: 200 });
      if (Math.abs(c.x - 128) > 1e-6 || Math.abs(c.dz - 500) > 1e-6) out.push('Kamera ' + JSON.stringify(c));
      const pc = K.projCam(K.camOf(k, null), [0, 0, 0]); if (pc[0] !== 640 || pc[1] !== 360) out.push('Projektion');
      const far = K.projCam(K.camOf(k, null), [100, 0, -1000]); if (Math.abs(far[0] - 690) > 1e-6) out.push('Parallax ' + far[0]);
      k.cam.min = 0; k.cam.max = 900; if (K.clampX(k, 2000) !== 900 || K.clampX(k, -5) !== 0) out.push('Scroll-Grenzen');
      k.zones.push({ id: 'z', name: 'Z', x0: 400, x1: 800 }); if (!K.zoneAt(k, 500) || K.zoneAt(k, 900)) out.push('Zonen');
      // Licht: Wand mit Fenster in der Mitte, Strahl durchs Fenster kommt durch, daneben nicht, Jalousie macht Streifen
      const w = K.plane({ kind: 'wall', x: 0, y: 0, z: -300, w: 100, h: 100 }), a = new Uint8Array(100).fill(255);
      for (let y = 3; y < 7; y++) for (let x = 3; x < 7; x++) a[y * 10 + x] = 0;
      const occ = [{ p: w, f: K.frame(w), al: { w: 10, h: 10, a }, bl: null }];
      if (K.trace([0, 0, 0], [0, 0, -1], 1e5, 'x', occ) !== 1) out.push('Fenster lässt kein Licht durch');
      const d = [40, 0, -300], n = Math.hypot(...d);
      if (K.trace([0, 0, 0], d.map((v) => v / n), 1e5, 'x', occ) !== 0) out.push('Wand lässt Licht durch');
      occ[0].bl = { gap: 20, open: 0.5 }; if (!(K.trace([0, 0, 0], [0, 0, -1], 1e5, 'x', occ) < 0.1)) out.push('Jalousie');
      if (K.trace([0, -5, 0], [0, 0, -1], 1e5, 'x', occ) !== 1) out.push('Jalousie-Spalt');
      // Scheinwerfer leuchtet nur im Kegel, Neonröhre entlang der ganzen Röhre
      const sp = K.prepLamp(K.lamp({ type: 'spot', x: 0, y: -300, z: 0, yaw: 0, pitch: 90, spread: 20, range: 1000 }));
      if (!(K.lampAt(sp, [0, 0, 0], [0, -1, 0], true, null, null) > 0)) out.push('Scheinwerfer dunkel im Kegel');
      if (K.lampAt(sp, [300, 0, 0], [0, -1, 0], true, null, null) !== 0) out.push('Scheinwerfer leuchtet außerhalb');
      const ne = K.prepLamp(K.lamp({ type: 'neon', x: 0, y: 0, z: 0, len: 400, angle: 0, range: 300 }));
      if (!(K.lampAt(ne, [190, 100, 0], null, false, null, null) > 0) || K.lampAt(ne, [-500, 0, 0], null, false, null, null) !== 0) out.push('Neonröhre');
      // Figuren in der Tiefe: hinten kleiner, vorne größer, auf der Figuren-Ebene unverändert
      { const kc = { k, cam: K.camOf(k, null), base: null, extra: { x: 0 } };
        if (Math.abs(K.charOffset(kc, 50, 0).s - 1) > 1e-9 || !(K.charOffset(kc, 50, -500).s < 1) || !(K.charOffset(kc, 50, 300).s > 1)) out.push('Figuren-Tiefe');
        if (!(K.charOffset(kc, 20, -500).tx > 0)) out.push('Figur hinten rückt nicht zur Mitte'); }
      // Vorlagen (0.9.33): nur Räume, Fenster und Türen als ausgeschnittene Öffnungen, Scroll-Bereich passt
      for (const [id] of K.TEMPLATES) {
        const t = K.fromTemplate(id);
        if (!t || !t.planes.some((p) => p.kind === 'wall') || t.planes.some((p) => p.asset) || !t.zones.length) { out.push('Vorlage ' + id); continue; }
        if (t.cam.min > t.cam.max || t.cam.x < t.cam.min || t.cam.x > t.cam.max) out.push('Vorlage Scroll-Bereich ' + id);
      }
      { const fl = K.fromTemplate('flat'), wl = fl.planes.find((p) => p.kind === 'wall' && p.holes.some((o) => o.t === 'win'));
        const cut = K.cut(wl, K.placeholder(wl)), A = K.alpha(cut), o = wl.holes.find((q) => q.t === 'win');
        if (A.a[Math.floor((o.v0 + o.v1) / 2 * A.h) * A.w + Math.floor((o.u0 + o.u1) / 2 * A.w)] !== 0) out.push('Fenster nicht ausgeschnitten');
        if (!(Library.kulItems().length === K.TEMPLATES.length)) out.push('Bibliothek ohne Kulissen-Vorlagen'); }
      // Einbacken: alle Flächen, Lampe nur nachts an
      k.lamps.push(K.lamp({ x: 0, y: -100, z: -100, days: { night: true } }));
      const night = await K.bake(k, 'night'), day = await K.bake(k, 'day');
      if (night.planes.size !== 5) out.push('Einbacken ' + night.planes.size);
      if (night.glows.length !== 1 || day.glows.length !== 0) out.push('Lampe nach Tageszeit');
      // Bühne: Hintergrund-Clip mit Kulisse, Vordergrund-Ebene über den Figuren, Kamera fährt durch den Raum
      K.all().push(k);
      const sc = VN.project.scenes.find((x) => x.type === 'story' && x.tracks.bg.length);
      if (sc) {
        const bg = sc.tracks.bg[0], keep = bg.kulisse; bg.kulisse = k.id;
        const st = document.createElement('div'); st.className = 'stage'; document.body.appendChild(st);
        Stage.renderStory(st, sc, bg.start);
        const box = st.querySelector('.bg-box');
        if (!box || !box._kul) out.push('Bühne ohne Kulisse');
        else { Fx.applyCam(st.querySelector('.world'), { zoom: 100, panX: 25, panY: 0, rot: 0 }, 0); if (Math.abs(box._kul.cam.x - 320) > 1e-6) out.push('Kamera-Clip ' + box._kul.cam.x); }
        if (!st.querySelector('.kul-fhost')) out.push('Vordergrund-Ebene fehlt');
        st.remove(); if (keep) bg.kulisse = keep; else delete bg.kulisse;
      }
      // Spieler: Hub mit Kulisse
      const hub = VN.project.scenes.find((x) => x.type === 'hub');
      if (hub) {
        const keepL = hub.bgLook; hub.bgLook = Object.assign({}, keepL || {}, { kulisse: k.id });
        Player.start(hub.id);
        await new Promise((res) => setTimeout(res, 900));
        const kb = document.querySelector('.pl-stage .kul-back');
        if (!kb) out.push('Spieler ohne Kulisse');
        Player.close();
        hub.bgLook = keepL;
      }
      K.all().splice(K.all().indexOf(k), 1);
      if (!Export.usedAssets(Object.assign({}, VN.project, { kulissen: [{ planes: [{ asset: 'xyz' }] }], assets: [{ id: 'xyz' }] })).has('xyz')) out.push('Export kennt Kulissen-Bilder nicht');
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Kulissen-Raum: ' + r.join(', '));
    else log('✓ Kulissen-Raum: Flächen im Raum, Kamera mit Parallax, Licht durchs Fenster mit Jalousie, Lampen nach Tageszeit, Bühne und Spieler');
  } catch (e) { general.push('Kulissen-Raum: ' + e.message); }

  // 20. Social Media: Beiträge per Bedingung und Aktion, löschen, Likes mit Aktion nur einmal
  try {
    const r = JSON.parse(await js(`(() => {
      const out = [], p = VN.project, DV = VN.Devices;
      const keep = JSON.stringify({ d: p.devices, c: p.chats, s: p.social });
      p.devices.enabled = true;
      p.chats.contacts = [{ id: 'cA', name: 'A' }, { id: 'cB', name: 'B' }];
      const v = p.vars[0];
      p.social = { name: 'X', notify: true, posts: [
        { id: 'p1', author: 'cA', text: 'eins', mode: 'auto', conds: [] },
        { id: 'p2', author: 'cB', text: 'zwei', mode: 'action', conds: [] },
        { id: 'p3', author: 'cA', text: 'drei', mode: 'auto', conds: [{ type: 'social', post: 'p2', state: 'shown' }] }] };
      VN.migrate(p);
      const rs = VN.newRunState();
      DV.socialSync(rs);
      if (DV.feed(rs).map((x) => x.id).join() !== 'p1') out.push('automatisch: ' + DV.feed(rs).map((x) => x.id).join());
      VN.applyActions([{ type: 'socialPost', post: 'p2', quiet: true }], rs);
      DV.socialSync(rs);
      if (DV.feed(rs).map((x) => x.id).join() !== 'p3,p2,p1') out.push('Aktion/Reihenfolge: ' + DV.feed(rs).map((x) => x.id).join());
      if (!VN.checkConds([{ type: 'social', post: 'p2', state: 'shown' }], rs)) out.push('Bedingung sichtbar');
      VN.applyActions([{ type: 'socialDelete', post: 'p2' }], rs);
      if (DV.feed(rs).some((x) => x.id === 'p2') || !VN.checkConds([{ type: 'social', post: 'p2', state: 'deleted' }], rs)) out.push('Löschen');
      p.chats.contacts[0].followers = 100;
      VN.applyActions([{ type: 'socialFollowers', contact: 'cA', op: 'add', amount: 50 }, { type: 'socialFollowers', contact: 'cA', op: 'pct', amount: 100 }], rs);
      if (DV.followers(DV.contact('cA'), rs) !== 300) out.push('Follower: ' + DV.followers(DV.contact('cA'), rs));
      if (!VN.checkConds([{ type: 'socialFollowers', contact: 'cA', cmp: '>=', value: 300 }], rs) || VN.checkConds([{ type: 'socialFollowers', contact: 'cA', cmp: '<', value: 300 }], rs)) out.push('Follower-Bedingung');
      VN.applyActions([{ type: 'socialFollowers', contact: 'cA', op: 'set', amount: 7 }], rs);
      if (DV.followers(DV.contact('cA'), rs) !== 7) out.push('Follower setzen');
      if (!DV.list().length) { const d = DV.newDevice('phone'); p.devices.list.push(d); }
      if (!DV.BUILTIN.social.on()) out.push('App nicht verfügbar');
      const t = JSON.parse(keep); p.devices = t.d; p.chats = t.c; p.social = t.s; VN.migrate(p);
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Social Media: ' + r.join(', '));
    else log('✓ Social Media: Beiträge per Bedingung und Aktion, Reihenfolge, Löschen');
  } catch (e) { general.push('Social Media: ' + e.message); }

  // 19. Korrekturrunde 0.9.20: Speichern meldet Fehler ehrlich, Sprachkürzel geprüft, SHA-256 für Plugins
  try {
    const r = JSON.parse(await js(`(async () => {
      const out = [], keepDir = VN.dir;
      // Speichern, das verweigert wird (anderer Ordner → Antwort null, kein Fehler), darf nicht als gespeichert gelten
      const keepToast = VN.toast; VN.toast = () => {};
      VN.dir = keepDir + '-gibt-es-nicht';
      VN.markDirty();
      const bad = await VN.flush();
      VN.dir = keepDir; VN.toast = keepToast;
      if (bad !== false || !VN.dirty) out.push('Fehlgeschlagenes Speichern gilt als gespeichert');
      const good = await VN.flush();
      if (good !== true || VN.dirty) out.push('Speichern nach Fehler klappt nicht');
      // Sprachkürzel aus fremden Dateien
      const p = { languages: ['de"><script>x</script>', 'en', 'pt-BR', 'en'] };
      try { VN.migrate(p); } catch (e) { /* andere Felder fehlen – egal */ }
      if (JSON.stringify(p.languages) !== '["en","pt-BR"]') out.push('Sprachkürzel: ' + JSON.stringify(p.languages));
      // SHA-256 (Testvektor) und gleiches Ergebnis wie crypto.subtle
      if (VNPlugin.shaSync('abc') !== 'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad') out.push('SHA-256 falsch');
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('Grüße ✓'));
      if (VNPlugin.shaSync('Grüße ✓') !== 'sha256:' + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')) out.push('SHA-256 weicht ab');
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Korrekturen: ' + r.join(', '));
    else log('✓ Korrekturen: Speicherfehler wird erkannt, Sprachkürzel geprüft, SHA-256 für Plugins');
  } catch (e) { general.push('Korrekturen: ' + e.message); }

  // 18. Kurven-Editor: eigene Bézier-Kurven und „Halten“ zwischen Keyframes
  try {
    const r = JSON.parse(await js(`(() => {
      const out = [], near = (a, b) => Math.abs(a - b) < 0.002;
      const lin = Fx.bezier(0, 0, 1, 1);
      if (![0.1, 0.3, 0.77].every((t) => near(lin(t), t))) out.push('Bézier linear');
      const css = Fx.bezier(0.42, 0, 0.58, 1);
      if (!near(css(0.5), 0.5) || css(0.25) >= 0.25) out.push('Bézier weich');
      if (Fx.ease('cb:0.2,0,0.1,1.6') !== 'cubic-bezier(0.2,0,0.1,1.6)') out.push('CSS-Kurve');
      if (Fx.ease('cb:1.5,0,-1,1') !== 'cubic-bezier(1,0,0,1)') out.push('CSS-Kurve x begrenzt');
      if (Fx.ease('hold') !== 'steps(1, end)') out.push('CSS halten');
      const keys = [{ t: 0, v: 0, e: 'ease-in-out' }, { t: 1, v: 10, e: 'cb:0.2,0,0.1,1.6' }, { t: 2, v: 20, e: 'hold' }];
      const over = Math.max(...[0.6, 0.7, 0.8, 0.9].map((t) => Anim.sample(keys, t, 'v')));
      if (!(over > 10)) out.push('eigene Kurve schwingt nicht über (' + over + ')');
      if (Anim.sample(keys, 1.5, 'v') !== 10 || Anim.sample(keys, 2, 'v') !== 20) out.push('Halten');
      if (!window.CurveEd || CurveEd.fmt(CurveEd.pts('ease-in-out', 'anim')) !== 'cb:0.645,0.045,0.355,1') out.push('Kurven-Editor');
      const box = CurveEd.box('back', () => {}, { mode: 'css' });
      if (!box.querySelector('.cv-h') || !box.querySelector('select')) out.push('Kurven-Feld');
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Kurven: ' + r.join(', '));
    else log('✓ Kurven-Editor: Bézier-Kurven, Überschwingen und Halten');
  } catch (e) { general.push('Kurven: ' + e.message); }

  // 17. Fitness: Langhantel (Taste hämmern) und Kurzhanteln (Rhythmus) – mit echten Tastendrücken gespielt
  try {
    const r = JSON.parse(await js(`(async () => {
      const out = [], M = VNPlugin.plugins.minispiele;
      const play = (key, params, bot) => new Promise((done) => {
        const def = VNPlugin.actionDef('minispiele.' + key);
        if (!def) { out.push('Aktion ' + key + ' fehlt'); return done(null); }
        const host = document.createElement('div'); host.className = 'shop-preview-host'; document.body.appendChild(host);
        const ctx = VNPlugin.makeCtx(VN.newRunState());
        ctx.overlay = (o = {}) => { const p = document.createElement('div'); p.className = 'plugin-panel'; host.appendChild(p); return { el: p, root: host, close: () => p.remove() }; };
        ctx.vars.set = () => {}; ctx.sound = () => {};
        const P = {}; for (const pa of def.params) P[pa.key] = pa.default; Object.assign(P, params);
        const kd = (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
        const iv = setInterval(() => bot(kd, host), 15);
        const to = setTimeout(() => { clearInterval(iv); host.remove(); out.push(key + ' hängt'); done(null); }, 20000);
        Promise.resolve(def.run(P, ctx)).then((res) => { clearTimeout(to); clearInterval(iv); host.remove(); done(VNPlugin.result(res)); });
      });
      // Langhantel: schnell hämmern = geschafft, nichts tun = nicht geschafft
      let n = 0;
      const a = await play('langhantel', { schwierigkeit: 'leicht', wiederholungen: 2 }, (kd) => { if (n++ % 4 === 0) kd(' '); });
      if (a && !a.ok) out.push('Langhantel trotz Hämmern nicht geschafft');
      const b = await play('langhantel', { zeitlimit: 1 }, () => {});
      if (b && (b.ok || b.score > 0.05)) out.push('Langhantel ohne Drücken geschafft');
      // Kurzhanteln: Bot drückt oben am höchsten Punkt
      const c = await play('kurzhanteln', { schwierigkeit: 'leicht', treffer: 4, fehler: 0, tasteLinks: 'J', tasteRechts: 'L' }, (kd, host) => {
        host.querySelectorAll('.mg-lift-dbg').forEach((g, i) => {
          const y = parseFloat(g.getAttribute('transform').split(' ')[1]);
          const z = host.querySelectorAll('.mg-lift-zone')[i];
          if (y < 47 && !z.classList.contains('hit')) kd(i ? 'l' : 'j');
        });
      });
      if (c && (!c.ok || c.score < 0.9)) out.push('Kurzhanteln: Bot nicht perfekt (' + JSON.stringify(c) + ')');
      // Kurzhanteln: wild drücken = Fehler = verloren
      const d = await play('kurzhanteln', { fehler: 2 }, (kd) => { kd('j'); });
      if (d && d.ok) out.push('Kurzhanteln: Dauerdrücken geschafft');
      if (!M.skillEffects || !M.skillEffects.kurzhantelZone || !M.designs.langhantel.colors) out.push('Perks/Designs fehlen');
      return JSON.stringify(out);
    })()`));
    if (r.length) general.push('Fitness: ' + r.join(', '));
    else log('✓ Fitness: Langhantel und Kurzhanteln (gewinnen und verlieren mit Tastendruck)');
  } catch (e) { general.push('Fitness: ' + e.message); }

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
