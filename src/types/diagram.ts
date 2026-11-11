/** Stored and exported 1:1: never rename fields, or saved plans no longer load. Details: docs/data-model.md */

/**
 * All values are text because they may be empty or wrong.
 * Keys follow the German IHK terms (faz/fez/saz/sez/gp/fp = ES/EF/LS/LF/TF/FF).
 */
export interface ActivityFields {
    nr: string;
    name: string;
    d: string;
    faz: string;
    fez: string;
    saz: string;
    sez: string;
    gp: string;
    fp: string;
}

export type ActivityKey = keyof ActivityFields;

export type TimeKey = "faz" | "fez" | "saz" | "sez" | "gp" | "fp";

export type GenericNodeType = "np" | "rect" | "ellipse" | "diamond" | "text";

export type UmlNodeType =
    | "class" | "object" | "actor" | "usecase" | "boundary"
    | "start" | "end" | "flowend" | "connector" | "action" | "decision" | "bar"
    | "signal" | "accept" | "objnode" | "lane" | "state" | "compstate" | "history" | "deephist"
    | "lifeline" | "actline" | "activation" | "fragment" | "destroy" | "operand" | "invariant"
    | "component" | "port" | "iface" | "node3d" | "artifact" | "package" | "note"
    | "entity" | "relship" | "erattr" | "table" | "sheet";

export type NodeType = GenericNodeType | UmlNodeType;

/** Empty = normal class or attribute. ER attributes: "key" (underlined), "partial" (dashed underline, key of a weak entity), "multi" (double ellipse), "derived" (dashed). ER: entity "weak" (double border), relationship "ident" (double diamond). */
export type Stereotype = "" | "abstract" | "interface" | "enum" | "key" | "multi" | "derived" | "partial" | "weak" | "ident";

export interface DiagramNode {
    id: number;
    type: NodeType;
    x: number;
    y: number;
    w: number;
    h: number;
    /** Fill color: 0 default, 1 blue, 2 green, 3 yellow, 4 red */
    fill: number;
    text: string;
    attrs?: string;
    ops?: string;
    stereo?: Stereotype;
    align?: "left";
    f?: ActivityFields;
}

export type ActivityNode = DiagramNode & { type: "np"; f: ActivityFields };

export type RelationKind =
    | "flow" | "assoc" | "dir" | "inherit" | "realize" | "aggr" | "comp"
    | "dep" | "include" | "extend" | "msg" | "async" | "reply" | "create" | "anchor"
    /** Component, deployment and package diagrams: required interface (socket), delegation, «deploy», «manifest», «import», «access», «merge» */
    | "require" | "delegate" | "deploy" | "manifest" | "import" | "access" | "merge"
    /** ER line (cardinality in `label`) and table relation (1/n in `m1`/`m2`) */
    | "erl" | "fk";

export interface DiagramEdge {
    id: number;
    from: number;
    to: number;
    label: string;
    /** Missing in older plans, then means "flow" */
    kind?: RelationKind;
    /** Messages: height relative to the top of the sender */
    y?: number;
    /** Multiplicity at the start */
    m1?: string;
    /** Multiplicity at the end */
    m2?: string;
    /** Detour found by "tidy up", valid while `key` matches the position and size of both nodes */
    route?: EdgeRoute;
    /** Anchor of a note that hangs on a line: id of that line. `from` is the note, `to` one end of the line */
    on?: number;
}

export interface EdgeRoute {
    key: string;
    /** Waypoints between the two nodes */
    ws: [number, number][];
}

export type DiagramMode = "netz" | "akt" | "uc" | "kl" | "seq" | "zu" | "obj" | "komp" | "vert" | "pak" | "er" | "rel" | "frei";

export interface DiagramConfig {
    /** Counting mode of the network diagram: start at 0 or at 1 */
    start: 0 | 1;
    mode: DiagramMode;
}

export interface TaskRow {
    nr: string;
    name: string;
    d: number;
    pred: string[];
}

export interface Exercise {
    /** "calc": the plan is drawn. "draw": only the activity list is given. */
    mode: "calc" | "draw";
    list: TaskRow[];
    usedCalc?: boolean;
    done?: boolean;
}

/** Normalisation exercise: the scenario is defined in src/data/normalization.ts */
export interface NormExercise {
    /** Scenario id, never renamed */
    id: string;
    /** Model solution was inserted */
    shown?: boolean;
    done?: boolean;
}

export interface Diagram {
    nodes: DiagramNode[];
    edges: DiagramEdge[];
    /** Next free id for nodes and edges */
    next: number;
    cfg: DiagramConfig;
    task?: Exercise;
    norm?: NormExercise;
}

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface Point {
    x: number;
    y: number;
}
