// Bones: Bild analysieren, Gitter bauen, Knochen-Gewichte, Verformung per WebGL
(function () {
  const PAD = 0.15;          // Rand um das Bild, damit Bewegungen nicht abgeschnitten werden
  const MAX_TEX = 1024;
  const analyzeCache = {};   // assetId -> Promise<{w,h,canvas,alpha,bbox}>
  const meshCache = {};      // assetId+key -> mesh
  const live = new Set();    // aktive Canvas-Instanzen
  let rafOn = false;

  const Rig = (window.Rig = {
    PAD,
    has(assetId) {
      const r = VN.project && VN.project.rigs[assetId];
      return !!(r && r.bones && r.bones.length);
    },
    get(assetId) { return VN.project.rigs[assetId]; },

    // Bild laden, Größe bestimmen, Transparenz auslesen
    analyze(assetId) {
      const url = VN.assetUrl(assetId);
      const key = assetId + '|' + url;
      if (analyzeCache[key]) return analyzeCache[key];
      analyzeCache[key] = (async () => {
        const a = VN.asset(assetId);
        let w = 0, h = 0;
        if (a && /\.svg$/i.test(a.file)) {
          try {
            const txt = await (await fetch(url)).text();
            const vb = txt.match(/viewBox\s*=\s*["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
            if (vb) { w = parseFloat(vb[3]); h = parseFloat(vb[4]); }
            const wm = txt.match(/<svg[^>]*\swidth\s*=\s*["']([\d.]+)/i), hm = txt.match(/<svg[^>]*\sheight\s*=\s*["']([\d.]+)/i);
            if (!w && wm && hm) { w = parseFloat(wm[1]); h = parseFloat(hm[1]); }
          } catch (e) { /* weiter mit Bildgröße */ }
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        await img.decode();
        if (!w || !h) { w = img.naturalWidth || 512; h = img.naturalHeight || 512; }
        const sc = Math.min(1, MAX_TEX / Math.max(w, h)) * (Math.max(w, h) < 400 ? 2 : 1);
        w = Math.round(w * sc); h = Math.round(h * sc);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        let alpha;
        try {
          const d = ctx.getImageData(0, 0, w, h).data;
          alpha = new Uint8Array(w * h);
          for (let i = 0; i < w * h; i++) alpha[i] = d[i * 4 + 3];
        } catch (e) {
          alpha = new Uint8Array(w * h).fill(255);
        }
        let x0 = w, y0 = h, x1 = 0, y1 = 0;
        for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (alpha[y * w + x] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 <= x0) { x0 = 0; y0 = 0; x1 = w; y1 = h; }
        return { w, h, canvas: cv, alpha, bbox: { x: x0 / w, y: y0 / h, w: (x1 - x0) / w, h: (y1 - y0) / h } };
      })();
      return analyzeCache[key];
    },

    // Gitter über den sichtbaren Teil des Bildes
    async mesh(assetId) {
      const info = await Rig.analyze(assetId);
      const rig = Rig.get(assetId);
      const res = rig && rig.grid ? rig.grid : 40;
      const key = assetId + '|' + res + '|' + info.w;
      if (!meshCache[key]) {
        const { w, h, alpha } = info;
        const cell = Math.max(w, h) / res;
        const nx = Math.ceil(w / cell), ny = Math.ceil(h / cell);
        const filled = new Uint8Array(nx * ny);
        for (let cy = 0; cy < ny; cy++) for (let cx = 0; cx < nx; cx++) {
          let hit = false;
          for (let sy = 0; sy < 5 && !hit; sy++) for (let sx = 0; sx < 5 && !hit; sx++) {
            const px = Math.min(w - 1, Math.floor((cx + sx / 4) * cell)), py = Math.min(h - 1, Math.floor((cy + sy / 4) * cell));
            if (alpha[py * w + px] > 8) hit = true;
          }
          filled[cy * nx + cx] = hit ? 1 : 0;
        }
        // Rand um 1 Zelle erweitern, damit nichts abgeschnitten wird
        const grow = filled.slice();
        for (let cy = 0; cy < ny; cy++) for (let cx = 0; cx < nx; cx++) {
          if (filled[cy * nx + cx]) continue;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const x = cx + dx, y = cy + dy;
            if (x >= 0 && y >= 0 && x < nx && y < ny && filled[y * nx + x]) grow[cy * nx + cx] = 1;
          }
        }
        const vmap = new Map();
        const pos = [], uv = [], idx = [];
        const vert = (gx, gy) => {
          const k = gy * (nx + 1) + gx;
          if (vmap.has(k)) return vmap.get(k);
          const x = Math.min(w, gx * cell), y = Math.min(h, gy * cell);
          const i = pos.length / 2;
          pos.push(x, y);
          uv.push(x / w, y / h);
          vmap.set(k, i);
          return i;
        };
        for (let cy = 0; cy < ny; cy++) for (let cx = 0; cx < nx; cx++) {
          if (!grow[cy * nx + cx]) continue;
          const a = vert(cx, cy), b = vert(cx + 1, cy), c = vert(cx + 1, cy + 1), d = vert(cx, cy + 1);
          idx.push(a, b, c, a, c, d);
        }
        meshCache[key] = { w, h, pos: new Float32Array(pos), uv: new Float32Array(uv), idx: new Uint16Array(idx), count: pos.length / 2 };
      }
      return { info, mesh: meshCache[key] };
    },

    // Gewichte: jeder Punkt folgt den nächsten Knochen, Pins halten fest
    weights(mesh, rig) {
      const { w, h, pos, count } = mesh;
      const bones = rig.bones;
      const B = bones.length;
      const K = Math.min(3, B);
      const bi = new Int16Array(count * 3).fill(-1);
      const bw = new Float32Array(count * 3);
      const pin = new Float32Array(count);
      const scale = Math.max(w, h);
      const pinR = 0.07 * scale;
      for (let v = 0; v < count; v++) {
        const x = pos[v * 2], y = pos[v * 2 + 1];
        const ds = [];
        for (let b = 0; b < B; b++) {
          const bo = bones[b];
          const ax = bo.hx * w, ay = bo.hy * h, bx = bo.tx * w, by = bo.ty * h;
          const dx = bx - ax, dy = by - ay;
          const L2 = dx * dx + dy * dy || 1;
          let t = ((x - ax) * dx + (y - ay) * dy) / L2;
          t = Math.max(0, Math.min(1, t));
          const px = ax + dx * t - x, py = ay + dy * t - y;
          const d = Math.sqrt(px * px + py * py) / scale + 0.004;
          ds.push([b, 1 / Math.pow(d, 4)]);
        }
        ds.sort((a, b) => b[1] - a[1]);
        let sum = 0;
        for (let k = 0; k < K; k++) sum += ds[k][1];
        for (let k = 0; k < K; k++) { bi[v * 3 + k] = ds[k][0]; bw[v * 3 + k] = ds[k][1] / sum; }
        let p = 0;
        for (const pn of rig.pins || []) {
          const d = Math.hypot(pn.x * w - x, pn.y * h - y);
          p = Math.max(p, 1 - d / pinR);
        }
        pin[v] = Math.max(0, Math.min(1, p));
      }
      // Von Hand gemalte Gewichte: pro Knochen ein 64×64-Raster mit Zu-/Abschlägen
      const paint = rig.paint && Object.keys(rig.paint).length ? Rig.paintMaps(rig) : null;
      if (paint) {
        for (let v = 0; v < count; v++) {
          const u = pos[v * 2] / w, t = pos[v * 2 + 1] / h;
          const m = new Map();
          for (let k = 0; k < K; k++) if (bi[v * 3 + k] >= 0) m.set(bi[v * 3 + k], bw[v * 3 + k]);
          let touched = false;
          for (const [b, grid] of paint) {
            const d = Rig.sampleGrid(grid, u, t);
            if (Math.abs(d) < 0.004) continue;
            touched = true;
            m.set(b, Math.max(0, Math.min(1, (m.get(b) || 0) + d)));
          }
          if (!touched) continue;
          const arr = Array.from(m.entries()).filter((x) => x[1] > 0.001).sort((a, b) => b[1] - a[1]).slice(0, 3);
          let sum = arr.reduce((s, x) => s + x[1], 0);
          if (sum < 0.001) continue;   // alles weggemalt: automatische Gewichte behalten
          for (let k = 0; k < 3; k++) { bi[v * 3 + k] = arr[k] ? arr[k][0] : -1; bw[v * 3 + k] = arr[k] ? arr[k][1] / sum : 0; }
        }
      }
      return { bi, bw, pin };
    },
    // ---------- Gewichte malen ----------
    PG: 64,
    decodeGrid(str) {
      const g = new Float32Array(Rig.PG * Rig.PG);
      if (!str) return g;
      try { const bin = atob(str); for (let i = 0; i < g.length && i < bin.length; i++) g[i] = (bin.charCodeAt(i) - 128) / 100; } catch (e) { /* kaputt: leer */ }
      return g;
    },
    encodeGrid(g) {
      let s = '';
      for (let i = 0; i < g.length; i++) s += String.fromCharCode(Math.max(0, Math.min(255, Math.round(g[i] * 100) + 128)));
      return btoa(s);
    },
    paintMaps(rig) {
      const out = [];
      for (const [id, str] of Object.entries(rig.paint || {})) {
        const b = rig.bones.findIndex((x) => x.id === id);
        if (b >= 0) out.push([b, typeof str === 'string' ? Rig.decodeGrid(str) : str]);
      }
      return out;
    },
    sampleGrid(g, u, v) {
      const N = Rig.PG;
      const x = Math.max(0, Math.min(N - 1.001, u * N - 0.5)), y = Math.max(0, Math.min(N - 1.001, v * N - 0.5));
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      const a = g[y0 * N + x0], b = g[y0 * N + x0 + 1], c = g[(y0 + 1) * N + x0], d = g[(y0 + 1) * N + x0 + 1];
      return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    },
    // Pinselstrich ins Raster: mode add / sub / smooth, r und Mitte in 0..1 (Bildkoordinaten)
    brush(g, u, v, r, strength, mode, aspect) {
      const N = Rig.PG;
      const rx = r * N, ry = r * N * (aspect || 1);
      const cx = u * N - 0.5, cy = v * N - 0.5;
      const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(N - 1, Math.ceil(cx + rx));
      const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(N - 1, Math.ceil(cy + ry));
      const src = mode === 'smooth' ? g.slice() : null;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        if (d > 1) continue;
        const f = (1 - d * d) * strength;
        const i = y * N + x;
        if (mode === 'smooth') {
          let s = 0, n = 0;
          for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const xx = x + k, yy = y + j; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; s += src[yy * N + xx]; n++; }
          g[i] = g[i] + (s / n - g[i]) * Math.min(1, f * 2);
        } else g[i] = Math.max(-1, Math.min(1, g[i] + (mode === 'sub' ? -f : f) * 0.25));
      }
    },

    // Reihenfolge Eltern vor Kindern
    order(rig) {
      const out = [], seen = new Set();
      const visit = (b) => {
        if (seen.has(b.id)) return;
        const par = rig.bones.find((x) => x.id === b.parent);
        if (par) visit(par);
        seen.add(b.id);
        out.push(b);
      };
      rig.bones.forEach(visit);
      return out;
    },

    // Pose berechnen: Matrizen pro Knochen
    pose(rig, w, h, t, dt, phys, amp, extra) {
      const g = rig.global || {};
      const mats = {};
      const rnd = Number(g.random) || 0;
      const bb = rig.bbox || { x: 0, y: 0, w: 1, h: 1 };
      const pivX = (bb.x + bb.w / 2) * w, pivY = (bb.y + bb.h) * h;
      const sway = g.sway && g.sway.on ? (Number(g.sway.amp) || 1) * Math.PI / 180 * Math.sin(2 * Math.PI * t / (Number(g.sway.speed) || 6)) * amp : 0;
      const rootM = rot(sway, pivX, pivY);
      for (const b of Rig.order(rig)) {
        const parentM = b.parent && mats[b.parent] ? mats[b.parent] : rootM;
        const hx = b.hx * w, hy = b.hy * h;
        let ang = 0;
        const m = b.motion || {};
        const seed = hashStr(b.id);
        if (m.type === 'swing') ang += (Number(m.amp) || 8) * Math.PI / 180 * Math.sin(2 * Math.PI * t / (Number(m.speed) || 2.5) + (Number(m.phase) || 0) * Math.PI / 180) * amp;
        if (rnd) ang += rnd * 0.05 * Math.sin(t * (0.6 + (seed % 7) / 10) + seed) * amp;
        // Zusätzliche Drehung aus Animationen (Grad, nach Knochen-Name)
        if (extra && extra[b.name]) ang += extra[b.name] * Math.PI / 180;
        const ph = b.physics || {};
        if (ph.on) {
          const st = phys[b.id] || (phys[b.id] = { a: 0, v: 0, px: null, py: null, vx: 0, vy: 0 });
          const wx = parentM[0] * hx + parentM[2] * hy + parentM[4];
          const wy = parentM[1] * hx + parentM[3] * hy + parentM[5];
          if (st.px !== null && dt > 0) {
            const vx = (wx - st.px) / dt, vy = (wy - st.py) / dt;
            const ax = (vx - st.vx) / dt, ay = (vy - st.vy) / dt;
            st.vx = vx; st.vy = vy;
            const dx = (b.tx - b.hx) * w, dy = (b.ty - b.hy) * h;
            const L = Math.hypot(dx, dy) || 1;
            const dirx = (parentM[0] * dx + parentM[2] * dy) / L, diry = (parentM[1] * dx + parentM[3] * dy) / L;
            const torque = (dirx * -ay - diry * -ax) * 0.00012;
            const wind = (Number(ph.wind) || 0) * 0.02 * (Math.sin(t * 1.3 + seed) + 0.5 * Math.sin(t * 3.7 + seed * 2));
            const k = 6 + 60 * (ph.stiff != null ? Number(ph.stiff) : 0.5);
            const d = 1 + 10 * (ph.damp != null ? Number(ph.damp) : 0.3);
            st.v += (-k * st.a - d * st.v + torque * k + wind * k) * dt;
            st.a += st.v * dt;
            const lim = 0.9;
            if (st.a > lim) { st.a = lim; st.v = 0; } else if (st.a < -lim) { st.a = -lim; st.v = 0; }
          }
          st.px = wx; st.py = wy;
          ang += st.a;
        }
        mats[b.id] = mul(parentM, rot(ang, hx, hy));
      }
      return mats;
    },

    // Verformte Punkte berechnen
    skin(mesh, wts, rig, mats, out, t, amp) {
      const { pos, count, w, h } = mesh;
      const order = rig.bones;
      const M = order.map((b) => mats[b.id]);
      const g = rig.global || {};
      const bb = rig.bbox || { x: 0, y: 0, w: 1, h: 1 };
      const bottom = (bb.y + bb.h) * h, cx = (bb.x + bb.w / 2) * w;
      const br = g.breathe && g.breathe.on ? (Number(g.breathe.amp) || 2) / 100 * Math.sin(2 * Math.PI * t / (Number(g.breathe.speed) || 3.5)) * amp : 0;
      for (let v = 0; v < count; v++) {
        const x = pos[v * 2], y = pos[v * 2 + 1];
        let nx = 0, ny = 0;
        for (let k = 0; k < 3; k++) {
          const b = wts.bi[v * 3 + k];
          if (b < 0) continue;
          const wt = wts.bw[v * 3 + k], m = M[b];
          nx += wt * (m[0] * x + m[2] * y + m[4]);
          ny += wt * (m[1] * x + m[3] * y + m[5]);
        }
        const p = wts.pin[v];
        nx = p * x + (1 - p) * nx;
        ny = p * y + (1 - p) * ny;
        if (br) {
          const f = Math.max(0, (bottom - ny) / (bottom || 1));
          ny = bottom - (bottom - ny) * (1 + br * f);
          nx = cx + (nx - cx) * (1 + br * 0.35 * f);
        }
        out[v * 2] = nx + w * PAD;
        out[v * 2 + 1] = ny + h * PAD;
      }
    },

    // Canvas, das die Figur verformt und animiert darstellt
    canvasFor(assetId, clip, opts = {}) {
      const cv = document.createElement('canvas');
      cv.className = 'rig-canvas';
      cv.style.height = (100 * (1 + 2 * PAD)) + '%';
      cv.style.bottom = (-100 * PAD) + '%';
      cv.style.transform = 'translateX(-50%)';
      cv.width = 10; cv.height = 10;
      const inst = { cv, assetId, amp: (clip && clip.boneAmp != null ? clip.boneAmp : 100) / 100, phys: {}, static: !!opts.static, manual: !!opts.manual, extraFn: opts.extraFn || null, t0: performance.now() / 1000 };
      cv._inst = inst;
      let readyRes;
      inst.ready = new Promise((r) => { readyRes = r; });
      Rig.mesh(assetId).then(({ info, mesh }) => {
        const rig = Rig.get(assetId);
        if (!rig) return;
        rig.bbox = info.bbox;
        inst.rig = rig;
        inst.mesh = mesh;
        inst.wts = Rig.weights(mesh, rig);
        inst.out = new Float32Array(mesh.count * 2);
        cv.width = Math.round(mesh.w * (1 + 2 * PAD));
        cv.height = Math.round(mesh.h * (1 + 2 * PAD));
        let glOk = false;
        try { glOk = !window.__vnRig2D && initGL(inst, info.canvas); } catch (e) { glOk = false; }
        if (!glOk) {
          // Ohne WebGL: langsamere, aber überall laufende Canvas-2D-Variante
          inst.ctx2d = cv.getContext('2d');
          inst.tex = info.canvas;
          if (!inst.ctx2d) return;
        }
        // Blinzeln in die Textur zeichnen
        const bc = window.Blink && !inst.static ? Blink.cfg(assetId) : null;
        if (bc) {
          const tex = document.createElement('canvas');
          tex.width = info.w; tex.height = info.h;
          inst.blink = { cfg: bc, state: Blink.newState(bc), base: info.canvas, tex, last: -1, closed: null };
          if (bc.mode === 'image') { const im = new Image(); im.crossOrigin = 'anonymous'; im.src = VN.assetUrl(bc.image); im.decode().then(() => { inst.blink.closed = im; }).catch(() => {}); }
        }
        inst.ok = true;
        readyRes(inst);
        if (inst.manual) return;
        live.add(inst);
        drawFrame(inst, performance.now() / 1000, 0);
        startLoop();
      }).catch((e) => { console.warn('Bones konnten nicht geladen werden', e); readyRes(null); });
      return cv;
    },
    // Von außen gesteuert zeichnen (Animations-Editor, Video-Export): Zeit t in Sekunden
    renderAt(inst, t, dt, extra) {
      if (!inst || !inst.ok) return null;
      inst.manualExtra = extra || null;
      drawFrame(inst, inst.t0 + t, dt || 0, true);
      return inst.lastMats;
    },
    // Gelenkpunkte nach der Pose (Bild-Pixel ohne Rand)
    jointPos(inst) {
      if (!inst || !inst.lastMats || !inst.rig) return [];
      const { w, h } = inst.mesh;
      return inst.rig.bones.map((b) => {
        const m = inst.lastMats[b.id];
        const ap = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
        const [hx, hy] = ap(b.hx * w, b.hy * h), [tx, ty] = ap(b.tx * w, b.ty * h);
        return { b, hx, hy, tx, ty };
      });
    },

    // Nach Änderungen am Rig: Gewichte neu berechnen
    refresh(assetId) {
      for (const inst of live) {
        if (inst.assetId !== assetId || !inst.mesh) continue;
        inst.rig = Rig.get(assetId);
        if (!inst.rig) continue;
        inst.wts = Rig.weights(inst.mesh, inst.rig);
        inst.phys = {};
      }
    },

    // Vorlagen
    TEMPLATES: {
      biped: { label: 'Zweibeiner', desc: 'Menschen, aufrechte Figuren' },
      quad: { label: 'Vierbeiner', desc: 'Pferde, Ponys, Hunde (Seitenansicht)' },
      winged: { label: 'Geflügelt', desc: 'Vögel, Greife (Frontansicht)' },
      chain: { label: 'Kette', desc: 'Schlangen, Tentakel, Fische' },
      empty: { label: 'Leer', desc: 'Alles selbst zeichnen' }
    },
    template(kind, bbox) {
      const bones = [];
      const P = (u, v) => [bbox.x + u * bbox.w, bbox.y + v * bbox.h];
      const add = (name, parent, a, b, extra) => {
        const id = 'b_' + Math.random().toString(36).slice(2, 8);
        const [hx, hy] = P(a[0], a[1]), [tx, ty] = P(b[0], b[1]);
        bones.push(Object.assign({ id, name, parent: parent || null, hx, hy, tx, ty, kind: 'body', motion: { type: 'none', amp: 8, speed: 2.5, phase: 0 }, physics: { on: false, stiff: 0.5, damp: 0.3, wind: 0 } }, extra || {}));
        return id;
      };
      const pins = [];
      const global = { breathe: { on: true, amp: 2, speed: 3.6 }, sway: { on: true, amp: 0.8, speed: 6 }, random: 0.3 };
      if (kind === 'biped') {
        const hip = add('Hüfte', null, [0.5, 0.56], [0.5, 0.36]);
        const chest = add('Brust', hip, [0.5, 0.36], [0.5, 0.24]);
        const neck = add('Hals', chest, [0.5, 0.24], [0.5, 0.17]);
        add('Kopf', neck, [0.5, 0.17], [0.5, 0.02]);
        for (const [s, side] of [[-1, 'L'], [1, 'R']]) {
          const sh = add('Schulter ' + side, chest, [0.5, 0.26], [0.5 + s * 0.2, 0.28]);
          const ua = add('Oberarm ' + side, sh, [0.5 + s * 0.2, 0.28], [0.5 + s * 0.27, 0.45]);
          add('Unterarm ' + side, ua, [0.5 + s * 0.27, 0.45], [0.5 + s * 0.29, 0.62]);
          const th = add('Oberschenkel ' + side, hip, [0.5, 0.56], [0.5 + s * 0.09, 0.78]);
          add('Unterschenkel ' + side, th, [0.5 + s * 0.09, 0.78], [0.5 + s * 0.1, 0.98]);
          pins.push({ x: P(0.5 + s * 0.1, 0.99)[0], y: P(0.5 + s * 0.1, 0.99)[1] });
        }
      } else if (kind === 'quad') {
        const pel = add('Becken', null, [0.72, 0.42], [0.5, 0.4]);
        const chest = add('Brustkorb', pel, [0.5, 0.4], [0.3, 0.4]);
        const neck = add('Hals', chest, [0.3, 0.4], [0.18, 0.24]);
        const head = add('Kopf', neck, [0.18, 0.24], [0.04, 0.2]);
        add('Ohr', head, [0.16, 0.14], [0.14, 0.02], { kind: 'hair', physics: { on: true, stiff: 0.6, damp: 0.3, wind: 0.2 } });
        const t1 = add('Schweif 1', pel, [0.8, 0.38], [0.9, 0.45], { kind: 'tail', motion: { type: 'swing', amp: 6, speed: 3, phase: 0 }, physics: { on: true, stiff: 0.4, damp: 0.25, wind: 0.3 } });
        add('Schweif 2', t1, [0.9, 0.45], [0.97, 0.62], { kind: 'tail', motion: { type: 'swing', amp: 8, speed: 3, phase: 60 }, physics: { on: true, stiff: 0.3, damp: 0.2, wind: 0.4 } });
        for (const [x, side] of [[0.28, 'vorne L'], [0.36, 'vorne R']]) {
          const u = add('Bein ' + side, chest, [x, 0.48], [x, 0.72]);
          add('Huf ' + side, u, [x, 0.72], [x, 0.98]);
          pins.push({ x: P(x, 0.99)[0], y: P(x, 0.99)[1] });
        }
        for (const [x, side] of [[0.68, 'hinten L'], [0.76, 'hinten R']]) {
          const u = add('Keule ' + side, pel, [x, 0.48], [x - 0.03, 0.7]);
          add('Sprunggelenk ' + side, u, [x - 0.03, 0.7], [x + 0.01, 0.98]);
          pins.push({ x: P(x + 0.01, 0.99)[0], y: P(x + 0.01, 0.99)[1] });
        }
        global.sway.amp = 0.4;
      } else if (kind === 'winged') {
        const body = add('Körper', null, [0.5, 0.72], [0.5, 0.38]);
        add('Kopf', body, [0.5, 0.38], [0.5, 0.1]);
        add('Schwanzfedern', body, [0.5, 0.72], [0.5, 0.98], { kind: 'tail', physics: { on: true, stiff: 0.5, damp: 0.3, wind: 0.3 } });
        for (const [s, side] of [[-1, 'L'], [1, 'R']]) {
          const w1 = add('Flügelarm ' + side, body, [0.5 + s * 0.08, 0.42], [0.5 + s * 0.28, 0.38], { kind: 'wing', motion: { type: 'swing', amp: 10 * s, speed: 2.2, phase: 0 } });
          add('Federn ' + side, w1, [0.5 + s * 0.28, 0.38], [0.5 + s * 0.48, 0.42], { kind: 'wing', physics: { on: true, stiff: 0.55, damp: 0.3, wind: 0.2 } });
        }
        pins.push({ x: P(0.5, 0.99)[0], y: P(0.5, 0.99)[1] });
      } else if (kind === 'chain') {
        let parent = null;
        for (let i = 0; i < 6; i++) {
          parent = add('Glied ' + (i + 1), parent, [0.04 + i * 0.153, 0.5], [0.04 + (i + 1) * 0.153, 0.5], { motion: { type: 'swing', amp: 7, speed: 2.4, phase: i * 50 } });
        }
        global.breathe.on = false;
        global.sway.on = false;
      }
      return { template: kind, bones, pins, global, grid: 40 };
    }
  });

  // ---------- Mathematik (2x3-Matrizen) ----------
  function rot(a, cx, cy) {
    const c = Math.cos(a), s = Math.sin(a);
    return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
  }
  function mul(m, n) {
    return [
      m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
    ];
  }
  function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h % 1000) / 100; }

  // ---------- WebGL ----------
  // ---------- Gemeinsamer WebGL-Kontext ----------
  // Alle Bones-Figuren teilen sich EIN verstecktes WebGL-Canvas. Jede Figur zeichnet dort ihr Bild
  // und kopiert es in ihr eigenes (2D-)Canvas. So gibt es keine Grenze von 16 WebGL-Kontexten mehr.
  const SH = { gl: null, cv: null, lost: false, gen: 0 };
  const glFree = typeof FinalizationRegistry !== 'undefined' ? new FinalizationRegistry((r) => releaseRes(r)) : null;
  function shared() {
    if (SH.gl && !SH.lost) return SH;
    if (SH.lost) return null;
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 1024;
    const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: false });
    if (!gl) return null;
    const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 p;attribute vec2 uv;uniform vec2 res;varying vec2 v;void main(){vec2 c=p/res*2.0-1.0;gl_Position=vec4(c.x,-c.y,0.0,1.0);v=uv;}'));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 v;uniform sampler2D t;void main(){gl_FragColor=texture2D(t,v);}'));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); SH.lost = true; });
    cv.addEventListener('webglcontextrestored', () => { SH.gl = null; SH.lost = false; SH.gen++; });
    Object.assign(SH, { gl, cv, prog, pLoc: gl.getAttribLocation(prog, 'p'), uvLoc: gl.getAttribLocation(prog, 'uv'), resLoc: gl.getUniformLocation(prog, 'res'), gen: SH.gen + 1 });
    gl.enableVertexAttribArray(SH.pLoc);
    gl.enableVertexAttribArray(SH.uvLoc);
    return SH;
  }
  function releaseRes(r) {
    if (!r || !SH.gl || r.gen !== SH.gen) return;
    const gl = SH.gl;
    gl.deleteBuffer(r.posBuf); gl.deleteBuffer(r.uvBuf); gl.deleteBuffer(r.ib); gl.deleteTexture(r.tex);
  }
  // GPU-Daten einer Figur im gemeinsamen Kontext anlegen (auch neu nach Kontextverlust)
  function glRes(inst) {
    const S = shared();
    if (!S) return null;
    if (inst.res && inst.res.gen === S.gen) return inst.res;
    const gl = S.gl;
    const r = { gen: S.gen, posBuf: gl.createBuffer(), uvBuf: gl.createBuffer(), ib: gl.createBuffer(), tex: gl.createTexture() };
    gl.bindBuffer(gl.ARRAY_BUFFER, r.uvBuf); gl.bufferData(gl.ARRAY_BUFFER, inst.mesh.uv, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, r.posBuf); gl.bufferData(gl.ARRAY_BUFFER, inst.out, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, r.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, inst.mesh.idx, gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D, r.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, inst.texSrc);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (inst.res) releaseRes(inst.res);
    inst.res = r;
    if (glFree) { if (inst.resToken) glFree.unregister(inst.resToken); inst.resToken = {}; glFree.register(inst.cv, r, inst.resToken); }
    return r;
  }
  // Bis zu OWN_MAX Figuren bekommen einen eigenen WebGL-Kontext (am schnellsten, keine Kopie).
  // Alle weiteren nutzen den gemeinsamen Kontext und kopieren ihr Bild. Chromium erlaubt nur 16 Kontexte.
  const OWN_MAX = 12;
  const own = new Set();
  function initOwnGL(inst, texCanvas) {
    const gl = inst.cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true });
    if (!gl) return false;
    const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 p;attribute vec2 uv;uniform vec2 res;varying vec2 v;void main(){vec2 c=p/res*2.0-1.0;gl_Position=vec4(c.x,-c.y,0.0,1.0);v=uv;}'));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 v;uniform sampler2D t;void main(){gl_FragColor=texture2D(t,v);}'));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const posBuf = gl.createBuffer(), uvBuf = gl.createBuffer(), ib = gl.createBuffer(), tex = gl.createTexture();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.bufferData(gl.ARRAY_BUFFER, inst.mesh.uv, gl.STATIC_DRAW);
    const uvLoc = gl.getAttribLocation(prog, 'uv'); gl.enableVertexAttribArray(uvLoc); gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, inst.out, gl.DYNAMIC_DRAW);
    const pLoc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(pLoc); gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, inst.mesh.idx, gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform2f(gl.getUniformLocation(prog, 'res'), inst.cv.width, inst.cv.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.viewport(0, 0, inst.cv.width, inst.cv.height);
    inst.cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); inst.ownLost = true; own.delete(inst); });
    inst.gl = gl; inst.posBuf = posBuf; inst.texObj = tex;
    own.add(inst);
    return true;
  }
  function freeOwn(inst) {
    if (!inst.gl) return;
    own.delete(inst);
    const ext = inst.gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    inst.gl = null;
  }
  function initGL(inst, texCanvas) {
    inst.texSrc = texCanvas;
    // Aufgeräumt: Kontexte von Figuren, die nicht mehr da sind (manuelle Instanzen ohne DOM ausgenommen)
    for (const o of own) if (!o.manual && !o.cv.isConnected && !live.has(o)) freeOwn(o);
    if (!inst.manual && own.size < OWN_MAX && initOwnGL(inst, texCanvas)) return true;
    if (!glRes(inst)) return false;
    inst.ctx = inst.cv.getContext('2d');
    inst.useGL = !!inst.ctx;
    return inst.useGL;
  }
  function drawGL(inst) {
    const S = shared();
    const r = S && glRes(inst);
    if (!r) return false;
    const gl = S.gl, w = inst.cv.width, h = inst.cv.height;
    if (S.cv.width < w || S.cv.height < h) { S.cv.width = Math.max(S.cv.width, w); S.cv.height = Math.max(S.cv.height, h); }
    gl.useProgram(S.prog);
    gl.viewport(0, 0, w, h);
    gl.uniform2f(S.resLoc, w, h);
    gl.bindBuffer(gl.ARRAY_BUFFER, r.uvBuf); gl.vertexAttribPointer(S.uvLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, r.posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst.out); gl.vertexAttribPointer(S.pLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, r.ib);
    gl.bindTexture(gl.TEXTURE_2D, r.tex);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, inst.mesh.idx.length, gl.UNSIGNED_SHORT, 0);
    // Der gezeichnete Bereich liegt unten links im gemeinsamen Canvas
    inst.ctx.clearRect(0, 0, w, h);
    inst.ctx.drawImage(S.cv, 0, S.cv.height - h, w, h, 0, 0, w, h);
    return true;
  }
  Rig.glStats = () => ({ own: own.size, shared: !!SH.gl, lost: SH.lost, size: SH.cv ? SH.cv.width + 'x' + SH.cv.height : '-', live: live.size });

  function draw2D(inst) {
    const ctx = inst.ctx2d, m = inst.mesh, src = m.pos, dst = inst.out, img = inst.tex;
    const ox = m.w * PAD, oy = m.h * PAD;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, inst.cv.width, inst.cv.height);
    for (let i = 0; i < m.idx.length; i += 3) {
      const a = m.idx[i], b = m.idx[i + 1], c = m.idx[i + 2];
      const s0x = src[a * 2], s0y = src[a * 2 + 1], s1x = src[b * 2], s1y = src[b * 2 + 1], s2x = src[c * 2], s2y = src[c * 2 + 1];
      let d0x = dst[a * 2], d0y = dst[a * 2 + 1], d1x = dst[b * 2], d1y = dst[b * 2 + 1], d2x = dst[c * 2], d2y = dst[c * 2 + 1];
      const denom = s0x * (s2y - s1y) - s1x * s2y + s2x * s1y + (s1x - s2x) * s0y;
      if (!denom) continue;
      const m11 = -(s0y * (d2x - d1x) - s1y * d2x + s2y * d1x + (s1y - s2y) * d0x) / denom;
      const m12 = (s1y * d2y + s0y * (d1y - d2y) - s2y * d1y + (s2y - s1y) * d0y) / denom;
      const m21 = (s0x * (d2x - d1x) - s1x * d2x + s2x * d1x + (s1x - s2x) * d0x) / denom;
      const m22 = -(s1x * d2y + s0x * (d1y - d2y) - s2x * d1y + (s2x - s1x) * d0y) / denom;
      const tx = (s0x * (s2y * d1x - s1y * d2x) + s0y * (s1x * d2x - s2x * d1x) + (s2x * s1y - s1x * s2y) * d0x) / denom;
      const ty = (s0x * (s2y * d1y - s1y * d2y) + s0y * (s1x * d2y - s2x * d1y) + (s2x * s1y - s1x * s2y) * d0y) / denom;
      // Dreieck minimal vergrößern gegen feine Nähte
      const cx = (d0x + d1x + d2x) / 3, cy = (d0y + d1y + d2y) / 3;
      const grow = (x, y) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1; return [x + dx / l * 0.7, y + dy / l * 0.7]; };
      [d0x, d0y] = grow(d0x, d0y); [d1x, d1y] = grow(d1x, d1y); [d2x, d2y] = grow(d2x, d2y);
      ctx.save();
      ctx.beginPath(); ctx.moveTo(d0x, d0y); ctx.lineTo(d1x, d1y); ctx.lineTo(d2x, d2y); ctx.closePath(); ctx.clip();
      ctx.transform(m11, m12, m21, m22, tx, ty);
      // Nur den Ausschnitt des Dreiecks zeichnen statt des ganzen Bildes (vielfach schneller)
      const bx0 = Math.max(0, Math.floor(Math.min(s0x, s1x, s2x) - 2)), by0 = Math.max(0, Math.floor(Math.min(s0y, s1y, s2y) - 2));
      const bx1 = Math.min(img.width, Math.ceil(Math.max(s0x, s1x, s2x) + 2)), by1 = Math.min(img.height, Math.ceil(Math.max(s0y, s1y, s2y) + 2));
      if (bx1 > bx0 && by1 > by0) ctx.drawImage(img, bx0, by0, bx1 - bx0, by1 - by0, bx0, by0, bx1 - bx0, by1 - by0);
      ctx.restore();
    }
    void ox; void oy;
  }

  function drawFrame(inst, now, dt, forced) {
    const { mesh, rig } = inst;
    const t = now - inst.t0;
    const extra = inst.manualExtra || (inst.extraFn ? inst.extraFn(now) : null);
    const mats = Rig.pose(rig, mesh.w, mesh.h, inst.static ? 0 : t, inst.static ? 0 : dt, inst.phys, inst.static ? 0 : inst.amp, extra);
    inst.lastMats = mats;
    Rig.skin(mesh, inst.wts, rig, mats, inst.out, inst.static ? 0 : t, inst.static ? 0 : inst.amp);
    if (inst.blink) {
      const bl = inst.blink;
      const p = Math.round(Blink.progress(bl.state, now) * 20) / 20;
      if (p !== bl.last) {
        bl.last = p;
        const c = bl.tex.getContext('2d');
        c.clearRect(0, 0, bl.tex.width, bl.tex.height);
        c.drawImage(bl.base, 0, 0);
        Blink.paint(c, bl.tex.width, bl.tex.height, bl.cfg, p, bl.closed);
        if (inst.ctx2d) { inst.tex = bl.tex; inst.dirty2D = true; }
        else if (inst.gl && !inst.ownLost) { inst.gl.bindTexture(inst.gl.TEXTURE_2D, inst.texObj); inst.gl.texImage2D(inst.gl.TEXTURE_2D, 0, inst.gl.RGBA, inst.gl.RGBA, inst.gl.UNSIGNED_BYTE, bl.tex); }
        else { inst.texSrc = bl.tex; const r = glRes(inst); if (r) { SH.gl.bindTexture(SH.gl.TEXTURE_2D, r.tex); SH.gl.texImage2D(SH.gl.TEXTURE_2D, 0, SH.gl.RGBA, SH.gl.RGBA, SH.gl.UNSIGNED_BYTE, bl.tex); } }
      }
    }
    if (inst.ctx2d) return drawFallback(inst, now, forced);
    if (inst.gl && !inst.ownLost) {
      const gl = inst.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, inst.posBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst.out);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, mesh.idx.length, gl.UNSIGNED_SHORT, 0);
      return;
    }
    if (inst.gl && inst.ownLost) {
      // Eigener Kontext verloren: Ersatz-Canvas (2D) einsetzen, ab jetzt über den gemeinsamen Kontext
      const nc = document.createElement('canvas'); nc.className = inst.cv.className; nc.width = inst.cv.width; nc.height = inst.cv.height; nc.style.cssText = inst.cv.style.cssText; nc._inst = inst;
      if (inst.cv.parentNode) inst.cv.parentNode.replaceChild(nc, inst.cv);
      inst.cv = nc; inst.gl = null; inst.ctx = nc.getContext('2d');
    }
    if (!drawGL(inst)) {
      // WebGL weg (z. B. Treiber-Absturz): auf den Ersatzweg umschalten
      inst.ctx2d = inst.ctx || inst.cv.getContext('2d'); inst.tex = inst.texSrc; inst.useGL = false;
      if (inst.ctx2d) drawFallback(inst, now, true);
    }
  }

  // Ersatzweg ohne WebGL: Die Verformung per Canvas 2D ist sehr langsam (~100 ms pro Bild).
  // Darum nur selten neu rechnen (Pose-Änderung, Blinzeln, max. 4x pro Sekunde) und das Atmen
  // dazwischen billig per CSS darstellen. Gesteuerte Aufrufe (Animations-Editor, Video) rechnen immer.
  function drawFallback(inst, now, forced) {
    const due = forced || inst.manual || inst.dirty2D || !inst.last2D || (inst.extraFn && now - inst.last2D > 0.25);
    if (due) { draw2D(inst); inst.last2D = now; inst.dirty2D = false; }
    if (!inst.manual && !inst.static) {
      const t = now - inst.t0, a = inst.amp;
      inst.cv.style.transformOrigin = '50% 85%';
      inst.cv.style.transform = 'translateX(-50%) scaleY(' + (1 + Math.sin(t * 1.6) * 0.006 * a) + ') rotate(' + (Math.sin(t * 0.7) * 0.5 * a) + 'deg)';
    }
  }

  let last = 0;
  function startLoop() {
    if (rafOn) return;
    rafOn = true;
    last = performance.now() / 1000;
    const tick = () => {
      const now = performance.now() / 1000;
      const dt = Math.min(1 / 30, now - last);
      last = now;
      for (const inst of live) {
        if (!inst.cv.isConnected) {
          live.delete(inst);
          if (inst.res) { releaseRes(inst.res); inst.res = null; if (glFree && inst.resToken) glFree.unregister(inst.resToken); }
          freeOwn(inst);
          continue;
        }
        if (inst.static) continue;
        let gap = window.Perf ? Perf.minInterval('bones') : 0;
        // Ersatzweg ohne WebGL: dauert ein Bild lange, seltener zeichnen (mind. ~15 fps, Spiel bleibt flüssig)
        if (inst.ctx2d && inst.cost2d > 8) gap = Math.max(gap, Math.min(1 / 15, inst.cost2d / 1000 * 3));
        if (gap && inst.lastDraw && now - inst.lastDraw < gap) continue;
        const t0 = inst.ctx2d ? performance.now() : 0;
        drawFrame(inst, now, inst.lastDraw ? Math.min(1 / 15, now - inst.lastDraw) : dt);
        if (inst.ctx2d) inst.cost2d = (inst.cost2d || 0) * 0.8 + (performance.now() - t0) * 0.2;
        inst.lastDraw = now;
      }
      if (live.size) requestAnimationFrame(tick); else rafOn = false;
    };
    requestAnimationFrame(tick);
  }
})();
