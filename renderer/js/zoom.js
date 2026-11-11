// Mausrad-Zoom (0.9.29) für alle Vorschau-Bühnen im Editor: Szene, Hub, Animieren, Design, Hauptmenü, Figuren.
// Mausrad = zoomen zur Mausposition · mittlere Maustaste oder Leertaste + Ziehen = verschieben · Klick auf die Anzeige = 100 %.
// Über der Timeline: Strg + Mausrad zoomt die Timeline (normales Mausrad scrollt wie bisher).
(function () {
  const { el } = VN;
  const MIN = 0.5, MAX = 8;
  // Ansichtsfenster → Inhalt, der gezoomt wird
  const VIEWPORTS = [
    ['.stage-wrap', ':scope > .stage, :scope > .bone-stage'],
    ['.soft-stage', ':scope > .soft-imgwrap, :scope > .soft-test']
  ];

  const Zoom = (window.Zoom = {
    key() {
      const u = VN.ui;
      if (u.view === 'bones') return 'bones:' + (u.figSub || 'bones') + (u.figSub === 'soft' && u.softTest ? ':test' : '');
      if (u.view === 'scene' || !u.view) { const s = VN.curScene && VN.curScene(); return 'scene:' + (s ? s.type : ''); }
      return u.view;
    },
    state(k) { const all = VN.ui.vzoom || (VN.ui.vzoom = {}); return all[k || Zoom.key()] || (all[k || Zoom.key()] = { z: 1, x: 0, y: 0 }); },
    find(target) {
      for (const [vs, cs] of VIEWPORTS) {
        const vp = target && target.closest && target.closest(vs);
        if (!vp) continue;
        const c = vp.querySelector(cs);
        if (c) return { vp, c };
      }
      return null;
    },
    all() {
      const out = [], center = document.getElementById('center');
      if (!center) return out;
      for (const [vs, cs] of VIEWPORTS) for (const vp of center.querySelectorAll(vs)) { const c = vp.querySelector(cs); if (c) out.push({ vp, c }); }
      return out;
    },
    // Zoom auf Inhalt anwenden (eigene CSS-Eigenschaften translate/scale, damit vorhandene transforms bleiben)
    apply() {
      const st = Zoom.state();
      for (const { vp, c } of Zoom.all()) {
        const on = st.z !== 1 || st.x || st.y;
        c.style.scale = on ? String(st.z) : '';
        c.style.translate = on ? `${st.x}px ${st.y}px` : '';
        vp.classList.add('vz-vp');
        let b = vp.querySelector(':scope > .vz-badge');
        if (!on) { if (b) b.remove(); continue; }
        if (!b) {
          b = el('button', { class: 'vz-badge', title: VN.t('Zoom zurücksetzen (100 %)'), onclick: (e) => { e.stopPropagation(); Zoom.reset(); } });
          b.addEventListener('mousedown', (e) => e.stopPropagation());
          vp.appendChild(b);
        }
        b.textContent = Math.round(st.z * 100) + ' %  ⟲';
      }
    },
    reset() { const st = Zoom.state(); st.z = 1; st.x = 0; st.y = 0; Zoom.apply(); Zoom.changed(); },
    // Andere Teile (z. B. Rahmen um gewählte Figuren) neu zeichnen lassen
    changed() { clearTimeout(Zoom._t); Zoom._t = setTimeout(() => { if (Zoom._needRender()) VN.render(); }, 160); },
    _needRender() { return !!document.querySelector('#center .tf-box'); },
    // zur Mausposition zoomen
    zoomAt(c, mx, my, factor) {
      const st = Zoom.state();
      const nz = Math.max(MIN, Math.min(MAX, st.z * factor));
      if (nz === st.z) return;
      // Mittelpunkt ohne Verschiebung (scale wirkt um die Mitte des Inhalts)
      const r = c.getBoundingClientRect();
      const c0x = r.left + r.width / 2 - st.x, c0y = r.top + r.height / 2 - st.y;
      const qx = (mx - c0x - st.x) / st.z, qy = (my - c0y - st.y) / st.z;
      st.x = mx - c0x - nz * qx; st.y = my - c0y - nz * qy; st.z = nz;
      // ganz herausgezoomt: wieder mittig
      if (Math.abs(st.z - 1) < 0.02) { st.z = 1; st.x = 0; st.y = 0; }
      Zoom.apply(); Zoom.changed();
    }
  });

  // Mausrad: nur wenn kein anderes Element das Rad schon selbst benutzt (Graph, Storyboard, Puppen …)
  document.addEventListener('wheel', (e) => {
    if (e.defaultPrevented || !document.getElementById('app') && !document.getElementById('center')) return;
    if (!e.target.closest || !e.target.closest('#center')) return;
    // Timeline der Szene: Strg + Rad = Timeline zoomen
    const tl = e.target.closest('.timeline .tl-scroll');
    if (tl && (e.ctrlKey || e.metaKey) && VN.ui.view === 'scene') {
      e.preventDefault();
      const old = VN.ui.zoom || 80, nz = Math.max(44, Math.min(200, Math.round(old * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
      if (nz === old) return;
      const r = tl.getBoundingClientRect(), mx = e.clientX - r.left, beat = (tl.scrollLeft + mx) / old;
      VN.ui.zoom = nz; VN.render();
      const tl2 = document.querySelector('#center .timeline .tl-scroll');
      if (tl2) tl2.scrollLeft = Math.max(0, beat * nz - mx);
      return;
    }
    const f = Zoom.find(e.target);
    if (!f) return;
    // Text in Eingabefeldern / scrollbaren Listen in der Bühne nicht abfangen
    if (e.target.closest('input, textarea, select')) return;
    e.preventDefault();
    const k = Math.exp(-Math.max(-120, Math.min(120, e.deltaY * (e.deltaMode === 1 ? 33 : 1))) * 0.0018);
    Zoom.zoomAt(f.c, e.clientX, e.clientY, k);
  }, { passive: false });

  // Verschieben: mittlere Maustaste oder Leertaste + linke Maustaste
  let space = false;
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable)) return;
    if (!document.querySelector('#center .vz-vp:hover')) return;
    if (!space) { space = true; document.body.classList.add('vz-space'); }
    e.preventDefault();
  });
  document.addEventListener('keyup', (e) => { if (e.code === 'Space' && space) { space = false; document.body.classList.remove('vz-space'); } });
  window.addEventListener('blur', () => { space = false; document.body.classList.remove('vz-space'); });
  document.addEventListener('mousedown', (e) => {
    if (!(e.button === 1 || (e.button === 0 && space))) return;
    const f = Zoom.find(e.target);
    if (!f) return;
    e.preventDefault(); e.stopPropagation();
    const st = Zoom.state(), o = { x: st.x, y: st.y };
    document.body.classList.add('vz-panning');
    VN.drag(e, (dx, dy) => { st.x = o.x + dx; st.y = o.y + dy; Zoom.apply(); }, () => { document.body.classList.remove('vz-panning'); Zoom.changed(); });
  }, true);
  // Mittelklick würde sonst automatisch scrollen
  document.addEventListener('auxclick', (e) => { if (e.button === 1 && Zoom.find(e.target)) e.preventDefault(); });

  // Bühnen, die erst nach dem Aufbau entstehen (Bilder laden, Bones …), bekommen den Zoom ebenfalls
  let queued = false;
  const mo = new MutationObserver(() => {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; try { Zoom.apply(); } catch (err) { /* ignorieren */ } });
  });
  const hook = () => { const c = document.getElementById('center'); if (c) mo.observe(c, { childList: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();

  // nach jedem Neuaufbau wieder anwenden
  const baseRender = VN.render;
  VN.render = function () { const r = baseRender.apply(this, arguments); try { Zoom.apply(); } catch (err) { /* Vorschau ohne Bühne */ } return r; };
})();
