VN Timeline Engine · Prototype 0.9.29
====================================
(Deutsch: siehe LIES MICH.txt)

Build visual novels like in a video editor: images, text and sound lie as clips on a timeline.
Each column is one click of the player.

GETTING STARTED (Windows)
Easiest: run "VN-Timeline-Engine-Setup-<version>.exe". It can create a desktop shortcut and a Start menu
entry, and from then on updates arrive automatically.
Without installing (ZIP):
1. Unzip the whole folder (don't start it from inside the ZIP).
2. Double-click "VN Timeline Engine.exe".
   On first start Windows may show "Windows protected your PC" because the program
   isn't signed: "More info" → "Run anyway".
3. To get to know it, choose "Start tutorial" (7 example scenes with a tour) or "Learn"
   (11 topics with tasks the program checks off by itself).

NEW IN 0.9.30 · Wheel zoom in every editor: lip sync, layers, website editor (Ctrl + wheel), device preview, idle map; pan in jointed puppets; pixel art zooms with the plain wheel

NEW IN 0.9.29 · Mouse-wheel zoom in every preview (scene, hub, animation, design, menu, figures) towards the mouse; pan with middle mouse or Space + drag; click the badge for 100 %; Ctrl + wheel zooms the timeline; soft physics: tense twitching and heartbeat pulse (strength and BPM adjustable)

NEW IN 0.9.28 · Soft physics: mask part of a character image (ellipse, lasso or pen tool like in After Effects, points editable), pick a preset (chest, hair, skirt, belly, ears, tail, jelly …) and it bounces, sways and breathes along with the figure's movement – image not cut, outside of the mask stays still; optional own layer, free anchor point with pendulum swing, test mode, action “Nudge soft physics”

NEW IN 0.9.27 · Idle layouts (cards, list, clicker, map/village), full screen, advisor character with speech bubble, selectable price/profit curves with presets (AdVenture Capitalist, Cookie Clicker …); Mouth & lip line tool (0.9.26) removed again – projects using it still open and play normally

NEW IN 0.9.26 · Mouth & lip line for cutscene figures (side and POV): objects are hidden behind the lips, the jaw opens as far as the object is wide (measured from its image), mouth-inside image or color

NEW IN 0.9.25 · Starter pack: 78 free CC0 images (anime style, 256 px) in the asset library – phones in 4 colors × 5 views and 58 everyday items (money, flowers, food, drinks, everyday things, gifts)

NEW IN 0.9.24 · Feedback packages 1 + 2: followers as a game mechanic (growth, currency link), live chat for stream scenes, stamina & tiredness, keyframable masks per actor, phone/computer design templates and website page templates, cross-project asset library; rounded custom bubbles, portrait styles, full transcript (apps, social, websites), blend modes and unlockable blur for website images, minigame rewards, keyframe box-select + copy/paste, duplicate actors, hub object idle motion

NEW IN 0.9.23 · Website editor: resizable canvas, rulers and snapping guides, drop shadows, transparent shapes

NEW IN 0.9.22 · Browser with your own websites
- In-game browser; build websites with a free page editor (texts, images, buttons, inputs), links, passwords, search.

NEW IN 0.9.21 · Social media app
- In-game social network: posts by conditions or actions, delete posts, likes and comments with actions,
  profiles with followers that change through events.

NEW IN 0.9.20 · Reliability round
- Failed saves are detected (asks before closing), web saves per project ID, validated language codes,
  safer ZIP import, SHA-256 for plugins, tests required before every release.

NEW IN 0.9.19 · Select body parts in the layers · frame selection in Paths
- Animation editor: click a body part in the keyframe layers to select it.
- Paths: drag a frame to select several scenes and move them together (Shift/Ctrl + click, Ctrl + A, Esc).
  Move the view with the right or middle mouse button or Space + drag.

NEW IN 0.9.18 · Fitness minigames: barbell and dumbbells · curve graph for keyframes
- Curve graph: shape every transition between keyframes with two handles (ease in/out, overshoot, hold) – in the
  animation editor (also as a value graph in the timeline) and for keyframes and camera moves in scenes.
- Barbell: mash the space bar – every press lifts the bar a little, the weight pulls it back down. Reach the goal line.
- Dumbbells: a rhythm game. Left and right go up and down to their own beat; press A (left) or D (right) when a
  dumbbell is up in the zone. Perfect / good / too early / too late, combos, three rhythm patterns, custom keys.
- Both: difficulty, helper item, skill tree perks, own images for weights and background, every colour adjustable.

NEW IN 0.9.17 · Arcade: darts, pool, blackjack and slot machine · safe and pipes
- New bundled plugin "Arcade": darts and pool against computer opponents whose skill you set, blackjack against a
  dealer, and a slot machine with your own symbols, payouts and cabinet. Everything can use your own images.
- New minigames: safe / combination lock (dial, keypad or wheels; code from the story or random) and connect the pipes.

NEW IN 0.9.16 · Pixel art, battle animations, code track, puppet folders
- Pixel art editor (Design → Pixel art): draw and animate frame by frame; finished animations become pixel-sharp
  animated GIFs for characters, backgrounds, hub objects and fighters.
- Battles: fighters with bones or jointed puppets get their own idle, attack, spell, hit, K.O. and victory animations
  that blend smoothly; every skill can have its own animation.
- Code track and formulas: gold += 5, if courage > 3: points += 1, give("Key") … also as action and condition.
- Folders for the parts of jointed puppets.
Earlier in 0.9: lights and TV filters, frame rate and smear frames, place rules (unlock if …, lock while …, gone),
seams and hold points for puppets, inpaint brush, editable bones mesh, packed game files, web version, Spanish and
Japanese. Details: CHANGELOG.md.

NEW IN 0.9 · Phone & computer, messages, puppets and more
- Devices: an in-game phone or computer with apps (messages, inventory, gallery, quests, map … and own apps),
  fully designable, optional PIN or password.
- Messages that persist across scenes: route variants, replies to pick, hidden messages, messages per device,
  messages that unlock locations, items or quests when read.
- Jointed puppets from body parts with pins, bones, idle motion and an eraser; hub dialogues, hub particles,
  hub events with "how often"; choices that grey out/hide and can be placed anywhere; seasons, ambient sounds,
  game over; seven minigames; spell-check suggestions. Full list: CHANGELOG.md.

LANGUAGE
The interface is available in English, German, Spanish and Japanese. English is the default.
Switch on the start screen or under Project ▾ → Language.
Menus inside a game follow the game's language (German, English, Spanish or Japanese; otherwise English).

WHAT'S INSIDE
Editor
- Timeline with tracks for background, characters, effects, camera, video, dialogue, choices, code,
  music, voices and sound effects. Extra tracks for group scenes, track templates.
- Paths view: all scenes as bubbles with branches, chapters, search, path check.
- Hub scenes: places to click around with objects (also invisible hitboxes), backgrounds per time of day,
  particles, events (when / how often) and hub dialogues (timeline scenes over the hub).
- Choices: grey out or hide what was already asked, place them anywhere, reorder answers.
- If → Then everywhere: variables, items, money, loot tables, conditions and actions.
- Characters: Bones (skeleton animation from a single image, editable mesh), blinking, lip sync,
  layer characters with expressions and outfits (with bones), jointed puppets from body parts (pins, bones, idle,
  "Human" template, joint limits, seams, hold points, inpaint brush, eraser, folders).
- Effects: particles, colour layers, lights (spotlight, lamp, neon, backlight with rim light and dust),
  filters (flashback, black & white, dream, CRT TV, LCD TV, RGB split).
- Code track and formulas: commands at a step, as an action or as a condition, with live error check.
- Storyboard, asset folders, copy & paste clips between scenes, copy format, free transform, spell-check suggestions.
- Animation editor: idle loops, gestures, cutscenes (live or rendered as video), frame rate (on twos/threes),
  smear frames, hit point for battles.
- Design: speech bubbles, buttons, windows, fonts, sounds, mouse cursor, studio logo, pixel art editor.
- Transcript: every text with an ID, translations, CSV export/import, speaker script, subtitles (SRT).
- Text import: paste finished dialogue as "Name: Text" or a Ren'Py script; speakers, choices and
  scenes are recognized (button "⤓ Text" above the timeline).
- Old projects are converted automatically when opened; a backup of the project file is kept.
Game systems (switch on what you need)
- Inventory, currencies and shops, time & calendar, relationships with stages and gifts,
  achievements, gallery, stats, glossary.
- World & locations: world map with pins and submaps, home, events at locations, free time;
  places unlock if …, lock while … or disappear for good.
- Quest log: quest series → quests → sections for the main story and each character,
  freely designable notifications.
- Skill trees: skills paid with money, level-up points or own points; effects on money, shops,
  relationships, jobs, travel, minigames and stats; key T in the game.
- Combat: classic turn-based battles in side view, party of up to four heroes, levels, abilities,
  loot, story mode; test battle and 100× simulation in the editor; animated fighters with smooth blending.
- Building (idle): buildings produce resources, get upgraded, goals move the story forward; real time,
  offline or game time; time preview in the editor.
- Equipment, seasons and ambient sounds, game over screen.
- Devices: phone or computer with apps, lock code; messages across scenes with routes, replies and unlocks.
- Bundled plugins: Jobs, eleven minigames (incl. safe, pipes, barbell and dumbbells) and the Arcade (darts, pool, blackjack, slot machine).
  Write your own plugins in JavaScript (see PLUGINS.en.md).
For players (in every game automatically)
- History, auto mode, skip, quick save, save slots, settings, reading & accessibility options,
  graphics quality, sound output.
Export
- Windows game with its own .exe and icon, or web game (e.g. for itch.io).
- Game files open (for modding), packed into one encrypted file, or packed with a mods folder.

KEYS
Editor: Ctrl+S · Ctrl+Z / Ctrl+Y · Del · Arrow left/right · Bones: Enter finishes a chain
Game:   Click/Space continue · Esc pause menu · I inventory · Q quest log · M map · H home · phone/computer: own key
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
