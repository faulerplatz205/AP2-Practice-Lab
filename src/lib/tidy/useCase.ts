import type { Diagram, DiagramNode } from "../../types/diagram";
import { snap } from "../math";
import { textWidth } from "../textWidth";

const GAP_X = 110, GAP_Y = 40, PAD = 50, TOP = 60, ACTOR_DISTANCE = 120;

/**
 * Use case: columns from base to dependent use case (include from the base, extend towards the base,
 * generalisation from child to parent), ordered to keep lines short. Actors stand left and right outside the boundary.
 */
export function tidyUseCase(d: Diagram): DiagramNode[] | null {
    // ties in the ordering depend on the positions before, so repeat until the layout no longer changes (tidying twice changes nothing)
    let before = "", group: DiagramNode[] | null = null;
    for (let round = 0; round < 4; round++) {
        group = tidyUseCaseOnce(d);
        const now = JSON.stringify(group?.map(n => [ n.x, n.y, n.w, n.h ]));
        if (now === before) break;
        before = now;
    }
    return group;
}

function tidyUseCaseOnce(d: Diagram): DiagramNode[] | null {
    const actors = d.nodes.filter(n => n.type === "actor"), cases = d.nodes.filter(n => n.type === "usecase");
    if (!cases.length && !actors.length) return null;
    const boundary = d.nodes.find(n => n.type === "boundary");
    const byId = new Map(d.nodes.map(n => [ n.id, n ]));
    const edges = d.edges.filter(e => byId.has(e.from) && byId.has(e.to) && e.from !== e.to);
    const neighbours = (n: DiagramNode): DiagramNode[] => edges.filter(e => e.from === n.id || e.to === n.id).map(e => byId.get(e.from === n.id ? e.to : e.from)!);

    const sorted = actors.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const left = sorted.slice(0, sorted.length > 1 ? Math.ceil(sorted.length / 2) : 1), right = sorted.slice(left.length);
    const side = (u: DiagramNode): "left" | "right" | null => {
        const a = neighbours(u).filter(x => x.type === "actor");
        if (a.some(x => left.includes(x))) return "left";
        return a.some(x => right.includes(x)) ? "right" : null;
    };
    cases.forEach(u => {
        const label = String(u.text);
        u.w = Math.max(150, snap(Math.max(label.length * 8.4, textWidth(label, 15)) + 60));
        u.h = 70;
    });

    const columns = caseColumns(cases, edges, byId, side);
    orderByNeighbours(columns, left, right, neighbours);

    const x0 = boundary ? boundary.x : Math.min(...cases.map(u => u.x), ...actors.map(a => a.x));
    const y0 = boundary ? boundary.y : Math.min(...cases.map(u => u.y), ...actors.map(a => a.y));
    const widths = columns.map(c => Math.max(150, ...c.map(u => u.w)));
    const heights = columns.map(c => c.reduce((s, u) => s + u.h, 0) + GAP_Y * (c.length - 1));
    const height = Math.max(70, ...heights);
    let x = x0 + PAD;
    columns.forEach((col, i) => {
        let y = y0 + TOP + (height - heights[i]) / 2;
        for (const u of col) {
            u.x = snap(x + widths[i] / 2) - u.w / 2;
            u.y = snap(y);
            y += u.h + GAP_Y;
        }
        x += widths[i] + GAP_X;
    });
    const bw = snap(x - GAP_X + PAD - x0), bh = snap(height + TOP + PAD);
    if (boundary) {
        boundary.w = bw;
        boundary.h = bh;
    }

    const actorY = (a: DiagramNode): number => {
        const u = neighbours(a).filter(x => x.type === "usecase");
        return u.length ? u.reduce((s, x) => s + x.y + x.h / 2, 0) / u.length : y0 + bh / 2;
    };
    const stackActors = (list: DiagramNode[], cx: number): void => {
        let last = -Infinity;
        for (const { a, y } of list.map(a => ({ a, y: actorY(a) })).sort((p, q) => p.y - q.y)) {
            a.x = snap(cx) - a.w / 2;
            a.y = snap(Math.max(y - a.h / 2, last + 30));
            last = a.y + a.h;
        }
    };
    const place = (): void => {
        stackActors(left, x0 - ACTOR_DISTANCE);
        stackActors(right, x0 + (boundary ? boundary.w : bw) + ACTOR_DISTANCE);
    };
    place();
    // an association is a straight line (knowledge base): a use case standing in its way moves down with the rest of its column
    for (let round = 0; round < 8; round++) {
        const hit = blocking(actors, cases, edges, byId);
        if (!hit) break;
        const col = columns.find(c => c.includes(hit))!;
        const dy = snap(hit.h + GAP_Y);
        for (const u of col.filter(u => u.y >= hit.y)) u.y += dy;
        if (boundary) boundary.h = Math.max(boundary.h, snap(Math.max(...cases.map(u => u.y + u.h)) + PAD - boundary.y));
        place();
    }
    return [ ...cases, ...actors, ...(boundary ? [ boundary ] : []) ];
}

