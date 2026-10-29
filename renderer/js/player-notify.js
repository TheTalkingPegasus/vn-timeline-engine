// Einblendungen und Questlog im Spiel: Quest-Meldungen (mit Jingle und Zersplittern), Beziehungs-Einblendung,
// Questlog-Bildschirm (Taste Q). Wird von player.js mit VN.PlayerNotify(H) eingebunden.
(function () {
  const { el } = VN;
  const Q = () => VN.Quests;
  const KIND_TITLE = { new: 'Neue Quest', step: 'Abschnitt erledigt', done: 'Quest abgeschlossen', series: 'Questreihe abgeschlossen', fail: 'Gescheitert' };
  const KIND_ICON = { new: '📜', step: '✓', done: '★', series: '🏆', fail: '✗' };

  VN.PlayerNotify = (H) => {
    const R = H.run;
    const tr = (id, t) => VN.tr(id, t || '');

    // ---------- Jingles ----------
    let jingle = null;
    const playJingle = (asset, mode, vol) => {
      if (!asset || !VN.assetUrl(asset)) return;
      if (jingle) { try { jingle.pause(); } catch (e) { /* egal */ } }
      const a = new Audio(VN.assetUrl(asset));
      a.volume = Math.max(0, Math.min(1, (vol != null ? vol : 90) / 100 * ((VN.settings.music != null ? VN.settings.music : 80) / 100)));
      jingle = a;
      const m = H.A.music && H.A.music.audio;
      if (mode === 'pause' && m) m.pause();
      if (mode !== 'over' && mode !== 'pause') H.A.duck(true);
      const end = () => { if (jingle !== a) return; jingle = null; if (mode === 'pause' && m && H.A.music && H.A.music.audio === m) m.play().catch(() => {}); if (mode !== 'over' && mode !== 'pause' && !H.A.ducked) H.A.duck(false); };
      a.addEventListener('ended', end);
      a.addEventListener('error', end);
      a.play().catch(end);
    };
    const playSound = (asset) => { if (!asset || !VN.assetUrl(asset)) return; const a = new Audio(VN.assetUrl(asset)); a.volume = Math.min(1, (VN.settings.sfx != null ? VN.settings.sfx : 90) / 100); a.play().catch(() => {}); };

    // ---------- Gemeinsame Einblendung (Ein- und Ausblenden, Position, Design) ----------
    const show = (box, N, designKey) => new Promise((resolve) => {
      const st = H.stage();
      if (!st) return resolve();
      const wrap = el('div', { class: 'qn-wrap pos-' + (N.pos || 'top') });
      if (N.pos === 'custom') Object.assign(wrap.style, { left: (N.x != null ? N.x : 50) + '%', top: (N.y != null ? N.y : 12) + '%' });
      if (N.scale && N.scale !== 100) box.style.zoom = N.scale / 100;
      wrap.appendChild(box);
      st.appendChild(wrap);
      if (window.UiDesign) UiDesign.apply(designKey, box);
      box.classList.add('in-' + (N.anim || 'pop'));
      const dur = Math.max(0.8, Number(N.dur) || 3) * 1000;
      setTimeout(async () => {
        if ((N.out || 'fade') === 'shatter' && window.Fx && Fx.shatter) { await Fx.shatter(box, { mode: N.shatterMode || 'fall', pieces: N.pieces || 16, sound: N.shatterSound }); wrap.remove(); return resolve(); }
        box.classList.add('out-' + (N.out || 'fade'));
        setTimeout(() => { wrap.remove(); resolve(); }, 450);
      }, dur);
    });

    // ---------- Quest-Einblendungen (nacheinander) ----------
    const queue = [];
    let busy = false;
    const rewardText = (list) => (list || []).filter((a) => a.type !== 'questStep').map((a) => VN.actionText(a)).filter((t) => t && t !== '?').join(' · ');
    const questBox = (ev) => {
      const cfg = Q().cfg();
      const N = cfg.notify[ev.type] || {};
      if (N.off) return Promise.resolve();
      const s = ev.series, q = ev.quest, st = ev.step;
      const vals = { quest: q ? tr(q.id + ':name', q.name) : '', reihe: tr(s.id + ':name', s.name), abschnitt: st ? tr(st.id + ':name', st.name) : '', figur: Q().whoName(s) };
      const rw = ev.type === 'done' ? rewardText(q.reward) : ev.type === 'series' ? rewardText(s.reward) : ev.type === 'step' ? rewardText(st.reward) : '';
      const icon = N.icon && VN.assetUrl(N.icon) ? el('div', { class: 'qn-ico', style: { backgroundImage: `url("${VN.assetUrl(N.icon)}")` } }) : el('div', { class: 'qn-ico ph k-' + ev.type }, KIND_ICON[ev.type]);
      const box = el('div', { class: 'qn-box k-' + ev.type }, icon,
        el('div', { class: 'qn-main' },
          el('div', { class: 'qn-kind' }, (s.who && s.who !== 'story' ? '♥ ' + vals.figur + ' · ' : '') + (N.title || KIND_TITLE[ev.type])),
          el('div', { class: 'qn-text' }, Q().fill(N.text || '{quest}', vals)),
          rw ? el('div', { class: 'qn-rw' }, 'Belohnung: ' + rw) : null));
      const jg = (s.jingles && s.jingles[ev.type]) || N.jingle;
      if (jg) playJingle(jg, N.jingleMode || 'duck', N.jingleVol);
      else if (N.sound) playSound(N.sound);
      else if (window.Theme) Theme.sound(ev.type === 'fail' ? 'close' : 'item');
      return show(box, N, 'q_' + ev.type);
    };
    if (!H.preview) Q().notify = (events) => { for (const e of events) queue.push(e); pumpCustom(); if (H.refresh) H.refresh(); };

    // ---------- Beziehungs-Einblendung ----------
    const relCfg = () => Object.assign({ on: true, pos: 'topleft', portrait: true, show: 'num', dur: 2.6, anim: 'slide', out: 'fade', text: '', stageText: '{figur} ist jetzt: {stufe}', downText: '{figur} ist enttäuscht …' }, (VN.project.relations && VN.project.relations.pop) || {});
    const relPopup = (gainsRel) => {
      const C = relCfg();
      if (!C.on || !gainsRel.length) return false;
      const L = VN.Life;
      for (const g of gainsRel) {
        const c = L.relChar(g.id);
        if (!c) continue;
        const name = tr('name:' + c.name, c.name);
        const from = g.from != null ? g.from : Math.max(0, (g.to || 0) - g.count), to = g.to != null ? g.to : from + g.count;
        const big = g.stage != null || g.down != null;
        const por = C.portrait !== false && c.portrait && VN.assetUrl(c.portrait) ? el('div', { class: 'rp-por' + (g.count < 0 ? ' sad' : ''), style: { backgroundImage: `url("${VN.assetUrl(c.portrait)}")` } }) : (C.portrait !== false ? el('div', { class: 'rp-por ph' }, (c.name || '?').slice(0, 1)) : null);
        const fillEl = el('span', { style: { width: from + '%', background: c.color || '#e86a9a' } });
        const delta = C.show === 'hearts' ? (g.count > 0 ? '♥'.repeat(Math.min(3, Math.ceil(g.count / 10))) : '💔') : C.show === 'arrow' ? (g.count > 0 ? '▲' : '▼') : (g.count > 0 ? '+' : '') + g.count;
        const vals = { figur: name, zahl: (g.count > 0 ? '+' : '') + g.count, stufe: big ? L.stageName(g.stage != null ? g.stage : g.down) : '' };
        const line = big ? Q && VN.Quests ? VN.Quests.fill(g.stage != null ? C.stageText : C.downText, vals) : '' : (C.text ? VN.Quests.fill(C.text, vals) : '');
        const box = el('div', { class: 'rp-box' + (big ? ' big' : '') + (g.count < 0 ? ' neg' : '') }, por,
          el('div', { class: 'rp-main' },
            el('div', { class: 'rp-top' }, el('strong', null, name), el('span', { class: 'rp-delta' }, delta)),
            el('div', { class: 'rp-bar' }, fillEl),
            line ? el('div', { class: 'rp-line' }, line) : null));
        requestAnimationFrame(() => requestAnimationFrame(() => { fillEl.style.transition = 'width 0.9s cubic-bezier(.3,.9,.3,1)'; fillEl.style.width = to + '%'; }));
        const N = Object.assign({}, C, big ? { pos: C.bigPos || 'center', dur: (Number(C.dur) || 2.6) + 1, out: g.down != null && C.downOut ? C.downOut : C.out } : {});
        if (N.pos === 'nearchar' && H.charPos) { const pp = H.charPos(c); if (pp) Object.assign(N, { pos: 'custom', x: pp.x, y: pp.y }); else N.pos = 'topleft'; }
        if (big && C.stageJingle && g.stage != null) playJingle(C.stageJingle, C.jingleMode || 'duck', 90);
        else if (C.sound) playSound(C.sound);
        queue.push({ custom: () => show(box, N, 'relpop') });
      }
      pumpCustom();
      return true;
    };
    // Eigene Einträge in derselben Warteschlange
    const pumpCustom = async () => {
      if (busy) return;
      busy = true;
      while (queue.length) { const e = queue.shift(); try { await (e.custom ? e.custom() : questBox(e)); } catch (er) { console.error(er); } }
      busy = false;
    };

    // ---------- Questlog-Bildschirm ----------
    const questScreen = (back) => new Promise((resolve) => {
      const r = R();
      if (!r || !Q().on()) return resolve();
      r.overlay = 'quests';
      H.uiSound('open');
      const rs = r.rs;
      let tab = 'story', sel = null;
      const box = el('div', { class: 'ql-screen', onclick: (e) => e.stopPropagation() });
      H.stage().appendChild(box);
      const done = () => { box.remove(); if (R()) R().overlay = null; if (back) H.pauseMenu(); resolve(); };
      box._done = done;
      const S = Q().state(rs);
      const status = (s) => (S.s[s.id] ? S.s[s.id].st : 'none');
      const draw = () => {
        box.innerHTML = '';
        const list = Q().list().filter((s) => status(s) !== 'none');
        const groups = { story: list.filter((s) => status(s) === 'active' && (!s.who || s.who === 'story')), chars: list.filter((s) => status(s) === 'active' && s.who && s.who !== 'story'), done: list.filter((s) => status(s) !== 'active') };
        if (!sel || !groups[tab].includes(sel)) sel = groups[tab][0] || null;
        const tabBtn = (k, l) => el('button', { class: 'ql-tab' + (tab === k ? ' on' : ''), onclick: () => { tab = k; sel = null; draw(); } }, l + (k === 'done' && groups.done.length ? ' (' + groups.done.length + ')' : ''));
        const left = el('div', { class: 'ql-left' });
        for (const s of groups[tab]) {
          const qi = Math.min((S.s[s.id] || {}).q || 0, (s.quests || []).length - 1);
          const q = (s.quests || [])[qi];
          const qs = q ? S.q[q.id] || { steps: {} } : { steps: {} };
          const nSteps = q ? (q.steps || []).length : 0, dSteps = q ? (q.steps || []).filter((x) => qs.steps[x.id]).length : 0;
          const prog = s.single ? (nSteps ? dSteps / nSteps : 0) : ((qi + (nSteps ? dSteps / nSteps : 0)) / Math.max(1, (s.quests || []).length));
          const ch = Q().whoChar(s);
          left.appendChild(el('button', { class: 'ql-item' + (s === sel ? ' on' : '') + (status(s) === 'failed' ? ' failed' : ''), onclick: () => { sel = s; draw(); } },
            el('div', { class: 'ql-who' }, s.who && s.who !== 'story' ? '♥ ' + Q().whoName(s) + (ch && VN.Life.relOn() ? ' · ' + VN.Life.stageName(VN.Life.stageOf(rs.rel[ch.id] || 0)) : '') : 'Hauptstory'),
            el('strong', null, tr(s.id + ':name', s.name)),
            status(s) === 'active' ? el('div', { class: 'ql-sub' }, s.single ? (nSteps ? 'Abschnitt ' + Math.min(nSteps, dSteps + 1) + ' von ' + nSteps : '') : 'Quest ' + (qi + 1) + ' von ' + (s.quests || []).length + (nSteps ? ' · Abschnitt ' + Math.min(nSteps, dSteps + 1) + ' von ' + nSteps : '')) : el('div', { class: 'ql-sub' }, status(s) === 'done' ? 'abgeschlossen' : 'gescheitert'),
            status(s) === 'active' ? el('div', { class: 'ql-bar' }, el('span', { style: { width: Math.round(prog * 100) + '%' } })) : null));
        }
        if (!groups[tab].length) left.appendChild(el('div', { class: 'ql-empty' }, tab === 'done' ? 'Noch nichts abgeschlossen.' : 'Gerade keine Quests.'));
        const right = el('div', { class: 'ql-right' });
        if (sel) {
          const ss = S.s[sel.id] || { q: 0 };
          const qi = Math.min(ss.q || 0, (sel.quests || []).length - 1);
          const q = (sel.quests || [])[qi];
          if (q) {
            const qs = S.q[q.id] || { steps: {} };
            right.appendChild(el('div', { class: 'ql-path' }, sel.single ? Q().whoName(sel) : tr(sel.id + ':name', sel.name) + ' › Quest ' + (qi + 1)));
            right.appendChild(el('div', { class: 'ql-title' }, tr(q.id + ':name', q.name)));
            if (q.desc) right.appendChild(el('div', { class: 'ql-desc' }, tr(q.id + ':desc', q.desc)));
            const steps = el('div', { class: 'ql-steps' });
            let shownNext = false;
            for (const st of q.steps || []) {
              const ok = !!qs.steps[st.id];
              const isNext = !ok && (q.order === 'any' || q.order === 'one' || !shownNext);
              if (!ok && !isNext && (q.order || 'seq') === 'seq') { steps.appendChild(el('div', { class: 'ql-step hidden' }, el('span', { class: 'ql-box dashed' }), '???')); shownNext = true; continue; }
              if (!ok && st.hidden && !isNext) continue;
              if (!ok) shownNext = true;
              steps.appendChild(el('div', { class: 'ql-step' + (ok ? ' ok' : '') }, el('span', { class: 'ql-box' + (ok ? ' ok' : '') }, ok ? '✓' : ''),
                el('div', null, el('div', { class: 'ql-st-name' }, st.hidden && !ok && !isNext ? '???' : tr(st.id + ':name', st.name)),
                  !ok && st.hint ? el('div', { class: 'ql-hint' }, 'Tipp: ' + tr(st.id + ':hint', st.hint)) : null)));
            }
            if (q.order === 'one' && (q.steps || []).length > 1) steps.appendChild(el('div', { class: 'ql-desc small' }, 'Eins davon reicht.'));
            right.appendChild(steps);
            const rw = rewardText(q.reward);
            const ch = Q().whoChar(sel);
            const foot = el('div', { class: 'ql-foot' }, rw ? el('span', null, 'Belohnung: ' + rw) : el('span'),
              ch && VN.Life.relOn() ? (() => { const v = rs.rel[ch.id] || 0, stg = VN.Life.stageOf(v); const nl = VN.project.relations.ladder[stg + 1]; return el('span', { class: 'ql-rel' }, '♥ ' + VN.Life.stageName(stg) + (nl ? ' → ' + nl.name + ' · noch ' + Math.max(0, nl.min - Math.round(v)) + ' %' : '')); })() : null);
            right.appendChild(foot);
            if (!sel.single && rewardText(sel.reward)) right.appendChild(el('div', { class: 'ql-series-rw' }, 'Ganze Reihe: ' + rewardText(sel.reward)));
          }
        } else right.appendChild(el('div', { class: 'ql-empty' }, 'Wähle links eine Quest.'));
        box.append(
          el('div', { class: 'ql-head' }, el('h2', null, 'Questlog'), el('div', { class: 'ql-tabs' }, tabBtn('story', 'Hauptstory'), tabBtn('chars', 'Figuren'), tabBtn('done', 'Erledigt')),
            el('div', { style: { flex: '1' } }), VN.Life && VN.Life.timeOn() ? el('span', { class: 'ql-time' }, VN.Life.timeText(VN.Life.initRun(rs))) : null),
          el('div', { class: 'ql-body' }, left, right),
          el('div', { class: 'ql-bottom' }, el('button', { class: 'sys-btn', onclick: done }, 'Schließen (' + (Q().cfg().key || 'q').toUpperCase() + ')')));
        if (window.UiDesign) UiDesign.apply('questlog', box);
      };
      draw();
    });
    const onKey = (e) => {
      const r = R();
      if (!r || !Q().on()) return false;
      const k = (Q().cfg().key || 'q').toLowerCase();
      if (e.key.toLowerCase() !== k) return false;
      const open = H.stage().querySelector('.ql-screen');
      if (open) { open._done(); return true; }
      if (r.overlay) return false;
      questScreen(false);
      return true;
    };
    return { relPopup, questScreen, onKey, playJingle, show, preview: (ev) => { queue.push(ev); pumpCustom(); } };
  };
})();
