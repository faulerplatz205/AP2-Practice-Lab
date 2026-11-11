import type { Diagram, DiagramEdge, Rect } from "../../types/diagram";
import { boundingBox, type Vec } from "../geometry";
import { diagramBox } from "../diagram";
import { erLabelSpots, type LabelSpot } from "./detour";
import { edgeGeometry, pathPoints, routeContext, type EdgeGeometry, type RouteContext } from "./routing";
import { headHeight, isLifeline } from "./sequence";
import { RELATIONS } from "./types";

/** [left, top, right, bottom] */
type Box = [number, number, number, number];

export interface LabelPlacement extends LabelSpot {
    box: Box;
}

/** Keys of `placeLabels()`: the label of an edge and its two multiplicities. */
export const labelKey = (e: DiagramEdge, part: "label" | "m1" | "m2"): string => `${part}:${e.id}`;

/** Text of the edge label: stereotype tag and label. */
export function edgeLabel(e: DiagramEdge): string {
    return [ RELATIONS[e.kind ?? "flow"]?.tag, e.label ].filter(Boolean).join(" ");
}

/** Fractions of the line length tried for a label when the usual spots are taken: from the middle outwards. */
const FINE = [ 0.5, 0.45, 0.55, 0.35, 0.65, 0.25, 0.75, 0.2, 0.8, 0.12, 0.88, 0.06, 0.94 ];

/** Containers do not block labels. */
const BACKGROUND = new Set([ "boundary", "lane", "fragment", "package", "node3d" ]);

interface Segment {
    edge: number;
    a: Vec;
    b: Vec;
}

function boxOf(c: LabelSpot, width: number): Box {
    const x = c.a === "start" ? c.x : c.a === "end" ? c.x - width : c.x - width / 2;
    return [ x - 2, c.y - 12, x + width + 2, c.y + 3 ];
}

const overlap = (p: Box, q: Box): boolean => p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3];

/** Length of the part of the segment that runs through the inside of the box, 0 when it stays outside (Liang-Barsky clipping). */
function crosses(s: Segment, box: Box): number {
    const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1];
    let t0 = 0, t1 = 1;
    for (const [ p, q ] of [[ -dx, s.a[0] - box[0] ], [ dx, box[2] - s.a[0] ], [ -dy, s.a[1] - box[1] ], [ dy, box[3] - s.a[1] ]]) {
        if (p === 0) {
            if (q <= 0) return 0;
            continue;
        }
        const r = q / p;
        if (p < 0) t0 = Math.max(t0, r);
        else t1 = Math.min(t1, r);
    }
    return t0 < t1 ? (t1 - t0) * Math.hypot(dx, dy) : 0;
}

/** Point at fraction `f` of the polyline length and whether that part runs vertically. */
function along(points: Vec[], f: number): { p: Vec; vertical: boolean } | null {
    const lengths = points.slice(1).map((p, k) => Math.hypot(p[0] - points[k][0], p[1] - points[k][1]));
    const total = lengths.reduce((s, l) => s + l, 0);
    if (!total) return null;
    let rest = total * f, k = 0;
    for (; k < lengths.length - 1 && rest > lengths[k]; k++) rest -= lengths[k];
    const a = points[k], b = points[k + 1], t = rest / (lengths[k] || 1);
    return { p: [ a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t ], vertical: Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]) };
}

/**
 * Positions of all edge labels, ER cardinalities and multiplicities, so they do not cover lines, shapes or each
 * other. Labels are placed in edge order; earlier ones win. Compute once per drawing.
 */
