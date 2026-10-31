// „Spieler hat … getan“: merkt sich, was der Spieler im Spiel gemacht hat
// (Inventar oder andere Bildschirme geöffnet, Namen eingetragen, Ort besucht, Gegenstand benutzt/ausgerüstet,
// Geschenk gegeben). Als Bedingung überall nutzbar – auch für Quests und „Weiter erst, wenn …“.
(function () {
  const Did = (VN.Did = {});

  // Eintragen: VN.did(rs, 'screen', 'inv')
  VN.did = (rs, what, key) => {
    if (!rs) return;
    rs.did = rs.did || {};
    rs.did[what + ':' + (key || '')] = (rs.did[what + ':' + (key || '')] || 0) + 1;
    rs.did[what + ':*'] = (rs.did[what + ':*'] || 0) + 1;
    if (Did.onChange) try { Did.onChange(rs, what, key); } catch (e) { /* egal */ }
  };
  Did.has = (rs, what, key) => {
    if (!rs) return false;
    if (what === 'visit') return key ? !!(rs.seen && rs.seen[key]) : false;
    if (what === 'equip' && key && VN.Equip && VN.Equip.on()) return VN.Equip.worn(rs, key) || !!(rs.did && rs.did['equip:' + key]);
    return !!(rs.did && rs.did[what + ':' + (key || '*')]);
  };

  // Was es gibt und welche Auswahl dazu passt
  const P = () => VN.project;
  Did.SCREENS = () => {
    const p = P(), out = [['inv', 'Inventar']];
    if (p.world && p.world.enabled) out.push(['map', 'Karte']);
    if (p.quests && p.quests.enabled) out.push(['quests', 'Questlog']);
    if (p.relations && p.relations.enabled) out.push(['rel', 'Beziehungen']);
    if (p.skills && p.skills.enabled) out.push(['skills', 'Skilltree']);
    if (p.idle && p.idle.enabled) out.push(['idle', (p.idle.title || 'Aufbau')]);
    if (p.combat && p.combat.enabled) out.push(['party', 'Gruppe']);
    if (p.gallery && p.gallery.enabled) out.push(['gallery', 'Galerie']);
    out.push(['ach', 'Erfolge'], ['stats', 'Werte'], ['log', 'Verlauf']);
    return out;
  };
  const nameVars = () => {
    const set = new Set();
    const walk = (o, d) => { if (!o || typeof o !== 'object' || d > 14) return; if (Array.isArray(o)) { for (const x of o) walk(x, d + 1); return; } if (o.type === 'nameInput' && o.var) set.add(String(o.var)); for (const k in o) if (o[k] && typeof o[k] === 'object') walk(o[k], d + 1); };
    walk(P().scenes, 0);
    return [...set];
  };
  Did.KINDS = () => {
    const p = P(), out = [['screen', 'Bildschirm geöffnet'], ['name', 'Namen eingetragen'], ['visit', 'Szene / Ort besucht'], ['use', 'Gegenstand benutzt']];
    if (VN.Equip && VN.Equip.on()) out.push(['equip', 'Gegenstand ausgerüstet']);
    if (p.relations && p.relations.enabled && p.relations.gifts) out.push(['gift', 'Geschenk gegeben']);
    return out;
  };
  Did.keys = (what) => {
    const p = P();
    if (what === 'screen') return Did.SCREENS();
    if (what === 'name') return [['', '— irgendeinen —'], ...nameVars().map((k) => [k, '{' + k + '}'])];
    if (what === 'visit') return [['', '— Szene —'], ...p.scenes.map((s) => [s.id, (s.type === 'hub' ? '⌂ ' : '') + s.name])];
    if (what === 'use') return [['', '— irgendeinen —'], ...p.items.map((it) => [it.id, it.name])];
    if (what === 'equip') return [['', '— irgendeinen —'], ...p.items.filter((it) => it.slot).map((it) => [it.id, it.name])];
    if (what === 'gift') return [['', '— an irgendwen —'], ...p.relations.chars.map((c) => [c.id, c.name])];
    return [];
  };
  const label = (what, key) => {
    const k = Did.keys(what).find((x) => x[0] === (key || ''));
    const kind = (Did.KINDS().find((x) => x[0] === what) || [, what])[1];
    return kind + (key && k ? ': ' + k[1] : '');
  };

  VN.registerCond('did', {
    label: '✔ Spieler hat … getan',
    make: () => ({ what: 'screen', key: 'inv' }),
    check: (c, rs) => Did.has(rs, c.what || 'screen', c.key || ''),
    text: (c) => '✔ ' + label(c.what || 'screen', c.key || ''),
    problem: (c) => {
      const what = c.what || 'screen';
      if (what === 'visit' && !VN.scene(c.key)) return 'Szene fehlt';
      if (c.key && (what === 'use' || what === 'equip') && !P().items.some((x) => x.id === c.key)) return 'Gegenstand fehlt';
      if (c.key && what === 'gift' && !(P().relations.chars || []).some((x) => x.id === c.key)) return 'Figur fehlt';
      return null;
    },
    row: (row, c, sel) => {
      row.appendChild(sel(c.what || 'screen', Did.KINDS(), (v) => VN.mutate(() => { c.what = v; c.key = v === 'screen' ? 'inv' : ''; })));
      row.appendChild(sel(c.key || '', Did.keys(c.what || 'screen'), (v) => VN.mutate(() => { c.key = v; })));
    }
  });
})();
