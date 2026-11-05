// Smear-Bilder (0.9.9): bei sehr schnellen Bewegungen wie im Zeichentrick
//   Mehrfachbilder – das schnelle Körperteil erscheint zwei-, dreimal zwischen alter und neuer Position
//   Ziehen         – das Teil wird für ein Bild zur Bewegungsrichtung hin lang gezogen
//   Speedlines     – Bewegungslinien hinter dem schnellen Teil
// Erkennt schnelle Teile über Bones (Knochenspitzen) bzw. die Teile einer Gliederpuppe.
// Auf der Bühne liegt das Smear-Bild auf einer eigenen Leinwand direkt hinter der Figur,
// in Zwischensequenzen wird es direkt hinter die Figur in deren Leinwand gezeichnet.
(function () {
  const DEF = { on: true, multi: true, stretch: false, lines: true, sens: 50 };
  let tmp = null, layer = null;
  const tmpCv = (w, h) => { if (!tmp) tmp = document.createElement('canvas'); if (tmp.width !== w || tmp.height !== h) { tmp.width = w; tmp.height = h; } return tmp; };

  const Smear = (window.Smear = {
    DEF,
    // Einstellung: eigene ({ on: … }) oder die des Projekts; null = aus
    cfgFor(own) {
      const c = own && own.on != null ? own : (VN.project && VN.project.smear) || null;
      return c && c.on ? Object.assign({}, DEF, c) : null;
    },
    figCfg(clip) {
      if (clip && clip.smear && clip.smear.on != null) return Smear.cfgFor(clip.smear);
      const a = clip && clip.idleAnim && window.Anim ? Anim.get(clip.idleAnim) : null;
      return Smear.cfgFor(a && a.smear);
    },
    // Ab welchem Tempo (Figurenhöhen pro Sekunde)
    thr(cfg, forced) { return forced ? 0.2 : 4.4 - 3.8 * (Math.max(0, Math.min(100, cfg.sens)) / 100); },
    // Von Hand markierte Smear-Bilder einer Animation im Zeitfenster (t0, t1]
    marked(anim, t0, t1) {
      const L = (anim && anim.smearAt) || [];
      if (!L.length || !(t1 >= t0)) return false;
      const d = Math.max(0.1, anim.dur || 1);
      if (t1 - t0 >= d) return true;
      const a = ((t0 % d) + d) % d, b = ((t1 % d) + d) % d;
      return L.some((x) => (a <= b ? x > a && x <= b : x > a || x <= b));
    },

    // Schnelle Punkte seit dem letzten Bild. pts: [[id, x, y, r]], H: Figurenhöhe in Pixeln
    fast(st, pts, now, H, cfg, forced) {
      if (st.t != null && now < st.t) st.prev = null;
      const prev = st.prev || {}, dtF = st.t != null ? Math.max(1 / 120, now - st.t) : 0;
      if (typeof forced === 'function') forced = cfg ? forced(dtF) : false;
      const out = [];
      if (dtF && dtF < 0.5) {
        for (const [id, x, y, r] of pts) {
          const p = prev[id];
          if (!p) continue;
          const d = Math.hypot(x - p[0], y - p[1]);
          if (d / H / dtF > Smear.thr(cfg, forced) && d > r * 0.3) out.push({ x, y, px: p[0], py: p[1], r, d });
        }
      }
      st.prev = {};
      for (const [id, x, y] of pts) st.prev[id] = [x, y];
      st.dtF = dtF; st.t = now;
      // Überlappende Punkte zusammenfassen: von nahe beieinander liegenden nur den schnellsten
      out.sort((a, b) => b.d - a.d);
      const keep = [];
      for (const f of out) if (!keep.some((k) => Math.hypot(k.x - f.x, k.y - f.y) < Math.max(k.r, f.r) * 0.7)) keep.push(f);
      return keep.slice(0, 6);
    },

    // Smear-Bild zeichnen: g = Ziel, src = Bild der Figur (gleiches Koordinatensystem)
    paint(g, src, list, cfg) {
      for (const f of list) {
        const vx = f.px - f.x, vy = f.py - f.y, L = Math.hypot(vx, vy) || 1, ux = vx / L, uy = vy / L;
        const part = (k, rad, alpha) => {
          g.save();
          g.beginPath(); g.arc(f.x + vx * k, f.y + vy * k, Math.max(2, rad), 0, Math.PI * 2); g.clip();
          g.globalAlpha = alpha;
          g.drawImage(src, vx * k, vy * k);
          g.restore();
        };
        if (cfg.lines) {
          const n = 5, lw = Math.max(1.2, f.r * 0.045);
          g.save(); g.lineCap = 'round';
          for (let j = 0; j < n; j++) {
            const o = (j - (n - 1) / 2) / ((n - 1) / 2) * f.r * 0.75;
            const s0 = f.r * (0.55 + ((j * 37) % 5) * 0.08), len = L * (0.7 + ((j * 53) % 4) * 0.12) + f.r * 0.4;
            const sx = f.x + ux * s0 - uy * o, sy = f.y + uy * s0 + ux * o;
            const gr = g.createLinearGradient(sx, sy, sx + ux * len, sy + uy * len);
            gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.strokeStyle = gr; g.lineWidth = lw * (j === 2 ? 1.4 : 1);
            g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + ux * len, sy + uy * len); g.stroke();
          }
          g.restore();
        }
        if (cfg.stretch) {
          const n = Math.min(64, Math.max(8, Math.ceil(L / (f.r * 0.06))));
          for (let i = n; i >= 1; i--) { const k = i / n; part(k, f.r * (0.95 - 0.5 * k), 1 - 0.5 * k); }
        }
        if (cfg.multi) { part(2 / 3, f.r, 0.5); part(1 / 3, f.r, 0.78); }
      }
    },

    // Bühne: eigene Leinwand direkt hinter der Figuren-Leinwand
    dom(cv, pts, now, H, cfg, forced) {
      const st = cv._sm || (cv._sm = {});
      const list = cfg ? Smear.fast(st, pts, now, H, cfg, forced) : [];
      let u = st.under;
      if (list.length && cv.parentNode) {
        if (!u || u.parentNode !== cv.parentNode) {
          u = document.createElement('canvas');
          cv.parentNode.insertBefore(u, cv.nextSibling);
          st.under = u;
        }
        u.className = cv.className + ' smear-cv';
        u.style.cssText = cv.style.cssText;
        u.style.zIndex = '-1'; u.style.pointerEvents = 'none';
        if (u.width !== cv.width || u.height !== cv.height) { u.width = cv.width; u.height = cv.height; }
        const g = u.getContext('2d');
        g.clearRect(0, 0, u.width, u.height);
        Smear.paint(g, cv, list, cfg);
        u.hidden = false;
        st.until = now + Math.max(0.07, st.dtF || 0);
      } else if (u && !u.hidden && (!cfg || now >= (st.until || 0))) u.hidden = true;
    },

    // Zwischensequenz: in die Leinwand der Figur, hinter das schon Gezeichnete
    inPlace(cv, st, pts, now, H, cfg, forced) {
      const list = Smear.fast(st, pts, now, H, cfg, forced);
      if (!list.length) return;
      const t = tmpCv(cv.width, cv.height), tg = t.getContext('2d');
      tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, t.width, t.height); tg.drawImage(cv, 0, 0);
      const g = cv.getContext('2d');
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-over';
      Smear.paint(g, t, list, cfg);
      g.restore();
    },
    // Ebene in Szenengröße (für Gliederpuppen in Zwischensequenzen)
    layer(w, h) { if (!layer) layer = document.createElement('canvas'); if (layer.width !== w || layer.height !== h) { layer.width = w; layer.height = h; } return layer; },

    // Punkte einer Bones-Figur (Knochenspitzen) in Pixeln ihrer Leinwand
    rigPts(inst) {
      if (!window.Rig || !inst || !inst.mesh) return [];
      const P = Rig.PAD, ox = inst.mesh.w * P, oy = inst.mesh.h * P;
      return Rig.jointPos(inst).map((j) => [j.b.id, j.tx + ox, j.ty + oy, Math.max(10, Math.hypot(j.tx - j.hx, j.ty - j.hy) * 0.45)]);
    },
    // Punkte einer Gliederpuppe (Mitte jedes Teils) aus den Teil-Matrizen
    pupPts(pup, mats) {
      const out = [];
      for (const p of pup.parts) {
        const M = mats && mats[p.id];
        if (!M || p.hidden) continue;
        const s = Math.hypot(M[0], M[1]);
        out.push([p.id, M[0] * p.w / 2 + M[2] * p.h / 2 + M[4], M[1] * p.w / 2 + M[3] * p.h / 2 + M[5], Math.max(8, Math.max(p.w, p.h) * s * 0.5)]);
      }
      return out;
    },
    // Von Hand markiertes Smear-Bild in der Idle-Animation oder Geste einer Figur?
    figMarked(clip, holder, now, dtF) {
      if (!window.Anim || !dtF) return false;
      const idle = clip && clip.idleAnim ? Anim.get(clip.idleAnim) : null;
      if (idle && Smear.marked(idle, now - dtF, now)) return true;
      let h = holder; for (let i = 0; i < 4 && h && !h._gesture; i++) h = h.parentNode;
      const g = h && h._gesture;
      return !!(g && g.anim && Smear.marked(Object.assign({}, g.anim, { dur: 1e9 }), now - g.t0 - dtF, now - g.t0));
    },

    // ---------- Einstellungen ----------
    // obj[key]: undefined = erben, { on: false } = aus, { on: true, … } = eigene
    fields(obj, key, inheritLabel) {
      const { el } = VN;
      const cur = obj[key];
      const mode = cur && cur.on != null ? (cur.on ? 'on' : 'off') : '';
      const s = el('select', { onchange: (e) => VN.mutate(() => { const v = e.target.value; if (!v) delete obj[key]; else if (v === 'off') obj[key] = { on: false }; else obj[key] = Object.assign({}, DEF, obj[key] && obj[key].on != null ? obj[key] : {}, { on: true }); }) });
      for (const [v, l] of [...(inheritLabel ? [['', inheritLabel]] : []), ['off', 'Aus'], ['on', inheritLabel ? 'Eigene Einstellung' : 'An']]) { const o = el('option', { value: v }, l); if (v === (inheritLabel ? mode : mode || 'off')) o.selected = true; s.appendChild(o); }
      const box = el('div', { class: 'smear-f' }, el('div', { class: 'field' }, el('div', { class: 'lbl' }, 'Smear-Bilder bei schnellen Bewegungen'), s));
      if (cur && cur.on) {
        const c = Object.assign({}, DEF, cur);
        const chk = (k, label) => el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!c[k], onchange: (e) => VN.mutate(() => { obj[key][k] = e.target.checked; }) }), label);
        const lab = el('div', { class: 'lbl' }, VN.t('Ab welchem Tempo') + ': ' + c.sens + ' %');
        box.append(chk('multi', 'Mehrfachbilder'), chk('stretch', 'Ziehen (Stretch)'), chk('lines', 'Speedlines'),
          el('div', { class: 'field' }, lab, el('input', { type: 'range', min: 0, max: 100, step: 1, value: c.sens, oninput: (e) => { lab.textContent = VN.t('Ab welchem Tempo') + ': ' + e.target.value + ' %'; }, onchange: (e) => VN.mutate(() => { obj[key].sens = Number(e.target.value); }) })),
          el('div', { class: 'muted small' }, 'Mehr Prozent = schon bei mittlerem Tempo, weniger = nur bei sehr schnellen Bewegungen.'));
      }
      return box;
    }
  });
})();
