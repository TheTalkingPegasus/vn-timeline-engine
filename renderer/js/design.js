// Design-Editor: Design-Reiter (Rechtsklick), Projekt-Theme, Sprechblasen, Schriften, Sounds, Mauszeiger
(function () {
  const { el } = VN;

  // ---------- kleine Bausteine ----------
  const field = (label, input, extra) => el('div', { class: 'field' }, el('div', { class: 'lbl' }, label), input, extra || null);
  const row = (...c) => el('div', { class: 'd-row' }, ...c);
  const sec = (title, ...c) => el('div', { class: 'd-sec' }, el('div', { class: 'd-sec-title' }, title), ...c);
  const sel = (value, options, commit) => {
    const s = el('select', { onchange: (e) => commit(e.target.value) });
    for (const [v, l] of options) { const o = el('option', { value: v }, l); if (String(v) === String(value == null ? '' : value)) o.selected = true; s.appendChild(o); }
    return s;
  };
  const rng = (label, value, min, max, step, fmt, commit) => {
    const lab = el('div', { class: 'lbl' }, label + ': ' + fmt(value));
    return el('div', { class: 'field' }, lab, el('input', {
      type: 'range', min, max, step, value,
      oninput: (e) => { lab.textContent = label + ': ' + fmt(Number(e.target.value)); },
      onchange: (e) => commit(Number(e.target.value))
    }));
  };
  const color = (label, value, commit) => el('label', { class: 'd-color' },
    el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000', onchange: (e) => commit(e.target.value) }),
    el('span', null, label));
  const check = (label, v, commit) => el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!v, onchange: (e) => commit(e.target.checked) }), label);

  // Textur-Feld: Vorschau, Bild hineinziehen, aus Dateien wählen, zurücksetzen
  const textureField = (label, value, commit, opts = {}) => {
    const kind = opts.kind || 'image';
    const src = value ? Theme.src(value) : '';
    const thumb = el('div', { class: 'tex-thumb' + (src ? '' : ' empty'), title: 'Bild hierher ziehen' },
      src ? null : el('span', null, opts.placeholder || 'Standard'));
    if (src) thumb.style.backgroundImage = `url("${src}")`;
    thumb.addEventListener('dragover', (e) => { const t = Array.from(e.dataTransfer.types); if (t.includes('vn/asset-' + kind) || t.includes('Files')) { e.preventDefault(); e.stopPropagation(); thumb.classList.add('over'); } });
    thumb.addEventListener('dragleave', () => thumb.classList.remove('over'));
    thumb.addEventListener('drop', async (e) => {
      e.preventDefault(); e.stopPropagation();
      document.getElementById('drag-overlay').hidden = true;
      const id = e.dataTransfer.getData('vn/asset-' + kind);
      if (id) return commit(id);
      const added = await VN.importPaths(VN.filePaths(e.dataTransfer));
      const a = added.find((x) => x.kind === kind);
      if (a) commit(a.id);
    });
    const options = [['', opts.emptyLabel || '— Standard —']];
    if (opts.builtin) for (const [k, f] of Object.entries(Theme.BUILTIN_FRAMES)) options.push(['builtin:' + k, '★ ' + f.label]);
    for (const a of VN.assetsOf(kind)) options.push([a.id, a.name]);
    const s = sel(value || '', options, (v) => commit(v || ''));
    s.style.flex = '1';
    return el('div', { class: 'field tex-field' },
      el('div', { class: 'lbl' }, label),
      el('div', { class: 'row gap8' }, thumb,
        el('div', { class: 'tex-side' },
          s,
          el('div', { class: 'row gap4' },
            el('button', { class: 'btn tiny', title: 'Neue Datei importieren', onclick: async () => { const added = VN.registerAssets(await VN.api.pickAssets(VN.dir, kind)); if (added[0]) commit(added[0].id); } }, '+ Datei'),
            value ? el('button', { class: 'btn tiny', title: 'Standard wiederherstellen', onclick: () => commit('') }, 'Zurücksetzen') : null),
          opts.hint ? el('div', { class: 'muted small' }, 'Empfohlen: ' + opts.hint) : null)));
  };

  // 9-Slice: vier Schnittlinien direkt im Bild ziehen (Werte in % der Bildgröße)
  const sliceEditor = (ref, slice, commit) => {
    const src = Theme.src(ref);
    if (!src) return null;
    const sl = Array.isArray(slice) ? slice.slice() : [slice, slice, slice, slice];
    const box = el('div', { class: 'slice-box' });
    const img = el('img', { src, draggable: 'false' });
    box.appendChild(img);
    const lines = [
      el('div', { class: 'sl h' }), el('div', { class: 'sl v' }), el('div', { class: 'sl h' }), el('div', { class: 'sl v' })
    ];
    const place = () => {
      lines[0].style.top = sl[0] + '%';
      lines[1].style.left = (100 - sl[1]) + '%';
      lines[2].style.top = (100 - sl[2]) + '%';
      lines[3].style.left = sl[3] + '%';
    };
    place();
    lines.forEach((ln, i) => {
      ln.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const r = box.getBoundingClientRect();
        VN.drag(e, (dx, dy, ev) => {
          const px = (ev.clientX - r.left) / r.width * 100, py = (ev.clientY - r.top) / r.height * 100;
          const v = i === 0 ? py : i === 1 ? 100 - px : i === 2 ? 100 - py : px;
          sl[i] = Math.round(Math.max(1, Math.min(49, v)));
          place();
        }, () => commit(Array.isArray(slice) ? sl : sl[i]));
      });
      box.appendChild(ln);
    });
    return el('div', { class: 'field' }, el('div', { class: 'lbl' }, '9-Slice: Linien ziehen. Ecken bleiben scharf, Ränder und Mitte werden gestreckt.'), box,
      el('div', { class: 'muted small' }, 'Oben ' + sl[0] + ' % · rechts ' + sl[1] + ' % · unten ' + sl[2] + ' % · links ' + sl[3] + ' %'));
  };

  // Schicht-Zugriff (Projekt, Sprecher, Zeile) – wird beim ersten Ändern angelegt
  const layerApi = (scope, ctx) => {
    const t = Theme.t();
    const name = ctx.speaker ? String(ctx.speaker).trim() : '';
    return {
      get: () => (scope === 'theme' ? t.bubble : scope === 'speaker' ? t.speakers[name] : ctx.clip.bubble),
      ensure: () => {
        if (scope === 'theme') return t.bubble;
        if (scope === 'speaker') return (t.speakers[name] = t.speakers[name] || {});
        return (ctx.clip.bubble = ctx.clip.bubble || {});
      },
      replace: (obj) => {
        if (scope === 'theme') t.bubble = obj || { preset: 'dunkel' };
        else if (scope === 'speaker') { if (obj) t.speakers[name] = obj; else delete t.speakers[name]; }
        else { if (obj) ctx.clip.bubble = obj; else delete ctx.clip.bubble; }
      },
      resolved: () => Theme.resolve(Theme.layers(ctx.speaker, ctx.clip, scope === 'theme' ? 'theme' : scope === 'speaker' ? 'speaker' : null))
    };
  };

  // Mini-Vorschau einer Sprechblase (für Vorlagen-Karten)
  const miniBubble = (B, name) => {
    const pv = el('div', { class: 'pv' });
    const box = el('div', { class: 'dlg-box mini' },
      el('div', { class: 'dlg-name' }, name || 'Ray'),
      el('div', { class: 'dlg-text' }, 'Hallo! So sehe ich aus.'),
      el('div', { class: 'dlg-next' }, '▼'));
    pv.appendChild(box);
    // Vorschau im Kleinformat: Maße relativ zur kleinen Karte hochrechnen
    const k = 4.2;
    const small = Object.assign({}, B, { minH: 0, size: (B.size || 3.6) * k, pad: (B.pad || 2.4) * k * 0.7, radius: (B.radius || 0) * k, borderW: (B.borderW || 0) * k, frameW: (B.frameW || 2.4) * k });
    Theme.styleBubble(box, small, { speakerColor: '#e8a43a', tailX: B.tail ? 30 : null });
    const nm = box.querySelector('.dlg-name');
    if (nm) nm.style.fontSize = (B.size || 3.6) * k * 0.9 + 'cqh';
    return pv;
  };

  const Design = (window.Design = {
    textureField, sliceEditor, sec,

    // ---------- Sprechblasen-Editor (für Projekt, Sprecher oder eine Zeile) ----------
    bubbleEditor(scope, ctx = {}) {
      const L = layerApi(scope, ctx);
      const B = L.resolved();
      const cur = L.get();
      const set = (k, v) => VN.mutate(() => { L.ensure()[k] = v; });
      const t = Theme.t();
      const box = el('div', { class: 'insp d-bubble' });

      // Vorlagen
      const grid = el('div', { class: 'preset-grid' });
      if (scope !== 'theme') {
        const inherit = Theme.resolve(Theme.layers(ctx.speaker, null, scope === 'speaker' ? 'theme' : 'speaker'));
        grid.appendChild(el('div', { class: 'preset-card' + (!cur ? ' active' : ''), onclick: () => VN.mutate(() => L.replace(null)) },
          miniBubble(inherit, ctx.speaker), el('div', { class: 'pc-name' }, scope === 'speaker' ? 'Wie im Projekt' : 'Wie beim Sprecher')));
      }
      for (const p of Theme.presetList()) {
        const active = cur && (cur.preset === p.id);
        const card = el('div', { class: 'preset-card' + (active ? ' active' : ''), title: p.label, onclick: () => VN.mutate(() => L.replace({ preset: p.id })) },
          miniBubble(Theme.preset(p.id), ctx.speaker), el('div', { class: 'pc-name' }, p.label));
        if (!p.builtin) card.appendChild(el('button', { class: 'pc-del', title: 'Vorlage löschen', onclick: (e) => { e.stopPropagation(); VN.mutate(() => { t.presets = t.presets.filter((x) => x.id !== p.id); }); } }, '×'));
        grid.appendChild(card);
      }
      box.appendChild(sec('Vorlage', grid));

      box.appendChild(sec('Farben',
        row(color('Hintergrund', B.bg, (v) => set('bg', v)), color('Rand', B.border, (v) => set('border', v)), color('Text', B.text, (v) => set('text', v))),
        rng('Deckkraft Hintergrund', B.alpha, 0, 100, 1, (v) => v + ' %', (v) => set('alpha', v)),
        row(check('Namensschild als Fläche', !!B.nameBg, (v) => set('nameBg', v ? '#e8a43a' : '')), B.nameBg ? color('Schild', B.nameBg, (v) => set('nameBg', v)) : null),
        row(check('Eigene Namensfarbe', !!B.nameText, (v) => set('nameText', v ? '#ffffff' : '')), B.nameText ? color('Name', B.nameText, (v) => set('nameText', v)) : el('span', { class: 'muted small' }, 'sonst Sprecherfarbe')),
        row(color('Weiter-Pfeil', B.arrow, (v) => set('arrow', v)))));

      box.appendChild(sec('Form',
        el('div', { class: 'grid2' },
          rng('Ecken', B.radius, 0, 6, 0.1, (v) => v + ' cqh', (v) => set('radius', v)),
          rng('Randstärke', B.borderW, 0, 1.2, 0.05, (v) => v + ' cqh', (v) => set('borderW', v)),
          rng('Innenabstand', B.pad, 0.6, 6, 0.1, (v) => v + ' cqh', (v) => set('pad', v)),
          rng('Mindesthöhe', B.minH, 0, 50, 1, (v) => v + ' %', (v) => set('minH', v))),
        field('Schatten', sel(B.shadow, [['none', 'Keiner'], ['soft', 'Weich'], ['hard', 'Hart (Comic)'], ['inner', 'Innen (düster)']], (v) => set('shadow', v))),
        row(check('Leuchten (Neon)', B.glow, (v) => set('glow', v)), check('Spitze zum Sprecher', B.tail, (v) => set('tail', v))),
        row(check('Sprecher-Porträt in der Blase', B.portrait, (v) => set('portrait', v)))));

      box.appendChild(sec('Text',
        field('Schrift', sel(B.font, Theme.fontOptions(), (v) => set('font', v))),
        el('div', { class: 'grid2' },
          rng('Größe', B.size, 2, 6, 0.1, (v) => v + ' cqh', (v) => set('size', v)),
          rng('Zeilenabstand', B.lineH, 1, 2, 0.05, (v) => v.toFixed(2), (v) => set('lineH', v))),
        row(sel(B.align, [['left', 'Linksbündig'], ['center', 'Zentriert'], ['right', 'Rechtsbündig']], (v) => set('align', v)), check('Kursiv (z. B. Gedanken)', B.italic, (v) => set('italic', v)))));

      const frameSec = sec('Eigener Rahmen (PNG)',
        textureField('Rahmen-Bild', B.frame, (v) => set('frame', v), { builtin: true, emptyLabel: '— kein Rahmen —', placeholder: 'kein Rahmen', hint: Theme.sizeHint(92, 24) + ', PNG mit Transparenz' }));
      if (B.frame) {
        frameSec.append(
          sliceEditor(B.frame, B.slice, (v) => set('slice', v)),
          el('div', { class: 'grid2' },
            rng('Randbreite', B.frameW, 0.4, 8, 0.1, (v) => v + ' cqh', (v) => set('frameW', v)),
            field('Ränder', sel(B.frameMode, [['stretch', 'Strecken'], ['round', 'Kacheln'], ['repeat', 'Wiederholen']], (v) => set('frameMode', v)))));
      }
      frameSec.append(
        textureField('Namensschild-Bild (optional)', B.nameFrame, (v) => set('nameFrame', v), { placeholder: 'Standard', hint: Theme.sizeHint(18, 6) }),
        textureField('Weiter-Pfeil-Bild (optional)', B.arrowImg, (v) => set('arrowImg', v), { placeholder: '▼', hint: '64 × 64 px' }));
      box.appendChild(frameSec);

      // Vorlage speichern, teilen, zurücksetzen
      const nameIn = el('input', { type: 'text', placeholder: 'Name der neuen Vorlage', class: 'small-input', style: { flex: '1', minWidth: '0' } });
      box.appendChild(sec('Vorlagen verwalten',
        el('div', { class: 'row gap4' }, nameIn, el('button', {
          class: 'btn tiny primary', onclick: () => {
            const name = nameIn.value.trim() || 'Eigene Vorlage ' + (t.presets.length + 1);
            const data = Object.assign({}, B);
            delete data.label;
            const id = 'c_' + Date.now().toString(36);
            data.preset = B.preset && B.preset !== id ? B.preset : 'dunkel';
            VN.mutate(() => { t.presets.push({ id, name, data }); L.replace({ preset: id }); });
            VN.toast('Vorlage „' + name + '“ gespeichert');
          }
        }, 'Speichern')),
        el('div', { class: 'row gap4', style: { flexWrap: 'wrap' } },
          el('button', { class: 'btn tiny', onclick: () => Design.exportBubble(B) }, 'Als Datei exportieren'),
          el('button', { class: 'btn tiny', onclick: () => Design.importBubble() }, 'Vorlage importieren'),
          el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => L.replace(scope === 'theme' ? { preset: 'dunkel' } : null)) }, scope === 'theme' ? 'Alles zurücksetzen' : 'Überschreibung entfernen')),
        el('div', { class: 'muted small' }, 'Exportierte Vorlagen lassen sich in andere Projekte laden. Eigene Bilder (Rahmen, Pfeil) muss man dort neu wählen.')));
      return box;
    },

    exportBubble(B) {
      const data = Object.assign({}, B);
      for (const k of ['frame', 'nameFrame', 'arrowImg']) if (data[k] && !String(data[k]).startsWith('builtin:')) data[k] = '';
      VN.api.saveText('sprechblase.vnbubble', JSON.stringify({ type: 'vn-bubble', version: 1, name: (B.label || 'Vorlage'), data }, null, 2), 'vnbubble');
    },
    async importBubble() {
      const text = await VN.api.openText('vnbubble');
      if (!text) return;
      try {
        const j = JSON.parse(text);
        if (j.type !== 'vn-bubble' || !j.data) throw new Error('keine Sprechblasen-Vorlage');
        const t = Theme.t();
        VN.mutate(() => { t.presets.push({ id: 'c_' + Date.now().toString(36), name: j.name || 'Importiert', data: Object.assign({ preset: 'dunkel' }, j.data, { preset: PRESET_SAFE(j.data.preset) }) }); });
        VN.toast('Vorlage importiert');
      } catch (e) { VN.toast('Import fehlgeschlagen: ' + e.message); }
    },

    // ---------- Auswahl-Buttons ----------
    choiceEditor(target, isClip) {
      const C = Object.assign({}, Theme.CHOICE_BASE, Theme.t().choice, isClip ? target : {});
      const set = (k, v) => VN.mutate(() => { target[k] = v; });
      const box = el('div', { class: 'insp' });
      if (isClip) box.appendChild(el('div', { class: 'hint-box' }, 'Änderungen hier gelten nur für diese Auswahl. Für alle Auswahlen: oben „Design“ → „Auswahl-Buttons“.'));
      box.append(
        sec('Anordnung',
          field('Anordnung', sel(C.layout, [['list', 'Liste untereinander'], ['grid', 'Raster (2 Spalten)'], ['row', 'Nebeneinander']], (v) => set('layout', v))),
          el('div', { class: 'grid2' },
            rng('Breite', C.width, 20, 96, 1, (v) => v + ' %', (v) => set('width', v)),
            rng('Höhe auf dem Bild', C.y, 15, 80, 1, (v) => v + ' %', (v) => set('y', v)),
            rng('Abstand', C.gap, 0, 6, 0.1, (v) => v + ' cqh', (v) => set('gap', v)),
            rng('Schriftgröße', C.size, 2, 6, 0.1, (v) => v + ' cqh', (v) => set('size', v))),
          field('Einblenden', sel(C.anim, [['none', 'Sofort'], ['fade', 'Einblenden'], ['slide', 'Hereingleiten'], ['pop', 'Aufploppen']], (v) => set('anim', v)))),
        sec('Farben',
          row(color('Fläche', C.bg, (v) => set('bg', v)), color('Text', C.text, (v) => set('text', v)), color('Rand', C.border, (v) => set('border', v))),
          rng('Deckkraft', C.alpha, 0, 100, 1, (v) => v + ' %', (v) => set('alpha', v)),
          row(color('Maus drüber: Fläche', C.hoverBg, (v) => set('hoverBg', v)), color('Text', C.hoverText, (v) => set('hoverText', v))),
          el('div', { class: 'grid2' },
            rng('Ecken', C.radius, 0, 5, 0.1, (v) => v + ' cqh', (v) => set('radius', v)),
            rng('Randstärke', C.borderW, 0, 1, 0.05, (v) => v + ' cqh', (v) => set('borderW', v))),
          field('Schrift', sel(C.font, Theme.fontOptions('— wie Menüs —'), (v) => set('font', v)))),
        sec('Bilder je Zustand',
          textureField('Normal', C.img, (v) => set('img', v), { emptyLabel: '— keine Bilder, Farben nutzen —', placeholder: 'Farbe', hint: Theme.sizeHint(C.width, 9) }),
          C.img ? textureField('Maus darüber', C.imgHover, (v) => set('imgHover', v), { placeholder: 'wie normal' }) : null,
          C.img ? textureField('Gedrückt', C.imgDown, (v) => set('imgDown', v), { placeholder: 'wie Maus darüber' }) : null,
          C.img ? textureField('Gesperrt', C.imgLocked, (v) => set('imgLocked', v), { placeholder: 'wie normal, blass' }) : null,
          C.img ? el('div', { class: 'grid2' },
            rng('Ecken-Schnitt (9-Slice)', C.slice, 1, 49, 1, (v) => v + ' %', (v) => set('slice', v)),
            rng('Randbreite', C.frameW, 0.4, 6, 0.1, (v) => v + ' cqh', (v) => set('frameW', v))) : null),
        isClip ? el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { for (const k of Object.keys(target)) delete target[k]; }) }, 'Überschreibung entfernen') : null);
      return box;
    },

    sysEditor() {
      const t = Theme.t();
      const S = Theme.sys();
      const set = (k, v) => VN.mutate(() => { t.sys[k] = v; });
      return el('div', { class: 'insp' },
        sec('Fenster',
          row(color('Fläche', S.bg, (v) => set('bg', v)), color('Rand', S.border, (v) => set('border', v)), color('Text', S.text, (v) => set('text', v))),
          row(color('Akzent', S.accent, (v) => set('accent', v)), color('Text auf Akzent', S.accentText, (v) => set('accentText', v))),
          el('div', { class: 'grid2' },
            rng('Deckkraft', S.alpha, 0, 100, 1, (v) => v + ' %', (v) => set('alpha', v)),
            rng('Ecken', S.radius, 0, 6, 0.1, (v) => v + ' cqh', (v) => set('radius', v)),
            rng('Abdunkeln dahinter', S.dim, 0, 95, 1, (v) => v + ' %', (v) => set('dim', v))),
          field('Schrift', sel(S.font, Theme.fontOptions('— wie Menüs —'), (v) => set('font', v))),
          field('Überschriften', sel(S.titleFont, Theme.fontOptions(), (v) => set('titleFont', v)))),
        sec('Rahmen und Hintergründe',
          textureField('Fenster-Rahmen (9-Slice)', S.frame, (v) => set('frame', v), { builtin: true, emptyLabel: '— kein Rahmen —', placeholder: 'kein Rahmen', hint: Theme.sizeHint(50, 60) }),
          S.frame ? el('div', { class: 'grid2' },
            rng('Ecken-Schnitt', S.slice, 1, 49, 1, (v) => v + ' %', (v) => set('slice', v)),
            rng('Randbreite', S.frameW, 0.4, 8, 0.1, (v) => v + ' cqh', (v) => set('frameW', v))) : null,
          textureField('Hintergrund für alle Fenster', S.screenBg, (v) => set('screenBg', v), { placeholder: 'Spielbild', hint: Theme.sizeHint(100, 100) }),
          textureField('Nur Pause', S.bgPause, (v) => set('bgPause', v), { placeholder: 'wie oben' }),
          textureField('Nur Speichern/Laden', S.bgSave, (v) => set('bgSave', v), { placeholder: 'wie oben' }),
          textureField('Nur Einstellungen', S.bgSettings, (v) => set('bgSettings', v), { placeholder: 'wie oben' })),
        el('div', { class: 'hint-box' }, 'Das Inventar hat eigene Bilder für Fenster und Plätze: ',
          el('button', { class: 'btn tiny', onclick: () => { VN.ui.view = 'systems'; VN.ui.sysTab = 'inv'; VN.render(); } }, 'Inventar-Design öffnen')));
    },

    gainEditor() {
      const t = Theme.t();
      const G = Theme.gain();
      const set = (k, v) => VN.mutate(() => { t.gain[k] = v; });
      return el('div', { class: 'insp' },
        sec('Fundmeldung („Erhalten“)',
          row(color('Fläche', G.bg, (v) => set('bg', v)), color('Rand', G.border, (v) => set('border', v))),
          row(color('Text', G.text, (v) => set('text', v)), color('Überschrift', G.title, (v) => set('title', v))),
          rng('Deckkraft', G.alpha, 0, 100, 1, (v) => v + ' %', (v) => set('alpha', v)),
          el('div', { class: 'grid2' },
            field('Position', sel(G.pos, [['top', 'Oben'], ['center', 'Mitte'], ['bottom', 'Unten']], (v) => set('pos', v))),
            field('Animation', sel(G.anim, [['pop', 'Aufploppen'], ['slide', 'Hereingleiten'], ['fade', 'Einblenden']], (v) => set('anim', v)))),
          textureField('Rahmen (9-Slice)', G.frame, (v) => set('frame', v), { builtin: true, emptyLabel: '— kein Rahmen —', placeholder: 'kein Rahmen', hint: Theme.sizeHint(30, 14) })),
        sec('Geld-Anzeige',
          field('Position', sel(G.hud, [['left', 'Oben links'], ['right', 'Oben rechts'], ['off', 'Ausblenden']], (v) => VN.mutate(() => { t.gain.hud = v; VN.project.inventory.hudMoney = v !== 'off'; })))));
    },

    soundsEditor() {
      const t = Theme.t();
      const box = el('div', { class: 'insp' });
      const s = sec('UI-Sounds', el('div', { class: 'muted small' }, 'Leer = kein Sound. Gilt für Menüs, Buttons, Dialoge und Fundmeldungen.'));
      for (const [k, label] of Theme.SOUND_KEYS) {
        const pick = VN.assetSelect('audio', t.sounds[k], (v) => VN.mutate(() => { t.sounds[k] = v || ''; }));
        pick.style.flex = '1';
        s.appendChild(field(label, el('div', { class: 'row gap4' }, pick,
          el('button', { class: 'btn tiny', disabled: !t.sounds[k], onclick: () => VN.previewSound(t.sounds[k]) }, '▶'))));
      }
      s.appendChild(rng('Lautstärke', t.sounds.vol != null ? t.sounds.vol : 80, 0, 100, 1, (v) => v + ' %', (v) => VN.mutate(() => { t.sounds.vol = v; })));
      box.appendChild(s);
      const mix = VN.project.audioMix;
      box.appendChild(sec('Ducking (Musik unter Stimmen)',
        check('Musik automatisch leiser, solange eine Stimme spricht', mix.on !== false, (v) => VN.mutate(() => { mix.on = v; })),
        mix.on !== false ? rng('Musik absenken um', mix.duck != null ? mix.duck : 45, 10, 90, 1, (v) => v + ' %', (v) => VN.mutate(() => { mix.duck = v; })) : null));
      return box;
    },

    cursorEditor() {
      const t = Theme.t();
      const c = t.cursor;
      const set = (k, v) => VN.mutate(() => { c[k] = v; });
      return el('div', { class: 'insp' },
        sec('Mauszeiger im Spiel',
          textureField('Normal', c.normal, (v) => set('normal', v), { placeholder: 'System', hint: '32 × 32 px (höchstens 128)' }),
          textureField('Über Hub-Objekt', c.hub, (v) => set('hub', v), { placeholder: 'Hand' }),
          textureField('Warten (z. B. Minispiel lädt)', c.wait, (v) => set('wait', v), { placeholder: 'System' }),
          el('div', { class: 'grid2' },
            field('Klickpunkt X (px)', el('input', { type: 'number', min: 0, max: 127, value: c.hx || 0, onchange: (e) => set('hx', Number(e.target.value) || 0) })),
            field('Klickpunkt Y (px)', el('input', { type: 'number', min: 0, max: 127, value: c.hy || 0, onchange: (e) => set('hy', Number(e.target.value) || 0) }))),
          el('div', { class: 'muted small' }, 'Der Klickpunkt ist die Stelle im Bild, die genau auf das Ziel zeigt, z. B. die Spitze eines Pfeils. Fahre über die Vorschau, um den Zeiger zu sehen.')));
    },

    fontsEditor() {
      const t = Theme.t();
      const p = VN.project;
      const fonts = VN.assetsOf('font');
      const list = el('div', { class: 'insp', style: { gap: '6px' } });
      if (!fonts.length) list.appendChild(el('div', { class: 'muted small' }, 'Noch keine eigenen Schriften. TTF, OTF, WOFF oder WOFF2 importieren oder in die Dateiliste ziehen.'));
      for (const a of fonts) list.appendChild(el('div', { class: 'opt-card font-row' }, el('span', { style: { fontFamily: Theme.fontCss('asset:' + a.id), fontSize: '20px', flex: 'none' } }, 'Aa'), el('span', { style: { flex: '1' } }, a.name), el('span', { class: 'muted small' }, a.file.split('.').pop().toUpperCase())));
      return el('div', { class: 'insp' },
        sec('Eigene Schriften', list, el('button', { class: 'btn', onclick: async () => { VN.registerAssets(await VN.api.pickAssets(VN.dir, 'font')); setTimeout(() => { Theme.loadFonts(); VN.render(); }, 50); } }, '+ Schrift importieren')),
        sec('Verwendung',
          field('Dialog-Text', sel(t.bubble.font || Theme.resolve([t.bubble]).font, Theme.fontOptions(), (v) => VN.mutate(() => { t.bubble.font = v; }))),
          field('Namen der Sprecher', sel(t.fonts.name || '', Theme.fontOptions('— wie Dialog —'), (v) => VN.mutate(() => { t.fonts.name = v; }))),
          field('Menüs, Buttons und Fenster', sel(t.fonts.ui || '', Theme.fontOptions('— Standard —'), (v) => VN.mutate(() => { t.fonts.ui = v; }))),
          field('Überschriften (Titel, Fenster)', sel(p.mainMenu ? p.mainMenu.titleFont : '', Theme.fontOptions(), (v) => VN.mutate(() => { if (p.mainMenu) p.mainMenu.titleFont = v; t.sys.titleFont = v; })))),
        el('div', { class: 'hint-box' }, 'Eigene Schriften werden beim Export mitgepackt. Achte darauf, dass die Lizenz der Schrift die Weitergabe in Spielen erlaubt.'));
    },

    logoEditor() {
      const t = Theme.t();
      const L = t.logo;
      Theme.logoItems();
      const set = (k, v) => VN.mutate(() => { L[k] = v; });
      const TR = [['fade', 'Überblenden'], ['zoom', 'Zoom'], ['slide', 'Hereinschieben'], ['blur', 'Unschärfe'], ['none', 'Hart']];
      const list = el('div', { class: 'lg-list' });
      L.items.forEach((it, i) => {
        const upd = (k, v) => VN.mutate(() => { it[k] = v; });
        const kindSel = sel(it.kind || 'image', [['image', 'Bild'], ['video', 'Video']], (v) => upd('kind', v));
        list.appendChild(el('div', { class: 'opt-card lg-item' },
          el('div', { class: 'row gap4', style: { alignItems: 'center', flexWrap: 'wrap' } }, el('strong', null, (i + 1) + '.'), kindSel,
            sel(it.when || 'after', [['before', 'vor dem Engine-Logo'], ['after', 'nach dem Engine-Logo']], (v) => upd('when', v)),
            el('div', { class: 'spacer' }),
            el('button', { class: 'btn tiny', disabled: i === 0, onclick: () => VN.mutate(() => { L.items.splice(i, 1); L.items.splice(i - 1, 0, it); }) }, '↑'),
            el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { L.items.splice(i, 1); }) }, '×')),
          (it.kind || 'image') === 'video'
            ? field('Video (WebM oder MP4, mit Ton)', VN.assetSelect('video', it.asset, (v) => upd('asset', v)))
            : textureField('Logo-Bild', it.asset, (v) => upd('asset', v), { placeholder: 'keins', hint: Theme.sizeHint(40, 30) + ', PNG mit Transparenz' }),
          el('div', { class: 'grid2' },
            rng((it.kind || 'image') === 'video' ? 'Dauer (0 = ganzes Video)' : 'Dauer', Number(it.dur) || 0, 0, 12, 0.5, (v) => (v ? v + ' s' : 'ganz'), (v) => upd('dur', v)),
            (it.kind || 'image') === 'image' ? rng('Größe', it.size || 50, 20, 100, 5, (v) => v + ' %', (v) => upd('size', v)) : el('div')),
          el('div', { class: 'grid2' },
            field('Einblenden', sel(it.tin || 'fade', TR, (v) => upd('tin', v))),
            field('Ausblenden', sel(it.tout || 'fade', TR, (v) => upd('tout', v)))),
          row(color('Hintergrund', it.bg || '#000000', (v) => upd('bg', v)))));
      });
      return el('div', { class: 'insp' },
        el('div', { class: 'hint-box' }, el('strong', null, 'Start-Logos'), el('br'),
          'Beim Spielstart erscheint immer das Logo der VN Timeline Engine (Pflicht: mindestens 5 Sekunden, ab 2 Sekunden mit Klick überspringbar). Deine eigenen Logos – Bilder oder Videos – können davor oder danach kommen, so viele du willst.'),
        sec('Studio-Intro', list,
          el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
            el('button', { class: 'btn', onclick: () => VN.mutate(() => { L.items.push({ id: VN.uid('lg'), kind: 'image', asset: null, dur: 2.5, size: 50, bg: '#000000', when: 'after', tin: 'fade', tout: 'fade' }); }) }, '+ Logo (Bild)'),
            el('button', { class: 'btn', onclick: () => VN.mutate(() => { L.items.push({ id: VN.uid('lg'), kind: 'video', asset: null, dur: 0, bg: '#000000', when: 'after', tin: 'fade', tout: 'fade' }); }) }, '+ Logo (Video)'))),
        sec('Jingle und Überspringen',
          field('Jingle (läuft über alle Logos)', VN.assetSelect('audio', L.jingle, (v) => set('jingle', v))),
          L.jingle ? rng('Lautstärke', L.jingleVol != null ? L.jingleVol : 90, 0, 100, 1, (v) => v + ' %', (v) => set('jingleVol', v)) : null,
          field('Klick auf ein Studio-Logo', sel(L.skip || 'click', [['click', 'überspringt dieses Logo'], ['all', 'überspringt alle Studio-Logos'], ['none', 'nicht überspringbar']], (v) => set('skip', v))),
          el('div', { class: 'muted small' }, 'Das Engine-Logo ist davon ausgenommen: Es lässt sich immer erst nach 2 Sekunden überspringen.')),
        el('button', { class: 'btn primary', onclick: () => Player.start(null, 0, { menu: true }) }, '▶ Spielstart ansehen'));
    },

    speakersEditor() {
      const t = Theme.t();
      const speakers = Array.from(new Set(VN.collectTexts().filter((x) => x.id.startsWith('name:')).map((x) => x.text))).filter(Boolean);
      if (!VN.ui.designSpeaker || !speakers.includes(VN.ui.designSpeaker)) VN.ui.designSpeaker = speakers[0] || null;
      const box = el('div', { class: 'insp' });
      if (!speakers.length) return el('div', { class: 'hint-box' }, 'Noch keine Sprecher. Sobald ein Dialog einen Sprecher hat, kannst du ihm hier eine eigene Sprechblase geben.');
      box.appendChild(el('div', { class: 'speaker-chips' }, ...speakers.map((n) => el('button', {
        class: 'chip-btn' + (n === VN.ui.designSpeaker ? ' active' : '') + (t.speakers[n] ? ' custom' : ''),
        onclick: () => { VN.ui.designSpeaker = n; VN.render(); }
      }, n, t.speakers[n] ? ' ●' : ''))));
      box.appendChild(el('div', { class: 'muted small' }, '● = eigene Sprechblase. Einzelne Zeilen kannst du per Rechtsklick auf den Dialog nochmal anders gestalten.'));
      const F = t.focus = t.focus || { on: false, dim: 35 };
      box.appendChild(sec('Sprecher-Fokus',
        check('Wer spricht, wird hervorgehoben, die anderen leicht abgedunkelt', F.on, (v) => VN.mutate(() => { F.on = v; })),
        F.on ? rng('Abdunkeln der anderen', F.dim != null ? F.dim : 35, 5, 80, 1, (v) => v + ' %', (v) => VN.mutate(() => { F.dim = v; })) : null,
        el('div', { class: 'muted small' }, 'Figuren werden über ihren Namen erkannt (Feld „Name der Figur“ am Figuren-Clip, sonst der Dateiname).')));
      box.appendChild(Design.bubbleEditor('speaker', { speaker: VN.ui.designSpeaker }));
      return box;
    },

    // ---------- Design-Reiter im Inspektor (pro Objekt) ----------
    hasTab(t) { return t && ['bg', 'char', 'dialog', 'choice'].includes(VN.tbase(t)); },
    clipTab(s, c, t) {
      const box = el('div', { class: 'insp' });
      const set = (k) => (v) => VN.mutate(() => { c[k] = v; });
      if (t.key === 'dialog') {
        const name = (c.speaker || '').trim();
        box.append(
          el('div', null, el('h3', null, 'Design · Sprechblase'), el('div', { class: 'insp-title' }, 'Diese Zeile' + (name ? ' · ' + name : ''))),
          el('div', { class: 'hint-box' }, 'Reihenfolge: Projekt-Design → Sprecher → diese Zeile. Was du hier änderst, gilt nur für diese eine Zeile.'),
          name ? el('button', { class: 'btn', onclick: () => Design.open('speaker', name) }, 'Sprechblase für „' + name + '“ gestalten') : null,
          el('button', { class: 'btn', onclick: () => Design.open('bubble') }, 'Projekt-Sprechblase gestalten'),
          Design.bubbleEditor('clip', { speaker: name, clip: c }));
      } else if (t.key === 'choice') {
        box.append(el('div', null, el('h3', null, 'Design · Auswahl'), el('div', { class: 'insp-title' }, c.options.length + ' Antworten')),
          Design.choiceEditor(c.look || (c.look = {}), true));
      } else if (t.key === 'bg') {
        box.append(el('div', null, el('h3', null, 'Design · Hintergrund'), el('div', { class: 'insp-title' }, (VN.asset(c.asset) || {}).name || 'kein Bild')),
          textureField('Textur austauschen', c.asset, set('asset'), { emptyLabel: '— kein Bild —', placeholder: 'kein Bild', hint: Theme.sizeHint(100, 100) }),
          VN.bgEditor(c));
      } else {
        box.append(el('div', null, el('h3', null, 'Design · Figur'), el('div', { class: 'insp-title' }, (VN.asset(c.asset) || {}).name || 'kein Bild')),
          textureField('Textur austauschen', c.asset, set('asset'), { emptyLabel: '— kein Bild —', placeholder: 'kein Bild', hint: 'Höhe ' + Math.round(Theme.res().h * 0.88) + ' px, PNG mit Transparenz' }),
          c.asset && VN.project.rigs[c.asset] ? el('div', { class: 'muted small' }, 'Hinweis: Das Skelett gehört zum Bild. Ein neues Bild braucht eigene Bones.') : null,
          VN.styleEditor(c));
      }
      return box;
    },
    hubObjectTab(s, o) {
      const set = (k) => (v) => VN.mutate(() => { o[k] = v; });
      return el('div', { class: 'insp' },
        el('div', null, el('h3', null, 'Design · Hub-Objekt'), el('div', { class: 'insp-title' }, o.name || 'Objekt')),
        textureField('Bild normal', o.asset, set('asset'), { emptyLabel: '— Platzhalter —', placeholder: 'Platzhalter', hint: Theme.sizeHint(o.w, o.h) }),
        textureField('Bild bei Maus darüber', o.hoverAsset, set('hoverAsset'), { emptyLabel: '— wie normal —', placeholder: 'wie normal' }),
        field('Hover-Effekt', sel(o.hover || 'glow', [['glow', 'Glühen'], ['grow', 'Vergrößern'], ['none', 'Keiner']], set('hover'))),
        (o.hover || 'glow') === 'glow' ? row(color('Leuchtfarbe', o.glowColor || '#ffdc8c', set('glowColor'))) : null,
        VN.styleEditor(o));
    },
    hubSceneTab(s) {
      return el('div', { class: 'insp' },
        el('div', null, el('h3', null, 'Design · Hub-Hintergrund'), el('div', { class: 'insp-title' }, s.name)),
        textureField('Textur austauschen', s.bg, (v) => VN.mutate(() => { s.bg = v || null; }), { emptyLabel: '— kein Bild —', placeholder: 'kein Bild', hint: Theme.sizeHint(100, 100) }),
        s.bg ? VN.bgEditor(s.bgLook || (s.bgLook = {})) : null);
    },
    menuButtonTab(m, b) {
      m.btn = m.btn || {};
      const target = b ? (b.look = b.look || {}) : m.btn;
      const set = (k) => (v) => VN.mutate(() => { target[k] = v; });
      const g = Object.assign({}, m.btn, b ? b.look : {});
      return el('div', { class: 'insp' },
        el('div', null, el('h3', null, 'Design · Menü-Button'), el('div', { class: 'insp-title' }, b ? b.label : 'Alle Buttons')),
        b ? el('div', { class: 'hint-box' }, 'Gilt nur für diesen Button. Leer lassen = wie alle anderen.') : null,
        textureField('Bild normal', g.img, set('img'), { emptyLabel: '— Farben nutzen —', placeholder: 'Farbe', hint: Theme.sizeHint(b ? b.w || 26 : 26, 8) }),
        g.img ? textureField('Maus darüber', g.imgHover, set('imgHover'), { placeholder: 'wie normal' }) : null,
        g.img ? textureField('Gedrückt', g.imgDown, set('imgDown'), { placeholder: 'wie Maus darüber' }) : null,
        g.img ? el('div', { class: 'grid2' },
          rng('Ecken-Schnitt', g.slice || 30, 1, 49, 1, (v) => v + ' %', set('slice')),
          rng('Randbreite', g.frameW || 2, 0.4, 6, 0.1, (v) => v + ' cqh', set('frameW'))) : null,
        b ? el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { delete b.look; }) }, 'Überschreibung entfernen') : null);
    },

    // Öffnet den Design-Reiter für die aktuelle Auswahl
    openTab() { VN.ui.inspTab = 'design'; VN.render(); },
    open(sec, speaker) { VN.ui.view = 'design'; VN.ui.designSec = sec || VN.ui.designSec || 'bubble'; if (speaker) VN.ui.designSpeaker = speaker; VN.render(); },

    // ---------- Design-Ansicht (oben „Design“) ----------
    SECTIONS: [['bubble', 'Sprechblase'], ['speaker', 'Sprecher'], ['choice', 'Auswahl-Buttons'], ['sys', 'Systemfenster'], ['games', 'Spielsysteme'], ['gain', 'Fundmeldung'], ['fonts', 'Schriften'], ['sounds', 'Ton & Sounds'], ['cursor', 'Mauszeiger'], ['logo', 'Start-Logo']],
    render(center) {
      const secId = VN.ui.designSec || 'bubble';
      if (Design._ro) Design._ro.disconnect();
      center.innerHTML = '';
      center.appendChild(el('div', { class: 'view-head' },
        el('strong', { style: { fontSize: '15px' } }, 'Design'),
        el('div', { class: 'seg d-seg' }, ...Design.SECTIONS.map(([id, label]) => el('button', { class: id === secId ? 'active' : '', onclick: () => { VN.ui.designSec = id; VN.render(); } }, label)))));
      const wrap = el('div', { class: 'stage-wrap' });
      const stage = el('div', { class: 'stage' });
      wrap.appendChild(stage);
      center.appendChild(wrap);
      center.appendChild(el('div', { class: 'muted small', style: { padding: '0 14px 12px', textAlign: 'center' } },
        'Live-Vorschau mit Bildern aus deinem Projekt. Tipp: Rechtsklick auf ein Objekt in einer Szene öffnet direkt dessen Design.'));
      Design._ro = Stage.fit(wrap, stage);
      Design.preview(stage, secId);
    },
    inspector() {
      const secId = VN.ui.designSec || 'bubble';
      const title = (Design.SECTIONS.find((x) => x[0] === secId) || [0, ''])[1];
      const head = el('div', null, el('h3', null, 'Projekt-Design'), el('div', { class: 'insp-title' }, title));
      const body = secId === 'bubble' ? Design.bubbleEditor('theme')
        : secId === 'speaker' ? Design.speakersEditor()
          : secId === 'choice' ? Design.choiceEditor(Theme.t().choice, false)
            : secId === 'sys' ? Design.sysEditor()
            : secId === 'games' ? UiDesign.inspector()
              : secId === 'gain' ? Design.gainEditor()
                : secId === 'fonts' ? Design.fontsEditor()
                  : secId === 'sounds' ? Design.soundsEditor()
                    : secId === 'cursor' ? Design.cursorEditor()
                      : Design.logoEditor();
      return el('div', { class: 'insp' }, head, body);
    },

    // Beispielbild aus dem Projekt zusammensetzen
    sample() {
      const p = VN.project;
      let bg = null, ch = null, dl = null;
      const order = [VN.curScene(), VN.scene(p.startScene), ...p.scenes].filter((s) => s && s.type === 'story');
      for (const s of order) {
        if (!bg) bg = (s.tracks.bg || []).find((c) => VN.asset(c.asset));
        if (!ch) ch = (s.tracks.char1 || []).concat(s.tracks.char2 || []).find((c) => VN.asset(c.asset));
        if (!dl) dl = (s.tracks.dialog || []).find((d) => d.speaker && d.text);
      }
      return { bg, ch, dl };
    },
    preview(stage, secId) {
      const { bg, ch, dl } = Design.sample();
      if (bg) { const img = el('img', { class: 'bg-img', src: VN.assetUrl(bg.asset), draggable: 'false' }); VN.applyBgLook(img, bg); stage.appendChild(img); }
      else stage.appendChild(el('div', { class: 'mm-bg mm-ph' }));
      if (ch && !['sys', 'logo', 'games'].includes(secId)) stage.appendChild(Stage.charEl(Object.assign({}, ch, { x: 30 })));
      const speaker = secId === 'speaker' && VN.ui.designSpeaker ? VN.ui.designSpeaker : (dl ? dl.speaker : 'Ray');
      const sampleClip = { id: '_pv', speaker, color: dl ? dl.color : '#e8a43a', text: dl && secId !== 'speaker' ? dl.text : 'Das ist eine Beispielzeile, damit du siehst, wie die Sprechblase im Spiel wirkt.' };
      if (secId === 'speaker' && dl) { const real = VN.project.scenes.flatMap((s) => (s.type === 'story' ? s.tracks.dialog : [])).find((d) => (d.speaker || '').trim() === speaker); if (real) Object.assign(sampleClip, { color: real.color, text: real.text }); }
      if (['bubble', 'speaker', 'fonts', 'sounds', 'cursor'].includes(secId)) {
        const box = Stage.dialogEl(sampleClip, null, null, { tailX: 30 });
        box.appendChild(el('div', { class: 'dlg-next' }, '▼'));
        Theme.styleArrow(box.querySelector('.dlg-next'), Theme.bubble(speaker, null));
        stage.appendChild(box);
      }
      if (secId === 'choice') {
        const box = el('div', { class: 'choice-box' },
          el('div', { class: 'choice-btn' }, 'Ich sehe mich erst mal um.'),
          el('div', { class: 'choice-btn' }, 'Die Wache bestechen (50 Gold)'),
          el('div', { class: 'choice-btn locked' }, 'Schloss knacken (Dietrich fehlt)'));
        Theme.styleChoices(box, Theme.choice(null));
        stage.appendChild(box);
      }
      if (secId === 'sys') {
        const ov = el('div', { class: 'pl-overlay' });
        const panel = el('div', { class: 'sys-panel' }, el('div', { class: 'sys-title' }, 'Pause'),
          el('button', { class: 'sys-btn primary' }, 'Weiter'), el('button', { class: 'sys-btn' }, 'Speichern'), el('button', { class: 'sys-btn' }, 'Laden'), el('button', { class: 'sys-btn' }, 'Einstellungen'),
          el('div', { class: 'set-row' }, el('span', null, 'Musik'), el('input', { type: 'range', value: 70 }), el('span', { class: 'set-val' }, '70 %')));
        ov.appendChild(panel);
        Theme.styleSys(ov, panel, 'pause');
        stage.appendChild(ov);
      }
      if (secId === 'gain') {
        const wrap = el('div', { class: 'pl-gainbox' });
        const p = VN.project;
        const items = p.items.slice(0, 2).map((it) => ({ kind: 'item', id: it.id, count: 1 })).concat(p.currencies.slice(0, 1).map((c) => ({ kind: 'money', id: c.id, count: 25 })));
        const box = el('div', { class: 'pl-gain' }, el('div', { class: 'pl-gain-title' }, 'Erhalten'),
          el('div', { class: 'pl-gain-row' }, ...(items.length ? items : [{ kind: 'money', id: '', count: 25 }]).map((g) => el('span', { class: 'pl-gain-item' }, VN.lootName(g)))));
        wrap.appendChild(box);
        Theme.styleGain(wrap, box);
        stage.appendChild(wrap);
        const G = Theme.gain();
        if (G.hud !== 'off' && p.currencies.length) stage.appendChild(el('div', { class: 'pl-hud' + (G.hud === 'right' ? ' right' : ''), style: { top: '1.6cqh' } }, ...p.currencies.map((c) => VN.moneyChip(c, 120))));
      }
      if (secId === 'fonts' && VN.project.mainMenu) {
        const m = VN.project.mainMenu;
        stage.appendChild(el('div', { class: 'mm-title', style: { top: '18%', fontSize: '8cqh', color: m.titleColor || '#fff', fontFamily: Theme.fontCss(m.titleFont) } }, m.title || VN.project.title));
      }
      if (secId === 'cursor') {
        stage.style.cursor = Theme.cursor('normal', 'pointer');
        const ph = el('div', { class: 'pl-hobj', style: { left: '62%', top: '30%', width: '18%', height: '26%', cursor: Theme.cursor('hub', 'pointer') } }, el('div', { class: 'ph' }, 'Hub-Objekt'));
        stage.appendChild(ph);
      }
      if (secId === 'logo') stage.appendChild(Design.splashPreview());
      if (secId === 'games') UiDesign.preview(stage);
    },
    splashPreview() {
      const L = Theme.t().logo;
      const items = Theme.logoItems();
      const box = el('div', { class: 'splash', style: { background: '#0b0b0e' } });
      box.appendChild(Design.engineLogo());
      const strip = (arr, label) => arr.length ? el('div', { class: 'splash-strip' }, el('span', null, label), ...arr.map((x) => x.kind === 'video' ? el('span', { class: 'splash-chip' }, '🎬') : el('img', { src: VN.assetUrl(x.asset) }))) : null;
      const before = items.filter((x) => x.when === 'before'), after = items.filter((x) => x.when !== 'before');
      box.appendChild(el('div', { class: 'splash-note' }, strip(before, 'davor:'), before.length || after.length ? el('span', { class: 'splash-eng' }, '▣ Engine 5 s') : null, strip(after, 'danach:'), L.jingle ? el('span', null, '♪ Jingle') : null));
      return box;
    },
    engineLogo() { return Theme.engineLogo(); }
  });

  const PRESET_SAFE = (id) => (Theme.PRESETS[id] ? id : 'dunkel');
})();
