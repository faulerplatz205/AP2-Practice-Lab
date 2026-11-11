import type { Diagram, DiagramEdge, DiagramNode } from "../../types/diagram";
import { anchorPoint, center, insideOutline, segmentTouches, type Vec } from "../geometry";
import { outline } from "./outline";
import { RELATIONS, isErRelationship } from "./types";

/** Path of an edge and where its labels go. */
export interface EdgeGeometry {
    /** SVG path */
    d: string;
    /** Position of the label */
    lx: number;
    ly: number;
    anc?: "start" | "end" | "middle";
    /** Start and end point with direction (for multiplicities) */
    s: Vec;
    sd: Vec;
    t: Vec;
    td: Vec;
}

/** Containers and sequence lines that lines may cross. */
const PASSABLE = new Set([ "boundary", "lane", "fragment", "lifeline", "actline", "activation" ]);

/** Packages and deployment nodes: lines may only enter them to reach (or leave) something inside. */
const CONTAINER = new Set([ "package", "node3d", "compstate" ]);

const within = (n: DiagramNode, box: DiagramNode): boolean => n.x >= box.x && n.y >= box.y && n.x + n.w <= box.x + box.w && n.y + n.h <= box.y + box.h;

export function obstacles(d: Diagram, a: DiagramNode, b: DiagramNode): DiagramNode[] {
    return d.nodes.filter(n => n !== a && n !== b && !PASSABLE.has(n.type) && !(CONTAINER.has(n.type) && (within(a, n) || within(b, n) || within(n, a) || within(n, b))));
}

function hitsNode(n: DiagramNode, p: Vec, q: Vec): boolean {
    if (n.x - 6 > Math.max(p[0], q[0]) || n.x + n.w + 6 < Math.min(p[0], q[0]) || n.y - 6 > Math.max(p[1], q[1]) || n.y + n.h + 6 < Math.min(p[1], q[1])) return false;
    const [ cx, cy ] = center(n), shape = outline(n);
    return segmentTouches(p, q, (x, y) => insideOutline(shape, cx, cy, n.w / 2 + 4, n.h / 2 + 4, x, y));
}

function insideNode(n: DiagramNode, [ x, y ]: Vec): boolean {
    const [ cx, cy ] = center(n);
    return insideOutline(outline(n), cx, cy, n.w / 2 + 4, n.h / 2 + 4, x, y);
}

/** Whether the polyline `points` between `a` and `b` stays clear of all other shapes. */
export function isClear(d: Diagram, a: DiagramNode, b: DiagramNode, points: Vec[]): boolean {
    const others = obstacles(d, a, b);
    for (let k = 1; k < points.length; k++) if (others.some(n => hitsNode(n, points[k - 1], points[k]))) return false;
    return true;
}

const dock = (n: DiagramNode, toward: Vec): Vec => anchorPoint(n, outline(n), toward[0], toward[1]);

export function direction(from: Vec, to: Vec): Vec {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    return [ (to[0] - from[0]) / len, (to[1] - from[1]) / len ];
}

/** Polyline from `a` over the `waypoints` to `b`, docked at both outlines. */
export function viaGeometry(a: DiagramNode, b: DiagramNode, waypoints: Vec[]): EdgeGeometry {
    const s = dock(a, waypoints[0]), t = dock(b, waypoints[waypoints.length - 1]);
    const points = [ s, ...waypoints, t ];
    const mid = waypoints[Math.floor((waypoints.length - 1) / 2)];
    return {
        d: points.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(""),
        lx: waypoints.length > 1 ? (waypoints[0][0] + waypoints[1][0]) / 2 : mid[0],
        ly: (waypoints.length > 1 ? (waypoints[0][1] + waypoints[1][1]) / 2 : mid[1]) - 8,
        s, sd: direction(s, waypoints[0]), t, td: direction(t, waypoints[waypoints.length - 1]),
    };
}

/** Midpoint and unit normal of a–b; the normal depends on the id order so lines in both directions fan out alike. */
function normal(a: DiagramNode, b: DiagramNode): { mid: Vec; n: Vec; len: number } {
    const ca = center(a), cb = center(b), lo = a.id < b.id ? ca : cb, hi = a.id < b.id ? cb : ca;
    const len = Math.hypot(hi[0] - lo[0], hi[1] - lo[1]) || 1;
    return { mid: [ (ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2 ], n: [ -(hi[1] - lo[1]) / len, (hi[0] - lo[0]) / len ], len };
}

const between = (e: DiagramEdge, x: DiagramEdge): boolean => (x.from === e.from && x.to === e.to) || (x.from === e.to && x.to === e.from);

/** Waypoint bent away from the straight line by `index` steps (0 = middle line), the first one that stays clear. */
function bend(d: Diagram, a: DiagramNode, b: DiagramNode, index: number, step: number, factors: number[], fallback: boolean): Vec | null {
    const { mid, n } = normal(a, b);
    let first: Vec | null = null;
    for (const f of factors) {
        const off = Math.sign(index) * Math.max(32, Math.abs(index) * step) * f, v: Vec = [ mid[0] + n[0] * off, mid[1] + n[1] * off ];
        first ??= v;
        if (isClear(d, a, b, [ dock(a, v), v, dock(b, v) ])) return v;
    }
    return fallback ? first : null;
}

/** Where the ray from `p` (inside `n`) in direction `u` leaves the outline of `n`. */
function exitPoint(n: DiagramNode, p: Vec, u: Vec): Vec {
    const [ cx, cy ] = center(n), shape = outline(n);
    let lo = 0, hi = n.w + n.h;
    for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2;
        if (insideOutline(shape, cx, cy, n.w / 2, n.h / 2, p[0] + u[0] * mid, p[1] + u[1] * mid)) lo = mid;
        else hi = mid;
    }
    return [ p[0] + u[0] * lo, p[1] + u[1] * lo ];
}

