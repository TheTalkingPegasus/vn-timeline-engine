// Erzeugt ein kleines Beispielprojekt mit eigenen Grafiken und Tönen
const fs = require('fs');
const path = require('path');

const SVG = {
  // Parallax-Ebenen (Himmel, Berge, Hügel, Vordergrund)
  par_himmel: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2d6e"/><stop offset="0.6" stop-color="#c8607a"/><stop offset="1" stop-color="#f3a35c"/></linearGradient></defs><rect width="1920" height="1080" fill="url(#g)"/><circle cx="960" cy="640" r="110" fill="#ffd27a"/><g fill="#fff" opacity="0.8"><circle cx="200" cy="120" r="3"/><circle cx="520" cy="80" r="2"/><circle cx="1400" cy="140" r="3"/><circle cx="1750" cy="60" r="2"/><circle cx="900" cy="200" r="2"/></g></svg>`,
  par_berge: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><path d="M-200 760 L120 420 L380 640 L640 360 L920 660 L1180 380 L1480 640 L1760 430 L2120 760 L2120 1080 L-200 1080 Z" fill="#5a3f78"/><path d="M640 360 L700 420 L660 430 L620 410 Z M1180 380 L1240 440 L1190 445 L1150 420 Z" fill="#e8d8f0"/></svg>`,
  par_huegel: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><path d="M-200 900 Q200 760 600 860 Q1000 960 1400 820 Q1700 740 2120 880 L2120 1080 L-200 1080 Z" fill="#2f4a3a"/><g fill="#1e2f26"><rect x="420" y="770" width="90" height="70"/><path d="M405 775 L465 720 L525 775 Z"/><rect x="1300" y="760" width="110" height="80"/><path d="M1285 765 L1355 705 L1425 765 Z"/></g><g fill="#ffd27a"><rect x="445" y="790" width="18" height="18"/><rect x="1335" y="785" width="20" height="20"/></g></svg>`,
  par_wolken: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><g fill="#ffe6ee"><g opacity="0.85" transform="translate(260 170) scale(1.1)"><ellipse cx="0" cy="0" rx="120" ry="42"/><ellipse cx="-70" cy="10" rx="80" ry="32"/><ellipse cx="80" cy="12" rx="90" ry="30"/><ellipse cx="10" cy="-30" rx="70" ry="40"/></g><g opacity="0.7" transform="translate(820 110) scale(0.8)"><ellipse cx="0" cy="0" rx="120" ry="42"/><ellipse cx="-70" cy="10" rx="80" ry="32"/><ellipse cx="80" cy="12" rx="90" ry="30"/><ellipse cx="10" cy="-30" rx="70" ry="40"/></g><g opacity="0.8" transform="translate(1250 260) scale(1.3)"><ellipse cx="0" cy="0" rx="120" ry="42"/><ellipse cx="-70" cy="10" rx="80" ry="32"/><ellipse cx="80" cy="12" rx="90" ry="30"/><ellipse cx="10" cy="-30" rx="70" ry="40"/></g><g opacity="0.75" transform="translate(1680 150) scale(0.9)"><ellipse cx="0" cy="0" rx="120" ry="42"/><ellipse cx="-70" cy="10" rx="80" ry="32"/><ellipse cx="80" cy="12" rx="90" ry="30"/><ellipse cx="10" cy="-30" rx="70" ry="40"/></g><g opacity="0.55" transform="translate(560 360) scale(0.7)"><ellipse cx="0" cy="0" rx="120" ry="42"/><ellipse cx="-70" cy="10" rx="80" ry="32"/><ellipse cx="80" cy="12" rx="90" ry="30"/><ellipse cx="10" cy="-30" rx="70" ry="40"/></g></g></svg>`,
  par_vorne: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><path d="M-200 1080 L-200 980 Q-60 900 60 960 Q160 880 280 970 Q380 920 460 1000 L520 1080 Z" fill="#0f1a14"/><path d="M1500 1080 L1560 990 Q1660 900 1760 960 Q1860 890 2000 950 L2120 1080 Z" fill="#0f1a14"/><path d="M-50 -20 Q260 60 420 40 Q520 30 600 70" stroke="#0f1a14" stroke-width="26" fill="none"/><g fill="#0f1a14"><ellipse cx="180" cy="60" rx="70" ry="28"/><ellipse cx="380" cy="40" rx="60" ry="24"/><ellipse cx="540" cy="70" rx="55" ry="22"/></g></svg>`,
  item_dietrich: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path d="M40 160 L130 70" stroke="#9aa3b5" stroke-width="16" stroke-linecap="round"/><path d="M130 70 L150 50 L165 62 L150 78" fill="none" stroke="#c8cfdc" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="40" cy="160" r="20" fill="#6b5140" stroke="#3a2a20" stroke-width="6"/></svg>`,
  item_trank: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect x="82" y="22" width="36" height="34" rx="6" fill="#8a6a3c"/><path d="M78 56 h44 v24 q42 20 42 62 q0 46 -64 46 q-64 0 -64 -46 q0 -42 42 -62 z" fill="#d65a6a" stroke="#5a1f28" stroke-width="8"/><ellipse cx="78" cy="130" rx="12" ry="20" fill="#f7a8b4" opacity="0.7"/></svg>`,
  item_ring: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="116" r="56" fill="none" stroke="#e8c86a" stroke-width="20"/><path d="M76 52 L100 22 L124 52 L100 70 Z" fill="#7fe3e8" stroke="#2a6a70" stroke-width="6"/></svg>`,
  item_brief: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect x="26" y="50" width="148" height="104" rx="8" fill="#e9e2cf" stroke="#8a7a5a" stroke-width="6"/><path d="M30 56 L100 110 L170 56" fill="none" stroke="#8a7a5a" stroke-width="6"/><circle cx="100" cy="112" r="16" fill="#b8323c"/></svg>`,
  ico_gold: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#e8c86a" stroke="#9a7a2a" stroke-width="8"/><text x="50" y="66" font-size="46" text-anchor="middle" font-family="Georgia" font-weight="bold" fill="#9a7a2a">G</text></svg>`,
  ico_gem: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M20 38 L36 16 H64 L80 38 L50 88 Z" fill="#6ad0c8" stroke="#2a6a70" stroke-width="6" stroke-linejoin="round"/><path d="M20 38 H80 M36 16 L50 38 L64 16 M50 38 L50 88" stroke="#2a6a70" stroke-width="3" fill="none"/></svg>`,
  bg_keller: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
  <defs><radialGradient id="l" cx="0.72" cy="0.38" r="0.5"><stop offset="0" stop-color="#e8a43a" stop-opacity="0.35"/><stop offset="1" stop-color="#e8a43a" stop-opacity="0"/></radialGradient></defs>
  <rect width="1920" height="1080" fill="#1b2238"/>
  <g fill="#232c47" stroke="#151b2e" stroke-width="6">
    <rect x="0" y="0" width="320" height="160"/><rect x="320" y="0" width="320" height="160"/><rect x="640" y="0" width="320" height="160"/><rect x="960" y="0" width="320" height="160"/><rect x="1280" y="0" width="320" height="160"/><rect x="1600" y="0" width="320" height="160"/>
    <rect x="-160" y="160" width="320" height="160"/><rect x="160" y="160" width="320" height="160"/><rect x="480" y="160" width="320" height="160"/><rect x="800" y="160" width="320" height="160"/><rect x="1120" y="160" width="320" height="160"/><rect x="1440" y="160" width="320" height="160"/><rect x="1760" y="160" width="320" height="160"/>
    <rect x="0" y="320" width="320" height="160"/><rect x="320" y="320" width="320" height="160"/><rect x="640" y="320" width="320" height="160"/><rect x="960" y="320" width="320" height="160"/><rect x="1280" y="320" width="320" height="160"/><rect x="1600" y="320" width="320" height="160"/>
    <rect x="-160" y="480" width="320" height="160"/><rect x="160" y="480" width="320" height="160"/><rect x="480" y="480" width="320" height="160"/><rect x="800" y="480" width="320" height="160"/><rect x="1120" y="480" width="320" height="160"/><rect x="1440" y="480" width="320" height="160"/><rect x="1760" y="480" width="320" height="160"/>
  </g>
  <rect x="0" y="760" width="1920" height="320" fill="#151a2c"/>
  <rect x="1290" y="250" width="330" height="510" rx="10" fill="#3b2f2a" stroke="#56443b" stroke-width="16"/>
  <circle cx="1350" cy="520" r="18" fill="#e8a43a"/>
  <rect x="1370" y="180" width="26" height="60" fill="#56443b"/><circle cx="1383" cy="270" r="30" fill="#ffd27a"/>
  <rect width="1920" height="1080" fill="url(#l)"/>
</svg>`,
  bg_hof: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="#101a33"/>
  <circle cx="1500" cy="200" r="90" fill="#f2ead2"/><circle cx="1535" cy="180" r="80" fill="#101a33"/>
  <g fill="#e6e9f6"><circle cx="200" cy="120" r="3"/><circle cx="420" cy="80" r="2"/><circle cx="760" cy="160" r="3"/><circle cx="980" cy="60" r="2"/><circle cx="1180" cy="140" r="2"/><circle cx="1780" cy="320" r="3"/><circle cx="620" cy="260" r="2"/></g>
  <path d="M0 520 L200 520 L200 420 L280 420 L280 520 L520 520 L520 380 L640 300 L760 380 L760 520 L1920 520 L1920 1080 L0 1080 Z" fill="#1d2744"/>
  <rect x="0" y="760" width="1920" height="320" fill="#2a3352"/>
  <g stroke="#232b47" stroke-width="5"><line x1="0" y1="840" x2="1920" y2="840"/><line x1="0" y1="940" x2="1920" y2="940"/><line x1="300" y1="760" x2="200" y2="1080"/><line x1="800" y1="760" x2="760" y2="1080"/><line x1="1300" y1="760" x2="1340" y2="1080"/></g>
  <rect x="580" y="420" width="120" height="100" fill="#ffd27a" opacity="0.8"/>
</svg>`,
  bg_gilde: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="#2a2033"/>
  <rect x="0" y="0" width="1920" height="60" fill="#1f1826"/>
  <g fill="#33283f"><rect x="120" y="60" width="40" height="700"/><rect x="900" y="60" width="40" height="700"/><rect x="1760" y="60" width="40" height="700"/></g>
  <rect x="0" y="760" width="1920" height="320" fill="#1f1826"/>
  <g stroke="#2a2033" stroke-width="5"><line x1="0" y1="860" x2="1920" y2="860"/><line x1="0" y1="970" x2="1920" y2="970"/></g>
  <rect x="300" y="160" width="300" height="220" fill="#3a2e44" stroke="#8a6a3c" stroke-width="18"/>
  <path d="M340 340 L420 250 L480 310 L520 270 L560 340 Z" fill="#5a4a6a"/>
  <rect x="1050" y="600" width="360" height="40" rx="8" fill="#6b4a2c"/><rect x="1080" y="640" width="30" height="120" fill="#4a3220"/><rect x="1350" y="640" width="30" height="120" fill="#4a3220"/>
  <circle cx="1230" cy="590" r="22" fill="#e8a43a"/>
</svg>`,
  char_ray: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 1000">
  <path d="M180 1000 L200 640 L400 640 L420 1000 Z" fill="#3a3550"/>
  <path d="M150 420 Q300 360 450 420 L430 700 Q300 730 170 700 Z" fill="#5a4f8a" stroke="#2a2440" stroke-width="10"/>
  <path d="M160 440 L110 640 L130 700" fill="none" stroke="#2a2440" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M160 440 L110 640 L130 700" fill="none" stroke="#5a4f8a" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M440 440 L490 640 L470 700" fill="none" stroke="#2a2440" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M440 440 L490 640 L470 700" fill="none" stroke="#5a4f8a" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M170 300 Q170 120 300 110 Q430 120 430 300 L450 430 Q300 470 150 430 Z" fill="#433a68" stroke="#2a2440" stroke-width="10"/>
  <ellipse cx="300" cy="300" rx="100" ry="112" fill="#e9d6c4" stroke="#2a2440" stroke-width="8"/>
  <path d="M200 250 Q240 170 300 175 Q370 170 400 250 Q350 215 300 220 Q245 215 200 250 Z" fill="#7a3b5c"/>
  <ellipse cx="262" cy="300" rx="12" ry="16" fill="#2a2440"/><ellipse cx="338" cy="300" rx="12" ry="16" fill="#2a2440"/>
  <path d="M270 355 Q300 375 334 352" fill="none" stroke="#2a2440" stroke-width="8" stroke-linecap="round"/>
</svg>`,
  char_wache: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 1000">
  <path d="M190 1000 L205 660 L395 660 L410 1000 Z" fill="#3c3f48"/>
  <path d="M130 430 Q300 380 470 430 L450 720 Q300 750 150 720 Z" fill="#7a2e33" stroke="#2a1416" stroke-width="10"/>
  <rect x="150" y="560" width="300" height="34" fill="#c9a24a"/>
  <path d="M140 450 L90 650 L110 720" fill="none" stroke="#2a1416" stroke-width="70" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M140 450 L90 650 L110 720" fill="none" stroke="#7a2e33" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M460 450 L510 650 L490 720" fill="none" stroke="#2a1416" stroke-width="70" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M460 450 L510 650 L490 720" fill="none" stroke="#7a2e33" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="520" y="200" width="16" height="560" fill="#6b5140"/><path d="M528 120 L560 210 L496 210 Z" fill="#b8bcc8"/>
  <ellipse cx="300" cy="320" rx="105" ry="118" fill="#d9b89a" stroke="#2a1416" stroke-width="8"/>
  <path d="M185 300 Q190 160 300 155 Q410 160 415 300 L380 290 Q300 250 220 290 Z" fill="#9aa0ad" stroke="#2a1416" stroke-width="8"/>
  <rect x="290" y="150" width="20" height="40" fill="#7a2e33"/>
  <path d="M245 318 L280 322 M320 322 L355 318" stroke="#2a1416" stroke-width="10" stroke-linecap="round"/>
  <path d="M262 385 L338 385" stroke="#2a1416" stroke-width="8" stroke-linecap="round"/>
</svg>`,
  obj_truhe: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260">
  <path d="M20 90 Q200 -10 380 90 L380 250 L20 250 Z" fill="#7a5530" stroke="#3c2814" stroke-width="10"/>
  <rect x="20" y="112" width="360" height="22" fill="#c9a24a"/>
  <rect x="176" y="118" width="48" height="56" rx="8" fill="#e8c86a" stroke="#3c2814" stroke-width="6"/>
</svg>`,
  obj_tuer: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 560">
  <rect x="10" y="10" width="280" height="540" rx="12" fill="#4a382c" stroke="#6b5140" stroke-width="16"/>
  <g stroke="#3a2a20" stroke-width="8"><line x1="100" y1="20" x2="100" y2="545"/><line x1="200" y1="20" x2="200" y2="545"/></g>
  <circle cx="240" cy="300" r="16" fill="#e8c86a"/>
</svg>`,
  obj_buch: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
  <rect x="120" y="140" width="60" height="150" fill="#5a4232"/>
  <path d="M30 150 L150 120 L270 150 L270 40 L150 10 L30 40 Z" fill="#7a3b3b" stroke="#3a1b1b" stroke-width="8" stroke-linejoin="round"/>
  <line x1="150" y1="10" x2="150" y2="120" stroke="#3a1b1b" stroke-width="8"/>
  <circle cx="90" cy="80" r="14" fill="#e8c86a"/>
</svg>`
};

