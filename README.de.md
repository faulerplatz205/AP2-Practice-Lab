# AP2 Practice Lab

[English](README.md) | **Deutsch**

Übungs-App für die AP2 (Abschlussprüfung Teil 2) der Fachinformatiker Anwendungsentwicklung. Netzpläne und UML-Diagramme werden gezeichnet, automatisch geprüft und sauber angeordnet. Dazu gibt es einen Subnetting-Bereich mit Rechner und Übungsaufgaben, Erfolge mit Level-System und eine versteckte Rainer-Galerie.

Die App ist eine einzige HTML-Datei ohne Server. Sie läuft als Claude Artifact oder direkt im Browser.

**Online:** <https://claude.ai/artifact/8gN6BVXa34YUPqtZECEp9f>

## Funktionen

- **Netzplan:** Vorgangsknoten im IHK-Aufbau (FAZ, FEZ, SAZ, SEZ, GP, FP), Berechnen, kritischer Pfad, Zählweise „Start bei 0“ oder „Start bei 1“, Gantt-Diagramm, Vorgangsliste (auch aus Excel einfügen), Zufallsübungen „Rechnen“ und „Zeichnen und rechnen“
- **UML:** Aktivitäts-, Use-Case-, Klassen-, Sequenz-, Zustands-, Objekt-, Komponenten-, Verteilungs- und Paketdiagramm, jeweils mit passenden Elementen, Verbindungen und teilweise mit Beispiel. Dazu freies Zeichnen mit allgemeinen Formen
- **Datenbanken:** ER-Modell in Chen-Notation (Entitäten, Beziehungen, Attribute, Kardinalitäten) und Tabellenmodell mit Primär- und Fremdschlüsseln. Eine Normalisierungsübung bringt eine nicht normalisierte Tabelle in die 3. Normalform; „Prüfen“ nennt die verletzte Normalform und den Grund
- **Prüfen:** Rechenfehler im Netzplan werden Feld für Feld markiert, mit Formel und richtigem Wert. Für UML gibt es typische Prüfungsfehler, z. B. fehlender Endknoten, Entscheidung ohne Bedingung oder Use-Case ohne Akteur. Alle Regeln (englisch): [docs/check-rules.md](docs/check-rules.md)
- **Sauber anordnen:** räumt jede Diagrammart automatisch auf
- **Subnetting:** IPv4-Rechner mit Binäransicht, Netz in gleich große Subnetze aufteilen, VLSM nach Hostbedarf, IPv6 kürzen und ausschreiben, Übungsaufgaben mit Prüfung pro Feld
- **Erfolge:** 27 Achievements, 9 Level und eine Rainer-Galerie mit 9 freischaltbaren Bildern. Tipp: irgendwo „rainer“ tippen
- **Meine Pläne:** Pläne unter einem Namen im Browser speichern, öffnen, umbenennen, löschen
- **Export und Import:** Plan als `.json`-Datei speichern und wieder öffnen (auch per Ziehen und Ablegen), Bild als PNG
- **Deutsch und Englisch:** Umschalten mit `DE`/`EN` oben rechts
- **Hell und dunkel:** Design wie das System, immer hell oder immer dunkel

Sprache, Design und Arbeitsbereich merkt sich der Browser.

## Benutzen

### Online

Den Link oben öffnen. Mehr braucht es nicht. Beim ersten Start erklärt eine Anleitung alles Wichtige; sie lässt sich jederzeit über „Anleitung“ wieder öffnen.

### Lokal

Voraussetzung: Node.js ab Version 20.

```bash
npm install     # einmalig
npm start       # Entwicklungsserver auf http://localhost:5173
npm run build   # baut dist/index.html und dist/ap2-practice-lab.html
```

`dist/index.html` lässt sich danach direkt im Browser öffnen.

## Weiterentwickeln

```bash
npm run typecheck   # TypeScript prüfen
npm run lint        # ESLint
npm run test:unit   # Unit-Tests (Vitest)
npm run test:e2e    # Browser-Tests (Playwright für Python, vorher npm run build)
npm test            # alles zusammen
```

Für die Browser-Tests einmalig:

```bash
pip install playwright
python -m playwright install chromium
```

Aufbau, Regeln und Befehle stehen in [CLAUDE.md](CLAUDE.md), Details in [docs/](docs/README.md) (beides englisch). Damit reicht Claude Code eine kurze Anweisung, z. B.:

- „Füg dem Aktivitätsdiagramm eine Prüfregel für leere Partitionen hinzu.“
- „Bau ein Kommunikationsdiagramm als neue Diagrammart ein.“
- „Mach eine Subnetting-Übung zum Supernetting.“

Im Ordner [.claude/skills](.claude/skills) liegen fertige Abläufe: `new-element` für neue Formen oder Diagrammarten und `publish` für Test und Veröffentlichung. Wie man mitmacht, steht in [CONTRIBUTING.md](CONTRIBUTING.md).

## Aufbau

```text
src/
  components/   React-Komponenten (Zeichenfläche, Leisten, Dialoge, Subnetting)
  state/        zustand-Stores und Aktionen
  lib/          Logik ohne React (Prüfen, Berechnen, Anordnen, Subnetting)
  i18n/         alle Texte auf Deutsch und Englisch
  data/         Diagrammarten, Beispiele, Anleitung, Rainer-Galerie
static/img/     Bilder für die Galerie
scripts/        Build des Artifacts
tests/e2e/      Browser-Tests pro Bereich
docs/           Wissensbasis für Entwickler
```

## Datenschutz

Alles bleibt im Browser. Pläne, Erfolge und Einstellungen liegen im `localStorage` des jeweiligen Browsers. Es gibt keinen Server und kein Tracking. Nur die Schriftarten werden von Google Fonts geladen.
