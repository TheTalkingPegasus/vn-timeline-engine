// Übersetzung von Dialogen und Beispielprojekten (Hauptprozess und Bau der Web-Version)
// const L = require('./project-lang')(rendererDir, () => lang) → L.T(text), L.enProject(data)
module.exports = (rendererDir, getLang) => {
  const fs = require('fs');
  const path = require('path');
let I18N = null, I18RE = null, I18N_CONTENT = {};
const loadI18n = () => {
  if (I18N) return;
  I18N = {};
  try {
    const s = fs.readFileSync(path.join(rendererDir, 'js', 'i18n-en.js'), 'utf8');
    const m = s.match(/window\.VN_I18N_EN = ([\s\S]*?);\nwindow\.VN_I18N_EN_FRAG = ([\s\S]*?);\n/);
    I18N = JSON.parse(m[1]);
    const mc = s.match(/window\.VN_I18N_EN_CONTENT = ([\s\S]*?);\n/);
    I18N_CONTENT = mc ? JSON.parse(mc[1]) : {};
    const L = 'A-Za-zÄÖÜäöüß';
    const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    I18RE = new RegExp(JSON.parse(m[2]).map((k) => (new RegExp('^[' + L + ']').test(k) ? '(?<![' + L + '-])' : '') + esc(k) + (new RegExp('[' + L + ']$').test(k) ? '(?![' + L + '-])' : '')).join('|'), 'g');
  } catch (e) { console.warn('Übersetzung nicht geladen', e.message); }
};
const T = (s) => {
  if (getLang() !== 'en' || typeof s !== 'string' || !s) return s;
  loadI18n();
  const core = s.trim();
  if (I18N[core] !== undefined) return s.replace(core, I18N[core]);
  return I18RE ? s.replace(I18RE, (m) => I18N[m] || m) : s;
};

// Beispiel-, Tutorial- und Lernprojekt auf Englisch: alle bekannten Texte austauschen
const SKIP_KEYS = new Set(['id', 'asset', 'file', 'ref', 'scene', 'target', 'font', 'titleFont', 'action', 'kind', 'type', 'mode', 'preset', 'translations', 'rigs', 'blinks', 'mouths', 'plugins', 'next', 'startScene']);
const enProject = (data) => {
  if (getLang() !== 'en' || !data) return data;
  loadI18n();
  const X = (v) => { if (typeof v !== 'string') return v; const k = v.trim(); const r = I18N_CONTENT[k] !== undefined ? I18N_CONTENT[k] : I18N[k]; return r !== undefined ? v.replace(k, r) : v; };
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
  // Übersetzungen umdrehen: Englisch wird Original, Deutsch die Übersetzung
  const de = {};
  for (const [id, t] of Object.entries(oldTr)) if (t && t.src) de[id] = { text: t.src, src: X(t.src), ok: true };
  data.languages = Object.keys(de).length ? ['en', 'de'] : ['en'];
  data.translations = Object.keys(de).length ? { de } : {};
  return data;
};
  return { T, enProject };
};
