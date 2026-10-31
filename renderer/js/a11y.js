// Komfort und Farbenblindheit (0.7.4) – für den Editor und für Spieler.
// · Farbfilter: Simulation (Autoren sehen ihr Spiel wie farbenblinde Spieler) und Hilfe (Farben werden so
//   verschoben, dass sie sich besser unterscheiden lassen, „Daltonisierung“). Werte nach Machado et al. 2009.
// · Editor: Komfort-Modus (ruhig, ohne Animationen, größer, weniger grelle Farben) und farbenblind-freundliche
//   Spurfarben (Okabe-Ito-Palette).
(function () {
  const A = (VN.A11y = {});
  A.TYPES = [['', 'aus'], ['protan', 'Rot-Schwäche (Protanopie)'], ['deutan', 'Grün-Schwäche (Deuteranopie)'], ['tritan', 'Blau-Gelb-Schwäche (Tritanopie)']];
  // Simulation, Schweregrad 1.0
  const SIM = {
    protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]
  };
  const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const mul = (a, b) => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]));
  const sub = (a, b) => a.map((r, i) => r.map((v, j) => v - b[i][j]));
  const add = (a, b) => a.map((r, i) => r.map((v, j) => v + b[i][j]));
  // Fehler (was verloren geht) auf Kanäle verteilen, die noch gesehen werden
  const SHIFT = {
    protan: [[0, 0, 0], [0.7, 1, 0], [0.7, 0, 1]],
    deutan: [[1, 0.7, 0], [0, 0, 0], [0, 0.7, 1]],
    tritan: [[1, 0, 0.7], [0, 1, 0.7], [0, 0, 0]]
  };
  A.matrix = (type, mode) => {
    const S = SIM[type];
    if (!S) return I3;
    if (mode === 'sim') return S;
    return add(I3, mul(SHIFT[type], sub(I3, S)));
  };
  const toFe = (m) => [...m[0], 0, 0, ...m[1], 0, 0, ...m[2], 0, 0, 0, 0, 0, 1, 0].map((v) => Math.round(v * 10000) / 10000).join(' ');

  // Unsichtbares SVG mit allen Filtern einmal ins Dokument legen
  A.ensureFilters = () => {
    if (document.getElementById('vn-cb-filters')) return;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('id', 'vn-cb-filters');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    for (const type of Object.keys(SIM)) for (const mode of ['sim', 'fix']) {
      const f = document.createElementNS(ns, 'filter');
      f.setAttribute('id', 'vn-cb-' + mode + '-' + type);
      f.setAttribute('color-interpolation-filters', 'linearRGB');
      const cm = document.createElementNS(ns, 'feColorMatrix');
      cm.setAttribute('type', 'matrix');
      cm.setAttribute('values', toFe(A.matrix(type, mode)));
      f.appendChild(cm);
      svg.appendChild(f);
    }
    (document.body || document.documentElement).appendChild(svg);
  };
  A.filterCss = (type, mode) => (SIM[type] ? 'url(#vn-cb-' + mode + '-' + type + ')' : '');

  // ---------- Editor ----------
  const KEY = 'vn-a11y';
  A.load = () => { try { return Object.assign({ comfort: false, cbSafe: false, size: 100, sim: '' }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { comfort: false, cbSafe: false, size: 100, sim: '' }; } };
  A.cfg = A.load();
  A.save = () => { try { localStorage.setItem(KEY, JSON.stringify(A.cfg)); } catch (e) { /* egal */ } };
  A.applyEditor = () => {
    const b = document.body;
    if (!b || VN.gameMode) return;
    A.ensureFilters();
    b.classList.toggle('cmf', !!A.cfg.comfort);
    b.classList.toggle('cbsafe', !!A.cfg.cbSafe);
    for (const [t] of A.TYPES) if (t) b.classList.toggle('cbsim-' + t, A.cfg.sim === t);
    const app = document.getElementById('app'), wel = document.getElementById('welcome');
    const z = Math.max(80, Math.min(140, Number(A.cfg.size) || 100)) / 100;
    for (const n of [app, wel]) if (n) n.style.zoom = z === 1 ? '' : String(z);
  };
  // Spurfarben im farbenblind-freundlichen Modus (Okabe-Ito): unterscheidbar für alle drei Arten
  const SAFE = { '#7c8496': '#8a8f9c', '#6cc48a': '#009e73', '#8fd6a6': '#56b4e9', '#4fb3c8': '#0072b2', '#e8a43a': '#e69f00', '#a58cf0': '#cc79a7', '#5fa8e8': '#56b4e9', '#c9b37a': '#f0e442' };
  A.col = (c) => (A.cfg.cbSafe && c && SAFE[String(c).toLowerCase()]) || c;
  A.open = () => {
    const { el } = VN;
    const back = el('div', { class: 'modal-back', onclick: (ev) => { if (ev.target === back) back.remove(); } });
    const set = (k, v) => { A.cfg[k] = v; A.save(); A.applyEditor(); VN.render(); };
    const chk = (k, label, hint) => el('label', { class: 'check a11y-opt' }, el('input', { type: 'checkbox', checked: !!A.cfg[k], onchange: (e) => set(k, e.target.checked) }), el('span', null, el('strong', null, VN.t(label)), el('br'), el('span', { class: 'muted small' }, VN.t(hint))));
    const sizeLab = el('span', { class: 'muted' }, (A.cfg.size || 100) + ' %');
    back.appendChild(el('div', { class: 'modal a11y-modal', 'data-notr': '' },
      el('strong', { style: { fontSize: '16px' } }, '♿ ' + VN.t('Komfort & Barrierefreiheit')),
      el('div', { class: 'muted small' }, VN.t('Gilt nur für diesen Editor auf diesem Computer. Für Spieler gibt es eigene Einstellungen im Spiel (Menü → Lesen & Barrierefreiheit).')),
      chk('comfort', 'Komfort-Modus', 'Ruhige Oberfläche: keine Animationen und kein Blinken, gedämpfte Farben, deutlichere Rahmen um das, was gerade ausgewählt ist. Hilft bei Reizüberflutung und Konzentration.'),
      el('div', { class: 'field' }, el('div', { class: 'lbl' }, VN.t('Oberfläche größer'), ' ', sizeLab),
        el('input', { type: 'range', min: 80, max: 140, step: 5, value: A.cfg.size || 100, oninput: (e) => { sizeLab.textContent = e.target.value + ' %'; }, onchange: (e) => set('size', Number(e.target.value)) })),
      chk('cbSafe', 'Farbenblind-Modus', 'Spuren, Warnungen und Markierungen in Farben, die sich auch bei Rot-Grün- oder Blau-Gelb-Schwäche gut unterscheiden lassen.'),
      el('div', { class: 'field' }, el('div', { class: 'lbl' }, VN.t('Vorschau: Spiel mit den Augen farbenblinder Spieler sehen')),
        el('select', { class: 'sel', onchange: (e) => set('sim', e.target.value) }, ...A.TYPES.map(([v, l]) => el('option', { value: v, selected: (A.cfg.sim || '') === v }, VN.t(l)))),
        el('div', { class: 'muted small' }, VN.t('Färbt Bühne und Testspiel so ein, wie es Menschen mit dieser Farbschwäche ungefähr sehen. Gut zum Prüfen, ob wichtige Dinge (Hinweise, Rätsel, Knöpfe) nicht nur an der Farbe hängen.'))),
      el('div', { class: 'row gap8', style: { justifyContent: 'flex-end' } }, el('button', { class: 'btn primary', onclick: () => back.remove() }, VN.t('Fertig')))));
    document.body.appendChild(back);
  };

  // ---------- Spieler ----------
  // Einstellungen kommen aus VN.settings (cb: Farbhilfe, lessFx: weniger Effekte)
  A.applyPlayer = (stage, S) => {
    if (!stage) return;
    A.ensureFilters();
    stage.classList.toggle('a11y-lessfx', !!(S && S.lessFx));
    stage.style.filter = S && S.cb ? A.filterCss(S.cb, 'fix') : '';
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', A.applyEditor); else A.applyEditor();
})();
