// Animations-Editor: Figuren mit Knochen animieren (Idle, Gesten, Zwischensequenzen), Posen, Vorlagen, Video-Export
(function () {
  const { el } = VN;
  const PX = 130; // Pixel pro Sekunde in der Timeline

  // ---------- Fertige Bewegungen (Knochen-Namen der Körper-Vorlagen) ----------
  const K = (pairs, e) => pairs.map(([t, a]) => ({ t, a, e: e || 'ease-in-out' }));
  const neg = (pairs) => pairs.map(([t, a]) => [t, -a]);
  const TEMPLATES = {
    biped: [
      { id: 'gewicht', label: 'Gewicht verlagern', type: 'idle', dur: 4, bones: { 'Hüfte': K([[0, 0], [1, 3], [2, 0], [3, -3], [4, 0]]), 'Brust': K([[0, 0], [1, -2], [2, 0], [3, 2], [4, 0]]), 'Kopf': K([[0, 0], [1, -1.5], [2, 0], [3, 1.5], [4, 0]]) } },
      { id: 'nicken', label: 'Nicken', type: 'gesture', dur: 1.2, bones: { 'Kopf': K([[0, 0], [0.3, 12], [0.6, -3], [0.9, 9], [1.2, 0]]), 'Hals': K([[0, 0], [0.3, 4], [0.9, 3], [1.2, 0]]) } },
      { id: 'schuetteln', label: 'Kopfschütteln', type: 'gesture', dur: 1.4, bones: { 'Kopf': K([[0, 0], [0.25, -12], [0.5, 12], [0.75, -10], [1, 8], [1.4, 0]]) } },
      { id: 'winken', label: 'Winken', type: 'gesture', dur: 2, bones: { 'Oberarm R': K([[0, 0], [0.4, -140], [1.6, -140], [2, 0]]), 'Unterarm R': K([[0, 0], [0.4, -40], [0.6, -10], [0.8, -45], [1, -10], [1.2, -45], [1.4, -15], [2, 0]]), 'Brust': K([[0, 0], [0.4, -2], [1.6, -2], [2, 0]]) } },
      { id: 'erschrecken', label: 'Erschrecken', type: 'gesture', dur: 1.6, bones: { 'Brust': K([[0, 0], [0.12, -4], [1, -3], [1.6, 0]], 'ease-out'), 'Kopf': K([[0, 0], [0.12, -9], [1, -7], [1.6, 0]], 'ease-out'), 'Oberarm L': K([[0, 0], [0.12, 22], [1, 18], [1.6, 0]], 'ease-out'), 'Oberarm R': K([[0, 0], [0.12, -22], [1, -18], [1.6, 0]], 'ease-out'), 'Unterarm L': K([[0, 0], [0.12, 30], [1, 26], [1.6, 0]]), 'Unterarm R': K([[0, 0], [0.12, -30], [1, -26], [1.6, 0]]) } },
      { id: 'laufen', label: 'Laufen (auf der Stelle)', type: 'idle', dur: 1, bones: { 'Oberschenkel L': K([[0, 0], [0.25, -20], [0.5, 0], [0.75, 20], [1, 0]]), 'Oberschenkel R': K(neg([[0, 0], [0.25, -20], [0.5, 0], [0.75, 20], [1, 0]])), 'Unterschenkel L': K([[0, 0], [0.25, 12], [0.5, 0], [0.75, 4], [1, 0]]), 'Unterschenkel R': K([[0, 0], [0.25, -4], [0.5, 0], [0.75, -12], [1, 0]]), 'Oberarm L': K([[0, 0], [0.25, 14], [0.5, 0], [0.75, -14], [1, 0]]), 'Oberarm R': K([[0, 0], [0.25, 14], [0.5, 0], [0.75, -14], [1, 0]]), 'Hüfte': K([[0, 0], [0.25, 2], [0.5, 0], [0.75, -2], [1, 0]]) } }
    ],
    quad: [
      { id: 'laufen', label: 'Laufen', type: 'idle', dur: 0.8, bones: { 'Bein vorne L': K([[0, 0], [0.2, 18], [0.4, 0], [0.6, -18], [0.8, 0]]), 'Bein vorne R': K(neg([[0, 0], [0.2, 18], [0.4, 0], [0.6, -18], [0.8, 0]])), 'Keule hinten L': K(neg([[0, 0], [0.2, 16], [0.4, 0], [0.6, -16], [0.8, 0]])), 'Keule hinten R': K([[0, 0], [0.2, 16], [0.4, 0], [0.6, -16], [0.8, 0]]), 'Hals': K([[0, 0], [0.2, 3], [0.4, 0], [0.6, 3], [0.8, 0]]) } },
      { id: 'nicken', label: 'Nicken', type: 'gesture', dur: 1.2, bones: { 'Kopf': K([[0, 0], [0.3, -12], [0.6, 3], [0.9, -9], [1.2, 0]]), 'Hals': K([[0, 0], [0.3, -5], [0.9, -3], [1.2, 0]]) } },
      { id: 'schuetteln', label: 'Kopfschütteln', type: 'gesture', dur: 1.4, bones: { 'Kopf': K([[0, 0], [0.25, -10], [0.5, 10], [0.75, -8], [1, 6], [1.4, 0]]) } },
      { id: 'gewicht', label: 'Gewicht verlagern', type: 'idle', dur: 4, bones: { 'Hals': K([[0, 0], [1, -3], [2, 0], [3, 2], [4, 0]]), 'Becken': K([[0, 0], [2, 1.5], [4, 0]]) } }
    ],
    winged: [
      { id: 'fluegel', label: 'Flügelschlag', type: 'idle', dur: 0.6, bones: { 'Flügelarm L': K([[0, 0], [0.15, 35], [0.3, 0], [0.45, -25], [0.6, 0]]), 'Flügelarm R': K(neg([[0, 0], [0.15, 35], [0.3, 0], [0.45, -25], [0.6, 0]])), 'Federn L': K([[0, 0], [0.25, 15], [0.5, -15], [0.6, 0]]), 'Federn R': K(neg([[0, 0], [0.25, 15], [0.5, -15], [0.6, 0]])) } },
      { id: 'nicken', label: 'Nicken', type: 'gesture', dur: 1.2, bones: { 'Kopf': K([[0, 0], [0.3, 12], [0.6, -3], [0.9, 9], [1.2, 0]]) } },
      { id: 'erschrecken', label: 'Erschrecken', type: 'gesture', dur: 1.4, bones: { 'Flügelarm L': K([[0, 0], [0.1, 40], [0.9, 35], [1.4, 0]], 'ease-out'), 'Flügelarm R': K([[0, 0], [0.1, -40], [0.9, -35], [1.4, 0]], 'ease-out'), 'Kopf': K([[0, 0], [0.1, -12], [0.9, -8], [1.4, 0]]) } }
    ],
    chain: [
      { id: 'welle', label: 'Welle', type: 'idle', dur: 1.6, bones: Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => ['Glied ' + i, K([0, 0.4, 0.8, 1.2, 1.6].map((t) => [t, 10 * Math.sin((t / 1.6) * 2 * Math.PI + i * 0.9)]))])) }
    ]
  };
  const mirrorName = (n) => (/ L$/.test(n) ? n.replace(/ L$/, ' R') : / R$/.test(n) ? n.replace(/ R$/, ' L') : / vorne L$/.test(n) ? n : n);

  const ui = () => VN.ui;
  const anims = () => VN.project.anims;
  const cur = () => anims().find((a) => a.id === ui().animSel) || null;
  const actorOf = (a) => (a ? (a.actors || []).find((x) => x.id === ui().animActor) || a.actors[0] || null : null);
  const rigOf = (actor) => (actor && actor.asset && VN.project.rigs[actor.asset]) || null;

  const AnimEd = (window.AnimEd = {
    TEMPLATES,
    _sc: null, _scKey: '',

    create(type) {
      const p = VN.project;
      const img = VN.assetsOf('image').find((a) => p.rigs[a.id]) || VN.assetsOf('image')[0];
      const base = { id: VN.uid('an'), name: type === 'idle' ? 'Neue Idle-Animation' : type === 'gesture' ? 'Neue Geste' : 'Neue Zwischensequenz', type, dur: type === 'scene' ? 6 : type === 'idle' ? 3 : 1.5, loop: type === 'idle', cam: [], audio: [], actors: [] };
      if (type === 'scene') {
        const bg = (VN.curScene() && VN.curScene().type === 'story' && VN.curScene().tracks.bg[0]) || null;
        base.bg = bg ? bg.asset : (VN.assetsOf('image')[0] || {}).id || null;
        const rigged = VN.assetsOf('image').filter((a) => p.rigs[a.id]);
        rigged.slice(0, 2).forEach((a, i) => base.actors.push({ id: VN.uid('ac'), asset: a.id, x: 30 + i * 40, y: 0, scale: 100, flip: false, bones: {}, move: [] }));
        if (!base.actors.length && img) base.actors.push({ id: VN.uid('ac'), asset: img.id, x: 50, y: 0, scale: 100, flip: false, bones: {}, move: [] });
      } else if (img) base.actors.push({ id: VN.uid('ac'), asset: img.id, x: 50, y: 0, scale: 100, flip: false, bones: {}, move: [] });
      VN.mutate(() => { p.anims.push(base); ui().animSel = base.id; ui().animActor = base.actors[0] ? base.actors[0].id : null; ui().animT = 0; ui().animKey = null; });
    },

    // Keyframe setzen (ersetzt einen vorhandenen in der Nähe)
    setKey(list, t, fields) {
      const near = list.find((k) => Math.abs(k.t - t) < 0.03);
      if (near) Object.assign(near, fields); else list.push(Object.assign({ t: Math.round(t * 100) / 100, e: 'ease-in-out' }, fields));
      list.sort((a, b) => a.t - b.t);
    },

    render(center) {
      center.innerHTML = '';
      cancelAnimationFrame(AnimEd._raf);
      const a = cur();
      const list = el('div', { class: 'an-list' },
        el('div', { class: 'sec-title' }, 'Animationen'),
        ...anims().map((x) => el('div', { class: 'list-item' + (x === a ? ' active' : ''), onclick: () => { ui().animSel = x.id; ui().animActor = (x.actors[0] || {}).id; ui().animT = 0; ui().animKey = null; VN.render(); } },
          el('span', { class: 'an-ico' }, x.type === 'idle' ? '∞' : x.type === 'gesture' ? '✋' : '🎬'), el('span', { class: 'name' }, x.name), el('span', { class: 'muted small' }, (x.dur || 0).toFixed(1) + ' s'))),
        el('div', { class: 'an-new' },
          el('button', { class: 'btn tiny', onclick: () => AnimEd.create('idle') }, '+ Idle'),
          el('button', { class: 'btn tiny', onclick: () => AnimEd.create('gesture') }, '+ Geste'),
          el('button', { class: 'btn tiny', onclick: () => AnimEd.create('scene') }, '+ Zwischensequenz')));
      const main = el('div', { class: 'an-main' });
      center.appendChild(el('div', { class: 'an-wrap' }, list, main));
      if (!a) {
        main.appendChild(el('div', { class: 'an-empty' },
          el('div', { style: { fontSize: '40px' } }, '🎬'),
          el('h2', null, 'Animations-Editor'),
          el('p', { class: 'muted' }, 'Hier animierst du Figuren mit ihren Knochenpunkten: als Idle-Schleife (z. B. ungeduldig wippen), als Geste für einen Schritt (z. B. Winken) oder als ganze Zwischensequenz mit Hintergrund, mehreren Figuren, Kamera und Ton. Zwischensequenzen laufen live im Spiel oder werden als Video gerendert.'),
          el('div', { class: 'row gap8', style: { justifyContent: 'center' } },
            el('button', { class: 'btn primary', onclick: () => AnimEd.create('idle') }, '+ Idle-Animation'),
            el('button', { class: 'btn', onclick: () => AnimEd.create('gesture') }, '+ Geste'),
            el('button', { class: 'btn', onclick: () => AnimEd.create('scene') }, '+ Zwischensequenz')),
          el('div', { class: 'muted small' }, 'Figuren brauchen dafür Bones (Reiter „Figuren“ → „Bones & Blinzeln“).')));
        return;
      }
      const t = Math.max(0, Math.min(a.dur, ui().animT || 0));
      ui().animT = t;
      const playing = !!ui().animPlay;
      main.appendChild(el('div', { class: 'view-head' },
        el('input', { class: 'name-input', value: a.name, onchange: (e) => VN.mutate(() => { a.name = e.target.value || 'Animation'; }) }),
        el('span', { class: 'chip' }, a.type === 'idle' ? 'Idle (Schleife)' : a.type === 'gesture' ? 'Geste' : 'Zwischensequenz'),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn', onclick: () => { ui().animT = 0; VN.render(); } }, '⏮'),
        el('button', { class: 'btn primary', onclick: () => { ui().animPlay = !playing; VN.render(); } }, playing ? '■ Stopp' : '▶ Abspielen'),
        el('label', { class: 'check btn' }, el('input', { type: 'checkbox', checked: !!ui().animOnion, onchange: (e) => { ui().animOnion = e.target.checked; VN.render(); } }), 'Zwiebelhaut'),
        el('label', { class: 'check btn' }, el('input', { type: 'checkbox', checked: ui().animBones !== false, onchange: (e) => { ui().animBones = e.target.checked; VN.render(); } }), 'Knochen')));
      // Bühne
      const wrap = el('div', { class: 'stage-wrap an-stage-wrap' });
      const stage = el('div', { class: 'stage an-stage' });
      const canvas = el('canvas', { class: 'an-canvas' });
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'an-svg');
      stage.append(canvas, svg);
      wrap.appendChild(stage);
      main.appendChild(wrap);
      AnimEd._ro && AnimEd._ro.disconnect();
      AnimEd._ro = Stage.fit(wrap, stage);
      main.appendChild(AnimEd.timeline(a, t));
      AnimEd.startStage(a, stage, canvas, svg);
    },

    // Bühne zeichnen (läuft, solange die Ansicht offen ist)
    async startStage(a, stage, canvas, svg) {
      const key = JSON.stringify([a.id, a.bg, (a.actors || []).map((x) => x.asset)]);
      if (AnimEd._scKey !== key) { AnimEd._scKey = key; AnimEd._sc = null; AnimEd._scP = Anim.build(a).then((sc) => { if (AnimEd._scKey === key) AnimEd._sc = sc; return sc; }); }
      const sc = AnimEd._sc || await AnimEd._scP;
      if (!sc || !canvas.isConnected) return;
      sc.anim = a;
      for (let i = 0; i < sc.items.length; i++) sc.items[i].actor = a.actors[i];
      const ctx = canvas.getContext('2d');
      let last = performance.now();
      const frame = (now) => {
        if (!canvas.isConnected) return;
        const r = stage.getBoundingClientRect();
        if (canvas.width !== Math.round(r.width) || canvas.height !== Math.round(r.height)) { canvas.width = Math.max(2, Math.round(r.width)); canvas.height = Math.max(2, Math.round(r.height)); svg.setAttribute('viewBox', '0 0 ' + canvas.width + ' ' + canvas.height); }
        const dt = Math.min(1 / 30, (now - last) / 1000);
        last = now;
        if (ui().animPlay) {
          let t = (ui().animT || 0) + dt;
          if (t > a.dur) t = a.loop || a.type !== 'scene' ? t % a.dur : (ui().animPlay = false, a.dur);
          ui().animT = t;
          AnimEd.movePlayhead(t);
        }
        const t = ui().animT || 0;
        const bgOpts = { bgFill: true, bgColor: '#15161b' };
        if (ui().animOnion && !ui().animPlay) {
          Anim.draw(ctx, sc, Math.max(0, t - 0.25), 0, Object.assign({ alpha: 0.2 }, bgOpts));
          Anim.draw(ctx, sc, Math.min(a.dur, t + 0.25), 0, { alpha: 0.2, noClear: true, noBg: true });
          AnimEd._maps = Anim.draw(ctx, sc, t, ui().animPlay ? dt : 0, { noClear: true, noBg: true });
        } else AnimEd._maps = Anim.draw(ctx, sc, t, ui().animPlay ? dt : 0, bgOpts);
        AnimEd.drawBones(svg, sc, a);
        AnimEd._raf = requestAnimationFrame(frame);
      };
      AnimEd._raf = requestAnimationFrame(frame);
      AnimEd.bindStage(stage, svg, sc, a);
    },

    // Knochen-Griffe des ausgewählten Darstellers
    drawBones(svg, sc, a) {
      svg.innerHTML = '';
      if (ui().animBones === false || ui().animPlay) return;
      const actor = actorOf(a);
      const m = (AnimEd._maps || []).find((x) => x.it.actor === actor);
      if (!m) return;
      const NS = 'http://www.w3.org/2000/svg';
      const [bx, by] = m.base;
      const mk = (tag, at) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(at)) n.setAttribute(k, v); svg.appendChild(n); return n; };
      if (a.type === 'scene') mk('circle', { cx: bx, cy: by, r: 7, fill: 'none', stroke: '#8fc3f0', 'stroke-width': 2, 'stroke-dasharray': '3 2' });
      if (!m.map || !m.it.inst) return;
      AnimEd._joints = [];
      const angs = Anim.angles(actor, ui().animT || 0);
      for (const j of Rig.jointPos(m.it.inst)) {
        const [hx, hy] = m.map(j.hx, j.hy), [tx, ty] = m.map(j.tx, j.ty);
        const sel = ui().animBone === j.b.name;
        const keyed = actor.bones && actor.bones[j.b.name] && actor.bones[j.b.name].length;
        mk('line', { x1: hx, y1: hy, x2: tx, y2: ty, stroke: sel ? '#e8a43a' : keyed ? '#9be0b2' : 'rgba(255,255,255,0.75)', 'stroke-width': sel ? 4 : 2.5, 'stroke-linecap': 'round' });
        mk('circle', { cx: hx, cy: hy, r: 3, fill: '#fff' });
        const h = mk('circle', { cx: tx, cy: ty, r: sel ? 8 : 6.5, fill: sel ? '#e8a43a' : keyed ? '#6cc48a' : '#2b2e38', stroke: '#fff', 'stroke-width': 2, class: 'an-handle' });
        h.dataset.bone = j.b.name;
        AnimEd._joints.push({ name: j.b.name, hx, hy, tx, ty, a: angs[j.b.name] || 0 });
      }
    },

    bindStage(stage, svg, sc, a) {
      stage.onmousedown = (e) => {
        if (e.button !== 0) return;
        const r = svg.getBoundingClientRect();
        const kx = (svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal.width / r.width : 1);
        const px = (e.clientX - r.left) * kx, py = (e.clientY - r.top) * kx;
        const actor = actorOf(a);
        const hit = (AnimEd._joints || []).slice().reverse().find((j) => Math.hypot(j.tx - px, j.ty - py) < 12);
        const t = ui().animT || 0;
        if (hit && actor) {
          e.preventDefault();
          ui().animBone = hit.name;
          const a0 = Math.atan2(py - hit.hy, px - hit.hx);
          const base = hit.a;
          actor.bones = actor.bones || {};
          const list = actor.bones[hit.name] = actor.bones[hit.name] || [];
          const before = JSON.stringify(actor.bones);
          VN.drag(e, (dx, dy, ev) => {
            const qx = (ev.clientX - r.left) * kx, qy = (ev.clientY - r.top) * kx;
            let d = (Math.atan2(qy - hit.hy, qx - hit.hx) - a0) * 180 / Math.PI;
            if (d > 180) d -= 360; if (d < -180) d += 360;
            if (actor.flip) d = -d;
            AnimEd.setKey(list, t, { a: Math.round((base + d) * 10) / 10 });
          }, (dx, dy, moved) => {
            if (!moved) { VN.render(); return; }
            const after = JSON.stringify(actor.bones);
            actor.bones = JSON.parse(before);
            VN.mutate(() => { actor.bones = JSON.parse(after); ui().animKey = { row: 'bone:' + hit.name, t }; });
          });
          return;
        }
        // Darsteller auswählen bzw. verschieben (Zwischensequenz)
        const maps = AnimEd._maps || [];
        let pick = null;
        for (const m of maps) { const [bx, by] = m.base; if (px > bx - m.boxH * 0.25 && px < bx + m.boxH * 0.25 && py < by && py > by - m.boxH) pick = m; }
        if (!pick) return;
        ui().animActor = pick.it.actor.id;
        if (a.type !== 'scene') { VN.render(); return; }
        e.preventDefault();
        const ac = pick.it.actor;
        const p0 = Anim.place(ac, t);
        const before = JSON.stringify(ac.move || []);
        ac.move = ac.move || [];
        VN.drag(e, (dx, dy) => {
          AnimEd.setKey(ac.move, t, { x: Math.round((p0.x + dx * kx / svg.viewBox.baseVal.width * 100) * 10) / 10, y: Math.round((p0.y - dy * kx / svg.viewBox.baseVal.height * 100) * 10) / 10 });
        }, (dx, dy, moved) => {
          if (!moved) { VN.render(); return; }
          const after = ac.move;
          ac.move = JSON.parse(before);
          VN.mutate(() => { ac.move = after; ui().animKey = { row: 'move', t }; });
        });
      };
    },

    // ---------- Timeline ----------
    rows(a) {
      const actor = actorOf(a);
      const rows = [];
      if (actor) {
        rows.push({ id: 'move', label: 'Bewegung', keys: actor.move || (actor.move = []), color: '#8fc3f0' });
        const rig = rigOf(actor);
        const names = rig ? rig.bones.map((b) => b.name) : Object.keys(actor.bones || {});
        for (const n of names) rows.push({ id: 'bone:' + n, label: n, keys: (actor.bones || {})[n] || [], bone: n, color: '#e8a43a' });
      }
      if (a.type === 'scene') rows.push({ id: 'cam', label: 'Kamera', keys: a.cam || (a.cam = []), color: '#b39cf0' });
      return rows;
    },
    timeline(a, t) {
      const tl = el('div', { class: 'timeline an-tl' });
      const W = Math.max(1, a.dur) * PX;
      tl.appendChild(el('div', { class: 'tl-tools' },
        el('strong', null, 'Keyframes'),
        el('span', { class: 'muted small' }, (t.toFixed(2)) + ' s / ' + a.dur.toFixed(1) + ' s'),
        el('span', { class: 'muted small' }, '· Knochen-Griff ziehen = Keyframe an der Abspielposition · Raute ziehen = verschieben · Rechtsklick = löschen'),
        el('div', { style: { flex: '1' } }),
        actorOf(a) ? AnimEd.actorSelect(a) : null));
      const scroll = el('div', { class: 'tl-scroll' });
      const inner = el('div', { class: 'tl-inner', style: { width: (150 + W + 40) + 'px' } });
      const ruler = el('div', { class: 'tl-ruler-lane', style: { width: W + 'px' } });
      for (let s = 0; s <= a.dur + 0.001; s += 0.5) ruler.appendChild(el('div', { class: 'tl-tick', style: { left: s * PX + 'px', color: s % 1 ? '#5d606b' : '' } }, s % 1 ? '' : s + ' s'));
      const scrub = (e, lane) => {
        const r = lane.getBoundingClientRect();
        const go = (ev) => { ui().animT = Math.max(0, Math.min(a.dur, (ev.clientX - r.left) / PX)); AnimEd.movePlayhead(ui().animT); };
        go(e);
        VN.drag(e, (dx, dy, ev) => go(ev), () => VN.render());
      };
      ruler.addEventListener('mousedown', (e) => { ui().animPlay = false; scrub(e, ruler); });
      inner.appendChild(el('div', { class: 'tl-ruler' }, el('div', { class: 'tl-head' }, 'Zeit'), ruler));
      for (const row of AnimEd.rows(a)) {
        const lane = el('div', { class: 'tl-lane an-lane', style: { width: W + 'px', backgroundImage: `repeating-linear-gradient(90deg, #22242b 0 1px, transparent 1px ${PX / 2}px)` } });
        row.keys.forEach((k, i) => {
          const sel = ui().animKey && ui().animKey.row === row.id && Math.abs(ui().animKey.t - k.t) < 0.001;
          const d = el('div', { class: 'an-key' + (sel ? ' sel' : ''), title: k.t.toFixed(2) + ' s' + (k.a != null ? ' · ' + k.a + '°' : ''), style: { left: k.t * PX + 'px', background: row.color } });
          d.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (e.button !== 0) return;
            const t0 = k.t;
            ui().animKey = { row: row.id, t: k.t };
            if (row.bone) ui().animBone = row.bone;
            VN.drag(e, (dx) => { k.t = Math.max(0, Math.min(a.dur, Math.round((t0 + dx / PX) * 20) / 20)); d.style.left = k.t * PX + 'px'; },
              (dx, dy, moved) => { if (!moved) { ui().animT = k.t; VN.render(); return; } const nt = k.t; k.t = t0; VN.mutate(() => { k.t = nt; row.keys.sort((x, y) => x.t - y.t); ui().animKey = { row: row.id, t: nt }; ui().animT = nt; }); });
          });
          d.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); VN.mutate(() => { row.keys.splice(row.keys.indexOf(k), 1); ui().animKey = null; }); });
          lane.appendChild(d);
        });
        lane.addEventListener('mousedown', (e) => { ui().animPlay = false; if (row.bone) ui().animBone = row.bone; scrub(e, lane); });
        inner.appendChild(el('div', { class: 'tl-row an-row' + (row.bone && ui().animBone === row.bone ? ' sel' : '') },
          el('div', { class: 'tl-head' }, el('span', { class: 'sw', style: { background: row.color } }), row.label), lane));
      }
      // Audiospur
      if (a.type === 'scene') {
        const lane = el('div', { class: 'tl-lane an-lane', style: { width: W + 'px' } });
        for (const au of a.audio || []) {
          const asset = VN.asset(au.asset);
          lane.appendChild(el('div', { class: 'clip audio', style: { left: (au.at || 0) * PX + 'px', width: Math.max(40, (Fx.audioDur(au.asset) || 2) * PX) + 'px', background: '#a58cf0', color: '#17112a' }, title: 'Rechtsklick entfernt',
            oncontextmenu: (e) => { e.preventDefault(); VN.mutate(() => { a.audio = a.audio.filter((x) => x !== au); }); },
            onmousedown: (e) => { e.stopPropagation(); const s0 = au.at || 0; const n = e.currentTarget; VN.drag(e, (dx) => { au.at = Math.max(0, Math.round((s0 + dx / PX) * 20) / 20); n.style.left = au.at * PX + 'px'; }, (dx, dy, moved) => { if (moved) { const v = au.at; au.at = s0; VN.mutate(() => { au.at = v; }); } }); } },
            el('span', null, asset ? asset.name : 'Audio')));
        }
        lane.appendChild(el('div', { class: 'lane-hint', style: { left: '8px' } }, (a.audio || []).length ? '' : 'Audio hierher ziehen (Stimme oder Musik zum Timing)'));
        lane.addEventListener('dragover', (e) => { if (Array.from(e.dataTransfer.types).includes('vn/asset-audio')) { e.preventDefault(); lane.classList.add('dragover'); } });
        lane.addEventListener('dragleave', () => lane.classList.remove('dragover'));
        lane.addEventListener('drop', (e) => { const id = e.dataTransfer.getData('vn/asset-audio'); if (!id) return; e.preventDefault(); const r = lane.getBoundingClientRect(); VN.mutate(() => { a.audio = a.audio || []; a.audio.push({ id: VN.uid('au'), asset: id, at: Math.max(0, Math.round((e.clientX - r.left) / PX * 20) / 20), vol: 90 }); }); });
        inner.appendChild(el('div', { class: 'tl-row audio sep' }, el('div', { class: 'tl-head' }, el('span', { class: 'sw', style: { background: '#a58cf0' } }), 'Audio'), lane));
      }
      inner.appendChild(el('div', { class: 'tl-beatcol an-playhead', style: { left: (150 + t * PX) + 'px', width: '2px', top: '26px' } }));
      scroll.appendChild(inner);
      tl.appendChild(scroll);
      return tl;
    },
    movePlayhead(t) { const p = document.querySelector('.an-playhead'); if (p) p.style.left = (150 + t * PX) + 'px'; },
    actorSelect(a) {
      const s = el('select', { class: 'small-input', onchange: (e) => { ui().animActor = e.target.value; ui().animBone = null; VN.render(); } });
      for (const ac of a.actors) { const o = el('option', { value: ac.id }, (VN.asset(ac.asset) || {}).name || 'Darsteller'); if (ac === actorOf(a)) o.selected = true; s.appendChild(o); }
      return s;
    },

    // ---------- Inspektor ----------
    inspector() {
      const a = cur();
      const box = el('div', { class: 'insp' }, el('div', null, el('h3', null, 'Animation'), el('div', { class: 'insp-title' }, a ? a.name : 'Animations-Editor')));
      if (!a) { box.appendChild(el('div', { class: 'hint-box' }, 'Lege links eine Animation an.')); return box; }
      const set = (o, k, num) => (v) => VN.mutate(() => { o[k] = num ? Number(v) : v; });
      const field = (label, input) => el('div', { class: 'field' }, el('div', { class: 'lbl' }, label), input);
      const t = ui().animT || 0;
      const actor = actorOf(a);
      const rig = rigOf(actor);
      box.append(
        el('div', { class: 'grid2' },
          field('Länge (Sekunden)', el('input', { type: 'number', min: 0.2, step: 0.1, value: a.dur, onchange: (e) => VN.mutate(() => { a.dur = Math.max(0.2, Number(e.target.value) || 1); }) })),
          field('Art', (() => { const s = el('select', { onchange: (e) => VN.mutate(() => { a.type = e.target.value; a.loop = a.type === 'idle'; }) }); for (const [v, l] of [['idle', 'Idle (Schleife)'], ['gesture', 'Geste (einmal)'], ['scene', 'Zwischensequenz']]) { const o = el('option', { value: v }, l); if (v === a.type) o.selected = true; s.appendChild(o); } return s; })())),
        a.type === 'scene' ? field('Hintergrund', VN.assetSelect('image', a.bg, set(a, 'bg'))) : null);

      // Darsteller
      const acCard = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, a.type === 'scene' ? 'Darsteller' : 'Figur'));
      for (const ac of a.actors) {
        const on = ac === actor;
        acCard.appendChild(el('div', { class: 'logic-row' + (on ? ' an-ac-sel' : ''), onclick: () => { ui().animActor = ac.id; VN.render(); } },
          el('span', { class: 'mini-thumb', style: { backgroundImage: `url("${VN.assetUrl(ac.asset)}")` } }),
          (() => { const s = VN.assetSelect('image', ac.asset, (v) => VN.mutate(() => { ac.asset = v; })); s.onclick = (e) => e.stopPropagation(); return s; })(),
          VN.project.rigs[ac.asset] ? el('span', { class: 'chip green' }, 'Bones') : el('span', { class: 'chip' }, 'ohne Bones'),
          a.type === 'scene' ? el('button', { class: 'btn tiny danger', onclick: (e) => { e.stopPropagation(); VN.mutate(() => { a.actors = a.actors.filter((x) => x !== ac); }); } }, '×') : null));
      }
      if (a.type === 'scene') acCard.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const img = VN.assetsOf('image').find((x) => VN.project.rigs[x.id]) || VN.assetsOf('image')[0]; const ac = { id: VN.uid('ac'), asset: img ? img.id : null, x: 50, y: 0, scale: 100, flip: false, bones: {}, move: [] }; a.actors.push(ac); ui().animActor = ac.id; }) }, '+ Darsteller'));
      if (actor) {
        const pl = Anim.place(actor, t);
        acCard.append(
          el('div', { class: 'grid2' },
            field('Größe %', el('input', { type: 'number', value: Math.round(pl.scale), onchange: (e) => VN.mutate(() => { if (a.type === 'scene') AnimEd.setKey(actor.move = actor.move || [], t, { scale: Number(e.target.value) }); else actor.scale = Number(e.target.value); }) })),
            el('label', { class: 'check', style: { alignSelf: 'flex-end' } }, el('input', { type: 'checkbox', checked: !!actor.flip, onchange: (e) => VN.mutate(() => { actor.flip = e.target.checked; }) }), 'Spiegeln')),
          !rig ? el('div', { class: 'muted small' }, 'Diese Figur hat noch keine Bones. ', el('button', { class: 'btn tiny', onclick: () => App.openBones(actor.asset) }, 'Bones einrichten')) : null);
      }
      box.appendChild(acCard);

      // Ausgewählter Keyframe
      const kSel = ui().animKey;
      if (kSel && actor) {
        const row = AnimEd.rows(a).find((r) => r.id === kSel.row);
        const k = row && row.keys.find((x) => Math.abs(x.t - kSel.t) < 0.001);
        if (k) {
          const flds = row.id === 'move' ? [['x', 'X %'], ['y', 'Höhe %'], ['scale', 'Größe %'], ['rot', 'Drehung °'], ['opacity', 'Deckkraft']] : row.id === 'cam' ? [['zoom', 'Zoom %'], ['panX', 'Schwenk X'], ['panY', 'Schwenk Y'], ['rot', 'Drehung °']] : [['a', 'Winkel °']];
          box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, '◆ Keyframe · ' + row.label),
            el('div', { class: 'kf-grid' },
              el('label', null, el('span', { class: 'muted small' }, 'Zeit s'), el('input', { type: 'number', step: 0.05, value: k.t, onchange: (e) => VN.mutate(() => { k.t = Math.max(0, Math.min(a.dur, Number(e.target.value))); row.keys.sort((x, y) => x.t - y.t); ui().animKey = { row: row.id, t: k.t }; }) })),
              ...flds.map(([f, l]) => el('label', null, el('span', { class: 'muted small' }, l), el('input', { type: 'number', step: 0.5, value: k[f] != null ? k[f] : '', onchange: (e) => VN.mutate(() => { k[f] = e.target.value === '' ? undefined : Number(e.target.value); }) })))),
            el('div', { class: 'row gap8' }, el('span', { class: 'muted small' }, 'Kurve zum Keyframe'), (() => { const s = el('select', { onchange: (e) => VN.mutate(() => { k.e = e.target.value; }) }); for (const [v, l] of Fx.EASE_LIST) { const o = el('option', { value: v }, l); if (v === (k.e || 'ease-in-out')) o.selected = true; s.appendChild(o); } return s; })()),
            el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { row.keys.splice(row.keys.indexOf(k), 1); ui().animKey = null; }) }, 'Keyframe löschen')));
        }
      }
      if (a.type === 'scene') {
        const c = Anim.cam(a, t);
        box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Kamera bei ' + t.toFixed(2) + ' s'),
          ...[['zoom', 'Zoom', 100, 300], ['panX', 'Schwenk X', -40, 40], ['panY', 'Schwenk Y', -40, 40]].map(([f, l, mn, mx]) => {
            const lab = el('div', { class: 'lbl' }, l + ': ' + Math.round(c[f]));
            return el('div', { class: 'field' }, lab, el('input', { type: 'range', min: mn, max: mx, value: c[f], oninput: (e) => { lab.textContent = l + ': ' + e.target.value; }, onchange: (e) => VN.mutate(() => { AnimEd.setKey(a.cam = a.cam || [], t, { [f]: Number(e.target.value), zoom: f === 'zoom' ? Number(e.target.value) : c.zoom, panX: f === 'panX' ? Number(e.target.value) : c.panX, panY: f === 'panY' ? Number(e.target.value) : c.panY }); ui().animKey = { row: 'cam', t }; }) }));
          })));
      }

      // Posen und Vorlagen
      if (actor && rig) {
        const p = VN.project;
        const nameIn = el('input', { type: 'text', class: 'small-input', placeholder: 'Name der Pose', style: { flex: '1', minWidth: '0' } });
        const applyPose = (angles, mirror) => VN.mutate(() => {
          actor.bones = actor.bones || {};
          for (const b of rig.bones) {
            let n = b.name, v = angles[b.name];
            if (mirror) { const src = mirrorName(b.name); v = angles[src]; v = v != null ? -v : undefined; }
            if (v == null) v = 0;
            AnimEd.setKey(actor.bones[n] = actor.bones[n] || [], t, { a: Math.round(v * 10) / 10 });
          }
        });
        const tpl = TEMPLATES[rig.template] || [];
        box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Posen'),
          el('div', { class: 'row gap4' }, nameIn, el('button', { class: 'btn tiny primary', onclick: () => VN.mutate(() => { p.poses.push({ id: VN.uid('ps'), name: nameIn.value.trim() || 'Pose ' + (p.poses.length + 1), template: rig.template, angles: Anim.angles(actor, t) }); }) }, 'Pose speichern')),
          el('button', { class: 'btn tiny', onclick: () => applyPose(Anim.angles(actor, t), true) }, '⇋ Aktuelle Pose spiegeln'),
          ...p.poses.filter((ps) => !ps.template || ps.template === rig.template).map((ps) => el('div', { class: 'logic-row' },
            el('span', { style: { flex: '1' } }, ps.name),
            el('button', { class: 'btn tiny', onclick: () => applyPose(ps.angles) }, 'Anwenden'),
            el('button', { class: 'btn tiny', title: 'gespiegelt anwenden', onclick: () => applyPose(ps.angles, true) }, '⇋'),
            el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { p.poses = p.poses.filter((x) => x !== ps); }) }, '×'))),
          a.actors.length > 1 ? el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { for (const o of a.actors) if (o !== actor && rigOf(o) && rigOf(o).template === rig.template) o.bones = JSON.parse(JSON.stringify(actor.bones || {})); }) }, 'Auf andere Figuren übertragen') : null,
          el('div', { class: 'muted small' }, 'Posen und Bewegungen passen auf alle Figuren mit dem gleichen Körper-Typ (' + ((Rig.TEMPLATES[rig.template] || {}).label || rig.template || 'eigene Knochen') + ').')));
        if (tpl.length) box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Fertige Bewegungen'),
          el('div', { class: 'tpl-btns' }, ...tpl.map((tp) => el('button', { class: 'btn tiny', title: tp.type === 'idle' ? 'Schleife' : 'Geste', onclick: () => VN.mutate(() => {
            actor.bones = actor.bones || {};
            for (const [n, keys] of Object.entries(tp.bones)) actor.bones[n] = JSON.parse(JSON.stringify(keys)).map((k) => Object.assign(k, { t: Math.round((k.t + (a.type === 'scene' ? t : 0)) * 100) / 100 }));
            if (a.type !== 'scene') { a.dur = tp.dur; a.loop = tp.type === 'idle'; }
            else a.dur = Math.max(a.dur, t + tp.dur);
            if (a.name.startsWith('Neue ')) a.name = tp.label;
          }) }, (tp.type === 'idle' ? '∞ ' : '✋ ') + tp.label))),
          el('div', { class: 'muted small' }, a.type === 'scene' ? 'In Zwischensequenzen beginnt die Bewegung an der Abspielposition.' : 'Ersetzt die Keyframes der betroffenen Knochen.')));
      }

      // Verwendung
      const use = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Verwenden'));
      if (a.type === 'idle') use.appendChild(el('div', { class: 'muted small' }, 'Figuren-Clip auswählen → „Idle-Animation“ → „' + a.name + '“. Läuft dann als Dauer-Schleife.'));
      if (a.type === 'gesture') use.appendChild(el('div', { class: 'muted small' }, 'Figuren-Clip auswählen → „Geste bei Schritt …“ → „' + a.name + '“. Spielt einmal und kehrt weich ins Idle zurück.'));
      if (a.type === 'scene') {
        const s = VN.curScene();
        use.append(
          el('button', { class: 'btn', disabled: !s || s.type !== 'story', onclick: () => {
            const sc = VN.curScene();
            VN.mutate(() => { const b = sc.beats; sc.beats += 1; sc.tracks.video.push({ id: VN.uid('c'), start: b, len: 1, anim: a.id, layer: 'front', waitEnd: true, skippable: true, vol: 90 }); });
            VN.toast('Live-Zwischensequenz am Ende von „' + sc.name + '“ eingefügt');
          } }, '➕ Live in „' + ((s && s.type === 'story') ? s.name : 'Szene') + '“ einfügen'),
          el('button', { class: 'btn primary', onclick: () => AnimEd.renderVideo(a) }, '🎬 Als Video rendern (WebM)'),
          el('div', { class: 'muted small' }, 'Live: gestochen scharf und winzig. Video: für sehr aufwändige Szenen oder zur Nutzung außerhalb des Spiels (Trailer, YouTube).'));
      }
      box.appendChild(use);
      box.appendChild(el('button', { class: 'btn danger', onclick: () => VN.mutate(() => { VN.project.anims = VN.project.anims.filter((x) => x !== a); ui().animSel = null; }) }, 'Animation löschen'));
      return box;
    },

    // Browser-Aufnahmen haben keine Längenangabe: Duration ins WebM-Info-Element schreiben
    fixWebmDuration(buf, ms) {
      try {
        const find = (id, from, to) => { for (let i = from; i < Math.min(to, buf.length - id.length); i++) { let ok = true; for (let j = 0; j < id.length; j++) if (buf[i + j] !== id[j]) { ok = false; break; } if (ok) return i; } return -1; };
        const at = find([0x15, 0x49, 0xa9, 0x66], 0, 8192);
        if (at < 0) return buf;
        const sp = at + 4;
        let len = 1; while (len <= 8 && !(buf[sp] & (0x80 >> (len - 1)))) len++;
        if (len > 8) return buf;
        let size = buf[sp] & (0xff >> len);
        for (let i = 1; i < len; i++) size = size * 256 + buf[sp + i];
        const cs = sp + len, ce = cs + size;
        if (find([0x44, 0x89], cs, ce) >= 0) return buf;
        const dur = new Uint8Array(11); dur[0] = 0x44; dur[1] = 0x89; dur[2] = 0x88;
        new DataView(dur.buffer).setFloat64(3, ms, false);
        const ns = size + 11;
        const L = Math.max(len, ns < 127 ? 1 : ns < 16383 ? 2 : 4);
        const sv = new Uint8Array(L);
        let v = ns; for (let i = L - 1; i >= 0; i--) { sv[i] = v & 0xff; v = Math.floor(v / 256); }
        sv[0] |= 0x80 >> (L - 1);
        const out = new Uint8Array(buf.length + 11 + (L - len));
        out.set(buf.subarray(0, sp), 0);
        out.set(sv, sp);
        out.set(buf.subarray(cs, ce), sp + L);
        out.set(dur, sp + L + size);
        out.set(buf.subarray(ce), sp + L + size + 11);
        return out;
      } catch (e) { console.warn('WebM-Dauer', e); return buf; }
    },

    // ---------- Video rendern (Echtzeit, WebM mit Ton) ----------
    async renderVideo(a, opts = {}) {
      if (typeof MediaRecorder === 'undefined') return VN.toast('Video-Aufnahme wird hier nicht unterstützt');
      const r = VN.res();
      const k = Math.min(1, 1920 / r.w, 1080 / r.h);
      const W = Math.round(r.w * k / 2) * 2, H = Math.round(r.h * k / 2) * 2;
      const back = el('div', { class: 'modal-back' });
      const prev = el('canvas', { width: W, height: H, class: 'render-prev' });
      const bar = el('span', { style: { width: '0%', background: 'var(--accent)' } });
      const info = el('div', { class: 'muted small' }, 'Wird vorbereitet …');
      back.appendChild(el('div', { class: 'modal', style: { width: '720px' } }, el('strong', null, '🎬 Video wird gerendert: ' + a.name), prev, el('div', { class: 'pbar' }, bar), info));
      document.body.appendChild(back);
      try {
        const sc = await Anim.build(a);
        const ctx = prev.getContext('2d');
        Anim.draw(ctx, sc, 0, 0, { bgFill: true });
        const stream = prev.captureStream(30);
        const actx = new AudioContext();
        const dest = actx.createMediaStreamDestination();
        const bufs = [];
        for (const au of a.audio || []) {
          try { const b = await actx.decodeAudioData(await (await fetch(VN.assetUrl(au.asset))).arrayBuffer()); bufs.push([au, b]); } catch (e) { console.warn(e); }
        }
        try { await actx.resume(); } catch (e) { /* egal */ }
        // Ohne Ton keine Audiospur, sonst wartet der Recorder auf Ton, der nie kommt
        const withAudio = bufs.length > 0 && actx.state === 'running';
        const tracks = [...stream.getVideoTracks(), ...(withAudio ? dest.stream.getAudioTracks() : [])];
        const mime = (withAudio ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']).find((m) => MediaRecorder.isTypeSupported(m));
        const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 8e6 });
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        const stopped = new Promise((res) => { rec.onstop = res; });
        rec.start(250);
        const start = performance.now();
        const t0 = actx.currentTime + 0.05;
        for (const [au, b] of bufs) { const s = actx.createBufferSource(); s.buffer = b; const g = actx.createGain(); g.gain.value = (au.vol != null ? au.vol : 90) / 100; s.connect(g); g.connect(dest); s.start(t0 + (au.at || 0)); }
        await new Promise((done) => {
          let last = start;
          const frame = (now) => {
            const t = Math.min(a.dur, (now - start) / 1000);
            Anim.draw(ctx, sc, t, Math.min(1 / 30, (now - last) / 1000), { bgFill: true });
            last = now;
            bar.style.width = (t / a.dur * 100) + '%';
            info.textContent = t.toFixed(1) + ' / ' + a.dur.toFixed(1) + ' s · ' + W + ' × ' + H;
            if (t >= a.dur) return done();
            requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        });
        await new Promise((res) => setTimeout(res, 200));
        rec.stop();
        await stopped;
        actx.close();
        const blob = new Blob(chunks, { type: 'video/webm' });
        const bytes = AnimEd.fixWebmDuration(new Uint8Array(await blob.arrayBuffer()), a.dur * 1000);
        if (!bytes.length) throw new Error('Die Aufnahme ist leer geblieben.');
        const safe = (a.name || 'animation').replace(/[^\wäöüÄÖÜß -]/g, '').trim().replace(/\s+/g, '_') || 'animation';
        const rel = await VN.api.writeAsset(VN.dir, 'assets/' + safe + '.webm', bytes);
        const [asset] = VN.registerAssets([{ name: a.name + ' (Video)', kind: 'video', file: rel }]);
        info.textContent = 'Fertig: ' + (bytes.length / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB · liegt jetzt unter „Video“ in den Dateien.';
        bar.style.width = '100%';
        back.firstChild.appendChild(el('div', { class: 'row gap8', style: { justifyContent: 'flex-end' } },
          el('button', { class: 'btn', onclick: () => VN.api.saveBinary(safe + '.webm', bytes, 'webm') }, 'Auch woanders speichern …'),
          VN.curScene() && VN.curScene().type === 'story' ? el('button', { class: 'btn', onclick: () => { const sc2 = VN.curScene(); VN.mutate(() => { const b = sc2.beats; sc2.beats += 1; sc2.tracks.video.push({ id: VN.uid('c'), start: b, len: 1, asset: asset.id, layer: 'front', waitEnd: true, skippable: true, vol: 90, fit: 'cover' }); }); VN.toast('Video in „' + sc2.name + '“ eingefügt'); back.remove(); } }, 'In aktuelle Szene einfügen') : null,
          el('button', { class: 'btn primary', onclick: () => back.remove() }, 'Schließen')));
        AnimEd.lastVideo = { asset: asset.id, size: bytes.length };
        return asset;
      } catch (e) {
        console.error(e);
        info.textContent = 'Rendern fehlgeschlagen: ' + e.message;
        back.firstChild.appendChild(el('button', { class: 'btn', onclick: () => back.remove() }, 'Schließen'));
      }
    }
  });
})();