/** Straight line between `a` and `b`, moved sideways by `off`; null when it would miss a shape, be too short or hit another shape. */
function offsetStraight(d: Diagram, a: DiagramNode, b: DiagramNode, off: number): EdgeGeometry | null {
    const { n } = normal(a, b), ca = center(a), cb = center(b);
    const pa: Vec = [ ca[0] + n[0] * off, ca[1] + n[1] * off ], pb: Vec = [ cb[0] + n[0] * off, cb[1] + n[1] * off ];
    const fits = (m: DiagramNode, p: Vec): boolean => insideOutline(outline(m), ...center(m), m.w / 2 - 6, m.h / 2 - 6, p[0], p[1]);
    if (!fits(a, pa) || !fits(b, pb)) return null;
    const u = direction(pa, pb), s = exitPoint(a, pa, u), t = exitPoint(b, pb, [ -u[0], -u[1] ]);
    if (Math.hypot(t[0] - s[0], t[1] - s[1]) < 16 || (t[0] - s[0]) * u[0] + (t[1] - s[1]) * u[1] <= 0 || !isClear(d, a, b, [ s, t ])) return null;
    return { d: `M${s[0]} ${s[1]}L${t[0]} ${t[1]}`, lx: (s[0] + t[0]) / 2, ly: (s[1] + t[1]) / 2 - 7, s, sd: u, t, td: [ -u[0], -u[1] ] };
}

/**
 * Several relations between the same two nodes do not lie on top of each other: parallel straight lines when the
 * shapes face each other widely enough, else lines bent away from the middle.
 */
export function parallelGeometry(d: Diagram, e: DiagramEdge, a: DiagramNode, b: DiagramNode): EdgeGeometry | null {
    const kind = e.kind ?? "flow";
    if (kind === "erl" || RELATIONS[kind]?.seq) return null;
    const same = d.edges.filter(x => x.from !== x.to && (x.kind ?? "flow") !== "erl" && !RELATIONS[x.kind ?? "flow"]?.seq && between(e, x));
    if (same.length < 2) return null;
    const index = same.indexOf(e) - (same.length - 1) / 2;
    const straight = same.every((_, k) => offsetStraight(d, a, b, (k - (same.length - 1) / 2) * 26));
    if (straight) return offsetStraight(d, a, b, index * 26);
    if (Math.abs(index) < 0.01) return null;
    const v = bend(d, a, b, index, Math.min(60, Math.max(34, normal(a, b).len * 0.25)), [ 1, 1.5, 2.2, 3, 4 ], false);
    if (!v) return null;
    return { ...viaGeometry(a, b, [ v ]), lx: v[0], ly: v[1] - 7 };
}

/** Route stored by "tidy up"; only valid while both nodes keep position and size and the way stays clear. */
export function routeKey(a: DiagramNode, b: DiagramNode): string {
    return `${a.x},${a.y},${a.w},${a.h}|${b.x},${b.y},${b.w},${b.h}`;
}

export function storedRoute(d: Diagram, e: DiagramEdge, a: DiagramNode, b: DiagramNode): Vec[] | null {
    const r = e.route;
    if (!r || r.key !== routeKey(a, b) || !Array.isArray(r.ws) || !r.ws.length) return null;
    return isClear(d, a, b, [ dock(a, r.ws[0]), ...r.ws, dock(b, r.ws[r.ws.length - 1]) ]) ? r.ws : null;
}

/** A straight line that runs through other shapes is bent around them over one or two waypoints. */
export function detourGeometry(d: Diagram, e: DiagramEdge, a: DiagramNode, b: DiagramNode): EdgeGeometry | null {
    const ws = detourWaypoints(d, e, a, b);
    return ws ? viaGeometry(a, b, ws) : null;
}

