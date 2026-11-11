import { defineText } from "./locale";

/** Messages of „Prüfen“ that do not belong to one diagram kind: empty drawing, free shapes. */
export const checkGeneralText = defineText({
    empty: (kind: string) => `${kind}: Es gibt noch nichts zu prüfen`,
    emptyTip: "Setz Elemente aus der Palette links auf die Zeichenfläche und verbinde sie. Dann prüft „Prüfen“ das Diagramm.",
    freeShapes: "Freie Formen werden nicht geprüft",
    freeShapesTip: "Rechteck, Ellipse, Raute, Text und Pfeile haben keine festen Regeln. Für eine Prüfung wähle eine Diagrammart, z. B. Aktivitäts- oder Klassendiagramm.",
}, {
    empty: (kind: string) => `${kind}: there is nothing to check yet`,
    emptyTip: "Place elements from the palette on the left and connect them. Then “Check” checks the diagram.",
    freeShapes: "Free shapes are not checked",
    freeShapesTip: "Rectangle, ellipse, diamond, text and arrows have no fixed rules. To get a check, pick a diagram kind, e.g. activity or class diagram.",
});
