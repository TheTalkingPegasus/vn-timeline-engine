// Editor: Spielsysteme → Quests (Zeilen wie im Entwurf: Figur/Story · Name · Bedingung · Belohnung · Prüfung),
// Einblendungen (Position, Animation, Zersplittern, Jingles) und Beziehungs-Einblendung.
(function () {
  const { el } = VN;
  const Q = () => VN.Quests;
  const S = window.Systems;
  const txt = (v, fn, style, ph) => el('input', { type: 'text', value: v || '', placeholder: ph || '', style: style || null, onchange: (e) => VN.mutate(() => fn(e.target.value)) });
  const num = (v, fn, w, attrs) => el('input', Object.assign({ type: 'number', value: v != null ? v : '', style: { width: w || '64px' }, onchange: (e) => VN.mutate(() => fn(Number(e.target.value))) }, attrs || {}));
  const chk = (v, fn) => el('input', { type: 'checkbox', checked: !!v, onchange: (e) => VN.mutate(() => fn(e.target.checked)) });
  const sel = (v, opts, fn, style) => {
    const s = el('select', { style: style || null, onchange: (e) => VN.mutate(() => fn(e.target.value)) });
    for (const [k, l] of opts) { const o = el('option', { value: k }, l); if (String(k) === String(v == null ? '' : v)) o.selected = true; s.appendChild(o); }
    return s;
  };
  const field = (label, input) => el('div', { class: 'field' }, el('div', { class: 'lbl' }, label), input);
  const tag = (t, bad, title) => el('span', { class: 'qtag' + (bad ? ' bad' : ''), title: title || '' }, t);
  // Mögliche „Figuren“: Beziehungs-Figuren und alle Sprecher
  const whoOpts = () => {
    const names = new Set();
    if (VN.project.relations) for (const c of VN.project.relations.chars || []) names.add(c.name);
    for (const s of VN.project.scenes) if (s.type === 'story') for (const d of s.tracks.dialog) if ((d.speaker || '').trim()) names.add(d.speaker.trim());
    return [['story', '📖 Hauptstory'], ...Array.from(names).map((n) => [n, '♥ ' + n])];
  };
  const newStep = (n) => ({ id: VN.uid('qs'), name: VN.t('Abschnitt ') + n, hint: '', conds: [], reward: [], hidden: false });
  const newQuest = (n) => ({ id: VN.uid('qq'), name: 'Quest ' + n, desc: '', order: 'seq', conds: [], fail: [], reward: [], steps: [] });

  S.questsTab = (body) => {
    const c = Q().cfg();
    const list = c.list;
    const refs = new Set();
    (function walk(o) { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); if (/^quest(Step|Done|Fail)$/.test(o.type || '') && o.ref) refs.add(o.ref); for (const k in o) if (o[k] && typeof o[k] === 'object') walk(o[k]); })([VN.project.scenes, VN.project.items, VN.project.world && VN.project.world.events]);
    const open = VN.ui.qOpen = VN.ui.qOpen || {};
    const issues = Q().issues();
    body.appendChild(el('p', { class: 'muted' }, 'Questreihen bestehen aus Quests, Quests aus Abschnitten. Alles erledigt sich selbst, sobald die Bedingung erfüllt ist („hat Gegenstand Rose“, „Szene gesehen“, „♥ Ray ab Freund“ …) – oder per Aktion „📜 Abschnitt erledigt“ an einer Dialogzeile, Antwort oder einem Hub-Objekt. Spieler öffnen den Questlog mit Taste ' + (c.key || 'Q').toUpperCase() + '.'));
    const head = el('div', { class: 'row gap8', style: { alignItems: 'center', marginBottom: '8px' } },
      el('strong', { style: { fontSize: '15px' } }, 'Quests'),
      el('span', { class: 'muted small' }, list.length + ' Reihen · ' + list.reduce((n, s) => n + (s.quests || []).length, 0) + ' Quests · ' + list.reduce((n, s) => n + (s.quests || []).reduce((m, q) => m + (q.steps || []).length, 0), 0) + ' Abschnitte'),
      issues.length ? el('span', { class: 'qtag bad', title: issues.map((i) => i.text).join('\n') }, issues.length + (issues.length === 1 ? ' Problem' : ' Probleme')) : el('span', { class: 'qtag ok' }, 'alles in Ordnung'),
      el('div', { style: { flex: '1' } }),
      el('button', { class: 'btn', onclick: () => VN.mutate(() => { const q = newQuest(1); q.name = VN.t('Neue Quest'); const s = { id: VN.uid('qr'), who: 'story', name: VN.t('Neue Quest'), single: true, startMode: 'auto', start: [], reward: [], quests: [q] }; list.push(s); VN.ui.qSel = q.id; }) }, '+ Quest'),
      el('button', { class: 'btn primary', onclick: () => VN.mutate(() => { const s = { id: VN.uid('qr'), who: 'story', name: VN.t('Neue Questreihe'), single: false, startMode: 'auto', start: [], reward: [], quests: [newQuest(1)] }; list.push(s); open[s.id] = true; VN.ui.qSel = s.id; }) }, '+ Questreihe'));
    body.appendChild(head);

    const wrap = el('div', { class: 'q-wrap' });
    const table = el('div', { class: 'q-table' }, el('div', { class: 'q-row head' }, el('span'), el('span', null, 'Figur / Story'), el('span', null, 'Name'), el('span', null, 'Bedingung zum Abschließen'), el('span', null, 'Belohnung'), el('span', null, 'Prüfung')));
    const condCell = (conds, extra, bad) => el('div', { class: 'q-cell' }, ...(conds && conds.length ? conds.map((cd) => tag(VN.condText(cd), !!VN.condProblem(cd), VN.condProblem(cd) || '')) : []), extra ? tag(extra, bad) : null);
    const rewCell = (rw) => el('div', { class: 'q-cell' }, ...(rw && rw.length ? rw.map((a) => tag(VN.actionText(a), !!VN.actionProblem(a), VN.actionProblem(a) || '')) : [el('span', { class: 'muted small' }, 'keine')]));
    const check = (pr) => { const t = Object.values(pr); return t.length ? el('span', { class: 'q-err', title: t.join('\n') }, t.length === 1 ? t[0].replace(/ \(.*\)$/, '') : t.length + ' Probleme') : el('span', { class: 'q-ok' }, 'in Ordnung'); };
    const rowEl = (cls, id, cells, pr) => el('div', { class: 'q-row ' + cls + (Object.keys(pr).length ? ' bad' : '') + (VN.ui.qSel === id ? ' sel' : ''), onclick: (e) => { if (e.target.closest('input,select,button')) return; VN.ui.qSel = id; VN.render(); } }, ...cells, check(pr));
    for (const s of list) {
      const spr = Q().rowProblems(s, 'series', s, refs);
      const whoSel = sel(s.who || 'story', whoOpts().concat(s.who && s.who !== 'story' && !whoOpts().some(([k]) => k === s.who) ? [[s.who, '⚠ ' + s.who]] : []), (v) => { s.who = v; }, { width: '100%' });
      if (spr.who) whoSel.classList.add('bad-sel');
      if (s.single) {
        const q = s.quests[0] || (s.quests[0] = newQuest(1));
        const qpr = Object.assign({}, spr, Q().rowProblems(q, 'quest', s, refs));
        const hasSteps = (q.steps || []).length;
        table.appendChild(rowEl('single', q.id, [
          hasSteps ? el('button', { class: 'q-chev', onclick: () => { open[q.id] = !open[q.id]; VN.render(); } }, open[q.id] ? '▾' : '▸') : el('span'),
          whoSel,
          (() => { const i = txt(q.name, (v) => { q.name = v; s.name = v; }, { width: '100%' }, 'Name'); if (qpr.name) i.classList.add('bad-inp'); return i; })(),
          hasSteps ? condCell([], (q.order === 'one' ? 'einer von ' : 'alle ') + q.steps.length + ' Abschnitte') : condCell(q.conds, q.conds.length || refs.has(q.id) ? (refs.has(q.id) ? 'per Aktion' : '') : 'leer – Bedingung fehlt', !q.conds.length && !refs.has(q.id)),
          rewCell(q.reward)], qpr));
        if (hasSteps && open[q.id]) for (const st of q.steps) stepRow(table, s, q, st, refs, rowEl, condCell, rewCell);
        continue;
      }
      table.appendChild(rowEl('series', s.id, [
        el('button', { class: 'q-chev', onclick: () => { open[s.id] = !open[s.id]; VN.render(); } }, open[s.id] ? '▾' : '▸'),
        whoSel,
        el('div', { class: 'q-name' }, el('span', { class: 'q-lvl' }, 'Questreihe · ' + (s.quests || []).length + ' Quests'), (() => { const i = txt(s.name, (v) => { s.name = v; }, { width: '100%' }, 'Name'); if (spr.name) i.classList.add('bad-inp'); return i; })()),
        condCell([], 'alle ' + (s.quests || []).length + ' Quests erledigt'),
        rewCell(s.reward)], spr));
      if (!open[s.id]) continue;
      (s.quests || []).forEach((q, qi) => {
        const qpr = Q().rowProblems(q, 'quest', s, refs);
        const hasSteps = (q.steps || []).length;
        table.appendChild(rowEl('quest', q.id, [
          hasSteps ? el('button', { class: 'q-chev in1', onclick: () => { open[q.id] = !open[q.id]; VN.render(); } }, open[q.id] === false ? '▸' : '▾') : el('span'),
          el('span', { class: 'q-lvl in1' }, '↳ Quest ' + (qi + 1)),
          (() => { const i = txt(q.name, (v) => { q.name = v; }, { width: '100%' }, 'Name'); if (qpr.name) i.classList.add('bad-inp'); return i; })(),
          hasSteps ? condCell([], (q.order === 'one' ? 'einer von ' : q.order === 'any' ? 'alle, beliebige Reihenfolge: ' : 'alle der Reihe nach: ') + q.steps.length + ' Abschnitte') : condCell(q.conds, q.conds.length ? '' : refs.has(q.id) ? 'per Aktion' : 'leer – Bedingung fehlt', !q.conds.length && !refs.has(q.id)),
          rewCell(q.reward)], qpr));
        if (hasSteps && open[q.id] !== false) for (const st of q.steps) stepRow(table, s, q, st, refs, rowEl, condCell, rewCell);
      });
    }
    if (!list.length) table.appendChild(el('div', { class: 'q-empty' }, 'Noch keine Quests. Lege oben eine Quest oder eine Questreihe an.'));
    wrap.appendChild(table);
    wrap.appendChild(S.questDetail(refs));
    body.appendChild(wrap);
    body.appendChild(el('div', { class: 'muted small', style: { margin: '6px 0 14px' } }, 'Rot = etwas fehlt oder ist kaputt. Maus darüber zeigt den Grund, Klick auf die Zeile öffnet rechts alle Felder.'));
    body.appendChild(S.questNotifyCard());
  };
  function stepRow(table, s, q, st, refs, rowEl, condCell, rewCell) {
    const pr = Q().rowProblems(st, 'step', s, refs);
    const idx = q.steps.indexOf(st);
    table.appendChild(rowEl('step', st.id, [
      el('span'),
      el('span', { class: 'q-lvl in2' }, 'Abschnitt ' + (q.order === 'one' ? String.fromCharCode(97 + idx) : idx + 1) + (st.hidden ? ' 🔒' : '')),
      (() => { const i = txt(st.name, (v) => { st.name = v; }, { width: '100%' }, 'Name'); if (pr.name) i.classList.add('bad-inp'); return i; })(),
      condCell(st.conds, st.conds.length ? '' : refs.has(st.id) ? 'per Aktion' : 'leer – Bedingung fehlt', !st.conds.length && !refs.has(st.id)),
      rewCell(st.reward)], pr));
  }

  // Rechte Spalte: alle Felder der gewählten Zeile
  S.questDetail = (refs) => {
    const box = el('div', { class: 'q-detail' });
    const f = VN.ui.qSel ? Q().find(VN.ui.qSel) : null;
    if (!f) { box.appendChild(el('div', { class: 'hint-box' }, 'Klicke links auf eine Zeile, um Bedingungen, Belohnungen und Tipps einzustellen.')); return box; }
    const list = Q().list();
    const s = f.series;
    const move = (arr, item, d) => { const i = arr.indexOf(item), j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
    if (f.kind === 'series' || (f.kind === 'quest' && s.single)) {
      const q = s.single ? s.quests[0] : null;
      box.append(el('div', { class: 'q-dhead' }, el('span', { class: 'q-lvl' }, s.single ? 'Quest' : 'Questreihe'), el('strong', null, s.single ? q.name : s.name)),
        field('Gehört zu', sel(s.who || 'story', whoOpts(), (v) => { s.who = v; })),
        field('Beginnt', sel(s.startMode || 'auto', [['auto', 'von selbst (Bedingung unten)'], ['action', 'per Aktion „📜 Quest(reihe) starten“']], (v) => { s.startMode = v; })),
        (s.startMode || 'auto') === 'auto' ? VN.condEditor(s.start || (s.start = []), 'Beginnt, sobald (leer = sofort bei Spielstart)') : null);
      if (s.single) detailQuest(box, s, q, refs);
      else {
        box.append(VN.actionEditor(s.reward || (s.reward = []), 'Belohnung für die ganze Reihe'),
          el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const q2 = newQuest((s.quests || []).length + 1); s.quests.push(q2); VN.ui.qOpen[s.id] = true; VN.ui.qSel = q2.id; }) }, '+ Quest in dieser Reihe'));
      }
      box.appendChild(jingleRow(s));
      box.appendChild(el('div', { class: 'row gap8' },
        el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => move(list, s, -1)) }, '↑'), el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => move(list, s, 1)) }, '↓'),
        s.single ? el('button', { class: 'btn tiny', title: 'Weitere Quests anhängen', onclick: () => VN.mutate(() => { s.single = false; s.name = s.name || s.quests[0].name; VN.ui.qOpen[s.id] = true; }) }, 'Zur Reihe machen') : null,
        el('div', { style: { flex: '1' } }),
        el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { VN.project.quests.list = list.filter((x) => x !== s); VN.ui.qSel = null; }) }, s.single ? 'Quest löschen' : 'Reihe löschen')));
    } else if (f.kind === 'quest') {
      box.appendChild(el('div', { class: 'q-dhead' }, el('span', { class: 'q-lvl' }, 'Quest in „' + s.name + '“'), el('strong', null, f.quest.name)));
      detailQuest(box, s, f.quest, refs);
      box.appendChild(el('div', { class: 'row gap8' },
        el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => move(s.quests, f.quest, -1)) }, '↑'), el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => move(s.quests, f.quest, 1)) }, '↓'),
        el('div', { style: { flex: '1' } }),
        el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { s.quests = s.quests.filter((x) => x !== f.quest); VN.ui.qSel = s.id; }) }, 'Quest löschen')));
    } else {
      const st = f.step, q = f.quest;
      box.append(el('div', { class: 'q-dhead' }, el('span', { class: 'q-lvl' }, 'Abschnitt · ' + s.name + ' › ' + q.name), el('strong', null, st.name)),
        field('Name', txt(st.name, (v) => { st.name = v; })),
        VN.condEditor(st.conds || (st.conds = []), 'Erledigt, wenn'),
        refs.has(st.id) ? el('div', { class: 'muted small' }, 'Wird außerdem per Aktion „📜 Abschnitt erledigt“ abgehakt.') : el('div', { class: 'muted small' }, 'Ohne Bedingung: per Aktion „📜 Abschnitt erledigt“ (Dialogzeile, Antwort, Hub-Objekt).'),
        VN.actionEditor(st.reward || (st.reward = []), 'Belohnung für diesen Abschnitt'),
        field('Tipp für den Spieler (optional)', txt(st.hint, (v) => { st.hint = v; }, null, 'z. B. „Der Händler ist nur abends am Markt.“')),
        el('label', { class: 'check' }, chk(st.hidden, (v) => { st.hidden = v; }), 'Versteckt, bis er an der Reihe ist'),
        el('div', { class: 'row gap8' },
          el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => move(q.steps, st, -1)) }, '↑'), el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => move(q.steps, st, 1)) }, '↓'),
          el('div', { style: { flex: '1' } }),
          el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { q.steps = q.steps.filter((x) => x !== st); VN.ui.qSel = q.id; }) }, 'Abschnitt löschen')));
    }
    return box;
  };
  function detailQuest(box, s, q, refs) {
    box.append(
      field('Name', txt(q.name, (v) => { q.name = v; if (s.single) s.name = v; })),
      field('Beschreibung (im Questlog)', el('textarea', { style: { minHeight: '50px' }, onchange: (e) => VN.mutate(() => { q.desc = e.target.value; }) }, q.desc || '')),
      field('Abschnitte', sel(q.order || 'seq', [['seq', 'der Reihe nach'], ['any', 'alle, in beliebiger Reihenfolge'], ['one', 'einer reicht (Verzweigung)']], (v) => { q.order = v; })));
    if (!(q.steps || []).length) box.appendChild(VN.condEditor(q.conds || (q.conds = []), 'Erledigt, wenn (ohne Abschnitte)'));
    box.append(
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { q.steps = q.steps || []; const st = newStep(q.steps.length + 1); q.steps.push(st); VN.ui.qOpen[q.id] = true; if (s.single) VN.ui.qOpen[q.id] = true; VN.ui.qSel = st.id; }) }, '+ Abschnitt'),
      VN.actionEditor(q.reward || (q.reward = []), 'Belohnung'),
      VN.condEditor(q.fail || (q.fail = []), 'Scheitert, wenn (optional, z. B. „Tag > 7“)'));
  }
  // Eigene Jingles je Reihe (z. B. Rays Thema)
  function jingleRow(s) {
    s.jingles = s.jingles || {};
    const auds = [['', '— Standard —'], ...VN.assetsOf('audio').map((a) => [a.id, a.name])];
    return el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Eigene Musik für diese ' + (s.single ? 'Quest' : 'Reihe') + ' (optional)'),
      el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, 'Abgeschlossen'), sel(s.jingles.done || '', auds, (v) => { s.jingles.done = v; })),
      s.single ? null : el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, 'Reihe fertig'), sel(s.jingles.series || '', auds, (v) => { s.jingles.series = v; })),
      el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, 'Gescheitert'), sel(s.jingles.fail || '', auds, (v) => { s.jingles.fail = v; })));
  }

  // ---------- Einblendungen gestalten ----------
  const POS = [['top', 'Oben Mitte'], ['topright', 'Oben rechts'], ['topleft', 'Oben links'], ['center', 'Mitte'], ['bottom', 'Unten'], ['custom', 'Frei (X/Y)']];
  const IN = [['pop', 'Aufploppen'], ['slide', 'Hereingleiten'], ['fade', 'Einblenden'], ['drop', 'Herunterfallen']];
  const OUT = [['fade', 'Ausblenden'], ['slide', 'Weggleiten'], ['shatter', 'Zersplittern']];
  const auds = () => [['', '—'], ...VN.assetsOf('audio').map((a) => [a.id, a.name])];
  const notifyFields = (N, extra, posOpts) => {
    const rows = [
      el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, 'Position'), sel(N.pos, posOpts || POS, (v) => { N.pos = v; }),
        N.pos === 'custom' ? el('span', { class: 'muted small' }, 'X %') : null, N.pos === 'custom' ? num(N.x != null ? N.x : 50, (v) => { N.x = v; }, '56px') : null,
        N.pos === 'custom' ? el('span', { class: 'muted small' }, 'Y %') : null, N.pos === 'custom' ? num(N.y != null ? N.y : 12, (v) => { N.y = v; }, '56px') : null,
        el('span', { class: 'muted small' }, 'Größe %'), num(N.scale || 100, (v) => { N.scale = Math.max(50, Math.min(250, v || 100)); }, '60px')),
      el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, 'Rein'), sel(N.anim, IN, (v) => { N.anim = v; }), el('span', { class: 'muted small' }, 'Raus'), sel(N.out, OUT, (v) => { N.out = v; }),
        N.out === 'shatter' ? sel(N.shatterMode || 'fall', [['fall', 'Scherben fallen'], ['burst', 'explodieren'], ['side', 'fliegen weg']], (v) => { N.shatterMode = v; }) : null,
        N.out === 'shatter' ? el('span', { class: 'muted small' }, 'Scherben') : null, N.out === 'shatter' ? num(N.pieces || 16, (v) => { N.pieces = Math.max(4, Math.min(60, v || 16)); }, '54px') : null,
        N.out === 'shatter' ? el('span', { class: 'muted small' }, 'Glas-Sound') : null, N.out === 'shatter' ? sel(N.shatterSound || '', auds(), (v) => { N.shatterSound = v; }) : null,
        el('span', { class: 'muted small' }, 'Dauer s'), num(N.dur, (v) => { N.dur = Math.max(0.8, v || 3); }, '54px', { step: 0.1 })),
      ...(extra || [])];
    return rows;
  };
  S.questNotifyCard = () => {
    const c = Q().cfg();
    const box = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Einblendungen im Spiel'),
      el('div', { class: 'muted small' }, 'Für jede Meldung: Position, Animation (auch Zersplittern), Dauer, Text mit Platzhaltern {quest} {reihe} {abschnitt} {figur}, Symbol, Sound oder Jingle. Farben, Rahmen und Hintergrund über „🎨“.'),
      el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, 'Questlog-Taste'), txt(c.key || 'q', (v) => { c.key = (v || 'q').slice(0, 1).toLowerCase(); }, { width: '40px' }),
        el('button', { class: 'btn tiny', onclick: () => window.UiDesign && UiDesign.edit('questlog') }, '🎨 Design des Questlogs'),
        el('button', { class: 'btn tiny', onclick: () => window.UiDesign && UiDesign.edit('q_all') }, '🎨 Alle Einblendungen')));
    for (const [k, label] of Q().NOTIFY_KINDS) {
      const N = c.notify[k];
      box.appendChild(el('div', { class: 'qn-ed' + (N.off ? ' off' : '') },
        el('div', { class: 'row gap8', style: { alignItems: 'center' } }, el('label', { class: 'check' }, chk(!N.off, (v) => { N.off = !v; }), el('strong', null, label)),
          el('div', { style: { flex: '1' } }),
          el('button', { class: 'btn tiny', onclick: () => window.UiDesign && UiDesign.edit('q_' + k) }, '🎨 Farben & Rahmen'),
          el('button', { class: 'btn tiny primary', onclick: () => S.notifyPreview([{ type: k }]) }, '▶ Vorschau')),
        N.off ? null : el('div', { class: 'col gap4' }, ...notifyFields(N, [
          el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, 'Text'), txt(N.text, (v) => { N.text = v; }, { flex: '1' }), el('span', { class: 'muted small' }, 'Überschrift'), txt(N.title, (v) => { N.title = v; }, { width: '150px' }, 'Standard')),
          el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, 'Symbol'), VN.assetSelect('image', N.icon, (v) => VN.mutate(() => { N.icon = v; })),
            el('span', { class: 'muted small' }, 'Sound'), sel(N.sound || '', auds(), (v) => { N.sound = v; }),
            el('span', { class: 'muted small' }, 'Jingle'), sel(N.jingle || '', auds(), (v) => { N.jingle = v; }),
            N.jingle ? sel(N.jingleMode || 'duck', [['duck', 'Musik leiser'], ['pause', 'Musik pausieren'], ['over', 'darüber spielen']], (v) => { N.jingleMode = v; }) : null,
            N.jingle ? num(N.jingleVol != null ? N.jingleVol : 90, (v) => { N.jingleVol = Math.max(0, Math.min(100, v)); }, '56px') : null)]))));
    }
    return box;
  };
  // Vorschau in Spielgröße
  S.notifyPreview = (events, rel) => {
    const host = el('div', { class: 'shop-preview-host qn-prev' });
    const bg = Design && Design.sample ? Design.sample().bg : null;
    if (bg) host.appendChild(el('img', { src: VN.assetUrl(bg.asset), style: { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover', opacity: '0.6' } }));
    const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) back.remove(); } }, el('div', { class: 'col gap8', style: { alignItems: 'center' } }, host, el('button', { class: 'btn', onclick: () => back.remove() }, 'Schließen')));
    document.body.appendChild(back);
    const NT = VN.PlayerNotify({ preview: true, run: () => null, stage: () => host, A: { duck() {}, ducked: false, music: null }, uiSound: () => {}, pauseMenu: () => {} });
    if (rel) { NT.relPopup(rel); return; }
    const s = { id: 'pv', who: 'Ray', name: VN.t('Rays Vergangenheit'), reward: [] };
    for (const e of events) NT.preview(Object.assign({ series: s, quest: { id: 'pvq', name: VN.t('Spurensuche'), reward: [{ type: 'money', currency: (VN.project.currencies[0] || {}).id, amount: 20 }] }, step: { id: 'pvs', name: VN.t('Den Händler fragen'), reward: [] } }, e));
  };

  // ---------- Beziehungs-Einblendung (im Reiter „Beziehungen“) ----------
  if (VN.Life) {
    const base = VN.Life.relTab;
    VN.Life.relTab = (body) => {
      base(body);
      const R = VN.project.relations;
      R.pop = Object.assign({ on: true, pos: 'topleft', portrait: true, show: 'num', dur: 2.6, anim: 'slide', out: 'fade', text: '', stageText: '{figur} ist jetzt: {stufe}', downText: '{figur} ist enttäuscht …' }, R.pop || {});
      const P = R.pop;
      const ch = R.chars[0];
      body.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Einblendung bei Änderung'),
        el('div', { class: 'muted small' }, 'Erscheint, wenn eine Entscheidung die Zuneigung ändert: Name, Leiste vom alten zum neuen Wert, Pfeil mit Zahl und auf Wunsch das Porträt (aus der Figur oben). Stufenwechsel bekommen eine größere Einblendung.'),
        el('label', { class: 'check' }, chk(P.on, (v) => { P.on = v; }), 'Einblendung zeigen (aus = Beziehungen bleiben geheim)'),
        P.on ? el('div', { class: 'col gap4' },
          ...notifyFields(P, [
            el('div', { class: 'logic-row' }, el('label', { class: 'check' }, chk(P.portrait !== false, (v) => { P.portrait = v; }), 'Porträt zeigen'),
              el('span', { class: 'muted small' }, 'Anzeige'), sel(P.show, [['num', 'Zahl (+10)'], ['hearts', 'nur Herzen'], ['arrow', 'nur Pfeil']], (v) => { P.show = v; })),
            el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, 'Zusatztext'), txt(P.text, (v) => { P.text = v; }, { flex: '1' }, 'z. B. „{figur} wird sich das merken.“')),
            el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, 'Neue Stufe'), txt(P.stageText, (v) => { P.stageText = v; }, { flex: '1' }), el('span', { class: 'muted small' }, 'Jingle'), sel(P.stageJingle || '', auds(), (v) => { P.stageJingle = v; })),
            el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, 'Stufe gesunken'), txt(P.downText, (v) => { P.downText = v; }, { flex: '1' }), el('span', { class: 'muted small' }, 'Raus'), sel(P.downOut || '', [['', 'wie oben'], ...OUT], (v) => { P.downOut = v; })),
            el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, 'Sound'), sel(P.sound || '', auds(), (v) => { P.sound = v; }),
              el('button', { class: 'btn tiny', onclick: () => window.UiDesign && UiDesign.edit('relpop') }, '🎨 Farben & Rahmen'),
              ch ? el('button', { class: 'btn tiny primary', onclick: () => S.notifyPreview(null, [{ kind: 'rel', id: ch.id, count: 10, from: 32, to: 42 }]) }, '▶ Vorschau') : null,
              ch ? el('button', { class: 'btn tiny', onclick: () => S.notifyPreview(null, [{ kind: 'rel', id: ch.id, count: 8, from: 36, to: 44, stage: 2 }]) }, '▶ Neue Stufe') : null,
              ch ? el('button', { class: 'btn tiny', onclick: () => S.notifyPreview(null, [{ kind: 'rel', id: ch.id, count: -12, from: 45, to: 33, down: 1 }]) }, '▶ Minus') : null)
          ], [...POS, ['nearchar', 'Neben der Figur']])) : null));
    };
  }
})();
