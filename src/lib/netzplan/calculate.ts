import type { Issue } from "../../types/check";
import type { Diagram } from "../../types/diagram";
import { TIME_KEYS } from "../constants";
import { fmt } from "../math";
import { checkStructure } from "./check";
import { buildGraph } from "./graph";
import { solve } from "./solve";

export type CalculateResult =
    | { ok: true; end: number; critical: string[] }
    | { ok: false; issue?: Issue };

/** Fills in FAZ to FP (ES to FF) in every activity. Changes `d` in place. */
export function calculate(d: Diagram): CalculateResult {
    const g = buildGraph(d);
    const structure = checkStructure(g);
    if (structure.blocking) return { ok: false, issue: structure.items.find(i => i.level === "error") };
    const { values, end } = solve(g, d.cfg.start);
    for (const id of g.order) {
        const n = g.byId.get(id)!;
        for (const k of TIME_KEYS) n.f[k] = fmt(values[id][k]);
    }
    return { ok: true, end, critical: g.order.filter(id => values[id].gp === 0).map(id => g.byId.get(id)!.f.nr) };
}
