// Editor „Figuren → Weich-Physik“: Ellipsen-Masken aufs Bild ziehen, Vorlage wählen, testen
(function () {
  const { el } = VN;
  const NS = 'http://www.w3.org/2000/svg';
  const r4 = (v) => Math.round(v * 10000) / 10000;
  const SLIDERS = [
    ['strength', 'Stärke', 0, 2, 0.05],
    ['k', 'Federhärte', 10, 300, 1],
    ['c', 'Dämpfung', 0.5, 20, 0.1],
    ['xs', 'Seitlich', 0, 1.5, 0.05],
    ['squash', 'Stauchen', 0, 1.5, 0.05],
    ['feather', 'Weicher Rand', 0.05, 0.9, 0.01],
    ['over', 'Über den Rand', 0, 0.8, 0.01],
    ['anchorAmt', 'Anker-Stärke', 0, 1, 0.05],
    ['idleAmp', 'Ruhe: Stärke', 0, 2, 0.05],
    ['idleSpeed', 'Ruhe: Tempo', 0.2, 4, 0.05],
    ['twitch', 'Zucken (angespannt)', 0, 2, 0.05],
    ['pulse', 'Puls (Herzschlag)', 0, 2, 0.05],
    ['bpm', 'Puls: Schläge/Min', 30, 180, 1]
  ];

  const TOOLS = [['select', '↖ Wählen'], ['ellipse', '◯ Ellipse'], ['lasso', '➰ Lasso'], ['pen', '✒ Stift']];
  const TOOL_HINT = {
    select: 'Bereich anklicken zum Wählen, ziehen zum Verschieben. Bei freien Formen die Punkte ziehen. Für einen neuen Bereich oben ein Werkzeug wählen.',
    ellipse: 'Zieh im Bild eine Ellipse um die Stelle, die weich sein soll (z. B. jede Brust einzeln). Außerhalb der Maske bleibt alles ruhig.',
    lasso: 'Fahr mit gedrückter Maus um die Stelle. Beim Loslassen schließt sich die Form und wird geglättet.',
    pen: 'Klick setzt eine Ecke, Klicken und Ziehen einen runden Punkt. Klick auf den ersten Punkt, Doppelklick oder Enter schließt die Form, Esc bricht ab.'
  };

  // Tasten im Weich-Physik-Editor: Enter/Esc für den Zeichenstift, Entf löscht den gewählten Punkt
  document.addEventListener('keydown', (e) => {
    if (!VN.ui || VN.ui.view !== 'bones' || VN.ui.figSub !== 'soft' || VN.ui.softTest) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) return;
    const pen = SoftEd._pen;
    if (pen && pen.active() && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); e.stopPropagation(); if (e.key === 'Enter') pen.finish(); else pen.cancel(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && SoftEd._pt != null) {
      const d = Soft.data(VN.ui.softAsset), r = d && (d.regions || []).find((x) => x.id === VN.ui.softSel);
      if (r && r.pts && r.pts.length > 3 && r.pts[SoftEd._pt]) { e.preventDefault(); e.stopPropagation(); const i = SoftEd._pt; SoftEd._pt = null; VN.mutate(() => { r.pts.splice(i, 1); }); }
    }
  }, true);

  const SoftEd = (window.SoftEd = {
    render(center) {
      center.innerHTML = '';
      const p = VN.project;
      p.softs = p.softs || {};
      const imgs = VN.assetsOf('image');
      if (!VN.asset(VN.ui.softAsset)) VN.ui.softAsset = (imgs.find((a) => p.softs[a.id]) || imgs.find((a) => /char|figur/i.test(a.name + a.file)) || imgs[0] || {}).id;
      const id = VN.ui.softAsset;
      const data = p.softs[id] || null;
      const testing = !!VN.ui.softTest && data;
      const s = el('select', { class: 'small-input', onchange: (e) => { VN.ui.softAsset = e.target.value; VN.ui.softSel = null; VN.render(); } });
      for (const a of imgs) { const o = el('option', { value: a.id }, a.name + (p.softs[a.id] && (p.softs[a.id].regions || []).length ? ' · ' + VN.t('mit Weich-Physik') : '')); if (a.id === id) o.selected = true; s.appendChild(o); }
      center.appendChild(el('div', { class: 'view-head' }, s,
        data ? el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: data.on !== false, onchange: (e) => VN.mutate(() => { data.on = e.target.checked; }) }), VN.t('aktiv')) : null,
        el('div', { class: 'spacer' }),
        data && (data.regions || []).length ? el('div', { class: 'seg' },
          el('button', { class: !testing ? 'active' : '', onclick: () => { VN.ui.softTest = false; VN.render(); } }, VN.t('Bereiche')),
          el('button', { class: testing ? 'active' : '', onclick: () => { VN.ui.softTest = true; VN.render(); } }, VN.t('▶ Testen'))) : null));
      const body = el('div', { class: 'soft-body' });
      center.appendChild(body);
      if (!id) { body.appendChild(el('div', { class: 'hint-box' }, VN.t('Importiere zuerst ein Figuren-Bild (PNG mit transparentem Hintergrund).'))); return; }
      const stage = el('div', { class: 'soft-stage' });
      body.append(stage, SoftEd.side(id, data));
      if (testing) SoftEd.test(stage, id);
      else SoftEd.edit(stage, id, data);
    },

    // ---------- Bereiche zeichnen ----------
    edit(stage, id, data) {
      const p = VN.project;
      const wrap = el('span', { class: 'char-inner soft-imgwrap' });
      const img = el('img', { src: VN.assetUrl(id), draggable: 'false' });
      wrap.appendChild(img);
      stage.appendChild(wrap);
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'soft-svg');
      wrap.appendChild(svg);
      const setup = () => {
        const W = img.naturalWidth || 1000, H = img.naturalHeight || 1000;
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        draw();
        // Vorschau: das Bild atmet schon im Bearbeiten-Modus mit
        if (data && data.on !== false && window.Soft && !wrap.querySelector('.soft-canvas')) Soft.attach(wrap, id);
      };
      if (img.complete && img.naturalWidth) requestAnimationFrame(setup); else img.addEventListener('load', setup);
      const regs = () => (data && data.regions) || [];
      const toImg = (e) => { const b = img.getBoundingClientRect(); return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]; };
      const isPoly = (r) => r.shape === 'poly' && r.pts && r.pts.length >= 3;
      const mk = (tag, at) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(at)) n.setAttribute(k, v); return n; };
      const pathOf = (pts, W, H, close) => pts.map((q, i) => (i ? 'L' : 'M') + (q[0] * W).toFixed(1) + ' ' + (q[1] * H).toFixed(1)).join(' ') + (close ? ' Z' : '');
      const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      // Zeichen-Werkzeuge zeichnen auch über bestehende Bereiche hinweg (Wählen nur mit „Auswählen“)
      const drawing = () => (VN.ui.softTool || 'select') !== 'select' || !!VN.ui.softPinMode;
      // Zeichenstift: Punkte in Arbeit (noch kein Bereich)
      let pen = [];
      SoftEd._pen = { finish: () => finishPen(), cancel: () => { pen = []; draw(); }, active: () => pen.length > 0 };
      function draw() {
        svg.innerHTML = '';
        const W = img.naturalWidth || 1000, H = img.naturalHeight || 1000;
        const hs = Math.max(6, H * 0.008);
        for (const r of regs()) {
          const sel = VN.ui.softSel === r.id;
          const cls = 'sr' + (sel ? ' sel' : '') + (r.on === false ? ' off' : '');
          const name = r.name || VN.t((Soft.PRESETS[r.preset] || {}).label || 'Bereich');
          if (isPoly(r)) {
            const g = mk('g', {});
            const sh = mk('path', { d: pathOf(Soft.outline(r), W, H, true), class: cls });
            sh.addEventListener('mousedown', (ev) => {
              if (drawing()) return;
              stop(ev);
              // Doppelklick auf den Umriss: Punkt einfügen (zweiter Klick trifft das neu gezeichnete Element)
              if (ev.detail >= 2 && VN.ui.softSel === r.id) { insertPt(r, toImg(ev)); return; }
              const was = VN.ui.softSel; VN.ui.softSel = r.id; drag(ev, r, 'move', null, was !== r.id);
            });
            g.appendChild(sh);
            const b = Soft.box(r, W / H);
            const lbl = mk('text', { x: b.cx * W, y: b.cy * H + H * 0.007, 'text-anchor': 'middle', class: 'sr-lbl', 'font-size': Math.round(H * 0.02) }); lbl.textContent = name;
            g.appendChild(lbl);
            if (sel && !drawing()) r.pts.forEach((q, i) => {
              const c = mk(q[2] ? 'rect' : 'circle', q[2] ? { x: q[0] * W - hs, y: q[1] * H - hs, width: hs * 2, height: hs * 2, class: 'sr-h sr-pt' + (SoftEd._pt === i ? ' on' : '') } : { cx: q[0] * W, cy: q[1] * H, r: hs, class: 'sr-h sr-pt' + (SoftEd._pt === i ? ' on' : '') });
              c.addEventListener('mousedown', (ev) => {
                stop(ev);
                if (ev.altKey) { VN.mutate(() => { if (q[2]) q.length = 2; else q[2] = 1; }); return; } // Alt-Klick: Ecke ↔ rund
                SoftEd._pt = i; drag(ev, r, 'pt', i);
              });
              c.addEventListener('contextmenu', (ev) => { stop(ev); if (r.pts.length > 3) VN.mutate(() => { r.pts.splice(i, 1); SoftEd._pt = null; }); });
              g.appendChild(c);
            });
            svg.appendChild(g);
            continue;
          }
          const cx = r.cx * W, cy = r.cy * H, rx = r.rx * W, ry = r.ry * H, rot = r.rot || 0;
          const g = mk('g', { transform: `rotate(${rot} ${cx} ${cy})` });
          const e = mk('ellipse', { cx, cy, rx, ry, class: cls });
          e.addEventListener('mousedown', (ev) => { if (drawing()) return; stop(ev); const was = VN.ui.softSel; VN.ui.softSel = r.id; drag(ev, r, 'move', null, was !== r.id); });
          g.appendChild(e);
          const lbl = mk('text', { x: cx, y: cy + H * 0.007, 'text-anchor': 'middle', class: 'sr-lbl', 'font-size': Math.round(H * 0.02) }); lbl.textContent = name;
          g.appendChild(lbl);
          if (sel && !drawing()) {
            const he = mk('circle', { cx: cx + rx, cy, r: hs, class: 'sr-h' }); he.addEventListener('mousedown', (ev) => { stop(ev); drag(ev, r, 'rx'); });
            const hsn = mk('circle', { cx, cy: cy + ry, r: hs, class: 'sr-h' }); hsn.addEventListener('mousedown', (ev) => { stop(ev); drag(ev, r, 'ry'); });
            const hr = mk('circle', { cx, cy: cy - ry - hs * 4, r: hs, class: 'sr-rot' }); hr.addEventListener('mousedown', (ev) => { stop(ev); drag(ev, r, 'rot'); });
            g.append(he, hsn, hr);
          }
          svg.appendChild(g);
        }
        // Ankerpunkt des gewählten Bereichs (Pin), ziehbar
        const sr = regs().find((x) => x.id === VN.ui.softSel);
        if (sr && Soft.par(sr).anchor === 'pin') {
          const pin = Soft.pinOf(sr, W / H), b = Soft.box(sr, W / H);
          svg.appendChild(mk('line', { x1: pin[0] * W, y1: pin[1] * H, x2: b.cx * W, y2: b.cy * H, class: 'sr-pinline' }));
          const pg = mk('g', { class: 'sr-pin' + (sr.pin ? '' : ' auto') });
          pg.appendChild(mk('circle', { cx: pin[0] * W, cy: pin[1] * H, r: hs * 1.6 }));
          pg.appendChild(mk('circle', { cx: pin[0] * W, cy: pin[1] * H, r: hs * 0.55, class: 'dot' }));
          pg.addEventListener('mousedown', (ev) => {
            if (drawing()) return; stop(ev);
            const o = pin.slice(), [u0, v0] = toImg(ev);
            VN.drag(ev, (dx, dy, e2) => { const [u, v] = toImg(e2); sr.pin = [o[0] + u - u0, o[1] + v - v0]; draw(); }, (dx, dy, moved) => {
              if (!moved) return; const nv = [r4(sr.pin[0]), r4(sr.pin[1])]; sr.pin = o; VN.mutate(() => { sr.pin = nv; });
            });
          });
          svg.appendChild(pg);
        }
        // Zeichenstift in Arbeit
        if (pen.length) {
          const tmp = Soft.outline({ pts: pen, smooth: true });
          svg.appendChild(mk('path', { d: pathOf(pen.length >= 3 ? tmp : pen, W, H, false), class: 'sr sel sr-draft' }));
          pen.forEach((q, i) => svg.appendChild(mk(q[2] ? 'rect' : 'circle', q[2] ? { x: q[0] * W - hs, y: q[1] * H - hs, width: hs * 2, height: hs * 2, class: 'sr-h' + (i === 0 ? ' first' : '') } : { cx: q[0] * W, cy: q[1] * H, r: hs, class: 'sr-h' + (i === 0 ? ' first' : '') })));
        }
      }
      function insertPt(r, at) {
        // nächstes Segment des Punkt-Umrisses finden
        let best = 0, bd = 1e9;
        for (let i = 0; i < r.pts.length; i++) {
          const a = r.pts[i], b = r.pts[(i + 1) % r.pts.length];
          const ex = b[0] - a[0], ey = b[1] - a[1], t = Math.max(0, Math.min(1, ((at[0] - a[0]) * ex + (at[1] - a[1]) * ey) / (ex * ex + ey * ey || 1e-9)));
          const d = Math.hypot(at[0] - a[0] - ex * t, at[1] - a[1] - ey * t);
          if (d < bd) { bd = d; best = i; }
        }
        VN.mutate(() => { r.pts.splice(best + 1, 0, [r4(at[0]), r4(at[1])]); SoftEd._pt = best + 1; });
      }
      // Ziehen: verschieben, Größe, Drehung, Punkte – live ohne Neuaufbau, beim Loslassen speichern
      function drag(ev, r, mode, pi, changed) {
        const W = img.naturalWidth || 1000, H = img.naturalHeight || 1000;
        const o = JSON.parse(JSON.stringify({ cx: r.cx, cy: r.cy, rx: r.rx, ry: r.ry, rot: r.rot || 0, pts: r.pts || null, pin: r.pin || null }));
        const [u0, v0] = toImg(ev);
        draw();
        VN.drag(ev, (dx, dy, e) => {
          const [u, v] = toImg(e);
          if (mode === 'move' && o.pin) r.pin = [o.pin[0] + (u - u0), o.pin[1] + (v - v0)];
          if (mode === 'move' && isPoly(r)) r.pts = o.pts.map((q) => Object.assign(q.slice(), { 0: q[0] + (u - u0), 1: q[1] + (v - v0) }));
          else if (mode === 'pt') { r.pts[pi][0] = o.pts[pi][0] + (u - u0); r.pts[pi][1] = o.pts[pi][1] + (v - v0); }
          else if (mode === 'move') { r.cx = o.cx + (u - u0); r.cy = o.cy + (v - v0); }
          else if (mode === 'rot') { r.rot = Math.round(Math.atan2((u - o.cx) * W, -(v - o.cy) * H) * 180 / Math.PI); }
          else {
            const a = o.rot * Math.PI / 180, x = (u - o.cx) * W, y = (v - o.cy) * H;
            const lx = x * Math.cos(a) + y * Math.sin(a), ly = -x * Math.sin(a) + y * Math.cos(a);
            if (mode === 'rx') r.rx = Math.max(0.01, Math.abs(lx) / W); else r.ry = Math.max(0.005, Math.abs(ly) / H);
          }
          draw();
        }, (dx, dy, moved) => {
          if (!moved) { if (changed || mode === 'pt') VN.render(); return; }
          const nv = isPoly(r) ? { pts: r.pts.map((q) => q.map((x, k) => (k < 2 ? r4(x) : x))) } : { cx: r4(r.cx), cy: r4(r.cy), rx: r4(r.rx), ry: r4(r.ry), rot: r.rot || 0 };
          if (o.pin) nv.pin = [r4(r.pin[0]), r4(r.pin[1])];
          const back = isPoly(r) ? { pts: o.pts } : { cx: o.cx, cy: o.cy, rx: o.rx, ry: o.ry, rot: o.rot };
          if (o.pin) back.pin = o.pin;
          Object.assign(r, back);
          VN.mutate(() => { Object.assign(r, nv); });
        });
      }
      const addRegion = (r) => {
        VN.mutate(() => {
          p.softs[id] = p.softs[id] || { on: true, regions: [] };
          p.softs[id].regions.push(r);
        });
        // danach gleich anpassen: zurück zum Auswählen
        VN.ui.softSel = r.id; SoftEd._pt = null; VN.ui.softTool = 'select'; VN.render();
      };
      const polyRegion = (pts) => Object.assign(Soft.newRegion(VN.ui.softPreset || 'chest', 0, 0, 0, 0), { shape: 'poly', pts: pts.map((q) => q.map((x, k) => (k < 2 ? r4(x) : x))), smooth: true });
      function finishPen() {
        if (pen.length >= 3) { const pts = pen; pen = []; addRegion(polyRegion(pts)); }
        else { pen = []; draw(); }
      }
      // Punkte vereinfachen (Ramer-Douglas-Peucker), eps in Bildbruchteilen
      const simplify = (pts, eps) => {
        if (pts.length < 3) return pts;
        let idx = 0, dm = 0;
        const a = pts[0], b = pts[pts.length - 1];
        for (let i = 1; i < pts.length - 1; i++) {
          const ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey);
          // Anfang = Ende (geschlossene Schleife): Abstand zum Punkt statt zur Linie
          const d = L < 1e-6 ? Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]) : Math.abs((pts[i][0] - a[0]) * ey - (pts[i][1] - a[1]) * ex) / L;
          if (d > dm) { dm = d; idx = i; }
        }
        if (dm <= eps) return [a, b];
        return simplify(pts.slice(0, idx + 1), eps).slice(0, -1).concat(simplify(pts.slice(idx), eps));
      };
      // Auf freier Fläche: je nach Werkzeug Ellipse ziehen, Lasso fahren oder Punkte setzen
      stage.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        if (VN.ui.softPinMode) {
          const r = regs().find((x) => x.id === VN.ui.softPinMode);
          const [pu, pv] = toImg(e);
          VN.ui.softPinMode = null;
          if (r) VN.mutate(() => { r.pin = [r4(pu), r4(pv)]; r.anchor = 'pin'; }); else VN.render();
          return;
        }
        const tool = VN.ui.softTool || 'select';
        if (tool === 'select') { if (VN.ui.softSel) { VN.ui.softSel = null; SoftEd._pt = null; VN.render(); } return; }
        const [u0, v0] = toImg(e);
        const W = img.naturalWidth || 1000, H = img.naturalHeight || 1000;
        const ib = img.getBoundingClientRect();
        if (tool === 'pen') {
          // Klick auf den ersten Punkt schließt die Form
          if (pen.length >= 3 && Math.hypot((u0 - pen[0][0]) * ib.width, (v0 - pen[0][1]) * ib.height) < 12) { finishPen(); return; }
          const pt = [u0, v0, 1]; // ohne Ziehen: Ecke
          pen.push(pt); draw();
          VN.drag(e, (dx, dy) => { if (Math.hypot(dx, dy) > 4 && pt[2]) { pt.length = 2; draw(); } }, () => {}); // ziehen: rund
          return;
        }
        if (tool === 'lasso') {
          const pts = [[u0, v0]];
          const line = mk('path', { class: 'sr sel sr-draft', d: '' });
          svg.appendChild(line);
          VN.drag(e, (dx, dy, ev) => {
            const q = toImg(ev), l = pts[pts.length - 1];
            if (Math.hypot((q[0] - l[0]) * ib.width, (q[1] - l[1]) * ib.height) >= 4) { pts.push(q); line.setAttribute('d', pathOf(pts, W, H, false)); }
          }, () => {
            const eps = 3 / Math.max(ib.width, ib.height);
            // offener Linienzug vereinfachen; Endpunkt weg, wenn er wieder am Anfang liegt
            let s2 = simplify(pts, eps);
            if (s2.length > 3 && Math.hypot((s2[s2.length - 1][0] - s2[0][0]) * ib.width, (s2[s2.length - 1][1] - s2[0][1]) * ib.height) < 10) s2 = s2.slice(0, -1);
            if (s2.length >= 3) addRegion(polyRegion(s2.slice(0, 60)));
            else { line.remove(); if (VN.ui.softSel) { VN.ui.softSel = null; VN.render(); } }
          });
          return;
        }
        let box = null;
        let ghost = null;
        VN.drag(e, (dx, dy, ev) => {
          const [u1, v1] = toImg(ev);
          box = { cx: (u0 + u1) / 2, cy: (v0 + v1) / 2, rx: Math.abs(u1 - u0) / 2, ry: Math.abs(v1 - v0) / 2 };
          if (!ghost) { ghost = document.createElementNS(NS, 'ellipse'); ghost.setAttribute('class', 'sr sel'); svg.appendChild(ghost); }
          ghost.setAttribute('cx', box.cx * W); ghost.setAttribute('cy', box.cy * H); ghost.setAttribute('rx', box.rx * W); ghost.setAttribute('ry', box.ry * H);
        }, () => {
          if (!box || box.rx < 0.01 || box.ry < 0.005) { if (VN.ui.softSel) { VN.ui.softSel = null; VN.render(); } return; }
          addRegion(Soft.newRegion(VN.ui.softPreset || 'chest', r4(box.cx), r4(box.cy), r4(box.rx), r4(box.ry)));
        });
      });
      stage.addEventListener('dblclick', (e) => { if (VN.ui.softTool === 'pen' && pen.length) { e.preventDefault(); pen.pop(); finishPen(); } });
    },

    // ---------- Testen: Figur ziehen, hüpfen, schütteln ----------
    test(stage, id) {
      const t = el('div', { class: 'soft-test' });
      const box = el('div', { class: 'char' });
      const inner = el('span', { class: 'char-inner' }, el('img', { src: VN.assetUrl(id), draggable: 'false' }));
      box.appendChild(inner);
      t.appendChild(box);
      stage.appendChild(t);
      Soft.attach(inner, id);
      SoftEd._test = { box, inner };
      let off = [0, 0];
      box.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const o = off.slice();
        VN.drag(e, (dx, dy) => { off = [o[0] + dx, o[1] + dy]; box.style.transform = `translateX(-50%) translate(${off[0]}px, ${off[1]}px)`; }, () => {});
      });
      const anim = (cls) => { box.classList.remove('hop', 'shake'); void box.offsetWidth; box.classList.add(cls); };
      const walkBtn = el('button', { class: 'btn small', onclick: () => { box.classList.toggle('walk'); walkBtn.classList.toggle('primary'); } }, VN.t('Gehen'));
      stage.appendChild(el('div', { class: 'soft-btns' },
        el('button', { class: 'btn small', onclick: () => anim('hop') }, VN.t('Hüpfen')),
        el('button', { class: 'btn small', onclick: () => anim('shake') }, VN.t('Schütteln')),
        walkBtn,
        el('button', { class: 'btn small', onclick: () => Soft.pokeAll('down', 1, id) }, VN.t('Anstoßen ↓')),
        el('button', { class: 'btn small', onclick: () => { off = [0, 0]; box.style.transform = ''; } }, VN.t('Zurück zur Mitte'))));
      stage.appendChild(el('div', { class: 'muted small', style: { position: 'absolute', top: '10px', left: '12px' } }, VN.t('Tipp: Zieh die Figur mit der Maus hin und her.')));
    },

    // ---------- Seitenleiste ----------
    side(id, data) {
      const side = el('div', { class: 'soft-side' });
      const p = VN.project;
      const cur = VN.ui.softPreset || 'chest';
      const pre = el('select', { onchange: (e) => { VN.ui.softPreset = e.target.value; } });
      for (const [k, v] of Object.entries(Soft.PRESETS)) { const o = el('option', { value: k }, VN.t(v.label)); if (k === cur) o.selected = true; pre.appendChild(o); }
      side.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Neuer Bereich')),
        el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, VN.t('Vorlage')), pre),
        el('div', { class: 'seg soft-tools' }, ...TOOLS.map(([k, l]) => el('button', { class: (VN.ui.softTool || 'select') === k ? 'active' : '', onclick: () => { VN.ui.softTool = k; VN.render(); } }, VN.t(l)))),
        el('div', { class: 'muted small' }, VN.t(TOOL_HINT[VN.ui.softTool || 'select']))));
      const regs = (data && data.regions) || [];
      if (!regs.length) return side;
      const list = el('div', { class: 'soft-list' });
      for (const r of regs) {
        list.appendChild(el('div', { class: 'soft-item' + (VN.ui.softSel === r.id ? ' active' : ''), onclick: () => { VN.ui.softSel = r.id; VN.render(); } },
          el('input', { type: 'checkbox', checked: r.on !== false, onclick: (e) => e.stopPropagation(), onchange: (e) => VN.mutate(() => { r.on = e.target.checked; }) }),
          el('span', { class: 'grow' }, r.name || VN.t((Soft.PRESETS[r.preset] || {}).label || 'Bereich')),
          el('span', { class: 'muted small' }, VN.t((Soft.PRESETS[r.preset] || {}).label || ''))));
      }
      side.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Bereiche')), list));
      const r = regs.find((x) => x.id === VN.ui.softSel);
      if (!r) return side;
      const P = Soft.par(r);
      const poly = r.shape === 'poly' && r.pts && r.pts.length >= 3;
      const card = el('div', { class: 'opt-card' });
      const ps = el('select', { onchange: (e) => VN.mutate(() => { for (const k of Soft.PKEYS) delete r[k]; r.preset = e.target.value; }) });
      for (const [k, v] of Object.entries(Soft.PRESETS)) { const o = el('option', { value: k }, VN.t(v.label)); if (k === r.preset) o.selected = true; ps.appendChild(o); }
      const sel = (val, opts, commit) => { const s = el('select', { onchange: (e) => VN.mutate(() => commit(e.target.value)) }); for (const [v, l] of opts) { const o = el('option', { value: v }, VN.t(l)); if (v === (val || '')) o.selected = true; s.appendChild(o); } return s; };
      card.append(el('div', { class: 'sec-title' }, VN.t('Bereich')),
        el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '112px' } }, VN.t('Name')), el('input', { type: 'text', value: r.name || '', style: { flex: 1 }, onchange: (e) => VN.mutate(() => { r.name = e.target.value; }) })),
        el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '112px' } }, VN.t('Vorlage')), ps));
      for (const [k, label, min, max, step] of SLIDERS) {
        const out = el('span', { class: 'muted small' }, String(P[k]));
        const inp = el('input', { type: 'range', min, max, step, value: P[k] != null ? P[k] : 0,
          oninput: (e) => { r[k] = Number(e.target.value); out.textContent = e.target.value; }, // live
          onchange: (e) => { const v = Number(e.target.value); delete r[k]; VN.mutate(() => { r[k] = v; }); } });
        card.appendChild(el('label', { class: 'soft-sl' }, el('span', null, VN.t(label)), inp, out));
      }
      card.append(
        el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '112px' } }, VN.t('Anker')), sel(P.anchor, Soft.ANCHORS, (v) => { r.anchor = v; if (v !== 'pin') r.pendulum = false; })),
        P.anchor === 'pin' ? el('div', { class: 'logic-row', style: { flexWrap: 'wrap' } },
          el('button', { class: 'btn tiny' + (VN.ui.softPinMode === r.id ? ' primary' : ''), onclick: () => { VN.ui.softPinMode = VN.ui.softPinMode === r.id ? null : r.id; VN.render(); } }, VN.t(VN.ui.softPinMode === r.id ? 'Jetzt ins Bild klicken …' : '📍 Ankerpunkt setzen')),
          el('span', { class: 'muted small' }, VN.t(r.pin ? 'Pin im Bild ziehen zum Verschieben' : 'noch nicht gesetzt – Mitte oben'))) : null,
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!P.pendulum, onchange: (e) => VN.mutate(() => { r.pendulum = e.target.checked; if (e.target.checked && P.anchor !== 'pin') { r.anchor = 'pin'; if (r.anchorAmt == null) r.anchorAmt = 0.7; } }) }), VN.t('Pendeln (dreht sich um den Ankerpunkt)')),
        P.pendulum ? el('div', { class: 'muted small' }, VN.t('Anker-Stärke = Biegung: 0 schwingt starr wie ein Schwert, 1 biegt sich zur Spitze wie ein Schwanz.')) : null,
        el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '112px' } }, VN.t('Ruhebewegung')), sel(P.idle, Soft.IDLES, (v) => { r.idle = v; })),
        poly ? el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: r.smooth !== false, onchange: (e) => VN.mutate(() => { r.smooth = e.target.checked; }) }), VN.t('Umriss rund (Kurven statt gerader Linien)')) : null,
        poly ? el('div', { class: 'muted small' }, VN.t('Punkte ziehen zum Anpassen · Doppelklick auf den Umriss fügt einen Punkt ein · Rechtsklick auf einen Punkt löscht ihn · Alt-Klick: Ecke ↔ rund')) : null,
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!P.layer, onchange: (e) => VN.mutate(() => { r.layer = e.target.checked; }) }), VN.t('Als eigene Ebene (darf über den Körper schwingen)')),
        el('div', { class: 'logic-row', style: { flexWrap: 'wrap' } },
          el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const c = JSON.parse(JSON.stringify(r)); c.id = VN.uid('sr'); if (poly) c.pts = r.pts.map((q) => [r4(1 - q[0]), q[1]].concat(q.slice(2))).reverse(); else { c.cx = r4(1 - r.cx); c.rot = -(r.rot || 0); } if (r.pin) c.pin = [r4(1 - r.pin[0]), r.pin[1]]; c.name = (r.name || '') + ' ↔'; regs.push(c); VN.ui.softSel = c.id; }) }, VN.t('↔ Gespiegelt kopieren')),
          !poly ? el('button', { class: 'btn tiny', onclick: () => { const im = new Image(); im.src = VN.assetUrl(id); const go = () => VN.mutate(() => { r.pts = Soft.toPoly(r, im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1); r.shape = 'poly'; r.smooth = true; }); if (im.complete && im.naturalWidth) go(); else im.onload = go; } }, VN.t('✒ In freie Form umwandeln')) : null,
          el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { for (const k of Soft.PKEYS) delete r[k]; }) }, VN.t('Vorlage zurücksetzen')),
          el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { regs.splice(regs.indexOf(r), 1); VN.ui.softSel = null; if (!regs.length) delete p.softs[id]; }) }, VN.t('Entfernen'))));
      side.appendChild(card);
      return side;
    },

    inspector() {
      return el('div', { class: 'insp' }, el('div', null, el('h3', null, VN.t('Figuren')), el('div', { class: 'insp-title' }, VN.t('Weich-Physik'))),
        el('div', { class: 'hint-box' }, el('strong', null, VN.t('So geht’s')), el('br'),
          VN.t('1. Figuren-Bild wählen. 2. Vorlage wählen (Brust, Haare, Rock …) und eine Ellipse um die Stelle ziehen. 3. Mit „▶ Testen“ die Figur hüpfen lassen oder mit der Maus herumziehen.'), el('br'), el('br'),
          VN.t('Das Bild wird nicht zerschnitten: Nur die Punkte in der Maske bewegen sich, mit weichem Übergang. Die Maske gehört zum Bild und bewegt sich mit der Figur mit.'), el('br'), el('br'),
          VN.t('„Über den Rand“ lässt die Bewegung über die Maske hinaus auslaufen. „Als eigene Ebene“ legt den Bereich als Kopie oben drauf, so kann er über den Körper schwingen.'), el('br'), el('br'),
          VN.t('Die Physik reagiert, wenn sich die Figur bewegt (Schritte, Sprünge, Wackeln, Bewegungen in Zwischensequenzen). Mit der Aktion „〰 Weich-Physik anstoßen“ gibst du einen gezielten Stoß.')));
    }
  });
})();
