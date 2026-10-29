// Animationen (Laufzeit, auch im exportierten Spiel):
// Keyframes für Knochen, Idle-Schleifen, Gesten, Zwischensequenzen (live auf Canvas oder als Video)
(function () {
  const { el } = VN;

  const EASE = {
    linear: (t) => t,
    'ease-in': (t) => t * t * t,
    'ease-out': (t) => 1 - Math.pow(1 - t, 3),
    'ease-in-out': (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    smooth: (t) => 1 - Math.pow(1 - t, 5),
    back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    bounce: (t) => { const c1 = 2.6, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  };

  // Wert einer Keyframe-Liste zur Zeit t ([{t, v, e}], sortiert)
  const sample = (keys, t, field) => {
    let prev = null, next = null;
    for (const k of keys) {
      if (k[field] == null) continue;
      if (k.t <= t) prev = k; else { next = k; break; }
    }
    if (!prev && !next) return null;
    if (!prev) return next[field];
    if (!next) return prev[field];
    const u = (t - prev.t) / Math.max(0.0001, next.t - prev.t);
    const f = (EASE[next.e] || EASE['ease-in-out'])(Math.max(0, Math.min(1, u)));
    return prev[field] + (next[field] - prev[field]) * f;
  };
  const sorted = (arr) => (arr || []).slice().sort((a, b) => a.t - b.t);

  const Anim = (window.Anim = {
    EASE, sample,
    list() { return (VN.project && VN.project.anims) || []; },
    get(id) { return Anim.list().find((a) => a.id === id) || null; },

    // Knochen-Winkel (Grad) eines Darstellers zur Zeit t
    angles(actor, t) {
      const out = {};
      for (const [name, keys] of Object.entries(actor.bones || {})) {
        const v = sample(sorted(keys), t, 'a');
        if (v) out[name] = v;
      }
      return out;
    },
    // Position, Größe, Drehung eines Darstellers zur Zeit t
    place(actor, t) {
      const mv = sorted(actor.move);
      const g = (f, d) => { const v = sample(mv, t, f); return v != null ? v : (actor[f] != null ? actor[f] : d); };
      return { x: g('x', 50), y: g('y', 0), scale: g('scale', 100), rot: g('rot', 0), opacity: g('opacity', 100) };
    },
    cam(anim, t) {
      const ks = sorted(anim.cam);
      const g = (f, d) => { const v = sample(ks, t, f); return v != null ? v : d; };
      return { zoom: g('zoom', 100), panX: g('panX', 0), panY: g('panY', 0), rot: g('rot', 0) };
    },

    // Idle-Schleife und Gesten für Figuren im Spiel (Bones nötig)
    extraFnFor(clip, holder) {
      return (now) => {
        let out = {};
        const idle = clip.idleAnim ? Anim.get(clip.idleAnim) : null;
        if (idle && idle.actors && idle.actors[0]) {
          const d = Math.max(0.1, idle.dur || 2);
          out = Anim.angles(idle.actors[0], ((now % d) + d) % d);
        }
        const g = holder._gesture;
        if (g && g.anim && g.anim.actors && g.anim.actors[0]) {
          const lt = now - g.t0, d = g.anim.dur || 1;
          if (lt > d + 0.3) holder._gesture = null;
          else {
            const w = Math.max(0, Math.min(1, lt / 0.2, (d + 0.3 - lt) / 0.3));
            const ga = Anim.angles(g.anim.actors[0], Math.min(lt, d));
            const keys = new Set([...Object.keys(out), ...Object.keys(ga)]);
            for (const k of keys) out[k] = (out[k] || 0) * (1 - w) + (ga[k] || 0) * w;
          }
        }
        return out;
      };
    },
    gesture(holder, animId) { const a = Anim.get(animId); if (a) holder._gesture = { anim: a, t0: performance.now() / 1000 }; },

    // ---------- Zusammensetzen auf ein Canvas (Editor, Spiel, Video) ----------
    // scene: { anim, actors: [{ actor, inst, img }] , bgImg }
    async build(anim) {
      const sc = { anim, items: [], bgImg: null };
      if (anim.bg && VN.assetUrl(anim.bg)) sc.bgImg = await Anim.loadImg(VN.assetUrl(anim.bg));
      for (const actor of anim.actors || []) {
        const it = { actor, inst: null, img: null };
        if (actor.asset && window.Rig && Rig.has(actor.asset)) {
          const cv = Rig.canvasFor(actor.asset, { boneAmp: 100 }, { manual: true });
          it.inst = await cv._inst.ready;
        }
        if (!it.inst && actor.asset && VN.assetUrl(actor.asset)) it.img = await Anim.loadImg(VN.assetUrl(actor.asset)).catch(() => null);
        sc.items.push(it);
      }
      return sc;
    },
    loadImg(url) { return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = url; }); },
    // Ein Bild der Animation zeichnen; liefert für jeden Darsteller die Umrechnung Bild → Canvas
    draw(ctx, sc, t, dt, opts = {}) {
      const W = ctx.canvas.width, H = ctx.canvas.height;
      const anim = sc.anim;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!opts.noClear) {
        ctx.clearRect(0, 0, W, H);
        if (anim.type === 'scene' || opts.bgFill) { ctx.fillStyle = opts.bgColor || '#0c0d10'; ctx.fillRect(0, 0, W, H); }
      }
      const cam = anim.type === 'scene' ? Anim.cam(anim, t) : { zoom: 100, panX: 0, panY: 0, rot: 0 };
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(cam.zoom / 100, cam.zoom / 100);
      ctx.translate(-cam.panX / 100 * W, -cam.panY / 100 * H);
      ctx.rotate(cam.rot * Math.PI / 180);
      ctx.translate(-W / 2, -H / 2);
      if (sc.bgImg && !opts.noBg) {
        const im = sc.bgImg, k = Math.max(W / im.naturalWidth, H / im.naturalHeight);
        ctx.drawImage(im, (W - im.naturalWidth * k) / 2, (H - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k);
      }
      const maps = [];
      for (const it of sc.items) {
        const a = it.actor;
        const pl = Anim.place(a, t);
        const boxH = 0.88 * pl.scale / 100 * H;
        const baseX = pl.x / 100 * W, baseY = H - pl.y / 100 * H;
        ctx.save();
        ctx.globalAlpha = (opts.alpha != null ? opts.alpha : 1) * pl.opacity / 100;
        ctx.translate(baseX, baseY);
        ctx.rotate(pl.rot * Math.PI / 180);
        if (a.flip) ctx.scale(-1, 1);
        let map = null;
        if (it.inst) {
          Rig.renderAt(it.inst, t, dt, Anim.angles(a, t));
          const P = Rig.PAD, cv = it.inst.cv;
          const cvH = boxH * (1 + 2 * P), cvW = cvH * cv.width / cv.height;
          const ox = -cvW / 2, oy = P * boxH - cvH;
          ctx.drawImage(cv, ox, oy, cvW, cvH);
          const sx = cvW / cv.width, sy = cvH / cv.height;
          const mw = it.inst.mesh.w * P, mh = it.inst.mesh.h * P;
          const m = ctx.getTransform();
          map = (x, y) => { const lx = ox + (x + mw) * sx, ly = oy + (y + mh) * sy; return [m.a * lx + m.c * ly + m.e, m.b * lx + m.d * ly + m.f]; };
        } else if (it.img) {
          const ih = boxH, iw = ih * it.img.naturalWidth / it.img.naturalHeight;
          ctx.drawImage(it.img, -iw / 2, -ih, iw, ih);
        }
        ctx.restore();
        maps.push({ it, map, base: [baseX, baseY], boxH });
      }
      ctx.restore();
      return maps;
    },

    // Abspielen auf einem Canvas (Zwischensequenz im Spiel). Gibt { stop } zurück, ruft onEnd am Ende
    play(canvas, anim, opts = {}) {
      const ctrl = { stopped: false, t: 0 };
      const audios = [];
      const ctx = canvas.getContext('2d');
      Anim.build(anim).then((sc) => {
        if (ctrl.stopped) return;
        const fit = () => { const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.max(2, Math.round(r.width * dpr)); canvas.height = Math.max(2, Math.round(r.height * dpr)); };
        fit();
        const t0 = performance.now();
        let last = t0;
        for (const au of anim.audio || []) {
          const url = VN.assetUrl(au.asset);
          if (!url) continue;
          const a = new Audio(url);
          a.volume = Math.max(0, Math.min(1, (au.vol != null ? au.vol : 90) / 100 * (opts.volume != null ? opts.volume : 1)));
          const tm = setTimeout(() => { if (!ctrl.stopped) a.play().catch(() => {}); }, (au.at || 0) * 1000);
          audios.push({ a, tm });
        }
        const frame = (now) => {
          if (ctrl.stopped || !canvas.isConnected) { ctrl.stop(); return; }
          const gap = window.Perf ? Perf.minInterval('bones') * 1000 : 0;
          if (gap && now - last < gap) { requestAnimationFrame(frame); return; }
          const t = (now - t0) / 1000;
          const dur = anim.dur || 3;
          const tt = anim.loop ? t % dur : Math.min(t, dur);
          if (canvas.width !== Math.round(canvas.getBoundingClientRect().width * Math.min(2, window.devicePixelRatio || 1))) fit();
          Anim.draw(ctx, sc, tt, Math.min(1 / 30, (now - last) / 1000));
          last = now;
          ctrl.t = tt;
          if (!anim.loop && t >= dur) { ctrl.stop(true); if (opts.onEnd) opts.onEnd(); return; }
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      ctrl.stop = (keepFrame) => { ctrl.stopped = true; for (const x of audios) { clearTimeout(x.tm); x.a.pause(); } };
      return ctrl;
    },
    // Standbild für den Editor
    async still(canvas, anim, t) {
      const sc = await Anim.build(anim);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(2, Math.round(r.width || 640)); canvas.height = Math.max(2, Math.round(r.height || 360));
      Anim.draw(canvas.getContext('2d'), sc, t || 0, 0);
    }
  });
})();
