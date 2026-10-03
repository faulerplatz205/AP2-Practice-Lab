import type { ReactElement } from "react";

/** Color variants of the arrowheads: normal, critical path, warning, selected. */
const COLORS: Record<string, string> = { "": "var(--ink)", c: "var(--crit)", w: "var(--warn)", s: "var(--accent)" };

/**
 * Arrowheads as SVG markers. ids: `<kind><color>`, e.g. `ahc` = filled head, critical.
 * ah filled, op open, tr hollow triangle (inheritance), dh hollow diamond (aggregation), df filled diamond (composition)
 */
export function Markers(): ReactElement {
    return <>{Object.entries(COLORS).map(([ k, c ]) => (
        <g key={k}>
            <marker id={`ah${k}`} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill={c} /></marker>
            <marker id={`op${k}`} viewBox="-1 -1 12 12" refX="10" refY="5" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10" fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" /></marker>
            <marker id={`tr${k}`} viewBox="0 0 15 14" refX="14" refY="7" markerWidth="15" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto"><path d="M1 1L14 7L1 13Z" fill="var(--paper)" stroke={c} strokeWidth="1.5" strokeLinejoin="round" /></marker>
            <marker id={`dh${k}`} viewBox="0 0 19 12" refX="1" refY="6" markerWidth="19" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M1 6L9.5 1L18 6L9.5 11Z" fill="var(--paper)" stroke={c} strokeWidth="1.5" strokeLinejoin="round" /></marker>
            <marker id={`df${k}`} viewBox="0 0 19 12" refX="1" refY="6" markerWidth="19" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M1 6L9.5 1L18 6L9.5 11Z" fill={c} stroke={c} strokeWidth="1.5" strokeLinejoin="round" /></marker>
        </g>
    ))}</>;
}
