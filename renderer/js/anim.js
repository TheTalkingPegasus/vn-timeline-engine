// Animationen (Laufzeit, auch im exportierten Spiel):
// Keyframes für Knochen, Idle-Schleifen, Gesten, Zwischensequenzen (live auf Canvas oder als Video)
(function () {
  const { el } = VN;

  const EASE = {
    linear: (t) => t,
    'ease-in': (t) => t * t * t,
    'ease-out': (t) => 1 - Math.pow(1 - t, 3),
    'ease-in-out': (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    smooth: (t) => 1 - Math.pow(1 - t, 5),
    back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    bounce: (t) => { const c1 = 2.6, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  };

  // Kurve eines Keyframes: fertige Kurve, eigene Bézier-Kurve ("cb:…") oder „Halten“
  const easeFn = (e) => EASE[e] || (window.Fx && Fx.easeFn && Fx.easeFn(e)) || EASE['ease-in-out'];
  // Wert einer Keyframe-Liste zur Zeit t ([{t, v, e}], sortiert)
  const sample = (keys, t, field) => {
    let prev = null, next = null;
    for (const k of keys) {
      if (k[field] == null) continue;
      if (k.t <= t) prev = k; else { next = k; break; }
    }
    if (!prev && !next) return null;
    if (!prev) return next[field];
    if (!next) return prev[field];
    const u = (t - prev.t) / Math.max(0.0001, next.t - prev.t);
    const f = easeFn(next.e)(Math.max(0, Math.min(1, u)));
    return prev[field] + (next[field] - prev[field]) * f;
  };
  const sorted = (arr) => (arr || []).slice().sort((a, b) => a.t - b.t);

  const Anim = (window.Anim = {
    EASE, sample, easeFn,
    list() { return (VN.project && VN.project.anims) || []; },
    get(id) { return Anim.list().find((a) => a.id === id) || null; },

    // Knochen-Winkel (Grad) eines Darstellers zur Zeit t
    angles(actor, t) {
      const out = {};
      for (const [name, keys] of Object.entries(actor.bones || {})) {
        const v = sample(sorted(keys), t, 'a');
        if (v) out[name] = v;
      }
      return out;
    },
    // Position, Größe, Drehung eines Darstellers zur Zeit t
    place(actor, t) {
      const mv = sorted(actor.move);
      const g = (f, d) => { const v = sample(mv, t, f); return v != null ? v : (actor[f] != null ? actor[f] : d); };
      return { x: g('x', 50), y: g('y', 0), scale: g('scale', 100), rot: g('rot', 0), opacity: g('opacity', 100) };
    },
    // ---------- Mund & Lippenlinie (0.9.24) ----------
    // Figur: a.mouth = { on, up:[u,v], lo:[u,v], hinge:[u,v], bone, jaw (Kiefer-Größe), max (°), inner (Bild), innerColor, flip }
    // Objekt: a.mouthProp = { target: Darsteller-ID, back:[u,v], tip:[u,v], thick (% Bildbreite, wenn das Bild nicht messbar ist) }
    Mouth: {
      ap: (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]],
      // Breite des Objekts entlang seiner Achse (einmal aus den Bildpunkten gemessen)
      profile(it, mp) {
        const key = JSON.stringify([mp.back, mp.tip]);
        if (it._prof && it._prof.key === key) return it._prof.w;
        let w = null;
        try {
          const im = it.img;
          if (im && im.naturalWidth) {
            const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
            const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
            const D = g.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
            const A = (x, y) => { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= W || y >= H ? 0 : D[(y * W + x) * 4 + 3]; };
            const bx = mp.back[0] * W, by = mp.back[1] * H, tx = mp.tip[0] * W, ty = mp.tip[1] * H, L = Math.hypot(tx - bx, ty - by) || 1;
            const qx = -(ty - by) / L, qy = (tx - bx) / L, N = 48, lim = Math.max(W, H);
            w = [];
            for (let i = 0; i <= N; i++) {
              const px = bx + (tx - bx) * i / N, py = by + (ty - by) * i / N;
              let a = 0, b = 0;
              if (A(px, py) > 30) { while (a < lim && A(px + qx * (a + 1), py + qy * (a + 1)) > 30) a++; while (b < lim && A(px - qx * (b + 1), py - qy * (b + 1)) > 30) b++; w.push((a + b + 1) / W); } else w.push(0);
            }
          }
        } catch (e) { w = null; /* Bild nicht lesbar: feste Dicke */ }
        it._prof = { key, w };
        return w;
      },
      // Wo kreuzt das Objekt die Lippenlinie (Leinwand-Koordinaten)? → { s (0 Griff … 1 Spitze), x, y, width (Leinwand-px) }
      crossing(sc, figA, U, L, n) {
        let best = null;
        for (const it of sc.items) {
          const mp = it.actor && it.actor.mouthProp;
          if (!mp || mp.target !== figA.id || !it._geo || !mp.back || !mp.tip) continue;
          const g = it._geo, M = Anim.Mouth;
          const B = M.ap(g.mat, ...g.toLocal(mp.back[0], mp.back[1])), T = M.ap(g.mat, ...g.toLocal(mp.tip[0], mp.tip[1]));
          // Schnitt der Strecke Griff→Spitze mit der Linie U→L
          const rx = T[0] - B[0], ry = T[1] - B[1], sx = L[0] - U[0], sy = L[1] - U[1];
          const den = rx * sy - ry * sx;
          if (Math.abs(den) < 1e-6) continue;
          const qx = U[0] - B[0], qy = U[1] - B[1];
          const s = (qx * sy - qy * sx) / den, v = (qx * ry - qy * rx) / den;
          if (s < 0 || s > 1 || v < -0.35 || v > 1.35) continue;
          // Spitze muss auf der Innenseite liegen (sonst nur berührt)
          if ((T[0] - U[0]) * n[0] + (T[1] - U[1]) * n[1] <= 0) continue;
          const prof = M.profile(it, mp);
          const axisImg = it.img ? Math.hypot((mp.tip[0] - mp.back[0]) * it.img.naturalWidth, (mp.tip[1] - mp.back[1]) * it.img.naturalHeight) : 0;
          const axisCv = Math.hypot(rx, ry);
          let wi;
          if (prof && axisImg) { const f = s * (prof.length - 1), i0 = Math.floor(f), k = f - i0; wi = (prof[i0] * (1 - k) + (prof[Math.min(prof.length - 1, i0 + 1)] || 0) * k) * it.img.naturalWidth * axisCv / axisImg; }
          else wi = (Number(mp.thick) || 12) / 100 * axisCv;
          const c = { s, x: B[0] + rx * s, y: B[1] + ry * s, width: wi };
          if (!best || c.width > best.width) best = c;
        }
        return best;
      },
      // Kiefer-Bereich: Kreis um das Gelenk, nur auf der Seite der Unterlippe (lokale Koordinaten)
      jawPoly(Ul, Ll, Hl, R) {
        const Mx = (Ul[0] + Ll[0]) / 2, My = (Ul[1] + Ll[1]) / 2;
        const dx = Mx - Hl[0], dy = My - Hl[1];
        const side = (x, y) => dx * (y - Hl[1]) - dy * (x - Hl[0]);
        const sL = Math.sign(side(Ll[0], Ll[1])) || 1;
        const circ = Array.from({ length: 48 }, (_, i) => [Hl[0] + R * Math.cos(i / 48 * Math.PI * 2), Hl[1] + R * Math.sin(i / 48 * Math.PI * 2)]);
        const inside = (p) => side(p[0], p[1]) * sL >= 0;
        const out = [];
        for (let i = 0; i < circ.length; i++) {
          const p = circ[i], q = circ[(i + 1) % circ.length], ip = inside(p), iq = inside(q);
          if (ip) out.push(p);
          if (ip !== iq) { const a = side(p[0], p[1]), b = side(q[0], q[1]), k = a / (a - b); out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]); }
        }
        return out;
      },
      img(id) {
        if (!id) return null;
        const c = Anim._imgCache || (Anim._imgCache = {});
        if (c[id]) return c[id].complete && c[id].naturalWidth ? c[id] : null;
        const u = VN.assetUrl(id); if (!u) return null;
        const im = new Image(); im.src = u; c[id] = im; return null;
      },
      // Figur zeichnen: Oberteil fest, Unterkiefer dreht um das Gelenk, so weit wie das Objekt breit ist; dahinter das Mund-Innere
      draw(ctx, sc, it, a, geo, drawIt) {
        if (a.mouth.view === 'pov') return Anim.Mouth.drawPov(ctx, sc, it, a, geo, drawIt);
        const mo = a.mouth, M = Anim.Mouth;
        if (!mo.up || !mo.lo || !mo.hinge) { drawIt(ctx); return; }
        const Ul = geo.toLocal(mo.up[0], mo.up[1], mo.bone), Ll = geo.toLocal(mo.lo[0], mo.lo[1], mo.bone), Hl = geo.toLocal(mo.hinge[0], mo.hinge[1], mo.bone);
        const U = M.ap(geo.mat, ...Ul), L = M.ap(geo.mat, ...Ll), Hc = M.ap(geo.mat, ...Hl);
        const Mc = [(U[0] + L[0]) / 2, (U[1] + L[1]) / 2];
        let n = [Hc[0] - Mc[0], Hc[1] - Mc[1]]; const nl = Math.hypot(...n) || 1; n = [n[0] / nl, n[1] / nl]; if (mo.flip) n = [-n[0], -n[1]];
        const cr = M.crossing(sc, a, U, L, n);
        // Öffnungswinkel: Lücke an der Kreuzung = Objektbreite
        let th = 0;
        if (cr) { const d = Math.hypot(cr.x - Hc[0], cr.y - Hc[1]) || 1; th = Math.min((Number(mo.max) || 35) * Math.PI / 180, Math.atan2(cr.width * (mo.extra != null ? 1 + Number(mo.extra) / 100 : 1.08), d)); }
        // Kiefer = Kreisausschnitt um das Gelenk: vom Mundspalt (Gelenk → Mitte der Lippen) Richtung Unterlippe, „span“ Grad weit
        const Ml = [(Ul[0] + Ll[0]) / 2, (Ul[1] + Ll[1]) / 2];
        const as = Math.atan2(Ml[1] - Hl[1], Ml[0] - Hl[0]);
        let dl = Math.atan2(Ll[1] - Hl[1], Ll[0] - Hl[0]) - as; while (dl > Math.PI) dl -= 2 * Math.PI; while (dl < -Math.PI) dl += 2 * Math.PI;
        const dir = dl >= 0 ? 1 : -1, ang = th * dir;
        const rot = (p) => { const c = Math.cos(ang), s2 = Math.sin(ang), x = p[0] - Hl[0], y = p[1] - Hl[1]; return [Hl[0] + x * c - y * s2, Hl[1] + x * s2 + y * c]; };
        const L2l = rot(Ll), L2 = M.ap(geo.mat, ...L2l);
        if (sc._main) (sc._mouth || (sc._mouth = {}))[a.id] = { U, L: L2, n, D: Math.max(nl * 6, Math.hypot(L2[0] - U[0], L2[1] - U[1]) * 4), open: th };
        if (th < 0.002) { drawIt(ctx); return; }
        const R = Math.hypot(Ll[0] - Hl[0], Ll[1] - Hl[1]) * Math.max(0.5, Number(mo.jaw) || 2.2);
        const span = Math.max(30, Math.min(175, Number(mo.span) || 140)) * Math.PI / 180;
        const sector = (a0, a1) => { const pts = [Hl], n2 = 32; for (let i = 0; i <= n2; i++) { const q = a0 + (a1 - a0) * i / n2; pts.push([Hl[0] + R * Math.cos(q), Hl[1] + R * Math.sin(q)]); } return pts; };
        const jaw = sector(as, as + dir * span), gap = sector(as, as + ang);
        const path = (g, pts) => { pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
        // 1) Mund-Inneres im Spalt – nur, wo die Figur selbst Pixel hat (nicht in die Luft vor dem Gesicht)
        const off = M._off || (M._off = document.createElement('canvas'));
        if (off.width !== ctx.canvas.width || off.height !== ctx.canvas.height) { off.width = ctx.canvas.width; off.height = ctx.canvas.height; }
        const g = off.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, off.width, off.height);
        g.setTransform(ctx.getTransform());
        g.save(); g.beginPath(); path(g, gap); g.clip();
        const xs = gap.map((p) => p[0]), ys = gap.map((p) => p[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        const inner = M.img(mo.inner);
        if (inner) { const bx = Math.min(Ul[0], L2l[0], Hl[0]), by = Math.min(Ul[1], L2l[1], Hl[1]), bw = Math.max(Ul[0], L2l[0], Hl[0]) - bx || 1, bh = Math.max(Ul[1], L2l[1], Hl[1]) - by || 1; g.drawImage(inner, bx - bw * 0.1, by - bh * 0.1, bw * 1.2, bh * 1.2); }
        else { g.fillStyle = mo.innerColor || '#4a1620'; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
        g.restore();
        g.globalCompositeOperation = 'destination-in'; drawIt(g); g.globalCompositeOperation = 'source-over';
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(off, 0, 0); ctx.restore();
        // 2) Oberteil: alles außer dem Kiefer
        ctx.save(); ctx.beginPath(); ctx.rect(-1e5, -1e5, 2e5, 2e5); path(ctx, jaw); ctx.clip('evenodd'); drawIt(ctx); ctx.restore();
        // 3) Unterkiefer, um das Gelenk gedreht
        ctx.save(); ctx.translate(Hl[0], Hl[1]); ctx.rotate(ang); ctx.translate(-Hl[0], -Hl[1]); ctx.beginPath(); path(ctx, jaw); ctx.clip(); drawIt(ctx); ctx.restore();
      },
      // Polygon-Hilfen
      area: (pts) => { let s2 = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; s2 += p[0] * q[1] - q[0] * p[1]; } return s2 / 2; },
      ellPts: (cx, cy, rx, ry, rot, n) => Array.from({ length: n || 40 }, (_, i) => { const q = i / (n || 40) * Math.PI * 2, x = rx * Math.cos(q), y = ry * Math.sin(q); return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; }),
      // POV (von vorn): up = Mundwinkel links, lo = Mundwinkel rechts, hinge = Kinn. Kiefer senkt sich, Öffnung = Objektbreite
      drawPov(ctx, sc, it, a, geo, drawIt) {
        const mo = a.mouth, M = Anim.Mouth;
        if (!mo.up || !mo.lo || !mo.hinge) { drawIt(ctx); return; }
        const Cl = geo.toLocal(mo.up[0], mo.up[1], mo.bone), Cr = geo.toLocal(mo.lo[0], mo.lo[1], mo.bone), Ch = geo.toLocal(mo.hinge[0], mo.hinge[1], mo.bone);
        const Mc = [(Cl[0] + Cr[0]) / 2, (Cl[1] + Cr[1]) / 2], mw = Math.hypot(Cr[0] - Cl[0], Cr[1] - Cl[1]) || 1;
        const e = [(Cr[0] - Cl[0]) / mw, (Cr[1] - Cl[1]) / mw];
        let d = [-e[1], e[0]]; if ((Ch[0] - Mc[0]) * d[0] + (Ch[1] - Mc[1]) * d[1] < 0) d = [-d[0], -d[1]];
        const chinD = Math.max(mw * 0.3, (Ch[0] - Mc[0]) * d[0] + (Ch[1] - Mc[1]) * d[1]);
        const toC = (p) => M.ap(geo.mat, p[0], p[1]);
        const McC = toC(Mc), ClC = toC(Cl), CrC = toC(Cr), mwC = Math.hypot(CrC[0] - ClC[0], CrC[1] - ClC[1]) || 1, kC = mwC / mw;
        // Welches Objekt zielt auf den Mund? Eintrittspunkt = wo die Objektachse die Mundmitte passiert
        let best = null;
        for (const pit of sc.items) {
          const mp = pit.actor && pit.actor.mouthProp;
          if (!mp || mp.target !== a.id || !pit._geo || !mp.back || !mp.tip) continue;
          const B = M.ap(pit._geo.mat, ...pit._geo.toLocal(mp.back[0], mp.back[1])), T = M.ap(pit._geo.mat, ...pit._geo.toLocal(mp.tip[0], mp.tip[1]));
          const rx = T[0] - B[0], ry = T[1] - B[1], L2 = rx * rx + ry * ry || 1, len = Math.sqrt(L2);
          const s0 = ((McC[0] - B[0]) * rx + (McC[1] - B[1]) * ry) / L2;
          if (s0 < 0 || s0 > 1) continue; // Spitze noch nicht an der Mundmitte
          const px = B[0] + rx * s0, py = B[1] + ry * s0;
          if (Math.hypot(px - McC[0], py - McC[1]) > mwC * 0.6) continue; // zielt daneben
          const prof = M.profile(pit, mp);
          const axisImg = pit.img ? Math.hypot((mp.tip[0] - mp.back[0]) * pit.img.naturalWidth, (mp.tip[1] - mp.back[1]) * pit.img.naturalHeight) : 0;
          let wi;
          if (prof && axisImg) { const f = s0 * (prof.length - 1), i0 = Math.floor(f), k = f - i0; wi = (prof[i0] * (1 - k) + (prof[Math.min(prof.length - 1, i0 + 1)] || 0) * k) * pit.img.naturalWidth * len / axisImg; }
          else wi = (Number(mp.thick) || 12) / 100 * len;
          if (!best || wi > best.w) best = { w: wi, r: [rx / len, ry / len] };
        }
        const maxG = mw * Math.max(0.1, (Number(mo.max) || 35) / 35) * 0.8;
        const gap = best ? Math.min(maxG, best.w / kC * 1.05) : 0;
        // Öffnung (lokal): Ellipse unter der Oberlippe, so hoch wie der Spalt, Breite wächst mit
        const orx = mw / 2 * (0.5 + 0.45 * Math.min(1, gap / (mw * 0.5))), ory = Math.max(0.5, gap / 2);
        const oc = [Mc[0] + d[0] * ory, Mc[1] + d[1] * ory], orot = Math.atan2(e[1], e[0]);
        const openL = M.ellPts(oc[0], oc[1], orx, ory, orot, 40);
        if (sc._main) (sc._mouth || (sc._mouth = {}))[a.id] = best && gap > 0.5 ? { pov: true, P: McC, r: best.r, ell: openL.map(toC) } : { pov: true, none: true };
        if (gap < 0.5) { drawIt(ctx); return; }
        // Kiefer-Bereich: Ellipse von den Mundwinkeln bis unters Kinn
        const jf = Math.max(0.5, Number(mo.jaw) || 2.2) / 2.2;
        const jc = [Mc[0] + d[0] * chinD * 0.55, Mc[1] + d[1] * chinD * 0.55];
        const jaw = M.ellPts(jc[0], jc[1], mw * 0.95 * jf, chinD * 0.75 * jf, orot, 48).filter((p) => (p[0] - Mc[0]) * d[0] + (p[1] - Mc[1]) * d[1] >= -0.5);
        const path = (g, pts) => { pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
        // 1) Grundbild, 2) Mund-Inneres in der Öffnung (nur auf der Figur), 3) Kiefer nach unten verschoben
        drawIt(ctx);
        const off = M._off || (M._off = document.createElement('canvas'));
        if (off.width !== ctx.canvas.width || off.height !== ctx.canvas.height) { off.width = ctx.canvas.width; off.height = ctx.canvas.height; }
        const g = off.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, off.width, off.height);
        g.setTransform(ctx.getTransform());
        g.save(); g.beginPath(); path(g, openL); g.clip();
        const inner = M.img(mo.inner);
        if (inner) g.drawImage(inner, oc[0] - orx * 1.1, oc[1] - ory * 1.1, orx * 2.2, ory * 2.2);
        else { g.fillStyle = mo.innerColor || '#4a1620'; g.fillRect(oc[0] - orx * 2, oc[1] - ory * 2 - mw, orx * 4, ory * 4 + mw * 2); }
        g.restore();
        g.globalCompositeOperation = 'destination-in'; drawIt(g); g.globalCompositeOperation = 'source-over';
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(off, 0, 0); ctx.restore();
        ctx.save(); ctx.translate(d[0] * gap, d[1] * gap); ctx.beginPath(); path(ctx, jaw); ctx.clip(); drawIt(ctx); ctx.restore();
      },
      // Objekt: hinter den Lippen (Richtung Innen) unsichtbar
      clipProp(ctx, sc, a) {
        const m = sc._mouth && sc._mouth[a.mouthProp.target];
        if (!m || m.none) return;
        if (m.pov) {
          // Sichtbar: der Teil vor der Mundmitte (Griff-Seite) und alles innerhalb der Öffnung
          const M = Anim.Mouth, q = [-m.r[1], m.r[0]], BIG = 1e5;
          let half = [[m.P[0] + q[0] * BIG, m.P[1] + q[1] * BIG], [m.P[0] - q[0] * BIG, m.P[1] - q[1] * BIG], [m.P[0] - q[0] * BIG - m.r[0] * BIG, m.P[1] - q[1] * BIG - m.r[1] * BIG], [m.P[0] + q[0] * BIG - m.r[0] * BIG, m.P[1] + q[1] * BIG - m.r[1] * BIG]];
          let ell = m.ell.slice();
          if (Math.sign(M.area(half)) !== Math.sign(M.area(ell))) ell = ell.reverse();
          const t0 = ctx.getTransform();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.beginPath();
          for (const pts of [half, ell]) { pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }
          ctx.clip('nonzero');
          ctx.setTransform(t0);
          return;
        }
        const e = [m.L[0] - m.U[0], m.L[1] - m.U[1]], el = Math.hypot(...e) || 1, ex = [e[0] / el * el * 0.2, e[1] / el * el * 0.2];
        const P1 = [m.U[0] - ex[0], m.U[1] - ex[1]], P2 = [m.L[0] + ex[0], m.L[1] + ex[1]];
        const P3 = [P2[0] + m.n[0] * m.D, P2[1] + m.n[1] * m.D], P4 = [P1[0] + m.n[0] * m.D, P1[1] + m.n[1] * m.D];
        const t0 = ctx.getTransform();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.beginPath(); ctx.rect(-1e5, -1e5, 2e5, 2e5);
        ctx.moveTo(P1[0], P1[1]); ctx.lineTo(P2[0], P2[1]); ctx.lineTo(P3[0], P3[1]); ctx.lineTo(P4[0], P4[1]); ctx.closePath();
        ctx.clip('evenodd');
        ctx.setTransform(t0);
      }
    },

    // Maske zur Zeit t: Kasten { x, y, w, h, rot } in % der Bühne; freie Form = Punkte (0…1) im Kasten
    MASK0: { x: 30, y: 20, w: 40, h: 60, rot: 0 },
    maskAt(actor, t) {
      const m = actor && actor.mask;
      if (!m) return null;
      const ks = sorted(m.keys);
      const g = (f) => { const v = sample(ks, t, f); return v != null ? v : (m[f] != null ? m[f] : Anim.MASK0[f]); };
      return { x: g('x'), y: g('y'), w: g('w'), h: g('h'), rot: g('rot'), shape: m.shape || 'rect', pts: m.pts || [], invert: !!m.invert };
    },
    maskPath(ctx, b, W, H) {
      const cx = (b.x + b.w / 2) / 100 * W, cy = (b.y + b.h / 2) / 100 * H, w = b.w / 100 * W, h = b.h / 100 * H;
      const r = (b.rot || 0) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
      const P = (u, v) => { const lx = (u - 0.5) * w, ly = (v - 0.5) * h; return [cx + lx * cs - ly * sn, cy + lx * sn + ly * cs]; };
      if (b.shape === 'ellipse') { ctx.ellipse(cx, cy, Math.abs(w / 2), Math.abs(h / 2), r, 0, Math.PI * 2); return; }
      const pts = b.shape === 'poly' && b.pts.length >= 3 ? b.pts : [[0, 0], [1, 0], [1, 1], [0, 1]];
      pts.forEach((p, i) => { const [x, y] = P(p[0], p[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.closePath();
    },
    clipMask(ctx, actor, t, W, H) {
      const b = Anim.maskAt(actor, t);
      if (!b) return;
      ctx.beginPath();
      if (b.invert) { ctx.rect(-W, -H, W * 3, H * 3); }
      Anim.maskPath(ctx, b, W, H);
      ctx.clip(b.invert ? 'evenodd' : 'nonzero');
    },
    cam(anim, t) {
      const ks = sorted(anim.cam);
      const g = (f, d) => { const v = sample(ks, t, f); return v != null ? v : d; };
      return { zoom: g('zoom', 100), panX: g('panX', 0), panY: g('panY', 0), rot: g('rot', 0) };
    },

    // Idle-Schleife und Gesten für Figuren im Spiel (Bones nötig)
    extraFnFor(clip, holder) {
      return (now) => {
        let out = {};
        let off = null; // ganze Figur bewegen (Zeile „Bewegung“, 0.9.24)
        const idle = clip.idleAnim ? Anim.get(clip.idleAnim) : null;
        if (idle && idle.actors && idle.actors[0]) {
          const d = Math.max(0.1, idle.dur || 2);
          out = Anim.angles(idle.actors[0], ((now % d) + d) % d);
          off = Anim.moveOf(idle.actors[0], ((now % d) + d) % d);
        }
        const g = holder._gesture;
        if (g && g.anim && g.anim.actors && g.anim.actors[0]) {
          const lt = now - g.t0, d = g.anim.dur || 1, bi = g.bi != null ? g.bi : 0.2, bo = g.bo != null ? g.bo : 0.3;
          if (lt > d + bo && !g.hold) holder._gesture = null;
          else {
            // Überblenden: Pose von Idle/Stand weich in den ersten Keyframe der Geste und am Ende zurück (bi/bo Sekunden)
            const w = g.hold && lt > d ? 1 : Math.max(0, Math.min(1, bi > 0 ? lt / bi : 1, bo > 0 ? (d + bo - lt) / bo : (lt <= d ? 1 : 0)));
            const ga = Anim.angles(g.anim.actors[0], Math.min(lt, d));
            const keys = new Set([...Object.keys(out), ...Object.keys(ga)]);
            for (const k of keys) out[k] = (out[k] || 0) * (1 - w) + (ga[k] || 0) * w;
            const go = Anim.moveOf(g.anim.actors[0], Math.min(lt, d));
            if (go || off) { const A = off || Anim.REST, B = go || Anim.REST; off = {}; for (const f of Object.keys(Anim.REST)) off[f] = A[f] * (1 - w) + B[f] * w; }
          }
        }
        Anim.applyMove(holder, off);
        return out;
      };
    },
    // Bewegung der ganzen Figur in Idle/Geste: Abweichung von der Ruhelage (x 50, y 0, Größe 100 …)
    REST: { x: 50, y: 0, scale: 100, rot: 0, opacity: 100 },
    moveOf(actor, t) { return actor && actor.move && actor.move.length ? Anim.place(actor, t) : null; },
    applyMove(holder, off) {
      if (!holder || !holder.querySelector) return;
      if (!off && !holder._mvOn) return;
      const cv = holder._mvEl && holder._mvEl.isConnected ? holder._mvEl : (holder._mvEl = holder.querySelector('canvas'));
      if (!cv) return;
      if (!off) { holder._mvOn = false; cv.style.translate = cv.style.rotate = cv.style.scale = cv.style.opacity = ''; return; }
      holder._mvOn = true;
      cv.style.transformOrigin = '50% 100%';
      const now = performance.now();
      if (!holder._mvH || now - (holder._mvHt || 0) > 600) { holder._mvH = holder.offsetHeight || cv.offsetHeight || 0; holder._mvHt = now; }
      // Werte wie im Editor: X/Y in % der Bühne (16:9), Figur = 88 % der Bühnenhöhe
      const fh = holder._mvH, sh = fh / 0.88;
      cv.style.translate = ((off.x - 50) / 100 * sh * 16 / 9).toFixed(1) + 'px ' + (-off.y / 100 * sh).toFixed(1) + 'px';
      cv.style.rotate = off.rot ? off.rot.toFixed(2) + 'deg' : '';
      cv.style.scale = Math.abs(off.scale - 100) > 0.01 ? (off.scale / 100).toFixed(3) : '';
      cv.style.opacity = off.opacity < 99.9 ? (off.opacity / 100).toFixed(3) : '';
    },
    // o: { blendIn, blendOut (Sekunden), hold: am Ende stehen bleiben (z. B. K.O.) }
    gesture(holder, animId, o = {}) { const a = Anim.get(animId); if (a) holder._gesture = { anim: a, t0: performance.now() / 1000, bi: o.blendIn, bo: o.blendOut, hold: !!o.hold }; return a; },

    // ---------- Zusammensetzen auf ein Canvas (Editor, Spiel, Video) ----------
    // scene: { anim, actors: [{ actor, inst, img }] , bgImg }
    async build(anim) {
      const sc = { anim, items: [], bgImg: null };
      if (anim.bg && VN.assetUrl(anim.bg)) sc.bgImg = await Anim.loadImg(VN.assetUrl(anim.bg));
      for (const actor of anim.actors || []) {
        const it = { actor, inst: null, img: null };
        // Gliederpuppe (0.7.6)
        const pup = actor.puppet && window.Puppet && Puppet.get(actor.puppet);
        if (pup) { it.pupDef = pup; it.pup = await Puppet.load(pup); it.st = {}; sc.items.push(it); continue; }
        if (actor.asset && window.Rig && Rig.has(actor.asset)) {
          const cv = Rig.canvasFor(actor.asset, { boneAmp: 100 }, { manual: true });
          it.inst = await cv._inst.ready;
        }
        if (!it.inst && actor.asset && VN.assetUrl(actor.asset)) it.img = await Anim.loadImg(VN.assetUrl(actor.asset)).catch(() => null);
        sc.items.push(it);
      }
      return sc;
    },
    loadImg(url) { return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = url; }); },
    // Ein Bild der Animation zeichnen; liefert für jeden Darsteller die Umrechnung Bild → Canvas
    // Festgehaltene Haftpunkte einer Puppe (0.9.13): actor.holds = { Haftpunkt-ID: { x, y } } in Szenen-Anteilen (0–1)
    holdsFor(it, cmNow, camM, W, H) {
      const a = it.actor, pup = a && a.puppet && Puppet.get(a.puppet);
      if (!pup || !a.holds) return [];
      const out = [], toLocal = Puppet.m.mul(Puppet.m.inv(cmNow), camM);
      for (const p of pup.parts) for (const hp of p.holdPts || []) {
        const h = a.holds[hp.id];
        if (!h) continue;
        const [x, y] = Puppet.m.ap(toLocal, h.x * W, h.y * H);
        out.push({ id: hp.id, part: p.id, u: hp.u, v: hp.v, soft: hp.soft, x, y });
      }
      return out;
    },
    draw(ctx, sc, t, dt, opts = {}) {
      const W = ctx.canvas.width, H = ctx.canvas.height;
      const anim = sc.anim;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!opts.noClear) {
        ctx.clearRect(0, 0, W, H);
        if (anim.type === 'scene' || opts.bgFill) { ctx.fillStyle = opts.bgColor || '#0c0d10'; ctx.fillRect(0, 0, W, H); }
      }
      const cam = anim.type === 'scene' ? Anim.cam(anim, t) : { zoom: 100, panX: 0, panY: 0, rot: 0 };
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(cam.zoom / 100, cam.zoom / 100);
      ctx.translate(-cam.panX / 100 * W, -cam.panY / 100 * H);
      ctx.rotate(cam.rot * Math.PI / 180);
      ctx.translate(-W / 2, -H / 2);
      if (sc.bgImg && !opts.noBg) {
        const im = sc.bgImg, k = Math.max(W / im.naturalWidth, H / im.naturalHeight);
        ctx.drawImage(im, (W - im.naturalWidth * k) / 2, (H - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k);
      }
      const maps = [];
      sc._main = opts.alpha == null;
      const smearOn = !!(window.Smear && dt > 0 && opts.alpha == null);
      // Kamera-Matrix (Szene → Leinwand), für festgehaltene Haftpunkte (0.9.13)
      const camM = (() => { const m = ctx.getTransform(); return [m.a, m.b, m.c, m.d, m.e, m.f]; })();
      // Nähte zwischen Figuren (0.9.12): zuerst die Lage aller Puppenteile, damit eine Figur an eine andere angenäht sein kann
      const placeOf = (it, a) => {
        const pl = Anim.place(a, t);
        const boxH = 0.88 * pl.scale / 100 * H;
        ctx.save();
        ctx.translate(pl.x / 100 * W, H - pl.y / 100 * H); ctx.rotate(pl.rot * Math.PI / 180); if (a.flip) ctx.scale(-1, 1);
        const m = ctx.getTransform(); ctx.restore();
        const pup = Puppet.get(a.puppet) || it.pupDef, bb = Puppet.bounds(pup), k = boxH / bb.h;
        const base = Puppet.m.mul(Puppet.m.S(k, k), Puppet.m.T(-(bb.x + bb.w / 2), -(bb.y + bb.h)));
        const cm = [m.a, m.b, m.c, m.d, m.e, m.f];
        return { cm, pup, base };
      };
      if (sc.items.some((it) => it.pup && (it.actor.seams || []).length)) {
        for (const it of sc.items) {
          if (!it.pup) { it._wm = null; continue; }
          const P0 = placeOf(it, it.actor), ms = Puppet.solve(P0.pup, opts.pose || Puppet.poseAt(it.actor, t), null, null, 0);
          it._wm = {}; for (const [pid, pm] of Object.entries(ms)) it._wm[pid] = Puppet.m.mul(P0.cm, Puppet.m.mul(P0.base, pm));
        }
      }
      const extFor = (it, cmNow) => {
        const L = (it.actor.seams || []).filter((s) => s.toActor && s.toPart);
        const holds = Anim.holdsFor(it, cmNow, camM, W, H);
        if (!L.length) return holds.length ? { holds } : {};
        const ext = {}, icm = Puppet.m.inv(cmNow);
        for (const s of L) { const tg = sc.items.find((x) => x.actor.id === s.toActor); if (tg && tg._wm && tg._wm[s.toPart]) ext[s.id] = Puppet.m.mul(icm, tg._wm[s.toPart]); }
        return { extSeams: L, ext, holds };
      };
      for (const it of sc.items) {
        const a = it.actor;
        const pl = Anim.place(a, t);
        const boxH = 0.88 * pl.scale / 100 * H;
        const baseX = pl.x / 100 * W, baseY = H - pl.y / 100 * H;
        ctx.save();
        ctx.globalAlpha = (opts.alpha != null ? opts.alpha : 1) * pl.opacity / 100;
        // Maske (0.9.24): schneidet den Darsteller aus – Rechteck, Ellipse oder freie Form, keyframebar
        if (a.mask && a.mask.on && !opts.noMask) Anim.clipMask(ctx, a, t, W, H);
        // Objekt an einem Mund (0.9.24): hinter der Lippenlinie unsichtbar
        if (a.mouthProp && a.mouthProp.target) Anim.Mouth.clipProp(ctx, sc, a);
        ctx.translate(baseX, baseY);
        ctx.rotate(pl.rot * Math.PI / 180);
        if (a.flip) ctx.scale(-1, 1);
        let map = null, geo = null;
        if (it.pup) {
          const pup = Puppet.get(a.puppet) || it.pupDef;
          const bb = Puppet.bounds(pup);
          const k = boxH / bb.h;
          const base = Puppet.m.mul(Puppet.m.S(k, k), Puppet.m.T(-(bb.x + bb.w / 2), -(bb.y + bb.h)));
          const pose = opts.pose || Puppet.poseAt(a, t);
          // Smear-Bilder (0.9.9): Puppe auf eigener Ebene zeichnen, dann Smear dahinter
          const smc = smearOn ? Smear.cfgFor(anim.smear) : null;
          let out;
          if (smc) {
            const L = Smear.layer(W, H), lg = L.getContext('2d');
            lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, 0, W, H);
            const m0 = ctx.getTransform(); lg.setTransform(m0);
            out = Puppet.draw(lg, pup, it.pup, base, t, dt, pose, it.st, extFor(it, [m0.a, m0.b, m0.c, m0.d, m0.e, m0.f]));
            const cm0 = [m0.a, m0.b, m0.c, m0.d, m0.e, m0.f], wm = {};
            for (const [pid, pm] of Object.entries(out)) wm[pid] = Puppet.m.mul(cm0, pm);
            Smear.inPlace(L, it._sm || (it._sm = {}), Smear.pupPts(pup, wm), t, boxH, smc, (dtF) => Smear.marked(anim, t - dtF, t));
            ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L, 0, 0); ctx.setTransform(m0);
          } else { const m1 = ctx.getTransform(); out = Puppet.draw(ctx, pup, it.pup, base, t, dt, pose, it.st, extFor(it, [m1.a, m1.b, m1.c, m1.d, m1.e, m1.f])); }
          const m = ctx.getTransform(), cm = [m.a, m.b, m.c, m.d, m.e, m.f];
          it.pmats = {}; for (const [pid, pm] of Object.entries(out)) it.pmats[pid] = Puppet.m.mul(cm, pm);
          it.pbase = Puppet.m.mul(cm, base);
        } else if (it.inst) {
          Rig.renderAt(it.inst, t, dt, Anim.angles(a, t));
          const smc = smearOn ? Smear.cfgFor(anim.smear) : null;
          if (smc) Smear.inPlace(it.inst.cv, it._sm || (it._sm = {}), Smear.rigPts(it.inst), t, it.inst.mesh.h, smc, (dtF) => Smear.marked(anim, t - dtF, t));
          const P = Rig.PAD, cv = it.inst.cv;
          const cvH = boxH * (1 + 2 * P), cvW = cvH * cv.width / cv.height;
          const ox = -cvW / 2, oy = P * boxH - cvH;
          const sx = cvW / cv.width, sy = cvH / cv.height;
          const mw = it.inst.mesh.w * P, mh = it.inst.mesh.h * P;
          const m = ctx.getTransform();
          map = (x, y) => { const lx = ox + (x + mw) * sx, ly = oy + (y + mh) * sy; return [m.a * lx + m.c * ly + m.e, m.b * lx + m.d * ly + m.f]; };
          // Normierte Bildpunkte (0…1 im Mesh) → lokale Koordinaten; mit Knochen folgt der Punkt der Pose
          geo = { mat: [m.a, m.b, m.c, m.d, m.e, m.f], toLocal: (u, v, bone) => { let x = u * it.inst.mesh.w, y = v * it.inst.mesh.h; const bm = bone && it.inst.lastMats && it.inst.lastMats[bone]; if (bm) { const X = bm[0] * x + bm[2] * y + bm[4]; y = bm[1] * x + bm[3] * y + bm[5]; x = X; } return [ox + (x + mw) * sx, oy + (y + mh) * sy]; },
            fromLocal: (lx, ly, bone) => { let x = (lx - ox) / sx - mw, y = (ly - oy) / sy - mh; const bm = bone && it.inst.lastMats && it.inst.lastMats[bone]; if (bm) { const d = bm[0] * bm[3] - bm[1] * bm[2] || 1, X = x - bm[4], Y = y - bm[5]; x = (bm[3] * X - bm[2] * Y) / d; y = (-bm[1] * X + bm[0] * Y) / d; } return [x / it.inst.mesh.w, y / it.inst.mesh.h]; } };
          const drawIt = (g) => (g || ctx).drawImage(cv, ox, oy, cvW, cvH);
          if (a.mouth && a.mouth.on && !opts.noMouth) Anim.Mouth.draw(ctx, sc, it, a, geo, drawIt, W, H); else drawIt();
        } else if (it.img) {
          const ih = boxH, iw = ih * it.img.naturalWidth / it.img.naturalHeight;
          const m = ctx.getTransform();
          geo = { mat: [m.a, m.b, m.c, m.d, m.e, m.f], toLocal: (u, v) => [-iw / 2 + u * iw, -ih + v * ih], fromLocal: (lx, ly) => [(lx + iw / 2) / iw, (ly + ih) / ih] };
          const drawIt = (g) => (g || ctx).drawImage(it.img, -iw / 2, -ih, iw, ih);
          if (a.mouth && a.mouth.on && !opts.noMouth) Anim.Mouth.draw(ctx, sc, it, a, geo, drawIt, W, H); else drawIt();
        }
        ctx.restore();
        if (opts.alpha == null) it._geo = geo;
        maps.push({ it, map, base: [baseX, baseY], boxH, geo });
        maps.cam = camM;
      }
      ctx.restore();
      return maps;
    },

    // Abspielen auf einem Canvas (Zwischensequenz im Spiel). Gibt { stop } zurück, ruft onEnd am Ende
    play(canvas, anim, opts = {}) {
      const ctrl = { stopped: false, t: 0 };
      const audios = [];
      const ctx = canvas.getContext('2d');
      Anim.build(anim).then((sc) => {
        if (ctrl.stopped) return;
        const fit = () => { const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.max(2, Math.round(r.width * dpr)); canvas.height = Math.max(2, Math.round(r.height * dpr)); };
        fit();
        const t0 = performance.now();
        let last = t0;
        for (const au of anim.audio || []) {
          const url = VN.assetUrl(au.asset);
          if (!url) continue;
          const a = new Audio(url);
          a.volume = Math.max(0, Math.min(1, (au.vol != null ? au.vol : 90) / 100 * (opts.volume != null ? opts.volume : 1)));
          const tm = setTimeout(() => { if (!ctrl.stopped) a.play().catch(() => {}); }, (au.at || 0) * 1000);
          audios.push({ a, tm });
        }
        const frame = (now) => {
          if (ctrl.stopped || !canvas.isConnected) { ctrl.stop(); return; }
          const fps = VN.animFps(anim.fps);
          const gap = window.Perf ? Perf.minInterval('bones') * 1000 : 0;
          if (fps ? !VN.fpsStep(ctrl, (now - t0) / 1000, fps) : (gap && now - last < gap)) { requestAnimationFrame(frame); return; }
          const t = fps ? Math.floor((now - t0) / 1000 * fps + 1e-6) / fps : (now - t0) / 1000;
          const dur = anim.dur || 3;
          const tt = anim.loop ? t % dur : Math.min(t, dur);
          if (canvas.width !== Math.round(canvas.getBoundingClientRect().width * Math.min(2, window.devicePixelRatio || 1))) fit();
          Anim.draw(ctx, sc, tt, Math.min(fps ? 1 / 5 : 1 / 30, (now - last) / 1000));
          last = now;
          ctrl.t = tt;
          if (!anim.loop && t >= dur) { ctrl.stop(true); if (opts.onEnd) opts.onEnd(); return; }
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      ctrl.stop = (keepFrame) => { ctrl.stopped = true; for (const x of audios) { clearTimeout(x.tm); x.a.pause(); } };
      return ctrl;
    },
    // Standbild für den Editor
    async still(canvas, anim, t) {
      const sc = await Anim.build(anim);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(2, Math.round(r.width || 640)); canvas.height = Math.max(2, Math.round(r.height || 360));
      Anim.draw(canvas.getContext('2d'), sc, t || 0, 0);
    }
  });
})();
