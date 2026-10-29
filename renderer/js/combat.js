// Kampf: klassisch rundenbasiert in Seitenansicht (Helden rechts, Gegner links).
// Fest in der Engine, abschaltbar. Hier liegen Daten, Regeln, KI, Simulation, Bedingungen und Aktionen.
// Editor: combat-edit.js · Spiel: player-combat.js
(function () {
  const CB = (VN.Combat = {});
  const P = () => VN.project;

  CB.STATS = [['hp', 'LP'], ['mp', 'MP'], ['atk', 'Angriff'], ['def', 'Abwehr'], ['mag', 'Magie'], ['spd', 'Tempo']];
  CB.ELEMENTS = [['', '— kein Element —'], ['fire', '🔥 Feuer'], ['ice', '❄ Eis'], ['thunder', '⚡ Blitz'], ['earth', '🪨 Erde'], ['holy', '✦ Licht'], ['dark', '☾ Dunkel']];
  CB.KINDS = [['phys', 'Körperlicher Angriff'], ['magic', 'Magischer Angriff'], ['heal', 'Heilen'], ['revive', 'Wiederbeleben'], ['buff', 'Stärken'], ['debuff', 'Schwächen']];
  CB.TARGETS = [['one', 'Ein Gegner'], ['all', 'Alle Gegner'], ['ally', 'Ein Verbündeter'], ['allies', 'Alle Verbündeten'], ['self', 'Selbst']];
  CB.FX = [['auto', 'passend zur Art'], ['slash', 'Hieb'], ['hit', 'Schlag'], ['fire', 'Feuer'], ['ice', 'Eis'], ['thunder', 'Blitz'], ['earth', 'Steine'], ['holy', 'Licht'], ['dark', 'Schatten'], ['heal', 'Heilung'], ['buff', 'Stärkung'], ['debuff', 'Schwächung'], ['none', 'keiner']];
  CB.AI = [['random', 'Zufällig'], ['smart', 'Klug (heilt, nutzt Schwächen)'], ['weakest', 'Greift die Schwächsten an'], ['brute', 'Nur Angriff']];

  CB.cfg = () => {
    const p = P();
    p.combat = Object.assign({ enabled: false, heroes: [], enemies: [], skills: [], battles: [], party: [], maxParty: 4, growth: 8, xpBase: 20, maxLevel: 50, heal: 'full', flee: 50, currency: '', music: '', winMusic: '', loseMusic: '', sounds: {}, story: true, speed: 1 }, p.combat || {});
    return p.combat;
  };
  CB.on = () => !!(P() && P().combat && P().combat.enabled);
  CB.hero = (id) => CB.cfg().heroes.find((x) => x.id === id) || null;
  CB.enemy = (id) => CB.cfg().enemies.find((x) => x.id === id) || null;
  CB.fighter = (id) => CB.hero(id) || CB.enemy(id);
  CB.skill = (id) => CB.cfg().skills.find((x) => x.id === id) || null;
  CB.battle = (id) => CB.cfg().battles.find((x) => x.id === id) || null;
  const tr = (id, t) => (VN.tr ? VN.tr(id, t || '') : t || '');
  CB.name = (x) => (x ? tr(x.id + ':name', x.name) : '?');

  CB.newFighter = (side) => ({ id: VN.uid(side === 'hero' ? 'hero' : 'foe'), name: side === 'hero' ? VN.t('Neue Heldin') : VN.t('Neuer Gegner'), icon: side === 'hero' ? '🛡️' : '👾', image: null, flip: false, scale: 100,
    hp: side === 'hero' ? 60 : 40, mp: side === 'hero' ? 20 : 10, atk: 12, def: 8, mag: 8, spd: 10, skills: [], weak: [], resist: [], ai: 'random', xp: 10, gold: 5, loot: '', levelVar: '', lvl: 1 });
  CB.newSkill = () => ({ id: VN.uid('ab'), name: VN.t('Neue Fähigkeit'), icon: '✦', desc: '', kind: 'magic', target: 'one', power: 120, mp: 4, element: '', stat: 'atk', amount: 25, turns: 3, fx: 'auto', fxImage: null, sound: null });
  CB.newBattle = () => ({ id: VN.uid('bt'), name: VN.t('Neuer Kampf'), enemies: [], bg: null, music: '', canFlee: true, win: { scene: '', actions: [] }, lose: { scene: '', mode: 'end', actions: [] }, flee: { scene: '' } });

  // ---------- Werte und Stufen ----------
  CB.xpNeed = (lvl) => Math.round((Number(CB.cfg().xpBase) || 20) * Math.pow(lvl, 1.5));
  CB.state = (rs) => {
    if (!rs.combat) rs.combat = { party: CB.cfg().party.filter((id) => CB.hero(id)).slice(0, CB.cfg().maxParty || 4), heroes: {}, won: {}, lost: {}, fled: {} };
    return rs.combat;
  };
  CB.heroState = (rs, h) => {
    const st = CB.state(rs);
    if (!st.heroes[h.id]) { st.heroes[h.id] = { lvl: Math.max(1, Number(h.lvl) || 1), xp: 0, hp: null, mp: null }; }
    return st.heroes[h.id];
  };
  // Grundwert eines Helden auf Stufe lvl, mit Skilltree-Boni
  CB.heroStat = (h, k, lvl, rs) => {
    const base = Number(h[k]) || 0;
    const g = (Number(CB.cfg().growth) || 0) / 100;
    let v = base * (1 + g * (Math.max(1, lvl) - 1));
    if (rs && VN.bonus) v = VN.bonus('combat.' + k, v, rs);
    return Math.max(k === 'hp' ? 1 : 0, Math.round(v));
  };
  CB.learned = (h, lvl) => (h.skills || []).filter((s) => (Number(s.at) || 1) <= lvl && CB.skill(s.id)).map((s) => CB.skill(s.id));

  // ---------- Kampf-Einheiten ----------
  const mkUnit = (f, side, lvl, rs, key) => {
    const isHero = side === 'hero';
    const st = (k) => (isHero ? CB.heroStat(f, k, lvl, rs) : Math.max(k === 'hp' ? 1 : 0, Number(f[k]) || 0));
    const u = { key, f, side, lvl, name: CB.name(f), maxHp: st('hp'), maxMp: st('mp'), base: { atk: st('atk'), def: st('def'), mag: st('mag'), spd: st('spd') }, buffs: [], defending: false, ko: false,
      skills: isHero ? CB.learned(f, lvl) : (f.skills || []).map((s) => CB.skill(typeof s === 'string' ? s : s.id)).filter(Boolean) };
    u.hp = u.maxHp; u.mp = u.maxMp;
    return u;
  };
  CB.stat = (u, k) => {
    let pct = 0;
    for (const b of u.buffs) if (b.stat === k) pct += b.pct;
    return Math.max(1, u.base[k] * (1 + Math.max(-75, pct) / 100));
  };

  // Neuer Kampf. opts: { level (Probe/Simulation), party: [heroIds], story, rng }
  CB.newFight = (battle, rs, opts = {}) => {
    const c = CB.cfg();
    const rng = opts.rng || Math.random;
    const units = [];
    const party = opts.party || CB.state(rs).party;
    party.filter((id) => CB.hero(id)).slice(0, c.maxParty || 4).forEach((id, i) => {
      const h = CB.hero(id);
      const hs = opts.level ? null : CB.heroState(rs, h);
      const lvl = opts.level || hs.lvl;
      const u = mkUnit(h, 'hero', lvl, rs, 'h' + i);
      if (hs && c.heal !== 'full') { if (hs.hp != null) u.hp = Math.max(1, Math.min(u.maxHp, hs.hp)); if (hs.mp != null) u.mp = Math.min(u.maxMp, hs.mp); }
      units.push(u);
    });
    const counts = {};
    (battle.enemies || []).forEach((id, i) => {
      const f = CB.enemy(id);
      if (!f) return;
      const u = mkUnit(f, 'enemy', 1, null, 'e' + i);
      counts[id] = (counts[id] || 0) + 1;
      units.push(u);
    });
    // Gleiche Gegner bekommen A, B, C
    const seen = {};
    for (const u of units) if (u.side === 'enemy' && counts[u.f.id] > 1) { seen[u.f.id] = (seen[u.f.id] || 0) + 1; u.name += ' ' + String.fromCharCode(64 + seen[u.f.id]); }
    return { battle, units, round: 0, queue: [], rng, story: !!opts.story, log: [], result: null };
  };
  CB.alive = (fi, side) => fi.units.filter((u) => !u.ko && (!side || u.side === side));
  CB.over = (fi) => (fi.result ? fi.result : !CB.alive(fi, 'enemy').length ? 'win' : !CB.alive(fi, 'hero').length ? 'lose' : null);

  // Reihenfolge einer Runde: nach Tempo (mit etwas Zufall)
  CB.nextRound = (fi) => {
    fi.round++;
    fi.queue = CB.alive(fi).map((u) => ({ u, s: CB.stat(u, 'spd') * (0.9 + fi.rng() * 0.2) })).sort((a, b) => b.s - a.s).map((x) => x.u);
    return fi.queue;
  };
  // Nächste handelnde Einheit (beginnt bei Bedarf eine neue Runde)
  CB.nextActor = (fi) => {
    while (true) {
      if (CB.over(fi)) return null;
      if (!fi.queue.length) CB.nextRound(fi);
      const u = fi.queue.shift();
      if (u && !u.ko) {
        u.defending = false;
        for (const b of u.buffs) b.turns--;
        u.buffs = u.buffs.filter((b) => b.turns > 0);
        return u;
      }
    }
  };

  const foesOf = (fi, u) => CB.alive(fi, u.side === 'hero' ? 'enemy' : 'hero');
  const friendsOf = (fi, u, withKo) => fi.units.filter((x) => x.side === u.side && (withKo || !x.ko));
  // Mögliche Ziele für eine Fähigkeit (oder Angriff = null)
  CB.targetsFor = (fi, u, ab) => {
    const t = ab ? ab.target : 'one';
    if (ab && ab.kind === 'revive') return friendsOf(fi, u, true).filter((x) => x.ko);
    if (t === 'one' || t === 'all') return foesOf(fi, u);
    if (t === 'self') return [u];
    return friendsOf(fi, u);
  };
  CB.multi = (ab) => !!ab && (ab.target === 'all' || ab.target === 'allies');
  CB.usable = (u, ab) => u.mp >= (Number(ab.mp) || 0);
  CB.itemFight = (it) => (it && it.fight && it.fight.kind ? it.fight : null);
  CB.items = (rs) => (P().items || []).filter((it) => CB.itemFight(it) && (rs.inv[it.id] || 0) > 0);

  // ---------- Wirkung ausrechnen und anwenden ----------
  // cmd: { kind: 'attack'|'skill'|'item'|'defend'|'flee', ab, item, targets: [units] }
  // Gibt Ereignisse zurück: { t: 'dmg'|'heal'|'mp'|'miss'|'buff'|'revive'|'ko'|'defend'|'flee'|'fleefail', u, n, crit, weak, resist }
  CB.act = (fi, u, cmd) => {
    const ev = [];
    const rng = fi.rng;
    const story = fi.story;
    const push = (e) => { ev.push(e); return e; };
    const hurt = (tg, raw, opts = {}) => {
      let n = raw * (0.92 + rng() * 0.16);
      const crit = !opts.noCrit && rng() < 0.06;
      if (crit) n *= 1.5;
      let weak = false, resist = false;
      if (opts.el) { if ((tg.f.weak || []).includes(opts.el)) { n *= 1.5; weak = true; } else if ((tg.f.resist || []).includes(opts.el)) { n *= 0.5; resist = true; } }
      if (tg.defending) n *= 0.5;
      if (story) n *= tg.side === 'hero' ? 0.5 : 1.25;
      n = Math.max(1, Math.round(n));
      tg.hp = Math.max(0, tg.hp - n);
      push({ t: 'dmg', u: tg, n, crit, weak, resist });
      if (!tg.hp) { tg.ko = true; tg.buffs = []; push({ t: 'ko', u: tg }); }
    };
    const phys = (tg, power) => (CB.stat(u, 'atk') * power / 100) * (50 / (50 + CB.stat(tg, 'def')));
    const magic = (tg, power) => (CB.stat(u, 'mag') * 1.2 * power / 100) * (50 / (50 + CB.stat(tg, 'mag') * 0.5));
    if (cmd.kind === 'defend') { u.defending = true; push({ t: 'defend', u }); return ev; }
    if (cmd.kind === 'flee') {
      const foes = CB.alive(fi, 'enemy');
      const mine = CB.alive(fi, 'hero');
      const avg = (l) => l.reduce((s, x) => s + CB.stat(x, 'spd'), 0) / Math.max(1, l.length);
      const ch = Math.max(10, Math.min(95, (Number(CB.cfg().flee) || 50) + (avg(mine) - avg(foes)) * 2 + (story ? 30 : 0)));
      if (rng() * 100 < ch) { fi.result = 'flee'; push({ t: 'flee', u }); } else push({ t: 'fleefail', u });
      return ev;
    }
    if (cmd.kind === 'attack') {
      for (const tg of cmd.targets) {
        if (tg.ko) continue;
        if (rng() < 0.04) { push({ t: 'miss', u: tg }); continue; }
        hurt(tg, phys(tg, 100));
      }
      return ev;
    }
    if (cmd.kind === 'item') {
      const fx = CB.itemFight(cmd.item);
      for (const tg of cmd.targets) {
        if (fx.kind === 'heal' && !tg.ko) { const n = Math.min(tg.maxHp - tg.hp, Number(fx.amount) || 0); tg.hp += n; push({ t: 'heal', u: tg, n }); }
        else if (fx.kind === 'mp' && !tg.ko) { const n = Math.min(tg.maxMp - tg.mp, Number(fx.amount) || 0); tg.mp += n; push({ t: 'mp', u: tg, n }); }
        else if (fx.kind === 'revive' && tg.ko) { tg.ko = false; tg.hp = Math.max(1, Math.round(tg.maxHp * (Number(fx.amount) || 30) / 100)); push({ t: 'revive', u: tg, n: tg.hp }); }
        else if (fx.kind === 'dmg' && !tg.ko) hurt(tg, Number(fx.amount) || 0, { noCrit: true, el: fx.element });
      }
      return ev;
    }
    // Fähigkeit
    const ab = cmd.ab;
    u.mp = Math.max(0, u.mp - (Number(ab.mp) || 0));
    const power = Number(ab.power) || 100;
    for (const tg of cmd.targets) {
      if (ab.kind === 'revive') { if (tg.ko) { tg.ko = false; tg.hp = Math.max(1, Math.round(tg.maxHp * Math.min(100, power) / 100 * 0.5)); push({ t: 'revive', u: tg, n: tg.hp }); } continue; }
      if (tg.ko) continue;
      if (ab.kind === 'phys') { if (rng() < 0.04) push({ t: 'miss', u: tg }); else hurt(tg, phys(tg, power), { el: ab.element }); }
      else if (ab.kind === 'magic') hurt(tg, magic(tg, power), { el: ab.element });
      else if (ab.kind === 'heal') { let n = Math.round(CB.stat(u, 'mag') * 1.5 * power / 100 + 5); if (story && tg.side === 'hero') n = Math.round(n * 1.3); n = Math.min(tg.maxHp - tg.hp, n); tg.hp += n; push({ t: 'heal', u: tg, n }); }
      else if (ab.kind === 'buff' || ab.kind === 'debuff') {
        const pct = (ab.kind === 'debuff' ? -1 : 1) * (Number(ab.amount) || 25);
        tg.buffs = tg.buffs.filter((b) => !(b.stat === ab.stat && Math.sign(b.pct) === Math.sign(pct)));
        tg.buffs.push({ stat: ab.stat || 'atk', pct, turns: (Number(ab.turns) || 3) + (tg === u ? 1 : 0) });
        push({ t: 'buff', u: tg, stat: ab.stat || 'atk', pct });
      }
    }
    return ev;
  };

  // ---------- KI ----------
  const pick = (fi, l) => l[Math.floor(fi.rng() * l.length)];
  CB.ai = (fi, u, mode) => {
    mode = mode || u.f.ai || 'random';
    const foes = foesOf(fi, u);
    const friends = friendsOf(fi, u);
    const usable = u.skills.filter((ab) => CB.usable(u, ab));
    const cmdFor = (ab, tg) => {
      const all = CB.targetsFor(fi, u, ab);
      return { kind: 'skill', ab, targets: CB.multi(ab) ? all : [tg && all.includes(tg) ? tg : pick(fi, all)] };
    };
    const atk = (tg) => ({ kind: 'attack', targets: [tg || pick(fi, foes)] });
    if (!foes.length) return { kind: 'defend', targets: [] };
    if (mode === 'brute') return atk();
    const weakest = foes.slice().sort((a, b) => a.hp - b.hp)[0];
    if (mode === 'weakest') {
      const dmg = usable.filter((ab) => ab.kind === 'phys' || ab.kind === 'magic');
      if (dmg.length && fi.rng() < 0.4) return cmdFor(pick(fi, dmg), weakest);
      return atk(weakest);
    }
    if (mode === 'smart') {
      const ko = friendsOf(fi, u, true).filter((x) => x.ko);
      const rev = usable.find((ab) => ab.kind === 'revive');
      if (ko.length && rev) return cmdFor(rev, ko[0]);
      const low = friends.filter((x) => x.hp < x.maxHp * 0.4).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      const heal = usable.filter((ab) => ab.kind === 'heal').sort((a, b) => (Number(b.power) || 0) - (Number(a.power) || 0))[0];
      if (low && heal) return cmdFor(heal, low);
      // Schaden schätzen: Schwächen und Mehrfachziele bevorzugen
      let best = null, bestV = 0;
      const physV = (tg, pw) => CB.stat(u, 'atk') * pw / 100 * 50 / (50 + CB.stat(tg, 'def'));
      const magV = (tg, pw) => CB.stat(u, 'mag') * 1.2 * pw / 100 * 50 / (50 + CB.stat(tg, 'mag') * 0.5);
      for (const tg of foes) { const v = physV(tg, 100) * (tg === weakest ? 1.2 : 1); if (v > bestV) { bestV = v; best = atk(tg); } }
      for (const ab of usable) {
        if (ab.kind !== 'phys' && ab.kind !== 'magic') continue;
        const tl = CB.multi(ab) ? foes : [weakest, ...foes];
        for (const tg of CB.multi(ab) ? [foes[0]] : tl) {
          let v = 0;
          for (const x of CB.multi(ab) ? foes : [tg]) { let d = ab.kind === 'phys' ? physV(x, Number(ab.power) || 100) : magV(x, Number(ab.power) || 100); if ((x.f.weak || []).includes(ab.element)) d *= 1.5; if ((x.f.resist || []).includes(ab.element)) d *= 0.5; v += Math.min(d, x.hp); }
          v *= 0.92; // MP sparen
          if (v > bestV) { bestV = v; best = cmdFor(ab, tg); }
        }
      }
      const buff = usable.find((ab) => ab.kind === 'buff' && !CB.targetsFor(fi, u, ab).some((x) => x.buffs.some((b) => b.stat === ab.stat && b.pct > 0)));
      if (buff && fi.round <= 2 && fi.rng() < 0.5) return cmdFor(buff);
      return best || atk(weakest);
    }
    // zufällig
    const opts = usable.filter((ab) => ab.kind !== 'revive' || friendsOf(fi, u, true).some((x) => x.ko)).filter((ab) => ab.kind !== 'heal' || friends.some((x) => x.hp < x.maxHp * 0.7));
    if (opts.length && fi.rng() < 0.45) return cmdFor(pick(fi, opts));
    return atk();
  };

  // ---------- Simulation (Editor) ----------
  CB.simulate = (battle, opts = {}) => {
    const n = opts.n || 100;
    const rs = VN.newRunState();
    let win = 0, rounds = 0, hpLeft = 0, flee = 0;
    for (let i = 0; i < n; i++) {
      const fi = CB.newFight(battle, rs, { level: opts.level || 1, party: opts.party, story: opts.story });
      let guard = 0;
      while (!CB.over(fi) && guard++ < 2000) {
        const u = CB.nextActor(fi);
        if (!u) break;
        CB.act(fi, u, CB.ai(fi, u, u.side === 'hero' ? 'smart' : null));
        if (fi.round > 60) break;
      }
      const r = CB.over(fi);
      if (r === 'win') { win++; const hs = fi.units.filter((x) => x.side === 'hero'); hpLeft += hs.reduce((s, x) => s + x.hp, 0) / Math.max(1, hs.reduce((s, x) => s + x.maxHp, 0)); }
      if (!r) flee++;
      rounds += fi.round;
    }
    return { n, win, rate: Math.round(win / n * 100), rounds: Math.round(rounds / n * 10) / 10, hp: win ? Math.round(hpLeft / win * 100) : 0, timeout: flee };
  };

  // ---------- Ende: Belohnung, Stufen, Zähler ----------
  CB.curId = () => { const c = CB.cfg(); return P().currencies.some((x) => x.id === c.currency) ? c.currency : (P().currencies[0] || {}).id || ''; };
  CB.finish = (fi, rs, result) => {
    const c = CB.cfg();
    const st = CB.state(rs);
    const b = fi.battle;
    const out = { xp: 0, gold: 0, ups: [], gains: [] };
    out.gains.pending = [];
    const key = result === 'win' ? 'won' : result === 'lose' ? 'lost' : 'fled';
    st[key][b.id] = (st[key][b.id] || 0) + 1;
    // Zustand der Helden merken
    for (const u of fi.units) if (u.side === 'hero') { const hs = CB.heroState(rs, u.f); hs.hp = u.ko ? (result === 'win' ? 1 : u.maxHp) : u.hp; hs.mp = u.mp; if (result === 'lose') hs.hp = u.maxHp; }
    if (result !== 'win') return out;
    const foes = fi.units.filter((u) => u.side === 'enemy');
    out.xp = Math.round(VN.bonus ? VN.bonus('combat.xp', foes.reduce((s, u) => s + (Number(u.f.xp) || 0), 0), rs) : foes.reduce((s, u) => s + (Number(u.f.xp) || 0), 0));
    out.gold = foes.reduce((s, u) => s + (Number(u.f.gold) || 0), 0);
    const cur = CB.curId();
    if (out.gold && cur) { VN.addMoney(rs, cur, out.gold); out.gains.push({ kind: 'money', id: cur, count: out.gold }); }
    // Beute aus Loot-Tabellen der Gegner
    foes.forEach((u, i) => {
      const t = u.f.loot && P().lootTables.find((x) => x.id === u.f.loot);
      if (!t) return;
      const got = VN.rollLoot(t, 'fight:' + b.id + ':' + i + ':' + (st.won[b.id] || 0), rs);
      for (const g of got) { if (g.kind === 'money') VN.addMoney(rs, g.id, g.count); else VN.giveItem(rs, g.id, g.count); out.gains.push(g); }
    });
    // Erfahrung: alle in der Gruppe, Bewusstlose bekommen die Hälfte
    for (const u of fi.units) {
      if (u.side !== 'hero') continue;
      const hs = CB.heroState(rs, u.f);
      hs.xp += u.ko ? Math.floor(out.xp / 2) : out.xp;
      const before = hs.lvl;
      while (hs.lvl < (Number(c.maxLevel) || 50) && hs.xp >= CB.xpNeed(hs.lvl)) { hs.xp -= CB.xpNeed(hs.lvl); hs.lvl++; }
      if (hs.lvl > before) {
        const learned = (u.f.skills || []).filter((s) => (Number(s.at) || 1) > before && (Number(s.at) || 1) <= hs.lvl).map((s) => CB.skill(s.id)).filter(Boolean);
        out.ups.push({ hero: u.f, lvl: hs.lvl, learned });
        if (u.f.levelVar) rs.vars[u.f.levelVar] = hs.lvl;
        if (c.heal !== 'full') { hs.hp = CB.heroStat(u.f, 'hp', hs.lvl, rs); hs.mp = CB.heroStat(u.f, 'mp', hs.lvl, rs); }
      }
    }
    return out;
  };
  // Schnappschuss zum Wiederholen nach einer Niederlage
  CB.snap = (rs) => JSON.parse(JSON.stringify(rs));
  CB.restore = (rs, snap) => { for (const k of Object.keys(rs)) delete rs[k]; Object.assign(rs, JSON.parse(JSON.stringify(snap))); };

  // ---------- Skilltree-Wirkungen für den Kampf ----------
  if (VN.Skills) {
    VN.Skills.CATS.splice(VN.Skills.CATS.length - 1, 0, { key: 'combat', label: 'Kampf', icon: '⚔', on: CB.on });
    const statLab = (k) => (CB.STATS.find((x) => x[0] === k) || [k, k])[1];
    VN.Skills.EFFECTS.combatStat = { cat: 'combat', label: 'Kampfwert der Gruppe erhöhen', params: [['stat', 'Wert', 'select', CB.STATS], ['pct', '+ %', 'number', 10]], key: (e) => 'combat.' + (e.stat || 'hp'), mode: 'pct', value: (e) => Number(e.pct) || 0, text: (e, l) => '+' + (Number(e.pct) || 0) * l + ' % ' + statLab(e.stat || 'hp') };
    VN.Skills.EFFECTS.combatXp = { cat: 'combat', label: 'Mehr Erfahrung aus Kämpfen', params: [['pct', '+ %', 'number', 10]], key: () => 'combat.xp', mode: 'pct', value: (e) => Number(e.pct) || 0, text: (e, l) => '+' + (Number(e.pct) || 0) * l + ' % Erfahrung' };
  }

  // ---------- Bedingungen und Aktionen ----------
  const btOpts = () => [['', '— Kampf —'], ...CB.cfg().battles.map((b) => [b.id, b.name])];
  const heroOpts = () => [['', '— Held —'], ...CB.cfg().heroes.map((h) => [h.id, h.name])];
  const btName = (id) => { const b = CB.battle(id); return b ? b.name : '?'; };
  const heroName = (id) => { const h = CB.hero(id); return h ? h.name : '?'; };
  VN.registerCond('battleWon', {
    label: '⚔ Kampf gewonnen', on: CB.on, make: () => ({ battle: '', value: true }),
    check: (c, rs) => !!(CB.state(rs).won[c.battle]) === (c.value !== false),
    text: (c) => '⚔ ' + btName(c.battle) + (c.value === false ? ' nicht gewonnen' : ' gewonnen'),
    problem: (c) => (CB.battle(c.battle) ? null : 'Kampf fehlt'),
    row: (row, c, sel) => { row.appendChild(sel(c.battle || '', btOpts(), (v) => VN.mutate(() => { c.battle = v; }))); row.appendChild(sel(c.value === false ? 'n' : 'y', [['y', 'gewonnen'], ['n', 'nicht gewonnen']], (v) => VN.mutate(() => { c.value = v === 'y'; }))); }
  });
  VN.registerCond('battleLost', {
    label: '⚔ Kampf verloren oder geflohen', on: CB.on, make: () => ({ battle: '' }),
    check: (c, rs) => !!(CB.state(rs).lost[c.battle] || CB.state(rs).fled[c.battle]),
    text: (c) => '⚔ ' + btName(c.battle) + ' verloren/geflohen',
    problem: (c) => (CB.battle(c.battle) ? null : 'Kampf fehlt'),
    row: (row, c, sel) => row.appendChild(sel(c.battle || '', btOpts(), (v) => VN.mutate(() => { c.battle = v; })))
  });
  VN.registerCond('inParty', {
    label: '⚔ Held in der Gruppe', on: CB.on, make: () => ({ hero: '', value: true }),
    check: (c, rs) => CB.state(rs).party.includes(c.hero) === (c.value !== false),
    text: (c) => '⚔ ' + heroName(c.hero) + (c.value === false ? ' nicht in der Gruppe' : ' in der Gruppe'),
    problem: (c) => (CB.hero(c.hero) ? null : 'Held fehlt'),
    row: (row, c, sel) => { row.appendChild(sel(c.hero || '', heroOpts(), (v) => VN.mutate(() => { c.hero = v; }))); row.appendChild(sel(c.value === false ? 'n' : 'y', [['y', 'dabei'], ['n', 'nicht dabei']], (v) => VN.mutate(() => { c.value = v === 'y'; }))); }
  });
  VN.registerCond('heroLevel', {
    label: '⚔ Stufe eines Helden', on: CB.on, make: () => ({ hero: '', level: 2 }),
    check: (c, rs) => { const h = CB.hero(c.hero); return !!h && CB.heroState(rs, h).lvl >= (Number(c.level) || 1); },
    text: (c) => '⚔ ' + heroName(c.hero) + ' ab Stufe ' + (c.level || 1),
    problem: (c) => (CB.hero(c.hero) ? null : 'Held fehlt'),
    row: (row, c, sel, inp) => { row.appendChild(sel(c.hero || '', heroOpts(), (v) => VN.mutate(() => { c.hero = v; }))); row.appendChild(inp(c.level || 1, (v) => VN.mutate(() => { c.level = Number(v) || 1; }), 'number')); }
  });

  VN.registerAction('battle', {
    label: '⚔ Kampf starten', on: CB.on, make: () => ({ battle: '' }),
    apply: (a, rs, gains) => { if (window.Player && Player.running && Player.battle && gains && CB.battle(a.battle)) gains.pending.push(Player.battle(a.battle)); },
    text: (a) => '⚔ Kampf: ' + btName(a.battle),
    problem: (a) => { const b = CB.battle(a.battle); return !b ? 'Kampf fehlt' : !(b.enemies || []).some((id) => CB.enemy(id)) ? 'Kampf ohne Gegner' : null; },
    row: (row, a, sel) => row.appendChild(sel(a.battle || '', btOpts(), (v) => VN.mutate(() => { a.battle = v; })))
  });
  VN.registerAction('partyAdd', {
    label: '⚔ Held in die Gruppe', on: CB.on, make: () => ({ hero: '' }),
    apply: (a, rs, gains) => { const st = CB.state(rs); const h = CB.hero(a.hero); if (h && !st.party.includes(h.id)) { st.party.push(h.id); if (st.party.length > (CB.cfg().maxParty || 4)) st.party.shift(); CB.heroState(rs, h); if (gains) gains.push({ kind: 'text', text: '⚔ ' + CB.name(h) + ' ' + VN.tp('ist dabei') }); } },
    text: (a) => '⚔ ' + heroName(a.hero) + ' kommt in die Gruppe',
    problem: (a) => (CB.hero(a.hero) ? null : 'Held fehlt'),
    row: (row, a, sel) => row.appendChild(sel(a.hero || '', heroOpts(), (v) => VN.mutate(() => { a.hero = v; })))
  });
  VN.registerAction('partyRemove', {
    label: '⚔ Held verlässt die Gruppe', on: CB.on, make: () => ({ hero: '' }),
    apply: (a, rs) => { const st = CB.state(rs); st.party = st.party.filter((x) => x !== a.hero); },
    text: (a) => '⚔ ' + heroName(a.hero) + ' verlässt die Gruppe',
    problem: (a) => (CB.hero(a.hero) ? null : 'Held fehlt'),
    row: (row, a, sel) => row.appendChild(sel(a.hero || '', heroOpts(), (v) => VN.mutate(() => { a.hero = v; })))
  });
  VN.registerAction('partyHeal', {
    label: '⚔ Gruppe heilen', on: CB.on, make: () => ({}),
    apply: (a, rs, gains) => { const st = CB.state(rs); for (const id of Object.keys(st.heroes)) { st.heroes[id].hp = null; st.heroes[id].mp = null; } if (gains) gains.push({ kind: 'text', text: '✚ ' + VN.tp('Gruppe geheilt') }); },
    text: () => '⚔ Gruppe heilen',
    row: () => {}
  });
  VN.registerAction('heroXp', {
    label: '⚔ Erfahrung geben', on: CB.on, make: () => ({ hero: '', amount: 20 }),
    apply: (a, rs, gains) => {
      const list = a.hero ? [CB.hero(a.hero)].filter(Boolean) : CB.state(rs).party.map(CB.hero).filter(Boolean);
      for (const h of list) {
        const hs = CB.heroState(rs, h); hs.xp += Number(a.amount) || 0;
        const before = hs.lvl;
        while (hs.lvl < (Number(CB.cfg().maxLevel) || 50) && hs.xp >= CB.xpNeed(hs.lvl)) { hs.xp -= CB.xpNeed(hs.lvl); hs.lvl++; }
        if (hs.lvl > before) { if (h.levelVar) rs.vars[h.levelVar] = hs.lvl; if (gains) gains.push({ kind: 'text', text: CB.name(h) + ' · ' + VN.tp('Stufe') + ' ' + hs.lvl + '!' }); }
      }
    },
    text: (a) => '⚔ +' + (a.amount || 0) + ' EP ' + (a.hero ? heroName(a.hero) : 'Gruppe'),
    row: (row, a, sel, inp) => { row.appendChild(sel(a.hero || '', [['', 'ganze Gruppe'], ...CB.cfg().heroes.map((h) => [h.id, h.name])], (v) => VN.mutate(() => { a.hero = v; }))); row.appendChild(inp(a.amount != null ? a.amount : 20, (v) => VN.mutate(() => { a.amount = Number(v) || 0; }), 'number')); }
  });

  // ---------- Pfade: Sieg / Niederlage / Flucht als Verbindungen ----------
  const actionsIn = (s) => {
    const out = [];
    if (s.type === 'story') {
      for (const c of s.tracks.dialog || []) out.push(...(c.actions || []));
      for (const c of s.tracks.choice || []) for (const o of c.options || []) out.push(...(o.actions || []));
    } else for (const o of s.objects || []) out.push(...(o.actions || []), ...(o.useActions || []));
    return out;
  };
  CB.actionsIn = actionsIn;
  const baseEdges = VN.edgesOf;
  VN.edgesOf = (s) => {
    const out = baseEdges(s);
    if (!CB.on()) return out;
    for (const a of actionsIn(s)) {
      if (a.type !== 'battle') continue;
      const b = CB.battle(a.battle);
      if (!b) continue;
      if (b.win && VN.scene(b.win.scene)) out.push({ to: b.win.scene, label: '⚔ ' + VN.t('Sieg'), kind: 'battle' });
      if (b.lose && VN.scene(b.lose.scene)) out.push({ to: b.lose.scene, label: '⚔ ' + VN.t('Niederlage'), kind: 'battle' });
      if (b.flee && VN.scene(b.flee.scene)) out.push({ to: b.flee.scene, label: '⚔ ' + VN.t('Flucht'), kind: 'battle' });
    }
    return out;
  };

  // ---------- Prüfung ----------
  CB.fighterProblems = (f, side) => {
    const out = [];
    if (!String(f.name || '').trim()) out.push('Name fehlt');
    if (!(Number(f.hp) > 0)) out.push('LP müssen größer als 0 sein');
    for (const s of f.skills || []) if (!CB.skill(typeof s === 'string' ? s : s.id)) out.push('Fähigkeit fehlt');
    if (side === 'enemy' && f.loot && !P().lootTables.some((t) => t.id === f.loot)) out.push('Loot-Tabelle fehlt');
    if (f.image && !VN.asset(f.image)) out.push('Bild fehlt');
    return out;
  };
  CB.battleProblems = (b) => {
    const out = [];
    if (!(b.enemies || []).length) out.push('Keine Gegner');
    for (const id of b.enemies || []) if (!CB.enemy(id)) out.push('Gegner fehlt');
    for (const k of ['win', 'lose', 'flee']) if (b[k] && b[k].scene && !VN.scene(b[k].scene)) out.push('Szene für ' + ({ win: 'Sieg', lose: 'Niederlage', flee: 'Flucht' })[k] + ' fehlt');
    return out;
  };
  CB.issues = () => {
    const out = [];
    if (!CB.on()) return out;
    const c = CB.cfg();
    if (!c.heroes.length) out.push({ text: 'Kampf: noch keine Helden angelegt' });
    else if (!c.party.some((id) => CB.hero(id))) out.push({ text: 'Kampf: Startgruppe ist leer' });
    for (const h of c.heroes) for (const pr of CB.fighterProblems(h, 'hero')) out.push({ text: VN.t('Held') + ' „' + h.name + '“: ' + VN.t(pr) });
    for (const e of c.enemies) for (const pr of CB.fighterProblems(e, 'enemy')) out.push({ text: (VN.I18n && VN.I18n.lang === 'en' ? 'Enemy' : 'Gegner') + ' „' + e.name + '“: ' + VN.t(pr) });
    for (const b of c.battles) for (const pr of CB.battleProblems(b)) out.push({ text: (VN.I18n && VN.I18n.lang === 'en' ? 'Battle' : 'Kampf') + ' „' + b.name + '“: ' + VN.t(pr) });
    return out;
  };

  // ---------- Texte fürs Transkript ----------
  const baseTexts = VN.collectTexts;
  VN.collectTexts = () => {
    const out = baseTexts();
    if (!CB.on()) return out;
    const c = CB.cfg();
    for (const [list, who] of [[c.heroes, 'Held'], [c.enemies, 'Gegner'], [c.skills, 'Fähigkeit'], [c.battles, 'Kampf']]) for (const x of list) {
      out.push({ id: x.id + ':name', area: 'Kampf', where: who, who, text: x.name || '', set: (v) => { x.name = v; } });
      if (x.desc) out.push({ id: x.id + ':desc', area: 'Kampf', where: x.name, who: 'Beschreibung', text: x.desc, set: (v) => { x.desc = v; } });
    }
    return out;
  };

  // ---------- Fehlende Felder ergänzen ----------
  const baseMig = VN.migrate;
  VN.migrate = (p) => {
    const r = baseMig(p);
    if (p.combat) {
      const c = p.combat;
      for (const k of ['heroes', 'enemies', 'skills', 'battles', 'party']) c[k] = Array.isArray(c[k]) ? c[k] : [];
      for (const f of [...c.heroes, ...c.enemies]) { f.skills = (f.skills || []).map((s) => (typeof s === 'string' ? { id: s, at: 1 } : s)); f.weak = f.weak || []; f.resist = f.resist || []; }
      for (const b of c.battles) { b.enemies = b.enemies || []; b.win = b.win || { scene: '', actions: [] }; b.win.actions = b.win.actions || []; b.lose = b.lose || { scene: '', mode: 'end', actions: [] }; b.lose.actions = b.lose.actions || []; b.flee = b.flee || { scene: '' }; }
      c.sounds = c.sounds || {};
    }
    return r;
  };

  // ---------- Startbeispiel für leere Projekte ----------
  CB.example = () => VN.mutate(() => {
    const c = CB.cfg();
    const sk = (name, icon, kind, target, power, mp, extra) => { const s = Object.assign(CB.newSkill(), { name: VN.t(name), icon, kind, target, power, mp }, extra || {}); c.skills.push(s); return s.id; };
    const fire = sk('Feuer', '🔥', 'magic', 'one', 140, 5, { element: 'fire', fx: 'fire' });
    const ice = sk('Eissturm', '❄', 'magic', 'all', 90, 9, { element: 'ice', fx: 'ice' });
    const heal = sk('Heilen', '✚', 'heal', 'ally', 120, 4, { fx: 'heal' });
    const cut = sk('Doppelhieb', '⚔', 'phys', 'one', 170, 4, { fx: 'slash' });
    const guard = sk('Kampfschrei', '📯', 'buff', 'allies', 0, 6, { stat: 'atk', amount: 25, turns: 3, fx: 'buff' });
    const bite = sk('Giftbiss', '🦷', 'phys', 'one', 130, 3, { fx: 'dark', element: 'dark' });
    const h1 = Object.assign(CB.newFighter('hero'), { name: VN.t('Kriegerin'), icon: '🛡️', hp: 80, mp: 12, atk: 15, def: 11, mag: 4, spd: 9, skills: [{ id: cut, at: 1 }, { id: guard, at: 3 }] });
    const h2 = Object.assign(CB.newFighter('hero'), { name: VN.t('Magier'), icon: '🔮', hp: 50, mp: 30, atk: 7, def: 6, mag: 16, spd: 11, skills: [{ id: fire, at: 1 }, { id: ice, at: 2 }] });
    const h3 = Object.assign(CB.newFighter('hero'), { name: VN.t('Heilerin'), icon: '🌿', hp: 58, mp: 26, atk: 8, def: 8, mag: 13, spd: 10, skills: [{ id: heal, at: 1 }] });
    c.heroes.push(h1, h2, h3);
    c.party = [h1.id, h2.id, h3.id];
    const e1 = Object.assign(CB.newFighter('enemy'), { name: VN.t('Schleim'), icon: '🟢', hp: 34, mp: 0, atk: 10, def: 5, mag: 3, spd: 6, weak: ['fire'], xp: 8, gold: 4 });
    const e2 = Object.assign(CB.newFighter('enemy'), { name: VN.t('Riesenratte'), icon: '🐀', hp: 26, mp: 6, atk: 12, def: 4, mag: 2, spd: 13, skills: [{ id: bite, at: 1 }], ai: 'weakest', xp: 6, gold: 3 });
    const quake = sk('Erdbeben', '🪨', 'magic', 'all', 85, 8, { element: 'earth', fx: 'earth' });
    const e3 = Object.assign(CB.newFighter('enemy'), { name: VN.t('Kellerwächter'), icon: '🗿', scale: 150, hp: 420, mp: 40, atk: 22, def: 16, mag: 12, spd: 8, skills: [{ id: cut, at: 1 }, { id: quake, at: 1 }], weak: ['thunder'], resist: ['ice'], ai: 'smart', xp: 60, gold: 40 });
    c.enemies.push(e1, e2, e3);
    c.battles.push(Object.assign(CB.newBattle(), { name: VN.t('Keller-Ungeziefer'), enemies: [e1.id, e2.id, e1.id] }));
    c.battles.push(Object.assign(CB.newBattle(), { name: VN.t('Der Kellerwächter'), enemies: [e3.id], canFlee: false }));
  });
})();
