# VN Timeline Engine – guide for AI assistants

Engine 0.9.30 · project format 1 · generated 2026-11-12

This file explains a VN Timeline Engine project so that any AI can read and change it **without the engine source code**. 
The engine is a free visual novel editor that works like a video editor: every scene is a timeline, every column ("step") is one click of the player.

## Golden rules

1. A project is a folder: `project.json` (everything) + `assets/` (images, audio, video, fonts). Paths in `project.json` are relative to the folder.
2. **Close the project in the engine before you edit `project.json`** (or open another one). The engine saves automatically and would overwrite your changes. Re-open it afterwards – the engine checks and repairs the file and lists problems (✓ button, top bar).
3. Every object has an `id`. IDs must be unique in the whole project. Re-use existing IDs when you refer to something; for new objects invent short unique IDs (e.g. `c_ai12`, `s_ai3`).
4. Keep unknown fields as they are. Add fields only as shown here.
5. Text the player sees may contain placeholders like `{name}` and tags like `{shake}…{/shake}`, `{b}…{/b}`, `{color=#f55}…{/color}`, `{pause=0.5}`.
6. Easiest way to add a lot of dialogue: in the engine use **Project ▾ → Import text** and paste lines in the form `Name: Text` (or a Ren'Py script). The engine creates the steps for you.

## project.json – top level

`title`, `startScene` (scene id), `scenes` (array), `assets` (array of `{ id, kind: image|audio|video|font, name, file }`), `vars` (`{ id, name, type: num|flag|text, start }`), `items`, `currencies`, `lootTables`, `inventory`, `languages`, `translations` (`{ lang: { textId: { text } } }`), `mainMenu`, `theme`, `resolution`, `storyboard` (planning board, not part of the game) and one object per game system (see below). `schema`/`engine` = format and engine version – do not change.

## Story scenes (timelines)

```json
{"id":"s_ai1","type":"story","name":"Chapter 1 · The cellar","beats":4,"next":"<scene id> | \"@return\" | null","tracks":{"bg":[],"char1":[],"char2":[],"dialog":[],"choice":[],"code":[],"music":[],"voice":[],"sfx":[],"fx":[],"cam":[],"video":[]}}
```

- `beats` = number of steps. A clip covers steps `start` … `start + len − 1` (0-based).
- `next` = scene after the last step. `"@return"` = back to the hub (or world location) the scene was started from. `null` = end of the game.
- `overHub: true` = the scene plays on top of the hub it was started from (hub background and objects stay visible behind the characters).
- Dialogue: one clip per step in `dialog` (`len: 1`). `speaker` empty = narrator. `chat: true` shows the line as a phone chat. `actions` run when the line appears. `waitFor: { conds, hint }` stops until the condition is met.
- Choice: in `choice` at the step where it appears; each option has `text`, `target` (scene id or null = continue), `conds` (shown only if true), `actions`, optional `afterPick: "grey"|"hide"|"none"` (what happens once picked). The choice clip may have `chX` (horizontal centre in %, default 50), `chY` (vertical centre in %, default from the design) and `chW` (width in %), `afterPick` (default for all options) and `allDone` (scene when every option is hidden).
- Characters: `x` 0–100 (% from left, centre of the figure), `y` height offset in %, `scale` %, `rot` degrees, `flip`. `keys: [{ beat, x, y, scale, rot, opacity }]` animate over steps. Animation: `idleAnim: "<anim id>"`, `gestures: { "<step>": "<anim id>" }`, `fps` (own frame rate, see Animations) and `smear: { on, multi, stretch, lines, sens }`. Instead of `asset` a character can use `puppet: "<puppet id>"` (jointed puppet) or `set: "<layered character id>"` (from `figures`).
- Code track `code`: `{ start, len: 1, code: "gold += 5" }` runs once when its step begins, before the dialogue line appears (so `{gold}` in the text already shows the new value). Language: see **Formulas and code** below.
- Effect track `fx` (and extra effect tracks): a clip is a colour/image layer (`color`, `asset`, `blend`, `opacity`) or one of: `particles: "rain"|"snow"|…`, `filter: "flashback"|"bw"|"dream"|"cold"|"warm"|"crt"|"lcd"|"rgb"` (CRT/LCD/RGB split TV filters have their own sliders), `eyes` (eyes closing/opening), or `light: "spot"|"lamp"|"neon"|"back"` with `lx`, `ly` (position in %), `lSize`, `lAngle`, `lLen`, `lSpread`, `lColor`, `lPower`, `lSoft`, `lDim` (darkens the rest), `lFog`, `lRim` (rim light on characters), `lTint`, `lFlicker`, `lSweep`, `lDust`, `lSil` (backlight silhouette). Hubs have the same lights in `fx` with `conds`. Easiest: place lights with the mouse in the editor.

### Clip fields per track (defaults of the editor)

- `bg` – Background / Hintergrund (bg): `{"id":"<unique id>","start":0,"len":3,"asset":null,"trans":"cut","dur":1}`
- `char1` – Character 1 / Figur 1 (char): `{"id":"<unique id>","start":0,"len":3,"asset":null,"x":30,"scale":100,"trans":"cut","dur":0.6,"idle":"breathe","flip":false}`
- `char2` – Character 2 / Figur 2 (char): `{"id":"<unique id>","start":0,"len":3,"asset":null,"x":70,"scale":100,"trans":"cut","dur":0.6,"idle":"breathe","flip":false}`
- `fx` – Effect layer / Effekt-Ebene (fx): `{"id":"<unique id>","start":0,"len":3,"asset":null,"color":"#3c4a8c","blend":"multiply","opacity":85,"styles":{}}`
- `cam` – Camera / Kamera (cam): `{"id":"<unique id>","start":0,"len":3,"zoom":130,"panX":0,"panY":-8,"rot":0,"shake":0,"dur":1.2,"ease":"ease-in-out","keys":[]}`
- `video` – Video (video): `{"id":"<unique id>","start":0,"len":1,"asset":null,"layer":"front","loop":false,"muted":false,"vol":90,"fit":"cover","waitEnd":true,"skippable":true}`
- `dialog` – Dialogue / Dialog (dialog): `{"id":"<unique id>","start":0,"len":1,"speaker":"","color":"#ffffff","text":"Neuer Text …","speed":40,"actions":[]}`
- `choice` – Choice / Auswahl (choice): `{"id":"<unique id>","start":0,"len":1,"options":[{"id":"opt_1olhb","text":"Antwort A","target":null,"conds":[],"actions":[]},{"id":"opt_1p47j","text":"Antwort B","target":null,"conds":[],"actions":[]}]}`
- `code` – Code (code): `{"id":"<unique id>","start":0,"len":1,"code":""}`
- `music` – Music / Musik (music): `{"id":"<unique id>","start":0,"len":3,"asset":null,"vol":70,"loop":true,"carry":false,"fade":1}`
- `voice` – Voices (voice): `{"id":"<unique id>","start":0,"len":1,"asset":null,"vol":90,"delay":0}`
- `sfx` – Sound effects / Soundeffekte (sfx): `{"id":"<unique id>","start":0,"len":1,"asset":null,"vol":90,"delay":0}`

## Hub scenes (free clicking)

```json
{"id":"h_ai1","type":"hub","name":"Guild hall","bg":"<asset id>","music":null,"objects":[{"id":"o_ai1","name":"Door","asset":"<asset id|null>","x":70,"y":30,"w":12,"h":40,"rot":0,"shape":"rect","hover":"glow","target":"<scene id|null>","message":"","conds":[],"actions":[],"styles":{}}],"events":[]}
```

- Object position/size in % of the screen. `target` = scene opened on click. `invisible: true` = clickable area only. A story scene with `next: "@return"` returns to the hub afterwards. `bgSlots: { "<time slot index>": "<asset id>" }` = background per time of day. `fx: [{ id, particles: "rain"|"snow"|"dust"|"sparks"|"petals"|"fireflies", density, speed, size, wind, color, conds }]` = particles over the hub.
- Assets may have `folder` ("Characters/Ray") – only for the editor file list. Minigame plugin actions can have `onWin` / `onLose` (scene id, hub id or "@gameover") and `winActs` / `loseActs` (action lists run when the minigame ends – rewards like giveItem, money, rel, socialFollowers); `gameOver: { title, text, bg, retry }` on the project sets the game-over screen. Hub objects can idle: `idle` ("float"|"bob"|"breathe"|"sway"|"wind"|"pulse"|"flicker"|"shake"|"spin"), `idleSpeed` (seconds), `idleAmt` (0–20); `bones: true` animates an image that has bones (optional `idleAnim`). Website elements: `blend` (CSS mix-blend-mode), `blur` (0–20), `blurConds` (sharp once true), `blurHint`. Contacts: `folCur` (currency id = followers), `folGrow: [{ when: "day"|"week"|"weekday", wd, mode: "pct"|"add", amount, conds }]`. `liveChats: [{ id, name, title, viewers, pos, users: [{ id, name, color }], msgs: [{ id, user, text, gap }], replies: [{ id, text, at, conds, actions }] }]` with action `{ type: "liveChat", op: "start"|"stop", chat }`. `stamina: { enabled, max, start, style, costMinigame, costTravel, regenSlot, refillDay, tired: {...}, empty: { mode: "sleep"|"none", scene } }` with action `{ type: "stamina", op: "add"|"pct"|"set", amount }`. Cutscene actors: `mask: { on, shape: "rect"|"ellipse"|"poly", invert, pts, x, y, w, h, rot, keys }`. `time.seasonsOn`, `time.seasons`, `time.seasonDays`, `time.ambient: [{ id, asset, slot, season, where: "all"|"hubs"|"<scene id>", vol }]`.
- Events run when the hub is entered: `{ id, trigger: "first"|"always"|"cond", conds, mode: "lines"|"scene", lines: [{ id, speaker, text, style: ""|"phone"|"note" }], scene: "<story scene id>" }`. `mode: "scene"` plays a whole timeline over the hub (characters, phone chat, choices) and comes back. `when: "enter"|"cond"` (cond = as soon as `conds` are true, also while the player is in the hub) and `repeat: "once"|"always"|"times"|"daily"` (+ `times`) set how often it runs – never twice in one visit. Older projects use `trigger: "first"|"always"|"cond"`, which still works.

## Jointed puppets (characters made of body parts)

`puppets: [{ id, name, parts: [...], folders: [...], freeJoints }]`. Each part: `{ id, name, asset, parent: "<part id>"|null, x, y, w, h, ax, ay, rot, idle: { type: "none"|"sway"|"breathe"|"bob"|"jiggle", amp, speed, phase }, bones: true|false, flipX, hidden, folder, lim, tx, ty, seams, holdPts }`.
- `x`, `y` = top-left of the image in puppet pixels (rest pose), `w`, `h` = drawn size, `ax`, `ay` = joint pin inside the image. A part rotates around its pin; children follow their parent. Array order = drawing order (last = front). Joints are anchored firmly unless `freeJoints: true`.
- `lim: { on, min, max }` = joint limit in degrees (knees/elbows bend one way). `tx`, `ty` = end point of the limb (ruler tool “Lengths”; without it the limb reaches to its child joint).
- `seams: [{ id, to: "<part id>", pts: [[u, v], …], soft }]` sew this part onto another one along a line (image pixels of this part) – the image bends smoothly, no cracks at joints. `holdPts: [{ id, u, v, soft }]` = hold points (palm, heel …) that can be held in place in the animation editor.
- Folders: `folders: [{ id, name, parent: "<folder id>"|null, open, hidden, locked }]`, part `folder: "<folder id>"`. Only for sorting and drawing order (parts of one folder are kept together); `hidden`/`locked` only apply in the editor. Movement is always set by `parent`.
- Use on the timeline: a character clip with `puppet: "<puppet id>"` (instead of `asset`). Idle/gesture animations: an actor with `puppet: "<puppet id>"` and `parts: { "<part id>": [{ t, r, x, y, e }] }` (r = rotation in degrees, x/y = offset in pixels); optional `pins: { "<part id>": true }` keeps limbs in place in the editor, `holds: { "<hold point id>": { x, y } }` holds a hold point at a spot on screen (0–1), `seams: [{ id, part, pts, toActor, toPart, soft }]` sews a part to a part of another actor (e.g. a hand on a shoulder).
- Puppets are easiest to build in the editor (**Characters → Jointed puppets**: template “Human”, inpaint brush for gaps, sew, hold points, folders).

## Bones (one image that bends)

`rigs: { "<image asset id>": { … } }` – skeleton and mesh of an image, set up under **Characters → Bones & blinking**. Don’t write rigs by hand; keep them unchanged. `cellEdit: { nx, ny, add: [cell index …], del: [cell index …] }` stores manual mesh edits for one mesh density. Layered characters (`figures`) use the bones of their lowest layer for all layers.

## Animations (idle, gestures, cutscenes, battle moves)

`anims: [{ id, name, type: "idle"|"gesture"|"cutscene", dur (seconds), loop, fps, smear, hitAt, actors: [...], cam: [...], audio: [...] }]`.
- Actor: `{ id, asset: "<image with bones>" | puppet: "<puppet id>", bones: { "<bone name>": [{ t, a, e }] } }` (a = angle, e = easing: "ease-in-out", "ease-in", "ease-out", "linear", "smooth", "back", "bounce", "hold" or a custom Bézier curve "cb:x1,y1,x2,y2" – the same values work for `ease` on scene keyframes and camera clips) or `parts` for puppets (see above).
- `fps`: `0`/empty = smooth, `24`, `12` (on twos, anime), `8` (on threes, cartoon), `6`. Project default: `animFps`. `smear: { on, multi, stretch, lines, sens }` = smear frames on fast motion; project default: `smear`.
- `hitAt` (seconds) = the moment where effect, damage and sound appear when the animation is used in battle (default: halfway).

## Formulas and code

Used by the code track, the action `code` (`{ "type": "code", "code": "…" }`) and the condition `formula` (`{ "type": "formula", "expr": "…" }`). Variables, items, currencies and scenes are referred to **by name**, not id; names with spaces go in square brackets.
```
gold += 5                      # also -= *= /= and =
[Door open] = true             # true/false, wahr/falsch, ja/nein
if courage > 3 and not fled: points += 1
give("Key")   take("Potion", 2)   earn("Gold", 10)   spend("Gold", 3)
goto("Market")                 # jump to a scene or hub
roll = random(1, 6)
```
One statement per line, `#` = comment. Operators: `+ - * / % **`, `== != < <= > >=`, `and`/`und`, `or`/`oder`, `not`/`nicht`. Functions: `min`, `max`, `round`, `floor`, `ceil`, `abs`, `random(a, b)`, `chance(percent)`, `item("name")` (count), `money("currency")`, `seen("scene")`. A formula condition with an error counts as not met. Number variables respect their `min`/`max`.

## Pixel art

`sprites: [{ id, name, w, h, palette: [null, "#rrggbb", …] (index 0 = transparent), layers: [{ id, name, hidden }], anims: [{ id, name, frames: [{ id, dur (ms), px: { "<layer id>": "<base64 of palette indices, w × h bytes>" } }] }], scale, "asset_<anim id>": "<image asset id>", sheetAsset }]`.
- Drawn in **Design → 🎨 Pixel art**. “Add to project” writes each animation as an animated GIF (`assets/px_….gif`) and an image asset with `pixel: true`; that asset is used like any other image (character, background, hub object, fighter). Change sprites in the editor, not in `px`.

## Conditions (`conds` arrays – all must be true)

- `var`: `{ "type": "var", "var": "<variable id>", "op": ">=", "value": 2 }  (flags: "value": true/false)`
- `item`: `{ "type": "item", "item": "<item id>", "op": ">=", "count": 1 }`
- `money`: `{ "type": "money", "currency": "<currency id>", "op": ">=", "amount": 50 }`
- `seen`: `{ "type": "seen", "scene": "<scene id>", "value": true }`
- `formula`: `{"type":"formula","expr":""}  – 🧮 Formula / 🧮 Formel`
- `know`: `{"type":"know","key":"","value":true}  – 🧠 Knowledge (across playthroughs) / 🧠 Wissen (über Durchläufe)`
- `seenEver`: `{"type":"seenEver","scene":""}  – 🧠 Scene ever seen (any playthrough) / 🧠 Szene je gesehen (irgendein Durchlauf)`
- `ach`: `{"type":"ach","ach":""}  – 🏆 Achievement unlocked / 🏆 Erfolg freigeschaltet  (only when that game system is switched on)`
- `did`: `{"type":"did","what":"screen","key":"inv"}  – ✔ Player has done … / ✔ Spieler hat … getan`
- `worn`: `{"type":"worn","item":"","value":true}  – 👕 Wears item / 👕 Trägt Gegenstand  (only when that game system is switched on)`
- `slotUsed`: `{"type":"slotUsed","slot":"","value":true}  – 👕 Slot filled / 👕 Platz belegt  (only when that game system is switched on)`
- `atLoc`: `{"type":"atLoc","scene":""}  – 📍 Player is at location / 📍 Spieler ist am Ort  (only when that game system is switched on)`
- `locOpen`: `{"type":"locOpen","scene":"","value":true}  – 📍 Location unlocked / 📍 Ort freigeschaltet  (only when that game system is switched on)`
- `freeTime`: `{"type":"freeTime","value":true}  – 📍 Free time / 📍 Freie Zeit  (only when that game system is switched on)`
- `quest`: `{"type":"quest","ref":"","state":"done"}  – 📜 Quest status / 📜 Quest-Stand  (only when that game system is switched on)`
- `skill`: `{"type":"skill","ref":"","level":1}  – 🌳 Skill bought / 🌳 Skill gekauft  (only when that game system is switched on)`
- `battleWon`: `{"type":"battleWon","battle":"","value":true}  – ⚔ Battle won / ⚔ Kampf gewonnen  (only when that game system is switched on)`
- `battleLost`: `{"type":"battleLost","battle":""}  – ⚔ Battle lost or fled / ⚔ Kampf verloren oder geflohen  (only when that game system is switched on)`
- `inParty`: `{"type":"inParty","hero":"","value":true}  – ⚔ Hero in the party / ⚔ Held in der Gruppe  (only when that game system is switched on)`
- `heroLevel`: `{"type":"heroLevel","hero":"","level":2}  – ⚔ Level of a hero / ⚔ Stufe eines Helden  (only when that game system is switched on)`
- `idleLevel`: `{"type":"idleLevel","building":"","level":1}  – 🏰 Building level / 🏰 Gebäude-Stufe  (only when that game system is switched on)`
- `idleGoal`: `{"type":"idleGoal","ms":""}  – 🏰 Building goal reached / 🏰 Aufbau-Ziel erreicht  (only when that game system is switched on)`
- `idleRunning`: `{"type":"idleRunning"}  – 🏰 Building is running / 🏰 Aufbau läuft  (only when that game system is switched on)`
- `chat`: `{"type":"chat","thread":"","state":"got","reply":""}  – 💬 Message / 💬 Nachricht  (only when that game system is switched on)`
- `devOpen`: `{"type":"devOpen","device":"","value":true}  – 🔓 Device unlocked / 🔓 Gerät entsperrt  (only when that game system is switched on)`
- `socialFollowers`: `{"type":"socialFollowers","contact":"","cmp":">=","value":1000}  – 👥 Followers / 👥 Follower  (only when that game system is switched on)`
- `webVisited`: `{"type":"webVisited","addr":""}  – 🌐 Web page visited / 🌐 Webseite besucht  (only when that game system is switched on)`
- `webUnlocked`: `{"type":"webUnlocked","el":""}  – 🔑 Password entered / 🔑 Passwort eingegeben  (only when that game system is switched on)`
- `social`: `{"type":"social","post":"","state":"shown"}  – 📸 Post / 📸 Beitrag  (only when that game system is switched on)`
- `liveChatReplied`: `{"type":"liveChatReplied","reply":""}  – 📺 Replied in live chat / 📺 Im Live-Chat geantwortet  (only when that game system is switched on)`
- `stamina`: `{"type":"stamina","cmp":">=","value":10}  – ⚡ Stamina / ⚡ Ausdauer  (only when that game system is switched on)`

Operators: `>=`, `>`, `<=`, `<`, `==`, `!=`.

## Actions (`actions` arrays – run in order)

- `setVar`: `{ "type": "setVar", "var": "<variable id>", "value": 5 }`
- `addVar`: `{ "type": "addVar", "var": "<variable id>", "value": 1 }  (negative = subtract)`
- `giveItem`: `{ "type": "giveItem", "item": "<item id>", "count": 1 }`
- `takeItem`: `{ "type": "takeItem", "item": "<item id>", "count": 1 }`
- `money`: `{ "type": "money", "currency": "<currency id>", "amount": 20 }  (negative = pay)`
- `loot`: `{ "type": "loot", "table": "<loot table id>" }`
- `rel`: `{ "type": "rel", "char": "<relation char id>", "amount": 10 }  – relationship points (needs Relationships on)`
- `gift`: `{ "type": "gift", "char": "<relation char id>" }  – player chooses a gift`
- `charPic`: `{ "type": "charPic", "id": "<unique id>", "char": "<relation char id>", "image": "<asset id>", "text": "Message", "style": "phone|bubble|window" }  – character sends a picture; it is added to the gallery`
- `time`: `{ "type": "time", "mode": "advance", "amount": 1 }  (needs Time & Calendar on)`
- `shop`: `{ "type": "shop", "shop": "<shop id>" }`
- `goto`: `{"type":"goto","scene":""}  – ➜ Go to scene or hub / ➜ Zu Szene oder Hub wechseln`
- `code`: `{"type":"code","code":""}  – 🧮 Math / code / 🧮 Rechnen / Code`
- `know`: `{"type":"know","key":"","value":true}  – 🧠 Remember knowledge (across playthroughs) / 🧠 Wissen merken (über Durchläufe)`
- `ach`: `{"type":"ach","ach":""}  – 🏆 Unlock achievement / 🏆 Erfolg freischalten  (only when that game system is switched on)`
- `screen`: `{"type":"screen","screen":"stats"}  – 📋 Open screen / 📋 Bildschirm öffnen`
- `nameInput`: `{"type":"nameInput","var":"","prompt":"Wie heißt du?","def":""}  – ✏ Let player enter a name / ✏ Namen eingeben lassen`
- `wear`: `{"type":"wear","item":"","give":true}  – 👕 Put on item / 👕 Gegenstand anlegen  (only when that game system is switched on)`
- `unwear`: `{"type":"unwear","slot":""}  – 👕 Take off slot / 👕 Platz ablegen  (only when that game system is switched on)`
- `equipScreen`: `{"type":"equipScreen"}  – 👕 Open equipment (inventory) / 👕 Ausrüstung öffnen (Inventar)  (only when that game system is switched on)`
- `unlockLoc`: `{"type":"unlockLoc","scene":"","value":true}  – 📍 Unlock / lock / remove place / 📍 Ort freischalten / sperren / entfernen  (only when that game system is switched on)`
- `freeTime`: `{"type":"freeTime","value":true}  – 📍 Free time begins / ends / 📍 Freie Zeit beginnt / endet  (only when that game system is switched on)`
- `openMap`: `{"type":"openMap"}  – 🗺 Open map / 🗺 Karte öffnen  (only when that game system is switched on)`
- `travel`: `{"type":"travel","scene":""}  – 📍 Go to location / 📍 Zu Ort gehen  (only when that game system is switched on)`
- `questStart`: `{"type":"questStart","ref":""}  – 📜 Start quest (series) / 📜 Quest(reihe) starten  (only when that game system is switched on)`
- `questStep`: `{"type":"questStep","ref":""}  – 📜 Section done / 📜 Abschnitt erledigt  (only when that game system is switched on)`
- `questDone`: `{"type":"questDone","ref":""}  – 📜 Complete quest / 📜 Quest abschließen  (only when that game system is switched on)`
- `questFail`: `{"type":"questFail","ref":""}  – 📜 Fail quest / 📜 Quest scheitern lassen  (only when that game system is switched on)`
- `questLog`: `{"type":"questLog"}  – 📜 Open quest log / 📜 Questlog öffnen  (only when that game system is switched on)`
- `skillPoints`: `{"type":"skillPoints","pt":"","amount":1}  – 🌳 Give skill points / 🌳 Skillpunkte geben  (only when that game system is switched on)`
- `skillGive`: `{"type":"skillGive","ref":""}  – 🌳 Grant skill (free) / 🌳 Skill schenken (ohne Kosten)  (only when that game system is switched on)`
- `skillScreen`: `{"type":"skillScreen","tree":""}  – 🌳 Open skill tree / 🌳 Skilltree öffnen  (only when that game system is switched on)`
- `battle`: `{"type":"battle","battle":""}  – ⚔ Start battle / ⚔ Kampf starten  (only when that game system is switched on)`
- `partyAdd`: `{"type":"partyAdd","hero":""}  – ⚔ Hero joins the party / ⚔ Held in die Gruppe  (only when that game system is switched on)`
- `partyRemove`: `{"type":"partyRemove","hero":""}  – ⚔ Hero leaves the party / ⚔ Held verlässt die Gruppe  (only when that game system is switched on)`
- `partyHeal`: `{"type":"partyHeal"}  – ⚔ Heal party / ⚔ Gruppe heilen  (only when that game system is switched on)`
- `heroXp`: `{"type":"heroXp","hero":"","amount":20}  – ⚔ Give experience / ⚔ Erfahrung geben  (only when that game system is switched on)`
- `idleScreen`: `{"type":"idleScreen"}  – 🏰 Open building screen / 🏰 Aufbau öffnen  (only when that game system is switched on)`
- `idleStart`: `{"type":"idleStart"}  – 🏰 Start building / 🏰 Aufbau starten  (only when that game system is switched on)`
- `idleBuild`: `{"type":"idleBuild","building":""}  – 🏰 Upgrade building (free) / 🏰 Gebäude ausbauen (geschenkt)  (only when that game system is switched on)`
- `idleUnlock`: `{"type":"idleUnlock","building":"","build":true}  – 🏰 Unlock building / 🏰 Gebäude freischalten  (only when that game system is switched on)`
- `idleProduce`: `{"type":"idleProduce","units":60}  – 🏰 Skip time (production) / 🏰 Zeit überspringen (Produktion)  (only when that game system is switched on)`
- `device`: `{"type":"device","device":"","app":""}  – 📱 Open device / 📱 Gerät öffnen  (only when that game system is switched on)`
- `devUnlock`: `{"type":"devUnlock","device":""}  – 🔓 Unlock device / 🔓 Gerät entsperren  (only when that game system is switched on)`
- `chatSend`: `{"type":"chatSend","thread":"","quiet":false}  – 💬 Send message / 💬 Nachricht schicken  (only when that game system is switched on)`
- `socialPost`: `{"type":"socialPost","post":"","quiet":false}  – 📸 Post / 📸 Beitrag posten  (only when that game system is switched on)`
- `socialDelete`: `{"type":"socialDelete","post":""}  – 🗑 Delete post / 🗑 Beitrag löschen  (only when that game system is switched on)`
- `socialFollowers`: `{"type":"socialFollowers","contact":"","op":"add","amount":100}  – 👥 Change followers / 👥 Follower ändern  (only when that game system is switched on)`
- `liveChat`: `{"type":"liveChat","chat":"","op":"start"}  – 📺 Live chat / 📺 Live-Chat  (only when that game system is switched on)`
- `stamina`: `{"type":"stamina","op":"add","amount":-10}  – ⚡ Change stamina / ⚡ Ausdauer ändern  (only when that game system is switched on)`
- `softPoke`: `{"type":"softPoke","dir":"down","amount":1}  – 〰 Nudge soft physics / 〰 Weich-Physik anstoßen`

## Game systems

- `relations` – Relationships (♥ points, stages, milestones with messages/pictures, gifts)
- `time` – Time & calendar
- `economy` – Money & shops
- `quests` – Quest log
- `skills` – Skill trees
- `combat` – Turn-based combat
- `idle` – Building / idle (buildings produce currencies)
- `world` – World map & locations
- `equip` – Equipment
- `devices` – Devices: in-game phone / computer with apps; chats live in `chats`

- World (`world`): locations can have `unlock: "cond"` + `unlockConds` (unlocked for good once true), `lockMode: "lock"` + `lockConds` (locked while true) or `lockMode: "gone"` + `lockConds` (removed from the map for good once true).
- Combat (`combat`: `heroes`, `enemies`, `skills`, `battles`, `party` …): a fighter may have `puppet`, `idleAnim`, `anims: { attack, cast, hit, defend, item, ko, victory }` (gesture anim ids), `blend` (seconds of blending out of the idle), `fps`, `smear`. A skill may have `anim` (attacker), `hitAnim` (target reaction) and `blend`. Animations need an image with bones or a puppet.

Each system has `enabled: true|false` plus its own data. The safest way to set up a system is inside the engine (tab **Game systems / Spielsysteme**, every system has a one-click example). Idle/building (`idle`): `tick: "sec"|"min"|"hour"` (amounts per tick), `startWhen: "always"|"firstOpen"|"cond"|"action"` (+ `startConds`), `mode: "realtime"|"offline"|"gametime"`.

## Devices and chats (phone / computer)

`devices: { enabled, list: [{ id, name, kind: "phone"|"desktop", key, hud, inMenu, conds, lock: { on, code, mode: "once"|"always", title, hint }, wallpaper, frame, clock: "auto"|"game"|"real"|"none", look: { accent, screen, text, panel, panelText, bubble, bubbleMe, iconShape, size, side, dim, inset, font }, apps: [...] }] }`.
- App: `{ id, type, name, icon, image, color, conds }`. `type`: `messages`, `inv`, `rel`, `gallery`, `quests`, `map`, `ach`, `skills`, `stats`, `log`, `idle` (built-in screens) or `app` (own app: `title`, `text`, `pic` = a page; `actions` run when opened – a `goto` action closes the device and jumps).
- Open it with the action `device` (e.g. on a hub object = hitbox), the HUD button, the key or the pause menu.
`chats: { notify, sound, contacts: [{ id, name, char: "<relationship char id>", avatar, color, status }], threads: [{ id, name, contact, auto, silent (no notification/unread count), conds, devs: ["<device id>"] (empty = all devices), msgs: [{ id, from: "them"|"me", text, image, conds, actions (run once when the message is read) }], replies: [{ id, text, conds, actions, next: "<thread id>" }] }] }`.
- A thread is delivered automatically (`auto: true`, as soon as `conds` are true) or with the action `chatSend`. Lines with `conds` are only delivered when true (route variants). The player picks one of the `replies`; its `actions` run and `next` delivers the follow-up thread. History is kept in the save game across scenes. Check with the condition `chat` (`state`: got, not, read, open, replied + `reply`). Dialogue lines with `chat: true` whose speaker is a contact are added to that chat history too.

## Operating the program (for AIs that can see and click the screen)

Top bar: project name · **Project ▾ / Projekt ▾** (save, open, import text, accessibility, language, this guide) · undo/redo · **Export / Exportieren** · ✓ problem list · ? help · tabs · **▶ Test scene / Szene testen** · **▶ Test game / Spiel testen**.

Tabs: **Scene / Szene** (timeline or hub editor) · **Paths / Pfade** (graph of all scenes) · **Game systems / Spielsysteme** · **Transcript / Transkript** (all texts, translations) · **Storyboard** (planning board) · **Characters / Figuren** (Bones & blinking, Layers & outfits, Jointed puppets, Lip sync) · **Main menu / Hauptmenü** · **Design** (speech bubbles, buttons, windows, fonts, sounds, cursor, start logo, 🎨 Pixel art) · **Animation** (idle, gestures, cutscenes, frame rate, smear frames, “💥 Hit here”).

Export: `export.pack` = `"open"` (normal files), `"pack"` (everything encrypted in data.vnpak) or `"packmods"` (packed, files in a `mods` folder override). The editor also runs in the browser: https://thetalkingpegasus.github.io/vn-timeline-engine/

Left: scene list (+ Story, + Hub, + 📁 chapter) and files (drag images/audio onto the stage or timeline). Right: properties of whatever is selected. 
Timeline: double-click an empty track cell = new clip; drag clips to move, right edge = length; right-click = more (keyframes, copy/paste format of a character, alternative path for a choice). Keys: Ctrl+S save, Ctrl+Z / Ctrl+Y undo/redo, ←/→ step, Del delete, Esc deselect.

Every problem message has a 💡 button with explanation and fix buttons – use them instead of guessing.

---
Generated by the VN Timeline Engine (Project ▾ → AI guide). Regenerate after big changes so the overview stays current.