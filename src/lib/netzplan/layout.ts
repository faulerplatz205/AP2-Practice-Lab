import type { Diagram } from "../../types/diagram";
import { snap } from "../math";
import { buildGraph } from "./graph";
import { text } from "../../i18n/locale";
import { diagramText } from "../../i18n/diagram";

/**
 * Arranges the activities in columns: column = longest path from the start.
 * Within a column sorted by the mean height of the predecessors, so that
 * few arrows cross. Changes `d` in place.
 *
 * @returns error message (current language) or `null` when arranged
 */
export function layoutActivities(d: Diagram): string | null {
    const g = buildGraph(d);
    if (!g.nodes.length) return text(diagramText).noActivities;
    if (g.cyclic) return text(diagramText).layoutCycle;
    const level: Record<number, number> = {};
    for (const id of g.order) level[id] = g.pred[id].length ? Math.max(...g.pred[id].map(p => level[p])) + 1 : 0;
    const cols: number[][] = [];
    for (const id of g.order) (cols[level[id]] ??= []).push(id);
    const W = Math.max(...g.nodes.map(n => n.w)), H = Math.max(...g.nodes.map(n => n.h)), gx = 70, gy = 40;
    const x0 = Math.min(...g.nodes.map(n => n.x)), y0 = Math.min(...g.nodes.map(n => n.y));
    const maxLen = Math.max(...cols.map(c => c.length)), cy = y0 + (maxLen - 1) / 2 * (H + gy);
    const node = (id: number): Diagram["nodes"][number] => g.byId.get(id)!;
    const avgPredY = (id: number): number => {
        const p = g.pred[id];
        return p.length ? p.reduce((a, b) => a + node(b).y, 0) / p.length : node(id).y;
    };
    cols.forEach((c, ci) => {
        if (ci) c.sort((a, b) => avgPredY(a) - avgPredY(b));
        else c.sort((a, b) => node(a).y - node(b).y);
        c.forEach((id, i) => {
            const n = node(id);
            n.x = snap(x0 + ci * (W + gx));
            n.y = snap(cy + (i - (c.length - 1) / 2) * (H + gy));
        });
    });
    return null;
}
