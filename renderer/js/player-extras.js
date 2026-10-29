// Spieler-Bildschirme und Komfort: Verlauf, Auto-Modus, Überspringen, Galerie, Erfolge, Werte,
// Namen eingeben, Gegenstände benutzen/kombinieren, Geräusch-Untertitel, Vorlesen.
// Wird von player.js mit VN.PlayerExtras(H) eingebunden.
(function () {
  const { el } = VN;
  const X = () => VN.Extras;

  VN.PlayerExtras = (H) => {
    const R = H.run;
    const S = () => VN.settings;

    // ---------- Verlauf ----------
    const logLine = (clip, speaker, text) => {
      const r = R();
      if (!r || !text) return;
      const rs = r.rs;
      rs.log = rs.log || [];
      let v = null;
      const s = VN.scene(r.scene);
      if (s && s.type === 'story' && !r.event) {
        const vc = (s.tracks.voice || []).find((x) => x.start === r.beat && x.asset);
        if (vc) v = { a: vc.asset, i: vc.in || 0, o: vc.out || 0, vol: vc.vol };
      }
      const last = rs.log[rs.log.length - 1];
      if (last && last.id === clip.id && last.tx === text) return;
      rs.log.push({ id: clip.id, sp: speaker || '', tx: text, col: clip.color || '', v });
      if (rs.log.length > 150) rs.log.splice(0, rs.log.length - 150);
    };
    const logScreen = (back) => new Promise((resolve) => {
      const r = R();
      if (r) r.overlay = 'log';
      H.setPanelKind('pause');
      const list = el('div', { class: 'bl-list' });
      for (const e of (r && r.rs.log) || []) {
        list.appendChild(el('div', { class: 'bl-row' },
          el('div', { class: 'bl-who', style: { color: e.col || '' } }, e.sp),
          el('div', { class: 'bl-text' }, Fx.plain(e.tx)),
          e.v ? el('button', { class: 'bl-play', title: 'Stimme abspielen', 'aria-label': 'Stimme abspielen', onclick: (ev) => { ev.stopPropagation(); H.A.stopVoice(); H.A.playOnce(e.v.a, e.v.vol, 0, 'voice', e.v.i, e.v.o, null); } }, '▶') : el('span')));
      }
      if (!list.children.length) list.appendChild(el('div', { style: { opacity: '0.7', textAlign: 'center' } }, 'Noch nichts gelesen.'));
      const done = () => { H.A.stopVoice(); if (R()) R().overlay = null; if (back) H.pauseMenu(); else H.closeOverlay(); resolve(); };
      H.panel('Verlauf', list, H.sysBtn('Zurück', done));
      requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
    });

    // ---------- Gelesen merken, Auto-Modus, Überspringen ----------
    const markRead = () => { const r = R(); if (r && r.curLine) X().mark('read', r.curLine); };
    let tick = 0, autoAt = 0, autoKey = '', skipHeld = false, lastSkip = 0;
    const mode = { auto: false, skip: false };
    const canStep = (r) => r && !r.ended && !r.overlay && !r.blocked && !r.choicesShown && !r.holding && !H.stage().querySelector('.gl-pop, .plugin-overlay, .pl-name-ask, .wm-screen, .ql-screen') && (r.curLine || r.message);
    const loop = () => {
      const r = R();
      if (!r) return;
      const skipping = (mode.skip || skipHeld) && !r.overlay;
      if (skipping) {
        if (!canStep(r)) { if (r.choicesShown || (VN.scene(r.scene) || {}).type === 'hub') stopModes(); return; }
        const now = performance.now();
        if (now - lastSkip < 70) return;
        if (!S().skipUnread && r.curLine && !X().P().read[r.curLine] && !r.typing && !r.message) { stopModes(); VN.toast('Ungelesener Text – Überspringen angehalten'); return; }
        lastSkip = now;
        H.advance();
        return;
      }
      if (mode.auto) {
        if (!canStep(r) || r.typing || H.A.ducked) { autoAt = 0; return; }
        const key = r.scene + '|' + r.beat + '|' + (r.curLine || '') + '|' + (r.event ? r.event.i : '');
        if (key !== autoKey || !autoAt) {
          autoKey = key;
          const len = r.curText ? Fx.plain(r.curText).length : 20;
          const f = 100 / Math.max(25, S().autoSpeed || 100);
          autoAt = performance.now() + (900 + len * 45) * f;
          return;
        }
        if (performance.now() >= autoAt) { autoAt = 0; autoKey = ''; H.advance(); }
      }
    };
    const startLoop = () => { clearInterval(tick); tick = setInterval(loop, 40); };
    const stopLoop = () => { clearInterval(tick); tick = 0; stopModes(); };
    const stopModes = () => { mode.auto = false; mode.skip = false; skipHeld = false; drawCtrl(); };
    const ctrlBox = el('span', { class: 'pl-ctrl-x' });
    const drawCtrl = () => {
      ctrlBox.innerHTML = '';
      ctrlBox.append(
        el('button', { class: mode.auto ? 'on' : '', title: 'Automatisch weiterlesen (A)', onclick: (e) => { e.stopPropagation(); mode.auto = !mode.auto; mode.skip = false; autoAt = 0; drawCtrl(); } }, 'Auto'),
        el('button', { class: mode.skip ? 'on' : '', title: 'Überspringen (S, oder Strg gedrückt halten)', onclick: (e) => { e.stopPropagation(); mode.skip = !mode.skip; mode.auto = false; drawCtrl(); } }, 'Skip'),
        el('button', { title: 'Verlauf (L oder Mausrad hoch)', onclick: (e) => { e.stopPropagation(); if (R() && !R().overlay) logScreen(false); } }, 'Verlauf'));
    };
    drawCtrl();
    const onKey = (e) => {
      const r = R();
      if (!r || e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return false;
      if (e.key === 'Control') { if (!r.overlay) { skipHeld = true; } return false; }
      const k = e.key.toLowerCase();
      if (r.overlay) return false;
      if (k === 'a') { mode.auto = !mode.auto; mode.skip = false; autoAt = 0; drawCtrl(); return true; }
      if (k === 's') { mode.skip = !mode.skip; mode.auto = false; drawCtrl(); return true; }
      if (k === 'l') { logScreen(false); return true; }
      if (k === 'c' && X().statsOn()) { statsScreen(false); return true; }
      return false;
    };
    const onKeyUp = (e) => { if (e.key === 'Control') skipHeld = false; };
    const onWheel = (e) => { const r = R(); if (r && !r.overlay && e.deltaY < 0 && !e.target.closest('.pl-overlay, .plugin-overlay, .bl-list')) logScreen(false); };

    // ---------- Galerie ----------
    const galleryScreen = (fromMenu) => new Promise((resolve) => {
      const r = R();
      if (r) r.overlay = 'gallery';
      H.setPanelKind('pause');
      const P = X().P();
      let tab = X().galleryImages().length ? 'img' : X().galleryMusic().length ? 'music' : 'scene';
      let playing = null, played = false;
      const body = el('div', { class: 'gal-body' });
      const tabs = el('div', { class: 'gal-tabs' });
      const draw = () => {
        tabs.innerHTML = ''; body.innerHTML = '';
        const T = [['img', 'Bilder', X().galleryImages(), 'gallery'], ['music', 'Musik', X().galleryMusic(), 'music'], ['scene', 'Szenen', X().replayScenes(), 'seen']];
        for (const [k, label, items, field] of T) if (items.length) tabs.appendChild(el('button', { class: 'sys-btn' + (tab === k ? ' primary' : ''), onclick: (e) => { e.stopPropagation(); tab = k; draw(); } }, label + ' ' + items.filter((x) => P[field][x.id]).length + '/' + items.length));
        if (tab === 'img') {
          const grid = el('div', { class: 'gal-grid' });
          for (const a of X().galleryImages()) {
            const ok = P.gallery[a.id];
            grid.appendChild(ok ? el('button', { class: 'gal-tile', style: { backgroundImage: `url("${VN.assetUrl(a.id)}")` }, 'aria-label': a.name, onclick: (e) => { e.stopPropagation(); view(a); } }) : el('div', { class: 'gal-tile locked' }, '?'));
          }
          body.appendChild(grid);
        } else if (tab === 'music') {
          for (const a of X().galleryMusic()) {
            const ok = P.music[a.id];
            body.appendChild(el('div', { class: 'gal-row' + (ok ? '' : ' locked') }, el('span', null, ok ? a.name : '???'),
              ok ? el('button', { class: 'sys-btn', onclick: (e) => { e.stopPropagation(); if (playing === a.id) { H.A.stopMusic(0.6); playing = null; } else { H.A.playMusic({ asset: a.id, vol: 80, loop: true, fade: 0.6 }); playing = a.id; played = true; } draw(); } }, playing === a.id ? '■ Stopp' : '▶ Abspielen') : el('span')));
          }
        } else {
          for (const s of X().replayScenes()) {
            const ok = P.seen[s.id];
            body.appendChild(el('div', { class: 'gal-row' + (ok ? '' : ' locked') }, el('span', null, ok ? VN.tr(s.id + ':name', s.name) : '???'),
              ok ? el('button', { class: 'sys-btn', onclick: (e) => { e.stopPropagation(); H.closeOverlay(); H.replay(s.id); resolve(); } }, '▶ Ansehen') : el('span')));
          }
        }
      };
      const view = (a) => {
        const big = el('div', { class: 'gal-view', onclick: (e) => { e.stopPropagation(); big.remove(); } }, el('img', { src: VN.assetUrl(a.id), alt: a.name }));
        H.stage().appendChild(big);
      };
      draw();
      const done = () => { if (playing) H.A.stopMusic(0.6); if (R()) R().overlay = null; if (fromMenu === 'menu') { H.closeOverlay(); if (played) H.showMainMenu(); } else if (fromMenu) H.pauseMenu(); else H.closeOverlay(); resolve(); };
      H.panel('Galerie', tabs, body, H.sysBtn('Zurück', done));
    });

    // ---------- Erfolge ----------
    const achScreen = (fromMenu) => new Promise((resolve) => {
      const r = R();
      if (r) r.overlay = 'ach';
      H.setPanelKind('pause');
      const P = X().P();
      const all = X().achs();
      const list = el('div', { class: 'ach-list' });
      for (const a of all) {
        const ok = P.ach[a.id];
        const icon = a.icon && VN.assetUrl(a.icon) ? el('div', { class: 'ach-ico', style: { backgroundImage: `url("${VN.assetUrl(a.icon)}")` } }) : el('div', { class: 'ach-ico ph' }, '🏆');
        list.appendChild(el('div', { class: 'ach-row' + (ok ? ' got' : '') }, icon,
          el('div', null, el('strong', null, ok || !a.hidden ? VN.tr(a.id + ':name', a.name) : '???'),
            el('div', { class: 'ach-desc' }, ok || !a.hidden ? VN.tr(a.id + ':desc', a.desc || '') : 'Geheimer Erfolg')),
          el('span', { class: 'ach-when' }, ok ? new Date(ok).toLocaleDateString('de-DE') : '')));
      }
      const got = all.filter((a) => P.ach[a.id]).length;
      const done = () => { if (R()) R().overlay = null; if (fromMenu === 'menu') H.closeOverlay(); else if (fromMenu) H.pauseMenu(); else H.closeOverlay(); resolve(); };
      H.panel('Erfolge', el('div', { class: 'ach-sum' }, got + ' von ' + all.length + ' freigeschaltet'), list, H.sysBtn('Zurück', done));
    });
    // Einblendung „Erfolg freigeschaltet“
    X().onAch = (a) => {
      const st = H.stage();
      if (!st) return;
      const box = el('div', { class: 'ach-toast' },
        a.icon && VN.assetUrl(a.icon) ? el('div', { class: 'ach-ico', style: { backgroundImage: `url("${VN.assetUrl(a.icon)}")` } }) : el('div', { class: 'ach-ico ph' }, '🏆'),
        el('div', null, el('div', { class: 'ach-t1' }, 'Erfolg freigeschaltet'), el('strong', null, VN.tr(a.id + ':name', a.name))));
      if (window.UiDesign) UiDesign.apply('ach', box);
      st.appendChild(box);
      if (window.Theme) Theme.sound('item');
      setTimeout(() => { box.classList.add('out'); setTimeout(() => box.remove(), 500); }, 3200);
    };

    // ---------- Werte ----------
    const statsScreen = (back) => new Promise((resolve) => {
      const r = R();
      if (!r) return resolve();
      r.overlay = 'stats';
      H.setPanelKind('pause');
      const groups = new Map();
      for (const v of X().stats()) { const g = v.owner || ''; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(v); }
      const body = el('div', { class: 'st-list' });
      for (const [g, vars] of groups) {
        if (groups.size > 1 || g) body.appendChild(el('div', { class: 'st-group' }, g || 'Du'));
        for (const v of vars) {
          const val = Number(r.rs.vars[v.id]) || 0, max = Number(v.max) || 100;
          body.appendChild(el('div', { class: 'st-row' },
            v.icon && VN.assetUrl(v.icon) ? el('span', { class: 'st-ico', style: { backgroundImage: `url("${VN.assetUrl(v.icon)}")` } }) : el('span', { class: 'st-ico ph', style: { background: v.color || '#e8a43a' } }),
            el('span', { class: 'st-name' }, VN.tr(v.id + ':name', v.name)),
            el('span', { class: 'st-bar' }, el('span', { style: { width: Math.max(0, Math.min(100, val / max * 100)) + '%', background: v.color || '#e8a43a' } })),
            el('span', { class: 'st-val' }, val + (v.max ? ' / ' + max : ''))));
        }
      }
      const done = () => { r.overlay = null; if (back) H.pauseMenu(); else H.closeOverlay(); resolve(); };
      H.panel('Werte', body, H.sysBtn('Zurück', done));
    });

    // ---------- Namen eingeben ----------
    const askName = (a) => new Promise((resolve) => {
      const r = R();
      if (!r) return resolve();
      r.rs.names = r.rs.names || {};
      const inp = el('input', { class: 'pl-name-inp', type: 'text', maxlength: 24, value: r.rs.names[a.var] || a.def || '', 'aria-label': a.prompt || 'Name' });
      const box = el('div', { class: 'pl-name-ask', onclick: (e) => e.stopPropagation() },
        el('div', { class: 'sys-panel' }, el('div', { class: 'sys-title' }, a.prompt || 'Wie heißt du?'), inp,
          el('button', { class: 'sys-btn primary', onclick: () => ok() }, 'OK')));
      const ok = () => { const v = inp.value.trim() || a.def || ''; if (!v) { inp.focus(); return; } r.rs.names[a.var] = v; box.remove(); resolve(); };
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') ok(); });
      H.stage().appendChild(box);
      setTimeout(() => inp.focus(), 30);
    });

    // ---------- Gegenstände benutzen und kombinieren ----------
    const useItem = async (it) => {
      const r = R();
      if (!r || !it) return;
      const s = VN.scene(r.scene);
      const hubTargets = s && s.type === 'hub' && (s.objects || []).some((o) => o.useItem);
      H.closeOverlay();
      if (hubTargets) { hold(it); return; }
      if (!X().canUse(it)) { H.showMessage(el('div', null, 'Das kann man hier nicht benutzen.'), () => {}); return; }
      if (it.use.consume !== false) { r.rs.inv[it.id] = Math.max(0, (r.rs.inv[it.id] || 0) - 1); if (!r.rs.inv[it.id]) delete r.rs.inv[it.id]; }
      if (window.VNPlugin) VNPlugin.hook('onUseItem', it.id, null, VNPlugin.makeCtx(r.rs));
      const gains = await H.doActions(it.use.actions, 'use:' + it.id);
      if (gains === null) return;
      H.showGains(gains);
      if (it.use.text) H.showMessage(el('div', null, VN.tr(it.id + ':use', it.use.text)), () => {});
    };
    const combine = (a, b, rs) => {
      const c = X().comboFor(a.id, b.id);
      if (!c) return { ok: false, text: 'Das passt nicht zusammen.' };
      const take = (id) => { rs.inv[id] = Math.max(0, (rs.inv[id] || 0) - 1); if (!rs.inv[id]) delete rs.inv[id]; };
      if (c.consume !== 'none') { if (c.consume !== 'b') take(c.a); if (c.consume !== 'a') take(c.b); }
      if (c.result) VN.giveItem(rs, c.result, Number(c.count) || 1);
      if (window.Theme) Theme.sound('item');
      const res = VN.project.items.find((x) => x.id === c.result);
      return { ok: true, text: c.text ? VN.tr(c.id + ':text', c.text) : (res ? 'Neu: ' + VN.tr(res.id + ':name', res.name) : 'Kombiniert.'), result: res };
    };
    // Gegenstand „in der Hand“: im Hub auf ein Objekt klicken
    let holdEl = null;
    const hold = (it) => {
      const r = R();
      r.holding = it;
      const st = H.stage();
      holdEl = el('div', { class: 'pl-hold', style: it.image ? { backgroundImage: `url("${VN.assetUrl(it.image)}")` } : null }, it.image ? '' : (it.name || '?').slice(0, 2));
      st.appendChild(holdEl);
      st.appendChild(el('div', { class: 'pl-hold-hint' }, VN.tr(it.id + ':name', it.name) + ' – auf etwas klicken · Rechtsklick bricht ab'));
      st.addEventListener('mousemove', moveHold);
      st.addEventListener('contextmenu', dropHold);
    };
    const moveHold = (e) => { if (!holdEl) return; const b = H.stage().getBoundingClientRect(); holdEl.style.left = (e.clientX - b.left) + 'px'; holdEl.style.top = (e.clientY - b.top) + 'px'; };
    const dropHold = (e) => {
      if (e) e.preventDefault();
      const r = R();
      if (r) r.holding = null;
      const st = H.stage();
      if (holdEl) holdEl.remove();
      holdEl = null;
      if (st) { st.querySelectorAll('.pl-hold-hint').forEach((n) => n.remove()); st.removeEventListener('mousemove', moveHold); st.removeEventListener('contextmenu', dropHold); }
    };
    // Klick auf ein Hub-Objekt mit Gegenstand in der Hand
    const useOn = async (o) => {
      const r = R();
      const it = r.holding;
      dropHold();
      if (!it) return false;
      if (o.useItem !== it.id) { H.showMessage(el('div', null, 'Das funktioniert hier nicht.'), () => {}); return true; }
      if (o.useConsume !== false) { r.rs.inv[it.id] = Math.max(0, (r.rs.inv[it.id] || 0) - 1); if (!r.rs.inv[it.id]) delete r.rs.inv[it.id]; }
      if (window.VNPlugin) VNPlugin.hook('onUseItem', it.id, o, VNPlugin.makeCtx(r.rs));
      const gains = await H.doActions(o.useActions || [], 'useon:' + o.id);
      if (gains === null) return true;
      H.showGains(gains);
      const go = () => { if (o.useTarget && VN.scene(o.useTarget)) H.enterScene(o.useTarget, 0); else H.refreshHub(); };
      if (o.useText) H.showMessage(el('div', null, VN.tr(o.id + ':usetext', o.useText)), go); else go();
      return true;
    };

    // ---------- Geräusch-Untertitel und Vorlesen ----------
    const caption = (text) => {
      if (!S().captions || !text) return;
      const st = H.stage();
      let box = st.querySelector('.pl-captions');
      if (!box) { box = el('div', { class: 'pl-captions' }); st.appendChild(box); }
      const c = el('div', { class: 'pl-cap' }, '[' + text + ']');
      box.appendChild(c);
      setTimeout(() => { c.classList.add('out'); setTimeout(() => c.remove(), 400); }, 2600);
    };
    const speak = (text, hasVoice) => {
      if (!window.speechSynthesis) return;
      try { speechSynthesis.cancel(); } catch (e) { /* egal */ }
      if (!S().tts || hasVoice || !text) return;
      const u = new SpeechSynthesisUtterance(Fx.plain(text));
      u.lang = VN.lang && VN.lang.length === 2 ? VN.lang + '-' + VN.lang.toUpperCase() : 'de-DE';
      if (VN.lang === 'en') u.lang = 'en-US';
      u.rate = Math.max(0.6, Math.min(1.8, (S().text || 100) / 100));
      try { speechSynthesis.speak(u); } catch (e) { /* egal */ }
    };

    // ---------- Einstellungen: Lesen & Barrierefreiheit ----------
    const a11yScreen = (fromMenu) => {
      const r = R();
      if (r) r.overlay = 'a11y';
      H.setPanelKind('settings');
      const chk = (label, key, hint) => el('div', { class: 'set-row' }, el('span', null, label), el('input', { type: 'checkbox', checked: !!S()[key], onchange: (e) => { S()[key] = e.target.checked; H.saveSettings(); applyA11y(); } }), el('span', { class: 'set-val' }, hint || ''));
      const slider = (label, key, min, max, def, fmt) => {
        if (S()[key] == null) S()[key] = def;
        const lab = el('span', { class: 'set-val' }, fmt(S()[key]));
        return el('div', { class: 'set-row' }, el('span', null, label), el('input', { type: 'range', min, max, value: S()[key], oninput: (e) => { S()[key] = Number(e.target.value); lab.textContent = fmt(S()[key]); H.saveSettings(); applyA11y(); } }), lab);
      };
      H.panel('Lesen & Barrierefreiheit',
        slider('Auto-Tempo', 'autoSpeed', 25, 300, 100, (v) => v + ' %'),
        chk('Auch Ungelesenes überspringen', 'skipUnread'),
        slider('Textgröße', 'textScale', 80, 160, 100, (v) => v + ' %'),
        chk('Textbox gut lesbar (deckend)', 'solidBox'),
        chk('Ruhige Darstellung', 'calm', 'kein Wackeln'),
        chk('Untertitel für Geräusche', 'captions'),
        chk('Texte ohne Stimme vorlesen', 'tts'),
        H.sysBtn('Zurück', () => { if (R()) R().overlay = null; if (fromMenu) H.settingsScreen(fromMenu === 'menu'); else H.settingsScreen(); }));
    };
    const applyA11y = () => {
      const st = H.stage();
      if (!st) return;
      st.classList.toggle('a11y-solid', !!S().solidBox);
      st.classList.toggle('a11y-calm', !!S().calm);
    };

    return {
      logLine, logScreen, markRead, startLoop, stopLoop, stopModes, ctrlBox, onKey, onKeyUp, onWheel, mode,
      galleryScreen, achScreen, statsScreen, askName, useItem, combine, useOn, dropHold, caption, speak, a11yScreen, applyA11y
    };
  };
})();
