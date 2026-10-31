// Storyboard (0.7.4): freie Fläche zum Planen der Geschichte – Bilder und Notizen per Drag and Drop,
// Überschriften, Pfeile zwischen Karten, Verknüpfung mit Szenen. Liegt im Projekt (project.json → storyboard),
// damit ein Team über den gemeinsamen Projektordner dieselbe Übersicht hat. Hat keinen Einfluss auf das Spiel.
(function () {
  const { el } = VN;
  const SB = (window.Storyboard = {});
  const COLORS = ['#ffe28a', '#ffb3c7', '#a8e6b8', '#a9d4ff', '#d4bfff', '#ffcf9e', '#e6e6ea'];
  const SNAP = 10;

  SB.cfg = () => {
    const p = VN.project;
    p.storyboard = Object.assign({ items: [] }, p.storyboard || {});
    if (!Array.isArray(p.storyboard.items)) p.storyboard.items = [];
    return p.storyboard;
  };
  const view = () => (VN.ui.sb = VN.ui.sb || { x: 40, y: 40, z: 1 });
  SB.item = (id) => SB.cfg().items.find((x) => x.id === id) || null;
  const topZ = () => SB.cfg().items.reduce((m, x) => Math.max(m, x.z || 0), 0) + 1;
  const snap = (v) => Math.round(v / SNAP) * SNAP;
  const who = () => { try { return localStorage.getItem('vn-sb-author') || ''; } catch (e) { return ''; } };

  SB.add = (kind, x, y, extra) => {
    const base = { id: VN.uid('sb'), kind, x: snap(x), y: snap(y), z: topZ(), links: [] };
    let it;
    if (kind === 'note') it = Object.assign(base, { w: 200, h: 140, text: '', color: COLORS[0], by: who() });
    else if (kind === 'title') it = Object.assign(base, { w: 360, h: 56, text: VN.t('Kapitel 1'), color: '#e6e6ea' });
    else it = Object.assign(base, { w: 240, h: 160, asset: null, text: '' });
    Object.assign(it, extra || {});
    VN.mutate(() => { SB.cfg().items.push(it); VN.ui.sbSel = it.id; if (kind !== 'image') VN.ui.sbEdit = it.id; });
    return it;
  };
  SB.remove = (id) => VN.mutate(() => {
    const c = SB.cfg();
    c.items = c.items.filter((x) => x.id !== id);
    for (const x of c.items) if (x.links) x.links = x.links.filter((l) => l !== id);
    if (VN.ui.sbSel === id) VN.ui.sbSel = null;
  });
  SB.duplicate = (it) => VN.mutate(() => { const c = JSON.parse(JSON.stringify(it)); c.id = VN.uid('sb'); c.x += 30; c.y += 30; c.z = topZ(); c.links = []; SB.cfg().items.push(c); VN.ui.sbSel = c.id; });

  // Bild hinzufügen: Seitenverhältnis des Bildes übernehmen
  SB.addImage = (assetId, x, y) => {
    const im = new Image();
    const go = (ratio) => SB.add('image', x, y, { asset: assetId, w: 240, h: Math.round(Math.max(60, Math.min(480, 240 * ratio)) / SNAP) * SNAP });
    im.onload = () => go(im.naturalHeight / Math.max(1, im.naturalWidth));
    im.onerror = () => go(0.66);
    im.src = VN.assetUrl(assetId);
  };

  // Bildschirm- in Brett-Koordinaten
  const toBoard = (board, cx, cy) => { const r = board.getBoundingClientRect(), v = view(); return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z }; };

  SB.render = (root) => {
    const c = SB.cfg();
    const v = view();
    root.innerHTML = '';
    const zoomTo = (z, cx, cy) => {
      const r = board.getBoundingClientRect();
      const px = cx != null ? cx - r.left : r.width / 2, py = cy != null ? cy - r.top : r.height / 2;
      const nz = Math.max(0.2, Math.min(2.5, z));
      v.x = px - (px - v.x) * nz / v.z; v.y = py - (py - v.y) * nz / v.z; v.z = nz;
      applyView();
    };
    const fitAll = () => {
      if (!c.items.length) { v.x = 40; v.y = 40; v.z = 1; applyView(); return; }
      const r = board.getBoundingClientRect();
      const minX = Math.min(...c.items.map((i) => i.x)), minY = Math.min(...c.items.map((i) => i.y));
      const maxX = Math.max(...c.items.map((i) => i.x + i.w)), maxY = Math.max(...c.items.map((i) => i.y + i.h));
      const z = Math.max(0.2, Math.min(1.4, Math.min((r.width - 80) / Math.max(1, maxX - minX), (r.height - 80) / Math.max(1, maxY - minY))));
      v.z = z; v.x = 40 - minX * z + (r.width - 80 - (maxX - minX) * z) / 2; v.y = 40 - minY * z + (r.height - 80 - (maxY - minY) * z) / 2;
      applyView();
    };
    const center = () => { const r = board.getBoundingClientRect(); return toBoard(board, r.left + r.width / 2 - 100, r.top + r.height / 2 - 70); };
    const zl = el('span', { class: 'sb-zoom muted small' });
    root.appendChild(el('div', { class: 'view-head' },
      el('strong', null, 'Storyboard'),
      el('span', { class: 'muted small' }, VN.tf('{n} Karten', { n: c.items.length })),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn', onclick: () => { const p = center(); SB.add('note', p.x, p.y); } }, '+ Notiz'),
      el('button', { class: 'btn', onclick: () => { const p = center(); SB.add('title', p.x, p.y); } }, '+ Überschrift'),
      el('button', { class: 'btn', title: VN.t('Bild aus der Dateiliste wählen – oder einfach von links hierher ziehen'), onclick: (e) => {
        const imgs = VN.assetsOf('image');
        if (!imgs.length) { VN.toast(VN.t('Noch keine Bilder – zuerst links importieren oder Bilddateien hierher ziehen.')); return; }
        const r = e.target.getBoundingClientRect();
        VN.menu(r.left, r.bottom + 4, [{ head: VN.t('Bild einfügen') }, ...imgs.slice(0, 40).map((a) => ({ label: a.name, action: () => { const p = center(); SB.addImage(a.id, p.x, p.y); } }))]);
      } }, '+ Bild'),
      el('div', { class: 'row gap4' },
        el('button', { class: 'btn tiny', onclick: () => zoomTo(v.z / 1.2) }, '−'), zl,
        el('button', { class: 'btn tiny', onclick: () => zoomTo(v.z * 1.2) }, '+'),
        el('button', { class: 'btn tiny', onclick: fitAll }, VN.t('Alles zeigen')))));

    const board = el('div', { class: 'sb-board', tabindex: '0' });
    const layer = el('div', { class: 'sb-layer' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'sb-links');
    layer.appendChild(svg);
    board.appendChild(layer);
    root.appendChild(board);
    if (!c.items.length) board.appendChild(el('div', { class: 'sb-empty' },
      el('div', { style: { fontSize: '34px' } }, '🗂'),
      el('strong', null, 'Leeres Storyboard'),
      el('div', null, 'Ziehe Bilder aus der Dateiliste links hierher, Doppelklick legt eine Notiz an.'),
      el('div', { class: 'muted small' }, 'Für die Planung: Szenen skizzieren, Ideen sammeln, Reihenfolge festlegen. Das Storyboard wird im Projekt gespeichert – wer den Projektordner teilt, sieht dieselbe Übersicht. Im fertigen Spiel ist es nicht enthalten.')));
    root.appendChild(el('div', { class: 'muted small sb-help' }, 'Ziehen = verschieben · Ecke = Größe · Doppelklick = Text bearbeiten · Rechtsklick = Farbe, Pfeil, Szene · leere Fläche ziehen = Ansicht verschieben · Strg + Mausrad = Zoom · Entf = löschen'));

    function applyView() {
      layer.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`;
      board.style.backgroundPosition = `${v.x}px ${v.y}px`;
      board.style.backgroundSize = `${24 * v.z}px ${24 * v.z}px`;
      zl.textContent = Math.round(v.z * 100) + ' %';
    }
    applyView();

    // Karten
    const nodes = new Map();
    const drawLinks = () => {
      svg.innerHTML = '<defs><marker id="sb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#c9cbd6"/></marker></defs>';
      for (const a of c.items) for (const bid of a.links || []) {
        const b = SB.item(bid);
        if (!b) continue;
        const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
        // am Rand der Zielkarte enden
        const dx = bx - ax, dy = by - ay;
        const t = Math.min(Math.abs((b.w / 2 + 6) / (dx || 1e-6)), Math.abs((b.h / 2 + 6) / (dy || 1e-6)), 1);
        const s0 = Math.min(Math.abs((a.w / 2) / (dx || 1e-6)), Math.abs((a.h / 2) / (dy || 1e-6)), 1);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', ax + dx * s0); line.setAttribute('y1', ay + dy * s0);
        line.setAttribute('x2', bx - dx * t); line.setAttribute('y2', by - dy * t);
        line.setAttribute('marker-end', 'url(#sb-arrow)');
        svg.appendChild(line);
      }
    };
    const place = (n, it) => { n.style.left = it.x + 'px'; n.style.top = it.y + 'px'; n.style.width = it.w + 'px'; n.style.height = it.h + 'px'; n.style.zIndex = String(it.z || 1); };

    for (const it of [...c.items].sort((a, b) => (a.z || 0) - (b.z || 0))) {
      const sel = VN.ui.sbSel === it.id;
      const n = el('div', { class: 'sb-item sb-' + it.kind + (sel ? ' sel' : ''), 'data-id': it.id, 'data-notr': '' });
      if (it.kind === 'note') n.style.background = it.color || COLORS[0];
      if (it.kind === 'title') n.style.color = it.color || '#e6e6ea';
      place(n, it);
      if (it.kind === 'image') {
        const url = it.asset && VN.assetUrl(it.asset);
        n.appendChild(url ? el('div', { class: 'sb-img', style: { backgroundImage: `url("${url}")` } }) : el('div', { class: 'sb-img ph' }, VN.t('Bild fehlt')));
        if (it.text) n.appendChild(el('div', { class: 'sb-cap' }, it.text));
      } else if (VN.ui.sbEdit === it.id) {
        const ta = el('textarea', { class: 'sb-edit', placeholder: it.kind === 'title' ? VN.t('Überschrift') : VN.t('Notiz …'), onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || it.kind === 'title'))) { e.preventDefault(); ta.blur(); } }, onmousedown: (e) => e.stopPropagation() }, it.text || '');
        ta.addEventListener('blur', () => { const val = ta.value; VN.ui.sbEdit = null; if (val !== (it.text || '')) VN.mutate(() => { it.text = val; }); else VN.render(); });
        n.appendChild(ta);
        setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 0);
      } else {
        n.appendChild(el('div', { class: 'sb-text' }, it.text || (it.kind === 'note' ? el('span', { class: 'sb-ph' }, VN.t('Doppelklick zum Schreiben')) : '')));
      }
      const sc = it.scene && VN.scene(it.scene);
      if (sc || (it.kind === 'note' && it.by)) n.appendChild(el('div', { class: 'sb-foot' },
        it.kind === 'note' && it.by ? el('span', { class: 'sb-by' }, '✎ ' + it.by) : el('span'),
        sc ? el('button', { class: 'sb-scene', title: VN.t('Szene öffnen'), onmousedown: (e) => e.stopPropagation(), onclick: (e) => { e.stopPropagation(); App.openScene(sc.id); } }, (sc.type === 'hub' ? '⌂ ' : '▶ ') + sc.name) : null));
      n.appendChild(el('div', { class: 'sb-rs', title: VN.t('Ziehen = Größe ändern') }));
      nodes.set(it.id, n);
      layer.appendChild(n);

      n.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        board.focus({ preventScroll: true });
        // Pfeil-Modus: Ziel anklicken
        if (VN.ui.sbLink && VN.ui.sbLink !== it.id) {
          const from = SB.item(VN.ui.sbLink);
          VN.ui.sbLink = null;
          if (from) VN.mutate(() => { from.links = from.links || []; if (!from.links.includes(it.id)) from.links.push(it.id); });
          return;
        }
        const resizing = e.target.classList.contains('sb-rs');
        const o = { x: it.x, y: it.y, w: it.w, h: it.h };
        let nv = Object.assign({}, o);
        if (!sel) { n.classList.add('sel'); for (const [id, m] of nodes) if (id !== it.id) m.classList.remove('sel'); }
        VN.drag(e, (dx, dy, ev) => {
          const kx = dx / v.z, ky = dy / v.z;
          const free = ev && ev.altKey;
          if (resizing) {
            nv.w = Math.max(60, free ? o.w + kx : snap(o.w + kx));
            nv.h = Math.max(30, free ? o.h + ky : snap(o.h + ky));
            if (it.kind === 'image' && ev && ev.shiftKey) nv.h = Math.round(nv.w * o.h / o.w);
          } else { nv.x = free ? o.x + kx : snap(o.x + kx); nv.y = free ? o.y + ky : snap(o.y + ky); }
          Object.assign(it, nv); place(n, it); drawLinks();
          Object.assign(it, o); // erst beim Loslassen wirklich ändern (für Rückgängig)
        }, (dx, dy, moved) => {
          if (moved) VN.mutate(() => { Object.assign(it, nv); it.z = it.z === topZ() - 1 ? it.z : topZ(); VN.ui.sbSel = it.id; });
          else if (VN.ui.sbSel !== it.id) { VN.ui.sbSel = it.id; VN.render(); }
        });
      });
      n.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (it.kind === 'image') { if (sc) App.openScene(sc.id); return; }
        VN.ui.sbEdit = it.id; VN.ui.sbSel = it.id; VN.render();
      });
      n.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        VN.ui.sbSel = it.id;
        const items = [{ head: it.kind === 'note' ? VN.t('Notiz') : it.kind === 'title' ? VN.t('Überschrift') : VN.t('Bild') }];
        if (it.kind !== 'image') items.push({ label: '✎ ' + VN.t('Text bearbeiten'), action: () => { VN.ui.sbEdit = it.id; VN.render(); } });
        if (it.kind !== 'image') items.push({ label: '🎨 ' + VN.t('Farbe'), hint: '…', action: () => colorMenu(e.clientX, e.clientY, it) });
        items.push({ label: '➜ ' + VN.t('Pfeil zu …'), hint: VN.t('danach Ziel anklicken'), action: () => { VN.ui.sbLink = it.id; VN.toast(VN.t('Jetzt die Zielkarte anklicken (Esc = abbrechen)')); } });
        if ((it.links || []).length) items.push({ label: VN.t('Pfeile von hier entfernen'), action: () => VN.mutate(() => { it.links = []; }) });
        items.push('sep');
        items.push({ label: '🔗 ' + VN.t('Mit Szene verknüpfen …'), action: () => sceneMenu(e.clientX, e.clientY, it) });
        if (sc) items.push({ label: '▶ ' + VN.t('Szene öffnen') + ': ' + sc.name, action: () => App.openScene(sc.id) });
        items.push('sep');
        items.push({ label: VN.t('Nach vorne'), action: () => VN.mutate(() => { it.z = topZ(); }) });
        items.push({ label: VN.t('Duplizieren'), action: () => SB.duplicate(it) });
        items.push({ label: VN.t('Löschen'), hint: 'Entf', danger: true, action: () => SB.remove(it.id) });
        VN.render();
        VN.menu(e.clientX, e.clientY, items);
      });
    }
    drawLinks();
    if (VN.ui.sbLink) board.classList.add('linking');

    const colorMenu = (x, y, it) => VN.menu(x, y, [{ head: VN.t('Farbe') }, ...COLORS.map((col) => ({ label: '■ ' + col, action: () => VN.mutate(() => { it.color = col; }) }))]);
    const sceneMenu = (x, y, it) => VN.menu(x, y, [{ head: VN.t('Mit Szene verknüpfen') }, { label: VN.t('— keine —'), action: () => VN.mutate(() => { delete it.scene; }) },
      ...VN.project.scenes.map((s) => ({ label: (s.type === 'hub' ? '⌂ ' : '') + s.name, action: () => VN.mutate(() => { it.scene = s.id; }) }))]);

    // Ansicht verschieben (leere Fläche ziehen oder mittlere Maustaste)
    board.addEventListener('mousedown', (e) => {
      if (e.target.closest('.sb-item')) return;
      board.focus({ preventScroll: true });
      if (VN.ui.sbLink) { VN.ui.sbLink = null; board.classList.remove('linking'); }
      const o = { x: v.x, y: v.y };
      let moved = false;
      VN.drag(e, (dx, dy) => { moved = true; v.x = o.x + dx; v.y = o.y + dy; applyView(); }, () => { if (!moved && VN.ui.sbSel) { VN.ui.sbSel = null; VN.render(); } });
    });
    board.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) zoomTo(v.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX, e.clientY);
      else { v.x -= e.shiftKey ? e.deltaY : e.deltaX; v.y -= e.shiftKey ? 0 : e.deltaY; applyView(); }
    }, { passive: false });
    board.addEventListener('dblclick', (e) => {
      if (e.target.closest('.sb-item')) return;
      const p = toBoard(board, e.clientX, e.clientY);
      SB.add('note', p.x - 100, p.y - 20);
    });
    board.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.sb-item')) return;
      e.preventDefault();
      const p = toBoard(board, e.clientX, e.clientY);
      VN.menu(e.clientX, e.clientY, [{ head: 'Storyboard' },
        { label: '+ ' + VN.t('Notiz'), action: () => SB.add('note', p.x, p.y) },
        { label: '+ ' + VN.t('Überschrift'), action: () => SB.add('title', p.x, p.y) },
        { label: VN.t('Alles zeigen'), action: fitAll }]);
    });
    board.addEventListener('keydown', (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && VN.ui.sbSel) { e.preventDefault(); e.stopPropagation(); SB.remove(VN.ui.sbSel); }
      if (e.key === 'Escape') { VN.ui.sbLink = null; VN.ui.sbSel = null; VN.render(); }
      if (e.key === 'Enter' && VN.ui.sbSel) { const it = SB.item(VN.ui.sbSel); if (it && it.kind !== 'image') { e.preventDefault(); VN.ui.sbEdit = it.id; VN.render(); } }
    });
    // Bilder aus der Dateiliste oder vom Computer
    board.addEventListener('dragover', (e) => {
      const types = Array.from(e.dataTransfer.types);
      if (types.includes('vn/asset-image') || types.includes('Files')) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; board.classList.add('over'); }
    });
    board.addEventListener('dragleave', () => board.classList.remove('over'));
    board.addEventListener('drop', async (e) => {
      e.preventDefault(); e.stopPropagation();
      board.classList.remove('over');
      const ov = document.getElementById('drag-overlay'); if (ov) ov.hidden = true;
      const p = toBoard(board, e.clientX, e.clientY);
      const id = e.dataTransfer.getData('vn/asset-image');
      if (id) { SB.addImage(id, p.x - 120, p.y - 80); return; }
      const added = await VN.importPaths(VN.filePaths(e.dataTransfer));
      added.filter((a) => a.kind === 'image').forEach((a, i) => SB.addImage(a.id, p.x - 120 + i * 30, p.y - 80 + i * 30));
    });
    if (VN.ui.sbFit) { VN.ui.sbFit = false; requestAnimationFrame(fitAll); }
  };

  // Rechte Seite: gewählte Karte oder kurze Erklärung
  SB.inspector = () => {
    const it = VN.ui.sbSel && SB.item(VN.ui.sbSel);
    const box = el('div', { class: 'insp' });
    const field = (label, ...kids) => el('div', { class: 'field' }, el('div', { class: 'lbl' }, label), ...kids);
    if (!it) {
      box.append(el('h3', null, 'Storyboard'),
        el('div', { class: 'hint-box' }, 'Eine freie Fläche zum Planen – für dich allein oder fürs Team. Bilder aus der Dateiliste hierher ziehen, Notizen per Doppelklick, Überschriften für Kapitel, Pfeile für die Reihenfolge. Karten lassen sich mit Szenen verknüpfen, dann öffnet ein Klick die Szene.'),
        field('Dein Name (steht auf neuen Notizen)', el('input', { type: 'text', value: who(), placeholder: VN.t('z. B. Pegasus'), onchange: (e) => { try { localStorage.setItem('vn-sb-author', e.target.value.trim()); } catch (x) { /* egal */ } } })),
        el('div', { class: 'muted small' }, 'Teamarbeit: Das Storyboard steht in der project.json. Liegt der Projektordner in einem geteilten Ordner (z. B. OneDrive, Dropbox, Google Drive), sehen alle dieselben Karten. Bitte nicht gleichzeitig im selben Projekt arbeiten – wer zuletzt speichert, gewinnt.'));
      return box;
    }
    const kindName = it.kind === 'note' ? 'Notiz' : it.kind === 'title' ? 'Überschrift' : 'Bild';
    box.append(el('h3', null, kindName));
    if (it.kind === 'image') {
      box.append(field('Bild', VN.assetSelect('image', it.asset, (v) => VN.mutate(() => { it.asset = v; }))),
        field('Bildunterschrift', el('input', { type: 'text', value: it.text || '', onchange: (e) => VN.mutate(() => { it.text = e.target.value; }) })));
    } else {
      box.append(field('Text', el('textarea', { rows: it.kind === 'title' ? 2 : 6, onchange: (e) => VN.mutate(() => { it.text = e.target.value; }) }, it.text || '')),
        field('Farbe', el('div', { class: 'row gap4', style: { flexWrap: 'wrap' } }, ...COLORS.map((col) => el('button', { class: 'sb-swatch' + (it.color === col ? ' on' : ''), style: { background: col }, title: col, onclick: () => VN.mutate(() => { it.color = col; }) })))));
      if (it.kind === 'note') box.append(field('Von', el('input', { type: 'text', value: it.by || '', onchange: (e) => VN.mutate(() => { it.by = e.target.value; }) })));
    }
    box.append(field('Verknüpfte Szene', VN.sceneSelect(it.scene, (v) => VN.mutate(() => { if (v) it.scene = v; else delete it.scene; }), { emptyLabel: '— keine —' })),
      el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
        el('button', { class: 'btn tiny', onclick: () => { VN.ui.sbLink = it.id; VN.render(); VN.toast(VN.t('Jetzt die Zielkarte anklicken (Esc = abbrechen)')); } }, '➜ Pfeil zu …'),
        el('button', { class: 'btn tiny', onclick: () => SB.duplicate(it) }, 'Duplizieren'),
        el('button', { class: 'btn tiny danger', onclick: () => SB.remove(it.id) }, 'Löschen')));
    return box;
  };
})();
