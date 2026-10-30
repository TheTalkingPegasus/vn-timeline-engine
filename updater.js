// Updates der Engine über GitHub-Releases.
// Installierte Fassung (Setup): electron-updater lädt nur die Änderungen und installiert beim Neustart.
// ZIP-Fassung: nur ein Hinweis mit Link zur Download-Seite.
// In exportierten Spielen läuft hier nie etwas.
const { app, ipcMain, net, shell } = require('electron');
const fs = require('fs');
const path = require('path');

module.exports = function setupUpdater({ getWin, gameMode }) {
  const pkg = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')); } catch (e) { return {}; } })();
  const pub = Object.assign({}, resolveRepo(pkg, process.resourcesPath));
  const configured = !!(pub.owner && pub.repo && !/YOUR-GITHUB-NAME|DEINNAME/.test(pub.owner));
  const installed = app.isPackaged && process.platform === 'win32' && fs.existsSync(path.join(process.resourcesPath || '', 'app-update.yml'));
  const enabled = !gameMode && app.isPackaged && configured;
  const releasesUrl = configured ? `https://github.com/${pub.owner}/${pub.repo}/releases/latest` : '';
  const state = { status: 'idle', version: null, notes: '', percent: 0, error: '', kind: installed ? 'setup' : 'zip', current: app.getVersion(), enabled, releasesUrl };
  const send = () => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send('update:state', state); };
  const set = (o) => { Object.assign(state, o); send(); };

  let au = null;
  if (enabled && installed) {
    try {
      au = require('electron-updater').autoUpdater;
      au.autoDownload = false;
      au.autoInstallOnAppQuit = true;
      au.allowDowngrade = false;
      au.on('checking-for-update', () => set({ status: 'checking', error: '' }));
      au.on('update-available', (i) => set({ status: 'available', version: i.version, notes: notesText(i.releaseNotes) }));
      au.on('update-not-available', () => set({ status: 'latest' }));
      au.on('download-progress', (p) => set({ status: 'downloading', percent: Math.round(p.percent || 0) }));
      au.on('update-downloaded', (i) => set({ status: 'ready', version: i.version, percent: 100 }));
      au.on('error', (e) => set({ status: 'error', error: String((e && e.message) || e).split('\n')[0] }));
    } catch (e) { au = null; }
  }

  // ZIP-Fassung: neueste Version über die GitHub-API nachsehen
  const checkZip = () => new Promise((resolve) => {
    set({ status: 'checking', error: '' });
    const req = net.request(`https://api.github.com/repos/${pub.owner}/${pub.repo}/releases/latest`);
    req.setHeader('Accept', 'application/vnd.github+json');
    let body = '';
    req.on('response', (res) => {
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          const v = String(j.tag_name || '').replace(/^v/i, '');
          if (v && newer(v, app.getVersion())) set({ status: 'available', version: v, notes: notesText(j.body) });
          else set({ status: 'latest' });
        } catch (e) { set({ status: 'error', error: 'Antwort von GitHub nicht lesbar' }); }
        resolve();
      });
    });
    req.on('error', (e) => { set({ status: 'error', error: String(e.message || e) }); resolve(); });
    req.end();
  });

  const check = async () => {
    if (!enabled) return state;
    if (au) { try { await au.checkForUpdates(); } catch (e) { set({ status: 'error', error: String(e.message || e).split('\n')[0] }); } }
    else await checkZip();
    return state;
  };

  ipcMain.handle('update:state', () => state);
  ipcMain.handle('update:check', () => check());
  ipcMain.handle('update:download', async () => {
    if (au) { set({ status: 'downloading', percent: 0 }); try { await au.downloadUpdate(); } catch (e) { set({ status: 'error', error: String(e.message || e).split('\n')[0] }); } }
    else if (releasesUrl) shell.openExternal(releasesUrl);
    return state;
  });
  // Neu starten: erst speichern lassen (das Schließen des Fensters erledigt das), dann installieren
  ipcMain.handle('update:install', () => { if (au && state.status === 'ready') setImmediate(() => au.quitAndInstall(true, true)); return true; });
  ipcMain.handle('update:openPage', () => { if (releasesUrl) shell.openExternal(releasesUrl); return true; });

  return { check, state, enabled };
};

// Wo liegen die Releases? Im fertigen Programm fehlt der „build“-Abschnitt der package.json
// (electron-builder entfernt ihn). Darum: 1. app-update.yml des Installers, 2. „build.publish“ (Entwicklung),
// 3. „repository“-Adresse der package.json.
function resolveRepo(pkg, resDir) {
  try {
    const t = fs.readFileSync(path.join(resDir || '', 'app-update.yml'), 'utf8');
    const o = /^owner:\s*['"]?([^'"\s]+)/m.exec(t), r = /^repo:\s*['"]?([^'"\s]+)/m.exec(t);
    if (o && r) return { owner: o[1], repo: r[1] };
  } catch (e) { /* ZIP-Fassung oder Entwicklung */ }
  const b = ((pkg.build && pkg.build.publish) || [])[0];
  if (b && b.owner && b.repo) return { owner: b.owner, repo: b.repo };
  const u = String((pkg.repository && (pkg.repository.url || pkg.repository)) || pkg.homepage || '');
  const m = /github\.com[/:]([^/]+)\/([^/.#?]+)/i.exec(u);
  return m ? { owner: m[1], repo: m[2] } : {};
}
module.exports.resolveRepo = resolveRepo;

function notesText(n) {
  if (Array.isArray(n)) n = n.map((x) => x.note || '').join('\n');
  return String(n || '').replace(/<[^>]+>/g, '').replace(/\r/g, '').trim().slice(0, 3000);
}
function newer(a, b) {
  const p = (v) => String(v).split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) > (y[i] || 0)) return true; if ((x[i] || 0) < (y[i] || 0)) return false; }
  return false;
}
