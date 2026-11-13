// Spiel-Player · Ton: Musik (mit Ducking und Übergängen), Stimmen, Soundeffekte, Atmo-Spuren, Lippensync
// Wird von player.js mit VN.PlayerAudio({ run, later, volOf }) eingebunden.
(function () {
  // Endlos-Schleife (0.9.37): zwei Elemente im Wechsel. Kurz vor dem Ende startet das zweite und blendet über
  // (gleiche Lautheit beim Übergang). xf = 0 → nahtlos ohne die kleine Lücke von audio.loop.
  // Verhält sich nach außen wie ein Audio-Element (play, pause, volume, currentTime, paused).
  VN.Looper = (url, o = {}) => {
    const mk = () => { const a = new Audio(); a.crossOrigin = 'anonymous'; a.src = url; a.preload = 'auto'; return a; };
    const els = [mk(), mk()];
    let cur = 0, master = 0, paused = true, iv = 0, xfAt = -1, muffle = o.muffle || 0;
    const k = [1, 0];
    const inS = () => Math.max(0, Number(o.inS) || 0);
    const apply = () => { els.forEach((a, i) => { a.volume = Math.max(0, Math.min(1, master * k[i])); }); };
    const start = (i) => { const a = els[i]; try { a.currentTime = inS(); } catch (e) { /* noch nicht geladen */ } if (muffle && window.Fx) Fx.muffle(a, muffle, 0); a.play().catch(() => {}); };
    const tick = () => {
      if (paused) return;
      const a = els[cur];
      const end = o.outS && o.outS > inS() ? Math.min(o.outS, a.duration || Infinity) : a.duration;
      if (!end || !isFinite(end)) return;
      const len = end - inS();
      const xf = Math.max(0.03, Math.min(Number(o.xf) || 0, len / 3));
      const left = end - a.currentTime;
      if (xfAt < 0 && (left <= xf + 0.02 || a.ended)) { xfAt = performance.now(); k[1 - cur] = 0; apply(); start(1 - cur); }
      if (xfAt >= 0) {
        const t = Math.min(1, (performance.now() - xfAt) / (xf * 1000));
        const n = 1 - cur;
        k[cur] = Math.cos(t * Math.PI / 2); k[n] = Math.sin(t * Math.PI / 2);
        apply();
        if (t >= 1) { els[cur].pause(); k[cur] = 0; cur = n; xfAt = -1; apply(); }
      } else if (o.outS && a.currentTime >= o.outS) { /* Ende des Ausschnitts ohne Übergang */ a.pause(); }
    };
    const L = {
      looper: true,
      play() { if (!paused) return Promise.resolve(); paused = false; k[cur] = 1; k[1 - cur] = 0; apply(); start(cur); clearInterval(iv); iv = setInterval(tick, 20); return Promise.resolve(); },
      pause() { paused = true; clearInterval(iv); els.forEach((a) => a.pause()); xfAt = -1; },
      get paused() { return paused; },
      get volume() { return master; },
      set volume(v) { master = Math.max(0, Math.min(1, Number(v) || 0)); apply(); },
      get currentTime() { return els[cur].currentTime; },
      set currentTime(v) { o.inS = v; },
      set loop(v) { /* immer Schleife */ },
      get loop() { return true; },
      setMuffle(v, sec) { muffle = v; if (window.Fx) els.forEach((a) => { if (a._muf || v) Fx.muffle(a, v, sec); }); },
      setXf(v) { o.xf = v; },
      addEventListener(type, fn) { els.forEach((a) => a.addEventListener(type, fn)); },
      els
    };
    return L;
  };

  VN.PlayerAudio = (host) => {
    const R = host.run, later = host.later, volOf = host.volOf;
    let music = null;      // { audio, asset, carry, base, vol, ducked }
    let voice = null;
    // Alle laufenden und geplanten Stimmen – beim Schritt-Wechsel werden sie gemeinsam beendet
    const voices = new Set(), voiceTimers = new Set();
    // ---------- Audio ----------
    const fadeVolume = (audio, to, sec, done) => {
      if (!audio) return done && done();
      clearInterval(audio._fadeIv);
      const from = audio.volume;
      const steps = Math.max(1, Math.round((sec || 0) * 20));
      let i = 0;
      audio._fadeIv = setInterval(() => {
        i++;
        audio.volume = Math.max(0, Math.min(1, from + (to - from) * (i / steps)));
        if (i >= steps) { clearInterval(audio._fadeIv); done && done(); }
      }, 50);
    };
    // Musiklautstärke inkl. Ducking (leiser, solange eine Stimme spricht)
    const musicVol = () => {
      if (!music) return 0;
      const mix = VN.project.audioMix || {};
      const duck = music.ducked && mix.on !== false ? (mix.duck != null ? mix.duck : 45) / 100 : 0;
      return Math.max(0, Math.min(1, music.base * volOf('music') * (1 - duck)));
    };
    const duck = (on) => {
      if (!music || music.ducked === on) return;
      music.ducked = on;
      fadeVolume(music.audio, musicVol(), on ? 0.25 : 0.7);
    };
    const stopMusic = (sec) => {
      if (!music) return;
      const a = music.audio;
      music = null;
      fadeVolume(a, 0, sec != null ? sec : 1, () => a.pause());
    };
    const playMusic = (spec) => {
      if (VN.Extras && spec && spec.asset) VN.Extras.hearMusic(spec.asset);
      const base = (spec.vol != null ? spec.vol : 70) / 100;
      if (music && music.asset === spec.asset) {
        music.carry = !!spec.carry;
        music.base = base;
        fadeVolume(music.audio, musicVol(), 0.5);
        // gleiche Musik, andere Dämpfung (z. B. ins Nebenzimmer gehen): weich umblenden
        if ((music.muffle || 0) !== (spec.muffle || 0)) { music.muffle = spec.muffle || 0; if (music.audio.setMuffle) music.audio.setMuffle(music.muffle, 1); else if (window.Fx) Fx.muffle(music.audio, music.muffle, 1); }
        if (music.audio.setXf) music.audio.setXf(spec.loopFade || 0);
        return;
      }
      const url = VN.assetUrl(spec.asset);
      const fade = spec.fade != null ? spec.fade : 1;
      const mode = spec.xmode || 'cross';
      const hadMusic = !!music;
      stopMusic(mode === 'cut' ? 0 : fade);
      if (!url) return;
      const loop = spec.loop !== false;
      const a = loop ? VN.Looper(url, { xf: spec.loopFade || 0, inS: spec.in || 0, outS: spec.out || 0, muffle: spec.muffle || 0 }) : new Audio(url);
      a.volume = 0;
      if (!loop) { if (spec.in) a.currentTime = spec.in; if (spec.muffle && window.Fx) Fx.muffle(a, spec.muffle, 0); }
      const ducked = !!(voice && !voice.paused);
      music = { audio: a, asset: spec.asset, carry: !!spec.carry, base, vol: spec.vol, loop: spec.loop, ducked, xmode: spec.xmode, fade: spec.fade, muffle: spec.muffle || 0 };
      const start = () => { if (!music || music.audio !== a) return; a.play().catch(() => {}); if (mode === 'cut') a.volume = musicVol(); else fadeVolume(a, musicVol(), fade); };
      if (mode === 'seq' && hadMusic) later(start, fade * 1000); else start();
    };
    const playOnce = (assetId, vol, delay, kind, inS, outS, clip) => {
      const url = VN.assetUrl(assetId);
      if (!url) return;
      const isVoice = kind === 'voice';
      let tid = 0;
      tid = later(() => {
        voiceTimers.delete(tid);
        // crossOrigin vor der Quelle setzen, sonst liefert Web Audio nur Stille
        const a = new Audio();
        a.crossOrigin = 'anonymous';
        a.src = url;
        const v = Math.max(0, Math.min(1, (vol != null ? vol : 90) / 100 * volOf(kind)));
        // Stimmen laufen über Web Audio: Filter, Lippensync-Analyse
        if (clip && clip.muffle) a._muffle = clip.muffle;
        const needRoute = kind === 'voice' && window.Fx && (clip && (clip.vfx || clip.muffle) || Object.keys(VN.project.mouths || {}).length);
        a._route = needRoute ? Fx.route(a, clip && clip.vfx, v) : null;
        if (!a._route) { a.volume = v; if (clip && clip.muffle && window.Fx) Fx.muffle(a, clip.muffle, 0); }
        if (inS) a.currentTime = inS;
        // Alle einmaligen Töne merken, damit „Test beenden“ sie anhalten kann
        if (!isVoice) { oneShots.add(a); const forget = () => oneShots.delete(a); a.addEventListener('ended', forget); a.addEventListener('pause', forget); }
        a.play().catch(() => {});
        // Musik bleibt leise, bis KEINE Stimme mehr läuft
        const end = () => { if (isVoice) { voices.delete(a); if (voice === a) voice = Array.from(voices).pop() || null; if (!anyVoice()) duck(false); } };
        a.addEventListener('ended', end);
        a.addEventListener('pause', end);
        if (outS) { const chk = () => { if (a.paused) return; if (a.currentTime >= outS) a.pause(); else requestAnimationFrame(chk); }; requestAnimationFrame(chk); }
        if (isVoice) {
          // Wem gehört die Stimme? Feld „Figur“ am Clip, sonst der Sprecher der Dialogzeile an dieser Stelle
          a._who = (clip && clip.who) || whoAt();
          voices.add(a); voice = a; duck(true); lipLoop();
        }
      }, (delay || 0) * 1000);
      if (isVoice) voiceTimers.add(tid);
    };
    const anyVoice = () => Array.from(voices).some((x) => !x.paused);
    const whoAt = () => {
      const r = R(); if (!r) return '';
      const sc = VN.scene(r.scene);
      const d = sc && sc.tracks && (sc.tracks.dialog || []).find((x) => x.start === r.beat);
      return d ? d.speaker || '' : '';
    };
    const oneShots = new Set();
    const stopSfx = () => { for (const a of Array.from(oneShots)) { try { a.pause(); } catch (e) { /* schon weg */ } } oneShots.clear(); };
    const stopVoice = () => {
      for (const t of voiceTimers) clearTimeout(t);
      voiceTimers.clear();
      for (const a of Array.from(voices)) { try { a.pause(); } catch (e) { /* schon weg */ } }
      voices.clear();
      if (voice) { voice.pause(); voice = null; }
      duck(false);
    };

    // ---------- Lippensync ----------
    let lipRaf = 0;
    // Jede Figur bewegt den Mund zu IHRER Stimme – auch wenn mehrere gleichzeitig sprechen
    const lipLoop = () => {
      cancelAnimationFrame(lipRaf);
      const smooth = new Map();
      const tick = () => {
        const r = R();
        if (!r) return;
        const lv = new Map();
        for (const a of voices) {
          if (a.paused || !a._route) continue;
          const c = Object.values(r.chars).find((x) => x.clip && window.Fx && Fx.isSpeaker(x.clip, a._who)) || (voices.size === 1 ? r.speakingChar : null);
          if (c) lv.set(c, Math.max(lv.get(c) || 0, Fx.level(a._route)));
        }
        const ch = r.speakingChar;
        if (ch && !lv.has(ch) && r.typing && r.typing.talk && !anyVoice()) lv.set(ch, 0.25 + 0.55 * Math.abs(Math.sin(performance.now() / 85)));
        for (const c of Object.values(r.chars)) {
          if (!c.el._mouth) continue;
          const v = (smooth.get(c) || 0) * 0.5 + (lv.get(c) || 0) * 0.5;
          smooth.set(c, v);
          c.el._mouth.set(v < 0.06 ? 0 : 0.25 + v * 0.75);
        }
        if (anyVoice() || r.typing) lipRaf = requestAnimationFrame(tick);
        else for (const c of Object.values(r.chars)) if (c.el._mouth) c.el._mouth.set(0);
      };
      lipRaf = requestAnimationFrame(tick);
    };

    // Zusätzliche Musik-/Atmo-Spuren: laufen parallel zur Musik in Schleife, mit Ein-/Ausblenden
    const showAmbient = (list) => {
      R().amb = R().amb || {};
      const want = {};
      for (const [key, clip] of list) if (clip.asset) want[key] = clip;
      // Soundeffekte in Schleife (0.9.37) laufen auf dem Effekt-Regler, Atmo auf dem Musik-Regler
      const ch = (clip) => (clip && clip._ch) || 'music';
      for (const key of Object.keys(R().amb)) {
        const cur = R().amb[key];
        if (want[key] && want[key].asset === cur.asset) {
          cur.base = (want[key].vol != null ? want[key].vol : 70) / 100;
          fadeVolume(cur.audio, Math.min(1, cur.base * volOf(ch(want[key]))), 0.5);
          if ((cur.muffle || 0) !== (want[key].muffle || 0)) { cur.muffle = want[key].muffle || 0; if (cur.audio.setMuffle) cur.audio.setMuffle(cur.muffle, 1); }
          continue;
        }
        const a = cur.audio;
        fadeVolume(a, 0, cur.fadeOut != null ? cur.fadeOut : (want[key] && want[key].fade) || 1, () => a.pause());
        delete R().amb[key];
      }
      for (const [key, clip] of Object.entries(want)) {
        if (R().amb[key]) continue;
        const url = VN.assetUrl(clip.asset);
        if (!url) continue;
        const a = clip.loop !== false ? VN.Looper(url, { xf: clip.loopFade != null ? clip.loopFade : 0, inS: clip.in || 0, outS: clip.out || 0, muffle: clip.muffle || 0 }) : new Audio(url);
        a.volume = 0;
        a.play().catch(() => {});
        const base = (clip.vol != null ? clip.vol : 70) / 100;
        const fin = clip.fade != null ? clip.fade : clip._ch === 'sfx' ? 0.15 : 1;
        fadeVolume(a, Math.min(1, base * volOf(ch(clip))), fin);
        R().amb[key] = { audio: a, asset: clip.asset, base, muffle: clip.muffle || 0, fadeOut: clip._ch === 'sfx' ? (clip.fadeOut != null ? clip.fadeOut : 0.6) : null };
      }
    };
    const stopAmbient = () => { if (R() && R().amb) { for (const x of Object.values(R().amb)) x.audio.pause(); R().amb = {}; } };

    return {
      fadeVolume, musicVol, duck, stopMusic, playMusic, playOnce, stopVoice, stopSfx, lipLoop, showAmbient, stopAmbient,
      get music() { return music; }, set music(v) { music = v; },
      get voice() { return voice; }, get voiceCount() { return voices.size + voiceTimers.size; }, get ducked() { return anyVoice(); }, set voice(v) { voice = v; }
    };
  };
})();
