import type { DiagramNode } from "../../types/diagram";
import { snap } from "../math";
import { lines } from "./types";
import { sheetLayout, tableLayout } from "../db/columns";

export interface ClassLayout {
    headerH: number;
    attrsH: number;
    /** 0 for an enum without methods */
    opsH: number;
    attrs: string[];
    ops: string[];
    total: number;
}

const LINE = 17;

/** Operator tab of a combined fragment; the sd frame carries its name in the tab. */
export function fragmentTab(n: DiagramNode): { tab: string; tabW: number } {
    const frame = n.text === "sd", tab = frame && n.attrs ? `sd ${n.attrs}` : String(n.text);
    return { tab, tabW: Math.max(46, tab.length * (frame ? 7.6 : 8) + 22) };
}

export function classLayout(n: DiagramNode): ClassLayout {
    const attrs = n.attrs ? lines(n.attrs) : [];
    const ops = n.ops ? lines(n.ops) : [];
    // without attributes and methods a class is a plain box with its name, as in the IHK Belegsatz
    const plain = !attrs.length && !ops.length && !n.stereo;
    const headerH = plain ? 44 : n.stereo ? 42 : 30;
    const attrsH = plain ? 0 : attrs.length ? attrs.length * LINE + 10 : 14;
    const opsH = plain || (n.stereo === "enum" && !ops.length) ? 0 : (ops.length ? ops.length * LINE + 10 : 14);
    return { headerH, attrsH, opsH, attrs, ops, total: headerH + attrsH + opsH };
}

/** A use case with extension points: y of the line between its name and the points. */
export function extensionSplit(n: DiagramNode): number {
    return Math.round(n.h * 0.44);
}

/** Grows classes/objects to their longest entry and states to their activities. Mutates `n` (runs inside immer). */
export function fitToContent(n: DiagramNode): void {
    if (n.type === "class") {
        const L = classLayout(n);
        n.h = L.total;
        n.w = Math.max(n.w, snap(Math.max(n.text.length * 9, ...L.attrs.map(l => l.length * 7.2), ...L.ops.map(l => l.length * 7.2)) + 24));
    } else if (n.type === "object") {
        const attrs = n.attrs ? lines(n.attrs) : [];
        n.w = Math.max(n.w, snap(Math.max(n.text.length * 8.6, ...attrs.map(l => l.length * 7.2)) + 24));
        n.h = 30 + (attrs.length ? attrs.length * LINE + 10 : 14);
    } else if (n.type === "table") {
        const L = tableLayout(n);
        n.w = Math.max(n.w, snap(L.width));
        n.h = L.height;
    } else if (n.type === "sheet") {
        const L = sheetLayout(n);
        n.w = snap(L.width + 5);
        n.h = L.height;
    } else if (n.type === "usecase" && n.attrs) {
        const points = lines(n.attrs);
        n.h = Math.max(n.h, 84 + points.length * 15);
        n.w = Math.max(n.w, snap(Math.max(...points.map(l => l.length * 6.6)) + 90));
    } else if (n.type === "state" && n.attrs) {
        const acts = lines(n.attrs);
        n.h = Math.max(n.h, 38 + acts.length * LINE + 6);
        n.w = Math.max(n.w, snap(Math.max(n.text.length * 8.6, ...acts.map(l => l.length * 6.9)) + 24));
    }
}
