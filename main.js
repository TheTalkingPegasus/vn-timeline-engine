// VN Timeline Engine – Hauptprozess (Fenster, Dateien, Projekte)
const { app, BrowserWindow, ipcMain, dialog, Menu, protocol, shell, screen } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createDemoProject } = require('./demo');
const { createTutorialProject } = require('./tutorial');

let win;
let projectDir = null;

// ---------- Sicherheit ----------
// Die Oberfläche (und damit jedes Plugin) darf nur Ordner benutzen, die der Hauptprozess selbst
// freigegeben hat (Dialog „Öffnen/Neu“, Lernprojekt, Spielordner). Alle Pfade werden geprüft.
const approvedDirs = new Set();
const approve = (d) => { if (d) approvedDirs.add(path.resolve(d)); return d; };
const inside = (base, full) => { const r = path.relative(path.resolve(base), path.resolve(full)); return !!r && !r.startsWith('..') && !path.isAbsolute(r); };
// Datei im Projektordner auflösen – oder null, wenn der Pfad hinausführt
// Echtes Ziel (Verknüpfungen aufgelöst); für noch nicht vorhandene Dateien der nächste vorhandene Ordner darüber
const realOf = (p) => { let cur = path.resolve(p), rest = ''; for (let i = 0; i < 40; i++) { try { return path.join(fs.realpathSync(cur), rest); } catch (e) { const up = path.dirname(cur); if (up === cur) return path.resolve(p); rest = path.join(path.basename(cur), rest); cur = up; } } return path.resolve(p); };
const insideReal = (base, full) => inside(base, full) && inside(realOf(base), realOf(full));
const inProject = (rel) => { if (!projectDir) return null; const full = path.resolve(projectDir, String(rel || '')); return insideReal(projectDir, full) ? full : null; };
// Quelldateien, die der Nutzer selbst gewählt oder hineingezogen hat (nur diese dürfen ins Projekt kopiert werden)
const allowedSources = new Set();
ipcMain.on('asset:allow', (e, p) => { if (typeof p === 'string' && p) allowedSources.add(path.resolve(p)); e.returnValue = true; });
const denied = (what) => { console.warn('Verweigert: ' + what); return null; };

// Spielmodus: Eine exportierte .exe hat das Spiel unter resources/game und startet direkt ins Spiel
const GAME_DIR = process.env.VN_GAME_DIR || path.join(process.resourcesPath || __dirname, 'game');
const gameMode = fs.existsSync(path.join(GAME_DIR, 'project.json')) && (app.isPackaged || !!process.env.VN_GAME_DIR);
let gameData = null;
const SELFTEST = process.argv.includes('--selftest') || !!process.env.VN_SELFTEST;

// ---- Sprache der Oberfläche (Dialoge des Betriebssystems) ----
let uiLang = 'en';
let I18N = null, I18RE = null, I18N_CONTENT = {};
const loadI18n = () => {
  if (I18N) return;
  I18N = {};
  try {
    const s = fs.readFileSync(path.join(__dirname, 'renderer', 'js', 'i18n-en.js'), 'utf8');
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
  if (uiLang !== 'en' || typeof s !== 'string' || !s) return s;
  loadI18n();
  const core = s.trim();
  if (I18N[core] !== undefined) return s.replace(core, I18N[core]);
  return I18RE ? s.replace(I18RE, (m) => I18N[m] || m) : s;
};

// Beispiel-, Tutorial- und Lernprojekt auf Englisch: alle bekannten Texte austauschen
const SKIP_KEYS = new Set(['id', 'asset', 'file', 'ref', 'scene', 'target', 'font', 'titleFont', 'action', 'kind', 'type', 'mode', 'preset', 'translations', 'rigs', 'blinks', 'mouths', 'plugins', 'next', 'startScene']);
const enProject = (data) => {
  if (uiLang !== 'en' || !data) return data;
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
const saveProjectFile = (dir, data) => { fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(data, null, 2), 'utf8'); return data; };
ipcMain.on('ui:lang', (_e, l) => { uiLang = l === 'de' ? 'de' : 'en'; });
const trOpts = (o) => {
  if (!o || typeof o !== 'object') return o;
  const r = { ...o };
  for (const k of ['title', 'message', 'detail', 'buttonLabel', 'checkboxLabel']) if (typeof r[k] === 'string') r[k] = T(r[k]);
  if (Array.isArray(r.buttons)) r.buttons = r.buttons.map(T);
  if (Array.isArray(r.filters)) r.filters = r.filters.map((f) => ({ ...f, name: T(f.name) }));
  return r;
};
for (const fn of ['showOpenDialog', 'showSaveDialog', 'showMessageBox']) {
  const orig = dialog[fn].bind(dialog);
  dialog[fn] = (a, b) => (b === undefined ? orig(trOpts(a)) : orig(a, trOpts(b)));
}
{ const origErr = dialog.showErrorBox.bind(dialog); dialog.showErrorBox = (t, c) => origErr(T(t), T(c)); }
if (gameMode) {
  try { gameData = JSON.parse(fs.readFileSync(path.join(GAME_DIR, 'project.json'), 'utf8')); projectDir = GAME_DIR; approve(GAME_DIR); } catch (e) { gameData = null; }
}
const safeName = (s) => String(s || 'Spiel').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Spiel';

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];
const AUDIO_EXT = ['ogg', 'wav', 'mp3', 'opus', 'flac', 'm4a'];
const FONT_EXT = ['ttf', 'otf', 'woff', 'woff2'];
const VIDEO_EXT = ['webm', 'mp4'];
const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
  ogg: 'audio/ogg', wav: 'audio/wav', mp3: 'audio/mpeg', opus: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4',
  ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2', webm: 'video/webm', mp4: 'video/mp4'
};

