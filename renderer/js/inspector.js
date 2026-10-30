// Rechte Seitenleiste: Eigenschaften der Auswahl
(function () {
  const { el } = VN;

  // ---------- Feld-Bausteine ----------
  const field = (label, input, extra) => el('div', { class: 'field' }, el('div', { class: 'lbl' }, label), input, extra || null);

  const text = (value, commit, ph) => el('input', { type: 'text', value: value || '', placeholder: ph || '', onchange: (e) => commit(e.target.value) });

  const num = (value, commit, o = {}) => el('input', {
    type: 'number', value: value, min: o.min, max: o.max, step: o.step || 1,
    onchange: (e) => { let v = parseFloat(e.target.value); if (isNaN(v)) v = o.min || 0; if (o.min != null) v = Math.max(o.min, v); if (o.max != null) v = Math.min(o.max, v); commit(v); }
  });

  const range = (label, value, min, max, step, fmt, commit) => {
    const lab = el('div', { class: 'lbl' }, label + ': ' + fmt(value));
    const inp = el('input', {
      type: 'range', min, max, step, value,
      oninput: (e) => { lab.textContent = label + ': ' + fmt(parseFloat(e.target.value)); },
      onchange: (e) => commit(parseFloat(e.target.value))
    });
    return el('div', { class: 'field' }, lab, inp);
  };

  const check = (label, checked, commit) => el('label', { class: 'check' },
    el('input', { type: 'checkbox', checked: !!checked, onchange: (e) => commit(e.target.checked) }), label);

  const select = (value, options, commit) => {
    const s = el('select', { onchange: (e) => commit(e.target.value) });
    for (const [v, l] of options) {
      const o = el('option', { value: v }, l);
      if (v === value) o.selected = true;
      s.appendChild(o);
    }
    return s;
  };

  const assetField = (label, kind, value, commit) => {
    const wrap = el('div', { class: 'field' }, el('div', { class: 'lbl' }, label));
    if (kind === 'image' && value) {
      wrap.appendChild(el('div', { class: 'asset-preview', style: { backgroundImage: `url("${VN.assetUrl(value)}")` } }));
    }
    const row = el('div', { class: 'row gap4' }, VN.assetSelect(kind, value, commit));
    row.firstChild.style.flex = '1';
    if (kind === 'audio' && value) row.appendChild(el('button', { class: 'btn tiny', title: 'Anhören', onclick: () => VN.previewSound(value) }, '▶'));
    row.appendChild(el('button', {
      class: 'btn tiny', title: 'Neue Datei importieren',
      onclick: async () => {
        const res = await VN.api.pickAssets(VN.dir, kind);
        const added = VN.registerAssets(res);
        if (added[0]) commit(added[0].id);
      }
    }, '+'));
    wrap.appendChild(row);
    if (!VN.assetsOf(kind).length) wrap.appendChild(el('div', { class: 'muted small' }, 'Noch keine ' + ({ image: 'Bilder', audio: 'Audiodateien', video: 'Videos', font: 'Schriften' }[kind] || 'Dateien') + ' im Projekt. Mit + importieren.'));
    return wrap;
  };

  const set = (obj, key) => (v) => VN.mutate(() => { obj[key] = v; });

  VN.createAltScene = (src, label) => {
    const s = VN.newStoryScene('Alternativ: ' + (label || 'neuer Pfad'), (src.x || 0) + 280, (src.y || 0) + 140 + Math.random() * 60);
    return s;
  };

  const Inspector = (window.Inspector = {
    render(root) {
      root.innerHTML = '';
      const s = VN.curScene();
      if (!VN.project) return;
      if (VN.ui.view === 'graph') return root.appendChild(Inspector.graph());
      if (VN.ui.view === 'systems') return root.appendChild(Inspector.systems());
      if (VN.ui.view === 'transcript') return root.appendChild(Transcript.inspector());
      if (VN.ui.view === 'bones') return root.appendChild(Figures.inspector());
      if (VN.ui.view === 'menu') return root.appendChild(Menu.inspector());
      if (!s) return root.appendChild(el('div', { class: 'hint-box' }, 'Lege links eine Story- oder Hub-Szene an.'));
      if (VN.ui.view === 'design') return root.appendChild(Design.inspector());
      if (VN.ui.view === 'anim') return root.appendChild(AnimEd.inspector());
      if (s.type === 'story') {
        const f = VN.ui.sel ? VN.findClip(s, VN.ui.sel) : null;
        root.appendChild(f
          ? Inspector.tabbed(() => Inspector.clip(s, f.clip, f.track), Design.hasTab(f.track) ? () => Design.clipTab(s, f.clip, f.track) : null, f.track.label)
          : Inspector.story(s));
      } else {
        const o = VN.ui.sel ? s.objects.find((x) => x.id === VN.ui.sel) : null;
        root.appendChild(o
          ? Inspector.tabbed(() => Inspector.hubObject(s, o), () => Design.hubObjectTab(s, o), 'Objekt')
          : Inspector.tabbed(() => Inspector.hub(s), () => Design.hubSceneTab(s), 'Hub'));
      }
    },

    // Reiter „Eigenschaften | Design“
    tabbed(propsFn, designFn, label) {
      if (!designFn) return propsFn();
      const tab = VN.ui.inspTab === 'design' ? 'design' : 'props';
      const head = el('div', { class: 'seg insp-tabs' },
        el('button', { class: tab === 'props' ? 'active' : '', onclick: () => { VN.ui.inspTab = 'props'; VN.render(); } }, 'Eigenschaften'),
        el('button', { class: tab === 'design' ? 'active' : '', onclick: () => { VN.ui.inspTab = 'design'; VN.render(); } }, '🎨 Design'));
      return el('div', { class: 'insp' }, head, tab === 'design' ? designFn() : propsFn());
    },

    designLink(what) {
      return el('button', { class: 'btn design-link', onclick: () => Design.openTab() }, el('span', null, '🎨 Design'), el('span', { class: 'muted small' }, what));
    },

    startRow(s) {
      const isStart = VN.project.startScene === s.id;
      return isStart
        ? el('div', { class: 'row gap8' }, el('span', { class: 'badge' }, 'START'), el('span', { class: 'muted small' }, 'Das Spiel beginnt hier'))
        : el('button', { class: 'btn', onclick: () => VN.mutate(() => { VN.project.startScene = s.id; }) }, 'Als Startszene festlegen');
    },

    story(s) {
      return el('div', { class: 'insp' },
        el('div', null, el('h3', null, 'Story-Szene'), el('div', { class: 'insp-title' }, s.name)),
        field('Name', text(s.name, set(s, 'name'))),
        field('Länge in Schritten (Klicks)', num(s.beats, (v) => VN.mutate(() => { s.beats = Math.max(1, Math.round(v)); }), { min: 1, max: 999 })),
        field('Danach weiter zu', VN.sceneSelect(s.next, set(s, 'next'), { exclude: s.id, world: true, emptyLabel: VN.World && VN.World.on() ? '— Ende (oder zurück zum Ort nach Ereignis) —' : '— Ende des Spiels —' })),
        Inspector.startRow(s),
        el('div', { class: 'hint-box' },
          el('strong', null, 'So funktioniert die Timeline'), el('br'),
          'Jede Spalte ist ein Schritt, also ein Klick des Spielers. ',
          'Bilder und Audio aus der Dateiliste auf eine Spur ziehen. Doppelklick auf eine Spur legt einen leeren Clip an. ',
          'Clips verschieben, am rechten Rand ziehen zum Verlängern, Rechtsklick für mehr. Entf löscht, Strg+Z macht rückgängig.'),
        el('button', { class: 'btn danger', onclick: () => VN.deleteScene(s.id) }, 'Szene löschen')
      );
    },

    clip(s, c, t) {
      const tb = VN.tbase(t);
      const box = el('div', { class: 'insp' },
        el('div', null, el('h3', null, 'Clip · ' + t.label), el('div', { class: 'insp-sub' }, 'Schritt ' + (c.start + 1) + (c.len > 1 ? ' bis ' + (c.start + c.len) : ''))));
      const timing = el('div', { class: 'grid2' },
        field('Start (Schritt)', num(c.start + 1, (v) => VN.mutate(() => { c.start = Math.max(0, Math.round(v) - 1); s.beats = Math.max(s.beats, c.start + c.len); }), { min: 1 })),
        field('Dauer (Schritte)', num(c.len, (v) => VN.mutate(() => { c.len = Math.max(1, Math.round(v)); s.beats = Math.max(s.beats, c.start + c.len); }), { min: 1 })));

      if (tb === 'bg') {
        box.append(assetField('Bild', 'image', c.asset, set(c, 'asset')),
          field('Übergang', select(c.trans || 'fade', [['cut', 'Schnitt'], ['fade', 'Überblenden'], ['black', 'Über Schwarz'], ['eyes', 'Augen zu und auf'], ['mask', 'Mit Maske (Wischen, Kreis …)'], ['shatter', 'Bildschirm zerspringt']], set(c, 'trans'))),
          c.trans === 'shatter' ? field('Scherben', select(c.shatterMode || 'fall', [['fall', 'fallen herunter'], ['burst', 'explodieren'], ['side', 'fliegen zur Seite']], set(c, 'shatterMode'))) : null,
          range('Übergangsdauer', c.dur != null ? c.dur : 1, 0, 3, 0.1, (v) => v.toFixed(1) + ' s', set(c, 'dur')),
          Tools.bgExtras(c),
          Inspector.designLink('Zoom, Ausschnitt, Vignette, Farbe'), timing);
      } else if (tb === 'cam') {
        box.appendChild(Tools.camInspector(s, c, t, timing));
      } else if (tb === 'video') {
        box.appendChild(Tools.videoInspector(s, c, t, assetField, timing));
      } else if (tb === 'char') {
        box.append(Tools.figureFields(s, c),
          c.set ? null : assetField('Figur-Bild', 'image', c.asset, set(c, 'asset')),
          field('Name der Figur (für Sprecher)', text(c.name, set(c, 'name'), (VN.asset(c.asset) || {}).name || 'z. B. Ray')),
          range('Position', c.x != null ? c.x : 50, 0, 100, 1, (v) => Math.round(v) + ' %', set(c, 'x')),
          range('Höhe', c.y || 0, -40, 60, 1, (v) => (Math.round(v) > 0 ? '+' : '') + Math.round(v) + ' %', set(c, 'y')),
          el('div', { class: 'muted small' }, 'Tipp: Figuren lassen sich auf der Bühne auch direkt ziehen – waagerecht für die Position, senkrecht für die Höhe (Umschalt: nur eine Richtung).'),
          range('Größe', c.scale || 100, 30, 180, 1, (v) => Math.round(v) + ' %', set(c, 'scale')),
          check('Spiegeln', c.flip, set(c, 'flip')),
          field('Auftritt', select(c.trans || 'fade', [['cut', 'Sofort'], ['fade', 'Einblenden'], ['slide', 'Hereingleiten']], set(c, 'trans'))),
          field('Bewegung im Stand', select(c.idle || 'none', [['none', 'Keine'], ['breathe', 'Atmen'], ['float', 'Schweben']], set(c, 'idle'))),
          Tools.keysEditor(s, c, t),
          Tools.animFields(s, c),
          c.asset && VN.project.rigs[c.asset]
            ? el('div', { class: 'opt-card' },
              check('Bones-Animation nutzen', c.bones !== false, (v) => VN.mutate(() => { c.bones = v; })),
              range('Stärke der Bones-Bewegung', c.boneAmp != null ? c.boneAmp : 100, 0, 200, 5, (v) => Math.round(v) + ' %', set(c, 'boneAmp')),
              el('button', { class: 'btn tiny', onclick: () => App.openBones(c.asset) }, 'Knochen bearbeiten'))
            : (c.asset ? el('button', { class: 'btn tiny', onclick: () => App.openBones(c.asset) }, 'Bones für dieses Bild einrichten') : null),
          Inspector.designLink('Kontur, Schatten, Leuchten, Mischmodus'),
          timing);
      } else if (tb === 'fx') {
        box.append(
          el('div', { class: 'hint-box' }, 'Eine Ebene über den Figuren: Farbe oder Bild mit Mischmodus, Partikel (Regen, Schnee …), ein Filter wie „Rückblende“ oder Augen öffnen/schließen. Fertige Effekte findest du links unter „Effekte“.'),
          Tools.fxMode(c),
          c.particles || c.filter || c.eyes ? null : assetField('Bild (optional)', 'image', c.asset, set(c, 'asset')),
          c.asset || c.particles || c.filter || c.eyes ? null : field('Farbe', el('input', { type: 'color', value: c.color || '#3c4a8c', onchange: (e) => set(c, 'color')(e.target.value) })),
          c.particles || c.filter || c.eyes ? null : VN.styleEditor(c),
          c.particles || c.filter || c.eyes ? null : Tools.keysEditor(s, c, t),
          timing);
      } else if (tb === 'dialog') {
        const ta = el('textarea', { onchange: (e) => set(c, 'text')(e.target.value) }, c.text || '');
        const bar = Tools.textToolbar(ta, (v) => set(c, 'text')(v));
        const color = el('input', { type: 'color', value: c.color || '#ffffff', onchange: (e) => set(c, 'color')(e.target.value) });
        box.append(
          el('div', { class: 'row gap8', style: { alignItems: 'flex-end' } },
            el('div', { style: { flex: '1' } }, field('Sprecher', text(c.speaker, set(c, 'speaker'), 'leer = Erzähler'))),
            field('Farbe', color)),
          Inspector.designLink('Sprechblase, Vorlage, Rahmen'),
          field('Text', el('div', { class: 'tt-wrap' }, bar, ta)),
          range('Tempo', c.speed != null ? c.speed : 40, 0, 120, 5, (v) => (v === 0 ? 'sofort' : v + ' Zeichen/s'), set(c, 'speed')),
          Tools.dialogExtras(s, c),
          VN.actionEditor(c.actions || (c.actions = []), 'Beim Erreichen dieses Dialogs ausführen'),
          field('Start (Schritt)', num(c.start + 1, (v) => VN.mutate(() => { c.start = Math.max(0, Math.round(v) - 1); s.beats = Math.max(s.beats, c.start + 1); }), { min: 1 })));
      } else if (tb === 'choice') {
        box.appendChild(el('div', { class: 'hint-box' }, 'Erscheint, nachdem der Dialog dieses Schritts gelesen wurde. Ohne Ziel geht es in dieser Szene weiter.'));
        box.appendChild(Inspector.designLink('Button-Bilder, Farben, Anordnung'));
        c.options.forEach((o, i) => {
          box.appendChild(el('div', { class: 'opt-card' },
            field('Antwort ' + (i + 1), text(o.text, (v) => VN.mutate(() => { o.text = v; }))),
            field('Führt zu', VN.sceneSelect(o.target, (v) => VN.mutate(() => { o.target = v; }), { exclude: s.id, emptyLabel: '— weiter in dieser Szene —' })),
            VN.condEditor(o.conds || (o.conds = []), 'Antwort nur verfügbar, wenn'),
            o.conds && o.conds.length ? check('Ausblenden statt ausgrauen, wenn nicht erfüllt', o.hideLocked, (v) => VN.mutate(() => { o.hideLocked = v; })) : null,
            VN.Life ? VN.Life.relField(o) : null,
            VN.actionEditor(o.actions || (o.actions = []), 'Bei Auswahl ausführen'),
            el('div', { class: 'row gap4' },
              el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const n = VN.createAltScene(s, o.text); o.target = n.id; }) }, 'Alternativer Pfad: neue Szene'),
              el('button', { class: 'btn tiny danger', disabled: c.options.length <= 1, onclick: () => VN.mutate(() => { c.options.splice(i, 1); }) }, 'Entfernen'))));
        });
        box.appendChild(el('button', { class: 'btn', onclick: () => VN.mutate(() => { c.options.push({ id: VN.uid('opt'), text: VN.t('Neue Antwort'), target: null, conds: [], actions: [] }); }) }, '+ Antwort'));
        box.appendChild(Tools.choiceTimer(c));
        box.appendChild(field('Schritt', num(c.start + 1, (v) => VN.mutate(() => { c.start = Math.max(0, Math.round(v) - 1); s.beats = Math.max(s.beats, c.start + 1); }), { min: 1 })));
      } else if (tb === 'music') {
        box.append(assetField('Musik', 'audio', c.asset, set(c, 'asset')),
          Inspector.cutRow(s, c, t),
          range('Lautstärke', c.vol != null ? c.vol : 70, 0, 100, 1, (v) => Math.round(v) + ' %', set(c, 'vol')),
          range('Ein-/Ausblenden', c.fade != null ? c.fade : 1, 0, 5, 0.1, (v) => v.toFixed(1) + ' s', set(c, 'fade')),
          check('Wiederholen (Loop)', c.loop !== false, set(c, 'loop')),
          check('Nach dem Clip weiterlaufen (auch in nächste Szenen)', c.carry, set(c, 'carry')),
          Tools.musicMode(c),
          timing);
      } else {
        box.append(assetField(tb === 'voice' ? 'Voice-Datei' : 'Soundeffekt', 'audio', c.asset, set(c, 'asset')),
          Inspector.cutRow(s, c, t),
          range('Lautstärke', c.vol != null ? c.vol : 90, 0, 100, 1, (v) => Math.round(v) + ' %', set(c, 'vol')),
          range('Verzögerung', c.delay || 0, 0, 3, 0.1, (v) => v.toFixed(1) + ' s', set(c, 'delay')),
          tb === 'voice' ? field('Figur (Lippen)', (() => {
            const names = Array.from(new Set(VN.project.scenes.flatMap((x) => (x.type === 'story' ? x.tracks.dialog.map((d) => (d.speaker || '').trim()) : [])).filter(Boolean)));
            const d = s.tracks.dialog.find((x) => x.start === c.start);
            return select(c.who || '', [['', 'Automatisch (' + ((d && d.speaker) || 'Sprecher der Zeile') + ')'], ...names.map((n) => [n, n])], (v) => VN.mutate(() => { if (v) c.who = v; else delete c.who; }));
          })()) : null,
          tb === 'voice' && c.asset ? Tools.voiceFx(c) : null,
          tb === 'sfx' ? field('Untertitel für Gehörlose (optional)', text(c.caption, set(c, 'caption'))) : null,
          field('Schritt', num(c.start + 1, (v) => VN.mutate(() => { c.start = Math.max(0, Math.round(v) - 1); s.beats = Math.max(s.beats, c.start + 1); }), { min: 1 })));
      }
      box.appendChild(el('div', { class: 'row gap8' },
        el('button', { class: 'btn', onclick: () => Story.duplicateClip(s, c, t) }, 'Duplizieren'),
        el('button', { class: 'btn danger', onclick: () => Story.deleteClip(s, c.id) }, 'Löschen')));
      return box;
    },

    hub(s) {
      return el('div', { class: 'insp' },
        el('div', null, el('h3', null, 'Hub-Szene'), el('div', { class: 'insp-title' }, s.name)),
        field('Name', text(s.name, set(s, 'name'))),
        assetField('Hintergrund', 'image', s.bg, set(s, 'bg')),
        s.bg ? Inspector.designLink('Hintergrund bearbeiten') : null,
        assetField('Musik (Loop)', 'audio', s.music, set(s, 'music')),
        Inspector.startRow(s),
        Inspector.events(s),
        el('div', { class: 'hint-box' },
          el('strong', null, 'Hub-Szene'), el('br'),
          'Ein Ort, an dem der Spieler frei klickt. Bilder aus der Dateiliste auf die Bühne ziehen, um klickbare Objekte anzulegen. ',
          'Verschieben, an der Ecke skalieren, am Kreis oben drehen. Die Hitbox wandert immer mit.'),
        el('button', { class: 'btn danger', onclick: () => VN.deleteScene(s.id) }, 'Szene löschen'));
    },

    cutRow(s, c, t) {
      if (!c.asset) return null;
      return el('div', { class: 'opt-card' },
        el('div', { class: 'row gap8' },
          el('div', { style: { flex: '1' } }, el('div', { class: 'sec-title' }, 'Schnitt'),
            el('div', { class: 'muted small' }, c.in != null || c.out != null ? AudioCut.fmt(c.in || 0) + ' – ' + (c.out != null ? AudioCut.fmt(c.out) : 'Ende') : 'ganze Datei')),
          el('button', { class: 'btn tiny', onclick: () => VN.previewSound(c.asset, c.in, c.out) }, '▶'),
          el('button', { class: 'btn tiny primary', onclick: () => AudioCut.open(s, c, t) }, '✂ Schneiden')),
        VN.tbase(t) !== 'music' ? el('div', { class: 'muted small' }, 'Eine lange Aufnahme mit vielen Sätzen? „Schneiden“ → „Teile erkennen“ → automatisch auf die Dialoge verteilen.') : null);
    },

    events(s) {
      s.events = s.events || [];
      const box = el('div', { class: 'insp', style: { gap: '8px' } }, el('div', { class: 'sec-title' }, 'Ereignisse (z. B. Tutorial)'));
      if (!s.events.length) box.appendChild(el('div', { class: 'muted small' }, 'Kleine Dialoge, die beim Betreten des Hubs ablaufen, optional mit Spotlight auf ein Objekt.'));
      s.events.forEach((ev, i) => {
        const card = el('div', { class: 'opt-card' },
          el('div', { class: 'row gap8' }, el('strong', { style: { flex: '1' } }, 'Ereignis ' + (i + 1)),
            el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { s.events.splice(i, 1); }) }, 'Entfernen')),
          field('Auslöser', select(ev.trigger || 'first', [['first', 'Beim ersten Betreten'], ['always', 'Bei jedem Betreten']], set(ev, 'trigger'))),
          field('Spotlight auf Objekt', select(ev.spotlight || '', [['', '— keins —'], ...s.objects.map((o) => [o.id, o.name || 'Objekt'])], (v) => VN.mutate(() => { ev.spotlight = v || null; }))),
          ev.spotlight ? check('Klicksperre: nur dieses Objekt klickbar, bis es angeklickt wurde', ev.lock, set(ev, 'lock')) : null,
          VN.condEditor(ev.conds || (ev.conds = []), 'Nur wenn'));
        ev.lines.forEach((l, j) => {
          card.appendChild(el('div', { class: 'logic-row' },
            el('input', { type: 'text', value: l.speaker || '', placeholder: 'Sprecher', style: { width: '80px' }, onchange: (e) => VN.mutate(() => { l.speaker = e.target.value; }) }),
            el('input', { type: 'text', value: l.text || '', placeholder: 'Text', style: { flex: '1', maxWidth: 'none', minWidth: '120px' }, onchange: (e) => VN.mutate(() => { l.text = e.target.value; }) }),
            el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { ev.lines.splice(j, 1); }) }, '×')));
        });
        card.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const prev = ev.lines[ev.lines.length - 1]; ev.lines.push({ id: VN.uid('ln'), speaker: prev ? prev.speaker : '', color: prev ? prev.color : '#c4b2ff', text: VN.t('Neuer Text …') }); }) }, '+ Zeile'));
        box.appendChild(card);
      });
      box.appendChild(el('button', { class: 'btn', onclick: () => VN.mutate(() => { s.events.push({ id: VN.uid('ev'), trigger: 'first', spotlight: null, lock: false, conds: [], lines: [{ id: VN.uid('ln'), speaker: '', color: '#c4b2ff', text: VN.t('Willkommen! Sieh dich ruhig um.') }] }); }) }, '+ Ereignis'));
      return box;
    },

    hubObject(s, o) {
      const idx = s.objects.indexOf(o);
      return el('div', { class: 'insp' },
        el('div', null, el('h3', null, 'Objekt'), el('div', { class: 'insp-title' }, o.name || 'Objekt')),
        field('Name (Tooltip im Spiel)', text(o.name, set(o, 'name'))),
        assetField('Bild', 'image', o.asset, set(o, 'asset')),
        el('div', { class: 'grid2' },
          field('X %', num(Math.round(o.x * 10) / 10, set(o, 'x'), { step: 0.5 })),
          field('Y %', num(Math.round(o.y * 10) / 10, set(o, 'y'), { step: 0.5 })),
          field('Breite %', num(Math.round(o.w * 10) / 10, set(o, 'w'), { min: 1, step: 0.5 })),
          field('Höhe %', num(Math.round(o.h * 10) / 10, set(o, 'h'), { min: 1, step: 0.5 }))),
        range('Drehung', o.rot || 0, -180, 180, 1, (v) => Math.round(v) + '°', set(o, 'rot')),
        field('Hitbox-Form', select(o.shape || 'rect', [['rect', 'Rechteck'], ['ellipse', 'Ellipse']], set(o, 'shape'))),
        VN.condEditor(o.conds || (o.conds = []), 'Objekt nur sichtbar, wenn'),
        el('div', { class: 'sec-title' }, 'Beim Klick'),
        window.Connect ? Connect.rulesUI(o) : null,
        VN.actionEditor(o.actions || (o.actions = []), 'Ausführen (z. B. Loot würfeln)'),
        field('Gehe zu Szene', VN.sceneSelect(o.target, set(o, 'target'), { exclude: s.id })),
        el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const n = VN.createAltScene(s, o.name); o.target = n.id; }) }, 'Neue Szene als Ziel anlegen'),
        field('Meldung anzeigen (optional)', el('textarea', { style: { minHeight: '60px' }, onchange: (e) => set(o, 'message')(e.target.value) }, o.message || '')),
        VN.useOnEditor ? VN.useOnEditor(s, o) : null,
        assetField('Sound beim Klick', 'audio', o.sfx, set(o, 'sfx')),
        Inspector.designLink('Bild bei Maus darüber, Leuchtfarbe, Stile'),
        el('div', { class: 'sec-title' }, 'Ebene'),
        el('div', { class: 'row gap4' },
          el('button', { class: 'btn tiny', disabled: idx === s.objects.length - 1, onclick: () => VN.mutate(() => { s.objects.splice(idx, 1); s.objects.push(o); }) }, 'Ganz nach vorne'),
          el('button', { class: 'btn tiny', disabled: idx === 0, onclick: () => VN.mutate(() => { s.objects.splice(idx, 1); s.objects.unshift(o); }) }, 'Ganz nach hinten')),
        el('div', { class: 'row gap8' },
          el('button', { class: 'btn', onclick: () => Hub.duplicate(s, o) }, 'Duplizieren'),
          el('button', { class: 'btn danger', onclick: () => VN.mutate(() => { s.objects = s.objects.filter((x) => x !== o); VN.ui.sel = null; }) }, 'Löschen')));
    },

    systems() {
      const p = VN.project;
      return el('div', { class: 'insp' },
        el('div', null, el('h3', null, 'Spielsysteme'), el('div', { class: 'insp-title' }, 'Wenn → Dann')),
        el('div', { class: 'hint-box' },
          el('strong', null, 'So hängt alles zusammen'), el('br'),
          'Hier legst du Variablen, Gegenstände, Währungen und Loot-Tabellen an. Benutzt werden sie in den Szenen:', el('br'), el('br'),
          '• Antworten einer Auswahl: Bedingungen („nur wenn“) und Aktionen („bei Auswahl“)', el('br'),
          '• Dialog-Clips: Aktionen beim Erreichen', el('br'),
          '• Hub-Objekte: Sichtbarkeit, Aktionen beim Klick, z. B. „Loot-Tabelle würfeln“', el('br'),
          '• Hub-Ereignisse: Bedingungen'),
        el('div', { class: 'grid2' },
          el('div', { class: 'hint-box' }, el('strong', null, p.vars.length), ' Variablen'),
          el('div', { class: 'hint-box' }, el('strong', null, p.items.length), ' Gegenstände'),
          el('div', { class: 'hint-box' }, el('strong', null, p.currencies.length), ' Währungen'),
          el('div', { class: 'hint-box' }, el('strong', null, p.lootTables.length), ' Loot-Tabellen')),
        el('div', { class: 'hint-box' }, 'Beim Testen zeigt F2 alle Werte live an.'));
    },

    graph() {
      const sel = VN.scene(VN.ui.graphSel);
      return el('div', { class: 'insp' },
        el('div', null, el('h3', null, 'Pfade'), el('div', { class: 'insp-title' }, VN.project.scenes.length + ' Szenen')),
        el('div', { class: 'hint-box' },
          'Doppelklick öffnet eine Szene. Rechtsklick auf eine Szene oder eine Linienbeschriftung für neue Pfade. ',
          'Hintergrund ziehen zum Verschieben, Mausrad zum Zoomen.'),
        sel ? el('div', { class: 'opt-card' },
          el('strong', null, sel.name),
          el('div', { class: 'muted small' }, sel.type === 'hub' ? 'Hub-Szene' : sel.beats + ' Schritte'),
          el('div', { class: 'row gap4' },
            el('button', { class: 'btn tiny', onclick: () => App.openScene(sel.id) }, 'Öffnen'),
            el('button', { class: 'btn tiny', onclick: () => Player.start(sel.id) }, '▶ Testen'))) : null,
        el('div', { class: 'sec-title' }, 'Prüfung'),
        ...(() => {
          const list = Help.visible().filter((x) => x.area === 'Pfade' || x.area === 'Bedingungen');
          return list.length ? list.map((x) => Help.box(x)) : [el('div', { class: 'hint-box' }, 'Alles in Ordnung: Jede Szene ist vom Start aus erreichbar.')];
        })(),
        el('button', { class: 'btn tiny', onclick: () => Help.panel() }, 'Alle Hinweise zum Projekt …')
      );
    }
  });
})();
