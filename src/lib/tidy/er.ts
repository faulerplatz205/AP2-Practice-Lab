import type { Diagram, DiagramEdge, DiagramNode } from "../../types/diagram";
import { insideOutline, segmentTouches, segmentsCross, type Vec } from "../geometry";
import { snap } from "../math";
import { blockWidth } from "../textWidth";
import { attributeRow, extentWith, type Extent, type Obstacle, type Row, type Side } from "./erAttributes";
import { placeEntities, type EntityLink } from "./erGrid";

type Cell = Vec;

interface Geometry {
    /** Center of every placed node */
    at: Map<number, Vec>;
    /** Center of a fine grid cell, also outside the used range */
    cell: (i: number, j: number) => Vec;
    bottom: number;
}

interface Part extends Extent {
    rel: DiagramNode;
    rows: (Row | null)[];
    dx: number;
    dy: number;
}

const key = (c: Cell): string => `${c[0]},${c[1]}`;
const pairKey = (a: number, b: number): string => `${Math.min(a, b)}-${Math.max(a, b)}`;

/** Point where the n-th of several parallel lines between p and q bends (shared with the ER line routing). */
export function parallelBend(p: Vec, q: Vec, pFirst: boolean, index: number, count: number): Vec {
    const lo = pFirst ? p : q, hi = pFirst ? q : p;
    const len = Math.hypot(hi[0] - lo[0], hi[1] - lo[1]) || 1;
    const nx = -(hi[1] - lo[1]) / len, ny = (hi[0] - lo[0]) / len;
    const offset = (index - (count - 1) / 2) * Math.min(70, Math.max(40, len * 0.4));
    return [ (p[0] + q[0]) / 2 + nx * offset, (p[1] + q[1]) / 2 + ny * offset ];
}

function fitWidth(n: DiagramNode, size: number, weight: string, ratio: number, pad: number, cap: number): void {
    n.w = Math.max(n.w, snap(Math.min(cap, blockWidth(String(n.text ?? ""), size, weight) / ratio + pad)));
}

/**
 * ER model: entities on a grid so related entities are neighbours, relationships between them,
 * attributes in rows around their owner where no line runs. Mutates the nodes.
 */
