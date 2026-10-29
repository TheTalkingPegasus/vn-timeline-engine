// Plugin-Schnittstelle: Projekte können eigene Aktionen, Minispiele und Hooks als JavaScript mitbringen
(function () {
  const { el } = VN;

  const VNPlugin = (window.VNPlugin = {
    plugins: {},   // id -> Definition
    files: {},     // Dateiname -> id
    _current: null,

    // Wird von jedem Plugin aufgerufen
    register(def) {
      if (!def || !def.id) { console.warn('Plugin ohne id ignoriert'); return; }
      def.file = VNPlugin._current || def.file || '';
      def.actions = def.actions || {};
      def.hooks = def.hooks || {};
      VNPlugin.plugins[def.id] = def;
      // Eigene Bedingungen: erscheinen in jedem „Nur wenn“ als „Name: Label“
      for (const [k, c] of Object.entries(def.conditions || {})) {
        const ref = def.id + '.' + k;
        VN.registerCond('pl:' + ref, {
          label: (def.name || def.id) + ': ' + (c.label || k),
          make: () => { const params = {}; for (const pa of c.params || []) params[pa.key] = pa.default != null ? pa.default : ''; return { params }; },
          check: (cd, rs) => !!c.check(Object.assign({}, cd.params || {}), VNPlugin.makeCtx(rs, def.id)),
          text: (cd) => (c.text ? c.text(cd.params || {}) : (def.name || def.id) + ': ' + (c.label || k)),
          problem: (cd) => (c.problem ? c.problem(cd.params || {}) : null),
          row: (row, cd, sel, inp) => { cd.params = cd.params || {}; VN.paramFields(row, c.params || [], cd.params, sel, inp); }
        });
      }
      if (def.file) VNPlugin.files[def.file] = def.id;
    },

    actionDef(ref) {
      const [pid, key] = String(ref || '').split('.');
      const p = VNPlugin.plugins[pid];
      return p && p.actions[key] ? Object.assign({ plugin: p, key }, p.actions[key]) : null;
    },

    // Alle Plugin-Aktionen für Auswahllisten
    actionList() {
      const out = [];
      for (const p of Object.values(VNPlugin.plugins)) for (const [k, a] of Object.entries(p.actions)) out.push([p.id + '.' + k, (p.name || p.id) + ': ' + (a.label || k)]);
      return out;
    },

    hook(name, ...args) {
      for (const p of Object.values(VNPlugin.plugins)) {
        if (typeof p.hooks[name] === 'function') {
          // Jedes Plugin bekommt seinen eigenen Kontext (für ctx.store())
          const a2 = args.map((x) => (x && x.__ctx ? VNPlugin.makeCtx(x.state, p.id) : x));
          try { p.hooks[name](...a2); } catch (e) { console.error('Plugin ' + p.id + ' / ' + name, e); }
        }
      }
    },

    // Plugins des Projekts laden (Editor und Windows-Spiel)
    async load() {
      if (!VN.api || !VN.api.plugins || !VN.project) return;
      VNPlugin.unloadAll();
      for (const s of document.querySelectorAll('script[data-vnplugin]')) s.remove();
      VNPlugin.plugins = {};
      VNPlugin.files = {};
      for (const k of Object.keys(VN.ext.conds)) if (k.startsWith('pl:')) delete VN.ext.conds[k];
      let files = [];
      try { files = await VN.api.plugins.list(); } catch (e) { files = []; }
      VN.project.plugins = VN.project.plugins || {};
      for (const f of files) {
        if (!VN.project.plugins[f]) VN.project.plugins[f] = { enabled: true };
        if (!VN.project.plugins[f].enabled) continue;
        await VNPlugin.inject(f);
      }
      VNPlugin.available = files;
      if (!VN.gameMode && !VNPlugin._updating) await VNPlugin.checkBundled();
    },
    // Mitgelieferte Plugins aktuell halten: unveränderte alte Versionen still ersetzen,
    // selbst geänderte nur auf Wunsch (Knopf im Plugin-Reiter)
    BUNDLED_FILES: ['jobs.js', 'minispiele.js'],
    KNOWN_OLD: { 'minispiele.js': ['91d6ffff', '8a6bc3dc'], 'jobs.js': ['322ce80e', '1e08ad44'] },
    hash(t) { t = String(t || '').replace(/\r\n/g, '\n'); let x = 2166136261; for (let i = 0; i < t.length; i++) { x ^= t.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); },
    updates: {},
    async checkBundled() {
      const p = VN.project;
      if (!VN.api.plugins.bundledText) return;
      VNPlugin.updates = {};
      let changed = [];
      for (const f of VNPlugin.BUNDLED_FILES) {
        if (!(VNPlugin.available || []).includes(f)) continue;
        let cur = '', tpl = '';
        try { cur = await VN.api.plugins.read(f); tpl = await VN.api.plugins.bundledText(f); } catch (e) { continue; }
        if (!tpl) continue;
        const hc = VNPlugin.hash(cur), ht = VNPlugin.hash(tpl);
        p.plugins[f] = p.plugins[f] || { enabled: true };
        if (hc === ht) { p.plugins[f].hash = ht; continue; }
        if ((VNPlugin.KNOWN_OLD[f] || []).includes(hc) || p.plugins[f].hash === hc) {
          await VN.api.plugins.addBundled(f, true);
          p.plugins[f].hash = ht;
          changed.push(f);
        } else VNPlugin.updates[f] = true;
      }
      if (changed.length) {
        VNPlugin._updating = true;
        await VNPlugin.load();
        VNPlugin._updating = false;
        VN.toast('Mitgeliefertes Plugin aktualisiert: ' + changed.map((f) => (VNPlugin.plugins[VNPlugin.files[f]] || {}).name || f).join(', '));
      }
    },
    async updateBundled(f) {
      await VN.api.plugins.addBundled(f, true);
      const tpl = await VN.api.plugins.bundledText(f);
      VN.project.plugins[f] = Object.assign(VN.project.plugins[f] || { enabled: true }, { hash: VNPlugin.hash(tpl) });
      await VNPlugin.load();
      VN.toast('Neue Version eingespielt');
      VN.render();
    },
    inject(file) {
      return new Promise((resolve) => {
        const sc = document.createElement('script');
        sc.dataset.vnplugin = file;
        sc.src = VN.assetUrl ? VN.api.fileUrl(VN.dir, 'plugins/' + file) + '?t=' + Date.now() : 'plugins/' + file;
        VNPlugin._current = file;
        sc.onload = () => { VNPlugin._current = null; resolve(true); };
        sc.onerror = () => { VNPlugin._current = null; console.warn('Plugin konnte nicht geladen werden: ' + file); resolve(false); };
        document.head.appendChild(sc);
      });
    },

    // Einheitliches Minispiel-Ergebnis: Zahl 0…1, true/false oder { score, ok }
    result(r) {
      const res = VNPlugin._result(r);
      // Skilltree-Bonus „Besseres Minispiel-Ergebnis“
      const rs = window.Player && Player.state && Player.state.rs;
      if (rs && VN.bonus && res.score < 1) { const s = Math.min(1, VN.bonus('minigame.score', res.score, rs)); if (s !== res.score) { res.score = s; if (s >= 0.5) res.ok = true; } }
      return res;
    },
    _result(r) {
      if (r && typeof r === 'object' && ('score' in r || 'ok' in r)) return { score: r.score != null ? Math.max(0, Math.min(1, Number(r.score))) : (r.ok ? 1 : 0), ok: r.ok != null ? !!r.ok : Number(r.score) >= 0.5 };
      if (typeof r === 'number') return { score: Math.max(0, Math.min(1, r)), ok: r >= 0.5 };
      if (typeof r === 'boolean') return { score: r ? 1 : 0, ok: r };
      return { score: 1, ok: true };
    },
    // Mitgelieferte Plugins ein-/ausschalten (Jobs, Minispiele)
    async setBundled(file, on) {
      const p = VN.project;
      p.plugins = p.plugins || {};
      let hash = p.plugins[file] && p.plugins[file].hash;
      if (on && !(VNPlugin.available || []).includes(file)) { await VN.api.plugins.addBundled(file); try { hash = VNPlugin.hash(await VN.api.plugins.bundledText(file)); } catch (e) { /* egal */ } }
      VN.mutate(() => { p.plugins[file] = { enabled: !!on, hash }; });
      await VNPlugin.load();
      VN.render();
    },
    // Einträge fürs Pausenmenü: [{ label, key, run(ctx), plugin }]
    menuEntries(rs) {
      const out = [];
      for (const d of Object.values(VNPlugin.plugins)) for (const m of d.menu || []) {
        try { if (m.when && !m.when(VNPlugin.makeCtx(rs, d.id))) continue; } catch (e) { continue; }
        out.push(Object.assign({ plugin: d.id }, m));
      }
      return out;
    },
    // Anzeigen oben im Spiel (HUD): Element oder Text je Plugin
    hudItems(rs) {
      const out = [];
      for (const d of Object.values(VNPlugin.plugins)) if (typeof d.hud === 'function') {
        try { const r = d.hud(VNPlugin.makeCtx(rs, d.id)); if (r != null && r !== '') out.push(typeof r === 'string' ? VN.el('span', { class: 'money-chip' }, r) : r); } catch (e) { console.error('Plugin ' + d.id + ' / hud', e); }
      }
      return out;
    },
    // {platzhalter} im Text
    placeholder(name, rs) {
      for (const d of Object.values(VNPlugin.plugins)) {
        const f = d.placeholders && d.placeholders[name];
        if (typeof f === 'function') { try { return f(VNPlugin.makeCtx(rs, d.id)); } catch (e) { return null; } }
      }
      return null;
    },

    // Plugins mit eigenem Reiter in „Spielsysteme“
    tabs() { return Object.values(VNPlugin.plugins).filter((d) => d.editorTab && d.editorTab.render).map((d) => ['pl:' + d.id, d.editorTab.label || d.name || d.id, d]); },

    // Eine Plugin-Aktion im Editor ausprobieren (Fenster in Spielgröße, verändert nichts am Projekt)
    tryAction(ref, params) {
      const def = VNPlugin.actionDef(ref);
      if (!def) return;
      const p = VN.project;
      const prm = {};
      for (const pa of def.params || []) prm[pa.key] = pa.default != null ? pa.default : '';
      Object.assign(prm, params || {});
      const rs = VN.newRunState();
      for (const c of p.currencies) rs.money[c.id] = Math.max(rs.money[c.id] || 0, 50);
      if (def.plugin.tryPrepare) try { def.plugin.tryPrepare(def.key, prm, rs); } catch (e) { console.warn(e); }
      const host = el('div', { class: 'shop-preview-host mg-try' });
      const note = el('div', { class: 'muted small', style: { textAlign: 'center' } }, 'Probelauf – verändert nichts am Projekt. Rechtsklick aufs Fenster: Design ändern.');
      const back = el('div', { class: 'modal-back' }, el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' } }, host, note,
        el('button', { class: 'btn', style: { alignSelf: 'center' }, onclick: () => back.remove() }, 'Schließen')));
      document.body.appendChild(back);
      const ctx = VNPlugin.makeCtx(rs);
      ctx.overlay = (opts = {}) => { const panel = el('div', { class: 'plugin-panel' }); if (opts.width) panel.style.width = opts.width; host.appendChild(panel); if (opts.design && window.UiDesign) UiDesign.apply(opts.design, panel, host); return { el: panel, root: host, close: () => panel.remove() }; };
      ctx.vars.set = () => {};
      Promise.resolve(def.run(prm, ctx)).then((r) => { const res = VNPlugin.result(r); note.textContent = 'Ergebnis: ' + Math.round(res.score * 100) + ' % · ' + (res.ok ? 'geschafft' : 'nicht geschafft') + ' (Probelauf)'; });
      return { back, host, rs };
    },

    // Kontext, den Plugin-Aktionen bekommen
    // Aufräumen vor dem Neuladen: Hook onUnload und alles, was über ctx.listen / ctx.every / ctx.onCleanup angemeldet wurde
    _cleanups: {},
    unloadAll() {
      for (const p of Object.values(VNPlugin.plugins || {})) {
        if (p.hooks && p.hooks.onUnload) { try { p.hooks.onUnload(VNPlugin.makeCtx(window.Player && Player.state ? Player.state.rs : VN.newRunState(), p.id)); } catch (e) { console.error('Plugin ' + p.id + ' / onUnload', e); } }
      }
      for (const [id, list] of Object.entries(VNPlugin._cleanups)) for (const fn of list) { try { fn(); } catch (e) { console.error('Plugin ' + id + ' / Aufräumen', e); } }
      VNPlugin._cleanups = {};
    },
    makeCtx(rs, pluginId) {
      const p = VN.project;
      const findVar = (x) => p.vars.find((v) => v.id === x || v.name === x);
      const findItem = (x) => p.items.find((v) => v.id === x || v.name === x);
      const findCur = (x) => p.currencies.find((v) => v.id === x || v.name === x);
      const host = () => (window.Player && Player.host) || document.body;
      const cleanup = (fn) => { const k = pluginId || '?'; (VNPlugin._cleanups[k] = VNPlugin._cleanups[k] || []).push(fn); };
      return {
        __ctx: true,
        // Dauerhafte Dinge so anmelden, dann räumt die Engine beim Neuladen/Abschalten selbst auf
        onCleanup: cleanup,
        listen: (target, type, fn, opt) => { target.addEventListener(type, fn, opt); cleanup(() => target.removeEventListener(type, fn, opt)); },
        every: (ms, fn) => { const t = setInterval(fn, ms); cleanup(() => clearInterval(t)); return t; },
        project: p,
        state: rs,
        lang: VN.lang,
        vars: {
          get: (x) => { const v = findVar(x); return v ? rs.vars[v.id] : undefined; },
          set: (x, val) => { const v = findVar(x); if (v) rs.vars[v.id] = val; window.Player && Player.refreshHud && Player.refreshHud(); }
        },
        items: {
          count: (x) => { const it = findItem(x); return it ? rs.inv[it.id] || 0 : 0; },
          give: (x, n) => { const it = findItem(x); if (it) VN.giveItem(rs, it.id, n || 1); },
          take: (x, n) => { const it = findItem(x); if (it) { rs.inv[it.id] = Math.max(0, (rs.inv[it.id] || 0) - (n || 1)); if (!rs.inv[it.id]) delete rs.inv[it.id]; } }
        },
        money: {
          get: (x) => { const c = findCur(x); return c ? rs.money[c.id] || 0 : 0; },
          add: (x, n) => { const c = findCur(x); if (c) VN.addMoney(rs, c.id, n); window.Player && Player.refreshHud && Player.refreshHud(); }
        },
        asset: (nameOrId) => { const a = p.assets.find((x) => x.id === nameOrId || x.name === nameOrId); return a ? VN.assetUrl(a.id) : ''; },
        sound: (nameOrId, vol) => {
          const a = p.assets.find((x) => x.id === nameOrId || x.name === nameOrId);
          if (!a) return;
          const au = new Audio(VN.assetUrl(a.id));
          au.volume = Math.max(0, Math.min(1, (vol != null ? vol : 90) / 100 * (VN.settings ? VN.settings.sfx / 100 : 1)));
          au.play().catch(() => {});
        },
        // Ein Fenster über dem Spiel öffnen (für Minispiele). Gibt { el, close } zurück
        overlay(opts = {}) {
          const box = el('div', { class: 'plugin-overlay' + (opts.dim === false ? '' : ' dim') });
          const panel = el('div', { class: 'plugin-panel' });
          if (opts.width) panel.style.width = opts.width;
          box.appendChild(panel);
          box.addEventListener('click', (e) => e.stopPropagation());
          host().appendChild(box);
          if (opts.design && window.UiDesign) UiDesign.apply(opts.design, panel, box);
          return { el: panel, root: box, close: () => box.remove() };
        },
        // Design eines Systems/Minispiels: .apply(fenster), .image('slot', bildAnDerAktion)
        design: (key) => (window.UiDesign ? UiDesign.api(key) : { apply() {}, image: (s, o) => (o ? VN.assetUrl(o) : ''), imageId: (s, o) => o || '', values: () => ({}) }),
        message(text) {
          return new Promise((resolve) => {
            const o = this.overlay({});
            o.el.append(el('div', { style: { fontSize: '3.2cqh', textAlign: 'center', lineHeight: '1.4' } }, text),
              el('button', { class: 'btn primary', style: { marginTop: '2.4cqh', fontSize: '2.6cqh' }, onclick: () => { o.close(); resolve(); } }, 'Weiter'));
          });
        },
        el: VN.el,
        // Lebenssimulation: Zeit, Beziehungen, andere Plugin-Aktionen (z. B. Minispiele) starten
        time: {
          advance: (n) => { if (VN.Life && VN.Life.timeOn()) { VN.Life.advance(rs, { mode: 'add', amount: n || 1 }); window.Player && Player.onTime && Player.onTime(); } },
          text: () => (VN.Life && VN.Life.timeOn() ? VN.Life.timeText(VN.Life.initRun(rs)) : '')
        },
        rel: {
          add: (char, n) => { if (VN.Life && VN.Life.relOn()) { VN.Life.addRel(rs, char, n); window.Player && Player.refreshHud && Player.refreshHud(); } },
          get: (char) => { if (!VN.Life || !VN.Life.relOn()) return 0; VN.Life.initRun(rs); const c = VN.Life.relChar(char); return c ? rs.rel[c.id] || 0 : 0; }
        },
        // Eine andere Plugin-Aktion ausführen und auf ihr Ergebnis warten. Minispiele liefern { score: 0…1, ok }.
        async run(ref, params) {
          const def = VNPlugin.actionDef(ref);
          if (!def) return null;
          const r = await def.run(Object.assign({}, params || {}), this);
          return VNPlugin.result(r);
        },
        data: (id) => { p.pluginData = p.pluginData || {}; return p.pluginData[id] || (p.pluginData[id] = {}); },
        // Eigener Bereich im Spielstand (wird mitgespeichert) und über alle Durchläufe (bleibt nach „Neues Spiel“)
        store: (id) => { id = id || pluginId || 'plugin'; rs.pl = rs.pl || {}; return rs.pl[id] || (rs.pl[id] = {}); },
        global: (id) => { id = id || pluginId || 'plugin'; if (!VN.Extras) return {}; const P = VN.Extras.P(); P.pl = P.pl || {}; const o = P.pl[id] || (P.pl[id] = {}); VN.Extras.save(); return o; },
        check: (conds) => VN.checkConds(conds || [], rs),
        // Bonus aus Skilltrees: ctx.bonus('job.pay', 100) → 100 plus alle passenden Boni
        bonus: (key, base, sub) => (VN.bonus ? VN.bonus(key, base, rs, sub) : base),
        // Andere Engine-Aktionen ausführen (z. B. [{ type: 'giveItem', item: 'it_x', count: 1 }])
        act: (list) => { const g = VN.applyActions(list || [], rs, 'plugin:' + (pluginId || '')); window.Player && Player.refreshHud && Player.refreshHud(); return g; }
      };
    }
  });

  // ---------- Editor: Plugin-Verwaltung (Tab in den Spielsystemen) ----------
  VNPlugin.editorPanel = (body) => {
    const p = VN.project;
    p.plugins = p.plugins || {};
    body.appendChild(el('p', { class: 'muted' },
      'Plugins sind JavaScript-Dateien im Ordner „plugins“ deines Projekts. Sie können eigene Aktionen (z. B. Minispiele) mitbringen, ',
      'die dann überall unter „+ Aktion“ auswählbar sind. Die Anleitung liegt als PLUGINS.md im selben Ordner.'));
    body.appendChild(el('div', { class: 'hint-box', style: { borderLeft: '3px solid var(--orange)' } },
      'Plugins sind Programmcode und können alles, was die Engine kann. Nutze nur Plugins, denen du vertraust.'));
    const files = VNPlugin.available || [];
    if (!files.length) body.appendChild(el('div', { class: 'hint-box' }, 'Noch keine Plugins im Projekt. Lege das Beispiel-Plugin an, um zu sehen, wie es funktioniert.'));
    for (const f of files) {
      const id = VNPlugin.files[f];
      const def = id ? VNPlugin.plugins[id] : null;
      const on = !p.plugins[f] || p.plugins[f].enabled;
      body.appendChild(el('div', { class: 'opt-card' },
        el('div', { class: 'row gap8' },
          el('label', { class: 'check', style: { flex: '1' } }, el('input', { type: 'checkbox', checked: on, onchange: (e) => { VN.mutate(() => { p.plugins[f] = { enabled: e.target.checked }; }); VNPlugin.load().then(VN.render); } }),
            el('strong', null, def ? (def.name || def.id) + (def.version ? ' · ' + def.version : '') : f)),
          el('span', { class: 'muted small mono' }, f),
          el('button', { class: 'btn tiny', onclick: () => VNPlugin.openEditor(f) }, 'Code bearbeiten')),
        VNPlugin.updates[f] ? el('div', { class: 'hint-box', style: { borderLeft: '3px solid var(--accent)' } }, 'Eine neuere Version dieses mitgelieferten Plugins ist da. Du hast die Datei selbst geändert – beim Einspielen gehen deine Änderungen verloren. ',
          el('button', { class: 'btn tiny primary', onclick: () => VNPlugin.updateBundled(f) }, 'Neue Version einspielen')) : null,
        def && def.description ? el('div', { class: 'muted' }, def.description) : null,
        def ? el('div', { class: 'row gap4', style: { flexWrap: 'wrap' } }, ...Object.entries(def.actions).map(([k, a]) => el('span', { class: 'chip' }, 'Aktion: ' + (a.label || k)))) : (on ? el('div', { class: 'muted small' }, 'Nicht geladen – Fehler im Code? Strg+Umschalt+I zeigt Details.') : null)));
    }
    body.appendChild(el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
      el('button', { class: 'btn', onclick: async () => { await VN.api.plugins.addExample(); await VNPlugin.load(); VN.toast('Beispiel-Plugin angelegt'); VN.render(); } }, 'Beispiel-Plugin anlegen'),
      el('button', { class: 'btn', onclick: async () => {
        const name = 'mein_plugin_' + (files.length + 1) + '.js';
        await VN.api.plugins.write(name, VN.t(TEMPLATE).replace(/__ID__/g, name.replace('.js', '')));
        await VNPlugin.load(); VN.render(); VNPlugin.openEditor(name);
      } }, '+ Neues Plugin'),
      el('button', { class: 'btn', onclick: () => VN.api.openPath('plugins') }, 'Plugin-Ordner öffnen'),
      el('button', { class: 'btn', onclick: async () => { await VNPlugin.load(); VN.toast('Plugins neu geladen'); VN.render(); } }, 'Neu laden')));
  };

  const TEMPLATE = `// Eigenes Plugin für die VN Timeline Engine
// Anleitung: siehe PLUGINS.md in diesem Ordner
VNPlugin.register({
  id: '__ID__',
  name: 'Mein Plugin',
  version: '1.0',
  description: 'Beschreibe hier kurz, was dein Plugin macht.',
  actions: {
    hallo: {
      label: 'Hallo sagen',
      params: [
        { key: 'text', label: 'Text', type: 'text', default: 'Hallo aus dem Plugin!' },
        { key: 'gold', label: 'Gold geben', type: 'number', default: 5 }
      ],
      // Läuft, wenn die Aktion im Spiel ausgelöst wird. Ein Promise lässt das Spiel warten.
      run(params, ctx) {
        ctx.money.add('Gold', Number(params.gold) || 0);
        return ctx.message(params.text);
      }
    }
  },
  hooks: {
    onSceneEnter(scene, ctx) { /* z. B. Statistik zählen */ }
  }
});
`;

  VNPlugin.openEditor = async (file) => {
    const text = await VN.api.plugins.read(file);
    const back = el('div', { class: 'modal-back' });
    const ta = el('textarea', { class: 'code-ta', spellcheck: 'false' });
    ta.value = text;
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = s + 2; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    });
    const save = async () => { await VN.api.plugins.write(file, ta.value); await VNPlugin.load(); VN.toast('Plugin gespeichert und neu geladen'); VN.render(); };
    back.appendChild(el('div', { class: 'modal code-modal' },
      el('div', { class: 'row gap8' }, el('strong', { style: { flex: '1' } }, 'Plugin-Code · ' + file), el('span', { class: 'muted small' }, 'Strg+S speichert')),
      ta,
      el('div', { class: 'row gap8', style: { justifyContent: 'flex-end' } },
        el('button', { class: 'btn', onclick: () => back.remove() }, 'Schließen'),
        el('button', { class: 'btn primary', onclick: async () => { await save(); back.remove(); } }, 'Speichern & schließen'))));
    document.body.appendChild(back);
    ta.focus();
  };
})();
