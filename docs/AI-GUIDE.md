# VN Timeline Engine – guide for AI assistants

Engine 0.7.4 · project format 1 · generated 2026-10-31

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
{"id":"s_ai1","type":"story","name":"Chapter 1 · The cellar","beats":4,"next":"<scene id> | \"@return\" | null","tracks":{"bg":[],"char1":[],"char2":[],"dialog":[],"choice":[],"music":[],"voice":[],"sfx":[],"fx":[],"cam":[],"video":[]}}
```

- `beats` = number of steps. A clip covers steps `start` … `start + len − 1` (0-based).
- `next` = scene after the last step. `"@return"` = back to the hub (or world location) the scene was started from. `null` = end of the game.
- `overHub: true` = the scene plays on top of the hub it was started from (hub background and objects stay visible behind the characters).
- Dialogue: one clip per step in `dialog` (`len: 1`). `speaker` empty = narrator. `chat: true` shows the line as a phone chat. `actions` run when the line appears. `waitFor: { conds, hint }` stops until the condition is met.
- Choice: in `choice` at the step where it appears; each option has `text`, `target` (scene id or null = continue), `conds` (shown only if true), `actions`.
- Characters: `x` 0–100 (% from left, centre of the figure), `y` height offset in %, `scale` %, `rot` degrees, `flip`. `keys: [{ beat, x, y, scale, rot, opacity }]` animate over steps.

### Clip fields per track (defaults of the editor)

- `bg` – Background / Hintergrund (bg): `{"id":"<unique id>","start":0,"len":3,"asset":null,"trans":"fade","dur":1}`
- `char1` – Character 1 / Figur 1 (char): `{"id":"<unique id>","start":0,"len":3,"asset":null,"x":30,"scale":100,"trans":"fade","dur":0.6,"idle":"breathe","flip":false}`
- `char2` – Character 2 / Figur 2 (char): `{"id":"<unique id>","start":0,"len":3,"asset":null,"x":70,"scale":100,"trans":"fade","dur":0.6,"idle":"breathe","flip":false}`
- `fx` – Effect layer / Effekt-Ebene (fx): `{"id":"<unique id>","start":0,"len":3,"asset":null,"color":"#3c4a8c","blend":"multiply","opacity":85,"styles":{}}`
- `cam` – Camera / Kamera (cam): `{"id":"<unique id>","start":0,"len":3,"zoom":130,"panX":0,"panY":-8,"rot":0,"shake":0,"dur":1.2,"ease":"ease-in-out","keys":[]}`
- `video` – Video (video): `{"id":"<unique id>","start":0,"len":1,"asset":null,"layer":"front","loop":false,"muted":false,"vol":90,"fit":"cover","waitEnd":true,"skippable":true}`
- `dialog` – Dialogue / Dialog (dialog): `{"id":"<unique id>","start":0,"len":1,"speaker":"","color":"#ffffff","text":"New text …","speed":40,"actions":[]}`
- `choice` – Choice / Auswahl (choice): `{"id":"<unique id>","start":0,"len":1,"options":[{"id":"opt_1ovpz","text":"Answer A","target":null,"conds":[],"actions":[]},{"id":"opt_1ps1l","text":"Answer B","target":null,"conds":[],"actions":[]}]}`
- `music` – Music / Musik (music): `{"id":"<unique id>","start":0,"len":3,"asset":null,"vol":70,"loop":true,"carry":false,"fade":1}`
- `voice` – Voices (voice): `{"id":"<unique id>","start":0,"len":1,"asset":null,"vol":90,"delay":0}`
- `sfx` – Sound effects / Soundeffekte (sfx): `{"id":"<unique id>","start":0,"len":1,"asset":null,"vol":90,"delay":0}`

## Hub scenes (free clicking)

```json
{"id":"h_ai1","type":"hub","name":"Guild hall","bg":"<asset id>","music":null,"objects":[{"id":"o_ai1","name":"Door","asset":"<asset id|null>","x":70,"y":30,"w":12,"h":40,"rot":0,"shape":"rect","hover":"glow","target":"<scene id|null>","message":"","conds":[],"actions":[],"styles":{}}],"events":[]}
```

- Object position/size in % of the screen. `target` = scene opened on click. A story scene with `next: "@return"` returns to the hub afterwards.
- Events run when the hub is entered: `{ id, trigger: "first"|"always"|"cond", conds, mode: "lines"|"scene", lines: [{ id, speaker, text, style: ""|"phone"|"note" }], scene: "<story scene id>" }`. `mode: "scene"` plays a whole timeline over the hub (characters, phone chat, choices) and comes back. `trigger: "cond"` fires once as soon as `conds` are true, also while the player is in the hub.

## Conditions (`conds` arrays – all must be true)

- `var`: `{ "type": "var", "var": "<variable id>", "op": ">=", "value": 2 }  (flags: "value": true/false)`
- `item`: `{ "type": "item", "item": "<item id>", "op": ">=", "count": 1 }`
- `money`: `{ "type": "money", "currency": "<currency id>", "op": ">=", "amount": 50 }`
- `seen`: `{ "type": "seen", "scene": "<scene id>", "value": true }`
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
- `know`: `{"type":"know","key":"","value":true}  – 🧠 Remember knowledge (across playthroughs) / 🧠 Wissen merken (über Durchläufe)`
- `ach`: `{"type":"ach","ach":""}  – 🏆 Unlock achievement / 🏆 Erfolg freischalten  (only when that game system is switched on)`
- `screen`: `{"type":"screen","screen":"stats"}  – 📋 Open screen / 📋 Bildschirm öffnen`
- `nameInput`: `{"type":"nameInput","var":"","prompt":"Wie heißt du?","def":""}  – ✏ Let player enter a name / ✏ Namen eingeben lassen`
- `wear`: `{"type":"wear","item":"","give":true}  – 👕 Put on item / 👕 Gegenstand anlegen  (only when that game system is switched on)`
- `unwear`: `{"type":"unwear","slot":""}  – 👕 Take off slot / 👕 Platz ablegen  (only when that game system is switched on)`
- `equipScreen`: `{"type":"equipScreen"}  – 👕 Open equipment (inventory) / 👕 Ausrüstung öffnen (Inventar)  (only when that game system is switched on)`
- `unlockLoc`: `{"type":"unlockLoc","scene":"","value":true}  – 📍 Unlock / lock location / 📍 Ort freischalten / sperren  (only when that game system is switched on)`
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

Each system has `enabled: true|false` plus its own data. The safest way to set up a system is inside the engine (tab **Game systems / Spielsysteme**, every system has a one-click example). Idle/building (`idle`): `tick: "sec"|"min"|"hour"` (amounts per tick), `startWhen: "always"|"firstOpen"|"cond"|"action"` (+ `startConds`), `mode: "realtime"|"offline"|"gametime"`.

## Operating the program (for AIs that can see and click the screen)

Top bar: project name · **Project ▾ / Projekt ▾** (save, open, import text, accessibility, language, this guide) · undo/redo · **Export / Exportieren** · ✓ problem list · ? help · tabs · **▶ Test scene / Szene testen** · **▶ Test game / Spiel testen**.

Tabs: **Scene / Szene** (timeline or hub editor) · **Paths / Pfade** (graph of all scenes) · **Game systems / Spielsysteme** · **Transcript / Transkript** (all texts, translations) · **Storyboard** (planning board) · **Characters / Figuren** (bones, layered figures) · **Main menu / Hauptmenü** · **Design** · **Animation**.

Left: scene list (+ Story, + Hub, + 📁 chapter) and files (drag images/audio onto the stage or timeline). Right: properties of whatever is selected. 
Timeline: double-click an empty track cell = new clip; drag clips to move, right edge = length; right-click = more (keyframes, copy/paste format of a character, alternative path for a choice). Keys: Ctrl+S save, Ctrl+Z / Ctrl+Y undo/redo, ←/→ step, Del delete, Esc deselect.

Every problem message has a 💡 button with explanation and fix buttons – use them instead of guessing.

---
Generated by the VN Timeline Engine (Project ▾ → AI guide). Regenerate after big changes so the overview stays current.