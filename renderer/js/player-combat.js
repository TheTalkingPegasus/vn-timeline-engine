// Kampf im Spiel: Seitenansicht, Befehlsmenü, Ziele, einfache Animationen, Sieg/Niederlage/Flucht.
// VN.CombatScreen.open(...) zeichnet einen Kampf in ein Element (auch als Probekampf im Editor).
// VN.PlayerCombat(H) bindet ihn in den Spieler ein (Musik, Belohnung, Szenenwechsel, Wiederholen).
(function () {
  const { el } = VN;
  const CB = () => VN.Combat;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Plätze (Fußpunkt in % der Bühne). Gegner links, Helden rechts.
  const FOE_SLOTS = { 1: [[27, 66]], 2: [[31, 58], [16, 70]], 3: [[31, 54], [17, 64], [31, 72]] };
  const FOE_MORE = [[33, 52], [19, 58], [33, 71], [7, 66], [21, 75], [8, 49]];
  const HERO_SLOTS = [[67, 47], [73, 56], [79, 65], [85, 74]];
  const FX_OF = { phys: 'slash', magic: 'hit', heal: 'heal', revive: 'holy', buff: 'buff', debuff: 'debuff' };
  const EL_FX = { fire: 'fire', ice: 'ice', thunder: 'thunder', earth: 'earth', holy: 'holy', dark: 'dark' };
  const STAT_SHORT = { atk: 'ANG', def: 'ABW', mag: 'MAG', spd: 'TMP' };

  VN.CombatScreen = {
    // opts: { host, rs, battle, test, level, story, sfx(asset), onEnd(result, fight) }
    open(opts) {
      const cb = CB();
      const rs = opts.rs;
      // Texte: im Spiel nach Spielsprache, im Probekampf nach Editor-Sprache
      const tt = (x) => (opts.test ? VN.t(x) : VN.tp(x));
      const b = opts.battle;
      const story = opts.story != null ? opts.story : !!VN.settings.storyMode && cb.cfg().story !== false;
      const fi = cb.newFight(b, rs, { level: opts.level, story, party: opts.party });
      const speed = Math.max(0.5, Number(cb.cfg().speed) || 1);
      const T = (ms) => ms / speed;
      const root = el('div', { class: 'cb-screen' + (b.bg ? ' has-bg' : '') + (opts.test && !b.bg ? ' arena' : ''), onclick: (e) => e.stopPropagation() });
      if (b.bg && VN.assetUrl(b.bg)) root.appendChild(el('div', { class: 'cb-bg', style: { backgroundImage: `url("${VN.assetUrl(b.bg)}")` } }));
      const field = el('div', { class: 'cb-field' });
      const top = el('div', { class: 'cb-top' });
      const order = el('div', { class: 'cb-order' });
      const banner = el('div', { class: 'cb-banner', hidden: true });
      top.append(order, opts.test ? el('span', { class: 'cb-test' }, 'Probekampf' + (opts.level ? ' · ' + tt('Stufe') + ' ' + opts.level : '')) : null, story ? el('span', { class: 'cb-test story' }, 'Story-Modus') : null);
      const panel = el('div', { class: 'cb-panel' });
      const cmds = el('div', { class: 'cb-cmds' });
      const party = el('div', { class: 'cb-party' });
      panel.append(cmds, party);
      root.append(field, top, banner, panel);
      opts.host.appendChild(root);
      if (window.UiDesign) { UiDesign.apply('combat', panel); for (const k of ['oPanel', 'oMenu', 'oBars']) if (panel.dataset[k]) root.dataset[k] = panel.dataset[k]; }
      const sfx = (a) => { if (a && opts.sfx) opts.sfx(a); };

      // ---------- Figuren ----------
      const foes = fi.units.filter((u) => u.side === 'enemy');
      const heroes = fi.units.filter((u) => u.side === 'hero');
      const foeSlots = FOE_SLOTS[foes.length] || FOE_MORE;
      foes.forEach((u, i) => { u.pos = foeSlots[i % foeSlots.length]; });
      heroes.forEach((u, i) => { u.pos = heroes.length === 1 ? [74, 60] : HERO_SLOTS[i]; });
      for (const u of fi.units) {
        const f = u.f;
        const url = f.image && VN.assetUrl(f.image);
        const sc = (Number(f.scale) || 100) / 100;
        const sprite = url ? el('img', { class: 'cb-img', src: url, draggable: 'false', style: { height: (u.side === 'hero' ? 24 : 28) * sc + 'cqh', transform: f.flip ? 'scaleX(-1)' : '' } })
          : el('div', { class: 'cb-ph', style: { fontSize: (u.side === 'hero' ? 11 : 13) * sc + 'cqh' } }, f.icon || (u.side === 'hero' ? '🛡️' : '👾'));
        u.el = el('div', { class: 'cb-unit ' + u.side, style: { left: u.pos[0] + '%', top: u.pos[1] + '%', zIndex: String(10 + Math.round(u.pos[1])) } },
          el('div', { class: 'cb-shadow' }), el('div', { class: 'cb-body' }, sprite),
          el('div', { class: 'cb-tag' }, el('span', { class: 'cb-nm' }, u.name), u.side === 'enemy' ? el('div', { class: 'cb-mini' }, el('i')) : null),
          el('div', { class: 'cb-buffs' }));
        u.el.addEventListener('mouseenter', () => { if (mode === 'target' && targets.includes(u)) { tIdx = targets.indexOf(u); drawTargets(); } });
        u.el.addEventListener('click', (e) => { e.stopPropagation(); if (mode === 'target' && targets.includes(u)) { tIdx = targets.indexOf(u); confirmTarget(); } });
        field.appendChild(u.el);
      }
      const refreshUnit = (u) => {
        const bar = u.el.querySelector('.cb-mini i');
        if (bar) bar.style.width = Math.max(0, u.hp / u.maxHp * 100) + '%';
        u.el.classList.toggle('ko', u.ko);
        u.el.classList.toggle('defending', !!u.defending);
        const bf = u.el.querySelector('.cb-buffs');
        bf.innerHTML = '';
        for (const x of u.buffs) bf.appendChild(el('span', { class: x.pct > 0 ? 'up' : 'down' }, (x.pct > 0 ? '▲' : '▼') + tt(STAT_SHORT[x.stat] || x.stat)));
      };
      const drawParty = () => {
        party.innerHTML = '';
        for (const u of heroes) {
          const low = !u.ko && u.hp < u.maxHp * 0.25;
          party.appendChild(el('div', { class: 'cb-prow' + (u === cur ? ' on' : '') + (u.ko ? ' ko' : '') + (low ? ' low' : '') },
            el('span', { class: 'cb-pname' }, u.name, el('small', null, ' ' + tt('St.') + ' ' + u.lvl)),
            el('span', { class: 'cb-pbar hp' }, el('i', { style: { width: u.hp / u.maxHp * 100 + '%' } }), el('b', null, tt('LP') + ' ' + u.hp + '/' + u.maxHp)),
            u.maxMp ? el('span', { class: 'cb-pbar mp' }, el('i', { style: { width: u.mp / Math.max(1, u.maxMp) * 100 + '%' } }), el('b', null, tt('MP') + ' ' + u.mp + '/' + u.maxMp)) : el('span')));
        }
      };
      const drawOrder = () => {
        order.innerHTML = '';
        const list = [cur, ...fi.queue].filter((u) => u && !u.ko).slice(0, 8);
        list.forEach((u, i) => order.appendChild(el('span', { class: 'cb-oc ' + u.side + (i === 0 ? ' now' : '') }, u.f.icon || (u.side === 'hero' ? '🛡' : '👾'), el('span', null, u.name))));
      };
      const all = () => { for (const u of fi.units) refreshUnit(u); drawParty(); drawOrder(); };

      // ---------- Effekte ----------
      const center = (u) => { const r = u.el.querySelector('.cb-body').getBoundingClientRect(), f = field.getBoundingClientRect(); return [(r.left + r.width / 2 - f.left) / f.width * 100, (r.top + r.height / 2 - f.top) / f.height * 100]; };
      const number = (u, text, cls) => {
        const [x, y] = center(u);
        const n = el('div', { class: 'cb-num ' + (cls || ''), style: { left: x + '%', top: (y - 6) + '%' } }, text);
        field.appendChild(n);
        setTimeout(() => n.remove(), 1400);
      };
      const showFx = (u, kind, img) => {
        const [x, y] = center(u);
        let n;
        if (img && VN.assetUrl(img)) n = el('img', { class: 'cb-fx fx-img', src: VN.assetUrl(img), style: { left: x + '%', top: y + '%' } });
        else if (kind && kind !== 'none') {
          const parts = { fire: '🔥🔥🔥', ice: '❄❄❄', heal: '✚✚✚', buff: '▲▲▲', debuff: '▼▼▼', earth: '●●●', dark: '', holy: '', thunder: '', slash: '', hit: '' }[kind] || '';
          n = el('div', { class: 'cb-fx fx-' + kind, style: { left: x + '%', top: y + '%' } }, ...[...parts].map((ch, i) => el('span', { style: { '--i': i } }, ch)));
          if (kind === 'thunder') { root.classList.remove('flash'); void root.offsetWidth; root.classList.add('flash'); }
        }
        if (n) { field.appendChild(n); setTimeout(() => n.remove(), 900); }
      };
      const anim = (u, cls, ms) => { u.el.classList.remove(cls); void u.el.offsetWidth; u.el.classList.add(cls); setTimeout(() => u.el.classList.remove(cls), ms); };
      const say = (text) => { banner.hidden = !text; banner.textContent = text || ''; };

      // Eine Handlung ausführen und zeigen
      const perform = async (u, cmd) => {
        const ab = cmd.ab;
        say(cmd.kind === 'attack' ? u.name + ' · ' + tt('Angriff') : cmd.kind === 'skill' ? u.name + ' · ' + (ab.icon ? ab.icon + ' ' : '') + cb.name(ab) : cmd.kind === 'item' ? u.name + ' · ' + VN.tr(cmd.item.id + ':name', cmd.item.name) : cmd.kind === 'defend' ? u.name + ' · ' + tt('Verteidigen') : u.name + ' · ' + tt('Flucht') + ' …');
        const melee = cmd.kind === 'attack' || (ab && ab.kind === 'phys');
        if (cmd.kind === 'attack' || cmd.kind === 'skill' || cmd.kind === 'item') anim(u, melee ? 'lunge' : 'cast', T(520));
        if (cmd.kind === 'item' && opts.rs.inv) { opts.rs.inv[cmd.item.id] = Math.max(0, (opts.rs.inv[cmd.item.id] || 0) - 1); if (!opts.rs.inv[cmd.item.id]) delete opts.rs.inv[cmd.item.id]; }
        await wait(T(melee ? 260 : 380));
        const ev = cb.act(fi, u, cmd);
        const fxKind = cmd.kind === 'attack' ? 'slash' : ab ? (ab.fx && ab.fx !== 'auto' ? ab.fx : EL_FX[ab.element] || FX_OF[ab.kind] || 'hit') : cmd.kind === 'item' ? ({ heal: 'heal', mp: 'heal', revive: 'holy', dmg: 'fire' })[(cb.itemFight(cmd.item) || {}).kind] : null;
        const conf = cb.cfg().sounds || {};
        if (ab && ab.sound) sfx(ab.sound);
        else if (cmd.kind === 'attack' || (ab && ab.kind === 'phys')) sfx(conf.hit);
        else if (ab && (ab.kind === 'heal' || ab.kind === 'revive')) sfx(conf.heal);
        else if (ab) sfx(conf.magic);
        const hitUnits = new Set();
        for (const e of ev) if (e.u && e.t !== 'ko' && !hitUnits.has(e.u) && e.t !== 'defend' && e.t !== 'flee' && e.t !== 'fleefail') { hitUnits.add(e.u); showFx(e.u, fxKind, ab && ab.fxImage); }
        await wait(T(240));
        for (const e of ev) {
          if (e.t === 'dmg') { number(e.u, String(e.n), (e.crit ? 'crit' : '') + (e.u.side === 'hero' ? ' hurt' : '')); anim(e.u, 'hit', 420); if (e.weak) number(e.u, tt('Schwachpunkt!'), 'tag'); else if (e.resist) number(e.u, tt('Resistent'), 'tag dim'); if (e.crit) { root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake'); } }
          else if (e.t === 'heal') number(e.u, '+' + e.n, 'heal');
          else if (e.t === 'mp') number(e.u, '+' + e.n + ' ' + tt('MP'), 'mp');
          else if (e.t === 'revive') number(e.u, tt('Wieder da!'), 'heal');
          else if (e.t === 'miss') number(e.u, tt('Verfehlt'), 'tag dim');
          else if (e.t === 'buff') number(e.u, (e.pct > 0 ? '▲ ' : '▼ ') + tt(STAT_SHORT[e.stat] || e.stat), e.pct > 0 ? 'heal' : 'tag dim');
          else if (e.t === 'ko') { sfx(conf.ko); }
          else if (e.t === 'fleefail') say(tt('Flucht misslungen!'));
          else if (e.t === 'flee') say(tt('Entkommen!'));
        }
        all();
        await wait(T(ev.some((e) => e.t === 'ko') ? 900 : 700));
      };

      // ---------- Spieler-Eingabe ----------
      let cur = null, mode = 'wait', menu = [], mIdx = 0, sub = null, targets = [], tIdx = 0, pending = null, done = false, resolveTurn = null;
      const btn = (label, fn, extra = {}) => el('button', Object.assign({ class: 'cb-cmd' + (extra.off ? ' off' : ''), disabled: !!extra.off, title: extra.title || '', onclick: (e) => { e.stopPropagation(); if (!extra.off) { if (window.Theme) Theme.sound('click'); fn(); } } }), el('span', { class: 'cb-l' }, label), extra.right ? el('span', { class: 'cb-r' }, extra.right) : null);
      const drawMenu = () => {
        cmds.innerHTML = '';
        if (mode === 'target') {
          cmds.appendChild(el('div', { class: 'cb-hint' }, tt('Ziel wählen'), el('small', null, cb.multi(pending.ab) ? tt('Trifft alle') : tt('Pfeiltasten + Enter · Esc zurück'))));
          cmds.appendChild(btn(tt('Zurück'), back));
          return;
        }
        if (mode !== 'menu' || !cur) { cmds.appendChild(el('div', { class: 'cb-hint wait' }, cur && cur.side === 'enemy' ? cur.name + ' …' : '')); return; }
        const items = sub === 'skills' ? cur.skills.map((ab) => btn((ab.icon ? ab.icon + ' ' : '') + cb.name(ab), () => choose({ kind: 'skill', ab }), { off: !cb.usable(cur, ab) || !cb.targetsFor(fi, cur, ab).length, right: (Number(ab.mp) || 0) + ' ' + tt('MP'), title: VN.tr(ab.id + ':desc', ab.desc || '') }))
          : sub === 'items' ? cb.items(rs).map((it) => btn(VN.tr(it.id + ':name', it.name), () => choose({ kind: 'item', item: it }), { right: '×' + rs.inv[it.id] }))
          : [btn('⚔️ ' + tt('Angriff'), () => choose({ kind: 'attack' })),
            btn('✦ ' + tt('Fähigkeiten'), () => { sub = 'skills'; mIdx = 0; drawMenu(); }, { off: !cur.skills.length }),
            btn('🎒 ' + tt('Gegenstände'), () => { sub = 'items'; mIdx = 0; drawMenu(); }, { off: !cb.items(rs).length || opts.test }),
            btn('🛡️ ' + tt('Verteidigen'), () => choose({ kind: 'defend' })),
            btn('💨 ' + tt('Fliehen'), () => choose({ kind: 'flee' }), { off: b.canFlee === false })];
        if (sub) items.push(btn('↩ ' + tt('Zurück'), back));
        menu = items;
        const box = el('div', { class: 'cb-list' + (sub ? ' sub' : '') }, ...items);
        cmds.appendChild(el('div', { class: 'cb-who' }, cur.name));
        cmds.appendChild(box);
        mIdx = Math.min(mIdx, items.length - 1);
        if (items[mIdx]) items[mIdx].classList.add('focus');
      };
      const drawTargets = () => {
        for (const u of fi.units) u.el.classList.remove('targetable', 'aim');
        if (mode !== 'target') return;
        for (const u of targets) u.el.classList.add('targetable');
        if (cb.multi(pending.ab)) targets.forEach((u) => u.el.classList.add('aim'));
        else if (targets[tIdx]) targets[tIdx].el.classList.add('aim');
      };
      const choose = (cmd) => {
        if (cmd.kind === 'defend' || cmd.kind === 'flee') return finishTurn(Object.assign(cmd, { targets: [] }));
        let list;
        if (cmd.kind === 'item') { const f = cb.itemFight(cmd.item); list = f.kind === 'dmg' ? fi.units.filter((u) => u.side === 'enemy' && !u.ko) : f.kind === 'revive' ? heroes.filter((u) => u.ko) : heroes.filter((u) => !u.ko); if (f.all) { return finishTurn(Object.assign(cmd, { targets: list })); } cmd.ab = null; }
        else list = cb.targetsFor(fi, cur, cmd.ab || null);
        if (!list.length) return;
        if (cmd.ab && cmd.ab.target === 'self') return finishTurn(Object.assign(cmd, { targets: [cur] }));
        pending = cmd; targets = list; mode = 'target';
        const wk = list.findIndex((u) => cmd.ab && (u.f.weak || []).includes(cmd.ab.element));
        tIdx = list[0].side === 'hero' && cmd.ab && cmd.ab.kind === 'heal' ? list.indexOf(list.slice().sort((a, b2) => a.hp / a.maxHp - b2.hp / b2.maxHp)[0]) : Math.max(0, wk);
        drawMenu(); drawTargets();
      };
      const confirmTarget = () => {
        if (mode !== 'target') return;
        const cmd = pending;
        cmd.targets = cb.multi(cmd.ab) ? targets.slice() : [targets[tIdx]];
        finishTurn(cmd);
      };
      const back = () => {
        if (mode === 'target') { mode = 'menu'; pending = null; targets = []; drawTargets(); drawMenu(); return; }
        if (sub) { sub = null; mIdx = 0; drawMenu(); }
      };
      const finishTurn = (cmd) => { mode = 'wait'; sub = null; targets = []; drawTargets(); drawMenu(); const r = resolveTurn; resolveTurn = null; if (r) r(cmd); };
      const askHero = (u) => new Promise((res) => { resolveTurn = res; mode = 'menu'; sub = null; mIdx = 0; drawMenu(); });

      const onKey = (e) => {
        if (done) return;
        const k = e.key;
        if (mode === 'target') {
          if (k === 'ArrowLeft' || k === 'ArrowUp') { tIdx = (tIdx - 1 + targets.length) % targets.length; drawTargets(); }
          else if (k === 'ArrowRight' || k === 'ArrowDown') { tIdx = (tIdx + 1) % targets.length; drawTargets(); }
          else if (k === 'Enter' || k === ' ') confirmTarget();
          else if (k === 'Escape' || k === 'Backspace') back();
          return;
        }
        if (mode === 'menu') {
          if (k === 'ArrowUp' || k === 'ArrowDown') { const step = k === 'ArrowUp' ? -1 : 1; for (let i = 0; i < menu.length; i++) { mIdx = (mIdx + step + menu.length) % menu.length; if (!menu[mIdx].disabled) break; } drawMenu(); }
          else if ((k === 'Enter' || k === ' ') && menu[mIdx] && !menu[mIdx].disabled) menu[mIdx].click();
          else if (k === 'Escape' || k === 'Backspace') back();
        }
      };

      // ---------- Ablauf ----------
      const loop = async () => {
        all();
        await wait(T(500));
        while (!cb.over(fi) && !done) {
          cur = cb.nextActor(fi);
          if (!cur) break;
          all();
          for (const u of fi.units) u.el.classList.toggle('turn', u === cur);
          say('');
          let cmd;
          if (cur.side === 'hero' && !opts.auto) { cmd = await askHero(cur); }
          else { drawMenu(); await wait(T(cur.side === 'hero' ? 250 : 520)); cmd = cb.ai(fi, cur, cur.side === 'hero' ? 'smart' : null); }
          if (done) return;
          await perform(cur, cmd);
        }
        cur = null; for (const u of fi.units) u.el.classList.remove('turn');
        all(); say('');
        return cb.over(fi);
      };

      const result = (res, info) => new Promise((resolve) => {
        const c = cb.cfg();
        const box = el('div', { class: 'cb-result ' + res });
        if (window.UiDesign) UiDesign.apply('combat', box);
        box.appendChild(el('h2', null, res === 'win' ? tt('Sieg!') : res === 'lose' ? tt('Niederlage') : tt('Entkommen!')));
        if (res === 'win' && info) {
          const lines = el('div', { class: 'cb-rlines' });
          if (info.xp) lines.appendChild(el('div', null, '+' + info.xp + ' ' + tt('EP')));
          for (const g of info.gains || []) if (!g.empty) lines.appendChild(el('div', null, '+ ' + VN.lootName(g)));
          for (const up of info.ups || []) lines.appendChild(el('div', { class: 'cb-up' }, '★ ' + cb.name(up.hero) + ' ' + tt('erreicht Stufe') + ' ' + up.lvl + '!' + (up.learned.length ? ' ' + tt('Neu:') + ' ' + up.learned.map((a) => cb.name(a)).join(', ') : '')));
          if (lines.children.length) box.appendChild(lines);
        }
        if (res === 'lose' && opts.test) box.appendChild(el('div', { class: 'cb-rlines' }, el('div', null, tt('Tipp: Mit „100× simulieren“ siehst du, wie schwer der Kampf ist.'))));
        const row = el('div', { class: 'cb-rbtns' });
        const go = (v) => { box.remove(); resolve(v); };
        if (res === 'lose' && !opts.test) {
          row.appendChild(el('button', { class: 'sys-btn primary', onclick: (e) => { e.stopPropagation(); go('retry'); } }, tt('Nochmal versuchen')));
          if (!story && c.story !== false) row.appendChild(el('button', { class: 'sys-btn', onclick: (e) => { e.stopPropagation(); VN.settings.storyMode = true; if (opts.saveSettings) opts.saveSettings(); go('retry'); } }, tt('Nochmal im Story-Modus')));
          row.appendChild(el('button', { class: 'sys-btn', onclick: (e) => { e.stopPropagation(); go('give'); } }, tt('Aufgeben')));
        } else row.appendChild(el('button', { class: 'sys-btn primary', onclick: (e) => { e.stopPropagation(); go('ok'); } }, opts.test ? tt('Schließen') : tt('Weiter')));
        box.appendChild(row);
        root.appendChild(box);
        setTimeout(() => { const f = row.querySelector('button'); if (f) f.focus(); }, 50);
      });

      const api = {
        fight: fi, root, onKey,
        // Schließen löst auch eine wartende Eingabe auf, damit der Ablauf sauber endet
        close() { done = true; root.remove(); const r = resolveTurn; resolveTurn = null; if (r) r(null); },
        run: async () => {
          const res = await loop();
          if (done) return { res: 'abort' };
          return { res };
        },
        result,
        // Standbild für die Design-Vorschau: erster Held ist dran
        preview() { cur = heroes[0] || null; fi.queue = fi.units.filter((u) => u !== cur && !u.ko); mode = cur ? 'menu' : 'wait'; all(); drawMenu(); for (const u of fi.units) u.el.classList.toggle('turn', u === cur); }
      };
      return api;
    }
  };

  // ---------- Einbindung in den Spieler ----------
  VN.PlayerCombat = (H) => {
    const R = H.run;
    let screen = null;
    const start = async (battleId) => {
      const r = R();
      const cb = CB();
      const b = cb.battle(battleId);
      if (!r || !b) return null;
      const snap = cb.snap(r.rs);
      const prevMusic = H.A.music ? { asset: H.A.music.asset, vol: H.A.music.vol, loop: H.A.music.loop, carry: H.A.music.carry, fade: 1 } : null;
      const c = cb.cfg();
      const mus = b.music || c.music;
      r.overlay = 'combat';
      H.stage().classList.add('in-battle');
      if (window.VNPlugin) VNPlugin.hook('onBattleStart', b.id, H.ctx());
      let out = null;
      while (true) {
        if (mus) H.playMusic({ asset: mus, vol: 75, loop: true, fade: 0.6 });
        H.uiSound('open');
        screen = VN.CombatScreen.open({ host: H.stage(), rs: r.rs, battle: b, sfx: (a) => H.sfx(a), saveSettings: () => H.saveSettings() });
        const { res } = await screen.run();
        if (res === 'abort' || R() !== r) { screen = null; H.stage().classList.remove('in-battle'); return null; }
        const fin = cb.finish(screen.fight, r.rs, res);
        if (res === 'win' && c.winMusic) H.playMusic({ asset: c.winMusic, vol: 80, loop: false, fade: 0.2 });
        if (res === 'lose' && c.loseMusic) H.playMusic({ asset: c.loseMusic, vol: 80, loop: false, fade: 0.2 });
        const choice = await screen.result(res, fin);
        screen.close();
        screen = null;
        if (res === 'lose' && choice === 'retry') { cb.restore(r.rs, snap); continue; }
        out = { res, fin };
        break;
      }
      if (prevMusic && prevMusic.asset) H.playMusic(prevMusic); else if (mus) H.stopMusic(1);
      r.overlay = null;
      H.stage().classList.remove('in-battle');
      const k = out.res === 'win' ? 'win' : out.res === 'lose' ? 'lose' : 'flee';
      const gains = out.fin.gains;
      const more = VN.applyActions((b[k] && b[k].actions) || [], r.rs, 'battle:' + b.id + ':' + k);
      for (const g of more) gains.push(g);
      for (const f of more.pending || []) gains.pending.push(f);
      // Beute stand schon im Sieg-Fenster: nur die Gewinne aus den Aktionen noch einblenden
      const show = more.slice(); show.pending = gains.pending;
      H.afterChange(show);
      if (window.VNPlugin) VNPlugin.hook('onBattleEnd', b.id, out.res, H.ctx());
      const target = b[k] && b[k].scene;
      if (target && VN.scene(target)) r.jump = target;
      else if (out.res === 'lose' && (b.lose || {}).mode !== 'continue') r.jump = '@end';
      return out.res;
    };
    const onKey = (e) => { if (screen) screen.onKey(e); };
    // Spiel wird beendet oder ins Hauptmenü gewechselt: laufenden Kampf abbrechen
    const abort = () => { if (screen) { const s = screen; screen = null; s.close(); } if (R()) H.stage().classList.remove('in-battle'); };
    // Gruppe: Stufe, Erfahrung, Werte und Fähigkeiten der Helden (Pausenmenü, Taste G)
    const partyScreen = (back) => new Promise((resolve) => {
      const r = R();
      const cb = CB();
      if (!r || !cb.on()) return resolve();
      r.overlay = 'party';
      H.setPanelKind('pause');
      const st = cb.state(r.rs);
      const list = el('div', { class: 'cb-party-list' });
      for (const id of st.party) {
        const h = cb.hero(id);
        if (!h) continue;
        const hs = cb.heroState(r.rs, h);
        const url = h.image && VN.assetUrl(h.image);
        const maxHp = cb.heroStat(h, 'hp', hs.lvl, r.rs), maxMp = cb.heroStat(h, 'mp', hs.lvl, r.rs);
        const hp = cb.cfg().heal === 'full' || hs.hp == null ? maxHp : Math.min(maxHp, hs.hp);
        const mp = cb.cfg().heal === 'full' || hs.mp == null ? maxMp : Math.min(maxMp, hs.mp);
        const need = cb.xpNeed(hs.lvl);
        list.appendChild(el('div', { class: 'cb-pcard' },
          url ? el('div', { class: 'cb-pimg', style: { backgroundImage: `url("${url}")`, transform: h.flip ? 'scaleX(-1)' : '' } }) : el('div', { class: 'cb-pimg ph' }, h.icon || '🛡️'),
          el('div', { class: 'cb-pinfo' },
            el('div', { class: 'cb-ptitle' }, el('strong', null, cb.name(h)), el('span', null, VN.tp('Stufe') + ' ' + hs.lvl)),
            el('div', { class: 'cb-pbar hp' }, el('i', { style: { width: hp / maxHp * 100 + '%' } }), el('b', null, VN.tp('LP') + ' ' + hp + '/' + maxHp)),
            maxMp ? el('div', { class: 'cb-pbar mp' }, el('i', { style: { width: mp / maxMp * 100 + '%' } }), el('b', null, VN.tp('MP') + ' ' + mp + '/' + maxMp)) : null,
            el('div', { class: 'cb-pbar xp' }, el('i', { style: { width: Math.min(100, hs.xp / need * 100) + '%' } }), el('b', null, VN.tp('EP') + ' ' + hs.xp + '/' + need)),
            el('div', { class: 'cb-pstats' }, ...[['atk', 'Angriff'], ['def', 'Abwehr'], ['mag', 'Magie'], ['spd', 'Tempo']].map(([k, l]) => el('span', null, VN.tp(l) + ' ', el('b', null, String(cb.heroStat(h, k, hs.lvl, r.rs)))))),
            el('div', { class: 'cb-pskills' }, ...cb.learned(h, hs.lvl).map((a) => el('span', { title: VN.tr(a.id + ':desc', a.desc || '') }, (a.icon ? a.icon + ' ' : '') + cb.name(a)))))));
      }
      if (!list.children.length) list.appendChild(el('div', { style: { opacity: '0.7', textAlign: 'center' } }, VN.tp('Noch niemand in der Gruppe.')));
      const done = () => { r.overlay = null; if (back) H.pauseMenu(); else H.closeOverlay(); resolve(); };
      H.panel(VN.tp('Gruppe'), list, H.sysBtn('Zurück', done));
    });
    const menuKey = (e) => {
      const r = R();
      if (!r || r.overlay || r.blocked || !CB().on() || e.key.toLowerCase() !== 'g' || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return false;
      if (!CB().state(r.rs).party.length) return false;
      partyScreen(false);
      return true;
    };
    return { start, onKey, abort, partyScreen, menuKey, get open() { return !!screen; } };
  };
})();
