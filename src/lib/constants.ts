import type { ActivityKey, TimeKey } from "../types/diagram";

/** Grid size in world coordinates. All positions snap to it. */
export const GRID = 10;

/** Storage key prefix from the first version („Netzplan-Zeichner“). Never change it, or saved data is lost. */
export const STORAGE_KEY = "netzplan-zeichner-v1";

export const TIME_KEYS: TimeKey[] = [ "faz", "fez", "saz", "sez", "gp", "fp" ];

/** `span` = width in columns. */
export interface ActivityCell {
    key: ActivityKey;
    col: number;
    row: number;
    span: number;
}

/**
 * Layout of the activity node (3 columns x 4 rows) as in IHK exams
 * (labels in English: ES, EF, No., D, TF, FF, LS, LF):
 *
 *   FAZ |       | FEZ
 *   Nr. |  name
 *   D   |  GP   | FP
 *   SAZ |       | SEZ
 */
export const ACTIVITY_CELLS: ActivityCell[] = [
    { key: "faz", col: 0, row: 0, span: 1 },
    { key: "fez", col: 2, row: 0, span: 1 },
    { key: "nr", col: 0, row: 1, span: 1 },
    { key: "name", col: 1, row: 1, span: 2 },
    { key: "d", col: 0, row: 2, span: 1 },
    { key: "gp", col: 1, row: 2, span: 1 },
    { key: "fp", col: 2, row: 2, span: 1 },
    { key: "saz", col: 0, row: 3, span: 1 },
    { key: "sez", col: 2, row: 3, span: 1 },
];

/** Fill colors as CSS tokens. Index = `node.fill`. Names: `fillNames` in src/i18n/diagram.ts */
export const FILLS: { color: string }[] = [
    { color: "var(--node)" },
    { color: "var(--f1)" },
    { color: "var(--f2)" },
    { color: "var(--f3)" },
    { color: "var(--f4)" },
];
