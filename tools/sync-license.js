// Lizenztexte für die Lizenzseite des Installers kopieren (Deutsch/Englisch je nach Windows-Sprache)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(root, 'build', 'license_en.txt'));
fs.copyFileSync(path.join(root, 'LIZENZ.txt'), path.join(root, 'build', 'license_de.txt'));
console.log('Lizenz für den Installer aktualisiert');
