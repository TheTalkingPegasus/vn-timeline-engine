// Gliederpuppen-Baukasten (0.7.6) im Reiter „Figuren“ → „Gliederpuppen“.
// Teile (Bilder) per Drag and Drop hinzufügen, verschieben, Gelenk-Pin setzen und auf ein anderes Teil ziehen
// (= Eltern-Teil, wie die Verbindung in After Effects). Idle und Bones pro Teil. „Ausprobieren“ dreht Teile um
// ihre Pins (Umschalt = IK: die Kette folgt der Maus), ohne etwas zu speichern.
(function () {
  const { el } = VN;
  const M = () => Puppet.m;
  const ui = () => VN.ui;
  const list = () => (VN.project.puppets = VN.project.puppets || []);
  const cur = () => { const l = list(); if (!l.find((x) => x.id === ui().pupSel)) ui().pupSel = l[0] ? l[0].id : null; return l.find((x) => x.id === ui().pupSel) || null; };
  const selPart = (pup) => (pup && ui().pupPart ? Puppet.part(pup, ui().pupPart) : null);

  const PupEd = (window.PupEd = { _res: null, _resKey: '' });

  // Bild-Transparenz für genaue Treffer (Klick auf durchsichtige Stellen trifft das Teil darunter)
  const alphaCache = new Map();
  const alphaOf = (img) => {
    if (!img) return null;
    if (alphaCache.has(img)) return alphaCache.get(img);
    let out = null;
    try {
      const w = Math.min(256, img.naturalWidth || 256), h = Math.max(1, Math.round(w * (img.naturalHeight || 256) / (img.naturalWidth || 256)));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h).data; out = { w, h, a: new Uint8Array(w * h) };
      for (let i = 0; i < w * h; i++) out.a[i] = d[i * 4 + 3];
    } catch (e) { out = null; }
    alphaCache.set(img, out);
    return out;
  };

  PupEd.newPuppet = () => VN.mutate(() => {
    const pup = { id: VN.uid('pup'), name: VN.t('Neue Gliederpuppe'), parts: [] };
    list().push(pup); ui().pupSel = pup.id; ui().pupPart = null; ui().pupView = null;
  });
  // Teil aus einem Bild anlegen (an Puppen-Koordinate x, y = Mitte)
  PupEd.addPart = (pup, assetId, x, y) => {
    const im = new Image();
    const go = (w, h) => {
      // sehr große Bilder auf eine handliche Größe bringen – Verhältnis bleibt
      const k = Math.min(1, 900 / Math.max(w, h));
      w = Math.round(w * k); h = Math.round(h * k);
      VN.mutate(() => {
        const bb = pup.parts.length ? Puppet.bounds(pup) : { x: 0, y: 0, w: 0, h: 0 };
        const px = x != null ? x - w / 2 : bb.x + bb.w / 2 - w / 2, py = y != null ? y - h / 2 : bb.y + bb.h / 2 - h / 2;
        const p = Puppet.newPart(assetId, w, h, px, py);
        pup.parts.push(p);
        ui().pupPart = p.id;
        if (pup.parts.length === 1) ui().pupView = null;
      });
    };
    im.onload = () => go(im.naturalWidth || 200, im.naturalHeight || 200);
    im.onerror = () => go(200, 200);
    im.src = VN.assetUrl(assetId);
  };
  PupEd.removePart = (pup, p) => VN.mutate(() => {
    for (const c of pup.parts) if (c.parent === p.id) c.parent = p.parent || null;
    pup.parts = pup.parts.filter((x) => x !== p);
    if (ui().pupPart === p.id) ui().pupPart = null;
  });
  // Pin verschieben, ohne dass das Bild springt (auch bei gedrehten Teilen)
  PupEd.setPin = (p, ax, ay) => {
    const r = (p.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const ra = (x, y) => [x - (c * x - s * y), y - (s * x + c * y)];
    const [o1, o2] = ra(p.ax, p.ay), [n1, n2] = ra(ax, ay);
    p.x += o1 - n1; p.y += o2 - n2; p.ax = ax; p.ay = ay;
  };

  // ---------- Bühne ----------
  PupEd.render = (center) => {
    center.innerHTML = '';
    cancelAnimationFrame(PupEd._raf);
    const pup = cur();
    const body = el('div', { class: 'pup-wrap' });
    center.appendChild(body);
    const side = el('div', { class: 'pup-list' }, el('div', { class: 'sec-title' }, 'Gliederpuppen'),
      ...list().map((x) => el('div', { class: 'list-item' + (x === pup ? ' active' : ''), onclick: () => { ui().pupSel = x.id; ui().pupPart = null; ui().pupView = null; ui().pupTest = null; VN.render(); } },
        el('span', { class: 'an-ico' }, '🦴'), el('span', { class: 'name' }, x.name), el('span', { class: 'muted small' }, x.parts.length + ' ' + VN.t('Teile')))),
      el('button', { class: 'btn tiny primary', onclick: PupEd.newPuppet }, '+ Gliederpuppe'));
    body.appendChild(side);
    const main = el('div', { class: 'pup-main' });
    body.appendChild(main);
    if (!pup) {
      main.appendChild(el('div', { class: 'an-empty' },
        el('div', { style: { fontSize: '40px' } }, '🦴'),
        el('h2', null, 'Gliederpuppen'),
        el('p', { class: 'muted' }, 'Setze eine Figur aus einzelnen Körperteilen zusammen – Kopf, Torso, Oberarm, Unterarm, Hand … – jedes Teil ein eigenes Bild mit transparentem Hintergrund. Verbinde die Teile mit Gelenk-Pins: Der Oberarm hängt an der Schulter, der Unterarm am Ellbogen. Dann lässt sich die Figur wie eine Puppe bewegen, im Animations-Editor animieren und im Spiel mit Idle-Bewegungen zeigen.'),
        el('button', { class: 'btn primary', onclick: PupEd.newPuppet }, '+ Neue Gliederpuppe')));
      return;
    }
    const testing = !!ui().pupTest;
    main.appendChild(el('div', { class: 'view-head' },
      el('input', { class: 'name-input', value: pup.name, onchange: (e) => VN.mutate(() => { pup.name = e.target.value || 'Gliederpuppe'; }) }),
      el('span', { class: 'muted' }, pup.parts.length + ' ' + VN.t('Teile')),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn' + (testing ? ' primary' : ''), title: VN.t('Teile um ihre Pins drehen (Umschalt = IK), ohne zu speichern'), onclick: () => { ui().pupTest = testing ? null : {}; VN.render(); } }, testing ? '✓ Ausprobieren' : '🤸 Ausprobieren'),
      testing ? el('button', { class: 'btn', onclick: () => { ui().pupTest = {}; VN.render(); } }, VN.t('Zurücksetzen')) : null,
      el('button', { class: 'btn' + (ui().pupErase ? ' primary' : ''), title: VN.t('Kanten und harte Übergänge an einem Teil wegradieren – Größe und Weichheit einstellbar'), onclick: () => PupEd.toggleErase(pup) }, ui().pupErase ? '✓ Radierer' : '🧽 Radierer'),
      el('label', { class: 'check btn' }, el('input', { type: 'checkbox', checked: !!ui().pupIdle, onchange: (e) => { ui().pupIdle = e.target.checked; } }), 'Idle abspielen'),
      el('label', { class: 'check btn' }, el('input', { type: 'checkbox', checked: ui().pupPins !== false, onchange: (e) => { ui().pupPins = e.target.checked; } }), 'Pins')));
    const wrap = el('div', { class: 'pup-stage-wrap' });
    const canvas = el('canvas', { class: 'pup-ed-canvas', tabindex: '0' });
    wrap.appendChild(canvas);
    main.appendChild(wrap);
    main.appendChild(el('div', { class: 'muted small pup-help' }, ui().pupErase
      ? 'Radierer: Teil wählen und über die Kante malen · Größe und Kantenweichheit rechts · „Wiederherstellen“ malt das Original zurück · Mausrad + Strg = Pinselgröße · Speichern legt eine neue Bilddatei an, das Original bleibt erhalten.'
      : testing
      ? 'Ausprobieren: Teil ziehen = um den Pin drehen · Umschalt + ziehen = IK (die Kette folgt der Maus) · Wurzel-Teil ziehen = ganze Figur verschieben. Nichts davon wird gespeichert.'
      : 'Bilder aus der Dateiliste hierher ziehen = neues Teil · Teil ziehen = verschieben (Kinder wandern mit, Alt = nur dieses Teil) · roten Pin ziehen = Gelenk setzen; auf einem anderen Teil loslassen = daran anhängen · Entf = Teil löschen'));
    PupEd.stage(pup, canvas, wrap);
  };

  PupEd.stage = (pup, canvas, wrap) => {
    const key = JSON.stringify(pup.parts.map((p) => [p.asset, p.bones !== false, window.Rig && Rig.has(p.asset)]));
    if (PupEd._resKey !== key) { PupEd._resKey = key; PupEd._res = null; PupEd._resP = Puppet.load(pup).then((r) => { if (PupEd._resKey === key) PupEd._res = r; }); }
    const ctx = canvas.getContext('2d');
    const st = {};
    const t0 = performance.now();
    let last = t0;
    let drag = null;
    // Ansicht: Puppe passend einpassen (bleibt beim Ziehen stehen)
    const view = () => {
      const r = canvas.getBoundingClientRect();
      if (!ui().pupView || ui().pupView.w !== Math.round(r.width) || ui().pupView.h !== Math.round(r.height)) {
        const bb = pup.parts.length ? Puppet.bounds(pup) : { x: -200, y: -300, w: 400, h: 600 };
        const k = Math.min(2, Math.min((r.width - 80) / bb.w, (r.height - 80) / bb.h));
        ui().pupView = { w: Math.round(r.width), h: Math.round(r.height), k, x: r.width / 2 - (bb.x + bb.w / 2) * k, y: r.height / 2 - (bb.y + bb.h / 2) * k };
      }
      return ui().pupView;
    };
    const baseM = () => { const v = view(); return [v.k, 0, 0, v.k, v.x, v.y]; };
    const toPup = (cx, cy) => { const r = canvas.getBoundingClientRect(); const v = view(); return [(cx - r.left - v.x) / v.k, (cy - r.top - v.y) / v.k]; };
    const pose = () => (ui().pupTest ? ui().pupTest : null);
    const mats = () => Puppet.solve(pup, pose(), null, null, 0);
    // Teil unter einem Punkt (Puppen-Koordinaten), oberstes zuerst, durchsichtige Stellen zählen nicht
    const hitPart = (x, y, skip) => {
      const ms = mats();
      for (let i = pup.parts.length - 1; i >= 0; i--) {
        const p = pup.parts[i];
        if (p.hidden || (skip && skip.has(p.id))) continue;
        let [u, v] = M().ap(M().inv(ms[p.id]), x, y);
        if (u < 0 || v < 0 || u > p.w || v > p.h) continue;
        if (p.flipX) u = p.w - u;
        const al = PupEd._res && alphaOf(PupEd._res.imgs[p.id]);
        if (al && al.a[Math.min(al.h - 1, Math.floor(v / p.h * al.h)) * al.w + Math.min(al.w - 1, Math.floor(u / p.w * al.w))] < 20) continue;
        return p;
      }
      return null;
    };
    const pinAt = (x, y) => {
      if (ui().pupPins === false) return null;
      const ms = mats(), k = view().k;
      const sel = selPart(pup);
      const order = sel ? [sel, ...pup.parts.filter((p) => p !== sel).reverse()] : pup.parts.slice().reverse();
      return order.find((p) => { const [px, py] = M().ap(ms[p.id], p.ax, p.ay); return Math.hypot(px - x, py - y) < 9 / k; }) || null;
    };

    const frame = (now) => {
      if (!canvas.isConnected) return;
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(r.width * dpr) || canvas.height !== Math.round(r.height * dpr)) { canvas.width = Math.max(2, Math.round(r.width * dpr)); canvas.height = Math.max(2, Math.round(r.height * dpr)); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const dt = Math.min(1 / 20, (now - last) / 1000); last = now;
      const erasing = !!ui().pupErase;
      const t = ui().pupIdle && !erasing ? (now - t0) / 1000 : null;
      const base = baseM();
      // Boden-Linie
      const bb = pup.parts.length ? Puppet.bounds(pup) : null;
      if (bb) { const [, gy] = M().ap(base, 0, bb.y + bb.h); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(r.width, gy); ctx.stroke(); }
      const ed = PupEd._edit;
      const ms = Puppet.draw(ctx, pup, PupEd._res, base, t, t != null ? dt : 0, erasing ? null : pose(), st, { placeholder: true, override: ed && ed.cv ? { [ed.pid]: ed.cv } : null });
      // Auswahl, Pins, Verbindungen
      const sel = selPart(pup);
      if (sel && ms[sel.id]) {
        const m = ms[sel.id];
        ctx.beginPath();
        for (const [i, [u, v]] of [[0, 0], [sel.w, 0], [sel.w, sel.h], [0, sel.h]].entries()) { const [x, y] = M().ap(m, u, v); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.closePath(); ctx.strokeStyle = '#e8a43a'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
      }
      if (ui().pupPins !== false) {
        for (const p of pup.parts) {
          if (!ms[p.id]) continue;
          const [px, py] = M().ap(ms[p.id], p.ax, p.ay);
          const par = p.parent && Puppet.part(pup, p.parent);
          if (par && ms[par.id]) {
            const [qx, qy] = M().ap(ms[par.id], par.ax, par.ay);
            ctx.strokeStyle = 'rgba(255,90,90,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
          }
          const on = sel === p;
          const pinned = ui().pupTest && ui().pupPinned && ui().pupPinned[p.id];
          ctx.fillStyle = on ? '#ff5a5a' : par ? 'rgba(255,90,90,0.85)' : '#e8a43a';
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(px, py, on ? 7 : 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          if (pinned) { const [tx, ty] = M().ap(ms[p.id], ...Puppet.tip(p)); ctx.fillStyle = '#4fb3c8'; ctx.fillRect(tx - 5, ty - 5, 10, 10); }
        }
      }
      // Pinsel-Vorschau des Radierers
      if (erasing && PupEd._mouse) {
        const E = ui().pupErase, r0 = E.size / 2;
        ctx.strokeStyle = E.mode === 'restore' ? '#6cc48a' : '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(PupEd._mouse[0], PupEd._mouse[1], r0, 0, Math.PI * 2); ctx.stroke();
        const inner = r0 * (1 - E.soft / 100);
        if (inner > 2) { ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(PupEd._mouse[0], PupEd._mouse[1], inner, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      }
      if (drag && drag.drop) { const [x, y] = M().ap(base, drag.drop[0], drag.drop[1]); ctx.strokeStyle = '#6cc48a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.stroke(); }
      if (!pup.parts.length) { ctx.fillStyle = '#7d808c'; ctx.font = '14px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(VN.t('Bilder aus der Dateiliste hierher ziehen – jedes Bild wird ein Körperteil.'), r.width / 2, r.height / 2); }
      PupEd._raf = requestAnimationFrame(frame);
    };
    PupEd._raf = requestAnimationFrame(frame);

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      canvas.focus({ preventScroll: true });
      const [x, y] = toPup(e.clientX, e.clientY);
      if (ui().pupErase) { e.preventDefault(); PupEd.eraseDown(e, pup, canvas, toPup, view, mats, hitPart); return; }
      const testing = !!ui().pupTest;
      // Pin ziehen (nur beim Bauen)
      const pin = !testing && pinAt(x, y);
      if (pin) {
        e.preventDefault();
        ui().pupPart = pin.id;
        const before = JSON.stringify(pup.parts);
        const m0 = Puppet.rest(pin);
        const skip = new Set([pin.id, ...Puppet.descendants(pup, pin.id)]);
        drag = { kind: 'pin' };
        VN.drag(e, (dx, dy, ev) => {
          const [qx, qy] = toPup(ev.clientX, ev.clientY);
          const [u, v] = M().ap(M().inv(m0), qx, qy);
          PupEd.setPin(pin, Math.round(u), Math.round(v));
          const tgt = !ev.altKey && hitPart(qx, qy, skip);
          drag.drop = tgt ? [qx, qy] : null; drag.target = tgt;
        }, (dx, dy, moved) => {
          const tgt = drag.target; drag = null;
          if (!moved) { VN.render(); return; }
          const after = JSON.stringify(pup.parts);
          pup.parts = JSON.parse(before);
          VN.mutate(() => {
            pup.parts = JSON.parse(after);
            const p = Puppet.part(pup, pin.id);
            if (tgt) { p.parent = tgt.id; VN.toast(VN.tf('„{a}“ hängt jetzt an „{b}“', { a: p.name, b: tgt.name })); }
          });
        });
        return;
      }
      const hit = hitPart(x, y);
      if (!hit) { if (ui().pupPart) { ui().pupPart = null; VN.render(); } return; }
      e.preventDefault();
      ui().pupPart = hit.id;
      if (testing) {
        // Puppenspiel: Teil um seinen Pin drehen, Umschalt = IK, Wurzel = verschieben
        const pose = ui().pupTest;
        const ms = mats();
        const local = M().ap(M().inv(ms[hit.id]), x, y);
        const piv = M().ap(ms[hit.id], hit.ax, hit.ay);
        const ps0 = Object.assign({ r: 0, x: 0, y: 0 }, pose[hit.id] || {});
        const a0 = Math.atan2(y - piv[1], x - piv[0]);
        const pins = Object.keys(ui().pupPinned || {}).filter((k) => ui().pupPinned[k] && k !== hit.id);
        const fixed = {}; for (const pid of pins) fixed[pid] = Puppet.tipWorld(pup, pose, pid);
        VN.drag(e, (dx, dy, ev) => {
          const [qx, qy] = toPup(ev.clientX, ev.clientY);
          if (!hit.parent && !ev.shiftKey) { pose[hit.id] = Object.assign({}, ps0, { x: ps0.x + qx - x, y: ps0.y + qy - y }); }
          else if (ev.shiftKey) Puppet.ik(pup, pose, hit.id, local, [qx, qy], { links: 3 });
          else { let d = (Math.atan2(qy - piv[1], qx - piv[0]) - a0) * 180 / Math.PI; pose[hit.id] = Object.assign({}, ps0, { r: ps0.r + d }); }
          Puppet.keepPins(pup, pose, pins, fixed);
        }, () => VN.render());
        return;
      }
      // Bauen: Teil verschieben (Kinder wandern mit, Alt = nur dieses Teil)
      const group = e.altKey ? [hit] : [hit, ...[...Puppet.descendants(pup, hit.id)].map((id) => Puppet.part(pup, id))];
      const start = group.map((p) => [p.x, p.y]);
      VN.drag(e, (dx, dy, ev) => {
        const [qx, qy] = toPup(ev.clientX, ev.clientY);
        group.forEach((p, i) => { p.x = Math.round(start[i][0] + qx - x); p.y = Math.round(start[i][1] + qy - y); });
      }, (dx, dy, moved) => {
        if (!moved) { VN.render(); return; }
        const end = group.map((p) => [p.x, p.y]);
        group.forEach((p, i) => { p.x = start[i][0]; p.y = start[i][1]; });
        VN.mutate(() => { group.forEach((p, i) => { p.x = end[i][0]; p.y = end[i][1]; }); });
      });
    });
    canvas.addEventListener('mousemove', (e) => { const r = canvas.getBoundingClientRect(); PupEd._mouse = [e.clientX - r.left, e.clientY - r.top]; });
    canvas.addEventListener('mouseleave', () => { PupEd._mouse = null; });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (ui().pupErase && (e.ctrlKey || e.metaKey)) { const E = ui().pupErase; E.size = Math.max(2, Math.min(400, Math.round(E.size * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))); const n = document.getElementById('pup-er-size'); if (n) n.value = E.size; return; }
      const v = view(), r = canvas.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top, nk = Math.max(0.05, Math.min(6, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      v.x = px - (px - v.x) * nk / v.k; v.y = py - (py - v.y) * nk / v.k; v.k = nk;
    }, { passive: false });
    canvas.addEventListener('dblclick', (e) => {
      // Im Ausprobieren-Modus: Doppelklick pinnt ein Teil fest (IK hält sein Ende an Ort und Stelle)
      if (!ui().pupTest) return;
      const [x, y] = toPup(e.clientX, e.clientY);
      const hit = hitPart(x, y);
      if (!hit || !hit.parent) return;
      ui().pupPinned = ui().pupPinned || {};
      ui().pupPinned[hit.id] = !ui().pupPinned[hit.id];
      VN.toast(ui().pupPinned[hit.id] ? VN.tf('„{name}“ festgepinnt', { name: hit.name }) : VN.tf('„{name}“ gelöst', { name: hit.name }));
    });
    canvas.addEventListener('keydown', (e) => {
      const p = selPart(pup);
      if ((e.key === 'Delete' || e.key === 'Backspace') && p && !ui().pupTest) { e.preventDefault(); e.stopPropagation(); PupEd.removePart(pup, p); }
    });
    wrap.addEventListener('dragover', (e) => { if (Array.from(e.dataTransfer.types).includes('vn/asset-image') || Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); e.stopPropagation(); wrap.classList.add('over'); } });
    wrap.addEventListener('dragleave', () => wrap.classList.remove('over'));
    wrap.addEventListener('drop', async (e) => {
      e.preventDefault(); e.stopPropagation(); wrap.classList.remove('over');
      const ov = document.getElementById('drag-overlay'); if (ov) ov.hidden = true;
      const [x, y] = toPup(e.clientX, e.clientY);
      let id = e.dataTransfer.getData('vn/asset-image');
      if (!id) { const added = await VN.importPaths(VN.filePaths(e.dataTransfer)); const im = added.find((a) => a.kind === 'image'); if (!im) return; id = im.id; }
      PupEd.addPart(pup, id, x, y);
    });
  };

  // ---------- Rechte Seite ----------
  PupEd.inspector = () => {
    const pup = cur();
    const box = el('div', { class: 'insp' }, el('div', null, el('h3', null, 'Figuren'), el('div', { class: 'insp-title' }, pup ? pup.name : 'Gliederpuppen')));
    if (!pup) {
      box.appendChild(el('div', { class: 'hint-box' }, el('strong', null, 'So geht’s'), el('br'),
        '1. Körperteile als einzelne PNGs vorbereiten (transparent). 2. Puppe anlegen und die Bilder auf die Fläche ziehen. 3. Bei jedem Teil den roten Pin auf das Gelenk ziehen und auf dem Eltern-Teil loslassen (Unterarm-Pin auf den Oberarm, Oberarm-Pin auf den Torso). 4. Im Animations-Editor einen Darsteller anlegen und „Gliederpuppe“ wählen.'));
      return box;
    }
    const field = (label, ...kids) => el('div', { class: 'field' }, el('div', { class: 'lbl' }, label), ...kids);
    const num = (v, fn, step) => el('input', { type: 'number', step: step || 1, value: Math.round((v || 0) * 100) / 100, onchange: (e) => VN.mutate(() => fn(Number(String(e.target.value).replace(',', '.')) || 0)) });
    const sel = (v, opts, fn) => { const s = el('select', { onchange: (e) => VN.mutate(() => fn(e.target.value)) }); for (const [k, l] of opts) s.appendChild(el('option', { value: k, selected: String(k) === String(v == null ? '' : v) }, l)); return s; };
    // Ebenen-Liste (oben = vorne)
    const layers = el('div', { class: 'opt-card pup-layers' }, el('div', { class: 'sec-title' }, 'Teile (oben = vorne)'));
    const depth = (p) => { let d = 0, q = p; while (q && q.parent && d < 12) { d++; q = Puppet.part(pup, q.parent); } return d; };
    pup.parts.slice().reverse().forEach((p) => {
      const i = pup.parts.indexOf(p);
      const rigged = window.Rig && Rig.has(p.asset);
      layers.appendChild(el('div', { class: 'pup-layer' + (ui().pupPart === p.id ? ' on' : ''), onclick: () => { ui().pupPart = p.id; VN.render(); } },
        el('span', { class: 'pup-indent', style: { width: depth(p) * 10 + 'px' } }),
        el('span', { class: 'mini-thumb', style: { backgroundImage: `url("${VN.assetUrl(p.asset) || ''}")` } }),
        el('span', { class: 'name' }, p.name),
        rigged && p.bones !== false ? el('span', { class: 'chip green', title: VN.t('hat Bones') }, '🦴') : null,
        p.idle && p.idle.type !== 'none' ? el('span', { class: 'chip', title: VN.t('Idle') }, '∿') : null,
        el('button', { class: 'btn tiny', title: VN.t('nach vorne'), disabled: i === pup.parts.length - 1, onclick: (e) => { e.stopPropagation(); VN.mutate(() => { pup.parts.splice(i, 1); pup.parts.splice(i + 1, 0, p); }); } }, '▲'),
        el('button', { class: 'btn tiny', title: VN.t('nach hinten'), disabled: i === 0, onclick: (e) => { e.stopPropagation(); VN.mutate(() => { pup.parts.splice(i, 1); pup.parts.splice(i - 1, 0, p); }); } }, '▼')));
    });
    layers.appendChild(el('div', { class: 'row gap8' },
      (() => { const s = VN.assetSelect('image', '', (v) => { if (v) PupEd.addPart(pup, v); }); s.title = VN.t('Bild als neues Teil hinzufügen'); return s; })()));
    box.appendChild(layers);

    if (ui().pupErase) box.appendChild(PupEd.eraseCard(pup));
    const p = selPart(pup);
    if (p) {
      const rigged = window.Rig && Rig.has(p.asset);
      const notMine = new Set([p.id, ...Puppet.descendants(pup, p.id)]);
      box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Teil · ' + p.name),
        field('Name', el('input', { type: 'text', value: p.name, onchange: (e) => VN.mutate(() => { p.name = e.target.value || 'Teil'; }) })),
        field('Bild', VN.assetSelect('image', p.asset, (v) => VN.mutate(() => { p.asset = v; }))),
        field('Hängt an (Eltern-Teil)', sel(p.parent || '', [['', '— nichts (Wurzel, z. B. Torso) —'], ...pup.parts.filter((x) => !notMine.has(x.id)).map((x) => [x.id, x.name])], (v) => { p.parent = v || null; })),
        el('div', { class: 'grid2' },
          field('X', num(p.x, (v) => { p.x = v; })), field('Y', num(p.y, (v) => { p.y = v; })),
          field('Breite', num(p.w, (v) => { const k = v / (p.w || 1); p.w = Math.max(4, v); p.h = Math.max(4, Math.round(p.h * k)); p.ax *= k; p.ay *= k; })),
          field('Drehung in Ruhe °', num(p.rot, (v) => { p.rot = v; })),
          field('Pin X (im Bild)', num(p.ax, (v) => PupEd.setPin(p, v, p.ay))), field('Pin Y (im Bild)', num(p.ay, (v) => PupEd.setPin(p, p.ax, v)))),
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!p.hidden, onchange: (e) => VN.mutate(() => { p.hidden = e.target.checked; }) }), 'Ausblenden')));
      const id = p.idle || (p.idle = { type: 'none', amp: 4, speed: 3, phase: 0 });
      box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Idle dieses Teils'),
        field('Bewegung', sel(id.type || 'none', Puppet.IDLE, (v) => { id.type = v; if (v === 'breathe' && !(Number(id.amp) > 0)) id.amp = 3; })),
        id.type && id.type !== 'none' ? el('div', { class: 'grid2' },
          field(id.type === 'sway' || id.type === 'jiggle' ? 'Stärke °' : id.type === 'bob' ? 'Weite px' : 'Stärke %', num(id.amp, (v) => { id.amp = v; }, 0.5)),
          field('Dauer s', num(id.speed, (v) => { id.speed = Math.max(0.2, v); }, 0.1)),
          field('Versatz °', num(id.phase, (v) => { id.phase = v; }, 15))) : null,
        el('div', { class: 'muted small' }, 'Jiggle schwingt nach, wenn sich das Eltern-Teil bewegt (Haare, Ohren, Schwanz). Unterschiedlicher Versatz bei mehreren Teilen wirkt lebendiger.')));
      box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Bones dieses Teils'),
        rigged ? el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: p.bones !== false, onchange: (e) => VN.mutate(() => { p.bones = e.target.checked; }) }), 'Bones benutzen (Verformen, Atmen, Physik aus dem Bones-Editor)') : el('div', { class: 'muted small' }, 'Dieses Teil hat noch keine Bones. Mit Bones lässt es sich zusätzlich verformen – z. B. Haare, Schwanz, Umhang mit Physik.'),
        el('button', { class: 'btn tiny', onclick: () => { if (window.App && App.openBones) App.openBones(p.asset); } }, rigged ? '🦴 Bones bearbeiten' : '🦴 Bones einrichten')));
      box.appendChild(el('div', { class: 'row gap8' },
        el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const c = JSON.parse(JSON.stringify(p)); c.id = VN.uid('pp'); c.name = p.name + ' 2'; c.x += 20; c.y += 20; pup.parts.splice(pup.parts.indexOf(p) + 1, 0, c); ui().pupPart = c.id; }) }, 'Duplizieren'),
        el('button', { class: 'btn tiny', title: VN.t('Spiegelt das Teil und seine Kinder an der Mitte der Puppe – z. B. linken Arm als rechten Arm anlegen'), onclick: () => PupEd.mirrorCopy(pup, p) }, '⇋ Gespiegelt kopieren'),
        el('button', { class: 'btn tiny danger', onclick: () => PupEd.removePart(pup, p) }, 'Teil löschen')));
    } else box.appendChild(el('div', { class: 'hint-box' }, 'Teil auf der Fläche anklicken. Der rote Punkt ist sein Gelenk-Pin: auf das Gelenk ziehen und über dem Teil loslassen, an dem es hängen soll.'));

    box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Verwenden'),
      el('div', { class: 'muted small' }, 'Timeline: Figuren-Clip → „Art der Figur“ → diese Gliederpuppe. Animieren: Reiter „Animation“ → Darsteller → „🦴 Gliederpuppe“.'),
      el('button', { class: 'btn tiny', onclick: () => PupEd.newAnim(pup, 'idle') }, '∞ Idle-Animation für diese Puppe'),
      el('button', { class: 'btn tiny', onclick: () => PupEd.newAnim(pup, 'gesture') }, '✋ Geste für diese Puppe')));
    box.appendChild(el('button', { class: 'btn danger', onclick: () => VN.mutate(() => { VN.project.puppets = list().filter((x) => x !== pup); ui().pupSel = null; }) }, 'Gliederpuppe löschen'));
    return box;
  };

  // ---------- Radierer (0.7.8) ----------
  // Malt auf einer Kopie des Teil-Bildes. Speichern legt eine neue PNG-Datei an (das Original bleibt erhalten und
  // lässt sich jederzeit zurückholen). Bones und Blinzeln werden auf das neue Bild übernommen.
  PupEd.toggleErase = (pup) => {
    if (ui().pupErase) {
      if (PupEd._edit && PupEd._edit.dirty && !window.confirm(VN.t('Ungespeicherte Radierer-Änderungen verwerfen?'))) return;
      ui().pupErase = null; PupEd._edit = null;
    } else { ui().pupErase = { size: 40, soft: 60, mode: 'erase' }; ui().pupTest = null; }
    VN.render();
  };
  const loadImg = (url) => new Promise((res) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
  PupEd.startEdit = async (pup, p) => {
    if (PupEd._edit && PupEd._edit.pid === p.id) return PupEd._edit;
    if (PupEd._edit && PupEd._edit.dirty) await PupEd.saveEdit(pup);
    const ed = PupEd._edit = { pid: p.id, cv: null, orig: null, dirty: false };
    const cur = await loadImg(VN.assetUrl(p.asset));
    const orig = p.origAsset ? await loadImg(VN.assetUrl(p.origAsset)) : cur;
    if (!cur || PupEd._edit !== ed) return null;
    const nw = cur.naturalWidth || p.w, nh = cur.naturalHeight || p.h;
    const k = Math.min(2048 / Math.max(nw, nh), Math.max(1, p.w / nw));
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(nw * k)); cv.height = Math.max(1, Math.round(nh * k));
    cv.getContext('2d').drawImage(cur, 0, 0, cv.width, cv.height);
    ed.cv = cv; ed.orig = orig;
    return ed;
  };
  const stamp = (ed, x, y, r, soft, mode) => {
    const c = ed.cv.getContext('2d');
    const inner = Math.max(0, r * (1 - soft / 100));
    const g = c.createRadialGradient(x, y, inner, x, y, Math.max(inner + 0.01, r));
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    if (mode === 'restore') {
      if (!ed.orig) return;
      // Original durch die Pinselspitze zurückmalen
      const s = Math.ceil(r * 2) + 2;
      const t = ed.tmp || (ed.tmp = document.createElement('canvas'));
      if (t.width < s || t.height < s) { t.width = s; t.height = s; }
      const tc = t.getContext('2d');
      tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, t.width, t.height);
      const gx = tc.createRadialGradient(s / 2, s / 2, inner, s / 2, s / 2, Math.max(inner + 0.01, r));
      gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(1, 'rgba(0,0,0,0)');
      tc.fillStyle = gx; tc.fillRect(0, 0, s, s);
      tc.globalCompositeOperation = 'source-in';
      tc.drawImage(ed.orig, -(x - s / 2), -(y - s / 2), ed.cv.width, ed.cv.height);
      c.globalCompositeOperation = 'source-over';
      c.drawImage(t, 0, 0, s, s, x - s / 2, y - s / 2, s, s);
    } else {
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
  };
  PupEd.eraseDown = async (e, pup, canvas, toPup, view, mats, hitPart) => {
    const [x0, y0] = toPup(e.clientX, e.clientY);
    let p = selPart(pup);
    if (!p) { p = hitPart(x0, y0); if (!p) return; ui().pupPart = p.id; VN.render(); }
    const ed = await PupEd.startEdit(pup, p);
    if (!ed || !ed.cv) return;
    const E = ui().pupErase;
    // Bildschirm → Pixel des Bearbeitungs-Bildes
    const toImg = (cx, cy) => {
      const [px, py] = toPup(cx, cy);
      let [u, v] = Puppet.m.ap(Puppet.m.inv(mats()[p.id]), px, py);
      if (p.flipX) u = p.w - u;
      return [u * ed.cv.width / p.w, v * ed.cv.height / p.h];
    };
    // Pinselgröße ist in Bildschirm-Pixeln eingestellt
    const radius = () => E.size / 2 / view().k * ed.cv.width / p.w;
    let last = toImg(e.clientX, e.clientY);
    stamp(ed, last[0], last[1], radius(), E.soft, E.mode);
    ed.dirty = true;
    const move = (ev) => {
      const cur = toImg(ev.clientX, ev.clientY);
      const r = radius(), d = Math.hypot(cur[0] - last[0], cur[1] - last[1]), step = Math.max(1, r / 4);
      for (let s = step; s <= d; s += step) stamp(ed, last[0] + (cur[0] - last[0]) * s / d, last[1] + (cur[1] - last[1]) * s / d, r, E.soft, E.mode);
      if (d >= step) last = cur;
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); VN.render(); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  PupEd.saveEdit = async (pup) => {
    const ed = PupEd._edit;
    if (!ed || !ed.dirty || !ed.cv) return;
    const p = Puppet.part(pup, ed.pid);
    if (!p) return;
    const blob = await new Promise((res) => ed.cv.toBlob(res, 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const src = VN.asset(p.origAsset || p.asset) || { name: p.name };
    const safe = String(src.name || 'teil').replace(/[^\wäöüÄÖÜß -]/g, '').trim().replace(/\s+/g, '_') || 'teil';
    const rel = await VN.api.writeAsset(VN.dir, 'assets/' + safe + '_retusche.png', bytes);
    if (!rel || typeof rel !== 'string') { VN.toast(VN.t('Speichern ging nicht')); return; }
    const old = p.asset;
    VN.mutate(() => {
      const a = { id: VN.uid('a'), name: (src.name || p.name) + ' ' + VN.t('(retuschiert)'), kind: 'image', file: rel };
      VN.project.assets.push(a);
      // Bones und Blinzeln vom bisherigen Bild übernehmen
      if (VN.project.rigs[old]) VN.project.rigs[a.id] = JSON.parse(JSON.stringify(VN.project.rigs[old]));
      if (VN.project.blinks && VN.project.blinks[old]) VN.project.blinks[a.id] = JSON.parse(JSON.stringify(VN.project.blinks[old]));
      if (!p.origAsset) p.origAsset = old;
      p.asset = a.id;
    });
    PupEd._edit = null;
    VN.toast(VN.t('Retusche gespeichert – das Original bleibt erhalten'));
  };
  PupEd.eraseCard = (pup) => {
    const E = ui().pupErase;
    const p = selPart(pup);
    const ed = PupEd._edit && p && PupEd._edit.pid === p.id ? PupEd._edit : null;
    const slider = (id, label, key, min, max, unit) => {
      const lab = el('span', { class: 'muted small' }, E[key] + unit);
      return el('div', { class: 'field' }, el('div', { class: 'lbl' }, label, ' ', lab),
        el('div', { class: 'rng-row' }, el('input', { type: 'range', id, min, max, value: E[key], oninput: (e) => { E[key] = Number(e.target.value); lab.textContent = E[key] + unit; } })));
    };
    return el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, '🧽 Radierer' + (p ? ' · ' + p.name : '')),
      p ? null : el('div', { class: 'hint-box' }, VN.t('Teil auf der Fläche anklicken, dann über die Kante malen.')),
      el('div', { class: 'seg' }, ...[['erase', 'Radieren'], ['restore', 'Wiederherstellen']].map(([k, l]) => el('button', { class: E.mode === k ? 'active' : '', onclick: () => { E.mode = k; VN.render(); } }, VN.t(l)))),
      slider('pup-er-size', VN.t('Größe'), 'size', 2, 300, ' px'),
      slider('pup-er-soft', VN.t('Kantenweichheit'), 'soft', 0, 100, ' %'),
      el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
        el('button', { class: 'btn tiny primary', disabled: !(ed && ed.dirty), onclick: () => PupEd.saveEdit(pup) }, '💾 ' + VN.t('Speichern')),
        el('button', { class: 'btn tiny', disabled: !(ed && ed.dirty), onclick: () => { PupEd._edit = null; VN.render(); } }, VN.t('Verwerfen')),
        p && p.origAsset ? el('button', { class: 'btn tiny', title: VN.t('Zum unbearbeiteten Bild zurück'), onclick: () => { PupEd._edit = null; VN.mutate(() => { p.asset = p.origAsset; delete p.origAsset; }); } }, '↺ ' + VN.t('Original')) : null),
      el('div', { class: 'muted small' }, VN.t('Weiche Kante = sanfter Übergang (gut für Gelenke, an denen zwei Teile überlappen). Wiederherstellen malt das Original zurück. Gespeichert wird als neue Bilddatei – das Original bleibt erhalten.')));
  };

  // Teil samt Kindern gespiegelt kopieren (links ↔ rechts)
  PupEd.mirrorCopy = (pup, p) => VN.mutate(() => {
    const bb = Puppet.bounds(pup);
    const cx = bb.x + bb.w / 2;
    const ids = [p.id, ...Puppet.descendants(pup, p.id)];
    const map = {};
    const flipName = (n) => n.replace(/\b(links|Links|L)\b/, '§R').replace(/\b(rechts|Rechts|R)\b/, '§L').replace('§R', /links/i.test(n) ? 'rechts' : 'R').replace('§L', /rechts/i.test(n) ? 'links' : 'L');
    for (const id of ids) {
      const o = Puppet.part(pup, id);
      const c = JSON.parse(JSON.stringify(o));
      c.id = VN.uid('pp'); map[id] = c.id;
      c.name = flipName(o.name) === o.name ? o.name + ' (gespiegelt)' : flipName(o.name);
      c.flipX = !o.flipX;
      // Pin bleibt am gespiegelten Gelenk
      const pinX = 2 * cx - (o.x + o.ax);
      c.ax = o.w - o.ax; c.x = Math.round(pinX - c.ax); c.rot = -(o.rot || 0);
      pup.parts.push(c);
    }
    for (const id of ids) { const c = Puppet.part(pup, map[id]); const o = Puppet.part(pup, id); c.parent = map[o.parent] || o.parent || null; }
    ui().pupPart = map[p.id];
  });

  PupEd.newAnim = (pup, type) => {
    VN.mutate(() => {
      const a = { id: VN.uid('an'), name: (type === 'idle' ? 'Idle · ' : 'Geste · ') + pup.name, type, dur: type === 'idle' ? 3 : 1.5, loop: type === 'idle', cam: [], audio: [], actors: [{ id: VN.uid('ac'), puppet: pup.id, asset: null, x: 50, y: 0, scale: 100, flip: false, bones: {}, parts: {}, move: [] }] };
      VN.project.anims.push(a);
      ui().animSel = a.id; ui().animActor = a.actors[0].id; ui().animT = 0; ui().animKey = null; ui().view = 'anim';
    });
  };
})();
