import type { DiagramNode, NodeType, RelationKind, Stereotype, UmlNodeType } from "../../types/diagram";

export interface UmlTypeInfo {
    /** Default size */
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    stereo?: Stereotype;
    notext?: boolean;
    /** Edges dock on a circle */
    round?: boolean;
    /** Container: lies at the back and carries its content when moved */
    box?: boolean;
    /** Carries its content but is not at the very back (lifeline) */
    carry?: boolean;
}

/** Names and default texts: `umlText` in src/i18n/diagram.ts */
export const UML_TYPES: Record<UmlNodeType, UmlTypeInfo> = {
    class: { w: 190, h: 110, minW: 110, stereo: "" },
    object: { w: 190, h: 80, minW: 110 },
    actor: { w: 70, h: 110, minW: 50, minH: 80 },
    usecase: { w: 170, h: 70 },
    boundary: { w: 380, h: 320, box: true },
    start: { w: 30, h: 30, minW: 20, minH: 20, notext: true, round: true },
    end: { w: 32, h: 32, minW: 22, minH: 22, notext: true, round: true },
    flowend: { w: 30, h: 30, minW: 20, minH: 20, notext: true, round: true },
    action: { w: 170, h: 56, minW: 70, minH: 36 },
    decision: { w: 44, h: 44, minW: 30, minH: 30, notext: true },
    bar: { w: 200, h: 8, minW: 6, minH: 6, notext: true },
    signal: { w: 170, h: 50, minW: 80, minH: 34 },
    accept: { w: 170, h: 50, minW: 80, minH: 34 },
    objnode: { w: 150, h: 46, minW: 70, minH: 30 },
    lane: { w: 260, h: 460, minW: 120, minH: 120, box: true },
    state: { w: 170, h: 60, minW: 90, minH: 40 },
    compstate: { w: 360, h: 240, minW: 160, minH: 110, box: true },
    history: { w: 28, h: 28, minW: 20, minH: 20, notext: true, round: true },
    deephist: { w: 28, h: 28, minW: 20, minH: 20, notext: true, round: true },
    lifeline: { w: 130, h: 340, minW: 80, minH: 120, carry: true },
    actline: { w: 90, h: 340, minW: 60, minH: 140, carry: true },
    activation: { w: 14, h: 80, minW: 10, minH: 20, notext: true },
    fragment: { w: 340, h: 170, minW: 140, minH: 70, box: true },
    destroy: { w: 24, h: 24, minW: 16, minH: 16, notext: true },
    operand: { w: 340, h: 24, minW: 100, minH: 20 },
    invariant: { w: 120, h: 30, minW: 60, minH: 24 },
    component: { w: 180, h: 80, minW: 100, minH: 50 },
    port: { w: 16, h: 16, minW: 10, minH: 10, notext: true },
    iface: { w: 24, h: 24, minW: 16, minH: 16, round: true },
    node3d: { w: 200, h: 130, minW: 100, minH: 70, box: true },
    artifact: { w: 150, h: 56, minW: 90, minH: 40 },
    package: { w: 230, h: 170, minW: 100, minH: 60, box: true },
    note: { w: 170, h: 70, minW: 60, minH: 36 },
    entity: { w: 150, h: 56, minW: 80, minH: 36 },
    relship: { w: 140, h: 76, minW: 80, minH: 50 },
    erattr: { w: 120, h: 44, minW: 60, minH: 30, round: true, stereo: "" },
    table: { w: 220, h: 98, minW: 150, minH: 50 },
    sheet: { w: 320, h: 94, minW: 120, minH: 40 },
};

export function isUml(type: NodeType): type is UmlNodeType {
    return type in UML_TYPES;
}

export function umlInfo(n: DiagramNode): UmlTypeInfo | undefined {
    return isUml(n.type) ? UML_TYPES[n.type] : undefined;
}

export const SEQUENCE_TYPES = new Set<NodeType>([ "lifeline", "actline", "activation", "destroy" ]);

/** ER model (Chen notation) */
export const ER_TYPES = new Set<NodeType>([ "entity", "relship", "erattr" ]);

/**
 * ER entity (also a weak entity) or relationship (also an identifying one): every ER type that is not an attribute.
 * Relationships are the diamond shaped ones; their type id contains "rel" (`relship`, an identifying relationship).
 */
