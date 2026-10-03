import type { ReactElement } from "react";
import type { RelationKind } from "../../types/diagram";
import { useDiagram } from "../../state/diagramStore";
import { pickRelation } from "../../state/actions";
import { RELATION_KINDS } from "../../lib/uml/types";
import { useText } from "../../i18n/locale";
import { relationLabels } from "../../i18n/diagram";
import { canvasText } from "../../i18n/canvas";

export function RelationBar(): ReactElement {
    const t = useText(canvasText), labels = useText(relationLabels);
    const tool = useDiagram(s => s.tool);
    const relation = useDiagram(s => s.relation);
    return (
        <div className="relbar" id="relbar" hidden={tool !== "arrow"}>
            <label htmlFor="relSel">{t.connection}</label>
            <select id="relSel" value={relation} onChange={e => pickRelation(e.target.value as RelationKind | "auto")}>
                <option value="auto">{t.autoRelation}</option>
                {RELATION_KINDS.map(k => <option key={k} value={k}>{labels[k]}</option>)}
            </select>
        </div>
    );
}
