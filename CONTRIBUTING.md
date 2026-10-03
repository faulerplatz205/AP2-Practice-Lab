# Mitmachen

## Ablauf

1. Repository klonen, `npm install`, für die Browser-Tests einmalig `pip install playwright` und `python -m playwright install chromium`
2. `npm start` und die Änderung in `src/` machen. Texte nur in `src/i18n/`, immer auf Deutsch und Englisch
3. `npm test` ausführen (Typecheck, Unit-Tests, Build, Browser-Tests) und `npm run lint`
4. Screenshots in `tests/output/` ansehen, bei Änderungen an der Oberfläche im hellen und dunklen Design
5. Doku in `docs/` anpassen, wenn sich Verhalten ändert
6. Commit-Nachricht nach dem Format in `CLAUDE.md`, Abschnitt **Commit Messages**

`dist/` wird nicht committet, `npm run build` erzeugt es.

## Mit Claude Code

`CLAUDE.md` enthält alles, was Claude über das Projekt wissen muss. Es reicht eine kurze Anweisung. Für wiederkehrende Aufgaben gibt es Skills:

- `/new-element Kommunikationsdiagramm`
- `/publish`

Nach jeder Bearbeitung prüft ein Hook (`.claude/settings.json`) die geänderte Datei: TypeScript und ESLint bei `.ts`/`.tsx`, markdownlint bei `.md`.

## Was gern gesehen ist

- Neue Prüfregeln für typische Prüfungsfehler, mit Quelle oder Beispiel aus alten AP2-Aufgaben
- Weitere Übungsarten, z. B. für Aktivitäts- oder Klassendiagramme oder neue Subnetting-Aufgaben
- Fehlerberichte mit Schritten zum Nachstellen und einem Screenshot

## Was nicht hineingehört

- Änderungen an gespeicherten Schlüsseln, Feldnamen oder ids (siehe **Persistence** in `CLAUDE.md`). Sonst verlieren Nutzer ihre Pläne und Erfolge
- Externe Skripte oder Server-Abhängigkeiten. Die App bleibt eine einzelne Datei
- Bilder, die eine Person wegen ihres Aussehens oder Körpers vorführen
