# Plugins for VN Timeline Engine

A plugin is a JavaScript file in the `plugins` folder of your project.
The engine loads all enabled plugins when the project is opened and includes them when you export.
In the editor under **Game systems → Plugins** you can turn plugins on and off and edit their code directly.

## Skeleton

```js
VNPlugin.register({
  id: 'my_plugin',            // unique, only letters/digits/_
  name: 'My plugin',
  version: '1.0',
  description: 'What the plugin does',
  actions: { ... },           // your own actions (see below)
  hooks: { ... }              // events in the game (see below)
});
```

## Your own actions

Every action appears in the editor everywhere under **+ Action** (answers, dialogue lines, hub objects).

```js
actions: {
  roll: {
    label: 'Roll a die',
    params: [
      { key: 'sides', label: 'Sides', type: 'number', default: 6 },
      { key: 'target', label: 'Result into', type: 'var' }
    ],
    run(params, ctx) {
      const roll = 1 + Math.floor(Math.random() * params.sides);
      ctx.vars.set(params.target, roll);
      return ctx.message('You roll a ' + roll + '!');   // Promise = the game waits
    }
  }
}
```

**Parameter types:** `number`, `text`, `select` (with `options: [['value','Label'], …]`),
`var`, `item`, `currency`, `scene`, `image`, `audio`.

**Swappable images:** a parameter of type `image` shows an image picker with preview in the editor.
In code, `ctx.asset(params.myImage)` returns the address of the chosen image (empty if none is chosen).
This way users can change your minigame’s graphics without touching the code. Example: `schlossknacken.js`.

If `run` returns a **Promise**, the game waits until it resolves. That’s how you build minigames.

**Minigame result:** mark the action with `minigame: true` and return `{ score: 0…1, ok: true/false }` at the end
(or simply a number 0…1 or true/false). It then shows up e.g. in the Jobs plugin as a selectable minigame,
and the pay depends on `score`. Examples: `minispiele.js`.

## Your own tab in the editor

```js
editorTab: {
  label: 'My system',
  render(body) {            // body = empty area under “Game systems → My system”
    const d = VN.project.pluginData.my_plugin = VN.project.pluginData.my_plugin || {};
    body.appendChild(VN.el('p', null, 'Settings …'));   // always make changes inside VN.mutate(() => { … })
  }
}
```

A complete example with a list, conditions and tables is `jobs.js` – feel free to copy it as a template for your own
systems like training, studying or adventures.

## The context `ctx`

| Function | Meaning |
|---|---|
| `ctx.vars.get(nameOrId)` / `ctx.vars.set(nameOrId, value)` | Read and set variables |
| `ctx.items.count(x)`, `ctx.items.give(x, n)`, `ctx.items.take(x, n)` | Items |
| `ctx.money.get(x)`, `ctx.money.add(x, n)` | Currencies (n may be negative) |
| `ctx.asset(name)` | URL of a project file (e.g. for your own images) |
| `ctx.sound(name, volume)` | Play a sound |
| `ctx.overlay({ width, design })` | Open a window over the game, returns `{ el, close }`. With `design: 'myplugin.window'` it gets the matching look right away |
| `ctx.design(key)` | Design of your window: `.apply(el)` colors/frames it, `.image('slot', params.image)` returns the image (an image on the action wins, otherwise the default image from the design) |
| `ctx.message(text)` | Message with a “Continue” button (Promise) |
| `ctx.el(tag, attributes, ...children)` | Small helper for building HTML |
| `ctx.project`, `ctx.state`, `ctx.lang` | Project data, game state, active language |
| `ctx.time.advance(n)`, `ctx.time.text()` | Advance game time by n time slots (when “Time & calendar” is on) |
| `ctx.rel.add(character, n)`, `ctx.rel.get(character)` | Relationship values (when “Relationships” is on) |
| `await ctx.run('plugin.action', params)` | Start another plugin action, e.g. a minigame. Returns `{ score, ok }` |
| `ctx.data(id)` | Your plugin’s saved settings in the project (object, free to fill) |
| `ctx.store()` | Your own area in the **save game** (saved and loaded with it) |
| `ctx.global()` | Your own area **across all playthroughs** (stays even after “New game”) |
| `ctx.check(conditions)` | Check conditions, e.g. `[{ type: 'seen', scene: 's2' }]` |
| `ctx.act(actions)` | Run engine actions, e.g. `[{ type: 'giveItem', item: 'it_rose', count: 1 }]` |
| `ctx.listen(target, type, fn)`, `ctx.every(ms, fn)`, `ctx.onCleanup(fn)` | Event listeners, timers and other lasting things that the engine removes by itself when the plugin is reloaded or switched off |
| `ctx.bonus(key, value)` | Value with all skill tree bonuses, e.g. `ctx.bonus('job.pay', 100)` → 110 with “+10 % pay” |

Sizes in overlays are best given in `cqh` (percent of the game height), then everything fits at any window size.

## Your own conditions, menu, display and placeholders

