// Leistung: Qualitätsstufen, Selbstregelung, Bildraten-Messung, Speicher-Schätzung, Vorladen,
// Entwickler-Konsole. Läuft im Editor-Test, im Windows-Spiel und in der Web-Version.
(function () {
  const { el } = VN;

  // Qualitätsstufen. parts = Anteil der Partikel, blur = Unschärfe erlaubt,
  // bonesFps = Bildrate für Bones-Figuren (0 = jede Bildschirm-Aktualisierung)
  const LEVELS = {
    low: { label: 'Niedrig', parts: 0.35, blur: false, bonesFps: 20 },
    mid: { label: 'Mittel', parts: 0.65, blur: false, bonesFps: 30 },
    high: { label: 'Hoch', parts: 1, blur: true, bonesFps: 60 },
    ultra: { label: 'Ultra', parts: 1, blur: true, bonesFps: 0 }
  };
  const ORDER = ['low', 'mid', 'high', 'ultra'];

  // Log für die Konsole: Fehler, Warnungen von Plugins, fehlende Dateien
  const log = [];
  const addLog = (kind, msg) => { log.push({ t: new Date().toLocaleTimeString(), kind, msg: String(msg).slice(0, 400) }); if (log.length > 200) log.shift(); if (Perf.con) Perf.con.refreshLog(); };
  window.addEventListener('error', (e) => {
    const t = e.target;
    if (t && t !== window && (t.src || t.href)) addLog('datei', 'Fehlt oder defekt: ' + decodeURIComponent((t.src || t.href).split('/').slice(-2).join('/')));
    else addLog('fehler', e.message);
  }, true);
  window.addEventListener('unhandledrejection', (e) => addLog('fehler', (e.reason && e.reason.message) || e.reason));
  const origErr = console.error.bind(console);
  console.error = (...a) => { addLog('fehler', a.map((x) => (x && x.message) || x).join(' ')); origErr(...a); };

  const Perf = (window.Perf = {
    LEVELS, ORDER, log, addLog,
    level: 'high',        // wirksame Stufe
    auto: true,
    fps: 60, ms: 16.7, low1: 60,
    con: null,

    // Einstellungen des Spielers (VN.settings): quality = auto|low|mid|high|ultra|custom
    cfg() {
      const s = VN.settings || {};
      const q = s.quality || 'auto';
      if (q === 'custom') return { parts: s.qParts != null ? s.qParts : 1, blur: s.qBlur !== false, bonesFps: s.qBonesFps != null ? s.qBonesFps : 60 };
      return LEVELS[q === 'auto' ? Perf.level : q] || LEVELS.high;
    },
    fpsCap() { const s = VN.settings || {}; return s.fpsCap || 0; },
    partsMul() { return Perf.cfg().parts; },
    blurOk() { return Perf.cfg().blur; },
    // Mindestabstand zwischen zwei Bildern einer Animation (Sekunden); 0 = keine Bremse
    minInterval(kind) {
      const caps = [];
      const cap = Perf.fpsCap(); if (cap) caps.push(cap);
      if (kind === 'bones') { const b = Perf.cfg().bonesFps; if (b) caps.push(b); }
      return caps.length ? 1 / Math.min(...caps) - 0.002 : 0;
    },
    filterCss(css) { return css && !Perf.blurOk() ? css.replace(/blur\([^)]*\)/g, '').trim() : css; },

    // Neue Stufe anwenden (live)
    setLevel(lv, why) {
      if (!LEVELS[lv] || lv === Perf.level) return;
      Perf.level = lv;
      addLog('info', 'Qualität → ' + LEVELS[lv].label + (why ? ' (' + why + ')' : ''));
      Perf.applyLive();
    },
    applyLive() {
      if (window.Player && Player.running) { Player.fitStage(); if (Player.reapplyLook) Player.reapplyLook(); }
    },

    // ---------- Messung und Selbstregelung ----------
    // Läuft, solange das Spiel läuft. Ändert im Auto-Modus nur die Optik, nie Story oder Timing.
    startMonitor() {
      if (Perf._mon) return;
      let last = 0, frames = [], downT = 0, upT = 0;
      Perf._mon = true;
      Perf.level = (VN.settings && VN.settings.quality && LEVELS[VN.settings.quality]) ? VN.settings.quality : (Perf.level || 'high');
      const loop = (ts) => {
        if (!Perf._mon) return;
        if (last) {
          const dt = ts - last;
          if (dt < 1000) frames.push(dt);
          if (frames.length > 120) frames.shift();
        }
        last = ts;
        if (frames.length >= 20) {
          const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
          const sorted = frames.slice().sort((a, b) => a - b);
          Perf.ms = avg; Perf.fps = 1000 / avg; Perf.low1 = 1000 / sorted[Math.floor(sorted.length * 0.99)];
          const auto = !VN.settings || !VN.settings.quality || VN.settings.quality === 'auto';
          const cap = Perf.fpsCap();
          const target = cap ? cap * 0.85 : 50;
          if (auto && !document.hidden) {
            // Herunter: 2 s lang zu langsam. Hoch: 12 s lang mit viel Luft (Verzögerung gegen Hin-und-her)
            if (Perf.fps < target) { downT += dt(); upT = 0; } else if (Perf.fps > (cap ? cap * 0.97 : 58)) { upT += dt(); downT = 0; } else { downT = 0; upT = 0; }
            const i = ORDER.indexOf(Perf.level);
            if (downT > 2000 && i > 0) { Perf.setLevel(ORDER[i - 1], Math.round(Perf.fps) + ' fps'); downT = 0; frames = []; }
            else if (upT > 12000 && i < ORDER.indexOf('high')) { Perf.setLevel(ORDER[i + 1], 'genug Reserve'); upT = 0; frames = []; }
          }
          if (Perf.con) Perf.con.tick();
        }
        requestAnimationFrame(loop);
      };
      const dt = () => (frames.length ? frames[frames.length - 1] : 16);
      requestAnimationFrame(loop);
    },
    stopMonitor() { Perf._mon = false; },

    // ---------- Speicher-Schätzung ----------
    // Grafikspeicher der sichtbaren Bilder und Canvas (entpackt: Breite × Höhe × 4 Byte)
    memOf(root) {
      let bytes = 0;
      const list = [];
      const seen = new Set();
      if (!root) return { bytes, list };
      for (const n of root.querySelectorAll('img, canvas, video')) {
        const w = n.naturalWidth || n.videoWidth || n.width || 0, h = n.naturalHeight || n.videoHeight || n.height || 0;
        const key = n.tagName === 'IMG' ? n.currentSrc || n.src : n;
        if (!w || !h || seen.has(key)) continue;
        seen.add(key);
        const b = w * h * 4;
        bytes += b;
        list.push({ name: n.tagName === 'IMG' ? decodeURIComponent((n.currentSrc || n.src).split('/').pop()) : n.tagName === 'CANVAS' ? (n.classList.contains('rig-canvas') ? 'Bones-Figur' : 'Canvas (Effekt)') : 'Video', w, h, bytes: b });
      }
      list.sort((a, b) => b.bytes - a.bytes);
      return { bytes, list };
    },

    // ---------- Vorladen ----------
    // Bilder der nächsten möglichen Szenen im Hintergrund dekodieren, Rest freigeben
    _pre: new Map(),
    nextScenes(s) {
      const out = new Set();
      if (!s) return out;
      if (s.next) out.add(s.next);
      const json = JSON.stringify(s.tracks || s.objects || {}) + JSON.stringify(s.events || []);
      for (const m of json.matchAll(/"(?:target|goto|scene|to)":"([^"]+)"/g)) if (VN.scene(m[1])) out.add(m[1]);
      return out;
    },
    // Fehlende Dateien einer Szene: Asset gelöscht oder Datei nicht mehr auf der Festplatte
    missingOf(s) {
      const out = [];
      const stats = (window.Export && Export.stats) || null;
      const json = JSON.stringify(s);
      for (const a of VN.project.assets) if (stats && stats[a.file] && stats[a.file].missing && json.includes('"' + a.id + '"')) out.push(a.name + ' (' + a.file + ')');
      // Verweise auf gelöschte Dateien
      const keys = /"(asset|image|portrait|mask(?:Asset)?|sfx)":"([^"]+)"/g;
      let m;
      while ((m = keys.exec(json))) if (/^a[_-]|^as_|^asset/.test(m[2]) && !VN.asset(m[2]) && !out.includes(m[2])) out.push('gelöschte Datei (' + m[2] + ')');
      return out;
    },
    assetsOf(s) {
      const ids = new Set();
      if (!s) return ids;
      const json = JSON.stringify(s);
      for (const a of VN.project.assets) if (a.kind === 'image' && json.includes('"' + a.id + '"')) ids.add(a.id);
      return ids;
    },
    preloadAround(sceneId) {
      const s = VN.scene(sceneId);
      if (!s) return;
      const keep = new Set(Perf.assetsOf(s));
      for (const id of Perf.nextScenes(s)) for (const a of Perf.assetsOf(VN.scene(id))) keep.add(a);
      for (const id of keep) {
        if (Perf._pre.has(id)) continue;
        const url = VN.assetUrl(id);
        if (!url) continue;
        const im = new Image();
        im.decoding = 'async';
        im.src = url;
        if (im.decode) im.decode().catch(() => addLog('datei', 'Bild lässt sich nicht laden: ' + ((VN.asset(id) || {}).name || id)));
        Perf._pre.set(id, im);
      }
      // Was nicht mehr in Reichweite ist, wird freigegeben (Browser darf den Speicher zurückholen)
      for (const id of [...Perf._pre.keys()]) if (!keep.has(id)) Perf._pre.delete(id);
    },

    // ---------- Szenen-Check (Editor) ----------
    // Schätzt die Last einer Szene am schwersten Schritt. Grenzwerte aus dem Stresstest:
    // Bildfläche pro Bild in "Bildschirmen" (1 = einmal die Spielauflösung) und Grafikspeicher.
    check(scene) {
      const res = VN.res ? VN.res() : { w: 1920, h: 1080 };
      const scr = res.w * res.h;
      const stats = (window.Export && Export.stats) || {};
      const dims = (id) => { const a = VN.asset(id); const st = a && stats[a.file]; return st && st.w ? [st.w, st.h] : null; };
      const warn = [], big = [];
      let worst = { fill: 0, mem: 0, figs: 0, beat: 0 };
      if (!scene || scene.type !== 'story') return { level: 'ok', worst, warn, big };
      // Gleiche Szene ohne Änderung seitdem: Ergebnis wiederverwenden
      const memo = Perf._checkMemo.get(scene);
      if (memo && memo.rev === VN.saveRev && memo.stats === stats && memo.w === res.w && memo.h === res.h && memo.n === (VN.project.assets || []).length) return memo.out;
      // Der sichtbare Zustand ändert sich nur dort, wo ein Clip beginnt oder endet: nur diese Schritte prüfen
      const marks = new Set([0]);
      for (const list of Object.values(scene.tracks || {})) for (const c of list || []) {
        if (!c || typeof c.start !== 'number') continue;
        marks.add(c.start);
        if (c.len) marks.add(c.start + c.len);
        for (const k of c.keys || []) if (typeof k.at === 'number') marks.add(c.start + k.at);
      }
      const beats = [...marks].filter((b) => b >= 0 && b < scene.beats).sort((x, y) => x - y);
      for (const b of beats) {
        const st = Stage.state(scene, b);
        let fill = 0, mem = 0, figs = 0;
        const zoom = st.cam ? Math.max(st.cam.zoom || 100, ...((st.cam.keys || []).map((k) => k.zoom || 100))) / 100 : 1;
        const addImg = (id, area) => { const d = dims(id); mem += d ? d[0] * d[1] * 4 : scr * 4; fill += area; };
        // Gezeichnet wird nur, was im Bild sichtbar ist: Eine Vollbild-Ebene kostet ~1 Bildschirm, egal wie stark gezoomt
        void zoom;
        if (st.bg) {
          addImg(st.bg.asset, 1);
          for (const l of st.bg.layers || []) addImg(l.asset, l.front ? 0.6 : 1);
          if (st.bg.tile) fill += 0.2;
        }
        for (const [, c] of st.chars) {
          const rig = window.Rig && Rig.has(c.asset);
          if (rig) figs++;
          addImg(c.asset, ((c.scale || 100) / 100) * 0.45 * (rig ? 1.7 : 1));
        }
        if (st.fx && st.fx.particles) fill += 0.6 * ((st.fx.density || 50) / 100);
        if (st.fx && st.fx.filter) fill *= /blur/.test(Fx.FILTER_CSS[st.fx.filter] || '') ? 2.2 : 1.3;
        if (st.video) fill += 1;
        fill += 0.3;
        if (fill > worst.fill) worst = { fill, mem, figs, beat: b };
      }
      for (const id of Perf.assetsOf(scene)) {
        const d = dims(id), a = VN.asset(id);
        if (d && Math.max(d[0], d[1]) > Math.max(res.w, res.h) * 1.3 && !/\.svg$/i.test(a.file)) big.push({ a, w: d[0], h: d[1] });
      }
      if (big.length) warn.push(big.length + (big.length === 1 ? ' Bild ist' : ' Bilder sind') + ' deutlich größer als die Spielauflösung (' + res.w + '×' + res.h + ').');
      if (worst.fill > 12) warn.push('Sehr viel Bildfläche pro Bild (Schritt ' + (worst.beat + 1) + '): viele Ebenen übereinander oder Unschärfe. Für 60 fps eher eine eigene Grafikkarte nötig.');
      else if (worst.fill > 6) warn.push('Viel Bildfläche pro Bild (Schritt ' + (worst.beat + 1) + '). Ältere Onboard-Grafik (z. B. Intel UHD 620) schafft dann evtl. keine 60 fps mehr.');
      if (worst.mem > 900 * 1048576) warn.push('Hoher Grafikspeicher: ca. ' + VN.fmtMB(worst.mem) + '.');
      else if (worst.mem > 450 * 1048576) warn.push('Grafikspeicher ca. ' + VN.fmtMB(worst.mem) + ' (für ältere Laptops viel).');
      const missing = Perf.missingOf(scene);
      if (missing.length) warn.unshift('⚠ ' + (missing.length === 1 ? 'Eine Datei fehlt' : missing.length + ' Dateien fehlen') + ': ' + missing.slice(0, 4).join(', ') + (missing.length > 4 ? ' …' : '') + '. Im Spiel bleibt die Stelle leer bzw. stumm.');
      const level = missing.length || worst.fill > 12 || worst.mem > 900 * 1048576 ? 'red' : worst.fill > 6 || worst.mem > 450 * 1048576 || big.length ? 'yellow' : 'ok';
      const out = { level, worst, warn, big, missing };
      Perf._checkMemo.set(scene, { rev: VN.saveRev, stats, w: res.w, h: res.h, n: (VN.project.assets || []).length, out });
      return out;
    },
    _checkMemo: new WeakMap(),

    // ---------- Entwickler-Konsole ----------
    consoleAllowed() { return !VN.gameMode || !!(VN.project && VN.project.devConsole); },
    toggleConsole(host) {
      if (Perf.con) { Perf.con.close(); return; }
      if (!Perf.consoleAllowed() || !host) return;
      Perf.con = makeConsole(host);
    }
  });

  const COMMANDS = {
    hilfe: ['', 'Alle Befehle anzeigen'],
    springe: ['<szene> [schritt]', 'Zu einer Szene springen (Name oder ID)'],
    setze: ['<variable> <wert>', 'Variable, Geld oder Beziehung setzen'],
    qualitaet: ['auto|niedrig|mittel|hoch|ultra', 'Qualitätsstufe erzwingen'],
    partikel: ['an|aus', 'Partikel ein-/ausschalten'],
    bildrate: ['30|60|0', 'Bildrate begrenzen (0 = aus)'],
    neu: ['', 'Aktuellen Schritt neu laden'],
    bilder: ['', 'Geladene Bilder mit Größe auflisten'],
    leeren: ['', 'Protokoll leeren']
  };
  const LV_NAMES = { auto: 'auto', niedrig: 'low', mittel: 'mid', hoch: 'high', ultra: 'ultra', low: 'low', mid: 'mid', high: 'high' };

  function makeConsole(host) {
    const out = el('div', { class: 'dc-log' });
    const stats = el('div', { class: 'dc-stats' });
    const input = el('input', { class: 'dc-in', placeholder: 'Befehl … (hilfe)', spellcheck: false });
    const box = el('div', { class: 'dev-console', onclick: (e) => e.stopPropagation(), onkeydown: (e) => e.stopPropagation() },
      el('div', { class: 'dc-head' }, el('strong', null, 'Entwickler-Konsole'), el('span', { class: 'muted' }, ' ^ oder F12 schließt'), el('button', { class: 'dc-x', onclick: () => con.close() }, '×')),
      stats, out, input);
    host.appendChild(box);
    const hist = []; let hi = 0;
    const say = (msg, kind) => { out.appendChild(el('div', { class: 'dc-line ' + (kind || '') }, msg)); out.scrollTop = out.scrollHeight; };
    const con = {
      close() { box.remove(); Perf.con = null; },
      refreshLog() {
        out.innerHTML = '';
        for (const l of log) say(l.t + '  ' + (l.kind === 'fehler' ? '✖ ' : l.kind === 'datei' ? '⚠ ' : '• ') + l.msg, l.kind);
      },
      tick() {
        const now = performance.now();
        if (con._t && now - con._t < 400) return;
        con._t = now;
        const st = Player.state;
        const m = Perf.memOf(Player.host);
        const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : '–';
        const fps = Math.round(Perf.fps);
        const col = fps >= 55 ? 'ok' : fps >= 40 ? 'warn' : 'bad';
        const q = VN.settings.quality || 'auto';
        stats.innerHTML = '';
        stats.append(
          el('span', { class: 'dc-fps ' + col }, fps + ' fps'),
          el('span', null, 'Bildzeit ' + Perf.ms.toFixed(1) + ' ms · 1 % tief ' + Math.round(Perf.low1) + ' fps'),
          el('span', null, 'Grafik ca. ' + VN.fmtMB(m.bytes) + ' · Skript ' + heap),
          el('span', null, 'Qualität ' + (q === 'auto' ? 'Auto → ' + LEVELS[Perf.level].label : q === 'custom' ? 'Eigene' : LEVELS[q].label)),
          el('span', null, st ? 'Szene ' + ((VN.scene(st.scene) || {}).name || st.scene) + ' · Schritt ' + (st.beat + 1) : 'Hauptmenü'));
      },
      run(line) {
        say('> ' + line, 'cmd');
        const [cmd, ...args] = line.trim().split(/\s+/);
        const c = (cmd || '').toLowerCase().replace('ä', 'ae');
        try {
          if (c === 'hilfe' || c === 'help') { for (const [k, v] of Object.entries(COMMANDS)) say(k + ' ' + v[0] + '  –  ' + v[1]); }
          else if (c === 'springe') {
            const q = args[0] || '';
            const s = VN.project.scenes.find((x) => x.id === q || x.name.toLowerCase() === q.toLowerCase()) || VN.project.scenes.find((x) => x.name.toLowerCase().includes(q.toLowerCase()));
            if (!s) return say('Szene nicht gefunden: ' + q, 'fehler');
            Player.jump(s.id, Math.max(0, (Number(args[1]) || 1) - 1));
            say('Springe zu ' + s.name);
          } else if (c === 'setze') {
            const r = Player.setValue(args[0], args.slice(1).join(' '));
            say(r || 'Unbekannt: ' + args[0], r ? '' : 'fehler');
          } else if (c === 'qualitaet') {
            const lv = LV_NAMES[(args[0] || '').toLowerCase()];
            if (!lv) return say('Stufen: auto, niedrig, mittel, hoch, ultra', 'fehler');
            VN.settings.quality = lv; if (lv !== 'auto') Perf.level = lv; Perf.applyLive();
            say('Qualität: ' + (lv === 'auto' ? 'Auto' : LEVELS[lv].label));
          } else if (c === 'partikel') {
            VN.settings.quality = 'custom'; const k = Perf.cfg(); Object.assign(VN.settings, { qParts: args[0] === 'aus' ? 0 : 1, qBlur: k.blur, qBonesFps: k.bonesFps });
            Perf.applyLive(); say('Partikel ' + (args[0] === 'aus' ? 'aus' : 'an'));
          } else if (c === 'bildrate') {
            VN.settings.fpsCap = Number(args[0]) || 0; say('Bildrate: ' + (VN.settings.fpsCap ? VN.settings.fpsCap + ' fps' : 'unbegrenzt'));
          } else if (c === 'neu') { Player.reloadBeat(); say('Neu geladen'); }
          else if (c === 'bilder') { const m = Perf.memOf(Player.host); for (const x of m.list) say(x.name + '  ' + x.w + '×' + x.h + '  ' + VN.fmtMB(x.bytes)); say('Summe ca. ' + VN.fmtMB(m.bytes)); }
          else if (c === 'leeren') { log.length = 0; out.innerHTML = ''; }
          else if (c) say('Unbekannter Befehl. „hilfe“ zeigt alle.', 'fehler');
        } catch (e) { say('Fehler: ' + e.message, 'fehler'); }
      }
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && input.value.trim()) { hist.push(input.value); hi = hist.length; con.run(input.value); input.value = ''; }
      else if (e.key === 'ArrowUp' && hi > 0) { input.value = hist[--hi]; e.preventDefault(); }
      else if (e.key === 'ArrowDown' && hi < hist.length) { input.value = hist[++hi] || ''; e.preventDefault(); }
      else if (e.key === 'Escape' || e.code === 'Backquote' || e.key === 'F12' || e.key === 'Dead' || e.key === '^') { e.preventDefault(); con.close(); }
    });
    con.refreshLog();
    say('Bereit. „hilfe“ zeigt alle Befehle.', 'info');
    setTimeout(() => input.focus(), 30);
    con.tick();
    return con;
  }
})();
