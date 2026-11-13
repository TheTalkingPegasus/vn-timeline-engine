// Format kopieren / einfügen (0.7.4): Aussehen und Platzierung einer Figur auf andere Figuren übertragen.
// Rechtsklick auf eine Figur (Timeline oder Bühne) → „Format kopieren“, dann bei einer anderen Figur „Format einfügen …“.
// Beim Einfügen wählt man per Häkchen, was übertragen wird – standardmäßig alles.
(function () {
  const { el } = VN;
  const F = (window.FmtCopy = {});

  // Gruppen: was gehört zu welchem Häkchen
  F.GROUPS = [
    ['pos', 'Position (waagerecht und Höhe)', ['x', 'y']],
    ['scale', 'Größe', ['scale']],
    ['rot', 'Drehung', ['rot']],
    ['flip', 'Spiegeln', ['flip']],
    ['look', 'Effekte, Mischmodus und Deckkraft', ['styles', 'blend', 'opacity']],
    ['trans', 'Auftritt (Art und Dauer)', ['trans', 'dur']],
    ['idle', 'Bewegung im Stand', ['idle', 'boneAmp']],
    ['keys', 'Keyframes (Bewegungen über mehrere Schritte)', ['keys']]
  ];

  F.copy = (c) => {
    const data = {};
    for (const [, , props] of F.GROUPS) for (const p of props) if (c[p] !== undefined) data[p] = JSON.parse(JSON.stringify(c[p]));
    data._start = c.start;
    F.clip = { data, name: c.name || (VN.asset(c.asset) || {}).name || VN.t('Figur') };
    VN.toast(VN.tf('Format von „{name}“ kopiert', { name: F.clip.name }));
  };
  F.has = () => !!F.clip;

  // Alle Figuren-Clips einer Szene, optional nur die im aktuellen Schritt
  const charClips = (s, onlyBeat) => {
    const out = [];
    for (const t of VN.tracksOf(s)) {
      if (t.base !== 'char') continue;
      for (const c of s.tracks[t.key] || []) if (!onlyBeat || (VN.ui.beat >= c.start && VN.ui.beat < c.start + c.len)) out.push(c);
    }
    return out;
  };

  F.apply = (target, groups) => {
    const d = F.clip.data;
    for (const [k, , props] of F.GROUPS) {
      if (!groups[k]) continue;
      for (const p of props) {
        if (p === 'keys') {
          // Keyframes relativ zum Clip-Anfang verschieben
          const shift = (target.start || 0) - (d._start || 0);
          if (d.keys && d.keys.length) target.keys = JSON.parse(JSON.stringify(d.keys)).map((x) => Object.assign(x, { beat: x.beat + shift })).filter((x) => x.beat >= target.start && x.beat < target.start + target.len);
          else delete target.keys;
          continue;
        }
        if (d[p] === undefined) delete target[p];
        else target[p] = JSON.parse(JSON.stringify(d[p]));
      }
    }
  };

  F.paste = (s, c) => {
    if (!F.clip) return;
    const st = { where: 'one' };
    const groups = {};
    for (const [k] of F.GROUPS) groups[k] = true;
    const back = el('div', { class: 'modal-back', onclick: (ev) => { if (ev.target === back) back.remove(); } });
    const checks = F.GROUPS.map(([k, label]) => el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: true, onchange: (e) => { groups[k] = e.target.checked; } }), VN.t(label)));
    const setAll = (v) => { checks.forEach((n, i) => { n.querySelector('input').checked = v; groups[F.GROUPS[i][0]] = v; }); };
    const nBeat = charClips(s, true).length, nAll = charClips(s, false).length;
    back.appendChild(el('div', { class: 'modal fc-modal', 'data-notr': '' },
      el('strong', { style: { fontSize: '16px' } }, '📌 ' + VN.tf('Format von „{name}“ einfügen', { name: F.clip.name })),
      el('div', { class: 'muted small' }, VN.t('Wähle, was übertragen wird. Alles, was nicht angehakt ist, bleibt wie es ist.')),
      el('div', { class: 'fc-checks' }, ...checks),
      el('div', { class: 'row gap8' }, el('button', { class: 'btn tiny', onclick: () => setAll(true) }, VN.t('Alle')), el('button', { class: 'btn tiny', onclick: () => setAll(false) }, VN.t('Keine'))),
      el('label', { class: 'field' }, el('span', null, VN.t('Einfügen bei')),
        el('select', { class: 'sel', onchange: (e) => { st.where = e.target.value; } },
          el('option', { value: 'one' }, VN.tf('nur dieser Figur ({name})', { name: c.name || (VN.asset(c.asset) || {}).name || VN.t('Figur') })),
          el('option', { value: 'beat' }, VN.tf('allen Figuren in diesem Schritt ({n})', { n: nBeat })),
          el('option', { value: 'all' }, VN.tf('allen Figuren dieser Szene ({n})', { n: nAll })))),
      el('div', { class: 'row gap8', style: { justifyContent: 'flex-end' } },
        el('button', { class: 'btn', onclick: () => back.remove() }, VN.t('Abbrechen')),
        el('button', { class: 'btn primary', onclick: () => {
          const list = st.where === 'one' ? [c] : charClips(s, st.where === 'beat');
          VN.mutate(() => { for (const t of list) F.apply(t, groups); VN.ui.sel = c.id; });
          back.remove();
          VN.toast(VN.tf('Format bei {n} Figur(en) eingefügt', { n: list.length }));
        } }, VN.t('Einfügen')))));
    document.body.appendChild(back);
  };

  // ---------- Weich-Physik von Figur zu Figur (0.9.37) ----------
  // Gehört zum Bild, nicht zum Clip: gleicher Körper, anderer Kopf → Masken einmal einstellen, dann übertragen.
  const softOf = (assetId) => { const d = VN.project.softs && VN.project.softs[assetId]; return d && (d.regions || []).length ? d : null; };
  const assetName = (id) => (VN.asset(id) || {}).name || VN.t('Figur');
  F.copySoft = (assetId) => {
    const d = softOf(assetId);
    if (!d) return;
    F.soft = { from: assetId, name: assetName(assetId), data: JSON.parse(JSON.stringify(d)) };
    VN.toast(VN.tf('Weich-Physik von „{name}“ kopiert ({n} Bereiche)', { name: F.soft.name, n: d.regions.length }));
  };
  // src = { data, name } (Zwischenablage oder eine andere Figur)
  F.pasteSoft = (target, src) => {
    src = src || F.soft;
    if (!src || !target) return;
    const fresh = () => src.data.regions.map((r) => Object.assign(JSON.parse(JSON.stringify(r)), { id: VN.uid('sr') }));
    const go = (mode) => {
      VN.mutate(() => {
        const p = VN.project;
        p.softs = p.softs || {};
        if (mode === 'add' && p.softs[target]) p.softs[target].regions = (p.softs[target].regions || []).concat(fresh());
        else p.softs[target] = Object.assign(JSON.parse(JSON.stringify(src.data)), { regions: fresh() });
      });
      VN.toast(VN.tf('Weich-Physik von „{from}“ bei „{to}“ eingefügt', { from: src.name, to: assetName(target) }));
    };
    if (!softOf(target)) return go('replace');
    // Ziel hat schon Bereiche: ersetzen oder dazulegen?
    const back = el('div', { class: 'modal-back', onclick: (ev) => { if (ev.target === back) back.remove(); } });
    back.appendChild(el('div', { class: 'modal fc-modal' },
      el('strong', { style: { fontSize: '16px' } }, '🫧 ' + VN.t('Weich-Physik einfügen')),
      el('div', { class: 'muted small' }, VN.tf('„{to}“ hat schon {n} Bereiche. Ersetzen oder die neuen dazulegen?', { to: assetName(target), n: softOf(target).regions.length })),
      el('div', { class: 'row gap8', style: { justifyContent: 'flex-end' } },
        el('button', { class: 'btn', onclick: () => back.remove() }, VN.t('Abbrechen')),
        el('button', { class: 'btn', onclick: () => { back.remove(); go('add'); } }, VN.t('Dazulegen')),
        el('button', { class: 'btn primary', onclick: () => { back.remove(); go('replace'); } }, VN.t('Ersetzen')))));
    document.body.appendChild(back);
  };
  F.softItems = (c) => {
    if (!c || !c.asset) return [];
    return [
      softOf(c.asset) ? { label: '🫧 ' + VN.t('Weich-Physik kopieren'), hint: VN.t('Masken dieser Figur'), action: () => F.copySoft(c.asset) } : null,
      F.soft && F.soft.from !== c.asset ? { label: '🫧 ' + VN.t('Weich-Physik einfügen'), hint: '„' + F.soft.name + '“', action: () => F.pasteSoft(c.asset) } : null
    ].filter(Boolean);
  };

  // Einträge für ein Rechtsklick-Menü
  F.menuItems = (s, c) => [
    { label: '📋 ' + VN.t('Format kopieren'), hint: VN.t('Position, Größe, Effekte …'), action: () => F.copy(c) },
    F.clip ? { label: '📌 ' + VN.t('Format einfügen …'), hint: '„' + F.clip.name + '“', action: () => F.paste(s, c) } : null
  ].filter(Boolean).concat(F.softItems(c));
})();
