// Engine-Updates: Hinweis unten rechts, Fenster „Nach Updates suchen“ im Datei-Menü.
// Läuft nur im Editor, nie in exportierten Spielen.
(function () {
  const el = (...a) => VN.el(...a);
  const api = () => (window.vnApi && window.vnApi.update) || null;
  const U = (window.Updates = { state: null, dismissed: null, manual: false });
  const S = () => VN.settings || {};
  const saveSettings = () => { try { localStorage.setItem('vn-settings', JSON.stringify(VN.settings)); } catch (e) { /* egal */ } };

  U.auto = () => S().autoUpdate !== false;

  // Hinweis-Karte unten rechts
  U.banner = () => {
    const st = U.state;
    document.querySelectorAll('.upd-card').forEach((x) => x.remove());
    if (!st || VN.gameMode) return;
    const show = st.status === 'available' || st.status === 'downloading' || st.status === 'ready' || (st.status === 'error' && U.manual);
    if (!show || U.dismissed === st.version + st.status) return;
    const close = () => { U.dismissed = st.version + st.status; U.banner(); };
    const zip = st.kind === 'zip';
    let body;
    if (st.status === 'available') {
      body = [
        el('div', { class: 'upd-title' }, '🎉 ' + VN.t('Version') + ' ' + st.version + ' ' + VN.t('ist da')),
        el('div', { class: 'upd-text' }, zip ? VN.t('Lade die neue Version von der Download-Seite. Am einfachsten mit dem Setup – danach kommen Updates automatisch.') : VN.t('Das Update wird im Hintergrund geladen. Du kannst dabei weiterarbeiten.')),
        el('div', { class: 'upd-btns' },
          el('button', { class: 'btn primary', onclick: () => api().download() }, zip ? VN.t('Download-Seite öffnen') : VN.t('Jetzt laden')),
          st.notes ? el('button', { class: 'btn', onclick: () => U.open() }, VN.t('Was ist neu?')) : null,
          el('button', { class: 'btn', onclick: close }, VN.t('Später')))
      ];
    } else if (st.status === 'downloading') {
      body = [
        el('div', { class: 'upd-title' }, '⬇ ' + VN.t('Update wird geladen …') + ' ' + (st.percent || 0) + ' %'),
        el('div', { class: 'upd-bar' }, el('div', { style: { width: (st.percent || 0) + '%' } })),
        el('div', { class: 'upd-text' }, VN.t('Es wird nur geladen, was sich geändert hat.'))
      ];
    } else if (st.status === 'ready') {
      body = [
        el('div', { class: 'upd-title' }, '✔ ' + VN.t('Version') + ' ' + st.version + ' ' + VN.t('ist bereit')),
        el('div', { class: 'upd-text' }, VN.t('Beim Neustart wird das Update installiert. Dein Projekt wird vorher gespeichert.')),
        el('div', { class: 'upd-btns' },
          el('button', { class: 'btn primary', onclick: () => U.restart() }, VN.t('Jetzt neu starten')),
          el('button', { class: 'btn', onclick: close }, VN.t('Beim Beenden')))
      ];
    } else {
      body = [
        el('div', { class: 'upd-title' }, '⚠ ' + VN.t('Update-Suche fehlgeschlagen')),
        el('div', { class: 'upd-text' }, VN.t('Keine Verbindung zu GitHub. Prüfe die Internetverbindung oder versuche es später noch einmal.')),
        el('div', { class: 'upd-btns' }, el('button', { class: 'btn', onclick: () => api().openPage() }, VN.t('Download-Seite öffnen')), el('button', { class: 'btn', onclick: close }, VN.t('Schließen')))
      ];
    }
    document.body.appendChild(el('div', { class: 'upd-card upd-' + st.status }, el('button', { class: 'upd-x', title: VN.t('Schließen'), onclick: close }, '×'), ...body));
  };

  U.restart = async () => {
    try { if (VN.dirty) await VN.save(); } catch (e) { /* Schließen speichert ohnehin */ }
    api().install();
  };

  // Fenster „Updates“
  U.open = async () => {
    const a = api();
    if (a && !U.state) U.state = await a.state();
    const st = U.state || { current: '?', enabled: false };
    const back = el('div', { class: 'modal-back', onclick: (ev) => { if (ev.target === back) back.remove(); } });
    const statusText = {
      idle: VN.t('Noch nicht nachgesehen.'), checking: VN.t('Suche nach Updates …'), latest: VN.t('Du hast die neueste Version.'),
      available: VN.t('Neue Version verfügbar:') + ' ' + st.version, downloading: VN.t('Wird geladen …') + ' ' + (st.percent || 0) + ' %',
      ready: VN.t('Bereit zum Installieren:') + ' ' + st.version, error: VN.t('Fehler:') + ' ' + (st.error || '')
    }[st.status] || '';
    const zip = st.kind === 'zip';
    back.appendChild(el('div', { class: 'modal upd-modal' },
      el('div', { class: 'row gap8' }, el('strong', { style: { flex: '1', fontSize: '16px' } }, VN.t('Updates')), el('button', { class: 'btn', onclick: () => back.remove() }, VN.t('Schließen'))),
      el('div', { class: 'upd-ver' }, el('span', { class: 'muted' }, VN.t('Installierte Version')), el('strong', null, st.current || '?'), el('span', { class: 'badge gray' }, zip ? VN.t('ZIP-Fassung') : VN.t('Setup-Fassung'))),
      !st.enabled
        ? el('div', { class: 'hint-box' }, VN.t('In dieser Fassung ist die Update-Suche nicht eingerichtet (Entwicklungsversion oder ohne GitHub-Adresse).'))
        : el('div', { class: 'upd-status' }, statusText),
      st.notes && (st.status === 'available' || st.status === 'ready' || st.status === 'downloading') ? el('div', { class: 'upd-notes' }, el('div', { class: 'sec-title' }, VN.t('Was ist neu')), el('pre', null, st.notes)) : null,
      el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
        st.enabled ? el('button', { class: 'btn', onclick: async () => { back.remove(); U.manual = true; U.dismissed = null; await a.check(); U.open(); } }, VN.t('Jetzt nachsehen')) : null,
        st.status === 'available' ? el('button', { class: 'btn primary', onclick: () => { a.download(); back.remove(); } }, zip ? VN.t('Download-Seite öffnen') : VN.t('Jetzt laden')) : null,
        st.status === 'ready' ? el('button', { class: 'btn primary', onclick: () => U.restart() }, VN.t('Jetzt neu starten')) : null),
      el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: U.auto(), onchange: (e) => { VN.settings.autoUpdate = e.target.checked; saveSettings(); } }), VN.t('Beim Start automatisch nach Updates suchen')),
      el('div', { class: 'muted small' }, zip
        ? VN.t('Tipp: Mit dem Setup (VN-Timeline-Engine-Setup.exe) kommen Updates automatisch und laden nur die Änderungen. Deine Projekte bleiben dabei, wo sie sind.')
        : VN.t('Updates ersetzen nur das Programm. Projekte, Einstellungen, Spielstände und Plugins bleiben erhalten.'))));
    document.body.appendChild(back);
  };

  // Start: Zustand abonnieren und (falls erlaubt) nach ein paar Sekunden nachsehen
  U.init = () => {
    const a = api();
    if (!a || VN.gameMode) return;
    a.onState((s) => { U.state = s; U.banner(); });
    setTimeout(async () => {
      if (VN.gameMode) return;
      U.state = await a.state();
      if (U.state.enabled && U.auto()) a.check();
    }, 4000);
  };
})();
