import type { CheckResult, Issue } from "../types/check";
import type { Diagram } from "../types/diagram";
import { TIME_KEYS } from "./constants";
import { fmt, num } from "./math";
import { checkAgainstExercise, checkStructure } from "./netzplan/check";
import { buildGraph } from "./netzplan/graph";
import { ruleFor, solve } from "./netzplan/solve";
import { checkUml } from "./uml/check";
import { text } from "../i18n/locale";
import { checkText } from "../i18n/check";
import { fieldLabels } from "../i18n/netzplan";

/**
 * Correct means: neither errors nor hints and, in a network diagram, every field filled in and right.
 * Messages are in the current language.
 */
export function runCheck(d: Diagram): CheckResult {
    const t = text(checkText), labels = text(fieldLabels);
    const uml = checkUml(d);
    const hasActivities = d.nodes.some(n => n.type === "np");

    if (!hasActivities && uml.count) {
        const errors = uml.items.filter(i => i.level === "error").length;
        const warnings = uml.items.filter(i => i.level === "warn").length;
        return { items: uml.items, marks: uml.marks, total: 0, right: 0, empty: 0, duration: null, criticalPath: [], errors, warnings, hasUml: true, isNetzplan: false, kinds: [ ...uml.kinds ], ok: !errors && !warnings };
    }

    const g = buildGraph(d), start = d.cfg.start;
    const structure = checkStructure(g);
    const marks = structure.marks;
    uml.marks.forEach(m => marks.add(m));
    const exerciseItems = checkAgainstExercise(d, g, marks);
    const items: Issue[] = [ ...exerciseItems, ...structure.items ];
    let total = 0, right = 0, empty = 0, duration: number | null = null, criticalPath: string[] = [];

    if (!structure.blocking && !exerciseItems.length) {
        const { values, end } = solve(g, start);
        const other = solve(g, start === 0 ? 1 : 0);
        let otherRight = 0, wrong = 0;
        duration = end;
        criticalPath = g.order.filter(id => values[id].gp === 0).map(id => g.byId.get(id)!.f.nr);
        for (const id of g.order) {
            const n = g.byId.get(id)!, bad: typeof TIME_KEYS = [];
            for (const k of TIME_KEYS) {
                total++;
                const raw = n.f[k];
                if (raw === "" || raw === undefined) {
                    empty++;
                    continue;
                }
                const v = num(raw);
                if (Math.abs(other.values[id][k] - v) < 1e-9) otherRight++;
                if (Math.abs(values[id][k] - v) < 1e-9) right++;
                else {
                    bad.push(k);
                    marks.add(`${id}:${k}`);
                }
            }
            if (bad.length) {
                wrong += bad.length;
                items.push({
                    level: "error",
                    text: t.wrongValues(n.f.nr, bad.map(k => labels[k])),
                    tip: ruleFor(bad[0], start),
                    solution: bad.map(k => `${labels[k]} = ${fmt(values[id][k])}`).join(" · "),
                    nodeId: id,
                });
            }
        }
        if (wrong && otherRight > right && otherRight >= (total - empty) / 2) {
            items.unshift({ level: "warn", text: t.otherCounting(start === 0 ? 1 : 0), tip: t.otherCountingTip });
        }
        if (empty) items.push({ level: "warn", text: t.emptyFields(empty), tip: t.emptyFieldsTip });
    } else if (exerciseItems.length && !structure.blocking) {
        items.push({ level: "info", text: t.waitForArrows });
    }

    items.push(...uml.items);
    const errors = items.filter(i => i.level === "error").length;
    const umlWarns = uml.items.filter(i => i.level === "warn").length;
    return {
        items, marks, total, right, empty, duration, criticalPath, errors, warnings: umlWarns,
        hasUml: uml.count > 0, isNetzplan: true, kinds: [ ...uml.kinds ],
        ok: !structure.blocking && !errors && !empty && total > 0 && !umlWarns,
    };
}

/** Fingerprint of a drawing for the streak „Ihr werdet mich niemals besiegen“: content only, no positions. */
export function contentFingerprint(d: Diagram): string {
    return JSON.stringify([ d.nodes.map(n => [ n.type, n.text, n.attrs, n.ops, n.f?.d ]), d.edges.map(e => [ e.from, e.to, e.kind, e.label ]) ]);
}
