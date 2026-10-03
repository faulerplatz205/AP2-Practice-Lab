import type { TimeKey } from "../../types/diagram";
import { num } from "../math";
import type { ActivityGraph } from "./graph";
import { text } from "../../i18n/locale";
import { ruleText } from "../../i18n/check";

export type TimeValues = Record<TimeKey, number> & { d: number };

export interface Solution {
    values: Record<number, TimeValues>;
    /** End of the project: largest FEZ (EF) */
    end: number;
}

/**
 * Forward and backward pass.
 *
 * With `start = 0`: FAZ = max FEZ(predecessors), FEZ = FAZ + D.
 * With `start = 1`: FAZ = max FEZ(predecessors) + 1, FEZ = FAZ + D - 1.
 * (FAZ/FEZ/SAZ/SEZ/GP/FP = ES/EF/LS/LF/TF/FF.) Formulas for all values: docs/check-rules.md
 *
 * Requires: no cycle and every duration is a number.
 */
export function solve(g: ActivityGraph, start: 0 | 1): Solution {
    const o = start;
    const V: Record<number, TimeValues> = {};
    for (const id of g.order) {
        const d = num(g.byId.get(id)!.f.d);
        const faz = g.pred[id].length ? Math.max(...g.pred[id].map(p => V[p].fez)) + o : o;
        V[id] = { d, faz, fez: faz + d - o, saz: 0, sez: 0, gp: 0, fp: 0 };
    }
    const end = Math.max(...g.order.map(id => V[id].fez));
    for (const id of [ ...g.order ].reverse()) {
        const v = V[id], s = g.succ[id];
        v.sez = s.length ? Math.min(...s.map(x => V[x].saz)) - o : end;
        v.saz = v.sez - v.d + o;
        v.gp = v.saz - v.faz;
        v.fp = s.length ? Math.min(...s.map(x => V[x].faz)) - v.fez - o : end - v.fez;
    }
    return { values: V, end };
}

/** Formula of a field for the check tips, in the current language. */
export function ruleFor(key: TimeKey, start: 0 | 1): string {
    return text(ruleText)[start === 1 ? "start1" : "start0"][key];
}
