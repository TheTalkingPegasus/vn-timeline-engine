// Versionsnummer überall auf einmal setzen: node tools/set-version.js 0.7.1
// Ändert package.json, renderer/js/schema.js, renderer/index.html, README.md, README.txt, LIES MICH.txt (erste Zeile)
const fs = require('fs');
const path = require('path');
const v = String(process.argv[2] || '').replace(/^v/i, '').trim();
if (!/^\d+\.\d+\.\d+$/.test(v)) { console.error('Bitte Version wie 0.7.1 angeben'); process.exit(1); }
const root = path.join(__dirname, '..');
const edit = (rel, fn) => { const f = path.join(root, rel); if (!fs.existsSync(f)) return; const a = fs.readFileSync(f, 'utf8'); const b = fn(a); if (a !== b) { fs.writeFileSync(f, b); console.log('✓', rel); } };
edit('package.json', (s) => s.replace(/"version":\s*"[^"]+"/, `"version": "${v}"`));
edit('renderer/js/schema.js', (s) => s.replace(/S\.ENGINE = '[^']+'/, `S.ENGINE = '${v}'`));
edit('renderer/index.html', (s) => s.replace(/(<span data-notr>)\d+\.\d+\.\d+(<\/span>)/, `$1${v}$2`));
edit('README.md', (s) => s.replace(/prototype \(\d+\.\d+\.\d+\)/, `prototype (${v})`).replace(/Prototyp \(\d+\.\d+\.\d+\)/, `Prototyp (${v})`));
edit('README.txt', (s) => s.replace(/^(VN Timeline Engine · Prototype )\d+\.\d+\.\d+/, `$1${v}`));
edit('LIES MICH.txt', (s) => s.replace(/^(VN Timeline Engine · Prototyp )\d+\.\d+\.\d+/, `$1${v}`));
console.log('Version ist jetzt', v);
