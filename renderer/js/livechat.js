// Live-Chat (0.9.24): Chatleiste für Stream-Szenen – vorgefertigte Nachrichten in Abständen, Chatter-Farben, anklickbare Antworten
(function () {
  const { el } = VN;
  const P = () => VN.project;
  const tr = (id, t) => (VN.tr ? VN.tr(id, t || '') : t || '');
  const tp = (s) => (VN.tp ? VN.tp(s) : s);
  const COLORS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#9775fa', '#f783ac', '#e599f7', '#74c0fc', '#a9e34b', '#ff8787'];

  const LC = (VN.LiveChat = {
    COLORS,
    list: () => (P() && P().liveChats) || [],
    get: (id) => LC.list().find((c) => c.id === id) || null,
    on: () => LC.list().length > 0,
    newChat: () => ({
      id: VN.uid('lc'), name: VN.t('Stream-Chat'), title: 'LIVE', viewers: 1280, pos: 'right', w: 26, h: 58, bg: '#0e0e14', alpha: 82, text: '#eef0f6', accent: '#9146ff',
      size: 2.3, playerName: VN.t('Du'), playerColor: '#ffd43b', randomColors: true, loop: false, keep: false, jitter: 30,
      users: [{ id: VN.uid('lu'), name: 'NachtEule92', color: '' }, { id: VN.uid('lu'), name: 'kekskrümel', color: '' }, { id: VN.uid('lu'), name: 'GG_Matze', color: '' }],
      msgs: [], replies: []
    }),
    fix(c) {
      VN.fill(c, LC.newChat());
      for (const u of c.users) VN.fill(u, { id: VN.uid('lu'), name: 'User', color: '' });
      for (const m of c.msgs) VN.fill(m, { id: VN.uid('lm'), user: '', text: '', gap: 1.5, conds: [] });
      for (const r of c.replies) VN.fill(r, { id: VN.uid('lr'), text: '', at: 0, conds: [], actions: [] });
      return c;
    },
    // Farbe eines Chatters: eigene oder feste aus der Palette (je nach Name)
    color(c, u) {
      if (u && u.color) return u.color;
      if (!c.randomColors) return c.accent || '#9146ff';
      let h = 0; for (const ch of String(u ? u.name : '?')) h = (h * 31 + ch.charCodeAt(0)) % 9973;
      return COLORS[h % COLORS.length];
    },
    st: (rs) => { rs.lchat = VN.fill(rs.lchat, { replied: {}, seen: {} }); return rs.lchat; },

    // ---------- Laufender Chat im Spiel ----------
    _run: null,
    start(id, rs, host, opts = {}) {
      const c = LC.get(id);
      if (!c || !host) return null;
      LC.stop();
      const run = { c, rs, t0: performance.now(), shown: 0, timers: [], scene: opts.scene, preview: !!opts.preview };
      const box = el('div', { class: 'lc-box lc-' + (c.pos || 'right') });
      box.style.setProperty('--lc-bg', c.bg || '#0e0e14');
      box.style.setProperty('--lc-a', String((Number(c.alpha) != null ? Number(c.alpha) : 82) / 100));
      box.style.setProperty('--lc-text', c.text || '#eef0f6');
      box.style.setProperty('--lc-acc', c.accent || '#9146ff');
      box.style.setProperty('--lc-size', (Number(c.size) || 2.3) + 'cqh');
      box.style.width = (Number(c.w) || 26) + '%';
      box.style.height = (Number(c.h) || 72) + '%';
      const viewers = el('span', { class: 'lc-viewers' });
      const head = el('div', { class: 'lc-head' }, el('span', { class: 'lc-live' }, tr(c.id + ':title', c.title || 'LIVE')), viewers);
      const list = el('div', { class: 'lc-list' });
      const reps = el('div', { class: 'lc-reps' });
      box.append(head, list, reps);
      box.addEventListener('click', (e) => e.stopPropagation());
      box.addEventListener('wheel', (e) => e.stopPropagation());
      host.appendChild(box);
      run.box = box; run.list = list; run.reps = reps; run.viewers = viewers;
      LC._run = run;
      const v0 = Math.max(0, Number(c.viewers) || 0);
      const tickViewers = () => { if (!v0) { viewers.textContent = ''; return; } const t = (performance.now() - run.t0) / 1000; viewers.textContent = '● ' + Math.round(v0 * (1 + 0.03 * Math.sin(t / 3) + 0.01 * Math.sin(t * 1.7))).toLocaleString(); };
      tickViewers();
      // Nachrichten nacheinander, jeweils nach ihrem Abstand (mit etwas Zufall, wirkt lebendiger)
      let i = 0;
      const next = () => {
        if (LC._run !== run || !box.isConnected) return LC.stop(run);
        const msgs = c.msgs.filter((m) => m.text && (run.preview || VN.checkConds(m.conds || [], rs)));
        if (i >= msgs.length) { if (c.loop && msgs.length) i = 0; else return; }
        const m = msgs[i++];
        const j = (Number(c.jitter) || 0) / 100, gap = Math.max(0.15, (Number(m.gap) || 1.5) * (1 + (Math.random() * 2 - 1) * j));
        run.timers.push(setTimeout(() => { if (LC._run === run) { LC.say(run, c.users.find((u) => u.id === m.user), tr(m.id, m.text)); next(); } }, gap * 1000));
      };
      next();
      const iv = setInterval(() => {
        if (LC._run !== run || !box.isConnected) { clearInterval(iv); return LC.stop(run); }
        tickViewers();
        // Szene verlassen → Chat endet (außer „bleibt offen“)
        if (!run.preview && !c.keep && run.scene && window.Player && Player.state && Player.state.scene !== run.scene) { clearInterval(iv); LC.stop(run); return; }
        LC.drawReplies(run);
      }, 400);
      run.timers.push(iv);
      LC.drawReplies(run);
      return run;
    },
    stop(run) {
      const r = run || LC._run;
      if (!r) return;
      for (const t of r.timers) { clearTimeout(t); clearInterval(t); }
      if (r.box) { r.box.classList.add('lc-out'); setTimeout(() => r.box.remove(), 300); }
      if (LC._run === r) LC._run = null;
    },
    say(run, u, text, me) {
      const c = run.c;
      const name = me ? (tr(c.id + ':player', c.playerName) || tp('Du')) : (u ? u.name : '?');
      const col = me ? c.playerColor || '#ffd43b' : LC.color(c, u);
      const line = el('div', { class: 'lc-msg' + (me ? ' me' : '') }, el('strong', { style: { color: col } }, name), el('span', null, ' ' + text));
      run.list.appendChild(line);
      while (run.list.children.length > 60) run.list.firstChild.remove();
      run.list.scrollTop = run.list.scrollHeight;
    },
    drawReplies(run) {
      const c = run.c, S = LC.st(run.rs), t = (performance.now() - run.t0) / 1000;
      const open = c.replies.filter((r) => r.text && !S.replied[r.id] && t >= (Number(r.at) || 0) && (run.preview || VN.checkConds(r.conds || [], run.rs)));
      const key = open.map((r) => r.id).join(',');
      if (run.repKey === key) return;
      run.repKey = key;
      run.reps.innerHTML = '';
      for (const r of open) run.reps.appendChild(el('button', { class: 'lc-rep', onclick: (e) => {
        e.stopPropagation();
        S.replied[r.id] = 1;
        LC.say(run, null, tr(r.id, r.text), true);
        LC.drawReplies(run);
        if (!run.preview && (r.actions || []).length && window.Player && Player.runActions) Player.runActions(r.actions, 'lchat:' + r.id);
      } }, '💬 ' + tr(r.id, r.text)));
    },

    // ---------- Texte zum Übersetzen ----------
    texts(out) {
      for (const c of LC.list()) {
        if (c.title) out.push({ id: c.id + ':title', area: 'Live-Chat', where: c.name, who: 'Titel', text: c.title, set: (v) => { c.title = v; } });
        if (c.playerName) out.push({ id: c.id + ':player', area: 'Live-Chat', where: c.name, who: 'Spielername', text: c.playerName, set: (v) => { c.playerName = v; } });
        for (const m of c.msgs) if (m.text) { const u = c.users.find((x) => x.id === m.user); out.push({ id: m.id, area: 'Live-Chat', where: c.name, who: u ? u.name : '?', text: m.text, set: (v) => { m.text = v; } }); }
        for (const r of c.replies) if (r.text) out.push({ id: r.id, area: 'Live-Chat', where: c.name, who: 'Antwort', text: r.text, set: (v) => { r.text = v; } });
      }
      return out;
    }
  });

  // ---------- Daten ----------
  const baseMig = VN.migrate;
  VN.migrate = (p) => {
    const r = baseMig(p);
    if (!Array.isArray(p.liveChats)) p.liveChats = [];
    for (const c of p.liveChats) LC.fix(c);
    return r;
  };
  const baseTexts = VN.collectTexts;
  VN.collectTexts = () => LC.texts(baseTexts());

  // ---------- Aktionen & Bedingungen ----------
  const chatOpts = () => [['', '— Live-Chat —'], ...LC.list().map((c) => [c.id, c.name])];
  VN.registerAction('liveChat', {
    label: '📺 Live-Chat', on: LC.on, make: () => ({ chat: (LC.list()[0] || {}).id || '', op: 'start' }),
    apply: (a, rs) => {
      if (!(window.Player && Player.running && Player.host) || (VN.Idle && VN.Idle._sim)) return;
      if (a.op === 'stop') LC.stop(); else LC.start(a.chat, rs, Player.host, { scene: Player.state && Player.state.scene });
    },
    text: (a) => '📺 ' + (a.op === 'stop' ? VN.t('Live-Chat beenden') : VN.t('Live-Chat starten') + ': ' + ((LC.get(a.chat) || {}).name || '?')),
    problem: (a) => (a.op !== 'stop' && !LC.get(a.chat) ? 'Live-Chat fehlt' : null),
    row: (row, a, sel) => {
      row.appendChild(sel(a.op || 'start', [['start', 'starten'], ['stop', 'beenden']], (v) => VN.mutate(() => { a.op = v; })));
      if (a.op !== 'stop') row.appendChild(sel(a.chat || '', chatOpts(), (v) => VN.mutate(() => { a.chat = v; })));
    }
  });
  VN.registerCond('liveChatReplied', {
    label: '📺 Im Live-Chat geantwortet', on: LC.on, make: () => ({ reply: '' }),
    check: (c, rs) => !!LC.st(rs).replied[c.reply],
    text: (c) => { for (const x of LC.list()) { const r = x.replies.find((y) => y.id === c.reply); if (r) return '📺 ' + VN.t('Geantwortet') + ': „' + r.text.slice(0, 30) + '“'; } return '📺 ?'; },
    problem: (c) => (LC.list().some((x) => x.replies.some((r) => r.id === c.reply)) ? null : 'Antwort fehlt'),
    row: (row, c, sel) => row.appendChild(sel(c.reply || '', [['', '— Antwort —'], ...LC.list().flatMap((x) => x.replies.map((r) => [r.id, x.name + ' · ' + (r.text || '…').slice(0, 40)]))], (v) => VN.mutate(() => { c.reply = v; })))
  });

  // ---------- Editor ----------
  LC.editor = (body) => {
    const p = P();
    const txt = (value, commit, ph, style) => el('input', { type: 'text', value: value || '', placeholder: ph ? VN.t(ph) : '', style: style || null, onchange: (e) => VN.mutate(() => commit(e.target.value)) });
    const num = (value, commit, style, step) => el('input', { type: 'number', step: step || 'any', value: value != null ? value : 0, style: style || { width: '70px' }, onchange: (e) => VN.mutate(() => commit(Number(e.target.value))) });
    const sel = (value, options, commit, style) => { const s = el('select', { style: style || null, onchange: (e) => VN.mutate(() => commit(e.target.value)) }); for (const [v, l] of options) { const o = el('option', { value: v }, VN.t(l)); if (String(v) === String(value == null ? '' : value)) o.selected = true; s.appendChild(o); } return s; };
    const col = (value, commit) => el('input', { type: 'color', value: value || '#ffffff', onchange: (e) => VN.mutate(() => commit(e.target.value)) });
    const chk = (label, value, commit) => el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!value, onchange: (e) => VN.mutate(() => commit(e.target.checked)) }), VN.t(label));
    const row = (label, ...x) => el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '140px' } }, VN.t(label)), ...x);
    if (window.Help) body.appendChild(Help.box({ level: 'tip', key: 'livechat', text: VN.t('Für Szenen, in denen eine Figur streamt: Nachrichten erscheinen nacheinander in der Chatleiste. Starte den Chat mit der Aktion „📺 Live-Chat“ (z. B. im ersten Schritt der Szene). Antworten kann der Spieler anklicken – mit Aktionen dahinter.') }));
    const chats = LC.list();
    const ui = VN.ui;
    let c = chats.find((x) => x.id === ui.lcSel) || chats[0] || null;
    body.appendChild(el('div', { class: 'row gap8', style: { flexWrap: 'wrap', marginBottom: '10px' } },
      ...chats.map((x) => el('button', { class: 'btn tiny' + (x === c ? ' primary' : ''), onclick: () => { ui.lcSel = x.id; VN.render(); } }, '📺 ' + x.name)),
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const n = LC.newChat(); p.liveChats.push(n); ui.lcSel = n.id; }) }, '+ ' + VN.t('Live-Chat'))));
    if (!c) { body.appendChild(el('div', { class: 'muted' }, VN.t('Noch kein Live-Chat. Lege einen an – mit Beispiel-Chattern zum Loslegen.'))); return; }
    // Aussehen
    const look = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Chat & Aussehen')));
    look.append(
      row('Name (nur Editor)', txt(c.name, (v) => { c.name = v; })),
      row('Titel oben', txt(c.title, (v) => { c.title = v; }, 'LIVE'), el('span', { class: 'muted small' }, VN.t('Zuschauer')), num(c.viewers, (v) => { c.viewers = Math.max(0, Math.round(v)); }, { width: '90px' })),
      row('Position', sel(c.pos, [['right', 'rechts'], ['left', 'links'], ['bottom', 'unten']], (v) => { c.pos = v; }), el('span', { class: 'muted small' }, VN.t('Breite %')), num(c.w, (v) => { c.w = Math.max(10, Math.min(100, v)); }), el('span', { class: 'muted small' }, VN.t('Höhe %')), num(c.h, (v) => { c.h = Math.max(10, Math.min(100, v)); })),
      row('Farben', col(c.bg, (v) => { c.bg = v; }), el('span', { class: 'muted small' }, VN.t('Deckkraft')), num(c.alpha, (v) => { c.alpha = Math.max(0, Math.min(100, v)); }), col(c.text, (v) => { c.text = v; }), el('span', { class: 'muted small' }, VN.t('Text')), col(c.accent, (v) => { c.accent = v; }), el('span', { class: 'muted small' }, VN.t('Akzent'))),
      row('Schriftgröße', num(c.size, (v) => { c.size = Math.max(1, Math.min(6, v)); }, null, 0.1)),
      row('Spieler im Chat', txt(c.playerName, (v) => { c.playerName = v; }, 'Du', { width: '140px' }), col(c.playerColor, (v) => { c.playerColor = v; })),
      el('div', { class: 'logic-row' },
        chk('Chatter in bunten Farben', c.randomColors, (v) => { c.randomColors = v; }),
        chk('Am Ende von vorn', c.loop, (v) => { c.loop = v; }),
        chk('Bleibt beim Szenenwechsel offen', c.keep, (v) => { c.keep = v; })),
      row('Zufall bei Abständen %', num(c.jitter, (v) => { c.jitter = Math.max(0, Math.min(100, v)); }), el('span', { class: 'muted small' }, VN.t('0 = genau, 30 = etwas lebendiger'))),
      el('div', { class: 'row gap8' },
        el('button', { class: 'btn tiny', onclick: () => LC.preview(c) }, '▶ ' + VN.t('Vorschau')),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn tiny danger', onclick: () => { if (confirm(VN.t('Live-Chat löschen?'))) VN.mutate(() => { p.liveChats = p.liveChats.filter((x) => x !== c); }); } }, VN.t('Löschen'))));
    body.appendChild(look);
    // Chatter
    const us = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Chatter')));
    c.users.forEach((u, i) => us.appendChild(el('div', { class: 'logic-row' },
      el('span', { class: 'lc-dot', style: { background: LC.color(c, u) } }),
      txt(u.name, (v) => { u.name = v; }, 'Name', { width: '160px' }),
      el('label', { class: 'check small' }, el('input', { type: 'checkbox', checked: !!u.color, onchange: (e) => VN.mutate(() => { u.color = e.target.checked ? LC.color(c, u) : ''; }) }), VN.t('feste Farbe')),
      u.color ? col(u.color, (v) => { u.color = v; }) : null,
      el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { c.users.splice(i, 1); }) }, '×'))));
    us.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { c.users.push({ id: VN.uid('lu'), name: 'User' + (c.users.length + 1), color: '' }); }) }, '+ ' + VN.t('Chatter')));
    body.appendChild(us);
    // Nachrichten
    const ms = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Nachrichten')), el('div', { class: 'muted small' }, VN.t('Erscheinen von oben nach unten. „Abstand“ = Sekunden nach der vorherigen Nachricht.')));
    const uOpts = [['', '— Chatter —'], ...c.users.map((u) => [u.id, u.name])];
    c.msgs.forEach((m, i) => ms.appendChild(el('div', { class: 'logic-row' },
      sel(m.user, uOpts, (v) => { m.user = v; }, { width: '140px' }),
      txt(m.text, (v) => { m.text = v; }, 'Nachricht', { flex: '1', minWidth: '180px' }),
      el('span', { class: 'muted small' }, VN.t('Abstand')), num(m.gap, (v) => { m.gap = Math.max(0.1, v); }, { width: '60px' }, 0.1),
      el('button', { class: 'btn tiny' + (m.conds.length ? ' primary' : ''), title: VN.t('Nachricht nur, wenn …'), onclick: () => VN.popupEdit(VN.t('Nachricht nur, wenn …'), (cd) => cd.appendChild(VN.condEditor(m.conds, VN.t('Nur wenn')))) }, '🔒' + (m.conds.length || '')),
      el('button', { class: 'btn tiny', title: VN.t('Nach oben'), disabled: i === 0, onclick: () => VN.mutate(() => { c.msgs.splice(i - 1, 0, c.msgs.splice(i, 1)[0]); }) }, '↑'),
      el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { c.msgs.splice(i, 1); }) }, '×'))));
    ms.appendChild(el('div', { class: 'row gap8' },
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const u = c.users[c.msgs.length % Math.max(1, c.users.length)]; c.msgs.push({ id: VN.uid('lm'), user: u ? u.id : '', text: '', gap: 1.5, conds: [] }); }) }, '+ ' + VN.t('Nachricht')),
      el('button', { class: 'btn tiny', title: VN.t('Mehrere Zeilen einfügen: „Name: Text“ pro Zeile'), onclick: () => LC.bulk(c) }, '📋 ' + VN.t('Viele auf einmal'))));
    body.appendChild(ms);
    // Antworten
    const rp = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Antworten zum Anklicken')), el('div', { class: 'muted small' }, VN.t('Erscheinen ab der angegebenen Sekunde unter dem Chat. Ein Klick schreibt die Antwort in den Chat und führt die Aktionen aus.')));
    c.replies.forEach((r, i) => rp.appendChild(el('div', { class: 'logic-row' },
      txt(r.text, (v) => { r.text = v; }, 'Antwort', { flex: '1', minWidth: '180px' }),
      el('span', { class: 'muted small' }, VN.t('ab Sekunde')), num(r.at, (v) => { r.at = Math.max(0, v); }, { width: '60px' }, 0.5),
      VN.popupEdit ? el('button', { class: 'btn tiny' + (r.actions.length ? ' primary' : ''), onclick: () => VN.popupEdit(VN.t('Beim Klick ausführen'), (cd) => cd.appendChild(VN.actionEditor(r.actions, VN.t('Dann ausführen')))) }, '⚡' + (r.actions.length || '')) : null,
      VN.popupEdit ? el('button', { class: 'btn tiny' + (r.conds.length ? ' primary' : ''), onclick: () => VN.popupEdit(VN.t('Antwort nur zeigen, wenn …'), (cd) => cd.appendChild(VN.condEditor(r.conds, VN.t('Nur wenn')))) }, '🔒' + (r.conds.length || '')) : null,
      el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { c.replies.splice(i, 1); }) }, '×'))));
    rp.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { c.replies.push({ id: VN.uid('lr'), text: '', at: 3, conds: [], actions: [] }); }) }, '+ ' + VN.t('Antwort')));
    body.appendChild(rp);
  };
  // Viele Nachrichten auf einmal: „Name: Text“ pro Zeile, unbekannte Namen werden neue Chatter
  LC.bulk = (c) => {
    const ta = el('textarea', { style: { width: '100%', minHeight: '220px' }, placeholder: 'NachtEule92: Haha, was war das?\nkekskrümel: LOL\nGG_Matze: Nochmal! 😂' });
    VN.popupEdit(VN.t('Viele Nachrichten auf einmal'), (cd) => cd.append(el('div', { class: 'muted small' }, VN.t('Eine Nachricht pro Zeile, Format „Name: Text“. Neue Namen werden als Chatter angelegt.')), ta,
      el('button', { class: 'btn primary', onclick: () => {
        const lines = ta.value.split('\n').map((l) => l.trim()).filter(Boolean);
        VN.mutate(() => {
          for (const l of lines) {
            const k = l.indexOf(':'), name = k > 0 ? l.slice(0, k).trim() : '', text = k > 0 ? l.slice(k + 1).trim() : l;
            let u = name ? c.users.find((x) => x.name.toLowerCase() === name.toLowerCase()) : c.users[c.msgs.length % Math.max(1, c.users.length)];
            if (!u && name) { u = { id: VN.uid('lu'), name, color: '' }; c.users.push(u); }
            c.msgs.push({ id: VN.uid('lm'), user: u ? u.id : '', text, gap: 1 + Math.round(Math.random() * 20) / 10, conds: [] });
          }
        });
        ta.value = '';
        VN.toast(VN.tf('{n} Nachrichten eingefügt', { n: lines.length }));
      } }, VN.t('Einfügen'))));
  };
  // Vorschau über einem Bild der Szene
  LC.preview = (c) => {
    const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) { LC.stop(); back.remove(); } } });
    const bgA = (P().scenes || []).map((s) => s.bg).find((b) => b && VN.assetUrl(b));
    const stage = el('div', { class: 'lc-prev', style: { backgroundImage: bgA ? `url("${VN.assetUrl(bgA)}")` : '' } });
    back.appendChild(el('div', { class: 'modal', style: { width: '900px', maxWidth: '94vw' } },
      el('div', { class: 'row gap8', style: { marginBottom: '8px' } }, el('strong', { style: { flex: '1' } }, VN.t('Vorschau') + ' · ' + c.name),
        el('button', { class: 'btn tiny', onclick: () => { LC.st(rs).replied = {}; LC.start(c.id, rs, stage, { preview: true }); } }, '↻ ' + VN.t('Neu starten')),
        el('button', { class: 'btn primary', onclick: () => { LC.stop(); back.remove(); } }, VN.t('Fertig'))), stage));
    document.body.appendChild(back);
    const rs = VN.newRunState();
    LC.start(c.id, rs, stage, { preview: true });
  };
})();
