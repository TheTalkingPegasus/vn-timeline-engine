// Grundausstattung für Spieler: Wissen über Durchläufe, Galerie, Erfolge, Werte, Gegenstände benutzen/kombinieren.
// Läuft im Editor und im fertigen Spiel. Bildschirme dazu: player-extras.js, Editor-Reiter: extras-edit.js
(function () {
  const { el } = VN;
  const X = (VN.Extras = {});

  // ---------- Dauerhafter Speicher (gilt für alle Spielstände und Durchläufe) ----------
  // read: gelesene Zeilen (für Überspringen), seen: je gesehene Szenen, gallery/music: freigeschaltete Bilder/Stücke,
  // ach: Erfolge (Zeitpunkt), know: Wissen über Durchläufe
  let cache = null, cacheKey = '', saveT = 0;
  X.pid = () => {
    const p = VN.project;
    if (!p.persistId) {
      // Altes exportiertes Spiel ohne Kennung: aus dem Titel ableiten, damit es stabil bleibt
      if (VN.gameMode) { let h = 2166136261; const t = String(p.title || 'spiel'); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } p.persistId = 't' + (h >>> 0).toString(36); }
      else p.persistId = 'p' + Math.random().toString(36).slice(2, 10);
    }
    return p.persistId;
  };
  X.key = () => 'vn-global:' + X.pid() + (VN.gameMode ? '' : ':editor');
  X.P = () => {
    const k = X.key();
    if (cache && cacheKey === k) return cache;
    let d = {};
    try { d = JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { d = {}; }
    for (const f of ['read', 'seen', 'gallery', 'music', 'ach', 'know', 'galNew']) d[f] = d[f] || {};
    cache = d; cacheKey = k;
    return d;
  };
  X.save = () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(cacheKey, JSON.stringify(cache)); } catch (e) { /* Speicher voll oder gesperrt */ } }, 250);
  };
  X.reset = () => { cache = null; try { localStorage.removeItem(X.key()); } catch (e) { /* egal */ } };
  X.mark = (field, id) => { if (!id) return false; const P = X.P(); if (P[field][id]) return false; P[field][id] = Date.now(); X.save(); return true; };

  // ---------- Galerie ----------
  X.galleryImages = () => VN.project.assets.filter((a) => a.kind === 'image' && a.gallery);
  X.galleryMusic = () => VN.project.assets.filter((a) => a.kind === 'audio' && a.musicRoom);
  X.replayScenes = () => VN.project.scenes.filter((s) => s.replay);
  X.galleryOn = () => !!(X.galleryImages().length || X.galleryMusic().length || X.replayScenes().length);
  X.seeImage = (id) => { const a = id && VN.asset(id); if (a && a.gallery) X.mark('gallery', id); };
  // Neu freigeschaltet (z. B. von einer Figur geschickt): leuchtet als „Neu“, bis man es in der Galerie öffnet
  X.unlockNew = (id) => { const a = id && VN.asset(id); if (!a) return; if (X.mark('gallery', id)) { X.P().galNew[id] = Date.now(); X.save(); } };
  X.isNew = (id) => !!X.P().galNew[id];
  X.seenNew = (id) => { const P = X.P(); if (P.galNew[id]) { delete P.galNew[id]; X.save(); } };
  X.newCount = () => Object.keys(X.P().galNew).filter((id) => { const a = VN.asset(id); return a && a.gallery; }).length;
  X.hearMusic = (id) => { const a = id && VN.asset(id); if (a && a.musicRoom) X.mark('music', id); };

  // ---------- Erfolge ----------
  X.achs = () => (VN.project.achievements = VN.project.achievements || []);
  X.achOn = () => X.achs().length > 0;
  X.onAch = null; // vom Player gesetzt: zeigt die Einblendung
  X.unlockAch = (id) => {
    const a = X.achs().find((x) => x.id === id);
    if (!a || !X.mark('ach', id)) return false;
    if (X.onAch) X.onAch(a);
    return true;
  };
  // Erfolge mit Bedingungen prüfen sich selbst (nach Aktionen und Szenenwechseln)
  X.checkAch = (rs) => {
    if (!X.achOn()) return;
    const P = X.P();
    for (const a of X.achs()) if (!P.ach[a.id] && (a.conds || []).length && VN.checkConds(a.conds, rs)) X.unlockAch(a.id);
  };

  // ---------- Werte (Variablen mit Anzeige) ----------
  X.stats = () => VN.project.vars.filter((v) => v.stat && v.type !== 'flag');
  X.statsOn = () => X.stats().length > 0;

  // ---------- Gegenstände benutzen und kombinieren ----------
  X.combos = () => (VN.project.combos = VN.project.combos || []);
  X.comboFor = (a, b) => X.combos().find((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a));
  // „Benutzen“ im Inventar anbieten? Bei Ausrüstungs-Gegenständen standardmäßig nein (sonst wäre Kleidung nach „Benutzen“ weg)
  X.offersUse = (it) => !!it && (it.use && it.use.offer != null ? it.use.offer !== false : !(it.slot && VN.Equip && VN.Equip.on()));
  X.canUse = (it) => !!(it && it.use && X.offersUse(it) && (it.use.actions || []).length);

  // ---------- Bedingungen ----------
  const itemName = (id) => { const it = VN.project.items.find((x) => x.id === id); return it ? it.name : '?'; };
  VN.registerCond('know', {
    label: '🧠 Wissen (über Durchläufe)',
    make: () => ({ key: '', value: true }),
    check: (c) => !!X.P().know[c.key] === (c.value !== false),
    text: (c) => (c.value === false ? 'weiß noch nicht: ' : 'weiß schon: ') + (c.key || '?'),
    problem: (c) => (String(c.key || '').trim() ? null : 'Wissen ohne Namen'),
    row(row, c, sel, inp) {
      row.appendChild(inp(c.key || '', (v) => VN.mutate(() => { c.key = String(v).trim(); }), 'text', { width: '150px' }));
      row.appendChild(sel(String(c.value !== false), [['true', 'ist bekannt'], ['false', 'ist neu']], (v) => VN.mutate(() => { c.value = v === 'true'; })));
    }
  });
  VN.registerCond('seenEver', {
    label: '🧠 Szene je gesehen (irgendein Durchlauf)',
    make: () => ({ scene: '' }),
    check: (c, rs) => !!(X.P().seen[c.scene] || (rs.seen && rs.seen[c.scene])),
    text: (c) => { const s = VN.scene(c.scene); return 'je gesehen: ' + (s ? s.name : '?'); },
    problem: (c) => (VN.scene(c.scene) ? null : 'Szene fehlt'),
    row(row, c, sel) { row.appendChild(sel(c.scene || '', [['', '— Szene —'], ...VN.project.scenes.map((s) => [s.id, s.name])], (v) => VN.mutate(() => { c.scene = v; }))); }
  });
  VN.registerCond('ach', {
    label: '🏆 Erfolg freigeschaltet',
    on: () => X.achOn(),
    make: () => ({ ach: (X.achs()[0] || {}).id || '' }),
    check: (c) => !!X.P().ach[c.ach],
    text: (c) => { const a = X.achs().find((x) => x.id === c.ach); return 'Erfolg: ' + (a ? a.name : '?'); },
    problem: (c) => (X.achs().some((x) => x.id === c.ach) ? null : 'Erfolg fehlt'),
    row(row, c, sel) { row.appendChild(sel(c.ach || '', [['', '— Erfolg —'], ...X.achs().map((a) => [a.id, a.name])], (v) => VN.mutate(() => { c.ach = v; }))); }
  });

  // ---------- Aktionen ----------
  VN.registerAction('know', {
    label: '🧠 Wissen merken (über Durchläufe)',
    make: () => ({ key: '', value: true }),
    apply: (a) => { const P = X.P(); if (a.value === false) delete P.know[a.key]; else P.know[a.key] = Date.now(); X.save(); },
    text: (a) => (a.value === false ? 'vergessen: ' : 'merken: ') + (a.key || '?'),
    problem: (a) => (String(a.key || '').trim() ? null : 'Wissen ohne Namen'),
    row(row, a, sel, inp) {
      row.appendChild(inp(a.key || '', (v) => VN.mutate(() => { a.key = String(v).trim(); }), 'text', { width: '150px' }));
      row.appendChild(sel(String(a.value !== false), [['true', 'merken'], ['false', 'vergessen']], (v) => VN.mutate(() => { a.value = v === 'true'; })));
    }
  });
  VN.registerAction('ach', {
    label: '🏆 Erfolg freischalten',
    on: () => X.achOn(),
    make: () => ({ ach: (X.achs()[0] || {}).id || '' }),
    apply: (a) => { X.unlockAch(a.ach); },
    text: (a) => { const x = X.achs().find((y) => y.id === a.ach); return '🏆 ' + (x ? x.name : '?'); },
    row(row, a, sel) { row.appendChild(sel(a.ach || '', [['', '— Erfolg —'], ...X.achs().map((x) => [x.id, x.name])], (v) => VN.mutate(() => { a.ach = v; }))); }
  });
  VN.registerAction('screen', {
    label: '📋 Bildschirm öffnen',
    make: () => ({ screen: 'stats' }),
    apply: (a, rs, gains) => { if (window.Player && Player.openScreen) gains.pending.push(Player.openScreen(a.screen)); },
    text: (a) => 'Öffnen: ' + ({ stats: 'Werte', gallery: 'Galerie', ach: 'Erfolge', log: 'Verlauf', inv: 'Inventar' }[a.screen] || a.screen),
    row(row, a, sel) { row.appendChild(sel(a.screen || 'stats', [['stats', 'Werte'], ['gallery', 'Galerie'], ['ach', 'Erfolge'], ['log', 'Verlauf'], ['inv', 'Inventar']], (v) => VN.mutate(() => { a.screen = v; }))); }
  });
  VN.registerAction('nameInput', {
    label: '✏ Namen eingeben lassen',
    make: () => ({ var: '', prompt: 'Wie heißt du?', def: '' }),
    apply: (a, rs, gains) => { if (window.Player && Player.askName) gains.pending.push(Player.askName(a)); },
    text: (a) => 'Name eingeben → {' + (a.var || '?') + '}',
    problem: (a) => (String(a.var || '').trim() ? null : 'Platzhalter-Name fehlt'),
    row(row, a, sel, inp) {
      row.appendChild(el('span', { class: 'muted small' }, 'Platzhalter'));
      row.appendChild(inp(a.var || '', (v) => VN.mutate(() => { a.var = String(v).trim().replace(/[{}\s]/g, ''); }), 'text', { width: '90px' }));
      row.appendChild(inp(a.prompt || '', (v) => VN.mutate(() => { a.prompt = v; }), 'text', { width: '150px' }));
    }
  });

  // ---------- Platzhalter im Text: {name} aus „Namen eingeben“, {Wert} aus Variablen ----------
  X.fill = (text, rs) => {
    if (!text || text.indexOf('{') < 0 || !rs) return text;
    return text.replace(/\{([A-Za-zÄÖÜäöüß0-9_ .-]{1,40})\}/g, (m, k) => {
      if (rs.names && rs.names[k] != null) return rs.names[k];
      const v = VN.project.vars.find((x) => x.name === k || x.id === k);
      if (v) return v.type === 'flag' ? (rs.vars[v.id] ? 'an' : 'aus') : String(rs.vars[v.id] != null ? rs.vars[v.id] : v.start || 0);
      if (window.VNPlugin && VNPlugin.placeholder) { const r = VNPlugin.placeholder(k, rs); if (r != null) return String(r); }
      return m;
    });
  };

  // ---------- Texte fürs Transkript ----------
  const base = VN.collectTexts;
  VN.collectTexts = () => {
    const out = base();
    for (const a of X.achs()) {
      out.push({ id: a.id + ':name', area: 'Erfolge', where: 'Name', who: 'Erfolg', text: a.name || '', set: (v) => { a.name = v; } });
      if (a.desc) out.push({ id: a.id + ':desc', area: 'Erfolge', where: a.name, who: 'Beschreibung', text: a.desc, set: (v) => { a.desc = v; } });
    }
    for (const c of X.combos()) if (c.text) out.push({ id: c.id + ':text', area: 'Gegenstände', where: 'Kombination', who: 'Meldung', text: c.text, set: (v) => { c.text = v; } });
    for (const it of VN.project.items) if (it.use && it.use.text) out.push({ id: it.id + ':use', area: 'Gegenstände', where: it.name, who: 'Benutzen', text: it.use.text, set: (v) => { it.use.text = v; } });
    return out;
  };
})();
