import type { Diagram, DiagramEdge, DiagramNode } from "../../types/diagram";
import { snap } from "../math";
import { RELATIONS, UML_TYPES } from "./types";

/** Height of the head of a lifeline (rectangle) or an actor lifeline (stick figure with name). */
export function headHeight(n: DiagramNode): number {
    return n.type === "actline" ? 70 : 40;
}

export const isLifeline = (n: DiagramNode): boolean => n.type === "lifeline" || n.type === "actline";

export const isMessage = (e: DiagramEdge): boolean => !!RELATIONS[e.kind ?? "flow"]?.seq;

/** Lifeline that an activation, destruction X or state invariant sits on (center within 14 px), the lifeline itself, or undefined. */
export function ownerOf(n: DiagramNode, nodes: DiagramNode[]): DiagramNode | undefined {
    if (isLifeline(n)) return n;
    if (n.type !== "activation" && n.type !== "destroy" && n.type !== "invariant") return undefined;
    const cx = n.x + n.w / 2;
    let best: DiagramNode | undefined, gap = 14;
    for (const l of nodes) {
        if (!isLifeline(l)) continue;
        const g = Math.abs(l.x + l.w / 2 - cx);
        if (g < gap) [ best, gap ] = [ l, g ];
    }
    return best;
}

/** Lifeline whose dashed line is closest to the horizontal position `cx`, within `reach` px. */
export function nearestLifeline(nodes: DiagramNode[], cx: number, reach: number): DiagramNode | undefined {
    let best: DiagramNode | undefined, gap = reach;
    for (const l of nodes) {
        if (!isLifeline(l)) continue;
        const g = Math.abs(l.x + l.w / 2 - cx);
        if (g <= gap) [ best, gap ] = [ l, g ];
    }
    return best;
}

/** Combined fragment that the separator line `o` lies in (the innermost one). */
export function fragmentOf(o: DiagramNode, nodes: DiagramNode[]): DiagramNode | undefined {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    return nodes.filter(f => f.type === "fragment" && f.id !== o.id && cx > f.x && cx < f.x + f.w && cy > f.y && cy < f.y + f.h).sort((p, q) => p.w * p.h - q.w * q.h)[0];
}

/**
 * Activation on the lifeline `l` at height `y`, the innermost one when bars are nested (a nested bar of a self call
 * lies further right).
 */
export function activationAt(nodes: DiagramNode[], l: DiagramNode, y: number): DiagramNode | undefined {
    let best: DiagramNode | undefined;
    for (const a of nodes) {
        if (a.type !== "activation" || ownerOf(a, nodes) !== l || y < a.y - 1 || y > a.y + a.h + 1) continue;
        if (!best || a.x > best.x) best = a;
    }
    return best;
}

/**
 * Messages whose height follows the target: a «create» message points at the head of the new lifeline, a message
 * to a destruction X (`«destroy»`) ends in the cross.
 */
export function pinnedTarget(e: DiagramEdge, b: DiagramNode): "head" | "cross" | null {
    if (e.kind === "create" && isLifeline(b)) return "head";
    if (b.type === "destroy") return "cross";
    return null;
}

/** Absolute y of a message between `a` and `b`. `e.y` is relative to the top of the sender `a`. */
export function messageY(e: DiagramEdge, a: DiagramNode, b: DiagramNode): number {
    const pin = pinnedTarget(e, b);
    if (pin === "head") return b.y + headHeight(b) / 2;
    if (pin === "cross") return b.y + b.h / 2;
    return a.y + (e.y ?? 60);
}

/** Heights a message may take on the sender: below the head and above the end of its lifeline. */
function senderRange(nodes: DiagramNode[], a: DiagramNode): [number, number] {
    const l = ownerOf(a, nodes);
    if (!l) return [ a.y, a.y + a.h ];
    return [ l.y + headHeight(l) + 10, Math.max(l.y + headHeight(l) + 10, l.y + l.h - 10) ];
}

/** `e.y` for a message from `a` at the absolute height `y`, kept on the sender's lifeline. */
export function messageOffset(nodes: DiagramNode[], a: DiagramNode, y: number): number {
    const [ lo, hi ] = senderRange(nodes, a);
    return snap(Math.max(lo, Math.min(hi, y))) - a.y;
}

/**
 * Moves a message to the absolute height `y` (mutates `d`). A pinned target moves along: a created lifeline keeps
 * its bottom end, a destruction X its size.
 */
export function moveMessage(d: Diagram, e: DiagramEdge, y: number): void {
    const a = d.nodes.find(n => n.id === e.from), b = d.nodes.find(n => n.id === e.to);
    if (!a || !b) return;
    const pin = pinnedTarget(e, b);
    if (pin === "head") {
        const bottom = b.y + b.h, minH = UML_TYPES[b.type === "actline" ? "actline" : "lifeline"].minH ?? 120;
        const step = snap(y - headHeight(b) / 2) - b.y;
        b.y += step;
        // further down than the line is long, its end moves along
        b.h = Math.max(minH, bottom - b.y);
        const top = headHeight(b) + 10;
        for (const m of d.edges) if (m.from === b.id && m.y !== undefined && isMessage(m)) m.y = Math.max(top, m.y - step);
    } else if (pin === "cross") {
        b.y = snap(y) - b.h / 2;
    }
    e.y = pin ? messageY(e, a, b) - a.y : messageOffset(d.nodes, a, y);
}
