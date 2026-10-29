// Lernen: Themen-Lektionen mit Aufgaben, die das Programm selbst erkennt und abhakt
(function () {
  const { el } = VN;
  const KEY = 'vn-learn';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const store = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* egal */ } };

  // Hilfen für die Prüfungen
  const S = (id) => VN.project && VN.scene('L_' + id);
  const all = (s, base) => (s ? VN.tracksOf(s).filter((t) => t.base === base).flatMap((t) => s.tracks[t.key] || []) : []);
  const bg = (s) => (s && s.tracks.bg[0]) || null;
  const ch = (s, n) => (s && s.tracks['char' + (n || 1)][0]) || null;
  const seen = {};   // Dinge, die nur kurz sichtbar sind (Fenster), werden gemerkt

  // Szene für eine Lektion anlegen (im Lernprojekt, nutzt die Bilder des Beispielprojekts)
  const scene = (id, name, build) => {
    let s = VN.scene('L_' + id);
    if (s) return s;
    s = VN.newStoryScene(VN.t('Lernen · ' + name), 120 + Object.keys(TOPICS).indexOf(id) * 40, 700);
    s.id = 'L_' + id;
    s.beats = 4;
    VN.ensureTracks(s);
    build(s);
    return s;
  };
  const line = (s, b, who, text) => s.tracks.dialog.push({ id: VN.uid('c'), start: b, len: 1, speaker: who, text: VN.t(text), speed: 0, actions: [] });

  const TOPICS = {
    kamera: {
      title: 'Kamera & Parallax', min: 6, icon: '🎥', desc: 'Zoom, Schwenk und Tiefe durch Bildebenen.',
      build: (s) => {
        s.tracks.bg.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_par_himmel', trans: 'fade', dur: 0.6, depth: 0, layers: [{ asset: 'a_par_berge', depth: 0.3, front: false }] });
        s.tracks.char1.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_ray', x: 50, scale: 62, trans: 'cut', dur: 0, idle: 'breathe' });
        line(s, 0, 'Ray', 'Hier fehlt noch Tiefe …'); line(s, 2, 'Ray', '… und eine Kamerafahrt!');
      },
      tasks: [
        { t: 'Klicke unten in der Timeline auf den Hintergrund-Clip.', sel: '.tl-lane .clip', ok: (s) => VN.ui.sel === bg(s).id },
        { t: 'Füge rechts unter „Parallax“ eine zweite Ebene hinzu (+ Ebene) und wähle „Parallax Hügel“.', sel: '#right', ok: (s) => (bg(s).layers || []).length >= 2 && bg(s).layers.some((L) => L.asset) },
        { t: 'Doppelklicke in die Kamera-Spur, um einen Kamera-Clip anzulegen.', sel: '.tl-row:nth-child(7)', ok: (s) => s.tracks.cam.length > 0 },
        { t: 'Setze am Kamera-Clip einen Keyframe bei Schritt 3 und stell dort einen Schwenk ein (Schwenk X).', sel: '#right', ok: (s) => s.tracks.cam.some((c) => (c.keys || []).some((k) => k.panX != null && Math.abs(k.panX - (c.panX || 0)) >= 3)) },
        { t: 'Teste die Szene mit „▶ ab Schritt“ und klicke dich bis zum Schwenk durch.', sel: '.btn', ok: () => Player.running }
      ]
    },
    keyframes: {
      title: 'Figuren bewegen (Keyframes)', min: 5, icon: '◆', desc: 'Figuren laufen, wachsen, drehen sich – mit weichen Kurven.',
      build: (s) => {
        s.tracks.bg.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_bg_hof', trans: 'fade', dur: 0.6 });
        s.tracks.char1.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_ray', x: 25, scale: 90, trans: 'fade', dur: 0.6, idle: 'breathe' });
        line(s, 0, 'Ray', 'Ich stehe hier links …'); line(s, 2, 'Ray', '… und sollte jetzt rüberlaufen.');
      },
      tasks: [
        { t: 'Klicke Ray in der Timeline (Figur 1) an.', sel: '.tl-lane .clip', ok: (s) => VN.ui.sel === ch(s).id },
        { t: 'Lege rechts unter „Bewegung (Keyframes)“ einen Keyframe bei Schritt 3 an (vorher oben Schritt 3 wählen).', sel: '#right', ok: (s) => (ch(s).keys || []).length > 0 },
        { t: 'Ändere im Keyframe die Position, z. B. auf 75 %.', sel: '#right', ok: (s) => (ch(s).keys || []).some((k) => k.x != null && Math.abs(k.x - ch(s).x) >= 10) },
        { t: 'Wähle eine andere Kurve, z. B. „Federnd“ oder „Langsam ankommen“.', sel: '#right', ok: (s) => (ch(s).keys || []).some((k) => k.ease && k.ease !== 'ease-in-out') },
        { t: 'Teste mit „▶ ab Schritt“.', ok: () => Player.running }
      ]
    },
    wetter: {
      title: 'Licht, Wetter & Übergänge', min: 5, icon: '🌧', desc: 'Tageszeit, passendes Licht, Regen und besondere Übergänge.',
      build: (s) => {
        s.tracks.bg.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_bg_hof', trans: 'fade', dur: 1 });
        s.tracks.char1.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_ray', x: 40, scale: 90, trans: 'fade', dur: 0.6, idle: 'breathe' });
        line(s, 0, 'Ray', 'Mitten am Tag … langweilig.');
      },
      tasks: [
        { t: 'Wähle den Hintergrund-Clip und stelle die Tageszeit auf „Nacht“.', sel: '#right', ok: (s) => bg(s).daytime === 'night' },
        { t: 'Schiebe „Figuren an das Licht anpassen“ hoch, damit Ray nicht aufgeklebt wirkt.', sel: '#right', ok: (s) => (bg(s).charLight || 0) > 0 },
        { t: 'Ziehe links unter „Effekte“ den Regen auf die Effekt-Ebene.', sel: '#asset-tabs', ok: (s) => all(s, 'fx').some((c) => c.particles === 'rain') },
        { t: 'Stelle beim Hintergrund den Übergang „Augen zu und auf“ oder „Mit Maske“ ein.', sel: '#right', ok: (s) => ['eyes', 'mask'].includes(bg(s).trans) },
        { t: 'Teste die Szene.', ok: () => Player.running }
      ]
    },
    endlos: {
      title: 'Endlos-Hintergründe', min: 4, icon: '☁', desc: 'Wolken, Himmel oder eine Zugfahrt endlos vorbeiziehen lassen.',
      build: (s) => {
        s.tracks.bg.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_par_himmel', trans: 'fade', dur: 0.6, layers: [{ asset: 'a_par_wolken', depth: 0.2, front: false }] });
        s.tracks.char1.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_ray', x: 50, scale: 70, trans: 'cut', dur: 0, idle: 'breathe' });
        line(s, 0, 'Ray', 'Die Wolken stehen still. Das ändern wir!');
      },
      tasks: [
        { t: 'Klicke den Hintergrund-Clip an.', sel: '.tl-lane .clip', ok: (s) => VN.ui.sel === bg(s).id },
        { t: 'Setze bei der Wolken-Ebene den Haken „endlos scrollen“.', sel: '#right', ok: (s) => (bg(s).layers || []).some((L) => L.tile && L.tile.on) },
        { t: 'Mach die Wolken etwas schneller (Tempo über 5).', sel: '#right', ok: (s) => (bg(s).layers || []).some((L) => L.tile && L.tile.on && L.tile.speed > 5) },
        { t: 'Probier „Ränder spiegeln“ oder eine andere Richtung aus.', sel: '#right', ok: (s) => (bg(s).layers || []).some((L) => L.tile && (L.tile.mirror || (L.tile.dir && L.tile.dir !== 'left'))) },
        { t: 'Teste die Szene.', ok: () => Player.running }
      ]
    },
    spuren: {
      title: 'Spuren & Gruppenszenen', min: 5, icon: '☰', desc: 'Mehr Figuren, Atmo neben der Musik, Spuren stumm schalten.',
      build: (s) => {
        s.tracks.bg.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_bg_gilde', trans: 'fade', dur: 0.6 });
        s.tracks.char1.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_ray', x: 22, scale: 85, trans: 'cut', dur: 0, idle: 'breathe' });
        s.tracks.char2.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_wache', x: 52, scale: 85, trans: 'cut', dur: 0, idle: 'breathe' });
        s.tracks.music.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_musik', vol: 60, loop: true, carry: false, fade: 1 });
        line(s, 0, 'Ray', 'Zwei Figuren … da passt noch eine dritte hin.');
      },
      tasks: [
        { t: 'Klicke unter der Timeline auf „+ Spur“ und wähle „Figur“.', sel: '.tl-add', ok: (s) => (s.xtracks || []).some((x) => x.base === 'char') },
        { t: 'Ziehe die Wache (links unter Bilder) auf die neue Figur-Spur.', sel: '.tl-row.extra', ok: (s) => (s.xtracks || []).some((x) => x.base === 'char' && (s.tracks[x.key] || []).some((c) => c.asset)) },
        { t: 'Lege eine Spur „Musik / Atmo“ an.', sel: '.tl-add', ok: (s) => (s.xtracks || []).some((x) => x.base === 'music') },
        { t: 'Benenne eine Spur um (Doppelklick auf den Namen).', sel: '.tl-head', ok: (s) => Object.values(s.tro || {}).some((o) => o.name) || (s.xtracks || []).some((x) => x.name && !/^(Figur|Musik|Soundeffekte|Stimme|Effekt-Ebene) \d+$/.test(x.name)) },
        { t: 'Schalte die Musik-Spur stumm (Maus drüber → M).', sel: '.tl-head', ok: (s) => !!(s.tro && s.tro.music && s.tro.music.mute) }
      ]
    },
    text: {
      title: 'Text-Effekte & Chat', min: 4, icon: '✦', desc: 'Zitternde Wörter, Farben, Pausen und Handy-Nachrichten.',
      build: (s) => {
        s.tracks.bg.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_bg_keller', trans: 'fade', dur: 0.6 });
        s.tracks.char1.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_ray', x: 35, scale: 90, trans: 'cut', dur: 0, idle: 'breathe' });
        line(s, 0, 'Ray', 'Da war ein Geräusch! Hast du das gehört?');
        line(s, 1, 'Ray', 'Ich schreib der Gilde eine Nachricht.');
      },
      tasks: [
        { t: 'Klicke die erste Dialogzeile an.', sel: '.tl-lane .clip', ok: (s) => VN.ui.sel === s.tracks.dialog[0].id },
        { t: 'Markiere „Geräusch“ im Text und klicke „〰 Zittern“.', sel: '.tt-bar', ok: (s) => s.tracks.dialog.some((d) => /\{(shake|wave)\}/.test(d.text || '')) },
        { t: 'Gib einem Wort eine Farbe (Farbfeld in der Leiste, dann „Farbe“).', sel: '.tt-bar', ok: (s) => s.tracks.dialog.some((d) => /\{color=/.test(d.text || '')) },
        { t: 'Mach die zweite Zeile zur Handy-Nachricht (Chat-Modus).', sel: '#right', ok: (s) => s.tracks.dialog.some((d) => d.chat) },
        { t: 'Teste die Szene.', ok: () => Player.running }
      ]
    },
    figuren: {
      title: 'Bones & Gewichte', min: 6, icon: '🦴', desc: 'Figuren bekommen ein Skelett, atmen, wehen – und du malst, was mitgeht.',
      build: (s) => {
        s.tracks.bg.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_bg_gilde', trans: 'fade', dur: 0.6 });
        s.tracks.char1.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_ray', x: 50, scale: 95, trans: 'cut', dur: 0, idle: 'breathe' });
      },
      tasks: [
        { t: 'Öffne oben „Figuren“.', sel: '#view-tabs', ok: () => VN.ui.view === 'bones' },
        { t: 'Wähle Ray und klicke „▶ Bewegung“, um das Atmen zu sehen. Dann wieder stoppen.', sel: '.view-head', ok: () => VN.ui.bonePlay === true || seen.bonePlayed, mark: () => { if (VN.ui.bonePlay) seen.bonePlayed = true; } },
        { t: 'Wähle das Werkzeug „Gewichte malen“ und klicke einen Arm-Knochen an.', sel: '.view-head', ok: () => VN.ui.boneTool === 'paint' && !!VN.ui.boneSel },
        { t: 'Male mit „＋ Mehr“ über den Arm.', sel: '.bone-stage', ok: () => { const r = VN.project.rigs.a_ray; return !!(r && r.paint && Object.keys(r.paint).length); } },
        { t: 'Prüfe das Ergebnis mit „▶ Bewegung“.', sel: '.view-head', ok: () => VN.ui.bonePlay === true && VN.ui.boneTool === 'paint' }
      ]
    },
    animation: {
      title: 'Animations-Editor', min: 6, icon: '🎞', desc: 'Idle-Schleifen und Gesten mit Knochen – oder ganze Zwischensequenzen.',
      build: (s) => {
        s.tracks.bg.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_bg_gilde', trans: 'fade', dur: 0.6 });
        s.tracks.char1.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_ray', x: 50, scale: 95, trans: 'cut', dur: 0, idle: 'breathe' });
        line(s, 0, 'Ray', 'Gleich wippe ich im Takt.');
      },
      start: () => { seen.animCount = (VN.project.anims || []).length; },
      tasks: [
        { t: 'Öffne oben „Animation“.', sel: '#view-tabs', ok: () => VN.ui.view === 'anim' },
        { t: 'Lege eine neue Idle-Animation an.', sel: '.view-head', ok: () => (VN.project.anims || []).length > (seen.animCount || 0) },
        { t: 'Wähle eine fertige Bewegung (z. B. „Wippen“ oder „Nicken“) oder setze selbst Keyframes.', sel: '#right', ok: () => (VN.project.anims || []).slice(seen.animCount || 0).some((a) => JSON.stringify(a.tracks || a.keys || a.actors || {}).length > 60) },
        { t: 'Geh zurück zur Szene „Lernen · Animations-Editor“, wähle Ray und stelle die neue Idle-Animation ein.', sel: '#right', ok: (s) => !!(ch(s) && ch(s).idleAnim) },
        { t: 'Teste die Szene.', ok: () => Player.running }
      ]
    },
    design: {
      title: 'Design & Themes', min: 4, icon: '🎨', desc: 'Sprechblasen, Farben, Rahmen und Schriften fürs ganze Spiel.',
      build: (s) => {
        s.tracks.bg.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_bg_keller', trans: 'fade', dur: 0.6 });
        s.tracks.char1.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_ray', x: 35, scale: 90, trans: 'cut', dur: 0, idle: 'breathe' });
        line(s, 0, 'Ray', 'Wie sieht meine Sprechblase eigentlich aus?');
      },
      start: () => { seen.preset = (Theme.t().bubble || {}).preset; seen.speakers = JSON.stringify(Theme.t().speakers || {}); },
      tasks: [
        { t: 'Öffne oben „Design“.', sel: '#view-tabs', ok: () => VN.ui.view === 'design' },
        { t: 'Wähle eine andere Sprechblasen-Vorlage, z. B. „Pergament“ oder „Comic“.', sel: '#main', ok: () => (Theme.t().bubble || {}).preset !== seen.preset },
        { t: 'Gib Ray eine eigene Sprechblase (Bereich „Sprecher“).', sel: '#main', ok: () => JSON.stringify(Theme.t().speakers || {}) !== seen.speakers },
        { t: 'Teste das Ergebnis in der Lern-Szene.', ok: () => Player.running }
      ]
    },
    leben: {
      title: 'Lebenssimulation', min: 7, icon: '♥', desc: 'Zeit, Geld, Beziehungen, Geschenke und Jobs – das Dating-Sim-Paket.',
      build: (s) => {
        s.tracks.bg.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_bg_gilde', trans: 'fade', dur: 0.6 });
        s.tracks.char1.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_ray', x: 35, scale: 90, trans: 'cut', dur: 0, idle: 'breathe' });
        line(s, 0, 'Ray', 'Na? Hilfst du mir heute in der Taverne?');
        s.tracks.choice.push({ id: VN.uid('c'), start: 1, len: 1, options: [
          { id: VN.uid('opt'), text: VN.t('Klar, für dich immer!'), target: null, conds: [], actions: [] },
          { id: VN.uid('opt'), text: VN.t('Keine Zeit.'), target: null, conds: [], actions: [] }] });
        line(s, 2, 'Ray', 'Dann los!');
      },
      tasks: [
        { t: 'Öffne „Spielsysteme“ → „Übersicht“ und schalte „Beziehungen“ ein.', sel: '#view-tabs', ok: () => !!(VN.project.relations && VN.project.relations.enabled) },
        { t: 'Füge im Reiter „Beziehungen“ Ray hinzu (Knopf „+ Ray“).', sel: '.sys-body', ok: () => VN.project.relations.chars.some((c) => c.name === 'Ray') },
        { t: 'Geh zurück zur Lern-Szene, klicke die Auswahl an und gib der ersten Antwort ♥ Ray +10.', sel: '#right', ok: (s) => s.tracks.choice.some((c) => c.options.some((o) => (o.rel || []).some((r) => Number(r.amount) > 0))) },
        { t: 'Schalte „Zeit & Kalender“ ein und gib der ersten Antwort die Aktion „Zeit vergehen lassen“.', sel: '#right', ok: (s) => VN.project.time.enabled && s.tracks.choice.some((c) => c.options.some((o) => (o.actions || []).some((a) => a.type === 'time'))) },
        { t: 'Schalte in der Übersicht das Plugin „Jobs“ ein und schau dir den Reiter „Jobs“ an.', sel: '#view-tabs', ok: () => !!(window.VNPlugin && VNPlugin.plugins.jobs) },
        { t: 'Teste die Szene, wähl die erste Antwort und drück B für die Beziehungen.', ok: () => seen.relScreen || false, mark: () => { if (document.querySelector('.rel-list')) seen.relScreen = true; } }
      ]
    },
    export: {
      title: 'Export, Größe & Leistung', min: 3, icon: '📦', desc: 'Wie groß wird das Spiel, läuft es flüssig, und wie exportiere ich?',
      build: (s) => {
        s.tracks.bg.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_par_himmel', trans: 'fade', dur: 0.6, depth: 0, layers: [{ asset: 'a_par_berge', depth: 0.3 }, { asset: 'a_par_huegel', depth: 0.65 }] });
        s.tracks.char1.push({ id: VN.uid('c'), start: 0, len: 4, asset: 'a_ray', x: 50, scale: 70, trans: 'cut', dur: 0, idle: 'breathe' });
      },
      tasks: [
        { t: 'Klicke oben über der Bühne auf die Leistungs-Ampel („Leistung: …“).', sel: '.perf-chip', ok: () => seen.perf, mark: () => { if (document.querySelector('.perf-modal')) seen.perf = true; } },
        { t: 'Klicke links unten auf die Spielgröße („Spiel ca. … MB“).', sel: '#size-badge', ok: () => seen.size, mark: () => { if (document.querySelector('.size-modal:not(.perf-modal)')) seen.size = true; } },
        { t: 'Öffne „Exportieren“ und schau dir Auflösung und Formate an (noch nicht exportieren).', sel: '#b-export', ok: () => seen.exp, mark: () => { if (document.querySelector('.export-modal')) seen.exp = true; } },
        { t: 'Teste das Spiel und drücke ^ für die Entwickler-Konsole.', ok: () => seen.console, mark: () => { if (document.querySelector('.dev-console')) seen.console = true; } }
      ]
    }
  };

  let cur = null, timer = null, panel = null;

  const Learn = (window.Learn = {
    TOPICS,
    progress: load,
    // Themen-Übersicht
    open() {
      const prog = load();
      const back = el('div', { class: 'modal-back', onclick: (ev) => { if (ev.target === back) back.remove(); } });
      const grid = el('div', { class: 'learn-grid' });
      for (const [id, T] of Object.entries(TOPICS)) {
        const done = prog[id] && prog[id].done;
        const n = prog[id] && prog[id].tasks ? prog[id].tasks.length : 0;
        grid.appendChild(el('div', { class: 'learn-card' + (done ? ' done' : ''), onclick: () => { back.remove(); Learn.start(id); } },
          el('div', { class: 'lc-ico' }, T.icon),
          el('div', { class: 'lc-body' },
            el('strong', null, T.title),
            el('div', { class: 'muted small' }, T.desc),
            el('div', { class: 'lc-meta small' }, done ? '✓ geschafft' : n ? n + ' von ' + T.tasks.length + ' Aufgaben' : 'ca. ' + T.min + ' Minuten · ' + T.tasks.length + ' Aufgaben'))));
      }
      const doneN = Object.keys(TOPICS).filter((k) => prog[k] && prog[k].done).length;
      back.appendChild(el('div', { class: 'modal learn-modal' },
        el('div', { class: 'row gap8' }, el('strong', { style: { flex: '1', fontSize: '17px' } }, 'Lernen'), el('span', { class: 'muted small' }, doneN + ' von ' + Object.keys(TOPICS).length + ' Themen geschafft'), el('button', { class: 'btn', onclick: () => back.remove() }, 'Schließen')),
        el('div', { class: 'muted small' }, 'Jedes Thema ist eine kleine Szene im Lernprojekt. Rechts unten stehen die Aufgaben – das Programm hakt sie selbst ab, sobald du sie erledigt hast. Dein eigenes Projekt bleibt unberührt.'),
        grid));
      document.body.appendChild(back);
    },
    // Lektion starten: Lernprojekt laden, Szene anlegen, Aufgaben-Panel zeigen
    async start(id) {
      const T = TOPICS[id];
      if (!T) return;
      if (!VN.project || !VN.project.learn) {
        if (VN.project && VN.save) await VN.save();
        const r = await VN.api.learnProject();
        if (!r) return;
        r.data.learn = true;
        await App.load(r.dir, r.data, { fresh: !!r.fresh });
      }
      VN.ui.noAutoTour = true;
      let s = VN.scene('L_' + id);
      if (!s) { VN.mutate(() => { s = scene(id, T.title, T.build); }); s = VN.scene('L_' + id); }
      if (T.start) T.start();
      App.openScene(s.id);
      cur = id;
      Learn.panel();
      clearInterval(timer);
      timer = setInterval(Learn.check, 600);
    },
    stop() { clearInterval(timer); timer = null; cur = null; if (panel) panel.remove(); panel = null; },
    check() {
      if (!cur || !VN.project) return;
      if (!VN.project.learn) return Learn.stop();
      const T = TOPICS[cur], s = S(cur);
      const prog = load();
      const P = prog[cur] = prog[cur] || { tasks: [] };
      let changed = false;
      T.tasks.forEach((k, i) => {
        if (k.mark) { try { k.mark(); } catch (e) { /* egal */ } }
        if (P.tasks.includes(i)) return;
        let ok = false;
        try { ok = !!k.ok(s); } catch (e) { ok = false; }
        // Aufgaben der Reihe nach: eine spätere zählt erst, wenn die vorige erledigt ist
        if (ok && T.tasks.slice(0, i).every((_, j) => P.tasks.includes(j))) { P.tasks.push(i); changed = true; }
      });
      if (changed) {
        if (P.tasks.length >= T.tasks.length) P.done = true;
        store(prog);
        Learn.panel();
        if (P.done) VN.toast('✓ Thema „' + T.title + '“ geschafft!');
      }
    },
    panel() {
      if (panel) panel.remove();
      if (!cur) return;
      const T = TOPICS[cur];
      const P = load()[cur] || { tasks: [] };
      const next = T.tasks.findIndex((_, i) => !P.tasks.includes(i));
      panel = el('div', { class: 'learn-panel' + (Learn.mini ? ' mini' : '') },
        el('div', { class: 'lp-head' }, el('span', null, T.icon + ' ' + T.title), el('button', { class: 'btn tiny ghost', title: Learn.mini ? 'Alle Aufgaben zeigen' : 'Kleiner machen', onclick: () => { Learn.mini = !Learn.mini; Learn.panel(); } }, Learn.mini ? '▴' : '▾'), el('button', { class: 'btn tiny ghost', title: 'Andere Themen', onclick: () => Learn.open() }, 'Themen'), el('button', { class: 'btn tiny ghost', title: 'Schließen', onclick: () => Learn.stop() }, '×')),
        el('div', { class: 'lp-bar' }, el('span', { style: { width: (P.tasks.length / T.tasks.length * 100) + '%' } })),
        ...T.tasks.map((k, i) => el('div', { class: 'lp-task' + (P.tasks.includes(i) ? ' ok' : '') + (i === next ? ' now' : '') },
          el('span', { class: 'lp-check' }, P.tasks.includes(i) ? '✓' : String(i + 1)),
          el('span', { class: 'lp-text' }, k.t),
          i === next && k.sel ? el('button', { class: 'btn tiny', onclick: () => Learn.show(k.sel) }, 'Zeigen') : null)),
        next < 0 ? el('div', { class: 'lp-done' }, 'Geschafft! ', el('button', { class: 'btn tiny primary', onclick: () => Learn.open() }, 'Nächstes Thema')) : null);
      document.body.appendChild(panel);
    },
    // Stelle kurz aufleuchten lassen
    show(sel) {
      const n = Array.from(document.querySelectorAll(sel)).find((x) => x.offsetParent !== null);
      if (!n) return VN.toast('Die Stelle ist gerade nicht sichtbar – vielleicht erst den richtigen Bereich öffnen.');
      n.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      n.classList.remove('learn-pulse'); void n.offsetWidth; n.classList.add('learn-pulse');
      setTimeout(() => n.classList.remove('learn-pulse'), 2600);
    }
  });
})();
