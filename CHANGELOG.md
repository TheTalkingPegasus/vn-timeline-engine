# Changelog

All notable changes. German details: `LIES MICH.txt`.

## 0.9.2 – Reorder choice answers, safety check fixes
- Answers of a choice can be moved up or down one position (↑ / ↓ on each answer).
- Fixed: the developer console and the performance display in the finished game (Windows and web) crashed on
  memory sizes – a helper only existed in the editor.
- Fixed: Esc did nothing in the relationship overview, gift screens and shops – it now works like “Back” / “Leave shop”.
- Fixed: the transform frame of a character could jump back while you were already dragging it.
- Fixed: an empty step with only a choice still showed the “empty step” hint behind the choice in the editor.

## 0.9.1 – Choices can be moved anywhere
- Choice windows can now also be moved up and down and changed in width – per choice, with presets (top, centre,
  bottom) or “as in design”. Before, they always covered the middle of the picture.
- Drag a choice directly on the stage with the mouse (snaps to the centre, Alt = free). It always stays inside the picture.
- New button “Apply to all choices in the project” copies position and width to every other choice.

## 0.9.0 – Devices: phone and computer, messages across scenes
Devices (Game systems → Devices)
- New game system: an in-game **phone** (portrait, status bar, app grid) or **computer** (desktop with icons,
  draggable windows and a taskbar). Several devices per project, each with its own apps and look.
- Apps: Messages, Inventory, Relationships, Gallery, Quests, Map, Achievements, Skill tree, Stats, History, Building –
  built-in apps open their screen and return to the device afterwards. Own apps show a page (title, text, picture –
  e.g. notes, an e-mail, a website) and/or run actions; “➜ Go to scene or hub” closes the device and jumps.
- Fully editable design: wallpaper, optional phone/monitor frame image, colours (accent, screen, text, app area,
  chat bubbles), icon shape, font, size and position, background dimming. App icons as emoji or your own image,
  own names and colours, order, and conditions per app (“only show when …”). Live, clickable preview in the editor.
- Open a device with the HUD button, its own key, the pause menu or the new action “📱 Open device” – e.g. on a hub
  hitbox (the laptop on the desk), optionally straight into an app or a chat. A device can be locked by conditions.
Messages (Game systems → Messages)
- Contacts (free name or linked to a relationship character, avatar, colour, status).
- Conversations arrive automatically as soon as their conditions are met or with the action “💬 Send message”.
  Lines with conditions only arrive when they are met – every route gets its own version of a chat.
- Prepared replies the player picks from; replies can have conditions, run actions and lead to the next
  conversation (shown line by line with “typing …”).
- The history is part of the save game and stays across all scenes. Unread badges on the HUD button and the app,
  a notification for new messages (click opens the chat), optional own sound.
- Timeline chat lines (dialogue “Show as phone message”) are added to the contact's history, and older messages
  appear above them in the timeline phone. Relationship milestone messages and picture gifts land in the chat too.
- New condition “💬 Message” (received, not received, read, waiting for reply, answered – optionally with a
  specific reply). Problem list warns about conversations without contact, broken reply targets and chats that are
  never sent. All chat texts appear in the transcript for translation.

## 0.8.0 – Choices, folders, copy & paste, times of day and seasons
Choices and hubs
- Already picked answers can turn grey (“already asked”, still pickable) or disappear – per choice or per
  answer. Good for hub dialogues where you ask a character things. Optional target when every answer is gone.
- Choices can be moved left or right (slider and presets), they always stay on screen.
- New action “➜ Go to scene or hub” – e.g. at the end of a dialogue line, also to hubs (not only locations).
- Hub objects can be invisible: just a click area, no frame, glow or name.
- New backgrounds and character clips start with a hard cut instead of a fade.
- Jobs plugin 1.3: conditions “Job rank at least” (promotions) and “Shifts worked” – e.g. “object only visible
  if waiter or higher”.
Minigames
- Every minigame can lead somewhere when won or lost: a scene, a hub or the new game-over screen (title, text,
  background, “Try again”; set up under Main menu).
