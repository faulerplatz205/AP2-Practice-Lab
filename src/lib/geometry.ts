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
