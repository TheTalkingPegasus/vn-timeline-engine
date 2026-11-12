// Design-Laufzeit: Projekt-Theme, Sprechblasen-Vorlagen, Schriften, UI-Sounds, Mauszeiger
// (wird auch im exportierten Spiel benutzt)
(function () {
  const { el } = VN;

  // Spiel-Auflösung und Export-Einstellungen (auch im exportierten Spiel gebraucht)
  VN.EXPORT_BASE = { target: 'win', fit: 'letterbox', start: 'window', resizable: true, img: 'original', imgQ: 85, downscale: true, audio: 'original', audioKbps: 96, version: '1.0', icon: '', studio: '', skipUnused: true };
  VN.res = () => { const r = VN.project && VN.project.resolution; return { w: (r && r.w) || 1920, h: (r && r.h) || 1080 }; };
  VN.aspect = () => { const r = VN.res(); return r.w / r.h; };
  VN.exportOpts = () => { const o = Object.assign({}, VN.EXPORT_BASE, (VN.project && VN.project.export) || {}); if (!o.scope) o.scope = 'slim'; if (o.scope === 'slim') o.skipUnused = true; return o; };

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

  // ---------- Freie Sprechblasen (0.9.35): mitgelieferte Formen ----------
  // tq = Textfläche, nq = Namensfeld: je 4 Ecken (oben links, oben rechts, unten rechts, unten links) in Bildbruchteilen
  const starPts = (() => {
    const out = [];
    for (let i = 0; i < 28; i++) {
      const a = i / 28 * Math.PI * 2, r = i % 2 ? 0.8 : 1 + (i % 4 === 0 ? 0.08 : 0);
      out.push((500 + Math.cos(a) * 470 * r * 0.98).toFixed(0) + ',' + (250 + Math.sin(a) * 220 * r * 0.98).toFixed(0));
    }
    return out.join(' ');
  })();
  const FREE_SHAPES = {
    slash: {
      label: 'Schräg (Persona-Stil)', w: 62,
      src: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="380" viewBox="0 0 1000 380"><polygon points="70,70 985,20 950,330 30,370" fill="#d8202a"/><polygon points="40,40 960,8 925,300 12,345" fill="#0a0a0c" stroke="#ffffff" stroke-width="10" stroke-linejoin="miter"/></svg>'),
      tq: [[0.09, 0.2], [0.89, 0.13], [0.86, 0.72], [0.07, 0.8]], nq: [[0.03, -0.1], [0.33, -0.17], [0.35, 0.06], [0.05, 0.12]], nameBg: '#ffffff', nameText: '#0a0a0c', text: '#ffffff'
    },
    tilt: {
      label: 'Gekippt (wird schmaler)', w: 64,
      src: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="380" viewBox="0 0 1000 380"><polygon points="14,14 986,92 986,288 14,366" fill="#101420" fill-opacity="0.92" stroke="#3ef0ff" stroke-width="8"/></svg>'),
      tq: [[0.05, 0.11], [0.95, 0.3], [0.95, 0.72], [0.05, 0.9]], nq: [[0.03, -0.08], [0.3, -0.03], [0.3, 0.1], [0.03, 0.06]], nameBg: '#3ef0ff', nameText: '#101420', text: '#e8fbff'
    },
    shout: {
      label: 'Ausruf (Zacken)', w: 46,
      src: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500" viewBox="0 0 1000 500"><polygon points="' + starPts + '" fill="#ffffff" stroke="#111111" stroke-width="12" stroke-linejoin="round"/></svg>'),
      tq: [[0.24, 0.3], [0.76, 0.3], [0.76, 0.7], [0.24, 0.7]], nq: [[0.3, 0.06], [0.7, 0.06], [0.7, 0.2], [0.3, 0.2]], nameBg: '#ffd43b', nameText: '#111111', text: '#111111'
    },
    round: {
      label: 'Comic rund mit Spitze', w: 50,
      src: svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="520" viewBox="0 0 1000 520"><path d="M500 22 C790 22 975 112 975 230 C975 348 790 438 500 438 C455 438 412 436 372 431 L210 505 L262 418 C110 388 25 316 25 230 C25 112 210 22 500 22 Z" fill="#ffffff" stroke="#111111" stroke-width="12"/></svg>'),
      tq: [[0.12, 0.17], [0.88, 0.17], [0.88, 0.72], [0.12, 0.72]], nq: [[0.08, -0.04], [0.36, -0.04], [0.36, 0.1], [0.08, 0.1]], nameBg: '#ffd43b', nameText: '#111111', text: '#111111'
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
    frame: '', slice: [25, 25, 25, 25], frameW: 2.4, frameMode: 'stretch', nameFrame: '', arrowImg: '', minH: 24,
    portrait: false, porShape: 'rounded', porRadius: 1.4, porSize: 16, porShadow: 0, porBorder: true, porSide: 'left',
    // Freie Blase (0.9.35): Bild unverzerrt, Text und Name in frei verzerrten Flächen
    free: false, freeImg: '', freeW: 60, freeX: 50, freeY: 76, freeFollow: false, freeFlip: false, fitText: true, vAlign: 'center',
    tq: [[0.1, 0.2], [0.9, 0.2], [0.9, 0.8], [0.1, 0.8]], nq: [[0.05, -0.12], [0.35, -0.12], [0.35, 0.06], [0.05, 0.06]], nameImg: '',
    // Text-Effekte (0.9.35)
    dots: false, dotsColor: '#000000', dotsSize: 55, dotsGap: 0.2, dotsDist: 0.16, dotsAng: 45, dotsWide: 0.06,
    edge: false, edgeColor: '#d8202a', edgeW: 0.08, edgeAng: 45, fxName: true,
    letters: '', letAmt: 1, letSpeed: 1, cap: false, capSize: 1.8, capColor: '#e8a43a', capFont: '', capDrop: false
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
    FONTS, PRESETS, BUBBLE_BASE, BUILTIN_FRAMES, FREE_SHAPES, CHOICE_BASE, SYS_BASE, GAIN_BASE,

    ensure(p) {
      p.theme = VN.fill(p.theme, { bubble: { preset: 'dunkel' }, speakers: {}, choice: {}, sys: {}, gain: {}, sounds: {}, cursor: {}, fonts: {}, logo: {}, presets: [] });
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
      if (ref.startsWith('builtin:')) { const f = BUILTIN_FRAMES[ref.slice(8)] || FREE_SHAPES[ref.slice(8)]; return f ? f.src : ''; }
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
      if (B.free) { Theme.styleFree(box, B, o); return box; }
      const s = box.style;
      const frame = B.frame ? Theme.src(B.frame) : '';
      const pad = Number(B.pad != null ? B.pad : 2.4);
      s.clipPath = ''; s.backgroundImage = ''; s.filter = '';
      if (frame && B.frameMode === 'fill') {
        // Bild füllt die Blase: Ecken, Rand und Form-Regler wirken wie bei einer Farbfläche
        s.background = `${VN.hexA(B.bg, (B.alpha != null ? B.alpha : 86) / 100)} url("${frame}") center / cover no-repeat`;
        s.border = (B.borderW != null ? B.borderW : 0.15) + 'cqh solid ' + (B.border || 'transparent');
        s.borderImage = 'none';
        s.borderRadius = (B.radius != null ? B.radius : 1.6) + 'cqh';
        s.padding = pad + 'cqh ' + (pad * 1.25) + 'cqh';
      } else if (frame) {
        const sl = (B.slice || [25, 25, 25, 25]).map((v) => v + '%').join(' ');
        s.background = 'transparent';
        s.borderStyle = 'solid';
        s.borderWidth = (B.frameW || 2.4) + 'cqh';
        s.borderImage = `url("${frame}") ${sl} fill / ${B.frameW || 2.4}cqh ${B.frameMode === 'round' ? 'round' : B.frameMode === 'repeat' ? 'repeat' : 'stretch'}`;
        s.borderRadius = '0';
        // Rahmenbilder (9-Slice) kennen keine abgerundeten Ecken – mit „Ecken“ > 0 wird die Blase rund zugeschnitten
        if (Number(B.radius) > 0 && !(B.tail && o.tailX != null)) s.clipPath = `inset(0 round ${B.radius}cqh)`;
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
      // Zugeschnittene Blasen: Schatten als Filter, sonst würde er mit abgeschnitten
      if (s.clipPath && sh.length) { s.boxShadow = ''; } else s.boxShadow = sh.join(', ');
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
      Theme.textFx(textEl, nameEl, B);
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
    // ---------- Freie Blase (0.9.35) ----------
    styleFree(box, B, o = {}) {
      const s = box.style;
      box.classList.add('free');
      Object.assign(s, { background: 'none', border: 'none', borderImage: 'none', boxShadow: '', padding: '0', borderRadius: '0', clipPath: '', minHeight: '0', filter: '' });
      const x = B.freeFollow && o.tailX != null ? Math.max(8, Math.min(92, o.tailX)) : Number(B.freeX != null ? B.freeX : 50);
      s.left = x + '%'; s.top = Number(B.freeY != null ? B.freeY : 76) + '%'; s.right = 'auto'; s.bottom = 'auto';
      s.width = Number(B.freeW || 60) + 'cqw';
      s.fontFamily = Theme.fontCss(B.font) || '';
      s.color = B.text || '#fff';
      const src = Theme.src(B.freeImg) || FREE_SHAPES.slash.src;
      const img = el('img', { class: 'free-img', src, draggable: 'false' });
      if (B.freeFlip) img.style.transform = 'scaleX(-1)';
      s.aspectRatio = String(Theme._ar[src] || 2.6);
      img.addEventListener('load', () => { const a = img.naturalWidth / img.naturalHeight; if (a > 0) { Theme._ar[src] = a; s.aspectRatio = String(a); Theme.fitFree(box); } });
      box.insertBefore(img, box.firstChild);
      const textEl = box.querySelector('.dlg-text'), nameEl = box.querySelector('.dlg-name');
      const tq = el('div', { class: 'free-q free-tq' + (B.vAlign === 'top' ? ' top' : '') });
      tq._quad = B.tq || BUBBLE_BASE.tq;
      if (textEl) {
        const ts = window.Player && Player.running && VN.settings && VN.settings.textScale ? VN.settings.textScale / 100 : 1;
        textEl._fs0 = (B.size || 3.6) * ts;
        Object.assign(textEl.style, { fontSize: textEl._fs0 + 'cqh', lineHeight: String(B.lineH || 1.45), textAlign: B.align || 'left', fontStyle: B.italic ? 'italic' : '' });
        tq.appendChild(textEl);
      }
      box.appendChild(tq);
      box._nextHost = tq;
      box._fit = B.fitText !== false;
      if (nameEl) {
        const nq = el('div', { class: 'free-q free-nq' });
        nq._quad = B.nq || BUBBLE_BASE.nq;
        if (B.nameImg && Theme.src(B.nameImg)) nq.style.background = `url("${Theme.src(B.nameImg)}") center / 100% 100% no-repeat`;
        else if (B.nameBg) nq.style.background = B.nameBg;
        nameEl.style.fontFamily = Theme.fontCss(Theme.t().fonts.name) || '';
        nameEl.style.color = B.nameText || o.speakerColor || '#fff';
        nameEl.style.fontSize = Math.max(2, (B.size || 3.6) * 0.94) + 'cqh';
        nq.appendChild(nameEl);
        box.appendChild(nq);
      }
      Theme.textFx(textEl, nameEl, B);
      if (box._ro) box._ro.disconnect();
      box._ro = new ResizeObserver(() => Theme.fitFree(box));
      box._ro.observe(box);
      return box;
    },
    _ar: {},
    // Ecken → CSS-Matrix: ein Rechteck w×h wird auf das Viereck P (Pixel) gelegt, mit Perspektive
    quadMatrix(w, h, P) {
      const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = P;
      const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
      let g = 0, hh = 0;
      const den = dx1 * dy2 - dx2 * dy1;
      if (Math.abs(den) > 1e-9 && (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9)) { g = (dx3 * dy2 - dx2 * dy3) / den; hh = (dx1 * dy3 - dx3 * dy1) / den; }
      let a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3;
      a /= w; d /= w; g /= w; b /= h; e /= h; hh /= h;
      return 'matrix3d(' + [a, d, 0, g, b, e, 0, hh, 0, 0, 1, 0, x0, y0, 0, 1].map((v) => +v.toFixed(8)).join(',') + ')';
    },
    // Flächen der freien Blase an die aktuelle Größe anpassen, Text bei Bedarf verkleinern
    fitFree(box) {
      const W = box.clientWidth, H = box.clientHeight;
      if (!W || !H) return;
      for (const q of box.querySelectorAll(':scope > .free-q')) {
        const P = (q._quad || []).map((p) => [p[0] * W, p[1] * H]);
        if (P.length !== 4) continue;
        const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
        const w = Math.max(4, (len(P[0], P[1]) + len(P[3], P[2])) / 2), h = Math.max(4, (len(P[0], P[3]) + len(P[1], P[2])) / 2);
        q.style.width = w + 'px'; q.style.height = h + 'px';
        q.style.transform = Theme.quadMatrix(w, h, P);
        const t = q.querySelector('.dlg-text');
        if (t && box._fit && t._fs0) {
          // mit dem ganzen Text messen (beim Tippen ist erst ein Teil da)
          const full = box._full != null ? box._full : t.textContent;
          const kids = [...t.childNodes];
          t.textContent = full;
          let k = 1;
          t.style.fontSize = t._fs0 + 'cqh';
          for (let i = 0; i < 14 && t.scrollHeight > h * 0.98 && k > 0.25; i++) { k *= 0.9; t.style.fontSize = (t._fs0 * k) + 'cqh'; }
          t.textContent = ''; t.append(...kids);
        }
      }
    },

    // ---------- Text-Effekte (0.9.35) ----------
    textFx(textEl, nameEl, B) {
      if (textEl) {
        const L = B.letters || '';
        if (L) textEl.dataset.letters = L; else delete textEl.dataset.letters;
        textEl.style.setProperty('--la', String(Number(B.letAmt != null ? B.letAmt : 1)));
        textEl.style.setProperty('--ls', String(Math.max(0.1, Number(B.letSpeed) || 1)));
        // Buchstaben einzeln (für die Animation)
        if (L && window.Fx && textEl.textContent && !textEl.querySelector('.tch')) Fx.renderText(textEl, textEl.textContent);
        textEl.classList.toggle('tcap', !!B.cap);
        textEl.classList.toggle('tdrop', !!(B.cap && B.capDrop));
        if (B.cap) {
          textEl.style.setProperty('--capk', String(Number(B.capSize) || 1.8));
          textEl.style.setProperty('--capc', B.capColor || 'currentColor');
          textEl.style.setProperty('--capf', Theme.fontCss(B.capFont) || 'inherit');
        }
        Theme.fxFilter(textEl, B);
      }
      if (nameEl) Theme.fxFilter(nameEl, B.fxName !== false ? B : null);
    },
    // Comic-Punkte und einseitige Kontur als SVG-Filter (Maße relativ zur Schriftgröße)
    fxFilter(node, B) {
      if (node._fxRo) { node._fxRo.disconnect(); node._fxRo = null; }
      if (!B || !(B.dots || B.edge)) { node.style.filter = ''; return; }
      const apply = () => {
        const fs = parseFloat(getComputedStyle(node).fontSize) || 16;
        node.style.filter = 'url(#' + Theme.fxDef(B, fs) + ')';
      };
      node._fxRo = new ResizeObserver(apply);
      node._fxRo.observe(node);
      if (node.isConnected) apply();
    },
    _fx: new Map(),
    fxDef(B, fs) {
      const r = (v) => Math.round(v * 10) / 10;
      const P = {
        d: !!B.dots, dc: B.dotsColor || '#000', g: r(Math.max(2, (Number(B.dotsGap) || 0.16) * fs)), ds: Number(B.dotsSize) || 55,
        dd: r((Number(B.dotsDist) || 0) * fs), da: Number(B.dotsAng) || 0, dw: r((Number(B.dotsWide) || 0) * fs),
        e: !!B.edge, ec: B.edgeColor || '#000', ew: r(Math.max(0.5, (Number(B.edgeW) || 0.08) * fs)), ea: Number(B.edgeAng) || 0
      };
      const key = JSON.stringify(P);
      if (Theme._fx.has(key)) return Theme._fx.get(key);
      const id = 'vntfx' + (++Theme._fxN) + '_' + Math.random().toString(36).slice(2, 6);
      let host = document.getElementById('vn-tfx-defs');
      if (!host) {
        host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        host.id = 'vn-tfx-defs';
        host.setAttribute('width', '0'); host.setAttribute('height', '0');
        host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
        document.body.appendChild(host);
      }
      const rad = (a) => a * Math.PI / 180;
      let f = '', merge = '';
      if (P.d) {
        const rr = (P.g * P.ds / 100) / 2;
        const tile = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${P.g}" height="${P.g}"><circle cx="${P.g / 2}" cy="${P.g / 2}" r="${rr}" fill="#fff"/></svg>`);
        f += `<feImage href="${tile}" x="0" y="0" width="${P.g}" height="${P.g}" result="dt"/><feTile in="dt" result="dts"/>`;
        f += (P.dw > 0 ? `<feMorphology in="SourceAlpha" operator="dilate" radius="${P.dw}" result="dsa"/>` : '') + `<feOffset in="${P.dw > 0 ? 'dsa' : 'SourceAlpha'}" dx="${r(Math.cos(rad(P.da)) * P.dd)}" dy="${r(Math.sin(rad(P.da)) * P.dd)}" result="dof"/>`;
        f += `<feComposite in="dts" in2="dof" operator="in" result="dsh"/><feFlood flood-color="${P.dc}" result="dcl"/><feComposite in="dcl" in2="dsh" operator="in" result="dots"/>`;
        merge += '<feMergeNode in="dots"/>';
      }
      if (P.e) {
        f += `<feMorphology in="SourceAlpha" operator="dilate" radius="${r(P.ew / 2)}" result="ed"/><feOffset in="ed" dx="${r(Math.cos(rad(P.ea)) * P.ew / 2)}" dy="${r(Math.sin(rad(P.ea)) * P.ew / 2)}" result="eo"/>`;
        f += `<feFlood flood-color="${P.ec}" result="ecl"/><feComposite in="ecl" in2="eo" operator="in" result="edge"/>`;
        merge += '<feMergeNode in="edge"/>';
      }
      const filt = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filt.id = id;
      for (const [k, v] of [['x', '-25%'], ['y', '-25%'], ['width', '150%'], ['height', '150%'], ['color-interpolation-filters', 'sRGB']]) filt.setAttribute(k, v);
      filt.innerHTML = f + '<feMerge>' + merge + '<feMergeNode in="SourceGraphic"/></feMerge>';
      host.appendChild(filt);
      Theme._fx.set(key, id);
      // nicht endlos wachsen: älteste Filter wieder entfernen
      if (Theme._fx.size > 80) { const [k0, id0] = Theme._fx.entries().next().value; Theme._fx.delete(k0); const n = document.getElementById(id0); if (n) n.remove(); }
      return id;
    },
    _fxN: 0,
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
    // Studio-Logos (neu: Liste; alte Projekte haben ein einzelnes Bild in logo.studio)
    logoItems() {
      const L = Theme.t().logo;
      if (!Array.isArray(L.items)) {
        L.items = [];
        if (L.studio) L.items.push({ id: VN.uid('lg'), kind: 'image', asset: L.studio, dur: L.dur != null ? L.dur : 2.5, bg: L.bg || '#000000', when: L.when || 'after', tin: 'fade', tout: 'fade' });
        delete L.studio; delete L.when; delete L.dur;
      }
      return L.items.filter((x) => x && x.asset && VN.assetUrl(x.asset));
    },
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
