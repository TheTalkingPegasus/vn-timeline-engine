// Editor: Spielsysteme → Aufbau (Gebäude, Ziele, Einstellungen, Zeitvorschau, Probelauf)
(function () {
  const { el } = VN;
  const ID = () => VN.Idle;
  const S = window.Systems;
  const txt = (v, fn, style, ph) => el('input', { type: 'text', value: v || '', placeholder: ph || '', style: style || null, onchange: (e) => VN.mutate(() => fn(e.target.value)) });
  const num = (v, fn, w, step) => el('input', { type: 'number', value: v != null ? v : '', step: step || 'any', style: { width: w || '64px' }, onchange: (e) => VN.mutate(() => fn(e.target.value === '' ? 0 : Number(e.target.value))) });
  const sel = (v, opts, fn, style) => {
    const s = el('select', { style: style || null, onchange: (e) => VN.mutate(() => fn(e.target.value)) });
    for (const [k, l] of opts) { const o = el('option', { value: k }, l); if (String(k) === String(v == null ? '' : v)) o.selected = true; s.appendChild(o); }
    return s;
  };
  const field = (label, ...kids) => el('label', { class: 'sk-field' }, el('span', { class: 'muted small' }, label), ...kids);
  const check = (v, label, fn, title) => el('label', { class: 'check', title: title || '' }, el('input', { type: 'checkbox', checked: !!v, onchange: (e) => VN.mutate(() => fn(e.target.checked)) }), label);
  const sec = (title, ...kids) => el('div', { class: 'sk-sec' }, el('span', { class: 'sec-title' }, title), ...kids);
  const curOpts = () => [['', '— Währung —'], ...VN.project.currencies.map((c) => [c.id, c.name])];
  const unitL = () => (ID().cfg().mode === 'gametime' ? VN.t('pro Tageszeit') : VN.t({ sec: 'pro Sekunde', hour: 'pro Stunde' }[ID().cfg().tick] || 'pro Minute'));

  const listLayout = (items, selId, setSel, render, addBtns, rowInfo) => {
    const list = el('div', { class: 'cb-elist' });
    for (const x of items) {
      const info = rowInfo(x);
      list.appendChild(el('div', { class: 'cb-erow' + (x.id === selId ? ' sel' : '') + (info.bad ? ' bad' : ''), onclick: () => { setSel(x.id); VN.render(); } },
        info.thumb || null, el('div', { class: 'cb-etext' }, el('strong', { 'data-notr': '' }, x.name || '?'), el('span', { class: 'muted small' }, info.sub || ''))));
    }
    if (!items.length) list.appendChild(el('div', { class: 'muted small', style: { padding: '8px' } }, 'Noch nichts angelegt.'));
    const cur = items.find((x) => x.id === selId) || items[0];
    return el('div', { class: 'cb-layout' }, el('div', { class: 'cb-left' }, el('div', { class: 'row gap4', style: { flexWrap: 'wrap' } }, ...addBtns), list),
      cur ? render(cur) : el('div', { class: 'opt-card muted' }, 'Lege links etwas an.'));
  };
  const thumb = (b) => { const u = b.image && VN.assetUrl(b.image); return u ? el('span', { class: 'cb-thumb', style: { backgroundImage: `url("${u}")` } }) : el('span', { class: 'cb-thumb ph' }, b.icon || '🏠'); };

  // Liste aus Währung + Menge (Kosten oder Produktion)
  const amountList = (list, label, hint) => {
    const box = el('div', { class: 'id-amounts' });
    list.forEach((x, i) => box.appendChild(el('div', { class: 'row gap8', style: { alignItems: 'center' } },
      sel(x.cur || '', curOpts(), (v) => { x.cur = v; }), num(x.amount, (v) => { x.amount = Math.max(0, v); }, '80px'),
      hint ? el('span', { class: 'muted small' }, hint) : null,
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { list.splice(i, 1); }) }, '×'))));
    box.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { list.push({ cur: (VN.project.currencies[0] || {}).id || '', amount: 10 }); }) }, '+ ' + label));
    return box;
  };

  const buildingBox = (b) => {
    const c = ID().cfg();
    const probs = ID().buildingProblems(b);
    const box = el('div', { class: 'opt-card sk-insp' });
    const i = c.buildings.indexOf(b);
    box.appendChild(el('div', { class: 'row gap8', style: { alignItems: 'center' } }, thumb(b), el('strong', { style: { fontSize: '15px' }, 'data-notr': '' }, b.name || '?'), el('div', { class: 'spacer' }),
      el('button', { class: 'btn tiny', disabled: i <= 0, title: 'Weiter nach vorne', onclick: () => VN.mutate(() => { c.buildings.splice(i, 1); c.buildings.splice(i - 1, 0, b); }) }, '↑'),
      el('button', { class: 'btn tiny', disabled: i >= c.buildings.length - 1, title: 'Weiter nach hinten', onclick: () => VN.mutate(() => { c.buildings.splice(i, 1); c.buildings.splice(i + 1, 0, b); }) }, '↓'),
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const n = JSON.parse(JSON.stringify(b)); n.id = VN.uid('bd'); n.name = b.name + ' 2'; c.buildings.push(n); VN.ui.idSel = n.id; }) }, 'Kopieren'),
      el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { c.buildings = c.buildings.filter((x) => x !== b); VN.ui.idSel = null; }) }, 'Löschen')));
    if (probs.length) box.appendChild(el('div', { class: 'sk-probs' }, ...probs.map((p) => el('div', null, '⚠ ' + VN.t(p)))));
    box.appendChild(el('div', { class: 'sk-grid2' },
      field('Name', txt(b.name, (v) => { b.name = v; })),
      field('Symbol', txt(b.icon, (v) => { b.icon = v; }, { width: '56px' })),
      field('Bild', VN.assetSelect('image', b.image, (v) => VN.mutate(() => { b.image = v; }))),
      field('Stufen', num(b.max, (v) => { b.max = Math.max(1, Math.round(v || 1)); if ((Number(b.start) || 0) > b.max) b.start = b.max; }, '56px', 1)),
      field('Startstufe', num(b.start || 0, (v) => { b.start = Math.max(0, Math.min(ID().max(b), Math.round(v || 0))); }, '56px', 1))));
    box.appendChild(field('Beschreibung (im Spiel)', el('textarea', { rows: 2, class: 'sk-desc', onchange: (e) => VN.mutate(() => { b.desc = e.target.value; }) }, b.desc || '')));
    const costs = [];
    for (let l = 0; l < Math.min(ID().max(b), 5); l++) costs.push(ID().cost(b, l).map((x) => x.amount + ' ' + ID().curName(x.cur)).join(' + '));
    box.appendChild(sec('Kosten für die erste Stufe', amountList(b.costs, 'Kosten'),
      el('div', { class: 'sk-grid2' }, field('× pro Stufe', num(b.grow, (v) => { b.grow = Math.max(1, v || 1); }, '64px', 0.05))),
      el('div', { class: 'muted small' }, costs.map((x, k) => VN.t('St.') + ' ' + (k + 1) + ': ' + x).join(' · ') + (ID().max(b) > 5 ? ' …' : ''))));
    box.appendChild(sec('Produktion je Stufe (' + unitL() + ')', amountList(b.prods, 'Produktion'),
      el('div', { class: 'muted small' }, 'Stufe 3 bringt das Dreifache. Skilltrees können die Produktion erhöhen.')));
    box.appendChild(sec('Anklicken',
      c.click ? el('div', { class: 'sk-grid2' }, check(b.clickable, 'Dieses Gebäude anklickbar', (v) => { b.clickable = v; }), b.clickable ? field('Pro Klick (× Stufe)', num(b.clickAmount || 1, (v) => { b.clickAmount = Math.max(1, v || 1); }, '56px', 1)) : null)
        : el('div', { class: 'muted small' }, 'Anklicken ist in den Einstellungen ausgeschaltet.')));
    const ub = b.unlockBy === 'action' ? 'action' : 'conds';
    box.appendChild(sec('Freischalten',
      el('div', { class: 'seg', style: { marginBottom: '6px' } },
        el('button', { class: ub === 'conds' ? 'active' : '', onclick: () => VN.mutate(() => { b.unlockBy = 'conds'; }) }, 'Von Anfang an / mit Bedingung'),
        el('button', { class: ub === 'action' ? 'active' : '', onclick: () => VN.mutate(() => { b.unlockBy = 'action'; }) }, 'Durch Aktion (z. B. Kauf im Hub)')),
      ub === 'action' ? el('div', { class: 'hint-box' }, VN.t('Das Gebäude erscheint erst, wenn irgendwo die Aktion „🏰 Gebäude freischalten“ ausgeführt wird – am einfachsten per Rechtsklick auf ein Hub-Objekt → Bausteine → „Wird gekauft …“.'),
        ID().unlockedSomewhere(b) ? null : el('div', { style: { marginTop: '6px', color: '#e8b84a' } }, '⚠ ' + VN.t('Noch nirgends eingerichtet.'))) : null,
      VN.condEditor(b.conds, ub === 'action' ? 'Zusätzlich nur, wenn (optional)' : 'Erst baubar, wenn (optional)'),
      check(b.hideLocked, 'Bis dahin verstecken', (v) => { b.hideLocked = v; })));
    return box;
  };

  const goalBox = (m) => {
    const c = ID().cfg();
    const i = c.milestones.indexOf(m);
    const box = el('div', { class: 'opt-card sk-insp' });
    box.appendChild(el('div', { class: 'row gap8', style: { alignItems: 'center' } }, el('strong', { style: { fontSize: '15px' }, 'data-notr': '' }, '◆ ' + (m.name || '?')), el('div', { class: 'spacer' }),
      el('button', { class: 'btn tiny', disabled: i <= 0, onclick: () => VN.mutate(() => { c.milestones.splice(i, 1); c.milestones.splice(i - 1, 0, m); }) }, '↑'),
      el('button', { class: 'btn tiny', disabled: i >= c.milestones.length - 1, onclick: () => VN.mutate(() => { c.milestones.splice(i, 1); c.milestones.splice(i + 1, 0, m); }) }, '↓'),
      el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { c.milestones = c.milestones.filter((x) => x !== m); VN.ui.idSel = null; }) }, 'Löschen')));
    box.appendChild(el('div', { class: 'muted small' }, 'Ziele werden der Reihe nach erreicht. Erreichte Ziele führen ihre Aktionen aus – z. B. eine Variable setzen, damit die Geschichte weitergeht, oder einen Ort freischalten.'));
    box.appendChild(el('div', { class: 'sk-grid2' },
      field('Name', txt(m.name, (v) => { m.name = v; })),
      field(ID().cfg().mode === 'gametime' ? 'Geplant (Tageszeiten)' : 'Geplant (Minuten)', num(m.target, (v) => { m.target = Math.max(0, v); }, '64px', 1))));
    box.appendChild(field('Beschreibung (im Spiel)', el('textarea', { rows: 2, class: 'sk-desc', onchange: (e) => VN.mutate(() => { m.desc = e.target.value; }) }, m.desc || '')));
    box.appendChild(field('Meldung beim Erreichen', txt(m.message, (v) => { m.message = v; })));
    box.appendChild(VN.condEditor(m.conds, 'Erreicht, wenn'));
    box.appendChild(VN.actionEditor(m.actions, 'Beim Erreichen ausführen'));
    return box;
  };

  // Zeitvorschau: wie lange braucht ein Spieler, der sinnvoll ausbaut?
  const previewCard = () => {
    const c = ID().cfg();
    const box = el('div', { class: 'opt-card id-pv' }, el('div', { class: 'sec-title' }, 'Zeitvorschau'));
    if (!c.milestones.length) { box.appendChild(el('div', { class: 'muted small' }, 'Lege Ziele an, dann siehst du hier, wie lange ein Spieler ungefähr braucht.')); return box; }
    const res = ID().preview();
    const row = el('div', { class: 'id-pv-row' });
    let prev = 0;
    for (const x of res) {
      const warn = x.took != null && Number(c.warnMin) > 0 && x.took > Number(c.warnMin) && c.mode !== 'gametime';
      const plan = Number(x.m.target) || 0;
      row.appendChild(el('div', { class: 'id-pv-item' + (x.at == null ? ' bad' : warn ? ' warn' : ''), title: plan ? VN.t('Geplant') + ': ' + ID().fmtTime(plan) : '' },
        el('strong', { 'data-notr': '' }, x.m.name),
        el('span', null, x.at == null ? VN.t('nicht erreichbar') : '+' + ID().fmtTime(x.took) + ' · ' + VN.t('gesamt') + ' ' + ID().fmtTime(x.at)),
        warn ? el('span', { class: 'id-pv-w' }, '⚠ ' + VN.t('länger als') + ' ' + c.warnMin + ' ' + VN.t('Min.')) : null));
      prev = x.at || prev;
    }
    box.appendChild(row);
    box.appendChild(el('div', { class: 'muted small' }, res.some((x) => x.at == null) ? 'Ein Ziel ist in 10 Stunden nicht erreichbar: Kosten, Produktion oder Freischaltung prüfen (ohne Klicken, ohne Skilltrees gerechnet).' : 'Gerechnet für einen Spieler, der immer den lohnendsten Ausbau kauft – ohne Klicken und ohne Skilltrees.'));
    return box;
  };

  const settingsView = (body) => {
    const c = ID().cfg();
    body.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Allgemein'),
      el('div', { class: 'sk-grid2' },
        field('Titel im Spiel', txt(c.title, (v) => { c.title = v; })),
        field('Taste (leer = keine)', txt(c.key || '', (v) => { c.key = (v || '').slice(0, 1).toLowerCase(); }, { width: '40px' })),
        field('Produktion läuft', sel(c.mode, ID().MODES, (v) => { c.mode = v; })),
        c.mode !== 'gametime' ? field('Mengen gelten', sel(c.tick || 'min', ID().TICKS, (v) => { c.tick = v; })) : null,
        field('Aufbau startet', sel(c.startWhen || 'always', ID().STARTS, (v) => { c.startWhen = v; }))),
      c.startWhen === 'cond' ? VN.condEditor(c.startConds || (c.startConds = []), 'Startet, sobald') : null,
      c.startWhen === 'cond' ? el('div', { class: 'muted small' }, 'Zum Beispiel „✔ Spieler hat … eine Szene gesehen“ oder eine Variable, die ein Dialog setzt. Danach läuft der Aufbau dauerhaft.') : null,
      c.startWhen === 'action' ? el('div', { class: 'muted small' }, 'Setze die Aktion „🏰 Aufbau starten“ z. B. an eine Dialogzeile („Ab heute gehört dir das Dorf!“), an eine Antwort oder an ein Objekt im Hub.') : null,
      c.startWhen === 'firstOpen' ? el('div', { class: 'muted small' }, 'Die Produktion beginnt in dem Moment, in dem der Spieler den Aufbau zum ersten Mal öffnet – vorher wird nichts gesammelt.') : null,
      c.mode !== 'gametime' && c.tick === 'hour' ? el('div', { class: 'muted small' }, 'Pro Stunde lohnt sich meist mit „auch bei geschlossenem Spiel“ – sonst müsste der Spieler eine Stunde mit offenem Spiel warten.') : null,
      c.mode === 'offline' ? el('div', { class: 'sk-grid2' },
        field('Höchstens (Stunden)', num(c.offlineMax, (v) => { c.offlineMax = Math.max(0, v); }, '64px', 1)),
        field('Davon %', num(c.offlinePct, (v) => { c.offlinePct = Math.max(0, Math.min(100, v)); }, '64px', 5)),
        el('span', { class: 'muted small', style: { alignSelf: 'end' } }, 'Beim nächsten Laden gibt es den Ertrag der Abwesenheit (gedeckelt).')) : null,
      c.mode === 'gametime' ? el('div', { class: 'muted small' }, 'Produziert wird, wenn per Aktion „Zeit vergehen lassen“ Tageszeiten vergehen. Mengen gelten dann pro Tageszeit.') : null,
      el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
        check(c.inMenu, 'Im Pausenmenü (Esc) anzeigen', (v) => { c.inMenu = v; }, 'Aus: Der Aufbau ist nur über die Spielwelt erreichbar – z. B. ein Objekt im Hub mit der Aktion „🏰 Aufbau öffnen“'),
        check(c.click, 'Gebäude anklickbar (pro Gebäude einstellbar)', (v) => { c.click = v; }),
        check(c.hidden, 'Künftige Ziele als „???“ zeigen', (v) => { c.hidden = v; }))));
    body.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Damit die Geschichte nicht ausgebremst wird'),
      el('div', { class: 'sk-grid2' },
        field('Aufholbonus %', num(c.catchup, (v) => { c.catchup = Math.max(0, v); }, '64px', 10)),
        field('Warnen ab (Minuten pro Ziel)', num(c.warnMin, (v) => { c.warnMin = Math.max(0, v); }, '64px', 1))),
      el('div', { class: 'muted small' }, 'Aufholbonus: Dauert ein Ziel länger als bei „Geplant“ eingetragen, läuft die ganze Produktion um diesen Wert schneller. Die Warnung erscheint in der Zeitvorschau.')));
  };

  S.idleTab = (body) => {
    const c = ID().cfg();
    body.appendChild(el('p', { class: 'muted' }, el('span', null, 'Aufbau wie in Idle- und Aufbauspielen: Gebäude produzieren Rohstoffe (deine Währungen), werden mit steigenden Kosten ausgebaut, und erreichte Ziele treiben die Geschichte voran – z. B. ein Königreich aufbauen, um das Burgfräulein zu beeindrucken.'), ' ', el('span', null, VN.t('Geöffnet wird er über die Aktion „🏰 Aufbau öffnen“, z. B. an einem Objekt im Hub.') + (c.key ? ' ' + (VN.I18n && VN.I18n.lang === 'en' ? 'Key ' + c.key.toUpperCase() + ' also works.' : 'Taste ' + c.key.toUpperCase() + ' geht auch.') : ''))));
    const iss = ID().issues();
    if (iss.length) body.appendChild(Help.sysBox(iss));
    if (!c.buildings.length && !c.milestones.length) {
      body.appendChild(el('div', { class: 'hint-box' }, 'Noch leer. Das Beispiel „Königreich“ legt Holz und Stein als Rohstoffe an, fünf Gebäude (Holzfällerhütte bis Burg) und drei Ziele – alles änderbar.',
        el('div', { class: 'row gap8', style: { marginTop: '8px' } }, el('button', { class: 'btn primary', onclick: () => { VN.ui.idTab = 'buildings'; ID().example(); } }, 'Beispiel: Königreich'), el('button', { class: 'btn', onclick: () => VN.mutate(() => { const b = ID().newBuilding(); c.buildings.push(b); VN.ui.idTab = 'buildings'; VN.ui.idSel = b.id; }) }, 'Leer beginnen'))));
      return;
    }
    const tab = VN.ui.idTab || 'buildings';
    const nav = el('div', { class: 'row gap4', style: { flexWrap: 'wrap', alignItems: 'center' } });
    for (const [k, l] of [['buildings', 'Gebäude'], ['goals', 'Ziele'], ['settings', 'Einstellungen']]) nav.appendChild(el('button', { class: 'btn tiny' + (tab === k ? ' primary' : ''), onclick: () => { VN.ui.idTab = k; VN.ui.idSel = null; VN.render(); } }, l));
    nav.appendChild(el('div', { class: 'spacer' }));
    nav.appendChild(el('button', { class: 'btn tiny primary', onclick: () => window.Player && Player.tryIdle && Player.tryIdle() }, '▶ Ausprobieren'));
    nav.appendChild(el('button', { class: 'btn tiny', onclick: () => window.UiDesign && UiDesign.edit('idle') }, '🎨 Design des Aufbaus'));
    body.appendChild(nav);
    body.appendChild(previewCard());
    if (tab === 'buildings') body.appendChild(listLayout(c.buildings, VN.ui.idSel, (id) => { VN.ui.idSel = id; }, buildingBox,
      [el('button', { class: 'btn tiny primary', onclick: () => VN.mutate(() => { const b = ID().newBuilding(); c.buildings.push(b); VN.ui.idSel = b.id; }) }, '+ Gebäude')],
      (b) => ({ thumb: thumb(b), sub: Object.entries(ID().prodOf(b, 1)).map(([k, v]) => '+' + ID().fmtNum(v) + ' ' + ID().curName(k)).join(', ') || VN.t('produziert nichts'), bad: ID().buildingProblems(b).length > 0 })));
    else if (tab === 'goals') body.appendChild(listLayout(c.milestones, VN.ui.idSel, (id) => { VN.ui.idSel = id; }, goalBox,
      [el('button', { class: 'btn tiny primary', onclick: () => VN.mutate(() => { const m = ID().newMilestone(); c.milestones.push(m); VN.ui.idSel = m.id; }) }, '+ Ziel')],
      (m) => ({ thumb: el('span', { class: 'cb-thumb ph' }, '◆'), sub: (m.conds || []).map((x) => VN.condText(x)).join(', ') || VN.t('keine Bedingung'), bad: !(m.conds || []).length })));
    else settingsView(body);
  };

  // Übersicht: Schalter
  if (VN.Life) {
    const base = VN.Life.extraSwitches;
    VN.Life.extraSwitches = (card, set) => {
      const out = base ? base(card, set) : [];
      out.push(card('🏰', 'Aufbau (Idle)', 'Gebäude produzieren Rohstoffe, werden ausgebaut, Ziele treiben die Geschichte voran. In Echtzeit, auch bei geschlossenem Spiel oder in Spielzeit. Mit Zeitvorschau.', ID().on(), set((v) => { ID().cfg().enabled = v; }), 'idle'));
      return out;
    };
  }
})();
