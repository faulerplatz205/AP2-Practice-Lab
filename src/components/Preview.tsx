import type { ReactElement } from "react";
import type { DiagramNode, NodeType, RelationKind } from "../types/diagram";
import { defaultSize } from "../lib/diagram";
import { fitToContent } from "../lib/uml/size";
import { RELATIONS, UML_TYPES, isUml } from "../lib/uml/types";
import { useText } from "../i18n/locale";
import { diagramText, umlText } from "../i18n/diagram";
import { modeText } from "../i18n/modes";
import { NodeView } from "./Canvas/NodeView";

export function NodePreview({ type, preset, width = 64, height = 44 }: { type: NodeType; preset?: Partial<DiagramNode>; width?: number; height?: number }): ReactElement {
    const texts = useText(umlText), dt = useText(diagramText), items = useText(modeText).items;
    const size = defaultSize(type);
    const n: DiagramNode = { id: -1, type, x: 0, y: 0, w: size.w, h: size.h, fill: 0, text: type === "text" ? dt.text : dt.shape };
    if (isUml(type)) {
        const t = texts[type];
        Object.assign(n, { text: t.text, attrs: t.attrs, ops: t.ops, stereo: UML_TYPES[type].stereo ?? "" });
    }
    if (type === "np") n.f = { nr: "1", name: items.activity, d: "3", faz: "0", fez: "3", saz: "0", sez: "3", gp: "0", fp: "0" };
    Object.assign(n, preset ?? {});
    fitToContent(n);
    const extra = type === "iface" ? 22 : 4;
    return (
        <svg viewBox={`-6 -6 ${n.w + 12} ${n.h + 12 + (isUml(type) ? extra : 0)}`} width={width} height={height} aria-hidden="true">
            <NodeView node={n} />
        </svg>
    );
}

export function RelationPreview({ kind }: { kind: RelationKind }): ReactElement {
    const r = RELATIONS[kind];
    return (
        <svg viewBox="0 0 60 16" width="60" height="16" aria-hidden="true">
            <path d="M6 8H52" stroke="var(--ink)" strokeWidth="1.5" fill="none" strokeDasharray={r.dash}
                markerEnd={r.end ? `url(#${r.end})` : undefined} markerStart={r.start ? `url(#${r.start})` : undefined} />
        </svg>
    );
}
