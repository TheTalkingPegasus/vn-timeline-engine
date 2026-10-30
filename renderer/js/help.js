// Hilfemeldungen: jede Prüfung im Editor sagt, was los ist, schlägt Lösungen vor (Knöpfe)
// und hat ein 💡-Fenster mit Erklärung, Beispielen und Ideen.
// Stufen: error = Spiel geht kaputt (rot), warn = funktioniert nicht wie gedacht (gelb), tip = Hinweis (blau).
(function () {
  const el = (...a) => VN.el(...a);
  const Help = (window.Help = {});
  const LV = { error: { icon: '⛔', label: 'Fehler' }, warn: { icon: '⚠', label: 'Achtung' }, tip: { icon: 'ℹ', label: 'Tipp' } };

  // ---------- Ausgeblendete Hinweise (pro Projekt gespeichert) ----------
  Help.hidden = (key) => !!(key && VN.project && (VN.project.hiddenHints || []).includes(key));
  Help.hide = (key) => VN.mutate(() => { const p = VN.project; p.hiddenHints = Array.isArray(p.hiddenHints) ? p.hiddenHints : []; if (!p.hiddenHints.includes(key)) p.hiddenHints.push(key); });
  Help.unhideAll = () => VN.mutate(() => { VN.project.hiddenHints = []; });

  // ---------- Eine Meldung als Kasten ----------
  // issue: { level, text, detail?, fixes?: [{ label, run, primary? }], topic?, key?, go? }
  Help.box = (iss, opts) => {
    const lv = LV[iss.level] ? iss.level : 'warn';
    const o = opts || {};
    const fixes = (iss.fixes || []).filter(Boolean);
    const btns = [];
    for (const f of fixes) btns.push(el('button', { class: 'btn tiny' + (f.primary ? ' primary' : ''), onclick: (e) => { e.stopPropagation(); f.run(); } }, VN.t(f.label)));
    if (iss.go && !o.noGo) btns.push(el('button', { class: 'btn tiny', onclick: (e) => { e.stopPropagation(); iss.go(); } }, VN.t('Zur Stelle')));
    if (iss.key) btns.push(el('button', { class: 'btn tiny ghost', title: VN.t('Diese Meldung nicht mehr zeigen (unter Fehlerliste wieder einblendbar)'), onclick: (e) => { e.stopPropagation(); Help.hide(iss.key); } }, VN.t('Nicht mehr zeigen')));
    return el('div', { class: 'hb hb-' + lv },
      el('div', { class: 'hb-head' },
        el('span', { class: 'hb-ic' }, LV[lv].icon),
        el('div', { class: 'hb-text' }, iss.text, iss.detail ? el('div', { class: 'hb-detail' }, iss.detail) : null),
        iss.topic && Help.topics[iss.topic] ? el('button', { class: 'hb-bulb', title: VN.t('Erklärung und Beispiele'), onclick: (e) => { e.stopPropagation(); Help.open(iss.topic, iss); } }, '💡') : null),
      btns.length ? el('div', { class: 'hb-fixes' }, ...btns) : null);
  };
  // Mehrere Meldungen (ausgeblendete fallen weg)
  Help.list = (issues, opts) => issues.filter((i) => !Help.hidden(i.key)).map((i) => Help.box(i, opts));

  // ---------- 💡-Fenster ----------
  Help.topics = {};
  Help.topic = (key, t) => { Help.topics[key] = t; };
  Help.open = (key, iss) => {
    const t = Help.topics[key];
    if (!t) return;
    const back = el('div', { class: 'modal-back', onclick: (ev) => { if (ev.target === back) back.remove(); } });
    const sec = (title, items, cls) => items && items.length ? el('div', { class: 'hm-sec ' + (cls || '') }, el('div', { class: 'hm-h' }, VN.t(title)), ...items.map((x) => typeof x === 'string' ? el('div', { class: 'hm-li' }, VN.t(x)) : x)) : null;
    const ex = (t.examples || []).map((e) => el('div', { class: 'hm-ex' }, el('div', { class: 'hm-ex-t' }, VN.t(e.title)), el('div', { class: 'hm-steps' }, ...(e.steps || []).map((s, i) => el('div', { class: 'hm-step' }, el('span', { class: 'hm-n' }, String(i + 1)), el('span', null, VN.t(s)))))));
    const fixes = iss && (iss.fixes || []).filter(Boolean);
    back.appendChild(el('div', { class: 'modal hm-modal' },
      el('div', { class: 'row gap8' }, el('span', { style: { fontSize: '22px' } }, '💡'), el('strong', { style: { flex: '1', fontSize: '16px' } }, VN.t(t.title)), el('button', { class: 'btn', onclick: () => back.remove() }, VN.t('Schließen'))),
      iss ? el('div', { class: 'hm-cur hb-' + (iss.level || 'warn') }, iss.text) : null,
      sec('Was bedeutet das?', [t.what]),
      sec('Warum kommt die Meldung?', [t.why]),
      sec('So wird die Meldung behoben', t.fix),
      ex.length ? sec('Beispiele', ex) : null,
      sec('Ideen, was du daraus machen kannst', t.ideas, 'hm-ideas'),
      fixes && fixes.length ? el('div', { class: 'hb-fixes', style: { marginTop: '4px' } }, ...fixes.map((f) => el('button', { class: 'btn' + (f.primary ? ' primary' : ''), onclick: () => { back.remove(); f.run(); } }, VN.t(f.label)))) : null));
    document.body.appendChild(back);
  };

  // ---------- Alle Meldungen des Projekts ----------
  const toSys = (tab, extra) => () => { VN.ui.view = 'systems'; VN.ui.sysTab = tab; if (extra) extra(); VN.render(); };
  const sysIssues = (list, tab, area) => (list || []).map((x) => Object.assign({ level: x.level || 'warn', area, topic: x.topic || 'system', go: x.scene ? () => App.openScene(x.scene.id) : toSys(tab) }, x));
  Help.sources = [];      // weitere Prüfungen (z. B. von Systemen oder Plugins): () => [issue]
  Help.all = () => {
    const p = VN.project;
    if (!p) return [];
    const out = [];
    // Szenen
    const reach = VN.reachable();
    for (const s of p.scenes) if (!reach.has(s.id)) out.push({ level: 'warn', area: 'Pfade', topic: 'unreachable', key: 'unreach:' + s.id, text: VN.tf('Szene „{name}“ ist vom Start aus nicht erreichbar.', { name: s.name }), go: () => App.openScene(s.id),
      fixes: [{ label: 'Im Pfade-Plan zeigen', run: () => { VN.ui.view = 'graph'; VN.ui.graphSel = s.id; VN.render(); } }, { label: 'Als Startszene festlegen', run: () => VN.mutate(() => { p.startScene = s.id; }) }] });
    for (const s of p.scenes) {
      if (s.type !== 'story') continue;
      for (const c of s.tracks.choice || []) for (const o of c.options) if (!o.target && c.start >= s.beats - 1 && !s.next) out.push({ level: 'warn', area: 'Pfade', topic: 'deadChoice', text: VN.tf('Antwort „{a}“ in „{s}“ führt nirgendwohin – das Spiel endet dort.', { a: o.text || '…', s: s.name }), go: () => { App.openScene(s.id); VN.ui.sel = c.id; VN.render(); } });
    }
    for (const i of VN.condIssues()) out.push({ level: 'error', area: 'Bedingungen', topic: 'brokenCond', text: VN.tf('Kaputte Bedingung ({where}): {what} – gilt im Spiel als nicht erfüllt.', { where: (i.scene ? i.scene.name : VN.t('Projekt')) + (i.where ? ' · „' + String(i.where).slice(0, 30) + '“' : ''), what: VN.t(i.text) }), go: i.scene ? () => App.openScene(i.scene.id) : null });
    // Systeme
    if (VN.World) out.push(...sysIssues(VN.World.issues(), 'world', 'Welt & Orte'));
    if (VN.Quests) out.push(...sysIssues(VN.Quests.issues(), 'quests', 'Quests'));
    if (VN.Skills) out.push(...sysIssues(VN.Skills.issues(), 'skills', 'Skilltrees'));
    if (VN.Combat) out.push(...sysIssues(VN.Combat.issues(), 'combat', 'Kampf'));
    if (VN.Idle) out.push(...sysIssues(VN.Idle.issues(), 'idle', 'Aufbau'));
    if (VN.Life && VN.Life.relIssues) out.push(...VN.Life.relIssues());
    for (const src of Help.sources) { try { out.push(...(src() || [])); } catch (e) { console.error('Hilfe-Prüfung', e); } }
    return out;
  };
  Help.visible = () => Help.all().filter((i) => !Help.hidden(i.key));

  // ---------- Fehlerliste (Knopf oben) ----------
  let badgeT = 0;
  Help.badgeSoon = () => { clearTimeout(badgeT); badgeT = setTimeout(Help.badge, 400); };
  Help.badge = () => {
    const b = document.getElementById('b-issues');
    if (!b || !VN.project) return;
    let list = [];
    try { list = Help.visible(); } catch (e) { console.error(e); }
    const n = { error: 0, warn: 0, tip: 0 };
    for (const i of list) n[i.level] = (n[i.level] || 0) + 1;
    b.className = 'btn ghost issues-btn' + (n.error ? ' has-error' : n.warn ? ' has-warn' : '');
    b.textContent = n.error || n.warn ? (n.error ? '⛔ ' + n.error + ' ' : '') + (n.warn ? '⚠ ' + n.warn : '') : '✓';
    b.title = VN.t(list.length ? 'Fehlerliste: alle Hinweise zum Projekt' : 'Keine Probleme gefunden');
  };
  Help.panel = () => {
    const back = el('div', { class: 'modal-back', onclick: (ev) => { if (ev.target === back) back.remove(); } });
    const draw = () => {
      back.innerHTML = '';
      const all = Help.all();
      const vis = all.filter((i) => !Help.hidden(i.key));
      const hiddenN = all.length - vis.length;
      const order = { error: 0, warn: 1, tip: 2 };
      vis.sort((a, b) => (order[a.level] - order[b.level]) || String(a.area || '').localeCompare(String(b.area || '')));
      const close = () => back.remove();
      const wrap = (i) => Object.assign({}, i, { go: i.go ? () => { close(); i.go(); } : null, fixes: (i.fixes || []).map((f) => f && Object.assign({}, f, { run: () => { f.run(); setTimeout(draw, 50); } })) });
      back.appendChild(el('div', { class: 'modal hl-modal' },
        el('div', { class: 'row gap8' }, el('strong', { style: { flex: '1', fontSize: '16px' } }, VN.t('Fehlerliste')), el('button', { class: 'btn', onclick: close }, VN.t('Schließen'))),
        el('div', { class: 'hl-legend' }, el('span', { class: 'hb-error' }, '⛔ ' + VN.t('Fehler: das Spiel geht kaputt')), el('span', { class: 'hb-warn' }, '⚠ ' + VN.t('Achtung: funktioniert nicht wie gedacht')), el('span', { class: 'hb-tip' }, 'ℹ ' + VN.t('Tipp'))),
        vis.length ? el('div', { class: 'hl-list' }, ...vis.map((i) => el('div', null, i.area ? el('div', { class: 'hl-area' }, VN.t(i.area)) : null, Help.box(wrap(i))))) : el('div', { class: 'hint-box' }, '✓ ' + VN.t('Keine Probleme gefunden. Alles, was die Engine prüfen kann, ist in Ordnung.')),
        hiddenN ? el('div', { class: 'row gap8' }, el('span', { class: 'muted small', style: { flex: '1' } }, VN.tf('{n} ausgeblendete Hinweise', { n: hiddenN })), el('button', { class: 'btn tiny', onclick: () => { Help.unhideAll(); setTimeout(draw, 50); } }, VN.t('Wieder einblenden'))) : null));
    };
    draw();
    document.body.appendChild(back);
  };

  // ---------- Erklärungen ----------
  Help.topic('unreachable', {
    title: 'Szene nicht erreichbar',
    what: 'Keine Antwort, kein „Danach weiter zu“, kein Hub-Objekt und keine Aktion führt vom Start aus zu dieser Szene. Spieler sehen sie nie.',
    why: 'Die Engine verfolgt alle Wege ab der Startszene. Kommt sie nirgends bei dieser Szene an, erscheint die Meldung.',
    fix: ['Eine Antwort, ein Hub-Objekt oder „Danach weiter zu“ auf diese Szene zeigen lassen.', 'Oder die Szene als Startszene festlegen, wenn das Spiel hier beginnen soll.', 'Ist es eine Szene, die du nur zum Testen angelegt hast, kannst du die Meldung ausblenden.'],
    examples: [{ title: 'Szene an eine Antwort hängen', steps: ['Szene mit der Auswahl öffnen.', 'Auf die Antwort klicken.', 'Rechts bei „Ziel“ die Szene wählen.'] },
      { title: 'Szene von einem Hub aus öffnen', steps: ['Hub-Szene öffnen und ein Objekt anlegen (z. B. eine Tür).', 'Bei „Beim Klick“ die Aktion „Zu Szene springen“ wählen.', 'Die Szene auswählen.'] }],
    ideas: ['Geheime Szenen: nur erreichbar, wenn eine Variable gesetzt ist (z. B. alle Truhen geöffnet).', 'Extras im Hauptmenü: Bonus-Szenen nach dem Abspann.']
  });
  Help.topic('deadChoice', {
    title: 'Antwort ohne Ziel',
    what: 'Die Antwort steht im letzten Schritt der Szene und die Szene hat kein „Danach weiter zu“. Wählt der Spieler sie, ist das Spiel zu Ende.',
    why: 'Nach dem letzten Schritt weiß die Engine nicht, wohin es gehen soll.',
    fix: ['Der Antwort ein Ziel geben.', 'Oder der Szene ein „Danach weiter zu“ geben.', 'Soll das wirklich ein Ende sein, ist alles richtig – dann einfach so lassen.'],
    examples: [{ title: 'Ziel für eine Antwort', steps: ['Auf die Auswahl in der Timeline klicken.', 'Bei der Antwort rechts „Ziel“ wählen.'] }],
    ideas: ['Mehrere Enden: jede Antwort führt zu einer eigenen Schluss-Szene.']
  });
  Help.topic('brokenCond', {
    title: 'Kaputte Bedingung',
    what: 'Eine „Nur wenn“-Bedingung verweist auf etwas, das es nicht mehr gibt – z. B. eine gelöschte Variable, Figur oder einen Gegenstand.',
    why: 'Die Engine kann sie nicht prüfen. Im Spiel gilt sie deshalb als nicht erfüllt, und was daran hängt, erscheint nie.',
    fix: ['Mit „Zur Stelle“ hinspringen und in der Bedingung das Fehlende neu auswählen.', 'Oder die Bedingung entfernen, wenn sie nicht mehr gebraucht wird.'],
    ideas: []
  });
  Help.topic('relPoints', {
    title: 'Beziehungsstufe nicht erreichbar',
    what: 'Die Engine zählt alle ♥-Punkte zusammen, die eine Figur im ganzen Spiel bekommen kann – Startwert plus jede Stelle, an der es Punkte gibt. Liegt eine Stufe mit Belohnung darüber, kann kein Spieler sie erreichen.',
    why: 'Das ist kein Deckel: Im Spiel steigt der Wert immer bis 100 %. Es fehlen nur noch Stellen, an denen es Punkte gibt. Während du baust, ist das normal.',
    fix: ['Mehr ♥-Punkte vergeben – in Antworten, Dialogen, Hub-Objekten, Quests, Aufbau-Zielen, Kämpfen, Ereignissen oder Skilltrees.', 'Oder die Stufe niedriger setzen.', 'Oder die Meldung für diese Figur ausblenden, solange du noch baust.'],
    examples: [{ title: 'Punkte in einer Antwort', steps: ['Szene mit Auswahl öffnen und die Antwort anklicken.', 'Rechts bei „♥ Beziehung“ die Figur wählen und z. B. +10 eintragen.'] },
      { title: 'Punkte als Belohnung im Aufbau', steps: ['Spielsysteme → Aufbau → Ziele.', 'Bei einem Ziel unter „Beim Erreichen ausführen“ die Aktion „♥ Beziehung ändern“ hinzufügen.', 'Figur wählen und Punkte eintragen.'] },
      { title: 'Punkte an einem Hub-Objekt', steps: ['Hub-Szene öffnen, Objekt anklicken.', 'Bei „Beim Klick“ die Aktion „♥ Beziehung ändern“ hinzufügen.', 'Am besten mit „Nur einmal“, sonst kann man Punkte sammeln.'] }],
    ideas: ['Punkte für Geschenke: „Geschenke“ einschalten, dann kann man beliebig oft Punkte sammeln.', 'Punkte in Kämpfen: die Figur freut sich, wenn man gemeinsam gewinnt.', 'Minuspunkte für schlechte Antworten machen Entscheidungen spannender.']
  });
  Help.topic('system', {
    title: 'Problem in einem Spielsystem',
    what: 'Bei einem Spielsystem (Karte, Quest, Skilltree, Kampf, Aufbau) fehlt etwas oder passt nicht zusammen.',
    why: 'Die Engine prüft jedes eingeschaltete System, ob es so im Spiel funktionieren kann.',
    fix: ['Mit „Zur Stelle“ hinspringen. Was genau fehlt, steht in der Meldung.', 'Wird ein System gar nicht gebraucht, kannst du es unter Spielsysteme ausschalten – dann verschwinden auch seine Meldungen.'],
    ideas: []
  });

  // Kasten mit den Problemen eines Spielsystems (oben im jeweiligen Reiter)
  Help.sysBox = (iss) => {
    const list = iss.map((x) => Object.assign({ level: x.level || 'warn', topic: x.topic || 'system' }, x, { go: x.scene ? () => App.openScene(x.scene.id) : null })).filter((x) => !Help.hidden(x.key));
    const shown = list.slice(0, 6);
    return el('div', { class: 'hb-group' }, ...shown.map((x) => Help.box(x)),
      list.length > shown.length ? el('button', { class: 'btn tiny', onclick: () => Help.panel() }, VN.tf('… und {n} weitere in der Fehlerliste', { n: list.length - shown.length })) : null);
  };

  // Englische Texte der Erklärungen laufen über VN.t (Wörterbuch)
})();
