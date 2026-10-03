import type { Point, Rect } from "../types/diagram";
import { diagramBox } from "../lib/diagram";
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

/** Shows `box` (or the whole drawing) as large as possible and centred. */
export function fitView(box?: Rect | null): void {
    const { doc, set } = useDiagram.getState();
    const b = box ?? diagramBox(doc);
    const r = canvas?.getBoundingClientRect();
    if (!b || !r) {
        set({ view: { x: 40, y: 40, z: 1 } });
        return;
    }
    const z = clamp(Math.min((r.width - 80) / b.w, (r.height - 110) / b.h), 0.25, 1.4);
    set({ view: { z, x: (r.width - b.w * z) / 2 - b.x * z, y: (r.height - b.h * z) / 2 - b.y * z - 10 } });
}
