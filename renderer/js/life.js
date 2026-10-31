// Lebenssimulation: Zeit & Kalender, Geld & Läden (später Beziehungen, Geschenke)
// Läuft im Editor und im fertigen Spiel.
(function () {
  const { el } = VN;
  const SLOT_DAY = ['morning', 'day', 'evening', 'night'];

  const Life = (VN.Life = {
    // ---------- Grundeinstellungen ----------
    ensure(p) {
      p.time = Object.assign({ enabled: false, slots: ['Morgen', 'Mittag', 'Abend', 'Nacht'].map(VN.t), days: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'].map(VN.t), startDay: 0, startSlot: 0, hud: true, autoDaytime: true, dayMap: {} }, p.time || {});
      p.economy = Object.assign({ enabled: false }, p.economy || {});
      p.shops = p.shops || [];
      p.pluginData = p.pluginData || {};
      return p;
    },
    timeOn() { return !!(VN.project && VN.project.time && VN.project.time.enabled); },

    // ---------- Zeit ----------
    initRun(rs) {
      const T = VN.project.time;
      rs.time = rs.time || { day: 1, slot: Math.min(T.slots.length - 1, Number(T.startSlot) || 0) };
      rs.shop = rs.shop || {};
      return rs;
    },
    weekday(rs) { const T = VN.project.time; return ((Number(T.startDay) || 0) + (rs.time.day - 1)) % T.days.length; },
    timeText(rs) {
      const T = VN.project.time;
      if (!rs || !rs.time) return '';
      return VN.tr('time:day', 'Tag') + ' ' + rs.time.day + ' · ' + VN.tr('time:wd' + Life.weekday(rs), T.days[Life.weekday(rs)] || '') + ' · ' + VN.tr('time:slot' + rs.time.slot, T.slots[rs.time.slot] || '');
    },
    // Tageszeit-Optik eines Hintergrunds: eigene Einstellung gewinnt, sonst aus der Spielzeit
    daytime(look, rs) {
      if (look && look.daytime) return look.daytime;
      if (!Life.timeOn() || !rs || !rs.time || !VN.project.time.autoDaytime) return look ? look.daytime : '';
      const T = VN.project.time;
      const m = T.dayMap && T.dayMap[rs.time.slot];
      if (m != null) return m;
      const n = T.slots.length;
      return n === 4 ? SLOT_DAY[rs.time.slot] : SLOT_DAY[Math.min(3, Math.floor(rs.time.slot / n * 4))];
    },
    advance(rs, a) {
      const T = VN.project.time, n = T.slots.length;
      Life.initRun(rs);
      const t = rs.time, day0 = t.day;
      if (a.mode === 'nextDay') { t.day += 1; t.slot = Number(a.slot) || 0; }
      else if (a.mode === 'to') { const s = Math.max(0, Math.min(n - 1, Number(a.slot) || 0)); if (s <= t.slot) t.day += 1; t.slot = s; }
      else { const k = t.slot + Math.max(0, Number(a.amount) || 1); t.day += Math.floor(k / n); t.slot = k % n; }
      if (t.day !== day0 && window.VNPlugin) setTimeout(() => VNPlugin.hook('onDayEnd', day0, t.day, VNPlugin.makeCtx(rs)), 0);
      if (window.VNPlugin) setTimeout(() => VNPlugin.hook('onTime', VNPlugin.makeCtx(rs)), 0);
    },

    // ---------- Bedingungen / Aktionen (von logic.js aufgerufen) ----------
    COND_TYPES: [['time', 'Zeit / Kalender']],
    ACTION_TYPES: [['time', 'Zeit vergehen lassen'], ['shop', 'Laden öffnen']],
    checkCond(c, rs) {
      if (c.type === 'time') {
        if (!rs.time) Life.initRun(rs);
        const ops = { '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '==': (a, b) => a == b, '!=': (a, b) => a != b, '>': (a, b) => a > b, '<': (a, b) => a < b };
        const cur = c.what === 'weekday' ? Life.weekday(rs) : c.what === 'day' ? rs.time.day : rs.time.slot;
        const f = ops[c.op || '=='];
        return f ? f(Number(cur), Number(c.value)) : false;
      }
      return null;
    },
    condText(c) {
      const T = VN.project.time;
      if (c.type === 'time') {
        if (c.what === 'day') return 'Tag ' + (c.op || '==') + ' ' + c.value;
        const names = c.what === 'weekday' ? T.days : T.slots;
        return (c.what === 'weekday' ? 'Wochentag ' : 'Tageszeit ') + ({ '==': 'ist', '!=': 'ist nicht' }[c.op || '=='] || c.op) + ' ' + (names[Number(c.value)] || '?');
      }
      return null;
    },
    condRow(row, c, sel, inp) {
      const T = VN.project.time;
      if (c.type !== 'time') return false;
      row.appendChild(sel(c.what || 'slot', [['slot', 'Tageszeit'], ['weekday', 'Wochentag'], ['day', 'Tag Nr.']], (v) => VN.mutate(() => { c.what = v; c.value = v === 'day' ? 1 : 0; c.op = '=='; })));
      if (c.what === 'day') { row.appendChild(sel(c.op || '>=', VN.OPS.map((o) => [o, o]), (x) => VN.mutate(() => { c.op = x; }), { width: '58px' })); row.appendChild(inp(c.value, (x) => VN.mutate(() => { c.value = Number(x); }), 'number')); }
      else {
        row.appendChild(sel(c.op || '==', [['==', 'ist'], ['!=', 'ist nicht']], (x) => VN.mutate(() => { c.op = x; }), { width: '86px' }));
        row.appendChild(sel(c.value || 0, (c.what === 'weekday' ? T.days : T.slots).map((n, i) => [i, n]), (x) => VN.mutate(() => { c.value = Number(x); })));
      }
      if (!T.enabled) row.appendChild(el('span', { class: 'muted small' }, '(Zeit ist aus)'));
      return true;
    },
    applyAction(a, rs, gains) {
      if (a.type === 'time') { Life.advance(rs, a); gains.time = true; return true; }
      if (a.type === 'shop' && a.shop) { gains.pending.push(Life.openShop(a.shop, rs)); return true; }
      return false;
    },
    actionText(a) {
      const T = VN.project.time;
      if (a.type === 'time') return a.mode === 'nextDay' ? 'Nächster Tag (' + (T.slots[Number(a.slot) || 0] || '') + ')' : a.mode === 'to' ? 'Zeit bis ' + (T.slots[Number(a.slot) || 0] || '?') : 'Zeit + ' + (a.amount || 1) + ' Tageszeit' + ((a.amount || 1) > 1 ? 'en' : '');
      if (a.type === 'shop') { const s = VN.project.shops.find((x) => x.id === a.shop); return 'Laden: ' + (s ? s.name : '?'); }
      return null;
    },
    actionRow(row, a, sel, inp) {
      const p = VN.project;
      if (a.type === 'time') {
        row.appendChild(sel(a.mode || 'add', [['add', 'um … Tageszeiten weiter'], ['to', 'bis zur Tageszeit'], ['nextDay', 'nächster Tag']], (v) => VN.mutate(() => { a.mode = v; a.amount = 1; a.slot = 0; })));
        if ((a.mode || 'add') === 'add') row.appendChild(inp(a.amount != null ? a.amount : 1, (x) => VN.mutate(() => { a.amount = Number(x); }), 'number'));
        else row.appendChild(sel(a.slot || 0, p.time.slots.map((n, i) => [i, n]), (x) => VN.mutate(() => { a.slot = Number(x); })));
        if (!p.time.enabled) row.appendChild(el('span', { class: 'muted small' }, '(Zeit ist aus)'));
        return true;
      }
      if (a.type === 'shop') {
        row.appendChild(sel(a.shop || '', [['', '— Laden —'], ...p.shops.map((s) => [s.id, s.name])], (v) => VN.mutate(() => { a.shop = v; })));
        return true;
      }
      return false;
    },

    // ---------- Läden ----------
    shopPrice(shop, e) { const it = VN.project.items.find((x) => x.id === e.item); return e.price != null && e.price !== '' ? Number(e.price) : Number(it && it.value) || 0; },
    openShop(shopId, rs) {
      const p = VN.project;
      const shop = p.shops.find((x) => x.id === shopId);
      if (!shop || !window.VNPlugin) return Promise.resolve();
      const ctx = VNPlugin.makeCtx(rs);
      const cur = p.currencies.find((c) => c.id === shop.currency) || p.currencies[0];
      return new Promise((resolve) => {
        const o = ctx.overlay({ width: '62%' });
        o.el.classList.add('shop-panel');
        let tab = 'buy', cat = null, selId = null;
        rs.shop[shop.id] = rs.shop[shop.id] || {};
        const bought = rs.shop[shop.id];
        const curName = cur ? VN.tr(cur.id + ':name', cur.name) : '';
        const refresh = () => { window.Player && Player.refreshHud && Player.refreshHud(); };
        // Einträge für Kaufen/Verkaufen (für beide Ansichten gleich)
        const entries = () => {
          const out = [];
          if (tab === 'buy') {
            for (const e of shop.items || []) {
              const it = p.items.find((x) => x.id === e.item);
              if (!it) continue;
              const price = Math.max(0, Math.round(VN.bonus ? VN.bonus('shop.buy', Life.shopPrice(shop, e), rs) : Life.shopPrice(shop, e)));
              const left = Number(e.stock) >= 0 ? Number(e.stock) - (bought[it.id] || 0) : Infinity;
              out.push({ it, price, left, label: left > 0 ? 'Kaufen' : 'Ausverkauft', ok: left > 0 && (!cur || (rs.money[cur.id] || 0) >= price),
                sub: price + ' ' + curName + (left !== Infinity ? ' · noch ' + left : ''),
                act: () => { if (cur) VN.addMoney(rs, cur.id, -price); VN.giveItem(rs, it.id, 1); bought[it.id] = (bought[it.id] || 0) + 1; if (window.Theme) Theme.sound('item'); refresh(); } });
            }
          } else {
            const rate = (shop.sellRate != null ? Number(shop.sellRate) : 50) / 100;
            for (const [id, n] of Object.entries(rs.inv)) {
              const it = p.items.find((x) => x.id === id);
              if (!it || !n || !(Number(it.value) > 0)) continue;
              const price = Math.max(1, Math.floor((VN.bonus ? VN.bonus('shop.sell', Number(it.value) * rate, rs) : Number(it.value) * rate)));
              out.push({ it, price, n, label: 'Verkaufen', ok: true, sub: '×' + n + ' · ' + price + ' ' + curName,
                act: () => { rs.inv[id] = n - 1; if (!rs.inv[id]) delete rs.inv[id]; if (cur) VN.addMoney(rs, cur.id, price, true); refresh(); } });
            }
          }
          return out;
        };
        const catOf = (it) => it.cat || '';
        const draw = () => {
          o.el.innerHTML = '';
          o.el.classList.toggle('shop-inv', shop.view === 'inv');
          const money = cur ? VN.moneyChip(cur, rs.money[cur.id] || 0) : null;
          const head = el('div', { class: 'shop-head' }, el('strong', null, VN.tr(shop.id + ':name', shop.name)), el('span', { style: { flex: '1' } }), money);
          const tabs = el('div', { class: 'shop-tabs' },
            el('button', { class: tab === 'buy' ? 'on' : '', onclick: () => { tab = 'buy'; cat = null; selId = null; draw(); } }, 'Kaufen'),
            shop.sell !== false ? el('button', { class: tab === 'sell' ? 'on' : '', onclick: () => { tab = 'sell'; cat = null; selId = null; draw(); } }, 'Verkaufen') : null);
          let list = entries();
          // Kategorie-Reiter, sobald mehr als eine Kategorie vorkommt
          const cats = VN.itemCats ? VN.itemCats().filter((c) => list.some((e) => catOf(e.it) === c)) : [];
          if (list.some((e) => !catOf(e.it)) && cats.length) cats.push('');
          let catBar = null;
          if (cats.length > 1) {
            if (cat != null && !cats.includes(cat)) cat = null;
            catBar = el('div', { class: 'inv-tabs shop-cats' },
              el('button', { class: 'inv-tab' + (cat == null ? ' active' : ''), onclick: () => { cat = null; draw(); } }, VN.tr('ui:allTab', 'Alle')),
              ...cats.map((c) => el('button', { class: 'inv-tab' + (cat === c ? ' active' : ''), onclick: () => { cat = c; draw(); } }, c ? VN.tr('invcat:' + c, c) : 'Sonstiges')));
            if (cat != null) list = list.filter((e) => catOf(e.it) === cat);
          }
          const img = (it, cls) => (it.image ? el('div', { class: cls, style: { backgroundImage: `url("${VN.assetUrl(it.image)}")` } }) : el('div', { class: cls + ' ph' }, (it.name || '?').slice(0, 2)));
          let main;
          if (shop.view === 'inv') {
            // Ansicht wie das Inventar: Fächer links, Details mit Knopf rechts
            const inv = p.inventory;
            const cols = inv.cols || 6;
            const grid = el('div', { class: 'inv-grid', style: { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } });
            const total = Math.max(cols * Math.min(inv.rows || 4, 4), list.length);
            const sel = list.find((e) => e.it.id === selId) || list[0];
            for (let i = 0; i < total; i++) {
              const e = list[i];
              const slot = el('div', { class: 'inv-slot' + (e && sel === e ? ' sel' : '') + (inv.slot ? '' : ' ph') + (e && !e.ok ? ' off' : '') });
              if (inv.slot) slot.style.backgroundImage = `url("${VN.assetUrl(inv.slot)}")`;
              if (e) {
                slot.appendChild(img(e.it, 'inv-img'));
                slot.appendChild(el('span', { class: 'inv-price' }, String(e.price)));
                if (e.n > 1) slot.appendChild(el('span', { class: 'inv-n' }, String(e.n)));
                slot.title = VN.tr(e.it.id + ':name', e.it.name);
                slot.addEventListener('click', (ev) => { ev.stopPropagation(); selId = e.it.id; draw(); });
                slot.addEventListener('dblclick', (ev) => { ev.stopPropagation(); if (e.ok) { e.act(); draw(); } });
              }
              grid.appendChild(slot);
            }
            const detail = el('div', { class: 'inv-detail' });
            if (sel) detail.append(img(sel.it, 'inv-big'), el('strong', null, VN.tr(sel.it.id + ':name', sel.it.name)),
              sel.it.cat ? el('div', { class: 'muted' }, VN.tr('invcat:' + sel.it.cat, sel.it.cat)) : null,
              el('div', null, VN.tr(sel.it.id + ':desc', sel.it.desc || '')),
              el('div', { class: 'shop-sub' }, sel.sub),
              el('button', { class: 'shop-btn', disabled: !sel.ok, onclick: (ev) => { ev.stopPropagation(); if (sel.ok) { sel.act(); draw(); } } }, sel.label));
            else detail.appendChild(el('div', { class: 'muted' }, tab === 'buy' ? 'Der Laden ist leer.' : 'Nichts zum Verkaufen.'));
            main = el('div', { class: 'inv-main' }, grid, detail);
          } else {
            main = el('div', { class: 'shop-grid' });
            for (const e of list) main.appendChild(el('div', { class: 'shop-item' + (e.ok ? '' : ' off') },
              img(e.it, 'shop-img'),
              el('div', { class: 'shop-name' }, VN.tr(e.it.id + ':name', e.it.name)),
              el('div', { class: 'shop-sub' }, e.sub),
              el('button', { class: 'shop-btn', disabled: !e.ok, onclick: (ev) => { ev.stopPropagation(); if (e.ok) { e.act(); draw(); } } }, e.label)));
            if (!list.length) main.appendChild(el('div', { class: 'shop-empty' }, tab === 'buy' ? 'Der Laden ist leer.' : 'Nichts zum Verkaufen.'));
          }
          o.el.append(head, tabs, catBar || '', main, el('button', { class: 'shop-close', onclick: () => { o.close(); resolve(); } }, 'Laden verlassen'));
          if (window.UiDesign) UiDesign.apply('shop', o.el);
        };
        draw();
      });
    },

    // ---------- Editor ----------
    // Übersicht: alle Systeme mit Schaltern
    overview(body) {
      const p = VN.project;
      const card = (icon, title, desc, on, toggle, tab, sub) => el('div', { class: 'sys-switch' + (on ? ' on' : '') },
        el('div', { class: 'ss-ico' }, icon),
        el('div', { class: 'ss-main' },
          el('label', { class: 'check ss-title' }, el('input', { type: 'checkbox', checked: !!on, onchange: (e) => toggle(e.target.checked) }), el('strong', null, title)),
          el('div', { class: 'muted small' }, desc),
          sub || null),
        on && tab ? el('button', { class: 'btn tiny', onclick: () => { VN.ui.sysTab = tab; VN.render(); } }, 'Einrichten →') : null);
      const set = (fn) => (v) => VN.mutate(() => fn(v));
      body.appendChild(el('p', { class: 'muted' }, 'Schalte nur ein, was dein Spiel braucht. Ausgeschaltete Systeme verschwinden aus dem Editor und aus dem Spiel. Eine reine Story-VN braucht keins davon.'));
      const grid = el('div', { class: 'sys-switches' });
      grid.append(
        card('🎒', 'Inventar', 'Gegenstände sammeln, Inventar-Menü mit Taste I.', p.inventory.enabled !== false, set((v) => { p.inventory.enabled = v; }), 'items'),
        card('🕰', 'Zeit & Kalender', 'Tag, Wochentag und Tageszeit. „Zeit vergehen lassen“ als Aktion, Hintergründe passen ihre Tageszeit an.', p.time.enabled, set((v) => { p.time.enabled = v; }), 'time'),
        card('🪙', 'Geld & Läden', 'Währungen mit Anzeige, Läden zum Kaufen und Verkaufen, Preise an Gegenständen.', p.economy.enabled, set((v) => { p.economy.enabled = v; if (v && !p.currencies.length) p.currencies.push({ id: VN.uid('cur'), name: 'Gold', color: '#e8c86a', start: 50, max: 99999, image: null }); }), 'shops'));
      if (Life.extraSwitches) for (const c of Life.extraSwitches(card, set)) grid.appendChild(c);
      body.appendChild(grid);
    },

    timeTab(body) {
      const p = VN.project, T = p.time;
      const txt = (v, fn, w) => el('input', { type: 'text', value: v || '', style: { width: w || '120px' }, onchange: (e) => VN.mutate(() => fn(e.target.value)) });
      const sel = (v, opts, fn) => { const s = el('select', { onchange: (e) => VN.mutate(() => fn(e.target.value)) }); for (const [k, l] of opts) { const o = el('option', { value: k }, l); if (String(k) === String(v)) o.selected = true; s.appendChild(o); } return s; };
      body.appendChild(el('p', { class: 'muted' }, 'Die Spielzeit läuft in Tageszeiten. Sie ändert sich nur durch die Aktion „Zeit vergehen lassen“ (z. B. nach einem Job oder beim Schlafen). Prüfen kannst du sie mit der Bedingung „Zeit / Kalender“.'));
      const slots = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Tageszeiten (in dieser Reihenfolge)'));
      T.slots.forEach((s, i) => slots.appendChild(el('div', { class: 'logic-row' },
        el('span', { class: 'muted small', style: { width: '18px' } }, String(i + 1)),
        txt(s, (v) => { T.slots[i] = v || 'Zeit'; }),
        el('span', { class: 'muted small' }, 'Optik'),
        sel(T.dayMap[i] != null ? T.dayMap[i] : '', [['', 'automatisch'], ...Fx.DAYTIMES.filter((x) => x[0])], (v) => { if (v) T.dayMap[i] = v; else delete T.dayMap[i]; }),
        T.slots.length > 1 ? el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { T.slots.splice(i, 1); T.dayMap = {}; }) }, '×') : null)));
      slots.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { T.slots.push('Neue Tageszeit'); }) }, '+ Tageszeit'));
      const days = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Wochentage'),
        el('div', { class: 'row gap4', style: { flexWrap: 'wrap' } }, ...T.days.map((d, i) => txt(d, (v) => { T.days[i] = v || 'Tag'; }, '96px'))),
        el('div', { class: 'row gap8' },
          el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { T.days.push('Tag ' + (T.days.length + 1)); }) }, '+ Wochentag'),
          T.days.length > 1 ? el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { T.days.pop(); }) }, '− letzten') : null,
          el('span', { class: 'muted small' }, 'Fantasy-Kalender? Einfach umbenennen oder mehr Tage anlegen.')));
      const start = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Start & Anzeige'),
        el('div', { class: 'logic-row' }, el('span', null, 'Spiel beginnt am'), sel(T.startDay, T.days.map((d, i) => [i, d]), (v) => { T.startDay = Number(v); }), el('span', null, 'am'), sel(T.startSlot, T.slots.map((d, i) => [i, d]), (v) => { T.startSlot = Number(v); })),
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: T.hud !== false, onchange: (e) => VN.mutate(() => { T.hud = e.target.checked; }) }), 'Zeit oben im Spiel anzeigen'),
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: T.autoDaytime !== false, onchange: (e) => VN.mutate(() => { T.autoDaytime = e.target.checked; }) }), 'Hintergründe automatisch an die Tageszeit anpassen (wenn beim Hintergrund keine eigene Tageszeit gewählt ist)'));
      // Vorschau
      const rs = { time: { day: 1, slot: Number(T.startSlot) || 0 } };
      const strip = el('div', { class: 'time-strip' });
      for (let i = 0; i < Math.min(8, T.slots.length * 2); i++) {
        const st = { time: { day: 1 + Math.floor(((Number(T.startSlot) || 0) + i) / T.slots.length), slot: ((Number(T.startSlot) || 0) + i) % T.slots.length } };
        const dt = Life.daytime(null, st) || '';
        strip.appendChild(el('div', { class: 'ts-cell ' + dt }, el('div', { class: 'small' }, VN.Life.timeText.call(null, st).replace(/^Tag /, 'T'))));
      }
      void rs;
      body.append(el('div', { class: 'grid2', style: { alignItems: 'start' } }, slots, el('div', { class: 'col gap8' }, days, start)),
        el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'So läuft die Zeit (Vorschau)'), strip,
          el('div', { class: 'muted small' }, 'Tipp: Eine Antwort „Schlafen gehen“ mit der Aktion „Zeit vergehen lassen → nächster Tag“ und Hub-Objekte mit der Bedingung „Tageszeit ist Abend“ – fertig ist ein Tagesablauf.')));
    },

    shopsTab(body) {
      const p = VN.project;
      const shop = p.shops.find((x) => x.id === VN.ui.shopSel) || p.shops[0];
      const wrap = el('div', { class: 'loot-wrap' });
      const list = el('div', { class: 'loot-list' });
      for (const s of p.shops) list.appendChild(el('div', { class: 'list-item' + (s === shop ? ' active' : ''), onclick: () => { VN.ui.shopSel = s.id; VN.render(); } }, el('span', { class: 'dot', style: { background: '#e8c86a' } }), el('span', { class: 'name' }, s.name)));
      list.appendChild(el('button', { class: 'btn', style: { marginTop: '6px' }, onclick: () => VN.mutate(() => { const s = { id: VN.uid('shop'), name: VN.t('Neuer Laden'), currency: (p.currencies[0] || {}).id || '', sell: true, sellRate: 50, items: [] }; p.shops.push(s); VN.ui.shopSel = s.id; }) }, '+ Laden'));
      const ed = el('div', { class: 'loot-ed' });
      wrap.append(list, ed);
      body.appendChild(el('p', { class: 'muted' }, 'Läden öffnest du im Spiel mit der Aktion „Laden öffnen“, z. B. an einem Hub-Objekt (Händler) oder in einer Antwort. Preise kommen vom „Wert“ des Gegenstands, wenn du hier keinen eigenen eingibst.'));
      body.appendChild(wrap);
      if (!p.currencies.length) ed.appendChild(el('div', { class: 'hint-box' }, 'Noch keine Währung. Lege unter „Währungen“ zum Beispiel „Gold“ an.'));
      if (!shop) { ed.appendChild(el('div', { class: 'hint-box' }, 'Lege links einen Laden an.')); return; }
      const sel = (v, opts, fn) => { const s = el('select', { onchange: (e) => VN.mutate(() => fn(e.target.value)) }); for (const [k, l] of opts) { const o = el('option', { value: k }, l); if (String(k) === String(v)) o.selected = true; s.appendChild(o); } return s; };
      const num = (v, fn, ph) => el('input', { type: 'number', value: v != null ? v : '', placeholder: ph || '', style: { width: '80px' }, onchange: (e) => VN.mutate(() => fn(e.target.value === '' ? null : Number(e.target.value))) });
      ed.append(
        el('div', { class: 'row gap8' },
          el('div', { class: 'field', style: { flex: '1' } }, el('div', { class: 'lbl' }, 'Name'), el('input', { type: 'text', value: shop.name, onchange: (e) => VN.mutate(() => { shop.name = e.target.value || 'Laden'; }) })),
          el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Bezahlt wird mit'), sel(shop.currency, p.currencies.map((c) => [c.id, c.name]), (v) => { shop.currency = v; })),
          el('button', { class: 'btn danger', style: { alignSelf: 'flex-end' }, onclick: () => VN.mutate(() => { p.shops = p.shops.filter((x) => x !== shop); VN.ui.shopSel = null; }) }, 'Laden löschen')),
        el('div', { class: 'row gap8' },
          el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Darstellung'), sel(shop.view || 'cards', [['cards', 'Karten'], ['inv', 'Wie das Inventar (Fächer + Details)']], (v) => { shop.view = v; })),
          el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: shop.sell !== false, onchange: (e) => VN.mutate(() => { shop.sell = e.target.checked; }) }), 'Spieler kann hier verkaufen'),
          shop.sell !== false ? el('span', { class: 'row gap4' }, 'für', num(shop.sellRate != null ? shop.sellRate : 50, (v) => { shop.sellRate = v == null ? 50 : v; }), '% vom Wert') : null));
      const rows = (shop.items || []).map((e) => {
        const it = p.items.find((x) => x.id === e.item);
        return el('div', { class: 'sys-row', style: { gridTemplateColumns: '44px 1.4fr 110px 110px 40px' } },
          el('span', { class: 'mini-thumb', style: { backgroundImage: it && it.image ? `url("${VN.assetUrl(it.image)}")` : 'none' } }),
          sel(e.item || '', [['', '— Gegenstand —'], ...p.items.map((i) => [i.id, i.name])], (v) => { e.item = v; }),
          num(e.price, (v) => { e.price = v; }, it ? String(it.value || 0) : ''),
          num(e.stock != null && e.stock >= 0 ? e.stock : null, (v) => { e.stock = v == null ? -1 : v; }, 'unbegrenzt'),
          el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { shop.items = shop.items.filter((x) => x !== e); }) }, '×'));
      });
      ed.appendChild(el('div', { class: 'sys-table' },
        el('div', { class: 'sys-row head', style: { gridTemplateColumns: '44px 1.4fr 110px 110px 40px' } }, el('span'), el('span', null, 'Gegenstand'), el('span', null, 'Preis'), el('span', null, 'Vorrat'), el('span')),
        ...rows));
      ed.appendChild(el('div', { class: 'row gap8' },
        el('button', { class: 'btn', onclick: () => VN.mutate(() => { shop.items.push({ item: (p.items[0] || {}).id || '', price: null, stock: -1 }); }) }, '+ Gegenstand'),
        el('button', { class: 'btn', onclick: () => { const rs = VN.newRunState(); for (const c of p.currencies) rs.money[c.id] = Math.max(rs.money[c.id], 200); VN.Life.previewShop(shop, rs); } }, 'Vorschau')));
    },
    // Laden im Editor ansehen
    previewShop(shop, rs) {
      const host = el('div', { class: 'shop-preview-host' });
      const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) back.remove(); } }, host);
      document.body.appendChild(back);
      const P = window.Player;
      const old = P && Object.getOwnPropertyDescriptor(P, 'host');
      void old;
      const ctxHost = VNPlugin.makeCtx;
      VNPlugin.makeCtx = (r) => { const c = ctxHost(r); c.overlay = (opts = {}) => { const panel = el('div', { class: 'plugin-panel' }); if (opts.width) panel.style.width = opts.width; host.appendChild(panel); return { el: panel, root: host, close: () => back.remove() }; }; return c; };
      try { Life.openShop(shop.id, rs); } finally { VNPlugin.makeCtx = ctxHost; }
    }
  });

  // Nur Arten anbieten, deren System eingeschaltet ist (vorhandene bleiben sichtbar)
  Life.condTypes = () => { const p = VN.project; const out = []; if (p.time && p.time.enabled) out.push(['time', 'Zeit / Kalender']); if (Life.extraCondTypes) out.push(...Life.extraCondTypes()); return out; };
  Life.actionTypes = () => { const p = VN.project; const out = []; if (p.time && p.time.enabled) out.push(['time', 'Zeit vergehen lassen']); if (p.economy && p.economy.enabled) out.push(['shop', 'Laden öffnen']); if (Life.extraActionTypes) out.push(...Life.extraActionTypes()); return out; };

  // logic.js um neue Bedingungen/Aktionen erweitern
  const baseMig = VN.migrate;
  VN.migrate = (p) => Life.ensure(baseMig(p));
  const baseRun = VN.newRunState;
  VN.newRunState = () => Life.initRun(baseRun());
})();

