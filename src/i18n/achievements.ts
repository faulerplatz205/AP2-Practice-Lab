import { defineText } from "./locale";

interface AchievementText {
    name: string;
    description: string;
    /** Shown instead of the description while a secret achievement is locked */
    hint?: string;
}

/** Names and descriptions of all achievements. Keys are the stored achievement ids. */
export const achievementText = defineText({
    first_node: { name: "Erster Vorgang", description: "Setze im Netzplan einen Vorgangsknoten auf die Zeichenfläche." },
    first_arrow: { name: "Verbunden", description: "Verbinde zwei vorhandene Knoten mit einem Pfeil (Werkzeug „Pfeil“ oder Taste A), egal in welcher Diagrammart." },
    calc: { name: "Rechenknecht", description: "Lass einen Netzplan mit „Berechnen“ ausrechnen." },
    check_ok: { name: "Richtiger Netzplan", description: "Prüfe einen Netzplan richtig: alle Felder ausgefüllt, kein Fehler, kein Hinweis." },
    milestone: { name: "Meilenstein", description: "Prüfe einen richtigen Netzplan, in dem ein Vorgang die Dauer 0 hat." },
    big: { name: "Großprojekt", description: "Prüfe einen richtigen Netzplan mit mindestens 10 Vorgängen." },
    start1: { name: "Andere Schule", description: "Prüfe einen richtigen Netzplan mit der Zählweise „Start bei 1“." },
    mental: { name: "Kopfrechner", description: "Starte über „Übung“ eine Aufgabe „Rechnen“ und prüfe sie richtig, ohne „Berechnen“ zu benutzen." },
    architect: { name: "Architekt", description: "Starte über „Übung“ eine Aufgabe „Zeichnen und rechnen“ und prüfe sie richtig, ohne „Berechnen“ zu benutzen." },
    tasks5: { name: "Dauerlerner", description: "Löse 5 Netzplan-Übungen (Knopf „Übung“) und prüfe sie jeweils richtig. „Berechnen“ ist hier erlaubt." },
    uml_first: { name: "UML-Einsteiger", description: "Setze ein UML-, ER- oder Tabellen-Element auf die Zeichenfläche oder füge ein Beispiel ein." },
    act_ok: { name: "Ablauf-Profi", description: "Prüfe ein Aktivitätsdiagramm ohne Fehler und ohne Hinweise." },
    uml_ok: { name: "Richtiges UML-Diagramm", description: "Prüfe ein UML-Diagramm, ER- oder Tabellenmodell ohne Fehler und ohne Hinweise." },
    uml_kinds: { name: "Diagramm-Sammler", description: "Prüfe 4 verschiedene Diagrammarten ohne Fehler und Hinweise. Es zählen UML-Diagramme, ER- und Tabellenmodell, nicht der Netzplan." },
    quick: { name: "Schnellzeichner", description: "Hänge 10 neue Elemente direkt an: mit „+“ am ausgewählten Knoten, „Danach anhängen“, „Attribut anhängen“ oder einem Pfeil ins Leere." },
    unbeatable: { name: "Ihr werdet mich niemals besiegen", description: "Prüfe 5 verschiedene Diagramme oder Netzpläne nacheinander richtig. Ein Fehler setzt dich auf 0 zurück, ein Hinweis nicht." },
    list: { name: "Listenprofi", description: "Erstelle über „Vorgangsliste“ einen Netzplan aus einer Vorgangsliste." },
    layout: { name: "Ordnung muss sein", description: "Klick auf „Sauber anordnen“ (Taste L), während etwas auf der Zeichenfläche liegt." },
    gantt: { name: "Gantt-Fan", description: "Öffne mit „Gantt“ das Gantt-Diagramm eines Netzplans, der sich berechnen lässt." },
    export: { name: "Fotograf", description: "Lade eine Zeichnung als Bild oder PDF herunter, kopiere sie als Bild oder speichere das Gantt-Diagramm als Bild." },
    guide: { name: "Leseratte", description: "Öffne jedes Kapitel der „Anleitung“ mindestens einmal." },
    subnet_first: { name: "Netzwerker", description: "Gib unter Subnetting bei „Rechner“, „Subnetze aufteilen“ oder „IPv6“ eine gültige Eingabe ein." },
    subnet_ok: { name: "Maskenträger", description: "Löse unter Subnetting > „Üben“ eine Aufgabe komplett richtig, ohne vorher die Lösung anzuzeigen." },
    subnet10: { name: "Subnetz-Profi", description: "Löse unter Subnetting > „Üben“ 10 Aufgaben komplett richtig, jeweils ohne vorher die Lösung anzuzeigen." },
    night: { name: "Nachtschicht", description: "Prüfe einen richtigen Netzplan oder ein richtiges Diagramm zwischen 22 und 5 Uhr.", hint: "Prüfe etwas fehlerfrei, wenn andere längst schlafen." },
    rainer: { name: "Rainer!", description: "Tippe „rainer“, irgendwo außerhalb eines Eingabefelds." },
    rainer10: { name: "Rainer-Fanclub", description: "Rufe Rainer 10-mal, indem du „rainer“ tippst. Bilder in der Galerie öffnen zählt nicht." },
} satisfies Record<string, AchievementText>, {
    first_node: { name: "First activity", description: "Place an activity node on the canvas of a network diagram." },
    first_arrow: { name: "Connected", description: "Connect two existing nodes with an arrow (“Arrow” tool or key A), in any diagram kind." },
    calc: { name: "Number cruncher", description: "Let “Calculate” work out a network diagram." },
    check_ok: { name: "Correct network diagram", description: "Check a network diagram correctly: every field filled in, no mistake, no hint." },
    milestone: { name: "Milestone", description: "Check a correct network diagram in which an activity has duration 0." },
    big: { name: "Big project", description: "Check a correct network diagram with at least 10 activities." },
    start1: { name: "Different school", description: "Check a correct network diagram with counting mode “start at 1”." },
    mental: { name: "Mental arithmetic", description: "Start a “Calculate” task via “Exercise” and check it correctly without using the “Calculate” button." },
    architect: { name: "Architect", description: "Start a “Draw and calculate” task via “Exercise” and check it correctly without using the “Calculate” button." },
    tasks5: { name: "Eager learner", description: "Solve 5 network diagram exercises (button “Exercise”) and check each one correctly. “Calculate” is allowed here." },
    uml_first: { name: "UML beginner", description: "Place a UML, ER or table element on the canvas or insert an example." },
    act_ok: { name: "Flow expert", description: "Check an activity diagram without mistakes and without hints." },
    uml_ok: { name: "Correct UML diagram", description: "Check a UML diagram, ER or table model without mistakes and without hints." },
    uml_kinds: { name: "Diagram collector", description: "Check 4 different diagram kinds without mistakes and hints. UML diagrams, ER and table model count, the network diagram does not." },
    quick: { name: "Speed drawer", description: "Append 10 new elements directly: with “+” on the selected node, “Append next”, “Add an attribute” or an arrow dropped on empty space." },
    unbeatable: { name: "Ihr werdet mich niemals besiegen", description: "Check 5 different diagrams or network diagrams correctly in a row. A mistake resets you to 0, a hint does not." },
    list: { name: "List expert", description: "Create a network diagram from an activity list via “Activity list”." },
    layout: { name: "Order must be", description: "Click “Tidy up” (key L) while something is on the canvas." },
    gantt: { name: "Gantt fan", description: "Open the Gantt chart with “Gantt” for a network diagram that can be calculated." },
    export: { name: "Photographer", description: "Download a drawing as image or PDF, copy it as an image or save the Gantt chart as an image." },
    guide: { name: "Bookworm", description: "Open every chapter of the “Guide” at least once." },
    subnet_first: { name: "Networker", description: "Enter a valid input under Subnetting in “Calculator”, “Split network” or “IPv6”." },
    subnet_ok: { name: "Mask bearer", description: "Solve a task under Subnetting > “Practice” completely right without showing the solution first." },
    subnet10: { name: "Subnet pro", description: "Solve 10 tasks under Subnetting > “Practice” completely right, each without showing the solution first." },
    night: { name: "Night shift", description: "Check a correct network diagram or diagram between 10 pm and 5 am.", hint: "Check something without mistakes while others have long been asleep." },
    rainer: { name: "Rainer!", description: "Type “rainer” anywhere outside an input field." },
    rainer10: { name: "Rainer fan club", description: "Call Rainer 10 times by typing “rainer”. Opening pictures in the gallery does not count." },
});