// Software-WebGL als Rückfall, falls der Grafiktreiber blockiert ist
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

// Eigenes Protokoll für Projektdateien, damit Bilder auch in Canvas/WebGL (Bones) nutzbar sind
protocol.registerSchemesAsPrivileged([{
  scheme: 'vnasset',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}]);

// Dateistück als Web-Strom (für große Videos und Musik)
function fileStream(full, start, end) {
  return require('stream').Readable.toWeb(fs.createReadStream(full, { start, end, highWaterMark: 256 * 1024 }));
}

function registerAssetProtocol() {
  protocol.handle('vnasset', async (req) => {
    try {
      const url = new URL(req.url);
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      if (!projectDir) return new Response('kein Projekt', { status: 404 });
      const full = inProject(rel);
      if (!full) return new Response('verboten', { status: 403 });
      const ext = path.extname(full).slice(1).toLowerCase();
      const size = (await fs.promises.stat(full)).size;
      const head = { 'content-type': MIME[ext] || 'application/octet-stream', 'access-control-allow-origin': '*', 'cache-control': 'no-cache', 'accept-ranges': 'bytes' };
      // Kleine Dateien (Bilder, kurze Töne) direkt, große Dateien als Strom – nie ein 500-MB-Video ganz in den Speicher
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
      if (range && size) {
        let start = range[1] === '' ? Math.max(0, size - Number(range[2] || 0)) : Number(range[1]);
        let end = range[1] !== '' && range[2] !== '' ? Math.min(size - 1, Number(range[2])) : size - 1;
        if (start >= size || start > end) return new Response(null, { status: 416, headers: Object.assign(head, { 'content-range': 'bytes */' + size }) });
        return new Response(fileStream(full, start, end), { status: 206, headers: Object.assign(head, { 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) }) });
      }
      if (size <= 2 * 1024 * 1024) return new Response(await fs.promises.readFile(full), { headers: Object.assign(head, { 'content-length': String(size) }) });
      return new Response(fileStream(full, 0, size - 1), { headers: Object.assign(head, { 'content-length': String(size) }) });
    } catch (e) {
      return new Response('nicht gefunden', { status: 404 });
    }
  });
}

function kindOf(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (AUDIO_EXT.includes(ext)) return 'audio';
  if (FONT_EXT.includes(ext)) return 'font';
  if (VIDEO_EXT.includes(ext)) return 'video';
  return null;
}

// Fenster des exportierten Spiels: Größe nach Spiel-Auflösung, Start-Modus aus den Export-Einstellungen
function gameWindowOpts() {
  const ex = (gameData && gameData.export) || {};
  const res = (gameData && gameData.resolution) || { w: 1920, h: 1080 };
  const area = screen.getPrimaryDisplay().workAreaSize;
  const k = Math.min(area.width * 0.85 / res.w, area.height * 0.85 / res.h, 1);
  const o = { width: Math.round(res.w * k), height: Math.round(res.h * k), minWidth: 480, minHeight: 320, resizable: ex.resizable !== false, useContentSize: true, backgroundColor: '#000000' };
  if (ex.start === 'fullscreen') o.fullscreen = true;
  if (ex.start === 'borderless') { o.frame = false; o.width = area.width; o.height = area.height; o.x = 0; o.y = 0; }
  const icon = path.join(GAME_DIR, 'icon.png');
  if (fs.existsSync(icon)) o.icon = icon;
  return o;
}

function createWindow() {
  win = new BrowserWindow(Object.assign({
    width: 1500,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#16171b',
    title: gameData ? (gameData.title || 'Spiel') : 'VN Timeline Engine',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  }, gameData ? gameWindowOpts() : {}));
  Menu.setApplicationMenu(null);
  // Schließen: erst die Oberfläche ausstehende Änderungen speichern lassen (höchstens 4 s warten)
  let closeOk = !!gameData;
  win.on('close', (e) => {
    if (closeOk || !projectDir) return;
    e.preventDefault();
    const w = win;
    const go = () => { if (closeOk) return; closeOk = true; ipcMain.removeAllListeners('app:flushed'); if (!w.isDestroyed()) w.close(); };
    ipcMain.once('app:flushed', go);
    setTimeout(go, 4000);
    try { w.webContents.send('app:flush'); } catch (er) { go(); }
  });
  // Keine fremden Seiten laden oder neue Fenster öffnen (auch nicht aus Plugins)
  win.webContents.on('will-navigate', (e, url) => { if (!/^file:/i.test(url)) e.preventDefault(); });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'), gameData ? { query: { game: '1' } } : undefined);
  if (process.env.VN_AUTOTEST) runAutotest();
  if (SELFTEST) win.webContents.once('did-finish-load', () => setTimeout(() => {
    win.webContents.on('console-message', (e) => { if (/Error|Fehler|Uncaught/.test(e.message)) console.log('[renderer]', e.message); });
    require('./tests/selftest.js')({ win, app, approve, exportWebTo, BrowserWindow }).catch((e) => { console.log('TESTREIHE ABGEBROCHEN', e); app.exit(2); });
  }, 800));
  if (gameData && process.env.VN_GAMESHOT) {
    win.webContents.once('did-finish-load', async () => {
      const shot = async (n) => fs.writeFileSync(path.join(process.env.VN_GAMESHOT, n + '.png'), (await win.webContents.capturePage()).toPNG());
      await new Promise((r) => setTimeout(r, 5500)); await shot('g1_menu');
      await win.webContents.executeJavaScript(`document.querySelector('.mm-btn').click()`);
      await new Promise((r) => setTimeout(r, 2500)); await shot('g2_game');
      console.log('GAME ERRORS', await win.webContents.executeJavaScript('JSON.stringify(window.__vnErrors||[])'));
      app.quit();
    });
  }
}

