VN Timeline Engine · Prototype 0.7.2
====================================
(Deutsch: siehe LIES MICH.txt)

Build visual novels like in a video editor: images, text and sound lie as clips on a timeline.
Each column is one click of the player.

GETTING STARTED (Windows)
Easiest: run "VN-Timeline-Engine-Setup-0.7.0.exe". It can create a desktop shortcut and a Start menu
entry, and from then on updates arrive automatically.
Without installing (ZIP):
1. Unzip the whole folder (don't start it from inside the ZIP).
2. Double-click "VN Timeline Engine.exe".
   On first start Windows may show "Windows protected your PC" because the program
   isn't signed: "More info" → "Run anyway".
3. To get to know it, choose "Start tutorial" (7 example scenes with a tour) or "Learn"
   (11 topics with tasks the program checks off by itself).

NEW IN 0.7.0 · Public prototype
- Windows setup with desktop shortcut and automatic updates (only changes are downloaded).
- Help messages with fix buttons, 💡 explanations and a problem list.
- Right-click hub objects: "Connect with …" and building blocks like "Can be bought …" (price,
  confirmation, only once) – no variables needed. Buildings can be unlocked by an action.
- Relationship milestones: messages (phone, bubble, window), pictures into the gallery, "New" glow,
  gallery filter by character; all designable with sounds.
- Studio intro with several logos (image/video), transitions and jingle; character height slider and
  dragging on the stage; pause menu entries can be hidden; export switches "Allow mods" and "Scope".
- New license from 0.7 (LICENSE / LIZENZ.txt). See CHANGELOG.md for everything.

LANGUAGE
The interface is available in English and German. English is the default.
Switch on the start screen (top right) or under Project ▾ → Language.
Menus inside a game follow the game's language (German game → German menus, otherwise English).

WHAT'S INSIDE
Editor
- Timeline with tracks for background, characters, effects, camera, video, dialogue, choices,
  music, voices and sound effects. Extra tracks for group scenes, track templates.
- Paths view: all scenes as bubbles with branches, chapters, search, path check.
- Hub scenes: places to click around with objects, conditions and actions.
- If → Then everywhere: variables, items, money, loot tables, conditions and actions.
- Characters: Bones (skeleton animation from a single image), blinking, lip sync,
  layer characters with expressions and outfits.
- Animation editor: idle loops, gestures, cutscenes (live or rendered as video).
- Design: speech bubbles, buttons, windows, fonts, sounds, mouse cursor, studio logo.
- Transcript: every text with an ID, translations, CSV export/import, speaker script, subtitles (SRT).
- Text import: paste finished dialogue as "Name: Text" or a Ren'Py script; speakers, choices and
  scenes are recognized (button "⤓ Text" above the timeline).
- Old projects are converted automatically when opened; a backup of the project file is kept.
Game systems (switch on what you need)
- Inventory, currencies and shops, time & calendar, relationships with stages and gifts,
  achievements, gallery, stats, glossary.
- World & locations: world map with pins and submaps, home, events at locations, free time.
- Quest log: quest series → quests → sections for the main story and each character,
  freely designable notifications.
- Skill trees: skills paid with money, level-up points or own points; effects on money, shops,
  relationships, jobs, travel, minigames and stats; key T in the game.
- Combat: classic turn-based battles in side view, party of up to four heroes, levels, abilities,
  loot, story mode; test battle and 100× simulation in the editor.
- Building (idle): buildings produce resources, get upgraded, goals move the story forward; real time,
  offline or game time; time preview in the editor.
- Bundled plugins: Jobs and six minigames. Write your own plugins in JavaScript (see PLUGINS.en.md).
For players (in every game automatically)
- History, auto mode, skip, quick save, save slots, settings, reading & accessibility options,
  graphics quality, sound output.
Export
- Windows game with its own .exe and icon, or web game (e.g. for itch.io).

KEYS
Editor: Ctrl+S · Ctrl+Z / Ctrl+Y · Del · Arrow left/right · Bones: Enter finishes a chain
Game:   Click/Space continue · Esc pause menu · I inventory · Q quest log · M map · H home
        L history · A auto · S skip · C stats · B relationships · F5/F9 quick save/load · F2 values (testing)

PROJECTS
A project is a folder with "project.json", "assets" and optionally "plugins".
Save games made while testing go into the project folder under ".test-saves".

NOTES
- The finished Windows game is about 300 MB unpacked (about 125 MB as ZIP). Most of it is the
  base (program and browser technology) every Windows game needs. The web game is much smaller.
- The example project contains the free font "Cinzel" (SIL Open Font License, license in the
  assets folder). The program icon of the .exe is set with rcedit (MIT license).
- This is a prototype. Make backups of your projects.

License: VN Timeline Engine License 1.0 (see LICENSE, German: LIZENZ.txt) · © 2026 The Talking Pegasus
Games you make are yours and may be sold. The engine itself may not be sold or passed off as your own.
