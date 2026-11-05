// Inpaint-Stift (Rechenteil): füllt eine Maske in einem Bild ohne KI-Modell – mit einem weichen Farbverlauf vom Rand der
// Maske, einer festen Farbe oder einem Verlauf zwischen zwei gewählten Punkten. Bedienung: puppet-edit.js
(function () {
  // Verlauf vom Rand: unbekannte Pixel werden zum Mittelwert ihrer Nachbarn (grob → fein, damit auch große Flächen
  // schnell und ohne Flecken zusammenlaufen)
  const solve = (w, h, kn, ch) => {
    let open = false;
    for (let i = 0; i < w * h; i++) if (!kn[i]) { open = true; break; }
    if (!open) return;
    if (w > 2 || h > 2) {
      const cw = Math.ceil(w / 2), ch2 = Math.ceil(h / 2), n = cw * ch2;
      const ck = new Uint8Array(n), cnt = new Float32Array(n), cc = ch.map(() => new Float32Array(n));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!kn[i]) continue;
        const c = (y >> 1) * cw + (x >> 1);
        cnt[c]++; ck[c] = 1;
        ch.forEach((a, k) => { cc[k][c] += a[i]; });
      }
      for (let c = 0; c < n; c++) if (cnt[c]) cc.forEach((a) => { a[c] /= cnt[c]; });
      solve(cw, ch2, ck, cc);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (kn[i]) continue;
        const c = (y >> 1) * cw + (x >> 1);
        ch.forEach((a, k) => { a[i] = cc[k][c]; });
      }
    } else {
      const sum = ch.map(() => 0); let cnt = 0;
      for (let i = 0; i < w * h; i++) if (kn[i]) { cnt++; ch.forEach((a, k) => { sum[k] += a[i]; }); }
      for (let i = 0; i < w * h; i++) if (!kn[i]) ch.forEach((a, k) => { a[i] = sum[k] / (cnt || 1); });
    }
    for (let it = 0; it < 24; it++) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (kn[i]) continue;
        let m = 0; const l = x > 0, r = x < w - 1, u = y > 0, d = y < h - 1;
        m = (l ? 1 : 0) + (r ? 1 : 0) + (u ? 1 : 0) + (d ? 1 : 0);
        for (const a of ch) a[i] = ((l ? a[i - 1] : 0) + (r ? a[i + 1] : 0) + (u ? a[i - w] : 0) + (d ? a[i + w] : 0)) / m;
      }
    }
  };

  // Abstand jedes Masken-Pixels zum Maskenrand
  const distance = (w, h, on) => {
    const d = new Float32Array(w * h), D = 1.414;
    for (let i = 0; i < w * h; i++) d[i] = on[i] ? 1e9 : 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (d[i]) d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + D, at(x + 1, y - 1) + D); }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (d[i]) d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + D, at(x - 1, y + 1) + D); }
    return d;
  };

  // img: { data, width, height } (wird verändert), mask: Uint8 0–255 je Pixel
  // o: { mode: 'auto' | 'color' | 'grad', color: [r,g,b], a: {x,y,c}, b: {x,y,c}, soft: 0–100 }
  // Ergebnis: { ok, reason } – reason: 'empty' (keine Maske), 'nosource' (keine Farben am Rand gefunden)
  const run = (img, mask, o) => {
    const W = img.width, H = img.height, data = img.data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return { ok: false, reason: 'empty' };
    const mg = Math.max(8, Math.round(Math.max(x1 - x0, y1 - y0) * 0.15));
    const bx = Math.max(0, x0 - mg), by = Math.max(0, y0 - mg), bw = Math.min(W, x1 + mg + 1) - bx, bh = Math.min(H, y1 + mg + 1) - by;
    const n = bw * bh, on = new Uint8Array(n);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) on[y * bw + x] = mask[(y + by) * W + x + bx] > 127 ? 1 : 0;

    const ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    if (o.mode === 'color') {
      const c = o.color || [128, 128, 128];
      ch.forEach((a, k) => a.fill(c[k]));
    } else if (o.mode === 'grad') {
      if (!o.a || !o.b) return { ok: false, reason: 'nosource' };
      const dx = o.b.x - o.a.x, dy = o.b.y - o.a.y, L = dx * dx + dy * dy || 1;
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        let t = ((x + bx - o.a.x) * dx + (y + by - o.a.y) * dy) / L;
        t = Math.max(0, Math.min(1, t));
        ch.forEach((a, k) => { a[y * bw + x] = o.a.c[k] + (o.b.c[k] - o.a.c[k]) * t; });
      }
    } else {
      // Quelle sind deckende Pixel außerhalb der Maske – halb durchsichtige Kanten würden den Verlauf verfärben
      const kn = new Uint8Array(n); let src = 0;
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const i = y * bw + x, q = ((y + by) * W + x + bx) * 4;
        if (on[i] || data[q + 3] < 200) continue;
        kn[i] = 1; src++;
        ch[0][i] = data[q]; ch[1][i] = data[q + 1]; ch[2][i] = data[q + 2];
      }
      if (!src) return { ok: false, reason: 'nosource' };
      // Dunkle Umrisslinien am Rand würden die ganze Füllung verschmutzen: deutlich dunklere Quellen zählen nicht
      const luma = [];
      for (let i = 0; i < n; i++) if (kn[i]) luma.push(ch[0][i] * 0.3 + ch[1][i] * 0.59 + ch[2][i] * 0.11);
      luma.sort((a, b) => a - b);
      const cut = luma[luma.length >> 1] * 0.6;
      if (luma.filter((v) => v >= cut).length >= Math.max(1, luma.length * 0.3)) for (let i = 0; i < n; i++) if (kn[i] && ch[0][i] * 0.3 + ch[1][i] * 0.59 + ch[2][i] * 0.11 < cut) kn[i] = 0;
      solve(bw, bh, kn, ch);
    }

    const dist = distance(bw, bh, on);
    let far = 1; for (let i = 0; i < n; i++) if (on[i] && dist[i] > far) far = dist[i];
    const band = Math.max(1.5, (Math.max(0, Math.min(100, o.soft == null ? 50 : o.soft)) / 100) * far);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const i = y * bw + x, mi = (y + by) * W + x + bx, cov = mask[mi] / 255;
      if (!cov) continue;
      const q = mi * 4, oa = data[q + 3] / 255;
      let t = Math.min(1, dist[i] / band); t = t * t * (3 - 2 * t);
      // Löcher werden ganz gefüllt; nur über vorhandenem Bild blendet die Weichheit sanft ein
      const w = t + (1 - t) * (1 - oa);
      const m = cov * w;
      for (let k = 0; k < 3; k++) data[q + k] = Math.round(data[q + k] * (1 - m) + ch[k][i] * m);
      data[q + 3] = Math.round(Math.max(oa, cov) * 255);
    }
    return { ok: true };
  };

  window.Inpaint = { run };
})();