// Kopiert Dateien in den assets-Ordner des Projekts, ohne bestehende zu überschreiben
function copyIntoProject(dir, sources) {
  const assetsDir = path.join(dir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  const out = [];
  for (const src of sources) {
    const kind = kindOf(src);
    if (!kind) continue;
    const base = path.basename(src);
    let name = base;
    let i = 1;
    while (fs.existsSync(path.join(assetsDir, name))) {
      const p = path.parse(base);
      name = `${p.name}_${i++}${p.ext}`;
    }
    fs.copyFileSync(src, path.join(assetsDir, name));
    out.push({ name: path.parse(base).name, kind, file: 'assets/' + name });
  }
  return out;
}

ipcMain.handle('project:new', async (_e, { demo, tutorial }) => {
  const r = await dialog.showOpenDialog(win, {
    title: tutorial ? 'Ordner für das Tutorial-Projekt wählen' : demo ? 'Ordner für das Beispielprojekt wählen' : 'Leeren Ordner für das neue Projekt wählen',
    properties: ['openDirectory', 'createDirectory']
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const dir = r.filePaths[0];
  const projectFile = path.join(dir, 'project.json');
  if (fs.existsSync(projectFile)) {
    const c = await dialog.showMessageBox(win, {
      type: 'warning', buttons: ['Abbrechen', 'Überschreiben'], defaultId: 0, cancelId: 0,
      message: 'In diesem Ordner liegt schon ein Projekt. Überschreiben?'
    });
    if (c.response !== 1) return null;
  }
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  let data = null;
  if (tutorial) data = createTutorialProject(dir);
  else if (demo) data = createDemoProject(dir);
  if (data && uiLang === 'en') saveProjectFile(dir, enProject(data));
  approve(dir);
  return { dir, data };
});

// Lernprojekt: fester Ordner, wird beim ersten Mal aus dem Beispielprojekt angelegt
ipcMain.handle('project:learn', async () => {
  const dir = process.env.VN_LEARN_DIR || path.join(app.getPath('documents'), 'VN Timeline Engine', uiLang === 'en' ? 'Learning project' : 'Lernprojekt');
  const file = path.join(dir, 'project.json');
  approve(dir);
  if (fs.existsSync(file)) { try { return { dir, data: JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch (e) { /* neu anlegen */ } }
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  const data = enProject(createDemoProject(dir));
  data.title = T('Lernprojekt');
  data.learn = true;
  return { dir, data, fresh: true };
});

ipcMain.handle('project:open', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Projekt öffnen (project.json wählen)',
    properties: ['openFile'],
    filters: [{ name: 'VN-Projekt', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const file = r.filePaths[0];
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    approve(path.dirname(file));
    return { dir: path.dirname(file), data };
  } catch (err) {
    dialog.showErrorBox('Projekt konnte nicht geöffnet werden', String(err.message || err));
    return null;
  }
});

// Sicherungskopie der Projektdatei vor einer Formatumwandlung (bleibt neben project.json liegen)
ipcMain.handle('project:backup', async (_e, { dir, label }) => {
  if (gameMode || !projectDir || path.resolve(dir || '') !== path.resolve(projectDir)) return denied('Sicherung außerhalb des Projekts');
  const file = path.join(projectDir, 'project.json');
  if (!fs.existsSync(file)) return null;
  const safe = String(label || 'alt').replace(/[^\w.-]+/g, '-').slice(0, 60);
  let name = 'project.backup-' + safe + '.json';
  for (let i = 2; fs.existsSync(path.join(projectDir, name)); i++) name = 'project.backup-' + safe + '-' + i + '.json';
  fs.copyFileSync(file, path.join(projectDir, name));
  return name;
});
ipcMain.handle('project:save', async (_e, { dir, data }) => {
  if (gameMode || !projectDir || path.resolve(dir || '') !== path.resolve(projectDir)) return denied('Speichern außerhalb des Projekts');
  const file = path.join(projectDir, 'project.json');
  const tmp = file + '.tmp';
  // Text kommt fertig aus der Oberfläche (schneller als ein großes Objekt über IPC zu schicken)
  fs.writeFileSync(tmp, typeof data === 'string' ? data : JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return true;
});

ipcMain.handle('asset:pick', async (_e, { dir, kind }) => {
  if (gameMode || !projectDir) return [];
  dir = projectDir;
  const filters = kind === 'audio'
    ? [{ name: 'Audio', extensions: AUDIO_EXT }]
    : kind === 'image'
      ? [{ name: 'Bilder', extensions: IMAGE_EXT }]
      : kind === 'font'
        ? [{ name: 'Schriften', extensions: FONT_EXT }]
        : kind === 'video'
          ? [{ name: 'Videos', extensions: VIDEO_EXT }]
          : [{ name: 'Bilder, Audio, Schriften, Videos', extensions: IMAGE_EXT.concat(AUDIO_EXT, FONT_EXT, VIDEO_EXT) }];
  const r = await dialog.showOpenDialog(win, { title: 'Dateien importieren', properties: ['openFile', 'multiSelections'], filters });
  if (r.canceled) return [];
  return copyIntoProject(dir, r.filePaths);
});

// Ziehen & Ablegen: nur Medien-Dateien, nur in den eigenen Projektordner
ipcMain.handle('asset:copy', async (_e, { dir, paths }) => (gameMode || !projectDir ? [] : copyIntoProject(projectDir, (paths || []).filter((p) => typeof p === 'string' && kindOf(p) && allowedSources.has(path.resolve(p))))));

// Bildgröße aus dem Dateikopf lesen (PNG, JPEG, WebP, GIF), WAV-Dauer
function probe(full) {
  const out = {};
  try {
    const fd = fs.openSync(full, 'r');
    const b = Buffer.alloc(65536);
    const n = fs.readSync(fd, b, 0, b.length, 0);
    fs.closeSync(fd);
    if (b.readUInt32BE(0) === 0x89504e47) { out.w = b.readUInt32BE(16); out.h = b.readUInt32BE(20); }
    else if (b.toString('ascii', 0, 3) === 'GIF') { out.w = b.readUInt16LE(6); out.h = b.readUInt16LE(8); }
    else if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const t = b.toString('ascii', 12, 16);
      if (t === 'VP8X') { out.w = 1 + b.readUIntLE(24, 3); out.h = 1 + b.readUIntLE(27, 3); }
      else if (t === 'VP8 ') { out.w = b.readUInt16LE(26) & 0x3fff; out.h = b.readUInt16LE(28) & 0x3fff; }
      else if (t === 'VP8L') { const v = b.readUInt32LE(21); out.w = (v & 0x3fff) + 1; out.h = ((v >> 14) & 0x3fff) + 1; }
    } else if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE') {
      let p = 12, rate = 0;
      while (p + 8 <= n) { const id = b.toString('ascii', p, p + 4), sz = b.readUInt32LE(p + 4); if (id === 'fmt ') rate = b.readUInt32LE(p + 16); if (id === 'data') { if (rate) out.dur = sz / rate; break; } p += 8 + sz + (sz & 1); }
    } else if (b[0] === 0xff && b[1] === 0xd8) {
      let p = 2;
      while (p + 9 < n) { if (b[p] !== 0xff) { p++; continue; } const m = b[p + 1]; const len = b.readUInt16BE(p + 2); if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { out.h = b.readUInt16BE(p + 5); out.w = b.readUInt16BE(p + 7); break; } p += 2 + len; }
    }
  } catch (e) { /* egal */ }
  return out;
}
ipcMain.handle('files:stat', (_e, rels) => (rels || []).map((rel) => {
  const full = inProject(rel);
  if (!full) return { file: rel, size: 0, missing: true };
  try { return Object.assign({ file: rel, size: fs.statSync(full).size }, probe(full)); } catch (e) { return { file: rel, size: 0, missing: true }; }
}));
const dirSize = (d) => { let s = 0; for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); s += f.isDirectory() ? dirSize(p) : fs.statSync(p).size; } return s; };
ipcMain.handle('app:engineSize', () => {
  if (!app.isPackaged) return null;
  try {
    const base = path.dirname(process.execPath);
    let s = dirSize(base);
    const loc = path.join(base, 'locales');
    if (fs.existsSync(loc)) for (const f of fs.readdirSync(loc)) if (!KEEP_LOCALES.includes(f)) s -= fs.statSync(path.join(loc, f)).size;
    for (const extra of ['rcedit-x64.exe', 'rcedit-LICENSE.txt']) { const p = path.join(process.resourcesPath, extra); if (fs.existsSync(p)) s -= fs.statSync(p).size; }
    return s;
  } catch (e) { return null; }
});
ipcMain.handle('asset:write', (_e, { dir, rel, bytes }) => {
  // Nur Mediendateien im assets-Ordner des geöffneten Projekts
  if (gameMode || !projectDir) return denied('Schreiben im Spiel');
  rel = String(rel || '').replace(/\\/g, '/');
  if (!/^assets\//.test(rel) || !kindOf(rel) || !inProject(rel)) return denied('asset:write ' + rel);
  const dirOk = projectDir;
  let name = rel, i = 1;
  while (fs.existsSync(path.join(dirOk, name))) { const p = path.parse(rel); name = path.join(p.dir, p.name + '_' + (i++) + p.ext).replace(/\\/g, '/'); }
  if (!inProject(name)) return denied('asset:write ' + name);
  fs.mkdirSync(path.dirname(path.join(dirOk, name)), { recursive: true });
  fs.writeFileSync(path.join(dirOk, name), Buffer.from(bytes));
  return name.replace(/\\/g, '/');
});

ipcMain.handle('project:setDir', (_e, dir) => {
  if (gameMode) return projectDir === path.resolve(dir || '') || path.resolve(dir || '') === path.resolve(GAME_DIR);
  if (!approvedDirs.has(path.resolve(dir || ''))) return !!denied('Projektordner nicht freigegeben: ' + dir);
  projectDir = path.resolve(dir); return true;
});

ipcMain.handle('file:saveText', async (_e, { name, text, ext }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, text, 'utf8');
  return true;
});

ipcMain.handle('file:saveBinary', async (_e, { name, bytes, ext }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, Buffer.from(bytes));
  return true;
});

ipcMain.handle('file:openText', async (_e, { ext }) => {
  const exts = String(ext || 'txt').split(',').map((x) => x.trim()).filter(Boolean);
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: exts.length > 1 ? 'Text' : exts[0].toUpperCase(), extensions: exts }, { name: '*', extensions: ['*'] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  return fs.readFileSync(r.filePaths[0], 'utf8');
});

// ---------- Spielmodus, Fenster ----------
ipcMain.handle('app:gameInfo', () => (gameData ? { game: true, dir: GAME_DIR, data: gameData } : { game: false }));
ipcMain.handle('app:quit', () => app.quit());
ipcMain.handle('app:fullscreen', (_e, on) => { if (win) win.setFullScreen(!!on); return win ? win.isFullScreen() : false; });
ipcMain.handle('app:openPath', (_e, rel) => { if (!projectDir || gameMode) return false; const full = rel ? inProject(rel) : projectDir; if (!full) return false; fs.mkdirSync(full, { recursive: true }); shell.openPath(full); return true; });

// ---------- Spielstände ----------
let savesDirCache = null;
function savesDir() {
  if (savesDirCache) { fs.mkdirSync(savesDirCache, { recursive: true }); return savesDirCache; }
  let dir;
  if (gameData) {
    // Titel + Projektkennung: zwei Spiele mit gleichem Namen teilen sich keine Spielstände mehr
    const base = path.join(app.getPath('userData'), 'saves');
    const old = path.join(base, safeName(gameData.title));
    const pid = String(gameData.persistId || '').replace(/[^a-z0-9]/gi, '');
    dir = pid ? path.join(base, safeName(gameData.title) + '-' + pid) : old;
    // Spielstände aus älteren Versionen (nur nach Titel) einmalig herüberkopieren
    if (pid && !fs.existsSync(dir) && fs.existsSync(old)) { try { fs.cpSync(old, dir, { recursive: true }); } catch (e) { /* dann eben leer */ } }
    savesDirCache = dir;
  } else dir = path.join(projectDir || app.getPath('userData'), '.test-saves');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
const slotFile = (slot) => path.join(savesDir(), String(slot).replace(/[^a-z0-9_-]/gi, '') + '.json');
ipcMain.handle('saves:list', () => {
  const dir = savesDir();
  const out = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try { out[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) {
      // Defekt (z. B. Absturz beim Schreiben): Sicherungskopie nehmen
      try { out[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, f.slice(0, -5) + '.bak'), 'utf8')); } catch (e2) { /* auch defekt */ }
    }
  }
  return out;
});
// Absturzsicher: erst Zwischendatei, alte Version als .bak behalten, dann austauschen
ipcMain.handle('saves:write', (_e, { slot, data }) => {
  const file = slotFile(slot), tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
  if (fs.existsSync(file)) { try { fs.copyFileSync(file, file.replace(/\.json$/, '.bak')); } catch (e) { /* egal */ } }
  fs.renameSync(tmp, file);
  return true;
});
ipcMain.handle('saves:delete', (_e, { slot }) => { for (const f of [slotFile(slot), slotFile(slot).replace(/\.json$/, '.bak')]) { try { fs.unlinkSync(f); } catch (e) { /* egal */ } } return true; });

