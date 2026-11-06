import { segmentsCross, type Vec } from "../geometry";

/** Two entities joined by a relationship; n-ary relationships give a weaker link per pair. */
export interface EntityLink {
    a: number;
    b: number;
    w: number;
}

const key = (c: Vec): string => `${c[0]},${c[1]}`;

/**
 * Places entities on a coarse grid so that linked entities are neighbours, lines do not cross or run
 * through other entities and the result is roughly landscape. Tries several start orders within a time budget.
 * Returns compact cell coordinates (0, 1, 2 … per column and row).
 */
export function placeEntities(ids: number[], links: EntityLink[], started: number): Map<number, Vec> {
    const grid = new Grid(links);
    const late = (ms: number): boolean => performance.now() - started > ms;
    const degree = new Map(ids.map(id => [ id, 0 ]));
    for (const l of links) {
        degree.set(l.a, degree.get(l.a)! + l.w);
        degree.set(l.b, degree.get(l.b)! + l.w);
    }
    let seed = 7;
    const random = (): number => (seed = seed * 16807 % 2147483647) / 2147483647;
    const byDegree = ids.slice().sort((a, b) => degree.get(b)! - degree.get(a)!);
    const tries = ids.length > 30 ? 1 : ids.length > 16 ? 3 : ids.length > 10 ? 8 : 14;
    let best: Map<number, Vec> | null = null, bestScore = Infinity;
    for (let t = 0; t < tries && (t === 0 || !late(1300)); t++) {
        const order = t === 0 ? byDegree
            : t === 1 ? [ ...byDegree.slice(1), byDegree[0] ]
                : t % 2 ? shuffled(byDegree, () => -random())
                    : shuffled(byDegree, id => -(degree.get(id)! + random() * 3));
        grid.greedy(order, t > 1 ? random : null);
        if (ids.length <= 40) grid.climb(ids, () => late(1600));
        const s = grid.score();
        if (s < bestScore) {
            bestScore = s;
            best = new Map(grid.pos);
        }
    }
    return compact(best ?? new Map<number, Vec>());
}

function shuffled(ids: number[], weight: (id: number) => number): number[] {
    return ids.map(id => [ id, weight(id) ] as const).sort((a, b) => a[1] - b[1]).map(x => x[0]);
}

/** Removes empty columns and rows. */
function compact(pos: Map<number, Vec>): Map<number, Vec> {
    const xs = [ ...new Set([ ...pos.values() ].map(p => p[0])) ].sort((a, b) => a - b);
    const ys = [ ...new Set([ ...pos.values() ].map(p => p[1])) ].sort((a, b) => a - b);
    return new Map([ ...pos ].map(([ id, p ]) => [ id, [ xs.indexOf(p[0]), ys.indexOf(p[1]) ]]));
}

class Grid {
    public pos = new Map<number, Vec>();
    private cells = new Map<string, number>();

    constructor(private readonly links: EntityLink[]) {}

    public put(id: number, c: Vec): void {
        this.pos.set(id, c);
        this.cells.set(key(c), id);
    }

    public take(id: number): void {
        const c = this.pos.get(id);
        if (c) this.cells.delete(key(c));
        this.pos.delete(id);
    }

    public bounds(): [number, number, number, number] {
        if (!this.pos.size) return [ 0, 0, 0, 0 ];
        const all = [ ...this.pos.values() ];
        return [ Math.min(...all.map(p => p[0])), Math.min(...all.map(p => p[1])), Math.max(...all.map(p => p[0])), Math.max(...all.map(p => p[1])) ];
    }

    /** Lower is better: long and diagonal links, links through occupied cells, crossings, area and extreme aspect ratios cost. */
    public score(): number {
        const placed = this.links.filter(l => this.pos.has(l.a) && this.pos.has(l.b));
        let s = 0;
        for (const l of placed) s += l.w * this.linkCost(this.pos.get(l.a)!, this.pos.get(l.b)!);
        for (let i = 0; i < placed.length; i++) {
            for (let j = i + 1; j < placed.length; j++) {
                const A = placed[i], B = placed[j];
                if (A.a === B.a || A.a === B.b || A.b === B.a || A.b === B.b) continue;
                if (segmentsCross(this.pos.get(A.a)!, this.pos.get(A.b)!, this.pos.get(B.a)!, this.pos.get(B.b)!)) s += 100;
            }
        }
        const [ x0, y0, x1, y1 ] = this.bounds(), w = x1 - x0 + 1, h = y1 - y0 + 1;
        return s + 4 * (w + h) + 0.5 * w * h + 4 * Math.max(0, w - 3 * h) + 4 * Math.max(0, h - 1.3 * w);
    }

