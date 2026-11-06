import type { ReactElement } from "react";
import { useDiagram } from "../../state/diagramStore";
import { addAttribute, beginArrowFrom, deleteSelection, openEditor, spawnFrom, successorType } from "../../state/actions";
import { findNode, isActivity } from "../../lib/diagram";
import { fieldAt } from "../../lib/uml/fields";
import { FRAME_TYPES, isUml } from "../../lib/uml/types";
import { useText } from "../../i18n/locale";
import { canvasText } from "../../i18n/canvas";
import { Icon } from "../Icon";

export function NodeBar(): ReactElement | null {
    const t = useText(canvasText);
    const node = useDiagram(s => s.selection?.kind === "node" ? findNode(s.doc, s.selection.id) : undefined);
    const view = useDiagram(s => s.view);
    const tool = useDiagram(s => s.tool);
    const busy = useDiagram(s => s.pendingFrom !== null || s.editor !== null);
    const mode = useDiagram(s => s.doc.cfg.mode);
    if (!node || tool !== "select" || busy) return null;

    const frame = FRAME_TYPES.has(node.type);
    const canEdit = isActivity(node) || !isUml(node.type) || !!fieldAt(node, null);
    const next = successorType(node.type, mode);
    const canAttr = node.type === "entity" || node.type === "relship";
    const canvas = document.getElementById("canvas");
    const width = canvas?.clientWidth ?? 0, height = canvas?.clientHeight ?? 0;

    const BAR_W = 34 * (2 + Number(!frame) + Number(!!next) + Number(canAttr)), BAR_H = 38;
    let left = view.x + (node.x + node.w) * view.z + 14 + 6 * view.z;
    if (width && left + BAR_W > width) left = view.x + node.x * view.z - 14 - 6 * view.z - BAR_W;
    left = Math.max(4, left);
    const top = Math.max(4, height ? Math.min(height - BAR_H - 4, view.y + node.y * view.z) : view.y + node.y * view.z);

    return (
        <div className="nodebar" id="nodebar" role="toolbar" aria-label={t.nodeBar.label} style={{ left, top }}>
            {!frame && <button type="button" className="btn" id="nbArrow" title={t.nodeBar.arrow} onClick={() => beginArrowFrom(node.id)}><Icon name="arrow" /></button>}
            {next && <button type="button" className="btn" id="nbNext" title={t.nodeBar.next} onClick={() => spawnFrom(node.id)}><Icon name="plus" /></button>}
            {canAttr && <button type="button" className="btn" id="nbAttr" title={t.nodeBar.attribute} onClick={() => addAttribute(node.id)}><Icon name="attr" /></button>}
            {canEdit && <button type="button" className="btn" id="nbEdit" title={t.nodeBar.edit} onClick={() => openEditor(node.id, null)}><Icon name="edit" /></button>}
            <button type="button" className="btn" id="nbDelete" title={t.nodeBar.remove} onClick={deleteSelection}><Icon name="trash" /></button>
        </div>
    );
}
