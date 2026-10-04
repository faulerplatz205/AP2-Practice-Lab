import { describe, expect, it } from "vitest";
import { candidateKeys, checkNormalization, closure, type NormTable } from "./normalize";
import { columnKey, parseColumn } from "./columns";
import { NORM_SCENARIOS } from "../../data/normalization";

let id = 0;
const table = (name: string, ...columns: string[]): NormTable => ({ id: ++id, name, columns: columns.map(parseColumn) });
const kinds = (tables: NormTable[], scenario = NORM_SCENARIOS.invoice): string[] => checkNormalization(tables, scenario).map(f => f.kind);

const SOLUTION = (): NormTable[] => [
    table("Kunde", "PK kundenNr", "kundenname", "FK plz"),
    table("Ort", "PK plz", "ort"),
    table("Rechnung", "PK rechnungsNr", "datum", "FK kundenNr"),
    table("Artikel", "PK artikelNr", "bezeichnung", "einzelpreis"),
    table("Position", "PK FK rechnungsNr", "PK FK artikelNr", "menge"),
];

describe("columns", () => {
    it("parses PK/FK markers, name and type", () => {
        expect(parseColumn("PK kundenNr INT")).toEqual({ pk: true, fk: false, name: "kundenNr", type: "INT" });
        expect(parseColumn("PK, FK bestellNr : INTEGER")).toEqual({ pk: true, fk: true, name: "bestellNr", type: "INTEGER" });
        expect(parseColumn("fk ortId")).toEqual({ pk: false, fk: true, name: "ortId", type: "" });
        expect(parseColumn("pkwNr VARCHAR(10)")).toEqual({ pk: false, fk: false, name: "pkwNr", type: "VARCHAR(10)" });
    });

    it("compares column names loosely", () => {
        expect(columnKey("Kunden_Nummer")).toBe("kundennr");
        expect(columnKey("kundenId")).toBe("kundennr");
        expect(columnKey("Straße")).toBe("strasse");
    });
});

describe("dependencies", () => {
    const deps = NORM_SCENARIOS.invoice.dependencies;

    it("computes the closure", () => {
        expect([ ...closure([ "rechnungsnr" ], deps) ].sort()).toEqual([ "datum", "kundenname", "kundennr", "ort", "plz", "rechnungsnr" ]);
    });

    it("finds the composite key of the whole source table", () => {
        const all = NORM_SCENARIOS.invoice.attributes.map(a => a.id);
        expect(candidateKeys(all, deps)).toEqual([[ "rechnungsnr", "artikelnr" ]]);
    });
});

describe("checkNormalization", () => {
    it("accepts the model solution", () => {
        expect(kinds(SOLUTION())).toEqual([]);
    });

    it("accepts English names and an extra surrogate key", () => {
        const tables = [
            table("Customer", "PK customerNo", "customerName", "FK zip"),
            table("City", "PK zip", "city"),
            table("Invoice", "PK invoiceNo", "date", "FK customerNo"),
            table("Article", "PK articleNo", "description", "unitPrice"),
            table("Line", "PK lineId", "FK invoiceNo", "FK articleNo", "quantity"),
        ];
        expect(kinds(tables)).toEqual([ "unknown" ]);
    });

    it("reports the unnormalized table: partial and transitive dependencies", () => {
        const all = table("Rechnung", "PK rechnungsNr", "datum", "kundenNr", "kundenname", "plz", "ort", "PK artikelNr", "bezeichnung", "einzelpreis", "menge");
        const f = checkNormalization([ all ], NORM_SCENARIOS.invoice);
        expect(f.map(x => x.kind)).toEqual([ "partial", "partial" ]);
        expect(f[0]).toMatchObject({ key: [ "rechnungsnr" ], columns: [ "datum", "kundennr", "kundenname", "plz", "ort" ] });
        expect(f[1]).toMatchObject({ key: [ "artikelnr" ], columns: [ "bezeichnung", "einzelpreis" ] });
    });

    it("reports a transitive dependency (3NF)", () => {
        const tables = SOLUTION().filter(t => t.name !== "Kunde" && t.name !== "Ort");
        tables.push(table("Kunde", "PK kundenNr", "kundenname", "plz", "ort"));
        const f = checkNormalization(tables, NORM_SCENARIOS.invoice);
        expect(f.map(x => x.kind)).toEqual([ "transitive" ]);
        expect(f[0]).toMatchObject({ via: [ "plz" ], columns: [ "ort" ] });
    });

    it("reports a partial dependency (2NF)", () => {
        const tables = SOLUTION().filter(t => t.name !== "Position" && t.name !== "Artikel");
        tables.push(table("Position", "PK rechnungsNr", "PK artikelNr", "bezeichnung", "einzelpreis", "menge"));
        const f = checkNormalization(tables, NORM_SCENARIOS.invoice);
        expect(f.map(x => x.kind)).toEqual([ "partial" ]);
        expect(f[0]).toMatchObject({ key: [ "artikelnr" ], columns: [ "bezeichnung", "einzelpreis" ] });
    });

    it("reports missing attributes, a wrong key and columns that do not belong together", () => {
        const tables = SOLUTION().filter(t => t.name !== "Ort");
        tables[0] = table("Kunde", "PK kundenname", "kundenNr", "FK plz");
        tables.push(table("Mix", "PK bezeichnung", "PK kundenname"));
        expect(kinds(tables)).toEqual([ "keyTooSmall", "noKey", "missing", "redundant", "redundant" ]);
    });

    it("reports a key that is not minimal", () => {
        const tables = SOLUTION();
        tables[1] = table("Ort", "PK plz", "PK ort");
        expect(kinds(tables)).toEqual([ "keyTooBig" ]);
    });

    it("reports non-atomic columns and repeating groups (1NF)", () => {
        const tables = [
            table("Kurs", "PK kursNr", "titel", "datum", "FK dozentNr"),
            table("Dozent", "PK dozentNr", "dozentName"),
            table("Teilnehmer", "PK teilnehmerNr", "name"),
            table("Buchung", "PK FK kursNr", "PK FK teilnehmerNr", "bezahlt", "titel1", "titel2"),
        ];
        expect(kinds(tables, NORM_SCENARIOS.course)).toEqual([ "nonAtomic", "repeating", "missing" ]);
    });
});
