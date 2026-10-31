// Ausrüstung: Gegenstände (Kleidung, Werkzeuge, Schmuck …) an Plätzen tragen.
// Spielsystem „Ausrüstung“ – Plätze frei festlegbar, Gegenstand bekommt einen Platz.
// Bedingung „trägt …“, Aktionen „anlegen“ / „ablegen“. Im Inventar: Knopf „Ausrüsten“.
(function () {
  const { el } = VN;
  const EQ = (VN.Equip = {});
  const P = () => VN.project;

  EQ.cfg = () => P().equip;
  EQ.on = () => !!(P() && P().equip && P().equip.enabled);
  EQ.slots = () => EQ.cfg().slots || [];
  EQ.slot = (id) => EQ.slots().find((s) => s.id === id) || null;
  EQ.item = (id) => P().items.find((x) => x.id === id) || null;
  EQ.state = (rs) => (rs.equip = rs.equip || {});

  // Wer trägt was? Nur, was noch im Inventar ist, zählt (abgegebene Sachen fallen von selbst weg)
  EQ.inSlot = (rs, slotId) => { const id = EQ.state(rs)[slotId]; return id && (rs.inv[id] || 0) > 0 ? id : null; };
  EQ.worn = (rs, itemId) => { const it = EQ.item(itemId); return !!(it && it.slot && EQ.inSlot(rs, it.slot) === itemId); };
  EQ.wear = (rs, itemId) => {
    const it = EQ.item(itemId);
    if (!it || !it.slot || !EQ.slot(it.slot) || !((rs.inv[itemId] || 0) > 0)) return false;
    const prev = EQ.inSlot(rs, it.slot);
    if (prev === itemId) return true;
    if (prev) EQ.takeOff(rs, it.slot);
    EQ.state(rs)[it.slot] = itemId;
    VN.did(rs, 'equip', itemId);
    EQ.fire(rs, it, 'wear');
    if (window.VNPlugin && Object.keys(VNPlugin.plugins).length) setTimeout(() => VNPlugin.hook('onEquip', itemId, it.slot, VNPlugin.makeCtx(rs)), 0);
    return true;
  };
  EQ.takeOff = (rs, slotId) => {
    const st = EQ.state(rs);
    const had = st[slotId];
    delete st[slotId];
    if (had) { const it = EQ.item(had); if (it) EQ.fire(rs, it, 'remove'); }
    return !!had;
  };
  // Aktionen beim Anziehen / Ablegen („Verkleidet – jetzt darf ich ins Labor“). Auf Wunsch nur beim ersten Mal.
  EQ.fire = (rs, it, kind) => {
    const list = kind === 'wear' ? it.wearActs : it.removeActs;
    if (!(list || []).length) return;
    rs.eqFired = rs.eqFired || {};
    const k = kind + ':' + it.id;
    if (kind === 'wear' && it.wearOnce && rs.eqFired[k]) return;
    rs.eqFired[k] = (rs.eqFired[k] || 0) + 1;
    if (window.Player && Player.running && Player.state && Player.state.rs === rs) Player.runActions(list, 'eq:' + k);
    else VN.applyActions(list, rs, 'eq:' + k);
  };
  // Boni solange getragen: gleiche Wirkungen wie bei Skilltrees (z. B. mehr ♥ bei einer Figur, mehr Geld, Kampfwerte)
  EQ.EFFECTS = () => {
    const all = (VN.Skills && VN.Skills.effectsAll) ? VN.Skills.effectsAll() : {};
    const out = {};
    for (const [k, d] of Object.entries(all)) if (d.key && d.value && !d.once) out[k] = d;
    return out;
  };
  EQ.sum = (rs, key, sub) => {
    const res = { pct: 0, add: 0 };
    if (!rs || !EQ.on()) return res;
    const E = EQ.EFFECTS();
    for (const s of EQ.slots()) {
      const id = EQ.inSlot(rs, s.id);
      const it = id && EQ.item(id);
      if (!it) continue;
      for (const fx of it.wearFx || []) {
        const d = E[fx.eff];
        if (!d) continue;
        let k;
        try { k = d.key(fx); } catch (er) { continue; }
        if (k !== key && !(sub && k === key + ':' + sub)) continue;
        const v = Number(d.value(fx)) || 0;
        if (d.mode === 'add') res.add += v; else res.pct += v;
      }
    }
    return res;
  };

  // ---------- Projekt-Daten ----------
  const baseMig = VN.migrate;
  VN.migrate = (p) => {
    p = baseMig(p);
    p.equip = Object.assign({ enabled: false, slots: [] }, p.equip || {});
    if (!Array.isArray(p.equip.slots)) p.equip.slots = [];
    return p;
  };
  EQ.defaultSlots = () => [
    { id: VN.uid('sl'), name: VN.t('Kopf'), icon: '🎩' },
    { id: VN.uid('sl'), name: VN.t('Körper'), icon: '👕' },
    { id: VN.uid('sl'), name: VN.t('Hand'), icon: '🗡' },
    { id: VN.uid('sl'), name: VN.t('Schmuck'), icon: '💍' }
  ];

  // ---------- Bedingungen und Aktionen ----------
  const itemOpts = () => [['', '— Gegenstand —'], ...P().items.filter((it) => it.slot).map((it) => [it.id, it.name])];
  const slotOpts = () => [['', '— Platz —'], ...EQ.slots().map((s) => [s.id, (s.icon ? s.icon + ' ' : '') + s.name])];
  VN.registerCond('worn', {
    label: '👕 Trägt Gegenstand', on: EQ.on, make: () => ({ item: '', value: true }),
    check: (c, rs) => (c.value === false ? !EQ.worn(rs, c.item) : EQ.worn(rs, c.item)),
    text: (c) => { const it = EQ.item(c.item); return '👕 ' + (c.value === false ? 'trägt nicht: ' : 'trägt: ') + (it ? it.name : '?'); },
    problem: (c) => { const it = EQ.item(c.item); return !it ? 'Gegenstand fehlt' : !it.slot ? 'Gegenstand hat keinen Ausrüstungs-Platz' : null; },
    row: (row, c, sel) => {
      row.appendChild(sel(c.value === false ? 'no' : 'yes', [['yes', 'trägt'], ['no', 'trägt nicht']], (v) => VN.mutate(() => { c.value = v !== 'no'; })));
      row.appendChild(sel(c.item || '', itemOpts(), (v) => VN.mutate(() => { c.item = v; })));
    }
  });
  VN.registerCond('slotUsed', {
    label: '👕 Platz belegt', on: EQ.on, make: () => ({ slot: '', value: true }),
    check: (c, rs) => (c.value === false ? !EQ.inSlot(rs, c.slot) : !!EQ.inSlot(rs, c.slot)),
    text: (c) => { const s = EQ.slot(c.slot); return '👕 ' + (s ? s.name : '?') + (c.value === false ? ' frei' : ' belegt'); },
    problem: (c) => (EQ.slot(c.slot) ? null : 'Platz fehlt'),
    row: (row, c, sel) => {
      row.appendChild(sel(c.slot || '', slotOpts(), (v) => VN.mutate(() => { c.slot = v; })));
      row.appendChild(sel(c.value === false ? 'no' : 'yes', [['yes', 'belegt'], ['no', 'frei']], (v) => VN.mutate(() => { c.value = v !== 'no'; })));
    }
  });
  VN.registerAction('wear', {
    label: '👕 Gegenstand anlegen', on: EQ.on, make: () => ({ item: '', give: true }),
    apply: (a, rs, gains) => {
      const it = EQ.item(a.item);
      if (!it) return;
      if (a.give && !((rs.inv[it.id] || 0) > 0)) VN.giveItem(rs, it.id, 1);
      if (EQ.wear(rs, it.id) && gains) gains.push({ kind: 'text', text: '👕 ' + VN.tr(it.id + ':name', it.name) });
    },
    text: (a) => { const it = EQ.item(a.item); return '👕 ' + (it ? it.name : '?') + ' anlegen'; },
    problem: (a) => { const it = EQ.item(a.item); return !it ? 'Gegenstand fehlt' : !it.slot ? 'Gegenstand hat keinen Ausrüstungs-Platz' : null; },
    row: (row, a, sel) => {
      row.appendChild(sel(a.item || '', itemOpts(), (v) => VN.mutate(() => { a.item = v; })));
      row.appendChild(sel(a.give === false ? '0' : '1', [['1', 'notfalls geben'], ['0', 'nur wenn vorhanden']], (v) => VN.mutate(() => { a.give = v === '1'; })));
    }
  });
  VN.registerAction('unwear', {
    label: '👕 Platz ablegen', on: EQ.on, make: () => ({ slot: '' }),
    apply: (a, rs) => { if (a.slot === '*') EQ.state(rs) && (rs.equip = {}); else EQ.takeOff(rs, a.slot); },
    text: (a) => { const s = EQ.slot(a.slot); return '👕 ' + (a.slot === '*' ? 'Alles' : (s ? s.name : '?')) + ' ablegen'; },
    problem: (a) => (a.slot === '*' || EQ.slot(a.slot) ? null : 'Platz fehlt'),
    row: (row, a, sel) => row.appendChild(sel(a.slot || '', [...slotOpts(), ['*', '— alles —']], (v) => VN.mutate(() => { a.slot = v; })))
  });
  VN.registerAction('equipScreen', {
    label: '👕 Ausrüstung öffnen (Inventar)', on: EQ.on, make: () => ({}),
    apply: (a, rs, gains) => { if (window.Player && Player.openScreen && gains) gains.pending.push(() => Player.openScreen('inv')); },
    text: () => '👕 Ausrüstung öffnen', row: () => {}
  });

  // ---------- Prüfung ----------
  EQ.issues = () => {
    const out = [];
    if (!EQ.on()) return out;
    if (!EQ.slots().length) out.push({ text: VN.t('Ausrüstung: noch keine Plätze angelegt (z. B. Kopf, Körper, Hand)') });
    else if (!P().items.some((it) => it.slot)) out.push({ level: 'tip', text: VN.t('Ausrüstung: noch kein Gegenstand hat einen Platz – unter Gegenstände in der Spalte „Ausrüsten“ wählen') });
    for (const it of P().items) if (it.slot && !EQ.slot(it.slot)) out.push({ text: VN.tf('Gegenstand „{name}“: Ausrüstungs-Platz fehlt', { name: it.name }) });
    if (P().inventory.enabled === false) out.push({ text: VN.t('Ausrüstung braucht das Inventar (unter Übersicht einschalten)') });
    return out;
  };

  // ---------- Inventar: Ausrüstungs-Leiste und Knopf „Ausrüsten“ ----------
  // wird von Systems.inventoryEl aufgerufen
  EQ.bar = (rs, redraw, preview) => {
    if (!EQ.on() || !EQ.slots().length) return null;
    const bar = el('div', { class: 'eq-bar' });
    for (const s of EQ.slots()) {
      const id = EQ.inSlot(rs, s.id);
      const it = id && EQ.item(id);
      bar.appendChild(el('div', { class: 'eq-slot' + (it ? ' full' : ''), title: it ? VN.tr(it.id + ':name', it.name) + ' – ' + VN.tp('Klicken zum Ablegen') : VN.tr(s.id + ':name', s.name),
        onclick: (e) => { e.stopPropagation(); if (it && !preview) { EQ.takeOff(rs, s.id); if (window.Theme) Theme.sound('click'); redraw(); } } },
        it && it.image ? el('div', { class: 'eq-img', style: { backgroundImage: `url("${VN.assetUrl(it.image)}")` } }) : el('div', { class: 'eq-ico' }, it ? (it.name || '?').slice(0, 2) : (s.icon || '◻')),
        el('div', { class: 'eq-name' }, it ? VN.tr(it.id + ':name', it.name) : VN.tr(s.id + ':name', s.name))));
    }
    return el('div', { class: 'eq-wrap' }, el('div', { class: 'eq-title' }, VN.tr('ui:equip', EQ.cfg().title || VN.tp('Ausrüstung'))), bar);
  };
  EQ.button = (rs, it, redraw) => {
    if (!EQ.on() || !it || !it.slot || !EQ.slot(it.slot)) return null;
    const on = EQ.worn(rs, it.id);
    return el('button', { class: 'inv-act' + (on ? ' on' : ''), onclick: (e) => { e.stopPropagation(); if (on) EQ.takeOff(rs, it.slot); else EQ.wear(rs, it.id); if (window.Theme) Theme.sound('click'); redraw(); } },
      on ? VN.tp('Ablegen') : VN.tp('Ausrüsten') + ' (' + VN.tr(it.slot + ':name', EQ.slot(it.slot).name) + ')');
  };

  // ---------- Texte fürs Transkript ----------
  const baseTexts = VN.collectTexts;
  VN.collectTexts = () => {
    const out = baseTexts();
    if (!EQ.on()) return out;
    for (const s of EQ.slots()) out.push({ id: s.id + ':name', area: 'Ausrüstung', where: 'Platz', who: 'Platz', text: s.name || '', set: (v) => { s.name = v; } });
    if (EQ.cfg().title) out.push({ id: 'ui:equip', area: 'Ausrüstung', where: 'Titel', who: 'Titel', text: EQ.cfg().title, set: (v) => { EQ.cfg().title = v; } });
    return out;
  };
})();
