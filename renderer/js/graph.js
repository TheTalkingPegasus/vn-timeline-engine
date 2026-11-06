// Pfad-Graph: Szenen als Bubbles mit Verbindungslinien
(function () {
  const { el } = VN;
  const NW = 200, NH = 70;
  const COLORS = { next: '#4fb3c8', choice: '#f0a35e', hub: '#e8c86a', event: '#c58cf0', back: '#7fd09a', battle: '#e0605a', action: '#7fd09a' };
  let zoom = 1;

  const Graph = (window.Graph = {
    render(root) {
      root.innerHTML = '';
      const p = VN.project;
      root.appendChild(el('div', { class: 'view-head' },
        el('strong', { style: { fontSize: '15px' } }, 'Pfade'),
        el('span', { class: 'muted' }, p.scenes.length + ' Szenen'),
        Graph.issueChip(),
        el('div', { class: 'spacer' }),
        VN.chapters().length ? (() => {
          const sl = el('select', { class: 'small-input', title: 'Nur ein Kapitel hervorheben', onchange: (e) => { VN.ui.graphChapter = e.target.value; Graph._fitted = false; VN.render(); } });
          for (const [v, l] of [['', 'Alle Kapitel'], ...VN.chapters().map((c) => [c, '📁 ' + c]), ['__none', 'Ohne Kapitel']]) { const o = el('option', { value: v }, l); if (v === (VN.ui.graphChapter || '')) o.selected = true; sl.appendChild(o); }
          return sl;
        })() : null,
        (() => {
          const inp = el('input', { type: 'search', class: 'small-input', placeholder: 'Suchen …', value: VN.ui.sceneQ || '', style: { width: '150px' } });
          inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { VN.ui.sceneQ = inp.value; const sb = document.getElementById('scene-search'); if (sb) sb.value = inp.value; Graph._fitted = false; VN.render(); } });
          return inp;
        })(),
        el('button', { class: 'btn', onclick: () => Graph.addScene('story') }, '+ Story-Szene'),
        el('button', { class: 'btn', onclick: () => Graph.addScene('hub') }, '+ Hub-Szene'),
        el('button', { class: 'btn', onclick: () => Graph.autoLayout() }, 'Automatisch anordnen'),
        el('button', { class: 'btn', onclick: () => { Graph._fitted = false; VN.render(); } }, 'Alles zeigen')));

      const wrap = el('div', { class: 'graph-wrap' });
      const layer = el('div', { class: 'graph-layer' });
      const applyView = () => { layer.style.transform = `translate(${VN.ui.graphPan.x}px, ${VN.ui.graphPan.y}px) scale(${zoom})`; };
      applyView();
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'graph-svg');
      layer.appendChild(svg);
      const labels = el('div');
      layer.appendChild(labels);

      const reach = VN.reachable();
      const nodeEls = {};
      // Szenen, die nur mit einer Beziehungs-Bedingung erreichbar sind (♥-Schloss)
      const relLocked = new Map();
      if (VN.Life && VN.Life.relOn()) for (const sc of VN.project.scenes) for (const o of (sc.type === 'story' ? sc.tracks.choice.flatMap((c) => c.options) : sc.objects || [])) {
        const rc = (o.conds || []).filter((c) => c.type === 'rel');
        if (o.target && rc.length) relLocked.set(o.target, rc.map(VN.condText).join(', ').replace(/♥ /g, ''));
      }
      Graph._rl = relLocked;
      // Kapitel-Filter und Suche: passende Szenen hervorheben, den Rest abdunkeln
      const chf = VN.ui.graphChapter || '', q = (VN.ui.sceneQ || '').trim().toLowerCase();
      if (chf && chf !== '__none' && !VN.chapters().includes(chf)) VN.ui.graphChapter = '';
      const inFocus = (s) => (!chf || (chf === '__none' ? !s.chapter : s.chapter === chf)) && (!q || VN.sceneMatch(s, q));
      const focus = chf || q ? p.scenes.filter(inFocus) : null;
      for (const s of p.scenes) {
        const n = Graph.nodeEl(s, reach, () => Graph.drawEdges(svg, labels));
        if (focus) n.classList.add(focus.includes(s) ? (q ? 'found' : 'inch') : 'dimmed');
        nodeEls[s.id] = n;
        layer.appendChild(n);
      }
      Graph.drawEdges(svg, labels);
      wrap.appendChild(layer);
      // Beim ersten Öffnen alles ins Bild holen
      if (!Graph._fitted) {
        Graph._fitted = true;
        requestAnimationFrame(() => Graph.fit(wrap, applyView, focus && focus.length ? focus : null));
      }
      wrap.appendChild(el('div', { class: 'graph-legend' },
        el('div', null, el('span', { class: 'ln', style: { background: COLORS.next } }), 'Weiter (Szenenende)'),
        el('div', null, el('span', { class: 'ln', style: { background: COLORS.choice } }), 'Antwort einer Auswahl'),
        el('div', null, el('span', { class: 'ln', style: { background: COLORS.hub } }), 'Objekt im Hub'),
        VN.World && VN.World.on() ? el('div', null, el('span', { class: 'ln', style: { background: COLORS.event } }), 'Ereignis am Ort (gestrichelt grün: zurück)') : null,
        el('div', null, el('span', { class: 'ln', style: { background: 'transparent', border: '1px dashed #9a9ca8', height: '0' } }), 'Gestrichelt: nicht erreichbar')));
      root.appendChild(wrap);

      // Mehrfachauswahl (0.9.19): Rahmen ziehen markiert Szenen, die man dann gemeinsam verschiebt
      Graph._multi = new Set((VN.ui.graphMulti || []).filter((id) => p.scenes.some((x) => x.id === id)));
      const markMulti = () => { for (const id in nodeEls) nodeEls[id].classList.toggle('msel', Graph._multi.has(id)); };
      markMulti();
      const toWorld = (cx, cy) => { const r = wrap.getBoundingClientRect(); return { x: (cx - r.left - VN.ui.graphPan.x) / zoom, y: (cy - r.top - VN.ui.graphPan.y) / zoom }; };
      const pan = (e) => {
        const start = { ...VN.ui.graphPan };
        wrap.classList.add('panning');
        VN.drag(e, (dx, dy) => { VN.ui.graphPan = { x: start.x + dx, y: start.y + dy }; applyView(); },
          (dx, dy, moved) => { wrap.classList.remove('panning'); if (moved) wrap._noMenu = true; });
      };
      // Leertaste gedrückt halten = Ansicht verschieben
      if (!Graph._keys) {
        Graph._keys = true;
        window.addEventListener('keydown', (e) => {
          if (VN.ui.view !== 'graph' || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '') || (e.target && e.target.isContentEditable)) return;
          if (e.code === 'Space') { Graph._space = true; const w = document.querySelector('.graph-wrap'); if (w) w.classList.add('pan-ready'); e.preventDefault(); }
          if (e.key === 'Escape' && Graph._multi && Graph._multi.size) { VN.ui.graphMulti = []; VN.render(); }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); VN.ui.graphMulti = VN.project.scenes.map((x) => x.id); VN.render(); }
        });
        window.addEventListener('keyup', (e) => { if (e.code === 'Space') { Graph._space = false; const w = document.querySelector('.graph-wrap'); if (w) w.classList.remove('pan-ready'); } });
      }
      wrap.addEventListener('mousedown', (e) => {
        if (e.target.closest('.g-node') || e.target.closest('.g-label') || e.target.closest('.graph-legend')) return;
        // Ansicht verschieben: mittlere oder rechte Maustaste, oder Leertaste + Ziehen
        if (e.button === 1 || e.button === 2 || (e.button === 0 && Graph._space)) { e.preventDefault(); return pan(e); }
        if (e.button !== 0) return;
        // Rahmen ziehen; Umschalt/Strg = zur Auswahl hinzufügen
        const add = e.shiftKey || e.ctrlKey || e.metaKey;
        const base = add ? new Set(Graph._multi) : new Set();
        const r0 = wrap.getBoundingClientRect(), x0 = e.clientX - r0.left, y0 = e.clientY - r0.top;
        const box = el('div', { class: 'g-marquee', style: { left: x0 + 'px', top: y0 + 'px', width: '0px', height: '0px' } });
        const w0 = toWorld(e.clientX, e.clientY);
        let shown = false;
        VN.drag(e, (dx, dy, ev) => {
          if (!shown) { wrap.appendChild(box); shown = true; }
          box.style.left = Math.min(x0, x0 + dx) + 'px'; box.style.top = Math.min(y0, y0 + dy) + 'px';
          box.style.width = Math.abs(dx) + 'px'; box.style.height = Math.abs(dy) + 'px';
          const w1 = toWorld(ev.clientX, ev.clientY);
          const ax = Math.min(w0.x, w1.x), bx = Math.max(w0.x, w1.x), ay = Math.min(w0.y, w1.y), by = Math.max(w0.y, w1.y);
          Graph._multi = new Set(base);
          for (const sc of p.scenes) {
            const n = nodeEls[sc.id]; if (!n) continue;
            const nx = sc.x || 0, ny = sc.y || 0, nw = n.offsetWidth || NW, nh = n.offsetHeight || NH;
            if (nx < bx && nx + nw > ax && ny < by && ny + nh > ay) Graph._multi.add(sc.id);
          }
          markMulti();
        }, (dx, dy, moved) => {
          box.remove();
          if (!moved) { if (VN.ui.graphSel || (VN.ui.graphMulti || []).length) { VN.ui.graphSel = null; VN.ui.graphMulti = []; VN.render(); } return; }
          VN.ui.graphMulti = [...Graph._multi];
          if (VN.ui.graphMulti.length === 1) VN.ui.graphSel = VN.ui.graphMulti[0];
          VN.render();
        });
      });
      wrap.appendChild(el('div', { class: 'graph-help muted small' }, VN.t('Rahmen ziehen = markieren · rechte Maustaste ziehen = Ansicht verschieben')));
      wrap.addEventListener('wheel', (e) => {
        e.preventDefault();
        const r = wrap.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        const old = zoom;
        zoom = Math.max(0.35, Math.min(1.8, zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
        VN.ui.graphPan.x = mx - (mx - VN.ui.graphPan.x) * (zoom / old);
        VN.ui.graphPan.y = my - (my - VN.ui.graphPan.y) * (zoom / old);
        applyView();
      }, { passive: false });
      wrap.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.g-node') || e.target.closest('.g-label')) return;
        e.preventDefault();
        if (wrap._noMenu) { wrap._noMenu = false; return; }
        const r = wrap.getBoundingClientRect();
        const x = (e.clientX - r.left - VN.ui.graphPan.x) / zoom, y = (e.clientY - r.top - VN.ui.graphPan.y) / zoom;
        VN.menu(e.clientX, e.clientY, [
          { label: 'Neue Story-Szene hier', action: () => VN.mutate(() => { const s = VN.newStoryScene(null, x, y); VN.ui.graphSel = s.id; }) },
          { label: 'Neue Hub-Szene hier', action: () => VN.mutate(() => { const s = VN.newHubScene(null, x, y); VN.ui.graphSel = s.id; }) }
        ]);
      });
    },

    // Pfad-Prüfung: kaputte Bedingungen (Bezug gelöscht) – gelten im Spiel als nicht erfüllt
    issueChip() {
      const iss = VN.condIssues().concat(VN.World ? VN.World.issues() : []);
      Graph._iss = new Map();
      for (const i of iss) if (i.scene) Graph._iss.set(i.scene.id, (Graph._iss.get(i.scene.id) || []).concat(i));
      if (!iss.length) return null;
      return el('button', { class: 'btn warn-chip', title: 'Bedingungen mit fehlendem Bezug', onclick: () => Graph.issueModal(iss) }, '⚠ ' + iss.length + (iss.length === 1 ? ' Problem' : ' Probleme'));
    },
    issueModal(iss) {
      const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) back.remove(); } });
      back.appendChild(el('div', { class: 'modal', style: { width: '560px', maxHeight: '70vh', overflow: 'auto' } },
        el('strong', null, 'Pfad-Prüfung'),
        el('div', { class: 'muted small' }, 'Kaputte Bedingungen verweisen auf etwas, das es nicht mehr gibt – im Spiel gelten sie als NICHT erfüllt. Dazu Hinweise zu Welt, Orten und Quests.'),
        ...iss.map((i) => el('div', { class: 'issue-row', onclick: i.scene ? () => { back.remove(); App.openScene(i.scene.id); } : null },
          el('b', null, i.scene ? i.scene.name : 'Projekt'), i.where ? el('span', { class: 'muted' }, ' · „' + String(i.where).slice(0, 40) + '“') : null, el('span', { class: 'cond-warn-inline' }, ' – ' + i.text))),
        el('div', { class: 'row gap8', style: { justifyContent: 'flex-end' } }, el('button', { class: 'btn', onclick: () => back.remove() }, 'Schließen'))));
      document.body.appendChild(back);
    },

    fit(wrap, applyView, only) {
      const sc = only || VN.project.scenes;
      if (!sc.length) return;
      const minX = Math.min(...sc.map((s) => s.x || 0)), minY = Math.min(...sc.map((s) => s.y || 0));
      const maxX = Math.max(...sc.map((s) => (s.x || 0) + NW)), maxY = Math.max(...sc.map((s) => (s.y || 0) + NH + 30));
      const w = wrap.clientWidth, h = wrap.clientHeight;
      zoom = Math.max(0.35, Math.min(1.2, Math.min((w - 80) / (maxX - minX), (h - 120) / (maxY - minY))));
      VN.ui.graphPan = { x: (w - (maxX - minX) * zoom) / 2 - minX * zoom, y: (h - (maxY - minY) * zoom) / 2 - minY * zoom - 30 };
      applyView();
    },

    addScene(type) {
      VN.mutate(() => {
        const x = (-VN.ui.graphPan.x + 300) / zoom, y = (-VN.ui.graphPan.y + 200) / zoom;
        const s = type === 'hub' ? VN.newHubScene(null, x, y) : VN.newStoryScene(null, x, y);
        VN.ui.graphSel = s.id;
      });
    },

    nodeEl(s, reach, redraw) {
      const p = VN.project;
      const isStart = p.startScene === s.id;
      const out = VN.edgesOf(s);
      const isEnd = s.type === 'story' && !out.length;
      const meta = s.type === 'hub'
        ? s.objects.length + ' Objekte'
        : s.beats + ' Schritte · ' + s.tracks.dialog.length + ' Dialoge' + (s.tracks.choice.length ? ' · ' + s.tracks.choice.reduce((n, c) => n + c.options.length, 0) + ' Antworten' : '');
      const node = el('div', {
        class: 'g-node' + (s.type === 'hub' ? ' hub' : '') + (VN.ui.graphSel === s.id ? ' sel' : '') + (reach.has(s.id) ? '' : ' unreach'),
        'data-id': s.id,
        style: { left: (s.x || 0) + 'px', top: (s.y || 0) + 'px', borderColor: s.type === 'story' && isEnd ? '#6cc48a' : '' }
      },
        el('div', { class: 'tag' }, s.type === 'hub' ? (s.loc && VN.World && VN.World.on() ? (VN.World.cfg().home === s.id ? '🏠 Zuhause' : '📍 Ort') : 'Hub') : isEnd ? 'Ende' : 'Story',
          isStart ? el('span', { class: 'badge' }, 'START') : null,
          reach.has(s.id) ? null : el('span', { class: 'badge gray' }, 'nicht erreichbar')),
        el('div', { class: 'nm' }, s.name, s.chapter ? el('span', { class: 'g-ch' }, '📁 ' + s.chapter) : null),
        el('div', { class: 'meta' }, meta),
        Graph._iss && Graph._iss.has(s.id) ? el('div', { class: 'g-issue', title: Graph._iss.get(s.id).map((i) => i.text).join('\n') }, '⚠ ' + Graph._iss.get(s.id).length + (Graph._iss.get(s.id).length > 1 ? ' Probleme' : ' Problem')) : null,
        Graph._rl && Graph._rl.has(s.id) ? el('div', { class: 'g-heart', title: 'Nur erreichbar mit genug Beziehung: ' + Graph._rl.get(s.id) }, '♥🔒 ' + Graph._rl.get(s.id)) : null);

      node.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        const multi = Graph._multi || new Set();
        // Umschalt/Strg + Klick = Szene zur Auswahl hinzufügen oder herausnehmen
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          const m = new Set(multi.size ? multi : VN.ui.graphSel ? [VN.ui.graphSel] : []);
          if (m.has(s.id)) m.delete(s.id); else m.add(s.id);
          VN.ui.graphMulti = [...m]; VN.ui.graphSel = s.id; VN.render();
          return;
        }
        // Gehört die Szene zur Mehrfachauswahl, wandern alle markierten mit
        const group = multi.has(s.id) ? p.scenes.filter((x) => multi.has(x.id)) : [s];
        const orig = group.map((x) => [x, x.x || 0, x.y || 0]);
        const els = group.map((x) => document.querySelector('.g-node[data-id="' + x.id + '"]') || (x === s ? node : null));
        VN.drag(e, (dx, dy) => {
          orig.forEach(([x, ox, oy], i) => {
            x.x = Math.max(0, ox + dx / zoom); x.y = Math.max(0, oy + dy / zoom);
            if (els[i]) { els[i].style.left = x.x + 'px'; els[i].style.top = x.y + 'px'; }
          });
          redraw();
        }, (dx, dy, moved) => {
          if (moved) {
            const now = orig.map(([x]) => [x, x.x, x.y]);
            orig.forEach(([x, ox, oy]) => { x.x = ox; x.y = oy; });
            VN.mutate(() => { for (const [x, nx, ny] of now) { x.x = nx; x.y = ny; } VN.ui.graphSel = s.id; if (group.length === 1) VN.ui.graphMulti = []; });
          } else { VN.ui.graphSel = s.id; if (!multi.has(s.id)) VN.ui.graphMulti = []; VN.render(); }
        });
      });
      node.addEventListener('dblclick', () => App.openScene(s.id));
      node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        VN.ui.graphSel = s.id;
        const items = [
          { head: s.name },
          { label: 'Öffnen', action: () => App.openScene(s.id) },
          { label: '▶ Ab hier testen', action: () => Player.start(s.id) },
          'sep',
          { label: 'Neue Story-Szene als Nachfolger', action: () => Graph.addSuccessor(s, 'story') },
          { label: 'Neue Hub-Szene als Nachfolger', action: () => Graph.addSuccessor(s, 'hub') }
        ];
        if (!isStart) items.push({ label: 'Als Startszene festlegen', action: () => VN.mutate(() => { p.startScene = s.id; }) });
        items.push('sep', { label: 'Szene löschen', danger: true, action: () => VN.deleteScene(s.id) });
        VN.render();
        VN.menu(e.clientX, e.clientY, items);
      });
      return node;
    },

    addSuccessor(s, type) {
      VN.mutate(() => {
        const n = type === 'hub' ? VN.newHubScene(null, (s.x || 0) + 280, (s.y || 0)) : VN.newStoryScene(null, (s.x || 0) + 280, (s.y || 0));
        if (s.type === 'story') {
          if (s.next && n.type === 'story') n.next = s.next;
          s.next = n.id;
        } else {
          s.objects.push({ id: VN.uid('o'), name: VN.t('Weg zu ') + n.name, asset: null, x: 40, y: 40, w: 14, h: 14, rot: 0, shape: 'rect', hover: 'glow', target: n.id, message: '', sfx: null });
        }
        VN.ui.graphSel = n.id;
      });
    },

    drawEdges(svg, labels) {
      const p = VN.project;
      svg.innerHTML = '';
      labels.innerHTML = '';
      let maxX = 1000, maxY = 800;
      for (const s of p.scenes) { maxX = Math.max(maxX, (s.x || 0) + NW + 400); maxY = Math.max(maxY, (s.y || 0) + NH + 400); }
      svg.setAttribute('width', maxX);
      svg.setAttribute('height', maxY);
      const NS = 'http://www.w3.org/2000/svg';
      const defs = document.createElementNS(NS, 'defs');
      for (const [k, c] of Object.entries(COLORS)) {
        const m = document.createElementNS(NS, 'marker');
        m.setAttribute('id', 'arr-' + k); m.setAttribute('viewBox', '0 0 10 10'); m.setAttribute('refX', '9'); m.setAttribute('refY', '5');
        m.setAttribute('markerWidth', '7'); m.setAttribute('markerHeight', '7'); m.setAttribute('orient', 'auto-start-reverse');
        const pth = document.createElementNS(NS, 'path');
        pth.setAttribute('d', 'M0 0 L10 5 L0 10 Z'); pth.setAttribute('fill', c);
        m.appendChild(pth); defs.appendChild(m);
      }
      svg.appendChild(defs);

      const pairCount = {};
      for (const s of p.scenes) {
        for (const e of VN.edgesOf(s)) {
          const t = VN.scene(e.to);
          if (!t || t.id === s.id || e.kind === 'world') continue;
          const key = s.id + '>' + t.id;
          const k = pairCount[key] = (pairCount[key] || 0) + 1;
          const x1 = (s.x || 0) + NW, y1 = (s.y || 0) + NH / 2 + (k - 1) * 8;
          const x2 = (t.x || 0), y2 = (t.y || 0) + NH / 2 + (k - 1) * 8;
          const off = Math.max(80, Math.abs(x2 - x1) * 0.45);
          const c1x = x1 + off, c2x = x2 - off;
          const path = document.createElementNS(NS, 'path');
          path.setAttribute('d', `M${x1} ${y1} C${c1x} ${y1} ${c2x} ${y2} ${x2} ${y2}`);
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', COLORS[e.kind]);
          path.setAttribute('stroke-width', '2');
          path.setAttribute('marker-end', `url(#arr-${e.kind})`);
          if (e.kind === 'event' || e.kind === 'back') path.setAttribute('stroke-dasharray', '7 5');
          svg.appendChild(path);
          const lx = 0.125 * x1 + 0.375 * c1x + 0.375 * c2x + 0.125 * x2;
          const ly = 0.5 * y1 + 0.5 * y2 + (k - 1) * 22;
          const lab = el('div', { class: 'g-label', style: { left: lx + 'px', top: ly + 'px', borderColor: COLORS[e.kind] }, title: e.label }, e.label);
          lab.addEventListener('contextmenu', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const items = [{ head: s.name + ' → ' + t.name }];
            if (e.kind === 'choice' && e.index < 0) {
              items.push({ label: 'Verbindung entfernen', danger: true, action: () => VN.mutate(() => { delete e.clip.allDone; }) });
            } else if (e.kind === 'choice') {
              items.push({ label: 'Alternativer Pfad: neue Szene', hint: '„' + e.label + '“', action: () => VN.mutate(() => { const n = VN.createAltScene(s, e.label); e.clip.options[e.index].target = n.id; VN.ui.graphSel = n.id; }) });
              items.push({ label: 'Verbindung entfernen', danger: true, action: () => VN.mutate(() => { e.clip.options[e.index].target = null; }) });
            } else if (e.kind === 'next') {
              items.push({ label: 'Szene dazwischen einfügen', action: () => VN.mutate(() => { const n = VN.newStoryScene(null, ((s.x || 0) + (t.x || 0)) / 2, ((s.y || 0) + (t.y || 0)) / 2 + 90); n.next = t.id; s.next = n.id; VN.ui.graphSel = n.id; }) });
              items.push({ label: 'Verbindung entfernen', danger: true, action: () => VN.mutate(() => { s.next = null; }) });
            } else if (e.obj) {
              items.push({ label: 'Verbindung entfernen', danger: true, action: () => VN.mutate(() => { e.obj.target = null; }) });
            }
            VN.menu(ev.clientX, ev.clientY, items);
          });
          labels.appendChild(lab);
        }
      }
    },

    autoLayout() {
      const p = VN.project;
      const start = VN.scene(p.startScene) ? p.startScene : (p.scenes[0] && p.scenes[0].id);
      const level = {};
      const q = start ? [[start, 0]] : [];
      while (q.length) {
        const [id, l] = q.shift();
        if (level[id] !== undefined) continue;
        level[id] = l;
        const s = VN.scene(id);
        for (const e of VN.edgesOf(s)) if (level[e.to] === undefined) q.push([e.to, l + 1]);
      }
      const maxL = Math.max(0, ...Object.values(level));
      const cols = {};
      VN.mutate(() => {
        for (const s of p.scenes) {
          const l = level[s.id] !== undefined ? level[s.id] : maxL + 1;
          cols[l] = (cols[l] || 0) + 1;
          s.x = 40 + l * 290;
          s.y = 40 + (cols[l] - 1) * 140;
        }
      });
      Graph._fitted = false;
      VN.render();
    }
  });
})();
