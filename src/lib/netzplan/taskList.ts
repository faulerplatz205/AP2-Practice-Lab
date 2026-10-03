import type { Diagram, TaskRow } from "../../types/diagram";
import { createNode } from "../diagram";
import { byNr, fmt, num } from "../math";
import { buildGraph } from "./graph";
import { text } from "../../i18n/locale";
import { taskListText } from "../../i18n/exercise";

/** Current network diagram as an activity list: `No; name; duration; predecessors` per line. */
export function toTaskList(d: Diagram): string {
    const g = buildGraph(d);
    return g.nodes.slice()
        .sort((a, b) => byNr(a.f.nr, b.f.nr))
        .map(n => `${n.f.nr}; ${n.f.name}; ${n.f.d}; ${g.pred[n.id].map(p => g.byId.get(p)!.f.nr).sort(byNr).join(", ") || "-"}`)
        .join("\n");
}

export interface ParsedTaskList {
    rows: TaskRow[];
    errors: string[];
}

/**
 * Reads an activity list. Separator `;` or tab (copied from Excel).
 * A header line like „Nr; Bezeichnung; Dauer“ or "No; Name; Duration" is skipped.
 * Error messages are in the current language.
 */
export function parseTaskList(input: string): ParsedTaskList {
    const t = text(taskListText);
    const rows: TaskRow[] = [], errors: string[] = [];
    input.split(/\r?\n/).forEach((line, i) => {
        if (!line.trim()) return;
        const c = (line.includes("\t") ? line.split("\t") : line.split(";")).map(x => x.trim());
        if (!rows.length && /^(nr|no|vorgang|activity|task|id|#)/i.test(c[0]) && isNaN(num(c[2]))) return;
        if (c.length < 3) {
            errors.push(t.tooFewColumns(i + 1));
            return;
        }
        const d = num(c[2]);
        if (isNaN(d) || d < 0) {
            errors.push(t.badDuration(i + 1, c[2]));
            return;
        }
        const pred = (c[3] ?? "").split(/[,\s]+/).map(x => x.trim()).filter(x => x && !/^[-–—]$/.test(x));
        rows.push({ nr: c[0], name: c[1], d, pred });
    });
    const nrs = new Set<string>();
    for (const r of rows) {
        if (!r.nr) errors.push(t.noNumber);
        else if (nrs.has(r.nr)) errors.push(t.duplicateNumber(r.nr));
        nrs.add(r.nr);
    }
    for (const r of rows) {
        for (const p of r.pred) {
            if (p === r.nr) errors.push(t.selfPredecessor(r.nr));
            else if (!nrs.has(p)) errors.push(t.unknownPredecessor(p, r.nr));
        }
    }
    if (!rows.length && !errors.length) errors.push(t.empty);
    return { rows, errors };
}

/** Replaces all activities (grid, 4 per row); with `connect` predecessors become arrows. Mutates `d`. */
export function buildFromRows(d: Diagram, rows: TaskRow[], connect: boolean): void {
    const old = new Set(d.nodes.filter(n => n.type === "np").map(n => n.id));
    d.nodes = d.nodes.filter(n => !old.has(n.id));
    d.edges = d.edges.filter(e => !old.has(e.from) && !old.has(e.to));
    const ids = new Map<string, number>();
    rows.forEach((r, i) => {
        const n = createNode(d, "np");
        n.x = (i % 4) * 260;
        n.y = Math.floor(i / 4) * 170;
        n.f!.nr = r.nr;
        n.f!.name = r.name;
        n.f!.d = fmt(r.d);
        d.nodes.push(n);
        ids.set(r.nr, n.id);
    });
    if (connect) {
        for (const r of rows) {
            for (const p of r.pred) d.edges.push({ id: d.next++, from: ids.get(p)!, to: ids.get(r.nr)!, label: "" });
        }
    }
}
