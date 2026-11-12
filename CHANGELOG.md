# Changelog

All notable changes. German details: `LIES MICH.txt`.

## 0.9.33 – Set templates
- **Room templates:** “+ New set” now offers templates – office floor, classroom, school hallway, corridor, hallway,
  living room, kitchen, bathroom, bedroom, shop and a whole flat. They contain only the rooms (walls, floors, ceilings,
  doors, windows, edges, zones and ceiling lights), no images and no furniture. Also in the **asset library** under
  “🏠 Sets” – select and “Import into project”.
- **Openings as data:** windows and doors are stored on the wall and cut out of any image automatically – you no longer
  have to make them transparent in the PNG yourself. Add, move and resize them in the inspector (“Openings”).
- **Drawing with the pen** (face rig, soft physics): a bar at the bottom of the stage shows the number of points with
  “✓ Done”, “↶ Undo point” and “✕ Cancel” – no keyboard needed. Points and handles now stay the same size on screen when
  zooming, and the editing stage uses the full window height.
- **Character scale:** new rooms are built to match a character that fills the screen from head to hip (room height
  about 1.5 × the character, doors slightly taller than the character, wide rooms). Existing sets keep their scale.

## 0.9.32 – 3D sets (rooms from PNG planes, with light)
- **New tab “Sets”:** build a real room from PNG planes – back walls, floors, ceilings, partition walls, beams, furniture,
  backgrounds and particle planes. Every plane has a position X/Y/Z and a rotation; the camera looks in with perspective,
  so parallax happens by itself. Left the scene through the camera, right the same room from an oblique view (like the
  custom view in After Effects) with the camera cone, scroll range and zones; move planes and lamps with X/Y/Z arrows.
- **Building:** “Whole room”, back wall, floor (tilted 90°), ceiling, partition wall (turned 90°), beam with **“Snap to
  wall edge”** – it then moves exactly with the wall edge when scrolling and hides the thin line. Planes in front of the
  character plane are drawn in front of characters automatically.
- **Light:** lamps, spotlights (direction, cone, soft edge, visible light cone in the air) and neon tubes, each with colour,
  strength, range and shadows; window light (sun/moon) that shines through the transparent
  areas of a wall PNG – walls, floors and ceilings block it, furniture and characters don’t. Blinds on a wall make the light
  fall in stripes, plus optional light shafts in the air. Lamps switch on and off by time of day; sun colour and direction
  follow the time of day (or set them by hand). Light is baked once per time of day – it costs nothing while playing.
- **Characters in depth:** “Depth in the 3D set” on a character clip places the character further back (smaller, slower
  parallax) or further forward (bigger, in front of beams and plants). Idle animations, blinking and lip sync keep working.
- **Characters in the light:** with “Match characters to the light” on the background clip each character gets the light of
  its spot in the room – warm next to a lamp, pink by the neon tube, bluish in moonlight.
- **Time of day:** planes without lighting are tinted automatically; optional own images per time of day (e.g. a sky with
  stars at night).
- **Particles:** a particle plane (rain, snow …) placed in depth – visible through windows with matching parallax.
- **Scenes and hubs:** pick a set on the background clip or as hub background. Camera clips pan through the room with real
  depth. **Edge scrolling:** in hubs (and in scenes with the box ticked) the camera scrolls when the mouse reaches the screen
  edge, within the set’s scroll range; hub objects move along. **Zones** change music and loop an ambience when the camera
  enters them.

## 0.9.31 – Face rig (expressions on a single image)
- **Figures → Face:** facial expressions directly on one flat character image – no image swapping. The engine bends the image
  with a fine mesh, only inside the mouth mask; nose and chin stay still.
- **Set up with the pen and lasso:** trace the upper lip (and the lower lip for an open mouth – points snap onto the dark line),
  optionally draw around the jaw and set the jaw joints in front of the ears, trace the lash line and lower lid per eye and the brows.
  A stamp source over smooth skin (placed automatically between the eyes) provides the eyelids.
- **Mouth:** smile, sad, grin, lopsided grin, pout, open (the jaw turns around its joints and the chin goes along), built-in mouth
  interior that fits the opening exactly (colour, tongue, teeth) or the interior from the image.
- **Eyes and brows:** closing lids made from stamped skin – soft on the left, right and top, hard at the lashes; the lashes move down
  column by column and keep their shape. Lower lid (squint), smiling eyes ^^, brows up/down and slanted.
- **Expressions:** Neutral, Smile, Happy ^^, Sad, Angry, Tired, Grin, Lopsided grin, Pout, Surprised – plus own expressions:
  set the sliders and drag lip and brow points into position (“Shape points”), strength 0–150 %.
