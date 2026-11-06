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
    social: { icon: '📸', name: 'Social Media', color: '#e1306c', on: () => !!(DV.socialOn && DV.socialOn()) },
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
    d.lock = VN.fill(d.lock, { on: false, code: '', mode: 'once', hint: '', title: '' });
    if (!Array.isArray(d.apps)) d.apps = [];
    for (const a of d.apps) DV.fixApp(a);
    return d;
  };
  DV.defaultApps = (kind) => Object.keys(DV.BUILTIN).filter((k) => k !== 'app' && (k === 'messages' || k === 'log' || DV.BUILTIN[k].on()) && !(kind === 'desktop' && k === 'log')).map((k) => DV.fixApp({ id: VN.uid('app'), type: k }));
  DV.newDevice = (kind) => DV.fixDev({ id: VN.uid('dev'), kind, name: kind === 'desktop' ? VN.t('Computer') : VN.t('Handy'), key: kind === 'desktop' ? '' : (() => { const k = VN.World && VN.World.on() ? 'p' : 'h'; return DV.list().some((d) => d.key === k) ? '' : k; })(), hud: kind !== 'desktop', inMenu: kind !== 'desktop', apps: DV.defaultApps(kind) });
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
    // Social Media (0.9.21): Beiträge von Kontakten, erscheinen per Bedingung oder Aktion
    p.social = VN.fill(p.social, { name: 'Pixgram', notify: true, posts: [] });
    p.social.look = VN.fill(p.social.look, DV.SOC_LOOK);
    if (!Array.isArray(p.social.posts)) p.social.posts = [];
    for (const s of p.social.posts) {
      VN.fill(s, { id: VN.uid('sp'), author: '', text: '', image: '', likes: 0, when: '', mode: 'auto', conds: [], comments: [], replies: [], likeActions: [] });
      for (const c of s.comments) VN.fill(c, { id: VN.uid('sc'), author: '', text: '', conds: [] });
      for (const r of s.replies) VN.fill(r, { id: VN.uid('sr'), text: '', conds: [], actions: [] });
    }
    for (const t of p.chats.threads) {
      VN.fill(t, { conds: [], msgs: [], replies: [], devs: [] });
      for (const m of t.msgs) VN.fill(m, { id: VN.uid('cm'), from: 'them', text: '', image: '', conds: [], actions: [] });
      for (const r of t.replies) VN.fill(r, { id: VN.uid('cr'), text: '', conds: [], actions: [], next: '' });
    }
    return p;
  };

  // ---------- Social Media (0.9.21) ----------
  // Aussehen der Social-Media-Seite (frei gestaltbar)
  DV.SOC_LOOK = { custom: false, bg: '#0f1320', head: '#151a27', card: '#1b2232', text: '#f2f4f8', muted: '#9aa3b5', accent: '#e1306c', like: '#ff3b6b', logo: '', headImg: '', bgImg: '', font: '', radius: 16, logoFont: '' };
  DV.social = () => P().social || { posts: [] };
  DV.posts = () => DV.social().posts || [];
  DV.post = (id) => DV.posts().find((x) => x.id === id) || null;
  DV.socialOn = () => !!(P() && P().devices && P().devices.enabled && DV.posts().length);
  DV.newPost = (author) => ({ id: VN.uid('sp'), author: author || '', text: VN.t('Was für ein Tag! ✨'), image: '', likes: 12, when: '', mode: 'auto', conds: [], comments: [], replies: [], likeActions: [] });
  DV.sst = (rs) => { rs.social = VN.fill(rs.social, { seq: 0, shown: {}, hidden: {}, liked: {}, rep: {}, seen: 0, fol: {} }); return rs.social; };
  // Follower: Grundwert am Kontakt + Änderungen im Spielstand (Aktion „Follower ändern“)
  DV.followers = (c, rs) => { if (!c) return 0; const base = Math.max(0, Math.round(Number(c.followers) || 0)); const f = rs ? DV.sst(rs).fol[c.id] : null; return Math.max(0, f && f.set != null ? f.set + (f.add || 0) : base + ((f && f.add) || 0)); };
  // Beiträge, deren Bedingungen jetzt stimmen, erscheinen (einmal; danach bleiben sie, bis sie gelöscht werden)
  DV.socialSync = (rs) => {
    if (!rs || !DV.socialOn()) return [];
    const S = DV.sst(rs), out = [];
    for (const s of DV.posts()) if (s.mode !== 'action' && !S.shown[s.id] && !S.hidden[s.id] && VN.checkConds(s.conds || [], rs)) { S.shown[s.id] = ++S.seq; out.push(s); }
    return out;
  };
  DV.showPost = (rs, id) => { const S = DV.sst(rs), s = DV.post(id); if (!s) return null; delete S.hidden[id]; if (!S.shown[id]) { S.shown[id] = ++S.seq; return s; } return null; };
  DV.hidePost = (rs, id) => { const S = DV.sst(rs); if (S.shown[id]) S.hidden[id] = 1; };
  DV.feed = (rs) => { const S = DV.sst(rs); return DV.posts().filter((s) => S.shown[s.id] && !S.hidden[s.id]).sort((a, b) => S.shown[b.id] - S.shown[a.id]); };
  DV.socialNew = (rs) => { const S = DV.sst(rs); return DV.feed(rs).filter((s) => S.shown[s.id] > S.seen).length; };
  DV.postComments = (s, rs) => (s.comments || []).filter((c) => VN.checkConds(c.conds || [], rs));
  DV.postReplies = (s, rs) => (DV.sst(rs).rep[s.id] ? [] : (s.replies || []).filter((r) => VN.checkConds(r.conds || [], rs)));
  DV.whenLabel = (s, rs) => {
    if (s.when) return tr(s.id + ':when', s.when);
    const n = Math.max(0, DV.sst(rs).seq - (DV.sst(rs).shown[s.id] || 0));
    return n === 0 ? tp('gerade eben') : n <= 2 ? tp('vor kurzem') : tp('früher');
  };

  // ---------- Namen und Bilder ----------
  DV.appName = (a) => (a.name ? tr(a.id + ':name', a.name) : a.type === 'social' && P().social && P().social.name ? tr('social:name', P().social.name) : tp((DV.BUILTIN[a.type] || DV.BUILTIN.app).name));
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
  // Auf welchen Geräten erscheint eine Unterhaltung? (0.9.3) Leere Liste = auf allen.
  DV.devsOf = (th) => (th && Array.isArray(th.devs) ? th.devs.filter((id) => DV.dev(id)) : []);
  DV.onDev = (th, dev) => { const l = DV.devsOf(th); return !l.length || !dev || l.includes(dev.id || dev); };
  // Zeilen ohne Unterhaltung (Timeline-Chat, Beziehungs-Nachricht) stehen überall
  DV.visible = (e, dev) => !dev || !e.th || !DV.thread(e.th) || DV.onDev(DV.thread(e.th), dev);
  const isRead = (S, cid, e, i) => !!e.r || i < (S.seen[cid] || 0);
  DV.isRead = (rs, cid, i) => { const S = DV.st(rs), e = (S.log[cid] || [])[i]; return !e || isRead(S, cid, e, i); };
  DV.unread = (rs, cid, dev) => { const S = DV.st(rs), l = S.log[cid] || []; let n = 0; l.forEach((e, i) => { if (!e.me && !e.q && !isRead(S, cid, e, i) && DV.visible(e, dev)) n++; }); return n; };
  DV.unreadAll = (rs, dev) => Object.keys(DV.st(rs).log).reduce((n, cid) => n + DV.unread(rs, cid, dev), 0);
  // Gelesen: auf einem Gerät nur das, was dort zu sehen ist
  DV.markRead = (rs, cid, dev) => {
    const S = DV.st(rs), l = S.log[cid] || [];
    if (!dev) { l.forEach((e) => { e.r = 1; }); S.seen[cid] = l.length; return; }
    l.forEach((e, i) => { if (!isRead(S, cid, e, i) && DV.visible(e, dev)) e.r = 1; });
  };
  // Aktionen von Nachrichten, die gelesen wurden und noch nicht ausgeführt sind (0.9.4) – z. B. Ort freischalten
  DV.readActions = (rs, cid) => {
    const out = [];
    for (const e of DV.log(rs, cid)) {
      if (!e.m || e.ax || !e.r) continue;
      const th = DV.thread(e.th), m = th && (th.msgs || []).find((x) => x.id === e.m);
      e.ax = 1;
      if (m && (m.actions || []).length) out.push(...m.actions);
    }
    return out;
  };
  DV.waiting = (rs, cid, dev) => { const id = DV.st(rs).wait[cid]; const th = id && DV.thread(id); return th && DV.onDev(th, dev) ? id : null; };
  // Kontakte mit Verlauf, zuletzt aktive zuerst
  DV.known = (rs, dev) => { const S = DV.st(rs); return DV.contacts().filter((c) => (S.log[c.id] || []).some((e) => DV.visible(e, dev)) || DV.waiting(rs, c.id, dev)).sort((a, b) => (S.last[b.id] || 0) - (S.last[a.id] || 0)); };
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
      added.push(push(rs, c.id, Object.assign({ me: m.from === 'me', x: m.text || '', id: m.id + ':text', img: m.image || '', th: th.id, m: m.id, at }, th.silent ? { q: 1 } : {})));
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
  DV.replies = (rs, cid, dev) => { const id = DV.waiting(rs, cid, dev); const th = id && DV.thread(id); return th ? (th.replies || []).filter((r) => VN.checkConds(r.conds || [], rs)) : []; };
  DV.pickReply = (rs, cid, rid, dev) => {
    const S = DV.st(rs), th = DV.thread(S.wait[cid]);
    const r = th && (th.replies || []).find((x) => x.id === rid);
    if (!r) return null;
    push(rs, cid, { me: true, x: r.text || '', id: r.id + ':text', img: '', th: th.id, at: stamp(rs) });
    S.rep[th.id] = r.id;
    delete S.wait[cid];
    DV.markRead(rs, cid, dev || null);
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
    push(rs, c.id, { me: !!me, x: clip.text || '', id: clip.id, img: '', sc: scene.id, at: stamp(rs), r: 1 });
  };
  // Älterer Verlauf für die Handy-Ansicht in der Timeline (ohne die Zeilen dieser Szene)
  DV.historyFor = (rs, speaker, sceneId) => {
    if (!DV.on()) return [];
    const c = DV.contactByName(speaker);
    if (!c) return [];
    // Das Timeline-Handy zeigt nichts, was nur für Computer bestimmt ist
    const onPhone = (e) => { const th = e.th && DV.thread(e.th); const l = DV.devsOf(th); return !l.length || l.some((id) => DV.dev(id).kind !== 'desktop'); };
    return DV.log(rs, c.id).filter((e) => e.sc !== sceneId && onPhone(e)).slice(-12);
  };
  // Nachricht einer Figur (Beziehungs-Meilenstein, Bild-Geschenk) landet auch im Chat
  DV.logRel = (rs, ch, m) => {
    if (!DV.on() || !ch || !m) return;
    const c = DV.contacts().find((x) => x.char && (x.char === ch.id || x.char === ch.name));
    if (!c) return;
    push(rs, c.id, { me: false, x: m.text || '', id: m.id ? m.id + ':text' : '', img: m.image || '', at: stamp(rs), r: 1 });
  };

  // Welche Geräte und Apps gibt es gerade?
  DV.usable = (d, rs) => !!d && VN.checkConds(d.conds || [], rs);
  // Passwort / Code (0.9.3): 'once' = nach einmal richtig eingeben frei, 'always' = jedes Mal
  DV.locked = (d, rs) => !!(d && d.lock && d.lock.on && String(d.lock.code || '').trim()) && !(d.lock.mode !== 'always' && rs && (DV.st(rs).open || {})[d.id]);
  DV.unlock = (d, rs) => { const S = DV.st(rs); S.open = S.open || {}; S.open[d.id] = 1; if (VN.did) VN.did(rs, 'devUnlock', d.id); };
  DV.codeOf = (d, rs) => String((VN.Extras && VN.Extras.fill && rs ? VN.Extras.fill(d.lock.code || '', rs) : d.lock.code) || '').trim();
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
        return last < 0 || DV.isRead(rs, th.contact, last);
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
  VN.registerCond('devOpen', {
    label: '🔓 Gerät entsperrt', on: DV.on, make: () => ({ device: (DV.list().find((d) => d.lock && d.lock.on) || DV.list()[0] || {}).id || '', value: true }),
    check: (c, rs) => { const v = !!(DV.st(rs).open || {})[c.device]; return c.value === false ? !v : v; },
    text: (c) => { const d = DV.dev(c.device); return '🔓 ' + (d ? d.name : '?') + (c.value === false ? ' noch gesperrt' : ' entsperrt'); },
    problem: (c) => (DV.dev(c.device) ? null : 'Gerät fehlt'),
    row: (row, c, sel) => { row.appendChild(sel(c.device || '', devOpts(), (v) => VN.mutate(() => { c.device = v; }))); row.appendChild(sel(c.value === false ? 'no' : 'yes', [['yes', 'entsperrt'], ['no', 'noch gesperrt']], (v) => VN.mutate(() => { c.value = v !== 'no'; }))); }
  });
  VN.registerAction('devUnlock', {
    label: '🔓 Gerät entsperren', on: DV.on, make: () => ({ device: (DV.list().find((d) => d.lock && d.lock.on) || DV.list()[0] || {}).id || '' }),
    apply: (a, rs) => { const d = DV.dev(a.device); if (d) DV.unlock(d, rs); },
    text: (a) => { const d = DV.dev(a.device); return '🔓 ' + (d ? d.name : '?'); },
    problem: (a) => (DV.dev(a.device) ? null : 'Gerät fehlt'),
    row: (row, a, sel) => row.appendChild(sel(a.device || '', devOpts(), (v) => VN.mutate(() => { a.device = v; })))
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

  const postOpts = (none) => [['', none || '— Beitrag —'], ...DV.posts().map((s) => [s.id, (DV.contact(s.author) ? DV.contact(s.author).name + ': ' : '') + '„' + String(s.text || '').slice(0, 28) + '“'])];
  VN.registerAction('socialPost', {
    label: '📸 Beitrag posten', on: DV.socialOn, make: () => ({ post: (DV.posts()[0] || {}).id || '', quiet: false }),
    apply: (a, rs) => {
      const s = DV.showPost(rs, a.post);
      if (s && !a.quiet && window.Player && Player.socialNotify && !(VN.Idle && VN.Idle._sim)) Player.socialNotify(s);
    },
    text: (a) => { const s = DV.post(a.post); return '📸 ' + (s ? (DV.contact(s.author) ? DV.contact(s.author).name + ': ' : '') + '„' + String(s.text || '').slice(0, 30) + '“' : '?'); },
    problem: (a) => (DV.post(a.post) ? null : 'Beitrag fehlt'),
    row: (row, a, sel) => {
      row.appendChild(sel(a.post || '', postOpts(), (v) => VN.mutate(() => { a.post = v; })));
      row.appendChild(el('label', { class: 'check small' }, el('input', { type: 'checkbox', checked: !!a.quiet, onchange: (e) => VN.mutate(() => { a.quiet = e.target.checked; }) }), VN.t('ohne Meldung')));
    }
  });
  VN.registerAction('socialDelete', {
    label: '🗑 Beitrag löschen', on: DV.socialOn, make: () => ({ post: (DV.posts()[0] || {}).id || '' }),
    apply: (a, rs) => DV.hidePost(rs, a.post),
    text: (a) => { const s = DV.post(a.post); return '🗑 ' + (s ? '„' + String(s.text || '').slice(0, 30) + '“' : '?'); },
    problem: (a) => (DV.post(a.post) ? null : 'Beitrag fehlt'),
    row: (row, a, sel) => row.appendChild(sel(a.post || '', postOpts(), (v) => VN.mutate(() => { a.post = v; })))
  });
  const ctOpts = () => [['', '— Kontakt —'], ...DV.contacts().map((c) => [c.id, c.name])];
  VN.registerAction('socialFollowers', {
    label: '👥 Follower ändern', on: DV.socialOn, make: () => ({ contact: (DV.contacts()[0] || {}).id || '', op: 'add', amount: 100 }),
    apply: (a, rs) => {
      const S = DV.sst(rs), n = Math.round(Number(a.amount) || 0);
      const f = S.fol[a.contact] = S.fol[a.contact] || { add: 0 };
      if (a.op === 'set') { f.set = Math.max(0, n); f.add = 0; } else if (a.op === 'pct') f.add = (f.add || 0) + Math.round(DV.followers(DV.contact(a.contact), rs) * n / 100); else f.add = (f.add || 0) + n;
    },
    text: (a) => { const c = DV.contact(a.contact); const n = Number(a.amount) || 0; return '👥 ' + (c ? c.name : '?') + ' ' + (a.op === 'set' ? '= ' + n : a.op === 'pct' ? (n >= 0 ? '+' : '') + n + ' %' : (n >= 0 ? '+' : '') + n) + ' ' + VN.t('Follower'); },
    problem: (a) => (DV.contact(a.contact) ? null : 'Kontakt fehlt'),
    row: (row, a, sel) => {
      row.appendChild(sel(a.contact || '', ctOpts(), (v) => VN.mutate(() => { a.contact = v; })));
      row.appendChild(sel(a.op || 'add', [['add', '+ / − Anzahl'], ['pct', '+ / − Prozent'], ['set', 'auf Wert setzen']], (v) => VN.mutate(() => { a.op = v; })));
      row.appendChild(el('input', { type: 'number', value: a.amount != null ? a.amount : 0, style: { width: '90px' }, onchange: (e) => VN.mutate(() => { a.amount = Number(e.target.value) || 0; }) }));
    }
  });
  VN.registerCond('socialFollowers', {
    label: '👥 Follower', on: DV.socialOn, make: () => ({ contact: (DV.contacts()[0] || {}).id || '', cmp: '>=', value: 1000 }),
    check: (c, rs) => { const n = DV.followers(DV.contact(c.contact), rs), v = Number(c.value) || 0; return c.cmp === '<' ? n < v : n >= v; },
    text: (c) => { const k = DV.contact(c.contact); return '👥 ' + (k ? k.name : '?') + ' ' + (c.cmp === '<' ? '<' : '≥') + ' ' + (Number(c.value) || 0) + ' ' + VN.t('Follower'); },
    problem: (c) => (DV.contact(c.contact) ? null : 'Kontakt fehlt'),
    row: (row, c, sel) => {
      row.appendChild(sel(c.contact || '', ctOpts(), (v) => VN.mutate(() => { c.contact = v; })));
      row.appendChild(sel(c.cmp || '>=', [['>=', 'mindestens'], ['<', 'weniger als']], (v) => VN.mutate(() => { c.cmp = v; })));
      row.appendChild(el('input', { type: 'number', value: c.value != null ? c.value : 0, style: { width: '90px' }, onchange: (e) => VN.mutate(() => { c.value = Number(e.target.value) || 0; }) }));
    }
  });
  VN.registerCond('social', {
    label: '📸 Beitrag', on: DV.socialOn, make: () => ({ post: (DV.posts()[0] || {}).id || '', state: 'shown' }),
    check: (c, rs) => {
      const S = DV.sst(rs);
      if (c.state === 'not') return !S.shown[c.post];
      if (c.state === 'deleted') return !!S.hidden[c.post];
      if (c.state === 'liked') return !!S.liked[c.post];
      if (c.state === 'replied') return !!S.rep[c.post];
      return !!S.shown[c.post] && !S.hidden[c.post];
    },
    text: (c) => { const s = DV.post(c.post); return '📸 „' + (s ? String(s.text || '').slice(0, 24) : '?') + '“ ' + ({ shown: 'sichtbar', not: 'noch nicht gepostet', deleted: 'gelöscht', liked: 'geliked', replied: 'kommentiert' }[c.state] || ''); },
    problem: (c) => (DV.post(c.post) ? null : 'Beitrag fehlt'),
    row: (row, c, sel) => {
      row.appendChild(sel(c.post || '', postOpts(), (v) => VN.mutate(() => { c.post = v; })));
      row.appendChild(sel(c.state || 'shown', [['shown', 'sichtbar'], ['not', 'noch nicht gepostet'], ['deleted', 'gelöscht'], ['liked', 'vom Spieler geliked'], ['replied', 'vom Spieler kommentiert']], (v) => VN.mutate(() => { c.state = v; })));
    }
  });

  // Szenen, zu denen Apps, Nachrichten oder Antworten springen, gelten als erreichbar (Pfade, Prüfung)
  VN.reachRoots = VN.reachRoots || [];
  VN.reachRoots.push(() => {
    if (!DV.on()) return [];
    const out = [];
    const walk = (x, d) => { if (!x || typeof x !== 'object' || d > 10) return; if (Array.isArray(x)) { for (const y of x) walk(y, d + 1); return; } if (x.type && VN.SCENE_ACTIONS.includes(x.type) && x.scene) out.push(x.scene); for (const k in x) walk(x[k], d + 1); };
    walk(DV.cfg().list, 0); walk(DV.threads(), 0); walk(DV.posts(), 0);
    return out;
  });

  // ---------- Prüfungen ----------
  DV.issues = () => {
    const out = [];
    if (!DV.on()) return out;
    if (!DV.list().length) out.push({ text: VN.t('Geräte sind eingeschaltet, aber es gibt noch kein Gerät.') });
    const keys = {};
    for (const d of DV.list()) {
      if (d.key && d.key.toLowerCase() === 'h' && VN.World && VN.World.on()) out.push({ text: VN.tf('Gerät „{d}“ nutzt die Taste H – die ist auch „🏠 Zuhause“ bei Welt & Orte. Andere Taste wählen, z. B. P.', { d: d.name }) });
      if (d.key) { if (keys[d.key]) out.push({ text: VN.tf('Zwei Geräte nutzen dieselbe Taste „{k}“.', { k: d.key.toUpperCase() }) }); keys[d.key] = 1; }
      for (const a of d.apps) if (a.type === 'app' && !(a.actions || []).length && !a.text && !a.pic && !a.title) out.push({ text: VN.tf('Eigene App „{a}“ auf „{d}“ macht nichts (keine Seite, keine Aktion).', { a: a.name || '?', d: d.name }) });
    }
    for (const t of DV.threads()) {
      if (!DV.contact(t.contact)) out.push({ text: VN.tf('Unterhaltung „{t}“ hat keinen Kontakt.', { t: t.name }) });
      if (DV.devsOf(t).length && !DV.devsOf(t).some((id) => DV.dev(id).apps.some((a) => a.type === 'messages'))) out.push({ text: VN.tf('Unterhaltung „{t}“ ist nur für Geräte ohne App „Nachrichten“ bestimmt – sie wäre nirgends zu lesen.', { t: t.name }) });
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
    for (const d of DV.list()) {
      if (d.lock && d.lock.on && d.lock.title) out.push({ id: d.id + ':locktitle', area: 'Geräte', where: d.name, who: 'Sperre', text: d.lock.title, set: (v) => { d.lock.title = v; } });
      if (d.lock && d.lock.on && d.lock.hint) out.push({ id: d.id + ':lockhint', area: 'Geräte', where: d.name, who: 'Sperre', text: d.lock.hint, set: (v) => { d.lock.hint = v; } });
    }
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
    let closed = false, typing = null, lockKey = null;
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
    const appBadge = (a) => (a.type === 'messages' ? DV.unreadAll(rs, d) : a.type === 'social' ? DV.socialNew(rs) : a.type === 'gallery' && VN.Extras && VN.Extras.newCount ? VN.Extras.newCount() : 0);
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
      const firstNew = DV.log(rs, cid).findIndex((e, i) => !e.me && !DV.isRead(rs, cid, i) && DV.visible(e, d));
      const draw = (hideFrom) => {
        list.innerHTML = '';
        const l = DV.log(rs, cid);
        let lastWhen = '', any = 0;
        l.forEach((e, i) => {
          if (hideFrom != null && i >= hideFrom) return;
          if (!DV.visible(e, d)) return;
          any++;
          const w = DV.whenText(e.at);
          if (w && w !== lastWhen) list.appendChild(el('div', { class: 'dv-when' }, w));
          lastWhen = w || lastWhen;
          if (i === firstNew && any > 1) list.appendChild(el('div', { class: 'dv-new' }, tp('Neu')));
          list.appendChild(bubble(e));
        });
        if (!any) list.appendChild(el('div', { class: 'dv-empty' }, tp('Noch keine Nachrichten.')));
        drawReplies(hideFrom != null);
        requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
      };
      const drawReplies = (busy) => {
        foot.innerHTML = '';
        if (busy) return;
        const reps = DV.replies(rs, cid, d);
        foot.hidden = !reps.length;
        for (const r of reps) foot.appendChild(el('button', { class: 'dv-reply', onclick: (e) => { e.stopPropagation(); answer(r); } }, XF(tr(r.id + ':text', r.text || '…'))));
      };
      const answer = (r) => {
        if (typing) return;
        const res = DV.pickReply(rs, cid, r.id, d);
        if (!res) return;
        snd('click');
        draw();
        if ((r.actions || []).length && H.apply) { const x = H.apply(r.actions, r.id); if (x && x.close) { close(); return; } }
        // Antwort darauf: gleich zustellen (der Spielstand stimmt sofort), aber Zeile für Zeile mit „schreibt …“ zeigen
        const nx = r.next ? DV.deliver(rs, r.next) : null;
        if (!nx || !nx.added.length) { if (nx) draw(); refreshBadges(); return; }
        if (nx.contact.id !== cid || !DV.onDev(nx.thread, d)) { refreshBadges(); if (o.preview || !H.note) return; H.note(nx); return; }
        const total = DV.log(rs, cid).length;
        let shown = total - nx.added.length;
        const step = () => {
          if (closed || !wrap.isConnected) { typing = null; return; }
          if (shown >= total) { typing = null; DV.markRead(rs, cid, d); draw(); refreshBadges(); runRead(); return; }
          const e = DV.log(rs, cid)[shown];
          draw(shown);
          const dots = el('div', { class: 'dv-msg typing' + (e.me ? ' me' : '') }, el('i'), el('i'), el('i'));
          list.appendChild(dots);
          list.scrollTop = list.scrollHeight;
          typing = setTimeout(() => { shown++; snd('item'); step(); }, Math.min(1700, 550 + (DV.entryText(e).length * 18)));
        };
        typing = setTimeout(step, 350);
      };
      // Gelesene Nachrichten können etwas freischalten (Ort, Quest, Gegenstand …)
      const runRead = () => {
        if (o.preview || !H.apply) return;
        const list = DV.readActions(rs, cid);
        if (!list.length) return;
        setTimeout(() => { if (closed) return; const x = H.apply(list, 'chat:' + cid); if (x && x.close) close(); else { refreshBadges(); if (wrap.isConnected) drawReplies(false); } }, 400);
      };
      DV.markRead(rs, cid, d);
      draw();
      runRead();
      return wrap;
    };
    // Liste aller Unterhaltungen
    const chatList = (onPick, cur) => {
      const box = el('div', { class: 'dv-clist' });
      const known = DV.known(rs, d);
      if (!known.length) box.appendChild(el('div', { class: 'dv-empty' }, tp('Noch keine Nachrichten.')));
      for (const c of known) {
        const l = DV.log(rs, c.id).filter((e) => DV.visible(e, d)), last = l[l.length - 1];
        const n = DV.unread(rs, c.id, d);
        const prev = last ? (last.me ? tp('Du') + ': ' : '') + (last.img && !last.x ? '🖼 ' + tp('Bild') : (window.Fx ? Fx.plain(DV.entryText(last)) : DV.entryText(last))) : '…';
        box.appendChild(el('button', { class: 'dv-crow' + (n ? ' unread' : '') + (cur === c.id ? ' on' : ''), onclick: (e) => { e.stopPropagation(); snd('click'); onPick(c.id); } },
          DV.avatar(c), el('span', { class: 'dv-crow-t' }, el('strong', null, DV.cName(c)), el('span', null, prev.slice(0, 60))),
          badge(n) || (DV.waiting(rs, c.id, d) ? el('span', { class: 'dv-wait', title: tp('Wartet auf Antwort') }, '↩') : null)));
      }
      return box;
    };
    // Eigene App: Seite (Titel, Text, Bild)
    const pageView = (a) => el('div', { class: 'dv-page' },
      a.pic && VN.assetUrl(a.pic) ? el('img', { class: 'dv-page-img', src: VN.assetUrl(a.pic), alt: '' }) : null,
      a.title ? el('h3', null, tr(a.id + ':title', a.title)) : null,
      a.text ? fmtText(el('div', { class: 'dv-page-t' }), XF(tr(a.id + ':text', a.text))) : null);
    const hasPage = (a) => !!(a.title || a.text || a.pic);

    // Social Media: Feed, Profile, Likes und Kommentare des Spielers
    const socialView = (a, onBack) => {
      const box = el('div', { class: 'dv-soc' });
      const SL = (DV.social().look) || DV.SOC_LOOK;
      if (SL.custom) {
        box.classList.add('custom');
        const st = box.style, font = (f) => (window.Theme && Theme.fontCss ? Theme.fontCss(f) : f);
        st.setProperty('--soc-bg', SL.bg); st.setProperty('--soc-head', SL.head); st.setProperty('--soc-card', SL.card);
        st.setProperty('--soc-text', SL.text); st.setProperty('--soc-muted', SL.muted); st.setProperty('--soc-acc', SL.accent); st.setProperty('--soc-like', SL.like);
        st.setProperty('--soc-radius', (Number(SL.radius) || 0) / 10 + 'cqh');
        if (SL.font) st.setProperty('--soc-font', font(SL.font));
        if (SL.logoFont) st.setProperty('--soc-logo-font', font(SL.logoFont));
        if (SL.bgImg && VN.assetUrl(SL.bgImg)) st.setProperty('--soc-bg-img', `url("${VN.assetUrl(SL.bgImg)}")`);
        if (SL.headImg && VN.assetUrl(SL.headImg)) st.setProperty('--soc-head-img', `url("${VN.assetUrl(SL.headImg)}")`);
      }
      const logo = () => (SL.custom && SL.logo && VN.assetUrl(SL.logo) ? el('img', { class: 'dv-soc-logoimg', src: VN.assetUrl(SL.logo), alt: tr('social:name', DV.social().name || 'Pixgram') }) : tr('social:name', DV.social().name || 'Pixgram'));
      let prof = null;
      const S = DV.sst(rs);
      DV.socialSync(rs);
      const name = (c) => DV.cName(c);
      const draw = () => {
        box.innerHTML = '';
        S.seen = S.seq;
        const head = el('div', { class: 'dv-head dv-soc-head' },
          onBack || prof ? el('button', { class: 'dv-back-btn', onclick: (e) => { e.stopPropagation(); if (prof) { prof = null; draw(); } else onBack(); } }, '‹') : null,
          el('div', { class: 'dv-head-t' }, el('strong', { class: 'dv-soc-logo' }, prof ? name(DV.contact(prof)) : logo())));
        box.appendChild(head);
        const list = el('div', { class: 'dv-soc-list' });
        box.appendChild(list);
        const feed = DV.feed(rs).filter((s) => !prof || s.author === prof);
        if (prof) {
          const c = DV.contact(prof);
          list.appendChild(el('div', { class: 'dv-soc-prof' }, DV.avatar(c, 'xl'),
            el('div', null, el('strong', null, name(c)), el('div', { class: 'dv-soc-stat' }, (feed.length === 1 ? tp('1 Beitrag') : VN.tf('{n} Beiträge', { n: feed.length })) + (c && (c.followers || DV.sst(rs).fol[c.id]) ? ' · ' + VN.tf('{n} Follower', { n: DV.followers(c, rs).toLocaleString() }) : '')),
              c && c.bio ? el('div', { class: 'dv-soc-bio' }, tr(c.id + ':bio', c.bio)) : null)));
        }
        if (!feed.length) list.appendChild(el('div', { class: 'dv-empty' }, tp('Noch keine Beiträge.')));
        for (const s of feed) {
          const c = DV.contact(s.author);
          const liked = !!S.liked[s.id];
          const card = el('div', { class: 'dv-soc-post' });
          card.appendChild(el('div', { class: 'dv-soc-top', onclick: (e) => { e.stopPropagation(); if (!prof && c) { prof = c.id; snd('click'); draw(); list.scrollTop = 0; } } },
            DV.avatar(c, 'sm'), el('div', null, el('strong', null, name(c)), el('div', { class: 'dv-soc-when' }, DV.whenLabel(s, rs)))));
          if (s.image && VN.assetUrl(s.image)) card.appendChild(el('img', { class: 'dv-soc-img', src: VN.assetUrl(s.image), alt: '', ondblclick: (e) => { e.stopPropagation(); if (!liked) like(s); } }));
          if (s.text) card.appendChild(fmtText(el('div', { class: 'dv-soc-text' }), XF(tr(s.id, s.text))));
          card.appendChild(el('div', { class: 'dv-soc-bar' },
            el('button', { class: 'dv-soc-like' + (liked ? ' on' : ''), onclick: (e) => { e.stopPropagation(); like(s); } }, liked ? '♥' : '♡'),
            el('span', null, String((Number(s.likes) || 0) + (liked ? 1 : 0))),
            el('span', { class: 'dv-soc-cn' }, '💬 ' + (DV.postComments(s, rs).length + (S.rep[s.id] ? 1 : 0)))));
          for (const cm of DV.postComments(s, rs)) card.appendChild(el('div', { class: 'dv-soc-cm' }, el('strong', null, name(DV.contact(cm.author)) + ' '), XF(tr(cm.id, cm.text))));
          if (S.rep[s.id]) { const r = (s.replies || []).find((x) => x.id === S.rep[s.id]); if (r) card.appendChild(el('div', { class: 'dv-soc-cm me' }, el('strong', null, tp('Du') + ' '), XF(tr(r.id, r.text)))); }
          const reps = DV.postReplies(s, rs);
          if (reps.length) card.appendChild(el('div', { class: 'dv-soc-reps' }, ...reps.map((r) => el('button', { class: 'dv-reply', onclick: (e) => { e.stopPropagation(); reply(s, r); } }, XF(tr(r.id, r.text))))));
          list.appendChild(card);
        }
      };
      const run = (actions, key) => { if (!o.preview && H.apply && (actions || []).length) { const x = H.apply(actions, key); if (x && x.close) { close(); return true; } } return false; };
      const like = (s) => {
        const first = !(s.id in S.liked);
        if (S.liked[s.id]) S.liked[s.id] = 0; else S.liked[s.id] = 1;
        snd('click');
        // Aktionen nur beim ersten Like (sonst ließen sich Beziehungspunkte durch An/Aus sammeln)
        if (first && S.liked[s.id] && run(s.likeActions, s.id + ':like')) return;
        draw(); refreshBadges();
      };
      const reply = (s, r) => {
        S.rep[s.id] = r.id; snd('click');
        if (run(r.actions, r.id)) return;
        draw();
      };
      draw();
      return box;
    };

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
      } else if (a.type === 'social') {
        main.classList.add('app');
        main.appendChild(socialView(a, home));
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
      const msg = a.type === 'messages', soc = a.type === 'social';
      const w = { app: a, z: ++zTop, x: (soc ? 30 : 20) + n * 4, y: (soc ? 4 : 6) + n * 4, cw: msg ? 62 : soc ? 40 : 46, ch: msg ? 72 : soc ? 84 : 62 };
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
          const known = DV.known(rs, d);
          if (!w.chat && known.length) w.chat = known[0].id;
          const cv = w.chat ? chatView(w.chat, null) : el('div', { class: 'dv-chat dv-empty' }, tp('Noch keine Nachrichten.'));
          content.append(el('div', { class: 'dv-split' }, chatList((cid) => { w.chat = cid; w.fill(); }, w.chat), cv));
          setTimeout(refreshBadges, 0);
        } else if (a.type === 'social') content.appendChild(socialView(a, null));
        else content.appendChild(pageView(a));
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
      if (a.type === 'social') {
        if (desk) openWin(a); else { view = { app: a, chat: null }; phoneDraw(); }
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
      if (lockKey && lockKey(e)) return true;
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

    // Sperrbildschirm (0.9.3): Code eingeben, dann geht es normal weiter
    const lockScreen = (done) => {
      screen.innerHTML = '';
      const code = DV.codeOf(d, rs);
      const pin = /^\d{1,8}$/.test(code);
      let typed = '';
      const msg = el('div', { class: 'dv-lock-msg' });
      const wrong = () => { msg.textContent = tp('Falscher Code'); box.animate([{ transform: 'translateX(-1.4cqh)' }, { transform: 'translateX(1.4cqh)' }, { transform: 'translateX(-0.8cqh)' }, { transform: 'none' }], { duration: 300 }); snd('close'); };
      const tryIt = (v) => {
        if (String(v).trim().toLowerCase() === code.toLowerCase()) { if (d.lock.mode !== 'always' && !o.preview) DV.unlock(d, rs); snd('item'); done(); return true; }
        wrong(); return false;
      };
      const title = d.lock.title ? tr(d.id + ':locktitle', d.lock.title) : (desk ? tr(d.id + ':name', d.name) : tp('Gesperrt'));
      const hint = d.lock.hint ? el('div', { class: 'dv-lock-hint' }, XF(tr(d.id + ':lockhint', d.lock.hint))) : null;
      let box;
      if (pin) {
        const dots = el('div', { class: 'dv-pin-dots' });
        const drawDots = () => { dots.innerHTML = ''; for (let i = 0; i < code.length; i++) dots.appendChild(el('span', { class: i < typed.length ? 'on' : '' })); };
        const pad = el('div', { class: 'dv-pin-pad' });
        const key = (k) => {
          msg.textContent = '';
          if (k === '⌫') typed = typed.slice(0, -1); else if (typed.length < code.length) typed += k;
          drawDots();
          if (typed.length === code.length) setTimeout(() => { if (!tryIt(typed)) { typed = ''; drawDots(); } }, 150);
        };
        for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']) pad.appendChild(k ? el('button', { class: 'dv-pin-key', onclick: (e) => { e.stopPropagation(); snd('click'); key(k); } }, k) : el('span'));
        drawDots();
        box = el('div', { class: 'dv-lock-box' }, el('div', { class: 'dv-lock-ico' }, '🔒'), el('strong', null, title), hint, dots, msg, pad);
        lockKey = (e) => { if (/^\d$/.test(e.key)) { key(e.key); return true; } if (e.key === 'Backspace') { key('⌫'); return true; } return false; };
      } else {
        const inp = el('input', { type: 'password', class: 'dv-lock-input', placeholder: tp('Passwort'), onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') { if (!tryIt(inp.value)) inp.select(); } else if (e.key === 'Escape') close(); else msg.textContent = ''; } });
        box = el('div', { class: 'dv-lock-box' }, el('div', { class: 'dv-lock-ico' }, desk ? '👤' : '🔒'), el('strong', null, title), hint, inp, msg,
          el('button', { class: 'dv-lock-ok', onclick: (e) => { e.stopPropagation(); if (!tryIt(inp.value)) inp.select(); } }, desk ? tp('Anmelden') : tp('Entsperren')));
        if (!o.preview) setTimeout(() => inp.focus(), 60);
      }
      screen.append(desk ? el('div', null) : statusBar(), el('div', { class: 'dv-lock' + (desk ? ' desk' : '') }, box),
        desk ? el('button', { class: 'dv-task-off dv-lock-off', title: tp('Schließen'), onclick: (e) => { e.stopPropagation(); close(); } }, '⏻') : el('div', { class: 'dv-homebar', onclick: (e) => { e.stopPropagation(); close(); } }));
    };
    // Start
    const start = () => {
      lockKey = null;
      if (desk) deskDraw(); else phoneDraw();
      if (o.app) { const a = d.apps.find((x) => x.id === o.app || x.type === o.app); if (a) openApp(a, o.contact); }
    };
    snd('open');
    root.classList.add('dv-in');
    if (DV.locked(d, rs)) lockScreen(start); else start();
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
