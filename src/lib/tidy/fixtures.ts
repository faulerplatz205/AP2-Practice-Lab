import type { Diagram, DiagramEdge, DiagramMode, DiagramNode, NodeType } from "../../types/diagram";
import { createNode, emptyDiagram } from "../diagram";
import { buildFromRows, parseTaskList } from "../netzplan/taskList";
import { fitToContent } from "../uml/size";

/** [type, center x, center y, initial values] */
type FixtureNode = [NodeType, number, number, Partial<DiagramNode>?];
/** [from, to, label, kind, more fields]: from/to are indices into `nodes` */
type FixtureEdge = [number, number, string?, DiagramEdge["kind"]?, Partial<DiagramEdge>?];

interface Fixture {
    mode: DiagramMode;
    nodes: FixtureNode[];
    edges: FixtureEdge[];
}

/** Complex drawings of every kind, used by the tidy layout tests. */
const FIXTURES: Record<string, Fixture> = {
    // fork with three branches, a decision inside one branch, merge, and a loop back
    aktFork: {
        mode: "akt",
        nodes: [
            [ "start", 300, 20 ], [ "action", 300, 100, { text: "Bestellung prüfen" }], [ "bar", 260, 190, { w: 200, h: 8 }],
            [ "action", 80, 280, { text: "Rechnung erstellen" }], [ "action", 330, 300, { text: "Ware kommissionieren" }], [ "action", 560, 260, { text: "Kunde informieren" }],
            [ "decision", 330, 400 ], [ "action", 200, 480, { text: "Nachbestellen" }], [ "decision", 380, 560 ],
            [ "bar", 300, 650, { w: 200, h: 8 }], [ "action", 300, 730, { text: "Ware versenden" }], [ "end", 300, 820 ],
        ],
        edges: [
            [ 0, 1 ], [ 1, 2 ], [ 2, 3 ], [ 2, 4 ], [ 2, 5 ], [ 4, 6 ], [ 6, 7, "[fehlt]" ], [ 6, 8, "[da]" ], [ 7, 8 ],
            [ 3, 9 ], [ 8, 9 ], [ 5, 9 ], [ 9, 10 ], [ 10, 11 ],
        ],
    },
    // decision with three guarded branches, nested fork in one branch, loop back up, flow end
    aktNested: {
        mode: "akt",
        nodes: [
            [ "start", 400, 20 ], [ "action", 420, 90, { text: "Antrag erfassen" }], [ "decision", 380, 180 ],
            [ "action", 120, 260, { text: "Ablehnen" }], [ "action", 420, 280, { text: "Prüfen" }], [ "action", 700, 250, { text: "Rückfrage stellen" }],
            [ "bar", 420, 370, { w: 200, h: 8 }], [ "action", 300, 450, { text: "Bonität prüfen" }], [ "action", 560, 450, { text: "Dokumente prüfen" }],
            [ "bar", 420, 540, { w: 200, h: 8 }], [ "action", 400, 620, { text: "Bescheid erstellen" }], [ "action", 420, 700, { text: "Genehmigen" }], [ "end", 400, 790 ],
            [ "flowend", 120, 380 ], [ "decision", 420, 50 ],
        ],
        edges: [
            [ 0, 14 ], [ 14, 1 ], [ 1, 2 ], [ 2, 3, "[unvollständig]" ], [ 2, 4, "[vollständig]" ], [ 2, 5, "[unklar]" ], [ 5, 14 ], [ 3, 13 ],
            [ 4, 6 ], [ 6, 7 ], [ 6, 8 ], [ 7, 9 ], [ 8, 9 ], [ 9, 10 ], [ 10, 11 ], [ 11, 12 ],
        ],
    },
    // three partitions, fork across partitions
    aktLanes: {
        mode: "akt",
        nodes: [
            [ "lane", 130, 400, { w: 260, h: 800, text: "Kunde" }], [ "lane", 390, 400, { w: 260, h: 800, text: "Shop" }], [ "lane", 650, 400, { w: 260, h: 800, text: "Lager" }],
            [ "start", 130, 60 ], [ "action", 130, 140, { text: "Bestellen" }], [ "action", 390, 220, { text: "Bestellung annehmen" }],
            [ "bar", 500, 300, { w: 300, h: 8 }], [ "action", 390, 380, { text: "Rechnung senden" }], [ "action", 650, 380, { text: "Ware packen" }],
            [ "bar", 500, 470, { w: 300, h: 8 }], [ "action", 130, 560, { text: "Bezahlen" }], [ "end", 130, 650 ],
        ],
        edges: [[ 3, 4 ], [ 4, 5 ], [ 5, 6 ], [ 6, 7 ], [ 6, 8 ], [ 7, 9 ], [ 8, 9 ], [ 9, 10 ], [ 10, 11 ]],
    },
    zuComplex: {
        mode: "zu",
        nodes: [
            [ "start", 300, 20 ], [ "state", 300, 110, { text: "Leerlauf" }], [ "state", 120, 240, { text: "Wartung" }], [ "state", 480, 240, { text: "Bereit" }],
            [ "decision", 480, 340 ], [ "state", 360, 440, { text: "Ausgabe" }], [ "state", 620, 440, { text: "Fehler" }], [ "end", 480, 560 ],
        ],
        edges: [
            [ 0, 1 ], [ 1, 3, "einschalten" ], [ 3, 1, "ausschalten" ], [ 1, 2, "service" ], [ 2, 1, "fertig" ], [ 3, 4, "auswählen" ],
            [ 4, 5, "[Guthaben]" ], [ 4, 6, "[kein Guthaben]" ], [ 5, 3, "ausgegeben" ], [ 6, 6, "retry" ], [ 6, 7 ],
        ],
    },
    // composite state with its own initial state, a history pseudostate and a nested composite, plus outer states
    zuComposite: {
        mode: "zu",
        nodes: [
            [ "start", 100, 20 ], [ "state", 100, 120, { text: "Aus" }], [ "compstate", 420, 330, { text: "Betrieb", w: 600, h: 440 }],
            [ "start", 220, 190 ], [ "state", 300, 260, { text: "Heizen" }], [ "state", 520, 230, { text: "Kühlen" }], [ "history", 230, 470 ],
            [ "compstate", 540, 440, { text: "Lüften", w: 280, h: 160 }], [ "start", 460, 420 ], [ "state", 560, 470, { text: "Stufe 1" }],
            [ "state", 860, 300, { text: "Störung" }], [ "end", 860, 520 ],
        ],
        edges: [
            [ 0, 1 ], [ 1, 2, "einschalten" ], [ 2, 1, "ausschalten" ], [ 3, 4 ], [ 4, 5, "zuWarm" ], [ 5, 4, "zuKalt" ], [ 5, 7, "lüften" ],
            [ 8, 9 ], [ 2, 10, "fehler" ], [ 10, 6, "behoben" ], [ 10, 11, "defekt" ],
        ],
    },
    ucComplex: {
        mode: "uc",
        nodes: [
            [ "boundary", 400, 300, { w: 460, h: 600, text: "Bibliothek" }], [ "actor", 60, 200, { text: "Leser" }], [ "actor", 60, 420, { text: "Student" }],
            [ "actor", 760, 300, { text: "Bibliothekar" }], [ "usecase", 300, 100, { text: "Buch suchen" }], [ "usecase", 300, 220, { text: "Buch ausleihen" }],
            [ "usecase", 500, 320, { text: "Ausweis prüfen" }], [ "usecase", 300, 400, { text: "Gebühr zahlen" }], [ "usecase", 500, 480, { text: "Buch zurückgeben" }],
            [ "usecase", 300, 540, { text: "Bestand pflegen" }],
        ],
        edges: [
            [ 1, 4, "", "assoc" ], [ 1, 5, "", "assoc" ], [ 2, 1, "", "inherit" ], [ 5, 6, "", "include" ], [ 7, 8, "", "extend" ],
            [ 1, 8, "", "assoc" ], [ 3, 9, "", "assoc" ], [ 3, 6, "", "assoc" ], [ 9, 6, "", "include" ],
        ],
    },
    klComplex: {
        mode: "kl",
        nodes: [
            [ "class", 400, 40, { text: "Person", stereo: "abstract", attrs: "- name: String\n- geburt: Date", ops: "+ alter(): int" }],
            [ "class", 700, 40, { text: "Druckbar", stereo: "interface", attrs: "", ops: "+ drucken(): void" }],
            [ "class", 200, 260, { text: "Kunde", attrs: "- kundenNr: int", ops: "+ bestellen(): void" }],
            [ "class", 500, 260, { text: "Mitarbeiter", attrs: "- personalNr: int", ops: "" }],
            [ "class", 760, 260, { text: "Rechnung", attrs: "- nr: int\n- summe: double", ops: "+ drucken(): void" }],
            [ "class", 200, 480, { text: "Bestellung", attrs: "- datum: Date", ops: "+ summe(): double" }],
            [ "class", 500, 480, { text: "Position", attrs: "- menge: int", ops: "" }],
            [ "class", 760, 480, { text: "Artikel", attrs: "- preis: double", ops: "" }],
            [ "class", 1000, 260, { text: "Adresse", attrs: "- ort: String", ops: "" }],
            [ "class", 500, 680, { text: "Manager", attrs: "", ops: "" }],
        ],
        edges: [
            [ 2, 0, "", "inherit" ], [ 3, 0, "", "inherit" ], [ 4, 1, "", "realize" ], [ 9, 3, "", "inherit" ],
            [ 2, 5, "gibt auf", "assoc", { m1: "1", m2: "0..*" }], [ 5, 6, "", "comp", { m2: "1..*" }], [ 6, 7, "", "assoc", { m1: "0..*", m2: "1" }],
            [ 5, 4, "", "dir", { m1: "0..1", m2: "1" }], [ 2, 8, "", "aggr", { m2: "1..*" }], [ 3, 5, "bearbeitet", "assoc", { m1: "1", m2: "0..*" }],
        ],
    },
    // twelve classes in a rough sketch, with a self association and an unconnected enumeration (reviewer case)
    klBig: {
        mode: "kl",
        nodes: [
            [ "class", 280, 580, { text: "Person", stereo: "abstract", attrs: "# name : String\n# geburtsdatum : Date", ops: "+ getAlter() : int" }],
            [ "class", 820, 40, { text: "Kunde", attrs: "- kundenNr : int", ops: "+ bestellen(a : Artikel) : Bestellung" }],
            [ "class", 100, 300, { text: "Mitarbeiter", attrs: "- personalNr : int\n- gehalt : double", ops: "+ befoerdern() : void" }],
            [ "class", 600, 420, { text: "Bestellung", attrs: "- bestellNr : int\n- datum : Date", ops: "+ berechneSumme() : double" }],
            [ "class", 900, 560, { text: "Position", attrs: "- menge : int", ops: "+ getPreis() : double" }],
            [ "class", 40, 60, { text: "Artikel", attrs: "- artikelNr : int\n- preis : double", ops: "+ getPreis() : double" }],
            [ "class", 450, 120, { text: "Lager", attrs: "- ort : String", ops: "+ einlagern(a : Artikel) : void" }],
            [ "class", 700, 250, { text: "Zahlbar", stereo: "interface", attrs: "", ops: "+ bezahlen(betrag : double) : boolean" }],
            [ "class", 300, 400, { text: "Rechnung", attrs: "- rechnungsNr : int", ops: "+ bezahlen(betrag : double) : boolean" }],
            [ "class", 880, 300, { text: "Adresse", attrs: "- strasse : String\n- plz : String", ops: "+ toString() : String" }],
            [ "class", 520, 600, { text: "Status", stereo: "enum", attrs: "OFFEN\nBEZAHLT\nVERSENDET", ops: "" }],
            [ "class", 150, 500, { text: "Abteilung", attrs: "- name : String", ops: "+ getLeiter() : Mitarbeiter" }],
        ],
        edges: [
            [ 1, 0, "", "inherit" ], [ 2, 0, "", "inherit" ], [ 1, 3, "gibt auf", "assoc", { m1: "1", m2: "0..*" }], [ 3, 4, "", "comp", { m1: "1", m2: "1..*" }],
            [ 4, 5, "", "dir", { m1: "0..*", m2: "1" }], [ 6, 5, "", "aggr", { m1: "1", m2: "0..*" }], [ 8, 7, "", "realize" ],
            [ 3, 8, "", "assoc", { m1: "1", m2: "0..1" }], [ 0, 9, "", "assoc", { m1: "1", m2: "1..*" }], [ 3, 10, "", "dep" ],
            [ 11, 2, "", "aggr", { m1: "1", m2: "1..*" }], [ 2, 2, "leitet", "assoc", { m1: "0..1", m2: "0..*" }],
        ],
    },
    objLinks: {
        mode: "obj",
        nodes: [
            [ "object", 100, 300, { text: "k1: Kunde", attrs: "kundenNr = 7" }], [ "object", 400, 60, { text: "b1: Bestellung", attrs: "nr = 1" }],
            [ "object", 700, 300, { text: "b2: Bestellung", attrs: "nr = 2" }], [ "object", 300, 500, { text: "a1: Adresse", attrs: "ort = Köln" }],
            [ "object", 900, 60, { text: "p1: Position", attrs: "menge = 2" }], [ "object", 900, 500, { text: "p2: Position", attrs: "menge = 1" }],
        ],
        edges: [[ 0, 1, "", "assoc" ], [ 0, 2, "", "assoc" ], [ 0, 3, "", "assoc" ], [ 1, 4, "", "assoc" ], [ 2, 5, "", "assoc" ], [ 2, 4, "", "assoc" ]],
    },
    // reviewer cases (R1, R3)
    aktLanesR1: {
        mode: "akt",
        nodes: [
            [ "lane", 150, 450, { w: 300, h: 900, text: "Kunde" }], [ "lane", 450, 450, { w: 300, h: 900, text: "Vertrieb" }], [ "lane", 750, 450, { w: 300, h: 900, text: "Lager" }],
            [ "start", 150, 35 ], [ "action", 150, 110, { text: "Bestellung aufgeben" }], [ "action", 450, 210, { text: "Bestellung prüfen" }], [ "decision", 450, 300 ],
            [ "action", 450, 410, { text: "Absage senden" }], [ "bar", 750, 384, { w: 200, h: 8 }], [ "action", 750, 480, { text: "Ware kommissionieren" }],
            [ "action", 450, 480, { text: "Rechnung erstellen" }], [ "bar", 750, 564, { w: 200, h: 8 }], [ "action", 750, 650, { text: "Ware versenden" }],
            [ "action", 150, 750, { text: "Ware empfangen" }], [ "decision", 150, 820 ], [ "end", 150, 876 ], [ "objnode", 450, 563, { text: "Rechnung" }],
        ],
        edges: [
            [ 3, 4 ], [ 4, 5 ], [ 5, 6 ], [ 6, 7, "[nicht lieferbar]" ], [ 6, 8, "[lieferbar]" ], [ 8, 9 ], [ 8, 10 ], [ 9, 11 ], [ 10, 16 ], [ 16, 11 ],
            [ 11, 12 ], [ 12, 13 ], [ 13, 14 ], [ 7, 14 ], [ 14, 15 ],
        ],
    },
    zuR1: {
        mode: "zu",
        nodes: [
            [ "start", 500, 300 ], [ "state", 100, 600, { text: "Aus" }], [ "state", 800, 100, { text: "Bereit", attrs: "entry / selbsttest()" }],
            [ "state", 300, 50, { text: "Heizen", attrs: "do / heizen()" }], [ "state", 600, 650, { text: "Warmhalten" }],
            [ "state", 900, 500, { text: "Störung", attrs: "entry / alarm()" }], [ "decision", 200, 300 ], [ "end", 700, 400 ],
        ],
        edges: [
            [ 0, 1 ], [ 1, 2, "einschalten" ], [ 2, 3, "start [Wasser vorhanden]" ], [ 3, 6, "temperaturErreicht" ], [ 6, 4, "[warmhalten = ja]" ], [ 6, 2, "[else]" ],
            [ 4, 2, "nach(30 min)" ], [ 2, 1, "ausschalten" ], [ 3, 5, "überhitzt" ], [ 5, 1, "reset" ], [ 4, 4, "tick / nachheizen()" ], [ 1, 7, "stecker ziehen" ], [ 3, 3, "tick" ],
        ],
    },
    ucR1: {
        mode: "uc",
        nodes: [
            [ "boundary", 450, 350, { w: 600, h: 600, text: "Bibliothekssystem" }], [ "actor", 800, 100, { text: "Leser" }], [ "actor", 100, 600, { text: "Bibliothekar" }],
            [ "actor", 900, 500, { text: "Student" }], [ "actor", 50, 200, { text: "Zahlungsdienst" }], [ "usecase", 300, 400, { text: "Medium suchen" }],
            [ "usecase", 600, 200, { text: "Medium ausleihen" }], [ "usecase", 400, 100, { text: "Ausweis prüfen" }], [ "usecase", 700, 600, { text: "Medium zurückgeben" }],
            [ "usecase", 200, 500, { text: "Mahngebühr zahlen" }], [ "usecase", 500, 650, { text: "Medium verlängern" }], [ "usecase", 300, 250, { text: "Bestand pflegen" }],
            [ "usecase", 600, 450, { text: "Anmelden" }],
        ],
        edges: [
            [ 1, 5, "", "assoc" ], [ 1, 6, "", "assoc" ], [ 6, 7, "", "include" ], [ 1, 8, "", "assoc" ], [ 9, 8, "", "extend" ], [ 4, 9, "", "assoc" ],
            [ 1, 10, "", "assoc" ], [ 10, 7, "", "include" ], [ 2, 11, "", "assoc" ], [ 11, 12, "", "include" ], [ 3, 1, "", "inherit" ], [ 2, 6, "", "assoc" ], [ 6, 12, "", "include" ],
        ],
    },
    erTernary: {
        mode: "er",
        nodes: [
            [ "entity", 100, 100, { text: "Dozent" }], [ "entity", 500, 100, { text: "Kurs" }], [ "entity", 300, 400, { text: "Raum" }], [ "relship", 300, 200, { text: "hält" }],
            [ "erattr", 50, 0, { text: "DozentNr", stereo: "key" }], [ "erattr", 550, 0, { text: "KursNr", stereo: "key" }], [ "erattr", 300, 550, { text: "RaumNr", stereo: "key" }],
        ],
        edges: [[ 0, 3, "n", "erl" ], [ 1, 3, "m", "erl" ], [ 2, 3, "p", "erl" ], [ 4, 0, "", "erl" ], [ 5, 1, "", "erl" ], [ 6, 2, "", "erl" ]],
    },
    erR3: {
        mode: "er",
        nodes: [
            [ "entity", 100, 300, { text: "Kunde" }], [ "relship", 350, 300, { text: "bestellt" }], [ "entity", 600, 300, { text: "Bestellung" }],
            [ "relship", 850, 300, { text: "enthält" }], [ "entity", 1100, 300, { text: "Artikel" }], [ "entity", 100, 600, { text: "Mitarbeiter" }],
            [ "relship", 100, 850, { text: "leitet" }], [ "relship", 350, 600, { text: "betreut" }],
            [ "erattr", 50, 150, { text: "KundenNr", stereo: "key" }], [ "erattr", 200, 150, { text: "Name" }], [ "erattr", 550, 150, { text: "BestellNr", stereo: "key" }],
            [ "erattr", 700, 150, { text: "Datum" }], [ "erattr", 1050, 150, { text: "ArtikelNr", stereo: "key" }], [ "erattr", 1200, 150, { text: "Preis" }],
            [ "erattr", 850, 450, { text: "Menge" }], [ "erattr", 0, 700, { text: "PersNr", stereo: "key" }], [ "erattr", 250, 450, { text: "Telefon", stereo: "multi" }],
            [ "erattr", 700, 450, { text: "Gesamtpreis", stereo: "derived" }],
        ],
        edges: [
            [ 0, 1, "1", "erl" ], [ 1, 2, "n", "erl" ], [ 2, 3, "n", "erl" ], [ 3, 4, "m", "erl" ], [ 5, 6, "1", "erl" ], [ 6, 5, "n", "erl" ], [ 5, 7, "1", "erl" ], [ 7, 0, "n", "erl" ],
            [ 8, 0, "", "erl" ], [ 9, 0, "", "erl" ], [ 10, 2, "", "erl" ], [ 11, 2, "", "erl" ], [ 12, 4, "", "erl" ], [ 13, 4, "", "erl" ], [ 14, 3, "", "erl" ],
            [ 15, 5, "", "erl" ], [ 16, 0, "", "erl" ], [ 17, 2, "", "erl" ],
        ],
    },
    relR3: {
        mode: "rel",
        nodes: [
            [ "table", 100, 100, { text: "Kunde", attrs: "PK kundenNr INT\nname VARCHAR(50)\nFK plz CHAR(5)" }], [ "table", 100, 400, { text: "Ort", attrs: "PK plz CHAR(5)\nort VARCHAR(40)" }],
            [ "table", 450, 100, { text: "Bestellung", attrs: "PK bestellNr INT\ndatum DATE\nFK kundenNr INT" }],
            [ "table", 800, 100, { text: "Bestellposition", attrs: "PK FK bestellNr INT\nPK FK artikelNr INT\nmenge INT" }],
            [ "table", 800, 400, { text: "Artikel", attrs: "PK artikelNr INT\nbezeichnung VARCHAR(50)\npreis DECIMAL(8,2)" }],
        ],
        edges: [[ 0, 1, "", "fk", { m1: "n", m2: "1" }], [ 2, 0, "", "fk", { m1: "n", m2: "1" }], [ 3, 2, "", "fk", { m1: "n", m2: "1" }], [ 3, 4, "", "fk", { m1: "n", m2: "1" }]],
    },
    objComplex: {
        mode: "obj",
        nodes: [
            [ "object", 100, 100, { text: "k1: Kunde", attrs: "kundenNr = 7" }], [ "object", 400, 60, { text: "b1: Bestellung", attrs: "datum = 1.3." }],
            [ "object", 420, 260, { text: "b2: Bestellung", attrs: "datum = 2.3." }], [ "object", 700, 120, { text: "p1: Position", attrs: "menge = 2" }],
            [ "object", 720, 320, { text: ":Artikel", attrs: "preis = 9.99" }],
        ],
        edges: [[ 0, 1, "", "assoc" ], [ 0, 2, "", "assoc" ], [ 1, 3, "", "assoc" ], [ 3, 4, "", "dir" ], [ 2, 4, "", "assoc" ]],
    },
    kompComplex: {
        mode: "komp",
        nodes: [
            [ "component", 120, 100, { text: "Webshop" }], [ "component", 460, 100, { text: "Bestellservice" }], [ "component", 460, 320, { text: "Zahlung" }],
            [ "component", 800, 200, { text: "Lager" }], [ "iface", 300, 100, { text: "IBestellung" }], [ "iface", 460, 220, { text: "IZahlung" }],
            [ "iface", 640, 150, { text: "ILager" }],
        ],
        edges: [[ 1, 4, "", "assoc" ], [ 0, 4, "", "require" ], [ 2, 5, "", "assoc" ], [ 1, 5, "", "require" ], [ 3, 6, "", "assoc" ], [ 1, 6, "", "require" ]],
    },
    vertComplex: {
        mode: "vert",
        nodes: [
            [ "node3d", 140, 140, { text: "Client-PC", w: 220, h: 160 }], [ "node3d", 520, 140, { text: "Webserver", w: 240, h: 180 }], [ "node3d", 880, 140, { text: "DB-Server", w: 220, h: 160 }],
            [ "artifact", 140, 160, { text: "browser.exe" }], [ "artifact", 520, 170, { text: "shop.war" }], [ "artifact", 880, 160, { text: "shop.db" }],
        ],
        edges: [[ 0, 1, "HTTPS", "assoc" ], [ 1, 2, "TCP/IP", "assoc" ], [ 4, 5, "", "dep" ]],
    },
    pakComplex: {
        mode: "pak",
        nodes: [
            [ "package", 140, 100, { text: "gui" }], [ "package", 480, 100, { text: "logik" }], [ "package", 820, 100, { text: "daten" }],
            [ "package", 480, 360, { text: "util" }],
        ],
        edges: [[ 0, 1, "", "import" ], [ 1, 2, "", "access" ], [ 0, 3, "", "dep" ], [ 1, 3, "", "import" ], [ 2, 3, "", "dep" ]],
    },
    erComplex: {
        mode: "er",
        nodes: [
            [ "entity", 120, 200, { text: "Kunde" }], [ "relship", 340, 200, { text: "bestellt" }], [ "entity", 560, 200, { text: "Bestellung" }],
            [ "relship", 560, 400, { text: "enthält" }], [ "entity", 560, 600, { text: "Artikel" }], [ "relship", 340, 600, { text: "liefert" }],
            [ "entity", 120, 600, { text: "Lieferant" }],
            [ "erattr", 60, 80, { text: "KdNr", stereo: "key" }], [ "erattr", 190, 80, { text: "Name" }], [ "erattr", 560, 80, { text: "BestNr", stereo: "key" }],
            [ "erattr", 700, 600, { text: "ArtNr", stereo: "key" }], [ "erattr", 640, 700, { text: "Preis" }], [ "erattr", 700, 400, { text: "Menge" }],
            [ "erattr", 60, 700, { text: "LiefNr", stereo: "key" }], [ "erattr", 190, 300, { text: "Telefon", stereo: "multi" }],
        ],
        edges: [
            [ 0, 1, "1", "erl" ], [ 1, 2, "n", "erl" ], [ 2, 3, "n", "erl" ], [ 3, 4, "m", "erl" ], [ 6, 5, "1", "erl" ], [ 5, 4, "n", "erl" ],
            [ 7, 0, "", "erl" ], [ 8, 0, "", "erl" ], [ 9, 2, "", "erl" ], [ 10, 4, "", "erl" ], [ 11, 4, "", "erl" ], [ 12, 3, "", "erl" ],
            [ 13, 6, "", "erl" ], [ 14, 0, "", "erl" ],
        ],
    },
    relComplex: {
        mode: "rel",
        nodes: [
            [ "table", 140, 100, { text: "Kunde", attrs: "PK kundenNr INT\nname VARCHAR(50)" }],
            [ "table", 480, 100, { text: "Bestellung", attrs: "PK bestNr INT\nFK kundenNr INT\ndatum DATE" }],
            [ "table", 480, 360, { text: "Position", attrs: "PK,FK bestNr INT\nPK,FK artNr INT\nmenge INT" }],
            [ "table", 820, 360, { text: "Artikel", attrs: "PK artNr INT\nFK liefNr INT\npreis DECIMAL" }],
            [ "table", 820, 100, { text: "Lieferant", attrs: "PK liefNr INT\nname VARCHAR(50)" }],
        ],
        edges: [
            [ 1, 0, "", "fk", { m1: "n", m2: "1" }], [ 2, 1, "", "fk", { m1: "n", m2: "1" }], [ 2, 3, "", "fk", { m1: "n", m2: "1" }],
            [ 3, 4, "", "fk", { m1: "n", m2: "1" }],
        ],
    },
    seqComplex: {
        mode: "seq",
        nodes: [
            [ "actline", 100, 220, { text: "Kunde", h: 420 }], [ "lifeline", 320, 220, { text: ":Shop", h: 420 }], [ "lifeline", 540, 220, { text: ":Lager", h: 420 }],
            [ "lifeline", 760, 220, { text: ":Bank", h: 420 }],
        ],
        edges: [
            [ 0, 1, "bestellen()", "msg", { y: 80 }], [ 1, 2, "prüfen()", "msg", { y: 120 }], [ 2, 1, "ok", "reply", { y: 160 }],
            [ 1, 1, "berechnen()", "msg", { y: 200 }], [ 1, 3, "abbuchen()", "msg", { y: 260 }], [ 3, 1, "bestätigt", "reply", { y: 310 }],
            [ 1, 0, "Bestätigung", "reply", { y: 360 }],
        ],
    },
    freiComplex: {
        mode: "frei",
        nodes: [
            [ "rect", 120, 100, { text: "Eingabe" }], [ "diamond", 360, 100, { text: "gültig?" }], [ "rect", 600, 40, { text: "Speichern" }],
            [ "rect", 600, 200, { text: "Fehler" }], [ "ellipse", 860, 120, { text: "Ende" }], [ "text", 360, 300, { text: "Hinweis" }],
        ],
        edges: [[ 0, 1 ], [ 1, 2, "ja" ], [ 1, 3, "nein" ], [ 2, 4 ], [ 3, 0 ]],
    },
};

