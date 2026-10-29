// Bühne: berechnet, was in einem Schritt sichtbar ist, und zeichnet die Vorschau
(function () {
  const { el } = VN;

  // Der Clip, der den Schritt abdeckt (bei Überlappung gewinnt der zuletzt gestartete)
  const clipAt = (list, beat) => {
    let best = null;
    for (const c of list || []) {
      if (beat >= c.start && beat < c.start + c.len && (!best || c.start >= best.start)) best = c;
    }
    return best;
  };

  const Stage = (window.Stage = {
    clipAt,
    state(scene, beat) {
      const t = scene.tracks;
      const list = VN.tracksOf(scene);
      const on = (key) => VN.trackOn(scene, list.find((x) => x.key === key), list);
      const of = (base, extra) => list.filter((x) => x.base === base && (extra ? x.extra : true) && VN.trackOn(scene, x, list)).map((x) => [x.key, clipAt(t[x.key], beat)]).filter((x) => x[1]);
      return {
        bg: on('bg') ? clipAt(t.bg, beat) : null,
        // Figuren in Spur-Reihenfolge: weiter unten in der Timeline = weiter vorne
        chars: of('char'),
        fx: on('fx') ? clipAt(t.fx, beat) : null,
        fxX: of('fx', true),
        cam: window.Fx ? Fx.camAt(scene, beat) : null,
        video: on('video') ? clipAt(t.video, beat) : null,
        dialog: clipAt(t.dialog, beat),
        choice: (t.choice || []).find((c) => c.start === beat) || null,
        music: on('music') ? clipAt(t.music, beat) : null,
        musicX: of('music', true)
      };
    },

    // Bühne an verfügbaren Platz anpassen (Seitenverhältnis des Spiels)
    fit(wrap, stage) {
      const A = VN.aspect ? VN.aspect() : 16 / 9;
      stage.style.aspectRatio = String(A);
      const ro = new ResizeObserver(() => {
        const w = wrap.clientWidth - 24, h = wrap.clientHeight - 24;
        const sw = Math.max(120, Math.min(w, h * A));
        stage.style.width = sw + 'px';
        stage.style.height = (sw / A) + 'px';
      });
      ro.observe(wrap);
      return ro;
    },

    // ---------- Ebenen-Figuren ----------
    figure(id) { return (VN.project.figures || []).find((f) => f.id === id) || null; },
    // Gewählte Option je Ebene: Grundauswahl → Änderungen ab Schritt → Variable
    figurePicks(clip, beat, rs) {
      const f = Stage.figure(clip.set);
      if (!f) return {};
      const out = {};
      for (const L of f.layers) out[L.id] = (clip.pick && clip.pick[L.id]) || (L.options[0] && L.options[0].id) || null;
      for (const b of Object.keys(clip.picks || {}).map(Number).sort((a, c) => a - c)) if (beat == null || b <= beat) Object.assign(out, clip.picks[b]);
      if (rs) for (const L of f.layers) {
        if (!L.varBind) continue;
        const v = rs.vars[L.varBind];
        const o = L.options.find((x) => x.value != null && x.value !== '' && String(x.value) === String(v));
        if (o) out[L.id] = o.id;
      }
      return out;
    },
    figureEl(clip, beat, rs) {
      const f = Stage.figure(clip.set);
      const inner = el('span', { class: 'char-inner fig' });
      if (!f) return inner;
      const picks = Stage.figurePicks(clip, beat, rs);
      let first = true;
      for (const L of f.layers) {
        const o = L.options.find((x) => x.id === picks[L.id]);
        if (!o || !o.asset || !VN.assetUrl(o.asset)) continue;
        inner.appendChild(el('img', { class: first ? 'fig-base' : 'fig-layer', src: VN.assetUrl(o.asset), draggable: 'false' }));
        first = false;
      }
      inner.dataset.picks = JSON.stringify(picks);
      if (clip.flip) inner.style.transform = 'scaleX(-1)';
      return inner;
    },

    charEl(clip, cls, ctx = {}) {
      const box = el('div', { class: cls || 'char' });
      const pr = window.Fx ? Fx.propsAt(clip, ctx.beat != null ? ctx.beat : clip.start) : { x: clip.x != null ? clip.x : 50, y: 0, scale: clip.scale || 100, rot: 0, opacity: clip.opacity != null ? clip.opacity : 100 };
      box.style.transform = 'translateX(-50%)';
      if (window.Fx) Fx.placeChar(box, pr); else { box.style.left = pr.x + '%'; box.style.height = (88 * pr.scale / 100) + '%'; }
      const url = VN.assetUrl(clip.asset);
      if (clip.set) {
        box.appendChild(Stage.figureEl(clip, ctx.beat, ctx.rs));
      } else if (url && window.Rig && Rig.has(clip.asset) && clip.bones !== false) {
        const cv = Rig.canvasFor(clip.asset, clip, window.Anim ? { extraFn: Anim.extraFnFor(clip, box) } : {});
        if (clip.flip) cv.style.transform += ' scaleX(-1)';
        box.appendChild(cv);
      } else if (url && window.Blink && Blink.cfg(clip.asset)) {
        const inner = el('span', { class: 'char-inner' }, el('img', { src: url, draggable: 'false' }));
        if (clip.flip) inner.style.transform = 'scaleX(-1)';
        Blink.attach(inner, clip.asset);
        box.appendChild(inner);
      } else if (url) {
        const inner = el('span', { class: 'char-inner' }, el('img', { src: url, draggable: 'false' }));
        if (clip.flip) inner.style.transform = 'scaleX(-1)';
        box.appendChild(inner);
      } else {
        box.appendChild(el('div', { class: 'placeholder', style: { position: 'relative', width: '30cqh', height: '100%' } }, 'Figur ohne Bild'));
      }
      if (window.Fx && !clip.set && url) box._mouth = Fx.attachMouth(box, clip);
      VN.applyLook(box, clip);
      box.style.opacity = String(pr.opacity / 100);
      return box;
    },

    fxEl(clip, cls) {
      const box = el('div', { class: cls || 'fx-layer' });
      if (clip.particles && window.Fx) { box.classList.add('fx-parts'); box.appendChild(Fx.particleEl(clip)); return box; }
      if (clip.eyes && window.Fx) { box.classList.add('fx-eyes'); box.appendChild(Fx.eyesEl(clip, cls === 'fx-layer')); return box; }
      if (clip.filter) { box.classList.add('fx-filter'); const e = window.Fx ? Fx.filterEdge(clip.filter) : ''; if (e) box.style.background = e; return box; }
      const url = VN.assetUrl(clip.asset);
      if (url) box.appendChild(el('img', { src: url, draggable: 'false' }));
      else box.style.background = clip.color || '#3c4a8c';
      VN.applyLook(box, clip);
      return box;
    },

    videoEl(clip, live) {
      if (clip.anim && window.Anim) {
        const c = el('canvas', { class: 'vid-layer anim ' + (clip.layer === 'front' ? 'front' : 'bg') });
        const a = Anim.get(clip.anim);
        if (a && !live) requestAnimationFrame(() => Anim.still(c, a, Math.min(a.dur || 1, 0.5)));
        return c;
      }
      const v = el('video', { class: 'vid-layer ' + (clip.layer === 'front' ? 'front' : 'bg'), src: VN.assetUrl(clip.asset), playsinline: true, preload: 'auto' });
      v.style.objectFit = clip.fit || 'cover';
      v.muted = !live || !!clip.muted;
      v.loop = !!clip.loop;
      if (!live) { v.addEventListener('loadedmetadata', () => { try { v.currentTime = Math.min(0.2, v.duration / 2 || 0); } catch (e) { /* egal */ } }); }
      return v;
    },

    // Hintergrund mit Tageszeit und Parallax-Ebenen
    bgBox(clip) {
      const box = el('div', { class: 'bg-box' });
      box.dataset.depth = clip && clip.depth != null ? clip.depth : 1;
      return box;
    },
    parallaxEls(clip, front) {
      return (clip && clip.layers ? clip.layers : []).filter((L) => !!L.front === !!front && VN.assetUrl(L.asset)).map((L) => {
        const n = el('div', { class: 'par-layer' }, window.Fx && Fx.tileOn(L.tile) ? Fx.tileEl(VN.assetUrl(L.asset), L.tile) : el('img', { src: VN.assetUrl(L.asset), draggable: 'false' }));
        n.dataset.depth = L.depth != null ? L.depth : (front ? 1.3 : 0.6);
        return n;
      });
    },

    dialogEl(clip, text, speaker, opts = {}) {
      const name = speaker != null ? speaker : clip.speaker;
      const textEl = el('div', { class: 'dlg-text' });
      const box = el('div', { class: 'dlg-box' },
        name ? el('div', { class: 'dlg-name', style: { color: clip.color || '#fff' } }, name) : null,
        textEl);
      const t = text != null ? text : clip.text || '';
      if (window.Fx) Fx.renderText(textEl, t); else textEl.textContent = t;
      if (window.Theme && VN.project) {
        const B = Theme.bubble(clip.speaker, clip.id && clip.id !== '_pv' ? clip : null);
        Theme.styleBubble(box, B, { speakerColor: clip.color, tailX: opts.tailX });
        if (B.portrait && opts.portrait) {
          box.classList.add('has-portrait');
          box.insertBefore(el('div', { class: 'dlg-portrait', style: { backgroundImage: `url("${opts.portrait}")`, borderColor: B.border } }), box.firstChild);
        }
      }
      return box;
    },

    // Wo steht die sprechende Figur? (für die Sprechblasen-Spitze)
    speakerX(chars, speaker) {
      for (const [, c] of chars) if (window.Fx ? Fx.isSpeaker(c, speaker) : false) return c.x != null ? c.x : 50;
      return null;
    },
    speakerClip(chars, speaker) { for (const [, c] of chars) if (window.Fx && Fx.isSpeaker(c, speaker)) return c; return null; },
    portraitOf(chars, speaker) {
      const c = Stage.speakerClip(chars, speaker);
      if (!c) return null;
      if (c.set) { const f = Stage.figure(c.set); const o = f && f.layers[0] && f.layers[0].options.find((x) => x.id === Stage.figurePicks(c, null)[f.layers[0].id]); return o ? VN.assetUrl(o.asset) : null; }
      return VN.assetUrl(c.asset) || null;
    },
    // Sprecher hervorheben, andere leicht abdunkeln
    applyFocus(charNodes, speaker) {
      const F = VN.project && VN.project.theme && VN.project.theme.focus;
      for (const [node, clip] of charNodes) {
        node.classList.remove('focus-on', 'focus-off');
        if (!F || !F.on || !speaker) continue;
        const me = window.Fx && Fx.isSpeaker(clip, speaker);
        node.classList.add(me ? 'focus-on' : 'focus-off');
        node.style.setProperty('--dim', String(1 - (F.dim != null ? F.dim : 35) / 100));
      }
    },

    // Statische Vorschau eines Schritts im Editor
    renderStory(stage, scene, beat) {
      stage.innerHTML = '';
      const st = Stage.state(scene, beat);
      const world = el('div', { class: 'world' });
      const bgBox = Stage.bgBox(st.bg);
      world.appendChild(bgBox);
      if (st.bg) {
        const url = VN.assetUrl(st.bg.asset);
        if (url && Fx.tileOn(st.bg.tile)) {
          const tw = Fx.tileEl(url, st.bg.tile);
          tw.classList.add('bg-img');
          tw.dataset.clip = st.bg.id;
          if (st.bg.daytime && Fx.DAY[st.bg.daytime]) tw.style.filter = Fx.DAY[st.bg.daytime].filter;
          bgBox.appendChild(tw);
          bgBox.appendChild(Fx.dayOverlay(st.bg.daytime));
        } else if (url) {
          const img = el('img', { class: 'bg-img', src: url, draggable: 'false' });
          img.dataset.clip = st.bg.id;
          VN.applyBgLook(img, st.bg);
          if (st.bg.daytime && Fx.DAY[st.bg.daytime]) img.style.filter = [img.style.filter, Fx.DAY[st.bg.daytime].filter].filter(Boolean).join(' ');
          bgBox.appendChild(img);
          bgBox.appendChild(Fx.dayOverlay(st.bg.daytime));
        } else bgBox.appendChild(el('div', { class: 'placeholder', style: { inset: '6%' } }, 'Hintergrund ohne Bild – rechts eins wählen'));
      }
      const vidOk = (v) => v && (v.anim ? !!(window.Anim && Anim.get(v.anim)) : !!VN.assetUrl(v.asset));
      if (st.video && st.video.layer !== 'front' && vidOk(st.video)) { const v = Stage.videoEl(st.video, false); v.dataset.clip = st.video.id; bgBox.appendChild(v); }
      for (const n of Stage.parallaxEls(st.bg, false)) world.appendChild(n);
      const charsBox = el('div', { class: 'chars-box' });
      charsBox.dataset.depth = 1;
      world.appendChild(charsBox);
      const charNodes = [];
      for (const [, c] of st.chars) { const n = Stage.charEl(c, null, { beat }); n.dataset.clip = c.id; charsBox.appendChild(n); charNodes.push([n, c]); }
      for (const n of Stage.parallaxEls(st.bg, true)) world.appendChild(n);
      const fxBox = el('div', { class: 'fx-box' });
      fxBox.dataset.depth = 1;
      world.appendChild(fxBox);
      if (st.fx && !st.fx.particles) { const n = Stage.fxEl(st.fx); n.dataset.clip = st.fx.id; (st.fx.filter || st.fx.eyes ? stage : fxBox).appendChild(n); }
      if (st.fx && st.fx.filter) world.style.filter = Fx.FILTER_CSS[st.fx.filter] || '';
      stage.appendChild(world);
      if (st.bg && st.bg.vignette) stage.appendChild(VN.vignetteEl(st.bg));
      if (st.fx && st.fx.filter) stage.appendChild(stage.querySelector('.fx-filter'));
      if (st.fx && st.fx.particles) { const n = Stage.fxEl(st.fx); n.dataset.clip = st.fx.id; stage.appendChild(n); }
      for (const [, c] of st.fxX || []) { if (c.filter) continue; const n = Stage.fxEl(c); n.dataset.clip = c.id; (c.particles ? stage : fxBox).appendChild(n); }
      if (st.cam) Fx.applyCam(world, st.cam, 0);
      if (st.video && st.video.layer === 'front' && vidOk(st.video)) { const v = Stage.videoEl(st.video, false); v.dataset.clip = st.video.id; stage.appendChild(v); }
      // Licht passend zur Szene
      if (st.bg && st.bg.charLight) {
        const day = Fx.DAY[st.bg.daytime];
        (day ? Promise.resolve(day.light) : Fx.avgColor(st.bg.asset)).then((col) => { for (const [n, c] of charNodes) if (n.isConnected) Fx.lightOverlay(n, c, col, st.bg.charLight); });
      }
      if (st.dialog && st.dialog.chat) {
        const ph = Fx.phoneEl(Fx.chatRun(scene, beat));
        ph.dataset.clip = st.dialog.id;
        stage.appendChild(ph);
      } else if (st.dialog) {
        const n = Stage.dialogEl(st.dialog, null, null, { tailX: Stage.speakerX(st.chars, st.dialog.speaker), portrait: Stage.portraitOf(st.chars, st.dialog.speaker) });
        n.dataset.clip = st.dialog.id;
        stage.appendChild(n);
        Stage.applyFocus(charNodes, st.dialog.speaker);
      }
      if (st.choice) {
        const box = el('div', { class: 'choice-box' });
        box.dataset.clip = st.choice.id;
        for (const o of st.choice.options) {
          const target = VN.scene(o.target);
          box.appendChild(el('div', { class: 'choice-btn', title: target ? '→ ' + target.name : 'weiter in dieser Szene' }, Fx.plain(o.text || 'Option')));
        }
        if (window.Theme) Theme.styleChoices(box, Theme.choice(st.choice));
        if (st.choice.timer) box.appendChild(el('div', { class: 'choice-timer' }, el('span', { style: { width: '62%' } })));
        stage.appendChild(box);
      }
      if (!st.bg && !st.chars.length && !st.dialog && !st.video) {
        stage.appendChild(el('div', { class: 'placeholder', style: { inset: '10%', fontSize: '3cqh', textAlign: 'center', lineHeight: '1.6' } },
          'Leerer Schritt – Bild oder Audio aus der Dateiliste auf eine Spur ziehen, oder doppelt auf eine Spur klicken.'));
      }
      const camInfo = st.cam && st.cam.clip ? ' · Kamera ' + Math.round(st.cam.zoom) + ' %' : '';
      stage.appendChild(el('div', { class: 'stage-badge' }, 'Schritt ' + (beat + 1) + ' / ' + scene.beats + camInfo));
    }
  });
})();