function detourWaypoints(d: Diagram, e: DiagramEdge, a: DiagramNode, b: DiagramNode): Vec[] | null {
    if (d.nodes.length > 1500) return null;
    const others = obstacles(d, a, b);
    const ca = center(a), cb = center(b);
    const hits = (p: Vec, q: Vec): boolean => others.some(n => hitsNode(n, p, q));
    const stored = storedRoute(d, e, a, b);
    if (!stored && !hits(dock(a, cb), dock(b, ca))) return null;

    const len = Math.hypot(cb[0] - ca[0], cb[1] - ca[1]) || 1, nx = -(cb[1] - ca[1]) / len, ny = (cb[0] - ca[0]) / len;
    const at = (f: number, off: number): Vec => [ ca[0] + (cb[0] - ca[0]) * f + nx * off, ca[1] + (cb[1] - ca[1]) * f + ny * off ];
    const candidates: Vec[][] = stored ? [ stored ] : [];
    for (const f of [ 0.5, 0.3, 0.7 ]) for (const off of [ 50, 90, 140, 200, 280, 380, 520 ]) candidates.push([ at(f, off) ], [ at(f, -off) ]);
    candidates.push([[ cb[0], ca[1] ]], [[ ca[0], cb[1] ]]);
    for (const off of [ 60, 110, 170, 250, 350, 480, 650 ]) candidates.push([ at(0.2, off), at(0.8, off) ], [ at(0.2, -off), at(0.8, -off) ]);

    // parallel relations between the same nodes take the next free detour each
    let skip = Math.max(0, d.edges.filter(x => (x.kind ?? "flow") !== "erl" && between(e, x)).indexOf(e));
    for (const [ i, ws ] of candidates.entries()) {
        if (ws.some(w => others.some(n => insideNode(n, w)))) continue;
        const points = [ dock(a, ws[0]), ...ws, dock(b, ws[ws.length - 1]) ];
        if (points.slice(1).some((p, k) => hits(points[k], p))) continue;
        if (skip > 0 && i > 0) {
            skip--;
            continue;
        }
        return ws;
    }
    return null;
}

/** ER line: fans out when an entity takes part twice, otherwise straight or around shapes in the way. */
export function erGeometry(d: Diagram, e: DiagramEdge, a: DiagramNode, b: DiagramNode): EdgeGeometry {
    const same = d.edges.filter(x => (x.kind ?? "flow") === "erl" && between(e, x));
    let ws: Vec[];
    if (same.length > 1) {
        const index = same.indexOf(e) - (same.length - 1) / 2;
        ws = [ bend(d, a, b, index, Math.min(70, Math.max(40, normal(a, b).len * 0.4)), [ 1, 1.4, 1.9, 2.5, 3.2, 4 ], true)! ];
    } else {
        ws = storedRoute(d, e, a, b) ?? detourWaypoints(d, e, a, b) ?? [];
    }
    const s = dock(a, ws[0] ?? center(b)), t = dock(b, ws[ws.length - 1] ?? center(a));
    const points = [ s, ...ws, t ];
    const label = erLabelSpots(points, isErRelationship(a.type), isErRelationship(b.type))[0];
    return {
        d: points.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(""),
        lx: label.x, ly: label.y, anc: label.a,
        s, sd: direction(s, points[1]), t, td: direction(t, points[points.length - 2]),
    };
}

export interface LabelSpot {
    x: number;
    y: number;
    a: "start" | "middle" | "end";
}

/**
 * Places for the cardinality of an ER line, best first: next to the line near the entity, as in
 * IHK solutions (`Kunde 1 ◇ n Bestellung`), at growing distances, on either side.
 * `fromIsRel`/`toIsRel` say which end is the relationship; the other end is the entity.
 */
export function erLabelSpots(points: Vec[], fromIsRel: boolean, toIsRel: boolean): LabelSpot[] {
    const end = toIsRel && !fromIsRel ? "from" : fromIsRel && !toIsRel ? "to" : null;
    const p = end === "to" ? points[points.length - 1] : end === "from" ? points[0] : points.length > 2 ? points[1] : [ (points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2 ] as Vec;
    const q = end === "to" ? points[points.length - 2] : end === "from" ? points[1] : p;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const vertical = Math.abs(q[1] - p[1]) > Math.abs(q[0] - p[0]) * 1.2;
    const spot = (distance: number, first: boolean): LabelSpot => {
        const t = end ? Math.min(len - 6, distance) : 0;
        const [ x, y ] = len > 0 ? [ p[0] + (q[0] - p[0]) / len * t, p[1] + (q[1] - p[1]) / len * t ] : p;
        return vertical ? { x: first ? x + 8 : x - 8, y: y + 4, a: first ? "start" : "end" } : { x, y: first ? y - 7 : y + 16, a: "middle" };
    };
    const distances = [ Math.min(len / 2, 30), Math.min(len * 0.4, 48), 18, Math.min(len * 0.5, 70), Math.min(len * 0.65, 95) ];
    return distances.flatMap(dist => [ spot(dist, true), spot(dist, false) ]);
}
