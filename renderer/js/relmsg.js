// Nachricht einer Figur (Beziehungs-Meilenstein): erst eine Meldung („Ray hat dir ein Bild geschickt“),
// dann die Nachricht als Handy, Sprechblase oder Fenster. Aussehen und Töne: Design → Spielsysteme.
// Läuft im Spiel (über Player.relMessage) und als Vorschau im Editor.
(function () {
  const { el } = VN;
  const RelMsg = (window.RelMsg = {});
  const D = (k) => (window.UiDesign ? UiDesign.resolve(k) : {});
  const tr = (id, t) => (VN.tr ? VN.tr(id, t || '') : t);
  const vol = () => Math.min(1, ((VN.settings && VN.settings.sfx != null) ? VN.settings.sfx : 90) / 100);
  RelMsg.play = (asset) => { const u = asset && VN.assetUrl(asset); if (!u) return; try { const a = new Audio(u); a.volume = vol(); a.play().catch(() => {}); } catch (e) { /* egal */ } };

  const portrait = (c, cls) => (c.portrait && VN.assetUrl(c.portrait)
    ? el('div', { class: cls, style: { backgroundImage: `url("${VN.assetUrl(c.portrait)}")`, '--rm-col': c.color || '#e86a9a' } })
    : el('div', { class: cls + ' ph', style: { '--rm-col': c.color || '#e86a9a' } }, (c.name || '?').slice(0, 1)));

  // Meldung oben (verschwindet von selbst)
  RelMsg.note = (stage, c, m, silent) => {
    const N = D('relnote');
    const box = el('div', { class: 'rm-note', 'data-notr': '' }, portrait(c, 'rm-note-por'), el('div', { class: 'rm-note-t' }, VN.Life.msNotify(c, m)), m.image ? el('span', { class: 'rm-note-ic' }, '🖼') : el('span', { class: 'rm-note-ic' }, '💬'));
    const wrap = el('div', { class: 'qn-wrap pos-' + (N.oNotePos || 'top') }, box);
    stage.appendChild(wrap);
    if (window.UiDesign) UiDesign.apply('relnote', box);
    box.classList.add('in-slide');
    if (!silent) RelMsg.play(N.sndA || m.sound || c.msgSound || D('relmsg').sndA);
    return wrap;
  };

  // Ganze Nachricht; Klick schließt. Promise endet beim Schließen.
  // Offene Nachrichten (damit „Spiel beenden“ wartende Abläufe sauber beendet)
  const open = new Set();
  RelMsg.abortAll = () => { for (const f of [...open]) f(); open.clear(); };
  RelMsg.show = (stage, c, m, opts) => new Promise((resolve0) => {
    const o = opts || {};
    let timer = 0;
    const resolve = () => { open.delete(resolve); clearTimeout(timer); resolve0(); };
    open.add(resolve);
    if (!stage || !c || !m) return resolve();
    const M = D('relmsg');
    const style = m.style || M.oMsg || 'phone';
    const noteWrap = RelMsg.note(stage, c, m);
    const finishNote = () => { const b = noteWrap.firstChild; if (b) b.classList.add('out-fade'); setTimeout(() => noteWrap.remove(), 450); };
    if (style === 'none') { timer = setTimeout(() => { finishNote(); resolve(); }, 2600); return; }
    timer = setTimeout(() => {
      if (!stage.isConnected) return resolve();
      const name = tr('name:' + c.name, c.name);
      const text = m.text ? tr(m.id + ':text', m.text) : '';
      const img = m.image && VN.assetUrl(m.image) ? el('img', { class: 'rm-img', src: VN.assetUrl(m.image), alt: '', onclick: (e) => { e.stopPropagation(); big(); } }) : null;
      const time = el('span', { class: 'rm-time' }, VN.tp('jetzt'));
      let panel;
      if (style === 'bubble') {
        panel = el('div', { class: 'rm-bubble' }, portrait(c, 'rm-big-por'), el('div', { class: 'rm-bub-box' }, el('strong', { class: 'rm-name' }, name), text ? el('div', { class: 'rm-text' }, text) : null, img));
      } else if (style === 'window') {
        panel = el('div', { class: 'rm-window' }, el('div', { class: 'rm-win-head' }, portrait(c, 'rm-small-por'), el('strong', { class: 'rm-name' }, name)), text ? el('div', { class: 'rm-text' }, text) : null, img);
      } else {
        panel = el('div', { class: 'rm-phone' },
          el('div', { class: 'rm-ph-notch' }),
          el('div', { class: 'rm-ph-head' }, portrait(c, 'rm-small-por'), el('strong', { class: 'rm-name' }, name)),
          el('div', { class: 'rm-ph-chat' }, text ? el('div', { class: 'rm-msg' }, text, time) : null, img ? el('div', { class: 'rm-msg img' }, img) : null));
        const frame = window.UiDesign ? UiDesign.image('relmsg', 'phone') : '';
        if (frame) { panel.classList.add('has-frame'); panel.style.setProperty('--rm-frame', `url("${frame}")`); }
      }
      const back = el('div', { 'data-notr': '', class: 'rm-back side-' + (M.oSide || 'right') + ' st-' + style, onclick: (e) => { e.stopPropagation(); close(); } }, panel, el('div', { class: 'rm-hint' }, VN.tp('Klicken zum Schließen')));
      stage.appendChild(back);
      if (window.UiDesign) UiDesign.apply('relmsg', panel, back);
      panel.classList.add('rm-in');
      // Hat die Meldung einen eigenen Ton, kommt der Nachrichten-Ton jetzt (sonst lief er schon mit der Meldung)
      if (D('relnote').sndA) RelMsg.play(m.sound || c.msgSound || M.sndA);
      if (m.image && D('galnew').sndA) setTimeout(() => RelMsg.play(D('galnew').sndA), 350);
      if (o.onOpen) o.onOpen();
      const big = () => {
        if (m.image && VN.Extras && VN.Extras.seenNew) VN.Extras.seenNew(m.image);
        const v = el('div', { class: 'gal-view', onclick: (e) => { e.stopPropagation(); v.remove(); } }, el('img', { src: VN.assetUrl(m.image), alt: '' }));
        stage.appendChild(v);
      };
      let closed = false;
      const close = () => {
        if (closed) return;
        if (stage.querySelector('.gal-view')) { stage.querySelector('.gal-view').remove(); return; }
        closed = true;
        panel.classList.add('rm-out');
        finishNote();
        setTimeout(() => { back.remove(); if (o.onClose) o.onClose(); resolve(); }, 300);
      };
      back._close = close;
    }, 900);
  });

  // Vorschau im Editor (eigenes kleines Spielfeld)
  RelMsg.preview = (c, m) => {
    const stage = el('div', { class: 'rm-prev-stage' });
    const back = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) back.remove(); } }, stage);
    document.body.appendChild(back);
    RelMsg.show(stage, c, m).then(() => setTimeout(() => back.remove(), 200));
  };
  // Beispiel für Design-Vorschau und „Ausprobieren“
  RelMsg.sample = () => {
    const ch = (VN.project.relations && VN.project.relations.chars[0]) || { id: 'x', name: 'Ray', color: '#e86a9a' };
    const img = VN.project.assets.find((a) => a.kind === 'image' && a.gallery) || VN.project.assets.find((a) => a.kind === 'image');
    return { c: ch, m: { id: 'sample', at: 30, text: VN.t('Hab an dich gedacht 😊 Schau mal, was ich gefunden habe!'), image: img ? img.id : null } };
  };
})();
