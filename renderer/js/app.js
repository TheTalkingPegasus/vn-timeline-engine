// App: Start, Layout, Seitenleisten, Tastatur
(function () {
  const { el, api } = VN;

  const App = (window.App = {
    async load(dir, data, opts) {
      opts = opts || {};
      // Projekt aus einer neueren Engine-Version: lieber nachfragen, sonst gehen neue Daten verloren
      if (data && VN.Schema && VN.Schema.tooNew(data)) {
        const r = await api.confirm('Dieses Projekt wurde mit einer neueren Version der VN Timeline Engine gespeichert (' + (data.engine || '?') + '). Beim Öffnen und Speichern können Daten verloren gehen, die diese Version nicht kennt.', ['Abbrechen', 'Trotzdem öffnen']);
        if (r !== 1) return;
      }
      VN.dir = dir;
      await api.setDir(dir);
      if (VN.Schema) VN.Schema.last = null;
      data = data || { version: 1, title: VN.t('Neues Projekt'), startScene: null, assets: [], scenes: [], counter: 0, languages: [VN.I18n.lang] };
      if (opts.fresh || !data.scenes || !data.scenes.length) data.schema = data.schema || (VN.Schema ? VN.Schema.CURRENT : 0);
      data.assets = data.assets || [];
      data.scenes = data.scenes || [];
      VN.project = data;
      if (!data.scenes.length) {
        const s = VN.newStoryScene(VN.t('Szene 1'), 80, 200);
        data.startScene = s.id;
      }
      for (const s of data.scenes) VN.ensureTracks(s);
      VN.migrate(data);
      // Altes Projekt umgewandelt: vorher eine Sicherungskopie der Projektdatei anlegen
      const mig = VN.Schema && VN.Schema.last;
      if (mig && !opts.fresh && dir && api.backupProject) {
        const label = 'format' + mig.from + (mig.engine ? '-' + mig.engine : '');
        const b = await api.backupProject(dir, label);
        if (b) setTimeout(() => VN.toast('Projekt auf das neue Format umgestellt · Sicherung: ' + b), 900);
      }
      // Beispielprojekt: Figuren bekommen automatisch ein Skelett
      if (data.autoRig) {
        for (const [assetId, kind] of data.autoRig) {
          try { const info = await Rig.analyze(assetId); data.rigs[assetId] = Rig.template(kind, info.bbox); } catch (e) { console.warn(e); }
        }
        delete data.autoRig;
      }
      await VNPlugin.load();
      VN.undoStack = [];
      VN.redoStack = [];
      VN.ui.sceneId = VN.scene(data.startScene) ? data.startScene : data.scenes[0].id;
      VN.ui.sel = null;
      VN.ui.beat = 0;
      VN.ui.view = 'scene';
      Graph._fitted = false;
      document.getElementById('welcome').hidden = true;
      document.getElementById('app').hidden = false;
      // Frisch geladen: einmal speichern (Formatumwandlung, Versionsstempel)
      VN.saveRev++;
      VN.dirty = true;
      VN.save();
      VN.render();
      if (data.tutorial && !VN.ui.noAutoTour) setTimeout(() => Tour.start('main'), 500);
      // Vorschaubild für „Zuletzt geöffnet“ (nach dem ersten Speichern)
      setTimeout(() => App.recentThumb(), 1500);
      Export.stats = null;
      Export.badgeSoon();
    },

    openBones(assetId) {
      VN.ui.view = 'bones';
      VN.ui.figSub = 'bones';
      VN.ui.boneAsset = assetId;
      VN.ui.boneSel = null;
      VN.render();
    },

    openScene(id) {
      VN.ui.sceneId = id;
      VN.ui.sel = null;
      VN.ui.beat = 0;
      VN.ui.view = 'scene';
      VN.render();
    },

    async newProject(kind) {
      const r = await api.newProject(kind);
      if (!r) return;
      // Leeres Projekt: zuerst die Spiel-Auflösung wählen
      if (!r.data) { const res = await Export.ask(); r.data = { version: 1, title: 'Neues Projekt', startScene: null, assets: [], scenes: [], counter: 0, resolution: res }; }
      App.load(r.dir, r.data, { fresh: true });
    },
    async openProject() {
      const r = await api.openProject();
      if (r) App.load(r.dir, r.data);
    },
    // Zuletzt geöffnete Projekte (0.9.37)
    async openRecent(dir) {
      const r = await api.recentOpen(dir);
      if (r) App.load(r.dir, r.data);
      else App.renderRecent();
    },
    // Bild für die Liste: erster Hintergrund der Startszene (sonst irgendeiner), 320 × 180
    recentThumb() {
      const p = VN.project;
      if (!p || !api.recentThumb) return;
      const scenes = (p.scenes || []).slice().sort((a, b) => (b.id === p.startScene) - (a.id === p.startScene));
      let id = null;
      for (const sc of scenes) { const c = sc.tracks && (sc.tracks.bg || []).find((x) => x && x.asset && (p.assets || []).some((a) => a.id === x.asset && a.kind === 'image')); if (c) { id = c.asset; break; } }
      if (!id) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180;
          const g = cv.getContext('2d'), iw = img.naturalWidth || 320, ih = img.naturalHeight || 180, k = Math.max(320 / iw, 180 / ih);
          g.fillStyle = '#0e0f13'; g.fillRect(0, 0, 320, 180);
          g.drawImage(img, (320 - iw * k) / 2, (180 - ih * k) / 2, iw * k, ih * k);
          api.recentThumb(cv.toDataURL('image/jpeg', 0.8));
        } catch (e) { /* ohne Bild */ }
      };
      img.src = VN.assetUrl(id);
    },
    recentWhen(t) {
      const d = new Date(t), now = new Date(), lang = (VN.I18n && VN.I18n.lang) || 'de';
      const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
      const diff = Math.round((day(now) - day(d)) / 86400000);
      const hm = d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
      if (diff === 0) return VN.t('heute') + ' ' + hm;
      if (diff === 1) return VN.t('gestern') + ' ' + hm;
      return d.toLocaleDateString(lang, { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
    },
    async renderRecent() {
      const box = document.getElementById('w-recent'), card = document.getElementById('welcome-card');
      if (!box || !api.recentList) return;
      let list = [];
      try { list = await api.recentList(); } catch (e) { list = []; }
      box.innerHTML = '';
      box.hidden = !list.length;
      card.classList.toggle('has-recent', !!list.length);
      if (!list.length) return;
      box.appendChild(el('div', { class: 'w-recent-head' }, el('h2', null, VN.t('Zuletzt geöffnet')), el('span', { class: 'muted small' }, VN.t('Klick öffnet das Projekt'))));
      const ul = el('div', { class: 'w-recent-list' });
      for (const r of list) {
        const item = el('div', { class: 'w-rc' + (r.ok ? '' : ' missing'), title: r.dir, onclick: () => { if (r.ok) App.openRecent(r.dir); } },
          el('div', { class: 'w-rc-thumb', style: r.thumb ? { backgroundImage: `url("${r.thumb}")` } : {} }, r.thumb ? null : '🎬'),
          el('div', { class: 'w-rc-txt' },
            el('div', { class: 'w-rc-title', 'data-notr': '' }, r.title || '—'),
            el('div', { class: 'w-rc-path muted small', 'data-notr': '' }, '\u200E' + r.dir + '\u200E'),
            el('div', { class: 'w-rc-meta muted small' }, r.ok ? App.recentWhen(r.time) + (r.scenes ? ' · ' + r.scenes + ' ' + VN.t(r.scenes === 1 ? 'Szene' : 'Szenen') : '') : VN.t('Ordner nicht gefunden'))),
          el('div', { class: 'w-rc-acts' },
            r.ok ? el('button', { class: 'btn ghost tiny', title: VN.t('Ordner öffnen'), onclick: (e) => { e.stopPropagation(); api.recentShow(r.dir); } }, '📁') : null,
            el('button', { class: 'btn ghost tiny', title: VN.t('Aus der Liste entfernen (das Projekt bleibt erhalten)'), onclick: async (e) => { e.stopPropagation(); await api.recentRemove(r.dir); App.renderRecent(); } }, '✕')));
        ul.appendChild(item);
      }
      box.appendChild(ul);
    },

    // Szenenliste mit Kapiteln (Ordnern) und Suche
    renderScenes() {
      const list = document.getElementById('scene-list');
      list.innerHTML = '';
      const p = VN.project;
      const reach = VN.reachable();
      const q = (VN.ui.sceneQ || '').trim().toLowerCase();
      const closed = VN.ui.chClosed = VN.ui.chClosed || {};
      const chapters = VN.chapters();
      const hit = (s) => VN.sceneMatch(s, q);
      const item = (s, m) => {
        const it = el('div', {
          class: 'list-item' + (s.id === VN.ui.sceneId && VN.ui.view === 'scene' ? ' active' : '') + (chapters.length ? ' in-ch' : ''),
          title: s.name, draggable: 'true',
          onclick: () => App.openScene(s.id)
        },
          el('span', { class: 'dot', style: { background: s.type === 'hub' ? '#f0f0f3' : '#4fb3c8' } }),
          el('span', { class: 'name' }, s.name, m && m !== true ? el('span', { class: 'sc-hit' }, m) : null),
          p.startScene === s.id ? el('span', { class: 'badge' }, 'START') : null,
          reach.has(s.id) ? null : el('span', { class: 'badge gray', title: 'Wird nirgends betreten (kein Weg führt hierher)' }, '!'));
        it.addEventListener('dragstart', (e) => { e.dataTransfer.setData('vn/scene', s.id); e.dataTransfer.effectAllowed = 'move'; });
        it.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          VN.menu(e.clientX, e.clientY, [
            { head: s.name },
            { label: 'Öffnen', action: () => App.openScene(s.id) },
            { label: '▶ Ab hier testen', action: () => Player.start(s.id) },
            { label: 'Als Startszene festlegen', action: () => VN.mutate(() => { p.startScene = s.id; }) },
            { label: 'Duplizieren', action: () => VN.mutate(() => { const c = JSON.parse(JSON.stringify(s)); c.id = VN.uid(s.type === 'hub' ? 'h' : 's'); c.name = s.name + ' (Kopie)'; c.x = (s.x || 0) + 40; c.y = (s.y || 0) + 40; p.scenes.push(c); VN.ui.sceneId = c.id; }) },
            'sep',
            ...chapters.filter((c) => c !== s.chapter).map((c) => ({ label: '📁 Nach „' + c + '“ verschieben', action: () => VN.mutate(() => { s.chapter = c; }) })),
            s.chapter ? { label: 'Aus dem Kapitel nehmen', action: () => VN.mutate(() => { delete s.chapter; }) } : null,
            { label: '📁 In neues Kapitel …', action: async () => { const n = await VN.prompt('Name des Kapitels', VN.t('Kapitel ') + (chapters.length + 1)); if (n) VN.mutate(() => { VN.addChapter(n); s.chapter = n; }); } },
            'sep',
            { label: 'Löschen', danger: true, action: () => VN.deleteScene(s.id) }
          ].filter(Boolean));
        });
        return it;
      };
      const dropOn = (node, chapter) => {
        node.addEventListener('dragover', (e) => { if (Array.from(e.dataTransfer.types).includes('vn/scene')) { e.preventDefault(); node.classList.add('drop'); } });
        node.addEventListener('dragleave', () => node.classList.remove('drop'));
        node.addEventListener('drop', (e) => {
          const id = e.dataTransfer.getData('vn/scene'); node.classList.remove('drop');
          if (!id) return;
          e.preventDefault(); e.stopPropagation();
          VN.mutate(() => { const s = VN.scene(id); if (!s) return; if (chapter) s.chapter = chapter; else delete s.chapter; });
        });
      };
      let shown = 0;
      const groups = [['', p.scenes.filter((s) => !s.chapter || !chapters.includes(s.chapter))], ...chapters.map((c) => [c, p.scenes.filter((s) => s.chapter === c)])];
      for (const [ch, scenes] of groups) {
        const vis = scenes.map((s) => [s, q ? hit(s) : true]).filter(([, m]) => m);
        if (ch) {
          if (q && !vis.length) continue;
          const open = q ? true : !closed[ch];
          const head = el('div', { class: 'ch-head' + (open ? '' : ' closed'), title: 'Klick: auf-/zuklappen · Rechtsklick: umbenennen, löschen · Szenen hierher ziehen',
            onclick: () => { closed[ch] = !closed[ch]; App.renderScenes(); } },
            el('span', { class: 'ch-arrow' }, open ? '▾' : '▸'), el('span', { class: 'ch-ico' }, '📁'), el('span', { class: 'name' }, ch), el('span', { class: 'ch-n' }, String(scenes.length)));
          head.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const i = chapters.indexOf(ch);
            VN.menu(e.clientX, e.clientY, [
              { head: '📁 ' + ch },
              { label: 'Umbenennen …', action: async () => { const n = await VN.prompt('Neuer Name', ch); if (n && n !== ch) VN.mutate(() => VN.renameChapter(ch, n)); } },
              { label: '+ Story-Szene hier', action: () => VN.mutate(() => { const s = VN.newStoryScene(); s.chapter = ch; VN.ui.sceneId = s.id; VN.ui.view = 'scene'; }) },
              { label: '+ Hub-Szene hier', action: () => VN.mutate(() => { const s = VN.newHubScene(); s.chapter = ch; VN.ui.sceneId = s.id; VN.ui.view = 'scene'; }) },
              { label: 'Nach oben', disabled: i === 0, action: () => VN.mutate(() => { const l = VN.chapters(); [l[i - 1], l[i]] = [l[i], l[i - 1]]; p.chapters = l; }) },
              { label: 'Nach unten', disabled: i === chapters.length - 1, action: () => VN.mutate(() => { const l = VN.chapters(); [l[i + 1], l[i]] = [l[i], l[i + 1]]; p.chapters = l; }) },
              { label: 'In den Pfaden zeigen', action: () => { VN.ui.view = 'graph'; VN.ui.graphChapter = ch; VN.render(); } },
              'sep',
              { label: 'Kapitel auflösen (Szenen bleiben)', danger: true, action: () => VN.mutate(() => { p.chapters = VN.chapters().filter((x) => x !== ch); for (const s of p.scenes) if (s.chapter === ch) delete s.chapter; }) }
            ]);
          });
          dropOn(head, ch);
          list.appendChild(head);
          if (!open) continue;
        } else if (chapters.length && vis.length) {
          const loose = el('div', { class: 'ch-head loose' }, el('span', { class: 'name muted' }, 'Ohne Kapitel'));
          dropOn(loose, '');
          list.appendChild(loose);
        }
        for (const [s, m] of vis) { list.appendChild(item(s, m)); shown++; }
      }
      if (q && !shown) list.appendChild(el('div', { class: 'empty-hint' }, 'Nichts gefunden für „' + VN.ui.sceneQ + '“.'));
    },

    renderAssets() {
      const tab = VN.ui.assetTab;
      document.querySelectorAll('#asset-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
      const list = document.getElementById('asset-list');
      list.className = 'asset-list' + (tab !== 'image' ? ' audio' : '');
      list.innerHTML = '';
      if (tab === 'fx') { Tools.library(list); return; }
      const items = VN.assetsOf(tab);
      const empty = { image: 'Noch keine Bilder. Importieren oder hierher ziehen.', audio: 'Noch keine Audiodateien. Importieren oder hierher ziehen.', font: 'Noch keine Schriften (TTF, OTF, WOFF). Importieren oder hierher ziehen.', video: 'Noch keine Videos (WebM, MP4).' };
      // Ordner (0.8.0): nur zur Übersicht im Editor – die Engine braucht sie nicht. Liegt eine Datei auf dem PC in einem
      // Unterordner von „assets“, steht sie automatisch im gleichen Ordner.
      const F = App.folders(tab);
      const open = VN.ui.assetOpen = VN.ui.assetOpen || {};
      list.appendChild(el('div', { class: 'af-bar' },
        el('button', { class: 'btn tiny', title: VN.t('Neuer Ordner (mit / für Unterordner, z. B. Figuren/Ray)'), onclick: async () => { const n = await VN.prompt(VN.t('Name des Ordners (Unterordner mit /)'), ''); const f = App.cleanFolder(n); if (f) VN.mutate(() => { App.addFolder(tab, f); open[tab + ':' + f] = true; }); } }, '+ 📁'),
        F.length ? el('button', { class: 'btn tiny', onclick: () => { const all = F.every((f) => open[tab + ':' + f]); for (const f of F) open[tab + ':' + f] = !all; App.renderAssets(); } }, F.every((f) => open[tab + ':' + f]) ? VN.t('alle zu') : VN.t('alle auf')) : null,
        el('span', { class: 'muted small af-hint' }, F.length ? VN.t('Dateien auf einen Ordner ziehen') : '')));
      if (!items.length) list.appendChild(el('div', { class: 'empty-hint' }, empty[tab] || ''));
      const folderOf = (a) => App.folderOf(a);
      const visible = (f) => { const parts = f.split('/'); for (let i = 1; i < parts.length; i++) if (!open[tab + ':' + parts.slice(0, i).join('/')]) return false; return true; };
      const dropOn = (node, folder) => {
        node.addEventListener('dragover', (e) => { if (Array.from(e.dataTransfer.types).some((t) => t.startsWith('vn/asset-'))) { e.preventDefault(); node.classList.add('over'); } });
        node.addEventListener('dragleave', () => node.classList.remove('over'));
        node.addEventListener('drop', (e) => { const t = Array.from(e.dataTransfer.types).find((x) => x.startsWith('vn/asset-')); const id = t && e.dataTransfer.getData(t); node.classList.remove('over'); if (!id) return; e.preventDefault(); e.stopPropagation(); const a = VN.asset(id); if (a) VN.mutate(() => { a.folder = folder || ''; }); });
      };
      const rows = [];
      for (const f of F) {
        if (!visible(f)) continue;
        const depth = f.split('/').length - 1;
        const isOpen = !!open[tab + ':' + f];
        const n = items.filter((a) => folderOf(a) === f).length;
        const row = el('div', { class: 'af-row', style: { paddingLeft: (6 + depth * 12) + 'px' }, onclick: () => { open[tab + ':' + f] = !isOpen; App.renderAssets(); } },
          el('span', { class: 'af-arrow' }, isOpen ? '▾' : '▸'), el('span', null, '📁'), el('span', { class: 'af-name' }, f.split('/').pop()), el('span', { class: 'muted small' }, n ? String(n) : ''));
        row.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          VN.menu(e.clientX, e.clientY, [{ head: '📁 ' + f },
            { label: VN.t('Unterordner …'), action: async () => { const nn = App.cleanFolder(await VN.prompt(VN.t('Name des Unterordners'), '')); if (nn) VN.mutate(() => { App.addFolder(tab, f + '/' + nn); open[tab + ':' + f] = true; }); } },
            { label: VN.t('Umbenennen …'), action: async () => { const nn = App.cleanFolder(await VN.prompt(VN.t('Neuer Name'), f.split('/').pop())); if (nn) VN.mutate(() => App.renameFolder(tab, f, f.split('/').slice(0, -1).concat(nn).join('/'))); } },
            { label: VN.t('Ordner auflösen'), hint: VN.t('Dateien bleiben'), danger: true, action: () => VN.mutate(() => App.removeFolder(tab, f)) }]);
        });
        dropOn(row, f);
        rows.push([f, row]);
      }
      const assetNodes = [];
      for (const a of items) {
        const del = el('button', {
          class: 'del', title: 'Aus Projekt entfernen',
          onclick: (e) => { e.stopPropagation(); App.removeAsset(a); }
        }, '×');
        const node = tab === 'image'
          ? el('div', { class: 'asset', draggable: 'true', title: a.name + ' – auf eine Spur oder Bühne ziehen' },
            el('div', { class: 'thumb', style: { backgroundImage: `url("${VN.assetUrl(a.id)}")` } }),
            el('div', { class: 'aname' }, a.name), del)
          : tab === 'video'
            ? el('div', { class: 'asset audio-item', draggable: 'true', title: a.name + ' – auf die Video-Spur ziehen' },
              el('span', { class: 'font-aa' }, '🎬'), el('div', { class: 'aname', style: { flex: '1' } }, a.name),
              el('span', { class: 'muted small' }, a.file.split('.').pop().toUpperCase()), del)
          : tab === 'font'
            ? el('div', { class: 'asset audio-item', draggable: 'true', title: a.name + ' – im Design-Bereich verwenden' },
              el('span', { class: 'font-aa', style: { fontFamily: Theme.fontCss('asset:' + a.id) } }, 'Aa'),
              el('div', { class: 'aname', style: { flex: '1', fontFamily: Theme.fontCss('asset:' + a.id), fontSize: '13px' } }, a.name),
              el('span', { class: 'muted small' }, a.file.split('.').pop().toUpperCase()), del)
          : el('div', { class: 'asset audio-item', draggable: 'true', title: a.name + ' – auf eine Audio-Spur ziehen' },
            el('button', { class: 'play', title: 'Anhören', onclick: (e) => { e.stopPropagation(); VN.previewSound(a.id); } }, '▶'),
            el('div', { class: 'aname', style: { flex: '1' } }, a.name),
            el('span', { class: 'muted small' }, a.file.split('.').pop().toUpperCase()), del);
        node.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('vn/asset-' + a.kind, a.id);
          e.dataTransfer.effectAllowed = 'copyMove';
        });
        node.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          VN.menu(e.clientX, e.clientY, [{ head: a.name }, { label: VN.t('In Ordner verschieben:') },
            { label: (folderOf(a) ? '　' : '✓ ') + VN.t('— kein Ordner —'), action: () => VN.mutate(() => { a.folder = ''; }) },
            ...F.map((f) => ({ label: (folderOf(a) === f ? '✓ ' : '　') + '📁 ' + f, action: () => VN.mutate(() => { a.folder = f; }) })),
            'sep', { label: VN.t('Neuer Ordner …'), action: async () => { const nn = App.cleanFolder(await VN.prompt(VN.t('Name des Ordners (Unterordner mit /)'), '')); if (nn) VN.mutate(() => { App.addFolder(tab, nn); a.folder = nn; open[tab + ':' + nn] = true; }); } }]);
        });
        assetNodes.push([folderOf(a), node]);
      }
      // Ordner mit ihrem Inhalt, danach Dateien ohne Ordner
      for (const [f, row] of rows) {
        list.appendChild(row);
        if (!open[tab + ':' + f]) continue;
        const depth = f.split('/').length;
        for (const [af, node] of assetNodes) if (af === f) { node.classList.add('in-folder'); node.style.marginLeft = Math.min(36, depth * 8) + 'px'; list.appendChild(node); }
      }
      const rootNodes = assetNodes.filter(([af]) => !af || !F.includes(af));
      if (rows.length && rootNodes.length) { const sep = el('div', { class: 'af-root muted small' }, VN.t('Ohne Ordner')); dropOn(sep, ''); list.appendChild(sep); }
      for (const [, node] of rootNodes) list.appendChild(node);
    },

    // ---------- Ordner der Dateiliste (0.8.0) ----------
    cleanFolder(n) { return String(n || '').split('/').map((x) => x.trim().replace(/[\\:*?"<>|]/g, '')).filter(Boolean).join('/'); },
    // Ordner aus der Datei auf dem PC (assets/Bilder/Figuren/ray.png → Bilder/Figuren), wenn keiner gewählt ist
    folderOf(a) {
      if (a.folder != null) return a.folder;
      const parts = String(a.file || '').replace(/\\/g, '/').split('/');
      if (parts[0] === 'assets') parts.shift();
      parts.pop();
      return parts.join('/');
    },
    folders(kind) {
      const p = VN.project;
      p.assetFolders = p.assetFolders || {};
      const set = new Set(p.assetFolders[kind] || []);
      for (const a of VN.assetsOf(kind)) { const f = App.folderOf(a); if (f) set.add(f); }
      // Elternordner ergänzen
      for (const f of [...set]) { const parts = f.split('/'); for (let i = 1; i < parts.length; i++) set.add(parts.slice(0, i).join('/')); }
      return [...set].sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' }));
    },
    addFolder(kind, f) { const p = VN.project; p.assetFolders = p.assetFolders || {}; const l = p.assetFolders[kind] = p.assetFolders[kind] || []; if (!l.includes(f)) l.push(f); },
    renameFolder(kind, from, to) {
      const p = VN.project; const re = (x) => (x === from ? to : x.startsWith(from + '/') ? to + x.slice(from.length) : x);
      p.assetFolders = p.assetFolders || {};
      p.assetFolders[kind] = [...new Set([...(p.assetFolders[kind] || []), ...App.folders(kind)].map(re))];
      for (const a of VN.assetsOf(kind)) { const f = App.folderOf(a); if (f === from || f.startsWith(from + '/')) a.folder = re(f); }
    },
    removeFolder(kind, f) {
      const p = VN.project; const parent = f.split('/').slice(0, -1).join('/');
      p.assetFolders = p.assetFolders || {};
      p.assetFolders[kind] = App.folders(kind).filter((x) => x !== f && !x.startsWith(f + '/')).filter((x) => (p.assetFolders[kind] || []).includes(x));
      for (const a of VN.assetsOf(kind)) { const af = App.folderOf(a); if (af === f || af.startsWith(f + '/')) a.folder = parent; }
    },

    async removeAsset(a) {
      const used = JSON.stringify(VN.project.scenes).includes('"' + a.id + '"');
      if (used) {
        const r = await api.confirm('„' + a.name + '“ wird noch verwendet. Trotzdem aus dem Projekt entfernen? Die Clips bleiben als leere Clips erhalten.', ['Entfernen', 'Abbrechen']);
        if (r !== 0) return;
      }
      VN.mutate(() => { VN.project.assets = VN.project.assets.filter((x) => x.id !== a.id); });
      Export.badgeSoon();
    }
  });

  VN.render = () => {
    if (!VN.project) return;
    const title = document.getElementById('project-title');
    if (document.activeElement !== title) title.value = VN.project.title || '';
    document.querySelectorAll('#view-tabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.view === VN.ui.view));
    Theme.loadFonts();
    App.renderScenes();
    App.renderAssets();
    const center = document.getElementById('center');
    const s = VN.curScene();
    if (VN.ui.view === 'graph') Graph.render(center);
    else if (VN.ui.view === 'systems') Systems.render(center);
    else if (VN.ui.view === 'transcript') Transcript.render(center);
    else if (VN.ui.view === 'storyboard') Storyboard.render(center);
    else if (VN.ui.view === 'bones') Figures.render(center);
    else if (VN.ui.view === 'menu') Menu.render(center);
    else if (VN.ui.view === 'design') Design.render(center);
    else if (VN.ui.view === 'anim') AnimEd.render(center);
    else if (VN.ui.view === 'sets' && window.KulEd) KulEd.render(center);
    else if (s && s.type === 'hub') Hub.render(center);
    else if (s) Story.render(center);
    else center.innerHTML = '';
    Inspector.render(document.getElementById('right'));
    document.getElementById('b-undo').disabled = !VN.undoStack.length;
    document.getElementById('b-redo').disabled = !VN.redoStack.length;
    VN.updateSaveStatus();
    if (window.Help) Help.badgeSoon();
    if (window.Tour) Tour.maybeAuto();
  };

  // ---------- Ereignisse ----------
  const $ = (id) => document.getElementById(id);
  $('w-demo').onclick = () => App.newProject('demo');
  $('w-learn').onclick = () => Learn.open();
  $('w-tutorial').onclick = () => App.newProject('tutorial');
  $('b-help').onclick = (e) => Tour.helpMenu(e.currentTarget);
  $('w-new').onclick = () => App.newProject(false);
  $('w-open').onclick = () => App.openProject();
  App.renderRecent();
  // Ton-Einstellungen im Editor: getrennte Geräte für Vorschau und Test-Spiel
  App.audioSettings = async () => {
    const S = VN.settings;
    const save = () => { try { localStorage.setItem('vn-settings', JSON.stringify(S)); } catch (e) { /* egal */ } VN.Audio.refresh(); };
    const back = VN.el('div', { class: 'modal-back', onclick: (ev) => { if (ev.target === back) back.remove(); } });
    const row = (label, ctrl, extra) => VN.el('div', { class: 'aud-row' }, VN.el('span', null, label), ctrl, extra || VN.el('span'));
    const selEd = await VN.Audio.select(S.audioOutEditor != null ? S.audioOutEditor : (S.audioOut || ''), (v) => { S.audioOutEditor = v; save(); }, 'sel');
    const selPl = await VN.Audio.select(S.audioOut || '', (v) => { S.audioOut = v; save(); }, 'sel');
    const vol = VN.el('input', { type: 'range', min: 0, max: 100, value: S.master != null ? S.master : 100, oninput: (e) => { S.master = Number(e.target.value); lab.textContent = S.master + ' %'; save(); } });
    const lab = VN.el('span', { class: 'muted small' }, (S.master != null ? S.master : 100) + ' %');
    const n = (await VN.Audio.devices()).length;
    back.appendChild(VN.el('div', { class: 'modal aud-modal' },
      VN.el('div', { class: 'row gap8' }, VN.el('strong', { style: { flex: '1', fontSize: '16px' } }, 'Ton-Einstellungen'), VN.el('button', { class: 'btn', onclick: () => back.remove() }, 'Schließen')),
      VN.el('div', { class: 'muted small' }, n ? n + ' Ausgabegeräte gefunden. Steckst du Kopfhörer ein oder aus, wechselt der Ton automatisch.' : 'Keine einzelnen Geräte gefunden – es wird der System-Standard benutzt.'),
      row('Vorschau im Editor', selEd, VN.el('button', { class: 'btn tiny', onclick: () => VN.Audio.test(S.audioOutEditor != null ? S.audioOutEditor : (S.audioOut || '')) }, 'Test')),
      row('Spiel testen', selPl, VN.el('button', { class: 'btn tiny', onclick: () => VN.Audio.test(S.audioOut || '') }, 'Test')),
      row('Gesamtlautstärke', vol, lab),
      row('Mono', VN.el('input', { type: 'checkbox', checked: !!S.mono, onchange: (e) => { S.mono = e.target.checked; save(); } }), VN.el('span', { class: 'muted small' }, 'beide Kanäle zusammen')),
      VN.el('div', { class: 'hint-box' }, 'Tipp: So kannst du z. B. Vorschau-Töne über Kopfhörer hören und das Test-Spiel über die Boxen. Spieler stellen ihr Gerät im fertigen Spiel unter Einstellungen → Tonausgabe selbst ein.')));
    document.body.appendChild(back);
  };
  const langBtns = () => document.querySelectorAll('#w-lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === VN.I18n.lang));
  document.querySelectorAll('#w-lang button').forEach((b) => { b.onclick = () => { VN.I18n.set(b.dataset.lang); langBtns(); }; });
  langBtns();
  $('b-file').onclick = async (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    // zuletzt geöffnete Projekte (ohne das aktuelle)
    let rec = [];
    try { rec = api.recentList ? (await api.recentList()).filter((x) => x.ok && x.dir !== VN.dir).slice(0, 6) : []; } catch (err) { rec = []; }
    const recItems = rec.length ? ['sep', { head: 'Zuletzt geöffnet' }].concat(rec.map((x) => ({ label: x.title || x.dir, hint: App.recentWhen(x.time), notr: true, action: async () => { await VN.save(); App.openRecent(x.dir); } }))) : [];
    VN.menu(r.left, r.bottom + 4, [
      { head: 'Projekt' },
      { label: 'Speichern', hint: 'Strg+S', action: async () => { await VN.save(); VN.toast('Gespeichert'); } },
      { label: 'Neues Projekt …', action: async () => { await VN.save(); App.newProject(false); } },
      { label: 'Projekt öffnen …', action: async () => { await VN.save(); App.openProject(); } },
      ...recItems,
      'sep',
      { label: 'Beispielprojekt anlegen …', action: async () => { await VN.save(); App.newProject('demo'); } },
      { label: 'Tutorial-Projekt anlegen …', action: async () => { await VN.save(); App.newProject('tutorial'); } },
      'sep',
      { label: 'Text importieren …', hint: 'Dialoge, Ren\'Py', action: () => VN.TextImport.open(VN.curScene && VN.curScene()) },
      { label: 'Ton-Einstellungen …', hint: 'Kopfhörer, Boxen', action: () => App.audioSettings() },
      { label: '♿ Komfort & Barrierefreiheit …', hint: 'ruhig, größer, farbenblind', action: () => VN.A11y.open() },
      // Web-Version (0.9.6): kein Update-Fenster, statt Ordner öffnen das Projekt als ZIP herunterladen
      window.VN_WEB ? null : { label: 'Nach Updates suchen …', hint: 'v' + ((VN.Schema && VN.Schema.ENGINE) || ''), action: () => Updates.open() },
      window.VN_WEB ? { label: '⬇ Als ZIP herunterladen', hint: 'Sicherung, Desktop-Version', action: () => VN.api.downloadProject() } : { label: 'Projektordner öffnen', action: () => VN.api.openPath('') },
      { label: '🤖 Anleitung für KI …', hint: 'ChatGPT, Gemini, Grok …', action: () => VN.AIGuide.open() },
      'sep',
      { head: 'Sprache · Language' },
      ...[['en', 'English'], ['de', 'Deutsch'], ['es', 'Español'], ['ja', '日本語']].map(([l, n]) => ({ label: (VN.I18n.lang === l ? '✓ ' : '　') + n, action: () => VN.I18n.set(l) }))
    ]);
  };
  $('b-undo').onclick = () => VN.undo();
  $('b-redo').onclick = () => VN.redo();
  $('b-play-all').onclick = () => Player.start(VN.project.startScene, 0, { menu: true });
  $('b-export').onclick = () => Export.open();
  $('b-issues').onclick = () => Help.panel();
  $('size-badge').onclick = () => Export.sizeModal();
  $('b-play-scene').onclick = () => Player.start(VN.ui.view === 'graph' && VN.ui.graphSel ? VN.ui.graphSel : VN.ui.sceneId, VN.ui.view === 'scene' ? VN.ui.beat : 0);
  $('b-add-story').onclick = () => VN.mutate(() => { const s = VN.newStoryScene(); VN.ui.sceneId = s.id; VN.ui.sel = null; VN.ui.view = 'scene'; VN.ui.beat = 0; });
  $('b-add-chapter').onclick = async () => { const n = await VN.prompt('Name des Kapitels', VN.t('Kapitel ') + (VN.chapters().length + 1)); if (n) VN.mutate(() => { VN.addChapter(n); }); };
  $('scene-search').addEventListener('input', (e) => { VN.ui.sceneQ = e.target.value; App.renderScenes(); if (VN.ui.view === 'graph') VN.render(); });
  $('scene-search').addEventListener('keydown', (e) => e.stopPropagation());
  $('b-add-hub').onclick = () => VN.mutate(() => { const s = VN.newHubScene(); VN.ui.sceneId = s.id; VN.ui.sel = null; VN.ui.view = 'scene'; });
  $('b-import').onclick = async () => VN.registerAssets(await api.pickAssets(VN.dir, null));
  $('project-title').onchange = (e) => VN.mutate(() => { VN.project.title = e.target.value || 'Projekt'; });
  document.querySelectorAll('#view-tabs .tab').forEach((b) => { b.onclick = () => { VN.ui.view = b.dataset.view; VN.render(); }; });
  document.querySelectorAll('#asset-tabs button').forEach((b) => { b.onclick = () => { VN.ui.assetTab = b.dataset.tab; App.renderAssets(); }; });

  // Dateien von außen ins Fenster ziehen
  let dragDepth = 0;
  const overlay = $('drag-overlay');
  const hasFiles = (e) => Array.from(e.dataTransfer.types).includes('Files');
  window.addEventListener('dragenter', (e) => { if (hasFiles(e) && VN.project) { dragDepth++; overlay.hidden = false; } });
  window.addEventListener('dragleave', (e) => { if (hasFiles(e)) { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) overlay.hidden = true; } });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', async (e) => {
    dragDepth = 0;
    overlay.hidden = true;
    if (!hasFiles(e) || !VN.project) return;
    e.preventDefault();
    const added = await VN.importPaths(VN.filePaths(e.dataTransfer));
    if (added[0]) { VN.ui.assetTab = added[0].kind; Theme.loadFonts(); App.renderAssets(); }
  });

  // Tastatur
  window.addEventListener('keydown', (e) => {
    if (!VN.project || Player.running) return;
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); VN.save(); VN.toast('Gespeichert'); return; }
    if (typing) return;
    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); VN.undo(); return; }
    if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); VN.redo(); return; }
    // Clips kopieren und in jede Szene einfügen (0.8.0)
    if (mod && VN.ui.view === 'scene' && VN.curScene() && VN.curScene().type === 'story' && ['c', 'v'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      if (e.key.toLowerCase() === 'c') { if (VN.ui.sel) Story.copySelection(VN.curScene()); else Story.copyBeat(VN.curScene(), VN.ui.beat); } else Story.pasteClips(VN.curScene(), VN.ui.beat);
      return;
    }
    // Animations-Editor (0.9.24): Keyframes kopieren, einfügen, löschen, alle markieren
    if (VN.ui.view === 'anim' && window.AnimEd) {
      const k = e.key.toLowerCase();
      if (mod && k === 'c' && AnimEd.copyKeys()) { e.preventDefault(); return; }
      if (mod && k === 'v' && AnimEd.pasteKeys()) { e.preventDefault(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && AnimEd.deleteKeys()) { e.preventDefault(); return; }
      if (e.key === 'Escape' && (VN.ui.animKeys || []).length) { VN.ui.animKeys = []; VN.render(); return; }
    }
    if (VN.ui.view === 'bones') {
      if ((e.key === 'Delete' || e.key === 'Backspace') && VN.ui.boneSel) { e.preventDefault(); Bones.deleteBone(VN.ui.boneAsset, VN.ui.boneSel); }
      if (e.key === 'Enter' && VN.ui.boneTool === 'chain') { e.preventDefault(); Bones.finishChain(VN.ui.boneAsset); }
      if (e.key === 'Escape') { VN.ui.chain = VN.ui.boneTool === 'chain' ? [] : null; VN.ui.boneSel = null; VN.render(); }
      return;
    }
    const s = VN.curScene();
    if (!s || VN.ui.view !== 'scene') return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && VN.ui.sel) {
      e.preventDefault();
      if (s.type === 'story') Story.deleteClip(s, VN.ui.sel);
      else VN.mutate(() => { s.objects = s.objects.filter((o) => o.id !== VN.ui.sel); VN.ui.sel = null; });
      return;
    }
    if (s.type === 'story' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      VN.ui.beat = Math.max(0, Math.min(s.beats - 1, VN.ui.beat + (e.key === 'ArrowRight' ? 1 : -1)));
      VN.render();
      Story.scrollToBeat(VN.ui.beat);
    }
    if (e.key === 'Escape' && VN.ui.sel) { VN.ui.sel = null; VN.render(); }
  });

  window.addEventListener('beforeunload', () => { if (VN.dirty) VN.save(); });

  // Exportiertes Spiel: direkt ins Hauptmenü starten
  (async () => {
    if (!api || !api.gameInfo) return;
    const g = await api.gameInfo();
    if (!g || !g.game) return;
    VN.gameMode = true;
    document.getElementById('welcome').hidden = true;
    document.getElementById('app').hidden = true;
    VN.dir = g.dir;
    const data = g.data;
    for (const s of data.scenes) VN.ensureTracks(s);
    VN.project = VN.migrate(data);
    document.title = data.title || 'Spiel';
    await VNPlugin.load();
    if (VN.settings && VN.settings.fullscreen) api.fullscreen(true);
    Player.start(null, 0, { menu: true });
  })();

  // Engine-Updates (nur Editor; exportierte Spiele setzen VN.gameMode vorher)
  setTimeout(() => { if (window.Updates && !VN.gameMode) Updates.init(); }, 1500);

  // Haken für den automatischen Test
  window.__vnLoad = (dir, data) => App.load(dir, data);
  window.__vnTest = (cmd, arg) => {
    if (cmd === 'beat') { VN.ui.beat = arg; VN.ui.sel = VN.curScene().tracks.dialog.find((d) => d.start === arg)?.id || null; VN.render(); }
    if (cmd === 'openScene') App.openScene(arg);
    if (cmd === 'graph') { VN.ui.view = 'graph'; VN.render(); }
    if (cmd === 'play') Player.start(VN.project.startScene);
    if (cmd === 'advance') { for (let i = 0; i < arg * 2; i++) setTimeout(() => Player.advance(), i * 120); }
  };
})();
