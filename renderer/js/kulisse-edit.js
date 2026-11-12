// Reiter „Kulissen“ (0.9.32): Kulissen-Raum bauen – links die Szene durch die Kamera, rechts der Raum schräg von oben.
// Flächen (PNG) frei im Raum platzieren und drehen, Lampen und Fensterlicht, Tageszeit, Scroll-Bereich und Zonen.
(function () {
  const { el } = VN;
  const K = () => window.Kulisse;
  const field = (label, input) => el('div', { class: 'field' }, el('div', { class: 'lbl' }, label), input);
  const sel = (value, options, commit) => {
    const s = el('select', { onchange: (e) => commit(e.target.value) });
    for (const [v, l] of options) { const o = el('option', { value: v }, l); if (String(v) === String(value == null ? '' : value)) o.selected = true; s.appendChild(o); }
    return s;
  };
  const check = (label, v, commit) => el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!v, onchange: (e) => commit(e.target.checked) }), label);
  const card = (title, ...c) => el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, title), ...c);
  const round = (v) => Math.round(v);
  // Wert live ändern (Vorschau), beim Loslassen als ein Rückgängig-Schritt speichern
  const commit = (o, k, v, old) => { o[k] = old; VN.mutate(() => { o[k] = v; }); };
  const AX = [['x', [1, 0, 0], '#ff5d6c'], ['y', [0, -1, 0], '#5fe08a'], ['z', [0, 0, 1], '#5aa8ff']];
  const NS = 'http://www.w3.org/2000/svg';
  const S = (tag, at, parent) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); parent.appendChild(e); return e; };

  const KulEd = (window.KulEd = {
    _cam: null, _orb: null,
    cur() {
      const all = K().all();
      if (!all.find((k) => k.id === VN.ui.kulId)) VN.ui.kulId = all[0] ? all[0].id : null;
      return K().get(VN.ui.kulId);
    },
    day() { return K().DAYCFG[VN.ui.kulDay] ? VN.ui.kulDay : (KulEd.cur() && KulEd.cur().day) || 'day'; },
    sel() {
      const k = KulEd.cur(), s = VN.ui.kulSel; if (!k || !s) return null;
      if (s.t === 'sun') return k.sun;
      if (s.t === 'set') return k;
      const list = s.t === 'lamp' ? k.lamps : s.t === 'zone' ? k.zones : k.planes;
      return (list || []).find((x) => x.id === s.id) || null;
    },
    pick(t, id) { VN.ui.kulSel = { t, id }; VN.render(); },
    viewX(k) { const u = VN.ui.kulView = VN.ui.kulView || {}; return u[k.id] != null ? u[k.id] : k.cam.x; },
    orbit(k) { const u = VN.ui.kulOrb = VN.ui.kulOrb || {}; return u[k.id] || (u[k.id] = K().orbDefault(k)); },

    // ---------- Hintergrund-Auswahl in Szene und Hub ----------
    bgField(look, hub) {
      const all = K().all();
      const box = el('div', { class: 'opt-card' },
        el('div', { class: 'sec-title' }, 'Kulissen-Raum (3D)'),
        field('Kulisse', sel(look.kulisse || '', [['', '— keine, normales Bild —'], ...all.map((k) => [k.id, k.name])], (v) => VN.mutate(() => { look.kulisse = v || null; }))));
      if (look.kulisse && K().get(look.kulisse)) {
        if (!hub) box.appendChild(check('Rand-Scrollen in dieser Szene (Maus an den Bildrand)', look.kScroll, (v) => VN.mutate(() => { look.kScroll = v; })));
        box.appendChild(el('div', { class: 'muted small' }, hub ? 'Im Hub scrollt die Kulisse, wenn die Maus an den Bildrand geht. Hub-Objekte wandern mit. Tageszeit, Licht und Kamera kommen aus der Kulisse und aus dieser Szene.' : 'Kamera-Schwenks dieser Szene fahren durch den Raum, mit echter Tiefe. Die Tageszeit oben schaltet Lampen und Fensterlicht um.'));
        box.appendChild(el('button', { class: 'btn tiny', onclick: () => { VN.ui.kulId = look.kulisse; VN.ui.view = 'sets'; VN.render(); } }, 'Kulisse bearbeiten'));
      } else if (!all.length) box.appendChild(el('div', { class: 'muted small' }, 'Noch keine Kulisse. Im Reiter „Kulissen“ baust du Räume aus PNG-Flächen.'));
      return box;
    },

    // ---------- Hauptansicht ----------
    render(center) {
      center.innerHTML = '';
      if (KulEd._cam) KulEd._cam.destroy(); if (KulEd._orb) KulEd._orb.destroy();
      KulEd._cam = KulEd._orb = null;
      const all = K().all(), k = KulEd.cur();
      const head = el('div', { class: 'view-head kul-head' },
        el('strong', { style: { fontSize: '15px' } }, 'Kulissen'),
        (() => { const x = sel(k ? k.id : '', all.length ? all.map((x) => [x.id, x.name]) : [['', '— keine —']], (v) => { VN.ui.kulId = v; VN.ui.kulSel = null; VN.render(); }); x.className = 'small-input'; return x; })(),
        el('button', { class: 'btn', onclick: () => VN.mutate(() => { const n = K().blank(VN.t('Neue Kulisse'), 'room'); all.push(n); VN.ui.kulId = n.id; VN.ui.kulSel = { t: 'set' }; }) }, '+ Neue Kulisse'),
        k ? el('button', { class: 'btn', onclick: () => VN.mutate(() => { const c = JSON.parse(JSON.stringify(k)); c.id = VN.uid('kul'); c.name = k.name + ' ' + VN.t('Kopie'); all.push(c); VN.ui.kulId = c.id; }) }, 'Duplizieren') : null,
        k ? el('button', { class: 'btn danger', onclick: () => VN.mutate(() => { const i = all.indexOf(k); if (i >= 0) all.splice(i, 1); VN.ui.kulSel = null; }) }, 'Löschen') : null,
        el('div', { class: 'spacer' }));
      center.appendChild(head);
      if (!k) {
        center.appendChild(el('div', { class: 'hint-box', style: { margin: '14px' } },
          el('strong', null, 'Kulissen-Raum'), el('br'),
          'Baue einen echten Raum aus PNG-Flächen: Rückwände, Böden, Decken, Zwischenwände, Balken und Möbel. Die Kamera schaut mit Perspektive hinein – Parallax entsteht von selbst. ',
          'Fenster sind einfach durchsichtige Stellen im Wand-PNG: man sieht hinaus, und das Fensterlicht fällt hindurch. ',
          'Eine Kulisse wählst du danach am Hintergrund-Clip einer Szene oder am Hub als Hintergrund.', el('br'), el('br'),
          el('button', { class: 'btn primary', onclick: () => VN.mutate(() => { const n = K().blank(VN.t('Neue Kulisse'), 'room'); all.push(n); VN.ui.kulId = n.id; VN.ui.kulSel = { t: 'set' }; }) }, '+ Erste Kulisse anlegen')));
        return;
      }
      const day = KulEd.day();
      const camBox = el('div', { class: 'kul-ed-vp' }), orbBox = el('div', { class: 'kul-ed-vp kul-ed-orb' });
      const camOv = document.createElementNS(NS, 'svg'), orbOv = document.createElementNS(NS, 'svg');
      for (const o of [camOv, orbOv]) { o.setAttribute('class', 'kul-ov'); o.setAttribute('viewBox', '0 0 1280 720'); }
      const pickP = (p, e) => { if (KulEd._orbMoved) return; e.stopPropagation(); KulEd.pick('plane', p.id); };
      const selected = () => { const s = VN.ui.kulSel; return s && s.t === 'plane' ? k.planes.find((p) => p.id === s.id) : null; };
      const cam = K().mount(k, { day, split: false, pick: pickP, selected });
      const orb = K().mount(k, { day, mode: 'orbit', orbit: KulEd.orbit(k), pick: pickP, selected });
      KulEd._cam = cam; KulEd._orb = orb;
      cam.back.style.pointerEvents = orb.back.style.pointerEvents = 'auto';
      cam.cam = { x: KulEd.viewX(k), y: k.cam.y || 0, dz: 0, rot: 0 }; cam.apply();
      camBox.append(cam.back, camOv, el('div', { class: 'kul-edge l' }), el('div', { class: 'kul-edge r' }), el('div', { class: 'kul-pill' }));
      orbBox.append(orb.back, orbOv);
      const zoneName = () => { const z = K().zoneAt(k, cam.cam.x); camBox.querySelector('.kul-pill').textContent = (z ? VN.t('Zone') + ': ' + z.name : '') ; camBox.querySelector('.kul-pill').hidden = !z; };
      KulEd._redraw = () => { cam.place(); orb.place(); KulEd.overlays(k, cam, orb, camOv, orbOv); zoneName(); };
      const days = el('div', { class: 'seg' }, ...K().DAYS.map(([d, n]) => el('button', { class: d === day ? 'active' : '', onclick: () => { VN.ui.kulDay = d; VN.render(); } }, n)));
      const lo = Number(k.cam.min) || 0, hi = Math.max(lo, Number(k.cam.max) || 0);
      const slider = el('input', { type: 'range', min: Math.min(lo, k.cam.x) - 900, max: Math.max(hi, k.cam.x) + 900, step: 5, value: KulEd.viewX(k), style: { flex: '1', minWidth: '120px' },
        oninput: (e) => { VN.ui.kulView[k.id] = Number(e.target.value); cam.cam.x = Number(e.target.value); cam.apply(); KulEd._redraw(); } });
      KulEd._slider = slider;
      const views = el('div', { class: 'kul-ed-views' },
        el('div', { class: 'kul-ed-col' }, el('div', { class: 'kul-ed-cap' }, el('b', null, 'Szene · Kamera'), el('span', { class: 'muted small' }, 'Maus an den Rand = scrollen')), camBox,
          el('div', { class: 'row gap8 kul-ed-bar' }, el('span', { class: 'muted small' }, 'Tageszeit'), days)),
        el('div', { class: 'kul-ed-col' }, el('div', { class: 'kul-ed-cap' }, el('b', null, 'Schrägansicht'), el('span', { class: 'muted small' }, 'Ziehen = drehen · Umschalt + Ziehen = verschieben · Mausrad = zoomen'),
          el('button', { class: 'btn tiny', onclick: () => { VN.ui.kulOrb[k.id] = K().orbDefault(k); VN.render(); } }, 'Ansicht zurücksetzen')), orbBox,
          el('div', { class: 'row gap8 kul-ed-bar' }, el('span', { class: 'muted small' }, 'Kamera'), slider)));
      center.appendChild(views);
      // Hinzufügen
      const cx = round(KulEd.viewX(k));
      const addP = (o) => VN.mutate(() => { const p = K().plane(o); k.planes.push(p); VN.ui.kulSel = { t: 'plane', id: p.id }; });
      const F = 340, C = -360, B = -300, Fr = 150, D = Fr - B;
      center.appendChild(el('div', { class: 'row gap8 kul-ed-add' },
        el('span', { class: 'muted small' }, 'Hinzufügen:'),
        el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { K().addRoom(k, cx, VN.t('Raum') + ' ' + (k.planes.filter((p) => p.kind === 'wall').length + 1)); }) }, 'Ganzer Raum'),
        el('button', { class: 'btn tiny', onclick: () => addP({ name: VN.t('Rückwand'), kind: 'wall', x: cx, y: -10, z: B, w: 900, h: 700 }) }, 'Rückwand'),
        el('button', { class: 'btn tiny', onclick: () => addP({ name: VN.t('Boden'), kind: 'floor', x: cx, y: F, z: B + D / 2, w: 900, h: D, rx: 90 }) }, 'Boden'),
        el('button', { class: 'btn tiny', onclick: () => addP({ name: VN.t('Decke'), kind: 'ceil', x: cx, y: C, z: B + D / 2, w: 900, h: D, rx: 90 }) }, 'Decke'),
        el('button', { class: 'btn tiny', onclick: () => addP({ name: VN.t('Zwischenwand'), kind: 'side', x: cx + 200, y: -10, z: B + D / 2, w: D, h: 700, ry: 90 }) }, 'Zwischenwand'),
        el('button', { class: 'btn tiny', onclick: () => addP({ name: VN.t('Balken'), kind: 'beam', x: cx + 260, y: 0, z: Fr + 14, w: 70, h: 820 }) }, 'Balken'),
        el('button', { class: 'btn tiny', onclick: () => addP({ name: VN.t('Möbel'), kind: 'deco', x: cx, y: F - 120, z: -150, w: 240, h: 240 }) }, 'Möbel / Objekt'),
        el('button', { class: 'btn tiny', onclick: () => addP({ name: VN.t('Himmel'), kind: 'bg', x: cx, y: -60, z: -1400, w: 5600, h: 2000 }) }, 'Hintergrund'),
        el('button', { class: 'btn tiny', onclick: () => addP({ name: VN.t('Regen'), kind: 'part', x: cx, y: 0, z: -600, w: 3400, h: 1500, part: Object.assign({ particles: 'rain' }, Fx.PART_DEF.rain) }) }, 'Partikel'),
        el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const l = K().lamp({ name: VN.t('Lampe'), x: cx, y: -200, z: -100, days: { morning: true, day: true, evening: true, night: true } }); k.lamps.push(l); VN.ui.kulSel = { t: 'lamp', id: l.id }; }) }, 'Lampe'),
        el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const z = { id: VN.uid('kz'), name: VN.t('Zone') + ' ' + (k.zones.length + 1), x0: cx - 450, x1: cx + 450, music: null, ambient: null }; k.zones.push(z); VN.ui.kulSel = { t: 'zone', id: z.id }; }) }, 'Zone')));
      // Liste aller Flächen, Lichter und Zonen
      const s = VN.ui.kulSel || {};
      const item = (t, o, label, kind, dot) => el('div', { class: 'list-item' + (s.t === t && (t === 'sun' || t === 'set' || s.id === o.id) ? ' active' : ''), onclick: () => KulEd.pick(t, o && o.id) },
        el('span', { class: 'dot', style: { background: dot } }), el('span', { class: 'name' }, label), el('span', { class: 'muted small' }, kind));
      center.appendChild(el('div', { class: 'kul-ed-list' },
        item('set', k, k.name, VN.t('Einstellungen'), '#9d6bff'),
        item('sun', k.sun, VN.t('Fensterlicht (Sonne / Mond)'), VN.t('Licht'), '#ffb050'),
        ...k.lamps.map((l) => item('lamp', l, l.name, VN.t('Lampe'), l.color)),
        ...k.zones.map((z) => item('zone', z, z.name, VN.t('Zone'), '#ffcf5a')),
        ...k.planes.map((p) => item('plane', p, p.name, VN.t(K().kindName(p.kind)), p.asset ? '#6cc48a' : '#666'))));
      KulEd.bindOrbit(k, orb, orbBox);
      KulEd.bindEdge(k, cam, camBox);
      requestAnimationFrame(() => { cam.fit(); orb.fit(); KulEd._redraw(); });
    },

    // ---------- Überlagerung: Pfeile, Kamerakegel, Zonen, Lampen ----------
    overlays(k, cam, orb, camOv, orbOv) {
      camOv.innerHTML = ''; orbOv.innerHTML = '';
      const o = KulEd.sel(), s = VN.ui.kulSel || {};
      const lampIcons = (svg, proj, big) => {
        for (const l of k.lamps) {
          const C = proj([l.x, l.y, l.z]); if (!C[2]) continue;
          const on = l.days && l.days[cam.day], g = S('g', { class: 'kul-h', style: 'cursor:pointer' }, svg), r = big ? 16 : 13;
          S('circle', { cx: C[0], cy: C[1], r, fill: on ? l.color : 'rgba(40,40,50,.85)', stroke: s.t === 'lamp' && s.id === l.id ? '#9d6bff' : '#fff', 'stroke-width': s.id === l.id ? 4 : 2 }, g);
          for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; S('line', { x1: C[0] + Math.cos(a) * (r + 5), y1: C[1] + Math.sin(a) * (r + 5), x2: C[0] + Math.cos(a) * (r + 12), y2: C[1] + Math.sin(a) * (r + 12), stroke: on ? l.color : '#777', 'stroke-width': 3, 'stroke-linecap': 'round' }, g); }
          g.addEventListener('pointerdown', (e) => { e.stopPropagation(); KulEd.pick('lamp', l.id); });
        }
      };
      const gizmo = (svg, proj, size) => {
        if (!o || o.x == null || o.w == null && s.t !== 'lamp') return;
        const c = [o.x, o.y, o.z], C = proj(c); if (!C[2]) return;
        if (s.t === 'plane') {
          const cs = [[0, 0], [o.w, 0], [o.w, o.h], [0, o.h]].map(([u, v]) => proj(K().local(o, u, v)));
          if (cs.every((q) => q[2])) S('polygon', { points: cs.map((q) => q[0] + ',' + q[1]).join(' '), fill: 'none', stroke: '#9d6bff', 'stroke-width': 3 }, svg);
        }
        for (const [key, d, col] of AX) {
          const E = proj([c[0] + d[0] * size, c[1] + d[1] * size, c[2] + d[2] * size]); if (!E[2]) continue;
          const g = S('g', { class: 'kul-h' }, svg);
          S('line', { x1: C[0], y1: C[1], x2: E[0], y2: E[1], stroke: col, 'stroke-width': 5, 'stroke-linecap': 'round' }, g);
          S('line', { x1: C[0], y1: C[1], x2: E[0], y2: E[1], stroke: 'transparent', 'stroke-width': 22 }, g);
          const ang = Math.atan2(E[1] - C[1], E[0] - C[0]);
          S('polygon', { points: `${E[0] + Math.cos(ang) * 18},${E[1] + Math.sin(ang) * 18} ${E[0] + Math.cos(ang + 2.5) * 11},${E[1] + Math.sin(ang + 2.5) * 11} ${E[0] + Math.cos(ang - 2.5) * 11},${E[1] + Math.sin(ang - 2.5) * 11}`, fill: col }, g);
          S('text', { x: E[0] + Math.cos(ang) * 32 - 6, y: E[1] + Math.sin(ang) * 32 + 7, fill: col, 'font-size': 20, 'font-weight': 700 }, g).textContent = key.toUpperCase();
          g.addEventListener('pointerdown', (e) => KulEd.axisDrag(e, o, d, proj, svg));
        }
        S('circle', { cx: C[0], cy: C[1], r: 7, fill: '#fff', stroke: '#000', 'stroke-width': 2 }, svg);
      };
      lampIcons(camOv, (p) => cam.proj(p), false); gizmo(camOv, (p) => cam.proj(p), 110);
      // Schrägansicht: Kamera, Scroll-Bereich, Zonen, Sonnenrichtung
      const P = (p) => orb.proj(p);
      const poly = (pts, at) => S('polygon', Object.assign({ points: pts.map(P).map((q) => q[0] + ',' + q[1]).join(' '), fill: 'none' }, at), orbOv);
      const cx = cam.cam.x, cy = cam.cam.y, far = 1.9;
      const cor = [[-640, -360], [640, -360], [640, 360], [-640, 360]];
      const at0 = cor.map(([u, v]) => [cx + u, cy + v, 0]), atF = cor.map(([u, v]) => [cx + u * far, cy + v * far, 1000 - 1000 * far]);
      const lo = Number(k.cam.min) || 0, hi = Math.max(lo, Number(k.cam.max) || 0);
      poly([[lo - 640, cy - 360, 0], [hi + 640, cy - 360, 0], [hi + 640, cy + 360, 0], [lo - 640, cy + 360, 0]], { stroke: 'rgba(255,255,255,.35)', 'stroke-width': 2, 'stroke-dasharray': '10 8' });
      const floorY = Math.max(340, ...k.planes.filter((p) => p.kind === 'floor').map((p) => p.y));
      for (const z of k.zones) {
        const a = Math.min(z.x0, z.x1), b = Math.max(z.x0, z.x1), on = s.t === 'zone' && s.id === z.id;
        poly([[a + 8, floorY - 2, -292], [b - 8, floorY - 2, -292], [b - 8, floorY - 2, 142], [a + 8, floorY - 2, 142]], { stroke: '#ffcf5a', 'stroke-width': on ? 5 : 3, 'stroke-dasharray': '14 8', fill: on ? 'rgba(255,207,90,.14)' : 'rgba(255,207,90,.05)' });
        const L = P([(a + b) / 2, floorY, 210]); S('text', { x: L[0], y: L[1] + 30, fill: '#ffcf5a', 'font-size': 34, 'font-weight': 700, 'text-anchor': 'middle' }, orbOv).textContent = VN.t('Zone') + ': ' + z.name;
      }
      const Cc = P([cx, cy, 1000]);
      for (let i = 0; i < 4; i++) { const a = P(atF[i]); S('line', { x1: Cc[0], y1: Cc[1], x2: a[0], y2: a[1], stroke: 'rgba(255,190,220,.55)', 'stroke-width': 2 }, orbOv); }
      poly(at0, { stroke: '#ffd0e6', 'stroke-width': 3 }); poly(atF, { stroke: 'rgba(255,190,220,.4)', 'stroke-width': 2 });
      S('rect', { x: Cc[0] - 16, y: Cc[1] - 11, width: 32, height: 22, rx: 4, fill: '#ffd0e6' }, orbOv);
      S('text', { x: Cc[0], y: Cc[1] + 40, fill: '#ffd0e6', 'font-size': 30, 'text-anchor': 'middle' }, orbOv).textContent = VN.t('Kamera');
      if (k.sun && k.sun.on !== false && k.light !== false) {
        const D = K().sunDir(k, cam.day), ceil = Math.min(-360, ...k.planes.filter((p) => p.kind === 'ceil').map((p) => p.y));
        const A = [cx, ceil - 200, -500], B = [A[0] - D[0] * 600, A[1] - D[1] * 600, A[2] - D[2] * 600];
        const a = P(B), b = P(A), col = 'rgb(' + K().DAYCFG[cam.day].sun.map((x) => Math.round(x * 255)).join(',') + ')';
        S('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: col, 'stroke-width': 4, 'stroke-dasharray': '4 8', 'stroke-linecap': 'round' }, orbOv);
        const g = S('g', { class: 'kul-h', style: 'cursor:pointer' }, orbOv);
        S('circle', { cx: a[0], cy: a[1], r: 18, fill: col, stroke: s.t === 'sun' ? '#9d6bff' : 'none', 'stroke-width': 4 }, g);
        g.addEventListener('pointerdown', (e) => { e.stopPropagation(); KulEd.pick('sun'); });
        S('text', { x: a[0], y: a[1] - 28, fill: col, 'font-size': 30, 'text-anchor': 'middle' }, orbOv).textContent = VN.t(cam.day === 'night' ? 'Mond' : 'Sonne');
      }
      lampIcons(orbOv, P, true); gizmo(orbOv, P, 260);
    },
    axisDrag(e, o, d, proj, svg) {
      e.preventDefault(); e.stopPropagation(); KulEd._axis = true;
      const kx = svg.getBoundingClientRect().width / 1280;
      const c = [o.x, o.y, o.z], C = proj(c), E = proj([c[0] + d[0] * 100, c[1] + d[1] * 100, c[2] + d[2] * 100]);
      const sx = E[0] - C[0], sy = E[1] - C[1], L2 = sx * sx + sy * sy || 1, st = { x: o.x, y: o.y, z: o.z };
      VN.drag(e, (dx, dy) => {
        const t = (dx / kx * sx + dy / kx * sy) / L2 * 100;
        o.x = round(st.x + d[0] * t); o.y = round(st.y + d[1] * t); o.z = round(st.z + d[2] * t);
        KulEd._redraw(); KulEd.syncInsp(o);
      }, (dx, dy, moved) => {
        KulEd._axis = false;
        if (!moved) return;
        const nv = { x: o.x, y: o.y, z: o.z }; Object.assign(o, st); VN.mutate(() => { Object.assign(o, nv); });
      });
    },
    bindOrbit(k, orb, box) {
      box.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || KulEd._axis) return;
        const o = KulEd.orbit(k), st = Object.assign({}, o), kx = box.getBoundingClientRect().width / 1280;
        KulEd._orbMoved = false;
        VN.drag(e, (dx, dy, ev) => {
          if (Math.abs(dx) + Math.abs(dy) > 4) KulEd._orbMoved = true;
          if (!KulEd._orbMoved) return;
          dx /= kx; dy /= kx;
          if (ev.shiftKey) { const b = st.b * Math.PI / 180; o.cx = st.cx - (dx * Math.cos(b)) / o.s; o.cz = st.cz - (dx * Math.sin(b)) / o.s; o.cy = st.cy - dy / o.s; }
          else { o.b = st.b + dx * 0.25; o.a = Math.max(-85, Math.min(10, st.a - dy * 0.25)); }
          orb.setOrbit(o); KulEd._redraw();
        }, () => setTimeout(() => { KulEd._orbMoved = false; }, 0));
      });
      box.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); const o = KulEd.orbit(k); o.s = Math.max(0.06, Math.min(1.6, o.s * Math.exp(-e.deltaY * 0.0015))); orb.setOrbit(o); KulEd._redraw(); }, { passive: false });
    },
    bindEdge(k, cam, box) {
      let v = 0, raf = 0, last = 0;
      const L = box.querySelector('.kul-edge.l'), R = box.querySelector('.kul-edge.r');
      const tick = (now) => {
        raf = 0; if (!v || !cam.back.isConnected) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const lo = Math.min(Number(k.cam.min) || 0, k.cam.x) - 900, hi = Math.max(Number(k.cam.max) || 0, k.cam.x) + 900;
        cam.cam.x = Math.max(lo, Math.min(hi, cam.cam.x + v * 900 * dt)); cam.apply();
        VN.ui.kulView[k.id] = round(cam.cam.x); if (KulEd._slider) KulEd._slider.value = cam.cam.x;
        KulEd._redraw(); raf = requestAnimationFrame(tick);
      };
      box.addEventListener('mousemove', (e) => {
        const r = box.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width;
        v = fx < 0.08 ? -(1 - fx / 0.08) : fx > 0.92 ? (fx - 0.92) / 0.08 : 0;
        L.classList.toggle('on', v < 0); R.classList.toggle('on', v > 0);
        if (v && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
      });
      box.addEventListener('mouseleave', () => { v = 0; L.classList.remove('on'); R.classList.remove('on'); });
    },
    syncInsp(o) { for (const key of ['x', 'y', 'z']) { const i = document.getElementById('kul-f-' + key); if (i && o[key] != null) i.value = o[key]; } },

    // ---------- Inspektor ----------
    inspector() {
      const k = KulEd.cur(), box = el('div', { class: 'insp' });
      if (!k) { box.append(el('div', null, el('h3', null, 'Kulissen')), el('div', { class: 'hint-box' }, 'Lege links eine Kulisse an.')); return box; }
      const s = VN.ui.kulSel || { t: 'set' }, o = KulEd.sel() || k;
      const live = () => { if (KulEd._redraw) KulEd._redraw(); };
      const numF = (label, obj, key, step, cls) => field(label, el('input', { type: 'number', id: cls ? 'kul-f-' + key : null, value: obj[key] != null ? obj[key] : 0, step: step || 5, onchange: (e) => VN.mutate(() => { obj[key] = Number(e.target.value); }) }));
      const rng = (label, obj, key, min, max, step, fmt, def) => {
        const val = obj[key] != null ? obj[key] : def, lab = el('div', { class: 'lbl' }, label + ': ' + fmt(val)); let old = val;
        return el('div', { class: 'field' }, lab, el('input', { type: 'range', min, max, step, value: val,
          onpointerdown: () => { old = obj[key] != null ? obj[key] : def; },
          oninput: (e) => { obj[key] = Number(e.target.value); lab.textContent = label + ': ' + fmt(obj[key]); live(); },
          onchange: (e) => commit(obj, key, Number(e.target.value), old) }));
      };
      const pct = (v) => Math.round(v * 100) + ' %';
      const dayChecks = (obj) => el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Eingeschaltet bei'),
        el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } }, ...K().DAYS.map(([d, n]) => check(n, obj.days && obj.days[d], (v) => VN.mutate(() => { obj.days = obj.days || {}; obj.days[d] = v; })))));
      const del = (list, item) => el('button', { class: 'btn danger', onclick: () => VN.mutate(() => { const i = list.indexOf(item); if (i >= 0) list.splice(i, 1); VN.ui.kulSel = null; }) }, 'Löschen');
      const cx = round(KulEd.viewX(k));

      if (s.t === 'set' || o === k) {
        box.append(el('div', null, el('h3', null, 'Kulisse'), el('div', { class: 'insp-title' }, k.name)),
          field('Name', el('input', { type: 'text', value: k.name, onchange: (e) => VN.mutate(() => { k.name = e.target.value || 'Kulisse'; }) })),
          card('Kamera und Scrollen',
            el('div', { class: 'grid2' }, numF('Start X', k.cam, 'x', 10), numF('Start Y', k.cam, 'y', 10)),
            el('div', { class: 'grid2' }, numF('Scrollen von X', k.cam, 'min', 10), numF('bis X', k.cam, 'max', 10)),
            el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
              el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { k.cam.x = cx; }) }, 'Aktuelle Ansicht = Start'),
              el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { k.cam.min = cx; if (k.cam.max < cx) k.cam.max = cx; }) }, '= linke Grenze'),
              el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { k.cam.max = cx; if (k.cam.min > cx) k.cam.min = cx; }) }, '= rechte Grenze')),
            check('Rand-Scrollen (Maus an den Bildrand)', k.scroll.edge !== false, (v) => VN.mutate(() => { k.scroll.edge = v; })),
            rng('Scroll-Tempo', k.scroll, 'speed', 200, 2000, 50, (v) => v + ' px/s', 900),
            el('div', { class: 'muted small' }, 'Gescrollt wird im Hub immer, in Szenen nur mit dem Haken „Rand-Scrollen“ am Hintergrund-Clip. Ist „bis X“ nicht größer als „von X“, steht die Kamera still.')),
          card('Licht',
            check('Licht und Schatten berechnen', k.light !== false, (v) => VN.mutate(() => { k.light = v; })),
            field('Tageszeit, wenn die Szene keine vorgibt', sel(k.day || 'day', K().DAYS, (v) => VN.mutate(() => { k.day = v; })))),
          el('div', { class: 'hint-box' }, el('strong', null, 'Tipps'), el('br'),
            'Pro Raumwand ein eigenes PNG (etwa 2000–4000 px breit) statt eines Riesenbilds. Fenster und Türen: Stellen im PNG durchsichtig machen. Halbdurchsichtig = Glas.', el('br'),
            'Figuren und Hub-Objekte stehen auf der Ebene Z = 0. Was weiter vorne liegt (Balken, Pflanzen), wird vor den Figuren gezeichnet.'));
        return box;
      }
      if (s.t === 'sun') {
        const sun = k.sun;
        box.append(el('div', null, el('h3', null, 'Fensterlicht'), el('div', { class: 'insp-title' }, 'Sonne und Mond')),
          el('div', { class: 'hint-box' }, 'Scheint von draußen durch alle Fenster. Wände, Böden und Decken sind Hindernisse, Möbel und Figuren nicht. Hat eine Rückwand eine Jalousie, fällt das Licht in Streifen.'),
          check('aktiv', sun.on !== false, (v) => VN.mutate(() => { sun.on = v; })),
          rng('Stärke', sun, 'power', 0, 2, 0.05, pct, 1),
          rng('Lichtstrahlen in der Luft', sun, 'shafts', 0, 1.5, 0.05, pct, 0.7),
          check('Farbe und Richtung nach Tageszeit', sun.auto !== false, (v) => VN.mutate(() => { sun.auto = v; })),
          sun.auto === false ? rng('Richtung', sun, 'hAng', -80, 80, 1, (v) => v + '°', 30) : null,
          sun.auto === false ? rng('Höhe', sun, 'vAng', 5, 85, 1, (v) => v + '°', 35) : null,
          el('div', { class: 'muted small' }, 'Nach Tageszeit: morgens flach von links und warm, mittags steil, abends orange von rechts, nachts schwaches Mondlicht.'),
          dayChecks(sun));
        return box;
      }
      if (s.t === 'lamp') {
        const l = o;
        box.append(el('div', null, el('h3', null, 'Lampe'), el('div', { class: 'insp-title' }, l.name)),
          field('Name', el('input', { type: 'text', value: l.name, onchange: (e) => VN.mutate(() => { l.name = e.target.value; }) })),
          field('Farbe', el('input', { type: 'color', value: l.color, onchange: (e) => VN.mutate(() => { l.color = e.target.value; }) })),
          el('div', { class: 'grid3' }, numF('X', l, 'x', 5, 1), numF('Y', l, 'y', 5, 1), numF('Z · Tiefe', l, 'z', 5, 1)),
          rng('Stärke', l, 'power', 0, 2.5, 0.05, pct, 1),
          rng('Reichweite', l, 'range', 150, 1600, 10, (v) => v + ' px', 620),
          check('Wände werfen Schatten', l.shadows !== false, (v) => VN.mutate(() => { l.shadows = v; })),
          dayChecks(l),
          el('div', { class: 'muted small' }, 'Die Lampe schaltet sich je nach Tageszeit der Szene automatisch ein oder aus.'),
          del(k.lamps, l));
        return box;
      }
      if (s.t === 'zone') {
        const z = o;
        box.append(el('div', null, el('h3', null, 'Zone'), el('div', { class: 'insp-title' }, z.name)),
          field('Name', el('input', { type: 'text', value: z.name, onchange: (e) => VN.mutate(() => { z.name = e.target.value; }) })),
          el('div', { class: 'grid2' }, numF('Von X', z, 'x0', 10), numF('Bis X', z, 'x1', 10)),
          el('div', { class: 'row gap8' },
            el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { z.x0 = cx - 450; z.x1 = cx + 450; }) }, 'Um aktuelle Ansicht legen')),
          field('Musik beim Betreten', VN.assetSelect('audio', z.music, (v) => VN.mutate(() => { z.music = v; }))),
          field('Geräusch-Schleife (Atmo)', VN.assetSelect('audio', z.ambient, (v) => VN.mutate(() => { z.ambient = v; }))),
          el('div', { class: 'muted small' }, 'Fährt die Kamera in diese Zone (Rand-Scrollen im Hub oder in der Szene), wechselt die Musik und die Atmo läuft in Schleife.'),
          del(k.zones, z));
        return box;
      }
      // Fläche
      const p = o;
      const kinds = K().KINDS;
      box.append(el('div', null, el('h3', null, VN.t(K().kindName(p.kind))), el('div', { class: 'insp-title' }, p.name)),
        field('Name', el('input', { type: 'text', value: p.name, onchange: (e) => VN.mutate(() => { p.name = e.target.value; }) })),
        field('Art', sel(p.kind, kinds, (v) => VN.mutate(() => { p.kind = v; if (v === 'part' && !p.part) p.part = Object.assign({ particles: 'rain' }, Fx.PART_DEF.rain); }))));
      if (p.kind !== 'part') {
        const fitBtn = el('button', { class: 'btn tiny', onclick: () => { const u = VN.assetUrl(p.asset); if (!u) return; const im = new Image(); im.onload = () => VN.mutate(() => { p.h = round(p.w * im.naturalHeight / im.naturalWidth); }); im.src = u; } }, 'Höhe nach Bild');
        box.append(field('Bild (PNG)', VN.assetSelect('image', p.asset, (v) => VN.mutate(() => { p.asset = v; }))),
          el('details', { class: 'kul-days' }, el('summary', null, 'Eigene Bilder je Tageszeit (optional)'),
            el('div', { class: 'muted small' }, 'Ohne eigenes Bild wird automatisch eingefärbt oder beleuchtet. Praktisch für den Himmel: Sterne, Sonne, Abendrot.'),
            ...K().DAYS.map(([d, n]) => field(n, VN.assetSelect('image', (p.dayAssets || {})[d], (v) => VN.mutate(() => { p.dayAssets = p.dayAssets || {}; p.dayAssets[d] = v; }))))),
          el('div', { class: 'row gap8' }, fitBtn));
      } else {
        const c = p.part = p.part || Object.assign({ particles: 'rain' }, Fx.PART_DEF.rain);
        box.append(card('Partikel',
          field('Art', sel(c.particles, Fx.PARTICLES, (v) => VN.mutate(() => { Object.assign(c, Fx.PART_DEF[v], { particles: v }); }))),
          field('Farbe', el('input', { type: 'color', value: c.color || '#ffffff', onchange: (e) => VN.mutate(() => { c.color = e.target.value; }) })),
          el('div', { class: 'grid2' },
            field('Dichte', el('input', { type: 'number', value: c.density, onchange: (e) => VN.mutate(() => { c.density = Number(e.target.value); }) })),
            field('Tempo', el('input', { type: 'number', value: c.speed, onchange: (e) => VN.mutate(() => { c.speed = Number(e.target.value); }) })),
            field('Größe', el('input', { type: 'number', value: c.size, onchange: (e) => VN.mutate(() => { c.size = Number(e.target.value); }) })),
            field('Wind', el('input', { type: 'number', value: c.wind, onchange: (e) => VN.mutate(() => { c.wind = Number(e.target.value); }) }))),
          el('div', { class: 'muted small' }, 'Eine Partikel-Fläche ist ein Fenster, in dem es regnet oder schneit. In die Tiefe gestellt, bewegt sie sich beim Scrollen mit dem passenden Parallax. Für mehr Tiefe zwei Flächen hintereinander.')));
      }
      box.append(
        el('div', { class: 'grid3' }, numF('X', p, 'x', 5, 1), numF('Y', p, 'y', 5, 1), numF('Z · Tiefe', p, 'z', 5, 1)),
        rng('Kippen (X)', p, 'rx', -180, 180, 1, (v) => v + '°', 0),
        rng('Drehen (Y)', p, 'ry', -180, 180, 1, (v) => v + '°', 0),
        rng('Rollen (Z)', p, 'rz', -180, 180, 1, (v) => v + '°', 0),
        el('div', { class: 'grid2' }, numF('Breite', p, 'w', 10), numF('Höhe', p, 'h', 10)),
        el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
          el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { p.rx = 0; p.ry = 0; p.rz = 0; }) }, 'Gerade nach vorn'),
          el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { p.rx = 90; p.ry = 0; p.rz = 0; }) }, 'Als Boden / Decke'),
          el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { p.rx = 0; p.ry = 90; p.rz = 0; }) }, 'Als Zwischenwand')),
        field('Ebene', sel(p.front || '', [['', 'Automatisch nach Tiefe'], ['front', 'Immer vor den Figuren'], ['back', 'Immer hinter den Figuren']], (v) => VN.mutate(() => { p.front = v || undefined; }))));
      if (p.kind === 'wall') {
        const b = p.blinds || {};
        box.append(card('Jalousie',
          check('Jalousie an den Fenstern dieser Wand', b.on, (v) => VN.mutate(() => { p.blinds = Object.assign({ gap: 20, open: 0.55 }, p.blinds || {}, { on: v }); })),
          b.on ? rng('Lamellen-Abstand', b, 'gap', 6, 80, 1, (v) => v + ' px', 20) : null,
          b.on ? rng('Öffnung', b, 'open', 0.1, 0.95, 0.01, pct, 0.55) : null));
      }
      if (p.kind === 'side') box.append(check('Außenwand (wird nur von innen beleuchtet)', p.outer, (v) => VN.mutate(() => { p.outer = v; })));
      if (p.kind === 'deco' || p.kind === 'beam') box.append(check('Vom Licht der Kulisse beleuchten', p.lit !== false, (v) => VN.mutate(() => { p.lit = v; })));
      const tips = { beam: 'Steht der Balken genau auf der Tiefe der Wandkante, bewegt er sich beim Scrollen exakt mit und verdeckt die dünne Kante.', side: 'Um 90° gedreht. Beim Scrollen sieht man ihre Seitenfläche wie bei einem Puppenhaus. Für Licht ist sie ein Hindernis, durch eine durchsichtige Tür kommt es durch.', deco: 'Möbel werden beleuchtet, werfen aber keinen Schatten auf Wände.', bg: 'Hintergründe werden nicht beleuchtet, aber nach Tageszeit eingefärbt – oder du gibst eigene Bilder je Tageszeit an.' };
      if (tips[p.kind]) box.append(el('div', { class: 'muted small' }, tips[p.kind]));
      const btns = el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } });
      if (p.kind === 'beam') btns.appendChild(el('button', { class: 'btn primary', onclick: () => {
        let best = null; for (const q of k.planes) if (q.kind === 'side' && (!best || Math.abs(q.x - p.x) < Math.abs(best.x - p.x))) best = q;
        if (!best) return;
        const front = Math.max(...[[0, 0], [best.w, 0], [best.w, best.h], [0, best.h]].map(([u, v]) => K().local(best, u, v)[2]));
        VN.mutate(() => { p.x = best.x; p.z = round(front + 14); p.rx = p.ry = p.rz = 0; });
      } }, 'An Wandkante einrasten'));
      btns.append(
        el('button', { class: 'btn', onclick: () => VN.mutate(() => { const c = JSON.parse(JSON.stringify(p)); c.id = VN.uid('kp'); c.name = p.name + ' ' + VN.t('Kopie'); c.x += 60; k.planes.push(c); VN.ui.kulSel = { t: 'plane', id: c.id }; }) }, 'Duplizieren'),
        del(k.planes, p));
      box.append(btns);
      return box;
    }
  });
})();
