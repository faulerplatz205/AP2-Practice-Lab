import type { ReactElement } from "react";
import type { DiagramNode } from "../../types/diagram";
import { findNode, minSize } from "../../lib/diagram";
import { useText } from "../../i18n/locale";
import { panelText } from "../../i18n/panel";
import { LiveInput } from "./LiveInput";

/** Values below the minimum size are ignored. */
export function SizeFields({ node: n, height = true }: { node: DiagramNode; height?: boolean }): ReactElement {
    const t = useText(panelText);
    const min = minSize(n.type);
    return (
        <div className="fields">
            <label>{t.width}
                <LiveInput id="f-w" className="num" inputMode="numeric" value={String(n.w)} write={(d, v) => {
                    const x = parseInt(v);
                    if (x >= min.w) findNode(d, n.id)!.w = x;
                }} />
            </label>
            {height && <label>{t.height}
                <LiveInput id="f-h" className="num" inputMode="numeric" value={String(n.h)} write={(d, v) => {
                    const x = parseInt(v);
                    if (x >= min.h) findNode(d, n.id)!.h = x;
                }} />
            </label>}
        </div>
    );
}
