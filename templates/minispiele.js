// Mitgeliefertes Plugin: Minispiele
// Klick-Reflex, Memory, Puzzle, Kochen & Brauen, Münzwurf, Blütenblätter zupfen.
// Jedes Minispiel liefert ein Ergebnis { score: 0…1, ok } – für Jobs (Lohn), Beziehungen oder Pfade.
// Bilder sind überall austauschbar (leer = eingebaute Grafik). Du darfst die Datei frei ändern.
(function () {
  const ID = 'minispiele';
  const data = () => {
    const p = VN.project;
    p.pluginData = p.pluginData || {};
    const d = p.pluginData[ID] = p.pluginData[ID] || {};
    d.recipes = d.recipes || [];
    return d;
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // Ergebnis in eine Variable schreiben (Zahl 0–100 oder Schalter)
  const store = (ctx, varId, res) => {
    if (!varId) return;
    const v = ctx.project.vars.find((x) => x.id === varId);
    ctx.vars.set(varId, v && v.type === 'flag' ? res.ok : Math.round(res.score * 100));
  };
  const img = (ctx, id) => (id ? ctx.asset(id) : '');
  const resultParam = { key: 'ergebnis', label: 'Ergebnis in', type: 'var', default: '' };
  // Gemeinsamer Rahmen: Titel, Info-Zeile, Spielfläche, Abschluss
  // Bild-Vorrang: Bild an der Aktion > Standard-Bild im Design (Design → Spielsysteme) > eingebaute Grafik
  const pic = (ctx, game, k, params) => (ctx.design ? ctx.design(ID + '.' + game).image(k, params[k]) : img(ctx, params[k]));
  const frame = (ctx, title, width, game) => {
    const el = ctx.el;
    const o = ctx.overlay({ width: width || '60%' });
    o.el.classList.add('mg-panel');
    if (ctx.design && game) ctx.design(ID + '.' + game).apply(o.el);
    const head = el('div', { class: 'mg-title' }, title);
    const info = el('div', { class: 'mg-info' });
    const area = el('div', { class: 'mg-area' });
    o.el.append(head, info, area);
    const finish = (res, text, resolve, varId) => new Promise((r) => {
      head.textContent = text;
      head.classList.add(res.ok ? 'win' : 'lose');
      store(ctx, varId, res);
      setTimeout(() => { o.close(); r(); resolve(res); }, 1500);
    });
    return { o, el, head, info, area, finish };
  };
  const SYMBOLS = ['🔑', '💎', '🍄', '🌙', '⭐', '🔥', '🍀', '🐉', '🎲', '🎭', '🦉', '🍎'];

  VNPlugin.register({
    id: ID,
    name: 'Minispiele',
    version: '1.2',
    description: 'Sechs Minispiele mit Ergebnis (0–100 % oder geschafft/nicht geschafft): Klick-Reflex, Memory, Puzzle, Kochen & Brauen, Münzwurf, Blütenblätter.',
    // Aussehen je Minispiel (Design → Spielsysteme, oder Rechtsklick aufs Fenster im Probelauf)
    designs: {
      reflex: { label: 'Klick-Reflex', icon: '🎯', images: [['bildZiel', 'Ziel'], ['bildFalle', 'Falle']] },
      memory: { label: 'Memory', icon: '🃏', images: [['rueckseite', 'Kartenrückseite'], ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => ['bild' + i, 'Bild ' + i])] },
      puzzle: { label: 'Puzzle', icon: '🧩', images: [['bild', 'Puzzle-Bild (sonst aktueller Hintergrund)']] },
      kochen: { label: 'Kochen & Brauen', icon: '🍲', images: [['bildTopf', 'Topf / Kessel']] },
      muenze: { label: 'Münzwurf', icon: '🪙', images: [['bildKopf', 'Kopf'], ['bildZahl', 'Zahl']] },
      bluete: { label: 'Blütenblätter', icon: '🌼', images: [['bildBlatt', 'Blütenblatt'], ['bildMitte', 'Mitte']] }
    },
    actions: {
      // ---------- Klick-Reflex ----------
      reflex: {
        label: 'Klick-Reflex', minigame: true,
        params: [
          { key: 'tempo', label: 'Tempo', type: 'select', options: [['leicht', 'Leicht'], ['mittel', 'Mittel'], ['schwer', 'Schwer']], default: 'mittel' },
          { key: 'dauer', label: 'Dauer (s)', type: 'number', default: 15 },
          { key: 'gleichzeitig', label: 'Gleichzeitig', type: 'number', default: 2 },
          { key: 'fallen', label: 'Fallen %', type: 'number', default: 15 },
          { key: 'steigend', label: 'Wird schneller', type: 'select', options: [['ja', 'Ja'], ['nein', 'Nein']], default: 'ja' },
          { key: 'bildZiel', label: 'Bild Ziel', type: 'image', default: '' },
          { key: 'bildFalle', label: 'Bild Falle', type: 'image', default: '' },
          resultParam
        ],
        run(params, ctx) {
          return new Promise((resolve) => {
            const F = frame(ctx, 'Schnell klicken!', null, 'reflex');
            const life = { leicht: 1.6, mittel: 1.1, schwer: 0.75 }[params.tempo] || 1.1;
            const dur = Math.max(5, Number(params.dauer) || 15) * 1000;
            const max = Math.max(1, Math.min(6, Number(params.gleichzeitig) || 2));
            const trapP = Math.max(0, Math.min(80, Number(params.fallen) || 0)) / 100;
            let hits = 0, spawned = 0, traps = 0, t0 = performance.now(), done = false;
            F.area.classList.add('mg-reflex');
            const bar = F.el('div', { class: 'mg-timebar' }, F.el('span'));
            F.o.el.insertBefore(bar, F.area);
            const upd = () => { F.info.textContent = 'Treffer: ' + hits + (traps ? '   ·   Fallen erwischt: ' + traps : ''); };
            upd();
            const spawn = () => {
              if (done) return;
              const live = F.area.querySelectorAll('.mg-target:not(.gone)').length;
              if (live >= max) return;
              const trap = Math.random() < trapP;
              const k = (params.steigend !== 'nein') ? 1 - 0.45 * Math.min(1, (performance.now() - t0) / dur) : 1;
              const n = F.el('div', { class: 'mg-target' + (trap ? ' trap' : ''), style: { left: rnd(4, 84) + '%', top: rnd(6, 78) + '%' } });
              const im = pic(ctx, 'reflex', trap ? 'bildFalle' : 'bildZiel', params);
              if (im) n.style.backgroundImage = `url("${im}")`; else n.textContent = trap ? '💣' : '★';
              if (!trap) spawned++;
              n.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                if (n.classList.contains('gone')) return;
                n.classList.add('gone', 'hit');
                if (trap) { traps++; F.area.animate([{ transform: 'translateX(-1cqh)' }, { transform: 'translateX(1cqh)' }, { transform: 'none' }], { duration: 200 }); } else { hits++; ctx.sound && ctx.sound('sfx_schloss_klick', 60); }
                upd();
                setTimeout(() => n.remove(), 250);
              });
              F.area.appendChild(n);
              setTimeout(() => { if (!n.classList.contains('gone')) { n.classList.add('gone'); setTimeout(() => n.remove(), 250); } }, life * k * 1000);
            };
            const iv = setInterval(spawn, 380);
            const tick = () => {
              if (done) return;
              const f = (performance.now() - t0) / dur;
              bar.firstChild.style.width = Math.max(0, 100 - f * 100) + '%';
              if (f >= 1) {
                done = true; clearInterval(iv);
                const score = Math.max(0, Math.min(1, (hits - traps) / Math.max(1, spawned * 0.8)));
                const res = { score, ok: score >= 0.5 };
                F.finish(res, res.ok ? 'Stark! ' + hits + ' Treffer' : 'Zu langsam … ' + hits + ' Treffer', resolve, params.ergebnis);
                return;
              }
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
        }
      },

      // ---------- Memory ----------
      memory: {
        label: 'Memory', minigame: true,
        params: [
          { key: 'paare', label: 'Paare', type: 'number', default: 6 },
          { key: 'zuege', label: 'Max. Züge (0 = egal)', type: 'number', default: 0 },
          { key: 'zeit', label: 'Zeit s (0 = egal)', type: 'number', default: 0 },
          { key: 'zeigen', label: 'Am Anfang kurz zeigen', type: 'select', options: [['nein', 'Nein'], ['ja', 'Ja']], default: 'nein' },
          { key: 'rueckseite', label: 'Rückseite', type: 'image', default: '' },
          ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ key: 'bild' + i, label: 'Bild ' + i, type: 'image', default: '' })),
          resultParam
        ],
        run(params, ctx) {
          return new Promise((resolve) => {
            const pairs = Math.max(2, Math.min(12, Number(params.paare) || 6));
            const F = frame(ctx, 'Memory', '64%', 'memory');
            const faces = [];
            for (let i = 0; i < pairs; i++) { const im = pic(ctx, 'memory', 'bild' + (i + 1), params); faces.push(im ? { im } : { sym: SYMBOLS[i % SYMBOLS.length] }); }
            const cards = shuffle([...faces.keys(), ...faces.keys()]);
            const cols = pairs <= 4 ? 4 : pairs <= 6 ? 4 : pairs <= 8 ? 4 : 6;
            F.area.classList.add('mg-memory');
            F.area.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            const back = pic(ctx, 'memory', 'rueckseite', params);
            let open = [], found = 0, moves = 0, lock = false, done = false;
            const t0 = performance.now(), limit = Number(params.zeit) || 0, maxMoves = Number(params.zuege) || 0;
            const upd = () => { F.info.textContent = 'Paare: ' + found + ' / ' + pairs + '   ·   Züge: ' + moves + (maxMoves ? ' / ' + maxMoves : '') + (limit ? '   ·   Zeit: ' + Math.max(0, Math.ceil(limit - (performance.now() - t0) / 1000)) + ' s' : ''); };
            const end = () => {
              if (done) return; done = true;
              const eff = found === pairs ? Math.max(0.4, Math.min(1, 1 - Math.max(0, moves - pairs) / (pairs * 2.5))) : found / pairs * 0.5;
              const res = { score: eff, ok: found === pairs };
              F.finish(res, res.ok ? 'Alle Paare gefunden!' : 'Vorbei – ' + found + ' von ' + pairs + ' Paaren', resolve, params.ergebnis);
            };
            const els = cards.map((k) => {
              const f = faces[k];
              const c = F.el('div', { class: 'mg-card' },
                F.el('div', { class: 'mg-back', style: back ? { backgroundImage: `url("${back}")` } : null }, back ? '' : '?'),
                F.el('div', { class: 'mg-face', style: f.im ? { backgroundImage: `url("${f.im}")` } : null }, f.im ? '' : f.sym));
              c.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                if (lock || done || c.classList.contains('up')) return;
                c.classList.add('up'); open.push([c, k]);
                if (open.length === 2) {
                  moves++;
                  const [[a, ka], [b, kb]] = open; open = [];
                  if (ka === kb) { found++; a.classList.add('ok'); b.classList.add('ok'); if (found === pairs) setTimeout(end, 400); }
                  else { lock = true; setTimeout(() => { a.classList.remove('up'); b.classList.remove('up'); lock = false; }, 800); }
                  if (maxMoves && moves >= maxMoves && found < pairs) setTimeout(end, 900);
                  upd();
                }
              });
              F.area.appendChild(c);
              return c;
            });
            upd();
            if (params.zeigen === 'ja') { lock = true; els.forEach((c) => c.classList.add('up')); setTimeout(() => { els.forEach((c) => c.classList.remove('up')); lock = false; }, 1600); }
            if (limit) { const iv = setInterval(() => { if (done) return clearInterval(iv); upd(); if ((performance.now() - t0) / 1000 >= limit) { clearInterval(iv); end(); } }, 250); }
          });
        }
      },

      // ---------- Puzzle ----------
      puzzle: {
        label: 'Puzzle', minigame: true,
        params: [
          { key: 'bild', label: 'Bild (leer = aktueller Hintergrund)', type: 'image', default: '' },
          { key: 'teile', label: 'Teile pro Reihe', type: 'number', default: 3 },
          { key: 'form', label: 'Form', type: 'select', options: [['klassisch', 'Puzzleteile'], ['quadrat', 'Quadrate']], default: 'klassisch' },
          { key: 'drehen', label: 'Teile gedreht', type: 'select', options: [['nein', 'Nein'], ['ja', 'Ja (Rechtsklick dreht)']], default: 'nein' },
          { key: 'vorschau', label: 'Vorschau', type: 'select', options: [['ja', 'Ja'], ['nein', 'Nein']], default: 'ja' },
          { key: 'zeit', label: 'Zeit s (0 = egal)', type: 'number', default: 0 },
          resultParam
        ],
        run(params, ctx) {
          return new Promise((resolve) => {
            const F = frame(ctx, 'Puzzle', '74%', 'puzzle');
            const n = Math.max(2, Math.min(8, Number(params.teile) || 3));
            const run = window.Player && Player.state;
            const url = pic(ctx, 'puzzle', 'bild', params) || (run && run.bg ? VN.assetUrl(run.bg) : '');
            const im = new Image();
            if (/^vnasset:/i.test(url) || /^https?:/i.test(location.protocol)) im.crossOrigin = 'anonymous';
            F.info.textContent = 'Lade Bild …';
            const start = () => {
              const A = (im.naturalWidth && im.naturalHeight) ? im.naturalWidth / im.naturalHeight : 16 / 9;
              F.area.classList.add('mg-puzzle');
              // Brett links, Ablage rundherum: alles in Prozent der Fläche
              const board = F.el('div', { class: 'mg-board' });
              F.area.appendChild(board);
              const BW = 56, BH = BW / A * (F.area.clientWidth / Math.max(1, F.area.clientHeight));
              Object.assign(board.style, { left: (100 - BW) / 2 + '%', top: Math.max(2, (100 - BH) / 2) + '%', width: BW + '%', height: BH + '%' });
              if (params.vorschau !== 'nein') board.style.backgroundImage = `url("${url}")`;
              const W = F.area.clientWidth, H = F.area.clientHeight;
              const bw = W * BW / 100, bh = H * BH / 100, pw = bw / n, ph = bh / n, bx = W * (100 - BW) / 200, by = H * parseFloat(board.style.top) / 100;
              const classic = params.form !== 'quadrat';
              // Nasen: für jede innere Kante zufällig rein/raus
              const hz = [], vt = [];
              for (let r = 0; r < n; r++) { hz[r] = []; vt[r] = []; for (let c = 0; c < n; c++) { hz[r][c] = Math.random() < 0.5 ? 1 : -1; vt[r][c] = Math.random() < 0.5 ? 1 : -1; } }
              const tab = Math.min(pw, ph) * 0.22;
              const edge = (g, x0, y0, x1, y1, s) => {
                if (!classic || !s) { g.lineTo(x1, y1); return; }
                const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy * s, ny = ux * s;
                const P = (t, o) => [x0 + dx * t + nx * o, y0 + dy * t + ny * o];
                g.lineTo(...P(0.36, 0));
                g.bezierCurveTo(...P(0.4, tab * 0.2), ...P(0.3, tab * 1.1), ...P(0.5, tab * 1.1));
                g.bezierCurveTo(...P(0.7, tab * 1.1), ...P(0.6, tab * 0.2), ...P(0.64, 0));
                g.lineTo(x1, y1);
              };
              const pieces = [];
              const pad = classic ? tab * 1.3 : 0;
              const done = { v: false };
              let placed = 0;
              const t0 = performance.now(), limit = Number(params.zeit) || 0;
              const upd = () => { F.info.textContent = 'Teile: ' + placed + ' / ' + n * n + (limit ? '   ·   Zeit: ' + Math.max(0, Math.ceil(limit - (performance.now() - t0) / 1000)) + ' s' : '') + (params.drehen === 'ja' ? '   ·   Rechtsklick dreht' : ''); };
              const finish = (all) => { if (done.v) return; done.v = true; const res = { score: all ? 1 : placed / (n * n) * 0.8, ok: all }; F.finish(res, all ? 'Fertig!' : 'Zeit um – ' + placed + ' von ' + n * n + ' Teilen', resolve, params.ergebnis); };
              for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
                const cv = document.createElement('canvas');
                const cw = pw + pad * 2, ch = ph + pad * 2;
                cv.width = Math.ceil(cw); cv.height = Math.ceil(ch);
                const g = cv.getContext('2d');
                g.beginPath(); g.moveTo(pad, pad);
                edge(g, pad, pad, pad + pw, pad, r === 0 ? 0 : -vt[r - 1][c]);
                edge(g, pad + pw, pad, pad + pw, pad + ph, c === n - 1 ? 0 : hz[r][c]);
                edge(g, pad + pw, pad + ph, pad, pad + ph, r === n - 1 ? 0 : vt[r][c]);
                edge(g, pad, pad + ph, pad, pad, c === 0 ? 0 : -hz[r][c - 1]);
                g.closePath();
                g.save(); g.clip();
                if (im.naturalWidth) g.drawImage(im, -c * pw + pad, -r * ph + pad, bw, bh); else { g.fillStyle = `hsl(${(r * n + c) * 37 % 360},50%,45%)`; g.fillRect(0, 0, cw, ch); }
                g.restore();
                g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.stroke();
                cv.className = 'mg-piece';
                const home = { x: bx + c * pw - pad, y: by + r * ph - pad };
                const rot = params.drehen === 'ja' ? [0, 90, 180, 270][Math.floor(Math.random() * 4)] : 0;
                const side = Math.random() < 0.5;
                const pos = { x: side ? rnd(0, Math.max(1, bx - cw * 0.6)) : rnd(bx + bw - cw * 0.4, W - cw), y: rnd(0, H - ch) };
                const pc = { cv, home, pos, rot, ok: false };
                const put = () => { Object.assign(cv.style, { left: pc.pos.x + 'px', top: pc.pos.y + 'px', width: cw + 'px', height: ch + 'px', transform: 'rotate(' + pc.rot + 'deg)' }); };
                put();
                cv.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); if (pc.ok || params.drehen !== 'ja') return; pc.rot = (pc.rot + 90) % 360; put(); });
                cv.addEventListener('mousedown', (e) => {
                  if (e.button !== 0 || pc.ok || done.v) return;
                  e.stopPropagation(); e.preventDefault();
                  const sx = e.clientX, sy = e.clientY, ox = pc.pos.x, oy = pc.pos.y;
                  const k = W / F.area.getBoundingClientRect().width;
                  cv.style.zIndex = 50;
                  const mv = (ev) => { pc.pos.x = ox + (ev.clientX - sx) * k; pc.pos.y = oy + (ev.clientY - sy) * k; put(); };
                  const up = () => {
                    window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
                    cv.style.zIndex = '';
                    if (pc.rot === 0 && Math.hypot(pc.pos.x - home.x, pc.pos.y - home.y) < Math.min(pw, ph) * 0.28) {
                      pc.pos = { x: home.x, y: home.y }; pc.ok = true; put(); cv.classList.add('ok'); placed++; upd();
                      ctx.sound && ctx.sound('sfx_schloss_klick', 50);
                      if (placed === n * n) setTimeout(() => finish(true), 300);
                    }
                  };
                  window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
                });
                F.area.appendChild(cv);
                pieces.push(pc);
              }
              upd();
              if (limit) { const iv = setInterval(() => { if (done.v) return clearInterval(iv); upd(); if ((performance.now() - t0) / 1000 >= limit) { clearInterval(iv); finish(false); } }, 250); }
            };
            im.onload = () => requestAnimationFrame(start);
            im.onerror = () => requestAnimationFrame(start);
            if (url) im.src = url; else requestAnimationFrame(start);
          });
        }
      },

      // ---------- Kochen & Brauen ----------
      kochen: {
        label: 'Kochen & Brauen', minigame: true,
        params: [
          { key: 'look', label: 'Aussehen', type: 'select', options: [['kueche', 'Küche (Topf)'], ['alchemie', 'Alchemie (Kessel)']], default: 'kueche' },
          { key: 'modus', label: 'Ablauf', type: 'select', options: [['einfach', 'Einfach: Zutaten rein, fertig'], ['ablauf', 'Mit Schritten (schneiden, rühren, Hitze)']], default: 'ablauf' },
          { key: 'bildTopf', label: 'Bild Topf/Kessel', type: 'image', default: '' },
          resultParam
        ],
        run(params, ctx) {
          return new Promise((resolve) => {
            const d = data(), p = ctx.project, rs = ctx.state;
            const alch = params.look === 'alchemie';
            const F = frame(ctx, alch ? 'Alchemie-Tisch' : 'Küche', '70%', 'kochen');
            F.o.el.classList.add(alch ? 'mg-alch' : 'mg-kitchen');
            rs.recipesKnown = rs.recipesKnown || {};
            for (const r of d.recipes) if (r.known) rs.recipesKnown[r.id] = true;
            const ingIds = new Set(d.recipes.flatMap((r) => r.ingredients || []));
            let pot = [];
            const potIm = pic(ctx, 'kochen', 'bildTopf', params);
            const draw = () => {
              F.area.innerHTML = '';
              F.area.className = 'mg-area mg-cook';
              const shelf = F.el('div', { class: 'mg-shelf' }, F.el('div', { class: 'mg-sub' }, 'Zutaten'));
              const have = p.items.filter((it) => (ingIds.has(it.id) || it.cook) && (rs.inv[it.id] || 0) - pot.filter((x) => x === it.id).length > 0);
              for (const it of have) shelf.appendChild(F.el('button', { class: 'mg-ing', onclick: (e) => { e.stopPropagation(); pot.push(it.id); draw(); } },
                it.image ? F.el('span', { class: 'mg-ico', style: { backgroundImage: `url("${VN.assetUrl(it.image)}")` } }) : F.el('span', { class: 'mg-ico ph' }, (it.name || '?').slice(0, 2)),
                F.el('span', null, VN.tr(it.id + ':name', it.name) + ' ×' + ((rs.inv[it.id] || 0) - pot.filter((x) => x === it.id).length))));
              if (!have.length) shelf.appendChild(F.el('div', { class: 'mg-sub' }, 'Keine Zutaten im Inventar.'));
              const potEl = F.el('div', { class: 'mg-pot', style: potIm ? { backgroundImage: `url("${potIm}")` } : null }, potIm ? '' : (alch ? '⚗' : '🍲'),
                F.el('div', { class: 'mg-potlist' }, ...pot.map((id, i) => { const it = p.items.find((x) => x.id === id); return F.el('span', { class: 'mg-in', onclick: (e) => { e.stopPropagation(); pot.splice(i, 1); draw(); } }, (it ? it.name : '?') + ' ×'); })));
              const book = F.el('div', { class: 'mg-book' }, F.el('div', { class: 'mg-sub' }, alch ? 'Rezeptbuch der Tränke' : 'Kochbuch'),
                ...d.recipes.map((r) => {
                  const known = rs.recipesKnown[r.id];
                  const res = p.items.find((x) => x.id === r.result);
                  return F.el('div', { class: 'mg-rec' + (known ? '' : ' unk') }, known ? (res ? res.name : r.name) + ': ' + (r.ingredients || []).map((id) => (p.items.find((x) => x.id === id) || {}).name || '?').join(' + ') : '??? (' + (r.ingredients || []).length + ' Zutaten)');
                }));
              F.area.append(shelf, F.el('div', { class: 'mg-mid' }, potEl, F.el('div', { class: 'row gap8', style: { justifyContent: 'center' } },
                F.el('button', { class: 'btn primary', disabled: !pot.length, onclick: (e) => { e.stopPropagation(); cook(); } }, alch ? 'Brauen' : 'Kochen'),
                F.el('button', { class: 'btn', onclick: (e) => { e.stopPropagation(); F.o.close(); resolve({ score: 0, ok: false }); } }, 'Aufhören'))), book);
              F.info.textContent = 'Klicke Zutaten an, um sie hineinzugeben. Klick im Topf nimmt sie wieder heraus.';
            };
            const same = (a, b) => a.length === b.length && a.slice().sort().join('|') === b.slice().sort().join('|');
            const cook = async () => {
              const r = d.recipes.find((x) => same(x.ingredients || [], pot));
              for (const id of pot) { rs.inv[id] = (rs.inv[id] || 0) - 1; if (rs.inv[id] <= 0) delete rs.inv[id]; }
              let score = r ? 1 : 0;
              if (r && params.modus !== 'einfach') score = await steps(r.steps && r.steps.length ? r.steps : ['schneiden', 'ruehren', 'hitze']);
              const q = !r ? 'fail' : score >= 0.85 ? 'perfect' : score >= 0.4 ? 'good' : 'fail';
              const outId = q === 'perfect' && r.perfect ? r.perfect : q === 'fail' ? (r && r.fail) || d.fail : r.result;
              if (outId) ctx.items.give(outId, 1);
              if (r && q !== 'fail') rs.recipesKnown[r.id] = true;
              const out = p.items.find((x) => x.id === outId);
              const res = { score: q === 'fail' ? Math.min(score, 0.3) : score, ok: q !== 'fail' };
              F.area.innerHTML = '';
              F.area.className = 'mg-area mg-cookres';
              F.area.append(F.el('div', { class: 'mg-big' }, q === 'perfect' ? '✨' : q === 'good' ? (alch ? '🧪' : '🍲') : '💨'),
                F.el('div', { class: 'mg-sub' }, q === 'perfect' ? 'Perfekt!' : q === 'good' ? 'Gut gelungen.' : !r ? (alch ? 'Es blubbert seltsam … das war kein Rezept.' : 'Das ergibt nur Matsch.') : 'Missraten …'),
                out ? F.el('div', { class: 'mg-get' }, '+ ' + VN.tr(out.id + ':name', out.name)) : null);
              F.finish(res, q === 'fail' ? 'Missraten' : 'Fertig: ' + (out ? out.name : ''), resolve, params.ergebnis);
            };
            // Schritte: Schneiden (Timing), Rühren (Takt), Hitze halten (gedrückt halten)
            const steps = async (list) => {
              const sc = [];
              for (const s of list) sc.push(await step(s));
              return sc.reduce((a, b) => a + b, 0) / sc.length;
            };
            const step = (kind) => new Promise((res) => {
              F.area.innerHTML = '';
              F.area.className = 'mg-area mg-step';
              const lab = { schneiden: '🔪 Schneiden: klicke, wenn das Messer über der Markierung ist (3×)', ruehren: '🥄 Rühren: klicke im Takt, wenn der Kreis aufleuchtet (6×)', hitze: '🔥 Hitze: halte die Maus gedrückt und bleib im grünen Bereich' }[kind] || kind;
              F.info.textContent = lab;
              const track = F.el('div', { class: 'mg-track' });
              F.area.appendChild(track);
              if (kind === 'schneiden') {
                let hits = 0, tries = 0, x = 0, dir = 1, mark = rnd(20, 80), stop = false;
                const knife = F.el('div', { class: 'mg-knife' }, '🔪'), mk = F.el('div', { class: 'mg-mark', style: { left: mark + '%' } });
                track.append(mk, knife);
                const tk = () => { if (stop) return; x += dir * 1.6; if (x > 100 || x < 0) dir = -dir; knife.style.left = x + '%'; requestAnimationFrame(tk); };
                requestAnimationFrame(tk);
                F.area.onmousedown = (e) => { e.stopPropagation(); tries++; const d = Math.abs(x - mark); if (d < 6) { hits += d < 2.5 ? 1 : 0.7; mk.classList.add('hit'); } mark = rnd(15, 85); mk.style.left = mark + '%'; if (tries >= 3) { stop = true; F.area.onmousedown = null; res(Math.min(1, hits / 3)); } };
              } else if (kind === 'ruehren') {
                const ring = F.el('div', { class: 'mg-ring' });
                track.appendChild(ring);
                let beats = 0, good = 0, last = performance.now(), litAt = 0, stop = false;
                const per = 900;
                const tk = (now) => { if (stop) return; if (now - last > per) { last = now; litAt = now; ring.classList.add('lit'); setTimeout(() => ring.classList.remove('lit'), 260); } requestAnimationFrame(tk); };
                requestAnimationFrame(tk);
                F.area.onmousedown = (e) => { e.stopPropagation(); beats++; const d = Math.min(Math.abs(performance.now() - litAt), Math.abs(performance.now() - (litAt + per))); good += d < 120 ? 1 : d < 240 ? 0.6 : 0; ring.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(120deg)' }], { duration: 200 }); if (beats >= 6) { stop = true; F.area.onmousedown = null; res(Math.min(1, good / 6)); } };
              } else {
                let heat = 0, held = false, inZone = 0, t = 0, stop = false, last = performance.now();
                const lo = rnd(45, 60), hi = lo + 18;
                const zone = F.el('div', { class: 'mg-zone', style: { left: lo + '%', width: (hi - lo) + '%' } }), needle = F.el('div', { class: 'mg-needle' });
                const hb = F.el('div', { class: 'mg-hbar' });
                track.append(zone, hb, needle);
                F.area.onmousedown = (e) => { e.stopPropagation(); held = true; };
                window.addEventListener('mouseup', () => { held = false; }, { once: false });
                const tk = (now) => {
                  if (stop) return;
                  const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
                  heat = Math.max(0, Math.min(100, heat + (held ? 38 : -30) * dt));
                  needle.style.left = heat + '%'; hb.style.width = heat + '%';
                  if (heat >= lo && heat <= hi) inZone += dt;
                  if (t >= 5) { stop = true; F.area.onmousedown = null; res(Math.min(1, inZone / 3.2)); return; }
                  requestAnimationFrame(tk);
                };
                requestAnimationFrame(tk);
              }
            });
            draw();
          });
        }
      },

      // ---------- Münzwurf ----------
      muenze: {
        label: 'Münzwurf', minigame: true,
        params: [
          { key: 'modus', label: 'Zufall', type: 'select', options: [['fair', 'Fair 50:50'], ['gewichtet', 'Gewichtet'], ['kopf', 'Immer Kopf'], ['zahl', 'Immer Zahl']], default: 'fair' },
          { key: 'chance', label: 'Chance Kopf % (gewichtet)', type: 'number', default: 50 },
          { key: 'einsatz', label: 'Einsatz (0 = keiner)', type: 'number', default: 0 },
          { key: 'waehrung', label: 'Währung', type: 'currency', default: '' },
          { key: 'bildKopf', label: 'Bild Kopf', type: 'image', default: '' },
          { key: 'bildZahl', label: 'Bild Zahl', type: 'image', default: '' },
          resultParam
        ],
        run(params, ctx) {
          return new Promise((resolve) => {
            const F = frame(ctx, 'Kopf oder Zahl?', '44%', 'muenze');
            const bet = Math.max(0, Number(params.einsatz) || 0);
            const cur = ctx.project.currencies.find((c) => c.id === params.waehrung) || ctx.project.currencies[0];
            if (bet && cur && ctx.money.get(cur.id) < bet) { F.info.textContent = 'Du hast nicht genug für den Einsatz.'; F.o.el.appendChild(ctx.el('button', { class: 'btn', onclick: () => { F.o.close(); resolve({ score: 0, ok: false }); } }, 'Zurück')); return; }
            F.info.textContent = bet && cur ? 'Einsatz: ' + bet + ' ' + cur.name : 'Wähle eine Seite';
            const face = (k) => { const im = pic(ctx, 'muenze', k === 'kopf' ? 'bildKopf' : 'bildZahl', params); return F.el('div', { class: 'mg-coinface ' + k, style: im ? { backgroundImage: `url("${im}")` } : null }, im ? '' : (k === 'kopf' ? '👑' : '10')); };
            const coin = F.el('div', { class: 'mg-coin' }, face('kopf'), face('zahl'));
            F.area.classList.add('mg-coinarea');
            F.area.appendChild(coin);
            const choose = (pick) => {
              btns.remove();
              const pK = params.modus === 'kopf' ? 1 : params.modus === 'zahl' ? 0 : params.modus === 'gewichtet' ? Math.max(0, Math.min(100, Number(params.chance) || 50)) / 100 : 0.5;
              const side = Math.random() < pK ? 'kopf' : 'zahl';
              const turns = 6 + Math.floor(Math.random() * 3);
              const end = turns * 360 + (side === 'zahl' ? 180 : 0);
              coin.animate([{ transform: 'translateY(0) rotateX(0deg)' }, { transform: 'translateY(-14cqh) rotateX(' + end / 2 + 'deg)', offset: 0.5 }, { transform: 'translateY(0) rotateX(' + end + 'deg)' }], { duration: 1600, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' });
              setTimeout(() => {
                const ok = side === pick;
                if (bet && cur) ctx.money.add(cur.id, ok ? bet : -bet);
                F.info.textContent = (side === 'kopf' ? 'Kopf' : 'Zahl') + '!' + (bet && cur ? (ok ? '  + ' : '  − ') + bet + ' ' + cur.name : '');
                F.finish({ score: ok ? 1 : 0, ok }, ok ? 'Gewonnen!' : 'Verloren', resolve, params.ergebnis);
              }, 1700);
            };
            const btns = F.el('div', { class: 'row gap8', style: { justifyContent: 'center' } },
              F.el('button', { class: 'btn primary mg-big-btn', onclick: (e) => { e.stopPropagation(); choose('kopf'); } }, 'Kopf'),
              F.el('button', { class: 'btn primary mg-big-btn', onclick: (e) => { e.stopPropagation(); choose('zahl'); } }, 'Zahl'));
            F.o.el.appendChild(btns);
          });
        }
      },

      // ---------- Blütenblätter zupfen ----------
      bluete: {
        label: 'Blütenblätter zupfen', minigame: true,
        params: [
          { key: 'modus', label: 'Zufall', type: 'select', options: [['fair', 'Fair 50:50'], ['gewichtet', 'Gewichtet'], ['ja', 'Endet immer mit Text 1'], ['nein', 'Endet immer mit Text 2']], default: 'fair' },
          { key: 'chance', label: 'Chance Text 1 % (gewichtet)', type: 'number', default: 50 },
          { key: 'text1', label: 'Text 1', type: 'text', default: 'Liebt mich' },
          { key: 'text2', label: 'Text 2', type: 'text', default: 'Liebt mich nicht' },
          { key: 'bildBlatt', label: 'Bild Blütenblatt', type: 'image', default: '' },
          { key: 'bildMitte', label: 'Bild Mitte', type: 'image', default: '' },
          resultParam
        ],
        run(params, ctx) {
          return new Promise((resolve) => {
            const F = frame(ctx, 'Klicke die Blütenblätter ab', '46%', 'bluete');
            const t1 = params.text1 || 'Liebt mich', t2 = params.text2 || 'Liebt mich nicht';
            // Gewünschtes Ende würfeln, dann die Blattzahl passend wählen (ungerade = endet mit Text 1)
            const p1 = params.modus === 'ja' ? 1 : params.modus === 'nein' ? 0 : params.modus === 'gewichtet' ? Math.max(0, Math.min(100, Number(params.chance) || 50)) / 100 : 0.5;
            const want1 = Math.random() < p1;
            let count = 5 + Math.floor(Math.random() * 8);
            if ((count % 2 === 1) !== want1) count += 1;
            const flower = F.el('div', { class: 'mg-flower' });
            F.area.classList.add('mg-flowerarea');
            F.area.appendChild(flower);
            const leaf = pic(ctx, 'bluete', 'bildBlatt', params), mid = pic(ctx, 'bluete', 'bildMitte', params);
            let left = count, n = 0;
            const say = F.el('div', { class: 'mg-say' }, ' ');
            F.o.el.insertBefore(say, F.area);
            for (let i = 0; i < count; i++) {
              const a = i / count * 360;
              const pet = F.el('div', { class: 'mg-petal', style: Object.assign({ transform: `rotate(${a}deg)` }, leaf ? { background: `url("${leaf}") center / contain no-repeat`, border: '0' } : {}) });
              pet.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                if (pet.classList.contains('off')) return;
                pet.classList.add('off');
                pet.animate([{ transform: `rotate(${a}deg)`, opacity: 1 }, { transform: `translateY(${rnd(18, 34)}cqh) rotate(${a + rnd(-90, 90)}deg)`, opacity: 0 }], { duration: 900, fill: 'forwards', easing: 'ease-in' });
                n++; left--;
                say.textContent = n % 2 ? t1 + ' …' : t2 + ' …';
                if (!left) {
                  const ok = n % 2 === 1;
                  say.textContent = (ok ? t1 : t2) + '!';
                  F.finish({ score: ok ? 1 : 0, ok }, ok ? '♥ ' + t1 + '!' : t2 + ' …', resolve, params.ergebnis);
                }
              });
              flower.appendChild(pet);
            }
            flower.appendChild(F.el('div', { class: 'mg-center', style: mid ? { background: `url("${mid}") center / contain no-repeat` } : null }));
            F.info.textContent = 'Wie viele Blätter es sind, siehst du erst am Ende.';
          });
        }
      }
    },
    hooks: {},
    // Reiter „Minispiele“: Rezepte für Kochen & Brauen
    // Für Probeläufe im Editor: sinnvolle Startwerte (Puzzle-Bild, Zutaten zum Kochen)
    tryPrepare(key, params, rs) {
      const p = VN.project;
      if (key === 'puzzle' && !params.bild && !(window.UiDesign && UiDesign.imageId(ID + '.puzzle', 'bild'))) {
        const bg = p.assets.find((x) => x.kind === 'image' && /bg|hintergrund|keller|hof|gilde/i.test(x.name + x.file)) || p.assets.find((x) => x.kind === 'image');
        if (bg) params.bild = bg.id;
      }
      if (key === 'kochen') for (const r of data().recipes) for (const id of r.ingredients || []) rs.inv[id] = (rs.inv[id] || 0) + 2;
    },
    editorTab: {
      label: 'Minispiele',
      render(body) {
        const el = VN.el, d = data(), p = VN.project;
        const self = VNPlugin.plugins[ID];
        const GAMES = [
          ['reflex', '🎯', 'Objekte ploppen auf und müssen schnell angeklickt werden. Mit Fallen, die man nicht treffen darf.', 'Tempo, Dauer, Anzahl gleichzeitig, Fallen, wird schneller, eigene Bilder'],
          ['memory', '🃏', 'Kartenpaare finden – mit deinen eigenen Bildern.', 'Anzahl Paare, Zug- oder Zeitlimit, Karten kurz zeigen, Rückseite und bis zu 8 Bilder'],
          ['puzzle', '🧩', 'Ein Bild wird automatisch zerschnitten und gemischt. Ohne eigenes Bild nimmt es den aktuellen Hintergrund.', 'Teile pro Reihe, Puzzleteile oder Quadrate, Drehen, Vorschau, Zeitlimit'],
          ['kochen', '🍲', 'Zutaten aus dem Inventar in Topf oder Kessel, dann schneiden, rühren und Hitze halten. Mit Rezeptbuch.', 'Küche oder Alchemie, einfach oder mit Schritten, eigenes Topf-Bild · Rezepte unten'],
          ['muenze', '🪙', 'Kopf oder Zahl – fair, gewichtet oder vom Drehbuch festgelegt. Optional mit Geld-Einsatz.', 'Zufall, Chance, Einsatz und Währung, Bilder für beide Seiten'],
          ['bluete', '🌼', '„Liebt mich, liebt mich nicht“ – die Blattzahl sorgt für ein echtes 50:50.', 'Zufall, eigene Texte, Bilder für Blatt und Mitte']
        ];
        body.appendChild(el('p', { class: 'muted' }, 'Sechs Minispiele. Du startest sie über „+ Aktion“ → „Minispiele: …“ – in einer Antwort, an einem Hub-Objekt, in einem Dialog oder als Minispiel eines Jobs. Einstellungen und Bilder wählst du direkt an der Aktion. Jedes Spiel liefert ein Ergebnis von 0–100 % (Feld „Ergebnis in“ → Variable).'));
        const grid = el('div', { class: 'mg-cards' });
        for (const [key, icon, desc, opts] of GAMES) {
          const a = self && self.actions[key];
          if (!a) continue;
          grid.appendChild(el('div', { class: 'mg-cardx' },
            el('div', { class: 'mgx-ico' }, icon),
            el('div', { class: 'mgx-main' },
              el('strong', null, a.label),
              el('div', { class: 'muted small' }, desc),
              el('div', { class: 'mgx-opts' }, 'Einstellbar: ' + opts)),
            el('div', { class: 'col gap4' },
              el('button', { class: 'btn tiny primary', onclick: () => tryGame(key) }, '▶ Ausprobieren'),
              window.UiDesign ? el('button', { class: 'btn tiny', title: 'Rahmen, Hintergrund und Standard-Bilder', onclick: () => UiDesign.edit(ID + '.' + key) }, '🎨 Design') : null)));
        }
        body.appendChild(grid);
        // Rezepte für Kochen & Brauen
        const items = [['', '—'], ...p.items.map((i) => [i.id, i.name])];
        const sel = (v, fn, w) => { const s = el('select', { style: { width: w || '150px' }, onchange: (e) => VN.mutate(() => fn(e.target.value)) }); for (const [k, l] of items) { const o = el('option', { value: k }, l); if (k === (v || '')) o.selected = true; s.appendChild(o); } return s; };
        const card = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, '🍲 Rezepte für „Kochen & Brauen“'));
        for (const r of d.recipes) {
          card.appendChild(el('div', { class: 'mg-recipe-ed' },
            el('div', { class: 'logic-row' },
              el('input', { type: 'text', value: r.name, style: { width: '170px' }, onchange: (e) => VN.mutate(() => { r.name = e.target.value || 'Rezept'; }) }),
              el('span', { class: 'muted small' }, 'Zutaten'),
              ...(r.ingredients || []).map((id, i) => el('span', { class: 'row gap4' }, sel(id, (v) => { if (v) r.ingredients[i] = v; else r.ingredients.splice(i, 1); }, '130px'))),
              el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { r.ingredients.push((p.items[0] || {}).id || ''); }) }, '+ Zutat'),
              el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { d.recipes = d.recipes.filter((x) => x !== r); }) }, '×')),
            el('div', { class: 'logic-row' },
              el('span', { class: 'muted small' }, 'Ergebnis'), sel(r.result, (v) => { r.result = v; }),
              el('span', { class: 'muted small' }, 'bei perfekt'), sel(r.perfect, (v) => { r.perfect = v; }),
              el('span', { class: 'muted small' }, 'missraten'), sel(r.fail, (v) => { r.fail = v; }),
              el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!r.known, onchange: (e) => VN.mutate(() => { r.known = e.target.checked; }) }), 'von Anfang an bekannt'))));
        }
        if (!d.recipes.length) card.appendChild(el('div', { class: 'muted small' }, 'Noch keine Rezepte. Ohne Rezept ergibt Kochen immer „Matsch“.'));
        card.appendChild(el('div', { class: 'row gap8' },
          el('button', { class: 'btn', onclick: () => VN.mutate(() => { d.recipes.push({ id: 'rz_' + Math.random().toString(36).slice(2, 7), name: 'Neues Rezept', ingredients: [], result: '', perfect: '', fail: '', known: false, steps: [] }); }) }, '+ Rezept'),
          el('span', { class: 'muted small' }, 'Missraten ohne eigenes Ergebnis:'), sel(d.fail, (v) => { d.fail = v; }),
          el('span', { class: 'muted small' }, '(z. B. ein Gegenstand „Matsch“)')));
        card.appendChild(el('div', { class: 'muted small' }, 'Unbekannte Rezepte stehen im Spiel als „???“ im Buch. Gelingt ein Gericht oder Trank zum ersten Mal, trägt es sich selbst ein.'));
        body.appendChild(card);

        // Ein Minispiel im Editor ausprobieren (in einem Fenster in Spielgröße)
        function tryGame(key) {
          if (VNPlugin.tryAction) { VNPlugin.tryAction(ID + '.' + key); return; }
          // ältere Engine ohne Probelauf-Funktion
          const def = self.actions[key];
          const params = {};
          for (const pa of def.params || []) params[pa.key] = pa.default != null ? pa.default : '';
          const rs = VN.newRunState();
          self.tryPrepare(key, params, rs);
          const host = el('div', { class: 'shop-preview-host mg-try' });
          const note = el('div', { class: 'muted small', style: { textAlign: 'center' } }, 'Probelauf – verändert nichts am Projekt.');
          const back = el('div', { class: 'modal-back' }, el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' } }, host, note,
            el('button', { class: 'btn', style: { alignSelf: 'center' }, onclick: () => back.remove() }, 'Schließen')));
          document.body.appendChild(back);
          const ctx = VNPlugin.makeCtx(rs);
          ctx.overlay = (opts = {}) => { const panel = el('div', { class: 'plugin-panel' }); if (opts.width) panel.style.width = opts.width; host.appendChild(panel); return { el: panel, root: host, close: () => panel.remove() }; };
          ctx.vars.set = () => {};
          Promise.resolve(def.run(params, ctx)).then((r) => { const res = VNPlugin.result(r); note.textContent = 'Ergebnis: ' + Math.round(res.score * 100) + ' % · ' + (res.ok ? 'geschafft' : 'nicht geschafft') + ' (Probelauf)'; });
        }
      }
    }
  });
})();
