// Bereich „Figuren“: Bones & Blinzeln, Ebenen-Figuren (Ausdrücke, Outfits), Lippensync (Mund markieren)
(function () {
  const { el } = VN;
  const SUBS = [['bones', 'Bones & Blinzeln'], ['layers', 'Ebenen & Outfits'], ['mouth', 'Lippensync']];

  const Figures = (window.Figures = {
    render(center) {
      const sub = VN.ui.figSub || 'bones';
      if (Figures._ro) { Figures._ro.disconnect(); Figures._ro = null; }
      if (sub === 'bones') Bones.render(center);
      else if (sub === 'layers') Figures.renderLayers(center);
      else Figures.renderMouth(center);
      const seg = el('div', { class: 'seg fig-seg' }, ...SUBS.map(([k, l]) => el('button', { class: k === sub ? 'active' : '', onclick: () => { VN.ui.figSub = k; VN.render(); } }, l)));
      center.insertBefore(el('div', { class: 'fig-tabs' }, el('strong', { style: { fontSize: '15px' } }, 'Figuren'), seg), center.firstChild);
    },
    inspector() {
      const sub = VN.ui.figSub || 'bones';
      if (sub === 'bones') return Bones.inspector();
      if (sub === 'layers') return el('div', { class: 'insp' }, el('div', null, el('h3', null, 'Figuren'), el('div', { class: 'insp-title' }, 'Ebenen & Outfits')),
        el('div', { class: 'hint-box' }, el('strong', null, 'So geht’s'), el('br'),
          '1. Figur anlegen. 2. Ebenen hinzufügen, z. B. Körper, Gesicht, Kleidung, Accessoire (unten nach oben). 3. Jede Ebene bekommt Varianten: alle Bilder gleich groß, mit transparentem Hintergrund.', el('br'), el('br'),
          'Auf der Timeline wählst du am Figuren-Clip „Art der Figur“ → diese Ebenen-Figur. Pro Schritt änderst du dann Ausdruck und Outfit aus einer Liste.', el('br'), el('br'),
          'Eine Ebene kann einer Variable folgen: Hat die Variante einen passenden „Wert“, wird sie automatisch gewählt (z. B. Outfit = 2 → Rüstung).'));
      return el('div', { class: 'insp' }, el('div', null, el('h3', null, 'Figuren'), el('div', { class: 'insp-title' }, 'Lippensync')),
        el('div', { class: 'hint-box' }, el('strong', null, 'Mund markieren'), el('br'),
          'Zieh im Bild ein Rechteck um den Mund. Im Spiel öffnet und schließt er sich dann nach der Lautstärke der Sprachaufnahme. Ohne Aufnahme bewegt er sich, solange der Text getippt wird.', el('br'), el('br'),
          'Alternativ: ein zweites Bild mit offenem Mund wählen. Es wird beim Sprechen eingeblendet.', el('br'), el('br'),
          'Die Figur wird über ihren Namen erkannt (Sprecher = Name der Figur am Clip oder Dateiname).'));
    },

    // ---------- Ebenen-Figuren ----------
    renderLayers(center) {
      center.innerHTML = '';
      const p = VN.project;
      p.figures = p.figures || [];
      if (!p.figures.find((f) => f.id === VN.ui.figSel)) VN.ui.figSel = p.figures[0] ? p.figures[0].id : null;
      const f = p.figures.find((x) => x.id === VN.ui.figSel);
      const body = el('div', { class: 'sys-body fig-body' });
      center.appendChild(body);
      const list = el('div', { class: 'loot-list' },
        ...p.figures.map((x) => el('div', { class: 'list-item' + (x === f ? ' active' : ''), onclick: () => { VN.ui.figSel = x.id; VN.render(); } }, el('span', { class: 'dot', style: { background: '#6cc48a' } }), el('span', { class: 'name' }, x.name), el('span', { class: 'muted small' }, x.layers.length + ' Ebenen'))),
        el('button', { class: 'btn', onclick: () => VN.mutate(() => {
          const id = VN.uid('fig');
          p.figures.push({ id, name: VN.t('Neue Figur'), layers: [{ id: VN.uid('ly'), name: VN.t('Körper'), options: [] }, { id: VN.uid('ly'), name: VN.t('Gesicht'), options: [] }, { id: VN.uid('ly'), name: VN.t('Kleidung'), options: [] }] });
          VN.ui.figSel = id;
        }) }, '+ Ebenen-Figur'));
      const wrap = el('div', { class: 'loot-wrap' }, list);
      body.appendChild(wrap);
      if (!f) { wrap.appendChild(el('div', { class: 'hint-box', style: { flex: '1' } }, 'Noch keine Ebenen-Figur. Lege eine an: Körper, Gesicht, Kleidung und Accessoires als einzelne Bilder übereinander.')); return; }
      VN.ui.figPick = VN.ui.figPick || {};
      const pick = (L) => VN.ui.figPick[L.id] || (L.options[0] && L.options[0].id);
      const ed = el('div', { class: 'loot-ed' },
        el('div', { class: 'row gap8' },
          el('input', { type: 'text', class: 'small-input', value: f.name, style: { fontWeight: '700', fontSize: '14px', flex: '1' }, onchange: (e) => VN.mutate(() => { f.name = e.target.value || 'Figur'; }) }),
          el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { p.figures = p.figures.filter((x) => x !== f); }) }, 'Figur löschen')),
        el('div', { class: 'muted small' }, 'Ebenen von unten nach oben. Alle Bilder einer Figur sollten gleich groß sein (gleiche Leinwand), damit sie genau übereinander passen.'));
      f.layers.forEach((L, li) => {
        const card = el('div', { class: 'opt-card fig-layer-card' },
          el('div', { class: 'row gap8' },
            el('span', { class: 'chip' }, 'Ebene ' + (li + 1)),
            el('input', { type: 'text', class: 'small-input', value: L.name, style: { flex: '1' }, onchange: (e) => VN.mutate(() => { L.name = e.target.value; }) }),
            el('span', { class: 'muted small' }, 'folgt Variable'),
            (() => { const s = el('select', { class: 'small-input', onchange: (e) => VN.mutate(() => { L.varBind = e.target.value || null; }) }); s.appendChild(el('option', { value: '' }, '— keine —')); for (const v of p.vars) { const o = el('option', { value: v.id }, v.name); if (v.id === L.varBind) o.selected = true; s.appendChild(o); } return s; })(),
            el('button', { class: 'btn tiny', disabled: li === 0, title: 'nach unten', onclick: () => VN.mutate(() => { f.layers.splice(li, 1); f.layers.splice(li - 1, 0, L); }) }, '↓'),
            el('button', { class: 'btn tiny', disabled: li === f.layers.length - 1, title: 'nach oben', onclick: () => VN.mutate(() => { f.layers.splice(li, 1); f.layers.splice(li + 1, 0, L); }) }, '↑'),
            el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { f.layers.splice(li, 1); }) }, '×')),
          el('div', { class: 'fig-opts' },
            ...L.options.map((o, oi) => el('div', { class: 'fig-opt' + (pick(L) === o.id ? ' active' : ''), onclick: () => { VN.ui.figPick[L.id] = o.id; VN.render(); } },
              el('div', { class: 'fig-thumb', style: { backgroundImage: o.asset ? `url("${VN.assetUrl(o.asset)}")` : '' } }),
              el('input', { type: 'text', value: o.name, onclick: (e) => e.stopPropagation(), onchange: (e) => VN.mutate(() => { o.name = e.target.value; }) }),
              (() => { const s = VN.assetSelect('image', o.asset, (v) => VN.mutate(() => { o.asset = v; })); s.addEventListener('click', (e) => e.stopPropagation()); return s; })(),
              L.varBind ? el('input', { type: 'text', placeholder: 'Wert', value: o.value != null ? o.value : '', title: 'Wird gewählt, wenn die Variable diesen Wert hat', onclick: (e) => e.stopPropagation(), onchange: (e) => VN.mutate(() => { o.value = e.target.value; }) }) : null,
              el('button', { class: 'fig-del', onclick: (e) => { e.stopPropagation(); VN.mutate(() => { L.options.splice(oi, 1); }); } }, '×'))),
            el('button', { class: 'fig-add', onclick: () => VN.mutate(() => { const a = VN.assetsOf('image')[0]; L.options.push({ id: VN.uid('op'), name: VN.t('Variante ') + (L.options.length + 1), asset: null }); }) }, '+ Variante')));
        // Bilder direkt auf die Ebene ziehen
        card.addEventListener('dragover', (e) => { if (Array.from(e.dataTransfer.types).includes('vn/asset-image')) { e.preventDefault(); card.classList.add('over'); } });
        card.addEventListener('dragleave', () => card.classList.remove('over'));
        card.addEventListener('drop', (e) => { const id = e.dataTransfer.getData('vn/asset-image'); if (!id) return; e.preventDefault(); VN.mutate(() => { L.options.push({ id: VN.uid('op'), name: (VN.asset(id) || {}).name || 'Variante', asset: id }); }); });
        ed.appendChild(card);
      });
      ed.appendChild(el('button', { class: 'btn', onclick: () => VN.mutate(() => { f.layers.push({ id: VN.uid('ly'), name: VN.t('Neue Ebene'), options: [] }); }) }, '+ Ebene'));
      const prev = el('div', { class: 'fig-preview' });
      const fake = { set: f.id, pick: {}, x: 50, scale: 100 };
      for (const L of f.layers) fake.pick[L.id] = pick(L);
      const st = el('div', { class: 'fig-stage' });
      st.appendChild(Stage.charEl(fake, 'char', { beat: 0 }));
      prev.append(el('div', { class: 'sec-title' }, 'Vorschau (Klick auf eine Variante wählt sie aus)'), st);
      wrap.append(ed, prev);
    },

    // ---------- Lippensync: Mund markieren ----------
    renderMouth(center) {
      center.innerHTML = '';
      const p = VN.project;
      p.mouths = p.mouths || {};
      const imgs = VN.assetsOf('image');
      if (!VN.asset(VN.ui.mouthAsset)) VN.ui.mouthAsset = (imgs.find((a) => p.mouths[a.id]) || imgs.find((a) => /ray|char|figur/i.test(a.name + a.file)) || imgs[0] || {}).id;
      const id = VN.ui.mouthAsset;
      const m = p.mouths[id] || null;
      const s = el('select', { class: 'small-input', onchange: (e) => { VN.ui.mouthAsset = e.target.value; VN.render(); } });
      for (const a of imgs) { const o = el('option', { value: a.id }, a.name + (p.mouths[a.id] ? ' · mit Mund' : '')); if (a.id === id) o.selected = true; s.appendChild(o); }
      const testing = !!VN.ui.mouthTest;
      center.appendChild(el('div', { class: 'view-head' }, s, el('div', { class: 'spacer' }),
        m ? el('button', { class: 'btn primary', onclick: () => { VN.ui.mouthTest = !testing; VN.render(); } }, testing ? '■ Stopp' : '▶ Sprechen testen') : null));
      const body = el('div', { class: 'mouth-body' });
      center.appendChild(body);
      if (!id) { body.appendChild(el('div', { class: 'hint-box' }, 'Importiere zuerst ein Figuren-Bild.')); return; }
      const stage = el('div', { class: 'mouth-stage' });
      const img = el('img', { src: VN.assetUrl(id), draggable: 'false' });
      stage.appendChild(img);
      const svgNS = 'http://www.w3.org/2000/svg';
      const ov = document.createElementNS(svgNS, 'svg');
      ov.setAttribute('class', 'mouth-svg');
      ov.setAttribute('viewBox', '0 0 1000 1000');
      ov.setAttribute('preserveAspectRatio', 'none');
      stage.appendChild(ov);
      const pos = () => Object.assign(ov.style, { left: img.offsetLeft + 'px', top: img.offsetTop + 'px', width: img.offsetWidth + 'px', height: img.offsetHeight + 'px' });
      img.addEventListener('load', pos);
      Figures._ro = new ResizeObserver(pos);
      Figures._ro.observe(stage);
      const drawRect = (r) => {
        ov.innerHTML = '';
        if (!r) return;
        const rc = document.createElementNS(svgNS, 'rect');
        rc.setAttribute('x', r.x * 1000); rc.setAttribute('y', r.y * 1000); rc.setAttribute('width', r.w * 1000); rc.setAttribute('height', r.h * 1000);
        rc.setAttribute('fill', 'rgba(232,164,58,0.25)'); rc.setAttribute('stroke', '#e8a43a'); rc.setAttribute('stroke-width', '3'); rc.setAttribute('vector-effect', 'non-scaling-stroke');
        ov.appendChild(rc);
      };
      if (m && m.rect && !testing) drawRect(m.rect);
      // Test: Mund bewegt sich im Takt
      if (testing && m) {
        const fake = el('div', { class: 'char', style: { position: 'absolute', inset: '0', height: '100%', left: '50%', transform: 'translateX(-50%)' } });
        const inner = el('span', { class: 'char-inner' }, el('img', { src: VN.assetUrl(id), draggable: 'false' }));
        fake.appendChild(inner);
        stage.innerHTML = '';
        stage.appendChild(fake);
        const ctl = Fx.attachMouth(fake, { asset: id });
        const t0 = performance.now();
        const loop = () => { if (!fake.isConnected) return; const t = (performance.now() - t0) / 1000; const v = Math.max(0, Math.sin(t * 11) * 0.6 + Math.sin(t * 4.3) * 0.4); if (ctl) ctl.set(v); requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
      } else {
        stage.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const r = img.getBoundingClientRect();
          const x0 = (e.clientX - r.left) / r.width, y0 = (e.clientY - r.top) / r.height;
          let rect = null;
          VN.drag(e, (dx, dy, ev) => {
            const x1 = (ev.clientX - r.left) / r.width, y1 = (ev.clientY - r.top) / r.height;
            rect = { x: Math.max(0, Math.min(x0, x1)), y: Math.max(0, Math.min(y0, y1)), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
            drawRect(rect);
          }, () => { if (rect && rect.w > 0.004 && rect.h > 0.002) VN.mutate(() => { p.mouths[id] = Object.assign({ on: true, mode: 'mask', color: '#3a1418', lip: '' }, p.mouths[id] || {}, { rect: Object.fromEntries(Object.entries(rect).map(([k, v]) => [k, Math.round(v * 10000) / 10000])) }); }); });
        });
      }
      const side = el('div', { class: 'mouth-side' });
      if (!m) side.appendChild(el('div', { class: 'hint-box' }, 'Zieh ein Rechteck um den Mund der Figur.'));
      else {
        const set = (k) => (v) => VN.mutate(() => { m[k] = v; });
        side.append(
          el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: m.on !== false, onchange: (e) => set('on')(e.target.checked) }), 'Lippensync aktiv'),
          el('div', { class: 'seg' }, el('button', { class: m.mode !== 'image' ? 'active' : '', onclick: () => set('mode')('mask') }, 'Mund-Maske'), el('button', { class: m.mode === 'image' ? 'active' : '', onclick: () => set('mode')('image') }, 'Bild mit offenem Mund')),
          m.mode === 'image'
            ? el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Bild mit offenem Mund (gleiche Größe wie die Figur)'), VN.assetSelect('image', m.image, set('image')))
            : el('div', { class: 'insp', style: { gap: '8px' } },
              el('label', { class: 'd-color' }, el('input', { type: 'color', value: m.color || '#3a1418', onchange: (e) => set('color')(e.target.value) }), el('span', null, 'Farbe im Mund')),
              el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!m.lip, onchange: (e) => set('lip')(e.target.checked ? '#7a2c32' : '') }), 'Lippen-Rand'),
              m.lip ? el('label', { class: 'd-color' }, el('input', { type: 'color', value: m.lip, onchange: (e) => set('lip')(e.target.value) }), el('span', null, 'Lippenfarbe')) : null),
          el('div', { class: 'muted small' }, 'Tipp: Das Rechteck darf etwas größer als der geschlossene Mund sein. Es öffnet sich von oben nach unten.'),
          el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { delete p.mouths[id]; }) }, 'Mund entfernen'));
      }
      body.append(stage, side);
    }
  });
})();
