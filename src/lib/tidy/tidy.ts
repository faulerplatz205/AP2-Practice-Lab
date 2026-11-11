import type { Diagram, DiagramNode } from "../../types/diagram";
import { centerX, inside, overlaps, type Vec } from "../geometry";
import { snap } from "../math";
import { layoutActivities } from "../netzplan/layout";
import { fitToContent } from "../uml/size";
import { FLOW_TYPES, isUml } from "../uml/types";
import { routeAll } from "../uml/astar";
import { tidyEr } from "./er";
import { layered, layeredParts } from "./layered";
import { tidyComponents, tidyDeployment, tidyGeneric, tidyPackages } from "./structure";
import { tidyUseCase } from "./useCase";
import { tidySequence } from "./sequence";

/**
 * Extra gap between neighbouring columns so the labels of the flows between `ids` fit beside their lines instead of
 * lying on the next line: the width of a typical long label, capped so one very long text does not tear the diagram apart.
 */
function labelRoom(d: Diagram, ids: Set<number>): number {
    const widths = d.edges.filter(e => (e.kind ?? "flow") === "flow" && e.label && ids.has(e.from) && ids.has(e.to)).map(e => e.label.length * 7.4).sort((p, q) => q - p);
    if (!widths.length) return 0;
    // the second longest label when there are several: a single outlier wraps around elsewhere
    return snap(Math.min(240, widths[Math.min(1, widths.length - 1)] * 0.8));
}

/** Activity and state machine diagram from top to bottom, with bars and partitions. */
function tidyFlow(d: Diagram): DiagramNode[] | null {
    const all = d.nodes.filter(n => FLOW_TYPES.has(n.type));
    if (!all.length) return null;
    const allIds = new Set(all.map(n => n.id));
    const allEdges = d.edges.filter(e => (e.kind ?? "flow") === "flow" && allIds.has(e.from) && allIds.has(e.to)).map(e => [ e.from, e.to ] as [number, number]);
    const content = layoutComposites(all, allEdges);
    // the top level: composite states count as one node, their content moves along afterwards
    const nodes = all.filter(n => !content.parent.has(n.id));
    const ids = new Set(nodes.map(n => n.id));
    const byId = new Map(nodes.map(n => [ n.id, n ]));
    const edges = allEdges.map(([ a, b ]) => [ content.top(a), content.top(b) ] as [number, number]).filter(([ a, b ]) => a !== b && ids.has(a) && ids.has(b));
    const result = tidyTopFlow(d, nodes, edges, byId);
    content.follow();
    return [ ...result, ...all.filter(n => content.parent.has(n.id)) ];
}

/**
 * Lays out the content of every composite state (innermost first) and fits the state around it. `top` maps a node to
 * its outermost composite state, `follow` moves the content after its composite state was moved.
 */
function layoutComposites(all: DiagramNode[], edges: [number, number][]): { parent: Map<number, DiagramNode>; top: (id: number) => number; follow: () => void } {
    const comps = all.filter(n => n.type === "compstate");
    const parent = new Map<number, DiagramNode>();
    for (const n of all) {
        const p = comps.filter(k => k !== n && inside(n, k)).sort((x, y) => x.w * x.h - y.w * y.h)[0];
        if (p) parent.set(n.id, p);
    }
    const depth = (n: DiagramNode): number => {
        let k = 0;
        for (let p = parent.get(n.id); p; p = parent.get(p.id)) k++;
        return k;
    };
    const descendants = (k: DiagramNode): DiagramNode[] => all.filter(n => {
        for (let p = parent.get(n.id); p; p = parent.get(p.id)) if (p === k) return true;
        return false;
    });
    /** Ancestor of `id` directly inside `level` (undefined: the top level). */
    const lift = (id: number, level: DiagramNode | undefined): number | null => {
        let n = all.find(x => x.id === id);
        while (n && parent.get(n.id) !== level) n = parent.get(n.id);
        return n ? n.id : null;
    };
    const moveContent = (k: DiagramNode, dx: number, dy: number): void => descendants(k).forEach(n => {
        n.x += dx;
        n.y += dy;
    });
    for (const k of [ ...comps ].sort((x, y) => depth(y) - depth(x))) {
        const kids = all.filter(n => parent.get(n.id) === k);
        if (!kids.length) continue;
        const before = new Map(kids.map(n => [ n.id, [ n.x, n.y ] as Vec ]));
        const inner = edges.map(([ a, b ]) => [ lift(a, k), lift(b, k) ] as [number | null, number | null])
            .filter((e): e is [number, number] => e[0] !== null && e[1] !== null && e[0] !== e[1]);
        layered(kids, inner, { gx: 40, gy: 60, first: true });
        for (const n of kids.filter(x => x.type === "compstate")) moveContent(n, n.x - before.get(n.id)![0], n.y - before.get(n.id)![1]);
        const left = Math.min(...kids.map(n => n.x)), top = Math.min(...kids.map(n => n.y));
        const dx = snap(k.x + 30 - left), dy = snap(k.y + 50 - top);
        for (const n of [ ...kids, ...kids.flatMap(descendants) ]) {
            n.x += dx;
            n.y += dy;
        }
        k.w = Math.max(160, snap(Math.max(...kids.map(n => n.x + n.w)) + 30 - k.x));
        k.h = Math.max(110, snap(Math.max(...kids.map(n => n.y + n.h)) + 30 - k.y));
    }
    const tops = comps.filter(k => !parent.has(k.id));
    const start = new Map(tops.map(k => [ k.id, [ k.x, k.y ] as Vec ]));
    return {
        parent,
        top: id => lift(id, undefined) ?? id,
        follow: () => tops.forEach(k => moveContent(k, k.x - start.get(k.id)![0], k.y - start.get(k.id)![1])),
    };
}

