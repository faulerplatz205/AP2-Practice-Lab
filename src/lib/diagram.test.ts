import { describe, expect, it } from "vitest";
import type { Diagram } from "../types/diagram";
import { createNode, emptyDiagram, normalize, parsePlanFile } from "./diagram";

function plan(): string {
    const d = emptyDiagram("kl");
    const a = createNode(d, "class", 0, 0), b = createNode(d, "class", 300, 0);
    d.nodes.push(a, b);
    d.edges.push({ id: d.next++, from: a.id, to: b.id, label: "", kind: "assoc" });
    return JSON.stringify({ app: "AP2 Practice Lab", version: 1, ...d });
}

describe("parsePlanFile", () => {
    it("reads an exported plan and drops app and version", () => {
        const result = parsePlanFile(plan());
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.dropped).toBe(0);
        expect(result.diagram.nodes).toHaveLength(2);
        expect(result.diagram.edges).toHaveLength(1);
        expect(result.diagram.cfg.mode).toBe("kl");
        expect(result.diagram).not.toHaveProperty("app");
        expect(result.diagram).not.toHaveProperty("version");
    });

    it("tells broken JSON apart from JSON that is no plan", () => {
        expect(parsePlanFile("{kaputt")).toEqual({ ok: false, reason: "json" });
        expect(parsePlanFile("[1, 2]")).toEqual({ ok: false, reason: "shape" });
        expect(parsePlanFile("{\"nodes\": []}")).toEqual({ ok: false, reason: "shape" });
        expect(parsePlanFile("null")).toEqual({ ok: false, reason: "shape" });
    });

    it("rejects a file whose nodes are all unusable", () => {
        expect(parsePlanFile(JSON.stringify({ nodes: [{ id: 1, type: "spaceship", x: 0, y: 0 }], edges: [] }))).toEqual({ ok: false, reason: "shape" });
    });

    it("accepts an empty plan", () => {
        const result = parsePlanFile(JSON.stringify({ nodes: [], edges: [], cfg: { mode: "er" } }));
        expect(result.ok && result.diagram.cfg.mode).toBe("er");
    });

    it("skips broken nodes and edges and counts them", () => {
        const data = JSON.parse(plan()) as { nodes: unknown[]; edges: unknown[] };
        data.nodes.push({ id: 50, type: "class" }, { id: 1, type: "class", x: 0, y: 0, w: 10, h: 10, fill: 0, text: "dup" }, "text");
        data.edges.push({ id: 60, from: 1, to: 999, label: "" }, { id: 61, from: 1, to: 2, label: "", kind: "teleport" });
        const result = parsePlanFile(JSON.stringify(data));
        expect(result.ok && result.dropped).toBe(5);
        expect(result.ok && result.diagram.nodes.map(n => n.text)).not.toContain("dup");
    });
});

describe("normalize", () => {
    it("returns valid nodes and edges unchanged", () => {
        const d = JSON.parse(plan()) as Diagram;
        const out = normalize(d);
        expect(out.nodes[0]).toBe(d.nodes[0]);
        expect(out.edges[0]).toBe(d.edges[0]);
    });

    it("fills in missing size, fill, text, label and activity fields", () => {
        const out = normalize({ nodes: [{ id: 3, type: "np", x: 0, y: 0 }, { id: 4, type: "rect", x: 0, y: 0, text: 7 }], edges: [{ id: 5, from: 3, to: 4 }] });
        expect(out.nodes[0]).toMatchObject({ w: 200, h: 120, fill: 0, text: "" });
        expect(out.nodes[0].f?.nr).toBe("");
        expect(out.nodes[1].text).toBe("");
        expect(out.edges[0].label).toBe("");
        expect(out.next).toBe(6);
    });

    it("survives anything that is not a plan", () => {
        for (const raw of [ null, 42, "x", [], { nodes: "no" }]) expect(normalize(raw).nodes).toEqual([]);
    });
});

describe("normalize broken files", () => {
    it("drops a malformed exercise and fixes numeric multiplicities", () => {
        const out = normalize({ nodes: [{ id: 1, type: "class", x: 0, y: 0 }, { id: 2, type: "class", x: 0, y: 200 }], edges: [{ id: 3, from: 1, to: 2, kind: "assoc", m1: 1, m2: 5, route: 7, y: "x" }], task: {} });
        expect(out.task).toBeUndefined();
        expect(out.edges[0]).toMatchObject({ m1: "1", m2: "5" });
        expect(out.edges[0].route).toBeUndefined();
        expect(out.edges[0].y).toBeUndefined();
    });
});