// ---------- Plugins ----------
const pluginsDir = () => path.join(projectDir, 'plugins');
ipcMain.handle('plugins:list', () => {
  if (!projectDir) return [];
  const dir = pluginsDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.js'));
});
ipcMain.handle('plugins:read', (_e, name) => {
  if (!projectDir || !/\.js$/i.test(String(name || ''))) return '';
  const f = path.join(pluginsDir(), path.basename(String(name)));
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
});
ipcMain.handle('plugins:write', (_e, { name, text }) => {
  // Im fertigen Spiel nie (siehe auch die Sperrliste am Ende), im Editor nur .js im Plugin-Ordner des Projekts
  if (gameMode || !projectDir) return denied('Plugin schreiben im Spiel');
  if (!/\.js$/i.test(String(name || ''))) return denied('Plugin-Datei muss .js sein');
  fs.mkdirSync(pluginsDir(), { recursive: true });
  fs.writeFileSync(path.join(pluginsDir(), path.basename(name)), text, 'utf8');
  return true;
});
const pluginsDoc = () => (uiLang === 'en' ? 'PLUGINS.en.md' : 'PLUGINS.md');
ipcMain.handle('plugins:addExample', () => {
  fs.mkdirSync(pluginsDir(), { recursive: true });
  for (const f of ['schlossknacken.js', 'PLUGINS.md']) {
    const dest = path.join(pluginsDir(), f);
    if (!fs.existsSync(dest)) fs.copyFileSync(path.join(__dirname, 'templates', f === 'PLUGINS.md' ? pluginsDoc() : f), dest);
  }
  return true;
});

