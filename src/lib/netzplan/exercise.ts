import type { Diagram, TaskRow } from "../../types/diagram";
import { createNode, diagramBox, emptyDiagram } from "../diagram";
import { shuffle, snap } from "../math";
import { layoutActivities } from "./layout";
import { buildFromRows } from "./taskList";
import { text } from "../../i18n/locale";
import { exerciseText } from "../../i18n/exercise";

/**
 * Random activity list with `count` activities and names in the current language.
 * Guaranteed: one start, one end, every activity except the last has a successor,
 * no redundant arrows and, from 4 activities on, parallel paths with at least one
 * activity that has a float (GP > 0), so the exercise is never a plain chain.
 */
export function generateTaskList(count: number): TaskRow[] {
    let rows = randomTaskList(count);
    for (let i = 0; i < 200 && count >= 4 && !hasFloat(rows); i++) rows = randomTaskList(count);
    return rows;
}

/** Forward and backward pass on the rows: does any activity have a total float? */
export function hasFloat(rows: TaskRow[]): boolean {
    const fez = new Map<string, number>(), faz = new Map<string, number>();
    for (const r of rows) {
        const start = Math.max(0, ...r.pred.map(p => fez.get(p) ?? 0));
        faz.set(r.nr, start);
        fez.set(r.nr, start + r.d);
    }
    const end = Math.max(0, ...fez.values());
    const saz = new Map<string, number>();
    for (const r of rows.slice().reverse()) {
        const succ = rows.filter(x => x.pred.includes(r.nr)).map(x => saz.get(x.nr)!);
        saz.set(r.nr, (succ.length ? Math.min(...succ) : end) - r.d);
    }
    return rows.some(r => saz.get(r.nr)! - faz.get(r.nr)! > 0);
}

function randomTaskList(count: number): TaskRow[] {
    const names = shuffle(text(exerciseText).activityNames).slice(0, count);
    const P: number[][] = names.map(() => []);
    for (let i = 1; i < count; i++) {
        const k = i > 1 && Math.random() < 0.4 ? 2 : 1;
        const candidates: number[] = [];
        for (let j = Math.max(0, i - 3); j < i; j++) candidates.push(j);
        shuffle(candidates).slice(0, k).forEach(j => P[i].push(j));
    }
    for (let j = 0; j < count - 1; j++) {
        if (!P.some(p => p.includes(j))) P[j + 1 + Math.floor(Math.random() * Math.min(2, count - 1 - j))].push(j);
    }
    const succ = (i: number): number[] => P.map((p, k) => p.includes(i) ? k : -1).filter(k => k >= 0);
    const reachable = (a: number, b: number): boolean => {
        const stack = succ(a).filter(x => x !== b), seen = new Set(stack);
        while (stack.length) {
            for (const s of succ(stack.pop()!)) {
                if (s === b) return true;
                if (!seen.has(s)) {
                    seen.add(s);
                    stack.push(s);
                }
            }
        }
        return false;
    };
    for (let i = 0; i < count; i++) for (const p of P[i].slice()) if (reachable(p, i)) P[i] = P[i].filter(x => x !== p);
    return names.map((name, i) => ({ nr: String(i + 1), name, d: 1 + Math.floor(Math.random() * 8), pred: P[i].sort((a, b) => a - b).map(x => String(x + 1)) }));
}

/** New drawing for an exercise, texts in the current language. Keeps the counting mode `start`. */
export function createExercise(mode: "calc" | "draw", count: number, start: 0 | 1): Diagram {
    const t = text(exerciseText);
    const rows = generateTaskList(count);
    const d = emptyDiagram("netz", start);
    d.task = { mode, list: rows };
    if (mode === "calc") {
        buildFromRows(d, rows, true);
        layoutActivities(d);
        const b = diagramBox(d)!;
        const note = createNode(d, "text");
        Object.assign(note, { x: b.x, y: b.y - 60, w: 520, h: 30, align: "left", text: t.calcTask });
        d.nodes.push(note);
    } else {
        buildFromRows(d, rows, false);
        shuffle(d.nodes).forEach((n, i) => {
            n.x = 460 + (i % 3) * 250;
            n.y = Math.floor(i / 3) * 170 + (i % 2) * 20;
        });
        const note = createNode(d, "text");
        const list = t.listTitle + "\n" + rows.map(r => t.listRow(r.nr, r.name, r.d, r.pred)).join("\n") + "\n\n" + t.drawTask;
        Object.assign(note, { x: 0, y: 0, w: 420, h: snap(list.split("\n").length * 17 + 20), align: "left", text: list });
        d.nodes.push(note);
    }
    return d;
}
