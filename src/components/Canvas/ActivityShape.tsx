import type { ReactElement } from "react";
import type { ActivityNode } from "../../types/diagram";
import type { MarkSet } from "../../types/check";
import { ACTIVITY_CELLS } from "../../lib/constants";
import { useText } from "../../i18n/locale";
import { fieldLabels } from "../../i18n/netzplan";

interface Props {
    node: ActivityNode;
    fill: string;
    critical: boolean;
    marks?: MarkSet;
}

/** Activity node in the IHK layout: 3 columns x 4 rows, fields see ACTIVITY_CELLS. */
export function ActivityShape({ node: n, fill, critical, marks }: Props): ReactElement {
    const labels = useText(fieldLabels);
    const { w, h } = n, rh = h / 4, cw = w / 3;
    const stroke = critical ? "var(--crit)" : "var(--ink)";
    const labelSize = Math.max(8, Math.min(9.5, rh * 0.3)), valueSize = Math.max(10, Math.min(15, rh * 0.44));
    const grid = `M0 ${rh}H${w}M0 ${2 * rh}H${w}M0 ${3 * rh}H${w}M${cw} 0V${rh}M${2 * cw} 0V${rh}M${cw} ${rh}V${2 * rh}M${cw} ${2 * rh}V${h}M${2 * cw} ${2 * rh}V${h}`;
    return <>
        <rect width={w} height={h} fill={fill} />
        <rect x={cw} y="0" width={cw} height={rh} fill="var(--blank)" />
        <rect x={cw} y={3 * rh} width={cw} height={rh} fill="var(--blank)" />
        {marks && ACTIVITY_CELLS.filter(c => marks.has(`${n.id}:${c.key}`)).map(c =>
            <rect key={c.key} x={c.col * cw} y={c.row * rh} width={c.span * cw} height={rh} fill="var(--bad)" />)}
        <path d={grid} stroke={stroke} strokeOpacity={critical ? 0.55 : 0.45} strokeWidth="1" fill="none" />
        <rect width={w} height={h} fill="none" stroke={stroke} strokeWidth={critical ? 2.2 : 1.4} />
        {ACTIVITY_CELLS.map(c => {
            const x = c.col * cw, y = c.row * rh, cellW = c.span * cw, v = n.f[c.key] ?? "";
            let value: ReactElement | null = null;
            if (c.key === "name") {
                const max = Math.max(4, Math.floor((cellW - 10) / (valueSize * 0.56)));
                value = <text x={x + cellW / 2} y={y + rh / 2 + valueSize * 0.36} textAnchor="middle" fontSize={valueSize * 0.95} fontWeight="600" fontFamily="var(--fui)" fill="var(--ink)">{v.length > max ? v.slice(0, max - 1) + "…" : v}</text>;
            } else if (v !== "") {
                value = <text x={x + cellW / 2 + (labels[c.key] ? 5 : 0)} y={y + rh / 2 + valueSize * 0.42} textAnchor="middle" fontSize={valueSize} fontWeight={c.key === "nr" ? "600" : "400"} fontFamily="var(--fmono)" fill={c.key === "gp" && critical ? "var(--crit)" : "var(--ink)"}>{v}</text>;
            }
            return <g key={c.key}>
                {labels[c.key] && <text x={x + 4} y={y + labelSize + 2} fontSize={labelSize} fontFamily="var(--fmono)" fill="var(--muted)">{labels[c.key]}</text>}
                {value}
            </g>;
        })}
    </>;
}
