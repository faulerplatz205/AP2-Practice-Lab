import type { ReactElement } from "react";
import type { Diagram, DiagramEdge, DiagramNode } from "../../types/diagram";
import { edgeGeometry, type RouteContext } from "../../lib/uml/routing";
import { edgeLabel, labelKey, type LabelPlacement } from "../../lib/uml/labels";
import type { LabelSpot } from "../../lib/uml/detour";
import { RELATIONS } from "../../lib/uml/types";

interface Props {
    doc: Diagram;
    edge: DiagramEdge;
    from: DiagramNode;
    to: DiagramNode;
    ctx: RouteContext;
    /** From `placeLabels()` */
    labels: Map<string, LabelPlacement>;
    critical: boolean;
    selected?: boolean;
    marked?: boolean;
    /** Export: without the invisible hit area */
    exporting?: boolean;
}

function EdgeLabel({ spot, text }: { spot: LabelSpot; text: string }): ReactElement {
    return <text x={spot.x} y={spot.y} textAnchor={spot.a} fontSize="12.5" fontWeight="500" fontFamily="var(--fui)" fill="var(--ink)" stroke="var(--paper)" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round">{text}</text>;
}

/** `data-eid` maps clicks to the edge. */
export function EdgeView({ doc, edge: e, from, to, ctx, labels, critical, selected, marked, exporting }: Props): ReactElement {
    const rel = RELATIONS[e.kind ?? "flow"] ?? RELATIONS.flow;
    const g = edgeGeometry(doc, e, from, to, ctx);
    const color = selected ? "var(--accent)" : marked ? "var(--warn)" : critical ? "var(--crit)" : "var(--ink)";
    const suffix = selected ? "s" : marked ? "w" : critical ? "c" : "";
    const label = edgeLabel(e), at = (part: "label" | "m1" | "m2"): LabelSpot | undefined => labels.get(labelKey(e, part));
    return (
        <g className="eg" data-eid={e.id}>
            {!exporting && <path d={g.d} stroke="transparent" strokeWidth="14" fill="none" />}
            <path
                d={g.d} stroke={color} strokeWidth={critical || selected ? 2.2 : 1.5} fill="none" strokeLinejoin="round"
                strokeDasharray={marked ? "6 4" : rel.dash}
                markerEnd={rel.end ? `url(#${rel.end}${suffix})` : undefined}
                markerStart={rel.start ? `url(#${rel.start}${suffix})` : undefined}
            />
            {label && <EdgeLabel spot={at("label") ?? { x: g.lx, y: g.ly, a: g.anc ?? "middle" }} text={label} />}
            {e.m1 && <EdgeLabel spot={at("m1") ?? { x: g.s[0], y: g.s[1] + 16, a: "start" }} text={e.m1} />}
            {e.m2 && <EdgeLabel spot={at("m2") ?? { x: g.t[0], y: g.t[1] + 16, a: "start" }} text={e.m2} />}
        </g>
    );
}
