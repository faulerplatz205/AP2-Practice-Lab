import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Diagram, DiagramEdge, DiagramNode, NodeType, RelationKind } from "../../types/diagram";
import { createNode, emptyDiagram } from "../diagram";
import { center, insideOutline, type Vec } from "../geometry";
import { isClear } from "./detour";
import { outline } from "./outline";
import { insertExample } from "../../data/examples";
import type { ExampleKey } from "../../data/modes";
import { tidyDiagram } from "../tidy/tidy";
import { edgeGeometry, overlapLength, pathPoints, routeContext } from "./routing";
import { RELATIONS } from "./types";

/**
 * Audit of all edge paths: every diagram kind, two shapes at many relative positions with single, opposite,
 * double and self lines, plus the examples. No line may run through a shape, miss its outline, end too short for
 * the arrowhead or lie on another line. `AUDIT_DUMP=file.html` (optionally `AUDIT_PICK=regex`) draws the scenes.
 */
/** One drawing of the audit: nodes at given centers and the edges between them. */
interface Scene {
    name: string;
    d: Diagram;
}

interface Problem {
    scene: string;
    edge: number;
    what: string;
}

type EdgeSpec = [ number, number, RelationKind, string? ];

function scene(name: string, nodes: [ NodeType, number, number ][], edges: EdgeSpec[]): Scene {
    const d = emptyDiagram("frei");
    const made = nodes.map(([ type, x, y ]) => {
        const n = createNode(d, type, x, y);
        d.nodes.push(n);
        return n;
    });
    for (const [ a, b, kind, label ] of edges) d.edges.push({ id: d.next++, from: made[a].id, to: made[b].id, label: label ?? "", kind });
    return { name, d };
}

const overlapsBox = (a: DiagramNode, b: DiagramNode, gap: number): boolean =>
    a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

/** Distance of p to the outline of n (0 = on it). */
function outlineDistance(n: DiagramNode, p: Vec): number {
    const [ cx, cy ] = center(n), shape = outline(n);
    for (let k = 0; k <= 40; k++) {
        const s = k / 4;
        const inside = (f: number): boolean => insideOutline(shape, cx, cy, Math.max(1, n.w / 2 + f), Math.max(1, n.h / 2 + f), p[0], p[1]);
        if (inside(s) !== inside(-s)) return s;
    }
    return Infinity;
}

function audit(sc: Scene): Problem[] {
    const { d } = sc, byId = new Map(d.nodes.map(n => [ n.id, n ])), ctx = routeContext(d), problems: Problem[] = [];
    const paths = new Map<number, Vec[]>();
    const add = (e: DiagramEdge, what: string): void => {
        problems.push({ scene: sc.name, edge: e.id, what });
    };
    for (const e of d.edges) {
        const a = byId.get(e.from)!, b = byId.get(e.to)!, points = pathPoints(edgeGeometry(d, e, a, b, ctx).d);
        paths.set(e.id, points);
        if (points.length < 2) {
            add(e, "no path");
            continue;
        }
        // messages dock at the dashed line of a lifeline or at an activation by design
        if (RELATIONS[e.kind ?? "flow"]?.seq) continue;
        const s = points[0], t = points[points.length - 1];
        if (outlineDistance(a, s) > 2.5) add(e, `start not on the outline of ${a.type} (${outlineDistance(a, s)})`);
        if (outlineDistance(b, t) > 2.5) add(e, `end not on the outline of ${b.type} (${outlineDistance(b, t)})`);
        const last = Math.hypot(t[0] - points[points.length - 2][0], t[1] - points[points.length - 2][1]);
        if (last < 14) add(e, `last segment only ${last.toFixed(0)} px, arrowhead does not fit`);
        if (!isClear(d, a, b, points)) add(e, "runs through another shape");
        // must not run through its own nodes (beyond the docking points)
        for (const n of a === b ? [ a ] : [ a, b ]) {
            const [ cx, cy ] = center(n);
            for (let k = 1; k < points.length; k++) {
                const p = points[k - 1], q = points[k];
                for (let f = 0.1; f < 0.95; f += 0.1) {
                    const x = p[0] + (q[0] - p[0]) * f, y = p[1] + (q[1] - p[1]) * f;
                    if (insideOutline(outline(n), cx, cy, n.w / 2 - 3, n.h / 2 - 3, x, y)) {
                        add(e, `runs through its own ${n.type}`);
                        k = points.length;
                        break;
                    }
                }
            }
        }
    }
    const edges = d.edges;
    for (let i = 0; i < edges.length; i++) {
        for (let j = i + 1; j < edges.length; j++) {
            const p1 = paths.get(edges[i].id)!, p2 = paths.get(edges[j].id)!;
            const along = overlapLength(p1, p2, 8);
            if (along > 6) add(edges[j], `runs closer than 8 px along edge ${edges[i].id} for ${along.toFixed(0)} px`);
        }
    }
    return problems;
}

