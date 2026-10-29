// Editor-Bausteine für die Werkzeuge aus 0.4: Keyframes, Kamera, Video, Partikel, Filter,
// Tageszeit, Parallax, Masken-Übergänge, Text-Effekte, Chat, Zeitlimit, Stimm-Filter, Bibliothek
(function () {
  const { el } = VN;
  const field = (label, input) => el('div', { class: 'field' }, el('div', { class: 'lbl' }, label), input);
  const sel = (value, options, commit) => {
    const s = el('select', { onchange: (e) => commit(e.target.value) });
    for (const [v, l] of options) { const o = el('option', { value: v }, l); if (String(v) === String(value == null ? '' : value)) o.selected = true; s.appendChild(o); }
    return s;
  };
  const rng = (label, value, min, max, step, fmt, commit) => {
    const lab = el('div', { class: 'lbl' }, label + ': ' + fmt(value));
    return el('div', { class: 'field' }, lab, el('input', { type: 'range', min, max, step, value, oninput: (e) => { lab.textContent = label + ': ' + fmt(Number(e.target.value)); }, onchange: (e) => commit(Number(e.target.value)) }));
  };
  const check = (label, v, commit) => el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!v, onchange: (e) => commit(e.target.checked) }), label);
  const num = (v, commit, w) => el('input', { type: 'number', value: v, style: { width: (w || 58) + 'px' }, onchange: (e) => commit(Number(e.target.value)) });
  const set = (o, k) => (v) => VN.mutate(() => { o[k] = v; });
  const card = (title, ...c) => el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, title), ...c);
  // Motion Tile: Einstellungen für Hintergrund oder Parallax-Ebene
  const tileFields = (o, compact) => {
    const t = o.tile || {};
    const tset = (k) => (v) => VN.mutate(() => { o.tile = Object.assign({ on: true, dir: 'left', speed: 6, size: 100, mirror: false }, o.tile || {}); o.tile[k] = v; });
    const on = el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!t.on, onchange: (e) => tset('on')(e.target.checked) }), compact ? 'endlos scrollen' : 'Endlos scrollen (Motion Tile)');
    if (!t.on) return el('div', { class: 'tile-f' }, on);
    return el('div', { class: 'tile-f on' }, on,
      field('Richtung', sel(t.dir || 'left', Fx.TILE_DIRS, tset('dir'))),
      rng('Tempo', t.speed != null ? t.speed : 6, 0.5, 60, 0.5, (v) => (v < 3 ? 'sehr langsam' : v < 8 ? 'langsam' : v < 20 ? 'mittel' : 'schnell') + ' · ' + v, tset('speed')),
      rng('Kachelgröße', t.size != null ? t.size : 100, 20, 300, 5, (v) => v + ' %', tset('size')),
      el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!t.mirror, onchange: (e) => tset('mirror')(e.target.checked) }), 'Ränder spiegeln (für Bilder, die nicht nahtlos sind)'));
  };

  const Tools = (window.Tools = {
    // ---------- Keyframes ----------
    keysEditor(s, c, t) {
      const props = t.key === 'cam' ? [['zoom', 'Zoom %'], ['panX', 'Schwenk X'], ['panY', 'Schwenk Y'], ['rot', 'Drehung']] : VN.tbase(t) === 'fx' ? [['opacity', 'Deckkraft']] : [['x', 'X %'], ['y', 'Höhe %'], ['scale', 'Größe %'], ['rot', 'Drehung °'], ['opacity', 'Deckkraft']];
      const keys = (c.keys || []).slice().sort((a, b) => a.beat - b.beat);
      const beat = VN.ui.beat;
      const inClip = beat >= c.start && beat < c.start + c.len;
      const box = card('Bewegung (Keyframes)',
        el('div', { class: 'muted small' }, 'Ein Keyframe legt fest, wohin sich das Objekt bewegt, wenn der Spieler diesen Schritt erreicht. Die Kurve bestimmt, wie weich es dort ankommt.'));
      for (const k of keys) {
        const cur = k.beat === beat;
        const row = el('div', { class: 'kf-card' + (cur ? ' cur' : '') },
          el('div', { class: 'row gap8' },
            el('span', { class: 'kf-dia' }, '◆'),
            el('strong', { style: { flex: '1', cursor: 'pointer' }, onclick: () => { VN.ui.beat = k.beat; VN.render(); } }, 'Schritt ' + (k.beat + 1)),
            el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { c.keys = c.keys.filter((x) => x !== k); }) }, '×')),
          el('div', { class: 'kf-grid' }, ...props.map(([p, l]) => el('label', null, el('span', { class: 'muted small' }, l), num(k[p] != null ? k[p] : '', (v) => VN.mutate(() => { k[p] = v; }))))),
          el('div', { class: 'row gap8' },
            el('span', { class: 'muted small' }, 'Dauer'), num(k.dur != null ? k.dur : 0.8, (v) => VN.mutate(() => { k.dur = Math.max(0, v); }), 52), el('span', { class: 'muted small' }, 's'),
            sel(k.ease || 'ease-in-out', Fx.EASE_LIST, (v) => VN.mutate(() => { k.ease = v; }))),
          t.key === 'cam' ? el('div', { class: 'row gap8' }, el('span', { class: 'muted small' }, 'Wackeln'), num(k.shake || 0, (v) => VN.mutate(() => { k.shake = v; }), 52), el('span', { class: 'muted small' }, '(0–100)')) : null);
        box.appendChild(row);
      }
      box.appendChild(el('button', {
        class: 'btn tiny primary', disabled: !inClip || keys.some((k) => k.beat === beat),
        onclick: () => Story.addKey(c, t, beat)
      }, '◆ Keyframe bei Schritt ' + (beat + 1)));
      if (!inClip) box.appendChild(el('div', { class: 'muted small' }, 'Wähle oben im Lineal einen Schritt innerhalb dieses Clips.'));
      return box;
    },

    // ---------- Kamera ----------
    camInspector(s, c, t, timing) {
      return el('div', { class: 'insp' },
        el('div', { class: 'hint-box' }, 'Die Kamera bewegt die ganze Bühne: Hintergrund, Figuren und Effekte. Dialog und Buttons bleiben stehen. Mit Parallax-Ebenen (am Hintergrund) entsteht Tiefe.'),
        rng('Zoom', c.zoom != null ? c.zoom : 100, 100, 300, 1, (v) => v + ' %', set(c, 'zoom')),
        rng('Schwenk waagrecht', c.panX || 0, -40, 40, 0.5, (v) => v + ' %', set(c, 'panX')),
        rng('Schwenk senkrecht', c.panY || 0, -40, 40, 0.5, (v) => v + ' %', set(c, 'panY')),
        rng('Drehung', c.rot || 0, -20, 20, 0.5, (v) => v + '°', set(c, 'rot')),
        el('div', { class: 'grid2' },
          field('Fahrt-Dauer (s)', num(c.dur != null ? c.dur : 1, set(c, 'dur'), 80)),
          field('Kurve', sel(c.ease || 'ease-in-out', Fx.EASE_LIST, set(c, 'ease')))),
        el('div', { class: 'grid2' },
          field('Wackeln beim Start', num(c.shake || 0, set(c, 'shake'), 80)),
          field('Wackel-Dauer (s)', num(c.shakeDur || 0.5, set(c, 'shakeDur'), 80))),
        Tools.keysEditor(s, c, t),
        timing);
    },

    // ---------- Video ----------
    videoInspector(s, c, t, assetField, timing) {
      const anims = (VN.project.anims || []).filter((a) => a.type === 'scene');
      return el('div', { class: 'insp' },
        field('Quelle', sel(c.anim ? 'anim:' + c.anim : 'file', [['file', 'Videodatei (WebM/MP4)'], ...anims.map((a) => ['anim:' + a.id, '🎬 ' + a.name + ' (live)'])], (v) => VN.mutate(() => { if (v === 'file') delete c.anim; else c.anim = v.slice(5); }))),
        c.anim ? el('div', { class: 'muted small' }, 'Wird live aus dem Animations-Editor gezeichnet: scharf in jeder Auflösung und sehr klein.') : assetField('Video', 'video', c.asset, set(c, 'asset')),
        field('Art', sel(c.layer || 'front', [['front', 'Zwischensequenz (über allem)'], ['bg', 'Bewegter Hintergrund']], set(c, 'layer'))),
        field('Einpassen', sel(c.fit || 'cover', [['cover', 'Bild füllen'], ['contain', 'Ganz zeigen (Ränder)']], set(c, 'fit'))),
        rng('Lautstärke', c.vol != null ? c.vol : 90, 0, 100, 1, (v) => v + ' %', set(c, 'vol')),
        check('Ton aus', c.muted, set(c, 'muted')),
        check('Wiederholen (Loop)', c.loop, set(c, 'loop')),
        (c.layer || 'front') === 'front' ? check('Spiel wartet, bis das Video zu Ende ist', c.waitEnd !== false, set(c, 'waitEnd')) : null,
        (c.layer || 'front') === 'front' ? check('Mit Klick überspringbar', c.skippable !== false, set(c, 'skippable')) : null,
        el('div', { class: 'muted small' }, 'Formate: WebM oder MP4 (H.264). Zwischensequenzen aus dem Animations-Editor landen ebenfalls hier.'),
        timing);
    },

    // ---------- Effekt-Ebene: Farbe/Bild, Partikel oder Filter ----------
    fxMode(c) {
      const mode = c.particles ? 'particles' : c.filter ? 'filter' : c.eyes ? 'eyes' : 'layer';
      const box = el('div', { class: 'opt-card' },
        el('div', { class: 'seg' }, ...[['layer', 'Farbe / Bild'], ['particles', 'Partikel'], ['filter', 'Filter'], ['eyes', 'Augen']].map(([m, l]) => el('button', {
          class: mode === m ? 'active' : '',
          onclick: () => VN.mutate(() => { delete c.particles; delete c.filter; delete c.eyes; if (m === 'particles') Object.assign(c, { particles: 'rain' }, Fx.PART_DEF.rain); if (m === 'filter') c.filter = 'flashback'; if (m === 'eyes') Object.assign(c, Fx.EYE_DEF, { eyes: 'open' }); })
        }, l))));
      if (mode === 'particles') {
        box.append(
          field('Art', sel(c.particles, Fx.PARTICLES, (v) => VN.mutate(() => { Object.assign(c, Fx.PART_DEF[v], { particles: v }); }))),
          el('div', { class: 'grid2' },
            rng('Menge', c.density != null ? c.density : 50, 5, 100, 1, (v) => v + ' %', set(c, 'density')),
            rng('Tempo', c.speed != null ? c.speed : 40, 5, 100, 1, (v) => v + ' %', set(c, 'speed')),
            rng('Größe', c.size != null ? c.size : 40, 10, 100, 1, (v) => v + ' %', set(c, 'size')),
            rng('Wind', c.wind || 0, -60, 60, 1, (v) => v + ' %', set(c, 'wind'))),
          el('label', { class: 'd-color' }, el('input', { type: 'color', value: c.color || '#ffffff', onchange: (e) => set(c, 'color')(e.target.value) }), el('span', null, 'Farbe')));
      } else if (mode === 'eyes') {
        box.append(field('Art', sel(c.eyes, Fx.EYE_MODES, set(c, 'eyes'))),
          rng('Dauer', c.eyesDur != null ? c.eyesDur : 3, 0.5, 10, 0.1, (v) => v.toFixed(1) + ' s', set(c, 'eyesDur')),
          c.eyes !== 'blink' ? rng('Blinzler davor', c.eyesBlinks != null ? c.eyesBlinks : 2, 0, 4, 1, (v) => (v ? v + '×' : 'keine'), set(c, 'eyesBlinks')) : null,
          rng('Unschärfe', c.eyesBlur != null ? c.eyesBlur : 60, 0, 100, 5, (v) => (v ? v + ' %' : 'aus'), set(c, 'eyesBlur')),
          field('Lider', sel(c.eyesColor || 'black', [['black', 'Schwarz'], ['red', 'Rötlich (Licht scheint durch)']], set(c, 'eyesColor'))),
          el('div', { class: 'muted small' }, 'Sicht der Figur: „Öffnen“ beginnt mit geschlossenen Augen, blinzelt und wird langsam scharf. „Schließen“ endet schwarz, bis der Clip vorbei ist. Testen mit ▶ ab Schritt.'));
      } else if (mode === 'filter') {
        box.append(field('Filter', sel(c.filter, Fx.FILTERS, set(c, 'filter'))),
          el('div', { class: 'muted small' }, 'Der Filter färbt Hintergrund und Figuren um. „Rückblende“ bringt Sepia und weiche, helle Ränder mit.'));
      }
      return box;
    },

    // ---------- Hintergrund: Tageszeit, Licht, Parallax, Masken-Übergang ----------
    bgExtras(c) {
      c.layers = c.layers || [];
      return el('div', { class: 'insp', style: { gap: '10px' } },
        card('Tageszeit & Licht',
          field('Tageszeit', sel(c.daytime || '', Fx.DAYTIMES, set(c, 'daytime'))),
          rng('Figuren an das Licht anpassen', c.charLight || 0, 0, 100, 5, (v) => (v ? v + ' %' : 'aus'), set(c, 'charLight')),
          el('div', { class: 'muted small' }, 'Färbt Figuren passend zum Hintergrund ein, damit sie nicht wie aufgeklebt wirken.')),
        c.trans === 'mask' ? card('Masken-Übergang',
          field('Maske', sel(c.mask || 'wipe-right', [...Fx.MASKS, ['custom', 'Eigenes Schwarz-Weiß-Bild']], set(c, 'mask'))),
          c.mask === 'custom' ? field('Masken-Bild', VN.assetSelect('image', c.maskAsset, set(c, 'maskAsset'))) : null,
          rng('Weiche Kante', c.maskSoft != null ? c.maskSoft : 12, 2, 60, 1, (v) => v + ' %', set(c, 'maskSoft')),
          el('div', { class: 'muted small' }, 'Dunkle Stellen der Maske erscheinen zuerst, helle zuletzt.')) : null,
        card('Endlos scrollen',
          tileFields(c),
          el('div', { class: 'muted small' }, 'Das Bild wiederholt sich als Kachel und zieht endlos vorbei, z. B. Wolken, Himmel oder Landschaft aus dem Zugfenster. Gezeichnet wird nur, was im Fenster sichtbar ist. Am schönsten mit Bildern, deren Ränder zusammenpassen.')),
        card('Parallax (Tiefe bei Kamerafahrten)',
          rng('Tiefe des Hintergrunds', c.depth != null ? c.depth : 1, 0, 1.5, 0.05, (v) => v.toFixed(2), set(c, 'depth')),
          ...c.layers.map((L, i) => el('div', { class: 'par-item' }, el('div', { class: 'logic-row' },
            el('span', { class: 'mini-thumb', style: { backgroundImage: L.asset ? `url("${VN.assetUrl(L.asset)}")` : '' } }),
            VN.assetSelect('image', L.asset, (v) => VN.mutate(() => { L.asset = v; })),
            el('span', { class: 'muted small' }, 'Tiefe'), num(L.depth != null ? L.depth : 0.6, (v) => VN.mutate(() => { L.depth = v; }), 52),
            el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!L.front, onchange: (e) => VN.mutate(() => { L.front = e.target.checked; }) }), 'vorne'),
            el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { c.layers.splice(i, 1); }) }, '×')),
            tileFields(L, true))),
          el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { c.layers.push({ asset: null, depth: 0.6, front: false }); }) }, '+ Ebene'),
          el('div', { class: 'muted small' }, 'Tiefe 1 = bewegt sich wie die Figuren, 0 = steht still, über 1 = Vordergrund, der schneller vorbeizieht.')));
    },

    // ---------- Dialog: Text-Effekte, Chat, Tempo nach Stimme ----------
    textToolbar(ta, commit) {
      const wrap = (open, close) => () => {
        const a = ta.selectionStart, b = ta.selectionEnd;
        const v = ta.value;
        ta.value = v.slice(0, a) + open + v.slice(a, b) + (close || '') + v.slice(b);
        ta.focus();
        ta.selectionStart = a + open.length; ta.selectionEnd = b + open.length;
        commit(ta.value);
      };
      const btn = (label, title, fn) => el('button', { class: 'btn tiny', title, onmousedown: (e) => e.preventDefault(), onclick: fn }, label);
      const colorIn = el('input', { type: 'color', value: '#ff6060', title: 'Farbe für markierten Text', style: { width: '26px', height: '22px', padding: '0', border: '0' } });
      return el('div', { class: 'tt-bar' },
        btn('〰 Zittern', 'Markierten Text zittern lassen', wrap('{shake}', '{/shake}')),
        btn('∿ Welle', 'Markierten Text wellen lassen', wrap('{wave}', '{/wave}')),
        btn('✦ Leuchten', 'Markierten Text leuchten lassen', wrap('{glow}', '{/glow}')),
        btn('F', 'Fett', wrap('{b}', '{/b}')),
        btn('K', 'Kursiv', wrap('{i}', '{/i}')),
        btn('Groß', 'Größer', wrap('{big}', '{/big}')),
        btn('Langsam', 'Langsamer tippen', wrap('{slow}', '{/slow}')),
        btn('Pause', 'Kurze Pause an dieser Stelle', wrap('{pause=0.6}')),
        el('span', { class: 'row gap4' }, colorIn, btn('Farbe', 'Markierten Text einfärben', () => wrap('{color=' + colorIn.value + '}', '{/color}')())));
    },
    dialogExtras(s, c) {
      const hasVoice = (s.tracks.voice || []).some((v) => v.start === c.start && v.asset);
      return el('div', { class: 'opt-card' },
        check('Als Handy-Nachricht zeigen (Chat-Modus)', c.chat, set(c, 'chat')),
        c.chat ? field('Wer bin „ich“? (Nachrichten rechts)', el('input', { type: 'text', value: (VN.project.chat && VN.project.chat.me) || '', placeholder: 'Sprechername, z. B. Ray', onchange: (e) => VN.mutate(() => { VN.project.chat.me = e.target.value.trim(); }) })) : null,
        check('Text-Tempo an die Sprachaufnahme anpassen', c.syncVoice, set(c, 'syncVoice')),
        c.syncVoice && !hasVoice ? el('div', { class: 'muted small' }, 'Auf diesem Schritt liegt noch keine Voice.') : null);
    },

    choiceTimer(c) {
      return el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Zeitlimit'),
        rng('Zeit zum Entscheiden', c.timer || 0, 0, 30, 1, (v) => (v ? v + ' s' : 'kein Limit'), set(c, 'timer')),
        c.timer ? field('Wenn die Zeit abläuft', sel(c.timeoutIdx || 0, c.options.map((o, i) => [i, 'Antwort ' + (i + 1) + ': ' + Fx.plain(o.text || '')]), (v) => VN.mutate(() => { c.timeoutIdx = Number(v); }))) : null);
    },
    voiceFx(c) {
      return field('Stimm-Filter', el('div', { class: 'row gap4' }, sel(c.vfx || '', Fx.VOICE_FX, set(c, 'vfx')),
        el('button', { class: 'btn tiny', title: 'Mit Filter anhören', onclick: () => Tools.previewVoice(c) }, '▶')));
    },
    previewVoice(c) {
      VN.stopPreview();
      if (Tools._pv) Tools._pv.pause();
      const a = Tools._pv = new Audio();
      a.crossOrigin = 'anonymous';
      a.src = VN.assetUrl(c.asset);
      Fx.route(a, c.vfx, 0.9);
      if (c.in) a.currentTime = c.in;
      a.play().catch(() => {});
      if (c.out) { const chk = () => { if (a.paused) return; if (a.currentTime >= c.out) a.pause(); else requestAnimationFrame(chk); }; requestAnimationFrame(chk); }
    },
    musicMode(c) {
      return field('Übergang zur vorherigen Musik', sel(c.xmode || 'cross', [['cross', 'Überblenden'], ['seq', 'Erst aus, dann ein'], ['cut', 'Harter Schnitt']], set(c, 'xmode')));
    },

    // ---------- Animationen am Figuren-Clip (Idle, Gesten) ----------
    animFields(s, c) {
      if (!c.asset || !VN.project.rigs[c.asset] || c.set) return null;
      const all = VN.project.anims || [];
      const idles = all.filter((a) => a.type === 'idle'), gests = all.filter((a) => a.type === 'gesture');
      const beat = VN.ui.beat >= c.start && VN.ui.beat < c.start + c.len ? VN.ui.beat : c.start;
      const box = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Animation (Bones)'),
        field('Idle-Animation (Dauer-Schleife)', sel(c.idleAnim || '', [['', '— nur Atmen/Schwanken —'], ...idles.map((a) => [a.id, '∞ ' + a.name])], (v) => VN.mutate(() => { if (v) c.idleAnim = v; else delete c.idleAnim; }))),
        field('Geste bei Schritt ' + (beat + 1), sel((c.gestures || {})[beat] || '', [['', '— keine —'], ...gests.map((a) => [a.id, '✋ ' + a.name])], (v) => VN.mutate(() => { c.gestures = c.gestures || {}; if (v) c.gestures[beat] = v; else delete c.gestures[beat]; }))));
      if (!all.length) box.appendChild(el('div', { class: 'muted small' }, 'Bewegungen baust du oben im Reiter „Animation“.'));
      box.appendChild(el('button', { class: 'btn tiny', onclick: () => { VN.ui.view = 'anim'; VN.render(); } }, 'Animations-Editor öffnen'));
      return box;
    },

    // ---------- Ebenen-Figur am Clip ----------
    figureFields(s, c) {
      const figs = VN.project.figures || [];
      const box = el('div', { class: 'opt-card' },
        field('Art der Figur', sel(c.set ? 'set:' + c.set : 'img', [['img', 'Einzelnes Bild'], ...figs.map((f) => ['set:' + f.id, '◆ ' + f.name + ' (Ebenen)'])], (v) => VN.mutate(() => { if (v === 'img') delete c.set; else { c.set = v.slice(4); c.pick = c.pick || {}; } }))));
      if (!figs.length) box.appendChild(el('div', { class: 'muted small' }, 'Ebenen-Figuren (Körper, Gesicht, Outfit) legst du oben unter „Figuren“ an.'));
      const f = c.set && Stage.figure(c.set);
      if (!f) return box;
      const beat = VN.ui.beat >= c.start && VN.ui.beat < c.start + c.len ? VN.ui.beat : c.start;
      const picks = Stage.figurePicks(c, beat);
      box.appendChild(el('div', { class: 'muted small' }, beat === c.start ? 'Auswahl zu Beginn des Clips:' : 'Ab Schritt ' + (beat + 1) + ' (◆ auf dem Clip):'));
      for (const L of f.layers) {
        box.appendChild(field(L.name + (L.varBind ? ' (folgt Variable)' : ''), sel(picks[L.id] || '', L.options.map((o) => [o.id, o.name]), (v) => VN.mutate(() => {
          if (beat === c.start) { c.pick = c.pick || {}; c.pick[L.id] = v; } else { c.picks = c.picks || {}; c.picks[beat] = Object.assign(c.picks[beat] || {}, { [L.id]: v }); }
        }))));
      }
      if (c.picks && c.picks[beat]) box.appendChild(el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { delete c.picks[beat]; }) }, 'Änderung bei Schritt ' + (beat + 1) + ' entfernen'));
      return box;
    },

    // ---------- Bibliothek: Effekte zum Hineinziehen ----------
    PRESETS: [
      ['Partikel', [
        ...Fx.PARTICLES.map(([k, l]) => ({ icon: { rain: '🌧', snow: '❄', dust: '·', sparks: '✦', petals: '🌸', fireflies: '✧' }[k], label: l, track: 'fx', data: Object.assign({ particles: k }, Fx.PART_DEF[k]) }))]],
      ['Filter', Fx.FILTERS.map(([k, l]) => ({ icon: '◐', label: l, track: 'fx', data: { filter: k } }))],
      ['Augen', [
        { icon: '👁', label: 'Aufwachen', track: 'fx', data: { eyes: 'open', eyesDur: 4, eyesBlinks: 2, eyesBlur: 70, eyesColor: 'red' }, len: 1 },
        { icon: '😵', label: 'Ohnmacht', track: 'fx', data: { eyes: 'close', eyesDur: 2.2, eyesBlinks: 2, eyesBlur: 80, eyesColor: 'black' }, len: 1 },
        { icon: '😴', label: 'Einschlafen', track: 'fx', data: { eyes: 'close', eyesDur: 5, eyesBlinks: 3, eyesBlur: 40, eyesColor: 'black' }, len: 1 },
        { icon: '😉', label: 'Blinzeln', track: 'fx', data: { eyes: 'blink', eyesDur: 0.6, eyesBlinks: 0, eyesBlur: 10, eyesColor: 'black' }, len: 1 }]],
      ['Hintergrund (auf einen Hintergrund-Clip ziehen)', [
        { icon: '☁', label: 'Wolken ziehen (langsam)', track: 'bg', merge: true, data: { tile: { on: true, dir: 'left', speed: 2.5, size: 100, mirror: false } } },
        { icon: '🚂', label: 'Fahrt (Zugfenster)', track: 'bg', merge: true, data: { tile: { on: true, dir: 'left', speed: 35, size: 100, mirror: true } } },
        { icon: '🌊', label: 'Wasser / Strömung', track: 'bg', merge: true, data: { tile: { on: true, dir: 'downright', speed: 5, size: 60, mirror: true } } },
        { icon: '✶', label: 'Sterne wandern', track: 'bg', merge: true, data: { tile: { on: true, dir: 'upleft', speed: 1, size: 120, mirror: false } } },
        { icon: '■', label: 'Endlos aus', track: 'bg', merge: true, data: { tile: { on: false } } }]],
      ['Kamera', [
        { icon: '🔍', label: 'Zoom aufs Gesicht', track: 'cam', data: { zoom: 170, panX: 0, panY: -14, dur: 1.4 } },
        { icon: '↔', label: 'Langsamer Schwenk', track: 'cam', data: { zoom: 125, panX: -8, panY: 0, dur: 1, keys: [] }, len: 2 },
        { icon: '💥', label: 'Wackeln (Explosion)', track: 'cam', data: { zoom: 104, shake: 80, shakeDur: 0.7, dur: 0.1 }, len: 1 },
        { icon: '🎬', label: 'Weite Totale', track: 'cam', data: { zoom: 100, panX: 0, panY: 0, dur: 1.5 } },
        { icon: '⟲', label: 'Schräg (Dutch Angle)', track: 'cam', data: { zoom: 115, rot: -6, dur: 1 } }]]
    ],
    // ---------- Rezepte: fertige Kombinationen für typische Momente, an der aktuellen Stelle einfügen ----------
    RECIPES: [
      { icon: '🕰', label: 'Rückblende', desc: 'Sepia-Filter bis zum Ende der Szene, Wechsel über Schwarz', apply: (s, b, R) => { R.fx(s, b, { filter: 'flashback' }, s.beats - b); R.bgTrans(s, b, 'black', 1.2); } },
      { icon: '👁', label: 'Aufwachen', desc: 'Rote Lider, zweimal blinzeln, langsam scharf', apply: (s, b, R) => R.fx(s, b, { eyes: 'open', eyesDur: 4, eyesBlinks: 2, eyesBlur: 70, eyesColor: 'red' }, 1) },
      { icon: '😵', label: 'Ohnmacht', desc: 'Kamera kippt leicht, Augen fallen zu', apply: (s, b, R) => { R.cam(s, b, { zoom: 112, rot: -5, panY: 4, dur: 2, ease: 'ease-in' }, 1); R.fx(s, b, { eyes: 'close', eyesDur: 2.2, eyesBlinks: 2, eyesBlur: 80, eyesColor: 'black' }, 1); } },
      { icon: '💥', label: 'Explosion', desc: 'Starkes Wackeln und Funken', apply: (s, b, R) => { R.cam(s, b, { zoom: 106, shake: 85, shakeDur: 0.8, dur: 0.1 }, 1); R.fx(s, b, Object.assign({ particles: 'sparks' }, Fx.PART_DEF.sparks, { density: 90, speed: 70 }), 1); } },
      { icon: '🚂', label: 'Fahrt (Zug, Kutsche)', desc: 'Hintergrund zieht schnell endlos vorbei, leichtes Rütteln', apply: (s, b, R) => { R.tile(s, b, { on: true, dir: 'left', speed: 35, size: 100, mirror: true }); R.cam(s, b, { zoom: 104, shake: 8, shakeDur: 30, dur: 0.5 }, s.beats - b); } },
      { icon: '🌧', label: 'Nachts im Regen', desc: 'Nacht, Figuren im passenden Licht, Regen', apply: (s, b, R) => { R.bgSet(s, b, { daytime: 'night', charLight: 60 }); R.fx(s, b, Object.assign({ particles: 'rain' }, Fx.PART_DEF.rain), s.beats - b); } },
      { icon: '🔍', label: 'Dramatischer Zoom', desc: 'Kamera fährt aufs Gesicht', apply: (s, b, R) => R.cam(s, b, { zoom: 175, panX: 0, panY: -16, dur: 1.2, ease: 'ease-in' }, 1) },
      { icon: '💭', label: 'Traum', desc: 'Weicher Traum-Filter mit schwebendem Staub', apply: (s, b, R) => { R.fx(s, b, { filter: 'dream' }, s.beats - b); R.fx(s, b, Object.assign({ particles: 'dust' }, Fx.PART_DEF.dust, { density: 70 }), s.beats - b); } }
    ],
    // Bausteine für Rezepte: freie Effekt-Ebene suchen (oder neue anlegen), Kamera, Hintergrund ändern
    recipeKit() {
      const R = {
        free(s, base, b, len) {
          const keys = VN.tracksOf(s).filter((t) => t.base === base).map((t) => t.key);
          for (const k of keys) if (!(s.tracks[k] || []).some((c) => c.start < b + len && b < c.start + c.len)) return k;
          if (!VN.XTRACK_KINDS[base]) return keys[0];
          const key = 'x_' + VN.uid('t').slice(-6);
          s.xtracks = s.xtracks || [];
          s.xtracks.push({ key, base, name: (VN.XTRACK_KINDS[base].label.split(' /')[0]) + ' ' + (s.xtracks.filter((x) => x.base === base).length + 2) });
          s.tracks[key] = [];
          return key;
        },
        fx(s, b, data, len) { len = Math.max(1, len || 1); const k = R.free(s, 'fx', b, len); s.tracks[k].push(Object.assign({ id: VN.uid('c'), start: b, len, trans: 'fade', dur: 0.6 }, JSON.parse(JSON.stringify(data)))); },
        cam(s, b, data, len) { len = Math.max(1, len || 1); s.tracks.cam = s.tracks.cam.filter((c) => !(c.start < b + len && b < c.start + c.len)); s.tracks.cam.push(Object.assign({ id: VN.uid('c'), start: b, len, zoom: 100, panX: 0, panY: 0, rot: 0, shake: 0, dur: 1, ease: 'ease-in-out', keys: [] }, data)); },
        bgAt(s, b) { return Stage.clipAt(s.tracks.bg, b); },
        bgSet(s, b, data) { const c = R.bgAt(s, b); if (c) Object.assign(c, data); },
        bgTrans(s, b, trans, dur) { const c = R.bgAt(s, b); if (c && c.start === b) Object.assign(c, { trans, dur }); },
        tile(s, b, tile) { const c = R.bgAt(s, b); if (c) c.tile = Object.assign({}, tile); }
      };
      return R;
    },
    applyRecipe(r) {
      const s = VN.curScene && VN.curScene();
      if (!s || s.type !== 'story') return VN.toast('Erst eine Story-Szene öffnen');
      const b = Math.min(VN.ui.beat || 0, Math.max(0, s.beats - 1));
      VN.mutate(() => { r.apply(s, b, Tools.recipeKit()); s.beats = Math.max(s.beats, b + 1); });
      VN.toast('Rezept „' + r.label + '“ bei Schritt ' + (b + 1) + ' eingefügt');
    },

    library(list) {
      list.className = 'asset-list fx-lib';
      list.appendChild(el('div', { class: 'lib-head' }, 'Rezepte (an der aktuellen Stelle einfügen)'));
      for (const r of Tools.RECIPES) {
        list.appendChild(el('div', { class: 'lib-item recipe', title: r.desc },
          el('span', { class: 'lib-ico' }, r.icon),
          el('span', { class: 'rc-txt' }, el('span', null, r.label), el('span', { class: 'muted small' }, r.desc)),
          el('button', { class: 'btn tiny', onclick: (e) => { e.stopPropagation(); Tools.applyRecipe(r); } }, 'Einfügen')));
      }
      for (const [group, items] of Tools.PRESETS) {
        list.appendChild(el('div', { class: 'lib-head' }, group));
        for (const it of items) {
          const n = el('div', { class: 'lib-item', draggable: 'true', title: it.label + ' – auf die ' + (it.track === 'cam' ? 'Kamera-Spur' : it.track === 'bg' ? 'Hintergrund-Spur' : 'Effekt-Ebene') + ' ziehen' }, el('span', { class: 'lib-ico' }, it.icon), el('span', null, it.label));
          n.addEventListener('dragstart', (e) => { e.dataTransfer.setData('vn/fxpreset', JSON.stringify(it)); e.dataTransfer.effectAllowed = 'copy'; });
          list.appendChild(n);
        }
      }
    }
  });
})();
