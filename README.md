# Chess Review – Partieanalyse

Eine Chromium-Erweiterung zur Nachanalyse **abgeschlossener** Chess.com-Partien. Sie liest keine Chess.com-Seiten aus und hat keine Berechtigungen für Webseiten. Du fügst die PGN der beendeten Partie manuell ein; Stockfish analysiert die Stellungen lokal und zeichnet seinen Topzug als Pfeil ein.

## Erweiterung installieren

1. Öffne `chrome://extensions` in Chromium oder Chrome.
2. Aktiviere **Entwicklermodus**.
3. Klicke auf **Entpackte Erweiterung laden** und wähle den Ordner `extension`.
4. Öffne das Erweiterungssymbol und klicke auf **Analysefenster öffnen**.

## Partie analysieren

Kopiere den PGN-Text einer beendeten Partie von Chess.com und füge ihn im Analysefenster ein. Alternativ kannst du eine `.pgn`-Datei laden. Wähle einen Halbzug aus der Zugfolge und analysiere ihn einzeln oder starte die Analyse der gesamten Partie. Die Tiefe lässt sich zwischen 10, 12 und 14 einstellen; die Engine ist lokal und läuft im Browser.

Die Erweiterung benötigt keine Chess.com-Website-Berechtigung und enthält kein Content Script. Sie kann daher keine Züge von einem laufenden Brett lesen oder dort Hinweise einblenden.

## Enthaltene Komponenten

- Stockfish.js 19.0.1, Lite Single-Threaded WASM, GPL-3.0 (Engine-Lizenz in `extension/vendor/stockfish-COPYING.txt`)
- chess.js 1.4.0, BSD-2-Clause (Lizenz in `extension/vendor/chess.js-LICENSE.txt`)

Alle Engine-Dateien werden lokal aus der Erweiterung geladen; es gibt keine externen Skripte oder Analyse-Uploads.

Quellcode der eingebundenen Komponenten: [Stockfish.js v19.0.1](https://github.com/nmrugg/stockfish.js/tree/v19.0.1) und [chess.js v1.4.0](https://github.com/jhlywa/chess.js/tree/v1.4.0).
