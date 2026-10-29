// Transkript: alle Texte an einem Ort, mit Übersetzungen
(function () {
  const { el } = VN;

  const LANG_NAMES = { de: 'Deutsch', en: 'English', es: 'Español', fr: 'Français', it: 'Italiano', pl: 'Polski', pt: 'Português', ru: 'Русский', ja: '日本語', zh: '中文', tr: 'Türkçe', nl: 'Nederlands', cs: 'Čeština', uk: 'Українська', ko: '한국어' };
  const langName = (l) => LANG_NAMES[l] || l.toUpperCase();

  const statusOf = (lang, row) => {
    const t = (VN.project.translations[lang] || {})[row.id];
    if (!t || !t.text) return 'open';
    if (t.src !== row.text) return 'old';
    return t.ok ? 'ok' : 'done';
  };
  const STATUS = { open: ['Offen', '#4a4d58', '#f0f0f3'], done: ['Übersetzt', '#4fb3c8', '#0f1a1e'], ok: ['Geprüft', '#6cc48a', '#0d1f13'], old: ['Veraltet', '#f0a35e', '#251404'] };

  // Untertitel im SRT-Format: Szenen in Spielreihenfolge, Zeiten aus Sprachaufnahmen oder Lesezeit
  const srtTime = (t) => { const ms = Math.round(t * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000; return [h, m, s].map((x) => String(x).padStart(2, '0')).join(':') + ',' + String(r).padStart(3, '0'); };
  const sceneOrder = () => {
    const p = VN.project, seen = new Set(), out = [];
    const q = [VN.scene(p.startScene) ? p.startScene : (p.scenes[0] || {}).id];
    while (q.length) { const id = q.shift(); if (!id || seen.has(id)) continue; seen.add(id); const s = VN.scene(id); if (!s) continue; out.push(s); for (const e of VN.edgesOf(s)) q.push(e.to); }
    for (const s of p.scenes) if (!seen.has(s.id)) out.push(s);
    return out.filter((s) => s.type === 'story');
  };

  // CSV mit Semikolon, Anführungszeichen und Zeilenumbrüchen
  const csvCell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const parseCsv = (text) => {
    const rows = [];
    let row = [], cell = '', q = false;
    const sep = text.split('\n')[0].includes(';') ? ';' : ',';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  };

  const Transcript = (window.Transcript = {
    render(root) {
      root.innerHTML = '';
      const p = VN.project;
      const src = p.languages[0];
      if (!VN.ui.trLang || !p.languages.includes(VN.ui.trLang) || VN.ui.trLang === src) VN.ui.trLang = p.languages[1] || null;
      const lang = VN.ui.trLang;
      const rows = VN.collectTexts();
      VN.ui.trFilter = VN.ui.trFilter || { q: '', area: '', status: '' };
      const f = VN.ui.trFilter;

      // Kopf mit Sprachen
      const langBar = el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } });
      for (const l of p.languages) {
        const done = l === src ? rows.length : rows.filter((r) => ['done', 'ok'].includes(statusOf(l, r))).length;
        const pct = rows.length ? Math.round(done / rows.length * 100) : 100;
        langBar.appendChild(el('div', { class: 'lang-card' + (l === lang || (l === src && !lang) ? ' active' : ''), onclick: () => { if (l !== src) { VN.ui.trLang = l; VN.render(); } } },
          el('div', { class: 'row gap8' }, el('strong', null, langName(l)), el('span', { class: 'muted small' }, l === src ? 'Original' : pct + ' %')),
          el('div', { class: 'pbar' }, el('span', { style: { width: pct + '%', background: l === src ? 'var(--accent)' : 'var(--teal)' } }))));
      }
      const newLang = el('input', { type: 'text', placeholder: 'z. B. en', style: { width: '70px' }, class: 'small-input' });
      langBar.appendChild(el('div', { class: 'row gap4' }, newLang, el('button', {
        class: 'btn tiny', onclick: () => {
          const code = (newLang.value || '').trim().toLowerCase();
          if (!/^[a-z]{2,5}(-[a-z]{2})?$/.test(code)) return VN.toast('Sprachkürzel wie en, es oder fr eingeben');
          if (p.languages.includes(code)) return VN.toast('Diese Sprache gibt es schon');
          VN.mutate(() => { p.languages.push(code); p.translations[code] = p.translations[code] || {}; VN.ui.trLang = code; });
        }
      }, '+ Sprache')));

      root.appendChild(el('div', { class: 'view-head' },
        el('strong', { style: { fontSize: '15px' } }, 'Transkript'),
        el('span', { class: 'muted' }, rows.length + ' Texte'),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn', onclick: () => VN.TextImport.open(null) }, 'Text importieren …'),
        el('button', { class: 'btn', onclick: () => Transcript.importCsv() }, 'CSV importieren'),
        el('button', { class: 'btn', onclick: () => Transcript.exportCsv(rows) }, 'CSV exportieren'),
        el('button', { class: 'btn primary', onclick: () => Transcript.exportScript() }, 'Sprecher-Skript exportieren'),
        el('button', { class: 'btn', title: 'Untertitel-Datei für Videos (z. B. YouTube)', onclick: () => Transcript.exportSrt() }, 'Untertitel (SRT)')));

      const body = el('div', { class: 'sys-body' });
      body.appendChild(langBar);

      // Filter
      const areas = Array.from(new Set(rows.map((r) => r.area)));
      const tableHost = el('div');
      const q = el('input', { type: 'text', value: f.q, placeholder: 'Suchen in Original und Übersetzung …', class: 'small-input', style: { flex: '1', minWidth: '200px' }, oninput: (e) => { f.q = e.target.value; drawTable(); } });
      const areaSel = el('select', { class: 'small-input', onchange: (e) => { f.area = e.target.value; drawTable(); } }, el('option', { value: '' }, 'Alle Bereiche'), ...areas.map((a) => { const o = el('option', { value: a }, a); if (a === f.area) o.selected = true; return o; }));
      const stSel = el('select', { class: 'small-input', onchange: (e) => { f.status = e.target.value; drawTable(); } }, el('option', { value: '' }, 'Jeder Status'),
        ...Object.entries(STATUS).map(([k, v]) => { const o = el('option', { value: k }, v[0]); if (k === f.status) o.selected = true; return o; }));
      body.appendChild(el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } }, q, areaSel, lang ? stSel : null));
      body.appendChild(tableHost);
      if (!lang) body.appendChild(el('div', { class: 'hint-box' }, 'Füge oben eine Sprache hinzu (z. B. „en“), dann erscheint daneben eine Spalte zum Übersetzen. Im Spiel kann man die Sprache oben umschalten.'));

      const cols = lang ? '130px 120px 80px minmax(0, 1fr) minmax(0, 1fr) 110px 54px' : '130px 140px 90px minmax(0, 1fr) 54px';
      const drawTable = () => {
        tableHost.innerHTML = '';
        const needle = f.q.toLowerCase();
        const vis = rows.filter((r) => {
          if (f.area && r.area !== f.area) return false;
          if (lang && f.status && statusOf(lang, r) !== f.status) return false;
          if (needle) {
            const t = lang ? ((p.translations[lang] || {})[r.id] || {}).text || '' : '';
            if (!(r.text.toLowerCase().includes(needle) || t.toLowerCase().includes(needle) || r.id.toLowerCase().includes(needle))) return false;
          }
          return true;
        });
        const head = ['ID', 'Bereich', 'Figur', langName(src) + ' · Original'];
        if (lang) head.push(langName(lang), 'Status');
        head.push('');
        const tbl = el('div', { class: 'sys-table tr-table' }, el('div', { class: 'sys-row head', style: { gridTemplateColumns: cols } }, ...head.map((h) => el('span', null, h))));
        // Große Projekte: Zeilen in Portionen aufbauen (bleibt auch bei tausenden Zeilen flüssig)
        const key = [f.q, f.area, f.status, lang].join('|');
        if (VN.ui.trKey !== key) { VN.ui.trKey = key; VN.ui.trShown = 150; }
        const rowEl = (r) => {
          const cells = [
            el('span', { class: 'mono small', title: r.id }, r.id.length > 18 ? r.id.slice(0, 17) + '…' : r.id),
            el('span', { class: 'small' }, r.area, el('br'), el('span', { class: 'muted' }, r.where)),
            el('span', { class: 'small', style: { fontWeight: '600' } }, r.who),
            r.set ? el('textarea', { class: 'tr-cell', rows: 1, onchange: (e) => VN.mutate(() => r.set(e.target.value)) }, r.text)
              : el('span', { class: 'muted small' }, r.text + ' (Name aus Dialogen)')
          ];
          if (lang) {
            const t = (p.translations[lang] || {})[r.id] || {};
            const st = statusOf(lang, r);
            cells.push(el('textarea', {
              class: 'tr-cell', rows: 1, placeholder: '— noch nicht übersetzt —',
              onchange: (e) => VN.mutate(() => {
                p.translations[lang] = p.translations[lang] || {};
                p.translations[lang][r.id] = { text: e.target.value, src: r.text, ok: false };
              })
            }, t.text || ''));
            cells.push(el('label', { class: 'row gap4', title: st === 'old' ? 'Das Original wurde geändert, seit übersetzt wurde' : '' },
              el('span', { class: 'st-chip', style: { background: STATUS[st][1], color: STATUS[st][2] } }, STATUS[st][0]),
              st === 'done' || st === 'ok' ? el('input', { type: 'checkbox', title: 'Geprüft', checked: st === 'ok', onchange: (e) => VN.mutate(() => { p.translations[lang][r.id].ok = e.target.checked; }) }) : null,
              st === 'old' ? el('button', { class: 'btn tiny', title: 'Als aktuell markieren', onclick: () => VN.mutate(() => { p.translations[lang][r.id].src = r.text; }) }, '✓') : null));
          }
          cells.push(r.sceneId ? el('button', { class: 'btn tiny', title: 'Stelle im Editor zeigen', onclick: () => { App.openScene(r.sceneId); if (r.beat != null) { VN.ui.beat = r.beat; VN.ui.sel = r.id; VN.render(); } } }, 'Zeigen') : el('span'));
          return el('div', { class: 'sys-row', style: { gridTemplateColumns: cols } }, ...cells);
        };
        let shown = Math.min(vis.length, VN.ui.trShown || 150);
        for (let i = 0; i < shown; i++) tbl.appendChild(rowEl(vis[i]));
        if (!vis.length) tbl.appendChild(el('div', { class: 'sys-row' }, el('span', { class: 'muted' }, 'Keine Treffer.')));
        if (shown < vis.length) {
          const more = el('div', { class: 'tr-more' });
          const label = () => { more.textContent = ''; more.appendChild(el('button', { class: 'btn tiny', onclick: grow }, 'Weitere Zeilen laden')); more.appendChild(el('span', { class: 'muted small' }, ' ' + shown + ' von ' + vis.length)); };
          const grow = () => {
            const next = Math.min(vis.length, shown + 250);
            const frag = document.createDocumentFragment();
            for (let i = shown; i < next; i++) frag.appendChild(rowEl(vis[i]));
            tbl.insertBefore(frag, more);
            shown = next; VN.ui.trShown = shown;
            if (shown >= vis.length) { io.disconnect(); more.remove(); } else label();
          };
          const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) grow(); }, { rootMargin: '600px' });
          label();
          tbl.appendChild(more);
          setTimeout(() => io.observe(more), 0);
        }
        tableHost.appendChild(tbl);
      };
      drawTable();
      root.appendChild(body);
    },

    exportCsv(rows) {
      const p = VN.project;
      const langs = p.languages;
      const lines = [['id', 'bereich', 'wo', 'figur', ...langs].map(csvCell).join(';')];
      for (const r of rows) {
        const vals = [r.id, r.area, r.where, r.who, r.text];
        for (const l of langs.slice(1)) vals.push(((p.translations[l] || {})[r.id] || {}).text || '');
        lines.push(vals.map(csvCell).join(';'));
      }
      VN.api.saveText((p.title || 'projekt') + '_transkript.csv', '﻿' + lines.join('\r\n'), 'csv').then((ok) => ok && VN.toast('Transkript exportiert'));
    },

    async importCsv() {
      const text = await VN.api.openText('csv');
      if (!text) return;
      const rows = parseCsv(text.replace(/^﻿/, ''));
      if (rows.length < 2) return VN.toast('Keine Zeilen gefunden');
      const head = rows[0].map((h) => h.trim().toLowerCase());
      const idCol = head.indexOf('id');
      if (idCol < 0) return VN.toast('Spalte „id“ fehlt');
      const p = VN.project;
      const known = new Map(VN.collectTexts().map((r) => [r.id, r]));
      const langCols = head.map((h, i) => [h, i]).filter(([h]) => /^[a-z]{2,5}(-[a-z]{2})?$/.test(h) && h !== p.languages[0]);
      let n = 0;
      VN.mutate(() => {
        for (const [l] of langCols) { if (!p.languages.includes(l)) p.languages.push(l); p.translations[l] = p.translations[l] || {}; }
        for (const r of rows.slice(1)) {
          const src = known.get(r[idCol]);
          if (!src) continue;
          for (const [l, i] of langCols) {
            const v = (r[i] || '').trim();
            if (!v) continue;
            const old = p.translations[l][src.id];
            if (old && old.text === v) continue;
            p.translations[l][src.id] = { text: v, src: src.text, ok: false };
            n++;
          }
        }
      });
      VN.toast(n + ' Übersetzungen importiert');
    },

    exportScript() {
      const p = VN.project;
      VN.api.saveText((p.title || 'projekt') + '_sprecher.txt', Transcript.scriptText(), 'txt').then((ok) => ok && VN.toast('Sprecher-Skript exportiert'));
    },
    scriptText() {
      const p = VN.project;
      const lang = VN.ui.trLang;
      const by = {};
      const tr = (id) => (lang ? ((p.translations[lang] || {})[id] || {}).text : '');
      for (const s of p.scenes) {
        if (s.type === 'hub') {
          // Hub-Ereignisse sprechen auch – sonst fehlen diese Zeilen bei der Aufnahme
          (s.events || []).forEach((ev, i) => (ev.lines || []).forEach((l, j) => {
            if (!(l.text || '').trim()) return;
            const who = l.speaker || 'Erzähler';
            (by[who] = by[who] || []).push({ id: l.id, scene: s.name, place: 'Hub-Ereignis ' + (i + 1) + ', Zeile ' + (j + 1), text: l.text, tr: tr(l.id) });
          }));
          continue;
        }
        if (s.type !== 'story') continue;
        for (const d of [...s.tracks.dialog].sort((a, b) => a.start - b.start)) {
          const who = d.speaker || 'Erzähler';
          (by[who] = by[who] || []).push({ id: d.id, scene: s.name, place: 'Schritt ' + (d.start + 1), text: d.text || '', tr: tr(d.id) });
        }
      }
      let out = (p.title || 'Projekt') + ' – Sprecher-Skript\n';
      out += 'Dateien bitte so benennen wie die ID, z. B. ' + (Object.values(by)[0] ? Object.values(by)[0][0].id : 'c_1') + '.wav\n\n';
      for (const [who, lines] of Object.entries(by)) {
        out += '==============================\n' + who.toUpperCase() + ' · ' + lines.length + ' Zeilen\n==============================\n\n';
        for (const l of lines) {
          out += `[${l.id}]  ${l.scene}, ${l.place}\n${l.text}\n`;
          if (l.tr) out += `(${lang}) ${l.tr}\n`;
          out += '\n';
        }
      }
      return out;
    },

    exportSrt() {
      const p = VN.project;
      const lang = VN.ui.trLang && p.languages.includes(VN.ui.trLang) ? VN.ui.trLang : p.languages[0];
      const prev = VN.lang;
      VN.lang = lang;
      let t = 0, n = 0;
      const out = [];
      for (const s of sceneOrder()) {
        for (const d of [...s.tracks.dialog].sort((a, b) => a.start - b.start)) {
          const text = Fx.plain(VN.tr(d.id, d.text || '')).trim();
          if (!text) continue;
          const v = (s.tracks.voice || []).find((x) => x.start === d.start && x.asset);
          let dur = v ? ((v.out != null ? v.out : Fx.audioDur(v.asset)) - (v.in || 0)) : 0;
          if (!(dur > 0.4)) dur = Math.max(1.6, text.length / 15 + 0.6);
          const who = d.speaker ? VN.tr(VN.speakerKey(d.speaker), d.speaker) + ': ' : '';
          out.push(String(++n), srtTime(t) + ' --> ' + srtTime(t + dur), who + text, '');
          t += dur + 0.25;
        }
        t += 0.8;
      }
      VN.lang = prev;
      VN.api.saveText((p.title || 'projekt') + '_untertitel_' + lang + '.srt', out.join('\r\n'), 'srt').then((ok) => ok && VN.toast(n + ' Untertitel exportiert (' + lang.toUpperCase() + ')'));
    },

    inspector() {
      const p = VN.project;
      const rows = VN.collectTexts();
      const words = rows.reduce((n, r) => n + (r.text.trim() ? r.text.trim().split(/\s+/).length : 0), 0);
      const box = el('div', { class: 'insp' },
        el('div', null, el('h3', null, 'Transkript'), el('div', { class: 'insp-title' }, rows.length + ' Texte · ' + words + ' Wörter')),
        el('div', { class: 'hint-box' },
          'Jeder Text hat eine feste ID. Die Timeline verweist nur darauf, deshalb übersetzt du hier alles an einem Ort. ',
          'Wird ein Original später geändert, wird die Übersetzung automatisch als „Veraltet“ markiert.'),
        el('div', { class: 'hint-box' },
          el('strong', null, 'Für Übersetzer: '), 'CSV exportieren, in Excel oder einem Übersetzungstool ausfüllen, wieder importieren. ',
          el('br'), el('strong', null, 'Für Sprecher: '), 'Das Sprecher-Skript listet alle Zeilen pro Figur mit ID, damit die Aufnahmen richtig benannt werden.'),
        el('div', { class: 'sec-title' }, 'Sprachen'));
      p.languages.forEach((l, i) => box.appendChild(el('div', { class: 'row gap8' },
        el('span', { style: { flex: '1' } }, langName(l) + ' (' + l + ')' + (i === 0 ? ' · Original' : '')),
        i === 0 ? null : el('button', {
          class: 'btn tiny danger', onclick: async () => {
            const r = await VN.api.confirm('Sprache ' + langName(l) + ' samt Übersetzungen entfernen?', ['Entfernen', 'Abbrechen']);
            if (r === 0) VN.mutate(() => { p.languages = p.languages.filter((x) => x !== l); delete p.translations[l]; });
          }
        }, 'Entfernen'))));
      return box;
    }
  });
})();
