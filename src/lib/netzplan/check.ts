import type { Issue, MarkSet } from "../../types/check";
import type { Diagram } from "../../types/diagram";
import { fmt, num } from "../math";
import { type ActivityGraph, reachableIndirectly } from "./graph";
import { text } from "../../i18n/locale";
import { checkText } from "../../i18n/check";

export interface StructureResult {
    items: Issue[];
    marks: MarkSet;
    /** Calculating is not possible (cycle, missing duration, no activities) */
    blocking: boolean;
}

export function checkStructure(g: ActivityGraph): StructureResult {
    const t = text(checkText);
    const items: Issue[] = [], marks: MarkSet = new Set();
    let blocking = false;
    const nr = (id: number): string => g.byId.get(id)?.f.nr || "?";
    if (!g.nodes.length) return { items: [{ level: "error", text: t.noActivities }], marks, blocking: true };

    if (g.cyclic) {
        const inCycle = g.nodes.filter(n => !g.order.includes(n.id));
        blocking = true;
        items.push({ level: "error", text: t.cycle(inCycle.map(n => n.f.nr)), tip: t.cycleTip, nodeId: inCycle[0].id });
    }

    for (const n of g.nodes) {
        const d = num(n.f.d);
        if (n.f.d === "" || isNaN(d)) {
            blocking = true;
            marks.add(`${n.id}:d`);
            items.push({ level: "error", text: t.durationMissing(n.f.nr), nodeId: n.id });
        } else if (d < 0) {
            blocking = true;
            marks.add(`${n.id}:d`);
            items.push({ level: "error", text: t.durationNegative(n.f.nr), nodeId: n.id });
        }
    }

    const seen = new Set<string>();
    for (const n of g.nodes) {
        const k = String(n.f.nr).trim();
        if (!k) {
            items.push({ level: "warn", text: t.noNumber, nodeId: n.id });
            marks.add(`${n.id}:nr`);
        } else if (seen.has(k)) {
            items.push({ level: "warn", text: t.duplicateNumber(k), nodeId: n.id });
            marks.add(`${n.id}:nr`);
        }
        seen.add(k);
    }

    if (g.nodes.length > 1) {
        const isolated = g.nodes.filter(n => !g.pred[n.id].length && !g.succ[n.id].length);
        const iso = new Set(isolated.map(n => n.id));
        isolated.forEach(n => items.push({ level: "warn", text: t.isolated(n.f.nr), tip: t.isolatedTip, nodeId: n.id }));
        const starts = g.nodes.filter(n => !iso.has(n.id) && !g.pred[n.id].length);
        const ends = g.nodes.filter(n => !iso.has(n.id) && !g.succ[n.id].length);
        if (starts.length > 1) items.push({ level: "warn", text: t.multipleStarts(starts.map(n => n.f.nr)), tip: t.multipleStartsTip, nodeId: starts[0].id });
        if (ends.length > 1) items.push({ level: "warn", text: t.multipleEnds(ends.map(n => n.f.nr)), tip: t.multipleEndsTip, nodeId: ends[0].id });
    }

    if (!g.cyclic) {
        for (const e of g.edges) {
            if (reachableIndirectly(g, e.from, e.to)) {
                marks.add(`e:${e.id}`);
                items.push({ level: "warn", text: t.redundantArrow(nr(e.from), nr(e.to)), tip: t.redundantArrowTip(nr(e.from), nr(e.to)), edgeId: e.id });
            }
        }
    }
    return { items, marks, blocking };
}

/** In a „Zeichnen und rechnen“ (draw and calculate) exercise: does the plan match the activity list? */
export function checkAgainstExercise(d: Diagram, g: ActivityGraph, marks: MarkSet): Issue[] {
    const t = text(checkText);
    const items: Issue[] = [], task = d.task;
    if (!task) return items;
    const byNr = new Map(g.nodes.map(n => [ String(n.f.nr).trim(), n ]));
    const wanted = new Set<string>();
    for (const r of task.list) {
        const n = byNr.get(r.nr);
        r.pred.forEach(p => wanted.add(`${p}>${r.nr}`));
        if (!n) {
            items.push({ level: "error", text: t.taskActivityMissing(r.nr) });
            continue;
        }
        if (num(n.f.d) !== r.d) {
            marks.add(`${n.id}:d`);
            items.push({ level: "error", text: t.taskDuration(r.nr, fmt(r.d)), nodeId: n.id });
        }
        for (const p of r.pred) {
            const pn = byNr.get(p);
            if (pn && !g.edges.some(e => e.from === pn.id && e.to === n.id)) {
                items.push({ level: "error", text: t.taskArrowMissing(p, r.nr), tip: t.taskArrowMissingTip(p, r.nr), nodeId: n.id });
            }
        }
    }
    for (const e of g.edges) {
        const a = String(g.byId.get(e.from)!.f.nr).trim(), b = String(g.byId.get(e.to)!.f.nr).trim();
        if (!wanted.has(`${a}>${b}`)) {
            marks.add(`e:${e.id}`);
            items.push({ level: "error", text: t.taskArrowExtra(a, b), edgeId: e.id });
        }
    }
    return items;
}
