import type { ReactElement } from "react";

interface MultilineProps {
    text: string;
    /** Centre (or left edge with `anchor="start"`) */
    x: number;
    /** Vertical centre of the text block */
    y: number;
    size: number;
    weight?: string;
    mono?: boolean;
    anchor?: "start" | "middle";
}

export function MultilineText({ text, x, y, size, weight = "600", mono, anchor = "middle" }: MultilineProps): ReactElement {
    const rows = String(text).split("\n"), lh = size * 1.25, y0 = y - (rows.length - 1) * lh / 2 + size * 0.35;
    return (
        <text x={x} y={y0} textAnchor={anchor} fontSize={size} fontWeight={weight} fontFamily={mono ? "var(--fmono)" : "var(--fui)"} fill="var(--ink)">
            {rows.map((row, i) => <tspan key={i} x={x} dy={i ? lh : undefined}>{row || " "}</tspan>)}
        </text>
    );
}

interface LinesProps {
    rows: string[];
    x: number;
    /** Baseline of the first line */
    y: number;
    size?: number;
    anchor?: "start" | "middle";
    weight?: string;
}

/** Fixed line spacing of 17. */
export function TextLines({ rows, x, y, size = 13, anchor = "start", weight }: LinesProps): ReactElement {
    return <>{rows.map((row, i) => <text key={i} x={x} y={y + i * 17} textAnchor={anchor} fontSize={size} fontWeight={weight} fontFamily="var(--fui)" fill="var(--ink)">{row || " "}</text>)}</>;
}
