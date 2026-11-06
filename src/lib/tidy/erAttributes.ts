import type { DiagramNode } from "../../types/diagram";
import { segmentTouches, type Vec } from "../geometry";

/** Side of an attribute row around its owner. */
export type Side = "top" | "bottom" | "left" | "right";

/** Line segment relative to the owner's center. `own` lines start at the owner, others only pass by. */
export interface Obstacle {
    own: boolean;
    p: Vec;
    q: Vec;
}

export interface Placed {
    n: DiagramNode;
    /** Center relative to the owner's center */
    x: number;
    y: number;
}

export interface Extent {
    l: number;
    r: number;
    t: number;
    b: number;
}

export interface Row extends Extent {
    placed: Placed[];
}

const GAP = 18, LINE_GAP = 34;

interface Ellipse {
    x: number;
    y: number;
    rx: number;
    ry: number;
}

const ellipse = (n: DiagramNode, [ x, y ]: Vec, pad: number): Ellipse => ({ x, y, rx: n.w / 2 + pad, ry: n.h / 2 + pad });

function crossesEllipse(p: Vec, q: Vec, e: Ellipse): boolean {
    return segmentTouches(p, q, (x, y) => ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 < 1);
}

/**
 * Lays out `list` in a row on one side of `owner`, as close as possible without the connectors crossing other
 * attributes and without attributes sitting on the owner's lines (`obstacles`). Composite attributes (`kids`)
 * get a second row further out. Returns positions relative to the owner's center.
 */
export function attributeRow(owner: DiagramNode, list: DiagramNode[], side: Side, kids: Map<number, DiagramNode[]>, obstacles: Obstacle[] = []): Row | null {
    if (!list.length) return null;
    const horizontal = side === "top" || side === "bottom", sign = side === "top" || side === "left" ? -1 : 1;
    // local frame: [along the row, away from the owner]
    const along = (n: DiagramNode): number => horizontal ? n.w : n.h;
    const across = (n: DiagramNode): number => horizontal ? n.h : n.w;
    const toXY = (a: number, d: number): Vec => horizontal ? [ a, d * sign ] : [ d * sign, a ];
    const toLocal = (v: Vec): Vec => horizontal ? [ v[0], v[1] * sign ] : [ v[1], v[0] * sign ];

    const items = list.map(n => {
        const ks = kids.get(n.id) ?? [];
        const kidsWidth = ks.reduce((s, k) => s + along(k), 0) + GAP * Math.max(0, ks.length - 1);
        return { n, kids: ks, slot: Math.max(along(n), kidsWidth) };
    });
    const lines = obstacles
        .map(o => ({ own: o.own, p: toLocal(o.p), q: toLocal(o.q) }))
        .filter(o => Math.max(o.p[1], o.q[1]) > 0);
    const total = items.reduce((s, it) => s + it.slot, 0) + GAP * (items.length - 1);

    /** Centers along the row at distance `d`, opened up where a line crosses the row. */
    const arrange = (d: number, allLines: boolean): number[] => {
        let x = -total / 2;
        const centers = items.map(it => {
            const c = x + it.slot / 2;
            x += it.slot + GAP;
            return c;
        });
        const splits: number[] = [];
        for (const o of lines) {
            if (!o.own && !allLines) continue;
            const dy = o.q[1] - o.p[1];
            if (Math.abs(dy) < 1e-6) continue;
            const t = (d - o.p[1]) / dy;
            if (t < 0 || t > 1) continue;
            const a = o.p[0] + t * (o.q[0] - o.p[0]);
            if (Math.abs(a) < total / 2 + LINE_GAP + 20) splits.push(a);
        }
        for (const a of splits.sort((p, q) => p - q)) {
            let leftEdge = -Infinity, rightEdge = Infinity;
            centers.forEach((c, i) => {
                if (c < a) leftEdge = Math.max(leftEdge, c + items[i].slot / 2);
                else rightEdge = Math.min(rightEdge, c - items[i].slot / 2);
            });
            const shiftLeft = Math.min(0, a - LINE_GAP - leftEdge), shiftRight = Math.max(0, a + LINE_GAP - rightEdge);
            centers.forEach((c, i) => centers[i] = c + (c < a ? (isFinite(shiftLeft) ? shiftLeft : 0) : (isFinite(shiftRight) ? shiftRight : 0)));
        }
        return centers;
    };
    const connectorsClear = (from: Vec, targets: Vec[], shapes: Ellipse[]): boolean =>
        targets.every((t, i) => shapes.every((e, j) => j === i || !crossesEllipse(from, t, e)));
    const linesClear = (shapes: Ellipse[], allLines: boolean): boolean => lines.every(o => {
        if (!o.own && !allLines) return true;
        const p = toXY(o.p[0], o.p[1]), q = toXY(o.q[0], o.q[1]);
        return shapes.every(e => !crossesEllipse(p, q, e));
    });
    const fits = (d: number, allLines: boolean): number[] | null => {
        const centers = arrange(d, allLines), points = centers.map(c => toXY(c, d));
        const ok = connectorsClear([ 0, 0 ], points, items.map((it, i) => ellipse(it.n, points[i], 8)))
            && linesClear(items.map((it, i) => ellipse(it.n, points[i], 12)), allLines);
        return ok ? centers : null;
    };

    const ownerHalf = across(owner) / 2, deepest = Math.max(...items.map(it => across(it.n)));
    let distance = ownerHalf + 44 + deepest / 2, centers: number[] | null = null;
    for (; distance < ownerHalf + 700 && !(centers = fits(distance, false)); distance += 10);
    centers ??= arrange(distance, false);
    for (let d = distance; d <= distance + 200; d += 10) {
        const better = fits(d, true);
        if (better) {
            distance = d;
            centers = better;
            break;
        }
    }

    const placed: Placed[] = [];
    items.forEach((it, i) => {
        const [ px, py ] = toXY(centers[i], distance);
        placed.push({ n: it.n, x: px, y: py });
        if (!it.kids.length) return;
        const width = it.kids.reduce((s, k) => s + along(k), 0) + GAP * (it.kids.length - 1);
        let a = centers[i] - width / 2;
        const kidCenters = it.kids.map(k => {
            const c = a + along(k) / 2;
            a += along(k) + GAP;
            return c;
        });
        let d = distance + across(it.n) / 2 + 38 + Math.max(...it.kids.map(across)) / 2;
        for (; d < distance + 600; d += 10) {
            const points = kidCenters.map(c => toXY(c, d));
            if (connectorsClear([ px, py ], points, it.kids.map((k, j) => ellipse(k, points[j], 8)))) break;
        }
        it.kids.forEach((k, j) => {
            const [ x, y ] = toXY(kidCenters[j], d);
            placed.push({ n: k, x, y });
        });
    });
    return {
        placed,
        l: Math.min(...placed.map(p => p.x - p.n.w / 2)),
        r: Math.max(...placed.map(p => p.x + p.n.w / 2)),
        t: Math.min(...placed.map(p => p.y - p.n.h / 2)),
        b: Math.max(...placed.map(p => p.y + p.n.h / 2)),
    };
}

/** Extent of a node plus its attribute rows, relative to its center. */
export function extentWith(n: DiagramNode, rows: (Row | null)[]): Extent {
    const e = { l: -n.w / 2, r: n.w / 2, t: -n.h / 2, b: n.h / 2 };
    for (const row of rows) {
        if (!row) continue;
        e.l = Math.min(e.l, row.l);
        e.r = Math.max(e.r, row.r);
        e.t = Math.min(e.t, row.t);
        e.b = Math.max(e.b, row.b);
    }
    return e;
}
