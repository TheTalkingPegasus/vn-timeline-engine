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
  // Aktion „🖼 Bild erhalten“ (0.9.41): ohne Figur und ohne Chat – landet in der Galerie, wahlweise groß gezeigt
  VN.registerAction('getPic', {
    label: '🖼 Bild erhalten (Galerie)', make: () => ({ image: '', show: 'note' }),
    apply: (a, rs, gains) => {
      const as = a.image && VN.asset(a.image);
      if (!as) return;
      as.gallery = true;
      X.unlockNew(a.image);
      if (VN.Idle && VN.Idle._sim) return;
      if (a.show !== 'quiet' && gains) gains.push({ kind: 'pic', id: a.image });
      const D = window.UiDesign ? UiDesign.resolve('getpic') : {};
      if (a.show !== 'quiet' && D.sndA && window.RelMsg && RelMsg.play) RelMsg.play(D.sndA);
      if (a.show === 'big' && gains && gains.pending) gains.pending.push(() => new Promise((res) => {
        const host = document.querySelector('#player .pl-stage');
        if (!host) { res(); return; }
        const cap = a.noCaption ? '' : a.caption ? VN.tr((a.id || a.image) + ':cap', a.caption) : VN.tp('Neues Bild in der Galerie');
        const v = X.getPicView(a.image, cap, a.hint ? VN.tr((a.id || a.image) + ':hint', a.hint) : '');
        v.back.addEventListener('click', (e) => { e.stopPropagation(); v.back.remove(); res(); });
        host.appendChild(v.back);
        if (window.UiDesign) UiDesign.apply('getpic', v.panel, v.back);
      }));
    },
    text: (a) => { const as = a.image && VN.asset(a.image); return '🖼 ' + (as ? '„' + as.name + '“' : '?') + ' ' + VN.t('in die Galerie') + (a.show === 'big' ? ' (' + VN.t('groß zeigen') + ')' : ''); },
    problem: (a) => (a.image && VN.asset(a.image) ? null : 'Bild fehlt'),
    row: (row, a, sel) => {
      row.appendChild(VN.assetSelect('image', a.image, (v) => VN.mutate(() => { a.image = v; const im = v && VN.asset(v); if (im) im.gallery = true; })));
      row.appendChild(sel(a.show || 'note', [['note', 'kurz einblenden'], ['big', 'groß zeigen (Klick schließt)'], ['quiet', 'still (nur Galerie)']], (v) => VN.mutate(() => { a.show = v; })));
      if (a.show === 'big') {
        if (!a.id) a.id = VN.uid('gp');
        row.appendChild(VN.el('input', { type: 'text', value: a.caption || '', disabled: !!a.noCaption, placeholder: VN.t('Neues Bild in der Galerie'), title: VN.t('Text unter dem Bild'), style: { flex: '1', minWidth: '140px' }, onchange: (e) => VN.mutate(() => { a.caption = e.target.value; }) }));
        row.appendChild(VN.el('input', { type: 'text', value: a.hint || '', placeholder: VN.t('kleiner Text, z. B. „Klicken zum Schließen“'), style: { flex: '1', minWidth: '140px' }, onchange: (e) => VN.mutate(() => { a.hint = e.target.value; }) }));
        row.appendChild(VN.el('label', { class: 'check' }, VN.el('input', { type: 'checkbox', checked: !!a.noCaption, onchange: (e) => VN.mutate(() => { a.noCaption = e.target.checked; }) }), VN.t('ohne Text')));
        row.appendChild(VN.el('button', { class: 'btn tiny', title: VN.t('Rahmen, Farben, Schrift, Hintergrund, Ton'), onclick: () => window.UiDesign && UiDesign.edit('getpic') }, '🎨'));
      }
    }
  });
  // Großansicht „Bild erhalten“: Fläche dahinter + Fenster (Rahmen, Farben, Schrift über 🎨 „Bild erhalten“)
  X.getPicView = (img, caption, hint) => {
    const panel = VN.el('div', { class: 'sys-panel gp-panel' },
      VN.el('img', { class: 'gp-img', src: VN.assetUrl(img) || '', draggable: 'false' }),
      caption ? VN.el('div', { class: 'gp-cap' }, caption) : null,
      hint ? VN.el('div', { class: 'gp-hint' }, hint) : null);
    const back = VN.el('div', { class: 'pl-overlay pl-getpic' }, panel);
    return { back, panel };
  };
  X.galleryImages = () => VN.project.assets.filter((a) => a.kind === 'image' && a.gallery);
  X.galleryMusic = () => VN.project.assets.filter((a) => a.kind === 'audio' && a.musicRoom);
  X.replayScenes = () => VN.project.scenes.filter((s) => s.replay);
  X.galleryOn = () => !!(X.galleryImages().length || X.galleryMusic().length || X.replayScenes().length);
  // Figuren eines Galeriebilds (0.7.4: mehrere möglich; galleryChar bleibt als erste Figur erhalten)
  X.galChars = (a) => (a && Array.isArray(a.galleryChars) && a.galleryChars.length ? a.galleryChars : a && a.galleryChar ? [a.galleryChar] : []);
  X.setGalChars = (a, ids) => { const list = [...new Set(ids.filter(Boolean))]; if (list.length) { a.galleryChars = list; a.galleryChar = list[0]; } else { delete a.galleryChars; delete a.galleryChar; } };
  X.addGalChar = (a, id) => { if (a && id && !X.galChars(a).includes(id)) X.setGalChars(a, [...X.galChars(a), id]); };
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
    // Bild-Geschenke (Aktion „📷 Figur schickt ein Bild“), überall im Projekt
    const seen = new Set();
    const walk = (o, d) => { if (!o || typeof o !== 'object' || d > 16) return; if (Array.isArray(o)) { for (const x of o) walk(x, d + 1); return; } if (o.type === 'getPic' && o.id && !seen.has(o.id)) { seen.add(o.id); const nm = (VN.asset(o.image) || {}).name || ''; if (o.caption) out.push({ id: o.id + ':cap', area: 'Bilder erhalten', where: nm, who: 'Text', text: o.caption, set: (v) => { o.caption = v; } }); if (o.hint) out.push({ id: o.id + ':hint', area: 'Bilder erhalten', where: nm, who: 'Hinweis', text: o.hint, set: (v) => { o.hint = v; } }); } if (o.type === 'charPic' && o.id && !seen.has(o.id)) { seen.add(o.id); if (o.text) out.push({ id: o.id + ':text', area: 'Bild-Geschenke', where: (VN.Life && VN.Life.relChar(o.char) || {}).name || '', who: 'Nachricht', text: o.text, set: (v) => { o.text = v; } }); if (o.notify) out.push({ id: o.id + ':note', area: 'Bild-Geschenke', where: (VN.Life && VN.Life.relChar(o.char) || {}).name || '', who: 'Meldung', text: o.notify, set: (v) => { o.notify = v; } }); } for (const k in o) if (o[k] && typeof o[k] === 'object') walk(o[k], d + 1); };
    walk(VN.project.scenes, 0); walk(VN.project.relations, 0); walk(VN.project.idle, 0); walk(VN.project.quests, 0); walk(VN.project.world, 0); walk(VN.project.items, 0);
    return out;
  };
})();
