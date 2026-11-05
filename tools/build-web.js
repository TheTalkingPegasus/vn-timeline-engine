// Baut die Web-Version des Editors nach web-build/ (zum Ausprobieren ohne Installation, z. B. auf GitHub Pages).
// Aufruf: node tools/build-web.js
// Enthält: Oberfläche (renderer/), web-editor.js als Ersatz für die Desktop-Schnittstelle, mitgelieferte Plugins,
// Beispiel-, Tutorial- und Lernprojekt (Deutsch, Englisch, Spanisch, Japanisch) und JSZip für ZIP-Download und Web-Export.
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.join(__dirname, '..');
const out = path.join(root, 'web-build');
const rd = path.join(root, 'renderer');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const copy = (src, dest) => { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(src, dest); };
const copyDir = (src, dest, filter) => {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d, filter); else if (!filter || filter(s)) copy(s, d);
  }
};
const listFiles = (dir, base = '') => {
  const res = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base + e.name;
    if (e.isDirectory()) res.push(...listFiles(path.join(dir, e.name), rel + '/')); else res.push(rel);
  }
  return res;
};

// 1. Oberfläche
copy(path.join(rd, 'style.css'), path.join(out, 'style.css'));
copyDir(path.join(rd, 'js'), path.join(out, 'js'));
let html = fs.readFileSync(path.join(rd, 'index.html'), 'utf8');
const csp = "default-src 'self' data: blob:; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data: blob:; script-src 'self' blob:; worker-src 'self' blob:";
html = html.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/, `<meta http-equiv="Content-Security-Policy" content="${csp}">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="description" content="VN Timeline Engine – build visual novels like in a video editor. Web version, no installation.">`);
const firstScript = html.indexOf('<script src="js/');
if (firstScript < 0) throw new Error('index.html: keine Skripte gefunden');
html = html.slice(0, firstScript) + '<script src="js/web-editor.js"></script>\n' + html.slice(firstScript);
html = html.replace('<title>VN Timeline Engine</title>', '<title>VN Timeline Engine · Web</title>');
fs.writeFileSync(path.join(out, 'index.html'), html);

// 2. Dateilisten für den Web-Export eines Spiels (dieselben wie in main.js)
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const engine = JSON.parse(main.match(/const engineFiles = (\[[^\]]*\])/)[1].replace(/'/g, '"')).filter((f) => f !== 'js/web-editor.js');
const web = JSON.parse(main.match(/\n {4}(\['game-data\.js'[^\]]*\])/)[1].replace(/'/g, '"'));
fs.writeFileSync(path.join(out, 'engine-files.json'), JSON.stringify({ engine, web }));

// 3. Mitgelieferte Plugins, Anleitungen, Lizenz, JSZip
for (const f of ['jobs.js', 'minispiele.js', 'spielhalle.js', 'schlossknacken.js', 'PLUGINS.md', 'PLUGINS.en.md']) copy(path.join(root, 'templates', f), path.join(out, 'templates', f));
copy(path.join(root, 'LICENSE'), path.join(out, 'LICENSE.txt'));
copy(path.join(root, 'node_modules', 'jszip', 'dist', 'jszip.min.js'), path.join(out, 'vendor', 'jszip.min.js'));
copy(path.join(root, 'node_modules', 'jszip', 'LICENSE.markdown'), path.join(out, 'vendor', 'jszip-LICENSE.md'));
fs.writeFileSync(path.join(out, '.nojekyll'), '');

// 4. Beispielprojekte (wie „Beispielprojekt“, „Tutorial“ und „Lernen“ in der Desktop-Version)
const { createDemoProject } = require(path.join(root, 'demo.js'));
const { createTutorialProject } = require(path.join(root, 'tutorial.js'));
const index = {};
for (const lang of ['de', 'en', 'es', 'ja']) {
  const L = require(path.join(root, 'project-lang.js'))(rd, () => lang);
  for (const kind of ['demo', 'tutorial', 'learn']) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vnweb-'));
    let data = kind === 'tutorial' ? createTutorialProject(tmp) : createDemoProject(tmp);
    if (kind === 'learn') { data.title = 'Lernprojekt'; data.learn = true; }
    data = L.enProject(data);
    if (kind === 'learn') data.title = L.T('Lernprojekt');
    fs.writeFileSync(path.join(tmp, 'project.json'), JSON.stringify(data, null, 2));
    const name = kind + '-' + lang;
    copyDir(tmp, path.join(out, 'samples', name));
    index[name] = listFiles(tmp);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
fs.writeFileSync(path.join(out, 'samples', 'index.json'), JSON.stringify(index));

const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log('Web-Version gebaut:', out, '·', (size(out) / 1048576).toFixed(1), 'MB');
