import { type ReactElement, useEffect, useState } from "react";
import { useDiagram } from "../../state/diagramStore";
import { addAttribute, beginArrowFrom, convertNode, deleteSelection, openEditor, spawnFrom, successorType } from "../../state/actions";
import { variantsOf } from "../../lib/uml/variants";
import { findNode, isActivity } from "../../lib/diagram";
import { fieldAt } from "../../lib/uml/fields";
import { FRAME_TYPES, isUml } from "../../lib/uml/types";
import { useText } from "../../i18n/locale";
import { canvasText } from "../../i18n/canvas";
import { Icon } from "../Icon";
import type { DiagramMode, DiagramNode } from "../../types/diagram";

interface Rect { x: number; y: number; w: number; h: number }

// clear of the selection outline, the arrow handles (r = 5 at 4 px outside) and the resize handle
const GAP = 16;

/**
 * Screen position of the bar next to `node`: above, right, below or left, the first spot that
 * stays inside the canvas and covers no other element (frames like partitions don't count).
 * Falls back to above the node, clamped into the canvas.
 */
function placeBar(node: DiagramNode, nodes: DiagramNode[], view: { x: number; y: number; z: number }, w: number, h: number, width: number, height: number): { left: number; top: number } {
    const r: Rect = { x: view.x + node.x * view.z, y: view.y + node.y * view.z, w: node.w * view.z, h: node.h * view.z };
    const others: Rect[] = nodes
        .filter(n => n.id !== node.id && !FRAME_TYPES.has(n.type))
        .map(n => ({ x: view.x + n.x * view.z, y: view.y + n.y * view.z, w: n.w * view.z, h: n.h * view.z }));
    const candidates: Rect[] = [
        { x: r.x + r.w / 2 - w / 2, y: r.y - h - GAP, w, h },
        { x: r.x + r.w + GAP, y: r.y, w, h },
        { x: r.x + r.w / 2 - w / 2, y: r.y + r.h + GAP, w, h },
        { x: r.x - GAP - w, y: r.y, w, h },
    ];
    const inside = (c: Rect): boolean => !width || !height || (c.x >= 4 && c.y >= 4 && c.x + c.w <= width - 4 && c.y + c.h <= height - 4);
    const free = (c: Rect): boolean => !others.some(o => c.x < o.x + o.w && c.x + c.w > o.x && c.y < o.y + o.h && c.y + c.h > o.y);
    const pick = candidates.find(c => inside(c) && free(c)) ?? candidates.find(inside) ?? candidates[0];
    const left = Math.max(4, width ? Math.min(width - w - 4, pick.x) : pick.x);
    const top = Math.max(4, height ? Math.min(height - h - 4, pick.y) : pick.y);
    return { left, top };
}

/**
 * "Umwandeln": turns the element into another form of its kind (class => interface, alt => loop, action => signal).
 * A fragment shows its operator on the button. The list opens upwards when the bar sits in the lower half.
 */
function ConvertMenu({ node, mode, up }: { node: DiagramNode; mode: DiagramMode; up: boolean }): ReactElement | null {
    const t = useText(canvasText);
    const [ open, setOpen ] = useState(false);
    useEffect(() => {
        if (!open) return;
        const outside = (e: PointerEvent): void => {
            if (!(e.target as Element).closest(".convert")) setOpen(false);
        };
        document.addEventListener("pointerdown", outside);
        return (): void => document.removeEventListener("pointerdown", outside);
    }, [ open ]);
    const variants = variantsOf(node, mode);
    if (variants.length < 2) return null;
    return (
        <div className="convert">
            <button type="button" className="btn" id="nbConvert" title={t.nodeBar.convert} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
                {node.type === "fragment" ? <span className="op">{node.text}</span> : <Icon name="swap" />}<Icon name="chevron" size={12} />
            </button>
            {open && <div className={up ? "barmenu up" : "barmenu"} id="convertMenu" role="menu" aria-label={t.nodeBar.convert}>
                {variants.map(v => (
                    <button key={v.id} type="button" role="menuitemradio" aria-checked={v.current} data-variant={v.id} onClick={() => {
                        convertNode(node.id, v.id);
                        setOpen(false);
                    }}>{v.label}</button>
                ))}
            </div>}
        </div>
    );
}

export function NodeBar(): ReactElement | null {
    const t = useText(canvasText);
    const node = useDiagram(s => s.selection?.kind === "node" ? findNode(s.doc, s.selection.id) : undefined);
    const view = useDiagram(s => s.view);
    const tool = useDiagram(s => s.tool);
    const busy = useDiagram(s => s.pendingFrom !== null || s.editor !== null);
    const mode = useDiagram(s => s.doc.cfg.mode);
    const nodes = useDiagram(s => s.doc.nodes);
    if (!node || tool !== "select" || busy) return null;

    const frame = FRAME_TYPES.has(node.type);
    const canEdit = isActivity(node) || !isUml(node.type) || !!fieldAt(node, null);
    const next = successorType(node.type, mode);
    const canAttr = node.type === "entity" || node.type === "relship";
    const canvas = document.getElementById("canvas");
    const width = canvas?.clientWidth ?? 0, height = canvas?.clientHeight ?? 0;

    const convertible = variantsOf(node, mode).length > 1;
    const BAR_W = 34 * (1 + Number(canEdit) + Number(!frame) + Number(!!next) + Number(canAttr)) + (convertible ? (node.type === "fragment" ? 74 : 50) : 0) + 8, BAR_H = 40;
    const { left, top } = placeBar(node, nodes, view, BAR_W, BAR_H, width, height);

    return (
        <div className="nodebar" id="nodebar" role="toolbar" aria-label={t.nodeBar.label} style={{ left, top }}>
            {!frame && <button type="button" className="btn" id="nbArrow" title={t.nodeBar.arrow} onClick={() => beginArrowFrom(node.id)}><Icon name="arrow" /></button>}
            {next && <button type="button" className="btn" id="nbNext" title={t.nodeBar.next} onClick={() => spawnFrom(node.id)}><Icon name="plus" /></button>}
            {canAttr && <button type="button" className="btn" id="nbAttr" title={t.nodeBar.attribute} onClick={() => addAttribute(node.id)}><Icon name="attr" /></button>}
            {canEdit && <button type="button" className="btn" id="nbEdit" title={t.nodeBar.edit} onClick={() => openEditor(node.id, null)}><Icon name="edit" /></button>}
            {convertible && <ConvertMenu key={node.id} node={node} mode={mode} up={height > 0 && top > height / 2} />}
            <button type="button" className="btn" id="nbDelete" title={t.nodeBar.remove} onClick={deleteSelection}><Icon name="trash" /></button>
        </div>
    );
}