- Cooking & brewing (Minigames plugin 1.3): own title, button and recipe-book names (e.g. “Mix” at a bar
  instead of “Brew”) and difficulty easy / medium / hard.
Working faster
- Folders and subfolders in the file list: create, rename, dissolve, drag files onto folders, right-click →
  move to folder. Files in subfolders of “assets” on your PC appear in the same folder automatically.
- New projects get a folder structure on the PC (Images/Characters, Images/Backgrounds, Images/Objects, Videos,
  Music, Sound effects, Voices, Fonts). Files that are already inside the project folder are used in place instead
  of being copied again.
- Copy timeline clips into other scenes: Ctrl+C copies the selected clip (or the whole step), Ctrl+V pastes it at
  the current step in any scene; also in the clip's right-click menu (“Copy”, “Copy whole step”, “Paste”).
Time & calendar
- Hubs can have their own background per time of day; it changes right away when time passes in the hub.
- Seasons (names, length in days, start) with the condition “Time / calendar → Season”; the season is shown with
  the time.
- Ambient sounds per time of day and season, everywhere, only in hubs or in one scene – they cross-fade when time
  changes.

## 0.7.8 – Jointed puppets: pins follow bones, eraser
- Jointed puppets: pins of child parts now follow the bones of their parent part. When the torso breathes,
  sways or swings via its bones, arms and head stay attached and turn with it instead of drifting apart.
- New eraser in the puppet builder (🧽): paint away hard edges and transitions on a part, with adjustable size
  and edge softness, plus “Restore” to paint the original back. Ctrl + mouse wheel changes the brush size.
  Saving creates a new image file – the original is kept and can be brought back any time; bones and blinking
  are carried over.

## 0.7.7 – Bugfix: effect layers in order
- Eyes open / close / blink now always lie in front of every other effect layer (particles, glow, light), so
  e.g. embers only become visible when the eyes open. They stay below dialogue and phone.
- Effect layers follow the timeline order: an effect track further down is drawn further in front (like
  characters).

## 0.7.6 – Jointed puppets, bug fixes
- New: **jointed puppets** (Characters → Jointed puppets). Build a character from separate body parts like layers
  in After Effects: drag images onto the board, drag each part's red joint pin onto the joint and release it over
  the parent part (forearm → upper arm → torso). Children follow their parent. Per part: idle motion (sway,
  breathe, bob, jiggle that swings after the parent moves), own bones from the bones editor, rest rotation,
  hide, mirrored copy (left arm → right arm). “Try out” rotates parts around their pins, Shift = IK.
- Animation editor: an actor can be a jointed puppet. Puppeteering on the stage: drag a part or its end point to
  rotate it around its pin, Shift + drag = IK (the chain follows the mouse), coordinate arrows (X, Y, free) move
  the whole figure, double-click pins a limb so it stays in place while the body moves. Keyframes per part
  (rotation, offset), “whole pose as keyframe”, “rest pose”.
- Timeline: “Type of character” → jointed puppet; idle animation and gestures as with bones characters.
  Works in exported games.
- Fix: World & locations – the checkboxes in the base settings could not be switched (fixed with 0.7.5,
  now covered by a test).
- Fix: going from one hub to the hub dialogue of another hub (room change) showed the previous hub's objects
  and hitboxes behind it. Now the hub the dialogue belongs to is shown, and the player returns there.
- Fix: backgrounds sometimes vanished, turned into a single colour or flickered – a delayed fade timer hid the
  new image when the player clicked on during a transition (especially with time-of-day tints).
- Fix: “Scene … is not reachable from the start” no longer appears for locations on the world map and scenes
  reached by travel actions; the message now says “is never entered”.

## 0.7.5 – Fix: settings jumped back
- Fix: “Building starts”, “Amounts apply” (per second/minute/hour) and other settings jumped back after
  choosing (the choice landed in an outdated copy of the settings). The same cause is fixed for skill trees,
  combat, quests, world, equipment, relationships, time, shops, inventory and design.

