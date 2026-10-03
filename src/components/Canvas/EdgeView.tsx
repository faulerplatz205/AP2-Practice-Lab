import type { ReactElement } from "react";
import type { Diagram, DiagramEdge, DiagramNode } from "../../types/diagram";
import type { EdgeGeometry } from "../../lib/uml/routing";
import { edgeGeometry } from "../../lib/uml/routing";
import { RELATIONS } from "../../lib/uml/types";

interface Props {
    doc: Diagram;
    edge: DiagramEdge;
    from: DiagramNode;
    to: DiagramNode;
    rails: Map<number, number>;
    critical: boolean;
    selected?: boolean;
    marked?: boolean;
    /** Export: without the invisible hit area */
    exporting?: boolean;
}

function EdgeLabel({ x, y, text, anchor = "middle" }: { x: number; y: number; text: string; anchor?: "start" | "middle" | "end" }): ReactElement {
    return <text x={x} y={y} textAnchor={anchor} fontSize="12.5" fontWeight="500" fontFamily="var(--fui)" fill="var(--ink)" stroke="var(--paper)" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round">{text}</text>;
}

/** Multiplicity next to the line end, above/below or beside it depending on the direction. */
function Multiplicity({ point, dir, text }: { point: [number, number]; dir: [number, number]; text: string }): ReactElement {
    const horizontal = Math.abs(dir[0]) >= Math.abs(dir[1]);
    return horizontal
        ? <EdgeLabel x={point[0] + dir[0] * 10} y={point[1] + dir[1] * 10 + 16} text={text} anchor={dir[0] > 0 ? "start" : "end"} />
        : <EdgeLabel x={point[0] + dir[0] * 10 + 8} y={point[1] + dir[1] * 10 + (dir[1] > 0 ? 12 : -4)} text={text} anchor="start" />;
}

/** `data-eid` maps clicks to the edge. */
export function EdgeView({ doc, edge: e, from, to, rails, critical, selected, marked, exporting }: Props): ReactElement {
    const kind = e.kind ?? "flow", rel = RELATIONS[kind] ?? RELATIONS.flow;
    const g: EdgeGeometry = edgeGeometry(doc, e, from, to, rails);
    const color = selected ? "var(--accent)" : marked ? "var(--warn)" : critical ? "var(--crit)" : "var(--ink)";
    const suffix = selected ? "s" : marked ? "w" : critical ? "c" : "";
    const label = [ rel.tag, e.label ].filter(Boolean).join(" ");
    return (
        <g className="eg" data-eid={e.id}>
            {!exporting && <path d={g.d} stroke="transparent" strokeWidth="14" fill="none" />}
            <path
                d={g.d} stroke={color} strokeWidth={critical || selected ? 2.2 : 1.5} fill="none" strokeLinejoin="round"
                strokeDasharray={marked ? "6 4" : rel.dash}
                markerEnd={rel.end ? `url(#${rel.end}${suffix})` : undefined}
                markerStart={rel.start ? `url(#${rel.start}${suffix})` : undefined}
            />
            {label && <EdgeLabel x={g.lx} y={g.ly} text={label} anchor={g.anc ?? "middle"} />}
            {e.m1 && <Multiplicity point={g.s} dir={g.sd} text={e.m1} />}
            {e.m2 && <Multiplicity point={g.t} dir={g.td} text={e.m2} />}
        </g>
    );
}
