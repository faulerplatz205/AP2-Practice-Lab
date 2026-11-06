import type { ActivityNode, Diagram, DiagramEdge, DiagramMode, DiagramNode, NodeType, Rect } from "../types/diagram";
import { snap } from "./math";
import { boundingBox } from "./geometry";
import { RELATIONS, UML_TYPES, isUml } from "./uml/types";
import { text } from "../i18n/locale";
import { diagramText, umlText } from "../i18n/diagram";

/** Default sizes of the generic shapes. UML sizes are in `UML_TYPES`. */
const GENERIC_SIZE: Record<string, { w: number; h: number; mw: number; mh: number }> = {
    np: { w: 200, h: 120, mw: 150, mh: 80 },
    rect: { w: 160, h: 70, mw: 40, mh: 30 },
    ellipse: { w: 150, h: 80, mw: 40, mh: 30 },
    diamond: { w: 140, h: 90, mw: 40, mh: 30 },
    text: { w: 160, h: 40, mw: 40, mh: 24 },
};

export function defaultSize(type: NodeType): { w: number; h: number } {
    if (isUml(type)) return { w: UML_TYPES[type].w, h: UML_TYPES[type].h };
    return GENERIC_SIZE[type];
}

export function minSize(type: NodeType): { w: number; h: number } {
    if (isUml(type)) return { w: UML_TYPES[type].minW ?? 40, h: UML_TYPES[type].minH ?? 24 };
    return { w: GENERIC_SIZE[type].mw, h: GENERIC_SIZE[type].mh };
}

export function emptyDiagram(mode: DiagramMode = "netz", start: 0 | 1 = 0): Diagram {
    return { nodes: [], edges: [], next: 1, cfg: { start, mode } };
}

export function isActivity(n: DiagramNode | undefined): n is ActivityNode {
    return !!n && n.type === "np" && !!n.f;
}

export function findNode(d: Diagram, id: number): DiagramNode | undefined {
    return d.nodes.find(n => n.id === id);
}

export function findEdge(d: Diagram, id: number): DiagramEdge | undefined {
    return d.edges.find(e => e.id === id);
}

export function nextActivityNr(d: Diagram): string {
    const nums = d.nodes.filter(isActivity).map(n => parseInt(n.f.nr)).filter(v => !isNaN(v));
    return String(nums.length ? Math.max(...nums) + 1 : 1);
}

/** New node centered at (x, y), with default texts in the current language. Takes its id from `d.next`. */
export function createNode(d: Diagram, type: NodeType, x = 0, y = 0): DiagramNode {
    const size = defaultSize(type);
    const n: DiagramNode = {
        id: d.next++,
        type,
        x: snap(x) - size.w / 2,
        y: snap(y) - size.h / 2,
        w: size.w,
        h: size.h,
        fill: 0,
        text: type === "text" ? text(diagramText).text : type === "np" ? "" : text(diagramText).shape,
    };
    if (isUml(type)) {
        const t = text(umlText)[type], stereo = UML_TYPES[type].stereo;
        n.text = t.text;
        if (t.attrs !== undefined) n.attrs = t.attrs;
        if (t.ops !== undefined) n.ops = t.ops;
        if (stereo !== undefined) n.stereo = stereo;
    }
    if (type === "np") {
        n.f = { nr: nextActivityNr(d), name: text(diagramText).newActivity, d: "", faz: "", fez: "", saz: "", sez: "", gp: "", fp: "" };
    }
    return n;
}

export function diagramBox(d: Diagram): Rect | null {
    return boundingBox(d.nodes);
}

/** Guesses the diagram kind from the node types (for older plans without `cfg.mode`). */
export function guessMode(d: Pick<Diagram, "nodes">): DiagramMode {
    const t = new Set((d.nodes ?? []).map(n => n.type));
    if (t.has("np")) return "netz";
    const byType: [DiagramMode, NodeType[]][] = [
        [ "akt", [ "action", "decision", "bar", "signal", "accept", "objnode", "lane" ]],
        [ "zu", [ "state" ]],
        [ "uc", [ "actor", "usecase", "boundary" ]],
        [ "kl", [ "class" ]],
        [ "seq", [ "lifeline", "actline", "activation", "fragment" ]],
        [ "obj", [ "object" ]],
        [ "komp", [ "component", "iface" ]],
        [ "vert", [ "node3d", "artifact" ]],
        [ "pak", [ "package" ]],
        [ "er", [ "entity", "relship", "erattr" ]],
        [ "rel", [ "table", "sheet" ]],
    ];
    for (const [ mode, types ] of byType) if (types.some(x => t.has(x))) return mode;
    return t.size ? "frei" : "netz";
}