- **In the game:** expression on the character clip (inspector) – blends smoothly when the next clip changes it; action
  **“🙂 Face: expression”**; lip sync opens the real mouth with the voice volume; the character blinks by itself (sometimes twice);
  works in story scenes and cutscenes (expression per actor) and together with soft physics on the same image.

## 0.9.30 – Zoom in every editor
- The mouse-wheel zoom now also works in **Lip sync**, **Layers & outfits**, the **website editor** (Ctrl + wheel, plain wheel
  still scrolls long pages), the **device preview** and the **idle map**.
- **Jointed puppets** (incl. inpaint masking) already zoomed with the wheel – now you can also **pan** there with the middle mouse
  button or Space + drag.
- **Pixel art:** the wheel zooms without Ctrl, the pixel under the mouse stays in place; pan with the middle mouse button or Space + drag.

## 0.9.29 – Mouse-wheel zoom everywhere; twitch & heartbeat for soft physics
- **Zoom with the mouse wheel** in every preview: scene, hub, cutscene animation, design, main menu, bones and soft physics.
  Zooms towards the mouse position (50 %–800 %); **pan** with the middle mouse button or Space + drag; the badge in the corner
  shows the zoom level – click it to return to 100 %. The zoom is kept per area while you work. Dragging figures, objects and
  points stays exact while zoomed.
- **Timeline:** Ctrl + mouse wheel zooms the scene timeline at the mouse position (plain wheel still scrolls).
- **Soft physics – tense twitching:** a slider makes an area twitch in short, irregular jolts (sometimes twice in a row) with a fine
  tremor – stronger = more often and harder.
- **Soft physics – pulse:** the area swells briefly to a heartbeat (“lub-dub”); strength and beats per minute adjustable.
  Both work with every preset and can be combined with breathing, swaying or wave.

## 0.9.28 – Soft physics (jiggle presets for masked areas)
- **Figures → Soft physics:** mask a part of a character image and pick a preset – *Chest, Butt,
  Belly/breathing, Hair, Cloth/skirt, Ears/tail, Cheeks, Jelly* – and that part bounces, sways and breathes along when the figure moves.
  The PNG is **not cut up**: a fine mesh lies over the whole image and only the points inside the mask move, with a soft edge;
  everything outside stays still. The mask belongs to the image, so it follows the character everywhere.
- **Mask tools like in After Effects:** *Ellipse*, *Lasso* (draw freehand around the spot, smoothed on release) and *Pen*
  (click = corner, click-drag = round point; close on the first point, double-click or Enter). Afterwards drag points,
  double-click the outline to add one, right-click or Del to delete, Alt-click to switch corner ↔ round; round outline on/off;
  convert an ellipse into a free shape to refine it. The soft edge follows the drawn outline.
- **Anchor point & pendulum:** set a pin anywhere (also outside the mask, e.g. where a tail leaves the body) – the farther from
  the pin, the more it swings, in any direction. **Pendulum** really rotates the area around the pin; the anchor strength sets
  the bending (0 = rigid like a sword, 1 = bends towards the tip like a tail). New preset *Tail / ponytail (pendulum)*.
- Per area: strength, stiffness, damping, sideways motion, squash, soft edge, **beyond the edge** (motion may spill past the mask),
  anchor (fixed at top/bottom/left/right) and idle motion (breathing, swaying, wave). **As its own layer** puts a copy of the area on top,
  so it can swing over the body. “↔ Copy mirrored” for the second side.
- **Test mode** in the editor: hop, shake, walk, nudge or drag the character around with the mouse.
- Works for plain image figures in story scenes (also with blinking) and in cutscenes; reacts to any movement of the figure
  (keyframes, steps, jumps, shake). New action **“〰 Nudge soft physics”** for a targeted push.

## 0.9.27 – Idle layouts, full screen, advisor; mouth tool removed
- **Idle (Aufbau) layouts** to choose from: *Cards* (as before), *List* (one row per building with a work bar and buy ×1 / ×10 / Max –
  like AdVenture Capitalist), *Clicker* (a big object to click, shop on the side – like Cookie Clicker) and *Map / village*
  (buildings placed freely on a background image, click to upgrade; placement by dragging in the editor).
- **Full screen** option instead of a window.
- **Price & profit curves** to choose from: exponential (× per level), power/quadratic, softly braked, linear; profits even, snowballing
  or flattening; plus **jumps** (profit × at level 25, 50, 100 …). Presets after known idle games – Classic, AdVenture Capitalist
  (×1.07–1.15, ×2 at 25/50/100/200/300/400), Cookie Clicker (×1.15), Gentle, Softly braked, Story (linear), Snowball –
  each building can override the curve. A chart shows price, profit and payback time per level.
- **Advisor:** a character in a small window with a speech bubble – lines for first opening, opening, after building, not enough money,
  goal reached and in between; with conditions and “only once”. Shrinks to a small portrait when silent; click it for another tip.