// ---------- Beziehungen & Geschenke ----------
(function () {
  const { el } = VN;
  const Life = VN.Life;
  const LEVELS = [['love', '♥♥ liebt'], ['like', '♥ mag'], ['neutral', '· neutral'], ['dislike', '✗ mag nicht'], ['hate', '✗✗ verträgt nicht']];
  const LV_ICON = { love: '♥♥', like: '♥', neutral: '·', dislike: '✗', hate: '✗✗' };
  const R = () => VN.project.relations;

  const baseEnsure = Life.ensure;
  Life.ensure = (p) => {
    baseEnsure(p);
    p.relations = Object.assign({
      enabled: false, gifts: false, chars: [],
      ladder: [{ name: VN.t('Fremd'), min: 0 }, { name: VN.t('Bekannt'), min: 20 }, { name: VN.t('Freund'), min: 40 }, { name: VN.t('Vertraut'), min: 70 }, { name: VN.t('Verliebt'), min: 100 }],
      showNumbers: true, rewards: 'show', hideUnmet: true, notify: true,
      giftPts: { love: 10, like: 5, neutral: 1, dislike: -5, hate: -12 }, giftLimit: 'scene', diminish: true
    }, p.relations || {});
    for (const c of p.relations.chars) { c.likes = c.likes || {}; c.itemPrefs = c.itemPrefs || {}; c.reactions = c.reactions || {}; c.rewards = c.rewards || {}; }
    return p;
  };
  Life.relOn = () => !!(VN.project && VN.project.relations && VN.project.relations.enabled);
  Life.giftsOn = () => Life.relOn() && !!R().gifts;
  Life.relChar = (id) => R().chars.find((c) => c.id === id || c.name === id);
  Life.LEVELS = LEVELS;

  // ---------- Laufzeit ----------
  const baseInit = Life.initRun;
  Life.initRun = (rs) => {
    baseInit(rs);
    if (!rs.rel) {
      rs.rel = {}; rs.relMet = {}; rs.relStage = {}; rs.giftKnown = {}; rs.giftCount = {}; rs.giftLast = {};
      for (const c of (VN.project.relations || { chars: [] }).chars) { rs.rel[c.id] = Number(c.start) || 0; rs.relStage[c.id] = Life.stageOf(rs.rel[c.id]); }
      // Testwerte aus dem Editor („Test ab hier mit …“)
      if (!VN.gameMode && VN.ui && VN.ui.relTest) for (const [k, v] of Object.entries(VN.ui.relTest)) { rs.rel[k] = v; rs.relMet[k] = true; rs.relStage[k] = Life.stageOf(v); }
    }
    return rs;
  };
  Life.stageOf = (v) => { const L = (VN.project.relations || {}).ladder || []; let s = 0; L.forEach((x, i) => { if (v >= Number(x.min)) s = i; }); return s; };
  Life.stageName = (i) => { const L = R().ladder; return (L[i] && L[i].name) || ''; };
  Life.addRel = (rs, charId, amount, gains) => {
    Life.initRun(rs);
    const c = Life.relChar(charId);
    if (!c) return;
    const before = rs.rel[c.id] || 0;
    if (Number(amount) > 0 && VN.bonus) amount = Math.round(VN.bonus('rel.gain', Number(amount), rs, c.id));
    const v = Math.max(0, Math.min(100, before + Number(amount || 0)));
    rs.rel[c.id] = v;
    rs.relMet[c.id] = true;
    const st = Life.stageOf(v);
    const prev = rs.relStage[c.id] || 0;
    const up = st > prev;
    rs.relStage[c.id] = st;
    if (gains && R().notify !== false && Number(amount)) gains.push({ kind: 'rel', id: c.id, count: Number(amount), stage: up ? st : null, down: st < prev ? st : null, from: before, to: v });
    Life.checkMilestones(rs, c, before, v, gains);
  };

  // ---------- Meilensteine: bei einem Prozentwert einmalig Nachricht, Bild, Aktionen ----------
  Life.newMilestone = (at) => ({ id: VN.uid('ms'), at: at || 10, down: false, style: '', text: '', image: null, notify: '', sound: null, actions: [] });
  Life.checkMilestones = (rs, c, before, v, gains) => {
    rs.relMs = rs.relMs || {};
    for (const m of c.milestones || []) {
      if (rs.relMs[m.id]) continue;
      const at = Number(m.at) || 0;
      const hit = m.down ? (before > at && v <= at) : (before < at && v >= at);
      if (!hit) continue;
      rs.relMs[m.id] = true;
      if (m.image && VN.Extras && VN.Extras.unlockNew) VN.Extras.unlockNew(m.image);
      if (m.actions && m.actions.length) {
        const g2 = VN.applyActions(m.actions, rs, 'ms:' + m.id);
        if (gains) { for (const g of g2) gains.push(g); if (g2.pending && gains.pending) for (const f of g2.pending) gains.pending.push(f); }
      }
      if (gains && gains.pending && (m.text || m.image) && window.Player && Player.relMessage && !(VN.Idle && VN.Idle._sim)) gains.pending.push(() => Player.relMessage(c.id, m.id));
    }
  };
  Life.msNotify = (c, m) => {
    if (m.notify) return VN.tr(m.id + ':note', m.notify);
    const name = VN.tr('name:' + c.name, c.name);
    return VN.tp(m.image ? '{name} hat dir ein Bild geschickt' : '{name} hat dir eine Nachricht geschickt').replace('{name}', name);
  };
  // Editor: Meilensteine einer Figur
  Life.msEditor = (c) => {
    c.milestones = c.milestones || [];
    const box = el('div', { class: 'rel-ms' }, el('div', { class: 'sec-title' }, VN.t('Meilensteine (einmalig bei einem Prozentwert)')),
      el('div', { class: 'muted small' }, VN.t('Erreicht die Beziehung den Wert, schickt die Figur eine Nachricht – auf Wunsch mit Bild. Das Bild landet in der Galerie bei dieser Figur und leuchtet dort als „Neu“, bis man es ansieht. Aussehen und Töne: Design → Spielsysteme → „Nachricht einer Figur“.')));
    const sorted = c.milestones.slice().sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0));
    for (const m of sorted) {
      const open = VN.ui.msOpen === m.id;
      const head = el('div', { class: 'logic-row ms-head' },
        el('span', { class: 'muted small' }, VN.t('bei')),
        el('input', { type: 'number', min: 0, max: 100, value: m.at, style: { width: '58px' }, onchange: (e) => VN.mutate(() => { m.at = Math.max(0, Math.min(100, Number(e.target.value) || 0)); }) }),
        el('span', { class: 'muted small' }, '%'),
        el('select', { class: 'sel', onchange: (e) => VN.mutate(() => { m.down = e.target.value === 'down'; }) }, el('option', { value: 'up', selected: !m.down }, VN.t('beim Steigen')), el('option', { value: 'down', selected: !!m.down }, VN.t('beim Sinken'))),
        el('input', { type: 'text', value: m.text || '', placeholder: VN.t('Nachricht, z. B. „Hab an dich gedacht 😊“'), style: { flex: '1' }, onchange: (e) => VN.mutate(() => { m.text = e.target.value; }) }),
        m.image && VN.assetUrl(m.image) ? el('span', { class: 'mini-thumb', style: { backgroundImage: `url("${VN.assetUrl(m.image)}")` } }) : null,
        el('button', { class: 'btn tiny', onclick: () => { VN.ui.msOpen = open ? null : m.id; VN.render(); } }, open ? VN.t('Weniger') : VN.t('Mehr …')),
        el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { c.milestones = c.milestones.filter((x) => x !== m); }) }, '×'));
      box.appendChild(head);
      if (open) {
        const det = el('div', { class: 'ms-detail' },
          el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '150px' } }, VN.t('Bild mitschicken')), VN.assetSelect('image', m.image, (v) => VN.mutate(() => { m.image = v; const a = v && VN.asset(v); if (a) { a.gallery = true; if (!a.galleryChar) a.galleryChar = c.id; } }))),
          el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '150px' } }, VN.t('Darstellung')),
            el('select', { class: 'sel', onchange: (e) => VN.mutate(() => { m.style = e.target.value; }) }, ...[['', VN.t('wie im Design')], ['phone', VN.t('Handy')], ['bubble', VN.t('Sprechblase')], ['window', VN.t('Fenster')], ['none', VN.t('nur Meldung, keine Nachricht')]].map(([k, l]) => el('option', { value: k, selected: (m.style || '') === k }, l)))),
          el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '150px' } }, VN.t('Meldung')), el('input', { type: 'text', value: m.notify || '', placeholder: Life.msNotify(c, m), style: { flex: '1' }, onchange: (e) => VN.mutate(() => { m.notify = e.target.value; }) })),
          el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '150px' } }, VN.t('Eigener Ton')), VN.assetSelect('audio', m.sound, (v) => VN.mutate(() => { m.sound = v; })), el('span', { class: 'muted small' }, VN.t('leer = Ton der Figur bzw. aus dem Design'))),
          VN.actionEditor(m.actions || (m.actions = []), VN.t('Außerdem ausführen (z. B. Szene freischalten, Gegenstand geben)')),
          el('button', { class: 'btn tiny', onclick: () => { if (window.RelMsg) RelMsg.preview(c, m); } }, '▶ ' + VN.t('Vorschau')));
        box.appendChild(det);
      }
    }
    box.appendChild(el('div', { class: 'row gap8', style: { flexWrap: 'wrap', marginTop: '6px' } },
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const last = sorted.length ? Number(sorted[sorted.length - 1].at) || 0 : 0; const m = Life.newMilestone(Math.min(100, last + 10)); c.milestones.push(m); VN.ui.msOpen = m.id; }) }, '+ ' + VN.t('Meilenstein')),
      el('span', { class: 'muted small' }, VN.t('Ton für alle Nachrichten dieser Figur:')), VN.assetSelect('audio', c.msgSound, (v) => VN.mutate(() => { c.msgSound = v; }))));
    return box;
  };

  // ---------- Bedingungen / Aktionen ----------
  const baseCheck = Life.checkCond;
  Life.checkCond = (c, rs) => {
    if (c.type === 'rel') {
      Life.initRun(rs);
      const ch = Life.relChar(c.char);
      if (!ch) return false;
      const v = rs.rel[ch.id] || 0;
      const ops = { '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '==': (a, b) => a == b, '<': (a, b) => a < b, '>': (a, b) => a > b };
      const f = ops[c.op || '>='];
      if (!f) return false;
      if (c.what === 'stage') return f(Life.stageOf(v), Number(c.value));
      return f(v, Number(c.value));
    }
    return baseCheck(c, rs);
  };
  const baseCondText = Life.condText;
  Life.condText = (c) => {
    if (c.type === 'rel') {
      const ch = Life.relChar(c.char);
      const n = ch ? ch.name : '?';
      if (c.what === 'stage') return '♥ ' + n + ' ' + ({ '>=': 'ab Stufe', '<': 'unter Stufe', '==': 'genau Stufe' }[c.op || '>='] || c.op) + ' ' + Life.stageName(Number(c.value));
      return '♥ ' + n + ' ' + (c.op || '>=') + ' ' + c.value + ' %';
    }
    return baseCondText(c);
  };
  const baseCondRow = Life.condRow;
  Life.condRow = (row, c, sel, inp) => {
    if (c.type !== 'rel') return baseCondRow(row, c, sel, inp);
    row.appendChild(sel(c.char || '', [['', '— Figur —'], ...R().chars.map((x) => [x.id, x.name])], (v) => VN.mutate(() => { c.char = v; })));
    row.appendChild(sel(c.what || 'stage', [['stage', 'Stufe'], ['value', 'Prozent']], (v) => VN.mutate(() => { c.what = v; c.value = v === 'stage' ? 2 : 50; c.op = '>='; })));
    if ((c.what || 'stage') === 'stage') {
      row.appendChild(sel(c.op || '>=', [['>=', 'ab'], ['<', 'unter'], ['==', 'genau']], (x) => VN.mutate(() => { c.op = x; }), { width: '72px' }));
      row.appendChild(sel(c.value != null ? c.value : 2, R().ladder.map((l, i) => [i, l.name]), (x) => VN.mutate(() => { c.value = Number(x); })));
    } else { row.appendChild(sel(c.op || '>=', VN.OPS.map((o) => [o, o]), (x) => VN.mutate(() => { c.op = x; }), { width: '58px' })); row.appendChild(inp(c.value, (x) => VN.mutate(() => { c.value = Number(x); }), 'number')); }
    return true;
  };
  const baseApply = Life.applyAction;
  Life.applyAction = (a, rs, gains) => {
    if (a.type === 'rel') { Life.addRel(rs, a.char, a.amount, gains); return true; }
    if (a.type === 'gift') { gains.pending.push(Life.giftDialog(a.char, rs)); return true; }
    if (a.type === 'relScreen') { gains.pending.push(Life.relScreen(rs, true)); return true; }
    return baseApply(a, rs, gains);
  };
  const baseActText = Life.actionText;
  Life.actionText = (a) => {
    if (a.type === 'rel') { const c = Life.relChar(a.char); return '♥ ' + (c ? c.name : '?') + (Number(a.amount) >= 0 ? ' +' : ' ') + (a.amount || 0); }
    if (a.type === 'gift') { const c = Life.relChar(a.char); return 'Geschenk an ' + (c ? c.name : '?'); }
    if (a.type === 'relScreen') return 'Beziehungen anzeigen';
    return baseActText(a);
  };
  const baseActRow = Life.actionRow;
  Life.actionRow = (row, a, sel, inp) => {
    if (a.type === 'rel' || a.type === 'gift') {
      row.appendChild(sel(a.char || '', [['', '— Figur —'], ...R().chars.map((x) => [x.id, x.name])], (v) => VN.mutate(() => { a.char = v; })));
      if (a.type === 'rel') row.appendChild(inp(a.amount != null ? a.amount : 10, (x) => VN.mutate(() => { a.amount = Number(x); }), 'number'));
      return true;
    }
    if (a.type === 'relScreen') return true;
    return baseActRow(row, a, sel, inp);
  };
  Life.extraCondTypes = () => (Life.relOn() ? [['rel', '♥ Beziehung']] : []);
  Life.extraActionTypes = () => (Life.relOn() ? [['rel', '♥ Beziehung ändern'], ...(Life.giftsOn() ? [['gift', '🎁 Geschenk geben lassen']] : []), ['relScreen', '♥ Beziehungen anzeigen']] : []);

  // Antworten: „Beziehung“-Feld direkt an der Antwort (+10 Ray, −5 Wache)
  Life.optActions = (o) => [...(o.actions || []), ...((o.rel || []).filter((r) => r.char && Number(r.amount)).map((r) => ({ type: 'rel', char: r.char, amount: r.amount })))];
  Life.relField = (o) => {
    if (!Life.relOn() || !R().chars.length) return null;
    o.rel = o.rel || [];
    const box = el('div', { class: 'rel-field' }, el('span', { class: 'rf-lbl' }, '♥ Beziehung'));
    o.rel.forEach((r, i) => {
      const s = el('select', { onchange: (e) => VN.mutate(() => { r.char = e.target.value; }) }, ...R().chars.map((c) => { const op = el('option', { value: c.id }, c.name); if (c.id === r.char) op.selected = true; return op; }));
      box.appendChild(el('span', { class: 'rf-chip' + (Number(r.amount) < 0 ? ' neg' : '') }, s,
        el('input', { type: 'number', value: r.amount, step: 1, onchange: (e) => VN.mutate(() => { r.amount = Number(e.target.value); }) }),
        el('button', { class: 'btn tiny ghost', onclick: () => VN.mutate(() => { o.rel.splice(i, 1); }) }, '×')));
    });
    box.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { o.rel.push({ char: R().chars[0].id, amount: 10 }); }) }, '+'));
    return box;
  };

  // ---------- Spieler-Bildschirm „Beziehungen“ ----------
  Life.relScreen = (rs, wait) => {
    const U = window.Player && Player._ui;
    if (!U) return Promise.resolve();
    Life.initRun(rs);
    const Rr = R();
    // Ohne laufendes Spiel (z. B. Prüfung im Editor) gibt es nichts anzuzeigen
    if (!(window.Player && Player.running)) return Promise.resolve();
    VN.did(rs, 'screen', 'rel');
    return new Promise((resolve) => {
      const list = el('div', { class: 'rel-list' });
      const shown = Rr.chars.filter((c) => !Rr.hideUnmet || rs.relMet[c.id] || c.alwaysShow);
      for (const c of shown) {
        const v = rs.rel[c.id] || 0, st = Life.stageOf(v);
        const next = Rr.ladder.findIndex((l, i) => i > st);
        const nl = next >= 0 ? Rr.ladder[next] : null;
        const rw = nl && c.rewards[next];
        const known = rs.giftKnown[c.id] || {};
        const portrait = c.portrait ? el('div', { class: 'rel-por', style: { backgroundImage: `url("${VN.assetUrl(c.portrait)}")` } }) : el('div', { class: 'rel-por ph' }, (c.name || '?').slice(0, 1));
        list.appendChild(el('div', { class: 'rel-row' }, portrait,
          el('div', { class: 'rel-main' },
            el('div', { class: 'rel-top' }, el('strong', null, VN.tr('name:' + c.name, c.name)), el('span', { class: 'rel-stage' }, '♥ ' + Life.stageName(st))),
            el('div', { class: 'rel-bar' }, el('span', { style: { width: v + '%', background: c.color || '#e86a9a' } }), Rr.showNumbers !== false ? el('em', null, Math.round(v) + ' %') : null),
            nl && Rr.rewards !== 'none' ? el('div', { class: 'rel-next' }, 'Nächste Stufe: ' + nl.name + (Rr.showNumbers !== false ? ' bei ' + nl.min + ' % – noch ' + Math.max(0, nl.min - Math.round(v)) + ' %' : ''),
              rw && rw.text ? el('div', { class: 'rel-rw' }, Rr.rewards === 'hide' ? 'Belohnung: ???' : 'Belohnung: „' + VN.tr(c.id + ':rw' + next, rw.text) + '“') : null) : (nl ? null : el('div', { class: 'rel-next' }, 'Höchste Stufe erreicht')),
            Life.giftsOn() && Object.keys(known).length ? el('div', { class: 'rel-likes' }, ...Object.entries(known).map(([tag, lv]) => el('span', { class: 'rel-like ' + lv }, LV_ICON[lv] + ' ' + tag))) : null)));
      }
      if (!shown.length) list.appendChild(el('div', { class: 'muted' }, 'Noch niemanden kennengelernt.'));
      U.panelKind('pause');
      const pn = U.panel('Beziehungen', list, U.sysBtn('Zurück', () => { U.close(); resolve(); }));
      if (window.UiDesign) UiDesign.apply('rel', pn, pn.parentElement);
    });
  };

  // ---------- Geschenke ----------
  Life.itemTags = (it) => String(it.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
  Life.prefFor = (c, it) => {
    if (c.itemPrefs[it.id]) return { lv: c.itemPrefs[it.id], tag: VN.tr(it.id + ':name', it.name) };
    let best = null;
    const rank = { hate: 0, love: 1, dislike: 2, like: 3, neutral: 4 };
    for (const t of Life.itemTags(it)) { const lv = c.likes[t]; if (lv && (!best || rank[lv] < rank[best.lv])) best = { lv, tag: t }; }
    return best || { lv: 'neutral', tag: Life.itemTags(it)[0] || VN.tr(it.id + ':name', it.name) };
  };
  Life.giftPoints = (c, it, rs) => {
    const pref = Life.prefFor(c, it);
    let pts = Number(R().giftPts[pref.lv]) || 0;
    const n = ((rs.giftCount[c.id] || {})[it.id]) || 0;
    if (R().diminish !== false && pts > 0) pts = Math.max(1, Math.round(pts * Math.pow(0.5, n)));
    return { pts, pref };
  };
  Life.giftAllowed = (c, rs) => {
    const lim = R().giftLimit || 'scene';
    if (lim === 'none') return true;
    const run = window.Player && Player.state;
    const key = lim === 'day' ? 'd' + ((rs.time && rs.time.day) || 0) : 's' + (run ? run.scene : '') + '|' + ((rs.time && rs.time.day) || 0);
    return (rs.giftLast[c.id] || '') !== key ? key : false;
  };
  Life.giftDialog = (charId, rs) => {
    const U = window.Player && Player.running && Player._ui;
    const c = Life.relChar(charId);
    if (!U || !c) return Promise.resolve();
    Life.initRun(rs);
    const p = VN.project;
    const P = (...x) => { const pn = U.panel(...x); if (window.UiDesign) UiDesign.apply('gift', pn, pn.parentElement); return pn; };
    return new Promise((resolve) => {
      const done = () => { U.close(); resolve(); };
      const allowed = Life.giftAllowed(c, rs);
      if (!allowed) { U.panelKind('pause'); P(c.name, el('div', { class: 'gift-msg' }, R().giftLimit === 'day' ? 'Heute hast du ' + c.name + ' schon etwas geschenkt.' : 'Du hast ' + c.name + ' gerade erst etwas geschenkt.'), U.sysBtn('OK', done)); return; }
      const items = p.items.filter((it) => it.gift && rs.inv[it.id]);
      const grid = el('div', { class: 'gift-grid' });
      for (const it of items) {
        grid.appendChild(el('button', { class: 'gift-item', onclick: (e) => {
          e.stopPropagation();
          const { pts, pref } = Life.giftPoints(c, it, rs);
          rs.inv[it.id] -= 1; if (!rs.inv[it.id]) delete rs.inv[it.id];
          rs.giftCount[c.id] = rs.giftCount[c.id] || {}; rs.giftCount[c.id][it.id] = (rs.giftCount[c.id][it.id] || 0) + 1; VN.did(rs, 'gift', c.id);
          rs.giftLast[c.id] = allowed;
          rs.giftKnown[c.id] = rs.giftKnown[c.id] || {}; rs.giftKnown[c.id][pref.tag] = pref.lv;
          const g = []; Life.addRel(rs, c.id, pts > 0 && VN.bonus ? Math.round(VN.bonus('gift.gain', pts, rs)) : pts, g);
          const line = c.reactions[pref.lv] || { love: 'Oh! Das ist ja wunderbar – danke!', like: 'Danke, das ist lieb von dir.', neutral: 'Oh … danke.', dislike: 'Hm. Na ja … danke.', hate: 'Bitte nimm das weg!' }[pref.lv];
          P(c.name, el('div', { class: 'gift-react ' + pref.lv }, el('div', { class: 'gr-ico' }, LV_ICON[pref.lv]), el('div', { class: 'gr-line' }, '„' + line + '“'), el('div', { class: 'gr-pts' }, (pts >= 0 ? '+' : '') + pts + ' ♥')), U.sysBtn('Weiter', done));
          if (g.length && g[0].stage != null) VN.toast('♥ ' + c.name + ': ' + Life.stageName(g[0].stage) + '!');
          window.Player && Player.refreshHud && Player.refreshHud();
        } },
          it.image ? el('span', { class: 'gift-img', style: { backgroundImage: `url("${VN.assetUrl(it.image)}")` } }) : el('span', { class: 'gift-img ph' }, (it.name || '?').slice(0, 2)),
          el('span', null, VN.tr(it.id + ':name', it.name) + (rs.inv[it.id] > 1 ? ' ×' + rs.inv[it.id] : ''))));
      }
      if (!items.length) grid.appendChild(el('div', { class: 'gift-msg' }, 'Du hast nichts, was du verschenken könntest.'));
      U.panelKind('pause');
      P('Geschenk für ' + c.name, grid, U.sysBtn('Doch nicht', done));
    });
  };

  // HUD & Werte-Fenster
  Life.debugRows = (rs) => {
    if (!Life.relOn()) return [];
    Life.initRun(rs);
    return R().chars.map((c) => el('div', { class: 'rel-dbg' }, '♥ ' + c.name + ': ',
      el('input', { type: 'range', min: 0, max: 100, value: rs.rel[c.id] || 0, oninput: (e) => { const v = Number(e.target.value); rs.rel[c.id] = v; rs.relMet[c.id] = true; rs.relStage[c.id] = Life.stageOf(v); e.target.nextSibling.textContent = v + ' % · ' + Life.stageName(Life.stageOf(v)); } }),
      el('span', null, (rs.rel[c.id] || 0) + ' % · ' + Life.stageName(Life.stageOf(rs.rel[c.id] || 0)))));
  };

  // ---------- Editor: Punkte-Überblick ----------
  // Sammelt alle Stellen, an denen sich eine Beziehung ändert. Bei einer Auswahl zählt die beste Antwort.
  Life.relSources = (charId) => {
    const p = VN.project, out = [], seen = new Set();
    const scan = (acts) => { let s = 0; for (const a of acts || []) if (a && a.type === 'rel' && a.char === charId) { seen.add(a); s += Number(a.amount) || 0; } return s; };
    // Antwort-Felder „♥ Beziehung“ sind eigene Objekte – als gesehen merken, damit die Suche unten sie nicht doppelt zählt
    const markOpt = (o) => { for (const r of o.rel || []) seen.add(r); };
    for (const s of p.scenes) {
      if (s.type === 'story') {
        for (const t of VN.tracksOf(s).filter((t) => t.base === 'dialog')) for (const d of s.tracks[t.key] || []) { const v = scan(d.actions); if (v) out.push({ scene: s, beat: d.start, label: 'Dialog: „' + (d.text || '').slice(0, 30) + '…“', pos: Math.max(0, v), all: [v] }); }
        for (const c of s.tracks.choice || []) {
          const vals = c.options.map((o) => { markOpt(o); return scan(Life.optActions(o)); });
          if (vals.some((v) => v)) out.push({ scene: s, beat: c.start, label: 'Auswahl: ' + c.options.map((o, i) => '„' + (o.text || '').slice(0, 18) + '“ ' + (vals[i] > 0 ? '+' : '') + (vals[i] || 0)).join(' · '), pos: Math.max(0, ...vals), all: vals });
        }
      } else {
        for (const o of s.objects || []) { const v = scan(o.actions); if (v) out.push({ scene: s, label: 'Hub-Objekt: ' + (o.name || '?'), pos: Math.max(0, v), all: [v] }); }
      }
    }
    // Alle übrigen Stellen: Ereignisse, Szenen-Aktionen, Quests, Kämpfe, Aufbau, Skilltrees, Karte, Plugins …
    const AREA = { scenes: 'Szene', quests: 'Quest', combat: 'Kampf', idle: 'Aufbau', skills: 'Skilltree', map: 'Karte', items: 'Gegenstand', time: 'Zeit', jobs: 'Job', minigames: 'Minispiel', achievements: 'Erfolg', shops: 'Laden' };
    const hit = (a, isOpt) => a && !seen.has(a) && a.char === charId && (isOpt || a.type === 'rel') && Number(a.amount);
    const walk = (o, ctx, depth) => {
      if (!o || typeof o !== 'object' || depth > 14) return;
      if (Array.isArray(o)) { for (const x of o) walk(x, ctx, depth + 1); return; }
      const here = (o.name || o.title) && typeof (o.name || o.title) === 'string' ? (o.name || o.title) : ctx.name;
      for (const k of Object.keys(o)) {
        const v = o[k];
        if (k === 'rel' && Array.isArray(v)) { for (const r of v) if (hit(r, true)) { seen.add(r); const n = Number(r.amount); out.push({ scene: ctx.scene, label: ctx.area + (here ? ': ' + here : ''), pos: Math.max(0, n), all: [n] }); } continue; }
        if (v && typeof v === 'object' && !Array.isArray(v) && hit(v)) { seen.add(v); const n = Number(v.amount); out.push({ scene: ctx.scene, label: ctx.area + (here ? ': ' + here : ''), pos: Math.max(0, n), all: [n] }); continue; }
        if (Array.isArray(v)) for (const x of v) if (hit(x)) { seen.add(x); const n = Number(x.amount); out.push({ scene: ctx.scene, label: ctx.area + (here ? ': ' + here : ''), pos: Math.max(0, n), all: [n] }); }
        walk(v, { ...ctx, name: here }, depth + 1);
      }
    };
    for (const s of p.scenes) walk(s, { area: 'Szene', scene: s, name: s.name }, 0);
    for (const k of Object.keys(p)) if (k !== 'scenes' && k !== 'relations' && p[k] && typeof p[k] === 'object') walk(p[k], { area: AREA[k] || k, scene: null, name: '' }, 0);
    // Geschenke: lassen sich immer wieder geben – Obergrenze gibt es dann keine
    if (Life.giftsOn && Life.giftsOn()) {
      const c = Life.relChar(charId), gp = R().giftPts || {};
      const best = c ? Math.max(0, ...(p.items || []).filter((it) => it.gift).map((it) => Number(gp[Life.prefFor(c, it).lv]) || 0)) : 0;
      const giving = scenesHaveGift(p, charId);
      if (best > 0 && giving) out.push({ scene: null, label: 'Geschenke (beliebig oft, bestes Geschenk +' + best + ')', pos: best, all: [best], endless: true });
    }
    return out;
  };

  // Gibt es irgendwo im Spiel die Aktion „🎁 Geschenk geben lassen“ für diese Figur?
  function scenesHaveGift(p, charId) {
    let found = false;
    const walk = (o, d) => { if (found || !o || typeof o !== 'object' || d > 14) return; if (Array.isArray(o)) { for (const x of o) walk(x, d + 1); return; } if (o.type === 'gift' && (!o.char || o.char === charId)) { found = true; return; } for (const k in o) if (o[k] && typeof o[k] === 'object') walk(o[k], d + 1); };
    walk(p.scenes, 0);
    for (const k of Object.keys(p)) if (k !== 'scenes' && k !== 'relations' && p[k] && typeof p[k] === 'object') walk(p[k], 0);
    return found;
  }

  // ---------- Prüfung: welche Stufen mit Belohnung sind im ganzen Spiel erreichbar? ----------
  Life.relMax = (c, src) => Math.min(100, (Number(c.start) || 0) + (src || Life.relSources(c.id)).reduce((n, x) => n + x.pos, 0) + ((src || []).some((x) => x.endless) ? 100 : 0));
  Life.relUnreach = (c, max) => R().ladder.map((l, i) => [l, i]).filter(([l, i]) => c.rewards && c.rewards[i] && c.rewards[i].text && l.min > max);
  Life.relIssues = (only, srcIn) => {
    if (!Life.relOn()) return [];
    const out = [];
    for (const c of (only ? [only] : R().chars)) {
      const src = srcIn || Life.relSources(c.id);
      const max = Life.relMax(c, src);
      const un = Life.relUnreach(c, max);
      if (!un.length) continue;
      const [l, li] = un[0];
      const pts = Math.max(0, max - (Number(c.start) || 0));
      const names = un.map(([x]) => '„' + x.name + '“ (' + x.min + ' %)').join(', ');
      const none = !src.length;
      const text = none
        ? VN.tf('Für {name} gibt es noch keine ♥-Punkte im Spiel. {levels} wird erst erreichbar, wenn du irgendwo Punkte vergibst.', { name: c.name, levels: names })
        : VN.tf('Im ganzen Spiel gibt es bisher {pts} ♥-Punkte für {name} (zusammen mit dem Startwert höchstens {max} %). Für {levels} fehlen noch {miss} Punkte.', { pts, name: c.name, max, levels: names, miss: l.min - max });
      const fixes = [
        { label: 'Wo kann ich Punkte vergeben?', primary: true, run: () => Help.open('relPoints', { level: none ? 'tip' : 'warn', text }) }
      ];
      if (li > 0 && max > (R().ladder[li - 1] ? Number(R().ladder[li - 1].min) : 0)) fixes.push({ label: VN.tf('Stufe „{lv}“ auf {max} % senken', { lv: l.name, max }), run: () => VN.mutate(() => { R().ladder[li].min = max; }) });
      out.push({ level: none ? 'tip' : 'warn', area: 'Beziehungen', topic: 'relPoints', key: 'rel:' + c.id, text, fixes,
        detail: src.length ? VN.tf('Punkte gibt es hier: {list}', { list: '' }) + src.slice(0, 4).map((x) => x.label + ' (+' + x.pos + ')').join(' · ') + (src.length > 4 ? ' …' : '') : null,
        go: () => { VN.ui.view = 'systems'; VN.ui.sysTab = 'rel'; VN.ui.relOpen = c.id; VN.render(); } });
    }
    return out;
  };

  // ---------- Editor: Reiter „Beziehungen“ ----------
  Life.relTab = (body) => {
    const p = VN.project, Rr = R();
    const txt = (v, fn, w, ph) => el('input', { type: 'text', value: v || '', placeholder: ph || '', style: { width: w || '140px' }, onchange: (e) => VN.mutate(() => fn(e.target.value)) });
    const num = (v, fn, w) => el('input', { type: 'number', value: v != null ? v : 0, style: { width: w || '64px' }, onchange: (e) => VN.mutate(() => fn(Number(e.target.value))) });
    body.appendChild(el('p', { class: 'muted' }, 'Drei Stellen: Hier Figuren einschalten. In jeder Antwort steht ein Feld „♥ Beziehung“ (+10 Ray). Und überall unter „Nur wenn“ gibt es „♥ Beziehung … ab Stufe Freund“. Den Bildschirm „Beziehungen“ öffnet der Spieler mit Taste B oder im Pausenmenü.'));
    // Figuren
    const speakers = Array.from(new Set(p.scenes.flatMap((s) => (s.type === 'story' ? s.tracks.dialog.map((d) => (d.speaker || '').trim()) : [])).filter(Boolean)));
    const chars = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Figuren mit Beziehung'));
    for (const c of Rr.chars) {
      const src = Life.relSources(c.id);
      const max = Life.relMax(c, src);
      const unreach = Life.relUnreach(c, max);
      const open = VN.ui.relOpen === c.id;
      chars.appendChild(el('div', { class: 'rel-ed' + (open ? ' open' : '') },
        el('div', { class: 'logic-row' },
          el('span', { class: 'mini-thumb', style: { backgroundImage: c.portrait ? `url("${VN.assetUrl(c.portrait)}")` : 'none' } }),
          txt(c.name, (v) => { c.name = v || 'Figur'; }, '120px'),
          el('span', { class: 'muted small' }, 'Start'), num(c.start, (v) => { c.start = Math.max(0, Math.min(100, v)); }, '56px'),
          el('input', { type: 'color', value: c.color || '#e86a9a', onchange: (e) => VN.mutate(() => { c.color = e.target.value; }) }),
          el('span', { class: 'rel-sum' + (unreach.length ? ' warn' : '') }, 'max. ' + max + ' %'),
          el('button', { class: 'btn tiny', onclick: () => { VN.ui.relOpen = open ? null : c.id; VN.render(); } }, open ? 'Weniger' : 'Belohnungen & Punkte'),
          el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { Rr.chars = Rr.chars.filter((x) => x !== c); }) }, '×')),
        ...(window.Help ? Help.list(Life.relIssues(c, src).map((i) => Object.assign({}, i, { go: null }))) : []),
        open ? Life.relDetail(c, src) : null));
    }
    chars.appendChild(el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
      ...speakers.filter((n) => !Rr.chars.some((c) => c.name === n)).map((n) => el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { Rr.chars.push({ id: VN.uid('rc'), name: n, start: 0, likes: {}, itemPrefs: {}, reactions: {}, rewards: {} }); }) }, '+ ' + n)),
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { Rr.chars.push({ id: VN.uid('rc'), name: VN.t('Neue Figur'), start: 0, likes: {}, itemPrefs: {}, reactions: {}, rewards: {} }); }) }, '+ andere Figur')));
    // Stufen
    const ladder = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Stufen-Leiter'),
      ...Rr.ladder.map((l, i) => el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '18px' } }, String(i + 1)), txt(l.name, (v) => { l.name = v || 'Stufe'; }, '130px'), el('span', { class: 'muted small' }, 'ab'), i ? num(l.min, (v) => { l.min = Math.max(0, Math.min(100, v)); }) : el('span', null, '0'), el('span', { class: 'muted small' }, '%'),
        i && Rr.ladder.length > 2 ? el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { Rr.ladder.splice(i, 1); }) }, '×') : null)),
      el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { Rr.ladder.push({ name: VN.t('Neue Stufe'), min: 100 }); Rr.ladder.sort((a, b) => a.min - b.min); }) }, '+ Stufe'));
    // Anzeige
    const sel = (v, opts, fn) => { const s = el('select', { onchange: (e) => VN.mutate(() => fn(e.target.value)) }); for (const [k, l] of opts) { const o = el('option', { value: k }, l); if (String(k) === String(v)) o.selected = true; s.appendChild(o); } return s; };
    const chk = (v, fn, label) => el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!v, onchange: (e) => VN.mutate(() => fn(e.target.checked)) }), label);
    const show = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Im Spiel'),
      chk(Rr.showNumbers !== false, (v) => { Rr.showNumbers = v; }, 'Prozente zeigen (sonst nur Balken)'),
      el('div', { class: 'logic-row' }, el('span', null, 'Nächste Belohnung'), sel(Rr.rewards || 'show', [['show', 'verraten'], ['hide', 'nur „???“'], ['none', 'gar nicht zeigen']], (v) => { Rr.rewards = v; })),
      chk(Rr.hideUnmet !== false, (v) => { Rr.hideUnmet = v; }, 'Figuren erst zeigen, wenn man sie getroffen hat'),
      chk(Rr.notify !== false, (v) => { Rr.notify = v; }, 'Rückmeldung „+10 ♥ Ray“ einblenden'),
      chk(Rr.inMenu !== false, (v) => { Rr.inMenu = v; }, 'Beziehungen im Pausenmenü (Esc) anzeigen'),
      el('div', { class: 'muted small' }, 'Testen: Beim Spieltest zeigt F2 Regler für jede Beziehung.'));
    body.append(chars, el('div', { class: 'grid2', style: { alignItems: 'start' } }, ladder, show));
  };
  Life.relDetail = (c, src) => {
    const Rr = R();
    const wrap = el('div', { class: 'rel-detail' });
    wrap.appendChild(el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, 'Porträt'), VN.assetSelect('image', c.portrait, (v) => VN.mutate(() => { c.portrait = v; }))));
    const rw = el('div', { class: 'rel-rewards' }, el('div', { class: 'sec-title' }, 'Belohnung pro Stufe (Text für den Spieler; freischalten über „Nur wenn ♥ … ab Stufe“)'));
    Rr.ladder.forEach((l, i) => { if (!i) return; const r = c.rewards[i] = c.rewards[i] || {}; rw.appendChild(el('div', { class: 'logic-row' }, el('span', { style: { width: '120px' } }, l.name + ' (' + l.min + ' %)'), el('input', { type: 'text', value: r.text || '', placeholder: 'z. B. Ein Abend auf den Dächern', style: { flex: '1' }, onchange: (e) => VN.mutate(() => { r.text = e.target.value; }) }))); });
    wrap.appendChild(rw);
    const sv = el('div', { class: 'rel-src' }, el('div', { class: 'sec-title' }, 'Woher kommen die Punkte? (' + src.length + ' Stellen)'));
    for (const x of src) sv.appendChild(el('div', { class: 'rs-row', style: { cursor: x.scene ? 'pointer' : 'default' }, onclick: () => { if (!x.scene) return; App.openScene(x.scene.id); if (x.beat != null) { VN.ui.beat = x.beat; VN.render(); } } }, el('span', { class: 'rs-pts' + (x.pos ? '' : ' neg') }, x.pos ? '+' + x.pos : Math.min(...x.all)), el('span', { class: 'rs-sc' }, x.scene ? x.scene.name + (x.beat != null ? ' · Schritt ' + (x.beat + 1) : '') : (x.endless ? '🎁' : '⚙')), el('span', { class: 'muted small' }, x.label)));
    if (!src.length) sv.appendChild(el('div', { class: 'muted small' }, 'Noch nirgends. Trag in einer Antwort unter „♥ Beziehung“ etwas ein.'));
    const test = el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, 'Test ab hier mit'),
      el('input', { type: 'number', min: 0, max: 100, value: (VN.ui.relTest && VN.ui.relTest[c.id]) || '', placeholder: '%', style: { width: '64px' }, onchange: (e) => { VN.ui.relTest = VN.ui.relTest || {}; if (e.target.value === '') delete VN.ui.relTest[c.id]; else VN.ui.relTest[c.id] = Number(e.target.value); } }),
      el('span', { class: 'muted small' }, '% – gilt für „Szene testen“ und „▶ ab Schritt“, bis du das Feld leerst'));
    wrap.append(Life.msEditor(c), sv, test);
    return wrap;
  };

  // ---------- Editor: Reiter „Geschenke“ ----------
  Life.giftsTab = (body) => {
    const p = VN.project, Rr = R();
    body.appendChild(el('p', { class: 'muted' }, 'Gegenstände mit Haken „verschenkbar“ können Figuren gegeben werden (Aktion „🎁 Geschenk geben lassen“, z. B. an einem Hub-Objekt). Vorlieben legst du pro Kategorie fest, Sonderfälle pro Gegenstand. Der Spieler entdeckt die Vorlieben erst beim Schenken.'));
    const tags = Array.from(new Set(p.items.flatMap(Life.itemTags)));
    const sel = (v, fn) => { const s = el('select', { class: 'gift-lv ' + (v || ''), onchange: (e) => VN.mutate(() => fn(e.target.value)) }, el('option', { value: '' }, '–'), ...LEVELS.map(([k, l]) => { const o = el('option', { value: k }, l); if (k === v) o.selected = true; return o; })); return s; };
    // Gegenstände
    const items = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Gegenstände'));
    for (const it of p.items) items.appendChild(el('div', { class: 'logic-row' },
      el('span', { class: 'mini-thumb', style: { backgroundImage: it.image ? `url("${VN.assetUrl(it.image)}")` : 'none' } }),
      el('span', { style: { width: '140px' } }, it.name),
      el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!it.gift, onchange: (e) => VN.mutate(() => { it.gift = e.target.checked; }) }), 'verschenkbar'),
      el('input', { type: 'text', value: it.tags || '', placeholder: 'Kategorien, z. B. Blumen, Süßes', style: { flex: '1' }, onchange: (e) => VN.mutate(() => { it.tags = e.target.value; }) })));
    // Tabelle Kategorien × Figuren
    const cols = '160px ' + Rr.chars.map(() => 'minmax(110px, 1fr)').join(' ');
    const head = el('div', { class: 'sys-row head', style: { gridTemplateColumns: cols } }, el('span', null, 'Kategorie / Gegenstand'), ...Rr.chars.map((c) => el('span', null, c.name)));
    const rows = tags.map((t) => el('div', { class: 'sys-row', style: { gridTemplateColumns: cols } }, el('span', null, t), ...Rr.chars.map((c) => sel(c.likes[t], (v) => { if (v) c.likes[t] = v; else delete c.likes[t]; }))));
    const ovr = p.items.filter((it) => it.gift).map((it) => el('div', { class: 'sys-row sub', style: { gridTemplateColumns: cols } }, el('span', { class: 'muted' }, '↳ nur ' + it.name), ...Rr.chars.map((c) => sel(c.itemPrefs[it.id], (v) => { if (v) c.itemPrefs[it.id] = v; else delete c.itemPrefs[it.id]; }))));
    const table = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Wer mag was?'),
      Rr.chars.length ? el('div', { class: 'sys-table' }, head, ...rows, ...ovr) : el('div', { class: 'muted small' }, 'Lege zuerst unter „Beziehungen“ Figuren an.'),
      !tags.length ? el('div', { class: 'muted small' }, 'Gib Gegenständen oben Kategorien, dann erscheinen sie hier.') : null);
    // Punkte, Reaktionen, Regeln
    const pts = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Punkte & Regeln'),
      ...LEVELS.map(([k, l]) => el('div', { class: 'logic-row' }, el('span', { style: { width: '140px' } }, l), el('input', { type: 'number', value: Rr.giftPts[k], style: { width: '64px' }, onchange: (e) => VN.mutate(() => { Rr.giftPts[k] = Number(e.target.value); }) }), el('span', { class: 'muted small' }, '♥'))),
      el('div', { class: 'logic-row' }, el('span', null, 'Höchstens ein Geschenk pro Figur'), (() => { const s = el('select', { onchange: (e) => VN.mutate(() => { Rr.giftLimit = e.target.value; }) }); for (const [k, l] of [['scene', 'pro Szene'], ['day', 'pro Tag (Zeit nötig)'], ['none', 'unbegrenzt']]) { const o = el('option', { value: k }, l); if ((Rr.giftLimit || 'scene') === k) o.selected = true; s.appendChild(o); } return s; })()),
      el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: Rr.diminish !== false, onchange: (e) => VN.mutate(() => { Rr.diminish = e.target.checked; }) }), 'Das gleiche Geschenk wirkt jedes Mal nur halb so stark'));
    const react = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Reaktionen (leer = Standard)'));
    for (const c of Rr.chars) react.appendChild(el('div', { class: 'rel-react' }, el('strong', null, c.name), ...LEVELS.map(([k, l]) => el('div', { class: 'logic-row' }, el('span', { class: 'muted small', style: { width: '120px' } }, l), el('input', { type: 'text', value: c.reactions[k] || '', style: { flex: '1' }, placeholder: { love: 'Oh! Das ist ja wunderbar – danke!', like: 'Danke, das ist lieb von dir.', neutral: 'Oh … danke.', dislike: 'Hm. Na ja … danke.', hate: 'Bitte nimm das weg!' }[k], onchange: (e) => VN.mutate(() => { c.reactions[k] = e.target.value; }) })))));
    body.append(el('div', { class: 'grid2', style: { alignItems: 'start' } }, items, pts), table, react);
  };

  // Mitgelieferte Plugins als Schalter
  Life.BUNDLED = [
    { file: 'jobs.js', id: 'jobs', icon: '💼', title: 'Jobs', desc: 'Arbeiten gehen: Zeit vergeht, Geld kommt. Mit Zufallsereignissen und Platz für ein Minispiel. Mitgeliefertes Plugin – zum Anpassen oder als Vorlage.' },
    { file: 'minispiele.js', id: 'minispiele', icon: '🎲', title: 'Minispiele', desc: 'Klick-Reflex, Memory, Puzzle, Kochen & Brauen, Münzwurf, Blütenblätter zupfen. Jedes liefert ein Ergebnis für Lohn, Beziehung oder Pfad.' }
  ];
  Life.pluginSwitches = (card) => {
    const p = VN.project;
    return Life.BUNDLED.map((b) => {
      const on = (VNPlugin.available || []).includes(b.file) && p.plugins[b.file] && p.plugins[b.file].enabled !== false;
      const def = VNPlugin.plugins[b.id];
      const sub = on && def && def.subSwitches ? el('div', { class: 'ss-sub' }, ...def.subSwitches()) : null;
      return card(b.icon, b.title + ' · Plugin', b.desc, on, (v) => VNPlugin.setBundled(b.file, v), on && def && def.editorTab ? 'pl:' + b.id : null, sub);
    });
  };

  // Schalter in der Übersicht
  Life.extraSwitches = (card, set) => {
    const p = VN.project, Rr = p.relations;
    return [card('♥', 'Beziehungen', 'Beziehungswerte mit Stufen (Fremd → Verliebt), Belohnungen, Bildschirm „Beziehungen“ (Taste B).', Rr.enabled, set((v) => { Rr.enabled = v; }), 'rel',
      Rr.enabled ? el('div', { class: 'ss-sub' }, el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!Rr.gifts, onchange: (e) => VN.mutate(() => { Rr.gifts = e.target.checked; }) }), '🎁 Geschenke (Vorlieben, Reaktionen)')) : null),
    ...Life.pluginSwitches(card)];
  };
})();

