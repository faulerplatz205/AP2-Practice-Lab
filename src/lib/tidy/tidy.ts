import type { Diagram, DiagramNode } from "../../types/diagram";
import { centerX, inside, overlaps } from "../geometry";
import { snap } from "../math";
import { layoutActivities } from "../netzplan/layout";
import { fitToContent } from "../uml/size";
import { FLOW_TYPES, RELATIONS, isUml } from "../uml/types";
import { layered } from "./layered";

/** Activity and state machine diagram from top to bottom, with bars and partitions. */
function tidyFlow(d: Diagram): DiagramNode[] | null {
    const nodes = d.nodes.filter(n => FLOW_TYPES.has(n.type));
    if (!nodes.length) return null;
    const ids = new Set(nodes.map(n => n.id));
    const byId = new Map(nodes.map(n => [ n.id, n ]));
    const edges = d.edges.filter(e => (e.kind ?? "flow") === "flow" && ids.has(e.from) && ids.has(e.to)).map(e => [ e.from, e.to ] as [number, number]);
    const lanes = d.nodes.filter(n => n.type === "lane").sort((a, b) => a.x - b.x);
    const laneOf = new Map<number, number | null>();
    for (const n of nodes) {
        const lane = lanes.find(l => inside(n, l) || (centerX(n) >= l.x && centerX(n) <= l.x + l.w));
        laneOf.set(n.id, lane ? lane.id : null);
    }

    // Horizontal bars narrow first so the branches move together, then stretch them to the branch width
    const bars = nodes.filter(n => n.type === "bar" && n.w >= n.h);
    bars.forEach(n => {
        n.w = 120;
        n.h = 8;
    });
    const fitBars = (pred: Record<number, number[]>, succ: Record<number, number[]>, rows: number[][], clampToNeighbours: boolean): void => {
        for (const b of bars) {
            const branches = succ[b.id].length > 1 ? succ[b.id] : pred[b.id];
            if (branches.length < 2) continue;
            const xs = branches.map(id => centerX(byId.get(id)!));
            let left = Math.min(...xs) - 40, right = Math.max(...xs) + 40;
            if (clampToNeighbours) {
                const row = rows.find(r => r.includes(b.id))!, i = row.indexOf(b.id);
                const prev = row[i - 1] !== undefined ? byId.get(row[i - 1]) : undefined;
                const next = row[i + 1] !== undefined ? byId.get(row[i + 1]) : undefined;
                if (prev) left = Math.max(left, prev.x + prev.w + 24);
                if (next) right = Math.min(right, next.x - 24);
            }
            b.x = snap(left);
            b.w = Math.max(60, snap(right) - b.x);
        }
    };
    const first = layered(nodes, edges, { gx: 50, gy: 46, first: true });
    fitBars(first.pred, first.succ, first.rows, false);
    const final = layered(nodes, edges, { gx: 50, gy: 46, first: true });
    fitBars(final.pred, final.succ, final.rows, true);

    if (!lanes.length) return nodes;

    // Partitions side by side; each gets its nodes, the rows stay
    let laneX = Math.min(...lanes.map(l => l.x));
    const top = Math.min(...lanes.map(l => l.y));
    const dy = top + 60 - Math.min(...nodes.map(n => n.y));
    nodes.forEach(n => n.y += dy);
    const bottom = Math.max(...nodes.map(n => n.y + n.h)) + 40;
    lanes.forEach((lane, li) => {
        const mine = nodes.filter(n => laneOf.get(n.id) === lane.id || (!laneOf.get(n.id) && li === 0));
        const perRow = new Map<number, DiagramNode[]>();
        for (const n of mine) perRow.set(Math.round(n.y), [ ...(perRow.get(Math.round(n.y)) ?? []), n ]);
        const need = Math.max(240, ...[ ...perRow.values() ].map(r => r.reduce((a, n) => a + n.w, 0) + 50 * (r.length + 1)));
        Object.assign(lane, { x: laneX, y: top, w: snap(need), h: snap(bottom - top) });
        for (const r of perRow.values()) {
            r.sort((a, b) => a.x - b.x);
            const total = r.reduce((a, n) => a + n.w, 0) + 50 * (r.length - 1);
            let cx = lane.x + (lane.w - total) / 2;
            for (const n of r) {
                n.x = snap(cx + n.w / 2) - n.w / 2;
                cx += n.w + 50;
            }
        }
        laneX += lane.w;
    });
    return [ ...nodes, ...lanes ];
}

