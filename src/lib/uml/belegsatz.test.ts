import { describe, expect, it } from "vitest";
import type { Diagram, DiagramNode, NodeType, RelationKind } from "../../types/diagram";
import { createNode, emptyDiagram, normalize } from "../diagram";
import { runCheck } from "../check";
import { useLocale } from "../../i18n/locale";
import { edgeGeometry, pathPoints } from "./routing";
import { classLayout, fitToContent } from "./size";
import { fieldAt } from "./fields";

useLocale.setState({ locale: "de" });

/** Elements of the IHK Belegsatz that go beyond the basic shapes. */
function build(mode: Diagram["cfg"]["mode"]): { d: Diagram; node: (type: NodeType, x: number, y: number, more?: Partial<DiagramNode>) => DiagramNode; edge: (a: DiagramNode, b: DiagramNode, kind: RelationKind) => number } {
    const d = emptyDiagram(mode);
    return {
        d,
        node: (type, x, y, more = {}): DiagramNode => {
            const n = Object.assign(createNode(d, type, x, y), more);
            d.nodes.push(n);
            return n;
        },
        edge: (a, b, kind): number => {
            const id = d.next++;
            d.edges.push({ id, from: a.id, to: b.id, label: "", kind });
            return id;
        },
    };
}

describe("activity diagram connector", () => {
    const flow = (second = "A"): Diagram => {
        const s = build("akt");
        const start = s.node("start", 0, 0), one = s.node("action", 0, 100, { text: "Schritt 1" }), out = s.node("connector", 200, 100, { text: "A" });
        const back = s.node("connector", 0, 300, { text: second }), two = s.node("action", 200, 300, { text: "Schritt 2" }), end = s.node("end", 400, 300);
        s.edge(start, one, "flow");
        s.edge(one, out, "flow");
        s.edge(back, two, "flow");
        s.edge(two, end, "flow");
        return s.d;
    };

    it("accepts a pair with the same letter and follows the jump", () => {
        const r = runCheck(flow());
        expect(r.items.filter(i => i.level !== "ok").map(i => i.text)).toEqual([]);
        expect(r.ok).toBe(true);
    });

    it("finds a connector without a counterpart or with too many arrows", () => {
        const texts = runCheck(flow("B")).items.map(i => i.text);
        expect(texts.filter(x => x.includes("hat kein Gegenstück")).length).toBe(2);
        const d = flow();
        const [ out, back ] = d.nodes.filter(n => n.type === "connector");
        d.edges.push({ id: d.next++, from: out.id, to: back.id, label: "", kind: "flow" });
        expect(runCheck(d).items.some(i => i.text.includes("braucht genau einen Pfeil"))).toBe(true);
    });
});

describe("class without compartments, abstract class", () => {
    it("draws a class without attributes and methods as a plain box", () => {
        const s = build("kl");
        const plain = s.node("class", 0, 0, { text: "Klasse", attrs: "", ops: "" });
        const L = classLayout(plain);
        expect([ L.attrsH, L.opsH, L.total ]).toEqual([ 0, 0, 44 ]);
        expect(fieldAt(plain, { x: plain.x + 10, y: plain.y + 40 })?.key).toBe("text");
        plain.attrs = "- name : String";
        expect(classLayout(plain).attrsH).toBeGreaterThan(0);
    });

    it("leaves room for {abstract} below the name", () => {
        const s = build("kl");
        expect(classLayout(s.node("class", 0, 0, { stereo: "abstract" })).headerH).toBe(42);
    });
});

describe("use case with extension points, note on a line", () => {
    it("grows a use case with its extension points and edits them below the line", () => {
        const s = build("uc");
        const u = s.node("usecase", 200, 200, { text: "Platz reservieren", attrs: "Sonderwünsche\nFirmenkunde" });
        fitToContent(u);
        expect(u.h).toBeGreaterThanOrEqual(114);
        expect(fieldAt(u, { x: u.x + u.w / 2, y: u.y + u.h - 20 })?.key).toBe("attrs");
        expect(fieldAt(u, { x: u.x + u.w / 2, y: u.y + 10 })?.key).toBe("text");
    });

    it("ends the anchor of a note in the middle of its line and survives a reload", () => {
        const s = build("uc");
        const base = s.node("usecase", 200, 100, { text: "Platz reservieren" }), extra = s.node("usecase", 200, 400, { text: "Sonderwünsche angeben" });
        const note = s.node("note", 500, 250, { text: "Wenn Sonderwünsche vorhanden" });
        const line = s.edge(extra, base, "extend");
        s.d.edges.push({ id: s.d.next++, from: note.id, to: extra.id, label: "", kind: "anchor", on: line });
        const d = normalize(structuredClone(s.d));
        const anchor = d.edges[1], find = (id: number): DiagramNode => d.nodes.find(n => n.id === id)!;
        expect(anchor.on).toBe(line);
        const target = pathPoints(edgeGeometry(d, d.edges[0], find(extra.id), find(base.id)).d);
        const g = edgeGeometry(d, anchor, find(note.id), find(extra.id));
        const ys = target.map(p => p[1]);
        expect(g.t[1]).toBeGreaterThan(Math.min(...ys));
        expect(g.t[1]).toBeLessThan(Math.max(...ys));
        expect(Math.abs(g.t[0] - (target[0][0] + target[target.length - 1][0]) / 2)).toBeLessThan(40);
        expect(runCheck(d).items.filter(i => i.level === "error")).toEqual([]);
        // without its line the anchor falls back to the element
        d.edges.shift();
        expect(edgeGeometry(d, anchor, find(note.id), find(extra.id)).t).not.toEqual(g.t);
    });
});
