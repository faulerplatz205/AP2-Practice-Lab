import { describe, expect, it } from "vitest";
import type { Diagram, DiagramEdge, DiagramMode, DiagramNode, NodeType, RelationKind } from "../types/diagram";
import { createNode, emptyDiagram } from "./diagram";
import { runCheck } from "./check";
import { tidyDiagram } from "./tidy/tidy";
import { buildFromRows, parseTaskList } from "./netzplan/taskList";
import { calculate } from "./netzplan/calculate";

/**
 * Every diagram kind against Moritz Grimm's knowledge base (knowledge.moritz-grimm.dev): a diagram drawn as the
 * article teaches it counts as correct (also after tidying), and each "typical mistake" of the article is reported.
 */

interface Sketch {
    d: Diagram;
    n: (type: NodeType, text: string, x: number, y: number, extra?: Partial<DiagramNode>) => DiagramNode;
    e: (a: DiagramNode, b: DiagramNode, kind: RelationKind, label?: string, extra?: Partial<DiagramEdge>) => DiagramEdge;
}

function sketch(mode: DiagramMode): Sketch {
    const d = emptyDiagram(mode);
    return {
        d,
        n: (type, text, x, y, extra = {}): DiagramNode => {
            const node = createNode(d, type, x, y);
            Object.assign(node, { text }, extra);
            if (extra.w) node.x = x - extra.w / 2;
            if (extra.h) node.y = y - extra.h / 2;
            d.nodes.push(node);
            return node;
        },
        e: (a, b, kind, label = "", extra = {}): DiagramEdge => {
            const edge = { id: d.next++, from: a.id, to: b.id, label, kind, ...extra };
            d.edges.push(edge);
            return edge;
        },
    };
}

const problems = (d: Diagram): string[] => runCheck(d).items.filter(i => i.level === "error" || i.level === "warn").map(i => i.text);

function correct(d: Diagram): void {
    expect(problems(d)).toEqual([]);
    expect(runCheck(d).ok).toBe(true);
    const tidied = structuredClone(d);
    tidyDiagram(tidied);
    expect(problems(tidied), "after tidy").toEqual([]);
}

function reported(d: Diagram, part?: RegExp): void {
    const found = problems(d);
    expect(found.length, "a mistake from the knowledge base is reported").toBeGreaterThan(0);
    if (part) expect(found.join(" | ")).toMatch(part);
}

describe("activity diagram (fundamentals/uml/activity-diagram)", () => {
    function order(): Sketch & { decision: DiagramNode; ok: DiagramNode; info: DiagramNode; merge: DiagramNode; fork: DiagramNode } {
        const s = sketch("akt"), { n, e } = s;
        const start = n("start", "", 300, 20), check = n("action", "Bestellung prüfen", 300, 100), decision = n("decision", "", 300, 190);
        const ok = n("action", "Ware reservieren", 160, 280), info = n("action", "Kunde informieren", 440, 280), merge = n("decision", "", 300, 370);
        const fork = n("bar", "", 300, 440, { w: 240, h: 8 }), bill = n("action", "Rechnung erstellen", 180, 520), pack = n("action", "Paket packen", 420, 520);
        const join = n("bar", "", 300, 600, { w: 240, h: 8 }), end = n("end", "", 300, 680);
        e(start, check, "flow");
        e(check, decision, "flow");
        e(decision, ok, "flow", "[vollständig]");
        e(decision, info, "flow", "[else]");
        e(ok, merge, "flow");
        e(info, merge, "flow");
        e(merge, fork, "flow");
        e(fork, bill, "flow");
        e(fork, pack, "flow");
        e(bill, join, "flow");
        e(pack, join, "flow");
        e(join, end, "flow");
        return { ...s, decision, ok, info, merge, fork };
    }
    it("accepts decision with [else], merge, fork and join", () => correct(order().d));
    it("reports missing guards", () => {
        const s = order();
        s.d.edges.filter(x => x.from === s.decision.id).forEach(x => x.label = "");
        reported(s.d, /Bedingung/);
    });
    it("reports a join without a fork (deadlock)", () => {
        const s = order();
        s.merge.type = "bar";
        Object.assign(s.merge, { w: 200, h: 8 });
        reported(s.d);
    });
    it("reports several initial nodes", () => {
        const s = order();
        const second = s.n("start", "", 600, 20);
        s.e(second, s.info, "flow");
        reported(s.d, /Start/);
    });
    it("reports several flows into one action (a merge belongs before it)", () => {
        const s = order();
        s.e(s.info, s.ok, "flow");
        reported(s.d);
    });
});