    private linkCost(p: Vec, q: Vec): number {
        const dx = q[0] - p[0], dy = q[1] - p[1], distance = Math.abs(dx) + Math.abs(dy);
        if (distance <= 1) return 0;
        let cost = 30 * (distance - 1);
        if (dx && dy) {
            cost += 50;
            const len = Math.hypot(dx, dy);
            for (const [ k ] of this.cells) {
                const [ i, j ] = k.split(",").map(Number);
                if ((i === p[0] && j === p[1]) || (i === q[0] && j === q[1])) continue;
                const t = ((i - p[0]) * dx + (j - p[1]) * dy) / (len * len);
                if (t > 0 && t < 1 && Math.abs((i - p[0]) * dy - (j - p[1]) * dx) / len < 0.6) cost += 130;
            }
        } else {
            for (let k = 1; k < distance; k++) if (this.cells.has(key([ p[0] + Math.sign(dx) * k, p[1] + Math.sign(dy) * k ]))) cost += 150;
        }
        return cost;
    }

    private neighbours(id: number): number[] {
        const weight = new Map<number, number>();
        for (const l of this.links) {
            if (l.a === id) weight.set(l.b, (weight.get(l.b) ?? 0) + l.w);
            if (l.b === id) weight.set(l.a, (weight.get(l.a) ?? 0) + l.w);
        }
        return [ ...weight ].sort((a, b) => b[1] - a[1]).map(x => x[0]);
    }

    /** Breadth-first from each unplaced entity: every neighbour takes the best free cell within two steps. */
    public greedy(order: number[], jitter: (() => number) | null): void {
        this.pos = new Map();
        this.cells = new Map();
        for (const root of order) {
            if (this.pos.has(root)) continue;
            if (!this.pos.size) this.put(root, [ 0, 0 ]);
            else {
                const [ , y0, x1 ] = this.bounds();
                this.put(root, [ x1 + 1, y0 ]);
            }
            const queue = [ root ];
            while (queue.length) {
                const u = queue.shift()!;
                const next = jitter ? shuffled(this.neighbours(u), () => jitter()) : this.neighbours(u);
                for (const v of next) {
                    if (this.pos.has(v)) continue;
                    const pu = this.pos.get(u)!;
                    let best: Vec | null = null, bestScore = Infinity;
                    for (let i = pu[0] - 2; i <= pu[0] + 2; i++) {
                        for (let j = pu[1] - 2; j <= pu[1] + 2; j++) {
                            if (this.cells.has(key([ i, j ]))) continue;
                            this.put(v, [ i, j ]);
                            const s = this.score() + 0.5 * (Math.abs(i - pu[0]) + Math.abs(j - pu[1]));
                            this.take(v);
                            if (s < bestScore) {
                                bestScore = s;
                                best = [ i, j ];
                            }
                        }
                    }
                    this.put(v, best!);
                    queue.push(v);
                }
            }
        }
    }

    /** Hill climbing: moves (or swaps) single entities while the score improves. */
    public climb(ids: number[], late: () => boolean): void {
        for (let round = 0; round < 12 && !late(); round++) {
            let improved = false;
            for (const id of ids) {
                const current = this.pos.get(id)!;
                let best: Vec | null = null, bestScore = this.score() - 0.5;
                for (const c of this.candidates(id, ids.length)) {
                    if (c[0] === current[0] && c[1] === current[1]) continue;
                    this.move(id, current, c);
                    const s = this.score();
                    this.move(id, c, current);
                    if (s < bestScore) {
                        bestScore = s;
                        best = c;
                    }
                }
                if (best) {
                    this.move(id, current, best);
                    improved = true;
                }
            }
            if (!improved) break;
        }
    }

    /** Small drawings try every cell around the grid, larger ones only cells next to the entity and its neighbours. */
    private candidates(id: number, count: number): Vec[] {
        const out = new Map<string, Vec>();
        const add = (c: Vec): void => void out.set(key(c), c);
        if (count <= 16) {
            const [ x0, y0, x1, y1 ] = this.bounds();
            for (let i = x0 - 1; i <= x1 + 1; i++) for (let j = y0 - 1; j <= y1 + 1; j++) add([ i, j ]);
        } else {
            for (const v of [ id, ...this.neighbours(id) ]) {
                const p = this.pos.get(v);
                if (p) for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) add([ p[0] + di, p[1] + dj ]);
            }
        }
        return [ ...out.values() ];
    }

    /** Moves `id` from `from` to `to`; an entity already at `to` swaps to `from`. */
    private move(id: number, from: Vec, to: Vec): void {
        const other = this.cells.get(key(to));
        this.take(id);
        if (other !== undefined) {
            this.take(other);
            this.put(other, from);
        }
        this.put(id, to);
    }
}