const OFFSETS: Vec[] = [];
for (const dx of [ -420, -240, -40, -20, 0, 20, 40, 240, 420 ]) for (const dy of [ -260, -140, -20, 0, 20, 140, 260 ]) OFFSETS.push([ dx, dy ]);

/** Two nodes at every relative position with the given edge sets (indexes 0 = A, 1 = B, more nodes appended). */
function pairScenes(label: string, ta: NodeType, tb: NodeType, sets: EdgeSpec[][], extra: [ NodeType, number, number ][] = []): Scene[] {
    const out: Scene[] = [];
    for (const [ dx, dy ] of OFFSETS) {
        for (const [ k, edges ] of sets.entries()) {
            const sc = scene(`${label} set${k} B at ${dx},${dy}`, [[ ta, 0, 0 ], [ tb, dx, dy ], ...extra ], edges);
            const [ a, b, ...rest ] = sc.d.nodes;
            if (overlapsBox(a, b, 16) || rest.some(n => overlapsBox(n, a, 16) || overlapsBox(n, b, 16))) continue;
            out.push(sc);
        }
    }
    return out;
}

const PAIR: EdgeSpec[] = [[ 0, 1, "flow" ]];
const BOTH: EdgeSpec[] = [[ 0, 1, "flow", "weiter" ], [ 1, 0, "flow", "zurück" ]];
const TWICE: EdgeSpec[] = [[ 0, 1, "flow", "a" ], [ 0, 1, "flow", "b" ]];
const SELF: EdgeSpec[] = [[ 0, 0, "flow", "tick" ]];
const SELF2: EdgeSpec[] = [[ 0, 0, "flow", "a" ], [ 0, 0, "flow", "b" ], [ 0, 1, "flow" ]];
const ALL: EdgeSpec[] = [[ 0, 1, "flow", "a" ], [ 1, 0, "flow", "b" ], [ 0, 0, "flow", "c" ], [ 1, 1, "flow", "d" ]];

const rel = (kind: RelationKind, sets: EdgeSpec[][]): EdgeSpec[][] => sets.map(s => s.map(([ a, b, , l ]) => [ a, b, kind, l ] as EdgeSpec));