describe("state machine diagram (fundamentals/uml/state-machine-diagram)", () => {
    function shipment(): Sketch & { start: DiagramNode; paid: DiagramNode; sent: DiagramNode } {
        const s = sketch("zu"), { n, e } = s;
        const start = n("start", "", 200, 20), open = n("state", "Offen", 200, 110), paid = n("state", "Bezahlt", 200, 230);
        const sent = n("state", "Versendet", 200, 350), end = n("end", "", 200, 450);
        e(start, open, "flow");
        e(open, paid, "flow", "bezahlen");
        e(paid, sent, "flow", "versenden [lagernd] / mailSenden()");
        e(sent, end, "flow", "zustellen");
        return { ...s, start, paid, sent };
    }
    it("accepts transitions written as trigger [guard] / effect", () => correct(shipment().d));
    it("reports a missing initial state", () => {
        const s = shipment();
        s.d.edges = s.d.edges.filter(x => x.from !== s.start.id);
        s.d.nodes = s.d.nodes.filter(x => x !== s.start);
        reported(s.d, /Start/);
    });
    it("reports two transitions with the same trigger", () => {
        const s = shipment();
        const lost = s.n("state", "Verloren", 420, 350);
        s.e(s.paid, lost, "flow", "versenden [lagernd] / mailSenden()");
        s.e(lost, s.d.nodes.find(x => x.type === "end")!, "flow", "abschreiben");
        reported(s.d);
    });
    it("reports an unreachable state", () => {
        const s = shipment();
        const orphan = s.n("state", "Storniert", 420, 110);
        s.e(orphan, s.d.nodes.find(x => x.type === "end")!, "flow", "abschließen");
        reported(s.d);
    });
});

describe("use case diagram (fundamentals/uml/use-case-diagram)", () => {
    function library(): Sketch & { boundary: DiagramNode; reader: DiagramNode; lend: DiagramNode; card: DiagramNode; fee: DiagramNode } {
        const s = sketch("uc"), { n, e } = s;
        const boundary = n("boundary", "Bibliothek", 400, 250, { w: 420, h: 420 });
        const reader = n("actor", "Leser", 60, 250), lend = n("usecase", "Buch ausleihen", 320, 150);
        const card = n("usecase", "Ausweis prüfen", 480, 250), fee = n("usecase", "Gebühr zahlen", 320, 360);
        e(reader, lend, "assoc");
        e(reader, fee, "assoc");
        e(lend, card, "include");
        e(fee, lend, "extend");
        return { ...s, boundary, reader, lend, card, fee };
    }
    it("accepts actor outside, include from the base, extend towards the base", () => correct(library().d));
    it("reports an actor inside the system boundary", () => {
        const s = library();
        Object.assign(s.reader, { x: s.boundary.x + 40, y: s.boundary.y + 60 });
        reported(s.d);
    });
    it("reports an association between two use cases", () => {
        const s = library();
        s.e(s.lend, s.fee, "assoc");
        reported(s.d);
    });
    it("reports an arrowhead on an association", () => {
        const s = library();
        s.d.edges[0].kind = "dir";
        reported(s.d);
    });
    it("reports «include» from an actor", () => {
        const s = library();
        s.e(s.reader, s.card, "include");
        reported(s.d);
    });
    it("reports an association between two actors", () => {
        const s = library();
        const staff = s.n("actor", "Bibliothekar", 760, 250);
        s.e(staff, s.card, "assoc");
        s.e(s.reader, staff, "assoc");
        reported(s.d);
    });
});

describe("class diagram (fundamentals/uml/class-diagram)", () => {
    function shop(): Sketch & { customer: DiagramNode; order: DiagramNode; link: DiagramEdge } {
        const s = sketch("kl"), { n, e } = s;
        const person = n("class", "Person", 300, 60, { attrs: "- name : String", ops: "+ getName() : String", stereo: "abstract" });
        const customer = n("class", "Kunde", 160, 240, { attrs: "- kundenNr : int\n- isStammkunde : boolean", ops: "+ bestellen() : Bestellung" });
        const order = n("class", "Bestellung", 500, 240, { attrs: "- bestellNr : int", ops: "+ berechneSumme() : double" });
        const line = n("class", "Position", 500, 440, { attrs: "- menge : int", ops: "+ getPreis() : double" });
        e(customer, person, "inherit");
        const link = e(customer, order, "assoc", "", { m1: "1", m2: "0..*" });
        e(order, line, "comp", "", { m1: "1", m2: "1..*" });
        return { ...s, customer, order, link };
    }
    it("accepts private attributes, multiplicities, composition and generalisation", () => correct(shop().d));
    it("reports a public attribute", () => {
        const s = shop();
        s.customer.attrs = "+ kundenNr : int";
        reported(s.d);
    });
    it("reports missing multiplicities", () => {
        const s = shop();
        delete s.link.m1;
        delete s.link.m2;
        reported(s.d, /Multiplizit/);
    });
    it("reports inconsistent naming (class in lower case, umlaut)", () => {
        const s = shop();
        s.order.text = "bestellung";
        reported(s.d);
        s.order.text = "Bestellübersicht";
        reported(s.d);
    });
});

