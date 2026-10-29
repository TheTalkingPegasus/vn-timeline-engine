// Werkzeuge & Effekte (Laufzeit, auch im exportierten Spiel):
// Keyframes, Kamera, Parallax, Partikel, Tageszeit, Filter, Masken-Übergänge, Text-Effekte,
// Lippensync, Stimm-Filter, Ducking, Licht, Handy-Chat, Glossar
(function () {
  const { el } = VN;

  // ---------- Kurven ----------
  const EASES = {
    linear: 'linear', 'ease-in': 'cubic-bezier(.42,0,1,1)', 'ease-out': 'cubic-bezier(0,0,.58,1)', 'ease-in-out': 'cubic-bezier(.42,0,.58,1)',
    smooth: 'cubic-bezier(.2,.8,.2,1)', back: 'cubic-bezier(.34,1.56,.64,1)', bounce: 'cubic-bezier(.5,1.8,.5,.8)'
  };
  const EASE_LIST = [['ease-in-out', 'Weich (an & ab)'], ['ease-out', 'Abbremsen'], ['ease-in', 'Beschleunigen'], ['linear', 'Gleichmäßig'], ['smooth', 'Sanft auslaufen'], ['back', 'Überschwingen'], ['bounce', 'Federn']];

  const Fx = (window.Fx = {
    EASES, EASE_LIST,
    ease: (k) => EASES[k] || EASES['ease-in-out'],

    // ---------- Keyframes: Werte eines Clips in einem Schritt ----------
    CHAR_PROPS: ['x', 'y', 'scale', 'rot', 'opacity'],
    propsAt(clip, beat) {
      const out = { x: clip.x != null ? clip.x : 50, y: clip.y || 0, scale: clip.scale || 100, rot: clip.rot || 0, opacity: clip.opacity != null ? clip.opacity : 100, key: null };
      for (const k of (clip.keys || []).slice().sort((a, b) => a.beat - b.beat)) {
        if (k.beat > beat) break;
        for (const p of Fx.CHAR_PROPS) if (k[p] != null) out[p] = k[p];
        if (k.beat === beat) out.key = k;
      }
      return out;
    },
    placeChar(box, pr) {
      box.style.left = pr.x + '%';
      box.style.bottom = pr.y + '%';
      box.style.height = (88 * pr.scale / 100) + '%';
      box.style.rotate = pr.rot ? pr.rot + 'deg' : '';
    },

    // ---------- Kamera ----------
    CAM0: { zoom: 100, panX: 0, panY: 0, rot: 0 },
    camAt(scene, beat) {
      const c = window.Stage ? Stage.clipAt(scene.tracks.cam, beat) : null;
      if (!c) return Object.assign({ clip: null, key: null }, Fx.CAM0);
      const out = { zoom: c.zoom != null ? c.zoom : 100, panX: c.panX || 0, panY: c.panY || 0, rot: c.rot || 0, clip: c, key: null };
      for (const k of (c.keys || []).slice().sort((a, b) => a.beat - b.beat)) {
        if (k.beat > beat) break;
        for (const p of ['zoom', 'panX', 'panY', 'rot']) if (k[p] != null) out[p] = k[p];
        if (k.beat === beat) out.key = k;
      }
      return out;
    },
    camTransform(cam, depth, cover) {
      const d = depth != null ? depth : 1;
      let z = 1 + ((cam.zoom || 100) / 100 - 1) * d;
      // Hintergrund-Ebenen so weit vergrößern, dass beim Schwenk keine Kante sichtbar wird
      if (cover) {
        const t = Math.max(Math.abs((cam.panX || 0) * d), Math.abs((cam.panY || 0) * d)) / 100;
        if (t > 0) z = Math.max(z, 1 / Math.max(0.2, 1 - 2 * t) + 0.01);
      }
      return `scale(${z.toFixed(4)}) translate(${(-(cam.panX || 0) * d).toFixed(3)}%, ${(-(cam.panY || 0) * d).toFixed(3)}%) rotate(${((cam.rot || 0) * d).toFixed(2)}deg)`;
    },
    // Alle Ebenen mit data-depth nach der Kamera ausrichten
    applyCam(world, cam, dur, ease) {
      for (const n of world.querySelectorAll('[data-depth]')) {
        n.style.transition = dur ? `transform ${dur}s ${Fx.ease(ease)}` : 'none';
        n.style.transform = Fx.camTransform(cam, Number(n.dataset.depth), n.classList.contains('bg-box') || n.classList.contains('par-layer'));
      }
    },
    // Zersplittern: Element zerspringt in Scherben (erst Risse, dann fallen/explodieren/wegfliegen).
    // opts: { pieces: 18, mode: 'fall'|'burst'|'side', cracks: true, dur: 1.1, sound } → Promise
    shatter(node, opts = {}) {
      return new Promise((resolve) => {
        if (!node || !node.isConnected) return resolve();
        const host = node.offsetParent || node.parentElement;
        const r = node.getBoundingClientRect(), hr = host.getBoundingClientRect();
        const calm = VN.settings && VN.settings.calm && window.Player && Player.running;
        if (calm) { node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).onfinish = () => resolve(); return; }
        const W = r.width, H = r.height, left = r.left - hr.left, top = r.top - hr.top;
        // Scherben: Raster mit verschobenen Punkten, jede Zelle in zwei Dreiecke
        const n = Math.max(4, Math.min(60, Number(opts.pieces) || 18));
        const cols = Math.max(2, Math.round(Math.sqrt(n * W / Math.max(1, H)))), rows = Math.max(2, Math.ceil(n / cols / 2));
        const pts = [];
        for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
          const jx = x > 0 && x < cols ? (Math.random() - 0.5) * 0.7 : 0, jy = y > 0 && y < rows ? (Math.random() - 0.5) * 0.7 : 0;
          pts.push([(x + jx) / cols * 100, (y + jy) / rows * 100]);
        }
        const P = (x, y) => pts[y * (cols + 1) + x];
        const tris = [];
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          const a = P(x, y), b = P(x + 1, y), c = P(x + 1, y + 1), d = P(x, y + 1);
          if (Math.random() < 0.5) tris.push([a, b, c], [a, c, d]); else tris.push([a, b, d], [b, c, d]);
        }
        const layer = document.createElement('div');
        Object.assign(layer.style, { position: 'absolute', left: left + 'px', top: top + 'px', width: W + 'px', height: H + 'px', pointerEvents: 'none', zIndex: 90 });
        host.appendChild(layer);
        const dur = (Number(opts.dur) || 1.1) * 1000;
        const go = () => {
          node.style.visibility = 'hidden';
          let left2 = tris.length;
          for (const t of tris) {
            const piece = node.cloneNode(true);
            piece.style.visibility = 'visible';
            Object.assign(piece.style, { position: 'absolute', left: '0', top: '0', right: 'auto', bottom: 'auto', translate: 'none', width: W + 'px', height: H + 'px', margin: '0', transform: 'none', animation: 'none', clipPath: 'polygon(' + t.map((q) => q[0] + '% ' + q[1] + '%').join(',') + ')' });
            layer.appendChild(piece);
            const cx = (t[0][0] + t[1][0] + t[2][0]) / 3 - 50, cy = (t[0][1] + t[1][1] + t[2][1]) / 3 - 50;
            const mode = opts.mode || 'fall';
            const dx = mode === 'side' ? (W * (0.6 + Math.random())) * (cx < 0 ? -1 : 1) : mode === 'burst' ? cx * W / 30 * (0.8 + Math.random()) : cx * W / 160 + (Math.random() - 0.5) * 30;
            const dy = mode === 'fall' ? H * (1.6 + Math.random() * 1.6) : mode === 'burst' ? cy * H / 30 * (0.8 + Math.random()) : (Math.random() - 0.3) * H;
            const rot = (Math.random() - 0.5) * (mode === 'burst' ? 540 : 260);
            piece.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 0 }],
              { duration: dur * (0.75 + Math.random() * 0.5), easing: mode === 'fall' ? 'cubic-bezier(.5,0,.9,.6)' : 'cubic-bezier(.2,.7,.4,1)', delay: Math.random() * 90, fill: 'forwards' })
              .onfinish = () => { if (--left2 <= 0) { layer.remove(); resolve(); } };
          }
        };
        if (opts.sound && window.Theme) { try { const au = new Audio(VN.assetUrl(opts.sound)); au.volume = Math.min(1, (VN.settings ? VN.settings.sfx / 100 : 1)); au.play().catch(() => {}); } catch (e) { /* egal */ } }
        if (opts.cracks === false) return go();
        // Risse: ein paar Linien vom Einschlagpunkt
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
        Object.assign(svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
        const ox = 35 + Math.random() * 30, oy = 35 + Math.random() * 30;
        for (let i = 0; i < 9; i++) {
          const ang = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
          let x = ox, y = oy, d = 'M' + x + ' ' + y;
          for (let k = 0; k < 3; k++) { x += Math.cos(ang + (Math.random() - 0.5) * 0.7) * (12 + Math.random() * 16); y += Math.sin(ang + (Math.random() - 0.5) * 0.7) * (12 + Math.random() * 16); d += ' L' + x.toFixed(1) + ' ' + y.toFixed(1); }
          const pth = document.createElementNS(svgNS, 'path');
          pth.setAttribute('d', d); pth.setAttribute('fill', 'none'); pth.setAttribute('stroke', 'rgba(255,255,255,0.85)'); pth.setAttribute('stroke-width', '0.6'); pth.setAttribute('vector-effect', 'non-scaling-stroke');
          pth.style.strokeDasharray = '200'; pth.style.strokeDashoffset = '200';
          pth.animate([{ strokeDashoffset: 200 }, { strokeDashoffset: 0 }], { duration: 260, delay: i * 18, fill: 'forwards' });
          svg.appendChild(pth);
        }
        const crackBox = document.createElement('div');
        Object.assign(crackBox.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
        crackBox.appendChild(svg);
        layer.appendChild(crackBox);
        node.animate([{ translate: '0 0' }, { translate: '-3px 0' }, { translate: '3px 0' }, { translate: '0 0' }], { duration: 180 });
        setTimeout(() => { crackBox.remove(); go(); }, 380);
      });
    },

    shake(node, strength, dur) {
      if (VN.settings && VN.settings.calm && window.Player && Player.running) return;
      const s = Math.max(0.2, (strength || 50) / 50);
      const frames = [];
      for (let i = 0; i < 10; i++) frames.push({ transform: `translate(${((Math.random() - 0.5) * 2.4 * s).toFixed(2)}%, ${((Math.random() - 0.5) * 1.8 * s).toFixed(2)}%)` });
      frames.push({ transform: 'none' });
      node.animate(frames, { duration: (dur || 0.5) * 1000, easing: 'ease-out' });
    },

    // ---------- Tageszeit, Filter, Licht ----------
    // ---------- Motion Tile: Bild als Kachel endlos scrollen, nur im sichtbaren Bereich ----------
    TILE_DIRS: [['left', '← nach links'], ['right', '→ nach rechts'], ['up', '↑ nach oben'], ['down', '↓ nach unten'], ['upleft', '↖ schräg links hoch'], ['upright', '↗ schräg rechts hoch'], ['downleft', '↙ schräg links runter'], ['downright', '↘ schräg rechts runter']],
    tileVec(dir) {
      const d = Math.SQRT1_2;
      return ({ left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1], upleft: [-d, -d], upright: [d, -d], downleft: [-d, d], downright: [d, d] })[dir] || [-1, 0];
    },
    tileOn(t) { return !!(t && t.on); },
    // Ein Element, das genau den sichtbaren Bereich füllt. Darin liegt eine Fläche, die nur eine
    // Kachel größer ist als das Fenster und per transform verschoben wird (läuft auf der Grafikkarte).
    tileEl(url, t) {
      t = t || {};
      const wrap = el('div', { class: 'tile-wrap' });
      const inner = el('div', { class: 'tile-inner' });
      wrap.appendChild(inner);
      if (!url) return wrap;
      const [vx, vy] = Fx.tileVec(t.dir || 'left');
      const speed = (t.speed != null ? t.speed : 6) / 100;   // Anteil der Bildhöhe pro Sekunde
      const size = (t.size != null ? t.size : 100) / 100;     // Kachelhöhe relativ zur Bildhöhe
      let bgUrl = url, aspect = 16 / 9, mirror = !!t.mirror, objUrl = null, W = 0, H = 0, pw = 0, ph = 0;
      let x = 0, y = 0, last = 0, raf = 0;
      const layout = () => {
        W = wrap.clientWidth; H = wrap.clientHeight;
        if (!W || !H) return;
        const th = H * size, tw = th * aspect;
        pw = mirror ? tw * 2 : tw; ph = mirror ? th * 2 : th;
        Object.assign(inner.style, {
          left: -pw + 'px', top: -ph + 'px', width: (W + pw * 2) + 'px', height: (H + ph * 2) + 'px',
          backgroundImage: `url("${bgUrl}")`, backgroundSize: pw + 'px ' + ph + 'px'
        });
      };
      const step = (now) => {
        if (!wrap.isConnected) { if (last) { cancelAnimationFrame(raf); if (objUrl) URL.revokeObjectURL(objUrl); return; } }
        else {
          const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
          last = now;
          if (wrap.clientWidth !== W || wrap.clientHeight !== H) layout();
          if (pw && ph) {
            x += vx * speed * H * dt; y += vy * speed * H * dt;
            const tx = ((x % pw) + pw) % pw, ty = ((y % ph) + ph) % ph;
            inner.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
          }
        }
        raf = requestAnimationFrame(step);
      };
      const img = new Image();
      if (/^vnasset:/i.test(url) || /^https?:/i.test(location.protocol)) img.crossOrigin = 'anonymous';
      img.onload = () => {
        aspect = (img.naturalWidth || 16) / (img.naturalHeight || 9);
        if (mirror) {
          // 2×2-Kachel mit gespiegelten Kopien: Ränder passen immer zusammen
          try {
            const w = img.naturalWidth || 1024, h = img.naturalHeight || 576;
            const k = Math.min(1, 2048 / Math.max(w, h));
            const cw = Math.round(w * k), ch = Math.round(h * k);
            const c = document.createElement('canvas'); c.width = cw * 2; c.height = ch * 2;
            const g = c.getContext('2d');
            const put = (fx, fy, ox, oy) => { g.save(); g.translate(ox + (fx ? cw : 0), oy + (fy ? ch : 0)); g.scale(fx ? -1 : 1, fy ? -1 : 1); g.drawImage(img, 0, 0, cw, ch); g.restore(); };
            put(false, false, 0, 0); put(true, false, cw, 0); put(false, true, 0, ch); put(true, true, cw, ch);
            c.toBlob((b) => { if (b) { objUrl = URL.createObjectURL(b); bgUrl = objUrl; } else mirror = false; layout(); });
            return;
          } catch (e) { mirror = false; }
        }
        layout();
      };
      img.onerror = () => layout();
      img.src = url;
      raf = requestAnimationFrame(step);
      return wrap;
    },

    // ---------- Augen-Übergang: Lider öffnen / schließen aus Sicht der Figur ----------
    EYE_MODES: [['open', 'Augen öffnen (Aufwachen)'], ['close', 'Augen schließen (Einschlafen, Ohnmacht)'], ['blink', 'Einmal zu und wieder auf']],
    EYE_DEF: { eyesDur: 3, eyesBlinks: 2, eyesBlur: 60, eyesColor: 'black' },
    // Keyframes für die Öffnung p (0 = zu, 1 = offen)
    eyePlan(mode, blinks) {
      const pts = [];
      if (mode === 'close') {
        pts.push(1);
        for (let i = 0; i < blinks; i++) { pts.push(0.1 + 0.05 * i, 0.55 - 0.12 * i); }
        pts.push(0);
      } else if (mode === 'blink') {
        pts.push(1, 0, 0, 1);
      } else {
        pts.push(0, 0);
        for (let i = 0; i < blinks; i++) { pts.push(0.28 + 0.16 * i, 0.04); }
        pts.push(1);
      }
      return pts;
    },
    // Overlay mit zwei gewölbten Lidern; live = abspielen, sonst Standbild (Editor)
    eyesEl(c, live) {
      const mode = c.eyes || 'open';
      const dur = Math.max(0.3, c.eyesDur != null ? c.eyesDur : 3);
      const blinks = Math.max(0, Math.min(4, c.eyesBlinks != null ? c.eyesBlinks : 2));
      const blur = (c.eyesBlur != null ? c.eyesBlur : 60) / 100;
      const red = c.eyesColor === 'red';
      const col = red ? '#3a0a0c' : '#000';
      const wrap = el('div', { class: 'eyes-ov' });
      const haze = el('div', { class: 'eyes-haze' });
      const top = el('div', { class: 'eyes-lid top', style: { background: red ? 'radial-gradient(ellipse at 50% 100%, #7a1c1c, #2a0608 70%)' : col, boxShadow: `0 4vh 6vh 2vh ${col}` } });
      const bot = el('div', { class: 'eyes-lid bot', style: { background: red ? 'radial-gradient(ellipse at 50% 0%, #7a1c1c, #2a0608 70%)' : col, boxShadow: `0 -4vh 6vh 2vh ${col}` } });
      wrap.append(haze, top, bot);
      const pos = (p) => ({ top: `translateY(${(-p * 112).toFixed(1)}%)`, bot: `translateY(${(p * 112).toFixed(1)}%)` });
      const pts = Fx.eyePlan(mode, blinks);
      if (!live) {
        // Editor: halber Zustand, damit man sieht, was passiert
        const p = mode === 'close' ? 0.35 : 0.45;
        top.style.transform = pos(p).top; bot.style.transform = pos(p).bot;
        haze.style.backdropFilter = blur ? `blur(${(blur * 6).toFixed(1)}px)` : '';
        return wrap;
      }
      const n = pts.length - 1;
      const kf = (side) => pts.map((p, i) => ({ transform: pos(p)[side], offset: i / n, easing: 'ease-in-out' }));
      const opts = { duration: dur * 1000, fill: 'forwards' };
      top.animate(kf('top'), opts);
      bot.animate(kf('bot'), opts);
      if (blur > 0) {
        const b0 = `blur(${(blur * 14).toFixed(1)}px)`, b1 = 'blur(0px)';
        haze.animate(mode === 'close' ? [{ backdropFilter: b1 }, { backdropFilter: b0 }] : mode === 'blink' ? [{ backdropFilter: b1 }, { backdropFilter: b0, offset: 0.5 }, { backdropFilter: b1 }] : [{ backdropFilter: b0 }, { backdropFilter: b0, offset: 0.25 }, { backdropFilter: b1 }], opts);
      }
      return wrap;
    },

    DAYTIMES: [['', 'Wie im Bild'], ['morning', 'Morgen'], ['day', 'Tag (klar)'], ['evening', 'Abend'], ['night', 'Nacht']],
    DAY: {
      morning: { filter: 'brightness(1.05) saturate(0.95)', color: '#ffe2bd', blend: 'soft-light', a: 0.45, light: '#fff0dc' },
      day: { filter: 'brightness(1.06) saturate(1.12) contrast(1.03)', color: '#ffffff', blend: 'soft-light', a: 0.1, light: '#ffffff' },
      evening: { filter: 'sepia(0.25) saturate(1.25) hue-rotate(-12deg) brightness(0.92)', color: '#ff9a4a', blend: 'multiply', a: 0.32, light: '#ffb070' },
      night: { filter: 'brightness(0.55) saturate(0.7) hue-rotate(12deg)', color: '#1b2a6e', blend: 'multiply', a: 0.55, light: '#5a6ec8' }
    },
    dayOverlay(dt) {
      const d = Fx.DAY[dt];
      const n = el('div', { class: 'day-ov' });
      if (d) Object.assign(n.style, { background: d.color, mixBlendMode: d.blend, opacity: String(d.a) });
      else n.style.opacity = '0';
      return n;
    },
    FILTERS: [['flashback', 'Rückblende (Sepia)'], ['bw', 'Schwarz-Weiß'], ['dream', 'Traum'], ['cold', 'Kalt'], ['warm', 'Warm']],
    FILTER_CSS: {
      flashback: 'sepia(0.8) contrast(0.92) brightness(1.06) saturate(0.85)',
      bw: 'grayscale(1) contrast(1.12)',
      dream: 'saturate(1.35) brightness(1.08) contrast(0.9) blur(0.4px)',
      cold: 'saturate(0.85) hue-rotate(12deg) brightness(0.97)',
      warm: 'sepia(0.25) saturate(1.2) brightness(1.03)'
    },
    filterEdge(f) {
      if (f === 'flashback') return 'radial-gradient(ellipse at center, transparent 55%, rgba(236,214,170,0.55) 82%, rgba(240,225,190,0.95) 100%)';
      if (f === 'dream') return 'radial-gradient(ellipse at center, transparent 50%, rgba(255,255,255,0.45) 85%, rgba(255,255,255,0.8) 100%)';
      return '';
    },
    // Durchschnittsfarbe eines Bildes (für „Licht passend zur Szene“)
    _avg: {},
    avgColor(assetId) {
      if (!assetId) return Promise.resolve(null);
      if (Fx._avg[assetId]) return Fx._avg[assetId];
      Fx._avg[assetId] = new Promise((res) => {
        const im = new Image(); im.crossOrigin = 'anonymous';
        im.onload = () => {
          try {
            const c = document.createElement('canvas'); c.width = 24; c.height = 14;
            const g = c.getContext('2d'); g.drawImage(im, 0, 0, 24, 14);
            const d = g.getImageData(0, 0, 24, 14).data;
            let r = 0, gg = 0, b = 0; const n = d.length / 4;
            for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
            res('#' + [r, gg, b].map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join(''));
          } catch (e) { res(null); }
        };
        im.onerror = () => res(null);
        im.src = VN.assetUrl(assetId);
      });
      return Fx._avg[assetId];
    },
    // Farbschleier über einer Figur (nur dort, wo die Figur ist)
    lightOverlay(charBox, clip, color, strength) {
      charBox.querySelectorAll('.char-light').forEach((n) => n.remove());
      if (!color || !strength) return;
      const url = VN.assetUrl(clip.asset);
      const inner = charBox.querySelector('.char-inner, img, canvas');
      if (!inner) return;
      if (inner.tagName === 'CANVAS') { inner.style.filter = `brightness(${Fx.lum(color) * 0.6 + 0.55})`; return; }
      const host = inner.classList.contains('char-inner') ? inner : charBox;
      const ov = el('div', { class: 'char-light' });
      Object.assign(ov.style, { background: color, opacity: String(Math.min(0.85, strength / 100 * 0.8)), webkitMaskImage: `url("${url}")`, maskImage: `url("${url}")`, transform: clip.flip ? 'scaleX(-1)' : '' });
      if (host === charBox) { const r = inner.getBoundingClientRect(); ov.style.width = (inner.offsetWidth || r.width) + 'px'; }
      host.appendChild(ov);
    },
    lum(hex) { const n = parseInt(String(hex).slice(1), 16) || 0; return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; },

    // ---------- Partikel ----------
    PARTICLES: [['rain', 'Regen'], ['snow', 'Schnee'], ['dust', 'Staub'], ['sparks', 'Funken'], ['petals', 'Blütenblätter'], ['fireflies', 'Glühwürmchen']],
    PART_DEF: {
      rain: { color: '#a8c8ff', density: 60, speed: 70, size: 30, wind: 15 },
      snow: { color: '#ffffff', density: 50, speed: 25, size: 40, wind: 10 },
      dust: { color: '#fff2d0', density: 60, speed: 10, size: 25, wind: 5 },
      sparks: { color: '#ffb040', density: 60, speed: 45, size: 30, wind: 0 },
      petals: { color: '#ffb6d0', density: 55, speed: 25, size: 50, wind: 25 },
      fireflies: { color: '#d8ff7a', density: 45, speed: 15, size: 40, wind: 0 }
    },
    particles(canvas, cfg) {
      const type = cfg.particles;
      const d = Object.assign({}, Fx.PART_DEF[type] || {}, cfg);
      const g = canvas.getContext('2d');
      let W = 0, H = 0, parts = [], last = performance.now(), raf = 0;
      const R = Math.random;
      const resize = () => {
        const r = canvas.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const oW = W, oH = H;
        W = Math.max(1, r.width * dpr); H = Math.max(1, r.height * dpr);
        canvas.width = W; canvas.height = H;
        // Größe hat sich geändert (z. B. Canvas war beim Anlegen noch nicht sichtbar):
        // Partikel neu verteilen bzw. mitskalieren, sonst kleben langsame Partikel in einer Ecke
        if (parts && parts.length && (oW !== W || oH !== H)) {
          if (oW <= 4 || oH <= 4) parts = parts.map(() => spawn(true));
          else for (const q of parts) { q.x *= W / oW; q.y *= H / oH; q.s *= Math.max(H / 900, 0.7) / Math.max(oH / 900, 0.7); }
        }
      };
      resize();
      const count = () => Math.round((window.Perf ? Perf.partsMul() : 1) * (d.density || 50) / 100 * (type === 'rain' ? 420 : type === 'snow' ? 260 : type === 'fireflies' ? 60 : type === 'petals' ? 70 : type === 'sparks' ? 120 : 160));
      const spawn = (init) => {
        // In kleinen Vorschauen nicht unter Pixelgröße schrumpfen, sonst sind Schnee, Staub & Co. unsichtbar
        const s = (d.size || 40) / 40 * Math.max(H / 900, 0.7);
        const p = { x: R() * W * 1.2 - W * 0.1, y: init ? R() * H : (type === 'sparks' ? H + 10 : -20), z: 0.4 + R() * 0.8, s, ph: R() * 6.28, rot: R() * 6.28, life: 0 };
        if (type === 'sparks') p.x = W * (0.2 + R() * 0.6);
        return p;
      };
      for (let i = 0; i < count(); i++) parts.push(spawn(true));
      const sp = (d.speed || 40) / 40;
      const wind = (d.wind || 0) / 100;
      const col = d.color || '#ffffff';
      const step = (now) => {
        if (!canvas.isConnected) { cancelAnimationFrame(raf); return; }
        const gap = window.Perf ? Perf.minInterval('parts') * 1000 : 0;
        if (gap && now - last < gap) { raf = requestAnimationFrame(step); return; }
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        // Qualität kann sich live ändern: Anzahl anpassen
        const want = count();
        while (parts.length > want) parts.pop();
        while (parts.length < want) parts.push(spawn(true));
        if (canvas.width !== Math.round(canvas.getBoundingClientRect().width * Math.min(2, window.devicePixelRatio || 1))) resize();
        g.clearRect(0, 0, W, H);
        g.fillStyle = col; g.strokeStyle = col;
        for (const p of parts) {
          p.life += dt; p.ph += dt;
          if (type === 'rain') {
            p.y += H * 1.6 * sp * p.z * dt; p.x += H * wind * 1.6 * sp * dt;
            g.globalAlpha = 0.35 + p.z * 0.35; g.lineWidth = Math.max(1, 1.4 * p.s * p.z);
            g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - wind * 30 * p.s, p.y - 34 * p.s * p.z); g.stroke();
          } else if (type === 'snow') {
            p.y += H * 0.12 * sp * p.z * dt; p.x += (Math.sin(p.ph * 1.3) * 0.04 + wind * 0.1) * H * dt;
            g.globalAlpha = 0.5 + p.z * 0.4; g.beginPath(); g.arc(p.x, p.y, Math.max(1.4, 3.2 * p.s * p.z), 0, 6.28); g.fill();
          } else if (type === 'dust') {
            p.y += Math.sin(p.ph * 0.6) * 6 * dt * p.s + H * 0.006 * sp * dt; p.x += (Math.cos(p.ph * 0.4) * 0.01 + wind * 0.03) * H * dt;
            g.globalAlpha = Math.min(1, (0.35 + 0.45 * Math.sin(p.ph * 0.8) ** 2) * p.z); g.beginPath(); g.arc(p.x, p.y, Math.max(1.3, 2.2 * p.s * p.z), 0, 6.28); g.fill();
          } else if (type === 'sparks') {
            p.y -= H * 0.28 * sp * p.z * dt; p.x += Math.sin(p.ph * 3 + p.z * 9) * 40 * dt * p.s + wind * H * 0.05 * dt;
            const a = Math.max(0, 1 - p.life / (1.6 + p.z));
            g.globalAlpha = a * (0.6 + 0.4 * Math.sin(p.ph * 20)); g.beginPath(); g.arc(p.x, p.y, Math.max(1.4, 3 * p.s * p.z), 0, 6.28); g.fill();
            if (a <= 0) Object.assign(p, spawn(false));
          } else if (type === 'petals') {
            p.y += H * 0.1 * sp * p.z * dt; p.x += (Math.sin(p.ph) * 0.06 + wind * 0.15) * H * dt; p.rot += dt * 1.5;
            g.globalAlpha = 0.85; g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, 0.55 + 0.45 * Math.sin(p.ph * 2));
            g.beginPath(); g.ellipse(0, 0, 7 * p.s * p.z, 4 * p.s * p.z, 0, 0, 6.28); g.fill(); g.restore();
          } else if (type === 'fireflies') {
            p.x += Math.cos(p.ph * 0.7 + p.z * 5) * 30 * sp * dt * p.s; p.y += Math.sin(p.ph * 0.5 + p.z * 3) * 22 * sp * dt * p.s;
            const a = 0.25 + 0.75 * Math.max(0, Math.sin(p.ph * 1.7 + p.z * 4));
            const r = 9 * p.s * p.z;
            const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4);
            gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
            g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r * 2.4, 0, 6.28); g.fill(); g.fillStyle = col;
          }
          if (p.y > H + 40 || p.x < -W * 0.2 || p.x > W * 1.2 || (type === 'sparks' && p.y < -20)) Object.assign(p, spawn(false));
          if (type === 'fireflies' && (p.y < -30)) p.y = H + 20;
        }
        g.globalAlpha = 1;
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    },
    particleEl(cfg, cls) {
      const c = el('canvas', { class: cls || 'part-canvas' });
      requestAnimationFrame(() => Fx.particles(c, cfg));
      return c;
    },

    // ---------- Masken-Übergänge ----------
    MASKS: [['wipe-right', 'Wischen nach rechts'], ['wipe-left', 'Wischen nach links'], ['wipe-down', 'Wischen nach unten'], ['circle', 'Kreis'], ['diamond', 'Raute'], ['blinds', 'Jalousie'], ['clock', 'Uhrzeiger'], ['noise', 'Auflösen (Rauschen)'], ['splatter', 'Spritzer']],
    _maskCache: {},
    maskData(kind, assetId) {
      const key = kind + '|' + (assetId || '');
      if (Fx._maskCache[key]) return Fx._maskCache[key];
      const W = 192, H = 108;
      Fx._maskCache[key] = new Promise((res) => {
        const a = new Float32Array(W * H);
        if (kind === 'custom' && assetId) {
          const im = new Image(); im.crossOrigin = 'anonymous';
          im.onload = () => {
            try { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(im, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data; for (let i = 0; i < W * H; i++) a[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255; } catch (e) { /* leer */ }
            res({ a, W, H });
          };
          im.onerror = () => res({ a, W, H });
          im.src = VN.assetUrl(assetId);
          return;
        }
        let seed = 7;
        const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        const blobs = [];
        if (kind === 'splatter') for (let i = 0; i < 26; i++) blobs.push([rnd() * W, rnd() * H, 6 + rnd() * 34, rnd()]);
        const noise = new Float32Array((W / 6 + 2) * (H / 6 + 2)).map(() => rnd());
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const u = x / (W - 1), v = y / (H - 1);
          let val = 0;
          if (kind === 'wipe-right') val = u;
          else if (kind === 'wipe-left') val = 1 - u;
          else if (kind === 'wipe-down') val = v;
          else if (kind === 'circle') val = Math.min(1, Math.hypot((u - 0.5) * 1.78, v - 0.5) / 1.02);
          else if (kind === 'diamond') val = Math.min(1, (Math.abs(u - 0.5) * 1.78 + Math.abs(v - 0.5)) / 1.39);
          else if (kind === 'blinds') val = ((u * 8) % 1) * 0.9 + u * 0.1;
          else if (kind === 'clock') val = ((Math.atan2(u - 0.5, -(v - 0.5)) / (2 * Math.PI)) + 1) % 1;
          else if (kind === 'noise') { const nx = Math.floor(x / 6), ny = Math.floor(y / 6); val = noise[ny * (W / 6 + 2) + nx]; }
          else if (kind === 'splatter') { let m = 1; for (const [bx, by, br, bt] of blobs) { const dd = Math.hypot(x - bx, y - by) / br; if (dd < 1) m = Math.min(m, bt * 0.6 + dd * 0.4); } val = m; }
          a[y * W + x] = val;
        }
        res({ a, W, H });
      });
      return Fx._maskCache[key];
    },
    async maskReveal(node, kind, assetId, dur, soft) {
      const m = await Fx.maskData(kind, assetId);
      const c = document.createElement('canvas'); c.width = m.W; c.height = m.H;
      const g = c.getContext('2d');
      const img = g.createImageData(m.W, m.H);
      const s = Math.max(0.02, soft != null ? soft : 0.12);
      const t0 = performance.now();
      return new Promise((done) => {
        const frame = (now) => {
          const p = Math.min(1, (now - t0) / ((dur || 1) * 1000));
          const lim = p * (1 + s);
          for (let i = 0; i < m.a.length; i++) { const al = Math.max(0, Math.min(1, (lim - m.a[i]) / s)); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = al * 255; }
          g.putImageData(img, 0, 0);
          const url = `url("${c.toDataURL()}")`;
          node.style.webkitMaskImage = url; node.style.maskImage = url;
          node.style.webkitMaskSize = '100% 100%'; node.style.maskSize = '100% 100%';
          if (p < 1 && node.isConnected) requestAnimationFrame(frame);
          else { node.style.webkitMaskImage = ''; node.style.maskImage = ''; done(); }
        };
        requestAnimationFrame(frame);
      });
    },

    // ---------- Text-Effekte ----------
    // {shake}…{/shake} {wave} {glow} {b} {i} {big} {small} {color=#f00} {slow} {fast} {pause=0.5}
    TAGS: ['shake', 'wave', 'glow', 'b', 'i', 'big', 'small', 'color', 'slow', 'fast'],
    plain(text) { return String(text || '').replace(/\{\/?(shake|wave|glow|b|i|big|small|slow|fast)\}|\{color=[^}]*\}|\{\/color\}|\{pause=[\d.]+\}/g, ''); },
    parse(text) {
      const out = [];
      const st = { shake: 0, wave: 0, glow: 0, b: 0, i: 0, big: 0, small: 0, slow: 0, fast: 0, color: [] };
      const re = /\{(\/?)(shake|wave|glow|b|i|big|small|slow|fast)\}|\{color=([^}]*)\}|\{\/color\}|\{pause=([\d.]+)\}/g;
      let last = 0, m, pause = 0;
      const push = (s) => {
        for (const ch of s) {
          out.push({ ch, shake: st.shake > 0, wave: st.wave > 0, glow: st.glow > 0, b: st.b > 0, i: st.i > 0, big: st.big > 0, small: st.small > 0, color: st.color[st.color.length - 1] || null, speed: st.slow > 0 ? 0.35 : st.fast > 0 ? 3 : 1, pause });
          pause = 0;
        }
      };
      const t = String(text || '');
      while ((m = re.exec(t))) {
        push(t.slice(last, m.index));
        if (m[2]) st[m[2]] += m[1] ? -1 : 1;
        else if (m[3] != null) st.color.push(m[3]);
        else if (m[0] === '{/color}') st.color.pop();
        else if (m[4]) pause += Number(m[4]);
        last = re.lastIndex;
      }
      push(t.slice(last));
      return out;
    },
    hasFx(tokens) { return tokens.some((c) => c.shake || c.wave || c.glow || c.b || c.i || c.big || c.small || c.color); },
    charEl(c, idx) {
      if (c.ch === '\n') return document.createElement('br');
      const cls = ['tch'];
      for (const k of ['shake', 'wave', 'glow', 'b', 'i', 'big', 'small']) if (c[k]) cls.push('t-' + k);
      const s = el('span', { class: cls.join(' ') }, c.ch === ' ' ? ' ' : c.ch);
      if (c.color) s.style.color = c.color;
      if (c.glow) s.style.textShadow = `0 0 0.8cqh ${c.color || 'currentColor'}, 0 0 1.6cqh ${c.color || 'currentColor'}`;
      if (c.shake || c.wave) s.style.animationDelay = (-(idx * 0.07)).toFixed(2) + 's';
      return s;
    },
    renderText(node, text) {
      node.textContent = '';
      const tokens = Fx.parse(text);
      if (!Fx.hasFx(tokens)) { node.textContent = tokens.map((t) => t.ch).join(''); return tokens; }
      tokens.forEach((c, i) => node.appendChild(Fx.charEl(c, i)));
      return tokens;
    },

    // ---------- Audio: Stimm-Filter, Lippensync, Ducking ----------
    VOICE_FX: [['', 'Keiner'], ['phone', 'Telefon'], ['radio', 'Funkgerät'], ['megaphone', 'Megafon'], ['hall', 'Raumhall'], ['cave', 'Höhle'], ['whisper', 'Flüstern'], ['thought', 'Gedankenstimme']],
    ctx() {
      if (!Fx._ctx) { try { Fx._ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { Fx._ctx = null; } }
      if (Fx._ctx && Fx._ctx.state === 'suspended') Fx._ctx.resume().catch(() => {});
      return Fx._ctx;
    },
    impulse(ctx, sec, decay) {
      const len = Math.round(ctx.sampleRate * sec);
      const b = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
      return b;
    },
    curve(amount) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + amount) * x / (1 + amount * Math.abs(x)); } return c; },
    // Spielt eine Audio-Datei über die Web-Audio-Kette: Filter, Analyse (für Lippensync), Lautstärke
    route(audio, fxName, vol) {
      const ctx = Fx.ctx();
      if (!ctx) { audio.volume = vol; return null; }
      try {
        const src = ctx.createMediaElementSource(audio);
        audio.volume = 1;
        const gain = ctx.createGain(); gain.gain.value = vol;
        const an = ctx.createAnalyser(); an.fftSize = 512;
        let node = src;
        const chain = (n) => { node.connect(n); node = n; return n; };
        const bp = (lo, hi) => { const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = lo; chain(h); const l = ctx.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = hi; chain(l); };
        const dist = (a) => { const w = ctx.createWaveShaper(); w.curve = Fx.curve(a); chain(w); };
        const reverb = (sec, decay, wet) => {
          const dry = ctx.createGain(); dry.gain.value = 1 - wet * 0.5;
          const cv = ctx.createConvolver(); cv.buffer = Fx.impulse(ctx, sec, decay);
          const w = ctx.createGain(); w.gain.value = wet;
          const mix = ctx.createGain();
          node.connect(dry); dry.connect(mix); node.connect(cv); cv.connect(w); w.connect(mix); node = mix;
        };
        if (fxName === 'phone') { bp(380, 3200); dist(3); }
        else if (fxName === 'radio') { bp(600, 2600); dist(8); }
        else if (fxName === 'megaphone') { bp(700, 2200); dist(14); }
        else if (fxName === 'hall') reverb(1.4, 3, 0.35);
        else if (fxName === 'cave') reverb(3.2, 2.2, 0.6);
        else if (fxName === 'whisper') { const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = 900; chain(h); gain.gain.value = vol * 0.85; reverb(0.8, 4, 0.2); }
        else if (fxName === 'thought') { const l = ctx.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = 4200; chain(l); reverb(1.8, 2.5, 0.4); }
        node.connect(gain); gain.connect(an); an.connect(VN.Audio ? VN.Audio.bus(ctx) : ctx.destination); audio._vnSrc = src;
        return { an, gain, data: new Uint8Array(an.fftSize) };
      } catch (e) { console.warn('Audio-Kette', e); audio.volume = vol; return null; }
    },
    level(r) {
      if (!r || !r.an) return 0;
      r.an.getByteTimeDomainData(r.data);
      let s = 0;
      for (let i = 0; i < r.data.length; i++) { const v = (r.data[i] - 128) / 128; s += v * v; }
      return Math.min(1, Math.sqrt(s / r.data.length) * 4.5);
    },

    // ---------- Lippensync ----------
    mouthCfg(assetId) { const m = VN.project && VN.project.mouths && VN.project.mouths[assetId]; return m && m.on !== false && (m.rect || (m.mode === 'image' && m.image)) ? m : null; },
    attachMouth(charBox, clip) {
      const m = Fx.mouthCfg(clip.asset);
      if (!m) return null;
      const host = charBox.querySelector('.char-inner') || charBox;
      const canvas = charBox.querySelector('canvas');
      const layer = el('div', { class: 'mouth-layer' });
      if (canvas && window.Rig) {
        // Bones-Figur: Leinwand ist größer als das Bild (Rand), also umrechnen
        const P = Rig.PAD != null ? Rig.PAD : 0.15;
        layer.style.inset = 'auto';
        Object.assign(layer.style, { left: '50%', bottom: canvas.style.bottom || '0', height: canvas.style.height || '100%', transform: 'translateX(-50%)', width: 'auto' });
        const im = new Image();
        im.onload = () => { layer.style.aspectRatio = String(im.naturalWidth / im.naturalHeight); };
        im.src = VN.assetUrl(clip.asset);
        layer.dataset.pad = P;
      }
      let mouth = null, img = null;
      if (m.mode === 'image' && m.image) {
        img = el('img', { class: 'mouth-img', src: VN.assetUrl(m.image), draggable: 'false' });
        if (clip.flip) img.style.transform = 'scaleX(-1)';
        layer.appendChild(img);
      } else if (m.rect) {
        const r = m.rect;
        const map = (v) => (layer.dataset.pad ? (Number(layer.dataset.pad) + v) / (1 + 2 * Number(layer.dataset.pad)) : v) * 100;
        const fx = clip.flip ? 1 - r.x - r.w : r.x;
        mouth = el('div', { class: 'mouth', style: { left: map(fx) + '%', top: map(r.y) + '%', width: (map(fx + r.w) - map(fx)) + '%', height: (map(r.y + r.h) - map(r.y)) + '%', background: m.color || '#3a1418' } });
        if (m.lip) mouth.style.boxShadow = `0 0 0 0.25cqh ${m.lip}`;
        layer.appendChild(mouth);
      }
      host.appendChild(layer);
      return { set: (v) => { if (mouth) mouth.style.transform = `scaleY(${Math.max(0.0, Math.min(1, v)).toFixed(2)})`; if (img) img.style.opacity = v > 0.28 ? '1' : '0'; } };
    },

    // ---------- Handy-Chat ----------
    phoneEl(lines, opts = {}) {
      const p = VN.project;
      const me = String((p.chat && p.chat.me) || '').trim().toLowerCase();
      const other = lines.find((l) => (l.speaker || '').trim().toLowerCase() !== me);
      const box = el('div', { class: 'phone' + (opts.live ? ' live' : '') },
        el('div', { class: 'ph-notch' }),
        el('div', { class: 'ph-head' }, el('span', { class: 'ph-ava' }, (other && other.speaker ? other.speaker[0] : '?').toUpperCase()), el('strong', null, other ? (opts.tr ? opts.tr(other) : other.speaker) || 'Unbekannt' : (p.chat && p.chat.title) || 'Nachrichten')),
        el('div', { class: 'ph-msgs' }));
      const list = box.querySelector('.ph-msgs');
      for (const l of lines) {
        const mine = (l.speaker || '').trim().toLowerCase() === me && me;
        const b = el('div', { class: 'ph-msg' + (mine ? ' me' : '') });
        Fx.renderText(b, opts.text ? opts.text(l) : l.text);
        list.appendChild(b);
      }
      return box;
    },
    // Zusammenhängende Chat-Zeilen bis zu diesem Schritt
    chatRun(scene, beat) {
      const ds = [...scene.tracks.dialog].sort((a, b) => a.start - b.start).filter((d) => d.start <= beat);
      const run = [];
      for (let i = ds.length - 1; i >= 0; i--) {
        if (!ds[i].chat) break;
        if (run.length && ds[i].start !== run[0].start - 1 && ds[i].start < run[0].start - 1) break;
        run.unshift(ds[i]);
      }
      return run;
    },

    // ---------- Glossar ----------
    glossaryMatch(text) {
      const g = (VN.project && VN.project.glossary) || [];
      const hits = [];
      for (const e of g) for (const term of [e.term, ...String(e.alt || '').split(',')].map((s) => s && s.trim()).filter(Boolean)) {
        const re = new RegExp('(^|[^\\p{L}])(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?=$|[^\\p{L}])', 'giu');
        let m; while ((m = re.exec(text))) hits.push({ start: m.index + m[1].length, end: m.index + m[1].length + m[2].length, e });
      }
      return hits.sort((a, b) => a.start - b.start).filter((h, i, arr) => !i || h.start >= arr[i - 1].end);
    },
    // Begriffe in einem fertigen Textknoten markieren (nur reine Textknoten)
    markGlossary(node, onClick) {
      const text = node.textContent;
      const hits = Fx.glossaryMatch(text);
      if (!hits.length) return [];
      if (node.querySelector('.tch')) {
        const spans = Array.from(node.querySelectorAll('.tch'));
        for (const h of hits) for (let i = h.start; i < h.end && i < spans.length; i++) { spans[i].classList.add('gl-term'); spans[i].onclick = (e) => { e.stopPropagation(); onClick(h.e); }; }
        return hits.map((h) => h.e);
      }
      node.textContent = '';
      let pos = 0;
      for (const h of hits) {
        node.append(text.slice(pos, h.start));
        node.appendChild(el('span', { class: 'gl-term', onclick: (e) => { e.stopPropagation(); onClick(h.e); } }, text.slice(h.start, h.end)));
        pos = h.end;
      }
      node.append(text.slice(pos));
      return hits.map((h) => h.e);
    },

    // Sprecher-Erkennung: gehört dieser Figuren-Clip zum Sprecher?
    isSpeaker(clip, speaker) {
      const n = String(speaker || '').trim().toLowerCase();
      if (!n || !clip) return false;
      const a = VN.asset(clip.asset);
      const set = clip.set && VN.project.figures ? VN.project.figures.find((f) => f.id === clip.set) : null;
      const nm = String(clip.name || (set ? set.name : '') || (a ? a.name : '')).toLowerCase();
      return !!nm && (nm === n || nm.includes(n) || n.includes(nm));
    },

    // Dauer von Audio-Dateien (für „Text synchron zur Stimme“)
    _dur: {},
    audioDur(assetId) {
      if (Fx._dur[assetId] != null) return Fx._dur[assetId];
      Fx._dur[assetId] = 0;
      const a = new Audio(); a.preload = 'metadata';
      a.onloadedmetadata = () => { Fx._dur[assetId] = a.duration || 0; };
      a.src = VN.assetUrl(assetId);
      return 0;
    }
  });
})();
