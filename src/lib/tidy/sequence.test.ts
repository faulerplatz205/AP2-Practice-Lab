import { describe, expect, it } from "vitest";
import type { Diagram, DiagramEdge, DiagramNode, NodeType, RelationKind } from "../../types/diagram";
import { createNode, emptyDiagram } from "../diagram";
import { inside, overlaps } from "../geometry";
import { insertExample } from "../../data/examples";
import { runCheck } from "../check";
import { messageY } from "../uml/sequence";
import { tidyDiagram } from "./tidy";

function build(): { d: Diagram; node: (t: NodeType, more: Partial<DiagramNode>) => DiagramNode; msg: (a: DiagramNode, b: DiagramNode, k: RelationKind, y: number, label?: string) => DiagramEdge } {
    const d = emptyDiagram("seq");
    const node = (t: NodeType, more: Partial<DiagramNode>): DiagramNode => {
        const n = Object.assign(createNode(d, t, 0, 0), more);
        d.nodes.push(n);
        return n;
    };
    const msg = (a: DiagramNode, b: DiagramNode, kind: RelationKind, y: number, label = "f()"): DiagramEdge => {
        const e: DiagramEdge = { id: d.next++, from: a.id, to: b.id, label, kind, y: y - a.y };
        d.edges.push(e);
        return e;
    };
    return { d, node, msg };
}

/** Three lifelines (one of them created and destroyed), two fragments in a row, an alt with two operands, a self call. */
function complex(): Diagram {
    const { d, node, msg } = build();
    const a = node("lifeline", { x: 0, y: 30, h: 700, text: ":Kasse" });
    const b = node("lifeline", { x: 170, y: 0, h: 650, text: ":Lager" });
    const c = node("lifeline", { x: 420, y: 280, h: 220, text: ":Beleg" });
    msg(a, b, "msg", 100, "pruefe(artikel)");
    msg(b, b, "msg", 130, "zaehle()");
    msg(b, a, "reply", 200, "anzahl");
    const alt = node("fragment", { x: -20, y: 80, w: 330, h: 200, text: "alt", attrs: "[anzahl > 0]" });
    node("operand", { x: -20, y: 210, w: 330, h: 24, text: "[else]" });
    msg(b, a, "async", 250, "meldeLeer()");
    msg(a, c, "create", 300);
    const loop = node("fragment", { x: -20, y: 270, w: 600, h: 150, text: "loop", attrs: "(1,3)" });
    msg(a, c, "msg", 350, "drucke()");
    msg(c, a, "reply", 380, "ok");
    const x = node("destroy", { x: c.x + c.w / 2 - 12, y: 476 });
    msg(a, x, "msg", 488, "«destroy»");
    node("activation", { x: b.x + b.w / 2 - 7, y: 90, h: 120 });
    node("activation", { x: b.x + b.w / 2, y: 125, h: 40 });
    void alt;
    void loop;
    return d;
}

describe("tidy up a sequence diagram", () => {
    it("keeps the example correct", () => {
        const d = emptyDiagram("seq");
        insertExample(d, "sequence");
        tidyDiagram(d);
        expect(runCheck(d).items.filter(i => i.level !== "info").map(i => i.text)).toEqual([]);
    });

    it("lays out a complex diagram cleanly and keeps it correct", () => {
        const d = complex();
        const before = runCheck(d).items.filter(i => i.level !== "info").map(i => i.text);
        tidyDiagram(d);
        const byId = new Map(d.nodes.map(n => [ n.id, n ]));
        const y = (e: DiagramEdge): number => messageY(e, byId.get(e.from)!, byId.get(e.to)!);
        const [ a, b, c ] = d.nodes;
        // heads in one row except the created lifeline, which starts at its «create» message
        expect(a.y).toBe(b.y);
        const create = d.edges.find(e => e.kind === "create")!;
        expect(c.y + 20).toBe(y(create));
        // messages keep their order and do not crowd
        const ys = d.edges.map(y);
        for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(30);
        // fragments do not overlap, operands stay inside their fragment
        const [ alt, loop ] = d.nodes.filter(n => n.type === "fragment");
        expect(overlaps(alt, loop)).toBe(false);
        expect(inside(d.nodes.find(n => n.type === "operand")!, alt)).toBe(true);
        // the nested bar of the self call stays offset and inside the outer bar
        const [ outer, inner ] = d.nodes.filter(n => n.type === "activation");
        expect(inner.x).toBeGreaterThan(outer.x);
        expect(inner.y).toBeGreaterThanOrEqual(outer.y);
        // the destroyed lifeline ends at the X
        const cross = d.nodes.find(n => n.type === "destroy")!;
        expect(c.y + c.h).toBe(cross.y + cross.h);
        expect(runCheck(d).items.filter(i => i.level !== "info").map(i => i.text)).toEqual(before);
    });

    it("changes nothing when tidying twice", () => {
        const d = complex();
        tidyDiagram(d);
        const once = JSON.stringify(d.nodes.map(n => [ n.x, n.y, n.w, n.h ]));
        const edges = JSON.stringify(d.edges.map(e => e.y));
        tidyDiagram(d);
        expect(JSON.stringify(d.nodes.map(n => [ n.x, n.y, n.w, n.h ]))).toBe(once);
        expect(JSON.stringify(d.edges.map(e => e.y))).toBe(edges);
    });
});
