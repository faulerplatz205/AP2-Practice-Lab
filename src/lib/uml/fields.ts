import type { DiagramNode, Point } from "../../types/diagram";
import { classLayout } from "./size";
import { UML_TYPES, isUml } from "./types";

/** Area of a UML element that is edited by double-click. */
export interface EditableField {
    key: "text" | "attrs" | "ops";
    /** Position relative to the element */
    x?: number;
    y: number;
    w?: number;
    h: number;
    /** Multi-line: Enter adds a line, Ctrl+Enter finishes */
    multi?: boolean;
}

/** Which field is under the click point `p` (world coordinates)? Without `p`: the main field. */
export function fieldAt(n: DiagramNode, p: Point | null): EditableField | null {
    if (!isUml(n.type) || UML_TYPES[n.type].notext) return null;
    const ly = p ? p.y - n.y : 0;
    switch (n.type) {
        case "class": {
            const L = classLayout(n);
            if (ly < L.headerH) return { key: "text", y: 0, h: L.headerH };
            if (ly < L.headerH + L.attrsH || !L.opsH) return { key: "attrs", y: L.headerH, h: Math.max(L.attrsH, 40), multi: true };
            return { key: "ops", y: L.headerH + L.attrsH, h: Math.max(L.opsH, 40), multi: true };
        }
        case "object":
        case "state":
            if (n.type === "state" && !n.attrs) return { key: "text", y: 0, h: n.h };
            if (ly < 32) return { key: "text", y: 0, h: 32 };
            return { key: "attrs", y: 30, h: Math.max(n.h - 30, 40), multi: true };
        case "fragment":
            return ly < 24 && p && p.x - n.x < 90 ? { key: "text", y: 0, h: 24 } : { key: "attrs", y: 0, h: 24 };
        case "lifeline":
            return { key: "text", y: 0, h: 40 };
        case "actline":
            return { key: "text", y: 48, h: 22 };
        case "actor":
            return { key: "text", y: n.h - 20, h: 22 };
        case "iface":
            return { key: "text", y: n.h + 2, h: 22, w: 140, x: -58 };
        case "boundary":
        case "lane":
        case "package":
            return { key: "text", y: 0, h: 32 };
        default:
            return { key: "text", y: 0, h: n.h, multi: n.type === "note" || n.type === "node3d" };
    }
}