/** Level titles, index = level - 1. */
export const levelTitles = defineText(
    [ "Azubi-Neuling", "Praktikant", "Planer", "Projektplaner", "Netzplan-Profi", "UML-Zeichner", "Prüfungsreif", "Projektleiter", "AP2-Meister" ],
    [ "Apprentice rookie", "Intern", "Planner", "Project planner", "Network pro", "UML drawer", "Exam ready", "Project lead", "AP2 master" ],
);

/** Texts of the achievement dialog, popup and level chip. */
export const achievementUi = defineText({
    levelChipTitle: "Achievements und Level",
    level: (n: number) => `Level ${n}`,
    levelShort: (n: number) => `Lv ${n}`,
    progress: (xp: number, next: number, level: number, title: string) => `${xp} XP · noch ${next - xp} XP bis Level ${level} (${title})`,
    maxLevel: (xp: number) => `${xp} XP · Höchstes Level erreicht`,
    count: (got: number, total: number) => `${got} von ${total} Achievements`,
    tabAchievements: "Achievements",
    tabGallery: (got: number, total: number) => `Rainer-Galerie (${got}/${total})`,
    secret: "Geheimes Achievement",
    secretHint: "Finde es selbst heraus.",
    unlocksRainer: (n: number) => `Schaltet Rainer #${n} frei`,
    galleryIntro: "Jedes Bild gehört zu einem Achievement. Hast du es, kann das Bild erscheinen, wenn du irgendwo außerhalb eines Eingabefelds „rainer“ tippst. Welches kommt, ist zufällig. Ein Klick auf ein freigeschaltetes Bild öffnet es direkt.",
    locked: "Gesperrt",
    unlockWith: (name: string) => `Freischalten mit „${name}“`,
    close: "Schließen",
    levelUp: "Level aufgestiegen",
    unlocked: "Achievement freigeschaltet",
}, {
    levelChipTitle: "Achievements and level",
    level: (n: number) => `Level ${n}`,
    levelShort: (n: number) => `Lv ${n}`,
    progress: (xp: number, next: number, level: number, title: string) => `${xp} XP · ${next - xp} XP to level ${level} (${title})`,
    maxLevel: (xp: number) => `${xp} XP · Highest level reached`,
    count: (got: number, total: number) => `${got} of ${total} achievements`,
    tabAchievements: "Achievements",
    tabGallery: (got: number, total: number) => `Rainer gallery (${got}/${total})`,
    secret: "Secret achievement",
    secretHint: "Find it out yourself.",
    unlocksRainer: (n: number) => `Unlocks Rainer #${n}`,
    galleryIntro: "Every picture belongs to an achievement. Once you have it, the picture can show up when you type “rainer” anywhere outside an input field. Which one comes is random. Click an unlocked picture to open it directly.",
    locked: "Locked",
    unlockWith: (name: string) => `Unlocked by “${name}”`,
    close: "Close",
    levelUp: "Level up",
    unlocked: "Achievement unlocked",
});
