import { defineText } from "./locale";

/** Buttons and messages shared by several dialogs. */
export const dialogText = defineText({
    close: "Schließen",
    cancel: "Abbrechen",
    textSelected: "Text ist markiert. Mit Strg+C kopieren.",
}, {
    close: "Close",
    cancel: "Cancel",
    textSelected: "Text is selected. Press Ctrl+C to copy.",
});

/** Question before switching when there are unsaved changes. */
export const discardText = defineText({
    title: "Änderungen speichern?",
    unsaved: (name: string) => `„${name}“ hat ungespeicherte Änderungen.`,
    notSavedYet: "Der aktuelle Plan ist noch nicht gespeichert.",
    saveAndContinue: "Speichern und weiter",
    dontSave: "Nicht speichern",
}, {
    title: "Save changes?",
    unsaved: (name: string) => `“${name}” has unsaved changes.`,
    notSavedYet: "The current plan has not been saved yet.",
    saveAndContinue: "Save and continue",
    dontSave: "Don't save",
});

export const exerciseDialogText = defineText({
    title: "Übungsaufgabe",
    intro: "Erzeugt eine zufällige Aufgabe. Dein aktueller Plan wird ersetzt, mit „Rückgängig“ holst du ihn zurück.",
    calc: "Rechnen",
    calcDescription: "Der Netzplan ist schon gezeichnet. Du trägst FAZ, FEZ, SAZ, SEZ, GP und FP ein.",
    draw: "Zeichnen und rechnen",
    drawDescription: "Du bekommst nur die Vorgangsliste und setzt die Pfeile selbst.",
    size: "Größe",
    activities: (n: number) => `${n} Vorgänge`,
    create: "Aufgabe erstellen",
}, {
    title: "Exercise",
    intro: "Creates a random exercise. Your current plan is replaced, “Undo” brings it back.",
    calc: "Calculate",
    calcDescription: "The network diagram is already drawn. You fill in ES, EF, LS, LF, TF and FF.",
    draw: "Draw and calculate",
    drawDescription: "You only get the activity list and draw the arrows yourself.",
    size: "Size",
    activities: (n: number) => `${n} activities`,
    create: "Create exercise",
});

/** Fallback when downloads are blocked: text to copy. */
export const exportTextText = defineText({
    title: "Als Datei exportieren",
    before: "Downloads sind in dieser Ansicht nicht möglich. Kopiere den Text und speichere ihn als ",
    after: ".",
    copied: "In die Zwischenablage kopiert.",
    copy: "Text kopieren",
}, {
    title: "Export as file",
    before: "Downloads are not possible in this view. Copy the text and save it as ",
    after: ".",
    copied: "Copied to the clipboard.",
    copy: "Copy text",
});

export const ganttText = defineText({
    title: "Gantt-Diagramm",
    summary: (duration: string, start: number) => `Projektdauer ${duration} · Zählweise „Start bei ${start}“ · berechnet aus deinem gezeichneten Netzplan`,
    critical: "kritischer Vorgang (GP = 0)",
    withFloat: "Vorgang mit Puffer",
    totalFloat: "Gesamtpuffer",
    image: "Als Bild",
    imageTitle: "Gantt-Diagramm als Bild oder PDF speichern",
}, {
    title: "Gantt chart",
    summary: (duration: string, start: number) => `Project duration ${duration} · counting mode “start at ${start}” · calculated from your network diagram`,
    critical: "critical activity (TF = 0)",
    withFloat: "activity with float",
    totalFloat: "total float",
    image: "As image",
    imageTitle: "Save the Gantt chart as an image or PDF",
});

export const guideDialogText = defineText({
    title: "Anleitung",
    chapters: "Kapitel",
}, {
    title: "Guide",
    chapters: "Chapters",
});

export const imageText = defineText({
    title: "Als Bild",
    preview: "Vorschau",
    saveHint: "Zum Speichern: Rechtsklick auf das Bild und „Bild speichern unter…“, am Handy lange drücken.",
    saved: "Bild gespeichert.",
    declined: "Speichern abgebrochen.",
    saveUnavailable: "Speichern ist hier gerade nicht möglich. Lade die Seite neu oder speichere das Bild per Rechtsklick.",
    pdfUnavailable: "PDF-Speichern ist hier gerade nicht möglich. Lade die Seite neu und erlaube das Speichern, wenn du gefragt wirst.",
    denied: "Speichern ist für diese Seite nicht erlaubt. Lade die Seite neu und erlaube es, wenn du gefragt wirst.",
    busy: "Es ist schon ein Speichern-Fenster offen. Schließ das bitte zuerst ab.",
    waiting: "Speichern wird vorbereitet …",
    confirm: "Bestätige das Speichern im Fenster, das gleich aufgeht.",
    noWindow: "Kein Speichern-Fenster zu sehen? Lade die Seite neu und versuch es nochmal oder speichere das Bild per Rechtsklick.",
    imageFailed: "Das Bild ließ sich nicht erzeugen. Lade die Seite neu und versuch es nochmal.",
    copyUnavailable: "Kopieren geht hier nicht. Rechtsklick auf das Bild und „Bild kopieren“.",
    copied: "Bild kopiert. Mit Strg+V z. B. in Word einfügen.",
    savePng: "Als PNG speichern",
    savePdf: "Als PDF speichern",
    pdfSaved: "PDF gespeichert.",
    pdfFailed: "Das PDF ließ sich nicht erstellen.",
    copy: "Bild kopieren",
}, {
    title: "As image",
    preview: "Preview",
    saveHint: "To save: right-click the image and choose “Save image as…”, on a phone press and hold.",
    saved: "Image saved.",
    declined: "Saving cancelled.",
    saveUnavailable: "Saving is not possible here right now. Reload the page or right-click the image to save it.",
    pdfUnavailable: "Saving a PDF is not possible here right now. Reload the page and allow saving when asked.",
    denied: "Saving is not allowed for this page. Reload the page and allow it when asked.",
    busy: "A save window is already open. Please finish that one first.",
    waiting: "Getting the file ready …",
    confirm: "Confirm the save in the window that opens in a moment.",
    noWindow: "No save window showing up? Reload the page and try again, or right-click the image to save it.",
    imageFailed: "The image could not be created. Reload the page and try again.",
    copyUnavailable: "Copying is not possible here. Right-click the image and choose “Copy image”.",
    copied: "Image copied. Paste it with Ctrl+V, e.g. into Word.",
    savePng: "Save as PNG",
    savePdf: "Save as PDF",
    pdfSaved: "PDF saved.",
    pdfFailed: "The PDF could not be created.",
    copy: "Copy image",
});

