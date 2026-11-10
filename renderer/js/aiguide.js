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
    const sys = [['relations', 'Relationships (♥ points, stages, milestones with messages/pictures, gifts)'], ['time', 'Time & calendar'], ['economy', 'Money & shops'], ['quests', 'Quest log'], ['skills', 'Skill trees'], ['combat', 'Turn-based combat'], ['idle', 'Building / idle (buildings produce currencies)'], ['world', 'World map & locations'], ['equip', 'Equipment'], ['devices', 'Devices: in-game phone / computer with apps; chats live in `chats`']];
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
      '```json', J({ id: 's_ai1', type: 'story', name: 'Chapter 1 · The cellar', beats: 4, next: '<scene id> | "@return" | null', tracks: { bg: [], char1: [], char2: [], dialog: [], choice: [], code: [], music: [], voice: [], sfx: [], fx: [], cam: [], video: [] } }), '```', '',
      '- `beats` = number of steps. A clip covers steps `start` … `start + len − 1` (0-based).',
      '- `next` = scene after the last step. `"@return"` = back to the hub (or world location) the scene was started from. `null` = end of the game.',
      '- `overHub: true` = the scene plays on top of the hub it was started from (hub background and objects stay visible behind the characters).',
      '- Dialogue: one clip per step in `dialog` (`len: 1`). `speaker` empty = narrator. `chat: true` shows the line as a phone chat. `actions` run when the line appears. `waitFor: { conds, hint }` stops until the condition is met.',
      '- Choice: in `choice` at the step where it appears; each option has `text`, `target` (scene id or null = continue), `conds` (shown only if true), `actions`, optional `afterPick: "grey"|"hide"|"none"` (what happens once picked). The choice clip may have `chX` (horizontal centre in %, default 50), `chY` (vertical centre in %, default from the design) and `chW` (width in %), `afterPick` (default for all options) and `allDone` (scene when every option is hidden).',
      '- Characters: `x` 0–100 (% from left, centre of the figure), `y` height offset in %, `scale` %, `rot` degrees, `flip`. `keys: [{ beat, x, y, scale, rot, opacity }]` animate over steps. Animation: `idleAnim: "<anim id>"`, `gestures: { "<step>": "<anim id>" }`, `fps` (own frame rate, see Animations) and `smear: { on, multi, stretch, lines, sens }`. Instead of `asset` a character can use `puppet: "<puppet id>"` (jointed puppet) or `set: "<layered character id>"` (from `figures`).',
      '- Code track `code`: `{ start, len: 1, code: "gold += 5" }` runs once when its step begins, before the dialogue line appears (so `{gold}` in the text already shows the new value). Language: see **Formulas and code** below.',
      '- Effect track `fx` (and extra effect tracks): a clip is a colour/image layer (`color`, `asset`, `blend`, `opacity`) or one of: `particles: "rain"|"snow"|…`, `filter: ' + (window.Fx && Fx.FILTERS ? Fx.FILTERS.map((x) => '"' + x[0] + '"').join('|') : '"bw"|"crt"|…') + '` (CRT/LCD/RGB split TV filters have their own sliders), `eyes` (eyes closing/opening), or `light: "spot"|"lamp"|"neon"|"back"` with `lx`, `ly` (position in %), `lSize`, `lAngle`, `lLen`, `lSpread`, `lColor`, `lPower`, `lSoft`, `lDim` (darkens the rest), `lFog`, `lRim` (rim light on characters), `lTint`, `lFlicker`, `lSweep`, `lDust`, `lSil` (backlight silhouette). Hubs have the same lights in `fx` with `conds`. Easiest: place lights with the mouse in the editor.', '',
      '### Clip fields per track (defaults of the editor)', '', trackExamples(), '');
    L.push('## Hub scenes (free clicking)', '',
      '```json', J({ id: 'h_ai1', type: 'hub', name: 'Guild hall', bg: '<asset id>', music: null, objects: [{ id: 'o_ai1', name: 'Door', asset: '<asset id|null>', x: 70, y: 30, w: 12, h: 40, rot: 0, shape: 'rect', hover: 'glow', target: '<scene id|null>', message: '', conds: [], actions: [], styles: {} }], events: [] }), '```', '',
      '- Object position/size in % of the screen. `target` = scene opened on click. `invisible: true` = clickable area only. A story scene with `next: "@return"` returns to the hub afterwards. `bgSlots: { "<time slot index>": "<asset id>" }` = background per time of day. `fx: [{ id, particles: "rain"|"snow"|"dust"|"sparks"|"petals"|"fireflies", density, speed, size, wind, color, conds }]` = particles over the hub.',
      '- Assets may have `folder` ("Characters/Ray") – only for the editor file list. Minigame plugin actions can have `onWin` / `onLose` (scene id, hub id or "@gameover") and `winActs` / `loseActs` (action lists run when the minigame ends – rewards like giveItem, money, rel, socialFollowers); `gameOver: { title, text, bg, retry }` on the project sets the game-over screen. Hub objects can idle: `idle` ("float"|"bob"|"breathe"|"sway"|"wind"|"pulse"|"flicker"|"shake"|"spin"), `idleSpeed` (seconds), `idleAmt` (0–20); `bones: true` animates an image that has bones (optional `idleAnim`). Website elements: `blend` (CSS mix-blend-mode), `blur` (0–20), `blurConds` (sharp once true), `blurHint`. `time.seasonsOn`, `time.seasons`, `time.seasonDays`, `time.ambient: [{ id, asset, slot, season, where: "all"|"hubs"|"<scene id>", vol }]`.',
      '- Events run when the hub is entered: `{ id, trigger: "first"|"always"|"cond", conds, mode: "lines"|"scene", lines: [{ id, speaker, text, style: ""|"phone"|"note" }], scene: "<story scene id>" }`. `mode: "scene"` plays a whole timeline over the hub (characters, phone chat, choices) and comes back. `when: "enter"|"cond"` (cond = as soon as `conds` are true, also while the player is in the hub) and `repeat: "once"|"always"|"times"|"daily"` (+ `times`) set how often it runs – never twice in one visit. Older projects use `trigger: "first"|"always"|"cond"`, which still works.', '');
    L.push('## Jointed puppets (characters made of body parts)', '',
      '`puppets: [{ id, name, parts: [...], folders: [...], freeJoints }]`. Each part: `{ id, name, asset, parent: "<part id>"|null, x, y, w, h, ax, ay, rot, idle: { type: "none"|"sway"|"breathe"|"bob"|"jiggle", amp, speed, phase }, bones: true|false, flipX, hidden, folder, lim, tx, ty, seams, holdPts }`.',
      '- `x`, `y` = top-left of the image in puppet pixels (rest pose), `w`, `h` = drawn size, `ax`, `ay` = joint pin inside the image. A part rotates around its pin; children follow their parent. Array order = drawing order (last = front). Joints are anchored firmly unless `freeJoints: true`.',
      '- `lim: { on, min, max }` = joint limit in degrees (knees/elbows bend one way). `tx`, `ty` = end point of the limb (ruler tool “Lengths”; without it the limb reaches to its child joint).',
      '- `seams: [{ id, to: "<part id>", pts: [[u, v], …], soft }]` sew this part onto another one along a line (image pixels of this part) – the image bends smoothly, no cracks at joints. `holdPts: [{ id, u, v, soft }]` = hold points (palm, heel …) that can be held in place in the animation editor.',
      '- Folders: `folders: [{ id, name, parent: "<folder id>"|null, open, hidden, locked }]`, part `folder: "<folder id>"`. Only for sorting and drawing order (parts of one folder are kept together); `hidden`/`locked` only apply in the editor. Movement is always set by `parent`.',
      '- Use on the timeline: a character clip with `puppet: "<puppet id>"` (instead of `asset`). Idle/gesture animations: an actor with `puppet: "<puppet id>"` and `parts: { "<part id>": [{ t, r, x, y, e }] }` (r = rotation in degrees, x/y = offset in pixels); optional `pins: { "<part id>": true }` keeps limbs in place in the editor, `holds: { "<hold point id>": { x, y } }` holds a hold point at a spot on screen (0–1), `seams: [{ id, part, pts, toActor, toPart, soft }]` sews a part to a part of another actor (e.g. a hand on a shoulder).',
      '- Puppets are easiest to build in the editor (**Characters → Jointed puppets**: template “Human”, inpaint brush for gaps, sew, hold points, folders).', '');
    L.push('## Bones (one image that bends)', '',
      '`rigs: { "<image asset id>": { … } }` – skeleton and mesh of an image, set up under **Characters → Bones & blinking**. Don’t write rigs by hand; keep them unchanged. `cellEdit: { nx, ny, add: [cell index …], del: [cell index …] }` stores manual mesh edits for one mesh density. Layered characters (`figures`) use the bones of their lowest layer for all layers.', '');
    L.push('## Animations (idle, gestures, cutscenes, battle moves)', '',
      '`anims: [{ id, name, type: "idle"|"gesture"|"cutscene", dur (seconds), loop, fps, smear, hitAt, actors: [...], cam: [...], audio: [...] }]`.',
      '- Actor: `{ id, asset: "<image with bones>" | puppet: "<puppet id>", bones: { "<bone name>": [{ t, a, e }] } }` (a = angle, e = easing: "ease-in-out", "ease-in", "ease-out", "linear", "smooth", "back", "bounce", "hold" or a custom Bézier curve "cb:x1,y1,x2,y2" – the same values work for `ease` on scene keyframes and camera clips) or `parts` for puppets (see above).',
      '- `fps`: `0`/empty = smooth, `24`, `12` (on twos, anime), `8` (on threes, cartoon), `6`. Project default: `animFps`. `smear: { on, multi, stretch, lines, sens }` = smear frames on fast motion; project default: `smear`.',
      '- `hitAt` (seconds) = the moment where effect, damage and sound appear when the animation is used in battle (default: halfway).', '');
    L.push('## Formulas and code', '',
      'Used by the code track, the action `code` (`{ "type": "code", "code": "…" }`) and the condition `formula` (`{ "type": "formula", "expr": "…" }`). Variables, items, currencies and scenes are referred to **by name**, not id; names with spaces go in square brackets.',
      '```', 'gold += 5                      # also -= *= /= and =', '[Door open] = true             # true/false, wahr/falsch, ja/nein', 'if courage > 3 and not fled: points += 1', 'give("Key")   take("Potion", 2)   earn("Gold", 10)   spend("Gold", 3)', 'goto("Market")                 # jump to a scene or hub', 'roll = random(1, 6)', '```',
      'One statement per line, `#` = comment. Operators: `+ - * / % **`, `== != < <= > >=`, `and`/`und`, `or`/`oder`, `not`/`nicht`. Functions: `min`, `max`, `round`, `floor`, `ceil`, `abs`, `random(a, b)`, `chance(percent)`, `item("name")` (count), `money("currency")`, `seen("scene")`. A formula condition with an error counts as not met. Number variables respect their `min`/`max`.', '');
    L.push('## Pixel art', '',
      '`sprites: [{ id, name, w, h, palette: [null, "#rrggbb", …] (index 0 = transparent), layers: [{ id, name, hidden }], anims: [{ id, name, frames: [{ id, dur (ms), px: { "<layer id>": "<base64 of palette indices, w × h bytes>" } }] }], scale, "asset_<anim id>": "<image asset id>", sheetAsset }]`.',
      '- Drawn in **Design → 🎨 Pixel art**. “Add to project” writes each animation as an animated GIF (`assets/px_….gif`) and an image asset with `pixel: true`; that asset is used like any other image (character, background, hub object, fighter). Change sprites in the editor, not in `px`.', '');
    L.push('## Conditions (`conds` arrays – all must be true)', '', condList(), '', 'Operators: `>=`, `>`, `<=`, `<`, `==`, `!=`.', '');
    L.push('## Actions (`actions` arrays – run in order)', '', actionList(), '');
    L.push('## Game systems', '', systems(p, opts.generic), '',
      '- World (`world`): locations can have `unlock: "cond"` + `unlockConds` (unlocked for good once true), `lockMode: "lock"` + `lockConds` (locked while true) or `lockMode: "gone"` + `lockConds` (removed from the map for good once true).',
      '- Combat (`combat`: `heroes`, `enemies`, `skills`, `battles`, `party` …): a fighter may have `puppet`, `idleAnim`, `anims: { attack, cast, hit, defend, item, ko, victory }` (gesture anim ids), `blend` (seconds of blending out of the idle), `fps`, `smear`. A skill may have `anim` (attacker), `hitAnim` (target reaction) and `blend`. Animations need an image with bones or a puppet.', '',
      'Each system has `enabled: true|false` plus its own data. The safest way to set up a system is inside the engine (tab **Game systems / Spielsysteme**, every system has a one-click example). Idle/building (`idle`): `tick: "sec"|"min"|"hour"` (amounts per tick), `startWhen: "always"|"firstOpen"|"cond"|"action"` (+ `startConds`), `mode: "realtime"|"offline"|"gametime"`.', '');
    L.push('## Devices and chats (phone / computer)', '',
      '`devices: { enabled, list: [{ id, name, kind: "phone"|"desktop", key, hud, inMenu, conds, lock: { on, code, mode: "once"|"always", title, hint }, wallpaper, frame, clock: "auto"|"game"|"real"|"none", look: { accent, screen, text, panel, panelText, bubble, bubbleMe, iconShape, size, side, dim, inset, font }, apps: [...] }] }`.',
      '- App: `{ id, type, name, icon, image, color, conds }`. `type`: `messages`, `inv`, `rel`, `gallery`, `quests`, `map`, `ach`, `skills`, `stats`, `log`, `idle` (built-in screens) or `app` (own app: `title`, `text`, `pic` = a page; `actions` run when opened – a `goto` action closes the device and jumps).',
      '- Open it with the action `device` (e.g. on a hub object = hitbox), the HUD button, the key or the pause menu.',
      '`chats: { notify, sound, contacts: [{ id, name, char: "<relationship char id>", avatar, color, status }], threads: [{ id, name, contact, auto, silent (no notification/unread count), conds, devs: ["<device id>"] (empty = all devices), msgs: [{ id, from: "them"|"me", text, image, conds, actions (run once when the message is read) }], replies: [{ id, text, conds, actions, next: "<thread id>" }] }] }`.',
      '- A thread is delivered automatically (`auto: true`, as soon as `conds` are true) or with the action `chatSend`. Lines with `conds` are only delivered when true (route variants). The player picks one of the `replies`; its `actions` run and `next` delivers the follow-up thread. History is kept in the save game across scenes. Check with the condition `chat` (`state`: got, not, read, open, replied + `reply`). Dialogue lines with `chat: true` whose speaker is a contact are added to that chat history too.', '');
    L.push('## Operating the program (for AIs that can see and click the screen)', '',
      'Top bar: project name · **Project ▾ / Projekt ▾** (save, open, import text, accessibility, language, this guide) · undo/redo · **Export / Exportieren** · ✓ problem list · ? help · tabs · **▶ Test scene / Szene testen** · **▶ Test game / Spiel testen**.', '',
      'Tabs: **Scene / Szene** (timeline or hub editor) · **Paths / Pfade** (graph of all scenes) · **Game systems / Spielsysteme** · **Transcript / Transkript** (all texts, translations) · **Storyboard** (planning board) · **Characters / Figuren** (Bones & blinking, Layers & outfits, Jointed puppets, Lip sync) · **Main menu / Hauptmenü** · **Design** (speech bubbles, buttons, windows, fonts, sounds, cursor, start logo, 🎨 Pixel art) · **Animation** (idle, gestures, cutscenes, frame rate, smear frames, “💥 Hit here”).', '',
      'Export: `export.pack` = `"open"` (normal files), `"pack"` (everything encrypted in data.vnpak) or `"packmods"` (packed, files in a `mods` folder override). The editor also runs in the browser: https://thetalkingpegasus.github.io/vn-timeline-engine/', '',
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