- The **mouth & lip line** for cutscene figures (0.9.26) has been removed again. Projects that used it still open and play;
  the figure is simply drawn normally and the object is no longer cut off.

## 0.9.26 – Mouth & lip line (side and POV)
- **Mouth for cutscene figures** (simple PNG, also images with bones): set upper lip, lower lip and jaw joint.
  An object linked to the mouth (straw, spoon, carrot …) is **invisible behind the lips** and the **lower jaw opens exactly as far as
  the object is wide** at that point – the width is measured automatically from the object's image along its axis (grip → tip).
  Behind the open jaw: a mouth-inside image or color, only within the figure. Jaw size, area and maximum opening adjustable;
  with bones the lip line follows a bone (idle, head movement).
- Two views: **side (profile)** – the lower jaw swings around the joint – and **front (POV)** – set both mouth corners and the chin;
  the jaw drops as far as the object is wide, and the part already in the mouth is only visible through the opening.

## 0.9.25 – Starter pack: 78 free images in the asset library

- **Starter pack** in the 📚 asset library: 78 ready-made images (256 × 256, transparent PNG) in an anime look with
  clean outlines and cel shading – free to use under **CC0**, even in games you sell, no credit needed.
  - **Phones:** 4 colors (navy, black, white, rose) × 5 views (front, back, side, angled front, angled back).
  - **58 everyday items:** money (banknote, money stack, gold and silver coins, coin stack, wallet, bank card,
    piggy bank, gemstone), flowers & plants (rose, bouquet, tulip, sunflower, potted plant, cactus, cherry blossom branch),
    food (apple, banana, bread, croissant, onigiri, burger, pizza, donut, strawberry cake, ice cream, fried egg, cheese,
    strawberry, bento box, ramen, chocolate), drinks (coffee to go, teacup, water bottle, milk carton, soda can, orange juice,
    bubble tea), everyday (book, notebook, pencil, letter, glasses, wristwatch, backpack, umbrella, key, headphones,
    lipstick, candle, light bulb, camera) and gifts (gift box, love letter, box of chocolates, ring box, teddy bear).
- Filter **All / My files / ⭐ Starter pack** and folders per category; names and folders follow the interface language
  (English, German, Spanish, Japanese). One click fetches them into the project (folder “Library/Starter pack/…”).
- The pack ships with the engine (desktop and web version) and can't be deleted by accident.

## 0.9.24 – Feedback packages 1 + 2: followers as a mechanic, live chat, stamina, masks, design templates, asset library and more

### Package 2
- **Followers as a game mechanic:** growth per day, per week or on a weekday (% that compounds, or a fixed number), with conditions;
  negative values make followers drop. Link a contact's followers to a **currency** – then they can be spent, produced in the idler
  and shown in the HUD; idler and social media share the same number. Profiles show “+12 today”.
- **Live chat for stream scenes:** a chat bar with prepared messages that appear at different gaps (with some randomness),
  chatters in colors (random or fixed), viewer count, clickable replies with actions, “many at once” paste (Name: text),
  preview; action “📺 Live chat” start/stop and condition “Replied in live chat”.
- **Stamina & tiredness** (optional system): bar or icons, own icon image, costs for minigames and trips, action and condition,
  recovery per time of day or full on a new day. Tired effect: eyes briefly close, blurry edges, yawn sound.
  Empty: eyes close, optional text, time passes, wake up in a hub or hub dialog.
- **Masks per actor** in cutscenes: rectangle, ellipse or free shape (pen points), invert, keyframable (move, size, rotate) –
  e.g. an arm that disappears behind another figure.
- **Design templates:** 8 phone and 6 computer looks (gradients, glass panels, icon styles, fonts, bubble shapes) and
  6 website page templates (shop, blog, profile, news, guild with watchword, login portal).
- **Asset library:** store images, sounds, videos and fonts once (📚 next to “Import”) with folders and search,
  and fetch them into any project with one click. Desktop: in your user folder; web version: in the browser.

### Package 1
- **Fix:** speech bubbles with your own background keep their **rounded corners**, and the shape sliders work again.
  New option “Image fills the bubble” for a background picture without a 9-slice frame.
- **Portraits in bubbles:** square, rounded or round, corner radius, size, drop shadow, border, left or right.
- **Transcript** now lists texts from apps, contacts, social media (posts, comments, replies, bios) and websites
  (texts, placeholders, error messages, search results, hints), so they can be translated.
- **Website images:** blend modes (multiply, screen, add, overlay, difference …) and **blur** –
  optionally blurred until conditions are met (e.g. unlock a picture), with a label on top.
- **Minigame rewards:** every minigame action gets “Reward on win” and “Consequence on loss” –
  any actions: items, money, relationship, followers, variables …
