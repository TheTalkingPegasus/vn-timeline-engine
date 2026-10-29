// Aufbau (Idle): Gebäude produzieren Rohstoffe (= Währungen), werden mit steigenden Kosten ausgebaut,
// Meilensteine treiben die Geschichte voran. Fest in der Engine, abschaltbar.
// Produktion: in Echtzeit (nur beim Spielen), zusätzlich bei geschlossenem Spiel (gedeckelt) oder in Spielzeit (pro Tageszeit).
// Editor: idle-edit.js · Spiel: player-idle.js
(function () {
  const ID = (VN.Idle = {});
  const P = () => VN.project;

  ID.MODES = [['realtime', 'Echtzeit, nur während gespielt wird'], ['offline', 'Echtzeit, auch bei geschlossenem Spiel'], ['gametime', 'Spielzeit (pro Tageszeit, braucht „Zeit & Kalender“)']];
  ID.cfg = () => {
    const p = P();
    p.idle = Object.assign({ enabled: false, title: 'Aufbau', key: 'k', mode: 'realtime', offlineMax: 8, offlinePct: 50, click: false, catchup: 100, warnMin: 20, buildings: [], milestones: [], hidden: false }, p.idle || {});
    return p.idle;
  };
  ID.on = () => !!(P() && P().idle && P().idle.enabled);
  ID.unit = () => (ID.cfg().mode === 'gametime' ? 'Tageszeit' : 'Minute');
  ID.building = (id) => ID.cfg().buildings.find((b) => b.id === id) || null;
  const curOf = (id) => (P().currencies || []).find((c) => c.id === id) || null;
  ID.curName = (id) => { const c = curOf(id); return c ? (VN.tr ? VN.tr(c.id + ':name', c.name) : c.name) : '?'; };
  ID.newBuilding = () => ({ id: VN.uid('bd'), name: VN.t('Neues Gebäude'), icon: '🏠', image: null, desc: '', max: 10, start: 0, costs: [{ cur: (P().currencies[0] || {}).id || '', amount: 10 }], grow: 1.5, prods: [{ cur: (P().currencies[0] || {}).id || '', amount: 5 }], clickable: false, clickAmount: 1, conds: [], hideLocked: false });
  ID.newMilestone = () => ({ id: VN.uid('ms'), name: VN.t('Neues Ziel'), desc: '', conds: [], actions: [], target: 10, message: '' });

  // ---------- Zustand ----------
  ID.state = (rs) => {
    if (!rs.idle) {
      rs.idle = { lv: {}, frac: {}, last: Date.now(), play: 0, since: 0, done: {}, clicks: 0 };
      for (const b of ID.cfg().buildings) if (Number(b.start) > 0) rs.idle.lv[b.id] = Math.min(ID.max(b), Math.floor(Number(b.start)));
    }
    return rs.idle;
  };
  ID.level = (rs, b) => Math.min(ID.max(b), ID.state(rs).lv[b.id] || 0);
  ID.max = (b) => Math.max(1, Number(b.max) || 1);
  ID.unlocked = (rs, b) => !(b.conds || []).length || VN.checkConds(b.conds, rs);
  // Kosten der nächsten Stufe (Stufe lvl → lvl+1), mit Rabatt aus Skilltrees
  // Kosten der nächsten Stufe (Stufe lvl → lvl+1), mit Rabatt aus Skilltrees.
  // Mehrfach eingetragene Währungen werden zusammengezählt (sonst würde jede Zeile einzeln geprüft).
  ID.cost = (b, lvl, rs) => {
    const sum = new Map();
    for (const c of b.costs || []) if (c.cur) sum.set(c.cur, (sum.get(c.cur) || 0) + (Number(c.amount) || 0));
    return [...sum].map(([cur, amount]) => {
      let n = amount * Math.pow(Number(b.grow) || 1, lvl);
      if (rs && VN.bonus) n = VN.bonus('idle.cost', n, rs, b.id);
      return { cur, amount: Math.max(0, Math.ceil(n)) };
    });
  };
  ID.canPay = (rs, cost) => cost.every((c) => (rs.money[c.cur] || 0) >= c.amount);
  // Produktion pro Einheit (Minute bzw. Tageszeit) je Rohstoff
  ID.prodOf = (b, lvl, rs) => {
    const out = {};
    for (const p of b.prods || []) {
      if (!p.cur) continue;
      let n = (Number(p.amount) || 0) * lvl;
      if (rs && VN.bonus) n = VN.bonus('idle.prod', n, rs, b.id);
      out[p.cur] = (out[p.cur] || 0) + n;
    }
    return out;
  };
  // Aufholbonus: dauert das aktuelle Ziel länger als geplant, läuft alles schneller
  ID.catchup = (rs) => {
    const c = ID.cfg();
    if (!(Number(c.catchup) > 0)) return 1;
    const ms = ID.nextMilestone(rs);
    if (!ms || !(Number(ms.target) > 0)) return 1;
    const st = ID.state(rs);
    return st.play - st.since > Number(ms.target) ? 1 + Number(c.catchup) / 100 : 1;
  };
  ID.rate = (rs) => {
    const out = {};
    const cu = ID.catchup(rs);
    for (const b of ID.cfg().buildings) {
      const l = ID.level(rs, b);
      if (!l) continue;
      for (const [k, v] of Object.entries(ID.prodOf(b, l, rs))) out[k] = (out[k] || 0) + v * cu;
    }
    return out;
  };
  // Produziert für „units“ Einheiten (Minuten oder Tageszeiten). Bruchteile werden gesammelt, ins Geld kommen ganze Zahlen.
  ID.produce = (rs, units, factor) => {
    if (!ID.on() || !(units > 0)) return {};
    const st = ID.state(rs);
    const rate = ID.rate(rs);
    const got = {};
    for (const [cur, perUnit] of Object.entries(rate)) {
      if (!curOf(cur)) continue;
      const x = (st.frac[cur] || 0) + perUnit * units * (factor == null ? 1 : factor);
      const whole = Math.floor(x);
      st.frac[cur] = x - whole;
      if (whole > 0) { VN.addMoney(rs, cur, whole, true); got[cur] = whole; }
    }
    st.play += units;
    return got;
  };
  // Ausbauen
  ID.status = (rs, b) => {
    const l = ID.level(rs, b);
    if (l >= ID.max(b)) return 'max';
    if (!ID.unlocked(rs, b)) return 'locked';
    return ID.canPay(rs, ID.cost(b, l, rs)) ? 'buy' : 'poor';
  };
  ID.build = (rs, b, free) => {
    if (!free && ID.status(rs, b) !== 'buy') return false;
    const st = ID.state(rs);
    const l = ID.level(rs, b);
    if (l >= ID.max(b)) return false;
    if (!free) for (const c of ID.cost(b, l, rs)) VN.addMoney(rs, c.cur, -c.amount, true);
    st.lv[b.id] = l + 1;
    if (window.VNPlugin && !ID._sim) setTimeout(() => VNPlugin.hook('onBuild', b.id, l + 1, VNPlugin.makeCtx(rs)), 0);
    return true;
  };
  // Klick auf ein Gebäude (wenn eingeschaltet): kleiner Ertrag sofort
  ID.clickGain = (rs, b) => {
    const p = (b.prods || []).find((x) => x.cur);
    if (!p) return null;
    let n = (Number(b.clickAmount) || 1) * Math.max(1, ID.level(rs, b));
    if (VN.bonus) n = VN.bonus('idle.click', n, rs, b.id);
    return { cur: p.cur, amount: Math.max(1, Math.round(n)) };
  };
  ID.click = (rs, b) => {
    if (!ID.cfg().click || !b.clickable || !ID.level(rs, b)) return null;
    const g = ID.clickGain(rs, b);
    if (!g) return null;
    VN.addMoney(rs, g.cur, g.amount, true);
    ID.state(rs).clicks++;
    return g;
  };
  // Meilensteine: erstes noch offenes Ziel; erreichte werden abgehakt und lösen ihre Aktionen aus
  ID.nextMilestone = (rs) => ID.cfg().milestones.find((m) => !ID.state(rs).done[m.id]) || null;
  ID.checkMilestones = (rs) => {
    const st = ID.state(rs);
    const gains = [];
    gains.pending = [];
    const reached = [];
    for (const m of ID.cfg().milestones) {
      if (st.done[m.id]) continue;
      if (!(m.conds || []).length || !VN.checkConds(m.conds, rs)) break; // der Reihe nach
      st.done[m.id] = st.play || 0.0001;
      st.since = st.play;
      reached.push(m);
      // In der Zeitvorschau nur Aktionen ohne Nebenwirkungen (keine Plugins, Fenster, Kämpfe, Hooks)
      const acts = ID._sim ? (m.actions || []).filter((a) => SIM_SAFE.includes(a.type)) : (m.actions || []);
      const g = VN.applyActions(acts, rs, 'idle:' + m.id);
      for (const x of g) gains.push(x);
      for (const f of g.pending || []) gains.pending.push(f);
      if (window.VNPlugin && !ID._sim) setTimeout(() => VNPlugin.hook('onMilestone', m.id, VNPlugin.makeCtx(rs)), 0);
    }
    gains.reached = reached;
    return gains;
  };
  // Fortschritt eines Ziels (0..1) aus seinen Geld- und Gebäude-Bedingungen
  ID.progress = (rs, m) => {
    const parts = [];
    for (const c of m.conds || []) {
      if (c.type === 'money') parts.push(Math.min(1, (rs.money[c.currency] || 0) / Math.max(1, Number(c.amount) || 1)));
      else if (c.type === 'idleLevel') { const b = ID.building(c.building); parts.push(b ? Math.min(1, ID.level(rs, b) / Math.max(1, Number(c.level) || 1)) : 0); }
      else parts.push(VN.checkCond(c, rs) ? 1 : 0);
    }
    return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
  };

  // ---------- Zeitvorschau für den Editor ----------
  // Ein „vernünftiger“ Spieler kauft immer den Ausbau mit dem besten Verhältnis aus Mehrertrag und Preis.
  const SIM_SAFE = ['setVar', 'addVar', 'money', 'giveItem', 'takeItem', 'idleBuild', 'idleProduce'];
  ID.preview = (opts = {}) => {
    ID._sim = true;
    try { return previewRun(opts); } finally { ID._sim = false; }
  };
  const previewRun = (opts) => {
    const c = ID.cfg();
    const rs = VN.newRunState();
    ID.state(rs);
    const step = 0.25; // Viertel-Einheit
    const limit = opts.limit || 600;
    const out = [];
    let t = 0;
    // Rohstoffe ohne Einnahme, die aber gebraucht werden, zählen dreifach (sonst kauft der Test sich arm)
    const value = (b) => { const l = ID.level(rs, b); const now = ID.prodOf(b, l, rs), next = ID.prodOf(b, l + 1, rs); const r = ID.rate(rs); let s = 0; for (const k of Object.keys(next)) s += (next[k] - (now[k] || 0)) * (r[k] ? 1 : 3); return s; };
    const price = (b) => ID.cost(b, ID.level(rs, b), rs).reduce((s, x) => s + x.amount, 0) || 0.001;
    const msLeft = () => c.milestones.filter((m) => !ID.state(rs).done[m.id]);
    let guard = 0;
    while (t < limit && msLeft().length && guard++ < 200000) {
      // kaufen, solange etwas Sinnvolles bezahlbar ist
      for (let k = 0; k < 50; k++) {
        const cands = c.buildings.filter((b) => ID.status(rs, b) === 'buy');
        if (!cands.length) break;
        // Was das aktuelle Ziel verlangt, zuerst; sonst das lohnendste
        const ms = ID.nextMilestone(rs);
        const goal = new Set(((ms && ms.conds) || []).filter((x) => x.type === 'idleLevel' && ID.building(x.building) && ID.level(rs, ID.building(x.building)) < (Number(x.level) || 1)).map((x) => x.building));
        // auch die Gebäude, die ein gesperrtes Ziel-Gebäude erst freischalten
        for (let d = 0; d < 4; d++) for (const id of [...goal]) { const gb = ID.building(id); if (gb && !ID.unlocked(rs, gb)) for (const x of gb.conds || []) if (x.type === 'idleLevel' && ID.building(x.building) && ID.level(rs, ID.building(x.building)) < (Number(x.level) || 1)) goal.add(x.building); }
        cands.sort((a, b) => (goal.has(b.id) ? 1 : 0) - (goal.has(a.id) ? 1 : 0) || value(b) / price(b) - value(a) / price(a) || price(a) - price(b));
        // Ohne laufende Produktion zuerst irgendein Gebäude, das etwas produziert
        ID.build(rs, cands[0]);
      }
      const g = ID.checkMilestones(rs);
      for (const m of g.reached) out.push({ m, at: t });
      if (!msLeft().length) break;
      ID.produce(rs, step);
      t += step;
    }
    for (const m of msLeft()) out.push({ m, at: null });
    return out.map((x, i) => Object.assign(x, { took: x.at == null ? null : x.at - (i ? (out[i - 1].at || 0) : 0) }));
  };
  ID.fmtTime = (units) => {
    if (units == null) return '∞';
    if (ID.cfg().mode === 'gametime') return Math.ceil(units) + ' ' + (Math.ceil(units) === 1 ? 'Tageszeit' : 'Tageszeiten');
    if (units < 1) return '< 1 Min.';
    if (units < 60) return Math.round(units) + ' Min.';
    return Math.floor(units / 60) + ' Std. ' + Math.round(units % 60) + ' Min.';
  };
  ID.fmtNum = (n) => {
    const x = Number(n) || 0;
    if (Math.abs(x) >= 1e6) return (x / 1e6).toFixed(1).replace(/\.0$/, '') + ' Mio.';
    if (Math.abs(x) >= 10000) return Math.round(x / 1000) + 'k';
    if (Math.abs(x) < 10 && x % 1) return x.toFixed(1);
    return String(Math.round(x));
  };

  // ---------- Spielzeit-Modus: Produktion pro vergangener Tageszeit ----------
  if (VN.Life && VN.Life.advance) {
    const baseAdv = VN.Life.advance;
    VN.Life.advance = (rs, a) => {
      const n = VN.project.time.slots.length || 1;
      VN.Life.initRun(rs);
      const before = rs.time.day * n + rs.time.slot;
      const r = baseAdv(rs, a);
      if (ID.on() && ID.cfg().mode === 'gametime') {
        const after = rs.time.day * n + rs.time.slot;
        if (after > before) { ID.produce(rs, after - before); ID._pendingCheck = true; }
      }
      return r;
    };
  }

  // ---------- Skilltree-Wirkungen ----------
  if (VN.Skills) {
    VN.Skills.CATS.splice(VN.Skills.CATS.length - 1, 0, { key: 'idle', label: 'Aufbau', icon: '🏰', on: ID.on });
    const bName = (id) => { const b = ID.building(id); return b ? b.name : 'alle Gebäude'; };
    VN.Skills.EFFECTS.idleProd = { cat: 'idle', label: 'Mehr Produktion', params: [['building', 'Gebäude', 'select', () => [['', 'alle Gebäude'], ...ID.cfg().buildings.map((b) => [b.id, b.name])]], ['pct', '+ %', 'number', 10]], key: (e) => 'idle.prod' + (e.building ? ':' + e.building : ''), mode: 'pct', value: (e) => Number(e.pct) || 0, text: (e, l) => '+' + (Number(e.pct) || 0) * l + ' % Produktion (' + bName(e.building) + ')' };
    VN.Skills.EFFECTS.idleCost = { cat: 'idle', label: 'Billiger ausbauen', params: [['pct', '− %', 'number', 5]], key: () => 'idle.cost', mode: 'pct', value: (e) => -(Number(e.pct) || 0), text: (e, l) => '−' + (Number(e.pct) || 0) * l + ' % Ausbaukosten' };
    VN.Skills.EFFECTS.idleClick = { cat: 'idle', label: 'Mehr pro Klick', params: [['pct', '+ %', 'number', 25]], key: () => 'idle.click', mode: 'pct', value: (e) => Number(e.pct) || 0, text: (e, l) => '+' + (Number(e.pct) || 0) * l + ' % pro Klick' };
  }

  // ---------- Bedingungen und Aktionen ----------
  const bOpts = () => [['', '— Gebäude —'], ...ID.cfg().buildings.map((b) => [b.id, b.name])];
  VN.registerCond('idleLevel', {
    label: '🏰 Gebäude-Stufe', on: ID.on, make: () => ({ building: '', level: 1 }),
    check: (c, rs) => { const b = ID.building(c.building); return !!b && ID.level(rs, b) >= (Number(c.level) || 1); },
    text: (c) => { const b = ID.building(c.building); return '🏰 ' + (b ? b.name : '?') + ' ab Stufe ' + (c.level || 1); },
    problem: (c) => (ID.building(c.building) ? null : 'Gebäude fehlt'),
    row: (row, c, sel, inp) => { row.appendChild(sel(c.building || '', bOpts(), (v) => VN.mutate(() => { c.building = v; }))); row.appendChild(inp(c.level || 1, (v) => VN.mutate(() => { c.level = Number(v) || 1; }), 'number')); }
  });
  VN.registerCond('idleGoal', {
    label: '🏰 Aufbau-Ziel erreicht', on: ID.on, make: () => ({ ms: '' }),
    check: (c, rs) => !!ID.state(rs).done[c.ms],
    text: (c) => { const m = ID.cfg().milestones.find((x) => x.id === c.ms); return '🏰 Ziel „' + (m ? m.name : '?') + '“ erreicht'; },
    problem: (c) => (ID.cfg().milestones.some((x) => x.id === c.ms) ? null : 'Ziel fehlt'),
    row: (row, c, sel) => row.appendChild(sel(c.ms || '', [['', '— Ziel —'], ...ID.cfg().milestones.map((m) => [m.id, m.name])], (v) => VN.mutate(() => { c.ms = v; })))
  });
  VN.registerAction('idleScreen', {
    label: '🏰 Aufbau öffnen', on: ID.on, make: () => ({}),
    apply: (a, rs, gains) => { if (window.Player && Player.openIdle && gains) gains.pending.push(() => Player.openIdle()); },
    text: () => '🏰 Aufbau öffnen', row: () => {}
  });
  VN.registerAction('idleBuild', {
    label: '🏰 Gebäude ausbauen (geschenkt)', on: ID.on, make: () => ({ building: '' }),
    apply: (a, rs, gains) => { const b = ID.building(a.building); if (b && ID.build(rs, b, true) && gains) gains.push({ kind: 'text', text: '🏰 ' + b.name + ' · ' + VN.tp('Stufe') + ' ' + ID.level(rs, b) }); },
    text: (a) => { const b = ID.building(a.building); return '🏰 ' + (b ? b.name : '?') + ' +1 Stufe'; },
    problem: (a) => (ID.building(a.building) ? null : 'Gebäude fehlt'),
    row: (row, a, sel) => row.appendChild(sel(a.building || '', bOpts(), (v) => VN.mutate(() => { a.building = v; })))
  });
  VN.registerAction('idleProduce', {
    label: '🏰 Zeit überspringen (Produktion)', on: ID.on, make: () => ({ units: 60 }),
    apply: (a, rs, gains) => { const got = ID.produce(rs, Number(a.units) || 0); if (gains) for (const [cur, n] of Object.entries(got)) gains.push({ kind: 'money', id: cur, count: n }); },
    text: (a) => '🏰 ' + (a.units || 0) + ' ' + (ID.cfg().mode === 'gametime' ? 'Tageszeiten' : 'Min.') + ' Produktion',
    row: (row, a, sel, inp) => row.appendChild(inp(a.units != null ? a.units : 60, (v) => VN.mutate(() => { a.units = Number(v) || 0; }), 'number'))
  });

  // ---------- Prüfung ----------
  ID.buildingProblems = (b) => {
    const out = [];
    if (!String(b.name || '').trim()) out.push('Name fehlt');
    if (!(b.prods || []).some((p) => p.cur && Number(p.amount) > 0)) out.push('Produziert nichts');
    for (const x of [...(b.costs || []), ...(b.prods || [])]) if (x.cur && !curOf(x.cur)) out.push('Währung fehlt');
    if ((Number(b.start) || 0) > ID.max(b)) out.push('Startstufe ist höher als die Stufen');
    const seen = new Set(); for (const x of b.costs || []) { if (x.cur && seen.has(x.cur)) out.push('Währung doppelt bei den Kosten (wird zusammengezählt)'); seen.add(x.cur); }
    for (const c of b.conds || []) { const pr = VN.condProblem(c); if (pr) out.push('Freischalten: ' + pr); }
    return out;
  };
  ID.issues = () => {
    const out = [];
    if (!ID.on()) return out;
    const c = ID.cfg();
    if (!P().currencies.length) out.push({ text: 'Aufbau: keine Währungen (Rohstoffe) angelegt' });
    if (c.mode === 'gametime' && !(VN.Life && VN.Life.timeOn())) out.push({ text: 'Aufbau: Spielzeit-Modus braucht „Zeit & Kalender“' });
    const made = new Set(); for (const b of c.buildings) for (const x of b.prods || []) if (x.cur && Number(x.amount) > 0) made.add(x.cur);
    const needed = new Set(); for (const b of c.buildings) for (const x of b.costs || []) if (x.cur && Number(x.amount) > 0) needed.add(x.cur);
    for (const cur of needed) if (!made.has(cur)) out.push({ text: (VN.I18n && VN.I18n.lang === 'en' ? 'Building: ' : 'Aufbau: ') + ID.curName(cur) + ' ' + VN.t('wird zum Bauen gebraucht, aber kein Gebäude stellt es her') });
    if (c.buildings.length && !c.buildings.some((b) => Number(b.start) > 0 || !(b.costs || []).some((x) => Number(x.amount) > 0) || (b.costs || []).every((x) => (P().currencies.find((cu) => cu.id === x.cur) || {}).start >= x.amount))) out.push({ text: 'Aufbau: kein Gebäude ist zu Beginn bezahlbar (Startgeld oder Startstufe fehlt)' });
    for (const b of c.buildings) for (const pr of ID.buildingProblems(b)) out.push({ text: (VN.I18n && VN.I18n.lang === 'en' ? 'Building' : 'Gebäude') + ' „' + b.name + '“: ' + VN.t(pr) });
    for (const m of c.milestones) { if (!(m.conds || []).length) out.push({ text: (VN.I18n && VN.I18n.lang === 'en' ? 'Goal' : 'Ziel') + ' „' + m.name + '“: ' + VN.t('keine Bedingung') }); for (const cd of m.conds || []) { const pr = VN.condProblem(cd); if (pr) out.push({ text: 'Ziel „' + m.name + '“: ' + pr }); } }
    return out;
  };

  // ---------- Texte fürs Transkript ----------
  const baseTexts = VN.collectTexts;
  VN.collectTexts = () => {
    const out = baseTexts();
    if (!ID.on()) return out;
    const c = ID.cfg();
    out.push({ id: 'idle:title', area: 'Aufbau', where: 'Titel', who: 'Aufbau', text: c.title || '', set: (v) => { c.title = v; } });
    for (const x of [...c.buildings, ...c.milestones]) {
      out.push({ id: x.id + ':name', area: 'Aufbau', where: x.name, who: c.buildings.includes(x) ? 'Gebäude' : 'Ziel', text: x.name || '', set: (v) => { x.name = v; } });
      if (x.desc) out.push({ id: x.id + ':desc', area: 'Aufbau', where: x.name, who: 'Beschreibung', text: x.desc, set: (v) => { x.desc = v; } });
      if (x.message) out.push({ id: x.id + ':msg', area: 'Aufbau', where: x.name, who: 'Meldung', text: x.message, set: (v) => { x.message = v; } });
    }
    return out;
  };

  // ---------- Fehlende Felder ergänzen ----------
  const baseMig = VN.migrate;
  VN.migrate = (p) => {
    const r = baseMig(p);
    if (p.idle) {
      p.idle.buildings = Array.isArray(p.idle.buildings) ? p.idle.buildings : [];
      p.idle.milestones = Array.isArray(p.idle.milestones) ? p.idle.milestones : [];
      for (const b of p.idle.buildings) { b.costs = b.costs || []; b.prods = b.prods || []; b.conds = b.conds || []; }
      for (const m of p.idle.milestones) { m.conds = m.conds || []; m.actions = m.actions || []; }
    }
    return r;
  };

  // ---------- Beispiel: Königreich ----------
  ID.example = () => VN.mutate(() => {
    const p = P();
    const c = ID.cfg();
    const cur = (name, color, start) => { let x = p.currencies.find((y) => y.name === name); if (!x) { x = { id: VN.uid('cur'), name, color, start, max: 999999, image: null }; p.currencies.push(x); } return x.id; };
    const gold = (p.currencies[0] && p.currencies[0].id) || cur(VN.t('Gold'), '#e8c86a', 20);
    const wood = cur(VN.t('Holz'), '#a4774a', 0);
    const stone = cur(VN.t('Stein'), '#9aa0a8', 0);
    const goldCur = p.currencies.find((x) => x.id === gold);
    if (goldCur && (Number(goldCur.start) || 0) < 30) goldCur.start = 30;
    const mk = (name, icon, costs, prods, extra) => { const b = Object.assign(ID.newBuilding(), { name: VN.t(name), icon, costs, prods }, extra || {}); c.buildings.push(b); return b; };
    const hut = mk('Holzfällerhütte', '🪓', [{ cur: gold, amount: 10 }], [{ cur: wood, amount: 6 }], { clickable: true, clickAmount: 1 });
    // Der Bauernhof steht von Anfang an: so gibt es immer Gold und man kann sich nicht arm bauen
    const farm = mk('Bauernhof', '🌾', [{ cur: gold, amount: 15 }, { cur: wood, amount: 5 }], [{ cur: gold, amount: 5 }], { clickable: true, start: 1 });
    const quarry = mk('Steinbruch', '⛏️', [{ cur: gold, amount: 40 }, { cur: wood, amount: 20 }], [{ cur: stone, amount: 3 }], { conds: [{ type: 'idleLevel', building: hut.id, level: 3 }] });
    const market = mk('Marktplatz', '🏪', [{ cur: wood, amount: 60 }, { cur: stone, amount: 20 }], [{ cur: gold, amount: 18 }], { conds: [{ type: 'idleLevel', building: farm.id, level: 3 }], grow: 1.6 });
    const castle = mk('Burg', '🏰', [{ cur: gold, amount: 240 }, { cur: wood, amount: 120 }, { cur: stone, amount: 70 }], [{ cur: gold, amount: 40 }], { max: 3, grow: 2.5, conds: [{ type: 'idleLevel', building: market.id, level: 2 }] });
    c.enabled = true;
    c.title = VN.t('Königreich');
    c.click = true;
    c.warnMin = 30;
    c.milestones.push(Object.assign(ID.newMilestone(), { name: VN.t('Ein kleines Dorf'), conds: [{ type: 'idleLevel', building: hut.id, level: 2 }, { type: 'idleLevel', building: farm.id, level: 2 }], target: 5, message: VN.t('Aus ein paar Hütten wird ein Dorf.') }));
    c.milestones.push(Object.assign(ID.newMilestone(), { name: VN.t('Handelsstadt'), conds: [{ type: 'idleLevel', building: market.id, level: 1 }], target: 18, message: VN.t('Händler kommen von weit her.') }));
    c.milestones.push(Object.assign(ID.newMilestone(), { name: VN.t('Eine Burg für das Burgfräulein'), conds: [{ type: 'idleLevel', building: castle.id, level: 1 }], target: 24, message: VN.t('Die Burg steht – das Burgfräulein ist beeindruckt!') }));
  });
})();
