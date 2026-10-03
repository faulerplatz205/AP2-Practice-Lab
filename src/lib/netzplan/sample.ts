import type { Diagram } from "../../types/diagram";
import { createNode, emptyDiagram } from "../diagram";
import { text } from "../../i18n/locale";
import { exerciseText } from "../../i18n/exercise";

/** Sample plan on the very first start, in the current language. Its values are calculated afterwards. */
export function sampleDiagram(): Diagram {
    const d = emptyDiagram("netz");
    const t = text(exerciseText).sample;
    const add = (nr: string, name: string, duration: string, x: number, y: number): number => {
        const n = createNode(d, "np");
        Object.assign(n, { x, y });
        Object.assign(n.f!, { nr, name, d: duration });
        d.nodes.push(n);
        return n.id;
    };
    const a = add("1", t.names[0], "3", 0, 120);
    const b = add("2", t.names[1], "4", 260, 20);
    const c = add("3", t.names[2], "2", 260, 220);
    const e = add("4", t.names[3], "5", 520, 120);
    const f = add("5", t.names[4], "1", 780, 120);
    for (const [ from, to ] of [[ a, b ], [ a, c ], [ b, e ], [ c, e ], [ e, f ]]) d.edges.push({ id: d.next++, from, to, label: "" });
    const title = createNode(d, "text");
    Object.assign(title, { x: 0, y: -40, w: 360, h: 30, text: t.title });
    d.nodes.push(title);
    return d;
}
