// Aufbau im Spiel: Bildschirm mit Rohstoffen, Gebäuden und Zielen, Produktion im Hintergrund,
// Ertrag während das Spiel geschlossen war, Meilensteine mit Meldung. Auch als Probelauf im Editor.
(function () {
  const { el } = VN;
  const ID = () => VN.Idle;

  VN.IdleScreen = {
    // opts: { host, rs, test, onClose, onChange(gains), tt }
    open(opts) {
      const id = ID();
      const c = id.cfg();
      const rs = opts.rs;
      const tt = (x) => (opts.test ? VN.t(x) : VN.tp(x));
      const tr = (key, t) => (VN.tr ? VN.tr(key, t || '') : t || '');
      const box = el('div', { class: 'id-screen', onclick: (e) => e.stopPropagation() });
      opts.host.appendChild(box);
      let timer = 0;
      const close = () => { clearInterval(timer); box.remove(); if (opts.onClose) opts.onClose(); };
      box._done = close;
      const unit = c.mode === 'gametime' ? tt('Tageszeit') : tt('Min.');
      const chipCur = (cur, n, cls) => { const cu = VN.project.currencies.find((x) => x.id === cur); return el('span', { class: 'id-cost ' + (cls || '') }, cu && cu.image && VN.assetUrl(cu.image) ? el('span', { class: 'mc-ico', style: { backgroundImage: `url("${VN.assetUrl(cu.image)}")` } }) : el('span', { class: 'mc-dot', style: { background: (cu && cu.color) || '#e8c86a' } }), id.fmtNum(n)); };
      const float = (anchor, text) => {
        const r = anchor.getBoundingClientRect(), b = box.getBoundingClientRect();
        const n = el('div', { class: 'id-float', style: { left: (r.left + r.width / 2 - b.left) + 'px', top: (r.top - b.top) + 'px' } }, text);
        box.appendChild(n); setTimeout(() => n.remove(), 1000);
      };
      const changed = (g) => { draw(); if (opts.onChange) opts.onChange(g || []); };

      const draw = () => {
        box.innerHTML = '';
        // Kopf: Titel, Rohstoffe mit Rate, Test-Knöpfe
        const rate = id.rate(rs);
        const res = el('div', { class: 'id-res' });
        const used = new Set();
        for (const b of c.buildings) for (const x of [...(b.prods || []), ...(b.costs || [])]) if (x.cur) used.add(x.cur);
        for (const cu of VN.project.currencies) {
          if (!used.has(cu.id)) continue;
          res.appendChild(el('span', { class: 'id-rchip' }, chipCur(cu.id, rs.money[cu.id] || 0), el('small', null, rate[cu.id] ? '+' + id.fmtNum(rate[cu.id]) + '/' + unit : '')));
        }
        const cu = id.catchup(rs);
        const head = el('div', { class: 'id-head' }, el('h2', null, tr('idle:title', c.title || 'Aufbau')), res,
          cu > 1 ? el('span', { class: 'id-boost', title: tt('Das aktuelle Ziel dauert länger als geplant – alles läuft schneller.') }, '⚡ ×' + String(cu).replace('.', ',')) : null,
          el('div', { style: { flex: '1' } }),
          opts.test ? el('span', { class: 'id-test' }, tt('Probelauf'),
            ...[[10, '+10'], [60, '+60']].map(([u, l]) => el('button', { class: 'id-ff', onclick: () => { id.produce(rs, u); const g = id.checkMilestones(rs); changed(g); } }, l + ' ' + unit))) : null);
        // Gebäude
        const grid = el('div', { class: 'id-grid' });
        for (const b of c.buildings) {
          const st = id.status(rs, b);
          if (st === 'locked' && b.hideLocked && !id.level(rs, b)) continue;
          const lvl = id.level(rs, b);
          const url = b.image && VN.assetUrl(b.image);
          const pic = url ? el('div', { class: 'id-pic img', style: { backgroundImage: `url("${url}")` } }) : el('div', { class: 'id-pic' }, b.icon || '🏠');
          const clickable = c.click && b.clickable && lvl > 0;
          if (clickable) {
            pic.classList.add('clk');
            pic.title = tt('Klicken zum Sammeln');
            pic.addEventListener('click', () => { const g = id.click(rs, b); if (g) { if (window.Theme) Theme.sound('click'); float(pic, '+' + g.amount + ' ' + id.curName(g.cur)); pic.classList.remove('pop'); void pic.offsetWidth; pic.classList.add('pop'); const ms = id.checkMilestones(rs); if (ms.length || ms.reached.length) changed(ms); else { updateNums(); if (opts.onChange) opts.onChange([]); } } });
          }
          const now = id.prodOf(b, lvl, rs), next = id.prodOf(b, lvl + 1, rs);
          const prodTxt = Object.entries(lvl ? now : next).map(([k, v]) => '+' + id.fmtNum(v) + ' ' + id.curName(k) + '/' + unit).join(' · ');
          const card = el('div', { class: 'id-card st-' + st + (lvl ? ' own' : '') },
            pic,
            el('div', { class: 'id-info' },
              el('div', { class: 'id-name' }, tr(b.id + ':name', b.name), el('span', { class: 'id-lv' }, lvl ? tt('Stufe') + ' ' + lvl + (id.max(b) > 1 ? '/' + id.max(b) : '') : tt('Noch nicht gebaut'))),
              b.desc ? el('div', { class: 'id-desc' }, tr(b.id + ':desc', b.desc)) : null,
              el('div', { class: 'id-prod' + (lvl ? '' : ' dim') }, (lvl ? '' : tt('Bringt') + ' ') + prodTxt)));
          if (st === 'locked') card.appendChild(el('div', { class: 'id-lock' }, '🔒 ' + ((b.conds || []).length ? (b.conds || []).map((x) => VN.condText(x)).join(', ') : VN.tp('Noch nicht freigeschaltet'))));
          else if (st === 'max') card.appendChild(el('div', { class: 'id-max' }, '✓ ' + tt('Voll ausgebaut')));
          else {
            const cost = id.cost(b, lvl, rs);
            const btn = el('button', { class: 'sys-btn id-buy' + (st === 'buy' ? ' primary' : ''), disabled: st !== 'buy', onclick: () => {
              if (!id.build(rs, b)) return;
              if (window.Theme) Theme.sound('item');
              const g = id.checkMilestones(rs);
              changed(g);
              const nb = box.querySelectorAll('.id-card')[[...c.buildings].filter((x) => !(id.status(rs, x) === 'locked' && x.hideLocked && !id.level(rs, x))).indexOf(b)];
              if (nb) nb.classList.add('pop');
            } }, lvl ? tt('Ausbauen') : tt('Bauen'), el('span', { class: 'id-costs' }, ...cost.map((x) => chipCur(x.cur, x.amount, (rs.money[x.cur] || 0) >= x.amount ? '' : 'poor'))));
            btn.dataset.bid = b.id;
            card.appendChild(btn);
          }
          grid.appendChild(card);
        }
        if (!grid.children.length) grid.appendChild(el('div', { class: 'id-empty' }, tt('Noch keine Gebäude.')));
        // Ziele
        const side = el('div', { class: 'id-side' }, el('div', { class: 'id-stitle' }, tt('Ziele')));
        const next = id.nextMilestone(rs);
        for (const m of c.milestones) {
          const done = !!id.state(rs).done[m.id];
          const isNext = m === next;
          if (!done && !isNext) { side.appendChild(el('div', { class: 'id-ms future' }, '○ ', c.hidden ? '???' : tr(m.id + ':name', m.name))); continue; }
          const row = el('div', { class: 'id-ms' + (done ? ' done' : ' now') }, el('div', null, done ? '✓ ' : '◆ ', tr(m.id + ':name', m.name)));
          if (isNext) {
            if (m.desc) row.appendChild(el('div', { class: 'id-mdesc' }, tr(m.id + ':desc', m.desc)));
            row.appendChild(el('div', { class: 'id-mconds' }, (m.conds || []).map((x) => VN.condText(x)).join(' · ')));
            row.appendChild(el('div', { class: 'id-bar' }, el('i', { style: { width: Math.round(id.progress(rs, m) * 100) + '%' } })));
          }
          side.appendChild(row);
        }
        if (!c.milestones.length) side.appendChild(el('div', { class: 'id-ms future' }, tt('Keine Ziele.')));
        const foot = el('div', { class: 'id-foot' }, el('span', { class: 'id-hint' }, c.click ? tt('Tipp: Auf gebaute Gebäude klicken bringt sofort etwas.') : ''),
          el('button', { class: 'sys-btn', onclick: close }, tt('Schließen') + (c.key ? ' (' + c.key.toUpperCase() + ')' : '')));
        box.append(head, el('div', { class: 'id-body' }, grid, side), foot);
        if (window.UiDesign) UiDesign.apply('idle', box);
        lastSig = sigOf();
      };
      // Nur Zahlen und Knöpfe auffrischen (ohne neu aufzubauen, damit Klicks und Animationen nicht verloren gehen)
      let lastSig = '';
      const sigOf = () => c.buildings.map((b) => id.status(rs, b) + id.level(rs, b)).join() + '|' + Object.keys(id.state(rs).done).length + '|' + id.catchup(rs);
      const updateNums = () => {
        const sig = sigOf();
        if (sig !== lastSig) { lastSig = sig; draw(); return; }
        const rate = id.rate(rs);
        const chips = box.querySelectorAll('.id-rchip');
        let i = 0;
        const used = new Set();
        for (const b of c.buildings) for (const x of [...(b.prods || []), ...(b.costs || [])]) if (x.cur) used.add(x.cur);
        for (const cu of VN.project.currencies) {
          if (!used.has(cu.id)) continue;
          const ch = chips[i++]; if (!ch) break;
          ch.firstChild.lastChild.textContent = id.fmtNum(rs.money[cu.id] || 0);
          ch.lastChild.textContent = rate[cu.id] ? '+' + id.fmtNum(rate[cu.id]) + '/' + unit : '';
        }
        for (const btn of box.querySelectorAll('.id-buy')) {
          const b = id.building(btn.dataset.bid); if (!b) continue;
          const cost = id.cost(b, id.level(rs, b), rs);
          btn.querySelectorAll('.id-cost').forEach((n, k) => n.classList.toggle('poor', !!cost[k] && (rs.money[cost[k].cur] || 0) < cost[k].amount));
        }
        const bar = box.querySelector('.id-ms.now .id-bar i');
        const m = id.nextMilestone(rs);
        if (bar && m) bar.style.width = Math.round(id.progress(rs, m) * 100) + '%';
      };
      draw();

      // Probelauf: eigene Uhr (im Spiel tickt die Produktion im Spieler weiter, auch bei geschlossenem Fenster)
      if (!opts.static) timer = setInterval(() => {
        if (!box.isConnected) { clearInterval(timer); return; }
        if (opts.test && c.mode !== 'gametime') { id.produce(rs, 1 / 60); const g = id.checkMilestones(rs); if (g.reached.length) changed(g); }
        updateNums();
      }, 1000);
      return { box, close, refresh: updateNums };
    }
  };

  // ---------- Einbindung in den Spieler ----------
  VN.PlayerIdle = (H) => {
    const R = H.run;
    let screen = null;
    const announce = (g) => {
      if (!g) return;
      for (const m of g.reached || []) g.unshift({ kind: 'text', text: '🏰 ' + VN.tp('Ziel erreicht') + ': ' + VN.tr(m.id + ':name', m.name) + (m.message ? ' – ' + VN.tr(m.id + ':msg', m.message) : '') });
      if (g.length || (g.pending && g.pending.length)) H.afterChange(g);
    };
    // Uhr: läuft, solange ein Spiel läuft
    let timer = 0, lastHud = 0;
    const tick = () => {
      const r = R();
      if (!r || !ID().on()) return;
      const st = ID().state(r.rs);
      const now = Date.now();
      const dt = Math.max(0, Math.min(5000, now - (st.last || now)));
      st.last = now;
      let got = {};
      if (ID().cfg().mode !== 'gametime' && dt > 0 && !r.replay) got = ID().produce(r.rs, dt / 60000);
      if (ID()._pendingCheck || Object.keys(got).length) {
        ID()._pendingCheck = false;
        const g = ID().checkMilestones(r.rs);
        if (g.reached.length) announce(g);
      }
      if (screen) screen.refresh();
      else if (Object.keys(got).length && now - lastHud > 900) { lastHud = now; H.refreshHud(); }
    };
    const startClock = () => { clearInterval(timer); timer = setInterval(tick, 1000); };
    const stopClock = () => clearInterval(timer);
    // Spielstand geladen: Ertrag aus der Zeit, in der das Spiel geschlossen war
    const resume = () => {
      const r = R();
      if (!r || !ID().on()) return;
      const st = ID().state(r.rs);
      const c = ID().cfg();
      const now = Date.now();
      if (c.mode === 'offline' && st.last && now - st.last > 60000) {
        const mins = Math.min((now - st.last) / 60000, (Number(c.offlineMax) || 8) * 60);
        const got = ID().produce(r.rs, mins, (Number(c.offlinePct) || 0) / 100);
        const g = Object.entries(got).map(([id, n]) => ({ kind: 'money', id, count: n }));
        g.pending = [];
        if (g.length) g.unshift({ kind: 'text', text: '🏰 ' + VN.tp('Während du weg warst') + ' (' + ID().fmtTime(mins) + ')' });
        const ms = ID().checkMilestones(r.rs);
        for (const x of ms) g.push(x);
        g.reached = ms.reached;
        st.last = now;
        setTimeout(() => announce(g), 900);
      }
      st.last = now;
    };
    const open = (back) => new Promise((resolve) => {
      const r = R();
      if (!r || !ID().on()) return resolve();
      r.overlay = 'idle';
      H.uiSound('open');
      H.stage().classList.add('in-panel');
      screen = VN.IdleScreen.open({ host: H.stage(), rs: r.rs, onChange: (g) => { if (g && (g.length || (g.reached || []).length)) announce(g); H.refreshHud(); }, onClose: () => { screen = null; H.stage().classList.remove('in-panel'); if (R()) R().overlay = null; if (back) H.pauseMenu(); resolve(); } });
    });
    const onKey = (e) => {
      const r = R();
      if (!r || !ID().on() || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return false;
      const key = ID().cfg().key;
      if (!key || e.key.toLowerCase() !== key.toLowerCase()) return false;
      if (screen) { screen.close(); return true; }
      if (r.overlay || r.blocked) return false;
      open(false);
      return true;
    };
    const closeScreen = () => { if (screen) { screen.close(); return true; } return false; };
    return { open, onKey, startClock, stopClock, resume, closeScreen, get isOpen() { return !!screen; } };
  };
})();
