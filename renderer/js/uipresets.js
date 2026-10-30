// Vorlagen für die Spielsystem-Designs (Design → Spielsysteme): pro System passende Looks,
// dazu Hintergrund-Muster ohne Bilddateien und Aufbau-Optionen einzelner Bildschirme.
(function () {
  // Farbe heller (+) oder dunkler (−) machen
  const shade = (hex, amt) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex || '#000000';
    const n = parseInt(m[1], 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))));
    return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((x) => x.toString(16).padStart(2, '0')).join('');
  };
  const A = (hex, a) => (VN.hexA ? VN.hexA(hex, a) : hex);

  // Hintergrund-Muster: rein aus CSS, passen sich der Flächenfarbe an
  const PATTERNS = {
    none: { label: 'Keins (einfarbig)', css: () => '' },
    soft: { label: 'Sanfter Verlauf', css: (D, a) => `linear-gradient(180deg, ${A(shade(D.bg, 0.08), a)}, ${A(shade(D.bg, -0.25), a)})` },
    classic: { label: 'Klassisches RPG-Fenster', css: (D, a) => `linear-gradient(180deg, ${A(shade(D.bg, 0.25), a)} 0%, ${A(D.bg, a)} 55%, ${A(shade(D.bg, -0.35), a)} 100%)` },
    parchment: { label: 'Pergament', css: (D, a) => `radial-gradient(ellipse at 20% 15%, rgba(255,255,255,0.28), transparent 55%), radial-gradient(ellipse at 85% 90%, rgba(110,70,20,0.28), transparent 60%), radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(90,55,15,0.35) 100%), linear-gradient(${A(D.bg, a)}, ${A(shade(D.bg, -0.1), a)})` },
    wood: { label: 'Holz', css: (D, a) => `repeating-linear-gradient(90deg, rgba(0,0,0,0.10) 0 0.25cqh, transparent 0.25cqh 5cqh), repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 0.1cqh, transparent 0.1cqh 0.9cqh), linear-gradient(180deg, ${A(shade(D.bg, 0.1), a)}, ${A(shade(D.bg, -0.2), a)})` },
    stone: { label: 'Stein', css: (D, a) => `linear-gradient(rgba(0,0,0,0.22) 0.2cqh, transparent 0.2cqh) 0 0 / 100% 6cqh, linear-gradient(90deg, rgba(0,0,0,0.18) 0.2cqh, transparent 0.2cqh) 0 0 / 12cqh 12cqh, linear-gradient(90deg, rgba(0,0,0,0.18) 0.2cqh, transparent 0.2cqh) 6cqh 6cqh / 12cqh 12cqh, linear-gradient(${A(shade(D.bg, 0.06), a)}, ${A(shade(D.bg, -0.15), a)})` },
    leather: { label: 'Leder', css: (D, a) => `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.06) 0 0.2cqh, transparent 0.3cqh) 0 0 / 1.6cqh 1.6cqh, radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.08), transparent 65%), linear-gradient(${A(D.bg, a)}, ${A(shade(D.bg, -0.3), a)})` },
    stars: { label: 'Sternenhimmel', css: (D, a) => `radial-gradient(0.3cqh 0.3cqh at 12% 22%, #fff, transparent), radial-gradient(0.25cqh 0.25cqh at 72% 14%, #fff, transparent), radial-gradient(0.2cqh 0.2cqh at 40% 68%, #dfe8ff, transparent), radial-gradient(0.3cqh 0.3cqh at 86% 58%, #fff, transparent), radial-gradient(0.2cqh 0.2cqh at 25% 86%, #fff, transparent), radial-gradient(0.25cqh 0.25cqh at 58% 38%, #cfe0ff, transparent), radial-gradient(ellipse at 70% 20%, rgba(120,140,255,0.18), transparent 60%), linear-gradient(${A(shade(D.bg, 0.05), a)}, ${A(shade(D.bg, -0.4), a)})` },
    lines: { label: 'Liniertes Papier', css: (D, a) => `repeating-linear-gradient(180deg, transparent 0 3.8cqh, ${A(shade(D.bg, -0.18), 0.6)} 3.8cqh 4cqh), linear-gradient(90deg, transparent 6cqh, rgba(220,90,90,0.35) 6cqh 6.2cqh, transparent 6.2cqh), linear-gradient(${A(D.bg, a)}, ${A(D.bg, a)})` },
    dots: { label: 'Pünktchen', css: (D, a) => `radial-gradient(circle, ${A(shade(D.bg, 0.25), 0.7)} 0.35cqh, transparent 0.4cqh) 0 0 / 3cqh 3cqh, linear-gradient(${A(D.bg, a)}, ${A(shade(D.bg, -0.08), a)})` },
    stripes: { label: 'Streifen (Geschenkpapier)', css: (D, a) => `repeating-linear-gradient(45deg, ${A(shade(D.bg, 0.12), a)} 0 2cqh, ${A(D.bg, a)} 2cqh 4cqh)` },
    grid: { label: 'Raster (Sci-Fi)', css: (D, a) => `linear-gradient(${A(D.accent, 0.12)} 0.1cqh, transparent 0.1cqh) 0 0 / 4cqh 4cqh, linear-gradient(90deg, ${A(D.accent, 0.12)} 0.1cqh, transparent 0.1cqh) 0 0 / 4cqh 4cqh, radial-gradient(ellipse at 50% 0%, ${A(D.accent, 0.18)}, transparent 70%), linear-gradient(${A(D.bg, a)}, ${A(shade(D.bg, -0.35), a)})` },
    glass: { label: 'Glas', css: (D, a) => `linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.08)), linear-gradient(${A(D.bg, a)}, ${A(D.bg, a)})` },
    sea: { label: 'Seekarte', css: (D, a) => `repeating-radial-gradient(circle at 70% 60%, transparent 0 3cqh, rgba(255,255,255,0.05) 3cqh 3.2cqh), linear-gradient(${A(shade(D.bg, 0.12), a)}, ${A(shade(D.bg, -0.25), a)})` }
  };

  // Aufbau-Optionen einzelner Bildschirme (werden als data-o-… am Fenster gesetzt und per CSS umgesetzt)
  const OPTS = {
    skills: [['oNode', 'Form der Skills', [['round', 'Rund'], ['square', 'Eckig'], ['diamond', 'Raute']]], ['oLines', 'Verbindungen', [['solid', 'Durchgezogen'], ['dashed', 'Gestrichelt'], ['glow', 'Leuchtend']]], ['oSide', 'Detail-Feld', [['right', 'Rechts'], ['left', 'Links']]]],
    combat: [['oPanel', 'Befehlsleiste', [['bottom', 'Unten'], ['top', 'Oben']]], ['oMenu', 'Befehle', [['grid', 'Zwei Spalten'], ['list', 'Liste']]], ['oBars', 'Balken', [['round', 'Abgerundet'], ['flat', 'Eckig (Retro)']]]],
    idle: [['oCards', 'Gebäude', [['grid', 'Karten'], ['list', 'Liste']]], ['oGoals', 'Ziele', [['right', 'Rechts'], ['left', 'Links'], ['hidden', 'Ausblenden']]], ['oPop', 'Effekt beim Ausbauen', [['pulse', 'Pulsieren'], ['shrink', 'Kurz kleiner'], ['bounce', 'Hüpfen'], ['glow', 'Aufleuchten'], ['none', 'Keiner']]]],
    questlog: [['oTabs', 'Reiter', [['pills', 'Als Knöpfe'], ['line', 'Unterstrichen']]]],
    relmsg: [['oMsg', 'Darstellung', [['phone', 'Handy'], ['bubble', 'Sprechblase'], ['window', 'Fenster']]], ['oSide', 'Seite', [['right', 'Rechts'], ['left', 'Links'], ['center', 'Mitte']]]],
    relnote: [['oNotePos', 'Position', [['top', 'Oben'], ['topleft', 'Oben links'], ['topright', 'Oben rechts'], ['bottom', 'Unten']]]],
    galnew: [['oNew', '„Neu“ zeigen als', [['both', 'Leuchten + Schild'], ['glow', 'Nur Leuchten'], ['badge', 'Nur Schild']]]]
  };

  // Vorlagen je System. v = Werte wie im Design-Feld (Farben, Schrift, Ecken, Muster, Leuchten, Aufbau)
  const P = (id, label, v) => ({ id, label, v });
  const PRESETS = {
    shop: [
      P('market', 'Marktstand', { bg: '#5a3a1e', alpha: 97, border: '#e2b878', text: '#fff4e2', accent: '#e8a43a', accentText: '#2a1606', titleFont: 'palatino', font: 'trebuchet', radius: 1.2, pattern: 'wood' }),
      P('noble', 'Edler Laden', { bg: '#10261d', alpha: 97, border: '#d7b25a', text: '#f3ecd6', accent: '#d7b25a', accentText: '#1a1406', titleFont: 'serif', radius: 0.6, pattern: 'soft', borderW: 0.35 }),
      P('potion', 'Hexenküche', { bg: '#241334', alpha: 96, border: '#9b6bd6', text: '#efe6ff', accent: '#7ad67a', accentText: '#0f2410', titleFont: 'palatino', radius: 2.4, pattern: 'dots', glow: true }),
      P('neon', 'Neon-Shop', { bg: '#0b0f1e', alpha: 94, border: '#29e0ff', text: '#e6faff', accent: '#ff3fa8', accentText: '#1b0010', titleFont: 'impact', radius: 1, pattern: 'grid', glow: true })
    ],
    rel: [
      P('romance', 'Romantik', { bg: '#3a1424', alpha: 95, border: '#f2a0bf', text: '#ffeef4', accent: '#ff6f9f', accentText: '#2a0010', titleFont: 'serif', radius: 3, pattern: 'soft', glow: true }),
      P('diary', 'Tagebuch', { bg: '#efe3c8', alpha: 98, border: '#8a6a3a', text: '#3a2a16', accent: '#b0523c', accentText: '#fff6e8', titleFont: 'palatino', font: 'serif', radius: 0.8, pattern: 'lines', dim: 45 }),
      P('pastel', 'Pastell', { bg: '#fbe9f1', alpha: 97, border: '#e8a7c4', text: '#4a2a3a', accent: '#c86b9a', accentText: '#ffffff', titleFont: 'trebuchet', radius: 4, pattern: 'dots', dim: 35 })
    ],
    gift: [
      P('paper', 'Geschenkpapier', { bg: '#7a1a24', alpha: 97, border: '#f3d27a', text: '#fff6ea', accent: '#2f8f4f', accentText: '#ffffff', titleFont: 'palatino', radius: 1.6, pattern: 'stripes' }),
      P('rose', 'Rosé', { bg: '#3a1a28', alpha: 95, border: '#f0b3c8', text: '#ffeef4', accent: '#f08ab0', accentText: '#2a0012', titleFont: 'serif', radius: 3, pattern: 'soft' }),
      P('ribbon', 'Schleife', { bg: '#e9f2fb', alpha: 97, border: '#6aa4d8', text: '#1c3550', accent: '#3d82c4', accentText: '#ffffff', titleFont: 'trebuchet', radius: 2.4, pattern: 'dots', dim: 35 })
    ],
    time: [
      P('sundial', 'Sonnenuhr', { bg: '#3a2c14', alpha: 92, border: '#e8c86a', text: '#fff3d2', radius: 3, font: 'palatino' }),
      P('digital', 'Digital', { bg: '#071a14', alpha: 90, border: '#3ef0a0', text: '#9dffd4', radius: 0.4, font: 'mono' }),
      P('paper', 'Papier', { bg: '#efe3c8', alpha: 96, border: '#8a6a3a', text: '#3a2a16', radius: 1, font: 'serif' })
    ],
    ach: [
      P('gold', 'Goldene Trophäe', { bg: '#2a1e08', alpha: 96, border: '#f3d27a', text: '#fff4d2', accent: '#f3d27a', accentText: '#2a1e08', titleFont: 'serif', radius: 1.6, pattern: 'soft', glow: true }),
      P('silver', 'Silber', { bg: '#1c2026', alpha: 96, border: '#c9d2dc', text: '#eef3f8', accent: '#c9d2dc', accentText: '#15181c', titleFont: 'trebuchet', radius: 1, pattern: 'glass' }),
      P('arcade', 'Spielhalle', { bg: '#120826', alpha: 95, border: '#ffe14d', text: '#ffffff', accent: '#ff4fd8', accentText: '#1a0016', titleFont: 'impact', radius: 0.4, pattern: 'grid', glow: true })
    ],
    map: [
      P('oldmap', 'Alte Karte', { bg: '#e6d3a8', alpha: 98, border: '#7a5a2a', text: '#3a2810', accent: '#a0402a', accentText: '#fff4e0', titleFont: 'palatino', radius: 0.6, pattern: 'parchment', dim: 50 }),
      P('sea', 'Seekarte', { bg: '#163a5a', alpha: 97, border: '#d8c48a', text: '#eaf4ff', accent: '#e8c86a', accentText: '#1a1406', titleFont: 'serif', radius: 1, pattern: 'sea' }),
      P('night', 'Nachtkarte', { bg: '#0e1424', alpha: 96, border: '#6c86c8', text: '#dfe8ff', accent: '#8fb5ff', accentText: '#0b1020', titleFont: 'trebuchet', radius: 1.6, pattern: 'stars' })
    ],
    questlog: [
      P('adventurer', 'Abenteurer-Buch', { bg: '#3a2414', alpha: 98, border: '#c9965a', text: '#f6e8d2', accent: '#e0a24a', accentText: '#24140a', titleFont: 'palatino', radius: 1, pattern: 'leather', borderW: 0.4 }),
      P('scroll', 'Schriftrolle', { bg: '#ecdcb6', alpha: 98, border: '#8a6a3a', text: '#3a2a16', accent: '#9a3a2a', accentText: '#fff4e2', titleFont: 'serif', radius: 0.4, pattern: 'parchment', oTabs: 'pills', dim: 50 }),
      P('holo', 'Hologramm', { bg: '#04161c', alpha: 88, border: '#38e2ff', text: '#c8f6ff', accent: '#38e2ff', accentText: '#001418', titleFont: 'trebuchet', font: 'trebuchet', radius: 0.6, pattern: 'grid', glow: true, oTabs: 'line' })
    ],
    q_all: [
      P('banner', 'Goldenes Banner', { bg: '#2a1e08', alpha: 95, border: '#f3d27a', text: '#fff4d2', accent: '#f3d27a', accentText: '#2a1e08', titleFont: 'serif', radius: 0.6, pattern: 'soft', glow: true }),
      P('scroll', 'Pergament', { bg: '#ecdcb6', alpha: 97, border: '#8a6a3a', text: '#3a2a16', accent: '#9a3a2a', accentText: '#fff4e2', titleFont: 'palatino', radius: 0.4, pattern: 'parchment' }),
      P('glass', 'Glas', { bg: '#141a24', alpha: 75, border: '#9fc6ff', text: '#ffffff', accent: '#9fc6ff', accentText: '#0a1220', titleFont: 'trebuchet', radius: 2, pattern: 'glass' })
    ],
    relmsg: [
      P('phone', 'Modernes Handy', { bg: '#14151c', alpha: 98, border: '#3a3d4a', text: '#f2f2f7', accent: '#4a8cff', accentText: '#ffffff', radius: 3, pattern: 'none', oMsg: 'phone' }),
      P('love', 'Liebesbrief', { bg: '#f6e6e6', alpha: 98, border: '#c86a7a', text: '#4a1e28', accent: '#d64a6a', accentText: '#ffffff', titleFont: 'palatino', radius: 1.2, pattern: 'parchment', oMsg: 'window' }),
      P('bubble', 'Comic-Sprechblase', { bg: '#ffffff', alpha: 100, border: '#1a1a1a', text: '#1a1a1a', accent: '#ff5f95', accentText: '#ffffff', radius: 3, pattern: 'none', borderW: 0.5, oMsg: 'bubble' }),
      P('neon', 'Neon-Chat', { bg: '#120a20', alpha: 94, border: '#ff4fd8', text: '#ffe9fb', accent: '#ff4fd8', accentText: '#1a0016', radius: 2, pattern: 'grid', glow: true, oMsg: 'phone' })
    ],
    relnote: [
      P('push', 'Push-Nachricht', { bg: '#1c1d24', alpha: 94, border: '#4a4d5a', text: '#ffffff', accent: '#4a8cff', accentText: '#ffffff', radius: 2.4, pattern: 'glass', oNotePos: 'top' }),
      P('heart', 'Herz', { bg: '#4a1428', alpha: 94, border: '#ff8fb5', text: '#ffeef4', accent: '#ff5f95', accentText: '#2a0010', radius: 4, pattern: 'soft', glow: true, oNotePos: 'top' }),
      P('scroll', 'Brief', { bg: '#ecdcb6', alpha: 97, border: '#8a6a3a', text: '#3a2a16', accent: '#9a3a2a', accentText: '#fff4e2', titleFont: 'palatino', radius: 0.6, pattern: 'parchment', oNotePos: 'topright' })
    ],
    galnew: [
      P('gold', 'Gold', { accent: '#ffd84a', accentText: '#2a1e00', oNew: 'both' }),
      P('pink', 'Pink', { accent: '#ff5f95', accentText: '#ffffff', oNew: 'both' }),
      P('blue', 'Blau', { accent: '#5fc0ff', accentText: '#001a2a', oNew: 'glow' })
    ],
    relpop: [
      P('heart', 'Herz', { bg: '#4a1428', alpha: 94, border: '#ff8fb5', text: '#ffeef4', accent: '#ff5f95', accentText: '#2a0010', radius: 4, pattern: 'soft', glow: true }),
      P('glass', 'Glas', { bg: '#1a1420', alpha: 70, border: '#f2c0d8', text: '#ffffff', accent: '#f2a0c4', accentText: '#200a14', radius: 3, pattern: 'glass' }),
      P('dark', 'Dunkel & schlicht', { bg: '#121118', alpha: 95, border: '#6a5a6a', text: '#f0ece4', accent: '#e8a43a', accentText: '#1d1404', radius: 1, pattern: 'none' })
    ],
    skills: [
      P('starry', 'Sternenhimmel', { bg: '#0f1530', alpha: 97, border: '#7f9cff', text: '#e8eeff', accent: '#7ee0ff', accentText: '#05131c', titleFont: 'serif', radius: 2, pattern: 'stars', oNode: 'round', oLines: 'glow', glow: true }),
      P('druid', 'Druiden-Baum', { bg: '#1e2a16', alpha: 97, border: '#a7c46a', text: '#eef6dc', accent: '#9fd65a', accentText: '#142008', titleFont: 'palatino', radius: 1.4, pattern: 'wood', oNode: 'round', oLines: 'solid' }),
      P('tome', 'Altes Lehrbuch', { bg: '#e8d6ae', alpha: 98, border: '#7a5a2a', text: '#3a2810', accent: '#a0402a', accentText: '#fff4e0', titleFont: 'palatino', font: 'serif', radius: 0.6, pattern: 'parchment', oNode: 'diamond', oLines: 'dashed', dim: 50 }),
      P('tech', 'Tech-Upgrade', { bg: '#071a22', alpha: 94, border: '#2ee6c8', text: '#d6fff6', accent: '#2ee6c8', accentText: '#00140f', titleFont: 'trebuchet', font: 'trebuchet', radius: 0.4, pattern: 'grid', oNode: 'square', oLines: 'glow', glow: true })
    ],
    combat: [
      P('classic', 'Klassisch blau (RPG)', { bg: '#1c2f8a', alpha: 96, border: '#f4f4ff', text: '#ffffff', accent: '#ffd84a', accentText: '#1a1a3a', titleFont: 'trebuchet', font: 'trebuchet', radius: 0.8, pattern: 'classic', borderW: 0.5, oPanel: 'bottom', oMenu: 'list', oBars: 'flat' }),
      P('dungeon', 'Dunkler Kerker', { bg: '#1a0e10', alpha: 95, border: '#a8323a', text: '#f4e2e2', accent: '#e04a4a', accentText: '#1a0004', titleFont: 'palatino', radius: 0.4, pattern: 'stone', oPanel: 'bottom', oMenu: 'grid', oBars: 'round' }),
      P('arena', 'Goldene Arena', { bg: '#2a1e0a', alpha: 95, border: '#f3d27a', text: '#fff4d8', accent: '#f3b23a', accentText: '#2a1606', titleFont: 'serif', radius: 1.6, pattern: 'soft', glow: true, oPanel: 'bottom', oMenu: 'grid', oBars: 'round' }),
      P('scifi', 'Raumschiff', { bg: '#06141c', alpha: 90, border: '#38e2ff', text: '#d8f8ff', accent: '#38e2ff', accentText: '#00141a', titleFont: 'trebuchet', font: 'trebuchet', radius: 0.3, pattern: 'grid', glow: true, oPanel: 'top', oMenu: 'list', oBars: 'flat' })
    ],
    idle: [
      P('kingdom', 'Königreich', { bg: '#2a2620', alpha: 97, border: '#d8b46a', text: '#f6eedc', accent: '#e8b84a', accentText: '#241a06', titleFont: 'palatino', radius: 1, pattern: 'stone', borderW: 0.35, oCards: 'grid', oGoals: 'right' }),
      P('farm', 'Bauernhof', { bg: '#3a2a16', alpha: 97, border: '#a7c46a', text: '#fbf1dc', accent: '#8fc45a', accentText: '#142008', titleFont: 'trebuchet', font: 'trebuchet', radius: 2, pattern: 'wood', oCards: 'grid', oGoals: 'right' }),
      P('colony', 'Weltraum-Kolonie', { bg: '#081620', alpha: 94, border: '#4fd8ff', text: '#dff8ff', accent: '#4fd8ff', accentText: '#00141a', titleFont: 'trebuchet', font: 'trebuchet', radius: 0.4, pattern: 'grid', glow: true, oCards: 'list', oGoals: 'right' }),
      P('ledger', 'Kontorbuch', { bg: '#ecdfc0', alpha: 98, border: '#7a5a2a', text: '#3a2810', accent: '#2f6f4f', accentText: '#ffffff', titleFont: 'serif', font: 'serif', radius: 0.4, pattern: 'lines', oCards: 'list', oGoals: 'left', dim: 50 })
    ],
    minigame: [
      P('arcade', 'Spielhalle', { bg: '#120826', alpha: 95, border: '#ff4fd8', text: '#ffffff', accent: '#ffe14d', accentText: '#1a1400', titleFont: 'impact', radius: 1, pattern: 'grid', glow: true }),
      P('table', 'Holztisch', { bg: '#4a2e18', alpha: 97, border: '#d8a868', text: '#fff2de', accent: '#e8a43a', accentText: '#2a1606', titleFont: 'palatino', radius: 1.2, pattern: 'wood' }),
      P('clean', 'Hell & klar', { bg: '#f4f6fa', alpha: 97, border: '#9aa6b8', text: '#1c2430', accent: '#3d82c4', accentText: '#ffffff', titleFont: 'trebuchet', font: 'trebuchet', radius: 2.4, pattern: 'none', dim: 35 })
    ]
  };
  // Für Plugin-Fenster und Systeme ohne eigene Liste
  const GENERIC = [
    P('dark', 'Dunkel', { bg: '#121118', alpha: 96, border: '#e8a43a', text: '#f0ece4', accent: '#e8a43a', accentText: '#1d1404', titleFont: 'serif', radius: 2, pattern: 'soft' }),
    P('paper', 'Papier', { bg: '#ecdcb6', alpha: 98, border: '#8a6a3a', text: '#3a2a16', accent: '#9a3a2a', accentText: '#fff4e2', titleFont: 'palatino', radius: 0.6, pattern: 'parchment' }),
    P('glass', 'Glas', { bg: '#141a24', alpha: 78, border: '#9fc6ff', text: '#ffffff', accent: '#9fc6ff', accentText: '#0a1220', titleFont: 'trebuchet', radius: 2, pattern: 'glass' })
  ];
  // Quest-Einblendungen erben von „alle“
  for (const k of ['q_new', 'q_step', 'q_done', 'q_series', 'q_fail']) PRESETS[k] = PRESETS.q_all;

  window.UiPresets = {
    shade, PATTERNS, OPTS, PRESETS, GENERIC,
    for(key) { return PRESETS[key] || GENERIC; },
    opts(key) { return OPTS[key] || []; },
    // Hintergrund für ein Fenster (oder '' = einfarbig wie bisher)
    background(D) {
      const p = PATTERNS[D.pattern];
      if (!p || D.pattern === 'none') return '';
      return p.css(D, (D.alpha != null ? D.alpha : 96) / 100);
    }
  };
})();
