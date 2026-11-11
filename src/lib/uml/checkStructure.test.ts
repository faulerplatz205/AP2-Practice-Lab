import { describe, expect, it } from "vitest";
import type { Diagram, DiagramEdge, DiagramNode, NodeType, RelationKind } from "../../types/diagram";
import { createNode, emptyDiagram } from "../diagram";
import { checkUml } from "./check";
import { cycles, validMultiplicity } from "./checkStructure";

function node(d: Diagram, type: NodeType, text: string, x = 0, y = 0, extra: Partial<DiagramNode> = {}): DiagramNode {
    const n = { ...createNode(d, type), x, y, text, ...extra };
    d.nodes.push(n);
    return n;
}

function edge(d: Diagram, a: DiagramNode, b: DiagramNode, kind: RelationKind, label = "", extra: Partial<DiagramEdge> = {}): DiagramEdge {
    const e = { id: d.next++, from: a.id, to: b.id, label, kind, ...extra };
    d.edges.push(e);
    return e;
}

const texts = (d: Diagram): string[] => checkUml(d).items.map(i => i.text);
const has = (d: Diagram, part: string): boolean => texts(d).some(x => x.includes(part));

describe("cycles", () => {
    it("finds strongly connected groups and ignores chains", () => {
        const g: Record<number, number[]> = { 1: [ 2 ], 2: [ 3 ], 3: [ 1 ], 4: [ 1 ] };
        expect(cycles([ 1, 2, 3, 4 ], id => g[id] ?? [])).toEqual([[ 1, 2, 3 ]]);
        expect(cycles([ 1, 2 ], id => (id === 1 ? [ 2 ] : []))).toEqual([]);
    });
});

describe("component diagram", () => {
    function shop(): { d: Diagram; order: DiagramNode; pay: DiagramNode; iface: DiagramNode } {
        const d = emptyDiagram("komp");
        const order = node(d, "component", "Bestellung", 0, 0), pay = node(d, "component", "Bezahldienst", 400, 0);
        const iface = node(d, "iface", "IZahlung", 250, 30);
        edge(d, pay, iface, "assoc");
        edge(d, order, iface, "dep");
        return { d, order, pay, iface };
    }

    it("accepts a provided and a required interface", () => {
        const { d } = shop();
        expect(texts(d)).toEqual([]);
        expect(checkUml(d).kinds.has("komp")).toBe(true);
    });

    it("reports a required interface without provider", () => {
        const { d, pay } = shop();
        d.edges = d.edges.filter(e => e.from !== pay.id);
        expect(has(d, "von keiner Komponente bereitgestellt")).toBe(true);
    });

    it("reports names, loose interfaces, wrong directions and plain lines", () => {
        const d = emptyDiagram("komp");
        const a = node(d, "component", "", 0, 0), b = node(d, "component", "B", 300, 0);
        const i = node(d, "iface", "ILoose", 0, 300), j = node(d, "iface", "IJ", 300, 300);
        edge(d, a, b, "assoc");
        edge(d, j, b, "dep");
        edge(d, j, b, "realize");
        const found = texts(d);
        expect(found).toContain("Eine Komponente hat keinen Namen");
        expect(found.some(x => x.includes("„ILoose“ hängt an keiner Komponente"))).toBe(true);
        expect(found.some(x => x.includes("einfache Linie zwischen Komponenten"))).toBe(true);
        expect(found.some(x => x.includes("Verbindung zeigt von Schnittstelle „IJ“ weg"))).toBe(true);
        expect(found.some(x => x.includes("Realisierung geht von Schnittstelle „IJ“ aus"))).toBe(true);
        expect(i).toBeTruthy();
    });

    it("reports a cycle, also through interfaces", () => {
        const { d, order, pay } = shop();
        edge(d, pay, order, "dep");
        expect(has(d, "Zyklische Abhängigkeit zwischen")).toBe(true);
    });

    it("reports two connected interfaces", () => {
        const d = emptyDiagram("komp");
        edge(d, node(d, "iface", "IA"), node(d, "iface", "IB", 200), "assoc");
        expect(has(d, "Zwei Schnittstellen sind direkt verbunden")).toBe(true);
    });
});

