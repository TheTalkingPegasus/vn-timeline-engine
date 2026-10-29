// Export-Einstellungen, Spiel-Auflösung, Größenanzeige und Umwandlung (WebP-Bilder, Opus-Audio)
(function () {
  const { el } = VN;

  const ASPECTS = {
    '16:9': [[1280, 720], [1920, 1080], [2560, 1440], [3840, 2160]],
    '16:10': [[1280, 800], [1920, 1200], [2560, 1600]],
    '4:3': [[1024, 768], [1600, 1200], [2048, 1536]],
    '21:9': [[2560, 1080], [3440, 1440]],
    '9:16': [[720, 1280], [1080, 1920]]
  };
  const EXPORT_BASE = VN.EXPORT_BASE;
  // Grundgerüst des Windows-Spiels (Programm, Chromium, zwei Sprachpakete); als ZIP etwa 40 %
  const WIN_BASE = 305 * 1024 * 1024;
  const WEB_BASE = 0.6 * 1024 * 1024;

  VN.aspectName = (w, h) => { for (const k of Object.keys(ASPECTS)) { const [a, b] = k.split(':').map(Number); if (Math.abs(w / h - a / b) < 0.01) return k; } return 'eigen'; };
  const fmtMB = (b) => (b >= 1024 * 1024 * 1024 ? (b / 1024 / 1024 / 1024).toFixed(1).replace('.', ',') + ' GB' : b >= 10 * 1024 * 1024 ? Math.round(b / 1024 / 1024) + ' MB' : b >= 1024 * 1024 ? (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB' : b > 0 ? Math.max(1, Math.round(b / 1024)) + ' KB' : '0 KB');
  VN.fmtMB = fmtMB;

  // Welche Dateien werden wirklich benutzt?
  const usedAssets = (p) => {
    const json = JSON.stringify(Object.assign({}, p, { assets: [] }));
    return new Set(p.assets.filter((a) => json.includes('"' + a.id + '"') || json.includes('asset:' + a.id)).map((a) => a.id));
  };

  const Export = (window.Export = {
    ASPECTS, EXPORT_BASE, usedAssets,
    stats: null, engineSize: null,

    async refreshStats() {
      if (!VN.project || !VN.api.statFiles) return null;
      try {
        const list = await VN.api.statFiles(VN.project.assets.map((a) => a.file));
        Export.stats = {};
        for (const s of list) Export.stats[s.file] = s;
        if (Export.engineSize == null) Export.engineSize = (await VN.api.engineSize()) || WIN_BASE;
      } catch (e) { console.warn(e); }
      return Export.stats;
    },

    // Schätzung der Spielgröße (Bytes) nach Kategorien
    estimate(o) {
      o = o || VN.exportOpts();
      const p = VN.project;
      const used = usedAssets(p);
      const r = VN.res();
      const limit = Math.max(r.w, r.h);
      const cats = { image: 0, audio: 0, font: 0, video: 0 };
      const rows = [];
      let unused = 0, unusedN = 0;
      for (const a of p.assets) {
        const st = (Export.stats && Export.stats[a.file]) || { size: 0 };
        const ext = a.file.split('.').pop().toLowerCase();
        if (o.skipUnused && !used.has(a.id)) { unused += st.size; unusedN++; continue; }
        let size = st.size;
        if (a.kind === 'image' && ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
          let k = 1;
          if (o.downscale && st.w && st.h && Math.max(st.w, st.h) > limit) k *= Math.pow(limit / Math.max(st.w, st.h), 2);
          if (o.img === 'webp') k *= (ext === 'png' ? 0.32 : ext === 'webp' ? 1 : 0.72) * (0.55 + 0.45 * (o.imgQ / 85));
          size = Math.min(st.size, st.size * k);
        }
        if (a.kind === 'audio' && o.audio === 'opus' && ['wav', 'flac'].includes(ext)) {
          const dur = st.dur || (ext === 'flac' ? st.size / 97000 : st.size / 176400);
          size = Math.min(st.size, dur * o.audioKbps * 125 + 4000);
        }
        cats[a.kind] = (cats[a.kind] || 0) + size;
        rows.push({ a, size, orig: st.size, w: st.w, h: st.h });
      }
      rows.sort((x, y) => y.size - x.size);
      const content = Object.values(cats).reduce((s, v) => s + v, 0);
      return { cats, rows, content, unused, unusedN, win: content + (Export.engineSize || WIN_BASE), web: content + WEB_BASE };
    },

    // Kleine Anzeige unter den Dateien
    async renderBadge() {
      const box = document.getElementById('size-badge');
      if (!box || !VN.project) return;
      if (!Export.stats) { box.textContent = 'Spielgröße wird berechnet …'; await Export.refreshStats(); }
      const e = Export.estimate();
      box.innerHTML = '';
      box.append(el('span', { class: 'sb-ico' }, '⬇'), el('span', null, 'Spiel ca. ', el('strong', null, fmtMB(e.win)), ' (Windows) · ', el('strong', null, fmtMB(e.web)), ' (Web)'));
      box.title = 'Klicken für die Aufteilung';
    },
    _badgeT: null,
    badgeSoon() { clearTimeout(Export._badgeT); Export._badgeT = setTimeout(async () => { await Export.refreshStats(); Export.renderBadge(); }, 600); },

    sizeModal() {
      const e = Export.estimate();
      const o = VN.exportOpts();
      const back = el('div', { class: 'modal-back', onclick: (ev) => { if (ev.target === back) back.remove(); } });
      const bar = (label, v, total, color) => el('div', { class: 'sz-row' }, el('span', null, label), el('div', { class: 'sz-bar' }, el('span', { style: { width: Math.max(1, v / total * 100) + '%', background: color } })), el('span', { class: 'sz-v' }, fmtMB(v)));
      const total = e.win;
      back.appendChild(el('div', { class: 'modal size-modal' },
        el('div', { class: 'row gap8' }, el('strong', { style: { flex: '1', fontSize: '16px' } }, 'Wie groß wird das Spiel?'), el('button', { class: 'btn', onclick: () => back.remove() }, 'Schließen')),
        el('div', { class: 'sz-total' },
          el('div', null, el('div', { class: 'muted small' }, 'Windows-Spiel (entpackt)'), el('div', { class: 'sz-big' }, fmtMB(e.win)), el('div', { class: 'muted small' }, 'als ZIP etwa ' + fmtMB(e.win * 0.42))),
          el('div', null, el('div', { class: 'muted small' }, 'Web-Spiel'), el('div', { class: 'sz-big' }, fmtMB(e.web)), el('div', { class: 'muted small' }, 'zum Hochladen, z. B. itch.io'))),
        el('div', { class: 'sec-title' }, 'Aufteilung (Windows)'),
        bar('Engine-Grundgerüst', Export.engineSize || WIN_BASE, total, '#5a5d68'),
        bar('Bilder', e.cats.image || 0, total, '#6cc48a'),
        bar('Audio', e.cats.audio || 0, total, '#a58cf0'),
        bar('Videos', e.cats.video || 0, total, '#e88aa6'),
        bar('Schriften', e.cats.font || 0, total, '#e8a43a'),
        el('div', { class: 'muted small' }, 'Das Grundgerüst (Programm und Browser-Technik) ist bei jedem Windows-Spiel gleich groß, auch bei einem winzigen Spiel. Beim Web-Spiel übernimmt das der Browser.'),
        el('div', { class: 'sec-title' }, 'Die 10 größten Dateien'),
        el('div', { class: 'sz-files' }, ...e.rows.slice(0, 10).map((r) => el('div', { class: 'sz-file' },
          r.a.kind === 'image' ? el('span', { class: 'mini-thumb', style: { backgroundImage: `url("${VN.assetUrl(r.a.id)}")` } }) : el('span', { class: 'mini-thumb sz-kind' }, r.a.kind === 'audio' ? '♪' : r.a.kind === 'font' ? 'Aa' : '▶'),
          el('span', { class: 'sz-name' }, r.a.name, r.w ? el('span', { class: 'muted small' }, '  ' + r.w + ' × ' + r.h) : null),
          el('span', { class: 'sz-v' }, r.size < r.orig * 0.98 ? fmtMB(r.orig) + ' → ' + fmtMB(r.size) : fmtMB(r.size)),
          Export.canShrink(r) ? el('button', { class: 'btn tiny', onclick: async (ev) => { ev.target.disabled = true; ev.target.textContent = '…'; await Export.shrinkAsset(r.a); back.remove(); Export.sizeModal(); } }, 'Verkleinern') : el('span')))),
        e.unusedN ? el('div', { class: 'hint-box' }, e.unusedN + (e.unusedN === 1 ? ' unbenutzte Datei wird' : ' unbenutzte Dateien werden') + ' beim Export weggelassen (' + fmtMB(e.unused) + ').') : null,
        el('div', { class: 'row gap8' },
          el('span', { class: 'muted small', style: { flex: '1' } }, 'Bilder: ' + (o.img === 'webp' ? 'WebP ' + o.imgQ + ' %' : 'Original') + (o.downscale ? ', auf Spiel-Auflösung verkleinert' : '') + ' · Audio: ' + (o.audio === 'opus' ? 'Opus ' + o.audioKbps + ' kbit/s' : 'Original')),
          el('button', { class: 'btn primary', onclick: () => { back.remove(); Export.open(); } }, 'Export-Einstellungen …'))));
      document.body.appendChild(back);
    },
    canShrink(r) { const ext = r.a.file.split('.').pop().toLowerCase(); const lim = Math.max(VN.res().w, VN.res().h); return r.a.kind === 'image' && ['png', 'jpg', 'jpeg'].includes(ext) && r.w && Math.max(r.w, r.h) > lim; },
    // Datei im Projekt dauerhaft auf Spiel-Auflösung verkleinern (als PNG)
    async shrinkAsset(a) {
      const lim = Math.max(VN.res().w, VN.res().h);
      const blob = await Export.convertImage(a, lim, 'image/png', 1);
      if (!blob) return VN.toast('Verkleinern nicht möglich');
      const ext = a.file.split('.').pop().toLowerCase();
      const out = await VN.api.writeAsset(VN.dir, a.file.replace(/\.[^.]+$/, '') + '_klein.' + (ext === 'jpg' || ext === 'jpeg' ? 'png' : ext), new Uint8Array(await blob.arrayBuffer()));
      VN.mutate(() => { a.file = out; });
      Export.stats = null;
      Export.badgeSoon();
      VN.toast('„' + a.name + '“ verkleinert');
    },

    // ---------- Umwandlung ----------
    loadImg(url) { return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = url; }); },
    async convertImage(a, limit, type, q) {
      try {
        const im = await Export.loadImg(VN.assetUrl(a.id));
        let w = im.naturalWidth, h = im.naturalHeight;
        if (limit && Math.max(w, h) > limit) { const k = limit / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const g = cv.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(im, 0, 0, w, h);
        return await new Promise((res) => cv.toBlob(res, type, q));
      } catch (e) { console.warn('Bild konnte nicht umgewandelt werden', a.name, e); return null; }
    },
    async convertAudio(a, kbps) {
      if (typeof AudioEncoder === 'undefined') return null;
      try {
        const buf = await (await fetch(VN.assetUrl(a.id))).arrayBuffer();
        const decoded = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(buf);
        const ch = Math.min(2, decoded.numberOfChannels);
        const packets = [];
        let preskip = 312;
        const enc = new AudioEncoder({
          output: (chunk, meta) => {
            const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d);
            packets.push({ data: d, samples: Math.round((chunk.duration || 20000) * 48 / 1000) });
            const desc = meta && meta.decoderConfig && meta.decoderConfig.description;
            if (desc) { const b = new Uint8Array(desc.buffer || desc); if (b.length >= 12) preskip = b[10] | (b[11] << 8); }
          },
          error: (e) => console.warn(e)
        });
        enc.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: ch, bitrate: kbps * 1000 });
        const total = decoded.length, step = 48000;
        for (let off = 0; off < total; off += step) {
          const n = Math.min(step, total - off);
          const data = new Float32Array(n * ch);
          for (let c = 0; c < ch; c++) data.set(decoded.getChannelData(c).subarray(off, off + n), c * n);
          enc.encode(new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round(off / 48), data }));
        }
        await enc.flush();
        enc.close();
        if (!packets.length) return null;
        return Ogg.opus(packets, ch, preskip, decoded.sampleRate);
      } catch (e) { console.warn('Audio konnte nicht umgewandelt werden', a.name, e); return null; }
    },

    // Bereitet die Daten für den Export vor: unbenutzte Dateien weglassen, Bilder/Audio umwandeln
    async prepare(o, onProgress) {
      // Feste Projektkennung mitgeben: trennt Spielstände und Wissen gleichnamiger Spiele
      if (VN.Extras && VN.Extras.pid && !VN.project.persistId) { VN.Extras.pid(); if (VN.markDirty) VN.markDirty(); }
      const data = JSON.parse(JSON.stringify(VN.project));
      const used = usedAssets(VN.project);
      if (o.skipUnused) data.assets = data.assets.filter((a) => used.has(a.id));
      const files = [];
      const lim = o.downscale ? Math.max(VN.res().w, VN.res().h) : 0;
      const todo = data.assets.filter((a) => {
        const ext = a.file.split('.').pop().toLowerCase();
        const st = Export.stats && Export.stats[a.file];
        if (a.kind === 'image' && ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return o.img === 'webp' || (lim && st && st.w && Math.max(st.w, st.h) > lim);
        if (a.kind === 'audio' && ['wav', 'flac'].includes(ext)) return o.audio === 'opus';
        return false;
      });
      let i = 0;
      for (const a of todo) {
        onProgress && onProgress(++i, todo.length, a.name);
        const orig = VN.asset(a.id);
        const st = (Export.stats && Export.stats[a.file]) || {};
        let bytes = null, ext = null;
        if (a.kind === 'image') {
          const webp = o.img === 'webp';
          const blob = await Export.convertImage(orig, lim, webp ? 'image/webp' : (a.file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'), webp ? o.imgQ / 100 : 0.92);
          if (blob && (!st.size || blob.size < st.size)) { bytes = new Uint8Array(await blob.arrayBuffer()); ext = webp ? 'webp' : a.file.split('.').pop(); }
        } else {
          const ogg = await Export.convertAudio(orig, o.audioKbps);
          if (ogg && (!st.size || ogg.length < st.size)) { bytes = ogg; ext = 'ogg'; }
        }
        if (bytes) {
          const nf = a.file.replace(/\.[^.]+$/, '') + (ext === a.file.split('.').pop() ? '_spiel' : '') + '.' + ext;
          files.push({ file: nf, bytes });
          a.file = nf;
        }
      }
      data.export = o;
      data.export.title = data.title;
      delete data.tutorial;
      return { data, files };
    },

    // ---------- Fenster: Export-Einstellungen ----------
    open() {
      const p = VN.project;
      const o = VN.exportOpts();
      if (Export.stats) {
        const used = usedAssets(p);
        const miss = p.assets.filter((a) => used.has(a.id) && Export.stats[a.file] && Export.stats[a.file].missing);
        if (miss.length) VN.toast('⚠ ' + miss.length + (miss.length === 1 ? ' benutzte Datei fehlt: ' : ' benutzte Dateien fehlen: ') + miss.slice(0, 3).map((a) => a.name).join(', ') + ' – die Ampel der Szenen zeigt, wo.');
      }
      const back = el('div', { class: 'modal-back' });
      const card = el('div', { class: 'modal export-modal' });
      back.appendChild(card);
      document.body.appendChild(back);
      const close = () => { VN.mutate(() => { p.export = o; }); back.remove(); };
      const opt = (val, cur, label, sub, on) => el('button', { class: 'ex-opt' + (val === cur ? ' active' : ''), onclick: () => { on(val); draw(); } }, el('strong', null, label), sub ? el('span', null, sub) : null);
      const sel = (value, options, commit) => { const s = el('select', { onchange: (e) => { commit(e.target.value); draw(); } }); for (const [v, l] of options) { const x = el('option', { value: v }, l); if (String(v) === String(value)) x.selected = true; s.appendChild(x); } return s; };
      const row = (label, ...c) => el('div', { class: 'ex-row' }, el('div', { class: 'ex-lbl' }, label), el('div', { class: 'ex-val' }, ...c));
      const draw = () => {
        const r = VN.res();
        const asp = VN.aspectName(r.w, r.h);
        const e = Export.estimate(o);
        card.innerHTML = '';
        card.append(
          el('div', { class: 'row gap8' }, el('strong', { style: { flex: '1', fontSize: '16px' } }, 'Spiel exportieren'), el('button', { class: 'btn ghost', onclick: close }, 'Schließen')),
          el('div', { class: 'ex-grid' },
            el('div', { class: 'ex-col' },
              row('Ziel', el('div', { class: 'ex-opts' },
                opt('win', o.target, 'Windows-Spiel', 'eigene .exe', (v) => { o.target = v; }),
                opt('web', o.target, 'Web-Spiel', 'z. B. itch.io', (v) => { o.target = v; }))),
              row('Seitenverhältnis', el('div', { class: 'ex-opts wrap' }, ...Object.keys(ASPECTS).map((k) => opt(k, asp, k, k === '9:16' ? 'Hochformat' : null, (v) => Export.setResolution(...ASPECTS[v][Math.min(1, ASPECTS[v].length - 1)], draw))),
                opt('eigen', asp, 'Eigenes', null, () => {}))),
              row('Auflösung', el('div', { class: 'row gap4', style: { flexWrap: 'wrap' } },
                ...(ASPECTS[asp] || []).map(([w, h]) => opt(w + 'x' + h, r.w + 'x' + r.h, w + ' × ' + h, w >= 3840 ? '4K' : w >= 2560 || h >= 2560 ? '2K' : w === 1920 || h === 1920 ? 'Full HD' : 'HD', () => Export.setResolution(w, h, draw))),
                el('span', { class: 'row gap4' },
                  el('input', { type: 'number', class: 'small-input', style: { width: '78px' }, value: r.w, onchange: (ev) => Export.setResolution(Number(ev.target.value) || r.w, r.h, draw) }), '×',
                  el('input', { type: 'number', class: 'small-input', style: { width: '78px' }, value: r.h, onchange: (ev) => Export.setResolution(r.w, Number(ev.target.value) || r.h, draw) })))),
              row('Anpassung an den Bildschirm', el('div', { class: 'ex-opts' },
                opt('letterbox', o.fit, 'Schwarze Ränder', 'alles sichtbar', (v) => { o.fit = v; }),
                opt('cover', o.fit, 'Bild füllen', 'Rand wird abgeschnitten', (v) => { o.fit = v; }),
                opt('stretch', o.fit, 'Strecken', 'füllt immer alles', (v) => { o.fit = v; }))),
              o.target === 'win' ? row('Start-Modus', el('div', { class: 'ex-opts' },
                opt('window', o.start, 'Fenster', null, (v) => { o.start = v; }),
                opt('fullscreen', o.start, 'Vollbild', null, (v) => { o.start = v; }),
                opt('borderless', o.start, 'Randloses Fenster', null, (v) => { o.start = v; })),
                el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: o.resizable, onchange: (ev) => { o.resizable = ev.target.checked; } }), 'Fenstergröße veränderbar')) : null),
            el('div', { class: 'ex-col' },
              row('Bilder', el('div', { class: 'ex-opts' },
                opt('original', o.img, 'Original', null, (v) => { o.img = v; }),
                opt('webp', o.img, 'WebP', 'viel kleiner', (v) => { o.img = v; })),
                o.img === 'webp' ? el('label', { class: 'row gap8 small' }, 'Qualität', el('input', { type: 'range', min: 50, max: 100, value: o.imgQ, onchange: (ev) => { o.imgQ = Number(ev.target.value); draw(); } }), o.imgQ + ' %') : null,
                el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: o.downscale, onchange: (ev) => { o.downscale = ev.target.checked; draw(); } }), 'Größere Bilder auf Spiel-Auflösung verkleinern')),
              row('Audio', el('div', { class: 'ex-opts' },
                opt('original', o.audio, 'Original', null, (v) => { o.audio = v; }),
                opt('opus', o.audio, 'OGG (Opus)', 'WAV/FLAC umwandeln', (v) => { o.audio = v; })),
                o.audio === 'opus' ? el('label', { class: 'row gap8 small' }, 'Qualität', sel(o.audioKbps, [[64, '64 kbit/s (Sprache)'], [96, '96 kbit/s (gut)'], [128, '128 kbit/s (sehr gut)'], [160, '160 kbit/s (Musik)']], (v) => { o.audioKbps = Number(v); })) : null),
              row('Spiel-Infos',
                el('div', { class: 'grid2' },
                  el('label', { class: 'field' }, el('span', { class: 'lbl' }, 'Spielname'), el('input', { type: 'text', value: p.title || '', onchange: (ev) => VN.mutate(() => { p.title = ev.target.value || 'Spiel'; }) })),
                  el('label', { class: 'field' }, el('span', { class: 'lbl' }, 'Version'), el('input', { type: 'text', value: o.version, onchange: (ev) => { o.version = ev.target.value; } })),
                  el('label', { class: 'field' }, el('span', { class: 'lbl' }, 'Studio-Name'), el('input', { type: 'text', value: o.studio, placeholder: 'optional', onchange: (ev) => { o.studio = ev.target.value; } })),
                  el('label', { class: 'field' }, el('span', { class: 'lbl' }, 'Programm-Symbol (Icon)'), sel(o.icon, [['', '— Standard —'], ...VN.assetsOf('image').map((a) => [a.id, a.name])], (v) => { o.icon = v; }))),
                o.icon ? el('div', { class: 'row gap8' }, el('span', { class: 'mini-thumb', style: { backgroundImage: `url("${VN.assetUrl(o.icon)}")` } }), el('span', { class: 'muted small' }, 'Quadratisch, am besten 256 × 256 px')) : null),
              el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: o.skipUnused, onchange: (ev) => { o.skipUnused = ev.target.checked; draw(); } }), 'Unbenutzte Dateien weglassen' + (e.unusedN ? ' (' + e.unusedN + ', ' + fmtMB(e.unused) + ')' : '')),
              el('label', { class: 'check', title: 'Für Beta-Tester und Modder: Taste ^ öffnet im fertigen Spiel die Entwickler-Konsole (Werte setzen, springen …).' }, el('input', { type: 'checkbox', checked: !!p.devConsole, onchange: (ev) => VN.mutate(() => { p.devConsole = ev.target.checked; }) }), 'Entwickler-Konsole im fertigen Spiel erlauben'))),
          el('div', { class: 'ex-foot' },
            el('div', { class: 'ex-size', onclick: () => { VN.mutate(() => { p.export = o; }); back.remove(); Export.sizeModal(); } },
              el('span', { class: 'muted small' }, 'Geschätzte Größe'),
              el('strong', null, o.target === 'win' ? fmtMB(e.win) : fmtMB(e.web)),
              el('span', { class: 'muted small' }, o.target === 'win' ? 'entpackt, als ZIP ca. ' + fmtMB(e.win * 0.42) + ' · Details' : 'Details')),
            el('div', { style: { flex: '1' } }),
            el('button', { class: 'btn', onclick: close }, 'Nur speichern'),
            el('button', { class: 'btn primary big', onclick: () => { VN.mutate(() => { p.export = o; }); back.remove(); Export.run(o); } }, o.target === 'win' ? 'Windows-Spiel exportieren' : 'Web-Spiel exportieren')));
      };
      draw();
      if (!Export.stats) Export.refreshStats().then(draw);
    },

    // Auflösung ändern: Positionen sind relativ (%), Hub-Objekte behalten ihr Seitenverhältnis
    async setResolution(w, h, after) {
      w = Math.max(320, Math.round(w)); h = Math.max(320, Math.round(h));
      const p = VN.project;
      const old = VN.res();
      if (old.w === w && old.h === h) return after && after();
      const oldA = old.w / old.h, newA = w / h;
      if (Math.abs(oldA - newA) > 0.01) {
        const r = await VN.api.confirm('Seitenverhältnis ändern auf ' + w + ' × ' + h + '?\n\nAlle Positionen werden mitskaliert. Prüfe danach Figuren, Hub-Objekte und Menü-Buttons, ob alles noch gut sitzt.', ['Ändern', 'Abbrechen']);
        if (r !== 0) return after && after();
      }
      VN.mutate(() => {
        p.resolution = { w, h };
        if (Math.abs(oldA - newA) > 0.01) {
          const k = newA / oldA;
          for (const s of p.scenes) if (s.type === 'hub') for (const o of s.objects) { const cy = o.y + o.h / 2; o.h = Math.min(100, o.h * k); o.y = Math.max(0, cy - o.h / 2); }
        }
      });
      Export.badgeSoon();
      after && after();
    },

    async run(o) {
      await VN.save();
      if (!Export.stats) await Export.refreshStats();
      const prog = el('div', { class: 'modal-back' }, el('div', { class: 'modal', style: { width: '420px' } }, el('strong', null, 'Exportiere …'), el('div', { class: 'muted small', id: 'ex-prog' }, 'Dateien vorbereiten'), el('div', { class: 'pbar' }, el('span', { id: 'ex-bar', style: { width: '3%', background: 'var(--accent)' } }))));
      document.body.appendChild(prog);
      const setP = (i, n, name) => { const t = document.getElementById('ex-prog'), b = document.getElementById('ex-bar'); if (t) t.textContent = 'Umwandeln ' + i + ' / ' + n + ': ' + name; if (b) b.style.width = Math.round(i / n * 90) + '%'; };
      try {
        const { data, files } = await Export.prepare(o, setP);
        document.getElementById('ex-prog').textContent = 'Spiel wird geschrieben …';
        const iconPng = o.icon ? await Export.iconPng(o.icon) : null;
        const res = o.target === 'win' ? await VN.api.exportWindows({ data, files, iconPng }) : await VN.api.exportWeb({ data, files });
        prog.remove();
        if (res && res.ok) VN.toast('Fertig exportiert: ' + res.dest);
        else if (res && res.msg) VN.toast(res.msg);
      } catch (e) { prog.remove(); VN.toast('Export fehlgeschlagen: ' + e.message); console.error(e); }
    },
    async iconPng(id) {
      const a = VN.asset(id);
      if (!a) return null;
      try {
        const im = await Export.loadImg(VN.assetUrl(id));
        const cv = document.createElement('canvas'); cv.width = cv.height = 256;
        const g = cv.getContext('2d');
        const k = Math.min(256 / im.naturalWidth, 256 / im.naturalHeight);
        g.drawImage(im, (256 - im.naturalWidth * k) / 2, (256 - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k);
        const b = await new Promise((r) => cv.toBlob(r, 'image/png'));
        return new Uint8Array(await b.arrayBuffer());
      } catch (e) { return null; }
    },

    // Neues Projekt: Auflösung wählen
    ask() {
      return new Promise((resolve) => {
        let pick = [1920, 1080];
        const back = el('div', { class: 'modal-back' });
        const card = el('div', { class: 'modal', style: { width: '560px' } });
        const draw = () => {
          card.innerHTML = '';
          card.append(el('strong', { style: { fontSize: '16px' } }, 'Auflösung des Spiels'),
            el('div', { class: 'muted small' }, 'Die Bühne im Editor ist genau so groß wie später das Spiel. Du kannst das später beim Exportieren noch ändern.'),
            ...Object.entries(ASPECTS).map(([k, list]) => el('div', { class: 'ex-row' }, el('div', { class: 'ex-lbl' }, k + (k === '9:16' ? ' (Hochformat)' : k === '16:9' ? ' (Standard)' : '')),
              el('div', { class: 'ex-opts wrap' }, ...list.map(([w, h]) => el('button', { class: 'ex-opt' + (pick[0] === w && pick[1] === h ? ' active' : ''), onclick: () => { pick = [w, h]; draw(); } }, el('strong', null, w + ' × ' + h)))))),
            el('div', { class: 'row gap8', style: { justifyContent: 'flex-end' } }, el('button', { class: 'btn primary', onclick: () => { back.remove(); resolve({ w: pick[0], h: pick[1] }); } }, 'Weiter')));
        };
        draw();
        back.appendChild(card);
        document.body.appendChild(back);
      });
    },

    // Bühnen-Vorschau: sichtbarer Bereich in einem anderen Format (bei „Bild füllen“)
    formatOverlay(stage, fmt) {
      if (!fmt) return;
      const [a, b] = fmt.split(':').map(Number);
      const target = a / b, cur = VN.aspect();
      const box = el('div', { class: 'fmt-frame' }, el('span', null, fmt + ' · sichtbarer Bereich'));
      if (target > cur) { const hh = cur / target * 100; Object.assign(box.style, { left: '0', right: '0', top: (100 - hh) / 2 + '%', height: hh + '%' }); }
      else { const ww = target / cur * 100; Object.assign(box.style, { top: '0', bottom: '0', left: (100 - ww) / 2 + '%', width: ww + '%' }); }
      stage.appendChild(box);
    }
  });

  // ---------- Ogg-Container für Opus (RFC 7845) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let r = i << 24; for (let j = 0; j < 8; j++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1; t[i] = r >>> 0; } return t; })();
  const crc32 = (d) => { let c = 0; for (let i = 0; i < d.length; i++) c = ((c << 8) ^ CRC[((c >>> 24) ^ d[i]) & 255]) >>> 0; return c >>> 0; };
  const Ogg = (window.Ogg = {
    page(packets, flags, granule, serial, seq) {
      const segs = [];
      for (const p of packets) { let n = p.length; while (n >= 255) { segs.push(255); n -= 255; } segs.push(n); }
      const body = packets.reduce((s, p) => s + p.length, 0);
      const buf = new Uint8Array(27 + segs.length + body);
      const dv = new DataView(buf.buffer);
      buf.set([0x4f, 0x67, 0x67, 0x53], 0);
      buf[4] = 0; buf[5] = flags;
      dv.setUint32(6, granule % 4294967296, true); dv.setUint32(10, Math.floor(granule / 4294967296), true);
      dv.setUint32(14, serial, true); dv.setUint32(18, seq, true);
      buf[26] = segs.length;
      buf.set(segs, 27);
      let o = 27 + segs.length;
      for (const p of packets) { buf.set(p, o); o += p.length; }
      dv.setUint32(22, crc32(buf), true);
      return buf;
    },
    opus(packets, ch, preskip, rate) {
      const serial = (Math.random() * 0xffffffff) >>> 0;
      const head = new Uint8Array(19); const hv = new DataView(head.buffer);
      head.set([79, 112, 117, 115, 72, 101, 97, 100], 0); head[8] = 1; head[9] = ch; hv.setUint16(10, preskip, true); hv.setUint32(12, rate || 48000, true); hv.setInt16(16, 0, true); head[18] = 0;
      const vendor = new TextEncoder().encode('VN Timeline Engine');
      const tags = new Uint8Array(8 + 4 + vendor.length + 4); const tv = new DataView(tags.buffer);
      tags.set([79, 112, 117, 115, 84, 97, 103, 115], 0); tv.setUint32(8, vendor.length, true); tags.set(vendor, 12); tv.setUint32(12 + vendor.length, 0, true);
      const pages = [Ogg.page([head], 2, 0, serial, 0), Ogg.page([tags], 0, 0, serial, 1)];
      let seq = 2, gran = preskip, group = [], size = 0, segCount = 0;
      packets.forEach((p, i) => {
        const segs = Math.floor(p.data.length / 255) + 1;
        if (group.length && (size + p.data.length > 8000 || segCount + segs > 250)) { pages.push(Ogg.page(group, 0, gran, serial, seq++)); group = []; size = 0; segCount = 0; }
        group.push(p.data); size += p.data.length; segCount += segs; gran += p.samples;
        if (i === packets.length - 1) pages.push(Ogg.page(group, 4, gran, serial, seq++));
      });
      const total = pages.reduce((s, x) => s + x.length, 0);
      const out = new Uint8Array(total);
      let o = 0;
      for (const x of pages) { out.set(x, o); o += x.length; }
      return out;
    }
  });
})();
