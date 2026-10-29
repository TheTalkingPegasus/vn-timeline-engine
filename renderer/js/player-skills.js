// Skilltree im Spiel: Bildschirm mit Knoten, Linien und Detail-Feld zum Kaufen (Taste T, Pausenmenü).
// Auch als Probelauf im Editor nutzbar (VN.SkillScreen.open mit eigenem Spielstand).
(function () {
  const { el } = VN;
  const SK = () => VN.Skills;
  const tr = (id, t) => (VN.tr ? VN.tr(id, t || '') : t || '');

  VN.SkillScreen = {
    // opts: { host, rs, tree, onClose, onBuy(gains), test }
    open(opts) {
      const rs = opts.rs;
      const trees = SK().trees().filter((t) => (t.nodes || []).length);
      if (!trees.length) { opts.onClose && opts.onClose(); return null; }
      let t = trees.find((x) => x.id === opts.tree) || trees[0];
      let selId = null;
      const box = el('div', { class: 'sk-screen', onclick: (e) => e.stopPropagation() });
      opts.host.appendChild(box);
      const close = () => { box.remove(); opts.onClose && opts.onClose(); };
      box._done = close;
      const effText = (n, lvl) => {
        const E = SK().effectsAll();
        return (n.effects || []).map((e) => { const d = E[e.type]; return d && d.text ? d.text(e, Math.max(1, lvl)) : ''; }).filter(Boolean);
      };
      const draw = () => {
        box.innerHTML = '';
        const head = el('div', { class: 'sk-head' }, el('h2', null, 'Skilltree'));
        if (trees.length > 1) head.appendChild(el('div', { class: 'sk-tabs' }, ...trees.map((x) => el('button', { class: 'sk-tab' + (x === t ? ' on' : ''), onclick: () => { t = x; selId = null; draw(); } }, tr(x.id + ':name', x.name)))));
        head.appendChild(el('div', { style: { flex: '1' } }));
        head.appendChild(el('span', { class: 'sk-wallet' }, SK().payName(t) + ': ', el('strong', null, String(Math.floor(SK().wallet(rs, t))))));
        if (opts.test) head.appendChild(el('span', { class: 'sk-test' }, 'Probelauf'));
        // Fläche
        const area = el('div', { class: 'sk-area' });
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'sk-lines'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
        area.appendChild(svg);
        for (const n of t.nodes) for (const r of n.reqs || []) {
          const o = SK().node(t, r); if (!o) continue;
          if (SK().status(rs, t, n) === 'hidden' && SK().status(rs, t, o) === 'hidden') continue;
          const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          ln.setAttribute('x1', o.x); ln.setAttribute('y1', o.y); ln.setAttribute('x2', n.x); ln.setAttribute('y2', n.y);
          ln.setAttribute('vector-effect', 'non-scaling-stroke');
          ln.setAttribute('class', SK().level(rs, t, o) > 0 ? 'on' : '');
          svg.appendChild(ln);
        }
        for (const n of t.nodes) {
          const st = SK().status(rs, t, n);
          const lvl = SK().level(rs, t, n);
          const hidden = st === 'hidden';
          area.appendChild(el('button', {
            class: 'sk-pnode ' + (n.kind || 'normal') + ' st-' + st + (lvl ? ' owned' : '') + (selId === n.id ? ' sel' : ''),
            style: { left: n.x + '%', top: n.y + '%' },
            onclick: () => { selId = n.id; draw(); }
          }, hidden ? el('span', { class: 'sk-ico' }, '?') : n.image && VN.assetUrl(n.image) ? el('span', { class: 'sk-img', style: { backgroundImage: `url("${VN.assetUrl(n.image)}")` } }) : el('span', { class: 'sk-ico' }, n.icon || '⭐'),
            SK().max(n) > 1 && !hidden ? el('span', { class: 'sk-plv' }, lvl + '/' + SK().max(n)) : null));
        }
        // Details
        const side = el('div', { class: 'sk-side' });
        const n = SK().node(t, selId);
        if (n) {
          const st = SK().status(rs, t, n), lvl = SK().level(rs, t, n), hidden = st === 'hidden';
          side.appendChild(el('div', { class: 'sk-dtitle' }, hidden ? '???' : (n.icon ? n.icon + ' ' : '') + tr(n.id + ':name', n.name)));
          if (!hidden && n.desc) side.appendChild(el('div', { class: 'sk-ddesc' }, tr(n.id + ':desc', n.desc)));
          if (!hidden) {
            if (SK().max(n) > 1) side.appendChild(el('div', { class: 'sk-dlv' }, 'Stufe ' + lvl + ' von ' + SK().max(n)));
            const now = lvl ? effText(n, lvl) : [], next = lvl < SK().max(n) ? effText(n, lvl + 1) : [];
            if (now.length) side.appendChild(el('div', { class: 'sk-dfx' }, el('div', { class: 'sk-dlab' }, 'Jetzt'), ...now.map((x) => el('div', null, x))));
            if (next.length) side.appendChild(el('div', { class: 'sk-dfx next' }, el('div', { class: 'sk-dlab' }, lvl ? 'Nächste Stufe' : 'Wirkung'), ...next.map((x) => el('div', null, x))));
          }
          if (st === 'locked' || st === 'hidden') {
            const reqs = (n.reqs || []).map((r) => SK().node(t, r)).filter(Boolean);
            const need = el('div', { class: 'sk-dneed' }, el('div', { class: 'sk-dlab' }, 'Voraussetzung'));
            if (reqs.length) need.appendChild(el('div', null, (n.reqMode === 'any' && reqs.length > 1 ? 'Eins davon: ' : '') + reqs.map((r) => (SK().status(rs, t, r) === 'hidden' ? '???' : tr(r.id + ':name', r.name))).join(', ')));
            if ((n.gate || []).length) need.appendChild(el('div', null, n.gateText ? tr(n.id + ':gate', n.gateText) : 'Erst später in der Geschichte'));
            side.appendChild(need);
          }
          if (st !== 'max') {
            const cost = SK().cost(n, lvl);
            side.appendChild(el('button', {
              class: 'sys-btn primary sk-buy', disabled: st !== 'buy',
              onclick: () => {
                const gains = SK().buy(rs, t, n);
                if (!gains) return;
                if (window.Theme) Theme.sound('item');
                box.querySelectorAll('.sk-pnode.sel').forEach((b) => b.classList.add('pop'));
                opts.onBuy && opts.onBuy(gains);
                draw();
              }
            }, (lvl ? 'Verbessern' : 'Freischalten') + ' · ' + cost + ' ' + SK().payName(t)));
            if (st === 'poor') side.appendChild(el('div', { class: 'sk-dpoor' }, 'Dir fehlen noch ' + Math.ceil(cost - SK().wallet(rs, t)) + ' ' + SK().payName(t) + '.'));
          } else side.appendChild(el('div', { class: 'sk-dmax' }, '✓ Gelernt'));
        } else side.appendChild(el('div', { class: 'sk-dempty' }, 'Wähle einen Skill.'));
        const pct = SK().refundPct(t);
        const foot = el('div', { class: 'sk-foot' },
          pct && Object.keys(SK().state(rs).own[t.id] || {}).length ? el('button', { class: 'sys-btn', onclick: () => { if (SK().respec(rs, t)) { opts.onBuy && opts.onBuy([]); draw(); } } }, 'Zurücksetzen (' + pct + ' % zurück)') : el('span'),
          el('button', { class: 'sys-btn', onclick: close }, 'Schließen (' + (SK().cfg().key || 't').toUpperCase() + ')'));
        box.append(head, el('div', { class: 'sk-body' }, area, side), foot);
        if (window.UiDesign) UiDesign.apply('skills', box);
      };
      draw();
      return box;
    }
  };

  // Einbindung in den Spieler (player.js): VN.PlayerSkills(H)
  VN.PlayerSkills = (H) => {
    const R = H.run;
    const screen = (treeId, back) => new Promise((resolve) => {
      const r = R();
      if (!r || !SK().on()) return resolve();
      r.overlay = 'skills';
      H.uiSound('open');
      const b = VN.SkillScreen.open({
        host: H.stage(), rs: r.rs, tree: treeId,
        onBuy: (gains) => { H.afterChange(gains); },
        onClose: () => { if (R()) R().overlay = null; if (back) H.pauseMenu(); resolve(); }
      });
      if (!b) { r.overlay = null; resolve(); }
    });
    const onKey = (e) => {
      const r = R();
      if (!r || !SK().on()) return false;
      if (e.key.toLowerCase() !== (SK().cfg().key || 't').toLowerCase()) return false;
      const open = H.stage().querySelector('.sk-screen');
      if (open) { open._done(); return true; }
      if (r.overlay) return false;
      screen(null, false);
      return true;
    };
    return { screen, onKey };
  };
})();
