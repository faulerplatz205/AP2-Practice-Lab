import { defineText } from "./locale";

/** Short messages (toasts) and texts that the actions in `src/state` produce. */
export const messageText = defineText({
    relationSet: (relation: string) => `${relation} gesetzt.`,
    guardPlaceholder: "Bedingung, z. B. ja",
    labelPlaceholder: "Beschriftung",

    calcImpossible: "Berechnung nicht möglich.",
    calculated: (duration: string, critical: string[]) => `Projektdauer ${duration} · kritischer Pfad: ${critical.join(" → ")}`,
    countingMode: (start: number) => `Zählweise: Start bei ${start}. Jetzt „Berechnen“ oder „Prüfen“.`,
    newCalcTask: "Neue Aufgabe: Werte berechnen und prüfen.",
    newDrawTask: "Neue Aufgabe: Pfeile laut Vorgangsliste setzen, dann rechnen.",
    listCycle: "Die Vorgänger bilden einen Kreis. Prüfe die Liste.",
    activitiesCreated: (n: number) => `${n} Vorgänge erstellt.`,
    ganttImpossible: "Gantt-Diagramm nicht möglich.",

    allCorrect: "Alles richtig!",
    onlyHints: "Fast: nur noch Hinweise. Details rechts.",
    errorsFound: (n: number) => `${n} Fehler gefunden. Details rechts.`,
    incomplete: "Noch nicht vollständig. Details rechts.",

    nothingToTidy: "Es gibt noch nichts zum Anordnen.",
    tidied: "Sauber angeordnet. Mit Strg+Z holst du die alte Anordnung zurück.",
    exampleInserted: "Beispiel eingefügt. Mit „Prüfen“ kannst du es kontrollieren.",

    storageFull: "Der Browser-Speicher ist voll. Lösch alte Pläne oder exportiere sie als Datei.",
    nothingToSave: "Es gibt noch nichts zum Speichern.",
    saved: (name: string) => `„${name}“ gespeichert.`,
    copyName: (name: string) => `${name} (Kopie)`,
    planBroken: "Dieser Plan ist beschädigt.",
    opened: (name: string) => `„${name}“ geöffnet.`,
    deleted: (name: string) => `„${name}“ gelöscht.`,

    invalidFile: "Die Datei ist keine gültige AP2-Draw-Datei.",
    imported: (fileName: string) => `„${fileName}“ importiert. Mit Speichern legst du ihn unter „Meine Pläne“ ab.`,
    planLoaded: "Plan geladen.",
    needJson: "Bitte eine .json-Datei aus AP2 Practice Lab öffnen.",
    readFailed: "Die Datei konnte nicht gelesen werden.",
    exported: "Datei exportiert.",
    saveCancelled: "Speichern abgebrochen.",
    saveBusy: "Es ist schon ein Speichern-Fenster offen.",

    planEmpty: "Der Plan ist noch leer.",
    imageFailed: "Das Bild konnte nicht erstellt werden.",
}, {
    relationSet: (relation: string) => `${relation} added.`,
    guardPlaceholder: "Condition, e.g. yes",
    labelPlaceholder: "Label",

    calcImpossible: "Cannot calculate.",
    calculated: (duration: string, critical: string[]) => `Project duration ${duration} · critical path: ${critical.join(" → ")}`,
    countingMode: (start: number) => `Counting mode: start at ${start}. Now “Calculate” or “Check”.`,
    newCalcTask: "New exercise: calculate the values and check them.",
    newDrawTask: "New exercise: draw the arrows from the activity list, then calculate.",
    listCycle: "The predecessors form a cycle. Check the list.",
    activitiesCreated: (n: number) => `${n} activities created.`,
    ganttImpossible: "Cannot show the Gantt chart.",

    allCorrect: "All correct!",
    onlyHints: "Almost: only hints left. Details on the right.",
    errorsFound: (n: number) => `${n} ${n === 1 ? "error" : "errors"} found. Details on the right.`,
    incomplete: "Not complete yet. Details on the right.",

    nothingToTidy: "There is nothing to arrange yet.",
    tidied: "Tidied up. Ctrl+Z brings back the old arrangement.",
    exampleInserted: "Example inserted. Use “Check” to verify it.",

    storageFull: "The browser storage is full. Delete old plans or export them as files.",
    nothingToSave: "There is nothing to save yet.",
    saved: (name: string) => `“${name}” saved.`,
    copyName: (name: string) => `${name} (copy)`,
    planBroken: "This plan is damaged.",
    opened: (name: string) => `“${name}” opened.`,
    deleted: (name: string) => `“${name}” deleted.`,

    invalidFile: "The file is not a valid AP2 Practice Lab file.",
    imported: (fileName: string) => `“${fileName}” imported. Save it to keep it under “My plans”.`,
    planLoaded: "Plan loaded.",
    needJson: "Please open a .json file from AP2 Practice Lab.",
    readFailed: "The file could not be read.",
    exported: "File exported.",
    saveCancelled: "Saving cancelled.",
    saveBusy: "A save window is already open.",

    planEmpty: "The plan is still empty.",
    imageFailed: "Could not create the image.",
});
