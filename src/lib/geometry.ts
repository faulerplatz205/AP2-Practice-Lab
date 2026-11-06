import type { DiagramNode, Rect } from "../types/diagram";

export function centerX(n: Rect): number {
    return n.x + n.w / 2;
}

export function center(n: Rect): [number, number] {
    return [ n.x + n.w / 2, n.y + n.h / 2 ];
}

export function inside(a: Rect, b: Rect): boolean {
    return a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
}

export function overlaps(a: Rect, b: Rect): boolean {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function boundingBox(list: readonly Rect[]): Rect | null {
    if (!list.length) return null;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const n of list) {
        x1 = Math.min(x1, n.x);
        y1 = Math.min(y1, n.y);
        x2 = Math.max(x2, n.x + n.w);
        y2 = Math.max(y2, n.y + n.h);
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export type Outline = "rect" | "ellipse" | "diamond";

/** Point on the outline of `n` towards (tx, ty), so straight edges dock at the outline instead of the center. */
export function anchorPoint(n: DiagramNode, outline: Outline, tx: number, ty: number): [number, number] {
    const [ cx, cy ] = center(n);
    const dx = tx - cx, dy = ty - cy, a = n.w / 2, b = n.h / 2;
    if (!dx && !dy) return [ cx, cy ];
    let t: number;
    if (outline === "ellipse") t = 1 / Math.sqrt(dx * dx / (a * a) + dy * dy / (b * b));
    else if (outline === "diamond") t = 1 / (Math.abs(dx) / a + Math.abs(dy) / b);
    else t = Math.min(dx ? a / Math.abs(dx) : Infinity, dy ? b / Math.abs(dy) : Infinity);
    return [ cx + dx * t, cy + dy * t ];
}

export type Vec = [number, number];

/** Whether the point (x, y) lies inside the outline with center (cx, cy) and half sizes rx, ry. */
export function insideOutline(outline: Outline, cx: number, cy: number, rx: number, ry: number, x: number, y: number): boolean {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    if (outline === "ellipse") return dx * dx + dy * dy < 1;
    if (outline === "diamond") return Math.abs(dx) + Math.abs(dy) < 1;
    return Math.abs(dx) < 1 && Math.abs(dy) < 1;
}

/** Samples the segment p–q every `step` px (at least 40 samples, without `margin` samples at both ends). */
export function segmentTouches(p: Vec, q: Vec, hit: (x: number, y: number) => boolean, step = 5, margin = 1): boolean {
    const samples = Math.max(40, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / step));
    for (let k = margin; k <= samples - margin; k++) {
        const t = k / samples;
        if (hit(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)) return true;
    }
    return false;
}

/** Proper crossing of the segments a–b and c–d (touching ends do not count). */
export function segmentsCross(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
    const side = (p: Vec, q: Vec, r: Vec): number => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}
