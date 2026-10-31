// Editor: Spielsysteme → Ausrüstung (Plätze anlegen) und Schalter in der Übersicht
(function () {
  const { el } = VN;
  const S = window.Systems;
  const EQ = () => VN.Equip;

  S.equipTab = (body) => {
    const c = EQ().cfg();
    body.appendChild(el('p', { class: 'muted' }, VN.t('Gegenstände ausrüsten: Kleidung, Werkzeug, Schmuck … Jeder Platz trägt einen Gegenstand. Der Spieler rüstet im Inventar aus (Gegenstand anklicken → „Ausrüsten“). Prüfen mit der Bedingung „👕 Trägt Gegenstand“, z. B. für Missionen, Quests oder wie eine Figur reagiert.')));
    const iss = EQ().issues();
    if (iss.length) body.appendChild(Help.sysBox(iss));
    const card = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Plätze')));
    c.slots.forEach((s, i) => {
      card.appendChild(el('div', { class: 'logic-row' },
        el('input', { type: 'text', value: s.icon || '', style: { width: '46px', textAlign: 'center' }, title: VN.t('Symbol'), onchange: (e) => VN.mutate(() => { s.icon = e.target.value.trim(); }) }),
        el('input', { type: 'text', value: s.name || '', style: { width: '170px' }, onchange: (e) => VN.mutate(() => { s.name = e.target.value || VN.t('Platz'); }) }),
        el('span', { class: 'muted small' }, (() => { const n = VN.project.items.filter((it) => it.slot === s.id).length; return n === 1 ? VN.t('1 Gegenstand') : VN.tf('{n} Gegenstände', { n }); })()),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn tiny', disabled: i === 0, onclick: () => VN.mutate(() => { c.slots.splice(i, 1); c.slots.splice(i - 1, 0, s); }) }, '↑'),
        el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { c.slots = c.slots.filter((x) => x !== s); for (const it of VN.project.items) if (it.slot === s.id) delete it.slot; }) }, '×')));
    });
    card.appendChild(el('div', { class: 'row gap8' },
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { c.slots.push({ id: VN.uid('sl'), name: VN.t('Neuer Platz'), icon: '◻' }); }) }, '+ ' + VN.t('Platz')),
      c.slots.length ? null : el('button', { class: 'btn tiny primary', onclick: () => VN.mutate(() => { c.slots.push(...EQ().defaultSlots()); }) }, VN.t('Vorschlag: Kopf, Körper, Hand, Schmuck'))));
    body.appendChild(card);
    body.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Gegenstände mit Platz')),
      ...(VN.project.items.filter((it) => it.slot).length
        ? VN.project.items.filter((it) => it.slot).map((it) => { const s = EQ().slot(it.slot); return el('div', { class: 'logic-row' }, el('span', { style: { width: '26px' } }, s && s.icon || '◻'), el('strong', null, it.name), el('span', { class: 'muted small' }, s ? s.name : '?')); })
        : [el('div', { class: 'muted small' }, VN.t('Noch keiner. Unter „Gegenstände“ in der Spalte „Ausrüsten“ einen Platz wählen.'))]),
      el('button', { class: 'btn tiny', style: { marginTop: '6px' }, onclick: () => { VN.ui.sysTab = 'items'; VN.render(); } }, VN.t('Zu den Gegenständen →'))));
    body.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Im Spiel')),
      el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '150px' } }, VN.t('Titel der Leiste')),
        el('input', { type: 'text', value: c.title || '', placeholder: VN.t('Ausrüstung'), onchange: (e) => VN.mutate(() => { c.title = e.target.value; }) })),
      el('div', { class: 'hint-box' }, VN.t('Die Ausrüstung erscheint oben im Inventar (Taste I). Ein Klick auf einen belegten Platz legt den Gegenstand ab. Gibt der Spieler einen getragenen Gegenstand ab, wird er automatisch abgelegt.')),
      el('button', { class: 'btn tiny', onclick: () => { VN.ui.sysTab = 'inv'; VN.render(); } }, VN.t('Inventar-Vorschau ansehen →'))));
  };

  // Gegenstand: was passiert beim Anziehen/Ablegen, welche Boni gibt er, solange er getragen wird
  S.wearModal = (it) => {
    const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) back.remove(); } });
    const card = el('div', { class: 'modal', style: { width: '660px', maxHeight: '84vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' } });
    const draw = () => {
      card.innerHTML = '';
      it.wearActs = it.wearActs || []; it.removeActs = it.removeActs || []; it.wearFx = it.wearFx || [];
      const E = EQ().EFFECTS();
      const fxRows = it.wearFx.map((fx, i) => {
        const d = E[fx.eff];
        const row = el('div', { class: 'opt-card', style: { margin: '0' } },
          el('div', { class: 'row gap8' },
            (() => { const s = el('select', { style: { flex: '1' }, onchange: (e) => VN.mutate(() => { it.wearFx[i] = { eff: e.target.value }; }) }); for (const [k, x] of Object.entries(E)) { const o = el('option', { value: k }, VN.t(x.label)); if (k === fx.eff) o.selected = true; s.appendChild(o); } return s; })(),
            el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { it.wearFx.splice(i, 1); }) }, '×')));
        if (d) row.appendChild(el('div', { class: 'sk-grid2' }, ...(d.params || []).filter((pa) => pa[2] !== 'actions').map((pa) => S.skillParamInput ? S.skillParamInput(fx, pa) : el('span'))));
        return row;
      });
      card.append(
        el('div', { class: 'row gap8' }, el('strong', { style: { flex: '1', fontSize: '16px' } }, '👕 ' + it.name), el('button', { class: 'btn primary', onclick: () => { back.remove(); VN.render(); } }, VN.t('Fertig'))),
        el('div', { class: 'muted small' }, VN.t('Was passiert, wenn der Spieler diesen Gegenstand anzieht oder ablegt – z. B. „Verkleidet: Jetzt darf ich ins Labor“ (Ort freischalten, Quest-Abschnitt erledigt, Beziehungspunkte). Für „nur verkleidet hinein“ an der Tür die Bedingung „👕 Trägt Gegenstand“ nutzen.')),
        VN.actionEditor(it.wearActs, VN.t('Beim Anziehen ausführen')),
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!it.wearOnce, onchange: (e) => VN.mutate(() => { it.wearOnce = e.target.checked; }) }), VN.t('Nur beim ersten Anziehen (sonst jedes Mal)')),
        VN.actionEditor(it.removeActs, VN.t('Beim Ablegen ausführen')),
        el('div', { class: 'sec-title' }, VN.t('Boni, solange getragen')),
        el('div', { class: 'muted small' }, VN.t('Gleiche Wirkungen wie bei Skilltrees, z. B. mehr ♥ bei einer Figur, mehr Geld, bessere Preise oder Kampfwerte.')),
        ...fxRows,
        el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { it.wearFx.push({ eff: Object.keys(E).includes('relPct') ? 'relPct' : Object.keys(E)[0] }); }) }, '+ ' + VN.t('Bonus')));
    };
    draw();
    back.appendChild(card);
    document.body.appendChild(back);
    // Änderungen im Fenster sofort zeichnen
    const orig = VN.render;
    VN.render = function () { orig.apply(this, arguments); if (back.isConnected) draw(); else VN.render = orig; };
  };

  if (window.Help) Help.sources.push(() => EQ().issues().map((x) => Object.assign({ level: 'warn', area: 'Ausrüstung', topic: 'system', go: () => { VN.ui.view = 'systems'; VN.ui.sysTab = 'equip'; VN.render(); } }, x)));

  if (VN.Life) {
    const base = VN.Life.extraSwitches;
    VN.Life.extraSwitches = (card, set) => {
      const out = base ? base(card, set) : [];
      out.push(card('👕', VN.t('Ausrüstung'), VN.t('Kleidung und Gegenstände ausrüsten (Plätze wie Kopf, Körper, Hand). Für Missionen, Quests oder Figuren, die darauf reagieren.'), EQ().on(), set((v) => { EQ().cfg().enabled = v; if (v && !EQ().slots().length) EQ().cfg().slots.push(...EQ().defaultSlots()); if (v && VN.project.inventory.enabled === false) VN.project.inventory.enabled = true; }), 'equip'));
      return out;
    };
  }
})();
