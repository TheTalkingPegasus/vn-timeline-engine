// Editor: Spielsysteme → Skilltrees (Bäume, Knoten auf einer Fläche, Wirkungen, Punkte-Arten, Prüfung)
(function () {
  const { el } = VN;
  const SK = () => VN.Skills;
  const S = window.Systems;
  const txt = (v, fn, style, ph) => el('input', { type: 'text', value: v || '', placeholder: ph || '', style: style || null, onchange: (e) => VN.mutate(() => fn(e.target.value)) });
  const num = (v, fn, w, step) => el('input', { type: 'number', value: v != null ? v : '', step: step || 'any', style: { width: w || '70px' }, onchange: (e) => VN.mutate(() => fn(e.target.value === '' ? null : Number(e.target.value))) });
  const sel = (v, opts, fn, style) => {
    const s = el('select', { style: style || null, onchange: (e) => VN.mutate(() => fn(e.target.value)) });
    for (const [k, l] of opts) { const o = el('option', { value: k }, l); if (String(k) === String(v == null ? '' : v)) o.selected = true; s.appendChild(o); }
    return s;
  };
  const field = (label, ...kids) => el('label', { class: 'sk-field' }, el('span', { class: 'muted small' }, label), ...kids);
  const KINDS = [['normal', 'Normal'], ['big', 'Groß (Schlüssel-Skill)'], ['hidden', 'Versteckt („???“ bis erreichbar)']];

  const payOpts = (kind) => {
    const p = VN.project;
    if (kind === 'points') return [['', '— Punkte-Art —'], ...SK().cfg().points.map((x) => [x.id, x.name])];
    if (kind === 'var') return [['', '— Variable —'], ...p.vars.filter((v) => v.type !== 'flag').map((v) => [v.id, v.name])];
    return [['', '— Währung —'], ...p.currencies.map((c) => [c.id, c.name])];
  };
  const whoOpts = () => [['', 'Spieler'], ...((VN.project.relations || {}).chars || []).map((c) => [c.name, '♥ ' + c.name])];

  // Eingabe für einen Wirkungs-Parameter
  const paramInput = (e, [key, label, type, def]) => {
    const p = VN.project;
    if (e[key] == null && def != null && typeof def !== 'function' && !Array.isArray(def)) e[key] = def;
    if (type === 'currency') return field(label, sel(e[key] || '', [['', 'alle Währungen'], ...p.currencies.map((c) => [c.id, c.name])], (v) => { e[key] = v; }));
    if (type === 'char') return field(label, sel(e[key] || '', [['', 'alle Figuren'], ...((p.relations || {}).chars || []).map((c) => [c.id, c.name])], (v) => { e[key] = v; }));
    if (type === 'var') return field(label, sel(e[key] || '', [['', '— Wert —'], ...p.vars.filter((v) => v.type !== 'flag').map((v) => [v.id, v.name])], (v) => { e[key] = v; }));
    if (type === 'actions') return VN.actionEditor(e[key] || (e[key] = []), 'Beim Kauf ausführen (bei jeder Stufe)');
    if (type === 'select') return field(label, sel(e[key] || '', (typeof def === 'function' ? def() : def) || [], (v) => { e[key] = v; }));
    if (type === 'text') return field(label, txt(e[key], (v) => { e[key] = v; }));
    return field(label, num(e[key], (v) => { e[key] = v || 0; }));
  };

  const nodeBox = (t, n) => {
    const box = el('div', { class: 'opt-card sk-insp' });
    const probs = SK().nodeProblems(t, n);
    box.appendChild(el('div', { class: 'row gap8', style: { alignItems: 'center' } },
      el('strong', { style: { fontSize: '15px' } }, (n.icon || '⭐') + ' ' + (n.name || '?')),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { t.nodes = t.nodes.filter((x) => x !== n); for (const o of t.nodes) o.reqs = (o.reqs || []).filter((r) => r !== n.id); VN.ui.skNode = null; }) }, 'Skill löschen')));
    if (probs.length) box.appendChild(el('div', { class: 'sk-probs' }, ...probs.map((pr) => el('div', null, '⚠ ' + pr))));
    box.appendChild(el('div', { class: 'sk-grid2' },
      field('Name', txt(n.name, (v) => { n.name = v; })),
      field('Symbol (Emoji)', txt(n.icon, (v) => { n.icon = v; }, { width: '70px' })),
      field('Bild statt Symbol', VN.assetSelect('image', n.image, (v) => VN.mutate(() => { n.image = v; }))),
      field('Art', sel(n.kind || 'normal', KINDS, (v) => { n.kind = v; }))));
    box.appendChild(field('Beschreibung (im Spiel)', el('textarea', { class: 'sk-desc', rows: 2, onchange: (e) => VN.mutate(() => { n.desc = e.target.value; }) }, n.desc || '')));
    const costs = []; for (let l = 0; l < Math.min(SK().max(n), 6); l++) costs.push(SK().cost(n, l));
    box.appendChild(el('div', { class: 'sk-grid2' },
      field('Stufen', num(n.max || 1, (v) => { n.max = Math.max(1, Math.round(v || 1)); }, '60px', 1)),
      field('Kosten', num(n.cost, (v) => { n.cost = v || 0; })),
      field('× pro Stufe', num(n.grow || 1, (v) => { n.grow = v || 1; }, '60px', 0.1)),
      el('span', { class: 'muted small', style: { alignSelf: 'end' } }, costs.join(' → ') + (SK().max(n) > 6 ? ' …' : '') + ' ' + SK().payName(t))));
    // Voraussetzungen
    const reqs = el('div', { class: 'sk-reqs' });
    for (const r of n.reqs || []) { const o = SK().node(t, r); reqs.appendChild(el('span', { class: 'sk-chip' }, (o ? (o.icon || '') + ' ' + o.name : '?'), el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { n.reqs = n.reqs.filter((x) => x !== r); }) }, '×'))); }
    if (!(n.reqs || []).length) reqs.appendChild(el('span', { class: 'muted small' }, 'Keine – von Anfang an kaufbar. Mit „🔗 Verbinden“ auf der Fläche festlegen.'));
    box.appendChild(el('div', { class: 'sk-sec' }, el('div', { class: 'row gap8', style: { alignItems: 'center' } }, el('span', { class: 'sec-title' }, 'Voraussetzungen'),
      (n.reqs || []).length > 1 ? sel(n.reqMode || 'all', [['all', 'alle nötig'], ['any', 'eine reicht']], (v) => { n.reqMode = v; }) : null), reqs));
    box.appendChild(el('div', { class: 'sk-sec' }, VN.condEditor(n.gate || (n.gate = []), 'Story-Tor: erst kaufbar, wenn (optional)')));
    // Wirkungen
    const E = SK().effectsAll();
    const cats = SK().catsOn().filter((c) => !(t.cats || []).length || t.cats.includes(c.key));
    const effs = el('div', { class: 'sk-effs' });
    (n.effects || []).forEach((e, i) => {
      const d = E[e.type];
      const row = el('div', { class: 'sk-eff' + (d ? '' : ' bad') },
        el('div', { class: 'row gap8', style: { alignItems: 'center' } }, el('strong', null, d ? d.label : '? ' + e.type), el('div', { class: 'spacer' }),
          el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { n.effects.splice(i, 1); }) }, '×')));
      if (d) row.appendChild(el('div', { class: 'row gap8', style: { flexWrap: 'wrap', alignItems: 'end' } }, ...(d.params || []).map((pr) => paramInput(e, pr))));
      effs.appendChild(row);
    });
    const addSel = el('select', { onchange: (ev) => { const k = ev.target.value; if (!k) return; VN.mutate(() => { const d = E[k]; const e = { type: k }; for (const [key, , type, def] of d.params || []) e[key] = type === 'actions' ? [] : def != null && !Array.isArray(def) && typeof def !== 'function' ? def : ''; n.effects.push(e); }); } },
      el('option', { value: '' }, '+ Wirkung …'));
    for (const c of cats) {
      const g = el('optgroup', { label: c.icon + ' ' + c.label });
      for (const [k, d] of Object.entries(E)) if (d.cat === c.key) g.appendChild(el('option', { value: k }, d.label));
      if (g.children.length) addSel.appendChild(g);
    }
    box.appendChild(el('div', { class: 'sk-sec' }, el('div', { class: 'row gap8', style: { alignItems: 'center' } }, el('span', { class: 'sec-title' }, 'Wirkung'), el('div', { class: 'spacer' }), addSel), effs,
      (n.effects || []).length ? null : el('div', { class: 'muted small' }, 'Wähle oben eine Wirkung. Angeboten werden nur die Bereiche, die beim Baum angehakt sind.')));
    return box;
  };

  // Fläche mit Knoten und Verbindungslinien
  const canvas = (t) => {
    const wrap = el('div', { class: 'sk-canvas' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'sk-lines');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    wrap.appendChild(svg);
    const drawLines = () => {
      svg.innerHTML = '';
      for (const n of t.nodes) for (const r of n.reqs || []) {
        const o = SK().node(t, r); if (!o) continue;
        const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        ln.setAttribute('x1', o.x); ln.setAttribute('y1', o.y); ln.setAttribute('x2', n.x); ln.setAttribute('y2', n.y);
        ln.setAttribute('class', n.reqMode === 'any' && (n.reqs || []).length > 1 ? 'any' : '');
        ln.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.appendChild(ln);
      }
    };
    drawLines();
    const linking = VN.ui.skLink;
    for (const n of t.nodes) {
      const probs = SK().nodeProblems(t, n);
      const b = el('div', {
        class: 'sk-node ' + (n.kind || 'normal') + (VN.ui.skNode === n.id ? ' sel' : '') + (probs.length ? ' bad' : '') + (linking && VN.ui.skNode !== n.id ? ' linkable' : ''),
        style: { left: n.x + '%', top: n.y + '%' }, title: probs.length ? probs.join('\n') : (n.desc || n.name)
      }, n.image && VN.asset(n.image) ? el('span', { class: 'sk-img', style: { backgroundImage: `url("${VN.assetUrl(n.image)}")` } }) : el('span', { class: 'sk-ico' }, n.icon || '⭐'),
        el('span', { class: 'sk-name', 'data-notr': '' }, n.name || '?'),
        SK().max(n) > 1 ? el('span', { class: 'sk-lv' }, '×' + SK().max(n)) : null);
      b.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        if (linking && VN.ui.skNode && VN.ui.skNode !== n.id) {
          const cur = SK().node(t, VN.ui.skNode);
          VN.mutate(() => { if (cur.reqs.includes(n.id)) cur.reqs = cur.reqs.filter((x) => x !== n.id); else if (!(n.reqs || []).includes(cur.id)) cur.reqs.push(n.id); });
          return;
        }
        const r = wrap.getBoundingClientRect();
        const ox = n.x, oy = n.y;
        let moved = false;
        VN.drag(e, (dx, dy) => {
          if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
          n.x = Math.max(3, Math.min(97, Math.round(ox + dx / r.width * 100)));
          n.y = Math.max(5, Math.min(95, Math.round(oy + dy / r.height * 100)));
          b.style.left = n.x + '%'; b.style.top = n.y + '%';
          drawLines();
        }, () => {
          const nx = n.x, ny = n.y;
          n.x = ox; n.y = oy;
          VN.mutate(() => { if (moved) { n.x = nx; n.y = ny; } VN.ui.skNode = n.id; });
        });
      });
      wrap.appendChild(b);
    }
    if (!t.nodes.length) wrap.appendChild(el('div', { class: 'sk-empty muted' }, 'Noch keine Skills. „+ Skill“ legt einen an, oder starte mit einer Vorlage.'));
    return wrap;
  };

  const pointsCard = () => {
    const c = SK().cfg();
    const p = VN.project;
    const box = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Eigene Punkte (z. B. Skillpunkte, Ruhm, Talentpunkte)'),
      el('div', { class: 'muted small' }, 'Punkte bekommt man per Aktion „🌳 Skillpunkte geben“ – oder automatisch bei jedem Stufenaufstieg: Steigt die gewählte Variable (z. B. „Stufe“) um 1, gibt es die eingestellten Punkte.'));
    for (const pt of c.points) {
      box.appendChild(el('div', { class: 'row gap8 sk-pt', style: { alignItems: 'end', flexWrap: 'wrap' } },
        field('Name', txt(pt.name, (v) => { pt.name = v; })),
        field('Start', num(pt.start || 0, (v) => { pt.start = v || 0; })),
        field('Bei Stufenaufstieg von', sel(pt.levelVar || '', [['', '— nie —'], ...p.vars.filter((v) => v.type !== 'flag').map((v) => [v.id, v.name])], (v) => { pt.levelVar = v; })),
        pt.levelVar ? field('Punkte pro Stufe', num(pt.perLevel || 1, (v) => { pt.perLevel = v || 1; })) : null,
        el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { c.points = c.points.filter((x) => x !== pt); }) }, '×')));
    }
    box.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { c.points.push({ id: VN.uid('pt'), name: VN.t('Skillpunkte'), start: 0, levelVar: '', perLevel: 1 }); }) }, '+ Punkte-Art'));
    return box;
  };

  S.skillsTab = (body) => {
    const c = SK().cfg();
    const p = VN.project;
    body.appendChild(el('p', { class: 'muted' }, 'Skilltrees: Spieler verdienen Geld oder Punkte und schalten damit Skills frei, die sofort wirken – mehr Geld, bessere Minispiele, Rabatt, mehr Beziehungspunkte, höhere Werte oder freigeschaltete Orte und Quests. Abfragen lassen sie sich überall mit der Bedingung „🌳 Skill gekauft“. Im Spiel öffnet Taste ' + (c.key || 't').toUpperCase() + ' den Skilltree.'));
    const iss = SK().issues();
    if (iss.length) body.appendChild(el('div', { class: 'opt-card bad-card' }, el('div', { class: 'sec-title', style: { color: '#ffb3ad' } }, '⚠ ' + iss.length + (iss.length === 1 ? ' Problem' : ' Probleme')), ...iss.slice(0, 8).map((x) => el('div', { class: 'small' }, '• ' + x.text))));
    // Bäume als Reiter
    let t = SK().tree(VN.ui.skTree) || c.trees[0] || null;
    const tabs = el('div', { class: 'row gap4', style: { flexWrap: 'wrap', alignItems: 'center' } });
    for (const x of c.trees) tabs.appendChild(el('button', { class: 'btn tiny' + (x === t ? ' primary' : ''), onclick: () => { VN.ui.skTree = x.id; VN.ui.skNode = null; VN.render(); } }, el('span', { 'data-notr': '' }, x.name || '?')));
    const newTree = (kind) => VN.mutate(() => {
      const cur = p.currencies[0];
      const nt = { id: VN.uid('tree'), name: VN.t('Neuer Skilltree'), who: '', pay: { kind: cur ? 'currency' : 'points', ref: cur ? cur.id : (c.points[0] || {}).id || '' }, respec: 'full', cats: [], nodes: kind ? SK().template(kind) : [] };
      c.trees.push(nt); VN.ui.skTree = nt.id; VN.ui.skNode = nt.nodes[0] ? nt.nodes[0].id : null;
    });
    tabs.appendChild(el('select', { onchange: (e) => { const v = e.target.value; e.target.value = ''; if (v) newTree(v === 'empty' ? '' : v); } },
      el('option', { value: '' }, '+ Skilltree …'), el('option', { value: 'empty' }, 'Leer'), el('option', { value: 'two' }, 'Vorlage: zwei Wege'), el('option', { value: 'three' }, 'Vorlage: drei Äste'), el('option', { value: 'ring' }, 'Vorlage: Kreis um die Mitte')));
    tabs.appendChild(el('div', { class: 'spacer' }));
    tabs.appendChild(field('Taste im Spiel', txt(c.key || 't', (v) => { c.key = (v || 't').slice(0, 1).toLowerCase(); }, { width: '40px' })));
    tabs.appendChild(el('button', { class: 'btn tiny', onclick: () => window.UiDesign && UiDesign.edit('skills') }, '🎨 Design des Skilltrees'));
    body.appendChild(tabs);
    if (!t) { body.appendChild(el('div', { class: 'hint-box' }, 'Lege oben einen Skilltree an – am schnellsten mit einer Vorlage.')); body.appendChild(pointsCard()); return; }

    // Einstellungen des Baums
    const tp = SK().treeProblems(t);
    const cats = SK().catsAll();
    const on = new Set(SK().catsOn().map((x) => x.key));
    const catBox = el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } });
    for (const ct of cats) {
      const active = !(t.cats || []).length || t.cats.includes(ct.key);
      catBox.appendChild(el('label', { class: 'check' + (on.has(ct.key) ? '' : ' muted'), title: on.has(ct.key) ? '' : 'Das passende System ist gerade aus' },
        el('input', { type: 'checkbox', checked: active, disabled: !on.has(ct.key), onchange: (e) => VN.mutate(() => {
          let list = (t.cats || []).length ? t.cats.slice() : cats.map((x) => x.key);
          if (e.target.checked) { if (!list.includes(ct.key)) list.push(ct.key); } else list = list.filter((x) => x !== ct.key);
          t.cats = list.length === cats.length ? [] : list;
        }) }), ct.icon + ' ' + ct.label));
    }
    body.appendChild(el('div', { class: 'opt-card' },
      el('div', { class: 'row gap8', style: { flexWrap: 'wrap', alignItems: 'end' } },
        field('Name', txt(t.name, (v) => { t.name = v; })),
        field('Für', sel(t.who || '', whoOpts(), (v) => { t.who = v; })),
        field('Bezahlt wird mit', sel((t.pay || {}).kind || 'currency', [['currency', 'Geld (Währung)'], ['points', 'Eigenen Punkten'], ['var', 'Einer Variable']], (v) => { t.pay = { kind: v, ref: (payOpts(v)[1] || [''])[0] }; })),
        field(' ', sel((t.pay || {}).ref || '', payOpts((t.pay || {}).kind), (v) => { t.pay.ref = v; })),
        field('Zurücksetzen', sel(t.respec || 'none', [['none', 'nicht möglich'], ['full', 'möglich, alles zurück'], ['half', 'möglich, halb zurück']], (v) => { t.respec = v; })),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { c.trees = c.trees.filter((x) => x !== t); VN.ui.skTree = null; }) }, 'Baum löschen')),
      el('div', { class: 'sk-sec' }, el('span', { class: 'sec-title' }, 'Bereiche'), el('span', { class: 'muted small' }, ' – nur angehakte Bereiche stehen bei „+ Wirkung“ zur Auswahl'), catBox),
      el('div', { class: 'muted small' }, (t.nodes || []).length + ' Skills · Alles kaufen kostet ' + SK().totalCost(t) + ' ' + SK().payName(t) + (t.pay && t.pay.kind === 'points' && (SK().cfg().points.find((x) => x.id === t.pay.ref) || {}).levelVar ? '' : '')),
      tp.length ? el('div', { class: 'sk-probs' }, ...tp.map((x) => el('div', null, '⚠ ' + x))) : null));

    // Fläche + Knoten-Einstellungen
    const tools = el('div', { class: 'row gap8', style: { alignItems: 'center' } },
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const sel0 = SK().node(t, VN.ui.skNode); const n = { id: VN.uid('sk'), name: VN.t('Neuer Skill'), desc: '', icon: '⭐', x: sel0 ? Math.min(95, sel0.x + 12) : 50, y: sel0 ? Math.max(8, sel0.y - 16) : 50, kind: 'normal', max: 1, cost: 10, grow: 1.5, reqMode: 'all', reqs: sel0 ? [sel0.id] : [], gate: [], effects: [] }; t.nodes.push(n); VN.ui.skNode = n.id; }) }, '+ Skill'),
      el('button', { class: 'btn tiny' + (VN.ui.skLink ? ' primary' : ''), title: 'Skill wählen, dann auf einen anderen klicken: dieser wird Voraussetzung (nochmal klicken entfernt)', onclick: () => { VN.ui.skLink = !VN.ui.skLink; VN.render(); } }, '🔗 Verbinden'),
      VN.ui.skLink ? el('span', { class: 'muted small' }, VN.ui.skNode ? 'Klicke auf den Skill, der vorher gekauft sein muss.' : 'Wähle zuerst einen Skill.') : el('span', { class: 'muted small' }, 'Ziehen verschiebt · Klick wählt aus'),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn tiny', onclick: () => SK().tryOut && SK().tryOut(t) }, '▶ Ausprobieren'));
    const node = SK().node(t, VN.ui.skNode);
    body.appendChild(el('div', { class: 'sk-layout' },
      el('div', { class: 'sk-left' }, tools, canvas(t)),
      node ? nodeBox(t, node) : el('div', { class: 'opt-card sk-insp muted' }, 'Klicke einen Skill an, um Name, Kosten, Voraussetzungen und Wirkung einzustellen.')));
    body.appendChild(pointsCard());
  };

  // Probelauf im Editor: Spieler-Bildschirm mit viel Geld/Punkten, ändert nichts am Projekt
  VN.Skills.tryOut = (t) => {
    if (!window.Player || !Player.trySkills) return;
    Player.trySkills(t.id);
  };

  // Übersicht: Schalter
  if (VN.Life) {
    const base = VN.Life.extraSwitches;
    VN.Life.extraSwitches = (card, set) => {
      const out = base ? base(card, set) : [];
      out.push(card('🌳', 'Skilltrees', 'Skills mit Geld oder Punkten freischalten: mehr Verdienst, Rabatt, bessere Minispiele, Werte, freigeschaltete Orte und Quests. Grundlage für inkrementelle Spiele.', SK().on(), set((v) => { SK().cfg().enabled = v; }), 'skills'));
      return out;
    };
  }
})();
