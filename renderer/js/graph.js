// Pfad-Graph: Szenen als Bubbles mit Verbindungslinien
(function () {
  const { el } = VN;
  const NW = 200, NH = 70;
  const COLORS = { next: '#4fb3c8', choice: '#f0a35e', hub: '#e8c86a', event: '#c58cf0', back: '#7fd09a', battle: '#e0605a' };
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

      // Verschieben der Ansicht
      wrap.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || e.target.closest('.g-node') || e.target.closest('.g-label')) return;
        const start = { ...VN.ui.graphPan };
        wrap.classList.add('panning');
        VN.drag(e, (dx, dy) => { VN.ui.graphPan = { x: start.x + dx, y: start.y + dy }; applyView(); },
          (dx, dy, moved) => { wrap.classList.remove('panning'); if (!moved && VN.ui.graphSel) { VN.ui.graphSel = null; VN.render(); } });
      });
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
        const ox = s.x || 0, oy = s.y || 0;
        VN.drag(e, (dx, dy) => {
          s.x = Math.max(0, ox + dx / zoom); s.y = Math.max(0, oy + dy / zoom);
          node.style.left = s.x + 'px'; node.style.top = s.y + 'px';
          redraw();
        }, (dx, dy, moved) => {
          if (moved) {
            const nx = s.x, ny = s.y;
            s.x = ox; s.y = oy;
            VN.mutate(() => { s.x = nx; s.y = ny; VN.ui.graphSel = s.id; });
          } else { VN.ui.graphSel = s.id; VN.render(); }
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
            if (e.kind === 'choice') {
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
