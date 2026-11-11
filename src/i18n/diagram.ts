import { type Dictionary, defineText } from "./locale";
import type { DiagramMode, RelationKind, UmlNodeType } from "../types/diagram";

export interface UmlText {
    label: string;
    /** Default texts of a new element */
    text: string;
    attrs?: string;
    ops?: string;
}

const umlTextTable = defineText({
    class: { label: "Klasse", text: "Klasse", attrs: "- name : String", ops: "+ getName() : String" },
    object: { label: "Objekt", text: "objekt : Klasse", attrs: "name = \"Wert\"" },
    actor: { label: "Akteur", text: "Akteur" },
    usecase: { label: "Anwendungsfall", text: "Anwendungsfall" },
    boundary: { label: "Systemgrenze", text: "System" },
    start: { label: "Startknoten", text: "" },
    end: { label: "Endknoten", text: "" },
    flowend: { label: "Ablaufende", text: "" },
    action: { label: "Aktion", text: "Aktion" },
    decision: { label: "Entscheidung / Zusammenführung", text: "" },
    bar: { label: "Gabelung / Vereinigung", text: "" },
    signal: { label: "Signal senden", text: "Signal senden" },
    accept: { label: "Signal empfangen", text: "Signal empfangen" },
    objnode: { label: "Objektknoten", text: "Rechnung" },
    lane: { label: "Partition (Swimlane)", text: "Partition" },
    state: { label: "Zustand", text: "Zustand", attrs: "" },
    compstate: { label: "Zusammengesetzter Zustand", text: "Zusammengesetzter Zustand" },
    history: { label: "Flache Historie (H)", text: "" },
    deephist: { label: "Tiefe Historie (H*)", text: "" },
    lifeline: { label: "Lebenslinie", text: ":Objekt" },
    actline: { label: "Akteur (Lebenslinie)", text: "Akteur" },
    activation: { label: "Aktivierungsbalken", text: "" },
    fragment: { label: "Kombiniertes Fragment", text: "alt", attrs: "[Bedingung]" },
    destroy: { label: "Zerstörung", text: "" },
    operand: { label: "Interaktionsoperand", text: "[else]" },
    invariant: { label: "Zustandsinvariante", text: "{Bedingung}" },
    component: { label: "Komponente", text: "Komponente" },
    port: { label: "Port", text: "" },
    iface: { label: "Schnittstelle", text: "Schnittstelle" },
    node3d: { label: "Knoten", text: "«device»\nServer" },
    artifact: { label: "Artefakt", text: "app.jar" },
    package: { label: "Paket", text: "paket" },
    note: { label: "Notiz", text: "Notiz" },
    entity: { label: "Entität", text: "Entität" },
    relship: { label: "Beziehung", text: "hat" },
    erattr: { label: "Attribut", text: "Attribut" },
    table: { label: "Tabelle", text: "Tabelle", attrs: "PK id INT\nname VARCHAR(50)" },
    sheet: { label: "Datentabelle", text: "Beispieldaten", attrs: "Nr | Name | Ort\n1 | Meier | Hannover" },
} satisfies Record<UmlNodeType, UmlText>, {
    class: { label: "Class", text: "Class", attrs: "- name : String", ops: "+ getName() : String" },
    object: { label: "Object", text: "object : Class", attrs: "name = \"value\"" },
    actor: { label: "Actor", text: "Actor" },
    usecase: { label: "Use case", text: "Use case" },
    boundary: { label: "System boundary", text: "System" },
    start: { label: "Initial node", text: "" },
    end: { label: "Final node", text: "" },
    flowend: { label: "Flow final", text: "" },
    action: { label: "Action", text: "Action" },
    decision: { label: "Decision / merge", text: "" },
    bar: { label: "Fork / join", text: "" },
    signal: { label: "Send signal", text: "Send signal" },
    accept: { label: "Accept signal", text: "Accept signal" },
    objnode: { label: "Object node", text: "Invoice" },
    lane: { label: "Partition (swimlane)", text: "Partition" },
    state: { label: "State", text: "State", attrs: "" },
    compstate: { label: "Composite state", text: "Composite state" },
    history: { label: "Shallow history (H)", text: "" },
    deephist: { label: "Deep history (H*)", text: "" },
    lifeline: { label: "Lifeline", text: ":Object" },
    actline: { label: "Actor (lifeline)", text: "Actor" },
    activation: { label: "Activation bar", text: "" },
    fragment: { label: "Combined fragment", text: "alt", attrs: "[condition]" },
    destroy: { label: "Destruction", text: "" },
    operand: { label: "Interaction operand", text: "[else]" },
    invariant: { label: "State invariant", text: "{condition}" },
    component: { label: "Component", text: "Component" },
    port: { label: "Port", text: "" },
    iface: { label: "Interface", text: "Interface" },
    node3d: { label: "Node", text: "«device»\nServer" },
    artifact: { label: "Artifact", text: "app.jar" },
    package: { label: "Package", text: "package" },
    note: { label: "Note", text: "Note" },
    entity: { label: "Entity", text: "Entity" },
    relship: { label: "Relationship", text: "has" },
    erattr: { label: "Attribute", text: "Attribute" },
    table: { label: "Table", text: "Table", attrs: "PK id INT\nname VARCHAR(50)" },
    sheet: { label: "Data table", text: "Sample data", attrs: "No | Name | City\n1 | Miller | Hanover" },
});

