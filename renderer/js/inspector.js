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

  // Regler mit Zahlenfeld zum Eintippen (0.7.4). o.free: eingetippte Werte dürfen über den Regler hinausgehen (lo/hi = harte Grenzen)
  const range = (label, value, min, max, step, fmt, commit, o = {}) => {
    const lab = el('div', { class: 'lbl' }, label + ': ' + fmt(value));
    const numIn = el('input', {
      type: 'number', class: 'rng-num', value: Math.round(value * 100) / 100, step,
      title: VN.t('Wert eintippen'),
      onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
      onchange: (e) => {
        let v = parseFloat(String(e.target.value).replace(',', '.'));
        if (isNaN(v)) { e.target.value = value; return; }
        const lo = o.free ? (o.lo != null ? o.lo : -Infinity) : min, hi = o.free ? (o.hi != null ? o.hi : Infinity) : max;
        v = Math.max(lo, Math.min(hi, v));
        commit(v);
      }
    });
    const inp = el('input', {
      type: 'range', min, max, step, value,
      oninput: (e) => { lab.textContent = label + ': ' + fmt(parseFloat(e.target.value)); numIn.value = e.target.value; },
      onchange: (e) => commit(parseFloat(e.target.value))
    });
    return el('div', { class: 'field' }, lab, el('div', { class: 'rng-row' }, inp, numIn));
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
      if (VN.ui.view === 'storyboard') return root.appendChild(Storyboard.inspector());
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

    // Ebenen-Figur am Clip (0.9.8): Bones der untersten Ebene mit Bones gelten für alle Ebenen
    figBonesCard(c) {
      const base = Stage.figureRigBase(Object.assign({}, c, { bones: true }), c.start);
      const assets = Stage.figureAssets(c, c.start);
      if (!base) {
        const first = assets[0];
        return el('div', { class: 'opt-card' },
          el('div', { class: 'muted small' }, 'Bones für Ebenen-Figuren: Richte die Bones am Bild der untersten Ebene (z. B. Körper) ein. Alle Ebenen darüber – Gesicht, Kleidung, Accessoires – bewegen sich dann mit.'),
          first ? el('button', { class: 'btn tiny', onclick: () => App.openBones(first) }, 'Bones für die Körper-Ebene einrichten') : null);
      }
      return el('div', { class: 'opt-card' },
        check('Bones-Animation nutzen', c.bones !== false, (v) => VN.mutate(() => { c.bones = v; })),
        range('Stärke der Bones-Bewegung', c.boneAmp != null ? c.boneAmp : 100, 0, 200, 5, (v) => Math.round(v) + ' %', set(c, 'boneAmp')),
        el('div', { class: 'muted small' }, VN.tf('Knochen kommen vom Bild „{name}“ – alle Ebenen bewegen sich mit.', { name: (VN.asset(base) || {}).name || base })),
        el('button', { class: 'btn tiny', onclick: () => App.openBones(base) }, 'Knochen bearbeiten'));
    },

    // Kurze Hilfe zur Code-Spur und zu Formeln (0.9.16)
    codeHelp() {
      const ex = [
        ['gold += 5', 'Variable „gold“ um 5 erhöhen'],
        ['[Tür offen] = wahr', 'Namen mit Leerzeichen in eckigen Klammern'],
        ['if mut > 3 and not geflohen: punkte += 1', 'Wenn-Dann in einer Zeile'],
        ['give("Schlüssel")  take("Heiltrank", 2)', 'Gegenstände geben und nehmen'],
        ['earn("Gold", 10)  spend("Gold", 3)', 'Geld dazu oder weg'],
        ['goto("Marktplatz")', 'Zu einer Szene oder einem Hub springen'],
        ['wurf = random(1, 6)', 'Zufallszahl von 1 bis 6'],
        ['# Notiz', 'Kommentar, wird ignoriert']
      ];
      return el('div', { class: 'hint-box' },
        el('strong', null, 'So schreibst du Code'), el('br'),
        el('span', { class: 'muted small' }, 'Eine Anweisung pro Zeile. Variablen legst du unter „Variablen“ an – oder mit dem +-Knopf, wenn ein Name noch fehlt.'),
        el('table', { class: 'code-help' }, ...ex.map(([c, d]) => el('tr', null, el('td', null, el('code', null, VN.t(c))), el('td', { class: 'muted small' }, d)))),
        el('div', { class: 'muted small' }, 'Funktionen: min, max, round, floor, ceil, abs, random, chance(30), item("Name"), money("Gold"), seen("Szene"). Vergleiche: == != < <= > >=, verknüpfen mit and/und, or/oder, not/nicht.'),
        el('div', { class: 'muted small' }, 'Dieselben Formeln gehen auch als Bedingung: „🧮 Formel“, z. B. gold >= 10 and item("Schlüssel") > 0.'));
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
        s.overHub || s.next === '@return' ? check('Über dem Hub abspielen (Hub bleibt im Hintergrund sichtbar)', s.overHub, set(s, 'overHub')) : null,
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
        el('div', null, el('h3', null, 'Clip · ' + t.label), el('div', { class: 'insp-sub' }, c.len > 1 ? VN.tf('Schritt {a} bis {b}', { a: c.start + 1, b: c.start + c.len }) : 'Schritt ' + (c.start + 1))));
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
      } else if (tb === 'code') {
        const [ta, msg] = VN.Formula.editor(c, 'code', true, 8);
        ta.style.width = '100%';
        box.append(field('Code (läuft, sobald dieser Schritt beginnt)', ta), msg, timing, Inspector.codeHelp());
      } else if (tb === 'cam') {
        box.appendChild(Tools.camInspector(s, c, t, timing));
      } else if (tb === 'video') {
        box.appendChild(Tools.videoInspector(s, c, t, assetField, timing));
      } else if (tb === 'char') {
        box.append(Tools.figureFields(s, c),
          c.set || c.puppet ? null : assetField('Figur-Bild', 'image', c.asset, set(c, 'asset')),
          field('Name der Figur (für Sprecher)', text(c.name, set(c, 'name'), (VN.asset(c.asset) || {}).name || 'z. B. Ray')),
          range('Position', c.x != null ? c.x : 50, 0, 100, 1, (v) => Math.round(v * 10) / 10 + ' %', set(c, 'x'), { free: true, lo: -50, hi: 150 }),
          range('Höhe', c.y || 0, -40, 60, 1, (v) => (v > 0 ? '+' : '') + Math.round(v * 10) / 10 + ' %', set(c, 'y'), { free: true, lo: -100, hi: 100 }),
          range('Größe', c.scale || 100, 30, 180, 1, (v) => Math.round(v) + ' %', set(c, 'scale'), { free: true, lo: 5, hi: 400 }),
          range('Drehung', c.rot || 0, -180, 180, 1, (v) => Math.round(v) + '°', set(c, 'rot')),
          el('div', { class: 'muted small' }, 'Frei transformieren: Figur auf der Bühne ziehen (rastet an Mitte, Dritteln, Boden und anderen Figuren ein – Alt = frei), an den Ecken skalieren, am Kreis oben drehen (Umschalt: 15°-Schritte). Werte lassen sich auch eintippen.'),
          check('Spiegeln', c.flip, set(c, 'flip')),
          field('Auftritt', select(c.trans || 'fade', [['cut', 'Sofort'], ['fade', 'Einblenden'], ['slide', 'Hereingleiten']], set(c, 'trans'))),
          field('Bewegung im Stand', select(c.idle || 'none', [['none', 'Keine'], ['breathe', 'Atmen'], ['float', 'Schweben']], set(c, 'idle'))),
          Tools.keysEditor(s, c, t),
          Tools.animFields(s, c),
          c.set ? Inspector.figBonesCard(c)
          : c.asset && VN.project.rigs[c.asset]
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
          c.particles || c.filter || c.eyes || c.light ? null : assetField('Bild (optional)', 'image', c.asset, set(c, 'asset')),
          c.asset || c.particles || c.filter || c.eyes || c.light ? null : field('Farbe', el('input', { type: 'color', value: c.color || '#3c4a8c', onchange: (e) => set(c, 'color')(e.target.value) })),
          c.particles || c.filter || c.eyes || c.light ? null : VN.styleEditor(c),
          c.particles || c.filter || c.eyes || c.light ? null : Tools.keysEditor(s, c, t),
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
          Inspector.placeholderHint(ta, (v) => set(c, 'text')(v)),
          range('Tempo', c.speed != null ? c.speed : 40, 0, 120, 5, (v) => (v === 0 ? 'sofort' : v + ' Zeichen/s'), set(c, 'speed')),
          Tools.dialogExtras(s, c),
          VN.actionEditor(c.actions || (c.actions = []), 'Beim Erreichen dieses Dialogs ausführen'),
          Inspector.waitEditor(c),
          field('Start (Schritt)', num(c.start + 1, (v) => VN.mutate(() => { c.start = Math.max(0, Math.round(v) - 1); s.beats = Math.max(s.beats, c.start + 1); }), { min: 1 })));
      } else if (tb === 'choice') {
        box.appendChild(el('div', { class: 'hint-box' }, 'Erscheint, nachdem der Dialog dieses Schritts gelesen wurde. Ohne Ziel geht es in dieser Szene weiter.'));
        box.appendChild(Inspector.designLink('Button-Bilder, Farben, Anordnung'));
        c.options.forEach((o, i) => {
          // Reihenfolge der Antworten ändern (0.9.2)
          const moveOpt = (d) => VN.mutate(() => { const j = i + d; if (j < 0 || j >= c.options.length) return; c.options.splice(i, 1); c.options.splice(j, 0, o); });
          box.appendChild(el('div', { class: 'opt-card' },
            el('div', { class: 'row gap4', style: { justifyContent: 'flex-end', marginBottom: '-4px' } },
              el('button', { class: 'btn tiny', title: VN.t('Eine Position nach oben'), disabled: i === 0, onclick: () => moveOpt(-1) }, '↑'),
              el('button', { class: 'btn tiny', title: VN.t('Eine Position nach unten'), disabled: i === c.options.length - 1, onclick: () => moveOpt(1) }, '↓')),
            field('Antwort ' + (i + 1), text(o.text, (v) => VN.mutate(() => { o.text = v; }))),
            field('Führt zu', VN.sceneSelect(o.target, (v) => VN.mutate(() => { o.target = v; }), { exclude: s.id, emptyLabel: '— weiter in dieser Szene —' })),
            VN.condEditor(o.conds || (o.conds = []), 'Antwort nur verfügbar, wenn'),
            o.conds && o.conds.length ? check('Ausblenden statt ausgrauen, wenn nicht erfüllt', o.hideLocked, (v) => VN.mutate(() => { o.hideLocked = v; })) : null,
            field('Nach dem Wählen', select(o.afterPick == null ? '' : o.afterPick, [['', '— wie bei der Auswahl eingestellt —'], ['none', 'bleibt normal'], ['grey', 'ausgrauen („schon gefragt“), weiter wählbar'], ['hide', 'ausblenden (nur einmal wählbar)']], (v) => VN.mutate(() => { if (v) o.afterPick = v; else delete o.afterPick; }))),
            VN.Life ? VN.Life.relField(o) : null,
            VN.actionEditor(o.actions || (o.actions = []), 'Bei Auswahl ausführen'),
            el('div', { class: 'row gap4' },
              el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const n = VN.createAltScene(s, o.text); o.target = n.id; }) }, 'Alternativer Pfad: neue Szene'),
              el('button', { class: 'btn tiny danger', disabled: c.options.length <= 1, onclick: () => VN.mutate(() => { c.options.splice(i, 1); }) }, 'Entfernen'))));
        });
        box.appendChild(el('button', { class: 'btn', onclick: () => VN.mutate(() => { c.options.push({ id: VN.uid('opt'), text: VN.t('Neue Antwort'), target: null, conds: [], actions: [] }); }) }, '+ Antwort'));
        box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Anordnung und schon gewählte Antworten'),
          range('Waagerechte Position', c.chX != null ? c.chX : 50, 5, 95, 1, (v) => (Math.round(v) === 50 ? 'Mitte' : Math.round(v) + ' %'), (v) => VN.mutate(() => { if (Math.round(v) === 50) delete c.chX; else c.chX = Math.round(v); })),
          el('div', { class: 'row gap4' }, ...[['links', 22], ['Mitte', 50], ['rechts', 78]].map(([l, v]) => el('button', { class: 'btn tiny' + ((c.chX != null ? c.chX : 50) === v ? ' primary' : ''), onclick: () => VN.mutate(() => { if (v === 50) delete c.chX; else c.chX = v; }) }, VN.t(l)))),
          range('Senkrechte Position', c.chY != null ? c.chY : VN.choiceYDefault(c), 5, 95, 1, (v) => (c.chY == null ? Math.round(v) + ' % (' + VN.t('wie im Design') + ')' : Math.round(v) + ' %'), (v) => VN.mutate(() => { c.chY = Math.round(v); })),
          el('div', { class: 'row gap4' }, ...[['oben', 22], ['Mitte', 42], ['unten', 70]].map(([l, v]) => el('button', { class: 'btn tiny' + (c.chY === v ? ' primary' : ''), onclick: () => VN.mutate(() => { c.chY = v; }) }, VN.t(l))),
            el('button', { class: 'btn tiny' + (c.chY == null ? ' primary' : ''), title: VN.t('Position aus Design → Auswahl-Buttons'), onclick: () => VN.mutate(() => { delete c.chY; }) }, VN.t('wie im Design'))),
          range('Breite', c.chW != null ? c.chW : (window.Theme ? Number(Theme.choice(c).width) || 46 : 46), 15, 95, 1, (v) => Math.round(v) + ' %' + (c.chW == null ? ' (' + VN.t('wie im Design') + ')' : ''), (v) => VN.mutate(() => { c.chW = Math.round(v); })),
          el('div', { class: 'muted small' }, VN.t('Tipp: Die Auswahl lässt sich auch direkt auf der Bühne mit der Maus verschieben.')),
          el('button', { class: 'btn tiny', title: VN.t('Position und Breite dieser Auswahl auf alle anderen Auswahlen im Projekt übertragen'), onclick: () => { let n = 0; VN.mutate(() => { for (const sc of VN.project.scenes) if (sc.type === 'story') for (const x of sc.tracks.choice || []) { if (x === c) continue; for (const k of ['chX', 'chY', 'chW']) { if (c[k] != null) x[k] = c[k]; else delete x[k]; } n++; } }); VN.toast(VN.tf('Position bei {n} Auswahl(en) übernommen', { n })); } }, VN.t('Für alle Auswahlen im Projekt übernehmen')),
          field('Schon gewählte Antworten', select(c.afterPick || '', [['', 'bleiben normal'], ['grey', 'ausgrauen („schon gefragt“)'], ['hide', 'ausblenden']], (v) => VN.mutate(() => { if (v) c.afterPick = v; else delete c.afterPick; }))),
          c.afterPick === 'hide' || c.options.some((o) => o.afterPick === 'hide') ? field('Wenn alle Antworten weg sind', VN.sceneSelect(c.allDone, (v) => VN.mutate(() => { if (v) c.allDone = v; else delete c.allDone; }), { exclude: s.id, emptyLabel: '— in dieser Szene weiter —' })) : null,
          el('div', { class: 'muted small' }, 'Gut für Hub-Dialoge, in denen man eine Figur Dinge fragt: Gefragtes wird grau oder verschwindet. Zählt pro Spielstand.')));
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
        VN.Life && VN.Life.timeOn() ? Inspector.hubSlots(s) : null,
        Inspector.hubFx(s),
        window.Light ? Inspector.hubLights(s) : null,
        assetField('Musik (Loop)', 'audio', s.music, set(s, 'music')),
        Inspector.startRow(s),
        Inspector.events(s),
        el('div', { class: 'hint-box' },
          el('strong', null, 'Hub-Szene'), el('br'),
          'Ein Ort, an dem der Spieler frei klickt. Bilder aus der Dateiliste auf die Bühne ziehen, um klickbare Objekte anzulegen. ',
          'Verschieben, an der Ecke skalieren, am Kreis oben drehen. Die Hitbox wandert immer mit.'),
        el('button', { class: 'btn danger', onclick: () => VN.deleteScene(s.id) }, 'Szene löschen'));
    },

    // Partikel im Hub (0.9.5)
    hubFx(s) {
      s.fx = s.fx || [];
      const box = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Partikel'));
      if (!s.fx.some((c) => !c.light)) box.appendChild(el('div', { class: 'muted small' }, 'Regen, Schnee, Staub, Funken, Blütenblätter oder Glühwürmchen über dem ganzen Hub.'));
      s.fx.forEach((c, i) => {
        if (c.light) return;
        const card = el('div', { class: 'opt-card', style: { margin: '6px 0' } },
          el('div', { class: 'row gap8' },
            select(c.particles, Fx.PARTICLES, (v) => VN.mutate(() => { Object.assign(c, Fx.PART_DEF[v], { particles: v }); })),
            el('label', { class: 'd-color' }, el('input', { type: 'color', value: c.color || '#ffffff', onchange: (e) => VN.mutate(() => { c.color = e.target.value; }) })),
            el('div', { class: 'spacer' }),
            el('button', { class: 'btn tiny' + ((c.conds || []).length ? ' primary' : ''), title: VN.t('Nur wenn … (z. B. Tageszeit Nacht, Jahreszeit Winter)'), onclick: () => { c.conds = c.conds || []; Inspector.condModal(c.conds, VN.t('Partikel nur, wenn …')); } }, '🔒' + ((c.conds || []).length ? ' ' + c.conds.length : '')),
            el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { s.fx.splice(i, 1); }) }, '×')),
          el('div', { class: 'grid2' },
            range('Menge', c.density != null ? c.density : 50, 5, 100, 1, (v) => v + ' %', (v) => VN.mutate(() => { c.density = v; })),
            range('Tempo', c.speed != null ? c.speed : 40, 5, 100, 1, (v) => v + ' %', (v) => VN.mutate(() => { c.speed = v; })),
            range('Größe', c.size != null ? c.size : 40, 10, 100, 1, (v) => v + ' %', (v) => VN.mutate(() => { c.size = v; })),
            range('Wind', c.wind || 0, -60, 60, 1, (v) => v + ' %', (v) => VN.mutate(() => { c.wind = v; }))));
        box.appendChild(card);
      });
      const add = el('select', { onchange: (e) => { const v = e.target.value; if (v) VN.mutate(() => { s.fx.push(Object.assign({ id: VN.uid('hfx'), particles: v, conds: [] }, Fx.PART_DEF[v])); }); } },
        el('option', { value: '' }, '+ ' + VN.t('Partikel hinzufügen …')), ...Fx.PARTICLES.map(([k, l]) => el('option', { value: k }, l)));
      box.appendChild(add);
      if (s.fx.some((c) => !c.light)) box.appendChild(el('div', { class: 'muted small' }, 'Mit 🔒 z. B. Glühwürmchen nur nachts oder Schnee nur im Winter. Wechselt, sobald im Hub Zeit vergeht.'));
      return box;
    },
    // Lichter im Hub (0.9.9): auf der Bühne mit der Maus platzieren wie Hitboxen
    hubLights(s) {
      s.fx = s.fx || [];
      const box = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Lichter'));
      const lights = s.fx.filter((c) => c.light);
      if (!lights.length) box.appendChild(el('div', { class: 'muted small' }, 'Scheinwerfer, Lampen, Neonröhren oder Gegenlicht. Die Lampe erscheint auf der Bühne und lässt sich wie eine Hitbox verschieben.'));
      VN.ui.lightOpen = VN.ui.lightOpen || {};
      const ui = { rng: range, check, set: (o, k) => (v) => VN.mutate(() => { o[k] = v; }), field, sel: select };
      for (const c of lights) {
        const name = (Light.KINDS.find((k) => k[0] === c.light) || [0, 'Licht'])[1];
        const open = !!VN.ui.lightOpen[c.id];
        const card = el('div', { class: 'opt-card', style: { margin: '6px 0' } },
          el('div', { class: 'row gap8' },
            el('span', { class: 'light-dot', style: { background: Light.v(c, 'lColor') } }),
            el('strong', { style: { flex: '1', cursor: 'pointer' }, onclick: () => { VN.ui.lightOpen[c.id] = !open; VN.render(); } }, (open ? '▾ ' : '▸ ') + name),
            el('button', { class: 'btn tiny' + ((c.conds || []).length ? ' primary' : ''), title: VN.t('Nur wenn … (z. B. Tageszeit Nacht, Jahreszeit Winter)'), onclick: () => { c.conds = c.conds || []; Inspector.condModal(c.conds, VN.t('Licht nur, wenn …')); } }, '🔒' + ((c.conds || []).length ? ' ' + c.conds.length : '')),
            el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { s.fx.splice(s.fx.indexOf(c), 1); }) }, '×')));
        if (open) card.append(...Light.fields(c, ui));
        box.appendChild(card);
      }
      const add = el('select', { onchange: (e) => { const k = e.target.value; if (k) VN.mutate(() => { const c = Object.assign({ id: VN.uid('hfx'), conds: [] }, Light.defaults(k)); s.fx.push(c); VN.ui.lightOpen[c.id] = true; }); } },
        el('option', { value: '' }, '+ ' + VN.t('Licht hinzufügen …')), ...Light.KINDS.map(([k, l]) => el('option', { value: k }, l)));
      box.appendChild(add);
      if (lights.length) box.appendChild(el('div', { class: 'muted small' }, 'Mit 🔒 z. B. Laternen nur nachts. Hub-Objekte werden vom Licht mit beleuchtet.'));
      return box;
    },
    condModal(list, title) {
      const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) { back.remove(); VN.render(); } } });
      const card = el('div', { class: 'modal', style: { width: '600px', maxHeight: '84vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' } });
      const draw = () => { card.innerHTML = ''; card.append(el('div', { class: 'row gap8' }, el('strong', { style: { flex: '1' } }, title), el('button', { class: 'btn primary', onclick: () => { back.remove(); VN.render(); } }, VN.t('Fertig'))), VN.condEditor(list, VN.t('Nur wenn'))); };
      draw(); back.appendChild(card); document.body.appendChild(back);
      const orig = VN.render;
      VN.render = function () { orig.apply(this, arguments); if (back.isConnected) draw(); else VN.render = orig; };
    },

    // Hintergrund je Tageszeit (0.8.0)
    hubSlots(s) {
      const T = VN.project.time;
      s.bgSlots = s.bgSlots || {};
      return el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Hintergrund je Tageszeit'),
        ...T.slots.map((n, i) => el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '70px' } }, n),
          VN.assetSelect('image', s.bgSlots[i] || '', (v) => VN.mutate(() => { if (v) s.bgSlots[i] = v; else delete s.bgSlots[i]; })))),
        el('div', { class: 'muted small' }, 'Leer = normaler Hintergrund (mit automatischer Tageszeit-Färbung). Wechselt sofort, wenn im Hub Zeit vergeht.'));
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
          field('Wann', select(VN.evWhen(ev), [['enter', 'Beim Betreten des Hubs'], ['cond', 'Sobald „Nur wenn“ stimmt (auch mitten im Hub)']], (v) => VN.mutate(() => { ev.when = v; ev.repeat = VN.evRepeat(ev); ev.trigger = v === 'cond' ? 'cond' : ev.repeat === 'always' ? 'always' : 'first'; }))),
          el('div', null,
            field('Wie oft', select(VN.evRepeat(ev), [['once', 'Nur einmal'], ['always', 'Jedes Mal'], ['times', 'Höchstens … mal'], ...(VN.Life && VN.Life.timeOn() ? [['daily', 'Einmal pro Tag']] : [])], (v) => VN.mutate(() => { ev.repeat = v; ev.when = VN.evWhen(ev); ev.trigger = ev.when === 'cond' ? 'cond' : v === 'always' ? 'always' : 'first'; if (v === 'times' && !ev.times) ev.times = 2; }))),
            VN.evRepeat(ev) === 'times' ? field('Anzahl', num(ev.times || 2, (v) => VN.mutate(() => { ev.times = Math.max(1, Math.round(v)); }), { min: 1 })) : null),
          field('Art', select(ev.mode || 'lines', [['lines', 'Kurze Zeilen (hier eintippen)'], ['scene', 'Timeline-Dialog (Figuren, Handy, Auswahl …)']], set(ev, 'mode'))),
          ev.mode === 'scene' ? Inspector.hubDialogRow(s, ev) : null,
          ev.mode === 'scene' ? null : field('Spotlight auf Objekt', select(ev.spotlight || '', [['', '— keins —'], ...s.objects.map((o) => [o.id, o.name || 'Objekt'])], (v) => VN.mutate(() => { ev.spotlight = v || null; }))),
          ev.spotlight && ev.mode !== 'scene' ? check('Klicksperre: nur dieses Objekt klickbar, bis es angeklickt wurde', ev.lock, set(ev, 'lock')) : null,
          VN.condEditor(ev.conds || (ev.conds = []), 'Nur wenn'));
        if (ev.mode === 'scene') { box.appendChild(card); return; }
        ev.lines.forEach((l, j) => {
          card.appendChild(el('div', { class: 'logic-row' },
            el('input', { type: 'text', value: l.speaker || '', placeholder: 'Sprecher', style: { width: '80px' }, onchange: (e) => VN.mutate(() => { l.speaker = e.target.value; }) }),
            el('input', { type: 'text', value: l.text || '', placeholder: 'Text', style: { flex: '1', maxWidth: 'none', minWidth: '120px' }, onchange: (e) => VN.mutate(() => { l.text = e.target.value; }) }),
            el('select', { title: VN.t('Darstellung'), style: { width: '92px' }, onchange: (e) => VN.mutate(() => { if (e.target.value) l.style = e.target.value; else delete l.style; }) },
              ...[['', 'Sprechblase'], ['phone', '📱 Handy'], ['note', '🔔 Meldung']].map(([v, t]) => el('option', { value: v, selected: (l.style || '') === v }, VN.t(t)))),
            el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { ev.lines.splice(j, 1); }) }, '×')));
        });
        card.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const prev = ev.lines[ev.lines.length - 1]; ev.lines.push({ id: VN.uid('ln'), speaker: prev ? prev.speaker : '', color: prev ? prev.color : '#c4b2ff', text: VN.t('Neuer Text …') }); }) }, '+ Zeile'));
        box.appendChild(card);
      });
      box.appendChild(el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
        el('button', { class: 'btn', onclick: () => VN.mutate(() => { s.events.push({ id: VN.uid('ev'), trigger: 'first', spotlight: null, lock: false, conds: [], lines: [{ id: VN.uid('ln'), speaker: '', color: '#c4b2ff', text: VN.t('Willkommen! Sieh dich ruhig um.') }] }); }) }, '+ Ereignis'),
        el('button', { class: 'btn', title: VN.t('Ein Dialog mit allen Möglichkeiten der Timeline, der über dem Hub abläuft und danach zurückkehrt'), onclick: () => VN.mutate(() => { const n = VN.newHubDialog(s); s.events.push({ id: VN.uid('ev'), trigger: 'first', mode: 'scene', scene: n.id, spotlight: null, lock: false, conds: [], lines: [] }); }) }, '+ Timeline-Dialog')));
      return box;
    },

    // Timeline-Dialog eines Hub-Ereignisses: Szene wählen, neu anlegen, öffnen
    hubDialogRow(s, ev) {
      const sc = ev.scene && VN.scene(ev.scene);
      return el('div', { class: 'insp', style: { gap: '6px' } },
        field('Szene', VN.sceneSelect(ev.scene, (v) => VN.mutate(() => { ev.scene = v; const n = v && VN.scene(v); if (n && n.type === 'story' && !n.next) n.next = '@return'; }), { exclude: s.id, emptyLabel: '— Szene wählen —' })),
        el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
          sc ? el('button', { class: 'btn tiny primary', onclick: () => App.openScene(sc.id) }, '✏ In der Timeline bearbeiten') : null,
          el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const n = VN.newHubDialog(s); ev.scene = n.id; }) }, '+ Neue Szene dafür')),
        sc && sc.type === 'story' && sc.next !== '@return' ? el('div', { class: 'hint-box warn-box small' }, VN.t('Diese Szene kehrt am Ende nicht zum Hub zurück.'), ' ',
          el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { sc.next = '@return'; }) }, '↩ Zurück zum Hub einstellen')) : null,
        el('div', { class: 'muted small' }, 'Läuft über dem Hub (Hintergrund und Objekte bleiben sichtbar, wenn die Szene keinen eigenen Hintergrund hat). Figuren, Handy-Chat, Auswahl, Aktionen – alles wie in jeder Story-Szene. Am Ende geht es zurück in den Hub.'));
    },

    // Platzhalter wie {name}: kurze Erklärung und Knöpfe zum Einfügen an der Cursor-Stelle
    placeholderHint(ta, save) {
      const names = new Set();
      const walk = (o, d) => { if (!o || typeof o !== 'object' || d > 14) return; if (Array.isArray(o)) { for (const x of o) walk(x, d + 1); return; } if (o.type === 'nameInput' && o.var) names.add(String(o.var)); for (const k in o) if (o[k] && typeof o[k] === 'object') walk(o[k], d + 1); };
      walk(VN.project.scenes, 0);
      const vars = VN.project.vars.map((v) => v.name).filter(Boolean).slice(0, 8);
      const ins = (k) => {
        const t = '{' + k + '}', a = ta.selectionStart != null ? ta.selectionStart : ta.value.length, b = ta.selectionEnd != null ? ta.selectionEnd : a;
        ta.value = ta.value.slice(0, a) + t + ta.value.slice(b);
        save(ta.value);
      };
      const chip = (k, cls) => el('button', { class: 'btn tiny ph-chip' + (cls ? ' ' + cls : ''), title: VN.t('An der Cursor-Stelle einfügen'), onmousedown: (e) => e.preventDefault(), onclick: () => ins(k) }, '{' + k + '}');
      return el('div', { class: 'ph-hint' },
        el('div', { class: 'muted small' }, VN.t('Platzhalter: {name} zeigt im Spiel den Namen, den der Spieler eingetippt hat (Aktion „✏ Namen eingeben lassen“). Geht auch im Sprecher-Feld und in Antworten. Variablen genauso, z. B. {Gold}.')),
        names.size || vars.length
          ? el('div', { class: 'row gap4', style: { flexWrap: 'wrap', marginTop: '4px' } }, ...[...names].map((k) => chip(k, 'primary')), ...vars.map((k) => chip(k)))
          : el('div', { class: 'muted small', style: { marginTop: '4px', fontStyle: 'italic' } }, VN.t('Noch kein Name abgefragt: Füge irgendwo die Aktion „✏ Namen eingeben lassen“ hinzu, z. B. an der ersten Dialogzeile.')));
    },

    // „Weiter erst, wenn …“ an einer Dialogzeile
    waitEditor(c) {
      const w = c.waitFor;
      const box = el('div', { class: 'opt-card' + (w ? ' wait-on' : '') },
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!w, onchange: (e) => VN.mutate(() => { if (e.target.checked) c.waitFor = { conds: [{ type: 'did', what: 'screen', key: 'inv' }], hint: VN.t('Öffne dein Inventar mit I.'), glow: 'inv', auto: false, before: true }; else delete c.waitFor; }) }),
          el('strong', null, VN.t('Weiter erst, wenn …'))),
        el('div', { class: 'muted small' }, VN.t('Das Spiel bleibt bei dieser Zeile stehen, bis der Spieler etwas getan hat – z. B. das Inventar geöffnet oder etwas angezogen. Gut für Tutorials im eigenen Spiel.')));
      if (!w) return box;
      w.conds = w.conds || [];
      box.append(
        VN.condEditor(w.conds, VN.t('Bedingung (alle müssen erfüllt sein)')),
        el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '90px' } }, VN.t('Hinweis')),
          el('input', { type: 'text', value: w.hint || '', placeholder: VN.t('z. B. Öffne dein Inventar mit I.'), style: { flex: '1' }, onchange: (e) => VN.mutate(() => { w.hint = e.target.value; }) })),
        el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '90px' } }, VN.t('Knopf leuchtet')),
          (() => { const s = el('select', { onchange: (e) => VN.mutate(() => { w.glow = e.target.value; }) }); for (const [k, l] of [['', VN.t('— keiner —')], ['inv', VN.t('Inventar')], ['menu', VN.t('Menü')]]) { const o = el('option', { value: k }, l); if (k === (w.glow || '')) o.selected = true; s.appendChild(o); } return s; })(),
          el('span', { class: 'muted small' }, VN.t('Hinweis')),
          (() => { const s = el('select', { onchange: (e) => VN.mutate(() => { w.pos = e.target.value; }) }); for (const [k, l] of [['top', VN.t('oben')], ['middle', VN.t('Mitte')]]) { const o = el('option', { value: k }, l); if (k === (w.pos || 'top')) o.selected = true; s.appendChild(o); } return s; })()),
        el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '90px' } }, VN.t('Wann')),
          (() => { const s = el('select', { style: { flex: '1' }, onchange: (e) => VN.mutate(() => { w.before = e.target.value === 'before'; }) }); for (const [k, l] of [['before', VN.t('Diese Zeile erst zeigen, wenn erledigt')], ['after', VN.t('Diese Zeile zeigen, dann warten')]]) { const o = el('option', { value: k }, l); if (k === (w.before ? 'before' : 'after')) o.selected = true; s.appendChild(o); } return s; })()),
        w.before ? null : el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!w.auto, onchange: (e) => VN.mutate(() => { w.auto = e.target.checked; }) }), VN.t('Danach automatisch weiter (sonst mit Klick)')),
        ...Inspector.waitWarnings(w));
      return box;
    },

    // Stolperfallen bei „Weiter erst, wenn …“
    waitWarnings(w) {
      const out = [];
      for (const c of w.conds || []) {
        const it = (c.type === 'did' && (c.what === 'use' || c.what === 'equip')) || c.type === 'worn' ? VN.project.items.find((x) => x.id === (c.key || c.item)) : null;
        if (c.type === 'did' && c.what === 'use' && it && it.slot && VN.Equip && VN.Equip.on()) out.push(el('div', { class: 'hint-box warn-box' }, VN.tf('„{name}“ ist ein Ausrüstungs-Gegenstand. Zum Anziehen besser „👕 Trägt Gegenstand“ nehmen – „benutzt“ heißt: im Inventar auf „Benutzen“ geklickt.', { name: it.name })));
        if (c.type === 'did' && c.what === 'use' && it && (!it.use || it.use.consume !== false)) out.push(el('div', { class: 'hint-box warn-box' }, VN.tf('Achtung: „{name}“ wird beim Benutzen verbraucht und ist danach weg. Ändern unter Spielsysteme → Gegenstände → Benutzen … → „Wird dabei verbraucht“.', { name: it.name })));
        if ((c.type === 'worn' || (c.type === 'did' && c.what === 'equip')) && !(VN.Equip && VN.Equip.on())) out.push(el('div', { class: 'hint-box warn-box' }, VN.t('Das Spielsystem „Ausrüstung“ ist aus – unter Spielsysteme → Übersicht einschalten.')));
      }
      return out;
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
        field('Bewegung (Idle)', select(o.idle || '', VN.HUB_IDLE, set(o, 'idle'))),
        o.idle ? el('div', { class: 'grid2' },
          range('Dauer', Number(o.idleSpeed) || 3, 0.3, 12, 0.1, (v) => v.toFixed(1) + ' s', set(o, 'idleSpeed')),
          range('Stärke', o.idleAmt != null ? Number(o.idleAmt) : 5, 0, 20, 0.5, (v) => String(v), set(o, 'idleAmt'))) : null,
        o.asset && window.Rig && Rig.has(o.asset) ? check('Mit Bones animieren (Atmen, Wackeln, Physik)', o.bones, set(o, 'bones')) : null,
        o.bones && o.asset && window.Rig && Rig.has(o.asset) ? field('Idle-Animation (Bones)', select(o.idleAnim || '', [['', '— nur Atmen / Physik —'], ...(VN.project.anims || []).filter((x) => x.type === 'idle').map((x) => [x.id, x.name])], set(o, 'idleAnim'))) : null,
        field('Hitbox-Form', select(o.shape || 'rect', [['rect', 'Rechteck'], ['ellipse', 'Ellipse']], set(o, 'shape'))),
        check('Unsichtbar im Spiel (nur Klickfläche, kein Rahmen, kein Leuchten, kein Name)', o.invisible, set(o, 'invisible')),
        VN.condEditor(o.conds || (o.conds = []), 'Objekt nur sichtbar, wenn'),
        el('div', { class: 'sec-title' }, 'Beim Klick'),
        window.Connect ? Connect.rulesUI(o) : null,
        VN.actionEditor(o.actions || (o.actions = []), 'Ausführen (z. B. Loot würfeln)'),
        field('Gehe zu Szene', VN.sceneSelect(o.target, set(o, 'target'), { exclude: s.id })),
        el('div', { class: 'row gap8', style: { flexWrap: 'wrap', marginTop: '-4px' } },
          el('button', { class: 'btn tiny', title: VN.t('Beim Klick läuft ein Dialog über dem Hub, danach geht es zurück'), onclick: () => VN.mutate(() => { const n = VN.newHubDialog(s, VN.t('Hub-Dialog') + ' · ' + (o.name || s.name)); o.target = n.id; }) }, '💬 + Timeline-Dialog beim Klick'),
          o.target && VN.scene(o.target) && VN.scene(o.target).overHub ? el('button', { class: 'btn tiny primary', onclick: () => App.openScene(o.target) }, '✏ Bearbeiten') : null),
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
          'Rahmen ziehen markiert mehrere Szenen, die du dann zusammen verschiebst (Umschalt/Strg + Klick = einzeln dazu, Strg + A = alle, Esc = aufheben). Ansicht verschieben: rechte oder mittlere Maustaste ziehen oder Leertaste + Ziehen. Mausrad zum Zoomen.'),
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
