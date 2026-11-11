import type { Diagram, DiagramEdge, DiagramNode, NodeType } from "../../types/diagram";
import { anchorPoint, center, insideOutline, segmentsCross, type Vec } from "../geometry";
import { snap } from "../math";
import { detourGeometry, erGeometry, isClear, obstacles, parallelGeometry, type EdgeGeometry } from "./detour";
import { outline } from "./outline";
import { FLOW_TYPES, RELATIONS, SEQUENCE_TYPES, isUml } from "./types";
import { activationAt, messageY, ownerOf, pinnedTarget } from "./sequence";

export type { EdgeGeometry } from "./detour";

/** Values computed once per drawing that single edges need: shared rails and flow offsets. */
export interface RouteContext {
    /** Network diagram: x of the common vertical line per edge */
    rails: Map<number, number>;
    /** Activity diagram: vertical shift of the horizontal part of parallel flows */
    fanY: Map<number, number>;
    /** Activity diagram: extra distance of loops running back up */
    loopX: Map<number, number>;
    /** Flows between the same two boxes: shift to the right of the direction of travel */
    lane: Map<number, number>;
    /** Loops running back up: -1 around the left, 1 around the right side */
    loopSide: Map<number, number>;
    /** Activity and state machine diagram: the chosen path of every flow (see `routeFlows`) */
    flows: Map<number, EdgeGeometry>;
    /** Class, object, component, package and deployment diagram: right-angled path of every relation (see `routeStructure`) */
    struct: Map<number, EdgeGeometry>;
}

export function routeContext(d: Diagram): RouteContext {
    const offsets = flowOffsets(d);
    return { rails: sharedRails(d), ...offsets, flows: routeFlows(d, offsets), struct: routeStructure(d) };
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
    if (n.type === "destroy") return pick(n);
    const l = ownerOf(n, d.nodes);
    if (!l) return pick(n);
    const act = activationAt(d.nodes, l, y);
    return act ? pick(act) : l.x + l.w / 2;
}

function messageGeometry(d: Diagram, e: DiagramEdge, a: DiagramNode, b: DiagramNode): EdgeGeometry {
    const y = messageY(e, a, b);
    if (a.id === b.id) {
        const x = messageX(d, a, y, 1, true), x2 = messageX(d, a, y + 30, -1, false);
        return { d: `M${x} ${y}H${x + 46}V${y + 30}H${x2}`, lx: x + 52, ly: y + 18, anc: "start", s: [ x, y ], sd: [ 1, 0 ], t: [ x2, y + 30 ], td: [ 1, 0 ] };
    }
    const dir = Math.sign((b.x + b.w / 2) - (a.x + a.w / 2)) || 1;
    const x1 = messageX(d, a, y, dir, true);
    const x2 = pinnedTarget(e, b) === "head" ? (dir > 0 ? b.x : b.x + b.w) : messageX(d, b, y, dir, false);
    return { d: `M${x1} ${y}H${x2}`, lx: (x1 + x2) / 2, ly: y - 7, s: [ x1, y ], sd: [ dir, 0 ], t: [ x2, y ], td: [ -dir, 0 ] };
}

/** Flow nodes that edges dock at one point (center, vertex) instead of anywhere along a side. */
const POINT_TYPES = new Set<NodeType>([ "start", "end", "flowend", "decision" ]);

const isBoxFlow = (n: DiagramNode): boolean => !POINT_TYPES.has(n.type) && n.type !== "bar";

/**
 * Position of a straight line between two shapes that overlap along one axis: x of a vertical line (`axis` 0) or
 * y of a horizontal line (`axis` 1), or null when they do not overlap enough. Point-like shapes keep their center.
 */
function straightAt(a: DiagramNode, b: DiagramNode, axis: 0 | 1): number | null {
    const pos = (n: DiagramNode): number => axis ? n.y : n.x, size = (n: DiagramNode): number => axis ? n.h : n.w;
    const ac = pos(a) + size(a) / 2, bc = pos(b) + size(b) / 2;
    if (Math.abs(ac - bc) < 3) return ac;
    if (a.type === "bar" || b.type === "bar") return null;
    const within = (n: DiagramNode, v: number): boolean => v >= pos(n) + 10 && v <= pos(n) + size(n) - 10;
    if (POINT_TYPES.has(a.type)) return !POINT_TYPES.has(b.type) && within(b, ac) ? ac : null;
    if (POINT_TYPES.has(b.type)) return within(a, bc) ? bc : null;
    if (within(b, ac)) return ac;
    if (within(a, bc)) return bc;
    const lo = Math.max(pos(a), pos(b)) + 10, hi = Math.min(pos(a) + size(a), pos(b) + size(b)) - 10;
    return hi >= lo ? snap((lo + hi) / 2) : null;
}

/** x of a vertical line from the bottom of `a` straight down to the top of `b`, or null. */
const straightX = (a: DiagramNode, b: DiagramNode): number | null => straightAt(a, b, 0);

