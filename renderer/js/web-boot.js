// Start für das Web-Export: ersetzt die Desktop-Schnittstelle durch Browser-Funktionen
(function () {
  const prefix = 'vnsave:' + ((window.VN_GAME && window.VN_GAME.title) || 'spiel') + ':';
  const saves = {
    list: async () => {
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) { try { out[k.slice(prefix.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* defekt */ } }
      }
      return out;
    },
    write: async (slot, data) => { localStorage.setItem(prefix + slot, JSON.stringify(data)); return true; },
    remove: async (slot) => { localStorage.removeItem(prefix + slot); return true; }
  };
  window.vnApi = {
    fileUrl: (dir, rel) => rel.split(/[\\/]/).map(encodeURIComponent).join('/'),
    saves,
    quit: async () => { if (window.Player) Player.showMainMenu(); },
    setDir: async () => true,
    saveProject: async () => true,
    fullscreen: async (on) => {
      try { if (on) await document.documentElement.requestFullscreen(); else if (document.fullscreenElement) await document.exitFullscreen(); } catch (e) { /* Browser erlaubt es nicht */ }
      return !!document.fullscreenElement;
    }
  };
  window.VNWeb = {
    start() {
      const data = window.VN_GAME;
      VN.gameMode = true;
      VN.dir = '';
      for (const s of data.scenes) VN.ensureTracks(s);
      VN.project = VN.migrate(data);
      document.title = data.title || 'Spiel';
      Player.start(null, 0, { menu: true });
    }
  };
})();
