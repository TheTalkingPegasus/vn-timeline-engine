// Spiel-Player · Ton: Musik (mit Ducking und Übergängen), Stimmen, Soundeffekte, Atmo-Spuren, Lippensync
// Wird von player.js mit VN.PlayerAudio({ run, later, volOf }) eingebunden.
(function () {
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
        return;
      }
      const url = VN.assetUrl(spec.asset);
      const fade = spec.fade != null ? spec.fade : 1;
      const mode = spec.xmode || 'cross';
      const hadMusic = !!music;
      stopMusic(mode === 'cut' ? 0 : fade);
      if (!url) return;
      const a = new Audio(url);
      a.loop = spec.loop !== false;
      a.volume = 0;
      if (spec.in) a.currentTime = spec.in;
      const ducked = !!(voice && !voice.paused);
      music = { audio: a, asset: spec.asset, carry: !!spec.carry, base, vol: spec.vol, loop: spec.loop, ducked, xmode: spec.xmode, fade: spec.fade };
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
        const needRoute = kind === 'voice' && window.Fx && (clip && clip.vfx || Object.keys(VN.project.mouths || {}).length);
        a._route = needRoute ? Fx.route(a, clip && clip.vfx, v) : null;
        if (!a._route) a.volume = v;
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
      for (const key of Object.keys(R().amb)) {
        const cur = R().amb[key];
        if (want[key] && want[key].asset === cur.asset) { cur.base = (want[key].vol != null ? want[key].vol : 70) / 100; fadeVolume(cur.audio, Math.min(1, cur.base * volOf('music')), 0.5); continue; }
        const a = cur.audio;
        fadeVolume(a, 0, (want[key] && want[key].fade) || 1, () => a.pause());
        delete R().amb[key];
      }
      for (const [key, clip] of Object.entries(want)) {
        if (R().amb[key]) continue;
        const url = VN.assetUrl(clip.asset);
        if (!url) continue;
        const a = new Audio();
        a.crossOrigin = 'anonymous';
        a.src = url;
        a.loop = clip.loop !== false;
        a.volume = 0;
        if (VN.Audio && VN.Audio.route) VN.Audio.route(a);
        a.play().catch(() => {});
        const base = (clip.vol != null ? clip.vol : 70) / 100;
        fadeVolume(a, Math.min(1, base * volOf('music')), clip.fade != null ? clip.fade : 1);
        R().amb[key] = { audio: a, asset: clip.asset, base };
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