/** x of a straight line from the top of `a` up to the bottom of `b` (state or action above), or null. */
function straightUpX(d: Diagram, a: DiagramNode, b: DiagramNode, lane = 0): number | null {
    if (b.y + b.h + 16 > a.y || !isBoxFlow(a) || !isBoxFlow(b)) return null;
    const x = straightX(b, a);
    if (x === null) return null;
    return isClear(d, a, b, [[ x + lane, a.y ], [ x + lane, b.y + b.h ]]) ? x + lane : null;
}

/** Path of a loop running back up, around the left (`side` -1) or right side (1). */
function loopPath(a: DiagramNode, b: DiagramNode, side: number, loopX: number): Vec[] {
    const ay = center(a)[1], by = center(b)[1];
    if (side < 0) {
        const x = snap(Math.min(a.x, b.x) - 40) - loopX;
        return [[ a.x, ay ], [ x, ay ], [ x, by ], [ b.x, by ]];
    }
    const x = snap(Math.max(a.x + a.w, b.x + b.w) + 40) + loopX;
    return [[ a.x + a.w, ay ], [ x, ay ], [ x, by ], [ b.x + b.w, by ]];
}

interface FlowOffsets {
    fanY: Map<number, number>;
    loopX: Map<number, number>;
    lane: Map<number, number>;
    loopSide: Map<number, number>;
}

/**
 * Activity and state machine diagram: flows leaving several nodes of one row towards the same row get their
 * horizontal part at different heights; several flows between the same two boxes (there and back, or several
 * transitions with different triggers) run side by side; loops running back up take the side with fewer other
 * lines and keep a distance from each other.
 */
function flowOffsets(d: Diagram): FlowOffsets {
    const byId = new Map(d.nodes.map(n => [ n.id, n ]));
    const rows = new Map<string, Map<number, number>>(), rowOf = new Map<DiagramEdge, string>(), pairs = new Map<string, DiagramEdge[]>();
    const loops: { e: DiagramEdge; side: number }[] = [];
    const flows = d.edges.filter(e => {
        const a = byId.get(e.from), b = byId.get(e.to);
        return (e.kind ?? "flow") === "flow" && a && b && a !== b && FLOW_TYPES.has(a.type) && FLOW_TYPES.has(b.type);
    });
    for (const e of flows) {
        const a = byId.get(e.from)!, b = byId.get(e.to)!;
        if (!isBoxFlow(a) || !isBoxFlow(b)) continue;
        const key = `${Math.min(a.id, b.id)}|${Math.max(a.id, b.id)}`;
        pairs.set(key, [ ...(pairs.get(key) ?? []), e ]);
    }
    const lane = new Map<number, number>();
    for (const group of pairs.values()) {
        if (group.length < 2) continue;
        for (const e of group) {
            const same = group.filter(x => x.from === e.from), r = same.indexOf(e);
            lane.set(e.id, (group.length > same.length ? r + 0.5 : r - (same.length - 1) / 2) * 20);
        }
    }
    /** Loop side: one that stays clear of other shapes, else the one with fewer lines to other nodes. */
    const sideFor = (e: DiagramEdge, a: DiagramNode, b: DiagramNode): number => {
        const lo = Math.min(a.x, b.x), hi = Math.max(a.x + a.w, b.x + b.w);
        let left = 0, right = 0;
        for (const x of d.edges) {
            if (x === e) continue;
            for (const [ mine, other ] of [[ x.from, x.to ], [ x.to, x.from ]]) {
                const o = byId.get(other);
                if ((mine !== a.id && mine !== b.id) || !o || o === a || o === b) continue;
                const ox = center(o)[0];
                if (ox < lo) left++;
                else if (ox > hi) right++;
            }
        }
        const clearLeft = isClear(d, a, b, loopPath(a, b, -1, 0)), clearRight = isClear(d, a, b, loopPath(a, b, 1, 0));
        if (clearLeft !== clearRight) return clearLeft ? -1 : 1;
        return right < left ? 1 : -1;
    };
    for (const e of flows) {
        const a = byId.get(e.from)!, b = byId.get(e.to)!;
        const ax = center(a)[0], bottom = a.y + a.h;
        if (b.y >= bottom + 16) {
            if (straightX(a, b) !== null) continue;
            const key = `${Math.round(bottom)}|${Math.round(b.y)}`;
            rows.set(key, (rows.get(key) ?? new Map<number, number>()).set(a.id, ax));
            rowOf.set(e, key);
        } else if (b.x < a.x + a.w + 16 && a.x < b.x + b.w + 16 && straightUpX(d, a, b, lane.get(e.id)) === null) {
            loops.push({ e, side: sideFor(e, a, b) });
        }
    }
    const fanY = new Map<number, number>();
    for (const [ e, key ] of rowOf) {
        const group = rows.get(key)!;
        if (group.size < 2) continue;
        const order = [ ...group ].sort((p, q) => p[1] - q[1]).map(x => x[0]);
        const [ top, bottom ] = key.split("|").map(Number);
        fanY.set(e.id, (order.indexOf(e.from) - (order.length - 1) / 2) * Math.min(18, Math.max(12, (bottom - top - 24) / order.length)));
    }
    const loopX = new Map<number, number>(), loopSide = new Map<number, number>();
    for (const side of [ -1, 1 ]) {
        loops.filter(l => l.side === side).forEach((l, i) => {
            loopX.set(l.e.id, i * 14);
            loopSide.set(l.e.id, side);
        });
    }
    return { fanY, loopX, lane, loopSide };
}

