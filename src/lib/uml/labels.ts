import type { Diagram, DiagramEdge, Rect } from "../../types/diagram";
import { boundingBox, type Vec } from "../geometry";
import { diagramBox } from "../diagram";
import { erLabelSpots, type LabelSpot } from "./detour";
import { edgeGeometry, pathPoints, routeContext, type EdgeGeometry, type RouteContext } from "./routing";
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
    const shapes: Box[] = d.nodes.filter(n => !BACKGROUND.has(n.type)).map(n => [ n.x, n.y, n.x + n.w, n.y + n.h ]);
    const placed = new Map<string, LabelPlacement>();

    const blocked = (box: Box, edge: number, key: string, ignoreLines: boolean): boolean => {
        for (const [ k, l ] of placed) if (k !== key && overlap(box, l.box)) return true;
        if (!ignoreLines) {
            for (const s of segments) {
                if (s.edge === edge || Math.max(s.a[0], s.b[0]) < box[0] || Math.min(s.a[0], s.b[0]) > box[2] || Math.max(s.a[1], s.b[1]) < box[1] || Math.min(s.a[1], s.b[1]) > box[3]) continue;
                for (let k = 0; k <= 24; k++) {
                    const x = s.a[0] + (s.b[0] - s.a[0]) * k / 24, y = s.a[1] + (s.b[1] - s.a[1]) * k / 24;
                    if (x > box[0] && x < box[2] && y > box[1] && y < box[3]) return true;
                }
            }
        }
        return shapes.some(n => box[0] < n[2] - 2 && n[0] + 2 < box[2] && box[1] < n[3] - 2 && n[1] + 2 < box[3]);
    };
    /** First spot that is free, else the first one free of shapes and labels, else `fallback`. */
    const place = (key: string, edge: number, width: number, spots: LabelSpot[], relaxed: LabelSpot[], fallback: LabelSpot): void => {
        const pick = spots.find(c => !blocked(boxOf(c, width), edge, key, false))
            ?? relaxed.find(c => !blocked(boxOf(c, width), edge, key, true))
            ?? fallback;
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
                    const over: LabelSpot[] = [{ x, y: y - 7, a: "middle" }, { x, y: y + 16, a: "middle" }];
                    return sideFirst ? (at.vertical ? beside : over) : [ ...over, ...beside ];
                });
                place(labelKey(e, "label"), e.id, text.length * 7.4 + 6,
                    [ spot, ...nearby([ 0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78, 0.15, 0.85, 0.1, 0.9 ], true) ],
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
