// Beispiel-Plugin: Schlossknacken-Minispiel
// Im Editor überall unter „+ Aktion“ → „Schlossknacken: Minispiel spielen“ auswählbar.
VNPlugin.register({
  id: 'schlossknacken',
  name: 'Schlossknacken',
  version: '1.0',
  description: 'Ein Stift dreht sich im Schloss. Klicke (oder drücke Leertaste), wenn er im goldenen Bereich ist. Das Ergebnis landet in einer Variable.',
  actions: {
    spielen: {
      label: 'Minispiel spielen',
      params: [
        { key: 'schwierigkeit', label: 'Schwierigkeit', type: 'select', options: [['leicht', 'Leicht'], ['mittel', 'Mittel'], ['schwer', 'Schwer']], default: 'mittel' },
        { key: 'stifte', label: 'Stifte', type: 'number', default: 3 },
        { key: 'ergebnis', label: 'Ergebnis in', type: 'var', default: '' },
        // Austauschbare Bilder (leer = eingebaute Grafik)
        { key: 'bildSchloss', label: 'Bild Schloss', type: 'image', default: '' },
        { key: 'bildStift', label: 'Bild Stift', type: 'image', default: '' },
        { key: 'bildMitte', label: 'Bild Mitte', type: 'image', default: '' }
      ],
      run(params, ctx) {
        return new Promise((resolve) => {
          const speed = { leicht: 120, mittel: 190, schwer: 270 }[params.schwierigkeit] || 190;
          const zoneSize = { leicht: 54, mittel: 40, schwer: 28 }[params.schwierigkeit] || 40;
          const need = Math.max(1, Number(params.stifte) || 3);
          let angle = 0, zone = 60 + Math.random() * 240, hits = 0, misses = 0, done = false, last = performance.now();
          const o = ctx.overlay({ width: '46%' });
          const el = ctx.el;
          const title = el('div', { style: { fontSize: '3.6cqh', fontWeight: '700', textAlign: 'center' } }, 'Schloss knacken');
          const info = el('div', { style: { fontSize: '2.4cqh', textAlign: 'center', opacity: '0.8', margin: '1cqh 0 2cqh' } }, '');
          const lock = el('div', { style: { position: 'relative', width: '34cqh', height: '34cqh', margin: '0 auto', borderRadius: '50%', background: '#2e2620', border: '1.2cqh solid #6b5140', boxSizing: 'border-box' } });
          const ring = el('div', { style: { position: 'absolute', inset: '1cqh', borderRadius: '50%' } });
          const pin = el('div', { style: { position: 'absolute', left: '50%', top: '50%', width: '0.9cqh', height: '13cqh', marginLeft: '-0.45cqh', background: '#e6e6ea', borderRadius: '0.5cqh', transformOrigin: '50% 0%' } });
          const hub = el('div', { style: { position: 'absolute', left: '50%', top: '50%', width: '5cqh', height: '5cqh', margin: '-2.5cqh 0 0 -2.5cqh', borderRadius: '50%', background: '#c9a24a' } });
          // Eigene Bilder aus dem Projekt verwenden, falls gewählt
          const img = (k) => (params[k] ? ctx.asset(params[k]) : '');
          if (img('bildSchloss')) Object.assign(lock.style, { background: `url("${img('bildSchloss')}") center / contain no-repeat`, border: '0' });
          if (img('bildStift')) Object.assign(pin.style, { background: `url("${img('bildStift')}") center top / 100% 100% no-repeat`, width: '3cqh', marginLeft: '-1.5cqh' });
          if (img('bildMitte')) Object.assign(hub.style, { background: `url("${img('bildMitte')}") center / contain no-repeat` });
          lock.append(ring, pin, hub);
          const hint = el('div', { style: { fontSize: '2.2cqh', textAlign: 'center', marginTop: '2cqh', opacity: '0.7' } }, 'Klick oder Leertaste, wenn der Stift im goldenen Bereich ist');
          o.el.append(title, info, lock, hint);
          const drawZone = () => {
            ring.style.background = `conic-gradient(from ${zone - zoneSize / 2}deg, rgba(232,200,106,0.85) 0deg ${zoneSize}deg, transparent ${zoneSize}deg 360deg)`;
            info.textContent = 'Stifte: ' + hits + ' / ' + need + '   ·   Fehler: ' + misses + ' / 3';
          };
          drawZone();
          const finish = (ok) => {
            done = true;
            window.removeEventListener('keydown', onKey);
            if (params.ergebnis) {
              const v = ctx.project.vars.find((x) => x.id === params.ergebnis);
              ctx.vars.set(params.ergebnis, v && v.type === 'flag' ? ok : (ok ? 1 : 0));
            }
            title.textContent = ok ? 'Geknackt!' : 'Der Dietrich ist abgerutscht …';
            title.style.color = ok ? '#e8c86a' : '#e88a8a';
            setTimeout(() => { o.close(); resolve(ok); }, 1100);
          };
          const tryPin = () => {
            if (done) return;
            const d = Math.abs(((angle - zone + 540) % 360) - 180);
            if (d <= zoneSize / 2) { hits++; zone = (zone + 90 + Math.random() * 180) % 360; ctx.sound && ctx.sound('sfx_schloss_klick', 80); }
            else { misses++; lock.animate([{ transform: 'translateX(-1cqh)' }, { transform: 'translateX(1cqh)' }, { transform: 'none' }], { duration: 180 }); }
            drawZone();
            if (hits >= need) finish(true); else if (misses >= 3) finish(false);
          };
          const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tryPin(); } };
          window.addEventListener('keydown', onKey);
          o.root.addEventListener('mousedown', tryPin);
          const tick = (now) => {
            if (done) return;
            angle = (angle + speed * (now - last) / 1000) % 360;
            last = now;
            pin.style.transform = 'rotate(' + (angle + 180) + 'deg)';
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      }
    }
  }
});
