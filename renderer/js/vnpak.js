// Gepackte Spieldateien (0.9.7): Bilder, Töne, Videos und die Projektdaten in einer Archivdatei „data.vnpak“.
// Leicht verschlüsselt (XOR mit einem Schlüsselstrom, der von der Position in der Datei abhängt) – das hält
// Neugierige ab und verhindert Spoiler beim Durchstöbern des Spielordners, ist aber kein Kopierschutz:
// der Schlüssel muss im Spiel mitgeliefert werden.
// Aufbau: "VNPAK1" · 32 Byte Schlüssel · 4 Byte Länge des Inhaltsverzeichnisses · Verzeichnis (JSON) · Projekt · Dateien.
// Alles ab dem Verzeichnis ist verschlüsselt; Positionen im Verzeichnis sind absolut (vom Dateianfang).
// Läuft im Hauptprozess (require) und im Browser (window.VNPak).
(function (root) {
  const MAGIC = 'VNPAK1';
  const HEAD = 6 + 32 + 4;
  const te = new TextEncoder();
  const td = new TextDecoder();

  // Verschlüsselt bzw. entschlüsselt (gleiche Operation) ein Stück, das an Position pos der Datei liegt – in place
  function xor(bytes, pos, key) {
    for (let i = 0, n = bytes.length; i < n; i++) {
      const p = pos + i;
      bytes[i] ^= key[p & 31] ^ (Math.imul(p ^ (p >>> 13), 0x9E3779B1) >>> 24);
    }
    return bytes;
  }

  function newKey() {
    const k = new Uint8Array(32);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(k);
    else { const b = require('crypto').randomBytes(32); for (let i = 0; i < 32; i++) k[i] = b[i]; }
    return k;
  }

  // Kopf mit Verzeichnis bauen. entries: [{ rel, size }], projectSize: Länge der Projektdaten (Bytes)
  // → { head: Uint8Array (schon verschlüsselt), project: [pos, size], files: { rel: [pos, size] } }
  function makeHead(key, entries, projectSize) {
    let idxLen = 0, json = '', layout = null;
    for (let tries = 0; tries < 10; tries++) {
      let off = HEAD + idxLen;
      const project = [off, projectSize];
      off += projectSize;
      const files = {};
      for (const e of entries) { files[e.rel] = [off, e.size]; off += e.size; }
      layout = { v: 1, project, files };
      json = JSON.stringify(layout);
      const len = te.encode(json).length;
      if (len <= idxLen) break;
      idxLen = len + 32;
    }
    const idx = new Uint8Array(idxLen);
    idx.fill(32); // mit Leerzeichen auffüllen
    idx.set(te.encode(json));
    const head = new Uint8Array(HEAD + idxLen);
    head.set(te.encode(MAGIC), 0);
    head.set(key, 6);
    new DataView(head.buffer).setUint32(38, idxLen, true);
    head.set(xor(idx, HEAD, key), HEAD);
    return { head, project: layout.project, files: layout.files };
  }

  // Ersten 42 Bytes lesen → { key, idxLen } (oder null, wenn es kein Paket ist)
  function readHead(bytes) {
    if (!bytes || bytes.length < HEAD || td.decode(bytes.subarray(0, 6)) !== MAGIC) return null;
    const key = new Uint8Array(32);
    key.set(bytes.subarray(6, 38));
    const idxLen = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(38, true);
    return { key, idxLen };
  }
  // Verzeichnis (verschlüsselte Bytes ab Position 42) → { project, files }
  function readIndex(bytes, key) {
    const copy = new Uint8Array(bytes);
    return JSON.parse(td.decode(xor(copy, HEAD, key)));
  }

  const MIME = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', svg: 'image/svg+xml',
    ogg: 'audio/ogg', wav: 'audio/wav', mp3: 'audio/mpeg', opus: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4',
    ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2', webm: 'video/webm', mp4: 'video/mp4'
  };
  const mimeOf = (rel) => MIME[String(rel).split('.').pop().toLowerCase()] || 'application/octet-stream';

  // Ganzes Paket im Speicher bauen (Browser-Export): files: [{ rel, bytes: Uint8Array }], project: Objekt
  function buildInMemory(files, project) {
    const key = newKey();
    const pj = te.encode(JSON.stringify(project));
    const L = makeHead(key, files.map((f) => ({ rel: f.rel, size: f.bytes.length })), pj.length);
    let total = L.head.length + pj.length;
    for (const f of files) total += f.bytes.length;
    const out = new Uint8Array(total);
    out.set(L.head, 0);
    out.set(pj, L.project[0]); xor(out.subarray(L.project[0], L.project[0] + pj.length), L.project[0], key);
    for (const f of files) { const [pos, size] = L.files[f.rel]; out.set(f.bytes, pos); xor(out.subarray(pos, pos + size), pos, key); }
    return out;
  }

  // Ganzes Paket im Speicher öffnen (Web-Spiel): entschlüsselt alles → { project, files: { rel: Uint8Array } }
  function openInMemory(u8) {
    const h = readHead(u8);
    if (!h) throw new Error('data.vnpak ist kein Spielpaket');
    xor(u8.subarray(HEAD), HEAD, h.key);
    const idx = JSON.parse(td.decode(u8.subarray(HEAD, HEAD + h.idxLen)));
    const project = JSON.parse(td.decode(u8.subarray(idx.project[0], idx.project[0] + idx.project[1])));
    const files = {};
    for (const [rel, [pos, size]] of Object.entries(idx.files)) files[rel] = u8.subarray(pos, pos + size);
    return { project, files };
  }

  const API = { MAGIC, HEAD, xor, newKey, makeHead, readHead, readIndex, buildInMemory, openInMemory, mimeOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.VNPak = API;
})(typeof window !== 'undefined' ? window : globalThis);
