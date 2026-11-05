// Gliederpuppen (0.7.6): Figuren aus einzelnen Körperteilen (wie Ebenen in After Effects), verbunden über
// Gelenk-Pins. Jedes Teil dreht sich um seinen Pin; Kinder wandern mit dem Eltern-Teil mit (Oberarm hängt an
// der Schulter des Torsos, Unterarm am Ellbogen …). Teile können eigene Bones haben (Reiter „Bones“) und eine
// eigene Idle-Bewegung (Wackeln, Atmen, Wippen, Jiggle). Im Animations-Editor wird die Puppe wie beim
// Puppenspiel bewegt: Teile drehen, ganze Figur verschieben, Gliedmaßen festpinnen (IK hält sie an ihrem Platz).
// Laufzeit – läuft auch im exportierten Spiel. Editor: puppet-edit.js
(function () {
  const P = (window.Puppet = {});
  const D2R = Math.PI / 180;
  // ---------- 2D-Matrizen [a, b, c, d, e, f] ----------
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const T = (x, y) => [1, 0, 0, 1, x, y];
  const R = (deg) => { const a = deg * D2R, c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
  const S = (x, y) => [x, 0, 0, y, 0, 0];
  const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const inv = (m) => { const d = m[0] * m[3] - m[1] * m[2] || 1e-9; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d]; };
  P.m = { mul, T, R, S, ap, inv, I: [1, 0, 0, 1, 0, 0] };

  // Feste Gelenke (0.9.8, Standard): Teile, die an einem anderen hängen, bleiben immer an ihrem Gelenk – sie drehen
  // sich nur noch, verschieben sich nie (auch nicht durch Wippen oder alte Keyframes). Aus: pup.freeJoints = true.
  P.fixed = (pup) => !(pup && pup.freeJoints);
  P.IDLE = [['none', 'Keine'], ['sway', 'Wackeln (pendelt)'], ['breathe', 'Atmen (dehnt sich)'], ['bob', 'Wippen (auf und ab)'], ['jiggle', 'Jiggle (schwingt nach)']];
  P.list = () => (VN.project && VN.project.puppets) || [];
  P.get = (id) => P.list().find((x) => x.id === id) || null;
  P.part = (pup, id) => (pup && pup.parts.find((x) => x.id === id)) || null;

  P.newPart = (asset, w, h, x, y) => ({
    id: VN.uid('pp'), name: (VN.asset(asset) || {}).name || VN.t('Teil'), asset, parent: null,
    x: Math.round(x || 0), y: Math.round(y || 0), w: Math.round(w || 100), h: Math.round(h || 100),
    ax: Math.round((w || 100) / 2), ay: Math.round((h || 100) * 0.12), rot: 0,
    idle: { type: 'none', amp: 4, speed: 3, phase: 0 }, bones: true
  });

  // Eltern zuerst; Schleifen (A hängt an B hängt an A) werden aufgelöst
  P.order = (pup) => {
    const out = [], seen = new Set(), busy = new Set();
    const visit = (p) => {
      if (seen.has(p.id)) return;
      if (busy.has(p.id)) { p.parent = null; return; }
      busy.add(p.id);
      const par = p.parent && P.part(pup, p.parent);
      if (par) visit(par); else if (p.parent) p.parent = null;
      busy.delete(p.id); seen.add(p.id); out.push(p);
    };
    pup.parts.forEach(visit);
    return out;
  };
  P.children = (pup, id) => pup.parts.filter((x) => x.parent === id);
  P.descendants = (pup, id) => { const out = new Set(); const go = (pid) => { for (const c of P.children(pup, pid)) if (!out.has(c.id)) { out.add(c.id); go(c.id); } }; go(id); return out; };
  P.roots = (pup) => pup.parts.filter((x) => !x.parent);
  // Ruhe-Matrix (ohne Animation): eigenes Bild → Puppen-Fläche
  P.rest = (p) => mul(mul(T(p.x + p.ax, p.y + p.ay), R(p.rot || 0)), T(-p.ax, -p.ay));
  // Endpunkt eines Teils (für IK und Griffe): eingestellt oder dem Pin gegenüber
  // Ohne eigene Länge (Lineal, 0.9.8): bei genau einem Kind dessen Gelenk (Oberschenkel bis Knie), sonst gegenüber
  P.tip = (p, pup) => {
    if (p.tx != null) return [p.tx, p.ty];
    const kids = pup ? P.children(pup, p.id) : [];
    if (kids.length === 1) return ap(inv(P.rest(p)), kids[0].x + kids[0].ax, kids[0].y + kids[0].ay);
    return [p.w - p.ax, p.h - p.ay];
  };
  // Länge eines Glieds (Gelenk bis Endpunkt) in Pixeln
  P.length = (p, pup) => { const [x, y] = P.tip(p, pup); return Math.hypot(x - p.ax, y - p.ay); };
  // Gelenk-Grenzen (0.9.8): Drehung gegenüber der Ruhe-Lage, in Grad (min ≤ r ≤ max)
  P.lim = (p) => (p && p.lim && p.lim.on !== false && Number.isFinite(Number(p.lim.min)) && Number.isFinite(Number(p.lim.max)) ? [Math.min(Number(p.lim.min), Number(p.lim.max)), Math.max(Number(p.lim.min), Number(p.lim.max))] : null);
  P.clampR = (p, r) => { const L = P.lim(p); return L ? Math.max(L[0], Math.min(L[1], r)) : r; };

  // ---------- Pins folgen den Bones des Eltern-Teils (0.7.8) ----------
  // Hat das Eltern-Teil Bones, verformt es sich (Atmen, Schwanken, Physik). Der Pin eines Kindes wandert dann mit
  // der verformten Stelle mit und dreht sich mit ihr. Gemessen wird an den nächsten Gitterpunkten des Bones-Netzes.
  const near = (inst, mx, my) => {
    const key = Math.round(mx) + ',' + Math.round(my);
    const c = inst._pinNear || (inst._pinNear = new Map());
    if (c.has(key)) return c.get(key);
    const { pos, count } = inst.mesh;
    const best = [];
    for (let i = 0; i < count; i++) {
      const d = (pos[i * 2] - mx) ** 2 + (pos[i * 2 + 1] - my) ** 2;
      if (best.length < 4) { best.push([d, i]); best.sort((a, b) => a[0] - b[0]); } else if (d < best[3][0]) { best[3] = [d, i]; best.sort((a, b) => a[0] - b[0]); }
    }
    let sum = 0;
    const out = best.map(([d, i]) => { const w = 1 / (d + 1); sum += w; return [i, w]; });
    for (const o of out) o[1] /= sum || 1;
    c.set(key, out);
    return out;
  };
  // Verschiebung (in Pixeln des Teils) eines Punktes u, v durch die aktuelle Verformung
  const shiftAt = (inst, p, u, v) => {
    const { mesh, out } = inst;
    if (!mesh || !out) return [0, 0];
    const kx = mesh.w / p.w, ky = mesh.h / p.h, PAD = window.Rig ? Rig.PAD : 0.15;
    let dx = 0, dy = 0;
    for (const [i, w] of near(inst, u * kx, v * ky)) { dx += w * (out[i * 2] - mesh.w * PAD - mesh.pos[i * 2]); dy += w * (out[i * 2 + 1] - mesh.h * PAD - mesh.pos[i * 2 + 1]); }
    return [dx / kx, dy / ky];
  };
  P.deformFn = (pup, res) => (parentId, u, v) => {
    const inst = res && res.rigs && res.rigs[parentId];
    const p = P.part(pup, parentId);
    if (!inst || !inst.ok || !p) return null;
    const [dx, dy] = shiftAt(inst, p, u, v);
    // Drehung der Stelle aus zwei Nachbarpunkten
    const s = Math.max(6, Math.min(p.w, p.h) * 0.08);
    const [ax, ay] = shiftAt(inst, p, u + s, v), [bx, by] = shiftAt(inst, p, u, v + s);
    const r1 = Math.atan2(ay - dy, s + ax - dx), r2 = Math.atan2(-(bx - dx), s + by - dy);
    return { dx, dy, da: ((r1 + r2) / 2) / D2R };
  };

  // ---------- Pose berechnen ----------
  // pose: { [partId]: { r, x, y } } – Drehung in Grad, Versatz in Pixeln (im Eltern-Bild)
  // deform (optional): Verformung durch Bones der Eltern-Teile (siehe P.deformFn)
  // Liefert { [partId]: Matrix } (eigenes Bild → Puppen-Fläche)
  P.solve = (pup, pose, t, st, dt, deform) => {
    const mats = {};
    pose = pose || {};
    for (const p of P.order(pup)) {
      const ps = pose[p.id] || {};
      const id = p.idle || {};
      const amp = Number(id.amp) || 0, spd = Math.max(0.2, Number(id.speed) || 3), ph = (Number(id.phase) || 0) * D2R;
      const wave = t != null ? Math.sin(2 * Math.PI * t / spd + ph) : 0;
      const anchored = !!(p.parent && P.fixed(pup));
      let rot = Number(ps.r) || 0, ox = anchored ? 0 : Number(ps.x) || 0, oy = anchored ? 0 : Number(ps.y) || 0, sx = 1, sy = 1;
      if (id.type === 'sway') rot += amp * wave;
      // Wippen an einem festen Gelenk: federt in sich (dehnt sich entlang des Teils) statt vom Gelenk wegzurutschen
      else if (id.type === 'bob') { if (anchored) sy += amp / 200 * wave; else oy += amp * wave; }
      else if (id.type === 'breathe') { sy += amp / 100 * wave; sx += amp / 250 * wave; }
      let base, local;
      if (p.parent && mats[p.parent]) {
        const par = P.part(pup, p.parent);
        // Pin dieses Teils, ausgedrückt im Bild des Eltern-Teils (Ruhe-Lage) – so wandert er mit dem Eltern-Teil mit
        const [lx, ly] = ap(inv(P.rest(par)), p.x + p.ax, p.y + p.ay);
        const df = deform ? deform(par.id, lx, ly) : null;
        base = mul(mats[p.parent], T(lx + ox + (df ? df.dx : 0), ly + oy + (df ? df.dy : 0)));
        local = (p.rot || 0) - (par.rot || 0) + (df ? df.da : 0);
      } else {
        base = T(p.x + p.ax + ox, p.y + p.ay + oy);
        local = p.rot || 0;
      }
      // Jiggle: Feder, die auf Bewegungen des Pins reagiert (schwingt nach)
      if (id.type === 'jiggle' && st) {
        const s = st[p.id] || (st[p.id] = { a: 0, v: 0, px: null, py: null, vx: 0, vy: 0 });
        const wx = base[4], wy = base[5];
        if (s.px !== null && dt > 0) {
          const vx = (wx - s.px) / dt, vy = (wy - s.py) / dt;
          const ax = (vx - s.vx) / dt, ay = (vy - s.vy) / dt;
          s.vx = vx; s.vy = vy;
          const k = 40, d = 5;
          const push = (ax * Math.cos((local + rot) * D2R + Math.PI / 2) + ay * Math.sin((local + rot) * D2R + Math.PI / 2)) * 0.0004 * (amp || 4) / 4;
          s.v += (-k * s.a - d * s.v + push) * dt;
          s.a += s.v * dt;
          s.a = Math.max(-40, Math.min(40, s.a));
        }
        s.px = wx; s.py = wy;
        rot += s.a + (amp ? amp * 0.15 * wave : 0);
      }
      mats[p.id] = mul(mul(mul(base, R(local + rot)), S(sx, sy)), T(-p.ax, -p.ay));
    }
    return mats;
  };

  // Umriss in Ruhe-Lage (für Größe auf der Bühne)
  P.bounds = (pup) => {
    if (!pup || !pup.parts.length) return { x: 0, y: 0, w: 100, h: 100 };
    const mats = P.solve(pup, null, null, null, 0);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pup.parts) for (const [u, v] of [[0, 0], [p.w, 0], [0, p.h], [p.w, p.h]]) {
      const [x, y] = ap(mats[p.id], u, v);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  };

  // ---------- Bilder und Bones laden ----------
  const imgCache = {};
  const loadImg = (url) => imgCache[url] || (imgCache[url] = new Promise((res) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = url; }));
  // res: { imgs: {partId: Image}, rigs: {partId: Rig-Instanz} }
  P.load = async (pup, opts = {}) => {
    const res = { imgs: {}, rigs: {} };
    await Promise.all(pup.parts.map(async (p) => {
      const url = p.asset && VN.assetUrl(p.asset);
      if (!url) return;
      if (p.bones !== false && window.Rig && Rig.has(p.asset) && !opts.noBones) {
        const cv = Rig.canvasFor(p.asset, { boneAmp: 100 }, { manual: true });
        const inst = await cv._inst.ready;
        if (inst) { res.rigs[p.id] = inst; return; }
      }
      res.imgs[p.id] = await loadImg(url);
    }));
    return res;
  };

  // ---------- Zeichnen ----------
  // base: Matrix Puppen-Fläche → Canvas. Liefert die Matrizen (eigenes Bild → Canvas) je Teil.
  P.draw = (ctx, pup, res, base, t, dt, pose, st, opts = {}) => {
    // Bones zuerst verformen, damit die Pins der Kinder der Verformung folgen
    if (res) for (const p of pup.parts) { const inst = res.rigs[p.id]; if (inst && !(opts.override && opts.override[p.id])) Rig.renderAt(inst, t || 0, dt || 0, null); }
    const mats = P.solve(pup, pose, t, st, dt, res ? P.deformFn(pup, res) : null);
    const out = {};
    const keep = ctx.getTransform();
    const k = [keep.a, keep.b, keep.c, keep.d, keep.e, keep.f];
    const PAD = window.Rig ? Rig.PAD : 0.15;
    for (const p of pup.parts) {
      if (p.hidden) continue;
      const M = mul(base, mats[p.id]);
      out[p.id] = M;
      const W = mul(k, p.flipX ? mul(M, [-1, 0, 0, 1, p.w, 0]) : M);
      ctx.setTransform(W[0], W[1], W[2], W[3], W[4], W[5]);
      const inst = res && res.rigs[p.id];
      const ov = opts.override && opts.override[p.id];
      if (ov) ctx.drawImage(ov, 0, 0, p.w, p.h);
      else if (inst) {
        ctx.drawImage(inst.cv, -PAD * p.w, -PAD * p.h, p.w * (1 + 2 * PAD), p.h * (1 + 2 * PAD));
      } else {
        const im = res && res.imgs[p.id];
        if (im) ctx.drawImage(im, 0, 0, p.w, p.h);
        else if (opts.placeholder) {
          // Leerer Platz (Vorlage): grau mit gestricheltem Rand und Namen
          ctx.fillStyle = 'rgba(160,160,180,0.22)'; ctx.fillRect(0, 0, p.w, p.h);
          ctx.strokeStyle = 'rgba(200,200,220,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.strokeRect(1, 1, p.w - 2, p.h - 2); ctx.setLineDash([]);
          if (p.name) { ctx.fillStyle = 'rgba(230,230,240,0.9)'; ctx.font = Math.max(11, Math.min(22, p.w / 6)) + 'px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.name, p.w / 2, p.h / 2, p.w - 6); }
        }
      }
    }
    ctx.setTransform(keep);
    return out;
  };

  // ---------- Animationen ----------
  // Pose eines Animations-Darstellers zur Zeit t (Keyframes je Teil: r, x, y)
  P.poseAt = (actor, t) => {
    const out = {};
    for (const [pid, keys] of Object.entries((actor && actor.parts) || {})) {
      const ks = (keys || []).slice().sort((a, b) => a.t - b.t);
      const g = (f) => (window.Anim ? Anim.sample(ks, t, f) : null);
      const r = g('r'), x = g('x'), y = g('y');
      if (r != null || x != null || y != null) out[pid] = { r: r || 0, x: x || 0, y: y || 0 };
    }
    return out;
  };
  P.addPose = (a, b, w) => {
    const out = JSON.parse(JSON.stringify(a || {}));
    for (const [pid, v] of Object.entries(b || {})) {
      const o = out[pid] || (out[pid] = { r: 0, x: 0, y: 0 });
      o.r = (o.r || 0) * (1 - w) + (v.r || 0) * w; o.x = (o.x || 0) * (1 - w) + (v.x || 0) * w; o.y = (o.y || 0) * (1 - w) + (v.y || 0) * w;
    }
    return out;
  };

  // ---------- IK (Puppenspiel) ----------
  // Dreht die Teile einer Kette (Ende zuerst, höchstens n Glieder), bis der Punkt end (im Bild des letzten Teils)
  // bei target (Puppen-Fläche) liegt. Ändert pose. Gesperrte Teile (lock) drehen nicht mit.
  P.ik = (pup, pose, endId, endPt, target, opts = {}) => {
    const chain = [];
    let p = P.part(pup, endId);
    while (p && chain.length < (opts.links || 3)) { if (!(opts.lock && opts.lock.has(p.id))) chain.push(p); if (!p.parent || (opts.stopAt && opts.stopAt === p.id)) break; p = P.part(pup, p.parent); }
    if (!chain.length) return;
    for (let it = 0; it < (opts.iter || 12); it++) {
      for (const j of chain) {
        const mats = P.solve(pup, pose, null, null, 0);
        const piv = ap(mats[j.id], j.ax, j.ay);
        const end = ap(mats[endId], endPt[0], endPt[1]);
        let d = (Math.atan2(target[1] - piv[1], target[0] - piv[0]) - Math.atan2(end[1] - piv[1], end[0] - piv[0])) / D2R;
        if (d > 180) d -= 360; if (d < -180) d += 360;
        const ps = pose[j.id] || (pose[j.id] = { r: 0, x: 0, y: 0 });
        ps.r = P.clampR(j, Math.max(-360, Math.min(360, (ps.r || 0) + d * 0.9)));
      }
      const mats = P.solve(pup, pose, null, null, 0);
      const end = ap(mats[endId], endPt[0], endPt[1]);
      if (Math.hypot(end[0] - target[0], end[1] - target[1]) < 0.5) break;
    }
  };
  // Festgepinnte Teile nach einer Bewegung wieder an ihren alten Platz ziehen
  P.keepPins = (pup, pose, pins, before) => {
    for (const pid of pins) {
      const part = P.part(pup, pid);
      if (!part || !before[pid]) continue;
      P.ik(pup, pose, pid, P.tip(part, pup), before[pid], { links: 6, lock: new Set(P.roots(pup).map((r) => r.id)) });
    }
  };
  P.tipWorld = (pup, pose, pid) => { const part = P.part(pup, pid); const m = P.solve(pup, pose, null, null, 0)[pid]; return part && m ? ap(m, ...P.tip(part, pup)) : null; };
  // Wurzel eines Teils (oberstes Eltern-Teil)
  P.rootOf = (pup, id) => { let p = P.part(pup, id), n = 0; while (p && p.parent && n++ < 40) p = P.part(pup, p.parent); return p; };

  // ---------- Puppenspiel mit festgeklebten Gliedern (0.9.8) ----------
  // Körper (Wurzel-Teil) bewegen oder neigen, während festgepinnte Teile (z. B. Füße) an ihrem Platz bleiben:
  // Die Ketten dazwischen (Unterschenkel, Oberschenkel) beugen sich – nur so weit, wie Gelenk-Grenzen es erlauben.
  // Reichen die Glieder nicht, bleibt der Körper so weit wie möglich stehen (gestreckte Beine = höchster Punkt).
  // want: { x, y, r } gewünschte Wurzel-Pose; pins: Teil-IDs; fixed: { id: [x, y] } Zielpunkte der Pins
  const wAng = (m) => Math.atan2(m[1], m[0]) / D2R;
  const norm = (d) => { while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
  // Zwei Glieder (z. B. Oberschenkel + Unterschenkel) so drehen, dass das Gelenk von E (Knöchel) bei T liegt.
  // Von den zwei möglichen Knick-Richtungen wird die genommen, die die Gelenk-Grenzen einhält.
  const twoBone = (pup, pose, B, A, E, T) => {
    const loc = (par, child) => ap(inv(P.rest(par)), child.x + child.ax, child.y + child.ay);
    const kA = loc(B, A), kE = loc(A, E);
    const L1 = Math.hypot(kA[0] - B.ax, kA[1] - B.ay), L2 = Math.hypot(kE[0] - A.ax, kE[1] - A.ay);
    const b0 = Math.atan2(kA[1] - B.ay, kA[0] - B.ax) / D2R, a0 = Math.atan2(kE[1] - A.ay, kE[0] - A.ax) / D2R;
    const psB = pose[B.id] || (pose[B.id] = { r: 0, x: 0, y: 0 }), psA = pose[A.id] || (pose[A.id] = { r: 0, x: 0, y: 0 });
    const m = P.solve(pup, pose, null, null, 0);
    const bp = ap(m[B.id], B.ax, B.ay);
    let d = Math.hypot(T[0] - bp[0], T[1] - bp[1]);
    d = Math.max(Math.abs(L1 - L2) + 0.01, Math.min(L1 + L2 - 0.01, d));
    const phi = Math.atan2(T[1] - bp[1], T[0] - bp[0]) / D2R;
    const al = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)))) / D2R;
    const thB = wAng(m[B.id]), thA = wAng(m[A.id]);
    let best = null;
    for (const sgn of [1, -1]) {
      const dirB = phi + sgn * al;
      const rB = (psB.r || 0) + norm(dirB - b0 - thB);
      // Knie-Position und Richtung des Unterschenkels zum Ziel
      const kx = bp[0] + L1 * Math.cos(dirB * D2R), ky = bp[1] + L1 * Math.sin(dirB * D2R);
      const dirA = Math.atan2(T[1] - ky, T[0] - kx) / D2R;
      // Welt-Winkel von A nach der Drehung von B: thA ändert sich um dieselbe Differenz wie B
      const thA2 = thA + (rB - (psB.r || 0));
      const rA = (psA.r || 0) + norm(dirA - a0 - thA2);
      const over = (p, r) => { const L = P.lim(p); return L ? Math.max(0, L[0] - r, r - L[1]) : 0; };
      const cost = over(B, rB) * 10 + over(A, rA) * 10 + Math.abs(norm(rA - (psA.r || 0))) * 0.01 + Math.abs(norm(rB - (psB.r || 0))) * 0.01;
      if (!best || cost < best.cost) best = { cost, rB, rA };
    }
    psB.r = P.clampR(B, best.rB);
    psA.r = P.clampR(A, best.rA);
  };
  P.moveBody = (pup, pose, rootId, want, pins, fixed) => {
    // Festgepinnte Teile: Gelenk-Position und Welt-Winkel vor der Bewegung merken (der Fuß bleibt, wie er steht)
    const m0 = P.solve(pup, pose, null, null, 0);
    const anchor = {};
    for (const pid of pins) { const e = P.part(pup, pid); if (e && m0[pid]) anchor[pid] = { p: ap(m0[pid], e.ax, e.ay), a: wAng(m0[pid]) }; }
    const ps = pose[rootId] || (pose[rootId] = { r: 0, x: 0, y: 0 });
    if (want.r != null) ps.r = P.clampR(P.part(pup, rootId), want.r);
    ps.x = want.x; ps.y = want.y;
    const mine = pins.filter((pid) => anchor[pid] && P.rootOf(pup, pid) && P.rootOf(pup, pid).id === rootId && pid !== rootId);
    if (!mine.length) return pose;
    const lock = new Set([rootId]);
    for (let it = 0; it < 12; it++) {
      for (const pid of mine) {
        const E = P.part(pup, pid), A = E.parent && P.part(pup, E.parent), B = A && A.parent && P.part(pup, A.parent);
        if (A && B && B.id !== rootId && A.id !== rootId) {
          twoBone(pup, pose, B, A, E, anchor[pid].p);
          // Der festgepinnte Teil behält seinen Winkel (Fuß bleibt flach am Boden)
          const m = P.solve(pup, pose, null, null, 0);
          const pe = pose[pid] || (pose[pid] = { r: 0, x: 0, y: 0 });
          pe.r = P.clampR(E, (pe.r || 0) + norm(anchor[pid].a - wAng(m[pid])));
        } else if (fixed && fixed[pid]) P.ik(pup, pose, pid, P.tip(E, pup), fixed[pid], { links: 6, lock, iter: 6 });
      }
      // Was nicht erreicht wird, zieht den Körper zurück zu den Pins (gestreckte Glieder = so weit es geht)
      const m = P.solve(pup, pose, null, null, 0);
      let sx = 0, sy = 0, n = 0;
      for (const pid of mine) {
        const E = P.part(pup, pid), t = ap(m[pid], E.ax, E.ay);
        const dx = anchor[pid].p[0] - t[0], dy = anchor[pid].p[1] - t[1];
        if (Math.hypot(dx, dy) > 0.6) { sx += dx; sy += dy; n++; }
      }
      if (!n) break;
      ps.x += sx / mine.length * 0.9; ps.y += sy / mine.length * 0.9;
    }
    return pose;
  };

  // ---------- Darstellung auf der Bühne (Timeline, Spiel) ----------
  // Platz um die Figur, damit ausgestreckte Arme, erhobene Hände und Sprünge nicht abgeschnitten werden
  const PADT = 0.4, PADB = 0.1;
  const live = new Set();
  let rafOn = false;
  const loop = (now) => {
    for (const it of [...live]) {
      if (!it.cv.isConnected) { if (it.seen) live.delete(it); continue; }
      it.seen = true;
      const gap = window.Perf ? Perf.minInterval('bones') * 1000 : 0;
      if (gap && now - it.last < gap) continue;
      const dt = Math.min(1 / 20, (now - it.last) / 1000);
      it.last = now;
      drawEl(it, now / 1000 - it.t0, dt);
    }
    if (live.size) requestAnimationFrame(loop); else rafOn = false;
  };
  const drawEl = (it, t, dt) => {
    const { cv, pup, bb } = it;
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!it.res) return;
    const k = it.k;
    // unten mittig: Füße auf dem Boden der Figur
    const base = mul(T(cv.width / 2, cv.height - PADB * bb.h * k), mul(S(k, k), T(-(bb.x + bb.w / 2), -(bb.y + bb.h))));
    let pose = {};
    const clip = it.clip || {};
    const idle = clip.idleAnim && window.Anim ? Anim.get(clip.idleAnim) : null;
    const ac = idle && idle.actors && idle.actors.find((x) => x.puppet === pup.id);
    if (ac) { const d = Math.max(0.1, idle.dur || 2); pose = P.poseAt(ac, ((t % d) + d) % d); }
    const g = it.holder && it.holder._gesture;
    if (g && g.anim) {
      const ga = (g.anim.actors || []).find((x) => x.puppet === pup.id);
      const lt = now() - g.t0, d = g.anim.dur || 1;
      if (!ga || lt > d + 0.3) it.holder._gesture = null;
      else pose = P.addPose(pose, P.poseAt(ga, Math.min(lt, d)), Math.max(0, Math.min(1, lt / 0.2, (d + 0.3 - lt) / 0.3)));
    }
    P.draw(ctx, pup, it.res, base, it.static ? 0 : t, it.static ? 0 : dt, pose, it.st);
  };
  const now = () => performance.now() / 1000;
  // Canvas für einen Figuren-Clip (holder = Element der Figur, für Gesten)
  P.canvasFor = (pupId, clip, holder, opts = {}) => {
    const pup = P.get(pupId);
    const cv = document.createElement('canvas');
    cv.className = 'pup-canvas';
    cv.style.height = (100 * (1 + PADT + PADB)) + '%';
    cv.style.bottom = (-100 * PADB) + '%';
    cv.style.transform = 'translateX(-50%)' + (clip && clip.flip ? ' scaleX(-1)' : '');
    if (!pup || !pup.parts.length) { cv.width = 10; cv.height = 10; return cv; }
    const bb = P.bounds(pup);
    const k = Math.min(2, 1400 / (bb.h * (1 + PADT + PADB)));
    cv.height = Math.max(2, Math.round(bb.h * (1 + PADT + PADB) * k));
    cv.width = Math.max(2, Math.round((bb.w + bb.h * 1.2) * k));
    const it = { cv, pup, bb, k, clip, holder, st: {}, t0: now(), last: performance.now(), static: !!opts.static };
    cv._pup = it;
    P.load(pup).then((res) => { it.res = res; drawEl(it, 0, 0); if (it.static) return; live.add(it); if (!rafOn) { rafOn = true; requestAnimationFrame(loop); } });
    return cv;
  };
  // Anteil der Canvas-Breite, den die Figur in Ruhe einnimmt (für Rahmen und Klickflächen)
  P.widthShare = (pupId) => { const pup = P.get(pupId); if (!pup) return 1; const bb = P.bounds(pup); return bb.w / (bb.w + bb.h * 1.2); };
})();
