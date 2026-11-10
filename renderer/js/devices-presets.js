// Design-Vorlagen (0.9.24): fertige Looks für Handy und Computer, Seiten-Vorlagen für Websites
(function () {
  const { el } = VN;
  const DV = () => VN.Devices;

  // ---------- Handy / Computer ----------
  const PHONE = [
    { id: 'aurora', name: 'Aurora', look: { screen: '#0b1020', wall: 'radial-gradient(120% 80% at 10% 0%, #5b3cc4 0%, transparent 55%), radial-gradient(100% 70% at 100% 35%, #0fb8a8 0%, transparent 50%), radial-gradient(90% 60% at 40% 100%, #e0457b 0%, transparent 55%), #0b1020', panel: '#121729', text: '#f5f6ff', panelText: '#f5f6ff', accent: '#8b7bff', bubble: '#232a44', bubbleMe: '#7c6cff', glass: true, icoStyle: 'glass', iconShape: 'round', bezel: '#1b1d27', font: 'sans', bubR: 2.2 } },
    { id: 'pastell', name: 'Pastell Pop', look: { screen: '#fdf6ff', wall: 'radial-gradient(60% 40% at 80% 15%, #fff3b0 0%, transparent 70%), linear-gradient(160deg, #ffd6e8 0%, #e3d7ff 45%, #c9f1ff 100%)', panel: '#fffafc', text: '#3a2a55', panelText: '#2d2340', accent: '#ff5fa2', bubble: '#f1e8ff', bubbleMe: '#ff5fa2', glass: false, icoStyle: 'solid', iconShape: 'circle', bezel: '#f4c6dc', font: 'trebuchet', bubR: 2.8 } },
    { id: 'neon', name: 'Neon Nacht', look: { screen: '#07060d', wall: 'repeating-linear-gradient(0deg, rgba(0,240,255,.08) 0 1px, transparent 1px 4cqh), repeating-linear-gradient(90deg, rgba(255,43,214,.08) 0 1px, transparent 1px 4cqh), radial-gradient(90% 55% at 50% 105%, #ff2bd6 0%, transparent 60%), radial-gradient(70% 40% at 50% -5%, #00f0ff55 0%, transparent 70%), #07060d', panel: '#0d0b18', text: '#e9fbff', panelText: '#e9fbff', accent: '#00f0ff', bubble: '#1a1430', bubbleMe: '#ff2bd6', glass: false, icoStyle: 'outline', iconShape: 'square', bezel: '#0a0a12', font: 'mono', bubR: 0.6 } },
    { id: 'papier', name: 'Papier & Tinte', look: { screen: '#efe4cc', wall: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,.55), transparent 60%), repeating-linear-gradient(0deg, rgba(120,90,50,.05) 0 2px, transparent 2px 6px), #efe4cc', panel: '#f7f0de', text: '#3b2f22', panelText: '#3b2f22', accent: '#a8442a', bubble: '#e8dcc0', bubbleMe: '#a8442a', glass: false, icoStyle: 'flat', iconShape: 'square', bezel: '#5a4632', font: 'serif', bubR: 1 } },
    { id: 'minimal', name: 'Klar & Minimal', look: { screen: '#f3f4f7', wall: 'linear-gradient(180deg, #f7f8fa 0%, #e6e9f0 100%)', panel: '#ffffff', text: '#111318', panelText: '#111318', accent: '#111318', bubble: '#eef0f4', bubbleMe: '#111318', glass: false, icoStyle: 'flat', iconShape: 'round', bezel: '#d9dce3', font: 'sans', bubR: 2 } },
    { id: 'sunset', name: 'Sonnenuntergang', look: { screen: '#1f1c3a', wall: 'radial-gradient(40% 25% at 50% 72%, #ffe29a 0%, transparent 70%), linear-gradient(175deg, #1f1c3a 0%, #6a2c70 38%, #f08a5d 76%, #f9d56e 100%)', panel: '#1e1830', text: '#ffffff', panelText: '#fff3ea', accent: '#ff9a62', bubble: '#2c2444', bubbleMe: '#f0705d', glass: true, icoStyle: 'glass', iconShape: 'circle', bezel: '#2a2233', font: 'sans', bubR: 2.4 } },
    { id: 'fantasy', name: 'Fantasy-Relikt', look: { screen: '#1c140b', wall: 'radial-gradient(60% 45% at 50% 40%, rgba(212,162,76,.22) 0%, transparent 70%), radial-gradient(ellipse at center, #3a2a18 0%, #1c140b 100%)', panel: '#22180d', text: '#f3e2b8', panelText: '#f3e2b8', accent: '#d4a24c', bubble: '#3a2c19', bubbleMe: '#8a5a1c', glass: false, icoStyle: 'outline', iconShape: 'circle', bezel: '#4a3418', font: 'palatino', bubR: 1.2 } },
    { id: 'wald', name: 'Waldlichtung', look: { screen: '#0f2018', wall: 'radial-gradient(80% 50% at 20% 0%, rgba(214,255,170,.35) 0%, transparent 60%), linear-gradient(170deg, #2f5d3a 0%, #13301f 55%, #0b1a12 100%)', panel: '#f2f5ec', text: '#f2fbe9', panelText: '#1f2b1c', accent: '#4caf6a', bubble: '#e3ead9', bubbleMe: '#4caf6a', glass: false, icoStyle: 'solid', iconShape: 'round', bezel: '#26372a', font: 'trebuchet', bubR: 2.2 } }
  ];
  const DESK = [
    { id: 'aurora', name: 'Aurora (Glas)', look: { screen: '#0b1020', wall: PHONE[0].look.wall, panel: '#161b30', panelText: '#eef0ff', text: '#f5f6ff', accent: '#8b7bff', bubble: '#232a44', bubbleMe: '#7c6cff', glass: true, icoStyle: 'glass', iconShape: 'round', font: 'sans', bubR: 1.6 } },
    { id: 'klar', name: 'Klar Hell', look: { screen: '#dfe6f2', wall: 'radial-gradient(70% 60% at 85% 10%, #ffffff 0%, transparent 60%), linear-gradient(160deg, #cfd9ea 0%, #eef2f8 100%)', panel: '#ffffff', panelText: '#1b2030', text: '#1b2030', accent: '#2f6bff', bubble: '#eef1f7', bubbleMe: '#2f6bff', glass: false, icoStyle: 'flat', iconShape: 'round', font: 'sans', bubR: 1.6 } },
    { id: 'neon', name: 'Neon Terminal', look: { screen: '#07060d', wall: PHONE[2].look.wall, panel: '#0d0b18', panelText: '#c9fbff', text: '#e9fbff', accent: '#00f0ff', bubble: '#1a1430', bubbleMe: '#ff2bd6', glass: false, icoStyle: 'outline', iconShape: 'square', font: 'mono', bubR: 0.4 } },
    { id: 'retro', name: 'Retro 98', look: { screen: '#008080', wall: '#008080', panel: '#c0c0c0', panelText: '#000000', text: '#ffffff', accent: '#000080', bubble: '#ffffff', bubbleMe: '#000080', glass: false, icoStyle: 'flat', iconShape: 'square', font: 'sans', bubR: 0 } },
    { id: 'sunset', name: 'Abendrot', look: { screen: '#1f1c3a', wall: PHONE[5].look.wall, panel: '#241d38', panelText: '#fff3ea', text: '#ffffff', accent: '#ff9a62', bubble: '#2c2444', bubbleMe: '#f0705d', glass: true, icoStyle: 'glass', iconShape: 'circle', font: 'sans', bubR: 1.8 } },
    { id: 'fantasy', name: 'Fantasy-Relikt', look: Object.assign({}, PHONE[6].look) }
  ];
  const mini = (L, desk) => el('div', { class: 'dv-preset-ph' + (desk ? ' desk' : ''), style: { background: L.wall || L.screen, borderColor: L.bezel || '#111', fontFamily: '' } },
    ...['#ff6b6b', '#4dabf7', '#69db7c', '#ffd43b', '#9775fa', '#f783ac'].slice(0, desk ? 5 : 6).map((c) => el('i', { style: L.icoStyle === 'outline' ? { border: '2px solid ' + L.accent } : L.icoStyle === 'glass' ? { background: 'rgba(255,255,255,.28)', border: '1px solid rgba(255,255,255,.4)' } : { background: L.icoStyle === 'flat' ? L.accent : c, borderRadius: L.iconShape === 'circle' ? '50%' : L.iconShape === 'square' ? '2px' : '30%' } })),
    el('b', { style: { background: desk ? L.panel : L.bubble } }), el('u', { style: { background: L.bubbleMe } }));
  DV().presetsUI = (d) => {
    const desk = d.kind === 'desktop', list = desk ? DESK : PHONE;
    return el('div', { class: 'opt-card' }, el('div', { class: 'sec-title' }, '✨ ' + VN.t('Design-Vorlagen')),
      el('div', { class: 'muted small' }, VN.t('Ein Klick setzt Farben, Hintergrund-Verlauf, Symbol-Stil, Schrift und Blasen – danach kannst du alles weiter anpassen.')),
      el('div', { class: 'row gap8', style: { flexWrap: 'wrap', marginTop: '6px' } }, ...list.map((pr) => el('div', { class: 'dv-preset' + (d.look && d.look.preset === pr.id ? ' on' : ''), onclick: () => VN.mutate(() => {
        const keep = { size: d.look.size, side: d.look.side, dim: d.look.dim, inset: d.look.inset };
        d.look = Object.assign({}, desk ? DV().DESK_LOOK : DV().LOOK, JSON.parse(JSON.stringify(pr.look)), keep, { preset: pr.id });
        d.wallpaper = '';
      }) }, mini(pr.look, desk), el('span', null, VN.t(pr.name))))));
  };
  DV().PRESETS = { PHONE, DESK };

  // ---------- Website-Vorlagen ----------
  const E = (o) => { const x = Object.assign({}, o); for (const k of ['text', 'place', 'fail']) if (x[k]) x[k] = VN.t(x[k]); return DV().fixEl(x); };
  const TPL = [
    { id: 'shop', name: 'Online-Shop', make: () => ({ bg: '#f6f3ee', height: 150, els: [
      E({ kind: 'box', x: 0, y: 0, w: 100, h: 12, bg: '#1d1b26' }),
      E({ kind: 'text', x: 5, y: 2.6, w: 40, h: 7, text: 'MARKT·HALLE', size: 4.2, bold: true, color: '#ffffff', ls: 4 }),
      E({ kind: 'text', x: 55, y: 3.6, w: 40, h: 5, text: 'Neu   Angebote   Konto', size: 2.6, color: '#c9c4d6', align: 'right' }),
      E({ kind: 'box', x: 0, y: 12, w: 100, h: 46, grad: 'linear-gradient(120deg, #ff7a59 0%, #ff4f8b 55%, #8b5cf6 100%)' }),
      E({ kind: 'text', x: 6, y: 20, w: 52, h: 18, text: 'Sommer-Sale\nbis zu −50 %', size: 6.4, bold: true, color: '#ffffff', shadow: 4, shadowColor: '#3a0d2e' }),
      E({ kind: 'button', x: 6, y: 42, w: 28, h: 8, text: 'Jetzt shoppen', size: 3, bg: '#ffffff', color: '#1d1b26', align: 'center', radius: 20, shadow: 6 }),
      E({ kind: 'image', x: 60, y: 15, w: 36, h: 40, radius: 8, shadow: 10 }),
      E({ kind: 'text', x: 6, y: 64, w: 60, h: 7, text: 'Beliebt diese Woche', size: 4, bold: true, color: '#1d1b26' }),
      ...[0, 1, 2].flatMap((i) => [
        E({ kind: 'box', x: 6 + i * 30, y: 74, w: 28, h: 64, bg: '#ffffff', radius: 6, shadow: 5, shadowColor: '#b8ae9c' }),
        E({ kind: 'image', x: 8 + i * 30, y: 76, w: 24, h: 30, radius: 4 }),
        E({ kind: 'text', x: 8 + i * 30, y: 108, w: 24, h: 6, text: ['Lederbeutel', 'Laterne', 'Kompass'][i], size: 3, bold: true, color: '#1d1b26' }),
        E({ kind: 'text', x: 8 + i * 30, y: 115, w: 24, h: 5, text: ['24 Gold', '18 Gold', '42 Gold'][i], size: 2.8, color: '#ff4f8b', bold: true }),
        E({ kind: 'button', x: 8 + i * 30, y: 125, w: 24, h: 8, text: 'In den Korb', size: 2.6, bg: '#1d1b26', color: '#ffffff', align: 'center', radius: 6 })
      ])
    ] }) },
    { id: 'blog', name: 'Blog / Tagebuch', make: () => ({ bg: '#fbf8f2', height: 170, els: [
      E({ kind: 'text', x: 10, y: 8, w: 80, h: 6, text: 'TAGEBUCH EINER WANDERIN', size: 2.6, color: '#b5651d', align: 'center', ls: 6, bold: true }),
      E({ kind: 'text', x: 8, y: 16, w: 84, h: 16, text: 'Die Nacht, in der der Fluss leuchtete', size: 6.6, font: 'serif', color: '#2a2420', align: 'center' }),
      E({ kind: 'text', x: 20, y: 34, w: 60, h: 5, text: '12. Herbstmond · 6 Min. Lesezeit', size: 2.6, color: '#8a7f75', align: 'center' }),
      E({ kind: 'image', x: 8, y: 42, w: 84, h: 46, radius: 3 }),
      E({ kind: 'text', x: 14, y: 94, w: 72, h: 40, text: 'Es begann mit einem Summen, kaum lauter als der Wind. Dann sah ich das Licht – erst ein Funke, dann ein ganzer Strom, der sich unter der Oberfläche bewegte …', size: 3.4, font: 'serif', color: '#3a332d' }),
      E({ kind: 'box', x: 14, y: 138, w: 72, h: 0.5, bg: '#e4d9c8' }),
      E({ kind: 'text', x: 14, y: 143, w: 40, h: 6, text: '← Älterer Eintrag', size: 2.8, color: '#b5651d' }),
      E({ kind: 'text', x: 46, y: 143, w: 40, h: 6, text: 'Neuerer Eintrag →', size: 2.8, color: '#b5651d', align: 'right' })
    ] }) },
    { id: 'profil', name: 'Fan-Seite / Profil', make: () => ({ bg: '#0f0f17', height: 150, els: [
      E({ kind: 'box', x: 0, y: 0, w: 100, h: 40, grad: 'linear-gradient(135deg, #3a1c71 0%, #d76d77 55%, #ffaf7b 100%)' }),
      E({ kind: 'image', x: 38, y: 24, w: 24, h: 24, radius: 50, shadow: 8 }),
      E({ kind: 'text', x: 10, y: 52, w: 80, h: 9, text: 'Lyra Sternenklang', size: 5.4, bold: true, color: '#ffffff', align: 'center' }),
      E({ kind: 'text', x: 10, y: 62, w: 80, h: 5, text: '@lyra · Sängerin · Tourt gerade durch den Norden', size: 2.8, color: '#a7a3c2', align: 'center' }),
      ...[0, 1, 2].map((i) => E({ kind: 'button', x: 13 + i * 26, y: 72, w: 22, h: 8, text: ['🎵 Musik', '📅 Termine', '✉ Kontakt'][i], size: 2.8, bg: i === 0 ? '#d76d77' : '#1f1d2e', color: '#ffffff', align: 'center', radius: 20 })),
      E({ kind: 'box', x: 8, y: 88, w: 84, h: 54, bg: '#1a1826', radius: 8, border: '#2c2940' }),
      E({ kind: 'text', x: 12, y: 92, w: 76, h: 6, text: 'Neuigkeiten', size: 3.4, bold: true, color: '#ffaf7b' }),
      E({ kind: 'text', x: 12, y: 100, w: 76, h: 36, text: 'Danke für das unglaubliche Konzert gestern! Ein Song fehlt noch – wer das Passwort aus dem Booklet findet, hört ihn zuerst. ✨', size: 3, color: '#e7e4f5' })
    ] }) },
    { id: 'news', name: 'Nachrichten', make: () => ({ bg: '#ffffff', height: 160, els: [
      E({ kind: 'text', x: 5, y: 4, w: 90, h: 10, text: 'Der Morgenbote', size: 7.4, font: 'serif', bold: true, color: '#111111', align: 'center' }),
      E({ kind: 'box', x: 5, y: 15, w: 90, h: 0.6, bg: '#111111' }),
      E({ kind: 'text', x: 5, y: 16.5, w: 90, h: 5, text: 'Stadt   ·   Gilden   ·   Wetter   ·   Kultur', size: 2.6, color: '#555555', align: 'center', ls: 2 }),
      E({ kind: 'box', x: 5, y: 22, w: 90, h: 0.3, bg: '#111111' }),
      E({ kind: 'image', x: 5, y: 26, w: 56, h: 40 }),
      E({ kind: 'text', x: 64, y: 26, w: 31, h: 6, text: 'EILMELDUNG', size: 2.4, bold: true, color: '#d62828', ls: 3 }),
      E({ kind: 'text', x: 64, y: 32, w: 31, h: 22, text: 'Einbruch im Schatzhaus – Wachen ratlos', size: 4.4, font: 'serif', bold: true, color: '#111111' }),
      E({ kind: 'text', x: 64, y: 55, w: 31, h: 12, text: 'Zeugen berichten von einer Gestalt mit Kapuze …', size: 2.8, color: '#444444' }),
      ...[0, 1, 2].flatMap((i) => [
        E({ kind: 'box', x: 5 + i * 31, y: 74, w: 28, h: 0.3, bg: '#dddddd' }),
        E({ kind: 'text', x: 5 + i * 31, y: 77, w: 28, h: 14, text: ['Markt: Preise für Kräuter steigen', 'Festwoche beginnt am Montag', 'Leserbrief: Mehr Laternen!'][i], size: 3.2, font: 'serif', bold: true, color: '#111111' }),
        E({ kind: 'text', x: 5 + i * 31, y: 93, w: 28, h: 30, text: 'Kurzer Anreißer für den Artikel. Ein Klick könnte auf eine Unterseite führen.', size: 2.6, color: '#555555' })
      ])
    ] }) },
    { id: 'gilde', name: 'Gilde (Fantasy)', make: () => ({ bg: '#1a120a', height: 150, els: [
      E({ kind: 'box', x: 0, y: 0, w: 100, h: 150, grad: 'radial-gradient(70% 40% at 50% 20%, rgba(212,162,76,.25) 0%, transparent 70%)' }),
      E({ kind: 'text', x: 10, y: 8, w: 80, h: 5, text: '✦ ✦ ✦', size: 3, color: '#d4a24c', align: 'center', ls: 6 }),
      E({ kind: 'text', x: 6, y: 14, w: 88, h: 12, text: 'Die Gilde der Schatten', size: 6.6, font: 'palatino', bold: true, color: '#f3e2b8', align: 'center', shadow: 6, shadowColor: '#000000' }),
      E({ kind: 'text', x: 15, y: 28, w: 70, h: 6, text: 'Seit 312 im Verborgenen', size: 3, font: 'palatino', color: '#b89660', align: 'center' }),
      E({ kind: 'box', x: 20, y: 38, w: 60, h: 0.6, grad: 'linear-gradient(90deg, transparent, #d4a24c, transparent)' }),
      E({ kind: 'image', x: 30, y: 44, w: 40, h: 40, radius: 4, shadow: 12 }),
      E({ kind: 'box', x: 12, y: 92, w: 76, h: 48, bg: '#2a1d10', alpha: 80, radius: 4, border: '#6b4a1f' }),
      E({ kind: 'text', x: 16, y: 96, w: 68, h: 6, text: 'Nur für Mitglieder', size: 3.4, font: 'palatino', bold: true, color: '#d4a24c', align: 'center' }),
      E({ kind: 'input', x: 22, y: 106, w: 56, h: 9, mode: 'password', place: 'Losungswort', answer: 'mondlicht', fail: 'Falsches Losungswort.' }),
      E({ kind: 'text', x: 16, y: 120, w: 68, h: 14, text: 'Wer das Losungswort kennt, darf eintreten.', size: 2.8, font: 'palatino', color: '#b89660', align: 'center' })
    ] }) },
    { id: 'login', name: 'Login-Portal', make: () => ({ bg: '#0e1424', height: 120, els: [
      E({ kind: 'box', x: 0, y: 0, w: 100, h: 120, grad: 'radial-gradient(60% 50% at 20% 10%, #2c4bff55 0%, transparent 70%), radial-gradient(50% 50% at 90% 90%, #00d1b255 0%, transparent 70%)' }),
      E({ kind: 'box', x: 22, y: 20, w: 56, h: 78, bg: '#ffffff', alpha: 10, radius: 10, border: '#ffffff33', shadow: 12 }),
      E({ kind: 'text', x: 26, y: 26, w: 48, h: 7, text: '🔒 Sicherer Zugang', size: 4, bold: true, color: '#ffffff', align: 'center' }),
      E({ kind: 'text', x: 26, y: 34, w: 48, h: 5, text: 'Bitte melde dich an', size: 2.6, color: '#a9b4d6', align: 'center' }),
      E({ kind: 'input', x: 28, y: 46, w: 44, h: 9, mode: 'password', place: 'Passwort', answer: '1234', fail: 'Zugang verweigert.' }),
      E({ kind: 'text', x: 26, y: 62, w: 48, h: 5, text: 'Passwort vergessen?', size: 2.4, color: '#7fa2ff', align: 'center' }),
      E({ kind: 'text', x: 26, y: 84, w: 48, h: 5, text: '© Firmen-Intranet', size: 2.2, color: '#6c789c', align: 'center' })
    ] }) }
  ];
  DV().WEB_TPL = TPL;
  // Vorschau einer Vorlage (verkleinert)
  const tplMini = (t) => {
    const g = t.make(), H0 = g.height;
    const page = el('div', { class: 'dv-web-page', style: { aspectRatio: '100 / ' + H0, backgroundColor: g.bg } });
    for (const e of g.els) {
      const st = DV().elStyle(e, H0);
      const n = el('div', { class: 'dv-web-el ' + ({ image: 'img', box: 'box', button: 'btn', input: 'input', text: 'text' }[e.kind] || 'text'), style: st }, e.kind === 'image' ? '' : e.kind === 'input' ? el('div', { class: 'dv-web-in' }, el('input', { disabled: true, placeholder: e.place })) : e.kind === 'box' ? null : e.text);
      if (e.kind === 'image') Object.assign(n.style, { background: 'repeating-linear-gradient(45deg, #9aa3b533 0 6px, #9aa3b555 6px 12px)' });
      page.appendChild(n);
    }
    return page;
  };
  // Fenster: Vorlage wählen → neue Seite (oder aktuelle ersetzen)
  DV().webTemplates = (site, page) => {
    const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) back.remove(); } });
    const card = el('div', { class: 'modal', style: { width: '760px', maxWidth: '94vw', maxHeight: '86vh', overflow: 'auto' } });
    let mode = 'new';
    const modeSel = el('select', { class: 'small-input', onchange: (e) => { mode = e.target.value; } }, el('option', { value: 'new' }, VN.t('als neue Unterseite')), page ? el('option', { value: 'replace' }, VN.t('aktuelle Seite ersetzen')) : null);
    card.append(el('div', { class: 'row gap8', style: { marginBottom: '10px' } }, el('strong', { style: { flex: '1', fontSize: '16px' } }, '✨ ' + VN.t('Seiten-Vorlagen')), modeSel, el('button', { class: 'btn', onclick: () => back.remove() }, VN.t('Schließen'))),
      el('div', { class: 'muted small', style: { marginBottom: '10px' } }, VN.t('Fertige Layouts mit Farben, Schriften und Platzhaltern für Bilder. Bilder einfach anklicken und austauschen.')),
      el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } }, ...TPL.map((t) => el('div', { class: 'web-tpl', onclick: () => {
        const g = t.make();
        VN.mutate(() => {
          if (mode === 'replace' && page) { page.bg = g.bg; page.height = g.height; page.els = g.els; VN.ui.webEl = null; }
          else { const n = DV().newPage(t.id + (site.pages.some((x) => x.path === t.id) ? '-' + site.pages.length : '')); Object.assign(n, { bg: g.bg, height: g.height, els: g.els }); site.pages.push(n); VN.ui.webPage = n.id; VN.ui.webEl = null; }
        });
        back.remove();
      } }, tplMini(t), el('span', null, VN.t(t.name))))));
    back.appendChild(card);
    document.body.appendChild(back);
  };
})();
