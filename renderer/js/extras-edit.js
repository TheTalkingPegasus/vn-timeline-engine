// Editor für die Grundausstattung: Erfolge, Galerie, Werte, Gegenstände benutzen/kombinieren
(function () {
  const { el } = VN;
  const X = () => VN.Extras;
  const S = window.Systems;
  const txt = (v, fn, style, ph) => el('input', { type: 'text', value: v || '', placeholder: ph || '', style: style || null, onchange: (e) => VN.mutate(() => fn(e.target.value)) });
  const num = (v, fn, w) => el('input', { type: 'number', value: v != null ? v : 0, style: { width: w || '70px' }, onchange: (e) => VN.mutate(() => fn(Number(e.target.value))) });
  const chk = (v, fn) => el('input', { type: 'checkbox', checked: !!v, onchange: (e) => VN.mutate(() => fn(e.target.checked)) });
  const sel = (v, opts, fn, style) => {
    const s = el('select', { style: style || null, onchange: (e) => VN.mutate(() => fn(e.target.value)) });
    for (const [k, l] of opts) { const o = el('option', { value: k }, l); if (String(k) === String(v == null ? '' : v)) o.selected = true; s.appendChild(o); }
    return s;
  };
  const items = () => VN.project.items.map((i) => [i.id, i.name]);

  // ---------- Erfolge ----------
  S.achTab = (body) => {
    const p = VN.project;
    const list = X().achs();
    const P = X().P();
    body.appendChild(el('p', { class: 'muted' }, 'Erfolge schalten sich frei, wenn ihre Bedingung erfüllt ist (z. B. „Szene ‚Gutes Ende‘ gesehen“), oder per Aktion „🏆 Erfolg freischalten“. Sie gelten für alle Spielstände. Spieler sehen sie im Hauptmenü (Knopf mit Aktion „Erfolge“) und im Pausenmenü.'));
    const sel1 = list.find((a) => a.id === VN.ui.achSel) || list[0];
    const wrap = el('div', { class: 'loot-wrap' });
    const left = el('div', { class: 'loot-list' });
    for (const a of list) left.appendChild(el('div', { class: 'list-item' + (a === sel1 ? ' active' : ''), onclick: () => { VN.ui.achSel = a.id; VN.render(); } },
      el('span', { class: 'dot', style: { background: P.ach[a.id] ? '#7fd09a' : '#e8c86a' } }), el('span', { class: 'name' }, (a.hidden ? '🔒 ' : '') + a.name),
      (a.conds || []).some((c) => VN.condProblem(c)) ? el('span', { class: 'badge', style: { background: '#ff7b72' } }, '!') : null));
    left.appendChild(el('button', { class: 'btn', style: { marginTop: '6px' }, onclick: () => VN.mutate(() => { const a = { id: VN.uid('ach'), name: VN.t('Neuer Erfolg'), desc: '', icon: null, hidden: false, conds: [] }; list.push(a); VN.ui.achSel = a.id; }) }, '+ Erfolg'));
    left.appendChild(el('button', { class: 'btn tiny', style: { marginTop: '10px' }, title: 'Nur für Tests im Editor: freigeschaltete Erfolge, Galerie und Wissen vergessen', onclick: () => { X().reset(); VN.toast('Test-Fortschritt zurückgesetzt'); VN.render(); } }, 'Test-Fortschritt zurücksetzen'));
    const ed = el('div', { class: 'loot-ed' });
    wrap.append(left, ed);
    body.appendChild(wrap);
    if (!sel1) { ed.appendChild(el('div', { class: 'hint-box' }, 'Lege links einen Erfolg an.')); return; }
    const a = sel1;
    ed.append(
      el('div', { class: 'row gap8' },
        el('div', { class: 'field', style: { flex: '1' } }, el('div', { class: 'lbl' }, 'Name'), txt(a.name, (v) => { a.name = v || 'Erfolg'; })),
        el('button', { class: 'btn danger', style: { alignSelf: 'flex-end' }, onclick: () => VN.mutate(() => { p.achievements = list.filter((x) => x !== a); VN.ui.achSel = null; }) }, 'Löschen')),
      el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Beschreibung'), txt(a.desc, (v) => { a.desc = v; }, null, 'z. B. „Alle drei Enden gesehen“')),
      el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Symbol (leer = Pokal)'), VN.assetSelect('image', a.icon, (v) => VN.mutate(() => { a.icon = v; }))),
      el('label', { class: 'check' }, chk(a.hidden, (v) => { a.hidden = v; }), 'Geheim: Name und Text erst nach dem Freischalten zeigen'),
      VN.condEditor(a.conds || (a.conds = []), 'Schaltet sich selbst frei, wenn'),
      el('div', { class: 'muted small' }, (a.conds || []).length ? 'Wird nach jeder Aktion und jedem Szenenwechsel geprüft.' : 'Ohne Bedingung: nur per Aktion „🏆 Erfolg freischalten“.'),
      el('div', { class: 'row gap8' }, el('button', { class: 'btn', onclick: () => { if (window.UiDesign) UiDesign.edit('ach'); } }, '🎨 Design der Einblendung')));
  };

  // ---------- Galerie ----------
  S.galleryTab = (body) => {
    const p = VN.project;
    body.appendChild(el('p', { class: 'muted' }, 'Haken setzen, was in die Galerie gehört. Bilder schalten sich frei, sobald sie im Spiel einmal zu sehen waren, Musik beim ersten Abspielen, Szenen beim ersten Besuch. Spieler öffnen die Galerie im Hauptmenü (Knopf mit Aktion „Galerie“) oder im Pausenmenü.'));
    const imgs = VN.assetsOf('image'), auds = VN.assetsOf('audio');
    const grid = el('div', { class: 'gal-ed-grid' });
    for (const a of imgs) grid.appendChild(el('label', { class: 'gal-ed' + (a.gallery ? ' on' : '') }, el('div', { class: 'thumb', style: { backgroundImage: `url("${VN.assetUrl(a.id)}")` } }),
      el('span', { class: 'row gap4' }, chk(a.gallery, (v) => { if (v) a.gallery = true; else delete a.gallery; }), el('span', { class: 'small' }, a.name))));
    body.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Bilder (CGs) · ' + imgs.filter((a) => a.gallery).length + ' gewählt'), imgs.length ? grid : el('div', { class: 'muted small' }, 'Noch keine Bilder im Projekt.')));
    const mus = el('div', { class: 'col gap4' });
    for (const a of auds) mus.appendChild(el('label', { class: 'check' }, chk(a.musicRoom, (v) => { if (v) a.musicRoom = true; else delete a.musicRoom; }), a.name));
    body.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Musikraum · ' + auds.filter((a) => a.musicRoom).length + ' gewählt'), auds.length ? mus : el('div', { class: 'muted small' }, 'Noch keine Audiodateien.')));
    const sc = el('div', { class: 'col gap4' });
    for (const s of p.scenes.filter((x) => x.type === 'story')) sc.appendChild(el('label', { class: 'check' }, chk(s.replay, (v) => { if (v) s.replay = true; else delete s.replay; }), s.name));
    body.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Szenen zum erneut Ansehen'), sc,
      el('div', { class: 'muted small' }, 'Eine Wiederholung spielt nur diese Szene und kehrt danach zur Galerie zurück. Spielstand und Werte bleiben unberührt.')));
  };

  // ---------- Werte (unter „Variablen“) ----------
  S.statsCard = () => {
    const p = VN.project;
    const nums = p.vars.filter((v) => v.type !== 'flag');
    const box = el('div', { class: 'opt-card', style: { marginTop: '14px' } }, el('div', { class: 'sec-title' }, 'Werte für Spieler (Stärke, Charme, Mut …)'),
      el('div', { class: 'muted small' }, 'Zahlen-Variablen mit Haken erscheinen im Bildschirm „Werte“ (Taste C, Pausenmenü) als Balken. Ändern und prüfen wie jede Variable. Mit „Figur“ ordnest du Werte einer Figur zu (leer = Spieler).'));
    if (!nums.length) { box.appendChild(el('div', { class: 'muted small' }, 'Lege oben zuerst eine Zahl an.')); return box; }
    box.appendChild(el('div', { class: 'stat-ed head' }, el('span', null, 'Zeigen'), el('span', null, 'Variable'), el('span', null, 'Höchstwert'), el('span', null, 'Figur'), el('span', null, 'Farbe'), el('span', null, 'Symbol'), el('span', null, 'Oben im Spiel')));
    for (const v of nums) box.appendChild(el('div', { class: 'stat-ed' + (v.stat ? '' : ' off') },
      chk(v.stat, (x) => { v.stat = x; if (x && v.max == null) v.max = 100; }),
      el('strong', null, v.name),
      num(v.max != null ? v.max : 100, (x) => { v.max = Math.max(1, x); }),
      txt(v.owner, (x) => { v.owner = x.trim(); }, { width: '110px' }, 'Spieler'),
      el('input', { type: 'color', value: v.color || '#e8a43a', onchange: (e) => VN.mutate(() => { v.color = e.target.value; }) }),
      VN.assetSelect('image', v.icon, (x) => VN.mutate(() => { v.icon = x; })),
      chk(v.hud, (x) => { v.hud = x; })));
    return box;
  };

  // ---------- Gegenstände: Benutzen und Kombinieren ----------
  S.useModal = (it) => {
    it.use = it.use || { actions: [], consume: true, text: '' };
    const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) close(); } });
    const close = () => { back.remove(); };
    const card = el('div', { class: 'modal', style: { width: '620px', maxHeight: '80vh', overflow: 'auto' } });
    const redraw = () => {
      card.innerHTML = '';
      card.append(el('strong', null, 'Benutzen: ' + it.name),
        el('div', { class: 'muted small' }, 'Im Inventar erscheint „Benutzen“, sobald hier mindestens eine Aktion steht (z. B. Heiltrank: Leben + 20). Für „Schlüssel auf Tür“ stellst du das am Hub-Objekt ein (Abschnitt „Gegenstand benutzen“).'),
        VN.actionEditor(it.use.actions, 'Beim Benutzen'),
        el('label', { class: 'check' }, chk(it.use.consume !== false, (v) => { it.use.consume = v; }), 'Wird dabei verbraucht'),
        el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Meldung (optional)'), txt(it.use.text, (v) => { it.use.text = v; }, null, 'z. B. „Du fühlst dich gestärkt.“')),
        el('div', { class: 'row gap8', style: { justifyContent: 'flex-end' } }, el('button', { class: 'btn primary', onclick: close }, 'Fertig')));
    };
    back.appendChild(card);
    document.body.appendChild(back);
    redraw();
    // Nach Änderungen (VN.mutate → render) die Liste neu zeichnen
    const orig = VN.render;
    VN.render = function () { orig.apply(this, arguments); if (back.isConnected) redraw(); else VN.render = orig; };
  };
  S.combosCard = () => {
    const list = X().combos();
    const box = el('div', { class: 'opt-card', style: { marginTop: '14px' } }, el('div', { class: 'sec-title' }, 'Kombinieren (A + B → Ergebnis)'),
      el('div', { class: 'muted small' }, 'Im Inventar: Gegenstand wählen → „Kombinieren …“ → zweiten anklicken. Z. B. Seil + Haken → Enterhaken.'));
    for (const c of list) {
      const bad = !VN.project.items.some((i) => i.id === c.a) || !VN.project.items.some((i) => i.id === c.b) || (c.result && !VN.project.items.some((i) => i.id === c.result));
      box.appendChild(el('div', { class: 'logic-row' + (bad ? ' bad-row' : '') },
        sel(c.a, [['', '— A —'], ...items()], (v) => { c.a = v; }), el('span', null, '+'),
        sel(c.b, [['', '— B —'], ...items()], (v) => { c.b = v; }), el('span', null, '→'),
        sel(c.result, [['', '— nichts —'], ...items()], (v) => { c.result = v; }),
        num(c.count || 1, (v) => { c.count = Math.max(1, v); }, '54px'),
        sel(c.consume || 'both', [['both', 'beide verbraucht'], ['a', 'nur A verbraucht'], ['b', 'nur B verbraucht'], ['none', 'nichts verbraucht']], (v) => { c.consume = v; }),
        txt(c.text, (v) => { c.text = v; }, { flex: '1', minWidth: '120px' }, 'Meldung (optional)'),
        el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { VN.project.combos = list.filter((x) => x !== c); }) }, '×')));
    }
    box.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { list.push({ id: VN.uid('cb'), a: '', b: '', result: '', count: 1, consume: 'both', text: '' }); }) }, '+ Kombination'));
    return box;
  };

  // ---------- Hub-Objekt: Gegenstand darauf benutzen ----------
  VN.useOnEditor = (s, o) => {
    const box = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Gegenstand benutzen (z. B. Schlüssel auf Tür)'));
    box.appendChild(el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, 'Passender Gegenstand'),
      sel(o.useItem || '', [['', '— keiner —'], ...items()], (v) => { if (v) o.useItem = v; else delete o.useItem; })));
    if (o.useItem) {
      box.append(VN.actionEditor(o.useActions || (o.useActions = []), 'Dann ausführen'),
        el('label', { class: 'check' }, chk(o.useConsume !== false, (v) => { o.useConsume = v; }), 'Gegenstand wird verbraucht'),
        el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Meldung (optional)'), txt(o.useText, (v) => { o.useText = v; }, null, 'z. B. „Die Tür springt auf.“')),
        el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Danach zu Szene (optional)'), VN.sceneSelect(o.useTarget, (v) => VN.mutate(() => { o.useTarget = v; }), { exclude: s.id })),
        el('div', { class: 'muted small' }, 'Im Spiel: Inventar → Gegenstand → „Benutzen“ → auf das Objekt klicken. Falscher Gegenstand: „Das funktioniert hier nicht.“'));
    }
    return box;
  };
})();
