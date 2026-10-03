import type { DiagramNode } from "../../types/diagram";
import { centerX } from "../geometry";
import { snap } from "../math";

export interface LayeredOptions {
    /** Horizontal gap between nodes of a row */
    gx: number;
    /** Vertical gap between rows */
    gy: number;
    /** Align nodes at the top of the row instead of the middle */
    top?: boolean;
    /** In the last round, align under the first predecessor instead of the middle of all */
    first?: boolean;
    /** Adjust the ranks before the rows are built */
    pull?: (rank: Record<number, number>, pred: Record<number, number[]>, succ: Record<number, number[]>) => void;
}

export interface LayeredResult {
    rows: number[][];
    pred: Record<number, number[]>;
    succ: Record<number, number[]>;
}

/** Centers nodes on their wanted positions, keeping their order and without overlap. */
function placeRow(nodes: DiagramNode[], wanted: number[], gap: number): void {
    const xs = wanted.slice();
    for (let i = 1; i < nodes.length; i++) {
        const min = xs[i - 1] + nodes[i - 1].w / 2 + gap + nodes[i].w / 2;
        if (xs[i] < min) xs[i] = min;
    }
    for (let i = nodes.length - 2; i >= 0; i--) {
        const max = xs[i + 1] - nodes[i + 1].w / 2 - gap - nodes[i].w / 2;
        if (xs[i] > max) xs[i] = max;
    }
    // Move the group back to the center of the wanted positions
    const shift = (wanted.reduce((a, b) => a + b, 0) - xs.reduce((a, b) => a + b, 0)) / xs.length;
    nodes.forEach((n, i) => n.x = snap(xs[i] + shift) - n.w / 2);
}

/**
 * Layered layout (simple form of the Sugiyama method):
 * 1. Remove back edges so the graph has no cycle
 * 2. Rank = longest path from a source, gives the row
 * 3. Order within the rows by the barycenter heuristic, so few edges cross
 * 4. x position: every node centered under its predecessors, without overlap
 *
 * `edges` are pairs [from, to] in rank direction (from is above to). Changes the nodes in place.
 */
export function layered(nodes: DiagramNode[], edges: [number, number][], opt: LayeredOptions): LayeredResult {
    const byId = new Map(nodes.map(n => [ n.id, n ]));
    const node = (id: number): DiagramNode => byId.get(id)!;
    const ids = nodes.map(n => n.id);
    const succ: Record<number, number[]> = {}, pred: Record<number, number[]> = {};
    ids.forEach(i => {
        succ[i] = [];
        pred[i] = [];
    });
    for (const [ a, b ] of edges) {
        if (byId.has(a) && byId.has(b) && a !== b && !succ[a].includes(b)) {
            succ[a].push(b);
            pred[b].push(a);
        }
    }

    // 1. Find back edges by depth-first search
    const state: Record<number, number> = {}, back = new Set<string>();
    const dfs = (u: number): void => {
        state[u] = 1;
        for (const v of succ[u]) {
            if (state[v] === 1) back.add(`${u}>${v}`);
            else if (!state[v]) dfs(v);
        }
        state[u] = 2;
    };
    [ ...ids.filter(i => !pred[i].length), ...ids ].forEach(r => {
        if (!state[r]) dfs(r);
    });
    const fs: Record<number, number[]> = {}, fp: Record<number, number[]> = {};
    ids.forEach(i => {
        fs[i] = succ[i].filter(v => !back.has(`${i}>${v}`));
        fp[i] = pred[i].filter(u => !back.has(`${u}>${i}`));
    });

    // 2. Ranks
    const rank: Record<number, number> = {}, indeg: Record<number, number> = {};
    ids.forEach(i => {
        indeg[i] = fp[i].length;
        rank[i] = 0;
    });
    const queue = ids.filter(i => !indeg[i]).sort((a, b) => node(a).y - node(b).y || node(a).x - node(b).x);
    while (queue.length) {
        const u = queue.shift()!;
        for (const v of fs[u]) {
            rank[v] = Math.max(rank[v], rank[u] + 1);
            if (--indeg[v] === 0) queue.push(v);
        }
    }
    opt.pull?.(rank, fp, fs);
    const rows: number[][] = [];
    ids.forEach(i => (rows[rank[i]] ??= []).push(i));
    for (let r = 0; r < rows.length; r++) rows[r] ??= [];

    // 3. Order by barycenter
    rows.forEach(row => row.sort((a, b) => centerX(node(a)) - centerX(node(b))));
    const pos: Record<number, number> = {};
    const index = (): void => rows.forEach(row => row.forEach((id, i) => pos[id] = i));
    index();
    const barycenter = (list: number[], id: number): number => list.length ? list.reduce((x, u) => x + pos[u], 0) / list.length : pos[id];
    for (let sweep = 0; sweep < 4; sweep++) {
        for (let r = 1; r < rows.length; r++) {
            rows[r].sort((a, b) => barycenter(fp[a], a) - barycenter(fp[b], b));
            index();
        }
        for (let r = rows.length - 2; r >= 0; r--) {
            rows[r].sort((a, b) => barycenter(fs[a], a) - barycenter(fs[b], b));
            index();
        }
    }

    // 4. Coordinates
    const x0 = Math.min(...nodes.map(n => n.x)), y0 = Math.min(...nodes.map(n => n.y));
    let y = y0;
    for (const row of rows) {
        const h = Math.max(0, ...row.map(id => node(id).h));
        row.forEach(id => {
            const n = node(id);
            n.y = snap(y + (h - n.h) / 2 * (opt.top ? 0 : 1));
        });
        y += h + opt.gy;
    }
    const rowWidth = (row: number[]): number => row.reduce((a, id) => a + node(id).w, 0) + opt.gx * (row.length - 1);
    const maxWidth = Math.max(...rows.map(rowWidth));
    for (const row of rows) {
        let cx = x0 + (maxWidth - rowWidth(row)) / 2;
        for (const id of row) {
            node(id).x = cx;
            cx += node(id).w + opt.gx;
        }
    }
    const meanX = (list: number[], id: number): number => list.length ? list.reduce((a, u) => a + centerX(node(u)), 0) / list.length : centerX(node(id));
    for (let pass = 0; pass < 3; pass++) {
        for (let r = 1; r < rows.length; r++) placeRow(rows[r].map(node), rows[r].map(id => meanX(fp[id], id)), opt.gx);
        for (let r = rows.length - 2; r >= 0; r--) placeRow(rows[r].map(node), rows[r].map(id => meanX(fs[id], id)), opt.gx);
    }
    for (let r = 1; r < rows.length; r++) {
        placeRow(rows[r].map(node), rows[r].map(id => {
            if (!fp[id].length) return centerX(node(id));
            if (!opt.first) return meanX(fp[id], id);
            return centerX(node(fp[id].slice().sort((a, b) => pos[a] - pos[b])[0]));
        }), opt.gx);
    }
    return { rows, pred: fp, succ: fs };
}