const ALL_MODES: DiagramMode[] = [ "netz", "akt", "uc", "kl", "seq", "zu", "obj", "komp", "vert", "pak", "er", "rel", "frei" ];

const NODE_TYPES = new Set<string>([ ...Object.keys(GENERIC_SIZE), ...Object.keys(UML_TYPES) ]);

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** A usable node, `null` when id, type or position are missing. Size, fill, text and activity fields get defaults. */
function cleanNode(raw: unknown): DiagramNode | null {
    if (!isObject(raw)) return null;
    const n = raw as Partial<DiagramNode>;
    if (!isNumber(n.id) || !NODE_TYPES.has(String(n.type)) || !isNumber(n.x) || !isNumber(n.y)) return null;
    const type = n.type as NodeType;
    const sized = isNumber(n.w) && n.w > 0 && isNumber(n.h) && n.h > 0;
    const filled = isNumber(n.fill) && n.fill >= 0 && n.fill <= 4;
    const activity = type !== "np" || isObject(n.f);
    if (sized && filled && typeof n.text === "string" && activity) return n as DiagramNode;
    const size = defaultSize(type);
    const out = { ...n, type, w: sized ? n.w : size.w, h: sized ? n.h : size.h, fill: filled ? n.fill : 0, text: typeof n.text === "string" ? n.text : "" } as DiagramNode;
    if (!activity) out.f = { nr: "", name: "", d: "", faz: "", fez: "", saz: "", sez: "", gp: "", fp: "" };
    return out;
}

/** A usable edge between two existing nodes, else `null`. */
function cleanEdge(raw: unknown, nodeIds: Set<number>): DiagramEdge | null {
    if (!isObject(raw)) return null;
    const e = raw as Partial<DiagramEdge>;
    if (!isNumber(e.id) || !isNumber(e.from) || !isNumber(e.to) || !nodeIds.has(e.from) || !nodeIds.has(e.to)) return null;
    if (e.kind !== undefined && !(e.kind in RELATIONS)) return null;
    return typeof e.label === "string" ? e as DiagramEdge : { ...e, label: "" } as DiagramEdge;
}

/** Keeps the first entry per id. */
function uniqueIds<T extends { id: number }>(items: T[]): T[] {
    const seen = new Set<number>();
    return items.filter(x => !seen.has(x.id) && !!seen.add(x.id));
}

/**
 * Migrates loaded data (storage, file, older versions) to the current shape; new fields get their defaults here.
 * Broken nodes and edges (no id, unknown type, line to a missing node) are dropped; valid ones are returned unchanged.
 */
export function normalize(raw: unknown): Diagram {
    const d = (isObject(raw) ? raw : {}) as Partial<Diagram> & { cfg?: Partial<Diagram["cfg"]> };
    const nodes = uniqueIds((Array.isArray(d.nodes) ? d.nodes : []).map(cleanNode).filter(n => n !== null));
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = uniqueIds((Array.isArray(d.edges) ? d.edges : []).map(e => cleanEdge(e, nodeIds)).filter(e => e !== null));
    const mode = d.cfg?.mode && ALL_MODES.includes(d.cfg.mode) ? d.cfg.mode : guessMode({ nodes });
    const next = Math.max(isNumber(d.next) ? d.next : 1, 1, ...nodes.map(n => n.id + 1), ...edges.map(e => e.id + 1));
    const out: Diagram = { nodes, edges, next, cfg: { start: d.cfg?.start === 1 ? 1 : 0, mode } };
    if (isObject(d.task)) out.task = d.task;
    if (isObject(d.norm)) out.norm = d.norm;
    return out;
}

export function looksLikeDiagram(raw: unknown): boolean {
    return isObject(raw) && Array.isArray(raw.nodes) && Array.isArray(raw.edges);
}

export type PlanFileResult =
    | { ok: true; diagram: Diagram; dropped: number }
    | { ok: false; reason: "json" | "shape" };

/** Reads the text of a plan file (.json export). `dropped` counts the broken nodes and edges left out. */
export function parsePlanFile(content: string): PlanFileResult {
    let data: unknown;
    try {
        data = JSON.parse(content);
    } catch {
        return { ok: false, reason: "json" };
    }
    if (!looksLikeDiagram(data)) return { ok: false, reason: "shape" };
    const rest = { ...data as Record<string, unknown> };
    delete rest.app;
    delete rest.version;
    const diagram = normalize(rest);
    const given = (rest.nodes as unknown[]).length + (rest.edges as unknown[]).length;
    const dropped = given - diagram.nodes.length - diagram.edges.length;
    if (given && !diagram.nodes.length) return { ok: false, reason: "shape" };
    return { ok: true, diagram, dropped };
}
