// Editor: Spielsysteme → Geräte (Handy / Computer mit Apps) und Nachrichten (Kontakte, Unterhaltungen, Antworten).
(function () {
  const { el } = VN;
  const S = window.Systems;
  const DV = () => VN.Devices;

  const sel = (value, options, commit, style) => {
    const s = el('select', { style: style || null, onchange: (e) => VN.mutate(() => commit(e.target.value)) });
    for (const [v, l] of options) { const o = el('option', { value: v }, VN.t(l)); if (String(v) === String(value == null ? '' : value)) o.selected = true; s.appendChild(o); }
    return s;
  };
  const txt = (value, commit, ph, style) => el('input', { type: 'text', value: value || '', placeholder: ph ? VN.t(ph) : '', style: style || null, onchange: (e) => VN.mutate(() => commit(e.target.value)) });
  const num = (value, commit, style) => el('input', { type: 'number', value: value != null ? value : 0, style: style || { width: '70px' }, onchange: (e) => VN.mutate(() => commit(Number(e.target.value))) });
  const col = (value, commit) => el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#888888', onchange: (e) => VN.mutate(() => commit(e.target.value)) });
  const chk = (value, label, commit) => el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!value, onchange: (e) => VN.mutate(() => commit(e.target.checked)) }), VN.t(label));
  const row = (label, ...x) => el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '150px' } }, VN.t(label)), ...x);
  const imgOpts = (none) => [['', none || '— keins —'], ...VN.assetsOf('image').map((a) => [a.id, a.name])];
  const thumb = (id) => (id && VN.assetUrl(id) ? el('span', { class: 'mini-thumb', style: { width: '26px', height: '26px', backgroundImage: `url("${VN.assetUrl(id)}")` } }) : null);

  // Fenster mit Bedingungen / Aktionen, zeichnet sich bei Änderungen neu
  const modal = (title, draw) => {
    const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) { back.remove(); VN.render(); } } });
    const card = el('div', { class: 'modal', style: { width: '640px', maxHeight: '84vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' } });
    const redraw = () => {
      card.innerHTML = '';
      card.appendChild(el('div', { class: 'row gap8' }, el('strong', { style: { flex: '1', fontSize: '16px' } }, title), el('button', { class: 'btn primary', onclick: () => { back.remove(); VN.render(); } }, VN.t('Fertig'))));
      draw(card);
    };
    redraw();
    back.appendChild(card);
    document.body.appendChild(back);
    const orig = VN.render;
    VN.render = function () { orig.apply(this, arguments); if (back.isConnected) redraw(); else VN.render = orig; };
  };
  const condBtn = (list, title, label) => el('button', { class: 'btn tiny' + (list.length ? ' primary' : ''), title: VN.t(title), onclick: () => modal(VN.t(title), (c) => c.appendChild(VN.condEditor(list, VN.t('Nur wenn')))) }, (label || '🔒') + (list.length ? ' ' + list.length : ''));
  const actBtn = (list, title) => el('button', { class: 'btn tiny' + (list.length ? ' primary' : ''), title: VN.t(title), onclick: () => modal(VN.t(title), (c) => c.appendChild(VN.actionEditor(list, VN.t('Dann ausführen')))) }, '⚡' + (list.length ? ' ' + list.length : ''));

  // ---------- Vorschau ----------
  const preview = (d, opts) => {
    const host = el('div', { class: 'dv-prev' });
    const bgA = VN.project.scenes.map((s) => s.bg).find((b) => b && VN.assetUrl(b));
    if (bgA) host.style.backgroundImage = `url("${VN.assetUrl(bgA)}")`;
    const mount = () => {
      host.querySelectorAll('.dv-back').forEach((n) => n.remove());
      DV().open(host, Object.assign({ dev: d, rs: (opts && opts.rs) || DV().sampleRun(), preview: true, H: { onClose: () => setTimeout(mount, 60), uiSound: (k) => { if (window.Theme && Theme.sound) try { Theme.sound(k === 'item' ? 'click' : k); } catch (e) { /* egal */ } } } }, opts || {}));
    };
    requestAnimationFrame(mount);
    return host;
  };

  // ---------- Reiter „Geräte“ ----------
  S.devicesTab = (body) => {
    const C = DV().cfg();
    body.appendChild(el('p', { class: 'muted' }, VN.t('Ein Handy oder ein Computer im Spiel: Startbildschirm mit Apps wie Nachrichten, Inventar, Beziehungen, Galerie, Quests oder eigenen Apps (Seiten, Aktionen, Sprung in eine Szene). Öffnen per Knopf, Taste oder mit der Aktion „📱 Gerät öffnen“ – z. B. auf einer Hitbox im Hub (der Laptop auf dem Schreibtisch).')));
    const iss = DV().issues();
    if (iss.length && window.Help && Help.sysBox) body.appendChild(Help.sysBox(iss));
    let d = DV().dev(VN.ui.devSel) || C.list[0];
    const pills = el('div', { class: 'row gap8', style: { flexWrap: 'wrap', marginBottom: '10px' } },
      ...C.list.map((x) => el('button', { class: 'btn' + (x === d ? ' primary' : ''), onclick: () => { VN.ui.devSel = x.id; VN.render(); } }, (x.kind === 'desktop' ? '💻 ' : '📱 ') + x.name)),
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const n = DV().newDevice('phone'); C.list.push(n); VN.ui.devSel = n.id; }) }, '+ 📱 ' + VN.t('Handy')),
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const n = DV().newDevice('desktop'); C.list.push(n); VN.ui.devSel = n.id; }) }, '+ 💻 ' + VN.t('Computer')));
    body.appendChild(pills);
    if (!d) { body.appendChild(el('div', { class: 'hint-box' }, VN.t('Noch kein Gerät. Lege oben ein Handy oder einen Computer an.'))); return; }
    const L = d.look;
    const left = el('div', null);
    // Gerät
    left.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Gerät')),
      row('Name', txt(d.name, (v) => { d.name = v || VN.t('Gerät'); }, null, { width: '180px' })),
      row('Art', sel(d.kind, [['phone', '📱 Handy (hochkant, App-Raster)'], ['desktop', '💻 Computer (Desktop, Fenster, Taskleiste)']], (v) => { d.kind = v; d.look = VN.fill({}, v === 'desktop' ? DV().DESK_LOOK : DV().LOOK); if (d.wallpaper) d.look.screen = L.screen; })),
      row('Taste', txt(d.key, (v) => { d.key = String(v || '').trim().slice(0, 1).toLowerCase(); }, 'z. B. h', { width: '60px' }), el('span', { class: 'muted small' }, VN.t('Leer = keine Taste'))),
      el('div', { class: 'logic-row' }, chk(d.hud, 'Knopf oben rechts im Spiel', (v) => { d.hud = v; }), chk(d.inMenu, 'Im Pausenmenü', (v) => { d.inMenu = v; })),
      row('Uhrzeit', sel(d.clock, [['auto', 'Automatisch (Spielzeit, sonst echte Uhr)'], ['game', 'Spielzeit (Tageszeit)'], ['real', 'Echte Uhrzeit'], ['none', 'Keine']], (v) => { d.clock = v; })),
      row('Erst verfügbar, wenn', condBtn(d.conds, 'Gerät erst verfügbar, wenn …', d.conds.length ? '🔒' : '🔓 ' + VN.t('immer'))),
      el('div', { class: 'row gap8' }, el('div', { class: 'spacer' }),
        el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const n = JSON.parse(JSON.stringify(d)); n.id = VN.uid('dev'); n.name = d.name + ' 2'; n.key = ''; for (const a of n.apps) a.id = VN.uid('app'); C.list.push(n); VN.ui.devSel = n.id; }) }, VN.t('Duplizieren')),
        el('button', { class: 'btn tiny danger', onclick: () => { if (confirm(VN.tf('Gerät „{n}“ löschen?', { n: d.name }))) VN.mutate(() => { C.list = C.list.filter((x) => x !== d); VN.ui.devSel = null; }); } }, VN.t('Löschen')))));
    // Code / Passwort (0.9.3)
    const K = d.lock;
    left.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, '🔒 ' + VN.t('Code / Passwort')),
      el('div', { class: 'logic-row' }, chk(K.on, 'Gerät ist gesperrt', (v) => { K.on = v; })),
      K.on ? row('Code', txt(K.code, (v) => { K.code = v.trim(); }, 'z. B. 1234 oder Drache', { width: '160px' }), el('span', { class: 'muted small' }, VN.t('Nur Ziffern = Zahlenfeld, sonst Passwort-Feld. Auch {Platzhalter} einer Variable möglich.'))) : null,
      K.on ? row('Freischalten', sel(K.mode, [['once', 'Einmal richtig eingeben, danach immer offen'], ['always', 'Jedes Mal eingeben']], (v) => { K.mode = v; })) : null,
      K.on ? row('Überschrift', txt(K.title, (v) => { K.title = v; }, d.kind === 'desktop' ? d.name : 'Gesperrt', { width: '200px' })) : null,
      K.on ? row('Hinweis', txt(K.hint, (v) => { K.hint = v; }, 'z. B. Geburtstag von Cloe', { width: '260px' })) : null,
      K.on && !String(K.code || '').trim() ? el('div', { class: 'cond-warn' }, '⚠ ' + VN.t('Ohne Code ist das Gerät nicht gesperrt.')) : null,
      K.on ? el('div', { class: 'muted small' }, VN.t('Prüfen mit der Bedingung „🔓 Gerät entsperrt“. Findet der Spieler den Code in der Story, kann die Aktion „🔓 Gerät entsperren“ ihn auch direkt freischalten.')) : null));
    // Aussehen
    const desk = d.kind === 'desktop';
    left.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Aussehen')),
      row('Hintergrundbild', sel(d.wallpaper, imgOpts('— nur Farbe —'), (v) => { d.wallpaper = v; }), thumb(d.wallpaper)),
      row(desk ? 'Monitor-Rahmen (Bild)' : 'Handy-Rahmen (Bild)', sel(d.frame, imgOpts('— eingebaut —'), (v) => { d.frame = v; }), thumb(d.frame)),
      d.frame ? row('Bildschirm-Abstand im Rahmen %', num(L.inset, (v) => { L.inset = Math.max(0, Math.min(30, v)); })) : null,
      row('Farben', el('span', { class: 'row gap4', title: VN.t('Akzent') }, col(L.accent, (v) => { L.accent = v; }), el('span', { class: 'muted small' }, VN.t('Akzent'))),
        el('span', { class: 'row gap4' }, col(L.screen, (v) => { L.screen = v; }), el('span', { class: 'muted small' }, VN.t('Bildschirm'))),
        el('span', { class: 'row gap4' }, col(L.text, (v) => { L.text = v; }), el('span', { class: 'muted small' }, VN.t('Schrift')))),
      row('', el('span', { class: 'row gap4' }, col(L.panel, (v) => { L.panel = v; }), el('span', { class: 'muted small' }, VN.t('App-Fläche'))),
        el('span', { class: 'row gap4' }, col(L.panelText || L.text, (v) => { L.panelText = v; }), el('span', { class: 'muted small' }, VN.t('App-Schrift'))),
        el('span', { class: 'row gap4' }, col(L.bubble, (v) => { L.bubble = v; }), el('span', { class: 'muted small' }, VN.t('Blase'))),
        el('span', { class: 'row gap4' }, col(L.bubbleMe, (v) => { L.bubbleMe = v; }), el('span', { class: 'muted small' }, VN.t('Meine Blase')))),
      row('App-Symbole', sel(L.iconShape, [['round', 'Abgerundet'], ['circle', 'Rund'], ['square', 'Eckig']], (v) => { L.iconShape = v; })),
      row('Schrift', sel(L.font || '', window.Theme ? Theme.fontOptions('— wie das Spiel —') : [['', '— wie das Spiel —']], (v) => { L.font = v; })),
      desk ? row('Größe %', num(L.size, (v) => { L.size = Math.max(40, Math.min(100, v)); }), el('span', { class: 'muted small' }, VN.t('100 = ganzer Bildschirm')))
        : row('Größe (Höhe %)', num(L.size, (v) => { L.size = Math.max(40, Math.min(100, v)); }), sel(L.side, [['center', 'Mitte'], ['right', 'Rechts'], ['left', 'Links']], (v) => { L.side = v; })),
      row('Hintergrund abdunkeln %', num(L.dim, (v) => { L.dim = Math.max(0, Math.min(100, v)); }))));
    // Apps
    const apps = el('div', { class: 'opt-card dv-applist' }, el('div', { class: 'sec-title' }, VN.t('Apps')),
      el('div', { class: 'muted small' }, VN.t('Reihenfolge wie auf dem Gerät. Symbol: Emoji oder eigenes Bild. Mit 🔒 erscheint eine App erst, wenn ihre Bedingungen erfüllt sind.')));
    d.apps.forEach((a, i) => {
      const B = DV().BUILTIN[a.type] || DV().BUILTIN.app;
      apps.appendChild(el('div', { class: 'logic-row' },
        el('span', { class: 'dv-ico', style: { background: a.image && VN.assetUrl(a.image) ? `center/cover url("${VN.assetUrl(a.image)}")` : DV().appColor(a) } }, a.image ? '' : DV().appIcon(a)),
        txt(a.icon, (v) => { a.icon = v.trim(); }, B.icon, { width: '44px', textAlign: 'center' }),
        txt(a.name, (v) => { a.name = v; }, B.name, { width: '130px' }),
        el('span', { class: 'muted small', style: { width: '90px' } }, VN.t(a.type === 'app' ? 'Eigene App' : B.name)),
        col(DV().appColor(a), (v) => { a.color = v; }),
        sel(a.image, imgOpts('— Bild —'), (v) => { a.image = v; }, { width: '90px' }),
        condBtn(a.conds, 'App erst zeigen, wenn …'),
        a.type === 'app' ? el('button', { class: 'btn tiny primary', onclick: () => appModal(a) }, VN.t('Inhalt …')) : null,
        B.on() ? null : el('span', { class: 'cond-warn', title: VN.t('Das System dazu ist ausgeschaltet – die App wird nicht angezeigt.') }, '⚠'),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn tiny', disabled: i === 0, onclick: () => VN.mutate(() => { d.apps.splice(i, 1); d.apps.splice(i - 1, 0, a); }) }, '↑'),
        el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { d.apps.splice(i, 1); }) }, '×')));
    });
    const add = el('select', { onchange: (e) => { const v = e.target.value; if (!v) return; VN.mutate(() => { const a = DV().fixApp({ id: VN.uid('app'), type: v }); if (v === 'app') { a.name = VN.t('Notizen'); a.icon = '📝'; } d.apps.push(a); }); } },
      el('option', { value: '' }, '+ ' + VN.t('App hinzufügen …')),
      ...Object.entries(DV().BUILTIN).map(([k, B]) => el('option', { value: k }, B.icon + ' ' + VN.t(B.name) + (k !== 'app' && !B.on() ? ' (' + VN.t('System aus') + ')' : ''))));
    apps.appendChild(el('div', { class: 'row gap8' }, add));
    left.appendChild(apps);
    left.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Im Spiel öffnen')),
      el('div', { class: 'hint-box' }, VN.t('Knopf oben rechts, Taste oder Pausenmenü (siehe „Gerät“). In der Story oder im Hub: Aktion „📱 Gerät öffnen“, z. B. an einem Hub-Objekt (Hitbox) – optional direkt in einer App oder einem Chat. Eingebaute Apps öffnen ihren Bildschirm und kehren danach zum Gerät zurück.')),
      el('button', { class: 'btn tiny', onclick: () => { VN.ui.sysTab = 'chats'; VN.render(); } }, VN.t('Zu den Nachrichten →'))));
    const right = el('div', { class: 'dv-ed-side' }, el('div', { class: 'sec-title' }, VN.t('Vorschau (klickbar)')), preview(d),
      el('div', { class: 'muted small' }, VN.t('In der Vorschau sind alle Unterhaltungen schon angekommen. Eingebaute Apps und Aktionen laufen erst im Spiel.')));
    body.appendChild(el('div', { class: 'dv-ed-grid' }, left, right));
  };

  // Eigene App: Seite und Aktionen
  const appModal = (a) => modal('⭐ ' + (a.name || VN.t('Eigene App')), (card) => {
    card.append(
      el('div', { class: 'muted small' }, VN.t('Eine eigene App zeigt eine Seite (z. B. Notizen, eine E-Mail, eine Webseite, ein Foto) und/oder führt Aktionen aus. Mit „➜ Zu Szene oder Hub wechseln“ schließt sich das Gerät und die Szene startet.')),
      row('Titel der Seite', txt(a.title, (v) => { a.title = v; }, null, { width: '260px' })),
      el('label', { class: 'field' }, el('span', null, VN.t('Text')), el('textarea', { class: 'dv-ta', rows: 6, style: { width: '100%' }, onchange: (e) => VN.mutate(() => { a.text = e.target.value; }) }, a.text || '')),
      row('Bild', sel(a.pic, imgOpts(), (v) => { a.pic = v; }), thumb(a.pic)),
      VN.actionEditor(a.actions, VN.t('Beim Öffnen ausführen')));
  });

  // ---------- Reiter „Nachrichten“ ----------
  S.chatsTab = (body) => {
    const C = DV().chats();
    const p = VN.project;
    body.appendChild(el('p', { class: 'muted' }, VN.t('Chats bleiben über alle Szenen erhalten. Eine Unterhaltung kommt automatisch an (sobald ihre Bedingungen stimmen) oder per Aktion „💬 Nachricht schicken“. Zeilen mit 🔒 kommen nur, wenn ihre Bedingungen erfüllt sind – so bekommt jede Route ihre eigene Version. Antworten wählt der Spieler; sie können Aktionen ausführen und zur nächsten Unterhaltung führen.')));
    if (!DV().list().some((d) => d.apps.some((a) => a.type === 'messages'))) body.appendChild(el('div', { class: 'cond-warn' }, '⚠ ' + VN.t('Kein Gerät hat die App „Nachrichten“. Unter „Geräte“ hinzufügen.')));
    body.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Einstellungen')),
      el('div', { class: 'logic-row' }, chk(C.notify !== false, 'Meldung bei neuer Nachricht (Klick öffnet den Chat)', (v) => { C.notify = v; })),
      row('Ton bei neuer Nachricht', sel(C.sound, [['', '— wie Beziehungs-Meldung —'], ...VN.assetsOf('audio').map((a) => [a.id, a.name])], (v) => { C.sound = v; })),
      el('div', { class: 'muted small' }, VN.t('Chat-Zeilen in der Timeline (Dialog „Als Handy-Nachricht zeigen“) landen ebenfalls im Verlauf, wenn der Sprecher ein Kontakt ist – und ältere Nachrichten erscheinen dort darüber.'))));
    // Kontakte
    const rel = VN.Life && VN.Life.relOn() ? (p.relations.chars || []) : [];
    const ct = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Kontakte')));
    C.contacts.forEach((c) => {
      ct.appendChild(el('div', { class: 'logic-row' },
        DV().avatar(c, 'sm'),
        txt(c.name, (v) => { c.name = v; }, 'Name', { width: '130px' }),
        rel.length ? sel(c.char, [['', '— keine Figur —'], ...rel.map((r) => [r.id, '♥ ' + r.name])], (v) => { c.char = v; if (v && !c.name) c.name = (rel.find((r) => r.id === v) || {}).name || ''; }) : null,
        sel(c.avatar, imgOpts(c.char ? '— Porträt der Figur —' : '— Anfangsbuchstabe —'), (v) => { c.avatar = v; }, { width: '120px' }),
        col(c.color || '#3d8bfd', (v) => { c.color = v; }),
        txt(c.status, (v) => { c.status = v; }, 'Status (z. B. online)', { width: '120px' }),
        el('span', { class: 'muted small' }, VN.tf('{n} Unterhaltungen', { n: C.threads.filter((t) => t.contact === c.id).length })),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn tiny danger', onclick: () => { if (confirm(VN.tf('Kontakt „{n}“ löschen?', { n: c.name }))) VN.mutate(() => { C.contacts = C.contacts.filter((x) => x !== c); }); } }, '×')));
    });
    ct.appendChild(el('div', { class: 'row gap8' }, el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { C.contacts.push(DV().newContact()); }) }, '+ ' + VN.t('Kontakt')),
      rel.filter((r) => !C.contacts.some((c) => c.char === r.id)).length ? el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { for (const r of rel) if (!C.contacts.some((c) => c.char === r.id)) C.contacts.push(Object.assign(DV().newContact(), { name: r.name, char: r.id, color: r.color || '#3d8bfd' })); }) }, VN.t('Alle Beziehungs-Figuren als Kontakte')) : null));
    body.appendChild(ct);
    if (!C.contacts.length) return;
    // Unterhaltungen
    const filter = C.contacts.some((c) => c.id === VN.ui.chatCt) ? VN.ui.chatCt : '';
    body.appendChild(el('div', { class: 'row gap8', style: { flexWrap: 'wrap', margin: '6px 0 10px' } },
      el('strong', null, VN.t('Unterhaltungen')),
      el('button', { class: 'dv-pill' + (!filter ? ' on' : ''), onclick: () => { VN.ui.chatCt = ''; VN.render(); } }, VN.t('Alle')),
      ...C.contacts.map((c) => el('button', { class: 'dv-pill' + (filter === c.id ? ' on' : ''), onclick: () => { VN.ui.chatCt = c.id; VN.render(); } }, c.name || '?'))));
    const ths = C.threads.filter((t) => !filter || t.contact === filter);
    for (const t of ths) body.appendChild(threadCard(t));
    body.appendChild(el('button', { class: 'btn', onclick: () => VN.mutate(() => { C.threads.push(DV().newThread(filter || C.contacts[0].id)); }) }, '+ ' + VN.t('Unterhaltung')));
  };

  const threadCard = (t) => {
    const C = DV().chats();
    const c = DV().contact(t.contact);
    const nm = c ? c.name : '?';
    const card = el('div', { class: 'opt-card dv-th' });
    const sent = [];
    if (t.auto) sent.push(VN.t('automatisch'));
    if (C.threads.some((x) => (x.replies || []).some((r) => r.next === t.id))) sent.push(VN.t('nach einer Antwort'));
    card.appendChild(el('div', { class: 'logic-row' },
      txt(t.name, (v) => { t.name = v || VN.t('Unterhaltung'); }, null, { width: '170px', fontWeight: '600' }),
      sel(t.contact, [['', '— Kontakt —'], ...C.contacts.map((x) => [x.id, x.name])], (v) => { t.contact = v; }),
      chk(t.auto, 'automatisch zustellen', (v) => { t.auto = v; }),
      el('span', { title: VN.t('Keine Meldung und keine Ungelesen-Zahl – der Spieler findet die Nachricht nur, wenn er selbst nachsieht (z. B. versteckte Mails auf einem PC).') }, chk(t.silent, 'still (versteckt)', (v) => { t.silent = v; })),
      condBtn(t.conds, 'Unterhaltung nur zustellen, wenn …', '🔒 ' + VN.t('Nur wenn')),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn tiny', title: VN.t('Vorschau'), onclick: () => playThread(t) }, '▶ ' + VN.t('Vorschau')),
      el('button', { class: 'btn tiny', title: VN.t('Duplizieren'), onclick: () => VN.mutate(() => { const n = JSON.parse(JSON.stringify(t)); n.id = VN.uid('th'); n.name = t.name + ' 2'; for (const m of n.msgs) m.id = VN.uid('cm'); for (const r of n.replies) r.id = VN.uid('cr'); C.threads.splice(C.threads.indexOf(t) + 1, 0, n); }) }, '⧉'),
      el('button', { class: 'btn tiny danger', onclick: () => { if (confirm(VN.tf('Unterhaltung „{n}“ löschen?', { n: t.name }))) VN.mutate(() => { C.threads = C.threads.filter((x) => x !== t); }); } }, '×')));
    // Auf welchem Gerät? (0.9.3) Kein Häkchen = auf allen
    const devs = DV().list();
    if (devs.length > 1) {
      t.devs = t.devs || [];
      const all = !DV().devsOf(t).length;
      card.appendChild(el('div', { class: 'logic-row' },
        el('span', { class: 'muted small' }, VN.t('Erscheint auf')),
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: all, onchange: (e) => VN.mutate(() => { if (e.target.checked) t.devs = []; else t.devs = [devs[0].id]; }) }), VN.t('allen Geräten')),
        ...devs.map((d) => el('label', { class: 'check' + (all ? ' muted' : '') }, el('input', { type: 'checkbox', checked: !all && t.devs.includes(d.id), onchange: (e) => VN.mutate(() => {
          const cur = DV().devsOf(t).length ? DV().devsOf(t) : [];
          t.devs = e.target.checked ? [...new Set([...cur, d.id])] : cur.filter((x) => x !== d.id);
        }) }), (d.kind === 'desktop' ? '💻 ' : '📱 ') + d.name))));
    }
    card.appendChild(el('div', { class: 'muted small' }, VN.t('Verschickt: ') + (sent.length ? sent.join(', ') : VN.t('per Aktion „💬 Nachricht schicken“')) + ' · ID ' + t.id));
    // Nachrichten
    t.msgs.forEach((m, i) => {
      card.appendChild(el('div', { class: 'logic-row dv-msgrow' + (m.from === 'me' ? ' me' : '') },
        el('button', { class: 'btn tiny', style: { width: '90px' }, title: VN.t('Wer schreibt? (umschalten)'), onclick: () => VN.mutate(() => { m.from = m.from === 'me' ? 'them' : 'me'; }) }, m.from === 'me' ? VN.t('Ich') : nm),
        el('textarea', { rows: 1, onchange: (e) => VN.mutate(() => { m.text = e.target.value; }) }, m.text || ''),
        sel(m.image, imgOpts('— Bild —'), (v) => { m.image = v; }, { width: '90px' }),
        condBtn(m.conds, 'Zeile nur, wenn … (z. B. Route)'),
        el('button', { class: 'btn tiny', disabled: i === 0, onclick: () => VN.mutate(() => { t.msgs.splice(i, 1); t.msgs.splice(i - 1, 0, m); }) }, '↑'),
        el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { t.msgs.splice(i, 1); }) }, '×')));
    });
    card.appendChild(el('div', { class: 'row gap8' },
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { t.msgs.push({ id: VN.uid('cm'), from: 'them', text: '', image: '', conds: [] }); }) }, '+ ' + VN.tf('Nachricht von {n}', { n: nm })),
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { t.msgs.push({ id: VN.uid('cm'), from: 'me', text: '', image: '', conds: [] }); }) }, '+ ' + VN.t('Nachricht von mir'))));
    // Antworten
    card.appendChild(el('div', { class: 'sec-title', style: { marginTop: '8px' } }, VN.t('Antworten des Spielers')));
    if (!t.replies.length) card.appendChild(el('div', { class: 'muted small' }, VN.t('Keine – die Unterhaltung endet ohne Antwort.')));
    t.replies.forEach((r, i) => {
      card.appendChild(el('div', { class: 'logic-row' },
        el('span', null, '↩'),
        txt(r.text, (v) => { r.text = v; }, 'Antwort-Text', { flex: '1', minWidth: '160px' }),
        condBtn(r.conds, 'Antwort nur anbieten, wenn …'),
        actBtn(r.actions, 'Bei dieser Antwort ausführen'),
        el('span', { class: 'muted small' }, VN.t('danach')),
        sel(r.next, [['', '— nichts —'], ...C.threads.filter((x) => x !== t).map((x) => [x.id, (DV().contact(x.contact) ? DV().contact(x.contact).name + ': ' : '') + x.name])], (v) => { r.next = v; }, { width: '150px' }),
        el('button', { class: 'btn tiny', title: VN.t('Neue Unterhaltung als Antwort darauf'), onclick: () => VN.mutate(() => { const n = DV().newThread(t.contact); n.name = t.name + ' → ' + (r.text || '').slice(0, 18); n.msgs[0].text = ''; C.threads.splice(C.threads.indexOf(t) + 1, 0, n); r.next = n.id; }) }, '+ ➜'),
        el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { t.replies.splice(i, 1); }) }, '×')));
    });
    card.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { t.replies.push({ id: VN.uid('cr'), text: '', conds: [], actions: [], next: '' }); }) }, '+ ' + VN.t('Antwort')));
    return card;
  };

  // Unterhaltung im Probe-Handy abspielen (Antworten gehen, Aktionen laufen erst im Spiel)
  const playThread = (t) => {
    const msgDev = (x) => x.apps.some((a) => a.type === 'messages') && DV().onDev(t, x);
    const d = DV().list().find((x) => x.kind === 'phone' && msgDev(x)) || DV().list().find(msgDev) || DV().newDevice('phone');
    const rs = VN.newRunState();
    DV().deliver(rs, t.id, true);
    const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) back.remove(); } });
    const box = el('div', { class: 'modal', style: { width: '900px', maxWidth: '92vw' } },
      el('div', { class: 'row gap8' }, el('strong', { style: { flex: '1' } }, '▶ ' + t.name), el('button', { class: 'btn', onclick: () => back.remove() }, VN.t('Schließen'))),
      el('div', { class: 'muted small' }, VN.t('Zeilen mit Bedingungen erscheinen hier nur, wenn sie bei einem neuen Spielstand erfüllt wären.')));
    const host = el('div', { class: 'dv-prev', style: { marginTop: '8px' } });
    box.appendChild(host);
    back.appendChild(box);
    document.body.appendChild(back);
    const ap = d.apps.find((a) => a.type === 'messages');
    requestAnimationFrame(() => DV().open(host, { dev: d, rs, preview: true, app: ap && ap.id, contact: t.contact, H: { onClose: () => back.remove() } }));
  };

  // ---------- Hinweise und Übersicht ----------
  if (window.Help) Help.sources.push(() => DV().issues().map((x) => Object.assign({ level: 'warn', area: 'Geräte', topic: 'system', go: () => { VN.ui.view = 'systems'; VN.ui.sysTab = 'devices'; VN.render(); } }, x)));
  if (VN.Life) {
    const base = VN.Life.extraSwitches;
    VN.Life.extraSwitches = (card, set) => {
      const out = base ? base(card, set) : [];
      out.push(card('📱', VN.t('Geräte & Nachrichten'), VN.t('Handy oder Computer im Spiel mit Apps (Nachrichten, Inventar, Galerie …). Chats bleiben über Szenen erhalten, mit Routen-Varianten und Antworten zum Auswählen.'), DV().on(), set((v) => { DV().cfg().enabled = v; if (v && !DV().cfg().list.length) DV().cfg().list.push(DV().newDevice('phone')); }), 'devices'));
      return out;
    };
  }
})();
