import { type ReactElement, useMemo } from "react";
import type { Diagram, DiagramNode } from "../../types/diagram";
import type { MarkSet } from "../../types/check";
import type { Selection } from "../../state/diagramStore";
import { isCriticalEdge } from "../../lib/netzplan/critical";
import { sharedRails } from "../../lib/uml/routing";
import { UML_TYPES, isUml } from "../../lib/uml/types";
import { EdgeView } from "./EdgeView";
import { NodeView } from "./NodeView";

export interface WorldProps {
    doc: Diagram;
    selection?: Selection | null;
    pendingFrom?: number | null;
    marks?: MarkSet;
    /** Export as image: without selection, marks and hit areas */
    exporting?: boolean;
}

/** Layer: 0 containers (back), 1 lifelines, 2 everything else (in front of the edges). */
function layer(n: DiagramNode): number {
    if (isUml(n.type) && UML_TYPES[n.type].box) return 0;
    return n.type === "lifeline" || n.type === "actline" ? 1 : 2;
}

/** The whole drawing: containers, then edges, then nodes. Critical edges are on top. */
export function World({ doc, selection, pendingFrom, marks, exporting }: WorldProps): ReactElement {
    const byId = useMemo(() => new Map(doc.nodes.map(n => [ n.id, n ])), [ doc.nodes ]);
    const rails = useMemo(() => sharedRails(doc), [ doc ]);
    const nodes = [ ...doc.nodes ].sort((a, b) => layer(a) - layer(b) || (layer(a) === 0 ? b.w * b.h - a.w * a.h : 0));
    const edges = doc.edges.filter(e => byId.has(e.from) && byId.has(e.to)).map(e => ({ e, critical: (e.kind ?? "flow") === "flow" && isCriticalEdge(doc, e) }));
    const sel = exporting ? null : selection;
    const m = exporting ? undefined : marks;
    const renderNode = (n: DiagramNode): ReactElement =>
        <NodeView key={n.id} node={n} selected={sel?.kind === "node" && sel.id === n.id} pending={!exporting && pendingFrom === n.id} marks={m} />;
    return <>
        {nodes.filter(n => layer(n) < 2).map(renderNode)}
        {[ ...edges.filter(x => !x.critical), ...edges.filter(x => x.critical) ].map(({ e, critical }) =>
            <EdgeView key={e.id} doc={doc} edge={e} from={byId.get(e.from)!} to={byId.get(e.to)!} rails={rails} critical={critical}
                selected={sel?.kind === "edge" && sel.id === e.id} marked={m?.has(`e:${e.id}`)} exporting={exporting} />)}
        {nodes.filter(n => layer(n) === 2).map(renderNode)}
    </>;
}