describe("deployment diagram", () => {
    function servers(): { d: Diagram; web: DiagramNode; db: DiagramNode; path: DiagramEdge } {
        const d = emptyDiagram("vert");
        const web = node(d, "node3d", "«device»\nWebserver", 0, 0, { w: 300, h: 260 });
        node(d, "node3d", "«executionEnvironment»\nTomcat", 20, 40, { w: 240, h: 180 });
        node(d, "artifact", "shop.war", 40, 120);
        const db = node(d, "node3d", "«device»\nDB-Server", 600, 0);
        const path = edge(d, web, db, "assoc", "«JDBC»");
        return { d, web, db, path };
    }

    it("accepts nested nodes, a deployed artifact and a labelled path", () => {
        const { d } = servers();
        expect(texts(d)).toEqual([]);
        expect(checkUml(d).kinds.has("vert")).toBe(true);
    });

    it("reports a path without protocol and one with an arrowhead", () => {
        const { d, web, db, path } = servers();
        path.label = "";
        edge(d, web, db, "dep");
        expect(has(d, "ohne Protokoll")).toBe(true);
        expect(has(d, "Kommunikationspfad mit Pfeilspitze")).toBe(true);
    });

    it("reports loose artifacts, artifacts without file name and nodes without name", () => {
        const { d } = servers();
        node(d, "artifact", "Shop", 900, 400);
        node(d, "node3d", "«device»", 900, 0);
        expect(has(d, "„Shop“ ist kein Dateiname")).toBe(true);
        expect(has(d, "„Shop“ ist keinem Knoten zugeordnet")).toBe(true);
        expect(has(d, "Ein Knoten hat keinen Namen")).toBe(true);
    });

    it("accepts a «deploy» dependency and reports the wrong direction", () => {
        const { d, db } = servers();
        const a = node(d, "artifact", "schema.sql", 900, 400);
        edge(d, a, db, "dep", "«deploy»");
        expect(texts(d)).toEqual([]);
        edge(d, db, a, "dep", "«deploy»");
        expect(has(d, "«deploy» zeigt vom Knoten „DB-Server“ weg")).toBe(true);
    });

    it("reports a device inside an execution environment, unknown stereotypes and classes in nodes", () => {
        const d = emptyDiagram("vert");
        node(d, "node3d", "«executionEnvironment»\nJVM", 0, 0, { w: 400, h: 400 });
        node(d, "node3d", "«device»\nPC", 20, 40);
        node(d, "node3d", "«Server»\nX", 600, 0);
        node(d, "class", "Kunde", 20, 200);
        expect(has(d, "Gerät „PC“ liegt in der Ausführungsumgebung „JVM“")).toBe(true);
        expect(has(d, "unbekannter Stereotyp «Server»")).toBe(true);
        expect(has(d, "„Kunde“ liegt im Knoten „JVM“")).toBe(true);
    });
});

describe("package diagram", () => {
    it("accepts layered dependencies with keywords", () => {
        const d = emptyDiagram("pak");
        const ui = node(d, "package", "ui", 0, 0), service = node(d, "package", "service", 0, 300), db = node(d, "package", "persistence", 0, 600);
        edge(d, ui, service, "dep", "«import»");
        edge(d, service, db, "dep", "«access»");
        expect(texts(d)).toEqual([]);
        expect(checkUml(d).kinds.has("pak")).toBe(true);
    });

    it("reports cycles, unknown keywords, empty and duplicate names and nested dependencies", () => {
        const d = emptyDiagram("pak");
        const a = node(d, "package", "a", 0, 0), b = node(d, "package", "b", 0, 300);
        edge(d, a, b, "dep", "«include»");
        edge(d, b, a, "dep");
        node(d, "package", "", 600, 0);
        node(d, "package", "a", 600, 300);
        const outer = node(d, "package", "shop", 1000, 0, { w: 500, h: 400 }), inner = node(d, "package", "util", 1050, 60);
        edge(d, outer, inner, "dep");
        const found = texts(d);
        expect(found.some(x => x.includes("Zyklische Abhängigkeit zwischen den Paketen a, b"))).toBe(true);
        expect(found).toContain("Unbekanntes Schlüsselwort «include» an einer Paketabhängigkeit");
        expect(found).toContain("Ein Paket hat keinen Namen");
        expect(found).toContain("Paket „a“ kommt mehrfach vor");
        expect(found.some(x => x.includes("enthaltenen Paket „util“"))).toBe(true);
    });

    it("allows the same name in different parent packages", () => {
        const d = emptyDiagram("pak");
        node(d, "package", "shop", 0, 0, { w: 400, h: 300 });
        node(d, "package", "util", 20, 40);
        node(d, "package", "admin", 600, 0, { w: 400, h: 300 });
        node(d, "package", "util", 620, 40);
        expect(texts(d)).toEqual([]);
    });
});