/**
 * Orthogonal routing in activity and state machine diagrams, preferably top to bottom. The offsets come from
 * `flowOffsets`; `lane` shifts the line to the right of its direction of travel, so flows there and back separate.
 */
function flowGeometry(d: Diagram, e: DiagramEdge, a: DiagramNode, b: DiagramNode, o: FlowOffsets): EdgeGeometry {
    const fanY = o.fanY.get(e.id) ?? 0, loopX = o.loopX.get(e.id) ?? 0, lane = o.lane.get(e.id) ?? 0;
    const [ ax, ay ] = center(a), [ bx, by ] = center(b), ab = a.y + a.h, bt = b.y;
    const my = snap((ab + bt) / 2) + fanY;
    const down = (path: string, s: Vec, t: Vec, td: Vec = [ 0, -1 ]): EdgeGeometry =>
        ({ d: path, lx: s[0] + 8, ly: ab + 16, anc: "start", s, sd: [ 0, 1 ], t, td });

    if (bt >= ab + 16) {
        const x = straightX(a, b);
        if (x !== null) {
            // the lane shift must not push the line off a narrow overlap of the two boxes
            const boxes = [ a, b ].filter(isBoxFlow), lo = Math.max(...boxes.map(n => n.x + 6)), hi = Math.min(...boxes.map(n => n.x + n.w - 6));
            const sx = boxes.length && lo <= hi ? Math.min(Math.max(x - lane, lo), hi) : x - lane;
            // there and back: the label goes outside the pair of lines
            return { ...down(`M${sx} ${ab}V${bt}`, [ sx, ab ], [ sx, bt ]), ...(lane > 0 ? { lx: sx - 8, anc: "end" as const } : {}) };
        }
        if (a.type === "decision" && (bx <= a.x || bx >= a.x + a.w)) {
            // branches leave the diamond at the side (only when the target lies beside it, else the line would cross the diamond)
            const sx = bx > ax ? a.x + a.w : a.x;
            return { d: `M${sx} ${ay}H${bx}V${bt}`, lx: sx + (bx > ax ? 8 : -8), ly: ay - 7, anc: bx > ax ? "start" : "end", s: [ sx, ay ], sd: [ Math.sign(bx - ax), 0 ], t: [ bx, bt ], td: [ 0, -1 ] };
        }
        if (a.type === "bar") {
            // every flow leaves the bar at the point nearest to its target: straight down when the target lies below the
            // bar (after a centered join that is its middle), else at the end of the bar, so it never runs along a partition border
            const sx = Math.min(Math.max(bx, a.x + 6), a.x + a.w - 6);
            return down(sx === bx ? `M${bx} ${ab}V${bt}` : `M${sx} ${ab}V${my}H${bx}V${bt}`, [ sx, ab ], [ bx, bt ]);
        }
        if (b.type === "bar") {
            const tx = Math.min(Math.max(ax, b.x + 6), b.x + b.w - 6);
            return down(tx === ax ? `M${ax} ${ab}V${bt}` : `M${ax} ${ab}V${my}H${tx}V${bt}`, [ ax, ab ], [ tx, bt ]);
        }
        if (b.type === "decision" && (ax <= b.x || ax >= b.x + b.w)) {
            // merge: into the diamond from the side (only when the source lies beside it)
            const tx = bx > ax ? b.x : b.x + b.w;
            return down(`M${ax} ${ab}V${by}H${tx}`, [ ax, ab ], [ tx, by ], [ Math.sign(ax - bx), 0 ]);
        }
        const sx = ax - lane, tx = bx - lane, y = my + (tx > sx ? lane : -lane);
        return { ...down(`M${sx} ${ab}V${y}H${tx}V${bt}`, [ sx, ab ], [ tx, bt ]), lx: tx < sx ? tx + 8 : tx - 8, ly: y - 6, anc: tx < sx ? "start" : "end" };
    }
    const level = straightAt(a, b, 1);
    if (level !== null && (b.x >= a.x + a.w + 16 || a.x >= b.x + b.w + 16)) {
        const r = b.x > a.x, sx = r ? a.x + a.w : a.x, tx = r ? b.x : b.x + b.w, y = level + (r ? lane : -lane);
        return { d: `M${sx} ${y}H${tx}`, lx: (sx + tx) / 2, ly: r && lane > 0 ? y + 16 : y - 7, s: [ sx, y ], sd: [ r ? 1 : -1, 0 ], t: [ tx, y ], td: [ r ? -1 : 1, 0 ] };
    }
    if (b.x >= a.x + a.w + 16 || a.x >= b.x + b.w + 16) {
        const r = b.x > a.x, sx = r ? a.x + a.w : a.x, tx = r ? b.x : b.x + b.w;
        const dy = r ? lane : -lane, mx = snap((sx + tx) / 2) + (by > ay ? -lane : lane);
        return { d: `M${sx} ${ay + dy}H${mx}V${by + dy}H${tx}`, lx: sx + (r ? 8 : -8), ly: ay + dy - 7, anc: r ? "start" : "end", s: [ sx, ay + dy ], sd: [ r ? 1 : -1, 0 ], t: [ tx, by + dy ], td: [ r ? -1 : 1, 0 ] };
    }
    const ux = straightUpX(d, a, b, lane);
    if (ux !== null) {
        const top = b.y + b.h;
        // the label goes on the outer side of the line, away from both shapes (and the labels of the flow between them)
        const outside = ux < (ax + bx) / 2 ? -1 : 1;
        return { d: `M${ux} ${a.y}V${top}`, lx: ux + outside * 8, ly: (a.y + top) / 2 + 4, anc: outside < 0 ? "end" : "start", s: [ ux, a.y ], sd: [ 0, -1 ], t: [ ux, top ], td: [ 0, 1 ] };
    }
    // jump back up (loop): around the side with fewer other lines
    const side = o.loopSide.get(e.id) ?? -1, p = loopPath(a, b, side, loopX);
    return { d: `M${p[0][0]} ${p[0][1]}H${p[1][0]}V${p[2][1]}H${p[3][0]}`, lx: p[0][0] + side * 8, ly: ay - 7, anc: side < 0 ? "end" : "start", s: p[0], sd: [ side, 0 ], t: p[3], td: [ side, 0 ] };
}

