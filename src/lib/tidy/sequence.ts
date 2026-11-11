import type { Diagram, DiagramEdge, DiagramNode } from "../../types/diagram";
import { inside } from "../geometry";
import { snap } from "../math";
import { NEST, headHeight, isLifeline, isMessage, messageY, ownerOf, pinnedTarget, settleActivations } from "../uml/sequence";
import { RELATIONS } from "../uml/types";

/** Vertical distance between two messages, and the extra room of a self message. */
const STEP = 50, SELF = 30;
/** Room for the operator tab and the guard at the top of a fragment, and below its last message. */
const TOP = 46, BOTTOM = 18, BETWEEN = 26;

const centerX = (n: DiagramNode): number => n.x + n.w / 2;

/** A thing on the time axis, in the order it happened before tidying. */
type Event =
    | { kind: "message"; y: number; e: DiagramEdge }
    | { kind: "open" | "close"; y: number; f: DiagramNode }
    | { kind: "operand"; y: number; o: DiagramNode }
    | { kind: "invariant" | "destroy"; y: number; n: DiagramNode };

/** Order of events at the same height: a fragment opens before its first message and closes after its last. */
const RANK: Record<Event["kind"], number> = { open: 0, operand: 1, invariant: 2, message: 3, destroy: 4, close: 5 };

/**
 * Sequence diagram (mutates `d`): lifelines in one row, spaced by their longest message label; messages,
 * operands, state invariants and destructions at equal distances in their old order; fragments around their
 * messages without overlapping each other; activation bars from their first to their last message, nested bars
 * offset. Returns the moved nodes, or null without lifelines.
 */
