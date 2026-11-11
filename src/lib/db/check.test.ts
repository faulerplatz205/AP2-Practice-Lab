import { describe, expect, it } from "vitest";
import type { Diagram, DiagramNode, NodeType } from "../../types/diagram";
import { createNode, emptyDiagram } from "../diagram";
import { checkUml } from "../uml/check";

function node(d: Diagram, type: NodeType, text: string, stereo = "", x = 0, y = 0): DiagramNode {
    const n = { ...createNode(d, type), x, y, text, stereo } as DiagramNode;
    d.nodes.push(n);
    return n;
}

function line(d: Diagram, a: DiagramNode, b: DiagramNode, label = ""): void {
    d.edges.push({ id: d.next++, from: a.id, to: b.id, label, kind: "erl" });
}

/** Rechnung 1 —<<enthält>>— n Position (weak, partial key PosNr) */
function invoice(weak = "weak", rel = "ident", key = "partial"): Diagram {
    const d = emptyDiagram("er");
    const owner = node(d, "entity", "Rechnung", "", 0, 0), pos = node(d, "entity", "Position", weak, 400, 0);
    const r = node(d, "relship", "enthält", rel, 200, 0);
    line(d, owner, r, "1");
    line(d, r, pos, "n");
    line(d, node(d, "erattr", "RechNr", "key", 0, -100), owner);
    line(d, node(d, "erattr", "PosNr", key, 400, -100), pos);
    return d;
}

const texts = (d: Diagram): string[] => checkUml(d).items.filter(i => i.level !== "ok").map(i => i.text);

describe("weak entities (Chen)", () => {
    it("accepts a weak entity with a partial key on an identifying relationship", () => {
        expect(texts(invoice())).toEqual([]);
    });
    it("needs the identifying relationship", () => {
        expect(texts(invoice("weak", "")).join()).toMatch(/identifizierenden/);
    });
    it("rejects a key of its own and a partial key on a normal entity", () => {
        expect(texts(invoice("weak", "ident", "key")).join()).toMatch(/eigenen Schlüssel/);
        expect(texts(invoice("", "", "partial")).join()).toMatch(/Partieller Schlüssel/);
    });
    it("warns about an identifying relationship without a weak entity", () => {
        expect(texts(invoice("", "ident", "key")).join()).toMatch(/ohne schwache Entität/);
    });
});
