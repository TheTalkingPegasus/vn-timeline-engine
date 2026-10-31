// Brücke zwischen Oberfläche und Dateisystem
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('vnApi', {
  learnProject: () => ipcRenderer.invoke('project:learn'),
  newProject: (kind) => ipcRenderer.invoke('project:new', { demo: kind === true || kind === 'demo', tutorial: kind === 'tutorial' }),
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (dir, data) => ipcRenderer.invoke('project:save', { dir, data }),
  backupProject: (dir, label) => ipcRenderer.invoke('project:backup', { dir, label }),
  setDir: (dir) => ipcRenderer.invoke('project:setDir', dir),
  pickAssets: (dir, kind) => ipcRenderer.invoke('asset:pick', { dir, kind }),
  copyAssets: (dir, paths) => ipcRenderer.invoke('asset:copy', { dir, paths }),
  saveText: (name, text, ext) => ipcRenderer.invoke('file:saveText', { name, text, ext }),
  writeGuide: (text) => ipcRenderer.invoke('project:writeGuide', { text }),
  openText: (ext) => ipcRenderer.invoke('file:openText', { ext }),
  saveBinary: (name, bytes, ext) => ipcRenderer.invoke('file:saveBinary', { name, bytes, ext }),
  setUiLang: (l) => ipcRenderer.send('ui:lang', l),
  // Vor dem Schließen: ausstehende Änderungen speichern, dann Bescheid geben
  onFlush: (fn) => ipcRenderer.on('app:flush', async () => { try { await fn(); } finally { ipcRenderer.send('app:flushed'); } }),
  confirm: (message, buttons) => ipcRenderer.invoke('app:confirm', { message, buttons }),
  gameInfo: () => ipcRenderer.invoke('app:gameInfo'),
  quit: () => ipcRenderer.invoke('app:quit'),
  fullscreen: (on) => ipcRenderer.invoke('app:fullscreen', on),
  openPath: (rel) => ipcRenderer.invoke('app:openPath', rel),
  saves: {
    list: () => ipcRenderer.invoke('saves:list'),
    write: (slot, data) => ipcRenderer.invoke('saves:write', { slot, data }),
    remove: (slot) => ipcRenderer.invoke('saves:delete', { slot })
  },
  plugins: {
    list: () => ipcRenderer.invoke('plugins:list'),
    read: (name) => ipcRenderer.invoke('plugins:read', name),
    write: (name, text) => ipcRenderer.invoke('plugins:write', { name, text }),
    addExample: () => ipcRenderer.invoke('plugins:addExample'),
    addBundled: (name, force) => ipcRenderer.invoke('plugins:addBundled', name, !!force),
    bundledText: (name) => ipcRenderer.invoke('plugins:bundledText', name)
  },
  exportWindows: (payload) => ipcRenderer.invoke('export:windows', payload),
  exportWeb: (payload) => ipcRenderer.invoke('export:web', payload),
  statFiles: (rels) => ipcRenderer.invoke('files:stat', rels),
  engineSize: () => ipcRenderer.invoke('app:engineSize'),
  update: {
    state: () => ipcRenderer.invoke('update:state'),
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    openPage: () => ipcRenderer.invoke('update:openPage'),
    onState: (fn) => ipcRenderer.on('update:state', (_e, s) => fn(s))
  },
  writeAsset: (dir, rel, bytes) => ipcRenderer.invoke('asset:write', { dir, rel, bytes }),
  // Projektdateien laufen über das eigene Protokoll vnasset://
  fileUrl: (dir, rel) => 'vnasset://project/' + rel.split(/[\\/]/).map(encodeURIComponent).join('/'),
  // Pfad einer wirklich hineingezogenen Datei. Nur echte Dateien aus Ziehen & Ablegen haben einen Pfad –
  // der Hauptprozess merkt ihn sich und kopiert später nur solche Dateien (Schutz vor Plugins).
  pathForFile: (file) => {
    let p = '';
    try { p = webUtils.getPathForFile(file) || ''; } catch (e) { p = ''; }
    if (p) ipcRenderer.sendSync('asset:allow', p);
    return p;
  }
});
