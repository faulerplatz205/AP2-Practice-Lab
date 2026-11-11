import type { DiagramNode, Point } from "../../types/diagram";
import { classLayout, fragmentTab } from "./size";
import { TABLE_HEADER, sheetLayout } from "../db/columns";
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
    /** The text starts at the left edge of the field instead of being centred */
    left?: boolean;
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
        case "fragment": {
            const { tabW } = fragmentTab(n), sd = n.text === "sd";
            if (!sd && ly < 24 && p && p.x - n.x < tabW) return { key: "text", y: 0, h: 24 };
            // the guard of the first operand stands right of the operator tab; the name of an sd frame inside the tab
            return sd ? { key: "attrs", x: 24, y: 0, w: Math.max(120, tabW - 24), h: 24, left: true } : { key: "attrs", x: tabW + 4, y: 2, w: Math.max(110, n.w - tabW - 8), h: 24, left: true };
        }
        case "operand":
            return { key: "text", x: 2, y: 2, w: Math.max(110, n.w - 4), h: 24, left: true };
        case "lifeline":
            return { key: "text", y: 0, h: 40 };
        case "table":
            return ly < TABLE_HEADER ? { key: "text", y: 0, h: TABLE_HEADER } : { key: "attrs", y: TABLE_HEADER, h: Math.max(n.h - TABLE_HEADER, 40), multi: true };
        case "sheet": {
            const caption = sheetLayout(n).caption;
            return caption && ly < caption ? { key: "text", y: 0, h: caption } : { key: "attrs", y: caption, h: Math.max(n.h - caption, 40), multi: true };
        }
        case "actline":
            return { key: "text", y: 48, h: 22 };
        case "actor":
            return { key: "text", y: n.h - 20, h: 22 };
        case "iface":
            return { key: "text", y: n.h + 2, h: 22, w: 140, x: -58 };
        case "boundary":
        case "lane":
        case "package":
        case "compstate":
            return { key: "text", y: 0, h: 32 };
        default:
            return { key: "text", y: 0, h: n.h, multi: n.type === "note" || n.type === "node3d" };
    }
}
