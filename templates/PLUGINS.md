# Plugins für die VN Timeline Engine

Ein Plugin ist eine JavaScript-Datei im Ordner `plugins` deines Projekts.
Die Engine lädt alle aktivierten Plugins beim Öffnen des Projekts und beim Exportieren nimmt sie sie mit.
Im Editor unter **Spielsysteme → Plugins** kannst du Plugins an- und ausschalten und den Code direkt bearbeiten.

## Grundgerüst

```js
VNPlugin.register({
  id: 'mein_plugin',          // eindeutig, nur Buchstaben/Zahlen/_
  name: 'Mein Plugin',
  version: '1.0',
  description: 'Was das Plugin macht',
  actions: { ... },           // eigene Aktionen (siehe unten)
  hooks: { ... }              // Ereignisse im Spiel (siehe unten)
});
```

## Eigene Aktionen

Jede Aktion erscheint im Editor überall unter **+ Aktion** (Antworten, Dialoge, Hub-Objekte).

```js
actions: {
  wuerfeln: {
    label: 'Würfeln',
    params: [
      { key: 'seiten', label: 'Seiten', type: 'number', default: 6 },
      { key: 'ziel', label: 'Ergebnis in', type: 'var' }
    ],
    run(params, ctx) {
      const wurf = 1 + Math.floor(Math.random() * params.seiten);
      ctx.vars.set(params.ziel, wurf);
      return ctx.message('Du würfelst eine ' + wurf + '!');   // Promise = Spiel wartet
    }
  }
}
```

**Parameter-Typen:** `number`, `text`, `select` (mit `options: [['wert','Anzeige'], …]`),
`var`, `item`, `currency`, `scene`, `image`, `audio`.

**Austauschbare Bilder:** Ein Parameter vom Typ `image` zeigt im Editor eine Bildauswahl mit Vorschau.
Im Code liefert `ctx.asset(params.meinBild)` die Adresse des gewählten Bildes (leer, wenn keins gewählt ist).
So können Nutzer die Grafik deines Minispiels ändern, ohne den Code anzufassen. Beispiel: `schlossknacken.js`.

Gibt `run` ein **Promise** zurück, wartet das Spiel, bis es erfüllt ist. So baust du Minispiele.

**Minispiel-Ergebnis:** Markiere die Aktion mit `minigame: true` und gib am Ende `{ score: 0…1, ok: true/false }` zurück
(oder einfach eine Zahl 0…1 bzw. true/false). Dann taucht sie z. B. im Jobs-Plugin als wählbares Minispiel auf,
und der Lohn richtet sich nach `score`. Beispiele: `minispiele.js`.

## Eigener Reiter im Editor

```js
editorTab: {
  label: 'Mein System',
  render(body) {            // body = leerer Bereich unter „Spielsysteme → Mein System“
    const d = VN.project.pluginData.mein_plugin = VN.project.pluginData.mein_plugin || {};
    body.appendChild(VN.el('p', null, 'Einstellungen …'));   // Änderungen immer in VN.mutate(() => { … })
  }
}
```

Ein vollständiges Beispiel mit Liste, Bedingungen und Tabellen ist `jobs.js` – gern als Vorlage für eigene
Systeme wie Training, Lernen oder Abenteuer kopieren.

## Der Kontext `ctx`

