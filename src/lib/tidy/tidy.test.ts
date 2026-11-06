import { describe, expect, it } from "vitest";
import type { Diagram, DiagramNode } from "../../types/diagram";
import { createNode, emptyDiagram } from "../diagram";
import { overlaps } from "../geometry";
import { insertExample } from "../../data/examples";
import type { ExampleKey } from "../../data/modes";
import { tidyDiagram } from "./tidy";

const BACKGROUND = new Set([ "boundary", "lane", "fragment", "package" ]);

function example(key: ExampleKey): Diagram {
    const d = emptyDiagram();
    insertExample(d, key);
    return d;
}

function overlapping(d: Diagram): [string, string][] {
    const nodes = d.nodes.filter(n => !BACKGROUND.has(n.type));
    const out: [string, string][] = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) if (overlaps(nodes[i], nodes[j])) out.push([ nodes[i].text, nodes[j].text ]);
    }
    return out;
}

const within = (n: DiagramNode, box: DiagramNode): boolean => n.x >= box.x && n.y >= box.y && n.x + n.w <= box.x + box.w && n.y + n.h <= box.y + box.h;

describe("tidy up", () => {
    for (const key of [ "er", "useCase", "activity", "class", "rel", "state" ] as ExampleKey[]) {
        it(`leaves no overlapping shapes in the ${key} example`, () => {
            const d = example(key);
            tidyDiagram(d);
            expect(overlapping(d)).toEqual([]);
        });
    }

    it("keeps use cases inside the boundary and actors outside", () => {
        const d = example("useCase");
        tidyDiagram(d);
        const boundary = d.nodes.find(n => n.type === "boundary")!;
        for (const n of d.nodes.filter(x => x.type === "usecase")) expect(within(n, boundary)).toBe(true);
        for (const n of d.nodes.filter(x => x.type === "actor")) expect(overlaps(n, boundary)).toBe(false);
    });

    it("puts the relationship between its two entities", () => {
        const d = emptyDiagram("er");
        const [ a, r, b ] = ([ "entity", "relship", "entity" ] as const).map((t, i) => {
            const n = createNode(d, t, i * 300, i * 200);
            d.nodes.push(n);
            return n;
        });
        d.edges.push({ id: d.next++, from: a.id, to: r.id, label: "1", kind: "erl" }, { id: d.next++, from: r.id, to: b.id, label: "n", kind: "erl" });
        tidyDiagram(d);
        const cx = (n: DiagramNode): number => n.x + n.w / 2, cy = (n: DiagramNode): number => n.y + n.h / 2;
        const between = (v: number, p: number, q: number): boolean => v >= Math.min(p, q) && v <= Math.max(p, q);
        expect(between(cx(r), cx(a), cx(b)) && between(cy(r), cy(a), cy(b))).toBe(true);
        expect(overlapping(d)).toEqual([]);
    });

    it("places every attribute of a larger ER model without overlap", () => {
        const d = emptyDiagram("er");
        const add = (type: DiagramNode["type"], text: string, x = 0, y = 0): DiagramNode => {
            const n = { ...createNode(d, type, x, y), text };
            d.nodes.push(n);
            return n;
        };
        const link = (a: DiagramNode, b: DiagramNode, label = ""): void => void d.edges.push({ id: d.next++, from: a.id, to: b.id, label, kind: "erl" });
        const entities = [ "Kunde", "Bestellung", "Artikel", "Lager", "Lieferant" ].map((t, i) => add("entity", t, i * 50, i * 40));
        for (const e of entities) for (const name of [ "id", "name", "datum" ]) link(e, add("erattr", `${e.text}_${name}`));
        for (let i = 0; i < entities.length - 1; i++) {
            const r = add("relship", `r${i}`);
            link(entities[i], r, "1");
            link(r, entities[i + 1], "n");
        }
        tidyDiagram(d);
        expect(overlapping(d)).toEqual([]);
    });

    const erModel = (names: string[], pairs: [number, number, string, string][], at: (i: number) => [number, number]): Diagram => {
        const d = emptyDiagram("er");
        const entities = names.map((t, i) => {
            const n = { ...createNode(d, "entity", ...at(i)), text: t };
            d.nodes.push(n);
            return n;
        });
        for (const e of entities) {
            for (const name of [ "nr", "name" ]) {
                const a = { ...createNode(d, "erattr", e.x, e.y + 80), text: `${e.text}_${name}` };
                d.nodes.push(a);
                d.edges.push({ id: d.next++, from: e.id, to: a.id, label: "", kind: "erl" });
            }
        }
        pairs.forEach(([ a, b, la, lb ], k) => {
            const r = { ...createNode(d, "relship", (entities[a].x + entities[b].x) / 2, (entities[a].y + entities[b].y) / 2), text: `r${k}` };
            d.nodes.push(r);
            d.edges.push({ id: d.next++, from: entities[a].id, to: r.id, label: la, kind: "erl" }, { id: d.next++, from: r.id, to: entities[b].id, label: lb, kind: "erl" });
        });
        return d;
    };
    const positions = (d: Diagram): string => JSON.stringify(d.nodes.map(n => [ n.id, n.x, n.y ]));
    const cxOf = (d: Diagram, text: string): number => {
        const n = d.nodes.find(x => x.text === text)!;
        return n.x + n.w / 2;
    };

    it("tidies an ER model to the same place every time", () => {
        const d = erModel([ "Kunde", "Bestellung", "Artikel", "Lager", "Lieferant", "Ort" ],
            [[ 0, 1, "1", "n" ], [ 1, 2, "m", "n" ], [ 2, 3, "n", "1" ], [ 2, 4, "n", "1" ], [ 4, 5, "n", "1" ], [ 0, 5, "n", "1" ]],
            i => [ (i * 370) % 900, (i * 230) % 700 ]);
        tidyDiagram(d);
        const once = positions(d);
        for (let k = 0; k < 3; k++) {
            tidyDiagram(d);
            expect(positions(d)).toBe(once);
        }
    });

    it("keeps 1 Kunde - n Bestellung reading from left to right", () => {
        const right = erModel([ "Kunde", "Bestellung" ], [[ 0, 1, "1", "n" ]], i => [ i * 400, 0 ]);
        tidyDiagram(right);
        expect(cxOf(right, "Kunde")).toBeLessThan(cxOf(right, "Bestellung"));
        const drawnMirrored = erModel([ "Kunde", "Bestellung" ], [[ 0, 1, "1", "n" ]], i => [ 400 - i * 400, 0 ]);
        tidyDiagram(drawnMirrored);
        expect(cxOf(drawnMirrored, "Kunde")).toBeGreaterThan(cxOf(drawnMirrored, "Bestellung"));
    });
});
