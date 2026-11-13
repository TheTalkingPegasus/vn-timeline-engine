// Weich-Physik (0.9.28): Bereiche eines Figuren-Bilds (Ellipsen-Masken) schwingen, wippen und atmen nach.
// Das PNG wird nicht zerschnitten: Ein feines Gitter liegt über dem ganzen Bild, nur die Punkte in der Maske
// bewegen sich (mit weichem Rand). „Als eigene Ebene“ legt den Bereich zusätzlich als Kopie oben drauf,
// damit er über den Rand hinaus über den Körper schwingen kann.
(function () {
  const { el } = VN;

  // Physik-Vorlagen. k = Federhärte, c = Dämpfung, inert = wie stark die Bewegung der Figur wirkt,
  // xs = seitliche Beweglichkeit, anchor = an welcher Seite der Bereich festgewachsen ist
  const PRESETS = {
    chest: { label: 'Brust', k: 95, c: 5.5, inert: 1, xs: 0.45, ys: 1, anchor: 'top', anchorAmt: 0.55, idle: 'breathe', idleAmp: 0.5, idleSpeed: 1.5, squash: 0.7, feather: 0.4, strength: 1, over: 0 },
    butt: { label: 'Po', k: 110, c: 6, inert: 1, xs: 0.5, ys: 1, anchor: 'top', anchorAmt: 0.5, idle: '', idleAmp: 0, idleSpeed: 1, squash: 0.6, feather: 0.4, strength: 0.9, over: 0 },
    belly: { label: 'Bauch / Atmen', k: 150, c: 10, inert: 0.6, xs: 0.3, ys: 0.6, anchor: '', anchorAmt: 0, idle: 'breathe', idleAmp: 1, idleSpeed: 1.4, squash: 0.3, feather: 0.5, strength: 0.7, over: 0 },
    hair: { label: 'Haare', k: 28, c: 3.2, inert: 1.2, xs: 1, ys: 0.4, anchor: 'top', anchorAmt: 1, idle: 'sway', idleAmp: 0.7, idleSpeed: 0.8, squash: 0, feather: 0.35, strength: 1, over: 0 },
    cloth: { label: 'Stoff / Rock', k: 38, c: 3.6, inert: 1, xs: 1, ys: 0.5, anchor: 'top', anchorAmt: 1, idle: 'wave', idleAmp: 0.5, idleSpeed: 1.1, squash: 0, feather: 0.35, strength: 1, over: 0 },
    ears: { label: 'Ohren / Schwanz', k: 45, c: 3, inert: 1.1, xs: 1, ys: 0.6, anchor: 'bottom', anchorAmt: 1, idle: 'sway', idleAmp: 0.5, idleSpeed: 1.2, squash: 0, feather: 0.3, strength: 1, over: 0 },
    tail: { label: 'Schwanz / Zopf (Pendeln)', k: 30, c: 2.6, inert: 1.2, xs: 1, ys: 1, anchor: 'pin', anchorAmt: 0.7, pendulum: true, idle: 'sway', idleAmp: 0.6, idleSpeed: 0.9, squash: 0, feather: 0.25, strength: 1, over: 0 },
    cheeks: { label: 'Wangen', k: 220, c: 9, inert: 0.7, xs: 0.4, ys: 1, anchor: '', anchorAmt: 0, idle: '', idleAmp: 0, idleSpeed: 1, squash: 0.4, feather: 0.5, strength: 0.6, over: 0 },
    // 0.9.38: aufgeblähte Backen (wackeln leicht) und Kehle beim Schlucken
    puff: { label: 'Dicke Backen (aufgebläht)', k: 160, c: 4, inert: 0.8, xs: 0.6, ys: 0.8, anchor: '', anchorAmt: 0, idle: 'wobble', idleAmp: 0.6, idleSpeed: 1.4, squash: 0.3, feather: 0.55, strength: 0.8, over: 0.3, puff: 1 },
    throat: { label: 'Kehle (Schlucken)', k: 200, c: 9, inert: 0.4, xs: 0.3, ys: 0.5, anchor: '', anchorAmt: 0, idle: 'swallow', idleAmp: 1, idleSpeed: 1, squash: 0, feather: 0.5, strength: 0.5, over: 0.15 },
    jelly: { label: 'Gelee / Schleim', k: 60, c: 2, inert: 1.2, xs: 1, ys: 1, anchor: 'bottom', anchorAmt: 0.6, idle: 'breathe', idleAmp: 0.6, idleSpeed: 2, squash: 1, feather: 0.45, strength: 1.2, over: 0 }
  };
  const ANCHORS = [['', 'Frei schwebend'], ['top', 'Oben fest'], ['bottom', 'Unten fest'], ['left', 'Links fest'], ['right', 'Rechts fest'], ['pin', '📍 Ankerpunkt (frei gesetzt)']];
  const IDLES = [['', 'Keine'], ['breathe', 'Atmen (auf & ab)'], ['sway', 'Schwanken (seitlich)'], ['wave', 'Welle (wehen)'], ['wobble', 'Wackeln (leicht)'], ['swallow', 'Schlucken (ab und zu)']];
  const GULP = 0.85; // Dauer eines Schluckens in Sekunden
  const PAD = 0.08; // Rand um das Bild, damit Bereiche über die Bildkante schwingen dürfen
  const GRID = 46;  // Gitterpunkte über die Bildbreite
  const ACC = 0.25; // wie stark Beschleunigung der Figur auf die Bereiche wirkt

  // alle Schlüssel, die eine Vorlage setzen kann (zum Zurücksetzen)
  // Zusätze für jede Vorlage: angespanntes Zucken und Puls (Herzschlag), Standard aus
  const EXTRA = { twitch: 0, pulse: 0, bpm: 72, puff: 0 };
  const PKEYS = [...new Set(Object.values(PRESETS).flatMap((x) => Object.keys(x)).concat(Object.keys(EXTRA)))].filter((k) => k !== 'label');
  // Biegung der Anhänger: Anzahl der Abschnitte
  const BEND_N = 10;
  // Dreieck aus dem Bild (s0..s2, Bildpixel) auf das Ziel-Dreieck (d0..d2) abbilden
  function tri(ctx, img, s0, s1, s2, d0, d1, d2) {
    const den = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
    if (Math.abs(den) < 1e-9) return;
    const m11 = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / den;
    const m12 = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / den;
    const m21 = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / den;
    const m22 = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / den;
    const tx = d0[0] - m11 * s0[0] - m12 * s0[1], ty = d0[1] - m21 * s0[0] - m22 * s0[1];
    // etwas größer ausschneiden, damit zwischen den Dreiecken keine feinen Linien bleiben
    const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
    const g = (p) => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * 0.8, p[1] + dy / l * 0.8]; };
    const e0 = g(d0), e1 = g(d1), e2 = g(d2);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.lineTo(e2[0], e2[1]); ctx.closePath(); ctx.clip();
    ctx.transform(m11, m21, m12, m22, tx, ty);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  const Soft = (window.Soft = {
    PRESETS, ANCHORS, IDLES, PAD, PKEYS,

    data(assetId) { const s = VN.project && VN.project.softs && VN.project.softs[assetId]; return s || null; },
    cfg(assetId) {
      const s = Soft.data(assetId);
      if (!s || s.on === false || !((s.regions && s.regions.some((r) => r.on !== false)) || Soft.hangsOf(s).length)) return null;
      if (!s.regions) s.regions = [];
      return s;
    },
    // Werte eines Bereichs: Vorlage + eigene Anpassungen
    par(r) { return Object.assign({}, EXTRA, PRESETS[r.preset] || PRESETS.chest, r); },
    // Herzschlag-Kurve 0…1: kräftiger erster Schlag, schwächerer zweiter („bu-bumm“)
    heart(t, bpm) {
      const p = ((t * (Number(bpm) || 72) / 60) % 1 + 1) % 1;
      const g = (c, w) => Math.exp(-((p - c) / w) * ((p - c) / w));
      return Math.min(1, g(0.06, 0.04) + 0.55 * g(0.24, 0.05));
    },
    newRegion(preset, cx, cy, rx, ry) {
      return { id: VN.uid ? VN.uid('sr') : 'sr' + Math.random().toString(36).slice(2, 8), name: VN.t(PRESETS[preset] ? PRESETS[preset].label : 'Bereich'), preset, cx, cy, rx, ry, rot: 0, on: true };
    },

    // ---------- Physik ----------
    newSim() { return { regs: {}, t0: performance.now() / 1000, last: null, vel: null, poke: [] }; },
    // Bewegung der Figur einspeisen: Mittelpunkt in Figurenhöhen, dt in Sekunden
    feed(sim, x, y, dt) {
      if (!(dt > 0) || dt > 0.25 || !sim.last) { sim.last = { x, y }; sim.vel = { x: 0, y: 0 }; return { x: 0, y: 0 }; }
      const vx = (x - sim.last.x) / dt, vy = (y - sim.last.y) / dt;
      let ax = (vx - sim.vel.x) / dt, ay = (vy - sim.vel.y) / dt;
      sim.last = { x, y }; sim.vel = { x: vx, y: vy };
      const cap = 60; ax = Math.max(-cap, Math.min(cap, ax)); ay = Math.max(-cap, Math.min(cap, ay));
      return { x: ax, y: ay };
    },
    step(sim, regions, acc, dt) {
      // bis 0,1 s je Bild in Echtzeit (Unterschritte halten die Federn stabil) – sonst wirkt es bei wenig FPS wie Zeitlupe
      dt = Math.min(0.1, Math.max(0, dt || 0));
      const kick = sim.poke.splice(0);
      // für die Anhänger merken (0.9.38): Beschleunigung der Figur und Stöße
      sim._acc = { x: (acc && acc.x) || 0, y: (acc && acc.y) || 0 };
      if (kick.length) (sim._hk || (sim._hk = [])).push(...kick);
      for (const r of regions) {
        const P = Soft.par(r);
        // Bones (0.9.35): jeder Bereich bekommt die Beschleunigung an seiner eigenen Stelle
        const A = (acc && acc.byId && acc.byId[r.id]) || acc;
        const s = sim.regs[r.id] || (sim.regs[r.id] = { x: 0, y: 0, vx: 0, vy: 0 });
        s.time = (s.time || 0) + dt;
        if (sim.gulpReq && P.idle === 'swallow') s.gulp = s.time;
        for (const k of kick) { s.vx += k.x * (P.xs || 1); s.vy += k.y * (P.ys || 1); }
        // angespanntes Zucken: kurze Stöße in zufälligen Abständen (stärker = häufiger und kräftiger)
        const tw = Math.max(0, Number(P.twitch) || 0);
        if (tw > 0) {
          s.clock = (s.clock || 0) + dt;
          if (s.nextTw == null) s.nextTw = s.clock + 0.3 + Math.random() * 1.2;
          if (s.clock >= s.nextTw) {
            const a = Math.random() * Math.PI * 2, f = 0.16 * tw * (0.6 + Math.random() * 0.8);
            s.vx += Math.cos(a) * f * (P.xs != null ? P.xs : 1) * 0.6; s.vy += Math.sin(a) * f * (P.ys != null ? P.ys : 1);
            // manchmal kommt ein zweites Zucken direkt hinterher
            s.nextTw = s.clock + (Math.random() < 0.25 ? 0.08 + Math.random() * 0.1 : (0.5 + Math.random() * 2.2) / Math.max(0.4, Math.min(2, tw)));
          }
        }
        const k = Math.max(1, Number(P.k) || 90), c = Math.max(0, Number(P.c) || 5), inert = Number(P.inert) || 1;
        // kleine Unterschritte für stabile Federn
        const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
        for (let i = 0; i < n; i++) {
          const fx = -k * s.x - c * s.vx - A.x * inert * (P.xs != null ? P.xs : 1) * ACC;
          const fy = -k * s.y - c * s.vy - A.y * inert * (P.ys != null ? P.ys : 1) * ACC;
          s.vx += fx * h; s.vy += fy * h; s.x += s.vx * h; s.y += s.vy * h;
        }
        const lim = 0.6; s.x = Math.max(-lim, Math.min(lim, s.x)); s.y = Math.max(-lim, Math.min(lim, s.y));
      }
      sim.gulpReq = 0;
    },
    poke(sim, dir, amount) {
      // Schlucken auslösen (0.9.38): läuft in Bereichen mit „Schlucken“ sofort einmal ab
      if (dir === 'gulp') { sim.gulpReq = (sim.gulpReq || 0) + 1; return; }
      const a = (Number(amount) || 1) * 0.22;
      const d = dir === 'up' ? [0, -1] : dir === 'left' ? [-1, 0] : dir === 'right' ? [1, 0] : dir === 'random' ? [Math.random() * 2 - 1, Math.random() * 2 - 1] : [0, 1];
      sim.poke.push({ x: d[0] * a, y: d[1] * a });
    },

    // Verschiebung (in Bildbruchteilen) eines Bereichs zum Zeitpunkt t
    regionMove(r, P, s, t) {
      const st = (Number(P.strength) != null ? Number(P.strength) : 1);
      let dx = (s ? s.x : 0) * st, dy = (s ? s.y : 0) * st;
      const amp = (Number(P.idleAmp) || 0) * 0.012, sp = (Number(P.idleSpeed) || 1) * Math.PI * 2 / 3;
      const b = r.shape === 'poly' ? Soft.box(r, 1) : r, ph = (b.cx || 0) * 7 + (b.cy || 0) * 3;
      let idleY = 0, idleX = 0, wave = 0;
      if (P.idle === 'breathe') idleY = Math.sin(t * sp + ph * 0.2) * amp;
      else if (P.idle === 'sway') idleX = Math.sin(t * sp + ph) * amp * 1.4;
      else if (P.idle === 'wave') { idleX = Math.sin(t * sp + ph) * amp; wave = amp; }
      else if (P.idle === 'wobble') { idleX = (Math.sin(t * sp * 2.3 + ph) * 0.6 + Math.sin(t * sp * 3.7 + ph * 2) * 0.4) * amp * 0.45; idleY = (Math.sin(t * sp * 2.9 + ph * 3) * 0.6 + Math.sin(t * sp * 4.3 + ph) * 0.4) * amp * 0.45; }
      // Schlucken: alle paar Sekunden (oder auf Anstoß) wandert eine Wölbung von oben nach unten
      let gulp = null;
      if (P.idle === 'swallow') {
        let q = -1;
        if (s && s.gulp != null && s.time - s.gulp < GULP) q = (s.time - s.gulp) / GULP;
        else if (Number(P.idleAmp) > 0) {
          const T = 5 / Math.max(0.1, Number(P.idleSpeed) || 1), k = Math.floor((t + ph) / T);
          const jit = (Math.sin(k * 12.9898 + ph * 4.1) * 43758.5453) % 1;
          const st0 = k * T + Math.abs(jit) * T * 0.5 - ph;
          if (t >= st0 && t < st0 + GULP) q = (t - st0) / GULP;
        }
        if (q >= 0) {
          const e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
          gulp = { pos: -1.1 + 2.4 * e, amp: Math.sin(q * Math.PI) * Math.max(0.3, Number(P.idleAmp) || 1), lift: Math.sin(Math.min(1, q * 2) * Math.PI) };
        }
      }
      // Stauchen: nach unten gezogen → länger und schmaler, nach oben → kürzer und breiter
      const sq = Math.max(-0.35, Math.min(0.35, (dy + idleY * 0.6) * (Number(P.squash) || 0) * 4));
      // Zittern bei Anspannung (fein, schnell) und Puls (der Bereich schwillt im Herzschlag kurz an)
      const tw = Math.max(0, Number(P.twitch) || 0);
      if (tw) { idleX += (Math.sin(t * 47 + ph) + Math.sin(t * 31 + ph * 2)) * 0.0006 * tw; idleY += Math.sin(t * 39 + ph * 3) * 0.0006 * tw; }
      let sw = (Number(P.pulse) || 0) ? Soft.heart(t + ph * 0.05, P.bpm) * Number(P.pulse) * 0.05 : 0;
      // Aufblähen (0.9.38): Bereich dauerhaft gewölbt, beim Wackeln atmet die Wölbung leicht mit
      const pf = Number(P.puff) || 0;
      if (pf) sw += pf * 0.22 * (1 + (P.idle === 'wobble' ? Math.sin(t * sp * 1.9 + ph) * 0.12 * (Number(P.idleAmp) || 0) : 0));
      return { dx: dx + idleX, dy: dy + idleY, sq, wave, t, sp, sw, gulp };
    },

    // Freie Form (0.9.28): Umriss aus Punkten (Lasso / Zeichenstift), auf Wunsch rund (Catmull-Rom)
    outline(r) {
      const pts = r.pts || [];
      if (pts.length < 3 || r.smooth === false) return pts.map((q) => [q[0], q[1]]);
      const out = [], n = pts.length, S = 6;
      for (let i = 0; i < n; i++) {
        const p1 = pts[i], p2 = pts[(i + 1) % n];
        // Ecken (dritter Wert = 1) bleiben spitz: Tangente dort flach
        const p0 = p1[2] ? p1 : pts[(i - 1 + n) % n], p3 = p2[2] ? p2 : pts[(i + 2) % n];
        for (let k = 0; k < S; k++) {
          const t = k / S, t2 = t * t, t3 = t2 * t;
          const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
          out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
        }
      }
      return out;
    },
    // Maße einer freien Form (zwischengespeichert): Rahmen, Schwerpunkt, Umriss in Pixel-Verhältnis, Tiefe innen
    geo(r, aspect) {
      const c = GEO.get(r);
      // während eines Bilds ändert sich die Form nicht: ohne erneuten Vergleich zurückgeben
      if (FAST && c && c.f === FAST && c.aspect === aspect) return c;
      const key = aspect.toFixed(4) + (r.smooth === false ? 'h' : 's') + JSON.stringify(r.pts);
      if (c && c.key === key) { c.f = FAST; c.aspect = aspect; return c; }
      const o = Soft.outline(r), poly = o.map((q) => [q[0] * aspect, q[1]]);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, sx = 0, sy = 0;
      for (const q of o) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); sx += q[0]; sy += q[1]; }
      const g = { key, poly, x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: Math.max(1e-4, (x1 - x0) / 2), ry: Math.max(1e-4, (y1 - y0) / 2), mx: sx / o.length, my: sy / o.length, depth: 1e-3 };
      // tiefster Punkt innen = Maßstab für den weichen Rand
      for (let j = 1; j < 16; j++) for (let i = 1; i < 16; i++) {
        const X = (x0 + (x1 - x0) * i / 16) * aspect, Y = y0 + (y1 - y0) * j / 16;
        const sd = sdPoly(poly, X, Y); if (sd < 0) g.depth = Math.max(g.depth, -sd);
      }
      g.f = FAST; g.aspect = aspect;
      GEO.set(r, g);
      return g;
    },
    // Lage eines Punkts (u, v in Bildbruchteilen) zum Bereich: [lx, ly, d]
    // lx/ly = -1…1 über die Breite/Höhe (für Anker, Stauchen, Welle), d = 0 innen tief … 1 am Rand … >1 außen
    // aspect = Breite/Höhe des Bilds, damit Formen rund rechnen
    local(r, u, v, aspect) {
      if (r.shape === 'poly' && r.pts && r.pts.length >= 3) {
        const g = Soft.geo(r, aspect);
        const lx = (u - g.cx) / g.rx, ly = (v - g.cy) / g.ry;
        // schneller Ausschluss weit außerhalb
        const far = 1 + 0.9 + Math.max(0, Number(r.over) || 0) * 2;
        if (Math.abs(lx) > far * 1.6 || Math.abs(ly) > far * 1.6) return [lx, ly, 99];
        const sd = sdPoly(g.poly, u * aspect, v);
        return [lx, ly, 1 + sd / g.depth];
      }
      const a = (r.rot || 0) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
      const x = (u - r.cx) * aspect, y = v - r.cy;
      const lx = (x * cs + y * sn) / Math.max(1e-4, r.rx * aspect), ly = (-x * sn + y * cs) / Math.max(1e-4, r.ry);
      return [lx, ly, Math.hypot(lx, ly)];
    },
    // Rahmen eines Bereichs in Bildbruchteilen (für Stauchen, Ebene, Ruhe-Phase)
    box(r, aspect) {
      if (r.shape === 'poly' && r.pts && r.pts.length >= 3) { const g = Soft.geo(r, aspect || 1); return { cx: g.cx, cy: g.cy, rx: g.rx, ry: g.ry }; }
      return { cx: r.cx, cy: r.cy, rx: r.rx, ry: r.ry };
    },
    // Ellipse → freie Form (zum Nachbearbeiten)
    toPoly(r, aspect, n) {
      n = n || 14; aspect = aspect || 1;
      const a = (r.rot || 0) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), out = [];
      const q = (v) => Math.round(v * 10000) / 10000;
      for (let i = 0; i < n; i++) {
        const t = i / n * Math.PI * 2, X = Math.cos(t) * r.rx * aspect, Y = Math.sin(t) * r.ry;
        out.push([q(r.cx + (X * cs - Y * sn) / aspect), q(r.cy + X * sn + Y * cs)]);
      }
      return out;
    },
    // Ankerpunkt (0.9.28): frei gesetzter Pin. Ohne gesetzten Pin: Mitte oben am Rahmen
    pinOf(r, aspect) {
      if (r.pin && r.pin.length >= 2) return r.pin;
      const b = Soft.box(r, aspect || 1);
      return [b.cx, b.cy - b.ry];
    },
    // Abstand vom Pin, 0 am Pin … 1 am weitesten Punkt der Maske
    pinQ(r, u, v, aspect) {
      const pin = Soft.pinOf(r, aspect);
      let c = REACH.get(r);
      if (!(FAST && c && c.f === FAST && c.aspect === aspect)) {
      const key = aspect.toFixed(4) + JSON.stringify([pin, r.shape, r.pts, r.cx, r.cy, r.rx, r.ry, r.rot, r.smooth]);
      if (!c || c.key !== key) {
        const o = r.shape === 'poly' && r.pts && r.pts.length >= 3 ? Soft.outline(r) : Soft.toPoly(r, aspect, 24);
        let m = 1e-3; for (const q of o) m = Math.max(m, Math.hypot((q[0] - pin[0]) * aspect, q[1] - pin[1]));
        c = { key, reach: m }; REACH.set(r, c);
      }
      c.f = FAST; c.aspect = aspect;
      }
      return Math.min(1, Math.hypot((u - pin[0]) * aspect, v - pin[1]) / c.reach);
    },
    // E = { r, u, v, aspect } für den Ankerpunkt (optional)
    anchorW(P, lx, ly, E) {
      const amt = Math.max(0, Math.min(1, Number(P.anchorAmt) || 0));
      if (!P.anchor || !amt) return 1;
      let g;
      if (P.anchor === 'pin') { if (!E) return 1; g = Soft.pinQ(E.r, E.u, E.v, E.aspect); }
      else g = P.anchor === 'top' ? (ly + 1) / 2 : P.anchor === 'bottom' ? (1 - ly) / 2 : P.anchor === 'left' ? (lx + 1) / 2 : (1 - lx) / 2;
      const q = Math.max(0, Math.min(1, g));
      return 1 - amt + amt * q * q * (3 - 2 * q);
    },
    weight(P, lx, ly, d, E) {
      if (d == null) d = Math.hypot(lx, ly);
      const f = Math.max(0.02, Math.min(0.95, Number(P.feather) != null ? Number(P.feather) : 0.4));
      const over = Math.max(0, Number(P.over) || 0);
      const inner = 1 - f, outer = 1 + over;
      if (d >= outer) return 0;
      let w = d <= inner ? 1 : 1 - smooth((d - inner) / (outer - inner));
      // Pendeln: die Drehung um den Pin übernimmt die Abstufung
      return P.pendulum ? w : w * Soft.anchorW(P, lx, ly, E);
    },
    // Verschiebung eines Punkts durch einen Bereich (mit Stauchen und Welle, oder Pendeln um den Pin)
    disp(r, P, m, lx, ly, w, aspect, E) {
      if (P.pendulum && E) {
        // echte Drehung um den Ankerpunkt; zur Spitze hin biegt es stärker (Anker-Stärke = Biegung)
        const pin = Soft.pinOf(r, aspect), b = Soft.box(r, aspect);
        let ax = (b.cx - pin[0]) * aspect, ay = b.cy - pin[1];
        const al = Math.hypot(ax, ay) || 1e-4; ax /= al; ay /= al;
        // Ausschlag quer zur Richtung Pin → Bereich ergibt den Winkel
        const side = (m.dx * aspect) * -ay + m.dy * ax;
        const q = Soft.pinQ(r, E.u, E.v, aspect), amt = Math.max(0, Math.min(1, Number(P.anchorAmt) || 0));
        const th = Math.max(-1.2, Math.min(1.2, side * 3.5 / Math.max(0.05, al))) * (1 - amt + amt * q);
        const px = (E.u - pin[0]) * aspect, py = E.v - pin[1], c = Math.cos(th), sn = Math.sin(th);
        return [((px * c - py * sn) - px) / aspect * w, ((px * sn + py * c) - py) * w];
      }
      const aw = Soft.anchorW(P, lx, ly, E);
      let dx = m.dx * w, dy = m.dy * w;
      if (m.sq) { const b = Soft.box(r, aspect); dy += ly * b.ry * m.sq * w; dx -= lx * b.rx * m.sq * 0.5 * w; }
      if (m.sw) { const b = Soft.box(r, aspect); dx += lx * b.rx * m.sw * w; dy += ly * b.ry * m.sw * w; }
      if (m.wave) dx += Math.sin(m.t * m.sp * 1.3 - ly * 2.4) * m.wave * 0.8 * w * aw;
      if (m.gulp) {
        // Wölbung an der Stelle, an der der Bissen gerade ist; die Kehle hebt sich am Anfang kurz
        const b = Soft.box(r, aspect), g = Math.exp(-Math.pow((ly - m.gulp.pos) / 0.38, 2)) * m.gulp.amp;
        dx += lx * b.rx * g * 0.35 * w;
        dy += (-m.gulp.lift * 0.12 + g * 0.08) * b.ry * w;
      }
      return [dx, dy];
    },

    // ---------- Zeichnen (gemeinsamer WebGL-Kontext) ----------
    _texFor(img) {
      const S = gl0(); if (!S) return null;
      let e = TEX.get(img);
      // Gesicht-Rig (0.9.31): Quelle ist ein Canvas, das sich ändert – dann neu hochladen
      if (e && e.gen === S.gen && e.tex && img._ver != null && e.ver !== img._ver) {
        S.gl.bindTexture(S.gl.TEXTURE_2D, e.tex);
        try { S.gl.texImage2D(S.gl.TEXTURE_2D, 0, S.gl.RGBA, S.gl.RGBA, S.gl.UNSIGNED_BYTE, img); } catch (er) { /* bleibt beim alten Bild */ }
        e.ver = img._ver;
        return e.tex;
      }
      if (e && e.gen === S.gen) return e.tex;
      const gl = S.gl, tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch (e) { gl.deleteTexture(tex); TEX.set(img, { gen: S.gen, tex: null }); return null; }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      TEX.set(img, { gen: S.gen, tex, ver: img._ver });
      return tex;
    },
    // Bild mit Physik in ein 2D-Canvas (W×H inkl. Rand PAD) zeichnen. Gibt false zurück, wenn WebGL fehlt.
    render(out, img, cfg, sim, t) {
      const S = gl0();
      const NW = img.naturalWidth || img.width, NH = img.naturalHeight || img.height;
      if (!S || !NW) return false;
      const W = out.width, H = out.height;
      if (S.cv.width < W) S.cv.width = Math.min(4096, Math.max(W, S.cv.width * 1.5 | 0));
      if (S.cv.height < H) S.cv.height = Math.min(4096, Math.max(H, S.cv.height * 1.5 | 0));
      const gl = S.gl, tex = Soft._texFor(img);
      if (!tex) return false;
      gl.viewport(0, S.cv.height - H, W, H);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(S.prog);
      gl.uniform2f(S.resLoc, W, H);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const iw = W / (1 + 2 * PAD), ih = H / (1 + 2 * PAD), ox = W * PAD / (1 + 2 * PAD), oy = H * PAD / (1 + 2 * PAD);
      const aspect = NW / NH;
      const regs = cfg.regions.filter((r) => r.on !== false);
      let ops = null;
      FAST = ++FRAME;
      try {
      const moves = regs.map((r) => { const P = Soft.par(r); return { r, P, m: Soft.regionMove(r, P, sim.regs[r.id], t) }; });
      // 1) Grundbild: Gitter über das ganze Bild, nur Punkte in Masken bewegen sich
      const gw = GRID, gh = Math.max(8, Math.round(GRID / aspect));
      const mesh = baseMesh(gw, gh);
      const pos = mesh.pos;
      // Gewichte hängen nur von Form und Einstellungen ab: einmal rechnen, dann je Bild nur verschieben
      const W8 = weights(cfg, moves, gw, gh, aspect);
      for (let j = 0, k = 0; j <= gh; j++) for (let i = 0; i <= gw; i++, k++) { pos[k * 2] = ox + (i / gw) * iw; pos[k * 2 + 1] = oy + (j / gh) * ih; }
      for (let mi = 0; mi < moves.length; mi++) {
        const { r, P, m } = moves[mi], L = W8[mi];
        for (let q = 0; q < L.n; q++) {
          const k = L.k[q], u = (k % (gw + 1)) / gw, v = Math.floor(k / (gw + 1)) / gh;
          const d = Soft.disp(r, P, m, L.lx[q], L.ly[q], L.w[q], aspect, { r, u, v, aspect });
          pos[k * 2] += d[0] * iw; pos[k * 2 + 1] += d[1] * ih;
        }
      }
      drawMesh(S, mesh, 1);
      // 2) Bereiche als eigene Ebene: Kopie des Bereichs, weich ausgeblendet, oben drauf
      for (const { r, P, m } of moves) {
        if (!P.layer) continue;
        const lm = layerMesh(r, P, m, aspect, iw, ih, ox, oy);
        drawMesh(S, lm, 0);
      }
      // 3) Anhänger (0.9.38): Pins sitzen auf dem verformten Bild und wippen mit
      if (Soft.hangsOf(cfg).length) {
        const dispAt = (u, v) => {
          let dx = 0, dy = 0;
          for (const { r, P, m } of moves) {
            const L = Soft.local(r, u, v, aspect), E = { r, u, v, aspect };
            const w = Soft.weight(P.layer ? Object.assign({}, P, { over: 0 }) : P, L[0], L[1], L[2], E);
            if (w <= 0) continue;
            const d = Soft.disp(r, P, m, L[0], L[1], w, aspect, E);
            dx += d[0]; dy += d[1];
          }
          return [ox + (u + dx) * iw, oy + (v + dy) * ih];
        };
        ops = Soft.hangFrame(cfg, sim, t, dispAt, iw, ih, sim._acc || { x: 0, y: 0 });
      }
      } finally { FAST = 0; }
      const ctx = out.getContext('2d');
      ctx.clearRect(0, 0, W, H);
      if (ops) Soft.paintHangs(ctx, ops, true);
      ctx.drawImage(S.cv, 0, 0, W, H, 0, 0, W, H);
      if (ops) Soft.paintHangs(ctx, ops, false);
      return true;
    },

    // ---------- Anhänger (0.9.38): eigene PNGs an Pins, mit Pendel-Physik und Effekten ----------
    HANG_FX: [['', 'Keiner'], ['wobble', 'Wackeln'], ['shake', 'Zittern'], ['pulse', 'Pulsieren'], ['float', 'Schweben'], ['spin', 'Drehen'], ['blink', 'Blinken']],
    hangsOf(cfg) { return ((cfg && cfg.hangs) || []).filter((a) => a && a.on !== false && a.asset && a.pins && a.pins.length); },
    newHang(asset, pin) {
      return { id: VN.uid ? VN.uid('hg') : 'hg' + Math.random().toString(36).slice(2, 8), name: (VN.asset && VN.asset(asset) || {}).name || VN.t('Anhänger'), asset, on: true,
        pins: [pin || [0.5, 0.3]], anchor: [0.5, 0.06], anchor2: [0.5, 0.94], size: 0.14, rot: 0, behind: false, flip: false,
        swing: true, weight: 1, stiff: 0.15, damp: 0.3, fx: '', fxAmp: 1, fxSpeed: 1 };
    },
    _himg: new Map(),
    hangImg(asset) {
      let im = Soft._himg.get(asset);
      const url = VN.assetUrl(asset);
      if (!im || im._url !== url) { im = new Image(); im.crossOrigin = 'anonymous'; im._url = url; im.src = url; Soft._himg.set(asset, im); }
      return im.complete && im.naturalWidth ? im : null;
    },
    // Physik und Lage aller Anhänger für ein Bild. pinAt(u, v) → Pixel auf der Zeichenfläche,
    // iw/ih = Bildgröße in Pixeln (ih = eine Figurenhöhe), acc = Beschleunigung der ganzen Figur (Bildrichtung)
    hangFrame(cfg, sim, t, pinAt, iw, ih, acc) {
      const hs = Soft.hangsOf(cfg);
      const st0 = sim.hang || (sim.hang = {});
      const dt = sim._ht != null ? Math.min(0.1, Math.max(0, t - sim._ht)) : 0;
      sim._ht = t;
      const kicks = sim._hk ? sim._hk.splice(0) : [];
      const ops = [];
      for (const a of hs) {
        const img = Soft.hangImg(a.asset);
        if (!img) continue;
        const P1 = pinAt(a.pins[0][0], a.pins[0][1]);
        const P2 = a.pins[1] ? pinAt(a.pins[1][0], a.pins[1][1]) : null;
        const st = st0[a.id] || (st0[a.id] = { th: 0, om: 0, f: {} });
        const dw = (Number(a.size) || 0.14) * iw, dh = dw * img.naturalHeight / img.naturalWidth;
        // Pendel: hängt am Pin, schwingt bei Bewegung der Figur und der Stelle darunter (z. B. wippende Brust)
        if (!P2 && a.swing !== false && dt > 0) {
          const la = Soft.feed(st.f, P1[0] / ih, P1[1] / ih, dt);
          const inert = Number(a.weight != null ? a.weight : 1);
          const ax = ((acc.x || 0) + la.x) * inert, ay = ((acc.y || 0) + la.y) * inert;
          const anc = a.anchor || [0.5, 0];
          const L = Math.max(0.025, Math.hypot((0.5 - anc[0]) * dw, (0.5 - anc[1]) * dh) / ih);
          const k = Math.max(0, Number(a.stiff) || 0) * 60, c = 0.4 + Math.max(0, Number(a.damp != null ? a.damp : 0.3)) * 9;
          for (const kk of kicks) st.om += (kk.x * 6 - kk.y * 2 * Math.sin(st.th)) * inert;
          const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n, G = 6;
          for (let i = 0; i < n; i++) {
            const g = Math.max(0.5, G - ay);
            const al = -(g / L) * Math.sin(st.th) + (ax / L) * Math.cos(st.th) * 0.35 - k * st.th - c * st.om;
            st.om += al * h; st.th += st.om * h;
          }
          st.th = Math.max(-1.45, Math.min(1.45, st.th));
        } else if (P2 || a.swing === false) { st.th = 0; st.om = 0; }
        // Biegung (0.9.38): Kette aus Abschnitten, jeder folgt dem vorigen verzögert (Haarsträhne, Schweif)
        const bend = !P2 ? Math.max(0, Math.min(1, Number(a.bend) || 0)) : 0;
        if (bend > 0 && dt > 0) {
          const N = BEND_N;
          const ch = st.ch && st.ch.a.length === N ? st.ch : (st.ch = { a: new Array(N).fill(0), w: new Array(N).fill(0), om0: st.om });
          const ang = (Number(a.rot) || 0) * Math.PI / 180 + st.th;
          const rootAl = (st.om - (ch.om0 != null ? ch.om0 : st.om)) / dt; ch.om0 = st.om;
          const la = st.fb ? Soft.feed(st.fb, P1[0] / ih, P1[1] / ih, dt) : (st.fb = {}, Soft.feed(st.fb, P1[0] / ih, P1[1] / ih, dt));
          const inert = Number(a.weight != null ? a.weight : 1);
          const wx = ((acc.x || 0) + la.x) * inert, wy = ((acc.y || 0) + la.y) * inert;
          // in die Richtung des Anhängers drehen
          const cs = Math.cos(-ang), sn = Math.sin(-ang), lx = wx * cs - wy * sn, ly = wx * sn + wy * cs;
          const ax0 = Soft.hangAxis(a, dw, dh);
          const segPx = ax0 ? ax0.far / N : 0;
          const kb = 45 + Math.pow(1 - bend, 2) * 700, cb = 2 + (Number(a.damp != null ? a.damp : 0.3)) * 10;
          const n = Math.max(1, Math.ceil(dt / 0.006)), h = dt / n;
          for (let it = 0; it < n; it++) {
            for (let i = 0; i < N; i++) {
              const par = i ? ch.a[i - 1] : 0, parW = i ? ch.w[i - 1] : 0;
              const da = ax0 ? ax0.u : [0, 1];
              const d = [da[0] * Math.cos(ch.a[i]) - da[1] * Math.sin(ch.a[i]), da[0] * Math.sin(ch.a[i]) + da[1] * Math.cos(ch.a[i])];
              const Li = Math.max(0.01, (i + 0.5) * segPx / ih);
              const perp = -(d[0] * ly - d[1] * lx);
              // Schwerkraft zieht jeden Abschnitt zurück in die Ruhelage (so wie das Bild gezeichnet ist)
              const grav = -(4 / Li) * Math.sin(st.th + ch.a[i]) * 0.15;
              const al = -kb * (ch.a[i] - par) - cb * (ch.w[i] - parW) + perp / Li * 0.1 - rootAl * 0.3 + grav;
              ch.w[i] += al * h;
            }
            for (let i = 0; i < N; i++) {
              ch.a[i] += ch.w[i] * h;
              const par = i ? ch.a[i - 1] : 0;
              if (ch.a[i] - par > 0.35) ch.a[i] = par + 0.35; else if (ch.a[i] - par < -0.35) ch.a[i] = par - 0.35;
            }
          }
        } else if (!bend) st.ch = null;
        // Effekte
        const ph = [...String(a.id)].reduce((q, ch) => q + ch.charCodeAt(0), 0) * 0.37;
        const amp = Number(a.fxAmp != null ? a.fxAmp : 1), sp = Number(a.fxSpeed || 1);
        let fa = 0, fsc = 1, fx = 0, fy = 0, alpha = 1;
        if (a.fx === 'wobble') fa = Math.sin(t * Math.PI * 2 * 0.9 * sp + ph) * 0.2 * amp;
        else if (a.fx === 'shake') { const q = Math.floor(t * 24 * sp); const rnd = (z) => { const v = Math.sin(z * 12.9898 + ph * 78.233) * 43758.5453; return v - Math.floor(v) - 0.5; }; fx = rnd(q) * 0.012 * amp * ih; fy = rnd(q + 7.1) * 0.012 * amp * ih; fa = rnd(q + 3.3) * 0.08 * amp; }
        else if (a.fx === 'pulse') fsc = 1 + Math.sin(t * Math.PI * 2 * 1.1 * sp + ph) * 0.08 * amp;
        else if (a.fx === 'float') fy = Math.sin(t * Math.PI * 2 * 0.45 * sp + ph) * 0.012 * amp * ih;
        else if (a.fx === 'spin') fa = t * Math.PI * 2 * 0.3 * sp * (amp || 1);
        else if (a.fx === 'blink') alpha = 0.55 + 0.45 * Math.cos(t * Math.PI * 2 * 0.7 * sp + ph) * Math.min(1, amp);
        ops.push({ a, img, P1, P2, th: st.th, fa, fsc, fx, fy, alpha, dw, dh, chain: bend > 0 && st.ch ? st.ch.a.slice() : null });
      }
      return ops;
    },
    // Längsachse eines Anhängers: vom Haltepunkt zur gegenüberliegenden Kante (oben gehalten → nach unten)
    hangAxis(a, dw, dh) {
      const A = a.anchor || [0.5, 0.06];
      const dx = (0.5 - A[0]) * dw, dy = (0.5 - A[1]) * dh;
      if (Math.hypot(dx, dy) < Math.min(dw, dh) * 0.08) return null; // in der Mitte gehalten: nichts zu biegen
      const vert = Math.abs(dy) >= Math.abs(dx);
      const u = vert ? [0, Math.sign(dy)] : [Math.sign(dx), 0], v = [-u[1], u[0]];
      const ext = (d) => (d[0] > 0 ? (1 - A[0]) * dw : d[0] < 0 ? A[0] * dw : 0) + (d[1] > 0 ? (1 - A[1]) * dh : d[1] < 0 ? A[1] * dh : 0);
      return { u, v, far: ext(u), near: ext([-u[0], -u[1]]), vp: ext(v), vn: ext([-v[0], -v[1]]) };
    },
    // Bild entlang der Kette verformt zeichnen (Dreiecke mit eigener Abbildung). Koordinaten: Haltepunkt = 0,0
    drawBent(ctx, img, a, dw, dh, X, ch) {
      const A = a.anchor || [0.5, 0.06], nw = img.naturalWidth, nh = img.naturalHeight, k = nw / dw;
      const N = ch.length, seg = X.far / N;
      const rot = (p, t) => [p[0] * Math.cos(t) - p[1] * Math.sin(t), p[0] * Math.sin(t) + p[1] * Math.cos(t)];
      // Gelenke und Querrichtungen
      const P = [[0, 0]], nrm = [];
      for (let i = 0; i < N; i++) { const d = rot(X.u, ch[i]); P.push([P[i][0] + d[0] * seg, P[i][1] + d[1] * seg]); }
      for (let i = 0; i <= N; i++) nrm.push(rot(X.v, i === 0 ? ch[0] * 0.5 : i === N ? ch[N - 1] : (ch[i - 1] + ch[i]) / 2));
      const src = (sAlong, t) => [A[0] * nw + (X.u[0] * sAlong + X.v[0] * t) * k, A[1] * nh + (X.u[1] * sAlong + X.v[1] * t) * k];
      const dst = (i, t) => [P[i][0] + nrm[i][0] * t, P[i][1] + nrm[i][1] * t];
      const quad = (s0, s1, d00, d01, d10, d11) => {
        const S00 = src(s0, -X.vn), S01 = src(s0, X.vp), S10 = src(s1, -X.vn), S11 = src(s1, X.vp);
        tri(ctx, img, S00, S01, S11, d00, d01, d11);
        tri(ctx, img, S00, S11, S10, d00, d11, d10);
      };
      // Stück vor dem Haltepunkt: starr
      if (X.near > 0.5) quad(-X.near, 0, [X.u[0] * -X.near - X.v[0] * X.vn, X.u[1] * -X.near - X.v[1] * X.vn], [X.u[0] * -X.near + X.v[0] * X.vp, X.u[1] * -X.near + X.v[1] * X.vp], dst(0, -X.vn), dst(0, X.vp));
      for (let i = 0; i < N; i++) quad(i * seg, (i + 1) * seg, dst(i, -X.vn), dst(i, X.vp), dst(i + 1, -X.vn), dst(i + 1, X.vp));
    },
    paintHangs(ctx, ops, behind) {
      for (const o of ops) {
        const a = o.a;
        if (!!a.behind !== behind) continue;
        const nw = o.img.naturalWidth, nh = o.img.naturalHeight;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, o.alpha));
        if (o.P2) {
          // zwischen zwei Pins gespannt: Ankerpunkt 1 auf Pin 1, Ankerpunkt 2 auf Pin 2
          const A1 = a.anchor || [0.5, 0.06], A2 = a.anchor2 || [0.5, 0.94];
          const ax = (A2[0] - A1[0]) * nw, ay = (A2[1] - A1[1]) * nh;
          const dx = o.P2[0] - o.P1[0], dy = o.P2[1] - o.P1[1];
          const sc = Math.hypot(dx, dy) / Math.max(1, Math.hypot(ax, ay));
          ctx.translate(o.P1[0] + o.fx, o.P1[1] + o.fy);
          ctx.rotate(Math.atan2(dy, dx) - Math.atan2(ay, ax) + o.fa);
          ctx.scale(sc * o.fsc * (a.flip ? -1 : 1), sc * o.fsc);
          ctx.drawImage(o.img, -A1[0] * nw, -A1[1] * nh, nw, nh);
        } else {
          const A = a.anchor || [0.5, 0.06];
          ctx.translate(o.P1[0] + o.fx, o.P1[1] + o.fy);
          ctx.rotate((Number(a.rot) || 0) * Math.PI / 180 + o.th + o.fa);
          ctx.scale(o.fsc * (a.flip ? -1 : 1), o.fsc);
          const ax0 = o.chain ? Soft.hangAxis(a, o.dw, o.dh) : null;
          if (ax0) Soft.drawBent(ctx, o.img, a, o.dw, o.dh, ax0, a.flip ? o.chain.map((x) => -x) : o.chain);
          else ctx.drawImage(o.img, -A[0] * o.dw, -A[1] * o.dh, o.dw, o.dh);
        }
        ctx.restore();
      }
    },

    // Bones (0.9.35): Verschiebung der Punkte eines fremden Gitters (Pixel w×h) durch die Bereiche.
    // out[k*2], out[k*2+1] = Versatz in Pixeln; die Bones verformen danach weiter.
    offsets(cfg, sim, t, mesh, out) {
      const { w: W, h: H, pos, count } = mesh, aspect = W / H;
      out.fill(0);
      const regs = cfg.regions.filter((r) => r.on !== false);
      if (!regs.length) return out;
      FAST = ++FRAME;
      try {
        const moves = regs.map((r) => { const P = Soft.par(r); return { r, P, m: Soft.regionMove(r, P, sim.regs[r.id], t) }; });
        const L8 = weightsFor(mesh, moves, aspect, 'm' + count, count, (k) => [pos[k * 2] / W, pos[k * 2 + 1] / H]);
        for (let mi = 0; mi < moves.length; mi++) {
          const { r, P, m } = moves[mi], L = L8[mi];
          for (let q = 0; q < L.n; q++) {
            const k = L.k[q], u = pos[k * 2] / W, v = pos[k * 2 + 1] / H;
            const d = Soft.disp(r, P, m, L.lx[q], L.ly[q], L.w[q], aspect, { r, u, v, aspect });
            out[k * 2] += d[0] * W; out[k * 2 + 1] += d[1] * H;
          }
        }
      } finally { FAST = 0; }
      return out;
    },
    // Mittelpunkt eines Bereichs in Bildbruchteilen (für die Beschleunigung an dieser Stelle)
    center(r) { const b = Soft.box(r, 1); return [b.cx, b.cy]; },
    // Anstoßen: auch Figuren mit Bones
    EXT: new Set(),

    // ---------- Story-Bühne: Canvas statt <img> ----------
    // inner = span.char-inner mit <img>. Das Bild bleibt (unsichtbar) für die Größe, das Canvas liegt darüber.
    // Weich-Physik oder Gesicht-Rig: beide zeichnen über dasselbe Canvas
    cfgAny(assetId) { return Soft.cfg(assetId) || (window.Face && Face.cfg(assetId) ? { regions: [], faceOnly: true } : null); },
    attach(inner, assetId) {
      const cfg = Soft.cfgAny(assetId);
      const img = inner.querySelector('img');
      if (!cfg || !img) return null;
      const cv = el('canvas', { class: 'soft-canvas' });
      Object.assign(cv.style, { left: (-PAD * 100) + '%', top: (-PAD * 100) + '%', width: (100 + 2 * PAD * 100) + '%', height: (100 + 2 * PAD * 100) + '%' });
      img.after(cv);
      inner.classList.add('soft-on');
      // eigene Kopie mit CORS laden, sonst darf WebGL das Bild nicht als Textur nutzen
      // (erst nach dem vollständigen Laden hochladen – naturalWidth gibt es schon vorher)
      const tex = new Image(); tex.crossOrigin = 'anonymous';
      const inst = { inner, img, tex, cv, assetId, sim: Soft.newSim(), lastT: 0, ready: false };
      tex.onload = () => { (tex.decode ? tex.decode() : Promise.resolve()).catch(() => {}).then(() => { inst.ready = true; if (inst.face) { inst.face.src = tex; } }); };
      if (window.Face && Face.cfg(assetId)) { inst.face = Face.inst(assetId, tex); Face.LIVE.add(inst.face); }
      tex.src = img.currentSrc || img.src;
      LIVE.add(inst);
      loop();
      return inst;
    },
    // Anstoß für alle sichtbaren Figuren (Aktion „Weich anstoßen“) oder nur für ein Bild
    pokeAll(dir, amount, assetId) {
      for (const it of LIVE) if (!assetId || it.assetId === assetId) Soft.poke(it.sim, dir, amount);
      for (const sim of ANIMS) if (!assetId || sim._asset === assetId) Soft.poke(sim, dir, amount);
      for (const sim of Soft.EXT) if (!assetId || sim._asset === assetId) Soft.poke(sim, dir, amount);
    },

    // ---------- Zwischensequenzen: in den Anim-Canvas zeichnen ----------
    // it = Darsteller-Zustand aus Anim.draw; x,y,w,h = Zielrechteck (lokal); world = Mittelpunkt in Figurenhöhen
    drawAnim(ctx, it, assetId, x, y, w, h, t, world) {
      const cfg = Soft.cfgAny(assetId);
      if (!cfg || !it.img) return false;
      // Gesicht-Rig in Zwischensequenzen: Blinzeln und Ausdruck
      let srcImg = it.img;
      if (window.Face && Face.cfg(assetId) && it.img.naturalWidth) {
        if (!it._face || it._face.assetId !== assetId) { it._face = Face.inst(assetId, it.img); }
        if (it._faceExpr !== (it.faceExpr || '')) { it._faceExpr = it.faceExpr || ''; it._face.setExpr(it._faceExpr || 'neutral', it.faceAmt != null ? it.faceAmt : 1, 0); }
        srcImg = it._face.surface() || it.img;
      }
      const sim = it._soft || (it._soft = Object.assign(Soft.newSim(), { _asset: assetId }));
      ANIMS.add(sim); sim._seen = performance.now() / 1000;
      const dt = sim._t != null ? t - sim._t : 0; sim._t = t;
      if (dt < 0 || dt > 0.25) { sim.regs = {}; sim.last = null; }
      const acc = Soft.feed(sim, world[0], world[1], dt);
      Soft.step(sim, cfg.regions.filter((r) => r.on !== false), acc, dt);
      const m = ctx.getTransform();
      const sc = Math.hypot(m.a, m.b);
      const ow = Math.min(2048, Math.max(32, Math.round(w * sc * (1 + 2 * PAD)))), oh = Math.min(2048, Math.max(32, Math.round(h * sc * (1 + 2 * PAD))));
      const off = it._softCv || (it._softCv = document.createElement('canvas'));
      if (off.width !== ow || off.height !== oh) { off.width = ow; off.height = oh; }
      if (!Soft.render(off, srcImg, cfg, sim, t)) return false;
      ctx.drawImage(off, x - w * PAD, y - h * PAD, w * (1 + 2 * PAD), h * (1 + 2 * PAD));
      return true;
    }
  });

  // Vorzeichen-Abstand zu einem Polygon (negativ = innen)
  function sdPoly(poly, x, y) {
    let d = 1e9, inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const ax = poly[j][0], ay = poly[j][1], bx = poly[i][0], by = poly[i][1];
      const ex = bx - ax, ey = by - ay, wx = x - ax, wy = y - ay;
      const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1e-12)));
      const qx = wx - ex * t, qy = wy - ey * t;
      d = Math.min(d, qx * qx + qy * qy);
      if ((ay > y) !== (by > y) && x < ax + (y - ay) * ex / (ey || 1e-12)) inside = !inside;
    }
    return (inside ? -1 : 1) * Math.sqrt(d);
  }
  const GEO = new WeakMap(), REACH = new WeakMap();
  // FAST = Nummer des Bilds, das gerade gezeichnet wird (0 = außerhalb, dann wird immer verglichen)
  let FAST = 0, FRAME = 0;
  const WCACHE = new WeakMap();
  // Gewicht jedes Gitterpunkts je Bereich (nur Punkte mit Gewicht > 0)
  function weights(cfg, moves, gw, gh, aspect) {
    return weightsFor(cfg, moves, aspect, gw + 'x' + gh, (gw + 1) * (gh + 1), (kk) => [(kk % (gw + 1)) / gw, Math.floor(kk / (gw + 1)) / gh]);
  }
  // owner = Objekt, an dem der Zwischenspeicher hängt; uvAt(k) = Bildbruchteile des Punkts k
  function weightsFor(owner, moves, aspect, tag, count, uvAt) {
    const sig = tag + ':' + aspect.toFixed(4) + JSON.stringify(moves.map((x) => x.P));
    const c = WCACHE.get(owner);
    if (c && c.sig === sig) return c.list;
    const list = moves.map(({ r, P }) => {
      const Pw = P.layer ? Object.assign({}, P, { over: 0 }) : P;
      const k = [], lx = [], ly = [], w = [];
      for (let kk = 0; kk < count; kk++) {
        const [u, v] = uvAt(kk), L = Soft.local(r, u, v, aspect);
        const ww = Soft.weight(Pw, L[0], L[1], L[2], { r, u, v, aspect });
        if (ww <= 0) continue;
        k.push(kk); lx.push(L[0]); ly.push(L[1]); w.push(ww);
      }
      return { n: k.length, k: Int32Array.from(k), lx: Float32Array.from(lx), ly: Float32Array.from(ly), w: Float32Array.from(w) };
    });
    WCACHE.set(owner, { sig, list });
    return list;
  }
  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

  // ---------- WebGL ----------
  const SH = { gl: null, cv: null, lost: false, gen: 0 };
  const TEX = new WeakMap();
  function gl0() {
    if (SH.gl && !SH.lost) return SH;
    if (SH.lost) return null;
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 1024;
    const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: false });
    if (!gl) return null;
    const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 p;attribute vec2 uv;attribute float a;uniform vec2 res;varying vec2 v;varying float al;void main(){vec2 c=p/res*2.0-1.0;gl_Position=vec4(c.x,-c.y,0.0,1.0);v=uv;al=a;}'));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 v;varying float al;uniform sampler2D t;void main(){gl_FragColor=texture2D(t,v)*al;}'));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); SH.lost = true; });
    cv.addEventListener('webglcontextrestored', () => { SH.gl = null; SH.lost = false; });
    Object.assign(SH, { gl, cv, prog, gen: SH.gen + 1, pLoc: gl.getAttribLocation(prog, 'p'), uvLoc: gl.getAttribLocation(prog, 'uv'), aLoc: gl.getAttribLocation(prog, 'a'), resLoc: gl.getUniformLocation(prog, 'res'), pb: gl.createBuffer(), ub: gl.createBuffer(), ab: gl.createBuffer(), ib: gl.createBuffer() });
    gl.enableVertexAttribArray(SH.pLoc); gl.enableVertexAttribArray(SH.uvLoc); gl.enableVertexAttribArray(SH.aLoc);
    return SH;
  }
  const MESHES = new Map();
  function gridIdx(gw, gh) {
    const idx = new Uint16Array(gw * gh * 6);
    let n = 0;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const a = j * (gw + 1) + i, b = a + 1, c = a + gw + 1, d = c + 1;
      idx[n++] = a; idx[n++] = b; idx[n++] = c; idx[n++] = b; idx[n++] = d; idx[n++] = c;
    }
    return idx;
  }
  function baseMesh(gw, gh) {
    const key = gw + 'x' + gh;
    let m = MESHES.get(key);
    if (m) return m;
    const N = (gw + 1) * (gh + 1), uv = new Float32Array(N * 2), al = new Float32Array(N).fill(1);
    for (let j = 0, k = 0; j <= gh; j++) for (let i = 0; i <= gw; i++, k++) { uv[k * 2] = i / gw; uv[k * 2 + 1] = j / gh; }
    m = { pos: new Float32Array(N * 2), uv, al, idx: gridIdx(gw, gh) };
    MESHES.set(key, m);
    return m;
  }
  // Kopie eines Bereichs: eigenes kleines Gitter über der Ellipse, Deckkraft weich zum Rand
  const LG = 24;
  const LIDX = gridIdx(LG, LG);
  function layerMesh(r, P, m, aspect, iw, ih, ox, oy) {
    const N = (LG + 1) * (LG + 1), pos = new Float32Array(N * 2), uv = new Float32Array(N * 2), al = new Float32Array(N);
    const f = Math.max(0.05, Math.min(0.95, Number(P.feather) != null ? Number(P.feather) : 0.4));
    const poly = r.shape === 'poly' && r.pts && r.pts.length >= 3;
    const a = (r.rot || 0) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    const b = Soft.box(r, aspect);
    for (let j = 0, k = 0; j <= LG; j++) for (let i = 0; i <= LG; i++, k++) {
      let u, v, lx, ly, d;
      if (poly) {
        // Gitter über den Rahmen der freien Form
        u = b.cx + ((i / LG) * 2 - 1) * b.rx; v = b.cy + ((j / LG) * 2 - 1) * b.ry;
        const L = Soft.local(r, u, v, aspect); lx = L[0]; ly = L[1]; d = L[2];
      } else {
        lx = (i / LG) * 2 - 1; ly = (j / LG) * 2 - 1;
        const x = lx * r.rx * aspect, y = ly * r.ry;
        u = r.cx + (x * cs - y * sn) / aspect; v = r.cy + (x * sn + y * cs);
        d = Math.hypot(lx, ly);
      }
      const alpha = d >= 1 ? 0 : d <= 1 - f ? 1 : 1 - smooth((d - (1 - f)) / f);
      const E = { r, u, v, aspect };
      const aw = P.pendulum ? 1 : Soft.anchorW(P, lx, ly, E);
      const dd = Soft.disp(r, P, m, lx, ly, 1, aspect, E);
      // am Anker bleibt die Kopie stehen, weiter weg schwingt sie voll mit
      const dx = dd[0] * aw, dy = dd[1] * aw;
      uv[k * 2] = Math.max(0, Math.min(1, u)); uv[k * 2 + 1] = Math.max(0, Math.min(1, v));
      pos[k * 2] = ox + (u + dx) * iw; pos[k * 2 + 1] = oy + (v + dy) * ih;
      al[k] = (u < 0 || u > 1 || v < 0 || v > 1) ? 0 : alpha;
    }
    return { pos, uv, al, idx: LIDX };
  }
  function drawMesh(S, m, dyn) {
    const gl = S.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, S.pb); gl.bufferData(gl.ARRAY_BUFFER, m.pos, gl.DYNAMIC_DRAW); gl.vertexAttribPointer(S.pLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, S.ub); gl.bufferData(gl.ARRAY_BUFFER, m.uv, gl.DYNAMIC_DRAW); gl.vertexAttribPointer(S.uvLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, S.ab); gl.bufferData(gl.ARRAY_BUFFER, m.al, gl.DYNAMIC_DRAW); gl.vertexAttribPointer(S.aLoc, 1, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, S.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.DYNAMIC_DRAW);
    gl.drawElements(gl.TRIANGLES, m.idx.length, gl.UNSIGNED_SHORT, 0);
  }

  // ---------- Schleife für die Story-Bühne ----------
  const LIVE = new Set();
  const ANIMS = new Set();
  let running = false;
  function loop() {
    if (running) return;
    running = true;
    let prev = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.1, (now - prev) / 1000); prev = now;
      for (const it of LIVE) {
        if (!it.cv.isConnected) { LIVE.delete(it); if (it.face) Face.LIVE.delete(it.face); continue; }
        const cfg = Soft.cfgAny(it.assetId);
        if (!cfg || !it.ready) continue;
        if (!it.inner.isConnected && it.face) Face.LIVE.delete(it.face);
        const rc = it.inner.getBoundingClientRect();
        if (!rc.height) continue;
        // Canvas-Auflösung an die angezeigte Größe anpassen
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const W = Math.min(2048, Math.round(rc.width * (1 + 2 * PAD) * dpr)), H = Math.min(2048, Math.round(rc.height * (1 + 2 * PAD) * dpr));
        if (it.cv.width !== W || it.cv.height !== H) { it.cv.width = W; it.cv.height = H; }
        // Bewegung in Figurenhöhen (unabhängig von der Bildschirmgröße)
        const acc = Soft.feed(it.sim, (rc.left + rc.width / 2) / rc.height, (rc.top + rc.height / 2) / rc.height, dt);
        // gespiegelte Figur: seitliche Richtung umdrehen
        if (it.inner.style.transform && /scaleX\(-1\)/.test(it.inner.style.transform)) acc.x = -acc.x;
        Soft.step(it.sim, cfg.regions.filter((r) => r.on !== false), acc, dt);
        const srcImg = (it.face && Face.cfg(it.assetId) && it.face.surface(now)) || it.tex;
        const ok = Soft.render(it.cv, srcImg, cfg, it.sim, now / 1000 - it.sim.t0);
        it.inner.classList.toggle('soft-on', ok);
      }
      for (const s of ANIMS) if (s._t != null && performance.now() / 1000 - (s._seen || 0) > 5) ANIMS.delete(s);
      if (LIVE.size) requestAnimationFrame(tick); else running = false;
    };
    requestAnimationFrame(tick);
  }

  // ---------- Aktion: Weich anstoßen ----------
  if (VN.registerAction) {
    VN.registerAction('softPoke', {
      label: '〰 Weich-Physik anstoßen', make: () => ({ dir: 'down', amount: 1 }),
      apply: (a) => Soft.pokeAll(a.dir || 'down', a.amount != null ? a.amount : 1, a.asset || ''),
      text: (a) => '〰 ' + VN.t('Weich anstoßen') + ' (' + VN.t({ down: 'nach unten', up: 'nach oben', left: 'nach links', right: 'nach rechts', random: 'zufällig', gulp: 'Schlucken' }[a.dir || 'down']) + ')',
      row: (row, a, sel) => {
        row.appendChild(sel(a.dir || 'down', [['down', 'nach unten'], ['up', 'nach oben'], ['left', 'nach links'], ['right', 'nach rechts'], ['random', 'zufällig'], ['gulp', 'Schlucken']], (v) => VN.mutate(() => { a.dir = v; })));
        row.appendChild(el('input', { type: 'number', step: '0.1', min: '0', value: a.amount != null ? a.amount : 1, style: { width: '70px' }, title: VN.t('Stärke'), onchange: (e) => VN.mutate(() => { a.amount = Number(e.target.value) || 0; }) }));
        const s = VN.assetSelect('image', a.asset || '', (v) => VN.mutate(() => { a.asset = v; }));
        s.style.maxWidth = '160px'; s.title = VN.t('nur dieses Bild (leer = alle)');
        row.appendChild(s);
      }
    });
  }
})();
