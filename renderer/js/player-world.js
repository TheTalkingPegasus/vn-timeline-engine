// Welt & Orte im Spiel: Weltkarte (Taste M), Zuhause (Taste H), Reisen, Meldung „Neuer Ort“.
// Wird von player.js mit VN.PlayerWorld(H) eingebunden.
(function () {
  const { el } = VN;
  const W = () => VN.World;

  VN.PlayerWorld = (H) => {
    const R = H.run;
    const here = () => { const r = R(); return r ? W().state(r.rs).here : ''; };
    // Karte und Zuhause nur in freier Zeit und an einem Ort (nicht mitten in einer Story-Szene)
    const canRoam = () => {
      const r = R();
      if (!r || !W().on() || r.ended || r.replay) return false;
      const st = W().state(r.rs);
      return st.free && W().isLoc(r.scene) && !r.event;
    };

    // ---------- Reisen ----------
    const travelTo = async (id, opts = {}) => {
      const r = R();
      if (!r || !W().isLoc(id)) return;
      const st = W().state(r.rs);
      const from = st.here;
      if (id !== from && !opts.noTime && VN.Life && VN.Life.timeOn()) {
        const pin = opts.pin;
        let cost = pin && pin.cost != null && pin.cost !== '' ? Number(pin.cost) : Number(W().cfg().travel) || 0;
        if (cost > 0 && VN.bonus) cost = Math.max(0, Math.round(VN.bonus('travel.time', cost, r.rs)));
        if (cost > 0) { VN.Life.advance(r.rs, { mode: 'add', amount: cost }); if (window.Player) Player.onTime(); }
      }
      H.enterScene(id, 0);
    };

    // ---------- Weltkarte ----------
    let mapEl = null;
    const closeMap = () => { if (mapEl) { mapEl.remove(); mapEl = null; } const r = R(); if (r && r.overlay === 'map') r.overlay = null; };
    const openMap = (mapId) => new Promise((resolve) => {
      const r = R();
      if (!r || !W().on()) return resolve();
      const maps = W().maps();
      if (!maps.length) { VN.toast('Noch keine Karte angelegt'); return resolve(); }
      let cur = W().map(mapId) || W().mapOf(here()) || W().rootMap();
      closeMap();
      r.overlay = 'map';
      H.uiSound('open');
      mapEl = el('div', { class: 'wm-screen', onclick: (e) => e.stopPropagation() });
      H.stage().appendChild(mapEl);
      const done = () => { closeMap(); resolve(); };
      const draw = () => {
        mapEl.innerHTML = '';
        const rs = r.rs;
        const night = VN.Life && VN.Life.timeOn() && VN.Life.daytime(null, rs) === 'night';
        const img = (night && cur.nightImage) || cur.image;
        const crumbs = [];
        for (let m = cur, g = 0; m && g < 6; m = W().map(m.parent), g++) crumbs.unshift(m);
        const head = el('div', { class: 'wm-head' },
          el('div', { class: 'wm-crumbs' }, ...crumbs.map((m, i) => (i < crumbs.length - 1
            ? el('button', { class: 'wm-crumb', onclick: () => { cur = m; draw(); } }, VN.tr(m.id + ':name', m.name || 'Karte'))
            : el('strong', { class: 'wm-title' }, VN.tr(m.id + ':name', m.name || 'Karte'))))),
          VN.Life && VN.Life.timeOn() ? el('span', { class: 'wm-time' }, '🕰 ' + VN.Life.timeText(VN.Life.initRun(rs))) : null,
          el('button', { class: 'sys-btn wm-close', onclick: done }, 'Schließen (M)'));
        const area = el('div', { class: 'wm-area' });
        const box = el('div', { class: 'wm-box' });
        if (img && VN.assetUrl(img)) {
          const im = el('img', { class: 'wm-img', src: VN.assetUrl(img), alt: '', draggable: 'false' });
          im.addEventListener('load', () => { box.style.aspectRatio = im.naturalWidth + ' / ' + im.naturalHeight; });
          box.appendChild(im);
        } else box.appendChild(el('div', { class: 'wm-img ph' }, 'Kartenbild fehlt'));
        const pos = {};
        for (const pin of cur.pins || []) {
          let state = 'open', label = '', title = '', mark = '';
          if (pin.map) {
            const sub = W().map(pin.map);
            if (!sub) continue;
            label = VN.tr(sub.id + ':name', sub.name || 'Karte');
            state = 'sub';
          } else {
            const s = VN.scene(pin.loc);
            if (!s || !s.loc) continue;
            state = W().status(rs, s.id);
            if (state === 'hidden') continue;
            label = state === 'unknown' ? '???' : VN.tr(s.id + ':name', s.loc.label || s.name);
            if (state === 'locked') title = VN.tr(s.id + ':lock', s.loc.lockText || 'Noch nicht zugänglich');
            if (state === 'closed') title = 'Geschlossen' + (s.loc.hours && VN.project.time ? ' – offen: ' + s.loc.hours.map((i) => VN.project.time.slots[i]).filter(Boolean).join(', ') : '');
            if (state === 'open') mark = W().markFor(rs, s.id);
          }
          const isHere = pin.loc && pin.loc === here();
          const iconUrl = pin.icon && VN.assetUrl(pin.icon);
          const node = el('button', {
            class: 'wm-pin ' + state + (isHere ? ' here' : ''), style: { left: pin.x + '%', top: pin.y + '%' }, title: title || label, 'aria-label': label,
            onmouseenter: () => H.uiSound('hover'),
            onclick: async (e) => {
              e.stopPropagation();
              if (state === 'sub') { cur = W().map(pin.map); draw(); return; }
              if (state === 'locked' || state === 'closed' || state === 'unknown') { node.animate([{ transform: 'translate(-50%,-50%) translateX(-4px)' }, { transform: 'translate(-50%,-50%) translateX(4px)' }, { transform: 'translate(-50%,-50%)' }], { duration: 220 }); showTip(title || 'Noch unbekannt'); return; }
              if (isHere) { done(); return; }
              H.uiSound('click');
              await walk(pos[here()], pos[pin.loc]);
              closeMap();
              resolve();
              travelTo(pin.loc, { pin });
            }
          },
            iconUrl ? el('span', { class: 'wm-ico', style: { backgroundImage: `url("${iconUrl}")` } }) : el('span', { class: 'wm-dot' }),
            el('span', { class: 'wm-lbl' }, label),
            mark ? el('span', { class: 'wm-mark' + (mark === '♥' ? ' heart' : '') }, mark) : null,
            isHere ? el('span', { class: 'wm-here' }, 'Du bist hier') : null);
          if (pin.loc) pos[pin.loc] = [pin.x, pin.y];
          box.appendChild(node);
        }
        const tip = el('div', { class: 'wm-tip', hidden: true });
        const showTip = (t) => { tip.textContent = t; tip.hidden = false; clearTimeout(tip._t); tip._t = setTimeout(() => { tip.hidden = true; }, 2200); };
        // Kleine Reise-Animation: Punkt wandert vom aktuellen Ort zum Ziel
        const walk = (a, b) => new Promise((res) => {
          if (!a || !b || W().cfg().walkAnim === false) return res();
          const dot = el('div', { class: 'wm-walker', style: { left: a[0] + '%', top: a[1] + '%' } });
          box.appendChild(dot);
          dot.animate([{ left: a[0] + '%', top: a[1] + '%' }, { left: b[0] + '%', top: b[1] + '%' }], { duration: 650, easing: 'ease-in-out', fill: 'forwards' }).onfinish = () => res();
        });
        area.appendChild(box);
        mapEl.append(head, area, tip);
        if (window.UiDesign) UiDesign.apply('map', mapEl);
      };
      draw();
      mapEl._done = done;
    });

    // ---------- Knöpfe und Tasten ----------
    const box = el('span', { class: 'pl-ctrl-x' });
    const drawCtrl = () => {
      box.innerHTML = '';
      if (!canRoam()) return;
      const c = W().cfg();
      const r = R();
      if (c.hudMap !== false && W().maps().length) box.appendChild(el('button', { title: 'Weltkarte (M)', onclick: (e) => { e.stopPropagation(); openMap(); } }, '🗺 Karte'));
      if (c.hudHome !== false && W().homeOk(r.rs) && r.scene !== c.home) box.appendChild(el('button', { title: 'Nach Hause (H)', onclick: (e) => { e.stopPropagation(); goHome(); } }, '🏠 Zuhause'));
    };
    const goHome = () => { const r = R(); if (!r || !canRoam()) return; const h = W().cfg().home; if (W().homeOk(r.rs) && r.scene !== h) travelTo(h); };
    const onKey = (e) => {
      const r = R();
      if (!r || !W().on()) return false;
      const k = e.key.toLowerCase();
      if (k === 'm' && r.overlay === 'map' && mapEl) { mapEl._done(); return true; }
      if (r.overlay) return false;
      if (k === 'm' && canRoam() && W().maps().length) { openMap(); return true; }
      if (k === 'h' && canRoam()) { goHome(); return true; }
      return false;
    };
    // Meldung „Neuer Ort“
    const toast = (id) => {
      const s = VN.scene(id), st = H.stage();
      if (!s || !st) return;
      const b = el('div', { class: 'ach-toast world-toast' }, el('div', { class: 'ach-ico ph' }, '📍'), el('div', null, el('div', { class: 'ach-t1' }, 'Neuer Ort'), el('strong', null, VN.tr(s.id + ':name', (s.loc && s.loc.label) || s.name))));
      if (window.UiDesign) UiDesign.apply('map', b);
      st.appendChild(b);
      setTimeout(() => { b.classList.add('out'); setTimeout(() => b.remove(), 500); }, 2800);
    };
    return { openMap, closeMap, travelTo, goHome, ctrlBox: box, drawCtrl, onKey, toast, canRoam };
  };
})();