/** Names and default texts of all UML elements. Geometry and flags are in `UML_TYPES`. */
export const umlText: Dictionary<Record<UmlNodeType, UmlText>> = umlTextTable;

export const relationLabels = defineText<Record<RelationKind, string>>({
    flow: "Kontrollfluss (Pfeil)",
    assoc: "Assoziation",
    dir: "Gerichtete Assoziation",
    inherit: "Generalisierung (Vererbung)",
    realize: "Realisierung (Interface)",
    aggr: "Aggregation",
    comp: "Komposition",
    dep: "Abhängigkeit",
    include: "«include»",
    extend: "«extend»",
    msg: "Synchrone Nachricht",
    async: "Asynchrone Nachricht",
    reply: "Antwortnachricht",
    create: "Erzeugungsnachricht",
    anchor: "Notizverbindung",
    require: "Benötigte Schnittstelle (Socket)",
    delegate: "Delegationskonnektor",
    deploy: "«deploy»",
    manifest: "«manifest»",
    import: "«import»",
    access: "«access»",
    merge: "«merge»",
    erl: "Linie (Kardinalität)",
    fk: "Beziehung (1:n)",
}, {
    flow: "Control flow (arrow)",
    assoc: "Association",
    dir: "Directed association",
    inherit: "Generalization (inheritance)",
    realize: "Realization (interface)",
    aggr: "Aggregation",
    comp: "Composition",
    dep: "Dependency",
    include: "«include»",
    extend: "«extend»",
    msg: "Synchronous message",
    async: "Asynchronous message",
    reply: "Reply message",
    create: "Create message",
    anchor: "Note link",
    require: "Required interface (socket)",
    delegate: "Delegation connector",
    deploy: "«deploy»",
    manifest: "«manifest»",
    import: "«import»",
    access: "«access»",
    merge: "«merge»",
    erl: "Line (cardinality)",
    fk: "Relationship (1:n)",
});

/** Names of a relation in one diagram kind where the standard term differs from the general name, e.g. a line is a communication path in a deployment diagram. */
export const modeRelationLabels = defineText<Partial<Record<DiagramMode, Partial<Record<RelationKind, string>>>>>({
    netz: { flow: "Pfeil (Anordnungsbeziehung)" },
    uc: { inherit: "Generalisierung" },
    zu: { flow: "Transition (Zustandsübergang)" },
    akt: { flow: "Kontrollfluss" },
    obj: { assoc: "Link (Objektbeziehung)" },
    komp: { assoc: "Bereitgestellte Schnittstelle (Ball)", dep: "Abhängigkeit" },
    vert: { assoc: "Kommunikationspfad", dep: "Abhängigkeit" },
    pak: { dep: "Abhängigkeit" },
}, {
    netz: { flow: "Arrow (precedence)" },
    uc: { inherit: "Generalization" },
    zu: { flow: "Transition" },
    akt: { flow: "Control flow" },
    obj: { assoc: "Link" },
    komp: { assoc: "Provided interface (ball)", dep: "Dependency" },
    vert: { assoc: "Communication path", dep: "Dependency" },
    pak: { dep: "Dependency" },
});

/** Name of a relation as shown in the given diagram kind. */
export function relationName(general: Record<RelationKind, string>, perMode: Partial<Record<DiagramMode, Partial<Record<RelationKind, string>>>>, mode: DiagramMode, kind: RelationKind): string {
    return perMode[mode]?.[kind] ?? general[kind];
}

/** Names of the fill colors, index = `node.fill` (colors: `FILLS`). */
export const fillNames = defineText(
    [ "Standard", "Blau", "Grün", "Gelb", "Rot" ],
    [ "Default", "Blue", "Green", "Yellow", "Red" ],
);

/** Default texts of new shapes and messages of diagram operations. */
export const diagramText = defineText({
    /** Default text of a new text element */
    text: "Text",
    /** Default text of a new rectangle, ellipse or diamond */
    shape: "Form",
    newActivity: "Neuer Vorgang",
    /** Guards that are added automatically to the exits of a decision */
    guardYes: "[ja]",
    guardNo: "[nein]",
    noActivities: "Es gibt noch keine Vorgangsknoten.",
    layoutCycle: "Anordnen geht nicht: Der Plan enthält einen Kreis.",
}, {
    text: "Text",
    shape: "Shape",
    newActivity: "New activity",
    guardYes: "[yes]",
    guardNo: "[no]",
    noActivities: "There are no activity nodes yet.",
    layoutCycle: "Cannot arrange: the plan contains a cycle.",
});