/** A connection point in the middle of a side (vertex of a diamond, compass point of a circle) with its outward direction. */
interface Port {
    p: Vec;
    dir: Vec;
}

function ports(n: DiagramNode, toward: Vec): Port[] {
    const [ cx, cy ] = center(n);
    if (n.type === "bar") {
        if (n.w >= n.h) {
            const x = Math.min(Math.max(toward[0], n.x + 6), n.x + n.w - 6);
            return [{ p: [ x, n.y ], dir: [ 0, -1 ] }, { p: [ x, n.y + n.h ], dir: [ 0, 1 ] }];
        }
        const y = Math.min(Math.max(toward[1], n.y + 6), n.y + n.h - 6);
        return [{ p: [ n.x, y ], dir: [ -1, 0 ] }, { p: [ n.x + n.w, y ], dir: [ 1, 0 ] }];
    }
    const sides: Port[] = [{ p: [ cx, n.y ], dir: [ 0, -1 ] }, { p: [ n.x + n.w, cy ], dir: [ 1, 0 ] }, { p: [ cx, n.y + n.h ], dir: [ 0, 1 ] }, { p: [ n.x, cy ], dir: [ -1, 0 ] }];
    if (!isBoxFlow(n)) return sides;
    // boxes also offer points 20 px beside the middle of each side, for several lines on one side (clear of the rounded corners of a state)
    return sides.flatMap(s => [ s, ...[ -20, 20 ].filter(off => Math.abs(off) < (s.dir[0] ? n.h : n.w) / 2 - 15)
        .map((off): Port => ({ p: s.dir[0] ? [ s.p[0], s.p[1] + off ] : [ s.p[0] + off, s.p[1] ], dir: s.dir })) ]);
}

/** Orthogonal paths from port `s` to port `t` with at most two bends: straight, L, Z or U shaped. */
function connect(s: Port, t: Port): Vec[][] {
    const [ sx, sy ] = s.p, [ tx, ty ] = t.p, margin = 16;
    const ahead = (q: Port, [ x, y ]: Vec): number => (x - q.p[0]) * q.dir[0] + (y - q.p[1]) * q.dir[1];
    const sH = s.dir[0] !== 0, tH = t.dir[0] !== 0;
    if (sH !== tH) {
        const corner: Vec = sH ? [ tx, sy ] : [ sx, ty ];
        return ahead(s, corner) >= margin && ahead(t, corner) >= margin ? [[ s.p, corner, t.p ]] : [];
    }
    if (s.dir[0] === -t.dir[0] && s.dir[1] === -t.dir[1]) {
        if (ahead(s, t.p) < 2 * margin) return [];
        if (sH ? Math.abs(sy - ty) < 1 : Math.abs(sx - tx) < 1) return [[ s.p, t.p ]];
        if (sH) {
            const mx = snap((sx + tx) / 2);
            return [[ s.p, [ mx, sy ], [ mx, ty ], t.p ]];
        }
        const my = snap((sy + ty) / 2);
        return [[ s.p, [ sx, my ], [ tx, my ], t.p ]];
    }
    return [ 40, 70, 100, 140 ].map((off): Vec[] => {
        if (sH) {
            const x = s.dir[0] > 0 ? Math.max(sx, tx) + off : Math.min(sx, tx) - off;
            return [ s.p, [ x, sy ], [ x, ty ], t.p ];
        }
        const y = s.dir[1] > 0 ? Math.max(sy, ty) + off : Math.min(sy, ty) - off;
        return [ s.p, [ sx, y ], [ tx, y ], t.p ];
    });
}