function allScenes(): Scene[] {
    return [
        // state machine
        ...pairScenes("zu state-state", "state", "state", [ PAIR, BOTH, TWICE, SELF, SELF2, ALL ]),
        ...pairScenes("zu state-state +start", "state", "state", [[[ 2, 1, "flow" ], [ 1, 0, "flow", "x" ], [ 0, 1, "flow", "y" ]]], [[ "start", -260, 200 ]]),
        ...pairScenes("zu start-state", "start", "state", [ PAIR ]),
        ...pairScenes("zu state-end", "state", "end", [ PAIR ]),
        ...pairScenes("zu decision-state", "decision", "state", [[[ 0, 1, "flow", "[ja]" ]], [[ 1, 0, "flow" ]]]),
        // activity
        ...pairScenes("akt action-action", "action", "action", [ PAIR, BOTH ]),
        ...pairScenes("akt decision-action", "decision", "action", [[[ 0, 1, "flow", "[ja]" ]], [[ 1, 0, "flow" ]], [[ 0, 1, "flow", "[ja]" ], [ 1, 0, "flow" ]]]),
        ...pairScenes("akt start-action", "start", "action", [ PAIR ]),
        ...pairScenes("akt action-end", "action", "end", [ PAIR ]),
        ...pairScenes("akt bar-action", "bar", "action", [ PAIR, [[ 1, 0, "flow" ]]]),
        ...pairScenes("akt decision two branches", "decision", "action", [[[ 0, 1, "flow", "[ja]" ], [ 0, 2, "flow", "[nein]" ]]], [[ "action", 0, 160 ]]),
        ...pairScenes("akt loop to decision", "action", "decision", [[[ 0, 1, "flow" ], [ 1, 2, "flow", "[ja]" ], [ 2, 0, "flow" ]]], [[ "action", 0, 300 ]]),
        // class, object
        ...[ "assoc", "dir", "inherit", "aggr", "comp", "dep", "realize" ].flatMap(k => pairScenes(`kl class-class ${k}`, "class", "class", rel(k as RelationKind, [ PAIR, BOTH, SELF ]))),
        ...pairScenes("kl class two kinds", "class", "class", [[[ 0, 1, "assoc" ], [ 0, 1, "inherit" ]], [[ 0, 1, "assoc" ], [ 1, 0, "comp" ], [ 0, 0, "assoc" ]]]),
        ...pairScenes("obj object-object", "object", "object", rel("assoc", [ PAIR, BOTH, SELF, ALL ])),
        // use case
        ...pairScenes("uc actor-usecase", "actor", "usecase", rel("assoc", [ PAIR ])),
        ...pairScenes("uc usecase include", "usecase", "usecase", [[[ 0, 1, "include" ]], [[ 0, 1, "include" ], [ 1, 0, "extend" ]]]),
        ...pairScenes("uc actor inherit", "actor", "actor", rel("inherit", [ PAIR ])),
        // component, deployment, package
        ...pairScenes("komp component", "component", "component", rel("dep", [ PAIR, BOTH ])),
        ...pairScenes("komp iface", "component", "iface", rel("realize", [ PAIR ])),
        ...pairScenes("vert artifact", "artifact", "artifact", rel("dep", [ PAIR, BOTH ])),
        ...pairScenes("pak package", "package", "package", rel("dep", [ PAIR, BOTH ])),
        // databases
        ...pairScenes("er entity-relship", "entity", "relship", [[[ 0, 1, "erl", "1" ]], [[ 0, 1, "erl", "1" ], [ 0, 1, "erl", "n" ]], [[ 0, 1, "erl", "1" ], [ 1, 0, "erl", "n" ]]]),
        ...pairScenes("er entity-attr", "entity", "erattr", [[[ 0, 1, "erl" ]]]),
        ...pairScenes("rel table-table", "table", "table", rel("fk", [ PAIR, BOTH, SELF, [[ 0, 1 ], [ 0, 0 ]] as unknown as EdgeSpec[] ].map(s => s.map(([ a, b ]) => [ a, b, "fk" ] as EdgeSpec)))),
        // free drawing
        ...pairScenes("frei rect-rect", "rect", "rect", [ PAIR, BOTH ]),
        ...pairScenes("frei ellipse-diamond", "ellipse", "diamond", rel("assoc", [ PAIR, BOTH ])),
        // notes
        ...pairScenes("note anchor", "note", "class", rel("anchor", [ PAIR ])),
        // the state machine from the bug report: start, two states, there and back
        scene("zu report", [[ "start", 210, 450 ], [ "state", 450, 120 ], [ "state", 470, 430 ]], [[ 0, 2, "flow" ], [ 1, 2, "flow", "weiter" ], [ 2, 1, "flow", "zurück" ], [ 1, 1, "flow", "tick" ]]),
        // the examples of every diagram kind, as inserted and after "tidy up"
        ...([ "activity", "useCase", "class", "sequence", "state", "er", "rel" ] as ExampleKey[]).flatMap(key => [ false, true ].map(tidy => {
            const d = emptyDiagram("frei");
            insertExample(d, key);
            if (tidy) tidyDiagram(d);
            return { name: `example ${key}${tidy ? " tidied" : ""}`, d };
        })),
        // state example with a self transition at every state and every transition doubled
        ...[ false, true ].map(tidy => {
            const d = emptyDiagram("zu");
            insertExample(d, "state");
            if (tidy) tidyDiagram(d);
            const states = d.nodes.filter(n => n.type === "state");
            const transitions = d.edges.filter(e => states.some(s => s.id === e.from) && states.some(s => s.id === e.to));
            for (const s of states) d.edges.push({ id: d.next++, from: s.id, to: s.id, label: "tick", kind: "flow" });
            for (const e of transitions) d.edges.push({ ...e, id: d.next++, label: "nochmal()" });
            return { name: `example state crowded${tidy ? " tidied" : ""}`, d };
        }),
    ];
}

