import type { Diagram, DiagramNode, NodeType } from "../../types/diagram";
import { inside } from "../geometry";
import { snap } from "../math";
import { lines } from "../uml/types";
import { layered, layeredParts, type LayeredOptions } from "./layered";

/** Containers whose content moves along with them. */
const CONTAINERS = new Set<NodeType>([ "node3d", "package" ]);

/** The innermost container around `n`, if any. */
function parentOf(d: Diagram, n: DiagramNode): DiagramNode | undefined {
    return d.nodes.filter(p => p !== n && CONTAINERS.has(p.type) && inside(n, p)).sort((a, b) => a.w * a.h - b.w * b.h)[0];
}

/** Everything drawn inside `box` (at any depth). */
function contentOf(d: Diagram, box: DiagramNode): DiagramNode[] {
    return d.nodes.filter(n => n !== box && inside(n, box));
}

function move(nodes: DiagramNode[], dx: number, dy: number): void {
    nodes.forEach(n => {
        n.x += dx;
        n.y += dy;
    });
}

/** `layered` from left to right: rows become columns. */
function layeredLeftToRight(nodes: DiagramNode[], edges: [number, number][], opt: LayeredOptions): void {
    const swap = (): void => nodes.forEach(n => {
        [ n.x, n.y, n.w, n.h ] = [ n.y, n.x, n.h, n.w ];
    });
    swap();
    layered(nodes, edges, opt);
    swap();
}

/** Lays out `nodes` and moves the content of every container along with it. */
function withContent(d: Diagram, nodes: DiagramNode[], layout: () => void): DiagramNode[] {
    const content = new Map(nodes.map(n => [ n.id, CONTAINERS.has(n.type) ? contentOf(d, n) : [] ]));
    const before = new Map(nodes.map(n => [ n.id, [ n.x, n.y ]]));
    layout();
    for (const n of nodes) {
        const [ x, y ] = before.get(n.id)!;
        move(content.get(n.id)!, n.x - x, n.y - y);
    }
    return [ ...nodes, ...nodes.flatMap(n => content.get(n.id)!) ];
}

/** Edges between the top-level `nodes`, with edges of contained elements counted for their outermost container. */
function topLevelEdges(d: Diagram, nodes: DiagramNode[], direction: (kind: string) => 1 | -1 | 0): [number, number][] {
    const ids = new Set(nodes.map(n => n.id)), byId = new Map(d.nodes.map(n => [ n.id, n ]));
    const top = (id: number): number | undefined => {
        let n = byId.get(id);
        while (n && !ids.has(n.id)) n = parentOf(d, n);
        return n?.id;
    };
    const out: [number, number][] = [];
    for (const e of d.edges) {
        const a = top(e.from), b = top(e.to), dir = direction(e.kind ?? "flow");
        if (a === undefined || b === undefined || a === b || !dir) continue;
        out.push(dir > 0 ? [ a, b ] : [ b, a ]);
    }
    return out;
}

/**
 * Component diagram from left to right: the component using an interface (dependency), the interface, the component
 * providing it (realisation or association). Elements inside a package or node keep their place in it.
 */
export function tidyComponents(d: Diagram): DiagramNode[] | null {
    const nodes = d.nodes.filter(n => (n.type === "component" || n.type === "iface") && !parentOf(d, n));
    if (!nodes.some(n => n.type === "component")) return null;
    const byId = new Map(d.nodes.map(n => [ n.id, n ]));
    const ids = new Set(nodes.map(n => n.id));
    const edges: [number, number][] = [];
    for (const e of d.edges) {
        if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) continue;
        const k = e.kind ?? "flow", a = byId.get(e.from)!, b = byId.get(e.to)!;
        // the user of an interface (dependency or socket) stands left of it
        if (k === "dep") edges.push([ e.from, e.to ]);
        else if (k === "require") edges.push(a.type === "iface" ? [ e.to, e.from ] : [ e.from, e.to ]);
        // the interface stands left of the component that provides it
        else if (k === "realize" || k === "assoc") edges.push(b.type === "iface" || a.type !== "iface" ? [ e.to, e.from ] : [ e.from, e.to ]);
    }
    // ports sit on the border of their component and move along with it
    const ports = new Map(nodes.filter(n => n.type === "component").map(c => [ c.id, d.nodes.filter(p => p.type === "port" && onBorder(p, c)) ]));
    const before = new Map(nodes.map(n => [ n.id, [ n.x, n.y ]]));
    layeredParts(nodes, edges, (part, own) => layeredLeftToRight(part, own, { gx: 70, gy: 90 }));
    for (const [ id, list ] of ports) {
        const c = byId.get(id)!, [ x, y ] = before.get(id)!;
        move(list, c.x - x, c.y - y);
    }
    // an interface at the height of the component providing it, so that line runs straight (when there is room)
    for (const [ from, to ] of edges) {
        const i = byId.get(from)!, provider = byId.get(to)!;
        if (i.type !== "iface" || provider.type !== "component" || edges.filter(e => e[0] === from).length !== 1) continue;
        const y = snap(provider.y + provider.h / 2 - i.h / 2);
        const free = nodes.every(n => n === i || n.x + n.w + 20 < i.x || n.x > i.x + i.w + 20 || n.y > y + i.h + 40 || n.y + n.h + 40 < y);
        if (free) i.y = y;
    }
    return [ ...nodes, ...[ ...ports.values() ].flat() ];
}

