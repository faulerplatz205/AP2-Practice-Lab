import { describe, expect, it } from "vitest";
import type { Diagram, DiagramNode } from "../../types/diagram";
import { emptyDiagram } from "../diagram";
import { insertExample } from "../../data/examples";
import type { ExampleKey } from "../../data/modes";
import { isClear } from "../uml/detour";
import { placeLabels } from "../uml/labels";
import { edgeGeometry, pathPoints, routeContext } from "../uml/routing";
import { RELATIONS } from "../uml/types";
import { tidyDiagram } from "./tidy";

const CONTAINERS = new Set([ "boundary", "lane", "fragment", "package", "node3d", "lifeline", "actline", "activation" ]);
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
