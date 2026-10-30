// Spiel-Player · Menü-Bildschirme: Speichern/Laden, Einstellungen (Ton, Grafik, Sprache)
// Wird von player.js mit VN.PlayerMenus(host) eingebunden.
(function () {
  const { el } = VN;
  VN.PlayerMenus = (H) => {
    const R = H.run;
    async function saveScreen(mode, fromMenu) {
      if (R()) R().overlay = 'saves';
      H.setPanelKind('save');
      const all = H.store() ? await H.store().list() : {};
      const grid = el('div', { class: 'save-grid' });
      const slots = (mode === 'load' ? ['auto', 'quick'] : []).concat(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
      for (const slot of slots) {
        const d = all[slot];
        const label = slot === 'auto' ? 'Autosave' : slot === 'quick' ? 'Schnellspeicher' : 'Platz ' + slot;
        const card = el('div', { class: 'save-card' + (d ? '' : ' empty') + (mode === 'load' && !d ? ' off' : '') },
          el('div', { class: 'save-thumb', style: d && d.bg ? { backgroundImage: `url("${VN.assetUrl(d.bg)}")` } : null }),
          el('div', { class: 'save-meta' },
            el('strong', null, label),
            d ? el('div', null, d.sceneName || '') : el('div', { class: 'muted' }, 'leer'),
            d ? el('div', { class: 'muted' }, new Date(d.time).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })) : null,
            d && d.text ? el('div', { class: 'save-text' }, '„' + d.text + '“') : null));
        if (d && slot !== 'auto' && slot !== 'quick') card.appendChild(el('button', { class: 'save-del', title: 'Löschen', onclick: async (e) => { e.stopPropagation(); await H.store().remove(slot); saveScreen(mode, fromMenu); } }, '×'));
        card.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (mode === 'save') { await H.store().write(slot, H.makeSave()); H.uiSound('save'); VN.toast('Gespeichert: ' + label); saveScreen(mode, fromMenu); }
          else if (d) { H.closeOverlay(); H.loadSave(d); }
        });
        grid.appendChild(card);
      }
      H.panel(mode === 'save' ? 'Spiel speichern' : 'Spielstand laden',
        H.store() ? grid : el('div', null, 'Speichern ist hier nicht verfügbar.'),
        modRows(),
        H.sysBtn('Zurück', () => (fromMenu ? H.closeOverlay() : (R() ? (R().overlay = null, H.pauseMenu()) : H.closeOverlay()))));
    }
    // Mod-Liste (nur wenn das Spiel Mods erlaubt und welche gefunden wurden)
    function modRows() {
      const mods = (window.VNPlugin && VNPlugin.mods || []).filter((m) => m.allowedByGame);
      if (!mods.length) return null;
      const st = VNPlugin.modStore();
      return el('div', { class: 'set-mods' }, el('div', { class: 'set-row' }, el('strong', null, 'Mods'), el('span', { class: 'set-val' }, 'wirkt nach Neustart'), el('span')),
        ...mods.map((m) => el('div', { class: 'set-row' }, el('span', null, m.file.replace(/\.js$/i, '')), el('input', { type: 'checkbox', checked: !!(st[m.file] && st[m.file].on && st[m.file].hash === m.hash), onchange: (e) => { const s2 = VNPlugin.modStore(); s2[m.file] = { hash: m.hash, on: e.target.checked }; VNPlugin.modSave(s2); } }), el('span'))));
    }

    // Grafik-Einstellungen: Qualitätsstufe, bei "Eigene" einzelne Schalter
    function graphicsRows() {
      if (!window.Perf) return null;
      const box = el('div', { class: 'set-gfx' });
      const S = VN.settings;
      const selRow = (label, value, opts, on) => el('div', { class: 'set-row' }, el('span', null, label),
        el('select', { class: 'set-select', onchange: (e) => { on(e.target.value); H.saveSettings(); Perf.applyLive(); draw(); } },
          ...opts.map(([v, l]) => { const o = el('option', { value: v }, l); if (String(v) === String(value)) o.selected = true; return o; })), el('span'));
      const draw = () => {
        box.innerHTML = '';
        const q = S.quality || 'auto';
        box.appendChild(selRow('Grafikqualität', q, [['auto', 'Auto (empfohlen)'], ['low', 'Niedrig'], ['mid', 'Mittel'], ['high', 'Hoch'], ['ultra', 'Ultra'], ['custom', 'Eigene']], (v) => {
          if (v === 'custom') { const k = Perf.cfg(); Object.assign(S, { qParts: k.parts, qBlur: k.blur, qBonesFps: k.bonesFps }); }
          else if (v !== 'auto') Perf.level = v;
          S.quality = v;
        }));
        if (q === 'auto') box.appendChild(el('div', { class: 'set-note' }, 'Passt sich automatisch an deinen Rechner an. Gerade: ' + Perf.LEVELS[Perf.level].label + '.'));
        if (q === 'custom') {
          box.appendChild(selRow('Partikel', S.qParts, [[0, 'Aus'], [0.35, 'Wenig'], [0.65, 'Mittel'], [1, 'Normal']], (v) => { S.qParts = Number(v); }));
          box.appendChild(selRow('Unschärfe-Effekte', S.qBlur === false ? 0 : 1, [[1, 'An'], [0, 'Aus']], (v) => { S.qBlur = v === '1'; }));
          box.appendChild(selRow('Bildrate Figuren', S.qBonesFps, [[20, '20'], [30, '30'], [60, '60'], [0, 'Maximal']], (v) => { S.qBonesFps = Number(v); }));
        }
        box.appendChild(selRow('Bildrate begrenzen', S.fpsCap || 0, [[0, 'Aus'], [30, '30 fps'], [60, '60 fps']], (v) => { S.fpsCap = Number(v); }));
      };
      draw();
      return box;
    }

    // Ton: Ausgabegerät, Mono, Testton
    function audioRows() {
      if (!VN.Audio) return null;
      const S = VN.settings;
      const box = el('div', { class: 'set-gfx' });
      VN.Audio.select(S.audioOut || '', (v) => { S.audioOut = v; H.saveSettings(); VN.Audio.refresh(); }).then((sel) => {
        box.prepend(el('div', { class: 'set-row' }, el('span', null, 'Tonausgabe'), sel,
          el('button', { class: 'sys-btn small', onclick: (e) => { e.stopPropagation(); VN.Audio.test(); } }, 'Test')));
      });
      box.appendChild(el('div', { class: 'set-row' }, el('span', null, 'Mono-Ton'), el('input', {
        type: 'checkbox', checked: !!S.mono, onchange: (e) => { S.mono = e.target.checked; H.saveSettings(); VN.Audio.refresh(); }
      }), el('span')));
      return box;
    }

    function settingsScreen(fromMenu) {
      if (R()) R().overlay = 'settings';
      H.setPanelKind('settings');
      const p = VN.project;
      const slider = (label, key, min, max, fmt) => {
        const lab = el('span', { class: 'set-val' }, fmt(VN.settings[key]));
        return el('div', { class: 'set-row' }, el('span', null, label), el('input', {
          type: 'range', min, max, value: VN.settings[key],
          oninput: (e) => {
            VN.settings[key] = Number(e.target.value);
            lab.textContent = fmt(VN.settings[key]);
            if (key === 'music' && H.A.music) H.A.music.audio.volume = Math.min(1, (H.A.music.base || 0.7) * H.volOf('music'));
            H.saveSettings();
            if ((key === 'master' || key === 'ui') && VN.Audio) VN.Audio.refresh();
          }
        }), lab);
      };
      const langSel = p.languages.length > 1 ? el('select', {
        class: 'set-select', onchange: (e) => { VN.lang = e.target.value; VN.settings.lang = VN.lang; H.saveSettings(); if (R()) H.refreshTexts(); if (VN.I18n) VN.I18n.refresh(document.getElementById('player')); }
      }, ...p.languages.map((l) => { const o = el('option', { value: l }, l.toUpperCase()); if (l === (VN.lang || p.languages[0])) o.selected = true; return o; })) : null;
      if (VN.settings.master == null) VN.settings.master = 100;
      if (VN.settings.ui == null) VN.settings.ui = VN.settings.sfx != null ? VN.settings.sfx : 90;
      H.panel('Einstellungen',
        slider('Gesamtlautstärke', 'master', 0, 100, (v) => v + ' %'),
        slider('Musik', 'music', 0, 100, (v) => v + ' %'),
        slider('Stimmen', 'voice', 0, 100, (v) => v + ' %'),
        slider('Soundeffekte', 'sfx', 0, 100, (v) => v + ' %'),
        slider('Menü-Töne', 'ui', 0, 100, (v) => v + ' %'),
        audioRows(),
        slider('Textgeschwindigkeit', 'text', 25, 300, (v) => (v >= 300 ? 'sofort' : v + ' %')),
        langSel ? el('div', { class: 'set-row' }, el('span', null, 'Sprache'), langSel, el('span')) : null,
        graphicsRows(),
        H.sysBtn('Lesen & Barrierefreiheit …', () => H.a11y(fromMenu)),
        VN.api && VN.api.fullscreen ? el('div', { class: 'set-row' }, el('span', null, 'Vollbild'), el('input', {
          type: 'checkbox', checked: !!VN.settings.fullscreen, onchange: async (e) => { VN.settings.fullscreen = e.target.checked; H.saveSettings(); await VN.api.fullscreen(VN.settings.fullscreen); }
        }), el('span')) : null,
        VN.Combat && VN.Combat.on() && VN.Combat.cfg().story !== false ? el('div', { class: 'set-row' }, el('span', null, 'Story-Modus (leichtere Kämpfe)'), el('input', {
          type: 'checkbox', checked: !!VN.settings.storyMode, onchange: (e) => { VN.settings.storyMode = e.target.checked; H.saveSettings(); }
        }), el('span')) : null,
        H.sysBtn('Zurück', () => (fromMenu ? H.closeOverlay() : (R() ? (R().overlay = null, H.pauseMenu()) : H.closeOverlay()))));
    }

    return { saveScreen, settingsScreen };
  };
})();
