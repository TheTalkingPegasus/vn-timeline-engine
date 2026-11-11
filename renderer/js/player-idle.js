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
      const V = id.view();
      const rs = opts.rs;
      if (opts.test) id.start(rs); // Probelauf im Editor: läuft immer
      const tt = (x) => (opts.test ? VN.t(x) : VN.tp(x));
      const tr = (key, t) => (VN.tr ? VN.tr(key, t || '') : t || '');
      const layout = ['cards', 'list', 'clicker', 'map'].includes(V.layout) ? V.layout : 'cards';
      const box = el('div', { class: 'id-screen id-l-' + layout + (V.full ? ' id-full' : ''), onclick: (e) => e.stopPropagation() });
      const content = el('div', { class: 'id-content' });
      box.appendChild(content);
      opts.host.appendChild(box);
      let timer = 0;
      const close = () => { clearInterval(timer); if (adv) adv.stop(); box.remove(); if (opts.onClose) opts.onClose(); };
      box._done = close;
      const unit = tt(id.unitShort());
      const chipCur = (cur, n, cls) => { const cu = VN.project.currencies.find((x) => x.id === cur); return el('span', { class: 'id-cost ' + (cls || '') }, cu && cu.image && VN.assetUrl(cu.image) ? el('span', { class: 'mc-ico', style: { backgroundImage: `url("${VN.assetUrl(cu.image)}")` } }) : el('span', { class: 'mc-dot', style: { background: (cu && cu.color) || '#e8c86a' } }), id.fmtNum(n)); };
      const float = (anchor, text) => {
        const r = anchor.getBoundingClientRect(), b = box.getBoundingClientRect();
        const n = el('div', { class: 'id-float', style: { left: (r.left + r.width / 2 - b.left) + 'px', top: (r.top - b.top) + 'px' } }, text);
        box.appendChild(n); setTimeout(() => n.remove(), 1000);
      };
      const changed = (g) => { draw(); if (opts.onChange) opts.onChange(g || []); if (g && (g.reached || []).length && adv) adv.say('milestone'); };
      const usedCurs = () => { const used = new Set(); for (const b of c.buildings) for (const x of [...(b.prods || []), ...(b.costs || [])]) if (x.cur) used.add(x.cur); if (layout === 'clicker' && V.clicker.cur) used.add(V.clicker.cur); return VN.project.currencies.filter((cu) => used.has(cu.id)); };
      const visible = () => c.buildings.filter((b) => !(id.status(rs, b) === 'locked' && b.hideLocked && !id.level(rs, b)));
      const pic = (b, cls) => { const url = b.image && VN.assetUrl(b.image); return url ? el('div', { class: 'id-pic img ' + (cls || ''), style: { backgroundImage: `url("${url}")` } }) : el('div', { class: 'id-pic ' + (cls || '') }, b.icon || '🏠'); };
      const prodText = (b, lvl) => { const now = id.prodOf(b, lvl, rs), next = id.prodOf(b, lvl + 1, rs); return Object.entries(lvl ? now : next).map(([k, v]) => '+' + id.fmtNum(v) + ' ' + id.curName(k) + '/' + unit).join(' · '); };
      // Kaufen (auch mehrfach); zu wenig Geld → Berater meldet sich
      const buy = (b, n, anchor) => {
        const k = n === 1 ? (id.build(rs, b) ? 1 : 0) : id.buildN(rs, b, n);
        if (!k) { if (adv) adv.say('poor'); if (window.Theme) Theme.sound('error'); return; }
        if (window.Theme) Theme.sound('item');
        const g = id.checkMilestones(rs);
        changed(g);
        if (adv && !(g.reached || []).length) adv.say('buy');
        const nb = box.querySelector(`[data-card="${b.id}"]`);
        if (nb) { nb.classList.remove('pop'); void nb.offsetWidth; nb.classList.add('pop'); }
      };
      const buyBtn = (b, n, label, extra) => {
        const st = id.status(rs, b), q = n === 1 ? { cost: id.cost(b, id.level(rs, b), rs), ok: st === 'buy' } : id.costN(rs, b, n);
        const btn = el('button', { class: 'sys-btn id-buy' + (q.ok ? ' primary' : ' off') + (extra ? ' ' + extra : ''), onclick: (e) => { e.stopPropagation(); buy(b, n, btn); } }, label, el('span', { class: 'id-costs' }, ...q.cost.map((x) => chipCur(x.cur, x.amount, (rs.money[x.cur] || 0) >= x.amount ? '' : 'poor'))));
        btn.dataset.bid = b.id; btn.dataset.n = String(n);
        return btn;
      };
      const lockText = (b) => '🔒 ' + ((b.conds || []).length ? (b.conds || []).map((x) => VN.condText(x)).join(', ') : VN.tp('Noch nicht freigeschaltet'));
      const clickBuilding = (b, p) => {
        if (!(c.click && b.clickable && id.level(rs, b) > 0)) return;
        p.classList.add('clk');
        p.title = tt('Klicken zum Sammeln');
        p.addEventListener('click', (e) => { e.stopPropagation(); const g = id.click(rs, b); if (g) { if (window.Theme) Theme.sound('click'); float(p, '+' + g.amount + ' ' + id.curName(g.cur)); p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); const ms = id.checkMilestones(rs); if (ms.length || ms.reached.length) changed(ms); else { updateNums(); if (opts.onChange) opts.onChange([]); } } });
      };
      // Ziele (Seitenleiste oder kompakt)
      const goals = (compact) => {
        const side = el('div', { class: 'id-side' + (compact ? ' compact' : '') }, el('div', { class: 'id-stitle' }, tt('Ziele')));
        const next = id.nextMilestone(rs);
        for (const m of c.milestones) {
          const done = !!id.state(rs).done[m.id];
          const isNext = m === next;
          if (compact && !isNext) continue;
          if (!done && !isNext) { side.appendChild(el('div', { class: 'id-ms future' }, '○ ', c.hidden ? '???' : tr(m.id + ':name', m.name))); continue; }
          const row = el('div', { class: 'id-ms' + (done ? ' done' : ' now') }, el('div', null, done ? '✓ ' : '◆ ', tr(m.id + ':name', m.name)));
          if (isNext) {
            if (m.desc && !compact) row.appendChild(el('div', { class: 'id-mdesc' }, tr(m.id + ':desc', m.desc)));
            row.appendChild(el('div', { class: 'id-mconds' }, (m.conds || []).map((x) => VN.condText(x)).join(' · ')));
            row.appendChild(el('div', { class: 'id-bar' }, el('i', { style: { width: Math.round(id.progress(rs, m) * 100) + '%' } })));
          }
          side.appendChild(row);
        }
        if (compact && !next) side.appendChild(el('div', { class: 'id-ms done' }, '✓ ' + tt('Alle Ziele erreicht')));
        if (!c.milestones.length) side.appendChild(el('div', { class: 'id-ms future' }, tt('Keine Ziele.')));
        return side;
      };

      // ---------- Layouts ----------
      const cardsView = () => {
        const grid = el('div', { class: 'id-grid' });
        for (const b of visible()) {
          const st = id.status(rs, b), lvl = id.level(rs, b);
          const p = pic(b); clickBuilding(b, p);
          const card = el('div', { class: 'id-card st-' + st + (lvl ? ' own' : ''), 'data-card': b.id }, p,
            el('div', { class: 'id-info' },
              el('div', { class: 'id-name' }, tr(b.id + ':name', b.name), el('span', { class: 'id-lv' }, lvl ? tt('Stufe') + ' ' + lvl + (id.max(b) > 1 ? '/' + id.max(b) : '') : tt('Noch nicht gebaut'))),
              b.desc ? el('div', { class: 'id-desc' }, tr(b.id + ':desc', b.desc)) : null,
              el('div', { class: 'id-prod' + (lvl ? '' : ' dim') }, (lvl ? '' : tt('Bringt') + ' ') + prodText(b, lvl))));
          if (st === 'locked') card.appendChild(el('div', { class: 'id-lock' }, lockText(b)));
          else if (st === 'max') card.appendChild(el('div', { class: 'id-max' }, '✓ ' + tt('Voll ausgebaut')));
          else card.appendChild(buyBtn(b, 1, lvl ? tt('Ausbauen') : tt('Bauen')));
          grid.appendChild(card);
        }
        if (!grid.children.length) grid.appendChild(el('div', { class: 'id-empty' }, tt('Noch keine Gebäude.')));
        return el('div', { class: 'id-body' }, grid, goals());
      };
      // Liste wie AdVenture Capitalist: Zeile mit großem Symbol, Arbeits-Balken und Kauf ×1 / ×10 / Max
      const listView = () => {
        const list = el('div', { class: 'id-list' });
        for (const b of visible()) {
          const st = id.status(rs, b), lvl = id.level(rs, b);
          const p = pic(b, 'big'); clickBuilding(b, p);
          const speed = Math.max(0.6, 3.2 / Math.sqrt(1 + lvl * 0.4));
          const row = el('div', { class: 'id-row st-' + st + (lvl ? ' own' : ''), 'data-card': b.id }, p,
            el('div', { class: 'id-rmid' },
              el('div', { class: 'id-rname' }, tr(b.id + ':name', b.name), el('span', { class: 'id-badge' }, lvl ? String(lvl) : '0'), (() => { const nb = id.nextBoost(b, lvl); return nb && nb.at <= id.max(b) ? el('span', { class: 'id-boostn' }, '×' + String(nb.mul).replace('.', ',') + ' ' + tt('ab') + ' ' + nb.at) : null; })()),
              el('div', { class: 'id-rbar' + (lvl ? ' run' : '') }, el('i', { style: { animationDuration: speed.toFixed(2) + 's' } }), el('span', null, lvl ? prodText(b, lvl) : tt('Noch nicht gebaut') + ' · ' + tt('Bringt') + ' ' + prodText(b, 0)))),
            st === 'locked' ? el('div', { class: 'id-lock' }, lockText(b)) : st === 'max' ? el('div', { class: 'id-max' }, '✓ ' + tt('Voll ausgebaut')) :
              el('div', { class: 'id-rbuy' }, buyBtn(b, 1, '×1'), V.multi !== false ? buyBtn(b, 10, '×10', 'sm') : null, V.multi !== false ? buyBtn(b, 'max', tt('Max'), 'sm') : null));
          list.appendChild(row);
        }
        if (!list.children.length) list.appendChild(el('div', { class: 'id-empty' }, tt('Noch keine Gebäude.')));
        return el('div', { class: 'id-lbody' }, goals(true), list);
      };
      // Klicker wie Cookie Clicker: großes Objekt links, Laden rechts
      const clickerView = () => {
        const k = V.clicker;
        const cur = k.cur || (usedCurs()[0] || {}).id;
        const url = k.image && VN.assetUrl(k.image);
        const big = el('div', { class: 'id-big' + (url ? ' img' : ''), style: url ? { backgroundImage: `url("${url}")` } : null, onclick: (e) => {
          e.stopPropagation();
          const g = id.clickMain(rs);
          if (!g) return;
          if (window.Theme) Theme.sound('click');
          const r = big.getBoundingClientRect(), bb = box.getBoundingClientRect();
          const n = el('div', { class: 'id-float', style: { left: (e.clientX - bb.left) + 'px', top: (e.clientY - bb.top) + 'px' } }, '+' + id.fmtNum(g.amount));
          box.appendChild(n); setTimeout(() => n.remove(), 1000);
          big.classList.remove('tap'); void big.offsetWidth; big.classList.add('tap');
          const ms = id.checkMilestones(rs); if (ms.length || ms.reached.length) changed(ms); else { updateNums(); if (opts.onChange) opts.onChange([]); }
        } }, url ? null : k.icon || '🪙');
        const rate = id.rate(rs);
        const left = el('div', { class: 'id-cleft' },
          el('div', { class: 'id-cbig' }, chipCur(cur, rs.money[cur] || 0)),
          el('div', { class: 'id-crate' }, rate[cur] ? '+' + id.fmtNum(rate[cur]) + '/' + unit : ''),
          big,
          el('div', { class: 'id-clabel' }, k.label ? tr('idle:clicker', k.label) : '+' + id.fmtNum(Math.max(1, Number(k.amount) || 1)) + ' ' + tt('pro Klick')));
        const shop = el('div', { class: 'id-shop' }, el('div', { class: 'id-stitle' }, tt('Laden')));
        for (const b of visible()) {
          const st = id.status(rs, b), lvl = id.level(rs, b);
          const cost = id.cost(b, lvl, rs);
          const item = el('div', { class: 'id-sitem st-' + st, 'data-card': b.id, title: b.desc ? tr(b.id + ':desc', b.desc) : '', onclick: (e) => { e.stopPropagation(); if (st !== 'locked' && st !== 'max') buy(b, 1); } },
            pic(b, 'sm'),
            el('div', { class: 'id-sinfo' }, el('div', { class: 'id-sname' }, tr(b.id + ':name', b.name)), st === 'locked' ? el('div', { class: 'id-lock' }, lockText(b)) : st === 'max' ? el('div', { class: 'id-max' }, '✓') : el('div', { class: 'id-costs' }, ...cost.map((x) => chipCur(x.cur, x.amount, (rs.money[x.cur] || 0) >= x.amount ? '' : 'poor')))),
            el('div', { class: 'id-scount' }, String(lvl)));
          shop.appendChild(item);
        }
        return el('div', { class: 'id-cbody' }, left, goals(), shop);
      };
      // Karte / Dorf: Gebäude frei auf einem Bild, Klick öffnet den Ausbau
      let mapSel = null;
      const mapView = () => {
        const bg = V.mapBg && VN.assetUrl(V.mapBg);
        const map = el('div', { class: 'id-map', style: bg ? { backgroundImage: `url("${bg}")` } : null, onclick: () => { mapSel = null; draw(); } });
        visible().forEach((b, i) => {
          const st = id.status(rs, b), lvl = id.level(rs, b);
          const x = b.mx != null ? b.mx : 12 + (i % 5) * 18, y = b.my != null ? b.my : 25 + Math.floor(i / 5) * 28, w = b.ms || 13;
          const p = pic(b, 'map');
          const n = el('div', { class: 'id-mb st-' + st + (lvl ? ' own' : '') + (mapSel === b.id ? ' sel' : ''), 'data-card': b.id, style: { left: x + '%', top: y + '%', width: w + '%' }, onclick: (e) => { e.stopPropagation(); mapSel = mapSel === b.id ? null : b.id; draw(); } },
            p, el('span', { class: 'id-mlv' }, st === 'locked' ? '🔒' : lvl ? String(lvl) : '+'), st === 'buy' ? el('span', { class: 'id-mup' }, '▲') : null);
          if (lvl > 0 && c.click && b.clickable) n.addEventListener('dblclick', (e) => { e.stopPropagation(); const g = id.click(rs, b); if (g) { float(n, '+' + g.amount); updateNums(); } });
          map.appendChild(n);
        });
        const parts = [map, goals(true)];
        const b = mapSel && id.building(mapSel);
        if (b) {
          const st = id.status(rs, b), lvl = id.level(rs, b);
          parts.push(el('div', { class: 'id-mpanel', onclick: (e) => e.stopPropagation() }, pic(b),
            el('div', { class: 'id-info' }, el('div', { class: 'id-name' }, tr(b.id + ':name', b.name), el('span', { class: 'id-lv' }, lvl ? tt('Stufe') + ' ' + lvl + (id.max(b) > 1 ? '/' + id.max(b) : '') : tt('Noch nicht gebaut'))),
              b.desc ? el('div', { class: 'id-desc' }, tr(b.id + ':desc', b.desc)) : null, el('div', { class: 'id-prod' + (lvl ? '' : ' dim') }, (lvl ? '' : tt('Bringt') + ' ') + prodText(b, lvl))),
            st === 'locked' ? el('div', { class: 'id-lock' }, lockText(b)) : st === 'max' ? el('div', { class: 'id-max' }, '✓ ' + tt('Voll ausgebaut')) : buyBtn(b, 1, lvl ? tt('Ausbauen') : tt('Bauen'))));
        }
        return el('div', { class: 'id-mbody' }, ...parts);
      };

      const draw = () => {
        content.innerHTML = '';
        // Kopf: Titel, Rohstoffe mit Rate, Test-Knöpfe
        const rate = id.rate(rs);
        const res = el('div', { class: 'id-res' });
        for (const cu of usedCurs()) res.appendChild(el('span', { class: 'id-rchip' }, chipCur(cu.id, rs.money[cu.id] || 0), el('small', null, rate[cu.id] ? '+' + id.fmtNum(rate[cu.id]) + '/' + unit : '')));
        const cu = id.catchup(rs);
        const head = el('div', { class: 'id-head' }, el('h2', null, tr('idle:title', c.title || 'Aufbau')), res,
          cu > 1 ? el('span', { class: 'id-boost', title: tt('Das aktuelle Ziel dauert länger als geplant – alles läuft schneller.') }, '⚡ ×' + String(cu).replace('.', ',')) : null,
          el('div', { style: { flex: '1' } }),
          opts.test ? el('span', { class: 'id-test' }, tt('Probelauf'),
            ...[[10, '+10'], [60, '+60']].map(([u, l]) => el('button', { class: 'id-ff', onclick: () => { id.produce(rs, u / id.perMin()); const g = id.checkMilestones(rs); changed(g); } }, l + ' ' + unit))) : null,
          V.full ? el('button', { class: 'sys-btn id-x', title: tt('Schließen'), onclick: close }, '✕') : null);
        if (!id.running(rs)) head.appendChild(el('div', { class: 'id-wait' }, '⏸ ' + tt(c.startWhen === 'action' ? 'Der Aufbau startet erst durch ein Ereignis in der Geschichte.' : 'Der Aufbau startet, sobald es in der Geschichte so weit ist.')));
        const body = layout === 'list' ? listView() : layout === 'clicker' ? clickerView() : layout === 'map' ? mapView() : cardsView();
        const foot = el('div', { class: 'id-foot' }, el('span', { class: 'id-hint' }, layout === 'map' ? tt('Tipp: Gebäude anklicken zum Ausbauen.') : c.click ? tt('Tipp: Auf gebaute Gebäude klicken bringt sofort etwas.') : ''),
          el('button', { class: 'sys-btn', onclick: close }, tt('Schließen') + (c.key ? ' (' + c.key.toUpperCase() + ')' : '')));
        content.append(head, body, foot);
        if (window.UiDesign) UiDesign.apply('idle', box);
        lastSig = sigOf();
      };
      // Nur Zahlen und Knöpfe auffrischen (ohne neu aufzubauen, damit Klicks und Animationen nicht verloren gehen)
      let lastSig = '';
      const sigOf = () => c.buildings.map((b) => id.status(rs, b) + id.level(rs, b)).join() + '|' + Object.keys(id.state(rs).done).length + '|' + id.catchup(rs) + (layout === 'list' ? '|' + c.buildings.map((b) => id.costN(rs, b, 'max').count).join() : '');
      const updateNums = () => {
        const sig = sigOf();
        if (sig !== lastSig) { lastSig = sig; draw(); return; }
        const rate = id.rate(rs);
        const chips = box.querySelectorAll('.id-rchip');
        let i = 0;
        for (const cu of usedCurs()) {
          const ch = chips[i++]; if (!ch) break;
          ch.firstChild.lastChild.textContent = id.fmtNum(rs.money[cu.id] || 0);
          ch.lastChild.textContent = rate[cu.id] ? '+' + id.fmtNum(rate[cu.id]) + '/' + unit : '';
        }
        const cb = box.querySelector('.id-cbig .id-cost'); if (cb) { const cur = V.clicker.cur || (usedCurs()[0] || {}).id; cb.lastChild.textContent = id.fmtNum(rs.money[cur] || 0); }
        for (const btn of box.querySelectorAll('.id-buy')) {
          const b = id.building(btn.dataset.bid); if (!b) continue;
          const n = btn.dataset.n === 'max' ? 'max' : Number(btn.dataset.n) || 1;
          const q = n === 1 ? { cost: id.cost(b, id.level(rs, b), rs) } : id.costN(rs, b, n);
          btn.querySelectorAll('.id-cost').forEach((nn, k) => { if (q.cost[k]) { nn.classList.toggle('poor', (rs.money[q.cost[k].cur] || 0) < q.cost[k].amount); nn.lastChild.textContent = id.fmtNum(q.cost[k].amount); } });
          const ok = q.cost.every((x) => (rs.money[x.cur] || 0) >= x.amount) && id.status(rs, b) !== 'locked';
          btn.classList.toggle('primary', ok); btn.classList.toggle('off', !ok);
        }
        for (const it of box.querySelectorAll('.id-sitem')) { const b = id.building(it.dataset.card); if (!b) continue; const cost = id.cost(b, id.level(rs, b), rs); it.querySelectorAll('.id-cost').forEach((nn, k) => cost[k] && nn.classList.toggle('poor', (rs.money[cost[k].cur] || 0) < cost[k].amount)); }
        const bar = box.querySelector('.id-ms.now .id-bar i');
        const m = id.nextMilestone(rs);
        if (bar && m) bar.style.width = Math.round(id.progress(rs, m) * 100) + '%';
      };

      // ---------- Berater: Figur im Fenster mit Sprechblase ----------
      const adv = V.adv && V.adv.on && (V.adv.lines || []).some((l) => l.text) ? (() => {
        const A = V.adv, st = id.state(rs);
        st.adv = st.adv || {};
        const url = A.image && VN.assetUrl(A.image);
        const txt = el('div', { class: 'id-advtxt' });
        // Klick auf die Figur: nächster Satz („zwischendurch“), Klick auf die Blase: schließen
        const w = el('div', { class: 'id-adv side-' + (A.side === 'right' ? 'right' : 'left'), onclick: (e) => { e.stopPropagation(); if (w.classList.contains('talk')) w.classList.remove('talk'); else { last = 0; say('random') || say('open'); } } },
          el('div', { class: 'id-advwin' }, url ? el('div', { class: 'id-advimg', style: { backgroundImage: `url("${url}")` } }) : el('div', { class: 'id-advimg ph' }, '🙂')),
          el('div', { class: 'id-advbub' }, A.name ? el('div', { class: 'id-advname' }, tr('idle:advname', A.name)) : null, txt));
        box.appendChild(w);
        let hideT = 0, typeT = 0, last = 0, idleT = 0;
        const say = (when) => {
          const pool = (A.lines || []).filter((l) => l.text && (l.when || 'random') === when && VN.checkConds(l.conds || [], rs) && !(l.once && st.adv[l.id]));
          if (!pool.length) return false;
          if (when !== 'first' && when !== 'milestone' && when !== 'poor' && Date.now() - last < 4000) return false;
          const l = pool[Math.floor(Math.random() * pool.length)];
          st.adv[l.id] = 1; last = Date.now();
          const full = tr(l.id, l.text);
          clearTimeout(hideT); clearInterval(typeT);
          txt.textContent = ''; w.classList.add('talk');
          let k = 0; typeT = setInterval(() => { k += 2; txt.textContent = full.slice(0, k); if (k >= full.length) clearInterval(typeT); }, 28);
          hideT = setTimeout(() => w.classList.remove('talk'), Math.max(4000, full.length * 70));
          return true;
        };
        const every = Math.max(10, Number(A.every) || 45) * 1000;
        idleT = setInterval(() => { if (box.isConnected) say('random'); }, every);
        setTimeout(() => { if (!st.adv._first) { st.adv._first = 1; if (!say('first')) say('open'); } else say('open'); }, 500);
        return { say, stop: () => { clearTimeout(hideT); clearInterval(typeT); clearInterval(idleT); } };
      })() : null;
      draw();

      // Probelauf: eigene Uhr (im Spiel tickt die Produktion im Spieler weiter, auch bei geschlossenem Fenster)
      if (!opts.static) timer = setInterval(() => {
        if (!box.isConnected) { clearInterval(timer); return; }
        if (opts.test && c.mode !== 'gametime') { if (id.checkStart(rs)) changed([]); id.produce(rs, 1 / 60); const g = id.checkMilestones(rs); if (g.reached.length) changed(g); }
        updateNums();
      }, 1000);
      return { box, close, refresh: updateNums, redraw: () => draw(), say: (w) => adv && adv.say(w) };
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
      if (ID().checkStart(r.rs) && screen) screen.redraw();
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
      if (c.mode === 'offline' && ID().running(r.rs) && st.last && now - st.last > 60000) {
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
      VN.did(r.rs, 'screen', 'idle');
      if (ID().cfg().startWhen === 'firstOpen') ID().start(r.rs);
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
