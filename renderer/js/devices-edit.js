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

  // ---------- Follower als Spielmechanik (0.9.24) ----------
  const folPanel = (c) => modal(VN.t('Follower als Spielmechanik') + ' · ' + (c.name || '?'), (card) => {
    c.folGrow = c.folGrow || [];
    const T = VN.project.time || {};
    card.appendChild(el('div', { class: 'muted small' }, VN.t('Follower können wachsen, Belohnung sein (Aktion „👥 Follower ändern“, z. B. als Quest- oder Minispiel-Belohnung) und Bedingung (z. B. ein Schwarm mag nur jemanden mit Reichweite).')));
    // Als Währung
    const curs = VN.project.currencies || [];
    card.appendChild(el('div', { class: 'sec-title' }, VN.t('Als Währung')));
    card.appendChild(el('div', { class: 'logic-row' }, sel(c.folCur || '', [['', '— keine (eigene Zahl) —'], ...curs.map((x) => [x.id, (x.icon ? x.icon + ' ' : '') + x.name])], (v) => {
      const cur = curs.find((x) => x.id === v);
      // Startwert übernehmen, damit nichts verloren geht
      if (cur && !c.folCur && c.followers && !Number(cur.start)) cur.start = c.followers;
      c.folCur = v;
    }, { width: '220px' }),
      curs.length ? null : el('span', { class: 'muted small' }, VN.t('Lege zuerst unter „Währungen“ eine Währung an (z. B. „Follower“).'))));
    card.appendChild(el('div', { class: 'muted small' }, VN.t('Mit Währung: Follower lassen sich ausgeben, im Idler erzeugen (Gebäude produziert Follower) und im HUD anzeigen. Idler und Social Media nutzen dieselbe Zahl.')));
    // Wachstum
    card.appendChild(el('div', { class: 'sec-title' }, VN.t('Wachstum über die Zeit')));
    if (!T.enabled) card.appendChild(el('div', { class: 'hint-box' }, VN.t('Wachstum läuft mit dem Kalender. Schalte unter „Lebenssimulation“ die Tageszeit ein – jeder neue Tag wendet die Regeln an.')));
    c.folGrow.forEach((g, i) => card.appendChild(el('div', { class: 'logic-row', style: { flexWrap: 'wrap' } },
      sel(g.when || 'day', [['day', 'jeden Tag'], ['week', 'jede Woche'], ['weekday', 'an einem Wochentag']], (v) => { g.when = v; }),
      g.when === 'weekday' ? sel(String(g.wd || 0), (T.days || []).map((d, j) => [String(j), d]), (v) => { g.wd = Number(v); }) : null,
      num(g.amount != null ? g.amount : 2, (v) => { g.amount = v; }, { width: '70px' }),
      sel(g.mode || 'pct', [['pct', '% (wächst mit)'], ['add', 'Anzahl']], (v) => { g.mode = v; }),
      condBtn(g.conds = g.conds || [], 'Nur wenn … (z. B. Variable „postet täglich“ an)', '🔒 ' + VN.t('Nur wenn')),
      el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { c.folGrow.splice(i, 1); }) }, '×'))));
    card.appendChild(el('div', { class: 'row gap8' },
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { c.folGrow.push({ when: 'day', mode: 'pct', amount: 2, conds: [] }); }) }, '+ ' + VN.t('Regel')),
      el('span', { class: 'muted small' }, VN.t('Negativ = Follower gehen verloren (z. B. −5 % pro Woche ohne Beiträge).'))));
  });

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
    if (DV().presetsUI) left.appendChild(DV().presetsUI(d));
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
        actBtn(m.actions || (m.actions = []), 'Beim Lesen dieser Nachricht ausführen (z. B. Ort freischalten)'),
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

  // ---------- Social Media (0.9.21) ----------
  S.socialTab = (body) => {
    const SO = VN.project.social;
    const C = DV().chats();
    // Erklärung für Neulinge über das Helfer-System (💡 öffnet Schritt-für-Schritt-Anleitung, „Nicht mehr zeigen“ blendet aus)
    if (window.Help && !Help.hidden('tip:social')) body.appendChild(Help.box({ level: 'tip', key: 'tip:social', topic: 'social',
      text: VN.t('Neu hier? Social Media in 4 Schritten'),
      detail: VN.t('1. Unter „Nachrichten“ Kontakte anlegen (die Autoren). 2. Die App einem Handy oder Computer geben. 3. Hier Beiträge schreiben. 4. Festlegen, wann sie erscheinen. Im Text werden @Name und #Thema automatisch zu Links. Mehr mit 💡.') }));
    body.appendChild(el('p', { class: 'muted' }, VN.t('Ein Social Media im Spiel: Kontakte posten Beiträge mit Text und Bild, andere Figuren liken und kommentieren. Ein Beitrag erscheint automatisch, sobald seine Bedingungen stimmen, oder nur per Aktion „📸 Beitrag posten“ (z. B. nach einer Entscheidung, an einem Ort oder nach einem Minispiel). Der Spieler kann liken und mit vorbereiteten Antworten kommentieren.')));
    const devs = DV().list();
    const without = devs.filter((d) => !d.apps.some((a) => a.type === 'social'));
    if (without.length) body.appendChild(el('div', { class: devs.length === without.length ? 'cond-warn' : 'hint-box' }, (devs.length === without.length ? '⚠ ' + VN.t('Noch kein Gerät hat die App „Social Media“.') : VN.t('App „Social Media“ auch auf:')),
      ...without.map((d) => el('button', { class: 'btn tiny', style: { marginLeft: '8px' }, onclick: () => VN.mutate(() => { d.apps.push(DV().fixApp({ id: VN.uid('app'), type: 'social' })); }) }, (d.kind === 'desktop' ? '💻 ' : '📱 ') + VN.tf('Zu „{n}“ hinzufügen', { n: d.name })))));
    body.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Einstellungen')),
      row('Name der App im Spiel', txt(SO.name, (v) => { SO.name = v || 'Pixgram'; }, 'Pixgram', { width: '180px' })),
      el('div', { class: 'logic-row' }, chk(SO.notify !== false, 'Meldung bei neuem Beitrag (Klick öffnet die App)', (v) => { SO.notify = v; }))));
    // Aussehen der Seite
    const SL = SO.look;
    const fontOpts = (none) => (window.Theme ? Theme.fontOptions(none) : [['', none]]);
    const look = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Aussehen der Seite')),
      el('div', { class: 'logic-row' }, chk(SL.custom, 'Eigenes Design (sonst wie das Gerät)', (v) => { SL.custom = v; })));
    if (SL.custom) {
      look.append(
        el('div', { class: 'logic-row', style: { flexWrap: 'wrap' } },
          ...[['bg', 'Hintergrund'], ['head', 'Kopfzeile'], ['card', 'Beiträge'], ['text', 'Text'], ['muted', 'Nebentext'], ['accent', 'Akzent'], ['like', 'Herz']].map(([k, l]) => el('label', { class: 'check' }, col(SL[k], (v) => { SL[k] = v; }), VN.t(l)))),
        row('Logo (statt Name)', thumb(SL.logo), sel(SL.logo, imgOpts('— Name als Text —'), (v) => { SL.logo = v; }, { width: '160px' })),
        row('Bild Kopfzeile', thumb(SL.headImg), sel(SL.headImg, imgOpts('— Farbe —'), (v) => { SL.headImg = v; }, { width: '160px' })),
        row('Bild Hintergrund', thumb(SL.bgImg), sel(SL.bgImg, imgOpts('— Farbe —'), (v) => { SL.bgImg = v; }, { width: '160px' })),
        row('Schrift', sel(SL.font || '', fontOpts('— wie das Gerät —'), (v) => { SL.font = v; })),
        row('Schrift des Namens', sel(SL.logoFont || '', fontOpts('— wie oben —'), (v) => { SL.logoFont = v; })),
        row('Ecken-Rundung', num(SL.radius, (v) => { SL.radius = Math.max(0, Math.min(40, Math.round(v))); })),
        el('div', { class: 'row gap8' }, ...[['Dunkel', { bg: '#0f1320', head: '#151a27', card: '#1b2232', text: '#f2f4f8', muted: '#9aa3b5', accent: '#e1306c', like: '#ff3b6b' }], ['Hell', { bg: '#f4f5f8', head: '#ffffff', card: '#ffffff', text: '#1c1e24', muted: '#6b7080', accent: '#3d6fd8', like: '#ff3b6b' }], ['Retro', { bg: '#20140c', head: '#3a2414', card: '#2e1d10', text: '#f5e6c8', muted: '#c7a77a', accent: '#e8a43a', like: '#e8573a' }], ['Neon', { bg: '#0b0716', head: '#140c26', card: '#1a1030', text: '#f0e8ff', muted: '#a492d0', accent: '#18e0d0', like: '#ff2fd0' }]].map(([n, v]) => el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { Object.assign(SL, v); }) }, VN.t(n)))));
    }
    body.appendChild(look);
    if (!C.contacts.length) { body.appendChild(el('div', { class: 'hint-box' }, VN.t('Beiträge schreiben Kontakte. Lege zuerst unter „Nachrichten“ Kontakte an (z. B. aus deinen Figuren).'))); return; }
    // Profile
    const pr = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Profile')));
    for (const c of C.contacts) pr.appendChild(el('div', { class: 'logic-row' }, DV().avatar(c, 'sm'), el('strong', { style: { width: '120px' } }, c.name || '?'),
      txt(c.bio, (v) => { c.bio = v; }, 'Profiltext (z. B. „Diebin. Katzen. Chaos.“)', { flex: '1', minWidth: '180px' }),
      el('span', { class: 'muted small', title: VN.t('Startwert – im Spiel ändern Aktionen „👥 Follower ändern“ die Zahl (z. B. nach einer Entscheidung oder einem Ereignis)') }, VN.t('Follower')),
      DV().folCur(c) ? el('span', { class: 'chip', title: VN.t('Die Follower sind der Kontostand dieser Währung – Startwert und Höchstwert stellst du bei der Währung ein.') }, '💰 ' + DV().folCur(c).name) : num(c.followers || 0, (v) => { c.followers = Math.max(0, Math.round(v)); }, { width: '80px' }),
      el('button', { class: 'btn tiny' + ((c.folGrow || []).length || c.folCur ? ' primary' : ''), title: VN.t('Follower als Spielmechanik: Wachstum pro Tag/Woche, als Währung nutzen'), onclick: () => folPanel(c) }, '📈 ' + ((c.folGrow || []).length ? VN.tf('{n} Regeln', { n: c.folGrow.length }) : VN.t('Mechanik')))));
    body.appendChild(pr);
    // Beiträge
    const cOpts = (none) => [['', none || '— Kontakt —'], ...C.contacts.map((x) => [x.id, x.name])];
    body.appendChild(el('div', { class: 'row gap8', style: { margin: '6px 0 10px' } }, el('strong', null, VN.t('Beiträge')), el('span', { class: 'muted small' }, VN.t('Im Feed steht das zuletzt Erschienene oben.')),
      el('div', { class: 'spacer' }), el('button', { class: 'btn tiny', onclick: () => previewSocial() }, '▶ ' + VN.t('Vorschau'))));
    SO.posts.forEach((s, i) => {
      const card = el('div', { class: 'opt-card dv-th' });
      card.appendChild(el('div', { class: 'logic-row' },
        DV().avatar(DV().contact(s.author), 'sm'),
        sel(s.author, cOpts(), (v) => { s.author = v; }, { width: '140px' }),
        sel(s.mode, [['auto', 'erscheint automatisch (Bedingungen)'], ['action', 'nur per Aktion „Beitrag posten“']], (v) => { s.mode = v; }),
        s.mode !== 'action' ? condBtn(s.conds, 'Beitrag erscheint, sobald …', '🔒 ' + VN.t('Nur wenn')) : null,
        el('div', { class: 'spacer' }),
        el('span', { class: 'muted small' }, 'ID ' + s.id),
        el('button', { class: 'btn tiny', disabled: i === 0, onclick: () => VN.mutate(() => { SO.posts.splice(i, 1); SO.posts.splice(i - 1, 0, s); }) }, '↑'),
        el('button', { class: 'btn tiny', title: VN.t('Duplizieren'), onclick: () => VN.mutate(() => { const n = JSON.parse(JSON.stringify(s)); n.id = VN.uid('sp'); for (const c of n.comments) c.id = VN.uid('sc'); for (const r of n.replies) r.id = VN.uid('sr'); SO.posts.splice(i + 1, 0, n); }) }, '⧉'),
        el('button', { class: 'btn tiny danger', onclick: () => { if (confirm(VN.t('Beitrag löschen?'))) VN.mutate(() => { SO.posts.splice(i, 1); }); } }, '×')));
      card.appendChild(el('div', { class: 'logic-row' },
        el('textarea', { rows: 2, class: 'dv-ta', style: { flex: '1', minWidth: '220px' }, placeholder: VN.t('Text des Beitrags'), onchange: (e) => VN.mutate(() => { s.text = e.target.value; }) }, s.text || ''),
        thumb(s.image), sel(s.image, imgOpts('— Bild —'), (v) => { s.image = v; }, { width: '120px' })));
      card.appendChild(el('div', { class: 'logic-row' },
        el('span', { class: 'muted small' }, '♥'), num(s.likes || 0, (v) => { s.likes = Math.max(0, Math.round(v)); }),
        txt(s.when, (v) => { s.when = v; }, 'Zeit (leer = automatisch, z. B. „vor 2 Std.“)', { width: '200px' }),
        actBtn(s.likeActions, 'Wenn der Spieler den Beitrag liked (einmal), ausführen – z. B. Beziehung +2'),
        el('span', { class: 'muted small' }, s.likeActions.length ? VN.t('Aktion beim Like') : '')));
      // Kommentare anderer Figuren
      card.appendChild(el('div', { class: 'sec-title', style: { marginTop: '6px' } }, VN.t('Kommentare')));
      s.comments.forEach((c, j) => card.appendChild(el('div', { class: 'logic-row' }, el('span', null, '💬'),
        sel(c.author, cOpts(), (v) => { c.author = v; }, { width: '130px' }),
        txt(c.text, (v) => { c.text = v; }, 'Kommentar', { flex: '1', minWidth: '160px' }),
        condBtn(c.conds, 'Kommentar nur zeigen, wenn …'),
        el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { s.comments.splice(j, 1); }) }, '×'))));
      // Antworten des Spielers
      card.appendChild(el('div', { class: 'sec-title', style: { marginTop: '6px' } }, VN.t('Kommentare des Spielers (zur Auswahl)')));
      s.replies.forEach((r, j) => card.appendChild(el('div', { class: 'logic-row' }, el('span', null, '↩'),
        txt(r.text, (v) => { r.text = v; }, 'Kommentar-Text', { flex: '1', minWidth: '160px' }),
        condBtn(r.conds, 'Nur anbieten, wenn …'),
        actBtn(r.actions, 'Bei diesem Kommentar ausführen (z. B. Beziehung +/−)'),
        el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { s.replies.splice(j, 1); }) }, '×'))));
      card.appendChild(el('div', { class: 'row gap8' },
        el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { s.comments.push({ id: VN.uid('sc'), author: (C.contacts.find((x) => x.id !== s.author) || C.contacts[0]).id, text: '', conds: [] }); }) }, '+ ' + VN.t('Kommentar')),
        el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { s.replies.push({ id: VN.uid('sr'), text: '', conds: [], actions: [] }); }) }, '+ ' + VN.t('Kommentar des Spielers'))));
      body.appendChild(card);
    });
    body.appendChild(el('button', { class: 'btn', onclick: () => VN.mutate(() => { SO.posts.push(DV().newPost(C.contacts[0].id)); }) }, '+ ' + VN.t('Beitrag')));
  };
  if (window.Help) Help.topic('social', {
    title: 'Social Media – so geht’s',
    what: 'Eine App für Handy oder Computer im Spiel, in der deine Figuren Beiträge posten – wie Instagram oder Twitter, nur mit deinen Figuren. Beiträge haben Text, Bild, Likes und Kommentare. Der Spieler kann liken, kommentieren und Profile ansehen.',
    whyTitle: 'Wofür ist das gut?',
    why: 'Die Spielwelt wirkt lebendig: Figuren reagieren auf das, was der Spieler tut. Ein Beitrag kann ein Hinweis sein, eine Belohnung, ein Stimmungsbild – oder ein Geheimnis, das später wieder gelöscht wird.',
    fixTitle: 'So legst du los',
    fix: ['Spielsysteme → Nachrichten: Kontakte anlegen (am besten aus deinen Figuren – dann stimmt das Profilbild).', 'Spielsysteme → Geräte: dem Handy oder Computer die App „Social Media“ geben (oder oben auf „Zu … hinzufügen“ klicken).', 'Hier unter „Beiträge“ auf „+ Beitrag“ klicken, Autor, Text und Bild wählen.', 'Entscheiden, wann er erscheint: „automatisch“ mit 🔒 Bedingung (z. B. ab Tag 3) oder „nur per Aktion“ – dann die Aktion „📸 Beitrag posten“ an eine Auswahl, ein Hub-Objekt oder ein Minispiel hängen.', 'Mit „▶ Vorschau“ ansehen.'],
    examples: [
      { title: 'Beitrag nach einer Entscheidung', steps: ['Beitrag anlegen und auf „nur per Aktion“ stellen.', 'In der Szene die Antwort „Ray helfen“ anklicken.', 'Bei „Aktionen“ „📸 Beitrag posten“ wählen und den Beitrag aussuchen.'] },
      { title: 'Follower wachsen lassen', steps: ['Unter „Profile“ den Startwert eintragen (z. B. 120).', 'An eine Antwort oder ein Ereignis die Aktion „👥 Follower ändern“ hängen, z. B. +200 oder +50 %.', 'Mit der Bedingung „👥 Follower mindestens …“ etwas freischalten.'] },
      { title: 'Links im Text', steps: ['Im Text „@Ray“ schreiben – im Spiel öffnet ein Klick Rays Profil (auch Namen mit Leerzeichen wie „@Wache Bernd“).', '„#Gildenfest“ schreiben – ein Klick zeigt alle Beiträge mit diesem Hashtag.', 'Das klappt in Beiträgen, Kommentaren und Profiltexten.'] }],
    ideas: ['Ein Beitrag verschwindet nach einem Ereignis („🗑 Beitrag löschen“) – wer ihn vorher gesehen hat, weiß mehr.', 'Likes und Kommentare des Spielers geben Beziehungspunkte – oder kosten welche.', 'Mehrere Figuren posten nach einem großen Ereignis, jede aus ihrer Sicht.', 'Ein #Hashtag als Spur: Unter #Vermisst sammeln sich Hinweise.']
  });

  // ---------- Websites (0.9.22): Seiten frei gestalten wie im Menü-Designer ----------
  S.webTab = (body) => {
    const WB = VN.project.web;
    if (window.Help && !Help.hidden('tip:web')) body.appendChild(Help.box({ level: 'tip', key: 'tip:web', topic: 'web',
      text: VN.t('Neu hier? Eigene Websites in 4 Schritten'),
      detail: VN.t('1. „+ Website“ und eine Adresse wählen (z. B. gildenmarkt.ra). 2. Auf der Fläche Texte, Bilder, Knöpfe und Eingabefelder hinzufügen und mit der Maus verschieben. 3. Knöpfen einen Link auf eine andere Seite oder eine Aktion geben. 4. Dem Handy oder Computer die App „Browser“ geben. Mehr mit 💡.') }));
    const devs = DV().list();
    const without = devs.filter((d) => !d.apps.some((a) => a.type === 'web'));
    if (WB.sites.length && without.length) body.appendChild(el('div', { class: devs.length === without.length ? 'cond-warn' : 'hint-box' }, (devs.length === without.length ? '⚠ ' + VN.t('Noch kein Gerät hat die App „Browser“.') : VN.t('App „Browser“ auch auf:')),
      ...without.map((d) => el('button', { class: 'btn tiny', style: { marginLeft: '8px' }, onclick: () => VN.mutate(() => { d.apps.push(DV().fixApp({ id: VN.uid('app'), type: 'web' })); }) }, (d.kind === 'desktop' ? '💻 ' : '📱 ') + VN.tf('Zu „{n}“ hinzufügen', { n: d.name })))));
    // Websites
    const site = WB.sites.find((w) => w.id === VN.ui.webSite) || WB.sites[0];
    body.appendChild(el('div', { class: 'row gap8', style: { flexWrap: 'wrap', margin: '6px 0 10px' } }, el('strong', null, VN.t('Websites')),
      ...WB.sites.map((w) => el('button', { class: 'dv-pill' + (w === site ? ' on' : ''), onclick: () => { VN.ui.webSite = w.id; VN.ui.webPage = null; VN.ui.webEl = null; VN.render(); } }, (w.hidden ? '🔒 ' : '🌐 ') + (w.name || '?'))),
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const w = DV().newSite(); let n = 1; while (WB.sites.some((x) => x.domain === w.domain)) w.domain = 'meine-seite' + (++n) + '.de'; WB.sites.push(w); VN.ui.webSite = w.id; VN.ui.webPage = null; }) }, '+ ' + VN.t('Website'))));
    if (!site) { body.appendChild(el('div', { class: 'hint-box' }, VN.t('Noch keine Website. Mit „+ Website“ legst du die erste an.'))); return; }
    body.appendChild(el('div', { class: 'opt-card' },
      el('div', { class: 'logic-row' },
        txt(site.name, (v) => { site.name = v || VN.t('Website'); }, 'Name (für Lesezeichen)', { width: '180px', fontWeight: '600' }),
        el('span', { class: 'muted small' }, 'www.'), txt(site.domain, (v) => { site.domain = String(v || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '') || 'meine-seite.de'; }, 'adresse.de', { width: '170px' }),
        el('span', { title: VN.t('Erscheint nicht bei den Lesezeichen – man kommt nur über die Adresse, einen Link oder eine Suche hin.') }, chk(site.hidden, 'geheim (nur über Adresse)', (v) => { site.hidden = v; })),
        condBtn(site.conds, 'Website nur erreichbar, wenn …', '🔒 ' + VN.t('Nur wenn')),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn tiny danger', onclick: () => { if (confirm(VN.tf('Website „{n}“ löschen?', { n: site.name }))) VN.mutate(() => { WB.sites = WB.sites.filter((x) => x !== site); }); } }, '×'))));
    // Seiten
    const page = site.pages.find((g) => g.id === VN.ui.webPage) || site.pages[0];
    body.appendChild(el('div', { class: 'row gap8', style: { flexWrap: 'wrap', margin: '4px 0 8px' } }, el('span', { class: 'muted small' }, VN.t('Seiten')),
      ...site.pages.map((g) => el('button', { class: 'dv-pill' + (g === page ? ' on' : ''), onclick: () => { VN.ui.webPage = g.id; VN.ui.webEl = null; VN.render(); } }, '/' + (g.path || ''))),
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { let n = site.pages.length, path = 'seite' + n; while (site.pages.some((g) => g.path === path)) path = 'seite' + (++n); const g = DV().newPage(path); g.bg = page.bg; site.pages.push(g); VN.ui.webPage = g.id; }) }, '+ ' + VN.t('Seite')),
      DV().webTemplates ? el('button', { class: 'btn tiny', title: VN.t('Fertige Seiten-Layouts (Shop, Blog, Profil, Nachrichten, Gilde, Login)'), onclick: () => DV().webTemplates(site, page) }, '✨ ' + VN.t('Vorlagen')) : null));
    const addr = DV().addrOf(site, page);
    body.appendChild(el('div', { class: 'opt-card' },
      el('div', { class: 'logic-row' },
        el('span', { class: 'muted small' }, 'www.' + DV().addrOf(site, null) + '/'), txt(page.path, (v) => { const p2 = String(v || '').trim().toLowerCase().replace(/^\/+|\/+$/g, ''); if (!site.pages.some((g) => g !== page && g.path === p2)) page.path = p2; }, 'leer = Startseite', { width: '120px' }),
        el('span', { class: 'muted small' }, VN.t('Hintergrund')), col(page.bg || '#ffffff', (v) => { page.bg = v; }),
        thumb(page.bgImg), sel(page.bgImg, imgOpts('— kein Bild —'), (v) => { page.bgImg = v; }, { width: '130px' }),
        el('span', { class: 'muted small', title: VN.t('Höhe der Seite im Verhältnis zur Breite (100 = quadratisch). Größer = länger, im Spiel wird gescrollt.') }, VN.t('Länge')), num(page.height, (v) => { page.height = Math.max(30, Math.min(1000, Math.round(v))); }),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn tiny', onclick: () => previewWeb(addr) }, '▶ ' + VN.t('Vorschau')),
        site.pages.length > 1 ? el('button', { class: 'btn tiny danger', title: VN.t('Seite löschen'), onclick: () => { if (confirm(VN.t('Seite löschen?'))) VN.mutate(() => { site.pages = site.pages.filter((x) => x !== page); VN.ui.webPage = null; }); } }, '×') : null)));
    // Fläche
    const ADD = [['text', 'Text', { w: 60, h: 10, text: VN.t('Neuer Text'), size: 4 }], ['image', 'Bild', { w: 40, h: 30 }], ['button', 'Knopf', { w: 30, h: 8, text: VN.t('Weiter'), size: 3.6, color: '#ffffff', bg: '#2f7de1', align: 'center', radius: 10 }], ['box', 'Fläche', { w: 100, h: 14, x: 0, bg: '#2f7de1' }], ['input', 'Eingabefeld', { w: 60, h: 7, size: 3.4 }]];
    const H0 = Math.max(10, Number(page.height) || 140);
    const elSel = page.els.find((e) => e.id === VN.ui.webEl) || null;
    const canvas = el('div', { class: 'web-ed-page', style: { aspectRatio: '100 / ' + H0, backgroundColor: page.bg || '#fff', backgroundImage: page.bgImg && VN.assetUrl(page.bgImg) ? `url("${VN.assetUrl(page.bgImg)}")` : '' }, onmousedown: (e) => { if (e.target === canvas && VN.ui.webEl) { VN.ui.webEl = null; VN.render(); } } });
    for (const e of page.els) {
      const st = DV().elStyle(e, H0);
      // Bild + Filter (Weichzeichner, Schatten) in eine innere Fläche, damit Auswahl-Griffe scharf bleiben
      let fill = null;
      if (e.kind === 'image') {
        fill = el('div', { class: 'web-ed-imgfill', style: { backgroundImage: e.image && VN.assetUrl(e.image) ? `url("${VN.assetUrl(e.image)}")` : '', filter: st.filter || '', borderRadius: st.borderRadius || '' } });
        st.filter = '';
      }
      const n = el('div', { class: 'dv-web-el ' + ({ image: 'img', box: 'box', button: 'btn', input: 'input', text: 'text' }[e.kind] || 'text') + ' web-ed-el' + (e === elSel ? ' sel' : '') + (e.kind === 'image' && !e.image ? ' empty' : ''), style: st },
        e.kind === 'input' ? el('div', { class: 'dv-web-in' }, el('input', { disabled: true, placeholder: e.place || (e.mode === 'password' ? VN.t('Passwort') : VN.t('Suchen …')) }), el('button', null, '→')) : e.kind === 'image' ? (e.image ? fill : '🖼') : e.kind === 'box' ? null : (e.text || ''),
        (e.link || (e.actions || []).length) ? el('span', { class: 'web-ed-badge' }, e.link ? '🔗' : '⚡') : null,
        e === elSel ? el('span', { class: 'web-ed-rs' }) : null);
      n.addEventListener('mousedown', (ev) => {
        ev.stopPropagation(); ev.preventDefault();
        const rs = ev.target.classList.contains('web-ed-rs');
        const unit = canvas.getBoundingClientRect().width / 100;
        const o = { x: e.x, y: e.y, w: e.w, h: e.h };
        if (VN.ui.webEl !== e.id) { VN.ui.webEl = e.id; }
        // Einrasten: an Hilfslinien, Seitenrand und -mitte (Kanten und Mitte des Elements), Alt = frei
        const G = page.guides || { x: [], y: [] };
        const snapOn = VN.ui.webSnap !== false;
        const lx = [0, 50, 100, ...G.x], ly = [0, H0 / 2, H0, ...G.y];
        const near = (v, list) => { let best = null; for (const t of list) if (Math.abs(t - v) <= 1.5 && (best === null || Math.abs(t - v) < Math.abs(best - v))) best = t; return best; };
        const showHit = (ax, ay) => { canvas.querySelectorAll('.web-ed-hit').forEach((x) => x.remove()); if (ax != null) canvas.appendChild(el('div', { class: 'web-ed-hit v', style: { left: ax + '%' } })); if (ay != null) canvas.appendChild(el('div', { class: 'web-ed-hit h', style: { top: (ay / H0 * 100) + '%' } })); };
        VN.drag(ev, (dx, dy, mev) => {
          const free = !snapOn || (mev && mev.altKey);
          let hx = null, hy = null;
          if (rs) {
            e.w = Math.max(2, Math.round((o.w + dx / unit) * 2) / 2); e.h = Math.max(2, Math.round((o.h + dy / unit) * 2) / 2);
            if (!free) { const sx = near(e.x + e.w, lx); if (sx !== null) { e.w = Math.max(2, sx - e.x); hx = sx; } const sy = near(e.y + e.h, ly); if (sy !== null) { e.h = Math.max(2, sy - e.y); hy = sy; } }
          } else {
            e.x = Math.max(-e.w + 2, Math.min(98, Math.round((o.x + dx / unit) * 2) / 2)); e.y = Math.max(0, Math.min(H0 - 2, Math.round((o.y + dy / unit) * 2) / 2));
            if (!free) {
              for (const [off, k] of [[0, 'l'], [e.w / 2, 'c'], [e.w, 'r']]) { const t = near(e.x + off, lx); if (t !== null) { e.x = t - off; hx = t; break; } }
              for (const off of [0, e.h / 2, e.h]) { const t = near(e.y + off, ly); if (t !== null) { e.y = t - off; hy = t; break; } }
            }
          }
          showHit(hx, hy);
          n.style.left = e.x + '%'; n.style.top = (e.y / H0 * 100) + '%'; n.style.width = e.w + '%'; n.style.height = (e.h / H0 * 100) + '%';
        }, (dx, dy, moved) => {
          showHit(null, null);
          if (!moved) { VN.render(); return; }
          const now = { x: e.x, y: e.y, w: e.w, h: e.h }; Object.assign(e, o);
          VN.mutate(() => { Object.assign(e, now); });
        });
      });
      canvas.appendChild(n);
    }
    // Hilfslinien zeichnen (ziehen = verschieben, aus der Fläche ziehen = löschen)
    page.guides = page.guides || { x: [], y: [] };
    const drawGuide = (axis, i) => {
      const v = page.guides[axis][i];
      const g = el('div', { class: 'web-ed-guide ' + (axis === 'x' ? 'v' : 'h'), title: VN.t('Hilfslinie – ziehen zum Verschieben, aus der Fläche ziehen zum Löschen'), style: axis === 'x' ? { left: v + '%' } : { top: (v / H0 * 100) + '%' } });
      g.addEventListener('mousedown', (ev) => {
        ev.stopPropagation(); ev.preventDefault();
        const r = canvas.getBoundingClientRect(), unit = r.width / 100;
        VN.drag(ev, (dx, dy, mev) => {
          const val = axis === 'x' ? (mev.clientX - r.left) / unit : (mev.clientY - r.top) / unit;
          g.style[axis === 'x' ? 'left' : 'top'] = axis === 'x' ? val + '%' : (val / H0 * 100) + '%';
          g.classList.toggle('del', axis === 'x' ? val < -2 || val > 102 : val < -2 || val > H0 + 2);
        }, (dx, dy, moved, mev) => {
          if (!moved) return;
          const ex = mev || { clientX: 0, clientY: 0 };
          const val = Math.round((axis === 'x' ? (ex.clientX - r.left) / unit : (ex.clientY - r.top) / unit) * 2) / 2;
          VN.mutate(() => { const out = axis === 'x' ? val < -2 || val > 102 : val < -2 || val > H0 + 2; if (out) page.guides[axis].splice(i, 1); else page.guides[axis][i] = val; });
        });
      });
      canvas.appendChild(g);
    };
    if (VN.ui.webGuides !== false) { page.guides.x.forEach((_, i) => drawGuide('x', i)); page.guides.y.forEach((_, i) => drawGuide('y', i)); }
    // Lineale: oben und links, Klick oder Ziehen setzt eine Hilfslinie
    const ruler = (axis) => {
      const r = el('div', { class: 'web-ed-ruler ' + axis, title: VN.t('Klicken oder ziehen = Hilfslinie setzen') });
      const max = axis === 'x' ? 100 : H0;
      for (let v = 0; v <= max; v += 5) r.appendChild(el('span', { class: 'tick' + (v % 10 ? '' : ' big'), style: axis === 'x' ? { left: v + '%' } : { top: (v / max * 100) + '%' } }, v % 10 ? '' : String(v)));
      r.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        const cr = canvas.getBoundingClientRect(), unit = cr.width / 100;
        const at = (m) => Math.round((axis === 'x' ? (m.clientX - cr.left) / unit : (m.clientY - cr.top) / unit) * 2) / 2;
        const tmp = el('div', { class: 'web-ed-guide ' + (axis === 'x' ? 'v' : 'h') + ' new' });
        canvas.appendChild(tmp);
        const place = (m) => { const v = at(m); if (axis === 'x') tmp.style.left = v + '%'; else tmp.style.top = (v / H0 * 100) + '%'; };
        place(ev);
        VN.drag(ev, (dx, dy, m) => place(m), (dx, dy, moved, m) => {
          const v = at(m || ev); tmp.remove();
          if (v >= 0 && v <= max) VN.mutate(() => { page.guides[axis].push(v); VN.ui.webGuides = true; });
        });
      });
      return r;
    };
    const frameW = Math.max(300, Math.min(1400, Number(VN.ui.webEdW) || 420));
    const resizer = el('div', { class: 'web-ed-resize', title: VN.t('Ziehen = Arbeitsfläche größer oder kleiner') });
    resizer.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      const left = resizer.previousSibling, w0 = left.getBoundingClientRect().width;
      VN.drag(ev, (dx) => { left.style.maxWidth = left.style.width = Math.max(300, Math.min(1400, w0 + dx)) + 'px'; left.style.flex = 'none'; },
        (dx) => { VN.ui.webEdW = Math.max(300, Math.min(1400, Math.round(w0 + dx))); VN.render(); });
    });
    body.appendChild(el('div', { class: 'web-ed' },
      el('div', { class: 'web-ed-left', style: { width: frameW + 'px', maxWidth: frameW + 'px', flex: 'none' } },
        el('div', { class: 'row gap4', style: { flexWrap: 'wrap', marginBottom: '6px' } }, el('span', { class: 'muted small' }, '+'),
          ...ADD.map(([k, l, d]) => el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const e = DV().fixEl(Object.assign({ kind: k, x: 10, y: Math.min(H0 - 10, 10 + page.els.length * 4) }, JSON.parse(JSON.stringify(d)))); page.els.push(e); VN.ui.webEl = e.id; }) }, VN.t(l)))),
        el('div', { class: 'row gap8', style: { marginBottom: '4px', flexWrap: 'wrap' } },
          el('label', { class: 'check small' }, el('input', { type: 'checkbox', checked: VN.ui.webSnap !== false, onchange: (ev) => { VN.ui.webSnap = ev.target.checked; } }), VN.t('Einrasten')),
          el('label', { class: 'check small' }, el('input', { type: 'checkbox', checked: VN.ui.webGuides !== false, onchange: (ev) => { VN.ui.webGuides = ev.target.checked; VN.render(); } }), VN.t('Hilfslinien zeigen')),
          page.guides.x.length + page.guides.y.length ? el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { page.guides = { x: [], y: [] }; }) }, VN.t('Hilfslinien löschen')) : null,
          el('button', { class: 'btn tiny', title: VN.t('Hilfslinien für Ränder (5) und Mitte setzen'), onclick: () => VN.mutate(() => { page.guides.x = [...new Set([...page.guides.x, 5, 50, 95])]; }) }, VN.t('Ränder + Mitte'))),
        el('div', { class: 'web-ed-rulers' }, el('div', { class: 'web-ed-corner' }), ruler('x'), ruler('y'), el('div', { class: 'web-ed-frame' }, canvas)),
        el('div', { class: 'muted small', style: { marginTop: '4px' } }, VN.t('Ziehen = verschieben · Ecke unten rechts = Größe · Klick = bearbeiten · Lineal anklicken oder ziehen = Hilfslinie · Alt = ohne Einrasten'))),
      resizer,
      el('div', { class: 'web-ed-right' }, elSel ? elPanel(site, page, elSel) : el('div', { class: 'muted small' }, VN.t('Ein Element anklicken, um es zu bearbeiten.')))));
  };
  // Einstellungen des gewählten Elements
  const elPanel = (site, page, e) => {
    const box = el('div', { class: 'opt-card web-ed-props' });
    const allPages = [['', '— kein Link —'], ...VN.project.web.sites.flatMap((w) => w.pages.map((g) => [DV().addrOf(w, g), DV().addrOf(w, g)]))];
    const idx = page.els.indexOf(e);
    box.appendChild(el('div', { class: 'row gap4' }, el('strong', { style: { flex: '1' } }, VN.t({ text: 'Text', image: 'Bild', button: 'Knopf', box: 'Fläche', input: 'Eingabefeld' }[e.kind] || 'Element')),
      el('button', { class: 'btn tiny', title: VN.t('Nach vorne'), onclick: () => VN.mutate(() => { page.els.splice(idx, 1); page.els.push(e); }) }, '⬆'),
      el('button', { class: 'btn tiny', title: VN.t('Nach hinten'), onclick: () => VN.mutate(() => { page.els.splice(idx, 1); page.els.unshift(e); }) }, '⬇'),
      el('button', { class: 'btn tiny', title: VN.t('Duplizieren'), onclick: () => VN.mutate(() => { const n = JSON.parse(JSON.stringify(e)); n.id = VN.uid('we'); n.y += 4; page.els.push(n); VN.ui.webEl = n.id; }) }, '⧉'),
      el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { page.els.splice(idx, 1); VN.ui.webEl = null; }) }, '×')));
    if (e.kind === 'text' || e.kind === 'button') box.appendChild(el('textarea', { class: 'dv-ta', rows: 3, onchange: (ev) => VN.mutate(() => { e.text = ev.target.value; }) }, e.text || ''));
    if (e.kind === 'image') box.appendChild(row('Bild', thumb(e.image), sel(e.image, imgOpts('— Bild wählen —'), (v) => { e.image = v; }, { width: '140px' })));
    if (e.kind !== 'image') box.appendChild(el('div', { class: 'logic-row', style: { flexWrap: 'wrap' } },
      e.kind !== 'box' ? el('label', { class: 'check' }, col(e.color || '#1c1e24', (v) => { e.color = v; }), VN.t('Schrift')) : null,
      el('label', { class: 'check' }, col(e.bg || '#ffffff', (v) => { e.bg = v; }), VN.t('Fläche')),
      e.bg ? el('button', { class: 'btn tiny', title: VN.t('Keine Hintergrundfarbe'), onclick: () => VN.mutate(() => { e.bg = ''; }) }, '∅') : null,
      e.bg ? el('span', { class: 'muted small' }, VN.t('Deckkraft %')) : null,
      e.bg ? el('input', { type: 'range', min: 0, max: 100, value: e.alpha != null ? e.alpha : 100, style: { width: '90px' }, title: VN.t('0 = durchsichtig, 100 = voll'), onchange: (ev) => VN.mutate(() => { e.alpha = Number(ev.target.value); }) }) : null,
      e.bg ? el('span', { class: 'muted small' }, String(e.alpha != null ? e.alpha : 100)) : null));
    if (e.kind === 'text' || e.kind === 'button' || e.kind === 'input') box.appendChild(el('div', { class: 'logic-row', style: { flexWrap: 'wrap' } },
      el('span', { class: 'muted small' }, VN.t('Größe')), num(e.size, (v) => { e.size = Math.max(1, Math.min(30, v)); }, { width: '60px' }),
      chk(e.bold, 'fett', (v) => { e.bold = v; }),
      sel(e.align, [['left', 'links'], ['center', 'Mitte'], ['right', 'rechts']], (v) => { e.align = v; }),
      sel(e.font || '', window.Theme ? Theme.fontOptions('— Schrift —') : [['', '— Schrift —']], (v) => { e.font = v; }, { width: '120px' })));
    box.appendChild(el('div', { class: 'logic-row', style: { flexWrap: 'wrap' } },
      el('span', { class: 'muted small' }, VN.t('Ecken')), num(e.radius, (v) => { e.radius = Math.max(0, Math.min(100, Math.round(v))); }, { width: '60px' }),
      el('label', { class: 'check' }, col(e.border || '#888888', (v) => { e.border = v; }), VN.t('Rahmen')),
      e.border ? el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { e.border = ''; }) }, '∅') : null));
    box.appendChild(el('div', { class: 'logic-row', style: { flexWrap: 'wrap' } },
      el('span', { class: 'muted small' }, VN.t('Schlagschatten')),
      el('input', { type: 'range', min: 0, max: 20, value: Number(e.shadow) || 0, style: { width: '90px' }, title: VN.t('0 = kein Schatten'), onchange: (ev) => VN.mutate(() => { e.shadow = Number(ev.target.value); }) }),
      el('span', { class: 'muted small' }, String(Number(e.shadow) || 0)),
      Number(e.shadow) ? el('label', { class: 'check' }, col(e.shadowColor || '#000000', (v) => { e.shadowColor = v; }), VN.t('Farbe')) : null));
    if (e.grad) box.appendChild(el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, VN.t('Verlauf aus Vorlage')), el('span', { class: 'mini-thumb', style: { backgroundImage: e.grad } }), el('button', { class: 'btn tiny', title: VN.t('Verlauf entfernen – dann gilt die Farbe'), onclick: () => VN.mutate(() => { e.grad = ''; }) }, '×')));
    box.appendChild(row('Mischmodus', sel(e.blend || 'normal', DV().BLENDS, (v) => { e.blend = v; }, { width: '170px' })));
    e.blurConds = e.blurConds || [];
    box.appendChild(el('div', { class: 'logic-row', style: { flexWrap: 'wrap' } },
      el('span', { class: 'muted small' }, VN.t('Weichzeichnen')),
      el('input', { type: 'range', min: 0, max: 20, value: Number(e.blur) || 0, style: { width: '90px' }, title: VN.t('0 = scharf'), onchange: (ev) => VN.mutate(() => { e.blur = Number(ev.target.value); }) }),
      el('span', { class: 'muted small' }, String(Number(e.blur) || 0)),
      Number(e.blur) ? condBtn(e.blurConds, 'Scharf zeigen, sobald …', '🔓 ' + VN.t('Scharf wenn')) : null));
    if (Number(e.blur)) {
      box.appendChild(el('div', { class: 'muted small' }, e.blurConds.length ? VN.t('Bleibt verschwommen, bis die Bedingungen erfüllt sind – dann wird es sanft scharf.') : VN.t('Immer verschwommen. Mit „Scharf wenn“ wird es z. B. erst nach einem Kauf oder Passwort scharf.')));
      if (e.kind === 'image') box.appendChild(row('Hinweis darauf', txt(e.blurHint, (v) => { e.blurHint = v; }, 'z. B. 🔒 Nur für Mitglieder')));
    }
    if (e.kind !== 'input' && e.kind !== 'box') {
      box.appendChild(el('div', { class: 'sec-title', style: { marginTop: '6px' } }, VN.t('Beim Klick')));
      box.appendChild(row('Link zu Seite', sel(allPages.some((x) => x[0] === e.link) ? e.link : '', allPages, (v) => { e.link = v; }, { width: '170px' })));
      box.appendChild(row('oder Adresse', txt(e.link, (v) => { e.link = String(v || '').trim(); }, 'z. B. gildenmarkt.ra/shop', { width: '170px' })));
      box.appendChild(el('div', { class: 'logic-row' }, actBtn(e.actions, 'Beim Klick ausführen (z. B. Gegenstand kaufen, Szene starten)'), el('span', { class: 'muted small' }, e.actions.length ? VN.tf('{n} Aktionen', { n: e.actions.length }) : VN.t('Aktionen'))));
    }
    if (e.kind === 'input') {
      box.appendChild(row('Art', sel(e.mode, [['password', 'Passwort-Feld'], ['search', 'Suchfeld']], (v) => { e.mode = v; })));
      box.appendChild(row('Platzhalter', txt(e.place, (v) => { e.place = v; }, e.mode === 'password' ? 'Passwort' : 'Suchen …')));
      if (e.mode === 'password') {
        box.appendChild(row('Richtiges Passwort', txt(e.answer, (v) => { e.answer = v; }, 'z. B. katze123 oder ${variable}')));
        box.appendChild(row('Bei falschem', txt(e.fail, (v) => { e.fail = v; }, 'Falsches Passwort.')));
        box.appendChild(row('Richtig → Seite', sel(allPages.some((x) => x[0] === e.okLink) ? e.okLink : '', [['', '— hier bleiben —'], ...allPages.slice(1)], (v) => { e.okLink = v; }, { width: '170px' })));
        box.appendChild(el('div', { class: 'logic-row' }, actBtn(e.okActions, 'Bei richtigem Passwort ausführen'), el('span', { class: 'muted small' }, VN.t('Tipp: Andere Elemente mit 🔒 „Passwort eingegeben“ erst danach zeigen.'))));
      } else {
        box.appendChild(el('div', { class: 'muted small' }, VN.t('Suchbegriffe → Treffer. Mehrere Begriffe mit Komma trennen.')));
        e.results = e.results || [];
        e.results.forEach((r, j) => box.appendChild(el('div', { class: 'logic-row' },
          txt(r.word, (v) => { r.word = v; }, 'Begriffe', { width: '110px' }),
          sel(r.addr || '', allPages, (v) => { r.addr = v; }, { width: '130px' }),
          txt(r.label, (v) => { r.label = v; }, 'Titel', { width: '100px' }),
          el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { e.results.splice(j, 1); }) }, '×'))));
        box.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { e.results.push({ word: '', addr: '', label: '' }); }) }, '+ ' + VN.t('Treffer')));
      }
    }
    box.appendChild(el('div', { class: 'logic-row', style: { marginTop: '6px' } }, condBtn(e.conds, 'Element nur zeigen, wenn …', '🔒 ' + VN.t('Nur wenn')),
      el('span', { class: 'muted small' }, 'x ' + e.x + ' · y ' + e.y + ' · ' + e.w + '×' + e.h)));
    return box;
  };
  const previewWeb = (addr) => {
    const d = DV().list().find((x) => x.apps.some((a) => a.type === 'web')) || (() => { const n = DV().newDevice('desktop'); n.apps.push(DV().fixApp({ id: VN.uid('app'), type: 'web' })); return n; })();
    const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) back.remove(); } });
    const box = el('div', { class: 'modal', style: { width: '900px', maxWidth: '92vw' } },
      el('div', { class: 'row gap8' }, el('strong', { style: { flex: '1' } }, '▶ www.' + addr), el('button', { class: 'btn', onclick: () => back.remove() }, VN.t('Schließen'))),
      el('div', { class: 'muted small' }, VN.t('Links funktionieren in der Vorschau, Aktionen laufen erst im Spiel.')));
    const host = el('div', { class: 'dv-prev', style: { marginTop: '8px' } });
    box.appendChild(host); back.appendChild(box); document.body.appendChild(back);
    const ap = d.apps.find((a) => a.type === 'web');
    requestAnimationFrame(() => DV().open(host, { dev: d, rs: VN.newRunState(), preview: true, app: ap && ap.id, contact: addr, H: { onClose: () => back.remove() } }));
  };
  if (window.Help) Help.topic('web', {
    title: 'Websites – so geht’s',
    what: 'Eigene Webseiten für den Browser im Handy oder Computer des Spiels. Jede Website hat eine Adresse (z. B. www.gildenmarkt.ra) und beliebig viele Seiten. Auf jeder Seite platzierst du Texte, Bilder, Knöpfe, Flächen und Eingabefelder frei – wie im Menü-Designer.',
    whyTitle: 'Wofür ist das gut?',
    why: 'Recherche, Geheimnisse und Weltenbau: Der Spieler sucht Hinweise im Netz, knackt ein Passwort, kauft in einem Online-Shop ein oder liest Nachrichten über die Spielwelt.',
    fixTitle: 'So legst du los',
    fix: ['„+ Website“ klicken, Namen und Adresse eintragen.', 'Mit „+ Text“, „+ Bild“, „+ Knopf“ … Elemente hinzufügen und auf der Fläche verschieben, an der Ecke unten rechts die Größe ändern.', 'Rechts beim gewählten Element Farben, Schrift, Link oder Aktion einstellen.', 'Mit „+ Seite“ weitere Seiten anlegen und per Link verbinden.', 'Unter Geräte dem Handy oder Computer die App „Browser“ geben – oder oben auf „Zu … hinzufügen“ klicken.'],
    examples: [
      { title: 'Geheimes Postfach mit Passwort', steps: ['Website „mail.gilde.ra“ anlegen und auf „geheim“ stellen.', 'Ein Eingabefeld als Passwort-Feld, richtiges Passwort z. B. „katze123“.', 'Bei „Richtig → Seite“ die Seite mit den Mails wählen.'] },
      { title: 'Suchmaschine', steps: ['Website „sucher.ra“ mit einem Suchfeld.', 'Treffer anlegen: Begriffe „Ray, Diebin“ → Seite mit Rays Steckbrief.', 'Nur wer den Namen kennt, findet die Seite.'] },
      { title: 'Shop', steps: ['Seite mit Bildern der Waren.', 'Knopf „Kaufen“ mit den Aktionen „Geld −20“ und „Gegenstand geben“.', 'Mit 🔒 „Nur wenn“ den Knopf ausblenden, wenn schon gekauft.'] }],
    ideas: ['Eine Nachrichtenseite, deren Schlagzeilen sich mit der Story ändern (Elemente mit 🔒 Bedingung).', 'Im Social-Media-Profil steht eine Adresse – der Spieler tippt sie im Browser ein.', 'Eine Aktion „📱 Gerät öffnen“ springt direkt auf eine bestimmte Seite.']
  });

  // Vorschau: alle Beiträge im Probe-Handy
  const previewSocial = () => {
    const d = DV().list().find((x) => x.apps.some((a) => a.type === 'social')) || (() => { const n = DV().newDevice('phone'); n.apps.push(DV().fixApp({ id: VN.uid('app'), type: 'social' })); return n; })();
    const rs = VN.newRunState();
    for (const s of DV().posts()) DV().showPost(rs, s.id);
    const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) back.remove(); } });
    const box = el('div', { class: 'modal', style: { width: '900px', maxWidth: '92vw' } },
      el('div', { class: 'row gap8' }, el('strong', { style: { flex: '1' } }, '▶ ' + (VN.project.social.name || 'Pixgram')), el('button', { class: 'btn', onclick: () => back.remove() }, VN.t('Schließen'))),
      el('div', { class: 'muted small' }, VN.t('Vorschau mit allen Beiträgen – im Spiel erscheinen sie nach ihren Bedingungen oder Aktionen.')));
    const host = el('div', { class: 'dv-prev', style: { marginTop: '8px' } });
    box.appendChild(host); back.appendChild(box); document.body.appendChild(back);
    const ap = d.apps.find((a) => a.type === 'social');
    requestAnimationFrame(() => DV().open(host, { dev: d, rs, preview: true, app: ap && ap.id, H: { onClose: () => back.remove() } }));
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
