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
      el('div', { class: 'sk-grid2' }, field('× pro Stufe', num(b.grow, (v) => { b.grow = Math.max(1, v || 1); }, '64px', 0.05)),
        field('Preis-Kurve', sel(b.costCurve || '', [['', '— wie in Einstellungen —'], ...COST_K], (v) => { if (v) b.costCurve = v; else delete b.costCurve; }))),
      el('div', { class: 'muted small' }, costs.map((x, k) => VN.t('St.') + ' ' + (k + 1) + ': ' + x).join(' · ') + (ID().max(b) > 5 ? ' …' : ''))));
    const prodPrev = [1, 2, 3, 5, 10, 25].filter((l) => l <= ID().max(b)).map((l) => VN.t('St.') + ' ' + l + ': ' + (Object.entries(ID().prodOf(b, l)).map(([k, v]) => ID().fmtNum(v) + ' ' + ID().curName(k)).join(' + ') || '0'));
    box.appendChild(sec('Produktion je Stufe (' + unitL() + ')', amountList(b.prods, 'Produktion'),
      el('div', { class: 'sk-grid2' }, field('Gewinn-Kurve', sel(b.prodCurve || '', [['', '— wie in Einstellungen —'], ...PROD_K], (v) => { if (v) b.prodCurve = v; else delete b.prodCurve; }))),
      el('div', { class: 'muted small' }, prodPrev.join(' · ') + ' – ' + VN.t('Skilltrees können die Produktion erhöhen.'))));
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

  // ---------- Preise & Gewinne (0.9.27) ----------
  const COST_K = [['exp', 'Exponentiell (× pro Stufe)'], ['poly', 'Quadratisch / Potenz'], ['soft', 'Sanft gebremst'], ['linear', 'Linear (gleich viel mehr)']];
  const PROD_K = [['linear', 'Gleichmäßig (Stufe × Ertrag)'], ['exp', 'Wachsend (Schneeball)'], ['dimin', 'Abflachend']];
  const curveChart = (b) => {
    const NS = 'http://www.w3.org/2000/svg', W = 520, H = 170, pad = 30;
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'id-chart');
    const mk = (t, a, txt) => { const n = document.createElementNS(NS, t); for (const [k, v] of Object.entries(a)) n.setAttribute(k, v); if (txt != null) n.textContent = txt; svg.appendChild(n); return n; };
    const L = Math.max(2, Math.min(ID().max(b), 100));
    const cost = [], prod = [];
    for (let l = 0; l <= L; l++) { cost.push(ID().cost(b, l).reduce((a, x) => a + x.amount, 0)); prod.push(Object.values(ID().prodOf(b, l)).reduce((a, x) => a + x, 0)); }
    // Amortisation: wie viele Zeiteinheiten bis sich die nächste Stufe bezahlt macht
    const pay = cost.map((c, l) => { const d = (prod[l + 1] || 0) - (prod[l] || 0); return d > 0 ? c / d : null; }).slice(0, L);
    const all = [...cost, ...prod.filter((x) => x > 0)].filter((x) => x > 0);
    const lo = Math.log10(Math.max(0.1, Math.min(...all))), hi = Math.log10(Math.max(...all, 1)) + 0.01;
    const X = (l) => pad + (W - pad - 8) * l / L, Y = (v) => H - 18 - (H - 30) * (Math.log10(Math.max(v, 0.1)) - lo) / (hi - lo || 1);
    for (let e = Math.ceil(lo); e <= hi; e++) { mk('line', { x1: pad, x2: W - 8, y1: Y(Math.pow(10, e)), y2: Y(Math.pow(10, e)), stroke: 'rgba(255,255,255,.07)' }); mk('text', { x: 2, y: Y(Math.pow(10, e)) + 4, fill: '#888', 'font-size': 10 }, e >= 6 ? '1e' + e : String(Math.pow(10, e))); }
    const line = (arr, col, from) => mk('path', { d: arr.map((v, l) => (l === from ? 'M' : 'L') + X(l).toFixed(1) + ' ' + Y(v).toFixed(1)).slice(from).join(' '), fill: 'none', stroke: col, 'stroke-width': 2.2 });
    line(cost, '#f0a05a', 0); line(prod, '#6fd08a', 1);
    for (const [at] of ID().curve().ms || []) if (at <= L) mk('line', { x1: X(at), x2: X(at), y1: 8, y2: H - 18, stroke: 'rgba(240,194,106,.45)', 'stroke-dasharray': '3 3' });
    mk('text', { x: pad, y: H - 4, fill: '#888', 'font-size': 10 }, VN.t('Stufe') + ' 0');
    mk('text', { x: W - 8, y: H - 4, fill: '#888', 'font-size': 10, 'text-anchor': 'end' }, String(L));
    const leg = el('div', { class: 'id-chart-leg' }, el('span', { style: { color: '#f0a05a' } }, '● ' + VN.t('Preis der nächsten Stufe')), el('span', { style: { color: '#6fd08a' } }, '● ' + VN.t('Ertrag') + ' ' + unitL()),
      el('span', { class: 'muted' }, VN.t('Amortisation') + ': ' + [1, 10, 25, 50].filter((l) => l < pay.length && pay[l] != null).map((l) => VN.t('St.') + ' ' + l + ' ≈ ' + ID().fmtNum(Math.round(pay[l])) + ' ' + ID().unitShort()).join(' · ')));
    return el('div', null, svg, leg);
  };
  const curveSec = () => {
    const C = ID().curve(), c = ID().cfg();
    const box = sec('Preise & Gewinne');
    box.appendChild(el('div', { class: 'muted small' }, VN.t('Wie stark Preise und Erträge mit jeder Stufe wachsen. Vorlagen nach bekannten Idle-Spielen – danach frei anpassbar. Einzelne Gebäude können eine eigene Kurve haben.')));
    const setGrow = el('input', { type: 'checkbox', checked: true });
    box.appendChild(el('div', { class: 'id-cv-pick' }, ...ID().CURVE_PRESETS.map((pr) => el('div', { class: 'id-cv', title: VN.t(pr.desc), onclick: () => VN.mutate(() => ID().applyCurvePreset(pr, setGrow.checked)) }, el('strong', null, VN.t(pr.name)), el('span', { class: 'muted small' }, VN.t(pr.desc))))));
    box.appendChild(el('label', { class: 'check small' }, setGrow, VN.t('Bei Vorlagen mit festem Faktor auch „× pro Stufe“ aller Gebäude setzen')));
    box.appendChild(el('div', { class: 'row gap8', style: { flexWrap: 'wrap', marginTop: '6px' } },
      field('Preise', sel(C.cost, COST_K, (v) => { C.cost = v; })),
      C.cost === 'poly' ? field('Potenz', num(C.pow, (v) => { C.pow = Math.max(0.5, Math.min(6, v || 2)); }, '60px', 0.1)) : null,
      C.cost === 'linear' ? field('+ % vom Grundpreis je Stufe', num(C.lin, (v) => { C.lin = Math.max(0, v || 0); }, '60px', 5)) : null,
      C.cost === 'soft' ? field('Bremse (0,3–1)', num(C.soft, (v) => { C.soft = Math.max(0.3, Math.min(1, v || 0.8)); }, '60px', 0.05)) : null,
      field('Gewinne', sel(C.prod, PROD_K, (v) => { C.prod = v; })),
      C.prod === 'exp' ? field('× je Stufe', num(C.pgrow, (v) => { C.pgrow = Math.max(1, Math.min(2, v || 1.05)); }, '60px', 0.01)) : null,
      C.prod === 'dimin' ? field('Abflachung (0,3–1)', num(C.dimin, (v) => { C.dimin = Math.max(0.3, Math.min(1, v || 0.8)); }, '60px', 0.05)) : null));
    // Meilenstein-Boni: ab Stufe X wird der Ertrag dieses Gebäudes × Y
    const ms = el('div', { class: 'row gap8', style: { flexWrap: 'wrap', alignItems: 'center', marginTop: '6px' } }, el('span', { class: 'muted small' }, VN.t('Sprünge (Ertrag × ab Stufe):')));
    (C.ms || []).forEach((m, i) => ms.appendChild(el('span', { class: 'id-msb' }, VN.t('ab'), num(m[0], (v) => { m[0] = Math.max(1, Math.round(v || 1)); C.ms.sort((a, b) => a[0] - b[0]); }, '64px', 1), '×', num(m[1], (v) => { m[1] = Math.max(0.1, v || 2); }, '46px', 0.5),
      el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { C.ms.splice(i, 1); }) }, '×'))));
    ms.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const last = (C.ms[C.ms.length - 1] || [0])[0]; C.ms.push([last ? last * 2 : 25, 2]); }) }, '+ ' + VN.t('Sprung')));
    box.appendChild(ms);
    const b = c.buildings.find((x) => x.id === VN.ui.idCurveB) || c.buildings[0];
    if (b) {
      box.appendChild(el('div', { class: 'row gap8', style: { marginTop: '8px', alignItems: 'center' } }, el('span', { class: 'muted small' }, VN.t('Verlauf für')), sel(b.id, c.buildings.map((x) => [x.id, x.name]), (v) => { VN.ui.idCurveB = v; })));
      box.appendChild(curveChart(b));
    }
    return box;
  };
  const settingsView = (body) => {
    body.appendChild(curveSec());
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
    body.appendChild(el('p', { class: 'muted' }, el('span', null, 'Aufbau wie in Idle- und Aufbauspielen: Gebäude produzieren Rohstoffe (deine Währungen), werden mit steigenden Kosten ausgebaut, und erreichte Ziele treiben die Geschichte voran – z. B. ein Königreich aufbauen, um das Burgfräulein zu beeindrucken.'), ' ', el('span', null, VN.t('Geöffnet wird er über die Aktion „🏰 Aufbau öffnen“, z. B. an einem Objekt im Hub.') + (c.key ? ' ' + VN.t('Taste') + ' ' + c.key.toUpperCase() + (VN.I18n && VN.I18n.lang === 'de' ? ' geht auch.' : '') : ''))));
    const iss = ID().issues();
    if (iss.length) body.appendChild(Help.sysBox(iss));
    if (!c.buildings.length && !c.milestones.length) {
      body.appendChild(el('div', { class: 'hint-box' }, 'Noch leer. Das Beispiel „Königreich“ legt Holz und Stein als Rohstoffe an, fünf Gebäude (Holzfällerhütte bis Burg) und drei Ziele – alles änderbar.',
        el('div', { class: 'row gap8', style: { marginTop: '8px' } }, el('button', { class: 'btn primary', onclick: () => { VN.ui.idTab = 'buildings'; ID().example(); } }, 'Beispiel: Königreich'), el('button', { class: 'btn', onclick: () => VN.mutate(() => { const b = ID().newBuilding(); c.buildings.push(b); VN.ui.idTab = 'buildings'; VN.ui.idSel = b.id; }) }, 'Leer beginnen'))));
      return;
    }
    const tab = VN.ui.idTab || 'buildings';
    const nav = el('div', { class: 'row gap4', style: { flexWrap: 'wrap', alignItems: 'center' } });
    for (const [k, l] of [['buildings', 'Gebäude'], ['goals', 'Ziele'], ['view', 'Ansicht & Berater'], ['settings', 'Einstellungen']]) nav.appendChild(el('button', { class: 'btn tiny' + (tab === k ? ' primary' : ''), onclick: () => { VN.ui.idTab = k; VN.ui.idSel = null; VN.render(); } }, l));
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
    else if (tab === 'view') viewTab(body);
    else settingsView(body);
  };

  // ---------- Ansicht & Berater (0.9.27) ----------
  const LAYOUTS = [
    ['cards', '🗂', 'Karten', 'Gebäude als Karten, Ziele rechts (wie bisher).'],
    ['list', '📊', 'Liste', 'Eine Zeile pro Gebäude mit Arbeits-Balken und Kaufen ×1 / ×10 / Max – wie AdVenture Capitalist.'],
    ['clicker', '🍪', 'Klicker', 'Großes Objekt zum Klicken, daneben ein Laden – wie Cookie Clicker.'],
    ['map', '🗺', 'Karte / Dorf', 'Gebäude frei auf einem Hintergrundbild; Anklicken öffnet den Ausbau.']
  ];
  const WHEN = [['first', 'beim allerersten Öffnen'], ['open', 'beim Öffnen'], ['buy', 'nach dem Bauen'], ['poor', 'wenn das Geld fehlt'], ['milestone', 'wenn ein Ziel erreicht ist'], ['random', 'zwischendurch']];
  const viewTab = (body) => {
    const c = ID().cfg(), V = ID().view();
    const asset = (kind, v, fn) => { const s2 = VN.assetSelect(kind, v, (x) => VN.mutate(() => fn(x))); s2.style.maxWidth = '200px'; return s2; };
    // Layout
    body.appendChild(sec('Layout', el('div', { class: 'id-lay-pick' }, ...LAYOUTS.map(([k, ic, l, d]) => el('div', { class: 'id-lay' + (V.layout === k ? ' on' : ''), onclick: () => VN.mutate(() => { V.layout = k; }) }, el('div', { class: 'id-lay-ic' }, ic), el('strong', null, VN.t(l)), el('span', { class: 'muted small' }, VN.t(d))))),
      el('div', { class: 'row gap8', style: { flexWrap: 'wrap', marginTop: '8px' } },
        check(V.full, 'Vollbild (ganzer Bildschirm statt Fenster)', (v) => { V.full = v; }),
        V.layout === 'list' ? check(V.multi !== false, 'Knöpfe ×10 und Max', (v) => { V.multi = v; }) : null,
        el('button', { class: 'btn tiny primary', onclick: () => window.Player && Player.tryIdle && Player.tryIdle() }, '▶ ' + VN.t('Ausprobieren')))));
    if (V.layout === 'clicker') {
      const k = V.clicker;
      body.appendChild(sec('Klick-Objekt',
        el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
          field('Bild', asset('image', k.image, (v) => { k.image = v; })),
          field('oder Symbol', txt(k.icon, (v) => { k.icon = v; }, { width: '60px' })),
          field('Bringt', sel(k.cur || '', [['', '— erste Währung —'], ...curOpts().slice(1)], (v) => { k.cur = v; })),
          field('pro Klick', num(k.amount, (v) => { k.amount = Math.max(1, v || 1); })),
          field('Text darunter', txt(k.label, (v) => { k.label = v; }, { width: '200px' }, VN.t('z. B. Klick die Münze!')))),
        el('div', { class: 'muted small' }, VN.t('Die Fähigkeit „Mehr pro Klick“ wirkt auch hier. Die Gebäude erscheinen rechts im Laden.'))));
    }
    if (V.layout === 'map') {
      const bg = V.mapBg && VN.assetUrl(V.mapBg);
      const area = el('div', { class: 'id-map-ed', style: bg ? { backgroundImage: `url("${bg}")` } : null });
      c.buildings.forEach((b, i) => {
        const x = b.mx != null ? b.mx : 12 + (i % 5) * 18, y = b.my != null ? b.my : 25 + Math.floor(i / 5) * 28, w = b.ms || 13;
        const url = b.image && VN.assetUrl(b.image);
        const n = el('div', { class: 'id-mb-ed' + (VN.ui.idMapSel === b.id ? ' sel' : ''), title: b.name, style: { left: x + '%', top: y + '%', width: w + '%', backgroundImage: url ? `url("${url}")` : '' } }, url ? null : b.icon || '🏠', el('span', null, b.name));
        n.addEventListener('mousedown', (e) => {
          e.preventDefault();
          VN.ui.idMapSel = b.id;
          const R = area.getBoundingClientRect();
          VN.drag(e, (dx, dy) => { n.style.left = Math.max(0, Math.min(100, x + dx / R.width * 100)) + '%'; n.style.top = Math.max(0, Math.min(100, y + dy / R.height * 100)) + '%'; },
            (dx, dy, moved) => { if (!moved) { VN.render(); return; } VN.mutate(() => { b.mx = Math.round(Math.max(0, Math.min(100, x + dx / R.width * 100)) * 10) / 10; b.my = Math.round(Math.max(0, Math.min(100, y + dy / R.height * 100)) * 10) / 10; }); });
        });
        area.appendChild(n);
      });
      const selB = c.buildings.find((b) => b.id === VN.ui.idMapSel);
      body.appendChild(sec('Karte',
        el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } }, field('Hintergrundbild', asset('image', V.mapBg, (v) => { V.mapBg = v; })),
          selB ? field(VN.t('Größe') + ': ' + selB.name, el('input', { type: 'range', min: 4, max: 40, value: selB.ms || 13, onchange: (e) => VN.mutate(() => { selB.ms = Number(e.target.value); }) })) : null),
        el('div', { class: 'muted small' }, VN.t('Gebäude auf dem Bild an ihren Platz ziehen. Ein Gebäude anklicken, dann lässt sich seine Größe einstellen. Am schönsten mit Gebäudebildern mit durchsichtigem Hintergrund.')),
        area));
    }
    // Berater
    const A = V.adv;
    const advSec = sec('Berater (Figur mit Dialog)',
      check(A.on, 'Berater zeigen', (v) => {
        A.on = v;
        if (v && !A.lines.length) A.lines.push(
          { id: VN.uid('ia'), when: 'first', text: VN.t('Willkommen! Bau zuerst etwas, das Rohstoffe bringt – dann läuft alles von selbst.'), once: true, conds: [] },
          { id: VN.uid('ia'), when: 'poor', text: VN.t('Dafür reicht es noch nicht. Warte kurz, die Gebäude arbeiten weiter.'), conds: [] },
          { id: VN.uid('ia'), when: 'buy', text: VN.t('Sehr gut! Das wird sich lohnen.'), conds: [] },
          { id: VN.uid('ia'), when: 'milestone', text: VN.t('Geschafft! Auf zum nächsten Ziel.'), conds: [] });
      }),
      el('div', { class: 'muted small' }, VN.t('Eine Figur in einem kleinen Fenster gibt Tipps und kommentiert, was passiert – wie der Berater in vielen Aufbau-Spielen.')));
    if (A.on) {
      advSec.append(
        el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
          field('Bild der Figur', asset('image', A.image, (v) => { A.image = v; })),
          field('Name', txt(A.name, (v) => { A.name = v; }, { width: '140px' })),
          field('Seite', sel(A.side, [['left', 'links'], ['right', 'rechts']], (v) => { A.side = v; })),
          field('„Zwischendurch“ alle … Sek.', num(A.every, (v) => { A.every = Math.max(10, v || 45); }))));
      const rows = el('div', { class: 'id-adv-lines' });
      A.lines.forEach((l, i) => rows.appendChild(el('div', { class: 'logic-row' },
        sel(l.when || 'random', WHEN, (v) => { l.when = v; }, { width: '190px' }),
        txt(l.text, (v) => { l.text = v; }, { flex: '1', minWidth: '200px' }, VN.t('Was die Figur sagt')),
        check(l.once, 'nur einmal', (v) => { l.once = v; }),
        el('button', { class: 'btn tiny' + ((l.conds || []).length ? ' primary' : ''), title: VN.t('Nur sagen, wenn …'), onclick: () => VN.popupEdit(VN.t('Nur sagen, wenn …'), (cd) => cd.appendChild(VN.condEditor(l.conds = l.conds || [], VN.t('Nur wenn')))) }, '🔒' + ((l.conds || []).length || '')),
        el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { A.lines.splice(i, 1); }) }, '×'))));
      advSec.append(rows, el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { A.lines.push({ id: VN.uid('ia'), when: 'random', text: '', conds: [] }); }) }, '+ ' + VN.t('Satz')));
    }
    body.appendChild(advSec);
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
