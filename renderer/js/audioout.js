// Tonausgabe: Ausgabegerät (Kopfhörer, Boxen …), Gesamtlautstärke, UI-Töne, Mono, Gerätewechsel
(function () {
  const OrigAudio = window.Audio;
  const OrigCtx = window.AudioContext || window.webkitAudioContext;
  const media = new Set();          // Audio-/Video-Elemente, die schon einmal gespielt haben
  const ctxs = new Set();           // alle AudioContexts (Stimmen-Filter, Animation, Schnitt)
  const buses = new WeakMap();      // AudioContext -> Sammel-Knoten (für Mono)
  const S = () => VN.settings || {};

  // Darf ein Element über Web Audio laufen? Nur mit CORS (vnasset:// oder http-Seite), sonst wäre es stumm.
  const corsOk = (src) => /^vnasset:/i.test(src || '') || /^https?:/i.test(location.protocol);

  // new Audio(url): crossOrigin vor der Quelle setzen, damit Mono-Routing möglich ist
  if (OrigAudio) {
    const A = function (src) {
      const a = new OrigAudio();
      // Fehler beim Laden (Datei fehlt, Format kaputt) ins Protokoll der Entwickler-Konsole
      a.addEventListener('error', () => { const s = a.currentSrc || a.src || ''; if (s && window.Perf) Perf.addLog('datei', 'Ton fehlt oder defekt: ' + decodeURIComponent(s.split('/').slice(-2).join('/'))); });
      if (src != null && corsOk(String(src))) a.crossOrigin = 'anonymous';
      if (src != null) a.src = src;
      return a;
    };
    A.prototype = OrigAudio.prototype;
    window.Audio = A;
  }

  const Out = (VN.Audio = {
    // Für Tests: wie viele Elemente gerade verwaltet werden
    get mediaCount() { return media.size; },
    // Welches Gerät gerade gelten soll: im Editor getrennt für Vorschau und Test-Spiel
    sinkId() {
      const s = S();
      if (VN.gameMode || VN.Audio.playing) return s.audioOut || '';
      return s.audioOutEditor != null ? s.audioOutEditor : (s.audioOut || '');
    },
    // Lautstärke-Faktor für ein Element: Gesamt × (UI-Töne)
    factor(el) {
      const s = S();
      let f = (s.master != null ? s.master : 100) / 100;
      if (el && el._cat === 'ui') f *= (s.ui != null ? s.ui : (s.sfx != null ? s.sfx : 90)) / 100;
      return f;
    },
    async devices() {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        return list.filter((d) => d.kind === 'audiooutput' && d.deviceId !== 'default' && d.deviceId !== 'communications')
          .map((d, i) => ({ id: d.deviceId, label: d.label || ('Ausgabegerät ' + (i + 1)) }));
      } catch (e) { return []; }
    },
    // Gerät auf ein Element oder einen AudioContext anwenden
    applySink(x) {
      const id = Out.sinkId();
      try {
        if (x.setSinkId && x.sinkId !== id) {
          const p = x.setSinkId(x instanceof OrigCtx ? (id || '') : id);
          if (p && p.catch) p.catch(() => {});
        }
      } catch (e) { /* Gerät nicht verfügbar */ }
    },
    // Nach Änderung der Einstellungen: alles umstellen
    refresh() {
      for (const el of Array.from(media)) {
        if (!el.src && !el.currentSrc) { media.delete(el); continue; }
        if (el.ended) { media.delete(el); continue; }
        Out.applySink(el);
        if (el._vol != null) setVol(el, el._vol);
      }
      for (const c of ctxs) { Out.applySink(c); Out.monoBus(c); }
      if (S().mono) for (const el of media) if (!el.paused) Out.routeMono(el);
    },
    // Sammel-Knoten je AudioContext: bei Mono werden alle Kanäle zu einem zusammengemischt
    bus(ctx) {
      let b = buses.get(ctx);
      if (!b) { b = ctx.createGain(); b.connect(ctx.destination); buses.set(ctx, b); }
      Out.monoBus(ctx);
      return b;
    },
    monoBus(ctx) {
      const b = buses.get(ctx);
      if (!b) return;
      if (S().mono) { b.channelCount = 1; b.channelCountMode = 'explicit'; b.channelInterpretation = 'speakers'; }
      else { b.channelCount = 2; b.channelCountMode = 'max'; b.channelInterpretation = 'speakers'; }
    },
    // Element nachträglich über Web Audio leiten (nur bei Mono nötig)
    routeMono(el) {
      if (el._vnSrc || !corsOk(el.currentSrc || el.src) || el.crossOrigin !== 'anonymous') return;
      const ctx = window.Fx && Fx.ctx ? Fx.ctx() : null;
      if (!ctx) return;
      try { el._vnSrc = ctx.createMediaElementSource(el); el._vnSrc.connect(Out.bus(ctx)); } catch (e) { /* schon verbunden */ }
    },
    // Testton (Ding) über das gewählte Gerät
    test(which) {
      const ctx = new OrigCtx();
      const id = which != null ? which : Out.sinkId();
      const go = () => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.type = 'sine';
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.35 * Out.factor(), ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
        o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.65);
        setTimeout(() => ctx.close().catch(() => {}), 900);
      };
      if (ctx.setSinkId && id) ctx.setSinkId(id).then(go, go); else go();
    },
    // Auswahlliste der Geräte (für Editor und Spiel)
    async select(value, onChange, cls) {
      const list = await Out.devices();
      const sel = VN.el('select', { class: cls || 'set-select', onchange: (e) => onChange(e.target.value) },
        VN.el('option', { value: '' }, 'System-Standard'),
        ...list.map((d) => VN.el('option', { value: d.id }, d.label)));
      sel.value = list.some((d) => d.id === value) ? value : '';
      return sel;
    },
    _known: null
  });

  // Lautstärke: Code setzt den gewünschten Wert, tatsächlich gilt Wert × Gesamtlautstärke
  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
  const setVol = (el, v) => { el._vol = v; desc.set.call(el, Math.max(0, Math.min(1, v * Out.factor(el)))); };
  Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
    configurable: true,
    get() { return this._vol != null ? this._vol : desc.get.call(this); },
    set(v) { setVol(this, Number(v)); }
  });

  // Vor jedem Abspielen: richtiges Gerät, Mono-Weg, Gesamtlautstärke
  const origPlay = HTMLMediaElement.prototype.play;
  // Beendete oder geleerte Elemente sofort austragen, damit sich keine alten Aufnahmen ansammeln
  const forget = (e) => media.delete(e.target);
  HTMLMediaElement.prototype.play = function () {
    if (!media.has(this)) { this.addEventListener('ended', forget); this.addEventListener('emptied', forget); }
    media.add(this);
    // Viele angehaltene, nicht mehr eingebundene Elemente (z. B. abgebrochene Stimmen): aufräumen
    if (media.size > 48) for (const el of Array.from(media)) if (el !== this && el.paused && !el.isConnected) media.delete(el);
    Out.applySink(this);
    if (this._vol == null) setVol(this, desc.get.call(this));
    if (S().mono) Out.routeMono(this);
    const pr = origPlay.apply(this, arguments);
    // Abbrüche (pause() während des Ladens) und Autoplay-Sperren sind normal – alles andere protokollieren
    if (pr && pr.catch) pr.catch((e) => { if (e && e.name !== 'AbortError' && e.name !== 'NotAllowedError' && window.Perf) Perf.addLog('ton', (e.name || 'Fehler') + ': ' + (e.message || '') + ' – ' + decodeURIComponent(String(this.currentSrc || this.src || '').split('/').pop())); });
    return pr;
  };

  // AudioContexts merken und auf das gewählte Gerät legen
  if (OrigCtx) {
    class Ctx extends OrigCtx {
      constructor(o) { super(o); ctxs.add(this); Out.applySink(this); }
      close() { ctxs.delete(this); return super.close(); }
    }
    window.AudioContext = Ctx;
    if (window.webkitAudioContext) window.webkitAudioContext = Ctx;
  }

  // Kopfhörer eingesteckt / Gerät entfernt
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', async () => {
      const list = await Out.devices();
      const s = S();
      let lost = null;
      for (const k of ['audioOut', 'audioOutEditor']) {
        if (s[k] && !list.some((d) => d.id === s[k])) { lost = s[k]; s[k] = ''; }
      }
      if (lost && VN.toast) VN.toast('Ausgabegerät nicht mehr da – zurück auf System-Standard');
      Out.refresh();
    });
  }
})();
