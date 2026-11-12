// Editor „Figuren → Gesicht“: Lippen, Kiefer, Augen und Brauen einzeichnen, Ausdrücke einstellen und testen
(function () {
  const { el } = VN;
  const NS = 'http://www.w3.org/2000/svg';
  const r4 = (v) => Math.round(v * 10000) / 10000;
  const TOOLS = [
    ['sel', '↖ Wählen', 'Punkte ziehen zum Anpassen · Rechtsklick auf einen Punkt löscht ihn · Doppelklick auf eine Linie fügt einen Punkt ein.'],
    ['up', '〰 Oberlippe', 'Mit dem Stift die Oberlippe nachziehen: vom linken zum rechten Mundwinkel klicken. Die Punkte rasten auf der dunklen Linie ein. Enter oder Doppelklick beendet.'],
    ['lo', '〰 Unterlippe', 'Die Unterlippe nachziehen (bei geschlossenem Mund nicht nötig). Erster und letzter Punkt werden automatisch zu den Mundwinkeln.'],
    ['jaw', '➰ Kiefer', 'Mit gedrückter Maus Unterlippe, Kinn und Kieferrand umfahren – das, was beim Öffnen mit nach unten geht. Der Hals gehört nicht dazu.'],
    ['pin', '📍 Gelenk', 'Kiefergelenke setzen: je ein Klick knapp vor die Ohren (meist unter den Haaren). Der Kiefer dreht sich ein Stück darum.'],
    ['eye', '👁 Wimpernlinie', 'Pro Auge die Unterkante der oberen Wimpern nachziehen, vom äußeren zum inneren Winkel. Die Dicke der Wimpern erkennt die Engine selbst.'],
    ['low', '👁 Unterlid', 'Die untere Augenlinie nachziehen. Ohne sie schätzt die Engine die Augenform.'],
    ['brow', '〰 Braue', 'Eine Augenbraue nachziehen. Die Seite zur Nase erkennt die Engine selbst.'],
    ['src', '▭ Stempel-Quelle', 'Ein Rechteck über glatte Haut ziehen (z. B. zwischen den Augen). Daraus entstehen die Augenlider.']
  ];
  const PEN = new Set(['up', 'lo', 'eye', 'low', 'brow']);

  const FaceEd = (window.FaceEd = {
    render(center) {
      center.innerHTML = '';
      const p = VN.project;
      p.faces = p.faces || {};
      const imgs = VN.assetsOf('image');
      if (!VN.asset(VN.ui.faceAsset)) VN.ui.faceAsset = (imgs.find((a) => p.faces[a.id]) || imgs.find((a) => /char|figur|kopf|face/i.test(a.name + a.file)) || imgs[0] || {}).id;
      const id = VN.ui.faceAsset;
      const mode = VN.ui.faceMode || 'setup';
      const f = p.faces[id] || null;
      const s = el('select', { class: 'small-input', onchange: (e) => { VN.ui.faceAsset = e.target.value; FaceEd._inst = null; VN.render(); } });
      for (const a of imgs) { const o = el('option', { value: a.id }, a.name + (p.faces[a.id] ? ' · ' + VN.t('mit Gesicht') : '')); if (a.id === id) o.selected = true; s.appendChild(o); }
      center.appendChild(el('div', { class: 'view-head' }, s,
        f ? el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: f.on !== false, onchange: (e) => VN.mutate(() => { f.on = e.target.checked; }) }), VN.t('aktiv')) : null,
        el('div', { class: 'spacer' }),
        el('div', { class: 'seg' }, ...[['setup', 'Einrichten'], ['expr', 'Ausdrücke'], ['test', '▶ Testen']].map(([k, l]) => el('button', { class: mode === k ? 'active' : '', onclick: () => { VN.ui.faceMode = k; VN.render(); } }, VN.t(l))))));
      const body = el('div', { class: 'soft-body' });
      center.appendChild(body);
      if (!id) { body.appendChild(el('div', { class: 'hint-box' }, VN.t('Importiere zuerst ein Figuren-Bild.'))); return; }
      const stage = el('div', { class: 'soft-stage face-stage' });
      body.append(stage, FaceEd.side(id, f, mode));
      FaceEd.stage(stage, id, f, mode);
    },

    // ---------- Bühne: verformtes Bild + Linien ----------
    stage(stage, id, f, mode) {
      const wrap = el('div', { class: 'face-wrap' });
      stage.appendChild(wrap);
      const src = new Image(); src.crossOrigin = 'anonymous'; src.src = VN.assetUrl(id);
      const show = el('canvas', { class: 'face-cv' });
      wrap.appendChild(show);
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'soft-svg');
      wrap.appendChild(svg);
      let W = 1, H = 1, pen = [], inst = null;
      const tool = () => (mode === 'setup' ? VN.ui.faceTool || 'sel' : 'sel');
      const toImg = (e) => { const b = show.getBoundingClientRect(); return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]; };
      const ready = () => {
        W = src.naturalWidth; H = src.naturalHeight;
        show.width = W; show.height = H;
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.setAttribute('preserveAspectRatio', 'none');
        // Bild ganz zeigen, ohne es zu verzerren
        const fitWrap = () => { const b = stage.getBoundingClientRect(); if (!b.width) return; const k = Math.min(b.width * 0.96 / W, b.height * 0.94 / H); wrap.style.width = Math.round(W * k) + 'px'; wrap.style.height = Math.round(H * k) + 'px'; };
        fitWrap(); new ResizeObserver(fitWrap).observe(stage);
        inst = Face.inst(id, src);
        FaceEd._inst = inst;
        FaceEd.applyPreview(inst, f, mode);
        drawLines();
        const loop = () => {
          if (!show.isConnected) return;
          const cv = Face.cfg(id) ? inst.surface() : null;
          const g = show.getContext('2d');
          if (cv) { if (cv._ver !== show._ver) { g.clearRect(0, 0, W, H); g.drawImage(cv, 0, 0); show._ver = cv._ver; } }
          else if (show._ver !== 'raw') { g.clearRect(0, 0, W, H); g.drawImage(src, 0, 0); show._ver = 'raw'; }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      };
      src.onload = ready;
      // Einrasten: dunkelsten Punkt im kleinen Umkreis suchen (Linien sind dunkel)
      let pix = null;
      const snap = (u, v) => {
        try {
          if (!pix) { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(src, 0, 0); pix = g.getImageData(0, 0, W, H).data; }
        } catch (e) { return [u, v]; }
        const R = Math.max(3, Math.round(Math.min(W, H) * 0.006)), cx = Math.round(u * W), cy = Math.round(v * H);
        let best = null, bl = 1e9;
        for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H || (x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
          const i = (y * W + x) * 4, l = (0.3 * pix[i] + 0.59 * pix[i + 1] + 0.11 * pix[i + 2]) + Math.hypot(x - cx, y - cy) * 3;
          if (pix[i + 3] > 40 && l < bl) { bl = l; best = [x, y]; }
        }
        return best ? [best[0] / W, best[1] / H] : [u, v];
      };
      const mk = (tag, at) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(at)) n.setAttribute(k, v); return n; };
      const pathOf = (pts, close) => pts.map((q, i) => (i ? 'L' : 'M') + (q[0] * W).toFixed(1) + ' ' + (q[1] * H).toFixed(1)).join(' ') + (close ? ' Z' : '');
      const hs = () => Math.max(3, Math.min(W, H) * 0.006);
      // alle Linien des Gesichts mit Rolle, für Anzeige und Bearbeiten
      const parts = () => {
        const F = VN.project.faces[id]; if (!F) return [];
        const out = [];
        if (F.mouth.up.length) out.push({ k: 'up', pts: F.mouth.up, col: '#e2588a', lbl: 'Oberlippe' });
        if (F.mouth.lo.length) out.push({ k: 'lo', pts: F.mouth.lo, col: '#e2588a', lbl: 'Unterlippe' });
        if (F.jaw.poly.length) out.push({ k: 'jaw', pts: F.jaw.poly, col: '#3fbfa6', close: true, dash: true, lbl: 'Kiefer' });
        F.eyes.forEach((e, i) => { if (e.bot) out.push({ k: 'eye' + i, pts: e.bot, col: '#b58cff', lbl: 'Wimpern' }); if (e.low && e.low.length) out.push({ k: 'low' + i, pts: e.low, col: '#b58cff', dash: true, lbl: 'Unterlid' }); });
        F.brows.forEach((b, i) => out.push({ k: 'b' + i, pts: b.pts, col: '#5ab4ff', lbl: 'Braue' }));
        return out;
      };
      // Ausdruck formen: Lippen- und Brauenpunkte an der verschobenen Stelle zeigen
      const shapeMode = () => mode === 'expr' && VN.ui.faceShape && FaceEd.customSel(f);
      function drawLines() {
        svg.innerHTML = '';
        const F = VN.project.faces[id];
        if (mode === 'test') return;
        const r = hs();
        if (F && mode === 'setup') {
          for (const P of parts()) {
            const line = mk('path', { d: pathOf(P.pts, P.close), fill: P.close ? 'rgba(63,191,166,0.08)' : 'none', stroke: P.col, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' });
            if (P.dash) line.setAttribute('stroke-dasharray', '6 4');
            line.style.cursor = 'copy';
            line.addEventListener('dblclick', (ev) => { ev.stopPropagation(); insertPt(P, toImg(ev)); });
            svg.appendChild(line);
            if (tool() !== 'sel') continue;
            P.pts.forEach((q, i) => {
              const c = mk('circle', { cx: q[0] * W, cy: q[1] * H, r, fill: '#fff', stroke: P.col, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' });
              c.style.cursor = 'move';
              c.addEventListener('mousedown', (ev) => { ev.stopPropagation(); ev.preventDefault(); dragPt(ev, P, i); });
              c.addEventListener('contextmenu', (ev) => { ev.preventDefault(); ev.stopPropagation(); if (P.pts.length > (P.close ? 3 : 2)) VN.mutate(() => { P.pts.splice(i, 1); touch(); }); });
              svg.appendChild(c);
            });
          }
          for (const q of F.jaw.pins) {
            const c = mk('circle', { cx: q[0] * W, cy: q[1] * H, r: r * 1.8, fill: 'rgba(255,93,108,0.3)', stroke: '#ff5d6c', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' });
            c.style.cursor = 'move';
            c.addEventListener('mousedown', (ev) => { ev.stopPropagation(); ev.preventDefault(); dragPt(ev, { pts: F.jaw.pins }, F.jaw.pins.indexOf(q)); });
            c.addEventListener('contextmenu', (ev) => { ev.preventDefault(); ev.stopPropagation(); VN.mutate(() => { F.jaw.pins.splice(F.jaw.pins.indexOf(q), 1); touch(); }); });
            svg.appendChild(c);
          }
          if (F.src) {
            const R = mk('rect', { x: F.src.x * W, y: F.src.y * H, width: F.src.w * W, height: F.src.h * H, fill: 'rgba(255,255,255,0.08)', stroke: '#fff', 'stroke-width': 1.5, 'stroke-dasharray': '5 4', 'vector-effect': 'non-scaling-stroke' });
            R.style.cursor = 'move';
            R.addEventListener('mousedown', (ev) => { if (tool() !== 'sel') return; ev.stopPropagation(); ev.preventDefault(); dragSrc(ev); });
            svg.appendChild(R);
          }
        }
        if (F && shapeMode()) {
          const x = FaceEd.customSel(f), mg = Face.mouthGeo(F, W, H);
          const groups = [];
          if (F.mouth.up.length) groups.push(['up', F.mouth.up, '#e2588a']);
          if (F.mouth.lo.length) groups.push(['lo', F.mouth.lo, '#e2588a']);
          F.brows.forEach((b, i) => groups.push(['b' + i, b.pts, '#5ab4ff']));
          for (const [part, pts] of groups) {
            const sorted = pts.length >= 2 && pts[0][0] > pts[pts.length - 1][0];
            const base = sorted ? pts.slice().reverse() : pts;
            base.forEach((q, i) => {
              const o = (x.offs && x.offs[part] && x.offs[part][i]) || [0, 0];
              const c = mk('circle', { cx: (q[0] + o[0]) * W, cy: (q[1] + o[1]) * H, r: r * 1.3, fill: '#e8a43a', stroke: '#7a4a0a', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' });
              c.style.cursor = 'move';
              c.addEventListener('mousedown', (ev) => { ev.stopPropagation(); ev.preventDefault(); dragOff(ev, x, part, i, base.length); });
              svg.appendChild(c);
            });
          }
          void mg;
        }
        if (pen.length) {
          svg.appendChild(mk('path', { d: pathOf(pen, false), fill: 'none', stroke: '#e8a43a', 'stroke-width': 2, 'stroke-dasharray': '5 3', 'vector-effect': 'non-scaling-stroke' }));
          for (const q of pen) svg.appendChild(mk('circle', { cx: q[0] * W, cy: q[1] * H, r, fill: '#e8a43a' }));
        }
      }
      FaceEd._redraw = drawLines;
      const touch = () => { const F = VN.project.faces[id]; if (F) F._rev = (F._rev || 0) + 1; };
      function ensure() { VN.project.faces[id] = VN.project.faces[id] || Face.blank(); return VN.project.faces[id]; }
      function insertPt(P, at) {
        let best = 0, bd = 1e9;
        const n = P.close ? P.pts.length : P.pts.length - 1;
        for (let i = 0; i < n; i++) { const a = P.pts[i], b = P.pts[(i + 1) % P.pts.length]; const ex = b[0] - a[0], ey = b[1] - a[1], t = Math.max(0, Math.min(1, ((at[0] - a[0]) * ex + (at[1] - a[1]) * ey) / (ex * ex + ey * ey || 1e-9))); const d = Math.hypot(at[0] - a[0] - ex * t, at[1] - a[1] - ey * t); if (d < bd) { bd = d; best = i; } }
        VN.mutate(() => { P.pts.splice(best + 1, 0, [r4(at[0]), r4(at[1])]); touch(); });
      }
      function dragPt(ev, P, i) {
        const o = P.pts[i].slice(), [u0, v0] = toImg(ev);
        VN.drag(ev, (dx, dy, e) => { const [u, v] = toImg(e); P.pts[i] = [o[0] + u - u0, o[1] + v - v0]; touch(); drawLines(); }, (dx, dy, moved) => {
          if (!moved) return; const nv = [r4(P.pts[i][0]), r4(P.pts[i][1])]; P.pts[i] = o; VN.mutate(() => { P.pts[i] = nv; touch(); });
        });
      }
      function dragSrc(ev) {
        const F = VN.project.faces[id], o = Object.assign({}, F.src), [u0, v0] = toImg(ev);
        VN.drag(ev, (dx, dy, e) => { const [u, v] = toImg(e); F.src.x = o.x + u - u0; F.src.y = o.y + v - v0; touch(); drawLines(); }, (dx, dy, moved) => {
          if (!moved) return; const nv = { x: r4(F.src.x), y: r4(F.src.y), w: o.w, h: o.h }; F.src = o; VN.mutate(() => { F.src = nv; touch(); });
        });
      }
      function dragOff(ev, x, part, i, n) {
        x.offs = x.offs || {}; x.offs[part] = x.offs[part] || Array.from({ length: n }, () => [0, 0]);
        const arr = x.offs[part], o = (arr[i] || [0, 0]).slice(), [u0, v0] = toImg(ev);
        VN.drag(ev, (dx, dy, e) => { const [u, v] = toImg(e); arr[i] = [o[0] + u - u0, o[1] + v - v0]; FaceEd.applyPreview(inst, f, mode); drawLines(); }, (dx, dy, moved) => {
          if (!moved) return; const nv = [r4(arr[i][0]), r4(arr[i][1])]; arr[i] = o; VN.mutate(() => { arr[i] = nv; });
        });
      }
      function finishPen() {
        const t = tool(), pts = pen.map((q) => [r4(q[0]), r4(q[1])]);
        pen = [];
        if (pts.length < 2) { drawLines(); return; }
        VN.mutate(() => {
          const F = ensure();
          if (t === 'up') F.mouth.up = pts;
          else if (t === 'lo') F.mouth.lo = pts;
          else if (t === 'eye') F.eyes.push({ bot: pts, low: [] });
          else if (t === 'low') {
            const cx = (pts[0][0] + pts[pts.length - 1][0]) / 2;
            let best = F.eyes[0], bd = 1e9;
            for (const e of F.eyes) { const ex = (e.bot[0][0] + e.bot[e.bot.length - 1][0]) / 2; if (Math.abs(ex - cx) < bd) { bd = Math.abs(ex - cx); best = e; } }
            if (best) best.low = pts; else F.eyes.push({ bot: pts, low: [] });
          } else if (t === 'brow') {
            // Seite zur Nase: die Seite näher an der Bildmitte bzw. am Mund
            const mx = F.mouth.up.length ? (F.mouth.up[0][0] + F.mouth.up[F.mouth.up.length - 1][0]) / 2 : 0.5;
            const sorted = pts[0][0] <= pts[pts.length - 1][0] ? pts : pts.slice().reverse();
            const inner = Math.abs(sorted[sorted.length - 1][0] - mx) < Math.abs(sorted[0][0] - mx) ? 1 : 0;
            F.brows.push({ pts: sorted, inner });
          }
          // Stempel-Quelle automatisch zwischen die Augen, sobald zwei Augen da sind
          if (!F.src && F.eyes.length >= 2) {
            const ex = F.eyes.map((e) => ({ x0: Math.min(...e.bot.map((q) => q[0])), x1: Math.max(...e.bot.map((q) => q[0])), y: Math.min(...e.bot.map((q) => q[1])) })).sort((a, b) => a.x0 - b.x0);
            const left = ex[0].x1, right = ex[1].x0, w = Math.max(0.02, (right - left) * 0.7);
            if (right > left) F.src = { x: r4((left + right) / 2 - w / 2), y: r4(Math.min(ex[0].y, ex[1].y) - w * 0.15 * W / H), w: r4(w), h: r4(w * 0.5 * W / H) };
          }
          touch();
        });
      }
      FaceEd._pen = { active: () => pen.length > 0, finish: finishPen, cancel: () => { pen = []; drawLines(); } };
      stage.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || mode !== 'setup') return;
        const t = tool();
        if (t === 'sel') return;
        e.preventDefault();
        const at = toImg(e);
        if (PEN.has(t)) {
          if (e.detail >= 2) { finishPen(); return; }
          pen.push(e.altKey ? at : snap(at[0], at[1])); drawLines(); return;
        }
        if (t === 'pin') { VN.mutate(() => { const F = ensure(); if (F.jaw.pins.length >= 2) F.jaw.pins.shift(); F.jaw.pins.push([r4(at[0]), r4(at[1])]); touch(); }); return; }
        if (t === 'jaw') {
          const pts = [at], b = show.getBoundingClientRect();
          const line = mk('path', { fill: 'rgba(63,191,166,0.1)', stroke: '#3fbfa6', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke', d: '' }); svg.appendChild(line);
          VN.drag(e, (dx, dy, ev) => { const q = toImg(ev), l = pts[pts.length - 1]; if (Math.hypot((q[0] - l[0]) * b.width, (q[1] - l[1]) * b.height) >= 5) { pts.push(q); line.setAttribute('d', pathOf(pts, true)); } }, () => {
            if (pts.length < 4) { line.remove(); return; }
            const step = Math.max(1, Math.floor(pts.length / 40));
            VN.mutate(() => { const F = ensure(); F.jaw.poly = pts.filter((q, i) => i % step === 0).map((q) => [r4(q[0]), r4(q[1])]); touch(); });
          });
          return;
        }
        if (t === 'src') {
          const rect = mk('rect', { fill: 'rgba(255,255,255,0.1)', stroke: '#fff', 'stroke-dasharray': '5 4', 'vector-effect': 'non-scaling-stroke' }); svg.appendChild(rect);
          let box = null;
          VN.drag(e, (dx, dy, ev) => { const q = toImg(ev); box = { x: Math.min(at[0], q[0]), y: Math.min(at[1], q[1]), w: Math.abs(q[0] - at[0]), h: Math.abs(q[1] - at[1]) }; rect.setAttribute('x', box.x * W); rect.setAttribute('y', box.y * H); rect.setAttribute('width', box.w * W); rect.setAttribute('height', box.h * H); }, () => {
            if (!box || box.w < 0.005 || box.h < 0.004) { rect.remove(); return; }
            VN.mutate(() => { const F = ensure(); F.src = { x: r4(box.x), y: r4(box.y), w: r4(box.w), h: r4(box.h) }; touch(); });
          });
        }
      });
    },

    // Vorschau im Editor: Einrichten = neutral, Ausdrücke = gewählter Ausdruck, Testen = Übergänge
    applyPreview(inst, f, mode) {
      if (!inst) return;
      if (mode === 'expr') {
        const F = VN.project.faces[inst.assetId];
        const x = Face.expr(F, VN.ui.faceExprSel || 'smile'), amt = VN.ui.faceAmt != null ? VN.ui.faceAmt : 1;
        const sn = Face.snap(F, x.id, amt);
        inst.setVals(sn.vals, sn.offs);
      } else if (mode === 'setup') inst.setVals({}, {});
    },
    customSel(f) { return f && (f.exprs || []).find((x) => x.id === VN.ui.faceExprSel); },

    // ---------- Seitenleiste ----------
    side(id, f, mode) {
      const side = el('div', { class: 'soft-side' });
      const card = (title, ...kids) => el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t(title)), ...kids);
      if (mode === 'setup') {
        const cur = VN.ui.faceTool || 'sel';
        const tools = el('div', { class: 'face-tools' }, ...TOOLS.map(([k, l]) => el('button', { class: 'btn tiny' + (cur === k ? ' primary' : ''), onclick: () => { VN.ui.faceTool = k; VN.render(); } }, VN.t(l))));
        side.appendChild(card('Werkzeug', tools, el('div', { class: 'muted small' }, VN.t((TOOLS.find((x) => x[0] === cur) || TOOLS[0])[2]))));
        const F = f;
        const row = (ok, label, tool, del) => el('div', { class: 'soft-item' },
          el('span', { class: ok ? 'face-ok' : 'face-miss' }, ok ? '✓' : '○'), el('span', { class: 'grow' }, VN.t(label)),
          el('button', { class: 'btn tiny', onclick: () => { VN.ui.faceTool = tool; VN.render(); } }, VN.t(ok ? 'neu' : 'zeichnen')),
          ok && del ? el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { del(); F._rev = (F._rev || 0) + 1; }) }, '×') : null);
        const list = el('div', { class: 'soft-list' });
        list.append(
          row(F && F.mouth.up.length >= 2, 'Oberlippe', 'up', () => { F.mouth.up = []; }),
          row(F && F.mouth.lo.length >= 2, 'Unterlippe (optional)', 'lo', () => { F.mouth.lo = []; }),
          row(F && F.jaw.poly.length >= 3, 'Kiefer (optional)', 'jaw', () => { F.jaw.poly = []; }),
          row(F && F.jaw.pins.length >= 1, VN.t('Kiefergelenke') + ' (' + (F ? F.jaw.pins.length : 0) + '/2)', 'pin', () => { F.jaw.pins = []; }));
        (F ? F.eyes : []).forEach((e, i) => list.append(row(true, VN.t('Auge') + ' ' + (i + 1) + (e.low && e.low.length ? ' · ' + VN.t('mit Unterlid') : ''), 'eye', () => { F.eyes.splice(i, 1); })));
        if (!F || !F.eyes.length) list.append(row(false, 'Auge (Wimpernlinie)', 'eye'));
        (F ? F.brows : []).forEach((b, i) => list.append(row(true, VN.t('Braue') + ' ' + (i + 1), 'brow', () => { F.brows.splice(i, 1); })));
        if (!F || !F.brows.length) list.append(row(false, 'Braue (optional)', 'brow'));
        list.append(row(F && !!F.src, 'Stempel-Quelle für die Lider', 'src', () => { F.src = null; }));
        side.appendChild(card('Teile', list));
        if (F) {
          const sl = (label, val, min, max, step, commit, fmt) => {
            const out = el('span', { class: 'muted small' }, fmt ? fmt(val) : String(val));
            return el('label', { class: 'soft-sl' }, el('span', null, VN.t(label)),
              el('input', { type: 'range', min, max, step, value: val, oninput: (e) => { out.textContent = fmt ? fmt(Number(e.target.value)) : e.target.value; }, onchange: (e) => VN.mutate(() => { commit(Number(e.target.value)); F._rev = (F._rev || 0) + 1; }) }), out);
          };
          const innerSel = el('select', { onchange: (e) => VN.mutate(() => { F.mouth.inner = e.target.value; F._rev = (F._rev || 0) + 1; }) });
          for (const [k, l] of [['built', 'Eingebaut'], ['none', 'Aus dem Bild']]) { const o = el('option', { value: k }, VN.t(l)); if ((F.mouth.inner || 'built') === k) o.selected = true; innerSel.appendChild(o); }
          side.appendChild(card('Einstellungen',
            sl('Mund-Maske', F.mouth.mask || 1, 0.6, 1.6, 0.05, (v) => { F.mouth.mask = v; }, (v) => Math.round(v * 100) + ' %'),
            el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '112px' } }, VN.t('Mundinneres')), innerSel,
              el('input', { type: 'color', value: F.mouth.color || '#4a1621', onchange: (e) => VN.mutate(() => { F.mouth.color = e.target.value; F._rev = (F._rev || 0) + 1; }) })),
            el('div', { class: 'logic-row' },
              el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: F.mouth.tongue !== false, onchange: (e) => VN.mutate(() => { F.mouth.tongue = e.target.checked; F._rev = (F._rev || 0) + 1; }) }), VN.t('Zunge')),
              el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!F.mouth.teeth, onchange: (e) => VN.mutate(() => { F.mouth.teeth = e.target.checked; F._rev = (F._rev || 0) + 1; }) }), VN.t('Zähne'))),
            sl('Weiche Kante', F.soft != null ? F.soft : 4, 0, 10, 0.5, (v) => { F.soft = v; }),
            sl('Wimpern-Dicke', F.lash || 0, 0, 0.25, 0.01, (v) => { F.lash = v; }, (v) => (v ? Math.round(v * 100) + ' %' : VN.t('auto'))),
            el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: F.blink !== false, onchange: (e) => VN.mutate(() => { F.blink = e.target.checked; }) }), VN.t('Von selbst blinzeln'))));
        }
      } else if (mode === 'expr') {
        const F = f;
        if (!F) { side.appendChild(el('div', { class: 'hint-box' }, VN.t('Richte zuerst unter „Einrichten“ Mund, Augen oder Brauen ein.'))); return side; }
        const selId = VN.ui.faceExprSel || 'smile';
        const chips = el('div', { class: 'face-chips' }, ...Face.exprList(F).map((x) => el('button', { class: 'btn tiny' + (x.id === selId ? ' primary' : ''), onclick: () => { VN.ui.faceExprSel = x.id; VN.ui.faceShape = false; VN.render(); } }, VN.t(x.name))));
        side.appendChild(card('Ausdrücke', chips,
          el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const base = Face.expr(F, selId); const n = { id: VN.uid('fx'), name: VN.t('Eigener Ausdruck') + ' ' + ((F.exprs || []).length + 1), vals: Object.assign({}, base.vals), offs: JSON.parse(JSON.stringify(base.offs || {})) }; F.exprs = F.exprs || []; F.exprs.push(n); VN.ui.faceExprSel = n.id; }) }, VN.t('+ Eigener Ausdruck (aus dem gewählten)'))));
        const x = Face.expr(F, selId), custom = FaceEd.customSel(F);
        const amt = VN.ui.faceAmt != null ? VN.ui.faceAmt : 1;
        const sliders = Face.SLIDERS.map(([k, label, min, max]) => {
          const val = (x.vals && x.vals[k]) || 0;
          const out = el('span', { class: 'muted small' }, val.toFixed(2));
          return el('label', { class: 'soft-sl' }, el('span', null, VN.t(label)),
            el('input', { type: 'range', min, max, step: 0.05, value: val, disabled: !custom,
              oninput: (e) => { out.textContent = Number(e.target.value).toFixed(2); custom.vals[k] = Number(e.target.value); FaceEd.applyPreview(FaceEd._inst, F, 'expr'); },
              onchange: (e) => { const nv = Number(e.target.value); custom.vals[k] = val; VN.mutate(() => { custom.vals[k] = nv; }); } }), out);
        });
        side.appendChild(card(custom ? 'Eigener Ausdruck' : 'Vorlage',
          custom ? el('div', { class: 'logic-row' }, el('input', { type: 'text', value: custom.name, style: { flex: 1 }, onchange: (e) => VN.mutate(() => { custom.name = e.target.value; }) })) : el('div', { class: 'muted small' }, VN.t('Vorlagen sind fest. Mit „+ Eigener Ausdruck“ entsteht eine Kopie, die du anpassen kannst.')),
          ...sliders,
          el('label', { class: 'soft-sl' }, el('span', null, VN.t('Vorschau-Stärke')), el('input', { type: 'range', min: 0, max: 1.5, step: 0.05, value: amt, oninput: (e) => { VN.ui.faceAmt = Number(e.target.value); FaceEd.applyPreview(FaceEd._inst, F, 'expr'); } }), el('span', { class: 'muted small' }, Math.round(amt * 100) + ' %')),
          custom ? el('div', { class: 'logic-row', style: { flexWrap: 'wrap' } },
            el('button', { class: 'btn tiny' + (VN.ui.faceShape ? ' primary' : ''), onclick: () => { VN.ui.faceShape = !VN.ui.faceShape; VN.render(); } }, VN.t('✋ Punkte formen')),
            el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { custom.offs = {}; }) }, VN.t('Punkte zurücksetzen')),
            el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { F.exprs.splice(F.exprs.indexOf(custom), 1); VN.ui.faceExprSel = 'smile'; }) }, VN.t('Entfernen'))) : null,
          custom && VN.ui.faceShape ? el('div', { class: 'muted small' }, VN.t('Ziehe die orangen Punkte (Lippen und Brauen) in die Stellung dieses Ausdrucks. Gespeichert wird nur, wie weit jeder Punkt wandert.')) : null));
      } else {
        const F = f;
        if (!F) { side.appendChild(el('div', { class: 'hint-box' }, VN.t('Richte zuerst unter „Einrichten“ Mund, Augen oder Brauen ein.'))); return side; }
        const go = (id2) => { if (FaceEd._inst) FaceEd._inst.setExpr(id2, 1, 0.35); };
        side.appendChild(card('Testen',
          el('div', { class: 'face-chips' }, ...Face.exprList(F).map((x) => el('button', { class: 'btn tiny', onclick: () => go(x.id) }, VN.t(x.name)))),
          el('div', { class: 'logic-row', style: { flexWrap: 'wrap' } },
            el('button', { class: 'btn tiny', onclick: () => FaceEd._inst && FaceEd._inst.blink() }, VN.t('Blinzeln')),
            el('button', { class: 'btn tiny', id: 'face-talk', onclick: (e) => FaceEd.talk(e.currentTarget) }, VN.t('Sprechen testen'))),
          el('div', { class: 'muted small' }, VN.t('So sieht es im Spiel aus: Ausdrücke blenden weich über, beim Sprechen öffnet sich der Mund mit der Lautstärke der Stimme, und die Figur blinzelt von selbst.'))));
      }
      return side;
    },
    // Sprechen simulieren (wie der Lippensync mit der Stimme)
    talk(btn) {
      const it = FaceEd._inst; if (!it) return;
      if (FaceEd._talking) { FaceEd._talking = false; it.talk = 0; btn.classList.remove('primary'); return; }
      FaceEd._talking = true; btn.classList.add('primary');
      const t0 = performance.now();
      const step = () => { if (!FaceEd._talking || !btn.isConnected) { it.talk = 0; FaceEd._talking = false; return; } const t = (performance.now() - t0) / 1000; const v = Math.max(0, Math.sin(t * 11) * 0.6 + Math.sin(t * 4.3) * 0.4); it.talk = (t % 2.6) > 2.1 ? 0 : v; requestAnimationFrame(step); };
      requestAnimationFrame(step);
    },
    inspector() {
      return el('div', { class: 'insp' }, el('div', null, el('h3', null, VN.t('Figuren')), el('div', { class: 'insp-title' }, VN.t('Gesicht'))),
        el('div', { class: 'hint-box' }, el('strong', null, VN.t('So geht’s')), el('br'),
          VN.t('1. Oberlippe (und bei offenem Mund die Unterlippe) mit dem Stift nachziehen. 2. Optional den Kiefer umfahren und die Gelenke vor die Ohren setzen. 3. Pro Auge die Wimpernlinie, optional das Unterlid. 4. Brauen nachziehen. 5. Die Stempel-Quelle über glatte Haut legen.'), el('br'), el('br'),
          VN.t('Das Bild wird nicht getauscht: Die Engine verbiegt es über ein feines Gitter. Lider entstehen aus Haut von der Stempel-Quelle – links, rechts und oben weich, an den Wimpern hart.'), el('br'), el('br'),
          VN.t('Ausdruck setzen: am Figuren-Clip (Inspektor) oder mit der Aktion „🙂 Gesicht: Ausdruck“. Beim Sprechen öffnet der Lippensync den echten Mund. Mit der Weich-Physik auf demselben Bild kombinierbar.')));
    }
  });

  // Tasten: Enter beendet, Esc bricht ab (Stift)
  document.addEventListener('keydown', (e) => {
    if (!VN.ui || VN.ui.view !== 'bones' || VN.ui.figSub !== 'face') return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) return;
    const pen = FaceEd._pen;
    if (pen && pen.active() && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); e.stopPropagation(); if (e.key === 'Enter') pen.finish(); else pen.cancel(); }
  }, true);
})();
