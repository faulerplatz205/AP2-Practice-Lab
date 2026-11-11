import type { DiagramNode } from "../../types/diagram";
import { lines } from "../uml/types";

/**
 * One line of a table: `PK kundenNr INT`, `FK ortId`, `PK FK bestellNr INT`, `name VARCHAR(50)`. The keys may also
 * be written after the name (`kundenNr INT (PK)`, `kundenNr INT PK`), in SQL (`PRIMARY KEY`, `REFERENCES Kunde`) or
 * with the arrow or hash of German textbooks for a foreign key (`↑kundenNr`, `#kundenNr`).
 */
export interface Column {
    pk: boolean;
    fk: boolean;
    name: string;
    type: string;
    /** Table named after `REFERENCES` */
    ref?: string;
}

const MARKERS = /^\s*((?:(?:PK|FK)(?=[\s,/+]|$)[\s,/+]*)+)/i;
const KEYS = "(?:PK|FK)(?:\\s*[,/+]?\\s*(?:PK|FK))*";

export function parseColumn(line: string): Column {
    const m = MARKERS.exec(line);
    let markers = (m?.[1] ?? "").toUpperCase(), ref: string | undefined;
    let rest = line.slice(m ? m[0].length : 0).trim();
    if (rest.startsWith("↑") || rest.startsWith("#")) {
        markers += "FK";
        rest = rest.slice(1).trim();
    }
    const mark = (keys: string): string => {
        markers += keys.toUpperCase();
        return " ";
    };
    rest = rest
        .replace(new RegExp(`\\(\\s*(${KEYS})\\s*\\)`, "gi"), (_, keys: string) => mark(keys))
        .replace(/\bPRIMARY\s+KEY\b/gi, () => mark("PK"))
        .replace(/\bFOREIGN\s+KEY\b/gi, () => mark("FK"))
        .replace(/\bREFERENCES\s+([^\s(]+)(?:\s*\([^)]*\))?/gi, (_, table: string) => {
            ref = table.replace(/[`"'[\]]/g, "");
            return mark("FK");
        })
        .replace(new RegExp(`\\s+(${KEYS})\\s*$`, "i"), (_, keys: string) => mark(keys).trim())
        .replace(/\s+/g, " ").trim();
    // "name : TYPE" and "name TYPE" are both fine
    const [ , name = "", type = "" ] = /^([^\s:]*)\s*:?\s*(.*)$/.exec(rest) ?? [];
    return { pk: markers.includes("PK"), fk: markers.includes("FK"), name, type: type.trim(), ...(ref ? { ref } : {}) };
}

export function tableColumns(n: DiagramNode): Column[] {
    return lines(n.attrs).filter(l => l.trim()).map(parseColumn);
}

/** Lower case, umlauts folded, without separators; trailing nummer/number/no/id become "nr". */
export function columnKey(name: string): string {
    const plain = name.toLowerCase()
        .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
        .replace(/[^a-z0-9]/g, "");
    return plain.replace(/(nummer|number|num|no|id)$/, "nr");
}

/**
 * Whether the foreign key `c` points to table `t`: it names `t` after `REFERENCES`, or it is named like a primary
 * key of `t` (`kundenNr` => `PK kundenNr`), or like the table name plus that key (`kunde_id`, `kundenId` => `Kunde` with `PK id`).
 */
export function fkPointsTo(c: Column, t: DiagramNode, pks: Column[] = tableColumns(t).filter(k => k.pk)): boolean {
    const table = String(t.text).trim();
    if (c.ref) return columnKey(c.ref) === columnKey(table);
    const key = columnKey(c.name);
    return pks.some(k => [ "", table, `${table}n`, `${table}en`, `${table}s` ].some(prefix => columnKey(prefix + k.name) === key));
}

/** Does table `a` hold a foreign key that points to table `b`? */
export function referencesTable(a: DiagramNode, b: DiagramNode): boolean {
    const pks = tableColumns(b).filter(c => c.pk);
    return tableColumns(a).some(c => c.fk && fkPointsTo(c, b, pks));
}

/** Cardinalities [start, end] for a new line from `a` to `b`: the n end is at the table with the foreign key. */
export function relationEnds(a: DiagramNode, b: DiagramNode): [string, string] {
    if (referencesTable(a, b)) return [ "n", "1" ];
    return [ "1", "n" ];
}

export const TABLE_HEADER = 30;
export const TABLE_ROW = 20;
/** Width of the PK/FK column */
export const KEY_COL = 44;

export interface TableLayout {
    columns: Column[];
    nameW: number;
    height: number;
    width: number;
}

export function tableLayout(n: DiagramNode): TableLayout {
    const columns = tableColumns(n);
    const nameW = Math.max(60, ...columns.map(c => c.name.length * 7.6));
    const typeW = Math.max(0, ...columns.map(c => c.type.length * 7));
    const width = Math.max(150, n.text.length * 9 + 30, KEY_COL + nameW + typeW + 34);
    return { columns, nameW, width, height: TABLE_HEADER + Math.max(1, columns.length) * TABLE_ROW + 8 };
}

export const SHEET_ROW = 22;

export interface SheetLayout {
    caption: number;
    rows: string[][];
    widths: number[];
    width: number;
    height: number;
}

/** Data table: one row per line, cells separated by `|`, the first row is the header. */
export function sheetLayout(n: DiagramNode): SheetLayout {
    const rows = lines(n.attrs).filter(l => l.trim()).map(l => l.split("|").map(c => c.trim()));
    const cols = Math.max(1, ...rows.map(r => r.length));
    const widths = Array.from({ length: cols }, (_, i) => Math.max(36, ...rows.map(r => (r[i] ?? "").length * 7.2 + 16)));
    const caption = n.text.trim() ? 28 : 0;
    const width = Math.max(widths.reduce((a, b) => a + b, 0), n.text.length * 7.6 + 16);
    return { caption, rows, widths, width, height: caption + Math.max(1, rows.length) * SHEET_ROW };
}