function tidyTopFlow(d: Diagram, nodes: DiagramNode[], edges: [number, number][], byId: Map<number, DiagramNode>): DiagramNode[] {
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
    /** Stretches every bar over its parallel branches, symmetric around the bar's center (the main flow). */
    const fitBars = (pred: Record<number, number[]>, succ: Record<number, number[]>, rows: number[][] | null): void => {
        for (const b of bars) {
            const branches = succ[b.id].length > 1 ? succ[b.id] : pred[b.id];
            if (branches.length < 2) continue;
            const xs = branches.map(id => centerX(byId.get(id)!));
            let left = Math.min(...xs) - 40, right = Math.max(...xs) + 40;
            if (rows) {
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
    // joins and merges sit in the middle of their incoming branches, so the flow continues from the center
    const between = (id: number): boolean => byId.get(id)!.type === "bar" || byId.get(id)!.type === "decision";
    // forks and joins are centred over their branches; wider columns are only needed for the long labels of transitions
    const room = bars.length ? 0 : labelRoom(d, new Set(nodes.map(n => n.id)));
    const options = { gx: 50 + room, gy: room ? 90 : 70, first: true, between };
    const first = layered(nodes, edges, options);
    fitBars(first.pred, first.succ, null);
    const final = layered(nodes, edges, options);
    fitBars(final.pred, final.succ, final.rows);

    if (!lanes.length) return nodes;

    // Partitions side by side; each gets its nodes, the rows stay. Bars may span several partitions.
    let laneX = Math.min(...lanes.map(l => l.x));
    const top = Math.min(...lanes.map(l => l.y));
    const dy = top + 60 - Math.min(...nodes.map(n => n.y));
    nodes.forEach(n => n.y += dy);
    const bottom = Math.max(...nodes.map(n => n.y + n.h)) + 40;
    const inLane = new Map<number, DiagramNode>();
    lanes.forEach((lane, li) => {
        const mine = nodes.filter(n => !bars.includes(n) && (laneOf.get(n.id) === lane.id || (!laneOf.get(n.id) && li === 0)));
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
        for (const n of nodes) if (laneOf.get(n.id) === lane.id || (!laneOf.get(n.id) && li === 0)) inLane.set(n.id, lane);
        laneX += lane.w;
    });
    // a bar between one node and its branches: over the branches; a bar without branches: centered on its neighbour
    fitBars(final.pred, final.succ, null);
    for (const b of bars) {
        const branches = final.succ[b.id].length > 1 ? final.succ[b.id] : final.pred[b.id];
        if (branches.length > 1) continue;
        const other = [ ...final.pred[b.id], ...final.succ[b.id] ].map(id => byId.get(id)!)[0];
        const lane = inLane.get(b.id);
        if (other) b.x = snap(centerX(other) - b.w / 2);
        else if (lane) b.x = snap(lane.x + (lane.w - b.w) / 2);
    }
    // a bar stretched over several partitions may cover a node of its row: the bar and everything below move down a row
    const middle = (n: DiagramNode): number => n.y + n.h / 2;
    for (let round = 0; round < bars.length * 2; round++) {
        const hit = bars.flatMap(b => nodes.filter(n => n !== b && overlaps({ x: b.x - 10, y: b.y - 10, w: b.w + 20, h: b.h + 20 }, n)).map(n => [ b, n ] as const))[0];
        if (!hit) break;
        const [ bar, n ] = hit, dy = snap(n.y + n.h + 35 - bar.y), top = bar.y;
        for (const m of nodes) if (m === bar || (m.y >= top - 1 && Math.abs(middle(m) - middle(n)) > 5)) m.y += dy;
    }
    const end = Math.max(...nodes.map(n => n.y + n.h)) + 40;
    lanes.forEach(l => l.h = Math.max(l.h, snap(end - l.y)));
    return [ ...nodes, ...lanes ];
}

/**
 * Classes and objects layered from top to bottom: superclasses and interfaces above their subclasses, the whole above
 * its parts, the source of an association above its target. Back edges are dropped, sources move down to their partner.
 */
function tidyClasses(d: Diagram): DiagramNode[] | null {
    const nodes = d.nodes.filter(n => (n.type === "class" || n.type === "object") && !d.nodes.some(p => p.type === "package" && inside(n, p)));
    if (!nodes.length) return null;
    nodes.forEach(fitToContent);
    const ids = new Set(nodes.map(n => n.id));
    const strong: [number, number][] = [], weak: [number, number][] = [];
    for (const e of d.edges) {
        if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) continue;
        const k = e.kind ?? "flow";
        if (k === "inherit" || k === "realize") strong.push([ e.to, e.from ]);
        else if (k === "comp" || k === "aggr") strong.push([ e.from, e.to ]);
        else if (k === "assoc" || k === "dir" || k === "dep") weak.push([ e.from, e.to ]);
    }
    // an association only adds a row when it does not contradict the hierarchy (no cycle)
    const succ = new Map<number, number[]>();
    const add = ([ a, b ]: [number, number]): void => {
        succ.set(a, [ ...(succ.get(a) ?? []), b ]);
    };
    const reaches = (from: number, to: number): boolean => {
        const seen = new Set<number>(), stack = [ from ];
        while (stack.length) {
            const u = stack.pop()!;
            if (u === to) return true;
            if (seen.has(u)) continue;
            seen.add(u);
            stack.push(...(succ.get(u) ?? []));
        }
        return false;
    };
    strong.forEach(add);
    const edges = strong.slice();
    for (const [ a, b ] of weak) {
        if (reaches(b, a) || reaches(a, b)) continue;
        add([ a, b ]);
        edges.push([ a, b ]);
    }
    layeredParts(nodes, edges, (part, own) => layered(part, own, { gx: 80, gy: 90, top: true, tight: true }));
    return nodes;
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

/** Layers `tables` with the referenced table (1 side) above the one holding the foreign key; top left corner at (left, top). Mutates the nodes. */
export function arrangeTables(d: Diagram, tables: DiagramNode[], left: number, top: number): void {
    if (!tables.length) return;
    tables.forEach(fitToContent);
    const ids = new Set(tables.map(n => n.id));
    const many = (m?: string): boolean => /^(?:[nm*]|.*\.\.[nm*]|.*,\s*[nm*]\s*\))$/i.test(String(m ?? "").trim());
    const edges: [number, number][] = d.edges
        .filter(e => e.kind === "fk" && ids.has(e.from) && ids.has(e.to))
        .map(e => many(e.m1) && !many(e.m2) ? [ e.to, e.from ] : [ e.from, e.to ]);
    layered(tables, edges, { gx: 70, gy: 80, top: true });
    const dx = left - Math.min(...tables.map(n => n.x)), dy = top - Math.min(...tables.map(n => n.y));
    tables.forEach(n => {
        n.x = snap(n.x + dx);
        n.y = snap(n.y + dy);
    });
}

/** Table model: data tables at the top, below them the tables (see `arrangeTables`). */
function tidyTables(d: Diagram): DiagramNode[] | null {
    const tables = d.nodes.filter(n => n.type === "table"), sheets = d.nodes.filter(n => n.type === "sheet");
    if (!tables.length && !sheets.length) return null;
    const top = Math.min(...[ ...tables, ...sheets ].map(n => n.y)), left = Math.min(...[ ...tables, ...sheets ].map(n => n.x));
    let y = top;
    for (const s of sheets) {
        s.x = snap(left);
        s.y = snap(y);
        y += s.h + 50;
    }
    arrangeTables(d, tables, left, y);
    return [ ...sheets, ...tables ];
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

/** Several diagrams on one canvas end up side by side without overlapping; lines through shapes get detours. Mutates `d`. */
export function tidyDiagram(d: Diagram): void {
    arrangeGroups(d);
    routeAll(d);
}

/** Moves `group` so the top left corner of its bounding box stays where it was before the layout, so tidying twice changes nothing. */
function keepCorner(group: DiagramNode[], before: Map<number, Vec>): void {
    const old = group.map(n => before.get(n.id)).filter(p => p !== undefined);
    if (!old.length) return;
    const dx = snap(Math.min(...old.map(p => p[0])) - Math.min(...group.map(n => n.x)));
    const dy = snap(Math.min(...old.map(p => p[1])) - Math.min(...group.map(n => n.y)));
    group.forEach(n => {
        n.x += dx;
        n.y += dy;
    });
}

function arrangeGroups(d: Diagram): void {
    const groups: DiagramNode[][] = [];
    const before = new Map(d.nodes.map(n => [ n.id, [ n.x, n.y ] as Vec ]));
    for (const step of [ tidyActivities, tidyFlow, tidyUseCase, tidyClasses, tidySequence, tidyEr, tidyTables, tidyComponents, tidyDeployment, tidyPackages, tidyGeneric ]) {
        const group = step(d);
        if (!group?.length) continue;
        keepCorner(group, before);
        groups.push(group);
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
