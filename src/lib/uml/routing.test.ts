import { describe, expect, it } from "vitest";
import type { Diagram, DiagramNode } from "../../types/diagram";
import { createNode, emptyDiagram } from "../diagram";
import { segmentTouches, segmentsCross } from "../geometry";
import { findRoute, routeAll } from "./astar";
import { erLabelSpots, isClear } from "./detour";
import { edgeGeometry, pathPoints } from "./routing";
import { placeLabels } from "./labels";
import { insertExample } from "../../data/examples";

function inARow(): { d: Diagram; a: DiagramNode; block: DiagramNode; b: DiagramNode } {
    const d = emptyDiagram("kl");
    const [ a, block, b ] = [ 0, 300, 600 ].map(x => {
        const n = createNode(d, "class", x, 0);
        d.nodes.push(n);
        return n;
    });
    return { d, a, block, b };
}

describe("geometry helpers", () => {
    it("detects proper crossings only", () => {
        expect(segmentsCross([ 0, 0 ], [ 10, 10 ], [ 0, 10 ], [ 10, 0 ])).toBe(true);
        expect(segmentsCross([ 0, 0 ], [ 10, 0 ], [ 0, 5 ], [ 10, 5 ])).toBe(false);
        expect(segmentsCross([ 0, 0 ], [ 10, 0 ], [ 10, 0 ], [ 10, 10 ])).toBe(false);
    });

    it("samples a segment against a shape", () => {
        const box = (x: number, y: number): boolean => x > 40 && x < 60 && Math.abs(y) < 5;
        expect(segmentTouches([ 0, 0 ], [ 100, 0 ], box)).toBe(true);
        expect(segmentTouches([ 0, 20 ], [ 100, 20 ], box)).toBe(false);
    });
});

describe("routing", () => {
    it("bends an association around a class in the way", () => {
        const { d, a, b } = inARow();
        const e = { id: d.next++, from: a.id, to: b.id, label: "", kind: "assoc" as const };
        d.edges.push(e);
        const points = pathPoints(edgeGeometry(d, e, a, b).d);
        expect(points.length).toBeGreaterThan(2);
        expect(isClear(d, a, b, points)).toBe(true);
    });

    it("finds an A* route that avoids the blocking node", () => {
        const { d, a, b } = inARow();
        const ws = findRoute(d, a, b);
        expect(ws).not.toBeNull();
        expect(isClear(d, a, b, ws!)).toBe(true);
    });

    it("fans out two relations between the same classes", () => {
        const { d, a, block } = inARow();
        const e1 = { id: d.next++, from: a.id, to: block.id, label: "", kind: "assoc" as const };
        const e2 = { id: d.next++, from: a.id, to: block.id, label: "", kind: "dep" as const };
        d.edges.push(e1, e2);
        expect(edgeGeometry(d, e1, a, block).d).not.toBe(edgeGeometry(d, e2, a, block).d);
    });

    it("stores a route only where the straight line is blocked", () => {
        const { d, a, block, b } = inARow();
        d.edges.push({ id: d.next++, from: a.id, to: b.id, label: "", kind: "assoc" }, { id: d.next++, from: a.id, to: block.id, label: "", kind: "assoc" });
        routeAll(d);
        expect(d.edges[1].route).toBeUndefined();
    });

    it("keeps labels and multiplicities apart", () => {
        const { d, a, block } = inARow();
        d.edges.push({ id: d.next++, from: a.id, to: block.id, label: "kauft", kind: "assoc", m1: "1", m2: "*" });
        const boxes = [ ...placeLabels(d).values() ].map(l => l.box);
        for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
                const [ p, q ] = [ boxes[i], boxes[j] ];
                expect(p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3]).toBe(false);
            }
        }
    });
});

describe("ER cardinality", () => {
    it("sits next to the entity, not next to the diamond", () => {
        const points: [number, number][] = [[ 0, 0 ], [ 200, 0 ]];
        expect(erLabelSpots(points, false, true)[0].x).toBeLessThan(50);
        expect(erLabelSpots(points, true, false)[0].x).toBeGreaterThan(150);
    });

    it("is placed at the entity end in the ER example", () => {
        const d = emptyDiagram("er");
        insertExample(d, "er");
        const labels = placeLabels(d);
        const customer = d.nodes.find(n => n.type === "entity")!;
        const line = d.edges.find(e => e.from === customer.id && e.label === "1")!;
        const diamond = d.nodes.find(n => n.id === line.to)!;
        const at = labels.get(`label:${line.id}`)!;
        expect(at.x - (customer.x + customer.w)).toBeLessThan(diamond.x - at.x);
    });
});