export function tidyEr(d: Diagram): DiagramNode[] | null {
    const ents = d.nodes.filter(n => n.type === "entity");
    const rels = d.nodes.filter(n => n.type === "relship");
    const attrs = d.nodes.filter(n => n.type === "erattr");
    if (!ents.length && !rels.length) return null;
    // Time budgets only cap huge models; normal models get the same result every time
    const started = ents.length + rels.length > 40 ? performance.now() : Infinity;
    const oldCenter = new Map(d.nodes.map(n => [ n.id, n.x + n.w / 2 ]));
    const late = (ms: number): boolean => performance.now() - started > ms;
    const byId = new Map(d.nodes.map(n => [ n.id, n ]));
    const edges = d.edges.filter(e => byId.has(e.from) && byId.has(e.to) && e.from !== e.to);
    const neighbours = (id: number): DiagramNode[] => edges.filter(e => e.from === id || e.to === id).map(e => byId.get(e.from === id ? e.to : e.from)!);
    // laid out at the origin; tidyDiagram moves the result back to where the model was
    const ox = 0, oy = 0;

    ents.forEach(n => fitWidth(n, 14.5, "700", 1, 28, 320));
    rels.forEach(n => {
        fitWidth(n, 13.5, "600", 0.56, 12, 280);
        n.h = Math.max(n.h, snap(n.w * 0.5));
    });
    attrs.forEach(n => fitWidth(n, 13, n.stereo === "key" ? "700" : "500", 0.78, 10, 240));

    // Attributes belong to an entity (or relationship); attributes of attributes are composite parts
    const owner = new Map<number, number>(), kids = new Map<number, DiagramNode[]>(), own = new Map<number, DiagramNode[]>();
    [ ...ents, ...rels ].forEach(n => own.set(n.id, []));
    for (const a of attrs) {
        const nb = neighbours(a.id), o = nb.find(n => n.type === "entity") ?? nb.find(n => n.type === "relship");
        if (o) {
            owner.set(a.id, o.id);
            own.get(o.id)!.push(a);
        }
    }
    for (let changed = true; changed;) {
        changed = false;
        for (const a of attrs) {
            if (owner.has(a.id)) continue;
            const parent = neighbours(a.id).find(n => n.type === "erattr" && owner.has(n.id));
            if (!parent) continue;
            owner.set(a.id, owner.get(parent.id)!);
            kids.set(parent.id, [ ...(kids.get(parent.id) ?? []), a ]);
            changed = true;
        }
    }
    const orphans = attrs.filter(a => !owner.has(a.id));
    const sortAttrs = (list: DiagramNode[]): DiagramNode[] => list.slice().sort((a, b) => Number(b.stereo === "key") - Number(a.stereo === "key") || a.id - b.id);
    const parts = new Map(rels.map(r => [ r.id, [ ...new Set(neighbours(r.id).filter(n => n.type === "entity").map(n => n.id)) ]]));

    const links: EntityLink[] = [];
    for (const r of rels) {
        const u = parts.get(r.id)!;
        if (u.length === 2) links.push({ a: u[0], b: u[1], w: 1 });
        else for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) links.push({ a: u[i], b: u[j], w: 0.6 });
    }
    const coarse = placeEntities(ents.map(e => e.id).sort((a, b) => a - b), links, started);

    // Fine grid: entities on even cells, relationships in between
    const fine = new Map([ ...coarse ].map(([ id, p ]) => [ id, [ 2 * p[0], 2 * p[1] ] as Vec ]));
    const entityCells = new Set([ ...fine.values() ].map(key));
    const fixed = new Map<number, Cell>(), rest: DiagramNode[] = [];
    for (const r of rels) {
        const u = parts.get(r.id)!;
        const p = u.length === 2 ? fine.get(u[0])! : null, q = u.length === 2 ? fine.get(u[1])! : null;
        if (p && q && Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) === 2) fixed.set(r.id, [ (p[0] + q[0]) / 2, (p[1] + q[1]) / 2 ]);
        else rest.push(r);
    }

    const build = (cells: Map<number, Cell>, obstacles: Map<number, Obstacle[]>): Geometry => {
        const inCell = new Map<string, DiagramNode[]>();
        for (const r of rels) {
            const k = key(cells.get(r.id)!);
            inCell.set(k, [ ...(inCell.get(k) ?? []), r ]);
        }
        // sides of an entity already taken by relationship lines
        const used = new Map(ents.map(e => [ e.id, new Set<string>() ]));
        for (const r of rels) {
            const c = cells.get(r.id)!;
            for (const id of parts.get(r.id)!) {
                const p = fine.get(id)!, dx = c[0] - p[0], dy = c[1] - p[1], s = used.get(id)!;
                if (dx === 0) s.add(dy < 0 ? "top" : "bottom");
                if (dy === 0) s.add(dx < 0 ? "left" : "right");
                if (dx && dy) s.add(dy < 0 ? "up" : "down");
            }
        }
        const blocks = new Map<number, Extent & { rows: (Row | null)[] }>();
        for (const e of ents) {
            const list = sortAttrs(own.get(e.id)!), u = used.get(e.id)!;
            let top: DiagramNode[] = [], bottom: DiagramNode[] = [];
            if (list.length <= 3) ((u.has("top") || (u.has("up") && !u.has("down"))) && !u.has("bottom") ? bottom : top).push(...list);
            else {
                top = list.slice(0, Math.ceil(list.length / 2));
                bottom = list.slice(top.length);
            }
            const rows = [ attributeRow(e, top, "top", kids, obstacles.get(e.id)), attributeRow(e, bottom, "bottom", kids, obstacles.get(e.id)) ];
            blocks.set(e.id, { rows, ...extentWith(e, rows) });
        }
        const cellBlocks: (Extent & { i: number; j: number; parts: Part[] })[] = [];
        for (const [ k, list ] of inCell) {
            const [ i, j ] = k.split(",").map(Number), vertical = i % 2 === 0 && j % 2 !== 0, n = list.length;
            const cellParts: Part[] = list.map((r, idx) => {
                const side: Side = vertical
                    ? (n === 1 ? "right" : idx === 0 ? "left" : idx === n - 1 ? "right" : "top")
                    : (n === 1 || idx === 0 ? "top" : idx === n - 1 ? "bottom" : "right");
                const rows = [ attributeRow(r, sortAttrs(own.get(r.id)!), side, kids, obstacles.get(r.id)) ];
                return { rel: r, rows, dx: 0, dy: 0, ...extentWith(r, rows) };
            });
            let offset = 0;
            for (const p of cellParts) {
                if (vertical) {
                    p.dx = offset - p.l;
                    offset += p.r - p.l + 30;
                } else {
                    p.dy = offset - p.t;
                    offset += p.b - p.t + 30;
                }
            }
            const mean = cellParts.reduce((s, p) => s + (vertical ? p.dx : p.dy), 0) / n;
            cellParts.forEach(p => vertical ? p.dx -= mean : p.dy -= mean);
            cellBlocks.push({
                i, j, parts: cellParts,
                l: Math.min(...cellParts.map(p => p.dx + p.l)), r: Math.max(...cellParts.map(p => p.dx + p.r)),
                t: Math.min(...cellParts.map(p => p.dy + p.t)), b: Math.max(...cellParts.map(p => p.dy + p.b)),
            });
        }

        const all = [ ...fine.values(), ...cells.values() ];
        const i0 = Math.min(0, ...all.map(p => p[0])), j0 = Math.min(0, ...all.map(p => p[1]));
        const i1 = Math.max(0, ...all.map(p => p[0])), j1 = Math.max(0, ...all.map(p => p[1]));
        const colL: Record<number, number> = {}, colR: Record<number, number> = {}, rowT: Record<number, number> = {}, rowB: Record<number, number> = {};
        for (let i = i0; i <= i1; i++) colL[i] = colR[i] = i % 2 ? 45 : 0;
        for (let j = j0; j <= j1; j++) rowT[j] = rowB[j] = j % 2 ? 40 : 0;
        for (const e of ents) {
            const [ i, j ] = fine.get(e.id)!, b = blocks.get(e.id)!;
            colL[i] = Math.max(colL[i], -b.l);
            colR[i] = Math.max(colR[i], b.r);
            rowT[j] = Math.max(rowT[j], -b.t);
            rowB[j] = Math.max(rowB[j], b.b);
        }
        for (const b of cellBlocks) {
            const mx = b.i % 2 ? 64 : 24, my = b.j % 2 ? 51.2 : 24;
            colL[b.i] = Math.max(colL[b.i], -b.l + mx);
            colR[b.i] = Math.max(colR[b.i], b.r + mx);
            rowT[b.j] = Math.max(rowT[b.j], -b.t + my);
            rowB[b.j] = Math.max(rowB[b.j], b.b + my);
        }
        const cx: Record<number, number> = {}, cy: Record<number, number> = {};
        let x = ox, y = oy;
        for (let i = i0; i <= i1; i++) {
            cx[i] = snap(x + colL[i]);
            x += colL[i] + colR[i];
        }
        for (let j = j0; j <= j1; j++) {
            cy[j] = snap(y + rowT[j]);
            y += rowT[j] + rowB[j];
        }
        const at = new Map<number, Vec>();
        const placeRows = (rows: (Row | null)[], X: number, Y: number): void => {
            for (const row of rows) for (const p of row?.placed ?? []) at.set(p.n.id, [ X + p.x, Y + p.y ]);
        };
        for (const e of ents) {
            const [ i, j ] = fine.get(e.id)!;
            at.set(e.id, [ cx[i], cy[j] ]);
            placeRows(blocks.get(e.id)!.rows, cx[i], cy[j]);
        }
        for (const b of cellBlocks) {
            for (const p of b.parts) {
                at.set(p.rel.id, [ cx[b.i] + p.dx, cy[b.j] + p.dy ]);
                placeRows(p.rows, cx[b.i] + p.dx, cy[b.j] + p.dy);
            }
        }
        const right = x, below = y;
        return {
            at,
            cell: (i, j) => [ cx[i] ?? (i < i0 ? ox - 120 : right + 120), cy[j] ?? (j < j0 ? oy - 120 : below + 120) ],
            bottom: y,
        };
    };

    const duplicates = new Map<string, DiagramEdge[]>();
    for (const e of edges) duplicates.set(pairKey(e.from, e.to), [ ...(duplicates.get(pairKey(e.from, e.to)) ?? []), e ]);

    /** Line segments of relationship `r` placed at `p`, with the entity id each one leads to. */
    const relationSegments = (geo: Geometry, r: DiagramNode, p: Vec): [Vec, Vec, number][] => {
        const out: [Vec, Vec, number][] = [];
        for (const id of parts.get(r.id)!) {
            const q = geo.at.get(id)!, same = duplicates.get(pairKey(id, r.id)) ?? [];
            if (same.length < 2) {
                out.push([ q, p, id ]);
                continue;
            }
            same.forEach((_, k) => {
                const bend = parallelBend(q, p, id < r.id, k, same.length);
                out.push([ q, bend, id ], [ bend, p, id ]);
            });
        }
        return out;
    };

    /** Places everything for the given relationship cells; attributes avoid the lines of the previous round. */
    const solve = (cells: Map<number, Cell>): Geometry => {
        const obstacles = new Map<number, Obstacle[]>();
        const push = (id: number, o: Obstacle): void => void obstacles.set(id, [ ...(obstacles.get(id) ?? []), o ]);
        for (const r of rels) {
            const c = cells.get(r.id)!;
            for (const id of parts.get(r.id)!) {
                const p = fine.get(id)!, v: Vec = [ (c[0] - p[0]) * 1.6, c[1] - p[1] ], len = Math.hypot(v[0], v[1]) || 1;
                push(id, { own: true, p: [ 0, 0 ], q: [ v[0] / len * 3000, v[1] / len * 3000 ] });
                push(r.id, { own: true, p: [ 0, 0 ], q: [ -v[0] / len * 3000, -v[1] / len * 3000 ] });
            }
        }
        let geo = build(cells, obstacles);
        for (let round = 1; round < 4; round++) {
            obstacles.clear();
            const segments: { from: number; to: number; p: Vec; q: Vec; half?: 1 | 2 }[] = [];
            for (const r of rels) {
                const c = geo.at.get(r.id)!;
                for (const id of parts.get(r.id)!) {
                    const p = geo.at.get(id)!, same = edges.filter(x => (x.from === id && x.to === r.id) || (x.from === r.id && x.to === id));
                    if (same.length < 2) {
                        segments.push({ from: id, to: r.id, p, q: c });
                        continue;
                    }
                    same.forEach((_, k) => {
                        const bend = parallelBend(p, c, id < r.id, k, same.length);
                        segments.push({ from: id, to: r.id, p, q: bend, half: 1 }, { from: id, to: r.id, p: bend, q: c, half: 2 });
                    });
                }
            }
            for (const o of [ ...ents, ...rels ]) {
                if (!own.get(o.id)!.length) continue;
                const c = geo.at.get(o.id)!;
                const rel = (v: Vec): Vec => [ v[0] - c[0], v[1] - c[1] ];
                for (const s of segments) {
                    const mine = s.from === o.id || s.to === o.id;
                    if (mine && !s.half) {
                        push(o.id, { own: true, p: [ 0, 0 ], q: rel(s.from === o.id ? s.q : s.p) });
                        continue;
                    }
                    if (mine && ((s.half === 1 && s.from === o.id) || (s.half === 2 && s.to === o.id))) {
                        push(o.id, { own: true, p: [ 0, 0 ], q: rel(s.half === 1 ? s.q : s.p) });
                        continue;
                    }
                    const dx = s.q[0] - s.p[0], dy = s.q[1] - s.p[1];
                    const t = Math.max(0, Math.min(1, ((c[0] - s.p[0]) * dx + (c[1] - s.p[1]) * dy) / (dx * dx + dy * dy || 1)));
                    if (Math.hypot(s.p[0] + t * dx - c[0], s.p[1] + t * dy - c[1]) < 450) push(o.id, { own: false, p: rel(s.p), q: rel(s.q) });
                }
            }
            geo = build(cells, obstacles);
        }
        return geo;
    };

    const insideShape = (n: DiagramNode, c: Vec, x: number, y: number): boolean =>
        insideOutline(n.type === "relship" ? "diamond" : n.type === "erattr" ? "ellipse" : "rect", c[0], c[1], n.w / 2 + 10, n.h / 2 + 10, x, y);
    const segmentCache = new WeakMap<Geometry, Map<number, [Vec, Vec, number][]>>();
    const otherSegments = (geo: Geometry): Map<number, [Vec, Vec, number][]> => {
        let m = segmentCache.get(geo);
        if (!m) {
            m = new Map(rels.map(r => [ r.id, relationSegments(geo, r, geo.at.get(r.id)!) ]));
            segmentCache.set(geo, m);
        }
        return m;
    };
    /** Cost of the lines of `r` at `p`: through other shapes, across other lines, and their length. */
    const lineCost = (geo: Geometry, r: DiagramNode, p: Vec, skip: Set<number>, cap = Infinity): number => {
        let s = 0;
        for (const [ A, B, id ] of relationSegments(geo, r, p)) {
            if (s > cap) return s;
            const x0 = Math.min(A[0], B[0]), x1 = Math.max(A[0], B[0]), y0 = Math.min(A[1], B[1]), y1 = Math.max(A[1], B[1]);
            for (const [ nid, c ] of geo.at) {
                if (nid === id || skip.has(nid)) continue;
                const n = byId.get(nid)!;
                if (c[0] + n.w / 2 + 10 < x0 || c[0] - n.w / 2 - 10 > x1 || c[1] + n.h / 2 + 10 < y0 || c[1] - n.h / 2 - 10 > y1) continue;
                if (segmentTouches(A, B, (x, y) => insideShape(n, c, x, y), 6, 2)) s += n.type === "erattr" ? 150 : 220;
            }
            for (const [ rid, segs ] of otherSegments(geo)) {
                if (rid === r.id || skip.has(rid)) continue;
                for (const [ C, D, id2 ] of segs) if (id2 !== id && segmentsCross(A, B, C, D)) s += 60;
            }
            s += Math.hypot(B[0] - A[0], B[1] - A[1]) * 0.05;
        }
        return s;
    };

    const cells = new Map(fixed);
    const occupied = (c: Cell, me: number): boolean => entityCells.has(key(c)) || [ ...cells ].some(([ id, x ]) => id !== me && key(x) === key(c));
    const target = (r: DiagramNode): Vec | null => {
        const u = parts.get(r.id)!.map(id => fine.get(id)!);
        return u.length ? [ u.reduce((s, p) => s + p[0], 0) / u.length, u.reduce((s, p) => s + p[1], 0) / u.length ] : null;
    };
    for (const r of rest) {
        const u = parts.get(r.id)!.map(id => fine.get(id)!);
        const all = [ ...fine.values() ];
        const [ tx, ty ] = target(r) ?? [ all.length ? Math.max(...all.map(p => p[0])) + 2 : 0, 0 ];
        let best: Cell = [ Math.round(tx), Math.round(ty) ], bestScore = Infinity;
        for (let i = Math.floor(tx) - 3; i <= Math.ceil(tx) + 3; i++) {
            for (let j = Math.floor(ty) - 3; j <= Math.ceil(ty) + 3; j++) {
                if (occupied([ i, j ], r.id)) continue;
                let s = Math.hypot(i - tx, j - ty) * 10;
                for (const p of u) {
                    if (i !== p[0] && j !== p[1]) s += 14;
                    if (u.length === 1 && Math.abs(i - p[0]) + Math.abs(j - p[1]) > 1) s += 40;
                    if (u.length === 1 && i === p[0]) s += 25;
                }
                if (s < bestScore) {
                    bestScore = s;
                    best = [ i, j ];
                }
            }
        }
        cells.set(r.id, best);
    }
    for (let pass = 0; pass < 2 && rest.length && !late(4500); pass++) {
        const geo = solve(cells);
        for (const r of rest) {
            if (late(3800)) break;
            const t = target(r);
            if (!t) continue;
            const skip = new Set([ r.id, ...own.get(r.id)!.map(a => a.id) ]);
            let best = cells.get(r.id)!;
            let bestScore = lineCost(geo, r, geo.at.get(r.id)!, skip) + Math.hypot(best[0] - t[0], best[1] - t[1]) * 4;
            for (let i = Math.floor(t[0]) - 2; i <= Math.ceil(t[0]) + 2; i++) {
                for (let j = Math.floor(t[1]) - 2; j <= Math.ceil(t[1]) + 2; j++) {
                    if (occupied([ i, j ], r.id)) continue;
                    const p = geo.cell(i, j), distance = Math.hypot(i - t[0], j - t[1]) * 4;
                    if (distance >= bestScore) continue;
                    let s = distance + lineCost(geo, r, p, skip, bestScore - distance);
                    for (const [ nid, c ] of geo.at) {
                        if (skip.has(nid)) continue;
                        const n = byId.get(nid)!;
                        if (Math.abs(c[0] - p[0]) < (n.w + r.w) / 2 + 20 && Math.abs(c[1] - p[1]) < (n.h + r.h) / 2 + 20) {
                            s += 30;
                            break;
                        }
                    }
                    if (s < bestScore - 1) {
                        bestScore = s;
                        best = [ i, j ];
                    }
                }
            }
            cells.set(r.id, best);
        }
    }

    const geo = solve(cells);
    for (const [ id, [ X, Y ]] of geo.at) {
        const n = byId.get(id)!;
        n.x = Math.round(X - n.w / 2);
        n.y = Math.round(Y - n.h / 2);
    }
    mirrorToReadingOrder(d, ents, rels, parts, oldCenter);
    let x = Math.min(...[ ...ents, ...rels ].map(n => n.x));
    for (const a of orphans) {
        a.x = Math.round(x);
        a.y = Math.round(geo.bottom + 40);
        x += a.w + 20;
    }
    return [ ...ents, ...rels, ...attrs ];
}

