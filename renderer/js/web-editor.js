// Web-Version des Editors: läuft ohne Installation im Browser (nur im Web-Build enthalten, nicht in der Desktop-Version).
// Ersetzt die Desktop-Schnittstelle (preload.js) durch Browser-Funktionen:
// - Projekte liegen im Browser (IndexedDB) – oder, in Chrome/Edge, direkt in einem Ordner auf dem PC
// - Bilder, Töne usw. werden als Blob-Adressen bereitgestellt
// - Projekt als ZIP herunterladen / aus ZIP öffnen, Web-Export als ZIP
(function () {
  window.VN_WEB = true;
  const T = (s) => (window.VN && VN.t ? VN.t(s) : s);
  const TF = (s, o) => (window.VN && VN.tf ? VN.tf(s, o) : s.replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m)));
  const KINDS = {
    image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif'],
    audio: ['mp3', 'ogg', 'wav', 'm4a', 'flac', 'opus', 'aac'],
    font: ['ttf', 'otf', 'woff', 'woff2'],
    video: ['webm', 'mp4', 'ogv', 'mov']
  };
  const extOf = (n) => (String(n).split('.').pop() || '').toLowerCase();
  const kindOf = (n) => { const e = extOf(n); for (const [k, l] of Object.entries(KINDS)) if (l.includes(e)) return k; return null; };
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', flac: 'audio/flac', opus: 'audio/ogg', aac: 'audio/aac', ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2', webm: 'video/webm', mp4: 'video/mp4', ogv: 'video/ogg', mov: 'video/quicktime', js: 'text/javascript', json: 'application/json', md: 'text/markdown', txt: 'text/plain' };
  const typed = (blob, name) => { const m = MIME[extOf(name)]; return m && blob.type !== m ? new Blob([blob], { type: m }) : blob; };
  const toBlob = (data, name) => (data instanceof Blob ? typed(data, name) : new Blob([data], { type: MIME[extOf(name)] || 'application/octet-stream' }));

  // ---------- IndexedDB: Liste der Projekte und Dateien der Browser-Projekte ----------
  let dbP = null;
  const db = () => dbP || (dbP = new Promise((res, rej) => {
    const r = indexedDB.open('vn-timeline-engine', 1);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' }); if (!d.objectStoreNames.contains('files')) d.createObjectStore('files'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const store = async (name, mode) => (await db()).transaction(name, mode || 'readonly').objectStore(name);
  const Reg = {
    all: async () => {
      const list = await req((await store('projects')).getAll());
      // Einmal pro Sitzung: Dateien ohne Projekt (z. B. von abgebrochenen Importen älterer Versionen) entfernen
      if (!Reg._cleaned) {
        Reg._cleaned = true;
        try {
          const ids = new Set(list.map((m) => m.id));
          const keys = await req((await store('files')).getAllKeys());
          const orphan = new Set(keys.map((k) => String(k).split('/')[0]).filter((id) => !ids.has(id) && id !== '__library'));
          for (const id of orphan) { const st = await store('files', 'readwrite'); await req(st.delete(IDBKeyRange.bound(id + '/', id + '/\uffff'))); }
        } catch (e) { /* Aufräumen ist nur ein Extra */ }
      }
      return list.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    },
    get: async (id) => req((await store('projects')).get(id)),
    put: async (m) => req((await store('projects', 'readwrite')).put(m)),
    remove: async (id) => {
      await req((await store('projects', 'readwrite')).delete(id));
      const s = await store('files', 'readwrite');
      await req(s.delete(IDBKeyRange.bound(id + '/', id + '/￿')));
    }
  };

  // ---------- Dateisysteme: im Browser (IndexedDB) oder ein echter Ordner (File System Access, Chrome/Edge) ----------
  const idbFs = (id) => ({
    kind: 'idb',
    async read(path) { const b = await req((await store('files')).get(id + '/' + path)); return b || null; },
    async write(path, data) { await req((await store('files', 'readwrite')).put(toBlob(data, path), id + '/' + path)); },
    async remove(path) { await req((await store('files', 'readwrite')).delete(id + '/' + path)); },
    async list(prefix) { const keys = await req((await store('files')).getAllKeys(IDBKeyRange.bound(id + '/' + (prefix || ''), id + '/' + (prefix || '') + '￿'))); return keys.map((k) => k.slice(id.length + 1)); },
    async exists(path) { return !!(await req((await store('files')).count(id + '/' + path))); }
  });
  const dirFs = (root) => {
    const dirOf = async (parts, create) => { let d = root; for (const p of parts) d = await d.getDirectoryHandle(p, { create: !!create }); return d; };
    const split = (path) => { const parts = path.split('/').filter(Boolean); return { dirs: parts.slice(0, -1), name: parts[parts.length - 1] }; };
    return {
      kind: 'fsa',
      async read(path) { try { const { dirs, name } = split(path); const d = await dirOf(dirs); return typed(await (await d.getFileHandle(name)).getFile(), name); } catch (e) { return null; } },
      async write(path, data) { const { dirs, name } = split(path); const d = await dirOf(dirs, true); const w = await (await d.getFileHandle(name, { create: true })).createWritable(); await w.write(data instanceof Blob ? data : toBlob(data, name)); await w.close(); },
      async remove(path) { try { const { dirs, name } = split(path); await (await dirOf(dirs)).removeEntry(name); } catch (e) { /* egal */ } },
      async list(prefix) {
        const out = [];
        const walk = async (d, base, depth) => {
          if (depth > 8) return;
          for await (const [n, h] of d.entries()) {
            if (n.startsWith('.')) continue;
            const p = base + n;
            if (h.kind === 'directory') await walk(h, p + '/', depth + 1); else if (!prefix || p.startsWith(prefix)) out.push(p);
          }
        };
        await walk(root, '', 0);
        return out;
      },
      async exists(path) { return !!(await this.read(path)); }
    };
  };

  // ---------- Geöffnetes Projekt ----------
  const cur = { id: null, fs: null, urls: new Map(), meta: null };
  const urlFor = (path, blob) => { const old = cur.urls.get(path); if (old) URL.revokeObjectURL(old); const u = URL.createObjectURL(blob); cur.urls.set(path, u); return u; };
  // Alle Dateien des Projekts als Adressen bereitstellen (Bilder, Töne, Schriften, Plugins)
  const activate = async (meta, fsys) => {
    for (const u of cur.urls.values()) URL.revokeObjectURL(u);
    cur.urls.clear();
    cur.id = meta.id; cur.fs = fsys; cur.meta = meta;
    const files = await fsys.list('');
    for (const f of files) {
      if (f === 'project.json' || /^project\.backup/.test(f)) continue;
      if (!(f.startsWith('assets/') || f.startsWith('plugins/'))) continue;
      const b = await fsys.read(f);
      if (b) urlFor(f, b);
    }
    return 'web:' + meta.id;
  };
  const readJson = async (fsys) => { const b = await fsys.read('project.json'); if (!b) return null; return JSON.parse(await b.text()); };
  const newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const uniquePath = async (rel) => {
    let name = rel, i = 1;
    while (cur.urls.has(name) || (await cur.fs.exists(name))) { const m = rel.match(/^(.*?)(\.[^./]+)?$/); name = m[1] + '_' + (i++) + (m[2] || ''); }
    return name;
  };
  const importFiles = async (files) => {
    const out = [];
    for (const f of files) {
      const kind = kindOf(f.name);
      if (!kind) continue;
      const rel = await uniquePath('assets/' + f.name.replace(/[\\/:*?"<>|]+/g, '_'));
      await cur.fs.write(rel, f);
      urlFor(rel, typed(f, f.name));
      out.push({ name: f.name.replace(/\.[^.]+$/, ''), kind, file: rel });
    }
    return out;
  };
  const touch = async (title) => { if (!cur.meta) return; cur.meta.updated = Date.now(); if (title) cur.meta.name = title; if (cur.meta.kind === 'idb' || cur.meta.handle) await Reg.put(cur.meta); };

  // ---------- Kleine Helfer für Fenster und Dateien ----------
  const pickFiles = (accept, multiple) => new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept || ''; inp.multiple = !!multiple;
    inp.style.display = 'none';
    let done = false;
    inp.onchange = () => { done = true; resolve([...inp.files]); inp.remove(); };
    // Abbrechen erkennen: Fenster bekommt den Fokus zurück, ohne dass Dateien kamen
    window.addEventListener('focus', () => setTimeout(() => { if (!done) { resolve([]); inp.remove(); } }, 800), { once: true });
    document.body.appendChild(inp);
    inp.click();
  });
  const download = (name, blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); };
  const ask = (message, buttons) => new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    const box = document.createElement('div');
    box.className = 'modal';
    box.style.cssText = 'width:440px;display:flex;flex-direction:column;gap:14px';
    const p = document.createElement('div');
    p.style.whiteSpace = 'pre-wrap';
    p.textContent = T(message);
    const row = document.createElement('div');
    row.className = 'row gap8';
    row.style.justifyContent = 'flex-end';
    (buttons || ['OK']).forEach((b, i) => { const btn = document.createElement('button'); btn.className = 'btn' + (i === 0 ? ' primary' : ''); btn.textContent = T(b); btn.onclick = () => { back.remove(); resolve(i); }; row.appendChild(btn); });
    box.append(p, row);
    back.appendChild(box);
    back.addEventListener('mousedown', (e) => { if (e.target === back) { back.remove(); resolve((buttons || ['OK']).length - 1); } });
    document.body.appendChild(back);
  });
  let zipLib = null;
  const JSZipP = () => zipLib || (zipLib = new Promise((res, rej) => { if (window.JSZip) return res(window.JSZip); const s = document.createElement('script'); s.src = 'vendor/jszip.min.js'; s.onload = () => res(window.JSZip); s.onerror = () => rej(new Error('JSZip')); document.head.appendChild(s); }));
  const safeName = (t) => String(t || 'Projekt').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Projekt';

  // Beispiel-, Tutorial- und Lernprojekt kommen fertig aus dem Web-Build (samples/…)
  const sampleInto = async (name, fsys) => {
    const idx = await (await fetch('samples/index.json')).json();
    const files = idx[name] || [];
    for (const f of files) { const r = await fetch('samples/' + name + '/' + f.split('/').map(encodeURIComponent).join('/')); if (r.ok) await fsys.write(f, await r.blob()); }
  };
  const lang = () => (window.VN && VN.I18n && ['de', 'en', 'es', 'ja'].includes(VN.I18n.lang) ? VN.I18n.lang : 'en');
  const docLang = () => (lang() === 'de' ? 'de' : 'en');
  const createProject = async (sample, extra) => {
    const meta = Object.assign({ id: newId(), kind: 'idb', name: T('Neues Projekt'), created: Date.now(), updated: Date.now() }, extra || {});
    const fsys = idbFs(meta.id);
    let data = null;
    if (sample) { await sampleInto(sample, fsys); data = await readJson(fsys); if (data) meta.name = data.title || meta.name; }
    await Reg.put(meta);
    const dir = await activate(meta, fsys);
    return { dir, data };
  };
  const openMeta = async (meta) => {
    let fsys;
    if (meta.kind === 'fsa') {
      if (!meta.handle) throw new Error('Ordner fehlt');
      let perm = await meta.handle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') perm = await meta.handle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') return null;
      fsys = dirFs(meta.handle);
    } else fsys = idbFs(meta.id);
    const data = await readJson(fsys);
    if (!data) { VN.toast(T('In diesem Projekt fehlt die project.json.')); return null; }
    const dir = await activate(meta, fsys);
    await touch();
    return { dir, data };
  };
  const importZip = async (file) => {
    const JSZip = await JSZipP();
    const zip = await JSZip.loadAsync(file);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    const pj = names.filter((n) => /(^|\/)project\.json$/.test(n)).sort((a, b) => a.length - b.length)[0];
    if (!pj) { VN.toast(T('In der ZIP-Datei ist kein Projekt (project.json fehlt).')); return null; }
    const base = pj.slice(0, -'project.json'.length);
    // Grenzen gegen kaputte oder bösartige ZIPs: Dateianzahl und entpackte Gesamtgröße
    const inBase = names.filter((n) => n.startsWith(base));
    const total = inBase.reduce((t, n) => t + ((zip.files[n]._data && zip.files[n]._data.uncompressedSize) || 0), 0);
    if (inBase.length > 50000 || total > 4 * 1024 * 1024 * 1024) { VN.toast(T('Die ZIP-Datei ist zu groß oder enthält zu viele Dateien.')); return null; }
    // project.json zuerst prüfen, bevor irgendetwas in den Browser-Speicher geschrieben wird
    let data = null;
    try { data = JSON.parse(await zip.files[pj].async('string')); } catch (e) { data = null; }
    if (!data || typeof data !== 'object') { VN.toast(T('Die project.json in der ZIP-Datei ist beschädigt.')); return null; }
    const meta = { id: newId(), kind: 'idb', name: file.name.replace(/\.zip$/i, ''), created: Date.now(), updated: Date.now() };
    const fsys = idbFs(meta.id);
    try {
      for (const n of inBase) { const rel = n.slice(base.length); if (!rel || rel.startsWith('.') || rel.includes('/.')) continue; await fsys.write(rel, typed(await zip.files[n].async('blob'), rel)); }
      data = await readJson(fsys);
      if (!data) throw new Error('project.json');
      if (data.title) meta.name = data.title;
      await Reg.put(meta);
    } catch (e) {
      // Abgebrochen (z. B. Speicher voll): alles Geschriebene wieder entfernen, damit nichts unsichtbar liegen bleibt
      try { await Reg.remove(meta.id); } catch (e2) { /* nichts da */ }
      VN.toast(T('Import abgebrochen – es wurde nichts gespeichert.') + ' (' + (e && e.message || e) + ')');
      return null;
    }
    const dir = await activate(meta, fsys);
    return { dir, data };
  };
  const openFolder = async (given) => {
    const handle = given || await window.showDirectoryPicker({ mode: 'readwrite' });
    const fsys = dirFs(handle);
    let data = await readJson(fsys);
    const all = await Reg.all();
    for (const m of all) if (m.kind === 'fsa' && m.handle && (await m.handle.isSameEntry(handle).catch(() => false))) { const dir = await activate(m, fsys); await touch(); return { dir, data }; }
    const meta = { id: newId(), kind: 'fsa', handle, name: (data && data.title) || handle.name, created: Date.now(), updated: Date.now() };
    await Reg.put(meta);
    const dir = await activate(meta, fsys);
    return { dir, data };
  };
  // Projekt als ZIP herunterladen (Sicherung, Weitergeben, in die Desktop-Version übernehmen)
  const projectZip = async () => {
    if (!cur.fs) return;
    if (window.VN && VN.save) await VN.save();
    const JSZip = await JSZipP();
    const zip = new JSZip();
    const root = safeName(cur.meta && cur.meta.name) + '/';
    for (const f of await cur.fs.list('')) { if (/^project\.backup/.test(f)) continue; const b = await cur.fs.read(f); if (b) zip.file(root + f, b); }
    download(safeName(cur.meta && cur.meta.name) + '.zip', await zip.generateAsync({ type: 'blob' }));
  };

  // ---------- Web-Export des Spiels als ZIP (wie export:web in der Desktop-Version) ----------
  const exportWeb = async ({ data, files }) => {
    const JSZip = await JSZipP();
    const info = await (await fetch('engine-files.json')).json();
    const zip = new JSZip();
    const root = safeName(data.title) + ' (Web)/';
    const conv = {};
    for (const f of files || []) conv[f.file] = f.bytes;
    // Gepackt (0.9.7): alles verschlüsselt in data.vnpak; im Browser gibt es keinen Mod-Ordner
    const packed = !!(data.export && data.export.pack && data.export.pack !== 'open');
    if (packed && data.export.pack === 'packmods') data = Object.assign({}, data, { export: Object.assign({}, data.export, { pack: 'pack' }) });
    const pakFiles = [];
    const seen = new Set();
    for (const a of data.assets || []) {
      const rel = String(a.file || '');
      if (!rel || rel.includes('..') || seen.has(rel)) continue;
      seen.add(rel);
      let b = conv[rel] ? conv[rel] : await cur.fs.read(rel);
      if (!b) continue;
      if (packed) pakFiles.push({ rel, bytes: b instanceof Uint8Array ? b : new Uint8Array(b instanceof Blob ? await b.arrayBuffer() : b) });
      else zip.file(root + rel, b);
    }
    if (packed) zip.file(root + 'data.vnpak', VNPak.buildInMemory(pakFiles, data));
    const plugins = Object.entries(data.plugins || {}).filter(([, v]) => v && v.enabled).map(([k]) => k).filter((k) => /^[^/\\]+\.js$/i.test(k));
    for (const f of plugins) { const b = await cur.fs.read('plugins/' + f); if (b) zip.file(root + 'plugins/' + f, b); }
    for (const f of info.engine) { const r = await fetch(f); if (r.ok) zip.file(root + 'engine/' + f.split('/').pop(), await r.blob()); }
    if (!packed) zip.file(root + 'engine/game-data.js', 'window.VN_GAME = ' + JSON.stringify(data) + ';');
    try { const r = await fetch('LICENSE.txt'); if (r.ok) zip.file(root + 'engine/LICENSE.txt', await r.blob()); } catch (e) { /* egal */ }
    const esc = (t) => String(t).replace(/[<&>]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
    const html = `<!doctype html>\n<html lang="${((l) => (/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(l) ? l : 'de'))(String((data.languages && data.languages[0]) || 'de'))}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(data.title || 'Spiel')}</title>\n<link rel="stylesheet" href="engine/style.css">\n<style>html,body{background:#000;overflow:hidden}</style>\n</head>\n<body>\n<div id="player"></div><div id="toast"></div><div id="ctxmenu" hidden></div>\n` +
      info.web.filter((f) => !(packed && f === 'game-data.js')).map((f) => `<script src="engine/${f}"></script>`).join('\n') + '\n' +
      plugins.map((f) => `<script>VNPlugin._current = ${JSON.stringify(f)};</script><script src="plugins/${encodeURIComponent(f)}"></script>`).join('\n') + '\n<script src="engine/player.js"></script>\n<script>' + (packed ? 'VNWeb.startPacked("data.vnpak");' : 'VNWeb.start();') + '</script>\n</body>\n</html>\n';
    zip.file(root + 'index.html', html);
    const de = String((data.languages || ['de'])[0]).startsWith('de');
    if (de) zip.file(root + 'LIES MICH.txt', 'Web-Version von "' + (data.title || 'Spiel') + '"\r\n\r\nFür itch.io: diese ZIP-Datei hochladen und "This file will be played in the browser" wählen.\r\n');
    else zip.file(root + 'README.txt', 'Web version of "' + (data.title || 'Game') + '"\r\n\r\nFor itch.io: upload this ZIP file and choose "This file will be played in the browser".\r\n');
    const name = safeName(data.title) + ' (Web).zip';
    download(name, await zip.generateAsync({ type: 'blob' }));
    return { ok: true, dest: name };
  };

  // ---------- „Projekt öffnen“: Liste der Browser-Projekte, Ordner (Chrome/Edge) oder ZIP ----------
  const openDialog = () => new Promise(async (resolve) => {
    const all = await Reg.all();
    const back = document.createElement('div');
    back.className = 'modal-back';
    const box = document.createElement('div');
    box.className = 'modal web-open';
    const finish = (v) => { back.remove(); resolve(v); };
    const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    box.appendChild(h('strong', 'web-open-title', T('Projekt öffnen')));
    const list = h('div', 'web-plist');
    if (!all.length) list.appendChild(h('div', 'muted small', T('Noch keine Projekte in diesem Browser.')));
    for (const m of all) {
      const row = h('div', 'web-prow');
      const b = h('button', 'btn web-pbtn');
      b.append(h('span', 'web-pname', m.name || '?'), h('span', 'muted small', (m.kind === 'fsa' ? '📁 ' + T('Ordner auf dem PC') : '🌐 ' + T('im Browser')) + ' · ' + new Date(m.updated || m.created || Date.now()).toLocaleString()));
      b.onclick = async () => { try { finish(await openMeta(m)); } catch (e) { VN.toast(String(e.message || e)); } };
      const del = h('button', 'btn tiny danger', '×');
      del.title = m.kind === 'fsa' ? T('Aus der Liste nehmen (der Ordner bleibt)') : T('Projekt löschen');
      del.onclick = async () => {
        const ok = await ask(m.kind === 'fsa' ? TF('„{n}“ aus der Liste nehmen? Der Ordner auf dem PC bleibt erhalten.', { n: m.name }) : TF('Projekt „{n}“ endgültig aus diesem Browser löschen? Lade es vorher als ZIP herunter, wenn du es behalten willst.', { n: m.name }), [T('Löschen'), T('Abbrechen')]);
        if (ok === 0) { await Reg.remove(m.id); row.remove(); }
      };
      row.append(b, del);
      list.appendChild(row);
    }
    box.appendChild(list);
    const btns = h('div', 'row gap8 web-open-btns');
    if (window.showDirectoryPicker) {
      const f = h('button', 'btn', '📁 ' + T('Ordner auf dem PC öffnen …'));
      f.title = T('Ein Projektordner (mit project.json) – Änderungen werden direkt dort gespeichert, wie in der Desktop-Version.');
      f.onclick = async () => { try { finish(await openFolder()); } catch (e) { if (e && e.name !== 'AbortError') VN.toast(String(e.message || e)); } };
      btns.appendChild(f);
    }
    const z = h('button', 'btn', '🗜 ' + T('ZIP-Datei öffnen …'));
    z.onclick = async () => { const [file] = await pickFiles('.zip'); if (!file) return; try { finish(await importZip(file)); } catch (e) { VN.toast(T('ZIP konnte nicht geöffnet werden') + ': ' + (e.message || e)); } };
    btns.append(z, h('div', 'spacer'));
    const c = h('button', 'btn', T('Abbrechen'));
    c.onclick = () => finish(null);
    btns.appendChild(c);
    box.appendChild(btns);
    if (!window.showDirectoryPicker) box.appendChild(h('div', 'muted small', T('Tipp: In Chrome oder Edge kannst du auch direkt einen Projektordner auf dem PC öffnen.')));
    back.appendChild(box);
    back.addEventListener('mousedown', (e) => { if (e.target === back) finish(null); });
    document.body.appendChild(back);
  });

  // ---------- Die Schnittstelle (gleiche Namen wie preload.js) ----------
  const tokens = new Map();
  let tokenN = 0;
  window.vnApi = {
    web: true,
    async learnProject() {
      const all = await Reg.all();
      const m = all.find((x) => x.learn && x.lang === lang());
      if (m) { const r = await openMeta(m); if (r) return r; }
      const r = await createProject('learn-' + lang(), { learn: true, lang: lang() });
      return Object.assign(r, { fresh: true });
    },
    async newProject(kind) {
      const demo = kind === true || kind === 'demo', tut = kind === 'tutorial';
      return createProject(tut ? 'tutorial-' + lang() : demo ? 'demo-' + lang() : null);
    },
    openProject: () => openDialog(),
    async saveProject(dir, data) { if (!cur.fs || dir !== 'web:' + cur.id) return false; await cur.fs.write('project.json', typeof data === 'string' ? data : JSON.stringify(data, null, 1)); let title = null; try { title = (VN.project && VN.project.title) || null; } catch (e) { /* egal */ } await touch(title); return true; },
    async backupProject(dir, label) {
      if (!cur.fs) return null;
      const b = await cur.fs.read('project.json');
      if (!b) return null;
      const safe = String(label || 'alt').replace(/[^\w.-]+/g, '-').slice(0, 60);
      let name = 'project.backup-' + safe + '.json';
      for (let i = 2; await cur.fs.exists(name); i++) name = 'project.backup-' + safe + '-' + i + '.json';
      await cur.fs.write(name, b);
      return name;
    },
    async setDir(dir) { return !!cur.fs && dir === 'web:' + cur.id; },
    async pickAssets(dir, kind) {
      const acc = kind && KINDS[kind] ? KINDS[kind].map((e) => '.' + e).join(',') : Object.values(KINDS).flat().map((e) => '.' + e).join(',');
      const files = await pickFiles(acc, true);
      return files.length ? importFiles(files) : [];
    },
    async copyAssets(dir, paths) { const files = (paths || []).map((p) => tokens.get(p)).filter(Boolean); for (const p of paths || []) tokens.delete(p); return importFiles(files); },
    // Hineingezogene Dateien haben im Browser keinen Pfad: ein Platzhalter, der beim Kopieren aufgelöst wird
    pathForFile(file) { if (!file || !kindOf(file.name)) return ''; const t = 'webfile:' + (++tokenN) + ':' + file.name; tokens.set(t, file); return t; },
    async writeAsset(dir, rel, bytes) {
      if (!cur.fs) return null;
      rel = String(rel || '').replace(/\\/g, '/');
      if (!/^assets\//.test(rel) || rel.includes('..') || !kindOf(rel)) return null;
      const name = await uniquePath(rel);
      const blob = toBlob(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), name);
      await cur.fs.write(name, blob);
      urlFor(name, blob);
      return name;
    },
    async statFiles(rels) { const out = []; for (const rel of rels || []) { const b = cur.fs && (await cur.fs.read(rel)); out.push(b ? { file: rel, size: b.size } : { file: rel, size: 0, missing: true }); } return out; },
    async engineSize() { return null; },
    async saveText(name, text) { download(name, new Blob([text], { type: 'text/plain;charset=utf-8' })); return true; },
    async saveBinary(name, bytes) { download(name, new Blob([bytes])); return true; },
    async openText(ext) { const exts = String(ext || 'txt').split(',').map((x) => '.' + x.trim()).join(','); const [f] = await pickFiles(exts); return f ? f.text() : null; },
    async writeGuide(text) { if (!cur.fs) return false; await cur.fs.write('AI-GUIDE.md', text); return true; },
    setUiLang() {},
    onFlush() {},
    confirm: (message, buttons) => ask(message, buttons),
    async gameInfo() { return { game: false }; },
    async quit() {},
    async fullscreen(on) { try { if (on) await document.documentElement.requestFullscreen(); else if (document.fullscreenElement) await document.exitFullscreen(); } catch (e) { /* egal */ } return !!document.fullscreenElement; },
    async openPath() { await projectZip(); return true; },
    downloadProject: () => projectZip(),
    // Spielstände beim Testen: im Browser, je Projekt getrennt
    saves: {
      async list() { const pre = 'vntest:' + cur.id + ':'; const out = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(pre)) { try { out[k.slice(pre.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* defekt */ } } } return out; },
      async write(slot, data) { try { localStorage.setItem('vntest:' + cur.id + ':' + slot, JSON.stringify(data)); return true; } catch (e) { VN.toast(T('Speicherplatz im Browser ist voll.')); return false; } },
      async remove(slot) { localStorage.removeItem('vntest:' + cur.id + ':' + slot); return true; }
    },
    plugins: {
      async list() { if (!cur.fs) return []; return (await cur.fs.list('plugins/')).map((p) => p.slice(8)).filter((f) => !f.includes('/') && /\.js$/i.test(f)); },
      async read(name) { const b = cur.fs && (await cur.fs.read('plugins/' + String(name).split('/').pop())); return b ? b.text() : ''; },
      async write(name, text) { if (!cur.fs || !/\.js$/i.test(String(name || ''))) return false; const rel = 'plugins/' + String(name).split('/').pop(); const blob = toBlob(text, rel); await cur.fs.write(rel, blob); urlFor(rel, blob); return true; },
      async addExample() { for (const f of ['schlossknacken.js', 'PLUGINS.md']) { const rel = 'plugins/' + f; if (await cur.fs.exists(rel)) continue; const r = await fetch('templates/' + (f === 'PLUGINS.md' && docLang() === 'en' ? 'PLUGINS.en.md' : f)); if (r.ok) { const b = typed(await r.blob(), f); await cur.fs.write(rel, b); urlFor(rel, b); } } return true; },
      async bundledText(name) { const f = String(name).split('/').pop(); if (!['jobs.js', 'minispiele.js', 'spielhalle.js'].includes(f)) return null; const r = await fetch('templates/' + f); return r.ok ? r.text() : null; },
      async addBundled(name, force) {
        const f = String(name).split('/').pop();
        if (!['jobs.js', 'minispiele.js', 'spielhalle.js'].includes(f) || !cur.fs) return false;
        const rel = 'plugins/' + f;
        if (force || !(await cur.fs.exists(rel))) { const r = await fetch('templates/' + f); if (!r.ok) return false; const b = typed(await r.blob(), f); await cur.fs.write(rel, b); urlFor(rel, b); }
        if (!(await cur.fs.exists('plugins/PLUGINS.md'))) { const r = await fetch('templates/' + (docLang() === 'en' ? 'PLUGINS.en.md' : 'PLUGINS.md')); if (r.ok) await cur.fs.write('plugins/PLUGINS.md', await r.blob()); }
        return true;
      }
    },
    async exportWindows() { return { ok: false, msg: T('Die Windows-Version eines Spiels lässt sich nur mit der Desktop-Version der Engine bauen. Im Browser: Web-Export (ZIP, z. B. für itch.io).') }; },
    exportWeb: (payload) => exportWeb(payload),
    // Asset-Bibliothek (0.9.24): im Browser in IndexedDB, für alle Browser-Projekte
    library: (() => {
      const L = idbFs('__library'), urls = new Map();
      const list = async () => { const b = await L.read('index.json'); try { return b ? JSON.parse(await b.text()) : []; } catch (e) { return []; } };
      const save = async (x) => L.write('index.json', new Blob([JSON.stringify(x)], { type: 'application/json' }));
      return {
        list,
        async add(items, folder) {
          const x = await list(); let added = 0;
          for (const it of items || []) {
            const b = cur.fs && it && it.file ? await cur.fs.read(it.file) : null;
            if (!b || !kindOf(it.file)) continue;
            if (x.some((y) => y.name === it.name && y.size === b.size && y.kind === kindOf(it.file))) continue;
            const id = 'lib' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), file = id + '.' + extOf(it.file);
            await L.write('files/' + file, b);
            x.push({ id, name: String(it.name || 'Datei').slice(0, 120), kind: kindOf(it.file), file, folder: String(folder || it.folder || '').slice(0, 120), size: b.size, added: Date.now() });
            added++;
          }
          await save(x);
          return { added, list: x };
        },
        async update(id, f) { const x = await list(), y = x.find((z) => z.id === id); if (y) { if (f.name != null) y.name = String(f.name).slice(0, 120); if (f.folder != null) y.folder = String(f.folder).slice(0, 120); await save(x); } return x; },
        async remove(ids) { const set = new Set(ids || []); const x = await list(); for (const y of x) if (set.has(y.id)) await L.remove('files/' + y.file); const rest = x.filter((y) => !set.has(y.id)); await save(rest); return rest; },
        async import(ids) {
          const want = new Set(ids || []), files = [];
          for (const y of await list()) { if (!want.has(y.id)) continue; const b = await L.read('files/' + y.file); if (b) files.push(new File([b], (y.name || 'datei').replace(/[\\/:*?"<>|]+/g, '_') + '.' + extOf(y.file), { type: b.type })); }
          return importFiles(files);
        },
        url(y) { if (urls.has(y.file)) return urls.get(y.file); const p = L.read('files/' + y.file).then((b) => (b ? URL.createObjectURL(typed(b, y.file)) : '')); urls.set(y.file, ''); p.then((u) => { urls.set(y.file, u); document.querySelectorAll('[data-lib="' + y.file + '"]').forEach((n) => { if (n.tagName === 'AUDIO') n.src = u; else n.style.backgroundImage = 'url("' + u + '")'; }); }); return ''; }
      };
    })(),
    // Dateien des Projekts: Blob-Adressen. Plugins bekommen ein „#“, damit ein angehängtes „?t=…“ nicht stört
    fileUrl(dir, rel) { const u = cur.urls.get(String(rel || '').replace(/\\/g, '/')); return u ? (rel.startsWith('plugins/') ? u + '#' : u) : ''; }
  };

  // Browser soll die Projekte nicht von selbst löschen, wenn der Speicher knapp wird
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* egal */ }
  // Beim Verlassen oder Verstecken des Tabs speichern
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && window.VN && VN.dirty && VN.save) VN.save(); });

  // ---------- Startbildschirm: Hinweis zur Web-Version und die zuletzt benutzten Projekte ----------
  const welcome = async () => {
    const card = document.querySelector('#welcome .welcome-card');
    if (!card || card.querySelector('.web-note')) return;
    // Deutsche Texte direkt ins DOM: die Oberflächen-Übersetzung tauscht sie aus, auch beim Sprachwechsel
    const W = (x) => x;
    const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    const note = h('div', 'web-note');
    note.append(h('strong', null, '🌐 ' + W('Web-Version')), h('span', null, ' ' + W('Läuft ohne Installation. Projekte werden in diesem Browser gespeichert – lade sie über „Projekt ▾ → Als ZIP herunterladen“ als Sicherung herunter.') + ' '));
    const a = h('a', null, W('Desktop-Version herunterladen'));
    a.href = 'https://github.com/TheTalkingPegasus/vn-timeline-engine/releases/latest';
    a.target = '_blank'; a.rel = 'noopener';
    note.appendChild(a);
    card.insertBefore(note, card.querySelector('.welcome-actions'));
    const all = await Reg.all().catch(() => []);
    const recent = all.filter((m) => !m.learn).slice(0, 4);
    if (recent.length) {
      const box = h('div', 'web-recent');
      box.appendChild(h('div', 'muted small', W('Zuletzt bearbeitet')));
      for (const m of recent) {
        const b = h('button', 'btn web-pbtn');
        b.append(h('span', 'web-pname', m.name || '?'), h('span', 'muted small', m.kind === 'fsa' ? '📁 ' + W('Ordner auf dem PC') : '🌐 ' + W('im Browser')));
        b.onclick = async () => { try { const r = await openMeta(m); if (r) App.load(r.dir, r.data); } catch (e) { VN.toast(String(e.message || e)); } };
        box.appendChild(b);
      }
      card.insertBefore(box, card.querySelector('.welcome-actions').nextSibling);
    }
    const foot = card.querySelector('p.muted.small:last-child');
    if (foot) foot.textContent = W('Projekte werden automatisch gespeichert – im Browser oder (Chrome/Edge) direkt in einem Ordner auf dem PC.');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(welcome, 50)); else setTimeout(welcome, 50);
  window.VNWebEditor = { cur, Reg, projectZip, openFolder, openMeta, refreshWelcome: () => { document.querySelectorAll('.web-note, .web-recent').forEach((n) => n.remove()); welcome(); } };
})();