describe("object diagram (further-uml-diagrams#objektdiagramm)", () => {
    function objects(): Sketch & { link: DiagramEdge; k: DiagramNode } {
        const s = sketch("obj"), { n, e } = s;
        const k = n("object", "k1 : Kunde", 120, 100, { attrs: "name = \"Max\"\nkundenNr = 4711" });
        const b = n("object", "b7 : Bestellung", 460, 100, { attrs: "bestellNr = 12" });
        const link = e(k, b, "assoc");
        return { ...s, link, k };
    }
    it("accepts name : Class with attribute values and a plain link", () => correct(objects().d));
    it("reports a multiplicity on a link", () => {
        const s = objects();
        s.link.m1 = "1";
        reported(s.d);
    });
    it("reports types instead of values", () => {
        const s = objects();
        s.k.attrs = "name : String";
        reported(s.d);
    });
});

describe("sequence diagram (fundamentals/uml/sequence-diagram)", () => {
    function order(): Sketch & { shop: DiagramNode; stock: DiagramNode; frag: DiagramNode; bar: DiagramNode } {
        const s = sketch("seq"), { n, e } = s;
        const customer = n("actline", "Kunde", 100, 0, { h: 400 }), shop = n("lifeline", ":Shop", 320, 0, { h: 400 }), stock = n("lifeline", ":Lager", 540, 0, { h: 400 });
        [ customer, shop, stock ].forEach(l => l.y = 0);
        n("activation", "", 320, 0, { w: 14, h: 230 }).y = 70;
        const bar = n("activation", "", 540, 0, { w: 14, h: 60 });
        bar.y = 130;
        const frag = n("fragment", "alt", 430, 0, { w: 420, h: 110, attrs: "[verfügbar]" });
        frag.y = 110;
        n("operand", "[else]", 430, 0, { w: 420, h: 24 }).y = 170;
        e(customer, shop, "msg", "bestellen(artikelNr)", { y: 80 });
        e(shop, stock, "msg", "reservieren(artikelNr)", { y: 140 });
        e(stock, shop, "reply", "ok", { y: 180 });
        e(shop, customer, "reply", "bestellNr", { y: 290 });
        return { ...s, shop, stock, frag, bar };
    }
    it("accepts call, reply with return value, activations and alt with [else]", () => correct(order().d));
    it("reports a reply without a call", () => {
        const s = order();
        s.d.edges.splice(1, 1);
        reported(s.d);
    });
    it("reports an activity as lifeline", () => {
        const s = order();
        s.stock.text = "Bestand prüfen";
        reported(s.d);
    });
    it("reports an alt without guard", () => {
        const s = order();
        s.frag.attrs = "";
        reported(s.d);
    });
    it("reports an activation that ends before the reply", () => {
        const s = order();
        s.bar.h = 20;
        reported(s.d);
    });
});

describe("component diagram (fundamentals/uml/component-diagram)", () => {
    function shop(): Sketch & { order: DiagramNode; pay: DiagramNode; provided: DiagramEdge } {
        const s = sketch("komp"), { n, e } = s;
        const order = n("component", "Bestellservice", 120, 100), pay = n("component", "Zahlungsdienst", 520, 100);
        const iface = n("iface", "IZahlung", 330, 100);
        e(order, iface, "require");
        const provided = e(pay, iface, "assoc");
        return { ...s, order, pay, provided };
    }
    it("accepts ball and socket", () => correct(shop().d));
    it("reports a plain line between components", () => {
        const s = shop();
        s.e(s.order, s.pay, "assoc");
        reported(s.d);
    });
    it("reports a required interface without provider", () => {
        const s = shop();
        s.d.edges = s.d.edges.filter(x => x !== s.provided);
        reported(s.d);
    });
});

