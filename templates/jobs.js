// Mitgeliefertes Plugin: Jobs
// Spieler gehen arbeiten: Zeit vergeht, Geld kommt, mit Zufallsereignissen, Minispiel und Beförderung.
// Du darfst diese Datei frei ändern oder als Vorlage für eigene Systeme (Training, Lernen …) nehmen.
(function () {
  const ID = 'jobs';
  const data = () => {
    const p = VN.project;
    p.pluginData = p.pluginData || {};
    const d = p.pluginData[ID] = p.pluginData[ID] || {};
    d.jobs = d.jobs || [];
    if (d.promotion == null) d.promotion = false;
    return d;
  };
  const newJob = () => ({
    id: 'job_' + Math.random().toString(36).slice(2, 8), name: 'Aushilfe in der Taverne', image: null,
    text: 'Du schleppst Krüge, wischst Tische und lächelst freundlich.', time: 2, pay: 30, currency: '', conds: [],
    minigame: '', xp: 10,
    ranks: [{ title: 'Aushilfe', xp: 0, mult: 1 }, { title: 'Kellner', xp: 30, mult: 1.3 }, { title: 'Schankmeister', xp: 80, mult: 1.7 }],
    events: [{ chance: 25, text: 'Ein Stammgast lässt Trinkgeld da.', money: 5, char: '', rel: 0 }]
  });
  const state = (rs, job) => { rs.jobs = rs.jobs || {}; return rs.jobs[job.id] = rs.jobs[job.id] || { xp: 0, rank: 0, shifts: 0 }; };
  const rankOf = (job, xp) => { let r = 0; (job.ranks || []).forEach((k, i) => { if (xp >= Number(k.xp)) r = i; }); return r; };

  VNPlugin.register({
    id: ID,
    name: 'Jobs',
    version: '1.2',
    description: 'Arbeiten gehen: Zeit vergeht, Geld kommt. Mit Voraussetzungen, Zufallsereignissen, Minispiel und Beförderung. Einstellungen unter Spielsysteme → Jobs.',
    // Unterschalter in der Übersicht
    subSwitches() {
      const d = data();
      return [VN.el('label', { class: 'check' }, VN.el('input', { type: 'checkbox', checked: !!d.promotion, onchange: (e) => VN.mutate(() => { d.promotion = e.target.checked; }) }), '⬆ Beförderung (Erfahrung, Ränge, mehr Lohn)')];
    },
    designs: { ergebnis: { label: 'Jobs: Ergebnis-Fenster', icon: '💼', images: [['bild', 'Standard-Bild (wenn der Job keins hat)']] } },
    actions: {
      arbeiten: {
        label: 'Arbeiten gehen',
        params: [
          { key: 'job', label: 'Job', type: 'select', get options() { return data().jobs.map((j) => [j.id, j.name]); }, default: '' }
        ],
        async run(params, ctx) {
          const d = data();
          const job = d.jobs.find((j) => j.id === params.job) || d.jobs[0];
          if (!job) return ctx.message('Kein Job eingerichtet.');
          const rs = ctx.state, p = ctx.project;
          if (!VN.checkConds(job.conds, rs)) { await ctx.message(job.locked || 'Hier kannst du gerade nicht arbeiten.'); return { score: 0, ok: false }; }
          const st = state(rs, job);
          // Minispiel (optional): Ergebnis 0…1 beeinflusst Lohn und Erfahrung
          let score = 1, played = false;
          if (job.minigame && VNPlugin.actionDef(job.minigame)) { const r = await ctx.run(job.minigame, job.minigameParams || {}); score = r ? r.score : 1; played = true; }
          const rank = d.promotion ? (job.ranks || [])[st.rank] : null;
          const mult = rank ? Number(rank.mult) || 1 : 1;
          const cur = p.currencies.find((c) => c.id === job.currency) || p.currencies[0];
          let pay = Math.round((Number(job.pay) || 0) * mult * (played ? 0.4 + 0.6 * score : 1));
          if (ctx.bonus) pay = Math.round(ctx.bonus('job.pay', pay));
          const lines = [];
          // Zufallsereignisse
          for (const ev of job.events || []) {
            if (Math.random() * 100 >= Number(ev.chance || 0)) continue;
            lines.push(ev.text || '');
            if (Number(ev.money)) pay += Number(ev.money);
            if (ev.char && Number(ev.rel)) ctx.rel.add(ev.char, Number(ev.rel));
          }
          if (cur && pay) ctx.money.add(cur.id, pay);
          st.shifts += 1;
          let promoted = null;
          if (d.promotion) {
            st.xp += Math.round((Number(job.xp) || 0) * (played ? 0.5 + score : 1));
            const r = rankOf(job, st.xp);
            if (r > st.rank) { st.rank = r; promoted = job.ranks[r]; }
          }
          ctx.time.advance(Number(job.time) || 0);
          // Ergebnis-Fenster
          const el = ctx.el;
          const o = ctx.overlay({ width: '52%' });
          o.el.classList.add('job-panel');
          // Aussehen: Design → Spielsysteme → Jobs. Bild am Job hat Vorrang vor dem Standard-Bild.
          const D = ctx.design ? ctx.design(ID + '.ergebnis') : null;
          if (D) D.apply(o.el);
          const pic = D ? D.image('bild', job.image) : (job.image ? ctx.asset(job.image) : '');
          if (pic) o.el.appendChild(el('div', { class: 'job-img', style: { backgroundImage: `url("${pic}")` } }));
          o.el.append(
            el('div', { class: 'job-title' }, VN.tr(job.id + ':name', job.name) + (rank ? ' · ' + rank.title : '')),
            el('div', { class: 'job-text' }, VN.tr(job.id + ':text', job.text || '')),
            played ? el('div', { class: 'job-score' }, 'Leistung: ' + Math.round(score * 100) + ' %') : null,
            ...lines.map((t) => el('div', { class: 'job-event' }, '✦ ' + t)),
            el('div', { class: 'job-pay' }, cur ? '+ ' + pay + ' ' + VN.tr(cur.id + ':name', cur.name) : ''),
            Number(job.time) && ctx.time.text() ? el('div', { class: 'job-time' }, '🕰 ' + ctx.time.text()) : null,
            promoted ? el('div', { class: 'job-promo' }, '⬆ Befördert: ' + promoted.title + '!') : null,
            d.promotion && job.ranks && job.ranks[st.rank + 1] ? el('div', { class: 'job-xp' }, el('span', { style: { width: Math.min(100, (st.xp - job.ranks[st.rank].xp) / (job.ranks[st.rank + 1].xp - job.ranks[st.rank].xp) * 100) + '%' } })) : null);
          await new Promise((res) => o.el.appendChild(el('button', { class: 'btn primary job-btn', onclick: () => { o.close(); res(); } }, 'Weiter')));
          return { score, ok: true };
        }
      }
    },
    hooks: {},
    // Eigener Reiter unter Spielsysteme
    editorTab: {
      label: 'Jobs',
      render(body) {
        const el = VN.el, d = data(), p = VN.project;
        const job = d.jobs.find((j) => j.id === VN.ui.jobSel) || d.jobs[0];
        const set = (fn) => (e) => VN.mutate(() => fn(e.target.type === 'number' ? Number(e.target.value) : e.target.value));
        body.appendChild(el('p', { class: 'muted' }, 'Jobs startest du mit der Aktion „Jobs: Arbeiten gehen“, z. B. an einem Hub-Objekt (Tür zur Taverne) oder in einer Antwort. Alles hier sind Platzhalter – Texte, Bild und Werte gehören dir.'));
        if (window.UiDesign) body.appendChild(el('div', { class: 'row gap8', style: { marginBottom: '8px' } }, el('button', { class: 'btn tiny', onclick: () => UiDesign.edit(ID + '.ergebnis') }, '🎨 Design des Ergebnis-Fensters'), el('span', { class: 'muted small' }, 'Rahmen, Farben und Standard-Bild')));
        const wrap = el('div', { class: 'loot-wrap' });
        const list = el('div', { class: 'loot-list' });
        for (const j of d.jobs) list.appendChild(el('div', { class: 'list-item' + (j === job ? ' active' : ''), onclick: () => { VN.ui.jobSel = j.id; VN.render(); } }, el('span', { class: 'dot', style: { background: '#8fc3f0' } }), el('span', { class: 'name' }, j.name)));
        list.appendChild(el('button', { class: 'btn', style: { marginTop: '6px' }, onclick: () => VN.mutate(() => { const j = newJob(); j.currency = (p.currencies[0] || {}).id || ''; d.jobs.push(j); VN.ui.jobSel = j.id; }) }, '+ Job'));
        const ed = el('div', { class: 'loot-ed' });
        wrap.append(list, ed);
        body.appendChild(wrap);
        if (!job) { ed.appendChild(el('div', { class: 'hint-box' }, 'Lege links einen Job an.')); return; }
        const field = (label, input) => el('div', { class: 'field' }, el('div', { class: 'lbl' }, label), input);
        const minis = VNPlugin.actionList().filter(([ref]) => { const a = VNPlugin.actionDef(ref); return a && a.minigame; });
        const sel = (v, opts, fn) => { const s = el('select', { onchange: (e) => VN.mutate(() => fn(e.target.value)) }); for (const [k, l] of opts) { const o = el('option', { value: k }, l); if (String(k) === String(v || '')) o.selected = true; s.appendChild(o); } return s; };
        ed.append(
          el('div', { class: 'row gap8' }, field('Name', el('input', { type: 'text', value: job.name, onchange: set((v) => { job.name = v || 'Job'; }) })),
            el('button', { class: 'btn danger', style: { alignSelf: 'flex-end' }, onclick: () => VN.mutate(() => { d.jobs = d.jobs.filter((x) => x !== job); VN.ui.jobSel = null; }) }, 'Job löschen')),
          field('Bild im Ergebnis-Fenster (optional)', VN.assetSelect('image', job.image, (v) => VN.mutate(() => { job.image = v; }))),
          field('Text', el('input', { type: 'text', value: job.text || '', onchange: set((v) => { job.text = v; }) })),
          el('div', { class: 'row gap8' },
            field('Lohn', el('input', { type: 'number', value: job.pay, style: { width: '80px' }, onchange: set((v) => { job.pay = v; }) })),
            field('Währung', sel(job.currency, p.currencies.map((c) => [c.id, c.name]), (v) => { job.currency = v; })),
            field('Dauer (Tageszeiten)', el('input', { type: 'number', value: job.time, min: 0, style: { width: '80px' }, onchange: set((v) => { job.time = Math.max(0, v); }) }))),
          VN.condEditor(job.conds, 'Arbeiten nur möglich, wenn'),
          field('Text, wenn nicht möglich', el('input', { type: 'text', value: job.locked || '', placeholder: 'Hier kannst du gerade nicht arbeiten.', onchange: set((v) => { job.locked = v; }) })),
          el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Minispiel (optional)'),
            sel(job.minigame, [['', '— keins: nur Einblendung —'], ...minis], (v) => { job.minigame = v; job.minigameParams = {}; }),
            el('div', { class: 'muted small' }, minis.length ? 'Je besser gespielt, desto mehr Lohn (40–100 %) und Erfahrung.' : 'Schalte in der Übersicht „Minispiele“ ein, dann kannst du hier eins wählen.')));
        // Zufallsereignisse
        const evs = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Zufallsereignisse'));
        (job.events || []).forEach((ev, i) => evs.appendChild(el('div', { class: 'logic-row' },
          el('input', { type: 'number', value: ev.chance, style: { width: '56px' }, onchange: set((v) => { ev.chance = v; }) }), el('span', { class: 'muted small' }, '%'),
          el('input', { type: 'text', value: ev.text, style: { flex: '1' }, onchange: set((v) => { ev.text = v; }) }),
          el('span', { class: 'muted small' }, 'Geld'), el('input', { type: 'number', value: ev.money || 0, style: { width: '56px' }, onchange: set((v) => { ev.money = v; }) }),
          VN.Life && VN.Life.relOn() ? sel(ev.char, [['', '♥ –'], ...p.relations.chars.map((c) => [c.id, '♥ ' + c.name])], (v) => { ev.char = v; }) : null,
          VN.Life && VN.Life.relOn() ? el('input', { type: 'number', value: ev.rel || 0, style: { width: '50px' }, onchange: set((v) => { ev.rel = v; }) }) : null,
          el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { job.events.splice(i, 1); }) }, '×'))));
        evs.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { job.events = job.events || []; job.events.push({ chance: 20, text: 'Etwas Unerwartetes passiert.', money: 0, char: '', rel: 0 }); }) }, '+ Ereignis'));
        ed.appendChild(evs);
        // Beförderung
        if (d.promotion) {
          const rk = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, '⬆ Beförderung'),
            el('div', { class: 'row gap8' }, field('Erfahrung pro Schicht', el('input', { type: 'number', value: job.xp, style: { width: '80px' }, onchange: set((v) => { job.xp = v; }) }))));
          (job.ranks || []).forEach((r, i) => rk.appendChild(el('div', { class: 'logic-row' },
            el('input', { type: 'text', value: r.title, style: { width: '160px' }, onchange: set((v) => { r.title = v; }) }),
            el('span', { class: 'muted small' }, 'ab'), i ? el('input', { type: 'number', value: r.xp, style: { width: '64px' }, onchange: set((v) => { r.xp = v; }) }) : el('span', null, '0'), el('span', { class: 'muted small' }, 'Erfahrung · Lohn ×'),
            el('input', { type: 'number', step: 0.1, value: r.mult, style: { width: '60px' }, onchange: set((v) => { r.mult = v; }) }),
            i ? el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { job.ranks.splice(i, 1); }) }, '×') : null)));
          rk.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const last = job.ranks[job.ranks.length - 1]; job.ranks.push({ title: 'Neuer Rang', xp: (Number(last && last.xp) || 0) + 50, mult: (Number(last && last.mult) || 1) + 0.3 }); }) }, '+ Rang'));
          ed.appendChild(rk);
        } else ed.appendChild(el('div', { class: 'muted small' }, 'Beförderung ist aus. Einschalten unter Spielsysteme → Übersicht → Jobs.'));
      }
    }
  });
})();
