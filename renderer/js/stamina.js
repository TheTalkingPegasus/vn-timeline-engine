// Ausdauer & Müdigkeit (0.9.24): Balken oder Symbole, Kosten für Auswahl/Minispiele/Reisen, Müdigkeits-Effekt, Einschlafen → Aufwachen
(function () {
  const { el } = VN;
  const P = () => VN.project;
  const tp = (s) => (VN.tp ? VN.tp(s) : s);
  const tr = (id, t) => (VN.tr ? VN.tr(id, t || '') : t || '');

  const DEF = {
    enabled: false, name: 'Ausdauer', max: 100, start: 100, style: 'bar', icon: '⚡', iconImg: '', iconStep: 10, color: '#5fd068', lowColor: '#e8a43a', hud: true,
    regenSlot: 0, refillDay: true, costMinigame: 0, costTravel: 0,
    tired: { on: true, below: 20, every: 12, lids: true, blur: true, strength: 5, yawn: '', text: '' },
    empty: { mode: 'sleep', scene: '', nextDay: true, refill: 100, text: '' }
  };
  const ST = (VN.Stamina = {
    cfg: () => P().stamina || DEF,
    on: () => !!(P() && P().stamina && P().stamina.enabled),
    max: () => Math.max(1, Number(ST.cfg().max) || 100),
    get(rs) { if (!rs) return 0; if (rs.stam == null) rs.stam = Math.min(ST.max(), Math.max(0, Number(ST.cfg().start != null ? ST.cfg().start : ST.max()))); return rs.stam; },
    set(rs, v) { const before = ST.get(rs); rs.stam = Math.max(0, Math.min(ST.max(), Math.round(Number(v) * 10) / 10)); return rs.stam - before; },
    // Ändern; leer → Einschlafen (falls eingestellt). gains: um im Spiel auf das Einschlafen zu warten
    add(rs, n, gains) {
      if (!ST.on() || !rs) return 0;
      const before = ST.get(rs);
      const d = ST.set(rs, before + (Number(n) || 0));
      if (before > 0 && rs.stam <= 0 && ST.cfg().empty && ST.cfg().empty.mode === 'sleep') ST.queueFaint(rs, gains);
      if (window.Player && Player.running && Player.refreshHud && Player.state && Player.state.rs === rs) Player.refreshHud();
      return d;
    },
    pct: (rs) => ST.get(rs) / ST.max(),
    tired: (rs) => { const T = ST.cfg().tired || {}; return !!(T.on && ST.get(rs) <= (Number(T.below) || 0) / 100 * ST.max()); },

    // ---------- Anzeige ----------
    hud(hud, rs) {
      if (!ST.on() || ST.cfg().hud === false) return;
      const C = ST.cfg(), v = ST.get(rs), k = v / ST.max(), low = ST.tired(rs);
      const col = low ? C.lowColor || '#e8a43a' : C.color || '#5fd068';
      const name = tr('stamina:name', C.name || 'Ausdauer');
      let chip;
      if (C.style === 'icons') {
        const step = Math.max(1, Number(C.iconStep) || 10), n = Math.ceil(ST.max() / step), full = Math.ceil(v / step - 0.001);
        const ico = (on) => (C.iconImg && VN.assetUrl(C.iconImg) ? el('span', { class: 'stam-ico img' + (on ? '' : ' off'), style: { backgroundImage: `url("${VN.assetUrl(C.iconImg)}")` } }) : el('span', { class: 'stam-ico' + (on ? '' : ' off') }, C.icon || '⚡'));
        chip = el('span', { class: 'money-chip stam-chip icons' + (low ? ' low' : ''), title: name + ': ' + Math.round(v) + ' / ' + ST.max() }, ...Array.from({ length: Math.min(n, 20) }, (_, i) => ico(i < full)));
      } else {
        chip = el('span', { class: 'money-chip stam-chip' + (low ? ' low' : ''), title: name + ': ' + Math.round(v) + ' / ' + ST.max() },
          el('span', { class: 'stam-lbl' }, (C.icon ? C.icon + ' ' : '') + name),
          el('span', { class: 'stam-bar' }, el('span', { style: { width: Math.max(0, Math.min(100, k * 100)) + '%', background: col } })));
      }
      if (window.UiDesign && UiDesign.applyChip) UiDesign.applyChip('stamina', chip);
      hud.appendChild(chip);
    },

    // ---------- Müdigkeit im Spiel ----------
    _fx: null,
    tick() {
      const run = window.Player && Player.running && Player.state;
      const host = window.Player && Player.host;
      const on = ST.on() && run && host && run.rs && !ST._fainting;
      const want = on && ST.tired(run.rs);
      let fx = ST._fx && ST._fx.isConnected ? ST._fx : null;
      if (!want) { if (fx) { fx.classList.add('off'); setTimeout(() => fx.remove(), 600); ST._fx = null; } return; }
      const T = ST.cfg().tired || {};
      if (!fx) {
        fx = ST._fx = el('div', { class: 'stam-tired' + (T.blur !== false ? ' blur' : '') }, el('div', { class: 'stam-lid top' }), el('div', { class: 'stam-lid bot' }));
        fx.style.setProperty('--st-s', String(Math.max(1, Math.min(10, Number(T.strength) || 5))));
        host.appendChild(fx);
        ST._next = performance.now() + 2500;
      }
      // Je müder, desto stärker
      const k = 1 - ST.get(run.rs) / Math.max(1, (Number(T.below) || 20) / 100 * ST.max());
      fx.style.setProperty('--st-k', Math.max(0.15, Math.min(1, k)).toFixed(2));
      if (T.lids !== false && performance.now() >= (ST._next || 0)) {
        ST._next = performance.now() + Math.max(3, Number(T.every) || 12) * 1000 * (0.75 + Math.random() * 0.5);
        fx.classList.remove('blink'); void fx.offsetWidth; fx.classList.add('blink');
        if (T.yawn) ST.sound(T.yawn);
      }
    },
    sound(asset) { const u = VN.assetUrl(asset); if (!u) return; const a = new Audio(u); a.volume = Math.max(0, Math.min(1, VN.settings ? (VN.settings.sfx != null ? VN.settings.sfx : 100) / 100 : 0.9)); a.play().catch(() => {}); },

    // Leer: Augen fallen zu, Zeit vergeht, Aufwachen im Hub/Dialog
    queueFaint(rs, gains) {
      if (!(window.Player && Player.running) || (VN.Idle && VN.Idle._sim) || ST._fainting) return;
      const f = () => ST.faint(rs);
      if (gains && gains.pending) gains.pending.push(f); else setTimeout(f, 50);
    },
    async faint(rs) {
      if (ST._fainting) return;
      const host = window.Player && Player.host;
      if (!host) return;
      ST._fainting = true;
      const E = ST.cfg().empty || {};
      if (ST._fx) { ST._fx.remove(); ST._fx = null; }
      const ov = el('div', { class: 'stam-faint' }, el('div', { class: 'stam-lid top' }), el('div', { class: 'stam-lid bot' }), E.text ? el('div', { class: 'stam-faint-t' }, tr('stamina:faint', E.text)) : null);
      host.appendChild(ov);
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      await wait(30); ov.classList.add('close');
      if (ST.cfg().tired && ST.cfg().tired.yawn) ST.sound(ST.cfg().tired.yawn);
      await wait(1600);
      if (E.nextDay !== false && VN.Life && VN.Life.timeOn()) { VN.Life.advance(rs, { mode: 'nextDay', slot: 0 }); if (Player.onTime) Player.onTime(); }
      ST.set(rs, (Number(E.refill != null ? E.refill : 100) / 100) * ST.max());
      if (E.scene && Player.setJump) Player.setJump(E.scene);
      if (Player.refreshHud) Player.refreshHud();
      await wait(E.text ? 1400 : 500);
      // Aufwachen: Augen öffnen sich (nach dem Szenenwechsel)
      setTimeout(() => { ov.classList.remove('close'); ov.classList.add('open'); setTimeout(() => { ov.remove(); ST._fainting = false; }, 1600); }, 350);
    },

    texts(out) {
      const C = P().stamina;
      if (!C) return out;
      if (C.name) out.push({ id: 'stamina:name', area: 'Ausdauer', where: 'HUD', who: 'Name', text: C.name, set: (v) => { C.name = v; } });
      if (C.empty && C.empty.text) out.push({ id: 'stamina:faint', area: 'Ausdauer', where: 'Einschlafen', who: 'Text', text: C.empty.text, set: (v) => { C.empty.text = v; } });
      return out;
    }
  });

  setInterval(() => { try { ST.tick(); } catch (e) { /* nichts */ } }, 300);
  VN.hudHooks = VN.hudHooks || []; VN.hudHooks.push(ST.hud);
  VN.timeHooks = VN.timeHooks || []; VN.timeHooks.push((rs, n) => { if (ST.on() && Number(ST.cfg().regenSlot)) ST.add(rs, Number(ST.cfg().regenSlot) * n); });
  VN.dayHooks = VN.dayHooks || []; VN.dayHooks.push((rs) => { if (ST.on() && ST.cfg().refillDay && !ST._fainting) ST.set(rs, ST.max()); });

  const baseMig = VN.migrate;
  VN.migrate = (p) => {
    const r = baseMig(p);
    p.stamina = VN.fill(p.stamina, JSON.parse(JSON.stringify(DEF)));
    p.stamina.tired = VN.fill(p.stamina.tired, JSON.parse(JSON.stringify(DEF.tired)));
    p.stamina.empty = VN.fill(p.stamina.empty, JSON.parse(JSON.stringify(DEF.empty)));
    return r;
  };
  const baseTexts = VN.collectTexts;
  VN.collectTexts = () => ST.texts(baseTexts());

  // ---------- Aktionen & Bedingungen ----------
  VN.registerAction('stamina', {
    label: '⚡ Ausdauer ändern', on: ST.on, make: () => ({ op: 'add', amount: -10 }),
    apply: (a, rs, gains) => { if (a.op === 'set') ST.add(rs, (Number(a.amount) || 0) - ST.get(rs), gains); else if (a.op === 'pct') ST.add(rs, ST.max() * (Number(a.amount) || 0) / 100, gains); else ST.add(rs, a.amount, gains); },
    text: (a) => { const n = Number(a.amount) || 0; return '⚡ ' + (ST.cfg().name || VN.t('Ausdauer')) + ' ' + (a.op === 'set' ? '= ' + n : (n >= 0 ? '+' : '') + n + (a.op === 'pct' ? ' %' : '')); },
    row: (row, a, sel, inp) => {
      row.appendChild(sel(a.op || 'add', [['add', '+ / −'], ['pct', '+ / − % vom Maximum'], ['set', 'auf Wert setzen']], (v) => VN.mutate(() => { a.op = v; })));
      row.appendChild(el('input', { type: 'number', value: a.amount != null ? a.amount : 0, style: { width: '80px' }, onchange: (e) => VN.mutate(() => { a.amount = Number(e.target.value) || 0; }) }));
      row.appendChild(el('span', { class: 'muted small' }, VN.t('negativ = verbraucht')));
    }
  });
  VN.registerCond('stamina', {
    label: '⚡ Ausdauer', on: ST.on, make: () => ({ cmp: '>=', value: 10 }),
    check: (c, rs) => { const v = ST.get(rs), n = Number(c.value) || 0; return c.cmp === '<' ? v < n : v >= n; },
    text: (c) => '⚡ ' + (ST.cfg().name || VN.t('Ausdauer')) + ' ' + (c.cmp === '<' ? '<' : '≥') + ' ' + (Number(c.value) || 0),
    row: (row, c, sel) => {
      row.appendChild(sel(c.cmp || '>=', [['>=', 'mindestens'], ['<', 'weniger als']], (v) => VN.mutate(() => { c.cmp = v; })));
      row.appendChild(el('input', { type: 'number', value: c.value != null ? c.value : 0, style: { width: '80px' }, onchange: (e) => VN.mutate(() => { c.value = Number(e.target.value) || 0; }) }));
    }
  });

  // ---------- Editor ----------
  ST.editor = (body) => {
    const C = ST.cfg(), T = C.tired, E = C.empty;
    const num = (value, commit, w, step) => el('input', { type: 'number', step: step || 'any', value: value != null ? value : 0, style: { width: w || '70px' }, onchange: (e) => VN.mutate(() => commit(Number(e.target.value))) });
    const txt = (value, commit, ph, w) => el('input', { type: 'text', value: value || '', placeholder: ph ? VN.t(ph) : '', style: { width: w || '160px' }, onchange: (e) => VN.mutate(() => commit(e.target.value)) });
    const sel = (value, options, commit) => { const s = el('select', { onchange: (e) => VN.mutate(() => commit(e.target.value)) }); for (const [v, l] of options) { const o = el('option', { value: v }, VN.t(l)); if (String(v) === String(value == null ? '' : value)) o.selected = true; s.appendChild(o); } return s; };
    const chk = (label, v, commit) => el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!v, onchange: (e) => VN.mutate(() => commit(e.target.checked)) }), VN.t(label));
    const col = (value, commit) => el('input', { type: 'color', value: value || '#ffffff', onchange: (e) => VN.mutate(() => commit(e.target.value)) });
    const row = (label, ...x) => el('div', { class: 'logic-row', style: { flexWrap: 'wrap' } }, el('span', { class: 'muted small', style: { width: '170px' } }, VN.t(label)), ...x);
    const asset = (kind, v, commit) => { const s = VN.assetSelect(kind, v, (x) => VN.mutate(() => commit(x))); s.style.maxWidth = '200px'; return s; };
    if (window.Help) body.appendChild(Help.box({ level: 'tip', key: 'stamina', text: VN.t('Ausdauer sinkt durch die Aktion „⚡ Ausdauer ändern“ (z. B. an einer Antwort, die Kraft kostet) und optional bei jedem Minispiel oder jeder Reise. Mit der Bedingung „⚡ Ausdauer“ sperrst du Optionen, für die die Kraft fehlt.') }));
    const a = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Wert & Anzeige')));
    a.append(
      row('Name', txt(C.name, (v) => { C.name = v; }, 'Ausdauer')),
      row('Höchstwert / Start', num(C.max, (v) => { C.max = Math.max(1, Math.round(v)); }), num(C.start, (v) => { C.start = Math.max(0, v); })),
      row('Anzeige', sel(C.style, [['bar', 'Balken'], ['icons', 'Symbole']], (v) => { C.style = v; }), chk('im HUD zeigen', C.hud !== false, (v) => { C.hud = v; })),
      row('Symbol', txt(C.icon, (v) => { C.icon = v; }, '⚡', '60px'), asset('image', C.iconImg, (v) => { C.iconImg = v; }), C.style === 'icons' ? el('span', { class: 'muted small' }, VN.t('1 Symbol =')) : null, C.style === 'icons' ? num(C.iconStep, (v) => { C.iconStep = Math.max(1, v); }) : null),
      row('Farben', col(C.color, (v) => { C.color = v; }), el('span', { class: 'muted small' }, VN.t('normal')), col(C.lowColor, (v) => { C.lowColor = v; }), el('span', { class: 'muted small' }, VN.t('müde'))));
    body.appendChild(a);
    const b = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Verbrauch & Erholung')));
    b.append(
      row('Jedes Minispiel kostet', num(C.costMinigame, (v) => { C.costMinigame = Math.max(0, v); })),
      row('Jede Reise kostet', num(C.costTravel, (v) => { C.costTravel = Math.max(0, v); })),
      row('Erholung pro Tageszeit', num(C.regenSlot, (v) => { C.regenSlot = v; }), el('span', { class: 'muted small' }, VN.t('wenn Zeit vergeht'))),
      el('div', { class: 'logic-row' }, chk('Neuer Tag = wieder voll', C.refillDay, (v) => { C.refillDay = v; })),
      el('div', { class: 'muted small' }, VN.t('Antworten, Hub-Objekte und Jobs kosten Ausdauer über die Aktion „⚡ Ausdauer ändern“ mit negativem Wert.')));
    body.appendChild(b);
    const c = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Müdigkeit')));
    c.append(
      el('div', { class: 'logic-row' }, chk('Müdigkeits-Effekt', T.on, (v) => { T.on = v; })),
      T.on ? row('ab weniger als (%)', num(T.below, (v) => { T.below = Math.max(1, Math.min(100, v)); })) : null,
      T.on ? el('div', { class: 'logic-row' }, chk('Augen fallen kurz zu', T.lids !== false, (v) => { T.lids = v; }), chk('Ränder unscharf', T.blur !== false, (v) => { T.blur = v; })) : null,
      T.on ? row('Alle … Sekunden', num(T.every, (v) => { T.every = Math.max(3, v); }), el('span', { class: 'muted small' }, VN.t('Stärke')), num(T.strength, (v) => { T.strength = Math.max(1, Math.min(10, v)); })) : null,
      T.on ? row('Gähnen (Sound)', asset('audio', T.yawn, (v) => { T.yawn = v; })) : null);
    body.appendChild(c);
    const d = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Bei leerer Ausdauer')));
    d.append(
      row('Was passiert', sel(E.mode, [['sleep', 'Einschlafen (Augen zu, aufwachen)'], ['none', 'nichts (nur Bedingungen)']], (v) => { E.mode = v; })),
      E.mode === 'sleep' ? row('Aufwachen in', VN.sceneSelect(E.scene, (v) => VN.mutate(() => { E.scene = v; }))) : null,
      E.mode === 'sleep' ? row('Text beim Einschlafen', txt(E.text, (v) => { E.text = v; }, 'z. B. Du bist eingeschlafen …', '260px')) : null,
      E.mode === 'sleep' ? row('Danach wieder (%)', num(E.refill, (v) => { E.refill = Math.max(1, Math.min(100, v)); }), chk('nächster Tag', E.nextDay !== false, (v) => { E.nextDay = v; })) : null,
      el('div', { class: 'muted small' }, VN.t('Aufwachen: Ohne Ziel bleibt das Spiel, wo es ist. Mit einem Hub oder Hub-Dialog (z. B. „Schlafzimmer“) wacht die Figur dort auf.')));
    body.appendChild(d);
  };

  if (VN.Life) {
    const base = VN.Life.extraSwitches;
    VN.Life.extraSwitches = (card, set) => {
      const out = base ? base(card, set) : [];
      out.push(card('⚡', VN.t('Ausdauer & Müdigkeit'), VN.t('Auswahl, Minispiele und Reisen kosten Kraft. Balken oder Symbole, müde Augen, Gähnen, Einschlafen und Aufwachen.'), ST.on(), set((v) => { P().stamina.enabled = v; }), 'stamina'));
      return out;
    };
  }
})();