/** Activity list with 13 activities where arrows skip columns (reviewer case A-M). */
const NETZ_AM = [
    "Nr;Bezeichnung;Dauer;Vorgänger", "A;Kickoff;1;-", "B;Analyse;3;A", "C;Konzept;4;A", "D;Hardware bestellen;6;A", "E;Datenbank;2,5;B",
    "F;Backend;5;B,C", "G;Frontend;4;C", "H;Server einrichten;2;D", "I;Integration;3;E,F,G", "J;Deployment;1;H,I", "K;Schulung;2;G", "L;Test;3;I", "M;Abnahme;1;J,K,L",
].join("\n");

export const FIXTURE_KEYS = [ ...Object.keys(FIXTURES), "netzAM" ];

/** Builds the fixture `key` as a new drawing (positions deliberately rough, like a user's sketch). */
export function fixture(key: string): Diagram {
    if (key === "netzAM") {
        const d = emptyDiagram("netz");
        buildFromRows(d, parseTaskList(NETZ_AM).rows, true);
        return d;
    }
    const f = FIXTURES[key];
    const d = emptyDiagram(f.mode);
    const nodes = f.nodes.map(([ type, cx, cy, preset ]) => {
        const n = createNode(d, type);
        Object.assign(n, preset ?? {});
        n.x = cx - n.w / 2;
        n.y = cy - n.h / 2;
        fitToContent(n);
        d.nodes.push(n);
        return n;
    });
    for (const [ a, b, label, kind, extra ] of f.edges) {
        d.edges.push({ id: d.next++, from: nodes[a].id, to: nodes[b].id, label: label ?? "", kind: kind ?? "flow", ...extra });
    }
    if (f.mode === "seq") {
        // messages store their height relative to the source lifeline
        for (const e of d.edges) e.y = (e.y ?? 60) + 10;
    }
    return d;
}