// Mitgelieferte Plugins (Jobs, Minispiele) ins Projekt kopieren
const BUNDLED = ['jobs.js', 'minispiele.js'];
ipcMain.handle('plugins:bundledText', (_e, name) => {
  const file = path.basename(name);
  if (!BUNDLED.includes(file)) return null;
  try { return fs.readFileSync(path.join(__dirname, 'templates', file), 'utf8'); } catch (e) { return null; }
});
ipcMain.handle('plugins:addBundled', (_e, name, force) => {
  const file = path.basename(name);
  const src = path.join(__dirname, 'templates', file);
  if (!BUNDLED.includes(file) || !fs.existsSync(src)) return false;
  fs.mkdirSync(pluginsDir(), { recursive: true });
  const dest = path.join(pluginsDir(), file);
  if (force || !fs.existsSync(dest)) fs.copyFileSync(src, dest);
  const md = path.join(pluginsDir(), 'PLUGINS.md');
  if (!fs.existsSync(md)) fs.copyFileSync(path.join(__dirname, 'templates', pluginsDoc()), md);
  return true;
});

// ---------- Export ----------
const KEEP_LOCALES = ['de.pak', 'en-US.pak', 'en-GB.pak'];
// files: umgewandelte Dateien [{ file, bytes }], die statt der Originale geschrieben werden
async function copyGameFiles(dest, data, files) {
  fs.mkdirSync(dest, { recursive: true });
  fs.mkdirSync(path.join(dest, 'assets'), { recursive: true });
  const conv = {};
  for (const f of files || []) conv[f.file] = f.bytes;
  for (const a of data.assets || []) {
    // Pfade aus der Projektdatei nie blind übernehmen: Quelle und Ziel müssen im jeweiligen Ordner bleiben
    const rel = String(a.file || '');
    const out = path.resolve(dest, rel), src = inProject(rel);
    if (!rel || !inside(dest, out) || !src) { console.warn('Export: Pfad übersprungen', rel); continue; }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (conv[a.file]) { fs.writeFileSync(out, Buffer.from(conv[a.file])); continue; }
    if (fs.existsSync(src)) await fs.promises.copyFile(src, out);
  }
  const plugins = Object.entries(data.plugins || {}).filter(([k, v]) => v && v.enabled && k === path.basename(k) && /\.js$/i.test(k)).map(([k]) => k);
  if (plugins.length) {
    fs.mkdirSync(path.join(dest, 'plugins'), { recursive: true });
    for (const f of plugins) { const src = path.join(pluginsDir(), f); if (fs.existsSync(src) && insideReal(pluginsDir(), src)) await fs.promises.copyFile(src, path.join(dest, 'plugins', f)); }
  }
  fs.writeFileSync(path.join(dest, 'project.json'), JSON.stringify(data), 'utf8');
}

