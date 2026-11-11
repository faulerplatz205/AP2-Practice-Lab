import { describe, expect, it } from "vitest";
import type { Diagram, DiagramNode } from "../../types/diagram";
import { emptyDiagram } from "../diagram";
import { insertExample } from "../../data/examples";
import type { ExampleKey } from "../../data/modes";
import { isClear } from "../uml/detour";
import { inside, overlaps } from "../geometry";
import { placeLabels } from "../uml/labels";
import { edgeGeometry, pathPoints, routeContext } from "../uml/routing";
import { RELATIONS } from "../uml/types";
import { FIXTURE_KEYS, fixture } from "./fixtures";
import { tidyDiagram } from "./tidy";
import { runCheck } from "../check";

const CONTAINERS = new Set([ "boundary", "lane", "fragment", "package", "node3d", "compstate", "lifeline", "actline", "activation" ]);
const KEYS: ExampleKey[] = [ "activity", "useCase", "class", "sequence", "state", "er", "rel" ];

const within = (a: DiagramNode, b: DiagramNode): boolean => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
const touch = (a: DiagramNode, b: DiagramNode): boolean => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;

/** Everything wrong with the geometry of a drawing: overlapping shapes, lines through shapes, overlapping labels. */
export function layoutProblems(d: Diagram): string[] {
    const out: string[] = [];
    const name = (n: DiagramNode): string => `${n.type}#${n.id}(${String(n.text ?? "").split("\n")[0]})`;
    for (let i = 0; i < d.nodes.length; i++) {
        for (let j = i + 1; j < d.nodes.length; j++) {
            const a = d.nodes[i], b = d.nodes[j];
            if (!touch(a, b)) continue;
            if ((CONTAINERS.has(a.type) && within(b, a)) || (CONTAINERS.has(b.type) && within(a, b))) continue;
            if (CONTAINERS.has(a.type) && CONTAINERS.has(b.type)) continue;
            if (CONTAINERS.has(a.type) !== CONTAINERS.has(b.type) && [ a, b ].some(n => [ "lifeline", "actline", "activation", "fragment", "lane" ].includes(n.type))) continue;
            out.push(`overlap ${name(a)} ${name(b)}`);
        }
    }
    const byId = new Map(d.nodes.map(n => [ n.id, n ]));
    const ctx = routeContext(d);
    for (const e of d.edges) {
        const a = byId.get(e.from), b = byId.get(e.to);
        if (!a || !b || a === b || RELATIONS[e.kind ?? "flow"]?.seq) continue;
        if (!isClear(d, a, b, pathPoints(edgeGeometry(d, e, a, b, ctx).d))) out.push(`line ${name(a)} -> ${name(b)} runs through a shape`);
    }
    const labels = [ ...placeLabels(d, ctx) ];
    for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
            const p = labels[i][1].box, q = labels[j][1].box;
            if (p[0] < q[2] - 1 && q[0] < p[2] - 1 && p[1] < q[3] - 1 && q[1] < p[3] - 1) out.push(`labels ${labels[i][0]} ${labels[j][0]} overlap`);
        }
    }
    return out;
}

export function example(key: ExampleKey): Diagram {
    const d = emptyDiagram();
    insertExample(d, key);
    return d;
}

/** Random positions (seeded), containers stay. */
export function scramble(d: Diagram, seed: number): Diagram {
    let s = seed;
    const random = (): number => (s = s * 16807 % 2147483647) / 2147483647;
    for (const n of d.nodes) {
        if ([ "boundary", "lifeline", "actline", "activation", "lane" ].includes(n.type)) continue;
        n.x = Math.round(random() * 900);
        n.y = Math.round(random() * 600);
    }
    return d;
}

const positions = (d: Diagram): string => JSON.stringify(d.nodes.map(n => [ n.id, n.x, n.y, n.w, n.h ]));

describe("tidy layout quality", () => {
    for (const key of KEYS) {
        it(`tidies the ${key} example without geometry problems and is idempotent`, () => {
            const d = example(key);
            tidyDiagram(d);
            expect(layoutProblems(d)).toEqual([]);
            const once = positions(d);
            tidyDiagram(d);
            expect(positions(d)).toBe(once);
        });
        for (const seed of [ 3, 11, 42 ]) {
            it(`tidies a scrambled ${key} example (seed ${seed}) without geometry problems and is idempotent`, () => {
                const d = scramble(example(key), seed);
                tidyDiagram(d);
                expect(layoutProblems(d)).toEqual([]);
                const once = positions(d);
                tidyDiagram(d);
                expect(positions(d)).toBe(once);
            });
        }
    }
});