export function isErRelationship(type: NodeType): boolean {
    return ER_TYPES.has(type) && type !== "erattr" && /rel|ident/i.test(type);
}

export function isErEntity(type: NodeType): boolean {
    return ER_TYPES.has(type) && type !== "erattr" && !isErRelationship(type);
}

/** Frames are drawn around other elements and are never connected; node and package are containers that are. */
export const FRAME_TYPES = new Set<NodeType>([ "boundary", "lane", "fragment", "operand" ]);

export const FLOW_TYPES = new Set<NodeType>([ "start", "end", "flowend", "action", "decision", "bar", "signal", "accept", "objnode", "state", "compstate", "history", "deephist" ]);

/** Elements that may be connected to themselves: self transition (state, composite state), reflexive association (class, object), self-referencing table. */
export const SELF_TYPES = new Set<NodeType>([ "state", "compstate", "class", "object", "table" ]);

/** Arrowheads, see `Markers.tsx`. */
export type MarkerKind = "ah" | "op" | "tr" | "dh" | "df" | "so";

export interface RelationInfo {
    end?: MarkerKind;
    start?: MarkerKind;
    dash?: string;
    /** Fixed text on the line */
    tag?: string;
    /** Message in a sequence diagram */
    seq?: boolean;
}

/** Names: `relationLabels` in src/i18n/diagram.ts */
export const RELATIONS: Record<RelationKind, RelationInfo> = {
    flow: { end: "ah" },
    assoc: {},
    dir: { end: "op" },
    inherit: { end: "tr" },
    realize: { end: "tr", dash: "7 5" },
    aggr: { start: "dh" },
    comp: { start: "df" },
    dep: { end: "op", dash: "7 5" },
    include: { end: "op", dash: "7 5", tag: "«include»" },
    extend: { end: "op", dash: "7 5", tag: "«extend»" },
    msg: { end: "ah", seq: true },
    async: { end: "op", seq: true },
    reply: { end: "op", dash: "7 5", seq: true },
    create: { end: "op", dash: "7 5", tag: "«create»", seq: true },
    anchor: { dash: "2 4" },
    require: { end: "so" },
    delegate: { end: "op", tag: "«delegate»" },
    deploy: { end: "op", dash: "7 5", tag: "«deploy»" },
    manifest: { end: "op", dash: "7 5", tag: "«manifest»" },
    import: { end: "op", dash: "7 5", tag: "«import»" },
    access: { end: "op", dash: "7 5", tag: "«access»" },
    merge: { end: "op", dash: "7 5", tag: "«merge»" },
    erl: {},
    fk: {},
};

export const RELATION_KINDS = Object.keys(RELATIONS) as RelationKind[];

export const FRAGMENT_OPERATORS = [ "alt", "opt", "loop", "par", "break", "critical", "ref", "neg", "assert", "seq", "strict", "sd" ];

/** Fitting relation kind when „Automatisch“ (automatic) is selected. */
export function autoRelation(a: DiagramNode, b: DiagramNode): RelationKind {
    if (SEQUENCE_TYPES.has(a.type) && SEQUENCE_TYPES.has(b.type)) return "msg";
    if (a.type === "note" || b.type === "note") return "anchor";
    const t = [ a.type, b.type ];
    if (t.includes("actor") || t.includes("usecase")) return "assoc";
    if (t.every(x => x === "class" || x === "object")) return "assoc";
    if (t.includes("iface") && t.some(x => x === "component" || x === "port")) return "assoc";
    if (t.includes("port") && t.includes("component")) return "delegate";
    if (a.type === "artifact" && b.type === "node3d") return "deploy";
    if (a.type === "artifact" && (b.type === "component" || b.type === "class")) return "manifest";
    if (a.type === "node3d" && b.type === "node3d") return "assoc";
    if (t.every(x => [ "component", "iface", "port", "package", "artifact", "node3d" ].includes(x))) return "dep";
    if (t.every(x => ER_TYPES.has(x))) return "erl";
    if (t.every(x => x === "table")) return "fk";
    return "flow";
}

export function lines(s: string | undefined): string[] {
    return String(s ?? "").split("\n");
}