// Schreibt eine kleine WAV-Datei (16 Bit, Mono)
function writeWav(file, seconds, sampleFn, rate = 22050) {
  const n = Math.floor(seconds * rate);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, sampleFn(i / rate, seconds)));
    buf.writeInt16LE(Math.round(v * 32000), 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
}

function createDemoProject(dir) {
  const a = path.join(dir, 'assets');
  fs.mkdirSync(a, { recursive: true });
  for (const [name, svg] of Object.entries(SVG)) fs.writeFileSync(path.join(a, name + '.svg'), svg, 'utf8');

  // Ruhiger Akkord-Teppich als Musik-Loop
  const chords = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 329.6]];
  writeWav(path.join(a, 'musik_schleichen.wav'), 8, (t) => {
    const c = chords[Math.floor(t / 2) % 4];
    const local = t % 2;
    const env = Math.min(1, local * 3) * Math.min(1, (2 - local) * 3);
    let s = 0;
    for (const f of c) s += Math.sin(2 * Math.PI * f * t) * 0.5 + Math.sin(2 * Math.PI * f * 2 * t) * 0.08;
    return s * 0.12 * env;
  });
  // Klick eines Schlosses
  writeWav(path.join(a, 'sfx_schloss_klick.wav'), 0.35, (t) => {
    const hit = (t0) => (t > t0 ? Math.exp(-(t - t0) * 60) * Math.sin(2 * Math.PI * 1800 * (t - t0)) : 0);
    return (hit(0) + hit(0.12) * 0.8) * 0.8;
  });
  // Beispiel-Sprachaufnahme: drei „Sätze“ mit Pausen (zum Ausprobieren des Audio-Schnitts)
  const sentences = [[0.1, 0.9, 190], [1.5, 2.4, 210], [3.0, 3.7, 175]];
  writeWav(path.join(a, 'voice_ray_demo.wav'), 4.1, (t) => {
    for (const [s0, s1, f] of sentences) {
      if (t >= s0 && t <= s1) {
        const local = (t - s0) / (s1 - s0);
        const env = Math.sin(Math.PI * local) * (0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 5));
        const f0 = f * (1 + 0.08 * Math.sin(t * 7));
        let v = 0;
        for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * f0 * h * t) / h * (h === 3 || h === 4 ? 1.6 : 1);
        return v * 0.18 * env;
      }
    }
    return 0;
  });
  // Plugins und Anleitung ins Projekt legen
  const pdir = path.join(dir, 'plugins');
  fs.mkdirSync(pdir, { recursive: true });
  for (const f of ['schlossknacken.js', 'PLUGINS.md']) fs.copyFileSync(path.join(__dirname, 'templates', f), path.join(pdir, f));
  // Freie Schrift (SIL Open Font License) als Beispiel für eigene Schriften
  fs.copyFileSync(path.join(__dirname, 'templates', 'fonts', 'Cinzel.woff2'), path.join(a, 'Cinzel.woff2'));
  fs.copyFileSync(path.join(__dirname, 'templates', 'fonts', 'Cinzel-OFL.txt'), path.join(a, 'Cinzel-Lizenz-OFL.txt'));
  // Glöckchen beim Öffnen
  writeWav(path.join(a, 'sfx_glocke.wav'), 1.2, (t) => Math.exp(-t * 4) * (Math.sin(2 * Math.PI * 880 * t) * 0.5 + Math.sin(2 * Math.PI * 1320 * t) * 0.25));

  const asset = (id, name, kind, file) => ({ id, name, kind, file: 'assets/' + file });
  const assets = [
    asset('a_bg_keller', 'Keller', 'image', 'bg_keller.svg'),
    asset('a_bg_hof', 'Schlosshof', 'image', 'bg_hof.svg'),
    asset('a_bg_gilde', 'Gildenquartier', 'image', 'bg_gilde.svg'),
    asset('a_ray', 'Ray', 'image', 'char_ray.svg'),
    asset('a_wache', 'Wache', 'image', 'char_wache.svg'),
    asset('a_truhe', 'Truhe', 'image', 'obj_truhe.svg'),
    asset('a_tuer', 'Tür', 'image', 'obj_tuer.svg'),
    asset('a_buch', 'Buch', 'image', 'obj_buch.svg'),
    asset('a_musik', 'musik_schleichen', 'audio', 'musik_schleichen.wav'),
    asset('a_klick', 'sfx_schloss_klick', 'audio', 'sfx_schloss_klick.wav'),
    asset('a_glocke', 'sfx_glocke', 'audio', 'sfx_glocke.wav'),
    asset('a_voice_ray', 'voice_ray_demo', 'audio', 'voice_ray_demo.wav'),
    asset('a_i_dietrich', 'Item Dietrich', 'image', 'item_dietrich.svg'),
    asset('a_i_trank', 'Item Heiltrank', 'image', 'item_trank.svg'),
    asset('a_i_ring', 'Item Ring', 'image', 'item_ring.svg'),
    asset('a_i_brief', 'Item Brief', 'image', 'item_brief.svg'),
    asset('a_c_gold', 'Symbol Gold', 'image', 'ico_gold.svg'),
    asset('a_c_gem', 'Symbol Edelstein', 'image', 'ico_gem.svg'),
    asset('a_font_cinzel', 'Cinzel', 'font', 'Cinzel.woff2'),
    asset('a_par_himmel', 'Parallax Himmel', 'image', 'par_himmel.svg'),
    asset('a_par_berge', 'Parallax Berge', 'image', 'par_berge.svg'),
    asset('a_par_huegel', 'Parallax Hügel', 'image', 'par_huegel.svg'),
    asset('a_par_vorne', 'Parallax Vordergrund', 'image', 'par_vorne.svg'),
    asset('a_par_wolken', 'Wolken (endlos)', 'image', 'par_wolken.svg')
  ];

  let n = 0;
  const id = (p) => p + '_' + (++n);
  const empty = () => ({ bg: [], char1: [], char2: [], fx: [], cam: [], video: [], dialog: [], choice: [], music: [], voice: [], sfx: [] });
  const dlg = (start, speaker, color, text) => ({ id: id('c'), start, len: 1, speaker, color, text, speed: 40 });

  const s1 = {
    id: 's1', type: 'story', name: 'Szene 1 · Der Keller', x: 80, y: 260, beats: 5, next: null, tracks: empty()
  };
  s1.tracks.bg.push({ id: id('c'), start: 0, len: 5, asset: 'a_bg_keller', trans: 'fade', dur: 1 });
  // Ray weicht zurück, als die Wache auftaucht (Keyframe bei Schritt 4)
  s1.tracks.char1.push({ id: id('c'), start: 0, len: 5, asset: 'a_ray', x: 30, scale: 100, trans: 'fade', dur: 0.6, idle: 'none', name: 'Ray', keys: [{ beat: 3, x: 22, scale: 97, dur: 0.6, ease: 'back' }] });
  s1.tracks.char2.push({ id: id('c'), start: 3, len: 2, asset: 'a_wache', x: 72, scale: 100, trans: 'slide', dur: 0.6, idle: 'none', name: 'Wache' });
  // Kamera: schneller Zoom mit Wackeln, als die Wache ruft
  s1.tracks.cam.push({ id: id('c'), start: 3, len: 2, zoom: 128, panX: 8, panY: -6, rot: 0, shake: 60, shakeDur: 0.5, dur: 0.5, ease: 'ease-out', keys: [] });
  s1.tracks.dialog.push(
    Object.assign(dlg(0, 'Ray', '#c4b2ff', 'Psst … hier unten schläft nie jemand richtig.'), { syncVoice: true }),
    dlg(1, 'Ray', '#c4b2ff', 'Die Tür da vorne hat nur ein altes Schloss.'),
    Object.assign(dlg(2, 'Ray', '#c4b2ff', 'Das krieg ich in zehn Sekunden auf. Hier, nimm den Ersatz-Dietrich.'), { actions: [{ type: 'giveItem', item: 'it_dietrich', count: 1 }] }),
    dlg(3, 'Wache', '#ff9a8a', 'Wer ist da? {shake}Zeig dich!{/shake}'),
    dlg(4, 'Ray', '#c4b2ff', 'Mist. Was jetzt?')
  );
  s1.tracks.choice.push({ id: id('c'), start: 4, len: 1, options: [
    { id: 'opt_knacken', text: 'Schloss knacken', target: 's2', conds: [], actions: [{ type: 'plugin', ref: 'schlossknacken.spielen', params: { schwierigkeit: 'leicht', stifte: 2, ergebnis: 'v_tuer' } }] },
    { id: 'opt_ablenken', text: 'Wache ablenken', target: 's3', conds: [], actions: [{ type: 'addVar', var: 'v_vertrauen', value: 1 }] },
    { id: 'opt_bestechen', text: 'Wache bestechen (20 Gold)', target: 's3', conds: [{ type: 'money', currency: 'cur_gold', op: '>=', amount: 20 }], actions: [{ type: 'money', currency: 'cur_gold', amount: -20 }] }
  ] });
  s1.tracks.music.push({ id: id('c'), start: 0, len: 5, asset: 'a_musik', vol: 60, loop: true, carry: true, fade: 1 });
  s1.tracks.sfx.push({ id: id('c'), start: 3, len: 1, asset: 'a_klick', vol: 90 });
  // Eine Aufnahme, in drei Teile geschnitten und auf die ersten Dialoge verteilt
  [[0, 0.02, 1.0], [1, 1.42, 2.52], [2, 2.92, 3.82]].forEach(([b, i0, o0]) => s1.tracks.voice.push({ id: id('c'), start: b, len: 1, asset: 'a_voice_ray', vol: 80, in: i0, out: o0 }));

  const s2 = { id: 's2', type: 'story', name: 'Szene 2 · Hinter der Tür', x: 360, y: 120, beats: 3, next: 'hub', tracks: empty() };
  // Nacht-Filter, Figur im Mondlicht, Glühwürmchen
  s2.tracks.bg.push({ id: id('c'), start: 0, len: 3, asset: 'a_bg_hof', trans: 'mask', mask: 'circle', maskSoft: 14, dur: 1.4, kenburns: true, vignette: 30, daytime: 'night', charLight: 55 });
  s2.tracks.char1.push({ id: id('c'), start: 0, len: 3, asset: 'a_ray', x: 50, scale: 100, trans: 'fade', dur: 0.6, idle: 'none', name: 'Ray' });
  s2.tracks.fx.push({ id: id('c'), start: 0, len: 3, particles: 'fireflies', color: '#d8ff7a', density: 40, speed: 15, size: 45, wind: 0, opacity: 100, styles: {} });
  s2.tracks.dialog.push(
    dlg(0, 'Ray', '#c4b2ff', 'Klick. Hab ich doch gesagt.'),
    dlg(1, 'Ray', '#c4b2ff', 'Frische Luft … und keine Wache weit und breit. Zurück zur {glow}Gilde{/glow}?'),
    dlg(2, 'Ray', '#c4b2ff', 'Zurück ins Quartier, bevor jemand was merkt.')
  );
  s2.tracks.sfx.push({ id: id('c'), start: 0, len: 1, asset: 'a_klick', vol: 90 });

  const s3 = { id: 's3', type: 'story', name: 'Szene 2b · Die Ablenkung', x: 360, y: 400, beats: 3, next: 'hub', tracks: empty() };
  s3.tracks.bg.push({ id: id('c'), start: 0, len: 3, asset: 'a_bg_keller', trans: 'cut', dur: 0 });
  s3.tracks.char1.push({ id: id('c'), start: 0, len: 3, asset: 'a_ray', x: 25, scale: 100, trans: 'cut', dur: 0, idle: 'breathe' });
  s3.tracks.char2.push({ id: id('c'), start: 0, len: 2, asset: 'a_wache', x: 72, scale: 100, trans: 'cut', dur: 0.6, idle: 'none' });
  s3.tracks.dialog.push(
    dlg(0, 'Ray', '#c4b2ff', 'Da hinten! Ist das nicht Rauch?'),
    dlg(1, 'Wache', '#ff9a8a', 'Was? Wo? … Bleib ja hier!'),
    dlg(2, 'Ray', '#c4b2ff', 'Klappt jedes Mal. Und weg.')
  );
  s3.tracks.music.push({ id: id('c'), start: 0, len: 3, asset: 'a_musik', vol: 60, loop: true, carry: true, fade: 1 });

  const hub = {
    id: 'hub', type: 'hub', name: 'Hub · Gildenquartier', x: 660, y: 260, bg: 'a_bg_gilde', music: null, bgLook: { vignette: 35 },
    objects: [
      { id: 'o_truhe', name: 'Truhe', asset: 'a_truhe', x: 12, y: 66, w: 18, h: 20, rot: 0, shape: 'rect', hover: 'glow', target: null, message: '', sfx: 'a_glocke', conds: [], actions: [{ type: 'loot', table: 'lt_truhe' }] },
      { id: id('o'), name: 'Tür', asset: 'a_tuer', x: 76, y: 22, w: 12, h: 50, rot: 0, shape: 'rect', hover: 'glow', target: 's4', message: '', sfx: null },
      { id: id('o'), name: 'Buch', asset: 'a_buch', x: 46, y: 40, w: 10, h: 18, rot: -4, shape: 'ellipse', hover: 'grow', target: null, message: 'Das Buch ist noch versiegelt. Vielleicht später, wenn Ray dir mehr vertraut.', sfx: null, conds: [], actions: [] }
    ],
    events: [{ id: 'ev_tut', trigger: 'first', spotlight: 'o_truhe', lock: true, conds: [], lines: [
      { id: 'ln_tut1', speaker: 'Ray', color: '#c4b2ff', text: 'Willkommen im Quartier der Gilde!' },
      { id: 'ln_tut2', speaker: 'Ray', color: '#c4b2ff', text: 'Schau mal in die Truhe da drüben. Mit „I“ öffnest du dein Inventar.' }
    ] }]
  };

  const s4 = { id: 's4', type: 'story', name: 'Kapitel 2 · Der Schlosshof', x: 960, y: 260, beats: 5, next: null, tracks: empty() };
  s4.tracks.bg.push({ id: id('c'), start: 0, len: 5, asset: 'a_bg_hof', trans: 'fade', dur: 1, daytime: 'evening' });
  s4.tracks.fx.push({ id: id('c'), start: 0, len: 5, particles: 'petals', color: '#ffb6d0', density: 30, speed: 22, size: 50, wind: 25, opacity: 100, styles: {} });
  // Handy-Chat: Nachrichten erscheinen nacheinander
  s4.tracks.dialog.push(
    dlg(0, '', '#ffffff', 'Kapitel 2 beginnt hier … Rays Handy vibriert.'),
    Object.assign(dlg(1, 'Unbekannt', '#ffffff', 'Wir wissen, was du im Keller gemacht hast.'), { chat: true }),
    Object.assign(dlg(2, 'Ray', '#c4b2ff', 'Wer ist da?? 😳'), { chat: true }),
    Object.assign(dlg(3, 'Unbekannt', '#ffffff', 'Komm um Mitternacht zum Brunnen. Allein.'), { chat: true }),
    dlg(4, '', '#ffffff', 'Fortsetzung folgt. Bau weiter!')
  );

  // Extra-Szene: Parallax (Tiefe durch Bildebenen + Kamerafahrt)
  const sp = { id: 'sp', type: 'story', name: 'Extra · Parallax-Test', x: 960, y: 480, beats: 3, next: null, tracks: empty() };
  sp.tracks.bg.push({ id: id('c'), start: 0, len: 3, asset: 'a_par_himmel', trans: 'fade', dur: 0.6, depth: 0, layers: [{ asset: 'a_par_wolken', depth: 0.15, front: false, tile: { on: true, dir: 'left', speed: 2.5, size: 100, mirror: false } }, { asset: 'a_par_berge', depth: 0.3, front: false }, { asset: 'a_par_huegel', depth: 0.65, front: false }, { asset: 'a_par_vorne', depth: 1.5, front: true }] });
  sp.tracks.char1.push({ id: id('c'), start: 0, len: 3, asset: 'a_ray', x: 50, scale: 62, trans: 'cut', dur: 0, idle: 'none', name: 'Ray' });
  sp.tracks.cam.push({ id: id('c'), start: 0, len: 3, zoom: 125, panX: -12, panY: 0, rot: 0, shake: 0, dur: 0, ease: 'ease-in-out', keys: [{ beat: 2, zoom: 125, panX: 12, panY: 0, rot: 0, dur: 3, ease: 'ease-in-out' }] });

  const data = {
    version: 1, title: 'Beispiel: Diebesgilde', startScene: 's1', assets, scenes: [s1, s2, s3, hub, s4, sp], counter: n + 10,
    vars: [
      { id: 'v_vertrauen', name: 'Vertrauen Ray', type: 'number', start: 0, note: 'Steigt, wenn man Ray hilft' },
      { id: 'v_tuer', name: 'Tür geknackt', type: 'flag', start: false, note: '' }
    ],
    items: [
      { id: 'it_dietrich', name: 'Dietrich', cat: 'Werkzeug', stack: true, max: 10, value: 15, desc: 'Biegt sich, bricht aber selten. Meistens.', image: 'a_i_dietrich' },
      { id: 'it_trank', name: 'Heiltrank', cat: 'Tränke', stack: true, max: 5, value: 40, desc: 'Schmeckt nach Kirschen und Ärger.', image: 'a_i_trank' },
      { id: 'it_ring', name: 'Gold-Ring', cat: 'Schätze', stack: false, max: 1, value: 120, desc: 'Eingraviert: „Für R.“', image: 'a_i_ring' },
      { id: 'it_brief', name: 'Versiegelter Brief', cat: 'Quest', stack: false, max: 1, value: 0, desc: 'Das Siegel trägt das Wappen des Schlossherrn.', image: 'a_i_brief' }
    ],
    currencies: [
      { id: 'cur_gold', name: 'Gold', color: '#e8c86a', start: 5, max: 99999, image: 'a_c_gold' },
      { id: 'cur_gem', name: 'Edelsteine', color: '#6ad0c8', start: 0, max: 999, image: 'a_c_gem' }
    ],
    lootTables: [{
      id: 'lt_truhe', name: 'Truhe im Quartier', mode: 'seed', maxDraws: 2, once: true, entries: [
        { kind: 'money', ref: 'cur_gold', min: 10, max: 40, chance: 100, guaranteed: true, conds: [] },
        { kind: 'item', ref: 'it_trank', min: 1, max: 2, chance: 45, guaranteed: false, conds: [] },
        { kind: 'item', ref: 'it_brief', min: 1, max: 1, chance: 35, guaranteed: false, conds: [] },
        { kind: 'item', ref: 'it_ring', min: 1, max: 1, chance: 8, guaranteed: false, conds: [] },
        { kind: 'money', ref: 'cur_gem', min: 1, max: 3, chance: 20, guaranteed: false, conds: [] }
      ]
    }],
    inventory: { title: 'Inventar', cols: 6, rows: 3, bg: null, slot: null, showMoney: true, hudMoney: true, enabled: true },
    languages: ['de', 'en'],
    translations: {},
    rigs: {},
    blinks: {
      a_ray: { on: true, mode: 'mask', eyes: [{ x: 0.4133, y: 0.282, w: 0.0467, h: 0.036 }, { x: 0.54, y: 0.282, w: 0.0467, h: 0.036 }], color: '#e9d6c4', lash: '#2a2440', min: 2.2, max: 5, dur: 0.16, double: 0.25 }
    },
    plugins: { 'schlossknacken.js': { enabled: true } },
    mainMenu: {
      enabled: true, bg: 'a_bg_gilde', bgLook: { vignette: 55, styles: { blur: { on: true, amount: 3 } }, kenburns: true, zoom: 110 }, music: 'a_musik',
      title: 'Die Diebesgilde', titleColor: '#f3e2b8', titleSize: 10, titleY: 24, titleFont: 'asset:a_font_cinzel', logo: null, logoW: 30,
      buttons: [['Neues Spiel', 'new'], ['Fortsetzen', 'continue'], ['Laden', 'load'], ['Einstellungen', 'settings'], ['Beenden', 'quit']].map(([label, action], i) => ({ id: 'mb_' + action, label, action, x: 50, y: 50 + i * 9, w: 26 })),
      btn: { bg: '#1a1420', alpha: 80, color: '#f3e2b8', border: '#c9a24a', radius: 1.4, size: 3.4, hover: 'glow' }
    },
    // Design: Ray spricht in der normalen Blase, die Wache in der düsteren Vorlage
    theme: {
      bubble: { preset: 'dunkel' },
      speakers: { Wache: { preset: 'duester', font: 'asset:a_font_cinzel', size: 3.4 } },
      focus: { on: true, dim: 35 },
      choice: { anim: 'pop' },
      sys: { titleFont: 'asset:a_font_cinzel' },
      gain: {}, sounds: { click: 'a_klick', vol: 45 }, cursor: {}, fonts: {}, logo: {}, presets: []
    },
    // Lippensync: Mund von Ray und der Wache markiert
    mouths: {
      a_ray: { on: true, mode: 'mask', rect: { x: 0.445, y: 0.343, w: 0.112, h: 0.052 }, color: '#3a1418', lip: '' },
      a_wache: { on: true, mode: 'mask', rect: { x: 0.432, y: 0.376, w: 0.135, h: 0.056 }, color: '#2a1012', lip: '' }
    },
    glossary: [{ id: 'gl_gilde', term: 'Gilde', alt: 'Diebesgilde', text: 'Die Diebesgilde von Alt-Brunnstadt. Offiziell gibt es sie nicht, inoffiziell gehört ihr die halbe Unterstadt.', image: 'a_bg_gilde' }],
    chat: { me: 'Ray' },
    audioMix: { on: true, duck: 45 },
    autoRig: [['a_ray', 'biped'], ['a_wache', 'biped']]
  };
  // Englische Beispiel-Übersetzungen für Szene 1
  const en = {};
  const tr = (idv, src, text) => { en[idv] = { text, src, ok: true }; };
  s1.tracks.dialog.forEach((d, i) => tr(d.id, d.text, ['Psst… nobody ever really sleeps down here.', 'The door up ahead only has an old lock.', 'I can open it in ten seconds. Here, take the spare lockpick.', 'Who’s there? Show yourself!', 'Damn. What now?'][i]));
  tr('opt_knacken', 'Schloss knacken', 'Pick the lock');
  tr('opt_ablenken', 'Wache ablenken', 'Distract the guard');
  tr('opt_bestechen', 'Wache bestechen (20 Gold)', 'Bribe the guard (20 gold)');
  tr('ln_tut1', 'Willkommen im Quartier der Gilde!', 'Welcome to the guild’s quarters!');
  tr('name:Wache', 'Wache', 'Guard');
  tr('menu:title', 'Die Diebesgilde', 'The Thieves’ Guild');
  [['new', 'Neues Spiel', 'New Game'], ['continue', 'Fortsetzen', 'Continue'], ['load', 'Laden', 'Load'], ['settings', 'Einstellungen', 'Settings'], ['quit', 'Beenden', 'Quit']].forEach(([k, de, e]) => tr('menu:mb_' + k, de, e));
  data.translations.en = en;
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(data, null, 2), 'utf8');
  return data;
}

module.exports = { createDemoProject };
