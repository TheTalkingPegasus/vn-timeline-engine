// Kulissen-Raum (0.9.32): echte 3D-Kulisse aus PNG-Flächen statt flacher Parallax-Ebenen.
// Jede Fläche hat Position (x, y, z) und Drehung. Die Kamera schaut mit Perspektive darauf – Parallax entsteht von selbst.
// Koordinaten: 1280 × 720 = sichtbares Bild auf der Ebene z = 0 (dort stehen Figuren und Hub-Objekte), y nach unten, z zum Betrachter.
// Licht: Umgebungslicht + Fensterlicht (Sonne/Mond) + Lampen. Wände, Böden und Decken sind Hindernisse, durchsichtige
// Stellen im PNG (Fenster, Türen) lassen Licht durch, eine Jalousie an der Wand macht Streifen daraus. Das Licht wird beim
// Laden einmal pro Tageszeit in die Flächen „eingebacken“ – im Spiel kostet es danach nichts mehr.
// Daten: VN.project.kulissen = [{ id, name, planes, lamps, sun, zones, cam, scroll, light }]
(function () {
  const W = 1280, H = 720, P0 = 1000, P2 = 2600;
  const KINDS = [['wall', 'Rückwand'], ['floor', 'Boden'], ['ceil', 'Decke'], ['side', 'Zwischenwand / Seitenwand'], ['beam', 'Balken / Kante'], ['deco', 'Möbel / Objekt'], ['bg', 'Hintergrund (Himmel, Landschaft)'], ['part', 'Partikel (Regen, Schnee …)']];
  const OCC = { wall: 1, floor: 1, ceil: 1, side: 1 };
  const DAYS = [['morning', 'Morgen'], ['day', 'Tag'], ['evening', 'Abend'], ['night', 'Nacht']];
  const LTYPES = [['lamp', 'Lampe (rundum)'], ['spot', 'Scheinwerfer'], ['neon', 'Neonröhre']];
  // Umgebungslicht, Sonne/Mond (Farbe, Stärke, Richtung) je Tageszeit
  const DAYCFG = {
    morning: { amb: [0.6, 0.6, 0.68], sun: [1, 0.84, 0.62], sunP: 0.62, dir: [0.62, 0.42, 0.66] },
    day: { amb: [0.8, 0.8, 0.82], sun: [1, 0.97, 0.9], sunP: 0.55, dir: [0.18, 0.82, 0.55] },
    evening: { amb: [0.48, 0.42, 0.44], sun: [1, 0.6, 0.34], sunP: 0.7, dir: [-0.66, 0.36, 0.66] },
    night: { amb: [0.2, 0.22, 0.32], sun: [0.55, 0.66, 1], sunP: 0.3, dir: [-0.3, 0.55, 0.78] }
  };
  const rad = (d) => d * Math.PI / 180;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const hex3 = (h) => { const n = parseInt(String(h || '#ffffff').slice(1), 16) || 0; return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const num = (v, d) => (v != null && isFinite(v) ? Number(v) : d);

  const Kulisse = (window.Kulisse = {
    W, H, P0, KINDS, DAYS, DAYCFG, LTYPES,
    all() { const p = VN.project; if (!p) return []; p.kulissen = p.kulissen || []; return p.kulissen; },
    get(id) { return id ? Kulisse.all().find((k) => k.id === id) || null : null; },
    kindName(k) { const f = KINDS.find((x) => x[0] === k); return f ? f[1] : k; },

    // ---------- Anlegen ----------
    plane(o) {
      return Object.assign({ id: VN.uid('kp'), name: 'Fläche', kind: 'wall', asset: null, dayAssets: {}, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, w: 900, h: 700 }, o);
    },
    lamp(o) {
      return Object.assign({ id: VN.uid('kl'), name: 'Lampe', type: 'lamp', x: 0, y: -100, z: -100, color: '#ffc77a', power: 1, range: 620, shadows: true, days: { morning: false, day: false, evening: true, night: true } }, o);
    },
    blank(name, tpl) {
      const k = {
        id: VN.uid('kul'), name: name || 'Kulisse', planes: [], lamps: [], zones: [], light: true,
        sun: { on: true, power: 1, shafts: 0.7, auto: true, hAng: 30, vAng: 35, days: { morning: true, day: true, evening: true, night: true } },
        cam: { x: 0, y: 0, min: 0, max: 0 }, scroll: { edge: true, speed: 2000 }, day: 'day'
      };
      if (tpl === 'room') Kulisse.addRoom(k, 0, 'Raum');
      return k;
    },
    // Raum aus Rückwand, Boden, Decke und zwei Seitenwänden – Breite 900, Tiefe 450
    // Maßstab (0.9.33): eine Figur, die wie üblich das Bild vom Kopf bis zur Hüfte füllt, ist im Ganzen etwa 1100 hoch.
    // Raumhöhe 1600, Türen 520 × 1150, Boden bei y = 820, Rückwand standardmäßig bei z = -2000.
    S: { FLOOR: 820, CEIL: -780, BACK: -2000, FRONT: 150, H: 1600, DOOR_W: 520, DOOR_H: 1150 },
    addRoom(k, cx, name, w, back) {
      const S = Kulisse.S, P = Kulisse.plane, t = (x) => (VN.t ? VN.t(x) : x);
      w = w || 3600; const B = back || S.BACK, D = S.FRONT - B, Y = (S.FLOOR + S.CEIL) / 2;
      k.planes.push(
        P({ name: name + ' · ' + t('Rückwand'), kind: 'wall', x: cx, y: Y, z: B, w, h: S.H }),
        P({ name: name + ' · ' + t('Boden'), kind: 'floor', x: cx, y: S.FLOOR, z: B + D / 2, w, h: D, rx: 90 }),
        P({ name: name + ' · ' + t('Decke'), kind: 'ceil', x: cx, y: S.CEIL, z: B + D / 2, w, h: D, rx: 90 }),
        P({ name: name + ' · ' + t('Wand links'), kind: 'side', x: cx - w / 2, y: Y, z: B + D / 2, w: D, h: S.H, ry: 90 }),
        P({ name: name + ' · ' + t('Wand rechts'), kind: 'side', x: cx + w / 2, y: Y, z: B + D / 2, w: D, h: S.H, ry: 90 }));
      return k;
    },
    // Öffnungen (Fenster, Türen) als Daten: werden aus jedem Bild ausgeschnitten – auch aus Platzhaltern
    win(u0, u1, small) { return small ? { u0, u1, v0: 0.22, v1: 0.45, t: 'win' } : { u0, u1, v0: 0.19, v1: 0.69, t: 'win' }; },
    door(uc, wall, w) { const S = Kulisse.S, hw = (w || S.DOOR_W) / wall / 2; return { u0: uc - hw, u1: uc + hw, v0: 1 - S.DOOR_H / S.H, v1: 1, t: 'door' }; },

    // ---------- Vorlagen (0.9.33): nur Räume – Wände, Böden, Decken, Türen, Fenster, Kanten, Zonen, Licht ----------
    // rooms: [{ n: Name, w: Breite, win: Anzahl Fenster (Rückwand), small: kleine Fenster, door: Tür in der Rückwand (0–1), solid: Wand links ohne Tür }]
    build(name, rooms, o = {}) {
      const S = Kulisse.S, P = Kulisse.plane, t = (x) => (VN.t ? VN.t(x) : x);
      const k = Kulisse.blank(name), B = o.back || S.BACK, D = S.FRONT - B, Y = (S.FLOOR + S.CEIL) / 2;
      const work = o.work ? { morning: true, day: true, evening: true, night: false } : { morning: false, day: false, evening: true, night: true };
      const total = rooms.reduce((a, r) => a + r.w, 0);
      let left = -total / 2;
      const side = (x, nm, i, last) => {
        const outer = i === 0 || last, holes = outer || (rooms[i] && rooms[i].solid) ? [] : [Kulisse.door(0.5, D)];
        k.planes.push(P({ name: nm, kind: 'side', x, y: Y, z: B + D / 2, w: D, h: S.H, ry: last ? -90 : 90, outer: outer || undefined, holes }));
        k.planes.push(P({ name: t('Kante') + ' ' + (i + 1), kind: 'beam', x, y: 0, z: S.FRONT + 14, w: 140, h: 2400 }));
      };
      rooms.forEach((r, i) => {
        const cx = left + r.w / 2, holes = [];
        for (let j = 0; j < (r.win || 0); j++) { const span = 1 / r.win, m = span * 0.14; holes.push(Kulisse.win(j * span + m, (j + 1) * span - m, r.small)); }
        if (r.doors) for (const u of r.doors) holes.push(Kulisse.door(u, r.w));
        side(left, i === 0 ? t('Außenwand links') : t('Wand') + ' ' + rooms[i - 1].n + ' | ' + r.n, i, false);
        k.planes.push(
          P({ name: r.n + ' · ' + t('Rückwand'), kind: 'wall', x: cx, y: Y, z: B, w: r.w, h: S.H, holes, blinds: r.win && o.blinds ? { on: true, gap: 40, open: 0.55 } : undefined }),
          P({ name: r.n + ' · ' + t('Boden'), kind: 'floor', x: cx, y: S.FLOOR, z: B + D / 2, w: r.w, h: D, rx: 90 }),
          P({ name: r.n + ' · ' + t('Decke'), kind: 'ceil', x: cx, y: S.CEIL, z: B + D / 2, w: r.w, h: D, rx: 90 }));
        const nl = Math.max(1, Math.round(r.w / (o.lampEvery || 3600)));
        for (let j = 0; j < nl; j++) k.lamps.push(Kulisse.lamp({ name: t('Licht') + ' ' + r.n + (nl > 1 ? ' ' + (j + 1) : ''), x: Math.round(left + r.w * (j + 0.5) / nl), y: S.CEIL + 60, z: Math.round(B * 0.45), color: o.work ? '#eef4ff' : '#ffd29a', power: 0.85, range: Math.round(Math.max(1800, D * 1.2)), days: Object.assign({}, work) }));
        k.zones.push({ id: VN.uid('kz'), name: r.n, x0: Math.round(left), x1: Math.round(left + r.w), music: null, ambient: null });
        left += r.w;
      });
      side(left, t('Außenwand rechts'), rooms.length, true);
      const lo = Math.round(-total / 2 + 700), hi = Math.round(total / 2 - 700);
      k.cam = lo <= hi ? { x: lo, y: 0, min: lo, max: hi } : { x: 0, y: 0, min: 0, max: 0 };
      k.scroll = { edge: true, speed: 2200 };
      return k;
    },
    TEMPLATES: [
      ['office', 'Büroetage', () => [{ n: 'Empfang', w: 3600, doors: [0.75] }, { n: 'Großraumbüro', w: 4400, win: 4 }, { n: 'Besprechung', w: 3200, win: 2 }, { n: 'Chefbüro', w: 3200, win: 2 }, { n: 'Teeküche', w: 2600, win: 1 }], { work: true, blinds: true }],
      ['classroom', 'Klassenzimmer', () => [{ n: 'Klassenzimmer', w: 5200, win: 4 }], { work: true }],
      ['schoolhall', 'Schulflur', () => [{ n: 'Schulflur', w: 9600, doors: [0.12, 0.37, 0.62, 0.87] }], { work: true, back: -1100, lampEvery: 2400 }],
      ['corridor', 'Korridor', () => [{ n: 'Korridor', w: 10800, doors: [0.1, 0.3, 0.5, 0.7, 0.9] }], { work: true, back: -900, lampEvery: 1800 }],
      ['hall', 'Flur', () => [{ n: 'Flur', w: 3000, doors: [0.3, 0.75] }], { back: -1000 }],
      ['living', 'Wohnzimmer', () => [{ n: 'Wohnzimmer', w: 4200, win: 2 }], {}],
      ['kitchen', 'Küche', () => [{ n: 'Küche', w: 3000, win: 1 }], {}],
      ['bath', 'Badezimmer', () => [{ n: 'Badezimmer', w: 2400, win: 1, small: true }], { back: -1500 }],
      ['bedroom', 'Schlafzimmer', () => [{ n: 'Schlafzimmer', w: 3400, win: 1 }], {}],
      ['shop', 'Einkaufsladen', () => [{ n: 'Verkaufsraum', w: 5600, doors: [0.85] }], { work: true, lampEvery: 1900 }],
      ['flat', 'Wohnung', () => [{ n: 'Flur', w: 2600, doors: [0.5] }, { n: 'Wohnzimmer', w: 4200, win: 2 }, { n: 'Küche', w: 3000, win: 1 }, { n: 'Badezimmer', w: 2400, win: 1, small: true }, { n: 'Schlafzimmer', w: 3400, win: 1 }], {}]
    ],
    fromTemplate(id) {
      const T = Kulisse.TEMPLATES.find((x) => x[0] === id); if (!T) return null;
      const t = (x) => (VN.t ? VN.t(x) : x);
      return Kulisse.build(t(T[1]), T[2]().map((r) => Object.assign({}, r, { n: t(r.n) })), T[3]);
    },
    // Vorschaubild einer Vorlage: Räume von vorne, Fenster hell, Türen dunkel
    thumb(id) {
      Kulisse._thumbs = Kulisse._thumbs || {};
      if (Kulisse._thumbs[id]) return Kulisse._thumbs[id];
      const k = Kulisse.fromTemplate(id), walls = k.planes.filter((p) => p.kind === 'wall');
      const x0 = Math.min(...walls.map((p) => p.x - p.w / 2)), x1 = Math.max(...walls.map((p) => p.x + p.w / 2));
      const c = document.createElement('canvas'); c.width = 320; c.height = 150; const g = c.getContext('2d');
      g.fillStyle = '#1b1d24'; g.fillRect(0, 0, c.width, c.height);
      const sc = Math.min(300 / (x1 - x0), 120 / Kulisse.S.H), ox = (c.width - (x1 - x0) * sc) / 2, oy = (c.height - Kulisse.S.H * sc) / 2;
      for (const p of walls) {
        const x = ox + (p.x - p.w / 2 - x0) * sc, w = p.w * sc, h = Kulisse.S.H * sc;
        g.fillStyle = '#5d6170'; g.fillRect(x, oy, w, h);
        g.fillStyle = '#7d6a58'; g.fillRect(x, oy + h - 6, w, 6);
        for (const o of p.holes || []) { g.fillStyle = o.t === 'door' ? '#2a2c34' : '#9cc6ec'; g.fillRect(x + o.u0 * w, oy + o.v0 * h, (o.u1 - o.u0) * w, (o.v1 - o.v0) * h); }
        g.fillStyle = '#c9ccd6'; g.fillRect(x - 1, oy, 2, h);
      }
      g.fillStyle = '#c9ccd6'; g.fillRect(ox + (x1 - x0) * sc - 1, oy, 2, Kulisse.S.H * sc);
      return (Kulisse._thumbs[id] = c.toDataURL());
    },

    // ---------- Mathe (identisch zu den CSS-Transformationen) ----------
    local(p, u, v) {
      let x = u - p.w / 2, y = v - p.h / 2, z = 0, a;
      a = rad(p.rz || 0); [x, y] = [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
      a = rad(p.rx || 0); [y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
      a = rad(p.ry || 0); [x, z] = [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
      return [x + p.x, y + p.y, z + p.z];
    },
    frame(p) { const L = Kulisse.local, O = L(p, 0, 0), U = sub(L(p, 1, 0), O), V = sub(L(p, 0, 1), O); let N = cross(U, V); const n = Math.hypot(...N) || 1; N = N.map((x) => x / n); return { O, U, V, N }; },
    css(p) { return `translate3d(${p.x}px,${p.y}px,${p.z}px) rotateY(${p.ry || 0}deg) rotateX(${p.rx || 0}deg) rotateZ(${p.rz || 0}deg) translate(${-p.w / 2}px,${-p.h / 2}px)`; },
    // Liegt die Fläche ganz vor der Figuren-Ebene? Dann wird sie vor den Figuren gezeichnet.
    isFront(p) { if (p.front === 'back') return false; if (p.front === 'front') return true; const L = Kulisse.local; return Math.min(L(p, 0, 0)[2], L(p, p.w, 0)[2], L(p, p.w, p.h)[2], L(p, 0, p.h)[2]) > 20; },
    camOf(k, cam, extra) {
      cam = cam || {};
      const z = Math.max(0.2, num(cam.zoom, 100) / 100);
      return { x: num(k.cam && k.cam.x, 0) + num(cam.panX, 0) / 100 * W + (extra ? extra.x : 0), y: num(k.cam && k.cam.y, 0) + num(cam.panY, 0) / 100 * H, dz: P0 * (1 - 1 / z), rot: num(cam.rot, 0) };
    },
    projCam(c, p) { const x = p[0] - c.x, y = p[1] - c.y, z = p[2] + c.dz; const f = P0 / (P0 - z); return [W / 2 + x * f, H / 2 + y * f, P0 - z > 1]; },
    orbMat(o, p) {
      let x = (p[0] - o.cx) * o.s, y = (p[1] - o.cy) * o.s, z = (p[2] - o.cz) * o.s, a = rad(o.b);
      [x, z] = [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
      a = rad(o.a); [y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
      return [x, y, z];
    },
    projOrb(o, p) { const [x, y, z] = Kulisse.orbMat(o, p); const f = P2 / (P2 - z); return [W / 2 + x * f, H / 2 + y * f, P2 - z > 1]; },
    orbCss(o) { return `rotateX(${o.a}deg) rotateY(${o.b}deg) scale3d(${o.s},${o.s},${o.s}) translate3d(${-o.cx}px,${-o.cy}px,${-o.cz}px)`; },
    orbDefault(k) {
      const xs = k.planes.filter((p) => p.kind !== 'bg').map((p) => p.x);
      const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
      const span = xs.length ? Math.max(...xs) - Math.min(...xs) + 900 : 1800;
      const zs = k.planes.filter((p) => p.kind === 'wall').map((p) => p.z), cz = zs.length ? Math.min(...zs) / 2 : -150;
      return { a: -28, b: -32, s: Math.max(0.03, Math.min(0.8, 1100 / span)), cx, cy: 0, cz };
    },
    // Scheinwerfer: Richtung aus Drehen (yaw) und Neigung (pitch); 0/0 = gerade nach hinten, Neigung 90 = senkrecht nach unten
    spotDir(l) { const yw = rad(num(l.yaw, 0)), pt = rad(num(l.pitch, 45)); return [Math.sin(yw) * Math.cos(pt), Math.sin(pt), -Math.cos(yw) * Math.cos(pt)]; },
    // Neonröhre: Strecke ab (x, y, z) mit Länge und Winkel (0 = waagrecht nach rechts)
    neonEnds(l) { const a = rad(num(l.angle, 0)), L = num(l.len, 300) / 2; return [[l.x - Math.cos(a) * L, l.y - Math.sin(a) * L, l.z], [l.x + Math.cos(a) * L, l.y + Math.sin(a) * L, l.z]]; },
    prepLamp(l) {
      const o = Object.assign({}, l, { c: hex3(l.color), range: num(l.range, l.type === 'spot' ? 1200 : 600), power: num(l.power, 1), type: l.type || 'lamp' });
      if (o.type === 'spot') { o.dir = Kulisse.spotDir(l); const sp = rad(Math.max(2, num(l.spread, 22))); o.cosOut = Math.cos(sp); o.cosIn = Math.cos(sp * (1 - 0.85 * num(l.soft, 0.4))); }
      if (o.type === 'neon') [o.A, o.B] = Kulisse.neonEnds(l);
      return o;
    },
    // Beitrag einer Lampe an Punkt S mit Normale N (one = nur Vorderseite) – mit Schatten
    lampAt(l, S, N, one, selfId, occ) {
      let P = [l.x, l.y, l.z];
      if (l.type === 'neon') { const v = sub(l.B, l.A), t = Math.max(0, Math.min(1, dot(sub(S, l.A), v) / (dot(v, v) || 1))); P = [l.A[0] + v[0] * t, l.A[1] + v[1] * t, l.A[2] + v[2] * t]; }
      const d0 = [P[0] - S[0], P[1] - S[1], P[2] - S[2]], d = Math.hypot(d0[0], d0[1], d0[2]); if (d > l.range || d < 0.01) return 0;
      const dir = [d0[0] / d, d0[1] / d, d0[2] / d]; let lam = N ? dot(N, dir) : 1; lam = one ? Math.max(0, lam) : Math.abs(lam);
      let att = (1 - d / l.range) ** 2 * (0.3 + 0.7 * lam);
      if (l.type === 'spot') { const c = -dot(dir, l.dir); if (c <= l.cosOut) return 0; att *= c >= l.cosIn ? 1 : ((c - l.cosOut) / Math.max(1e-4, l.cosIn - l.cosOut)) ** 2; att *= 1.6; }
      if (l.type === 'neon') att *= 0.85;
      if (att < 0.005) return 0;
      const t = l.shadows !== false && occ ? Kulisse.trace(S, dir, d, selfId, occ) : 1;
      return l.power * att * t * 1.25;
    },
    sunDir(k, day) {
      const s = k.sun || {};
      if (s.auto !== false) { const d = DAYCFG[day].dir, n = Math.hypot(...d); return d.map((x) => x / n); }
      const h = rad(num(s.hAng, 30)), v = rad(num(s.vAng, 35));
      return [Math.sin(h) * Math.cos(v), Math.sin(v), Math.cos(h) * Math.cos(v)];
    },
    dayKey(k, look, rs) {
      const d = VN.Life ? VN.Life.daytime(look, rs) : look && look.daytime;
      return DAYCFG[d] ? d : (k && DAYCFG[k.day] ? k.day : 'day');
    },
    zoneAt(k, x) { return (k.zones || []).find((z) => x >= Math.min(z.x0, z.x1) && x < Math.max(z.x0, z.x1)) || null; },
    clampX(k, x) { const lo = num(k.cam && k.cam.min, 0), hi = Math.max(lo, num(k.cam && k.cam.max, 0)); return Math.max(lo, Math.min(hi, x)); },

    // ---------- Bilder ----------
    _img: new Map(),
    image(url) {
      if (!url) return Promise.resolve(null);
      if (!Kulisse._img.has(url)) Kulisse._img.set(url, new Promise((res) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = url; }));
      return Kulisse._img.get(url);
    },
    placeholder(p) {
      const c = document.createElement('canvas'), s = Math.min(1, 512 / Math.max(p.w, p.h));
      c.width = Math.max(8, Math.round(p.w * s)); c.height = Math.max(8, Math.round(p.h * s));
      const g = c.getContext('2d');
      const col = { wall: '#6d6a78', floor: '#5a4f45', ceil: '#7b7480', side: '#625e6c', beam: '#4a3a30', deco: '#55606a', bg: '#3d4e6e', part: 'rgba(0,0,0,0)' }[p.kind] || '#666';
      g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;
      for (let x = 0; x < c.width; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
      for (let y = 0; y < c.height; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.55)'; g.font = Math.max(10, Math.min(28, c.height / 6)) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(p.name || '', c.width / 2, c.height / 2, c.width - 8);
      return c;
    },
    _alpha: new WeakMap(),
    alpha(src) {
      if (!src) return null;
      if (Kulisse._alpha.has(src)) return Kulisse._alpha.get(src);
      const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, s = Math.min(1, 400 / Math.max(sw, sh));
      const w = Math.max(1, Math.round(sw * s)), h = Math.max(1, Math.round(sh * s));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.drawImage(src, 0, 0, w, h);
      let d; try { d = g.getImageData(0, 0, w, h).data; } catch (e) { d = null; }
      const a = new Uint8Array(w * h);
      if (d) for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]; else a.fill(255);
      const out = { w, h, a };
      Kulisse._alpha.set(src, out);
      return out;
    },
    // Fenster und Türen = durchsichtige Bereiche im Bild (für Lichtstrahlen)
    _holes: new WeakMap(),
    holes(src) {
      if (!src) return [];
      if (Kulisse._holes.has(src)) return Kulisse._holes.get(src);
      const A = Kulisse.alpha(src), cs = Math.max(2, Math.round(A.w / 90)), gw = Math.ceil(A.w / cs), gh = Math.ceil(A.h / cs), m = new Uint8Array(gw * gh), out = [];
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) m[j * gw + i] = A.a[Math.min(A.h - 1, j * cs + (cs >> 1)) * A.w + Math.min(A.w - 1, i * cs + (cs >> 1))] < 60 ? 1 : 0;
      const seen = new Uint8Array(gw * gh);
      for (let s = 0; s < m.length; s++) {
        if (!m[s] || seen[s]) continue;
        let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0, edge = false; const st = [s]; seen[s] = 1;
        while (st.length) {
          const q = st.pop(), x = q % gw, y = (q / gw) | 0; n++;
          if (x === 0 || y === 0 || x === gw - 1 || y === gh - 1) edge = true;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue; const k = ny * gw + nx; if (m[k] && !seen[k]) { seen[k] = 1; st.push(k); } }
        }
        // Löcher am Bildrand (z. B. freigestellte Kanten) sind keine Fenster
        if (n > 12 && !edge) out.push({ u0: x0 * cs / A.w, v0: y0 * cs / A.h, u1: (x1 + 1) * cs / A.w, v1: (y1 + 1) * cs / A.h });
      }
      Kulisse._holes.set(src, out);
      return out;
    },
    // Öffnungen aus dem Bild ausschneiden (Kopie, zwischengespeichert)
    _cut: new WeakMap(),
    cut(p, src) {
      if (!src || !p.holes || !p.holes.length) return src;
      const key = JSON.stringify(p.holes), m = Kulisse._cut.get(src) || {};
      if (m[key]) return m[key];
      const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height, c = document.createElement('canvas');
      c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(src, 0, 0);
      for (const o of p.holes) g.clearRect(o.u0 * w, o.v0 * h, (o.u1 - o.u0) * w, (o.v1 - o.v0) * h);
      m[key] = c; Kulisse._cut.set(src, m);
      return c;
    },
    srcFor(p, day) { const id = (p.dayAssets && p.dayAssets[day]) || p.asset; return VN.assetUrl(id) || null; },
    async textures(k, day) {
      const out = new Map();
      await Promise.all(k.planes.map(async (p) => { if (p.kind === 'part') return; const im = await Kulisse.image(Kulisse.srcFor(p, day)); out.set(p.id, Kulisse.cut(p, im || Kulisse.placeholder(p))); }));
      return out;
    },

    // ---------- Licht einbacken ----------
    _bake: new Map(),
    bakeKey(k, day) { return JSON.stringify([k.planes, k.lamps, k.sun, k.light, k.cam && [k.cam.x, k.cam.y], day]); },
    async bake(k, day) {
      const key = k.id + '|' + Kulisse.bakeKey(k, day);
      if (Kulisse._bake.has(key)) return Kulisse._bake.get(key);
      const job = (async () => {
        const tex = await Kulisse.textures(k, day);
        const res = { planes: new Map(), shafts: [], glows: [] };
        const C = DAYCFG[day], lit = k.light !== false;
        const sun = k.sun || {}, sunOn = lit && sun.on !== false && (!sun.days || sun.days[day] !== false);
        const ctx = { D: Kulisse.sunDir(k, day), sunOn, sunCol: C.sun, sunP: C.sunP * num(sun.power, 1), amb: C.amb,
          lamps: lit ? (k.lamps || []).filter((l) => l.days && l.days[day]).map(Kulisse.prepLamp) : [],
          view: [num(k.cam && k.cam.x, 0), num(k.cam && k.cam.y, 0), P0] };
        const occ = lit ? k.planes.filter((p) => OCC[p.kind] && tex.get(p.id)).map((p) => ({ p, f: Kulisse.frame(p), al: Kulisse.alpha(tex.get(p.id)), bl: p.blinds && p.blinds.on ? p.blinds : null })) : [];
        for (const p of k.planes) {
          if (p.kind === 'part') continue;
          const src = tex.get(p.id);
          res.planes.set(p.id, Kulisse.paint(p, src, lit && p.kind !== 'bg' && p.lit !== false ? ctx : null, occ, day));
          await new Promise((r) => setTimeout(r, 0)); // Oberfläche nicht blockieren
        }
        if (sunOn && num(sun.shafts, 0.7) > 0) res.shafts = Kulisse.shafts(k, tex, ctx, day);
        res.glows = ctx.lamps.map((l) => Object.assign(Kulisse.glowOf(l), { c: l.c, z: l.z }));
        res.ctx = ctx; res.occ = occ;
        return res;
      })();
      Kulisse._bake.set(key, job);
      if (Kulisse._bake.size > 12) Kulisse._bake.delete(Kulisse._bake.keys().next().value);
      return job;
    },
    // Sichtbarer Schein einer Lampe: Lichtkreis, Neon-Balken oder Lichtkegel im Raum
    glowOf(l) {
      const c = l.c.map((x) => Math.round(x * 255)).join(','), out = { els: [] };
      if (l.type === 'neon') {
        const len = num(l.len, 300), th = 40 + l.power * 40;
        out.els.push({ w: len + th * 2, h: th * 2, t: `translate3d(${l.x}px,${l.y}px,${l.z + 2}px) rotateZ(${num(l.angle, 0)}deg) translate(-50%,-50%)`,
          bg: `linear-gradient(to bottom, rgba(${c},0), rgba(${c},.28) 38%, rgba(255,255,255,.95) 47%, rgba(255,255,255,.95) 53%, rgba(${c},.28) 62%, rgba(${c},0))`, r: th + 'px' });
        return out;
      }
      const s = 120 + l.power * 90;
      out.els.push({ w: s * 2, h: s * 2, t: `translate3d(${l.x - s}px,${l.y - s}px,${l.z + 2}px)`, bg: `radial-gradient(circle, rgba(${c},.85) 0, rgba(${c},.35) 12%, rgba(${c},.08) 45%, rgba(${c},0) 70%)`, r: '50%' });
      if (l.type === 'spot' && num(l.haze, 0.5) > 0) {
        // Lichtkegel: drei Dreiecke um die Achse, nach vorne ausgeblendet
        const D = l.dir, len = l.range * 0.9, wdt = Math.tan(Math.acos(l.cosOut)) * len, a = num(l.haze, 0.5) * 0.22;
        let up = Math.abs(D[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
        const s1 = cross(D, up), n1 = Math.hypot(...s1) || 1, e1 = s1.map((x) => x / n1), e2 = cross(D, e1);
        for (let i = 0; i < 3; i++) {
          const an = i * Math.PI / 3, P = [e1[0] * Math.cos(an) + e2[0] * Math.sin(an), e1[1] * Math.cos(an) + e2[1] * Math.sin(an), e1[2] * Math.cos(an) + e2[2] * Math.sin(an)];
          const U = D.map((x) => x * len), V = P.map((x) => x * wdt * 2), O = [l.x - V[0] / 2, l.y - V[1] / 2, l.z - V[2] / 2], Nn = cross(U, V), nn = Math.hypot(...Nn) || 1;
          out.els.push({ w: 100, h: 100, cone: true, t: `matrix3d(${U[0] / 100},${U[1] / 100},${U[2] / 100},0,${V[0] / 100},${V[1] / 100},${V[2] / 100},0,${Nn[0] / nn},${Nn[1] / nn},${Nn[2] / nn},0,${O[0]},${O[1]},${O[2]},1)`,
            bg: `linear-gradient(to right, rgba(${c},${a.toFixed(3)}), rgba(${c},${(a * 0.45).toFixed(3)}) 55%, rgba(${c},0))` });
        }
      }
      return out;
    },
    // Licht an einem Punkt im Raum (für Figuren): Umgebung + Sonne + Lampen, Normale zur Kamera
    lightAt(res, S) {
      const ctx = res && res.ctx; if (!ctx) return null;
      let r = ctx.amb[0], g = ctx.amb[1], b = ctx.amb[2];
      if (ctx.sunOn) { const toSun = ctx.D.map((x) => -x), t = Kulisse.trace(S, toSun, 1e5, null, res.occ); const kk = ctx.sunP * 0.6 * t; r += ctx.sunCol[0] * kk; g += ctx.sunCol[1] * kk; b += ctx.sunCol[2] * kk; }
      for (const l of ctx.lamps) { const kk = Kulisse.lampAt(l, S, null, false, null, res.occ); if (kk) { r += l.c[0] * kk; g += l.c[1] * kk; b += l.c[2] * kk; } }
      const m = Math.max(r, g, b, 1e-3), hx = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
      return { color: '#' + hx(r / Math.max(1, m)) + hx(g / Math.max(1, m)) + hx(b / Math.max(1, m)), level: Math.min(1.5, (r + g + b) / 3) };
    },
    // Farbe für eine Figur an Bildschirm-Position x (0–100 %) und Tiefe z bei der aktuellen Kamera
    async charLight(ctrl, xPct, z) {
      const res = await Kulisse.bake(ctrl.k, ctrl.day), c0 = Kulisse.camOf(ctrl.k, null);
      return Kulisse.lightAt(res, [c0.x + (num(xPct, 50) - 50) / 100 * W, c0.y + 120, num(z, 0)]);
    },
    // Figuren in der Tiefe (0.9.32): Figur bleibt eine flache Figur, wird aber so verschoben und skaliert,
    // als stünde sie bei z im Raum. Rechnet relativ zur Figuren-Ebene, die die Engine-Kamera schon bewegt.
    charOffset(ctrl, xPct, z) {
      const c = ctrl.cam, base = ctrl.base || {}, Z = Math.max(0.2, num(base.zoom, 100) / 100);
      const f = P0 / Math.max(20, P0 - z - c.dz), k = f / Z - 1;
      const qx = (num(xPct, 50) - 50) / 100 * W, qy = H / 2;
      return { tx: k * (qx - num(base.panX, 0) / 100 * W - ctrl.extra.x) / W * 100, ty: k * (qy - num(base.panY, 0) / 100 * H) / H * 100, s: f / Z };
    },
    placeChar(node, ctrl, clip, dur, ease) {
      const z = num(clip && clip.kz, 0);
      if (!z || !ctrl) { node.style.translate = ''; node.style.scale = ''; return; }
      const o = Kulisse.charOffset(ctrl, clip.x, z);
      if (dur) { const keep = (node.style.transition || '').split(',').map((x) => x.trim()).filter((x) => x && !/^(translate|scale)\b/.test(x)); node.style.transition = keep.concat([`translate ${dur}s ${window.Fx ? Fx.ease(ease) : 'ease'}`, `scale ${dur}s ${window.Fx ? Fx.ease(ease) : 'ease'}`]).join(', '); }
      node.style.translate = `${o.tx.toFixed(3)}cqw ${o.ty.toFixed(3)}cqh`;
      node.style.scale = o.s.toFixed(4);
    },
    // Alle Figuren einer Bühne einsortieren: weit vorne (z > 20) über die Vordergrund-Ebene, sonst normal
    syncChars(ctrl, pairs, backBox, frontBox, dur, ease) {
      for (const [node, clip] of pairs) {
        if (!node) continue;
        const z = num(clip && clip.kz, 0), host = z > 20 && frontBox ? frontBox : backBox;
        if (host && node.parentNode !== host) host.appendChild(node);
        Kulisse.placeChar(node, ctrl, clip, dur, ease);
      }
      // Figuren hinter der Figuren-Ebene zuerst, nahe zuletzt (weiter vorne = später gezeichnet)
      for (const box of [backBox, frontBox]) {
        if (!box) continue;
        const list = pairs.filter(([n]) => n && n.parentNode === box).sort((a, b) => num(a[1] && a[1].kz, 0) - num(b[1] && b[1].kz, 0));
        if (list.some(([n], i) => box.children[i] !== n) && list.length === box.children.length) for (const [n] of list) box.appendChild(n);
      }
    },
    trace(S, dir, tmax, selfId, occ) {
      let T = 1;
      for (const o of occ) {
        if (o.p.id === selfId) continue;
        const den = dot(o.f.N, dir); if (Math.abs(den) < 1e-6) continue;
        const t = dot(o.f.N, sub(o.f.O, S)) / den; if (t <= 1.5 || t >= tmax - 1.5) continue;
        const Hh = [S[0] + dir[0] * t - o.f.O[0], S[1] + dir[1] * t - o.f.O[1], S[2] + dir[2] * t - o.f.O[2]];
        const u = dot(Hh, o.f.U), v = dot(Hh, o.f.V);
        if (u < 0 || v < 0 || u > o.p.w || v > o.p.h) continue;
        const A = o.al, al = A.a[Math.min(A.h - 1, (v / o.p.h * A.h) | 0) * A.w + Math.min(A.w - 1, (u / o.p.w * A.w) | 0)];
        if (al > 200) return 0;
        if (al > 40) T *= 1 - (al - 40) / 200; // halbdurchsichtig = Glas
        if (o.bl) { const ph = (v / Math.max(4, o.bl.gap)) % 1; T *= ph < num(o.bl.open, 0.55) ? 1 : 0.06; }
        if (T < 0.01) return 0;
      }
      return T;
    },
    lightMap(p, ctx, occ) {
      const f = Kulisse.frame(p), step = Math.max(6, Math.max(p.w, p.h) / 160);
      const gw = Math.max(2, Math.min(220, Math.ceil(p.w / step))), gh = Math.max(2, Math.min(220, Math.ceil(p.h / step)));
      let N = f.N;
      // Rückwände, Böden, Decken und Außenwände werden nur von der Raumseite (Kamera-Seite) beleuchtet
      const one = p.kind === 'wall' || p.kind === 'floor' || p.kind === 'ceil' || !!p.outer;
      if (one) { const c = Kulisse.local(p, p.w / 2, p.h / 2); if (dot(N, sub(ctx.view, c)) < 0) N = N.map((x) => -x); }
      const toSun = ctx.D.map((x) => -x);
      const mul = new ImageData(gw, gh), add = new ImageData(gw, gh);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
        const u = (i + 0.5) / gw * p.w, v = (j + 0.5) / gh * p.h;
        const S = [f.O[0] + f.U[0] * u + f.V[0] * v, f.O[1] + f.U[1] * u + f.V[1] * v, f.O[2] + f.U[2] * u + f.V[2] * v];
        let r = ctx.amb[0], g = ctx.amb[1], b = ctx.amb[2];
        if (ctx.sunOn) {
          let lam = dot(N, toSun); lam = one ? Math.max(0, lam) : Math.abs(lam);
          if (lam > 0.02) { const t = Kulisse.trace(S, toSun, 1e5, p.id, occ); if (t > 0) { const kk = ctx.sunP * (0.35 + 0.65 * lam) * t; r += ctx.sunCol[0] * kk; g += ctx.sunCol[1] * kk; b += ctx.sunCol[2] * kk; } }
        }
        for (const l of ctx.lamps) { const kk = Kulisse.lampAt(l, S, N, one, p.id, occ); if (kk) { r += l.c[0] * kk; g += l.c[1] * kk; b += l.c[2] * kk; } }
        const o = (j * gw + i) * 4;
        mul.data[o] = Math.min(255, r * 255); mul.data[o + 1] = Math.min(255, g * 255); mul.data[o + 2] = Math.min(255, b * 255); mul.data[o + 3] = 255;
        add.data[o] = Math.max(0, r - 1) * 110; add.data[o + 1] = Math.max(0, g - 1) * 110; add.data[o + 2] = Math.max(0, b - 1) * 110; add.data[o + 3] = 255;
      }
      const cm = document.createElement('canvas'); cm.width = gw; cm.height = gh; cm.getContext('2d').putImageData(mul, 0, 0);
      const ca = document.createElement('canvas'); ca.width = gw; ca.height = gh; ca.getContext('2d').putImageData(add, 0, 0);
      return [cm, ca];
    },
    paint(p, src, ctx, occ, day) {
      const s = Math.min(1, 1024 / Math.max(p.w, p.h)), Wp = Math.max(2, Math.round(p.w * s)), Hp = Math.max(2, Math.round(p.h * s));
      const out = document.createElement('canvas'); out.width = Wp; out.height = Hp;
      const g = out.getContext('2d'); g.imageSmoothingQuality = 'high';
      if (src) g.drawImage(src, 0, 0, Wp, Hp);
      if (ctx && src) {
        const [m, a] = Kulisse.lightMap(p, ctx, occ);
        g.globalCompositeOperation = 'multiply'; g.drawImage(m, 0, 0, Wp, Hp);
        g.globalCompositeOperation = 'lighter'; g.drawImage(a, 0, 0, Wp, Hp);
        g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0, Wp, Hp);
        g.globalCompositeOperation = 'source-over';
      }
      // Unbeleuchtete Flächen ohne eigenes Tageszeit-Bild automatisch einfärben
      out._filter = !ctx && !(p.dayAssets && p.dayAssets[day]) && window.Fx && Fx.DAY[day] && p.kind !== 'part' ? Fx.DAY[day].filter : '';
      return out;
    },
    // Lichtstrahlen in der Luft: pro Fenster einer Rückwand einige halbdurchsichtige Blätter entlang der Sonnenrichtung
    shafts(k, tex, ctx, day) {
      const D = ctx.D, out = [], col = ctx.sunCol.map((x) => Math.round(x * 255)).join(','), str = num(k.sun.shafts, 0.7) * (day === 'night' ? 0.55 : 1);
      const floors = k.planes.filter((p) => p.kind === 'floor');
      for (const p of k.planes) {
        if (p.kind !== 'wall' || !tex.get(p.id) || D[1] <= 0.05) continue;
        const floorY = floors.length ? Math.max(...floors.map((f) => f.y)) : p.y + p.h / 2;
        for (const h of Kulisse.holes(tex.get(p.id))) {
          const u0 = h.u0 * p.w, u1 = h.u1 * p.w, v0 = h.v0 * p.h, v1 = h.v1 * p.h, bl = p.blinds && p.blinds.on ? p.blinds : null;
          const vs = [];
          if (bl) { const gap = Math.max(4, bl.gap); for (let v = v0 + gap * num(bl.open, 0.55) * 0.5; v < v1; v += gap) if ((v / gap) % 1 < num(bl.open, 0.55)) vs.push([v, 0.1]); }
          else for (let i = 0; i < 7; i++) vs.push([v0 + (i + 0.5) / 7 * (v1 - v0), 0.06]);
          for (const [v, a0] of vs.slice(0, 40)) {
            const A = Kulisse.local(p, u0, v), B = Kulisse.local(p, u1, v);
            const Lf = (floorY - 4 - A[1]) / D[1]; if (!(Lf > 0)) continue;
            const U = sub(B, A), V = D.map((x) => x * Lf), Nn = cross(U, V), nn = Math.hypot(...Nn) || 1;
            out.push({ m: `matrix3d(${U[0] / 100},${U[1] / 100},${U[2] / 100},0,${V[0] / 100},${V[1] / 100},${V[2] / 100},0,${Nn[0] / nn},${Nn[1] / nn},${Nn[2] / nn},0,${A[0]},${A[1]},${A[2]},1)`,
              bg: `linear-gradient(to right, rgba(${col},0), rgba(${col},${(a0 * str).toFixed(3)}) 12%, rgba(${col},${(a0 * str).toFixed(3)}) 88%, rgba(${col},0))` });
          }
        }
      }
      return out;
    },

    // ---------- Anzeigen ----------
    // opts: { day, mode: 'cam' | 'orbit', split: true (Vordergrund als eigenes Element für die Ebene über den Figuren), pick(obj, ev) }
    mount(k, opts = {}) {
      const mk = (cls) => { const vp = document.createElement('div'); vp.className = 'kul-vp ' + (cls || ''); const sc = document.createElement('div'); sc.className = 'kul-scale'; vp.appendChild(sc); return [vp, sc]; };
      const [back, scB] = mk('kul-back'), split = opts.split !== false && opts.mode !== 'orbit';
      const [front, scF] = split ? mk('kul-front') : [null, scB];
      const wB = document.createElement('div'), wF = document.createElement('div');
      wB.className = wF.className = 'kul-world';
      scB.appendChild(wB); scF.appendChild(wF);
      if (opts.mode === 'orbit') { scB.classList.add('kul-orbit'); }
      const ctrl = {
        k, back, front, day: opts.day || Kulisse.dayKey(k), mode: opts.mode || 'cam', orbit: opts.orbit || Kulisse.orbDefault(k),
        cam: Kulisse.camOf(k, null), base: null, extra: { x: 0 }, els: new Map(), gen: 0, onCam: [],
        world: [wB, wF],
        fit() { for (const [vp, sc] of [[back, scB], [front, scF]]) { if (!vp) continue; const w = vp.clientWidth || (vp.getBoundingClientRect().width); if (w) sc.style.transform = `scale(${w / W})`; } },
        // Flächen aufbauen (nach Datenänderung erneut aufrufen)
        build() {
          wB.innerHTML = ''; wF.innerHTML = ''; ctrl.els.clear();
          for (const p of k.planes) {
            let n;
            if (p.kind === 'part') {
              n = document.createElement('div'); n.className = 'kul-pl kul-part';
              if (window.Fx) n.appendChild(Fx.particleEl(Object.assign({ particles: 'rain' }, Fx.PART_DEF[(p.part && p.part.particles) || 'rain'], p.part || {})));
            } else { n = document.createElement('canvas'); n.className = 'kul-pl'; n.width = 2; n.height = 2; }
            n.dataset.kp = p.id;
            if (opts.pick) n.addEventListener('click', (e) => opts.pick(p, e));
            ctrl.els.set(p.id, n);
          }
          ctrl.place(); ctrl.relight();
        },
        place() {
          for (const p of k.planes) {
            const n = ctrl.els.get(p.id); if (!n) continue;
            const f = ctrl.mode === 'orbit' ? false : Kulisse.isFront(p);
            const host = f ? wF : wB;
            if (n.parentNode !== host) host.appendChild(n);
            n.style.width = p.w + 'px'; n.style.height = p.h + 'px'; n.style.transform = Kulisse.css(p);
            n.classList.toggle('kul-sel', !!opts.selected && opts.selected() === p);
            if (ctrl.mode === 'orbit') n.style.opacity = p.kind === 'ceil' ? '0.3' : '';
          }
          ctrl.apply();
        },
        async relight() {
          const g = ++ctrl.gen, res = await Kulisse.bake(k, ctrl.day);
          if (g !== ctrl.gen) return;
          for (const p of k.planes) {
            const n = ctrl.els.get(p.id), src = res.planes.get(p.id); if (!n || !src || n.tagName !== 'CANVAS') continue;
            n.width = src.width; n.height = src.height; n.getContext('2d').drawImage(src, 0, 0); n.style.filter = src._filter || '';
          }
          for (const x of [...wB.querySelectorAll('.kul-shaft, .kul-glow'), ...wF.querySelectorAll('.kul-glow')]) x.remove();
          for (const s of res.shafts) { const d = document.createElement('div'); d.className = 'kul-shaft'; d.style.transform = s.m; d.style.background = s.bg; wB.appendChild(d); }
          for (const l of res.glows) for (const g of l.els) {
            const d = document.createElement('div');
            d.className = 'kul-glow' + (g.cone ? ' kul-cone' : ''); d.style.width = g.w + 'px'; d.style.height = g.h + 'px';
            d.style.background = g.bg; if (g.r) d.style.borderRadius = g.r; d.style.transform = g.t;
            (ctrl.mode !== 'orbit' && l.z > 20 ? wF : wB).appendChild(d);
          }
          ctrl.ready = true;
          if (opts.onLit) opts.onLit();
        },
        setDay(d) { d = DAYCFG[d] ? d : 'day'; if (d === ctrl.day) return; ctrl.day = d; ctrl.relight(); },
        // Kamera aus einem Kamera-Clip der Engine (zoom, panX, panY, rot)
        setCam(cam, dur, ease) { ctrl.base = cam || null; ctrl.cam = Kulisse.camOf(k, cam, ctrl.extra); ctrl.apply(dur, ease); },
        scrollTo(x) { const base = Kulisse.camOf(k, ctrl.base); const nx = Kulisse.clampX(k, x); ctrl.extra.x = nx - base.x; ctrl.cam = Kulisse.camOf(k, ctrl.base, ctrl.extra); ctrl.apply(); return nx; },
        setOrbit(o) { ctrl.orbit = o; ctrl.apply(); },
        apply(dur, ease) {
          const c = ctrl.cam;
          const t = ctrl.mode === 'orbit' ? Kulisse.orbCss(ctrl.orbit) : `rotate(${c.rot}deg) translate3d(${-c.x}px,${-c.y}px,${c.dz}px)`;
          for (const w of [wB, wF]) { w.style.transition = dur ? `transform ${dur}s ${window.Fx ? Fx.ease(ease) : 'ease'}` : 'none'; w.style.transform = t; }
          for (const fn of ctrl.onCam) fn(dur, ease);
        },
        proj(p) { return ctrl.mode === 'orbit' ? Kulisse.projOrb(ctrl.orbit, p) : Kulisse.projCam(ctrl.cam, p); },
        destroy() { ctrl.gen++; if (ctrl._ro) ctrl._ro.disconnect(); back.remove(); if (front) front.remove(); }
      };
      if (window.ResizeObserver) { ctrl._ro = new ResizeObserver(() => ctrl.fit()); ctrl._ro.observe(back); if (front) ctrl._ro.observe(front); }
      requestAnimationFrame(() => ctrl.fit());
      ctrl.build();
      return ctrl;
    },

    // ---------- Einbindung in Bühne und Spieler ----------
    // Im Hintergrund-Kasten (bgBox) einhängen; der Vordergrund kommt hinter die Figuren (frontHost). Gibt den Controller zurück.
    attach(bgBox, frontHost, k, look, rs) {
      const ctrl = Kulisse.mount(k, { day: Kulisse.dayKey(k, look, rs) });
      bgBox.appendChild(ctrl.back);
      if (frontHost) frontHost.appendChild(ctrl.front);
      bgBox._kul = ctrl;
      return ctrl;
    }
  });
})();
