// Gesicht-Rig (0.9.31): Ausdrücke direkt auf einem flachen Figuren-Bild – ohne Bildtausch.
// Mund: Ober- und Unterlippe als Linien (Stift), Verformung über ein feines Gitter, nur innerhalb der Mund-Maske.
// Kiefer: Lasso-Bereich, dreht sich beim Öffnen ein Stück um die Gelenke vor den Ohren.
// Augen: die Wimpern wandern Spalte für Spalte nach unten, das Lid entsteht aus Haut, die wie mit einem Stempel
// von einer Quelle geholt wird (links/rechts/oben weiche Kante, an den Wimpern hart).
// Brauen: Linie, hoch/runter und schräg. Eigene Ausdrücke speichern zusätzlich verschobene Punkte.
(function () {
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const KEYS = ['s', 'o', 'w', 'p', 'a', 'e', 'lo', 'la', 'bu', 'bs'];
  const EXPR = [
    { id: 'neutral', name: 'Neutral', vals: {} },
    { id: 'smile', name: 'Lächeln', vals: { s: 0.9, o: -0.3, w: 0.35, lo: 0.3, bu: 0.2 } },
    { id: 'happy', name: 'Fröhlich ^^', vals: { s: 1, o: 0.3, w: 0.5, e: 1, la: 1, bu: 0.4 } },
    { id: 'sad', name: 'Traurig', vals: { s: -0.9, o: -0.2, w: -0.1, e: 0.3, bu: 0.3, bs: -1 } },
    { id: 'angry', name: 'Wütend', vals: { s: -0.5, o: -0.3, w: 0.2, e: 0.3, lo: 0.6, bu: -0.3, bs: 1 } },
    { id: 'tired', name: 'Müde', vals: { s: -0.1, o: -0.4, e: 0.55, bu: -0.2 } },
    { id: 'grin', name: 'Grinsen', vals: { s: 0.75, o: 0.15, w: 1, lo: 0.4 } },
    { id: 'smirk', name: 'Schiefes Grinsen', vals: { s: 0.9, o: -0.2, w: 0.3, a: 1, e: 0.2, bs: 0.3 } },
    { id: 'pout', name: 'Schmollmund', vals: { s: -0.2, o: -0.5, w: -0.4, p: 1, e: 0.25, bs: -0.4 } },
    { id: 'surprised', name: 'Staunen', vals: { o: 1, w: -0.4, p: 0.5, bu: 1 } }
  ];
  const SLIDERS = [
    ['s', 'Mundwinkel', -1, 1], ['o', 'Mund öffnen', -0.8, 1], ['w', 'Mund breit', -1, 1], ['p', 'Spitzen', 0, 1], ['a', 'Schief', 0, 1],
    ['e', 'Lid schließen', 0, 1], ['lo', 'Unterlid', 0, 1], ['la', 'Lachaugen ^^', 0, 1], ['bu', 'Brauen hoch', -1, 1], ['bs', 'Brauen schräg', -1, 1]
  ];

  const Face = (window.Face = {
    KEYS, EXPR, SLIDERS,
    data(assetId) { return (VN.project && VN.project.faces && VN.project.faces[assetId]) || null; },
    cfg(assetId) {
      const f = Face.data(assetId);
      if (!f || f.on === false) return null;
      const m = f.mouth || {};
      if ((m.up && m.up.length >= 2) || (f.eyes || []).some((e) => e.bot && e.bot.length >= 2) || (f.brows || []).some((b) => b.pts && b.pts.length >= 2)) return f;
      return null;
    },
    blank() { return { on: true, mouth: { up: [], lo: [], inner: 'built', color: '#4a1621', teeth: false, tongue: true }, jaw: { poly: [], pins: [] }, eyes: [], brows: [], src: null, soft: 4, lash: 0, blink: true, exprs: [] }; },
    exprList(f) { return EXPR.concat((f && f.exprs) || []); },
    expr(f, id) { return Face.exprList(f).find((x) => x.id === id) || EXPR[0]; },
    // Zustand aus Ausdruck + Stärke: Reglerwerte und verschobene Punkte
    snap(f, id, amt) {
      const x = Face.expr(f, id), k = amt == null ? 1 : amt, vals = {};
      for (const key of KEYS) vals[key] = ((x.vals && x.vals[key]) || 0) * k;
      const offs = {};
      for (const [part, arr] of Object.entries(x.offs || {})) offs[part] = arr.map((d) => (d ? [d[0] * k, d[1] * k] : [0, 0]));
      return { vals, offs };
    },
    mix(a, b, k) {
      const vals = {}, offs = {};
      for (const key of KEYS) vals[key] = a.vals[key] + (b.vals[key] - a.vals[key]) * k;
      for (const part of new Set([...Object.keys(a.offs), ...Object.keys(b.offs)])) {
        const A = a.offs[part] || [], Bv = b.offs[part] || [], n = Math.max(A.length, Bv.length), out = [];
        for (let i = 0; i < n; i++) { const p = A[i] || [0, 0], q = Bv[i] || [0, 0]; out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]); }
        offs[part] = out;
      }
      return { vals, offs };
    },

    // ---------- Instanz: eine Figur auf der Bühne oder in der Vorschau ----------
    // src = vollständig geladenes Bild (CORS), liefert surface() = Canvas mit verformtem Gesicht
    inst(assetId, src) {
      const f = Face.data(assetId);
      const zero = Face.snap(f, 'neutral', 0);
      const it = {
        assetId, src, cv: document.createElement('canvas'), ver: 0, key: '',
        from: zero, to: zero, t0: 0, dur: 0, cur: zero, blinkV: 0, blinkT: 0, nextBlink: performance.now() + 1500 + Math.random() * 2500, manual: null,
        setExpr(id, amt, dur) {
          const f2 = Face.data(assetId);
          it.from = it.cur; it.to = Face.snap(f2, id || 'neutral', amt == null ? 1 : amt);
          it.t0 = performance.now(); it.dur = dur == null ? 350 : dur * 1000;
        },
        // direkte Werte (Editor-Regler), ohne Übergang
        setVals(vals, offs) { const s = { vals: Object.assign({}, Face.snap(null, 'neutral', 0).vals, vals), offs: offs || {} }; it.from = it.to = it.cur = s; it.dur = 0; it.manual = s; },
        blink() { if (!it.blinkT) it.blinkT = performance.now(); },
        set talk(v) { it._talk = Math.max(0, Math.min(1, v)); },
        get talk() { return it._talk || 0; },
        surface(now) { return Face.update(it, now || performance.now()); }
      };
      return it;
    },
    update(it, now) {
      const f = Face.cfg(it.assetId);
      const W = it.src.naturalWidth || it.src.width, H = it.src.naturalHeight || it.src.height;
      if (!f || !W) return null;
      // Übergang zwischen Ausdrücken
      const k = it.dur > 0 ? Math.min(1, (now - it.t0) / it.dur) : 1;
      it.cur = Face.mix(it.from, it.to, 1 - (1 - k) * (1 - k));
      // Blinzeln (zufällig im Idle, manchmal doppelt)
      if (f.blink !== false && !it.blinkT && now > it.nextBlink && (f.eyes || []).length) { it.blinkT = now; it.nextBlink = now + 2600 + Math.random() * 2800; if (Math.random() < 0.15) it.double = true; }
      if (it.blinkT) {
        const q = (now - it.blinkT) / 210;
        it.blinkV = q < 0.45 ? sm(0, 0.45, q) : 1 - sm(0.45, 1, q);
        if (q >= 1) { it.blinkV = 0; it.blinkT = it.double ? now + 90 : 0; it.double = false; }
      }
      const v = Object.assign({}, it.cur.vals);
      if (it._talk) { v.o += it._talk * 0.9; v.w -= it._talk * 0.1; }
      v.e = Math.max(v.e, it.blinkV);
      const key = JSON.stringify([v, it.cur.offs, f._rev || 0, W, H]);
      if (key === it.key && it.cv.width) return it.cv;
      it.key = key;
      if (it.cv.width !== W || it.cv.height !== H) { it.cv.width = W; it.cv.height = H; }
      Face.render(it.cv.getContext('2d'), it.src, f, v, it.cur.offs, W, H, it);
      it.ver++; it.cv._ver = it.ver;
      return it.cv;
    },

    // ---------- Geometrie ----------
    px(pts, W, H) { return (pts || []).map((q) => [q[0] * W, q[1] * H].concat(q.length > 2 ? [q[2]] : [])); },
    sortX(pts) { return pts.length >= 2 && pts[0][0] > pts[pts.length - 1][0] ? pts.slice().reverse() : pts; },
    interp(pts, x) {
      if (x <= pts[0][0]) return pts[0][1];
      for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / Math.max(1e-6, b[0] - a[0]); }
      return pts[pts.length - 1][1];
    },
    sdPoly(poly, x, y) {
      let d = 1e9, inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [ax, ay] = poly[j], [bx, by] = poly[i], ex = bx - ax, ey = by - ay, wx = x - ax, wy = y - ay;
        const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1e-9)));
        d = Math.min(d, (wx - ex * t) ** 2 + (wy - ey * t) ** 2);
        if ((ay > y) !== (by > y) && x < ax + (y - ay) * ex / (ey || 1e-9)) inside = !inside;
      }
      return (inside ? -1 : 1) * Math.sqrt(d);
    },
    // Mund-Geometrie in Pixeln (Maske automatisch aus den Lippen)
    mouthGeo(f, W, H) {
      const m = f.mouth || {};
      let U = Face.sortX(Face.px(m.up, W, H));
      if (U.length < 2) return null;
      let L = m.lo && m.lo.length >= 2 ? Face.sortX(Face.px(m.lo, W, H)) : U.map((q) => q.slice());
      L = L.slice(); L[0] = U[0].slice(); L[L.length - 1] = U[U.length - 1].slice();
      const xs = U.map((q) => q[0]).concat(L.map((q) => q[0])), ys = U.map((q) => q[1]).concat(L.map((q) => q[1]));
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const mw = Math.max(8, x1 - x0), k = mw / 96;
      let gap = 0; for (let x = x0; x <= x1; x += mw / 20) gap = Math.max(gap, Face.interp(L, x) - Face.interp(U, x));
      const mask = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: mw * 0.83 * (m.mask || 1), ry: Math.max(mw * 0.46, (y1 - y0) * 1.6) * (m.mask || 1) };
      return { U, L, mw, k, mask, closed: gap < mw * 0.04 };
    },
    jawGeo(f, W, H, MG) {
      const j = f.jaw || {};
      const poly = Face.px(j.poly, W, H);
      if (poly.length < 3 || !MG) return null;
      const pins = Face.px(j.pins, W, H);
      const ys = poly.map((q) => q[1]);
      const chin = Math.max(...ys);
      const top = pins.length ? Math.min(...pins.map((p) => p[1])) : Math.min(...ys);
      return { poly, pins, chin, top, cx: MG.mask.cx };
    },

    // ---------- Zeichnen ----------
    render(ctx, img, f, v, offs, W, H, it) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      const MG = Face.mouthGeo(f, W, H);
      const JG = Face.jawGeo(f, W, H, MG);
      const brows = (f.brows || []).filter((b) => b.pts && b.pts.length >= 2).map((b, bi) => ({ pts: Face.sortX(Face.px(b.pts, W, H)), inner: b.inner, bi }));
      const eyeW = (() => { const e = (f.eyes || []).find((x) => x.bot && x.bot.length >= 2); if (!e) return MG ? MG.mw * 1.2 : W * 0.12; const p = Face.px(e.bot, W, H); return Math.abs(p[p.length - 1][0] - p[0][0]); })();
      if (MG && MG.closed) v = Object.assign({}, v, { o: Math.max(0, v.o) });
      // Griffe: verschobene Lippen- und Brauenpunkte
      let dU = [], dL = [];
      if (MG) {
        const lip = (pts, lower, part) => pts.map((q, i) => {
          const t = i / (pts.length - 1), c = Math.pow(2 * t - 1, 2), side = t < 0.5 ? -1 : 1, asym = t < 0.5 ? 1 - v.a * 0.85 : 1;
          let dx = side * (v.w * 7 * c - v.p * 10 * c), dy = (-v.s * 9 * c + v.s * 1.2 * (1 - c)) * asym;
          dy += lower ? v.o * 6 * (1 - c) + v.p * 2 * (1 - c) : -v.p * 2 * (1 - c);
          const o = offs && offs[part] && offs[part][i];
          return [dx * MG.k + (o ? o[0] * W : 0), dy * MG.k + (o ? o[1] * H : 0)];
        });
        dU = lip(MG.U, false, 'up'); dL = lip(MG.L, true, 'lo');
      }
      const bd = brows.map((b) => b.pts.map((q, i) => {
        const t = i / (b.pts.length - 1), inner = b.inner ? t : 1 - t, sc = eyeW / 118;
        const o = offs && offs['b' + b.bi] && offs['b' + b.bi][i];
        return [o ? o[0] * W : 0, (-v.bu * 7 + v.bs * (inner * 7 - (1 - inner) * 3)) * sc + (o ? o[1] * H : 0)];
      }));
      const field = (x, y, pts, d, sig) => {
        let nx = 0, ny = 0, den = 0;
        for (let i = 0; i < pts.length; i++) { const g = Math.exp(-((x - pts[i][0]) ** 2 + (y - pts[i][1]) ** 2) / (2 * sig * sig)); nx += g * d[i][0]; ny += g * d[i][1]; den += g; }
        const kk = 1 / Math.max(den, 1);
        return [nx * kk, ny * kk];
      };
      const jawD = (x, y) => {
        if (!JG || !v.o) return [0, 0];
        const sd = Face.sdPoly(JG.poly, x, y), inW = sd <= 0 ? 1 : 1 - sm(0, 14 * MG.k, sd);
        if (inW <= 0) return [0, 0];
        const ramp = sm(JG.top, JG.chin, y);
        return [-(x - JG.cx) * 0.025 * v.o * ramp * inW, v.o * 15 * MG.k * ramp * inW];
      };
      const disp = (x, y) => {
        let dx = 0, dy = 0;
        for (let b = 0; b < brows.length; b++) { const r = field(x, y, brows[b].pts, bd[b], eyeW * 0.068); dx += r[0]; dy += r[1]; }
        if (MG) {
          const mid = (Face.interp(MG.U, x) + Face.interp(MG.L, x)) / 2, below = sm(-3 * MG.k, 3 * MG.k, y - mid);
          const md = Math.hypot((x - MG.mask.cx) / MG.mask.rx, (y - MG.mask.cy) / MG.mask.ry), mw = md >= 1 ? 0 : md < 0.6 ? 1 : 1 - sm(0.6, 1, md);
          if (mw > 0) { const fu = field(x, y, MG.U, dU, 13 * MG.k), fl = field(x, y, MG.L, dL, 13 * MG.k); dx += mw * (fu[0] * (1 - below) + fl[0] * below); dy += mw * (fu[1] * (1 - below) + fl[1] * below); }
          const j = jawD(x, y); dx += j[0] * below; dy += j[1] * below;
        }
        return [dx, dy];
      };
      // Gitter: Mund+Kiefer und je Braue
      const boxes = [];
      if (MG) {
        let x0 = MG.mask.cx - MG.mask.rx - 6 * MG.k, x1 = MG.mask.cx + MG.mask.rx + 6 * MG.k, y0 = MG.mask.cy - MG.mask.ry - 6 * MG.k, y1 = MG.mask.cy + MG.mask.ry + 6 * MG.k;
        if (JG) for (const q of JG.poly.concat(JG.pins)) { x0 = Math.min(x0, q[0] - 18 * MG.k); x1 = Math.max(x1, q[0] + 18 * MG.k); y1 = Math.max(y1, q[1] + 22 * MG.k); y0 = Math.min(y0, q[1] - 4); }
        boxes.push([x0, y0, x1, y1, Math.max(3, 7 * MG.k)]);
      }
      for (const b of brows) {
        const xs = b.pts.map((q) => q[0]), ys = b.pts.map((q) => q[1]), m = eyeW * 0.25;
        boxes.push([Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m, Math.max(3, eyeW / 20)]);
      }
      for (const [x0, y0, x1, y1, cell] of boxes) Face.warp(ctx, img, x0, y0, x1, y1, cell, disp, W, H);
      // Mundinneres
      if (MG && (f.mouth.inner || 'built') === 'built') Face.inner(ctx, f, MG, dU, dL, jawD, v);
      // Augen
      const src = f.src ? { x: f.src.x * W, y: f.src.y * H, w: f.src.w * W, h: f.src.h * H } : null;
      for (const e of f.eyes || []) if (e.bot && e.bot.length >= 2) Face.eye(ctx, img, f, e, v, W, H, src, it);
    },
    // Bildbereich mit einem Dreiecks-Gitter verformen (Rand bleibt fest)
    warp(ctx, img, x0, y0, x1, y1, cell, disp, W, H) {
      x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
      const gw = Math.max(2, Math.ceil((x1 - x0) / cell)), gh = Math.max(2, Math.ceil((y1 - y0) / cell)), cw = (x1 - x0) / gw, ch = (y1 - y0) / gh;
      const P = [];
      for (let j = 0; j <= gh; j++) { const row = []; for (let i = 0; i <= gw; i++) { const x = x0 + i * cw, y = y0 + j * ch; const edge = i === 0 || j === 0 || i === gw || j === gh; const d = edge ? [0, 0] : disp(x, y); row.push([x, y, x + d[0], y + d[1], Math.abs(d[0]) + Math.abs(d[1])]); } P.push(row); }
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
        const a = P[j][i], b = P[j][i + 1], c = P[j + 1][i], d = P[j + 1][i + 1];
        if (a[4] + b[4] + c[4] + d[4] < 0.05) continue;
        Face.tri(ctx, img, a, b, d, W, H); Face.tri(ctx, img, a, d, c, W, H);
      }
    },
    tri(ctx, img, p0, p1, p2, W, H) {
      const s0 = p0, s1 = p1, s2 = p2;
      const den = s0[0] * (s1[1] - s2[1]) + s1[0] * (s2[1] - s0[1]) + s2[0] * (s0[1] - s1[1]);
      if (!den) return;
      const d0 = [p0[2], p0[3]], d1 = [p1[2], p1[3]], d2 = [p2[2], p2[3]];
      const a = (d0[0] * (s1[1] - s2[1]) + d1[0] * (s2[1] - s0[1]) + d2[0] * (s0[1] - s1[1])) / den;
      const c = (d0[0] * (s2[0] - s1[0]) + d1[0] * (s0[0] - s2[0]) + d2[0] * (s1[0] - s0[0])) / den;
      const e = (d0[0] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[0] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[0] * (s0[0] * s1[1] - s1[0] * s0[1])) / den;
      const b = (d0[1] * (s1[1] - s2[1]) + d1[1] * (s2[1] - s0[1]) + d2[1] * (s0[1] - s1[1])) / den;
      const d = (d0[1] * (s2[0] - s1[0]) + d1[1] * (s0[0] - s2[0]) + d2[1] * (s1[0] - s0[0])) / den;
      const f = (d0[1] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[1] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[1] * (s0[0] * s1[1] - s1[0] * s0[1])) / den;
      const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
      const g = (p) => { const vx = p[0] - cx, vy = p[1] - cy, l = Math.hypot(vx, vy) || 1; return [p[0] + vx / l * 0.7, p[1] + vy / l * 0.7]; };
      const q0 = g(d0), q1 = g(d1), q2 = g(d2);
      ctx.save();
      ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.closePath(); ctx.clip();
      ctx.transform(a, b, c, d, e, f);
      const x0 = Math.max(0, Math.floor(Math.min(s0[0], s1[0], s2[0]) - 1)), y0 = Math.max(0, Math.floor(Math.min(s0[1], s1[1], s2[1]) - 1));
      const x1 = Math.min(W, Math.ceil(Math.max(s0[0], s1[0], s2[0]) + 1)), y1 = Math.min(H, Math.ceil(Math.max(s0[1], s1[1], s2[1]) + 1));
      if (x1 > x0 && y1 > y0) ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
      ctx.restore();
    },
    smoothTo(c, pts, start) {
      if (start) c.moveTo(pts[0][0], pts[0][1]); else c.lineTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
      const l = pts[pts.length - 1]; c.lineTo(l[0], l[1]);
    },
    // Eingebautes Mundinneres: füllt genau die Lücke zwischen den Lippen
    inner(ctx, f, MG, dU, dL, jawD, v) {
      const k = MG.k;
      const mU = MG.U.map((q, i) => [q[0] + dU[i][0], q[1] + dU[i][1]]);
      const mL = MG.L.map((q, i) => { const corner = i === 0 || i === MG.L.length - 1, j = corner ? [0, 0] : jawD(q[0], q[1] + 1); return [q[0] + dL[i][0] + j[0], q[1] + dL[i][1] + j[1]]; });
      let gap = 0; for (let i = 1; i < mL.length - 1; i++) gap = Math.max(gap, mL[i][1] - Face.interp(mU, mL[i][0]));
      if (gap < 2.2 * k * 2 + 0.5) return;
      const inU = mU.map((q) => [q[0], q[1] + 2.2 * k]), inL = mL.map((q) => [q[0], q[1] - 2.4 * k]);
      inU[0][0] += 3 * k; inU[inU.length - 1][0] -= 3 * k; inL[0] = inU[0]; inL[inL.length - 1] = inU[inU.length - 1];
      const path = new Path2D(); Face.smoothTo(path, inU, true); Face.smoothTo(path, inL.slice().reverse(), false); path.closePath();
      ctx.save(); ctx.clip(path);
      ctx.fillStyle = f.mouth.color || '#4a1621'; ctx.fill(path);
      if (f.mouth.tongue !== false) {
        const c = mL[Math.floor(mL.length / 2)];
        ctx.fillStyle = '#d0607a'; ctx.beginPath(); ctx.ellipse(c[0] + 2 * k, c[1] + 2 * k, 34 * k, 13 * k, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(c[0] - 6 * k, c[1] - 6 * k, 12 * k, 3 * k, -0.1, 0, Math.PI * 2); ctx.fill();
      }
      if (f.mouth.teeth) {
        ctx.fillStyle = '#f6f2ee'; ctx.beginPath(); ctx.moveTo(inU[0][0], inU[0][1]);
        for (const q of inU) ctx.lineTo(q[0], q[1] - 1); for (const q of inU.slice().reverse()) ctx.lineTo(q[0], q[1] + 4.5 * k); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    },
    // Wimpern-Oberkante je Spalte aus dem Bild ermitteln (dunkle Pixel über der Wimpernlinie)
    lashTop(img, bot, W, H, it, f) {
      const key = JSON.stringify([bot, f.lash || 0]);
      it._lash = it._lash || {};
      if (it._lash[key]) return it._lash[key];
      const x0 = Math.ceil(bot[0][0]), x1 = Math.floor(bot[bot.length - 1][0]), ew = x1 - x0;
      const out = new Map();
      const manual = Number(f.lash) || 0;
      let data = null, ox = 0, oy = 0, dw = 0, dh = 0;
      if (!manual) {
        try {
          const ys = bot.map((q) => q[1]); oy = Math.max(0, Math.floor(Math.min(...ys) - ew * 0.3)); ox = Math.max(0, x0 - 2); dw = Math.min(W - ox, ew + 4); dh = Math.min(H - oy, Math.ceil(Math.max(...ys) - oy + 4));
          const c = document.createElement('canvas'); c.width = dw; c.height = dh; const g = c.getContext('2d'); g.drawImage(img, ox, oy, dw, dh, 0, 0, dw, dh); data = g.getImageData(0, 0, dw, dh).data;
        } catch (e) { data = null; }
      }
      for (let x = x0; x <= x1; x++) {
        const t = (x - x0) / Math.max(1, ew), yb = Face.interp(bot, x);
        let top = yb - (manual || 0.09) * ew * (0.35 + 0.65 * Math.sin(Math.PI * t));
        if (data) {
          // von der Wimpernlinie nach oben, solange es dunkel ist
          let y = Math.round(yb) - 1, dark = 0, last = yb;
          const lum = (yy) => { const i = ((yy - oy) * dw + (x - ox)) * 4; return (0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2]) / 255; };
          for (; y > yb - ew * 0.3 && y > oy; y--) { const l = lum(y); if (l < 0.42) { dark++; last = y; } else if (dark > 0 && yb - y > 2) break; }
          top = dark > 0 ? Math.min(last - 1, yb - 1) : yb - 2;
        }
        out.set(x, top);
      }
      it._lash[key] = out;
      return out;
    },
    eye(ctx, img, f, E, v, W, H, src, it) {
      const bot = Face.sortX(Face.px(E.bot, W, H));
      const x0 = Math.ceil(bot[0][0]), x1 = Math.floor(bot[bot.length - 1][0]), ew = Math.max(4, x1 - x0);
      let low = E.low && E.low.length >= 2 ? Face.sortX(Face.px(E.low, W, H)) : null;
      const c = Math.max(0, Math.min(1, v.e));
      if (c < 0.005 && v.lo < 0.005) return;
      const tops = Face.lashTop(img, bot, W, H, it || {}, f);
      const cl = bot[0], cr = bot[bot.length - 1];
      const g = { xs: [], top: [], bot: [], low: [], drop: [], lowN: [] };
      for (let x = x0; x <= x1; x++) {
        const t = (x - x0) / ew, yb = Face.interp(bot, x), yt = tops.get(x) != null ? tops.get(x) : yb - 0.09 * ew;
        const yl = Math.max(yb + 1, low ? Face.interp(low, x) : yb + ew * 0.42 * Math.sin(Math.PI * t) + 1);
        const corner = cl[1] + (cr[1] - cl[1]) * t, arc = corner - ew * 0.11 * Math.sin(Math.PI * t) + ew * 0.04;
        const target = yl * (1 - v.la) + arc * v.la, lift = v.lo * 0.32 * (yl - yb), dr = c * (target - yb);
        const lowTop = (yl - lift) * (1 - sm(0.7, 1, c)) + (yb + dr - 1) * sm(0.7, 1, c);
        g.xs.push(x); g.top.push(yt); g.bot.push(yb); g.low.push(yl); g.drop.push(dr); g.lowN.push(Math.min(yl, lowTop));
      }
      const S = src || { x: (x0 + x1) / 2 - ew * 0.3, y: Math.min(...g.top) - ew * 0.35, w: ew * 0.6, h: ew * 0.25 };
      const soft = f.soft != null ? Number(f.soft) * Math.max(1, ew / 118) : 4;
      if (c > 0.005) Face.stamp(ctx, img, g, g.top.map((y) => y - 2), g.top.map((y, k) => y + g.drop[k] + 3), 'bottom', S, soft);
      if (g.lowN.some((y, k) => y < g.low[k] - 0.5)) Face.stamp(ctx, img, g, g.lowN, g.low.map((y) => y + 6), 'top', S, soft);
      if (c > 0.005) for (let k = 0; k < g.xs.length; k++) {
        const x = g.xs[k], t0 = Math.floor(g.top[k] - 1), h = Math.ceil(g.bot[k] + 1.5) - t0;
        if (h > 0) ctx.drawImage(img, x, t0, 1, h, x - 0.25, t0 + g.drop[k], 1.5, h);
      }
    },
    // Haut von der Quelle in die Fläche zwischen upperY und lowerY stempeln; eine Seite hart, sonst weich
    stamp(ctx, img, g, upperY, lowerY, hard, S, soft) {
      const pad = 14 + soft * 2, bx = Math.floor(g.xs[0] - pad), bw = Math.ceil(g.xs[g.xs.length - 1] - g.xs[0] + pad * 2);
      const by = Math.floor(Math.min(...upperY) - pad), bh = Math.ceil(Math.max(...lowerY) + pad - by);
      if (bw <= 0 || bh <= 0) return;
      const off = Face._off || (Face._off = document.createElement('canvas')), mk = Face._mk || (Face._mk = document.createElement('canvas'));
      off.width = mk.width = bw; off.height = mk.height = bh;
      const oc = off.getContext('2d'), mc = mk.getContext('2d');
      oc.drawImage(img, S.x, S.y, S.w, S.h, 0, 0, bw, bh);
      const poly = new Path2D();
      poly.moveTo(g.xs[0] - bx, upperY[0] - by); for (let k = 1; k < g.xs.length; k++) poly.lineTo(g.xs[k] - bx, upperY[k] - by);
      for (let k = g.xs.length - 1; k >= 0; k--) poly.lineTo(g.xs[k] - bx, lowerY[k] - by); poly.closePath();
      const hy = hard === 'bottom' ? lowerY : upperY, far = hard === 'bottom' ? -bh : bh * 2;
      const cut = new Path2D();
      cut.moveTo(g.xs[0] - bx - pad, far); cut.lineTo(g.xs[0] - bx - pad, hy[0] - by);
      for (let k = 0; k < g.xs.length; k++) cut.lineTo(g.xs[k] - bx, hy[k] - by);
      cut.lineTo(g.xs[g.xs.length - 1] - bx + pad, hy[hy.length - 1] - by); cut.lineTo(g.xs[g.xs.length - 1] - bx + pad, far); cut.closePath();
      mc.save(); mc.clip(cut); mc.fillStyle = '#fff';
      if (soft > 0) { mc.filter = `blur(${soft}px)`; mc.fill(poly); mc.filter = 'none'; }
      mc.fill(poly); mc.restore();
      oc.globalCompositeOperation = 'destination-in'; oc.drawImage(mk, 0, 0); oc.globalCompositeOperation = 'source-over';
      ctx.drawImage(off, bx, by);
    },

    // ---------- Bühne ----------
    // Mund für den Lippensync: statt Bildtausch öffnet sich der echte Mund
    mouthCtl(inst) { return { set: (v) => { inst.talk = v; } }; },
    hasMouth(assetId) { const f = Face.cfg(assetId); return !!(f && f.mouth && f.mouth.up && f.mouth.up.length >= 2); }
  });

  // Aktion: Ausdruck zeigen (für alle sichtbaren Figuren mit diesem Bild)
  Face.LIVE = new Set();
  Face.setAll = (assetId, id, amt, dur) => { for (const it of Face.LIVE) if (!assetId || it.assetId === assetId) it.setExpr(id, amt, dur); };
  if (VN.registerAction) {
    VN.registerAction('faceExpr', {
      label: '🙂 Gesicht: Ausdruck', make: () => ({ asset: '', expr: 'smile', amount: 100, dur: 0.35 }),
      apply: (a) => Face.setAll(a.asset || '', a.expr || 'neutral', (a.amount != null ? a.amount : 100) / 100, a.dur != null ? a.dur : 0.35),
      text: (a) => '🙂 ' + VN.t('Ausdruck') + ': ' + VN.t(Face.expr(Face.data(a.asset), a.expr).name) + ((a.amount != null && a.amount !== 100) ? ' ' + a.amount + ' %' : ''),
      row: (row, a, sel) => {
        const s = VN.assetSelect('image', a.asset || '', (v) => VN.mutate(() => { a.asset = v; }));
        s.style.maxWidth = '150px'; s.title = VN.t('Figuren-Bild (leer = alle)');
        row.appendChild(s);
        row.appendChild(sel(a.expr || 'neutral', Face.exprList(Face.data(a.asset)).map((x) => [x.id, x.name]), (v) => VN.mutate(() => { a.expr = v; })));
        row.appendChild(VN.el('input', { type: 'number', min: '0', max: '200', step: '5', value: a.amount != null ? a.amount : 100, style: { width: '64px' }, title: VN.t('Stärke in %'), onchange: (e) => VN.mutate(() => { a.amount = Number(e.target.value) || 0; }) }));
      }
    });
  }
})();