/** Geometry of an orthogonal polyline; the label sits beside its longest part. */
function polyGeometry(points: Vec[]): EdgeGeometry {
    const length = (i: number): number => Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    let k = 1;
    for (let i = 2; i < points.length; i++) if (length(i) > length(k)) k = i;
    const p = points[k - 1], q = points[k], vertical = Math.abs(q[1] - p[1]) > Math.abs(q[0] - p[0]);
    const unit = (u: Vec, v: Vec): Vec => [ Math.sign(v[0] - u[0]), Math.sign(v[1] - u[1]) ];
    const last = points.length - 1;
    return {
        d: points.map((v, i) => `${i ? "L" : "M"}${v[0]} ${v[1]}`).join(""),
        lx: vertical ? p[0] + 8 : (p[0] + q[0]) / 2, ly: vertical ? (p[1] + q[1]) / 2 + 4 : p[1] - 7, anc: vertical ? "start" : "middle",
        s: points[0], sd: unit(points[0], points[1]), t: points[last], td: unit(points[last], points[last - 1]),
    };
}

/** Other ways from `a` to `b` over the side points, shortest and with the fewest bends first. */
function flowAlternatives(a: DiagramNode, b: DiagramNode): EdgeGeometry[] {
    const options: { points: Vec[]; cost: number }[] = [];
    for (const s of ports(a, center(b))) {
        for (const t of ports(b, center(a))) {
            for (const points of connect(s, t)) {
                let length = 0;
                for (let k = 1; k < points.length; k++) length += Math.abs(points[k][0] - points[k - 1][0]) + Math.abs(points[k][1] - points[k - 1][1]);
                options.push({ points, cost: length + 30 * (points.length - 2) });
            }
        }
    }
    return options.sort((p, q) => p.cost - q.cost).map(o => polyGeometry(o.points));
}

/** Loops around everything that lies between `a` and `b`, on the left and on the right: the last resort when every other path hits a shape. */
function wideLoops(d: Diagram, a: DiagramNode, b: DiagramNode): EdgeGeometry[] {
    const ay = center(a)[1], by = center(b)[1], lo = Math.min(ay, by), hi = Math.max(ay, by);
    const between = [ a, b, ...obstacles(d, a, b).filter(n => n.y < hi && n.y + n.h > lo) ];
    const left = snap(Math.min(...between.map(n => n.x)) - 40), right = snap(Math.max(...between.map(n => n.x + n.w)) + 40);
    return [
        polyGeometry([[ a.x, ay ], [ left, ay ], [ left, by ], [ b.x, by ]]),
        polyGeometry([[ a.x + a.w, ay ], [ right, ay ], [ right, by ], [ b.x + b.w, by ]]),
    ];
}

const containsBox = (box: DiagramNode, n: DiagramNode): boolean => n.x >= box.x && n.y >= box.y && n.x + n.w <= box.x + box.w && n.y + n.h <= box.y + box.h;

/** Lines closer than this run "on top of each other" (parallel flows keep 12 px or more). */
export const LINE_GAP = 11;

/** Length along which two polylines run parallel closer than `gap` px (3 = on top of each other). */
export function overlapLength(p: Vec[], q: Vec[], gap = 3): number {
    let total = 0;
    for (let i = 1; i < p.length; i++) {
        for (let j = 1; j < q.length; j++) {
            const a = p[i - 1], b = p[i], c = q[j - 1], e = q[j];
            const ux = b[0] - a[0], uy = b[1] - a[1], len = Math.hypot(ux, uy), vx = e[0] - c[0], vy = e[1] - c[1], len2 = Math.hypot(vx, vy);
            if (len < 1 || len2 < 1 || Math.abs(ux * vy - uy * vx) / (len * len2) > 0.02) continue;
            if (Math.abs((c[0] - a[0]) * uy - (c[1] - a[1]) * ux) / len > gap) continue;
            const t1 = ((c[0] - a[0]) * ux + (c[1] - a[1]) * uy) / len, t2 = ((e[0] - a[0]) * ux + (e[1] - a[1]) * uy) / len;
            total += Math.max(0, Math.min(len, Math.max(t1, t2)) - Math.max(0, Math.min(t1, t2)));
        }
    }
    return total;
}

/** Whether the polyline runs through the inside of `n` (beyond the points where it docks). */
function crossesOwn(n: DiagramNode, points: Vec[]): boolean {
    const [ cx, cy ] = center(n);
    for (let k = 1; k < points.length; k++) {
        const p = points[k - 1], q = points[k];
        for (let f = 0.1; f < 0.95; f += 0.1) {
            if (insideOutline(outline(n), cx, cy, n.w / 2 - 3, n.h / 2 - 3, p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f)) return true;
        }
    }
    return false;
}

/** Number of proper crossings between two polylines. */
function crossCount(p: Vec[], q: Vec[]): number {
    let n = 0;
    for (let i = 1; i < p.length; i++) for (let j = 1; j < q.length; j++) if (segmentsCross(p[i - 1], p[i], q[j - 1], q[j])) n++;
    return n;
}

/** Length of an orthogonal polyline plus 30 per bend. */
function pathCost(points: Vec[]): number {
    let length = 0;
    for (let k = 1; k < points.length; k++) length += Math.abs(points[k][0] - points[k - 1][0]) + Math.abs(points[k][1] - points[k - 1][1]);
    return length + 30 * Math.max(0, points.length - 2);
}