/** Use case: use cases in one or two columns inside the system boundary, actors outside. */
function tidyUseCase(d: Diagram): DiagramNode[] | null {
    const actors = d.nodes.filter(n => n.type === "actor"), cases = d.nodes.filter(n => n.type === "usecase");
    if (!cases.length && !actors.length) return null;
    const boundary = d.nodes.find(n => n.type === "boundary");
    const byId = new Map(d.nodes.map(n => [ n.id, n ]));
    const edges = d.edges.filter(e => byId.has(e.from) && byId.has(e.to));
    const neighbours = (n: DiagramNode): DiagramNode[] => edges.filter(e => e.from === n.id || e.to === n.id).map(e => byId.get(e.from === n.id ? e.to : e.from)!);

    const sorted = actors.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const left = sorted.slice(0, sorted.length > 1 ? Math.ceil(sorted.length / 2) : 1), right = sorted.slice(left.length);
    const side = (u: DiagramNode): number => {
        const a = neighbours(u).filter(x => x.type === "actor");
        if (a.some(x => right.includes(x)) && !a.some(x => left.includes(x))) return 1;
        if (a.some(x => left.includes(x))) return 0;
        return -1;
    };
    cases.forEach(u => {
        u.w = Math.max(150, snap(String(u.text).length * 8.4 + 44));
        u.h = 70;
    });
    const twoColumns = cases.length > 4 || right.length > 0;
    const colL: DiagramNode[] = [], colR: DiagramNode[] = [];
    cases.filter(u => side(u) >= 0).forEach(u => (side(u) === 1 && twoColumns ? colR : colL).push(u));
    for (const u of cases.filter(x => side(x) < 0)) {
        const nb = neighbours(u), r = nb.some(x => colR.includes(x)), l = nb.some(x => colL.includes(x));
        (twoColumns && ((r && !l) || (!l && colR.length < colL.length)) ? colR : colL).push(u);
    }
    colL.sort((a, b) => a.y - b.y);
    colR.sort((a, b) => a.y - b.y);

    const x0 = boundary ? boundary.x : Math.min(...cases.map(u => u.x));
    const y0 = boundary ? boundary.y : Math.min(...cases.map(u => u.y));
    const pad = 40, top = 56, gy = 38, cw = Math.max(150, ...cases.map(u => u.w));
    const place = (col: DiagramNode[], ci: number): void => col.forEach((u, i) => {
        u.x = snap(x0 + pad + ci * (cw + 50) + cw / 2) - u.w / 2;
        u.y = snap(y0 + top + i * (u.h + gy) + (ci ? (u.h + gy) / 2 : 0));
    });
    place(colL, 0);
    place(colR, 1);
    const bw = pad * 2 + cw + (twoColumns && colR.length ? cw + 50 : 0);
    const bh = top + Math.max(colL.length, colR.length + 0.5) * (70 + gy) + pad - gy / 2;
    if (boundary) {
        boundary.w = snap(bw);
        boundary.h = snap(bh);
    }
    const width = boundary ? boundary.w : bw;
    const actorY = (a: DiagramNode): number => {
        const u = neighbours(a).filter(x => x.type === "usecase");
        return u.length ? u.reduce((s, x) => s + x.y + x.h / 2, 0) / u.length : y0 + bh / 2;
    };
    const putActors = (list: DiagramNode[], x: number): void => {
        let last = -1e9;
        for (const { a, y } of list.map(a => ({ a, y: actorY(a) })).sort((p, q) => p.y - q.y)) {
            a.x = snap(x) - a.w / 2;
            a.y = snap(Math.max(y - a.h / 2, last + 20));
            last = a.y + a.h;
        }
    };
    putActors(left, x0 - 110);
    putActors(right, x0 + width + 110);
    return [ ...cases, ...actors, ...(boundary ? [ boundary ] : []) ];
}

