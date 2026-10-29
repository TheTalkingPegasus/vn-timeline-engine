// Geführte Tour: Fenster zeigen nacheinander, wo was ist. Schritte sind eine einfache Liste,
// Plugins können mit Tour.register('id', { title, steps }) eigene Touren mitbringen.
(function () {
  const { el } = VN;
  const SEEN_KEY = 'vn-tours-seen';
  const seen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch (e) { return {}; } };
  const markSeen = (id) => { try { const s = seen(); s[id] = true; localStorage.setItem(SEEN_KEY, JSON.stringify(s)); } catch (e) { /* egal */ } };

  const firstDialog = (sceneId, i) => { const s = VN.scene(sceneId); return s && s.type === 'story' ? [...s.tracks.dialog].sort((a, b) => a.start - b.start)[i || 0] : null; };
  const openScene = (id) => { if (VN.scene(id)) { VN.ui.view = 'scene'; VN.ui.sceneId = id; VN.ui.sel = null; VN.ui.beat = 0; VN.ui.inspTab = 'props'; VN.render(); } };
  const tutScene = (tutId, fallbackIdx) => (VN.scene(tutId) ? tutId : (VN.project.scenes[fallbackIdx || 0] || {}).id);

  const TOURS = {
    main: {
      title: 'Rundgang',
      steps: [
        { title: 'Willkommen!', text: 'Mit der VN Timeline Engine baust du Visual Novels wie in einem Schnittprogramm: Bilder, Texte und Töne liegen als Clips auf einer Timeline. Das Tutorial-Projekt hat sieben kleine Szenen, jede zeigt genau ein Thema. Diese Tour dauert etwa zwei Minuten.' },
        { target: '#scene-list', title: 'Szenen', text: 'Hier liegen alle Szenen deines Spiels. Story-Szenen laufen Schritt für Schritt ab, Hub-Szenen (weißer Punkt) sind Orte zum Herumklicken. Neue legst du mit „+ Story“ und „+ Hub“ an.', pos: 'right' },
        { target: '#left .panel.grow', title: 'Dateien', text: 'Bilder, Audio und Schriften deines Projekts. Zieh Dateien einfach von deinem Computer hier hinein und von hier aus auf die Timeline oder die Bühne.', pos: 'right' },
        { target: '.stage', before: () => openScene(tutScene('t1')), title: 'Bühne', text: 'So sieht der aktuelle Schritt im Spiel aus. Ein Rechtsklick auf eine Figur, einen Hintergrund oder eine Sprechblase öffnet ihren Design-Reiter.', pos: 'bottom' },
        { target: '.timeline', title: 'Timeline', text: 'Jede Spalte ist ein Klick des Spielers. Clips verschieben, am rechten Rand ziehen zum Verlängern, Doppelklick auf eine Spur legt einen neuen Clip an.', pos: 'top' },
        { target: '#right', before: () => { openScene(tutScene('t2', 1)); const d = firstDialog(VN.ui.sceneId, 1); if (d) { VN.ui.sel = d.id; VN.ui.beat = d.start; VN.render(); } }, title: 'Inspektor', text: 'Rechts stehen die Eigenschaften dessen, was du gerade ausgewählt hast, hier ein Dialog. Oben wechselst du zwischen „Eigenschaften“ und „Design“.', pos: 'left' },
        { target: '#center', before: () => { VN.ui.view = 'graph'; VN.render(); }, title: 'Pfade', text: 'Alle Szenen und ihre Verbindungen als Blasen. Auswahlen verzweigen sich, Rechtsklick legt neue Pfade an. Die Szene „04 Auswahl“ hat zwei Wege.', pos: 'inside' },
        { target: '#center', before: () => { VN.ui.view = 'systems'; VN.ui.sysTab = 'vars'; VN.render(); }, title: 'Spielsysteme', text: 'Variablen, Gegenstände, Geld, Loot und Plugins. Benutzt werden sie überall als „Wenn → Dann“, zum Beispiel in Szene „05 Wenn → Dann“.', pos: 'inside' },
        { target: '#b-play-scene', alt: '#b-play-all', before: () => openScene(tutScene('t1')), title: 'Testen', text: '„Szene testen“ spielt die offene Szene ab dem gewählten Schritt. „Spiel testen“ startet alles mit Hauptmenü, genau wie später beim Spieler.', pos: 'bottom' },
        { target: '#b-export', title: 'Exportieren', text: 'Wenn alles fertig ist: als Windows-Spiel mit eigener .exe oder als Web-Spiel, zum Beispiel für itch.io. Die Tour kannst du jederzeit über den ?-Knopf oben wieder öffnen.', pos: 'bottom' }
      ]
    },
    bones: {
      title: 'Bones', steps: [
        { target: '#center', title: 'Bones', text: 'Hier bekommt eine Figur ein Skelett. Wähle ein Bild und eine Körper-Vorlage (Zweibeiner, Vierbeiner, Geflügelt …), dann bewegt sie sich weich.', pos: 'inside' },
        { target: '#right', title: 'Bewegung einstellen', text: 'Atmen, Schwanken und Nachfedern (Jiggle) für Haare, Flügel oder Schwänze stellst du hier ein.', pos: 'left' },
        { target: '#center', title: 'Augen und Blinzeln', text: 'Mit dem Werkzeug „Augen“ rahmst du die Augen ein. Dann blinzelt die Figur im Spiel von selbst.', pos: 'inside' }
      ]
    },
    menu: {
      title: 'Hauptmenü', steps: [
        { target: '.stage', title: 'Hauptmenü', text: 'So sieht der Startbildschirm aus. Buttons und Titel ziehst du mit der Maus an ihren Platz.', pos: 'bottom' },
        { target: '#right', title: 'Einstellungen', text: 'Hintergrund, Musik, Titel oder Logo und das Aussehen der Buttons. Im Reiter „Design“ kannst du den Buttons eigene Bilder geben.', pos: 'left' },
        { target: '.view-head', title: 'Ausprobieren', text: '„Menü testen“ zeigt das Menü so, wie es der Spieler sieht.', pos: 'bottom' }
      ]
    },
    transcript: {
      title: 'Transkript', steps: [
        { target: '#center', title: 'Transkript', text: 'Alle Texte deines Spiels in einer Liste: Dialoge, Antworten, Gegenstände, Menüs und Hub-Ereignisse.', pos: 'inside' },
        { target: '#right', title: 'Übersetzen', text: 'Lege weitere Sprachen an und übersetze Zeile für Zeile. Export als CSV für Übersetzer und als Sprecher-Skript für Sprachaufnahmen.', pos: 'left' }
      ]
    },
    plugins: {
      title: 'Plugins', steps: [
        { target: '#center', title: 'Plugins', text: 'Plugins sind JavaScript-Dateien im Ordner „plugins“ deines Projekts. Sie bringen eigene Aktionen mit, zum Beispiel Minispiele.', pos: 'inside' },
        { target: '#center', title: 'Benutzen', text: 'Jede Plugin-Aktion erscheint danach überall unter „+ Aktion“. Bild-Parameter lassen sich im Editor austauschen.', pos: 'inside' },
        { target: '#center', title: 'Selbst schreiben', text: '„+ Neues Plugin“ legt eine Vorlage an, „Code bearbeiten“ öffnet den eingebauten Editor. Die Anleitung steht in PLUGINS.md.', pos: 'inside' }
      ]
    },
    anim: {
      title: 'Animation', steps: [
        { target: '.an-list', title: 'Animationen', text: 'Drei Arten: Idle (Dauer-Schleife einer Figur), Geste (einmalig, z. B. Winken) und Zwischensequenz mit Hintergrund, mehreren Figuren, Kamera und Ton.', pos: 'right' },
        { target: '.an-stage', title: 'Knochen ziehen', text: 'Zieh an den runden Griffen der Knochen. An der Abspielposition entsteht automatisch ein Keyframe. Die Zwiebelhaut zeigt die Pose davor und danach.', pos: 'bottom' },
        { target: '.an-tl', title: 'Keyframes', text: 'Jede Zeile ist ein Knochen. Rauten verschieben ändert das Timing, Rechtsklick löscht. Oben im Lineal ziehst du die Abspielposition.', pos: 'top' },
        { target: '#right', title: 'Posen und Vorlagen', text: 'Fertige Bewegungen wie Laufen, Nicken, Winken oder Flügelschlag, Posen speichern und spiegeln, und Zwischensequenzen live einfügen oder als Video rendern.', pos: 'left' }
      ]
    },
    design: {
      title: 'Design', steps: [
        { target: '.d-seg', title: 'Design', text: 'Hier gestaltest du alles, was vorgefertigt ist: Sprechblasen, Buttons, Fenster, Schriften, Sounds und Mauszeiger.', pos: 'bottom' },
        { target: '.stage', title: 'Live-Vorschau', text: 'Die Vorschau benutzt Bilder aus deinem Projekt, damit du sofort siehst, wie es im Spiel wirkt.', pos: 'top' },
        { target: '#right', title: 'Vorlagen', text: 'Sechs fertige Sprechblasen zum Start. Danach lässt sich jede Farbe ändern, ein eigener PNG-Rahmen einsetzen und alles als eigene Vorlage speichern.', pos: 'left' }
      ]
    }
  };

  let cur = null; // { id, steps, i, root }

  const Tour = (window.Tour = {
    TOURS,
    register(id, def) { if (id && def && def.steps) TOURS[id] = def; },
    seen,
    get active() { return !!cur; },

    start(id, i) {
      const def = TOURS[id];
      if (!def || !VN.project) return;
      Tour.stop(true);
      cur = { id, def, i: i || 0, root: el('div', { class: 'tour' }) };
      document.body.appendChild(cur.root);
      markSeen(id);
      Tour.show();
      window.addEventListener('resize', Tour.place);
      window.addEventListener('keydown', Tour.onKey, true);
    },
    stop(silent) {
      if (!cur) return;
      cur.root.remove();
      cancelAnimationFrame(cur.raf);
      window.removeEventListener('resize', Tour.place);
      window.removeEventListener('keydown', Tour.onKey, true);
      cur = null;
      if (!silent) VN.toast('Tour beendet · über „?“ oben jederzeit wieder');
    },
    onKey(e) {
      if (!cur) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); Tour.stop(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); Tour.go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); Tour.go(-1); }
    },
    go(d) {
      if (!cur) return;
      const ni = cur.i + d;
      if (ni >= cur.def.steps.length) return Tour.stop(true), VN.toast('Tour fertig – viel Spaß!');
      cur.i = Math.max(0, ni);
      Tour.show();
    },
    show() {
      const step = cur.def.steps[cur.i];
      if (step.before) { try { step.before(); } catch (e) { console.warn(e); } }
      const n = cur.def.steps.length;
      cur.root.innerHTML = '';
      cur.hole = el('div', { class: 'tour-hole' });
      cur.tip = el('div', { class: 'tour-tip' },
        el('div', { class: 'tour-count' }, (cur.def.title || 'Tour') + ' · ' + (cur.i + 1) + ' / ' + n),
        el('div', { class: 'tour-title' }, step.title),
        el('div', { class: 'tour-text' }, step.text),
        el('div', { class: 'tour-dots' }, ...cur.def.steps.map((_, j) => el('span', { class: j === cur.i ? 'on' : '' }))),
        el('div', { class: 'tour-btns' },
          el('button', { class: 'btn ghost', onclick: () => Tour.stop() }, 'Beenden'),
          el('div', { style: { flex: '1' } }),
          cur.i > 0 ? el('button', { class: 'btn', onclick: () => Tour.go(-1) }, 'Zurück') : null,
          el('button', { class: 'btn primary', onclick: () => Tour.go(1) }, cur.i === n - 1 ? 'Fertig' : 'Weiter')));
      cur.root.append(cur.hole, cur.tip);
      cancelAnimationFrame(cur.raf);
      const loop = () => { if (!cur) return; Tour.place(); cur.raf = requestAnimationFrame(loop); };
      loop();
    },
    // Loch um das Ziel und Fenster daneben platzieren (folgt dem Ziel, falls es sich bewegt)
    place() {
      if (!cur || !cur.tip) return;
      const step = cur.def.steps[cur.i];
      const target = step.target ? document.querySelector(step.target) : null;
      const W = window.innerWidth, H = window.innerHeight;
      const tw = cur.tip.offsetWidth || 360, th = cur.tip.offsetHeight || 200;
      if (!target) {
        Object.assign(cur.hole.style, { left: W / 2 + 'px', top: H / 2 + 'px', width: '0px', height: '0px' });
        Object.assign(cur.tip.style, { left: (W - tw) / 2 + 'px', top: (H - th) / 2 + 'px' });
        cur.tip.classList.add('center');
        return;
      }
      cur.tip.classList.remove('center');
      let r = target.getBoundingClientRect();
      if (step.alt) { const a = document.querySelector(step.alt); if (a) { const r2 = a.getBoundingClientRect(); r = { left: Math.min(r.left, r2.left), top: Math.min(r.top, r2.top), right: Math.max(r.right, r2.right), bottom: Math.max(r.bottom, r2.bottom) }; r.width = r.right - r.left; r.height = r.bottom - r.top; } }
      const pad = 6;
      Object.assign(cur.hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
      const g = 14;
      let x, y;
      const pos = step.pos || 'bottom';
      if (pos === 'right') { x = r.right + g; y = r.top + 10; }
      else if (pos === 'left') { x = r.left - tw - g; y = r.top + 40; }
      else if (pos === 'top') { x = r.left + r.width / 2 - tw / 2; y = r.top - th - g; }
      else if (pos === 'inside') { x = r.left + r.width / 2 - tw / 2; y = r.top + r.height / 2 - th / 2; }
      else { x = r.left + r.width / 2 - tw / 2; y = r.bottom + g; }
      if (y + th > H - 10) y = Math.max(10, r.top - th - g);
      if (y < 10) y = 10;
      x = Math.max(10, Math.min(W - tw - 10, x));
      y = Math.max(10, Math.min(H - th - 10, y));
      Object.assign(cur.tip.style, { left: x + 'px', top: y + 'px' });
    },

    // Kurze Tour beim ersten Öffnen eines Bereichs
    maybeAuto() {
      if (!VN.project || cur || VN.ui.noAutoTour || (window.Player && Player.running)) return;
      const v = VN.ui.view;
      const id = v === 'systems' && VN.ui.sysTab === 'plugins' ? 'plugins' : ['bones', 'menu', 'transcript', 'design', 'anim'].includes(v) ? v : null;
      if (!id || seen()[id]) return;
      setTimeout(() => { if (!cur && VN.ui.view === v) Tour.start(id); }, 350);
    },

    // ?-Knopf oben
    helpMenu(btn) {
      const r = btn.getBoundingClientRect();
      const v = VN.ui.view;
      const local = v === 'systems' && VN.ui.sysTab === 'plugins' ? 'plugins' : TOURS[v] ? v : null;
      VN.menu(r.left, r.bottom + 4, [
        { head: 'Hilfe' },
        { label: 'Rundgang starten', hint: '10 Schritte', action: () => Tour.start('main') },
        local ? { label: 'Tour für diesen Bereich', hint: TOURS[local].title, action: () => Tour.start(local) } : null,
        ...Object.keys(TOURS).filter((k) => !['main', 'bones', 'menu', 'transcript', 'plugins', 'design', 'anim'].includes(k)).map((k) => ({ label: 'Tour: ' + (TOURS[k].title || k), hint: 'Plugin', action: () => Tour.start(k) })),
        'sep',
        window.Learn ? { label: 'Lernen: Themen mit Aufgaben …', hint: Object.keys(Learn.TOPICS).length + ' Themen', action: () => Learn.open() } : null,
        { label: 'Tutorial-Projekt anlegen', hint: '7 Beispiel-Szenen', action: async () => { await VN.save(); App.newProject('tutorial'); } }
      ].filter(Boolean));
    }
  });
})();