describe("class, object and state extras", () => {
    it("validates multiplicities", () => {
        for (const ok of [ "1", "0..1", "*", "1..*", "0..n", "2..5", "1, 3..4" ]) expect(validMultiplicity(ok), ok).toBe(true);
        for (const bad of [ "1..", "x", "5..2", "1-*", "..*" ]) expect(validMultiplicity(bad), bad).toBe(false);
    });

    it("reports an invalid multiplicity on an association", () => {
        const d = emptyDiagram("kl");
        const a = node(d, "class", "Kunde", 0, 0, { attrs: "", ops: "" }), b = node(d, "class", "Auftrag", 300, 0, { attrs: "", ops: "" });
        edge(d, a, b, "assoc", "", { m1: "1", m2: "1-*" });
        expect(has(d, "Multiplizität „1-*“ ist ungültig")).toBe(true);
    });

    it("reports typed attributes, link multiplicities and generalisation in object diagrams", () => {
        const d = emptyDiagram("obj");
        const a = node(d, "object", "anna : Kunde", 0, 0, { attrs: "name : String\nalter = 30" });
        const b = node(d, "object", "a1 : Auftrag", 300, 0, { attrs: "nr = 1" });
        edge(d, a, b, "assoc", "", { m2: "*" });
        edge(d, a, b, "inherit");
        const found = texts(d);
        expect(found.some(x => x.includes("1 Attribut hat einen Typ statt eines Werts"))).toBe(true);
        expect(found).toContain("Ein Link zwischen Objekten hat eine Multiplizität");
        expect(found).toContain("Generalisierung zwischen Objekten");
    });

    it("reports a state without a name", () => {
        const d = emptyDiagram("zu");
        const s = node(d, "start", "", 0, 0), z = node(d, "state", " ", 100, 0);
        edge(d, s, z, "flow");
        expect(texts(d)).toContain("Ein Zustand hat keinen Namen");
    });
});

describe("review fixes", () => {
    it("accepts an interface extending an interface", () => {
        const d = emptyDiagram("kl");
        const a = node(d, "class", "IA", 0, 0, { stereo: "interface", attrs: "", ops: "+ a() : void" });
        const b = node(d, "class", "IB", 0, 200, { stereo: "interface", attrs: "", ops: "+ b() : void" });
        edge(d, b, a, "inherit");
        expect(has(d, "Realisierung")).toBe(false);
    });

    it("reads multiplicities case-insensitively and with constraints", () => {
        for (const m of [ "1..N", "0..*{ordered}", "1..* {unique}", "N" ]) expect(validMultiplicity(m), m).toBe(true);
        expect(validMultiplicity("5..2")).toBe(false);
    });

    it("needs an initial state on the top level of a state machine", () => {
        const d = emptyDiagram("zu");
        const k = node(d, "compstate", "Betrieb", 0, 0, { w: 400, h: 300 });
        const s = node(d, "start", "", 40, 60), a = node(d, "state", "An", 120, 120);
        edge(d, s, a, "flow");
        expect(k && texts(d).some(x => /Start/i.test(x))).toBe(true);
    });

    it("treats a completion transition as a hint, not a warning", () => {
        const d = emptyDiagram("zu");
        const s = node(d, "start", "", 0, 0), a = node(d, "state", "Offen", 0, 100), b = node(d, "state", "Geschlossen", 0, 250), e = node(d, "end", "", 0, 400);
        edge(d, s, a, "flow");
        edge(d, a, b, "flow");
        edge(d, b, e, "flow");
        expect(checkUml(d).items.filter(i => i.level === "warn" || i.level === "error")).toEqual([]);
    });

    it("finds duplicate guards that differ only in spaces", () => {
        const d = emptyDiagram("akt");
        const s = node(d, "start", "", 0, 0), x = node(d, "decision", "", 0, 100), a = node(d, "action", "A tun", -150, 200), b = node(d, "action", "B tun", 150, 200);
        const m = node(d, "decision", "", 0, 300), e = node(d, "end", "", 0, 400);
        edge(d, s, x, "flow");
        edge(d, x, a, "flow", "[ja]");
        edge(d, x, b, "flow", "[ ja ]");
        edge(d, a, m, "flow");
        edge(d, b, m, "flow");
        edge(d, m, e, "flow");
        expect(checkUml(d).items.some(i => i.level === "error" && /dieselbe|same/i.test(i.text))).toBe(true);
    });
});

describe("knowledge base rules", () => {
    it("wants a merge before an action with several incoming flows", () => {
        const d = emptyDiagram("akt");
        const s = node(d, "start", "", 0, 0), a = node(d, "action", "Antrag prüfen", 0, 100), x = node(d, "decision", "", 0, 200), e = node(d, "end", "", 0, 300);
        edge(d, s, a, "flow");
        edge(d, a, x, "flow");
        edge(d, x, a, "flow", "[unvollständig]");
        edge(d, x, e, "flow", "[else]");
        expect(has(d, "eingehende Pfeile")).toBe(true);
    });

    it("finds an attribute written twice", () => {
        const d = emptyDiagram("kl");
        node(d, "class", "Kunde", 0, 0, { attrs: "- name : String\n- Name : String", ops: "" });
        expect(has(d, "steht doppelt")).toBe(true);
    });
});

describe("boolean names", () => {
    it("hints at a boolean without is/has/can, not at a good one", () => {
        const d = emptyDiagram("kl");
        node(d, "class", "Kunde", 0, 0, { attrs: "- aktiv : boolean\n- hasRabatt : boolean", ops: "" });
        const items = checkUml(d).items.filter(i => i.text.includes("Wahrheitswert"));
        expect(items.map(i => [ i.level, i.text.includes("aktiv") ])).toEqual([[ "info", true ]]);
    });
});