export function placeLabels(d: Diagram, ctx: RouteContext = routeContext(d)): Map<string, LabelPlacement> {
    const byId = new Map(d.nodes.map(n => [ n.id, n ]));
    const geometry = new Map<number, EdgeGeometry>(), segments: Segment[] = [];
    for (const e of d.edges) {
        const a = byId.get(e.from), b = byId.get(e.to);
        if (!a || !b) continue;
        const g = edgeGeometry(d, e, a, b, ctx), points = pathPoints(g.d);
        geometry.set(e.id, g);
        for (let k = 1; k < points.length; k++) segments.push({ edge: e.id, a: points[k - 1], b: points[k] });
    }
    // of a lifeline only the head is in the way; message labels sit between the dashed lines
    const shapes: Box[] = d.nodes.filter(n => !BACKGROUND.has(n.type))
        .map(n => [ n.x, n.y, n.x + n.w, n.y + (isLifeline(n) ? headHeight(n) : n.h) ]);
    // a label may sit inside a package or node, but not on its border
    for (const n of d.nodes.filter(x => x.type === "package" || x.type === "node3d" || x.type === "compstate")) {
        shapes.push([ n.x - 3, n.y, n.x + 3, n.y + n.h ], [ n.x + n.w - 3, n.y, n.x + n.w + 3, n.y + n.h ], [ n.x, n.y - 3, n.x + n.w, n.y + 3 ], [ n.x, n.y + n.h - 3, n.x + n.w, n.y + n.h + 3 ]);
    }
    const placed = new Map<string, LabelPlacement>();

    /** Whether the box lies on a shape or on a label placed before. */
    const covered = (box: Box, key: string): boolean => {
        for (const [ k, l ] of placed) if (k !== key && overlap(box, l.box)) return true;
        return shapes.some(n => box[0] < n[2] - 2 && n[0] + 2 < box[2] && box[1] < n[3] - 2 && n[1] + 2 < box[3]);
    };
    const blocked = (box: Box, edge: number, key: string): boolean => {
        // labels keep a little distance, so each one clearly belongs to its own line
        const roomy: Box = [ box[0] - 6, box[1] - 6, box[2] + 6, box[3] + 6 ];
        for (const [ k, l ] of placed) if (k !== key && overlap(roomy, l.box)) return true;
        // the own line may touch the edge of the text, but not run through it
        const inner: Box = [ box[0] + 3, box[1] + 3, box[2] - 3, box[3] - 3 ];
        for (const s of segments) if (crosses(s, s.edge === edge ? inner : box)) return true;
        // descenders and wide letters reach a little beyond the estimated box
        return shapes.some(n => box[0] < n[2] + 2 && n[0] - 2 < box[2] && box[1] < n[3] + 2 && n[1] - 2 < box[3]);
    };
    /**
     * How badly a spot is covered: another label weighs most, then a shape, then every line running through it. A line
     * along the text (struck through) weighs much more than one that only crosses it.
     */
    const penalty = (box: Box, edge: number, key: string): number => {
        let sum = 0;
        for (const [ k, l ] of placed) if (k !== key && overlap(box, l.box)) sum += 300;
        for (const n of shapes) if (box[0] < n[2] - 2 && n[0] + 2 < box[2] && box[1] < n[3] - 2 && n[1] + 2 < box[3]) sum += 150;
        const hit = new Map<number, number>();
        const inner: Box = [ box[0] + 3, box[1] + 3, box[2] - 3, box[3] - 3 ];
        for (const s of segments) {
            const length = crosses(s, s.edge === edge ? inner : box);
            if (length) hit.set(s.edge, Math.max(hit.get(s.edge) ?? 0, length));
        }
        // the own line through the text is as bad as a shape below it
        for (const [ id, length ] of hit) sum += id === edge ? 150 : 10 + Math.min(60, length / 3);
        return sum;
    };
    /** First spot that is free, else the least covered one: of those free of shapes and labels, else of all of them. */
    const place = (key: string, edge: number, width: number, spots: LabelSpot[], relaxed: LabelSpot[], fallback: LabelSpot): void => {
        let pick = spots.find(c => !blocked(boxOf(c, width), edge, key));
        if (!pick) {
            const all = [ fallback, ...spots, ...relaxed ], open = all.filter(c => !covered(boxOf(c, width), key));
            let best = Infinity;
            for (const c of open.length ? open : all) {
                const cost = penalty(boxOf(c, width), edge, key);
                if (cost < best) [ pick, best ] = [ c, cost ];
            }
        }
        pick ??= fallback;
        placed.set(key, { ...pick, box: boxOf(pick, width) });
    };

    for (const e of d.edges) {
        const g = geometry.get(e.id);
        if (!g) continue;
        const text = edgeLabel(e);
        if (text) {
            const spot: LabelSpot = { x: g.lx, y: g.ly, a: g.anc ?? "middle" };
            if ((e.kind ?? "flow") === "erl") {
                const a = byId.get(e.from)!, b = byId.get(e.to)!;
                const spots = a.type === "relship" || b.type === "relship" ? erLabelSpots(pathPoints(g.d), a.type === "relship", b.type === "relship") : [];
                place(labelKey(e, "label"), e.id, text.length * 7.6 + 6, spots, spots.slice(0, 2).concat(spots.slice(4, 8)), spot);
            } else {
                const points = pathPoints(g.d), nearby = (fs: number[], sideFirst: boolean): LabelSpot[] => fs.flatMap(f => {
                    const at = along(points, f);
                    if (!at) return [];
                    const [ x, y ] = at.p;
                    const beside: LabelSpot[] = [{ x: x + 8, y: y + 4, a: "start" }, { x: x - 8, y: y + 4, a: "end" }];
                    const over: LabelSpot[] = [{ x, y: y - 7, a: "middle" }, { x, y: y + 16, a: "middle" }, { x: x + 6, y: y - 7, a: "start" }, { x: x - 6, y: y - 7, a: "end" }];
                    return sideFirst ? (at.vertical ? beside : over) : [ ...over, ...beside ];
                });
                place(labelKey(e, "label"), e.id, text.length * 7.4 + 6,
                    [ spot, ...nearby([ 0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78, 0.15, 0.85, 0.1, 0.9 ], true), ...nearby(FINE, false) ],
                    [ spot, ...nearby([ 0.5, 0.3, 0.7, 0.15, 0.85 ], false) ], spot);
            }
        }
        for (const [ part, value, point, dir ] of [[ "m1", e.m1, g.s, g.sd ], [ "m2", e.m2, g.t, g.td ]] as const) {
            if (!value) continue;
            const spots = multiplicitySpots(point, dir);
            place(labelKey(e, part), e.id, value.length * 7.6 + 6, spots, spots, spots[0]);
        }
    }
    return placed;
}

