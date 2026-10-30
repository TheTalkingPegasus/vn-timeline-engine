// Editor: Spielsysteme → Kampf (Helden, Gegner, Fähigkeiten, Kämpfe, Gegenstände, Einstellungen, Probekampf, Simulation)
(function () {
  const { el } = VN;
  const CB = () => VN.Combat;
  const S = window.Systems;
  const txt = (v, fn, style, ph) => el('input', { type: 'text', value: v || '', placeholder: ph || '', style: style || null, onchange: (e) => VN.mutate(() => fn(e.target.value)) });
  const num = (v, fn, w, step) => el('input', { type: 'number', value: v != null ? v : '', step: step || 'any', style: { width: w || '64px' }, onchange: (e) => VN.mutate(() => fn(e.target.value === '' ? 0 : Number(e.target.value))) });
  const sel = (v, opts, fn, style) => {
    const s = el('select', { style: style || null, onchange: (e) => VN.mutate(() => fn(e.target.value)) });
    for (const [k, l] of opts) { const o = el('option', { value: k }, l); if (String(k) === String(v == null ? '' : v)) o.selected = true; s.appendChild(o); }
    return s;
  };
  const field = (label, ...kids) => el('label', { class: 'sk-field' }, el('span', { class: 'muted small' }, label), ...kids);
  const check = (v, label, fn, title) => el('label', { class: 'check', title: title || '' }, el('input', { type: 'checkbox', checked: !!v, onchange: (e) => VN.mutate(() => fn(e.target.checked)) }), label);
  const sec = (title, ...kids) => el('div', { class: 'sk-sec' }, el('span', { class: 'sec-title' }, title), ...kids);
  const sceneOpts = (none) => [['', none || '— keine (weiter wie bisher) —'], ...VN.project.scenes.map((s) => [s.id, s.name])];
  const thumb = (f, big) => {
    const u = f.image && VN.assetUrl(f.image);
    return u ? el('span', { class: 'cb-thumb' + (big ? ' big' : ''), style: { backgroundImage: `url("${u}")`, transform: f.flip ? 'scaleX(-1)' : '' } }) : el('span', { class: 'cb-thumb ph' + (big ? ' big' : '') }, f.icon || '?');
  };

  // Liste links + Einstellungen rechts
  const listLayout = (items, selId, setSel, render, addBtns, rowInfo) => {
    const list = el('div', { class: 'cb-elist' });
    for (const x of items) {
      list.appendChild(el('div', { class: 'cb-erow' + (x.id === selId ? ' sel' : '') + (rowInfo(x).bad ? ' bad' : ''), onclick: () => { setSel(x.id); VN.render(); } },
        rowInfo(x).thumb || null, el('div', { class: 'cb-etext' }, el('strong', { 'data-notr': '' }, x.name || '?'), el('span', { class: 'muted small' }, rowInfo(x).sub || ''))));
    }
    if (!items.length) list.appendChild(el('div', { class: 'muted small', style: { padding: '8px' } }, 'Noch nichts angelegt.'));
    const cur = items.find((x) => x.id === selId) || items[0];
    return el('div', { class: 'cb-layout' }, el('div', { class: 'cb-left' }, el('div', { class: 'row gap4', style: { flexWrap: 'wrap' } }, ...addBtns), list),
      cur ? render(cur) : el('div', { class: 'opt-card muted' }, 'Lege links etwas an.'));
  };

  const elemChecks = (f, key, label) => el('div', { class: 'row gap8', style: { flexWrap: 'wrap', alignItems: 'center' } }, el('span', { class: 'muted small', style: { minWidth: '90px' } }, label),
    ...CB().ELEMENTS.filter(([k]) => k).map(([k, l]) => check((f[key] || []).includes(k), l, (on) => { f[key] = (f[key] || []).filter((x) => x !== k); if (on) f[key].push(k); })));

  // ---------- Helden und Gegner ----------
  const fighterBox = (f, side) => {
    const c = CB().cfg();
    const list = side === 'hero' ? c.heroes : c.enemies;
    const probs = CB().fighterProblems(f, side);
    const box = el('div', { class: 'opt-card sk-insp' });
    box.appendChild(el('div', { class: 'row gap8', style: { alignItems: 'center' } }, thumb(f, true), el('strong', { style: { fontSize: '15px' }, 'data-notr': '' }, f.name || '?'), el('div', { class: 'spacer' }),
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const n = JSON.parse(JSON.stringify(f)); n.id = VN.uid(side === 'hero' ? 'hero' : 'foe'); n.name = f.name + ' 2'; list.push(n); VN.ui.cbSel = n.id; }) }, 'Kopieren'),
      el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { const i = list.indexOf(f); list.splice(i, 1); c.party = c.party.filter((x) => x !== f.id); for (const b of c.battles) b.enemies = b.enemies.filter((x) => x !== f.id); VN.ui.cbSel = null; }) }, 'Löschen')));
    if (probs.length) box.appendChild(el('div', { class: 'sk-probs' }, ...probs.map((p) => el('div', null, '⚠ ' + p))));
    box.appendChild(el('div', { class: 'sk-grid2' },
      field('Name', txt(f.name, (v) => { f.name = v; })),
      field('Symbol', txt(f.icon, (v) => { f.icon = v; }, { width: '56px' })),
      field('Bild (Seitenansicht)', VN.assetSelect('image', f.image, (v) => VN.mutate(() => { f.image = v; }))),
      field('Größe %', num(f.scale || 100, (v) => { f.scale = Math.max(20, v || 100); }, '60px', 5)),
      check(f.flip, 'spiegeln', (v) => { f.flip = v; }, side === 'hero' ? 'Helden sollten nach links schauen' : 'Gegner sollten nach rechts schauen')));
    box.appendChild(el('div', { class: 'muted small' }, side === 'hero' ? 'Helden stehen rechts und schauen nach links. Ohne Bild erscheint das Symbol.' : 'Gegner stehen links und schauen nach rechts. Ohne Bild erscheint das Symbol.'));
    box.appendChild(sec(side === 'hero' ? 'Werte auf Stufe 1' : 'Werte',
      el('div', { class: 'sk-grid2' }, ...CB().STATS.map(([k, l]) => field(l, num(f[k], (v) => { f[k] = Math.max(0, v); }, '58px', 1))))));
    if (side === 'hero') {
      const lv = [1, 5, 10, 20].map((l) => VN.t('Stufe') + ' ' + l + ': ' + CB().heroStat(f, 'hp', l) + ' ' + VN.t('LP') + ', ' + CB().heroStat(f, 'atk', l) + ' ' + VN.t('Angriff'));
      box.appendChild(el('div', { class: 'muted small' }, lv.join(' · ')));
      box.appendChild(el('div', { class: 'sk-grid2' },
        field('Startstufe', num(f.lvl || 1, (v) => { f.lvl = Math.max(1, Math.round(v || 1)); }, '56px', 1)),
        field('Stufe in Variable schreiben', sel(f.levelVar || '', [['', '— nein —'], ...VN.project.vars.filter((v) => v.type !== 'flag').map((v) => [v.id, v.name])], (v) => { f.levelVar = v; })),
        check(c.party.includes(f.id), 'in der Startgruppe', (on) => { c.party = c.party.filter((x) => x !== f.id); if (on) c.party.push(f.id); })));
      box.appendChild(el('div', { class: 'muted small' }, 'Tipp: Schreibt der Held seine Stufe in eine Variable, kann ein Skilltree bei jedem Stufenaufstieg Punkte geben.'));
    } else {
      box.appendChild(el('div', { class: 'sk-grid2' },
        field('Verhalten', sel(f.ai || 'random', CB().AI, (v) => { f.ai = v; })),
        field('EP', num(f.xp, (v) => { f.xp = v; }, '56px', 1)),
        field('Geld', num(f.gold, (v) => { f.gold = v; }, '56px', 1)),
        field('Beute (Loot-Tabelle)', sel(f.loot || '', [['', '— keine —'], ...VN.project.lootTables.map((t) => [t.id, t.name])], (v) => { f.loot = v; }))));
    }
    box.appendChild(elemChecks(f, 'weak', 'Schwach gegen'));
    box.appendChild(elemChecks(f, 'resist', 'Resistent gegen'));
    // Fähigkeiten
    const skl = el('div', { class: 'cb-chips' });
    (f.skills || []).forEach((s, i) => {
      const ab = CB().skill(s.id);
      skl.appendChild(el('span', { class: 'sk-chip' + (ab ? '' : ' bad') }, ab ? (ab.icon || '') + ' ' + ab.name : '?',
        side === 'hero' ? el('span', { class: 'muted small' }, ' ab St.') : null, side === 'hero' ? num(s.at || 1, (v) => { s.at = Math.max(1, Math.round(v || 1)); }, '44px', 1) : null,
        el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { f.skills.splice(i, 1); }) }, '×')));
    });
    const add = sel('', [['', '+ Fähigkeit …'], ...CB().cfg().skills.filter((a) => !(f.skills || []).some((s) => s.id === a.id)).map((a) => [a.id, (a.icon || '') + ' ' + a.name])], (v) => { if (v) f.skills.push({ id: v, at: 1 }); });
    box.appendChild(sec('Fähigkeiten', skl, el('div', { class: 'row gap8' }, add, el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const a = CB().newSkill(); c.skills.push(a); f.skills.push({ id: a.id, at: 1 }); VN.ui.cbTab = 'skills'; VN.ui.cbSel = a.id; }) }, '+ neue Fähigkeit'))));
    if (side === 'enemy') {
      const used = c.battles.filter((b) => b.enemies.includes(f.id));
      box.appendChild(el('div', { class: 'muted small' }, used.length ? VN.t('Kommt vor in') + ': ' + used.map((b) => b.name).join(', ') : 'Noch in keinem Kampf.'));
    }
    return box;
  };
  const fighters = (body, side) => {
    const c = CB().cfg();
    const list = side === 'hero' ? c.heroes : c.enemies;
    body.appendChild(listLayout(list, VN.ui.cbSel, (id) => { VN.ui.cbSel = id; }, (f) => fighterBox(f, side),
      [el('button', { class: 'btn tiny primary', onclick: () => VN.mutate(() => { const f = CB().newFighter(side); list.push(f); if (side === 'hero' && c.party.length < (c.maxParty || 4)) c.party.push(f.id); VN.ui.cbSel = f.id; }) }, side === 'hero' ? '+ Held' : '+ Gegner')],
      (f) => ({ thumb: thumb(f), sub: VN.t('LP') + ' ' + f.hp + ' · ' + VN.t('Angriff') + ' ' + f.atk + (side === 'hero' ? (c.party.includes(f.id) ? ' · ' + VN.t('Startgruppe') : '') : ' · ' + (f.xp || 0) + ' ' + VN.t('EP')), bad: CB().fighterProblems(f, side).length > 0 })));
  };

  // ---------- Fähigkeiten ----------
  const skillBox = (a) => {
    const c = CB().cfg();
    const box = el('div', { class: 'opt-card sk-insp' });
    const users = [...c.heroes, ...c.enemies].filter((f) => (f.skills || []).some((s) => s.id === a.id));
    box.appendChild(el('div', { class: 'row gap8', style: { alignItems: 'center' } }, el('strong', { style: { fontSize: '15px' }, 'data-notr': '' }, (a.icon || '') + ' ' + (a.name || '?')), el('div', { class: 'spacer' }),
      el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { c.skills = c.skills.filter((x) => x !== a); for (const f of [...c.heroes, ...c.enemies]) f.skills = f.skills.filter((s) => s.id !== a.id); VN.ui.cbSel = null; }) }, 'Löschen')));
    box.appendChild(el('div', { class: 'sk-grid2' },
      field('Name', txt(a.name, (v) => { a.name = v; })),
      field('Symbol', txt(a.icon, (v) => { a.icon = v; }, { width: '56px' })),
      field('Art', sel(a.kind, CB().KINDS, (v) => { a.kind = v; if (v === 'heal' || v === 'buff' || v === 'revive') a.target = a.target === 'all' || a.target === 'allies' ? 'allies' : 'ally'; else if (a.target === 'ally' || a.target === 'allies' || a.target === 'self') a.target = 'one'; })),
      field('Ziel', sel(a.target, CB().TARGETS, (v) => { a.target = v; }))));
    box.appendChild(field('Beschreibung (im Spiel)', el('textarea', { rows: 2, class: 'sk-desc', onchange: (e) => VN.mutate(() => { a.desc = e.target.value; }) }, a.desc || '')));
    const g = el('div', { class: 'sk-grid2' });
    if (a.kind === 'buff' || a.kind === 'debuff') g.append(field('Wert', sel(a.stat || 'atk', CB().STATS.filter(([k]) => k !== 'hp' && k !== 'mp'), (v) => { a.stat = v; })), field(a.kind === 'buff' ? '+ %' : '− %', num(a.amount, (v) => { a.amount = v; }, '56px', 5)), field('Runden', num(a.turns, (v) => { a.turns = Math.max(1, Math.round(v || 1)); }, '56px', 1)));
    else g.append(field(a.kind === 'revive' ? 'LP danach %' : 'Stärke %', num(a.power, (v) => { a.power = v; }, '64px', 5)));
    g.append(field('MP-Kosten', num(a.mp, (v) => { a.mp = Math.max(0, v); }, '56px', 1)));
    if (a.kind === 'phys' || a.kind === 'magic') g.append(field('Element', sel(a.element || '', CB().ELEMENTS, (v) => { a.element = v; })));
    box.appendChild(g);
    box.appendChild(el('div', { class: 'muted small' }, a.kind === 'phys' ? 'Rechnet mit Angriff gegen Abwehr. 100 % = normaler Angriff.' : a.kind === 'magic' ? 'Rechnet mit Magie. Element trifft Schwächen (×1,5) und Resistenzen (×0,5).' : a.kind === 'heal' ? 'Heilt etwa Magie × 1,5 × Stärke.' : a.kind === 'revive' ? 'Holt bewusstlose Verbündete zurück.' : 'Wirkt für einige Runden, Pfeile über der Figur zeigen es an.'));
    box.appendChild(sec('Animation & Ton',
      el('div', { class: 'sk-grid2' },
        field('Effekt', sel(a.fx || 'auto', CB().FX, (v) => { a.fx = v; })),
        field('Eigenes Effekt-Bild (statt Effekt)', VN.assetSelect('image', a.fxImage, (v) => VN.mutate(() => { a.fxImage = v; }))),
        field('Ton', VN.assetSelect('audio', a.sound, (v) => VN.mutate(() => { a.sound = v; })))),
      el('div', { class: 'muted small' }, 'Eigene Bilder (z. B. ein PNG mit Feuerball) erscheinen kurz groß über dem Ziel. So lassen sich alle Effekte austauschen.')));
    box.appendChild(el('div', { class: 'muted small' }, users.length ? VN.t('Können') + ': ' + users.map((f) => f.name).join(', ') : 'Noch niemand hat diese Fähigkeit.'));
    return box;
  };

  // ---------- Kämpfe ----------
  const simBox = (b) => {
    const box = el('div', { class: 'cb-sim' });
    const res = VN.ui.cbSim && VN.ui.cbSim.id === b.id ? VN.ui.cbSim : null;
    if (res) {
      const r = res.main;
      const lab = r.rate >= 90 ? ['Leicht', 'ok'] : r.rate >= 65 ? ['Mittel', 'mid'] : r.rate >= 35 ? ['Schwer', 'hard'] : ['Sehr schwer', 'bad'];
      box.appendChild(el('div', { class: 'cb-simhead' }, el('span', { class: 'cb-diff ' + lab[1] }, VN.t(lab[0])),
        el('span', null, VN.t('Sieg in') + ' ' + r.rate + ' % · ' + VN.t('im Schnitt') + ' ' + String(r.rounds).replace('.', VN.I18n && VN.I18n.lang === 'en' ? '.' : ',') + ' ' + (VN.I18n && VN.I18n.lang === 'en' ? 'turns' : 'Runden') + (r.win ? ' · ' + r.hp + ' % ' + VN.t('LP übrig') : ''))));
      const bars = el('div', { class: 'cb-bars' });
      for (const x of res.sweep) bars.appendChild(el('div', { class: 'cb-bar' + (x.lvl === res.lvl ? ' on' : ''), title: VN.t('Stufe') + ' ' + x.lvl + ': ' + x.rate + ' %' }, el('i', { style: { height: Math.max(3, x.rate) + '%' } }), el('span', null, String(x.lvl))));
      box.appendChild(el('div', { class: 'muted small' }, VN.t('Siegchance nach Stufe der Gruppe (Startgruppe, kluges Verhalten):')));
      box.appendChild(bars);
    }
    return box;
  };
  const battleBox = (b) => {
    const c = CB().cfg();
    const probs = CB().battleProblems(b);
    const box = el('div', { class: 'opt-card sk-insp' });
    box.appendChild(el('div', { class: 'row gap8', style: { alignItems: 'center' } }, el('strong', { style: { fontSize: '15px' }, 'data-notr': '' }, '⚔ ' + (b.name || '?')), el('div', { class: 'spacer' }),
      el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { c.battles = c.battles.filter((x) => x !== b); VN.ui.cbSel = null; }) }, 'Löschen')));
    if (probs.length) box.appendChild(el('div', { class: 'sk-probs' }, ...probs.map((p) => el('div', null, '⚠ ' + p))));
    // Test
    const lvl = Math.max(1, Number(VN.ui.cbLvl) || 1);
    box.appendChild(el('div', { class: 'cb-testrow' },
      field('Gruppe auf Stufe', el('input', { type: 'number', min: 1, value: lvl, style: { width: '56px' }, onchange: (e) => { VN.ui.cbLvl = Math.max(1, Number(e.target.value) || 1); VN.render(); } })),
      el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!VN.ui.cbStory, onchange: (e) => { VN.ui.cbStory = e.target.checked; } }), 'Story-Modus'),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn tiny primary', disabled: !b.enemies.length || !c.party.length, onclick: () => window.Player && Player.tryBattle && Player.tryBattle(b.id, lvl, VN.ui.cbStory) }, '▶ Probekampf'),
      el('button', { class: 'btn tiny', disabled: !b.enemies.length || !c.party.length, title: 'Lässt den Kampf 100-mal automatisch laufen', onclick: async (e) => {
        // In Häppchen rechnen, damit der Editor dabei bedienbar bleibt
        if (VN.ui.cbSimBusy) return;
        VN.ui.cbSimBusy = true;
        const btn = e.currentTarget;
        btn.disabled = true;
        const tick = () => new Promise((r) => setTimeout(r, 0));
        const story = VN.ui.cbStory;
        try {
          btn.textContent = '⏳ 0 %';
          await tick();
          const main = CB().simulate(b, { level: lvl, story, n: 100 });
          const sweep = [];
          const from = Math.max(1, lvl - 4);
          for (let l = from; l < from + 10; l++) {
            btn.textContent = '⏳ ' + Math.round((l - from + 1) * 10) + ' %';
            await tick();
            sweep.push(Object.assign({ lvl: l }, CB().simulate(b, { level: l, story, n: 40 })));
          }
          VN.ui.cbSim = { id: b.id, main, sweep, lvl };
        } finally { VN.ui.cbSimBusy = false; }
        VN.render();
      } }, '📊 100× simulieren')));
    box.appendChild(simBox(b));
    box.appendChild(el('div', { class: 'sk-grid2' },
      field('Name', txt(b.name, (v) => { b.name = v; })),
      field('Hintergrund', VN.assetSelect('image', b.bg, (v) => VN.mutate(() => { b.bg = v; }))),
      field('Musik', VN.assetSelect('audio', b.music, (v) => VN.mutate(() => { b.music = v || ''; }))),
      check(b.canFlee !== false, 'Fliehen erlaubt', (v) => { b.canFlee = v; })));
    box.appendChild(el('div', { class: 'muted small' }, 'Ohne Hintergrund bleibt das Bild der Szene sichtbar. Ohne Musik gilt die Kampfmusik aus den Einstellungen.'));
    // Gegner
    const foes = el('div', { class: 'cb-chips' });
    b.enemies.forEach((id, i) => { const f = CB().enemy(id); foes.appendChild(el('span', { class: 'sk-chip' + (f ? '' : ' bad') }, f ? thumb(f) : null, f ? f.name : '?', el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { b.enemies.splice(i, 1); }) }, '×'))); });
    box.appendChild(sec('Gegner (bis 6)', foes, b.enemies.length < 6 ? sel('', [['', '+ Gegner …'], ...c.enemies.map((f) => [f.id, f.name])], (v) => { if (v) b.enemies.push(v); }) : null));
    // Ausgänge
    box.appendChild(sec('Sieg', el('div', { class: 'sk-grid2' }, field('Danach zur Szene', sel(b.win.scene || '', sceneOpts(), (v) => { b.win.scene = v; }))), VN.actionEditor(b.win.actions, 'Beim Sieg ausführen')));
    box.appendChild(sec('Niederlage', el('div', { class: 'sk-grid2' },
      field('Danach zur Szene', sel(b.lose.scene || '', sceneOpts('— keine —'), (v) => { b.lose.scene = v; })),
      !b.lose.scene ? field('Ohne Szene', sel(b.lose.mode || 'end', [['end', 'Spielende (Game Over)'], ['continue', 'Geschichte geht weiter']], (v) => { b.lose.mode = v; })) : null),
      el('div', { class: 'muted small' }, 'Spieler können nach einer Niederlage immer „Nochmal versuchen“ (auch im Story-Modus).'),
      VN.actionEditor(b.lose.actions, 'Bei Niederlage ausführen')));
    if (b.canFlee !== false) box.appendChild(sec('Flucht', el('div', { class: 'sk-grid2' }, field('Danach zur Szene', sel(b.flee.scene || '', sceneOpts(), (v) => { b.flee.scene = v; })))));
    const where = VN.project.scenes.filter((s) => CB().actionsIn(s).some((a) => a.type === 'battle' && a.battle === b.id));
    box.appendChild(el('div', { class: 'muted small' }, where.length ? VN.t('Gestartet in') + ': ' + where.map((s) => s.name).join(', ') : 'Noch nirgends gestartet. Füge an einem Dialog, einer Antwort oder einem Hub-Objekt die Aktion „⚔ Kampf starten“ hinzu.'));
    return box;
  };

  // ---------- Gegenstände ----------
  const itemsView = (body) => {
    const p = VN.project;
    const box = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Gegenstände im Kampf'), el('div', { class: 'muted small' }, 'Gegenstände mit einer Wirkung erscheinen im Kampf unter „Gegenstände“ und werden beim Benutzen verbraucht.'));
    if (!p.items.length) box.appendChild(el('div', { class: 'muted small' }, 'Lege zuerst unter „Items“ Gegenstände an (z. B. Heiltrank).'));
    for (const it of p.items) {
      const f = it.fight || {};
      box.appendChild(el('div', { class: 'row gap8 cb-itrow', style: { alignItems: 'end', flexWrap: 'wrap' } },
        el('strong', { style: { minWidth: '140px' }, 'data-notr': '' }, it.name),
        field('Wirkung', sel(f.kind || '', [['', '— nicht im Kampf —'], ['heal', 'LP heilen'], ['mp', 'MP auffüllen'], ['revive', 'Wiederbeleben (% LP)'], ['dmg', 'Schaden an Gegnern']], (v) => { it.fight = v ? Object.assign({ amount: v === 'revive' ? 30 : v === 'mp' ? 15 : 40, all: false }, it.fight || {}, { kind: v }) : null; })),
        f.kind ? field(f.kind === 'revive' ? '% LP' : 'Menge', num(f.amount, (v) => { f.amount = v; }, '60px', 1)) : null,
        f.kind ? check(f.all, 'wirkt auf alle', (v) => { f.all = v; }) : null,
        f.kind === 'dmg' ? field('Element', sel(f.element || '', CB().ELEMENTS, (v) => { f.element = v; })) : null));
    }
    body.appendChild(box);
  };

  // ---------- Einstellungen ----------
  const settingsView = (body) => {
    const c = CB().cfg();
    const p = VN.project;
    body.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Gruppe und Stufen'),
      el('div', { class: 'sk-grid2' },
        field('Größe der Gruppe', sel(String(c.maxParty || 4), [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], (v) => { c.maxParty = Number(v); })),
        field('Wachstum pro Stufe %', num(c.growth, (v) => { c.growth = v; }, '60px', 1)),
        field('EP für Stufe 2', num(c.xpBase, (v) => { c.xpBase = Math.max(1, v); }, '60px', 1)),
        field('Höchste Stufe', num(c.maxLevel, (v) => { c.maxLevel = Math.max(1, v); }, '60px', 1))),
      el('div', { class: 'muted small' }, VN.t('EP bis zur nächsten Stufe') + ': ' + [1, 2, 3, 5, 10].map((l) => VN.t('St.') + ' ' + l + ' → ' + CB().xpNeed(l)).join(' · ')),
      el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } }, el('span', { class: 'muted small' }, 'Startgruppe:'),
        ...c.heroes.map((h) => check(c.party.includes(h.id), h.name, (on) => { c.party = c.party.filter((x) => x !== h.id); if (on) c.party.push(h.id); })))));
    body.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Regeln'),
      el('div', { class: 'sk-grid2' },
        field('Nach dem Kampf', sel(c.heal || 'full', [['full', 'Gruppe ist wieder fit'], ['keep', 'LP und MP bleiben wie sie sind']], (v) => { c.heal = v; })),
        field('Fluchtchance %', num(c.flee, (v) => { c.flee = Math.max(0, Math.min(100, v)); }, '60px', 5)),
        field('Geld der Gegner in', sel(c.currency || '', [['', 'erste Währung'], ...p.currencies.map((x) => [x.id, x.name])], (v) => { c.currency = v; })),
        field('Tempo der Animationen', sel(String(c.speed || 1), [['0.75', 'ruhig'], ['1', 'normal'], ['1.5', 'schnell'], ['2', 'sehr schnell']], (v) => { c.speed = Number(v); })),
        check(c.story !== false, 'Story-Modus anbieten', (v) => { c.story = v; }, 'Spieler können in den Einstellungen leichtere Kämpfe wählen'),
        check(c.partyInMenu !== false, 'Gruppe im Pausenmenü (Esc) anzeigen', (v) => { c.partyInMenu = v; }, 'Aus: nur über Taste G'))));
    const snd = c.sounds || (c.sounds = {});
    body.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Musik und Töne'),
      el('div', { class: 'sk-grid2' },
        field('Kampfmusik', VN.assetSelect('audio', c.music, (v) => VN.mutate(() => { c.music = v || ''; }))),
        field('Sieg', VN.assetSelect('audio', c.winMusic, (v) => VN.mutate(() => { c.winMusic = v || ''; }))),
        field('Niederlage', VN.assetSelect('audio', c.loseMusic, (v) => VN.mutate(() => { c.loseMusic = v || ''; })))),
      el('div', { class: 'sk-grid2' },
        field('Treffer', VN.assetSelect('audio', snd.hit, (v) => VN.mutate(() => { snd.hit = v; }))),
        field('Magie', VN.assetSelect('audio', snd.magic, (v) => VN.mutate(() => { snd.magic = v; }))),
        field('Heilung', VN.assetSelect('audio', snd.heal, (v) => VN.mutate(() => { snd.heal = v; }))),
        field('K.O.', VN.assetSelect('audio', snd.ko, (v) => VN.mutate(() => { snd.ko = v; })))),
      el('div', { class: 'muted small' }, 'Eine Fähigkeit mit eigenem Ton spielt diesen statt der Standardtöne.')));
  };

  // ---------- Reiter ----------
  const TABS = [['heroes', 'Helden'], ['enemies', 'Gegner'], ['skills', 'Fähigkeiten'], ['battles', 'Kämpfe'], ['items', 'Gegenstände'], ['settings', 'Einstellungen']];
  S.combatTab = (body) => {
    const c = CB().cfg();
    body.appendChild(el('p', { class: 'muted' }, 'Kampf wie in klassischen Rollenspielen: rundenbasiert, Seitenansicht, Gruppe aus bis zu vier Helden. Gestartet wird ein Kampf mit der Aktion „⚔ Kampf starten“ – an einem Dialog, einer Antwort oder einem Hub-Objekt. Sieg, Niederlage und Flucht führen in eigene Szenen; „⚔ Kampf gewonnen“ fragt das Ergebnis später ab.'));
    const iss = CB().issues();
    if (iss.length) body.appendChild(Help.sysBox(iss));
    if (!c.heroes.length && !c.enemies.length && !c.battles.length) {
      body.appendChild(el('div', { class: 'hint-box' }, 'Noch leer. Am schnellsten geht es mit dem Beispiel: drei Helden, drei Gegner, sieben Fähigkeiten und zwei Kämpfe – alles änderbar.',
        el('div', { class: 'row gap8', style: { marginTop: '8px' } }, el('button', { class: 'btn primary', onclick: () => { VN.ui.cbTab = 'battles'; CB().example(); } }, 'Beispiel anlegen'), el('button', { class: 'btn', onclick: () => VN.mutate(() => { const h = CB().newFighter('hero'); c.heroes.push(h); c.party.push(h.id); VN.ui.cbTab = 'heroes'; VN.ui.cbSel = h.id; }) }, 'Leer beginnen'))));
      return;
    }
    let tab = VN.ui.cbTab || 'battles';
    const nav = el('div', { class: 'row gap4', style: { flexWrap: 'wrap', alignItems: 'center' } });
    for (const [k, l] of TABS) nav.appendChild(el('button', { class: 'btn tiny' + (tab === k ? ' primary' : ''), onclick: () => { VN.ui.cbTab = k; VN.ui.cbSel = null; VN.render(); } }, l));
    nav.appendChild(el('div', { class: 'spacer' }));
    nav.appendChild(el('button', { class: 'btn tiny', onclick: () => window.UiDesign && UiDesign.edit('combat') }, '🎨 Design des Kampfes'));
    body.appendChild(nav);
    if (tab === 'heroes') fighters(body, 'hero');
    else if (tab === 'enemies') fighters(body, 'enemy');
    else if (tab === 'skills') body.appendChild(listLayout(c.skills, VN.ui.cbSel, (id) => { VN.ui.cbSel = id; }, skillBox,
      [el('button', { class: 'btn tiny primary', onclick: () => VN.mutate(() => { const a = CB().newSkill(); c.skills.push(a); VN.ui.cbSel = a.id; }) }, '+ Fähigkeit')],
      (a) => ({ thumb: el('span', { class: 'cb-thumb ph' }, a.icon || '✦'), sub: VN.t((CB().KINDS.find((k) => k[0] === a.kind) || ['', ''])[1]) + ' · ' + (a.mp || 0) + ' ' + VN.t('MP') })));
    else if (tab === 'battles') body.appendChild(listLayout(c.battles, VN.ui.cbSel, (id) => { VN.ui.cbSel = id; }, battleBox,
      [el('button', { class: 'btn tiny primary', onclick: () => VN.mutate(() => { const b = CB().newBattle(); if (c.enemies[0]) b.enemies.push(c.enemies[0].id); c.battles.push(b); VN.ui.cbSel = b.id; }) }, '+ Kampf')],
      (b) => ({ thumb: el('span', { class: 'cb-thumb ph' }, '⚔️'), sub: b.enemies.map((id) => (CB().enemy(id) || {}).name || '?').join(', ') || VN.t('keine Gegner'), bad: CB().battleProblems(b).length > 0 })));
    else if (tab === 'items') itemsView(body);
    else settingsView(body);
  };

  // Übersicht: Schalter
  if (VN.Life) {
    const base = VN.Life.extraSwitches;
    VN.Life.extraSwitches = (card, set) => {
      const out = base ? base(card, set) : [];
      out.push(card('⚔', 'Kampf', 'Rundenbasierte Kämpfe in Seitenansicht mit Gruppe, Fähigkeiten, Stufen, Beute und Story-Modus. Probekampf und 100×-Simulation im Editor.', CB().on(), set((v) => { CB().cfg().enabled = v; }), 'combat'));
      return out;
    };
  }
})();
