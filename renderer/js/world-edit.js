// Editor: Spielsysteme → Welt & Orte (Orte, Zuhause, Karten mit Pins, Ereignisse, Prüfung)
(function () {
  const { el } = VN;
  const W = () => VN.World;
  const S = window.Systems;
  const txt = (v, fn, style, ph) => el('input', { type: 'text', value: v || '', placeholder: ph || '', style: style || null, onchange: (e) => VN.mutate(() => fn(e.target.value)) });
  const num = (v, fn, w) => el('input', { type: 'number', value: v != null ? v : '', style: { width: w || '64px' }, onchange: (e) => VN.mutate(() => fn(e.target.value === '' ? null : Number(e.target.value))) });
  const chk = (v, fn) => el('input', { type: 'checkbox', checked: !!v, onchange: (e) => VN.mutate(() => fn(e.target.checked)) });
  const sel = (v, opts, fn, style) => {
    const s = el('select', { style: style || null, onchange: (e) => VN.mutate(() => fn(e.target.value)) });
    for (const [k, l] of opts) { const o = el('option', { value: k }, l); if (String(k) === String(v == null ? '' : v)) o.selected = true; s.appendChild(o); }
    return s;
  };
  const timeOn = () => VN.Life && VN.Life.timeOn();

  S.worldTab = (body) => {
    const p = VN.project, c = W().cfg();
    body.appendChild(el('p', { class: 'muted' }, 'Hub-Szenen werden zu Orten, zwischen denen man frei reisen kann – über die Weltkarte (Taste M) und den Knopf „🏠 Zuhause“ (Taste H). Story-Szenen werden zu Ereignissen: Sie starten, wenn man zur passenden Zeit an einen Ort kommt, und kehren danach dorthin zurück. Mit der Aktion „Freie Zeit beginnt / endet“ wechselst du zwischen freiem Herumlaufen und linearer Story.'));
    const iss = W().issues();
    if (iss.length) body.appendChild(el('div', { class: 'opt-card bad-card' }, el('div', { class: 'sec-title', style: { color: '#ffb3ad' } }, '⚠ ' + iss.length + (iss.length === 1 ? ' Problem' : ' Probleme')),
      ...iss.map((i) => el('div', { class: 'small', style: { color: '#ffb3ad' } }, '• ' + i.text))));

    // ---------- Einstellungen ----------
    const locOpts = [['', '— keins —'], ...W().locs().map((s) => [s.id, s.name])];
    body.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Grundeinstellungen'),
      el('div', { class: 'logic-row' }, el('span', null, '🏠 Zuhause'), sel(c.home, locOpts, (v) => { c.home = v; }),
        el('span', { class: 'muted small' }, 'Sobald freigeschaltet, gibt es im Spiel den Knopf „Zuhause“.')),
      timeOn() ? el('div', { class: 'logic-row' }, el('span', null, 'Reisen dauert'), num(c.travel, (v) => { c.travel = Math.max(0, v || 0); }), el('span', { class: 'muted small' }, 'Tageszeiten (an jedem Pin einzeln änderbar, 0 = sofort)')) : null,
      el('label', { class: 'check' }, chk(c.freeAtStart, (v) => { c.freeAtStart = v; }), 'Freie Zeit schon ab Spielbeginn (sonst erst per Aktion „Freie Zeit beginnt“)'),
      el('label', { class: 'check' }, chk(c.hudMap !== false, (v) => { c.hudMap = v; }), 'Knopf „🗺 Karte“ im Spiel'),
      el('label', { class: 'check' }, chk(c.hudHome !== false, (v) => { c.hudHome = v; }), 'Knopf „🏠 Zuhause“ im Spiel'),
      el('label', { class: 'check' }, chk(c.walkAnim !== false, (v) => { c.walkAnim = v; }), 'Kleine Reise-Animation auf der Karte'),
      el('div', { class: 'row gap8' }, el('button', { class: 'btn tiny', onclick: () => { if (window.UiDesign) UiDesign.edit('map'); } }, '🎨 Design der Karte'))));

    // ---------- Orte ----------
    const hubs = p.scenes.filter((s) => s.type === 'hub');
    const locs = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Orte'),
      el('div', { class: 'muted small' }, 'Jede Hub-Szene kann ein Ort sein. „Per Aktion“ heißt: erst nach der Aktion „📍 Ort freischalten“ (z. B. am Ende von Kapitel 1).'));
    locs.appendChild(el('div', { class: 'loc-row head' }, el('span', null, 'Ort'), el('span', null, 'Hub-Szene'), el('span', null, 'Name auf der Karte'), el('span', null, 'Zugang'), el('span', null, 'Wenn gesperrt'), el('span', null, 'Grund (sichtbar gesperrt)'), el('span', null, timeOn() ? 'Offen zu' : ''), el('span', null, 'Symbol')));
    for (const s of hubs) {
      const L = s.loc;
      locs.appendChild(el('div', { class: 'loc-row' + (L ? '' : ' off') },
        chk(!!L, (v) => { if (v) s.loc = { unlock: 'start', whenLocked: 'hidden' }; else delete s.loc; }),
        el('strong', null, (c.home === s.id ? '🏠 ' : '') + s.name),
        L ? txt(L.label, (v) => { L.label = v.trim(); }, null, s.name) : el('span'),
        L ? sel(L.unlock || 'start', [['start', 'von Anfang an'], ['action', 'per Aktion']], (v) => { L.unlock = v; }) : el('span'),
        L ? sel(L.whenLocked || 'hidden', [['hidden', 'unsichtbar'], ['unknown', 'als „???“'], ['visible', 'sichtbar, mit Grund']], (v) => { L.whenLocked = v; }) : el('span'),
        L && L.whenLocked === 'visible' ? txt(L.lockText, (v) => { L.lockText = v; }, null, 'z. B. „Erst nach Kapitel 2“') : el('span'),
        L && timeOn() ? el('span', { class: 'row gap4', style: { flexWrap: 'wrap' } }, ...p.time.slots.map((nm, i) => el('label', { class: 'hour-chip' + (!L.hours || L.hours.includes(i) ? ' on' : '') },
          el('input', { type: 'checkbox', checked: !L.hours || L.hours.includes(i), onchange: (e) => VN.mutate(() => { const h = L.hours ? L.hours.slice() : p.time.slots.map((_, j) => j); const k = h.indexOf(i); if (e.target.checked && k < 0) h.push(i); if (!e.target.checked && k >= 0) h.splice(k, 1); h.sort(); L.hours = h.length === p.time.slots.length ? null : h; }) }), nm))) : el('span'),
        L ? VN.assetSelect('image', L.icon, (v) => VN.mutate(() => { L.icon = v; })) : el('span')));
    }
    locs.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const s = VN.newHubScene(VN.t('Neuer Ort')); s.loc = { unlock: 'start', whenLocked: 'hidden' }; }) }, '+ Neuer Ort (Hub-Szene)'));
    body.appendChild(locs);

    // ---------- Karten ----------
    body.appendChild(S.mapEditor());

    // ---------- Ereignisse ----------
    body.appendChild(S.worldEvents());
  };

  // Karten mit Pins zum Ziehen
  S.mapEditor = () => {
    const c = W().cfg();
    const box = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Weltkarte(n)'),
      el('div', { class: 'muted small' }, 'Kartenbild wählen, dann Orte hinzufügen und die Punkte auf der Karte an die richtige Stelle ziehen. Unterkarten (Welt → Stadt → Viertel) öffnen sich per Klick.'));
    const cur = c.maps.find((m) => m.id === VN.ui.mapSel) || c.maps[0];
    const tabs = el('div', { class: 'row gap4', style: { flexWrap: 'wrap' } });
    for (const m of c.maps) tabs.appendChild(el('button', { class: 'btn tiny' + (m === cur ? ' primary' : ''), onclick: () => { VN.ui.mapSel = m.id; VN.render(); } }, (m.parent ? '↳ ' : '') + (m.name || 'Karte')));
    tabs.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const m = { id: VN.uid('map'), name: c.maps.length ? VN.t('Neue Karte') : VN.t('Welt'), image: null, nightImage: null, parent: c.maps.length ? (cur && cur.id) || null : null, pins: [] }; c.maps.push(m); VN.ui.mapSel = m.id; }) }, '+ Karte'));
    box.appendChild(tabs);
    if (!cur) return box;
    box.appendChild(el('div', { class: 'logic-row' },
      el('span', null, 'Name'), txt(cur.name, (v) => { cur.name = v || 'Karte'; }, { width: '140px' }),
      el('span', null, 'Bild'), VN.assetSelect('image', cur.image, (v) => VN.mutate(() => { cur.image = v; })),
      timeOn() ? el('span', null, 'Nachts') : null, timeOn() ? VN.assetSelect('image', cur.nightImage, (v) => VN.mutate(() => { cur.nightImage = v; })) : null,
      el('span', null, 'Liegt in'), sel(cur.parent || '', [['', '— oberste Karte —'], ...c.maps.filter((m) => m !== cur).map((m) => [m.id, m.name])], (v) => { cur.parent = v || null; }),
      el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { c.maps = c.maps.filter((m) => m !== cur); for (const m of c.maps) { if (m.parent === cur.id) m.parent = null; m.pins = (m.pins || []).filter((pn) => pn.map !== cur.id); } VN.ui.mapSel = null; }) }, 'Karte löschen')));
    // Kartenfläche
    const area = el('div', { class: 'wm-ed' });
    const inner = el('div', { class: 'wm-ed-box' });
    if (cur.image && VN.assetUrl(cur.image)) {
      const im = el('img', { src: VN.assetUrl(cur.image), draggable: 'false' });
      im.addEventListener('load', () => { inner.style.aspectRatio = im.naturalWidth + ' / ' + im.naturalHeight; });
      inner.appendChild(im);
    } else inner.appendChild(el('div', { class: 'wm-ed-ph' }, 'Wähle oben ein Kartenbild'));
    for (const pin of cur.pins || []) {
      const s = pin.loc ? VN.scene(pin.loc) : null, sub = pin.map ? W().map(pin.map) : null;
      const bad = (pin.loc && !W().isLoc(pin.loc)) || (pin.map && !sub);
      const node = el('div', { class: 'wm-ed-pin' + (bad ? ' bad' : '') + (sub ? ' sub' : ''), style: { left: pin.x + '%', top: pin.y + '%' }, title: 'Ziehen zum Verschieben' },
        pin.icon && VN.assetUrl(pin.icon) ? el('span', { class: 'wm-ico', style: { backgroundImage: `url("${VN.assetUrl(pin.icon)}")` } }) : el('span', { class: 'wm-dot' }),
        el('span', { class: 'wm-lbl' }, sub ? '🗺 ' + sub.name : s ? ((s.loc && s.loc.label) || s.name) : '⚠ Ort fehlt'));
      node.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const r = inner.getBoundingClientRect();
        const x0 = pin.x, y0 = pin.y;
        VN.drag(e, (dx, dy) => { node.style.left = Math.max(0, Math.min(100, x0 + dx / r.width * 100)) + '%'; node.style.top = Math.max(0, Math.min(100, y0 + dy / r.height * 100)) + '%'; },
          (dx, dy, moved) => { if (moved) VN.mutate(() => { pin.x = Math.round(Math.max(0, Math.min(100, x0 + dx / r.width * 100)) * 10) / 10; pin.y = Math.round(Math.max(0, Math.min(100, y0 + dy / r.height * 100)) * 10) / 10; }); });
      });
      inner.appendChild(node);
    }
    area.appendChild(inner);
    box.appendChild(area);
    // Pin-Liste
    const onMap = new Set((cur.pins || []).map((pn) => pn.loc).filter(Boolean));
    for (const pin of cur.pins || []) {
      box.appendChild(el('div', { class: 'logic-row' },
        pin.map ? el('span', null, '🗺 Unterkarte') : el('span', null, '📍'),
        pin.map ? sel(pin.map, c.maps.filter((m) => m !== cur).map((m) => [m.id, m.name]), (v) => { pin.map = v; })
          : sel(pin.loc, [['', '— Ort —'], ...W().locs().map((s) => [s.id, s.name])], (v) => { pin.loc = v; }),
        timeOn() && pin.loc ? el('span', { class: 'muted small' }, 'Reisezeit') : null, timeOn() && pin.loc ? num(pin.cost, (v) => { pin.cost = v; }, '56px') : null,
        el('span', { class: 'muted small' }, 'Symbol'), VN.assetSelect('image', pin.icon, (v) => VN.mutate(() => { pin.icon = v; })),
        el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { cur.pins = cur.pins.filter((x) => x !== pin); }) }, '×')));
    }
    const free = W().locs().filter((s) => !onMap.has(s.id));
    box.appendChild(el('div', { class: 'row gap8' },
      free.length ? sel('', [['', '+ Ort auf diese Karte …'], ...free.map((s) => [s.id, s.name])], (v) => { if (v) { cur.pins = cur.pins || []; cur.pins.push({ id: VN.uid('pin'), loc: v, x: 50, y: 50, icon: null, cost: null }); } }) : el('span', { class: 'muted small' }, W().locs().length ? 'Alle Orte liegen auf dieser Karte.' : 'Markiere oben zuerst Hub-Szenen als Ort.'),
      c.maps.length > 1 ? el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const other = c.maps.find((m) => m !== cur && m.parent === cur.id) || c.maps.find((m) => m !== cur); cur.pins = cur.pins || []; cur.pins.push({ id: VN.uid('pin'), map: other.id, x: 50, y: 50 }); }) }, '+ Unterkarte als Pin') : null));
    return box;
  };

  // Ereignisse an Orten
  S.worldEvents = () => {
    const c = W().cfg();
    const box = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Ereignisse an Orten'),
      el('div', { class: 'muted small' }, 'Eine Story-Szene, die startet, wenn man an den Ort kommt und die Bedingungen passen. Pflicht-Ereignisse kommen zuerst (z. B. „Tag 5, morgens, Zuhause → Brief vom König“). Am Ende der Szene „Danach weiter zu“ leer lassen oder „↩ Zurück zum Ort“ wählen.'));
    box.appendChild(el('div', { class: 'ev-row head' }, el('span'), el('span', null, 'Ort'), el('span', null, 'Name'), el('span', null, 'Szene'), el('span', null, 'Wann'), el('span', null, 'Art'), el('span', null, 'Auf der Karte'), el('span')));
    for (const ev of c.events) {
      const problems = [];
      if (!ev.scene || !VN.scene(ev.scene)) problems.push('Szene fehlt');
      if (ev.loc && !W().isLoc(ev.loc)) problems.push('Ort fehlt');
      for (const cd of ev.conds || []) { const pr = VN.condProblem(cd); if (pr) problems.push(pr); }
      const open = VN.ui.evOpen === ev.id;
      box.appendChild(el('div', { class: 'ev-row' + (problems.length ? ' bad-row' : ''), title: problems.join('\n') },
        el('button', { class: 'btn tiny ghost', onclick: () => { VN.ui.evOpen = open ? null : ev.id; VN.render(); } }, open ? '▾' : '▸'),
        sel(ev.loc || '', [['', '— überall —'], ...W().locs().map((s) => [s.id, s.name])], (v) => { ev.loc = v; }),
        txt(ev.name, (v) => { ev.name = v; }, null, 'Name'),
        sel(ev.scene || '', [['', '— Szene —'], ...VN.project.scenes.filter((s) => s.type === 'story').map((s) => [s.id, s.name])], (v) => { ev.scene = v; }),
        el('span', { class: 'small' + ((ev.conds || []).length ? '' : ' muted') }, (ev.conds || []).length ? ev.conds.map(VN.condText).join(' und ') : 'immer'),
        sel(ev.must ? 'must' : 'opt', [['must', 'Pflicht'], ['opt', 'optional']], (v) => { ev.must = v === 'must'; }),
        sel(ev.mark || '', [['', '—'], ['!', '! (Story)'], ['♥', '♥ (Figur)']], (v) => { ev.mark = v; }),
        el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { c.events = c.events.filter((x) => x !== ev); }) }, '×')));
      if (open) box.appendChild(el('div', { class: 'ev-detail' },
        VN.condEditor(ev.conds || (ev.conds = []), 'Startet nur, wenn'),
        el('label', { class: 'check' }, chk(ev.once !== false, (v) => { ev.once = v; }), 'Nur einmal (sonst bei jedem Besuch, solange die Bedingung passt)'),
        ev.scene && VN.scene(ev.scene) ? el('button', { class: 'btn tiny', onclick: () => App.openScene(ev.scene) }, 'Szene öffnen') : null));
    }
    box.appendChild(el('div', { class: 'row gap8' },
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const e = { id: VN.uid('wev'), name: VN.t('Neues Ereignis'), loc: (W().locs()[0] || {}).id || '', scene: '', conds: [], must: false, once: true, mark: '' }; c.events.push(e); VN.ui.evOpen = e.id; }) }, '+ Ereignis'),
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const s = VN.newStoryScene('Ereignis'); s.next = '@return'; const e = { id: VN.uid('wev'), name: s.name, loc: (W().locs()[0] || {}).id || '', scene: s.id, conds: [], must: false, once: true, mark: '' }; c.events.push(e); VN.ui.evOpen = e.id; }) }, '+ Ereignis mit neuer Szene')));
    return box;
  };

  // Übersicht: Schalter für Welt & Orte und Questlog
  if (VN.Life) {
    const base = VN.Life.extraSwitches;
    VN.Life.extraSwitches = (card, set) => {
      const p = VN.project;
      const out = base ? base(card, set) : [];
      out.push(card('🗺', 'Welt & Orte', 'Orte mit Weltkarte, ein Zuhause, Ereignisse an Orten und freie Zeit – wie in vielen Dating-Sims.', W().on(), set((v) => { W().cfg().enabled = v; }), 'world'));
      if (VN.Quests) out.push(card('📜', 'Questlog', 'Questreihen, Quests und Abschnitte für Story und Figuren. Erledigen sich selbst über Bedingungen.', VN.Quests.on(), set((v) => { VN.Quests.cfg().enabled = v; }), 'quests'));
      return out;
    };
  }
})();