/**
 * Chooses the path of every flow in id order: the usual path when it stays clear of other shapes and does not lie
 * on a flow chosen before, else the first alternative over the side ports that does.
 */
function routeFlows(d: Diagram, o: FlowOffsets): Map<number, EdgeGeometry> {
    const byId = new Map(d.nodes.map(n => [ n.id, n ])), out = new Map<number, EdgeGeometry>(), taken: Vec[][] = [];
    const careful = d.nodes.length <= 400;
    for (const e of [ ...d.edges ].sort((p, q) => p.id - q.id)) {
        const a = byId.get(e.from), b = byId.get(e.to);
        if ((e.kind ?? "flow") !== "flow" || !a || !b || a === b || !FLOW_TYPES.has(a.type) || !FLOW_TYPES.has(b.type)) continue;
        const usual = flowGeometry(d, e, a, b, o);
        let pick = usual;
        if (careful) {
            const clear = (g: EdgeGeometry): boolean => isClear(d, a, b, pathPoints(g.d));
            // a path through its own start or end node reads as a different transition; a composite state may be crossed by the lines of its content
            const own = (g: EdgeGeometry): boolean => [ a, b ].some(n => !containsBox(n, n === a ? b : a) && crossesOwn(n, pathPoints(g.d)));
            const crowding = (g: EdgeGeometry): number => taken.reduce((sum, t) => sum + overlapLength(pathPoints(g.d), t, LINE_GAP), 0);
            const crossings = (g: EdgeGeometry): number => taken.reduce((sum, t) => sum + crossCount(pathPoints(g.d), t), 0);
            if (!clear(usual) || own(usual) || crowding(usual) > 6 || crossings(usual) > 0) {
                const known = [ usual, ...flowAlternatives(a, b) ];
                const options = (known.some(clear) ? known : [ ...known, ...wideLoops(d, a, b) ]).filter(g => !own(g));
                // clear of other shapes first, then without crowding, then with the fewest crossings, then the shortest; a detour must be worth it
                const score = (g: EdgeGeometry): number => (clear(g) ? 0 : 5000) + (crowding(g) > 6 ? 1000 + crowding(g) : 0) + 160 * crossings(g) + pathCost(pathPoints(g.d)) - (g === usual ? 40 : 0);
                pick = options.sort((p, q) => score(p) - score(q))[0] ?? usual;
            }
        }
        out.set(e.id, pick);
        taken.push(pathPoints(pick.d));
    }
    return out;
}

/** Shapes of structure diagrams whose relations are drawn at right angles. */
const STRUCT_TYPES = new Set<NodeType>([ "class", "object", "component", "iface", "port", "package", "node3d", "artifact" ]);
const STRUCT_KINDS = new Set([ "assoc", "dir", "inherit", "realize", "aggr", "comp", "dep", "require", "delegate", "deploy", "manifest", "import", "access", "merge" ]);


/** The natural right-angled path between two boxes: straight when they face each other, else one Z-shaped bend in the middle. */
function structPath(a: DiagramNode, b: DiagramNode): Vec[] | null {
    const x = straightAt(a, b, 0), y = straightAt(a, b, 1);
    if (x !== null && (b.y >= a.y + a.h + 16 || a.y >= b.y + b.h + 16)) return b.y > a.y ? [[ x, a.y + a.h ], [ x, b.y ]] : [[ x, a.y ], [ x, b.y + b.h ]];
    if (y !== null && (b.x >= a.x + a.w + 16 || a.x >= b.x + b.w + 16)) return b.x > a.x ? [[ a.x + a.w, y ], [ b.x, y ]] : [[ a.x, y ], [ b.x + b.w, y ]];
    const [ ax, ay ] = center(a), [ bx, by ] = center(b);
    if (b.y >= a.y + a.h + 30 || a.y >= b.y + b.h + 30) {
        const down = b.y > a.y, sy = down ? a.y + a.h : a.y, ty = down ? b.y : b.y + b.h, my = snap((sy + ty) / 2);
        return [[ ax, sy ], [ ax, my ], [ bx, my ], [ bx, ty ]];
    }
    if (b.x >= a.x + a.w + 30 || a.x >= b.x + b.w + 30) {
        const right = b.x > a.x, sx = right ? a.x + a.w : a.x, tx = right ? b.x : b.x + b.w, mx = snap((sx + tx) / 2);
        return [[ sx, ay ], [ mx, ay ], [ mx, by ], [ tx, by ]];
    }
    return null;
}

/**
 * Chooses a right-angled path for every relation between structure shapes in id order, like `routeFlows`: the natural
 * path when it is clear of other shapes, does not lie on another line and crosses none, else the best side-port
 * alternative. Generalisations to the same parent may share their last part (the usual tree look).
 */