- **Animation editor:** drag a box over keyframes, Shift/Ctrl-click to add, move many keys at once,
  **Ctrl+C / Ctrl+V** (paste at the playhead, or onto another selected bone/part), Del deletes.
  Move the **whole figure** in idle and gesture animations too (also in the game); Alt + drag works over bone handles.
  **Duplicate actors** with their animation, and move actors forward/backward.
- **Hub objects can idle:** float, bounce, breathe, sway, blow in the wind, glow, flicker, shake, spin –
  with duration and strength. Images with bones can breathe/jiggle and play an idle animation.

## 0.9.23 – Website editor: bigger canvas, rulers and guides, shadows, transparency
- The canvas of the page editor can be made **bigger or smaller** with the bar next to it (up to 1400 px).
- **Rulers** on top and left: click or drag to add guides; guides can be moved or dragged off to delete.
  Elements **snap** to guides, page edges and the center (edges and middle of the element); Alt = no snapping.
  Button “Margins + center”, show/hide guides.
- **Drop shadow** for texts (on the letters), images (follows transparent PNGs), buttons and shapes, with color.
- **Opacity** for the background color of shapes, texts and buttons (e.g. a half-transparent bar over a picture).

## 0.9.22 – Browser with your own websites
- New device app **Browser** for phone and computer: address bar, back, home page with bookmarks, 404 page.
- **Websites** (Game systems → Websites): every site has an address (e.g. www.gildenmarkt.ra), any number of pages,
  and can be secret (only reachable by address, link or search) or locked by conditions.
- **Free page editor** like the menu designer: texts, images, buttons, shapes and input fields placed and resized
  freely with the mouse; background color or image, page length (scrolls in the game), colors, fonts, size, bold,
  alignment, corners and border per element; layer order, duplicate.
- **Links and actions:** texts, images and buttons link to other pages or run actions (buy, start scene …).
- **Password fields** (answer fixed or from a variable, message when wrong, page and actions when right) and **search
  fields** (terms → results). Conditions “🌐 Web page visited” and “🔑 Password entered”; elements can be shown by
  condition. “📱 Open device” can jump straight to a page.
- Newcomer help: tip box and 💡 guide with examples (secret mailbox, search engine, shop).

## 0.9.21 – Social media app
- New device app **Social media** (name freely chosen, e.g. “Pixgram”): contacts post text and pictures, other
  characters like and comment. Feed, profiles with bio and followers, notification with click-to-open.
- Posts appear automatically when their conditions are met, or via the new action **📸 Post** – after a choice, at a
  location, after a minigame, as a quest reward. **🗑 Delete post** removes one again (great for clues).
- The player likes posts (an action can run once, e.g. relationship +2) and comments with prepared replies (with actions).
- **👥 Change followers** (+/−, percent or set) and a matching condition – followers grow with the story.
- New condition **📸 Post** (visible, not posted yet, deleted, liked, commented). Editor: Game systems → Social media,
  with preview.
- Works on the in-game **phone and computer** (own window on the desktop). **Page design:** colors for background,
  header, posts, text, accent and heart, a logo instead of the name, header and background images, fonts, corner
  rounding, and presets (dark, light, retro, neon).
- **Links:** @Name in posts, comments and bios opens that profile (names with spaces work), #topic shows all posts
  with that hashtag.
- Newcomer help in the editor: a tip box with the 4 steps and a 💡 guide with examples and ideas.

## 0.9.20 – Reliability round (no new features)
- **Saving:** a save that fails or is refused is no longer treated as saved. When closing with unsaved changes that could
  not be written, the editor asks instead of quietly losing them.
- **Web games:** save slots now use the project’s fixed ID, so two web games with the same title no longer share saves;
  older saves are taken over once.
- **Export:** language codes are validated (in the project and in the exported HTML).
- **Web editor:** ZIP imports check project.json first, have size limits and remove everything again if the import fails;
  leftovers from older failed imports are cleaned up.
- **Plugins:** shipped plugins and mod approvals use SHA-256 instead of a short checksum (older exports still work).
- **Releases:** self-tests must pass before a release is built; Node 22; package-lock version kept in sync.

## 0.9.19 – Select body parts in the layers · frame selection in Paths
- **Animation editor:** click a body part (bone or puppet part) in the keyframe layers below to select it – the
  canvas, inspector and graph follow. Picking a part in the picture scrolls its layer into view.
- **Paths:** drag a frame around scenes to select several and move them together. Shift/Ctrl + click adds or removes
  single scenes, Ctrl + A selects all, Esc clears. Move the view with the right or middle mouse button or Space + drag.
  Moving a group is one undo step.

## 0.9.18 – Fitness minigames: barbell and dumbbells · curve graph for keyframes
- **Curve graph:** every transition from keyframe to keyframe now has a graph with two handles (Bézier) – drag them
  for your own ease-in/ease-out, overshoot or a hard stop; Shift keeps a handle flat, double-click resets. Works in
  the animation editor (bones, jointed puppets, movement, camera) and for keyframes and camera moves in scenes.
  New curve “Hold (jumps)”.
