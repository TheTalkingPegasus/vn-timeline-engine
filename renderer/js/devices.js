// Geräte (0.9.0): Handy oder Computer im Spiel – ein Startbildschirm mit Apps (Nachrichten, Inventar, Beziehungen,
// Galerie, Quests, Karte … und eigene Apps). Nachrichten sind Chats, die über Szenen hinweg erhalten bleiben:
// Unterhaltungen (je nach Route mit anderen Zeilen) und vorbereitete Antworten, aus denen der Spieler wählt.
// Läuft im Spiel (über Player.device) und als Vorschau im Editor (Spielsysteme → Geräte / Nachrichten).
(function () {
  const { el } = VN;
  const DV = (VN.Devices = {});
  const P = () => VN.project;
  const tr = (id, t) => (VN.tr ? VN.tr(id, t || '') : t || '');
  const tp = (s) => (VN.tp ? VN.tp(s) : s);

  // ---------- Grunddaten ----------
  DV.LOOK = { accent: '#3d8bfd', screen: '#0f1320', text: '#f2f4f8', panel: '#151a27', bubble: '#2a3142', bubbleMe: '#3d8bfd', iconShape: 'round', size: 88, side: 'center', dim: 55, inset: 5, font: '' };
  DV.DESK_LOOK = { accent: '#4a7dff', screen: '#1c2f4d', text: '#f2f4f8', panel: '#f4f6fb', bubble: '#e4e8f1', bubbleMe: '#4a7dff', iconShape: 'square', size: 100, side: 'center', dim: 0, inset: 0, font: '', panelText: '#1b2030' };
  // Eingebaute Apps: Symbol, Name, Farbe und wann sie überhaupt Sinn ergeben (das System ist an)
  DV.BUILTIN = {
    messages: { icon: '💬', name: 'Nachrichten', color: '#2fbf71', on: () => true },
    inv: { icon: '🎒', name: 'Inventar', color: '#c4813a', on: () => P().inventory.enabled !== false && P().items.length > 0 },
    rel: { icon: '❤', name: 'Beziehungen', color: '#e0577d', on: () => !!(VN.Life && VN.Life.relOn()) },
    gallery: { icon: '🖼', name: 'Galerie', color: '#7b68ee', on: () => !!(VN.Extras && VN.Extras.galleryOn()) },
    quests: { icon: '📜', name: 'Quests', color: '#d6a23a', on: () => !!(VN.Quests && VN.Quests.on()) },
    map: { icon: '🗺', name: 'Karte', color: '#3aa0d6', on: () => !!(VN.World && VN.World.on() && VN.World.maps().length) },
    ach: { icon: '🏆', name: 'Erfolge', color: '#e8b030', on: () => !!(VN.Extras && VN.Extras.achOn()) },
    skills: { icon: '🌳', name: 'Skilltree', color: '#4caf50', on: () => !!(VN.Skills && VN.Skills.on()) },
    stats: { icon: '📊', name: 'Werte', color: '#5c7cfa', on: () => !!(VN.Extras && VN.Extras.statsOn()) },
    log: { icon: '🕘', name: 'Verlauf', color: '#8a8f9c', on: () => true },
    idle: { icon: '🏗', name: 'Aufbau', color: '#b07a4a', on: () => !!(VN.Idle && VN.Idle.on()) },
    app: { icon: '⭐', name: 'Eigene App', color: '#9b59b6', on: () => true }
  };

  DV.cfg = () => P().devices;
  DV.on = () => !!(P() && P().devices && P().devices.enabled);
  DV.list = () => (DV.on() ? DV.cfg().list : []);
  DV.dev = (id) => DV.list().find((d) => d.id === id) || null;
  DV.chats = () => P().chats;
  DV.contacts = () => (P().chats && P().chats.contacts) || [];
  DV.contact = (id) => DV.contacts().find((c) => c.id === id) || null;
  DV.threads = () => (P().chats && P().chats.threads) || [];
  DV.thread = (id) => DV.threads().find((t) => t.id === id) || null;

  DV.fixApp = (a) => VN.fill(a, { id: VN.uid('app'), type: 'app', name: '', icon: '', image: '', color: '', conds: [], actions: [], title: '', text: '', pic: '' });
  DV.fixDev = (d) => {
    VN.fill(d, { id: VN.uid('dev'), name: VN.t('Handy'), kind: 'phone', conds: [], key: '', hud: true, inMenu: true, wallpaper: '', frame: '', clock: 'auto', apps: [] });
    d.look = VN.fill(d.look, d.kind === 'desktop' ? DV.DESK_LOOK : DV.LOOK);
    if (!Array.isArray(d.apps)) d.apps = [];
    for (const a of d.apps) DV.fixApp(a);
    return d;
  };
  DV.defaultApps = (kind) => Object.keys(DV.BUILTIN).filter((k) => k !== 'app' && (k === 'messages' || k === 'log' || DV.BUILTIN[k].on()) && !(kind === 'desktop' && k === 'log')).map((k) => DV.fixApp({ id: VN.uid('app'), type: k }));
  DV.newDevice = (kind) => DV.fixDev({ id: VN.uid('dev'), kind, name: kind === 'desktop' ? VN.t('Computer') : VN.t('Handy'), key: kind === 'desktop' ? '' : (DV.list().some((d) => d.key === 'h') ? '' : 'h'), hud: kind !== 'desktop', inMenu: kind !== 'desktop', apps: DV.defaultApps(kind) });
  DV.newContact = () => ({ id: VN.uid('ct'), name: VN.t('Neuer Kontakt'), char: '', avatar: '', color: '#3d8bfd', status: '' });
  DV.newThread = (contact) => ({ id: VN.uid('th'), name: VN.t('Unterhaltung'), contact: contact || '', auto: false, conds: [], msgs: [{ id: VN.uid('cm'), from: 'them', text: VN.t('Hey, bist du wach?'), image: '', conds: [] }], replies: [] });

  const baseMig = VN.migrate;
  VN.migrate = (p) => {
    p = baseMig(p);
    p.devices = VN.fill(p.devices, { enabled: false, list: [] });
    if (!Array.isArray(p.devices.list)) p.devices.list = [];
    for (const d of p.devices.list) DV.fixDev(d);
    p.chats = VN.fill(p.chats, { contacts: [], threads: [], notify: true, sound: '' });
    if (!Array.isArray(p.chats.contacts)) p.chats.contacts = [];
    if (!Array.isArray(p.chats.threads)) p.chats.threads = [];
    for (const t of p.chats.threads) {
      VN.fill(t, { conds: [], msgs: [], replies: [] });
      for (const m of t.msgs) VN.fill(m, { id: VN.uid('cm'), from: 'them', text: '', image: '', conds: [] });
      for (const r of t.replies) VN.fill(r, { id: VN.uid('cr'), text: '', conds: [], actions: [], next: '' });
    }
    return p;
  };

  // ---------- Namen und Bilder ----------
  DV.appName = (a) => (a.name ? tr(a.id + ':name', a.name) : tp((DV.BUILTIN[a.type] || DV.BUILTIN.app).name));
  DV.appIcon = (a) => a.icon || (DV.BUILTIN[a.type] || DV.BUILTIN.app).icon;
  DV.appColor = (a) => a.color || (DV.BUILTIN[a.type] || DV.BUILTIN.app).color;
  DV.relOf = (c) => (c && c.char && VN.Life && VN.Life.relOn() ? VN.Life.relChar(c.char) : null);
  DV.cName = (c) => { if (!c) return '?'; const r = DV.relOf(c); const n = (r && !c.name ? r.name : c.name) || (r ? r.name : '?'); return tr('name:' + n, n); };
  DV.cPic = (c) => { if (!c) return ''; if (c.avatar && VN.assetUrl(c.avatar)) return VN.assetUrl(c.avatar); const r = DV.relOf(c); return r && r.portrait && VN.assetUrl(r.portrait) ? VN.assetUrl(r.portrait) : ''; };
  DV.cColor = (c) => (c && (c.color || ((DV.relOf(c) || {}).color))) || '#3d8bfd';
  DV.avatar = (c, cls) => { const u = DV.cPic(c); return u ? el('span', { class: 'dv-ava ' + (cls || ''), style: { backgroundImage: `url("${u}")` } }) : el('span', { class: 'dv-ava ph ' + (cls || ''), style: { background: DV.cColor(c) } }, DV.cName(c).slice(0, 1).toUpperCase()); };
  // Kontakt zu einem Sprechernamen (Chat-Zeilen in der Timeline)
  DV.contactByName = (name) => {
    const n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    return DV.contacts().find((c) => String(c.name || '').trim().toLowerCase() === n || ((DV.relOf(c) || {}).name || '').trim().toLowerCase() === n) || null;
  };

  // ---------- Spielstand: Verlauf aller Chats ----------
  DV.st = (rs) => {
    rs.chat = VN.fill(rs.chat, { log: {}, got: {}, seen: {}, wait: {}, rep: {}, lines: {}, last: {}, seq: 0 });
    return rs.chat;
  };
  const stamp = (rs) => (VN.Life && VN.Life.timeOn() && rs.time ? { d: rs.time.day, s: rs.time.slot } : null);
  const push = (rs, cid, e) => { const S = DV.st(rs); (S.log[cid] = S.log[cid] || []).push(e); S.last[cid] = ++S.seq; if (S.log[cid].length > 400) { const cut = S.log[cid].length - 400; S.log[cid].splice(0, cut); S.seen[cid] = Math.max(0, (S.seen[cid] || 0) - cut); } return e; };
  DV.log = (rs, cid) => DV.st(rs).log[cid] || [];
  DV.unread = (rs, cid) => { const S = DV.st(rs), l = S.log[cid] || []; let n = 0; for (let i = S.seen[cid] || 0; i < l.length; i++) if (!l[i].me) n++; return n; };
  DV.unreadAll = (rs) => Object.keys(DV.st(rs).log).reduce((n, cid) => n + DV.unread(rs, cid), 0);
  DV.markRead = (rs, cid) => { const S = DV.st(rs); S.seen[cid] = (S.log[cid] || []).length; };
  DV.waiting = (rs, cid) => { const id = DV.st(rs).wait[cid]; return id && DV.thread(id) ? id : null; };
  // Kontakte mit Verlauf, zuletzt aktive zuerst
  DV.known = (rs) => { const S = DV.st(rs); return DV.contacts().filter((c) => (S.log[c.id] || []).length || S.wait[c.id]).sort((a, b) => (S.last[b.id] || 0) - (S.last[a.id] || 0)); };
  DV.entryText = (e) => (e.id ? tr(e.id, e.x || '') : e.x || '');
  DV.whenText = (at) => {
    if (!at || !VN.Life || !VN.Life.timeOn()) return '';
    const T = P().time;
    return VN.tr('time:day', 'Tag') + ' ' + at.d + ' · ' + VN.tr('time:slot' + at.s, T.slots[at.s] || '');
  };

  // Unterhaltung zustellen. Zeilen mit Bedingungen (Route) kommen nur, wenn sie gerade erfüllt sind.
  DV.deliver = (rs, thId, force) => {
    const th = DV.thread(thId);
    if (!th) return null;
    const S = DV.st(rs);
    if (S.got[th.id]) return null;
    if (!force && !VN.checkConds(th.conds || [], rs)) return null;
    const c = DV.contact(th.contact);
    if (!c) return null;
    const at = stamp(rs), added = [];
    for (const m of th.msgs || []) {
      if (!VN.checkConds(m.conds || [], rs)) continue;
      added.push(push(rs, c.id, { me: m.from === 'me', x: m.text || '', id: m.id + ':text', img: m.image || '', th: th.id, at }));
    }
    S.got[th.id] = 1;
    if ((th.replies || []).some((r) => VN.checkConds(r.conds || [], rs))) S.wait[c.id] = th.id;
    if (VN.did) VN.did(rs, 'chat', th.id);
    return { contact: c, thread: th, added };
  };
  // Automatische Unterhaltungen, deren Bedingungen jetzt erfüllt sind
  DV.autoCheck = (rs) => {
    if (!DV.on()) return [];
    const S = DV.st(rs), out = [];
    for (const th of DV.threads()) if (th.auto && !S.got[th.id]) { const r = DV.deliver(rs, th.id); if (r) out.push(r); }
    return out;
  };
  DV.replies = (rs, cid) => { const id = DV.waiting(rs, cid); const th = id && DV.thread(id); return th ? (th.replies || []).filter((r) => VN.checkConds(r.conds || [], rs)) : []; };
  DV.pickReply = (rs, cid, rid) => {
    const S = DV.st(rs), th = DV.thread(S.wait[cid]);
    const r = th && (th.replies || []).find((x) => x.id === rid);
    if (!r) return null;
    push(rs, cid, { me: true, x: r.text || '', id: r.id + ':text', img: '', th: th.id, at: stamp(rs) });
    S.rep[th.id] = r.id;
    delete S.wait[cid];
    DV.markRead(rs, cid);
    if (VN.did) VN.did(rs, 'chatReply', r.id);
    return { thread: th, reply: r };
  };
  // Chat-Zeile aus der Timeline (Dialog im Handy-Modus) in den Verlauf schreiben
  DV.logLine = (rs, clip, scene, text, me) => {
    if (!DV.on() || !clip) return;
    const S = DV.st(rs);
    if (S.lines[clip.id]) return;
    const lines = Fx.chatRun(scene, clip.start);
    const myName = String((P().chat && P().chat.me) || '').trim().toLowerCase();
    const other = lines.find((l) => (l.speaker || '').trim().toLowerCase() !== myName);
    const c = DV.contactByName(other ? other.speaker : (!me ? clip.speaker : ''));
    if (!c) return;
    S.lines[clip.id] = 1;
    push(rs, c.id, { me: !!me, x: clip.text || '', id: clip.id, img: '', sc: scene.id, at: stamp(rs) });
    DV.markRead(rs, c.id);
  };
  // Älterer Verlauf für die Handy-Ansicht in der Timeline (ohne die Zeilen dieser Szene)
  DV.historyFor = (rs, speaker, sceneId) => {
    if (!DV.on()) return [];
    const c = DV.contactByName(speaker);
    if (!c) return [];
    return DV.log(rs, c.id).filter((e) => e.sc !== sceneId).slice(-12);
  };
  // Nachricht einer Figur (Beziehungs-Meilenstein, Bild-Geschenk) landet auch im Chat
  DV.logRel = (rs, ch, m) => {
    if (!DV.on() || !ch || !m) return;
    const c = DV.contacts().find((x) => x.char && (x.char === ch.id || x.char === ch.name));
    if (!c) return;
    push(rs, c.id, { me: false, x: m.text || '', id: m.id ? m.id + ':text' : '', img: m.image || '', at: stamp(rs) });
    DV.markRead(rs, c.id);
  };

  // Welche Geräte und Apps gibt es gerade?
  DV.usable = (d, rs) => !!d && VN.checkConds(d.conds || [], rs);
  DV.apps = (d, rs) => (d.apps || []).filter((a) => (DV.BUILTIN[a.type] || DV.BUILTIN.app).on() && (!rs || VN.checkConds(a.conds || [], rs)));

  // ---------- Bedingungen und Aktionen ----------
  const devOpts = () => [['', '— Gerät —'], ...DV.list().map((d) => [d.id, (d.kind === 'desktop' ? '💻 ' : '📱 ') + d.name])];
  const thOpts = (none) => [['', none || '— Unterhaltung —'], ...DV.threads().map((t) => [t.id, (DV.contact(t.contact) ? DV.contact(t.contact).name + ': ' : '') + (t.name || '?')])];
  VN.registerCond('chat', {
    label: '💬 Nachricht', on: DV.on, make: () => ({ thread: '', state: 'got', reply: '' }),
    check: (c, rs) => {
      const S = DV.st(rs);
      const got = !!S.got[c.thread];
      if (c.state === 'not') return !got;
      if (c.state === 'replied') return c.reply ? S.rep[c.thread] === c.reply : !!S.rep[c.thread];
      if (c.state === 'open') return got && DV.waiting(rs, (DV.thread(c.thread) || {}).contact) === c.thread;
      if (c.state === 'read') {
        const th = DV.thread(c.thread);
        if (!got || !th) return false;
        const l = DV.log(rs, th.contact);
        let last = -1;
        l.forEach((e, i) => { if (e.th === c.thread) last = i; });
        return last < (S.seen[th.contact] || 0);
      }
      return got;
    },
    text: (c) => { const t = DV.thread(c.thread); const r = t && (t.replies || []).find((x) => x.id === c.reply); return '💬 ' + (t ? t.name : '?') + ' ' + ({ got: 'erhalten', not: 'nicht erhalten', read: 'gelesen', open: 'wartet auf Antwort', replied: r ? 'beantwortet mit „' + r.text + '“' : 'beantwortet' }[c.state] || ''); },
    problem: (c) => (DV.thread(c.thread) ? null : 'Unterhaltung fehlt'),
    row: (row, c, sel) => {
      row.appendChild(sel(c.thread || '', thOpts(), (v) => VN.mutate(() => { c.thread = v; c.reply = ''; })));
      row.appendChild(sel(c.state || 'got', [['got', 'erhalten'], ['not', 'nicht erhalten'], ['read', 'gelesen'], ['open', 'wartet auf Antwort'], ['replied', 'beantwortet']], (v) => VN.mutate(() => { c.state = v; })));
      const t = DV.thread(c.thread);
      if (c.state === 'replied' && t && (t.replies || []).length) row.appendChild(sel(c.reply || '', [['', '— mit irgendeiner Antwort —'], ...t.replies.map((r) => [r.id, '„' + (r.text || '?').slice(0, 30) + '“'])], (v) => VN.mutate(() => { c.reply = v; })));
    }
  });
  VN.registerAction('device', {
    label: '📱 Gerät öffnen', on: DV.on, make: () => ({ device: (DV.list()[0] || {}).id || '', app: '' }),
    apply: (a, rs, gains) => {
      if (!(window.Player && Player.device) || (VN.Idle && VN.Idle._sim) || !gains || !gains.pending) return;
      gains.pending.push(() => Player.device(a.device, { app: a.app, contact: a.contact }).then((pend) => (pend && pend.length ? Promise.all(pend.map((f) => (typeof f === 'function' ? f() : f))) : null)));
    },
    text: (a) => { const d = DV.dev(a.device); const ap = d && d.apps.find((x) => x.id === a.app); return (d && d.kind === 'desktop' ? '💻 ' : '📱 ') + (d ? d.name : '?') + (ap ? ' → ' + DV.appName(ap) : ''); },
    problem: (a) => (DV.dev(a.device) ? null : 'Gerät fehlt'),
    row: (row, a, sel) => {
      row.appendChild(sel(a.device || '', devOpts(), (v) => VN.mutate(() => { a.device = v; a.app = ''; })));
      const d = DV.dev(a.device);
      if (d) row.appendChild(sel(a.app || '', [['', 'Startbildschirm'], ...d.apps.map((x) => [x.id, DV.appIcon(x) + ' ' + DV.appName(x)])], (v) => VN.mutate(() => { a.app = v; })));
      const ap = d && d.apps.find((x) => x.id === a.app);
      if (ap && ap.type === 'messages') row.appendChild(sel(a.contact || '', [['', '— Liste —'], ...DV.contacts().map((c) => [c.id, c.name])], (v) => VN.mutate(() => { a.contact = v; })));
    }
  });
  VN.registerAction('chatSend', {
    label: '💬 Nachricht schicken', on: DV.on, make: () => ({ thread: (DV.threads()[0] || {}).id || '', quiet: false }),
    apply: (a, rs) => {
      const r = DV.deliver(rs, a.thread);
      if (r && !a.quiet && window.Player && Player.chatNotify && !(VN.Idle && VN.Idle._sim)) Player.chatNotify(r);
    },
    text: (a) => { const t = DV.thread(a.thread); return '💬 ' + (t ? (DV.contact(t.contact) ? DV.contact(t.contact).name + ': ' : '') + t.name : '?'); },
    problem: (a) => { const t = DV.thread(a.thread); return !t ? 'Unterhaltung fehlt' : !DV.contact(t.contact) ? 'Unterhaltung hat keinen Kontakt' : null; },
    row: (row, a, sel) => {
      row.appendChild(sel(a.thread || '', thOpts(), (v) => VN.mutate(() => { a.thread = v; })));
      row.appendChild(el('label', { class: 'check small' }, el('input', { type: 'checkbox', checked: !!a.quiet, onchange: (e) => VN.mutate(() => { a.quiet = e.target.checked; }) }), 'ohne Meldung'));
    }
  });

  // ---------- Prüfungen ----------
  DV.issues = () => {
    const out = [];
    if (!DV.on()) return out;
    if (!DV.list().length) out.push({ text: VN.t('Geräte sind eingeschaltet, aber es gibt noch kein Gerät.') });
    const keys = {};
    for (const d of DV.list()) {
      if (d.key) { if (keys[d.key]) out.push({ text: VN.tf('Zwei Geräte nutzen dieselbe Taste „{k}“.', { k: d.key.toUpperCase() }) }); keys[d.key] = 1; }
      for (const a of d.apps) if (a.type === 'app' && !(a.actions || []).length && !a.text && !a.pic && !a.title) out.push({ text: VN.tf('Eigene App „{a}“ auf „{d}“ macht nichts (keine Seite, keine Aktion).', { a: a.name || '?', d: d.name }) });
    }
    for (const t of DV.threads()) {
      if (!DV.contact(t.contact)) out.push({ text: VN.tf('Unterhaltung „{t}“ hat keinen Kontakt.', { t: t.name }) });
      for (const r of t.replies || []) if (r.next && !DV.thread(r.next)) out.push({ text: VN.tf('Antwort „{r}“ führt zu einer Unterhaltung, die es nicht mehr gibt.', { r: r.text }) });
      if (!t.auto && !used(t.id)) out.push({ level: 'info', text: VN.tf('Unterhaltung „{t}“ wird nie verschickt (nicht automatisch, keine Aktion, keine Antwort führt hin).', { t: t.name }) });
    }
    return out;
  };
  // Wird eine Unterhaltung irgendwo verschickt? (Aktion oder Folge einer Antwort)
  const used = (id) => {
    if (DV.threads().some((t) => (t.replies || []).some((r) => r.next === id))) return true;
    let hit = false;
    const walk = (x) => { if (hit || !x || typeof x !== 'object') return; if (Array.isArray(x)) { for (const y of x) walk(y); return; } if (x.type === 'chatSend' && x.thread === id) { hit = true; return; } for (const k in x) walk(x[k]); };
    walk(P().scenes); walk(P().items); walk(P().quests); walk(P().devices); walk(P().idle); walk(P().relations); walk(P().world); walk(P().chats.threads);
    return hit;
  };

  // ---------- Texte zum Übersetzen ----------
  const baseTexts = VN.collectTexts;
  VN.collectTexts = () => {
    const out = baseTexts();
    if (!DV.on()) return out;
    for (const d of DV.list()) for (const a of d.apps) {
      if (a.name) out.push({ id: a.id + ':name', area: 'Geräte', where: d.name, who: 'App', text: a.name, set: (v) => { a.name = v; } });
      if (a.title) out.push({ id: a.id + ':title', area: 'Geräte', where: d.name, who: 'Seite', text: a.title, set: (v) => { a.title = v; } });
      if (a.text) out.push({ id: a.id + ':text', area: 'Geräte', where: d.name, who: 'Seite', text: a.text, set: (v) => { a.text = v; } });
    }
    for (const t of DV.threads()) {
      const c = DV.contact(t.contact);
      for (const m of t.msgs || []) if (m.text) out.push({ id: m.id + ':text', area: 'Nachrichten', where: t.name, who: m.from === 'me' ? 'Ich' : (c ? c.name : '?'), text: m.text, set: (v) => { m.text = v; } });
      for (const r of t.replies || []) if (r.text) out.push({ id: r.id + ':text', area: 'Nachrichten', where: t.name, who: 'Antwort', text: r.text, set: (v) => { r.text = v; } });
    }
    return out;
  };

  // ---------- Meldung „Neue Nachricht“ ----------
  DV.sound = (asset) => { if (asset && window.RelMsg) RelMsg.play(asset); };
  DV.note = (stage, res, onClick) => {
    if (!stage || !res || !res.contact) return null;
    const last = [...res.added].reverse().find((e) => !e.me) || res.added[res.added.length - 1];
    const text = last ? (last.img && !last.x ? '🖼 ' + tp('Bild') : DV.entryText(last)) : tp('Neue Nachricht');
    const box = el('div', { class: 'rm-note dv-note', 'data-notr': '', onclick: (e) => { e.stopPropagation(); wrap.remove(); if (onClick) onClick(); } },
      DV.avatar(res.contact, 'sm'),
      el('div', { class: 'dv-note-t' }, el('strong', null, DV.cName(res.contact)), el('span', null, Fx && Fx.plain ? Fx.plain(text).slice(0, 80) : text)),
      el('span', { class: 'rm-note-ic' }, '💬'));
    const wrap = el('div', { class: 'qn-wrap pos-top dv-note-wrap' }, box);
    stage.appendChild(wrap);
    if (window.UiDesign) UiDesign.apply('relnote', box);
    box.classList.add('in-slide');
    DV.sound((P().chats && P().chats.sound) || (window.UiDesign ? UiDesign.resolve('relnote').sndA : ''));
    setTimeout(() => { box.classList.add('out-fade'); setTimeout(() => wrap.remove(), 450); }, 3600);
    return wrap;
  };

  // ---------- Oberfläche (Handy und Computer) ----------
  // host: Spielfeld; o = { dev, rs, preview, app, contact, before, H: { apply(list,key)→{close}, builtin(type)→Promise<'close'|*>, uiSound(k), onClose() } }
  DV.open = (host, o) => {
    const d = o.dev, rs = o.rs, H = o.H || {}, L = Object.assign({}, d.kind === 'desktop' ? DV.DESK_LOOK : DV.LOOK, d.look || {});
    const desk = d.kind === 'desktop';
    const snd = (k) => { if (H.uiSound) H.uiSound(k); };
    const XF = (t) => (VN.Extras && VN.Extras.fill ? VN.Extras.fill(t, rs) : t);
    const S = DV.st(rs);
    let closed = false, typing = null;
    const root = el('div', { class: 'dv-back ' + (desk ? 'dv-is-desk' : 'dv-is-phone side-' + (L.side || 'center')), 'data-notr': '' });
    root.style.setProperty('--dv-acc', L.accent);
    root.style.setProperty('--dv-screen', L.screen);
    root.style.setProperty('--dv-text', L.text);
    root.style.setProperty('--dv-panel', L.panel);
    root.style.setProperty('--dv-ptext', L.panelText || L.text);
    root.style.setProperty('--dv-bub', L.bubble);
    root.style.setProperty('--dv-bubme', L.bubbleMe);
    root.style.setProperty('--dv-dim', 'rgba(0,0,0,' + ((Number(L.dim) || 0) / 100) + ')');
    root.style.setProperty('--dv-size', (Number(L.size) || 88) + '%');
    root.style.setProperty('--dv-inset', (Number(L.inset) || 0) + '%');
    if (L.font) root.style.setProperty('--dv-font', window.Theme && Theme.fontCss ? Theme.fontCss(L.font) : L.font);
    root.addEventListener('click', (e) => { e.stopPropagation(); if (e.target === root && !desk) close(); });
    root.addEventListener('wheel', (e) => e.stopPropagation());
    const screen = el('div', { class: 'dv-screen shape-' + (L.iconShape || 'round') });
    const wp = d.wallpaper && VN.assetUrl(d.wallpaper);
    if (wp) screen.style.backgroundImage = `url("${wp}")`;
    const frame = d.frame && VN.assetUrl(d.frame);
    const body = el('div', { class: desk ? 'dv-desk' + (frame ? ' has-frame' : '') : 'dv-phone' + (frame ? ' has-frame' : '') }, screen, frame ? el('img', { class: 'dv-frame', src: frame, alt: '' }) : null);
    root.appendChild(body);
    if (o.before && o.before.parentNode === host) host.insertBefore(root, o.before); else host.appendChild(root);

    // Uhr in der Statusleiste / Taskleiste
    const clockText = (long) => {
      const mode = d.clock === 'auto' ? (VN.Life && VN.Life.timeOn() && rs.time ? 'game' : 'real') : d.clock;
      if (mode === 'none') return '';
      if (mode === 'game' && VN.Life && VN.Life.timeOn() && rs.time) { const T = P().time; const sl = VN.tr('time:slot' + rs.time.slot, T.slots[rs.time.slot] || ''); return long ? VN.Life.timeText(rs) : sl; }
      const t = new Date();
      return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    };
    const badge = (n) => (n ? el('span', { class: 'dv-badge' }, n > 99 ? '99+' : String(n)) : null);
    const appBadge = (a) => (a.type === 'messages' ? DV.unreadAll(rs) : a.type === 'gallery' && VN.Extras && VN.Extras.newCount ? VN.Extras.newCount() : 0);
    const icon = (a) => {
      const img = a.image && VN.assetUrl(a.image);
      return el('span', { class: 'dv-ico' + (img ? ' img' : ''), style: { background: img ? `center/cover url("${img}")` : DV.appColor(a) } }, img ? '' : DV.appIcon(a));
    };

    // ----- Inhalte der Apps (für Handy-Ansicht und Computer-Fenster gleich) -----
    const fmtText = (node, text) => { if (window.Fx && Fx.renderText) Fx.renderText(node, text); else node.textContent = text; return node; };
    const bubble = (e) => {
      const b = el('div', { class: 'dv-msg' + (e.me ? ' me' : '') });
      const t = DV.entryText(e);
      if (t) b.appendChild(fmtText(el('div', { class: 'dv-msg-t' }), XF(t)));
      if (e.img && VN.assetUrl(e.img)) b.appendChild(el('img', { class: 'dv-msg-img', src: VN.assetUrl(e.img), alt: '', onclick: (ev) => { ev.stopPropagation(); bigImg(e.img); } }));
      return b;
    };
    const bigImg = (id) => {
      if (VN.Extras && VN.Extras.seenNew) VN.Extras.seenNew(id);
      const v = el('div', { class: 'gal-view dv-big', onclick: (ev) => { ev.stopPropagation(); v.remove(); } }, el('img', { src: VN.assetUrl(id), alt: '' }));
      root.appendChild(v);
    };
    // Chatfenster eines Kontakts
    const chatView = (cid, onBack) => {
      const c = DV.contact(cid);
      const wrap = el('div', { class: 'dv-chat' });
      const head = el('div', { class: 'dv-head' },
        onBack ? el('button', { class: 'dv-back-btn', title: tp('Zurück'), onclick: (e) => { e.stopPropagation(); onBack(); } }, '‹') : null,
        DV.avatar(c, 'sm'), el('div', { class: 'dv-head-t' }, el('strong', null, DV.cName(c)), c && c.status ? el('span', null, tr(c.id + ':status', c.status)) : null));
      const list = el('div', { class: 'dv-msgs' });
      const foot = el('div', { class: 'dv-replies' });
      wrap.append(head, list, foot);
      const firstNew = S.seen[cid] || 0;
      const draw = (hideFrom) => {
        list.innerHTML = '';
        const l = DV.log(rs, cid);
        let lastWhen = '';
        l.forEach((e, i) => {
          if (hideFrom != null && i >= hideFrom) return;
          const w = DV.whenText(e.at);
          if (w && w !== lastWhen) list.appendChild(el('div', { class: 'dv-when' }, w));
          lastWhen = w || lastWhen;
          if (i === firstNew && i > 0 && firstNew < l.length && !e.me) list.appendChild(el('div', { class: 'dv-new' }, tp('Neu')));
          list.appendChild(bubble(e));
        });
        if (!l.length) list.appendChild(el('div', { class: 'dv-empty' }, tp('Noch keine Nachrichten.')));
        drawReplies(hideFrom != null);
        requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
      };
      const drawReplies = (busy) => {
        foot.innerHTML = '';
        if (busy) return;
        const reps = DV.replies(rs, cid);
        foot.hidden = !reps.length;
        for (const r of reps) foot.appendChild(el('button', { class: 'dv-reply', onclick: (e) => { e.stopPropagation(); answer(r); } }, XF(tr(r.id + ':text', r.text || '…'))));
      };
      const answer = (r) => {
        if (typing) return;
        const res = DV.pickReply(rs, cid, r.id);
        if (!res) return;
        snd('click');
        draw();
        if ((r.actions || []).length && H.apply) { const x = H.apply(r.actions, r.id); if (x && x.close) { close(); return; } }
        // Antwort darauf: gleich zustellen (der Spielstand stimmt sofort), aber Zeile für Zeile mit „schreibt …“ zeigen
        const nx = r.next ? DV.deliver(rs, r.next) : null;
        if (!nx || !nx.added.length) { if (nx) draw(); refreshBadges(); return; }
        if (nx.contact.id !== cid) { refreshBadges(); if (o.preview || !H.note) return; H.note(nx); return; }
        const total = DV.log(rs, cid).length;
        let shown = total - nx.added.length;
        const step = () => {
          if (closed || !wrap.isConnected) { typing = null; return; }
          if (shown >= total) { typing = null; DV.markRead(rs, cid); draw(); refreshBadges(); return; }
          const e = DV.log(rs, cid)[shown];
          draw(shown);
          const dots = el('div', { class: 'dv-msg typing' + (e.me ? ' me' : '') }, el('i'), el('i'), el('i'));
          list.appendChild(dots);
          list.scrollTop = list.scrollHeight;
          typing = setTimeout(() => { shown++; snd('item'); step(); }, Math.min(1700, 550 + (DV.entryText(e).length * 18)));
        };
        typing = setTimeout(step, 350);
      };
      DV.markRead(rs, cid);
      draw();
      return wrap;
    };
    // Liste aller Unterhaltungen
    const chatList = (onPick, cur) => {
      const box = el('div', { class: 'dv-clist' });
      const known = DV.known(rs);
      if (!known.length) box.appendChild(el('div', { class: 'dv-empty' }, tp('Noch keine Nachrichten.')));
      for (const c of known) {
        const l = DV.log(rs, c.id), last = l[l.length - 1];
        const n = DV.unread(rs, c.id);
        const prev = last ? (last.me ? tp('Du') + ': ' : '') + (last.img && !last.x ? '🖼 ' + tp('Bild') : (window.Fx ? Fx.plain(DV.entryText(last)) : DV.entryText(last))) : '…';
        box.appendChild(el('button', { class: 'dv-crow' + (n ? ' unread' : '') + (cur === c.id ? ' on' : ''), onclick: (e) => { e.stopPropagation(); snd('click'); onPick(c.id); } },
          DV.avatar(c), el('span', { class: 'dv-crow-t' }, el('strong', null, DV.cName(c)), el('span', null, prev.slice(0, 60))),
          badge(n) || (DV.waiting(rs, c.id) ? el('span', { class: 'dv-wait', title: tp('Wartet auf Antwort') }, '↩') : null)));
      }
      return box;
    };
    // Eigene App: Seite (Titel, Text, Bild)
    const pageView = (a) => el('div', { class: 'dv-page' },
      a.pic && VN.assetUrl(a.pic) ? el('img', { class: 'dv-page-img', src: VN.assetUrl(a.pic), alt: '' }) : null,
      a.title ? el('h3', null, tr(a.id + ':title', a.title)) : null,
      a.text ? fmtText(el('div', { class: 'dv-page-t' }), XF(tr(a.id + ':text', a.text))) : null);
    const hasPage = (a) => !!(a.title || a.text || a.pic);

    // Eingebaute Bildschirme (Inventar, Karte …): Gerät ausblenden, danach zurück
    const runBuiltin = (a) => {
      if (o.preview || !H.builtin) { flash(VN.tf('Öffnet im Spiel: {x}', { x: DV.appName(a) })); return; }
      root.classList.add('dv-away');
      Promise.resolve(H.builtin(a.type)).then((r) => { if (closed) return; if (r === 'close') close(); else { root.classList.remove('dv-away'); refreshBadges(); } });
    };
    const runCustom = (a) => {
      if ((a.actions || []).length) {
        if (o.preview || !H.apply) { if (!hasPage(a)) flash(VN.t('Führt im Spiel die Aktionen aus.')); }
        else { const x = H.apply(a.actions, a.id); if (x && x.close) { close(); return false; } }
      }
      return hasPage(a);
    };
    const flash = (t) => { const f = el('div', { class: 'dv-flash' }, t); screen.appendChild(f); setTimeout(() => f.remove(), 1800); };

    // ----- Handy -----
    let view = { app: null, chat: null };
    const statusBar = () => el('div', { class: 'dv-status' }, el('span', null, clockText(false)), el('span', { class: 'dv-status-r' }, '▂▄▆ ', el('span', { class: 'dv-batt' })));
    const phoneDraw = () => {
      if (typing) { clearTimeout(typing); typing = null; }
      screen.innerHTML = '';
      screen.appendChild(statusBar());
      const main = el('div', { class: 'dv-main' });
      screen.appendChild(main);
      const a = view.app;
      if (!a) {
        main.classList.add('home');
        const grid = el('div', { class: 'dv-grid' });
        for (const x of DV.apps(d, o.preview ? null : rs)) grid.appendChild(el('button', { class: 'dv-app', 'data-app': x.type, onclick: (e) => { e.stopPropagation(); openApp(x); } }, icon(x), el('span', { class: 'dv-lbl' }, DV.appName(x)), badge(appBadge(x))));
        main.appendChild(grid);
      } else if (a.type === 'messages') {
        main.classList.add('app');
        if (view.chat) main.appendChild(chatView(view.chat, () => { view.chat = null; snd('click'); phoneDraw(); }));
        else main.append(el('div', { class: 'dv-head' }, el('button', { class: 'dv-back-btn', onclick: (e) => { e.stopPropagation(); home(); } }, '‹'), el('div', { class: 'dv-head-t' }, el('strong', null, DV.appName(a)))), chatList((cid) => { view.chat = cid; phoneDraw(); }));
      } else {
        main.classList.add('app');
        main.append(el('div', { class: 'dv-head' }, el('button', { class: 'dv-back-btn', onclick: (e) => { e.stopPropagation(); home(); } }, '‹'), el('div', { class: 'dv-head-t' }, el('strong', null, DV.appName(a)))), pageView(a));
      }
      screen.appendChild(el('div', { class: 'dv-homebar', title: tp('Startbildschirm'), onclick: (e) => { e.stopPropagation(); if (view.app) home(); else close(); } }));
    };
    const home = () => { view = { app: null, chat: null }; snd('click'); phoneDraw(); };

    // ----- Computer -----
    const wins = [];
    let zTop = 1;
    const deskIcons = el('div', { class: 'dv-icons' });
    const winLayer = el('div', { class: 'dv-wins' });
    const taskApps = el('div', { class: 'dv-task-apps' });
    const clockEl = el('span', { class: 'dv-task-clock' });
    const deskDraw = () => {
      screen.innerHTML = '';
      deskIcons.innerHTML = '';
      for (const x of DV.apps(d, o.preview ? null : rs)) deskIcons.appendChild(el('button', { class: 'dv-app', 'data-app': x.type, ondblclick: (e) => e.stopPropagation(), onclick: (e) => { e.stopPropagation(); openApp(x); } }, icon(x), el('span', { class: 'dv-lbl' }, DV.appName(x)), badge(appBadge(x))));
      clockEl.textContent = clockText(true);
      screen.append(deskIcons, winLayer, el('div', { class: 'dv-task' },
        el('span', { class: 'dv-task-start' }, (d.kind === 'desktop' ? '💻 ' : '') + tr(d.id + ':name', d.name)),
        taskApps, el('div', { class: 'spacer' }), clockEl,
        el('button', { class: 'dv-task-off', title: tp('Schließen'), onclick: (e) => { e.stopPropagation(); close(); } }, '⏻')));
      drawTask();
    };
    const drawTask = () => {
      taskApps.innerHTML = '';
      for (const w of wins) taskApps.appendChild(el('button', { class: 'dv-task-btn' + (w.z === zTop ? ' on' : ''), onclick: (e) => { e.stopPropagation(); front(w); } }, DV.appIcon(w.app) + ' ' + DV.appName(w.app)));
    };
    const front = (w) => { w.z = ++zTop; w.el.style.zIndex = w.z; drawTask(); };
    const closeWin = (w) => { const i = wins.indexOf(w); if (i >= 0) wins.splice(i, 1); w.el.remove(); if (typing) { clearTimeout(typing); typing = null; } drawTask(); refreshBadges(); };
    const openWin = (a) => {
      const had = wins.find((w) => w.app === a);
      if (had) { front(had); return had; }
      const n = wins.length;
      const msg = a.type === 'messages';
      const w = { app: a, z: ++zTop, x: 20 + n * 4, y: 6 + n * 4, cw: msg ? 62 : 46, ch: msg ? 72 : 62 };
      const content = el('div', { class: 'dv-win-body' });
      const bar = el('div', { class: 'dv-win-bar' }, el('span', null, DV.appIcon(a) + ' ' + DV.appName(a)), el('button', { class: 'dv-win-x', title: tp('Schließen'), onclick: (e) => { e.stopPropagation(); closeWin(w); } }, '✕'));
      w.el = el('div', { class: 'dv-win', style: { left: w.x + '%', top: w.y + '%', width: w.cw + '%', height: w.ch + '%', zIndex: w.z }, onmousedown: () => front(w), onclick: (e) => e.stopPropagation() }, bar, content);
      // Fenster mit der Titelleiste verschieben
      bar.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        const r = screen.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, ox = w.x, oy = w.y;
        const mv = (ev) => { w.x = Math.max(-w.cw + 10, Math.min(95, ox + (ev.clientX - sx) / r.width * 100)); w.y = Math.max(0, Math.min(88, oy + (ev.clientY - sy) / r.height * 100)); w.el.style.left = w.x + '%'; w.el.style.top = w.y + '%'; };
        const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      });
      w.fill = () => {
        content.innerHTML = '';
        if (msg) {
          const known = DV.known(rs);
          if (!w.chat && known.length) w.chat = known[0].id;
          content.append(el('div', { class: 'dv-split' }, chatList((cid) => { w.chat = cid; w.fill(); }, w.chat), w.chat ? chatView(w.chat, null) : el('div', { class: 'dv-chat dv-empty' }, tp('Noch keine Nachrichten.'))));
        } else content.appendChild(pageView(a));
      };
      w.fill();
      wins.push(w);
      winLayer.appendChild(w.el);
      drawTask();
      return w;
    };

    // ----- gemeinsam -----
    const openApp = (a, contact) => {
      snd('click');
      if (a.type === 'messages') {
        if (desk) { const w = openWin(a); if (contact) { w.chat = contact; w.fill(); } }
        else { view = { app: a, chat: contact || null }; phoneDraw(); }
        return;
      }
      if (a.type === 'app') {
        if (!runCustom(a) || closed) return;
        if (desk) openWin(a); else { view = { app: a, chat: null }; phoneDraw(); }
        return;
      }
      runBuiltin(a);
    };
    const refreshBadges = () => {
      if (closed) return;
      const box = desk ? deskIcons : screen.querySelector('.dv-grid');
      if (!box) return;
      for (const b of box.querySelectorAll('.dv-app')) {
        const a = d.apps.find((x) => x.type === b.dataset.app && DV.appName(x) === (b.querySelector('.dv-lbl') || {}).textContent);
        const old = b.querySelector('.dv-badge');
        if (old) old.remove();
        const n = a ? appBadge(a) : 0;
        if (n) b.appendChild(badge(n));
      }
    };
    const redraw = () => { if (desk) { deskDraw(); for (const w of wins) w.fill(); } else phoneDraw(); };
    const clockT = setInterval(() => { if (!root.isConnected) { clearInterval(clockT); return; } if (closed) return; if (desk) clockEl.textContent = clockText(true); else { const s = screen.querySelector('.dv-status span'); if (s) s.textContent = clockText(false); } }, 20000);
    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(clockT);
      if (typing) clearTimeout(typing);
      snd('close');
      root.classList.add('dv-out');
      setTimeout(() => { root.remove(); if (H.onClose) H.onClose(); }, 220);
    };
    const onKey = (e) => {
      if (e.key === 'Escape' || (d.key && e.key.toLowerCase() === d.key.toLowerCase() && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || ''))) {
        if (root.querySelector('.dv-big')) { root.querySelector('.dv-big').remove(); return true; }
        if (e.key === 'Escape') {
          if (desk && wins.length) { closeWin(wins.reduce((a, b) => (a.z > b.z ? a : b))); return true; }
          if (!desk && view.chat) { view.chat = null; phoneDraw(); return true; }
          if (!desk && view.app) { home(); return true; }
        }
        close();
        return true;
      }
      return false;
    };

    // Start
    if (desk) deskDraw(); else phoneDraw();
    snd('open');
    root.classList.add('dv-in');
    if (o.app) { const a = d.apps.find((x) => x.id === o.app || x.type === o.app); if (a) openApp(a, o.contact); }
    return { el: root, close, onKey, redraw, refresh: refreshBadges, get closed() { return closed; }, get away() { return root.classList.contains('dv-away'); } };
  };

  // Probe-Spielstand für die Vorschau im Editor: alle Unterhaltungen zugestellt (ohne Bedingungen der Unterhaltung)
  DV.sampleRun = () => {
    const rs = VN.newRunState ? VN.newRunState() : { vars: {}, inv: {}, money: {}, seen: {} };
    for (const t of DV.threads()) DV.deliver(rs, t.id, true);
    const S = DV.st(rs);
    for (const c of DV.contacts()) { const l = S.log[c.id] || []; S.seen[c.id] = Math.max(0, l.length - 1); }
    return rs;
  };
})();
