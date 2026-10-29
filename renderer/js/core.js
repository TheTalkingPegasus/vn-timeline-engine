// Kern: Zustand, Hilfsfunktionen, Rückgängig, Speichern
(function () {
  const api = window.vnApi;

  const VN = (window.VN = {
    api,
    dir: null,
    project: null,
    dirty: false,
    ui: {
      view: 'scene',
      sceneId: null,
      sel: null,        // ausgewählter Clip oder Objekt (id)
      beat: 0,
      zoom: 96,         // Pixel pro Schritt
      assetTab: 'image',
      showHitboxes: true,
      graphPan: { x: 40, y: 40 },
      graphSel: null
    },
    undoStack: [],
    redoStack: []
  });

  // append() ohne leere Werte (null/false werden sonst als Text eingefügt)
  const nativeAppend = Element.prototype.append;
  Element.prototype.append = function (...nodes) { return nativeAppend.apply(this, nodes.filter((n) => n !== null && n !== undefined && n !== false)); };

  window.__vnErrors = [];
  window.addEventListener('error', (e) => window.__vnErrors.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => { const m = String((e.reason && (e.reason.message || e.reason.name)) || e.reason); if (!/AbortError|NotAllowedError|NotSupportedError|play\(\)|interrupted/i.test(m)) window.__vnErrors.push('Promise: ' + m); });

  // Spuren der Story-Timeline
  VN.TRACKS = [
    { key: 'bg', label: 'Hintergrund', kind: 'image', color: '#7c8496', fg: '#0f1115' },
    { key: 'char1', label: 'Figur 1', kind: 'image', color: '#6cc48a', fg: '#0d1f13' },
    { key: 'char2', label: 'Figur 2', kind: 'image', color: '#8fd6a6', fg: '#0d1f13' },
    { key: 'dialog', label: 'Dialog', kind: 'dialog', color: '#4fb3c8', fg: '#0f1a1e' },
    { key: 'choice', label: 'Auswahl', kind: 'choice', color: '#e8a43a', fg: '#1d1404' },
    { key: 'music', label: 'Musik', kind: 'audio', color: '#a58cf0', fg: '#17112a', sep: true },
    { key: 'voice', label: 'Voices', kind: 'audio', color: '#5fa8e8', fg: '#0a1826' },
    { key: 'sfx', label: 'Soundeffekte', kind: 'audio', color: '#c9b37a', fg: '#1f1806' }
  ];
  VN.track = (key) => VN.TRACKS.find((t) => t.key === key);

  VN.uid = (p) => {
    VN.project.counter = (VN.project.counter || 0) + 1;
    return p + '_' + VN.project.counter.toString(36) + Math.random().toString(36).slice(2, 5);
  };

  VN.scene = (id) => (VN.project ? VN.project.scenes.find((s) => s.id === id) : null);
  VN.curScene = () => VN.scene(VN.ui.sceneId);
  VN.asset = (id) => (id && VN.project ? VN.project.assets.find((a) => a.id === id) : null);
  VN.assetsOf = (kind) => VN.project.assets.filter((a) => a.kind === kind);

  const urlCache = {};
  VN.assetUrl = (id) => {
    const a = VN.asset(id);
    if (!a) return '';
    const key = VN.dir + '|' + a.file;
    if (!urlCache[key]) urlCache[key] = api.fileUrl(VN.dir, a.file);
    return urlCache[key];
  };

  // ---------- Spuren ----------
  // Grundart einer Spur: Figur-Spuren heißen char1, char2 … oder x_… (zusätzliche Spuren)
  VN.tbase = (t) => (t ? t.base || (/^char\d+$/.test(t.key) ? 'char' : t.key) : null);
  // Zusätzliche Spuren, die man pro Szene anlegen kann
  VN.XTRACK_KINDS = {
    char: { label: 'Figur', tmpl: 'char2', desc: 'Weitere Figur (Gruppenszenen)' },
    music: { label: 'Musik / Atmo', tmpl: 'music', desc: 'Läuft parallel zur Musik, z. B. Regen, Wind, Menschenmenge' },
    sfx: { label: 'Soundeffekte', tmpl: 'sfx', desc: 'Weitere Geräusche gleichzeitig' },
    voice: { label: 'Stimme', tmpl: 'voice', desc: 'Zweite Stimme, z. B. Chor oder Hintergrund-Gemurmel' },
    fx: { label: 'Effekt-Ebene', tmpl: 'fx', desc: 'Zweite Ebene für Partikel oder Licht (z. B. Regen + Nebel)' }
  };
  // Alle Spuren einer Szene in Anzeige-Reihenfolge (eingebaute + zusätzliche), mit Namen und Schaltern
  VN.tracksOf = (scene) => {
    let list = VN.TRACKS.map((t) => Object.assign({}, t, { base: VN.tbase(t), builtin: true }));
    if (!scene || scene.type !== 'story') return list;
    for (const x of scene.xtracks || []) {
      const k = VN.XTRACK_KINDS[x.base];
      if (!k) continue;
      const tm = VN.TRACKS.find((t) => t.key === k.tmpl);
      const def = Object.assign({}, tm, { key: x.key, base: x.base, label: x.name || k.label, extra: true, sep: false });
      let at = -1;
      list.forEach((t, i) => { if (t.base === x.base) at = i; });
      list.splice(at + 1, 0, def);
    }
    if (scene.torder && scene.torder.length) {
      const pos = (k) => { const i = scene.torder.indexOf(k); return i < 0 ? 1e6 : i; };
      const orig = list.map((t) => t.key);
      list.sort((a, b) => pos(a.key) - pos(b.key) || orig.indexOf(a.key) - orig.indexOf(b.key));
    }
    const tro = scene.tro || {};
    for (const t of list) {
      const o = tro[t.key];
      if (!o) continue;
      if (o.name) t.label = o.name;
      t.mute = !!o.mute; t.solo = !!o.solo; t.lock = !!o.lock; t.hide = !!o.hide;
    }
    return list;
  };
  VN.trackOf = (scene, key) => VN.tracksOf(scene).find((t) => t.key === key) || VN.track(key);
  // Spur aktiv? Stumm/Solo/Ausblenden gelten beim Bearbeiten und Testen im Editor, nie im fertigen Spiel.
  VN.trackOn = (scene, t, list) => {
    if (VN.gameMode || !t) return true;
    if (t.hide || t.mute) return false;
    if (t.kind === 'audio') {
      const all = list || VN.tracksOf(scene);
      if (all.some((x) => x.kind === 'audio' && x.solo) && !t.solo) return false;
    }
    return true;
  };

  // Clip finden, egal auf welcher Spur
  VN.findClip = (scene, clipId) => {
    if (!scene || scene.type !== 'story') return null;
    for (const t of VN.tracksOf(scene)) {
      const c = (scene.tracks[t.key] || []).find((x) => x.id === clipId);
      if (c) return { clip: c, track: t };
    }
    return null;
  };

  VN.ensureTracks = (scene) => {
    if (scene.type !== 'story') return;
    scene.tracks = scene.tracks || {};
    for (const t of VN.tracksOf(scene)) scene.tracks[t.key] = scene.tracks[t.key] || [];
  };

  // ---------- Rückgängig / Wiederholen ----------
  // Jeder Schritt speichert das Projekt in Stücken: ein Stück pro Szene plus der Rest.
  // Unveränderte Stücke teilen sich den Speicher mit dem Schritt davor, deshalb passen auch
  // bei großen Projekten 100 Schritte in den Verlauf (vorher: ganze Kopie pro Schritt).
  const snapOf = (p, prev) => {
    const scenes = p.scenes || [];
    const rest = JSON.stringify(Object.assign({}, p, { scenes: null }));
    const snap = { rest: prev && prev.rest === rest ? prev.rest : rest, scenes: new Array(scenes.length), byId: new Map(), bytes: 0 };
    if (!prev || prev.rest !== rest) snap.bytes += rest.length;
    for (let i = 0; i < scenes.length; i++) {
      const str = JSON.stringify(scenes[i]);
      const old = prev && prev.byId.get(scenes[i] && scenes[i].id);
      if (old === str) snap.scenes[i] = old;
      else { snap.scenes[i] = str; snap.bytes += str.length; }
      snap.byId.set(scenes[i] && scenes[i].id, snap.scenes[i]);
    }
    return snap;
  };
  const fromSnap = (snap) => { const p = JSON.parse(snap.rest); p.scenes = snap.scenes.map((x) => JSON.parse(x)); return p; };
  const top = (st) => st[st.length - 1] || null;
  VN.snapshot = snapOf;
  VN.mutate = (fn) => {
    VN.undoStack.push(snapOf(VN.project, top(VN.undoStack)));
    VN.trimUndo();
    VN.redoStack = [];
    fn();
    if (VN.migrate) VN.migrate(VN.project);
    VN.markDirty();
    VN.render();
  };
  // Verlauf begrenzen: max. 100 Schritte und max. ~48 MB neue Daten
  VN.UNDO_MAX_CHARS = 24 * 1024 * 1024;
  VN.trimUndo = () => {
    let total = 0;
    for (const x of VN.undoStack) total += x.bytes;
    while (VN.undoStack.length > 1 && (VN.undoStack.length > 100 || total > VN.UNDO_MAX_CHARS)) total -= VN.undoStack.shift().bytes;
  };
  VN.undo = () => {
    if (!VN.undoStack.length) return;
    VN.redoStack.push(snapOf(VN.project, top(VN.undoStack)));
    VN.project = fromSnap(VN.undoStack.pop());
    VN.fixSelection();
    VN.markDirty();
    VN.render();
    VN.toast('Rückgängig');
  };
  VN.redo = () => {
    if (!VN.redoStack.length) return;
    VN.undoStack.push(snapOf(VN.project, top(VN.redoStack)));
    VN.project = fromSnap(VN.redoStack.pop());
    VN.fixSelection();
    VN.markDirty();
    VN.render();
    VN.toast('Wiederholt');
  };
  VN.fixSelection = () => {
    if (!VN.scene(VN.ui.sceneId)) VN.ui.sceneId = VN.project.scenes[0] ? VN.project.scenes[0].id : null;
    VN.ui.sel = null;
  };

  // ---------- Speichern ----------
  // Jede Änderung zählt eine Nummer hoch. Gespeichert ist nur, was bis zum Start des Schreibens geändert war:
  // Ändert man während des Speicherns weiter, bleibt „Ungespeichert“ stehen und es wird gleich nachgespeichert.
  let saveTimer = null, saving = null;
  VN.saveRev = 0;
  VN.savedRev = 0;
  VN.markDirty = () => {
    VN.saveRev++;
    VN.dirty = true;
    VN.updateSaveStatus();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(VN.save, 1200);
  };
  VN.save = async () => {
    clearTimeout(saveTimer);
    if (!VN.dir || !VN.project) return;
    // Läuft schon ein Speichern: abwarten, danach nur noch speichern, wenn sich seitdem etwas geändert hat
    while (saving) { try { await saving; } catch (e) { /* unten erneut */ } }
    if (VN.savedRev === VN.saveRev && !VN.dirty) return;
    const rev = VN.saveRev;
    const dir = VN.dir;
    saving = (async () => {
      if (VN.Schema) VN.Schema.stamp(VN.project);
      await api.saveProject(dir, JSON.stringify(VN.project, null, 1));
    })();
    try {
      await saving;
      if (dir === VN.dir) VN.savedRev = Math.max(VN.savedRev, rev);
    } catch (e) {
      VN.toast('Speichern fehlgeschlagen: ' + e.message);
    } finally {
      saving = null;
    }
    VN.dirty = VN.savedRev !== VN.saveRev;
    VN.updateSaveStatus();
    if (VN.dirty) { clearTimeout(saveTimer); saveTimer = setTimeout(VN.save, 400); }
  };
  // Vor dem Schließen des Fensters: alles Ausstehende sichern
  VN.flush = async () => { if (VN.dirty || saving) await VN.save(); };
  if (api && api.onFlush) api.onFlush(() => VN.flush());
  VN.updateSaveStatus = () => {
    const el = document.getElementById('save-status');
    if (el) el.textContent = VN.dirty ? 'Ungespeichert …' : 'Gespeichert';
  };

  // ---------- DOM-Helfer ----------
  VN.el = (tag, attrs, ...children) => {
    const e = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'html') e.innerHTML = v;
        else if (v === true) e.setAttribute(k, '');
        else e.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return e;
  };

  let toastTimer = null;
  VN.toast = (msg) => {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  };

  // Kontextmenü: items = [{label, hint, action, danger} | 'sep' | {head}]
  VN.menu = (x, y, items) => {
    const m = document.getElementById('ctxmenu');
    m.innerHTML = '';
    for (const it of items) {
      if (!it) continue;
      if (it === 'sep') { m.appendChild(VN.el('div', { class: 'msep' })); continue; }
      if (it.head) { m.appendChild(VN.el('div', { class: 'mhead' }, it.head)); continue; }
      m.appendChild(VN.el('div', {
        class: 'mi' + (it.danger ? ' danger' : '') + (it.disabled ? ' disabled' : ''),
        onclick: () => { if (it.disabled) return; VN.closeMenu(); it.action(); }
      }, VN.el('span', null, it.label), it.hint ? VN.el('span', { class: 'muted small' }, it.hint) : null));
    }
    m.hidden = false;
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
    m.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
  };
  // Kleines Eingabefenster (Ersatz für window.prompt, das Electron nicht kennt)
  VN.prompt = (title, value) => new Promise((resolve) => {
    const back = VN.el('div', { class: 'modal-back' });
    const inp = VN.el('input', { class: 'inp', value: value || '', style: { width: '320px' } });
    const done = (v) => { back.remove(); resolve(v); };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') done(inp.value.trim() || null); if (e.key === 'Escape') done(null); });
    back.appendChild(VN.el('div', { class: 'modal' },
      VN.el('strong', null, title), inp,
      VN.el('div', { class: 'row gap8', style: { justifyContent: 'flex-end' } },
        VN.el('button', { class: 'btn', onclick: () => done(null) }, 'Abbrechen'),
        VN.el('button', { class: 'btn primary', onclick: () => done(inp.value.trim() || null) }, 'OK'))));
    document.body.appendChild(back);
    setTimeout(() => { inp.focus(); inp.select(); }, 0);
  });
  VN.closeMenu = () => { document.getElementById('ctxmenu').hidden = true; };
  document.addEventListener('mousedown', (e) => {
    const m = document.getElementById('ctxmenu');
    if (!m.hidden && !m.contains(e.target)) VN.closeMenu();
  });

  // Ziehen mit der Maus: onMove(dx, dy, ev), onEnd(dx, dy, moved)
  VN.drag = (ev, onMove, onEnd) => {
    const sx = ev.clientX, sy = ev.clientY;
    let moved = false;
    const mm = (e) => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      if (moved) onMove(dx, dy, e);
    };
    const mu = (e) => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', mu);
      onEnd(e.clientX - sx, e.clientY - sy, moved, e);
    };
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', mu);
  };

  // ---------- Szenen anlegen ----------
  VN.newStoryScene = (name, x, y) => {
    const s = {
      id: VN.uid('s'), type: 'story', name: name || VN.t('Neue Story-Szene'),
      x: x != null ? x : 120 + Math.random() * 200, y: y != null ? y : 120 + Math.random() * 200,
      beats: 3, next: null, tracks: {}
    };
    VN.ensureTracks(s);
    const tp = VN.project.trackTplDefault && (VN.project.trackTpls || []).find((x) => x.id === VN.project.trackTplDefault);
    if (tp && window.Story) { Story.applyTpl(s, tp); VN.ensureTracks(s); }
    VN.project.scenes.push(s);
    return s;
  };
  VN.newHubScene = (name, x, y) => {
    const s = {
      id: VN.uid('h'), type: 'hub', name: name || VN.t('Neue Hub-Szene'),
      x: x != null ? x : 160 + Math.random() * 200, y: y != null ? y : 160 + Math.random() * 200,
      bg: null, music: null, objects: []
    };
    VN.project.scenes.push(s);
    return s;
  };

  // Ausgehende Verbindungen einer Szene
  VN.edgesOf = (s) => {
    const out = [];
    if (s.type === 'story') {
      if (s.next) out.push({ to: s.next, label: 'weiter', kind: 'next' });
      for (const c of s.tracks.choice || []) {
        c.options.forEach((o, i) => { if (o.target) out.push({ to: o.target, label: o.text || 'Option', kind: 'choice', clip: c, index: i }); });
      }
    } else {
      for (const o of s.objects || []) if (o.target) out.push({ to: o.target, label: o.name || 'Objekt', kind: 'hub', obj: o });
    }
    return out.filter((e) => VN.scene(e.to));
  };

  VN.reachable = () => {
    const seen = new Set();
    const start = VN.scene(VN.project.startScene) ? VN.project.startScene : (VN.project.scenes[0] && VN.project.scenes[0].id);
    const q = start ? [start] : [];
    while (q.length) {
      const id = q.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      const s = VN.scene(id);
      if (s) for (const e of VN.edgesOf(s)) q.push(e.to);
    }
    return seen;
  };

  VN.deleteScene = (id) => {
    VN.mutate(() => {
      const p = VN.project;
      p.scenes = p.scenes.filter((s) => s.id !== id);
      for (const s of p.scenes) {
        if (s.type === 'story') {
          if (s.next === id) s.next = null;
          for (const c of s.tracks.choice) for (const o of c.options) if (o.target === id) o.target = null;
        } else {
          for (const o of s.objects) if (o.target === id) o.target = null;
        }
      }
      if (p.startScene === id) p.startScene = p.scenes[0] ? p.scenes[0].id : null;
      if (VN.ui.sceneId === id) VN.ui.sceneId = p.scenes[0] ? p.scenes[0].id : null;
      VN.ui.sel = null;
    });
  };

  // Szenen-Auswahlfeld für Ziele
  VN.sceneSelect = (value, onChange, opts = {}) => {
    const sel = VN.el('select', { onchange: (e) => onChange(e.target.value || null) });
    sel.appendChild(VN.el('option', { value: '' }, opts.emptyLabel || '— keins —'));
    // Welt & Orte: nach einem Ereignis zurück an den Ort bzw. nach Hause
    if (opts.world && VN.World && VN.World.on()) for (const [v, l] of [['@return', '↩ Zurück zum Ort (nach Ereignis)'], ['@home', '🏠 Nach Hause']]) { const o = VN.el('option', { value: v }, l); if (v === value) o.selected = true; sel.appendChild(o); }
    for (const s of VN.project.scenes) {
      if (opts.exclude && s.id === opts.exclude) continue;
      const o = VN.el('option', { value: s.id }, (s.type === 'hub' ? '⌂ ' : '') + s.name);
      if (s.id === value) o.selected = true;
      sel.appendChild(o);
    }
    return sel;
  };

  VN.assetSelect = (kind, value, onChange) => {
    const sel = VN.el('select', { onchange: (e) => onChange(e.target.value || null) });
    sel.appendChild(VN.el('option', { value: '' }, '— keine Datei —'));
    for (const a of VN.assetsOf(kind)) {
      const o = VN.el('option', { value: a.id }, a.name);
      if (a.id === value) o.selected = true;
      sel.appendChild(o);
    }
    return sel;
  };

  // Dateien ins Projekt holen und als Assets registrieren
  VN.importPaths = async (paths) => {
    if (!VN.dir || !paths.length) return [];
    const res = await api.copyAssets(VN.dir, paths);
    return VN.registerAssets(res);
  };
  VN.registerAssets = (res) => {
    if (!res || !res.length) return [];
    const added = [];
    VN.mutate(() => {
      for (const r of res) {
        const a = { id: VN.uid('a'), name: r.name, kind: r.kind, file: r.file };
        VN.project.assets.push(a);
        added.push(a);
      }
    });
    VN.toast(added.length + (added.length === 1 ? ' Datei importiert' : ' Dateien importiert'));
    if (window.Export) Export.badgeSoon();
    return added;
  };
  VN.filePaths = (dataTransfer) => {
    const out = [];
    for (const f of dataTransfer.files || []) {
      const p = api.pathForFile(f);
      if (p) out.push(p);
    }
    return out;
  };

  // Audio-Vorschau im Editor
  let previewAudio = null;
  VN.previewSound = (assetId, inSec, outSec) => {
    if (previewAudio) { previewAudio.pause(); previewAudio = null; }
    const url = VN.assetUrl(assetId);
    if (!url) return;
    const a = previewAudio = new Audio(url);
    a.volume = 0.8;
    if (inSec) a.currentTime = inSec;
    a.play().catch(() => {});
    if (outSec) {
      const check = () => { if (a !== previewAudio) return; if (a.currentTime >= outSec) a.pause(); else requestAnimationFrame(check); };
      requestAnimationFrame(check);
    }
  };
  VN.stopPreview = () => { if (previewAudio) { previewAudio.pause(); previewAudio = null; } };

  VN.render = () => {};  // wird in app.js gesetzt
})();
