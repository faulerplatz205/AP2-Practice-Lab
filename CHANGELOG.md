# Changelog

Neue Einträge oben. Die Versionen entsprechen den Veröffentlichungen des Claude Artifacts.

## 2.0.0 – 2026-10-03

Neu geschrieben als React-App und umbenannt von „AP2 Draw“ in **AP2 Practice Lab**. Gespeicherte Pläne, Erfolge und „Meine Pläne“ aus Version 1 bleiben erhalten.

### Neu

- Arbeitsbereich **Subnetting**: IPv4-Rechner mit Binäransicht, Klasse und Adressbereich, Aufteilen in gleich große Subnetze, VLSM nach Hostbedarf, IPv6 kürzen und ausschreiben, Übungsaufgaben in 10 Arten mit Prüfung pro Feld und Serie
- 3 neue Achievements: „Netzwerker“, „Maskenträger“, „Subnetz-Profi“ (jetzt 27)
- Oberfläche auf **Deutsch und Englisch**, umschaltbar mit `DE`/`EN`
- **Design-Schalter**: wie das System, hell oder dunkel
- Anleitung mit neuem Kapitel „Subnetting“ (jetzt 9 Kapitel)
- Sprache, Design und Arbeitsbereich werden im Browser gemerkt

### Geändert

- Technik: React 19, TypeScript, zustand und immer, gebaut mit Vite zu einer einzigen HTML-Datei
- Code, Kommentare und Entwickler-Doku auf Englisch
- Exportdateien tragen `"app": "AP2 Practice Lab"`; Dateien aus Version 1 lassen sich weiter öffnen
- Unit-Tests mit Vitest für die Subnetting-Logik, Browser-Tests laufen gegen den Vite-Build

## 1.0.0 – 2026-10-03

Erste Version als Repository („AP2 Draw“, Vanilla JavaScript). Enthält alles aus den Artifact-Versionen 1 bis 11:

- Netzplan mit IHK-Knoten, Berechnen, Prüfen Feld für Feld, Zählweise „Start bei 0“ und „Start bei 1“, kritischer Pfad
- Gantt-Diagramm, Vorgangsliste mit Excel-Import, Zufallsübungen „Rechnen“ und „Zeichnen und rechnen“
- UML: Aktivitäts-, Use-Case-, Klassen-, Sequenz-, Zustands-, Objekt-, Komponenten-, Verteilungs- und Paketdiagramm mit Prüfregeln und Beispielen
- Aktivitätsdiagramm mit „Danach anhängen“ und automatischen `[ ]` an Bedingungen
- Linke Leiste mit Diagrammart, passende Elemente und Verbindungen je Art
- „Sauber anordnen“ für alle Diagrammarten
- „Meine Pläne“ im Browser, Export und Import als Datei, PNG-Export
- 24 Achievements, 9 Level, Rainer-Galerie mit 9 Bildern
- Anleitung mit 8 Kapiteln, helles und dunkles Design, Handy-Ansicht

### Behoben beim Umzug ins Repository

- „Nachtschicht“ zählt jetzt auch für richtige UML-Diagramme, nicht nur für Netzpläne
- Reste der alten UML-Palette entfernt
