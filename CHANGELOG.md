# Changelog

All notable changes. German details: `LIES MICH.txt`.

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
