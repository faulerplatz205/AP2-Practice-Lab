import { describe, expect, it } from "vitest";
import type { DiagramNode } from "../../types/diagram";
import { createNode, emptyDiagram } from "../diagram";
import { fkPointsTo, parseColumn, referencesTable } from "./columns";

describe("parseColumn", () => {
    it.each([
        [ "PK FK kundenNr INT", true, true, "kundenNr" ],
        [ "PK, FK kundenNr INT", true, true, "kundenNr" ],
        [ "PK/FK kundenNr", true, true, "kundenNr" ],
        [ "pk kundenNr", true, false, "kundenNr" ],
        [ "FK ortId", false, true, "ortId" ],
        [ "name VARCHAR(50)", false, false, "name" ],
        [ "plz : CHAR(5)", false, false, "plz" ],
        [ "kundenNr INT (PK)", true, false, "kundenNr" ],
        [ "bestellNr INT (PK, FK)", true, true, "bestellNr" ],
        [ "kundenNr INT FK", false, true, "kundenNr" ],
        [ "kundenNr INT PRIMARY KEY", true, false, "kundenNr" ],
        [ "kundenNr INT REFERENCES Kunde(kundenNr)", false, true, "kundenNr" ],
        [ "↑kundenNr", false, true, "kundenNr" ],
        [ "#kundenNr INT", false, true, "kundenNr" ],
        [ "PK #bestellNr INT", true, true, "bestellNr" ],
        [ "preis DECIMAL(10,2)", false, false, "preis" ],
    ])("reads %s", (line, pk, fk, name) => {
        const c = parseColumn(line);
        expect([ c.pk, c.fk, c.name ]).toEqual([ pk, fk, name ]);
    });

    it("keeps the type without the key words", () => {
        expect(parseColumn("kundenNr INT PRIMARY KEY").type).toBe("INT");
        expect(parseColumn("bestellNr INT (PK, FK)").type).toBe("INT");
        expect(parseColumn("kundenNr INT REFERENCES Kunde(kundenNr)")).toMatchObject({ type: "INT", ref: "Kunde" });
    });
});

describe("foreign keys", () => {
    const table = (name: string, ...columns: string[]): DiagramNode => Object.assign(createNode(emptyDiagram("rel"), "table"), { text: name, attrs: columns.join("\n") });
    const kunde = table("Kunde", "PK id INT");

    it.each([ "FK kunde_id", "FK kundeId", "FK kundenId", "FK KundeID" ])("%s points to Kunde (PK id)", line => {
        expect(fkPointsTo(parseColumn(line), kunde)).toBe(true);
        expect(referencesTable(table("Bestellung", "PK id", line), kunde)).toBe(true);
    });

    it("follows REFERENCES and the plain name", () => {
        expect(fkPointsTo(parseColumn("chef INT REFERENCES Kunde"), kunde)).toBe(true);
        expect(fkPointsTo(parseColumn("chef INT REFERENCES Artikel"), kunde)).toBe(false);
        expect(fkPointsTo(parseColumn("FK kundenNr"), table("Kunde", "PK kundenNr"))).toBe(true);
        expect(fkPointsTo(parseColumn("FK artikelNr"), table("Kunde", "PK kundenNr"))).toBe(false);
    });
});