const MANY = /^\s*[nm*]\s*$|\.\.\s*[nm*]\s*$/i;

/**
 * Mirrors the layout horizontally when that keeps more entity pairs in the order they were drawn
 * (and 1:n reading left to right). The result keeps that order, so a second tidy decides the same.
 */
function mirrorToReadingOrder(d: Diagram, ents: DiagramNode[], rels: DiagramNode[], parts: Map<number, number[]>, oldCenter: Map<number, number>): void {
    const byId = new Map(d.nodes.map(n => [ n.id, n ]));
    const cx = (id: number): number => byId.get(id)!.x + byId.get(id)!.w / 2;
    const label = (entity: number, rel: number): string => String(d.edges.find(e => (e.from === entity && e.to === rel) || (e.from === rel && e.to === entity))?.label ?? "");
    let keep = 0, flip = 0;
    for (const r of rels) {
        const u = parts.get(r.id)!;
        if (u.length !== 2) continue;
        const [ a, b ] = u, now = cx(b) - cx(a);
        if (Math.abs(now) < 1) continue;
        const before = oldCenter.get(b)! - oldCenter.get(a)!;
        if (Math.abs(before) >= 1) {
            if (Math.sign(before) === Math.sign(now)) keep += 2;
            else flip += 2;
        }
        const la = label(a, r.id).trim(), lb = label(b, r.id).trim();
        const want = la === "1" && MANY.test(lb) ? 1 : lb === "1" && MANY.test(la) ? -1 : 0;
        if (want === Math.sign(now)) keep++;
        else if (want) flip++;
    }
    if (flip <= keep) return;
    const nodes = [ ...ents, ...rels, ...d.nodes.filter(n => n.type === "erattr") ];
    const left = Math.min(...nodes.map(n => n.x)), right = Math.max(...nodes.map(n => n.x + n.w));
    nodes.forEach(n => n.x = left + right - n.x - n.w);
}
