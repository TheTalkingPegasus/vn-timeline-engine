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
    ['idleSpeed', 'Ruhe: Tempo', 0.2, 4, 0.05]
  ];

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
      function draw() {
        svg.innerHTML = '';
        const W = img.naturalWidth || 1000, H = img.naturalHeight || 1000;
        const mk = (tag, at) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(at)) n.setAttribute(k, v); return n; };
        for (const r of regs()) {
          const cx = r.cx * W, cy = r.cy * H, rx = r.rx * W, ry = r.ry * H, rot = r.rot || 0;
          const sel = VN.ui.softSel === r.id;
          const g = mk('g', { transform: `rotate(${rot} ${cx} ${cy})` });
          const e = mk('ellipse', { cx, cy, rx, ry, class: 'sr' + (sel ? ' sel' : '') + (r.on === false ? ' off' : '') });
          e.addEventListener('mousedown', (ev) => { ev.stopPropagation(); ev.preventDefault(); VN.ui.softSel = r.id; drag(ev, r, 'move'); });
          g.appendChild(e);
          const lbl = mk('text', { x: cx, y: cy + H * 0.007, 'text-anchor': 'middle', class: 'sr-lbl', 'font-size': Math.round(H * 0.02) }); lbl.textContent = r.name || VN.t((Soft.PRESETS[r.preset] || {}).label || 'Bereich');
          g.appendChild(lbl);
          if (sel) {
            const hs = Math.max(6, H * 0.008);
            const he = mk('circle', { cx: cx + rx, cy, r: hs, class: 'sr-h' }); he.addEventListener('mousedown', (ev) => { ev.stopPropagation(); ev.preventDefault(); drag(ev, r, 'rx'); });
            const hsn = mk('circle', { cx, cy: cy + ry, r: hs, class: 'sr-h' }); hsn.addEventListener('mousedown', (ev) => { ev.stopPropagation(); ev.preventDefault(); drag(ev, r, 'ry'); });
            const hr = mk('circle', { cx, cy: cy - ry - hs * 4, r: hs, class: 'sr-rot' }); hr.addEventListener('mousedown', (ev) => { ev.stopPropagation(); ev.preventDefault(); drag(ev, r, 'rot'); });
            g.append(he, hsn, hr);
          }
          svg.appendChild(g);
        }
      }
      // Ziehen: verschieben, Größe, Drehung – live ohne Neuaufbau, beim Loslassen speichern
      function drag(ev, r, mode) {
        const W = img.naturalWidth || 1000, H = img.naturalHeight || 1000;
        const o = { cx: r.cx, cy: r.cy, rx: r.rx, ry: r.ry, rot: r.rot || 0 };
        const [u0, v0] = toImg(ev);
        draw();
        VN.drag(ev, (dx, dy, e) => {
          const [u, v] = toImg(e);
          if (mode === 'move') { r.cx = o.cx + (u - u0); r.cy = o.cy + (v - v0); }
          else if (mode === 'rot') { r.rot = Math.round(Math.atan2((u - o.cx) * W, -(v - o.cy) * H) * 180 / Math.PI); }
          else {
            const a = o.rot * Math.PI / 180, x = (u - o.cx) * W, y = (v - o.cy) * H;
            const lx = x * Math.cos(a) + y * Math.sin(a), ly = -x * Math.sin(a) + y * Math.cos(a);
            if (mode === 'rx') r.rx = Math.max(0.01, Math.abs(lx) / W); else r.ry = Math.max(0.005, Math.abs(ly) / H);
          }
          draw();
        }, (dx, dy, moved) => {
          const nv = { cx: r4(r.cx), cy: r4(r.cy), rx: r4(r.rx), ry: r4(r.ry), rot: r.rot || 0 };
          Object.assign(r, o);
          VN.mutate(() => { Object.assign(r, nv); });
        });
      }
      // Auf freier Fläche ziehen = neuer Bereich
      stage.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const [u0, v0] = toImg(e);
        let box = null;
        const W = img.naturalWidth || 1000, H = img.naturalHeight || 1000;
        let ghost = null;
        VN.drag(e, (dx, dy, ev) => {
          const [u1, v1] = toImg(ev);
          box = { cx: (u0 + u1) / 2, cy: (v0 + v1) / 2, rx: Math.abs(u1 - u0) / 2, ry: Math.abs(v1 - v0) / 2 };
          if (!ghost) { ghost = document.createElementNS(NS, 'ellipse'); ghost.setAttribute('class', 'sr sel'); svg.appendChild(ghost); }
          ghost.setAttribute('cx', box.cx * W); ghost.setAttribute('cy', box.cy * H); ghost.setAttribute('rx', box.rx * W); ghost.setAttribute('ry', box.ry * H);
        }, () => {
          if (!box || box.rx < 0.01 || box.ry < 0.005) { if (VN.ui.softSel) { VN.ui.softSel = null; VN.render(); } return; }
          const r = Soft.newRegion(VN.ui.softPreset || 'chest', r4(box.cx), r4(box.cy), r4(box.rx), r4(box.ry));
          VN.mutate(() => {
            p.softs[id] = p.softs[id] || { on: true, regions: [] };
            p.softs[id].regions.push(r);
          });
          VN.ui.softSel = r.id; VN.render();
        });
      });
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
        el('div', { class: 'muted small' }, VN.t('Zieh im Bild eine Ellipse um die Stelle, die weich sein soll (z. B. jede Brust einzeln). Außerhalb der Maske bleibt alles ruhig.'))));
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
      const card = el('div', { class: 'opt-card' });
      const ps = el('select', { onchange: (e) => VN.mutate(() => { for (const k of Object.keys(Soft.PRESETS.chest)) if (k !== 'label') delete r[k]; r.preset = e.target.value; }) });
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
        el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '112px' } }, VN.t('Anker')), sel(P.anchor, Soft.ANCHORS, (v) => { r.anchor = v; })),
        el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '112px' } }, VN.t('Ruhebewegung')), sel(P.idle, Soft.IDLES, (v) => { r.idle = v; })),
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!P.layer, onchange: (e) => VN.mutate(() => { r.layer = e.target.checked; }) }), VN.t('Als eigene Ebene (darf über den Körper schwingen)')),
        el('div', { class: 'logic-row', style: { flexWrap: 'wrap' } },
          el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const c = JSON.parse(JSON.stringify(r)); c.id = VN.uid('sr'); c.cx = r4(1 - r.cx); c.rot = -(r.rot || 0); c.name = (r.name || '') + ' ↔'; regs.push(c); VN.ui.softSel = c.id; }) }, VN.t('↔ Gespiegelt kopieren')),
          el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { for (const k of Object.keys(Soft.PRESETS.chest)) if (k !== 'label') delete r[k]; }) }, VN.t('Vorlage zurücksetzen')),
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