const center = (n: DiagramNode): [number, number] => [ n.x + n.w / 2, n.y + n.h / 2 ];

/** The first use case that the straight line of an actor's association runs through, if any. */
function blocking(actors: DiagramNode[], cases: DiagramNode[], edges: Diagram["edges"], byId: Map<number, DiagramNode>): DiagramNode | undefined {
    for (const e of edges) {
        const a = byId.get(e.from)!, b = byId.get(e.to)!;
        const actor = actors.includes(a) ? a : actors.includes(b) ? b : null, uc = actor === a ? b : a;
        if (!actor || uc.type !== "usecase") continue;
        const [ px, py ] = center(actor), [ qx, qy ] = center(uc);
        for (const n of cases) {
            if (n === uc) continue;
            const [ cx, cy ] = center(n), rx = n.w / 2 + 6, ry = n.h / 2 + 6;
            for (let t = 0; t <= 1; t += 0.02) {
                const x = px + (qx - px) * t, y = py + (qy - py) * t;
                if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1) return n;
            }
        }
    }
    return undefined;
}

/** Column per dependency level; independent use cases of right actors get an extra column on the right. */
function caseColumns(
    cases: DiagramNode[],
    edges: Diagram["edges"],
    byId: Map<number, DiagramNode>,
    side: (u: DiagramNode) => "left" | "right" | null,
): DiagramNode[][] {
    const deps: [number, number][] = [];
    for (const e of edges) {
        if (byId.get(e.from)!.type !== "usecase" || byId.get(e.to)!.type !== "usecase") continue;
        deps.push(e.kind === "extend" ? [ e.to, e.from ] : [ e.from, e.to ]);
    }
    const level = new Map(cases.map(u => [ u.id, 0 ]));
    for (let round = 0; round < cases.length; round++) {
        let changed = false;
        for (const [ base, dependent ] of deps) {
            const next = level.get(base)! + 1;
            if (level.get(dependent)! < next && next <= cases.length) {
                level.set(dependent, next);
                changed = true;
            }
        }
        if (!changed) break;
    }
    const rightOnly = cases.filter(u => side(u) === "right" && level.get(u.id) === 0);
    if (rightOnly.length) {
        const last = Math.max(0, ...level.values()) + 1;
        rightOnly.forEach(u => level.set(u.id, last));
    }
    const columns: DiagramNode[][] = [];
    for (const u of cases) (columns[level.get(u.id)!] ??= []).push(u);
    return columns.filter(Boolean).map(c => c.sort((a, b) => a.y - b.y || a.x - b.x));
}

/** Barycenter sweeps: each element moves towards the mean position of its neighbours. */
function orderByNeighbours(columns: DiagramNode[][], left: DiagramNode[], right: DiagramNode[], neighbours: (n: DiagramNode) => DiagramNode[]): void {
    const rank = new Map<number, number>();
    const refresh = (): void => {
        for (const list of [ ...columns, left, right ]) list.forEach((n, i) => rank.set(n.id, i / Math.max(1, list.length - 1)));
    };
    const barycenter = (n: DiagramNode): number => {
        const ranked = neighbours(n).filter(m => m !== n && rank.has(m.id));
        return ranked.length ? ranked.reduce((s, m) => s + rank.get(m.id)!, 0) / ranked.length : rank.get(n.id)!;
    };
    const sweep = (col: DiagramNode[]): void => {
        const b = new Map(col.map(n => [ n.id, barycenter(n) ]));
        col.sort((p, q) => b.get(p.id)! - b.get(q.id)!);
        refresh();
    };
    refresh();
    for (let round = 0; round < 6; round++) {
        columns.forEach(sweep);
        columns.slice().reverse().forEach(sweep);
    }
}
