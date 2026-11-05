// Pixel-Art-Editor (0.9.16) im Reiter „Design“: zeichnen und Bild für Bild animieren.
// Datenmodell: VN.project.sprites = [{ id, name, w, h, palette: ['#rrggbb', …] (Index 0 = durchsichtig),
//   layers: [{ id, name, hidden }], anims: [{ id, name, frames: [{ id, dur (ms), px: { Ebenen-ID: Base64 } }] }],
//   scale, asset (fertiges Bild im Projekt) }]
// Fertige Sprites werden als animiertes GIF (pixelscharf hochskaliert) ins Projekt gelegt und funktionieren so überall.
(function () {
  const { el } = VN;
  const ui = () => VN.ui;
  const PRESETS = {
    'Retro 16': ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'],
    'Handheld (4 Grün)': ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
    'Warm': ['#2b1b17', '#5a2e2e', '#8f4a3a', '#c97f5d', '#f2b58c', '#fbe3c4', '#6b4f3a', '#3a2a20'],
    'Kalt': ['#0b1026', '#1b2a52', '#2f4f8f', '#4d86c7', '#8cc3e8', '#dff2ff', '#3b3f5a', '#7b80a3']
  };
  const TOOLS = [['pen', '✏', 'Stift'], ['erase', '🧽', 'Radierer'], ['fill', '🪣', 'Füllen'], ['line', '／', 'Linie'], ['rect', '▭', 'Rechteck'], ['circle', '◯', 'Kreis'], ['pick', '💧', 'Pipette'], ['move', '✥', 'Ebene verschieben']];

  // ---------- Pixel-Daten ----------
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s, n) => { const out = new Uint8Array(n); if (!s) return out; const bin = atob(s); for (let i = 0; i < Math.min(n, bin.length); i++) out[i] = bin.charCodeAt(i); return out; };
  const hexRgb = (h) => { const n = parseInt(String(h || '#000').slice(1), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const cache = new Map(); // "Sprite:Bild:Ebene" → Uint8Array
  const P = (window.PixelEd = {
    PRESETS,
    list: () => (VN.project.sprites = VN.project.sprites || []),
    get: (id) => P.list().find((s) => s.id === id) || null,
    cur: () => P.get(ui().pxSel) || P.list()[0] || null,
    anim: (spr) => (spr && (spr.anims.find((a) => a.id === ui().pxAnim) || spr.anims[0])) || null,
    frame: (spr) => { const a = P.anim(spr); if (!a) return null; return a.frames[Math.max(0, Math.min(a.frames.length - 1, ui().pxFrame || 0))] || a.frames[0]; },
    layer: (spr) => (spr && (spr.layers.find((l) => l.id === ui().pxLayer) || spr.layers[spr.layers.length - 1])) || null,
    px(spr, fr, ly) {
      const k = spr.id + ':' + fr.id + ':' + ly.id + ':' + spr.w + 'x' + spr.h;
      let a = cache.get(k);
      if (!a || a._src !== (fr.px || {})[ly.id]) { a = unb64((fr.px || {})[ly.id], spr.w * spr.h); a._src = (fr.px || {})[ly.id]; cache.set(k, a); }
      return a;
    },
    // Geänderte Pixel zurückschreiben (eine Rückgängig-Stufe pro Strich)
    commit(spr, fr, ly, arr) {
      const enc = arr.some((x) => x) ? b64(arr) : undefined;
      VN.mutate(() => { fr.px = fr.px || {}; if (enc) fr.px[ly.id] = enc; else delete fr.px[ly.id]; });
    },
    newSprite(name, w, h) {
      const L = { id: VN.uid('pl'), name: VN.t('Ebene') + ' 1' };
      const spr = { id: VN.uid('spr'), name: name || VN.t('Neues Sprite'), w, h, palette: [null].concat(PRESETS['Retro 16']), layers: [L], anims: [{ id: VN.uid('pa'), name: VN.t('Stehen'), frames: [{ id: VN.uid('pf'), dur: 120, px: {} }] }], scale: Math.max(1, Math.min(8, Math.round(256 / Math.max(w, h)))) };
      return spr;
    },
    // Ein Bild (alle sichtbaren Ebenen) als Palettenindizes
    flat(spr, fr, onlyVisible = true) {
      const out = new Uint8Array(spr.w * spr.h);
      for (const ly of spr.layers) { if (onlyVisible && ly.hidden) continue; const a = P.px(spr, fr, ly); for (let i = 0; i < out.length; i++) if (a[i]) out[i] = a[i]; }
      return out;
    },
    // Auf ein Canvas zeichnen (RGBA)
    paint(cv, spr, idx, alpha = 255) {
      cv.width = spr.w; cv.height = spr.h;
      const g = cv.getContext('2d'), im = g.createImageData(spr.w, spr.h), d = im.data;
      const pal = spr.palette.map((c) => (c ? hexRgb(c) : null));
      for (let i = 0; i < idx.length; i++) { const c = pal[idx[i]]; if (!c) continue; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = alpha; }
      g.putImageData(im, 0, 0);
      return cv;
    },
    // Animation als GIF (hochskaliert, pixelscharf)
    gif(spr, anim, scale) {
      const k = Math.max(1, Math.round(scale || spr.scale || 1)), W = spr.w * k, H = spr.h * k;
      const frames = anim.frames.map((fr) => {
        const src = P.flat(spr, fr), px = new Uint8Array(W * H);
        for (let y = 0; y < H; y++) { const sy = Math.floor(y / k) * spr.w, row = y * W; for (let x = 0; x < W; x++) px[row + x] = src[sy + Math.floor(x / k)]; }
        return { px, delay: Math.max(2, Math.round((fr.dur || 100) / 10)) };
      });
      const pal = spr.palette.map((c) => (c ? hexRgb(c) : [0, 0, 0]));
      return GifEnc.encode(frames, W, H, pal);
    },
    // Alle Animationen untereinander als Sprite-Sheet (PNG), eine Zeile pro Animation
    sheet(spr, scale) {
      const k = Math.max(1, Math.round(scale || 1)), cols = Math.max(...spr.anims.map((a) => a.frames.length)), rows = spr.anims.length;
      const cv = document.createElement('canvas'); cv.width = cols * spr.w * k; cv.height = rows * spr.h * k;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      const tmp = document.createElement('canvas');
      spr.anims.forEach((a, r) => a.frames.forEach((fr, c) => { P.paint(tmp, spr, P.flat(spr, fr)); g.drawImage(tmp, c * spr.w * k, r * spr.h * k, spr.w * k, spr.h * k); }));
      return cv;
    },
    // Ins Projekt legen bzw. das bestehende Bild ersetzen (alle Stellen, die es nutzen, zeigen dann das neue)
    async toProject(spr, mode) {
      if (!VN.api || !VN.api.writeAsset) { VN.toast(VN.t('Speichern ging nicht')); return; }
      const safe = String(spr.name || 'sprite').replace(/[^\wäöüÄÖÜß -]/g, '').trim().replace(/\s+/g, '_') || 'sprite';
      let bytes, ext;
      if (mode === 'sheet') { const cv = P.sheet(spr, spr.scale || 1); const blob = await new Promise((res) => cv.toBlob(res, 'image/png')); bytes = new Uint8Array(await blob.arrayBuffer()); ext = 'png'; }
      else { const a = P.anim(spr); bytes = P.gif(spr, a, spr.scale || 1); ext = 'gif'; }
      const rel = await VN.api.writeAsset(VN.dir, 'assets/px_' + safe + (mode === 'sheet' ? '_sheet' : '_' + String(P.anim(spr).name || 'anim').replace(/[^\wäöüÄÖÜß-]/g, '')) + '.' + ext, bytes);
      if (!rel || typeof rel !== 'string') { VN.toast(VN.t('Speichern ging nicht')); return; }
      const key = mode === 'sheet' ? 'sheetAsset' : 'asset_' + P.anim(spr).id;
      VN.mutate(() => {
        let a = spr[key] && VN.asset(spr[key]);
        if (a) a.file = rel;
        else { a = { id: VN.uid('a'), name: spr.name + (mode === 'sheet' ? ' · ' + VN.t('Sprite-Sheet') : ' · ' + P.anim(spr).name), kind: 'image', file: rel, pixel: true }; VN.project.assets.push(a); spr[key] = a.id; }
      });
      VN.toast(mode === 'sheet' ? VN.t('Sprite-Sheet ist jetzt bei den Bildern') : VN.t('Animiertes Bild ist jetzt bei den Bildern – nutzbar in Szenen, Hubs und im Kampf'));
    },
    // Sprite-Sheet aus einem Bild importieren (Raster aus Einzelbildern) → neue Animation, Farben werden zur Palette
    async importSheet(spr, assetId, fw, fh, count) {
      const url = VN.assetUrl(assetId);
      if (!url) return;
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
      const cols = Math.max(1, Math.floor(cv.width / fw)), rows = Math.max(1, Math.floor(cv.height / fh));
      const n = Math.min(count || cols * rows, cols * rows);
      const pal = spr.palette.slice();
      const map = new Map(pal.map((c, i) => [c, i]));
      const frames = [];
      let full = false;
      for (let f = 0; f < n; f++) {
        const sx = (f % cols) * fw, sy = Math.floor(f / cols) * fh, d = g.getImageData(sx, sy, fw, fh).data;
        const arr = new Uint8Array(spr.w * spr.h);
        for (let y = 0; y < Math.min(fh, spr.h); y++) for (let x = 0; x < Math.min(fw, spr.w); x++) {
          const o = (y * fw + x) * 4;
          if (d[o + 3] < 128) continue;
          const hex = '#' + [d[o], d[o + 1], d[o + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
          let i = map.get(hex);
          if (i == null) {
            if (pal.length < 256) { i = pal.length; pal.push(hex); map.set(hex, i); }
            else { full = true; let best = 1, bd = 1e9; const c = [d[o], d[o + 1], d[o + 2]]; for (let k = 1; k < pal.length; k++) { const q = hexRgb(pal[k]); const dd = (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2; if (dd < bd) { bd = dd; best = k; } } i = best; }
          }
          arr[y * spr.w + x] = i;
        }
        frames.push({ id: VN.uid('pf'), dur: 120, px: arr.some((x) => x) ? { [spr.layers[0].id]: b64(arr) } : {} });
      }
      VN.mutate(() => { spr.palette = pal; const a = { id: VN.uid('pa'), name: VN.t('Import'), frames }; spr.anims.push(a); ui().pxAnim = a.id; ui().pxFrame = 0; });
      if (full) VN.toast(VN.t('Mehr als 255 Farben – ähnliche Farben wurden zusammengelegt'));
    },

    // ---------- Ansicht ----------
    render(center) {
      const spr = P.cur();
      const bar = el('div', { class: 'view-head px-bar' });
      center.appendChild(bar);
      const sel = el('select', { class: 'small-input', onchange: (e) => { ui().pxSel = e.target.value; ui().pxAnim = null; ui().pxFrame = 0; VN.render(); } });
      for (const s of P.list()) { const o = el('option', { value: s.id }, s.name + ' · ' + s.w + '×' + s.h); if (spr && s.id === spr.id) o.selected = true; sel.appendChild(o); }
      const size = el('select', { class: 'small-input', title: VN.t('Größe des neuen Sprites') }, ...[[16, '16×16'], [24, '24×24'], [32, '32×32'], [48, '48×48'], [64, '64×64'], [96, '96×96'], ['32x48', '32×48 (Figur)'], ['48x64', '48×64 (Figur)'], [128, '128×128']].map(([v, l]) => el('option', { value: String(v), selected: String(v) === '32x48' }, l)));
      bar.append(P.list().length ? sel : null, size,
        el('button', { class: 'btn', onclick: () => { const v = size.value, [w, h] = v.includes('x') ? v.split('x').map(Number) : [Number(v), Number(v)]; VN.mutate(() => { const s = P.newSprite(VN.t('Sprite') + ' ' + (P.list().length + 1), w, h); P.list().push(s); ui().pxSel = s.id; ui().pxAnim = null; ui().pxFrame = 0; ui().pxLayer = null; ui().pxColor = 1; }); } }, '+ ' + VN.t('Neues Sprite')));
      if (!spr) {
        center.appendChild(el('div', { class: 'hint-box', style: { margin: '20px' } }, 'Pixel-Art: Größe wählen und „+ Neues Sprite“. Dann Bild für Bild zeichnen und animieren – fertige Animationen landen als Bild bei den Dateien und laufen in Szenen, Hubs und im Kampf.'));
        return;
      }
      const tools = el('div', { class: 'seg' }, ...TOOLS.map(([k, ic, l]) => el('button', { class: (ui().pxTool || 'pen') === k ? 'active' : '', title: VN.t(l), onclick: () => { ui().pxTool = k; VN.render(); } }, ic)));
      const tg = (key, label, title) => el('label', { class: 'check btn', title: VN.t(title || '') }, el('input', { type: 'checkbox', checked: !!ui()[key], onchange: (e) => { ui()[key] = e.target.checked; VN.render(); } }), label);
      bar.append(tools, tg('pxMirror', '⇋ ' + VN.t('Spiegeln'), 'Beim Zeichnen gleichzeitig auf der anderen Seite malen'), tg('pxOnion', '◐ ' + VN.t('Zwiebelhaut'), 'Vorheriges und nächstes Bild durchscheinend zeigen'), el('label', { class: 'check btn' }, el('input', { type: 'checkbox', checked: ui().pxGrid !== false, onchange: (e) => { ui().pxGrid = e.target.checked; VN.render(); } }), '# ' + VN.t('Raster')));
      const wrap = el('div', { class: 'px-wrap' });
      center.appendChild(wrap);
      const cv = el('canvas', { class: 'px-canvas' });
      wrap.appendChild(cv);
      P.bindCanvas(cv, spr);
      requestAnimationFrame(() => P.draw(cv, spr));
      center.appendChild(P.frameBar(spr));
    },
    // Zoom so, dass das Sprite gut in die Fläche passt
    zoom(spr, wrap) {
      const r = wrap.getBoundingClientRect();
      const z = Math.max(2, Math.floor(Math.min((r.width - 40) / spr.w, (r.height - 40) / spr.h)));
      return Math.min(40, ui().pxZoom || z);
    },
    draw(cv, spr, live) {
      if (!cv.isConnected) return;
      const fr = P.frame(spr);
      if (!fr) return;
      const z = P.zoom(spr, cv.parentNode);
      cv.width = spr.w * z; cv.height = spr.h * z;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      // Schachbrett
      for (let y = 0; y < spr.h; y++) for (let x = 0; x < spr.w; x++) { g.fillStyle = (x + y) % 2 ? '#2a2c35' : '#32343e'; g.fillRect(x * z, y * z, z, z); }
      const tmp = document.createElement('canvas');
      const a = P.anim(spr), fi = a.frames.indexOf(fr);
      if (ui().pxOnion && a.frames.length > 1) {
        for (const [d, al] of [[-1, 0.28], [1, 0.16]]) { const f2 = a.frames[(fi + d + a.frames.length) % a.frames.length]; if (f2 === fr) continue; g.globalAlpha = al; P.paint(tmp, spr, P.flat(spr, f2)); g.drawImage(tmp, 0, 0, cv.width, cv.height); }
        g.globalAlpha = 1;
      }
      P.paint(tmp, spr, live || P.flat(spr, fr));
      g.drawImage(tmp, 0, 0, cv.width, cv.height);
      if (ui().pxGrid !== false && z >= 6) {
        g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1; g.beginPath();
        for (let x = 1; x < spr.w; x++) { g.moveTo(x * z + 0.5, 0); g.lineTo(x * z + 0.5, cv.height); }
        for (let y = 1; y < spr.h; y++) { g.moveTo(0, y * z + 0.5); g.lineTo(cv.width, y * z + 0.5); }
        g.stroke();
      }
      if (ui().pxMirror) { g.strokeStyle = 'rgba(232,164,58,0.6)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(cv.width / 2, 0); g.lineTo(cv.width / 2, cv.height); g.stroke(); g.setLineDash([]); }
    },
    // Zeichnen mit der Maus
    bindCanvas(cv, spr) {
      const at = (e) => { const r = cv.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * spr.w), Math.floor((e.clientY - r.top) / r.height * spr.h)]; };
      const inside = (x, y) => x >= 0 && y >= 0 && x < spr.w && y < spr.h;
      cv.addEventListener('contextmenu', (e) => e.preventDefault());
      cv.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); ui().pxZoom = Math.max(2, Math.min(40, P.zoom(spr, cv.parentNode) + (e.deltaY < 0 ? 1 : -1))); P.draw(cv, spr); }, { passive: false });
      cv.addEventListener('mousedown', (e) => {
        const fr = P.frame(spr), ly = P.layer(spr);
        if (!fr || !ly) return;
        if (ly.hidden) { VN.toast(VN.t('Diese Ebene ist ausgeblendet')); return; }
        e.preventDefault();
        const tool = e.button === 2 ? 'erase' : (ui().pxTool || 'pen');
        const col = tool === 'erase' ? 0 : (ui().pxColor != null ? ui().pxColor : 1);
        const arr = P.px(spr, fr, ly).slice(), orig = arr.slice();
        const set = (x, y, c) => { if (!inside(x, y)) return; arr[y * spr.w + x] = c; if (ui().pxMirror) { const mx = spr.w - 1 - x; arr[y * spr.w + mx] = c; } };
        const line = (x0, y0, x1, y1, c, into) => { const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy; for (;;) { into(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } } };
        const flatWith = () => { const out = new Uint8Array(spr.w * spr.h); for (const l of spr.layers) { if (l.hidden) continue; const a = l === ly ? arr : P.px(spr, fr, l); for (let i = 0; i < out.length; i++) if (a[i]) out[i] = a[i]; } return out; };
        const redraw = () => P.draw(cv, spr, flatWith());
        let [x0, y0] = at(e);
        if (tool === 'pick') { const f = P.flat(spr, fr); if (inside(x0, y0)) { ui().pxColor = f[y0 * spr.w + x0] || 0; VN.render(); } return; }
        if (tool === 'fill') {
          if (!inside(x0, y0)) return;
          const target = arr[y0 * spr.w + x0];
          if (target === col) return;
          const st = [[x0, y0]];
          while (st.length) { const [x, y] = st.pop(); if (!inside(x, y) || arr[y * spr.w + x] !== target) continue; arr[y * spr.w + x] = col; st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
          if (ui().pxMirror) { /* Füllen spiegelt sich nicht – sonst überschreibt es fremde Flächen */ }
          P.commit(spr, fr, ly, arr); return;
        }
        if (tool === 'move') {
          let lx = x0, ly0 = y0;
          VN.drag(e, (dx, dy, ev) => {
            const [x, y] = at(ev), mx = x - lx, my = y - ly0;
            if (!mx && !my) return;
            const nx = new Uint8Array(arr.length);
            for (let yy = 0; yy < spr.h; yy++) for (let xx = 0; xx < spr.w; xx++) { const sx = xx - mx, sy = yy - my; if (sx >= 0 && sy >= 0 && sx < spr.w && sy < spr.h) nx[yy * spr.w + xx] = arr[sy * spr.w + sx]; }
            arr.set(nx); lx = x; ly0 = y; redraw();
          }, () => P.commit(spr, fr, ly, arr));
          return;
        }
        if (tool === 'pen' || tool === 'erase') {
          set(x0, y0, col); redraw();
          VN.drag(e, (dx, dy, ev) => { const [x, y] = at(ev); line(x0, y0, x, y, col, set); x0 = x; y0 = y; redraw(); }, () => { if (arr.some((v, i) => v !== orig[i])) P.commit(spr, fr, ly, arr); });
          return;
        }
        // Linie, Rechteck, Kreis: Vorschau beim Ziehen
        const shape = (x1, y1) => {
          arr.set(orig);
          if (tool === 'line') line(x0, y0, x1, y1, col, set);
          else if (tool === 'rect') { const [a, b] = [Math.min(x0, x1), Math.max(x0, x1)], [c, d] = [Math.min(y0, y1), Math.max(y0, y1)]; for (let x = a; x <= b; x++) { set(x, c, col); set(x, d, col); } for (let y = c; y <= d; y++) { set(a, y, col); set(b, y, col); } }
          else if (tool === 'circle') {
            const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2 + 0.5, ry = Math.abs(y1 - y0) / 2 + 0.5;
            const n = Math.max(16, Math.round((rx + ry) * 4)); let px = null, py = null;
            for (let i = 0; i <= n; i++) { const t = i / n * Math.PI * 2, x = Math.round(cx + Math.cos(t) * (rx - 0.5)), y = Math.round(cy + Math.sin(t) * (ry - 0.5)); if (px != null) line(px, py, x, y, col, set); else set(x, y, col); px = x; py = y; }
          }
          redraw();
        };
        shape(x0, y0);
        VN.drag(e, (dx, dy, ev) => { const [x, y] = at(ev); shape(x, y); }, () => P.commit(spr, fr, ly, arr));
      });
    },
    // Bilderleiste unten: Animation wählen, Bilder, Dauer, Abspielen
    frameBar(spr) {
      const a = P.anim(spr), fr = P.frame(spr), fi = a.frames.indexOf(fr);
      const animSel = el('select', { class: 'small-input', onchange: (e) => { ui().pxAnim = e.target.value; ui().pxFrame = 0; VN.render(); } }, ...spr.anims.map((x) => el('option', { value: x.id, selected: x === a }, x.name)));
      const strip = el('div', { class: 'px-strip' });
      a.frames.forEach((f, i) => {
        const t = el('canvas', { class: 'px-thumb' + (i === fi ? ' on' : ''), title: (i + 1) + ' · ' + (f.dur || 100) + ' ms', onclick: () => { ui().pxFrame = i; ui().pxPlay = false; VN.render(); } });
        P.paint(t, spr, P.flat(spr, f));
        strip.appendChild(el('div', { class: 'px-cell' }, t, el('span', null, String(i + 1))));
      });
      const mut = (fn) => VN.mutate(fn);
      const play = el('button', { class: 'btn primary', onclick: () => { ui().pxPlay = !ui().pxPlay; VN.render(); } }, ui().pxPlay ? '■ ' + VN.t('Stopp') : '▶ ' + VN.t('Abspielen'));
      const prev = el('canvas', { class: 'px-preview', title: VN.t('Vorschau in Originalgröße × 2') });
      if (ui().pxPlay) {
        let i = 0, last = performance.now();
        const loop = (now) => { if (!prev.isConnected || !ui().pxPlay) return; const f = a.frames[i % a.frames.length]; if (now - last >= (f.dur || 100)) { i++; last = now; } P.paint(prev, spr, P.flat(spr, a.frames[i % a.frames.length])); requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
      } else P.paint(prev, spr, P.flat(spr, fr));
      return el('div', { class: 'px-frames' },
        el('div', { class: 'row gap8' },
          el('strong', null, VN.t('Animation')), animSel,
          el('button', { class: 'btn tiny', onclick: () => mut(() => { const n = { id: VN.uid('pa'), name: VN.t('Animation') + ' ' + (spr.anims.length + 1), frames: [{ id: VN.uid('pf'), dur: 120, px: {} }] }; spr.anims.push(n); ui().pxAnim = n.id; ui().pxFrame = 0; }) }, '+'),
          el('input', { type: 'text', class: 'small-input', value: a.name, style: { width: '120px' }, title: VN.t('Name der Animation, z. B. Laufen rechts'), onchange: (e) => mut(() => { a.name = e.target.value || a.name; }) }),
          spr.anims.length > 1 ? el('button', { class: 'btn tiny danger', title: VN.t('Animation löschen'), onclick: () => mut(() => { spr.anims = spr.anims.filter((x) => x !== a); ui().pxAnim = null; ui().pxFrame = 0; }) }, '×') : null,
          el('div', { class: 'spacer' }),
          el('span', { class: 'muted small' }, VN.t('Bild') + ' ' + (fi + 1) + '/' + a.frames.length),
          el('label', { class: 'row gap4 small' }, VN.t('Dauer'), el('input', { type: 'number', class: 'small-input', min: 20, max: 5000, step: 10, value: fr.dur || 100, style: { width: '70px' }, onchange: (e) => mut(() => { fr.dur = Math.max(20, Number(e.target.value) || 100); }) }), 'ms'),
          el('button', { class: 'btn tiny', title: VN.t('Alle Bilder dieser Animation auf diese Dauer setzen'), onclick: () => mut(() => { for (const f of a.frames) f.dur = fr.dur || 100; }) }, '= ' + VN.t('alle')),
          play, prev),
        el('div', { class: 'row gap8' }, strip,
          el('div', { class: 'col gap4' },
            el('button', { class: 'btn tiny', title: VN.t('Bild verdoppeln (gut zum Weiterzeichnen)'), onclick: () => mut(() => { a.frames.splice(fi + 1, 0, { id: VN.uid('pf'), dur: fr.dur, px: Object.assign({}, fr.px) }); ui().pxFrame = fi + 1; }) }, '⧉ ' + VN.t('Verdoppeln')),
            el('button', { class: 'btn tiny', onclick: () => mut(() => { a.frames.splice(fi + 1, 0, { id: VN.uid('pf'), dur: fr.dur || 120, px: {} }); ui().pxFrame = fi + 1; }) }, '+ ' + VN.t('Leeres Bild')),
            el('div', { class: 'row gap4' },
              el('button', { class: 'btn tiny', disabled: fi === 0, title: VN.t('nach links'), onclick: () => mut(() => { a.frames.splice(fi, 1); a.frames.splice(fi - 1, 0, fr); ui().pxFrame = fi - 1; }) }, '◀'),
              el('button', { class: 'btn tiny', disabled: fi === a.frames.length - 1, title: VN.t('nach rechts'), onclick: () => mut(() => { a.frames.splice(fi, 1); a.frames.splice(fi + 1, 0, fr); ui().pxFrame = fi + 1; }) }, '▶'),
              el('button', { class: 'btn tiny danger', disabled: a.frames.length < 2, title: VN.t('Bild löschen'), onclick: () => mut(() => { a.frames.splice(fi, 1); ui().pxFrame = Math.max(0, fi - 1); }) }, '×')))));
    },

    // ---------- Rechte Seite: Palette, Ebenen, Sprite, Ins Projekt ----------
    inspector() {
      const spr = P.cur();
      const box = el('div');
      if (!spr) { box.appendChild(el('div', { class: 'muted small' }, 'Noch kein Sprite. Links Größe wählen und „+ Neues Sprite“.')); return box; }
      const mut = (fn) => VN.mutate(fn);
      // Palette
      const ci = ui().pxColor != null ? ui().pxColor : 1;
      const sw = el('div', { class: 'px-pal' });
      spr.palette.forEach((c, i) => sw.appendChild(el('button', { class: 'px-sw' + (i === ci ? ' on' : '') + (i === 0 ? ' clear' : ''), title: i === 0 ? VN.t('Durchsichtig') : c, style: i ? { background: c } : {}, onclick: () => { ui().pxColor = i; VN.render(); } })));
      const presetSel = el('select', { class: 'small-input', onchange: (e) => { const v = e.target.value; if (!v) return; mut(() => { const used = spr.palette.slice(1); for (const c of PRESETS[v]) if (!used.includes(c) && spr.palette.length < 256) spr.palette.push(c); }); } },
        el('option', { value: '' }, VN.t('+ Palette dazunehmen …')), ...Object.keys(PRESETS).map((k) => el('option', { value: k }, k)));
      box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Farben'), sw,
        el('div', { class: 'row gap8' },
          ci > 0 ? el('label', { class: 'd-color' }, el('input', { type: 'color', value: spr.palette[ci], onchange: (e) => mut(() => { spr.palette[ci] = e.target.value; }) }), el('span', null, VN.t('Farbe ändern'))) : el('span', { class: 'muted small' }, VN.t('Durchsichtig = radieren')),
          el('label', { class: 'd-color', title: VN.t('Neue Farbe zur Palette') }, el('input', { type: 'color', value: '#ffffff', onchange: (e) => mut(() => { if (spr.palette.length < 256) { spr.palette.push(e.target.value); ui().pxColor = spr.palette.length - 1; } }) }), el('span', null, '+'))),
        presetSel,
        el('div', { class: 'muted small' }, 'Linke Maustaste = malen · rechte = radieren · Strg + Mausrad = Zoom. Ändert man eine Farbe, ändert sie sich in allen Bildern.')));
      // Ebenen
      const ly = P.layer(spr);
      const lbox = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Ebenen (oben = vorne)'));
      spr.layers.slice().reverse().forEach((l) => {
        const i = spr.layers.indexOf(l);
        lbox.appendChild(el('div', { class: 'pup-layer' + (l === ly ? ' on' : ''), onclick: () => { ui().pxLayer = l.id; VN.render(); } },
          el('input', { type: 'text', class: 'small-input', value: l.name, style: { flex: '1', minWidth: '0', width: '90px' }, onclick: (e) => e.stopPropagation(), onchange: (e) => mut(() => { l.name = e.target.value || l.name; }) }),
          el('button', { class: 'btn tiny', title: VN.t('Ein-/ausblenden'), onclick: (e) => { e.stopPropagation(); mut(() => { l.hidden = !l.hidden; if (!l.hidden) delete l.hidden; }); } }, l.hidden ? '🙈' : '👁'),
          el('button', { class: 'btn tiny', disabled: i === spr.layers.length - 1, onclick: (e) => { e.stopPropagation(); mut(() => { spr.layers.splice(i, 1); spr.layers.splice(i + 1, 0, l); }); } }, '▲'),
          el('button', { class: 'btn tiny', disabled: i === 0, onclick: (e) => { e.stopPropagation(); mut(() => { spr.layers.splice(i, 1); spr.layers.splice(i - 1, 0, l); }); } }, '▼'),
          spr.layers.length > 1 ? el('button', { class: 'btn tiny danger', onclick: (e) => { e.stopPropagation(); mut(() => { spr.layers = spr.layers.filter((x) => x !== l); for (const a of spr.anims) for (const f of a.frames) if (f.px) delete f.px[l.id]; ui().pxLayer = null; }); } }, '×') : null));
      });
      lbox.appendChild(el('button', { class: 'btn tiny', onclick: () => mut(() => { const n = { id: VN.uid('pl'), name: VN.t('Ebene') + ' ' + (spr.layers.length + 1) }; spr.layers.push(n); ui().pxLayer = n.id; }) }, '+ ' + VN.t('Ebene')));
      box.appendChild(lbox);
      // Sprite
      box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Sprite'),
        el('label', { class: 'sk-field' }, el('span', { class: 'muted small' }, VN.t('Name')), el('input', { type: 'text', class: 'small-input', value: spr.name, onchange: (e) => mut(() => { spr.name = e.target.value || spr.name; }) })),
        el('div', { class: 'muted small' }, spr.w + ' × ' + spr.h + ' ' + VN.t('Pixel') + ' · ' + spr.anims.length + ' ' + VN.t('Animationen') + ' · ' + (spr.palette.length - 1) + ' ' + VN.t('Farben')),
        el('button', { class: 'btn tiny danger', onclick: () => mut(() => { VN.project.sprites = P.list().filter((x) => x !== spr); ui().pxSel = null; }) }, VN.t('Sprite löschen'))));
      // Ins Projekt
      const a = P.anim(spr);
      const scaleSel = el('select', { onchange: (e) => mut(() => { spr.scale = Number(e.target.value); }) }, ...[1, 2, 3, 4, 6, 8].map((k) => el('option', { value: String(k), selected: (spr.scale || 1) === k }, '× ' + k + ' (' + spr.w * k + ' × ' + spr.h * k + ')')));
      const has = spr['asset_' + a.id] && VN.asset(spr['asset_' + a.id]);
      box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Ins Projekt'),
        el('label', { class: 'sk-field' }, el('span', { class: 'muted small' }, VN.t('Vergrößern (pixelscharf)')), scaleSel),
        el('button', { class: 'btn primary', style: { whiteSpace: 'normal', height: 'auto' }, onclick: () => P.toProject(spr, 'gif') }, has ? '↻ ' + VN.t('Bild aktualisieren') + ': ' + a.name : '➜ ' + VN.t('Als animiertes Bild ins Projekt') + ': ' + a.name),
        el('button', { class: 'btn', style: { whiteSpace: 'normal', height: 'auto' }, onclick: () => P.toProject(spr, 'sheet') }, (spr.sheetAsset && VN.asset(spr.sheetAsset) ? '↻ ' : '➜ ') + VN.t('Sprite-Sheet (alle Animationen) ins Projekt')),
        el('div', { class: 'muted small' }, 'Jede Animation wird ein eigenes animiertes Bild bei den Dateien – nutzbar als Figur, Hintergrund, Hub-Objekt oder Kämpfer. Nach Änderungen „aktualisieren“: Alle Stellen, die das Bild nutzen, zeigen dann die neue Fassung.')));
      // Import
      const imgSel = VN.assetSelect('image', '', () => {});
      const fw = el('input', { type: 'number', class: 'small-input', value: spr.w, min: 1, style: { width: '56px' } }), fh = el('input', { type: 'number', class: 'small-input', value: spr.h, min: 1, style: { width: '56px' } }), cnt = el('input', { type: 'number', class: 'small-input', value: 0, min: 0, style: { width: '56px' }, title: VN.t('0 = alle') });
      box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Sprite-Sheet importieren'), imgSel,
        el('div', { class: 'row gap8 small' }, VN.t('Bildgröße'), fw, '×', fh, VN.t('Anzahl'), cnt),
        el('button', { class: 'btn tiny', onclick: () => { if (imgSel.value) P.importSheet(spr, imgSel.value, Number(fw.value) || spr.w, Number(fh.value) || spr.h, Number(cnt.value) || 0); } }, VN.t('Als neue Animation importieren')),
        el('div', { class: 'muted small' }, 'Ein Bild mit Einzelbildern im Raster (z. B. aus einem anderen Pixel-Programm). Die Farben kommen in die Palette.')));
      return box;
    }
  });
})();
