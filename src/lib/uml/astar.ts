import type { Diagram, DiagramNode } from "../../types/diagram";
import { center, type Vec } from "../geometry";
import { isClear, obstacles, routeKey } from "./detour";
import { edgeGeometry, pathPoints, routeContext } from "./routing";

const CELL = 20, PAD = 14, MARGIN = 240;

/** Relations that "tidy up" may reroute; control flows and messages keep their own routing. */
const ROUTED = new Set([ "erl", "assoc", "dir", "inherit", "realize", "aggr", "comp", "dep", "include", "extend", "anchor", "fk" ]);

/** Cost of passing a world cell (key `"x,y"` in 20 px cells), so routes keep apart from existing lines. */
export type CellCost = Map<string, number>;

/** Binary min-heap of [priority, value]. */
class Heap {
    private items: [number, number][] = [];

    public get size(): number {
        return this.items.length;
    }

    public push(priority: number, value: number): void {
        const h = this.items;
        h.push([ priority, value ]);
        for (let i = h.length - 1; i > 0;) {
            const p = (i - 1) >> 1;
            if (h[p][0] <= h[i][0]) break;
            [ h[p], h[i] ] = [ h[i], h[p] ];
            i = p;
        }
    }

    public pop(): [number, number] {
        const h = this.items, top = h[0], last = h.pop()!;
        if (h.length) {
            h[0] = last;
            for (let i = 0; ;) {
                const l = 2 * i + 1, r = l + 1;
                let m = i;
                if (l < h.length && h[l][0] < h[m][0]) m = l;
                if (r < h.length && h[r][0] < h[m][0]) m = r;
                if (m === i) break;
                [ h[m], h[i] ] = [ h[i], h[m] ];
                i = m;
            }
        }
        return top;
    }
}

const DX = [ 1, 0, -1, 0 ], DY = [ 0, 1, 0, -1 ];

/**
 * Orthogonal route from `a` to `b` around all other shapes on a 20 px grid (A* with a penalty per bend).
 * Returns the corner points, or null when there is none or the drawing is too large.
 * With `cost`, cells near earlier routes are more expensive and the new route is added to it.
 */
export function findRoute(d: Diagram, a: DiagramNode, b: DiagramNode, cost?: CellCost): Vec[] | null {
    const minX = Math.min(...d.nodes.map(n => n.x)), minY = Math.min(...d.nodes.map(n => n.y));
    const x0 = minX - MARGIN, y0 = minY - MARGIN;
    const W = Math.ceil((Math.max(...d.nodes.map(n => n.x + n.w)) - minX + 2 * MARGIN) / CELL);
    const H = Math.ceil((Math.max(...d.nodes.map(n => n.y + n.h)) - minY + 2 * MARGIN) / CELL);
    if (W * H > 500000) return null;
    const middle = (c: number): Vec => [ x0 + (c % W) * CELL + CELL / 2, y0 + Math.floor(c / W) * CELL + CELL / 2 ];
    const worldKey = (c: number): string => middle(c).map(v => Math.floor(v / CELL)).join(",");

    const blocked = new Uint8Array(W * H);
    for (const n of obstacles(d, a, b)) {
        const i0 = Math.max(0, Math.floor((n.x - PAD - x0) / CELL)), i1 = Math.min(W - 1, Math.ceil((n.x + n.w + PAD - x0) / CELL));
        const j0 = Math.max(0, Math.floor((n.y - PAD - y0) / CELL)), j1 = Math.min(H - 1, Math.ceil((n.y + n.h + PAD - y0) / CELL));
        for (let j = j0; j <= j1; j++) {
            for (let i = i0; i <= i1; i++) {
                const [ cx, cy ] = middle(j * W + i);
                if (cx > n.x - PAD && cx < n.x + n.w + PAD && cy > n.y - PAD && cy < n.y + n.h + PAD) blocked[j * W + i] = 1;
            }
        }
    }
    const ca = center(a), cb = center(b);
    const cellOf = (p: Vec): number => Math.min(H - 1, Math.max(0, Math.floor((p[1] - y0) / CELL))) * W + Math.min(W - 1, Math.max(0, Math.floor((p[0] - x0) / CELL)));
    const start = cellOf(ca), goal = cellOf(cb);
    blocked[start] = blocked[goal] = 0;

    // state = cell * 4 + direction of arrival, so bends can be charged
    const g = new Float32Array(W * H * 4).fill(1e9), parent = new Int32Array(W * H * 4).fill(-1);
    const heuristic = (c: number): number => Math.abs((c % W) - (goal % W)) + Math.abs(Math.floor(c / W) - Math.floor(goal / W));
    const open = new Heap();
    for (let dir = 0; dir < 4; dir++) {
        g[start * 4 + dir] = 0;
        open.push(heuristic(start), start * 4 + dir);
    }
    let end = -1;
    for (let steps = 0; open.size && steps < 400000; steps++) {
        const [ f, state ] = open.pop(), c = state >> 2, dir = state & 3;
        if (f - heuristic(c) > g[state] + 1e-6) continue;
        if (c === goal) {
            end = state;
            break;
        }
        const x = c % W, y = Math.floor(c / W);
        for (let nd = 0; nd < 4; nd++) {
            if (nd === (dir + 2) % 4) continue;
            const nx = x + DX[nd], ny = y + DY[nd];
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || blocked[ny * W + nx]) continue;
            const nc = ny * W + nx, next = nc * 4 + nd;
            const ng = g[state] + 1 + (nd !== dir ? 4 : 0) + (cost?.get(worldKey(nc)) ?? 0);
            if (ng < g[next]) {
                g[next] = ng;
                parent[next] = state;
                open.push(ng + heuristic(nc), next);
            }
        }
    }
    if (end < 0) return null;

    const cells: number[] = [];
    for (let s = end; s >= 0; s = parent[s]) cells.push(s >> 2);
    cells.reverse();
    if (cost) {
        for (const c of cells) {
            const [ ix, iy ] = middle(c).map(v => Math.floor(v / CELL));
            cost.set(`${ix},${iy}`, 20);
            for (const [ dx, dy ] of [[ 1, 0 ], [ -1, 0 ], [ 0, 1 ], [ 0, -1 ]]) {
                const k = `${ix + dx},${iy + dy}`;
                cost.set(k, Math.max(cost.get(k) ?? 0, 6));
            }
        }
    }
    return corners(cells.map(middle), a, b, ca, cb);
}

