// Text-Import: fertige Dialoge einfügen (eigenes Format „Name: Text“ oder Ren'Py-Skript).
// Aus jeder Zeile wird ein Dialog-Clip, aus Auswahlen ein Auswahl-Clip. Alles steht danach
// automatisch im Transkript (zum Übersetzen und für das Sprecher-Skript).
(function () {
  const { el } = VN;
  const TI = (VN.TextImport = {});

  const RENPY_KEYWORDS = new Set(['scene', 'show', 'hide', 'play', 'stop', 'queue', 'jump', 'call', 'return', 'pause', 'with', 'window', 'python', 'init', 'image', 'transform', 'screen', 'style', 'define', 'default', 'label', 'menu', 'if', 'elif', 'else', 'while', 'for', 'voice', 'nvl', 'camera', 'at', 'translate', 'old', 'new', 'extend']);
  const PALETTE = ['#c4b2ff', '#ff9e7a', '#8fd6a8', '#ffd479', '#8fc3f0', '#f2a7d8', '#b8e07a', '#ffb3b3'];

  // Ren'Py-Texttags in Engine-Tags umwandeln
  const renpyText = (t) => t
    .replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, '\n')
    .replace(/\{(w|p)(=[\d.]+)?\}/g, (m, k, v) => '{pause=' + (v ? v.slice(1) : '0.6') + '}')
    .replace(/\{\/?(i|b|u|s|plain|size|font|alpha|k|cps|nw|fast|a)(=[^}]*)?\}/g, '')
    .replace(/\[([A-Za-z_][\w.]*)\]/g, '{$1}');

  // Zerlegt Text in Einträge: { kind: 'line', who, text } | { kind: 'choice', options: [] } | { kind: 'scene', name }
  TI.parse = (text, opts) => {
    opts = opts || {};
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const items = [];
    const skipped = [];
    const defs = {}; // Ren'Py-Kürzel → Name
    const colors = {};
    // Format erkennen
    let mode = opts.mode || 'auto';
    if (mode === 'auto') {
      let rp = 0, simple = 0;
      for (const l of lines) {
        const t = l.trim();
        if (/^define\s+\w+\s*=\s*Character\(/.test(t) || /^label\s+[\w.]+\s*:/.test(t) || /^(\w+\s+)*"[^"]*"\s*$/.test(t)) rp++;
        else if (/^[^:"#>]{1,30}:\s*\S/.test(t)) simple++;
      }
      mode = rp > simple ? 'renpy' : 'simple';
    }
    if (mode === 'renpy') {
      for (const l of lines) {
        const m = /^\s*define\s+(\w+)\s*=\s*Character\(\s*(?:_\(\s*)?(?:"([^"]*)"|'([^']*)'|None)/.exec(l);
        if (m) { defs[m[1]] = m[2] != null ? m[2] : (m[3] != null ? m[3] : ''); const c = /color\s*=\s*["'](#[0-9a-fA-F]{3,8})["']/.exec(l); if (c) colors[defs[m[1]]] = c[1]; }
      }
    }
    const indentOf = (l) => (/^\s*/.exec(l)[0].replace(/\t/g, '    ')).length;
    let menu = null; // { indent, options, optIndent }
    let curChoice = null;
    const pushChoice = () => { if (curChoice && curChoice.options.length) items.push(curChoice); curChoice = null; };

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const t = raw.trim();
      if (!t) { if (mode === 'simple') pushChoice(); continue; }
      if (mode === 'renpy') {
        const ind = indentOf(raw);
        if (menu && ind <= menu.indent) { if (menu.options.length) items.push({ kind: 'choice', options: menu.options }); menu = null; }
        if (t.startsWith('#')) continue;
        if (/^define\s|^default\s|^image\s|^init\b|^\$/.test(t)) { skipped.push(t); continue; }
        const lab = /^label\s+([\w.]+)\s*(\(.*\))?\s*:/.exec(t);
        if (lab) { items.push({ kind: 'scene', name: lab[1] }); continue; }
        if (/^menu\b.*:\s*$/.test(t)) { menu = { indent: ind, options: [], optIndent: null }; continue; }
        const jmp = /^jump\s+([\w.]+)\s*$/.exec(t);
        if (jmp && !menu) { items.push({ kind: 'jump', label: jmp[1] }); continue; }
        if (/^return\b/.test(t) && !menu) { items.push({ kind: 'end' }); continue; }
        if (menu) {
          const opt = /^"((?:[^"\\]|\\.)*)"\s*(if\s+.+)?:\s*$/.exec(t);
          if (opt && (menu.optIndent == null || ind <= menu.optIndent)) { menu.optIndent = ind; menu.options.push({ text: renpyText(opt[1]), cond: opt[2] || '' }); continue; }
          if (menu.optIndent != null && ind > menu.optIndent) {
            const j = /^jump\s+([\w.]+)\s*$/.exec(t);
            if (j && menu.options.length) menu.options[menu.options.length - 1].jump = j[1]; else skipped.push(t);
            continue;
          }
          // Eine Frage direkt unter menu: ist eine normale Zeile
        }
        // "Name" "Text"
        let m = /^"((?:[^"\\]|\\.)*)"\s+"((?:[^"\\]|\\.)*)"\s*(with\s+\w+)?\s*$/.exec(t);
        if (m) { items.push({ kind: 'line', who: renpyText(m[1]), text: renpyText(m[2]) }); continue; }
        // kuerzel [attribute] "Text"  oder  "Text"
        m = /^(?:([A-Za-z_]\w*)((?:\s+[A-Za-z_][\w-]*)*)\s+)?"((?:[^"\\]|\\.)*)"\s*(with\s+\w+)?\s*$/.exec(t);
        if (m && !(m[1] && RENPY_KEYWORDS.has(m[1]))) {
          const code = m[1] || '';
          items.push({ kind: 'line', who: code ? (defs[code] != null ? defs[code] : code) : '', code, text: renpyText(m[3]) });
          continue;
        }
        skipped.push(t);
        continue;
      }
      // Eigenes Format
      if (/^#{1,3}\s*\S/.test(t) || /^={2,}\s*.+?\s*={2,}$/.test(t)) { pushChoice(); items.push({ kind: 'scene', name: t.replace(/^#+\s*|^=+\s*|\s*=+$/g, '') }); continue; }
      if (/^(\/\/|--\s)/.test(t)) { skipped.push(t); continue; }
      const opt = /^(?:->|>|\*|•)\s*(.+)$/.exec(t);
      if (opt) { curChoice = curChoice || { kind: 'choice', options: [] }; curChoice.options.push({ text: opt[1].trim(), cond: '' }); continue; }
      pushChoice();
      const sp = /^([^:"]{1,30}?)\s*:\s*(.+)$/.exec(t);
      if (sp && sp[1].split(/\s+/).length <= 3 && !/^\d+$/.test(sp[1])) { items.push({ kind: 'line', who: sp[1].trim(), text: sp[2].trim() }); continue; }
      items.push({ kind: 'line', who: '', text: t });
    }
    if (menu && menu.options.length) items.push({ kind: 'choice', options: menu.options });
    pushChoice();
    return { mode, items, skipped, defs, colors };
  };

  // Farben bekannter Sprecher aus dem Projekt
  const knownColors = () => {
    const out = {};
    for (const s of VN.project.scenes) if (s.type === 'story') for (const d of s.tracks.dialog) if (d.speaker && d.color && !out[d.speaker]) out[d.speaker] = d.color;
    return out;
  };

  // Einträge in Szenen schreiben. target: 'append' (aktuelle Szene) | 'new'
  TI.apply = (parsed, target, scene, nameMap) => {
    const colors = Object.assign({}, parsed.colors, knownColors());
    let pi = Object.keys(colors).length;
    const colorOf = (who) => { if (!who) return '#ffffff'; if (!colors[who]) colors[who] = PALETTE[pi++ % PALETTE.length]; return colors[who]; };
    const made = [];
    let s = target === 'append' && scene && scene.type === 'story' ? scene : null;
    let beat = 0;
    const endOf = (sc) => Math.max(0, ...['dialog', 'choice'].flatMap((k) => (sc.tracks[k] || []).map((c) => c.start + c.len)));
    const closed = new Set(); // Szenen, die mit return, Sprung oder Auswahl enden: nicht automatisch weiterleiten
    let lastKind = '';
    const startScene = (name) => {
      const prev = s;
      s = VN.newStoryScene(name || VN.t('Importierte Szene'));
      s.beats = 1;
      if (prev && !prev.next && !closed.has(prev) && lastKind !== 'choice') prev.next = s.id;
      made.push(s);
      beat = 0;
    };
    if (s) beat = endOf(s);
    let lines = 0, choices = 0;
    const byLabel = {};
    const pending = []; // [objekt, feld, label]
    for (const it of parsed.items) {
      if (it.kind === 'scene') {
        // Erste Szenenmarke beim Anhängen: in die aktuelle Szene, solange dort noch nichts dazukam
        if (s && target === 'append' && !made.length && beat === endOf(s) && lines + choices === 0) { byLabel[it.name] = s.id; continue; }
        startScene(it.name);
        byLabel[it.name] = s.id;
        continue;
      }
      if (it.kind === 'jump') { if (s) { pending.push([s, 'next', it.label]); closed.add(s); } continue; }
      if (it.kind === 'end') { if (s) closed.add(s); continue; }
      lastKind = it.kind;
      if (!s) startScene('');
      if (it.kind === 'line') {
        const who = (nameMap && it.code && nameMap[it.code] != null) ? nameMap[it.code] : it.who;
        s.tracks.dialog.push({ id: VN.uid('c'), start: beat, len: 1, speaker: who, color: colorOf(who), text: it.text, speed: 40, actions: [] });
        lines++;
      } else if (it.kind === 'choice') {
        const opts = it.options.map((o) => { const x = { id: VN.uid('opt'), text: o.text, target: null, conds: [], actions: [] }; if (o.jump) pending.push([x, 'target', o.jump]); return x; });
        s.tracks.choice.push({ id: VN.uid('c'), start: beat, len: 1, options: opts });
        choices++;
      }
      beat++;
      s.beats = Math.max(s.beats || 1, beat);
    }
    // Sprünge (jump) auf die Szenen der passenden Labels umbiegen
    for (const [obj, field, label] of pending) if (byLabel[label]) obj[field] = byLabel[label];
    return { lines, choices, scenes: made };
  };

  // ---------- Fenster ----------
  const n = (k, one, many) => k + ' ' + (k === 1 ? one : many);
  TI.open = (scene) => {
    const back = el('div', { class: 'modal-back' });
    const st = { text: '', mode: 'auto', target: scene && scene.type === 'story' ? 'append' : 'new', names: {} };
    const ta = el('textarea', { class: 'ti-text', spellcheck: false, placeholder: 'Ray: Psst … hier unten schläft nie jemand.\nWache: Wer ist da?\n> Schloss knacken\n> Wache ablenken\n\noder ein Ren\'Py-Skript:\nr "Psst …"' });
    const preview = el('div', { class: 'ti-preview' });
    const info = el('div', { class: 'muted small' });
    const names = el('div', { class: 'ti-names' });
    const ok = el('button', { class: 'btn primary' }, 'Übernehmen');
    let parsed = null;
    const draw = () => {
      parsed = TI.parse(st.text, { mode: st.mode });
      preview.innerHTML = '';
      const known = knownColors();
      let lines = 0, choices = 0, scenes = 0;
      for (const it of parsed.items.slice(0, 400)) {
        if (it.kind === 'scene') { scenes++; preview.appendChild(el('div', { class: 'ti-scene', 'data-notr': '' }, '🎬 ' + it.name)); continue; }
        if (it.kind === 'jump' || it.kind === 'end') continue;
        if (it.kind === 'choice') { choices++; preview.appendChild(el('div', { class: 'ti-choice' }, el('span', { class: 'muted small' }, 'Auswahl'), ...it.options.map((o) => el('span', { class: 'ti-opt', 'data-notr': '' }, o.text)))); continue; }
        lines++;
        const who = (it.code && st.names[it.code] != null) ? st.names[it.code] : it.who;
        preview.appendChild(el('div', { class: 'ti-line' },
          who ? el('strong', { 'data-notr': '', style: { color: known[who] || parsed.colors[who] || '#c4b2ff' } }, who) : el('em', { class: 'muted' }, 'Erzähler'),
          el('span', { 'data-notr': '' }, it.text)));
      }
      for (const it of parsed.items.slice(400)) { if (it.kind === 'line') lines++; else if (it.kind === 'choice') choices++; else if (it.kind === 'scene') scenes++; }
      if (!parsed.items.length) preview.appendChild(el('div', { class: 'muted' }, 'Links Text einfügen oder eine Datei öffnen. Die Vorschau zeigt, was erkannt wird.'));
      info.textContent = '';
      info.appendChild(el('span', null, n(lines, 'Zeile', 'Zeilen') + ' · ' + n(choices, 'Auswahl', 'Auswahlen') + ' · ' + n(scenes, 'Szene', 'Szenen') + ' · Format: ' + (parsed.mode === 'renpy' ? 'Ren\'Py' : 'Name: Text')));
      if (parsed.skipped.length) info.appendChild(el('span', { title: parsed.skipped.slice(0, 30).join('\n') }, ' · ' + parsed.skipped.length + ' Befehle übersprungen (Bilder, Musik …)'));
      // Ren'Py-Kürzel ohne define: Namen eintragen lassen
      names.innerHTML = '';
      const codes = Array.from(new Set(parsed.items.filter((x) => x.kind === 'line' && x.code && parsed.defs[x.code] == null).map((x) => x.code)));
      if (codes.length) {
        names.appendChild(el('div', { class: 'muted small' }, 'Kürzel ohne „define“ – Namen eintragen:'));
        for (const c of codes) names.appendChild(el('label', { class: 'row gap4' }, el('code', { 'data-notr': '' }, c), el('input', { class: 'inp', value: st.names[c] || c, style: { width: '120px' }, oninput: (e) => { st.names[c] = e.target.value; clearTimeout(names._t); names._t = setTimeout(draw, 250); } })));
      }
      ok.disabled = !(lines + choices);
      ok.textContent = 'Übernehmen (' + (lines + choices) + ')';
    };
    ta.addEventListener('input', () => { st.text = ta.value; clearTimeout(ta._t); ta._t = setTimeout(draw, 150); });
    ta.addEventListener('keydown', (e) => e.stopPropagation());
    const modeSel = el('select', { onchange: (e) => { st.mode = e.target.value; draw(); } },
      ...[['auto', 'Format: automatisch'], ['simple', 'Format: Name: Text'], ['renpy', 'Format: Ren\'Py']].map(([v, l]) => el('option', { value: v }, l)));
    const targetSel = el('select', { onchange: (e) => { st.target = e.target.value; } },
      ...[...(scene && scene.type === 'story' ? [['append', 'An die offene Szene anhängen']] : []), ['new', 'Als neue Szene(n) anlegen']].map(([v, l]) => { const o = el('option', { value: v }, l); if (v === st.target) o.selected = true; return o; }));
    ok.onclick = () => {
      if (!parsed || !parsed.items.length) return;
      let res = null;
      VN.mutate(() => { res = TI.apply(parsed, st.target, scene, st.names); });
      back.remove();
      if (res.scenes.length && (st.target === 'new' || !scene)) { VN.ui.sceneId = res.scenes[0].id; VN.ui.view = 'scene'; VN.ui.beat = 0; VN.render(); }
      VN.toast('Übernommen: ' + n(res.lines, 'Zeile', 'Zeilen') + ', ' + n(res.choices, 'Auswahl', 'Auswahlen') + (res.scenes.length ? ', ' + n(res.scenes.length, 'neue Szene', 'neue Szenen') : ''));
    };
    const box = el('div', { class: 'modal ti-modal' },
      el('div', { class: 'row gap8', style: { alignItems: 'center' } },
        el('strong', { style: { fontSize: '16px' } }, 'Text importieren'),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn', onclick: async () => { const t = await VN.api.openText('txt,rpy,fountain,md'); if (t != null) { ta.value = t; st.text = t; draw(); } } }, 'Datei öffnen …'),
        el('button', { class: 'btn', onclick: () => back.remove() }, 'Schließen')),
      el('p', { class: 'muted small' }, 'Fertige Dialoge einfügen: eine Zeile pro Satz als „Name: Text“, Zeilen ohne Namen sind Erzähler. „> Antwort“ untereinander wird eine Auswahl, „# Titel“ beginnt eine neue Szene. Ren\'Py-Skripte werden erkannt (Sprecher-Kürzel aus „define“, menu, label); Sprünge (jump) werden zu Verbindungen, Bilder und Musik werden übersprungen.'),
      el('div', { class: 'row gap8' }, modeSel, targetSel),
      el('div', { class: 'ti-grid' }, ta, preview),
      names,
      el('div', { class: 'row gap8', style: { alignItems: 'center' } }, info, el('div', { class: 'spacer' }), ok));
    back.appendChild(box);
    back.addEventListener('mousedown', (e) => { if (e.target === back) back.remove(); });
    document.body.appendChild(back);
    draw();
    setTimeout(() => ta.focus(), 50);
    return { back, ta, set: (t) => { ta.value = t; st.text = t; draw(); } };
  };
})();
