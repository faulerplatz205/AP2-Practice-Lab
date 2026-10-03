import type { ActivityNode, Diagram, DiagramEdge } from "../../types/diagram";
import { isActivity } from "../diagram";

export interface ActivityGraph {
    nodes: ActivityNode[];
    edges: DiagramEdge[];
    pred: Record<number, number[]>;
    succ: Record<number, number[]>;
    /** Activities in a valid order (predecessor before successor) */
    order: number[];
    /** true when the arrows form a cycle; `order` is incomplete then */
    cyclic: boolean;
    byId: Map<number, ActivityNode>;
}

export function buildGraph(d: Diagram): ActivityGraph {
    const nodes = d.nodes.filter(isActivity);
    const ids = new Set(nodes.map(n => n.id));
    const edges = d.edges.filter(e => ids.has(e.from) && ids.has(e.to));
    const pred: Record<number, number[]> = {}, succ: Record<number, number[]> = {}, indeg: Record<number, number> = {};
    nodes.forEach(n => {
        pred[n.id] = [];
        succ[n.id] = [];
    });
    edges.forEach(e => {
        pred[e.to].push(e.from);
        succ[e.from].push(e.to);
    });
    nodes.forEach(n => indeg[n.id] = pred[n.id].length);
    const order: number[] = [];
    const queue = nodes.filter(n => !indeg[n.id]).map(n => n.id);
    while (queue.length) {
        const id = queue.shift()!;
        order.push(id);
        succ[id].forEach(s => {
            if (--indeg[s] === 0) queue.push(s);
        });
    }
    return { nodes, edges, pred, succ, order, cyclic: order.length < nodes.length, byId: new Map(nodes.map(n => [ n.id, n ])) };
}

/** Is there a path from `from` to `to` that does not use the direct edge? */
export function reachableIndirectly(g: ActivityGraph, from: number, to: number): boolean {
    const stack = g.succ[from].filter(s => s !== to);
    const seen = new Set(stack);
    while (stack.length) {
        const u = stack.pop()!;
        for (const s of g.succ[u]) {
            if (s === to) return true;
            if (!seen.has(s)) {
                seen.add(s);
                stack.push(s);
            }
        }
    }
    return false;
}
