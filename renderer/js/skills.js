// Skilltrees: Bäume mit Knoten, die Boni oder einmalige Aktionen freischalten.
// Fest in der Engine, abschaltbar. Darunter liegt das gemeinsame Bonus-System VN.bonus(),
// das Geld, Läden, Beziehungen, Jobs, Minispiele, Reisen (und später Kampf und Aufbau) abfragen.
// Editor: skills-edit.js · Spiel: player-skills.js
(function () {
  const SK = (VN.Skills = {});

  SK.cfg = () => {
    const p = VN.project;
    p.skills = Object.assign({ enabled: false, trees: [], points: [], key: 't' }, p.skills || {});
    return p.skills;
  };
  SK.on = () => !!(VN.project && VN.project.skills && VN.project.skills.enabled);
  SK.trees = () => SK.cfg().trees;
  SK.tree = (id) => SK.trees().find((t) => t.id === id) || null;
  SK.node = (t, id) => (t && t.nodes ? t.nodes.find((n) => n.id === id) : null) || null;

  // ---------- Bereiche und Effekte ----------
  // Bereiche erscheinen nur, wenn das passende System an ist. Plugins können eigene dazulegen.
  const P = () => VN.project;
  const plugOn = (file) => !!(P().plugins && P().plugins[file] && P().plugins[file].enabled !== false);
  SK.CATS = [
    { key: 'money', label: 'Verdienst', icon: '🪙', on: () => (P().currencies || []).length > 0 },
    { key: 'trade', label: 'Handel', icon: '🛒', on: () => !!(P().economy && P().economy.enabled) },
    { key: 'rel', label: 'Beziehungen', icon: '♥', on: () => !!(VN.Life && VN.Life.relOn && VN.Life.relOn()) },
    { key: 'life', label: 'Leben & Arbeit', icon: '🧭', on: () => plugOn('jobs.js') || !!(VN.World && VN.World.on()) },
    { key: 'minigame', label: 'Minispiele', icon: '🎲', on: () => plugOn('minispiele.js') || plugOn('schlossknacken.js') },
    { key: 'stats', label: 'Werte', icon: '💪', on: () => (P().vars || []).some((v) => v.type !== 'flag') },
    { key: 'story', label: 'Story & Freischalten', icon: '🔓', on: () => true }
  ];
  SK.catsAll = () => {
    const out = SK.CATS.slice();
    if (window.VNPlugin) for (const d of Object.values(VNPlugin.plugins)) for (const c of d.skillCats || []) if (!out.some((x) => x.key === c.key)) out.push(Object.assign({ on: () => true }, c));
    return out;
  };
  SK.catsOn = () => SK.catsAll().filter((c) => { try { return c.on(); } catch (e) { return false; } });

  // Effekt-Arten. key(e) = Bonus-Schlüssel, mode 'pct' (Prozent) oder 'add' (Zahl), value(e) = Wert pro Stufe.
  // once(e, rs, sign) = einmalige Wirkung beim Kauf (sign = -1 beim Zurücksetzen).
  const pct = (e) => Number(e.pct) || 0;
  const curName = (id) => { const c = (P().currencies || []).find((x) => x.id === id); return c ? c.name : 'Geld'; };
  const charName = (id) => { const c = VN.Life && VN.Life.relChar ? VN.Life.relChar(id) : null; return c ? c.name : 'alle'; };
  const varName = (id) => { const v = (P().vars || []).find((x) => x.id === id); return v ? v.name : '?'; };
  SK.EFFECTS = {
    moneyPct: { cat: 'money', label: 'Mehr Geld (alle Einnahmen)', params: [['cur', 'Währung', 'currency'], ['pct', '+ %', 'number', 10]], key: (e) => 'money.gain' + (e.cur ? ':' + e.cur : ''), mode: 'pct', value: pct, text: (e, l) => '+' + pct(e) * l + ' % ' + (e.cur ? curName(e.cur) : 'Geld') },
    shopDiscount: { cat: 'trade', label: 'Rabatt beim Einkaufen', params: [['pct', '− %', 'number', 5]], key: () => 'shop.buy', mode: 'pct', value: (e) => -pct(e), text: (e, l) => '−' + pct(e) * l + ' % Preise im Laden' },
    sellBonus: { cat: 'trade', label: 'Mehr beim Verkaufen', params: [['pct', '+ %', 'number', 10]], key: () => 'shop.sell', mode: 'pct', value: pct, text: (e, l) => '+' + pct(e) * l + ' % beim Verkaufen' },
    relPct: { cat: 'rel', label: 'Mehr Beziehungspunkte', params: [['char', 'Figur', 'char'], ['pct', '+ %', 'number', 10]], key: (e) => 'rel.gain' + (e.char ? ':' + e.char : ''), mode: 'pct', value: pct, text: (e, l) => '+' + pct(e) * l + ' % ♥ ' + charName(e.char) },
    giftPct: { cat: 'rel', label: 'Geschenke wirken stärker', params: [['pct', '+ %', 'number', 15]], key: () => 'gift.gain', mode: 'pct', value: pct, text: (e, l) => '+' + pct(e) * l + ' % durch Geschenke' },
    jobPct: { cat: 'life', label: 'Mehr Lohn bei Jobs', params: [['pct', '+ %', 'number', 10]], key: () => 'job.pay', mode: 'pct', value: pct, text: (e, l) => '+' + pct(e) * l + ' % Lohn' },
    travelFaster: { cat: 'life', label: 'Schneller reisen', params: [['amount', '− Tageszeiten', 'number', 1]], key: () => 'travel.time', mode: 'add', value: (e) => -(Number(e.amount) || 0), text: (e, l) => '−' + (Number(e.amount) || 0) * l + ' Reisezeit' },
    minigamePct: { cat: 'minigame', label: 'Besseres Minispiel-Ergebnis', params: [['pct', '+ %', 'number', 10]], key: () => 'minigame.score', mode: 'pct', value: pct, text: (e, l) => '+' + pct(e) * l + ' % Ergebnis in Minispielen' },
    statAdd: { cat: 'stats', label: 'Wert erhöhen', params: [['var', 'Wert', 'var'], ['amount', '+', 'number', 1]], once: (e, rs, sign) => { if (e.var) rs.vars[e.var] = (Number(rs.vars[e.var]) || 0) + sign * (Number(e.amount) || 0); }, text: (e) => varName(e.var) + ' +' + (Number(e.amount) || 0) },
    actions: { cat: 'story', label: 'Aktionen beim Kauf (Ort, Quest, Gegenstand …)', params: [['actions', 'Aktionen', 'actions']], once: (e, rs, sign, gains) => { if (sign > 0) { const g = VN.applyActions(e.actions || [], rs, 'skill'); if (gains) for (const x of g) gains.push(x); } }, text: (e) => (e.actions || []).map((a) => VN.actionText(a)).join(', ') || '—' }
  };
  SK.effectsAll = () => {
    const out = Object.assign({}, SK.EFFECTS);
    if (window.VNPlugin) for (const d of Object.values(VNPlugin.plugins)) for (const [k, e] of Object.entries(d.skillEffects || {})) out[d.id + '.' + k] = Object.assign({ mode: 'pct', value: pct, text: (x, l) => (e.label || k) + ' ' + (pct(x) * l) }, e);
    return out;
  };

  // ---------- Zustand im Spielstand ----------
  SK.state = (rs) => {
    if (!rs.skills) {
      rs.skills = { own: {}, pts: {}, lvl: {}, spent: {}, v: 0 };
      for (const pt of SK.cfg().points) rs.skills.pts[pt.id] = Number(pt.start) || 0;
    }
    return rs.skills;
  };
  SK.level = (rs, t, n) => ((SK.state(rs).own[t.id] || {})[n.id] || 0);
  SK.max = (n) => Math.max(1, Number(n.max) || 1);
  SK.cost = (n, lvl) => Math.max(0, Math.round((Number(n.cost) || 0) * Math.pow(Number(n.grow) || 1, lvl)));
  SK.payName = (t) => {
    const pay = t.pay || {};
    if (pay.kind === 'points') { const pt = SK.cfg().points.find((x) => x.id === pay.ref); return pt ? pt.name : 'Punkte'; }
    if (pay.kind === 'var') return varName(pay.ref);
    return curName(pay.ref);
  };
  SK.wallet = (rs, t) => {
    const pay = t.pay || {};
    if (pay.kind === 'points') return SK.state(rs).pts[pay.ref] || 0;
    if (pay.kind === 'var') return Number(rs.vars[pay.ref]) || 0;
    return rs.money[pay.ref] || 0;
  };
  const spend = (rs, t, n) => {
    const pay = t.pay || {};
    if (pay.kind === 'points') { const st = SK.state(rs); st.pts[pay.ref] = (st.pts[pay.ref] || 0) - n; }
    else if (pay.kind === 'var') rs.vars[pay.ref] = (Number(rs.vars[pay.ref]) || 0) - n;
    else VN.addMoney(rs, pay.ref, -n, true);
  };
  // Erreichbar: Voraussetzungen und Story-Tor erfüllt
  SK.reachable = (rs, t, n) => {
    const reqs = (n.reqs || []).map((id) => SK.node(t, id)).filter(Boolean);
    if (reqs.length) {
      const have = (r) => SK.level(rs, t, r) > 0;
      if (n.reqMode === 'any' ? !reqs.some(have) : !reqs.every(have)) return false;
    }
    if ((n.gate || []).length && !VN.checkConds(n.gate, rs)) return false;
    return true;
  };
  // Zustand eines Knotens: max | buy | poor | locked | hidden
  SK.status = (rs, t, n) => {
    const l = SK.level(rs, t, n);
    if (l >= SK.max(n)) return 'max';
    if (!SK.reachable(rs, t, n)) return n.kind === 'hidden' && !l ? 'hidden' : 'locked';
    return SK.wallet(rs, t) >= SK.cost(n, l) ? 'buy' : 'poor';
  };
  // Kaufen. Gibt Gewinne (Gegenstände, Meldungen) aus einmaligen Aktionen zurück oder null
  SK.buy = (rs, t, n, free) => {
    if (!free && SK.status(rs, t, n) !== 'buy') return null;
    const st = SK.state(rs);
    const l = SK.level(rs, t, n);
    if (l >= SK.max(n)) return null;
    const c = free ? 0 : SK.cost(n, l);
    if (c) spend(rs, t, c);
    st.own[t.id] = st.own[t.id] || {};
    st.own[t.id][n.id] = l + 1;
    st.spent[t.id] = (st.spent[t.id] || 0) + c;
    st.v++;
    const gains = [];
    gains.pending = [];
    const E = SK.effectsAll();
    for (const e of n.effects || []) { const d = E[e.type]; if (d && d.once) try { d.once(e, rs, 1, gains); } catch (er) { console.error('Skill-Effekt', er); } }
    if (window.VNPlugin) setTimeout(() => VNPlugin.hook('onSkill', t.id, n.id, l + 1, VNPlugin.makeCtx(rs)), 0);
    return gains;
  };
  // Zurücksetzen: Ausgegebenes (ganz oder teilweise) zurück, Werte-Erhöhungen werden abgezogen
  SK.refundPct = (t) => (t.respec === 'full' ? 100 : t.respec === 'half' ? 50 : 0);
  SK.respec = (rs, t) => {
    if (!SK.refundPct(t)) return false;
    const st = SK.state(rs);
    const E = SK.effectsAll();
    for (const [nid, l] of Object.entries(st.own[t.id] || {})) {
      const n = SK.node(t, nid);
      if (n) for (const e of n.effects || []) { const d = E[e.type]; if (d && d.once && e.type !== 'actions') for (let i = 0; i < l; i++) d.once(e, rs, -1); }
    }
    const back = Math.floor((st.spent[t.id] || 0) * SK.refundPct(t) / 100);
    if (back) spend(rs, t, -back);
    st.own[t.id] = {};
    st.spent[t.id] = 0;
    st.v++;
    return true;
  };
  // Skillpunkte durch Stufenaufstieg: Steigt die Stufen-Variable, gibt es Punkte
  SK.update = (rs) => {
    if (!SK.on()) return [];
    const st = SK.state(rs);
    const out = [];
    for (const pt of SK.cfg().points) {
      if (!pt.levelVar) continue;
      const cur = Number(rs.vars[pt.levelVar]) || 0;
      if (st.lvl[pt.id] == null) { st.lvl[pt.id] = cur; continue; }
      if (cur > st.lvl[pt.id]) { const n = (cur - st.lvl[pt.id]) * (Number(pt.perLevel) || 1); st.pts[pt.id] = (st.pts[pt.id] || 0) + n; out.push({ pt, n }); }
      st.lvl[pt.id] = Math.max(st.lvl[pt.id], cur);
    }
    return out;
  };

  // ---------- Bonus-System ----------
  const cache = new WeakMap();
  SK.sum = (rs, key) => {
    if (!rs || !SK.on()) return { pct: 0, add: 0 };
    const st = SK.state(rs);
    let c = cache.get(rs);
    if (!c || c.v !== st.v || c.proj !== VN.project) {
      c = { v: st.v, proj: VN.project, sums: {} };
      const E = SK.effectsAll();
      for (const t of SK.trees()) {
        const own = st.own[t.id] || {};
        for (const n of t.nodes || []) {
          const l = own[n.id] || 0;
          if (!l) continue;
          for (const e of n.effects || []) {
            const d = E[e.type];
            if (!d || !d.key) continue;
            const k = d.key(e);
            const s = c.sums[k] || (c.sums[k] = { pct: 0, add: 0 });
            const v = (Number(d.value ? d.value(e) : e.pct) || 0) * l;
            if (d.mode === 'add') s.add += v; else s.pct += v;
          }
        }
      }
      cache.set(rs, c);
    }
    return c.sums[key] || { pct: 0, add: 0 };
  };
  // VN.bonus('money.gain', 50, rs, 'cur_gold') → Wert mit allen passenden Boni (allgemein + speziell)
  VN.bonus = (key, base, rs, sub) => {
    if (!rs || !SK.on()) return base;
    const a = SK.sum(rs, key), b = sub ? SK.sum(rs, key + ':' + sub) : { pct: 0, add: 0 };
    return base * (1 + (a.pct + b.pct) / 100) + a.add + b.add;
  };

  // Geld: Einnahmen bekommen den Verdienst-Bonus (raw = ohne Bonus, z. B. Erstattungen)
  const baseAdd = VN.addMoney;
  VN.addMoney = (rs, id, n, raw) => {
    if (!raw && n > 0 && SK.on()) n = Math.round(VN.bonus('money.gain', n, rs, id));
    return baseAdd(rs, id, n);
  };

  // ---------- Bedingung und Aktionen ----------
  const nodeOpts = () => {
    const out = [['', '— Skill —']];
    for (const t of SK.trees()) for (const n of t.nodes || []) out.push([t.id + '/' + n.id, t.name + ' › ' + n.name]);
    return out;
  };
  const split = (ref) => { const [tid, nid] = String(ref || '').split('/'); const t = SK.tree(tid); return { t, n: SK.node(t, nid) }; };
  SK.split = split;
  VN.registerCond('skill', {
    label: '🌳 Skill gekauft', on: SK.on, make: () => ({ ref: '', level: 1 }),
    check: (c, rs) => { const { t, n } = split(c.ref); return !!(t && n) && SK.level(rs, t, n) >= (Number(c.level) || 1); },
    text: (c) => { const { t, n } = split(c.ref); return '🌳 ' + (n ? n.name : '?') + ((Number(c.level) || 1) > 1 ? ' ab Stufe ' + c.level : '') + (t ? ' (' + t.name + ')' : ''); },
    problem: (c) => { const { t, n } = split(c.ref); return t && n ? null : 'Skill fehlt'; },
    row: (row, c, sel, inp) => { row.appendChild(sel(c.ref || '', nodeOpts(), (v) => VN.mutate(() => { c.ref = v; }))); row.appendChild(inp(c.level || 1, (v) => VN.mutate(() => { c.level = Number(v) || 1; }), 'number')); }
  });
  const ptOpts = () => [['', '— Punkte —'], ...SK.cfg().points.map((x) => [x.id, x.name])];
  VN.registerAction('skillPoints', {
    label: '🌳 Skillpunkte geben', on: () => SK.on() && SK.cfg().points.length > 0, make: () => ({ pt: '', amount: 1 }),
    apply: (a, rs, gains) => { const pt = SK.cfg().points.find((x) => x.id === a.pt); if (!pt) return; const st = SK.state(rs); st.pts[pt.id] = (st.pts[pt.id] || 0) + (Number(a.amount) || 0); if (gains && Number(a.amount) > 0) gains.push({ kind: 'text', text: '+' + a.amount + ' ' + pt.name }); },
    text: (a) => { const pt = SK.cfg().points.find((x) => x.id === a.pt); return '🌳 +' + (a.amount || 0) + ' ' + (pt ? pt.name : '?'); },
    problem: (a) => (SK.cfg().points.some((x) => x.id === a.pt) ? null : 'Punkte-Art fehlt'),
    row: (row, a, sel, inp) => { row.appendChild(sel(a.pt || '', ptOpts(), (v) => VN.mutate(() => { a.pt = v; }))); row.appendChild(inp(a.amount != null ? a.amount : 1, (v) => VN.mutate(() => { a.amount = Number(v) || 0; }), 'number')); }
  });
  VN.registerAction('skillGive', {
    label: '🌳 Skill schenken (ohne Kosten)', on: SK.on, make: () => ({ ref: '' }),
    apply: (a, rs, gains) => { const { t, n } = split(a.ref); if (t && n) { const g = SK.buy(rs, t, n, true); if (g && gains) for (const x of g) gains.push(x); } },
    text: (a) => { const { n } = split(a.ref); return '🌳 ' + (n ? n.name : '?') + ' schenken'; },
    problem: (a) => { const { t, n } = split(a.ref); return t && n ? null : 'Skill fehlt'; },
    row: (row, a, sel) => row.appendChild(sel(a.ref || '', nodeOpts(), (v) => VN.mutate(() => { a.ref = v; })))
  });
  VN.registerAction('skillScreen', {
    label: '🌳 Skilltree öffnen', on: SK.on, make: () => ({ tree: '' }),
    apply: (a, rs, gains) => { if (window.Player && Player.openSkills && gains) gains.pending.push(() => Player.openSkills(a.tree)); },
    text: (a) => { const t = SK.tree(a.tree); return '🌳 Skilltree öffnen' + (t ? ': ' + t.name : ''); },
    row: (row, a, sel) => row.appendChild(sel(a.tree || '', [['', '— erster Baum —'], ...SK.trees().map((t) => [t.id, t.name])], (v) => VN.mutate(() => { a.tree = v; })))
  });

  // ---------- Prüfung für den Editor ----------
  SK.nodeProblems = (t, n) => {
    const out = [];
    if (!String(n.name || '').trim()) out.push('Name fehlt');
    if (!(n.effects || []).length) out.push('Keine Wirkung');
    const E = SK.effectsAll();
    for (const e of n.effects || []) {
      const d = E[e.type];
      if (!d) { out.push('Unbekannte Wirkung „' + e.type + '“'); continue; }
      for (const [k, , type] of d.params || []) {
        if (type === 'var' && !(P().vars || []).some((v) => v.id === e[k])) out.push('Wert fehlt');
        if (type === 'actions' && !(e.actions || []).length) out.push('Keine Aktion');
      }
    }
    for (const r of n.reqs || []) if (!SK.node(t, r)) out.push('Voraussetzung fehlt');
    for (const c of n.gate || []) { const pr = VN.condProblem(c); if (pr) out.push('Story-Tor: ' + pr); }
    return out;
  };
  SK.treeProblems = (t) => {
    const out = [];
    const pay = t.pay || {};
    if (pay.kind === 'points' ? !SK.cfg().points.some((x) => x.id === pay.ref) : pay.kind === 'var' ? !(P().vars || []).some((v) => v.id === pay.ref) : !(P().currencies || []).some((c) => c.id === pay.ref)) out.push('Bezahlung fehlt');
    // Knoten, die über Voraussetzungen nie erreichbar sind (Kreis)
    const ok = new Set();
    let grew = true;
    while (grew) { grew = false; for (const n of t.nodes || []) if (!ok.has(n.id)) { const rq = (n.reqs || []).filter((r) => SK.node(t, r)); if (!rq.length || (n.reqMode === 'any' ? rq.some((r) => ok.has(r)) : rq.every((r) => ok.has(r)))) { ok.add(n.id); grew = true; } } }
    for (const n of t.nodes || []) if (!ok.has(n.id)) out.push('„' + n.name + '“ ist nie erreichbar (Voraussetzungen im Kreis)');
    return out;
  };
  SK.issues = () => {
    const out = [];
    if (!SK.on()) return out;
    for (const t of SK.trees()) {
      for (const pr of SK.treeProblems(t)) out.push({ text: 'Skilltree „' + t.name + '“: ' + pr });
      for (const n of t.nodes || []) for (const pr of SK.nodeProblems(t, n)) out.push({ text: 'Skill „' + (n.name || '?') + '“: ' + pr });
    }
    return out;
  };
  SK.totalCost = (t) => (t.nodes || []).reduce((s, n) => { let c = 0; for (let l = 0; l < SK.max(n); l++) c += SK.cost(n, l); return s + c; }, 0);

  // Vorlagen für neue Bäume
  SK.template = (kind) => {
    const mk = (name, x, y, reqs, extra) => Object.assign({ id: VN.uid('sk'), name, desc: '', icon: '⭐', x, y, kind: 'normal', max: 1, cost: 10, grow: 1.5, reqMode: 'all', reqs: reqs || [], gate: [], effects: [] }, extra || {});
    const nodes = [];
    const add = (n) => { nodes.push(n); return n.id; };
    if (kind === 'three') {
      const root = add(mk(VN.t('Grundlagen'), 50, 85, [], { icon: '🌱' }));
      [[20, '🗡'], [50, '💰'], [80, '♥']].forEach(([x, ic], i) => { const a = add(mk(VN.t('Ast') + ' ' + (i + 1) + ' · 1', x, 60, [root], { icon: ic })); const b = add(mk(VN.t('Ast') + ' ' + (i + 1) + ' · 2', x, 38, [a], { icon: ic, max: 3 })); add(mk(VN.t('Ast') + ' ' + (i + 1) + ' · ' + VN.t('Meister'), x, 14, [b], { icon: ic, kind: 'big', cost: 100 })); });
    } else if (kind === 'ring') {
      const root = add(mk(VN.t('Mitte'), 50, 50, [], { icon: '✦', kind: 'big' }));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; add(mk(VN.t('Skill') + ' ' + (i + 1), Math.round(50 + Math.cos(a) * 30), Math.round(50 + Math.sin(a) * 36), [root])); }
    } else {
      let prev = add(mk(VN.t('Start'), 50, 88, [], { icon: '🌱' }));
      const l = add(mk(VN.t('Links'), 30, 62, [prev])), r = add(mk(VN.t('Rechts'), 70, 62, [prev]));
      prev = add(mk(VN.t('Zusammen'), 50, 36, [l, r], { reqMode: 'any', max: 3 }));
      add(mk(VN.t('Krone'), 50, 12, [prev], { kind: 'big', icon: '👑', cost: 80 }));
    }
    return nodes;
  };

  // ---------- Texte fürs Transkript ----------
  const base = VN.collectTexts;
  VN.collectTexts = () => {
    const out = base();
    if (!SK.on()) return out;
    for (const t of SK.trees()) {
      out.push({ id: t.id + ':name', area: 'Skilltrees', where: 'Baum', who: 'Skilltree', text: t.name || '', set: (v) => { t.name = v; } });
      for (const n of t.nodes || []) {
        out.push({ id: n.id + ':name', area: 'Skilltrees', where: t.name, who: 'Skill', text: n.name || '', set: (v) => { n.name = v; } });
        if (n.desc) out.push({ id: n.id + ':desc', area: 'Skilltrees', where: t.name + ' › ' + n.name, who: 'Beschreibung', text: n.desc, set: (v) => { n.desc = v; } });
      }
    }
    for (const pt of SK.cfg().points) out.push({ id: pt.id + ':name', area: 'Skilltrees', where: 'Punkte', who: 'Punkte', text: pt.name || '', set: (v) => { pt.name = v; } });
    return out;
  };

  // Fehlende Felder ergänzen (bei jedem Laden)
  const baseMig = VN.migrate;
  VN.migrate = (p) => {
    const r = baseMig(p);
    if (p.skills) {
      for (const t of p.skills.trees || []) { t.nodes = t.nodes || []; t.pay = t.pay || { kind: 'currency', ref: '' }; t.cats = t.cats || []; for (const n of t.nodes) { n.reqs = n.reqs || []; n.gate = n.gate || []; n.effects = n.effects || []; } }
      p.skills.points = p.skills.points || [];
    }
    return r;
  };
})();