// ICO-Datei mit einem eingebetteten 256-px-PNG (ab Windows Vista)
function pngToIco(png) {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);
  head[6] = 0; head[7] = 0; head[8] = 0; head[9] = 0;
  head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
  return Buffer.concat([head, png]);
}

async function exportWindowsTo(parent, data, files, iconPng) {
  const name = safeName(data.title);
  const dest = path.join(parent, name);
  const src = path.dirname(process.execPath);
  // app.asar als normale Datei kopieren, nicht als Ordner
  const prevNoAsar = process.noAsar;
  process.noAsar = true;
  try {
    await fs.promises.cp(src, dest, {
      recursive: true, force: true,
      filter: (p) => {
        if (/(LIES MICH|README)\.txt$/.test(p) || p.includes(path.join('resources', 'game')) || /rcedit/i.test(path.basename(p))) return false;
        // Nur deutsche und englische Sprachpakete von Chromium mitnehmen (spart ca. 45 MB)
        if (path.basename(path.dirname(p)) === 'locales' && p.endsWith('.pak') && !KEEP_LOCALES.includes(path.basename(p))) return false;
        return true;
      }
    });
  } finally { process.noAsar = prevNoAsar; }
  const exe = path.basename(process.execPath);
  const target = path.join(dest, name + path.extname(exe));
  if (exe !== path.basename(target)) await fs.promises.rename(path.join(dest, exe), target);
  await copyGameFiles(path.join(dest, 'resources', 'game'), data, files);
  if (iconPng) fs.writeFileSync(path.join(dest, 'resources', 'game', 'icon.png'), Buffer.from(iconPng));
  // Programm-Symbol und Versionsangaben in die .exe schreiben (nur unter Windows möglich)
  const rcedit = path.join(process.resourcesPath || '', 'rcedit-x64.exe');
  if (process.platform === 'win32' && fs.existsSync(rcedit)) {
    const ex = data.export || {};
    const args = [target, '--set-version-string', 'ProductName', data.title || name, '--set-version-string', 'FileDescription', data.title || name,
      '--set-version-string', 'CompanyName', ex.studio || '', '--set-file-version', /^\d+(\.\d+){0,3}$/.test(ex.version || '') ? ex.version : '1.0.0', '--set-product-version', ex.version || '1.0'];
    if (iconPng) { const ico = path.join(dest, 'resources', 'game', 'icon.ico'); fs.writeFileSync(ico, pngToIco(Buffer.from(iconPng))); args.push('--set-icon', ico); }
    await new Promise((res) => execFile(rcedit, args, (err) => { if (err) console.warn('rcedit', err.message); res(); }));
  }
  if (String((data.languages || ['de'])[0]).startsWith('de')) fs.writeFileSync(path.join(dest, 'SPIELEN.txt'), name + '\r\n\r\nZum Spielen "' + path.basename(target) + '" starten.\r\nErstellt mit der VN Timeline Engine.\r\n', 'utf8');
  else fs.writeFileSync(path.join(dest, 'HOW TO PLAY.txt'), name + '\r\n\r\nStart "' + path.basename(target) + '" to play.\r\nMade with VN Timeline Engine.\r\n', 'utf8');
  return { dest, exe: target };
}

