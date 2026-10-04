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
    | "start" | "end" | "flowend" | "action" | "decision" | "bar"
    | "signal" | "accept" | "objnode" | "lane" | "state"
    | "lifeline" | "actline" | "activation" | "fragment"
    | "component" | "iface" | "node3d" | "artifact" | "package" | "note"
    | "entity" | "relship" | "erattr" | "table" | "sheet";

export type NodeType = GenericNodeType | UmlNodeType;

/** Empty = normal class or attribute. ER attributes: "key" (underlined), "multi" (double ellipse), "derived" (dashed). */
export type Stereotype = "" | "abstract" | "interface" | "enum" | "key" | "multi" | "derived";

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
    | "dep" | "include" | "extend" | "msg" | "async" | "reply" | "anchor"
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
