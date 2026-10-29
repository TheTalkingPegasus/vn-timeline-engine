// Bones-Editor: Knochen auf ein Bild ziehen, Bewegungen und Physik einstellen
(function () {
  const { el } = VN;
  const NS = 'http://www.w3.org/2000/svg';
  const KIND_COLORS = { body: '#4fb3c8', hair: '#a58cf0', wing: '#6cc48a', tail: '#f0a35e' };
  const KIND_NAMES = [['body', 'Körper'], ['hair', 'Haar / Mähne'], ['wing', 'Flügel'], ['tail', 'Schweif']];
  const PHYS_PRESETS = {
    Haar: { stiff: 0.35, damp: 0.25, wind: 0.3 },
    Stoff: { stiff: 0.25, damp: 0.4, wind: 0.5 },
    Federn: { stiff: 0.55, damp: 0.3, wind: 0.2 },
    Gummi: { stiff: 0.8, damp: 0.1, wind: 0 },
    Schwer: { stiff: 0.15, damp: 0.6, wind: 0.05 }
  };

  const svg = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    return e;
  };

  const Bones = (window.Bones = {
    render(root) {
      root.innerHTML = '';
      const p = VN.project;
      const imgs = VN.assetsOf('image');
      if (!VN.asset(VN.ui.boneAsset)) VN.ui.boneAsset = (imgs.find((a) => p.rigs[a.id]) || imgs.find((a) => /ray|char|figur/i.test(a.name + a.file)) || imgs[0] || {}).id || null;
      const assetId = VN.ui.boneAsset;
      const rig = assetId ? p.rigs[assetId] : null;
      const ui = VN.ui;
      p.blinks = p.blinks || {};
      const blinkOnly = !rig && assetId && (p.blinks[assetId] || ui.blinkOnly === assetId);
      ui.boneTool = ui.boneTool || 'select';
      if (!rig && ui.boneTool !== 'eyes') ui.boneTool = 'eyes';

      const assetSel = el('select', { class: 'small-input', onchange: (e) => { ui.boneAsset = e.target.value; ui.boneSel = null; ui.chain = null; VN.render(); } });
      for (const a of imgs) { const o = el('option', { value: a.id }, a.name + (p.rigs[a.id] ? ' · mit Bones' : '')); if (a.id === assetId) o.selected = true; assetSel.appendChild(o); }

      const head = el('div', { class: 'view-head' }, el('strong', { style: { fontSize: '15px' } }, 'Bones'), assetSel, el('div', { class: 'spacer' }));
      if (rig || blinkOnly) {
        const tools = el('div', { class: 'seg' });
        const toolList = rig ? [['select', 'Auswählen & ziehen'], ['chain', 'Kette zeichnen'], ['pin', 'Pin setzen'], ['paint', 'Gewichte malen'], ['eyes', 'Augen markieren']] : [['eyes', 'Augen markieren']];
        for (const [k, l] of toolList) {
          tools.appendChild(el('button', { class: ui.boneTool === k ? 'active' : '', onclick: () => { ui.boneTool = k; ui.chain = k === 'chain' ? [] : null; VN.render(); } }, l));
        }
        const tg = (key, label) => el('label', { class: 'check btn' }, el('input', { type: 'checkbox', checked: !!ui[key], onchange: (e) => { ui[key] = e.target.checked; VN.render(); } }), label);
        head.append(tools, tg('boneMesh', 'Gitter'), tg('boneWeights', 'Gewichtung'),
          el('button', { class: 'btn primary', onclick: () => { ui.bonePlay = !ui.bonePlay; VN.render(); } }, ui.bonePlay ? '■ Stopp' : '▶ Bewegung'));
      }
      root.appendChild(head);
      if (rig && ui.boneTool === 'paint') root.appendChild(Bones.paintBar(assetId, rig));

      const wrap = el('div', { class: 'stage-wrap bone-wrap' });
      root.appendChild(wrap);
      if (!assetId) { wrap.appendChild(el('div', { class: 'hint-box' }, 'Importiere zuerst ein Bild einer Figur (PNG mit transparentem Hintergrund oder SVG).')); return; }
      if (!rig && !blinkOnly) return Bones.templates(wrap, assetId);

      Rig.analyze(assetId).then((info) => {
        if (!wrap.isConnected) return;
        const box = el('div', { class: 'bone-stage' });
        wrap.appendChild(box);
        const fit = () => {
          const W = wrap.clientWidth - 40, H = wrap.clientHeight - 40;
          const sc = Math.min(W / info.w, H / info.h);
          box.style.width = info.w * sc + 'px';
          box.style.height = info.h * sc + 'px';
        };
        fit();
        new ResizeObserver(fit).observe(wrap);
        if (ui.bonePlay) {
          const holder = el('div', { style: { position: 'absolute', inset: '0' } });
          if (rig) holder.appendChild(Rig.canvasFor(assetId, { boneAmp: 100 }));
          else {
            const inner = el('span', { class: 'char-inner', style: { width: '100%' } }, el('img', { src: VN.assetUrl(assetId), draggable: 'false', style: { width: '100%' } }));
            Blink.attach(inner, assetId);
            holder.appendChild(inner);
          }
          box.appendChild(holder);
          box.appendChild(el('div', { class: 'stage-badge', style: { fontSize: '12px' } }, 'Vorschau: so bewegt sich die Figur im Spiel'));
          return;
        }
        box.appendChild(el('img', { src: VN.assetUrl(assetId), draggable: 'false', style: { position: 'absolute', inset: '0', width: '100%', height: '100%' } }));
        const ov = svg('svg', { viewBox: `0 0 ${info.w} ${info.h}`, preserveAspectRatio: 'none', class: 'bone-svg' });
        box.appendChild(ov);
        Bones.drawOverlay(ov, info, assetId);
        Bones.bindOverlay(ov, info, assetId);
      });
      wrap.appendChild(el('div', { class: 'bone-help muted small' }, Bones.helpText()));
    },

    helpText() {
      const t = VN.ui.boneTool;
      if (t === 'chain') return 'Klicke Punkt für Punkt entlang einer Strähne, eines Flügels oder Schweifs. Beginnst du auf einem Gelenk, hängt die Kette daran. Rechts „Kette fertig“ oder Doppelklick.';
      if (t === 'paint') return 'Knochen anklicken, dann über die Figur malen: „Mehr“ gibt dem Knochen mehr Einfluss (rot = bewegt sich voll mit), „Weniger“ nimmt ihn weg, „Glätten“ macht harte Übergänge weich. Mit ▶ Bewegung prüfen.';
      if (t === 'pin') return 'Pins halten Bildbereiche fest, z. B. Füße am Boden. Klick setzt einen Pin, Klick auf einen Pin entfernt ihn.';
      if (t === 'eyes') return 'Ziehe ein Rechteck um jedes Auge. Die Lid-Farbe wird automatisch aus der Haut darüber genommen. Klick auf ein Auge entfernt es.';
      return 'Gelenke (weiße Punkte) ziehen, Knochen anklicken zum Auswählen. Entf löscht den gewählten Knochen. Verbundene Gelenke bewegen sich gemeinsam.';
    },

    templates(wrap, assetId) {
      const grid = el('div', { class: 'tpl-grid' });
      const pics = {
        biped: 'M30 10a7 7 0 1 0 0.1 0M30 24v22M30 28l-12 12M30 28l12 12M30 46l-8 16M30 46l8 16',
        quad: 'M8 22l8-6M16 16l8 10h22l8-4M24 26v24M30 26v24M46 26l-2 24M52 24l2 26M54 22l6 4',
        winged: 'M30 18a6 6 0 1 0 0.1 0M30 30v20M30 32l-20-6M30 32l20-6M30 50l-4 10M30 50l4 10',
        chain: 'M6 36q8-14 16 0t16 0t16 0',
        empty: 'M14 14h32v32h-32z'
      };
      for (const [k, t] of Object.entries(Rig.TEMPLATES)) {
        grid.appendChild(el('button', {
          class: 'tpl-card', onclick: async () => {
            const info = await Rig.analyze(assetId);
            VN.mutate(() => { VN.project.rigs[assetId] = Rig.template(k, info.bbox); VN.ui.boneSel = null; });
          }
        }, el('div', { class: 'tpl-ico', html: `<svg viewBox="0 0 60 64" width="60" height="64" fill="none" stroke="#e6e6ea" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="${pics[k]}"/></svg>` }),
        el('strong', null, t.label), el('span', { class: 'muted small' }, t.desc)));
      }
      wrap.appendChild(el('div', { class: 'tpl-wrap' },
        el('div', { class: 'tpl-preview', style: { backgroundImage: `url("${VN.assetUrl(assetId)}")` } }),
        el('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '560px' } },
          el('h2', { style: { margin: 0 } }, 'Körpertyp wählen'),
          el('div', { class: 'muted' }, 'Die Vorlage legt ein passendes Skelett über die Figur. Danach ziehst du die Gelenke an die richtigen Stellen und ergänzt Haare, Flügel oder einen Schweif als Kette.'),
          grid,
          el('button', { class: 'btn', style: { alignSelf: 'flex-start' }, onclick: () => { VN.ui.blinkOnly = assetId; VN.ui.boneTool = 'eyes'; VN.render(); } }, 'Ohne Bones: nur Blinzeln einrichten'))));
    },

    // Zeichnet Gitter, Gewichte, Knochen und Pins
    drawOverlay(ov, info, assetId) {
      const rig = VN.project.rigs[assetId] || { bones: [], pins: [] };
      ov.innerHTML = '';
      const s = Math.max(info.w, info.h);
      const ui = VN.ui;
      if (ui.boneMesh || ui.boneWeights || (ui.boneTool === 'paint' && ui.boneSel)) {
        Rig.mesh(assetId).then(({ mesh }) => {
          if (!ov.isConnected) return;
          const g = svg('g', { class: 'mesh-layer' });
          if (ui.boneMesh) {
            let d = '';
            const P = mesh.pos;
            for (let i = 0; i < mesh.idx.length; i += 3) {
              const a = mesh.idx[i], b = mesh.idx[i + 1], c = mesh.idx[i + 2];
              d += `M${P[a * 2]} ${P[a * 2 + 1]}L${P[b * 2]} ${P[b * 2 + 1]}L${P[c * 2]} ${P[c * 2 + 1]}Z`;
            }
            g.appendChild(svg('path', { d, fill: 'none', stroke: 'rgba(230,230,234,0.35)', 'stroke-width': s * 0.0012 }));
          }
          if ((ui.boneWeights || ui.boneTool === 'paint') && ui.boneSel) {
            const bIdx = rig.bones.findIndex((b) => b.id === ui.boneSel);
            const wts = Rig.weights(mesh, Bones._live && Bones._live.asset === assetId ? Object.assign({}, rig, { paint: Bones._live.paint }) : rig);
            for (let v = 0; v < mesh.count; v++) {
              let w = 0;
              for (let k = 0; k < 3; k++) if (wts.bi[v * 3 + k] === bIdx) w = wts.bw[v * 3 + k];
              w *= 1 - wts.pin[v];
              if (w < 0.03) continue;
              const hue = 240 - 240 * w;
              g.appendChild(svg('circle', { cx: mesh.pos[v * 2], cy: mesh.pos[v * 2 + 1], r: s * 0.007, fill: `hsl(${hue},85%,55%)`, opacity: 0.8 }));
            }
          }
          ov.insertBefore(g, ov.firstChild);
        });
      }
      const W = info.w, H = info.h;
      for (const b of rig.bones) {
        const ax = b.hx * W, ay = b.hy * H, bx = b.tx * W, by = b.ty * H;
        const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L, ny = dx / L, wd = Math.min(L * 0.14, s * 0.025);
        const mx = ax + dx * 0.22, my = ay + dy * 0.22;
        const sel = ui.boneSel === b.id;
        ov.appendChild(svg('path', {
          d: `M${ax} ${ay}L${mx + nx * wd} ${my + ny * wd}L${bx} ${by}L${mx - nx * wd} ${my - ny * wd}Z`,
          fill: sel ? '#e8a43a' : KIND_COLORS[b.kind || 'body'], 'fill-opacity': sel ? 0.95 : 0.7,
          stroke: '#111', 'stroke-width': s * 0.0025, 'data-bone': b.id, class: 'bone-shape'
        }));
        if (b.physics && b.physics.on) ov.appendChild(svg('circle', { cx: (ax + bx) / 2, cy: (ay + by) / 2, r: s * 0.006, fill: '#fff', 'pointer-events': 'none' }));
      }
      const joints = [];
      for (const b of rig.bones) { joints.push([b.hx, b.hy, b.id, 'h']); joints.push([b.tx, b.ty, b.id, 't']); }
      for (const [x, y, id, end] of joints) {
        ov.appendChild(svg('circle', { cx: x * W, cy: y * H, r: s * 0.011, fill: '#fff', stroke: '#111', 'stroke-width': s * 0.003, class: 'bone-joint', 'data-bone': id, 'data-end': end }));
      }
      for (const [i, pn] of (rig.pins || []).entries()) {
        const r = s * 0.014;
        ov.appendChild(svg('rect', { x: pn.x * W - r, y: pn.y * H - r, width: r * 2, height: r * 2, rx: r * 0.3, fill: '#e86a6a', stroke: '#2a0b0b', 'stroke-width': s * 0.003, class: 'bone-pin', 'data-pin': i }));
      }
      const bl = (VN.project.blinks || {})[assetId];
      if (bl && bl.eyes) bl.eyes.forEach((e, i) => {
        ov.appendChild(svg('ellipse', { cx: (e.x + e.w / 2) * W, cy: (e.y + e.h / 2) * H, rx: e.w / 2 * W, ry: e.h / 2 * H, fill: 'rgba(255,214,90,0.18)', stroke: '#ffd65a', 'stroke-width': s * 0.003, 'stroke-dasharray': `${s * 0.008} ${s * 0.005}`, class: 'eye-rect', 'data-eye': i }));
      });
      if (ui.chain && ui.chain.length) {
        const pts = ui.chain.map((c) => c.x * W + ',' + c.y * H).join(' ');
        ov.appendChild(svg('polyline', { points: pts, fill: 'none', stroke: '#e8a43a', 'stroke-width': s * 0.006, 'stroke-dasharray': `${s * 0.015} ${s * 0.01}` }));
        for (const c of ui.chain) ov.appendChild(svg('circle', { cx: c.x * W, cy: c.y * H, r: s * 0.009, fill: '#e8a43a' }));
      }
    },

    bindOverlay(ov, info, assetId) {
      const ui = VN.ui;
      const toImg = (e) => {
        const r = ov.getBoundingClientRect();
        return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      };
      const near = (a, b) => Math.abs(a - b) < 1e-4;
      ov.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const rig = VN.project.rigs[assetId];
        const t = e.target;
        const pt = toImg(e);
        if (ui.boneTool === 'eyes') {
          const p = VN.project;
          p.blinks = p.blinks || {};
          if (t.classList.contains('eye-rect')) { VN.mutate(() => { p.blinks[assetId].eyes.splice(Number(t.dataset.eye), 1); }); return; }
          e.preventDefault();
          const preview = svg('rect', { fill: 'rgba(255,214,90,0.2)', stroke: '#ffd65a', 'stroke-width': Math.max(info.w, info.h) * 0.003 });
          ov.appendChild(preview);
          let q = pt;
          const box = () => ({ x: Math.min(pt.x, q.x), y: Math.min(pt.y, q.y), w: Math.abs(q.x - pt.x), h: Math.abs(q.y - pt.y) });
          VN.drag(e, (dx, dy, ev) => {
            q = toImg(ev);
            const b = box();
            preview.setAttribute('x', b.x * info.w); preview.setAttribute('y', b.y * info.h);
            preview.setAttribute('width', b.w * info.w); preview.setAttribute('height', b.h * info.h);
          }, async (dx, dy, moved) => {
            preview.remove();
            const b = box();
            if (!moved || b.w < 0.005 || b.h < 0.003) return;
            const col = await Blink.sampleColor(assetId, b);
            VN.mutate(() => {
              const cfg = p.blinks[assetId] = p.blinks[assetId] || { on: true, mode: 'mask', eyes: [], color: null, lash: '#2a2440', min: 2.5, max: 6, dur: 0.16, double: 0.2 };
              cfg.eyes = cfg.eyes || [];
              cfg.eyes.push(b);
              if (!cfg.color && col) cfg.color = col;
            });
          });
          return;
        }
        if (!rig) return;
        if (ui.boneTool === 'paint') {
          if (t.classList.contains('bone-shape')) { ui.boneSel = t.dataset.bone; VN.render(); return; }
          if (!ui.boneSel) { VN.toast('Erst einen Knochen anklicken'); return; }
          e.preventDefault();
          const P = Bones.paintCfg();
          const paint = {};
          for (const [k, v] of Object.entries(rig.paint || {})) paint[k] = Rig.decodeGrid(v);
          const g = paint[ui.boneSel] = paint[ui.boneSel] || new Float32Array(Rig.PG * Rig.PG);
          Bones._live = { asset: assetId, paint };
          const aspect = info.w / info.h;
          let pending = false;
          const dab = (q) => {
            Rig.brush(g, q.x, q.y, P.size / 100, P.strength / 100, P.mode, aspect);
            if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; if (ov.isConnected) Bones.drawOverlay(ov, info, assetId); }); }
          };
          dab(pt);
          VN.drag(e, (dx, dy, ev) => dab(toImg(ev)), () => {
            const enc = {};
            for (const [k, v] of Object.entries(paint)) if (v.some((x) => Math.abs(x) > 0.004)) enc[k] = Rig.encodeGrid(v);
            Bones._live = null;
            VN.mutate(() => { if (Object.keys(enc).length) rig.paint = enc; else delete rig.paint; });
          });
          return;
        }
        if (ui.boneTool === 'pin') {
          if (t.classList.contains('bone-pin')) VN.mutate(() => { rig.pins.splice(Number(t.dataset.pin), 1); });
          else VN.mutate(() => { rig.pins = rig.pins || []; rig.pins.push({ x: pt.x, y: pt.y }); });
          return;
        }
        if (ui.boneTool === 'chain') {
          let attach = null;
          if (t.classList.contains('bone-joint')) {
            const b = rig.bones.find((x) => x.id === t.dataset.bone);
            const x = t.dataset.end === 'h' ? b.hx : b.tx, y = t.dataset.end === 'h' ? b.hy : b.ty;
            pt.x = x; pt.y = y;
            attach = t.dataset.end === 't' ? b.id : b.parent;
          }
          ui.chain = ui.chain || [];
          if (!ui.chain.length) ui.chainParent = attach;
          ui.chain.push(pt);
          Bones.drawOverlay(ov, info, assetId);
          VN.render.inspectorOnly ? VN.render.inspectorOnly() : Inspector.render(document.getElementById('right'));
          return;
        }
        if (t.classList.contains('bone-joint')) {
          e.preventDefault();
          const b = rig.bones.find((x) => x.id === t.dataset.bone);
          const ox = t.dataset.end === 'h' ? b.hx : b.tx, oy = t.dataset.end === 'h' ? b.hy : b.ty;
          const before = JSON.stringify(rig);
          const targets = [];
          for (const bo of rig.bones) {
            if (near(bo.hx, ox) && near(bo.hy, oy)) targets.push([bo, 'h']);
            if (near(bo.tx, ox) && near(bo.ty, oy)) targets.push([bo, 't']);
          }
          ui.boneSel = b.id;
          VN.drag(e, (dx, dy, ev) => {
            const q = toImg(ev);
            for (const [bo, end] of targets) { if (end === 'h') { bo.hx = q.x; bo.hy = q.y; } else { bo.tx = q.x; bo.ty = q.y; } }
            Bones.drawOverlay(ov, info, assetId);
          }, (dx, dy, moved) => {
            if (!moved) return VN.render();
            const after = JSON.stringify(rig);
            Object.assign(rig, JSON.parse(before));
            VN.mutate(() => { VN.project.rigs[assetId] = JSON.parse(after); });
          });
          return;
        }
        if (t.classList.contains('bone-shape')) { ui.boneSel = t.dataset.bone; VN.render(); return; }
        if (ui.boneSel) { ui.boneSel = null; VN.render(); }
      });
      ov.addEventListener('dblclick', () => { if (ui.boneTool === 'chain') Bones.finishChain(assetId); });
      // Pinsel-Kreis beim Gewichte-Malen
      ov.addEventListener('mousemove', (e) => {
        if (ui.boneTool !== 'paint') return;
        let c = ov.querySelector('.brush-cur');
        if (!c) { c = svg('circle', { class: 'brush-cur', fill: 'none', stroke: '#fff', 'stroke-width': Math.max(info.w, info.h) * 0.002, 'stroke-dasharray': '6 4', 'pointer-events': 'none' }); ov.appendChild(c); }
        const q = toImg(e);
        c.setAttribute('cx', q.x * info.w); c.setAttribute('cy', q.y * info.h); c.setAttribute('r', Bones.paintCfg().size / 100 * info.w);
      });
      ov.addEventListener('mouseleave', () => { const c = ov.querySelector('.brush-cur'); if (c) c.remove(); });
    },

    paintCfg() {
      const ui = VN.ui;
      ui.bonePaint = ui.bonePaint || { mode: 'add', size: 8, strength: 50 };
      return ui.bonePaint;
    },
    paintBar(assetId, rig) {
      const P = Bones.paintCfg();
      const ui = VN.ui;
      const seg = el('div', { class: 'seg' }, ...[['add', '＋ Mehr'], ['sub', '－ Weniger'], ['smooth', '≈ Glätten']].map(([m, l]) => el('button', { class: P.mode === m ? 'active' : '', onclick: () => { P.mode = m; VN.render(); } }, l)));
      const slider = (label, key, min, max) => {
        const v = el('span', { class: 'muted small', style: { width: '34px' } }, P[key] + (key === 'size' ? ' %' : ' %'));
        return el('label', { class: 'row gap8 small' }, label, el('input', { type: 'range', min, max, value: P[key], oninput: (e) => { P[key] = Number(e.target.value); v.textContent = P[key] + ' %'; } }), v);
      };
      const bone = rig.bones.find((b) => b.id === ui.boneSel);
      const painted = Object.keys(rig.paint || {}).length;
      return el('div', { class: 'view-head paint-bar' },
        el('span', { class: 'small', style: { minWidth: '150px' } }, bone ? 'Knochen: ' + (bone.name || bone.id) : 'Knochen anklicken …'),
        seg, slider('Größe', 'size', 2, 30), slider('Stärke', 'strength', 5, 100),
        el('div', { class: 'spacer' }),
        bone && rig.paint && rig.paint[bone.id] ? el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { delete rig.paint[bone.id]; if (!Object.keys(rig.paint).length) delete rig.paint; }) }, 'Diesen Knochen zurücksetzen') : null,
        painted ? el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { delete rig.paint; }) }, 'Alle gemalten Gewichte löschen') : null);
    },

    finishChain(assetId) {
      const ui = VN.ui;
      const pts = ui.chain || [];
      if (pts.length < 2) { VN.toast('Mindestens zwei Punkte klicken'); return; }
      const kind = ui.chainKind || 'hair';
      const names = { hair: 'Strähne', wing: 'Flügel', tail: 'Schweif', body: 'Knochen' };
      VN.mutate(() => {
        const rig = VN.project.rigs[assetId];
        let parent = ui.chainParent || null;
        const count = rig.bones.filter((b) => (b.kind || 'body') === kind).length;
        pts.slice(1).forEach((q, i) => {
          const a = pts[i];
          const id = 'b_' + Math.random().toString(36).slice(2, 8);
          const phys = kind !== 'body';
          const preset = kind === 'wing' ? PHYS_PRESETS.Federn : kind === 'tail' ? { stiff: 0.3, damp: 0.25, wind: 0.3 } : PHYS_PRESETS.Haar;
          rig.bones.push({
            id, name: names[kind] + ' ' + (count + i + 1), parent, hx: a.x, hy: a.y, tx: q.x, ty: q.y, kind,
            motion: { type: kind === 'wing' && i === 0 ? 'swing' : 'none', amp: 8, speed: 2.4, phase: i * 40 },
            physics: Object.assign({ on: phys }, preset)
          });
          parent = id;
          ui.boneSel = id;
        });
        ui.chain = [];
        ui.chainParent = null;
      });
      VN.toast('Kette angelegt');
    },

    deleteBone(assetId, id) {
      VN.mutate(() => {
        const rig = VN.project.rigs[assetId];
        const b = rig.bones.find((x) => x.id === id);
        if (!b) return;
        for (const c of rig.bones) if (c.parent === id) c.parent = b.parent;
        rig.bones = rig.bones.filter((x) => x.id !== id);
        VN.ui.boneSel = null;
      });
    },

    blinkPanel(assetId) {
      const p = VN.project;
      p.blinks = p.blinks || {};
      const b = p.blinks[assetId];
      const card = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Blinzeln'));
      if (!b) {
        card.append(el('div', { class: 'muted small' }, 'Wähle oben „Augen markieren“ und ziehe ein Rechteck um jedes Auge. Oder nimm ein Bild mit geschlossenen Augen.'),
          el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { p.blinks[assetId] = { on: true, mode: 'image', eyes: [], image: null, color: null, lash: '#2a2440', min: 2.5, max: 6, dur: 0.16, double: 0.2 }; }) }, 'Bild mit geschlossenen Augen verwenden'));
        return card;
      }
      const rng = (label, key, min, max, step, fmt) => {
        const lab = el('div', { class: 'lbl' }, label + ': ' + fmt(b[key]));
        return el('div', { class: 'field' }, lab, el('input', { type: 'range', min, max, step, value: b[key], oninput: (e) => { lab.textContent = label + ': ' + fmt(Number(e.target.value)); }, onchange: (e) => VN.mutate(() => { b[key] = Number(e.target.value); }) }));
      };
      const modeSel = el('select', { onchange: (e) => VN.mutate(() => { b.mode = e.target.value; }) });
      for (const [v, l] of [['mask', 'Augen maskieren'], ['image', 'Bild mit geschlossenen Augen']]) { const o = el('option', { value: v }, l); if ((b.mode || 'mask') === v) o.selected = true; modeSel.appendChild(o); }
      card.append(
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!b.on, onchange: (e) => VN.mutate(() => { b.on = e.target.checked; }) }), 'Blinzeln aktiv'),
        el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Art'), modeSel));
      if ((b.mode || 'mask') === 'mask') {
        card.append(
          el('div', { class: 'muted small' }, (b.eyes || []).length + ' Augen markiert'),
          el('div', { class: 'row gap8' },
            el('span', { class: 'muted small' }, 'Lid'), el('input', { type: 'color', value: b.color || '#e9d6c4', onchange: (e) => VN.mutate(() => { b.color = e.target.value; }) }),
            el('span', { class: 'muted small' }, 'Wimpern'), el('input', { type: 'color', value: b.lash || '#2a2440', onchange: (e) => VN.mutate(() => { b.lash = e.target.value; }) }),
            el('button', { class: 'btn tiny', disabled: !(b.eyes && b.eyes.length), onclick: async () => { const c = await Blink.sampleColor(assetId, b.eyes[0]); if (c) VN.mutate(() => { b.color = c; }); } }, 'Aus Bild')));
      } else {
        const s = VN.assetSelect('image', b.image, (v) => VN.mutate(() => { b.image = v; }));
        card.append(el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Bild mit geschlossenen Augen (gleiche Größe)'), s));
      }
      card.append(
        rng('Pause min.', 'min', 0.8, 8, 0.1, (v) => Number(v).toFixed(1) + ' s'),
        rng('Pause max.', 'max', 1, 12, 0.1, (v) => Number(v).toFixed(1) + ' s'),
        rng('Dauer', 'dur', 0.08, 0.4, 0.01, (v) => Math.round(v * 1000) + ' ms'),
        rng('Doppelt blinzeln', 'double', 0, 1, 0.05, (v) => Math.round(v * 100) + ' %'),
        el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { delete p.blinks[assetId]; }) }, 'Blinzeln entfernen'));
      return card;
    },

    inspector() {
      const p = VN.project;
      const ui = VN.ui;
      const assetId = ui.boneAsset;
      const rig = assetId ? p.rigs[assetId] : null;
      const box = el('div', { class: 'insp' }, el('div', null, el('h3', null, 'Bones'), el('div', { class: 'insp-title' }, assetId ? VN.asset(assetId).name : 'Kein Bild')));
      if (assetId && (rig || (p.blinks && p.blinks[assetId]) || ui.blinkOnly === assetId)) box.appendChild(Bones.blinkPanel(assetId));
      if (!rig) {
        box.appendChild(el('div', { class: 'hint-box' }, 'Mit Bones bewegt sich ein einzelnes Bild sanft: Atmen, Schwanken, Arme schwingen, Haare und Flügel wippen nach. ',
          'Am besten mit PNGs mit transparentem Hintergrund oder SVGs. Kleine Bewegungen funktionieren mit einem einzigen Bild sehr gut.'));
        return box;
      }
      const set = (obj, key, num) => (v) => VN.mutate(() => { obj[key] = num ? Number(v) : v; });
      const rng = (label, value, min, max, step, fmt, commit) => {
        const lab = el('div', { class: 'lbl' }, label + ': ' + fmt(value));
        return el('div', { class: 'field' }, lab, el('input', { type: 'range', min, max, step, value, oninput: (e) => { lab.textContent = label + ': ' + fmt(Number(e.target.value)); }, onchange: (e) => commit(Number(e.target.value)) }));
      };
      const chk = (label, v, commit) => el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!v, onchange: (e) => commit(e.target.checked) }), label);

      if (ui.boneTool === 'chain') {
        box.appendChild(el('div', { class: 'opt-card' },
          el('div', { class: 'sec-title' }, 'Kette zeichnen'),
          el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Art der Kette'),
            (() => { const s = el('select', { onchange: (e) => { ui.chainKind = e.target.value; } }); for (const [k, l] of KIND_NAMES) { const o = el('option', { value: k }, l); if ((ui.chainKind || 'hair') === k) o.selected = true; s.appendChild(o); } return s; })()),
          el('div', { class: 'muted small' }, (ui.chain ? ui.chain.length : 0) + ' Punkte gesetzt. Haar, Flügel und Schweif bekommen automatisch Physik.'),
          el('div', { class: 'row gap8' },
            el('button', { class: 'btn primary', onclick: () => Bones.finishChain(assetId) }, 'Kette fertig'),
            el('button', { class: 'btn', onclick: () => { ui.chain = []; VN.render(); } }, 'Verwerfen'))));
      }

      const g = rig.global = rig.global || {};
      g.breathe = g.breathe || { on: false, amp: 2, speed: 3.6 };
      g.sway = g.sway || { on: false, amp: 0.8, speed: 6 };
      box.appendChild(el('div', { class: 'opt-card' },
        el('div', { class: 'sec-title' }, 'Ganze Figur'),
        chk('Atmen', g.breathe.on, set(g.breathe, 'on')),
        g.breathe.on ? rng('Stärke', g.breathe.amp, 0.5, 6, 0.1, (v) => v.toFixed(1) + ' %', set(g.breathe, 'amp', true)) : null,
        g.breathe.on ? rng('Tempo', g.breathe.speed, 1.5, 8, 0.1, (v) => v.toFixed(1) + ' s', set(g.breathe, 'speed', true)) : null,
        chk('Schwanken', g.sway.on, set(g.sway, 'on')),
        g.sway.on ? rng('Stärke', g.sway.amp, 0.1, 4, 0.1, (v) => v.toFixed(1) + '°', set(g.sway, 'amp', true)) : null,
        g.sway.on ? rng('Tempo', g.sway.speed, 2, 12, 0.5, (v) => v.toFixed(1) + ' s', set(g.sway, 'speed', true)) : null,
        rng('Zufälligkeit', g.random || 0, 0, 1, 0.05, (v) => Math.round(v * 100) + ' %', set(g, 'random', true)),
        rng('Gitter-Feinheit', rig.grid || 40, 20, 64, 2, (v) => v + ' Zellen', set(rig, 'grid', true))));

      const b = rig.bones.find((x) => x.id === ui.boneSel);
      if (b) {
        b.motion = b.motion || { type: 'none', amp: 8, speed: 2.5, phase: 0 };
        b.physics = b.physics || { on: false, stiff: 0.5, damp: 0.3, wind: 0 };
        const parentSel = el('select', { onchange: (e) => VN.mutate(() => { b.parent = e.target.value || null; }) }, el('option', { value: '' }, '— keiner (Wurzel) —'));
        for (const o of rig.bones) if (o.id !== b.id) { const op = el('option', { value: o.id }, o.name); if (o.id === b.parent) op.selected = true; parentSel.appendChild(op); }
        const kindSel = el('select', { onchange: (e) => VN.mutate(() => { b.kind = e.target.value; }) });
        for (const [k, l] of KIND_NAMES) { const o = el('option', { value: k }, l); if ((b.kind || 'body') === k) o.selected = true; kindSel.appendChild(o); }
        box.appendChild(el('div', { class: 'opt-card' },
          el('div', { class: 'sec-title' }, 'Knochen'),
          el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Name'), el('input', { type: 'text', value: b.name, onchange: (e) => VN.mutate(() => { b.name = e.target.value; }) })),
          el('div', { class: 'grid2' }, el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Art'), kindSel), el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Hängt an'), parentSel)),
          chk('Schwingen (eigene Bewegung)', b.motion.type === 'swing', (v) => VN.mutate(() => { b.motion.type = v ? 'swing' : 'none'; })),
          b.motion.type === 'swing' ? rng('Ausschlag', b.motion.amp, -30, 30, 1, (v) => v + '°', set(b.motion, 'amp', true)) : null,
          b.motion.type === 'swing' ? rng('Tempo', b.motion.speed, 0.6, 8, 0.1, (v) => v.toFixed(1) + ' s', set(b.motion, 'speed', true)) : null,
          b.motion.type === 'swing' ? rng('Versatz', b.motion.phase || 0, 0, 360, 10, (v) => v + '°', set(b.motion, 'phase', true)) : null,
          chk('Jiggle-Physik (folgt verzögert nach)', b.physics.on, set(b.physics, 'on')),
          b.physics.on ? el('div', { class: 'row gap4', style: { flexWrap: 'wrap' } }, ...Object.entries(PHYS_PRESETS).map(([n, v]) => el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { Object.assign(b.physics, v); }) }, n))) : null,
          b.physics.on ? rng('Steifheit', b.physics.stiff, 0, 1, 0.05, (v) => Math.round(v * 100) + ' %', set(b.physics, 'stiff', true)) : null,
          b.physics.on ? rng('Dämpfung', b.physics.damp, 0, 1, 0.05, (v) => Math.round(v * 100) + ' %', set(b.physics, 'damp', true)) : null,
          b.physics.on ? rng('Wind', b.physics.wind || 0, 0, 1, 0.05, (v) => Math.round(v * 100) + ' %', set(b.physics, 'wind', true)) : null,
          el('button', { class: 'btn danger', onclick: () => Bones.deleteBone(assetId, b.id) }, 'Knochen löschen')));
      } else {
        box.appendChild(el('div', { class: 'hint-box' }, 'Klicke einen Knochen an, um Bewegung und Jiggle-Physik einzustellen. Weiße Punkte auf Knochen zeigen, dass Physik aktiv ist.'));
      }
      box.appendChild(el('div', { class: 'muted small' }, rig.bones.length + ' Knochen · ' + (rig.pins || []).length + ' Pins · Vorlage: ' + ((Rig.TEMPLATES[rig.template] || {}).label || 'eigene')));
      box.appendChild(el('button', {
        class: 'btn danger', onclick: async () => {
          const r = await VN.api.confirm('Alle Bones dieses Bildes entfernen? Danach kannst du eine neue Vorlage wählen.', ['Entfernen', 'Abbrechen']);
          if (r === 0) VN.mutate(() => { delete VN.project.rigs[assetId]; VN.ui.boneSel = null; });
        }
      }, 'Bones entfernen / neue Vorlage'));
      return box;
    }
  });
})();