## 0.7.4 – Hub dialogues, storyboard, free transform, comfort & colour-blind modes, AI guide
- Hub dialogues like in the timeline: a hub event can now play a whole timeline scene over the hub –
  characters, phone chat, choices, actions – and returns to the hub afterwards (“+ Timeline dialogue”).
  Hub objects can start such a dialogue on click. New trigger “as soon as ‘Only if’ is true” (also while
  in the hub). Short event lines can appear as 📱 phone message or 🔔 notification. “↩ Back to the hub”
  now works without World & locations.
- Building (idle): starts right away, on first opening, as soon as conditions are met (e.g. after a
  dialogue) or through the new action “🏰 Start building”. Amounts apply per second, minute or hour.
  New condition “🏰 Building is running”.
- Free transform for characters: frame on the stage with corner handles to scale and a circle to rotate,
  snapping to centre, thirds, floor and other characters (Alt = free). Every slider has a number field
  to type values; new “Rotation” slider.
- Copy format: right-click a character → “Copy format”, on another one “Paste format …” – tick what is
  transferred (position, size, rotation, flip, effects, entrance, idle motion, keyframes), also to all
  characters in the step or scene.
- Picture gifts: new action “📷 Character sends a picture” with its own message (phone, speech bubble,
  window); the picture lands in the gallery. Gallery pictures can belong to several characters.
- Storyboard: new tab next to the transcript – a free board for images (drag and drop), notes with author,
  headings, arrows and links to scenes. For pros and teams; saved in the project, not exported into games.
- Comfort & accessibility (Project ▾): comfort mode (calm, no animations, muted colours), larger interface,
  colour-blind mode and a preview “see the game through the eyes of colour-blind players”. New for
  players: “Colour help” for three kinds of colour blindness and “Fewer effects”.
- AI guide (Project ▾ → 🤖): generates AI-GUIDE.md with the file format, all conditions and actions, how to
  operate the program and a project overview – so ChatGPT, Gemini, Grok & co. understand projects without
  the source code. General version: docs/AI-GUIDE.md.

## 0.7.3 – Equipment actions and bonuses, “Continue only when …” improved
- “Continue only when …”: new choice “Show this line only once it's done” (default for new setups) – the
  line, e.g. a reaction, appears only after the condition is met; works even if it is met inside the
  inventory. Warnings in the editor for common pitfalls (item is used up, “used” vs. “wears”, equipment off).
- Equipment items: actions when put on / taken off (optionally only the first time) – e.g. unlock a place,
  complete a quest step, relationship points (“in disguise, now I may enter”) – and bonuses while worn
  (same effects as skill trees: more ♥ with a character, more money, prices, combat stats …).
  Items → Equip column → “…”.
- Items: “Offer ‘Use’ in the inventory” can be switched off; for equipment it is off by default, so clothes
  are no longer used up by accident.
- The wait hint no longer overlaps the item notification.

## 0.7.2 – Equipment, “Continue only when …”, new triggers
- New game system “Equipment” (Game systems → Overview): slots like head, body, hand, jewellery (freely
  definable), items get a slot (Items → “Equip” column). In the inventory the player equips and takes off
  items; worn items are marked. Condition “👕 Wears item” / “👕 Slot filled”, actions “Put on item”,
  “Take off slot”, “Open equipment”. Plugin hook onEquip.
- “Continue only when …” on dialogue lines: the game stays on the line until a condition is met (e.g. the
  inventory was opened or a dress is worn), with a hint text, optional glowing button and optional automatic
  continue. Auto and skip pause there.
- New condition “✔ Player has done …”: opened a screen (inventory, map, quest log, relationships, skill tree,
  building, party, gallery, achievements, stats, history), entered a name, visited a scene/place, used an
  item, equipped an item, gave a gift. Usable everywhere, also as quest trigger.
- Dialogue editor: placeholder help under the text with buttons to insert {name} and variables.
- Fix: sound effects kept playing in the editor after closing a test.
- Inventory: the close button no longer covers the item actions.

