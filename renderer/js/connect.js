// Verknüpfen ohne Umwege: Rechtsklick auf ein Hub-Objekt → „Verbinden mit …“ und „Bausteine …“.
// Legt die passenden Aktionen und Klick-Regeln an, damit niemand Variablen-Tricks bauen muss.
(function () {
  const el = (...a) => VN.el(...a);
  const Connect = (window.Connect = {});
  const P = () => VN.project;
  const on = (k) => { const d = VN.ext.actions[k]; return !!(d && (!d.on || d.on())); };

  // Alles, womit ein Objekt verbunden werden kann (nur eingeschaltete Systeme)
  Connect.options = () => {
    const p = P(), out = [];
    const add = (icon, label, make, extra) => out.push(Object.assign({ icon, label, make }, extra || {}));
    if (on('idleScreen')) add('🏰', VN.t(p.idle.title || 'Aufbau') + ' ' + VN.t('öffnen'), () => ({ type: 'idleScreen' }));
    if (on('skillScreen')) for (const t of VN.Skills.trees()) add('🌳', VN.t('Skilltree') + ' „' + t.name + '“', () => ({ type: 'skillScreen', tree: t.id }));
    if (on('questLog')) add('📜', VN.t('Questlog öffnen'), () => ({ type: 'questLog' }));
    if (on('openMap')) add('🗺', VN.t('Karte öffnen'), () => ({ type: 'openMap' }));
    add('🎒', VN.t('Inventar öffnen'), () => ({ type: 'screen', screen: 'inv' }));
    if (VN.Life && VN.Life.relOn()) {
      add('♥', VN.t('Beziehungen anzeigen'), () => ({ type: 'relScreen' }));
      if (VN.Life.giftsOn()) for (const c of p.relations.chars) add('🎁', VN.tf('Geschenk für {name}', { name: c.name }), () => ({ type: 'gift', char: c.id }));
    }
    if (p.economy && p.economy.enabled) for (const sh of p.shops || []) add('🛒', VN.t('Laden') + ' „' + sh.name + '“', () => ({ type: 'shop', shop: sh.id }));
    if (on('battle')) for (const b of VN.Combat.cfg().battles) add('⚔', VN.t('Kampf') + ' „' + b.name + '“', () => ({ type: 'battle', battle: b.id }));
    if (on('travel')) for (const s of VN.World.locs()) add('📍', VN.tf('Gehe zu {name}', { name: s.name }), () => ({ type: 'travel', scene: s.id }));
    if (p.gallery && p.gallery.enabled) add('🖼', VN.t('Galerie öffnen'), () => ({ type: 'screen', screen: 'gallery' }));
    add('🏆', VN.t('Erfolge öffnen'), () => ({ type: 'screen', screen: 'ach' }));
    add('📊', VN.t('Werte öffnen'), () => ({ type: 'screen', screen: 'stats' }));
    if (window.VNPlugin) for (const [ref, label] of VNPlugin.actionList()) {
      const def = VNPlugin.actionDef(ref);
      add('🧩', label, () => { const params = {}; for (const pa of (def && def.params) || []) params[pa.key] = pa.default != null ? pa.default : ''; return { type: 'plugin', ref, params }; }, { plugin: true });
    }
    return out;
  };

  // Gleiche Aktion schon vorhanden?
  const same = (a, b) => a.type === b.type && JSON.stringify(Object.assign({}, a, { params: null })) === JSON.stringify(Object.assign({}, b, { params: null }));
  Connect.connect = (s, o, opt) => VN.mutate(() => {
    o.actions = o.actions || [];
    const a = opt.make();
    if (!o.actions.some((x) => same(x, a))) o.actions.push(a);
    VN.ui.sel = o.id;
  });

  Connect.menu = (x, y, s, o) => {
    const opts = Connect.options();
    VN.menu(x, y, [
      { head: VN.tf('„{name}“ verbinden mit …', { name: o.name || VN.t('Objekt') }) },
      ...opts.filter((q) => !q.plugin).map((q) => ({ label: q.icon + '  ' + q.label, action: () => Connect.connect(s, o, q) })),
      opts.some((q) => q.plugin) ? 'sep' : null,
      ...opts.filter((q) => q.plugin).map((q) => ({ label: q.icon + '  ' + q.label, hint: 'Plugin', action: () => Connect.connect(s, o, q) })),
      'sep',
      { label: VN.t('Weitere Systeme einschalten …'), action: () => { VN.ui.view = 'systems'; VN.ui.sysTab = 'overview'; VN.render(); } }
    ]);
  };

  // ---------- Bausteine ----------
  Connect.blocks = (x, y, s, o) => {
    const p = P();
    VN.menu(x, y, [
      { head: VN.t('Bausteine') + ' · ' + (o.name || VN.t('Objekt')) },
      { label: '💰  ' + VN.t('Wird gekauft …'), hint: VN.t('Preis, Rückfrage, nur einmal'), disabled: !p.currencies.length, action: () => Connect.buyDialog(s, o) },
      { label: '1×  ' + VN.t('Nur einmal anklickbar (verschwindet danach)'), action: () => VN.mutate(() => { o.once = 'hide'; VN.ui.sel = o.id; }) },
      { label: '1×  ' + VN.t('Nur einmal wirksam (bleibt sichtbar)'), action: () => VN.mutate(() => { o.once = 'keep'; if (!o.doneMsg) o.doneMsg = VN.t('Hier gibt es nichts mehr zu tun.'); VN.ui.sel = o.id; }) },
      { label: '🎁  ' + VN.t('Gibt einen Gegenstand (einmal)'), disabled: !p.items.length, action: () => VN.mutate(() => { o.actions = o.actions || []; o.actions.push({ type: 'giveItem', item: p.items[0].id, count: 1 }); o.once = o.once || 'keep'; if (!o.doneMsg) o.doneMsg = VN.t('Hier ist nichts mehr.'); VN.ui.sel = o.id; }) },
      { label: '♥  ' + VN.t('Gibt Beziehungspunkte (einmal)'), disabled: !(VN.Life && VN.Life.relOn() && p.relations.chars.length), action: () => VN.mutate(() => { o.actions = o.actions || []; o.actions.push({ type: 'rel', char: p.relations.chars[0].id, amount: 10 }); o.once = o.once || 'keep'; VN.ui.sel = o.id; }) },
      'sep',
      { label: '🔗  ' + VN.t('Verbinden mit …'), action: () => Connect.menu(x, y, s, o) }
    ]);
  };

  // „Wird gekauft …“: was, Preis, was danach passiert
  Connect.buyDialog = (s, o) => {
    const p = P();
    const kinds = [];
    if (VN.Idle && VN.Idle.on()) for (const b of VN.Idle.cfg().buildings) kinds.push({ id: 'b:' + b.id, label: '🏰 ' + VN.t('Gebäude') + ': ' + b.name, apply: () => { b.unlockBy = 'action'; b.hideLocked = true; return [{ type: 'idleUnlock', building: b.id, build: true }]; }, name: b.name });
    for (const it of p.items) kinds.push({ id: 'i:' + it.id, label: '🎒 ' + VN.t('Gegenstand') + ': ' + it.name, apply: () => [{ type: 'giveItem', item: it.id, count: 1 }], name: it.name });
    if (VN.World && VN.World.on()) for (const l of VN.World.locs()) kinds.push({ id: 'l:' + l.id, label: '📍 ' + VN.t('Ort freischalten') + ': ' + l.name, apply: () => { l.loc.unlock = 'action'; return [{ type: 'unlockLoc', scene: l.id, value: true }]; }, name: l.name });
    if (VN.Skills && VN.Skills.on()) for (const pt of VN.Skills.cfg().points) kinds.push({ id: 'sp:' + pt.id, label: '🌳 ' + pt.name + ' +1', apply: () => [{ type: 'skillPoints', pt: pt.id, amount: 1 }], name: pt.name });
    kinds.push({ id: 'none', label: '✎ ' + VN.t('Nur bezahlen (Aktionen selbst wählen)'), apply: () => [], name: o.name });
    const st = { kind: kinds[0].id, cur: p.currencies[0].id, amount: 100, after: 'hide', confirm: true };
    const back = el('div', { class: 'modal-back', onclick: (ev) => { if (ev.target === back) back.remove(); } });
    const sel = (v, opts, fn) => el('select', { class: 'sel', onchange: (e) => fn(e.target.value) }, ...opts.map(([k, l]) => el('option', { value: k, selected: k === v }, l)));
    back.appendChild(el('div', { class: 'modal cn-modal' },
      el('strong', { style: { fontSize: '16px' } }, '💰 ' + VN.tf('„{name}“ wird gekauft', { name: o.name || VN.t('Objekt') })),
      el('div', { class: 'muted small' }, VN.t('Der Spieler klickt das Objekt an, bestätigt den Kauf, das Geld wird abgezogen und es passiert, was du hier wählst. Ohne Variablen, ohne Bedingungen.')),
      el('label', { class: 'field' }, el('span', null, VN.t('Was wird gekauft?')), sel(st.kind, kinds.map((k) => [k.id, k.label]), (v) => { st.kind = v; })),
      el('div', { class: 'row gap8' },
        el('label', { class: 'field', style: { flex: '1' } }, el('span', null, VN.t('Preis')), el('input', { type: 'number', min: 1, value: st.amount, onchange: (e) => { st.amount = Math.max(1, Number(e.target.value) || 1); } })),
        el('label', { class: 'field', style: { flex: '1' } }, el('span', null, VN.t('Währung')), sel(st.cur, p.currencies.map((c) => [c.id, c.name]), (v) => { st.cur = v; }))),
      el('label', { class: 'field' }, el('span', null, VN.t('Nach dem Kauf')), sel(st.after, [['hide', VN.t('Objekt verschwindet')], ['keep', VN.t('Objekt bleibt, Klick zeigt „Gehört dir schon“')], ['', VN.t('Kann immer wieder gekauft werden')]], (v) => { st.after = v; })),
      el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: true, onchange: (e) => { st.confirm = e.target.checked; } }), VN.t('Vor dem Kauf nachfragen („… kaufen?“ mit Ja/Nein)')),
      el('div', { class: 'row gap8', style: { justifyContent: 'flex-end' } },
        el('button', { class: 'btn', onclick: () => back.remove() }, VN.t('Abbrechen')),
        el('button', { class: 'btn primary', onclick: () => {
          const k = kinds.find((x) => x.id === st.kind);
          VN.mutate(() => {
            o.price = { cur: st.cur, amount: st.amount };
            o.confirm = st.confirm;
            o.once = st.after;
            if (st.after === 'keep') o.doneMsg = VN.t('Das gehört dir schon.');
            if (k && k.name && (!o.name || /^Objekt/.test(o.name))) o.name = k.name;
            o.buyWhat = k && k.id !== 'none' ? k.name : '';
            o.actions = o.actions || [];
            for (const a of k.apply()) if (!o.actions.some((x) => same(x, a))) o.actions.push(a);
            VN.ui.sel = o.id;
          });
          back.remove();
          VN.toast(VN.t('Kauf eingerichtet – mit „Spiel testen“ ausprobieren'));
        } }, VN.t('Einrichten')))));
    document.body.appendChild(back);
  };

  // ---------- Klick-Regeln im Inspector ----------
  Connect.rulesUI = (o) => {
    const p = P();
    const box = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, VN.t('Klick-Regeln')));
    const sel = (v, opts, fn) => el('select', { class: 'sel', onchange: (e) => VN.mutate(() => fn(e.target.value)) }, ...opts.map(([k, l]) => el('option', { value: k, selected: k === v }, l)));
    box.appendChild(el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, VN.t('Wie oft')),
      sel(o.once || '', [['', VN.t('beliebig oft')], ['hide', VN.t('nur einmal, dann verschwinden')], ['keep', VN.t('nur einmal, bleibt sichtbar')]], (v) => { o.once = v; })));
    if (o.once === 'keep') box.appendChild(el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, VN.t('Danach')), el('input', { type: 'text', value: o.doneMsg || '', placeholder: VN.t('Meldung beim erneuten Klick (optional)'), style: { flex: '1' }, onchange: (e) => VN.mutate(() => { o.doneMsg = e.target.value; }) })));
    const pr = o.price || {};
    if (p.currencies.length) {
      box.appendChild(el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, VN.t('Preis')),
        el('input', { type: 'number', min: 0, value: pr.amount || 0, style: { width: '72px' }, onchange: (e) => VN.mutate(() => { const n = Math.max(0, Number(e.target.value) || 0); o.price = n ? { cur: pr.cur || p.currencies[0].id, amount: n } : null; }) }),
        sel(pr.cur || p.currencies[0].id, p.currencies.map((c) => [c.id, c.name]), (v) => { o.price = { cur: v, amount: pr.amount || 0 }; })));
      if (pr.amount > 0) box.appendChild(el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: o.confirm !== false, onchange: (e) => VN.mutate(() => { o.confirm = e.target.checked; }) }), VN.t('Vor dem Kauf nachfragen')));
      if (pr.amount > 0) box.appendChild(el('div', { class: 'muted small' }, VN.t('Hat der Spieler zu wenig Geld, erscheint eine Meldung und nichts passiert.')));
    }
    box.appendChild(el('div', { class: 'row gap4', style: { marginTop: '6px', flexWrap: 'wrap' } },
      el('button', { class: 'btn tiny', onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); Connect.menu(r.left, r.bottom + 4, VN.curScene(), o); } }, '🔗 ' + VN.t('Verbinden mit …')),
      el('button', { class: 'btn tiny', onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); Connect.blocks(r.left, r.bottom + 4, VN.curScene(), o); } }, '🧱 ' + VN.t('Bausteine …'))));
    return box;
  };

  // Kleine Symbole am Objekt im Editor: womit es verbunden ist
  const ICON = { idleScreen: '🏰', idleUnlock: '🏰', idleBuild: '🏰', skillScreen: '🌳', questLog: '📜', openMap: '🗺', relScreen: '♥', rel: '♥', gift: '🎁', shop: '🛒', battle: '⚔', travel: '📍', unlockLoc: '📍', giveItem: '🎒', loot: '🎲', money: '🪙', plugin: '🧩', screen: '📋' };
  Connect.badges = (o) => {
    const set = [];
    if (o.price && Number(o.price.amount) > 0) set.push('💰');
    if (o.once) set.push('1×');
    for (const a of o.actions || []) { const ic = ICON[a.type]; if (ic && !set.includes(ic)) set.push(ic); }
    if (o.target) set.push('➜');
    return set;
  };

  // Umweg erkennen: Bedingung „Geld ≥ X“ + Aktion „Geld −X“ → Preis
  Connect.detours = () => {
    const out = [];
    for (const s of P().scenes) {
      if (s.type !== 'hub') continue;
      for (const o of s.objects || []) {
        const mc = (o.conds || []).find((c) => c.type === 'money' && (c.op || '>=') === '>=' && Number(c.amount) > 0);
        const ma = mc && (o.actions || []).find((a) => a.type === 'money' && a.currency === mc.currency && Number(a.amount) < 0);
        if (!mc || !ma || o.price) continue;
        out.push({ level: 'tip', area: 'Abkürzungen', topic: 'detourPrice', key: 'detour:' + o.id,
          text: VN.tf('„{obj}“ in „{scene}“ prüft Geld und zieht es dann ab. Dafür gibt es jetzt den Preis direkt am Objekt – mit Rückfrage und Meldung bei zu wenig Geld.', { obj: o.name || VN.t('Objekt'), scene: s.name }),
          go: () => { App.openScene(s.id); VN.ui.sel = o.id; VN.render(); },
          fixes: [{ label: 'Auf Preis umstellen', primary: true, run: () => VN.mutate(() => { o.price = { cur: mc.currency, amount: Math.abs(Number(ma.amount)) }; o.confirm = true; o.conds = o.conds.filter((c) => c !== mc); o.actions = o.actions.filter((a) => a !== ma); }) }] });
      }
    }
    return out;
  };
  if (window.Help) {
    Help.sources.push(Connect.detours);
    Help.topic('detourPrice', {
      title: 'Kaufen ohne Umweg',
      what: 'Früher musste man für einen Kauf zwei Dinge bauen: eine Bedingung „Geld ≥ 500“ und eine Aktion „Geld −500“. Das geht jetzt mit einem Feld: Preis.',
      why: 'Die Engine hat erkannt, dass ein Objekt genau diesen Umweg benutzt.',
      fix: ['„Auf Preis umstellen“ drücken – Bedingung und Geld-Aktion werden durch den Preis ersetzt.', 'Danach fragt das Spiel vor dem Kauf nach und meldet, wenn das Geld nicht reicht.'],
      examples: [{ title: 'Bäckerei kaufen', steps: ['Rechtsklick auf das Haus im Hub → Bausteine → „Wird gekauft …“.', 'Bei „Was wird gekauft?“ die Bäckerei wählen, Preis 500 Gold.', 'Einrichten – fertig. Im Aufbau erscheint die Bäckerei nach dem Kauf.'] }],
      ideas: ['Ein Haus kaufen, das danach als neuer Ort auf der Karte erscheint.', 'Ein Händler, bei dem man einmalig eine Schatzkarte kaufen kann.']
    });
    Help.topic('idleUnlock', {
      title: 'Gebäude wird nirgends freigeschaltet',
      what: 'Das Gebäude ist auf „Durch Aktion“ gestellt, aber keine Aktion „🏰 Gebäude freischalten“ zeigt darauf. Spieler bekommen es nie.',
      why: 'Die Engine sucht im ganzen Projekt nach der passenden Aktion.',
      fix: ['Rechtsklick auf ein Hub-Objekt → Bausteine → „Wird gekauft …“ → das Gebäude wählen.', 'Oder bei einer Antwort, einem Quest-Abschluss oder Aufbau-Ziel die Aktion „🏰 Gebäude freischalten“ hinzufügen.', 'Oder das Gebäude wieder auf „Von Anfang an / mit Bedingung“ stellen.'],
      ideas: ['Belohnung für eine Quest: der Bürgermeister schenkt dir das Sägewerk.', 'Ein Gebäude erst nach einem gewonnenen Kampf freischalten.']
    });
  }
})();