/** Corner points of the cell path, aligned with the node centers and moved out of both nodes. */
function corners(path: Vec[], a: DiagramNode, b: DiagramNode, ca: Vec, cb: Vec): Vec[] | null {
    let out: Vec[] = [];
    for (let i = 1; i < path.length - 1; i++) {
        const [ p, q, r ] = [ path[i - 1], path[i], path[i + 1] ];
        if ((p[0] - q[0]) * (r[1] - q[1]) - (p[1] - q[1]) * (r[0] - q[0]) !== 0) out.push([ q[0], q[1] ]);
    }
    if (!out.length) return null;
    const first = out[0], last = out[out.length - 1];
    if (Math.abs(first[1] - path[0][1]) < 1) first[1] = ca[1];
    else first[0] = ca[0];
    if (Math.abs(last[1] - path[path.length - 1][1]) < 1) last[1] = cb[1];
    else last[0] = cb[0];

    const within = (n: DiagramNode, p: Vec): boolean => p[0] > n.x - 2 && p[0] < n.x + n.w + 2 && p[1] > n.y - 2 && p[1] < n.y + n.h + 2;
    /** First point on the way from `inner` to `outer` outside `n`, plus 14 px. */
    const leave = (n: DiagramNode, outer: Vec, inner: Vec): Vec => {
        for (let k = 0; k <= 60; k++) {
            const x = inner[0] + (outer[0] - inner[0]) * k / 60, y = inner[1] + (outer[1] - inner[1]) * k / 60;
            if (!within(n, [ x, y ])) {
                const len = Math.hypot(outer[0] - inner[0], outer[1] - inner[1]) || 1;
                return [ x + (outer[0] - inner[0]) / len * 14, y + (outer[1] - inner[1]) / len * 14 ];
            }
        }
        return outer;
    };
    if (within(a, out[0])) {
        let k = 0;
        while (k < out.length && within(a, out[k])) k++;
        out = [ leave(a, k < out.length ? out[k] : cb, out[k - 1]), ...out.slice(k) ];
    }
    if (out.length && within(b, out[out.length - 1])) {
        let k = out.length - 1;
        while (k >= 0 && within(b, out[k])) k--;
        out = [ ...out.slice(0, k + 1), leave(b, k >= 0 ? out[k] : ca, out[k + 1]) ];
    }
    return out;
}

/** Called by "tidy up": relations whose line runs through other shapes get a stored detour (`edge.route`). Mutates `d`. */
export function routeAll(d: Diagram): void {
    const byId = new Map(d.nodes.map(n => [ n.id, n ]));
    const started = performance.now();
    for (const e of d.edges) delete e.route;
    const ctx = routeContext(d), cost: CellCost = new Map(), paths = new Map<number, Vec[]>();
    for (const e of d.edges) {
        const a = byId.get(e.from), b = byId.get(e.to);
        if (!a || !b || a === b) continue;
        const points = pathPoints(edgeGeometry(d, e, a, b, ctx).d);
        paths.set(e.id, points);
        for (let k = 1; k < points.length; k++) markLine(cost, points[k - 1], points[k]);
    }
    for (const e of d.edges) {
        if (!ROUTED.has(e.kind ?? "flow") || performance.now() - started > 4000) continue;
        const a = byId.get(e.from), b = byId.get(e.to), points = paths.get(e.id) ?? [];
        if (!a || !b || a === b || points.length < 2 || isClear(d, a, b, points)) continue;
        const ws = findRoute(d, a, b, cost);
        if (ws) e.route = { key: routeKey(a, b), ws };
    }
}

function markLine(cost: CellCost, p: Vec, q: Vec): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 10));
    for (let k = 0; k <= steps; k++) {
        const key = `${Math.floor((p[0] + (q[0] - p[0]) * k / steps) / CELL)},${Math.floor((p[1] + (q[1] - p[1]) * k / steps) / CELL)}`;
        cost.set(key, Math.max(cost.get(key) ?? 0, 10));
    }
}