## 0.7.1 – Fix: automatic updates
- Fix: installed versions (setup) never found the update source, because the build tool removes the
  publish settings from the packaged package.json. The engine now reads the source from the installer's
  app-update.yml (fallback: repository address). Versions 0.7.0 and older have to install 0.7.1 once by hand;
  from 0.7.1 on, updates arrive automatically.
- The release workflow now checks the finished program for the update source and stops if it is missing.

## 0.7.0 – Public prototype
- Windows setup (VN-Timeline-Engine-Setup-x.y.z.exe): install for me or for all users, choose the folder,
  optional desktop shortcut (on by default), Start menu entry, uninstall via Windows settings, own sidebar
  and icon. Updating: run the new setup over the old one – shortcut, projects, settings, saves and plugins
  stay; the shortcut choice is remembered.
- Automatic updates for the setup version via GitHub releases: notice at the bottom right, downloads only the
  changes, installs on restart after saving the project. Project → Check for updates …; can be turned off.
  The ZIP version shows a notice with a link. Exported games never check for updates.
- One-click releases: GitHub Actions workflow “Neue Version veröffentlichen” builds setup and ZIP on Windows,
  sets the version everywhere and publishes the release. tools/set-version.js, docs/VERÖFFENTLICHEN.md.
- Help messages: every editor check says what's wrong, offers fix buttons and a 💡 window with explanation,
  examples and ideas; red/yellow/blue levels; problem list button in the top bar; hide/unhide per message.
- Connect without workarounds: right-click a hub object → “Connect with …” (building, skill tree, quest log,
  map, inventory, shop, battle, gift, gallery, plugins …) and “Building blocks …” (can be bought, only once,
  gives an item once, gives relationship points once). New object click rules: price with confirmation and
  “not enough money” message, how often (any / once then hide / once and stay). Workaround detection
  (money condition + money action) with one-click conversion. Badges on objects show their connections.
- Building: buildings can be unlocked by an action; new action “🏰 Unlock building” (optionally builds level 1).
- Relationship milestones: per character at any percentage (rising or falling), message as phone, speech
  bubble or window, notification (“Ray sent you a picture”), picture unlocked into the gallery, extra actions.
  Gallery: filter by character, “New” glow and counter until viewed. New design entries “Message from a
  character”, “Notification”, “Gallery: New glow” with templates and sounds (project, character, milestone).
- Studio intro: any number of logos (image or video) before or after the engine logo, transitions, jingle,
  skip setting. Engine logo: at least 5 s, skippable after 2 s.
- Characters: new “Height” slider; drag characters on the stage (horizontal = position, vertical = height).
- Pause menu: quest log, skill tree, party, map and relationships can each be hidden.
- Export: “Allow mods” (off = only shipped plugins with checksum; on = players may add plugins, the game asks
  per mod, mod list in settings) and “Scope” (slim/complete).
- Warning when a project is stored inside the program folder; installer files are not copied into games.
- Fixes: relationship “not reachable” check counts ♥ points from every system (building goals, quests,
  battles, events, skill trees …); the points list no longer breaks for sources outside scenes; relationship
  points on hub objects no longer appear as “Found: item”; hub actions that open building/skill tree work.
- License: from 0.7 the VN Timeline Engine License 1.0 (LICENSE, German LIZENZ.txt): free to use, change and
  make and sell games; the engine itself may not be sold or passed off as your own; engine logo stays.
  Versions up to 0.6.12 remain MIT.

## 0.6.12 – Design templates for game systems
- Design → Game systems: every system has its own fitting templates, e.g. skill tree “Starry sky”,
  “Druid tree”, “Old textbook”, “Tech upgrade”; combat “Classic blue (RPG)”, “Dark dungeon”,
  “Golden arena”, “Spaceship”; building “Kingdom”, “Farm”, “Space colony”, “Ledger”; shops, relationships,
  gifts, quest log, quest notifications, world map, achievements, time display and minigames too.
- New background patterns without image files (parchment, wood, stone, leather, starry sky, lined paper,
  dots, gift wrap stripes, sci-fi grid, glass, sea chart), border width and glow.
