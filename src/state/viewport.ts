import type { Point, Rect } from "../types/diagram";
import { contentBox } from "../lib/uml/labels";
import { clamp } from "../lib/math";
import { useDiagram } from "./diagramStore";

/** The canvas registers here so that actions can convert screen to world coordinates. */
let canvas: SVGSVGElement | null = null;

export function registerCanvas(el: SVGSVGElement | null): void {
    canvas = el;
}

export function canvasElement(): SVGSVGElement | null {
    return canvas;
}

export function toWorld(clientX: number, clientY: number): Point {
    const r = canvas?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const { view } = useDiagram.getState();
    return { x: (clientX - r.left - view.x) / view.z, y: (clientY - r.top - view.y) / view.z };
}

/** Zooms by factor `k` around the point (mx, my) relative to the canvas. */
export function zoomAt(mx: number, my: number, k: number): void {
    const { view, set } = useDiagram.getState();
    const z = clamp(view.z * k, 0.25, 3);
    const f = z / view.z;
    set({ view: { x: mx - (mx - view.x) * f, y: my - (my - view.y) * f, z }, editor: null });
}

export function zoomCenter(k: number): void {
    const r = canvas?.getBoundingClientRect();
    if (r) zoomAt(r.width / 2, r.height / 2, k);
}

/** Canvas width from which the toast fits next to the level chip (same value as the container query in custom.css). */
const WIDE_CANVAS = 1120;

/**
 * Shows `box` (or the whole drawing) as large as possible and centred, leaving room at the top
 * for the toast and level chip and at the bottom for the hint, zoom controls and achievement popup.
 */
export function fitView(box?: Rect | null): void {
    const { doc, set } = useDiagram.getState();
    const b = box ?? contentBox(doc);
    const r = canvas?.getBoundingClientRect();
    if (!b || !r) {
        set({ view: { x: 40, y: 40, z: 1 } });
        return;
    }
    const top = r.width >= WIDE_CANVAS ? 64 : 108, bottom = 96;
    const z = clamp(Math.min((r.width - 80) / b.w, (r.height - top - bottom) / b.h), 0.25, 1.4);
    set({ view: { z, x: (r.width - b.w * z) / 2 - b.x * z, y: top + (r.height - top - bottom - b.h * z) / 2 - b.y * z } });
}
