import type { ReactElement } from "react";
import type { DiagramNode } from "../../types/diagram";
import { findNode } from "../../lib/diagram";
import { useText } from "../../i18n/locale";
import { panelText } from "../../i18n/panel";
import { LiveTextarea } from "./LiveInput";
import { SizeFields } from "./SizeFields";
import { BackToCheck, Heading, NodeActions, Swatches } from "./common";

export function ShapePanel({ node: n }: { node: DiagramNode }): ReactElement {
    const t = useText(panelText);
    return <>
        <BackToCheck />
        <Heading eyebrow={(t.shapeNames as Record<string, string>)[n.type] ?? t.shape} title={t.textAndLook} />
        <label className="field">{t.text}
            <LiveTextarea id="f-text" value={n.text} write={(d, v) => {
                findNode(d, n.id)!.text = v;
            }} />
        </label>
        <SizeFields node={n} />
        <Swatches node={n} />
        <NodeActions />
    </>;
}