- Screen layout options: skill shape (round, square, diamond), connections (solid, dashed, glowing) and
  detail panel side; combat command bar at the top or bottom, commands as list or columns, retro bars;
  building as cards or list, goals left/right/hidden; quest log tabs as buttons or underlined.
- The design preview shows the real screens (quest log, world map, relationships, gifts, notifications,
  achievement message) – with sample data when the project has none yet.
- Building fixes from a second review: the same currency entered twice in the costs is now added up,
  starting level is limited to the maximum, the time preview no longer runs plugin actions or hooks.

## 0.6.11 – Building (idle)
- New game system “Building” (Game systems → Building): buildings produce resources (your currencies),
  are upgraded at rising costs and can depend on story conditions or other buildings.
- Production in real time while playing, also while the game is closed (capped, with a percentage),
  or in game time per time of day. Optional clicking on buildings for an instant yield.
- Goals in order: conditions (resources, building levels, anything) and actions when reached, with a
  message. Catch-up bonus when a goal takes longer than planned.
- Editor: “Kingdom” example with one click, time preview (how long a sensible player needs per goal,
  warning above a set number of minutes), test run with fast-forward, problem list.
- In the game: key K or pause menu, its own designable window, progress bar for the current goal,
  “While you were away” yield on loading.
- Conditions “Building level”, “Building goal reached”; actions “Open building screen”, “Upgrade
  building (free)”, “Skip time (production)”. Skill tree area “Building” (more production, cheaper
  upgrades, more per click). Plugins: hooks `onBuild`, `onMilestone`, bonus keys `idle.*`.

## 0.6.10 – Stability
Fixes from the technical review of 0.6.9, each with a new automatic test:
- Large videos and music are streamed in parts instead of being read into memory completely; seeking
  in long videos uses byte ranges.
- Saving counts changes: edits made while saving are no longer shown as “Saved”, and closing the window
  first saves anything pending.
- Exported games keep their save games per game (title + project ID); saves from older versions are
  taken over.
- Finished sound elements are removed from the audio management right away.
- The performance check of long scenes only looks at steps where something changes and reuses results.
- Closing a battle while the player is choosing ends it cleanly.
- Plugins: hook `onUnload`, plus `ctx.listen`, `ctx.every`, `ctx.onCleanup` – the engine removes
  listeners and timers when a plugin is reloaded or switched off. Plugin files are only written in the
  editor and only as .js.
- Battle simulation runs in small steps with progress, the editor stays usable.
- Narrow windows: the project name shrinks instead of overlapping the buttons.

## 0.6.9 – Combat
- New game system “Combat” (Game systems → Combat): classic turn-based battles in side view,
  party of up to four heroes, up to six enemies. Started with the action “⚔ Start battle” on a
  dialogue line, an answer or a hub object.
- Heroes with levels, experience and stat growth; abilities learned at a level; enemies with
  behavior (random, smart, attacks the weakest, attack only), XP, money and loot tables.
- Abilities: physical and magic attacks, heal, revive, buffs and debuffs, one or all targets,
  elements with weaknesses and resistances, MP cost. Items can heal, restore MP, revive or damage.
- Simple, replaceable animations: lunge, cast, hit, slash, fire, ice, thunder, rocks, light, shadow,
  healing; own effect image and sound per ability. Damage numbers, critical hits, turn order bar.
- Victory, defeat and escape lead to their own scenes (shown in the Paths view). After a defeat:
  “Try again”, “Retry in story mode” or “Give up” (game over or the story continues).
- Story mode for easier battles (player setting). Battle music, victory and defeat music, sounds.
- Editor: example with one click, test battle at any party level, “Simulate 100×” with win chance
  for ten party levels. Problems are listed.
- Party screen (key G or pause menu). Conditions “Battle won”, “Battle lost or fled”, “Hero in the
  party”, “Level of a hero”; actions “Start battle”, “Hero joins/leaves the party”, “Heal party”,
  “Give experience”.
- Skill trees: new area “Combat” (raise party stats, more experience). A hero can write their level
  into a variable, so a skill tree gives points on level-up.
- Plugins: hooks `onBattleStart`, `onBattleEnd`, bonus keys `combat.*`.

