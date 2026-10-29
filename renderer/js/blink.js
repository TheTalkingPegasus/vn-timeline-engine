// Blinzeln: Augen maskieren (Lid-Farbe wird aus dem Bild genommen) oder Bild mit geschlossenen Augen
(function () {
  const { el } = VN;
  const entries = new Set();
  let rafOn = false;

  const Blink = (window.Blink = {
    cfg(assetId) {
      const b = VN.project && VN.project.blinks && VN.project.blinks[assetId];
      if (!b || !b.on) return null;
      if (b.mode === 'image' ? !b.image : !(b.eyes && b.eyes.length)) return null;
      return b;
    },

    // Lid-Fortschritt 0 (offen) bis 1 (zu) für einen Zeitpunkt
    progress(state, now) {
      const b = state.cfg;
      const d = Number(b.dur) || 0.16;
      if (now >= state.next) {
        state.start = now;
        const dbl = Math.random() < (b.double != null ? b.double : 0.2);
        const min = Number(b.min) || 2.5, max = Math.max(min, Number(b.max) || 6);
        state.next = now + d + (dbl ? 0.12 : min + Math.random() * (max - min));
      }
      const t = now - state.start;
      if (t < 0 || t > d) return 0;
      const x = t / d;
      return x < 0.45 ? x / 0.45 : x < 0.55 ? 1 : (1 - x) / 0.45;
    },

    newState(cfg) { const now = performance.now() / 1000; return { cfg, next: now + 0.8 + Math.random() * 2.5, start: -10 }; },

    // Für normale Bilder: Lider als Ebene über dem Bild (wrapper muss genau so groß wie das Bild sein)
    attach(wrapper, assetId) {
      const b = Blink.cfg(assetId);
      if (!b) return;
      const layer = el('div', { class: 'blink-layer' });
      const lids = [];
      let closed = null;
      if (b.mode === 'image') {
        closed = el('img', { src: VN.assetUrl(b.image), draggable: 'false', class: 'blink-closed' });
        layer.appendChild(closed);
      } else {
        for (const e of b.eyes) {
          const eye = el('div', { class: 'blink-eye', style: { left: e.x * 100 + '%', top: e.y * 100 + '%', width: e.w * 100 + '%', height: e.h * 100 + '%' } });
          const lid = el('div', { class: 'blink-lid', style: { background: b.color || '#e9d6c4', borderBottomColor: b.lash || '#2a2440' } });
          eye.appendChild(lid);
          layer.appendChild(eye);
          lids.push(lid);
        }
      }
      wrapper.appendChild(layer);
      entries.add({ layer, lids, closed, state: Blink.newState(b) });
      start();
    },

    // Für Bones: zeichnet Lider direkt in die Textur
    paint(ctx, w, h, cfg, p, closedImg) {
      if (p <= 0) return;
      if (cfg.mode === 'image') {
        if (p > 0.5 && closedImg) ctx.drawImage(closedImg, 0, 0, w, h);
        return;
      }
      for (const e of cfg.eyes) {
        const x = e.x * w, y = e.y * h, ew = e.w * w, eh = e.h * h;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x + ew / 2, y + eh / 2, ew / 2, eh / 2, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = cfg.color || '#e9d6c4';
        ctx.fillRect(x, y, ew, eh * p);
        ctx.fillStyle = cfg.lash || '#2a2440';
        ctx.fillRect(x, y + eh * p - Math.max(1.5, eh * 0.08), ew, Math.max(1.5, eh * 0.08));
        ctx.restore();
      }
    },

    // Farbe direkt über dem Auge aus dem Bild nehmen
    async sampleColor(assetId, eye) {
      const info = await Rig.analyze(assetId);
      const ctx = info.canvas.getContext('2d', { willReadFrequently: true });
      try {
        const px = Math.round((eye.x + eye.w / 2) * info.w), py = Math.max(0, Math.round((eye.y - eye.h * 0.25) * info.h));
        const d = ctx.getImageData(px, py, 1, 1).data;
        return '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
      } catch (e) { return null; }
    }
  });

  function start() {
    if (rafOn) return;
    rafOn = true;
    const tick = () => {
      const now = performance.now() / 1000;
      for (const en of entries) {
        if (!en.layer.isConnected) { entries.delete(en); continue; }
        const p = Blink.progress(en.state, now);
        if (en.closed) en.closed.style.opacity = p > 0.5 ? '1' : '0';
        for (const l of en.lids) l.style.transform = 'scaleY(' + p.toFixed(3) + ')';
      }
      if (entries.size) requestAnimationFrame(tick); else rafOn = false;
    };
    requestAnimationFrame(tick);
  }
})();
