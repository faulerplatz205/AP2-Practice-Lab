import type { Diagram, DiagramEdge, DiagramNode, NodeType } from "../types/diagram";
import { createNode, diagramBox } from "../lib/diagram";
import { snap } from "../lib/math";
import { fitToContent } from "../lib/uml/size";
import { text } from "../i18n/locale";
import { type ExampleTexts, exampleText } from "../i18n/examples";
import type { ExampleKey } from "./modes";

/** [type, center x, center y, initial values] */
type ExampleNode = [NodeType, number, number, Partial<DiagramNode>?];
/** [from, to, label, kind, more fields] – from/to are indices into `nodes` */
type ExampleEdge = [number, number, string?, DiagramEdge["kind"]?, Partial<DiagramEdge>?];

interface Example {
    nodes: ExampleNode[];
    edges: ExampleEdge[];
    /** Final touch after creating, e.g. put activations onto their lifeline */
    adjust?: (nodes: DiagramNode[]) => void;
}

/** Examples in one language. Each passes the check without errors (see tests/e2e/test_uml.py). */
function buildExamples(t: ExampleTexts): Record<ExampleKey, Example> {
    const a = t.activity, u = t.useCase, c = t.class, s = t.sequence, z = t.state;
    return {
        activity: {
            nodes: [
                [ "start", 400, 20 ], [ "action", 400, 100, { text: a.checkOrder }], [ "decision", 400, 190 ],
                [ "bar", 400, 280, { w: 300, h: 8 }], [ "action", 300, 360, { text: a.createInvoice }], [ "action", 500, 360, { text: a.packGoods }],
                [ "bar", 400, 440, { w: 300, h: 8 }], [ "action", 400, 520, { text: a.shipGoods }], [ "decision", 400, 610 ], [ "end", 400, 690 ],
                [ "action", 700, 300, { text: a.informCustomer }],
            ],
            edges: [[ 0, 1 ], [ 1, 2 ], [ 2, 3, a.available ], [ 3, 4 ], [ 3, 5 ], [ 4, 6 ], [ 5, 6 ], [ 6, 7 ], [ 7, 8 ], [ 8, 9 ], [ 2, 10, a.notAvailable ], [ 10, 8 ]],
        },
        useCase: {
            nodes: [
                [ "boundary", 380, 270, { w: 420, h: 560, text: u.system }], [ "actor", 60, 170, { text: u.customer }], [ "actor", 720, 470, { text: u.admin }],
                [ "usecase", 320, 70, { text: u.searchItems }], [ "usecase", 320, 190, { text: u.orderItems }], [ "usecase", 260, 320, { text: u.pay, w: 140 }],
                [ "usecase", 480, 310, { text: u.logIn, w: 140 }], [ "usecase", 260, 450, { text: u.redeemVoucher, w: 170 }], [ "usecase", 480, 470, { text: u.manageItems }],
            ],
            edges: [[ 1, 3, "", "assoc" ], [ 1, 4, "", "assoc" ], [ 4, 6, "", "include" ], [ 4, 5, "", "include" ], [ 7, 5, "", "extend" ], [ 2, 8, "", "assoc" ], [ 8, 6, "", "include" ]],
        },
        class: {
            nodes: [
                [ "class", 330, 40, { text: c.vehicle, stereo: "abstract", attrs: c.vehicleAttrs, ops: c.vehicleOps }],
                [ "class", 620, 40, { text: c.maintainable, stereo: "interface", attrs: "", ops: c.maintainableOps }],
                [ "class", 200, 260, { text: c.car, attrs: c.carAttrs, ops: c.carOps }],
                [ "class", 460, 260, { text: c.motorcycle, attrs: c.motorcycleAttrs, ops: "" }],
                [ "class", -10, 40, { text: c.driver, attrs: c.driverAttrs, ops: c.driverOps }],
                [ "class", 200, 450, { text: c.engine, attrs: c.engineAttrs, ops: c.engineOps }],
            ],
            edges: [[ 2, 0, "", "inherit" ], [ 3, 0, "", "inherit" ], [ 0, 1, "", "realize" ], [ 4, 0, c.drives, "assoc", { m1: "1", m2: "0..*" }], [ 2, 5, "", "comp", { m2: "1" }]],
        },
        sequence: {
            nodes: [
                [ "actline", 100, 170, { text: s.customer, h: 300 }], [ "lifeline", 320, 170, { text: s.shop, h: 300 }], [ "lifeline", 540, 170, { text: s.warehouse, h: 300 }],
                [ "activation", 320, 0, { h: 170 }], [ "activation", 540, 0, { h: 100 }],
            ],
            edges: [[ 0, 3, s.order, "msg", { y: 80 }], [ 3, 4, s.checkStock, "msg", { y: 110 }], [ 4, 3, s.available, "reply", { y: 180 }], [ 3, 0, s.confirmation, "reply", { y: 240 }]],
            adjust: ([ , shop, warehouse, a1, a2 ]): void => {
                Object.assign(a1, { x: shop.x + shop.w / 2 - 7, y: shop.y + 60 });
                Object.assign(a2, { x: warehouse.x + warehouse.w / 2 - 7, y: warehouse.y + 100 });
            },
        },
        state: {
            nodes: [
                [ "start", 300, 20 ], [ "state", 300, 110, { text: z.ordered }], [ "state", 300, 230, { text: z.paid }], [ "state", 300, 350, { text: z.shipped }],
                [ "end", 300, 450 ], [ "state", 560, 230, { text: z.cancelled }], [ "end", 560, 350 ],
            ],
            edges: [[ 0, 1 ], [ 1, 2, z.pay ], [ 2, 3, z.ship ], [ 3, 4, z.deliver ], [ 1, 5, z.cancel ], [ 5, 6 ]],
        },
    };
}

const EXAMPLES = { de: buildExamples(exampleText.de), en: buildExamples(exampleText.en) };

/** Inserts an example (in the current language) right of the existing drawing. Changes `d`, returns the new nodes. */
export function insertExample(d: Diagram, key: ExampleKey): DiagramNode[] {
    const ex = text(EXAMPLES)[key];
    const nodes = ex.nodes.map(([ type, cx, cy, preset ]) => {
        const n = createNode(d, type);
        Object.assign(n, preset ?? {});
        n.x = cx - n.w / 2;
        n.y = cy - n.h / 2;
        return n;
    });
    ex.adjust?.(nodes);
    nodes.forEach(fitToContent);
    const existing = diagramBox(d);
    const minX = Math.min(...nodes.map(n => n.x)), minY = Math.min(...nodes.map(n => n.y));
    const ox = snap((existing ? existing.x + existing.w + 140 : 0) - minX), oy = snap((existing ? existing.y : 0) - minY);
    for (const n of nodes) {
        n.x += ox;
        n.y += oy;
        d.nodes.push(n);
    }
    for (const [ a, b, label, kind, extra ] of ex.edges) {
        d.edges.push({ id: d.next++, from: nodes[a].id, to: nodes[b].id, label: label ?? "", kind: kind ?? "flow", ...extra });
    }
    return nodes;
}
