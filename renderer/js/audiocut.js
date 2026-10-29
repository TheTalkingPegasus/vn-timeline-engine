// Audio schneiden: Bereich wählen, an Pausen automatisch teilen, Teile auf Dialoge verteilen
(function () {
  const { el } = VN;
  let actx = null;
  const bufCache = {};

  const fmt = (t) => {
    const m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  };

  const AudioCut = (window.AudioCut = {
    fmt,
    async decode(assetId) {
      const url = VN.assetUrl(assetId);
      if (bufCache[url]) return bufCache[url];
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const ab = await (await fetch(url)).arrayBuffer();
      bufCache[url] = await actx.decodeAudioData(ab);
      return bufCache[url];
    },

    // Stille finden: Teile mit Ton dazwischen
    detect(buf, thresholdDb, minPause, minLen) {
      const data = buf.getChannelData(0);
      const rate = buf.sampleRate;
      const win = Math.floor(rate * 0.02);
      const thr = Math.pow(10, thresholdDb / 20);
      const loud = [];
      for (let i = 0; i < data.length; i += win) {
        let sum = 0;
        const end = Math.min(data.length, i + win);
        for (let j = i; j < end; j++) sum += data[j] * data[j];
        loud.push(Math.sqrt(sum / (end - i)) > thr);
      }
      const segs = [];
      let start = -1, quiet = 0;
      const pauseWins = Math.ceil(minPause / 0.02);
      for (let k = 0; k < loud.length; k++) {
        if (loud[k]) { if (start < 0) start = k; quiet = 0; }
        else if (start >= 0) {
          quiet++;
          if (quiet >= pauseWins) { segs.push([start, k - quiet + 1]); start = -1; quiet = 0; }
        }
      }
      if (start >= 0) segs.push([start, loud.length]);
      return segs
        .map(([a, b]) => [Math.max(0, a * 0.02 - 0.08), Math.min(buf.duration, b * 0.02 + 0.12)])
        .filter(([a, b]) => b - a >= minLen);
    },

    async open(scene, clip, track) {
      if (!clip.asset) return VN.toast('Zuerst eine Audiodatei wählen');
      const back = el('div', { class: 'modal-back' });
      const modal = el('div', { class: 'modal cut-modal' });
      back.appendChild(modal);
      document.body.appendChild(back);
      modal.appendChild(el('div', { class: 'muted' }, 'Lade Audio …'));
      let buf;
      try { buf = await AudioCut.decode(clip.asset); } catch (e) { modal.innerHTML = ''; modal.append(el('div', null, 'Die Datei konnte nicht gelesen werden.'), el('button', { class: 'btn', onclick: () => back.remove() }, 'Schließen')); return; }
      const dur = buf.duration;
      let a = clip.in || 0, b = clip.out || dur;
      let segs = [];
      let playing = null;

      const W = 1100, H = 170;
      const cv = el('canvas', { width: W, height: H, class: 'wave' });
      const peaks = (() => {
        const d = buf.getChannelData(0), step = Math.floor(d.length / W), out = [];
        for (let x = 0; x < W; x++) { let mx = 0; for (let i = x * step; i < (x + 1) * step && i < d.length; i += 8) mx = Math.max(mx, Math.abs(d[i])); out.push(mx); }
        const norm = Math.max(0.01, ...out);
        return out.map((v) => v / norm);
      })();
      const draw = (cursor) => {
        const c = cv.getContext('2d');
        c.clearRect(0, 0, W, H);
        c.fillStyle = '#121317'; c.fillRect(0, 0, W, H);
        segs.forEach(([s0, s1], i) => { c.fillStyle = i % 2 ? 'rgba(79,179,200,0.18)' : 'rgba(165,140,240,0.18)'; c.fillRect(s0 / dur * W, 0, (s1 - s0) / dur * W, H); });
        c.fillStyle = 'rgba(232,164,58,0.22)'; c.fillRect(a / dur * W, 0, (b - a) / dur * W, H);
        for (let x = 0; x < W; x++) {
          const t = x / W * dur;
          c.fillStyle = t >= a && t <= b ? '#e8a43a' : '#5d6070';
          const h = peaks[x] * (H / 2 - 6);
          c.fillRect(x, H / 2 - h, 1, h * 2 || 1);
        }
        c.fillStyle = '#fff';
        c.fillRect(a / dur * W - 1, 0, 2, H); c.fillRect(b / dur * W - 1, 0, 2, H);
        segs.forEach(([s0], i) => { c.fillStyle = '#c4b2ff'; c.font = '12px sans-serif'; c.fillText(String(i + 1), s0 / dur * W + 4, 14); });
        if (cursor != null) { c.fillStyle = '#6cc48a'; c.fillRect(cursor / dur * W, 0, 2, H); }
        info.textContent = 'Auswahl: ' + fmt(a) + ' – ' + fmt(b) + '  ·  Länge ' + (b - a).toFixed(2) + ' s  ·  Datei ' + fmt(dur);
      };
      const info = el('div', { class: 'muted' });
      // Bereich mit der Maus ziehen, Ränder einzeln verschieben
      cv.addEventListener('mousedown', (e) => {
        const r = cv.getBoundingClientRect();
        const t0 = (e.clientX - r.left) / r.width * dur;
        const near = (t) => Math.abs(t - t0) / dur * r.width < 8;
        const mode = near(a) ? 'a' : near(b) ? 'b' : 'new';
        if (mode === 'new') { a = t0; b = t0; }
        VN.drag(e, (dx, dy, ev) => {
          const t = Math.max(0, Math.min(dur, (ev.clientX - r.left) / r.width * dur));
          if (mode === 'a') a = Math.min(t, b - 0.02);
          else if (mode === 'b') b = Math.max(t, a + 0.02);
          else { a = Math.min(t0, t); b = Math.max(t0, t); }
          draw();
        }, (dx, dy, moved) => {
          if (!moved && mode === 'new') {
            const hit = segs.find(([s0, s1]) => t0 >= s0 && t0 <= s1);
            if (hit) { a = hit[0]; b = hit[1]; } else { a = 0; b = dur; }
          }
          draw();
        });
      });

      const stop = () => { if (playing) { try { playing.src.stop(); } catch (e) { /* fertig */ } cancelAnimationFrame(playing.raf); playing = null; draw(); } };
      const play = (from, to) => {
        stop();
        const src = actx.createBufferSource();
        src.buffer = buf;
        src.connect(VN.Audio ? VN.Audio.bus(actx) : actx.destination);
        const t0 = actx.currentTime;
        src.start(0, from, Math.max(0.01, to - from));
        playing = { src };
        const tick = () => { if (!playing) return; const t = from + (actx.currentTime - t0); if (t >= to) return stop(); draw(t); playing.raf = requestAnimationFrame(tick); };
        tick();
        src.onended = () => { if (playing && playing.src === src) stop(); };
      };

      const thr = el('input', { type: 'range', min: -60, max: -15, value: -38, step: 1 });
      const pause = el('input', { type: 'range', min: 0.15, max: 1.5, value: 0.4, step: 0.05 });
      const thrLab = el('span', { class: 'muted small' });
      const pauseLab = el('span', { class: 'muted small' });
      const segInfo = el('div', { class: 'muted small' });
      const updLabels = () => { thrLab.textContent = 'Stille unter ' + thr.value + ' dB'; pauseLab.textContent = 'Pause ab ' + Number(pause.value).toFixed(2) + ' s'; };
      updLabels();
      thr.oninput = updLabels; pause.oninput = updLabels;

      const isTimed = track.key !== 'music';
      const dialogs = (scene.tracks.dialog || []).filter((d) => d.start >= clip.start).sort((x, y) => x.start - y.start);

      modal.innerHTML = '';
      modal.append(
        el('div', { class: 'row gap8' }, el('strong', { style: { flex: '1', fontSize: '15px' } }, 'Audio schneiden · ' + (VN.asset(clip.asset) || {}).name), el('button', { class: 'btn', onclick: () => { stop(); back.remove(); } }, 'Schließen')),
        el('div', { class: 'muted small' }, 'Bereich mit der Maus ziehen, weiße Ränder einzeln verschieben. Klick in einen erkannten Satz wählt ihn aus.'),
        cv, info,
        el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
          el('button', { class: 'btn', onclick: () => play(a, b) }, '▶ Auswahl anhören'),
          el('button', { class: 'btn', onclick: () => play(0, dur) }, '▶ Ganze Datei'),
          el('button', { class: 'btn', onclick: stop }, '■ Stopp'),
          el('div', { style: { flex: '1' } }),
          el('button', { class: 'btn', onclick: () => VN.mutate(() => { delete clip.in; delete clip.out; }) || (stop(), back.remove()) }, 'Schnitt entfernen'),
          el('button', { class: 'btn primary', onclick: () => { VN.mutate(() => { clip.in = +a.toFixed(3); clip.out = +b.toFixed(3); }); stop(); back.remove(); VN.toast('Schnitt übernommen'); } }, 'Auswahl für diesen Clip übernehmen')),
        el('div', { class: 'opt-card' },
          el('div', { class: 'sec-title' }, 'Automatisch in Sätze teilen'),
          el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } }, thrLab, thr, pauseLab, pause,
            el('button', { class: 'btn', onclick: () => { segs = AudioCut.detect(buf, Number(thr.value), Number(pause.value), 0.25); segInfo.textContent = segs.length + ' Teile erkannt' + (isTimed ? ' · ' + dialogs.length + ' Dialoge ab Schritt ' + (clip.start + 1) : ''); draw(); } }, 'Teile erkennen')),
          segInfo,
          el('div', { class: 'row gap8', style: { flexWrap: 'wrap' } },
            el('button', {
              class: 'btn primary', onclick: () => {
                if (!segs.length) return VN.toast('Zuerst „Teile erkennen“');
                VN.mutate(() => {
                  const list = scene.tracks[track.key];
                  const idx = list.indexOf(clip);
                  if (idx >= 0) list.splice(idx, 1);
                  segs.forEach(([s0, s1], i) => {
                    const beat = isTimed && dialogs[i] ? dialogs[i].start : clip.start + i;
                    list.push(Object.assign({}, clip, { id: VN.uid('c'), start: beat, len: 1, in: +s0.toFixed(3), out: +s1.toFixed(3) }));
                    scene.beats = Math.max(scene.beats, beat + 1);
                  });
                  VN.ui.sel = null;
                });
                stop(); back.remove();
                VN.toast(segs.length + ' Teile verteilt');
              }
            }, isTimed ? 'Teile auf die Dialoge verteilen' : 'Teile nacheinander anlegen'),
            el('span', { class: 'muted small' }, isTimed ? 'Teil 1 kommt zum ersten Dialog ab diesem Clip, Teil 2 zum nächsten usw.' : ''))));
      draw();
    }
  });
})();
