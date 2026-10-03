import type { ReactElement } from "react";
import type { DiagramNode } from "../../types/diagram";
import type { MarkSet } from "../../types/check";
import { FILLS } from "../../lib/constants";
import { isActivity } from "../../lib/diagram";
import { isUml } from "../../lib/uml/types";
import { isCritical } from "../../lib/netzplan/critical";
import { ActivityShape } from "./ActivityShape";
import { UmlShape } from "./UmlShape";
import { MultilineText } from "./SvgText";

export interface NodeViewProps {
    node: DiagramNode;
    selected?: boolean;
    /** Start node of an arrow being drawn */
    pending?: boolean;
    marks?: MarkSet;
}

function GenericShape({ node: n, fill, critical }: { node: DiagramNode; fill: string; critical: boolean }): ReactElement {
    const { w, h } = n;
    const stroke = critical ? "var(--crit)" : "var(--ink)", sw = critical ? 2.2 : 1.4;
    let outline: ReactElement;
    if (n.type === "rect") outline = <rect width={w} height={h} rx="6" fill={fill} stroke={stroke} strokeWidth={sw} />;
    else if (n.type === "ellipse") outline = <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={fill} stroke={stroke} strokeWidth={sw} />;
    else if (n.type === "diamond") outline = <path d={`M${w / 2} 0L${w} ${h / 2}L${w / 2} ${h}L0 ${h / 2}Z`} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
    else outline = <rect width={w} height={h} fill={n.fill ? fill : "transparent"} />;
    const text = n.align === "left"
        ? <MultilineText text={n.text} x={10} y={h / 2} size={13.5} weight="500" anchor="start" />
        : <MultilineText text={n.text} x={w / 2} y={h / 2} size={n.type === "text" ? 16 : 14} weight={n.type === "text" ? "500" : "600"} />;
    return <>{outline}{text}</>;
}

/** Pointer handling maps clicks to a node via `data-id`; `data-handle` is the resize handle. */
export function NodeView({ node: n, selected, pending, marks }: NodeViewProps): ReactElement {
    const fill = n.fill ? FILLS[n.fill].color : "var(--node)";
    const critical = isCritical(n);
    return (
        <g className="nd" data-id={n.id} transform={`translate(${n.x} ${n.y})`}>
            {isActivity(n)
                ? <ActivityShape node={n} fill={fill} critical={critical} marks={marks} />
                : isUml(n.type) ? <UmlShape node={n} fill={fill} /> : <GenericShape node={n} fill={fill} critical={critical} />}
            {marks?.has(`n:${n.id}`) && <rect x="-6" y="-6" width={n.w + 12} height={n.h + 12} fill="none" stroke="var(--crit)" strokeWidth="2" strokeDasharray="6 4" rx="4" />}
            {(selected || pending) && <rect x="-4" y="-4" width={n.w + 8} height={n.h + 8} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="5 3" rx="3" />}
            {selected && <rect className="hdl" data-handle={n.id} x={n.w - 2} y={n.h - 2} width="10" height="10" rx="2" fill="var(--accent)" stroke="var(--node)" strokeWidth="1.5" />}
        </g>
    );
}