function routeStructure(d: Diagram): Map<number, EdgeGeometry> {
    const out = new Map<number, EdgeGeometry>();
    if (d.nodes.length > 400) return out;
    const byId = new Map(d.nodes.map(n => [ n.id, n ]));
    const taken: { e: DiagramEdge; points: Vec[] }[] = [];
    const pairs = new Map<string, number>();
    for (const e of d.edges) pairs.set(`${Math.min(e.from, e.to)}|${Math.max(e.from, e.to)}`, (pairs.get(`${Math.min(e.from, e.to)}|${Math.max(e.from, e.to)}`) ?? 0) + 1);
    const tree = (e: DiagramEdge): boolean => e.kind === "inherit" || e.kind === "realize";
    for (const e of [ ...d.edges ].sort((p, q) => p.id - q.id)) {
        const a = byId.get(e.from), b = byId.get(e.to);
        if (!a || !b || a === b || !STRUCT_KINDS.has(e.kind ?? "flow") || !STRUCT_TYPES.has(a.type) || !STRUCT_TYPES.has(b.type)) continue;
        if (containsBox(a, b) || containsBox(b, a)) continue;
        const natural = structPath(a, b);
        // the name of an interface stands below the ball, so no line docks there
        const labelFree = (p: Vec[]): boolean => !(a.type === "iface" && p[0][1] >= a.y + a.h - 1) && !(b.type === "iface" && p[p.length - 1][1] >= b.y + b.h - 1);
        const options = [ ...(natural ? [ natural ] : []), ...flowAlternatives(a, b).map(g => pathPoints(g.d)) ]
            .filter(p => labelFree(p) && !crossesOwn(a, p) && !crossesOwn(b, p) && isClear(d, a, b, p));
        if (!options.length) continue;
        const others = (points: Vec[]): { crowd: number; cross: number } => {
            let crowd = 0, cross = 0;
            for (const t of taken) {
                // the shared trunk of a generalisation tree is wanted
                if (tree(e) && tree(t.e) && t.e.to === e.to) continue;
                crowd += overlapLength(points, t.points, LINE_GAP);
                cross += crossCount(points, t.points);
            }
            return { crowd, cross };
        };
        const score = (p: Vec[]): number => {
            const o = others(p);
            return (o.crowd > 6 ? 1000 + o.crowd : 0) + 160 * o.cross + pathCost(p) - (p === natural ? 40 : 0);
        };
        const best = options.sort((p, q) => score(p) - score(q))[0];
        // several relations between the same two shapes are spread by `parallelGeometry` unless one path is clear of the others
        if ((pairs.get(`${Math.min(e.from, e.to)}|${Math.max(e.from, e.to)}`) ?? 0) > 1 && others(best).crowd > 6) continue;
        out.set(e.id, polyGeometry(best));
        taken.push({ e, points: best });
    }
    return out;
}

/**
 * Transition or association of a node to itself: a small loop around a corner that is free of other shapes and
 * lines (top right, bottom right, bottom left, top left), further loops take the next free corner, then the next ring.
 */
function selfGeometry(d: Diagram, e: DiagramEdge, a: DiagramNode, ctx: RouteContext): EdgeGeometry {
    const loop = (corner: number, size: number): EdgeGeometry => {
        const right = corner < 2, top = corner === 0 || corner === 3, dx = right ? 1 : -1, dy = top ? -1 : 1;
        const ex = right ? a.x + a.w : a.x, ey = top ? a.y : a.y + a.h;
        const sx = ex - dx * Math.min(24, a.w / 4), ty = ey - dy * Math.min(16, a.h / 3), ox = ex + dx * size, oy = ey + dy * size;
        return {
            d: `M${sx} ${ey}V${oy}H${ox}V${ty}H${ex}`, lx: ox + dx * 6, ly: (oy + ty) / 2 + 4, anc: right ? "start" : "end",
            s: [ sx, ey ], sd: [ 0, dy ], t: [ ex, ty ], td: [ dx, 0 ],
        };
    };
    const own = d.edges.filter(x => x.from === a.id && x.to === a.id), i = Math.max(0, own.indexOf(e));
    const byId = new Map(d.nodes.map(n => [ n.id, n ]));
    // all other lines, including the loops of other nodes placed before this one
    const lines = d.edges.filter(x => (x.from !== x.to || (x.from !== a.id && x.id < e.id)) && byId.has(x.from) && byId.has(x.to))
        .map(x => pathPoints(edgeGeometry(d, x, byId.get(x.from)!, byId.get(x.to)!, ctx).d));
    const crossings = (points: Vec[]): number => lines.reduce((sum, l) => {
        let n = 0;
        for (let k = 1; k < points.length; k++) for (let j = 1; j < l.length; j++) if (segmentsCross(points[k - 1], points[k], l[j - 1], l[j])) n++;
        return sum + n;
    }, 0);
    const free = [ 0, 1, 2, 3 ].filter(c => {
        const points = pathPoints(loop(c, 28).d), ends = [ points[0], points[points.length - 1] ];
        return isClear(d, a, a, points) && lines.every(l => overlapLength(points, l, LINE_GAP) < 2
            && ![ l[0], l[l.length - 1] ].some(p => ends.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < 14)));
    });
    // corners without crossing lines first, in their usual order
    free.sort((p, q) => crossings(pathPoints(loop(p, 28).d)) - crossings(pathPoints(loop(q, 28).d)) || p - q);
    const corners = free.length ? free : [ 0, 1, 2, 3 ];
    return loop(corners[i % corners.length], 28 + 16 * Math.floor(i / corners.length));
}

