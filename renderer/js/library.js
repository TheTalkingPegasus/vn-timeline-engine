// Asset-Bibliothek (0.9.24): Bilder, Töne, Videos und Schriften einmal speichern – in jedem Projekt wiederverwenden
(function () {
  const { el } = VN;
  const KIND = { image: ['🖼', 'Bilder'], audio: ['🔊', 'Audio'], video: ['🎬', 'Video'], font: ['🔤', 'Schriften'], kulisse: ['🏠', 'Kulissen'] };
  const Lib = (window.Library = {
    api: () => VN.api && VN.api.library,
    st: { tab: 'lib', kind: '', folder: '', q: '', src: '', sel: new Set(), addSel: new Set(), addFolder: '' },
    // Starter-Pack (0.9.25): Namen und Ordner kommen in allen Sprachen mit – hier in der Sprache der Oberfläche
    loc(o, fb) { const l = VN.lang || 'en'; return o && typeof o === 'object' ? o[l] || o.en || o.de || fb : (o || fb); },
    // Kulissen-Vorlagen (0.9.33): nur Räume ohne Bilder – gehören zur Engine wie das Starter-Pack
    kulItems() {
      if (!window.Kulisse) return [];
      return Kulisse.TEMPLATES.map(([id, name, rooms]) => ({ id: 'kul:' + id, tpl: id, kind: 'kulisse', builtin: true, name: VN.t(name), folder: VN.t('Kulissen-Vorlagen'), catName: VN.t('Kulissen-Vorlagen'), rooms: rooms().map((r) => VN.t(r.n)).join(' · ') }));
    },
    fix(L) {
      return (L || []).map((x) => (x && x.builtin ? Object.assign({}, x, { name: Lib.loc(x.name, '?'), folder: Lib.loc(x.packName, 'Starter-Pack') + '/' + Lib.loc(x.catName, x.cat || '') }) : x)).concat(Lib.kulItems());
    },
    async open() {
      if (!Lib.api()) { VN.toast(VN.t('Die Bibliothek ist hier nicht verfügbar.')); return; }
      Lib.list = Lib.fix(await Lib.api().list());
      const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) Lib.close(); } });
      const card = el('div', { class: 'modal lib-modal' });
      back.appendChild(card);
      document.body.appendChild(back);
      Lib.back = back; Lib.card = card;
      if (!Lib.st.addFolder) Lib.st.addFolder = (VN.project && VN.project.title) || '';
      Lib.draw();
    },
    close() { if (Lib.audio) Lib.audio.pause(); if (Lib.back) Lib.back.remove(); Lib.back = null; },
    play(x, btn) {
      if (Lib.audio) { Lib.audio.pause(); if (Lib.audioId === x.id) { Lib.audioId = null; btn.textContent = '▶'; return; } }
      const u = Lib.api().url(x);
      if (!u) { VN.toast(VN.t('Lädt …')); return; }
      Lib.audio = new Audio(u); Lib.audioId = x.id; Lib.audio.play().catch(() => {});
      document.querySelectorAll('.lib-play').forEach((b) => { b.textContent = '▶'; });
      btn.textContent = '■';
      Lib.audio.onended = () => { btn.textContent = '▶'; Lib.audioId = null; };
    },
    draw() {
      const S = Lib.st, card = Lib.card;
      if (!card) return;
      card.innerHTML = '';
      const tabBtn = (k, l) => el('button', { class: S.tab === k ? 'active' : '', onclick: () => { S.tab = k; Lib.draw(); } }, VN.t(l));
      card.append(el('div', { class: 'row gap8', style: { marginBottom: '6px' } },
        el('strong', { style: { fontSize: '17px' } }, '📚 ' + VN.t('Asset-Bibliothek')),
        el('span', { class: 'muted small' }, VN.t('gilt für alle deine Projekte')),
        el('div', { class: 'spacer' }),
        el('div', { class: 'seg' }, tabBtn('lib', 'Bibliothek'), tabBtn('add', 'Aus diesem Projekt hinzufügen')),
        el('button', { class: 'btn', onclick: () => Lib.close() }, VN.t('Schließen'))));
      if (S.tab === 'add') return Lib.drawAdd(card);
      const L = Lib.list || [];
      const folders = [...new Set(L.filter((x) => !S.src || (S.src === 'pack') === !!x.builtin).map((x) => x.folder).filter(Boolean))].sort();
      const vis = L.filter((x) => (!S.src || (S.src === 'pack') === !!x.builtin) && (!S.kind || x.kind === S.kind) && (!S.folder || x.folder === S.folder) && (!S.q || (x.name + ' ' + x.folder).toLowerCase().includes(S.q.toLowerCase())));
      const fsel = el('select', { class: 'small-input', onchange: (e) => { S.folder = e.target.value; Lib.draw(); } }, el('option', { value: '' }, VN.t('Alle Ordner')), ...folders.map((f) => { const o = el('option', { value: f }, f); if (f === S.folder) o.selected = true; return o; }));
      const q = el('input', { type: 'search', class: 'small-input', placeholder: VN.t('Suchen …'), value: S.q, oninput: (e) => { S.q = e.target.value; clearTimeout(Lib._qt); Lib._qt = setTimeout(() => { Lib.draw(); const n = Lib.card.querySelector('input[type=search]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 200); } });
      card.append(el('div', { class: 'row gap8', style: { flexWrap: 'wrap', marginBottom: '8px' } },
        el('div', { class: 'seg' }, el('button', { class: !S.kind ? 'active' : '', onclick: () => { S.kind = ''; Lib.draw(); } }, VN.t('Alle')), ...Object.entries(KIND).map(([k, [i, l]]) => el('button', { class: S.kind === k ? 'active' : '', onclick: () => { S.kind = k; Lib.draw(); } }, i + ' ' + VN.t(l)))),
        el('div', { class: 'seg' }, ...[['', 'Alles'], ['own', 'Meine Dateien'], ['pack', 'Starter-Pack']].map(([k, l]) => el('button', { class: S.src === k ? 'active' : '', title: k === 'pack' ? VN.t('Mitgelieferte Bilder (CC0) – frei nutzbar, auch in verkauften Spielen, ohne Namensnennung') : '', onclick: () => { S.src = k; S.folder = ''; Lib.draw(); } }, (k === 'pack' ? '⭐ ' : '') + VN.t(l)))),
        fsel, q, el('span', { class: 'muted small' }, VN.tf('{n} Dateien', { n: vis.length }))));
      if (!L.some((x) => !x.builtin) && S.src === 'own') {
        card.appendChild(el('div', { class: 'hint-box' }, VN.t('Noch leer. Unter „Aus diesem Projekt hinzufügen“ legst du Bilder und Sounds ab – danach kannst du sie in jedem Projekt mit einem Klick holen.')));
        return;
      }
      const grid = el('div', { class: 'lib-grid' });
      for (const x of vis) {
        const on = S.sel.has(x.id);
        const thumb = x.kind === 'kulisse' ? el('div', { class: 'lib-thumb lib-kul', style: { backgroundImage: `url("${Kulisse.thumb(x.tpl)}")` } })
          : x.kind === 'image' ? el('div', { class: 'lib-thumb', 'data-lib': x.file, style: { backgroundImage: Lib.api().url(x) ? `url("${Lib.api().url(x)}")` : '' } })
          : x.kind === 'audio' ? el('div', { class: 'lib-thumb snd' }, el('button', { class: 'btn tiny lib-play', onclick: (e) => { e.stopPropagation(); Lib.play(x, e.currentTarget); } }, '▶'))
            : el('div', { class: 'lib-thumb other' }, KIND[x.kind] ? KIND[x.kind][0] : '📄');
        const nm = el('div', { class: 'lib-name', title: x.builtin ? x.name : VN.t('Doppelklick = umbenennen'), ondblclick: async (e) => { e.stopPropagation(); if (x.builtin) return; const v = prompt(VN.t('Name'), x.name); if (v != null && v.trim()) { Lib.list = Lib.fix(await Lib.api().update(x.id, { name: v.trim() })); Lib.draw(); } } }, x.name);
        grid.appendChild(el('div', { class: 'lib-card' + (on ? ' on' : ''), onclick: () => { if (on) S.sel.delete(x.id); else S.sel.add(x.id); Lib.draw(); } },
          thumb, nm, el('div', { class: 'lib-meta' }, (x.kind === 'kulisse' ? '🏠 ' + x.rooms : x.builtin ? '⭐ ' + Lib.loc(x.catName, '') : x.folder ? '📁 ' + x.folder : '') + (x.size ? ' · ' + Math.max(1, Math.round(x.size / 1024)) + ' KB' : '')), on ? el('span', { class: 'lib-check' }, '✓') : null));
      }
      card.appendChild(grid);
      const n = [...S.sel].filter((id) => L.some((x) => x.id === id)).length;
      card.appendChild(el('div', { class: 'row gap8 lib-foot' },
        el('button', { class: 'btn tiny', onclick: () => { for (const x of vis) S.sel.add(x.id); Lib.draw(); } }, VN.t('Alle sichtbaren wählen')),
        n ? el('button', { class: 'btn tiny', onclick: () => { S.sel.clear(); Lib.draw(); } }, VN.t('Auswahl aufheben')) : null,
        el('div', { class: 'spacer' }),
        n ? el('button', { class: 'btn tiny', onclick: async () => { const f = prompt(VN.t('Ordner in der Bibliothek'), ''); if (f == null) return; for (const id of S.sel) { if (/^(pack|kul):/.test(String(id))) continue; Lib.list = Lib.fix(await Lib.api().update(id, { folder: f.trim() })); } Lib.draw(); } }, '📁 ' + VN.t('Ordner')) : null,
        n ? el('button', { class: 'btn tiny danger', onclick: async () => { const own = [...S.sel].filter((id) => !/^(pack|kul):/.test(String(id))); if (!own.length) { VN.toast(VN.t('Das Starter-Pack gehört zur Engine und kann nicht gelöscht werden.')); return; } if (!confirm(VN.tf('{n} Dateien aus der Bibliothek löschen? (Projekte, die sie schon benutzen, behalten ihre Kopie.)', { n: own.length }))) return; Lib.list = Lib.fix(await Lib.api().remove(own)); S.sel.clear(); Lib.draw(); } }, VN.t('Löschen')) : null,
        el('button', { class: 'btn primary', disabled: !n || !VN.dir, onclick: () => Lib.importSel() }, '⬇ ' + (n ? VN.tf('{n} ins Projekt holen', { n }) : VN.t('Ins Projekt holen')))));
    },
    async importSel() {
      let ids = [...Lib.st.sel];
      if (!ids.length) return;
      // Kulissen-Vorlagen: als neue Kulissen ins Projekt
      const kul = ids.filter((id) => String(id).startsWith('kul:'));
      if (kul.length) {
        VN.mutate(() => { for (const id of kul) { const k = Kulisse.fromTemplate(id.slice(4)); if (k) { Kulisse.all().push(k); VN.ui.kulId = k.id; } } });
        VN.toast(VN.tf('{n} Kulissen ins Projekt geholt – zu finden im Reiter „Kulissen“', { n: kul.length }));
        ids = ids.filter((id) => !kul.includes(id));
        if (!ids.length) { Lib.st.sel.clear(); Lib.draw(); return; }
      }
      const res = await Lib.api().import(ids);
      const fol = new Map((Lib.list || []).map((x) => [x.name, x.folder]));
      const added = VN.registerAssets(res);
      // Ordner aus der Bibliothek übernehmen (Dateiliste bleibt aufgeräumt)
      if (added.length) VN.mutate(() => { for (const a of added) { const r = res.find((y) => y.file === a.file); const f = (r && r.folder) || fol.get(a.name); if (f) a.folder = 'Bibliothek/' + f; } });
      if (window.App && App.renderAssets) App.renderAssets();
      if (added.length) VN.toast(VN.tf('{n} Dateien ins Projekt geholt', { n: added.length }));
      Lib.st.sel.clear();
      Lib.draw();
    },
    drawAdd(card) {
      const S = Lib.st, p = VN.project;
      const assets = (p && p.assets || []).filter((a) => KIND[a.kind]);
      if (!assets.length) { card.appendChild(el('div', { class: 'hint-box' }, VN.t('Dieses Projekt hat noch keine Dateien.'))); return; }
      card.appendChild(el('div', { class: 'row gap8', style: { marginBottom: '8px', flexWrap: 'wrap' } },
        el('span', { class: 'muted small' }, VN.t('Ordner in der Bibliothek')),
        el('input', { type: 'text', class: 'small-input', value: S.addFolder, placeholder: VN.t('z. B. Fantasy-Figuren'), onchange: (e) => { S.addFolder = e.target.value; } }),
        el('span', { class: 'muted small' }, VN.t('Bereits gespeicherte Dateien (gleicher Name und Größe) werden übersprungen.'))));
      const grid = el('div', { class: 'lib-grid' });
      for (const a of assets) {
        const on = S.addSel.has(a.id);
        const u = VN.assetUrl(a.id);
        grid.appendChild(el('div', { class: 'lib-card' + (on ? ' on' : ''), onclick: () => { if (on) S.addSel.delete(a.id); else S.addSel.add(a.id); Lib.draw(); } },
          a.kind === 'image' ? el('div', { class: 'lib-thumb', style: { backgroundImage: u ? `url("${u}")` : '' } }) : el('div', { class: 'lib-thumb other' }, KIND[a.kind][0]),
          el('div', { class: 'lib-name' }, a.name), el('div', { class: 'lib-meta' }, a.folder ? '📁 ' + a.folder : VN.t(KIND[a.kind][1])), on ? el('span', { class: 'lib-check' }, '✓') : null));
      }
      card.appendChild(grid);
      const n = S.addSel.size;
      card.appendChild(el('div', { class: 'row gap8 lib-foot' },
        el('button', { class: 'btn tiny', onclick: () => { for (const a of assets) S.addSel.add(a.id); Lib.draw(); } }, VN.t('Alle wählen')),
        n ? el('button', { class: 'btn tiny', onclick: () => { S.addSel.clear(); Lib.draw(); } }, VN.t('Auswahl aufheben')) : null,
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn primary', disabled: !n, onclick: async () => {
          const items = assets.filter((a) => S.addSel.has(a.id)).map((a) => ({ file: a.file, name: a.name, folder: S.addFolder || a.folder || '' }));
          const r = await Lib.api().add(items, S.addFolder);
          Lib.list = Lib.fix(r.list); S.addSel.clear();
          VN.toast(VN.tf('{n} Dateien in der Bibliothek gespeichert', { n: r.added }));
          S.tab = 'lib'; Lib.draw();
        } }, '📚 ' + (n ? VN.tf('{n} in die Bibliothek', { n }) : VN.t('In die Bibliothek')))));
    }
  });
  const hook = () => { const b = document.getElementById('b-library'); if (b) b.onclick = () => Lib.open(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
})();
