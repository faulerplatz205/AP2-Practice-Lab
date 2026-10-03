import { defineText } from "./locale";

/** Texts of generated exercises and of the sample plan on first start. */
export const exerciseText = defineText({
    /** Pool of activity names for random activity lists */
    activityNames: [
        "Anforderungen aufnehmen", "Lastenheft erstellen", "Pflichtenheft", "Datenbank entwerfen", "Oberfläche gestalten",
        "Server einrichten", "Schnittstellen bauen", "Programmierung", "Tests schreiben", "Testphase", "Benutzer schulen",
        "Dokumentation", "Abnahme", "Rollout", "Hardware bestellen", "Netzwerk verkabeln", "Software installieren",
        "Daten migrieren", "Angebote einholen", "Arbeitsplätze einrichten",
    ],
    calcTask: "Übung: Berechne FAZ, FEZ, SAZ, SEZ, GP und FP. Dann auf „Prüfen“.",
    listTitle: "Vorgangsliste",
    listRow: (nr: string, name: string, d: number, pred: string[]) => `${nr}  ${name}  ·  D = ${d}  ·  Vorgänger: ${pred.join(", ") || "–"}`,
    drawTask: "Zeichne die Pfeile, berechne die Werte, dann „Prüfen“.",
    sample: {
        names: [ "Anforderungen", "Datenbank", "Oberfläche", "Integration", "Abnahme" ],
        title: "Beispiel: Projekt „Kundenportal“ (Dauer in Tagen)",
    },
}, {
    activityNames: [
        "Gather requirements", "Write requirements spec", "Write functional spec", "Design database", "Design user interface",
        "Set up server", "Build interfaces", "Programming", "Write tests", "Testing phase", "Train users",
        "Documentation", "Acceptance", "Rollout", "Order hardware", "Cable network", "Install software",
        "Migrate data", "Obtain quotes", "Set up workstations",
    ],
    calcTask: "Exercise: calculate ES, EF, LS, LF, TF and FF. Then click “Check”.",
    listTitle: "Activity list",
    listRow: (nr: string, name: string, d: number, pred: string[]) => `${nr}  ${name}  ·  D = ${d}  ·  Predecessors: ${pred.join(", ") || "–"}`,
    drawTask: "Draw the arrows, calculate the values, then click “Check”.",
    sample: {
        names: [ "Requirements", "Database", "User interface", "Integration", "Acceptance" ],
        title: "Example: project “Customer portal” (duration in days)",
    },
});

/** Errors when reading an activity list (`Nr; Bezeichnung; Dauer; Vorgänger`). */
export const taskListText = defineText({
    tooFewColumns: (line: number) => `Zeile ${line}: Es braucht mindestens Nr; Bezeichnung; Dauer`,
    badDuration: (line: number, value: string) => `Zeile ${line}: Dauer „${value}“ ist keine gültige Zahl`,
    noNumber: "Ein Vorgang hat keine Nr.",
    duplicateNumber: (nr: string) => `Nr. ${nr} kommt doppelt vor`,
    selfPredecessor: (nr: string) => `Vorgang ${nr} kann nicht sein eigener Vorgänger sein`,
    unknownPredecessor: (pred: string, nr: string) => `Vorgänger ${pred} von Vorgang ${nr} gibt es nicht`,
    empty: "Die Liste ist leer.",
}, {
    tooFewColumns: (line: number) => `Line ${line}: needs at least No; Name; Duration`,
    badDuration: (line: number, value: string) => `Line ${line}: duration “${value}” is not a valid number`,
    noNumber: "An activity has no number.",
    duplicateNumber: (nr: string) => `No. ${nr} appears twice`,
    selfPredecessor: (nr: string) => `Activity ${nr} cannot be its own predecessor`,
    unknownPredecessor: (pred: string, nr: string) => `Predecessor ${pred} of activity ${nr} does not exist`,
    empty: "The list is empty.",
});