- **📈 Graph in the animation timeline:** shows the value of a row over time (e.g. X, rotation, zoom). Drag points
  to change value and time, click a transition and shape it with the handles right in the graph.
- **Barbell:** mash the space bar – every press lifts the bar a little, the weight pulls it back down. Reaching the
  goal line completes a rep. Difficulty, repetitions, time, displayed weight (e.g. “80 kg”). A power bar shows how
  fast you press; at full power the bar trembles.
- **Dumbbells:** a rhythm game. Left and right dumbbells go up and down to their own beat. When one is up in the
  zone, press A (left) or D (right) – perfect, good, too early, too late or missed, with combos. Rhythm alternating,
  asymmetric or irregular; optional speed-up; keys can be changed (arrow keys always work).
- Both: helper item, perks for skill trees and equipment (more power, larger target zone, more mistakes allowed), own
  images for the weights and background, every colour (bar, plates, tracks, target, perfect hits …) adjustable.

## 0.9.17 – Arcade: darts, pool, blackjack and slot machine · safe and pipes
- New bundled plugin **Arcade** (switch it on under Game systems → Overview). Three minigames that, like the others,
  end in a win or a loss (scene afterwards, result in a variable):
  - **Darts:** the crosshair floats over the board, click at the right moment. 301 or 501 (optionally finishing on a
    double) or highest score after X rounds; against an opponent or alone against a target score. Real board geometry
    for scoring. Board, dart, crosshair and background can be replaced with your own images.
  - **Pool:** aim with the mouse, press, pull back and swing forward – the faster the swing, the harder the shot.
    Real physics with cushions and pockets, guide line (long, short, off). 8-ball (solids/stripes, the 8 last, fouls,
    ball in hand) or “whoever pots more balls”; alone: pot all balls within a number of shots. Table, cloth, cue and
    each ball 1–15 can be designed.
  - **Slot machine:** 3–5 reels, 1 or 3 rows, 1, 3 or 5 paylines; symbols as emoji or your own images with a
    frequency each, payout table, wild symbol. Bets in a currency of your game or with play money. Cabinet colours,
    lights, lever and background – or your own cabinet image with the reel window placed where you want it. The
    editor shows the average payout and how often a spin wins.
  - **Blackjack:** hit, stand, double and split against the dealer; blackjack pays 3:2 or 6:5, dealer stands or hits
    on soft 17, 1–6 decks. Bets in a currency of your game or with play money. Any opponent can be the dealer (name,
    portrait, lines). Optional tips with the best move by basic strategy (also via item or skill-tree perk). Table and
    card back can be your own images.
- New minigames in **Minigames**:
  - **Safe / combination lock:** a safe with a dial (turn to the right number and lock it in), a keypad or a lock with
    number wheels. The code is fixed, comes from a variable (so it can be found in the story) or is random – the random
    code can be written into a variable and shown in the text. Help: listen for the louder click at the right number,
    and/or colours after a wrong try (right / wrong place / wrong). Attempts, time limit, helper item (stethoscope),
    images for door, dial and contents.
  - **Connect the pipes:** turn pieces until the line runs from left to right – water pipes, power cables or magic runes.
    Every board is random and always solvable; 4 × 4 to 8 × 8, optional time pressure and limited turns, your own images
    for the pieces.
- **Computer opponents** for darts and pool (Game systems → Arcade → Opponents): name, portrait, accuracy, feel for
  shot strength, tactics (works out darts checkouts, picks the easiest pool shot), thinking time, favourite target and
  lines at the start, on winning and on losing. Templates “Beginner”, “Pub pro” and “Master”; try every opponent
  right from the editor.
- **Everything designable:** every new game has its own design (Design → Game systems, or right click on the window
  while trying it): window colours, frame, background and font, default images – and new **colours in the game** for
  the built-in graphics (dartboard segments and rings, pool cloth, pockets and guide line, card faces, chips and
  buttons, reels and displays, safe body, door, dial, keys and display, pipe, empty and filled colour). New image
  slots: all 52 cards in one image (13 × 4 grid), chip, buttons, scoreboard, keypad, single key, combination lock,
  start and end of the pipe line. Plugins can declare such colours themselves (`colors` next to `images`).
- Skill-tree perks: steadier crosshair (darts), longer guide line (pool), blackjack tips, more time (pipes).
- Formulas and code: error messages are translated, names may contain any letters (ñ, é, Japanese), the code examples
  in the help follow the interface language. The AI guide describes everything new since 0.9.5.

