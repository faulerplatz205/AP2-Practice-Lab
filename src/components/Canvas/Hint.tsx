import type { ReactElement } from "react";
import { useDiagram } from "../../state/diagramStore";
import { tileItem } from "../../state/actions";
import { isUml } from "../../lib/uml/types";
import { GENERIC_ITEMS, MODES } from "../../data/modes";
import { useText } from "../../i18n/locale";
import { canvasText } from "../../i18n/canvas";
import { umlText } from "../../i18n/diagram";

export function Hint(): ReactElement {
    const t = useText(canvasText), uml = useText(umlText), modes = useText(MODES), generic = useText(GENERIC_ITEMS);
    const tool = useDiagram(s => s.tool);
    const toolKey = useDiagram(s => s.toolKey);
    const mode = useDiagram(s => s.doc.cfg.mode);
    const pending = useDiagram(s => s.pendingFrom);
    let text = (t.hints as Record<string, string>)[tool] ?? "";
    if (isUml(tool as never)) {
        // Label of the picked tile in the current language, else the element name
        const item = toolKey ? tileItem(toolKey, mode, modes, generic) : undefined;
        text = t.places(item && item.type === tool ? item.label : uml[tool as keyof typeof uml].label);
    }
    if (tool === "arrow") text = pending === null ? t.arrowStart : t.arrowTarget;
    return <div className="hint" id="hint">{text}</div>;
}
