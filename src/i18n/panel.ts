import { defineText } from "./locale";
import type { CheckResult } from "../types/check";

/** Legend of an activity node (right panel and guide). Field names: `fieldLabels`. */
export const legendText = defineText({
    ariaLabel: "Aufbau eines Vorgangsknotens",
    name: "Bezeichnung",
}, {
    ariaLabel: "Layout of an activity node",
    name: "Name",
});

export const panelText = defineText({
    ariaLabel: "Eigenschaften",

    // Shared parts
    fillColor: "Füllfarbe",
    duplicate: "Duplizieren",
    delete: "Löschen",
    backToCheck: "← Zurück zum Prüfergebnis",
    countingMode: "Zählweise",
    startAt: (n: number) => `Start bei ${n}`,
    exerciseRunning: "Übung läuft",
    exerciseCalc: "Rechnen",
    exerciseDraw: "Zeichnen und rechnen",
    exerciseActivities: (n: number) => `${n} Vorgänge`,
    endExercise: "Übung beenden",
    width: "Breite",
    height: "Höhe",
    text: "Text",

    // Activity node
    activityNode: "Vorgangsknoten",
    noName: "ohne Namen",
    nameField: "Bezeichnung",
    durationField: "Dauer (D)",
    activityNote: "Alle Felder lassen sich jederzeit ändern, hier oder per Doppelklick direkt im Knoten. „Berechnen“ füllt FAZ bis FP automatisch aus.",

    // Shapes
    shapeNames: { rect: "Rechteck", ellipse: "Ellipse", diamond: "Raute", text: "Textfeld" },
    shape: "Form",
    textAndLook: "Text & Aussehen",

    // Edge
    connection: "Verbindung",
    kind: "Art",
    message: "Nachricht",
    guardLabel: "Bedingung (die eckigen Klammern kommen automatisch)",
    label: "Beschriftung",
    messagePlaceholder: "bestellen(artikel)",
    guardPlaceholder: "ja",
    optional: "optional",
    multiplicityStart: "Multiplizität Start",
    multiplicityEnd: "Ende",
    moveMessage: "Nachricht nach oben oder unten ziehen, um sie zu verschieben.",
    reverse: "Richtung umdrehen",

    // UML element
    appendState: { state: "Zustand", decision: "Entscheidung", end: "Endzustand" },
    appendFlow: { action: "Aktion", decision: "Entscheidung", bar: "Gabelung", end: "Endknoten", flowend: "Ablaufende" },
    addBranch: "Zweig hinzufügen",
    appendNext: "Danach anhängen",
    nameObject: "Name (objekt : Klasse)",
    name: "Name",
    operator: "Operator",
    condition: "Bedingung",
    conditionPlaceholder: "[Bedingung]",
    classKinds: { "": "Klasse", abstract: "Abstrakte Klasse", interface: "Interface", enum: "Aufzählung (Enum)" },
    enumValues: "Werte (eine Zeile pro Wert)",
    attributes: "Attribute (eine Zeile pro Attribut)",
    methods: "Methoden",
    visibility: "Sichtbarkeit: + public, - private, # protected, ~ package",
    attributeValues: "Attributwerte",
    objectPlaceholder: "name = \"Max\"",
    stateActivities: "Aktivitäten (optional)",

    // Check result
    checkResult: "Prüfergebnis",
    headline: (c: CheckResult): string => {
        if (c.ok) return `${c.isNetzplan ? "Netzplan" : "Diagramm"} stimmt`;
        if (c.errors) return `${c.errors} Fehler gefunden`;
        if (c.isNetzplan && c.empty) return "Noch nicht vollständig";
        return `${c.warnings} Hinweis${c.warnings > 1 ? "e" : ""}`;
    },
    allCorrect: "Alles richtig!",
    projectSummary: (duration: string, critical: string[]) => `Projektdauer ${duration} · kritischer Pfad: ${critical.join(" → ")}`,
    checked: (kinds: string[]) => `Geprüft: ${kinds.join(", ")}`,
    valuesRight: "Werte richtig",
    solution: (s: string) => `Richtig: ${s}`,
    showSolution: "Richtige Werte anzeigen",
    checkAgain: "Erneut prüfen",
    endCheck: "Prüfung beenden",

    // Short guide
    howTo: "So geht's",
    /** `**bold**` and `[[key]]` are rendered as <b> and <kbd> */
    modeHelp: "Links wählst du die Diagrammart und die Elemente. Ziffern [[1]]–[[9]] wählen ein Element direkt. **Prüfen** zeigt, ob das Diagramm Sinn ergibt, **Sauber anordnen** ([[L]]) räumt auf.",
    netzplanTools: "**Sauber anordnen** (Taste [[L]]) richtet Netzplan und alle UML-Diagramme automatisch aus. **Gantt** zeigt den Zeitplan als Balkendiagramm. Über **Vorgangsliste** tippst du eine Vorgangsliste ein und bekommst den fertigen Netzplan. **Übung** erzeugt Zufallsaufgaben. Links oben wechselst du die **Diagrammart**, z. B. zum Aktivitäts- oder Klassendiagramm. Unter **Erfolge** siehst du Level, Achievements und die Rainer-Galerie.",
    showExample: "Beispiel ansehen",
    openGuide: "Anleitung öffnen",
    netzplan: "Netzplan",
    howItWorks: "So funktioniert's",
    netzplanIntro: "Links „Vorgang“ wählen und Knoten setzen, mit dem Pfeil Vorgänger und Nachfolger verbinden, Dauer eintragen. Dann selbst rechnen und mit „Prüfen“ kontrollieren, oder mit „Berechnen“ alles ausfüllen lassen. Der kritische Pfad wird rot markiert.",
    autosave: "Dein Plan wird automatisch in diesem Browser gespeichert. Mit „Speichern“ legst du ihn unter einem Namen ab, unter „Öffnen“ findest du alle gespeicherten Pläne.",
    keys: [
        [ "Doppelklick", "Text oder Feld bearbeiten" ],
        [ "A", "Pfeil: Vorgänger anklicken, dann Nachfolger" ],
        [ "Tab", "nächstes Feld im Knoten" ],
        [ "V A 1–9 L", "Werkzeuge" ],
        [ "Entf", "Auswahl löschen" ],
        [ "Strg+C / V", "Kopieren / Einfügen" ],
        [ "Strg+D", "Duplizieren" ],
        [ "Strg+Z / Y", "Rückgängig / Wiederholen" ],
        [ "Mausrad", "Zoomen" ],
        [ "Leertaste+Ziehen", "Fläche verschieben" ],
    ] as [string, string][],
}, {
    ariaLabel: "Properties",

    fillColor: "Fill color",
    duplicate: "Duplicate",
    delete: "Delete",
    backToCheck: "← Back to the check result",
    countingMode: "Counting mode",
    startAt: (n: number) => `Start at ${n}`,
    exerciseRunning: "Exercise running",
    exerciseCalc: "Calculate",
    exerciseDraw: "Draw and calculate",
    exerciseActivities: (n: number) => `${n} activities`,
    endExercise: "End exercise",
    width: "Width",
    height: "Height",
    text: "Text",

    activityNode: "Activity node",
    noName: "no name",
    nameField: "Name",
    durationField: "Duration (D)",
    activityNote: "You can change every field at any time, here or by double-clicking right in the node. “Calculate” fills in ES to FF automatically.",

    shapeNames: { rect: "Rectangle", ellipse: "Ellipse", diamond: "Diamond", text: "Text box" },
    shape: "Shape",
    textAndLook: "Text & appearance",

    connection: "Connection",
    kind: "Kind",
    message: "Message",
    guardLabel: "Condition (the square brackets are added automatically)",
    label: "Label",
    messagePlaceholder: "order(item)",
    guardPlaceholder: "yes",
    optional: "optional",
    multiplicityStart: "Multiplicity start",
    multiplicityEnd: "End",
    moveMessage: "Drag the message up or down to move it.",
    reverse: "Reverse direction",

    appendState: { state: "State", decision: "Decision", end: "Final state" },
    appendFlow: { action: "Action", decision: "Decision", bar: "Fork", end: "Final node", flowend: "Flow final" },
    addBranch: "Add branch",
    appendNext: "Append next",
    nameObject: "Name (object : Class)",
    name: "Name",
    operator: "Operator",
    condition: "Condition",
    conditionPlaceholder: "[condition]",
    classKinds: { "": "Class", abstract: "Abstract class", interface: "Interface", enum: "Enumeration (enum)" },
    enumValues: "Values (one line per value)",
    attributes: "Attributes (one line per attribute)",
    methods: "Methods",
    visibility: "Visibility: + public, - private, # protected, ~ package",
    attributeValues: "Attribute values",
    objectPlaceholder: "name = \"Max\"",
    stateActivities: "Activities (optional)",

    checkResult: "Check result",
    headline: (c: CheckResult): string => {
        if (c.ok) return `${c.isNetzplan ? "Network diagram" : "Diagram"} is correct`;
        if (c.errors) return `${c.errors} ${c.errors > 1 ? "errors" : "error"} found`;
        if (c.isNetzplan && c.empty) return "Not complete yet";
        return `${c.warnings} ${c.warnings > 1 ? "hints" : "hint"}`;
    },
    allCorrect: "All correct!",
    projectSummary: (duration: string, critical: string[]) => `Project duration ${duration} · critical path: ${critical.join(" → ")}`,
    checked: (kinds: string[]) => `Checked: ${kinds.join(", ")}`,
    valuesRight: "values correct",
    solution: (s: string) => `Correct: ${s}`,
    showSolution: "Show correct values",
    checkAgain: "Check again",
    endCheck: "End check",

    howTo: "How it works",
    modeHelp: "On the left you pick the diagram kind and its elements. Digits [[1]]–[[9]] pick an element directly. **Check** shows whether the diagram makes sense, **Tidy up** ([[L]]) arranges it.",
    netzplanTools: "**Tidy up** (key [[L]]) arranges the network diagram and all UML diagrams automatically. **Gantt** shows the schedule as a bar chart. With **Activity list** you type in an activity list and get the finished network diagram. **Exercise** creates random tasks. At the top left you switch the **diagram kind**, e.g. to an activity or class diagram. Under **Progress** you find your level, achievements and the Rainer gallery.",
    showExample: "Show example",
    openGuide: "Open guide",
    netzplan: "Network diagram",
    howItWorks: "How it works",
    netzplanIntro: "Pick “Activity” on the left and place nodes, connect predecessors and successors with the arrow, enter durations. Then calculate yourself and verify with “Check”, or let “Calculate” fill in everything. The critical path is marked red.",
    autosave: "Your plan is saved automatically in this browser. “Save” stores it under a name, “Open” lists all saved plans.",
    keys: [
        [ "Double-click", "Edit text or field" ],
        [ "A", "Arrow: click the predecessor, then the successor" ],
        [ "Tab", "next field in the node" ],
        [ "V A 1–9 L", "Tools" ],
        [ "Del", "Delete selection" ],
        [ "Ctrl+C / V", "Copy / paste" ],
        [ "Ctrl+D", "Duplicate" ],
        [ "Ctrl+Z / Y", "Undo / redo" ],
        [ "Mouse wheel", "Zoom" ],
        [ "Space+drag", "Move the canvas" ],
    ],
});
