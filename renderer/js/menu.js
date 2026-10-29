// Hauptmenü: Editor und Darstellung (auch im Spiel benutzt)
(function () {
  const { el } = VN;
  const ACTIONS = [['new', 'Neues Spiel'], ['continue', 'Fortsetzen (letzter Spielstand)'], ['load', 'Laden'], ['settings', 'Einstellungen'], ['gallery', 'Galerie'], ['achievements', 'Erfolge'], ['scene', 'Szene starten …'], ['quit', 'Beenden']];

  VN.defaultMenu = (title) => ({
    enabled: true, bg: null, bgLook: { vignette: 40 }, music: null, title: title || 'Mein Spiel', titleColor: '#ffffff', titleSize: 10, titleY: 24, titleFont: 'serif', logo: null, logoW: 30,
    buttons: [['Neues Spiel', 'new'], ['Fortsetzen', 'continue'], ['Laden', 'load'], ['Einstellungen', 'settings'], ['Beenden', 'quit']]
      .map(([label, action], i) => ({ id: 'mb_' + action, label, action, x: 50, y: 52 + i * 9, w: 26 })),
    btn: { bg: '#14141c', alpha: 85, color: '#ffffff', border: '#e8a43a', radius: 1.4, size: 3.4, hover: 'glow' }
  });

  const hexA = (hex, a) => {
    const h = (hex || '#000000').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  const Menu = (window.Menu = {
    ACTIONS,
    // Baut das Menü in einen Bühnen-Container (Einheiten in cqh)
    screen(host, opts = {}) {
      const m = VN.project.mainMenu;
      const root = el('div', { class: 'mm-screen' });
      if (m.bg && VN.assetUrl(m.bg)) {
        const img = el('img', { class: 'mm-bg', src: VN.assetUrl(m.bg), draggable: 'false' });
        VN.applyBgLook(img, m.bgLook);
        if (opts.live && m.bgLook && m.bgLook.kenburns) img.animate([{ transform: img.style.transform }, { transform: img.style.transform + ' scale(1.08)' }], { duration: 24000, fill: 'forwards', direction: 'alternate', iterations: Infinity });
        root.appendChild(img);
      } else root.appendChild(el('div', { class: 'mm-bg mm-ph' }, opts.editor ? 'Hintergrundbild rechts wählen' : ''));
      root.appendChild(VN.vignetteEl(m.bgLook || {}, 'vignette'));
      const title = m.logo && VN.assetUrl(m.logo)
        ? el('img', { class: 'mm-logo', src: VN.assetUrl(m.logo), draggable: 'false', style: { width: (m.logoW || 30) + '%', top: (m.titleY || 24) + '%' } })
        : el('div', { class: 'mm-title', style: { top: (m.titleY || 24) + '%', color: m.titleColor || '#fff', fontSize: (m.titleSize || 10) + 'cqh', fontFamily: Theme.fontCss(m.titleFont) || 'Georgia, serif' } }, VN.tr('menu:title', m.title || VN.project.title || ''));
      root.appendChild(title);
      const uiFont = Theme.fontCss(Theme.t().fonts.ui);
      for (const btn of m.buttons) {
        const b = Object.assign({}, m.btn || {}, btn.look || {});
        const disabled = opts.disabled && opts.disabled(btn);
        const node = el('button', {
          class: 'mm-btn hover-' + (b.hover || 'glow') + (opts.editor && VN.ui.menuSel === btn.id ? ' sel' : '') + (disabled ? ' off' : ''),
          style: {
            left: btn.x + '%', top: btn.y + '%', width: (btn.w || 26) + '%',
            background: hexA(b.bg, (b.alpha != null ? b.alpha : 85) / 100), color: b.color || '#fff', borderColor: b.border || '#e8a43a',
            borderRadius: (b.radius != null ? b.radius : 1.4) + 'cqh', fontSize: (b.size || 3.4) + 'cqh', fontFamily: uiFont || ''
          }
        }, VN.tr('menu:' + btn.id, btn.label));
        if (b.img && Theme.src(b.img)) {
          node.classList.add('img');
          node.style.setProperty('--mb-img', Theme.cssUrl(b.img));
          node.style.setProperty('--mb-img-h', Theme.cssUrl(b.imgHover || b.img));
          node.style.setProperty('--mb-img-d', Theme.cssUrl(b.imgDown || b.imgHover || b.img));
          node.style.setProperty('--mb-slice', (b.slice || 30) + '%');
          node.style.setProperty('--mb-fw', (b.frameW || 2) + 'cqh');
        }
        node.dataset.id = btn.id;
        if (!opts.editor) {
          node.addEventListener('mouseenter', () => { if (!disabled) Theme.sound('hover'); });
          node.addEventListener('click', (e) => { e.stopPropagation(); if (!disabled && opts.onAction) { Theme.sound('click'); opts.onAction(btn); } });
        } else {
          node.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            VN.ui.menuSel = btn.id;
            VN.render();
            VN.menu(e.clientX, e.clientY, [{ head: btn.label }, { label: 'Design ändern …', hint: 'Bilder je Zustand', action: () => Design.openTab() }, { label: 'Button löschen', danger: true, action: () => VN.mutate(() => { m.buttons = m.buttons.filter((x) => x !== btn); VN.ui.menuSel = null; }) }]);
          });
        }
        root.appendChild(node);
      }
      host.appendChild(root);
      return { root, title };
    },

    // ---------- Editor-Ansicht ----------
    render(center) {
      const p = VN.project;
      const m = p.mainMenu;
      if (Menu._ro) Menu._ro.disconnect();
      center.innerHTML = '';
      center.appendChild(el('div', { class: 'view-head' },
        el('strong', { style: { fontSize: '15px' } }, 'Hauptmenü'),
        el('label', { class: 'check btn' }, el('input', { type: 'checkbox', checked: m.enabled !== false, onchange: (e) => VN.mutate(() => { m.enabled = e.target.checked; }) }), 'Beim Spielstart zeigen'),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn', onclick: () => VN.mutate(() => { const id = VN.uid('mb'); m.buttons.push({ id, label: 'Neuer Button', action: 'scene', scene: p.startScene, x: 50, y: 50, w: 26 }); VN.ui.menuSel = id; }) }, '+ Button'),
        el('button', { class: 'btn primary', onclick: () => Player.start(null, 0, { menu: true }) }, '▶ Menü testen')));
      const wrap = el('div', { class: 'stage-wrap' });
      const stage = el('div', { class: 'stage' });
      wrap.appendChild(stage);
      center.appendChild(wrap);
      center.appendChild(el('div', { class: 'muted small', style: { padding: '0 14px 12px', textAlign: 'center' } }, 'Buttons und Titel mit der Maus verschieben, anklicken zum Bearbeiten. Texte erscheinen auch im Transkript.'));
      Menu._ro = Stage.fit(wrap, stage);
      const { title } = Menu.screen(stage, { editor: true });
      stage.addEventListener('mousedown', (e) => {
        const r = stage.getBoundingClientRect();
        const btn = e.target.closest('.mm-btn');
        if (btn) {
          e.preventDefault();
          const b = m.buttons.find((x) => x.id === btn.dataset.id);
          const ox = b.x, oy = b.y;
          VN.ui.menuSel = b.id;
          VN.drag(e, (dx, dy) => { b.x = Math.max(0, Math.min(100, ox + dx / r.width * 100)); b.y = Math.max(0, Math.min(100, oy + dy / r.height * 100)); btn.style.left = b.x + '%'; btn.style.top = b.y + '%'; },
            (dx, dy, moved) => { if (moved) { const nx = b.x, ny = b.y; b.x = ox; b.y = oy; VN.mutate(() => { b.x = Math.round(nx * 2) / 2; b.y = Math.round(ny * 2) / 2; }); } else VN.render(); });
          return;
        }
        if (e.target === title) {
          e.preventDefault();
          const oy = m.titleY || 24;
          VN.drag(e, (dx, dy) => { m.titleY = Math.max(0, Math.min(100, oy + dy / r.height * 100)); title.style.top = m.titleY + '%'; },
            (dx, dy, moved) => { if (moved) { const ny = m.titleY; m.titleY = oy; VN.mutate(() => { m.titleY = Math.round(ny); }); } });
          return;
        }
        if (VN.ui.menuSel) { VN.ui.menuSel = null; VN.render(); }
      });
    },

    inspector() {
      const m0 = VN.project.mainMenu;
      const b0 = m0.buttons.find((x) => x.id === VN.ui.menuSel) || null;
      return Inspector.tabbed(() => Menu.props(), () => Design.menuButtonTab(m0, b0), b0 ? 'Button' : 'Hauptmenü');
    },
    props() {
      const p = VN.project;
      const m = p.mainMenu;
      const field = (label, input) => el('div', { class: 'field' }, el('div', { class: 'lbl' }, label), input);
      const txt = (v, commit) => el('input', { type: 'text', value: v || '', onchange: (e) => VN.mutate(() => commit(e.target.value)) });
      const sel = (v, opts, commit) => { const s = el('select', { onchange: (e) => VN.mutate(() => commit(e.target.value)) }); for (const [k, l] of opts) { const o = el('option', { value: k }, l); if (k === v) o.selected = true; s.appendChild(o); } return s; };
      const rng = (label, v, min, max, step, fmt, commit) => { const lab = el('div', { class: 'lbl' }, label + ': ' + fmt(v)); return el('div', { class: 'field' }, lab, el('input', { type: 'range', min, max, step, value: v, oninput: (e) => { lab.textContent = label + ': ' + fmt(Number(e.target.value)); }, onchange: (e) => VN.mutate(() => commit(Number(e.target.value))) })); };
      const col = (v, commit) => el('input', { type: 'color', value: v || '#ffffff', onchange: (e) => VN.mutate(() => commit(e.target.value)) });
      const b = m.buttons.find((x) => x.id === VN.ui.menuSel);
      const box = el('div', { class: 'insp' });
      if (b) {
        box.append(el('div', null, el('h3', null, 'Menü-Button'), el('div', { class: 'insp-title' }, b.label)),
          field('Beschriftung', txt(b.label, (v) => { b.label = v; })),
          field('Aktion', sel(b.action, ACTIONS, (v) => { b.action = v; })),
          b.action === 'scene' ? field('Szene', VN.sceneSelect(b.scene, (v) => VN.mutate(() => { b.scene = v; }))) : null,
          rng('Breite', b.w || 26, 8, 80, 1, (v) => v + ' %', (v) => { b.w = v; }),
          el('button', { class: 'btn danger', onclick: () => VN.mutate(() => { m.buttons = m.buttons.filter((x) => x !== b); VN.ui.menuSel = null; }) }, 'Button löschen'));
        return box;
      }
      const assetField = (label, kind, v, commit) => { const s = VN.assetSelect(kind, v, (x) => VN.mutate(() => commit(x))); return field(label, s); };
      m.btn = m.btn || {};
      box.append(
        el('div', null, el('h3', null, 'Hauptmenü'), el('div', { class: 'insp-title' }, m.title || p.title)),
        assetField('Hintergrund', 'image', m.bg, (v) => { m.bg = v; }),
        m.bg ? VN.bgEditor(m.bgLook || (m.bgLook = {})) : null,
        assetField('Musik (Loop)', 'audio', m.music, (v) => { m.music = v; }),
        el('div', { class: 'sec-title' }, 'Titel'),
        field('Titeltext', txt(m.title, (v) => { m.title = v; })),
        el('div', { class: 'row gap8' }, field('Schrift', sel(m.titleFont, Theme.fontOptions(), (v) => { m.titleFont = v; })), field('Farbe', col(m.titleColor, (v) => { m.titleColor = v; }))),
        rng('Größe', m.titleSize || 10, 4, 20, 0.5, (v) => v + ' cqh', (v) => { m.titleSize = v; }),
        assetField('Logo statt Text (optional)', 'image', m.logo, (v) => { m.logo = v; }),
        m.logo ? rng('Logo-Breite', m.logoW || 30, 10, 90, 1, (v) => v + ' %', (v) => { m.logoW = v; }) : null,
        el('div', { class: 'sec-title' }, 'Buttons'),
        el('div', { class: 'row gap8' }, field('Fläche', col(m.btn.bg || '#14141c', (v) => { m.btn.bg = v; })), field('Text', col(m.btn.color || '#ffffff', (v) => { m.btn.color = v; })), field('Rand', col(m.btn.border || '#e8a43a', (v) => { m.btn.border = v; }))),
        rng('Deckkraft', m.btn.alpha != null ? m.btn.alpha : 85, 0, 100, 1, (v) => v + ' %', (v) => { m.btn.alpha = v; }),
        rng('Schriftgröße', m.btn.size || 3.4, 2, 7, 0.1, (v) => v + ' cqh', (v) => { m.btn.size = v; }),
        rng('Ecken', m.btn.radius != null ? m.btn.radius : 1.4, 0, 5, 0.1, (v) => v + ' cqh', (v) => { m.btn.radius = v; }),
        field('Hover-Effekt', sel(m.btn.hover || 'glow', [['glow', 'Glühen'], ['grow', 'Vergrößern'], ['fill', 'Füllen'], ['none', 'Keiner']], (v) => { m.btn.hover = v; })),
        el('div', { class: 'hint-box' }, '„Fortsetzen“ lädt den neuesten Spielstand und ist ausgegraut, solange es keinen gibt. „Beenden“ schließt das fertige Spiel, beim Testen geht es zurück zum Editor.'));
      return box;
    }
  });
})();
