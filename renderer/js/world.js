// Welt & Orte: Orte (Hub-Szenen), Weltkarte(n), Zuhause, Ereignisse an Orten, freie Zeit.
// Fest in der Engine, abschaltbar (Spielsysteme → Übersicht). Spieler-Bildschirm: player-world.js
(function () {
  const W = (VN.World = {});

  W.cfg = () => {
    const p = VN.project;
    p.world = Object.assign({ enabled: false, home: '', travel: 1, freeAtStart: true, maps: [], events: [], hudMap: true, hudHome: true }, p.world || {});
    return p.world;
  };
  W.on = () => !!(VN.project && VN.project.world && VN.project.world.enabled);
  W.locs = () => VN.project.scenes.filter((s) => s.type === 'hub' && s.loc);
  W.isLoc = (id) => { const s = VN.scene(id); return !!(s && s.type === 'hub' && s.loc); };
  W.loc = (id) => { const s = VN.scene(id); return s && s.loc ? s.loc : null; };

  // ---------- Zustand im Spielstand ----------
  W.state = (rs) => {
    if (!rs.world) {
      const c = W.cfg();
      rs.world = { unlocked: {}, free: !!c.freeAtStart, here: '', ret: '', done: {} };
      for (const s of W.locs()) if ((s.loc.unlock || 'start') === 'start') rs.world.unlocked[s.id] = true;
    }
    return rs.world;
  };
  W.unlocked = (rs, id) => !!W.state(rs).unlocked[id];
  // Offen zur aktuellen Tageszeit?
  W.openNow = (rs, id) => {
    const L = W.loc(id);
    if (!L || !L.hours || !L.hours.length || !(VN.Life && VN.Life.timeOn())) return true;
    VN.Life.initRun(rs);
    return L.hours.includes(rs.time.slot);
  };
  // Zustand eines Ortes für Karte: hidden | unknown | locked | closed | open
  W.status = (rs, id) => {
    const L = W.loc(id);
    if (!L) return 'hidden';
    if (!W.unlocked(rs, id)) return L.whenLocked === 'unknown' ? 'unknown' : L.whenLocked === 'visible' ? 'locked' : 'hidden';
    if (!W.openNow(rs, id)) return 'closed';
    return 'open';
  };
  W.homeOk = (rs) => { const h = W.cfg().home; return !!(h && W.isLoc(h) && W.unlocked(rs, h)); };

  // ---------- Ereignisse an Orten ----------
  // { id, name, loc ('' = überall), scene, conds, must, once, mark: ''|'!'|'♥' }
  W.events = () => W.cfg().events;
  W.eventReady = (rs, ev, locId) => {
    if (!ev.scene || !VN.scene(ev.scene)) return false;
    if (ev.loc && ev.loc !== locId) return false;
    if (ev.once !== false && W.state(rs).done[ev.id]) return false;
    return VN.checkConds(ev.conds || [], rs);
  };
  // Nächstes Ereignis beim Betreten: zuerst Pflicht, dann optionale
  W.pickEvent = (rs, locId) => {
    const list = W.events().filter((ev) => W.eventReady(rs, ev, locId));
    return list.find((e) => e.must) || list[0] || null;
  };
  W.markFor = (rs, locId) => {
    const list = W.events().filter((ev) => ev.loc === locId && ev.mark && W.eventReady(rs, ev, locId));
    if (!list.length) return '';
    return list.some((e) => e.mark === '!') ? '!' : list[0].mark;
  };

  // ---------- Karten ----------
  W.maps = () => W.cfg().maps;
  W.map = (id) => W.maps().find((m) => m.id === id) || null;
  W.rootMap = () => W.maps().find((m) => !m.parent) || W.maps()[0] || null;
  // Auf welcher Karte liegt ein Ort?
  W.mapOf = (locId) => W.maps().find((m) => (m.pins || []).some((p) => p.loc === locId)) || null;

  // ---------- Prüfung für den Editor ----------
  W.issues = () => {
    const out = [];
    if (!W.on()) return out;
    const c = W.cfg();
    const unlockedSomewhere = new Set();
    const walk = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); if (o.type === 'unlockLoc' && o.scene) unlockedSomewhere.add(o.scene); for (const k in o) if (o[k] && typeof o[k] === 'object') walk(o[k]); };
    walk(VN.project.scenes); walk(c.events); walk(VN.project.items);
    for (const s of W.locs()) {
      if ((s.loc.unlock || 'start') === 'action' && !unlockedSomewhere.has(s.id)) out.push({ scene: s, text: 'Ort „' + s.name + '“ wird nirgends freigeschaltet' });
      if (c.maps.length && !W.mapOf(s.id) && c.home !== s.id) out.push({ scene: s, text: 'Ort „' + s.name + '“ liegt auf keiner Karte' });
      if (s.loc.hours && s.loc.hours.length === 0) out.push({ scene: s, text: 'Ort „' + s.name + '“ hat zu keiner Tageszeit offen' });
    }
    if (c.home && !W.isLoc(c.home)) out.push({ scene: VN.scene(c.home) || null, text: 'Zuhause ist kein Ort (Hub-Szene als Ort markieren)' });
    for (const ev of c.events) {
      const nm = '„' + (ev.name || 'Ereignis') + '“';
      if (!ev.scene || !VN.scene(ev.scene)) out.push({ scene: null, where: ev.name, text: 'Ereignis ' + nm + ': Szene fehlt' });
      if (ev.loc && !W.isLoc(ev.loc)) out.push({ scene: null, where: ev.name, text: 'Ereignis ' + nm + ': Ort fehlt oder ist kein Ort mehr' });
      for (const cd of ev.conds || []) { const pr = VN.condProblem(cd); if (pr) out.push({ scene: VN.scene(ev.scene) || null, where: ev.name, text: 'Ereignis ' + nm + ': ' + pr }); }
    }
    for (const m of c.maps) for (const pin of m.pins || []) {
      if (pin.loc && !W.isLoc(pin.loc)) out.push({ scene: null, text: 'Karte „' + m.name + '“: Pin zeigt auf keinen Ort' });
      if (pin.map && !W.map(pin.map)) out.push({ scene: null, text: 'Karte „' + m.name + '“: Unterkarte fehlt' });
    }
    return out;
  };

  // ---------- Pfade: Ereignisse und Reisen als Verbindungen ----------
  const baseEdges = VN.edgesOf;
  VN.edgesOf = (s) => {
    const out = baseEdges(s);
    if (!W.on()) return out;
    if (s.type === 'hub' && s.loc) {
      for (const ev of W.events()) if ((ev.loc === s.id || !ev.loc) && VN.scene(ev.scene)) out.push({ to: ev.scene, label: (ev.must ? '❗ ' : '') + (ev.name || 'Ereignis'), kind: 'event', ev });
      // Reisen: jeder Ort ist von jedem anderen erreichbar (nur für „erreichbar“, nicht gezeichnet)
      for (const o of W.locs()) if (o.id !== s.id) out.push({ to: o.id, label: 'Reise', kind: 'world' });
    }
    if (s.type === 'story' && s.next === '@return') {
      for (const ev of W.events()) if (ev.scene === s.id && ev.loc && VN.scene(ev.loc)) out.push({ to: ev.loc, label: 'zurück', kind: 'back' });
    }
    if (s.type === 'story' && s.next === '@home' && VN.scene(W.cfg().home)) out.push({ to: W.cfg().home, label: 'nach Hause', kind: 'back' });
    return out;
  };

  // ---------- Bedingungen und Aktionen ----------
  const locOpts = () => [['', '— Ort —'], ...W.locs().map((s) => [s.id, s.name])];
  VN.registerCond('atLoc', {
    label: '📍 Spieler ist am Ort', on: W.on, make: () => ({ scene: '' }),
    check: (c, rs) => W.state(rs).here === c.scene,
    text: (c) => { const s = VN.scene(c.scene); return 'am Ort ' + (s ? s.name : '?'); },
    problem: (c) => (W.isLoc(c.scene) ? null : 'Ort fehlt'),
    row: (row, c, sel) => row.appendChild(sel(c.scene || '', locOpts(), (v) => VN.mutate(() => { c.scene = v; })))
  });
  VN.registerCond('locOpen', {
    label: '📍 Ort freigeschaltet', on: W.on, make: () => ({ scene: '', value: true }),
    check: (c, rs) => W.unlocked(rs, c.scene) === (c.value !== false),
    text: (c) => { const s = VN.scene(c.scene); return (s ? s.name : '?') + (c.value === false ? ' noch gesperrt' : ' freigeschaltet'); },
    problem: (c) => (W.isLoc(c.scene) ? null : 'Ort fehlt'),
    row: (row, c, sel) => { row.appendChild(sel(c.scene || '', locOpts(), (v) => VN.mutate(() => { c.scene = v; }))); row.appendChild(sel(String(c.value !== false), [['true', 'ist frei'], ['false', 'ist gesperrt']], (v) => VN.mutate(() => { c.value = v === 'true'; }))); }
  });
  VN.registerCond('freeTime', {
    label: '📍 Freie Zeit', on: W.on, make: () => ({ value: true }),
    check: (c, rs) => W.state(rs).free === (c.value !== false),
    text: (c) => (c.value === false ? 'keine freie Zeit' : 'freie Zeit'),
    row: (row, c, sel) => row.appendChild(sel(String(c.value !== false), [['true', 'läuft'], ['false', 'läuft nicht']], (v) => VN.mutate(() => { c.value = v === 'true'; })))
  });
  VN.registerAction('unlockLoc', {
    label: '📍 Ort freischalten / sperren', on: W.on, make: () => ({ scene: '', value: true }),
    apply: (a, rs) => { const st = W.state(rs); if (a.value === false) delete st.unlocked[a.scene]; else if (a.scene) { const nw = !st.unlocked[a.scene]; st.unlocked[a.scene] = true; if (nw && window.Player && Player.worldToast) Player.worldToast(a.scene); } },
    text: (a) => { const s = VN.scene(a.scene); return (a.value === false ? 'Sperren: ' : 'Freischalten: ') + (s ? s.name : '?'); },
    problem: (a) => (W.isLoc(a.scene) ? null : 'Ort fehlt'),
    row: (row, a, sel) => { row.appendChild(sel(a.scene || '', locOpts(), (v) => VN.mutate(() => { a.scene = v; }))); row.appendChild(sel(String(a.value !== false), [['true', 'freischalten'], ['false', 'sperren']], (v) => VN.mutate(() => { a.value = v === 'true'; }))); }
  });
  VN.registerAction('freeTime', {
    label: '📍 Freie Zeit beginnt / endet', on: W.on, make: () => ({ value: true }),
    apply: (a, rs) => { W.state(rs).free = a.value !== false; },
    text: (a) => (a.value === false ? 'Freie Zeit endet' : 'Freie Zeit beginnt'),
    row: (row, a, sel) => row.appendChild(sel(String(a.value !== false), [['true', 'beginnt'], ['false', 'endet']], (v) => VN.mutate(() => { a.value = v === 'true'; })))
  });
  VN.registerAction('openMap', {
    label: '🗺 Karte öffnen', on: W.on, make: () => ({}),
    apply: (a, rs, gains) => { if (window.Player && Player.openMap) gains.pending.push(Player.openMap()); },
    text: () => 'Karte öffnen', row: () => {}
  });
  VN.registerAction('travel', {
    label: '📍 Zu Ort gehen', on: W.on, make: () => ({ scene: '' }),
    apply: (a, rs) => { if (window.Player && Player.travelTo) setTimeout(() => Player.travelTo(a.scene, { free: true }), 0); },
    text: (a) => { const s = VN.scene(a.scene); return 'Gehe zu ' + (s ? s.name : '?'); },
    problem: (a) => (W.isLoc(a.scene) ? null : 'Ort fehlt'),
    row: (row, a, sel) => row.appendChild(sel(a.scene || '', locOpts(), (v) => VN.mutate(() => { a.scene = v; })))
  });

  // Texte fürs Transkript
  const base = VN.collectTexts;
  VN.collectTexts = () => {
    const out = base();
    if (!W.on()) return out;
    for (const s of W.locs()) if (s.loc.lockText) out.push({ id: s.id + ':lock', area: 'Welt', where: s.name, who: 'Gesperrt-Grund', text: s.loc.lockText, set: (v) => { s.loc.lockText = v; } });
    for (const m of W.maps()) out.push({ id: m.id + ':name', area: 'Welt', where: 'Karte', who: 'Kartenname', text: m.name || '', set: (v) => { m.name = v; } });
    return out;
  };
})();
