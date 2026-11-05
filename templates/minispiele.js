// Mitgeliefertes Plugin: Minispiele
// Klick-Reflex, Memory, Puzzle, Kochen & Brauen, Münzwurf, Blütenblätter zupfen, Quicktime-Kreis, Tresor, Rohre.
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
  const T = (t) => (VN.t ? VN.t(t) : t);
  const TF = (t, o) => (VN.tf ? VN.tf(t, o) : t.replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m)));
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
  // Kurzer Klick-Ton ohne Datei (Tresor, Rohre)
  let actx = null;
  const clack = (vol, freq) => {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(freq || 2000, t); o.frequency.exponentialRampToValueAtTime((freq || 2000) / 3, t + 0.035);
      g.gain.setValueAtTime(Math.max(0.0001, (vol == null ? 0.5 : vol) * 0.22 * (VN.settings && VN.settings.sfx != null ? VN.settings.sfx / 100 : 1)), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.06);
    } catch (e) { /* kein Ton */ }
  };
  // Rohre: zufälliges, immer lösbares Feld (Weg von links nach rechts, Rest Füllteile, alles verdreht)
  const pipeField = (n) => {
    // N=1, O=2, S=4, W=8 – Drehen im Uhrzeigersinn schiebt die Bits weiter
    const DIRS = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];
    const OPP = { 1: 4, 2: 8, 4: 1, 8: 2 };
    const rot = (m, k) => { for (let i = 0; i < ((k % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15; return m; };
    const r0 = Math.floor(rnd(0, n)), r1 = Math.floor(rnd(0, n));
    // Weg von links nach rechts (zufällige Tiefensuche, leicht nach rechts gezogen)
    const seen = new Set(), path = [];
    const dfs = (x, y) => {
      seen.add(x + ',' + y); path.push([x, y]);
      if (x === n - 1 && y === r1) return true;
      const ds = shuffle(DIRS.slice()).sort((a, b) => (b[0] > 0 ? 0.6 : 0) - (a[0] > 0 ? 0.6 : 0) + rnd(-0.5, 0.5));
      for (const [dx, dy] of ds) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n || seen.has(nx + ',' + ny)) continue; if (dfs(nx, ny)) return true; }
      path.pop(); return false;
    };
    dfs(0, r0);
    const cells = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) cells.push({ x, y, base: 0, r: 0, deg: 0, path: false });
    const at = (x, y) => (x < 0 || y < 0 || x >= n || y >= n ? null : cells[y * n + x]);
    const bitTo = (a, b) => DIRS.find(([dx, dy]) => a[0] + dx === b[0] && a[1] + dy === b[1])[2];
    path.forEach((p, i) => {
      const c = at(p[0], p[1]); c.path = true;
      let m = i === 0 ? 8 : bitTo(p, path[i - 1]);
      m |= i === path.length - 1 ? 2 : bitTo(p, path[i + 1]);
      c.base = m;
    });
    const SHAPES = [5, 3, 7, 15]; // Gerade, Kurve, T, Kreuz (Grundform zeigt nach oben)
    for (const c of cells) if (!c.path) { const k = Math.random(); c.base = k < 0.38 ? 5 : k < 0.75 ? 3 : k < 0.93 ? 7 : 15; c.base = rot(c.base, Math.floor(rnd(0, 4))); }
    // Grundform und Drehung bestimmen, dann mischen
    for (const c of cells) {
      const shape = SHAPES.find((s) => [0, 1, 2, 3].some((k) => rot(s, k) === c.base));
      c.shape = shape; c.r = [0, 1, 2, 3].find((k) => rot(shape, k) === c.base);
      const mix = Math.floor(rnd(0, 4)); c.r = (c.r + mix) % 4; c.deg = c.r * 90;
    }
    const mask = (c) => rot(c.shape, c.r);
    const flow = () => {
      const vis = new Set(), q = [];
      const s = at(0, r0);
      if (mask(s) & 8) { vis.add(s); q.push(s); }
      while (q.length) {
        const c = q.shift(), m = mask(c);
        for (const [dx, dy, b] of DIRS) { if (!(m & b)) continue; const d = at(c.x + dx, c.y + dy); if (d && !vis.has(d) && (mask(d) & OPP[b])) { vis.add(d); q.push(d); } }
      }
      const e = at(n - 1, r1);
      return { vis, done: vis.has(e) && !!(mask(e) & 2) };
    };
    if (flow().done) { const c = at(0, r0); c.r = (c.r + 1) % 4; c.deg += 90; }
    return { cells, path, r0, r1, at, flow, mask, rot };
  };
  const SYMBOLS = ['🔑', '💎', '🍄', '🌙', '⭐', '🔥', '🍀', '🐉', '🎲', '🎭', '🦉', '🍎'];

  VNPlugin.register({
    id: ID,
    name: 'Minispiele',
    version: '1.5',
    description: 'Neun Minispiele mit Ergebnis (0–100 % oder geschafft/nicht geschafft): Klick-Reflex, Memory, Puzzle, Kochen & Brauen, Münzwurf, Blütenblätter, Quicktime-Kreis, Tresor, Rohre.',
    // Aussehen je Minispiel (Design → Spielsysteme, oder Rechtsklick aufs Fenster im Probelauf)
    designs: {
      reflex: { label: 'Klick-Reflex', icon: '🎯', images: [['bildZiel', 'Ziel'], ['bildFalle', 'Falle']] },
      memory: { label: 'Memory', icon: '🃏', images: [['rueckseite', 'Kartenrückseite'], ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => ['bild' + i, 'Bild ' + i])] },
      puzzle: { label: 'Puzzle', icon: '🧩', images: [['bild', 'Puzzle-Bild (sonst aktueller Hintergrund)']] },
      kochen: { label: 'Kochen & Brauen', icon: '🍲', images: [['bildTopf', 'Topf / Kessel']] },
      muenze: { label: 'Münzwurf', icon: '🪙', images: [['bildKopf', 'Kopf'], ['bildZahl', 'Zahl']] },
      bluete: { label: 'Blütenblätter', icon: '🌼', images: [['bildBlatt', 'Blütenblatt'], ['bildMitte', 'Mitte']] },
      zeiger: { label: 'Quicktime-Kreis', icon: '⏱', images: [['bildScheibe', 'Scheibe'], ['bildZeiger', 'Zeiger']] },
      tresor: { label: 'Tresor / Zahlenschloss', icon: '🔐', images: [['bildTuer', 'Tresortür'], ['bildRad', 'Drehrad'], ['bildInnen', 'Im offenen Tresor'], ['bildTastenfeld', 'Tastenfeld (Hintergrund)'], ['bildTaste', 'Taste'], ['bildSchloss', 'Zahlenschloss (Hintergrund)']],
        colors: [['gehaeuse', 'Gehäuse', '#4a4f57'], ['tuer', 'Tür', '#6b727c'], ['rad', 'Drehrad', '#1c1e22'], ['zahlen', 'Zahlen auf dem Rad', '#e9edf2'], ['marke', 'Markierung', '#e8a43a'], ['anzeige', 'Ziffern der Anzeige', '#7dff8a'], ['anzeigeBg', 'Hintergrund der Anzeige', '#0b0c0e'], ['taste', 'Tasten', '#4a4f57'], ['tasteText', 'Schrift auf Tasten', '#f0f0f0'], ['schloss', 'Zahlenschloss', '#c9a24a']] },
      rohre: { label: 'Rohre verbinden', icon: '🚰', images: [['bildHintergrund', 'Hintergrund'], ['bildGerade', 'Gerade (oben–unten)'], ['bildKurve', 'Kurve (oben–rechts)'], ['bildT', 'T-Stück (oben–rechts–unten)'], ['bildKreuz', 'Kreuzung'], ['bildQuelle', 'Anfang der Leitung'], ['bildZiel', 'Ende der Leitung']],
        colors: [['rohr', 'Rohr / Kabel', '#8b97a3'], ['leer', 'Innen (leer)', '#1b2229'], ['fluss', 'Gefüllt (Wasser, Strom …)', '#3fa9ff'], ['feld', 'Felder', '#ffffff']] }
    },
    // Perks für Skilltrees und Ausrüstung (Spielsysteme → Skilltrees / Gegenstand „Boni, solange getragen“)
    skillEffects: {
      zeigerZone: { cat: 'minigame', label: 'Quicktime-Kreis: größere Trefferfläche', params: [['pct', '+ %', 'number', 20]], key: () => 'minispiele.zeiger.zone', mode: 'pct', value: (e) => Number(e.pct) || 0, text: (e, l) => '+' + (Number(e.pct) || 0) * l + ' % Trefferfläche (Quicktime-Kreis)' },
      zeigerLangsam: { cat: 'minigame', label: 'Quicktime-Kreis: Zeiger langsamer', params: [['pct', '− %', 'number', 15]], key: () => 'minispiele.zeiger.tempo', mode: 'pct', value: (e) => -(Number(e.pct) || 0), text: (e, l) => '−' + (Number(e.pct) || 0) * l + ' % Zeiger-Tempo (Quicktime-Kreis)' },
      rohreZeit: { cat: 'minigame', label: 'Rohre: mehr Zeit', params: [['pct', '+ %', 'number', 25]], key: () => 'minispiele.rohre.zeit', mode: 'pct', value: (e) => Number(e.pct) || 0, text: (e, l) => '+' + (Number(e.pct) || 0) * l + ' % Zeit (Rohre)' },
      zeigerFehler: { cat: 'minigame', label: 'Quicktime-Kreis: mehr Fehlversuche', params: [['amount', '+', 'number', 1]], key: () => 'minispiele.zeiger.fehler', mode: 'add', value: (e) => Number(e.amount) || 0, text: (e, l) => '+' + (Number(e.amount) || 0) * l + ' Fehlversuch(e) (Quicktime-Kreis)' }
    },
    actions: {
      // ---------- Quicktime-Kreis ----------
      // Ein Zeiger dreht sich, im richtigen Moment die Taste drücken, wenn er in der markierten Fläche steht.
      // Nach jedem Treffer springt die Fläche an eine neue Stelle.
      zeiger: {
        label: 'Quicktime-Kreis', minigame: true,
        params: [
          { key: 'schwierigkeit', label: 'Schwierigkeit', type: 'select', options: [['leicht', 'Leicht'], ['mittel', 'Mittel'], ['schwer', 'Schwer'], ['extrem', 'Extrem']], default: 'mittel' },
          { key: 'treffer', label: 'Treffer nötig', type: 'number', default: 5 },
          { key: 'fehler', label: 'Fehlversuche erlaubt', type: 'number', default: 2 },
          { key: 'tempo', label: 'Tempo Umdrehungen/Min (0 = wie Schwierigkeit)', type: 'number', default: 0 },
          { key: 'flaeche', label: 'Trefferfläche Grad (0 = wie Schwierigkeit)', type: 'number', default: 0 },
          { key: 'steigend', label: 'Nach jedem Treffer schneller', type: 'select', options: [['ja', 'Ja'], ['nein', 'Nein']], default: 'ja' },
          { key: 'richtung', label: 'Richtung wechselt nach Treffer', type: 'select', options: [['nein', 'Nein'], ['ja', 'Ja']], default: 'nein' },
          { key: 'zeitlimit', label: 'Zeitlimit s (0 = keins)', type: 'number', default: 0 },
          { key: 'hilfe', label: 'Mit Gegenstand leichter', type: 'item', default: '' },
          { key: 'hilfeProzent', label: 'Gegenstand: Fläche + % / Tempo − %', type: 'number', default: 30 },
          { key: 'titel', label: 'Titel (leer = „Im richtigen Moment drücken!“)', type: 'text', default: '' },
          { key: 'bildScheibe', label: 'Bild Scheibe', type: 'image', default: '' },
          { key: 'bildZeiger', label: 'Bild Zeiger', type: 'image', default: '' },
          resultParam
        ],
        run(params, ctx) {
          return new Promise((resolve) => {
            const F = frame(ctx, params.titel || 'Im richtigen Moment drücken!', '46%', 'zeiger');
            const D = { leicht: { rpm: 30, zone: 60, step: 0.06 }, mittel: { rpm: 42, zone: 42, step: 0.08 }, schwer: { rpm: 58, zone: 28, step: 0.1 }, extrem: { rpm: 76, zone: 18, step: 0.12 } }[params.schwierigkeit] || { rpm: 42, zone: 42, step: 0.08 };
            const B = (k, base) => (ctx.bonus ? ctx.bonus(k, base) : base);
            const helper = params.hilfe && ctx.items && ctx.items.count(params.hilfe) > 0;
            const hp = helper ? Math.max(0, Math.min(80, Number(params.hilfeProzent) || 0)) / 100 : 0;
            let rpm = Math.max(5, B('minispiele.zeiger.tempo', Number(params.tempo) || D.rpm) * (1 - hp));
            const zone = Math.max(8, Math.min(180, B('minispiele.zeiger.zone', Number(params.flaeche) || D.zone) * (1 + hp)));
            const need = Math.max(1, Math.round(Number(params.treffer) || 5));
            const allowed = Math.max(0, Math.round(B('minispiele.zeiger.fehler', Math.max(0, Number(params.fehler) || 0))));
            const limit = Math.max(0, Number(params.zeitlimit) || 0) * 1000;
            const el = F.el, NS = 'http://www.w3.org/2000/svg';
            const sv = (tag, at) => { const n = document.createElementNS(NS, tag); for (const k in at) n.setAttribute(k, at[k]); return n; };
            F.area.classList.add('mg-qt');
            const svg = sv('svg', { viewBox: '-110 -110 220 220', class: 'mg-qt-svg' });
            const disk = pic(ctx, 'zeiger', 'bildScheibe', params), hand = pic(ctx, 'zeiger', 'bildZeiger', params);
            if (disk) svg.appendChild(sv('image', { href: disk, x: -100, y: -100, width: 200, height: 200 }));
            else svg.appendChild(sv('circle', { r: 96, class: 'mg-qt-disk' }));
            const arc = sv('path', { class: 'mg-qt-zone' });
            svg.appendChild(arc);
            const handG = sv('g', {});
            if (hand) handG.appendChild(sv('image', { href: hand, x: -12, y: -98, width: 24, height: 104 }));
            else handG.appendChild(sv('line', { x1: 0, y1: 8, x2: 0, y2: -92, class: 'mg-qt-hand' }));
            svg.appendChild(handG);
            svg.appendChild(sv('circle', { r: 7, class: 'mg-qt-hub' }));
            F.area.appendChild(svg);
            const flash = el('div', { class: 'mg-qt-flash' });
            F.area.appendChild(flash);
            const hint = el('div', { class: 'mg-qt-hint' }, 'Leertaste, Enter oder Klick');
            F.area.appendChild(hint);
            const bar = limit ? F.el('div', { class: 'mg-timebar' }, F.el('span')) : null;
            if (bar) F.o.el.insertBefore(bar, F.area);
            // Winkel: 0 = oben, im Uhrzeigersinn
            const pt = (a, r) => [Math.sin(a * Math.PI / 180) * r, -Math.cos(a * Math.PI / 180) * r];
            let zStart = 0, ang = 0, dir = 1, hits = 0, miss = 0, done = false, perfect = 0, last = performance.now(), t0 = last, cool = 0;
            const drawZone = () => {
              const [x1, y1] = pt(zStart, 96), [x2, y2] = pt(zStart + zone, 96);
              arc.setAttribute('d', `M0 0 L${x1.toFixed(2)} ${y1.toFixed(2)} A96 96 0 ${zone > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`);
            };
            // neue Stelle: nicht direkt dort, wo der Zeiger gerade ist
            const moveZone = () => { let a, tries = 0; do { a = rnd(0, 360); tries++; } while (tries < 20 && Math.abs((((a + zone / 2 - ang) % 360) + 540) % 360 - 180) < 70); zStart = a; drawZone(); };
            const upd = () => { F.info.textContent = 'Treffer: ' + hits + ' / ' + need + '   ·   Fehlversuche: ' + miss + ' / ' + allowed + (helper ? '   ·   🔧 Hilfe aktiv' : ''); };
            const inZone = () => { const d = (((ang - zStart) % 360) + 360) % 360; return { ok: d <= zone, center: Math.abs(d - zone / 2) <= zone * 0.18 }; };
            const end = (ok) => {
              done = true;
              window.removeEventListener('keydown', onKey, true);
              const score = ok ? Math.min(1, 0.6 + 0.4 * (1 - miss / (allowed + 1)) + perfect * 0.02) : Math.min(0.49, hits / need * 0.5);
              F.finish({ score, ok }, ok ? (miss ? 'Geschafft!' : 'Perfekt – kein Fehler!') : 'Daneben … ' + hits + ' von ' + need, resolve, params.ergebnis);
            };
            const press = () => {
              if (done || performance.now() < cool) return;
              cool = performance.now() + 120;
              const r = inZone();
              if (r.ok) {
                hits++; if (r.center) perfect++;
                flash.textContent = r.center ? 'Perfekt!' : 'Treffer!'; flash.className = 'mg-qt-flash hit';
                ctx.sound && ctx.sound('sfx_schloss_klick', 60);
                if (hits >= need) { upd(); return end(true); }
                if (params.steigend !== 'nein') rpm *= 1 + D.step;
                if (params.richtung === 'ja') dir = -dir;
                moveZone();
              } else {
                miss++;
                flash.textContent = 'Daneben!'; flash.className = 'mg-qt-flash miss';
                F.area.animate([{ transform: 'translateX(-1cqh)' }, { transform: 'translateX(1cqh)' }, { transform: 'none' }], { duration: 200 });
                if (miss > allowed) { upd(); return end(false); }
              }
              void flash.offsetWidth; flash.classList.add('show');
              upd();
            };
            const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E') { e.preventDefault(); e.stopPropagation(); press(); } };
            window.addEventListener('keydown', onKey, true);
            F.area.addEventListener('mousedown', (e) => { e.stopPropagation(); press(); });
            const tick = (now) => {
              if (done) return;
              const dt = Math.min(0.05, (now - last) / 1000); last = now;
              ang = (ang + dir * rpm * 6 * dt + 360) % 360;
              handG.setAttribute('transform', 'rotate(' + ang.toFixed(2) + ')');
              svg.classList.toggle('in', inZone().ok);
              if (limit) { const f = (now - t0) / limit; bar.firstChild.style.width = Math.max(0, 100 - f * 100) + '%'; if (f >= 1) return end(false); }
              requestAnimationFrame(tick);
            };
            moveZone(); upd();
            requestAnimationFrame(tick);
          });
        }
      },

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
          // 1.3: Schwierigkeit und eigene Namen (z. B. „Mixen“ an der Bar statt „Brauen“)
          { key: 'schwierigkeit', label: 'Schwierigkeit', type: 'select', options: [['leicht', 'Leicht'], ['mittel', 'Mittel'], ['schwer', 'Schwer']], default: 'mittel' },
          { key: 'titel', label: 'Titel (leer = Küche / Alchemie-Tisch)', type: 'text', default: '' },
          { key: 'knopf', label: 'Knopf (leer = Kochen / Brauen)', type: 'text', default: '' },
          { key: 'buch', label: 'Rezeptbuch (leer = Standard)', type: 'text', default: '' },
          resultParam
        ],
        run(params, ctx) {
          return new Promise((resolve) => {
            const d = data(), p = ctx.project, rs = ctx.state;
            const alch = params.look === 'alchemie';
            // Schwierigkeit: Tempo, Trefferfenster, Hitze-Bereich und wie streng bewertet wird
            const DF = { leicht: { speed: 1.0, win: 9, perfectWin: 4, beat: 180, zone: 26, perfect: 0.75, good: 0.3 }, mittel: { speed: 1.6, win: 6, perfectWin: 2.5, beat: 120, zone: 18, perfect: 0.85, good: 0.4 }, schwer: { speed: 2.4, win: 4, perfectWin: 1.8, beat: 80, zone: 12, perfect: 0.92, good: 0.55 } }[params.schwierigkeit] || null;
            const DIF = DF || { speed: 1.6, win: 6, perfectWin: 2.5, beat: 120, zone: 18, perfect: 0.85, good: 0.4 };
            const F = frame(ctx, params.titel || (alch ? 'Alchemie-Tisch' : 'Küche'), '70%', 'kochen');
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
              const book = F.el('div', { class: 'mg-book' }, F.el('div', { class: 'mg-sub' }, params.buch || (alch ? 'Rezeptbuch der Tränke' : 'Kochbuch')),
                ...d.recipes.map((r) => {
                  const known = rs.recipesKnown[r.id];
                  const res = p.items.find((x) => x.id === r.result);
                  return F.el('div', { class: 'mg-rec' + (known ? '' : ' unk') }, known ? (res ? res.name : r.name) + ': ' + (r.ingredients || []).map((id) => (p.items.find((x) => x.id === id) || {}).name || '?').join(' + ') : '??? (' + (r.ingredients || []).length + ' Zutaten)');
                }));
              F.area.append(shelf, F.el('div', { class: 'mg-mid' }, potEl, F.el('div', { class: 'row gap8', style: { justifyContent: 'center' } },
                F.el('button', { class: 'btn primary', disabled: !pot.length, onclick: (e) => { e.stopPropagation(); cook(); } }, params.knopf || (alch ? 'Brauen' : 'Kochen')),
                F.el('button', { class: 'btn', onclick: (e) => { e.stopPropagation(); F.o.close(); resolve({ score: 0, ok: false }); } }, 'Aufhören'))), book);
              F.info.textContent = 'Klicke Zutaten an, um sie hineinzugeben. Klick im Topf nimmt sie wieder heraus.';
            };
            const same = (a, b) => a.length === b.length && a.slice().sort().join('|') === b.slice().sort().join('|');
            const cook = async () => {
              const r = d.recipes.find((x) => same(x.ingredients || [], pot));
              for (const id of pot) { rs.inv[id] = (rs.inv[id] || 0) - 1; if (rs.inv[id] <= 0) delete rs.inv[id]; }
              let score = r ? 1 : 0;
              if (r && params.modus !== 'einfach') score = await steps(r.steps && r.steps.length ? r.steps : ['schneiden', 'ruehren', 'hitze']);
              const q = !r ? 'fail' : score >= DIF.perfect ? 'perfect' : score >= DIF.good ? 'good' : 'fail';
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
                const tk = () => { if (stop) return; x += dir * DIF.speed; if (x > 100 || x < 0) dir = -dir; knife.style.left = x + '%'; requestAnimationFrame(tk); };
                requestAnimationFrame(tk);
                F.area.onmousedown = (e) => { e.stopPropagation(); tries++; const d = Math.abs(x - mark); if (d < DIF.win) { hits += d < DIF.perfectWin ? 1 : 0.7; mk.classList.add('hit'); } mark = rnd(15, 85); mk.style.left = mark + '%'; if (tries >= 3) { stop = true; F.area.onmousedown = null; res(Math.min(1, hits / 3)); } };
              } else if (kind === 'ruehren') {
                const ring = F.el('div', { class: 'mg-ring' });
                track.appendChild(ring);
                let beats = 0, good = 0, last = performance.now(), litAt = 0, stop = false;
                const per = DIF.speed > 2 ? 720 : DIF.speed < 1.2 ? 1050 : 900;
                const tk = (now) => { if (stop) return; if (now - last > per) { last = now; litAt = now; ring.classList.add('lit'); setTimeout(() => ring.classList.remove('lit'), 260); } requestAnimationFrame(tk); };
                requestAnimationFrame(tk);
                F.area.onmousedown = (e) => { e.stopPropagation(); beats++; const d = Math.min(Math.abs(performance.now() - litAt), Math.abs(performance.now() - (litAt + per))); good += d < DIF.beat ? 1 : d < DIF.beat * 2 ? 0.6 : 0; ring.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(120deg)' }], { duration: 200 }); if (beats >= 6) { stop = true; F.area.onmousedown = null; res(Math.min(1, good / 6)); } };
              } else {
                let heat = 0, held = false, inZone = 0, t = 0, stop = false, last = performance.now();
                const lo = rnd(40, 62), hi = lo + DIF.zone;
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
      },

      // ---------- Tresor / Zahlenschloss (1.5) ----------
      // Drehrad (zur richtigen Zahl drehen und einrasten), Tastenfeld oder Zahlenschloss mit Rädchen.
      // Der Code kann fest sein, aus einer Variable kommen (damit man ihn in der Geschichte finden kann) oder zufällig.
      tresor: {
        label: 'Tresor / Zahlenschloss', minigame: true,
        params: [
          { key: 'art', label: 'Art', type: 'select', options: [['drehrad', 'Tresor mit Drehrad'], ['tasten', 'Tastenfeld'], ['raeder', 'Zahlenschloss mit Rädchen']], default: 'drehrad' },
          { key: 'code', label: 'Code (Drehrad z. B. 12-34-7, sonst z. B. 4711; leer = Zufall)', type: 'text', default: '' },
          { key: 'codeVar', label: 'Code aus Variable (ist sie leer, kommt der Zufallscode hinein)', type: 'var', default: '' },
          { key: 'stellen', label: 'Zufallscode: Zahlen bzw. Ziffern', type: 'number', default: 3 },
          { key: 'zahlen', label: 'Drehrad: Zahlen auf dem Rad', type: 'select', options: [['40', '0–39'], ['60', '0–59'], ['100', '0–99']], default: '40' },
          { key: 'hinweis', label: 'Hilfe', type: 'select', options: [['klicken', 'Klicken bei der richtigen Zahl (abhören)'], ['farben', 'Nach falschem Versuch: Farben (richtig / falsche Stelle / falsch)'], ['beides', 'Beides'], ['keine', 'Keine']], default: 'klicken' },
          { key: 'versuche', label: 'Versuche (0 = unbegrenzt)', type: 'number', default: 0 },
          { key: 'zeitlimit', label: 'Zeitlimit s (0 = keins)', type: 'number', default: 0 },
          { key: 'hilfe', label: 'Mit Gegenstand (z. B. Stethoskop): beide Hilfen an', type: 'item', default: '' },
          { key: 'titel', label: 'Titel (leer = „Tresor knacken“ / „Code eingeben“)', type: 'text', default: '' },
          { key: 'bildTuer', label: 'Bild Tresortür', type: 'image', default: '' },
          { key: 'bildRad', label: 'Bild Drehrad', type: 'image', default: '' },
          { key: 'bildInnen', label: 'Bild im offenen Tresor', type: 'image', default: '' },
          { key: 'tonKlick', label: 'Ton Klicken', type: 'audio', default: '' },
          { key: 'tonAuf', label: 'Ton beim Öffnen', type: 'audio', default: '' },
          resultParam
        ],
        run(params, ctx) {
          return new Promise((resolve) => {
            const art = ['drehrad', 'tasten', 'raeder'].includes(params.art) ? params.art : 'drehrad';
            const F = frame(ctx, params.titel || (art === 'drehrad' ? 'Tresor knacken' : 'Code eingeben'), '58%', 'tresor');
            const el = F.el;
            const N = Number(params.zahlen) || 40;
            const helper = params.hilfe && ctx.items && ctx.items.count(params.hilfe) > 0;
            const mode = helper ? 'beides' : (params.hinweis || 'klicken');
            const listen = mode === 'klicken' || mode === 'beides', colors = mode === 'farben' || mode === 'beides';
            const len = Math.max(1, Math.min(art === 'drehrad' ? 6 : 8, Math.round(Number(params.stellen) || 3)));
            // Code: Variable > fester Code > Zufall
            const parse = (v) => {
              const s = String(v == null ? '' : v).trim();
              if (!s || s === '0' || s === 'false') return null;
              if (art === 'drehrad') {
                const parts = /[^0-9]/.test(s) ? s.split(/[^0-9]+/).filter(Boolean) : (s.length % 2 ? '0' + s : s).match(/../g);
                const out = (parts || []).map((x) => Number(x) % N);
                return out.length ? out : null;
              }
              const d = s.replace(/\D/g, '').split('').map(Number);
              return d.length ? d : null;
            };
            const vv = params.codeVar && ctx.vars.get ? ctx.vars.get(params.codeVar) : null;
            let code = parse(vv) || parse(params.code);
            if (!code) {
              code = Array.from({ length: len }, (_, i) => (art === 'drehrad' ? Math.floor(rnd(i ? 0 : 10, N)) : Math.floor(rnd(i ? 0 : 1, 10))));
              if (params.codeVar) {
                const v = ctx.project.vars.find((x) => x.id === params.codeVar);
                const txt = art === 'drehrad' ? code.join('-') : code.join('');
                ctx.vars.set(params.codeVar, v && v.type === 'text' ? txt : Number(art === 'drehrad' ? code.map((n) => String(n).padStart(2, '0')).join('') : txt));
              }
            }
            const maxTries = Math.max(0, Math.round(Number(params.versuche) || 0));
            const limit = Math.max(0, Number(params.zeitlimit) || 0) * 1000;
            let tries = 0, done = false, t0 = performance.now();
            const click = (loud) => { if (params.tonKlick && ctx.sound) ctx.sound(params.tonKlick, loud ? 100 : 25); else clack(loud ? 1 : 0.3, loud ? 1300 : 2600); };
            // Tresor mit Tür
            F.area.classList.add('mg-safe');
            const door = el('div', { class: 'mg-safe-door' + (art !== 'drehrad' ? ' small' : '') });
            const tuer = pic(ctx, 'tresor', 'bildTuer', params);
            if (tuer) { door.style.backgroundImage = `url("${tuer}")`; door.classList.add('img'); }
            const inner = pic(ctx, 'tresor', 'bildInnen', params);
            const box = el('div', { class: 'mg-safe-box' }, el('div', { class: 'mg-safe-in', style: inner ? { backgroundImage: `url("${inner}")` } : null }, inner ? '' : '💰'), door);
            F.area.appendChild(box);
            const lock = el('div', { class: 'mg-lock mg-lock-' + art });
            door.appendChild(lock);
            const side = el('div', { class: 'mg-safe-side' });
            F.area.appendChild(side);
            const slots = el('div', { class: 'mg-slots' });
            const history = el('div', { class: 'mg-hist' });
            side.append(slots, history);
            const bar = limit ? el('div', { class: 'mg-timebar' }, el('span')) : null;
            if (bar) F.o.el.insertBefore(bar, F.area);
            const upd = () => { F.info.textContent = (maxTries ? TF('Versuche: {a} / {b}', { a: tries, b: maxTries }) : (tries ? TF('Versuche: {n}', { n: tries }) : '')) + (helper ? (maxTries || tries ? '   ·   ' : '') + '🔧 ' + T('Hilfe aktiv') : ''); };
            // Rückmeldung wie bei Mastermind: grün = richtig, gelb = kommt vor, aber woanders, rot = falsch
            const feedback = (entry) => {
              const res = entry.map((x, i) => (x === code[i] ? 'ok' : null));
              const rest = code.filter((x, i) => res[i] !== 'ok');
              entry.forEach((x, i) => { if (res[i]) return; const k = rest.indexOf(x); if (k >= 0) { res[i] = 'near'; rest.splice(k, 1); } else res[i] = 'no'; });
              return res;
            };
            const open = () => {
              done = true; cleanup();
              F.head.textContent = 'Offen!';
              door.classList.add('open');
              if (params.tonAuf && ctx.sound) ctx.sound(params.tonAuf, 90); else { clack(1, 900); setTimeout(() => clack(1, 500), 120); }
              const t = (performance.now() - t0) / 1000;
              const score = Math.max(0.6, Math.min(1, 1 - tries * 0.1 - Math.max(0, t - 20) / 300));
              setTimeout(() => F.finish({ score, ok: true }, tries ? 'Geknackt!' : 'Beim ersten Versuch geknackt!', resolve, params.ergebnis), 1200);
            };
            const fail = (why) => { if (done) return; done = true; cleanup(); F.finish({ score: 0.2, ok: false }, why, resolve, params.ergebnis); };
            const check = (entry) => {
              if (done) return false;
              if (entry.length === code.length && entry.every((x, i) => x === code[i])) { open(); return true; }
              tries++;
              door.classList.remove('shake'); void door.offsetWidth; door.classList.add('shake');
              const row = el('div', { class: 'mg-hrow' });
              const fb = colors ? feedback(entry) : null;
              entry.forEach((x, i) => row.appendChild(el('span', { class: 'mg-hcell' + (fb ? ' ' + fb[i] : '') }, String(x))));
              history.insertBefore(row, history.firstChild);
              while (history.children.length > 5) history.lastChild.remove();
              upd();
              if (maxTries && tries >= maxTries) fail('Keine Versuche mehr …');
              return false;
            };
            const showSlots = (entry, cur) => {
              slots.innerHTML = '';
              for (let i = 0; i < code.length; i++) slots.appendChild(el('span', { class: 'mg-slot' + (i === entry.length ? ' cur' : '') }, entry[i] != null ? String(entry[i]) : i === entry.length && cur != null ? String(cur) : '·'));
            };
            let cleanup = () => {};

            if (art === 'drehrad') {
              const NS = 'http://www.w3.org/2000/svg';
              const sv = (tag, at) => { const n = document.createElementNS(NS, tag); for (const k in at) n.setAttribute(k, at[k]); return n; };
              const svg = sv('svg', { viewBox: '-115 -125 230 240', class: 'mg-dial' });
              const rad = pic(ctx, 'tresor', 'bildRad', params);
              const g = sv('g', {});
              if (rad) g.appendChild(sv('image', { href: rad, x: -100, y: -100, width: 200, height: 200 }));
              else {
                g.appendChild(sv('circle', { r: 100, class: 'mg-dial-face' }));
                g.appendChild(sv('circle', { r: 78, class: 'mg-dial-ring' }));
                const every = N <= 40 ? 5 : 10;
                for (let i = 0; i < N; i++) {
                  const a = i / N * Math.PI * 2, big = i % every === 0;
                  g.appendChild(sv('line', { x1: Math.sin(a) * 96, y1: -Math.cos(a) * 96, x2: Math.sin(a) * (big ? 84 : 89), y2: -Math.cos(a) * (big ? 84 : 89), class: 'mg-dial-tick' }));
                  if (big) { const tx = sv('text', { x: Math.sin(a) * 70, y: -Math.cos(a) * 70 + 5, class: 'mg-dial-num', transform: `rotate(${i / N * 360} ${Math.sin(a) * 70} ${-Math.cos(a) * 70})` }); tx.textContent = String(i); g.appendChild(tx); }
                }
              }
              svg.appendChild(g);
              svg.appendChild(sv('path', { d: 'M0 -104 L-7 -118 L7 -118 Z', class: 'mg-dial-mark' }));
              const knob = sv('circle', { r: 30, class: 'mg-dial-knob' });
              svg.appendChild(knob);
              const kt = sv('text', { x: 0, y: 6, class: 'mg-dial-kt' }); kt.textContent = '✓'; svg.appendChild(kt);
              lock.appendChild(svg);
              let ang = 0, val = 0, entry = [], drag = null;
              const valueOf = (a) => ((Math.round(-a / (360 / N)) % N) + N) % N;
              const setAng = (a) => {
                ang = a; g.setAttribute('transform', `rotate(${ang})`);
                const v = valueOf(ang);
                if (v !== val) {
                  val = v;
                  const right = listen && entry.length < code.length && v === code[entry.length];
                  click(right);
                  if (right) { svg.classList.remove('klick'); void svg.getBBox; svg.classList.add('klick'); setTimeout(() => svg.classList.remove('klick'), 160); }
                  showSlots(entry, val);
                }
              };
              const lockIn = () => {
                if (done) return;
                entry.push(val); clack(0.7, 700);
                showSlots(entry, null);
                if (entry.length === code.length) { const e2 = entry.slice(); setTimeout(() => { if (!check(e2)) { entry = []; showSlots(entry, val); } }, 350); }
                else showSlots(entry, val);
              };
              const center = () => { const r = svg.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * (125 / 240)]; };
              svg.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                if (done) return;
                const [cx, cy] = center();
                if (Math.hypot(e.clientX - cx, e.clientY - cy) < svg.getBoundingClientRect().width * 0.14) { lockIn(); return; }
                drag = { a: Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI, start: ang };
                svg.setPointerCapture(e.pointerId);
              });
              svg.addEventListener('pointermove', (e) => {
                if (!drag || done) return;
                const [cx, cy] = center();
                const a = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
                let d = a - drag.a; d = ((d + 540) % 360) - 180;
                drag.a = a; setAng(ang + d);
              });
              svg.addEventListener('pointerup', () => { drag = null; if (!done) setAng(Math.round(ang / (360 / N)) * (360 / N)); });
              svg.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); if (!done) setAng(Math.round(ang / (360 / N)) * (360 / N) + (e.deltaY > 0 ? 1 : -1) * 360 / N); }, { passive: false });
              const onKey = (e) => {
                if (done) return;
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setAng(Math.round(ang / (360 / N)) * (360 / N) - 360 / N); }
                else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setAng(Math.round(ang / (360 / N)) * (360 / N) + 360 / N); }
                else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); lockIn(); }
                else if (e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); entry = []; showSlots(entry, val); }
              };
              window.addEventListener('keydown', onKey, true);
              cleanup = () => window.removeEventListener('keydown', onKey, true);
              side.appendChild(el('div', { class: 'row gap8 mg-safe-btns' },
                el('button', { class: 'btn primary', onclick: (e) => { e.stopPropagation(); lockIn(); } }, 'Einrasten'),
                el('button', { class: 'btn', onclick: (e) => { e.stopPropagation(); entry = []; showSlots(entry, val); } }, 'Von vorn')));
              side.appendChild(el('div', { class: 'mg-safe-help' }, T('Rad mit der Maus drehen (oder Mausrad, Pfeiltasten). Bei der richtigen Zahl einrasten – Mitte anklicken oder Enter.') + (listen ? ' ' + T('Gut hinhören: Bei der richtigen Zahl klickt es lauter.') : '')));
              setAng(rnd(0, 360)); showSlots(entry, val);
            } else if (art === 'tasten') {
              let entry = [];
              const disp = el('div', { class: 'mg-keydisp' });
              const show = () => { disp.textContent = entry.length ? entry.join('') : '—'; showSlots(entry, null); };
              const press = (k) => {
                if (done) return;
                clack(0.5, 1800);
                if (k === 'C') entry = [];
                else if (k === 'OK') { if (entry.length) { const e2 = entry.slice(); entry = []; if (!check(e2)) { disp.classList.remove('bad'); void disp.offsetWidth; disp.classList.add('bad'); } } }
                else if (entry.length < Math.max(code.length, 8)) entry.push(Number(k));
                show();
              };
              const imKey = pic(ctx, 'tresor', 'bildTaste', params), imPad = pic(ctx, 'tresor', 'bildTastenfeld', params);
              if (imPad) { lock.style.backgroundImage = `url("${imPad}")`; lock.classList.add('img'); }
              const pad = el('div', { class: 'mg-keypad' }, ...['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map((k) => el('button', { class: 'mg-key' + (k === 'OK' ? ' ok' : k === 'C' ? ' c' : '') + (imKey ? ' img' : ''), style: imKey ? { backgroundImage: `url("${imKey}")` } : null, onclick: (e) => { e.stopPropagation(); press(k); } }, k)));
              lock.append(disp, pad);
              const onKey = (e) => {
                if (done) return;
                if (/^[0-9]$/.test(e.key)) { e.preventDefault(); e.stopPropagation(); press(e.key); }
                else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); press('OK'); }
                else if (e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); entry.pop(); show(); }
                else if (e.key === 'Escape' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); press('C'); }
              };
              window.addEventListener('keydown', onKey, true);
              cleanup = () => window.removeEventListener('keydown', onKey, true);
              side.appendChild(el('div', { class: 'mg-safe-help' }, T('Code eintippen (auch mit der Tastatur) und OK.') + (colors ? ' ' + T('Nach einem falschen Versuch: grün = richtige Ziffer an richtiger Stelle, gelb = kommt vor, aber woanders.') : '')));
              show();
            } else {
              const vals = code.map(() => Math.floor(rnd(0, 10)));
              const wheels = vals.map((v, i) => {
                const num = el('div', { class: 'mg-wnum' });
                const set = (d) => {
                  if (done) return;
                  vals[i] = (vals[i] + d + 10) % 10;
                  num.innerHTML = '';
                  num.append(el('span', { class: 'dim' }, String((vals[i] + 1) % 10)), el('span', { class: 'cur' }, String(vals[i])), el('span', { class: 'dim' }, String((vals[i] + 9) % 10)));
                  if (d) { const right = listen && vals[i] === code[i]; click(right); if (right) { w.classList.remove('klick'); void w.offsetWidth; w.classList.add('klick'); } }
                };
                const w = el('div', { class: 'mg-wheel' },
                  el('button', { class: 'mg-warr', onclick: (e) => { e.stopPropagation(); set(1); } }, '▲'), num,
                  el('button', { class: 'mg-warr', onclick: (e) => { e.stopPropagation(); set(-1); } }, '▼'));
                w.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); set(e.deltaY > 0 ? -1 : 1); }, { passive: false });
                set(0);
                return w;
              });
              const imLock = pic(ctx, 'tresor', 'bildSchloss', params);
              lock.append(el('div', { class: 'mg-wheels' + (imLock ? ' img' : ''), style: imLock ? { backgroundImage: `url("${imLock}")` } : null }, ...wheels));
              const tryOpen = () => { if (done) return; clack(0.8, 600); check(vals.slice()); };
              side.appendChild(el('div', { class: 'row gap8 mg-safe-btns' }, el('button', { class: 'btn primary', onclick: (e) => { e.stopPropagation(); tryOpen(); } }, 'Öffnen')));
              side.appendChild(el('div', { class: 'mg-safe-help' }, T('Rädchen mit den Pfeilen oder dem Mausrad drehen, dann „Öffnen“.') + (listen ? ' ' + T('Bei der richtigen Ziffer klickt ein Rädchen lauter.') : '')));
              const onKey = (e) => { if (!done && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); tryOpen(); } };
              window.addEventListener('keydown', onKey, true);
              cleanup = () => window.removeEventListener('keydown', onKey, true);
              showSlots([], null); slots.style.display = 'none';
            }
            if (limit) {
              const step = (now) => { if (done) return; const f = (now - t0) / limit; bar.firstChild.style.width = Math.max(0, 100 - f * 100) + '%'; if (f >= 1) return fail('Zeit abgelaufen …'); requestAnimationFrame(step); };
              requestAnimationFrame(step);
            }
            const gone = setInterval(() => { if (!document.body.contains(box)) { clearInterval(gone); if (!done) { done = true; cleanup(); resolve({ score: 0, ok: false }); } } }, 500);
            upd();
          });
        }
      },

      // ---------- Rohre verbinden (1.5) ----------
      // Teile anklicken, bis eine Leitung von links nach rechts durchgeht. Das Feld ist immer lösbar.
      rohre: {
        label: 'Rohre verbinden', minigame: true,
        params: [
          { key: 'groesse', label: 'Größe', type: 'select', options: [['4', '4 × 4 (sehr leicht)'], ['5', '5 × 5 (leicht)'], ['6', '6 × 6'], ['7', '7 × 7'], ['8', '8 × 8 (schwer)']], default: '5' },
          { key: 'aussehen', label: 'Aussehen', type: 'select', options: [['rohre', 'Rohre mit Wasser'], ['kabel', 'Kabel mit Strom'], ['magie', 'Magische Runen']], default: 'rohre' },
          { key: 'zeitlimit', label: 'Wasser fließt nach … Sekunden (0 = kein Zeitdruck)', type: 'number', default: 0 },
          { key: 'zuege', label: 'Drehungen höchstens (0 = unbegrenzt)', type: 'number', default: 0 },
          { key: 'titel', label: 'Titel (leer = „Leitung verbinden“)', type: 'text', default: '' },
          { key: 'bildHintergrund', label: 'Bild Hintergrund', type: 'image', default: '' },
          { key: 'bildGerade', label: 'Bild Gerade (oben–unten)', type: 'image', default: '' },
          { key: 'bildKurve', label: 'Bild Kurve (oben–rechts)', type: 'image', default: '' },
          { key: 'bildT', label: 'Bild T-Stück (oben–rechts–unten)', type: 'image', default: '' },
          { key: 'bildKreuz', label: 'Bild Kreuzung', type: 'image', default: '' },
          { key: 'tonDreh', label: 'Ton beim Drehen', type: 'audio', default: '' },
          resultParam
        ],
        run(params, ctx) {
          return new Promise((resolve) => {
            const look = ['rohre', 'kabel', 'magie'].includes(params.aussehen) ? params.aussehen : 'rohre';
            const F = frame(ctx, params.titel || 'Leitung verbinden', '56%', 'rohre');
            const el = F.el;
            const n = Math.max(3, Math.min(9, Math.round(Number(params.groesse) || 5)));
            const B = (k, base) => (ctx.bonus ? ctx.bonus(k, base) : base);
            const limit = Math.max(0, B('minispiele.rohre.zeit', Number(params.zeitlimit) || 0)) * 1000;
            const maxMoves = Math.max(0, Math.round(Number(params.zuege) || 0));
            const { cells, path, r0, r1, at, flow } = pipeField(n);
            // Darstellung
            F.area.classList.add('mg-pipes', 'mg-pipes-' + look);
            const bg = pic(ctx, 'rohre', 'bildHintergrund', params);
            if (bg) F.area.style.background = `url("${bg}") center / cover`;
            const imgs = { 5: pic(ctx, 'rohre', 'bildGerade', params), 3: pic(ctx, 'rohre', 'bildKurve', params), 7: pic(ctx, 'rohre', 'bildT', params), 15: pic(ctx, 'rohre', 'bildKreuz', params) };
            const D = { 5: 'M50 0 L50 100', 3: 'M50 0 L50 38 Q50 50 62 50 L100 50', 7: 'M50 0 L50 100 M50 50 L100 50', 15: 'M50 0 L50 100 M0 50 L100 50' };
            const grid = el('div', { class: 'mg-pgrid', style: { gridTemplateColumns: `repeat(${n + 2}, 1fr)`, gridTemplateRows: `repeat(${n}, 1fr)` } });
            grid.style.setProperty('--ar', String((n + 2) / n));
            const tile = (c) => {
              const t = el('div', { class: 'mg-ptile', style: { gridColumn: String(c.x + 2), gridRow: String(c.y + 1) } });
              const inner = el('div', { class: 'mg-pin' });
              if (imgs[c.shape]) inner.appendChild(el('img', { src: imgs[c.shape], draggable: false }));
              else inner.innerHTML = `<svg viewBox="0 0 100 100"><path class="o" d="${D[c.shape]}"/><path class="i" d="${D[c.shape]}"/><circle class="j" cx="50" cy="50" r="${c.shape === 5 ? 0 : 9}"/></svg>`;
              inner.style.transform = `rotate(${c.deg}deg)`;
              t.appendChild(inner);
              c.el = t; c.inner = inner;
              const turn = (d) => {
                if (done) return;
                c.r = (c.r + d + 4) % 4; c.deg += d * 90;
                inner.style.transform = `rotate(${c.deg}deg)`;
                moves++;
                if (params.tonDreh && ctx.sound) ctx.sound(params.tonDreh, 60); else clack(0.35, 1500);
                refresh();
              };
              t.addEventListener('mousedown', (e) => { e.stopPropagation(); turn(e.button === 2 ? -1 : 1); });
              t.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); });
              return t;
            };
            const imSrc = pic(ctx, 'rohre', 'bildQuelle', params), imDst = pic(ctx, 'rohre', 'bildZiel', params);
            const src = el('div', { class: 'mg-pend src', style: { gridColumn: '1', gridRow: String(r0 + 1) } }, imSrc ? el('img', { src: imSrc, draggable: false }) : el('span'));
            const dst = el('div', { class: 'mg-pend dst', style: { gridColumn: String(n + 2), gridRow: String(r1 + 1) } }, imDst ? el('img', { src: imDst, draggable: false }) : el('span'));
            grid.append(src, ...cells.map(tile), dst);
            F.area.appendChild(grid);
            const bar = limit ? el('div', { class: 'mg-timebar' }, el('span')) : null;
            if (bar) F.o.el.insertBefore(bar, F.area);
            let moves = 0, done = false;
            const t0 = performance.now();
            const word = T({ rohre: 'Wasser', kabel: 'Strom', magie: 'Magie' }[look]);
            const upd = () => { F.info.textContent = T('Klick = drehen (Rechtsklick andersherum)') + '   ·   ' + (maxMoves ? TF('Drehungen: {a} / {b}', { a: moves, b: maxMoves }) : TF('Drehungen: {n}', { n: moves })) + (limit ? '   ·   ' + TF('{w} fließt gleich!', { w: word }) : ''); };
            const refresh = () => {
              const f = flow();
              for (const c of cells) c.el.classList.toggle('full', f.vis.has(c));
              src.classList.add('full'); dst.classList.toggle('full', f.done);
              upd();
              if (f.done) win();
              else if (maxMoves && moves >= maxMoves) lose('Keine Drehungen mehr …');
            };
            const win = () => {
              if (done) return; done = true;
              F.area.classList.add('solved');
              const best = path.length * 1.6;
              const score = Math.max(0.6, Math.min(1, 1 - Math.max(0, moves - best) / (n * n * 3)));
              setTimeout(() => F.finish({ score, ok: true }, 'Verbunden!', resolve, params.ergebnis), 700);
            };
            const lose = (why) => { if (done) return; done = true; F.area.classList.add('failed'); const f = flow(); F.finish({ score: Math.min(0.45, f.vis.size / Math.max(1, path.length) * 0.45), ok: false }, why, resolve, params.ergebnis); };
            if (limit) {
              const step = (now) => { if (done) return; const f = (now - t0) / limit; bar.firstChild.style.width = Math.max(0, 100 - f * 100) + '%'; if (f >= 1) return lose(TF('{w} läuft aus …', { w: word })); requestAnimationFrame(step); };
              requestAnimationFrame(step);
            }
            refresh();
          });
        }
      }

    },
    hooks: {},
    _intern: { pipeField },
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
          ['bluete', '🌼', '„Liebt mich, liebt mich nicht“ – die Blattzahl sorgt für ein echtes 50:50.', 'Zufall, eigene Texte, Bilder für Blatt und Mitte'],
          ['tresor', '🔐', 'Tresor mit Drehrad, Tastenfeld oder Zahlenschloss mit Rädchen. Der Code kann fest sein, aus einer Variable kommen (dann findet man ihn in der Geschichte) oder zufällig – auch zufällig in eine Variable, die du später im Text zeigst.', 'Art, Code, Zahlen auf dem Rad, Hilfe (Klicken abhören oder Farben), Versuche, Zeitlimit, Hilfs-Gegenstand, Bilder für Tür, Rad und Inhalt'],
          ['rohre', '🚰', 'Teile drehen, bis die Leitung von links nach rechts durchgeht – als Rohre mit Wasser, Kabel mit Strom oder magische Runen. Jedes Feld ist zufällig und immer lösbar.', 'Größe, Aussehen, Zeitdruck, Drehungen, eigene Bilder für die Teile'],
          ['zeiger', '⏱', 'Ein Zeiger dreht sich – im richtigen Moment drücken, wenn er in der markierten Fläche steht. Die Fläche springt nach jedem Treffer weiter. Leichter durch Skilltree-Perks, Ausrüstung oder einen Hilfs-Gegenstand.', 'Schwierigkeit, Tempo, Größe der Fläche, Treffer, Fehlversuche, schneller werden, Richtungswechsel, Zeitlimit, Hilfs-Gegenstand, eigene Bilder']
        ];
        body.appendChild(el('p', { class: 'muted' }, 'Neun Minispiele. Du startest sie über „+ Aktion“ → „Minispiele: …“ – in einer Antwort, an einem Hub-Objekt, in einem Dialog oder als Minispiel eines Jobs. Einstellungen und Bilder wählst du direkt an der Aktion. Jedes Spiel liefert ein Ergebnis von 0–100 % (Feld „Ergebnis in“ → Variable).'));
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