export const newDiagramText = defineText({
    title: "Neues Diagramm",
    intro: "Die Fläche wird geleert. Mit „Rückgängig“ holst du alles zurück.",
    restart: (mode: string) => `${mode} neu anfangen`,
}, {
    title: "New diagram",
    intro: "The canvas is cleared. “Undo” brings everything back.",
    restart: (mode: string) => `Start a new ${mode.toLowerCase()}`,
});

export const plansText = defineText({
    title: "Meine Pläne",
    count: (n: number) => `${n} ${n === 1 ? "Plan" : "Pläne"} in diesem Browser gespeichert. Klick auf einen Plan zum Öffnen.`,
    emptyBefore: "Noch keine Pläne gespeichert. Mit „Speichern“ oder ",
    emptyKey: "Strg+S",
    emptyAfter: " speicherst du den aktuellen Plan hier im Browser.",
    elements: (n: number) => `${n} Elemente`,
    rename: "Umbenennen",
    delete: "Löschen",
    confirmDelete: "Wirklich löschen?",
    saveCurrent: "Aktuellen Plan speichern",
    importFile: "Datei hochladen (.json)",
    exportFile: "Als Datei herunterladen (.json)",
    storageNote: "Die Pläne liegen nur in diesem Browser auf diesem Gerät. Wenn du die Browserdaten löschst, sind sie weg. Zum Mitnehmen auf ein anderes Gerät: „Als Datei herunterladen“ und dort wieder hochladen.",
}, {
    title: "My plans",
    count: (n: number) => `${n} ${n === 1 ? "plan" : "plans"} saved in this browser. Click a plan to open it.`,
    emptyBefore: "No plans saved yet. With “Save” or ",
    emptyKey: "Ctrl+S",
    emptyAfter: " you save the current plan here in the browser.",
    elements: (n: number) => `${n} elements`,
    rename: "Rename",
    delete: "Delete",
    confirmDelete: "Really delete?",
    saveCurrent: "Save current plan",
    importFile: "Upload file (.json)",
    exportFile: "Download as file (.json)",
    storageNote: "The plans are only stored in this browser on this device. If you clear the browser data, they are gone. To take them to another device: “Download as file” and upload it there.",
});

export const saveAsText = defineText({
    saveAs: "Speichern unter",
    savePlan: "Plan speichern",
    intro: "Der Plan wird hier im Browser gespeichert. Unter „Öffnen“ findest du ihn wieder.",
    name: "Name",
    save: "Speichern",
}, {
    saveAs: "Save as",
    savePlan: "Save plan",
    intro: "The plan is saved here in the browser. You find it again under “Open”.",
    name: "Name",
    save: "Save",
});

export const taskListDialogText = defineText({
    title: "Vorgangsliste",
    formatBefore: "Eine Zeile pro Vorgang: ",
    format: "Nr; Bezeichnung; Dauer; Vorgänger",
    formatAfter: ". Mehrere Vorgänger mit Komma trennen, keinen Vorgänger mit „-“. Eine Tabelle aus Excel kannst du direkt einfügen.",
    placeholder: "1; Anforderungen; 3; -\n2; Datenbank; 4; 1\n3; Oberfläche; 2; 1\n4; Integration; 5; 2, 3",
    alsoCalculate: "Werte gleich berechnen",
    build: "Netzplan erstellen",
    copy: "Liste kopieren",
    copied: "Liste kopiert.",
}, {
    title: "Activity list",
    formatBefore: "One line per activity: ",
    format: "No; Name; Duration; Predecessors",
    formatAfter: ". Separate several predecessors with commas, write “-” for none. You can paste a table from Excel directly.",
    placeholder: "1; Requirements; 3; -\n2; Database; 4; 1\n3; User interface; 2; 1\n4; Integration; 5; 2, 3",
    alsoCalculate: "Calculate values right away",
    build: "Create network diagram",
    copy: "Copy list",
    copied: "List copied.",
});
