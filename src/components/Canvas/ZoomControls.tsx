import type { ReactElement } from "react";
import { useDiagram } from "../../state/diagramStore";
import { fitView, zoomCenter } from "../../state/viewport";
import { useText } from "../../i18n/locale";
import { canvasText } from "../../i18n/canvas";
import { Icon } from "../Icon";

export function ZoomControls(): ReactElement {
    const t = useText(canvasText);
    const z = useDiagram(s => s.view.z);
    return (
        <div className="zoom">
            <button className="btn" id="zOut" title={t.zoomOut} onClick={() => zoomCenter(1 / 1.2)}>−</button>
            <output id="zLab">{Math.round(z * 100)}%</output>
            <button className="btn" id="zIn" title={t.zoomIn} onClick={() => zoomCenter(1.2)}>+</button>
            <button className="btn" id="zFit" title={t.zoomFit} onClick={() => fitView()}><Icon name="fit" /></button>
        </div>
    );
}