export function tidySequence(d: Diagram): DiagramNode[] | null {
    const all = d.nodes, lifelines = all.filter(isLifeline).sort((a, b) => a.x - b.x);
    if (!lifelines.length) return null;
    const byId = new Map(all.map(n => [ n.id, n ]));
    const messages = d.edges.filter(e => isMessage(e) && byId.has(e.from) && byId.has(e.to));
    const of = (n: DiagramNode): DiagramNode | undefined => ownerOf(n, all);
    // bars lying on top of each other (older drawings) become nested ones first
    settleActivations(all);
    const ends = (e: DiagramEdge): [DiagramNode | undefined, DiagramNode | undefined] => [ of(byId.get(e.from)!), of(byId.get(e.to)!) ];
    const oldY = new Map(messages.map(e => [ e.id, messageY(e, byId.get(e.from)!, byId.get(e.to)!) ]));
    const activations = all.filter(n => n.type === "activation"), fragments = all.filter(n => n.type === "fragment");
    const operands = all.filter(n => n.type === "operand"), invariants = all.filter(n => n.type === "invariant"), crosses = all.filter(n => n.type === "destroy");
    const created = new Map<DiagramNode, DiagramEdge>();
    for (const e of messages) if (e.kind === "create" && pinnedTarget(e, byId.get(e.to)!)) created.set(byId.get(e.to)!, e);

    // what belongs to what, from the old geometry
    const ownerBefore = new Map([ ...activations, ...invariants, ...crosses ].map(n => [ n, of(n) ]));
    const depth = new Map(activations.map(a => [ a, activations.filter(b => b !== a && ownerBefore.get(b) === ownerBefore.get(a) && b.y <= a.y && b.y + b.h >= a.y + a.h && b.x < a.x).length ]));
    const fragmentOf = (n: DiagramNode): DiagramNode | undefined => fragments.filter(f => f !== n && inside(n, f)).sort((p, q) => p.w * p.h - q.w * q.h)[0];
    const parentOf = new Map(fragments.map(f => [ f, fragmentOf(f) ]));
    const operandOf = new Map(operands.map(o => [ o, fragmentOf(o) ]));
    const coveredBefore = new Map(fragments.map(f => [ f, lifelines.filter(l => centerX(l) >= f.x && centerX(l) <= f.x + f.w) ]));
    const barMessages = new Map(activations.map(a => [ a, messages.filter(e => ends(e).includes(ownerBefore.get(a)) && oldY.get(e.id)! >= a.y - 2 && oldY.get(e.id)! <= a.y + a.h + 2) ]));

    // columns: wide enough for the longest label between two neighbours
    const W = Math.max(...lifelines.map(l => l.w));
    const gaps = lifelines.slice(1).map(() => W + 80);
    for (const e of messages) {
        const [ a, b ] = ends(e);
        const i = a ? lifelines.indexOf(a) : -1, j = b ? lifelines.indexOf(b) : -1;
        if (i < 0 || j < 0 || Math.abs(i - j) !== 1) continue;
        const label = [ RELATIONS[e.kind ?? "flow"]?.tag, e.label ].filter(Boolean).join(" ");
        gaps[Math.min(i, j)] = Math.max(gaps[Math.min(i, j)], label.length * 7.2 + 60);
    }
    const x0 = Math.min(...lifelines.map(l => l.x)) + lifelines[0].w / 2;
    const plain = lifelines.filter(l => !created.has(l));
    const y0 = Math.min(...(plain.length ? plain : lifelines).map(l => l.y));
    let cx = x0;
    lifelines.forEach((l, i) => {
        if (i) cx += snap(gaps[i - 1]);
        l.x = cx - l.w / 2;
        l.y = y0;
    });

    // time axis; fragments that overlap without one containing the other are taken as one after the other
    const closeAt = (f: DiagramNode): number => Math.min(f.y + f.h, ...fragments.filter(g => g !== f && g.y > f.y && g.y < f.y + f.h && !inside(g, f)).map(g => g.y - 0.5));
    const events: Event[] = [
        ...messages.filter(e => byId.get(e.to)!.type !== "destroy").map(e => ({ kind: "message" as const, y: oldY.get(e.id)!, e })),
        ...fragments.flatMap(f => [{ kind: "open" as const, y: f.y, f }, { kind: "close" as const, y: closeAt(f), f }]),
        ...operands.map(o => ({ kind: "operand" as const, y: o.y, o })),
        ...invariants.map(n => ({ kind: "invariant" as const, y: n.y + n.h / 2, n })),
        ...crosses.map(n => ({ kind: "destroy" as const, y: n.y + n.h / 2, n })),
    ].sort((p, q) => p.y - q.y || RANK[p.kind] - RANK[q.kind]);
    const head = Math.max(...lifelines.map(headHeight));
    const newY = new Map<number, number>(), top = new Map<DiagramNode, number>(), bottom = new Map<DiagramNode, number>();
    let cursor = y0 + head + 40, lastWasClose = false;
    for (const ev of events) {
        if (ev.kind !== "close" && lastWasClose) cursor += BETWEEN;
        lastWasClose = ev.kind === "close";
        switch (ev.kind) {
            case "open":
                top.set(ev.f, cursor - 20);
                cursor += TOP - 20;
                break;
            case "close":
                bottom.set(ev.f, cursor - STEP + BOTTOM + 10);
                cursor += 10;
                break;
            case "operand":
                ev.o.y = cursor - 16;
                cursor += 30;
                break;
            case "invariant":
                ev.n.y = snap(cursor - 10);
                cursor += ev.n.h + 20;
                break;
            case "destroy": {
                ev.n.y = cursor - ev.n.h / 2;
                for (const e of messages.filter(x => x.to === ev.n.id)) newY.set(e.id, cursor);
                cursor += STEP;
                break;
            }
            case "message":
                newY.set(ev.e.id, cursor);
                cursor += STEP + (ev.e.from === ev.e.to ? SELF : 0);
                break;
        }
    }
    const end = cursor + 20;

    // lifelines: created ones start at their «create» message, destroyed ones end at the X
    for (const l of lifelines) {
        const c = created.get(l);
        if (c) l.y = newY.get(c.id)! - headHeight(l) / 2;
        const x = crosses.find(n => ownerBefore.get(n) === l);
        l.h = x ? x.y + x.h - l.y : snap(end - l.y);
    }
    for (const n of [ ...invariants, ...crosses ]) {
        const l = ownerBefore.get(n);
        if (l) n.x = centerX(l) - n.w / 2;
    }

    // activation bars from the first to the last of their messages
    for (const a of activations) {
        const l = ownerBefore.get(a);
        if (!l) continue;
        a.x = centerX(l) - a.w / 2 + depth.get(a)! * NEST;
        const ys = barMessages.get(a)!.map(e => newY.get(e.id)!).filter(y => y !== undefined);
        if (ys.length) {
            a.y = Math.min(...ys) - 10;
            a.h = Math.max(30, Math.max(...ys) - Math.min(...ys) + 20 + (barMessages.get(a)!.some(e => e.from === e.to) ? SELF : 0));
        }
    }

    // fragments around their lifelines; an enclosing fragment leaves room around the inner one
    const nesting = (f: DiagramNode): number => {
        let n = 0;
        for (let p = parentOf.get(f); p; p = parentOf.get(p)) n++;
        return n;
    };
    const maxDepth = Math.max(0, ...fragments.map(nesting));
    for (const f of fragments) {
        const covered = coveredBefore.get(f)!;
        const inset = (maxDepth - nesting(f)) * 12;
        if (covered.length) {
            f.x = Math.min(...covered.map(l => l.x)) - 20 - inset;
            f.w = Math.max(...covered.map(l => l.x + l.w)) + 20 + inset - f.x;
        }
        if (f.text === "sd") continue;
        if (top.has(f)) f.y = top.get(f)! - inset;
        if (bottom.has(f)) f.h = Math.max(70, bottom.get(f)! + inset - f.y);
    }
    const frames = fragments.filter(f => f.text === "sd");
    for (const f of frames) {
        const inner = [ ...lifelines, ...fragments.filter(x => x !== f) ];
        f.x = Math.min(...inner.map(n => n.x)) - 30;
        f.y = Math.min(...inner.map(n => n.y)) - 40;
        f.w = Math.max(...inner.map(n => n.x + n.w)) + 30 - f.x;
        f.h = Math.max(...inner.map(n => n.y + n.h)) + 30 - f.y;
    }
    for (const o of operands) {
        const f = operandOf.get(o);
        if (!f) continue;
        o.x = f.x;
        o.w = f.w;
    }

    for (const e of messages) {
        const y = newY.get(e.id);
        if (y !== undefined) e.y = y - byId.get(e.from)!.y;
    }
    return [ ...lifelines, ...activations, ...fragments, ...operands, ...invariants, ...crosses ];
}
