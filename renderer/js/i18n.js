// Sprache der Oberfläche (Deutsch / Englisch).
// Die Engine ist auf Deutsch geschrieben; dieser Übersetzer tauscht sichtbare Texte
// im DOM gegen die englische Fassung aus i18n-en.js. Spielinhalte (Dialoge, Antworten …)
// werden nie angefasst. Der Editor folgt der Einstellung „Sprache“, der Spieler im Spiel
// folgt der Sprache des Spiels (Deutsch → deutsche Menüs, alles andere → englische).
(function () {
  const VN = window.VN = window.VN || {};
  const D = window.VN_I18N_EN || {};
  const FRAG = window.VN_I18N_EN_FRAG || [];
  const CONTENT_D = window.VN_I18N_EN_CONTENT || {};
  const LETTER = 'A-Za-zÄÖÜäöüß';
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let fragRe = null;
  const fragMap = new Map();
  const buildFrag = () => {
    if (fragRe || !FRAG.length) return;
    const edge = /^[\s·:–—,]+|[\s·:–—,]+$/g;
    const list = FRAG.filter((k) => { const c = k.replace(edge, ''); return c === k || D[c] === undefined || String(D[k]).replace(edge, '') !== D[c]; });
    for (const k of list) fragMap.set(k, D[k]);
    const alts = list.map((k) => {
      let p = esc(k);
      if (new RegExp('^[' + LETTER + ']').test(k)) p = '(?<![' + LETTER + '-])' + p;
      if (new RegExp('[' + LETTER + ']$').test(k)) p = p + '(?![' + LETTER + '-])';
      return p;
    });
    fragRe = new RegExp(alts.join('|'), 'g');
  };

  const cache = new Map();
  const PROPER = /^(Ray|English|Deutsch|Windows|Bones|Excel|YouTube|Chrome|Electron|Intel|Iris|VN|I)\b/;
  const SEG = /( · | – | — |: |, |\n| \(|\) |\)$|^\(| → | \/ )/;
  const cap = (de, out) => (/^[A-ZÄÖÜ]/.test(de) && /^[a-z]/.test(out) ? out[0].toUpperCase() + out.slice(1) : out);
  const exact = (s) => {
    const core = s.trim();
    const hit = D[core];
    if (hit === undefined) return null;
    const i = s.indexOf(core);
    return s.slice(0, i) + cap(core, hit) + s.slice(i + core.length);
  };
  // Übersetzt einen Text ins Englische: ganzer Text, dann Teilstücke (Label: Wert · …), dann Fragmente.
  function en(s, exactOnly) {
    if (typeof s !== 'string' || !s || !/[A-Za-zÄÖÜäöüß]/.test(s)) return s;
    const ex = exact(s);
    if (ex !== null) return ex;
    const sym = /^([^A-Za-zÄÖÜäöüß0-9„"(]+)(.+)$/.exec(s);
    if (sym) { const r = exact(sym[2]); if (r !== null) return sym[1] + r; }
    if (exactOnly) return s;
    const c = cache.get(s);
    if (c !== undefined) return c;
    buildFrag();
    let out = s;
    if (fragRe) out = out.replace(fragRe, (m, off, all) => {
      let r = fragMap.get(m) || m;
      // mitten im Satz: Substantive klein (3 Abschnitte → 3 sections)
      if (off > 0 && /[0-9a-zäöüß] $/.test(all.slice(Math.max(0, off - 2), off)) && /^[A-Z][a-z]+\b/.test(r) && !PROPER.test(r)) r = r[0].toLowerCase() + r.slice(1);
      return r;
    });
    const parts = out.split(SEG);
    if (parts.length > 1) out = parts.map((p, i) => (i % 2 ? p : (exact(p) ?? p))).join('');
    if (cache.size > 20000) cache.clear();
    cache.set(s, out);
    return out;
  }

  const KEY = 'vn-ui-lang';
  let uiLang = 'en';
  try { const v = localStorage.getItem(KEY); if (v === 'de' || v === 'en') uiLang = v; } catch (e) { /* kein Speicher */ }

  const playerLang = () => {
    const p = VN.project;
    const l = String(VN.lang || (p && p.languages && p.languages[0]) || 'de').toLowerCase();
    return l.startsWith('de') ? 'de' : 'en';
  };
  const playerRoot = () => document.getElementById('player');
  const langFor = (node) => {
    if (VN.gameMode) return playerLang();
    const pr = playerRoot();
    if (pr && pr.contains(node)) return playerLang();
    return uiLang;
  };

  // Technische Bereiche: nie übersetzen
  const SKIP = 'script,style,pre,code,[data-notr],[contenteditable="true"],.lp-code';
  // Inhalte des Spiels: im Spieler nie, im Editor (Vorschau) nur ganze Treffer
  const CONTENT = '.dlg-text,.dlg-name,.choice-btn,.bl-text,.gl-text,.gl-card,.qn-text,.ph-msg,.pl-name-ask';
  // Bereiche, in denen Nutzertext neben Engine-Text steht: nur ganze Treffer
  const EXACT = '.clip-user,.save-text,.scene-item,.tr-text,' + CONTENT;

  const textState = new WeakMap(); // Textknoten → { orig, out }
  const attrState = new WeakMap(); // Element → { attr: { orig, out } }
  const ATTRS = ['title', 'placeholder', 'aria-label'];

  const ctxOf = (elm, isText) => {
    if (!elm || !elm.closest) return { skip: false, exact: false };
    if (elm.closest(SKIP) || (isText && elm.closest('textarea'))) return { skip: true };
    if (elm.closest(CONTENT)) { const pr = playerRoot(); if (VN.gameMode || (pr && pr.contains(elm))) return { skip: true }; }
    return { skip: false, exact: !!elm.closest(EXACT) };
  };

  // Texte aus dem Projekt (Szenennamen, Dialoge, Gegenstände …) gehören dem Nutzer: höchstens ganze Treffer, nie Teilstücke
  let userSet = new Set(), userProj = null, userAt = 0;
  const SKIP_KEYS = { id: 1, asset: 1, file: 1, type: 1, kind: 1, ref: 1, target: 1, scene: 1, next: 1, translations: 1, rigs: 1, blinks: 1, mouths: 1, preset: 1 };
  const isUser = (t) => {
    const p = VN.project;
    if (!p) return false;
    const now = Date.now();
    if (p !== userProj || now - userAt > 1500) {
      const set = new Set();
      const walk = (o, depth) => {
        if (depth > 12 || !o) return;
        if (typeof o === 'string') { if (o.length > 1 && o.length < 400) set.add(o.trim()); return; }
        if (typeof o !== 'object') return;
        if (Array.isArray(o)) { for (const x of o) walk(x, depth + 1); return; }
        for (const k in o) if (!SKIP_KEYS[k]) walk(o[k], depth + 1);
      };
      try { walk(p, 0); } catch (e) { /* egal */ }
      userSet = set; userProj = p; userAt = now;
    }
    return userSet.has(String(t).trim());
  };

  function doText(n) {
    const st = textState.get(n);
    const cur = n.data;
    let orig = cur;
    if (st) { if (cur === st.out) orig = st.orig; else if (cur === st.orig) orig = cur; }
    const parent = n.parentElement;
    const lang = langFor(n);
    let out = orig;
    if (lang === 'en') {
      const c = ctxOf(parent, true);
      if (!c.skip) out = en(orig, c.exact || isUser(orig));
    }
    if (out !== orig || st) textState.set(n, { orig, out });
    if (cur !== out) n.data = out;
  }
  function doAttrs(elm) {
    let st = attrState.get(elm);
    const lang = langFor(elm);
    let c = null;
    for (const a of ATTRS) {
      if (!elm.hasAttribute(a)) continue;
      const cur = elm.getAttribute(a);
      const s = st && st[a];
      let orig = cur;
      if (s) { if (cur === s.out) orig = s.orig; }
      let out = orig;
      if (lang === 'en') { c = c || ctxOf(elm); if (!c.skip) out = en(orig, c.exact || isUser(orig)); }
      if (out !== orig || s) { st = st || {}; st[a] = { orig, out }; attrState.set(elm, st); }
      if (cur !== out) elm.setAttribute(a, out);
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) doAttrs(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) doText(n);
      else doAttrs(n);
    }
  }

  let busy = false;
  const obs = new MutationObserver((list) => {
    if (busy) return;
    busy = true;
    try {
      for (const m of list) {
        if (m.type === 'childList') { for (const a of m.addedNodes) walk(a); }
        else if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
      }
    } finally { busy = false; obs.takeRecords(); }
  });
  const start = () => {
    walk(document.body);
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  const refresh = (root) => { busy = true; try { walk(root || document.body); } finally { busy = false; obs.takeRecords(); } document.title = VN.t(document.title); };

  VN.I18n = {
    en,
    get lang() { return uiLang; },
    set(l) {
      uiLang = l === 'de' ? 'de' : 'en';
      try { localStorage.setItem(KEY, uiLang); } catch (e) { /* egal */ }
      try { if (window.vnApi && window.vnApi.setUiLang) window.vnApi.setUiLang(uiLang); } catch (e) { /* egal */ }
      refresh();
      document.querySelectorAll('#w-lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === uiLang));
      if (VN.render && VN.project) { try { VN.render(); } catch (e) { /* noch kein Projekt */ } }
    },
    refresh,
    playerLang
  };
  // Text für Daten, die der Editor anlegt (Standardnamen, Lern-Inhalte): folgt der Editor-Sprache
  VN.t = (s) => {
    if (uiLang !== 'en' || VN.gameMode || typeof s !== 'string') return s;
    const c = CONTENT_D[s.trim()];
    return c !== undefined ? s.replace(s.trim(), c) : en(s);
  };
  // Text für den Spieler (folgt der Spielsprache)
  VN.tp = (s) => (playerLang() === 'en' ? en(s) : s);
  try { if (window.vnApi && window.vnApi.setUiLang) window.vnApi.setUiLang(uiLang); } catch (e) { /* egal */ }
})();
