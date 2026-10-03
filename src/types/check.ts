import type { DiagramMode } from "./diagram";

/** Issue texts are in the language that was active when checking. */

export type IssueLevel = "error" | "warn" | "info" | "ok";

export interface Issue {
    level: IssueLevel;
    text: string;
    tip?: string;
    /** Correct values, network diagram only */
    solution?: string;
    nodeId?: number;
    edgeId?: number;
}

/**
 * Marks in the drawing:
 * - `"<node>:<field>"` field with a red background in an activity node
 * - `"n:<node>"` dashed frame around a node
 * - `"e:<edge>"` dashed edge
 */
export type MarkSet = Set<string>;

export interface CheckResult {
    items: Issue[];
    marks: MarkSet;
    /** Number of checked time values */
    total: number;
    right: number;
    empty: number;
    duration: number | null;
    /** Numbers of the activities on the critical path */
    criticalPath: string[];
    errors: number;
    warnings: number;
    hasUml: boolean;
    isNetzplan: boolean;
    kinds: DiagramMode[];
    ok: boolean;
}
