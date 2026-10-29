// Hub-Editor: klickbare Objekte frei platzieren, Hitbox wandert mit
(function () {
  const { el } = VN;

  const Hub = (window.Hub = {
    _ro: null,

    addObject(s, assetId, x, y, ratio) {
      const w = 16;
      const h = ratio ? Math.min(80, w * ratio * (16 / 9)) : 16;
      const a = VN.asset(assetId);
      const o = {
        id: VN.uid('o'), name: a ? a.name : 'Objekt', asset: assetId || null,
        x: Math.max(0, Math.min(100 - w, (x != null ? x : 50) - w / 2)), y: Math.max(0, Math.min(100 - h, (y != null ? y : 50) - h / 2)),
        w, h, rot: 0, shape: 'rect', hover: 'glow', target: null, message: '', sfx: null, conds: [], actions: [], styles: {}
      };
      VN.mutate(() => { s.objects.push(o); VN.ui.sel = o.id; });
    },

    duplicate(s, o) {
      VN.mutate(() => {
        const c = JSON.parse(JSON.stringify(o));
        c.id = VN.uid('o');
        c.x = Math.min(95, o.x + 3);
        c.y = Math.min(95, o.y + 3);
        s.objects.push(c);
        VN.ui.sel = c.id;
      });
    },

    render(root) {
      const s = VN.curScene();
      if (Hub._ro) Hub._ro.disconnect();
      root.innerHTML = '';
      root.appendChild(el('div', { class: 'view-head' },
        el('input', { class: 'name-input', value: s.name, 'aria-label': 'Szenenname', onchange: (e) => VN.mutate(() => { s.name = e.target.value || 'Hub'; }) }),
        el('span', { class: 'muted' }, s.objects.length + ' Objekte'),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn', onclick: () => Hub.addObject(s, null) }, '+ Objekt'),
        el('label', { class: 'check btn' },
          el('input', { type: 'checkbox', checked: VN.ui.showHitboxes, onchange: (e) => { VN.ui.showHitboxes = e.target.checked; VN.render(); } }),
          'Hitboxen anzeigen'),
        el('button', { class: 'btn', onclick: () => Player.start(s.id) }, '▶ Hub testen')));

      const wrap = el('div', { class: 'stage-wrap' });
      const stage = el('div', { class: 'stage' });
      wrap.appendChild(stage);
      root.appendChild(wrap);
      root.appendChild(el('div', { class: 'muted small', style: { padding: '0 14px 12px', textAlign: 'center' } },
        'Bilder aus der Dateiliste auf die Bühne ziehen legt Objekte an. Ziehen = verschieben · weiße Ecke = skalieren (Umschalt: frei) · Kreis oben = drehen (Umschalt: 15°-Schritte)'));
      Hub._ro = Stage.fit(wrap, stage);

      if (s.bg && VN.assetUrl(s.bg)) {
        const img = el('img', { class: 'bg-img', src: VN.assetUrl(s.bg), draggable: 'false' });
        VN.applyBgLook(img, s.bgLook);
        stage.appendChild(img);
        if (s.bgLook && s.bgLook.vignette) stage.appendChild(VN.vignetteEl(s.bgLook));
      }
      else stage.appendChild(el('div', { class: 'placeholder', style: { inset: '6%', textAlign: 'center' } }, 'Kein Hintergrund – rechts einen wählen'));

      for (const o of s.objects) stage.appendChild(Hub.objEl(s, o, stage));

      stage.addEventListener('mousedown', (e) => {
        if (e.target === stage || e.target.classList.contains('bg-img') || e.target.classList.contains('placeholder')) {
          if (VN.ui.sel) { VN.ui.sel = null; VN.render(); }
        }
      });
      stage.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.hub-obj')) return;
        e.preventDefault();
        VN.menu(e.clientX, e.clientY, [
          { head: 'Hintergrund · ' + s.name },
          { label: '🎨 Design ändern …', hint: 'Hintergrund', action: () => { VN.ui.sel = null; Design.openTab(); } },
          { label: 'Projekt-Design öffnen', action: () => Design.open('sys') }
        ]);
      });
      stage.addEventListener('dragover', (e) => {
        const types = Array.from(e.dataTransfer.types);
        if (types.includes('vn/asset-image') || types.includes('Files')) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; }
      });
      stage.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('drag-overlay').hidden = true;
        const r = stage.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 100;
        let id = e.dataTransfer.getData('vn/asset-image');
        if (!id) {
          const added = await VN.importPaths(VN.filePaths(e.dataTransfer));
          const img = added.find((a) => a.kind === 'image');
          if (!img) return;
          id = img.id;
        }
        const im = new Image();
        im.onload = () => Hub.addObject(s, id, x, y, im.naturalHeight / im.naturalWidth);
        im.onerror = () => Hub.addObject(s, id, x, y, 1);
        im.src = VN.assetUrl(id);
      });
    },

    objEl(s, o, stage) {
      const sel = VN.ui.sel === o.id;
      const node = el('div', { class: 'hub-obj' + (sel ? ' sel' : '') });
      const place = () => {
        node.style.left = o.x + '%';
        node.style.top = o.y + '%';
        node.style.width = o.w + '%';
        node.style.height = o.h + '%';
        node.style.transform = 'rotate(' + (o.rot || 0) + 'deg)';
      };
      place();
      const url = VN.assetUrl(o.asset);
      const look = url ? el('img', { src: url, draggable: 'false' }) : el('div', { class: 'ph' }, o.name || 'Objekt');
      VN.applyLook(look, o);
      node.appendChild(look);
      if (o.conds && o.conds.length) node.appendChild(el('div', { class: 'cond-badge', title: o.conds.map(VN.condText).join(' und ') }, 'Bedingung'));
      if (VN.ui.showHitboxes) {
        const t = VN.scene(o.target);
        node.appendChild(el('div', { class: 'hit' + (o.shape === 'ellipse' ? ' ellipse' : '') }));
        node.appendChild(el('div', { class: 'hit-label' }, (o.name || 'Objekt') + (t ? ' → ' + t.name : o.message ? ' → Meldung' : '')));
      }
      if (sel) {
        node.appendChild(el('div', { class: 'h-rs', title: 'Skalieren' }));
        node.appendChild(el('div', { class: 'h-rot', title: 'Drehen' }));
      }

      node.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const r = stage.getBoundingClientRect();
        const orig = { x: o.x, y: o.y, w: o.w, h: o.h, rot: o.rot || 0 };
        const mode = e.target.classList.contains('h-rs') ? 'resize' : e.target.classList.contains('h-rot') ? 'rotate' : 'move';
        const nb = node.getBoundingClientRect();
        const cx = nb.left + nb.width / 2, cy = nb.top + nb.height / 2;
        const ratio = orig.h / orig.w;
        if (!sel) { VN.ui.sel = o.id; }
        VN.drag(e, (dx, dy, ev) => {
          const px = dx / r.width * 100, py = dy / r.height * 100;
          if (mode === 'move') { o.x = orig.x + px; o.y = orig.y + py; }
          else if (mode === 'resize') {
            o.w = Math.max(2, orig.w + px);
            o.h = ev.shiftKey ? Math.max(2, orig.h + py) : Math.max(2, o.w * ratio);
          } else {
            let a = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI + 90;
            if (a > 180) a -= 360;
            if (ev.shiftKey) a = Math.round(a / 15) * 15;
            o.rot = Math.round(a);
          }
          place();
        }, (dx, dy, moved) => {
          if (moved) {
            const now = { x: o.x, y: o.y, w: o.w, h: o.h, rot: o.rot };
            Object.assign(o, orig);
            VN.mutate(() => { Object.assign(o, now); VN.ui.sel = o.id; });
          } else VN.render();
        });
      });

      node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        VN.ui.sel = o.id;
        VN.render();
        VN.menu(e.clientX, e.clientY, [
          { head: o.name || 'Objekt' },
          { label: '🎨 Design ändern …', hint: 'Bild, Maus darüber', action: () => Design.openTab() },
          'sep',
          { label: 'Neue Szene als Ziel anlegen', action: () => VN.mutate(() => { const n = VN.createAltScene(s, o.name); o.target = n.id; }) },
          { label: 'Duplizieren', action: () => Hub.duplicate(s, o) },
          { label: 'Löschen', hint: 'Entf', danger: true, action: () => VN.mutate(() => { s.objects = s.objects.filter((x) => x !== o); VN.ui.sel = null; }) }
        ]);
      });
      return node;
    }
  });
})();