describe("deployment diagram (fundamentals/uml/deployment-diagram)", () => {
    function web(): Sketch & { client: DiagramNode; server: DiagramNode; path: DiagramEdge } {
        const s = sketch("vert"), { n, e } = s;
        const client = n("node3d", "«device»\nClient-PC", 140, 120, { w: 220, h: 150 }), server = n("node3d", "«device»\nWebserver", 520, 120, { w: 220, h: 150 });
        n("artifact", "app.js", 140, 140, { w: 150, h: 54 });
        n("artifact", "shop.war", 520, 140, { w: 150, h: 54 });
        const path = e(client, server, "assoc", "«HTTPS»");
        return { ...s, client, server, path };
    }
    it("accepts nested artifacts with file names and a labelled path", () => correct(web().d));
    it("reports a path without protocol", () => {
        const s = web();
        s.path.label = "";
        reported(s.d);
    });
    it("reports an arrowhead on a communication path", () => {
        const s = web();
        s.path.kind = "dep";
        reported(s.d);
    });
    it("reports a component inside a node", () => {
        const s = web();
        s.n("component", "Shop", 520, 160, { w: 120, h: 40 });
        reported(s.d);
    });
});

describe("package diagram (further-uml-diagrams#paketdiagramm)", () => {
    function layers(): Sketch & { gui: DiagramNode; data: DiagramNode } {
        const s = sketch("pak"), { n, e } = s;
        const gui = n("package", "gui", 120, 100), logic = n("package", "logik", 420, 100), data = n("package", "daten", 720, 100);
        e(gui, logic, "import");
        e(logic, data, "access");
        return { ...s, gui, data };
    }
    it("accepts dependencies in one direction with «import» and «access»", () => correct(layers().d));
    it("reports a cycle against the layering", () => {
        const s = layers();
        s.e(s.data, s.gui, "dep");
        reported(s.d);
    });
});

describe("ER model (fundamentals/databases/er-model)", () => {
    function orders(): Sketch & { customer: DiagramNode; order: DiagramNode; card: DiagramEdge } {
        const s = sketch("er"), { n, e } = s;
        const customer = n("entity", "Kunde", 120, 200), rel = n("relship", "bestellt", 360, 200), order = n("entity", "Bestellung", 600, 200);
        const card = e(customer, rel, "erl", "1");
        e(rel, order, "erl", "n");
        e(n("erattr", "KundenNr", 60, 80, { stereo: "key" }), customer, "erl");
        e(n("erattr", "Name", 190, 80), customer, "erl");
        e(n("erattr", "BestellNr", 600, 80, { stereo: "key" }), order, "erl");
        e(n("erattr", "Datum", 720, 300), order, "erl");
        return { ...s, customer, order, card };
    }
    it("accepts entities, a diamond, key attributes and 1/n", () => correct(orders().d));
    it("reports a UML multiplicity such as 1..*", () => {
        const s = orders();
        s.card.label = "1..*";
        reported(s.d, /UML/);
    });
    it("reports a foreign key written as an attribute", () => {
        const s = orders();
        s.e(s.n("erattr", "KundenNr", 720, 80), s.order, "erl");
        reported(s.d, /Fremdschlüssel/);
    });
    it("reports two entities connected directly", () => {
        const s = orders();
        s.e(s.customer, s.order, "erl");
        reported(s.d);
    });
});

describe("table model (fundamentals/databases/database-schema)", () => {
    function schema(): Sketch & { customer: DiagramNode; order: DiagramNode; line: DiagramEdge } {
        const s = sketch("rel"), { n, e } = s;
        const customer = n("table", "Kunde", 140, 100, { attrs: "PK kundenNr INT\nname VARCHAR(50)" });
        const order = n("table", "Bestellung", 480, 100, { attrs: "PK bestellNr INT\nFK kundenNr INT\ndatum DATE" });
        const line = e(order, customer, "fk", "", { m1: "n", m2: "1" });
        return { ...s, customer, order, line };
    }
    it("accepts the foreign key on the n side", () => correct(schema().d));
    it("reports a line without a foreign key column", () => {
        const s = schema();
        s.order.attrs = "PK bestellNr INT\ndatum DATE";
        reported(s.d);
    });
    it("reports the foreign key on the 1 side", () => {
        const s = schema();
        s.line.m1 = "1";
        s.line.m2 = "n";
        reported(s.d);
    });
    it("reports n:m without a junction table", () => {
        const s = schema();
        s.line.m1 = "n";
        s.line.m2 = "m";
        reported(s.d);
    });
});

describe("network plan (projectmanagement/network-plan)", () => {
    it("accepts a fully calculated plan and reports a wrong value", () => {
        const d = emptyDiagram("netz");
        buildFromRows(d, parseTaskList("Nr;Bezeichnung;Dauer;Vorgänger\nA;Start;2;-\nB;Bau;3;A\nC;Test;1;A\nD;Ende;2;B,C").rows, true);
        calculate(d);
        expect(problems(d)).toEqual([]);
        expect(runCheck(d).ok).toBe(true);
        const b = d.nodes.find(x => x.f?.nr === "C")!;
        b.f!.fp = "9";
        expect(runCheck(d).ok).toBe(false);
    });
});
