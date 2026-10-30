// Design für Spielsysteme und Minispiele: Läden, Beziehungen, Geschenke, Zeit-Anzeige, Jobs, Minispiele.
// Jedes System hat Farben, Rahmen (9-Slice), Hintergrund und eigene Standard-Bilder.
// Ohne eigene Einstellung erbt alles vom „Systemfenster“-Design, Minispiele erben von „Minispiele (alle)“.
// Plugins melden eigene Designs über  designs: { schluessel: { label, parent, images: [[key, label], …] } }  an
// und benutzen sie mit  ctx.design('pluginId.schluessel').apply(el)  bzw.  .image('key', params.bild).
(function () {
  const { el } = VN;

  const BUILTIN = [
    { key: 'shop', label: 'Läden', icon: '🛒', images: [] },
    { key: 'rel', label: 'Beziehungen', icon: '♥', images: [] },
    { key: 'gift', label: 'Geschenke', icon: '🎁', images: [] },
    { key: 'time', label: 'Zeit-Anzeige', icon: '🕰', images: [['icon', 'Symbol vor der Zeit']], chip: true },
    { key: 'ach', label: 'Erfolg-Meldung', icon: '🏆', images: [] },
    { key: 'map', label: 'Weltkarte', icon: '🗺', images: [] },
    { key: 'questlog', label: 'Questlog', icon: '📜', images: [] },
    { key: 'q_new', label: 'Quest: Neue Quest', icon: '📜', images: [], parent: 'q_all' },
    { key: 'q_step', label: 'Quest: Abschnitt erledigt', icon: '✓', images: [], parent: 'q_all' },
    { key: 'q_done', label: 'Quest: Abgeschlossen', icon: '★', images: [], parent: 'q_all' },
    { key: 'q_series', label: 'Quest: Reihe abgeschlossen', icon: '🏆', images: [], parent: 'q_all' },
    { key: 'q_fail', label: 'Quest: Gescheitert', icon: '✗', images: [], parent: 'q_all' },
    { key: 'q_all', label: 'Quest-Einblendungen (alle)', icon: '📜', images: [] },
    { key: 'relpop', label: 'Beziehungs-Einblendung', icon: '♥', images: [] },
    { key: 'relmsg', label: 'Nachricht einer Figur', icon: '💬', images: [['phone', 'Handy-Rahmen (eigenes Bild, optional)']], sounds: [['sndA', 'Nachricht kommt an']] },
    { key: 'relnote', label: 'Meldung „… hat dir geschickt“', icon: '🔔', images: [], sounds: [['sndA', 'Ton der Meldung (leer = Nachrichten-Ton)']] },
    { key: 'galnew', label: 'Galerie: „Neu“-Leuchten', icon: '✨', images: [], sounds: [['sndA', 'Bild freigeschaltet']] },
    { key: 'skills', label: 'Skilltree', icon: '🌳', images: [] },
    { key: 'combat', label: 'Kampf', icon: '⚔', images: [] },
    { key: 'idle', label: 'Aufbau', icon: '🏰', images: [] },
    { key: 'minigame', label: 'Minispiele (alle)', icon: '🎲', images: [] }
  ];
  // Felder wie beim Systemfenster (theme.js SYS_BASE) plus Fenster-Hintergrundbild
  const FIELDS = ['bg', 'alpha', 'border', 'text', 'accent', 'accentText', 'font', 'titleFont', 'radius', 'dim', 'frame', 'slice', 'frameW', 'panelBg', 'screenBg', 'pattern', 'glow', 'borderW', 'preset',
    'oNode', 'oLines', 'oSide', 'oPanel', 'oMenu', 'oBars', 'oCards', 'oGoals', 'oTabs', 'oPop', 'oMsg', 'oNotePos', 'oNew', 'sndA'];
  const UP = () => window.UiPresets;

  const UiDesign = (window.UiDesign = {
    BUILTIN,
    // Alle bekannten Designs (eingebaut + aus geladenen Plugins)
    kinds() {
      const out = BUILTIN.slice();
      if (window.VNPlugin) for (const d of Object.values(VNPlugin.plugins)) {
        for (const [k, x] of Object.entries(d.designs || {})) out.push({ key: d.id + '.' + k, label: x.label || k, icon: x.icon || '🧩', parent: x.parent || '', images: x.images || [], plugin: d.id, pluginName: d.name || d.id });
      }
      return out;
    },
    find(key) { return UiDesign.kinds().find((k) => k.key === key) || null; },
    store() { const p = VN.project; return p ? (p.uiDesign = p.uiDesign || {}) : {}; },
    raw(key) { return (VN.project && VN.project.uiDesign && VN.project.uiDesign[key]) || null; },
    has(key) { const r = UiDesign.raw(key); return !!(r && Object.keys(r).some((k) => k === 'images' ? Object.values(r.images || {}).some(Boolean) : r[k] !== '' && r[k] != null)); },
    parentOf(key) {
      const k = UiDesign.find(key);
      if (k && k.parent) return k.parent;
      if (k && k.plugin) { const def = window.VNPlugin && VNPlugin.plugins[k.plugin]; if (def && def.actions && Object.values(def.actions).some((a) => a.minigame)) return 'minigame'; }
      return '';
    },
    // Fertige Werte: Systemfenster ← Eltern-Design ← eigenes Design
    resolve(key) {
      const base = window.Theme ? Object.assign({}, Theme.sys()) : {};
      const chain = [];
      for (let k = key, guard = 0; k && guard < 5; k = UiDesign.parentOf(k), guard++) chain.unshift(k);
      const out = Object.assign({}, base, { panelBg: '', images: {} });
      for (const k of chain) {
        const r = UiDesign.raw(k);
        if (!r) continue;
        for (const f of FIELDS) if (r[f] !== '' && r[f] != null) out[f] = r[f];
        for (const [ik, iv] of Object.entries(r.images || {})) if (iv) out.images[ik] = iv;
      }
      return out;
    },
    // Bild-Vorrang: Bild an der Aktion > Standard-Bild im Design > nichts (eingebaute Grafik)
    imageId(key, slot, override) { return override || UiDesign.resolve(key).images[slot] || ''; },
    image(key, slot, override) { const id = UiDesign.imageId(key, slot, override); return id ? (window.Theme ? Theme.src(id) : VN.assetUrl(id)) : ''; },

    // Auf ein Fenster anwenden (plugin-panel oder sys-panel). overlay = Fläche dahinter (optional)
    apply(key, panel, overlay) {
      if (!panel) return;
      const D = UiDesign.resolve(key);
      panel.dataset.design = key;
      panel.classList.add('ui-d');
      const v = (k, val) => panel.style.setProperty(k, val);
      v('--sys-bg', VN.hexA(D.bg, D.alpha / 100));
      v('--sys-border', VN.hexA(D.border, 0.55));
      v('--sys-text', D.text);
      v('--sys-accent', D.accent);
      v('--sys-acc-ink', D.accentText);
      v('--sys-font', (window.Theme && Theme.fontCss(D.font || Theme.t().fonts.ui)) || 'inherit');
      v('--sys-tfont', (window.Theme && Theme.fontCss(D.titleFont)) || 'Georgia, serif');
      v('--sys-radius', D.radius + 'cqh');
      const S = panel.style;
      if (D.frame && window.Theme && Theme.src(D.frame)) {
        S.borderStyle = 'solid';
        S.borderWidth = D.frameW + 'cqh';
        S.borderImage = `${Theme.cssUrl(D.frame)} ${D.slice}% fill / ${D.frameW}cqh stretch`;
        S.background = D.panelBg && Theme.src(D.panelBg) ? `${Theme.cssUrl(D.panelBg)} center / cover no-repeat` : 'transparent';
        S.boxShadow = 'none';
      } else {
        S.borderImage = '';
        // Ohne Bild: Muster der Vorlage (Pergament, Holz, Sterne …) aus reinem CSS
        S.background = D.panelBg && window.Theme && Theme.src(D.panelBg) ? `linear-gradient(${VN.hexA(D.bg, Math.min(0.6, D.alpha / 100))}, ${VN.hexA(D.bg, Math.min(0.6, D.alpha / 100))}), ${Theme.cssUrl(D.panelBg)} center / cover no-repeat` : (UP() ? UP().background(D) : '');
        S.borderWidth = D.borderW ? D.borderW + 'cqh' : '';
        S.boxShadow = D.glow ? `0 0 3cqh ${VN.hexA(D.accent || '#e8a43a', 0.35)}, inset 0 0 2.4cqh ${VN.hexA(D.accent || '#e8a43a', 0.12)}` : '';
      }
      // Helle Flächen (Pergament, Papier …): dunkle Knöpfe und Zusatzfarben
      const hx = /^#?([0-9a-f]{6})$/i.exec(D.bg || '');
      if (hx) { const n = parseInt(hx[1], 16); panel.classList.toggle('ui-light', (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 165); }
      // Aufbau-Optionen des Bildschirms (Form der Skills, Lage der Leiste …)
      if (UP()) for (const [ok, , choices] of UP().opts(key)) panel.dataset[ok] = D[ok] || choices[0][0];
      const ov = overlay || (panel.parentElement && panel.parentElement.classList.contains('plugin-overlay') ? panel.parentElement : null);
      if (ov && UiDesign.raw(key) !== null) {
        const dim = `rgba(0,0,0,${(D.dim != null ? D.dim : 55) / 100})`;
        ov.style.background = D.screenBg && window.Theme && Theme.src(D.screenBg) ? `linear-gradient(${dim}, ${dim}), ${Theme.cssUrl(D.screenBg)} center / cover no-repeat` : dim;
      }
      return D;
    },
    // Kleine Anzeige (Zeit-Chip im HUD)
    applyChip(key, chip, fallbackIcon) {
      const D = UiDesign.resolve(key);
      if (!UiDesign.has(key)) return;
      Object.assign(chip.style, { background: VN.hexA(D.bg, D.alpha / 100), color: D.text, border: '0.2cqh solid ' + VN.hexA(D.border, 0.7), borderRadius: D.radius + 'cqh', fontFamily: (window.Theme && Theme.fontCss(D.font)) || '' });
      const ic = UiDesign.image(key, 'icon');
      if (ic) {
        chip.textContent = chip.textContent.replace(fallbackIcon || '🕰', '').trim();
        chip.prepend(el('img', { src: ic, style: { height: '2.6cqh', verticalAlign: 'middle', marginRight: '0.8cqh' } }));
      }
    },
    // Für Plugins (ctx.design)
    api(key) {
      return {
        key,
        apply: (panel, overlay) => UiDesign.apply(key, panel, overlay),
        image: (slot, override) => UiDesign.image(key, slot, override),
        imageId: (slot, override) => UiDesign.imageId(key, slot, override),
        values: () => UiDesign.resolve(key)
      };
    },

    // ---------- Editor ----------
    edit(key) { VN.ui.view = 'design'; VN.ui.designSec = 'games'; VN.ui.uiDesignKey = key; VN.render(); },
    // Rechtsklick auf ein Fenster mit Design (Vorschau, Probelauf, Spiel testen im Editor)
    menuFor(panel, e) {
      if (VN.gameMode || !window.Design || !panel || !panel.dataset.design) return false;
      const k = UiDesign.find(panel.dataset.design);
      e.preventDefault();
      e.stopPropagation();
      VN.menu(e.clientX, e.clientY, [{ head: k ? k.label : 'Fenster' }, { label: '🎨 Design ändern …', action: () => { const back = panel.closest('.modal-back'); if (back) back.remove(); if (window.Player && Player.state && Player.close) Player.close(); UiDesign.edit(panel.dataset.design); } }]);
      return true;
    },
    inspector() {
      const kinds = UiDesign.kinds();
      const key = kinds.some((k) => k.key === VN.ui.uiDesignKey) ? VN.ui.uiDesignKey : 'shop';
      const kind = UiDesign.find(key);
      const D = UiDesign.resolve(key);
      const own = UiDesign.raw(key) || {};
      const set = (k, val) => VN.mutate(() => { const s = UiDesign.store(); s[key] = s[key] || {}; s[key][k] = val; });
      const setImg = (k, val) => VN.mutate(() => { const s = UiDesign.store(); s[key] = s[key] || {}; s[key].images = s[key].images || {}; s[key].images[k] = val; });
      const { sec, textureField } = Design;
      const fld = (label, input) => el('div', { class: 'field' }, el('div', { class: 'lbl' }, label), input);
      const row = (...c) => el('div', { class: 'd-row' }, ...c);
      const color = (label, k) => el('label', { class: 'd-color' + (own[k] ? ' own' : '') },
        el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(D[k] || '') ? D[k] : '#000000', onchange: (e) => set(k, e.target.value) }), el('span', null, label));
      const rng = (label, k, min, max, step, unit) => {
        const cur = D[k] != null && D[k] !== '' ? D[k] : min;
        const lab = el('div', { class: 'lbl' }, label + ': ' + cur + unit);
        return el('div', { class: 'field' }, lab, el('input', { type: 'range', min, max, step, value: cur, oninput: (e) => { lab.textContent = label + ': ' + e.target.value + unit; }, onchange: (e) => set(k, Number(e.target.value)) }));
      };
      const fontSel = (k, emptyLabel) => {
        const s = el('select', { onchange: (e) => set(k, e.target.value) });
        for (const [v, l] of Theme.fontOptions(emptyLabel)) { const o = el('option', { value: v }, l); if (String(v) === String(own[k] || '')) o.selected = true; s.appendChild(o); }
        return s;
      };
      // Auswahl des Systems
      const pick = el('select', { onchange: (e) => { VN.ui.uiDesignKey = e.target.value; VN.render(); } });
      let lastGroup = null, grp = null;
      for (const k of kinds) {
        const g = k.plugin ? 'Plugin: ' + k.pluginName : 'Spielsysteme';
        if (g !== lastGroup) { grp = el('optgroup', { label: g }); pick.appendChild(grp); lastGroup = g; }
        const o = el('option', { value: k.key }, k.icon + ' ' + k.label + (UiDesign.has(k.key) ? '  ●' : ''));
        if (k.key === key) o.selected = true;
        grp.appendChild(o);
      }
      const parent = UiDesign.parentOf(key);
      const parentName = parent ? (UiDesign.find(parent) || {}).label : 'Systemfenster';
      // Vorlagen: passende Looks für dieses System (Bilder bleiben erhalten)
      const presetBox = el('div', { class: 'ud-presets' });
      if (UP()) for (const pr of UP().for(key)) {
        const V = Object.assign({}, D, pr.v);
        const sw = el('div', { class: 'ud-sw' + (own.preset === pr.id ? ' on' : '') , title: pr.label, onclick: () => VN.mutate(() => {
          const s = UiDesign.store();
          const keepImgs = (s[key] && s[key].images) || {};
          s[key] = Object.assign({ images: keepImgs, frame: (s[key] || {}).frame || '', panelBg: (s[key] || {}).panelBg || '', screenBg: (s[key] || {}).screenBg || '', sndA: (s[key] || {}).sndA || '' }, pr.v, { preset: pr.id });
        }) });
        const face = el('div', { class: 'ud-sw-face', style: { background: UP().background(V) || VN.hexA(V.bg, 1), borderColor: V.border, color: V.text, borderRadius: Math.min(1.2, (V.radius || 0) * 0.4) + 'em', boxShadow: V.glow ? '0 0 10px ' + VN.hexA(V.accent, 0.45) : '' } },
          el('span', { style: { fontFamily: Theme.fontCss(V.titleFont) || 'Georgia, serif' } }, 'Aa'), el('i', { style: { background: V.accent } }));
        sw.append(face, el('span', { class: 'ud-sw-l' }, pr.label));
        presetBox.appendChild(sw);
      }
      const box = el('div', { class: 'insp' },
        fld('System', pick),
        UP() ? sec('Vorlage', presetBox, el('div', { class: 'muted small' }, 'Passende Looks für dieses System. Danach lässt sich alles unten weiter anpassen.')) : null,
        el('div', { class: 'hint-box' }, 'Leere Felder erben vom Design „' + parentName + '“. ', parent ? null : el('button', { class: 'btn tiny', onclick: () => { VN.ui.designSec = 'sys'; VN.render(); } }, 'Systemfenster öffnen')),
        sec('Farben',
          row(color('Fläche', 'bg'), color('Rand', 'border'), color('Text', 'text')),
          row(color('Akzent / Knöpfe', 'accent'), color('Text auf Akzent', 'accentText')),
          el('div', { class: 'grid2' }, rng('Deckkraft', 'alpha', 0, 100, 1, ' %'), rng('Ecken', 'radius', 0, 6, 0.1, ' cqh')),
          kind && kind.chip ? null : rng('Abdunkeln dahinter', 'dim', 0, 95, 1, ' %'),
          fld('Schrift', fontSel('font', '— wie Systemfenster —')),
          kind && kind.chip ? null : fld('Überschriften', fontSel('titleFont', '— wie Systemfenster —'))));
      if (!(kind && kind.chip)) {
        const fr = sec('Rahmen und Hintergrund',
          textureField('Rahmen (9-Slice)', own.frame || '', (v) => set('frame', v), { builtin: true, emptyLabel: '— erben —', placeholder: D.frame ? 'geerbt' : 'kein Rahmen', hint: Theme.sizeHint(50, 60) }));
        if (D.frame) fr.append(el('div', { class: 'grid2' }, rng('Ecken-Schnitt', 'slice', 1, 49, 1, ' %'), rng('Randbreite', 'frameW', 0.4, 8, 0.1, ' cqh')));
        if (!D.frame && UP()) {
          const ps = el('select', { onchange: (e) => set('pattern', e.target.value) });
          for (const [pk, pv] of Object.entries(UP().PATTERNS)) { const o = el('option', { value: pk }, pv.label); if ((D.pattern || 'none') === pk) o.selected = true; ps.appendChild(o); }
          fr.append(fld('Muster (ohne Bild)', ps),
            el('div', { class: 'grid2' }, rng('Randbreite', 'borderW', 0, 1.2, 0.05, ' cqh'),
              el('label', { class: 'check', style: { alignSelf: 'end' } }, el('input', { type: 'checkbox', checked: !!D.glow, onchange: (e) => set('glow', e.target.checked) }), 'Leuchten')));
        }
        fr.append(
          textureField('Bild im Fenster', own.panelBg || '', (v) => set('panelBg', v), { placeholder: D.panelBg ? 'geerbt' : 'Farbe', hint: Theme.sizeHint(60, 60) }),
          textureField('Hintergrund dahinter', own.screenBg || '', (v) => set('screenBg', v), { placeholder: 'Spielbild', hint: Theme.sizeHint(100, 100) }));
        box.appendChild(fr);
      }
      if (UP() && UP().opts(key).length) {
        const lay = sec('Aufbau des Bildschirms');
        for (const [ok, ol, choices] of UP().opts(key)) {
          const s = el('select', { onchange: (e) => set(ok, e.target.value) });
          for (const [cv, cl] of choices) { const o = el('option', { value: cv }, cl); if ((D[ok] || choices[0][0]) === cv) o.selected = true; s.appendChild(o); }
          lay.appendChild(fld(ol, s));
        }
        box.appendChild(lay);
      }
      if (kind && kind.sounds && kind.sounds.length) {
        const so = sec('Töne', el('div', { class: 'muted small' }, 'Gelten fürs ganze Projekt. Bei einer Figur oder einem einzelnen Meilenstein kannst du eigene Töne wählen – die haben Vorrang.'));
        for (const [sk, sl] of kind.sounds) so.appendChild(fld(sl, el('div', { class: 'row gap4' }, VN.assetSelect('audio', own[sk] || '', (v) => set(sk, v || '')), D[sk] ? el('button', { class: 'btn tiny', onclick: () => { try { const a = new Audio(VN.assetUrl(D[sk])); a.play().catch(() => {}); } catch (e) { /* egal */ } } }, '▶') : null)));
        box.appendChild(so);
      }
      if (kind && kind.images.length) {
        const im = sec('Standard-Bilder', el('div', { class: 'muted small' }, 'Gelten überall, wo an der Aktion selbst kein Bild gewählt ist. Ein Bild direkt an der Aktion hat immer Vorrang.'));
        for (const [ik, il] of kind.images) im.appendChild(textureField(il, (own.images || {})[ik] || '', (v) => setImg(ik, v), { placeholder: D.images[ik] ? 'geerbt' : 'eingebaut' }));
        box.appendChild(im);
      }
      box.appendChild(el('div', { class: 'row gap8' },
        UiDesign.raw(key) ? el('button', { class: 'btn', onclick: () => VN.mutate(() => { delete UiDesign.store()[key]; }) }, 'Zurücksetzen (erben)') : null,
        UiDesign.tryable(key) ? el('button', { class: 'btn primary', onclick: () => UiDesign.tryRun(key) }, '▶ Ausprobieren') : null));
      return box;
    },
    // Live-Vorschau in der Design-Ansicht
    preview(stage) {
      const key = VN.ui.uiDesignKey || 'shop';
      const kind = UiDesign.find(key) || BUILTIN[0];
      if (kind.chip) {
        const chip = el('span', { class: 'money-chip time-chip' }, '🕰 ' + (VN.Life ? VN.Life.timeText({ time: { day: 3, slot: 1 } }) : 'Tag 3 · Mittag'));
        UiDesign.applyChip(key, chip);
        stage.appendChild(el('div', { class: 'pl-hud', style: { top: '1.6cqh' } }, chip));
        return;
      }
      // Spielsysteme mit eigenem Bildschirm: echte Daten zeigen, sonst ein Beispiel (wird nicht gespeichert)
      const hint = (sys) => stage.appendChild(el('div', { class: 'ud-sample' }, VN.t('Beispieldaten zur Vorschau') + ' · ' + VN.t('Eigene Inhalte legst du unter Spielsysteme') + ' → ' + VN.t(sys) + (VN.I18n && VN.I18n.lang === 'en' ? '' : ' an')));
      const sample = (build, show) => {
        const p = VN.project;
        const keep = { skills: p.skills, combat: p.combat, idle: p.idle, currencies: p.currencies };
        const mut = VN.mutate;
        try {
          p.currencies = JSON.parse(JSON.stringify(p.currencies || []));
          VN.mutate = (fn) => fn();
          build(p);
          show();
        } catch (e) { console.error('Design-Vorschau', e); } finally { VN.mutate = mut; Object.assign(p, keep); for (const k of Object.keys(keep)) if (keep[k] === undefined) delete p[k]; }
      };
      if (key === 'idle' && VN.Idle && VN.IdleScreen) {
        const show = () => {
          const rs = VN.newRunState();
          const b0 = VN.Idle.cfg().buildings[0];
          if (b0) { VN.Idle.build(rs, b0, true); VN.Idle.build(rs, b0, true); }
          VN.IdleScreen.open({ host: stage, rs, static: true });
        };
        if (VN.Idle.cfg().buildings.length) show();
        else { sample((p) => { p.idle = undefined; VN.Idle.example(); }, show); hint('Aufbau'); }
        return;
      }
      if (key === 'combat' && VN.Combat && VN.CombatScreen) {
        const show = () => { const b = VN.Combat.cfg().battles.find((x) => x.enemies.length); VN.CombatScreen.open({ host: stage, rs: VN.newRunState(), battle: b, level: 1, story: false }).preview(); };
        if (VN.Combat.cfg().battles.some((b) => b.enemies.length) && VN.Combat.cfg().party.length) show();
        else { sample((p) => { p.combat = undefined; VN.Combat.example(); }, show); hint('Kampf'); }
        return;
      }
      if (key === 'skills' && VN.Skills && VN.SkillScreen) {
        const show = () => {
          const rs = VN.newRunState();
          for (const c of VN.project.currencies) rs.money[c.id] = 500;
          const t = VN.Skills.trees().find((x) => (x.nodes || []).length);
          if (t.nodes[0]) VN.Skills.buy(rs, t, t.nodes[0], true);
          VN.SkillScreen.open({ host: stage, rs, tree: t.id });
        };
        if (VN.Skills.trees().some((t) => (t.nodes || []).length)) show();
        else {
          sample((p) => {
            p.skills = undefined;
            const c = VN.Skills.cfg();
            if (!p.currencies.length) p.currencies.push({ id: '__g', name: VN.t('Gold'), color: '#e8c86a', start: 0 });
            const nodes = VN.Skills.template('three');
            const fx = [{ type: 'moneyPct', cur: '', pct: 10 }, { type: 'shopDiscount', pct: 5 }, { type: 'relPct', char: '', pct: 10 }];
            nodes.forEach((n, i) => { n.effects = [Object.assign({}, fx[i % 3])]; });
            c.trees.push({ id: '__sample', name: VN.t('Skilltree'), pay: { kind: 'currency', ref: p.currencies[0].id }, respec: 'full', cats: [], nodes });
          }, show);
          hint('Skilltrees');
        }
        return;
      }
      // Echte Bildschirm-Bausteine mit Beispielinhalt (gleiche Klassen wie im Spiel)
      const T = (x) => VN.t(x);
      const qKinds = { q_new: ['📜', 'Neue Quest', 'new'], q_step: ['✓', 'Abschnitt erledigt', 'step'], q_done: ['★', 'Quest abgeschlossen', 'done'], q_series: ['🏆', 'Questreihe abgeschlossen', 'series'], q_fail: ['✗', 'Quest gescheitert', 'fail'], q_all: ['📜', 'Neue Quest', 'new'] };
      if (qKinds[key]) {
        const [ic, title, k] = qKinds[key];
        const box = el('div', { class: 'qn-box k-' + k }, el('div', { class: 'qn-ico ph k-' + k }, ic),
          el('div', { class: 'qn-main' }, el('div', { class: 'qn-kind' }, T(title)), el('div', { class: 'qn-text' }, T('Der verlorene Schlüssel')), k === 'done' || k === 'series' ? el('div', { class: 'qn-rw' }, T('Belohnung') + ': 50 Gold') : null));
        stage.appendChild(el('div', { class: 'qn-wrap pos-top' }, box));
        UiDesign.apply(key, box);
        return;
      }
      if (key === 'relpop') {
        const box = el('div', { class: 'rp-box' }, el('div', { class: 'rp-por ph' }, 'R'),
          el('div', { class: 'rp-main' }, el('div', { class: 'rp-top' }, el('strong', null, 'Ray'), el('span', { class: 'rp-delta' }, '+10')),
            el('div', { class: 'rp-bar' }, el('span', { style: { width: '62%', background: '#e86a9a' } }))));
        stage.appendChild(el('div', { class: 'qn-wrap pos-topleft' }, box));
        UiDesign.apply(key, box);
        return;
      }
      if (key === 'relmsg' || key === 'relnote') {
        const s = window.RelMsg ? RelMsg.sample() : null;
        if (s) {
          const ms = Object.assign({}, s.m, { style: '' });
          const note = RelMsg.note(stage, s.c, ms, true);
          void note;
          if (key === 'relmsg') {
            const M = UiDesign.resolve('relmsg');
            const style = M.oMsg || 'phone';
            const img = ms.image && VN.assetUrl(ms.image) ? el('img', { class: 'rm-img', src: VN.assetUrl(ms.image) }) : null;
            const por = el('div', { class: 'rm-small-por ph' }, (s.c.name || '?').slice(0, 1));
            const panel = style === 'bubble' ? el('div', { class: 'rm-bubble' }, el('div', { class: 'rm-big-por ph' }, (s.c.name || '?').slice(0, 1)), el('div', { class: 'rm-bub-box' }, el('strong', { class: 'rm-name' }, s.c.name), el('div', { class: 'rm-text' }, ms.text), img))
              : style === 'window' ? el('div', { class: 'rm-window' }, el('div', { class: 'rm-win-head' }, por, el('strong', { class: 'rm-name' }, s.c.name)), el('div', { class: 'rm-text' }, ms.text), img)
                : el('div', { class: 'rm-phone' }, el('div', { class: 'rm-ph-notch' }), el('div', { class: 'rm-ph-head' }, por, el('strong', { class: 'rm-name' }, s.c.name)), el('div', { class: 'rm-ph-chat' }, el('div', { class: 'rm-msg' }, ms.text, el('span', { class: 'rm-time' }, VN.t('jetzt'))), img ? el('div', { class: 'rm-msg img' }, img) : null));
            const frame = UiDesign.image('relmsg', 'phone');
            if (frame && style === 'phone') { panel.classList.add('has-frame'); panel.style.setProperty('--rm-frame', `url("${frame}")`); }
            const back = el('div', { class: 'rm-back side-' + (M.oSide || 'right') + ' st-' + style }, panel);
            stage.appendChild(back);
            UiDesign.apply('relmsg', panel, back);
          }
        }
        return;
      }
      if (key === 'galnew') {
        const G = UiDesign.resolve('galnew');
        const imgs = VN.project.assets.filter((a) => a.kind === 'image').slice(0, 4);
        const grid = el('div', { class: 'gal-grid' }, ...[0, 1, 2, 3].map((i) => el('div', { class: 'gal-tile' + (i < 2 ? ' is-new' : ''), style: { backgroundImage: imgs[i] ? `url("${VN.assetUrl(imgs[i].id)}")` : 'none' } }, i < 2 ? el('span', { class: 'gal-new' }, VN.t('Neu')) : null)));
        const body = el('div', { class: 'gal-body', style: { '--gal-new': G.accent || '#ffd84a' } }, el('div', { class: 'gal-filter' }, el('button', { class: 'gal-chip on' }, VN.t('Alle'), el('span', { class: 'gal-chip-new' }, '2')), el('button', { class: 'gal-chip' }, 'Ray', el('span', { class: 'gal-chip-new' }, '2'))), grid);
        body.dataset.oNew = G.oNew || 'both';
        const panel = el('div', { class: 'sys-panel' }, el('div', { class: 'sys-title' }, VN.t('Galerie')), body);
        stage.appendChild(el('div', { class: 'pl-overlay' }, panel));
        return;
      }
      if (key === 'ach') {
        const box = el('div', { class: 'ach-toast' }, el('div', { class: 'ach-ico ph' }, '🏆'), el('div', null, el('div', { class: 'ach-t1' }, T('Erfolg freigeschaltet')), el('strong', null, T('Meisterdieb'))));
        stage.appendChild(box);
        UiDesign.apply(key, box);
        return;
      }
      if (key === 'questlog') {
        const box = el('div', { class: 'ql-screen' });
        const item = (who, name, sub, pct, on) => el('button', { class: 'ql-item' + (on ? ' on' : '') }, el('div', { class: 'ql-who' }, who), el('strong', null, name), el('div', { class: 'ql-sub' }, sub), el('div', { class: 'ql-bar' }, el('span', { style: { width: pct + '%' } })));
        const step = (ok, name, hint) => el('div', { class: 'ql-step' + (ok ? ' ok' : '') }, el('span', { class: 'ql-box' + (ok ? ' ok' : '') }, ok ? '✓' : ''), el('div', null, el('div', { class: 'ql-st-name' }, name), hint ? el('div', { class: 'ql-hint' }, T('Tipp') + ': ' + hint) : null));
        box.append(
          el('div', { class: 'ql-head' }, el('h2', null, T('Questlog')), el('div', { class: 'ql-tabs' }, el('button', { class: 'ql-tab on' }, T('Hauptstory')), el('button', { class: 'ql-tab' }, T('Figuren')), el('button', { class: 'ql-tab' }, T('Erledigt'))), el('div', { style: { flex: '1' } })),
          el('div', { class: 'ql-body' },
            el('div', { class: 'ql-left' }, item(T('Hauptstory'), T('Der verlorene Schlüssel'), T('Abschnitt 2 von 3'), 40, true), item('♥ Ray', T('Rays Vergangenheit'), T('Quest 1 von 3'), 15, false)),
            el('div', { class: 'ql-right' }, el('div', { class: 'ql-path' }, T('Hauptstory') + ' › Quest 1'), el('div', { class: 'ql-title' }, T('Der verlorene Schlüssel')),
              el('div', { class: 'ql-desc' }, T('Irgendwo im Keller liegt der Schlüssel zur Schatzkammer.')),
              el('div', { class: 'ql-steps' }, step(true, T('Den Keller betreten')), step(false, T('Die Truhe öffnen'), T('Ein Dietrich könnte helfen.')), el('div', { class: 'ql-step hidden' }, el('span', { class: 'ql-box dashed' }), '???')),
              el('div', { class: 'ql-foot' }, el('span', null, T('Belohnung') + ': 50 Gold')))),
          el('div', { class: 'ql-bottom' }, el('button', { class: 'sys-btn' }, T('Schließen') + ' (Q)')));
        stage.appendChild(box);
        UiDesign.apply(key, box);
        return;
      }
      if (key === 'map') {
        const box = el('div', { class: 'wm-screen' });
        const fake = el('div', { class: 'wm-box ud-fakemap' });
        const pin = (x, y, label, cls, here) => el('button', { class: 'wm-pin ' + cls + (here ? ' here' : ''), style: { left: x + '%', top: y + '%' } }, el('span', { class: 'wm-dot' }), el('span', { class: 'wm-lbl' }, label), here ? el('span', { class: 'wm-here' }, T('Du bist hier')) : null);
        fake.append(pin(28, 38, T('Gildenquartier'), 'open', true), pin(60, 30, T('Schlosshof'), 'open'), pin(70, 66, T('Hafen'), 'locked'), pin(40, 70, '???', 'unknown'));
        box.append(el('div', { class: 'wm-head' }, el('div', { class: 'wm-crumbs' }, el('strong', { class: 'wm-title' }, T('Weltkarte'))), el('div', { style: { flex: '1' } }), el('button', { class: 'sys-btn wm-close' }, T('Schließen') + ' (M)')),
          el('div', { class: 'wm-area' }, fake));
        stage.appendChild(box);
        UiDesign.apply(key, box);
        return;
      }
      if (key === 'rel' || key === 'gift') {
        const ov2 = el('div', { class: 'pl-overlay' });
        const pn = el('div', { class: 'sys-panel' });
        if (key === 'rel') {
          const row = (n, v, stg, col) => el('div', { class: 'rel-row' }, el('div', { class: 'rel-por ph' }, n.slice(0, 1)),
            el('div', { class: 'rel-main' }, el('div', { class: 'rel-top' }, el('strong', null, n), el('span', { class: 'rel-stage' }, '♥ ' + T(stg))),
              el('div', { class: 'rel-bar' }, el('span', { style: { width: v + '%', background: col } }), el('em', null, v + ' %')),
              el('div', { class: 'rel-next' }, T('Nächste Stufe') + ': ' + T('Vertraut'))));
          pn.append(el('div', { class: 'sys-title' }, T('Beziehungen')), el('div', { class: 'rel-list' }, row('Ray', 62, 'Freund', '#e86a9a'), row('Mira', 28, 'Bekannt', '#6aa8e8')), el('button', { class: 'sys-btn' }, T('Zurück')));
        } else {
          const it = (n, ic) => el('button', { class: 'gift-item' }, el('span', { class: 'gift-img ph' }, ic), el('span', null, T(n)));
          pn.append(el('div', { class: 'sys-title' }, T('Geschenk für') + ' Ray'), el('div', { class: 'gift-grid' }, it('Rose', '🌹'), it('Schokolade', '🍫'), it('Buch', '📕'), it('Ring', '💍')), el('button', { class: 'sys-btn' }, T('Zurück')));
        }
        ov2.appendChild(pn);
        stage.appendChild(ov2);
        UiDesign.apply(key, pn, ov2);
        return;
      }
      const ov = el('div', { class: 'plugin-overlay dim' });
      const panel = el('div', { class: 'plugin-panel', style: { width: '56%' } });
      ov.appendChild(panel);
      const imgs = kind.images.map(([ik, il]) => {
        const u = UiDesign.image(key, ik);
        return el('div', { class: 'ud-pv-img' }, u ? el('div', { class: 'ud-pv-pic', style: { backgroundImage: `url("${u}")` } }) : el('div', { class: 'ud-pv-pic ph' }, '?'), el('span', null, il));
      });
      if (key === 'shop') {
        panel.append(el('div', { class: 'shop-head' }, el('strong', null, 'Laden'), el('span', { style: { flex: '1' } }), VN.project.currencies[0] ? VN.moneyChip(VN.project.currencies[0], 120) : null),
          el('div', { class: 'shop-tabs' }, el('button', { class: 'on' }, 'Kaufen'), el('button', null, 'Verkaufen')),
          el('div', { class: 'shop-grid' }, ...VN.project.items.slice(0, 4).map((it) => el('div', { class: 'shop-item' },
            it.image ? el('div', { class: 'shop-img', style: { backgroundImage: `url("${VN.assetUrl(it.image)}")` } }) : el('div', { class: 'shop-img ph' }, (it.name || '?').slice(0, 2)),
            el('div', { class: 'shop-name' }, it.name), el('div', { class: 'shop-sub' }, (it.value || 10) + ' Gold'), el('button', { class: 'shop-btn' }, 'Kaufen')))),
          el('button', { class: 'shop-close' }, 'Laden verlassen'));
      } else {
        panel.classList.add('mg-panel');
        panel.append(el('div', { class: 'mg-title' }, kind.label), el('div', { class: 'mg-info' }, key === 'rel' ? 'Ray · ♥ Freund' : key === 'gift' ? 'Geschenk für Ray' : 'Beispiel-Fenster'),
          imgs.length ? el('div', { class: 'ud-pv-row' }, ...imgs) : el('div', { class: 'rel-bar', style: { margin: '2cqh 0' } }, el('span', { style: { width: '62%', background: '#e86a9a' } })),
          el('div', { class: 'mg-timebar' }, el('span', { style: { width: '64%' } })),
          el('button', { class: 'btn primary job-btn' }, 'Weiter'));
      }
      stage.appendChild(ov);
      UiDesign.apply(key, panel, ov);
      ov.addEventListener('contextmenu', (e) => e.preventDefault());
    },
    // Ausprobieren: Laden-Vorschau oder ein Minispiel des Plugins
    tryable(key) {
      if (key === 'relmsg' || key === 'relnote') return true;
      if (key === 'shop') return !!(VN.project.shops || []).length;
      const k = UiDesign.find(key);
      return !!(k && k.plugin && UiDesign.actionFor(key));
    },
    actionFor(key) {
      const k = UiDesign.find(key);
      if (!k || !k.plugin) return null;
      const def = VNPlugin.plugins[k.plugin];
      const sub = key.slice(k.plugin.length + 1);
      if (def.actions[sub]) return k.plugin + '.' + sub;
      const first = Object.keys(def.actions)[0];
      return first ? k.plugin + '.' + first : null;
    },
    tryRun(key) {
      if ((key === 'relmsg' || key === 'relnote') && window.RelMsg) { const s = RelMsg.sample(); return RelMsg.preview(s.c, s.m); }
      if (key === 'shop') {
        const shop = VN.project.shops[0];
        const rs = VN.newRunState();
        for (const c of VN.project.currencies) rs.money[c.id] = Math.max(rs.money[c.id], 200);
        return VN.Life.previewShop(shop, rs);
      }
      const ref = UiDesign.actionFor(key);
      if (ref) VNPlugin.tryAction(ref);
    }
  });

  // Rechtsklick auf Fenster mit Design (nur im Editor, nicht im exportierten Spiel)
  document.addEventListener('contextmenu', (e) => {
    const panel = e.target.closest && e.target.closest('[data-design]');
    if (panel) UiDesign.menuFor(panel, e);
  }, true);
})();
