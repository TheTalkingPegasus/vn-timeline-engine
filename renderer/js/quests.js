// Questlog: Questreihen → Quests → Abschnitte. Erledigt sich selbst über Bedingungen oder per Aktion.
// Fest in der Engine, abschaltbar. Editor: quests-edit.js, Spiel: player-notify.js (Questlog-Bildschirm, Einblendungen)
(function () {
  const Q = (VN.Quests = {});
  const NOTIFY_KINDS = [['new', 'Neue Quest'], ['step', 'Abschnitt erledigt'], ['done', 'Quest abgeschlossen'], ['series', 'Questreihe abgeschlossen'], ['fail', 'Gescheitert']];
  Q.NOTIFY_KINDS = NOTIFY_KINDS;
  const NOTIFY_BASE = {
    new: { pos: 'top', anim: 'slide', out: 'fade', dur: 3, text: '{quest}' },
    step: { pos: 'topright', anim: 'slide', out: 'fade', dur: 2.2, text: '{abschnitt}' },
    done: { pos: 'center', anim: 'pop', out: 'fade', dur: 3.2, text: '{quest}' },
    series: { pos: 'center', anim: 'pop', out: 'fade', dur: 4.2, text: '{reihe}' },
    fail: { pos: 'center', anim: 'pop', out: 'shatter', dur: 3, text: '{quest}' }
  };
  Q.cfg = () => {
    const p = VN.project;
    p.quests = Object.assign({ enabled: false, list: [], notify: {}, key: 'q' }, p.quests || {});
    for (const [k] of NOTIFY_KINDS) p.quests.notify[k] = Object.assign({}, NOTIFY_BASE[k], p.quests.notify[k] || {});
    return p.quests;
  };
  Q.on = () => !!(VN.project && VN.project.quests && VN.project.quests.enabled);
  Q.list = () => Q.cfg().list;

  // Alles finden: Reihe, Quest oder Abschnitt nach Kennung
  Q.find = (id) => {
    for (const s of Q.list()) {
      if (s.id === id) return { kind: 'series', series: s };
      for (const q of s.quests || []) {
        if (q.id === id) return { kind: 'quest', series: s, quest: q };
        for (const st of q.steps || []) if (st.id === id) return { kind: 'step', series: s, quest: q, step: st };
      }
    }
    return null;
  };
  Q.whoName = (s) => (s.who && s.who !== 'story' ? s.who : 'Hauptstory');
  Q.whoChar = (s) => (s.who && s.who !== 'story' && VN.Life && VN.Life.relChar ? VN.Life.relChar(s.who) : null);
  Q.label = (id) => { const f = Q.find(id); if (!f) return '?'; return f.kind === 'series' ? f.series.name : f.kind === 'quest' ? f.quest.name : f.quest.name + ' › ' + f.step.name; };

  // ---------- Zustand ----------
  Q.state = (rs) => (rs.quests = rs.quests || { s: {}, q: {} });
  Q.sState = (rs, s) => Q.state(rs).s[s.id] || null;
  Q.qState = (rs, q) => (Q.state(rs).q[q.id] = Q.state(rs).q[q.id] || { st: 'wait', steps: {} });

  // Belohnung ausführen, Gewinne sammeln
  const reward = (rs, list, key, gains) => { if (!list || !list.length) return; const g = VN.applyActions(list, rs, key); for (const x of g) gains.push(x); if (g.pending) for (const pnd of g.pending) gains.pending.push(pnd); };
  const fill = (tpl, o) => String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));
  Q.fill = fill;

  // Startet eine Reihe (bzw. Einzelquest)
  const startSeries = (rs, s, out) => {
    const S = Q.state(rs);
    if (S.s[s.id]) return;
    S.s[s.id] = { st: 'active', q: 0, t: Date.now() };
    const q = (s.quests || [])[0];
    if (q) { Q.qState(rs, q).st = 'active'; out.push({ type: 'new', series: s, quest: q }); }
  };
  const finishQuest = (rs, s, q, out, gains) => {
    const S = Q.state(rs), qs = Q.qState(rs, q), ss = S.s[s.id];
    if (qs.st === 'done') return;
    qs.st = 'done';
    reward(rs, q.reward, 'quest:' + q.id, gains);
    out.push({ type: 'done', series: s, quest: q });
    ss.q = (s.quests || []).indexOf(q) + 1;
    const next = (s.quests || [])[ss.q];
    if (next) { Q.qState(rs, next).st = 'active'; out.push({ type: 'new', series: s, quest: next }); }
    else { ss.st = 'done'; reward(rs, s.reward, 'series:' + s.id, gains); if (!s.single) out.push({ type: 'series', series: s, quest: q }); }
  };
  const failQuest = (rs, s, q, out) => {
    const S = Q.state(rs), qs = Q.qState(rs, q);
    if (qs.st === 'failed') return;
    qs.st = 'failed';
    if (S.s[s.id]) S.s[s.id].st = 'failed';
    out.push({ type: 'fail', series: s, quest: q });
  };
  const doneStep = (rs, s, q, st, out, gains) => {
    const qs = Q.qState(rs, q);
    if (qs.steps[st.id]) return;
    qs.steps[st.id] = Date.now();
    reward(rs, st.reward, 'step:' + st.id, gains);
    out.push({ type: 'step', series: s, quest: q, step: st });
  };
  // Ist die Quest damit fertig?
  const questComplete = (rs, q) => {
    const qs = Q.qState(rs, q), steps = q.steps || [];
    if (!steps.length) return false;
    if (q.order === 'one') return steps.some((x) => qs.steps[x.id]);
    return steps.every((x) => qs.steps[x.id]);
  };

  // Alles prüfen (nach Aktionen, Szenenwechsel, Zeit). Gibt Einblendungen und Gewinne zurück.
  Q.update = (rs) => {
    const out = [], gains = [];
    gains.pending = [];
    if (!Q.on()) return { out, gains };
    for (let round = 0; round < 8; round++) {
      const before = out.length;
      for (const s of Q.list()) {
        const ss = Q.sState(rs, s);
        if (!ss) { if ((s.startMode || 'auto') === 'auto' && VN.checkConds(s.start || [], rs)) startSeries(rs, s, out); continue; }
        if (ss.st !== 'active') continue;
        const q = (s.quests || [])[ss.q];
        if (!q) continue;
        const qs = Q.qState(rs, q);
        if (qs.st === 'wait') qs.st = 'active';
        if ((q.fail || []).length && VN.checkConds(q.fail, rs)) { failQuest(rs, s, q, out); continue; }
        const steps = q.steps || [];
        if (steps.length) {
          if (q.order === 'any' || q.order === 'one') { for (const st of steps) if (!qs.steps[st.id] && (st.conds || []).length && VN.checkConds(st.conds, rs)) doneStep(rs, s, q, st, out, gains); }
          else { const st = steps.find((x) => !qs.steps[x.id]); if (st && (st.conds || []).length && VN.checkConds(st.conds, rs)) doneStep(rs, s, q, st, out, gains); }
          if (questComplete(rs, q)) finishQuest(rs, s, q, out, gains);
        } else if ((q.conds || []).length && VN.checkConds(q.conds, rs)) finishQuest(rs, s, q, out, gains);
      }
      if (out.length === before) break;
    }
    return { out, gains };
  };

  // Manuell (Aktionen)
  Q.apply = (rs, op, id) => {
    const f = Q.find(id);
    const out = [], gains = [];
    gains.pending = [];
    if (!f) return { out, gains };
    if (op === 'start') startSeries(rs, f.series, out);
    else if (op === 'step' && f.kind === 'step') {
      if (!Q.sState(rs, f.series)) startSeries(rs, f.series, out);
      doneStep(rs, f.series, f.quest, f.step, out, gains);
      if (questComplete(rs, f.quest)) finishQuest(rs, f.series, f.quest, out, gains);
    } else if (op === 'done') {
      if (!Q.sState(rs, f.series)) startSeries(rs, f.series, out);
      const q = f.quest || (f.series.quests || [])[Q.sState(rs, f.series).q];
      if (q) finishQuest(rs, f.series, q, out, gains);
    } else if (op === 'fail') {
      if (!Q.sState(rs, f.series)) startSeries(rs, f.series, out);
      const q = f.quest || (f.series.quests || [])[Q.sState(rs, f.series).q];
      if (q) failQuest(rs, f.series, q, out);
    }
    return { out, gains };
  };
  // Wird vom Player gesetzt: zeigt Einblendungen
  Q.notify = null;
  const emit = (res, gains) => { if (res.out.length && Q.notify) Q.notify(res.out); if (gains) { for (const g of res.gains) gains.push(g); for (const p of res.gains.pending || []) gains.pending.push(p); } };
  Q.emit = emit;

  // ---------- Prüfung (rote Markierungen) ----------
  VN.actionProblem = (a) => {
    const p = VN.project;
    if (!a || !a.type) return 'Leere Aktion';
    if ((a.type === 'giveItem' || a.type === 'takeItem') && !p.items.some((x) => x.id === a.item)) return 'Gegenstand fehlt';
    if ((a.type === 'addVar' || a.type === 'setVar') && !p.vars.some((x) => x.id === a.var)) return 'Variable fehlt';
    if (a.type === 'money' && !p.currencies.some((x) => x.id === a.currency)) return 'Währung fehlt';
    if (a.type === 'loot' && !p.lootTables.some((x) => x.id === a.table)) return 'Loot-Tabelle fehlt';
    if ((a.type === 'rel' || a.type === 'gift') && !(VN.Life && VN.Life.relChar(a.char))) return 'Figur fehlt';
    if (a.type === 'charPic' && !(VN.Life && VN.Life.relChar(a.char))) return 'Figur fehlt';
    if (a.type === 'charPic' && !a.image && !a.text) return 'Kein Bild und keine Nachricht';
    if (a.type === 'charPic' && a.image && !VN.asset(a.image)) return 'Bild fehlt';
    if (a.type === 'plugin' && window.VNPlugin && !VNPlugin.actionDef(a.ref)) return 'Plugin fehlt';
    const x = VN.ext.actions[a.type];
    if (x && x.problem) { try { return x.problem(a) || null; } catch (e) { return 'Fehler in der Aktion'; } }
    return null;
  };
  // Wird irgendwo per Aktion erledigt?
  const manualRefs = () => {
    const set = new Set();
    const walk = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); if (/^quest(Step|Done|Fail)$/.test(o.type || '') && o.ref) set.add(o.ref); for (const k in o) if (o[k] && typeof o[k] === 'object') walk(o[k]); };
    walk(VN.project.scenes); walk(VN.project.items); if (VN.project.world) walk(VN.project.world.events);
    return set;
  };
  // Probleme einer Zeile: { name, who, cond, reward } → Texte
  Q.rowProblems = (row, kind, s, refs) => {
    const out = {};
    if (!String(row.name || '').trim()) out.name = 'Name fehlt';
    if (kind === 'series' && s.who && s.who !== 'story') {
      const okChar = (VN.Life && VN.Life.relChar && VN.Life.relChar(s.who)) || VN.project.scenes.some((x) => x.type === 'story' && x.tracks.dialog.some((d) => (d.speaker || '').trim() === s.who));
      if (!okChar) out.who = 'Figur „' + s.who + '“ gibt es nicht (mehr)';
    }
    const conds = kind === 'series' ? s.start || [] : row.conds || [];
    const bad = conds.map(VN.condProblem).filter(Boolean);
    if (bad.length) out.cond = bad.join(', ');
    else if (kind === 'step' && !conds.length && !refs.has(row.id)) out.cond = 'Bedingung fehlt (oder Aktion „Abschnitt erledigt“)';
    else if (kind === 'quest' && !(row.steps || []).length && !conds.length && !refs.has(row.id)) out.cond = 'Bedingung fehlt';
    if (kind === 'quest') { const bf = (row.fail || []).map(VN.condProblem).filter(Boolean); if (bf.length) out.cond = (out.cond ? out.cond + ', ' : '') + 'Scheitern: ' + bf.join(', '); }
    const rw = (row.reward || []).map(VN.actionProblem).filter(Boolean);
    if (rw.length) out.reward = rw.join(', ');
    return out;
  };
  Q.issues = () => {
    const out = [];
    if (!Q.on()) return out;
    const refs = manualRefs();
    for (const s of Q.list()) {
      const add = (row, kind) => { const pr = Q.rowProblems(row, kind, s, refs); for (const t of Object.values(pr)) out.push({ scene: null, where: row.name || s.name, text: 'Quest: ' + t }); };
      add(s, 'series');
      for (const q of s.quests || []) { add(q, 'quest'); for (const st of q.steps || []) add(st, 'step'); }
    }
    return out;
  };

  // ---------- Bedingungen und Aktionen ----------
  const refOpts = (withSteps) => {
    const out = [['', '— Quest —']];
    for (const s of Q.list()) {
      if (!s.single) out.push([s.id, '📜 ' + s.name]);
      for (const q of s.quests || []) {
        out.push([q.id, (s.single ? '📜 ' : '   ') + q.name]);
        if (withSteps) for (const st of q.steps || []) out.push([st.id, '      › ' + st.name]);
      }
    }
    return out;
  };
  VN.registerCond('quest', {
    label: '📜 Quest-Stand', on: Q.on, make: () => ({ ref: '', state: 'done' }),
    check: (c, rs) => {
      const f = Q.find(c.ref); if (!f) return false;
      let st = 'none';
      if (f.kind === 'series') { const ss = Q.sState(rs, f.series); st = ss ? ss.st : 'none'; }
      else if (f.kind === 'quest') { const qs = Q.state(rs).q[f.quest.id]; st = qs ? (qs.st === 'wait' ? 'none' : qs.st) : 'none'; }
      else { const qs = Q.state(rs).q[f.quest.id]; st = qs && qs.steps[f.step.id] ? 'done' : qs && qs.st === 'active' ? 'active' : 'none'; }
      return st === c.state;
    },
    text: (c) => '📜 ' + Q.label(c.ref) + ' ' + ({ none: 'nicht begonnen', active: 'läuft', done: 'erledigt', failed: 'gescheitert' }[c.state] || c.state),
    problem: (c) => (Q.find(c.ref) ? null : 'Quest fehlt'),
    row: (row, c, sel) => { row.appendChild(sel(c.ref || '', refOpts(true), (v) => VN.mutate(() => { c.ref = v; }))); row.appendChild(sel(c.state || 'done', [['none', 'nicht begonnen'], ['active', 'läuft'], ['done', 'erledigt'], ['failed', 'gescheitert']], (v) => VN.mutate(() => { c.state = v; }))); }
  });
  const qAction = (op, label, withSteps, onlySteps) => VN.registerAction('quest' + op, {
    label, on: Q.on, make: () => ({ ref: '' }),
    apply: (a, rs, gains) => emit(Q.apply(rs, { Start: 'start', Step: 'step', Done: 'done', Fail: 'fail' }[op], a.ref), gains),
    text: (a) => label.replace(/^📜 /, '📜 ') + ': ' + Q.label(a.ref),
    problem: (a) => { const f = Q.find(a.ref); if (!f) return 'Quest fehlt'; if (onlySteps && f.kind !== 'step') return 'Bitte einen Abschnitt wählen'; return null; },
    row: (row, a, sel) => row.appendChild(sel(a.ref || '', onlySteps ? refOpts(true).filter(([k]) => !k || Q.find(k).kind === 'step') : refOpts(withSteps), (v) => VN.mutate(() => { a.ref = v; })))
  });
  qAction('Start', '📜 Quest(reihe) starten', false);
  qAction('Step', '📜 Abschnitt erledigt', true, true);
  qAction('Done', '📜 Quest abschließen', false);
  qAction('Fail', '📜 Quest scheitern lassen', false);
  VN.registerAction('questLog', { label: '📜 Questlog öffnen', on: Q.on, make: () => ({}), apply: (a, rs, gains) => { if (window.Player && Player.openQuests) gains.pending.push(Player.openQuests()); }, text: () => 'Questlog öffnen', row: () => {} });

  // ---------- Texte fürs Transkript ----------
  const base = VN.collectTexts;
  VN.collectTexts = () => {
    const out = base();
    if (!Q.on()) return out;
    for (const s of Q.list()) {
      out.push({ id: s.id + ':name', area: 'Quests', where: 'Reihe', who: Q.whoName(s), text: s.name || '', set: (v) => { s.name = v; } });
      for (const q of s.quests || []) {
        out.push({ id: q.id + ':name', area: 'Quests', where: s.name, who: 'Quest', text: q.name || '', set: (v) => { q.name = v; } });
        if (q.desc) out.push({ id: q.id + ':desc', area: 'Quests', where: q.name, who: 'Beschreibung', text: q.desc, set: (v) => { q.desc = v; } });
        for (const st of q.steps || []) {
          out.push({ id: st.id + ':name', area: 'Quests', where: q.name, who: 'Abschnitt', text: st.name || '', set: (v) => { st.name = v; } });
          if (st.hint) out.push({ id: st.id + ':hint', area: 'Quests', where: st.name, who: 'Tipp', text: st.hint, set: (v) => { st.hint = v; } });
        }
      }
    }
    return out;
  };
})();
