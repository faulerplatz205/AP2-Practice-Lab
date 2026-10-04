import { columnKey } from "../lib/db/columns";
import type { Dependency, NormAttribute, NormScenario } from "../lib/db/normalize";

/** Persisted in `Diagram.norm.id`: never rename. Texts: `normText` in src/i18n/database.ts */
export type NormScenarioId = "invoice" | "course" | "project";

export interface NormScenarioInfo extends NormScenario {
    /** Lines of the model solution, [n table, 1 table] as indices into `normText.<id>.solution` */
    solutionEdges: [number, number][];
}

/** First name German, second English, then further accepted spellings. */
const attr = (...names: string[]): NormAttribute => ({ id: columnKey(names[0]), names });
const dep = (lhs: string[], rhs: string[]): Dependency => [ lhs.map(columnKey), rhs.map(columnKey) ];

export const NORM_SCENARIOS: Record<NormScenarioId, NormScenarioInfo> = {
    invoice: {
        attributes: [
            attr("rechnungsNr", "invoiceNo", "rechnungsnummer", "rechnungNr"),
            attr("datum", "date", "rechnungsdatum", "invoiceDate"),
            attr("kundenNr", "customerNo", "kundeNr"),
            attr("kundenname", "customerName", "name", "kunde", "customer"),
            attr("plz", "zip", "postleitzahl", "zipCode", "postcode"),
            attr("ort", "city", "stadt", "wohnort"),
            attr("artikelNr", "articleNo", "itemNo", "productNo"),
            attr("bezeichnung", "description", "artikelbezeichnung", "artikelname", "articleName", "itemName", "productName"),
            attr("einzelpreis", "unitPrice", "preis", "price"),
            attr("menge", "quantity", "anzahl", "qty"),
        ],
        dependencies: [
            dep([ "rechnungsNr" ], [ "datum", "kundenNr" ]),
            dep([ "kundenNr" ], [ "kundenname", "plz" ]),
            dep([ "plz" ], [ "ort" ]),
            dep([ "artikelNr" ], [ "bezeichnung", "einzelpreis" ]),
            dep([ "rechnungsNr", "artikelNr" ], [ "menge" ]),
        ],
        solutionEdges: [[ 0, 1 ], [ 2, 0 ], [ 4, 2 ], [ 4, 3 ]],
    },
    course: {
        attributes: [
            attr("kursNr", "courseNo", "kursnummer"),
            attr("titel", "title", "kurstitel", "courseTitle", "kursname", "courseName"),
            attr("datum", "date", "kursdatum", "courseDate"),
            attr("dozentNr", "trainerNo", "lecturerNo"),
            attr("dozentName", "trainerName", "dozent", "trainer", "lecturerName", "lecturer"),
            attr("teilnehmerNr", "participantNo", "tnNr"),
            attr("vorname", "firstName"),
            attr("nachname", "lastName", "surname", "familienname"),
            attr("bezahlt", "paid"),
        ],
        dependencies: [
            dep([ "kursNr" ], [ "titel", "datum", "dozentNr" ]),
            dep([ "dozentNr" ], [ "dozentName" ]),
            dep([ "teilnehmerNr" ], [ "vorname", "nachname" ]),
            dep([ "kursNr", "teilnehmerNr" ], [ "bezahlt" ]),
        ],
        nonAtomic: [{ names: [ "teilnehmer", "teilnehmername", "participant", "participantName", "name" ], parts: [ "vorname", "nachname" ] }],
        solutionEdges: [[ 0, 1 ], [ 3, 0 ], [ 3, 2 ]],
    },
    project: {
        attributes: [
            attr("persNr", "employeeNo", "personalNr", "personalnummer", "mitarbeiterNr", "employeeId"),
            attr("nachname", "lastName", "name", "surname"),
            attr("abteilungNr", "departmentNo", "abtNr", "abteilungsNr"),
            attr("abteilung", "department", "abteilungsname", "abteilungName", "departmentName"),
            attr("projektNr", "projectNo"),
            attr("projektname", "projectName", "projekt", "project"),
            attr("stunden", "hours"),
        ],
        dependencies: [
            dep([ "persNr" ], [ "nachname", "abteilungNr" ]),
            dep([ "abteilungNr" ], [ "abteilung" ]),
            dep([ "projektNr" ], [ "projektname" ]),
            dep([ "persNr", "projektNr" ], [ "stunden" ]),
        ],
        solutionEdges: [[ 0, 1 ], [ 3, 0 ], [ 3, 2 ]],
    },
};

export const NORM_IDS = Object.keys(NORM_SCENARIOS) as NormScenarioId[];

export function isNormId(id: string | undefined): id is NormScenarioId {
    return !!id && id in NORM_SCENARIOS;
}
