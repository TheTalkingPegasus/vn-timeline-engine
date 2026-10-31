// Spiel-Player: spielt das Projekt so ab, wie es ein Spieler sehen würde
(function () {
  const { el } = VN;

  let root, stage, bgLayers, black, vig, charsBox, fxBox, hubBox, dlgBox, choiceBox, msgBox, info, hud, overlayBox, gainBox, debugBox, menuBox, ctrl;
  let world, bgBox, dayOv, parBack, parFront, partBox, phoneBox;
  let run = null;        // aktueller Durchlauf
  let session = null;    // Sitzung (auch im Hauptmenü)
  const timers = new Set();

  // ---------- Einstellungen ----------
  const loadSettings = () => {
    let s = {};
    try { s = JSON.parse(localStorage.getItem('vn-settings') || '{}'); } catch (e) { s = {}; }
    VN.settings = Object.assign({ music: 80, voice: 100, sfx: 90, text: 100, fullscreen: false }, s);
  };
  const saveSettings = () => { try { localStorage.setItem('vn-settings', JSON.stringify(VN.settings)); } catch (e) { /* egal */ } };
  loadSettings();
  const volOf = (kind) => (VN.settings[kind] != null ? VN.settings[kind] : 100) / 100;

  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const clearTimers = () => { for (const t of timers) clearTimeout(t); timers.clear(); };
  const store = () => VN.api && VN.api.saves;

  // ---------- Ton (player-audio.js) ----------
  const A = VN.PlayerAudio({ run: () => run, later, volOf });
  const { fadeVolume, musicVol, duck, stopMusic, playMusic, playOnce, stopVoice, stopSfx, lipLoop, showAmbient, stopAmbient } = A;

  // ---------- Bühne ----------
  const lookKey = (l) => (l ? [l.zoom, l.fx, l.fy, l.vignette, l.kenburns, l.daytime, l.depth, JSON.stringify(l.layers || []), JSON.stringify(l.styles || {}), JSON.stringify(l.tile || {}), VN.Life && run ? VN.Life.daytime(l, run.rs) : ''].join('|') : '');
  const showBg = (assetId, trans, dur, look) => {
    const key = assetId + '#' + lookKey(look);
    if (run.bgKey === key) return;
    run.bgKey = key;
    run.bg = assetId;
    if (VN.Extras) VN.Extras.seeImage(assetId);
    run.bgClip = look || null;
    const cur = bgLayers[run.bgIndex];
    const next = bgLayers[1 - run.bgIndex];
    run.bgIndex = 1 - run.bgIndex;
    const url = VN.assetUrl(assetId);
    dur = dur != null ? dur : 1;
    const v = VN.vignetteEl(look || {});
    vig.style.background = v.style.background;
    vig.style.opacity = v.style.opacity;
    bgBox.dataset.depth = look && look.depth != null ? look.depth : 1;
    // Tageszeit-Schleier
    const d = Fx.DAY[VN.Life ? VN.Life.daytime(look, run.rs) : look && look.daytime];
    dayOv.style.transition = `opacity ${Math.max(0.3, dur)}s, background ${Math.max(0.3, dur)}s`;
    if (d) Object.assign(dayOv.style, { background: d.color, mixBlendMode: d.blend, opacity: String(d.a) }); else dayOv.style.opacity = '0';
    // Parallax-Ebenen
    parBack.innerHTML = ''; parFront.innerHTML = '';
    for (const n of Stage.parallaxEls(look, false)) parBack.appendChild(n);
    for (const n of Stage.parallaxEls(look, true)) parFront.appendChild(n);
    if (run.cam) Fx.applyCam(world, run.cam, 0);
    // Endlos-Kachel statt Standbild
    if (run.bgTile) { const old = run.bgTile; old.style.transition = `opacity ${dur}s`; old.style.opacity = '0'; later(() => old.remove(), dur * 1000 + 50); run.bgTile = null; }
    if (url && look && Fx.tileOn(look.tile)) {
      const tw = run.bgTile = Fx.tileEl(url, look.tile);
      tw.classList.add('pl-bgtile');
      if (d) tw.style.filter = d.filter;
      tw.style.opacity = '0';
      bgBox.insertBefore(tw, dayOv);
      void tw.offsetWidth;
      tw.style.transition = trans === 'cut' || dur === 0 ? 'none' : `opacity ${dur}s`;
      tw.style.opacity = '1';
      cur.style.transition = `opacity ${dur}s`; cur.style.opacity = '0';
      run.bgIndex = 1 - run.bgIndex;
      return;
    }
    if (!url) {
      cur.style.transition = `opacity ${dur}s`;
      cur.style.opacity = '0';
      return;
    }
    next.getAnimations().forEach((an) => an.cancel());
    next.src = url;
    next.style.filter = ''; next.style.transform = '';
    VN.applyBgLook(next, look);
    if (d) next.style.filter = [next.style.filter, d.filter].filter(Boolean).join(' ');
    if (look && look.kenburns) next.animate([{ transform: next.style.transform }, { transform: next.style.transform + ' scale(1.1)' }], { duration: 22000, fill: 'forwards' });
    next.style.zIndex = '1';
    cur.style.zIndex = '0';
    if (trans === 'cut' || dur === 0) {
      next.style.transition = 'none'; next.style.opacity = '1';
      cur.style.transition = 'none'; cur.style.opacity = '0';
    } else if (trans === 'mask') {
      next.style.transition = 'none'; next.style.opacity = '1';
      Fx.maskReveal(next, look.mask || 'wipe-right', look.mask === 'custom' ? look.maskAsset : null, dur, look.maskSoft != null ? look.maskSoft / 100 : 0.12).then(() => { if (bgLayers[run ? run.bgIndex : 0] === next) { cur.style.transition = 'none'; cur.style.opacity = '0'; } });
    } else if (trans === 'eyes') {
      // Augen schließen, Bild wechseln, Augen öffnen
      next.style.transition = 'none'; next.style.opacity = '0';
      const ov = Fx.eyesEl(Object.assign({}, Fx.EYE_DEF, look || {}, { eyes: 'blink', eyesDur: dur, eyesBlinks: 0 }), true);
      ov.classList.add('pl-eyes-trans');
      stage.appendChild(ov);
      later(() => { next.style.opacity = '1'; cur.style.transition = 'none'; cur.style.opacity = '0'; }, dur * 500);
      later(() => ov.remove(), dur * 1000 + 100);
    } else if (trans === 'shatter') {
      // Bildschirm zerspringt: Momentaufnahme des alten Bildes zerbricht über dem neuen
      const snap = world.cloneNode(true);
      snap.classList.add('pl-shatter-snap');
      stage.insertBefore(snap, world.nextSibling);
      next.style.transition = 'none'; next.style.opacity = '1';
      cur.style.transition = 'none'; cur.style.opacity = '0';
      Fx.shatter(snap, { mode: look && look.shatterMode || 'fall', pieces: 34, dur: Math.max(0.6, dur) }).then(() => snap.remove());
    } else if (trans === 'black') {
      black.style.transition = `opacity ${dur / 2}s`;
      black.style.opacity = '1';
      later(() => {
        next.style.transition = 'none'; next.style.opacity = '1';
        cur.style.transition = 'none'; cur.style.opacity = '0';
        black.style.opacity = '0';
      }, dur * 500);
    } else {
      next.style.transition = 'none';
      next.style.opacity = '0';
      void next.offsetWidth;
      next.style.transition = `opacity ${dur}s`;
      next.style.opacity = '1';
      later(() => { cur.style.transition = 'none'; cur.style.opacity = '0'; }, dur * 1000);
    }
  };

  const removeChar = (key) => {
    const c = run.chars[key];
    if (!c) return;
    delete run.chars[key];
    c.el.style.transition = 'opacity 0.3s';
    c.el.style.opacity = '0';
    later(() => c.el.remove(), 320);
  };

  const showChars = (list, beat) => {
    const want = {};
    for (const [key, clip] of list) want[key] = clip;
    for (const key of [...new Set([...Object.keys(run.chars), ...list.map((x) => x[0])])]) {
      const clip = want[key];
      const cur = run.chars[key];
      const pr = clip ? Fx.propsAt(clip, beat) : null;
      const sameFig = cur && clip && clip.set && cur.set === clip.set;
      if (cur && clip && ((cur.asset === clip.asset && !clip.set) || sameFig)) {
        const tr = pr.key ? `${pr.key.dur != null ? pr.key.dur : 0.8}s ${Fx.ease(pr.key.ease)}` : '0.5s ease';
        cur.el.style.transition = `left ${tr}, bottom ${tr}, height ${tr}, rotate ${tr}, opacity ${pr.key ? tr : '0.4s'}`;
        Fx.placeChar(cur.el, pr);
        const inner = cur.el.querySelector(':scope > img, :scope > .char-inner');
        if (inner && !clip.set) inner.style.transform = clip.flip ? 'scaleX(-1)' : '';
        cur.el.className = 'pl-char' + (clip.idle && clip.idle !== 'none' ? ' idle-' + clip.idle : '');
        VN.applyLook(cur.el, clip);
        cur.el.style.opacity = String(pr.opacity / 100);
        if (clip.set) {
          const fig = cur.el.querySelector('.fig');
          const picks = JSON.stringify(Stage.figurePicks(clip, beat, run.rs));
          if (fig && fig.dataset.picks !== picks) { const nf = Stage.figureEl(clip, beat, run.rs); fig.replaceWith(nf); }
        }
        cur.clip = clip;
        continue;
      }
      if (cur) removeChar(key);
      if (!clip) continue;
      const node = Stage.charEl(clip, 'pl-char' + (clip.idle && clip.idle !== 'none' ? ' idle-' + clip.idle : ''), { beat, rs: run.rs });
      const x = pr.x;
      const dur = clip.dur != null ? clip.dur : 0.6;
      const targetOp = String(pr.opacity / 100);
      charsBox.appendChild(node);
      if (clip.trans === 'slide') {
        node.style.left = (x > 50 ? 118 : -18) + '%';
        void node.offsetWidth;
        node.style.transition = `left ${dur}s cubic-bezier(.2,.8,.2,1)`;
        node.style.left = x + '%';
      } else if (clip.trans !== 'cut') {
        node.style.opacity = '0';
        void node.offsetWidth;
        node.style.transition = `opacity ${dur}s`;
        node.style.opacity = targetOp;
      }
      run.chars[key] = { el: node, asset: clip.asset, set: clip.set, clip };
      if (VN.Extras) VN.Extras.seeImage(clip.asset);
    }
    // Reihenfolge wie in der Timeline (weiter unten = weiter vorne)
    const order = list.map((x) => run.chars[x[0]] && run.chars[x[0]].el).filter(Boolean);
    const now = Array.from(charsBox.children).filter((n) => order.includes(n));
    if (order.some((n, i) => now[i] !== n)) for (const n of order) charsBox.appendChild(n);
    // Licht passend zur Szene
    const bg = run.bgClip;
    if (bg && bg.charLight) {
      const d = Fx.DAY[VN.Life ? VN.Life.daytime(bg, run.rs) : bg.daytime];
      (d ? Promise.resolve(d.light) : Fx.avgColor(bg.asset)).then((col) => { if (!run) return; for (const c of Object.values(run.chars)) Fx.lightOverlay(c.el, c.clip, col, bg.charLight); });
    } else for (const c of Object.values(run.chars)) c.el.querySelectorAll('.char-light').forEach((n) => n.remove());
  };

  // Zusätzliche Effekt-Ebenen (Partikel, Licht-Ebenen)
  const showFxExtra = (list) => {
    run.fxx = run.fxx || {};
    const want = {};
    for (const [key, clip] of list) if (!clip.filter) want[key] = clip;
    for (const key of Object.keys(run.fxx)) {
      if (want[key] && want[key].id === run.fxx[key].id) continue;
      const old = run.fxx[key].el; old.style.transition = 'opacity 0.6s'; old.style.opacity = '0'; later(() => old.remove(), 650);
      delete run.fxx[key];
    }
    for (const [key, clip] of Object.entries(want)) {
      if (run.fxx[key]) continue;
      const node = Stage.fxEl(clip, 'fx-layer');
      node.style.opacity = '0';
      (clip.particles ? partBox : fxBox).appendChild(node);
      void node.offsetWidth;
      node.style.transition = 'opacity 0.6s';
      node.style.opacity = clip.particles ? '1' : String((clip.opacity != null ? clip.opacity : 100) / 100);
      run.fxx[key] = { id: clip.id, el: node };
    }
  };

  const showFx = (clip) => {
    const id = clip ? clip.id : null;
    if (run.fx && run.fx.id === id) return;
    if (run.fx) { const old = run.fx.el; old.style.transition = 'opacity 0.6s'; old.style.opacity = '0'; later(() => old.remove(), 650); }
    world.style.transition = 'filter 0.8s';
    world.style.filter = clip && clip.filter ? (window.Perf ? Perf.filterCss(Fx.FILTER_CSS[clip.filter] || '') : Fx.FILTER_CSS[clip.filter] || '') : '';
    run.fx = null;
    if (!clip) return;
    const node = Stage.fxEl(clip, 'fx-layer');
    if (clip.eyes) { partBox.appendChild(node); run.fx = { id, el: node }; return; }
    const target = String((clip.opacity != null ? clip.opacity : 100) / 100);
    node.style.opacity = '0';
    (clip.particles || clip.filter ? partBox : fxBox).appendChild(node);
    void node.offsetWidth;
    node.style.transition = 'opacity 0.6s';
    node.style.opacity = clip.particles || clip.filter ? '1' : target;
    run.fx = { id, el: node };
  };

  // Zwischensequenz nach dem Ende ausblenden, damit Dialog und Bühne wieder sichtbar sind
  const hideFront = (v) => {
    if (!run || !run.video || run.video.el !== v) return;
    try { v.pause(); } catch (e) { /* egal */ }
    v.style.transition = 'opacity 0.4s'; v.style.opacity = '0';
    later(() => v.remove(), 450);
    run.video.done = true;
  };

  // Video: Hintergrund-Video oder Zwischensequenz (vorne, wartet bis zum Ende)
  const showVideo = (clip, beat) => {
    if (run.video && (!clip || run.video.id !== clip.id)) { const v = run.video.el; v.pause(); v.style.transition = 'opacity 0.4s'; v.style.opacity = '0'; later(() => v.remove(), 450); run.video = null; }
    if (!clip || !(clip.anim ? Anim.get(clip.anim) : VN.assetUrl(clip.asset))) return;
    if (run.video) return;
    const v = Stage.videoEl(clip, true);
    if (clip.anim) {
      // Zwischensequenz aus dem Animations-Editor, live gezeichnet
      (clip.layer === 'front' ? stage : bgBox).appendChild(v);
      if (clip.layer === 'front') v.style.zIndex = '8';
      const ctrl = Anim.play(v, Anim.get(clip.anim), { volume: volOf('sfx'), onEnd: () => v.dispatchEvent(new Event('ended')) });
      v.pause = () => ctrl.stop();
      run.video = { id: clip.id, el: v };
      if (clip.layer === 'front' && clip.waitEnd !== false && beat === clip.start) {
        run.blocked = 'video';
        dlgBox.hidden = true;
        const done = () => { if (run && run.blocked === 'video') { run.blocked = false; hideFront(v); if (clip.autoNext !== false) Player.advance(); } };
        v.addEventListener('ended', done);
        run.skipVideo = clip.skippable !== false ? done : null;
      }
      return;
    }
    v.volume = Math.max(0, Math.min(1, (clip.vol != null ? clip.vol : 90) / 100 * volOf('sfx')));
    (clip.layer === 'front' ? stage : bgBox).appendChild(v);
    if (clip.layer === 'front') v.style.zIndex = '8';
    v.play().catch(() => {});
    run.video = { id: clip.id, el: v };
    if (clip.layer === 'front' && clip.waitEnd && beat === clip.start) {
      run.blocked = 'video';
      dlgBox.hidden = true;
      const done = () => { if (run && run.blocked === 'video') { run.blocked = false; v.removeEventListener('ended', done); hideFront(v); if (clip.autoNext !== false) Player.advance(); } };
      v.addEventListener('ended', done);
      run.skipVideo = clip.skippable !== false ? done : null;
    }
  };

  const applyCamera = (st, b) => {
    const cam = st.cam || Fx.CAM0;
    const k = JSON.stringify([cam.zoom, cam.panX, cam.panY, cam.rot]);
    const enterClip = cam.clip && b === cam.clip.start;
    const src = cam.key || (enterClip ? cam.clip : null);
    if (run.camKey !== k) {
      Fx.applyCam(world, cam, src ? (src.dur != null ? src.dur : 1) : (run.camKey ? 0.8 : 0), src ? src.ease : 'ease-in-out');
      run.camKey = k;
    }
    run.cam = cam;
    if (src && src.shake) Fx.shake(world, src.shake, src.shakeDur || 0.5);
  };

  // ---------- „Weiter erst, wenn …“: Dialog hält an, bis eine Bedingung erfüllt ist ----------
  let waitTick = 0;
  const stopWait = () => {
    clearInterval(waitTick); waitTick = 0;
    if (run) run.waitFor = null;
    if (!stage) return;
    stage.querySelectorAll('.pl-wait').forEach((x) => x.remove());
    stage.querySelectorAll('.pl-ctrl button.wait-glow').forEach((x) => x.classList.remove('wait-glow'));
  };
  const startWait = (clip, onMet) => {
    stopWait();
    const w = clip && clip.waitFor;
    if (!w || !(w.conds || []).length || VN.checkConds(w.conds, run.rs)) return;
    run.waitFor = clip.id;
    const hint = el('div', { class: 'pl-wait pos-' + (w.pos || 'top') }, el('span', { class: 'pl-wait-ic' }, '👉'), el('span', null, w.hint ? VN.tr(clip.id + ':wait', w.hint) : VN.tp('Erst weiter, wenn du das erledigt hast.')));
    stage.appendChild(hint);
    if (w.glow) stage.querySelectorAll('.pl-ctrl button[data-btn="' + w.glow + '"]').forEach((b) => b.classList.add('wait-glow'));
    const myRun = run;
    waitTick = setInterval(() => {
      if (run !== myRun || !run || run.curLine !== clip.id) { clearInterval(waitTick); waitTick = 0; return; }
      if (!VN.checkConds(w.conds, run.rs)) return;
      if (onMet) { clearInterval(waitTick); waitTick = 0; run.waitFor = null; hint.remove(); stage.querySelectorAll('.pl-ctrl button.wait-glow').forEach((x) => x.classList.remove('wait-glow')); if (!run.overlay) onMet(); else run.afterOverlay = onMet; return; }
      hint.classList.add('done');
      hint.lastChild.textContent = VN.tp('Erledigt! Klicken zum Weiterlesen.');
      clearInterval(waitTick); waitTick = 0;
      run.waitFor = null;
      stage.querySelectorAll('.pl-ctrl button.wait-glow').forEach((x) => x.classList.remove('wait-glow'));
      setTimeout(() => hint.remove(), 2600);
      if (w.auto && !run.overlay) setTimeout(() => { if (run === myRun && run.curLine === clip.id && !run.overlay) Player.advance(); }, 700);
    }, 250);
  };

  const showDialog = (clip, override) => {
    stopTyping();
    dlgBox.innerHTML = '';
    phoneBox.innerHTML = '';
    if (!clip) { stopWait(); dlgBox.hidden = true; run.curLine = null; run.curText = ''; return; }
    // „Weiter erst, wenn …“ mit „Zeile erst zeigen, wenn erledigt“: Zeile bleibt verborgen, bis die Bedingung stimmt
    const wf = clip.waitFor;
    if (!override && wf && wf.before && (wf.conds || []).length && !VN.checkConds(wf.conds, run.rs)) {
      dlgBox.hidden = true;
      run.curLine = clip.id; run.curText = '';
      startWait(clip, () => showDialog(clip));
      return;
    }
    const s = VN.scene(run.scene);
    const chars = Object.entries(run.chars).filter(([, v]) => v.clip).map(([k, v]) => [k, v.clip]);
    run.speakingChar = null;
    for (const c of Object.values(run.chars)) if (c.clip && Fx.isSpeaker(c.clip, clip.speaker)) run.speakingChar = c;
    Stage.applyFocus(Object.values(run.chars).map((c) => [c.el, c.clip]), clip.speaker);
    const XF = (t) => (VN.Extras ? VN.Extras.fill(t, run.rs) : t);
    const speaker = XF(override ? override.speaker : VN.tr(VN.speakerKey(clip.speaker), clip.speaker));
    const full = XF(override ? override.text : VN.tr(clip.id, clip.text || ''));
    run.curLine = clip.id;
    startWait(clip);
    run.curText = full;
    E.logLine(clip, speaker, full);
    E.speak(full, !!(s && s.type === 'story' && !run.event && (s.tracks.voice || []).some((v) => v.start === run.beat && v.asset)));
    const tokens = Fx.parse(full);
    // Handy-Chat
    if (clip.chat && s && s.type === 'story') {
      dlgBox.hidden = true;
      const lines = Fx.chatRun(s, run.beat);
      const box = Fx.phoneEl(lines.slice(0, -1), { live: true, text: (l) => VN.tr(l.id, l.text || ''), tr: (l) => VN.tr(VN.speakerKey(l.speaker), l.speaker) });
      phoneBox.appendChild(box);
      const list = box.querySelector('.ph-msgs');
      const me = String((VN.project.chat && VN.project.chat.me) || '').trim().toLowerCase();
      const mine = me && (clip.speaker || '').trim().toLowerCase() === me;
      const dots = el('div', { class: 'ph-msg typing' + (mine ? ' me' : '') }, el('i'), el('i'), el('i'));
      list.appendChild(dots);
      list.scrollTop = list.scrollHeight;
      const msg = el('div', { class: 'ph-msg' + (mine ? ' me' : '') });
      const done = () => { if (!dots.isConnected) return; dots.replaceWith(msg); Fx.renderText(msg, full); list.scrollTop = list.scrollHeight; run.typing = null; uiSound('item'); };
      run.typing = { full, next: el('div'), textEl: msg, iv: setTimeout(done, Math.min(1800, 500 + Fx.plain(full).length * 22)), chat: done };
      return;
    }
    dlgBox.hidden = false;
    const box = Stage.dialogEl(clip, '', speaker, { tailX: Stage.speakerX(chars, clip.speaker), portrait: Stage.portraitOf(chars, clip.speaker) });
    const textEl = box.querySelector('.dlg-text');
    textEl.textContent = '';
    const next = el('div', { class: 'dlg-next', hidden: true }, '▼');
    if (window.Theme) Theme.styleArrow(next, Theme.bubble(clip.speaker, clip));
    box.appendChild(next);
    dlgBox.appendChild(box);
    const fancy = Fx.hasFx(tokens);
    let speed = (clip.speed != null ? clip.speed : 40) * (VN.settings.text / 100);
    // Tempo an die Sprachaufnahme anpassen
    if (clip.syncVoice && s && s.type === 'story') {
      const vc = (s.tracks.voice || []).find((v) => v.start === run.beat && v.asset);
      if (vc) {
        const dur = (vc.out != null ? vc.out : Fx.audioDur(vc.asset)) - (vc.in || 0);
        if (dur > 0.3) speed = Math.max(4, tokens.length / (dur * 0.96)) * (VN.settings.text >= 300 ? 99 : 1);
      }
    }
    const finish = () => { if (Fx.glossaryMatch(textEl.textContent).length) Fx.markGlossary(textEl, showGlossary).forEach((e) => { run.rs.gloss = run.rs.gloss || {}; run.rs.gloss[e.id] = true; }); };
    if (!speed || VN.settings.text >= 300) { Fx.renderText(textEl, full); next.hidden = false; finish(); return; }
    let i = 0, wait = 0;
    run.typing = { textEl, full, next, tokens, fancy, finish, talk: !!run.speakingChar };
    const tickMs = 1000 / speed;
    run.typing.iv = setInterval(() => {
      if (wait > 0) { wait -= tickMs; return; }
      let budget = 1;
      while (budget > 0 && i < tokens.length) {
        const t = tokens[i];
        if (t.pause) { wait = t.pause * 1000; t.pause = 0; break; }
        if (fancy) textEl.appendChild(Fx.charEl(t, i)); else textEl.append(t.ch === '\n' ? '\n' : t.ch);
        i++;
        budget -= 1 / Math.max(0.2, t.speed);
        if (t.speed > 1) budget += 0;
      }
      if (i >= tokens.length) stopTyping(true);
    }, tickMs);
    if (run.speakingChar) lipLoop();
  };
  const stopTyping = (complete) => {
    if (!run || !run.typing) return;
    const ty = run.typing;
    clearInterval(ty.iv);
    clearTimeout(ty.iv);
    run.typing = null;
    if (ty.chat) { if (complete) ty.chat(); return; }
    if (complete) { Fx.renderText(ty.textEl, ty.full); ty.next.hidden = false; if (ty.finish) ty.finish(); }
  };

  // Glossar-Eintrag anzeigen
  const showGlossary = (e) => {
    run.rs.gloss = run.rs.gloss || {};
    run.rs.gloss[e.id] = true;
    const pop = el('div', { class: 'gl-pop', onclick: (ev) => { ev.stopPropagation(); pop.remove(); } },
      el('div', { class: 'gl-card' },
        e.image && VN.assetUrl(e.image) ? el('div', { class: 'gl-img', style: { backgroundImage: `url("${VN.assetUrl(e.image)}")` } }) : null,
        el('div', { class: 'gl-term-t' }, VN.tr(e.id + ':term', e.term)),
        el('div', { class: 'gl-text' }, VN.tr(e.id + ':text', e.text || '')),
        el('div', { class: 'gl-hint' }, 'Neu im Glossar · Klick schließt')));
    uiSound('open');
    stage.appendChild(pop);
  };

  // Fundmeldung oben (verschwindet von selbst)
  const showGains = (gains) => {
    let real = (gains || []).filter((g) => !g.empty);
    // Beziehungs-Änderungen bekommen ihre eigene Einblendung (Leiste, Porträt)
    const rels = real.filter((g) => g.kind === 'rel');
    if (rels.length && NT.relPopup(rels)) real = real.filter((g) => g.kind !== 'rel');
    if (!real.length) return;
    gainBox.innerHTML = '';
    const p = VN.project;
    const box = el('div', { class: 'pl-gain' }, el('div', { class: 'pl-gain-title' }, 'Erhalten'));
    const row = el('div', { class: 'pl-gain-row' });
    for (const g of real) {
      if (g.kind === 'rel') {
        const c = VN.Life.relChar(g.id);
        row.appendChild(el('span', { class: 'pl-gain-item rel' + (g.count < 0 ? ' neg' : '') }, el('span', { class: 'gi heart' }, g.count < 0 ? '💔' : '♥'), (g.count > 0 ? '+' : '') + g.count + ' ' + (c ? VN.tr('name:' + c.name, c.name) : '') + (g.stage != null ? ' · ' + VN.Life.stageName(g.stage) + '!' : '')));
        continue;
      }
      let ico = null;
      if (g.kind === 'item') { const it = p.items.find((x) => x.id === g.id); ico = it && it.image ? el('span', { class: 'gi', style: { backgroundImage: `url("${VN.assetUrl(it.image)}")` } }) : el('span', { class: 'gi ph' }); }
      else { const c = p.currencies.find((x) => x.id === g.id); ico = c && c.image ? el('span', { class: 'gi', style: { backgroundImage: `url("${VN.assetUrl(c.image)}")` } }) : el('span', { class: 'gi dot', style: { background: (c && c.color) || '#e8c86a' } }); }
      row.appendChild(el('span', { class: 'pl-gain-item' }, ico, VN.lootName(g)));
    }
    box.appendChild(row);
    gainBox.appendChild(box);
    if (window.Theme) { Theme.styleGain(gainBox, box); if (real.some((g) => g.kind === 'item')) Theme.sound('item'); }
    gainBox.hidden = false;
    clearTimeout(run.gainT);
    run.gainT = later(() => { gainBox.hidden = true; }, 2800);
    renderHud();
  };

  // Skillpunkte durch Stufenaufstieg (Skilltrees)
  const skillPts = (gains) => { if (VN.Skills && VN.Skills.on()) for (const u of VN.Skills.update(run.rs)) gains.push({ kind: 'text', text: '+' + u.n + ' ' + u.pt.name }); };

  // Aktionen ausführen; wartet auf Plugins (z. B. Minispiele)
  const doActions = async (list, key) => {
    if (!list || !list.length) return [];
    const myRun = run;
    const gains = VN.applyActions(list, run.rs, key);
    if (VN.Quests && VN.Quests.on()) VN.Quests.emit(VN.Quests.update(run.rs), gains);
    skillPts(gains);
    if (VN.Extras) VN.Extras.checkAch(run.rs);
    if (gains.time && run.bg && run.bgClip !== undefined) { const b = run.bg, l = run.bgClip; run.bgKey = null; showBg(b, 'fade', 1.4, l); }
    renderHud();
    renderDebug();
    if (gains.pending && gains.pending.length) {
      run.blocked = true;
      if (window.Theme) stage.style.cursor = Theme.cursor('wait', 'progress');
      // Manche Aktionen liefern eine Funktion (Fenster öffnen): erst jetzt aufrufen und auf das Schließen warten
      try { await Promise.all(gains.pending.map((f) => (typeof f === 'function' ? f() : f))); } catch (e) { console.error(e); }
      if (window.Theme) stage.style.cursor = Theme.cursor('normal', 'pointer');
      if (myRun !== run) return null;
      run.blocked = false;
      renderHud();
      renderDebug();
    }
    // Kampf (oder Plugin) will in eine andere Szene springen
    if (run.jump) {
      const j = run.jump;
      run.jump = null;
      if (j === '@end') showEnd(); else enterScene(j, 0);
      return null;
    }
    return gains;
  };

  const showChoices = (clip) => {
    run.choicesShown = true;
    choiceBox.innerHTML = '';
    choiceBox.hidden = false;
    const box = el('div', { class: 'choice-box' });
    for (const o of clip.options) {
      const ok = VN.checkConds(o.conds, run.rs);
      if (!ok && o.hideLocked) continue;
      box.appendChild(el('button', {
        class: 'choice-btn' + (ok ? '' : ' locked'),
        title: ok ? '' : (o.conds || []).map(VN.condText).join(' und '),
        onmouseenter: () => { if (ok) uiSound('hover'); },
        onclick: async (e) => {
          e.stopPropagation();
          if (!ok || run.blocked) return;
          uiSound('click');
          choiceBox.hidden = true;
          run.choicesShown = false;
          run.pendingChoice = null;
          const myRun = run;
          if (window.VNPlugin) VNPlugin.hook('onChoice', o, clip, ctx());
          const gains = await doActions(VN.Life ? VN.Life.optActions(o) : o.actions, o.id);
          if (myRun !== run || gains === null) return;
          showGains(gains);
          if (o.target && VN.scene(o.target)) enterScene(o.target, 0);
          else nextBeat();
        }
      }, Fx.plain(VN.Extras ? VN.Extras.fill(VN.tr(o.id, o.text || 'Option'), run.rs) : VN.tr(o.id, o.text || 'Option'))));
    }
    if (window.Theme) Theme.styleChoices(box, Theme.choice(clip));
    // Zeitlimit: Balken läuft ab, dann wird die Standard-Antwort gewählt
    if (clip.timer > 0) {
      const bar = el('span');
      box.appendChild(el('div', { class: 'choice-timer' }, bar));
      bar.animate([{ width: '100%' }, { width: '0%' }], { duration: clip.timer * 1000, fill: 'forwards' });
      const myRun = run;
      later(() => {
        if (run !== myRun || !run.choicesShown || run.pendingChoice !== clip) return;
        const btns = Array.from(box.querySelectorAll('.choice-btn:not(.locked)'));
        const pick = btns[Math.min(btns.length - 1, Math.max(0, clip.timeoutIdx || 0))] || btns[0];
        if (pick) pick.click();
      }, clip.timer * 1000);
    }
    choiceBox.appendChild(box);
  };

  const showMessage = (content, then) => {
    run.message = then || (() => {});
    msgBox.innerHTML = '';
    msgBox.appendChild(el('div', { class: 'pl-msg' }, content));
    msgBox.hidden = false;
  };
  // Ja/Nein-Frage im Spiel (z. B. „Bäckerei für 500 Gold kaufen?“)
  const askYesNo = (content, yesLabel, noLabel) => new Promise((resolve) => {
    run.blocked = 'ask';
    msgBox.innerHTML = '';
    const done = (v) => (e) => { if (e) e.stopPropagation(); if (run.blocked === 'ask') run.blocked = null; msgBox.hidden = true; msgBox.innerHTML = ''; uiSound(v ? 'click' : 'close'); resolve(v); };
    msgBox.appendChild(el('div', { class: 'pl-msg pl-ask' }, content,
      el('div', { class: 'pl-ask-btns' },
        el('button', { class: 'pl-ask-yes', onclick: done(true) }, yesLabel || VN.tp('Ja')),
        el('button', { class: 'pl-ask-no', onclick: done(false) }, noLabel || VN.tp('Abbrechen')))));
    msgBox.hidden = false;
  });
  // Preis eines Hub-Objekts: { cur, amount, name }
  const objPrice = (o) => {
    const pr = o.price;
    if (!pr || !pr.cur || !(Number(pr.amount) > 0)) return null;
    const c = VN.project.currencies.find((x) => x.id === pr.cur);
    return c ? { cur: c.id, amount: Number(pr.amount), name: VN.tr(c.id + ':name', c.name) } : null;
  };

  const updateInfo = () => {
    if (VN.gameMode) { info.hidden = true; return; }
    const s = VN.scene(run.scene);
    info.textContent = s ? (s.type === 'hub' ? s.name : s.name + ' · Schritt ' + (run.beat + 1) + '/' + s.beats) : '';
  };

  const renderHud = () => {
    if (!hud || !run) { if (hud) hud.innerHTML = ''; return; }
    hud.innerHTML = '';
    WD.drawCtrl();
    const p = VN.project;
    hud.classList.toggle('right', !!(window.Theme && Theme.gain().hud === 'right'));
    if (VN.Life && VN.Life.timeOn() && p.time.hud !== false) {
      const chip = el('span', { class: 'money-chip time-chip' }, '🕰 ' + VN.Life.timeText(VN.Life.initRun(run.rs)));
      if (window.UiDesign) UiDesign.applyChip('time', chip);
      hud.appendChild(chip);
    }
    if (VN.Life && VN.Life.hudExtra) VN.Life.hudExtra(hud, run.rs);
    if (window.VNPlugin) for (const n of VNPlugin.hudItems(run.rs)) hud.appendChild(n);
    if (VN.Extras) for (const v of VN.Extras.stats()) if (v.hud) hud.appendChild(el('span', { class: 'money-chip st-chip' }, v.icon && VN.assetUrl(v.icon) ? el('span', { class: 'mc-ico', style: { backgroundImage: `url("${VN.assetUrl(v.icon)}")` } }) : el('span', { class: 'mc-dot', style: { background: v.color || '#e8a43a' } }), VN.tr(v.id + ':name', v.name) + ' ' + (Number(run.rs.vars[v.id]) || 0)));
    if (!p.inventory.hudMoney) return;
    for (const c of p.currencies) hud.appendChild(VN.moneyChip(c, run.rs.money[c.id] || 0));
  };

  const renderDebug = () => {
    if (!debugBox || debugBox.hidden || !run) return;
    const p = VN.project, rs = run.rs;
    debugBox.innerHTML = '';
    debugBox.append(
      el('strong', null, 'Werte (F2)'),
      el('div', { class: 'muted' }, 'Seed ' + rs.seed + (VN.lang ? ' · Sprache ' + VN.lang : '')),
      ...p.vars.map((v) => el('div', null, v.name + ': ' + (v.type === 'flag' ? (rs.vars[v.id] ? 'an' : 'aus') : rs.vars[v.id]))),
      ...p.currencies.map((c) => el('div', null, c.name + ': ' + (rs.money[c.id] || 0))),
      VN.Life && VN.Life.timeOn() ? el('div', null, 'Zeit: ' + VN.Life.timeText(VN.Life.initRun(rs))) : null,
      ...(VN.Life && VN.Life.debugRows ? VN.Life.debugRows(rs) : []),
      el('div', { class: 'muted' }, 'Inventar: ' + (Object.entries(rs.inv).map(([id, n]) => { const it = p.items.find((x) => x.id === id); return (it ? it.name : id) + ' ×' + n; }).join(', ') || 'leer')));
  };

  const ctx = () => (window.VNPlugin ? VNPlugin.makeCtx(run.rs) : null);

  // ---------- Ablauf ----------
  function enterScene(id, beat, opts = {}) {
    stopWait();
    const s = VN.scene(id);
    if (!s) return showEnd();
    if (run.replay && id !== run.replay) return endReplay();
    // Welt & Orte: Ort betreten → wartet dort ein Ereignis?
    if (VN.World && VN.World.on() && VN.World.isLoc(id) && !opts.noEvent && !run.replay) {
      const st = VN.World.state(run.rs);
      st.here = id;
      if (window.VNPlugin) VNPlugin.hook('onLocation', id, ctx());
      const ev = VN.World.pickEvent(run.rs, id);
      if (ev) { st.done[ev.id] = Date.now(); st.ret = id; return enterScene(ev.scene, 0, { noEvent: true }); }
    }
    run.scene = id;
    run.beat = beat || 0;
    run.rs.seen[id] = true;
    WD.drawCtrl();
    if (VN.Extras) { VN.Extras.mark('seen', id); VN.Extras.checkAch(run.rs); }
    if (VN.Quests && VN.Quests.on()) { const g = []; g.pending = []; VN.Quests.emit(VN.Quests.update(run.rs), g); if (g.length) { const myRun = run; later(() => { if (run === myRun) showGains(g); }, 500); } }
    choiceBox.hidden = true;
    msgBox.hidden = true;
    clearSpot();
    if (window.VNPlugin) VNPlugin.hook('onSceneEnter', s, ctx());
    if (window.Perf) Perf.preloadAround(id);
    if (!opts.restored) autosave();
    if (s.type === 'hub') { stopAmbient(); showFxExtra([]); return showHub(s, true); }
    hubBox.innerHTML = '';
    enterBeat(run.beat, opts);
  }

  async function enterBeat(b, opts = {}) {
    const s = VN.scene(run.scene);
    run.beat = b;
    run.choicesShown = false;
    choiceBox.hidden = true;
    updateInfo();
    const st = Stage.state(s, b);
    if (st.bg) showBg(st.bg.asset, st.bg.trans, st.bg.dur, st.bg); else if (run.bg) showBg(null, 'fade', 0.5);
    showChars(st.chars, b);
    for (const [key, clip] of st.chars) if (clip.gestures && clip.gestures[b] && run.chars[key] && window.Anim) Anim.gesture(run.chars[key].el, clip.gestures[b]);
    showFx(st.fx);
    showVideo(st.video, b);
    applyCamera(st, b);
    if (st.music && st.music.asset) playMusic(st.music);
    else if (A.music && !A.music.carry) stopMusic(1);
    stopVoice();
    const tl = VN.tracksOf(s);
    for (const t of tl) {
      if ((t.base !== 'voice' && t.base !== 'sfx') || !VN.trackOn(s, t, tl)) continue;
      for (const c of s.tracks[t.key] || []) if (c.start === b && c.asset) { playOnce(c.asset, c.vol, c.delay, t.base, c.in, c.out, t.key === 'voice' ? c : null); if (t.base === 'sfx' && c.caption) E.caption(VN.tr(c.id + ':cap', c.caption)); }
    }
    showAmbient(st.musicX || []);
    showFxExtra(st.fxX || []);
    if (window.VNPlugin) VNPlugin.hook('onBeat', s, b, ctx());
    if (run.blocked === 'video') { run.pendingDialog = st.dialog; } else showDialog(st.dialog);
    run.pendingChoice = st.choice;
    if (st.dialog && st.dialog.start === b && st.dialog.actions && st.dialog.actions.length && !run.rs.fired[st.dialog.id]) {
      run.rs.fired[st.dialog.id] = true;
      const myRun = run;
      const gains = await doActions(st.dialog.actions, st.dialog.id);
      if (myRun !== run || gains === null) return;
      showGains(gains);
    }
    if (!st.dialog && st.choice) showChoices(st.choice);
  }

  function nextBeat() {
    const s = VN.scene(run.scene);
    const WS = VN.World && VN.World.on() ? VN.World.state(run.rs) : null;
    if (run.beat + 1 < s.beats) enterBeat(run.beat + 1);
    else if (WS && s.next === '@home' && VN.World.isLoc(VN.World.cfg().home)) { WS.ret = ''; enterScene(VN.World.cfg().home, 0); }
    else if (WS && (s.next === '@return' || (!s.next && WS.ret)) && VN.World.isLoc(WS.ret || WS.here)) { const t = WS.ret || WS.here; WS.ret = ''; enterScene(t, 0); }
    else if (s.next && VN.scene(s.next)) enterScene(s.next, 0);
    else showEnd();
  }

  const clearSpot = () => { if (run) { run.lockTo = null; run.event = null; } if (stage) stage.querySelectorAll('.pl-spot, .pl-pointer').forEach((n) => n.remove()); };

  function showHub(s, entering) {
    updateInfo();
    stopTyping();
    dlgBox.hidden = true;
    run.pendingChoice = null;
    if (entering) {
      for (const k of Object.keys(run.chars)) removeChar(k);
      showFx(null);
      showVideo(null);
      phoneBox.innerHTML = '';
      applyCamera({ cam: null }, 0);
      showBg(s.bg, 'fade', 0.8, s.bgLook);
      if (s.music) playMusic({ asset: s.music, vol: 70, loop: true, carry: true, fade: 1 });
      else if (A.music && !A.music.carry) stopMusic(1);
      stopVoice();
    }
    hubBox.innerHTML = '';
    for (const o of s.objects) {
      if (!VN.checkConds(o.conds, run.rs)) continue;
      if (o.once === 'hide' && run.rs.seen['obj:' + o.id]) continue;
      const url = VN.assetUrl(o.asset);
      const hovUrl = o.hoverAsset ? VN.assetUrl(o.hoverAsset) : '';
      const look = url ? el('img', { src: url, draggable: 'false', class: hovUrl ? 'base' : null }) : el('div', { class: 'ph' }, VN.tr(o.id + ':name', o.name || 'Objekt'));
      VN.applyLook(look, o);
      const node = el('div', {
        class: 'pl-hobj' + ((o.hover || 'glow') !== 'none' ? ' hover-' + (o.hover || 'glow') : '') + (hovUrl ? ' has-hov' : ''),
        style: { left: o.x + '%', top: o.y + '%', width: o.w + '%', height: o.h + '%', transform: 'rotate(' + (o.rot || 0) + 'deg)', pointerEvents: 'none' }
      }, look, hovUrl ? el('img', { src: hovUrl, draggable: 'false', class: 'hov' }) : null, o.name ? el('div', { class: 'tip' }, VN.tr(o.id + ':name', o.name)) : null);
      if (o.glowColor) node.style.setProperty('--glow', o.glowColor);
      const hit = el('div', {
        style: { position: 'absolute', inset: '0', borderRadius: o.shape === 'ellipse' ? '50%' : '0', pointerEvents: 'auto', cursor: window.Theme ? Theme.cursor('hub', 'pointer') : 'pointer' },
        onmouseenter: () => { node.classList.add('hov-on'); uiSound('hover'); },
        onmouseleave: () => node.classList.remove('hov-on'),
        onclick: async (e) => {
          e.stopPropagation();
          if (run.message || run.event || run.overlay || run.blocked) return;
          if (run.lockTo && run.lockTo !== o.id) return;
          if (run.lockTo === o.id) clearSpot();
          if (run.holding) { await E.useOn(o); return; }
          // Nur einmal: danach ohne Wirkung (oder verschwunden, siehe oben)
          if (o.once && run.rs.seen['obj:' + o.id]) { if (o.doneMsg) showMessage(el('div', null, VN.tr(o.id + ':done', o.doneMsg))); return; }
          // Preis: Geld prüfen, auf Wunsch nachfragen, abziehen
          const pr = objPrice(o);
          if (pr) {
            const have = run.rs.money[pr.cur] || 0;
            if (have < pr.amount) { uiSound('close'); showMessage(el('div', null, VN.tp('Nicht genug {cur}: {n} nötig, du hast {have}.').replace('{cur}', pr.name).replace('{n}', pr.amount).replace('{have}', have))); return; }
            if (o.confirm !== false) {
              const q = (o.buyText ? VN.tr(o.id + ':buy', o.buyText) : VN.tp('{what} für {n} {cur} kaufen?').replace('{what}', o.buyWhat ? VN.tr(o.id + ':what', o.buyWhat) : VN.tr(o.id + ':name', o.name || VN.tp('Das'))).replace('{n}', pr.amount).replace('{cur}', pr.name));
              const ok = await askYesNo(el('div', null, q), VN.tp('Kaufen'), VN.tp('Abbrechen'));
              if (!ok) return;
            }
            VN.addMoney(run.rs, pr.cur, -pr.amount);
            renderHud();
          }
          if (o.once) run.rs.seen['obj:' + o.id] = true;
          if (o.sfx) playOnce(o.sfx, 90, 0, 'sfx');
          const myRun = run;
          const g0 = await doActions(o.actions, o.id);
          if (myRun !== run || g0 === null) return;
          const gains = g0 || [];
          const go = () => {
            if (o.target && VN.scene(o.target)) enterScene(o.target, 0);
            else showHub(VN.scene(run.scene), false);
          };
          // Beziehungs-Änderungen haben ihre eigene Einblendung (nicht als „Gefunden“ zeigen)
          const relG = gains.filter((g) => g.kind === 'rel');
          if (relG.length) showGains(relG);
          const real = gains.filter((g) => !g.empty && g.kind !== 'rel');
          const parts = [];
          if (o.message) parts.push(el('div', null, VN.tr(o.id + ':msg', o.message)));
          if (real.length) parts.push(el('div', { class: 'pl-found' }, el('div', { class: 'pl-gain-title' }, pr ? VN.tp('Gekauft') : 'Gefunden'), ...real.map((g) => el('div', null, VN.lootName(g)))));
          else if (gains.some((g) => g.empty) && !o.message) parts.push(el('div', null, 'Hier ist nichts mehr.'));
          renderHud();
          if (parts.length) showMessage(el('div', null, ...parts), go); else go();
        }
      });
      node.appendChild(hit);
      hubBox.appendChild(node);
    }
    if (entering) runHubEvents(s);
  }

  // Hub-Ereignisse (z. B. Tutorial)
  function runHubEvents(s) {
    const queue = (s.events || []).filter((ev) => {
      if (!VN.checkConds(ev.conds, run.rs)) return false;
      if ((ev.trigger || 'first') === 'first' && run.rs.seen['ev:' + ev.id]) return false;
      return ev.lines && ev.lines.length;
    });
    if (!queue.length) return;
    const ev = queue[0];
    run.rs.seen['ev:' + ev.id] = true;
    run.event = { ev, i: 0, scene: s };
    const target = ev.spotlight ? s.objects.find((o) => o.id === ev.spotlight) : null;
    if (target) {
      const pad = 1.5;
      stage.appendChild(el('div', { class: 'pl-spot', style: { left: (target.x - pad) + '%', top: (target.y - pad * 1.6) + '%', width: (target.w + pad * 2) + '%', height: (target.h + pad * 3.2) + '%' } }));
      stage.appendChild(el('div', { class: 'pl-pointer', style: { left: (target.x + target.w / 2) + '%', top: Math.max(2, target.y - 9) + '%' } }, '▼'));
    }
    showEventLine();
  }
  function showEventLine() {
    const { ev, i, scene } = run.event;
    const l = ev.lines[i];
    showDialog({ id: l.id, speaker: l.speaker, color: l.color || '#c4b2ff', text: l.text, speed: 40 }, { speaker: VN.tr(VN.speakerKey(l.speaker), l.speaker), text: VN.tr(l.id, l.text || '') });
    const target = ev.spotlight ? scene.objects.find((o) => o.id === ev.spotlight) : null;
    const box = dlgBox.querySelector('.dlg-box');
    if (box && target && target.y + target.h > 62) box.classList.add('top');
  }
  function advanceEvent() {
    if (run.typing) return stopTyping(true);
    run.event.i++;
    if (run.event.i < run.event.ev.lines.length) return showEventLine();
    const ev = run.event.ev;
    run.event = null;
    dlgBox.hidden = true;
    if (ev.spotlight && ev.lock) run.lockTo = ev.spotlight;
    else clearSpot();
  }

  function showEnd() {
    if (run && run.replay) return endReplay();
    stopTyping();
    stopAmbient();
    run.ended = true;
    const hasMenu = VN.project.mainMenu && VN.project.mainMenu.enabled !== false;
    stage.appendChild(el('div', { class: 'pl-end' },
      el('h2', null, 'ENDE'),
      el('div', { class: 'muted', style: { fontSize: '2.4cqh' } }, 'Danke fürs Spielen!'),
      el('div', { class: 'row' },
        hasMenu ? el('button', { class: 'btn primary', onclick: (e) => { e.stopPropagation(); showMainMenu(); } }, 'Hauptmenü') : el('button', { class: 'btn primary', onclick: (e) => { e.stopPropagation(); newGame(session.startScene); } }, 'Nochmal von vorn'),
        VN.gameMode ? null : el('button', { class: 'btn', onclick: (e) => { e.stopPropagation(); Player.close(); } }, 'Zurück zum Editor'))));
  }

  // ---------- Spielstände ----------
  const makeSave = () => {
    const s = VN.scene(run.scene);
    const st = s && s.type === 'story' ? Stage.state(s, run.beat) : null;
    return {
      v: 1, time: Date.now(), scene: run.scene, beat: run.beat, rs: JSON.parse(JSON.stringify(run.rs)), lang: VN.lang,
      sceneName: s ? s.name : '', text: st && st.dialog ? VN.tr(st.dialog.id, st.dialog.text || '').slice(0, 90) : (s && s.type === 'hub' ? s.name : ''),
      bg: run.bg, music: A.music ? { asset: A.music.asset, carry: A.music.carry, vol: A.music.vol, loop: A.music.loop } : null
    };
  };
  const autosave = () => { if (store() && run && !run.restoring) store().write('auto', makeSave()).catch(() => {}); };
  const quicksave = async () => { if (!store() || !run || run.ended) return; await store().write('quick', makeSave()); uiSound('save'); VN.toast('Schnellgespeichert (F9 lädt)'); };
  const latestSave = async () => {
    if (!store()) return null;
    const all = await store().list();
    let best = null;
    for (const [slot, d] of Object.entries(all)) if (d && d.time && (!best || d.time > best.d.time)) best = { slot, d };
    return best ? best.d : null;
  };

  function beginRun(startScene) {
    clearTimers();
    stopVoice();
    menuBox.innerHTML = '';
    menuBox.hidden = true;
    overlayBox.innerHTML = '';
    overlayBox.hidden = true;
    for (const n of stage.querySelectorAll('.pl-end, .plugin-overlay, .pl-spot, .pl-pointer')) n.remove();
    charsBox.innerHTML = ''; fxBox.innerHTML = ''; hubBox.innerHTML = ''; dlgBox.hidden = true; choiceBox.hidden = true; msgBox.hidden = true; gainBox.hidden = true;
    partBox.innerHTML = ''; phoneBox.innerHTML = ''; parBack.innerHTML = ''; parFront.innerHTML = ''; world.style.filter = '';
    stage.querySelectorAll('.vid-layer, .gl-pop').forEach((n) => n.remove());
    Fx.applyCam(world, Fx.CAM0, 0);
    bgLayers.forEach((b) => { b.style.transition = 'none'; b.style.opacity = '0'; });
    E.stopModes();
    E.dropHold();
    run = { startScene, scene: null, beat: 0, bg: null, bgKey: null, bgIndex: 0, chars: {}, fx: null, typing: null, pendingChoice: null, choicesShown: false, message: null, ended: false, rs: VN.newRunState(), event: null, lockTo: null, overlay: null, blocked: false };
    run.rs.fired = run.rs.fired || {};
    ctrl.hidden = false;
    hud.hidden = false;
    IDP.startClock();
  }

  function newGame(sceneId, beat) {
    const id = sceneId || VN.project.startScene;
    beginRun(id);
    renderHud();
    if (window.VNPlugin) VNPlugin.hook('onStart', ctx());
    enterScene(id, beat || 0);
  }

  function loadSave(d) {
    if (!d || !VN.scene(d.scene)) return VN.toast('Spielstand passt nicht mehr zum Projekt');
    beginRun(d.scene);
    run.rs = Object.assign(VN.newRunState(), d.rs);
    run.rs.fired = run.rs.fired || {};
    IDP.resume();
    if (d.lang && VN.project.languages.includes(d.lang)) VN.lang = d.lang;
    if (d.music && d.music.asset) playMusic(Object.assign({ fade: 0.5 }, d.music)); else stopMusic(0.5);
    renderHud();
    if (window.VNPlugin) { VNPlugin.hook('onStart', ctx()); VNPlugin.hook('onLoad', ctx()); }
    enterScene(d.scene, d.beat || 0, { restored: true });
  }

  // ---------- Bildschirme: Hauptmenü, Pause, Speichern/Laden, Einstellungen ----------
  const uiSound = (k) => { if (window.Theme) Theme.sound(k); };
  const closeOverlay = () => { if (!overlayBox.hidden) uiSound('close'); overlayBox.innerHTML = ''; overlayBox.hidden = true; overlayBox.removeAttribute('style'); if (run) { run.overlay = null; if (run.afterOverlay) { const f = run.afterOverlay; run.afterOverlay = null; setTimeout(f, 250); } } };
  let panelKind = 'pause';
  const panel = (title, ...children) => {
    if (overlayBox.hidden) uiSound('open');
    overlayBox.innerHTML = '';
    overlayBox.hidden = false;
    const p = el('div', { class: 'sys-panel' }, el('div', { class: 'sys-title' }, title), ...children);
    p.addEventListener('click', (e) => e.stopPropagation());
    overlayBox.appendChild(p);
    if (window.Theme) Theme.styleSys(overlayBox, p, panelKind);
    return p;
  };
  // Für Lebenssimulation (Beziehungen, Geschenke): Fenster im Stil der Systemmenüs
  const lifeUi = { panel: (...a) => panel(...a), sysBtn: (...a) => sysBtn(...a), close: () => closeOverlay(), panelKind: (k) => { panelKind = k; if (run) run.overlay = 'life'; } };
  const sysBtn = (label, fn, cls) => el('button', { class: 'sys-btn' + (cls ? ' ' + cls : ''), onmouseenter: () => uiSound('hover'), onclick: (e) => { e.stopPropagation(); uiSound('click'); fn(); } }, label);

  async function showMainMenu() {
    try { CBP.abort(); } catch (e) { /* Spieler noch nicht fertig aufgebaut */ }
    stopAmbient();
    const p = VN.project;
    clearTimers();
    stopVoice();
    run = null;
    for (const n of stage.querySelectorAll('.pl-end, .plugin-overlay, .pl-spot, .pl-pointer')) n.remove();
    charsBox.innerHTML = ''; fxBox.innerHTML = ''; hubBox.innerHTML = ''; dlgBox.hidden = true; choiceBox.hidden = true; msgBox.hidden = true; gainBox.hidden = true;
    closeOverlay();
    ctrl.hidden = true;
    hud.hidden = true;
    info.textContent = '';
    menuBox.innerHTML = '';
    menuBox.hidden = false;
    const m = p.mainMenu;
    if (m.music) playMusic({ asset: m.music, vol: 70, loop: true, carry: false, fade: 1 }); else stopMusic(1);
    const latest = await latestSave();
    Menu.screen(menuBox, {
      live: true,
      disabled: (b) => b.action === 'continue' && !latest,
      onAction: async (b) => {
        if (b.action === 'new') newGame(session.startScene);
        else if (b.action === 'scene') newGame(b.scene || session.startScene);
        else if (b.action === 'continue') { const d = await latestSave(); if (d) loadSave(d); }
        else if (b.action === 'load') saveScreen('load', true);
        else if (b.action === 'settings') settingsScreen(true);
        else if (b.action === 'gallery') E.galleryScreen('menu');
        else if (b.action === 'achievements') E.achScreen('menu');
        else if (b.action === 'quit') { if (VN.gameMode) VN.api.quit(); else Player.close(); }
      }
    });
  }

  function pauseMenu() {
    if (!run) return;
    if (run.overlay === 'pause') return closeOverlay();
    run.overlay = 'pause';
    panelKind = 'pause';
    const hasMenu = VN.project.mainMenu && VN.project.mainMenu.enabled !== false;
    panel('Pause',
      sysBtn('Weiter', closeOverlay, 'primary'),
      sysBtn('Speichern', () => saveScreen('save')),
      sysBtn('Laden', () => saveScreen('load')),
      sysBtn('Einstellungen', () => settingsScreen()),
      sysBtn('Verlauf', () => E.logScreen(true)),
      VN.Extras && VN.Extras.statsOn() ? sysBtn('Werte', () => E.statsScreen(true)) : null,
      VN.Extras && VN.Extras.galleryOn() ? (() => { const b = sysBtn('Galerie', () => E.galleryScreen(true)); const n = VN.Extras.newCount(); if (n) { b.classList.add('has-new'); b.appendChild(el('span', { class: 'sys-new' }, String(n))); } return b; })() : null,
      VN.Quests && VN.Quests.on() && VN.Quests.cfg().inMenu !== false ? sysBtn('Questlog (' + (VN.Quests.cfg().key || 'q').toUpperCase() + ')', () => { closeOverlay(); NT.questScreen(true); }) : null,
      VN.Skills && VN.Skills.on() && VN.Skills.cfg().inMenu !== false && VN.Skills.trees().some((t) => (t.nodes || []).length) ? sysBtn('Skilltree (' + (VN.Skills.cfg().key || 't').toUpperCase() + ')', () => { closeOverlay(); SKP.screen(null, true); }) : null,
      VN.Combat && VN.Combat.on() && VN.Combat.cfg().partyInMenu !== false && VN.Combat.state(run.rs).party.length ? sysBtn('Gruppe (G)', () => CBP.partyScreen(true)) : null,
      VN.Idle && VN.Idle.on() && VN.Idle.cfg().buildings.length && VN.Idle.cfg().inMenu ? sysBtn(VN.tr('idle:title', VN.Idle.cfg().title || 'Aufbau') + ' (' + (VN.Idle.cfg().key || 'k').toUpperCase() + ')', () => { closeOverlay(); IDP.open(true); }) : null,
      VN.Extras && VN.Extras.achOn() ? sysBtn('Erfolge', () => E.achScreen(true)) : null,
      ...(window.VNPlugin ? VNPlugin.menuEntries(run.rs).map((m) => sysBtn(m.label + (m.key ? ' (' + m.key.toUpperCase() + ')' : ''), () => runPluginMenu(m, true))) : []),
      (VN.project.glossary || []).length ? sysBtn('Glossar', () => glossaryScreen()) : null,
      VN.World && VN.World.on() && VN.World.cfg().inMenu && VN.World.maps().length ? sysBtn('Karte (M)', () => { closeOverlay(); WD.openMap(); }) : null,
      VN.Life && VN.Life.relOn() && VN.project.relations.inMenu !== false ? sysBtn('Beziehungen', () => { const r = run; VN.Life.relScreen(run.rs).then(() => { if (run === r) pauseMenu(); }); }) : null,
      hasMenu ? sysBtn('Hauptmenü', () => showMainMenu()) : null,
      VN.gameMode ? sysBtn('Spiel beenden', () => VN.api.quit()) : sysBtn('Zurück zum Editor', () => Player.close()));
  }

  // Plugin-Eintrag im Pausenmenü oder per Taste
  async function runPluginMenu(m, fromPause) {
    if (!run) return;
    closeOverlay();
    run.overlay = null;
    try { await m.run(VNPlugin.makeCtx(run.rs, m.plugin)); } catch (e) { console.error('Plugin-Menü ' + m.plugin, e); }
    renderHud(); renderDebug();
    if (fromPause && run && !run.overlay) pauseMenu();
  }

  function glossaryScreen() {
    if (run) run.overlay = 'gloss';
    panelKind = 'pause';
    const got = (run && run.rs.gloss) || {};
    const list = (VN.project.glossary || []).filter((e) => got[e.id]);
    panel('Glossar',
      list.length ? el('div', { class: 'gl-list' }, ...list.map((e) => el('div', { class: 'gl-entry' },
        e.image && VN.assetUrl(e.image) ? el('div', { class: 'gl-img sm', style: { backgroundImage: `url("${VN.assetUrl(e.image)}")` } }) : null,
        el('div', null, el('strong', null, VN.tr(e.id + ':term', e.term)), el('div', { class: 'gl-text' }, VN.tr(e.id + ':text', e.text || '')))))) : el('div', { style: { opacity: '0.7', textAlign: 'center' } }, 'Noch keine Einträge entdeckt.'),
      el('div', { style: { opacity: '0.6', fontSize: '2cqh', textAlign: 'center' } }, list.length + ' von ' + VN.project.glossary.length + ' Einträgen'),
      sysBtn('Zurück', () => { run.overlay = null; pauseMenu(); }));
  }

  // ---------- Speichern/Laden und Einstellungen (player-menus.js) ----------
  const { saveScreen, settingsScreen } = VN.PlayerMenus({
    run: () => run, setPanelKind: (k) => { panelKind = k; }, A, volOf,
    store: () => store(), makeSave: () => makeSave(), uiSound: (k) => uiSound(k), closeOverlay: () => closeOverlay(), loadSave: (d) => loadSave(d),
    panel: (...x) => panel(...x), sysBtn: (...x) => sysBtn(...x), pauseMenu: () => pauseMenu(), saveSettings: () => saveSettings(), refreshTexts: () => refreshTexts(),
    a11y: (fromMenu) => E.a11yScreen(fromMenu ? 'menu' : false)
  });

  // ---------- Verlauf, Auto/Skip, Galerie, Erfolge, Werte … (player-extras.js) ----------
  function replay(id) { newGame(id, 0); if (run) run.replay = id; }
  function endReplay() { if (run) run.replay = null; showMainMenu().then(() => E.galleryScreen('menu')); }
  const E = VN.PlayerExtras({
    run: () => run, stage: () => stage, setPanelKind: (k) => { panelKind = k; }, A,
    panel: (...x) => panel(...x), sysBtn: (...x) => sysBtn(...x), closeOverlay: () => closeOverlay(), pauseMenu: () => pauseMenu(),
    advance: () => Player.advance(), saveSettings: () => saveSettings(), settingsScreen: (m) => settingsScreen(m), showMainMenu: () => showMainMenu(),
    replay: (id) => replay(id), doActions: (l, k) => doActions(l, k), showGains: (g) => showGains(g), showMessage: (c, t) => showMessage(c, t),
    enterScene: (id, b) => enterScene(id, b), refreshHub: () => { const s = VN.scene(run.scene); if (s && s.type === 'hub') showHub(s, false); renderHud(); }
  });

  const NT = VN.PlayerNotify({
    run: () => run, stage: () => stage, A, uiSound: (k) => uiSound(k), pauseMenu: () => pauseMenu(), refresh: () => renderHud(),
    charPos: (c) => { const ch = Object.values(run.chars).find((x) => x.clip && Fx.isSpeaker(x.clip, c.name)); if (!ch) return null; const b = ch.el.getBoundingClientRect(), sb = stage.getBoundingClientRect(); return { x: Math.round((b.left + b.width / 2 - sb.left) / sb.width * 100), y: Math.max(6, Math.round((b.top - sb.top) / sb.height * 100) + 4) }; }
  });
  const SKP = VN.PlayerSkills({ run: () => run, stage: () => stage, uiSound: (k) => uiSound(k), pauseMenu: () => pauseMenu(),
    afterChange: (gains) => { if (VN.Quests && VN.Quests.on()) VN.Quests.emit(VN.Quests.update(run.rs), gains); if (VN.Extras) VN.Extras.checkAch(run.rs); renderHud(); if (gains && gains.length) showGains(gains); if (gains && gains.pending) for (const f of gains.pending) try { f(); } catch (e) { console.error(e); } } });
  const CBP = VN.PlayerCombat({ run: () => run, stage: () => stage, uiSound: (k) => uiSound(k), A, panel: (...x) => panel(...x), sysBtn: (...x) => sysBtn(...x), closeOverlay: () => closeOverlay(), pauseMenu: () => pauseMenu(), setPanelKind: (k) => { panelKind = k; }, playMusic: (x) => playMusic(x), stopMusic: (x) => stopMusic(x), sfx: (a) => playOnce(a, 90, 0, 'sfx'), saveSettings: () => saveSettings(), ctx: () => ctx(),
    afterChange: (gains) => { skillPts(gains); if (VN.Quests && VN.Quests.on()) VN.Quests.emit(VN.Quests.update(run.rs), gains); if (VN.Extras) VN.Extras.checkAch(run.rs); renderHud(); renderDebug(); if (gains && gains.length) showGains(gains); if (gains && gains.pending) for (const f of gains.pending) if (typeof f === 'function') try { f(); } catch (e) { console.error(e); } } });
  const IDP = VN.PlayerIdle({ run: () => run, stage: () => stage, uiSound: (k) => uiSound(k), pauseMenu: () => pauseMenu(), refreshHud: () => { renderHud(); renderDebug(); },
    afterChange: (gains) => { skillPts(gains); if (VN.Quests && VN.Quests.on()) VN.Quests.emit(VN.Quests.update(run.rs), gains); if (VN.Extras) VN.Extras.checkAch(run.rs); renderHud(); renderDebug(); if (gains && gains.length) showGains(gains); if (gains && gains.pending) for (const f of gains.pending) if (typeof f === 'function') try { f(); } catch (e) { console.error(e); } } });
  const WD = VN.PlayerWorld({ run: () => run, stage: () => stage, uiSound: (k) => uiSound(k), enterScene: (id, b) => enterScene(id, b) });

  const toggleInventory = () => {
    if (!run || !VN.project.inventory.enabled) return;
    if (run.overlay === 'inv') return closeOverlay();
    if (run.overlay) return;
    overlayBox.innerHTML = '';
    overlayBox.removeAttribute('style');
    uiSound('open');
    overlayBox.appendChild(Systems.inventoryEl(run.rs, { onClose: toggleInventory, onUse: (it) => E.useItem(it), onCombine: (a, b) => { const r = E.combine(a, b, run.rs); renderHud(); return r; }, canUse: (it) => VN.Extras.canUse(it) || (VN.Extras.offersUse(it) && (VN.scene(run.scene) || {}).type === 'hub' && (VN.scene(run.scene).objects || []).some((o) => o.useItem === it.id)) }));
    overlayBox.hidden = false;
    run.overlay = 'inv';
    VN.did(run.rs, 'screen', 'inv');
  };

  const refreshTexts = () => {
    const s = VN.scene(run.scene);
    if (!s) return;
    if (s.type === 'hub') { showHub(s, false); if (run.event) showEventLine(); }
    else {
      const st = Stage.state(s, run.beat);
      showDialog(st.dialog);
      stopTyping(true);
      if (run.choicesShown && run.pendingChoice) showChoices(run.pendingChoice);
    }
  };

  const onKey = (e) => {
    if (run && run.overlay === 'relmsg') { e.preventDefault(); if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { const b = stage.querySelector('.rm-back'); if (b && b._close) b._close(); } return; }
    if (run && run.overlay === 'combat') { if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); CBP.onKey(e); } return; }
    if (e.key === 'Escape' && run && run.holding) { e.preventDefault(); E.dropHold(); return; }
    if (e.key === 'Escape' && run && run.overlay === 'map') { e.preventDefault(); WD.closeMap(); return; }
    if (e.key === 'Escape' && run && run.overlay === 'quests') { e.preventDefault(); const q = stage.querySelector('.ql-screen'); if (q) q._done(); return; }
    if (e.key === 'Escape' && run && run.overlay === 'skills') { e.preventDefault(); const q = stage.querySelector('.sk-screen'); if (q) q._done(); return; }
    if (e.key !== 'Escape' && SKP.onKey(e)) { e.preventDefault(); return; }
    if (e.key !== 'Escape' && CBP.menuKey(e)) { e.preventDefault(); return; }
    if (e.key === 'Escape' && run && run.overlay === 'idle') { e.preventDefault(); IDP.closeScreen(); return; }
    if (e.key !== 'Escape' && IDP.onKey(e)) { e.preventDefault(); return; }
    if (e.key !== 'Escape' && NT.onKey(e)) { e.preventDefault(); return; }
    if (e.key !== 'Escape' && WD.onKey(e)) { e.preventDefault(); return; }
    if (e.key !== 'Escape' && E.onKey(e)) { e.preventDefault(); return; }
    if (run && !run.overlay && !run.blocked && window.VNPlugin && e.key.length === 1) {
      const m = VNPlugin.menuEntries(run.rs).find((x) => x.key && x.key.toLowerCase() === e.key.toLowerCase());
      if (m) { e.preventDefault(); runPluginMenu(m, false); return; }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!run) { if (!overlayBox.hidden) closeOverlay(); else if (!VN.gameMode) Player.close(); return; }
      if (run.overlay === 'life') return;
      if (run.overlay && run.overlay !== 'pause') { if (run.overlay === 'inv') closeOverlay(); else { run.overlay = null; pauseMenu(); } }
      else pauseMenu();
    } else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); Player.advance(); }
    else if (e.key.toLowerCase() === 'i' && run) { e.preventDefault(); toggleInventory(); }
    else if (e.key.toLowerCase() === 'b' && run && !run.overlay && VN.Life && VN.Life.relOn()) { e.preventDefault(); VN.Life.relScreen(run.rs); }
    else if (e.key === 'F2') { e.preventDefault(); debugBox.hidden = !debugBox.hidden; renderDebug(); }
    else if ((e.code === 'Backquote' || e.key === 'F12' || e.key === 'Dead' || e.key === '^') && window.Perf && Perf.consoleAllowed()) { e.preventDefault(); Perf.toggleConsole(stage); }
    else if (e.key === 'F5') { e.preventDefault(); quicksave(); }
    else if (e.key === 'F9') { e.preventDefault(); if (store()) store().list().then((all) => { if (all.quick) { closeOverlay(); loadSave(all.quick); } else VN.toast('Kein Schnellspeicher'); }); }
  };

  let splashStop = null;   // stoppt den Intro-Jingle, wenn das Spiel mitten im Intro geschlossen wird
  // Start-Logos: Engine-Logo (Pflicht) und beliebig viele Studio-Logos (Bild oder Video) davor/danach
  function splash(done) {
    const L = Theme.t().logo;
    const items = Theme.logoItems ? Theme.logoItems() : [];
    // Engine-Logo: mindestens 5 Sekunden, nach 2 Sekunden überspringbar (Lizenzbedingung ab 0.7)
    const seq = [...items.filter((x) => x.when === 'before'), { kind: 'engine', dur: 5, skipAfter: 2 }, ...items.filter((x) => x.when !== 'before')];
    const mySession = session;
    const skipMode = L.skip || 'click';
    let i = 0, jingle = null, skipAll = false;
    const stopJingle = () => {
      splashStop = null; if (!jingle) return; const a = jingle; jingle = null; const t0 = a.volume; let k = 0; const iv = setInterval(() => { k++; a.volume = Math.max(0, t0 * (1 - k / 8)); if (k >= 8) { clearInterval(iv); a.pause(); } }, 50); };
    splashStop = () => stopJingle();
    if (L.jingle && VN.assetUrl(L.jingle)) { try { jingle = new Audio(VN.assetUrl(L.jingle)); jingle.volume = Math.min(1, ((L.jingleVol != null ? L.jingleVol : 90) / 100) * ((VN.settings.music != null ? VN.settings.music : 80) / 100)); jingle.play().catch(() => {}); } catch (e) { jingle = null; } }
    const next = () => {
      if (session !== mySession) { stopJingle(); return; }
      while (skipAll && i < seq.length && seq[i].kind !== 'engine') i++;
      if (i >= seq.length) { stopJingle(); return done(); }
      const it = seq[i++];
      const url = it.asset && VN.assetUrl(it.asset);
      let media;
      if (it.kind === 'engine') media = Theme.engineLogo();
      else if (it.kind === 'video' && url) media = el('video', { class: 'splash-img splash-vid', src: url, autoplay: true, playsinline: true });
      else media = url ? el('img', { class: 'splash-img', src: url, draggable: 'false', style: it.size ? { maxWidth: it.size + '%', maxHeight: it.size + '%' } : null }) : el('div');
      const box = el('div', { class: 'splash live tin-' + (it.kind === 'engine' ? 'fade' : (it.tin || 'fade')), style: { background: it.kind === 'engine' ? '#0b0b0e' : (it.bg || L.bg || '#000') } }, media);
      stage.appendChild(box);
      let gone = false;
      const out = () => { if (gone) return; gone = true; box.classList.add('out', 'tout-' + (it.kind === 'engine' ? 'fade' : (it.tout || 'fade'))); if (media.pause) media.pause(); setTimeout(() => { box.remove(); next(); }, 520); };
      const t0 = Date.now();
      box.addEventListener('click', (e) => {
        e.stopPropagation();
        if (it.kind === 'engine') { if (Date.now() - t0 < it.skipAfter * 1000) return; out(); return; }
        if (skipMode === 'none') return;
        if (skipMode === 'all') skipAll = true;
        out();
      });
      if (it.kind === 'video' && media.tagName === 'VIDEO') {
        media.volume = Math.min(1, (VN.settings.sfx != null ? VN.settings.sfx : 90) / 100);
        media.addEventListener('ended', out);
        media.addEventListener('error', out);
        if (Number(it.dur) > 0) later(out, Number(it.dur) * 1000);
        else later(out, 30000);
      } else later(out, (it.kind === 'engine' ? it.dur : (Number(it.dur) || 2.5)) * 1000);
    };
    next();
  }

  const Player = (window.Player = {
    get running() { return !!session; },
    get state() { return run; },
    get host() { return stage; },
    get _ui() { return lifeUi; },
    // Zeit hat sich geändert (z. B. durch ein Plugin): Anzeige und Tageszeit-Optik auffrischen
    onTime() { if (!run) return; if (run.bg) { const b = run.bg, l = run.bgClip; run.bgKey = null; showBg(b, 'fade', 1.4, l); } renderHud(); renderDebug(); },
    refreshHud: () => { renderHud(); renderDebug(); },

    // opts.menu: mit Hauptmenü beginnen
    start(sceneId, beat, opts = {}) {
      if (!VN.project) return;
      const p = VN.project;
      const id = sceneId || p.startScene || (p.scenes[0] && p.scenes[0].id);
      if (!VN.scene(id)) return VN.toast('Keine Szene zum Abspielen.');
      if (VN.save && !VN.gameMode) VN.save();
      if (window.Tour && Tour.active) Tour.stop(true);
      Player.close(true);
      if (VN.Audio) { VN.Audio.playing = true; VN.Audio.refresh(); }
      if (VN.stopPreview) VN.stopPreview();
      root = document.getElementById('player');
      root.innerHTML = '';
      stage = el('div', { class: 'pl-stage' });
      bgLayers = [el('img', { class: 'pl-bg', draggable: 'false' }), el('img', { class: 'pl-bg', draggable: 'false' })];
      black = el('div', { class: 'pl-black' });
      vig = el('div', { class: 'pl-vignette' });
      charsBox = el('div', { class: 'pl-chars' });
      fxBox = el('div', { class: 'pl-fx' });
      dayOv = el('div', { class: 'day-ov' });
      bgBox = el('div', { class: 'bg-box' }, bgLayers[0], bgLayers[1], dayOv);
      parBack = el('div', { class: 'par-box' });
      parFront = el('div', { class: 'par-box front' });
      partBox = el('div', { class: 'pl-parts' });
      phoneBox = el('div', { class: 'pl-phone' });
      charsBox.dataset.depth = 1; fxBox.dataset.depth = 1; bgBox.dataset.depth = 1;
      world = el('div', { class: 'world' }, bgBox, parBack, charsBox, parFront, fxBox);
      hubBox = el('div', { class: 'pl-hub' });
      dlgBox = el('div', { hidden: true });
      choiceBox = el('div', { hidden: true });
      msgBox = el('div', { hidden: true });
      overlayBox = el('div', { class: 'pl-overlay', hidden: true });
      gainBox = el('div', { class: 'pl-gainbox', hidden: true });
      debugBox = el('div', { class: 'pl-debug', hidden: true });
      menuBox = el('div', { class: 'pl-menu', hidden: true });
      info = el('div', { class: 'pl-info' });
      hud = el('div', { class: 'pl-hud' });
      ctrl = el('div', { class: 'pl-ctrl' },
        WD.ctrlBox,
        E.ctrlBox,
        p.inventory.enabled && p.items.length ? el('button', { 'data-btn': 'inv', onclick: (e) => { e.stopPropagation(); toggleInventory(); } }, VN.tr('ui:inventory', p.inventory.title || 'Inventar') + ' (I)') : null,
        el('button', { 'data-btn': 'menu', onclick: (e) => { e.stopPropagation(); pauseMenu(); } }, 'Menü (Esc)'),
        VN.gameMode ? null : el('button', { onclick: (e) => { e.stopPropagation(); Player.close(); } }, 'Editor'));
      stage.append(world, vig, partBox, hubBox, black, phoneBox, dlgBox, choiceBox, msgBox, gainBox, menuBox, overlayBox, info, hud, debugBox, ctrl);
      root.appendChild(stage);
      root.hidden = false;
      Player.fitStage();
      if (window.Perf) Perf.startMonitor();
      if (window.Theme) { Theme.loadFonts(); stage.style.cursor = Theme.cursor('normal', 'pointer'); }
      stage.addEventListener('click', () => Player.advance());
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('keyup', E.onKeyUp, true);
      stage.addEventListener('wheel', E.onWheel, { passive: true });
      window.addEventListener('resize', Player.fitStage);
      E.startLoop();
      E.applyA11y();
      if (VN.settings.lang && p.languages.includes(VN.settings.lang)) VN.lang = VN.settings.lang;
      if (!VN.lang || !p.languages.includes(VN.lang)) VN.lang = p.languages[0];
      session = { startScene: id };
      const go = () => {
        if (opts.menu && p.mainMenu && p.mainMenu.enabled !== false) showMainMenu();
        else newGame(id, beat || 0);
      };
      if (opts.menu && !opts.noSplash && window.Theme) splash(go); else go();
    },

    // Nachricht einer Figur (Beziehungs-Meilenstein) – wartet, bis der Spieler sie schließt
    relMessage(charId, msId) {
      const c = VN.Life && VN.Life.relChar(charId);
      const m = c && (c.milestones || []).find((x) => x.id === msId);
      if (!run || !c || !m || !window.RelMsg) return Promise.resolve();
      const myRun = run;
      // Kann auch über einem offenen Bildschirm erscheinen (z. B. Aufbau): danach den alten Zustand wiederherstellen
      const prev = myRun.overlay;
      myRun.overlay = 'relmsg';
      return RelMsg.show(stage, c, m).then(() => { if (myRun === run && run.overlay === 'relmsg') run.overlay = prev || null; renderHud(); });
    },

    advance() {
      if (run && run.blocked === 'video' && run.skipVideo && !run.overlay) { const f = run.skipVideo; run.skipVideo = null; if (run.video) run.video.el.pause(); f(); return; }
      if (run && !run.blocked && run.pendingDialog !== undefined) { const d = run.pendingDialog; run.pendingDialog = undefined; if (d) { showDialog(d); return; } }
      if (!run || run.ended || run.overlay || run.blocked) return;
      if (stage.querySelector('.gl-pop')) { stage.querySelector('.gl-pop').remove(); return; }
      if (run.message) {
        const cb = run.message;
        run.message = null;
        msgBox.hidden = true;
        cb();
        return;
      }
      if (run.holding) { E.dropHold(); return; }
      if (run.event) { if (!run.typing) { uiSound('next'); E.markRead(); } return advanceEvent(); }
      const s = VN.scene(run.scene);
      if (!s || s.type === 'hub') return;
      if (run.typing) return stopTyping(true);
      if (run.choicesShown) return;
      if (run.waitFor) { const h = stage.querySelector('.pl-wait'); if (h) { h.classList.remove('shake'); void h.offsetWidth; h.classList.add('shake'); } return; }
      E.markRead();
      if (run.pendingChoice) return showChoices(run.pendingChoice);
      uiSound('next');
      nextBeat();
    },

    // Spielbild an das Fenster anpassen: schwarze Ränder, füllen oder strecken
    fitStage() {
      if (!stage) return;
      const A = VN.aspect ? VN.aspect() : 16 / 9;
      const fit = VN.exportOpts ? VN.exportOpts().fit : 'letterbox';
      const W = window.innerWidth, H = window.innerHeight;
      let w, h;
      if (fit === 'stretch') { w = W; h = H; }
      else if (fit === 'cover') { w = Math.max(W, H * A); h = w / A; }
      else { w = Math.min(W, H * A); h = w / A; }
      Object.assign(stage.style, { width: w + 'px', height: h + 'px', aspectRatio: 'auto', flex: 'none' });
    },
    // Nach einem Qualitätswechsel: Filter neu setzen (Unschärfe an/aus)
    reapplyLook() {
      if (!run || !run.fx || !world) return;
      const s = VN.scene(run.scene);
      const st = s && s.type === 'story' ? Stage.state(s, run.beat) : null;
      if (st && st.fx && st.fx.filter) world.style.filter = Perf.filterCss(Fx.FILTER_CSS[st.fx.filter] || '');
    },
    // Konsole: springen, Werte setzen, neu laden
    jump(sceneId, beat) {
      if (!run) return;
      closeOverlay();
      run.overlay = null;
      run.ended = false;
      stage.querySelectorAll('.pl-end').forEach((n) => n.remove());
      const s = VN.scene(sceneId);
      if (s && s.type === 'story') { enterScene(sceneId, Math.min(beat || 0, s.beats - 1)); } else enterScene(sceneId, 0);
    },
    _audio: A, // nur für Tests/Debug
    reloadBeat() { if (!run) return; const s = VN.scene(run.scene); run.fx = null; charsBox.innerHTML = ''; run.chars = {}; if (s && s.type === 'story') enterBeat(run.beat); else enterScene(run.scene); },
    setValue(name, val) {
      if (!run || !name) return null;
      const p = VN.project, rs = run.rs, n = name.toLowerCase();
      const v = p.vars.find((x) => x.id === name || x.name.toLowerCase() === n);
      if (v) { rs.vars[v.id] = v.type === 'flag' ? /^(an|1|ja|true|wahr)$/i.test(val) : (isNaN(Number(val)) ? val : Number(val)); renderHud(); renderDebug(); return v.name + ' = ' + rs.vars[v.id]; }
      const c = p.currencies.find((x) => x.id === name || x.name.toLowerCase() === n);
      if (c) { rs.money[c.id] = Number(val) || 0; renderHud(); renderDebug(); return c.name + ' = ' + rs.money[c.id]; }
      return null;
    },

    toggleInventory,
    pauseMenu,
    // Für Aktionen „Bildschirm öffnen“ und „Namen eingeben“
    openScreen(name) {
      if (!run) return Promise.resolve();
      if (name === 'stats') return E.statsScreen(false);
      if (name === 'gallery') return E.galleryScreen(false);
      if (name === 'ach') return E.achScreen(false);
      if (name === 'log') return E.logScreen(false);
      if (name === 'inv') { toggleInventory(); return Promise.resolve(); }
      return Promise.resolve();
    },
    askName: (a) => E.askName(a),
    // Aktionen von außen (z. B. beim Anziehen eines Gegenstands): ausführen, Meldung zeigen, Hub auffrischen
    async runActions(list, key) {
      if (!run || !(list || []).length) return;
      const myRun = run;
      const g = await doActions(list, key);
      if (myRun !== run || !g) return;
      showGains(g);
      const s = VN.scene(run.scene);
      if (s && s.type === 'hub' && !run.overlay) showHub(s, false);
      renderHud();
    },
    openMap: () => WD.openMap(),
    openQuests: () => NT.questScreen(false),
    openSkills: (tree) => SKP.screen(tree || null, false),
    battle: (id) => CBP.start(id),
    openIdle: () => IDP.open(false),
    // Probelauf im Editor: frischer Spielstand, Uhr läuft, Knöpfe zum Vorspulen
    tryIdle() {
      const rs = VN.newRunState();
      const back = el('div', { class: 'modal-back' });
      const stg = el('div', { class: 'sk-try-stage' });
      back.appendChild(stg);
      back.addEventListener('mousedown', (e) => { if (e.target === back) sc.close(); });
      document.body.appendChild(back);
      const sc = VN.IdleScreen.open({ host: stg, rs, test: true, onClose: () => back.remove() });
      return sc;
    },
    // Probekampf im Editor: eigene Bühne, frischer Spielstand, Gruppe auf Stufe level
    tryBattle(id, level, story) {
      const b = VN.Combat.battle(id);
      if (!b) return;
      const rs = VN.newRunState();
      const back = el('div', { class: 'modal-back' });
      const stg = el('div', { class: 'sk-try-stage cb-try' });
      back.appendChild(stg);
      document.body.appendChild(back);
      const sfx = (a) => { const u = VN.assetUrl(a); if (u) { const au = new Audio(u); au.volume = 0.8; au.play().catch(() => {}); } };
      const sc = VN.CombatScreen.open({ host: stg, rs, battle: b, test: true, level: level || 1, story: !!story, sfx });
      const key = (e) => { if (e.key === 'Escape' && !stg.querySelector('.cb-result') && !sc.root.querySelector('.cb-unit.targetable') && !stg.querySelector('.cb-list.sub')) { close(); return; } sc.onKey(e); e.stopPropagation(); };
      const close = () => { sc.close(); back.remove(); window.removeEventListener('keydown', key, true); };
      window.addEventListener('keydown', key, true);
      sc.run().then(async ({ res }) => { if (res === 'abort') return; await sc.result(res, { xp: sc.fight.units.filter((u) => u.side === 'enemy').reduce((s2, u) => s2 + (Number(u.f.xp) || 0), 0), gains: [], ups: [] }); close(); });
      return sc;
    },
    // Probelauf im Editor: Skilltree mit viel Geld und Punkten, ändert nichts am Projekt
    trySkills(tree) {
      const rs = VN.newRunState();
      for (const c of VN.project.currencies) rs.money[c.id] = 99999;
      const st = VN.Skills.state(rs); for (const pt of VN.Skills.cfg().points) st.pts[pt.id] = 999;
      for (const v of VN.project.vars) if (v.type !== 'flag') rs.vars[v.id] = Math.max(Number(rs.vars[v.id]) || 0, 999);
      const back = el('div', { class: 'modal-back' });
      const stg = el('div', { class: 'sk-try-stage' });
      back.appendChild(stg);
      back.addEventListener('mousedown', (e) => { if (e.target === back) back.remove(); });
      document.body.appendChild(back);
      VN.SkillScreen.open({ host: stg, rs, tree, test: true, onClose: () => back.remove() });
    },
    travelTo: (id, o) => WD.travelTo(id, o),
    worldToast: (id) => WD.toast(id),
    get _extras() { return E; },
    showMainMenu,
    quicksave,

    close(silent) {
      if (!session && !silent) return;
      if (VN.gameMode && !silent) { showMainMenu(); return; }
      if (splashStop) splashStop();
      if (VN.Audio) { VN.Audio.playing = false; VN.Audio.refresh(); }
      CBP.abort();
      if (window.RelMsg) RelMsg.abortAll();
      stopWait();
      IDP.stopClock();
      clearTimers();
      stopTyping();
      stopVoice();
      stopSfx();
      if (A.music) { A.music.audio.pause(); A.music = null; }
      stopAmbient();
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', E.onKeyUp, true);
      window.removeEventListener('resize', Player.fitStage);
      E.stopLoop();
      if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) { /* egal */ }
      if (window.Perf) { Perf.stopMonitor(); if (Perf.con) Perf.con.close(); }
      run = null;
      session = null;
      const r = document.getElementById('player');
      r.hidden = true;
      r.innerHTML = '';
    }
  });
})();
