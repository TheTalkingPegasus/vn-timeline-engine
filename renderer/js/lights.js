// Lichtquellen (0.9.9): Scheinwerfer, Lampe, Neonröhre und Gegenlicht.
// Ein Licht ist ein Clip auf einer Effekt-Spur (clip.light) oder ein Eintrag im Hub (s.fx).
// Aufbau in der Spielwelt:
//   Abdunklung (eine Ebene für alle Lichter) → Gegenlichter (hinter den Figuren) → Figuren → Vordergrund → Lichter vorne
// Jedes Licht besteht aus bis zu drei Ebenen mit eigener Parallax-Tiefe (data-depth):
//   .light-lit  (Farbig-Abwedeln): hellt auf, was darunter liegt – hebt die Abdunklung im Lichtkegel wieder auf
//   .light-haze (Negativ multiplizieren): das sichtbare Licht selbst (Lampenschein, Röhre, Kegel im Nebel)
//   .light-dust (Negativ multiplizieren): Staubflusen, die nur im Licht aufleuchten
// Figuren bekommen pro Licht einen SVG-Filter: Kantenlicht von der Seite des Lichts, Farbschimmer, Silhouette und Lichtsaum.
(function () {
  const { el } = VN;
  const NS = 'http://www.w3.org/2000/svg';

  const KINDS = [['spot', 'Scheinwerfer'], ['lamp', 'Lampe / Lichtkreis'], ['neon', 'Neonröhre'], ['back', 'Gegenlicht (hinter den Figuren)']];
  const BASE = { lColor: '#fff1d6', lPower: 50, lSize: 50, lSoft: 50, lDim: 40, lFog: 35, lRim: 55, lTint: 25, lSil: 0, lFlicker: 0, lSweep: 0, lSweepSpeed: 6, lDust: false, lDustAmt: 45, lDustSize: 40, lDepth: 1, lAngle: 90, lSpread: 22, lLen: 25 };
  const DEF = {
    spot: { lx: 28, ly: 0, lAngle: 65, lSpread: 20, lSize: 115, lColor: '#fff1d6', lPower: 55, lSoft: 40, lDim: 50, lFog: 40, lRim: 60, lTint: 20, lDust: true },
    lamp: { lx: 72, ly: 32, lSize: 42, lColor: '#ffc46b', lPower: 50, lSoft: 55, lDim: 40, lFog: 35, lRim: 50, lTint: 35, lFlicker: 8 },
    neon: { lx: 58, ly: 18, lAngle: 0, lLen: 26, lSize: 34, lColor: '#ff3fb4', lPower: 55, lSoft: 60, lDim: 45, lFog: 45, lRim: 70, lTint: 40 },
    back: { lx: 50, ly: 52, lSize: 62, lColor: '#a6ffd2', lPower: 70, lSoft: 55, lDim: 60, lFog: 55, lRim: 60, lTint: 0, lSil: 70, lDust: true }
  };
  const v = (c, k) => (c[k] != null ? c[k] : (DEF[c.light] && DEF[c.light][k] != null ? DEF[c.light][k] : BASE[k]));
  const rgb = (hex) => { const n = parseInt(String(hex || '#ffffff').slice(1), 16) || 0; return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const sm = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const calm = () => !!(VN.settings && VN.settings.calm && window.Player && Player.running);

  // Form eines Lichts. Koordinaten in Bildhöhen: X von 0 bis A (Seitenverhältnis), Y von 0 bis 1.
  // I = wie stark es an einem Punkt beleuchtet, haze = wie hell das Licht dort selbst zu sehen ist
  function geom(c, A, ang) {
    const k = c.light;
    const X0 = v(c, 'lx') / 100 * A, Y0 = v(c, 'ly') / 100;
    const R = Math.max(0.02, v(c, 'lSize') / 100), soft = v(c, 'lSoft') / 100, fog = v(c, 'lFog') / 100;
    if (k === 'spot') {
      const a = (ang != null ? ang : v(c, 'lAngle')) * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
      const half = Math.max(2, v(c, 'lSpread')) * Math.PI / 180, edge = half * (0.12 + 0.88 * soft);
      const I = (X, Y) => {
        const ux = X - X0, uy = Y - Y0, d = Math.hypot(ux, uy);
        if (d < 1e-4) return 1;
        const del = Math.acos(Math.max(-1, Math.min(1, (ux * dx + uy * dy) / d)));
        return sm((half - del) / edge) * sm(1 - d / R);
      };
      return { k, A, X0, Y0, R, I, haze: (X, Y) => { const d = Math.hypot(X - X0, Y - Y0); return I(X, Y) * fog * (0.35 + 0.65 * (1 - Math.min(1, d / R))) + Math.exp(-((d / 0.025) ** 2)) * 0.9; } };
    }
    if (k === 'neon') {
      const a = v(c, 'lAngle') * Math.PI / 180, L = Math.max(0.01, v(c, 'lLen') / 100);
      const X1 = X0 + Math.cos(a) * L, Y1 = Y0 + Math.sin(a) * L, th = 0.006;
      const dist = (X, Y) => { const vx = X1 - X0, vy = Y1 - Y0; const t = Math.max(0, Math.min(1, ((X - X0) * vx + (Y - Y0) * vy) / (vx * vx + vy * vy))); return Math.hypot(X - X0 - vx * t, Y - Y0 - vy * t); };
      const I = (X, Y) => Math.pow(sm(1 - dist(X, Y) / R), 1.2 + (1 - soft));
      return { k, A, X0, Y0, X1, Y1, R, I, dist, haze: (X, Y) => { const d = dist(X, Y); return (d < th ? 1.4 : Math.exp(-(((d - th) / 0.012) ** 2)) * 1.2) + fog * I(X, Y) ** 2 * 0.8; } };
    }
    const I = (X, Y) => Math.pow(sm(1 - Math.hypot(X - X0, Y - Y0) / R), 1 + (1 - soft) * 1.5);
    const core = k === 'back' ? 0.1 : 0.07;
    return {
      k, A, X0, Y0, R, I,
      haze: (X, Y) => { const d = Math.hypot(X - X0, Y - Y0); const i = I(X, Y); return Math.exp(-((d / (R * core + 0.004)) ** 2)) * (k === 'back' ? 0.7 : 1.1) + fog * (k === 'back' ? i ** 1.3 * 0.95 : i * i * 0.7); }
    };
  }

  // Bild eines Lichts in kleiner Auflösung (weich hochskaliert)
  function paint(cv, c, A, dimG, which) {
    const W = Math.max(64, Math.min(360, Math.round(240 * Math.sqrt(A)))), H = Math.max(36, Math.round(W / A));
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const im = g.createImageData(W, H), d = im.data;
    const G = geom(c, A), col = rgb(v(c, 'lColor')), p = v(c, 'lPower') / 100;
    for (let j = 0; j < H; j++) {
      const Y = (j + 0.5) / H;
      for (let i = 0; i < W; i++) {
        const X = (i + 0.5) / W * A, o = (j * W + i) * 4;
        if (which === 'lit') {
          const I = G.I(X, Y);
          for (let ch = 0; ch < 3; ch++) {
            // Abwedeln: Ergebnis = Bild / (1 − S). Soll im Licht (1 − Abdunklung) wieder auf F steigen → S = 1 − (1 − dim) / F
            const F = (1 - dimG) + I * (dimG * (0.35 + 0.65 * col[ch]) + p * col[ch] * 1.15);
            d[o + ch] = Math.max(0, Math.min(0.96, 1 - (1 - dimG) / Math.max(1e-3, F))) * 255;
          }
          d[o + 3] = 255;
        } else {
          const h = Math.min(1.6, G.haze(X, Y) * (0.45 + p * 0.8));
          for (let ch = 0; ch < 3; ch++) d[o + ch] = Math.min(255, (col[ch] + (1 - col[ch]) * Math.max(0, h - 0.9) * 0.8) * Math.min(1, h) * 255);
          d[o + 3] = 255;
        }
      }
    }
    g.putImageData(im, 0, 0);
  }

  // Staubflusen, die nur im Licht aufleuchten (nahe größer und weicher, ferne klein)
  function dust(cv, c, getAng) {
    const g = cv.getContext('2d'), R = Math.random;
    const col = rgb(v(c, 'lColor')).map((x) => Math.round((0.45 + 0.55 * x) * 255));
    const amt = v(c, 'lDustAmt') / 100, size = v(c, 'lDustSize') / 40;
    let W = 0, H = 0, A = 16 / 9, parts = [], last = performance.now(), G = null, gAng = null;
    const resize = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = Math.max(1, Math.round((cv.clientWidth || r.width) * dpr)); H = Math.max(1, Math.round((cv.clientHeight || r.height) * dpr));
      cv.width = W; cv.height = H; A = W / H; G = null;
    };
    const geo = () => { const a = getAng(); if (!G || a !== gAng) { G = geom(c, A, a); gAng = a; } return G; };
    const spawn = () => {
      const Gm = geo();
      let X = 0, Y = 0;
      for (let t = 0; t < 24; t++) { X = R() * A; Y = R(); if (Gm.I(X, Y) > 0.06) break; }
      return { X, Y, z: R(), ph: R() * 6.28, sp: 0.3 + R() * 0.7, life: 0 };
    };
    const count = () => Math.round((window.Perf ? Perf.partsMul() : 1) * amt * 150);
    const step = (now) => {
      if (!cv.isConnected) return;
      if (!W || Math.abs(W - Math.round(cv.clientWidth * Math.min(1.5, window.devicePixelRatio || 1))) > 2) { resize(); parts = []; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const Gm = geo();
      const want = count();
      while (parts.length > want) parts.pop();
      while (parts.length < want) parts.push(spawn());
      g.clearRect(0, 0, W, H);
      for (const q of parts) {
        q.ph += dt * q.sp; q.life += dt;
        q.X += (Math.cos(q.ph * 0.9 + q.z * 7) * 0.006 + 0.002) * dt * (0.5 + q.z);
        q.Y += (Math.sin(q.ph * 0.7 + q.z * 3) * 0.006 + 0.0015) * dt * (0.5 + q.z);
        const I = Gm.I(q.X, q.Y);
        if (q.X < -0.05 || q.X > A + 0.05 || q.Y < -0.05 || q.Y > 1.05 || (I < 0.01 && q.life > 3)) { Object.assign(q, spawn()); continue; }
        const tw = 0.55 + 0.45 * Math.sin(q.ph * 2.3 + q.z * 11) ** 2;
        const a = Math.min(1, Math.pow(I, 0.7) * tw * (0.45 + 0.55 * q.z));
        if (a < 0.02) continue;
        const r = Math.max(0.7, (0.5 + 1.9 * q.z * q.z) * size * H / 700);
        const x = q.X / A * W, y = q.Y * H;
        if (q.z > 0.8) {
          const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.2);
          gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${(a * 0.8).toFixed(3)})`); gr.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 2.2, 0, 6.28); g.fill();
        } else {
          g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a.toFixed(3)})`;
          g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill();
        }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame((t) => { last = t; resize(); step(t); });
  }

  const Light = (window.Light = {
    KINDS, DEF, v, geom,
    isLight: (c) => !!(c && c.light),
    defaults(kind) { return Object.assign({ light: kind }, DEF[kind]); },

    // Ebenen eines Lichts bauen. dimG = Abdunklung der Szene (größte aller aktiven Lichter)
    build(c, A, dimG) {
      const depth = Number(v(c, 'lDepth'));
      const mk = (cls, blend) => {
        const n = el('div', { class: 'light-l ' + cls });
        n.dataset.depth = String(isFinite(depth) ? depth : 1);
        n.dataset.light = c.id;
        n.style.mixBlendMode = blend;
        const fl = Number(v(c, 'lFlicker')) || 0;
        if (fl > 0) { n.classList.add('flk'); n.style.setProperty('--lf', String(Math.min(1, fl / 100))); n.style.setProperty('--lfd', (c.light === 'neon' ? 3.4 : 1.7) + 's'); }
        return n;
      };
      const out = [];
      const lit = mk('light-lit', 'color-dodge'), haze = mk('light-haze', 'screen');
      const cl = el('canvas', { class: 'light-cv' }), ch = el('canvas', { class: 'light-cv' });
      paint(cl, c, A, dimG, 'lit'); paint(ch, c, A, dimG, 'haze');
      lit.appendChild(cl); haze.appendChild(ch);
      out.push(lit, haze);
      // Schwenken (nur Scheinwerfer): Kegel dreht sich um die Lampe
      const sw = c.light === 'spot' ? Number(v(c, 'lSweep')) || 0 : 0, swT = Math.max(1, Number(v(c, 'lSweepSpeed')) || 6);
      const t0 = performance.now();
      const angNow = () => (sw && !calm() ? v(c, 'lAngle') + sw * Math.sin((performance.now() - t0) / 1000 / swT * Math.PI * 2) : v(c, 'lAngle'));
      if (sw) {
        for (const cv of [cl, ch]) cv.style.transformOrigin = v(c, 'lx') + '% ' + v(c, 'ly') + '%';
        const spin = () => {
          if (!cl.isConnected) return;
          const r = (angNow() - v(c, 'lAngle')).toFixed(2);
          cl.style.transform = ch.style.transform = 'rotate(' + r + 'deg)';
          requestAnimationFrame(spin);
        };
        requestAnimationFrame(spin);
      }
      if (v(c, 'lDust') && Number(v(c, 'lDustAmt')) > 0) {
        const dn = mk('light-dust', 'screen');
        const dc = el('canvas', { class: 'light-cv' });
        dn.appendChild(dc);
        requestAnimationFrame(() => dust(dc, c, angNow));
        out.push(dn);
      }
      return out;
    },

    // Lichter in eine Bühne einsetzen bzw. abgleichen.
    // host: Element, das die Ebenen aufnimmt (Spielwelt oder Hub-Bühne)
    // o.back: Gegenlicht und Abdunklung davor einfügen (z. B. die Figuren-Ebene), o.front: Lichter vorne davor einfügen
    // o.figs(): [[Element, außerhalb]] – Figuren bzw. Hub-Objekte, die beleuchtet werden
    // o.fronts(): Vordergrund-Ebenen, die mit abgedunkelt werden
    sync(host, clips, o = {}) {
      if (!host) return;
      clips = (clips || []).filter((c) => c && c.light);
      const env = host._light || (host._light = { nodes: {}, keys: {} });
      Object.assign(env, { o, clips });
      const A = (host.clientWidth || 16) / (host.clientHeight || 9);
      const dimG = clips.reduce((m, c) => Math.max(m, Math.min(0.9, (Number(v(c, 'lDim')) || 0) / 100)), 0);
      env.dimG = dimG; env.A = A;
      // Abdunklung
      let dim = host.querySelector(':scope > .light-dim');
      if (clips.length && dimG > 0) {
        if (!dim) dim = el('div', { class: 'light-dim' });
        dim.style.opacity = String(dimG);
        const ref = o.back && o.back.parentNode === host ? o.back : null;
        if (dim.nextSibling !== ref || dim.parentNode !== host) host.insertBefore(dim, ref);
      } else if (dim) { dim.style.opacity = '0'; const d0 = dim; setTimeout(() => { if (d0.style.opacity === '0') d0.remove(); }, 650); }
      // Lichter
      const keep = {};
      for (const c of clips) {
        const key = JSON.stringify(c) + '|' + A.toFixed(3) + '|' + dimG;
        keep[c.id] = true;
        if (env.keys[c.id] === key && env.nodes[c.id] && env.nodes[c.id][0].isConnected) continue;
        const fresh = !env.nodes[c.id];
        for (const n of env.nodes[c.id] || []) n.remove();
        const nodes = Light.build(c, A, dimG);
        const ref = c.light === 'back' ? (o.back && o.back.parentNode === host ? o.back : null) : (o.front && o.front.parentNode === host ? o.front : null);
        for (const n of nodes) {
          host.insertBefore(n, ref);
          if (host._vnCam && window.Fx) n.style.transform = Fx.camTransform(host._vnCam, Number(n.dataset.depth), false);
          if (fresh && o.fade) { n.style.opacity = '0'; void n.offsetWidth; n.style.transition = 'opacity 0.6s'; n.style.opacity = ''; }
        }
        env.nodes[c.id] = nodes; env.keys[c.id] = key;
      }
      for (const id of Object.keys(env.nodes)) {
        if (keep[id]) continue;
        for (const n of env.nodes[id]) { if (o.fade) { n.style.transition = 'opacity 0.6s'; n.style.opacity = '0'; setTimeout(() => n.remove(), 650); } else n.remove(); }
        delete env.nodes[id]; delete env.keys[id];
      }
      // Vordergrund mit abdunkeln
      for (const n of (o.fronts ? o.fronts() : [])) if (n) n.style.filter = clips.length && dimG ? 'brightness(' + (1 - dimG * 0.9).toFixed(3) + ')' : '';
      env.sig = '';
      Light.figures(host);
      Light.watch(host);
    },

    // Figuren regelmäßig prüfen: bewegt sich eine Figur oder die Kamera, wandert das Kantenlicht mit
    watch(host) {
      const env = host._light;
      if (!env || env.timer) return;
      env.timer = setInterval(() => {
        if (!host.isConnected) { clearInterval(env.timer); env.timer = null; return; }
        Light.figures(host);
      }, 260);
    },

    // Bildschirm-Position eines Lichts und Umrechnung in seine Koordinaten
    frame(host, c) {
      const env = host._light;
      const n = env && env.nodes[c.id] && env.nodes[c.id][1];
      if (!n || !n.isConnected) return null;
      const r = n.getBoundingClientRect();
      if (!r.height) return null;
      return { r, A: r.width / r.height, toN: (x, y) => [(x - r.left) / r.height, (y - r.top) / r.height], toS: (X, Y) => [r.left + X * r.height, r.top + Y * r.height] };
    },

    // Licht auf Figuren und Hub-Objekte (SVG-Filter je Figur)
    figures(host) {
      const env = host._light;
      if (!env) return;
      const figs = (env.o.figs ? env.o.figs() : []).filter((f) => f && f[0]);
      const frames = env.clips.map((c) => [c, Light.frame(host, c)]).filter((x) => x[1]);
      const rects = figs.map(([n]) => n.getBoundingClientRect());
      const sig = env.clips.map((c) => env.keys[c.id]).join('#') + '|' + frames.map(([, f]) => [f.r.left, f.r.top, f.r.width].map(Math.round).join(',')).join(';') + '|' +
        figs.map(([n], i) => [rects[i].left, rects[i].top, rects[i].width, rects[i].height].map(Math.round).join(',') + (n._lfOn ? '' : '!')).join(';');
      if (sig === env.sig) return;
      env.sig = sig;
      const blurOk = !(window.Perf && !Perf.blurOk());
      figs.forEach(([n, outside], i) => {
        const R = rects[i];
        if (!R.width || !R.height || !env.clips.length) { Light.clearFig(n); return; }
        const h = n.offsetHeight || R.height, sc = h / R.height; // lokale Pixel je Bildschirm-Pixel
        let flip = 1;
        try { const m = getComputedStyle(n).transform; if (m && m.startsWith('matrix(') && Number(m.slice(7).split(',')[0]) < 0) flip = -1; } catch (e) { /* egal */ }
        const cx = R.left + R.width / 2, cy = R.top + R.height / 2;
        const slope = [1 - env.dimG, 1 - env.dimG, 1 - env.dimG];
        let sil = 0;
        const tints = [], rims = [], edges = [], halos = [];
        for (const [c, F] of frames) {
          const G = geom(c, F.A);
          // Lichtpunkt auf dem Bildschirm
          const [lx, ly] = c.light === 'neon' ? F.toS((G.X0 + G.X1) / 2, (G.Y0 + G.Y1) / 2) : F.toS(G.X0, G.Y0);
          // nächster Punkt der Figur zum Licht (etwas nach innen, damit Kanten nicht zählen)
          const px = Math.max(R.left + R.width * 0.2, Math.min(R.right - R.width * 0.2, lx)), py = Math.max(R.top + R.height * 0.12, Math.min(R.bottom - R.height * 0.12, ly));
          const I = Math.max(G.I(...F.toN(px, py)), c.light === 'spot' ? G.I(...F.toN(cx, cy)) : 0);
          if (I < 0.02) continue;
          const col = v(c, 'lColor'), cc = rgb(col), p = v(c, 'lPower') / 100;
          if (c.light === 'back') {
            sil = Math.max(sil, Math.min(1, I * 1.4) * v(c, 'lSil') / 100);
            const rs = v(c, 'lRim') / 100 * Math.min(1, I * 1.5);
            if (rs > 0.02) { edges.push({ col, s: rs }); if (blurOk) halos.push({ col, s: Math.min(1, rs * 1.1) }); }
          } else {
            if (outside) for (let ch = 0; ch < 3; ch++) slope[ch] += I * (env.dimG * (0.35 + 0.65 * cc[ch]) + p * cc[ch] * 0.9);
            const t = v(c, 'lTint') / 100 * I;
            if (t > 0.02) tints.push({ col, s: Math.min(0.75, t * 0.75) });
            const rs = v(c, 'lRim') / 100 * Math.min(1, I * 1.7);
            if (rs > 0.02) {
              let ux = lx - cx, uy = ly - cy; const d = Math.hypot(ux, uy) || 1; ux /= d; uy /= d;
              rims.push({ col, s: rs, ux: ux * flip, uy });
            }
          }
        }
        for (let ch = 0; ch < 3; ch++) slope[ch] = Math.min(1.6, slope[ch] * (1 - 0.93 * sil));
        if (!tints.length && !rims.length && !edges.length && slope.every((x) => Math.abs(x - 1) < 0.01)) { Light.clearFig(n); return; }
        const w = Math.max(1.5, h * 0.011), b = blurOk ? (w * 0.6).toFixed(2) : 0;
        let f = `<feComponentTransfer in="SourceGraphic" result="b"><feFuncR type="linear" slope="${slope[0].toFixed(3)}"/><feFuncG type="linear" slope="${slope[1].toFixed(3)}"/><feFuncB type="linear" slope="${slope[2].toFixed(3)}"/></feComponentTransfer>`;
        for (const t of tints) f += `<feFlood flood-color="${t.col}" flood-opacity="${t.s.toFixed(3)}"/><feComposite in2="SourceAlpha" operator="in"/><feBlend in2="b" mode="screen" result="b"/>`;
        rims.forEach((r, k) => {
          f += `<feOffset in="SourceAlpha" dx="${(-r.ux * w * 1.6).toFixed(2)}" dy="${(-r.uy * w * 1.6).toFixed(2)}" result="o${k}"/><feComposite in="SourceAlpha" in2="o${k}" operator="out"/>` +
            (b ? `<feGaussianBlur stdDeviation="${b}"/><feComposite in2="SourceAlpha" operator="in" result="e${k}"/>` : `<feComposite in2="SourceAlpha" operator="in" result="e${k}"/>`) +
            `<feFlood flood-color="${r.col}" flood-opacity="${Math.min(1, r.s * 1.2).toFixed(3)}"/><feComposite in2="e${k}" operator="in"/><feBlend in2="b" mode="screen" result="b"/>`;
        });
        edges.forEach((r, k) => {
          f += `<feMorphology in="SourceAlpha" operator="erode" radius="${(w * 0.85).toFixed(2)}" result="m${k}"/><feComposite in="SourceAlpha" in2="m${k}" operator="out"/>` +
            (b ? `<feGaussianBlur stdDeviation="${b}"/><feComposite in2="SourceAlpha" operator="in" result="g${k}"/>` : `<feComposite in2="SourceAlpha" operator="in" result="g${k}"/>`) +
            `<feFlood flood-color="${r.col}" flood-opacity="${Math.min(1, r.s * 1.05).toFixed(3)}"/><feComposite in2="g${k}" operator="in"/><feBlend in2="b" mode="screen" result="b"/>`;
        });
        let merge = '';
        halos.forEach((r, k) => {
          f += `<feGaussianBlur in="SourceAlpha" stdDeviation="${(h * 0.03).toFixed(1)}" result="hb${k}"/><feFlood flood-color="${r.col}" flood-opacity="${(r.s * 0.9).toFixed(3)}"/><feComposite in2="hb${k}" operator="in" result="x${k}"/>`;
          merge += `<feMergeNode in="x${k}"/>`;
        });
        if (merge) f += `<feMerge>${merge}<feMergeNode in="b"/></feMerge>`;
        Light.setFig(n, f, sc);
      });
    },
    _fid: 0,
    _fcache: {},
    setFig(n, inner) {
      let svg = document.getElementById('vn-svg-filters');
      if (!svg) { svg = document.createElementNS(NS, 'svg'); svg.id = 'vn-svg-filters'; svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none'; document.body.appendChild(svg); }
      let id = Light._fcache[inner];
      if (!id || !document.getElementById(id)) {
        if (Object.keys(Light._fcache).length > 300) { for (const k of Object.keys(Light._fcache)) { const old = document.getElementById(Light._fcache[k]); if (old) old.remove(); } Light._fcache = {}; }
        id = 'vnl-' + (++Light._fid);
        const f = document.createElementNS(NS, 'filter');
        f.id = id;
        f.setAttribute('x', '-25%'); f.setAttribute('y', '-25%'); f.setAttribute('width', '150%'); f.setAttribute('height', '150%');
        f.setAttribute('color-interpolation-filters', 'sRGB');
        f.innerHTML = inner;
        svg.appendChild(f);
        Light._fcache[inner] = id;
      }
      if (n._lfBase == null) n._lfBase = n.style.filter || '';
      n.style.filter = ('url(#' + id + ') ' + n._lfBase).trim();
      n._lfOn = true;
    },
    clearFig(n) {
      if (n._lfBase != null) n.style.filter = n._lfBase;
      n._lfOn = false;
    },

    // ---------- Editor: Lichter mit der Maus platzieren (wie Hitboxen) ----------
    // stage: Bühne im Editor, host: Element mit den Lichtern (Spielwelt oder die Bühne selbst)
    handles(stage, host) {
      stage.querySelectorAll(':scope > .light-hbox').forEach((n) => n.remove());
      const env = host && host._light;
      if (!env || !env.clips.length) return;
      const box = el('div', { class: 'light-hbox' });
      stage.appendChild(box);
      const place = () => {
        box.innerHTML = '';
        const S = stage.getBoundingClientRect();
        if (!S.width) return;
        const pct = (x, y) => ({ left: ((x - S.left) / S.width * 100).toFixed(2) + '%', top: ((y - S.top) / S.height * 100).toFixed(2) + '%' });
        for (const c of env.clips) {
          const F = Light.frame(host, c);
          if (!F) continue;
          const G = geom(c, F.A);
          const [sx, sy] = F.toS(G.X0, G.Y0);
          const name = (KINDS.find((k) => k[0] === c.light) || [0, 'Licht'])[1].replace(/ \(.*\)$/, '');
          const h = el('div', { class: 'light-h', title: VN.t('Licht verschieben') + ' · ' + name, style: Object.assign(pct(sx, sy), { '--lc': v(c, 'lColor') }) }, el('span', null, '💡'), el('em', null, name));
          box.appendChild(h);
          Light.dragHandle(h, c, host, F, 'pos', place);
          if (c.light === 'spot' || c.light === 'neon') {
            const a = v(c, 'lAngle') * Math.PI / 180, L = c.light === 'spot' ? G.R * 0.6 : Math.max(0.01, v(c, 'lLen') / 100);
            const [ex, ey] = F.toS(G.X0 + Math.cos(a) * L, G.Y0 + Math.sin(a) * L);
            const e = el('div', { class: 'light-h aim', title: c.light === 'spot' ? VN.t('Richtung und Reichweite') : VN.t('Länge und Richtung der Röhre'), style: Object.assign(pct(ex, ey), { '--lc': v(c, 'lColor') }) });
            box.appendChild(e);
            Light.dragHandle(e, c, host, F, 'aim', place);
          }
        }
      };
      requestAnimationFrame(place);
      // Bilder laden nach – Griffe nachziehen, wenn sich die Bühne noch verschiebt
      setTimeout(() => { if (box.isConnected && !box._drag) place(); }, 400);
    },
    dragHandle(h, c, host, F, mode, replace) {
      h.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        const keys = mode === 'pos' ? ['lx', 'ly'] : c.light === 'spot' ? ['lAngle', 'lSize'] : ['lAngle', 'lLen'];
        const orig = {}; for (const k of keys) orig[k] = c[k];
        const box = h.parentNode; box._drag = true;
        const S = h.offsetParent ? h.offsetParent.getBoundingClientRect() : null;
        let raf = 0;
        const redraw = () => { raf = 0; const o = host._light && host._light.o; Light.sync(host, host._light.clips, o); };
        VN.drag(e, (dx, dy, ev) => {
          const [X, Y] = F.toN(ev.clientX, ev.clientY);
          if (mode === 'pos') {
            c.lx = Math.round(Math.max(-20, Math.min(120, X / F.A * 100)) * 2) / 2;
            c.ly = Math.round(Math.max(-20, Math.min(120, Y * 100)) * 2) / 2;
          } else {
            const X0 = v(c, 'lx') / 100 * F.A, Y0 = v(c, 'ly') / 100;
            let a = Math.atan2(Y - Y0, X - X0) * 180 / Math.PI;
            if (ev.shiftKey) a = Math.round(a / 15) * 15;
            c.lAngle = Math.round(a);
            const d = Math.hypot(X - X0, Y - Y0) * 100;
            if (c.light === 'spot') c.lSize = Math.round(Math.max(20, Math.min(250, d / 0.6)));
            else c.lLen = Math.round(Math.max(2, Math.min(150, d)));
          }
          if (S) { h.style.left = ((ev.clientX - S.left) / S.width * 100) + '%'; h.style.top = ((ev.clientY - S.top) / S.height * 100) + '%'; }
          if (!raf) raf = requestAnimationFrame(redraw);
        }, (dx, dy, moved) => {
          box._drag = false;
          if (!moved) return;
          const now = {}; for (const k of keys) now[k] = c[k];
          Object.assign(c, orig);
          VN.mutate(() => { Object.assign(c, now); });
        });
      });
    },

    // ---------- Einstellungen (Effekt-Spur und Hub) ----------
    fields(c, ui) {
      const { rng, check, set, field, sel } = ui;
      const x = (k) => v(c, k);
      const pct = (z) => (z ? z + ' %' : 'aus');
      const out = [
        field(VN.t('Art des Lichts'), sel(c.light, KINDS, (k) => VN.mutate(() => { for (const key of Object.keys(BASE).concat(['lx', 'ly'])) delete c[key]; Object.assign(c, DEF[k], { light: k }); }))),
        el('label', { class: 'd-color' }, el('input', { type: 'color', value: x('lColor'), onchange: (e) => set(c, 'lColor')(e.target.value) }), el('span', null, VN.t('Lichtfarbe'))),
        rng('Helligkeit', x('lPower'), 0, 100, 1, (z) => z + ' %', set(c, 'lPower')),
        rng(c.light === 'spot' ? 'Reichweite' : c.light === 'neon' ? 'Leuchtweite' : 'Größe', x('lSize'), 5, 250, 1, (z) => z + ' %', set(c, 'lSize')),
        c.light === 'spot' ? rng('Breite des Kegels', x('lSpread'), 3, 70, 1, (z) => z + '°', set(c, 'lSpread')) : null,
        c.light === 'spot' || c.light === 'neon' ? rng('Richtung', x('lAngle'), -180, 180, 1, (z) => z + '°', set(c, 'lAngle')) : null,
        c.light === 'neon' ? rng('Länge der Röhre', x('lLen'), 2, 150, 1, (z) => z + ' %', set(c, 'lLen')) : null,
        rng('Weiche Kante', x('lSoft'), 0, 100, 1, (z) => z + ' %', set(c, 'lSoft')),
        rng('Szene abdunkeln', x('lDim'), 0, 90, 1, pct, set(c, 'lDim')),
        rng('Nebel im Licht', x('lFog'), 0, 100, 1, pct, set(c, 'lFog')),
        rng('Flackern', x('lFlicker'), 0, 100, 1, pct, set(c, 'lFlicker')),
        c.light === 'spot' ? rng('Schwenken', x('lSweep'), 0, 60, 1, (z) => (z ? '±' + z + '°' : 'aus'), set(c, 'lSweep')) : null,
        c.light === 'spot' && x('lSweep') ? rng('Dauer eines Schwenks', x('lSweepSpeed'), 1, 30, 0.5, (z) => z + ' s', set(c, 'lSweepSpeed')) : null,
        el('div', { class: 'sec-title', style: { marginTop: '6px' } }, VN.t('Auf den Figuren')),
        rng('Kantenlicht', x('lRim'), 0, 100, 1, pct, set(c, 'lRim')),
        c.light !== 'back' ? rng('Farbschimmer', x('lTint'), 0, 100, 1, pct, set(c, 'lTint')) : null,
        c.light === 'back' ? rng('Silhouette (wie dunkel)', x('lSil'), 0, 100, 1, (z) => (z ? z + ' %' : 'Figur normal'), set(c, 'lSil')) : null,
        el('div', { class: 'sec-title', style: { marginTop: '6px' } }, VN.t('Staub im Licht')),
        check('Staubflusen schweben im Licht', x('lDust'), set(c, 'lDust')),
        x('lDust') ? rng('Menge', x('lDustAmt'), 5, 100, 1, (z) => z + ' %', set(c, 'lDustAmt')) : null,
        x('lDust') ? rng('Größe der Flusen', x('lDustSize'), 10, 120, 1, (z) => z + ' %', set(c, 'lDustSize')) : null,
        rng('Tiefe (Parallax)', x('lDepth'), 0, 1.5, 0.05, (z) => Number(z).toFixed(2), set(c, 'lDepth')),
        el('div', { class: 'muted small' }, c.light === 'back'
          ? 'Gegenlicht liegt hinter den Figuren: Sie werden zur Silhouette mit leuchtendem Saum und einem Schein in der Lichtfarbe. Mit „Silhouette“ einstellen, wie gut die Figur noch zu erkennen ist.'
          : 'Die Lampe auf der Bühne mit der Maus verschieben; beim Scheinwerfer und der Neonröhre zeigt der zweite Punkt Richtung und Reichweite. Figuren bekommen Licht von der Seite, auf der die Lampe steht.')
      ];
      return out.filter(Boolean);
    }
  });
})();
