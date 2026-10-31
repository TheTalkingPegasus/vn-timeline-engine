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
