// Datenmodell-Erweiterungen: Variablen, Wenn-Dann-Logik, Loot, Stile, Übersetzungen
(function () {
  const { el } = VN;

  // Effekt-Spur (Overlay mit Mischmodus) nach den Figuren einfügen
  VN.TRACKS.splice(3, 0, { key: 'fx', label: 'Effekt-Ebene', kind: 'overlay', color: '#e88aa6', fg: '#2a0f18' },
    { key: 'cam', label: 'Kamera', kind: 'camera', color: '#8fc3f0', fg: '#0b1a28' },
    { key: 'video', label: 'Video', kind: 'video', color: '#d08ad8', fg: '#22102a' });

  VN.BLENDS = [
    ['normal', 'Normal'],
    ['multiply', 'Multiplizieren'], ['darken', 'Abdunkeln'], ['color-burn', 'Farbig nachbelichten'],
    ['plus-lighter', 'Addieren'], ['screen', 'Negativ multiplizieren'], ['lighten', 'Aufhellen'], ['color-dodge', 'Farbig abwedeln'],
    ['overlay', 'Überlagern'], ['soft-light', 'Weiches Licht'], ['hard-light', 'Hartes Licht'],
    ['difference', 'Differenz'], ['exclusion', 'Ausschluss'],
    ['hue', 'Farbton'], ['saturation', 'Sättigung'], ['color', 'Farbe'], ['luminosity', 'Luminanz']
  ];

  // ---------- Migration älterer Projekte ----------
  VN.migrate = (p) => {
    p.vars = p.vars || [];
    p.items = p.items || [];
    p.currencies = p.currencies || [];
    p.lootTables = p.lootTables || [];
    p.inventory = Object.assign({ title: VN.t('Inventar'), cols: 6, rows: 4, bg: null, slot: null, showMoney: true, hudMoney: true, enabled: true }, p.inventory || {});
    p.languages = p.languages && p.languages.length ? p.languages : ['de'];
    p.translations = p.translations || {};
    p.rigs = p.rigs || {};
    p.blinks = p.blinks || {};
    p.plugins = p.plugins || {};
    if (!p.mainMenu && VN.defaultMenu) p.mainMenu = VN.defaultMenu(p.title);
    if (window.Theme) Theme.ensure(p);
    p.resolution = p.resolution && p.resolution.w ? p.resolution : { w: 1920, h: 1080 };
    p.figures = p.figures || [];
    p.anims = p.anims || [];
    p.poses = p.poses || [];
    p.mouths = p.mouths || {};
    p.glossary = p.glossary || [];
    p.chat = p.chat || { me: '' };
    p.audioMix = Object.assign({ on: true, duck: 45 }, p.audioMix || {});
    for (const s of p.scenes) {
      if (s.type === 'story') {
        VN.ensureTracks(s);
        for (const c of s.tracks.choice) for (const o of c.options) {
          o.id = o.id || VN.uid('opt');
          o.conds = o.conds || [];
          o.actions = o.actions || [];
        }
        for (const d of s.tracks.dialog) d.actions = d.actions || [];
      } else {
        s.events = s.events || [];
        for (const o of s.objects) { o.conds = o.conds || []; o.actions = o.actions || []; }
        for (const ev of s.events) for (const l of ev.lines) l.id = l.id || VN.uid('ln');
      }
    }
    return p;
  };

  // ---------- Laufzeit-Zustand eines Spiels ----------
  VN.newRunState = () => {
    const p = VN.project;
    const vars = {};
    for (const v of p.vars) vars[v.id] = v.type === 'flag' ? !!v.start : Number(v.start) || 0;
    const money = {};
    for (const c of p.currencies) money[c.id] = Number(c.start) || 0;
    return { vars, money, inv: {}, opened: {}, seen: {}, seed: Math.floor(Math.random() * 1e9) };
  };

  // ---------- Bedingungen ----------
  const OPS = { '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '==': (a, b) => a == b, '!=': (a, b) => a != b, '>': (a, b) => a > b, '<': (a, b) => a < b };
  VN.OPS = Object.keys(OPS);
  // ---------- Erweiterbare Bedingungen und Aktionen (Engine-Systeme und Plugins) ----------
  // def: { label, on?(): bool, check(c, rs), text(c), row(row, c, sel, inp), problem?(c), make?(): {...} }
  VN.ext = { conds: {}, actions: {} };
  VN.registerCond = (type, def) => { VN.ext.conds[type] = def; };
  // def: { label, on?(): bool, apply(a, rs, gains, sourceKey), text(a), row(row, a, sel, inp), problem?(a), make?(): {...} }
  VN.registerAction = (type, def) => { VN.ext.actions[type] = def; };
  const extOn = (d) => { try { return !d.on || d.on(); } catch (e) { return false; } };
  VN.extCondTypes = (cur) => Object.entries(VN.ext.conds).filter(([k, d]) => extOn(d) || k === cur).map(([k, d]) => [k, d.label || k]);
  VN.extActionTypes = (cur) => Object.entries(VN.ext.actions).filter(([k, d]) => extOn(d) || k === cur).map(([k, d]) => [k, d.label || k]);

  // Was an einer Bedingung kaputt ist (gelöschte Variable, Gegenstand, Szene, Figur …) – sonst null.
  // Kaputte Bedingungen gelten im Spiel als NICHT erfüllt, damit gesperrte Inhalte nie versehentlich aufgehen.
  VN.condProblem = (c) => {
    const p = VN.project;
    if (!c || !c.type) return 'Leere Bedingung';
    // Vergleich muss einer der bekannten sein (beschädigte Daten oder fehlerhafte Plugins)
    if (c.op != null && c.op !== '' && !OPS[c.op] && ['var', 'item', 'money', 'time', 'rel'].includes(c.type)) return 'Ungültiger Vergleich „' + c.op + '“';
    if (c.type === 'var') return p.vars.some((x) => x.id === c.var) ? null : 'Variable fehlt';
    if (c.type === 'item') return p.items.some((x) => x.id === c.item) ? null : 'Gegenstand fehlt';
    if (c.type === 'money') return (p.currencies || []).some((x) => x.id === c.currency) ? null : 'Währung fehlt';
    if (c.type === 'seen') return VN.scene(c.scene) ? null : 'Szene fehlt';
    if (c.type === 'time') return null;
    if (c.type === 'rel') return VN.Life && VN.Life.relChar(c.char) ? null : 'Figur für ♥ fehlt';
    const x = VN.ext.conds[c.type];
    if (x) { try { return x.problem ? x.problem(c) || null : null; } catch (e) { return 'Fehler in der Bedingung'; } }
    return 'Unbekannte Bedingung „' + c.type + '“';
  };
  VN.checkCond = (c, rs) => {
    if (VN.condProblem(c)) return false;
    if (c.type === 'var') {
      const v = VN.project.vars.find((x) => x.id === c.var);
      const cur = rs.vars[c.var];
      if (v.type === 'flag') return !!cur === (c.value === true || c.value === 'true' || c.value === 1);
      return OPS[c.op || '>='](Number(cur), Number(c.value));
    }
    if (c.type === 'item') return OPS[c.op || '>='](rs.inv[c.item] || 0, Number(c.count != null ? c.count : 1));
    if (c.type === 'money') return OPS[c.op || '>='](rs.money[c.currency] || 0, Number(c.amount) || 0);
    if (c.type === 'seen') return !!rs.seen[c.scene] === (c.value !== false);
    if (VN.Life) { const r = VN.Life.checkCond(c, rs); if (r != null) return r; }
    const x = VN.ext.conds[c.type];
    if (x) { try { return !!x.check(c, rs); } catch (e) { console.error('Bedingung ' + c.type, e); return false; } }
    return false;
  };
  // Alle kaputten Bedingungen im Projekt: [{ scene, text }]
  VN.condIssues = () => {
    const out = [];
    const walk = (o, scene, depth) => {
      if (!o || typeof o !== 'object' || depth > 12) return;
      if (Array.isArray(o)) { for (const x of o) walk(x, scene, depth + 1); return; }
      if (Array.isArray(o.conds)) for (const c of o.conds) { const pr = VN.condProblem(c); if (pr) out.push({ scene, where: o.text || o.label || o.name || '', text: pr }); }
      for (const k in o) if (k !== 'conds' && o[k] && typeof o[k] === 'object') walk(o[k], scene, depth + 1);
    };
    for (const s of VN.project.scenes) walk(s, s, 0);
    const rest = Object.assign({}, VN.project); delete rest.scenes;
    walk(rest, null, 0);
    return out;
  };
  VN.checkConds = (list, rs) => (list || []).every((c) => VN.checkCond(c, rs));

  VN.condText = (c) => {
    const p = VN.project;
    if (c.type === 'var') {
      const v = p.vars.find((x) => x.id === c.var);
      if (!v) return 'Variable fehlt';
      return v.type === 'flag' ? v.name + ' ist ' + (c.value === true || c.value === 'true' ? 'an' : 'aus') : v.name + ' ' + (c.op || '>=') + ' ' + c.value;
    }
    if (c.type === 'item') { const it = p.items.find((x) => x.id === c.item); return 'Gegenstand ' + (it ? it.name : '?') + ' ' + (c.op || '>=') + ' ' + (c.count != null ? c.count : 1); }
    if (c.type === 'money') { const cu = p.currencies.find((x) => x.id === c.currency); return (cu ? cu.name : 'Geld') + ' ' + (c.op || '>=') + ' ' + c.amount; }
    if (c.type === 'seen') { const s = VN.scene(c.scene); return 'Szene ' + (s ? s.name : '?') + (c.value === false ? ' nicht' : '') + ' gesehen'; }
    if (VN.Life) { const t = VN.Life.condText(c); if (t != null) return t; }
    const x = VN.ext.conds[c.type];
    if (x && x.text) { try { return x.text(c); } catch (e) { return x.label || c.type; } }
    return '?';
  };

  // ---------- Kapitel (Ordner für Szenen) und Suche ----------
  VN.chapters = () => {
    const p = VN.project;
    const out = (p.chapters || []).slice();
    for (const s of p.scenes) if (s.chapter && !out.includes(s.chapter)) out.push(s.chapter);
    return out;
  };
  VN.addChapter = (name) => { const l = VN.chapters(); if (!l.includes(name)) l.push(name); VN.project.chapters = l; };
  VN.renameChapter = (from, to) => {
    const p = VN.project;
    p.chapters = Array.from(new Set(VN.chapters().map((c) => (c === from ? to : c))));
    for (const s of p.scenes) if (s.chapter === from) s.chapter = to;
  };
  // Trifft die Suche? true = Name, Text = Fundstelle im Dialog/Objekt, false = nein
  VN.sceneMatch = (s, q) => {
    if (!q) return true;
    if ((s.name || '').toLowerCase().includes(q) || (s.chapter || '').toLowerCase().includes(q)) return true;
    const cut = (t) => { const i = t.toLowerCase().indexOf(q); return '„…' + t.slice(Math.max(0, i - 12), i + q.length + 18) + '…“'; };
    if (s.type === 'story') {
      for (const t of VN.tracksOf(s)) for (const c of s.tracks[t.key] || []) {
        if (c.text && c.text.toLowerCase().includes(q)) return cut(c.text);
        if (c.speaker && c.speaker.toLowerCase().includes(q)) return c.speaker + ': ' + cut(c.text || '');
        for (const o of c.options || []) if ((o.text || '').toLowerCase().includes(q)) return cut(o.text);
      }
    } else {
      for (const o of s.objects || []) for (const t of [o.name, o.message]) if (t && t.toLowerCase().includes(q)) return cut(t);
      for (const ev of s.events || []) for (const l of ev.lines || []) if ((l.text || '').toLowerCase().includes(q)) return cut(l.text);
    }
    return false;
  };

  // ---------- Zufall mit Seed ----------
  const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  VN.rng = (seed) => {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };

  // Würfelt eine Loot-Tabelle. Ergebnis: [{kind:'item'|'money', id, count}]
  VN.rollLoot = (table, sourceKey, rs) => {
    const mode = table.mode || 'seed';
    const seed = mode === 'real' ? Math.floor(Math.random() * 1e9) : mode === 'fixed' ? hash('fixed|' + table.id + '|' + sourceKey) : hash(rs.seed + '|' + table.id + '|' + sourceKey);
    const r = VN.rng(seed);
    const out = [];
    const grant = (e) => {
      const min = Number(e.min) || 1, max = Math.max(min, Number(e.max) || min);
      const count = min + Math.floor(r() * (max - min + 1));
      out.push({ kind: e.kind, id: e.ref, count });
    };
    const eligible = (table.entries || []).filter((e) => VN.checkConds(e.conds, rs));
    for (const e of eligible) if (e.guaranteed) grant(e);
    let draws = 0;
    const maxDraws = table.maxDraws != null ? Number(table.maxDraws) : 99;
    for (const e of eligible) {
      if (e.guaranteed) continue;
      const hit = r() * 100 < (Number(e.chance) || 0);
      if (hit && draws < maxDraws) { grant(e); draws++; }
    }
    return out;
  };

  VN.lootName = (g) => {
    if (g.kind === 'text') return g.text || '';
    if (g.kind === 'money') { const c = VN.project.currencies.find((x) => x.id === g.id); return g.count + ' ' + (c ? VN.tr(c.id + ':name', c.name) : 'Geld'); }
    const it = VN.project.items.find((x) => x.id === g.id);
    return (g.count > 1 ? g.count + '× ' : '') + (it ? VN.tr(it.id + ':name', it.name) : 'Gegenstand');
  };

  // ---------- Aktionen ----------
  VN.ACTION_TYPES = [
    ['addVar', 'Variable ändern (+/−)'], ['setVar', 'Variable setzen'], ['giveItem', 'Gegenstand geben'], ['takeItem', 'Gegenstand nehmen'],
    ['money', 'Geld + / −'], ['loot', 'Loot-Tabelle würfeln']
  ];
  // Führt Aktionen aus, gibt die erhaltenen Dinge für die Fundmeldung zurück
  VN.applyActions = (list, rs, sourceKey) => {
    const gains = [];
    gains.pending = [];
    const p = VN.project;
    for (const a of list || []) {
      const xa = VN.ext.actions[a.type];
      if (xa) { try { xa.apply(a, rs, gains, sourceKey); } catch (e) { console.error('Aktion ' + a.type, e); } continue; }
      if (VN.Life && VN.Life.applyAction(a, rs, gains)) continue;
      if (a.type === 'setVar' && a.var) {
        const v = p.vars.find((x) => x.id === a.var);
        rs.vars[a.var] = v && v.type === 'flag' ? (a.value === true || a.value === 'true') : Number(a.value) || 0;
      } else if (a.type === 'addVar' && a.var) {
        rs.vars[a.var] = (Number(rs.vars[a.var]) || 0) + (Number(a.value) || 0);
      } else if (a.type === 'giveItem' && a.item) {
        VN.giveItem(rs, a.item, Number(a.count) || 1);
        gains.push({ kind: 'item', id: a.item, count: Number(a.count) || 1 });
      } else if (a.type === 'takeItem' && a.item) {
        rs.inv[a.item] = Math.max(0, (rs.inv[a.item] || 0) - (Number(a.count) || 1));
        if (!rs.inv[a.item]) delete rs.inv[a.item];
      } else if (a.type === 'money' && a.currency) {
        VN.addMoney(rs, a.currency, Number(a.amount) || 0);
        if (Number(a.amount) > 0) gains.push({ kind: 'money', id: a.currency, count: Number(a.amount) });
      } else if (a.type === 'plugin' && window.VNPlugin) {
        const def = VNPlugin.actionDef(a.ref);
        if (!def) { console.warn('Plugin-Aktion fehlt: ' + a.ref); continue; }
        try {
          const r = def.run(Object.assign({}, a.params || {}), VNPlugin.makeCtx(rs, def.plugin.id));
          if (r && typeof r.then === 'function') gains.pending.push(r);
        } catch (e) { console.error('Plugin-Aktion ' + a.ref, e); }
      } else if (a.type === 'loot' && a.table) {
        const t = p.lootTables.find((x) => x.id === a.table);
        if (!t) continue;
        const key = (sourceKey || 'quelle') + '|' + t.id;
        if (t.once !== false && rs.opened[key]) { gains.push({ empty: true }); continue; }
        rs.opened[key] = true;
        const got = VN.rollLoot(t, sourceKey || 'quelle', rs);
        for (const g of got) {
          if (g.kind === 'money') VN.addMoney(rs, g.id, g.count); else VN.giveItem(rs, g.id, g.count);
          gains.push(g);
        }
        if (!got.length) gains.push({ empty: true });
      }
    }
    return gains;
  };
  VN.giveItem = (rs, id, n) => {
    const it = VN.project.items.find((x) => x.id === id);
    const cur = rs.inv[id] || 0;
    if (window.VNPlugin && Object.keys(VNPlugin.plugins).length) setTimeout(() => VNPlugin.hook('onItem', id, n, VNPlugin.makeCtx(rs)), 0);
    // Stapelbare Gegenstände haben eine Höchstmenge, andere belegen je einen eigenen Platz
    rs.inv[id] = it && it.stack ? Math.min(Number(it.max) || 99, cur + n) : Math.min(99, cur + n);
  };
  VN.addMoney = (rs, id, n) => {
    const c = VN.project.currencies.find((x) => x.id === id);
    const max = c && c.max ? Number(c.max) : Infinity;
    rs.money[id] = Math.max(0, Math.min(max, (rs.money[id] || 0) + n));
  };
  VN.actionText = (a) => {
    const p = VN.project;
    const vn = (id) => { const v = p.vars.find((x) => x.id === id); return v ? v.name : '?'; };
    const itn = (id) => { const v = p.items.find((x) => x.id === id); return v ? v.name : '?'; };
    if (a.type === 'setVar') return vn(a.var) + ' = ' + a.value;
    if (a.type === 'addVar') return vn(a.var) + (Number(a.value) >= 0 ? ' + ' : ' − ') + Math.abs(Number(a.value) || 0);
    if (a.type === 'giveItem') return '+ ' + (a.count || 1) + '× ' + itn(a.item);
    if (a.type === 'takeItem') return '− ' + (a.count || 1) + '× ' + itn(a.item);
    if (a.type === 'money') { const c = p.currencies.find((x) => x.id === a.currency); return (Number(a.amount) >= 0 ? '+ ' : '− ') + Math.abs(Number(a.amount) || 0) + ' ' + (c ? c.name : 'Geld'); }
    if (a.type === 'loot') { const t = p.lootTables.find((x) => x.id === a.table); return 'Loot: ' + (t ? t.name : '?'); }
    if (a.type === 'plugin') { const d = window.VNPlugin && VNPlugin.actionDef(a.ref); return 'Plugin: ' + (d ? d.label || a.ref : a.ref); }
    if (VN.Life) { const t = VN.Life.actionText(a); if (t != null) return t; }
    const xa = VN.ext.actions[a.type];
    if (xa && xa.text) { try { return xa.text(a); } catch (e) { return xa.label || a.type; } }
    return '?';
  };

  // ---------- Ebenen-Stile ----------
  VN.styleFilter = (st) => {
    if (!st) return '';
    const f = [];
    if (st.outline && st.outline.on) {
      const w = Number(st.outline.width) || 3, c = st.outline.color || '#ffffff';
      for (const [x, y] of [[w, 0], [-w, 0], [0, w], [0, -w], [w * 0.7, w * 0.7], [-w * 0.7, w * 0.7], [w * 0.7, -w * 0.7], [-w * 0.7, -w * 0.7]]) f.push(`drop-shadow(${x.toFixed(1)}px ${y.toFixed(1)}px 0 ${c})`);
    }
    if (st.glow && st.glow.on) f.push(`drop-shadow(0 0 ${Number(st.glow.size) || 16}px ${st.glow.color || '#7fe3e8'})`, `drop-shadow(0 0 ${(Number(st.glow.size) || 16) / 2}px ${st.glow.color || '#7fe3e8'})`);
    if (st.shadow && st.shadow.on) f.push(`drop-shadow(${Number(st.shadow.x) || 8}px ${Number(st.shadow.y) || 10}px ${Number(st.shadow.blur) || 12}px ${st.shadow.color || 'rgba(0,0,0,0.6)'})`);
    if (st.blur && st.blur.on) f.push(`blur(${Number(st.blur.amount) || 3}px)`);
    if (st.adjust && st.adjust.on) f.push(`brightness(${(Number(st.adjust.bright) || 100) / 100}) saturate(${(Number(st.adjust.sat) || 100) / 100}) hue-rotate(${Number(st.adjust.hue) || 0}deg)`);
    return f.join(' ');
  };
  VN.applyLook = (node, obj) => {
    node.style.filter = VN.styleFilter(obj.styles);
    node.style.mixBlendMode = obj.blend && obj.blend !== 'normal' ? obj.blend : '';
    if (obj.opacity != null && obj.opacity !== 100) node.style.opacity = obj.opacity / 100;
  };

  // ---------- Übersetzungen ----------
  VN.lang = null; // aktive Sprache im Player (null = Original)
  VN.tr = (id, text) => {
    const lang = VN.lang;
    if (!lang || lang === VN.project.languages[0]) return text;
    const t = VN.project.translations[lang] && VN.project.translations[lang][id];
    return t && t.text ? t.text : text;
  };
  VN.speakerKey = (name) => 'name:' + (name || '').trim();

  // Alle übersetzbaren Texte sammeln
  VN.collectTexts = () => {
    const p = VN.project;
    const out = [];
    const speakers = new Set();
    for (const s of p.scenes) {
      if (s.type === 'story') {
        const dl = [...s.tracks.dialog].sort((a, b) => a.start - b.start);
        for (const d of dl) {
          out.push({ id: d.id, area: s.name, where: 'Schritt ' + (d.start + 1), who: d.speaker || 'Erzähler', text: d.text || '', set: (v) => { d.text = v; }, sceneId: s.id, beat: d.start });
          if (d.speaker) speakers.add(d.speaker.trim());
        }
        for (const c of s.tracks.choice) for (const o of c.options) out.push({ id: o.id, area: s.name, where: 'Antwort · Schritt ' + (c.start + 1), who: 'Antwort', text: o.text || '', set: (v) => { o.text = v; }, sceneId: s.id, beat: c.start });
      } else {
        for (const o of s.objects) {
          if (o.name) out.push({ id: o.id + ':name', area: s.name, where: 'Objekt', who: 'Tooltip', text: o.name, set: (v) => { o.name = v; }, sceneId: s.id });
          if (o.message) out.push({ id: o.id + ':msg', area: s.name, where: 'Objekt ' + o.name, who: 'Meldung', text: o.message, set: (v) => { o.message = v; }, sceneId: s.id });
        }
        for (const ev of s.events || []) for (const l of ev.lines) {
          out.push({ id: l.id, area: s.name, where: 'Hub-Ereignis ' + ((s.events || []).indexOf(ev) + 1), who: l.speaker || 'Erzähler', text: l.text || '', set: (v) => { l.text = v; }, sceneId: s.id });
          if (l.speaker) speakers.add(l.speaker.trim());
        }
      }
    }
    for (const g of p.glossary || []) {
      out.push({ id: g.id + ':term', area: 'Glossar', where: 'Begriff', who: 'Glossar', text: g.term || '', set: (v) => { g.term = v; } });
      if (g.text) out.push({ id: g.id + ':text', area: 'Glossar', where: g.term, who: 'Erklärung', text: g.text, set: (v) => { g.text = v; } });
    }
    for (const it of p.items) {
      out.push({ id: it.id + ':name', area: 'Gegenstände', where: 'Name', who: 'Item', text: it.name || '', set: (v) => { it.name = v; } });
      if (it.desc) out.push({ id: it.id + ':desc', area: 'Gegenstände', where: it.name, who: 'Beschreibung', text: it.desc, set: (v) => { it.desc = v; } });
    }
    for (const c of (VN.itemCats ? VN.itemCats() : [])) out.push({ id: 'invcat:' + c, area: 'Gegenstände', where: 'Kategorie', who: 'Kategorie', text: c, set: (v) => { v = (v || '').trim(); if (!v || v === c) return; p.inventory.cats = VN.itemCats().map((x) => (x === c ? v : x)); for (const it of p.items) if (it.cat === c) it.cat = v; } });
    for (const c of p.currencies) out.push({ id: c.id + ':name', area: 'Währungen', where: 'Name', who: 'Währung', text: c.name || '', set: (v) => { c.name = v; } });
    out.push({ id: 'ui:inventory', area: 'Menü', where: 'Inventar-Titel', who: 'Menü', text: p.inventory.title || 'Inventar', set: (v) => { p.inventory.title = v; } });
    if (p.mainMenu) {
      out.push({ id: 'menu:title', area: 'Hauptmenü', where: 'Titel', who: 'Menü', text: p.mainMenu.title || '', set: (v) => { p.mainMenu.title = v; } });
      for (const b of p.mainMenu.buttons) out.push({ id: 'menu:' + b.id, area: 'Hauptmenü', where: 'Button', who: 'Menü', text: b.label || '', set: (v) => { b.label = v; } });
    }
    for (const sp of speakers) out.push({ id: VN.speakerKey(sp), area: 'Figurennamen', where: 'Sprecher', who: 'Name', text: sp, set: null });
    return out;
  };

  // ---------- Bausteine für den Inspector: Bedingungen und Aktionen ----------
  const sel = (value, options, onChange, style) => {
    const s = el('select', { onchange: (e) => onChange(e.target.value), style: style || null });
    for (const [v, l] of options) { const o = el('option', { value: v }, l); if (String(v) === String(value)) o.selected = true; s.appendChild(o); }
    return s;
  };
  const inp = (value, onChange, type, style) => el('input', { type: type || 'text', value: value != null ? value : '', onchange: (e) => onChange(e.target.value), style: style || { width: '64px' } });

  VN.condEditor = (list, title) => {
    const p = VN.project;
    const box = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, title || 'Nur wenn'));
    if (!list.length) box.appendChild(el('div', { class: 'muted small' }, 'Keine Bedingung – immer verfügbar.'));
    list.forEach((c, i) => {
      const row = el('div', { class: 'logic-row' });
      row.appendChild(sel(c.type, [['var', 'Variable'], ['item', 'Gegenstand'], ['money', 'Geld'], ['seen', 'Szene gesehen'], ...(VN.Life ? VN.Life.condTypes() : []), ...VN.extCondTypes(c.type)], (v) => VN.mutate(() => { const xd = VN.ext.conds[v]; list[i] = xd && xd.make ? Object.assign({ type: v }, xd.make()) : { type: v, op: v === 'time' ? '==' : '>=', value: v === 'time' ? 0 : 1, count: 1, amount: 1 }; })));
      if (VN.ext.conds[c.type]) { try { VN.ext.conds[c.type].row(row, c, sel, inp); } catch (e) { console.error(e); } }
      else if (VN.Life && VN.Life.condRow(row, c, sel, inp)) { /* Lebenssimulation */ }
      else if (c.type === 'var') {
        row.appendChild(sel(c.var || '', [['', '— wählen —'], ...p.vars.map((v) => [v.id, v.name])], (v) => VN.mutate(() => { c.var = v; })));
        const v = p.vars.find((x) => x.id === c.var);
        if (v && v.type === 'flag') row.appendChild(sel(String(c.value === true || c.value === 'true'), [['true', 'ist an'], ['false', 'ist aus']], (x) => VN.mutate(() => { c.value = x === 'true'; })));
        else { row.appendChild(sel(c.op || '>=', VN.OPS.map((o) => [o, o]), (x) => VN.mutate(() => { c.op = x; }), { width: '58px' })); row.appendChild(inp(c.value, (x) => VN.mutate(() => { c.value = Number(x); }), 'number')); }
      } else if (c.type === 'item') {
        row.appendChild(sel(c.item || '', [['', '— wählen —'], ...p.items.map((v) => [v.id, v.name])], (v) => VN.mutate(() => { c.item = v; })));
        row.appendChild(sel(c.op || '>=', VN.OPS.map((o) => [o, o]), (x) => VN.mutate(() => { c.op = x; }), { width: '58px' }));
        row.appendChild(inp(c.count != null ? c.count : 1, (x) => VN.mutate(() => { c.count = Number(x); }), 'number'));
      } else if (c.type === 'money') {
        row.appendChild(sel(c.currency || '', [['', '— wählen —'], ...p.currencies.map((v) => [v.id, v.name])], (v) => VN.mutate(() => { c.currency = v; })));
        row.appendChild(sel(c.op || '>=', VN.OPS.map((o) => [o, o]), (x) => VN.mutate(() => { c.op = x; }), { width: '58px' }));
        row.appendChild(inp(c.amount, (x) => VN.mutate(() => { c.amount = Number(x); }), 'number'));
      } else if (c.type === 'seen') {
        row.appendChild(sel(c.scene || '', [['', '— wählen —'], ...p.scenes.map((s) => [s.id, s.name])], (v) => VN.mutate(() => { c.scene = v; })));
        row.appendChild(sel(String(c.value !== false), [['true', 'gesehen'], ['false', 'nicht gesehen']], (x) => VN.mutate(() => { c.value = x === 'true'; })));
      }
      row.appendChild(el('button', { class: 'btn tiny danger', title: 'Entfernen', onclick: () => VN.mutate(() => { list.splice(i, 1); }) }, '×'));
      box.appendChild(row);
      const pr = VN.condProblem(c);
      if (pr) box.appendChild(el('div', { class: 'cond-warn' }, '⚠ ' + pr + ' – gilt im Spiel als nicht erfüllt.'));
    });
    box.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { list.push({ type: p.vars.length ? 'var' : p.items.length ? 'item' : 'var', op: '>=', value: 1, count: 1, amount: 1, var: p.vars[0] ? p.vars[0].id : '', item: p.items[0] ? p.items[0].id : '' }); }) }, '+ Bedingung'));
    if (!p.vars.length && !p.items.length && !p.currencies.length) box.appendChild(el('div', { class: 'muted small' }, 'Variablen, Gegenstände und Geld legst du oben unter „Spielsysteme“ an.'));
    return box;
  };

  // Eingabefelder für Plugin-Parameter (Aktionen und Bedingungen)
  VN.paramFields = (row, defs, params, sel, inp) => {
    const p = VN.project;
    for (const pa of defs) {
      const cur = params[pa.key];
      const setP = (v) => VN.mutate(() => { params[pa.key] = pa.type === 'number' ? Number(v) : v; });
      row.appendChild(el('span', { class: 'muted small' }, pa.label || pa.key));
      if (pa.type === 'select') row.appendChild(sel(cur, (typeof pa.options === 'function' ? pa.options() : pa.options || []).map((o) => (Array.isArray(o) ? o : [o, o])), setP));
      else if (pa.type === 'var') row.appendChild(sel(cur || '', [['', '— Variable —'], ...p.vars.map((v) => [v.id, v.name])], setP));
      else if (pa.type === 'item') row.appendChild(sel(cur || '', [['', '— Gegenstand —'], ...p.items.map((v) => [v.id, v.name])], setP));
      else if (pa.type === 'currency') row.appendChild(sel(cur || '', [['', '— Währung —'], ...p.currencies.map((v) => [v.id, v.name])], setP));
      else if (pa.type === 'scene') row.appendChild(sel(cur || '', [['', '— Szene —'], ...p.scenes.map((v) => [v.id, v.name])], setP));
      else if (pa.type === 'image' || pa.type === 'audio') {
        row.appendChild(sel(cur || '', [['', pa.type === 'image' ? '— eingebaut —' : '— Datei —'], ...VN.assetsOf(pa.type).map((v) => [v.id, v.name])], setP));
        if (pa.type === 'image' && cur) row.appendChild(el('span', { class: 'mini-thumb', style: { width: '26px', height: '26px', backgroundImage: `url("${VN.assetUrl(cur)}")` } }));
      } else if (pa.type === 'check') row.appendChild(el('input', { type: 'checkbox', checked: !!cur, onchange: (e) => VN.mutate(() => { params[pa.key] = e.target.checked; }) }));
      else row.appendChild(inp(cur, setP, pa.type === 'number' ? 'number' : 'text', pa.type === 'number' ? { width: '64px' } : { width: '140px' }));
    }
  };

  VN.actionEditor = (list, title) => {
    const p = VN.project;
    const box = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, title || 'Dann ausführen'));
    if (!list.length) box.appendChild(el('div', { class: 'muted small' }, 'Keine Aktion.'));
    const pluginOpts = window.VNPlugin ? VNPlugin.actionList().map(([ref, label]) => ['plugin:' + ref, label]) : [];
    list.forEach((a, i) => {
      const row = el('div', { class: 'logic-row' });
      row.appendChild(sel(a.type === 'plugin' ? 'plugin:' + a.ref : a.type, [...VN.ACTION_TYPES, ...(VN.Life ? VN.Life.actionTypes() : []), ...VN.extActionTypes(a.type), ...pluginOpts], (v) => VN.mutate(() => {
        const xd = VN.ext.actions[v];
        if (xd) list[i] = Object.assign({ type: v }, xd.make ? xd.make() : {});
        else if (v.startsWith('plugin:')) {
          const ref = v.slice(7);
          const def = VNPlugin.actionDef(ref);
          const params = {};
          for (const pa of (def && def.params) || []) params[pa.key] = pa.default != null ? pa.default : '';
          list[i] = { type: 'plugin', ref, params };
        } else list[i] = { type: v, value: 1, count: 1, amount: 10 };
      })));
      if (a.type === 'plugin') {
        const def = window.VNPlugin && VNPlugin.actionDef(a.ref);
        if (!def) row.appendChild(el('span', { class: 'muted small' }, 'Plugin nicht geladen'));
        a.params = a.params || {};
        VN.paramFields(row, (def && def.params) || [], a.params, sel, inp);
      }
      if (VN.ext.actions[a.type]) { try { VN.ext.actions[a.type].row(row, a, sel, inp); } catch (e) { console.error(e); } }
      else if (VN.Life && VN.Life.actionRow(row, a, sel, inp)) { /* Lebenssimulation */ }
      else if (a.type === 'setVar' || a.type === 'addVar') {
        row.appendChild(sel(a.var || '', [['', '— Variable —'], ...p.vars.map((v) => [v.id, v.name])], (v) => VN.mutate(() => { a.var = v; })));
        const v = p.vars.find((x) => x.id === a.var);
        if (a.type === 'setVar' && v && v.type === 'flag') row.appendChild(sel(String(a.value === true || a.value === 'true'), [['true', 'an'], ['false', 'aus']], (x) => VN.mutate(() => { a.value = x === 'true'; })));
        else row.appendChild(inp(a.value, (x) => VN.mutate(() => { a.value = Number(x); }), 'number'));
      } else if (a.type === 'giveItem' || a.type === 'takeItem') {
        row.appendChild(sel(a.item || '', [['', '— Gegenstand —'], ...p.items.map((v) => [v.id, v.name])], (v) => VN.mutate(() => { a.item = v; })));
        row.appendChild(inp(a.count != null ? a.count : 1, (x) => VN.mutate(() => { a.count = Number(x); }), 'number'));
      } else if (a.type === 'money') {
        row.appendChild(sel(a.currency || '', [['', '— Währung —'], ...p.currencies.map((v) => [v.id, v.name])], (v) => VN.mutate(() => { a.currency = v; })));
        row.appendChild(inp(a.amount, (x) => VN.mutate(() => { a.amount = Number(x); }), 'number'));
      } else if (a.type === 'loot') {
        row.appendChild(sel(a.table || '', [['', '— Loot-Tabelle —'], ...p.lootTables.map((v) => [v.id, v.name])], (v) => VN.mutate(() => { a.table = v; })));
      }
      row.appendChild(el('button', { class: 'btn tiny danger', title: 'Entfernen', onclick: () => VN.mutate(() => { list.splice(i, 1); }) }, '×'));
      box.appendChild(row);
    });
    box.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { list.push({ type: p.lootTables.length ? 'loot' : 'addVar', table: p.lootTables[0] ? p.lootTables[0].id : '', var: p.vars[0] ? p.vars[0].id : '', value: 1 }); }) }, '+ Aktion'));
    return box;
  };

  // Stil-Editor für Figuren, Objekte und Effekte
  VN.styleEditor = (obj, opts = {}) => {
    obj.styles = obj.styles || {};
    const st = obj.styles;
    const box = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, opts.title || 'Ebenen-Stile & Mischmodus'));
    if (opts.blend !== false) box.appendChild(el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Mischmodus'), sel(obj.blend || 'normal', VN.BLENDS, (v) => VN.mutate(() => { obj.blend = v; }))));
    if (opts.opacity !== false) {
      const lab = el('div', { class: 'lbl' }, 'Deckkraft: ' + (obj.opacity != null ? obj.opacity : 100) + ' %');
      box.appendChild(el('div', { class: 'field' }, lab, el('input', {
        type: 'range', min: 0, max: 100, value: obj.opacity != null ? obj.opacity : 100,
        oninput: (e) => { lab.textContent = 'Deckkraft: ' + e.target.value + ' %'; },
        onchange: (e) => VN.mutate(() => { obj.opacity = Number(e.target.value); })
      })));
    }
    const fx = (key, label, defaults, fields) => {
      if (opts.only && !opts.only.includes(key)) return;
      const cur = st[key] || defaults;
      const wrap = el('div', { class: 'style-item' + (cur.on ? ' on' : '') });
      wrap.appendChild(el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!cur.on, onchange: (e) => VN.mutate(() => { st[key] = Object.assign({}, defaults, st[key] || {}, { on: e.target.checked }); }) }), label));
      if (cur.on) {
        const row = el('div', { class: 'logic-row' });
        for (const [k, lab, type] of fields) {
          row.appendChild(el('span', { class: 'muted small' }, lab));
          row.appendChild(type === 'color'
            ? el('input', { type: 'color', value: (cur[k] && cur[k].startsWith('#')) ? cur[k] : '#000000', onchange: (e) => VN.mutate(() => { st[key][k] = e.target.value; }) })
            : el('input', { type: 'number', value: cur[k], style: { width: '56px' }, onchange: (e) => VN.mutate(() => { st[key][k] = Number(e.target.value); }) }));
        }
        wrap.appendChild(row);
      }
      box.appendChild(wrap);
    };
    fx('outline', 'Kontur', { on: false, width: 3, color: '#ffffff' }, [['width', 'px', 'num'], ['color', '', 'color']]);
    fx('shadow', 'Schlagschatten', { on: false, x: 8, y: 10, blur: 12, color: '#000000' }, [['x', 'x', 'num'], ['y', 'y', 'num'], ['blur', 'weich', 'num'], ['color', '', 'color']]);
    fx('glow', 'Schein außen', { on: false, size: 18, color: '#7fe3e8' }, [['size', 'px', 'num'], ['color', '', 'color']]);
    fx('blur', 'Weichzeichnen', { on: false, amount: 3 }, [['amount', 'px', 'num']]);
    fx('adjust', 'Farbe anpassen', { on: false, bright: 100, sat: 100, hue: 0 }, [['bright', 'hell %', 'num'], ['sat', 'sätt. %', 'num'], ['hue', 'ton °', 'num']]);
    return box;
  };

  // ---------- Hintergrund-Bearbeitung ----------
  // look: { styles, zoom, fx, fy, vignette, kenburns }
  VN.applyBgLook = (img, look) => {
    if (!look) return;
    img.style.filter = VN.styleFilter(look.styles);
    const z = (Number(look.zoom) || 100) / 100;
    img.style.transformOrigin = (look.fx != null ? look.fx : 50) + '% ' + (look.fy != null ? look.fy : 50) + '%';
    img.style.objectPosition = (look.fx != null ? look.fx : 50) + '% ' + (look.fy != null ? look.fy : 50) + '%';
    // Bei Unschärfe leicht vergrößern, damit keine hellen Ränder entstehen
    const blurPad = look.styles && look.styles.blur && look.styles.blur.on ? 1 + (Number(look.styles.blur.amount) || 3) / 200 : 1;
    img.style.transform = 'scale(' + (z * blurPad) + ')';
  };
  VN.vignetteEl = (look, cls) => {
    const v = look ? Number(look.vignette) || 0 : 0;
    const d = el('div', { class: cls || 'vignette' });
    d.style.background = `radial-gradient(ellipse at center, transparent ${Math.max(10, 70 - v * 0.5)}%, rgba(0,0,0,${(v / 100) * 0.95}) 100%)`;
    d.style.opacity = v ? '1' : '0';
    return d;
  };
  VN.bgEditor = (look) => {
    const box = VN.styleEditor(look, { only: ['blur', 'adjust'], blend: false, opacity: false, title: 'Hintergrund bearbeiten' });
    const rng = (label, key, min, max, step, def, fmt) => {
      const val = look[key] != null ? look[key] : def;
      const lab = el('div', { class: 'lbl' }, label + ': ' + fmt(val));
      return el('div', { class: 'field' }, lab, el('input', { type: 'range', min, max, step, value: val, oninput: (e) => { lab.textContent = label + ': ' + fmt(Number(e.target.value)); }, onchange: (e) => VN.mutate(() => { look[key] = Number(e.target.value); }) }));
    };
    box.append(
      rng('Zoom', 'zoom', 100, 250, 1, 100, (v) => v + ' %'),
      rng('Ausschnitt waagrecht', 'fx', 0, 100, 1, 50, (v) => v + ' %'),
      rng('Ausschnitt senkrecht', 'fy', 0, 100, 1, 50, (v) => v + ' %'),
      rng('Vignette', 'vignette', 0, 100, 1, 0, (v) => v + ' %'),
      el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!look.kenburns, onchange: (e) => VN.mutate(() => { look.kenburns = e.target.checked; }) }), 'Langsamer Zoom im Spiel (Kamerafahrt)'));
    return box;
  };
})();