describe("edge audit", () => {
    it("keeps every line clean in all arrangements of all diagram kinds", () => {
        const scenes = allScenes(), problems = scenes.flatMap(audit);
        const byKind = new Map<string, Problem[]>();
        for (const p of problems) {
            const key = `${p.scene.replace(/ set\d+ B at .*/, "")} | ${p.what.replace(/\d+/g, "#")}`;
            byKind.set(key, [ ...(byKind.get(key) ?? []), p ]);
        }
        const report = [ ...byKind ].sort((x, y) => y[1].length - x[1].length).map(([ k, v ]) => `${String(v.length).padStart(4)}  ${k}   e.g. ${v[0].scene} (edge ${v[0].edge}: ${v[0].what})`);
        if (problems.length) console.log(`${scenes.length} scenes, ${problems.length} problems\n${report.join("\n")}`);
        const dump = process.env.AUDIT_DUMP;
        if (dump) {
            const pick = process.env.AUDIT_PICK, picked = pick ? scenes.filter(x => new RegExp(pick).test(x.name)).slice(0, 60) : [ ...byKind.values() ].map(v => scenes.find(x => x.name === v[0].scene)!).slice(0, 40);
            const svgs = picked.map(sc => {
                const ctx = routeContext(sc.d), byId = new Map(sc.d.nodes.map(n => [ n.id, n ]));
                const xs = sc.d.nodes.flatMap(n => [ n.x, n.x + n.w ]), ys = sc.d.nodes.flatMap(n => [ n.y, n.y + n.h ]);
                const x0 = Math.min(...xs) - 90, y0 = Math.min(...ys) - 90, w = Math.max(...xs) - x0 + 90, h = Math.max(...ys) - y0 + 90;
                const shapes = sc.d.nodes.map(n => `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${outline(n) === "rect" ? 4 : Math.min(n.w, n.h) / 2}" fill="#eef" stroke="#557"/><text x="${n.x + 4}" y="${n.y + 14}" font-size="11">${n.type} ${n.id}</text>`).join("");
                const lines = sc.d.edges.map((e, i) => {
                    const g = edgeGeometry(sc.d, e, byId.get(e.from)!, byId.get(e.to)!, ctx);
                    const c = [ "#d22", "#22d", "#2a2", "#c80" ][i % 4];
                    return `<path d="${g.d}" fill="none" stroke="${c}" stroke-width="2" marker-end="url(#m)" opacity=".8"/><text x="${g.lx}" y="${g.ly}" font-size="11" fill="${c}">${e.id}${e.label ? " " + e.label : ""}</text>`;
                }).join("");
                const issues = problems.filter(p => p.scene === sc.name).map(p => `${p.edge}: ${p.what}`).join("; ");
                return `<figure><figcaption>${sc.name}<br><small>${issues}</small></figcaption><svg viewBox="${x0} ${y0} ${w} ${h}" width="${Math.min(Number(process.env.AUDIT_W ?? 520), w * 1.6)}"><defs><marker id="m" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z"/></marker></defs>${shapes}${lines}</svg></figure>`;
            });
            writeFileSync(dump, `<html><body style="font:12px sans-serif;display:flex;flex-wrap:wrap;gap:12px">${svgs.join("")}</body></html>`);
        }
        expect(scenes.length).toBeGreaterThan(3000);
        expect(report).toEqual([]);
    });
});