| Funktion | Bedeutung |
|---|---|
| `ctx.vars.get(nameOderId)` / `ctx.vars.set(nameOderId, wert)` | Variablen lesen und setzen |
| `ctx.items.count(x)`, `ctx.items.give(x, n)`, `ctx.items.take(x, n)` | Gegenstände |
| `ctx.money.get(x)`, `ctx.money.add(x, n)` | Währungen (n darf negativ sein) |
| `ctx.asset(name)` | URL einer Projektdatei (z. B. für eigene Bilder) |
| `ctx.sound(name, lautstärke)` | Sound abspielen |
| `ctx.overlay({ width, design })` | Fenster über dem Spiel öffnen, gibt `{ el, close }` zurück. Mit `design: 'meinplugin.fenster'` bekommt es gleich das passende Aussehen |
| `ctx.design(schlüssel)` | Design deines Fensters: `.apply(el)` färbt/rahmt es, `.image('slot', params.bild)` liefert das Bild (Bild an der Aktion hat Vorrang, sonst Standard-Bild aus dem Design) |
| `ctx.message(text)` | Meldung mit „Weiter“-Knopf (Promise) |
| `ctx.el(tag, attribute, ...kinder)` | Kleiner Helfer zum Bauen von HTML |
| `ctx.project`, `ctx.state`, `ctx.lang` | Projektdaten, Spielzustand, aktive Sprache |
| `ctx.time.advance(n)`, `ctx.time.text()` | Spielzeit um n Tageszeiten weiter (wenn „Zeit & Kalender“ an ist) |
| `ctx.rel.add(figur, n)`, `ctx.rel.get(figur)` | Beziehungswerte (wenn „Beziehungen“ an ist) |
| `await ctx.run('plugin.aktion', params)` | Andere Plugin-Aktion starten, z. B. ein Minispiel. Liefert `{ score, ok }` |
| `ctx.data(id)` | Gespeicherte Einstellungen deines Plugins im Projekt (Objekt, frei befüllbar) |
| `ctx.store()` | Eigener Bereich im **Spielstand** (wird mit gespeichert und geladen) |
| `ctx.global()` | Eigener Bereich **über alle Durchläufe** (bleibt auch nach „Neues Spiel“) |
| `ctx.check(bedingungen)` | Bedingungen prüfen, z. B. `[{ type: 'seen', scene: 's2' }]` |
| `ctx.act(aktionen)` | Engine-Aktionen ausführen, z. B. `[{ type: 'giveItem', item: 'it_rose', count: 1 }]` |
| `ctx.listen(ziel, typ, fn)`, `ctx.every(ms, fn)`, `ctx.onCleanup(fn)` | Ereignis-Abfragen, Timer und anderes Dauerhafte, das die Engine beim Neuladen oder Abschalten des Plugins selbst wieder entfernt |
| `ctx.bonus(schlüssel, wert)` | Wert mit allen Skilltree-Boni, z. B. `ctx.bonus('job.pay', 100)` → 110 bei „+10 % Lohn“ |

Größen in Overlays am besten in `cqh` angeben (Prozent der Spielhöhe), dann passt alles bei jeder Fenstergröße.

## Eigene Bedingungen, Menü, Anzeige und Platzhalter

```js
VNPlugin.register({
  id: 'mut', name: 'Mutprobe',
  // Erscheint in jedem „Nur wenn“ als „Mutprobe: Mut mindestens“
  conditions: {
    mutig: {
      label: 'Mut mindestens',
      params: [{ key: 'wert', label: 'Wert', type: 'number', default: 3 }],
      check(p, ctx) { return (ctx.store().mut || 0) >= p.wert; },
      text(p) { return 'Mut ≥ ' + p.wert; }
    }
  },
  // Knopf im Pausenmenü, optional mit Taste
  menu: [{ label: 'Mutbuch', key: 'm', run(ctx) { return ctx.message('Dein Mut: ' + (ctx.store().mut || 0)); } }],
  // Anzeige oben im Spiel (Text oder Element)
  hud(ctx) { return '🦁 Mut ' + (ctx.store().mut || 0); },
  // {mut} in Dialogen und Antworten
  placeholders: { mut: (ctx) => ctx.store().mut || 0 },
  actions: { mehr: { label: 'Mut +1', run(p, ctx) { const s = ctx.store(); s.mut = (s.mut || 0) + 1; } } }
});
```

Parameter-Typen für Aktionen und Bedingungen: `text`, `number`, `check`, `select` (mit `options`), `var`, `item`,
`currency`, `scene`, `image`, `audio`.

## Eigenes Design (Rahmen, Farben, Standard-Bilder)

Melde deine Fenster an, dann erscheinen sie unter **Design → Spielsysteme** und per Rechtsklick
auf das Fenster („Design ändern“). Ohne eigene Einstellung erben sie vom Systemfenster;
Minispiel-Plugins erben von „Minispiele (alle)“.

```js
VNPlugin.register({
  id: 'angeln',
  designs: {
    teich: { label: 'Angeln', icon: '🎣', images: [['bildFisch', 'Fisch'], ['bildRute', 'Angelrute']] }
  },
  actions: {
    spielen: {
      label: 'Angeln', minigame: true,
      params: [{ key: 'bildFisch', label: 'Bild Fisch', type: 'image', default: '' }],
      run(params, ctx) {
        const o = ctx.overlay({ width: '50%', design: 'angeln.teich' });
        const fisch = ctx.design('angeln.teich').image('bildFisch', params.bildFisch);
        // fisch ist eine Bild-URL oder '' → dann eigene Grafik zeichnen
      }
    }
  },
  // optional: Startwerte für „▶ Ausprobieren“ im Editor
  tryPrepare(aktion, params, state) {}
});
```

## Eigene Wirkungen für Skilltrees

