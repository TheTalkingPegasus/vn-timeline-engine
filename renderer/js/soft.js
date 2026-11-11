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
    cheeks: { label: 'Wangen', k: 220, c: 9, inert: 0.7, xs: 0.4, ys: 1, anchor: '', anchorAmt: 0, idle: '', idleAmp: 0, idleSpeed: 1, squash: 0.4, feather: 0.5, strength: 0.6, over: 0 },
    jelly: { label: 'Gelee / Schleim', k: 60, c: 2, inert: 1.2, xs: 1, ys: 1, anchor: 'bottom', anchorAmt: 0.6, idle: 'breathe', idleAmp: 0.6, idleSpeed: 2, squash: 1, feather: 0.45, strength: 1.2, over: 0 }
  };
  const ANCHORS = [['', 'Frei schwebend'], ['top', 'Oben fest'], ['bottom', 'Unten fest'], ['left', 'Links fest'], ['right', 'Rechts fest']];
  const IDLES = [['', 'Keine'], ['breathe', 'Atmen (auf & ab)'], ['sway', 'Schwanken (seitlich)'], ['wave', 'Welle (wehen)']];
  const PAD = 0.08; // Rand um das Bild, damit Bereiche über die Bildkante schwingen dürfen
  const GRID = 46;  // Gitterpunkte über die Bildbreite
  const ACC = 0.25; // wie stark Beschleunigung der Figur auf die Bereiche wirkt

  const Soft = (window.Soft = {
    PRESETS, ANCHORS, IDLES, PAD,

    data(assetId) { const s = VN.project && VN.project.softs && VN.project.softs[assetId]; return s || null; },
    cfg(assetId) {
      const s = Soft.data(assetId);
      if (!s || s.on === false || !(s.regions && s.regions.some((r) => r.on !== false))) return null;
      return s;
    },
    // Werte eines Bereichs: Vorlage + eigene Anpassungen
    par(r) { return Object.assign({}, PRESETS[r.preset] || PRESETS.chest, r); },
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
      dt = Math.min(0.05, Math.max(0, dt || 0));
      const kick = sim.poke.splice(0);
      for (const r of regions) {
        const P = Soft.par(r);
        const s = sim.regs[r.id] || (sim.regs[r.id] = { x: 0, y: 0, vx: 0, vy: 0 });
        for (const k of kick) { s.vx += k.x * (P.xs || 1); s.vy += k.y * (P.ys || 1); }
        const k = Math.max(1, Number(P.k) || 90), c = Math.max(0, Number(P.c) || 5), inert = Number(P.inert) || 1;
        // kleine Unterschritte für stabile Federn
        const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
        for (let i = 0; i < n; i++) {
          const fx = -k * s.x - c * s.vx - acc.x * inert * (P.xs != null ? P.xs : 1) * ACC;
          const fy = -k * s.y - c * s.vy - acc.y * inert * (P.ys != null ? P.ys : 1) * ACC;
          s.vx += fx * h; s.vy += fy * h; s.x += s.vx * h; s.y += s.vy * h;
        }
        const lim = 0.6; s.x = Math.max(-lim, Math.min(lim, s.x)); s.y = Math.max(-lim, Math.min(lim, s.y));
      }
    },
    poke(sim, dir, amount) {
      const a = (Number(amount) || 1) * 0.22;
      const d = dir === 'up' ? [0, -1] : dir === 'left' ? [-1, 0] : dir === 'right' ? [1, 0] : dir === 'random' ? [Math.random() * 2 - 1, Math.random() * 2 - 1] : [0, 1];
      sim.poke.push({ x: d[0] * a, y: d[1] * a });
    },

    // Verschiebung (in Bildbruchteilen) eines Bereichs zum Zeitpunkt t
    regionMove(r, P, s, t) {
      const st = (Number(P.strength) != null ? Number(P.strength) : 1);
      let dx = (s ? s.x : 0) * st, dy = (s ? s.y : 0) * st;
      const amp = (Number(P.idleAmp) || 0) * 0.012, sp = (Number(P.idleSpeed) || 1) * Math.PI * 2 / 3;
      const ph = (r.cx || 0) * 7 + (r.cy || 0) * 3;
      let idleY = 0, idleX = 0, wave = 0;
      if (P.idle === 'breathe') idleY = Math.sin(t * sp + ph * 0.2) * amp;
      else if (P.idle === 'sway') idleX = Math.sin(t * sp + ph) * amp * 1.4;
      else if (P.idle === 'wave') { idleX = Math.sin(t * sp + ph) * amp; wave = amp; }
      // Stauchen: nach unten gezogen → länger und schmaler, nach oben → kürzer und breiter
      const sq = Math.max(-0.35, Math.min(0.35, (dy + idleY * 0.6) * (Number(P.squash) || 0) * 4));
      return { dx: dx + idleX, dy: dy + idleY, sq, wave, t, sp };
    },

    // Gewicht eines Punkts (u, v in Bildbruchteilen) für einen Bereich
    // aspect = Breite/Höhe des Bilds, damit die Ellipse rund rechnet
    local(r, u, v, aspect) {
      const a = (r.rot || 0) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
      const x = (u - r.cx) * aspect, y = v - r.cy;
      const lx = (x * cs + y * sn) / Math.max(1e-4, r.rx * aspect), ly = (-x * sn + y * cs) / Math.max(1e-4, r.ry);
      return [lx, ly];
    },
    anchorW(P, lx, ly) {
      const amt = Math.max(0, Math.min(1, Number(P.anchorAmt) || 0));
      if (!P.anchor || !amt) return 1;
      const g = P.anchor === 'top' ? (ly + 1) / 2 : P.anchor === 'bottom' ? (1 - ly) / 2 : P.anchor === 'left' ? (lx + 1) / 2 : (1 - lx) / 2;
      const q = Math.max(0, Math.min(1, g));
      return 1 - amt + amt * q * q * (3 - 2 * q);
    },
    weight(P, lx, ly) {
      const d = Math.hypot(lx, ly);
      const f = Math.max(0.02, Math.min(0.95, Number(P.feather) != null ? Number(P.feather) : 0.4));
      const over = Math.max(0, Number(P.over) || 0);
      const inner = 1 - f, outer = 1 + over;
      if (d >= outer) return 0;
      let w = d <= inner ? 1 : 1 - smooth((d - inner) / (outer - inner));
      return w * Soft.anchorW(P, lx, ly);
    },
    // Verschiebung eines Punkts durch einen Bereich (mit Stauchen und Welle)
    disp(r, P, m, lx, ly, w, aspect) {
      const aw = Soft.anchorW(P, lx, ly);
      let dx = m.dx * w, dy = m.dy * w;
      if (m.sq) { dy += ly * r.ry * m.sq * w; dx -= lx * r.rx * m.sq * 0.5 * w; }
      if (m.wave) dx += Math.sin(m.t * m.sp * 1.3 - ly * 2.4) * m.wave * 0.8 * w * aw;
      return [dx, dy];
    },

    // ---------- Zeichnen (gemeinsamer WebGL-Kontext) ----------
    _texFor(img) {
      const S = gl0(); if (!S) return null;
      let e = TEX.get(img);
      if (e && e.gen === S.gen) return e.tex;
      const gl = S.gl, tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); } catch (e) { gl.deleteTexture(tex); TEX.set(img, { gen: S.gen, tex: null }); return null; }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      TEX.set(img, { gen: S.gen, tex });
      return tex;
    },
    // Bild mit Physik in ein 2D-Canvas (W×H inkl. Rand PAD) zeichnen. Gibt false zurück, wenn WebGL fehlt.
    render(out, img, cfg, sim, t) {
      const S = gl0();
      if (!S || !img.naturalWidth) return false;
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
      const aspect = img.naturalWidth / img.naturalHeight;
      const regs = cfg.regions.filter((r) => r.on !== false);
      const moves = regs.map((r) => { const P = Soft.par(r); return { r, P, m: Soft.regionMove(r, P, sim.regs[r.id], t) }; });
      // 1) Grundbild: Gitter über das ganze Bild, nur Punkte in Masken bewegen sich
      const gw = GRID, gh = Math.max(8, Math.round(GRID / aspect));
      const mesh = baseMesh(gw, gh);
      const pos = mesh.pos;
      for (let j = 0, k = 0; j <= gh; j++) {
        for (let i = 0; i <= gw; i++, k++) {
          const u = i / gw, v = j / gh;
          let dx = 0, dy = 0;
          for (const { r, P, m } of moves) {
            const L = Soft.local(r, u, v, aspect);
            const w = Soft.weight(P.layer ? Object.assign({}, P, { over: 0 }) : P, L[0], L[1]);
            if (w <= 0) continue;
            const d = Soft.disp(r, P, m, L[0], L[1], w, aspect);
            dx += d[0]; dy += d[1];
          }
          pos[k * 2] = ox + (u + dx) * iw; pos[k * 2 + 1] = oy + (v + dy) * ih;
        }
      }
      drawMesh(S, mesh, 1);
      // 2) Bereiche als eigene Ebene: Kopie des Bereichs, weich ausgeblendet, oben drauf
      for (const { r, P, m } of moves) {
        if (!P.layer) continue;
        const lm = layerMesh(r, P, m, aspect, iw, ih, ox, oy);
        drawMesh(S, lm, 0);
      }
      const ctx = out.getContext('2d');
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(S.cv, 0, 0, W, H, 0, 0, W, H);
      return true;
    },

    // ---------- Story-Bühne: Canvas statt <img> ----------
    // inner = span.char-inner mit <img>. Das Bild bleibt (unsichtbar) für die Größe, das Canvas liegt darüber.
    attach(inner, assetId) {
      const cfg = Soft.cfg(assetId);
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
      tex.onload = () => { (tex.decode ? tex.decode() : Promise.resolve()).catch(() => {}).then(() => { inst.ready = true; }); };
      tex.src = img.currentSrc || img.src;
      LIVE.add(inst);
      loop();
      return inst;
    },
    // Anstoß für alle sichtbaren Figuren (Aktion „Weich anstoßen“) oder nur für ein Bild
    pokeAll(dir, amount, assetId) {
      for (const it of LIVE) if (!assetId || it.assetId === assetId) Soft.poke(it.sim, dir, amount);
      for (const sim of ANIMS) if (!assetId || sim._asset === assetId) Soft.poke(sim, dir, amount);
    },

    // ---------- Zwischensequenzen: in den Anim-Canvas zeichnen ----------
    // it = Darsteller-Zustand aus Anim.draw; x,y,w,h = Zielrechteck (lokal); world = Mittelpunkt in Figurenhöhen
    drawAnim(ctx, it, assetId, x, y, w, h, t, world) {
      const cfg = Soft.cfg(assetId);
      if (!cfg || !it.img) return false;
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
      if (!Soft.render(off, it.img, cfg, sim, t)) return false;
      ctx.drawImage(off, x - w * PAD, y - h * PAD, w * (1 + 2 * PAD), h * (1 + 2 * PAD));
      return true;
    }
  });

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
  const LG = 18;
  const LIDX = gridIdx(LG, LG);
  function layerMesh(r, P, m, aspect, iw, ih, ox, oy) {
    const N = (LG + 1) * (LG + 1), pos = new Float32Array(N * 2), uv = new Float32Array(N * 2), al = new Float32Array(N);
    const a = (r.rot || 0) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    const f = Math.max(0.05, Math.min(0.95, Number(P.feather) != null ? Number(P.feather) : 0.4));
    for (let j = 0, k = 0; j <= LG; j++) for (let i = 0; i <= LG; i++, k++) {
      const lx = (i / LG) * 2 - 1, ly = (j / LG) * 2 - 1;
      // lokale Ellipse → Bildkoordinaten
      const x = lx * r.rx * aspect, y = ly * r.ry;
      const u = r.cx + (x * cs - y * sn) / aspect, v = r.cy + (x * sn + y * cs);
      const d = Math.hypot(lx, ly);
      const alpha = d >= 1 ? 0 : d <= 1 - f ? 1 : 1 - smooth((d - (1 - f)) / f);
      const aw = Soft.anchorW(P, lx, ly);
      const dd = Soft.disp(r, P, m, lx, ly, 1, aspect);
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
        if (!it.cv.isConnected) { LIVE.delete(it); continue; }
        const cfg = Soft.cfg(it.assetId);
        if (!cfg || !it.ready) continue;
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
        const ok = Soft.render(it.cv, it.tex, cfg, it.sim, now / 1000 - it.sim.t0);
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
      text: (a) => '〰 ' + VN.t('Weich anstoßen') + ' (' + VN.t({ down: 'nach unten', up: 'nach oben', left: 'nach links', right: 'nach rechts', random: 'zufällig' }[a.dir || 'down']) + ')',
      row: (row, a, sel) => {
        row.appendChild(sel(a.dir || 'down', [['down', 'nach unten'], ['up', 'nach oben'], ['left', 'nach links'], ['right', 'nach rechts'], ['random', 'zufällig']], (v) => VN.mutate(() => { a.dir = v; })));
        row.appendChild(el('input', { type: 'number', step: '0.1', min: '0', value: a.amount != null ? a.amount : 1, style: { width: '70px' }, title: VN.t('Stärke'), onchange: (e) => VN.mutate(() => { a.amount = Number(e.target.value) || 0; }) }));
        const s = VN.assetSelect('image', a.asset || '', (v) => VN.mutate(() => { a.asset = v; }));
        s.style.maxWidth = '160px'; s.title = VN.t('nur dieses Bild (leer = alle)');
        row.appendChild(s);
      }
    });
  }
})();
