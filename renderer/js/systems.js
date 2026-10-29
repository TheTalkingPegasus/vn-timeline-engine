// Spielsysteme: Variablen, Gegenstände, Währungen, Loot-Tabellen, Inventar-Menü
(function () {
  const { el } = VN;

  const TABS = [
    ['overview', 'Übersicht'], ['vars', 'Variablen'], ['items', 'Gegenstände'], ['money', 'Währungen'], ['loot', 'Loot-Tabellen'], ['inv', 'Inventar-Menü'],
    ['time', 'Zeit'], ['shops', 'Läden'], ['rel', 'Beziehungen'], ['gifts', 'Geschenke'], ['quests', 'Quests'], ['world', 'Welt & Orte'], ['skills', 'Skilltrees'], ['combat', 'Kampf'], ['idle', 'Aufbau'], ['ach', 'Erfolge'], ['gallery', 'Galerie'], ['gloss', 'Glossar'], ['plugins', 'Plugins']
  ];
  // Reiter nur zeigen, wenn das System eingeschaltet ist
  const tabOn = (k) => {
    const p = VN.project;
    if (k === 'time') return !!(p.time && p.time.enabled);
    if (k === 'shops') return !!(p.economy && p.economy.enabled);
    if (k === 'rel') return !!(p.relations && p.relations.enabled);
    if (k === 'gifts') return !!(p.relations && p.relations.enabled && p.relations.gifts);
    if (k === 'inv') return p.inventory.enabled !== false;
    if (k === 'quests') return !!(p.quests && p.quests.enabled);
    if (k === 'world') return !!(p.world && p.world.enabled);
    if (k === 'skills') return !!(p.skills && p.skills.enabled);
    if (k === 'combat') return !!(p.combat && p.combat.enabled);
    if (k === 'idle') return !!(p.idle && p.idle.enabled);
    return true;
  };

  const txt = (value, commit, style) => el('input', { type: 'text', value: value || '', style: style || null, onchange: (e) => VN.mutate(() => commit(e.target.value)) });
  const num = (value, commit, style) => el('input', { type: 'number', value: value != null ? value : 0, style: style || { width: '80px' }, onchange: (e) => VN.mutate(() => commit(Number(e.target.value))) });
  const chk = (value, commit) => el('input', { type: 'checkbox', checked: !!value, onchange: (e) => VN.mutate(() => commit(e.target.checked)) });
  const sel = (value, options, commit) => {
    const s = el('select', { onchange: (e) => VN.mutate(() => commit(e.target.value)) });
    for (const [v, l] of options) { const o = el('option', { value: v }, l); if (String(v) === String(value)) o.selected = true; s.appendChild(o); }
    return s;
  };
  const imgSel = (value, commit) => {
    const wrap = el('div', { class: 'row gap4' });
    wrap.appendChild(el('div', { class: 'mini-thumb', style: { backgroundImage: value ? `url("${VN.assetUrl(value)}")` : 'none' } }));
    const s = VN.assetSelect('image', value, (v) => VN.mutate(() => commit(v)));
    s.style.maxWidth = '140px';
    wrap.appendChild(s);
    return wrap;
  };
  // Kategorien für Gegenstände: feste Liste im Inventar-Menü + alle, die an Gegenständen stehen
  VN.itemCats = () => {
    const p = VN.project;
    const out = (p.inventory.cats || []).slice();
    for (const it of p.items) if (it.cat && !out.includes(it.cat)) out.push(it.cat);
    return out;
  };
  const catSel = (it) => {
    const s = el('select', { onchange: async (e) => {
      let v = e.target.value;
      if (v === '__new') {
        v = await VN.prompt('Neue Kategorie', '');
        if (!v) { VN.render(); return; }
      }
      VN.mutate(() => {
        const inv = VN.project.inventory;
        inv.cats = VN.itemCats();
        if (v && !inv.cats.includes(v)) inv.cats.push(v);
        it.cat = v;
      });
    } });
    for (const [v, l] of [['', '— keine —'], ...VN.itemCats().map((c) => [c, c]), ['__new', '+ Neue Kategorie …']]) { const o = el('option', { value: v }, l); if (v === (it.cat || '')) o.selected = true; s.appendChild(o); }
    return s;
  };
  const del = (fn) => el('button', { class: 'btn tiny danger', title: 'Löschen', onclick: () => VN.mutate(fn) }, '×');
  const table = (cols, head, rows) => el('div', { class: 'sys-table' },
    el('div', { class: 'sys-row head', style: { gridTemplateColumns: cols } }, ...head.map((h) => el('span', null, h))),
    ...rows.map((r) => el('div', { class: 'sys-row', style: { gridTemplateColumns: cols } }, ...r)));

  const Systems = (window.Systems = {
    render(root) {
      root.innerHTML = '';
      let tab = VN.ui.sysTab || 'overview';
      if (!tabOn(tab)) tab = 'overview';
      const nav = el('div', { class: 'seg sys-nav' });
      const plTabs = window.VNPlugin ? VNPlugin.tabs() : [];
      if (tab.startsWith('pl:') && !plTabs.some((x) => x[0] === tab)) tab = 'overview';
      for (const [k, l] of [...TABS.filter(([k]) => tabOn(k) && k !== 'gloss' && k !== 'plugins'), ...plTabs.map((x) => [x[0], x[1]]), ...TABS.filter(([k]) => k === 'gloss' || k === 'plugins')]) nav.appendChild(el('button', { class: tab === k ? 'active' : '', onclick: () => { VN.ui.sysTab = k; VN.render(); } }, l));
      root.appendChild(el('div', { class: 'view-head' }, el('strong', { style: { fontSize: '15px' } }, 'Spielsysteme'), el('div', { style: { flex: '1' } }), nav));
      const body = el('div', { class: 'sys-body' });
      root.appendChild(body);
      const L = VN.Life || {};
      const pt = plTabs.find((x) => x[0] === tab);
      if (pt) { try { pt[2].editorTab.render(body); } catch (e) { body.appendChild(el('div', { class: 'hint-box' }, 'Fehler im Plugin: ' + e.message)); console.error(e); } return; }
      ({ overview: L.overview, time: L.timeTab, shops: L.shopsTab, rel: L.relTab, gifts: L.giftsTab, vars: Systems.vars, items: Systems.items, money: Systems.money, loot: Systems.loot, inv: Systems.inv, gloss: Systems.gloss, plugins: VNPlugin.editorPanel, ach: Systems.achTab, gallery: Systems.galleryTab, quests: Systems.questsTab, world: Systems.worldTab, skills: Systems.skillsTab, combat: Systems.combatTab, idle: Systems.idleTab })[tab](body);
    },

    gloss(body) {
      const p = VN.project;
      body.appendChild(el('p', { class: 'muted' }, 'Begriffe aus deinem Spiel (Orte, Personen, Fachwörter). Taucht ein Begriff in einem Dialog auf, wird er unterstrichen und lässt sich anklicken. Gefundene Einträge sammelt der Spieler im Pausenmenü unter „Glossar“.'));
      body.appendChild(table('130px 1fr 1fr 2.4fr 40px', ['Bild', 'Begriff', 'Andere Schreibweisen', 'Erklärung', ''], p.glossary.map((g) => [
        (() => { const s = VN.assetSelect('image', g.image, (v) => VN.mutate(() => { g.image = v; })); return s; })(),
        txt(g.term, (x) => { g.term = x; }),
        txt(g.alt, (x) => { g.alt = x; }),
        txt(g.text, (x) => { g.text = x; }),
        del(() => { p.glossary = p.glossary.filter((x) => x !== g); })
      ])));
      body.appendChild(el('div', { class: 'row gap8' },
        el('button', { class: 'btn', onclick: () => VN.mutate(() => { p.glossary.push({ id: VN.uid('gl'), term: 'Neuer Begriff', alt: '', text: VN.t('Erklärung …'), image: null }); }) }, '+ Begriff'),
        el('span', { class: 'muted small' }, 'Andere Schreibweisen mit Komma trennen, z. B. „Gilde, Diebesgilde“. Begriffe und Erklärungen erscheinen im Transkript zum Übersetzen.')));
    },

    vars(body) {
      const p = VN.project;
      body.appendChild(el('p', { class: 'muted' }, 'Variablen merken sich, was im Spiel passiert ist: Zahlen (z. B. Vertrauen) oder Schalter (z. B. „Tür geöffnet“). Ändern lassen sie sich mit Aktionen, prüfen mit Bedingungen.'));
      body.appendChild(table('1.4fr 120px 110px 2fr 40px', ['Name', 'Typ', 'Startwert', 'Notiz', ''], p.vars.map((v) => [
        txt(v.name, (x) => { v.name = x || 'Variable'; }),
        sel(v.type || 'number', [['number', 'Zahl'], ['flag', 'Schalter']], (x) => { v.type = x; v.start = x === 'flag' ? false : 0; }),
        v.type === 'flag' ? sel(String(!!v.start), [['false', 'aus'], ['true', 'an']], (x) => { v.start = x === 'true'; }) : num(v.start, (x) => { v.start = x; }),
        txt(v.note, (x) => { v.note = x; }),
        del(() => { p.vars = p.vars.filter((x) => x !== v); })
      ])));
      body.appendChild(el('div', { class: 'row gap8' },
        el('button', { class: 'btn', onclick: () => VN.mutate(() => { p.vars.push({ id: VN.uid('v'), name: VN.t('Neue Zahl'), type: 'number', start: 0, note: '' }); }) }, '+ Zahl'),
        el('button', { class: 'btn', onclick: () => VN.mutate(() => { p.vars.push({ id: VN.uid('v'), name: VN.t('Neuer Schalter'), type: 'flag', start: false, note: '' }); }) }, '+ Schalter')));
      if (Systems.statsCard) body.appendChild(Systems.statsCard());
    },

    items(body) {
      const p = VN.project;
      body.appendChild(el('p', { class: 'muted' }, 'Alle Gegenstände des Spiels. Namen und Beschreibungen erscheinen automatisch im Transkript. Vergeben werden sie über Aktionen oder Loot-Tabellen.'));
      body.appendChild(table('150px minmax(110px, 1.2fr) 130px 64px 60px 60px 1.3fr 88px 36px', ['Bild', 'Name', 'Kategorie', 'Stapelbar', 'Max', 'Wert', 'Beschreibung', '', ''], p.items.map((it) => [
        imgSel(it.image, (v) => { it.image = v; }),
        txt(it.name, (x) => { it.name = x || 'Gegenstand'; }),
        catSel(it),
        chk(it.stack, (x) => { it.stack = x; }),
        num(it.max, (x) => { it.max = x; }, { width: '60px' }),
        num(it.value, (x) => { it.value = x; }, { width: '60px' }),
        txt(it.desc, (x) => { it.desc = x; }),
        el('button', { class: 'btn tiny' + (it.use && (it.use.actions || []).length ? ' primary' : ''), title: 'Was passiert beim Benutzen?', onclick: () => Systems.useModal && Systems.useModal(it) }, 'Benutzen …'),
        del(() => { p.items = p.items.filter((x) => x !== it); })
      ])));
      body.appendChild(el('button', { class: 'btn', onclick: () => VN.mutate(() => { p.items.push({ id: VN.uid('it'), name: VN.t('Neuer Gegenstand'), cat: VN.itemCats()[0] || '', stack: true, max: 10, value: 10, desc: '', image: null }); }) }, '+ Gegenstand'));
      if (Systems.combosCard) body.appendChild(Systems.combosCard());
    },

    money(body) {
      const p = VN.project;
      body.appendChild(el('p', { class: 'muted' }, 'Währungen wie Gold oder Edelsteine. Ändern mit der Aktion „Geld + / −“, prüfen mit der Bedingung „Geld“.'));
      body.appendChild(table('190px 1.2fr 80px 110px 110px 40px', ['Symbol', 'Name', 'Farbe', 'Startwert', 'Höchstwert', ''], p.currencies.map((c) => [
        imgSel(c.image, (v) => { c.image = v; }),
        txt(c.name, (x) => { c.name = x || 'Währung'; }),
        el('input', { type: 'color', value: c.color || '#e8c86a', onchange: (e) => VN.mutate(() => { c.color = e.target.value; }) }),
        num(c.start, (x) => { c.start = x; }),
        num(c.max, (x) => { c.max = x; }),
        del(() => { p.currencies = p.currencies.filter((x) => x !== c); })
      ])));
      body.appendChild(el('button', { class: 'btn', onclick: () => VN.mutate(() => { p.currencies.push({ id: VN.uid('cur'), name: p.currencies.length ? 'Edelsteine' : 'Gold', color: p.currencies.length ? '#6ad0c8' : '#e8c86a', start: 0, max: 99999, image: null }); }) }, '+ Währung'));
    },

    loot(body) {
      const p = VN.project;
      const t = p.lootTables.find((x) => x.id === VN.ui.lootSel) || p.lootTables[0];
      const wrap = el('div', { class: 'loot-wrap' });
      const list = el('div', { class: 'loot-list' });
      for (const lt of p.lootTables) {
        list.appendChild(el('div', { class: 'list-item' + (t === lt ? ' active' : ''), onclick: () => { VN.ui.lootSel = lt.id; VN.render(); } },
          el('span', { class: 'dot', style: { background: '#e8a43a' } }), el('span', { class: 'name' }, lt.name)));
      }
      list.appendChild(el('button', { class: 'btn', style: { marginTop: '6px' }, onclick: () => VN.mutate(() => { const n = { id: VN.uid('lt'), name: VN.t('Neue Loot-Tabelle'), mode: 'seed', maxDraws: 2, once: true, entries: [] }; p.lootTables.push(n); VN.ui.lootSel = n.id; }) }, '+ Loot-Tabelle'));
      wrap.appendChild(list);
      const ed = el('div', { class: 'loot-ed' });
      wrap.appendChild(ed);
      body.appendChild(wrap);
      if (!t) { ed.appendChild(el('div', { class: 'hint-box' }, 'Lege links eine Loot-Tabelle an. Benutzt wird sie über die Aktion „Loot-Tabelle würfeln“, z. B. an einer Truhe im Hub.')); return; }

      ed.appendChild(el('div', { class: 'row gap8' }, el('div', { class: 'field', style: { flex: '1' } }, el('div', { class: 'lbl' }, 'Name'), txt(t.name, (x) => { t.name = x || 'Loot'; })),
        el('button', { class: 'btn danger', style: { alignSelf: 'flex-end' }, onclick: () => VN.mutate(() => { p.lootTables = p.lootTables.filter((x) => x !== t); VN.ui.lootSel = null; }) }, 'Tabelle löschen')));

      const modes = [['real', 'Echter Zufall'], ['seed', 'Fest pro Spielstand'], ['fixed', 'Fest für alle Spieler']];
      const modeText = {
        real: 'Jedes Öffnen würfelt neu. Wer vorher speichert und zurücklädt, kann bessere Beute erzwingen.',
        seed: 'Das Ergebnis wird aus dem Seed des Durchlaufs und der ID der Quelle berechnet. Zurückladen bringt dieselbe Beute, ein neues Spiel neue.',
        fixed: 'Alle Spieler bekommen aus dieser Quelle dieselbe Beute. Gut für Story-wichtige Kisten.'
      };
      const seg = el('div', { class: 'seg' });
      for (const [k, l] of modes) seg.appendChild(el('button', { class: (t.mode || 'seed') === k ? 'active' : '', onclick: () => VN.mutate(() => { t.mode = k; }) }, l));
      ed.appendChild(el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Zufallsmodus'), seg, el('div', { class: 'hint-box' }, modeText[t.mode || 'seed'])));
      ed.appendChild(el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
        el('label', { class: 'check' }, 'Max. zufällige Ziehungen', num(t.maxDraws != null ? t.maxDraws : 2, (x) => { t.maxDraws = Math.max(0, x); }, { width: '60px' })),
        el('label', { class: 'check' }, chk(t.once !== false, (x) => { t.once = x; }), 'Pro Quelle nur einmal (danach leer)')));

      const refOpts = (e) => e.kind === 'money' ? p.currencies.map((c) => [c.id, c.name]) : p.items.map((i) => [i.id, i.name]);
      ed.appendChild(table('130px minmax(0, 1.4fr) 70px 70px minmax(0, 1.2fr) 90px 40px', ['Art', 'Beute', 'Min', 'Max', 'Chance', 'Garantiert', ''], (t.entries || []).map((e) => {
        const lab = el('span', { class: 'small', style: { width: '38px', textAlign: 'right' } }, (e.chance || 0) + ' %');
        return [
          sel(e.kind, [['item', 'Gegenstand'], ['money', 'Geld']], (x) => { e.kind = x; e.ref = (x === 'money' ? p.currencies[0] : p.items[0] || {}).id || ''; }),
          sel(e.ref || '', [['', '— wählen —'], ...refOpts(e)], (x) => { e.ref = x; }),
          num(e.min, (x) => { e.min = x; }, { width: '56px' }),
          num(e.max, (x) => { e.max = x; }, { width: '56px' }),
          e.guaranteed ? el('span', { class: 'muted small' }, 'immer') : el('div', { class: 'row gap4' },
            el('input', { type: 'range', min: 0, max: 100, value: e.chance || 0, style: { flex: '1', accentColor: 'var(--accent)' }, oninput: (ev) => { lab.textContent = ev.target.value + ' %'; }, onchange: (ev) => VN.mutate(() => { e.chance = Number(ev.target.value); }) }), lab),
          chk(e.guaranteed, (x) => { e.guaranteed = x; }),
          del(() => { t.entries = t.entries.filter((x) => x !== e); })
        ];
      })));
      ed.appendChild(el('div', { class: 'row gap8' },
        el('button', { class: 'btn', onclick: () => VN.mutate(() => { t.entries.push({ kind: 'item', ref: p.items[0] ? p.items[0].id : '', min: 1, max: 1, chance: 30, guaranteed: false, conds: [] }); }) }, '+ Gegenstand'),
        el('button', { class: 'btn', onclick: () => VN.mutate(() => { t.entries.push({ kind: 'money', ref: p.currencies[0] ? p.currencies[0].id : '', min: 10, max: 40, chance: 100, guaranteed: true, conds: [] }); }) }, '+ Geld')));
      if (!p.items.length && !p.currencies.length) ed.appendChild(el('div', { class: 'muted small' }, 'Lege zuerst Gegenstände oder Währungen an.'));

      // Balance-Test
      const out = el('div', { class: 'test-out' });
      const runTest = () => {
        out.innerHTML = '';
        const N = 100;
        const sum = {};
        for (let i = 0; i < N; i++) {
          const rs = VN.newRunState();
          rs.seed = Math.floor(Math.random() * 1e9);
          for (const g of VN.rollLoot(Object.assign({}, t, { mode: t.mode === 'fixed' ? 'seed' : t.mode }), 'test', rs)) {
            const k = g.kind + ':' + g.id;
            sum[k] = sum[k] || { g, hits: 0, total: 0 };
            sum[k].hits++;
            sum[k].total += g.count;
          }
        }
        if (!Object.keys(sum).length) out.appendChild(el('div', { class: 'muted' }, 'In 100 Spielständen wurde nichts gefunden.'));
        for (const { g, hits, total } of Object.values(sum)) {
          out.appendChild(el('div', { class: 'test-row' },
            el('span', null, VN.lootName({ kind: g.kind, id: g.id, count: 1 }).replace(/^1 /, '')),
            el('span', { class: 'bar' }, el('span', { style: { width: hits + '%' } })),
            el('span', { class: 'muted small' }, hits + ' von 100 · Ø ' + (total / hits).toFixed(1))));
        }
      };
      const one = el('div', { class: 'muted small' });
      ed.appendChild(el('div', { class: 'opt-card' },
        el('div', { class: 'row gap8' }, el('strong', { style: { flex: '1' } }, 'Balance-Test'),
          el('button', { class: 'btn tiny', onclick: () => {
            const rs = VN.newRunState();
            const got = VN.rollLoot(t, 'test', rs);
            one.textContent = 'Seed ' + rs.seed + ': ' + (got.length ? got.map(VN.lootName).join(', ') : 'nichts');
          } }, 'Seed neu würfeln'),
          el('button', { class: 'btn tiny primary', onclick: runTest }, '100× würfeln')),
        one, out));
    },

    inv(body) {
      const p = VN.project;
      const s = p.inventory;
      const wrap = el('div', { class: 'loot-wrap' });
      const left = el('div', { class: 'loot-ed', style: { maxWidth: '340px' } },
        el('label', { class: 'check' }, chk(s.enabled !== false, (x) => { s.enabled = x; }), 'Inventar im Spiel anbieten (Taste I)'),
        el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Titel'), txt(s.title, (x) => { s.title = x; })),
        el('div', { class: 'grid2' },
          el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Spalten'), num(s.cols, (x) => { s.cols = Math.max(1, Math.min(12, x)); })),
          el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Zeilen'), num(s.rows, (x) => { s.rows = Math.max(1, Math.min(10, x)); }))),
        el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Hintergrund (Platzhalter, wenn leer)'), imgSel(s.bg, (v) => { s.bg = v; })),
        el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Slot-Grafik (Platzhalter, wenn leer)'), imgSel(s.slot, (v) => { s.slot = v; })),
        Systems.catEditor(),
        el('label', { class: 'check' }, chk(s.showMoney !== false, (x) => { s.showMoney = x; }), 'Geld im Inventar anzeigen'),
        el('label', { class: 'check' }, chk(s.hudMoney, (x) => { s.hudMoney = x; }), 'Geld dauerhaft oben im Spiel anzeigen'),
        el('div', { class: 'hint-box' }, 'Rechts siehst du die Vorschau mit Beispiel-Gegenständen. Im Spiel öffnet es sich über den Knopf oben oder mit der Taste I.'));
      const prev = el('div', { class: 'inv-preview' });
      const rs = VN.newRunState();
      p.items.slice(0, 8).forEach((it, i) => { rs.inv[it.id] = it.stack ? Math.min(Number(it.max) || 3, i + 1) : 1; });
      for (const c of p.currencies) rs.money[c.id] = Math.max(rs.money[c.id], 120);
      prev.appendChild(Systems.inventoryEl(rs, { preview: true }));
      wrap.append(left, prev);
      body.appendChild(wrap);
    },

    // Kategorien verwalten: umbenennen (ändert alle Gegenstände mit), sortieren, löschen
    catEditor() {
      const p = VN.project;
      const box = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Kategorien (Reiter im Inventar und in Läden)'));
      const cats = VN.itemCats();
      const save = (list) => { p.inventory.cats = list; };
      cats.forEach((c, i) => {
        const n = p.items.filter((it) => it.cat === c).length;
        box.appendChild(el('div', { class: 'logic-row' },
          el('input', { type: 'text', value: c, style: { flex: '1' }, onchange: (e) => VN.mutate(() => {
            const v = e.target.value.trim(); if (!v || v === c) return;
            const list = VN.itemCats(); list[i] = v; save(Array.from(new Set(list)));
            for (const it of p.items) if (it.cat === c) it.cat = v;
          }) }),
          el('span', { class: 'muted small', style: { width: '58px' } }, n + (n === 1 ? ' Ding' : ' Dinge')),
          el('button', { class: 'btn tiny', disabled: i === 0, title: 'Nach oben', onclick: () => VN.mutate(() => { const l = VN.itemCats(); [l[i - 1], l[i]] = [l[i], l[i - 1]]; save(l); }) }, '↑'),
          el('button', { class: 'btn tiny', disabled: i === cats.length - 1, title: 'Nach unten', onclick: () => VN.mutate(() => { const l = VN.itemCats(); [l[i + 1], l[i]] = [l[i], l[i + 1]]; save(l); }) }, '↓'),
          el('button', { class: 'btn tiny danger', title: 'Löschen (Gegenstände bleiben, ohne Kategorie)', onclick: () => VN.mutate(() => { save(VN.itemCats().filter((x) => x !== c)); for (const it of p.items) if (it.cat === c) it.cat = ''; }) }, '×')));
      });
      box.appendChild(el('div', { class: 'row gap8' },
        el('button', { class: 'btn tiny', onclick: async () => { const v = await VN.prompt('Neue Kategorie', ''); if (v) VN.mutate(() => { save(Array.from(new Set([...VN.itemCats(), v]))); }); } }, '+ Kategorie'),
        el('label', { class: 'check small' }, chk(p.inventory.allTab !== false, (x) => { p.inventory.allTab = x; }), 'Reiter „Alle“ zeigen')));
      return box;
    },

    // Inventar-Menü (auch im Player benutzt)
    inventoryEl(rs, opts = {}) {
      const p = VN.project;
      const s = p.inventory;
      const box = el('div', { class: 'inv-box' });
      if (s.bg) box.style.backgroundImage = `url("${VN.assetUrl(s.bg)}")`;
      else box.classList.add('ph-bg');
      const used = VN.itemCats().filter((c) => p.items.some((i) => i.cat === c));
      const cats = s.allTab === false && used.length ? used : ['Alle', ...used];
      let cat = cats[0];
      let selected = null, combining = null, note = '';
      const slotsEl = el('div', { class: 'inv-grid', style: { gridTemplateColumns: `repeat(${s.cols || 6}, minmax(0, 1fr))` } });
      const detail = el('div', { class: 'inv-detail' });
      const tabs = el('div', { class: 'inv-tabs' });
      const money = el('div', { class: 'inv-money' });

      const entries = () => {
        const out = [];
        for (const it of p.items) {
          const n = rs.inv[it.id] || 0;
          if (!n || (cat !== 'Alle' && it.cat !== cat)) continue;
          if (it.stack) out.push({ it, n }); else for (let i = 0; i < n; i++) out.push({ it, n: 1 });
        }
        return out;
      };
      const draw = () => {
        tabs.innerHTML = '';
        for (const c of cats) tabs.appendChild(el('button', { class: 'inv-tab' + (c === cat ? ' active' : ''), onclick: (e) => { e.stopPropagation(); cat = c; draw(); } }, c === 'Alle' ? VN.tr('ui:allTab', 'Alle') : VN.tr('invcat:' + c, c)));
        slotsEl.innerHTML = '';
        const list = entries();
        const total = Math.max((s.cols || 6) * (s.rows || 4), list.length);
        for (let i = 0; i < total; i++) {
          const e = list[i];
          const slot = el('div', { class: 'inv-slot' + (e && selected === e.it ? ' sel' : '') + (s.slot ? '' : ' ph') });
          if (s.slot) slot.style.backgroundImage = `url("${VN.assetUrl(s.slot)}")`;
          if (e) {
            slot.appendChild(e.it.image ? el('div', { class: 'inv-img', style: { backgroundImage: `url("${VN.assetUrl(e.it.image)}")` } }) : el('div', { class: 'inv-img ph' }, (e.it.name || '?').slice(0, 2)));
            if (e.n > 1) slot.appendChild(el('span', { class: 'inv-n' }, String(e.n)));
            slot.title = VN.tr(e.it.id + ':name', e.it.name);
            slot.addEventListener('click', (ev) => {
              ev.stopPropagation();
              // Kombinieren: zweiten Gegenstand anklicken
              if (combining && opts.onCombine) {
                const a = combining; combining = null;
                if (a.id === e.it.id && (rs.inv[a.id] || 0) < 2) { note = 'Wähle einen anderen Gegenstand.'; draw(); return; }
                const r = opts.onCombine(a, e.it) || {};
                note = r.text || '';
                selected = r.result || e.it;
                draw();
                return;
              }
              note = '';
              selected = e.it; draw();
            });
          }
          slotsEl.appendChild(slot);
        }
        detail.innerHTML = '';
        if (selected && rs.inv[selected.id]) {
          detail.append(
            selected.image ? el('div', { class: 'inv-big', style: { backgroundImage: `url("${VN.assetUrl(selected.image)}")` } }) : el('div', { class: 'inv-big ph' }, 'Bild'),
            el('strong', null, VN.tr(selected.id + ':name', selected.name)),
            el('div', { class: 'muted' }, selected.cat ? VN.tr('invcat:' + selected.cat, selected.cat) : ''),
            el('div', null, VN.tr(selected.id + ':desc', selected.desc || '')),
            selected.value ? el('div', { class: 'muted small' }, 'Wert: ' + selected.value) : null,
            note ? el('div', { class: 'inv-note' }, note) : null,
            combining ? el('div', { class: 'inv-note' }, 'Womit kombinieren? Zweiten Gegenstand anklicken.') : null,
            el('div', { class: 'inv-acts' },
              opts.onUse && opts.canUse && opts.canUse(selected) ? el('button', { class: 'inv-act', onclick: (ev) => { ev.stopPropagation(); opts.onUse(selected); } }, 'Benutzen') : null,
              opts.onCombine && VN.Extras && VN.Extras.combos().some((c) => c.a === selected.id || c.b === selected.id) ? el('button', { class: 'inv-act' + (combining ? ' on' : ''), onclick: (ev) => { ev.stopPropagation(); combining = combining ? null : selected; note = ''; draw(); } }, combining ? 'Abbrechen' : 'Kombinieren …') : null));
        } else detail.append(el('div', { class: 'muted' }, 'Gegenstand anklicken für Details'), note ? el('div', { class: 'inv-note' }, note) : '');
        money.innerHTML = '';
        if (s.showMoney !== false) for (const c of p.currencies) money.appendChild(VN.moneyChip(c, rs.money[c.id] || 0));
      };
      draw();
      box.append(
        el('div', { class: 'inv-head' }, el('strong', { class: 'inv-title' }, VN.tr('ui:inventory', s.title || 'Inventar')), money),
        tabs,
        el('div', { class: 'inv-main' }, slotsEl, detail));
      if (opts.onClose) box.appendChild(el('button', { class: 'inv-close', onclick: (e) => { e.stopPropagation(); opts.onClose(); } }, 'Schließen (I)'));
      return box;
    }
  });

  VN.moneyChip = (c, n) => el('span', { class: 'money-chip' },
    c.image ? el('span', { class: 'mc-ico', style: { backgroundImage: `url("${VN.assetUrl(c.image)}")` } }) : el('span', { class: 'mc-dot', style: { background: c.color || '#e8c86a' } }),
    String(n.toLocaleString ? n.toLocaleString('de-DE') : n));
})();
