import type { ActivityNode, Diagram, DiagramEdge, DiagramMode, DiagramNode, NodeType, Rect } from "../types/diagram";
import { snap } from "./math";
import { boundingBox } from "./geometry";
import { UML_TYPES, isUml } from "./uml/types";
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

/** Migrates loaded data (storage, file, older versions) to the current shape; new fields get their defaults here. */
export function normalize(raw: unknown): Diagram {
    const d = raw as Partial<Diagram> & { cfg?: Partial<Diagram["cfg"]> };
    const nodes = Array.isArray(d.nodes) ? d.nodes : [];
    const edges = Array.isArray(d.edges) ? d.edges : [];
    const mode = d.cfg?.mode && ALL_MODES.includes(d.cfg.mode) ? d.cfg.mode : guessMode({ nodes });
    const next = Math.max(d.next ?? 1, 1, ...nodes.map(n => n.id + 1), ...edges.map(e => e.id + 1));
    const out: Diagram = { nodes, edges, next, cfg: { start: d.cfg?.start === 1 ? 1 : 0, mode } };
    if (d.task) out.task = d.task;
    if (d.norm) out.norm = d.norm;
    return out;
}

export function looksLikeDiagram(raw: unknown): boolean {
    const d = raw as Partial<Diagram> | null;
    return !!d && Array.isArray(d.nodes) && Array.isArray(d.edges);
}