const cx = (n: DiagramNode): number => n.x + n.w / 2;

/** Ends of every control flow: [from, to] nodes. */
function flows(d: Diagram): [DiagramNode, DiagramNode][] {
    const byId = new Map(d.nodes.map(n => [ n.id, n ]));
    return d.edges.filter(e => (e.kind ?? "flow") === "flow" && byId.has(e.from) && byId.has(e.to)).map(e => [ byId.get(e.from)!, byId.get(e.to)! ]);
}

describe("tidy layout of complex drawings", () => {
    for (const key of FIXTURE_KEYS) {
        it(`tidies the ${key} fixture without geometry problems and is idempotent`, () => {
            const d = fixture(key);
            tidyDiagram(d);
            expect(layoutProblems(d)).toEqual([]);
            const once = positions(d);
            tidyDiagram(d);
            expect(positions(d)).toBe(once);
        });
    }

    // every complex drawing is a correct diagram (knowledge base): it still checks without mistakes after tidying
    for (const key of FIXTURE_KEYS.filter(k => k !== "netzAM" && k !== "freiComplex")) {
        it(`${key}: checks without errors and warnings after tidy`, () => {
            const d = fixture(key);
            tidyDiagram(d);
            expect(runCheck(d).items.filter(i => i.level === "error" || i.level === "warn").map(i => i.text)).toEqual([]);
        });
    }

    for (const key of [ "aktFork", "aktNested" ]) {
        it(`${key}: forks sit under their incoming flow, branches are symmetric, the flow after a join leaves from its middle`, () => {
            const d = fixture(key);
            tidyDiagram(d);
            const f = flows(d);
            for (const bar of d.nodes.filter(n => n.type === "bar")) {
                const into = f.filter(([ , b ]) => b === bar).map(([ a ]) => a), out = f.filter(([ a ]) => a === bar).map(([ , b ]) => b);
                if (out.length > 1 && into.length === 1) {
                    expect(Math.abs(cx(into[0]) - cx(bar))).toBeLessThanOrEqual(5);
                    const xs = out.map(cx);
                    expect(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - cx(bar))).toBeLessThanOrEqual(10);
                }
                if (into.length > 1 && out.length === 1) expect(Math.abs(cx(out[0]) - cx(bar))).toBeLessThanOrEqual(5);
            }
        });
    }

    it("aktFork: the main flow from start to end runs on one vertical axis", () => {
        const d = fixture("aktFork");
        tidyDiagram(d);
        const axis = [ "start", "end" ].map(t => cx(d.nodes.find(n => n.type === t)!));
        expect(Math.abs(axis[0] - axis[1])).toBeLessThanOrEqual(5);
        for (const text of [ "Bestellung prüfen", "Ware versenden" ]) expect(Math.abs(cx(d.nodes.find(n => n.text === text)!) - axis[0])).toBeLessThanOrEqual(5);
    });

    it("zuComposite: the content stays inside its composite state and nothing overlaps", () => {
        const d = fixture("zuComposite");
        const comps = d.nodes.filter(n => n.type === "compstate");
        const contentOf = new Map(comps.map(k => [ k, d.nodes.filter(n => n !== k && inside(n, k) && !comps.some(o => o !== k && o !== n && inside(o, k) && inside(n, o))) ]));
        tidyDiagram(d);
        for (const [ k, kids ] of contentOf) for (const n of kids) expect(inside(n, k), `${n.text} in ${k.text}`).toBe(true);
        const siblings = (a: DiagramNode, b: DiagramNode): boolean => !inside(a, b) && !inside(b, a);
        for (const a of d.nodes) for (const b of d.nodes) if (a.id < b.id && siblings(a, b)) expect(overlaps(a, b), `${a.text} / ${b.text}`).toBe(false);
    });

    it("aktLanes: every bar spans its parallel branches; flows dock at the nearest point of a bar", () => {
        const d = fixture("aktLanes");
        tidyDiagram(d);
        const f = flows(d), ctx = routeContext(d);
        for (const bar of d.nodes.filter(n => n.type === "bar")) {
            const into = f.filter(([ , b ]) => b === bar).map(([ a ]) => a), out = f.filter(([ a ]) => a === bar).map(([ , b ]) => b);
            const branches = out.length > 1 ? out : into;
            for (const n of branches) expect(cx(n) > bar.x && cx(n) < bar.x + bar.w).toBe(true);
        }
        for (const e of d.edges) {
            const a = d.nodes.find(n => n.id === e.from)!, b = d.nodes.find(n => n.id === e.to)!;
            const g = edgeGeometry(d, e, a, b, ctx);
            // the nearest point of the bar: straight above/below the other end, else the end of the bar
            const near = (n: DiagramNode, bar: DiagramNode): number => Math.min(Math.max(cx(n), bar.x + 6), bar.x + bar.w - 6);
            if (a.type === "bar" && f.filter(([ x ]) => x === a).length === 1) expect(Math.abs(g.s[0] - near(b, a))).toBeLessThanOrEqual(1);
            if (b.type === "bar" && f.filter(([ , y ]) => y === b).length === 1) expect(Math.abs(g.t[0] - near(a, b))).toBeLessThanOrEqual(1);
            // no flow runs along a partition border
            const borders = d.nodes.filter(n => n.type === "lane").flatMap(l => [ l.x, l.x + l.w ]);
            for (const [ x1, , x2 ] of [[ g.s[0], 0, g.t[0] ]]) for (const bx of borders) expect(x1 === x2 && Math.abs(x1 - bx) < 2).toBe(false);
        }
    });

    for (const key of [ "klComplex", "klBig", "objLinks", "kompComplex", "pakComplex" ]) {
        it(`${key}: relations run at right angles`, () => {
            const d = fixture(key);
            tidyDiagram(d);
            const ctx = routeContext(d), byId = new Map(d.nodes.map(n => [ n.id, n ]));
            for (const e of d.edges) {
                if (e.from === e.to) continue;
                const points = pathPoints(edgeGeometry(d, e, byId.get(e.from)!, byId.get(e.to)!, ctx).d);
                for (let k = 1; k < points.length; k++) {
                    expect(Math.abs(points[k][0] - points[k - 1][0]) < 1 || Math.abs(points[k][1] - points[k - 1][1]) < 1).toBe(true);
                }
            }
        });
    }

    it("klBig: twelve classes stay compact and unconnected classes stay close", () => {
        const d = fixture("klBig");
        tidyDiagram(d);
        const w = Math.max(...d.nodes.map(n => n.x + n.w)) - Math.min(...d.nodes.map(n => n.x));
        const h = Math.max(...d.nodes.map(n => n.y + n.h)) - Math.min(...d.nodes.map(n => n.y));
        expect(w).toBeLessThanOrEqual(1500);
        expect(h).toBeLessThanOrEqual(1100);
    });

    it("kompComplex: lays the components out from left to right with each interface level with its provider", () => {
        const d = fixture("kompComplex");
        tidyDiagram(d);
        const byText = (t: string): DiagramNode => d.nodes.find(n => n.text === t)!;
        const cy = (n: DiagramNode): number => n.y + n.h / 2;
        expect(byText("Webshop").x).toBeLessThan(byText("IBestellung").x);
        expect(byText("IBestellung").x).toBeLessThan(byText("Bestellservice").x);
        for (const [ i, c ] of [[ "IBestellung", "Bestellservice" ], [ "IZahlung", "Zahlung" ], [ "ILager", "Lager" ]]) expect(Math.abs(cy(byText(i)) - cy(byText(c)))).toBeLessThanOrEqual(5);
    });

    it("vertComplex: artifacts stay inside their node and the nodes stand in one row", () => {
        const d = fixture("vertComplex");
        tidyDiagram(d);
        const nodes = d.nodes.filter(n => n.type === "node3d");
        expect(new Set(nodes.map(n => n.y)).size).toBe(1);
        for (const a of d.nodes.filter(n => n.type === "artifact")) expect(nodes.some(n => within(a, n))).toBe(true);
    });
});
