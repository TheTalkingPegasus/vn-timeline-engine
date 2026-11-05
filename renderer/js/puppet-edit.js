// Gliederpuppen-Baukasten (0.7.6) im Reiter „Figuren“ → „Gliederpuppen“.
// Teile (Bilder) per Drag and Drop hinzufügen, verschieben, Gelenk-Pin setzen und auf ein anderes Teil ziehen
// (= Eltern-Teil, wie die Verbindung in After Effects). Idle und Bones pro Teil. „Ausprobieren“ dreht Teile um
// ihre Pins (Umschalt = IK: die Kette folgt der Maus), ohne etwas zu speichern.
(function () {
  const { el } = VN;
  const M = () => Puppet.m;
  const ui = () => VN.ui;
  const list = () => (VN.project.puppets = VN.project.puppets || []);
  const cur = () => { const l = list(); if (!l.find((x) => x.id === ui().pupSel)) ui().pupSel = l[0] ? l[0].id : null; return l.find((x) => x.id === ui().pupSel) || null; };
  const selPart = (pup) => (pup && ui().pupPart ? Puppet.part(pup, ui().pupPart) : null);

  const PupEd = (window.PupEd = { _res: null, _resKey: '' });
  // Festpinnen beim Ausprobieren (Doppelklick)
  PupEd.togglePin = (part) => {
    const ui = VN.ui;
    ui.pupPinned = ui.pupPinned || {};
    ui.pupPinned[part.id] = !ui.pupPinned[part.id];
    VN.toast(ui.pupPinned[part.id] ? VN.tf('„{name}“ festgepinnt', { name: part.name }) : VN.tf('„{name}“ gelöst', { name: part.name }));
  };

  // Bild-Transparenz für genaue Treffer (Klick auf durchsichtige Stellen trifft das Teil darunter)
  const alphaCache = new Map();
  const alphaOf = (img) => {
    if (!img) return null;
    if (alphaCache.has(img)) return alphaCache.get(img);
    let out = null;
    try {
      const w = Math.min(256, img.naturalWidth || 256), h = Math.max(1, Math.round(w * (img.naturalHeight || 256) / (img.naturalWidth || 256)));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h).data; out = { w, h, a: new Uint8Array(w * h) };
      for (let i = 0; i < w * h; i++) out.a[i] = d[i * 4 + 3];
    } catch (e) { out = null; }
    alphaCache.set(img, out);
    return out;
  };

  // Vorlage „Mensch“ (0.9.8): graue Plätze für Körperteile in menschlichen Proportionen, schon mit Gelenken
  // verbunden. Bilder auf einen Platz ziehen → der Platz wird gefüllt (Bild eingepasst, Gelenk bleibt).
  // Danach Pins, Größe und Drehung von Hand anpassen. Maße in Puppen-Pixeln, Figur ca. 1000 hoch.
  // [Name, Breite, Höhe, Pin X/Y im Teil, Pin-Position in der Figur, Eltern-Name]
  const HUMAN = () => {
    const out = [];
    // lim: Gelenk-Grenzen in Grad (positiv = Ende wandert nach links). Knie und Ellbogen knicken nur in eine Richtung.
    const add = (name, w, h, ax, ay, px, py, parent, lim) => out.push({ name, w, h, ax, ay, px, py, parent, lim });
    const side = (s, a, b) => (s < 0 ? [a, b] : [-b, -a]);
    for (const [s, sd] of [[-1, 'L'], [1, 'R']]) {
      add('Oberschenkel ' + sd, 90, 230, 45, 20, s * 60, 510, 'Torso', side(s, -30, 100));
      add('Unterschenkel ' + sd, 76, 230, 38, 15, s * 60, 720, 'Oberschenkel ' + sd, side(s, -160, 0));
      add('Fuß ' + sd, 110, 60, 55, 12, s * 60, 935, 'Unterschenkel ' + sd, [-90, 90]);
    }
    add('Torso', 240, 320, 120, 300, 0, 500, null, [-90, 90]);
    add('Kopf', 180, 220, 90, 205, 0, 215, 'Torso', [-45, 45]);
    for (const [s, sd] of [[-1, 'L'], [1, 'R']]) {
      add('Oberarm ' + sd, 70, 200, 35, 20, s * 128, 232, 'Torso', null);
      add('Unterarm ' + sd, 60, 190, 30, 15, s * 128, 412, 'Oberarm ' + sd, side(s, -160, 5));
      add('Hand ' + sd, 70, 90, 35, 10, s * 128, 587, 'Unterarm ' + sd, [-80, 80]);
    }
    return out;
  };
  PupEd.newFromTemplate = () => VN.mutate(() => {
    const pup = { id: VN.uid('pup'), name: VN.t('Mensch'), parts: [], template: 'human' };
    const ids = {};
    for (const d of HUMAN()) {
      const p = { id: VN.uid('pp'), name: VN.t(d.name), slot: d.name, asset: null, parent: null, x: d.px - d.ax, y: d.py - d.ay, w: d.w, h: d.h, ax: d.ax, ay: d.ay, rot: 0, idle: { type: 'none', amp: 4, speed: 3, phase: 0 }, bones: true };
      if (d.lim) p.lim = { on: true, min: d.lim[0], max: d.lim[1] };
      ids[d.name] = p.id;
      pup.parts.push(Object.assign(p, { _par: d.parent }));
    }
    for (const p of pup.parts) { p.parent = p._par ? ids[p._par] : null; delete p._par; }
    const torso = pup.parts.find((p) => p.slot === 'Torso');
    if (torso) torso.idle = { type: 'breathe', amp: 2, speed: 3.6, phase: 0 };
    list().push(pup); ui().pupSel = pup.id; ui().pupPart = null; ui().pupView = null; ui().pupTest = null;
  });
  // Bild in einen Platz einpassen: Seitenverhältnis bleibt, das Gelenk bleibt an seiner Stelle
  PupEd.fillSlot = (pup, p, assetId) => {
    const im = new Image();
    const go = (nw, nh) => VN.mutate(() => {
      const k = Math.min(p.w / nw, p.h / nh);
      const w = Math.max(4, Math.round(nw * k)), h = Math.max(4, Math.round(nh * k));
      const pinX = p.x + p.ax, pinY = p.y + p.ay, w0 = p.w, h0 = p.h;
      const ax = Math.round(p.ax / w0 * w), ay = Math.round(p.ay / h0 * h);
      Object.assign(p, { asset: assetId, w, h, ax, ay, x: pinX - ax, y: pinY - ay });
      if (p.tx != null) { p.tx = Math.round(p.tx / w0 * w); p.ty = Math.round(p.ty / h0 * h); }
      ui().pupPart = p.id;
    });
    im.onload = () => go(im.naturalWidth || p.w, im.naturalHeight || p.h);
    im.onerror = () => go(p.w, p.h);
    im.src = VN.assetUrl(assetId);
  };

  PupEd.newPuppet = () => VN.mutate(() => {
    const pup = { id: VN.uid('pup'), name: VN.t('Neue Gliederpuppe'), parts: [] };
    list().push(pup); ui().pupSel = pup.id; ui().pupPart = null; ui().pupView = null;
  });
  // Teil aus einem Bild anlegen (an Puppen-Koordinate x, y = Mitte)
  PupEd.addPart = (pup, assetId, x, y) => {
    const im = new Image();
    const go = (w, h) => {
      // sehr große Bilder auf eine handliche Größe bringen – Verhältnis bleibt
      const k = Math.min(1, 900 / Math.max(w, h));
      w = Math.round(w * k); h = Math.round(h * k);
      VN.mutate(() => {
        const bb = pup.parts.length ? Puppet.bounds(pup) : { x: 0, y: 0, w: 0, h: 0 };
        const px = x != null ? x - w / 2 : bb.x + bb.w / 2 - w / 2, py = y != null ? y - h / 2 : bb.y + bb.h / 2 - h / 2;
        const p = Puppet.newPart(assetId, w, h, px, py);
        pup.parts.push(p);
        ui().pupPart = p.id;
        if (pup.parts.length === 1) ui().pupView = null;
      });
    };
    im.onload = () => go(im.naturalWidth || 200, im.naturalHeight || 200);
    im.onerror = () => go(200, 200);
    im.src = VN.assetUrl(assetId);
  };
  PupEd.removePart = (pup, p) => VN.mutate(() => {
    for (const c of pup.parts) if (c.parent === p.id) c.parent = p.parent || null;
    pup.parts = pup.parts.filter((x) => x !== p);
    if (ui().pupPart === p.id) ui().pupPart = null;
  });
  // Pin verschieben, ohne dass das Bild springt (auch bei gedrehten Teilen)
  // ---------- Ordner (0.9.15) ----------
  // pup.folders: [{ id, name, parent, open, hidden, locked }] · p.folder = Ordner-ID. Nur Ordnung und Zeichenreihenfolge –
  // die Bewegung bestimmt weiterhin das Gelenk („Hängt an“).
  PupEd.folder = (pup, id) => (pup.folders || []).find((f) => f.id === id) || null;
  PupEd.fChain = (pup, fid) => { const out = []; let f = PupEd.folder(pup, fid), n = 0; while (f && n++ < 20) { out.unshift(f.id); f = PupEd.folder(pup, f.parent); } return out; };
  PupEd.fDesc = (pup, fid) => { const out = new Set([fid]); let grew = true; while (grew) { grew = false; for (const f of pup.folders || []) if (f.parent && out.has(f.parent) && !out.has(f.id)) { out.add(f.id); grew = true; } } return out; };
  // Teile eines Ordners (samt Unterordnern) liegen in der Zeichenreihenfolge immer zusammen
  PupEd.normalize = (pup) => {
    const root = { kids: [] }, nodes = {};
    for (const p of pup.parts) {
      if (p.folder && !PupEd.folder(pup, p.folder)) delete p.folder;
      let cur = root;
      for (const fid of PupEd.fChain(pup, p.folder)) { if (!nodes[fid]) { nodes[fid] = { kids: [] }; cur.kids.push(nodes[fid]); } cur = nodes[fid]; }
      cur.kids.push(p);
    }
    const out = [], walk = (n) => { for (const k of n.kids) { if (k.kids) walk(k); else out.push(k); } };
    walk(root);
    pup.parts.splice(0, pup.parts.length, ...out);
  };
  // Teile in ausgeblendeten bzw. gesperrten Ordnern (nur im Editor)
  PupEd.fFlag = (pup, key) => {
    const set = new Set();
    for (const p of pup.parts) if (p.folder && PupEd.fChain(pup, p.folder).some((fid) => (PupEd.folder(pup, fid) || {})[key])) set.add(p.id);
    return set;
  };
  // Block (Teil oder ganzer Ordner) eine Stelle nach vorne (+1) oder hinten (−1) – über das Nachbar-Element derselben Ebene
  PupEd.moveItem = (pup, item, dir) => {
    PupEd.normalize(pup);
    const level = item.part ? (item.part.folder || null) : (PupEd.folder(pup, item.fid).parent || null);
    // Elemente dieser Ebene in Zeichenreihenfolge: Teile direkt in der Ebene und Unterordner als Block
    const units = [];
    for (const p of pup.parts) {
      const ch = PupEd.fChain(pup, p.folder), li = level ? ch.indexOf(level) : -1;
      if (level && li < 0) continue;
      const key = ch[li + 1] ? 'f:' + ch[li + 1] : 'p:' + p.id;
      let u = units[units.length - 1];
      if (!u || u.key !== key) { u = { key, parts: [] }; units.push(u); }
      u.parts.push(p);
    }
    const key = item.part ? 'p:' + item.part.id : 'f:' + item.fid;
    const i = units.findIndex((u) => u.key === key), j = i + dir;
    if (i < 0 || j < 0 || j >= units.length) return false;
    [units[i], units[j]] = [units[j], units[i]];
    const flat = units.flatMap((u) => u.parts), set = new Set(flat.map((p) => p.id));
    const start = pup.parts.findIndex((p) => set.has(p.id));
    pup.parts.splice(start, flat.length, ...flat);
    return true;
  };
  // Mitte einer Naht (halbe Länge der Linie), im Bild des Teils
  PupEd.seamMid = (pts) => {
    let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let h = L / 2;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (h <= d) { const k = d ? h / d : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]; } h -= d; }
    return pts[0];
  };
  // Naht als Gelenk (0.9.13): Das Teil hängt am angenähten Teil und dreht sich um die Mitte der Naht –
  // so bewegt es sich mit dem Bild des anderen Teils, egal wo der alte Pin lag
  PupEd.seamJoint = (pup, p, s) => {
    if (!s || !s.to || s.to === p.id || Puppet.descendants(pup, p.id).has(s.to)) return false;
    // Der Körper (Wurzel mit angehängten Teilen) wird nicht an etwas anderes gehängt – sonst ließe sich die Figur nicht mehr verschieben
    if (!p.parent && Puppet.children(pup, p.id).length) return false;
    const [u, v] = PupEd.seamMid(s.pts);
    p.parent = s.to;
    PupEd.setPin(p, Math.round(u * 10) / 10, Math.round(v * 10) / 10);
    return true;
  };
  PupEd.setPin = (p, ax, ay) => {
    const r = (p.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const ra = (x, y) => [x - (c * x - s * y), y - (s * x + c * y)];
    const [o1, o2] = ra(p.ax, p.ay), [n1, n2] = ra(ax, ay);
    p.x += o1 - n1; p.y += o2 - n2; p.ax = ax; p.ay = ay;
  };

  // ---------- Bühne ----------
  PupEd.render = (center) => {
    center.innerHTML = '';
    cancelAnimationFrame(PupEd._raf);
    const pup = cur();
    const body = el('div', { class: 'pup-wrap' });
    center.appendChild(body);
    const side = el('div', { class: 'pup-list' }, el('div', { class: 'sec-title' }, 'Gliederpuppen'),
      ...list().map((x) => el('div', { class: 'list-item' + (x === pup ? ' active' : ''), onclick: () => { ui().pupSel = x.id; ui().pupPart = null; ui().pupView = null; ui().pupTest = null; VN.render(); } },
        el('span', { class: 'an-ico' }, '🦴'), el('span', { class: 'name' }, x.name), el('span', { class: 'muted small' }, x.parts.length + ' ' + VN.t('Teile')))),
      el('button', { class: 'btn tiny primary', onclick: PupEd.newPuppet }, '+ Gliederpuppe'),
      el('button', { class: 'btn tiny', title: VN.t('Fertiges Raster mit Plätzen für Kopf, Torso, Arme und Beine – Bilder hineinziehen, dann Proportionen anpassen'), onclick: PupEd.newFromTemplate }, '+ Vorlage: Mensch'));
    body.appendChild(side);
    const main = el('div', { class: 'pup-main' });
    body.appendChild(main);
    if (!pup) {
      main.appendChild(el('div', { class: 'an-empty' },
        el('div', { style: { fontSize: '40px' } }, '🦴'),
        el('h2', null, 'Gliederpuppen'),
        el('p', { class: 'muted' }, 'Setze eine Figur aus einzelnen Körperteilen zusammen – Kopf, Torso, Oberarm, Unterarm, Hand … – jedes Teil ein eigenes Bild mit transparentem Hintergrund. Verbinde die Teile mit Gelenk-Pins: Der Oberarm hängt an der Schulter, der Unterarm am Ellbogen. Dann lässt sich die Figur wie eine Puppe bewegen, im Animations-Editor animieren und im Spiel mit Idle-Bewegungen zeigen.'),
        el('div', { class: 'row gap8', style: { justifyContent: 'center' } },
          el('button', { class: 'btn primary', onclick: PupEd.newFromTemplate }, '🧍 Vorlage: Mensch'),
          el('button', { class: 'btn', onclick: PupEd.newPuppet }, '+ Leere Gliederpuppe')),
        el('p', { class: 'muted small' }, 'Die Vorlage legt Plätze für Kopf, Torso, Arme, Hände, Beine und Füße an – schon mit Gelenken verbunden. Zieh deine Bilder einfach auf die grauen Plätze und pass danach Größe und Gelenke an.')));
      return;
    }
    const testing = !!ui().pupTest;
    main.appendChild(el('div', { class: 'view-head' },
      el('input', { class: 'name-input', value: pup.name, onchange: (e) => VN.mutate(() => { pup.name = e.target.value || 'Gliederpuppe'; }) }),
      el('span', { class: 'muted' }, pup.parts.length + ' ' + VN.t('Teile')),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn' + (testing ? ' primary' : ''), title: VN.t('Teile um ihre Pins drehen (Umschalt = IK), ohne zu speichern'), onclick: () => { ui().pupTest = testing ? null : {}; VN.render(); } }, testing ? '✓ Ausprobieren' : '🤸 Ausprobieren'),
      testing ? el('button', { class: 'btn', onclick: () => { ui().pupTest = {}; VN.render(); } }, VN.t('Zurücksetzen')) : null,
      el('button', { class: 'btn' + (ui().pupErase && ui().pupErase.mode !== 'inpaint' ? ' primary' : ''), title: VN.t('Kanten und harte Übergänge an einem Teil wegradieren – Größe und Weichheit einstellbar'), onclick: () => PupEd.toggleErase(pup) }, ui().pupErase && ui().pupErase.mode !== 'inpaint' ? '✓ Radierer' : '🧽 Radierer'),
      el('button', { class: 'btn' + (ui().pupErase && ui().pupErase.mode === 'inpaint' ? ' primary' : ''), title: VN.t('Lücken an einem Teil maskieren und mit einem passenden Farbverlauf füllen – läuft ohne KI-Modell'), onclick: () => PupEd.toggleInpaint(pup) }, ui().pupErase && ui().pupErase.mode === 'inpaint' ? '✓ Inpaint-Stift' : '🖌 Inpaint-Stift'),
      testing ? null : el('button', { class: 'btn' + (ui().pupHold ? ' primary' : ''), title: VN.t('Haftpunkte setzen wie Pins bei den Bones – im Animations-Editor hält ein Doppelklick die Stelle fest, der Rest der Figur bewegt und dehnt sich weiter'), onclick: () => { ui().pupHold = !ui().pupHold; ui().pupSew = false; ui().pupRuler = false; ui().pupErase = null; VN.render(); } }, ui().pupHold ? '✓ Haftpunkte' : '📌 Haftpunkte'),
      testing ? null : el('button', { class: 'btn' + (ui().pupSew ? ' primary' : ''), title: VN.t('Zwei sich überlappende Teile an einer Linie zusammennähen – die Naht-Punkte wandern exakt mit dem anderen Teil mit, keine Lücken mehr am Übergang'), onclick: () => { ui().pupSew = !ui().pupSew; ui().pupHold = false; ui().pupRuler = false; ui().pupErase = null; VN.render(); } }, ui().pupSew ? '✓ Nähen' : '🧵 Nähen'),
      testing ? null : el('button', { class: 'btn' + (ui().pupRuler ? ' primary' : ''), title: VN.t('Länge jedes Glieds markieren: vom Gelenk bis zum nächsten Gelenk (z. B. Oberschenkel bis Knie). Bestimmt, wie weit sich die Figur beim Puppenspiel strecken kann.'), onclick: () => { ui().pupRuler = !ui().pupRuler; ui().pupErase = null; ui().pupSew = false; VN.render(); } }, ui().pupRuler ? '✓ Längen' : '📏 Längen'),
      el('label', { class: 'check btn' }, el('input', { type: 'checkbox', checked: !!ui().pupIdle, onchange: (e) => { ui().pupIdle = e.target.checked; } }), 'Idle abspielen'),
      el('label', { class: 'check btn' }, el('input', { type: 'checkbox', checked: ui().pupPins !== false, onchange: (e) => { ui().pupPins = e.target.checked; } }), 'Pins')));
    const wrap = el('div', { class: 'pup-stage-wrap' });
    const canvas = el('canvas', { class: 'pup-ed-canvas', tabindex: '0' });
    wrap.appendChild(canvas);
    main.appendChild(wrap);
    main.appendChild(el('div', { class: 'muted small pup-help' }, ui().pupHold && !testing
      ? 'Haftpunkte: auf ein Teil klicken = Punkt setzen (z. B. Handfläche, Ferse, Knie) · Punkt ziehen = verschieben · rechts unter „Haftpunkte“ Reichweite und Löschen. Im Animations-Editor hält ein Doppelklick auf den Punkt diese Stelle fest: Bewegst du die Figur, bleibt sie kleben, die Glieder beugen sich und das Bild dehnt sich, wo sie nicht reichen.'
      : ui().pupSew && !testing
      ? 'Nähen: Teil wählen (z. B. Oberschenkel) und entlang der Kante eine Linie ziehen, wo es auf dem anderen Teil liegt (z. B. an der Hüfte). Das Teil darunter wird automatisch erkannt. Die Naht-Punkte kleben dann am anderen Teil fest, der Rest folgt dem eigenen Gelenk – dazwischen wird das Bild weich verformt. Weichheit und Ziel rechts unter „Nähte“.'
      : ui().pupRuler && !testing
      ? 'Längen: Auf einem Teil vom Gelenk zum Ende ziehen (z. B. Oberschenkel bis zum Knie) – die gelbe Linie ist die Länge des Glieds. Ohne eigene Länge gilt: bis zum Gelenk des angehängten Teils.'
      : ui().pupErase && ui().pupErase.mode === 'inpaint'
      ? 'Inpaint-Stift: Teil wählen und die Lücke maskieren – Lasso = umfahren, Lineal = Punkte anklicken (Doppelklick oder Enter schließt), Pinsel = übermalen · Alt = von der Maske abziehen · Enter oder „Füllen“ füllt die Maske · Strg + Z macht das Füllen rückgängig. Gespeichert wird als neue Bilddatei, das Original bleibt erhalten.'
      : ui().pupErase
      ? 'Radierer: Teil wählen und über die Kante malen · Größe und Kantenweichheit rechts · „Wiederherstellen“ malt das Original zurück · Mausrad + Strg = Pinselgröße · Speichern legt eine neue Bilddatei an, das Original bleibt erhalten.'
      : testing
      ? 'Puppenspiel: Doppelklick auf ein Teil = festpinnen (z. B. beide Füße) · Körper ziehen = Festgepinntes bleibt, der Rest beugt sich mit (nach unten = in die Knie), nur so weit die Glieder reichen · Umschalt + Körper = neigen · Teil ziehen = um sein Gelenk drehen · Umschalt + Teil = IK. Nichts davon wird gespeichert – Keyframes setzt du im Animations-Editor.'
      : Puppet.fixed(pup)
      ? 'Bilder aus der Dateiliste hierher ziehen = neues Teil (auf einen grauen Platz = Platz füllen) · Wurzel-Teil ziehen = ganze Figur verschieben · angehängtes Teil ziehen = um sein Gelenk drehen (Umschalt: 15°-Schritte, Alt = frei verschieben) · roten Pin ziehen = Gelenk setzen; auf einem anderen Teil loslassen = daran anhängen · Entf = Teil löschen'
      : 'Bilder aus der Dateiliste hierher ziehen = neues Teil · Teil ziehen = verschieben (Kinder wandern mit, Alt = nur dieses Teil) · roten Pin ziehen = Gelenk setzen; auf einem anderen Teil loslassen = daran anhängen · Entf = Teil löschen'));
    PupEd.stage(pup, canvas, wrap);
  };

  PupEd.stage = (pup, canvas, wrap) => {
    const key = JSON.stringify(pup.parts.map((p) => [p.asset, p.bones !== false, window.Rig && Rig.has(p.asset)]));
    if (PupEd._resKey !== key) { PupEd._resKey = key; PupEd._res = null; PupEd._resP = Puppet.load(pup).then((r) => { if (PupEd._resKey === key) PupEd._res = r; }); }
    const ctx = canvas.getContext('2d');
    const st = {};
    const t0 = performance.now();
    let last = t0;
    let drag = null;
    // Ansicht: Puppe passend einpassen (bleibt beim Ziehen stehen)
    const view = () => {
      const r = canvas.getBoundingClientRect();
      if (!ui().pupView || ui().pupView.w !== Math.round(r.width) || ui().pupView.h !== Math.round(r.height)) {
        const bb = pup.parts.length ? Puppet.bounds(pup) : { x: -200, y: -300, w: 400, h: 600 };
        const k = Math.min(2, Math.min((r.width - 80) / bb.w, (r.height - 80) / bb.h));
        ui().pupView = { w: Math.round(r.width), h: Math.round(r.height), k, x: r.width / 2 - (bb.x + bb.w / 2) * k, y: r.height / 2 - (bb.y + bb.h / 2) * k };
      }
      return ui().pupView;
    };
    const baseM = () => { const v = view(); return [v.k, 0, 0, v.k, v.x, v.y]; };
    const toPup = (cx, cy) => { const r = canvas.getBoundingClientRect(); const v = view(); return [(cx - r.left - v.x) / v.k, (cy - r.top - v.y) / v.k]; };
    const pose = () => (ui().pupTest ? ui().pupTest : null);
    const mats = () => Puppet.solve(pup, pose(), null, null, 0);
    // Teil unter einem Punkt (Puppen-Koordinaten), oberstes zuerst, durchsichtige Stellen zählen nicht
    const hitPart = (x, y, skip) => {
      const ms = mats();
      for (let i = pup.parts.length - 1; i >= 0; i--) {
        const p = pup.parts[i];
        if (p.hidden || (skip && skip.has(p.id)) || PupEd.fFlag(pup, 'hidden').has(p.id) || PupEd.fFlag(pup, 'locked').has(p.id)) continue;
        let [u, v] = M().ap(M().inv(ms[p.id]), x, y);
        if (u < 0 || v < 0 || u > p.w || v > p.h) continue;
        if (p.flipX) u = p.w - u;
        const al = PupEd._res && alphaOf(PupEd._res.imgs[p.id]);
        if (al && al.a[Math.min(al.h - 1, Math.floor(v / p.h * al.h)) * al.w + Math.min(al.w - 1, Math.floor(u / p.w * al.w))] < 20) continue;
        return p;
      }
      return null;
    };
    const pinAt = (x, y) => {
      if (ui().pupPins === false) return null;
      const ms = mats(), k = view().k;
      const sel = selPart(pup);
      const order = sel ? [sel, ...pup.parts.filter((p) => p !== sel).reverse()] : pup.parts.slice().reverse();
      return order.find((p) => { const [px, py] = M().ap(ms[p.id], p.ax, p.ay); return Math.hypot(px - x, py - y) < 9 / k; }) || null;
    };

    const frame = (now) => {
      if (!canvas.isConnected) return;
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(r.width * dpr) || canvas.height !== Math.round(r.height * dpr)) { canvas.width = Math.max(2, Math.round(r.width * dpr)); canvas.height = Math.max(2, Math.round(r.height * dpr)); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const dt = Math.min(1 / 20, (now - last) / 1000); last = now;
      const erasing = !!ui().pupErase;
      const t = ui().pupIdle && !erasing ? (now - t0) / 1000 : null;
      const base = baseM();
      // Boden-Linie
      const bb = pup.parts.length ? Puppet.bounds(pup) : null;
      if (bb) { const [, gy] = M().ap(base, 0, bb.y + bb.h); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(r.width, gy); ctx.stroke(); }
      const ed = PupEd._edit;
      const ms = Puppet.draw(ctx, pup, PupEd._res, base, t, t != null ? dt : 0, erasing ? null : pose(), st, { placeholder: true, override: ed && ed.cv ? { [ed.pid]: ed.cv } : null, skip: PupEd.fFlag(pup, 'hidden') });
      // Auswahl, Pins, Verbindungen
      const sel = selPart(pup);
      if (sel && ms[sel.id]) {
        const m = ms[sel.id];
        ctx.beginPath();
        for (const [i, [u, v]] of [[0, 0], [sel.w, 0], [sel.w, sel.h], [0, sel.h]].entries()) { const [x, y] = M().ap(m, u, v); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.closePath(); ctx.strokeStyle = '#e8a43a'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
      }
      if (ui().pupPins !== false) {
        for (const p of pup.parts) {
          if (!ms[p.id]) continue;
          const [px, py] = M().ap(ms[p.id], p.ax, p.ay);
          const par = p.parent && Puppet.part(pup, p.parent);
          if (par && ms[par.id]) {
            const [qx, qy] = M().ap(ms[par.id], par.ax, par.ay);
            ctx.strokeStyle = 'rgba(255,90,90,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
          }
          const on = sel === p;
          const pinned = ui().pupTest && ui().pupPinned && ui().pupPinned[p.id];
          ctx.fillStyle = on ? '#ff5a5a' : par ? 'rgba(255,90,90,0.85)' : '#e8a43a';
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(px, py, on ? 7 : 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          if (pinned) { const [tx, ty] = M().ap(ms[p.id], ...Puppet.tip(p, pup)); ctx.fillStyle = '#4fb3c8'; ctx.fillRect(tx - 5, ty - 5, 10, 10); }
        }
      }
      // Nähte (0.9.12): Stich-Linie auf dem Teil
      if (ui().pupPins !== false || ui().pupSew) {
        for (const p of pup.parts) {
          if (!ms[p.id] || !(p.seams || []).length) continue;
          for (const s of p.seams) {
            if (!s.pts || s.pts.length < 2) continue;
            const pts = s.pts.map(([u, v]) => M().ap(ms[p.id], u, v));
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.setLineDash([]);
            ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
            ctx.lineWidth = 1.6; ctx.strokeStyle = sel === p ? '#ffd166' : '#f2f2f2'; ctx.setLineDash([5, 4]);
            ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
          }
        }
      }
      // Haftpunkte (0.9.13)
      if (ui().pupPins !== false || ui().pupHold) {
        for (const p of pup.parts) {
          if (!ms[p.id]) continue;
          for (const hp of p.holdPts || []) {
            const [hx, hy] = M().ap(ms[p.id], hp.u, hp.v);
            ctx.fillStyle = 'rgba(255,184,77,0.35)'; ctx.strokeStyle = '#ffb84d'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#ffb84d'; ctx.beginPath(); ctx.arc(hx, hy, 2, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      if (PupEd._sewLine && PupEd._sewLine.length > 1) {
        const pts = PupEd._sewLine.map(([x, y]) => M().ap(base, x, y));
        ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffd166'; ctx.setLineDash([5, 4]);
        ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
      }
      // Längen der Glieder (Lineal, 0.9.8)
      if (ui().pupRuler || ui().pupTest) {
        for (const p of pup.parts) {
          if (!ms[p.id] || !p.parent && !ui().pupRuler) continue;
          const [px, py] = M().ap(ms[p.id], p.ax, p.ay), [tx, ty] = M().ap(ms[p.id], ...Puppet.tip(p, pup));
          ctx.strokeStyle = p.tx != null ? '#f0c040' : 'rgba(240,192,64,0.55)'; ctx.lineWidth = ui().pupRuler ? 3 : 1.5; ctx.setLineDash(p.tx != null ? [] : [6, 4]);
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
          if (ui().pupRuler) {
            ctx.fillStyle = '#f0c040'; ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = '11px Segoe UI, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(Math.round(Puppet.length(p, pup)) + ' px', (px + tx) / 2 + 6, (py + ty) / 2);
          }
        }
      }
      if (erasing && ui().pupErase.mode === 'inpaint') PupEd.fillOverlay(ctx, pup, ms);
      // Pinsel-Vorschau des Radierers
      if (erasing && PupEd._mouse && (ui().pupErase.mode !== 'inpaint' || (ui().pupErase.tool === 'brush' && !ui().pupErase.pick))) {
        const E = ui().pupErase, r0 = E.size / 2;
        ctx.strokeStyle = E.mode === 'restore' ? '#6cc48a' : '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(PupEd._mouse[0], PupEd._mouse[1], r0, 0, Math.PI * 2); ctx.stroke();
        const inner = r0 * (1 - E.soft / 100);
        if (inner > 2) { ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(PupEd._mouse[0], PupEd._mouse[1], inner, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      }
      if (drag && drag.drop) { const [x, y] = M().ap(base, drag.drop[0], drag.drop[1]); ctx.strokeStyle = '#6cc48a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.stroke(); }
      if (!pup.parts.length) { ctx.fillStyle = '#7d808c'; ctx.font = '14px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(VN.t('Bilder aus der Dateiliste hierher ziehen – jedes Bild wird ein Körperteil.'), r.width / 2, r.height / 2); }
      PupEd._raf = requestAnimationFrame(frame);
    };
    PupEd._raf = requestAnimationFrame(frame);

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      canvas.focus({ preventScroll: true });
      const [x, y] = toPup(e.clientX, e.clientY);
      if (ui().pupErase && ui().pupErase.mode === 'inpaint') { e.preventDefault(); PupEd.fillDown(e, pup, toPup, view, mats, hitPart); return; }
      if (ui().pupErase) { e.preventDefault(); PupEd.eraseDown(e, pup, canvas, toPup, view, mats, hitPart); return; }
      const testing = !!ui().pupTest;
      // Haftpunkte (0.9.13): Klick auf ein Teil = Punkt setzen, Punkt ziehen = verschieben
      if (ui().pupHold && !testing) {
        const ms = mats(), k = view().k;
        let found = null;
        for (const p of pup.parts) for (const hp of p.holdPts || []) { const [hx, hy] = M().ap(ms[p.id], hp.u, hp.v); if (Math.hypot(hx - x, hy - y) * k < 9) found = { p, hp }; }
        if (found) {
          e.preventDefault();
          ui().pupPart = found.p.id;
          const before = JSON.stringify(found.p.holdPts), inv = M().inv(ms[found.p.id]);
          VN.drag(e, (dx, dy, ev) => { const [qx, qy] = toPup(ev.clientX, ev.clientY); const [u, v] = M().ap(inv, qx, qy); found.hp.u = Math.round(u * 10) / 10; found.hp.v = Math.round(v * 10) / 10; },
            (dx, dy, moved) => { if (!moved) { VN.render(); return; } const after = JSON.stringify(found.p.holdPts); found.p.holdPts = JSON.parse(before); VN.mutate(() => { found.p.holdPts = JSON.parse(after); }); });
          return;
        }
        const tgt = hitPart(x, y);
        if (!tgt) return;
        e.preventDefault();
        const [u, v] = M().ap(M().inv(ms[tgt.id]), x, y);
        VN.mutate(() => { tgt.holdPts = tgt.holdPts || []; tgt.holdPts.push({ id: VN.uid('hp'), u: Math.round(u * 10) / 10, v: Math.round(v * 10) / 10, soft: 60 }); ui().pupPart = tgt.id; });
        VN.toast(VN.tf('Haftpunkt auf „{name}“ gesetzt', { name: tgt.name }));
        return;
      }
      // Nähen (0.9.12): Linie entlang der Kante ziehen
      if (ui().pupSew && !testing) {
        const own = selPart(pup) || hitPart(x, y);
        if (!own) { VN.toast(VN.t('Erst ein Teil anklicken, das angenäht werden soll')); return; }
        e.preventDefault();
        ui().pupPart = own.id;
        PupEd._sewLine = [[x, y]];
        VN.drag(e, (dx, dy, ev) => {
          const [qx, qy] = toPup(ev.clientX, ev.clientY), L = PupEd._sewLine[PupEd._sewLine.length - 1];
          if (Math.hypot(qx - L[0], qy - L[1]) * view().k > 5) PupEd._sewLine.push([qx, qy]);
        }, () => {
          const line = PupEd._sewLine; PupEd._sewLine = null;
          if (!line || line.length < 2) { VN.render(); return; }
          const ms = mats();
          const mid = line[Math.floor(line.length / 2)];
          const skip = new Set([own.id, ...Puppet.descendants(pup, own.id)]);
          const tgt = hitPart(mid[0], mid[1], skip) || (own.parent && Puppet.part(pup, own.parent));
          if (!tgt) { VN.toast(VN.t('Unter der Linie liegt kein anderes Teil')); VN.render(); return; }
          const inv = M().inv(ms[own.id]);
          const pts = line.map(([px, py]) => M().ap(inv, px, py).map((n) => Math.round(n * 10) / 10));
          let joint = false;
          VN.mutate(() => { own.seams = own.seams || []; const s = { id: VN.uid('sm'), to: tgt.id, pts, soft: 60 }; own.seams.push(s); joint = PupEd.seamJoint(pup, own, s); });
          VN.toast(VN.tf(joint ? '„{a}“ an „{b}“ angenäht – das Gelenk liegt jetzt auf der Naht' : '„{a}“ an „{b}“ angenäht', { a: own.name, b: tgt.name }));
        });
        return;
      }
      // Lineal: auf einem Teil vom Gelenk zum Ende ziehen = Länge des Glieds
      if (ui().pupRuler && !testing) {
        const tgt = hitPart(x, y) || selPart(pup);
        if (!tgt) return;
        e.preventDefault();
        ui().pupPart = tgt.id;
        const before = JSON.stringify(pup.parts);
        const m0 = Puppet.rest(tgt);
        VN.drag(e, (dx, dy, ev) => {
          const [qx, qy] = toPup(ev.clientX, ev.clientY);
          const [u, v] = M().ap(M().inv(m0), qx, qy);
          tgt.tx = Math.round(u); tgt.ty = Math.round(v);
        }, (dx, dy, moved) => {
          if (!moved) { VN.render(); return; }
          const after = JSON.stringify(pup.parts);
          pup.parts = JSON.parse(before);
          VN.mutate(() => { pup.parts = JSON.parse(after); });
        });
        return;
      }
      // Pin ziehen (nur beim Bauen)
      const pin = !testing && pinAt(x, y);
      if (pin) {
        e.preventDefault();
        ui().pupPart = pin.id;
        const before = JSON.stringify(pup.parts);
        const m0 = Puppet.rest(pin);
        const skip = new Set([pin.id, ...Puppet.descendants(pup, pin.id)]);
        drag = { kind: 'pin' };
        VN.drag(e, (dx, dy, ev) => {
          const [qx, qy] = toPup(ev.clientX, ev.clientY);
          const [u, v] = M().ap(M().inv(m0), qx, qy);
          PupEd.setPin(pin, Math.round(u), Math.round(v));
          const tgt = !ev.altKey && hitPart(qx, qy, skip);
          drag.drop = tgt ? [qx, qy] : null; drag.target = tgt;
        }, (dx, dy, moved) => {
          const tgt = drag.target; drag = null;
          if (!moved) { VN.render(); return; }
          const after = JSON.stringify(pup.parts);
          pup.parts = JSON.parse(before);
          VN.mutate(() => {
            pup.parts = JSON.parse(after);
            const p = Puppet.part(pup, pin.id);
            if (tgt) { p.parent = tgt.id; VN.toast(VN.tf('„{a}“ hängt jetzt an „{b}“', { a: p.name, b: tgt.name })); }
          });
        });
        return;
      }
      const hit = hitPart(x, y);
      if (!hit) { if (ui().pupPart) { ui().pupPart = null; VN.render(); } return; }
      e.preventDefault();
      ui().pupPart = hit.id;
      // Ausprobieren: Doppelklick auf ein angehängtes Teil = festpinnen / lösen
      if (testing && hit.parent && VN.isDouble(e, 'pup:' + hit.id)) { PupEd.togglePin(hit); VN.render(); return; }
      // Beim Bauen (0.9.13): Doppelklick schaltet „Ausprobieren“ ein und pinnt das Teil gleich fest
      if (!testing && hit.parent && VN.isDouble(e, 'pupb:' + hit.id)) { ui().pupTest = {}; ui().pupPinned = {}; PupEd.togglePin(hit); VN.toast(VN.t('Ausprobieren eingeschaltet – jetzt den Torso ziehen, das Festgepinnte bleibt stehen')); VN.render(); return; }
      if (testing) {
        // Puppenspiel: Teil um seinen Pin drehen, Umschalt = IK, Wurzel = verschieben
        const pose = ui().pupTest;
        const ms = mats();
        const local = M().ap(M().inv(ms[hit.id]), x, y);
        const piv = M().ap(ms[hit.id], hit.ax, hit.ay);
        const ps0 = Object.assign({ r: 0, x: 0, y: 0 }, pose[hit.id] || {});
        const a0 = Math.atan2(y - piv[1], x - piv[0]);
        const pins = Object.keys(ui().pupPinned || {}).filter((k) => ui().pupPinned[k] && k !== hit.id);
        const fixed = {}; for (const pid of pins) fixed[pid] = Puppet.tipWorld(pup, pose, pid);
        const pose0 = JSON.parse(JSON.stringify(pose));
        VN.drag(e, (dx, dy, ev) => {
          const [qx, qy] = toPup(ev.clientX, ev.clientY);
          // Puppenspiel (0.9.8): Körper (Wurzel) bewegen = festgepinnte Glieder bleiben, der Rest beugt sich mit;
          // Umschalt am Körper = neigen
          if (!hit.parent) {
            for (const k of Object.keys(pose)) delete pose[k];
            Object.assign(pose, JSON.parse(JSON.stringify(pose0)));
            let d = 0;
            if (ev.shiftKey) { d = (Math.atan2(qy - piv[1], qx - piv[0]) - a0) * 180 / Math.PI; if (d > 180) d -= 360; if (d < -180) d += 360; }
            Puppet.moveBody(pup, pose, hit.id, ev.shiftKey ? { x: ps0.x, y: ps0.y, r: ps0.r + d } : { x: ps0.x + qx - x, y: ps0.y + qy - y }, pins, fixed);
            return;
          }
          if (ev.shiftKey) Puppet.ik(pup, pose, hit.id, local, [qx, qy], { links: 3 });
          else { let d = (Math.atan2(qy - piv[1], qx - piv[0]) - a0) * 180 / Math.PI; if (d > 180) d -= 360; if (d < -180) d += 360; pose[hit.id] = Object.assign({}, ps0, { r: Puppet.clampR(hit, ps0.r + d) }); }
          Puppet.keepPins(pup, pose, pins, fixed);
        }, () => VN.render());
        return;
      }
      // Bauen: Teil verschieben (Kinder wandern mit, Alt = nur dieses Teil).
      // Feste Gelenke (0.9.8): ein angehängtes Teil dreht sich beim Ziehen um sein Gelenk (mit allen Kindern),
      // statt sich vom Eltern-Teil zu lösen. Alt verschiebt es trotzdem frei (Gelenk an eine andere Stelle setzen).
      const group = e.altKey ? [hit] : [hit, ...[...Puppet.descendants(pup, hit.id)].map((id) => Puppet.part(pup, id))];
      const start = group.map((p) => ({ x: p.x, y: p.y, rot: p.rot || 0 }));
      const turn = !!(hit.parent && Puppet.fixed(pup) && !e.altKey);
      const px0 = hit.x + hit.ax, py0 = hit.y + hit.ay;
      const a0 = Math.atan2(y - py0, x - px0);
      VN.drag(e, (dx, dy, ev) => {
        const [qx, qy] = toPup(ev.clientX, ev.clientY);
        if (turn) {
          let d = Math.atan2(qy - py0, qx - px0) - a0;
          if (ev.shiftKey) d = Math.round(d / (Math.PI / 12)) * (Math.PI / 12);
          const c = Math.cos(d), sn = Math.sin(d);
          group.forEach((p, i) => {
            const wx = start[i].x + p.ax - px0, wy = start[i].y + p.ay - py0;
            p.x = Math.round(px0 + c * wx - sn * wy - p.ax); p.y = Math.round(py0 + sn * wx + c * wy - p.ay);
            p.rot = Math.round((start[i].rot + d * 180 / Math.PI) * 10) / 10;
          });
        } else group.forEach((p, i) => { p.x = Math.round(start[i].x + qx - x); p.y = Math.round(start[i].y + qy - y); });
      }, (dx, dy, moved) => {
        if (!moved) { VN.render(); return; }
        const end = group.map((p) => ({ x: p.x, y: p.y, rot: p.rot }));
        group.forEach((p, i) => Object.assign(p, start[i]));
        VN.mutate(() => { group.forEach((p, i) => Object.assign(p, end[i])); });
      });
    });
    canvas.addEventListener('mousemove', (e) => { const r = canvas.getBoundingClientRect(); PupEd._mouse = [e.clientX - r.left, e.clientY - r.top]; });
    canvas.addEventListener('mouseleave', () => { PupEd._mouse = null; });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (ui().pupErase && (e.ctrlKey || e.metaKey)) { const E = ui().pupErase; E.size = Math.max(2, Math.min(400, Math.round(E.size * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))); const n = document.getElementById('pup-er-size'); if (n) n.value = E.size; return; }
      const v = view(), r = canvas.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top, nk = Math.max(0.05, Math.min(6, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      v.x = px - (px - v.x) * nk / v.k; v.y = py - (py - v.y) * nk / v.k; v.k = nk;
    }, { passive: false });
    canvas.addEventListener('keydown', (e) => {
      if (ui().pupErase && ui().pupErase.mode === 'inpaint') { PupEd.fillKey(e, pup); return; }
      const p = selPart(pup);
      if ((e.key === 'Delete' || e.key === 'Backspace') && p && !ui().pupTest) { e.preventDefault(); e.stopPropagation(); PupEd.removePart(pup, p); }
    });
    wrap.addEventListener('dragover', (e) => { if (Array.from(e.dataTransfer.types).includes('vn/asset-image') || Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); e.stopPropagation(); wrap.classList.add('over'); } });
    wrap.addEventListener('dragleave', () => wrap.classList.remove('over'));
    wrap.addEventListener('drop', async (e) => {
      e.preventDefault(); e.stopPropagation(); wrap.classList.remove('over');
      const ov = document.getElementById('drag-overlay'); if (ov) ov.hidden = true;
      const [x, y] = toPup(e.clientX, e.clientY);
      let id = e.dataTransfer.getData('vn/asset-image');
      if (!id) { const added = await VN.importPaths(VN.filePaths(e.dataTransfer)); const im = added.find((a) => a.kind === 'image'); if (!im) return; id = im.id; }
      // Auf einen leeren Platz der Vorlage gezogen: Platz füllen
      const slot = hitPart(x, y);
      if (slot && !slot.asset) PupEd.fillSlot(pup, slot, id);
      else PupEd.addPart(pup, id, x, y);
    });
  };

  // ---------- Rechte Seite ----------
  PupEd.inspector = () => {
    const pup = cur();
    const box = el('div', { class: 'insp' }, el('div', null, el('h3', null, 'Figuren'), el('div', { class: 'insp-title' }, pup ? pup.name : 'Gliederpuppen')));
    if (!pup) {
      box.appendChild(el('div', { class: 'hint-box' }, el('strong', null, 'So geht’s'), el('br'),
        '1. Körperteile als einzelne PNGs vorbereiten (transparent). 2. Puppe anlegen und die Bilder auf die Fläche ziehen. 3. Bei jedem Teil den roten Pin auf das Gelenk ziehen und auf dem Eltern-Teil loslassen (Unterarm-Pin auf den Oberarm, Oberarm-Pin auf den Torso). 4. Im Animations-Editor einen Darsteller anlegen und „Gliederpuppe“ wählen.'));
      return box;
    }
    const field = (label, ...kids) => el('div', { class: 'field' }, el('div', { class: 'lbl' }, label), ...kids);
    const num = (v, fn, step) => el('input', { type: 'number', step: step || 1, value: Math.round((v || 0) * 100) / 100, onchange: (e) => VN.mutate(() => fn(Number(String(e.target.value).replace(',', '.')) || 0)) });
    const sel = (v, opts, fn) => { const s = el('select', { onchange: (e) => VN.mutate(() => fn(e.target.value)) }); for (const [k, l] of opts) s.appendChild(el('option', { value: k, selected: String(k) === String(v == null ? '' : v) }, l)); return s; };
    // Ebenen-Liste (oben = vorne), mit Ordnern (0.9.15)
    PupEd.normalize(pup);
    const q = (ui().pupFind || '').trim().toLowerCase();
    const addFolder = () => VN.mutate(() => { pup.folders = pup.folders || []; const f = { id: VN.uid('pf'), name: VN.t('Ordner') + ' ' + (pup.folders.length + 1), parent: null, open: true }; pup.folders.push(f); const sp = selPart(pup); if (sp) { sp.folder = f.id; PupEd.normalize(pup); } ui().pupRename = f.id; });
    const layers = el('div', { class: 'opt-card pup-layers' },
      el('div', { class: 'row gap8 pup-root-drop', ondragover: (e) => { if (PupEd._dnd) { e.preventDefault(); e.currentTarget.classList.add('drop'); } }, ondragleave: (e) => e.currentTarget.classList.remove('drop'),
        ondrop: (e) => { e.preventDefault(); const d = PupEd._dnd; PupEd._dnd = null; if (!d) return; VN.mutate(() => { if (d.part) delete Puppet.part(pup, d.part).folder; else PupEd.folder(pup, d.fid).parent = null; PupEd.normalize(pup); }); } },
        el('div', { class: 'sec-title', style: { flex: '1', margin: 0 } }, 'Teile (oben = vorne)'),
        el('button', { class: 'btn tiny', title: VN.t('Neuer Ordner – nur zur Ordnung und Zeichenreihenfolge, die Bewegung bestimmt weiter „Hängt an“'), onclick: addFolder }, '+ 📁')),
      pup.parts.length > 8 || q ? el('input', { type: 'search', class: 'small-input', placeholder: VN.t('Teile suchen …'), value: ui().pupFind || '', style: { width: '100%', margin: '4px 0' }, oninput: (e) => { ui().pupFind = e.target.value; clearTimeout(PupEd._ft); PupEd._ft = setTimeout(() => { VN.render(); const n = document.querySelector('.pup-layers input[type=search]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); } }) : null);
    const dragStart = (d) => (e) => { PupEd._dnd = d; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'pup'); } catch (er) { /* egal */ } };
    const over = (e) => { if (PupEd._dnd) { e.preventDefault(); e.currentTarget.classList.add('drop'); } };
    const leave = (e) => e.currentTarget.classList.remove('drop');
    // Ablegen auf einem Teil: davor (= weiter vorne) einsortieren, in dessen Ordner
    const dropOnPart = (t) => (e) => {
      e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('drop');
      const d = PupEd._dnd; PupEd._dnd = null; if (!d) return;
      VN.mutate(() => {
        let moving;
        if (d.part) { const p = Puppet.part(pup, d.part); if (!p || p === t) return; if (t.folder) p.folder = t.folder; else delete p.folder; moving = [p]; }
        else { const f = PupEd.folder(pup, d.fid); if (!f || (t.folder && PupEd.fDesc(pup, f.id).has(t.folder))) return; f.parent = t.folder || null; const ds = PupEd.fDesc(pup, f.id); moving = pup.parts.filter((x) => x.folder && ds.has(x.folder)); }
        const set = new Set(moving.map((x) => x.id));
        const rest = pup.parts.filter((x) => !set.has(x.id));
        rest.splice(rest.indexOf(t) + 1, 0, ...moving);
        pup.parts.splice(0, pup.parts.length, ...rest);
        PupEd.normalize(pup);
      });
    };
    const dropOnFolder = (f) => (e) => {
      e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('drop');
      const d = PupEd._dnd; PupEd._dnd = null; if (!d) return;
      VN.mutate(() => {
        if (d.part) { const p = Puppet.part(pup, d.part); if (p) p.folder = f.id; f.open = true; }
        else if (d.fid !== f.id && !PupEd.fDesc(pup, d.fid).has(f.id)) PupEd.folder(pup, d.fid).parent = f.id;
        PupEd.normalize(pup);
      });
    };
    const lockedSet = PupEd.fFlag(pup, 'locked');
    const partRow = (p, lvl) => {
      const i = pup.parts.indexOf(p);
      const rigged = window.Rig && Rig.has(p.asset);
      return el('div', { class: 'pup-layer' + (ui().pupPart === p.id ? ' on' : '') + (lockedSet.has(p.id) ? ' locked' : ''), draggable: 'true', ondragstart: dragStart({ part: p.id }), ondragover: over, ondragleave: leave, ondrop: dropOnPart(p), onclick: () => { ui().pupPart = p.id; VN.render(); } },
        el('span', { class: 'pup-indent', style: { width: lvl * 14 + 'px' } }),
        p.parent ? el('span', { class: 'muted small', title: VN.t('hängt an') + ' ' + ((Puppet.part(pup, p.parent) || {}).name || '?') }, '↳') : null,
        el('span', { class: 'mini-thumb', style: { backgroundImage: `url("${VN.assetUrl(p.asset) || ''}")` } }),
        el('span', { class: 'name' }, p.name),
        rigged && p.bones !== false ? el('span', { class: 'chip green', title: VN.t('hat Bones') }, '🦴') : null,
        p.idle && p.idle.type !== 'none' ? el('span', { class: 'chip', title: VN.t('Idle') }, '∿') : null,
        el('button', { class: 'btn tiny', title: VN.t('nach vorne'), onclick: (e) => { e.stopPropagation(); VN.mutate(() => { PupEd.moveItem(pup, { part: p }, 1); }); } }, '▲'),
        el('button', { class: 'btn tiny', title: VN.t('nach hinten'), onclick: (e) => { e.stopPropagation(); VN.mutate(() => { PupEd.moveItem(pup, { part: p }, -1); }); } }, '▼'));
    };
    const folderRow = (f, lvl, count) => {
      const tog = (k, on, off, title) => el('button', { class: 'btn tiny' + (f[k] ? ' primary' : ''), title: VN.t(title), onclick: (e) => { e.stopPropagation(); VN.mutate(() => { f[k] = !f[k]; if (!f[k]) delete f[k]; }); } }, f[k] ? on : off);
      const name = ui().pupRename === f.id
        ? el('input', { type: 'text', value: f.name, class: 'small-input', style: { flex: '1' }, onclick: (e) => e.stopPropagation(), onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { ui().pupRename = null; VN.render(); } }, onblur: (e) => { const v = e.target.value.trim(); ui().pupRename = null; VN.mutate(() => { if (v) f.name = v; }); } })
        : el('span', { class: 'name', title: VN.t('Doppelklick = umbenennen'), ondblclick: (e) => { e.stopPropagation(); ui().pupRename = f.id; VN.render(); } }, '📁 ' + f.name);
      return el('div', { class: 'pup-layer pup-folder' + (f.hidden ? ' hid' : ''), draggable: 'true', ondragstart: dragStart({ fid: f.id }), ondragover: over, ondragleave: leave, ondrop: dropOnFolder(f), onclick: () => VN.mutate(() => { f.open = !f.open; }) },
        el('span', { class: 'pup-indent', style: { width: lvl * 14 + 'px' } }),
        el('span', { class: 'pup-caret' }, f.open === false ? '▸' : '▾'),
        name,
        el('span', { class: 'muted small' }, String(count)),
        tog('hidden', '🙈', '👁', 'Im Editor ausblenden (im Spiel bleibt alles sichtbar)'),
        tog('locked', '🔒', '🔓', 'Sperren: Teile darin lassen sich auf der Fläche nicht anklicken oder verschieben'),
        el('button', { class: 'btn tiny', title: VN.t('nach vorne'), onclick: (e) => { e.stopPropagation(); VN.mutate(() => { PupEd.moveItem(pup, { fid: f.id }, 1); }); } }, '▲'),
        el('button', { class: 'btn tiny', title: VN.t('nach hinten'), onclick: (e) => { e.stopPropagation(); VN.mutate(() => { PupEd.moveItem(pup, { fid: f.id }, -1); }); } }, '▼'),
        el('button', { class: 'btn tiny danger', title: VN.t('Ordner auflösen (die Teile bleiben)'), onclick: (e) => { e.stopPropagation(); VN.mutate(() => { for (const p of pup.parts) if (p.folder === f.id) { if (f.parent) p.folder = f.parent; else delete p.folder; } for (const g of pup.folders) if (g.parent === f.id) g.parent = f.parent || null; pup.folders = pup.folders.filter((x) => x !== f); if (!pup.folders.length) delete pup.folders; }); } }, '×'));
    };
    if (q) {
      for (const p of pup.parts.slice().reverse()) if (String(p.name).toLowerCase().includes(q)) layers.appendChild(partRow(p, 0));
    } else {
      const countIn = (fid) => { const ds = PupEd.fDesc(pup, fid); return pup.parts.filter((p) => p.folder && ds.has(p.folder)).length; };
      // Leere Ordner oben
      for (const f of pup.folders || []) if (!countIn(f.id) && !(f.parent && countIn(f.parent))) layers.appendChild(folderRow(f, PupEd.fChain(pup, f.parent).length, 0));
      let last = [];
      for (const p of pup.parts.slice().reverse()) {
        const ch = PupEd.fChain(pup, p.folder);
        let k = 0; while (k < ch.length && k < last.length && ch[k] === last[k]) k++;
        for (let j = k; j < ch.length; j++) {
          const hiddenAbove = ch.slice(0, j).some((fid) => (PupEd.folder(pup, fid) || {}).open === false);
          if (!hiddenAbove) layers.appendChild(folderRow(PupEd.folder(pup, ch[j]), j, countIn(ch[j])));
        }
        last = ch;
        if (!ch.some((fid) => (PupEd.folder(pup, fid) || {}).open === false)) layers.appendChild(partRow(p, ch.length));
      }
    }
    layers.appendChild(el('div', { class: 'row gap8' },
      (() => { const s = VN.assetSelect('image', '', (v) => { if (v) PupEd.addPart(pup, v); }); s.title = VN.t('Bild als neues Teil hinzufügen'); return s; })()));
    box.appendChild(layers);

    if (ui().pupErase) box.appendChild(ui().pupErase.mode === 'inpaint' ? PupEd.fillCard(pup) : PupEd.eraseCard(pup));
    const p = selPart(pup);
    if (p) {
      const rigged = window.Rig && Rig.has(p.asset);
      const notMine = new Set([p.id, ...Puppet.descendants(pup, p.id)]);
      box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Teil · ' + p.name),
        field('Name', el('input', { type: 'text', value: p.name, onchange: (e) => VN.mutate(() => { p.name = e.target.value || 'Teil'; }) })),
        (pup.folders || []).length ? field('Ordner', sel(p.folder || '', [['', '— kein Ordner —'], ...pup.folders.map((f) => [f.id, '📁 ' + PupEd.fChain(pup, f.id).map((id) => PupEd.folder(pup, id).name).join(' / ')])], (v) => { if (v) p.folder = v; else delete p.folder; PupEd.normalize(pup); })) : null,
        field('Bild', VN.assetSelect('image', p.asset, (v) => { if (!p.asset && v) PupEd.fillSlot(pup, p, v); else VN.mutate(() => { p.asset = v; }); })),
        !p.asset ? el('div', { class: 'muted small' }, 'Leerer Platz: Bild aus der Dateiliste auf den grauen Platz ziehen oder hier wählen. Es wird eingepasst, das Gelenk bleibt.') : null,
        field('Hängt an (Eltern-Teil)', sel(p.parent || '', [['', '— nichts (Wurzel, z. B. Torso) —'], ...pup.parts.filter((x) => !notMine.has(x.id)).map((x) => [x.id, x.name])], (v) => { p.parent = v || null; })),
        el('div', { class: 'grid2' },
          field('X', num(p.x, (v) => { p.x = v; })), field('Y', num(p.y, (v) => { p.y = v; })),
          field('Breite', num(p.w, (v) => { const k = v / (p.w || 1); p.w = Math.max(4, v); p.h = Math.max(4, Math.round(p.h * k)); p.ax *= k; p.ay *= k; })),
          field('Drehung in Ruhe °', num(p.rot, (v) => { p.rot = v; })),
          field('Pin X (im Bild)', num(p.ax, (v) => PupEd.setPin(p, v, p.ay))), field('Pin Y (im Bild)', num(p.ay, (v) => PupEd.setPin(p, p.ax, v)))),
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!p.hidden, onchange: (e) => VN.mutate(() => { p.hidden = e.target.checked; }) }), 'Ausblenden')));
      // Puppenspiel (0.9.8): Länge des Glieds und Gelenk-Grenzen
      const lim = p.lim || { on: false, min: -90, max: 90 };
      box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Gelenk & Länge'),
        el('div', { class: 'row gap8' }, el('span', { class: 'muted small', style: { flex: '1' } }, VN.tf('Länge: {n} px', { n: Math.round(Puppet.length(p, pup)) }) + (p.tx != null ? '' : ' · ' + VN.t('automatisch'))),
          p.tx != null ? el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { delete p.tx; delete p.ty; }) }, 'Automatisch') : null,
          el('button', { class: 'btn tiny', onclick: () => { ui().pupRuler = true; ui().pupTest = null; VN.render(); } }, '📏 Markieren')),
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!(p.lim && p.lim.on !== false), onchange: (e) => VN.mutate(() => { p.lim = Object.assign({}, lim, { on: e.target.checked }); }) }), 'Gelenk begrenzen'),
        p.lim && p.lim.on !== false ? el('div', { class: 'grid2' },
          field('Von °', num(lim.min, (v) => { p.lim = Object.assign({}, lim, { min: v }); })),
          field('Bis °', num(lim.max, (v) => { p.lim = Object.assign({}, lim, { max: v }); }))) : null,
        el('div', { class: 'muted small' }, 'Wie weit sich das Teil gegenüber der Ruhe-Lage drehen darf (positiv = Ende wandert nach links). So knicken Knie und Ellbogen beim Puppenspiel nur in eine Richtung.')));
      // Haftpunkte (0.9.13)
      const hps = p.holdPts || [];
      box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Haftpunkte'),
        ...hps.map((hp, i) => el('div', { class: 'row gap8', style: { margin: '3px 0' } },
          el('span', null, '📌 ' + (i + 1)),
          el('input', { type: 'range', min: 10, max: 150, value: hp.soft != null ? hp.soft : 60, title: VN.t('Reichweite: wie viel vom Teil sich mitdehnt'), style: { flex: '1' }, onchange: (e) => VN.mutate(() => { hp.soft = Number(e.target.value); }) }),
          el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { p.holdPts = p.holdPts.filter((x) => x !== hp); if (!p.holdPts.length) delete p.holdPts; }) }, '×'))),
        el('button', { class: 'btn tiny' + (ui().pupHold ? ' primary' : ''), onclick: () => { ui().pupHold = !ui().pupHold; ui().pupSew = false; ui().pupTest = null; ui().pupRuler = false; ui().pupErase = null; VN.render(); } }, ui().pupHold ? '✓ Haftpunkte setzen' : '📌 Haftpunkte setzen'),
        el('div', { class: 'muted small' }, hps.length ? 'Regler = Reichweite: wie viel vom Teil sich mitdehnt, wenn die Stelle festgehalten wird. Festhalten: im Animations-Editor Doppelklick auf den Punkt.' : 'Punkte wie Pins bei den Bones, z. B. Handfläche, Ferse oder Knie. Im Animations-Editor hält ein Doppelklick die Stelle fest – der Rest der Figur bewegt sich weiter und dehnt sich.')));
      // Nähte (0.9.12)
      const seams = p.seams || [];
      box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Nähte'),
        ...seams.map((s) => el('div', { class: 'opt-card', style: { margin: '4px 0' } },
          el('div', { class: 'row gap8' }, el('span', null, '🧵'), el('span', { class: 'muted small' }, VN.t('angenäht an')),
            sel(s.to, pup.parts.filter((x) => !notMine.has(x.id)).map((x) => [x.id, x.name]), (v) => { s.to = v; PupEd.seamJoint(pup, p, s); }),
            el('div', { class: 'spacer' }),
            el('button', { class: 'btn tiny danger', onclick: () => VN.mutate(() => { p.seams = p.seams.filter((x) => x !== s); if (!p.seams.length) delete p.seams; }) }, '×')),
          (() => { const [mu, mv] = PupEd.seamMid(s.pts), on = p.parent === s.to && Math.hypot(p.ax - mu, p.ay - mv) < 2;
            return el('div', { class: 'row gap8' }, on ? el('span', { class: 'muted small' }, '📍 ' + VN.t('Gelenk liegt auf der Naht')) : el('button', { class: 'btn tiny', title: VN.t('Das Teil hängt dann an diesem Teil und dreht sich um die Mitte der Naht'), onclick: () => VN.mutate(() => { PupEd.seamJoint(pup, p, s); }) }, '📍 ' + VN.t('Gelenk auf die Naht legen'))); })(),
          field(VN.t('Weichheit') + ': ' + (s.soft != null ? s.soft : 60) + ' %', el('input', { type: 'range', min: 5, max: 100, value: s.soft != null ? s.soft : 60, onchange: (e) => VN.mutate(() => { s.soft = Number(e.target.value); }) })))),
        el('button', { class: 'btn tiny' + (ui().pupSew ? ' primary' : ''), onclick: () => { ui().pupSew = !ui().pupSew; ui().pupTest = null; ui().pupRuler = false; ui().pupErase = null; VN.render(); } }, ui().pupSew ? '✓ Naht ziehen' : '🧵 Naht ziehen'),
        el('div', { class: 'muted small' }, seams.length ? 'Weichheit: wie weit die Verformung ins Teil hineinreicht – wenig = knackige Naht, viel = weiche, gummiartige Biegung.' : 'Entlang der Kante eine Linie ziehen, wo dieses Teil auf einem anderen liegt. Die Naht bleibt dann exakt am anderen Teil, auch beim Idle und Animieren – keine Lücken oder Risse am Übergang.')));
      const id = p.idle || (p.idle = { type: 'none', amp: 4, speed: 3, phase: 0 });
      box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Idle dieses Teils'),
        field('Bewegung', sel(id.type || 'none', Puppet.IDLE, (v) => { id.type = v; if (v === 'breathe' && !(Number(id.amp) > 0)) id.amp = 3; })),
        id.type && id.type !== 'none' ? el('div', { class: 'grid2' },
          field(id.type === 'sway' || id.type === 'jiggle' ? 'Stärke °' : id.type === 'bob' ? 'Weite px' : 'Stärke %', num(id.amp, (v) => { id.amp = v; }, 0.5)),
          field('Dauer s', num(id.speed, (v) => { id.speed = Math.max(0.2, v); }, 0.1)),
          field('Versatz °', num(id.phase, (v) => { id.phase = v; }, 15))) : null,
        el('div', { class: 'muted small' }, 'Jiggle schwingt nach, wenn sich das Eltern-Teil bewegt (Haare, Ohren, Schwanz). Unterschiedlicher Versatz bei mehreren Teilen wirkt lebendiger.')));
      box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Bones dieses Teils'),
        rigged ? el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: p.bones !== false, onchange: (e) => VN.mutate(() => { p.bones = e.target.checked; }) }), 'Bones benutzen (Verformen, Atmen, Physik aus dem Bones-Editor)') : el('div', { class: 'muted small' }, 'Dieses Teil hat noch keine Bones. Mit Bones lässt es sich zusätzlich verformen – z. B. Haare, Schwanz, Umhang mit Physik.'),
        el('button', { class: 'btn tiny', onclick: () => { if (window.App && App.openBones) App.openBones(p.asset); } }, rigged ? '🦴 Bones bearbeiten' : '🦴 Bones einrichten')));
      box.appendChild(el('div', { class: 'row gap8' },
        el('button', { class: 'btn tiny', onclick: () => VN.mutate(() => { const c = JSON.parse(JSON.stringify(p)); c.id = VN.uid('pp'); c.name = p.name + ' 2'; c.x += 20; c.y += 20; pup.parts.splice(pup.parts.indexOf(p) + 1, 0, c); ui().pupPart = c.id; }) }, 'Duplizieren'),
        el('button', { class: 'btn tiny', title: VN.t('Spiegelt das Teil und seine Kinder an der Mitte der Puppe – z. B. linken Arm als rechten Arm anlegen'), onclick: () => PupEd.mirrorCopy(pup, p) }, '⇋ Gespiegelt kopieren'),
        el('button', { class: 'btn tiny danger', onclick: () => PupEd.removePart(pup, p) }, 'Teil löschen')));
    } else box.appendChild(el('div', { class: 'hint-box' }, 'Teil auf der Fläche anklicken. Der rote Punkt ist sein Gelenk-Pin: auf das Gelenk ziehen und über dem Teil loslassen, an dem es hängen soll.'));

    box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Gelenke'),
      el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: Puppet.fixed(pup), onchange: (e) => VN.mutate(() => { if (e.target.checked) delete pup.freeJoints; else pup.freeJoints = true; }) }), 'Gelenke fest verankern'),
      el('div', { class: 'muted small' }, Puppet.fixed(pup)
        ? 'Angehängte Teile bleiben immer an ihrem Gelenk: Sie drehen sich, rutschen aber nie weg – auch nicht beim Animieren oder Wippen.'
        : 'Frei: Angehängte Teile dürfen sich auch verschieben (z. B. für Cartoon-Effekte). Gelenke können sich dabei lösen.')));
    box.appendChild(el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, 'Verwenden'),
      el('div', { class: 'muted small' }, 'Timeline: Figuren-Clip → „Art der Figur“ → diese Gliederpuppe. Animieren: Reiter „Animation“ → Darsteller → „🦴 Gliederpuppe“.'),
      el('button', { class: 'btn tiny', onclick: () => PupEd.newAnim(pup, 'idle') }, '∞ Idle-Animation für diese Puppe'),
      el('button', { class: 'btn tiny', onclick: () => PupEd.newAnim(pup, 'gesture') }, '✋ Geste für diese Puppe')));
    box.appendChild(el('button', { class: 'btn danger', onclick: () => VN.mutate(() => { VN.project.puppets = list().filter((x) => x !== pup); ui().pupSel = null; }) }, 'Gliederpuppe löschen'));
    return box;
  };

  // ---------- Radierer (0.7.8) ----------
  // Malt auf einer Kopie des Teil-Bildes. Speichern legt eine neue PNG-Datei an (das Original bleibt erhalten und
  // lässt sich jederzeit zurückholen). Bones und Blinzeln werden auf das neue Bild übernommen.
  PupEd.toggleErase = (pup) => {
    if (ui().pupErase && ui().pupErase.mode !== 'inpaint') {
      if (PupEd._edit && PupEd._edit.dirty && !window.confirm(VN.t('Ungespeicherte Radierer-Änderungen verwerfen?'))) return;
      ui().pupErase = null; PupEd._edit = null;
    } else { ui().pupErase = { size: 40, soft: 60, mode: 'erase' }; ui().pupTest = null; ui().pupRuler = false; }
    VN.render();
  };
  const loadImg = (url) => new Promise((res) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
  PupEd.startEdit = async (pup, p) => {
    if (PupEd._edit && PupEd._edit.pid === p.id) return PupEd._edit;
    if (PupEd._edit && PupEd._edit.dirty) await PupEd.saveEdit(pup);
    const ed = PupEd._edit = { pid: p.id, cv: null, orig: null, dirty: false };
    const cur = await loadImg(VN.assetUrl(p.asset));
    const orig = p.origAsset ? await loadImg(VN.assetUrl(p.origAsset)) : cur;
    if (!cur || PupEd._edit !== ed) return null;
    const nw = cur.naturalWidth || p.w, nh = cur.naturalHeight || p.h;
    const k = Math.min(2048 / Math.max(nw, nh), Math.max(1, p.w / nw));
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(nw * k)); cv.height = Math.max(1, Math.round(nh * k));
    cv.getContext('2d').drawImage(cur, 0, 0, cv.width, cv.height);
    ed.cv = cv; ed.orig = orig;
    return ed;
  };
  const stamp = (ed, x, y, r, soft, mode) => {
    const c = ed.cv.getContext('2d');
    const inner = Math.max(0, r * (1 - soft / 100));
    const g = c.createRadialGradient(x, y, inner, x, y, Math.max(inner + 0.01, r));
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    if (mode === 'restore') {
      if (!ed.orig) return;
      // Original durch die Pinselspitze zurückmalen
      const s = Math.ceil(r * 2) + 2;
      const t = ed.tmp || (ed.tmp = document.createElement('canvas'));
      if (t.width < s || t.height < s) { t.width = s; t.height = s; }
      const tc = t.getContext('2d');
      tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, t.width, t.height);
      const gx = tc.createRadialGradient(s / 2, s / 2, inner, s / 2, s / 2, Math.max(inner + 0.01, r));
      gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(1, 'rgba(0,0,0,0)');
      tc.fillStyle = gx; tc.fillRect(0, 0, s, s);
      tc.globalCompositeOperation = 'source-in';
      tc.drawImage(ed.orig, -(x - s / 2), -(y - s / 2), ed.cv.width, ed.cv.height);
      c.globalCompositeOperation = 'source-over';
      c.drawImage(t, 0, 0, s, s, x - s / 2, y - s / 2, s, s);
    } else {
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
  };
  PupEd.eraseDown = async (e, pup, canvas, toPup, view, mats, hitPart) => {
    const [x0, y0] = toPup(e.clientX, e.clientY);
    let p = selPart(pup);
    if (!p) { p = hitPart(x0, y0); if (!p) return; ui().pupPart = p.id; VN.render(); }
    const ed = await PupEd.startEdit(pup, p);
    if (!ed || !ed.cv) return;
    const E = ui().pupErase;
    // Bildschirm → Pixel des Bearbeitungs-Bildes
    const toImg = (cx, cy) => {
      const [px, py] = toPup(cx, cy);
      let [u, v] = Puppet.m.ap(Puppet.m.inv(mats()[p.id]), px, py);
      if (p.flipX) u = p.w - u;
      return [u * ed.cv.width / p.w, v * ed.cv.height / p.h];
    };
    // Pinselgröße ist in Bildschirm-Pixeln eingestellt
    const radius = () => E.size / 2 / view().k * ed.cv.width / p.w;
    let last = toImg(e.clientX, e.clientY);
    stamp(ed, last[0], last[1], radius(), E.soft, E.mode);
    ed.dirty = true;
    const move = (ev) => {
      const cur = toImg(ev.clientX, ev.clientY);
      const r = radius(), d = Math.hypot(cur[0] - last[0], cur[1] - last[1]), step = Math.max(1, r / 4);
      for (let s = step; s <= d; s += step) stamp(ed, last[0] + (cur[0] - last[0]) * s / d, last[1] + (cur[1] - last[1]) * s / d, r, E.soft, E.mode);
      if (d >= step) last = cur;
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); VN.render(); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  PupEd.saveEdit = async (pup) => {
    const ed = PupEd._edit;
    if (!ed || !ed.dirty || !ed.cv) return;
    const p = Puppet.part(pup, ed.pid);
    if (!p) return;
    const blob = await new Promise((res) => ed.cv.toBlob(res, 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const src = VN.asset(p.origAsset || p.asset) || { name: p.name };
    const safe = String(src.name || 'teil').replace(/[^\wäöüÄÖÜß -]/g, '').trim().replace(/\s+/g, '_') || 'teil';
    const rel = await VN.api.writeAsset(VN.dir, 'assets/' + safe + '_retusche.png', bytes);
    if (!rel || typeof rel !== 'string') { VN.toast(VN.t('Speichern ging nicht')); return; }
    const old = p.asset;
    VN.mutate(() => {
      const a = { id: VN.uid('a'), name: (src.name || p.name) + ' ' + VN.t('(retuschiert)'), kind: 'image', file: rel };
      VN.project.assets.push(a);
      // Bones und Blinzeln vom bisherigen Bild übernehmen
      if (VN.project.rigs[old]) VN.project.rigs[a.id] = JSON.parse(JSON.stringify(VN.project.rigs[old]));
      if (VN.project.blinks && VN.project.blinks[old]) VN.project.blinks[a.id] = JSON.parse(JSON.stringify(VN.project.blinks[old]));
      if (!p.origAsset) p.origAsset = old;
      p.asset = a.id;
    });
    PupEd._edit = null;
    VN.toast(VN.t('Retusche gespeichert – das Original bleibt erhalten'));
  };
  PupEd.eraseCard = (pup) => {
    const E = ui().pupErase;
    const p = selPart(pup);
    const ed = PupEd._edit && p && PupEd._edit.pid === p.id ? PupEd._edit : null;
    const slider = (id, label, key, min, max, unit) => {
      const lab = el('span', { class: 'muted small' }, E[key] + unit);
      return el('div', { class: 'field' }, el('div', { class: 'lbl' }, label, ' ', lab),
        el('div', { class: 'rng-row' }, el('input', { type: 'range', id, min, max, value: E[key], oninput: (e) => { E[key] = Number(e.target.value); lab.textContent = E[key] + unit; } })));
    };
    return el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, '🧽 Radierer' + (p ? ' · ' + p.name : '')),
      p ? null : el('div', { class: 'hint-box' }, VN.t('Teil auf der Fläche anklicken, dann über die Kante malen.')),
      el('div', { class: 'seg' }, ...[['erase', 'Radieren'], ['restore', 'Wiederherstellen']].map(([k, l]) => el('button', { class: E.mode === k ? 'active' : '', onclick: () => { E.mode = k; VN.render(); } }, VN.t(l)))),
      slider('pup-er-size', VN.t('Größe'), 'size', 2, 300, ' px'),
      slider('pup-er-soft', VN.t('Kantenweichheit'), 'soft', 0, 100, ' %'),
      el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
        el('button', { class: 'btn tiny primary', disabled: !(ed && ed.dirty), onclick: () => PupEd.saveEdit(pup) }, '💾 ' + VN.t('Speichern')),
        el('button', { class: 'btn tiny', disabled: !(ed && ed.dirty), onclick: () => { PupEd._edit = null; VN.render(); } }, VN.t('Verwerfen')),
        p && p.origAsset ? el('button', { class: 'btn tiny', title: VN.t('Zum unbearbeiteten Bild zurück'), onclick: () => { PupEd._edit = null; VN.mutate(() => { p.asset = p.origAsset; delete p.origAsset; }); } }, '↺ ' + VN.t('Original')) : null),
      el('div', { class: 'muted small' }, VN.t('Weiche Kante = sanfter Übergang (gut für Gelenke, an denen zwei Teile überlappen). Wiederherstellen malt das Original zurück. Gespeichert wird als neue Bilddatei – das Original bleibt erhalten.')));
  };

  // ---------- Inpaint-Stift (0.9.15) ----------
  // Füllt Lücken an einem Teil ohne KI-Modell: Maske per Lasso, Lineal oder Pinsel, Farben vom Maskenrand, aus einer
  // gewählten Farbe oder als Verlauf zwischen zwei Punkten. Nutzt dieselbe Bearbeitungs-Kopie wie der Radierer.
  const FILL_UNDO = 6;
  const hasRigData = (p) => !!((window.Rig && Rig.has(p.asset)) || (VN.project.blinks && VN.project.blinks[p.asset]));
  PupEd.toggleInpaint = (pup) => {
    const E = ui().pupErase;
    if (E && E.mode === 'inpaint') {
      if (PupEd._edit && PupEd._edit.dirty && !window.confirm(VN.t('Ungespeicherte Änderungen am Bild verwerfen?'))) return;
      ui().pupErase = null; PupEd._edit = null;
    } else {
      ui().pupErase = { mode: 'inpaint', tool: 'lasso', size: 40, soft: 50, source: 'auto', color: [200, 160, 130], a: null, b: null, pick: null, pid: null };
      ui().pupTest = null; ui().pupRuler = false; ui().pupSew = false; ui().pupHold = false;
    }
    VN.render();
  };
  const fillMask = (ed) => {
    if (!ed.mask || ed.mask.width !== ed.cv.width || ed.mask.height !== ed.cv.height) {
      ed.mask = document.createElement('canvas'); ed.mask.width = ed.cv.width; ed.mask.height = ed.cv.height; ed.hasMask = false;
    }
    return ed.mask;
  };
  const maskCtx = (ed, sub) => {
    const c = fillMask(ed).getContext('2d', { willReadFrequently: true });
    c.globalCompositeOperation = sub ? 'destination-out' : 'source-over';
    c.fillStyle = c.strokeStyle = '#ff3c64';
    return c;
  };
  const maskPoly = (ed, pts, sub) => {
    if (!pts || pts.length < 3) return false;
    const c = maskCtx(ed, sub);
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill();
    c.globalCompositeOperation = 'source-over';
    if (!sub) { ed.hasMask = true; ed.last = null; }
    return true;
  };
  // Durchschnittsfarbe rund um eine Bildstelle; durchsichtige Stellen zählen nicht
  const sampleImg = (src, sw, sh, x, y) => {
    try {
      const c = document.createElement('canvas'); c.width = 7; c.height = 7;
      const k = c.getContext('2d', { willReadFrequently: true });
      k.drawImage(src, -(x - 3.5), -(y - 3.5), sw, sh);
      const d = k.getImageData(0, 0, 7, 7).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 127) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : null;
    } catch (e) { return null; }
  };
  const fillOpts = (E) => ({ mode: E.source === 'color' ? 'color' : E.source === 'grad' ? 'grad' : 'auto', color: E.color, a: E.a, b: E.b, soft: E.soft });
  const fillApply = (ed, mask, E) => {
    const c = ed.cv.getContext('2d', { willReadFrequently: true });
    const img = c.getImageData(0, 0, ed.cv.width, ed.cv.height);
    const res = Inpaint.run(img, mask, fillOpts(E));
    if (res.ok) c.putImageData(img, 0, 0);
    return res;
  };
  // Maske füllen. Die Maske bleibt gemerkt, damit Weichheit und Farbquelle das Ergebnis danach noch ändern können.
  PupEd.fillRun = (pup) => {
    const E = ui().pupErase, ed = PupEd._edit;
    if (!E || !ed || !ed.cv || !ed.hasMask) { VN.toast(VN.t('Erst die Lücke maskieren')); return false; }
    const W = ed.cv.width, H = ed.cv.height;
    const md = fillMask(ed).getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const mask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) mask[i] = md[i * 4 + 3];
    const before = ed.cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H);
    const res = fillApply(ed, mask, E);
    if (!res.ok) {
      VN.toast(VN.t(res.reason === 'empty' ? 'Erst die Lücke maskieren' : E.source === 'grad' ? 'Erst Punkt A und B auf dem Bild setzen' : 'Am Rand der Maske gibt es keine Farben – Maske etwas über das Bild ziehen oder eine Farbe wählen'));
      return false;
    }
    ed.undo = ed.undo || []; ed.undo.push(before); if (ed.undo.length > FILL_UNDO) ed.undo.shift();
    ed.last = { mask }; ed.dirty = true; ed.hasMask = false;
    fillMask(ed).getContext('2d').clearRect(0, 0, W, H);
    VN.render();
    return true;
  };
  // Nach dem Füllen: Weichheit oder Farbquelle geändert → aus dem Stand davor neu füllen
  PupEd.fillRedo = () => {
    const E = ui().pupErase, ed = PupEd._edit;
    if (!E || !ed || !ed.last || !ed.undo || !ed.undo.length) return;
    const c = ed.cv.getContext('2d', { willReadFrequently: true });
    const now = c.getImageData(0, 0, ed.cv.width, ed.cv.height);
    c.putImageData(ed.undo[ed.undo.length - 1], 0, 0);
    if (!fillApply(ed, ed.last.mask, E).ok) c.putImageData(now, 0, 0);
  };
  PupEd.fillUndo = () => {
    const ed = PupEd._edit;
    if (!ed || !ed.undo || !ed.undo.length) return;
    ed.cv.getContext('2d', { willReadFrequently: true }).putImageData(ed.undo.pop(), 0, 0);
    ed.last = null; ed.dirty = ed.undo.length > 0;
    VN.render();
  };
  PupEd.fillClear = () => {
    const ed = PupEd._edit;
    if (!ed) return;
    if (ed.mask) ed.mask.getContext('2d').clearRect(0, 0, ed.mask.width, ed.mask.height);
    ed.hasMask = false; ed.poly = null;
    VN.render();
  };
  const fillClose = (sub) => {
    const ed = PupEd._edit;
    if (ed && ed.poly && maskPoly(ed, ed.poly, sub)) { ed.poly = null; VN.render(); return true; }
    return false;
  };
  PupEd.fillKey = (e, pup) => {
    const ed = PupEd._edit, E = ui().pupErase;
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { stop(); PupEd.fillUndo(); return; }
    if (e.key === 'Enter') { stop(); if (!fillClose(e.altKey)) PupEd.fillRun(pup); return; }
    if (e.key === 'Escape') { stop(); if (E.pick) { E.pick = null; VN.render(); } else if (ed && ed.poly) { ed.poly = null; VN.render(); } else PupEd.fillClear(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { stop(); if (ed && ed.poly && ed.poly.length > 1) ed.poly.pop(); else PupEd.fillClear(); }
  };
  PupEd.fillDown = async (e, pup, toPup, view, mats, hitPart) => {
    const E = ui().pupErase, [x0, y0] = toPup(e.clientX, e.clientY);
    const sub = e.altKey;
    let p = selPart(pup);
    if (!p) { p = hitPart(x0, y0); if (!p) { VN.toast(VN.t('Erst ein Teil anklicken')); return; } ui().pupPart = p.id; VN.render(); }
    if (!p.asset) { VN.toast(VN.t('Dieser Platz hat noch kein Bild')); return; }
    let released = false;
    const earlyUp = () => { released = true; };
    window.addEventListener('mouseup', earlyUp);
    const ed = await PupEd.startEdit(pup, p);
    window.removeEventListener('mouseup', earlyUp);
    if (!ed || !ed.cv) return;
    if (E.pid !== p.id) { E.pid = p.id; E.a = E.b = null; }
    fillMask(ed);
    const toImg = (cx, cy) => {
      const [px, py] = toPup(cx, cy);
      let [u, v] = M().ap(M().inv(mats()[p.id]), px, py);
      if (p.flipX) u = p.w - u;
      return [u * ed.cv.width / p.w, v * ed.cv.height / p.h];
    };
    // Farbe wählen: auch von einem anderen Teil unter dem Mauszeiger
    if (E.pick) {
      const [ix, iy] = toImg(e.clientX, e.clientY);
      let c = sampleImg(ed.cv, ed.cv.width, ed.cv.height, ix, iy);
      if (!c) {
        const other = hitPart(x0, y0), src = other && PupEd._res && PupEd._res.imgs[other.id];
        if (src) {
          let [u, v] = M().ap(M().inv(mats()[other.id]), x0, y0);
          if (other.flipX) u = other.w - u;
          const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
          c = sampleImg(src, sw, sh, u * sw / other.w, v * sh / other.h);
        }
      }
      if (!c) { VN.toast(VN.t('Dort ist keine Farbe – auf eine sichtbare Stelle klicken')); return; }
      if (E.pick === 'color') { E.color = c; E.source = 'color'; }
      else { E[E.pick] = { x: ix, y: iy, c }; E.source = 'grad'; }
      E.pick = null;
      PupEd.fillRedo();
      VN.render();
      return;
    }
    if (E.tool === 'line') {
      const pt = toImg(e.clientX, e.clientY), k = view().k * p.w / ed.cv.width, now = performance.now();
      const poly = ed.poly || (ed.poly = []);
      const first = poly[0], lastPt = poly[poly.length - 1];
      if (poly.length >= 3 && (Math.hypot(pt[0] - first[0], pt[1] - first[1]) * k < 9 || (now - (ed.polyT || 0) < 350 && Math.hypot(pt[0] - lastPt[0], pt[1] - lastPt[1]) * k < 6))) { fillClose(sub); return; }
      ed.polyT = now; poly.push(pt);
      return;
    }
    if (released) return;
    if (E.tool === 'brush') {
      const radius = () => E.size / 2 / view().k * ed.cv.width / p.w;
      const c = maskCtx(ed, sub);
      c.lineCap = c.lineJoin = 'round';
      let last = toImg(e.clientX, e.clientY);
      const dot = (a, b) => { c.lineWidth = radius() * 2; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0] + 0.01, b[1]); c.stroke(); };
      dot(last, last);
      const move = (ev) => { const q = toImg(ev.clientX, ev.clientY); dot(last, q); last = q; };
      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); c.globalCompositeOperation = 'source-over'; if (!sub) { ed.hasMask = true; ed.last = null; } VN.render(); };
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
      return;
    }
    // Lasso
    ed.poly = [toImg(e.clientX, e.clientY)];
    const move = (ev) => { const q = toImg(ev.clientX, ev.clientY), L = ed.poly[ed.poly.length - 1]; if (Math.hypot(q[0] - L[0], q[1] - L[1]) > 1) ed.poly.push(q); };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); if (!fillClose(sub)) { ed.poly = null; VN.render(); } };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  // Maske, Linie und die Punkte A/B über dem Teil zeichnen
  PupEd.fillOverlay = (ctx, pup, ms) => {
    const E = ui().pupErase, ed = PupEd._edit, p = selPart(pup);
    if (!ed || !ed.cv || !p || ed.pid !== p.id || !ms[p.id]) return;
    const m = ms[p.id], W = ed.cv.width, H = ed.cv.height;
    const scr = (x, y) => M().ap(m, p.flipX ? p.w - x * p.w / W : x * p.w / W, y * p.h / H);
    if (ed.mask && ed.hasMask) {
      ctx.save(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      if (p.flipX) { ctx.translate(p.w, 0); ctx.scale(-1, 1); }
      ctx.globalAlpha = 0.5; ctx.drawImage(ed.mask, 0, 0, p.w, p.h); ctx.restore();
    }
    if (ed.poly && ed.poly.length) {
      ctx.lineWidth = 2; ctx.strokeStyle = '#ff3c64'; ctx.setLineDash([]);
      ctx.beginPath(); ed.poly.forEach(([x, y], i) => { const [a, b] = scr(x, y); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); });
      if (E.tool === 'line' && PupEd._mouse) ctx.lineTo(PupEd._mouse[0], PupEd._mouse[1]);
      ctx.stroke();
      if (E.tool === 'line') {
        ctx.fillStyle = '#fff';
        ed.poly.forEach(([x, y]) => { const [a, b] = scr(x, y); ctx.beginPath(); ctx.arc(a, b, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
      }
    }
    if (E.source === 'grad' && E.pid === p.id) {
      const pts = [['A', E.a], ['B', E.b]].filter(([, q]) => q);
      if (pts.length === 2) { const [a1, b1] = scr(E.a.x, E.a.y), [a2, b2] = scr(E.b.x, E.b.y); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke(); ctx.setLineDash([]); }
      for (const [name, q] of pts) {
        const [a, b] = scr(q.x, q.y);
        ctx.fillStyle = `rgb(${q.c.join(',')})`; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(a, b, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.font = 'bold 11px Segoe UI, sans-serif'; ctx.textAlign = 'center';
        ctx.strokeText(name, a, b - 12); ctx.fillText(name, a, b - 12);
      }
    }
  };
  // Mehr Platz um ein Teil: Liegt die Lücke außerhalb des Bildes (eng zugeschnittene Teile), bekommt es einen
  // durchsichtigen Rand. Das Teil bleibt an seiner Stelle, Gelenk, Nähte und Haftpunkte wandern mit.
  PupEd.growPart = async (pup, p, pad = 40) => {
    if (hasRigData(p)) { VN.toast(VN.t('Dieses Teil hat Bones – mehr Platz würde sie verschieben')); return false; }
    if (PupEd._edit && PupEd._edit.pid === p.id && PupEd._edit.dirty) await PupEd.saveEdit(pup);
    const padded = async (id) => {
      const im = await loadImg(VN.assetUrl(id));
      if (!im) return null;
      const nw = im.naturalWidth || p.w, nh = im.naturalHeight || p.h;
      const c = document.createElement('canvas');
      const px = Math.round(pad * nw / p.w), py = Math.round(pad * nh / p.h);
      c.width = nw + px * 2; c.height = nh + py * 2;
      c.getContext('2d').drawImage(im, px, py, nw, nh);
      const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
      const src = VN.asset(id) || { name: p.name };
      const safe = String(src.name || 'teil').replace(/[^\wäöüÄÖÜß -]/g, '').trim().replace(/\s+/g, '_') || 'teil';
      const rel = await VN.api.writeAsset(VN.dir, 'assets/' + safe + '_rand.png', new Uint8Array(await blob.arrayBuffer()));
      return rel && typeof rel === 'string' ? { id: VN.uid('a'), name: src.name || p.name, kind: 'image', file: rel } : null;
    };
    const cur = await padded(p.asset), orig = p.origAsset ? await padded(p.origAsset) : null;
    if (!cur || (p.origAsset && !orig)) { VN.toast(VN.t('Speichern ging nicht')); return false; }
    PupEd._edit = null;
    const E = ui().pupErase; if (E) { E.a = E.b = null; }
    VN.mutate(() => {
      VN.project.assets.push(cur); if (orig) VN.project.assets.push(orig);
      p.asset = cur.id; if (orig) p.origAsset = orig.id;
      p.w += pad * 2; p.h += pad * 2; p.x -= pad; p.y -= pad; p.ax += pad; p.ay += pad;
      if (p.tx != null) { p.tx += pad; p.ty += pad; }
      for (const hp of p.holdPts || []) { hp.u += pad; hp.v += pad; }
      for (const s of p.seams || []) s.pts = s.pts.map(([u, v]) => [u + pad, v + pad]);
    });
    return true;
  };
  PupEd.fillCard = (pup) => {
    const E = ui().pupErase, p = selPart(pup);
    const ed = PupEd._edit && p && PupEd._edit.pid === p.id ? PupEd._edit : null;
    const swatch = (c) => el('span', { class: 'mini-thumb', style: { background: c ? `rgb(${c.join(',')})` : 'transparent', border: '1px solid rgba(255,255,255,0.35)' } });
    const pickBtn = (key, label) => el('button', { class: 'btn tiny' + (E.pick === key ? ' primary' : ''), onclick: () => { E.pick = E.pick === key ? null : key; VN.render(); } }, label);
    const rigged = p && hasRigData(p);
    const lab = el('span', { class: 'muted small' }, E.soft + ' %');
    return el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, '🖌 Inpaint-Stift' + (p ? ' · ' + p.name : '')),
      p ? null : el('div', { class: 'hint-box' }, VN.t('Teil auf der Fläche anklicken, dann die Lücke maskieren.')),
      el('div', { class: 'lbl' }, VN.t('Maske')),
      el('div', { class: 'seg' }, ...[['lasso', 'Lasso'], ['line', 'Lineal'], ['brush', 'Pinsel']].map(([k, l]) => el('button', { class: E.tool === k ? 'active' : '', onclick: () => { E.tool = k; E.pick = null; if (PupEd._edit) PupEd._edit.poly = null; VN.render(); } }, VN.t(l)))),
      E.tool === 'brush' ? el('div', { class: 'field' }, el('div', { class: 'lbl' }, VN.t('Größe')), el('div', { class: 'rng-row' }, el('input', { type: 'range', id: 'pup-er-size', min: 2, max: 300, value: E.size, oninput: (e) => { E.size = Number(e.target.value); } }))) : null,
      el('div', { class: 'lbl' }, VN.t('Farben')),
      el('div', { class: 'seg' }, ...[['auto', 'Vom Rand'], ['color', 'Eine Farbe'], ['grad', 'Verlauf A → B']].map(([k, l]) => el('button', { class: E.source === k ? 'active' : '', onclick: () => { E.source = k; PupEd.fillRedo(); VN.render(); } }, VN.t(l)))),
      E.source === 'color' ? el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } }, swatch(E.color), pickBtn('color', '💧 ' + VN.t('Farbe vom Bild')),
        el('input', { type: 'color', title: VN.t('Farbe frei wählen'), value: '#' + E.color.map((n) => n.toString(16).padStart(2, '0')).join(''), onchange: (e) => { const v = e.target.value; E.color = [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)); PupEd.fillRedo(); VN.render(); } })) : null,
      E.source === 'grad' ? el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } }, swatch(E.a && E.a.c), pickBtn('a', VN.t('Punkt A setzen')), swatch(E.b && E.b.c), pickBtn('b', VN.t('Punkt B setzen'))) : null,
      E.pick ? el('div', { class: 'hint-box' }, VN.t('Jetzt auf die Stelle klicken, deren Farbe du möchtest.')) : null,
      el('div', { class: 'field' }, el('div', { class: 'lbl' }, VN.t('Weichheit'), ' ', lab),
        el('div', { class: 'rng-row' }, el('input', { type: 'range', id: 'pup-fill-soft', min: 0, max: 100, value: E.soft, oninput: (e) => { E.soft = Number(e.target.value); lab.textContent = E.soft + ' %'; }, onchange: () => PupEd.fillRedo() }))),
      el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
        el('button', { class: 'btn tiny primary', disabled: !(ed && ed.hasMask), onclick: () => PupEd.fillRun(pup) }, '🖌 ' + VN.t('Füllen')),
        el('button', { class: 'btn tiny', disabled: !(ed && ed.hasMask), onclick: PupEd.fillClear }, VN.t('Maske löschen')),
        el('button', { class: 'btn tiny', disabled: !(ed && ed.undo && ed.undo.length), onclick: PupEd.fillUndo }, '↶ ' + VN.t('Rückgängig'))),
      el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
        el('button', { class: 'btn tiny primary', disabled: !(ed && ed.dirty), onclick: () => PupEd.saveEdit(pup) }, '💾 ' + VN.t('Speichern')),
        el('button', { class: 'btn tiny', disabled: !(ed && ed.dirty), onclick: () => { PupEd._edit = null; VN.render(); } }, VN.t('Verwerfen')),
        p && p.origAsset ? el('button', { class: 'btn tiny', title: VN.t('Zum unbearbeiteten Bild zurück'), onclick: () => { PupEd._edit = null; VN.mutate(() => { p.asset = p.origAsset; delete p.origAsset; }); } }, '↺ ' + VN.t('Original')) : null),
      p && p.asset ? el('button', { class: 'btn tiny', disabled: !!rigged, title: VN.t(rigged ? 'Dieses Teil hat Bones – mehr Platz würde sie verschieben' : 'Durchsichtigen Rand um das Bild legen, falls die Lücke außerhalb liegt. Das Teil bleibt an seiner Stelle.'), onclick: () => PupEd.growPart(pup, p) }, '⬚ ' + VN.t('Mehr Platz am Rand')) : null,
      el('div', { class: 'muted small' }, VN.t('Vom Rand: Die Farben am Maskenrand laufen weich ineinander – am besten die Maske etwas über das vorhandene Bild ziehen. Weichheit blendet die Füllung über dem vorhandenen Bild ein. Gespeichert wird als neue Bilddatei – das Original bleibt erhalten.')));
  };

  // Teil samt Kindern gespiegelt kopieren (links ↔ rechts)
  PupEd.mirrorCopy = (pup, p) => VN.mutate(() => {
    const bb = Puppet.bounds(pup);
    const cx = bb.x + bb.w / 2;
    const ids = [p.id, ...Puppet.descendants(pup, p.id)];
    const map = {};
    const flipName = (n) => n.replace(/\b(links|Links|L)\b/, '§R').replace(/\b(rechts|Rechts|R)\b/, '§L').replace('§R', /links/i.test(n) ? 'rechts' : 'R').replace('§L', /rechts/i.test(n) ? 'links' : 'L');
    for (const id of ids) {
      const o = Puppet.part(pup, id);
      const c = JSON.parse(JSON.stringify(o));
      c.id = VN.uid('pp'); map[id] = c.id;
      c.name = flipName(o.name) === o.name ? o.name + ' (gespiegelt)' : flipName(o.name);
      c.flipX = !o.flipX;
      // Pin bleibt am gespiegelten Gelenk
      const pinX = 2 * cx - (o.x + o.ax);
      c.ax = o.w - o.ax; c.x = Math.round(pinX - c.ax); c.rot = -(o.rot || 0);
      pup.parts.push(c);
    }
    for (const id of ids) { const c = Puppet.part(pup, map[id]); const o = Puppet.part(pup, id); c.parent = map[o.parent] || o.parent || null; }
    ui().pupPart = map[p.id];
  });

  PupEd.newAnim = (pup, type) => {
    VN.mutate(() => {
      const a = { id: VN.uid('an'), name: (type === 'idle' ? 'Idle · ' : 'Geste · ') + pup.name, type, dur: type === 'idle' ? 3 : 1.5, loop: type === 'idle', cam: [], audio: [], actors: [{ id: VN.uid('ac'), puppet: pup.id, asset: null, x: 50, y: 0, scale: 100, flip: false, bones: {}, parts: {}, move: [] }] };
      VN.project.anims.push(a);
      ui().animSel = a.id; ui().animActor = a.actors[0].id; ui().animT = 0; ui().animKey = null; ui().view = 'anim';
    });
  };
})();