/** Next to the line end: above or below a horizontal line, beside a vertical one, at growing distances. */
function multiplicitySpots(p: Vec, dir: Vec): LabelSpot[] {
    const horizontal = Math.abs(dir[0]) >= Math.abs(dir[1]);
    return [ 10, 22, 36 ].flatMap(dist => {
        const x = p[0] + dir[0] * dist, y = p[1] + dir[1] * dist;
        if (horizontal) {
            const a = dir[0] > 0 ? "start" : "end";
            const below: LabelSpot = { x, y: y + 16, a }, above: LabelSpot = { x, y: y - 6, a };
            return dir[1] < -0.05 ? [ above, below ] : [ below, above ];
        }
        const y2 = y + (dir[1] > 0 ? 12 : -4);
        return [{ x: x + 8, y: y2, a: "start" }, { x: x - 8, y: y2, a: "end" }] as LabelSpot[];
    });
}

/** Bounding box of the whole drawing: nodes plus edge paths, labels and multiplicities (for image export and "show everything"). */
export function contentBox(d: Diagram): Rect | null {
    const rects: Rect[] = [];
    const base = diagramBox(d);
    if (base) rects.push(base);
    const byId = new Map(d.nodes.map(n => [ n.id, n ]));
    const ctx = routeContext(d);
    for (const e of d.edges) {
        const a = byId.get(e.from), b = byId.get(e.to);
        if (!a || !b) continue;
        for (const [ x, y ] of pathPoints(edgeGeometry(d, e, a, b, ctx).d)) rects.push({ x, y, w: 0, h: 0 });
    }
    for (const { box } of placeLabels(d, ctx).values()) rects.push({ x: box[0], y: box[1], w: box[2] - box[0], h: box[3] - box[1] });
    return boundingBox(rects);
}
