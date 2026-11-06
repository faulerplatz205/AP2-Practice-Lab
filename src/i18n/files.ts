import { defineText } from "./locale";

/** Errors while creating image files. */
export const fileText = defineText({
    imageFailed: "Bild konnte nicht erzeugt werden",
    pngFailed: "PNG fehlgeschlagen",
}, {
    imageFailed: "Could not create the image",
    pngFailed: "PNG failed",
});

/** Download menu, upload button and the messages of a download. */
export const downloadText = defineText({
    menu: "Herunterladen",
    menuTitle: "Plan herunterladen: als Datei, Bild oder PDF",
    formats: {
        json: { label: "Plan als Datei (.json)", hint: "Lässt sich später hier wieder öffnen" },
        png: { label: "Bild (.png)", hint: "Zum Einfügen in Word oder eine Präsentation" },
        pdf: { label: "PDF (.pdf)", hint: "Eine Seite zum Drucken oder Abgeben" },
    },
    copy: { label: "Bild kopieren", hint: "Mit Strg+V in Word oder PowerPoint einfügen" },
    copied: "Bild kopiert. Mit Strg+V einfügen.",
    reopenNote: "Nur die .json-Datei kannst du wieder hochladen. Bild und PDF sind zum Ansehen.",
    upload: "Hochladen",
    uploadTitle: "Plandatei (.json) hochladen und öffnen. Bilder und PDFs lassen sich nicht wieder öffnen.",
    saved: { json: "Plandatei heruntergeladen.", png: "Bild heruntergeladen.", pdf: "PDF heruntergeladen." },
    failed: { json: "Die Datei ließ sich nicht erzeugen.", png: "Das Bild ließ sich nicht erzeugen.", pdf: "Das PDF ließ sich nicht erstellen." },
    waiting: "Datei wird vorbereitet …",
    confirm: "Bestätige das Speichern im Fenster, das gleich aufgeht.",
    declined: "Speichern abgebrochen.",
    busy: "Es ist schon ein Speichern-Fenster offen. Schließ das bitte zuerst ab.",
    noWindow: "Kein Speichern-Fenster zu sehen? Lade die Seite neu und versuch es nochmal.",
    unavailable: "Herunterladen ist hier gerade nicht möglich. Lade die Seite neu und erlaube das Speichern, wenn du gefragt wirst.",
}, {
    menu: "Download",
    menuTitle: "Download the plan: as a file, image or PDF",
    formats: {
        json: { label: "Plan as file (.json)", hint: "Can be opened here again later" },
        png: { label: "Image (.png)", hint: "To paste into Word or a presentation" },
        pdf: { label: "PDF (.pdf)", hint: "One page to print or hand in" },
    },
    copy: { label: "Copy image", hint: "Paste it into Word or PowerPoint with Ctrl+V" },
    copied: "Image copied. Paste it with Ctrl+V.",
    reopenNote: "Only the .json file can be uploaded again. Image and PDF are for viewing.",
    upload: "Upload",
    uploadTitle: "Upload and open a plan file (.json). Images and PDFs cannot be opened again.",
    saved: { json: "Plan file downloaded.", png: "Image downloaded.", pdf: "PDF downloaded." },
    failed: { json: "The file could not be created.", png: "The image could not be created.", pdf: "The PDF could not be created." },
    waiting: "Getting the file ready …",
    confirm: "Confirm the save in the window that opens in a moment.",
    declined: "Saving cancelled.",
    busy: "A save window is already open. Please finish that one first.",
    noWindow: "No save window showing up? Reload the page and try again.",
    unavailable: "Downloading is not possible here right now. Reload the page and allow saving when asked.",
});
