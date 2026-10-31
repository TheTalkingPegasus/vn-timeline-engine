// Anleitung für KI (0.7.4): Eine Markdown-Datei, mit der jede KI (ChatGPT, Gemini, Grok, Claude …) ein Projekt
// ohne Quellcode versteht – Dateiformat, Szenen, Spuren, Bedingungen und Aktionen, Spielsysteme, die Oberfläche
// und eine Übersicht des aktuellen Projekts. Wird aus der laufenden Engine erzeugt, ist also immer aktuell.
// Projekt ▾ → „🤖 Anleitung für KI …“ legt sie als AI-GUIDE.md in den Projektordner oder kopiert sie.
(function () {
  const { el } = VN;
  const G = (VN.AIGuide = {});
  const J = (o) => JSON.stringify(o);
  const en = (t) => { if (!t) return ''; const e = window.VN_I18N_EN ? window.VN_I18N_EN[t] : null; return e && e !== t ? e + ' / ' + t : t; };
  const clean = (o) => { const c = JSON.parse(JSON.stringify(o)); if (c.id) c.id = '<unique id>'; return c; };

  // Beispiel-Clip je Spur aus den echten Voreinstellungen des Editors
  const trackExamples = () => {
    const s = { type: 'story', beats: 3, tracks: {} };
    VN.ensureTracks(s);
    const out = [];
    for (const t of VN.tracksOf(s)) {
      let ex = null;
      try { ex = window.Story ? Story.defaults(s, t, 0, null) : null; } catch (e) { ex = null; }
      out.push(`- \`${t.key}\` – ${en(t.label)} (${t.base})${ex ? ': `' + J(clean(ex)) + '`' : ''}`);
    }
    return out.join('\n');
  };

  const condList = () => {
    const rows = [
      ['var', '{ "type": "var", "var": "<variable id>", "op": ">=", "value": 2 }  (flags: "value": true/false)'],
      ['item', '{ "type": "item", "item": "<item id>", "op": ">=", "count": 1 }'],
      ['money', '{ "type": "money", "currency": "<currency id>", "op": ">=", "amount": 50 }'],
      ['seen', '{ "type": "seen", "scene": "<scene id>", "value": true }']
    ];
    if (VN.Life) for (const [k, l] of VN.Life.condTypes()) if (k === 'rel') rows.push(['rel', '{ "type": "rel", "char": "<relation char id>", "what": "value", "op": ">=", "value": 50 }  (' + l + ')']); else if (k === 'time') rows.push(['time', '{ "type": "time", ... }  (' + l + ')']);
    for (const [k, d] of Object.entries(VN.ext.conds)) {
      let make = {};
      try { make = d.make ? d.make() : {}; } catch (e) { make = {}; }
      let on = true; try { on = !d.on || d.on(); } catch (e) { on = false; }
      rows.push([k, J(Object.assign({ type: k }, make)) + '  – ' + en(d.label || k) + (on ? '' : '  (only when that game system is switched on)')]);
    }
    return rows.map(([k, v]) => `- \`${k}\`: \`${v}\``).join('\n');
  };
  const actionList = () => {
    const rows = [
      ['setVar', '{ "type": "setVar", "var": "<variable id>", "value": 5 }'],
      ['addVar', '{ "type": "addVar", "var": "<variable id>", "value": 1 }  (negative = subtract)'],
      ['giveItem', '{ "type": "giveItem", "item": "<item id>", "count": 1 }'],
      ['takeItem', '{ "type": "takeItem", "item": "<item id>", "count": 1 }'],
      ['money', '{ "type": "money", "currency": "<currency id>", "amount": 20 }  (negative = pay)'],
      ['loot', '{ "type": "loot", "table": "<loot table id>" }'],
      ['rel', '{ "type": "rel", "char": "<relation char id>", "amount": 10 }  – relationship points (needs Relationships on)'],
      ['gift', '{ "type": "gift", "char": "<relation char id>" }  – player chooses a gift'],
      ['charPic', '{ "type": "charPic", "id": "<unique id>", "char": "<relation char id>", "image": "<asset id>", "text": "Message", "style": "phone|bubble|window" }  – character sends a picture; it is added to the gallery'],
      ['time', '{ "type": "time", "mode": "advance", "amount": 1 }  (needs Time & Calendar on)'],
      ['shop', '{ "type": "shop", "shop": "<shop id>" }']
    ];
    for (const [k, d] of Object.entries(VN.ext.actions)) {
      let make = {};
      try { make = d.make ? d.make() : {}; } catch (e) { make = {}; }
      let on = true; try { on = !d.on || d.on(); } catch (e) { on = false; }
      rows.push([k, J(Object.assign({ type: k }, make)) + '  – ' + en(d.label || k) + (on ? '' : '  (only when that game system is switched on)')]);
    }
    return rows.map(([k, v]) => `- \`${k}\`: \`${v}\``).join('\n');
  };

  const systems = (p, generic) => {
    const sys = [['relations', 'Relationships (♥ points, stages, milestones with messages/pictures, gifts)'], ['time', 'Time & calendar'], ['economy', 'Money & shops'], ['quests', 'Quest log'], ['skills', 'Skill trees'], ['combat', 'Turn-based combat'], ['idle', 'Building / idle (buildings produce currencies)'], ['world', 'World map & locations'], ['equip', 'Equipment']];
    return sys.map(([k, l]) => `- \`${k}\` – ${l}` + (generic ? '' : `: ${p[k] && p[k].enabled ? '**on**' : 'off'}`)).join('\n');
  };

  const overview = (p) => {
    const out = [];
    out.push(`Title: **${p.title || ''}** · start scene: \`${p.startScene || ''}\` · languages: ${(p.languages || []).join(', ')} · resolution ${p.resolution ? p.resolution.w + '×' + p.resolution.h : ''}`);
    out.push('', '### Scenes', '| id | type | name | details |', '|---|---|---|---|');
    for (const s of p.scenes) {
      const det = s.type === 'story'
        ? `${s.beats} steps, ${(s.tracks.dialog || []).length} lines, next → ${s.next || '(end)'}${s.overHub ? ', plays over the hub' : ''}`
        : `${(s.objects || []).length} objects, ${(s.events || []).length} events`;
      out.push(`| \`${s.id}\` | ${s.type} | ${String(s.name || '').replace(/\|/g, '/')} | ${det} |`);
    }
    const tbl = (title, list, fn) => { if (!list || !list.length) return; out.push('', '### ' + title); for (const x of list.slice(0, 200)) out.push('- ' + fn(x)); };
    tbl('Variables', p.vars, (v) => `\`${v.id}\` ${v.name} (${v.type}, start ${J(v.start)})`);
    tbl('Items', p.items, (i) => `\`${i.id}\` ${i.name}`);
    tbl('Currencies', p.currencies, (c) => `\`${c.id}\` ${c.name} (start ${c.start || 0})`);
    if (p.relations && p.relations.chars) tbl('Relationship characters', p.relations.chars, (c) => `\`${c.id}\` ${c.name}`);
    tbl('Images', (p.assets || []).filter((a) => a.kind === 'image'), (a) => `\`${a.id}\` ${a.name} → ${a.file || ''}${a.gallery ? ' (gallery)' : ''}`);
    tbl('Audio', (p.assets || []).filter((a) => a.kind === 'audio'), (a) => `\`${a.id}\` ${a.name} → ${a.file || ''}`);
    return out.join('\n');
  };

  G.build = (opts = {}) => {
    const p = VN.project;
    const ver = (VN.Schema && VN.Schema.ENGINE) || '';
    const L = [];
    L.push(`# VN Timeline Engine – guide for AI assistants`, '',
      `Engine ${ver} · project format ${VN.Schema ? VN.Schema.CURRENT : ''} · generated ${new Date().toISOString().slice(0, 10)}`, '',
      'This file explains a VN Timeline Engine project so that any AI can read and change it **without the engine source code**. ',
      'The engine is a free visual novel editor that works like a video editor: every scene is a timeline, every column ("step") is one click of the player.', '');
    L.push('## Golden rules', '',
      '1. A project is a folder: `project.json` (everything) + `assets/` (images, audio, video, fonts). Paths in `project.json` are relative to the folder.',
      '2. **Close the project in the engine before you edit `project.json`** (or open another one). The engine saves automatically and would overwrite your changes. Re-open it afterwards – the engine checks and repairs the file and lists problems (✓ button, top bar).',
      '3. Every object has an `id`. IDs must be unique in the whole project. Re-use existing IDs when you refer to something; for new objects invent short unique IDs (e.g. `c_ai12`, `s_ai3`).',
      '4. Keep unknown fields as they are. Add fields only as shown here.',
      '5. Text the player sees may contain placeholders like `{name}` and tags like `{shake}…{/shake}`, `{b}…{/b}`, `{color=#f55}…{/color}`, `{pause=0.5}`.',
      '6. Easiest way to add a lot of dialogue: in the engine use **Project ▾ → Import text** and paste lines in the form `Name: Text` (or a Ren\'Py script). The engine creates the steps for you.', '');
    L.push('## project.json – top level', '',
      '`title`, `startScene` (scene id), `scenes` (array), `assets` (array of `{ id, kind: image|audio|video|font, name, file }`), `vars` (`{ id, name, type: num|flag|text, start }`), `items`, `currencies`, `lootTables`, `inventory`, `languages`, `translations` (`{ lang: { textId: { text } } }`), `mainMenu`, `theme`, `resolution`, `storyboard` (planning board, not part of the game) and one object per game system (see below). `schema`/`engine` = format and engine version – do not change.', '');
    L.push('## Story scenes (timelines)', '',
      '```json', J({ id: 's_ai1', type: 'story', name: 'Chapter 1 · The cellar', beats: 4, next: '<scene id> | "@return" | null', tracks: { bg: [], char1: [], char2: [], dialog: [], choice: [], music: [], voice: [], sfx: [], fx: [], cam: [], video: [] } }), '```', '',
      '- `beats` = number of steps. A clip covers steps `start` … `start + len − 1` (0-based).',
      '- `next` = scene after the last step. `"@return"` = back to the hub (or world location) the scene was started from. `null` = end of the game.',
      '- `overHub: true` = the scene plays on top of the hub it was started from (hub background and objects stay visible behind the characters).',
      '- Dialogue: one clip per step in `dialog` (`len: 1`). `speaker` empty = narrator. `chat: true` shows the line as a phone chat. `actions` run when the line appears. `waitFor: { conds, hint }` stops until the condition is met.',
      '- Choice: in `choice` at the step where it appears; each option has `text`, `target` (scene id or null = continue), `conds` (shown only if true), `actions`.',
      '- Characters: `x` 0–100 (% from left, centre of the figure), `y` height offset in %, `scale` %, `rot` degrees, `flip`. `keys: [{ beat, x, y, scale, rot, opacity }]` animate over steps.', '',
      '### Clip fields per track (defaults of the editor)', '', trackExamples(), '');
    L.push('## Hub scenes (free clicking)', '',
      '```json', J({ id: 'h_ai1', type: 'hub', name: 'Guild hall', bg: '<asset id>', music: null, objects: [{ id: 'o_ai1', name: 'Door', asset: '<asset id|null>', x: 70, y: 30, w: 12, h: 40, rot: 0, shape: 'rect', hover: 'glow', target: '<scene id|null>', message: '', conds: [], actions: [], styles: {} }], events: [] }), '```', '',
      '- Object position/size in % of the screen. `target` = scene opened on click. A story scene with `next: "@return"` returns to the hub afterwards.',
      '- Events run when the hub is entered: `{ id, trigger: "first"|"always"|"cond", conds, mode: "lines"|"scene", lines: [{ id, speaker, text, style: ""|"phone"|"note" }], scene: "<story scene id>" }`. `mode: "scene"` plays a whole timeline over the hub (characters, phone chat, choices) and comes back. `trigger: "cond"` fires once as soon as `conds` are true, also while the player is in the hub.', '');
    L.push('## Conditions (`conds` arrays – all must be true)', '', condList(), '', 'Operators: `>=`, `>`, `<=`, `<`, `==`, `!=`.', '');
    L.push('## Actions (`actions` arrays – run in order)', '', actionList(), '');
    L.push('## Game systems', '', systems(p, opts.generic), '',
      'Each system has `enabled: true|false` plus its own data. The safest way to set up a system is inside the engine (tab **Game systems / Spielsysteme**, every system has a one-click example). Idle/building (`idle`): `tick: "sec"|"min"|"hour"` (amounts per tick), `startWhen: "always"|"firstOpen"|"cond"|"action"` (+ `startConds`), `mode: "realtime"|"offline"|"gametime"`.', '');
    L.push('## Operating the program (for AIs that can see and click the screen)', '',
      'Top bar: project name · **Project ▾ / Projekt ▾** (save, open, import text, accessibility, language, this guide) · undo/redo · **Export / Exportieren** · ✓ problem list · ? help · tabs · **▶ Test scene / Szene testen** · **▶ Test game / Spiel testen**.', '',
      'Tabs: **Scene / Szene** (timeline or hub editor) · **Paths / Pfade** (graph of all scenes) · **Game systems / Spielsysteme** · **Transcript / Transkript** (all texts, translations) · **Storyboard** (planning board) · **Characters / Figuren** (bones, layered figures) · **Main menu / Hauptmenü** · **Design** · **Animation**.', '',
      'Left: scene list (+ Story, + Hub, + 📁 chapter) and files (drag images/audio onto the stage or timeline). Right: properties of whatever is selected. ',
      'Timeline: double-click an empty track cell = new clip; drag clips to move, right edge = length; right-click = more (keyframes, copy/paste format of a character, alternative path for a choice). Keys: Ctrl+S save, Ctrl+Z / Ctrl+Y undo/redo, ←/→ step, Del delete, Esc deselect.', '',
      'Every problem message has a 💡 button with explanation and fix buttons – use them instead of guessing.', '');
    if (!opts.generic) L.push('## This project right now', '', overview(p), '');
    L.push('---', 'Generated by the VN Timeline Engine (Project ▾ → AI guide). Regenerate after big changes so the overview stays current.');
    return L.join('\n');
  };

  G.open = () => {
    const text = G.build();
    const back = el('div', { class: 'modal-back', onclick: (ev) => { if (ev.target === back) back.remove(); } });
    const status = el('div', { class: 'muted small' });
    back.appendChild(el('div', { class: 'modal ai-modal', 'data-notr': '' },
      el('strong', { style: { fontSize: '16px' } }, '🤖 ' + VN.t('Anleitung für KI')),
      el('div', { class: 'muted small' }, VN.t('Damit ChatGPT, Gemini, Grok, Claude & Co. dein Projekt verstehen und bearbeiten können – ganz ohne Quellcode der Engine. Die Anleitung beschreibt das Dateiformat, alle Bedingungen und Aktionen, die Oberfläche und eine Übersicht deines Projekts. Gib der KI den Projektordner (mit dieser Datei) oder füge den Text in den Chat ein.')),
      el('pre', { class: 'ai-pre' }, text.slice(0, 2400) + (text.length > 2400 ? '\n…' : '')),
      el('div', { class: 'muted small' }, VN.tf('{n} Zeichen · wird jedes Mal frisch aus der Engine erzeugt', { n: text.length.toLocaleString() })),
      status,
      el('div', { class: 'row gap8', style: { justifyContent: 'flex-end', flexWrap: 'wrap' } },
        el('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(text); status.textContent = '✓ ' + VN.t('In die Zwischenablage kopiert'); } catch (e) { status.textContent = VN.t('Kopieren ging nicht – bitte „Speichern unter …“ benutzen.'); } } }, '📋 ' + VN.t('Kopieren')),
        el('button', { class: 'btn', onclick: () => VN.api.saveText('AI-GUIDE.md', text, 'md') }, VN.t('Speichern unter …')),
        el('button', { class: 'btn primary', onclick: async () => { const ok = VN.api.writeGuide ? await VN.api.writeGuide(text) : false; status.textContent = ok ? '✓ ' + VN.t('AI-GUIDE.md liegt jetzt im Projektordner') : VN.t('Konnte nicht in den Projektordner schreiben – bitte „Speichern unter …“ benutzen.'); } }, '📁 ' + VN.t('In den Projektordner legen')))));
    document.body.appendChild(back);
  };
})();