## 0.9.16 – Pixel art, battle animations, code track, puppet folders
- Design → “🎨 Pixel art”: a pixel editor for drawing and animating frame by frame. Pen, eraser, fill, line,
  rectangle, circle, eyedropper and move layer; mirror drawing, onion skin, grid, Ctrl + wheel zoom, right click erases.
  Palettes (presets or your own colours – changing a colour changes it in every frame), layers, several animations per
  sprite with a frame strip (duplicate, empty frame, reorder, duration per frame) and a live preview. “Add to project”
  saves each animation as an animated GIF (or all of them as a sprite sheet) in your images, pixel-sharp and scalable
  ×1–×8, usable as a character, background, hub object or fighter. Updating replaces the file, so every place that
  uses it shows the new version. Sprite sheets from other pixel programs can be imported.
- Battles: fighters can use a rigged character or a jointed puppet with their own idle and their own animations for
  attack, spell, hit, defend, item, K.O. (holds the last pose) and victory. Every skill can have its own attacker
  animation and target reaction. Animations blend smoothly out of the idle and back (adjustable per fighter or skill).
  In the animation editor, “💥 Hit here” marks the moment where effect, damage and sound appear in battle.
- Story timeline: new “Code” track. A code clip runs once when its step begins, before the text appears, so {variables}
  already show the new value. One statement per line: `gold += 5`, `if courage > 3 and not fled: points += 1`,
  `[Door open] = true`, `give("Key")`, `take("Potion", 2)`, `earn("Gold", 10)`, `spend("Gold", 3)`, `goto("Market")`,
  `roll = random(1, 6)`, `# comments`. Errors are shown with their line number while typing; missing variables can be
  created with one click. The same is available as the action “🧮 Math / code” (dialogues, answers, hub objects), and
  formulas work as a condition “🧮 Formula”, e.g. `gold >= 10 and item("Key") > 0`.
- Puppet editor: folders for parts. Drag & drop parts and folders, nest folders, collapse, rename by double-click,
  hide or lock a folder in the editor (the game always shows everything), move blocks up and down, search parts.
  Folders only sort and set the drawing order – movement is still set by “Attached to”.

## 0.9.15 – Inpaint brush for jointed puppets
- Puppet editor: new “🖌 Inpaint brush”. Mask a gap on a part with the lasso, ruler or brush and fill it – no AI model
  needed. Colors come from the edge of the mask, from one chosen color or as a gradient between two points (A → B), also
  picked from another part. Softness is adjustable and still changes the result after filling; fills can be undone.
  Saved as a new image file, the original is kept.
- “More room at the edge” adds a transparent border to a tightly cropped part, so a gap outside the image can be filled
  too. The part, its joint, seams and hold points stay in place. Not available for parts with bones or blinking.

