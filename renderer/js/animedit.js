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

    // Bildrate (0.9.9): Animation (a) und Grundeinstellung fürs Projekt
    fpsFields(a) {
      const p = VN.project;
      const mk = (val, opts, commit) => { const s = el('select', { onchange: (e) => commit(e.target.value) }); for (const [v, l] of opts) { const o = el('option', { value: v }, l); if (String(v) === String(val == null ? '' : val)) o.selected = true; s.appendChild(o); } return s; };
      const projName = (VN.FPS_LIST.find((x) => Number(x[0]) === Number(p.animFps || 0)) || VN.FPS_LIST[0])[1];
      return el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Bildrate'),
        a ? el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Diese Animation'), mk(a.fps != null ? a.fps : '', [['', VN.t('Wie im Projekt') + ' (' + VN.t(projName) + ')'], ...VN.FPS_LIST], (v) => VN.mutate(() => { if (v === '') delete a.fps; else a.fps = Number(v); }))) : null,
        el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Grundeinstellung fürs ganze Projekt'), mk(p.animFps || 0, VN.FPS_LIST, (v) => VN.mutate(() => { if (Number(v)) p.animFps = Number(v); else delete p.animFps; }))),
        el('div', { class: 'muted small' }, 'Weniger Bilder pro Sekunde wirken gezeichnet wie im Anime oder Cartoon: jedes Bild bleibt kurz stehen. Gilt für Animationen, Idle, Gesten, Bones und Gliederpuppen. Dialoge, Menüs und Kamerafahrten bleiben flüssig.'),
        // Smear-Bilder (0.9.9)
        window.Smear ? el('div', { class: 'sec-title', style: { marginTop: '8px' } }, 'Smear-Bilder') : null,
        window.Smear && a ? el('div', { class: 'muted small' }, 'Diese Animation') : null,
        window.Smear && a ? Smear.fields(a, 'smear', VN.t('Wie im Projekt')) : null,
        window.Smear && a ? AnimEd.smearMarks(a) : null,
        a && (a.type || 'gesture') === 'gesture' ? AnimEd.hitMark(a) : null,
        window.Smear ? el('div', { class: 'muted small' }, 'Grundeinstellung fürs ganze Projekt') : null,
        window.Smear ? Smear.fields(p, 'smear', null) : null,
        window.Smear ? el('div', { class: 'muted small' }, 'Bei sehr schnellen Bewegungen (Faustschlag, Ausholen, Sprung) zeichnet die Engine ein Smear-Bild: Mehrfachbilder, ein lang gezogenes Körperteil oder Speedlines. Passt besonders gut zu 12 oder 8 Bildern pro Sekunde.') : null);
    },
    // Trefferpunkt (0.9.16): wann im Kampf Effekt, Schaden und Ton erscheinen
    hitMark(a) {
      const t = Math.round((VN.ui.animT || 0) * 100) / 100;
      return el('div', { class: 'field' },
        el('div', { class: 'lbl' }, VN.t('Trefferpunkt im Kampf') + ': ' + (a.hitAt != null ? Number(a.hitAt).toFixed(2) + ' s' : VN.t('Mitte'))),
        el('div', { class: 'row gap8' },
          el('button', { class: 'btn tiny', title: VN.t('Im Kampf erscheinen Effekt, Schaden und Ton genau hier'), onclick: () => VN.mutate(() => { a.hitAt = t; }) }, '💥 ' + VN.t('Treffer hier') + ' · ' + t.toFixed(2) + ' s'),
          a.hitAt != null ? el('button', { class: 'btn tiny', onclick: () => { VN.ui.animT = a.hitAt; VN.render(); } }, VN.t('Hinspringen')) : null,
          a.hitAt != null ? el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { delete a.hitAt; }) }, '×') : null));
    },
    // Smear-Bilder von Hand an der Stelle des Abspielkopfs
    smearMarks(a) {
      const t = Math.round((VN.ui.animT || 0) * 100) / 100;
      const L = (a.smearAt || []).slice().sort((x, y) => x - y);
      const has = L.some((x) => Math.abs(x - t) < 0.005);
      return el('div', { class: 'field' },
        el('button', { class: 'btn tiny' + (has ? ' primary' : ''), title: VN.t('Erzwingt an dieser Stelle ein Smear-Bild, auch wenn die Bewegung nicht schnell genug ist'), onclick: () => VN.mutate(() => { a.smearAt = (a.smearAt || []).filter((x) => Math.abs(x - t) >= 0.005); if (!has) a.smearAt.push(t); if (!a.smearAt.length) delete a.smearAt; }) }, (has ? '✦ ' + VN.t('Smear-Bild entfernen') : '✦ ' + VN.t('Smear-Bild hier')) + ' · ' + t.toFixed(2) + ' s'),
        L.length ? el('div', { class: 'row gap4', style: { flexWrap: 'wrap', marginTop: '4px' } }, ...L.map((x) => el('span', { class: 'chip', style: { cursor: 'pointer' }, title: VN.t('Hinspringen'), onclick: () => { VN.ui.animT = x; VN.render(); } }, '✦ ' + x.toFixed(2) + ' s'))) : null);
    },
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
          el('div', { class: 'muted small' }, 'Figuren brauchen dafür Bones (Reiter „Figuren“ → „Bones & Blinzeln“) – oder du nimmst eine Gliederpuppe aus Körperteilen (Reiter „Figuren“ → „Gliederpuppen“).'),
          el('div', { style: { maxWidth: '420px', margin: '14px auto 0', textAlign: 'left' } }, AnimEd.fpsFields(null))));
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
        el('label', { class: 'check btn' }, el('input', { type: 'checkbox', checked: ui().animBones !== false, onchange: (e) => { ui().animBones = e.target.checked; VN.render(); } }), 'Knochen'),
        // Nähte zwischen Figuren (0.9.12): z. B. Hand von Figur 2 an die Schulter von Figur 1
        a.type === 'scene' && a.actors.filter((x) => x.puppet).length >= 2 ? el('button', { class: 'btn' + (ui().animSew ? ' primary' : ''), title: VN.t('Ein Teil der gewählten Gliederpuppe an ein Teil einer anderen Figur annähen – es bewegt sich dann mit der anderen Figur mit'), onclick: () => { ui().animSew = !ui().animSew; ui().animPlay = false; VN.render(); } }, ui().animSew ? '✓ Annähen' : '🧵 Annähen') : null));
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
      // Wurde ein Körperteil im Bild gewählt, die passende Ebene unten ins Blickfeld holen
      const selKey = (ui().animPart || '') + '|' + (ui().animBone || '');
      if (AnimEd._selSeen !== selKey) {
        AnimEd._selSeen = selKey;
        requestAnimationFrame(() => { const r = main.querySelector('.an-row.sel'); const sc = r && r.closest('.tl-scroll'); if (sc) { const rt = r.offsetTop, h = sc.clientHeight; if (rt < sc.scrollTop + 26 || rt + r.offsetHeight > sc.scrollTop + h) sc.scrollTop = Math.max(0, rt - h / 2); } });
      }
      AnimEd.startStage(a, stage, canvas, svg);
    },

    // Bühne zeichnen (läuft, solange die Ansicht offen ist)
    async startStage(a, stage, canvas, svg) {
      const key = JSON.stringify([a.id, a.bg, (a.actors || []).map((x) => [x.asset, x.puppet, x.puppet && window.Puppet && Puppet.get(x.puppet) ? Puppet.get(x.puppet).parts.map((p) => [p.asset, p.bones]) : null])]);
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
        // Bildrate (0.9.9): beim Abspielen nur auf dem Zeitraster neu zeichnen – so sieht man den Cartoon-Look schon hier
        const fps = VN.animFps(a.fps);
        if (ui().animPlay && fps && !VN.fpsStep(AnimEd, ui().animT || 0, fps) && AnimEd._maps) { AnimEd._raf = requestAnimationFrame(frame); return; }
        const t = ui().animPlay && fps ? Math.floor((ui().animT || 0) * fps + 1e-6) / fps : ui().animT || 0;
        const bgOpts = { bgFill: true, bgColor: '#15161b' };
        AnimEd._cvW = canvas.width; AnimEd._cvH = canvas.height;
        const dd = fps ? 1 / fps : dt;
        if (ui().animOnion && !ui().animPlay) {
          Anim.draw(ctx, sc, Math.max(0, t - 0.25), 0, Object.assign({ alpha: 0.2 }, bgOpts));
          Anim.draw(ctx, sc, Math.min(a.dur, t + 0.25), 0, { alpha: 0.2, noClear: true, noBg: true });
          AnimEd._maps = Anim.draw(ctx, sc, t, ui().animPlay ? dd : 0, { noClear: true, noBg: true });
        } else AnimEd._maps = Anim.draw(ctx, sc, t, ui().animPlay ? dd : 0, bgOpts);
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
      if (ui().animMouthEd) { AnimEd.drawMouth(svg, a, actor); return; }
      if (ui().animMaskEd && actor.mask && actor.mask.on) { AnimEd.drawMask(svg, a, actor); return; }
      const [bx, by] = m.base;
      const mk = (tag, at) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(at)) n.setAttribute(k, v); svg.appendChild(n); return n; };
      if (a.type === 'scene') mk('circle', { cx: bx, cy: by, r: 7, fill: 'none', stroke: '#8fc3f0', 'stroke-width': 2, 'stroke-dasharray': '3 2' });
      if (m.it.pup) { AnimEd.drawPuppet(mk, m, actor); return; }
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
        if (ui().animMouthEd && actor && AnimEd.mouthDown(e, px, py, svg, r, kx, a, actor)) return;
        if (ui().animMaskEd && actor && actor.mask && actor.mask.on && AnimEd.maskDown(e, px, py, svg, r, kx, a, actor)) return;
        if (ui().animSew && actor && actor.puppet) { AnimEd.sewDown(e, svg, r, kx, a, actor); return; }
        if (actor && actor.puppet && AnimEd.pupDown(e, px, py, r, kx, a, actor)) return;
        const hit = (AnimEd._joints || []).slice().reverse().find((j) => Math.hypot(j.tx - px, j.ty - py) < 12);
        const t = ui().animT || 0;
        if (hit && actor && !e.altKey) {
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
        // Alt + Ziehen: die gewählte Figur verschieben, egal wo man anfasst (auch über Knochen-Griffen)
        if (e.altKey && actor) pick = maps.find((m) => m.it.actor === actor) || pick;
        if (!pick) return;
        ui().animActor = pick.it.actor.id;
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

    // ---------- Mund & Lippenlinie (0.9.24) ----------
    geoOf(actor) { const m = (AnimEd._maps || []).find((x) => x.it.actor === actor); return m && m.geo ? m.geo : null; },
    // Normierter Bildpunkt ↔ Leinwand
    nToPx(actor, p, bone) { const g = AnimEd.geoOf(actor); if (!g || !p) return null; const [lx, ly] = g.toLocal(p[0], p[1], bone); return Anim.Mouth.ap(g.mat, lx, ly); },
    pxToN(actor, x, y, bone) { const g = AnimEd.geoOf(actor); if (!g) return null; const [a, b, c, d, e, f] = g.mat, det = a * d - b * c || 1; const lx = (d * (x - e) - c * (y - f)) / det, ly = (-b * (x - e) + a * (y - f)) / det; return g.fromLocal(lx, ly, bone).map((v) => Math.round(v * 10000) / 10000); },
    mouthSteps(actor) { return actor.mouth && actor.mouth.on ? (actor.mouth.view === 'pov' ? [['up', 'Mundwinkel links'], ['lo', 'Mundwinkel rechts'], ['hinge', 'Kinn']] : [['up', 'Oberlippe'], ['lo', 'Unterlippe'], ['hinge', 'Kiefergelenk']]) : actor.mouthProp && actor.mouthProp.target ? [['back', 'Griff (hinteres Ende)'], ['tip', 'Spitze']] : []; },
    drawMouth(svg, a, actor) {
      const NS = 'http://www.w3.org/2000/svg';
      const mk = (tag, at, txt) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(at)) n.setAttribute(k, v); if (txt) n.textContent = txt; svg.appendChild(n); return n; };
      if (actor.mouth && actor.mouth.on) {
        const mo = actor.mouth, U = AnimEd.nToPx(actor, mo.up, mo.bone), L = AnimEd.nToPx(actor, mo.lo, mo.bone), H = AnimEd.nToPx(actor, mo.hinge, mo.bone);
        if (U && L) mk('line', { x1: U[0], y1: U[1], x2: L[0], y2: L[1], stroke: '#ff7fa8', 'stroke-width': 3, 'stroke-linecap': 'round' });
        if (mo.view === 'pov' && U && L && H) {
          const M = [(U[0] + L[0]) / 2, (U[1] + L[1]) / 2], w = Math.hypot(L[0] - U[0], L[1] - U[1]) || 1, e = [(L[0] - U[0]) / w, (L[1] - U[1]) / w];
          let dd = [-e[1], e[0]]; if ((H[0] - M[0]) * dd[0] + (H[1] - M[1]) * dd[1] < 0) dd = [-dd[0], -dd[1]];
          const cd = Math.max(w * 0.3, (H[0] - M[0]) * dd[0] + (H[1] - M[1]) * dd[1]), jf = Math.max(0.5, Number(mo.jaw) || 2.2) / 2.2;
          const jc = [M[0] + dd[0] * cd * 0.55, M[1] + dd[1] * cd * 0.55], rot = Math.atan2(e[1], e[0]) * 180 / Math.PI;
          mk('ellipse', { cx: jc[0], cy: jc[1], rx: w * 0.95 * jf, ry: cd * 0.75 * jf, transform: `rotate(${rot} ${jc[0]} ${jc[1]})`, fill: 'rgba(255,127,168,0.10)', stroke: 'rgba(255,255,255,.35)', 'stroke-dasharray': '3 5' });
          mk('line', { x1: M[0], y1: M[1], x2: H[0], y2: H[1], stroke: '#fff', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' });
        } else if (U && L && H) {
          const M = [(U[0] + L[0]) / 2, (U[1] + L[1]) / 2];
          mk('line', { x1: M[0], y1: M[1], x2: H[0], y2: H[1], stroke: '#fff', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' });
          // Pfeil: Einfuhrrichtung (dahinter unsichtbar)
          let n = [H[0] - M[0], H[1] - M[1]]; const l = Math.hypot(...n) || 1; n = [n[0] / l, n[1] / l]; if (mo.flip) n = [-n[0], -n[1]];
          const A = [M[0] - n[0] * 34, M[1] - n[1] * 34], B = [M[0] - n[0] * 8, M[1] - n[1] * 8];
          mk('line', { x1: A[0], y1: A[1], x2: B[0], y2: B[1], stroke: '#4d7cff', 'stroke-width': 3 });
          mk('circle', { cx: B[0], cy: B[1], r: 4, fill: '#4d7cff' });
          const R = Math.hypot(L[0] - H[0], L[1] - H[1]) * Math.max(0.5, Number(mo.jaw) || 2.2);
          const as = Math.atan2(M[1] - H[1], M[0] - H[0]); let dl = Math.atan2(L[1] - H[1], L[0] - H[0]) - as; while (dl > Math.PI) dl -= 2 * Math.PI; while (dl < -Math.PI) dl += 2 * Math.PI;
          const sp = (Math.max(30, Math.min(175, Number(mo.span) || 140)) * Math.PI / 180) * (dl >= 0 ? 1 : -1);
          const pts = [H]; for (let i = 0; i <= 24; i++) { const q = as + sp * i / 24; pts.push([H[0] + R * Math.cos(q), H[1] + R * Math.sin(q)]); }
          mk('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ') + ' Z', fill: 'rgba(255,127,168,0.10)', stroke: 'rgba(255,255,255,.35)', 'stroke-dasharray': '3 5' });
        }
        for (const [p, c, lab] of (mo.view === 'pov' ? [[U, '#ff7fa8', 'L'], [L, '#ff7fa8', 'R'], [H, '#ffffff', 'K']] : [[U, '#ff7fa8', 'O'], [L, '#ff7fa8', 'U'], [H, '#ffffff', 'G']])) if (p) { mk('circle', { cx: p[0], cy: p[1], r: 7, fill: c, stroke: '#222', 'stroke-width': 2 }); mk('text', { x: p[0] + 10, y: p[1] - 8, fill: '#fff', 'font-size': 12, 'font-weight': 700, 'paint-order': 'stroke', stroke: '#000', 'stroke-width': 3 }, lab); }
      }
      if (actor.mouthProp && actor.mouthProp.target) {
        const mp = actor.mouthProp, B = AnimEd.nToPx(actor, mp.back), T = AnimEd.nToPx(actor, mp.tip);
        if (B && T) mk('line', { x1: B[0], y1: B[1], x2: T[0], y2: T[1], stroke: '#ffd43b', 'stroke-width': 2, 'stroke-dasharray': '6 4' });
        if (B) mk('circle', { cx: B[0], cy: B[1], r: 7, fill: '#ffd43b', stroke: '#222', 'stroke-width': 2 });
        if (T) mk('circle', { cx: T[0], cy: T[1], r: 7, fill: '#ff922b', stroke: '#222', 'stroke-width': 2 });
      }
      const st = ui().animMouthPick;
      if (st && st.actor === actor.id) { const S = AnimEd.mouthSteps(actor)[st.i]; if (S) mk('text', { x: 12, y: 24, fill: '#fff', 'font-size': 15, 'font-weight': 700, 'paint-order': 'stroke', stroke: '#000', 'stroke-width': 4 }, '👆 ' + VN.t('Klicke:') + ' ' + VN.t(S[1])); }
    },
    // Klick setzt den nächsten Punkt (Assistent), sonst Punkte ziehen
    mouthDown(e, px, py, svg, r, kx, a, actor) {
      const steps = AnimEd.mouthSteps(actor);
      if (!steps.length) return false;
      const obj = actor.mouth && actor.mouth.on ? actor.mouth : actor.mouthProp, bone = actor.mouth && actor.mouth.on ? actor.mouth.bone : null;
      const st = ui().animMouthPick;
      e.preventDefault();
      if (st && st.actor === actor.id && steps[st.i]) {
        const nv = AnimEd.pxToN(actor, px, py, bone);
        if (!nv) return true;
        VN.mutate(() => { obj[steps[st.i][0]] = nv; st.i++; if (st.i >= steps.length) ui().animMouthPick = null; });
        return true;
      }
      const hit = steps.find(([k]) => { const q = AnimEd.nToPx(actor, obj[k], bone); return q && Math.hypot(q[0] - px, q[1] - py) < 11; });
      if (!hit) return false;
      const before = JSON.stringify(obj);
      VN.drag(e, (dx, dy, ev) => { const nv = AnimEd.pxToN(actor, (ev.clientX - r.left) * kx, (ev.clientY - r.top) * kx, bone); if (nv) obj[hit[0]] = nv; },
        (dx, dy, moved) => { if (!moved) return; const after = JSON.stringify(obj); Object.assign(obj, JSON.parse(before)); VN.mutate(() => { Object.assign(obj, JSON.parse(after)); }); });
      return true;
    },
    mouthCard(a, actor) {
      const box = el('div', { class: 'opt-card', style: { marginTop: '8px' } }, el('div', { class: 'sec-title' }, '👄 ' + VN.t('Mund & Objekt')));
      const sel = (v, opts, fn) => { const s = el('select', { class: 'small-input', onchange: (e) => VN.mutate(() => fn(e.target.value)) }); for (const [k, l] of opts) { const o = el('option', { value: k }, VN.t(l)); if (String(k) === String(v == null ? '' : v)) o.selected = true; s.appendChild(o); } return s; };
      const rng = (label, v, mn, mx, fn, unit) => { const lab = el('span', { class: 'muted small' }, VN.t(label) + ': ' + v + (unit || '')); return el('div', { class: 'field' }, lab, el('input', { type: 'range', min: mn, max: mx, value: v, oninput: (e) => { lab.textContent = VN.t(label) + ': ' + e.target.value + (unit || ''); }, onchange: (e) => VN.mutate(() => fn(Number(e.target.value))) })); };
      const editBtn = () => el('button', { class: 'btn tiny' + (ui().animMouthEd ? ' primary' : ''), onclick: () => { ui().animMouthEd = !ui().animMouthEd; VN.render(); } }, '✏ ' + VN.t('Punkte zeigen / ziehen'));
      const pickBtn = (label) => el('button', { class: 'btn tiny', onclick: () => { ui().animMouthEd = true; ui().animMouthPick = { actor: actor.id, i: 0 }; VN.render(); } }, '👆 ' + VN.t(label));
      const mo = actor.mouth, mp = actor.mouthProp;
      const isProp = mp && mp.target;
      if (!isProp) {
        box.appendChild(el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!(mo && mo.on), onchange: (e) => VN.mutate(() => { actor.mouth = Object.assign(actor.mouth || { jaw: 2.2, max: 35, innerColor: '#4a1620' }, { on: e.target.checked }); if (e.target.checked && !actor.mouth.up) { ui().animMouthEd = true; ui().animMouthPick = { actor: actor.id, i: 0 }; } }) }), VN.t('Diese Figur hat einen Mund (Lippenlinie)')));
        if (mo && mo.on) {
          const rig = actor.asset && VN.project.rigs[actor.asset];
          box.append(
            el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, VN.t('Ansicht')), sel(mo.view || 'side', [['side', 'Seitlich (Profil)'], ['pov', 'Von vorn (POV)']], (v) => { mo.view = v; mo.up = mo.lo = mo.hinge = null; ui().animMouthEd = true; ui().animMouthPick = { actor: actor.id, i: 0 }; })),
            el('div', { class: 'muted small' }, mo.view === 'pov'
              ? VN.t('Setze linken und rechten Mundwinkel und das Kinn. Kommt ein Objekt auf die Mundmitte zu, senkt sich der Unterkiefer so weit, wie das Objekt dort breit ist. Was schon im Mund ist, sieht man nur noch durch die Öffnung.')
              : VN.t('Setze Oberlippe, Unterlippe und Kiefergelenk. Kreuzt ein Objekt die Linie, klappt der Unterkiefer genau so weit auf, wie das Objekt an dieser Stelle breit ist. Dahinter ist das Objekt unsichtbar.')),
            el('div', { class: 'row gap8', style: { flexWrap: 'wrap', margin: '6px 0' } }, pickBtn(mo.up ? 'Punkte neu setzen' : 'Punkte setzen'), editBtn(),
              el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!mo.flip, onchange: (e) => VN.mutate(() => { mo.flip = e.target.checked; }) }), VN.t('Richtung umdrehen'))),
            rig ? el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, VN.t('Folgt Knochen')), sel(mo.bone || '', [['', '— keiner —'], ...rig.bones.map((b) => [b.id, b.name])], (v) => { mo.bone = v; })) : null,
            el('div', { class: 'logic-row' }, el('span', { class: 'muted small' }, VN.t('Mund-Inneres')), (() => { const s = VN.assetSelect('image', mo.inner, (v) => VN.mutate(() => { mo.inner = v; })); s.style.maxWidth = '150px'; return s; })(),
              el('input', { type: 'color', value: mo.innerColor || '#4a1620', title: VN.t('Farbe, wenn kein Bild gewählt ist'), onchange: (e) => VN.mutate(() => { mo.innerColor = e.target.value; }) })),
            el('div', { class: 'grid2' }, rng('Kiefer-Größe', Math.round((Number(mo.jaw) || 2.2) * 10) / 10, 0.5, 6, (v) => { mo.jaw = v; }), rng('Max. Öffnung', Number(mo.max) || 35, 5, 70, (v) => { mo.max = v; }, mo.view === 'pov' ? '' : '°')),
            mo.view === 'pov' ? null : rng('Kiefer-Bereich', Number(mo.span) || 140, 30, 175, (v) => { mo.span = v; }, '°'),
            el('div', { class: 'muted small' }, VN.t('Tipp: Kiefer-Größe und -Bereich so wählen, dass die rosa Fläche Unterlippe und Kinn umfasst – sie klappt beim Öffnen um das Gelenk.')));
        }
      }
      // Objekt für einen Mund
      const mouths = a.actors.filter((x) => x !== actor && x.mouth && x.mouth.on);
      if (!(mo && mo.on) && mouths.length) {
        box.appendChild(el('div', { class: 'logic-row', style: { marginTop: '6px' } }, el('span', { class: 'muted small' }, VN.t('Objekt für den Mund von')),
          sel(isProp ? mp.target : '', [['', '— keinem —'], ...mouths.map((x) => [x.id, AnimEd.actorName ? AnimEd.actorName(x) : (VN.asset(x.asset) || {}).name || x.id])], (v) => { if (!v) { delete actor.mouthProp; return; } actor.mouthProp = Object.assign(actor.mouthProp || { thick: 12 }, { target: v }); if (!actor.mouthProp.back) { ui().animMouthEd = true; ui().animMouthPick = { actor: actor.id, i: 0 }; } })));
        if (isProp) box.append(
          el('div', { class: 'muted small' }, VN.t('Setze Griff und Spitze. Die Breite misst die Engine selbst aus dem Bild – an jeder Stelle des Objekts.')),
          el('div', { class: 'row gap8', style: { flexWrap: 'wrap', margin: '6px 0' } }, pickBtn(mp.back ? 'Griff & Spitze neu setzen' : 'Griff & Spitze setzen'), editBtn()),
          rng('Dicke, falls nicht messbar (%)', Number(mp.thick) || 12, 2, 60, (v) => { mp.thick = v; }, ' %'));
      } else if (!(mo && mo.on) && !mouths.length) box.appendChild(el('div', { class: 'muted small' }, VN.t('Gegenstände (Strohhalm, Löffel, Stift …) verknüpfst du hier mit dem Mund einer anderen Figur – sobald eine Figur einen Mund hat.')));
      return box;
    },

    // ---------- Masken (0.9.24) ----------
    // Bühne (Prozent) ↔ Canvas-Pixel, mit Kamera
    maskM() { const c = (AnimEd._maps && AnimEd._maps.cam) || [1, 0, 0, 1, 0, 0]; return c; },
    toPx(xp, yp, svg) { const W = svg.viewBox.baseVal.width, H = svg.viewBox.baseVal.height, [a, b, c, d, e, f] = AnimEd.maskM(); const x = xp / 100 * W, y = yp / 100 * H; return [a * x + c * y + e, b * x + d * y + f]; },
    toPct(px, py, svg) { const W = svg.viewBox.baseVal.width, H = svg.viewBox.baseVal.height, [a, b, c, d, e, f] = AnimEd.maskM(); const det = a * d - b * c || 1; const x = (d * (px - e) - c * (py - f)) / det, y = (-b * (px - e) + a * (py - f)) / det; return [x / W * 100, y / H * 100]; },
    maskSet(actor, t, fields) {
      const m = actor.mask;
      m.keys = m.keys || [];
      if (!m.keys.length) { Object.assign(m, fields); return; }
      const near = m.keys.find((k) => Math.abs(k.t - t) < 0.03);
      if (near) Object.assign(near, fields);
      else { const b = Anim.maskAt(actor, t); m.keys.push(Object.assign({ t: Math.round(t * 100) / 100, e: 'ease-in-out', x: b.x, y: b.y, w: b.w, h: b.h, rot: b.rot }, fields)); m.keys.sort((x, y) => x.t - y.t); }
    },
    maskCorners(b) {
      const r = (b.rot || 0) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      return (u, v) => { const lx = (u - 0.5) * b.w, ly = (v - 0.5) * b.h; return [cx + lx * cs - ly * sn, cy + lx * sn + ly * cs]; };
    },
    drawMask(svg, a, actor) {
      const NS = 'http://www.w3.org/2000/svg';
      const mk = (tag, at) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(at)) n.setAttribute(k, v); svg.appendChild(n); return n; };
      const b = Anim.maskAt(actor, ui().animT || 0), U = AnimEd.maskCorners(b);
      const P = (u, v) => { const [x, y] = U(u, v); return AnimEd.toPx(x, y, svg); };
      const pts = b.shape === 'poly' && b.pts.length ? b.pts : b.shape === 'ellipse' ? Array.from({ length: 48 }, (_, i) => [0.5 + 0.5 * Math.cos(i / 48 * Math.PI * 2), 0.5 + 0.5 * Math.sin(i / 48 * Math.PI * 2)]) : [[0, 0], [1, 0], [1, 1], [0, 1]];
      const d = pts.map((p, i) => (i ? 'L' : 'M') + P(p[0], p[1]).join(' ')).join(' ') + (pts.length >= 3 ? ' Z' : '');
      mk('path', { d, fill: 'rgba(95,208,192,0.12)', stroke: '#5fd0c0', 'stroke-width': 2, 'stroke-dasharray': '6 4' });
      // Rahmen des Kastens (gestrichelt, dünn) und Griffe
      mk('path', { d: [[0, 0], [1, 0], [1, 1], [0, 1]].map((p, i) => (i ? 'L' : 'M') + P(p[0], p[1]).join(' ')).join(' ') + ' Z', fill: 'none', stroke: 'rgba(255,255,255,0.35)', 'stroke-width': 1 });
      const [rx, ry] = P(1, 1); mk('rect', { x: rx - 6, y: ry - 6, width: 12, height: 12, fill: '#5fd0c0', stroke: '#fff', 'stroke-width': 2 });
      const [tx, ty] = P(0.5, 0); const [ox, oy] = P(0.5, -0.12); mk('line', { x1: tx, y1: ty, x2: ox, y2: oy, stroke: '#5fd0c0', 'stroke-width': 2 }); mk('circle', { cx: ox, cy: oy, r: 6, fill: '#2b2e38', stroke: '#5fd0c0', 'stroke-width': 2 });
      if (b.shape === 'poly') for (const p of b.pts) { const [x, y] = P(p[0], p[1]); mk('circle', { cx: x, cy: y, r: 5, fill: '#fff', stroke: '#5fd0c0', 'stroke-width': 2 }); }
    },
    // Ziehen: Fläche = verschieben, Ecke = Größe, Kreis = drehen, Punkt = Punkt; Umschalt + Klick = Punkt hinzufügen (freie Form)
    maskDown(e, px, py, svg, r, kx, a, actor) {
      const t = ui().animT || 0, m = actor.mask, b0 = Anim.maskAt(actor, t), U = AnimEd.maskCorners(b0);
      const P = (u, v) => { const [x, y] = U(u, v); return AnimEd.toPx(x, y, svg); };
      const near = (q, d) => Math.hypot(q[0] - px, q[1] - py) < (d || 10);
      const before = JSON.stringify(m);
      const pct = (ev) => AnimEd.toPct((ev.clientX - r.left) * kx, (ev.clientY - r.top) * kx, svg);
      const inv = (xp, yp) => { const rr = -(b0.rot || 0) * Math.PI / 180, cx = b0.x + b0.w / 2, cy = b0.y + b0.h / 2, dx = xp - cx, dy = yp - cy; return [(dx * Math.cos(rr) - dy * Math.sin(rr)) / (b0.w || 1) + 0.5, (dx * Math.sin(rr) + dy * Math.cos(rr)) / (b0.h || 1) + 0.5]; };
      const finish = () => { const after = JSON.stringify(m); actor.mask = JSON.parse(before); VN.mutate(() => { actor.mask = JSON.parse(after); }); };
      e.preventDefault();
      const [mx0, my0] = AnimEd.toPct(px, py, svg);
      if (m.shape === 'poly') {
        const i = (m.pts || []).findIndex((p) => near(P(p[0], p[1]), 8));
        if (i >= 0 && e.altKey) { m.pts.splice(i, 1); finish(); return true; }
        if (i >= 0) { VN.drag(e, (dx, dy, ev) => { const [xp, yp] = pct(ev); m.pts[i] = inv(xp, yp).map((v) => Math.round(v * 1000) / 1000); }, (dx, dy, moved) => { if (moved) finish(); else VN.render(); }); return true; }
        if (e.shiftKey || (m.pts || []).length < 3) { m.pts = m.pts || []; m.pts.push(inv(mx0, my0).map((v) => Math.round(v * 1000) / 1000)); finish(); return true; }
      }
      if (near(P(1, 1), 12)) {
        VN.drag(e, (dx, dy, ev) => { const [xp, yp] = pct(ev); const [u, v] = inv(xp, yp); AnimEd.maskSet(actor, t, { w: Math.max(1, Math.round(b0.w * u * 10) / 10), h: Math.max(1, Math.round(b0.h * v * 10) / 10), x: b0.x, y: b0.y }); }, (dx, dy, moved) => { if (moved) finish(); });
        return true;
      }
      if (near(P(0.5, -0.12), 10)) {
        const cx = b0.x + b0.w / 2, cy = b0.y + b0.h / 2;
        VN.drag(e, (dx, dy, ev) => { const [xp, yp] = pct(ev); const W = svg.viewBox.baseVal.width, H = svg.viewBox.baseVal.height; const ang = Math.atan2((yp - cy) * H, (xp - cx) * W) * 180 / Math.PI + 90; AnimEd.maskSet(actor, t, { rot: Math.round(ang) }); }, (dx, dy, moved) => { if (moved) finish(); });
        return true;
      }
      const [u, v] = inv(mx0, my0);
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
        VN.drag(e, (dx, dy, ev) => { const [xp, yp] = pct(ev); AnimEd.maskSet(actor, t, { x: Math.round((b0.x + xp - mx0) * 10) / 10, y: Math.round((b0.y + yp - my0) * 10) / 10 }); }, (dx, dy, moved) => { if (moved) finish(); });
        return true;
      }
      return false;
    },
    maskCard(a, actor, t) {
      const m = actor.mask;
      const box = el('div', { class: 'opt-card', style: { marginTop: '8px' } }, el('div', { class: 'sec-title' }, '✂ ' + VN.t('Maske')));
      box.appendChild(el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!(m && m.on), onchange: (e) => VN.mutate(() => { actor.mask = Object.assign(actor.mask || { shape: 'rect', invert: false, pts: [], keys: [] }, Object.assign({}, Anim.MASK0, actor.mask || {}), { on: e.target.checked }); ui().animMaskEd = e.target.checked; }) }), VN.t('Darsteller ausschneiden')));
      if (!m || !m.on) { box.appendChild(el('div', { class: 'muted small' }, VN.t('Zeigt den Darsteller nur innerhalb (oder außerhalb) einer Form – z. B. ein Arm, der hinter einer anderen Figur verschwindet.'))); return box; }
      const sel = (v, opts, fn) => { const s = el('select', { class: 'small-input', onchange: (e) => VN.mutate(() => fn(e.target.value)) }); for (const [k, l] of opts) { const o = el('option', { value: k }, VN.t(l)); if (k === v) o.selected = true; s.appendChild(o); } return s; };
      box.append(
        el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
          sel(m.shape || 'rect', [['rect', 'Rechteck'], ['ellipse', 'Ellipse'], ['poly', 'Freie Form']], (v) => { m.shape = v; if (v === 'poly' && !(m.pts || []).length) m.pts = [[0.1, 0.1], [0.9, 0.05], [0.95, 0.9], [0.1, 0.95]]; }),
          el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!m.invert, onchange: (e) => VN.mutate(() => { m.invert = e.target.checked; }) }), VN.t('umkehren (Form schneidet weg)'))),
        el('div', { class: 'row gap8', style: { flexWrap: 'wrap', marginTop: '6px' } },
          el('button', { class: 'btn tiny' + (ui().animMaskEd ? ' primary' : ''), onclick: () => { ui().animMaskEd = !ui().animMaskEd; VN.render(); } }, '✏ ' + VN.t('Maske bearbeiten')),
          el('button', { class: 'btn tiny', title: VN.t('Keyframe der Maske an der Abspielposition – danach bewegt sie sich mit'), onclick: () => VN.mutate(() => { const b = Anim.maskAt(actor, t); m.keys = m.keys || []; AnimEd.setKey(m.keys, t, { x: b.x, y: b.y, w: b.w, h: b.h, rot: b.rot }); }) }, '◆ ' + VN.t('Keyframe')),
          m.shape === 'poly' ? el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { m.pts = []; ui().animMaskEd = true; }) }, VN.t('Form neu zeichnen')) : null),
        el('div', { class: 'muted small', style: { marginTop: '4px' } }, m.shape === 'poly'
          ? VN.t('Bearbeiten: Fläche ziehen = verschieben · Ecke = Größe · Kreis = drehen · Punkte ziehen · Umschalt + Klick = Punkt hinzufügen · Alt + Klick auf Punkt = löschen')
          : VN.t('Bearbeiten: Fläche ziehen = verschieben · Ecke unten rechts = Größe · Kreis oben = drehen. Mit Keyframes bewegt sich die Maske mit.')));
      return box;
    },

    // Darsteller doppeln (0.9.24): gleiche Figur, gleiche Animation – direkt davor eingereiht
    dupActor(a, ac) {
      VN.mutate(() => {
        const c = JSON.parse(JSON.stringify(ac));
        c.id = VN.uid('ac');
        // Nähte anderer Figuren zeigen weiter auf das Original; eigene Nähte und Haftpunkte bleiben
        a.actors.splice(a.actors.indexOf(ac) + 1, 0, c);
        ui().animActor = c.id; ui().animKeys = []; ui().animKey = null;
      });
      VN.toast(VN.t('Darsteller gedoppelt – liegt jetzt vor dem Original'));
    },
    orderActor(a, ac, dir) {
      const i = a.actors.indexOf(ac), j = i + dir;
      if (j < 0 || j >= a.actors.length) return;
      VN.mutate(() => { a.actors.splice(i, 1); a.actors.splice(j, 0, ac); });
    },
    // ---------- Mehrere Keyframes: Auswahl, Rahmen, Kopieren / Einfügen (0.9.24) ----------
    isMulti(rowId, t) { return (ui().animKeys || []).some((x) => x.row === rowId && Math.abs(x.t - t) < 0.001); },
    // Markierte Keys als [{ row, k }] (nur Zeilen des gewählten Darstellers)
    selKeys(a) {
      const out = [];
      const L = (ui().animKeys || []).length ? ui().animKeys : ui().animKey ? [ui().animKey] : [];
      for (const row of AnimEd.rows(a)) for (const k of row.keys) if (L.some((x) => x.row === row.id && Math.abs(x.t - k.t) < 0.001)) out.push({ row, k });
      return out;
    },
    marquee(e, inner, lane, a) {
      const x0 = e.clientX, y0 = e.clientY, add = e.shiftKey || e.ctrlKey || e.metaKey;
      const box = el('div', { class: 'an-marquee' });
      let on = false;
      VN.drag(e, (dx, dy, ev) => {
        if (!on && Math.hypot(dx, dy) < 4) return;
        if (!on) { on = true; document.body.appendChild(box); }
        Object.assign(box.style, { left: Math.min(x0, ev.clientX) + 'px', top: Math.min(y0, ev.clientY) + 'px', width: Math.abs(dx) + 'px', height: Math.abs(dy) + 'px' });
        const R = box.getBoundingClientRect();
        for (const n of inner.querySelectorAll('.an-key')) { const r = n.getBoundingClientRect(); n.classList.toggle('hover', r.right >= R.left && r.left <= R.right && r.bottom >= R.top && r.top <= R.bottom); }
      }, (dx, dy, moved, ev) => {
        if (!on) {
          // einfacher Klick: Abspielposition setzen, Auswahl aufheben
          const r = lane.getBoundingClientRect();
          ui().animT = Math.max(0, Math.min(a.dur, ((ev ? ev.clientX : x0) - r.left) / PX));
          if (!add) ui().animKeys = [];
          VN.render(); return;
        }
        const R = box.getBoundingClientRect();
        box.remove();
        const L = add ? (ui().animKeys || []).slice() : [];
        for (const n of inner.querySelectorAll('.an-key')) {
          const r = n.getBoundingClientRect();
          if (r.right >= R.left && r.left <= R.right && r.bottom >= R.top && r.top <= R.bottom) { const it = { row: n.dataset.row, t: Number(n.dataset.t) }; if (!L.some((x) => x.row === it.row && Math.abs(x.t - it.t) < 0.001)) L.push(it); }
        }
        ui().animKeys = L;
        ui().animKey = L[0] || null;
        VN.render();
      });
    },
    copyKeys() {
      const a = cur(); if (!a) return false;
      const sel = AnimEd.selKeys(a);
      if (!sel.length) return false;
      const t0 = Math.min(...sel.map((x) => x.k.t));
      AnimEd._clip = { items: sel.map((x) => ({ row: x.row.id, k: JSON.parse(JSON.stringify(x.k)), dt: x.k.t - t0 })) };
      VN.toast(VN.tf('{n} Keyframes kopiert', { n: sel.length }));
      return true;
    },
    pasteKeys() {
      const a = cur(), C = AnimEd._clip;
      if (!a || !C || !C.items.length) return false;
      const rows = AnimEd.rows(a), t = ui().animT || 0;
      const ids = [...new Set(C.items.map((x) => x.row))];
      // Nur eine Zeile kopiert und eine andere Zeile gewählt → dort einfügen (z. B. Arm L → Arm R)
      const selRow = rows.find((r) => (r.bone && r.bone === ui().animBone) || (r.part && r.part === ui().animPart));
      const target = (id) => (ids.length === 1 && selRow && selRow.id.split(':')[0] === id.split(':')[0] ? selRow : rows.find((r) => r.id === id));
      const actor = actorOf(a);
      let n = 0;
      const placed = [];
      VN.mutate(() => {
        for (const it of C.items) {
          const row = target(it.row);
          if (!row) continue;
          // Zeile ohne eigene Liste (noch keine Keys): Liste im Darsteller anlegen
          let keys = row.keys;
          if (row.bone) { actor.bones = actor.bones || {}; keys = actor.bones[row.bone] = actor.bones[row.bone] || keys; }
          if (row.part) { actor.parts = actor.parts || {}; keys = actor.parts[row.part] = actor.parts[row.part] || keys; }
          const nt = Math.round(Math.min(a.dur, t + it.dt) * 1000) / 1000;
          const k = Object.assign(JSON.parse(JSON.stringify(it.k)), { t: nt });
          const i = keys.findIndex((x) => Math.abs(x.t - nt) < 0.001);
          if (i >= 0) keys[i] = k; else keys.push(k);
          keys.sort((x, y) => x.t - y.t);
          placed.push({ row: row.id, t: nt }); n++;
        }
        ui().animKeys = placed; ui().animKey = placed[0] || null;
      });
      if (n) VN.toast(VN.tf('{n} Keyframes eingefügt', { n })); else VN.toast(VN.t('Passt zu keiner Zeile dieses Darstellers'));
      return true;
    },
    deleteKeys() {
      const a = cur(); if (!a) return false;
      const sel = AnimEd.selKeys(a);
      if (!sel.length) return false;
      VN.mutate(() => { for (const x of sel) { const i = x.row.keys.indexOf(x.k); if (i >= 0) x.row.keys.splice(i, 1); } ui().animKeys = []; ui().animKey = null; });
      return true;
    },

    // ---------- Timeline ----------
    // Werte einer Zeile (für Inspektor und Graph)
    fields(row) {
      if (row.id === 'mask') return [['x', 'X %'], ['y', 'Y %'], ['w', 'Breite %'], ['h', 'Höhe %'], ['rot', 'Drehung °']];
      return row.id === 'move' ? [['x', 'X %'], ['y', 'Höhe %'], ['scale', 'Größe %'], ['rot', 'Drehung °'], ['opacity', 'Deckkraft']] : row.id === 'cam' ? [['zoom', 'Zoom %'], ['panX', 'Schwenk X'], ['panY', 'Schwenk Y'], ['rot', 'Drehung °']] : row.part ? [['r', 'Drehung °'], ['x', 'Versatz X'], ['y', 'Versatz Y']] : [['a', 'Winkel °']];
    },
    rows(a) {
      const actor = actorOf(a);
      const rows = [];
      const pup = actor && actor.puppet && window.Puppet && Puppet.get(actor.puppet);
      if (pup) {
        rows.push({ id: 'move', label: 'Bewegung', keys: actor.move || (actor.move = []), color: '#8fc3f0' });
        for (const p of pup.parts) rows.push({ id: 'part:' + p.id, label: p.name + ((actor.pins || {})[p.id] ? ' 📌' : ''), keys: (actor.parts || {})[p.id] || [], part: p.id, color: '#e86aa0' });
      } else if (actor) {
        rows.push({ id: 'move', label: 'Bewegung', keys: actor.move || (actor.move = []), color: '#8fc3f0' });
        const rig = rigOf(actor);
        const names = rig ? rig.bones.map((b) => b.name) : Object.keys(actor.bones || {});
        for (const n of names) rows.push({ id: 'bone:' + n, label: n, keys: (actor.bones || {})[n] || [], bone: n, color: '#e8a43a' });
      }
      if (actor && actor.mask && actor.mask.on) rows.splice(1, 0, { id: 'mask', label: VN.t('Maske'), keys: actor.mask.keys || (actor.mask.keys = []), color: '#5fd0c0' });
      if (a.type === 'scene') rows.push({ id: 'cam', label: 'Kamera', keys: a.cam || (a.cam = []), color: '#b39cf0' });
      return rows;
    },
    timeline(a, t) {
      const tl = el('div', { class: 'timeline an-tl' });
      const W = Math.max(1, a.dur) * PX;
      tl.appendChild(el('div', { class: 'tl-tools' },
        el('strong', null, 'Keyframes'),
        el('span', { class: 'muted small' }, (t.toFixed(2)) + ' s / ' + a.dur.toFixed(1) + ' s'),
        el('span', { class: 'muted small' }, actorOf(a) && actorOf(a).puppet ? '· Teil ziehen = drehen · gelbes Quadrat / Pfeile oder Alt + Ziehen = ganze Figur verschieben · Doppelklick = festpinnen · Rahmen in der Spur = mehrere Keys · Strg+C / Strg+V' : '· Knochen-Griff ziehen = Keyframe · Figur ziehen (Alt + Ziehen) = ganze Figur bewegen · Raute ziehen = verschieben · Rahmen in der Spur = mehrere Keys · Strg+C / Strg+V · Entf = löschen'),
        el('div', { style: { flex: '1' } }),
        el('button', { class: 'btn tiny' + (ui().animGraph ? ' primary' : ''), title: VN.t('Werte über die Zeit als Kurve – Übergänge mit Griffen weicher machen'), onclick: () => { ui().animGraph = !ui().animGraph; VN.render(); } }, '📈 Graph'),
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
          const multi = AnimEd.isMulti(row.id, k.t);
          const d = el('div', { class: 'an-key' + (sel ? ' sel' : '') + (multi ? ' multi' : ''), title: k.t.toFixed(2) + ' s' + (k.a != null ? ' · ' + k.a + '°' : '') + (k.r != null ? ' · ' + Math.round(k.r * 10) / 10 + '°' : ''), style: { left: k.t * PX + 'px', background: row.color } });
          d.dataset.row = row.id; d.dataset.t = k.t;
          d.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (e.button !== 0) return;
            ui().animPlay = false;
            // Umschalt/Strg + Klick: zur Auswahl hinzufügen oder entfernen
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
              const L = ui().animKeys = (ui().animKeys || []).filter((x) => !(x.row === row.id && Math.abs(x.t - k.t) < 0.001));
              if (!multi) { L.push({ row: row.id, t: k.t }); ui().animKey = { row: row.id, t: k.t }; }
              VN.render(); return;
            }
            if (!multi) ui().animKeys = [{ row: row.id, t: k.t }];
            ui().animKey = { row: row.id, t: k.t };
            if (row.bone) ui().animBone = row.bone;
            if (row.part) ui().animPart = row.part;
            // Alle markierten Keys gemeinsam verschieben
            const group = AnimEd.selKeys(a);
            if (!group.some((g) => g.k === k)) group.push({ row, k });
            const t0s = group.map((g) => g.k.t), minT = Math.min(...t0s), maxT = Math.max(...t0s);
            const nodes = group.map((g) => inner.querySelector(`.an-key[data-row="${CSS.escape(g.row.id)}"][data-t="${g.k.t}"]`));
            const shift = (dx) => Math.max(-minT, Math.min(a.dur - maxT, Math.round(dx / PX * 20) / 20));
            VN.drag(e, (dx) => { const sh = shift(dx); group.forEach((g, j) => { if (nodes[j]) nodes[j].style.left = (t0s[j] + sh) * PX + 'px'; }); },
              (dx, dy, moved) => {
                if (!moved) { ui().animT = k.t; VN.render(); return; }
                const sh = shift(dx);
                VN.mutate(() => {
                  group.forEach((g, j) => { g.k.t = Math.round((t0s[j] + sh) * 1000) / 1000; });
                  for (const r of new Set(group.map((g) => g.row))) r.keys.sort((x, y) => x.t - y.t);
                  ui().animKeys = group.map((g) => ({ row: g.row.id, t: g.k.t }));
                  ui().animKey = { row: row.id, t: k.t }; ui().animT = k.t;
                });
              });
          });
          d.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); VN.mutate(() => { row.keys.splice(row.keys.indexOf(k), 1); ui().animKey = null; ui().animKeys = []; }); });
          lane.appendChild(d);
        });
        // Leere Spur: Klick = Abspielposition, Ziehen = Rahmen über mehrere Keys
        lane.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return;
          ui().animPlay = false; if (row.bone) ui().animBone = row.bone; if (row.part) ui().animPart = row.part;
          AnimEd.marquee(e, inner, lane, a);
        });
        inner.appendChild(el('div', { class: 'tl-row an-row' + ((row.bone && ui().animBone === row.bone) || (row.part && ui().animPart === row.part) ? ' sel' : '') },
          el('div', { class: 'tl-head an-head' + (row.bone || row.part ? ' pick' : ''), title: row.bone || row.part ? VN.t('Anklicken = dieses Körperteil auswählen') : '',
            onclick: () => {
              if (!row.bone && !row.part) return;
              ui().animPlay = false;
              if (row.bone) ui().animBone = row.bone;
              if (row.part) ui().animPart = row.part;
              // Keyframe an der Abspielposition gleich mit auswählen
              const k = row.keys.find((x) => Math.abs(x.t - (ui().animT || 0)) < 0.001);
              ui().animKey = k ? { row: row.id, t: k.t } : null;
              VN.render();
            } }, el('span', { class: 'sw', style: { background: row.color } }), row.label), lane));
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
      if (ui().animGraph) { const g = AnimEd.graph(a, W); if (g) inner.appendChild(g); }
      inner.appendChild(el('div', { class: 'tl-beatcol an-playhead', style: { left: (150 + t * PX) + 'px', width: '2px', top: '26px' } }));
      scroll.appendChild(inner);
      tl.appendChild(scroll);
      return tl;
    },
    // ---------- Gliederpuppen (0.7.6): Puppenspiel ----------
    // Griffe: Pin (Gelenk) und Endpunkt je Teil, Koordinatenpfeile am Wurzel-Teil
    drawPuppet(mk, m, actor) {
      const pup = Puppet.get(actor.puppet);
      if (!pup || !m.it.pmats) return;
      const ap = Puppet.m.ap, ms = m.it.pmats;
      const H = { parts: [], gizmo: null, actor: actor.id };
      for (const p of pup.parts) {
        const M = ms[p.id];
        if (!M) continue;
        const [px, py] = ap(M, p.ax, p.ay), [tx, ty] = ap(M, ...Puppet.tip(p, pup));
        const par = p.parent && ms[p.parent] && Puppet.part(pup, p.parent);
        if (par) { const [qx, qy] = ap(ms[par.id], par.ax, par.ay); mk('line', { x1: qx, y1: qy, x2: px, y2: py, stroke: 'rgba(255,110,110,0.45)', 'stroke-width': 2 }); }
        const sel = ui().animPart === p.id;
        const keyed = ((actor.parts || {})[p.id] || []).length;
        const pinned = (actor.pins || {})[p.id];
        mk('line', { x1: px, y1: py, x2: tx, y2: ty, stroke: sel ? '#e8a43a' : keyed ? '#f0a0c8' : 'rgba(255,255,255,0.55)', 'stroke-width': sel ? 3.5 : 2, 'stroke-linecap': 'round', 'stroke-dasharray': sel ? '' : '4 3' });
        mk('circle', { cx: px, cy: py, r: 4, fill: par ? '#ff6e6e' : '#e8a43a', stroke: '#fff', 'stroke-width': 1.5 });
        if (pinned) mk('rect', { x: tx - 6, y: ty - 6, width: 12, height: 12, fill: '#4fb3c8', stroke: '#fff', 'stroke-width': 2 });
        else mk('circle', { cx: tx, cy: ty, r: sel ? 7.5 : 6, fill: sel ? '#e8a43a' : keyed ? '#e86aa0' : '#2b2e38', stroke: '#fff', 'stroke-width': 2, class: 'an-handle' });
        H.parts.push({ pid: p.id, px, py, tx, ty });
      }
      // Haftpunkte (0.9.13): Doppelklick = an dieser Stelle festhalten / lösen
      H.holds = [];
      const cam = (AnimEd._maps || {}).cam, W = AnimEd._cvW || 1, Hh = AnimEd._cvH || 1;
      for (const p of pup.parts) for (const hp of p.holdPts || []) {
        if (!ms[p.id]) continue;
        const [hx, hy] = ap(ms[p.id], hp.u, hp.v);
        const held = actor.holds && actor.holds[hp.id];
        if (held && cam) { const [sx, sy] = ap(cam, held.x * W, held.y * Hh); mk('line', { x1: hx, y1: hy, x2: sx, y2: sy, stroke: '#ffb84d', 'stroke-width': 1.5, 'stroke-dasharray': '3 2' }); mk('path', { d: `M${sx - 7},${sy + 7} L${sx},${sy - 5} L${sx + 7},${sy + 7} Z`, fill: '#ffb84d', stroke: '#fff', 'stroke-width': 1.5 }); }
        mk('circle', { cx: hx, cy: hy, r: held ? 6.5 : 5, fill: held ? '#ffb84d' : 'rgba(255,184,77,0.25)', stroke: '#ffb84d', 'stroke-width': 2 });
        H.holds.push({ id: hp.id, pid: p.id, x: hx, y: hy });
      }
      // Koordinatenpfeile am ersten Wurzel-Teil: ganze Figur verschieben (X, Y oder frei)
      const root = Puppet.roots(pup)[0];
      if (root && ms[root.id]) {
        const [gx, gy] = ap(ms[root.id], root.ax, root.ay);
        const L = 46;
        mk('line', { x1: gx, y1: gy, x2: gx + L, y2: gy, stroke: '#ff5a5a', 'stroke-width': 3 });
        mk('path', { d: `M${gx + L + 9},${gy} L${gx + L - 2},${gy - 6} L${gx + L - 2},${gy + 6} Z`, fill: '#ff5a5a' });
        mk('line', { x1: gx, y1: gy, x2: gx, y2: gy - L, stroke: '#5ad06a', 'stroke-width': 3 });
        mk('path', { d: `M${gx},${gy - L - 9} L${gx - 6},${gy - L + 2} L${gx + 6},${gy - L + 2} Z`, fill: '#5ad06a' });
        mk('rect', { x: gx - 7, y: gy - 7, width: 14, height: 14, fill: '#e8c84a', stroke: '#fff', 'stroke-width': 2 });
        H.gizmo = { x: gx, y: gy, L, root: root.id };
      }
      AnimEd._pupH = H;
    },
    // Was liegt unter dem Mauszeiger? Pfeile, Endpunkt-Griff oder Teil
    pupHit(actor, px, py) {
      const H = AnimEd._pupH;
      if (!H || H.actor !== actor.id) return null;
      const g = H.gizmo;
      if (g) {
        if (Math.abs(px - g.x) < 9 && Math.abs(py - g.y) < 9) return { kind: 'move', axis: 'xy', pid: g.root };
        if (px > g.x + 8 && px < g.x + g.L + 12 && Math.abs(py - g.y) < 7) return { kind: 'move', axis: 'x', pid: g.root };
        if (py < g.y - 8 && py > g.y - g.L - 12 && Math.abs(px - g.x) < 7) return { kind: 'move', axis: 'y', pid: g.root };
      }
      const h = H.parts.slice().reverse().find((x) => Math.hypot(x.tx - px, x.ty - py) < 11);
      if (h) return { kind: 'part', pid: h.pid, grab: 'tip' };
      // Treffer auf dem Bild eines Teils (oberstes zuerst)
      const pup = Puppet.get(actor.puppet);
      const m = (AnimEd._maps || []).find((x) => x.it.actor === actor);
      if (!pup || !m || !m.it.pmats) return null;
      for (let i = pup.parts.length - 1; i >= 0; i--) {
        const p = pup.parts[i], M = m.it.pmats[p.id];
        if (!M || p.hidden) continue;
        const [u, v] = Puppet.m.ap(Puppet.m.inv(M), px, py);
        if (u >= 0 && v >= 0 && u <= p.w && v <= p.h) return { kind: 'part', pid: p.id, grab: 'body' };
      }
      return null;
    },
    // Teil einer beliebigen Puppen-Figur unter einem Punkt (oberstes zuerst)
    partAt(actor, px, py) {
      const pup = actor && Puppet.get(actor.puppet);
      const m = (AnimEd._maps || []).find((x) => x.it.actor === actor);
      if (!pup || !m || !m.it.pmats) return null;
      for (let i = pup.parts.length - 1; i >= 0; i--) {
        const p = pup.parts[i], M = m.it.pmats[p.id];
        if (!M || p.hidden) continue;
        const [u, v] = Puppet.m.ap(Puppet.m.inv(M), px, py);
        if (u >= 0 && v >= 0 && u <= p.w && v <= p.h) return p.id;
      }
      return null;
    },
    // Annähen (0.9.12): Linie über ein Teil der gewählten Puppe ziehen, das auf einem Teil einer anderen Figur liegt
    sewDown(e, svg, r, kx, a, actor) {
      const at = (ev) => [(ev.clientX - r.left) * kx, (ev.clientY - r.top) * kx];
      const p0 = at(e);
      const ownId = AnimEd.partAt(actor, p0[0], p0[1]);
      if (!ownId) { VN.toast(VN.t('Auf einem Teil der gewählten Figur beginnen')); return; }
      const own = { pid: ownId };
      e.preventDefault();
      const line = [p0];
      const NS = 'http://www.w3.org/2000/svg';
      const pl = document.createElementNS(NS, 'polyline');
      pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', '#ffd166'); pl.setAttribute('stroke-width', '3'); pl.setAttribute('stroke-dasharray', '6 5');
      svg.appendChild(pl);
      VN.drag(e, (dx, dy, ev) => {
        const q = at(ev), L = line[line.length - 1];
        if (Math.hypot(q[0] - L[0], q[1] - L[1]) > 5 * kx) { line.push(q); pl.setAttribute('points', line.map((x) => x.join(',')).join(' ')); }
      }, () => {
        pl.remove();
        if (line.length < 2) return;
        const mid = line[Math.floor(line.length / 2)];
        let tgt = null;
        for (const o of a.actors.slice().reverse()) { if (o === actor || !o.puppet) continue; const pid = AnimEd.partAt(o, mid[0], mid[1]); if (pid) { tgt = { actor: o, pid }; break; } }
        if (!tgt) { VN.toast(VN.t('Unter der Linie liegt kein Teil einer anderen Figur')); return; }
        const mOwn = (AnimEd._maps || []).find((x) => x.it.actor === actor), mT = (AnimEd._maps || []).find((x) => x.it.actor === tgt.actor);
        const Ow = mOwn && mOwn.it.pmats[own.pid], Tw = mT && mT.it.pmats[tgt.pid];
        if (!Ow || !Tw) return;
        const iO = Puppet.m.inv(Ow);
        const rel = Puppet.m.mul(Puppet.m.inv(Tw), Ow).map((n) => Math.round(n * 1e5) / 1e5);
        const pts = line.map(([x, y]) => Puppet.m.ap(iO, x, y).map((n) => Math.round(n * 10) / 10));
        VN.mutate(() => { actor.seams = actor.seams || []; actor.seams.push({ id: VN.uid('sm'), part: own.pid, toActor: tgt.actor.id, toPart: tgt.pid, pts, soft: 60, rel }); });
        const pn = (ac, pid) => { const pp = Puppet.get(ac.puppet); const x = pp && Puppet.part(pp, pid); return x ? x.name : '?'; };
        VN.toast(VN.tf('„{a}“ an „{b}“ angenäht', { a: pn(actor, own.pid), b: pn(tgt.actor, tgt.pid) }));
      });
    },
    // Liste der Nähte der gewählten Figur
    seamCard(a, actor) {
      const L = actor.seams || [];
      const pn = (ac, pid) => { const pp = ac && Puppet.get(ac.puppet); const x = pp && Puppet.part(pp, pid); return x ? x.name : '?'; };
      const nameOf = (ac) => (ac && ac.puppet && Puppet.get(ac.puppet) ? Puppet.get(ac.puppet).name : '?');
      return el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Nähte an andere Figuren'),
        ...L.map((s) => { const to = a.actors.find((x) => x.id === s.toActor); return el('div', { class: 'opt-card', style: { margin: '4px 0' } },
          el('div', { class: 'row gap8' }, el('span', { style: { flex: '1' } }, '🧵 ' + pn(actor, s.part) + ' → ' + nameOf(to) + ': ' + pn(to, s.toPart)),
            el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { actor.seams = actor.seams.filter((x) => x !== s); if (!actor.seams.length) delete actor.seams; }) }, '×')),
          el('div', { class: 'field' }, el('div', { class: 'lbl' }, VN.t('Weichheit') + ': ' + (s.soft != null ? s.soft : 60) + ' %'), el('input', { type: 'range', min: 5, max: 100, value: s.soft != null ? s.soft : 60, onchange: (e) => VN.mutate(() => { s.soft = Number(e.target.value); }) }))); }),
        el('div', { class: 'muted small' }, L.length ? 'Die Naht bleibt in der Lage, in der sie gezogen wurde. Wer die Puppen danach anders stellen will: Naht löschen und neu ziehen.' : 'Mit „🧵 Annähen“ oben eine Linie über ein Teil dieser Figur ziehen, das auf einer anderen Figur liegt (z. B. Hand auf der Schulter). Es bewegt sich dann mit der anderen Figur mit.'));
    },
    pupDown(e, px, py, r, kx, a, actor) {
      const pup = Puppet.get(actor.puppet);
      // Haftpunkt: Doppelklick = hier festhalten / lösen (0.9.13)
      const H0 = AnimEd._pupH;
      const hh = H0 && H0.actor === actor.id && (H0.holds || []).find((h) => Math.hypot(h.x - px, h.y - py) < 10);
      if (hh) {
        e.preventDefault();
        if (VN.isDouble(e, 'hold:' + actor.id + ':' + hh.id)) {
          const cam = (AnimEd._maps || {}).cam;
          if (!cam) return true;
          const [sx, sy] = Puppet.m.ap(Puppet.m.inv(cam), hh.x, hh.y);
          const on = !(actor.holds && actor.holds[hh.id]);
          VN.mutate(() => { actor.holds = actor.holds || {}; if (on) actor.holds[hh.id] = { x: Math.round(sx / (AnimEd._cvW || 1) * 1e4) / 1e4, y: Math.round(sy / (AnimEd._cvH || 1) * 1e4) / 1e4 }; else delete actor.holds[hh.id]; if (!Object.keys(actor.holds).length) delete actor.holds; });
          VN.toast(on ? VN.t('Haftpunkt hält hier fest – die Figur dehnt sich, wenn sie sich wegbewegt') : VN.t('Haftpunkt gelöst'));
        }
        return true;
      }
      const hit = AnimEd.pupHit(actor, px, py);
      if (!hit) return false;
      // Doppelklick auf ein angehängtes Teil = festpinnen / lösen (selbst erkannt, weil die Bühne nach dem Klick neu gezeichnet wird)
      if (hit.kind === 'part' && pup) {
        const pp = Puppet.part(pup, hit.pid);
        if (pp && pp.parent && VN.isDouble(e, 'an:' + actor.id + ':' + pp.id)) {
          e.preventDefault();
          VN.mutate(() => { actor.pins = actor.pins || {}; if (actor.pins[pp.id]) delete actor.pins[pp.id]; else actor.pins[pp.id] = true; });
          VN.toast(actor.pins[pp.id] ? VN.tf('„{name}“ festgepinnt', { name: pp.name }) : VN.tf('„{name}“ gelöst', { name: pp.name }));
          return true;
        }
      }
      const m = (AnimEd._maps || []).find((x) => x.it.actor === actor);
      if (!pup || !m || !m.it.pbase) return false;
      e.preventDefault();
      const t = ui().animT || 0;
      ui().animPart = hit.pid;
      const toPup = (x, y) => Puppet.m.ap(Puppet.m.inv(m.it.pbase), x, y);
      const p0 = toPup(px, py);
      const pose0 = Puppet.poseAt(actor, t);
      const part = Puppet.part(pup, hit.pid);
      const mats0 = Puppet.solve(pup, pose0, null, null, 0);
      const local = Puppet.m.ap(Puppet.m.inv(mats0[part.id]), p0[0], p0[1]);
      const piv = Puppet.m.ap(mats0[part.id], part.ax, part.ay);
      const a0 = Math.atan2(p0[1] - piv[1], p0[0] - piv[0]);
      const pins = Object.keys(actor.pins || {}).filter((k) => actor.pins[k] && k !== part.id && Puppet.part(pup, k));
      const fixed = {}; for (const pid of pins) fixed[pid] = Puppet.tipWorld(pup, pose0, pid);
      // Festgehaltene Haftpunkte: Glieder dorthin beugen (der Rest wird beim Zeichnen gedehnt)
      const holdT = [];
      const cam = (AnimEd._maps || {}).cam;
      if (cam && actor.holds) for (const pp of pup.parts) for (const hp of pp.holdPts || []) {
        const h = actor.holds[hp.id]; if (!h || !pp.parent) continue;
        const [cx, cy] = Puppet.m.ap(cam, h.x * (AnimEd._cvW || 1), h.y * (AnimEd._cvH || 1));
        holdT.push({ pid: pp.id, pt: [hp.u, hp.v], target: toPup(cx, cy) });
      }
      const keepHolds = (pose) => { const lock = new Set(Puppet.roots(pup).map((x) => x.id)); for (const h of holdT) if (h.pid !== part.id) Puppet.ik(pup, pose, h.pid, h.pt, h.target, { links: 3, lock }); };
      const before = JSON.stringify(actor.parts || {});
      actor.parts = actor.parts || {};
      const write = (pose) => {
        for (const p of pup.parts) {
          const n = pose[p.id], o = pose0[p.id] || { r: 0, x: 0, y: 0 };
          if (!n) continue;
          if (Math.abs((n.r || 0) - (o.r || 0)) < 0.05 && Math.abs((n.x || 0) - (o.x || 0)) < 0.05 && Math.abs((n.y || 0) - (o.y || 0)) < 0.05 && !(actor.parts[p.id] || []).some((k) => Math.abs(k.t - t) < 0.03)) continue;
          AnimEd.setKey(actor.parts[p.id] = actor.parts[p.id] || [], t, { r: Math.round((n.r || 0) * 10) / 10, x: Math.round((n.x || 0) * 10) / 10, y: Math.round((n.y || 0) * 10) / 10 });
        }
      };
      VN.drag(e, (dx, dy, ev) => {
        const [qx, qy] = toPup((ev.clientX - r.left) * kx, (ev.clientY - r.top) * kx);
        const pose = JSON.parse(JSON.stringify(pose0));
        const ps = pose[part.id] || (pose[part.id] = { r: 0, x: 0, y: 0 });
        // Alt + ziehen an einem beliebigen Teil = ganze Figur verschieben (0.9.13)
        if (ev.altKey && hit.kind !== 'move') {
          const root = Puppet.rootOf(pup, part.id);
          const pr = pose[root.id] || (pose[root.id] = { r: 0, x: 0, y: 0 });
          Puppet.moveBody(pup, pose, root.id, { x: (pr.x || 0) + qx - p0[0], y: (pr.y || 0) + qy - p0[1] }, pins.filter((k) => k !== root.id), fixed);
          keepHolds(pose); write(pose); return;
        }
        if (hit.kind === 'move' || (!part.parent && hit.grab === 'body')) {
          // Körper / Koordinatenpfeile (0.9.8): festgepinnte Glieder bleiben, alles dazwischen beugt sich mit –
          // nur so weit die Glieder reichen. Umschalt am Körper = neigen.
          if (!hit.kind || hit.kind !== 'move') {
            if (ev.shiftKey) { let d = (Math.atan2(qy - piv[1], qx - piv[0]) - a0) * 180 / Math.PI; if (d > 180) d -= 360; if (d < -180) d += 360; Puppet.moveBody(pup, pose, part.id, { x: ps.x || 0, y: ps.y || 0, r: (ps.r || 0) + d }, pins, fixed); }
            else Puppet.moveBody(pup, pose, part.id, { x: (ps.x || 0) + qx - p0[0], y: (ps.y || 0) + qy - p0[1] }, pins, fixed);
          } else Puppet.moveBody(pup, pose, part.id, { x: (ps.x || 0) + (hit.axis !== 'y' ? qx - p0[0] : 0), y: (ps.y || 0) + (hit.axis !== 'x' ? qy - p0[1] : 0) }, pins, fixed);
          keepHolds(pose);
          write(pose);
          return;
        } else if (ev.shiftKey) Puppet.ik(pup, pose, part.id, local, [qx, qy], { links: 3 });
        else { let d = (Math.atan2(qy - piv[1], qx - piv[0]) - a0) * 180 / Math.PI; if (d > 180) d -= 360; if (d < -180) d += 360; ps.r = Puppet.clampR(part, (ps.r || 0) + d); }
        Puppet.keepPins(pup, pose, pins, fixed);
        keepHolds(pose);
        write(pose);
      }, (dx, dy, moved) => {
        if (!moved) { VN.render(); return; }
        const after = JSON.stringify(actor.parts);
        actor.parts = JSON.parse(before);
        VN.mutate(() => { actor.parts = JSON.parse(after); ui().animKey = { row: 'part:' + part.id, t }; });
      });
      return true;
    },
    // Darsteller wählen: Bild (mit oder ohne Bones) oder Gliederpuppe
    actorPick(ac) {
      const s = el('select', { onchange: (e) => VN.mutate(() => {
        const v = e.target.value;
        if (v.startsWith('pup:')) { ac.puppet = v.slice(4); ac.parts = ac.parts || {}; } else { delete ac.puppet; ac.asset = v.slice(4) || null; }
      }) });
      const pups = (VN.project.puppets || []);
      if (pups.length) { const g = el('optgroup', { label: VN.t('Gliederpuppen') }); for (const p of pups) g.appendChild(el('option', { value: 'pup:' + p.id, selected: ac.puppet === p.id }, '🦴 ' + p.name)); s.appendChild(g); }
      const g2 = el('optgroup', { label: VN.t('Bilder') });
      g2.appendChild(el('option', { value: 'img:', selected: !ac.puppet && !ac.asset }, VN.t('— kein Bild —')));
      for (const im of VN.assetsOf('image')) g2.appendChild(el('option', { value: 'img:' + im.id, selected: !ac.puppet && ac.asset === im.id }, im.name + (VN.project.rigs[im.id] ? ' 🦴' : '')));
      s.appendChild(g2);
      return s;
    },
    puppetCard(a, actor, t) {
      const pup = Puppet.get(actor.puppet);
      const pins = Object.keys(actor.pins || {}).filter((k) => actor.pins[k] && Puppet.part(pup, k));
      return el('div', { class: 'pup-anim-help' },
        el('div', { class: 'muted small' }, 'Puppenspiel: Teil oder Endpunkt ziehen = um sein Gelenk drehen · Umschalt + ziehen = IK (Kette folgt der Maus) · Doppelklick auf ein Teil = festpinnen (z. B. Füße am Boden) · Körper oder Pfeile ziehen = Körper bewegen: Festgepinntes bleibt, der Rest beugt sich mit (Körper nach unten = in die Knie) · Umschalt + Körper ziehen = neigen.'),
        pins.length ? el('div', { class: 'row gap4', style: { flexWrap: 'wrap' } }, el('span', { class: 'muted small' }, '📌'), ...pins.map((pid) => el('button', { class: 'btn tiny', title: VN.t('Lösen'), onclick: () => VN.mutate(() => { delete actor.pins[pid]; }) }, Puppet.part(pup, pid).name + ' ×'))) : null,
        el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
          el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { actor.parts = actor.parts || {}; for (const p of pup.parts) AnimEd.setKey(actor.parts[p.id] = actor.parts[p.id] || [], t, { r: 0, x: 0, y: 0 }); }) }, '↺ Grundpose bei ' + t.toFixed(2) + ' s'),
          el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const ps = Puppet.poseAt(actor, t); actor.parts = actor.parts || {}; for (const p of pup.parts) { const v = ps[p.id] || { r: 0, x: 0, y: 0 }; AnimEd.setKey(actor.parts[p.id] = actor.parts[p.id] || [], t, { r: v.r, x: v.x, y: v.y }); } }) }, '◆ Ganze Pose als Keyframe'),
          el('button', { class: 'btn tiny', onclick: () => { VN.ui.view = 'bones'; VN.ui.figSub = 'puppet'; VN.ui.pupSel = pup.id; VN.render(); } }, '✏ Puppe bearbeiten')));
    },
    // Graph (0.9.18): Wert einer Zeile über die Zeit. Punkte = Keyframes (ziehen = Wert/Zeit ändern),
    // beim gewählten Keyframe zwei Griffe für die Kurve vom vorigen Keyframe hierher.
    graph(a, W) {
      const rows = AnimEd.rows(a), kSel = ui().animKey;
      const row = (kSel && rows.find((r) => r.id === kSel.row)) || rows.find((r) => (r.bone && r.bone === ui().animBone) || (r.part && r.part === ui().animPart)) || rows.find((r) => r.keys.length);
      if (!row) return null;
      const flds = AnimEd.fields(row).filter(([f]) => row.keys.some((k) => k[f] != null));
      const head = el('div', { class: 'tl-head an-graph-head' }, el('div', { class: 'an-graph-title' }, el('span', { class: 'sw', style: { background: row.color } }), '📈 ' + row.label));
      const lane = el('div', { class: 'tl-lane an-graph-lane', style: { width: W + 'px' } });
      const box = el('div', { class: 'tl-row an-graph-row' }, head, lane);
      if (!flds.length) { lane.appendChild(el('div', { class: 'lane-hint', style: { left: '8px' } }, VN.t('Diese Zeile hat noch keine Keyframes.'))); return box; }
      const f = flds.some(([x]) => x === ui().animGField) ? ui().animGField : flds[0][0];
      head.appendChild(el('div', { class: 'row gap4', style: { flexWrap: 'wrap' } }, ...flds.map(([x, l]) => el('button', { class: 'btn tiny' + (x === f ? ' primary' : ''), onclick: () => { ui().animGField = x; VN.render(); } }, VN.t(l)))));
      const keys = row.keys.filter((k) => k[f] != null).sort((x, y) => x.t - y.t);
      const H = 170, PAD = 16, NS = 'http://www.w3.org/2000/svg';
      const sv = (tag, at) => { const n = document.createElementNS(NS, tag); for (const k in at) n.setAttribute(k, at[k]); return n; };
      const svg = sv('svg', { width: W, height: H, class: 'an-graph' });
      lane.appendChild(svg);
      // Wertebereich (mit Platz für Überschwingen)
      let lo = Infinity, hi = -Infinity;
      for (let t = 0; t <= a.dur + 1e-6; t += 1 / 60) { const v = Anim.sample(keys, t, f); if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
      for (const k of keys) { lo = Math.min(lo, k[f]); hi = Math.max(hi, k[f]); }
      // Griffe des gewählten Übergangs sollen sichtbar bleiben
      const sk = kSel && kSel.row === row.id ? keys.findIndex((k) => Math.abs(k.t - kSel.t) < 0.001) : -1;
      if (sk > 0 && keys[sk].e !== 'hold') { const c = CurveEd.pts(keys[sk].e, 'anim'), v0 = keys[sk - 1][f], dv = keys[sk][f] - v0; for (const y of [c[1], c[3]]) { const v = v0 + y * dv; lo = Math.min(lo, v); hi = Math.max(hi, v); } }
      if (hi - lo < 1) { lo -= 1; hi += 1; }
      const m = (hi - lo) * 0.12; lo -= m; hi += m;
      const X = (t) => t * PX, Y = (v) => PAD + (hi - v) / (hi - lo) * (H - 2 * PAD), V = (y) => hi - (y - PAD) / (H - 2 * PAD) * (hi - lo);
      // Nulllinie und Raster
      for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4; svg.appendChild(sv('line', { x1: 0, x2: W, y1: Y(v), y2: Y(v), class: 'an-g-grid' })); const tx = sv('text', { x: 4, y: Y(v) - 2, class: 'an-g-lbl' }); tx.textContent = Math.round(v * 10) / 10; svg.appendChild(tx); }
      const curve = sv('path', { class: 'an-g-curve', stroke: row.color });
      svg.appendChild(curve);
      const drawCurve = () => {
        let d = '';
        for (let px = 0; px <= W; px += 2) { const v = Anim.sample(keys, px / PX, f); if (v != null) d += (d ? 'L' : 'M') + px + ' ' + Y(v).toFixed(1); }
        curve.setAttribute('d', d);
      };
      drawCurve();
      const selK = kSel && kSel.row === row.id ? keys.find((k) => Math.abs(k.t - kSel.t) < 0.001) : null;
      // Griffe des gewählten Übergangs (vorheriger Keyframe → gewählter Keyframe)
      const ki = selK ? keys.indexOf(selK) : -1;
      if (ki > 0 && selK.e !== 'hold') {
        const k0 = keys[ki - 1], k1 = selK;
        const dv = k1[f] - k0[f];
        const arms = [sv('line', { class: 'an-g-arm' }), sv('line', { class: 'an-g-arm' })];
        const hs = [sv('circle', { r: 6, class: 'an-g-h' }), sv('circle', { r: 6, class: 'an-g-h' })];
        const place = () => {
          const c = CurveEd.pts(k1.e, 'anim');
          const p1 = [X(k0.t + c[0] * (k1.t - k0.t)), Y(k0[f] + c[1] * dv)], p2 = [X(k0.t + c[2] * (k1.t - k0.t)), Y(k0[f] + c[3] * dv)];
          arms[0].setAttribute('x1', X(k0.t)); arms[0].setAttribute('y1', Y(k0[f])); arms[0].setAttribute('x2', p1[0]); arms[0].setAttribute('y2', p1[1]);
          arms[1].setAttribute('x1', X(k1.t)); arms[1].setAttribute('y1', Y(k1[f])); arms[1].setAttribute('x2', p2[0]); arms[1].setAttribute('y2', p2[1]);
          hs[0].setAttribute('cx', p1[0]); hs[0].setAttribute('cy', p1[1]); hs[1].setAttribute('cx', p2[0]); hs[1].setAttribute('cy', p2[1]);
        };
        if (Math.abs(dv) > 1e-6) {
          svg.append(...arms, ...hs);
          place();
          hs.forEach((h, i) => h.addEventListener('mousedown', (e) => {
            e.stopPropagation(); e.preventDefault();
            const before = k1.e, r = svg.getBoundingClientRect();
            VN.drag(e, (dx, dy, ev) => {
              const c = CurveEd.pts(k1.e, 'anim').slice();
              const tx = (ev.clientX - r.left) / PX, vy = V(ev.clientY - r.top);
              c[i * 2] = Math.round(Math.max(0, Math.min(1, (tx - k0.t) / (k1.t - k0.t))) * 100) / 100;
              c[i * 2 + 1] = ev.shiftKey ? i : Math.round(Math.max(-1, Math.min(2, (vy - k0[f]) / dv)) * 100) / 100;
              k1.e = CurveEd.fmt(c); place(); drawCurve();
            }, (dx, dy, moved) => { if (!moved) return; const v = k1.e; k1.e = before; VN.mutate(() => { k1.e = v; }); });
          }));
        }
      }
      // Keyframe-Punkte: ziehen = Wert (hoch/runter) und Zeit (seitlich)
      for (const k of keys) {
        const c = sv('circle', { cx: X(k.t), cy: Y(k[f]), r: k === selK ? 6.5 : 5, class: 'an-g-key' + (k === selK ? ' sel' : ''), fill: row.color });
        c.addEventListener('mousedown', (e) => {
          e.stopPropagation(); e.preventDefault();
          const t0 = k.t, v0 = k[f];
          ui().animKey = { row: row.id, t: k.t };
          VN.drag(e, (dx, dy, ev) => {
            k.t = Math.max(0, Math.min(a.dur, Math.round((t0 + dx / PX) * 20) / 20));
            k[f] = Math.round((v0 - dy / (H - 2 * PAD) * (hi - lo)) * 10) / 10;
            if (ev.shiftKey) k.t = t0; // Umschalt = nur Wert
            c.setAttribute('cx', X(k.t)); c.setAttribute('cy', Y(k[f])); keys.sort((x, y) => x.t - y.t); drawCurve();
          }, (dx, dy, moved) => {
            if (!moved) { ui().animT = k.t; VN.render(); return; }
            const nt = k.t, nv = k[f]; k.t = t0; k[f] = v0;
            VN.mutate(() => { k.t = nt; k[f] = nv; row.keys.sort((x, y) => x.t - y.t); ui().animKey = { row: row.id, t: nt }; ui().animT = nt; });
          });
        });
        svg.appendChild(c);
      }
      // Klick in einen Übergang = den Keyframe danach wählen (dessen Kurve gilt für diesen Weg)
      svg.addEventListener('mousedown', (e) => {
        const t = (e.clientX - svg.getBoundingClientRect().left) / PX;
        const nk = keys.find((k) => k.t > t);
        if (nk) { ui().animKey = { row: row.id, t: nk.t }; VN.render(); }
      });
      head.appendChild(el('div', { class: 'muted small' }, VN.t('Punkt ziehen = Wert/Zeit · Übergang anklicken, dann Griffe ziehen')));
      return box;
    },
    movePlayhead(t) { const p = document.querySelector('.an-playhead'); if (p) p.style.left = (150 + t * PX) + 'px'; },
    actorSelect(a) {
      const s = el('select', { class: 'small-input', onchange: (e) => { ui().animActor = e.target.value; ui().animBone = null; VN.render(); } });
      for (const ac of a.actors) { const o = el('option', { value: ac.id }, ac.puppet && Puppet.get(ac.puppet) ? '🦴 ' + Puppet.get(ac.puppet).name : (VN.asset(ac.asset) || {}).name || 'Darsteller'); if (ac === actorOf(a)) o.selected = true; s.appendChild(o); }
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
        a.type === 'scene' ? field('Hintergrund', VN.assetSelect('image', a.bg, set(a, 'bg'))) : null,
        AnimEd.fpsFields(a));

      // Darsteller
      const acCard = el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, a.type === 'scene' ? 'Darsteller' : 'Figur'));
      for (const ac of a.actors) {
        const on = ac === actor;
        const pupA = ac.puppet && window.Puppet && Puppet.get(ac.puppet);
        acCard.appendChild(el('div', { class: 'logic-row' + (on ? ' an-ac-sel' : ''), onclick: () => { ui().animActor = ac.id; VN.render(); } },
          el('span', { class: 'mini-thumb', style: { backgroundImage: `url("${VN.assetUrl(pupA ? (pupA.parts[0] || {}).asset : ac.asset) || ''}")` } }),
          (() => { const s = AnimEd.actorPick(ac); s.onclick = (e) => e.stopPropagation(); return s; })(),
          pupA ? el('span', { class: 'chip green' }, '🦴 ' + VN.t('Puppe')) : VN.project.rigs[ac.asset] ? el('span', { class: 'chip green' }, 'Bones') : el('span', { class: 'chip' }, 'ohne Bones'),
          a.type === 'scene' ? el('button', { class: 'btn tiny', title: VN.t('Doppeln – mit der gleichen Animation (Keyframes, Idle, Wackeln). Gut, um z. B. einen Arm vor und einen hinter eine Figur zu legen.'), onclick: (e) => { e.stopPropagation(); AnimEd.dupActor(a, ac); } }, '⧉') : null,
          a.type === 'scene' && a.actors.length > 1 ? el('button', { class: 'btn tiny', title: VN.t('Weiter nach vorne (über andere Darsteller)'), disabled: a.actors.indexOf(ac) === a.actors.length - 1, onclick: (e) => { e.stopPropagation(); AnimEd.orderActor(a, ac, 1); } }, '▲') : null,
          a.type === 'scene' && a.actors.length > 1 ? el('button', { class: 'btn tiny', title: VN.t('Weiter nach hinten'), disabled: a.actors.indexOf(ac) === 0, onclick: (e) => { e.stopPropagation(); AnimEd.orderActor(a, ac, -1); } }, '▼') : null,
          a.type === 'scene' ? el('button', { class: 'btn tiny danger', onclick: (e) => { e.stopPropagation(); VN.mutate(() => { a.actors = a.actors.filter((x) => x !== ac); }); } }, '×') : null));
      }
      if (a.type === 'scene' && a.actors.length > 1) acCard.appendChild(el('div', { class: 'muted small' }, VN.t('Unten in der Liste = ganz vorne im Bild.')));
      if (a.type === 'scene') acCard.appendChild(el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const img = VN.assetsOf('image').find((x) => VN.project.rigs[x.id]) || VN.assetsOf('image')[0]; const ac = { id: VN.uid('ac'), asset: img ? img.id : null, x: 50, y: 0, scale: 100, flip: false, bones: {}, move: [] }; a.actors.push(ac); ui().animActor = ac.id; }) }, '+ Darsteller'));
      if (actor) {
        const pl = Anim.place(actor, t);
        acCard.append(
          el('div', { class: 'grid2' },
            field('Größe %', el('input', { type: 'number', value: Math.round(pl.scale), onchange: (e) => VN.mutate(() => { if (a.type === 'scene') AnimEd.setKey(actor.move = actor.move || [], t, { scale: Number(e.target.value) }); else actor.scale = Number(e.target.value); }) })),
            el('label', { class: 'check', style: { alignSelf: 'flex-end' } }, el('input', { type: 'checkbox', checked: !!actor.flip, onchange: (e) => VN.mutate(() => { actor.flip = e.target.checked; }) }), 'Spiegeln')),
          !rig && !actor.puppet ? el('div', { class: 'muted small' }, 'Diese Figur hat noch keine Bones. ', el('button', { class: 'btn tiny', onclick: () => App.openBones(actor.asset) }, 'Bones einrichten')) : null);
        if (actor.puppet && Puppet.get(actor.puppet)) acCard.appendChild(AnimEd.puppetCard(a, actor, t));
        if (a.type === 'scene') acCard.appendChild(AnimEd.maskCard(a, actor, t));
        if (a.type === 'scene' && !actor.puppet) acCard.appendChild(AnimEd.mouthCard(a, actor));
      }
      box.appendChild(acCard);
      if (a.type === 'scene' && actor && actor.puppet && a.actors.filter((x) => x.puppet).length >= 2) box.appendChild(AnimEd.seamCard(a, actor));

      // Ausgewählter Keyframe
      const kSel = ui().animKey;
      if (kSel && actor) {
        const row = AnimEd.rows(a).find((r) => r.id === kSel.row);
        const k = row && row.keys.find((x) => Math.abs(x.t - kSel.t) < 0.001);
        if (k) {
          const flds = AnimEd.fields(row);
          box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, '◆ Keyframe · ' + row.label),
            el('div', { class: 'kf-grid' },
              el('label', null, el('span', { class: 'muted small' }, 'Zeit s'), el('input', { type: 'number', step: 0.05, value: k.t, onchange: (e) => VN.mutate(() => { k.t = Math.max(0, Math.min(a.dur, Number(e.target.value))); row.keys.sort((x, y) => x.t - y.t); ui().animKey = { row: row.id, t: k.t }; }) })),
              ...flds.map(([f, l]) => el('label', null, el('span', { class: 'muted small' }, l), el('input', { type: 'number', step: 0.5, value: k[f] != null ? k[f] : '', onchange: (e) => VN.mutate(() => { k[f] = e.target.value === '' ? undefined : Number(e.target.value); }) })))),
            row.keys.indexOf(k) > 0 ? CurveEd.box(k.e, (v) => VN.mutate(() => { k.e = v; }), { mode: 'anim', label: VN.t('Kurve zum Keyframe') }) : el('div', { class: 'muted small' }, 'Erster Keyframe – die Kurve gilt für den Weg vom vorigen Keyframe hierher.'),
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
          const fps = VN.animFps(a.fps), stepO = {};
          const frame = (now) => {
            const t = Math.min(a.dur, (now - start) / 1000);
            if (fps && t < a.dur && !VN.fpsStep(stepO, t, fps)) { requestAnimationFrame(frame); return; }
            Anim.draw(ctx, sc, fps ? Math.floor(t * fps + 1e-6) / fps : t, Math.min(fps ? 1 / 5 : 1 / 30, (now - last) / 1000), { bgFill: true });
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