ipcMain.handle('export:windows', async (_e, { data, files, iconPng }) => {
  if (!app.isPackaged) return { ok: false, msg: 'Der Windows-Export funktioniert nur in der fertigen Programmversion (.exe).' };
  const r = await dialog.showOpenDialog(win, { title: 'Ordner für das fertige Spiel wählen', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  const res = await exportWindowsTo(r.filePaths[0], data, files, iconPng);
  shell.openPath(res.dest);
  return { ok: true, dest: res.dest };
});

async function exportWebTo(dest, data, files) {
  await copyGameFiles(dest, data, files);
  fs.unlinkSync(path.join(dest, 'project.json'));
  const rd = path.join(__dirname, 'renderer');
  fs.mkdirSync(path.join(dest, 'engine'), { recursive: true });
  const engineFiles = ['style.css', 'js/web-boot.js', 'js/i18n-en.js', 'js/core.js', 'js/i18n.js', 'js/audioout.js', 'js/logic.js', 'js/life.js', 'js/extras.js', 'js/world.js', 'js/quests.js', 'js/skills.js', 'js/combat.js', 'js/idle.js', 'js/theme.js', 'js/uipresets.js', 'js/uidesign.js', 'js/perf.js', 'js/fx.js', 'js/stage.js', 'js/systems.js', 'js/rig.js', 'js/anim.js', 'js/blink.js', 'js/plugins.js', 'js/menu.js', 'js/player-audio.js', 'js/player-menus.js', 'js/player-extras.js', 'js/player-world.js', 'js/player-notify.js', 'js/player-skills.js', 'js/player-combat.js', 'js/player-idle.js', 'js/player.js', 'js/schema.js'];
  for (const f of engineFiles) await fs.promises.copyFile(path.join(rd, f), path.join(dest, 'engine', path.basename(f)));
  fs.writeFileSync(path.join(dest, 'engine', 'game-data.js'), 'window.VN_GAME = ' + JSON.stringify(data) + ';', 'utf8');
  try { fs.copyFileSync(path.join(__dirname, 'LICENSE'), path.join(dest, 'engine', 'LICENSE.txt')); } catch (e) { /* Lizenzdatei fehlt in der Entwicklung */ }
  const plugins = Object.entries(data.plugins || {}).filter(([, v]) => v && v.enabled).map(([k]) => k);
  const esc = (t) => String(t).replace(/[<&>]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const html = `<!doctype html>\n<html lang="${(data.languages && data.languages[0]) || 'de'}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(data.title || 'Spiel')}</title>\n<link rel="stylesheet" href="engine/style.css">\n<style>html,body{background:#000;overflow:hidden}</style>\n</head>\n<body>\n<div id="player"></div><div id="toast"></div><div id="ctxmenu" hidden></div>\n` +
    ['game-data.js', 'web-boot.js', 'i18n-en.js', 'core.js', 'i18n.js', 'audioout.js', 'logic.js', 'life.js', 'extras.js', 'world.js', 'quests.js', 'skills.js', 'combat.js', 'idle.js', 'theme.js', 'uipresets.js', 'uidesign.js', 'perf.js', 'fx.js', 'stage.js', 'systems.js', 'rig.js', 'anim.js', 'blink.js', 'plugins.js', 'menu.js', 'player-audio.js', 'player-menus.js', 'player-extras.js', 'player-world.js', 'player-notify.js', 'player-skills.js', 'player-combat.js', 'player-idle.js', 'schema.js'].map((f) => `<script src="engine/${f}"></script>`).join('\n') + '\n' +
    plugins.map((f) => `<script>VNPlugin._current = ${JSON.stringify(f)};</script><script src="plugins/${encodeURIComponent(f)}"></script>`).join('\n') + '\n<script src="engine/player.js"></script>\n<script>VNWeb.start();</script>\n</body>\n</html>\n';
  fs.writeFileSync(path.join(dest, 'index.html'), html, 'utf8');
  if (String((data.languages || ['de'])[0]).startsWith('de')) fs.writeFileSync(path.join(dest, 'LIES MICH.txt'), 'Web-Version von "' + (data.title || 'Spiel') + '"\r\n\r\nFür itch.io: diesen Ordner als ZIP hochladen und "This file will be played in the browser" wählen.\r\nLokal testen: index.html im Browser öffnen. Manche Browser blockieren dabei Bones-Animationen; auf itch.io oder einem Webserver funktioniert alles.\r\n', 'utf8');
  else fs.writeFileSync(path.join(dest, 'README.txt'), 'Web version of "' + (data.title || 'Game') + '"\r\n\r\nFor itch.io: upload this folder as a ZIP and choose "This file will be played in the browser".\r\nTesting locally: open index.html in a browser. Some browsers block Bones animations this way; on itch.io or a web server everything works.\r\n', 'utf8');
}

ipcMain.handle('export:web', async (_e, { data, files }) => {
  const r = await dialog.showOpenDialog(win, { title: 'Ordner für das Web-Spiel wählen', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  const dest = path.join(r.filePaths[0], safeName(data.title) + ' (Web)');
  await exportWebTo(dest, data, files);
  shell.openPath(dest);
  return { ok: true, dest };
});

ipcMain.handle('app:confirm', async (_e, { message, buttons }) => {
  const r = await dialog.showMessageBox(win, { type: 'question', buttons, defaultId: 0, cancelId: buttons.length - 1, message });
  return r.response;
});

app.whenReady().then(async () => {
  registerAssetProtocol();
  // Test des Programm-Exports (nur Entwicklung)
  if (process.env.VN_EXPORT_TEST && !gameData) {
    const tmp = path.join(process.env.VN_EXPORT_TEST, 'proj');
    fs.mkdirSync(tmp, { recursive: true });
    const data = createDemoProject(tmp);
    projectDir = tmp;
    const res = await exportWindowsTo(path.join(process.env.VN_EXPORT_TEST, 'out'), data);
    console.log('EXPORTED', res.exe);
    app.quit();
    return;
  }
  createWindow();
});
app.on('window-all-closed', () => app.quit());

// ---------- Automatischer Testlauf (nur für die Entwicklung) ----------
function runAutotest() {
  const dir = process.env.VN_AUTOTEST;
  const shots = process.env.VN_SHOTS || dir;
  fs.mkdirSync(dir, { recursive: true });
  approve(dir);
  const testLang = process.env.VN_UILANG === 'en' ? 'en' : 'de';
  uiLang = testLang;
  const data = enProject(process.env.VN_TUTORIAL ? createTutorialProject(dir) : createDemoProject(dir));
  win.webContents.on('console-message', (e) => { if (!/GPU stall|GL Driver/.test(e.message)) console.log('[renderer]', e.message); });
  win.webContents.once('did-finish-load', async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const js = (code) => win.webContents.executeJavaScript(code);
    const shot = async (name, w) => { const img = await (w || win).webContents.capturePage(); fs.writeFileSync(path.join(shots, name + '.png'), img.toPNG()); };
    const step = async (name, code, ms) => { if (code) await js(code); await wait(ms || 600); await shot(name); };
    try {
      await js(`VN.I18n.set(${JSON.stringify(testLang)}); try { const st = JSON.parse(localStorage.getItem('vn-settings') || '{}'); delete st.lang; localStorage.setItem('vn-settings', JSON.stringify(st)); if (VN.settings) delete VN.settings.lang; } catch (e) {} 1`);
      await js(`window.__vnLoad(${JSON.stringify(dir)}, ${JSON.stringify(data)})`);
      await wait(1200);
      if (process.env.VN_STEPS) {
        // Eigene Testabläufe (Entwicklung): Datei exportiert async (t) => {}
        await require(process.env.VN_STEPS)({ js, wait, shot, step, win, dir, shots, BrowserWindow, copyGameFiles, exportWebTo, path, fs });
        console.log('ERRORS', await js('JSON.stringify(window.__vnErrors || [])'));
        app.quit();
        return;
      }
      console.log('PLUGINS', await js(`JSON.stringify(Object.keys(VNPlugin.plugins))`));
      await step('01_bg_editor', `App.openScene('s2'); VN.ui.sel = VN.curScene().tracks.bg[0].id; VN.render()`, 900);
      await step('02_voice_cut_row', `App.openScene('s1'); VN.ui.sel = VN.curScene().tracks.voice[1].id; VN.render()`, 700);
      await step('03_cut_modal', `(()=>{ const s=VN.curScene(); const c=s.tracks.voice[0]; AudioCut.open(s, c, VN.track('voice')); })()`, 1500);
      await step('04_cut_detect', `Array.from(document.querySelectorAll('.cut-modal button')).find(b=>b.textContent==='Teile erkennen').click()`, 700);
      await js(`document.querySelector('.modal-back').remove()`);
      await step('05_blink_eyes', `App.openBones('a_ray'); VN.ui.boneTool='eyes'; VN.ui.boneMesh=false; VN.ui.boneWeights=false; VN.ui.bonePlay=false; VN.render()`, 1200);
      await step('06_plugins_tab', `VN.ui.view='systems'; VN.ui.sysTab='plugins'; VN.render()`, 700);
      await step('07_menu_editor', `VN.ui.view='menu'; VN.render()`, 1200);
      await step('08_transcript_menu', `VN.ui.view='transcript'; VN.ui.trFilter={q:'',area:'',status:''}; VN.render(); document.querySelector('.tr-table').lastChild.scrollIntoView()`, 700);
      // Spiel mit Hauptmenü
      await step('09_play_menu', `Player.start(null, 0, { menu: true })`, 5200);
      await step('10_play_new', `document.querySelector('.mm-btn').click()`, 2500);
      await step('11_choices', `__vnTest('advance', 5)`, 1800);
      await step('12_plugin_minigame', `Array.from(document.querySelectorAll('.choice-btn'))[0].click()`, 1200);
      await js(`(async()=>{ for (let i=0;i<4;i++){ window.dispatchEvent(new KeyboardEvent('keydown',{key:' '})); await new Promise(r=>setTimeout(r,350)); } })()`);
      await wait(2800);
      await step('13_after_minigame', null, 300);
      console.log('V_TUER', await js(`JSON.stringify(Player.state && Player.state.rs.vars)`));
      await step('14_pause', `window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`, 600);
      await step('15_save_screen', `Array.from(document.querySelectorAll('.sys-btn')).find(b=>b.textContent==='Speichern').click()`, 800);
      await step('16_saved', `document.querySelectorAll('.save-card')[0].click()`, 900);
      await step('17_settings', `Array.from(document.querySelectorAll('.sys-btn')).find(b=>b.textContent==='Zurück').click(); setTimeout(()=>Array.from(document.querySelectorAll('.sys-btn')).find(b=>b.textContent==='Einstellungen').click(), 200)`, 900);
      await step('18_main_menu_continue', `Array.from(document.querySelectorAll('.sys-btn')).find(b=>b.textContent==='Zurück').click(); setTimeout(()=>Array.from(document.querySelectorAll('.sys-btn')).find(b=>b.textContent==='Hauptmenü').click(), 200)`, 2200);
      await step('19_continue_loaded', `Array.from(document.querySelectorAll('.mm-btn'))[1].click()`, 2500);
      await js(`Player.close()`);
      // Blinzeln sichtbar machen: lange Dauer, kurze Pausen
      await js(`(()=>{ const b = VN.project.blinks.a_ray; b.min = 0.2; b.max = 0.2; b.dur = 6; b.double = 0; Player.start('s1'); })()`);
      await wait(4800); await shot('22_blink_rig');
      const savedRig = await js(`JSON.stringify(VN.project.rigs.a_ray)`);
      await js(`Player.close(); delete VN.project.rigs.a_ray; Player.start('s1')`);
      await wait(4800); await shot('23_blink_img');
      await js('Player.close(); VN.project.rigs.a_ray = ' + savedRig + '; const b = VN.project.blinks.a_ray; b.min = 2.2; b.max = 5; b.dur = 0.16; b.double = 0.25;');
      // Export: Spielordner und Web-Version
      const proj = JSON.parse(await js('JSON.stringify(VN.project)'));
      await copyGameFiles(path.join(shots, 'game'), proj);
      await exportWebTo(path.join(shots, 'web'), proj);
      const w2 = new BrowserWindow({ width: 1280, height: 720, show: true, webPreferences: { contextIsolation: true } });
      w2.webContents.on('console-message', (e) => console.log('[web]', e.message));
      await w2.loadFile(path.join(shots, 'web', 'index.html'));
      await wait(3000); await shot('20_web_menu', w2);
      await w2.webContents.executeJavaScript(`document.querySelector('.mm-btn').click()`);
      await wait(2500); await shot('21_web_game', w2);
      console.log('WEB ERRORS', await w2.webContents.executeJavaScript('JSON.stringify(window.__vnErrors||[])'));
      w2.close();
      const errs = await js('JSON.stringify(window.__vnErrors || [])');
      console.log('ERRORS', errs);
    } catch (err) {
      console.log('AUTOTEST FAILED', err);
    }
    app.quit();
  });
}

// Im exportierten Spiel gibt es nur Lesezugriff auf die Spieldateien und Schreiben in Spielstände.
if (gameMode) {
  for (const ch of ['project:new', 'project:learn', 'project:open', 'plugins:write', 'plugins:addExample', 'plugins:addBundled', 'export:windows', 'export:web', 'file:openText']) {
    ipcMain.removeHandler(ch);
    ipcMain.handle(ch, () => denied(ch + ' im Spiel'));
  }
}