## 0.9.14 – Edit the bones mesh
- Bones & blinking: new tool “Edit mesh”. Every mesh cell is shown; click or drag over empty cells to add them
  (e.g. thin hair strands or tips that weren't detected) and over filled cells to remove them (e.g. excess border).
  Brush 1 cell or 3 × 3, “Reset” restores the automatic mesh. Edits apply to the current mesh density.

## 0.9.13 – Hold points, the seam becomes the joint
- Hold points for jointed puppets (“📌 Hold points” in the puppet editor): set points on body parts like pins on
  bones – palm, heel, knee. In the animation editor, double-clicking a point holds that spot in place: when you move
  the character, the spot stays stuck, the limbs bend towards it and where they don't reach, the image stretches.
  The reach of the stretch is adjustable per point.
- When you sew a part onto another one, the part now hangs on that part and turns around the middle of the seam –
  the old pin, which could lie anywhere in the image, no longer shifts it. The part moves with the image it is sewn
  to. For seams drawn earlier there is a button “📍 Put the joint on the seam”.
- Animation editor: Alt + drag on any part of a jointed puppet moves the whole character (like the yellow square and
  arrows); the help line now explains this. Sewing the main body part onto another part no longer hangs the whole
  character on it.
- Double-clicking a body part in the puppet editor now also works while building: it switches “Try out” on and pins
  the part right away.

## 0.9.12 – Seams for jointed puppets, fix for pinning limbs
- Seams: sew two overlapping parts of a jointed puppet together along a line (“🧵 Sew” in the puppet editor), e.g.
  thigh to hip or upper arm to shoulder. The seam points stick exactly to the other part, the rest follows its own
  joint, and the image bends smoothly in between – no more gaps or cracks at joints, also during idle, animation,
  stepped frame rates and smear frames. Softness and target are adjustable per seam.
- Seams between characters in cutscenes (“🧵 Sew on” in the animation editor): e.g. sew the hand of character 2 to
  the shoulder of character 1 – the hand then moves along with character 1.
- Fixed: double-clicking a body part of a jointed puppet (in “Try out” and in the animation editor) did nothing, so
  feet and hands could not be pinned. The editor redraws after the first click, which swallowed the double-click;
  the engine now detects it itself.

## 0.9.11 – Places: unlock by condition, lock while …, locked and gone
- World & places: a place can now be unlocked “if …” a condition is met (e.g. scene seen, item in inventory) and
  stays open afterwards.
- New column “Lock later”: “locked while …” locks a place as long as a condition is met (e.g. at night), “locked + gone”
  removes it from the map for good once the condition has been met (e.g. a burned-down house).
- The action “📍 Unlock / lock / remove place” has a third option “lock and remove from the map”. A removed place
  can't be unlocked again.

## 0.9.10 – Frame rate and smear frames for animations
- Frame rate for animations: smooth, 24, 12 (“on twos”, anime look), 8 (“on threes”, cartoon) or 6 frames per second.
  Set per animation, per character or as the project default (animation editor). Applies to idle animations, gestures,
  bones, jointed puppets and cutscenes from the animation editor, also in its preview and the video export.
  Dialogue, menus and camera moves stay smooth.
- Smear frames on very fast movements, like in cartoons: multiples (the fast body part appears two or three times),
  stretch (the part is pulled into a streak) and speed lines. Detected automatically via bones and puppet parts, with
  an adjustable speed threshold; per animation, per character or as the project default. In the animation editor you
  can also force a smear frame at a specific point in time.

## 0.9.9 – Light sources, TV filters (CRT, LCD, RGB split)
- New effect type “Light” on effect tracks and in hubs: spotlight, lamp / light circle, neon tube and backlight.
  Color, brightness, size or reach, beam width, direction, soft edge, haze in the light and flicker are adjustable;
  spotlights can sweep back and forth. The scene around is darkened, and the light brightens what it shines on.
- Light on characters: rim light from the side the lamp is on, and a color glow that gets stronger the closer a character
  stands to the light. Moves along when characters or the camera move.
- Backlight sits behind the characters: they become silhouettes with a glowing edge and a halo in the light color.
  “Silhouette” sets how recognizable the character stays.
- Dust specks in the light: float slowly and only light up inside the beam, in the light color (amount and size adjustable).
- Works with parallax: every light has its own depth and moves with its layer during camera moves; foreground layers
  stay dark in front of the light.
- Place lights with the mouse on the stage like hitboxes; spotlight and neon tube have a second point for direction
  and reach. In hubs, lights can depend on conditions (🔒, e.g. lanterns only at night) and also light up hub objects.
- AVIF images can now be imported in the desktop app too.
- New filter “CRT TV” on effect tracks: curved picture with round, dark edges, scanlines, flicker and a bright band
  that rolls from top to bottom. Curvature, scanlines, flicker, edges, band on/off and its speed are adjustable.
  Dialogue and menus stay sharp on top.
- New filter “LCD TV”: a fine grid of red, green and blue pixels and delicate lines, like a modern TV seen up close
  (strength, lines, grid size).
- New filter “RGB split”: red and blue shifted against each other, with adjustable offset, direction and optional
  jitter (glitch). Filters on several effect tracks combine, e.g. CRT + RGB split.
- With “Calm display” (accessibility) or reduced motion in the system, the band and flicker are switched off.

## 0.9.8 – Bones for layered characters, puppeteering with pinned limbs, firm joints, human template
- Layered characters (body, face, outfit) can now use bones: set up the bones on the image of the lowest layer and all
  layers above – face, clothing, accessories – bend and move along, even parts that stick out beyond the body (cape,
  wide skirt, hat). Idle animations, gestures, the animation editor, blinking and lip sync work with outfits.
- Jointed puppets: joints are anchored firmly. Attached parts only rotate around their joint and never slide away –
  also not when animating or bobbing. Dragging an attached part in the editor rotates it around its joint
  (Shift: 15° steps, Alt: move freely). Can be switched off per puppet (“Anchor joints firmly”).
- New template “Human” for jointed puppets: grey slots for head, torso, arms, hands, legs and feet, already connected
  with joints. Drag images onto the slots – they are fitted in and the joint stays – then adjust the proportions.
- Puppeteering like with a doll whose feet are glued to the floor: pin feet (or hands) with a double-click, then drag
  the body – pinned parts stay where they are and everything in between bends along. Body down = the figure kneels,
  body up = it stands up again, but only as far as the limbs reach. Shift + drag the body = lean. Works in “Try out”
  and in the animation editor, where every pose becomes keyframes.
- Joint limits per part (“Limit the joint”, from/to in degrees) so knees and elbows only bend one way; the human
  template comes with sensible limits.
- Ruler tool “📏 Lengths”: mark the length of each limb from joint to joint. Without a marked length, a limb reaches to
  the joint of the attached part.

## 0.9.7 – Packed game files
- New export option “Game files”: **Don’t pack** (as before – images, sounds and dialogue lie as normal files in the
  game folder, good for modding), **Packed** (everything encrypted in one file, data.vnpak – makes copying harder and
  prevents spoilers, but is not complete protection) or **Packed + mods** (packed, but a file in the “mods” folder next
  to the game replaces the file with the same name; a list of all files is put there for modders).
- Works for Windows and web games (in the browser and the desktop version). Packed web games need a web server
  (e.g. itch.io) and show a progress display while loading. Big videos and music are streamed from the package.
- Developer console: commands also work in English (help, jump, set, quality, particles, fps, reload, images, clear);
  in an English, Spanish or Japanese interface “help” lists these names.
- Translation fixes: Japanese day counter (“1日目”), consistent left/right for bones in Spanish, one term for “level”
  in Japanese.

## 0.9.6 – Web version: try the engine in the browser · Spanish and Japanese
- The interface is now also available in **Spanish** and **Japanese** (Español / 日本語 on the start screen or under
  Project ▾ → Language): menus, windows, hints, tour, tutorial, learning project and example project. Exported games
  show their menus in Spanish or Japanese when the game’s language is es or ja.
- The editor now also runs in the browser, without installing: https://thetalkingpegasus.github.io/vn-timeline-engine/
  Projects are stored in the browser (IndexedDB) – or, in Chrome and Edge, directly in a project folder on the PC,
  exactly like the desktop version. Tutorial, learning project and example project work as usual.
- “Project ▾ → Download as ZIP” saves the whole project (backup, or to continue in the desktop version);
  “Open project” opens browser projects, a folder (Chrome/Edge) or a ZIP file.
- Import by button or drag & drop, testing, plugins, bundled minigames and the web export (as a ZIP, ready for itch.io)
  work in the browser. The Windows export needs the desktop version.
- Built automatically from every change and published on GitHub Pages (tools/build-web.js, workflow “Web-Version”).
- With longer interface texts the tab bar at the top gets narrower instead of covering the logo and project name.
- Fixed: the clip inspector showed “Step 1 bis 5” in the English interface.

## 0.9.5 – Particles in hubs, how often hub events run, hard cut for characters
- Hub events (short lines or timeline dialogues) now have “When” (on entering the hub / as soon as “Only if” is met)
  and “How often”: only once, every time, at most … times, or once per day (with time system). An event never runs
  twice in one visit, also not when coming back from a hub dialogue. Older projects keep their behaviour.
- Hubs can have particles: rain, snow, dust, sparks, petals or fireflies, several at once, with amount, speed, size,
  wind and colour – optionally only under conditions (e.g. fireflies at night, snow in winter); they change as soon
  as time passes in the hub. Shown live in the hub editor. Properties of the hub → “Particles”.
- Fixed: switching a character picture set to “Instant” still showed a short fade from the old picture to the new
  one. The old picture now stays until the new one is ready and is then replaced in the same frame. A character
  whose entrance is “Instant” also disappears instantly.

## 0.9.4 – Messages can unlock things
- Every chat message can run actions when the player reads it – exactly once, like a dialogue line: unlock a
  location, give an item, start or advance a quest, change ♥ points, set a variable, or jump to a scene (the device
  closes and the scene starts). ⚡ button next to each message in Game systems → Messages.
- Scenes reached from apps, messages or replies count as reachable in Paths and the problem list.

## 0.9.3 – Messages per device, hidden messages, locked devices
- Silent conversations: no notification and no unread count – the player only finds them by looking
  (e.g. hidden mails on a PC). Checkbox “silent (hidden)” on the conversation.
- Devices can be locked with a code: digits give a number pad, anything else a password field (not case sensitive;
  a {placeholder} of a variable works too). “Enter correctly once, then always open” or “Enter every time”,
  with heading and hint. New condition “🔓 Device unlocked” and action “🔓 Unlock device”.
- A conversation can now be limited to certain devices: only the phone, only the computer, or all (default).
  Checkboxes “Appears on” in Game systems → Messages (shown when there is more than one device).
- Unread counts, notifications, replies and “read” work per device: reading on the phone does not mark
  computer-only messages as read. The timeline phone does not show computer-only chats.

## 0.9.2 – Quicktime minigame, spelling suggestions, reorder answers, fixes
- New minigame “Quicktime circle” (Minigames plugin 1.4): a hand spins, press Space/Enter/click while it is inside
  the marked area; the area jumps elsewhere after every hit. Difficulty (easy to extreme) sets speed and size of the
  area, both also adjustable by hand, plus hits needed, misses allowed, speeding up, direction change, time limit and
  own images. Easier with skill tree perks or worn equipment (bigger area, slower hand, more misses) or simply with
  a helper item in the inventory.
- Spelling: right-clicking a misspelled word in the editor now shows suggestions from the dictionary (on Windows the
  system dictionary) and “Add to dictionary”, plus cut/copy/paste.
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
