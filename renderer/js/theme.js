// Design-Laufzeit: Projekt-Theme, Sprechblasen-Vorlagen, Schriften, UI-Sounds, Mauszeiger
// (wird auch im exportierten Spiel benutzt)
(function () {
  const { el } = VN;

  // Spiel-Auflösung und Export-Einstellungen (auch im exportierten Spiel gebraucht)
  VN.EXPORT_BASE = { target: 'win', fit: 'letterbox', start: 'window', resizable: true, img: 'original', imgQ: 85, downscale: true, audio: 'original', audioKbps: 96, version: '1.0', icon: '', studio: '', skipUnused: true };
  VN.res = () => { const r = VN.project && VN.project.resolution; return { w: (r && r.w) || 1920, h: (r && r.h) || 1080 }; };
  VN.aspect = () => { const r = VN.res(); return r.w / r.h; };
  VN.exportOpts = () => Object.assign({}, VN.EXPORT_BASE, (VN.project && VN.project.export) || {});

  VN.hexA = (hex, a) => {
    let h = String(hex || '#000000').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16) || 0;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a != null ? a : 1})`;
  };

  // ---------- Eingebaute Rahmen (SVG, als 9-Slice nutzbar) ----------
  const svgUrl = (s) => 'data:image/svg+xml;utf8,' + encodeURIComponent(s);
  const jag = (seed) => {
    // gezackte Kante entlang eines Rechtecks (120 × 120), deterministisch
    let a = seed;
    const r = () => { a = (a * 9301 + 49297) % 233280; return a / 233280; };
    const pts = [];
    const m = 6, s = 120 - m;
    const edge = (x1, y1, x2, y2, nx, ny) => {
      for (let i = 0; i < 12; i++) {
        const t = i / 12;
        const d = (r() - 0.35) * 5;
        pts.push([(x1 + (x2 - x1) * t + nx * d).toFixed(1), (y1 + (y2 - y1) * t + ny * d).toFixed(1)]);
      }
    };
    edge(m, m, s, m, 0, -1); edge(s, m, s, s, 1, 0); edge(s, s, m, s, 0, 1); edge(m, s, m, m, -1, 0);
    return pts.map((p) => p.join(',')).join(' ');
  };
  const BUILTIN_FRAMES = {
    cracked: {
      label: 'Rissig (düster)',
      src: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><defs><radialGradient id="g" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#1c0809"/><stop offset="1" stop-color="#070203"/></radialGradient></defs><polygon points="${jag(7)}" fill="url(#g)" stroke="#6a1414" stroke-width="2.4"/><polygon points="${jag(31)}" fill="none" stroke="#2c0606" stroke-width="1.2" transform="translate(60 60) scale(0.9) translate(-60 -60)"/><path d="M8 30 l9 4 l-4 7 M112 84 l-10 3 l3 8 M40 113 l3 -8 l6 3 M86 7 l-2 9 l7 2" stroke="#7a1a16" stroke-width="1.4" fill="none"/></svg>`),
      slice: [25, 25, 25, 25], width: 2.6, mode: 'round'
    },
    parchment: {
      label: 'Pergament',
      src: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><defs><radialGradient id="p" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#f1e5c4"/><stop offset="0.75" stop-color="#e3d1a2"/><stop offset="1" stop-color="#c9ad74"/></radialGradient></defs><polygon points="${jag(13)}" fill="url(#p)" stroke="#a9874e" stroke-width="1.2"/><rect x="14" y="14" width="92" height="92" fill="none" stroke="#7a5428" stroke-width="1" stroke-dasharray="1 2.5"/><g fill="none" stroke="#6b3a12" stroke-width="1.6" stroke-linecap="round"><path d="M11 26 C11 16 16 11 26 11 M18 11 c-4 2 -6 5 -7 9"/><path d="M109 26 C109 16 104 11 94 11 M102 11 c4 2 6 5 7 9"/><path d="M11 94 C11 104 16 109 26 109 M18 109 c-4 -2 -6 -5 -7 -9"/><path d="M109 94 C109 104 104 109 94 109 M102 109 c4 -2 6 -5 7 -9"/></g><g fill="#6b3a12"><circle cx="20" cy="20" r="2"/><circle cx="100" cy="20" r="2"/><circle cx="20" cy="100" r="2"/><circle cx="100" cy="100" r="2"/></g></svg>`),
      slice: [28, 28, 28, 28], width: 2.8, mode: 'stretch'
    }
  };

  // ---------- Schriften ----------
  const FONTS = [
    ['sans', 'Segoe UI (Standard)', '"Segoe UI", Inter, system-ui, sans-serif'],
    ['serif', 'Georgia', 'Georgia, "Times New Roman", serif'],
    ['palatino', 'Palatino', '"Palatino Linotype", Palatino, "Book Antiqua", serif'],
    ['trebuchet', 'Trebuchet', '"Trebuchet MS", sans-serif'],
    ['comic', 'Comic', '"Comic Sans MS", "Comic Neue", "Trebuchet MS", sans-serif'],
    ['mono', 'Courier', '"Courier New", monospace'],
    ['impact', 'Impact', 'Impact, "Arial Black", sans-serif']
  ];

  // ---------- Sprechblasen-Vorlagen ----------
  const BUBBLE_BASE = {
    bg: '#0e0e14', alpha: 86, border: '#2f2f37', borderW: 0.15, radius: 1.6, text: '#ffffff', nameBg: '', nameText: '', arrow: '#e8a43a',
    font: 'sans', size: 3.6, lineH: 1.45, align: 'left', pad: 2.4, glow: false, shadow: 'none', tail: false, italic: false,
    frame: '', slice: [25, 25, 25, 25], frameW: 2.4, frameMode: 'stretch', nameFrame: '', arrowImg: '', minH: 24
  };
  const PRESETS = {
    hell: { label: 'Hell', bg: '#f7f5f0', alpha: 96, border: '#d6cfbf', borderW: 0.25, radius: 2, text: '#1d1b18', nameBg: '#e8a43a', nameText: '#1d1404', arrow: '#b07a1e', shadow: 'soft' },
    dunkel: { label: 'Dunkel' },
    duester: { label: 'Düster', bg: '#140607', alpha: 94, text: '#ead8d2', nameText: '#d24a3a', arrow: '#b02a20', font: 'serif', frame: 'builtin:cracked', slice: [25, 25, 25, 25], frameW: 2.6, frameMode: 'round', shadow: 'inner', radius: 0 },
    pergament: { label: 'Pergament', bg: '#e9dcb8', alpha: 100, text: '#3b2a17', nameText: '#6b3a12', arrow: '#6b3a12', font: 'palatino', frame: 'builtin:parchment', slice: [28, 28, 28, 28], frameW: 2.8, frameMode: 'stretch', shadow: 'soft', radius: 0 },
    comic: { label: 'Comic', bg: '#ffffff', alpha: 100, border: '#111111', borderW: 0.55, radius: 4, text: '#111111', nameBg: '#ffd43b', nameText: '#111111', arrow: '#111111', font: 'comic', tail: true, shadow: 'hard' },
    neon: { label: 'Neon', bg: '#07070f', alpha: 88, border: '#3ef0ff', borderW: 0.25, radius: 1.2, text: '#e8fbff', nameText: '#ff4fd8', arrow: '#3ef0ff', glow: true }
  };

  const CHOICE_BASE = {
    layout: 'list', width: 46, gap: 1.6, y: 42, bg: '#14141c', alpha: 92, text: '#ffffff', border: '#e8a43a', borderW: 0.15, radius: 1.4, size: 3.4, font: '',
    hoverBg: '#e8a43a', hoverText: '#1d1404', img: '', imgHover: '', imgDown: '', imgLocked: '', slice: 30, frameW: 2, anim: 'none'
  };
  const SYS_BASE = {
    bg: '#121118', alpha: 96, border: '#e8a43a', text: '#f0ece4', accent: '#e8a43a', accentText: '#1d1404', font: '', titleFont: 'serif', radius: 2,
    dim: 55, frame: '', slice: 25, frameW: 2.4, screenBg: '', bgPause: '', bgSave: '', bgSettings: ''
  };
  const GAIN_BASE = { bg: '#1e1812', alpha: 95, border: '#e8c86a', text: '#ffffff', title: '#e8c86a', pos: 'top', anim: 'pop', hud: 'left', frame: '', slice: 25, frameW: 2 };

  const Theme = (window.Theme = {
    FONTS, PRESETS, BUBBLE_BASE, BUILTIN_FRAMES, CHOICE_BASE, SYS_BASE, GAIN_BASE,

    ensure(p) {
      p.theme = Object.assign({ bubble: { preset: 'dunkel' }, speakers: {}, choice: {}, sys: {}, gain: {}, sounds: {}, cursor: {}, fonts: {}, logo: {}, presets: [] }, p.theme || {});
      for (const k of ['speakers', 'choice', 'sys', 'gain', 'sounds', 'cursor', 'fonts', 'logo']) p.theme[k] = p.theme[k] || {};
      p.theme.bubble = p.theme.bubble || { preset: 'dunkel' };
      p.theme.presets = p.theme.presets || [];
      // Ältere Projekte: Menü-Schrift als CSS-Text → Schlüssel
      const m = p.mainMenu;
      if (m && m.titleFont && !FONTS.some((f) => f[0] === m.titleFont) && !String(m.titleFont).startsWith('asset:')) {
        const first = String(m.titleFont).split(',')[0].replace(/"/g, '').trim().toLowerCase();
        const f = FONTS.find((x) => x[2].split(',')[0].replace(/"/g, '').trim().toLowerCase() === first);
        if (f) m.titleFont = f[0];
      }
      return p.theme;
    },
    t() { return Theme.ensure(VN.project); },

    // ---------- Schriften ----------
    fontOptions(withDefault) {
      const out = withDefault ? [['', withDefault]] : [];
      for (const [k, l] of FONTS) out.push([k, l]);
      for (const a of VN.project ? VN.assetsOf('font') : []) out.push(['asset:' + a.id, a.name + ' (eigene)']);
      return out;
    },
    fontCss(key) {
      if (!key) return '';
      if (key.startsWith('asset:')) return `"vnf_${key.slice(6)}", "Segoe UI", sans-serif`;
      const f = FONTS.find((x) => x[0] === key);
      if (f) return f[2];
      return key; // ältere Projekte: CSS-Schrift direkt gespeichert
    },
    _loaded: {},
    loadFonts() {
      if (!VN.project || typeof FontFace === 'undefined') return;
      for (const a of VN.assetsOf('font')) {
        const key = a.id + '|' + a.file;
        if (Theme._loaded[key]) continue;
        Theme._loaded[key] = true;
        try {
          const f = new FontFace('vnf_' + a.id, `url("${VN.assetUrl(a.id)}")`);
          f.load().then((ff) => { document.fonts.add(ff); }).catch((e) => console.warn('Schrift konnte nicht geladen werden: ' + a.name, e));
        } catch (e) { console.warn(e); }
      }
    },

    // Quelle eines Bildes (Projektdatei oder eingebauter Rahmen)
    src(ref) {
      if (!ref) return '';
      if (ref.startsWith('builtin:')) { const f = BUILTIN_FRAMES[ref.slice(8)]; return f ? f.src : ''; }
      return VN.assetUrl(ref);
    },
    cssUrl(ref) { const s = Theme.src(ref); return s ? `url("${s}")` : ''; },

    // ---------- Sprechblasen ----------
    preset(id) {
      const t = VN.project ? Theme.t() : { presets: [] };
      if (PRESETS[id]) return Object.assign({}, BUBBLE_BASE, PRESETS[id], { preset: id });
      const c = (t.presets || []).find((x) => x.id === id);
      if (c) return Object.assign({}, Theme.preset(c.data.preset && c.data.preset !== id ? c.data.preset : 'dunkel'), c.data, { preset: id });
      return Object.assign({}, BUBBLE_BASE, { preset: 'dunkel' });
    },
    presetList() {
      const out = Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label, builtin: true }));
      for (const c of Theme.t().presets) out.push({ id: c.id, label: c.name, builtin: false });
      return out;
    },
    // Schichten: Projekt → Sprecher → einzelne Zeile
    layers(speaker, clip, upto) {
      const t = Theme.t();
      const L = [t.bubble];
      if (upto === 'theme') return L;
      const sp = speaker ? t.speakers[String(speaker).trim()] : null;
      if (sp) L.push(sp);
      if (upto === 'speaker') return L;
      if (clip && clip.bubble) L.push(clip.bubble);
      return L;
    },
    resolve(layers) {
      let cur = Theme.preset('dunkel');
      for (const L of layers) {
        if (!L) continue;
        if (L.preset && L.preset !== cur.preset) cur = Theme.preset(L.preset);
        for (const [k, v] of Object.entries(L)) if (k !== 'preset' && v !== undefined && v !== null) cur[k] = v;
      }
      return cur;
    },
    bubble(speaker, clip) { return Theme.resolve(Theme.layers(speaker, clip)); },

    // Stil auf eine Dialogbox anwenden
    styleBubble(box, B, o = {}) {
      const s = box.style;
      const frame = B.frame ? Theme.src(B.frame) : '';
      const pad = Number(B.pad != null ? B.pad : 2.4);
      if (frame) {
        const sl = (B.slice || [25, 25, 25, 25]).map((v) => v + '%').join(' ');
        s.background = 'transparent';
        s.borderStyle = 'solid';
        s.borderWidth = (B.frameW || 2.4) + 'cqh';
        s.borderImage = `url("${frame}") ${sl} fill / ${B.frameW || 2.4}cqh ${B.frameMode === 'round' ? 'round' : B.frameMode === 'repeat' ? 'repeat' : 'stretch'}`;
        s.borderRadius = '0';
        s.padding = Math.max(0.4, pad - (B.frameW || 2.4) * 0.5) + 'cqh ' + Math.max(0.6, pad * 1.25 - (B.frameW || 2.4) * 0.5) + 'cqh';
      } else {
        s.background = VN.hexA(B.bg, (B.alpha != null ? B.alpha : 86) / 100);
        s.border = (B.borderW != null ? B.borderW : 0.15) + 'cqh solid ' + (B.border || 'transparent');
        s.borderImage = 'none';
        s.borderRadius = (B.radius != null ? B.radius : 1.6) + 'cqh';
        s.padding = pad + 'cqh ' + (pad * 1.25) + 'cqh';
      }
      s.minHeight = (B.minH || 24) + '%';
      const sh = [];
      if (B.glow) sh.push(`0 0 2.2cqh ${VN.hexA(B.border, 0.8)}`, `inset 0 0 1.4cqh ${VN.hexA(B.border, 0.45)}`);
      if (B.shadow === 'soft') sh.push('0 1cqh 3cqh rgba(0,0,0,0.45)');
      if (B.shadow === 'hard') sh.push('0.8cqh 0.8cqh 0 rgba(0,0,0,0.85)');
      if (B.shadow === 'inner') sh.push('inset 0 0 3.4cqh rgba(110,0,0,0.55)');
      s.boxShadow = sh.join(', ');
      s.fontFamily = Theme.fontCss(B.font) || '';
      s.color = B.text || '#fff';
      const nameEl = box.querySelector('.dlg-name');
      const textEl = box.querySelector('.dlg-text');
      if (textEl) {
        const ts = window.Player && Player.running && VN.settings && VN.settings.textScale ? VN.settings.textScale / 100 : 1;
        textEl.style.fontSize = (B.size || 3.6) * ts + 'cqh';
        textEl.style.lineHeight = String(B.lineH || 1.45);
        textEl.style.textAlign = B.align || 'left';
        textEl.style.fontStyle = B.italic ? 'italic' : '';
        if (B.glow) textEl.style.textShadow = `0 0 1cqh ${VN.hexA(B.text, 0.5)}`;
      }
      if (nameEl) {
        const nf = Theme.t().fonts.name;
        nameEl.style.fontFamily = Theme.fontCss(nf) || '';
        nameEl.style.color = B.nameText || o.speakerColor || '#fff';
        nameEl.style.fontSize = Math.max(2, (B.size || 3.6) * 0.94) * (window.Player && Player.running && VN.settings && VN.settings.textScale ? VN.settings.textScale / 100 : 1) + 'cqh';
        if (B.nameBg || B.nameFrame) {
          nameEl.classList.add('plate');
          if (B.nameFrame) {
            nameEl.style.background = 'transparent';
            nameEl.style.borderStyle = 'solid';
            nameEl.style.borderWidth = '1.2cqh';
            nameEl.style.borderImage = `url("${Theme.src(B.nameFrame)}") 30% fill / 1.2cqh stretch`;
          } else {
            nameEl.style.background = B.nameBg;
            nameEl.style.borderRadius = Math.min(1.2, (B.radius || 1) * 0.8) + 'cqh';
          }
        }
        if (B.glow) nameEl.style.textShadow = `0 0 1.2cqh ${VN.hexA(B.nameText || o.speakerColor || '#fff', 0.8)}`;
      }
      const next = box.querySelector('.dlg-next');
      if (next) Theme.styleArrow(next, B);
      if (B.tail && o.tailX != null) {
        const tail = el('div', { class: 'dlg-tail' });
        tail.style.left = Math.max(8, Math.min(92, o.tailX)) + '%';
        tail.style.background = frame ? VN.hexA(B.bg, 1) : VN.hexA(B.bg, (B.alpha != null ? B.alpha : 86) / 100);
        tail.style.borderColor = B.border || 'transparent';
        tail.style.borderWidth = (B.borderW != null ? B.borderW : 0.15) + 'cqh';
        box.appendChild(tail);
      }
      return box;
    },
    styleArrow(next, B) {
      next.style.color = B.arrow || 'var(--accent)';
      if (B.arrowImg && Theme.src(B.arrowImg)) {
        next.textContent = '';
        next.appendChild(el('img', { src: Theme.src(B.arrowImg), draggable: 'false', style: { height: '3.4cqh', display: 'block' } }));
      }
    },

    // ---------- Auswahl-Buttons ----------
    choice(clip) { return Object.assign({}, CHOICE_BASE, Theme.t().choice, (clip && clip.look) || {}); },
    styleChoices(box, C) {
      const s = box.style;
      s.width = C.width + '%';
      s.top = C.y + '%';
      s.gap = C.gap + 'cqh';
      box.classList.toggle('grid', C.layout === 'grid');
      box.classList.toggle('row3', C.layout === 'row');
      box.classList.add('themed', 'anim-' + (C.anim || 'none'));
      const v = (k, val) => s.setProperty(k, val);
      v('--ch-bg', VN.hexA(C.bg, C.alpha / 100));
      v('--ch-text', C.text);
      v('--ch-border', C.border);
      v('--ch-bw', C.borderW + 'cqh');
      v('--ch-radius', C.radius + 'cqh');
      v('--ch-size', C.size + 'cqh');
      v('--ch-font', Theme.fontCss(C.font) || 'inherit');
      v('--ch-hbg', C.hoverBg);
      v('--ch-htext', C.hoverText);
      if (C.img && Theme.src(C.img)) {
        box.classList.add('img');
        v('--ch-img', Theme.cssUrl(C.img));
        v('--ch-img-h', Theme.cssUrl(C.imgHover || C.img));
        v('--ch-img-d', Theme.cssUrl(C.imgDown || C.imgHover || C.img));
        v('--ch-img-l', Theme.cssUrl(C.imgLocked || C.img));
        v('--ch-slice', C.slice + '%');
        v('--ch-fw', C.frameW + 'cqh');
      }
      Array.from(box.children).forEach((b, i) => b.style.setProperty('--i', i));
      return box;
    },

    // ---------- Systemfenster ----------
    sys() { return Object.assign({}, SYS_BASE, Theme.t().sys); },
    styleSys(overlay, panel, kind) {
      const S = Theme.sys();
      const o = overlay.style;
      const bgRef = (kind === 'pause' && S.bgPause) || (kind === 'save' && S.bgSave) || (kind === 'settings' && S.bgSettings) || S.screenBg;
      o.background = `rgba(0,0,0,${S.dim / 100})`;
      if (bgRef && Theme.src(bgRef)) o.background = `linear-gradient(rgba(0,0,0,${S.dim / 100}), rgba(0,0,0,${S.dim / 100})), ${Theme.cssUrl(bgRef)} center / cover no-repeat`;
      const v = (k, val) => overlay.style.setProperty(k, val);
      v('--sys-bg', VN.hexA(S.bg, S.alpha / 100));
      v('--sys-border', VN.hexA(S.border, 0.55));
      v('--sys-text', S.text);
      v('--sys-accent', S.accent);
      v('--sys-acc-ink', S.accentText);
      v('--sys-font', Theme.fontCss(S.font || Theme.t().fonts.ui) || 'inherit');
      v('--sys-tfont', Theme.fontCss(S.titleFont) || 'Georgia, serif');
      v('--sys-radius', S.radius + 'cqh');
      if (panel && S.frame && Theme.src(S.frame)) {
        panel.style.background = 'transparent';
        panel.style.borderStyle = 'solid';
        panel.style.borderWidth = S.frameW + 'cqh';
        panel.style.borderImage = `${Theme.cssUrl(S.frame)} ${S.slice}% fill / ${S.frameW}cqh stretch`;
      }
    },

    // ---------- Fundmeldung ----------
    gain() { return Object.assign({}, GAIN_BASE, Theme.t().gain); },
    styleGain(wrap, box) {
      const G = Theme.gain();
      wrap.className = 'pl-gainbox pos-' + G.pos + ' anim-' + G.anim;
      const s = box.style;
      if (G.frame && Theme.src(G.frame)) {
        s.background = 'transparent'; s.borderStyle = 'solid'; s.borderWidth = G.frameW + 'cqh';
        s.borderImage = `${Theme.cssUrl(G.frame)} ${G.slice}% fill / ${G.frameW}cqh stretch`;
        s.boxShadow = 'none';
      } else {
        s.background = VN.hexA(G.bg, G.alpha / 100);
        s.borderColor = G.border;
        s.boxShadow = `0 0 2.4cqh ${VN.hexA(G.border, 0.35)}`;
      }
      s.color = G.text;
      const t = box.querySelector('.pl-gain-title');
      if (t) t.style.color = G.title;
    },

    // ---------- UI-Sounds ----------
    SOUND_KEYS: [['click', 'Klick (Buttons)'], ['hover', 'Maus darüber'], ['next', 'Weiter (Dialog)'], ['open', 'Menü öffnen'], ['close', 'Menü schließen'], ['save', 'Speichern'], ['item', 'Gegenstand erhalten']],
    _lastHover: 0,
    sound(kind) {
      if (!VN.project) return;
      const t = Theme.t();
      const id = t.sounds[kind];
      if (!id) return;
      if (kind === 'hover') { const now = performance.now(); if (now - Theme._lastHover < 70) return; Theme._lastHover = now; }
      const url = VN.assetUrl(id);
      if (!url) return;
      const a = new Audio(url);
      a._cat = 'ui';
      a.volume = Math.max(0, Math.min(1, (t.sounds.vol != null ? t.sounds.vol : 80) / 100));
      a.play().catch(() => {});
    },

    // ---------- Mauszeiger ----------
    cursor(kind, fallback) {
      const c = Theme.t().cursor;
      const id = c[kind] || (kind !== 'normal' ? null : null);
      if (!id || !VN.assetUrl(id)) return fallback || '';
      return `url("${VN.assetUrl(id)}") ${c.hx || 0} ${c.hy || 0}, ${fallback || 'auto'}`;
    },

    // Pflicht-Logo der Engine (Startbildschirm)
    engineLogo() {
      return el('div', { class: 'engine-logo' },
        el('div', { class: 'el-mark', html: '<svg viewBox="0 0 24 24" fill="none" stroke="#1d1404" stroke-width="2.4" stroke-linecap="round"><path d="M3 7h18M3 12h12M3 17h7"/></svg>' }),
        el('div', { class: 'el-txt' }, el('div', { class: 'el-small' }, 'Erstellt mit'), el('div', { class: 'el-big' }, 'VN Timeline Engine')));
    },

    // Empfohlene Pixelgrößen anhand der Spiel-Auflösung
    res() { const r = VN.project && VN.project.resolution; return { w: (r && r.w) || 1920, h: (r && r.h) || 1080 }; },
    sizeHint(wPct, hPct) { const r = Theme.res(); return Math.round(r.w * wPct / 100) + ' × ' + Math.round(r.h * hPct / 100) + ' px'; }
  });
})();