/**
 * Network diagram arrow from the right side of `a` to the left side of `b` with right angles: over the shared rail
 * when that stays clear of other activities, else over the first free gap between the columns, else along a free
 * corridor between the rows (an arrow skipping a column must not run through an activity of that column).
 */
function elbowGeometry(d: Diagram, a: DiagramNode, b: DiagramNode, rail: number | undefined): EdgeGeometry {
    const sx = a.x + a.w, sy = a.y + a.h / 2, tx = b.x, ty = b.y + b.h / 2;
    const geometry = (points: Vec[]): EdgeGeometry => {
        const last = points[points.length - 2];
        return {
            d: points.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(""), lx: (last[0] + tx) / 2, ly: ty - 8,
            s: [ sx, sy ], sd: [ 1, 0 ], t: [ tx, ty ], td: [ -1, 0 ],
        };
    };
    const flat = Math.abs(sy - ty) < 1;
    const usual: Vec[] = flat ? [[ sx, sy ], [ tx, ty ]] : [[ sx, sy ], [ rail ?? snap((sx + tx) / 2), sy ], [ rail ?? snap((sx + tx) / 2), ty ], [ tx, ty ]];
    if (d.nodes.length > 400 || isClear(d, a, b, usual)) return geometry(usual);
    const others = d.nodes.filter(n => n !== a && n !== b && n.type === "np");
    // x of free vertical gaps between sx and tx, nearest to the target first
    const gaps: number[] = [];
    for (let x = snap(tx - 10); x > sx + 5; x -= 10) if (!others.some(n => x > n.x - 8 && x < n.x + n.w + 8)) gaps.push(x);
    for (const mx of gaps) {
        const points: Vec[] = [[ sx, sy ], [ mx, sy ], [ mx, ty ], [ tx, ty ]];
        if (isClear(d, a, b, points)) return geometry(points);
    }
    // two gaps joined by a horizontal corridor between rows
    const first = gaps.length ? gaps[gaps.length - 1] : snap(sx + 20), last = gaps.length ? gaps[0] : snap(tx - 20);
    const ys = [ ...new Set(others.flatMap(n => [ n.y - 20, n.y + n.h + 20 ]).map(snap)) ].sort((p, q) => Math.abs(p - (sy + ty) / 2) - Math.abs(q - (sy + ty) / 2));
    for (const my of ys) {
        const points: Vec[] = [[ sx, sy ], [ first, sy ], [ first, my ], [ last, my ], [ last, ty ], [ tx, ty ]];
        if (isClear(d, a, b, points)) return geometry(points);
    }
    return geometry(usual);
}

/**
 * Path of an edge. Order of the cases: message (sequence) > self loop > control flow > network diagram elbow >
 * ER line > parallel relations > detour around shapes > straight line.
 * Compute `ctx` with `routeContext()` once per drawing and pass it in.
 */
export function edgeGeometry(d: Diagram, e: DiagramEdge, a: DiagramNode, b: DiagramNode, ctx?: RouteContext): EdgeGeometry {
    const kind = e.kind ?? "flow";
    if (RELATIONS[kind]?.seq && SEQUENCE_TYPES.has(a.type) && SEQUENCE_TYPES.has(b.type)) return messageGeometry(d, e, a, b);
    if (a.id === b.id) return selfGeometry(d, e, a, ctx ?? routeContext(d));
    if (kind === "flow" && FLOW_TYPES.has(a.type) && FLOW_TYPES.has(b.type)) return (ctx ?? routeContext(d)).flows.get(e.id) ?? flowGeometry(d, e, a, b, flowOffsets(d));
    if (kind === "flow" && canElbow(a, b)) return elbowGeometry(d, a, b, (ctx?.rails ?? sharedRails(d)).get(e.id));
    if (kind === "erl") return erGeometry(d, e, a, b);
    const ortho = (ctx ?? routeContext(d)).struct.get(e.id);
    if (ortho) return ortho;
    const bent = parallelGeometry(d, e, a, b) ?? detourGeometry(d, e, a, b);
    if (bent) return bent;
    const [ sx, sy ] = anchorPoint(a, outline(a), b.x + b.w / 2, b.y + b.h / 2);
    const [ tx, ty ] = anchorPoint(b, outline(b), a.x + a.w / 2, a.y + a.h / 2);
    const len = Math.hypot(tx - sx, ty - sy) || 1, ux = (tx - sx) / len, uy = (ty - sy) / len;
    return { d: `M${sx} ${sy}L${tx} ${ty}`, lx: (sx + tx) / 2, ly: (sy + ty) / 2 - 6, s: [ sx, sy ], sd: [ ux, uy ], t: [ tx, ty ], td: [ -ux, -uy ] };
}

/** All numbers of a path made of M/H/V/L commands as points (enough for the paths created in this file). */
export function pathPoints(d: string): Vec[] {
    const points: Vec[] = [];
    let x = 0, y = 0;
    for (const m of d.matchAll(/([MLHV])\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?/g)) {
        const a = Number(m[2]), b = Number(m[3]);
        if (m[1] === "H") x = a;
        else if (m[1] === "V") y = a;
        else [ x, y ] = [ a, b ];
        points.push([ x, y ]);
    }
    return points;
}
