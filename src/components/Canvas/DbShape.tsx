import type { ReactElement } from "react";
import type { DiagramNode } from "../../types/diagram";
import { KEY_COL, SHEET_ROW, TABLE_HEADER, TABLE_ROW, sheetLayout, tableLayout } from "../../lib/db/columns";
import { MultilineText } from "./SvgText";

const STROKE = "var(--ink)";
const line = { stroke: STROKE, strokeWidth: 1.4 };
const font = { fontFamily: "var(--fui)", fill: "var(--ink)" };

/** Entity, relationship and attribute of the ER model (Chen notation). Coordinates relative to the element. */
export function ErShape({ node: n, fill }: { node: DiagramNode; fill: string }): ReactElement | null {
    const { w, h } = n;
    switch (n.type) {
        case "entity":
            return <><rect width={w} height={h} fill={fill} {...line} /><MultilineText text={n.text} x={w / 2} y={h / 2} size={14.5} weight="700" /></>;
        case "relship":
            return <>
                <path d={`M${w / 2} 0L${w} ${h / 2}L${w / 2} ${h}L0 ${h / 2}Z`} fill={fill} {...line} strokeLinejoin="round" />
                <MultilineText text={n.text} x={w / 2} y={h / 2} size={13.5} />
            </>;
        case "erattr": {
            const key = n.stereo === "key";
            return <>
                <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={fill} {...line} strokeDasharray={n.stereo === "derived" ? "5 4" : undefined} />
                {n.stereo === "multi" && <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 4} ry={h / 2 - 4} fill="none" {...line} />}
                <text x={w / 2} y={h / 2 + 4.5} textAnchor="middle" fontSize={13} fontWeight={key ? "700" : "500"} textDecoration={key ? "underline" : undefined} {...font}>{n.text}</text>
            </>;
        }
        default:
            return null;
    }
}

/** Table of the table model: name, then one row per column with PK/FK, name (PK underlined) and data type. */
export function TableShape({ node: n, fill }: { node: DiagramNode; fill: string }): ReactElement {
    const { w, h } = n;
    const L = tableLayout(n);
    return <>
        <rect width={w} height={h} fill="var(--node)" {...line} />
        <rect width={w} height={TABLE_HEADER} fill={fill === "var(--node)" ? "var(--blank)" : fill} {...line} />
        <text x={w / 2} y={20} textAnchor="middle" fontSize={14.5} fontWeight="700" {...font}>{n.text}</text>
        <path d={`M${KEY_COL} ${TABLE_HEADER}V${h}`} stroke={STROKE} strokeWidth="1" />
        {L.columns.map((c, i) => {
            const y = TABLE_HEADER + i * TABLE_ROW + 18;
            const marker = [ c.pk && "PK", c.fk && "FK" ].filter(Boolean).join(" ");
            return <g key={i}>
                {marker && <text x={KEY_COL / 2} y={y} textAnchor="middle" fontSize={10.5} fontWeight="700" fontFamily="var(--fmono)" fill="var(--ink)">{marker}</text>}
                <text x={KEY_COL + 8} y={y} fontSize={13} fontWeight={c.pk ? "700" : "500"} textDecoration={c.pk ? "underline" : undefined} {...font}>{c.name}</text>
                {c.type && <text x={w - 8} y={y} textAnchor="end" fontSize={11.5} fontFamily="var(--fmono)" fill="var(--muted)">{c.type}</text>}
            </g>;
        })}
    </>;
}

/** Data table with sample rows (e.g. the source table of a normalisation exercise). */
export function SheetShape({ node: n }: { node: DiagramNode }): ReactElement {
    const L = sheetLayout(n);
    const extra = Math.max(0, n.w - L.widths.reduce((a, b) => a + b, 0));
    const widths = L.widths.map((cw, i) => i === L.widths.length - 1 ? cw + extra : cw);
    const xs = widths.reduce<number[]>((acc, cw) => [ ...acc, acc[acc.length - 1] + cw ], [ 0 ]);
    const top = L.caption;
    return <>
        {L.caption > 0 && <text x={0} y={18} fontSize={13.5} fontWeight="700" {...font}>{n.text}</text>}
        <rect y={top} width={n.w} height={n.h - top} fill="var(--node)" {...line} />
        <rect y={top} width={n.w} height={SHEET_ROW} fill="var(--blank)" {...line} />
        {L.rows.slice(1).map((_r, i) => <path key={i} d={`M0 ${top + (i + 1) * SHEET_ROW}H${n.w}`} stroke={STROKE} strokeWidth="0.8" />)}
        {xs.slice(1, -1).map((x, i) => <path key={i} d={`M${x} ${top}V${n.h}`} stroke={STROKE} strokeWidth="0.8" />)}
        {L.rows.map((r, ri) => r.map((cell, ci) => (
            <text key={`${ri}-${ci}`} x={xs[ci] + 8} y={top + ri * SHEET_ROW + 15} fontSize={12} fontWeight={ri ? "400" : "700"} {...font}>{cell}</text>
        )))}
    </>;
}
