// Mitgeliefertes Plugin: Spielhalle (0.9.17)
// Dart, Billard und Spielautomat. Dart und Billard gegen Computer-Gegner, deren Können du einstellst
// (Spielsysteme → Spielhalle). Alles lässt sich mit eigenen Bildern gestalten.
// Jedes Spiel liefert ein Ergebnis { score: 0…1, ok } wie die anderen Minispiele (Sieg-/Niederlage-Szene, Variable).
// Du darfst die Datei frei ändern.
(function () {
  const ID = 'spielhalle';
  const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 8);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const num = (v, d) => (v === '' || v == null || !Number.isFinite(Number(v)) ? d : Number(v));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const T = (s) => (VN.t ? VN.t(s) : s);
  const TF = (s, o) => (VN.tf ? VN.tf(s, o) : s.replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m)));

  // ---------- Computer-Gegner ----------
  // genau = Treffsicherheit / Zielgenauigkeit, kraft = Gefühl für die Stoßkraft (Billard),
  // taktik = wie klug das Ziel gewählt wird, tempo = Bedenkzeit in Sekunden
  const PRESETS = {
    anfaenger: { label: 'Anfänger', genau: 30, kraft: 35, taktik: 20, tempo: 1.2 },
    profi: { label: 'Kneipenprofi', genau: 62, kraft: 60, taktik: 60, tempo: 1.6 },
    meister: { label: 'Meister', genau: 90, kraft: 88, taktik: 95, tempo: 2 }
  };
  const preset = (k) => { const p = Object.assign({}, PRESETS[k] || PRESETS.profi); delete p.label; return p; };
  const newGegner = (name, k) => Object.assign({ id: uid('sg'), name, bild: '', spiel: 'beide', ziel: 'auto', sieg: '', niederlage: '' }, preset(k));

  // ---------- Spielautomaten ----------
  const newAutomat = () => ({
    id: uid('sa'), name: T('Glücksautomat'), walzen: 3, reihen: 3, linien: 'drei', einsatz: 1, waehrung: '', guthaben: 50, joker: '',
    symbole: [
      { id: 'kirsche', name: T('Kirsche'), emoji: '🍒', bild: '', gewicht: 8 },
      { id: 'zitrone', name: T('Zitrone'), emoji: '🍋', bild: '', gewicht: 7 },
      { id: 'glocke', name: T('Glocke'), emoji: '🔔', bild: '', gewicht: 5 },
      { id: 'stern', name: T('Stern'), emoji: '⭐', bild: '', gewicht: 4 },
      { id: 'diamant', name: T('Diamant'), emoji: '💎', bild: '', gewicht: 3 },
      { id: 'sieben', name: T('Sieben'), emoji: '7️⃣', bild: '', gewicht: 2 }
    ],
    gewinne: [
      { symbol: 'kirsche', anzahl: 2, faktor: 2 }, { symbol: 'kirsche', anzahl: 3, faktor: 8 }, { symbol: 'zitrone', anzahl: 3, faktor: 15 },
      { symbol: 'glocke', anzahl: 3, faktor: 25 }, { symbol: 'stern', anzahl: 3, faktor: 50 }, { symbol: 'diamant', anzahl: 3, faktor: 100 }, { symbol: 'sieben', anzahl: 3, faktor: 200 }
    ],
    design: { titel: '', farbe: '#7a1f2b', akzent: '#e8c86a', hintergrund: '', gehaeuse: '', fx: 14, fy: 30, fw: 72, fh: 40, hebel: '' }
  });

  const data = () => {
    const p = VN.project;
    p.pluginData = p.pluginData || {};
    const d = p.pluginData[ID] = p.pluginData[ID] || {};
    if (!d.init) {
      d.init = 1;
      d.gegner = [newGegner(T('Tavernen-Gast'), 'anfaenger'), newGegner(T('Kneipen-Profi'), 'profi'), newGegner(T('Meisterin Vala'), 'meister')];
      d.automaten = [newAutomat()];
    }
    d.gegner = d.gegner || [];
    d.automaten = d.automaten || [];
    return d;
  };
  const foeById = (id) => (id ? data().gegner.find((g) => g.id === id) || null : null);

  // ---------- Gemeinsamer Rahmen ----------
  const store = (ctx, varId, res) => {
    if (!varId) return;
    const v = ctx.project.vars.find((x) => x.id === varId);
    ctx.vars.set(varId, v && v.type === 'flag' ? res.ok : Math.round(res.score * 100));
  };
  const resultParam = { key: 'ergebnis', label: 'Ergebnis in', type: 'var', default: '' };
  const pic = (ctx, game, k, params) => (ctx.design ? ctx.design(ID + '.' + game).image(k, params[k]) : (params[k] ? ctx.asset(params[k]) : ''));
  const loadImg = (url) => { if (!url) return null; const i = new Image(); i.src = url; return i; };
  const ok = (im) => !!(im && im.complete && im.naturalWidth);

  const frame = (ctx, title, width, game) => {
    ensureCss();
    const el = ctx.el;
    const o = ctx.overlay({ width: width || '84%' });
    o.el.classList.add('mg-panel', 'sh-panel');
    if (ctx.design && game) ctx.design(ID + '.' + game).apply(o.el);
    const head = el('div', { class: 'mg-title' }, title);
    const info = el('div', { class: 'mg-info sh-info' });
    const area = el('div', { class: 'mg-area sh-area' });
    o.el.append(head, info, area);
    const bubble = el('div', { class: 'sh-bubble' });
    area.appendChild(bubble);
    let bt = 0;
    const say = (text, ms) => { if (!text) return; bubble.textContent = text; bubble.classList.add('show'); clearTimeout(bt); bt = setTimeout(() => bubble.classList.remove('show'), ms || 2200); };
    let closed = false;
    const finish = (res, text, resolve, varId, extra) => {
      if (closed) return;
      closed = true;
      head.textContent = text;
      head.className = 'mg-title ' + (res.ok ? 'win' : 'lose');
      store(ctx, varId, res);
      setTimeout(() => { o.close(); resolve(res); }, extra || 2000);
    };
    return { o, el, head, info, area, say, finish, closed: () => closed };
  };

  const canvasIn = (area) => {
    const cv = document.createElement('canvas');
    cv.className = 'sh-cv';
    area.insertBefore(cv, area.firstChild);
    const g = cv.getContext('2d');
    const fit = () => {
      const r = area.getBoundingClientRect();
      const lw = area.clientWidth || r.width, lh = area.clientHeight || r.height;
      const dpr = (window.devicePixelRatio || 1) * Math.max(1, r.width / Math.max(1, lw));
      const w = Math.max(10, lw), h = Math.max(10, lh);
      const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { W: w, H: h };
    };
    // Mausposition in Fläche-Pixeln (auch wenn das Spiel skaliert dargestellt wird)
    const pos = (e) => { const r = cv.getBoundingClientRect(); const k = (area.clientWidth || r.width) / Math.max(1, r.width); return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; };
    return { cv, g, fit, pos };
  };

  // Spieler-Zeile mit Bild des Gegners
  const avatar = (ctx, foe) => (foe && foe.bild ? ctx.el('span', { class: 'sh-ava', style: { backgroundImage: `url("${ctx.asset(foe.bild)}")` } }) : ctx.el('span', { class: 'sh-ava none' }, foe ? '🤖' : '🙂'));
  const foeName = (foe) => (foe ? VN.tr ? VN.tr(foe.id + ':name', foe.name) : foe.name : '');
  const foeLine = (foe, key) => (foe && foe[key] ? (VN.tr ? VN.tr(foe.id + ':' + key, foe[key]) : foe[key]) : '');

  // =====================================================================
  // DART
  // =====================================================================
  // Maße einer echten Steeldart-Scheibe in mm (Mittelpunkt 0/0, y nach unten)
  const D_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  const DR = { bull: 6.35, outer: 15.9, tIn: 99, tOut: 107, dIn: 162, dOut: 170, rim: 205 };
  const dartScore = (x, y) => {
    const r = Math.hypot(x, y);
    if (r <= DR.bull) return { pts: 50, mult: 2, label: 'Bull', dbl: true };
    if (r <= DR.outer) return { pts: 25, mult: 1, label: '25', dbl: false };
    if (r > DR.dOut) return { pts: 0, mult: 0, label: '—', dbl: false };
    const a = (Math.atan2(x, -y) * 180 / Math.PI + 360 + 9) % 360;
    const n = D_ORDER[Math.floor(a / 18) % 20];
    if (r >= DR.dIn) return { pts: n * 2, mult: 2, label: 'D' + n, dbl: true };
    if (r >= DR.tIn && r <= DR.tOut) return { pts: n * 3, mult: 3, label: 'T' + n, dbl: false };
    return { pts: n, mult: 1, label: String(n), dbl: false };
  };
  // Zielpunkt zu einem Feld: T20, D16, S5, BULL, 25, MITTE
  const dartTarget = (code) => {
    if (code === 'BULL' || code === 'MITTE') return [0, 0];
    if (code === '25') return [0, -11];
    const k = code[0], n = Number(code.slice(1)), i = D_ORDER.indexOf(n);
    if (i < 0) return [0, 0];
    const a = i * 18 * Math.PI / 180, r = k === 'T' ? 103 : k === 'D' ? 166 : 132;
    return [Math.sin(a) * r, -Math.cos(a) * r];
  };
  // Worauf wirft der Computer? Klügere Gegner rechnen sich den Rest aus.
  const aiDartAim = (foe, rem, mode, dblOut) => {
    const tk = num(foe.taktik, 50);
    const pref = foe.ziel && foe.ziel !== 'auto' ? foe.ziel : null;
    if (mode === 'punkte') return pref || (tk < 35 ? 'MITTE' : tk < 65 && Math.random() < 0.4 ? 'BULL' : 'T20');
    if (dblOut) {
      if (rem === 50 && tk >= 40) return 'BULL';
      if (rem <= 40 && rem % 2 === 0) return 'D' + rem / 2;
      if (tk >= 40 && rem <= 60) for (let s = 20; s >= 1; s--) { const r2 = rem - s; if (r2 > 1 && r2 <= 40 && r2 % 2 === 0) return 'S' + s; }
      if (tk >= 70 && rem <= 100) for (const t of [20, 19, 18, 17, 16]) { const r2 = rem - 3 * t; if (r2 > 1 && r2 <= 40 && r2 % 2 === 0) return 'T' + t; }
      if (rem <= 41) return 'S1';
    } else {
      if (rem <= 20) return 'S' + rem;
      if (tk >= 40) {
        if (rem === 50) return 'BULL';
        if (rem === 25) return '25';
        if (rem <= 40 && rem % 2 === 0) return 'D' + rem / 2;
        if (rem <= 60 && rem % 3 === 0) return 'T' + rem / 3;
        if (rem <= 60) return 'S20';
      } else if (rem <= 60) return 'S' + Math.min(20, rem);
    }
    if (rem < 60) return 'S20';
    return pref || (tk < 30 ? 'MITTE' : 'T20');
  };

  // Scheibe zeichnen (eingebaut)
  const drawBoard = (g, cx, cy, s) => {
    const ann = (r0, r1, a0, a1, col) => { g.beginPath(); g.arc(cx, cy, r1 * s, a0, a1); g.arc(cx, cy, r0 * s, a1, a0, true); g.closePath(); g.fillStyle = col; g.fill(); };
    g.beginPath(); g.arc(cx, cy, DR.rim * s, 0, Math.PI * 2); g.fillStyle = '#141414'; g.fill();
    for (let i = 0; i < 20; i++) {
      const a0 = (i * 18 - 9 - 90) * Math.PI / 180, a1 = a0 + Math.PI / 10;
      const single = i % 2 ? '#efe3c4' : '#1b1b1b', ring = i % 2 ? '#2f8f48' : '#d23a2e';
      ann(DR.outer, DR.tIn, a0, a1, single); ann(DR.tIn, DR.tOut, a0, a1, ring); ann(DR.tOut, DR.dIn, a0, a1, single); ann(DR.dIn, DR.dOut, a0, a1, ring);
    }
    g.beginPath(); g.arc(cx, cy, DR.outer * s, 0, Math.PI * 2); g.fillStyle = '#2f8f48'; g.fill();
    g.beginPath(); g.arc(cx, cy, DR.bull * s, 0, Math.PI * 2); g.fillStyle = '#d23a2e'; g.fill();
    g.strokeStyle = 'rgba(200,200,200,0.55)'; g.lineWidth = Math.max(0.6, s * 0.8);
    for (const r of [DR.outer, DR.tIn, DR.tOut, DR.dIn, DR.dOut]) { g.beginPath(); g.arc(cx, cy, r * s, 0, Math.PI * 2); g.stroke(); }
    for (let i = 0; i < 20; i++) { const a = (i * 18 - 9 - 90) * Math.PI / 180; g.beginPath(); g.moveTo(cx + Math.cos(a) * DR.outer * s, cy + Math.sin(a) * DR.outer * s); g.lineTo(cx + Math.cos(a) * DR.dOut * s, cy + Math.sin(a) * DR.dOut * s); g.stroke(); }
    g.fillStyle = '#f4f0e6'; g.font = `700 ${Math.round(17 * s)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 20; i++) { const a = (i * 18 - 90) * Math.PI / 180; g.fillText(String(D_ORDER[i]), cx + Math.cos(a) * 188 * s, cy + Math.sin(a) * 188 * s); }
  };
  const drawDart = (g, x, y, s, col, img, k) => {
    k = k || 1;
    if (ok(img)) {
      const h = 80 * s * k, w = h * img.naturalWidth / img.naturalHeight;
      g.drawImage(img, x, y - h, w, h); // Spitze unten links
      return;
    }
    const L = 62 * s * k;
    g.save(); g.translate(x, y); g.rotate(-0.75);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(2 * s, 2 * s, 3 * s, 2 * s, 0, 0, 6.3); g.fill();
    g.strokeStyle = '#cfd6dc'; g.lineWidth = 2.2 * s * k; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -L * 0.55); g.stroke();
    g.strokeStyle = '#3a3f46'; g.lineWidth = 4.2 * s * k; g.beginPath(); g.moveTo(0, -L * 0.22); g.lineTo(0, -L * 0.6); g.stroke();
    g.fillStyle = col; g.beginPath(); g.moveTo(0, -L * 0.62); g.lineTo(-9 * s * k, -L); g.lineTo(0, -L * 0.9); g.lineTo(9 * s * k, -L); g.closePath(); g.fill();
    g.restore();
  };

  const runDart = (params, ctx) => new Promise((resolve) => {
    const foe = foeById(params.gegner);
    const F = frame(ctx, params.titel || T('Dart'), '84%', 'dart');
    F.area.classList.add('sh-dart');
    const { g, fit, cv, pos } = canvasIn(F.area);
    const mode = ['501', '301', 'punkte'].includes(String(params.modus)) ? String(params.modus) : '301';
    const x01 = mode !== 'punkte' ? Number(mode) : 0;
    const dblOut = params.doppelAus === 'ja';
    const rounds = Math.max(1, Math.round(num(params.runden, 8)));
    const goal = Math.max(1, num(params.ziel, 300));
    const B = (k, base) => (ctx.bonus ? ctx.bonus(k, base) : base);
    const helper = params.hilfe && ctx.items && ctx.items.count(params.hilfe) > 0;
    const speed0 = { ruhig: 0.45, mittel: 0.75, wild: 1.1, extrem: 1.55 }[params.wackeln] || 0.75;
    const speed = Math.max(0.12, B('spielhalle.dart.tempo', speed0) * (helper ? 0.7 : 1));
    const imBoard = loadImg(pic(ctx, 'dart', 'bildBoard', params)), imDart = loadImg(pic(ctx, 'dart', 'bildPfeil', params));
    const imCross = loadImg(pic(ctx, 'dart', 'bildKreuz', params)), imBg = loadImg(pic(ctx, 'dart', 'bildHintergrund', params));
    const boardPct = clamp(num(params.boardGroesse, 80), 20, 100) / 100;
    const P = [{ name: T('Du'), rem: x01, total: 0, last: [], foe: null, col: '#e8a43a' }];
    if (foe) P.push({ name: foeName(foe), rem: x01, total: 0, last: [], foe, col: '#6cc4ff' });
    // Anzeigetafel
    const board = F.el('div', { class: 'sh-score' });
    F.area.appendChild(board);
    const rows = P.map((pl) => { const r = F.el('div', { class: 'sh-srow' }, avatar(ctx, pl.foe), F.el('div', { class: 'sh-sname' }, pl.name), F.el('div', { class: 'sh-sval' }), F.el('div', { class: 'sh-slast' })); board.appendChild(r); return r; });
    const roundEl = F.el('div', { class: 'sh-sround' });
    board.appendChild(roundEl);
    let cur = 0, round = 1, dartNo = 0, turnStart = x01, done = false, stuck = [], state = 'aim', ch = [0, 0], t0 = performance.now(), ph = [];
    const newPhases = () => { ph = Array.from({ length: 6 }, () => rnd(0, Math.PI * 2)); t0 = performance.now() - rnd(0, 4000); };
    newPhases();
    const upd = () => {
      P.forEach((pl, i) => {
        const r = rows[i];
        r.classList.toggle('on', i === cur && !done);
        r.children[2].textContent = x01 ? String(pl.rem) : String(pl.total);
        r.children[3].textContent = pl.last.join('  ');
      });
      roundEl.textContent = TF('Runde {a} / {b}', { a: Math.min(round, rounds), b: rounds }) + (x01 && dblOut ? ' · ' + T('Doppel zum Schluss') : '');
      F.info.textContent = done ? '' : cur === 0 ? T('Klicken, wenn das Fadenkreuz richtig steht') + ' · ' + TF('Pfeil {n} von 3', { n: dartNo + 1 }) + (helper ? '   ·   🔧 ' + T('Hilfe aktiv') : '') : TF('{name} wirft …', { name: P[cur].name });
    };
    const geom = () => { const { W, H } = fit(); const R = Math.min(W * 0.62, H) * 0.47; return { W, H, cx: W * 0.42, cy: H / 2, s: R / DR.rim }; };
    const hover = (now) => {
      const t = (now - t0) / 1000 * speed * 2.2, A = 150;
      return [A * (0.55 * Math.sin(1.3 * t + ph[0]) + 0.3 * Math.sin(2.9 * t + ph[1]) + 0.15 * Math.sin(5.1 * t + ph[2])),
        A * (0.55 * Math.sin(1.1 * t + ph[3]) + 0.3 * Math.sin(2.3 * t + ph[4]) + 0.15 * Math.sin(4.7 * t + ph[5]))];
    };
    let glide = null;
    const draw = (now) => {
      const G = geom();
      g.clearRect(0, 0, G.W, G.H);
      if (ok(imBg)) { const k = Math.max(G.W / imBg.naturalWidth, G.H / imBg.naturalHeight); g.drawImage(imBg, (G.W - imBg.naturalWidth * k) / 2, (G.H - imBg.naturalHeight * k) / 2, imBg.naturalWidth * k, imBg.naturalHeight * k); }
      else { const gr = g.createRadialGradient(G.cx, G.cy, 10, G.cx, G.cy, G.W * 0.7); gr.addColorStop(0, '#3a2d22'); gr.addColorStop(1, '#120d0a'); g.fillStyle = gr; g.fillRect(0, 0, G.W, G.H); }
      if (ok(imBoard)) { const w = DR.dOut * G.s * 2 / boardPct, h = w * imBoard.naturalHeight / imBoard.naturalWidth; g.drawImage(imBoard, G.cx - w / 2, G.cy - h / 2, w, h); }
      else { g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 24; drawBoard(g, G.cx, G.cy, G.s); g.restore(); }
      for (const d of stuck) { const k = d.t ? clamp(1 + (1 - (now - d.t) / 160), 1, 2) : 1; drawDart(g, G.cx + d.x * G.s, G.cy + d.y * G.s, G.s, d.col, imDart, k); }
      if (state === 'aim' || state === 'ai') {
        if (state === 'aim') ch = hover(now);
        else if (glide) { const f = clamp((now - glide.t) / glide.d, 0, 1), e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; const w = (1 - f) * 10; ch = [glide.a[0] + (glide.b[0] - glide.a[0]) * e + Math.sin(now / 90) * w, glide.a[1] + (glide.b[1] - glide.a[1]) * e + Math.cos(now / 110) * w]; }
        const x = G.cx + ch[0] * G.s, y = G.cy + ch[1] * G.s, r = 16 * G.s * 1.6;
        if (ok(imCross)) g.drawImage(imCross, x - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6);
        else {
          g.save(); g.strokeStyle = state === 'ai' ? '#6cc4ff' : '#ffe066'; g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 6; g.lineWidth = 2;
          g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
          g.beginPath(); g.moveTo(x - r * 1.5, y); g.lineTo(x - r * 0.4, y); g.moveTo(x + r * 0.4, y); g.lineTo(x + r * 1.5, y); g.moveTo(x, y - r * 1.5); g.lineTo(x, y - r * 0.4); g.moveTo(x, y + r * 0.4); g.lineTo(x, y + r * 1.5); g.stroke();
          g.restore();
        }
      }
    };
    const tick = (now) => { if (F.closed() && done) return; draw(now); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);

    // Ein Pfeil landet bei (x, y) in mm
    const land = async (x, y) => {
      const pl = P[cur], sc = dartScore(x, y);
      stuck.push({ x, y, col: pl.col, t: performance.now() });
      if (params.tonTreffer) ctx.sound && ctx.sound(params.tonTreffer, 70);
      pl.last.push(sc.label);
      dartNo++;
      let endTurn = dartNo >= 3, win = false, bust = false;
      if (x01) {
        const nr = pl.rem - sc.pts;
        if (nr < 0 || (dblOut && nr === 1) || (nr === 0 && dblOut && !sc.dbl)) { bust = true; pl.rem = turnStart; endTurn = true; }
        else { pl.rem = nr; if (nr === 0) win = true; }
      } else pl.total += sc.pts;
      upd();
      if (bust) F.say(T('Überworfen!'), 1400);
      else if (sc.mult === 3 && sc.pts >= 45) F.say(sc.label + '!', 900);
      else if (sc.pts === 50) F.say('Bullseye!', 900);
      if (win) return over(cur);
      if (endTurn) { await wait(cur === 0 ? 650 : 900); nextTurn(); } else if (cur === 0) { newPhases(); state = 'aim'; } else aiThrow();
    };
    const nextTurn = () => {
      stuck = []; dartNo = 0;
      cur = (cur + 1) % P.length;
      if (cur === 0) round++;
      P[cur].last = [];
      turnStart = P[cur].rem;
      if (round > rounds) return over(null);
      upd();
      if (cur === 0) { newPhases(); state = 'aim'; } else { state = 'ai'; aiThrow(); }
    };
    const aiThrow = async () => {
      state = 'ai';
      const pl = P[cur], code = aiDartAim(pl.foe, pl.rem, mode, dblOut), tg = dartTarget(code);
      const genau = clamp(num(pl.foe.genau, 50), 0, 100);
      const sig = 4 + Math.pow(100 - genau, 1.25) * 0.35;
      const hit = [tg[0] + gauss() * sig, tg[1] + gauss() * sig];
      const dur = Math.max(250, num(pl.foe.tempo, 1.5) * 650);
      glide = { a: ch.slice(), b: hit, t: performance.now(), d: dur };
      upd();
      await wait(dur + 120);
      if (done) return;
      land(hit[0], hit[1]);
    };
    const over = (winner) => {
      if (done) return;
      done = true; state = 'over'; upd();
      let won, text, score;
      if (!foe) {
        if (x01) { won = winner === 0; score = won ? 1 - (round - 1) / rounds * 0.4 : clamp((x01 - P[0].rem) / x01, 0, 1) * 0.5; text = won ? T('Ausgecheckt!') : TF('Nicht geschafft – noch {n} übrig', { n: P[0].rem }); }
        else { won = P[0].total >= goal; score = clamp(P[0].total / goal, 0, 1) * (won ? 1 : 0.5); if (won) score = Math.max(0.6, score); text = won ? TF('{n} Punkte – geschafft!', { n: P[0].total }) : TF('{n} von {z} Punkten', { n: P[0].total, z: goal }); }
      } else {
        if (winner == null) winner = x01 ? (P[0].rem < P[1].rem ? 0 : P[1].rem < P[0].rem ? 1 : -1) : (P[0].total > P[1].total ? 0 : P[1].total > P[0].total ? 1 : -1);
        won = winner === 0;
        const a = x01 ? x01 - P[0].rem : P[0].total, b = x01 ? x01 - P[1].rem : P[1].total;
        score = won ? clamp(0.7 + (a - b) / Math.max(1, a) * 0.3, 0.7, 1) : clamp(a / Math.max(1, a + b), 0, 0.49);
        text = winner === -1 ? T('Unentschieden') : won ? T('Gewonnen!') : TF('{name} gewinnt', { name: P[1].name });
        const line = foeLine(foe, won ? 'niederlage' : 'sieg');
        if (line) F.say(P[1].name + ': „' + line + '“', 2600);
      }
      F.finish({ score, ok: !!won }, text, resolve, params.ergebnis, foe ? 2800 : 2000);
    };
    cv.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      if (state !== 'aim' || cur !== 0 || done) return;
      const p0 = ch.slice();
      state = 'flying';
      land(p0[0] + gauss() * 2.5, p0[1] + gauss() * 2.5);
    });
    const onKey = (e) => { if ((e.key === ' ' || e.key === 'Enter') && state === 'aim' && cur === 0 && !done) { e.preventDefault(); e.stopPropagation(); state = 'flying'; land(ch[0] + gauss() * 2.5, ch[1] + gauss() * 2.5); } };
    window.addEventListener('keydown', onKey, true);
    const off = setInterval(() => { if (!document.body.contains(cv)) { window.removeEventListener('keydown', onKey, true); clearInterval(off); if (!done) { done = true; resolve({ score: 0, ok: false }); } } }, 500);
    if (foe && foeLine(foe, 'start')) F.say(P[1].name + ': „' + foeLine(foe, 'start') + '“');
    upd();
  });

  // =====================================================================
  // BILLARD
  // =====================================================================
  const BL = 1000, BW = 500, BR = 13, RAIL = 46, VMAX = 2800, DEC = 360;
  const POCKETS = [[0, 0, 28], [BL / 2, -8, 24], [BL, 0, 28], [0, BW, 28], [BL / 2, BW + 8, 24], [BL, BW, 28]];
  const BALL_COL = [null, '#f2c230', '#2554c7', '#d6322b', '#6b3fa0', '#f07a1a', '#2f8f48', '#8a2b2b', '#151515', '#f2c230', '#2554c7', '#d6322b', '#6b3fa0', '#f07a1a', '#2f8f48', '#8a2b2b'];
  const groupOf = (n) => (n >= 1 && n <= 7 ? 'voll' : n >= 9 ? 'halb' : n === 8 ? 'acht' : null);
  const segDist = (ax, ay, bx, by, px, py) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1; const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1); return Math.hypot(ax + dx * t - px, ay + dy * t - py); };

  const rack = (count, eight) => {
    const out = [], fx = BL * 0.73, fy = BW / 2;
    let nums;
    if (eight) {
      const rest = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15].sort(() => Math.random() - 0.5);
      nums = []; let k = 0;
      for (let i = 0; i < 15; i++) nums.push(i === 4 ? 8 : rest[k++]);
      // Ecken hinten: eine volle, eine halbe
      const s = nums.findIndex((n, i) => i !== 4 && n < 8), h = nums.findIndex((n, i) => i !== 4 && n > 8);
      const swap = (a, b) => { const t = nums[a]; nums[a] = nums[b]; nums[b] = t; };
      swap(10, s); const h2 = nums.findIndex((n, i) => i !== 4 && i !== 10 && n > 8); swap(14, h2 >= 0 ? h2 : h);
    } else nums = Array.from({ length: count }, (_, i) => (i % 15) + 1).map((n) => (n === 8 ? 8 : n));
    let i = 0;
    for (let row = 0; row < 5 && i < nums.length; row++) for (let j = 0; j <= row && i < nums.length; j++) {
      out.push({ n: nums[i++], x: fx + row * BR * 1.75, y: fy + (j - row / 2) * BR * 2.02, vx: 0, vy: 0, in: false });
    }
    return out;
  };

  // Ein Zeitschritt der Physik; ev.hit(a, b) und ev.pot(ball) melden Ereignisse
  const physStep = (balls, dt, ev) => {
    const live = balls.filter((b) => !b.in);
    for (const b of live) { b.x += b.vx * dt; b.y += b.vy * dt; }
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d >= BR * 2 || d === 0) continue;
      const nx = dx / d, ny = dy / d, ov = BR * 2 - d;
      a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2;
      const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (vn > 0) { const j2 = vn * 0.97; a.vx -= j2 * nx; a.vy -= j2 * ny; b.vx += j2 * nx; b.vy += j2 * ny; ev.hit(a, b, vn); }
    }
    for (const b of live) {
      for (const [px, py, pr] of POCKETS) if (Math.hypot(b.x - px, b.y - py) < pr) { b.in = true; b.vx = b.vy = 0; ev.pot(b); break; }
      if (b.in) continue;
      const mouth = POCKETS.some(([px, py, pr]) => Math.hypot(b.x - px, b.y - py) < pr + BR * 1.3);
      if (!mouth) {
        if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx) * 0.78; ev.rail(b); }
        if (b.x > BL - BR) { b.x = BL - BR; b.vx = -Math.abs(b.vx) * 0.78; ev.rail(b); }
        if (b.y < BR) { b.y = BR; b.vy = Math.abs(b.vy) * 0.78; ev.rail(b); }
        if (b.y > BW - BR) { b.y = BW - BR; b.vy = -Math.abs(b.vy) * 0.78; ev.rail(b); }
      } else if (b.x < -BR * 2 || b.x > BL + BR * 2 || b.y < -BR * 2 || b.y > BW + BR * 2) { b.in = true; b.vx = b.vy = 0; ev.pot(b); }
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) { const ns = Math.max(0, sp - (DEC + 0.1 * sp) * dt); const k = ns < 3 ? 0 : ns / sp; b.vx *= k; b.vy *= k; }
    }
  };
  const moving = (balls) => balls.some((b) => !b.in && (b.vx || b.vy));
  // Wohin trifft ein Stoß zuerst? → { t, ball } (Weg bis zur Berührung)
  const rayHit = (balls, cue, dx, dy) => {
    let best = { t: Infinity, ball: null };
    for (const b of balls) {
      if (b === cue || b.in) continue;
      const ox = b.x - cue.x, oy = b.y - cue.y, pr = ox * dx + oy * dy;
      if (pr <= 0) continue;
      const perp2 = ox * ox + oy * oy - pr * pr, R2 = 4 * BR * BR;
      if (perp2 > R2) continue;
      const t = pr - Math.sqrt(R2 - perp2);
      if (t < best.t) best = { t, ball: b };
    }
    const wall = Math.min(dx > 0 ? (BL - BR - cue.x) / dx : dx < 0 ? (BR - cue.x) / dx : Infinity, dy > 0 ? (BW - BR - cue.y) / dy : dy < 0 ? (BR - cue.y) / dy : Infinity);
    if (wall < best.t) best = { t: Math.max(0, wall), ball: null };
    return best;
  };
  const clearPath = (balls, ax, ay, bx, by, skip) => balls.every((o) => o.in || skip.includes(o) || segDist(ax, ay, bx, by, o.x, o.y) >= BR * 2 - 0.5);

  // Bester Stoß für den Computer (oder null)
  const aiShot = (balls, cue, legal, foe) => {
    const cands = [];
    for (const b of balls) {
      if (b.in || b === cue || !legal(b)) continue;
      for (const [px0, py0] of POCKETS) {
        const px = px0 === BL / 2 ? px0 : px0 === 0 ? px0 + 4 : px0 - 4, py = py0 <= 0 ? 4 : py0 >= BW ? BW - 4 : py0;
        let dx = px - b.x, dy = py - b.y; const dp = Math.hypot(dx, dy); dx /= dp; dy /= dp;
        if (px0 === BL / 2 && Math.abs(dx) > 0.75) continue; // Mitteltasche nur von vorn
        const gx = b.x - dx * BR * 2, gy = b.y - dy * BR * 2;
        if (gx < BR || gx > BL - BR || gy < BR || gy > BW - BR) continue;
        let ax = gx - cue.x, ay = gy - cue.y; const da = Math.hypot(ax, ay); if (da < 1) continue; ax /= da; ay /= da;
        const cut = Math.acos(clamp(ax * dx + ay * dy, -1, 1));
        if (cut > 1.35) continue;
        if (!clearPath(balls, cue.x, cue.y, gx, gy, [cue, b]) || !clearPath(balls, b.x, b.y, px, py, [cue, b])) continue;
        const score = Math.pow(Math.cos(cut), 2) / (1 + da / BL * 0.8 + dp / BL);
        cands.push({ ang: Math.atan2(ay, ax), da, dp, cut, score });
      }
    }
    if (!cands.length) return null;
    cands.sort((a, b) => b.score - a.score);
    const tk = num(foe.taktik, 50);
    const k = tk >= 85 ? 0 : Math.floor(Math.random() * Math.min(cands.length, 1 + Math.floor((100 - tk) / 18)));
    return cands[k];
  };

  const runBillard = (params, ctx) => new Promise((resolve) => {
    const foe = foeById(params.gegner);
    const F = frame(ctx, params.titel || T('Billard'), '88%', 'billard');
    F.area.classList.add('sh-billard');
    const { g, fit, cv, pos } = canvasIn(F.area);
    const eight = params.modus !== 'versenken';
    const count = clamp(Math.round(num(params.kugeln, 10)), 1, 15);
    const maxShots = Math.max(1, Math.round(num(params.stoesse, 12)));
    const B = (k, base) => (ctx.bonus ? ctx.bonus(k, base) : base);
    const guideLen = { lang: 260, kurz: 90, aus: 0 }[params.hilfslinie] != null ? { lang: 260, kurz: 90, aus: 0 }[params.hilfslinie] : 90;
    const guide = B('spielhalle.billard.linie', guideLen);
    const felt = /^#[0-9a-f]{3,8}$/i.test(params.tuchfarbe || '') ? params.tuchfarbe : '#1f6e43';
    const wood = /^#[0-9a-f]{3,8}$/i.test(params.randfarbe || '') ? params.randfarbe : '#5b3a22';
    const imTable = loadImg(pic(ctx, 'billard', 'bildTisch', params)), imFelt = loadImg(pic(ctx, 'billard', 'bildTuch', params));
    const imCue = loadImg(pic(ctx, 'billard', 'bildQueue', params)), imWhite = loadImg(pic(ctx, 'billard', 'bildWeiss', params));
    const imBall = {};
    for (let n = 1; n <= 15; n++) imBall[n] = loadImg(ctx.design ? ctx.design(ID + '.billard').image('kugel' + n, '') : '');
    const balls = rack(eight ? 15 : count, eight);
    cv._sh = { balls };
    const cue = { n: 0, x: BL * 0.25, y: BW / 2 + rnd(-6, 6), vx: 0, vy: 0, in: false };
    balls.unshift(cue);
    const P = [{ name: T('Du'), pots: 0, group: null, foe: null }];
    if (foe) P.push({ name: foeName(foe), pots: 0, group: null, foe });
    let cur = 0, state = 'aim', aim = 0, lock = null, pull = 0, samples = [], done = false, shots = 0, place = false, mouse = null;
    let shot = null; // Ereignisse des laufenden Stoßes
    const groupsSet = () => P.some((p) => p.group);
    const left = (grp) => balls.filter((b) => !b.in && groupOf(b.n) === grp).length;
    const legalFor = (pl) => (b) => {
      if (b.n === 0) return false;
      if (!eight) return true;
      if (!pl.group) return b.n !== 8 || !balls.some((o) => !o.in && o.n && o.n !== 8);
      return left(pl.group) ? groupOf(b.n) === pl.group : b.n === 8;
    };
    const upd = () => {
      const G = (pl) => (pl.group ? ' · ' + (pl.group === 'voll' ? T('Volle') : T('Halbe')) + (left(pl.group) ? ' (' + left(pl.group) + ')' : ' → 8') : '');
      const who = P.map((pl, i) => (i === cur && !done ? '▶ ' : '') + pl.name + (eight ? G(pl) : ': ' + pl.pots)).join('   ·   ');
      const hint = done ? '' : cur !== 0 ? TF('{name} ist am Zug …', { name: P[cur].name }) : place ? T('Weiße Kugel hinlegen: klicken') : T('Zielen mit der Maus · drücken, zurückziehen und nach vorn schwingen = stoßen · loslassen ohne Ziehen = abbrechen');
      F.info.textContent = who + (!foe ? '   ·   ' + TF('Stöße: {a} / {b}', { a: shots, b: maxShots }) : '') + (hint ? '\n' + hint : '');
    };
    const geom = () => {
      const { W, H } = fit();
      const s = Math.min(W / (BL + RAIL * 2 + 20), H / (BW + RAIL * 2 + 20));
      return { W, H, s, ox: (W - BL * s) / 2, oy: (H - BW * s) / 2 };
    };
    const toT = (e) => { const G = geom(); const [mx, my] = pos(e); return [(mx - G.ox) / G.s, (my - G.oy) / G.s]; };
    const drawBall = (G, b) => {
      const x = G.ox + b.x * G.s, y = G.oy + b.y * G.s, r = BR * G.s;
      g.save();
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x + r * 0.25, y + r * 0.35, r, r * 0.9, 0, 0, 6.3); g.fill();
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip();
      const im = b.n === 0 ? imWhite : imBall[b.n];
      if (ok(im)) g.drawImage(im, x - r, y - r, r * 2, r * 2);
      else if (b.n === 0) { g.fillStyle = '#f6f3ea'; g.fillRect(x - r, y - r, r * 2, r * 2); }
      else {
        const col = BALL_COL[b.n] || '#ccc';
        g.fillStyle = b.n > 8 ? '#f6f3ea' : col; g.fillRect(x - r, y - r, r * 2, r * 2);
        if (b.n > 8) { g.fillStyle = col; g.fillRect(x - r, y - r * 0.55, r * 2, r * 1.1); }
        if (r > 6) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r * 0.45, 0, 6.3); g.fill(); g.fillStyle = '#111'; g.font = `700 ${Math.round(r * 0.62)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(b.n), x, y + r * 0.03); }
      }
      const hl = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.05, x, y, r * 1.05);
      hl.addColorStop(0, 'rgba(255,255,255,0.55)'); hl.addColorStop(0.35, 'rgba(255,255,255,0)'); hl.addColorStop(1, 'rgba(0,0,0,0.35)');
      g.fillStyle = hl; g.fillRect(x - r, y - r, r * 2, r * 2);
      g.restore();
    };
    const draw = () => {
      const G = geom();
      g.clearRect(0, 0, G.W, G.H);
      const X = (v) => G.ox + v * G.s, Y = (v) => G.oy + v * G.s;
      if (ok(imTable)) g.drawImage(imTable, X(-RAIL), Y(-RAIL), (BL + RAIL * 2) * G.s, (BW + RAIL * 2) * G.s);
      else {
        g.fillStyle = wood; g.beginPath(); g.roundRect(X(-RAIL), Y(-RAIL), (BL + RAIL * 2) * G.s, (BW + RAIL * 2) * G.s, 16 * G.s); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3 * G.s; g.stroke();
        if (ok(imFelt)) { const pat = g.createPattern(imFelt, 'repeat'); g.fillStyle = pat; } else g.fillStyle = felt;
        g.fillRect(X(-8), Y(-8), (BL + 16) * G.s, (BW + 16) * G.s);
        const sh = g.createRadialGradient(X(BL / 2), Y(BW / 2), BW * 0.2 * G.s, X(BL / 2), Y(BW / 2), BL * 0.65 * G.s); sh.addColorStop(0, 'rgba(255,255,255,0.06)'); sh.addColorStop(1, 'rgba(0,0,0,0.28)');
        g.fillStyle = sh; g.fillRect(X(-8), Y(-8), (BL + 16) * G.s, (BW + 16) * G.s);
        g.fillStyle = '#e9dcc0';
        for (let i = 1; i < 8; i++) if (i !== 4) for (const yy of [-RAIL / 2, BW + RAIL / 2]) { g.beginPath(); g.arc(X(BL * i / 8), Y(yy), 3 * G.s, 0, 6.3); g.fill(); }
        for (let i = 1; i < 4; i++) for (const xx of [-RAIL / 2, BL + RAIL / 2]) { g.beginPath(); g.arc(X(xx), Y(BW * i / 4), 3 * G.s, 0, 6.3); g.fill(); }
        for (const [px, py, pr] of POCKETS) { g.fillStyle = '#0b0b0b'; g.beginPath(); g.arc(X(px), Y(py), pr * G.s, 0, 6.3); g.fill(); }
        g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(BL * 0.25), Y(0)); g.lineTo(X(BL * 0.25), Y(BW)); g.stroke();
      }
      for (const b of balls) if (!b.in) drawBall(G, b);
      if (place && mouse && cur === 0) { g.globalAlpha = 0.55; drawBall(G, { n: 0, x: mouse[0], y: mouse[1] }); g.globalAlpha = 1; }
      // Hilfslinie und Queue
      if ((state === 'aim' || state === 'ai') && !place && !cue.in) {
        const dx = Math.cos(aim), dy = Math.sin(aim);
        if (guide > 0 && cur === 0) {
          const h = rayHit(balls, cue, dx, dy), gx = cue.x + dx * h.t, gy = cue.y + dy * h.t;
          g.save(); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.setLineDash([6, 6]); g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(X(cue.x), Y(cue.y)); g.lineTo(X(gx), Y(gy)); g.stroke(); g.setLineDash([]);
          g.beginPath(); g.arc(X(gx), Y(gy), BR * G.s, 0, 6.3); g.stroke();
          if (h.ball) { let ox = h.ball.x - gx, oy = h.ball.y - gy; const ol = Math.hypot(ox, oy) || 1; ox /= ol; oy /= ol; g.strokeStyle = 'rgba(255,230,120,0.75)'; g.beginPath(); g.moveTo(X(h.ball.x), Y(h.ball.y)); g.lineTo(X(h.ball.x + ox * guide), Y(h.ball.y + oy * guide)); g.stroke(); }
          g.restore();
        }
        const back = BR + 6 + pull * 0.6, len = 560;
        const tx = cue.x - dx * back, ty = cue.y - dy * back;
        g.save(); g.translate(X(tx), Y(ty)); g.rotate(aim + Math.PI);
        if (ok(imCue)) { const h = 16 * G.s, w = len * G.s; g.scale(-1, 1); g.drawImage(imCue, -w, -h / 2, w, h); }
        else {
          const w = len * G.s, gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#f1e3c2'); gr.addColorStop(0.62, '#c9a06a'); gr.addColorStop(0.64, '#2a1b12'); gr.addColorStop(1, '#5a3a22');
          g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.moveTo(4 * G.s, 6 * G.s); g.lineTo(w + 4 * G.s, 10 * G.s); g.lineTo(w + 4 * G.s, -2 * G.s); g.closePath(); g.fill();
          g.fillStyle = gr; g.beginPath(); g.moveTo(0, -2.6 * G.s); g.lineTo(w, -6 * G.s); g.lineTo(w, 6 * G.s); g.lineTo(0, 2.6 * G.s); g.closePath(); g.fill();
          g.fillStyle = '#5a87c9'; g.fillRect(-1.5 * G.s, -2.6 * G.s, 3 * G.s, 5.2 * G.s);
        }
        g.restore();
        if (lock && cur === 0) { const pw = clamp(pull / 230, 0, 1); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(X(BL + RAIL + 6), Y(0), 10 * G.s, BW * G.s); g.fillStyle = pw > 0.8 ? '#ff6b4a' : '#e8c86a'; g.fillRect(X(BL + RAIL + 6), Y(BW - BW * pw), 10 * G.s, BW * pw * G.s); }
      }
    };
    let last = performance.now();
    const loop = (now) => {
      if (done && F.closed()) { draw(); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (state === 'roll') {
        const vmax = Math.max(1, ...balls.map((b) => Math.hypot(b.vx, b.vy)));
        const n = Math.max(1, Math.ceil(vmax * dt / (BR * 0.45)));
        for (let i = 0; i < n; i++) physStep(balls, dt / n, shot.ev);
        if (!moving(balls)) { state = 'eval'; evaluate(); }
      }
      draw();
      requestAnimationFrame(loop);
    };
    const strike = (ang, v) => {
      cue.vx = Math.cos(ang) * v; cue.vy = Math.sin(ang) * v;
      shot = { first: null, pots: [], rails: 0, ev: { hit: (a, b) => { if (!shot.first) { if (a === cue) shot.first = b; else if (b === cue) shot.first = a; } }, pot: (b) => shot.pots.push(b), rail: () => { shot.rails++; } } };
      lock = null; pull = 0; samples = [];
      state = 'roll'; shots++;
      if (params.tonStoss) ctx.sound && ctx.sound(params.tonStoss, clamp(v / VMAX * 100, 25, 100));
      upd();
    };
    // Weiße nach einem Foul: der Spieler legt sie hin, der Computer sucht sich eine Stelle (in aiTurn)
    const ballInHand = (who) => { cue.vx = cue.vy = 0; cue.in = true; place = who === 0; };
    const respotAuto = () => {
      cue.in = false; cue.vx = cue.vy = 0;
      let x = BL * 0.25, y = BW / 2;
      for (let k = 0; k < 60 && balls.some((b) => b !== cue && !b.in && Math.hypot(b.x - x, b.y - y) < BR * 2.1); k++) { x = BL * rnd(0.08, 0.4); y = BW * rnd(0.12, 0.88); }
      cue.x = x; cue.y = y;
    };
    const evaluate = () => {
      const pl = P[cur], other = (cur + 1) % P.length;
      const pots = shot.pots.filter((b) => b !== cue), scratch = shot.pots.includes(cue);
      const eightIn = pots.some((b) => b.n === 8);
      const first = shot.first;
      let foul = scratch || !first;
      let keep = false;
      if (eight) {
        // Ziel vor dem Stoß: eigene Gruppe, oder die 8, wenn die eigene Gruppe schon weg war
        const ownBefore = pl.group ? balls.filter((b) => groupOf(b.n) === pl.group && (!b.in || pots.includes(b))).length : null;
        const othersBefore = balls.filter((b) => b.n && b.n !== 8 && (!b.in || pots.includes(b))).length;
        if (first) {
          if (pl.group) { if (groupOf(first.n) !== (ownBefore ? pl.group : 'acht')) foul = true; }
          else if (first.n === 8 && (foe ? true : othersBefore > 0)) foul = true;
        }
        if (eightIn) {
          const allowed = foe ? (pl.group && ownBefore === 0) : othersBefore === 0;
          const winNow = allowed && !scratch && !foul;
          return over(winNow ? cur : (foe ? other : -1), winNow ? '' : T('Die 8 zu früh versenkt'));
        }
        if (foe && !groupsSet() && pots.length && !foul) {
          const g1 = groupOf(pots[0].n); pl.group = g1; P[other].group = g1 === 'voll' ? 'halb' : 'voll';
        }
        keep = !foul && pots.some((b) => (pl.group ? groupOf(b.n) === pl.group : true));
        if (!scratch) pl.pots += pots.length;
      } else {
        if (!scratch) pl.pots += pots.length;
        keep = !foul && pots.length > 0;
        const rest = balls.filter((b) => !b.in && b !== cue).length;
        if (foe) {
          const need = Math.floor(count / 2) + 1;
          if (P[0].pots >= need || P[1].pots >= need || !rest) return over(P[0].pots > P[1].pots ? 0 : P[1].pots > P[0].pots ? 1 : -1);
        } else if (!rest) return over(0);
      }
      if (scratch) F.say(T('Foul: Weiße versenkt'), 1500);
      else if (!first) F.say(T('Foul: keine Kugel getroffen'), 1500);
      else if (foul) F.say(T('Foul: falsche Kugel zuerst'), 1500);
      if (!foe) {
        if (shots >= maxShots) return over(-1);
        if (scratch) respotAuto();
        state = 'aim'; upd(); return;
      }
      if (!keep) {
        cur = other;
        if (foul) ballInHand(cur);
      }
      upd();
      if (cur === 0) state = 'aim'; else aiTurn();
    };
    const aiTurn = async () => {
      state = 'ai'; upd();
      const pl = P[cur], fo = pl.foe;
      await wait(500);
      if (done) return;
      if (cue.in) { // Weiße hinlegen: beste Stelle aus ein paar Versuchen
        place = false; cue.in = false;
        let best = null;
        for (let k = 0; k < 36; k++) {
          const x = rnd(BR * 2, BL - BR * 2), y = rnd(BR * 2, BW - BR * 2);
          if (balls.some((b) => b !== cue && !b.in && Math.hypot(b.x - x, b.y - y) < BR * 2.2)) continue;
          cue.x = x; cue.y = y;
          const s = aiShot(balls, cue, legalFor(pl), fo);
          if (s && (!best || s.score > best.s)) best = { x, y, s: s.score };
        }
        if (best) { cue.x = best.x; cue.y = best.y; } else respotAuto();
      }
      let s = aiShot(balls, cue, legalFor(pl), fo), ang, v;
      if (s) {
        ang = s.ang;
        v = Math.sqrt(2 * DEC * (s.da + s.dp * 1.9 / Math.max(0.25, Math.cos(s.cut)))) * 1.35 + 160;
      } else { // kein sauberer Stoß: auf die nächste erlaubte Kugel spielen
        const t = balls.filter((b) => !b.in && legalFor(pl)(b)).sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y))[0] || balls.find((b) => !b.in && b !== cue);
        ang = t ? Math.atan2(t.y - cue.y, t.x - cue.x) : 0; v = 1300;
      }
      const genau = clamp(num(fo.genau, 50), 0, 100), kraft = clamp(num(fo.kraft, 50), 0, 100);
      ang += gauss() * Math.pow((100 - genau) / 100, 1.5) * 0.09;
      v = clamp(v * (1 + gauss() * (100 - kraft) / 260), 250, VMAX);
      // Zielen sichtbar machen
      const a0 = aim, d = Math.max(400, num(fo.tempo, 1.5) * 800), t0 = performance.now();
      const da = Math.atan2(Math.sin(ang - a0), Math.cos(ang - a0));
      await new Promise((res) => { const step = (now) => { const f = clamp((now - t0) / d, 0, 1); aim = a0 + da * (1 - Math.pow(1 - f, 3)); pull = f > 0.7 ? (f - 0.7) / 0.3 * 160 * (v / VMAX) : 0; if (f < 1 && !done) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
      if (done) return;
      aim = ang; strike(ang, v);
    };
    const over = (winner, why) => {
      if (done) return;
      done = true; state = 'over'; upd();
      let won, text, score;
      if (!foe) {
        won = winner === 0;
        const potted = balls.filter((b) => b.in && b !== cue).length, total = balls.length - 1;
        score = won ? clamp(1 - (shots - 1) / maxShots * 0.4, 0.6, 1) : clamp(potted / total * 0.5, 0, 0.49);
        text = won ? TF('Alle versenkt in {n} Stößen!', { n: shots }) : (why || TF('{a} von {b} versenkt', { a: potted, b: total }));
      } else {
        won = winner === 0;
        score = won ? clamp(0.7 + (P[0].pots - P[1].pots) / 20, 0.7, 1) : clamp(P[0].pots / 16, 0, 0.49);
        text = winner === -1 ? T('Unentschieden') : won ? (why ? why + ' – ' : '') + T('Gewonnen!') : (why ? why + ' – ' : '') + TF('{name} gewinnt', { name: P[1].name });
        const line = foeLine(foe, won ? 'niederlage' : 'sieg');
        if (line) F.say(P[1].name + ': „' + line + '“', 2600);
      }
      F.finish({ score, ok: !!won }, text, resolve, params.ergebnis, foe ? 2800 : 2000);
    };
    // Steuerung
    cv.addEventListener('mousemove', (e) => {
      const [tx, ty] = toT(e);
      mouse = [clamp(tx, BR, BL - BR), clamp(ty, BR, BW - BR)];
      if (cur !== 0 || state !== 'aim' || done) return;
      if (place) return;
      if (!lock) { aim = Math.atan2(ty - cue.y, tx - cue.x); return; }
      const dx = Math.cos(aim), dy = Math.sin(aim);
      const p = clamp((lock[0] - tx) * dx + (lock[1] - ty) * dy, -40, 230);
      const now = performance.now();
      samples.push([now, p]); while (samples.length && now - samples[0][0] > 160) samples.shift();
      if (pull > 10 && p <= 0) { // nach vorn geschwungen: Tempo der Bewegung = Kraft
        const s0 = samples.reduce((m, s) => (s[1] > m[1] ? s : m), samples[0]);
        const rate = (s0[1] - p) / Math.max(0.016, (now - s0[0]) / 1000);
        return strike(aim, clamp(rate * 2.1, 160, VMAX));
      }
      pull = Math.max(0, p);
    });
    cv.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      if (cur !== 0 || state !== 'aim' || done) return;
      if (e.button === 2) { lock = null; pull = 0; return; }
      const [tx, ty] = toT(e);
      if (place) {
        const x = clamp(tx, BR, BL - BR), y = clamp(ty, BR, BW - BR);
        if (balls.some((b) => b !== cue && !b.in && Math.hypot(b.x - x, b.y - y) < BR * 2.05)) return;
        cue.x = x; cue.y = y; cue.in = false; place = false; upd(); return;
      }
      lock = [tx, ty]; pull = 0; samples = [[performance.now(), 0]];
    });
    const up = (e) => {
      if (!lock || cur !== 0 || state !== 'aim') return;
      if (pull > 10) strike(aim, clamp(Math.pow(pull / 230, 1.15) * VMAX, 160, VMAX));
      lock = null; pull = 0;
    };
    cv.addEventListener('mouseup', up);
    cv.addEventListener('mouseleave', () => { if (lock) { lock = null; pull = 0; } });
    cv.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); lock = null; pull = 0; });
    const off = setInterval(() => { if (!document.body.contains(cv)) { clearInterval(off); if (!done) { done = true; resolve({ score: 0, ok: false }); } } }, 500);
    if (foe && foeLine(foe, 'start')) F.say(P[1].name + ': „' + foeLine(foe, 'start') + '“');
    upd();
    requestAnimationFrame(loop);
  });

  // =====================================================================
  // SPIELAUTOMAT
  // =====================================================================
  // Walzen-Streifen: jedes Symbol so oft wie sein Gewicht, fest gemischt (gleich bei jedem Start)
  const strips = (m) => {
    const base = [];
    for (const s of m.symbole || []) for (let k = 0; k < Math.max(0, Math.round(num(s.gewicht, 1))); k++) base.push(s.id);
    if (!base.length) base.push('?');
    return Array.from({ length: clamp(Math.round(num(m.walzen, 3)), 1, 6) }, (_, i) => {
      const a = base.slice(); let seed = 1234567 + i * 7919;
      const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let j = a.length - 1; j > 0; j--) { const k = Math.floor(r() * (j + 1)); [a[j], a[k]] = [a[k], a[j]]; }
      return a;
    });
  };
  const lines = (m) => {
    const R = clamp(Math.round(num(m.reihen, 3)), 1, 3), N = clamp(Math.round(num(m.walzen, 3)), 1, 6);
    const row = (r) => Array(N).fill(r);
    if (R === 1) return [row(0)];
    const mid = Math.floor(R / 2);
    if (m.linien === 'mitte') return [row(mid)];
    const out = [];
    for (let r = 0; r < R; r++) out.push(row(r));
    if (m.linien === 'fuenf' && R === 3) {
      out.push(Array.from({ length: N }, (_, i) => { const h = (N - 1) / 2; return Math.round(Math.abs(i - h) / Math.max(1, h) * 2); }));
      out.push(Array.from({ length: N }, (_, i) => { const h = (N - 1) / 2; return 2 - Math.round(Math.abs(i - h) / Math.max(1, h) * 2); }));
    }
    return out;
  };
  // Gewinn einer Walzenstellung (grid[walze][reihe] = Symbol-ID) → { win (× Einsatz pro Linie), hits: [Linien-Index] }
  const evalSpin = (m, grid, L) => {
    let win = 0; const hits = [];
    L.forEach((ln, li) => {
      const seq = ln.map((r, i) => grid[i][r]);
      const s = seq.find((x) => x !== m.joker) || seq[0];
      let k = 0; while (k < seq.length && (seq[k] === s || (m.joker && seq[k] === m.joker))) k++;
      let best = 0;
      for (const e of m.gewinne || []) if (e.symbol === s && num(e.anzahl, 3) <= k) best = Math.max(best, num(e.faktor, 0));
      if (best > 0) { win += best; hits.push({ li, k }); }
    });
    return { win, hits };
  };
  const spinGrid = (m, S) => S.map((strip) => { const st = Math.floor(Math.random() * strip.length); return Array.from({ length: clamp(Math.round(num(m.reihen, 3)), 1, 3) }, (_, r) => strip[(st + r) % strip.length]); });
  // Auszahlung im Schnitt (Rückgabe in %) und Gewinnchance pro Dreh – für den Editor
  const rtp = (m, n) => {
    const S = strips(m), L = lines(m); let paid = 0, wins = 0;
    for (let i = 0; i < n; i++) { const r = evalSpin(m, spinGrid(m, S), L); paid += r.win; if (r.win) wins++; }
    return { rtp: paid / (n * L.length) * 100, hit: wins / n * 100 };
  };

  const runAutomat = (params, ctx) => new Promise((resolve) => {
    const d = data();
    const m = d.automaten.find((x) => x.id === params.automat) || d.automaten[0];
    if (!m) { ctx.message(T('Kein Spielautomat eingerichtet.')).then(() => resolve({ score: 0, ok: false })); return; }
    const D = m.design || {};
    const F = frame(ctx, params.titel || (D.titel ? (VN.tr ? VN.tr(m.id + ':titel', D.titel) : D.titel) : (VN.tr ? VN.tr(m.id + ':name', m.name) : m.name)), '72%', 'automat');
    F.area.classList.add('sh-slot');
    const el = F.el;
    const S = strips(m), L = lines(m), N = S.length, R = clamp(Math.round(num(m.reihen, 3)), 1, 3);
    const bet = Math.max(1, Math.round(num(m.einsatz, 1)));
    const cost = bet * L.length;
    const cur = m.waehrung ? ctx.project.currencies.find((c) => c.id === m.waehrung) : null;
    const curName = cur ? (VN.tr ? VN.tr(cur.id + ':name', cur.name) : cur.name) : T('Münzen');
    let credits = cur ? ctx.money.get(cur.id) : Math.max(0, Math.round(num(m.guthaben, 50)));
    const start = credits;
    const maxSpins = Math.max(0, Math.round(num(params.drehungen, 0)));
    let spins = 0, busy = false, done = false;
    const sym = (id) => (m.symbole || []).find((s) => s.id === id) || { emoji: '?', bild: '' };
    // Aussehen
    if (D.hintergrund) F.area.style.backgroundImage = `url("${ctx.asset(D.hintergrund)}")`;
    const body = el('div', { class: 'sh-mach' + (D.gehaeuse ? ' img' : '') });
    body.style.setProperty('--sh-c', D.farbe || '#7a1f2b');
    body.style.setProperty('--sh-a', D.akzent || '#e8c86a');
    if (D.gehaeuse) body.style.backgroundImage = `url("${ctx.asset(D.gehaeuse)}")`;
    const win = el('div', { class: 'sh-window' });
    if (D.gehaeuse) Object.assign(win.style, { left: num(D.fx, 14) + '%', top: num(D.fy, 30) + '%', width: num(D.fw, 72) + '%', height: num(D.fh, 40) + '%' });
    const reels = S.map(() => { const r = el('div', { class: 'sh-reel' }); const cells = Array.from({ length: R + 2 }, () => el('div', { class: 'sh-cell' })); r.append(...cells); win.appendChild(r); return { r, cells, pos: Math.floor(Math.random() * 1000), anim: null, shown: [] }; });
    win.style.setProperty('--sh-rows', R);
    const lineSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    lineSvg.setAttribute('class', 'sh-lines'); lineSvg.setAttribute('viewBox', '0 0 100 100'); lineSvg.setAttribute('preserveAspectRatio', 'none');
    win.appendChild(lineSvg);
    const lights = D.gehaeuse ? null : el('div', { class: 'sh-lights' }, ...Array.from({ length: 14 }, () => el('span')));
    const credEl = el('div', { class: 'sh-led' }), winEl = el('div', { class: 'sh-led win' });
    const spinBtn = el('button', { class: 'sh-spin' }, T('Drehen'));
    const stopBtn = el('button', { class: 'sh-stop' }, T('Aufhören'));
    const payBtn = el('button', { class: 'sh-pay-btn' }, T('Gewinne'));
    const lever = el('div', { class: 'sh-lever' + (D.hebel ? ' img' : '') });
    if (D.hebel) lever.style.backgroundImage = `url("${ctx.asset(D.hebel)}")`; else lever.append(el('span', { class: 'sh-knob' }));
    const panel = el('div', { class: 'sh-mpanel' }, el('div', { class: 'sh-leds' }, credEl, winEl), el('div', { class: 'sh-btns' }, payBtn, stopBtn, spinBtn));
    if (D.gehaeuse) body.append(win, panel); else body.append(lights, win, panel);
    const wrap = el('div', { class: 'sh-mwrap' }, body, lever);
    F.area.appendChild(wrap);
    // Gewinntabelle
    const table = el('div', { class: 'sh-paytable' });
    const fillTable = () => {
      table.innerHTML = '';
      const rows = (m.gewinne || []).slice().sort((a, b) => num(b.faktor, 0) - num(a.faktor, 0));
      for (const e of rows) { const s = sym(e.symbol); table.appendChild(el('div', { class: 'sh-prow' }, el('span', { class: 'sh-psym' }, ...Array.from({ length: num(e.anzahl, 3) }, () => s.bild ? el('img', { src: ctx.asset(s.bild) }) : el('span', null, s.emoji || '?'))), el('span', { class: 'sh-pval' }, '× ' + num(e.faktor, 0)))); }
      if (m.joker) { const j = sym(m.joker); table.appendChild(el('div', { class: 'sh-prow' }, el('span', { class: 'sh-psym' }, j.bild ? el('img', { src: ctx.asset(j.bild) }) : el('span', null, j.emoji || '?')), el('span', { class: 'sh-pval' }, T('Joker – ersetzt jedes Symbol')))); }
      table.appendChild(el('div', { class: 'sh-pnote' }, TF('{n} Gewinnlinie(n) · Einsatz {b} pro Linie · Gewinn = Faktor × Einsatz, gleiche Symbole von links', { n: L.length, b: bet })));
    };
    fillTable();
    F.area.appendChild(table);
    payBtn.onclick = (e) => { e.stopPropagation(); table.classList.toggle('show'); };
    const setCell = (c, id) => { if (c._id === id) return; c._id = id; c.innerHTML = ''; const s = sym(id); if (s.bild) c.appendChild(el('img', { src: ctx.asset(s.bild), draggable: false })); else c.textContent = s.emoji || '?'; };
    const drawReel = (rl) => {
      const st = S[reels.indexOf(rl)], n = st.length, base = Math.floor(rl.pos), frac = rl.pos - base;
      rl.cells.forEach((c, i) => { setCell(c, st[((base + i - 1) % n + n) % n]); c.style.transform = `translateY(${(i - 1 - frac) * 100}%)`; });
    };
    reels.forEach(drawReel);
    const upd = () => {
      credEl.textContent = TF('{c}: {n}', { c: curName, n: credits });
      F.info.textContent = TF('Einsatz pro Dreh: {n} {c}', { n: cost, c: curName }) + (maxSpins ? '   ·   ' + TF('Drehungen: {a} / {b}', { a: spins, b: maxSpins }) : '') + '   ·   ' + T('Leertaste oder Hebel = drehen');
      spinBtn.disabled = busy || credits < cost || done;
    };
    const showLines = (hits) => {
      lineSvg.innerHTML = '';
      for (const h of hits) {
        const ln = L[h.li];
        const pts = ln.map((r, i) => `${(i + 0.5) / N * 100},${(r + 0.5) / R * 100}`).join(' ');
        const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        pl.setAttribute('points', pts); lineSvg.appendChild(pl);
        for (let i = 0; i < h.k; i++) reels[i].cells[ln[i] + 1].classList.add('hit');
      }
    };
    const spin = async () => {
      if (busy || done || credits < cost) return;
      busy = true; spins++;
      credits -= cost; if (cur) ctx.money.add(cur.id, -cost);
      winEl.textContent = '';
      showLines([]); reels.forEach((rl) => rl.cells.forEach((c) => c.classList.remove('hit')));
      lever.classList.remove('pull'); void lever.offsetWidth; lever.classList.add('pull');
      if (params.tonDreh) ctx.sound && ctx.sound(params.tonDreh, 70);
      upd();
      const grid = spinGrid(m, S);
      // Endstellung je Walze: so weit drehen, dass oben die gezogene Stelle steht
      const t0 = performance.now();
      const plan = reels.map((rl, i) => {
        const st = S[i], n = st.length, top = grid[i][0];
        let target = Math.floor(rl.pos) + n * (2 + i) + 1;
        for (let k = 0; k < n; k++) if (st[((target + k) % n + n) % n] === top && grid[i].every((id, r) => st[((target + k + r) % n + n) % n] === id)) { target += k; break; }
        return { from: rl.pos, to: target, dur: 900 + i * 380 };
      });
      await new Promise((res) => {
        const step = (now) => {
          let all = true;
          reels.forEach((rl, i) => {
            const p = plan[i], f = clamp((now - t0) / p.dur, 0, 1);
            const e = 1 - Math.pow(1 - f, 3);
            rl.pos = p.from + (p.to - p.from) * e;
            if (f >= 1 && !rl.landed) { rl.landed = true; rl.r.classList.remove('land'); void rl.r.offsetWidth; rl.r.classList.add('land'); }
            if (f < 1) all = false;
            drawReel(rl);
          });
          if (!all) requestAnimationFrame(step); else res();
        };
        reels.forEach((rl) => { rl.landed = false; });
        requestAnimationFrame(step);
      });
      const res = evalSpin(m, grid, L);
      const pay = res.win * bet;
      if (pay > 0) {
        credits += pay; if (cur) ctx.money.add(cur.id, pay);
        winEl.textContent = '+' + pay;
        showLines(res.hits);
        if (params.tonGewinn) ctx.sound && ctx.sound(params.tonGewinn, 80);
        if (res.win >= 100) F.say(T('JACKPOT!'), 1800); else if (res.win >= 15) F.say(T('Großer Gewinn!'), 1300);
        body.classList.remove('flash'); void body.offsetWidth; body.classList.add('flash');
      }
      busy = false;
      upd();
      if ((maxSpins && spins >= maxSpins) || credits < cost) setTimeout(end, pay > 0 ? 1300 : 700);
    };
    const end = () => {
      if (done) return;
      done = true; window.removeEventListener('keydown', onKey, true); upd();
      const net = credits - start, okk = net > 0;
      const score = okk ? clamp(0.6 + net / (cost * 20), 0.6, 1) : clamp(0.5 + net / Math.max(cost * 10, start || 1) / 2, 0, 0.49);
      F.finish({ score, ok: okk, net }, net > 0 ? TF('Plus {n} {c}!', { n: net, c: curName }) : net < 0 ? TF('Minus {n} {c}', { n: -net, c: curName }) : T('Plus minus null'), resolve, params.ergebnis, 1800);
    };
    spinBtn.onclick = (e) => { e.stopPropagation(); spin(); };
    lever.onclick = (e) => { e.stopPropagation(); spin(); };
    stopBtn.onclick = (e) => { e.stopPropagation(); if (!busy) end(); };
    const onKey = (e) => { if ((e.key === ' ' || e.key === 'Enter') && !done) { e.preventDefault(); e.stopPropagation(); spin(); } };
    window.addEventListener('keydown', onKey, true);
    const off = setInterval(() => { if (!document.body.contains(wrap)) { clearInterval(off); window.removeEventListener('keydown', onKey, true); if (!done) { done = true; resolve({ score: 0, ok: false }); } } }, 500);
    upd();
  });

  // =====================================================================
  // BLACKJACK
  // =====================================================================
  const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const cardVal = (r) => (r === 'A' ? 11 : ['10', 'J', 'Q', 'K'].includes(r) ? 10 : Number(r));
  const handVal = (cards) => { let t = 0, a = 0; for (const c of cards) { t += cardVal(c.r); if (c.r === 'A') a++; } while (t > 21 && a) { t -= 10; a--; } return { total: t, soft: a > 0 }; };
  // Grundstrategie – was ein guter Spieler jetzt tun würde (für die Tipps)
  const bjTip = (cards, up, canDouble, canSplit) => {
    const d = cardVal(up.r), v = handVal(cards);
    if (canSplit) {
      const r = cardVal(cards[0].r);
      if (r === 11 || r === 8) return 'teilen';
      if (r === 9 && ![7, 10, 11].includes(d)) return 'teilen';
      if ((r === 7 || r === 3 || r === 2) && d <= 7) return 'teilen';
      if (r === 6 && d <= 6) return 'teilen';
      if (r === 4 && (d === 5 || d === 6)) return 'teilen';
    }
    if (v.soft) {
      const o = v.total - 11;
      if (o >= 8) return 'stehen';
      if (o === 7) return d >= 3 && d <= 6 && canDouble ? 'verdoppeln' : d <= 8 ? 'stehen' : 'ziehen';
      if (o === 6) return d >= 3 && d <= 6 && canDouble ? 'verdoppeln' : 'ziehen';
      if (o >= 4) return d >= 4 && d <= 6 && canDouble ? 'verdoppeln' : 'ziehen';
      return d >= 5 && d <= 6 && canDouble ? 'verdoppeln' : 'ziehen';
    }
    const t = v.total;
    if (t >= 17) return 'stehen';
    if (t >= 13) return d <= 6 ? 'stehen' : 'ziehen';
    if (t === 12) return d >= 4 && d <= 6 ? 'stehen' : 'ziehen';
    if (t === 11) return canDouble ? 'verdoppeln' : 'ziehen';
    if (t === 10) return d <= 9 && canDouble ? 'verdoppeln' : 'ziehen';
    if (t === 9) return d >= 3 && d <= 6 && canDouble ? 'verdoppeln' : 'ziehen';
    return 'ziehen';
  };

  const runBlackjack = (params, ctx) => new Promise((resolve) => {
    const dealer = foeById(params.croupier);
    const F = frame(ctx, params.titel || T('Blackjack'), '84%', 'blackjack');
    F.area.classList.add('sh-bj');
    const el = F.el;
    const cur = params.waehrung ? ctx.project.currencies.find((c) => c.id === params.waehrung) : null;
    const curName = cur ? (VN.tr ? VN.tr(cur.id + ':name', cur.name) : cur.name) : T('Chips');
    let credits = cur ? ctx.money.get(cur.id) : Math.max(0, Math.round(num(params.guthaben, 100)));
    const start = credits;
    const minBet = Math.max(1, Math.round(num(params.einsatz, 5)));
    const maxBet = Math.max(minBet, Math.round(num(params.maxEinsatz, minBet * 10)));
    const maxRounds = Math.max(0, Math.round(num(params.runden, 0)));
    const decks = clamp(Math.round(num(params.decks, 2)), 1, 8);
    const h17 = params.soft17 === 'zieht';
    const bjPay = params.auszahlung === '6:5' ? 1.2 : 1.5;
    const allowDouble = params.verdoppeln !== 'nein', allowSplit = params.teilen !== 'nein';
    const helper = params.hilfe && ctx.items && ctx.items.count(params.hilfe) > 0;
    const tips = params.tipps === 'an' || helper || (ctx.bonus ? ctx.bonus('spielhalle.blackjack.tipps', 0) > 0 : false);
    const imBack = pic(ctx, 'blackjack', 'bildRueckseite', params), imTable = pic(ctx, 'blackjack', 'bildTisch', params);
    if (imTable) F.area.style.background = `url("${imTable}") center / cover`;
    let shoe = [];
    const shuffleShoe = () => { shoe = []; for (let d = 0; d < decks; d++) for (const s of SUITS) for (const r of RANKS) shoe.push({ r, s }); for (let i = shoe.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; } };
    shuffleShoe();
    const drawCard = () => { if (shoe.length < decks * 52 * 0.25) { shuffleShoe(); F.say(T('Neu gemischt'), 1000); } return shoe.pop(); };
    const money = (d) => { credits += d; if (cur && d) ctx.money.add(cur.id, d); };
    // Tisch
    const dName = dealer ? foeName(dealer) : T('Croupier');
    const dVal = el('span', { class: 'sh-bj-val' }), dCards = el('div', { class: 'sh-bj-cards' });
    const dealerBox = el('div', { class: 'sh-bj-dealer' }, el('div', { class: 'sh-bj-who' }, avatar(ctx, dealer), el('span', { class: 'sh-bj-name' }, dName), dVal), dCards);
    const msg = el('div', { class: 'sh-bj-msg' });
    const handsBox = el('div', { class: 'sh-bj-hands' });
    const ctrl = el('div', { class: 'sh-bj-ctrl' });
    const credEl = el('div', { class: 'sh-bj-cred' });
    F.area.append(dealerBox, msg, handsBox, el('div', { class: 'sh-bj-bar' }, credEl, ctrl));
    const cardEl = (c, hidden) => {
      if (hidden) return el('div', { class: 'sh-card back' + (imBack ? ' img' : ''), style: imBack ? { backgroundImage: `url("${imBack}")` } : null });
      const red = c.s === '♥' || c.s === '♦';
      return el('div', { class: 'sh-card' + (red ? ' red' : '') }, el('span', { class: 'sh-c-tl' }, c.r, el('br'), c.s), el('span', { class: 'sh-c-mid' }, c.s), el('span', { class: 'sh-c-br' }, c.r, el('br'), c.s));
    };
    const valText = (cards) => { const v = handVal(cards); return v.soft && v.total < 21 ? (v.total - 10) + ' / ' + v.total : String(v.total); };
    let bet = Math.min(minBet, credits), hands = [], active = 0, dc = [], hole = true, phase = 'bet', rounds = 0, done = false;
    const render = () => {
      dCards.innerHTML = '';
      dc.forEach((c, i) => dCards.appendChild(cardEl(c, i === 1 && hole)));
      dVal.textContent = dc.length ? (hole ? valText([dc[0]]) : valText(dc)) : '';
      handsBox.innerHTML = '';
      hands.forEach((h, i) => {
        const v = handVal(h.cards);
        handsBox.appendChild(el('div', { class: 'sh-bj-hand' + (i === active && phase === 'play' ? ' on' : '') + (h.res ? ' ' + h.res : '') },
          el('div', { class: 'sh-bj-cards' }, ...h.cards.map((c) => cardEl(c))),
          el('div', { class: 'sh-bj-hinfo' }, el('span', { class: 'sh-bj-val' }, v.total > 21 ? T('Über 21!') : valText(h.cards)), el('span', { class: 'sh-bj-bet' }, '● ' + h.bet), h.label ? el('span', { class: 'sh-bj-res' }, h.label) : null)));
      });
      credEl.textContent = TF('{c}: {n}', { c: curName, n: credits });
      ctrl.innerHTML = '';
      const btn = (label, fn, cls, dis) => el('button', { class: 'sh-bj-btn' + (cls ? ' ' + cls : ''), disabled: !!dis, onclick: (e) => { e.stopPropagation(); fn(); } }, label);
      if (phase === 'bet') {
        const steps = [minBet, minBet * 5, minBet * 25].filter((x, i, a) => x <= maxBet && a.indexOf(x) === i);
        ctrl.append(
          btn('−', () => { bet = Math.max(minBet, bet - minBet); render(); }, 'quiet', bet <= minBet),
          el('span', { class: 'sh-bj-betv' }, TF('Einsatz: {n}', { n: bet })),
          ...steps.map((s) => btn('+' + s, () => { bet = Math.min(maxBet, credits, bet + s); render(); }, 'chip', bet >= Math.min(maxBet, credits))),
          btn(T('Geben'), deal, 'main', credits < minBet || bet > credits),
          btn(T('Aufhören'), end, 'quiet'));
        F.info.textContent = (maxRounds ? TF('Runde {a} / {b}', { a: rounds + 1, b: maxRounds }) + '   ·   ' : '') + TF('Einsatz {a}–{b} · Blackjack zahlt {p} · Croupier {s}', { a: minBet, b: maxBet, p: bjPay === 1.5 ? '3:2' : '6:5', s: h17 ? T('zieht bei weicher 17') : T('steht ab 17') });
      } else if (phase === 'play') {
        const h = hands[active];
        const two = h.cards.length === 2;
        const canD = allowDouble && two && credits >= h.bet && !h.splitAce;
        const canS = allowSplit && two && hands.length < 4 && credits >= h.bet && cardVal(h.cards[0].r) === cardVal(h.cards[1].r);
        ctrl.append(btn(T('Ziehen'), hit, 'main'), btn(T('Stehen'), stand), canD ? btn(T('Verdoppeln'), dbl) : null, canS ? btn(T('Teilen'), split) : null);
        const tip = tips ? bjTip(h.cards, dc[0], canD, canS) : null;
        F.info.textContent = (hands.length > 1 ? TF('Hand {a} von {b}', { a: active + 1, b: hands.length }) + '   ·   ' : '') + (tip ? '💡 ' + TF('Tipp: {t}', { t: T({ ziehen: 'Ziehen', stehen: 'Stehen', verdoppeln: 'Verdoppeln', teilen: 'Teilen' }[tip]) }) : T('Ziehen = noch eine Karte · Stehen = genug'));
      } else F.info.textContent = '';
    };
    const say = (t) => { msg.textContent = t; msg.classList.remove('show'); void msg.offsetWidth; msg.classList.add('show'); };
    const deal = async () => {
      if (phase !== 'bet' || done || credits < minBet) return;
      bet = clamp(bet, minBet, Math.min(maxBet, credits));
      money(-bet);
      hands = [{ cards: [], bet }]; dc = []; hole = true; active = 0; phase = 'deal'; msg.classList.remove('show');
      if (params.tonKarte) ctx.sound && ctx.sound(params.tonKarte, 60);
      for (const who of ['p', 'd', 'p', 'd']) { (who === 'p' ? hands[0].cards : dc).push(drawCard()); render(); await wait(260); }
      const pBJ = handVal(hands[0].cards).total === 21, dBJ = handVal(dc).total === 21;
      if (dBJ || pBJ) { hole = false; render(); await wait(400); return settle(); }
      phase = 'play'; render();
    };
    const next = async () => {
      while (active < hands.length && hands[active].done) active++;
      if (active < hands.length) { phase = 'play'; render(); return; }
      await dealerTurn();
    };
    const finishHand = () => { hands[active].done = true; active++; next(); };
    const hit = async () => {
      if (phase !== 'play') return;
      const h = hands[active];
      h.cards.push(drawCard()); if (params.tonKarte) ctx.sound && ctx.sound(params.tonKarte, 50);
      render();
      const t = handVal(h.cards).total;
      if (t > 21) { h.res = 'lose'; h.label = T('Über 21!'); phase = 'wait'; render(); await wait(500); finishHand(); }
      else if (t === 21) { phase = 'wait'; await wait(350); finishHand(); }
    };
    const stand = () => { if (phase === 'play') finishHand(); };
    const dbl = async () => {
      if (phase !== 'play') return;
      const h = hands[active];
      money(-h.bet); h.bet *= 2; h.cards.push(drawCard());
      if (handVal(h.cards).total > 21) { h.res = 'lose'; h.label = T('Über 21!'); }
      phase = 'wait'; render(); await wait(500); finishHand();
    };
    const split = async () => {
      if (phase !== 'play') return;
      const h = hands[active];
      money(-h.bet);
      const ace = h.cards[0].r === 'A';
      const h2 = { cards: [h.cards.pop()], bet: h.bet, split: true, splitAce: ace };
      h.split = true; h.splitAce = ace;
      hands.splice(active + 1, 0, h2);
      h.cards.push(drawCard()); h2.cards.push(drawCard());
      if (ace) { h.done = true; h2.done = true; }
      phase = 'wait'; render(); await wait(400);
      next();
    };
    const dealerTurn = async () => {
      phase = 'dealer'; hole = false; render();
      await wait(600);
      if (hands.some((h) => handVal(h.cards).total <= 21)) {
        for (;;) {
          const v = handVal(dc);
          if (v.total > 17 || (v.total === 17 && !(v.soft && h17))) break;
          dc.push(drawCard()); if (params.tonKarte) ctx.sound && ctx.sound(params.tonKarte, 50);
          render(); await wait(650);
        }
      }
      settle();
    };
    const settle = async () => {
      phase = 'settle';
      const dv = handVal(dc).total, dBJ = dc.length === 2 && dv === 21;
      let net = 0;
      for (const h of hands) {
        const pv = handVal(h.cards).total, pBJ = h.cards.length === 2 && pv === 21 && !h.split;
        let back = 0;
        if (pv > 21) { h.res = 'lose'; h.label = T('Über 21!'); }
        else if (pBJ && !dBJ) { back = h.bet + Math.floor(h.bet * bjPay); h.res = 'win'; h.label = T('Blackjack!'); }
        else if (dBJ && !pBJ) { h.res = 'lose'; h.label = T('Croupier hat Blackjack'); }
        else if (pBJ && dBJ) { back = h.bet; h.res = 'push'; h.label = T('Unentschieden'); }
        else if (dv > 21 || pv > dv) { back = h.bet * 2; h.res = 'win'; h.label = dv > 21 ? T('Croupier über 21 – gewonnen!') : T('Gewonnen!'); }
        else if (pv === dv) { back = h.bet; h.res = 'push'; h.label = T('Unentschieden'); }
        else { h.res = 'lose'; h.label = T('Verloren'); }
        net += back - h.bet;
        money(back);
      }
      rounds++;
      render();
      say(net > 0 ? '+' + net : net < 0 ? String(net) : '±0');
      if (net > 0 && params.tonGewinn) ctx.sound && ctx.sound(params.tonGewinn, 80);
      await wait(1700);
      if (done) return;
      if ((maxRounds && rounds >= maxRounds) || credits < minBet) return end();
      phase = 'bet'; bet = clamp(bet, minBet, Math.min(maxBet, credits)); hands = []; dc = []; msg.classList.remove('show'); render();
    };
    const end = () => {
      if (done) return;
      done = true; phase = 'over'; render(); ctrl.innerHTML = '';
      const net = credits - start, won = net > 0;
      const score = won ? clamp(0.6 + net / (minBet * 20), 0.6, 1) : clamp(0.5 + net / Math.max(minBet * 10, start || 1) / 2, 0, 0.49);
      const line = dealer ? foeLine(dealer, won ? 'niederlage' : 'sieg') : '';
      if (line) F.say(dName + ': „' + line + '“', 2600);
      F.finish({ score, ok: won, net }, net > 0 ? TF('Plus {n} {c}!', { n: net, c: curName }) : net < 0 ? TF('Minus {n} {c}', { n: -net, c: curName }) : T('Plus minus null'), resolve, params.ergebnis, dealer ? 2600 : 1800);
    };
    const onKey = (e) => {
      if (done) return;
      if (e.key === 'Enter' && phase === 'bet') { e.preventDefault(); e.stopPropagation(); deal(); }
    };
    window.addEventListener('keydown', onKey, true);
    const off = setInterval(() => { if (!document.body.contains(handsBox)) { clearInterval(off); window.removeEventListener('keydown', onKey, true); if (!done) { done = true; resolve({ score: 0, ok: false }); } } }, 500);
    if (dealer && foeLine(dealer, 'start')) F.say(dName + ': „' + foeLine(dealer, 'start') + '“');
    render();
  });

  // =====================================================================
  // Aussehen (eingebaut, im Plugin, damit es überall gleich aussieht)
  // =====================================================================
  const CSS = `
.sh-panel { gap: 0.8cqh; }
.sh-info { white-space: pre-line; font-size: 1.9cqh; min-height: 4.6cqh; }
.sh-area { height: 66cqh; background: #0d0b0a; }
.sh-cv { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: crosshair; }
.sh-billard .sh-cv { cursor: default; }
.sh-bubble { position: absolute; left: 50%; top: 6%; transform: translate(-50%, -10px); background: rgba(14,14,20,0.88); color: #fff; padding: 1.2cqh 2.4cqh; border-radius: 1.6cqh; font-size: 2.4cqh; font-weight: 600; opacity: 0; transition: opacity .25s, transform .25s; pointer-events: none; z-index: 5; max-width: 80%; text-align: center; box-shadow: 0 1cqh 3cqh rgba(0,0,0,0.5); }
.sh-bubble.show { opacity: 1; transform: translate(-50%, 0); }
.sh-score { position: absolute; right: 2.5%; top: 50%; transform: translateY(-50%); width: 30%; display: flex; flex-direction: column; gap: 1.2cqh; z-index: 3; }
.sh-srow { display: grid; grid-template-columns: 5.5cqh 1fr auto; grid-template-rows: auto auto; column-gap: 1.2cqh; align-items: center; padding: 1.2cqh 1.6cqh; border-radius: 1.4cqh; background: rgba(0,0,0,0.55); border: 0.25cqh solid transparent; color: #eee; }
.sh-srow.on { border-color: #e8c86a; background: rgba(40,30,10,0.75); }
.sh-srow .sh-ava { grid-row: 1 / 3; }
.sh-sname { font-size: 2.2cqh; font-weight: 600; }
.sh-sval { font-size: 4.4cqh; font-weight: 800; grid-row: 1 / 3; grid-column: 3; color: #ffe8a6; font-variant-numeric: tabular-nums; }
.sh-slast { font-size: 1.8cqh; opacity: 0.75; min-height: 2.2cqh; }
.sh-sround { text-align: center; font-size: 1.9cqh; color: #ddd; opacity: 0.85; }
.sh-ava { width: 5.5cqh; height: 5.5cqh; border-radius: 50%; background: #2a2a33 center / cover no-repeat; display: inline-flex; align-items: center; justify-content: center; font-size: 3cqh; }
.sh-slot { display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 30%, #3a1630, #120812) center / cover no-repeat; }
.sh-mwrap { position: relative; display: flex; align-items: center; height: 92%; }
.sh-mach { position: relative; height: 100%; aspect-ratio: 0.95; border-radius: 3cqh 3cqh 2cqh 2cqh; background: linear-gradient(160deg, color-mix(in srgb, var(--sh-c) 70%, #fff) , var(--sh-c) 45%, color-mix(in srgb, var(--sh-c) 60%, #000)); box-shadow: inset 0 0 0 0.6cqh color-mix(in srgb, var(--sh-a) 70%, #000), 0 2cqh 5cqh rgba(0,0,0,0.6); display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 3cqh 3cqh 2.4cqh; box-sizing: border-box; }
.sh-mach.img { background: center / contain no-repeat; box-shadow: none; padding: 0; display: block; }
.sh-mach.img .sh-window { position: absolute; }
.sh-mach.img .sh-mpanel { position: absolute; left: 8%; right: 8%; bottom: 3%; }
.sh-mach.flash { animation: sh-flash .9s ease-out; }
@keyframes sh-flash { 0%, 40% { filter: brightness(1.5) saturate(1.3); } 100% { filter: none; } }
.sh-lights { display: flex; gap: 1.1cqh; justify-content: center; flex-wrap: wrap; }
.sh-lights span { width: 1.4cqh; height: 1.4cqh; border-radius: 50%; background: var(--sh-a); box-shadow: 0 0 1.2cqh var(--sh-a); animation: sh-blink 1.2s infinite; }
.sh-lights span:nth-child(2n) { animation-delay: .6s; }
@keyframes sh-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
.sh-window { position: relative; width: 100%; flex: 1; margin: 2cqh 0; display: flex; gap: 0.6cqh; padding: 0.8cqh; border-radius: 1.6cqh; background: #111; box-shadow: inset 0 0 2cqh rgba(0,0,0,0.9), 0 0 0 0.5cqh var(--sh-a); box-sizing: border-box; }
.sh-reel { position: relative; flex: 1; overflow: hidden; border-radius: 1cqh; background: linear-gradient(#cfc8b8, #fffdf6 30%, #fffdf6 70%, #cfc8b8); }
.sh-reel.land { animation: sh-land .22s ease-out; }
@keyframes sh-land { 0% { transform: translateY(-3%); } 60% { transform: translateY(1.5%); } 100% { transform: none; } }
.sh-cell { position: absolute; left: 0; right: 0; top: 0; height: calc(100% / var(--sh-rows, 3)); display: flex; align-items: center; justify-content: center; font-size: calc(min(9cqh, 26cqh / var(--sh-rows, 3))); line-height: 1; }
.sh-cell img { max-width: 82%; max-height: 82%; object-fit: contain; pointer-events: none; }
.sh-cell.hit { background: rgba(255,214,90,0.45); box-shadow: inset 0 0 0 0.4cqh #f0b52a; }
.sh-lines { position: absolute; inset: 0.8cqh; width: calc(100% - 1.6cqh); height: calc(100% - 1.6cqh); pointer-events: none; }
.sh-lines polyline { fill: none; stroke: #ff3b6b; stroke-width: 1.4; vector-effect: non-scaling-stroke; stroke-linejoin: round; filter: drop-shadow(0 0 3px #ff3b6b); }
.sh-mpanel { width: 100%; display: flex; flex-direction: column; gap: 1.2cqh; }
.sh-leds { display: flex; gap: 1cqh; }
.sh-led { flex: 1; background: #0b0b0b; color: #ff5a3a; font: 700 2.6cqh ui-monospace, monospace; padding: 0.8cqh 1.2cqh; border-radius: 0.8cqh; text-shadow: 0 0 1cqh #ff5a3a; min-height: 3cqh; }
.sh-led.win { color: #7dff8a; text-shadow: 0 0 1cqh #7dff8a; text-align: right; }
.sh-btns { display: flex; gap: 1cqh; }
.sh-btns button { flex: 1; font: 700 2.3cqh system-ui, sans-serif; padding: 1.2cqh; border-radius: 1cqh; border: none; cursor: pointer; background: #2a2a30; color: #eee; }
.sh-btns .sh-spin { flex: 2; background: var(--sh-a); color: #2a1a05; box-shadow: 0 0.6cqh 0 color-mix(in srgb, var(--sh-a) 55%, #000); }
.sh-btns .sh-spin:active { transform: translateY(0.4cqh); box-shadow: 0 0.2cqh 0 color-mix(in srgb, var(--sh-a) 55%, #000); }
.sh-btns button:disabled { opacity: 0.45; cursor: default; }
.sh-lever { position: relative; width: 6cqh; height: 34cqh; margin-left: 1cqh; cursor: pointer; transform-origin: 50% 85%; }
.sh-lever:not(.img)::before { content: ''; position: absolute; left: 50%; bottom: 8%; width: 1.4cqh; height: 82%; transform: translateX(-50%); background: linear-gradient(90deg, #888, #eee, #888); border-radius: 0.7cqh; }
.sh-lever:not(.img)::after { content: ''; position: absolute; left: 0; bottom: 0; width: 100%; height: 14%; background: #333; border-radius: 1cqh; }
.sh-lever.img { background: center bottom / contain no-repeat; }
.sh-knob { position: absolute; left: 50%; top: 0; width: 5.4cqh; height: 5.4cqh; transform: translateX(-50%); border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ff8a8a, #c41d2b 60%, #6a0b14); box-shadow: 0 0.6cqh 1.2cqh rgba(0,0,0,0.5); }
.sh-lever.pull { animation: sh-pull .5s ease-in-out; }
@keyframes sh-pull { 0% { transform: none; } 40% { transform: scaleY(0.55); } 100% { transform: none; } }
.sh-paytable { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(0.96); background: rgba(10,10,14,0.95); border: 0.3cqh solid #e8c86a; border-radius: 2cqh; padding: 2cqh 3cqh; display: none; flex-direction: column; gap: 0.8cqh; z-index: 6; color: #eee; min-width: 40%; }
.sh-paytable.show { display: flex; }
.sh-prow { display: flex; justify-content: space-between; align-items: center; gap: 3cqh; font-size: 2.6cqh; }
.sh-psym { display: flex; gap: 0.6cqh; }
.sh-psym img { height: 3.4cqh; }
.sh-pval { font-weight: 700; color: #ffe8a6; }
.sh-pnote { font-size: 1.7cqh; opacity: 0.7; margin-top: 1cqh; max-width: 60cqh; }
`;
  const CSS_BJ = `
.sh-bj { display: flex; flex-direction: column; justify-content: space-between; padding: 2cqh 3cqh; box-sizing: border-box; background: radial-gradient(ellipse at 50% 35%, #1f7a4d, #0f4a2d 70%, #0a3320); color: #f5f1e6; }
.sh-bj-dealer, .sh-bj-hands { display: flex; flex-direction: column; align-items: center; gap: 1cqh; }
.sh-bj-hands { flex-direction: row; justify-content: center; gap: 4cqh; }
.sh-bj-who { display: flex; align-items: center; gap: 1.2cqh; font-size: 2.3cqh; }
.sh-bj-name { font-weight: 700; }
.sh-bj-val { background: rgba(0,0,0,0.45); padding: 0.3cqh 1.2cqh; border-radius: 2cqh; font-weight: 700; font-size: 2.2cqh; min-width: 3cqh; text-align: center; }
.sh-bj-val:empty { display: none; }
.sh-bj-cards { display: flex; min-height: 15cqh; }
.sh-bj-cards .sh-card + .sh-card { margin-left: -4.5cqh; }
.sh-card { position: relative; width: 10.4cqh; height: 15cqh; border-radius: 1cqh; background: #fdfbf6; color: #1b1b1b; box-shadow: 0 0.6cqh 1.4cqh rgba(0,0,0,0.45); font: 700 2.3cqh system-ui, sans-serif; animation: sh-deal .28s ease-out; flex: 0 0 auto; }
.sh-card.red { color: #c4232f; }
.sh-c-tl, .sh-c-br { position: absolute; line-height: 1; text-align: center; }
.sh-c-tl { left: 0.8cqh; top: 0.7cqh; } .sh-c-br { right: 0.8cqh; bottom: 0.7cqh; transform: rotate(180deg); }
.sh-c-mid { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 6cqh; }
.sh-card.back { background: repeating-linear-gradient(45deg, #8e1d2c 0 0.8cqh, #a52a3a 0.8cqh 1.6cqh); box-shadow: inset 0 0 0 0.7cqh #fdfbf6, 0 0.6cqh 1.4cqh rgba(0,0,0,0.45); }
.sh-card.back.img { background: center / cover no-repeat; box-shadow: 0 0.6cqh 1.4cqh rgba(0,0,0,0.45); }
@keyframes sh-deal { from { transform: translate(6cqh, -12cqh) rotate(-8deg); opacity: 0; } to { transform: none; opacity: 1; } }
.sh-bj-hand { display: flex; flex-direction: column; align-items: center; gap: 1cqh; padding: 1cqh 1.4cqh; border-radius: 1.6cqh; border: 0.3cqh solid transparent; }
.sh-bj-hand.on { border-color: #e8c86a; background: rgba(0,0,0,0.18); }
.sh-bj-hand.win .sh-bj-res { color: #9dffa8; } .sh-bj-hand.lose .sh-bj-res { color: #ff9a8a; } .sh-bj-hand.push .sh-bj-res { color: #ffe08a; }
.sh-bj-hand.lose .sh-bj-cards { opacity: 0.6; }
.sh-bj-hinfo { display: flex; gap: 1cqh; align-items: center; font-size: 2.1cqh; }
.sh-bj-bet { color: #ffd77a; font-weight: 700; }
.sh-bj-res { font-weight: 700; }
.sh-bj-msg { align-self: center; font: 800 4.6cqh system-ui, sans-serif; color: #ffe8a6; text-shadow: 0 0.4cqh 1cqh rgba(0,0,0,0.6); opacity: 0; min-height: 5cqh; }
.sh-bj-msg.show { animation: sh-pop .5s ease-out forwards; }
@keyframes sh-pop { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: none; } }
.sh-bj-bar { display: flex; align-items: center; justify-content: space-between; gap: 2cqh; }
.sh-bj-cred { font: 700 2.4cqh ui-monospace, monospace; color: #ffe8a6; background: rgba(0,0,0,0.45); padding: 0.8cqh 1.4cqh; border-radius: 1cqh; }
.sh-bj-ctrl { display: flex; gap: 1cqh; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.sh-bj-btn { font: 700 2.3cqh system-ui, sans-serif; padding: 1cqh 2cqh; border-radius: 1cqh; border: none; cursor: pointer; background: #f1ead7; color: #222; box-shadow: 0 0.5cqh 0 #9c9177; }
.sh-bj-btn.main { background: #e8c86a; box-shadow: 0 0.5cqh 0 #9a7a22; }
.sh-bj-btn.chip { border-radius: 50%; width: 7.4cqh; height: 7.4cqh; padding: 0; background: radial-gradient(circle, #fdfbf6 0 52%, #c4232f 53% 70%, #fdfbf6 71% 75%, #c4232f 76%); color: #6b0f17; font-size: 2.1cqh; box-shadow: 0 0.4cqh 0 #611; }
.sh-bj-btn.quiet { background: rgba(0,0,0,0.4); color: #eee; box-shadow: none; }
.sh-bj-btn:disabled { opacity: 0.4; cursor: default; }
.sh-bj-betv { font-weight: 700; font-size: 2.3cqh; min-width: 14cqh; text-align: center; }
`;
  const ensureCss = () => { if (document.getElementById('sh-css')) return; const s = document.createElement('style'); s.id = 'sh-css'; s.textContent = CSS + CSS_BJ; document.head.appendChild(s); };

  // =====================================================================
  // Anmeldung
  // =====================================================================
  const foeOpts = (game) => [['', '— allein —'], ...data().gegner.filter((g) => !g.spiel || g.spiel === 'beide' || g.spiel === game).map((g) => [g.id, g.name])];
  VNPlugin.register({
    id: ID,
    name: 'Spielhalle',
    version: '1.0',
    description: 'Dart, Billard, Blackjack und Spielautomat. Computer-Gegner mit einstellbarem Können, eigene Bilder für Scheibe, Tisch, Kugeln, Walzen und Gehäuse. Einstellungen unter Spielsysteme → Spielhalle.',
    designs: {
      dart: { label: 'Dart', icon: '🎯', images: [['bildBoard', 'Dartscheibe'], ['bildPfeil', 'Pfeil'], ['bildKreuz', 'Fadenkreuz'], ['bildHintergrund', 'Hintergrund']] },
      billard: { label: 'Billard', icon: '🎱', images: [['bildTisch', 'Ganzer Tisch (mit Banden)'], ['bildTuch', 'Tuch (Muster)'], ['bildQueue', 'Queue (Spitze rechts)'], ['bildWeiss', 'Weiße Kugel'], ...Array.from({ length: 15 }, (_, i) => ['kugel' + (i + 1), 'Kugel ' + (i + 1)])] },
      automat: { label: 'Spielautomat', icon: '🎰', images: [] },
      blackjack: { label: 'Blackjack', icon: '🃏', images: [['bildTisch', 'Tisch (Hintergrund)'], ['bildRueckseite', 'Kartenrückseite']] }
    },
    skillEffects: {
      dartRuhe: { cat: 'minigame', label: 'Dart: Fadenkreuz ruhiger', params: [['pct', '− %', 'number', 15]], key: () => 'spielhalle.dart.tempo', mode: 'pct', value: (e) => -(Number(e.pct) || 0), text: (e, l) => '−' + (Number(e.pct) || 0) * l + ' % Fadenkreuz-Tempo (Dart)' },
      blackjackTipps: { cat: 'minigame', label: 'Blackjack: Tipps vom Profi', params: [], key: () => 'spielhalle.blackjack.tipps', mode: 'add', value: () => 1, text: () => 'Blackjack: zeigt den besten Zug' },
      billardLinie: { cat: 'minigame', label: 'Billard: längere Hilfslinie', params: [['pct', '+ %', 'number', 50]], key: () => 'spielhalle.billard.linie', mode: 'pct', value: (e) => Number(e.pct) || 0, text: (e, l) => '+' + (Number(e.pct) || 0) * l + ' % Hilfslinie (Billard)' }
    },
    actions: {
      dart: {
        label: 'Dart', minigame: true,
        params: [
          { key: 'modus', label: 'Spielart', type: 'select', options: [['301', '301 (von 301 auf 0)'], ['501', '501 (von 501 auf 0)'], ['punkte', 'Höchste Punktzahl nach X Runden']], default: '301' },
          { key: 'doppelAus', label: '301/501: mit einem Doppel beenden', type: 'select', options: [['nein', 'Nein'], ['ja', 'Ja']], default: 'nein' },
          { key: 'runden', label: 'Runden (je 3 Pfeile, höchstens)', type: 'number', default: 8 },
          { key: 'gegner', label: 'Gegner (leer = allein)', type: 'select', get options() { return foeOpts('dart'); }, default: '' },
          { key: 'ziel', label: 'Allein, höchste Punktzahl: Punkte nötig', type: 'number', default: 300 },
          { key: 'wackeln', label: 'Fadenkreuz', type: 'select', options: [['ruhig', 'Ruhig'], ['mittel', 'Mittel'], ['wild', 'Wild'], ['extrem', 'Extrem']], default: 'mittel' },
          { key: 'hilfe', label: 'Mit Gegenstand ruhiger', type: 'item', default: '' },
          { key: 'titel', label: 'Titel (leer = „Dart“)', type: 'text', default: '' },
          { key: 'bildBoard', label: 'Bild Dartscheibe', type: 'image', default: '' },
          { key: 'boardGroesse', label: 'Eigene Scheibe: Doppel-Ring außen in % der Bildbreite', type: 'number', default: 80 },
          { key: 'bildPfeil', label: 'Bild Pfeil (Spitze unten links)', type: 'image', default: '' },
          { key: 'bildKreuz', label: 'Bild Fadenkreuz', type: 'image', default: '' },
          { key: 'bildHintergrund', label: 'Bild Hintergrund', type: 'image', default: '' },
          { key: 'tonTreffer', label: 'Ton beim Treffer', type: 'audio', default: '' },
          resultParam
        ],
        run: runDart
      },
      billard: {
        label: 'Billard', minigame: true,
        params: [
          { key: 'modus', label: 'Spielart', type: 'select', options: [['8ball', '8-Ball (Volle/Halbe, zum Schluss die 8)'], ['versenken', 'Wer mehr Kugeln versenkt']], default: 'versenken' },
          { key: 'kugeln', label: 'Kugeln (Wer mehr versenkt)', type: 'number', default: 10 },
          { key: 'gegner', label: 'Gegner (leer = allein)', type: 'select', get options() { return foeOpts('billard'); }, default: '' },
          { key: 'stoesse', label: 'Allein: alle versenken in höchstens … Stößen', type: 'number', default: 15 },
          { key: 'hilfslinie', label: 'Hilfslinie', type: 'select', options: [['lang', 'Lang'], ['kurz', 'Kurz'], ['aus', 'Aus']], default: 'kurz' },
          { key: 'titel', label: 'Titel (leer = „Billard“)', type: 'text', default: '' },
          { key: 'tuchfarbe', label: 'Farbe Tuch (z. B. #1f6e43)', type: 'text', default: '' },
          { key: 'randfarbe', label: 'Farbe Holzrand (z. B. #5b3a22)', type: 'text', default: '' },
          { key: 'bildTisch', label: 'Bild ganzer Tisch (mit Banden)', type: 'image', default: '' },
          { key: 'bildTuch', label: 'Bild Tuch (Muster)', type: 'image', default: '' },
          { key: 'bildQueue', label: 'Bild Queue (waagrecht, Spitze rechts)', type: 'image', default: '' },
          { key: 'bildWeiss', label: 'Bild weiße Kugel', type: 'image', default: '' },
          { key: 'tonStoss', label: 'Ton beim Stoß', type: 'audio', default: '' },
          resultParam
        ],
        run: runBillard
      },
      blackjack: {
        label: 'Blackjack', minigame: true,
        params: [
          { key: 'croupier', label: 'Croupier (Name, Bild und Sprüche aus den Gegnern)', type: 'select', get options() { return [['', '— Croupier —'], ...data().gegner.map((g) => [g.id, g.name])]; }, default: '' },
          { key: 'waehrung', label: 'Währung (leer = Spielgeld)', type: 'currency', default: '' },
          { key: 'guthaben', label: 'Spielgeld zu Beginn', type: 'number', default: 100 },
          { key: 'einsatz', label: 'Mindesteinsatz', type: 'number', default: 5 },
          { key: 'maxEinsatz', label: 'Höchsteinsatz', type: 'number', default: 50 },
          { key: 'runden', label: 'Runden höchstens (0 = bis „Aufhören“)', type: 'number', default: 0 },
          { key: 'decks', label: 'Kartenspiele im Schlitten', type: 'select', options: [['1', '1'], ['2', '2'], ['6', '6']], default: '2' },
          { key: 'soft17', label: 'Croupier bei weicher 17 (Ass + 6)', type: 'select', options: [['steht', 'steht'], ['zieht', 'zieht']], default: 'steht' },
          { key: 'auszahlung', label: 'Blackjack zahlt', type: 'select', options: [['3:2', '3:2'], ['6:5', '6:5']], default: '3:2' },
          { key: 'verdoppeln', label: 'Verdoppeln erlaubt', type: 'select', options: [['ja', 'Ja'], ['nein', 'Nein']], default: 'ja' },
          { key: 'teilen', label: 'Teilen erlaubt (gleiche Karten)', type: 'select', options: [['ja', 'Ja'], ['nein', 'Nein']], default: 'ja' },
          { key: 'tipps', label: 'Tipps zeigen (bester Zug)', type: 'select', options: [['aus', 'Aus'], ['an', 'An']], default: 'aus' },
          { key: 'hilfe', label: 'Mit Gegenstand Tipps', type: 'item', default: '' },
          { key: 'titel', label: 'Titel (leer = „Blackjack“)', type: 'text', default: '' },
          { key: 'bildTisch', label: 'Bild Tisch', type: 'image', default: '' },
          { key: 'bildRueckseite', label: 'Bild Kartenrückseite', type: 'image', default: '' },
          { key: 'tonKarte', label: 'Ton beim Austeilen', type: 'audio', default: '' },
          { key: 'tonGewinn', label: 'Ton bei Gewinn', type: 'audio', default: '' },
          resultParam
        ],
        run: runBlackjack
      },
      automat: {
        label: 'Spielautomat', minigame: true,
        params: [
          { key: 'automat', label: 'Automat', type: 'select', get options() { return data().automaten.map((a) => [a.id, a.name]); }, default: '' },
          { key: 'drehungen', label: 'Drehungen höchstens (0 = bis „Aufhören“)', type: 'number', default: 0 },
          { key: 'titel', label: 'Titel (leer = Name des Automaten)', type: 'text', default: '' },
          { key: 'tonDreh', label: 'Ton beim Drehen', type: 'audio', default: '' },
          { key: 'tonGewinn', label: 'Ton bei Gewinn', type: 'audio', default: '' },
          resultParam
        ],
        run: runAutomat
      }
    },
    editorTab: { label: 'Spielhalle', render: (body) => editor(body) },
    // Für Tests und eigene Erweiterungen
    _intern: { handVal, bjTip, dartScore, dartTarget, aiDartAim, physStep, rack, aiShot, strips, lines, evalSpin, rtp, consts: { BL, BW, BR, DEC, VMAX, POCKETS } }
  });

  // =====================================================================
  // Editor: Spielsysteme → Spielhalle
  // =====================================================================
  const editor = (body) => {
    const el = VN.el, d = data(), p = VN.project, ui = VN.ui;
    const tab = ui.shTab || 'gegner';
    const field = (label, input) => el('div', { class: 'field' }, el('div', { class: 'lbl' }, label), input);
    const sel = (v, opts, fn) => { const s = el('select', { onchange: (e) => VN.mutate(() => fn(e.target.value)) }); for (const [k, l] of opts) { const o = el('option', { value: k }, l); if (String(k) === String(v == null ? '' : v)) o.selected = true; s.appendChild(o); } return s; };
    const txt = (v, fn, ph) => el('input', { type: 'text', value: v || '', placeholder: ph || '', onchange: (e) => VN.mutate(() => fn(e.target.value)) });
    const nr = (v, fn, w, o) => el('input', Object.assign({ type: 'number', value: v, style: { width: (w || 70) + 'px' }, onchange: (e) => VN.mutate(() => fn(Number(e.target.value))) }, o || {}));
    const slider = (label, v, fn, hint) => {
      const out = el('span', { class: 'sh-val' }, String(v));
      return el('div', { class: 'field' }, el('div', { class: 'lbl' }, label, ' ', out),
        el('input', { type: 'range', min: 0, max: 100, step: 1, value: v, style: { width: '100%' }, oninput: (e) => { out.textContent = e.target.value; }, onchange: (e) => VN.mutate(() => fn(Number(e.target.value))) }),
        hint ? el('div', { class: 'muted small' }, hint) : null);
    };
    const tryIt = (ref, prm) => VNPlugin.tryAction(ID + '.' + ref, prm);
    body.appendChild(el('p', { class: 'muted' }, 'Die Spiele startest du mit den Aktionen „Spielhalle: Dart“, „Spielhalle: Billard“, „Spielhalle: Blackjack“ und „Spielhalle: Spielautomat“ – z. B. an einem Hub-Objekt (Dartscheibe in der Taverne) oder in einer Antwort. Wie bei allen Minispielen kannst du dort eine Szene für Sieg und Niederlage wählen.'));
    const tabs = el('div', { class: 'seg', style: { marginBottom: '10px' } },
      ...[['gegner', '🤖 Gegner'], ['automaten', '🎰 Spielautomaten'], ['spiele', '🎲 Dart, Billard, Blackjack']].map(([k, l]) => el('button', { class: 'btn tiny' + (tab === k ? ' primary' : ''), onclick: () => { ui.shTab = k; VN.render(); } }, l)));
    body.appendChild(tabs);
    const wrap = el('div', { class: 'loot-wrap' }), list = el('div', { class: 'loot-list' }), ed = el('div', { class: 'loot-ed' });
    wrap.append(list, ed);

    if (tab === 'spiele') {
      body.appendChild(el('div', { class: 'opt-card' },
        el('div', { class: 'sec-title' }, '🎯 Dart'),
        el('div', { class: 'muted small' }, 'Das Fadenkreuz schwebt über die Scheibe – im richtigen Moment klicken. Spielarten: 301 oder 501 (von oben auf 0, auf Wunsch mit einem Doppel zum Schluss) oder „höchste Punktzahl nach X Runden“. Mit Gegner abwechselnd je 3 Pfeile, allein gegen eine Punktzahl. Scheibe, Pfeil, Fadenkreuz und Hintergrund lassen sich durch eigene Bilder ersetzen (an der Aktion oder als Standard unter Design → Spielsysteme). Bei einer eigenen Scheibe gibst du an, wie groß der Doppel-Ring im Bild ist – danach wird gezählt.'),
        el('div', { class: 'row gap8', style: { marginTop: '6px' } }, el('button', { class: 'btn tiny primary', onclick: () => tryIt('dart', {}) }, '▶ ' + T('Dart allein ausprobieren')))));
      body.appendChild(el('div', { class: 'opt-card' },
        el('div', { class: 'sec-title' }, '🎱 Billard'),
        el('div', { class: 'muted small' }, 'Mit der Maus zielen, Maustaste drücken = anlegen, zurückziehen und nach vorn schwingen = stoßen. Je schneller der Schwung, desto härter der Stoß (Loslassen stößt mit der Kraft des Zurückziehens). Spielarten: 8-Ball (Volle/Halbe, zum Schluss die 8) oder „wer mehr Kugeln versenkt“. Tisch, Tuch, Queue und jede Kugel lassen sich gestalten – Kugeln 1–15 als Standard unter Design → Spielsysteme → Billard.'),
        el('div', { class: 'row gap8', style: { marginTop: '6px' } }, el('button', { class: 'btn tiny primary', onclick: () => tryIt('billard', {}) }, '▶ ' + T('Billard allein ausprobieren')),
          window.UiDesign ? el('button', { class: 'btn tiny', onclick: () => UiDesign.edit(ID + '.billard') }, '🎨 ' + T('Kugeln und Tisch gestalten')) : null)));
      body.appendChild(el('div', { class: 'opt-card' },
        el('div', { class: 'sec-title' }, '🃏 Blackjack'),
        el('div', { class: 'muted small' }, 'Näher an 21 als der Croupier, ohne drüber zu kommen. Ziehen, Stehen, Verdoppeln und Teilen; Blackjack zahlt 3:2 (oder 6:5). Einsatz in einer Währung deines Spiels oder mit Spielgeld. Als Croupier kannst du einen Gegner wählen – dann erscheinen sein Name, Bild und seine Sprüche. Mit „Tipps“ (oder einem Gegenstand bzw. Perk) zeigt das Spiel den besten Zug nach der Grundstrategie.'),
        el('div', { class: 'row gap8', style: { marginTop: '6px' } }, el('button', { class: 'btn tiny primary', onclick: () => tryIt('blackjack', {}) }, '▶ ' + T('Blackjack ausprobieren')),
          window.UiDesign ? el('button', { class: 'btn tiny', onclick: () => UiDesign.edit(ID + '.blackjack') }, '🎨 ' + T('Tisch und Karten gestalten')) : null)));
      return;
    }

    if (tab === 'gegner') {
      const g = d.gegner.find((x) => x.id === ui.shFoe) || d.gegner[0];
      for (const x of d.gegner) list.appendChild(el('div', { class: 'list-item' + (x === g ? ' active' : ''), onclick: () => { ui.shFoe = x.id; VN.render(); } }, x.bild ? el('span', { class: 'mini-thumb', style: { width: '22px', height: '22px', backgroundImage: `url("${VN.assetUrl(x.bild)}")` } }) : el('span', { class: 'dot', style: { background: '#6cc4ff' } }), el('span', { class: 'name' }, x.name)));
      list.appendChild(el('button', { class: 'btn', style: { marginTop: '6px' }, onclick: () => VN.mutate(() => { const n = newGegner(T('Neuer Gegner'), 'profi'); d.gegner.push(n); ui.shFoe = n.id; }) }, '+ ' + T('Gegner')));
      body.appendChild(wrap);
      if (!g) { ed.appendChild(el('div', { class: 'hint-box' }, 'Lege links einen Gegner an.')); return; }
      ed.append(
        el('div', { class: 'row gap8' }, field('Name', txt(g.name, (v) => { g.name = v || T('Gegner'); })),
          el('button', { class: 'btn danger', style: { alignSelf: 'flex-end' }, onclick: () => VN.mutate(() => { d.gegner = d.gegner.filter((x) => x !== g); ui.shFoe = null; }) }, T('Gegner löschen'))),
        el('div', { class: 'grid2' },
          field('Bild (Porträt)', VN.assetSelect('image', g.bild, (v) => VN.mutate(() => { g.bild = v || ''; }))),
          field('Spielt', sel(g.spiel || 'beide', [['beide', 'Dart und Billard'], ['dart', 'nur Dart'], ['billard', 'nur Billard']], (v) => { g.spiel = v; }))),
        el('div', { class: 'opt-card' },
          el('div', { class: 'sec-title' }, 'Können'),
          el('div', { class: 'row gap8', style: { flexWrap: 'wrap', marginBottom: '6px' } }, el('span', { class: 'muted small' }, 'Vorlage:'),
            ...Object.entries(PRESETS).map(([k, pr]) => el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { Object.assign(g, preset(k)); }) }, pr.label))),
          slider('Treffsicherheit', num(g.genau, 50), (v) => { g.genau = v; }, 'Dart: wie nah der Pfeil am Ziel landet · Billard: wie genau gezielt wird'),
          slider('Gefühl für die Stoßkraft (Billard)', num(g.kraft, 50), (v) => { g.kraft = v; }, 'Niedrig = Stöße oft zu hart oder zu weich'),
          slider('Taktik', num(g.taktik, 50), (v) => { g.taktik = v; }, 'Dart: rechnet den Rest aus und wählt das Doppel zum Schluss · Billard: wählt den leichtesten Stoß statt irgendeinen'),
          el('div', { class: 'row gap8' },
            field('Bedenkzeit (Sekunden)', nr(num(g.tempo, 1.5), (v) => { g.tempo = Math.max(0.2, v); }, 80, { step: 0.1, min: 0.2 })),
            field('Dart: Lieblingsziel', sel(g.ziel || 'auto', [['auto', 'Automatisch (nach Taktik)'], ['T20', 'Triple 20'], ['T19', 'Triple 19'], ['BULL', 'Bullseye'], ['MITTE', 'Einfach die Mitte']], (v) => { g.ziel = v; })))),
        el('div', { class: 'opt-card' },
          el('div', { class: 'sec-title' }, 'Sprüche (optional)'),
          field('Zu Beginn', txt(g.start, (v) => { g.start = v; }, 'Mal sehen, was du kannst!')),
          field('Wenn er/sie gewinnt', txt(g.sieg, (v) => { g.sieg = v; }, 'Übung macht den Meister.')),
          field('Wenn er/sie verliert', txt(g.niederlage, (v) => { g.niederlage = v; }, 'Revanche! Sofort!'))),
        el('div', { class: 'row gap8' },
          g.spiel !== 'billard' ? el('button', { class: 'btn primary', onclick: () => tryIt('dart', { gegner: g.id }) }, '▶ ' + TF('Dart gegen {name}', { name: g.name })) : null,
          g.spiel !== 'dart' ? el('button', { class: 'btn primary', onclick: () => tryIt('billard', { gegner: g.id }) }, '▶ ' + TF('Billard gegen {name}', { name: g.name })) : null,
          el('button', { class: 'btn', onclick: () => tryIt('blackjack', { croupier: g.id }) }, '▶ ' + TF('Blackjack mit {name} als Croupier', { name: g.name }))));
      return;
    }

    // Spielautomaten
    const m = d.automaten.find((x) => x.id === ui.shMach) || d.automaten[0];
    for (const x of d.automaten) list.appendChild(el('div', { class: 'list-item' + (x === m ? ' active' : ''), onclick: () => { ui.shMach = x.id; VN.render(); } }, el('span', { class: 'dot', style: { background: (x.design && x.design.farbe) || '#c33' } }), el('span', { class: 'name' }, x.name)));
    list.appendChild(el('button', { class: 'btn', style: { marginTop: '6px' }, onclick: () => VN.mutate(() => { const n = newAutomat(); n.name = T('Automat') + ' ' + (d.automaten.length + 1); d.automaten.push(n); ui.shMach = n.id; }) }, '+ ' + T('Automat')));
    body.appendChild(wrap);
    if (!m) { ed.appendChild(el('div', { class: 'hint-box' }, 'Lege links einen Automaten an.')); return; }
    m.design = m.design || {};
    const D = m.design;
    const symOpts = (m.symbole || []).map((s) => [s.id, (s.emoji || '') + ' ' + s.name]);
    const R = rtp(m, 40000);
    ed.append(
      el('div', { class: 'row gap8' }, field('Name', txt(m.name, (v) => { m.name = v || T('Automat'); })),
        el('button', { class: 'btn danger', style: { alignSelf: 'flex-end' }, onclick: () => VN.mutate(() => { d.automaten = d.automaten.filter((x) => x !== m); ui.shMach = null; }) }, T('Automat löschen'))),
      el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
        field('Walzen', sel(m.walzen || 3, [[3, '3'], [4, '4'], [5, '5']], (v) => { m.walzen = Number(v); })),
        field('Reihen sichtbar', sel(m.reihen || 3, [[1, '1'], [3, '3']], (v) => { m.reihen = Number(v); })),
        field('Gewinnlinien', sel(m.linien || 'drei', [['mitte', 'nur die Mitte'], ['drei', '3 waagrechte'], ['fuenf', '3 waagrechte + 2 schräge']], (v) => { m.linien = v; })),
        field('Einsatz pro Linie', nr(m.einsatz || 1, (v) => { m.einsatz = Math.max(1, Math.round(v)); }, 70, { min: 1 })),
        field('Währung', sel(m.waehrung || '', [['', 'Spielgeld (nur in der Runde)'], ...p.currencies.map((c) => [c.id, c.name])], (v) => { m.waehrung = v; })),
        !m.waehrung ? field('Spielgeld zu Beginn', nr(num(m.guthaben, 50), (v) => { m.guthaben = Math.max(0, Math.round(v)); }, 80)) : null),
      el('div', { class: 'hint-box' }, TF('Auszahlung im Schnitt ≈ {r} % des Einsatzes · Gewinn bei etwa {h} % der Drehungen', { r: R.rtp.toFixed(0), h: R.hit.toFixed(0) }), el('br'),
        el('span', { class: 'muted small' }, 'Unter 100 % verliert man auf Dauer (wie bei echten Automaten, meist 85–95 %), über 100 % gewinnt man. Ändern mit der Häufigkeit der Symbole und den Gewinnen.')));
    // Symbole
    const symCard = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Symbole auf den Walzen'),
      el('div', { class: 'muted small' }, 'Häufigkeit = wie oft das Symbol auf jeder Walze vorkommt. Ein Bild ersetzt das Emoji.'));
    const small = (n, w) => { n.style.width = w + 'px'; n.style.minWidth = '0'; n.style.flex = '0 0 auto'; return n; };
    symCard.appendChild(el('div', { class: 'logic-row muted small', style: { flexWrap: 'nowrap' } }, small(el('span', null, 'Emoji'), 46), small(el('span', null, 'Name'), 104), small(el('span', null, 'Bild'), 130), small(el('span', null, 'Häufigkeit'), 64)));
    (m.symbole || []).forEach((s, i) => symCard.appendChild(el('div', { class: 'logic-row', style: { flexWrap: 'nowrap' } },
      small(el('input', { type: 'text', value: s.emoji || '', style: { textAlign: 'center' }, onchange: (e) => VN.mutate(() => { s.emoji = e.target.value; }) }), 46),
      small(el('input', { type: 'text', value: s.name || '', onchange: (e) => VN.mutate(() => { s.name = e.target.value; }) }), 104),
      small(VN.assetSelect('image', s.bild, (v) => VN.mutate(() => { s.bild = v || ''; })), 130),
      small(nr(num(s.gewicht, 1), (v) => { s.gewicht = Math.max(0, Math.round(v)); }, 64, { min: 0 }), 64),
      el('label', { class: 'check', title: T('Joker – ersetzt jedes Symbol') }, el('input', { type: 'checkbox', checked: m.joker === s.id, onchange: (e) => VN.mutate(() => { m.joker = e.target.checked ? s.id : ''; }) }), 'Joker'),
      el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { m.symbole.splice(i, 1); m.gewinne = (m.gewinne || []).filter((x) => x.symbol !== s.id); if (m.joker === s.id) m.joker = ''; }) }, '×'))));
    symCard.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { m.symbole = m.symbole || []; m.symbole.push({ id: uid('sy'), name: T('Symbol'), emoji: '🍀', bild: '', gewicht: 3 }); }) }, '+ ' + T('Symbol')));
    // Gewinne
    const payCard = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Gewinne'),
      el('div', { class: 'muted small' }, 'Gleiche Symbole auf einer Linie, von links gezählt. Gewinn = Faktor × Einsatz pro Linie.'));
    (m.gewinne || []).forEach((e, i) => payCard.appendChild(el('div', { class: 'logic-row' },
      nr(num(e.anzahl, 3), (v) => { e.anzahl = clamp(Math.round(v), 1, 6); }, 50, { min: 1, max: 6 }), el('span', { class: 'muted small' }, '×'),
      sel(e.symbol, symOpts, (v) => { e.symbol = v; }),
      el('span', { class: 'muted small' }, '→ ' + T('Faktor')), nr(num(e.faktor, 1), (v) => { e.faktor = Math.max(0, v); }, 70, { min: 0 }),
      el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { m.gewinne.splice(i, 1); }) }, '×'))));
    payCard.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { m.gewinne = m.gewinne || []; m.gewinne.push({ symbol: (m.symbole[0] || {}).id || '', anzahl: num(m.walzen, 3), faktor: 10 }); }) }, '+ ' + T('Gewinn')));
    // Aussehen
    const col = (v, fn) => el('input', { type: 'color', value: v, onchange: (e) => VN.mutate(() => fn(e.target.value)) });
    const look = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Aussehen'),
      el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
        field('Titel im Spiel (leer = Name)', txt(D.titel, (v) => { D.titel = v; })),
        field('Farbe Gehäuse', col(D.farbe || '#7a1f2b', (v) => { D.farbe = v; })),
        field('Farbe Lichter und Knopf', col(D.akzent || '#e8c86a', (v) => { D.akzent = v; }))),
      el('div', { class: 'grid2' },
        field('Hintergrund hinter dem Automaten', VN.assetSelect('image', D.hintergrund, (v) => VN.mutate(() => { D.hintergrund = v || ''; }))),
        field('Hebel (Bild)', VN.assetSelect('image', D.hebel, (v) => VN.mutate(() => { D.hebel = v || ''; })))),
      field('Eigenes Gehäuse (Bild, ersetzt das eingebaute)', VN.assetSelect('image', D.gehaeuse, (v) => VN.mutate(() => { D.gehaeuse = v || ''; }))),
      D.gehaeuse ? el('div', null, el('div', { class: 'muted small' }, 'Wo im Gehäuse-Bild sitzt das Fenster für die Walzen? (in % von links/oben, Breite, Höhe)'),
        el('div', { class: 'row gap8' }, ...[['fx', 'Links'], ['fy', 'Oben'], ['fw', 'Breite'], ['fh', 'Höhe']].map(([k, l]) => field(l + ' %', nr(num(D[k], { fx: 14, fy: 30, fw: 72, fh: 40 }[k]), (v) => { D[k] = clamp(v, 0, 100); }, 64))))) : null);
    ed.append(symCard, payCard, look, el('div', { class: 'row gap8' }, el('button', { class: 'btn primary', onclick: () => tryIt('automat', { automat: m.id }) }, '▶ ' + T('Automat ausprobieren'))));
  };

})();