/** A port drawn on (or touching) the border of component `c`. */
export function onBorder(p: DiagramNode, c: DiagramNode): boolean {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, m = Math.max(p.w, p.h);
    const nearX = cx >= c.x - m && cx <= c.x + c.w + m, nearY = cy >= c.y - m && cy <= c.y + c.h + m;
    const onSide = Math.abs(cx - c.x) <= m || Math.abs(cx - c.x - c.w) <= m || Math.abs(cy - c.y) <= m || Math.abs(cy - c.y - c.h) <= m;
    return nearX && nearY && onSide;
}

const NODE_SIDE = 30, NODE_BOTTOM = 26, NODE_GAP = 24;

/** Stacks the direct content of a deployment node below its name and fits the node around it. Nested nodes first. */
function packNode(d: Diagram, node: DiagramNode): void {
    const content = contentOf(d, node);
    const direct = content.filter(n => parentOf(d, n) === node).sort((a, b) => a.y - b.y || a.x - b.x);
    for (const child of direct) if (child.type === "node3d") packNode(d, child);
    if (!direct.length) return;
    const head = 14 + 20 + 18 * (lines(node.text).length - 1) + 22;
    const width = Math.max(...direct.map(n => n.w));
    const inner = (n: DiagramNode): DiagramNode[] => n.type === "node3d" ? contentOf(d, n) : [];
    const kids = new Map(direct.map(n => [ n.id, inner(n) ]));
    node.w = Math.max(node.w < 100 ? 200 : 0, snap(width + 2 * NODE_SIDE + 14));
    let y = node.y + head;
    for (const n of direct) {
        const dx = snap(node.x + (node.w - 14 - n.w) / 2) - n.x, dy = snap(y) - n.y;
        n.x += dx;
        n.y += dy;
        move(kids.get(n.id)!, dx, dy);
        y = n.y + n.h + NODE_GAP;
    }
    node.h = snap(y - NODE_GAP + NODE_BOTTOM - node.y);
}

/** Deployment diagram: nodes from left to right along their communication paths, their artifacts stacked inside. */
export function tidyDeployment(d: Diagram): DiagramNode[] | null {
    const nodes = d.nodes.filter(n => n.type === "node3d" && !parentOf(d, n));
    if (!nodes.length) return null;
    nodes.forEach(n => packNode(d, n));
    // one height for all nodes, so they stand on one line and the communication paths run straight
    const height = Math.max(...nodes.map(n => n.h));
    nodes.forEach(n => n.h = height);
    // all nodes on one baseline at the top, so straight lines connect them
    const placed = withContent(d, nodes, () => layeredLeftToRight(nodes, topLevelEdges(d, nodes, k => k === "assoc" || k === "dep" || k === "deploy" ? 1 : 0), { gx: 60, gy: 120 }));
    // an artifact deployed by a «deploy» arrow from outside: below its node
    const below = new Map<number, number>();
    for (const a of d.nodes.filter(n => n.type === "artifact" && !parentOf(d, n))) {
        const e = d.edges.find(x => x.from === a.id && (x.kind === "deploy" || x.kind === "dep") && nodes.some(n => n.id === x.to));
        if (!e) continue;
        const node = nodes.find(n => n.id === e.to)!, y = below.get(node.id) ?? node.y + node.h + 60;
        a.x = snap(node.x + (node.w - 14 - a.w) / 2);
        a.y = snap(y);
        below.set(node.id, a.y + a.h + NODE_GAP);
        placed.push(a);
    }
    return placed;
}

/** Package diagram: the depending package above the one it depends on; content moves along. */
export function tidyPackages(d: Diagram): DiagramNode[] | null {
    const nodes = d.nodes.filter(n => n.type === "package" && !parentOf(d, n));
    if (!nodes.length) return null;
    const edges = topLevelEdges(d, nodes, k => [ "dep", "flow", "import", "access", "merge" ].includes(k) ? 1 : 0);
    return withContent(d, nodes, () => layeredParts(nodes, edges, (part, own) => layered(part, own, { gx: 80, gy: 90, top: true, tight: true })));
}

const GENERIC = new Set<NodeType>([ "rect", "ellipse", "diamond" ]);

/** General shapes connected by lines: from left to right like a flow chart. Loose shapes and texts stay. */
export function tidyGeneric(d: Diagram): DiagramNode[] | null {
    if (d.nodes.some(n => n.type === "np")) return null;
    const connected = new Set(d.edges.flatMap(e => [ e.from, e.to ]));
    const nodes = d.nodes.filter(n => GENERIC.has(n.type) && connected.has(n.id) && !parentOf(d, n));
    if (nodes.length < 2) return null;
    const ids = new Set(nodes.map(n => n.id));
    const edges = d.edges.filter(e => ids.has(e.from) && ids.has(e.to) && e.kind !== "anchor").map(e => [ e.from, e.to ] as [number, number]);
    layeredParts(nodes, edges, (part, own) => layeredLeftToRight(part, own, { gx: 50, gy: 80, first: true }));
    return nodes;
}
