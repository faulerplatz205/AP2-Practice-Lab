import type { Diagram, DiagramEdge, DiagramNode } from "../../types/diagram";
import { anchorPoint, center, type Outline } from "../geometry";
import { snap } from "../math";
import { FLOW_TYPES, RELATIONS, SEQUENCE_TYPES, UML_TYPES, isUml } from "./types";

/** Path of an edge and where its labels go. */
export interface EdgeGeometry {
    /** SVG path */
    d: string;
    /** Position of the label */
    lx: number;
    ly: number;
    anc?: "start" | "end";
    /** Start and end point with direction (for multiplicities) */
    s: [number, number];
    sd: [number, number];
    t: [number, number];
    td: [number, number];
}

function outline(n: DiagramNode): Outline {
    if (n.type === "ellipse" || n.type === "usecase" || (isUml(n.type) && UML_TYPES[n.type].round)) return "ellipse";
    if (n.type === "diamond" || n.type === "decision" || n.type === "relship") return "diamond";
    return "rect";
}

/** Rectangular shapes without UML meaning (activity, rectangle, text) get elbow arrows. */
function isPlainBox(n: DiagramNode): boolean {
    return !isUml(n.type) && n.type !== "ellipse" && n.type !== "diamond";
}

function canElbow(a: DiagramNode, b: DiagramNode): boolean {
    return isPlainBox(a) && isPlainBox(b) && a.x + a.w + 20 <= b.x;
}

/** Network diagram arrows sharing a predecessor or successor run over a common vertical line; returns its x per edge. */
export function sharedRails(d: Diagram): Map<number, number> {
    const byId = new Map(d.nodes.map(n => [ n.id, n ]));
    const edges = d.edges.filter(e => {
        const a = byId.get(e.from), b = byId.get(e.to);
        return a && b && (e.kind ?? "flow") === "flow" && canElbow(a, b);
    });
    // Union-find: edges with a common start or target form a group
    const parent = new Map(edges.map(e => [ e.id, e.id ]));
    const root = (x: number): number => {
        const p = parent.get(x)!;
        if (p === x) return x;
        const r = root(p);
        parent.set(x, r);
        return r;
    };
    const bySource = new Map<number, number[]>(), byTarget = new Map<number, number[]>();
    for (const e of edges) {
        bySource.set(e.from, [ ...(bySource.get(e.from) ?? []), e.id ]);
        byTarget.set(e.to, [ ...(byTarget.get(e.to) ?? []), e.id ]);
    }
    for (const group of [ ...bySource.values(), ...byTarget.values() ]) {
        for (const id of group) parent.set(root(id), root(group[0]));
    }
    const groups = new Map<number, DiagramEdge[]>();
    for (const e of edges) groups.set(root(e.id), [ ...(groups.get(root(e.id)) ?? []), e ]);
    const rails = new Map<number, number>();
    for (const g of groups.values()) {
        const right = Math.max(...g.map(e => byId.get(e.from)!.x + byId.get(e.from)!.w));
        const left = Math.min(...g.map(e => byId.get(e.to)!.x));
        if (left - right >= 20) {
            const x = snap((right + left) / 2);
            g.forEach(e => rails.set(e.id, Math.min(left - 10, Math.max(right + 10, x))));
        } else {
            g.forEach(e => rails.set(e.id, snap((byId.get(e.from)!.x + byId.get(e.from)!.w + byId.get(e.to)!.x) / 2)));
        }
    }
    return rails;
}

/** x position where a message leaves or reaches a lifeline or its activation. */
function messageX(d: Diagram, n: DiagramNode, y: number, dir: number, isSource: boolean): number {
    const pick = (m: DiagramNode): number => (dir > 0) === isSource ? m.x + m.w : m.x;
    if (n.type === "activation") return pick(n);
    const cx = n.x + n.w / 2;
    const act = d.nodes.find(m => m.type === "activation" && Math.abs(m.x + m.w / 2 - cx) < 14 && y >= m.y - 1 && y <= m.y + m.h + 1);
    return act ? pick(act) : cx;
}

function messageGeometry(d: Diagram, e: DiagramEdge, a: DiagramNode, b: DiagramNode): EdgeGeometry {
    const y = a.y + (e.y ?? 60);
    if (a.id === b.id) {
        const x = messageX(d, a, y, 1, true), x2 = messageX(d, a, y + 30, -1, false);
        return { d: `M${x} ${y}H${x + 46}V${y + 30}H${x2}`, lx: x + 52, ly: y + 18, anc: "start", s: [ x, y ], sd: [ 1, 0 ], t: [ x2, y + 30 ], td: [ 1, 0 ] };
    }
    const dir = Math.sign((b.x + b.w / 2) - (a.x + a.w / 2)) || 1;
    const x1 = messageX(d, a, y, dir, true), x2 = messageX(d, b, y, dir, false);
    return { d: `M${x1} ${y}H${x2}`, lx: (x1 + x2) / 2, ly: y - 7, s: [ x1, y ], sd: [ dir, 0 ], t: [ x2, y ], td: [ -dir, 0 ] };
}

