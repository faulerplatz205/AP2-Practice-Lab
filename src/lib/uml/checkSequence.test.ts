import { describe, expect, it } from "vitest";
import type { Diagram, DiagramEdge, DiagramNode, NodeType, RelationKind } from "../../types/diagram";
import { createNode, emptyDiagram } from "../diagram";
import { insertExample } from "../../data/examples";
import { runCheck } from "../check";
import { useLocale } from "../../i18n/locale";
import { NEST, moveMessage, ownerOf, settleActivations } from "./sequence";

useLocale.setState({ locale: "de" });

interface Builder {
    d: Diagram;
    node: (type: NodeType, x: number, y: number, more?: Partial<DiagramNode>) => DiagramNode;
    /** Message at absolute height `y` */
    msg: (from: DiagramNode, to: DiagramNode, kind: RelationKind, y: number, label?: string) => DiagramEdge;
    /** Activation bar on lifeline `l` from `top` to `bottom` (absolute) */
    bar: (l: DiagramNode, top: number, bottom: number) => DiagramNode;
}

function build(): Builder {
    const d = emptyDiagram("seq");
    const node = (type: NodeType, x: number, y: number, more: Partial<DiagramNode> = {}): DiagramNode => {
        const n = Object.assign(createNode(d, type, x, y), more);
        d.nodes.push(n);
        return n;
    };
    const msg = (from: DiagramNode, to: DiagramNode, kind: RelationKind, y: number, label = ""): DiagramEdge => {
        const e: DiagramEdge = { id: d.next++, from: from.id, to: to.id, label, kind, y: y - from.y };
        d.edges.push(e);
        return e;
    };
    const bar = (l: DiagramNode, top: number, bottom: number): DiagramNode => node("activation", 0, 0, { x: l.x + l.w / 2 - 7, y: top, w: 14, h: bottom - top });
    return { d, node, msg, bar };
}

/** Two lifelines with one call and its reply, activation bars from call to reply: correct. */
function base(): Builder & { a: DiagramNode; b: DiagramNode } {
    const s = build();
    const a = s.node("lifeline", 100, 0, { y: 0, h: 400, text: ":Kasse" }), b = s.node("lifeline", 400, 0, { y: 0, h: 400, text: ":Lager" });
    s.msg(a, b, "msg", 100, "pruefe(artikel)");
    s.msg(b, a, "reply", 160, "verfügbar");
    s.bar(a, 80, 180);
    s.bar(b, 90, 170);
    return { ...s, a, b };
}

const texts = (d: Diagram): string[] => runCheck(d).items.map(i => i.text);
const has = (d: Diagram, part: string): boolean => texts(d).some(x => x.includes(part));