```js
VNPlugin.register({
  id: 'courage', name: 'Test of courage',
  // Appears in every “Only if” as “Test of courage: courage at least”
  conditions: {
    brave: {
      label: 'Courage at least',
      params: [{ key: 'value', label: 'Value', type: 'number', default: 3 }],
      check(p, ctx) { return (ctx.store().courage || 0) >= p.value; },
      text(p) { return 'Courage ≥ ' + p.value; }
    }
  },
  // Button in the pause menu, optionally with a key
  menu: [{ label: 'Courage book', key: 'm', run(ctx) { return ctx.message('Your courage: ' + (ctx.store().courage || 0)); } }],
  // Display at the top of the game (text or element)
  hud(ctx) { return '🦁 Courage ' + (ctx.store().courage || 0); },
  // {courage} in dialogue lines and answers
  placeholders: { courage: (ctx) => ctx.store().courage || 0 },
  actions: { more: { label: 'Courage +1', run(p, ctx) { const s = ctx.store(); s.courage = (s.courage || 0) + 1; } } }
});
```

Parameter types for actions and conditions: `text`, `number`, `check`, `select` (with `options`), `var`, `item`,
`currency`, `scene`, `image`, `audio`.

## Your own design (frames, colors, default images)

Register your windows, then they appear under **Design → Game systems** and via right-click
on the window (“Change design”). Without their own settings they inherit from the system window;
minigame plugins inherit from “Minigames (all)”.

```js
VNPlugin.register({
  id: 'fishing',
  designs: {
    pond: { label: 'Fishing', icon: '🎣', images: [['imgFish', 'Fish'], ['imgRod', 'Fishing rod']] }
  },
  actions: {
    play: {
      label: 'Fishing', minigame: true,
      params: [{ key: 'imgFish', label: 'Fish image', type: 'image', default: '' }],
      run(params, ctx) {
        const o = ctx.overlay({ width: '50%', design: 'fishing.pond' });
        const fish = ctx.design('fishing.pond').image('imgFish', params.imgFish);
        // fish is an image URL or '' → then draw your own graphics
      }
    }
  },
  // optional: start values for “▶ Try it” in the editor
  tryPrepare(action, params, state) {}
});
```

## Your own skill tree effects

A plugin can bring its own areas and effects. They appear in the skill editor under “+ Effect”.
Read the bonus key in your own code with `ctx.bonus(key, value)`.

```js
VNPlugin.register({
  id: 'fishing',
  skillCats: [{ key: 'fishing', label: 'Fishing', icon: '🎣' }],
  skillEffects: {
    moreFish: { cat: 'fishing', label: 'More fish', params: [['pct', '+ %', 'number', 10]],
      key: () => 'fishing.catch', mode: 'pct', value: (e) => Number(e.pct) || 0,
      text: (e, level) => '+' + e.pct * level + ' % fish' }
  },
  actions: { play: { label: 'Fishing', run(p, ctx) { const fish = Math.round(ctx.bonus('fishing.catch', 3)); /* … */ } } }
});
```

Built-in bonus keys: `money.gain` (also `money.gain:<currency>`), `shop.buy`, `shop.sell`, `rel.gain` (also `rel.gain:<character>`),
`gift.gain`, `job.pay`, `travel.time`, `minigame.score`, in building `idle.prod` (also `idle.prod:<building>`), `idle.cost`, `idle.click`, in combat `combat.hp`, `combat.mp`, `combat.atk`, `combat.def`, `combat.mag`, `combat.spd`, `combat.xp`.

## Security – please read

Plugins are program code and run with the same rights as the engine’s interface. The engine
prevents a plugin from reading or writing outside the project folder, opening foreign websites
or storing anything other than save games in the finished game. A real separation between plugins
and the engine (individual permissions per plugin) does not exist yet. So a plugin can change anything in the
project and do anything the interface can do.

Therefore: **only install plugins from sources you trust** – just like Ren'Py scripts or
mods. Take a look at the file first, it is plain JavaScript.

## Hooks

```js
hooks: {
  onStart(ctx) {},                 // new game started or save game loaded
  onSceneEnter(scene, ctx) {},     // a scene begins
  onBeat(scene, beat, ctx) {},     // a step in a story scene begins
  onLoad(ctx) {},                  // a save game was loaded
  onChoice(answer, choice, ctx) {}, // the player chose an answer
  onItem(itemId, count, ctx) {},   // an item was received
  onUseItem(itemId, object, ctx) {}, // an item was used (object = hub object or null)
  onTime(ctx) {},                  // time has passed
  onDayEnd(oldDay, newDay, ctx) {}, // a new day has begun
  onLocation(locationId, ctx) {},  // a location of the world was entered (World & locations)
  onSkill(treeId, skillId, level, ctx) {}, // a skill was bought (skill trees)
  onBattleStart(battleId, ctx) {},  // a battle begins
  onBattleEnd(battleId, result, ctx) {}, // battle over: 'win', 'lose' or 'flee'
  onBuild(buildingId, level, ctx) {}, // a building was built/upgraded (building system)
  onMilestone(goalId, ctx) {},     // a building goal was reached
  onUnload(ctx) {}                 // before the plugin is reloaded or switched off: clean up
}
```

## Tips

- You see errors in the editor with **Ctrl+Shift+I** (developer console).
- After saving in the built-in code editor, the plugin is reloaded immediately.
- Plugins can do everything the engine can. Only share and use plugins you trust.

## Your own tours (help in the editor)

A plugin can bring a short tour for its features. It then appears under the ? button.

```js
if (window.Tour) Tour.register('my_plugin', {
  title: 'My plugin',
  steps: [
    { target: '#center', title: 'Hello!', text: 'This is how my plugin works …', pos: 'inside' }
  ]
});
```

Note: the engine’s own interface is written in German and translated to English at runtime.
Labels in your plugin are shown exactly as you write them.