## 0.6.8 – Skill trees
- New game system “Skill trees” (Game systems → Skill trees): any number of trees, each paid with
  money, level-up points (from a variable) or its own points. Respec with full or half refund, or off.
- Skills with levels, rising cost, requirements (all / one of), story gates (“only after chapter 2”),
  hidden and master skills. Templates: two branches, three branches, ring.
- Effects take hold immediately: more money, cheaper shops, better selling, more relationship points
  (all or per character), better gifts, more job pay, faster travel, better minigame scores, stats,
  any actions. Areas can be ticked off per tree.
- Editor: drag skills on a canvas, connect them, problems are listed (no effect, unreachable …),
  total cost per tree, “▶ Try it” plays the tree with test money.
- In the game: key T or pause menu, its own designable window (Design → Game systems → Skill tree).
- Condition “Skill bought”, actions “Give skill points”, “Give skill”, “Open skill tree”.
- Plugins: `ctx.bonus(key, value)`, hook `onSkill`, own areas and effects (`skillCats`, `skillEffects`).

## 0.6.7 – Foundation
- Project format version: projects from older versions are converted on opening, with a backup of
  the project file (`project.backup-format0.json`). Projects from a newer version ask before opening.
- Undo stores only what changed per step: 100 steps even for large projects, and faster.
- Transcript stays smooth with thousands of lines (rows load while scrolling).
- Text import: paste dialogue as `Name: Text` or a Ren'Py script; speakers, narration, choices and
  scenes are recognized, Ren'Py jumps become connections, preview before importing.
- Test suite (`npm test`): 13 projects from 0.3 to today are loaded, converted, opened in every view,
  played, saved, reloaded and exported as a web game.
- English interface no longer partially translates project content (scene names, dialogue, file names).

## 0.6.6 – English and German
- The whole interface is available in English and German: menus, windows, hints, tour, tutorial, Learn mode,
  messages and system dialogs. English is the default language.
- Switch on the start screen (top right) or under Project ▾ → Language. The choice is remembered.
- New, example, tutorial and learning projects are created in the chosen language.
- In-game menus follow the game’s language. Dialogue and answers are never changed.
- English plugin guide (`templates/PLUGINS.en.md`), English `README.txt`.
- Prepared for GitHub: MIT license, third-party notices, README, changelog.

## 0.6.5 – The big assortment
- Players: history, auto mode, skip, reading & accessibility options, gallery, achievements, stats,
  name input with `{placeholders}`, using and combining items, knowledge across playthroughs.
- World & locations: world map with pins and submaps, home, events at locations, free time.
- Quest log: quest series → quests → sections, red checks in the editor, designable notifications
  (including “shatter”), jingles, relationship pop-up.
- Plugins: own conditions, pause-menu entries, HUD, placeholders, new hooks, `ctx.store` / `ctx.global`.
- New scene transition “screen shatters”.

## 0.6.4 – Fixes
- Security: symlinks can no longer point outside the project; export validates file paths; only files you pick or drop are copied in.
- Conditions with invalid comparisons count as broken instead of throwing errors.
- Several voices at once: music stays ducked until the last voice ends; per-character lip sync.

## 0.6.3
- File access checked by the main process; exported games only write save games.
- Broken conditions (deleted references) count as not met and are listed in Paths.
- Categories manager, shop layouts, design of all game-system windows, chapters and search.

## 0.6.2
- Minigames tab with “▶ Try it”, bundled plugins update themselves, particle fixes.

## 0.6.1
- Bones without WebGL about 27× faster, missing-file warnings, player split into modules.

## 0.6 – Life simulation & minigames
- Time & calendar, money & shops, relationships, gifts, Jobs and Minigames plugins.

## 0.5
- Performance traffic light, graphics quality settings, developer console, crash-safe saves,
  extra tracks, sound settings, endless scrolling backgrounds, eye effects, weight painting, Learn mode.

## 0.4
- Design system, tutorial and tours, export settings, keyframes, camera track, lip sync, layer characters,
  lighting, particles, filters, text effects, chat mode, glossary, voice filters, animation editor.
