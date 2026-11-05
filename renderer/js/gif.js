// Kleiner GIF-Encoder (0.9.16) für Pixel-Art: Bilder mit Farbpalette (max. 256 Farben), Index 0 = durchsichtig.
// Animierte GIFs laufen überall in der Engine von selbst (Szenen, Hubs, Kampf), ohne eigene Abspiel-Logik.
(function (root) {
  // frames: [{ px: Uint8Array (w*h Palettenindizes), delay: Hundertstelsekunden }], palette: [[r,g,b], …] (Index 0 = durchsichtig)
  function encode(frames, w, h, palette, loop = true) {
    const out = [];
    const b = (x) => out.push(x & 255);
    const w16 = (x) => { b(x); b(x >> 8); };
    const str = (s) => { for (let i = 0; i < s.length; i++) b(s.charCodeAt(i)); };
    // Palettengröße: Zweierpotenz, mindestens 4
    let bits = 2; while ((1 << bits) < palette.length) bits++;
    if (bits > 8) throw new Error('Zu viele Farben für GIF (max. 256)');
    const size = 1 << bits;
    str('GIF89a'); w16(w); w16(h);
    b(0x80 | ((bits - 1) << 4) | (bits - 1)); // globale Farbtabelle
    b(0); b(0);
    for (let i = 0; i < size; i++) { const c = palette[i] || [0, 0, 0]; b(c[0]); b(c[1]); b(c[2]); }
    if (loop && frames.length > 1) { b(0x21); b(0xff); b(11); str('NETSCAPE2.0'); b(3); b(1); w16(0); b(0); }
    for (const f of frames) {
      // Grafiksteuerung: Verzögerung, durchsichtiger Index 0, vor dem nächsten Bild löschen (Disposal 2)
      b(0x21); b(0xf9); b(4); b((2 << 2) | 1); w16(Math.max(2, Math.round(f.delay || 10))); b(0); b(0);
      b(0x2c); w16(0); w16(0); w16(w); w16(h); b(0);
      lzw(f.px, Math.max(2, bits), out);
    }
    b(0x3b);
    return new Uint8Array(out);
  }

  // LZW-Kompression nach GIF-Art, Ausgabe in Blöcken zu max. 255 Bytes
  function lzw(px, minBits, out) {
    out.push(minBits);
    const clear = 1 << minBits, eoi = clear + 1;
    let codeSize = minBits + 1, next = eoi + 1;
    let dict = new Map();
    const bytes = [];
    let acc = 0, nbits = 0;
    const emit = (code) => { acc |= code << nbits; nbits += codeSize; while (nbits >= 8) { bytes.push(acc & 255); acc >>>= 8; nbits -= 8; } };
    emit(clear);
    let prefix = px.length ? px[0] : 0;
    for (let i = 1; i < px.length; i++) {
      const k = px[i], key = prefix * 4096 + k;
      const hit = dict.get(key);
      if (hit !== undefined) { prefix = hit; continue; }
      emit(prefix);
      if (next === 4096) { emit(clear); dict = new Map(); codeSize = minBits + 1; next = eoi + 1; }
      else { if (next >= (1 << codeSize)) codeSize++; dict.set(key, next++); }
      prefix = k;
    }
    emit(prefix); emit(eoi);
    if (nbits > 0) bytes.push(acc & 255);
    for (let i = 0; i < bytes.length; i += 255) { const n = Math.min(255, bytes.length - i); out.push(n); for (let j = 0; j < n; j++) out.push(bytes[i + j]); }
    out.push(0);
  }

  const API = { encode };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.GifEnc = API;
})(typeof window !== 'undefined' ? window : globalThis);
