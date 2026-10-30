// Story-Szenen-Editor: Bühne und Timeline
(function () {
  const { el } = VN;
  const HEAD = 150;

  const clipLabel = (c, t) => {
    if (c.set) { const f = Stage.figure(c.set); return '◆ ' + (f ? f.name : 'Ebenen-Figur'); }
    if (t.kind === 'camera') return 'Kamera · ' + Math.round(c.zoom || 100) + ' %' + (c.panX || c.panY ? ' · Schwenk' : '') + (c.shake ? ' · Wackeln' : '');
    if (t.kind === 'video' && c.anim) { const an = window.Anim && Anim.get(c.anim); return '🎬 ' + (an ? an.name : 'Animation fehlt') + ' · live'; }
    if (t.kind === 'video') { const a = VN.asset(c.asset); return (a ? a.name : 'kein Video gewählt') + (c.layer === 'front' ? ' · Zwischensequenz' : ' · Hintergrund'); }
    if (t.kind === 'overlay' && c.particles) return '✦ ' + ((Fx.PARTICLES.find((x) => x[0] === c.particles) || [0, 'Partikel'])[1]);
    if (t.kind === 'overlay' && c.filter) return '◐ ' + ((Fx.FILTERS.find((x) => x[0] === c.filter) || [0, 'Filter'])[1]);
    if (t.kind === 'overlay' && c.eyes) return '👁 ' + ((Fx.EYE_MODES.find((x) => x[0] === c.eyes) || [0, 'Augen'])[1]).split(' (')[0];
    if (t.kind === 'dialog' && c.chat) return '📱 ' + (c.speaker ? c.speaker + ': ' : '') + Fx.plain(c.text || '…');
    if (t.kind === 'dialog') return (c.speaker ? c.speaker + ': ' : '') + Fx.plain(c.text || '…');
    if (t.kind === 'image' || t.kind === 'audio') {
      const a = VN.asset(c.asset);
      const cut = t.kind === 'audio' && (c.in != null || c.out != null) ? ' ✂ ' + (c.in || 0).toFixed(1) + '–' + (c.out != null ? c.out.toFixed(1) : '…') + 's' : '';
      return a ? a.name + cut : (t.kind === 'image' ? 'kein Bild gewählt' : 'keine Datei gewählt');
    }
    if (t.kind === 'dialog') return (c.speaker ? c.speaker + ': ' : '') + (c.text || '…');
    if (t.kind === 'choice') {
      // ♥+10 zeigen, wenn eine Antwort eine Beziehung ändert
      let best = 0;
      if (VN.Life && VN.Life.relOn()) for (const o of c.options) for (const a of VN.Life.optActions(o)) if (a.type === 'rel' && Math.abs(Number(a.amount)) > Math.abs(best)) best = Number(a.amount);
      return (best ? '♥' + (best > 0 ? '+' : '') + best + ' · ' : '') + 'Auswahl · ' + c.options.length + ' Antworten';
    }
    if (t.kind === 'overlay') {
      const a = VN.asset(c.asset);
      const b = (VN.BLENDS.find((x) => x[0] === (c.blend || 'normal')) || [0, ''])[1];
      return (a ? a.name : 'Farbe') + ' · ' + b;
    }
    return '';
  };

  const Story = (window.Story = {
    // Leistungs-Ampel der Szene (Schätzung aus Bildfläche und Grafikspeicher)
    perfChip(s) {
      const c = Perf.check(s);
      const txt = { ok: 'Leistung: leicht', yellow: 'Leistung: mittel', red: 'Leistung: schwer' }[c.level];
      if (!Export.stats && !Story._statsAsked) { Story._statsAsked = true; Export.refreshStats().then(() => VN.render()); }
      return el('span', { class: 'perf-chip ' + c.level, title: c.warn.join('\n') || 'Diese Szene läuft auch auf schwächeren Rechnern flüssig.', onclick: () => Story.perfModal(s) }, el('i'), txt);
    },
    perfModal(s) {
      const c = Perf.check(s);
      const back = el('div', { class: 'modal-back', onclick: (ev) => { if (ev.target === back) back.remove(); } });
      const meter = (label, v, max, unit) => {
        const k = Math.min(1, v / max);
        const col = k < 0.6 ? '#3ccf7a' : k < 0.9 ? '#f0c03c' : '#ff5a5a';
        return el('div', null, el('div', { class: 'row gap8 small' }, el('span', { style: { flex: '1' } }, label), el('span', { class: 'muted' }, unit)), el('div', { class: 'perf-meter' }, el('div', { style: { width: Math.max(2, k * 100) + '%', background: col } })));
      };
      back.appendChild(el('div', { class: 'modal size-modal perf-modal' },
        el('div', { class: 'row gap8' }, el('strong', { style: { flex: '1', fontSize: '16px' } }, 'Leistungs-Check: ' + s.name), el('button', { class: 'btn', onclick: () => back.remove() }, 'Schließen')),
        el('div', { class: 'muted small' }, 'Schätzung für den schwersten Schritt (' + (c.worst.beat + 1) + ') bei ' + VN.res().w + ' × ' + VN.res().h + '. Grün = 60 fps auch auf älterer Onboard-Grafik, Gelb = ab neuerer Onboard-Grafik (Iris Xe, Vega 8), Rot = eigene Grafikkarte empfohlen.'),
        el('div', { class: 'perf-list' },
          meter('Bildfläche pro Bild (Ebenen, Figuren, Effekte)', c.worst.fill, 14, c.worst.fill.toFixed(1) + ' Bildschirme'),
          meter('Grafikspeicher', c.worst.mem, 1000 * 1048576, 'ca. ' + VN.fmtMB(c.worst.mem)),
          meter('Bones-Figuren gleichzeitig', c.worst.figs, 8, String(c.worst.figs))),
        c.warn.length ? el('div', { class: 'hint-box' }, ...c.warn.map((w) => el('div', null, '• ' + w))) : el('div', { class: 'hint-box' }, 'Alles im grünen Bereich.'),
        c.big.length ? el('div', { class: 'perf-list' }, ...c.big.map((b) => el('div', { class: 'perf-row' },
          el('span', { class: 'mini-thumb', style: { backgroundImage: 'url("' + VN.assetUrl(b.a.id) + '")' } }),
          el('span', { style: { flex: '1' } }, b.a.name), el('span', { class: 'muted small' }, b.w + ' × ' + b.h),
          el('button', { class: 'btn tiny', onclick: async (ev) => { ev.target.disabled = true; ev.target.textContent = '…'; await Export.shrinkAsset(b.a); await Export.refreshStats(); back.remove(); Story.perfModal(s); VN.render(); } }, 'Verkleinern')))) : null,
        el('div', { class: 'muted small' }, 'Tipp: Beim Testen öffnet die Taste ^ (oder F12) die Entwickler-Konsole mit echten Bildern pro Sekunde.')));
      document.body.appendChild(back);
    },

    // ---------- Spurkopf: Name, Schalter, Menü ----------
    trackHead(s, t, tracks) {
      const tb = VN.tbase(t);
      const visual = ['bg', 'char', 'fx', 'video'].includes(tb);
      const audio = t.kind === 'audio';
      const flip = (k) => VN.mutate(() => { s.tro = s.tro || {}; const o = s.tro[t.key] = s.tro[t.key] || {}; o[k] = !o[k]; if (!Object.values(o).some(Boolean)) delete s.tro[t.key]; });
      const tbtn = (on, txt, title, k) => el('button', { class: 'tb' + (on ? ' on' : ''), title, onclick: (e) => { e.stopPropagation(); flip(k); } }, txt);
      const name = el('span', { class: 'tl-name', title: t.label + ' · Doppelklick: umbenennen, Rechtsklick: Menü' }, t.label);
      const head = el('div', { class: 'tl-head' + (VN.trackOn(s, t, tracks) ? '' : ' off') },
        el('span', { class: 'sw', style: { background: t.color } }), name,
        el('span', { class: 'tl-btns' },
          visual ? tbtn(t.hide, t.hide ? '◌' : '◉', t.hide ? 'Ausgeblendet (nur beim Bearbeiten/Testen)' : 'Sichtbar – klicken zum Ausblenden', 'hide') : null,
          audio ? tbtn(t.mute, 'M', 'Stumm (nur beim Bearbeiten/Testen)', 'mute') : null,
          audio ? tbtn(t.solo, 'S', 'Solo: nur diese Ton-Spur(en) hören', 'solo') : null,
          tbtn(t.lock, t.lock ? '🔒' : '🔓', t.lock ? 'Gesperrt: Clips können nicht verschoben werden' : 'Sperren', 'lock')));
      name.addEventListener('dblclick', () => Story.renameTrack(s, t, name));
      head.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const keys = tracks.map((x) => x.key), i = keys.indexOf(t.key);
        const move = (d) => VN.mutate(() => { const k = keys.slice(); [k[i], k[i + d]] = [k[i + d], k[i]]; s.torder = k; });
        const clips = (s.tracks[t.key] || []).length;
        VN.menu(e.clientX, e.clientY, [
          { head: t.label },
          { label: 'Umbenennen', action: () => Story.renameTrack(s, t, name) },
          i > 0 ? { label: '↑ Nach oben', hint: tb === 'char' ? 'weiter hinten' : '', action: () => move(-1) } : null,
          i < keys.length - 1 ? { label: '↓ Nach unten', hint: tb === 'char' ? 'weiter vorne' : '', action: () => move(1) } : null,
          s.torder ? { label: 'Reihenfolge zurücksetzen', action: () => VN.mutate(() => { delete s.torder; }) } : null,
          'sep',
          t.extra ? { label: 'Spur löschen', hint: clips ? clips + (clips === 1 ? ' Clip' : ' Clips') : '', danger: true, action: async () => {
            if (clips && (await VN.api.confirm('Spur „' + t.label + '“ mit ' + clips + ' Clips löschen?', ['Löschen', 'Abbrechen'])) !== 0) return;
            VN.mutate(() => { s.xtracks = s.xtracks.filter((x) => x.key !== t.key); delete s.tracks[t.key]; if (s.tro) delete s.tro[t.key]; if (s.torder) s.torder = s.torder.filter((k) => k !== t.key); });
          } } : { label: 'Eingebaute Spur (kann nicht gelöscht werden)', disabled: true }
        ].filter(Boolean));
      });
      return head;
    },
    renameTrack(s, t, nameEl) {
      const inp = el('input', { class: 'tl-rename', value: t.label });
      const done = (ok) => {
        const v = inp.value.trim();
        if (ok && v && v !== t.label) VN.mutate(() => {
          if (t.extra) { const x = s.xtracks.find((y) => y.key === t.key); if (x) x.name = v; }
          else { s.tro = s.tro || {}; (s.tro[t.key] = s.tro[t.key] || {}).name = v; }
        }); else VN.render();
      };
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
      inp.addEventListener('blur', () => done(true));
      nameEl.replaceWith(inp);
      inp.focus(); inp.select();
    },
    addTrack(s, base, name) {
      const k = VN.XTRACK_KINDS[base];
      const n = (s.xtracks || []).filter((x) => x.base === base).length + (base === 'char' ? 3 : 2);
      const key = 'x_' + VN.uid('t').slice(-6);
      VN.mutate(() => {
        s.xtracks = s.xtracks || [];
        s.xtracks.push({ key, base, name: name || (k.label.split(' /')[0] + ' ' + n) });
        s.tracks[key] = [];
      });
      return key;
    },
    addTrackMenu(s, e) {
      const p = VN.project;
      const tpls = p.trackTpls || [];
      VN.menu(e.clientX, e.clientY, [
        { head: 'Neue Spur' },
        ...Object.entries(VN.XTRACK_KINDS).map(([base, k]) => ({ label: k.label, hint: k.desc, action: () => Story.addTrack(s, base) })),
        'sep',
        { head: 'Spur-Aufbau' },
        { label: 'Aufbau als Vorlage speichern …', action: () => Story.saveTrackTpl(s) },
        ...tpls.map((tp) => ({ label: 'Vorlage anwenden: ' + tp.name, hint: (p.trackTplDefault === tp.id ? 'Standard · ' : '') + tp.xtracks.length + ' Zusatzspuren', action: () => Story.applyTrackTpl(s, tp) })),
        ...tpls.map((tp) => ({ label: (p.trackTplDefault === tp.id ? '✓ ' : '') + 'Standard für neue Szenen: ' + tp.name, action: () => VN.mutate(() => { p.trackTplDefault = p.trackTplDefault === tp.id ? null : tp.id; }) }))
      ]);
    },
    async saveTrackTpl(s) {
      const name = await VN.prompt('Name der Spur-Vorlage', VN.t('Gruppenszene'));
      if (!name) return;
      const tracks = VN.tracksOf(s);
      VN.mutate(() => {
        const p = VN.project;
        p.trackTpls = p.trackTpls || [];
        p.trackTpls.push({ id: VN.uid('tp'), name, xtracks: (s.xtracks || []).map((x) => ({ key: x.key, base: x.base, name: x.name })), tro: JSON.parse(JSON.stringify(s.tro || {})), torder: s.torder ? s.torder.slice() : null, keys: tracks.map((t) => t.key) });
      });
      VN.toast('Spur-Vorlage „' + name + '“ gespeichert');
    },
    // Vorlage anwenden: fehlende Zusatzspuren anlegen, Namen/Schalter/Reihenfolge übernehmen
    applyTrackTpl(s, tp) {
      VN.mutate(() => Story.applyTpl(s, tp));
    },
    applyTpl(s, tp) {
      s.xtracks = s.xtracks || [];
      const map = {};
      const free = s.xtracks.slice();
      for (const x of tp.xtracks) {
        const reuse = free.findIndex((y) => y.base === x.base);
        if (reuse >= 0) { map[x.key] = free[reuse].key; free[reuse].name = x.name; free.splice(reuse, 1); continue; }
        const key = 'x_' + VN.uid('t').slice(-6);
        s.xtracks.push({ key, base: x.base, name: x.name });
        s.tracks[key] = s.tracks[key] || [];
        map[x.key] = key;
      }
      const mk = (k) => map[k] || k;
      s.tro = {};
      for (const [k, v] of Object.entries(tp.tro || {})) s.tro[mk(k)] = Object.assign({}, v);
      if (tp.torder) s.torder = tp.torder.map(mk); else delete s.torder;
    },

    _ro: null,
    _scroll: { left: 0, top: 0 },

    defaults(s, t, beat, assetId) {
      const remaining = Math.max(1, s.beats - beat);
      const base = { id: VN.uid('c'), start: beat };
      switch (VN.tbase(t)) {
        case 'bg': return { ...base, len: remaining, asset: assetId || null, trans: 'fade', dur: 1 };
        case 'char': return { ...base, len: remaining, asset: assetId || null, x: t.key === 'char1' ? 30 : t.key === 'char2' ? 70 : 50, scale: 100, trans: 'fade', dur: 0.6, idle: 'breathe', flip: false };
        case 'dialog': {
          const prev = s.tracks.dialog.filter((d) => d.start < beat).sort((a, b) => b.start - a.start)[0];
          return { ...base, len: 1, speaker: prev ? prev.speaker : '', color: prev ? prev.color : '#ffffff', text: VN.t('Neuer Text …'), speed: 40, actions: [] };
        }
        case 'choice': return { ...base, len: 1, options: [{ id: VN.uid('opt'), text: VN.t('Antwort A'), target: null, conds: [], actions: [] }, { id: VN.uid('opt'), text: VN.t('Antwort B'), target: null, conds: [], actions: [] }] };
        case 'fx': return { ...base, len: remaining, asset: assetId || null, color: '#3c4a8c', blend: assetId ? 'screen' : 'multiply', opacity: 85, styles: {} };
        case 'cam': return { ...base, len: remaining, zoom: 130, panX: 0, panY: -8, rot: 0, shake: 0, dur: 1.2, ease: 'ease-in-out', keys: [] };
        case 'video': return { ...base, len: 1, asset: assetId || null, layer: 'front', loop: false, muted: false, vol: 90, fit: 'cover', waitEnd: true, skippable: true };
        case 'music': return { ...base, len: remaining, asset: assetId || null, vol: 70, loop: true, carry: false, fade: 1 };
        default: return { ...base, len: 1, asset: assetId || null, vol: 90, delay: 0 };
      }
    },

    addClip(s, t, beat, assetId) {
      const c = Story.defaults(s, t, beat, assetId);
      VN.mutate(() => {
        s.tracks[t.key].push(c);
        s.beats = Math.max(s.beats, c.start + c.len);
        VN.ui.sel = c.id;
        VN.ui.beat = beat;
      });
      return c;
    },

    // Effekt-Vorlage aus der Bibliothek auf eine Spur ziehen
    addPreset(s, t, beat, pre) {
      const tb = VN.tbase(t);
      if (pre.track !== tb) return VN.toast(pre.track === 'cam' ? 'Kamera-Vorlagen gehören auf die Kamera-Spur' : pre.track === 'bg' ? 'Diese Vorlage gehört auf die Hintergrund-Spur' : 'Diese Vorlage gehört auf eine Effekt-Ebene');
      const data = JSON.parse(JSON.stringify(pre.data));
      // Vorlagen wie „Endlos-Wolken“ ändern den vorhandenen Clip an dieser Stelle
      const ex = pre.merge ? Stage.clipAt(s.tracks[t.key], beat) : null;
      if (ex) { VN.mutate(() => { Object.assign(ex, data); VN.ui.sel = ex.id; VN.ui.beat = beat; }); VN.toast('„' + pre.label + '“ auf den Clip angewendet'); return; }
      const c = Object.assign(Story.defaults(s, t, beat), data, { id: VN.uid('c'), start: beat });
      if (pre.len) c.len = pre.len;
      VN.mutate(() => { s.tracks[t.key].push(c); s.beats = Math.max(s.beats, c.start + c.len); VN.ui.sel = c.id; VN.ui.beat = beat; });
    },

    addDialog(s) {
      let b = 0;
      while (b < s.beats && s.tracks.dialog.some((d) => d.start === b)) b++;
      Story.addClip(s, VN.track('dialog'), b);
      Story.scrollToBeat(b);
    },

    duplicateClip(s, c, t) {
      VN.mutate(() => {
        const copy = JSON.parse(JSON.stringify(c));
        copy.id = VN.uid('c');
        copy.start = c.start + c.len;
        s.tracks[t.key].push(copy);
        s.beats = Math.max(s.beats, copy.start + copy.len);
        VN.ui.sel = copy.id;
        VN.ui.beat = copy.start;
      });
    },

    // Keyframe mit den aktuellen Werten anlegen
    addKey(c, t, beat) {
      VN.mutate(() => {
        c.keys = c.keys || [];
        if (c.keys.some((k) => k.beat === beat)) return;
        const base = t.key === 'cam' ? Fx.camAt({ tracks: { cam: [c] } }, beat) : Fx.propsAt(c, beat);
        const k = { beat, dur: 0.8, ease: 'ease-in-out' };
        for (const p of t.key === 'cam' ? ['zoom', 'panX', 'panY', 'rot'] : VN.tbase(t) === 'fx' ? ['opacity'] : Fx.CHAR_PROPS) k[p] = base[p] != null ? base[p] : (p === 'opacity' ? (c.opacity != null ? c.opacity : 100) : 0);
        c.keys.push(k);
        c.keys.sort((a, b) => a.beat - b.beat);
      });
    },

    deleteClip(s, id) {
      VN.mutate(() => {
        for (const t of VN.tracksOf(s)) s.tracks[t.key] = (s.tracks[t.key] || []).filter((c) => c.id !== id);
        if (VN.ui.sel === id) VN.ui.sel = null;
      });
    },

    scrollToBeat(b) {
      const sc = document.querySelector('.tl-scroll');
      if (!sc) return;
      const x = HEAD + b * VN.ui.zoom;
      if (x < sc.scrollLeft + HEAD || x > sc.scrollLeft + sc.clientWidth - VN.ui.zoom) sc.scrollLeft = Math.max(0, x - sc.clientWidth / 2);
    },

    render(root) {
      const s = VN.curScene();
      VN.ensureTracks(s);
      const oldScroll = root.querySelector('.tl-scroll');
      if (oldScroll) Story._scroll = { left: oldScroll.scrollLeft, top: oldScroll.scrollTop };
      if (Story._ro) Story._ro.disconnect();
      root.innerHTML = '';
      if (VN.ui.beat >= s.beats) VN.ui.beat = s.beats - 1;
      if (VN.ui.beat < 0) VN.ui.beat = 0;

      // Kopfzeile
      root.appendChild(el('div', { class: 'view-head' },
        el('input', { class: 'name-input', value: s.name, 'aria-label': 'Szenenname', onchange: (e) => VN.mutate(() => { s.name = e.target.value || 'Szene'; }) }),
        el('span', { class: 'muted' }, s.beats + ' Schritte · ' + s.tracks.dialog.length + ' Dialoge'),
        window.Perf ? Story.perfChip(s) : null,
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn', onclick: () => Story.addDialog(s) }, '+ Dialog'),
        el('button', { class: 'btn', title: 'Fertige Dialoge als Text einfügen (auch Ren\'Py)', onclick: () => VN.TextImport.open(s) }, '⤓ Text'),
        el('button', { class: 'btn', onclick: () => VN.mutate(() => { s.beats++; }) }, '+ Schritt'),
        el('button', {
          class: 'btn', title: 'Letzten Schritt entfernen',
          onclick: () => {
            const maxEnd = Math.max(1, ...VN.tracksOf(s).flatMap((t) => (s.tracks[t.key] || []).map((c) => c.start + c.len)));
            if (s.beats - 1 < maxEnd) return VN.toast('Im letzten Schritt liegen noch Clips.');
            VN.mutate(() => { s.beats = Math.max(1, s.beats - 1); });
          }
        }, '− Schritt'),
        el('button', { class: 'btn', onclick: () => Player.start(s.id, VN.ui.beat) }, '▶ ab Schritt ' + (VN.ui.beat + 1)),
        (() => {
          const s2 = el('select', { class: 'fmt-sel', title: 'Wie sieht die Szene auf anderen Bildschirmen aus?', onchange: (e) => { VN.ui.fmtPreview = e.target.value; VN.render(); } });
          for (const [v, l] of [['', 'Format: ' + VN.aspectName(VN.res().w, VN.res().h)], ['4:3', 'Vorschau 4:3'], ['16:10', 'Vorschau 16:10'], ['16:9', 'Vorschau 16:9'], ['21:9', 'Vorschau 21:9'], ['9:16', 'Vorschau Handy 9:16']]) { const o = el('option', { value: v }, l); if (v === (VN.ui.fmtPreview || '')) o.selected = true; s2.appendChild(o); }
          return s2;
        })()
      ));

      // Bühne
      const wrap = el('div', { class: 'stage-wrap' });
      const stage = el('div', { class: 'stage' });
      wrap.appendChild(stage);
      root.appendChild(wrap);
      Stage.renderStory(stage, s, VN.ui.beat);
      if (VN.ui.fmtPreview) Export.formatOverlay(stage, VN.ui.fmtPreview);
      Story._ro = Stage.fit(wrap, stage);
      // Figuren auf der Bühne ziehen: waagerecht = Position, senkrecht = Höhe (bei einem Keyframe im aktuellen Schritt wird der Keyframe geändert)
      stage.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const hit = Story.hitTest(stage, e.clientX, e.clientY);
        const f = hit && VN.findClip(s, hit);
        if (!f || VN.tbase(f.track) !== 'char' || f.track.lock) return;
        const c = f.clip;
        const node = stage.querySelector('[data-clip="' + c.id + '"]');
        if (!node) return;
        e.preventDefault();
        const key = (c.keys || []).find((k) => k.beat === VN.ui.beat && (k.x != null || k.y != null));
        const pr = window.Fx ? Fx.propsAt(c, VN.ui.beat) : { x: c.x != null ? c.x : 50, y: c.y || 0 };
        const r = stage.getBoundingClientRect();
        let nx = pr.x, ny = pr.y;
        VN.drag(e, (dx, dy, ev) => {
          let ddx = dx, ddy = dy;
          if (ev && ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) ddy = 0; else ddx = 0; }
          nx = Math.max(-20, Math.min(120, Math.round((pr.x + ddx / r.width * 100) * 2) / 2));
          ny = Math.max(-40, Math.min(60, Math.round((pr.y - ddy / r.height * 100) * 2) / 2));
          node.style.left = nx + '%';
          node.style.bottom = ny + '%';
        }, (dx, dy, moved) => {
          if (!moved) { VN.ui.sel = c.id; VN.render(); return; }
          VN.mutate(() => {
            // Liegt vor diesem Schritt schon ein Keyframe mit Position, würde er die Basis überdecken: dann hier einen Keyframe setzen
            const earlier = (c.keys || []).some((k) => k.beat < VN.ui.beat && (k.x != null || k.y != null));
            let tgt = key || c;
            if (!key && earlier) { c.keys = c.keys || []; tgt = (c.keys.find((k) => k.beat === VN.ui.beat)) || (c.keys.push({ beat: VN.ui.beat }), c.keys[c.keys.length - 1]); }
            tgt.x = nx; tgt.y = ny; VN.ui.sel = c.id;
          });
        });
      });
      // Rechtsklick auf ein Objekt der Bühne: Design-Reiter öffnen
      stage.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const hit = Story.hitTest(stage, e.clientX, e.clientY);
        const items = [];
        if (hit) {
          const f = VN.findClip(s, hit);
          if (f) {
            items.push({ head: f.track.label + ' · ' + clipLabel(f.clip, f.track).slice(0, 36) });
            items.push({ label: '🎨 Design ändern …', action: () => { VN.ui.sel = f.clip.id; Design.openTab(); } });
            items.push({ label: 'Eigenschaften', action: () => { VN.ui.sel = f.clip.id; VN.ui.inspTab = 'props'; VN.render(); } });
            items.push('sep');
          }
        } else items.push({ head: 'Bühne' });
        items.push({ label: 'Projekt-Design öffnen', hint: 'Sprechblasen, Buttons, Fenster …', action: () => Design.open('bubble') });
        VN.menu(e.clientX, e.clientY, items);
      });

      // Timeline
      const BW = VN.ui.zoom;
      const total = s.beats + 4;
      const laneW = total * BW;
      const tl = el('div', { class: 'timeline' });
      const zoom = el('input', {
        type: 'range', min: 44, max: 200, value: BW, style: { width: '140px', accentColor: 'var(--accent)' }, 'aria-label': 'Zoom',
        onchange: (e) => { VN.ui.zoom = parseInt(e.target.value, 10); VN.render(); }
      });
      tl.appendChild(el('div', { class: 'tl-tools' },
        el('strong', null, 'Timeline'),
        el('span', { class: 'muted small' }, 'Eine Spalte = ein Klick des Spielers'),
        el('div', { style: { flex: '1' } }),
        el('span', { class: 'muted small' }, 'Zoom'), zoom));

      const scroll = el('div', { class: 'tl-scroll' });
      const inner = el('div', { class: 'tl-inner', style: { width: (HEAD + laneW) + 'px' } });

      // Lineal
      const rulerLane = el('div', { class: 'tl-ruler-lane', style: { width: laneW + 'px' } });
      for (let b = 0; b < total; b++) {
        rulerLane.appendChild(el('div', { class: 'tl-tick', style: { left: b * BW + 'px', color: b >= s.beats ? '#4a4d58' : '' } }, String(b + 1)));
      }
      rulerLane.addEventListener('mousedown', (e) => {
        const r = rulerLane.getBoundingClientRect();
        const b = Math.max(0, Math.min(s.beats - 1, Math.floor((e.clientX - r.left) / BW)));
        VN.ui.beat = b;
        VN.render();
      });
      inner.appendChild(el('div', { class: 'tl-ruler' }, el('div', { class: 'tl-head' }, 'Schritt'), rulerLane));

      // Spuren
      const tracks = VN.tracksOf(s);
      VN.ensureTracks(s);
      for (const t of tracks) {
        const lane = el('div', {
          class: 'tl-lane' + (t.lock ? ' locked' : '') + (!VN.trackOn(s, t, tracks) ? ' off' : ''),
          style: { width: laneW + 'px', backgroundImage: `repeating-linear-gradient(90deg, #22242b 0 1px, transparent 1px ${BW}px)` }
        });
        const clips = s.tracks[t.key];
        if (!clips.length) {
          // Hinweis, wenn die Spur leer ist
          const hint = t.kind === 'overlay' ? 'Doppelklick: Farb-/Licht-Ebene · Partikel und Filter aus „Effekte“ links hierher ziehen'
            : t.kind === 'camera' ? 'Doppelklick: Kamerafahrt (Zoom, Schwenk, Wackeln) · Vorlagen aus „Effekte“ links'
            : t.kind === 'video' ? 'WebM- oder MP4-Video hierher ziehen (Zwischensequenz oder Hintergrund)'
            : t.kind === 'image' ? 'Bild hierher ziehen oder doppelklicken'
            : t.kind === 'audio' ? 'Audio hierher ziehen (OGG, WAV, MP3 …)'
              : t.kind === 'dialog' ? 'Doppelklick für neuen Dialog' : 'Doppelklick für eine Auswahl';
          lane.appendChild(el('div', { class: 'lane-hint' }, hint));
        }
        for (const c of clips) lane.appendChild(Story.clipEl(s, c, t, BW));

        const beatAt = (e) => {
          const r = lane.getBoundingClientRect();
          return Math.max(0, Math.floor((e.clientX - r.left) / BW));
        };
        lane.addEventListener('dblclick', (e) => {
          if (e.target.closest('.clip')) return;
          if (t.lock) return VN.toast('Spur ist gesperrt (Schloss im Spurkopf)');
          Story.addClip(s, t, beatAt(e));
        });
        lane.addEventListener('contextmenu', (e) => {
          if (e.target.closest('.clip')) return;
          e.preventDefault();
          const b = beatAt(e);
          VN.menu(e.clientX, e.clientY, [
            { head: t.label + ' · Schritt ' + (b + 1) },
            { label: 'Neuen Clip hier anlegen', action: () => Story.addClip(s, t, b) }
          ]);
        });
        const dropKind = t.kind === 'overlay' ? 'image' : t.kind;
        const accepts = (e) => {
          if (t.lock) return false;
          const types = Array.from(e.dataTransfer.types);
          if (types.includes('vn/fxpreset')) return t.kind === 'overlay' || t.kind === 'camera' || VN.tbase(t) === 'bg';
          if (types.includes('Files')) return dropKind === 'image' || dropKind === 'audio' || dropKind === 'video';
          return types.includes('vn/asset-' + dropKind);
        };
        lane.addEventListener('dragover', (e) => {
          if (!accepts(e)) return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
          lane.classList.add('dragover');
        });
        lane.addEventListener('dragleave', () => lane.classList.remove('dragover'));
        lane.addEventListener('drop', async (e) => {
          lane.classList.remove('dragover');
          if (!accepts(e)) return;
          e.preventDefault();
          e.stopPropagation();
          document.getElementById('drag-overlay').hidden = true;
          const b = beatAt(e);
          const pre = e.dataTransfer.getData('vn/fxpreset');
          if (pre) return Story.addPreset(s, t, b, JSON.parse(pre));
          const id = e.dataTransfer.getData('vn/asset-' + dropKind);
          if (id) return Story.addClip(s, t, b, id);
          const added = await VN.importPaths(VN.filePaths(e.dataTransfer));
          let at = b;
          for (const a of added) {
            if (a.kind !== dropKind) continue;
            const c = Story.addClip(s, t, at, a.id);
            at = c.start + (t.kind === 'audio' && VN.tbase(t) !== 'music' ? 1 : c.len);
          }
        });

        inner.appendChild(el('div', { class: 'tl-row' + (t.kind === 'audio' ? ' audio' : '') + (t.sep ? ' sep' : '') + (t.extra ? ' extra' : '') },
          Story.trackHead(s, t, tracks),
          lane));
      }
      // Neue Spur anlegen
      inner.appendChild(el('div', { class: 'tl-row tl-addrow' },
        el('div', { class: 'tl-head' }, el('button', { class: 'btn tiny tl-add', onclick: (e) => Story.addTrackMenu(s, e) }, '+ Spur')),
        el('div', { class: 'tl-lane', style: { width: laneW + 'px' } })));

      inner.appendChild(el('div', { class: 'tl-beatcol', style: { left: (HEAD + VN.ui.beat * BW) + 'px', width: BW + 'px', top: '26px' } }));
      inner.appendChild(el('div', { class: 'tl-end', style: { left: (HEAD + s.beats * BW) + 'px', top: '26px' }, title: 'Ende der Szene' }));
      scroll.appendChild(inner);
      tl.appendChild(scroll);
      root.appendChild(tl);
      scroll.scrollLeft = Story._scroll.left;
      scroll.scrollTop = Story._scroll.top;
    },

    // Welcher Clip liegt auf der Bühne an dieser Stelle? (Dialog vor Auswahl vor Figuren vor Hintergrund)
    hitTest(stage, x, y) {
      const inside = (n) => { const r = n.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
      const nodes = Array.from(stage.querySelectorAll('[data-clip]'));
      const rank = (n) => (n.classList.contains('dlg-box') ? 0 : n.classList.contains('choice-box') ? 1 : n.classList.contains('char') ? 2 : n.classList.contains('bg-img') ? 4 : 3);
      const hits = nodes.filter((n) => {
        if (n.classList.contains('char')) {
          const inner = n.querySelector('img, canvas');
          return inner ? inside(inner) : inside(n);
        }
        return inside(n);
      }).sort((a, b) => rank(a) - rank(b) || nodes.indexOf(b) - nodes.indexOf(a));
      const pick = hits.find((n) => !n.classList.contains('fx-layer')) || hits[0];
      return pick ? pick.dataset.clip : null;
    },

    clipEl(s, c, t, BW) {
      const needsAsset = (t.kind === 'image' && !c.set) || t.kind === 'audio' || (t.kind === 'video' && !c.anim);
      const node = el('div', {
        class: 'clip' + (t.kind === 'dialog' ? ' clip-user' : '') + (VN.ui.sel === c.id ? ' sel' : '') + (needsAsset && !VN.asset(c.asset) ? ' empty' : '') + (t.kind === 'audio' ? ' audio' : ''),
        style: { left: c.start * BW + 1 + 'px', width: Math.max(16, c.len * BW - 2) + 'px', background: t.color, color: t.fg },
        title: clipLabel(c, t)
      }, el('span', null, clipLabel(c, t)));
      if (t.kind !== 'dialog' && t.kind !== 'choice') node.appendChild(el('div', { class: 'rs', title: 'Ziehen zum Verlängern' }));
      // Keyframes als Rauten auf dem Clip
      for (const k of c.keys || []) if (k.beat >= c.start && k.beat < c.start + c.len) node.appendChild(el('span', { class: 'kf', title: 'Keyframe Schritt ' + (k.beat + 1), style: { left: ((k.beat - c.start) * BW + 3) + 'px' } }));
      for (const b of Object.keys(c.picks || {})) if (b >= c.start && b < c.start + c.len) node.appendChild(el('span', { class: 'kf pick', title: 'Ausdruck/Outfit ab Schritt ' + (Number(b) + 1), style: { left: ((b - c.start) * BW + 3) + 'px' } }));

      node.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        if (t.lock) { VN.ui.sel = c.id; VN.render(); return; }
        const resizing = e.target.classList.contains('rs');
        const orig = { start: c.start, len: c.len };
        let val = resizing ? orig.len : orig.start;
        VN.drag(e, (dx) => {
          const d = Math.round(dx / BW);
          if (resizing) { val = Math.max(1, orig.len + d); node.style.width = Math.max(16, val * BW - 2) + 'px'; }
          else { val = Math.max(0, orig.start + d); node.style.left = val * BW + 1 + 'px'; }
        }, (dx, dy, moved) => {
          if (moved && (resizing ? val !== orig.len : val !== orig.start)) {
            VN.mutate(() => {
              if (resizing) c.len = val; else c.start = val;
              s.beats = Math.max(s.beats, c.start + c.len);
              VN.ui.sel = c.id;
              if (!resizing) VN.ui.beat = c.start;
            });
          } else if (!moved) {
            VN.ui.sel = c.id;
            if (VN.ui.beat < c.start || VN.ui.beat >= c.start + c.len) VN.ui.beat = c.start;
            VN.render();
          } else VN.render();
        });
      });

      node.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        VN.ui.sel = c.id;
        const items = [{ head: t.label + ' · ' + clipLabel(c, t).slice(0, 40) }];
        if (t.key === 'choice') {
          c.options.forEach((o) => items.push({
            label: 'Alternativer Pfad: neue Szene', hint: '„' + (o.text || 'Option') + '“',
            action: () => VN.mutate(() => { const n = VN.createAltScene(s, o.text); o.target = n.id; })
          }));
          items.push('sep');
        }
        if (['char', 'cam', 'fx'].includes(VN.tbase(t))) {
          const kb = VN.ui.beat >= c.start && VN.ui.beat < c.start + c.len ? VN.ui.beat : c.start;
          const has = (c.keys || []).some((k) => k.beat === kb);
          items.push({ label: has ? 'Keyframe bei Schritt ' + (kb + 1) + ' bearbeiten' : '◆ Keyframe bei Schritt ' + (kb + 1) + ' setzen', action: () => { if (!has) Story.addKey(c, t, kb); VN.ui.sel = c.id; VN.ui.inspTab = 'props'; VN.ui.beat = kb; VN.render(); } });
        }
        if (Design.hasTab(t)) items.push({ label: '🎨 Design ändern …', hint: t.key === 'dialog' ? 'Sprechblase' : t.key === 'choice' ? 'Buttons' : 'Textur', action: () => Design.openTab() }, 'sep');
        if (t.key === 'dialog') items.push({ label: 'Dialog danach einfügen', action: () => Story.addClip(s, t, c.start + 1) });
        items.push({ label: 'Duplizieren', action: () => Story.duplicateClip(s, c, t) });
        items.push({ label: 'Löschen', hint: 'Entf', danger: true, action: () => Story.deleteClip(s, c.id) });
        VN.render();
        VN.menu(e.clientX, e.clientY, items);
      });
      return node;
    }
  });
})();
