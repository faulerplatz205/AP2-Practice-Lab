import { defineText } from "./locale";
import type { DiagramMode } from "../types/diagram";

interface ModeText {
    label: string;
    /** Short guide on the right when nothing is selected */
    tips: string[];
}

/** The structure (items, presets, relations) is built from this table in `src/data/modes.ts`. */
export const modeText = defineText({
    modes: {
        netz: {
            label: "Netzplan",
            tips: [ "Vorgang wählen und auf die Fläche klicken.", "Mit „Pfeil“ Vorgänger und Nachfolger verbinden.", "Dauer eintragen, selbst rechnen, dann „Prüfen“." ],
        },
        akt: {
            label: "Aktivitätsdiagramm",
            tips: [ "Startknoten setzen und anklicken.", "Rechts unter „Danach anhängen“ Aktionen, Entscheidungen und Balken anfügen.", "An Entscheidungen nur die Bedingung tippen, die [ ] kommen automatisch." ],
        },
        uc: {
            label: "Use-Case-Diagramm",
            tips: [ "Systemgrenze setzen, Anwendungsfälle hineinziehen.", "Akteure außerhalb platzieren und mit einer Linie verbinden.", "«include» und «extend» links unter Verbindungen wählen." ],
        },
        kl: {
            label: "Klassendiagramm",
            tips: [ "Klasse setzen, Doppelklick in Name, Attribute oder Methoden.", "Sichtbarkeit (+ - # ~) und Datentypen angeben.", "Beziehung links wählen, dann Klassen nacheinander anklicken." ],
        },
        seq: {
            label: "Sequenzdiagramm",
            tips: [ "Akteur und Lebenslinien nebeneinander setzen.", "Nachricht wählen, auf Absender und Empfänger klicken.", "Nachrichten nach oben oder unten ziehen. Aktivierungen auf die Linie legen." ],
        },
        zu: {
            label: "Zustandsdiagramm",
            tips: [ "Startzustand und Zustände setzen.", "Übergänge mit dem Pfeil verbinden und das Ereignis daran schreiben.", "Mit Endzustand abschließen." ],
        },
        obj: {
            label: "Objektdiagramm",
            tips: [ "Objekte setzen: name : Klasse.", "Attributwerte eintragen und Objekte verbinden." ],
        },
        komp: {
            label: "Komponentendiagramm",
            tips: [ "Komponenten und Schnittstellen setzen.", "Mit Abhängigkeit oder Realisierung verbinden." ],
        },
        vert: {
            label: "Verteilungsdiagramm",
            tips: [ "Knoten setzen, Artefakte hineinlegen.", "Knoten mit Kommunikationswegen verbinden." ],
        },
        pak: {
            label: "Paketdiagramm",
            tips: [ "Pakete setzen und Abhängigkeiten ziehen." ],
        },
        er: {
            label: "ER-Modell",
            tips: [ "Entitäten (Rechteck) setzen und über eine Beziehung (Raute) verbinden.", "Kardinalität (1, n, m) an jede Linie zwischen Entität und Raute schreiben: Doppelklick auf die Linie.", "Attribute (Ellipse) anhängen, den Schlüssel als Schlüsselattribut (unterstrichen)." ],
        },
        rel: {
            label: "Tabellenmodell",
            tips: [ "Tabelle setzen, Doppelklick in die Spalten. Eine Zeile pro Spalte, z. B. „PK kundenNr INT“ oder „FK plz CHAR(5)“.", "Tabellen mit „Beziehung (1:n)“ verbinden, 1 und n stehen an den Enden.", "m:n über eine Zwischentabelle auflösen. Der Fremdschlüssel steht in der n-Tabelle." ],
        },
        frei: {
            label: "Freies Zeichnen",
            tips: [ "Formen und Texte frei setzen und verbinden." ],
        },
    } satisfies Record<DiagramMode, ModeText>,
    items: {
        activity: "Vorgang",
        start: "Startknoten",
        action: "Aktion",
        decision: "Entscheidung",
        forkJoin: "Gabelung / Vereinigung",
        barVertical: "Balken senkrecht",
        end: "Endknoten",
        flowEnd: "Ablaufende",
        sendSignal: "Signal senden",
        acceptSignal: "Signal empfangen",
        objectNode: "Objektknoten",
        partition: "Partition",
        actor: "Akteur",
        useCase: "Anwendungsfall",
        boundary: "Systemgrenze",
        class: "Klasse",
        abstractClass: "Abstrakte Klasse",
        interface: "Interface",
        enumeration: "Aufzählung",
        lifeline: "Lebenslinie",
        activation: "Aktivierung",
        fragment: "Fragment (alt, loop …)",
        startState: "Startzustand",
        state: "Zustand",
        stateActivities: "Zustand mit Aktivitäten",
        endState: "Endzustand",
        object: "Objekt",
        component: "Komponente",
        iface: "Schnittstelle",
        node: "Knoten",
        artifact: "Artefakt",
        package: "Paket",
        rect: "Rechteck",
        ellipse: "Ellipse",
        diamond: "Raute",
        text: "Text",
        note: "Notiz",
        entity: "Entität",
        relationship: "Beziehung",
        attribute: "Attribut",
        keyAttribute: "Schlüsselattribut",
        table: "Tabelle",
        sheet: "Datentabelle",
    },
    /** Default texts of palette items with presets */
    presets: {
        abstractClass: "Fahrzeug",
        interfaceName: "Bezahlbar",
        interfaceOps: "+ bezahlen(betrag : double) : boolean",
        enumName: "Status",
        enumValues: "OFFEN\nBEZAHLT\nVERSENDET",
        stateActivities: "entry / öffnen()\ndo / warten()\nexit / schließen()",
        keyAttribute: "ID",
    },
}, {
    modes: {
        netz: {
            label: "Network diagram",
            tips: [ "Pick “Activity” and click on the canvas.", "Connect predecessors and successors with “Arrow”.", "Enter durations, calculate yourself, then “Check”." ],
        },
        akt: {
            label: "Activity diagram",
            tips: [ "Place an initial node and click it.", "Append actions, decisions and bars on the right under “Append next”.", "On decisions just type the condition, the [ ] are added automatically." ],
        },
        uc: {
            label: "Use case diagram",
            tips: [ "Place a system boundary and drag use cases into it.", "Place actors outside and connect them with a line.", "Pick «include» and «extend» on the left under connections." ],
        },
        kl: {
            label: "Class diagram",
            tips: [ "Place a class, double-click the name, attributes or methods.", "Give visibility (+ - # ~) and data types.", "Pick a relationship on the left, then click the classes one after the other." ],
        },
        seq: {
            label: "Sequence diagram",
            tips: [ "Place the actor and lifelines side by side.", "Pick a message, click the sender and the receiver.", "Drag messages up or down. Put activations on the line." ],
        },
        zu: {
            label: "State machine diagram",
            tips: [ "Place an initial state and states.", "Connect transitions with the arrow and write the event on it.", "Finish with a final state." ],
        },
        obj: {
            label: "Object diagram",
            tips: [ "Place objects: name : Class.", "Enter attribute values and connect the objects." ],
        },
        komp: {
            label: "Component diagram",
            tips: [ "Place components and interfaces.", "Connect them with dependency or realization." ],
        },
        vert: {
            label: "Deployment diagram",
            tips: [ "Place nodes and put artifacts inside.", "Connect nodes with communication paths." ],
        },
        pak: {
            label: "Package diagram",
            tips: [ "Place packages and draw dependencies." ],
        },
        er: {
            label: "ER model",
            tips: [ "Place entities (rectangle) and connect them through a relationship (diamond).", "Write the cardinality (1, n, m) on every line between entity and diamond: double-click the line.", "Attach attributes (ellipse); the key as key attribute (underlined)." ],
        },
        rel: {
            label: "Table model",
            tips: [ "Place a table and double-click into the columns. One line per column, e.g. “PK customerNo INT” or “FK zip CHAR(5)”.", "Connect tables with “Relationship (1:n)”; 1 and n are at the ends.", "Resolve m:n with a junction table. The foreign key goes into the n table." ],
        },
        frei: {
            label: "Free drawing",
            tips: [ "Place and connect shapes and texts freely." ],
        },
    },
    items: {
        activity: "Activity",
        start: "Initial node",
        action: "Action",
        decision: "Decision",
        forkJoin: "Fork / join",
        barVertical: "Vertical bar",
        end: "Final node",
        flowEnd: "Flow final",
        sendSignal: "Send signal",
        acceptSignal: "Accept signal",
        objectNode: "Object node",
        partition: "Partition",
        actor: "Actor",
        useCase: "Use case",
        boundary: "System boundary",
        class: "Class",
        abstractClass: "Abstract class",
        interface: "Interface",
        enumeration: "Enumeration",
        lifeline: "Lifeline",
        activation: "Activation",
        fragment: "Fragment (alt, loop …)",
        startState: "Initial state",
        state: "State",
        stateActivities: "State with activities",
        endState: "Final state",
        object: "Object",
        component: "Component",
        iface: "Interface",
        node: "Node",
        artifact: "Artifact",
        package: "Package",
        rect: "Rectangle",
        ellipse: "Ellipse",
        diamond: "Diamond",
        text: "Text",
        note: "Note",
        entity: "Entity",
        relationship: "Relationship",
        attribute: "Attribute",
        keyAttribute: "Key attribute",
        table: "Table",
        sheet: "Data table",
    },
    presets: {
        abstractClass: "Vehicle",
        interfaceName: "Payable",
        interfaceOps: "+ pay(amount : double) : boolean",
        enumName: "Status",
        enumValues: "OPEN\nPAID\nSHIPPED",
        stateActivities: "entry / open()\ndo / wait()\nexit / close()",
        keyAttribute: "ID",
    },
});

export type ModeTexts = typeof modeText.de;