// Übersetzbare Texte der Lebenssimulation ins Transkript
(function () {
  const base = VN.collectTexts;
  VN.collectTexts = () => {
    const out = base();
    const p = VN.project;
    if (p.time && p.time.enabled) {
      p.time.slots.forEach((t, i) => out.push({ id: 'time:slot' + i, area: 'Zeit', where: 'Tageszeit', who: 'Zeit', text: t, set: (v) => { p.time.slots[i] = v; } }));
      p.time.days.forEach((t, i) => out.push({ id: 'time:wd' + i, area: 'Zeit', where: 'Wochentag', who: 'Zeit', text: t, set: (v) => { p.time.days[i] = v; } }));
    }
    for (const s of p.shops || []) out.push({ id: s.id + ':name', area: 'Läden', where: 'Name', who: 'Laden', text: s.name, set: (v) => { s.name = v; } });
    if (p.relations && p.relations.enabled) for (const c of p.relations.chars) for (const [k, r] of Object.entries(c.rewards || {})) if (r && r.text) out.push({ id: c.id + ':rw' + k, area: 'Beziehungen', where: c.name, who: 'Belohnung', text: r.text, set: (v) => { r.text = v; } });
    if (p.relations && p.relations.enabled) for (const c of p.relations.chars) for (const m of c.milestones || []) { if (m.text) out.push({ id: m.id + ':text', area: 'Beziehungen', where: c.name + ' · ' + m.at + ' %', who: c.name, text: m.text, set: (v) => { m.text = v; } }); if (m.notify) out.push({ id: m.id + ':note', area: 'Beziehungen', where: c.name + ' · ' + m.at + ' %', who: 'Meldung', text: m.notify, set: (v) => { m.notify = v; } }); }
    const jd = p.pluginData && p.pluginData.jobs;
    if (jd && jd.jobs) for (const j of jd.jobs) { out.push({ id: j.id + ':name', area: 'Jobs', where: 'Name', who: 'Job', text: j.name, set: (v) => { j.name = v; } }); if (j.text) out.push({ id: j.id + ':text', area: 'Jobs', where: j.name, who: 'Text', text: j.text, set: (v) => { j.text = v; } }); }
    return out;
  };
})();