describe("sequence diagram check", () => {
    it("passes the example in both languages", () => {
        for (const locale of [ "de", "en" ] as const) {
            useLocale.setState({ locale });
            const d = emptyDiagram("seq");
            insertExample(d, "sequence");
            const r = runCheck(d);
            expect(r.items.filter(i => i.level !== "info")).toEqual([]);
            expect(r.ok).toBe(true);
        }
        useLocale.setState({ locale: "de" });
    });

    it("passes a correct call with reply", () => {
        expect(texts(base().d)).toEqual([]);
    });

    it("finds a reply without a call and a reply above its call", () => {
        const s = base();
        s.msg(s.b, s.a, "reply", 300, "ok");
        expect(has(s.d, "Antwortnachricht „ok“ ohne vorherigen synchronen Aufruf")).toBe(true);
        const t = build();
        const a = t.node("lifeline", 100, 0, { y: 0, h: 400, text: ":A" }), b = t.node("lifeline", 400, 0, { y: 0, h: 400, text: ":B" });
        t.msg(b, a, "reply", 100, "x");
        t.msg(a, b, "msg", 200, "f()");
        expect(has(t.d, "ohne vorherigen synchronen Aufruf")).toBe(true);
        expect(runCheck(t.d).items.some(i => i.level === "info" && i.text.includes("ohne Antwort"))).toBe(true);
    });

    it("finds a reply carrying the operation name", () => {
        const s = base();
        s.d.edges[1].label = "pruefe(artikel)";
        expect(has(s.d, "wiederholt den Operationsnamen")).toBe(true);
    });

    it("finds messages that are sentences and unnamed lifelines or activities", () => {
        const s = base();
        s.d.edges[0].label = "Bestand prüfen";
        s.b.text = "Bestand prüfen";
        expect(has(s.d, "ist keine Operation")).toBe(true);
        expect(has(s.d, "ist eine Tätigkeit")).toBe(true);
        s.b.text = "";
        expect(has(s.d, "Lebenslinie ohne Namen")).toBe(true);
        s.b.text = ":Kasse";
        expect(has(s.d, "gibt es mehrfach")).toBe(true);
    });

    it("finds an activation bar that ends before the reply and one without a message", () => {
        const s = base();
        s.d.nodes[3].h = 30;
        expect(has(s.d, "endet vor der Antwort")).toBe(true);
        const t = base();
        t.bar(t.b, 250, 300);
        expect(has(t.d, "ohne eingehende Nachricht")).toBe(true);
    });

    it("nests the bar of a self call next to the running bar and accepts it", () => {
        const s = base();
        s.msg(s.b, s.b, "msg", 110, "reserviere()");
        const inner = s.bar(s.b, 130, 160), outer = s.d.nodes[3];
        settleActivations(s.d.nodes);
        expect(inner.x).toBe(outer.x + NEST);
        expect(ownerOf(inner, s.d.nodes)).toBe(s.b);
        expect(has(s.d, "ohne eingehende Nachricht")).toBe(false);
        // a third level, and back onto the line once the outer bars are gone
        const third = s.bar(s.b, 140, 150);
        settleActivations(s.d.nodes);
        expect(third.x).toBe(outer.x + 2 * NEST);
        outer.y = 300;
        settleActivations(s.d.nodes);
        expect(inner.x).toBe(s.b.x + s.b.w / 2 - 7);
        expect(third.x).toBe(inner.x + NEST);
    });

    it("finds a message below the end of the lifeline", () => {
        const s = base();
        s.msg(s.a, s.b, "async", 420, "melde()");
        expect(has(s.d, "außerhalb der Lebenslinie")).toBe(true);
    });

    it("checks create messages", () => {
        const s = base();
        const c = s.node("lifeline", 700, 0, { y: 0, h: 400, text: ":Beleg" });
        const e = s.msg(s.a, c, "create", 220);
        moveMessage(s.d, e, 220);
        expect(c.y).toBe(200);
        expect(c.y + c.h).toBe(400);
        s.msg(c, s.a, "async", 300, "fertig()");
        expect(texts(s.d)).toEqual([]);
        s.msg(s.a, c, "async", 120, "vorher()");
        expect(has(s.d, "vor der Erzeugung")).toBe(true);
        const t = base();
        t.msg(t.a, t.bar(t.b, 300, 340), "create", 320);
        expect(has(t.d, "Erzeugungsnachricht muss auf den Kopf")).toBe(true);
    });

    it("checks the destruction", () => {
        const s = base();
        const x = s.node("destroy", 0, 0, { x: s.b.x + s.b.w / 2 - 12, y: 376 });
        s.msg(s.a, x, "msg", 388, "«destroy»");
        expect(texts(s.d)).toEqual([]);
        s.msg(s.a, s.b, "async", 395, "spaet()");
        expect(has(s.d, "nach der Zerstörung")).toBe(true);
        s.d.edges.pop();
        x.y = 250;
        expect(has(s.d, "geht unter dem X weiter")).toBe(true);
        x.x = 900;
        expect(has(s.d, "Zerstörung (X) liegt auf keiner Lebenslinie")).toBe(true);
    });

    it("checks combined fragments and operands", () => {
        const s = base();
        const f = s.node("fragment", 0, 0, { x: 60, y: 70, w: 520, h: 120, text: "alt", attrs: "[Bedingung]" });
        expect(has(s.d, "„alt“ ohne Bedingung")).toBe(true);
        expect(has(s.d, "„alt“ hat nur einen Operanden")).toBe(true);
        f.attrs = "[verfügbar][else]";
        expect(has(s.d, "mehrere Bedingungen im Kopf")).toBe(true);
        f.attrs = "[verfügbar]";
        const o = s.node("operand", 0, 0, { x: 60, y: 140, w: 520, h: 24, text: "" });
        expect(has(s.d, "Operand ohne Bedingung")).toBe(true);
        o.text = "[verfügbar]";
        expect(has(s.d, "Bedingung doppelt")).toBe(true);
        o.text = "[else]";
        expect(texts(s.d)).toEqual([]);
        [ f.attrs, o.text ] = [ "[else]", "[verfügbar]" ];
        expect(has(s.d, "nicht im letzten Operanden")).toBe(true);
        f.text = "opt";
        expect(has(s.d, "„opt“ hat genau einen Operanden")).toBe(true);
        f.text = "wenn";
        expect(has(s.d, "kein Interaktionsoperator")).toBe(true);
        o.x = 900;
        expect(has(s.d, "liegt in keinem kombinierten Fragment")).toBe(true);
    });

    it("accepts loop(min,max), finds an empty fragment and ignores the sd frame", () => {
        const s = base();
        const f = s.node("fragment", 0, 0, { x: 60, y: 70, w: 520, h: 120, text: "loop", attrs: "(1,3)" });
        expect(texts(s.d)).toEqual([]);
        f.y = 250;
        expect(has(s.d, "umschließt keine Nachricht")).toBe(true);
        Object.assign(f, { text: "sd", attrs: "Bestellung", x: 0, y: -20, w: 700, h: 500 });
        expect(texts(s.d)).toEqual([]);
    });

    it("checks state invariants", () => {
        const s = base();
        const v = s.node("invariant", 0, 0, { x: s.b.x + s.b.w / 2 - 60, y: 200, text: "bezahlt" });
        expect(has(s.d, "ohne geschweifte Klammern")).toBe(true);
        v.text = "{bezahlt}";
        expect(texts(s.d)).toEqual([]);
        v.x = 900;
        expect(has(s.d, "Zustandsinvariante liegt auf keiner Lebenslinie")).toBe(true);
    });
});