/** Classes layered by inheritance: superclasses and interfaces at the top. */
function tidyClasses(d: Diagram): DiagramNode[] | null {
    const nodes = d.nodes.filter(n => n.type === "class" || n.type === "object");
    if (!nodes.length) return null;
    nodes.forEach(fitToContent);
    const ids = new Set(d.nodes.map(n => n.id));
    const edges: [number, number][] = [];
    for (const e of d.edges) {
        if (!ids.has(e.from) || !ids.has(e.to)) continue;
        const k = e.kind ?? "flow";
        if (k === "inherit" || k === "realize") edges.push([ e.to, e.from ]);
        else if (k === "comp" || k === "aggr") edges.push([ e.from, e.to ]);
    }
    const associations = d.edges.filter(e => [ "assoc", "dir", "dep" ].includes(e.kind ?? "flow"));
    layered(nodes, edges, {
        gx: 120, gy: 80, top: true,
        // classes connected only by association go into the row of their partner
        pull: (rank, pred, succ) => {
            for (const n of nodes) {
                if (pred[n.id].length || succ[n.id].length) continue;
                const a = associations.find(e => e.from === n.id || e.to === n.id);
                if (!a) continue;
                const other = a.from === n.id ? a.to : a.from;
                if (rank[other] !== undefined) rank[n.id] = rank[other];
            }
        },
    });
    return nodes;
}

/** Sequence: lifelines evenly spaced, messages at equal distances, activations and fragments move along. */
function tidySequence(d: Diagram): DiagramNode[] | null {
    const lifelines = d.nodes.filter(n => n.type === "lifeline" || n.type === "actline").sort((a, b) => a.x - b.x);
    if (!lifelines.length) return null;
    const byId = new Map(d.nodes.map(n => [ n.id, n ]));
    const activations = d.nodes.filter(n => n.type === "activation"), fragments = d.nodes.filter(n => n.type === "fragment");
    const messages = d.edges.filter(e => RELATIONS[e.kind ?? "flow"]?.seq && byId.has(e.from) && byId.has(e.to));
    const absY = (e: typeof messages[number]): number => byId.get(e.from)!.y + (e.y ?? 60);
    const owner = (a: DiagramNode): DiagramNode =>
        lifelines.find(l => Math.abs(centerX(l) - centerX(a)) < 20)
        ?? lifelines.slice().sort((p, q) => Math.abs(centerX(p) - centerX(a)) - Math.abs(centerX(q) - centerX(a)))[0];
    const oldY = new Map(messages.map(e => [ e.id, absY(e) ]));
    const oldActivations = activations.map(a => ({ a, o: owner(a), t: a.y, b: a.y + a.h }));
    const oldFragments = fragments.map(f => ({ f, t: f.y, b: f.y + f.h, l: f.x, r: f.x + f.w }));

    const x0 = Math.min(...lifelines.map(l => l.x)), y0 = Math.min(...lifelines.map(l => l.y)), W = Math.max(...lifelines.map(l => l.w));
    lifelines.forEach((l, i) => {
        l.x = snap(x0 + i * (W + 80) + W / 2) - l.w / 2;
        l.y = y0;
    });
    const sorted = messages.slice().sort((a, b) => oldY.get(a.id)! - oldY.get(b.id)!);
    const head = Math.max(...lifelines.map(l => l.type === "actline" ? 72 : 40));
    const newY = new Map<number, number>();
    let extra = 0;
    sorted.forEach((e, i) => {
        newY.set(e.id, y0 + head + 40 + i * 48 + extra);
        if (e.from === e.to) extra += 30; // self messages need more space
    });
    const lastY = Math.max(y0 + head + 80, ...newY.values());
    lifelines.forEach(l => l.h = snap(lastY - y0 + 60));
    const range = (t: number, b: number): [number, number] | null => {
        const ys = sorted.filter(e => oldY.get(e.id)! >= t - 2 && oldY.get(e.id)! <= b + 2).map(e => newY.get(e.id)!);
        return ys.length ? [ Math.min(...ys), Math.max(...ys) ] : null;
    };
    for (const { a, o, t, b } of oldActivations) {
        const r = range(t, b);
        a.x = centerX(o) - a.w / 2;
        if (r) {
            a.y = r[0] - 14;
            a.h = Math.max(30, r[1] - r[0] + 28);
        }
    }
    for (const { f, t, b, l, r } of oldFragments) {
        const y = range(t, b);
        if (y) {
            f.y = y[0] - 40;
            f.h = y[1] - y[0] + 64;
        }
        const covered = lifelines.filter(x => centerX(x) >= l && centerX(x) <= r);
        if (covered.length) {
            f.x = Math.min(...covered.map(x => x.x)) - 20;
            f.w = Math.max(...covered.map(x => x.x + x.w)) + 20 - f.x;
        }
    }
    messages.forEach(e => e.y = newY.get(e.id)! - byId.get(e.from)!.y);
    return [ ...lifelines, ...activations, ...fragments ];
}

