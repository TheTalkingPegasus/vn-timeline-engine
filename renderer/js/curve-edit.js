// Kurven-Editor (nur im Editor): Übergang von Keyframe zu Keyframe als Graph mit zwei Griffen (Bézier).
// Ergebnis ist ein Kurven-Name ("ease-in-out", "hold" …) oder eine eigene Kurve "cb:x1,y1,x2,y2".
// mode "anim" = Animations-Editor (Knochen, Puppen, Zwischensequenzen), "css" = Keyframes und Kamera in Szenen.
(function () {
  const { el } = VN;
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, at) => { const n = document.createElementNS(NS, tag); for (const k in at) n.setAttribute(k, at[k]); return n; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Griffe der fertigen Kurven (für Animationen angenähert – beim Ziehen wird daraus eine eigene Kurve)
  const ANIM = { linear: [0, 0, 1, 1], 'ease-in': [0.55, 0.055, 0.675, 0.19], 'ease-out': [0.215, 0.61, 0.355, 1], 'ease-in-out': [0.645, 0.045, 0.355, 1], smooth: [0.23, 1, 0.32, 1], back: [0.34, 1.56, 0.64, 1], bounce: [0.3, 2.1, 0.45, 1] };
  const cssPts = (k) => { if (k === 'linear') return [0, 0, 1, 1]; const m = /cubic-bezier\(([^)]+)\)/.exec(Fx.EASES[k] || ''); return m ? m[1].split(',').map(Number) : null; };
  const pts = (v, mode) => {
    if (v === 'hold') return null;
    return Fx.parseCb(v) || (mode === 'css' ? cssPts(v || 'ease-in-out') || cssPts('ease-in-out') : ANIM[v || 'ease-in-out'] || ANIM['ease-in-out']);
  };
  const fnOf = (v, mode) => {
    if (mode === 'css') { if (v === 'hold') return Fx.easeFn('hold'); const c = pts(v, 'css'); return Fx.bezier(c[0], c[1], c[2], c[3]); }
    return window.Anim ? Anim.easeFn(v || 'ease-in-out') : (t) => t;
  };
  const fmt = (c) => 'cb:' + c.map((n) => Math.round(n * 1000) / 1000).join(',');
  const Y0 = -0.4, Y1 = 1.4; // sichtbarer Wertebereich (Überschwingen bleibt sichtbar)

  const CurveEd = (window.CurveEd = {
    ANIM, pts, fnOf, fmt,

    // Kleines Bild einer Kurve (für Listen)
    path(v, mode, w, h, pad) {
      const f = fnOf(v, mode);
      const X = (t) => pad + t * (w - 2 * pad), Y = (y) => pad + (Y1 - y) / (Y1 - Y0) * (h - 2 * pad);
      let d = '';
      for (let i = 0; i <= 48; i++) { const t = i / 48; d += (i ? 'L' : 'M') + X(t).toFixed(1) + ' ' + Y(f(t)).toFixed(1); }
      return d;
    },

    // Auswahl + Graph mit zwei Griffen + Vorschau-Punkt
    box(value, onChange, opts) {
      opts = opts || {};
      const mode = opts.mode || 'anim';
      let val = value || 'ease-in-out';
      const W = 200, H = 120, P = 12;
      const X = (t) => P + t * (W - 2 * P), Y = (y) => P + (Y1 - y) / (Y1 - Y0) * (H - 2 * P);
      const wrap = el('div', { class: 'cv-box' });
      const sel = el('select', { class: 'cv-sel', onchange: (e) => { if (e.target.value === 'cb') return; val = e.target.value; draw(); onChange(val); } });
      const fillSel = () => {
        sel.innerHTML = '';
        for (const [k, l] of Fx.EASE_LIST) sel.appendChild(el('option', { value: k, selected: k === val }, VN.t(l)));
        if (Fx.parseCb(val)) sel.appendChild(el('option', { value: 'cb', selected: true }, VN.t('Eigene Kurve')));
      };
      const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'cv-svg' });
      // Raster: 0 und 1 (Start- und Zielwert)
      svg.appendChild(sv('rect', { x: X(0), y: Y(1), width: X(1) - X(0), height: Y(0) - Y(1), class: 'cv-area' }));
      for (const y of [0, 1]) svg.appendChild(sv('line', { x1: X(0), x2: X(1), y1: Y(y), y2: Y(y), class: 'cv-grid' }));
      for (const x of [0.25, 0.5, 0.75]) svg.appendChild(sv('line', { x1: X(x), x2: X(x), y1: Y(1), y2: Y(0), class: 'cv-grid faint' }));
      const t0 = sv('text', { x: X(0) + 2, y: Y(0) - 3, class: 'cv-lbl' }); t0.textContent = opts.fromLabel || VN.t('vorher');
      const t1 = sv('text', { x: X(1) - 2, y: Y(1) + 9, class: 'cv-lbl', 'text-anchor': 'end' }); t1.textContent = opts.toLabel || VN.t('Keyframe');
      svg.append(t0, t1);
      const curve = sv('path', { class: 'cv-curve' });
      const l1 = sv('line', { class: 'cv-arm' }), l2 = sv('line', { class: 'cv-arm' });
      const h1 = sv('circle', { r: 5.5, class: 'cv-h' }), h2 = sv('circle', { r: 5.5, class: 'cv-h' });
      const dot = sv('circle', { r: 3.5, class: 'cv-dot' });
      svg.append(curve, l1, l2, h1, h2, dot);
      const draw = () => {
        curve.setAttribute('d', CurveEd.path(val, mode, W, H, P));
        const c = pts(val, mode);
        for (const n of [l1, l2, h1, h2]) n.style.display = c ? '' : 'none';
        if (c) {
          l1.setAttribute('x1', X(0)); l1.setAttribute('y1', Y(0)); l1.setAttribute('x2', X(c[0])); l1.setAttribute('y2', Y(clamp(c[1], Y0, Y1)));
          l2.setAttribute('x1', X(1)); l2.setAttribute('y1', Y(1)); l2.setAttribute('x2', X(c[2])); l2.setAttribute('y2', Y(clamp(c[3], Y0, Y1)));
          h1.setAttribute('cx', X(c[0])); h1.setAttribute('cy', Y(clamp(c[1], Y0, Y1)));
          h2.setAttribute('cx', X(c[2])); h2.setAttribute('cy', Y(clamp(c[3], Y0, Y1)));
        }
        fillSel();
      };
      const toVal = (ev) => {
        const m = svg.getScreenCTM(); if (!m) return [0, 0];
        const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
        return [clamp((p.x - P) / (W - 2 * P), 0, 1), clamp(Y1 - (p.y - P) / (H - 2 * P) * (Y1 - Y0), Y0, Y1)];
      };
      const grab = (i) => (e) => {
        e.preventDefault(); e.stopPropagation();
        const move = (ev) => {
          const c = pts(val, mode).slice();
          const [x, y] = toVal(ev);
          // Umschalt = Griff waagrecht halten (glatt an- oder auslaufen)
          c[i * 2] = Math.round(x * 100) / 100; c[i * 2 + 1] = ev.shiftKey ? (i ? 1 : 0) : Math.round(y * 100) / 100;
          val = fmt(c); draw();
        };
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); onChange(val); };
        window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
      };
      h1.addEventListener('mousedown', grab(0)); h2.addEventListener('mousedown', grab(1));
      // Doppelklick = wieder weich
      svg.addEventListener('dblclick', () => { val = 'ease-in-out'; draw(); onChange(val); });
      // Vorschau: Punkt läuft die Kurve entlang
      const t00 = performance.now();
      const tick = (now) => {
        if (!wrap.isConnected) { if (now - t00 > 2000) return; requestAnimationFrame(tick); return; }
        const cyc = ((now - t00) / 1000) % 2.2, u = Math.min(1, cyc / 1.6);
        const y = fnOf(val, mode)(u);
        dot.setAttribute('cx', X(u)); dot.setAttribute('cy', Y(clamp(y, Y0, Y1)));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      draw();
      wrap.append(
        el('div', { class: 'row gap8' }, opts.label ? el('span', { class: 'muted small' }, opts.label) : null, sel),
        svg,
        el('div', { class: 'muted small cv-hint' }, VN.t('Griffe ziehen = eigene Kurve · Umschalt = waagrecht · Doppelklick = zurücksetzen')));
      return wrap;
    }
  });
})();
