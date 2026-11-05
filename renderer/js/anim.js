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
        // Gliederpuppe (0.7.6)
        const pup = actor.puppet && window.Puppet && Puppet.get(actor.puppet);
        if (pup) { it.pupDef = pup; it.pup = await Puppet.load(pup); it.st = {}; sc.items.push(it); continue; }
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
    // Festgehaltene Haftpunkte einer Puppe (0.9.13): actor.holds = { Haftpunkt-ID: { x, y } } in Szenen-Anteilen (0–1)
    holdsFor(it, cmNow, camM, W, H) {
      const a = it.actor, pup = a && a.puppet && Puppet.get(a.puppet);
      if (!pup || !a.holds) return [];
      const out = [], toLocal = Puppet.m.mul(Puppet.m.inv(cmNow), camM);
      for (const p of pup.parts) for (const hp of p.holdPts || []) {
        const h = a.holds[hp.id];
        if (!h) continue;
        const [x, y] = Puppet.m.ap(toLocal, h.x * W, h.y * H);
        out.push({ id: hp.id, part: p.id, u: hp.u, v: hp.v, soft: hp.soft, x, y });
      }
      return out;
    },
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
      const smearOn = !!(window.Smear && dt > 0 && opts.alpha == null);
      // Kamera-Matrix (Szene → Leinwand), für festgehaltene Haftpunkte (0.9.13)
      const camM = (() => { const m = ctx.getTransform(); return [m.a, m.b, m.c, m.d, m.e, m.f]; })();
      // Nähte zwischen Figuren (0.9.12): zuerst die Lage aller Puppenteile, damit eine Figur an eine andere angenäht sein kann
      const placeOf = (it, a) => {
        const pl = Anim.place(a, t);
        const boxH = 0.88 * pl.scale / 100 * H;
        ctx.save();
        ctx.translate(pl.x / 100 * W, H - pl.y / 100 * H); ctx.rotate(pl.rot * Math.PI / 180); if (a.flip) ctx.scale(-1, 1);
        const m = ctx.getTransform(); ctx.restore();
        const pup = Puppet.get(a.puppet) || it.pupDef, bb = Puppet.bounds(pup), k = boxH / bb.h;
        const base = Puppet.m.mul(Puppet.m.S(k, k), Puppet.m.T(-(bb.x + bb.w / 2), -(bb.y + bb.h)));
        const cm = [m.a, m.b, m.c, m.d, m.e, m.f];
        return { cm, pup, base };
      };
      if (sc.items.some((it) => it.pup && (it.actor.seams || []).length)) {
        for (const it of sc.items) {
          if (!it.pup) { it._wm = null; continue; }
          const P0 = placeOf(it, it.actor), ms = Puppet.solve(P0.pup, opts.pose || Puppet.poseAt(it.actor, t), null, null, 0);
          it._wm = {}; for (const [pid, pm] of Object.entries(ms)) it._wm[pid] = Puppet.m.mul(P0.cm, Puppet.m.mul(P0.base, pm));
        }
      }
      const extFor = (it, cmNow) => {
        const L = (it.actor.seams || []).filter((s) => s.toActor && s.toPart);
        const holds = Anim.holdsFor(it, cmNow, camM, W, H);
        if (!L.length) return holds.length ? { holds } : {};
        const ext = {}, icm = Puppet.m.inv(cmNow);
        for (const s of L) { const tg = sc.items.find((x) => x.actor.id === s.toActor); if (tg && tg._wm && tg._wm[s.toPart]) ext[s.id] = Puppet.m.mul(icm, tg._wm[s.toPart]); }
        return { extSeams: L, ext, holds };
      };
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
        if (it.pup) {
          const pup = Puppet.get(a.puppet) || it.pupDef;
          const bb = Puppet.bounds(pup);
          const k = boxH / bb.h;
          const base = Puppet.m.mul(Puppet.m.S(k, k), Puppet.m.T(-(bb.x + bb.w / 2), -(bb.y + bb.h)));
          const pose = opts.pose || Puppet.poseAt(a, t);
          // Smear-Bilder (0.9.9): Puppe auf eigener Ebene zeichnen, dann Smear dahinter
          const smc = smearOn ? Smear.cfgFor(anim.smear) : null;
          let out;
          if (smc) {
            const L = Smear.layer(W, H), lg = L.getContext('2d');
            lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, 0, W, H);
            const m0 = ctx.getTransform(); lg.setTransform(m0);
            out = Puppet.draw(lg, pup, it.pup, base, t, dt, pose, it.st, extFor(it, [m0.a, m0.b, m0.c, m0.d, m0.e, m0.f]));
            const cm0 = [m0.a, m0.b, m0.c, m0.d, m0.e, m0.f], wm = {};
            for (const [pid, pm] of Object.entries(out)) wm[pid] = Puppet.m.mul(cm0, pm);
            Smear.inPlace(L, it._sm || (it._sm = {}), Smear.pupPts(pup, wm), t, boxH, smc, (dtF) => Smear.marked(anim, t - dtF, t));
            ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L, 0, 0); ctx.setTransform(m0);
          } else { const m1 = ctx.getTransform(); out = Puppet.draw(ctx, pup, it.pup, base, t, dt, pose, it.st, extFor(it, [m1.a, m1.b, m1.c, m1.d, m1.e, m1.f])); }
          const m = ctx.getTransform(), cm = [m.a, m.b, m.c, m.d, m.e, m.f];
          it.pmats = {}; for (const [pid, pm] of Object.entries(out)) it.pmats[pid] = Puppet.m.mul(cm, pm);
          it.pbase = Puppet.m.mul(cm, base);
        } else if (it.inst) {
          Rig.renderAt(it.inst, t, dt, Anim.angles(a, t));
          const smc = smearOn ? Smear.cfgFor(anim.smear) : null;
          if (smc) Smear.inPlace(it.inst.cv, it._sm || (it._sm = {}), Smear.rigPts(it.inst), t, it.inst.mesh.h, smc, (dtF) => Smear.marked(anim, t - dtF, t));
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
        maps.cam = camM;
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
          const fps = VN.animFps(anim.fps);
          const gap = window.Perf ? Perf.minInterval('bones') * 1000 : 0;
          if (fps ? !VN.fpsStep(ctrl, (now - t0) / 1000, fps) : (gap && now - last < gap)) { requestAnimationFrame(frame); return; }
          const t = fps ? Math.floor((now - t0) / 1000 * fps + 1e-6) / fps : (now - t0) / 1000;
          const dur = anim.dur || 3;
          const tt = anim.loop ? t % dur : Math.min(t, dur);
          if (canvas.width !== Math.round(canvas.getBoundingClientRect().width * Math.min(2, window.devicePixelRatio || 1))) fit();
          Anim.draw(ctx, sc, tt, Math.min(fps ? 1 / 5 : 1 / 30, (now - last) / 1000));
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