/** Network diagram in columns; loose texts stay with it and move up when they are in the way. */
function tidyActivities(d: Diagram): DiagramNode[] | null {
    const activities = d.nodes.filter(n => n.type === "np");
    if (!activities.length) return null;
    const loose = d.nodes.filter(n => !isUml(n.type) && n.type !== "np");
    const ox = Math.min(...activities.map(n => n.x)), oy = Math.min(...activities.map(n => n.y));
    if (layoutActivities(d)) return null;
    const nx = Math.min(...activities.map(n => n.x)), ny = Math.min(...activities.map(n => n.y));
    let stack = ny - 30;
    const placed: DiagramNode[] = [];
    for (const n of loose.sort((a, b) => b.y - a.y)) {
        n.x += nx - ox;
        n.y += ny - oy;
        if (activities.some(m => overlaps(n, m)) || placed.some(m => overlaps(n, m))) {
            n.x = nx;
            n.y = snap(stack - n.h);
            stack = n.y - 20;
        }
        placed.push(n);
    }
    return [ ...activities, ...loose ];
}

/** Notes to the right of their element. */
function tidyNotes(d: Diagram): void {
    const byId = new Map(d.nodes.map(n => [ n.id, n ]));
    for (const note of d.nodes.filter(n => n.type === "note")) {
        const e = d.edges.find(x => x.kind === "anchor" && (x.from === note.id || x.to === note.id));
        const target = e && byId.get(e.from === note.id ? e.to : e.from);
        if (!target) continue;
        note.x = snap(target.x + target.w + 50);
        note.y = snap(target.y);
    }
}

/** Several diagrams on one canvas end up side by side without overlapping. Mutates `d`. */
export function tidyDiagram(d: Diagram): void {
    const groups: DiagramNode[][] = [];
    for (const step of [ tidyActivities, tidyFlow, tidyUseCase, tidyClasses, tidySequence ]) {
        const group = step(d);
        if (group?.length) groups.push(group);
    }
    tidyNotes(d);
    if (groups.length < 2) return;
    const box = (g: DiagramNode[]): { x: number; y: number; r: number } => ({
        x: Math.min(...g.map(n => n.x)),
        y: Math.min(...g.map(n => n.y)),
        r: Math.max(...g.map(n => n.x + n.w + (n.type === "iface" ? 60 : 0))),
    });
    groups.sort((a, b) => box(a).x - box(b).x);
    const top = Math.min(...groups.map(g => box(g).y));
    let cx = box(groups[0]).x;
    for (const g of groups) {
        const b = box(g), dx = snap(cx - b.x), dy = snap(top - b.y);
        g.forEach(n => {
            n.x += dx;
            n.y += dy;
        });
        cx += (b.r - b.x) + 160;
    }
}
