// Start für das Web-Export: ersetzt die Desktop-Schnittstelle durch Browser-Funktionen
(function () {
  // Gepacktes Spiel: Projekt erst nach dem Laden des Pakets bekannt, daher Präfix erst bei Bedarf
  const pre = () => 'vnsave:' + ((window.VN_GAME && window.VN_GAME.title) || 'spiel') + ':';
  const urls = {}; // gepackte Dateien → Blob-Adressen
  const saves = {
    list: async () => {
      const out = {};
      const prefix = pre();
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) { try { out[k.slice(prefix.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* defekt */ } }
      }
      return out;
    },
    write: async (slot, data) => { localStorage.setItem(pre() + slot, JSON.stringify(data)); return true; },
    remove: async (slot) => { localStorage.removeItem(pre() + slot); return true; }
  };
  window.vnApi = {
    fileUrl: (dir, rel) => urls[rel] || rel.split(/[\\/]/).map(encodeURIComponent).join('/'),
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
    },
    // Gepacktes Web-Spiel (0.9.7): Paket laden (mit Fortschritt), entschlüsseln, Dateien als Blob-Adressen bereitstellen
    async startPacked(url) {
      const msg = document.createElement('div');
      msg.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#ccc;font:16px system-ui,sans-serif;background:#000';
      msg.textContent = '…';
      document.body.appendChild(msg);
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(url + ': ' + r.status);
        const total = Number(r.headers.get('content-length')) || 0;
        let u8;
        if (r.body && total) {
          u8 = new Uint8Array(total);
          const rd = r.body.getReader();
          let got = 0;
          for (;;) {
            const { done, value } = await rd.read();
            if (done) break;
            if (got + value.length > u8.length) { const n = new Uint8Array(Math.max(u8.length * 2, got + value.length)); n.set(u8.subarray(0, got)); u8 = n; }
            u8.set(value, got); got += value.length;
            msg.textContent = Math.round(got / total * 100) + ' %';
          }
          u8 = u8.subarray(0, got);
        } else u8 = new Uint8Array(await r.arrayBuffer());
        const pak = VNPak.openInMemory(u8);
        for (const [rel, bytes] of Object.entries(pak.files)) urls[rel] = URL.createObjectURL(new Blob([bytes], { type: VNPak.mimeOf(rel) }));
        window.VN_GAME = pak.project;
        msg.remove();
        VNWeb.start();
      } catch (e) {
        msg.textContent = 'Error: ' + (e.message || e) + (location.protocol === 'file:' ? ' – index.html must run on a web server (e.g. itch.io).' : '');
        console.error(e);
      }
    }
  };
})();
