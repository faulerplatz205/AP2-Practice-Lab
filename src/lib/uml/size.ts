import type { DiagramNode } from "../../types/diagram";
import { snap } from "../math";
import { lines } from "./types";

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

export function classLayout(n: DiagramNode): ClassLayout {
    const attrs = n.attrs ? lines(n.attrs) : [];
    const ops = n.ops ? lines(n.ops) : [];
    const headerH = n.stereo && n.stereo !== "abstract" ? 42 : 30;
    const attrsH = attrs.length ? attrs.length * LINE + 10 : 14;
    const opsH = n.stereo === "enum" && !ops.length ? 0 : (ops.length ? ops.length * LINE + 10 : 14);
    return { headerH, attrsH, opsH, attrs, ops, total: headerH + attrsH + opsH };
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
    } else if (n.type === "state" && n.attrs) {
        n.h = Math.max(n.h, 38 + lines(n.attrs).length * LINE + 6);
    }
}