Ein Plugin kann eigene Bereiche und Wirkungen mitbringen. Sie erscheinen im Skill-Editor unter „+ Wirkung“.
Der Bonus-Schlüssel wird mit `ctx.bonus(schlüssel, wert)` im eigenen Code abgefragt.

```js
VNPlugin.register({
  id: 'angeln',
  skillCats: [{ key: 'angeln', label: 'Angeln', icon: '🎣' }],
  skillEffects: {
    mehrFisch: { cat: 'angeln', label: 'Mehr Fische', params: [['pct', '+ %', 'number', 10]],
      key: () => 'angeln.fang', mode: 'pct', value: (e) => Number(e.pct) || 0,
      text: (e, stufe) => '+' + e.pct * stufe + ' % Fische' }
  },
  actions: { spielen: { label: 'Angeln', run(p, ctx) { const fische = Math.round(ctx.bonus('angeln.fang', 3)); /* … */ } } }
});
```

Eingebaute Bonus-Schlüssel: `money.gain` (auch `money.gain:<währung>`), `shop.buy`, `shop.sell`, `rel.gain` (auch `rel.gain:<figur>`),
`gift.gain`, `job.pay`, `travel.time`, `minigame.score`, im Aufbau `idle.prod` (auch `idle.prod:<gebäude>`), `idle.cost`, `idle.click`, im Kampf `combat.hp`, `combat.mp`, `combat.atk`, `combat.def`, `combat.mag`, `combat.spd`, `combat.xp`.

## Sicherheit – bitte lesen

Plugins sind Programmcode und laufen mit denselben Rechten wie die Engine-Oberfläche. Die Engine
verhindert, dass ein Plugin außerhalb des Projektordners liest oder schreibt, Fremd-Webseiten öffnet
oder im fertigen Spiel etwas anderes als Spielstände speichert. Eine echte Abschottung zwischen Plugins
und Engine (eigene Berechtigungen pro Plugin) gibt es aber noch nicht. Ein Plugin kann also alles im
Projekt verändern und alles tun, was die Oberfläche kann.

Darum: **Installiere nur Plugins aus Quellen, denen du vertraust** – genau wie bei Ren'Py-Skripten oder
Mods. Wirf vorher einen Blick in die Datei, sie ist normales JavaScript.

## Hooks

```js
hooks: {
  onStart(ctx) {},                 // neues Spiel oder Spielstand geladen
  onSceneEnter(scene, ctx) {},     // eine Szene beginnt
  onBeat(scene, beat, ctx) {},     // ein Schritt in einer Story-Szene beginnt
  onLoad(ctx) {},                  // ein Spielstand wurde geladen
  onChoice(antwort, auswahl, ctx) {}, // der Spieler hat eine Antwort gewählt
  onItem(itemId, anzahl, ctx) {},  // ein Gegenstand wurde erhalten
  onUseItem(itemId, objekt, ctx) {}, // ein Gegenstand wurde benutzt (objekt = Hub-Objekt oder null)
  onTime(ctx) {},                  // Zeit ist vergangen
  onDayEnd(alterTag, neuerTag, ctx) {}, // ein neuer Tag hat begonnen
  onLocation(ortId, ctx) {},       // ein Ort der Welt wurde betreten (Welt & Orte)
  onSkill(baumId, skillId, stufe, ctx) {}, // ein Skill wurde gekauft (Skilltrees)
  onBattleStart(kampfId, ctx) {},  // ein Kampf beginnt
  onBattleEnd(kampfId, ergebnis, ctx) {}, // Kampf vorbei: 'win', 'lose' oder 'flee'
  onBuild(gebäudeId, stufe, ctx) {},  // ein Gebäude wurde gebaut/ausgebaut (Aufbau)
  onMilestone(zielId, ctx) {},     // ein Aufbau-Ziel wurde erreicht
  onUnload(ctx) {}                 // vor dem Neuladen oder Abschalten des Plugins: aufräumen
}
```

## Tipps

- Fehler siehst du im Editor mit **Strg+Umschalt+I** (Entwicklerkonsole).
- Nach dem Speichern im eingebauten Code-Editor wird das Plugin sofort neu geladen.
- Plugins können alles, was die Engine kann. Teile und nutze nur Plugins, denen du vertraust.


## Eigene Touren (Hilfe im Editor)

Ein Plugin kann eine kurze Tour für seine Funktionen mitbringen. Sie erscheint dann unter dem ?-Knopf.

```js
if (window.Tour) Tour.register('mein_plugin', {
  title: 'Mein Plugin',
  steps: [
    { target: '#center', title: 'Hallo!', text: 'So funktioniert mein Plugin …', pos: 'inside' }
  ]
});
```
