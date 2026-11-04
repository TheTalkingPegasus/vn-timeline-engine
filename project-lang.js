// Übersetzung von Dialogen und Beispielprojekten (Hauptprozess und Bau der Web-Version)
// const L = require('./project-lang')(rendererDir, () => lang) → L.T(text), L.enProject(data)
// Sprachen: de (Original), en, es, ja. Fehlt ein Text auf Spanisch oder Japanisch, gilt die englische Fassung.
module.exports = (rendererDir, getLang) => {
  const fs = require('fs');
  const path = require('path');
  const cache = {};
  const read = (l) => { try { return fs.readFileSync(path.join(rendererDir, 'js', 'i18n-' + l + '.js'), 'utf8'); } catch (e) { return ''; } };
  const load = (l) => {
    if (cache[l]) return cache[l];
    const t = { D: {}, C: {}, RE: null };
    try {
      const s = read('en');
      const m = s.match(/window\.VN_I18N_EN = ([\s\S]*?);\nwindow\.VN_I18N_EN_FRAG = ([\s\S]*?);\n/);
      t.D = JSON.parse(m[1]);
      const mc = s.match(/window\.VN_I18N_EN_CONTENT = ([\s\S]*?);\n/);
      t.C = mc ? JSON.parse(mc[1]) : {};
      if (l !== 'en') {
        const U = l.toUpperCase();
        const x = read(l);
        const ml = x.match(new RegExp('window\\.VN_I18N_' + U + ' = ([\\s\\S]*?);\\nwindow\\.VN_I18N_' + U + '_CONTENT = ([\\s\\S]*?);\\n'));
        if (ml) { Object.assign(t.D, JSON.parse(ml[1])); Object.assign(t.C, JSON.parse(ml[2])); }
      }
      const L = 'A-Za-zÄÖÜäöüß';
      const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      t.RE = new RegExp(JSON.parse(m[2]).map((k) => (new RegExp('^[' + L + ']').test(k) ? '(?<![' + L + '-])' : '') + esc(k) + (new RegExp('[' + L + ']$').test(k) ? '(?![' + L + '-])' : '')).join('|'), 'g');
    } catch (e) { console.warn('Übersetzung nicht geladen', e.message); }
    cache[l] = t;
    return t;
  };
  const lang = () => { const l = getLang(); return ['en', 'es', 'ja'].includes(l) ? l : l === 'de' ? 'de' : 'en'; };
  const T = (s) => {
    const l = lang();
    if (l === 'de' || typeof s !== 'string' || !s) return s;
    const t = load(l);
    const core = s.trim();
    if (t.D[core] !== undefined) return s.replace(core, t.D[core]);
    return t.RE ? s.replace(t.RE, (m) => t.D[m] || m) : s;
  };

  // Beispiel-, Tutorial- und Lernprojekt in der Sprache der Oberfläche: alle bekannten Texte austauschen
  const SKIP_KEYS = new Set(['id', 'asset', 'file', 'ref', 'scene', 'target', 'font', 'titleFont', 'action', 'kind', 'type', 'mode', 'preset', 'translations', 'rigs', 'blinks', 'mouths', 'plugins', 'next', 'startScene']);
  const enProject = (data) => {
    const l = lang();
    if (l === 'de' || !data) return data;
    const t = load(l);
    const X = (v) => { if (typeof v !== 'string') return v; const k = v.trim(); const r = t.C[k] !== undefined ? t.C[k] : t.D[k]; return r !== undefined ? v.replace(k, r) : v; };
    const walk = (o) => {
      if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { if (typeof o[i] === 'string') o[i] = X(o[i]); else walk(o[i]); } return; }
      if (!o || typeof o !== 'object') return;
      for (const k of Object.keys(o)) {
        if (SKIP_KEYS.has(k)) continue;
        if (typeof o[k] === 'string') o[k] = X(o[k]); else walk(o[k]);
      }
    };
    const oldTr = (data.translations || {}).en || {};
    walk(data);
    if (data.theme && data.theme.speakers) { const sp = {}; for (const [k, v] of Object.entries(data.theme.speakers)) sp[X(k)] = v; data.theme.speakers = sp; }
    // Übersetzungen umdrehen: die Oberflächensprache wird Original, Deutsch die Übersetzung
    const de = {};
    for (const [id, tt] of Object.entries(oldTr)) if (tt && tt.src) de[id] = { text: tt.src, src: X(tt.src), ok: true };
    data.languages = Object.keys(de).length ? [l, 'de'] : [l];
    data.translations = Object.keys(de).length ? { de } : {};
    return data;
  };
  return { T, enProject };
};
