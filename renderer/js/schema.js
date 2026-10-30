// Projekt-Format: Versionsnummer, schrittweise Umwandlung alter Projekte und Prüfung auf kaputte Daten.
// Jedes Projekt trägt "schema" (Format-Version) und "engine" (Engine-Version beim letzten Speichern).
// Neue Formatänderungen bekommen einen Schritt in STEPS – nie alte Schritte ändern.
(function () {
  const S = (VN.Schema = {});
  S.ENGINE = '0.7.0';
  S.CURRENT = 1;

  // Schritt n wandelt ein Projekt von Format n-1 nach n um.
  // Format 0 = alles vor 0.6.7 (ohne Versionsnummer). Die bisherige Ergänzung fehlender Felder
  // (VN.migrate) läuft weiterhin bei jedem Laden und gilt für jedes Format.
  const STEPS = [
    {
      to: 1,
      text: 'Projekt-Format mit Versionsnummer (0.6.7)',
      run(p) {
        // Doppelte IDs aus alten Versionen auflösen (konnten durch Kopieren entstehen)
        const seen = new Set();
        const uid = (pre) => { p.counter = (Number(p.counter) || 0) + 1; return pre + '_' + p.counter.toString(36) + Math.random().toString(36).slice(2, 5); };
        const fresh = (o, pre) => { if (!o || typeof o !== 'object') return; if (o.id && seen.has(o.id)) o.id = uid(pre); if (o.id) seen.add(o.id); };
        for (const s of p.scenes || []) {
          if (s.type === 'story') for (const k of Object.keys(s.tracks || {})) for (const c of s.tracks[k] || []) fresh(c, 'c');
          else for (const o of s.objects || []) fresh(o, 'o');
        }
        // Zähler, der neue IDs erzeugt, darf nie zurücklaufen
        p.counter = Math.max(Number(p.counter) || 0, seen.size);
      }
    }
  ];
  S.STEPS = STEPS;

  // Letzte Umwandlung (für Hinweis und Sicherungskopie)
  S.last = null;

  const baseMig = VN.migrate;
  VN.migrate = (p) => {
    if (!p || typeof p !== 'object') return p;
    const from = Number(p.schema) || 0;
    if (from < S.CURRENT) {
      const done = [];
      for (const st of STEPS) if (st.to > from && st.to <= S.CURRENT) { st.run(p); done.push(st.text); }
      p.schema = S.CURRENT;
      S.last = { from, to: S.CURRENT, steps: done, engine: p.engine || '' };
    }
    return baseMig(p);
  };

  // Vor dem Laden: Ist das Projekt aus einer neueren Engine?
  S.tooNew = (p) => (Number(p && p.schema) || 0) > S.CURRENT;
  S.stamp = (p) => { p.schema = Math.max(Number(p.schema) || 0, S.CURRENT); p.engine = S.ENGINE; return p; };

  // ---------- Prüfung: Was ist kaputt? (für Testreihe und Editor) ----------
  // Liefert eine Liste { level: 'error'|'warn', where, text }. Ändert nichts.
  S.check = (p) => {
    const out = [];
    const err = (where, text) => out.push({ level: 'error', where, text });
    const warn = (where, text) => out.push({ level: 'warn', where, text });
    if (!p || !Array.isArray(p.scenes)) { err('Projekt', 'Keine Szenenliste'); return out; }
    const sceneIds = new Set();
    const ids = new Map();
    const dupe = (id, where) => { if (!id) return; if (ids.has(id)) err(where, 'Doppelte ID ' + id + ' (auch in ' + ids.get(id) + ')'); else ids.set(id, where); };
    for (const s of p.scenes) {
      if (!s || !s.id) { err('Szene', 'Szene ohne ID'); continue; }
      if (sceneIds.has(s.id)) err(s.name || s.id, 'Doppelte Szenen-ID ' + s.id);
      sceneIds.add(s.id);
    }
    const assetIds = new Set((p.assets || []).map((a) => a.id));
    const okScene = (id) => !id || id === '@return' || id === '@home' || sceneIds.has(id);
    if (p.startScene && !sceneIds.has(p.startScene)) err('Projekt', 'Startszene fehlt: ' + p.startScene);
    for (const s of p.scenes) {
      const where = s.name || s.id;
      if (s.type === 'story') {
        if (!s.tracks || typeof s.tracks !== 'object') { err(where, 'Spuren fehlen'); continue; }
        if (!(s.beats >= 1)) err(where, 'Ungültige Schrittzahl');
        if (!okScene(s.next)) err(where, '„Danach weiter zu“ zeigt auf eine fehlende Szene');
        for (const [k, list] of Object.entries(s.tracks)) {
          if (!Array.isArray(list)) { err(where, 'Spur ' + k + ' ist keine Liste'); continue; }
          for (const c of list) {
            dupe(c.id, where);
            if (!(c.start >= 0) || !(c.len >= 1)) err(where, 'Clip ' + c.id + ' hat ungültige Position');
            if (c.asset && !assetIds.has(c.asset)) warn(where, 'Clip verweist auf fehlende Datei ' + c.asset);
            for (const o of c.options || []) if (!okScene(o.target)) err(where, 'Antwort „' + (o.text || '') + '“ zeigt auf fehlende Szene');
          }
        }
      } else if (s.type === 'hub') {
        for (const o of s.objects || []) {
          dupe(o.id, where);
          if (!okScene(o.target)) err(where, 'Objekt „' + (o.name || o.id) + '“ zeigt auf fehlende Szene');
        }
        if (s.bg && !assetIds.has(s.bg)) warn(where, 'Hintergrund fehlt: ' + s.bg);
      } else err(where, 'Unbekannte Szenenart ' + s.type);
    }
    // Kaputte Bedingungen (gelöschte Variable, Szene …) meldet die Engine schon selbst
    if (VN.condProblem) {
      const walk = (o, where) => {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) { for (const x of o) walk(x, where); return; }
        if (Array.isArray(o.conds)) for (const c of o.conds) { let pr = null; try { pr = VN.condProblem(c); } catch (e) { pr = 'Fehler beim Prüfen'; } if (pr) warn(where, 'Bedingung: ' + pr); }
        for (const k in o) if (k !== 'conds' && o[k] && typeof o[k] === 'object') walk(o[k], where);
      };
      for (const s of p.scenes) walk(s, s.name || s.id);
    }
    return out;
  };
})();
