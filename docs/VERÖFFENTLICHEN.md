# Neue Version veröffentlichen (Setup + automatische Updates)

Update-Quelle: github.com/TheTalkingPegasus/vn-timeline-engine (steht in `package.json` unter `build.publish`).

## Der einfache Weg: ein Knopf auf GitHub
GitHub baut das Setup selbst unter Windows, setzt die Versionsnummer überall, legt das Release an
und lädt alle Dateien hoch. Du brauchst dafür nichts auf deinem PC.

1. Neuen Quellcode wie gewohnt ins Repository hochladen (und im `CHANGELOG.md` oben einen Abschnitt
   für die neue Version schreiben – der erscheint in der Engine unter „Was ist neu?“).
2. Auf GitHub oben auf **Actions** → links **Neue Version veröffentlichen** → rechts **Run workflow**.
3. Versionsnummer eintragen, z. B. `0.7.1` (muss größer sein als die letzte). Das Feld „Was ist neu?“
   kann leer bleiben, dann wird der oberste Abschnitt aus `CHANGELOG.md` genommen.
4. Grün **Run workflow** drücken. Nach ca. 5–10 Minuten steht unter **Releases** die neue Version mit:
   - `VN-Timeline-Engine-Setup-X.Y.Z.exe` – Setup (empfohlen)
   - `VN-Timeline-Engine-X.Y.Z-win.zip` – ZIP ohne Installation
   - `…exe.blockmap` und `latest.yml` – brauchen die automatischen Updates, nicht löschen
5. Fertig. Alle, die das Setup installiert haben, bekommen beim nächsten Start „Version X.Y.Z ist da“.

Wird ein Lauf rot, auf ihn klicken – dort steht, welcher Schritt fehlgeschlagen ist.

### Einmalig: den Knopf ins Repository bringen
Die Datei `.github/workflows/release.yml` muss im Repository liegen. Der Ordner `.github` beginnt mit
einem Punkt und wird beim Hochladen per Ziehen manchmal übersehen. Sicherer Weg:
**Add file → Create new file**, als Namen `.github/workflows/release.yml` eintippen (die Schrägstriche
legen die Ordner an), den Inhalt der Datei hineinkopieren, **Commit changes**.

## Der Weg von Hand (falls Actions mal nicht geht)
1. `npm run version:set 0.7.1` – setzt die Nummer in allen Dateien.
2. `npm run dist:win` (unter Windows direkt, unter Linux/macOS mit Wine).
3. Aus `release/` die drei Dateien `…Setup-X.Y.Z.exe`, `…Setup-X.Y.Z.exe.blockmap` und `latest.yml`
   in ein neues GitHub-Release mit Tag `vX.Y.Z` hochladen. Kein „Pre-release“-Häkchen.

## Was beim Spieler passiert
- Setup-Fassung: Die Engine sieht beim Start nach, zeigt unten rechts „Version X ist da“, lädt auf Klick
  nur die Änderungen und installiert beim Neustart (Projekt wird vorher gespeichert).
- ZIP-Fassung: Hinweis mit Knopf zur Download-Seite.
- Drüberinstallieren von Hand geht immer. Desktop-Verknüpfung, Projekte, Einstellungen, Spielstände und
  Plugins bleiben erhalten.
- Exportierte Spiele suchen nie nach Engine-Updates.
- Versionen vor 0.7 haben die Update-Suche noch nicht: 0.7 wird einmal von Hand installiert.

## Hinweis Windows-SmartScreen
Das Setup ist (noch) nicht digital signiert. Windows zeigt beim ersten Start evtl.
„Der Computer wurde durch Windows geschützt“ → *Weitere Informationen → Trotzdem ausführen*.