/** Orthogonal routing in activity and state machine diagrams, preferably top to bottom. */
function flowGeometry(a: DiagramNode, b: DiagramNode): EdgeGeometry {
    const [ ax, ay ] = center(a), [ bx, by ] = center(b), ab = a.y + a.h, bt = b.y;
    const down = (path: string, s: [number, number], t: [number, number], td: [number, number] = [ 0, -1 ]): EdgeGeometry =>
        ({ d: path, lx: s[0] + 8, ly: ab + 16, anc: "start", s, sd: [ 0, 1 ], t, td });

    if (bt >= ab + 16) {
        if (Math.abs(ax - bx) < 3) return down(`M${ax} ${ab}V${bt}`, [ ax, ab ], [ ax, bt ]);
        if (a.type === "decision") {
            // branches leave the diamond at the side
            const sx = bx > ax ? a.x + a.w : a.x;
            return { d: `M${sx} ${ay}H${bx}V${bt}`, lx: sx + (bx > ax ? 8 : -8), ly: ay - 7, anc: bx > ax ? "start" : "end", s: [ sx, ay ], sd: [ Math.sign(bx - ax), 0 ], t: [ bx, bt ], td: [ 0, -1 ] };
        }
        if (a.type === "bar") {
            const sx = Math.min(Math.max(bx, a.x + 6), a.x + a.w - 6);
            return down(sx === bx ? `M${bx} ${ab}V${bt}` : `M${sx} ${ab}V${snap((ab + bt) / 2)}H${bx}V${bt}`, [ sx, ab ], [ bx, bt ]);
        }
        if (b.type === "bar") {
            const tx = Math.min(Math.max(ax, b.x + 6), b.x + b.w - 6);
            return down(tx === ax ? `M${ax} ${ab}V${bt}` : `M${ax} ${ab}V${snap((ab + bt) / 2)}H${tx}V${bt}`, [ ax, ab ], [ tx, bt ]);
        }
        if (b.type === "decision") {
            // merge: into the diamond from the side
            const tx = bx > ax ? b.x : b.x + b.w;
            return down(`M${ax} ${ab}V${by}H${tx}`, [ ax, ab ], [ tx, by ], [ Math.sign(ax - bx), 0 ]);
        }
        const my = snap((ab + bt) / 2);
        return down(`M${ax} ${ab}V${my}H${bx}V${bt}`, [ ax, ab ], [ bx, bt ]);
    }
    if (Math.abs(ay - by) < 3 && (b.x >= a.x + a.w + 16 || a.x >= b.x + b.w + 16)) {
        const r = b.x > a.x, sx = r ? a.x + a.w : a.x, tx = r ? b.x : b.x + b.w;
        return { d: `M${sx} ${ay}H${tx}`, lx: (sx + tx) / 2, ly: ay - 7, s: [ sx, ay ], sd: [ r ? 1 : -1, 0 ], t: [ tx, ay ], td: [ r ? -1 : 1, 0 ] };
    }
    if (b.x >= a.x + a.w + 16) {
        const sx = a.x + a.w, tx = b.x, mx = snap((sx + tx) / 2);
        return { d: `M${sx} ${ay}H${mx}V${by}H${tx}`, lx: sx + 8, ly: ay - 7, anc: "start", s: [ sx, ay ], sd: [ 1, 0 ], t: [ tx, by ], td: [ -1, 0 ] };
    }
    if (a.x >= b.x + b.w + 16) {
        const sx = a.x, tx = b.x + b.w, mx = snap((sx + tx) / 2);
        return { d: `M${sx} ${ay}H${mx}V${by}H${tx}`, lx: sx - 8, ly: ay - 7, anc: "end", s: [ sx, ay ], sd: [ -1, 0 ], t: [ tx, by ], td: [ 1, 0 ] };
    }
    // jump back up (loop): around the left side
    const lx = snap(Math.min(a.x, b.x) - 40);
    return { d: `M${a.x} ${ay}H${lx}V${by}H${b.x}`, lx: a.x - 8, ly: ay - 7, anc: "end", s: [ a.x, ay ], sd: [ -1, 0 ], t: [ b.x, by ], td: [ -1, 0 ] };
}

/**
 * Path of an edge. Order of the cases:
 * message (sequence) > control flow > network diagram elbow > straight line.
 * Compute `rails` with `sharedRails()` once per drawing and pass it in.
 */
export function edgeGeometry(d: Diagram, e: DiagramEdge, a: DiagramNode, b: DiagramNode, rails?: Map<number, number>): EdgeGeometry {
    const kind = e.kind ?? "flow";
    if (RELATIONS[kind]?.seq && SEQUENCE_TYPES.has(a.type) && SEQUENCE_TYPES.has(b.type)) return messageGeometry(d, e, a, b);
    if (kind === "flow" && FLOW_TYPES.has(a.type) && FLOW_TYPES.has(b.type) && a.id !== b.id) return flowGeometry(a, b);
    if (kind === "flow" && canElbow(a, b)) {
        const sx = a.x + a.w, sy = a.y + a.h / 2, tx = b.x, ty = b.y + b.h / 2;
        const mx = (rails ?? sharedRails(d)).get(e.id) ?? snap((sx + tx) / 2);
        const flat = Math.abs(sy - ty) < 1;
        return { d: flat ? `M${sx} ${sy}H${tx}` : `M${sx} ${sy}H${mx}V${ty}H${tx}`, lx: flat ? (sx + tx) / 2 : (mx + tx) / 2, ly: ty - 8, s: [ sx, sy ], sd: [ 1, 0 ], t: [ tx, ty ], td: [ -1, 0 ] };
    }
    const [ sx, sy ] = anchorPoint(a, outline(a), b.x + b.w / 2, b.y + b.h / 2);
    const [ tx, ty ] = anchorPoint(b, outline(b), a.x + a.w / 2, a.y + a.h / 2);
    const len = Math.hypot(tx - sx, ty - sy) || 1, ux = (tx - sx) / len, uy = (ty - sy) / len;
    return { d: `M${sx} ${sy}L${tx} ${ty}`, lx: (sx + tx) / 2, ly: (sy + ty) / 2 - 6, s: [ sx, sy ], sd: [ ux, uy ], t: [ tx, ty ], td: [ -ux, -uy ] };
}
