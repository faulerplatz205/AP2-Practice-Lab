import type { ReactElement } from "react";
import { useDiagram } from "../../state/diagramStore";
import { MULTIPLICITY_KINDS, canFlip, deleteSelection, flipCardinality, openEdgeEditor, partnerLine, reverseEdge, setErCardinality, setErPair, setRelationEnds } from "../../state/actions";
import { findEdge, findNode } from "../../lib/diagram";
import { edgeGeometry } from "../../lib/uml/routing";
import { RELATIONS } from "../../lib/uml/types";
import { useText } from "../../i18n/locale";
import { canvasText } from "../../i18n/canvas";
import { LiveInput } from "../Panel/LiveInput";
import { Icon } from "../Icon";

const ER_VALUES = [ "1", "n", "m" ];
const FK_VALUES: [string, string][] = [[ "1", "n" ], [ "n", "1" ], [ "1", "1" ]];
const ER_PAIRS: [string, string][] = [[ "1", "1" ], [ "1", "n" ], [ "n", "1" ], [ "n", "m" ]];
/** Suggestions for the multiplicity fields of an association. */
const MULTIPLICITIES = [ "1", "0..1", "*", "0..*", "1..*" ];

/**
 * Floating bar at the selected line: cardinalities (ER, table model), the multiplicities at both ends of an
 * association, and the actions every line has (edit the label, reverse, delete).
 */
export function EdgeBar(): ReactElement | null {
    const t = useText(canvasText);
    const doc = useDiagram(s => s.doc);
    const view = useDiagram(s => s.view);
    const selection = useDiagram(s => s.selection);
    const editing = useDiagram(s => s.editor !== null);
    const edge = selection?.kind === "edge" ? findEdge(doc, selection.id) : undefined;
    if (!edge || editing) return null;
    const a = findNode(doc, edge.from), b = findNode(doc, edge.to);
    if (!a || !b) return null;
    const kind = edge.kind ?? "flow";
    const isEr = kind === "erl" && [ a.type, b.type ].includes("entity") && [ a.type, b.type ].includes("relship");
    const isFk = kind === "fk";
    const flip = (isEr || isFk) && canFlip(doc, edge);
    const multiplicity = MULTIPLICITY_KINDS.includes(kind) && !isFk;
    // an attribute line of the ER model has neither a label nor a direction
    if (kind === "erl" && !isEr) return null;

    const g = edgeGeometry(doc, edge, a, b);
    const canvas = document.getElementById("canvas");
    const width = canvas?.clientWidth ?? 0, height = canvas?.clientHeight ?? 0;
    const x = view.x + g.lx * view.z, y = view.y + (g.ly + 14) * view.z;
    const style = { left: width ? Math.max(150, Math.min(width - 150, x)) : x, top: height ? Math.max(8, Math.min(height - 52, y)) : y };
    const current = (edge.label ?? "").trim().toLowerCase();
    const partner = isEr ? partnerLine(doc, edge) : undefined;
    const entityName = (e: typeof edge): string => [ findNode(doc, e.from), findNode(doc, e.to) ].find(n => n?.type === "entity")?.text.replace(/\n/g, " ") ?? "";
    const name = (n: typeof a): string => String(n.text || "").split("\n").pop() ?? "";

    return (
        <div className="edgebar" id="edgebar" role="toolbar" aria-label={t.edgeBar.label} style={style}>
            {partner && ER_PAIRS.map(([ own, other ]) => (
                <button key={own + other} type="button" className="btn" data-card={`${own}:${other}`} title={t.edgeBar.erPair(entityName(edge), own, other, entityName(partner))}
                    aria-pressed={current === own && (partner.label ?? "").trim().toLowerCase() === other} onClick={() => setErPair(edge.id, own, other)}>{own}:{other}</button>
            ))}
            {isEr && !partner && ER_VALUES.map(v => (
                <button key={v} type="button" className="btn" data-card={v} title={t.edgeBar.er(v)} aria-pressed={current === v} onClick={() => setErCardinality(edge.id, v)}>{v}</button>
            ))}
            {isFk && FK_VALUES.map(([ s, e ]) => (
                <button key={s + e} type="button" className="btn" data-card={`${s}:${e}`} title={t.edgeBar.fk(`${s}:${e}`)} aria-pressed={edge.m1 === s && edge.m2 === e} onClick={() => setRelationEnds(edge.id, s, e)}>{s}:{e}</button>
            ))}
            {flip && <button type="button" className="btn" id="ebFlip" title={t.edgeBar.flip} onClick={() => flipCardinality(edge.id)}>⇄</button>}
            {multiplicity && <>
                <LiveInput id="eb-m1" className="mult" list="multiplicities" placeholder="1" title={t.edgeBar.multStart(name(a))} aria-label={t.edgeBar.multStart(name(a))} value={edge.m1 ?? ""}
                    write={(d, v) => {
                        findEdge(d, edge.id)!.m1 = v.trim();
                    }} />
                <span className="dash" aria-hidden="true" />
                <LiveInput id="eb-m2" className="mult" list="multiplicities" placeholder="0..*" title={t.edgeBar.multEnd(name(b))} aria-label={t.edgeBar.multEnd(name(b))} value={edge.m2 ?? ""}
                    write={(d, v) => {
                        findEdge(d, edge.id)!.m2 = v.trim();
                    }} />
                <datalist id="multiplicities">{MULTIPLICITIES.map(m => <option key={m} value={m} />)}</datalist>
            </>}
            {(isEr || isFk || multiplicity) && <span className="sepv" />}
            {!RELATIONS[kind].tag && kind !== "erl" && <button type="button" className="btn" id="ebEdit" title={t.edgeBar.edit} onClick={() => openEdgeEditor(edge.id)}><Icon name="edit" /></button>}
            {kind !== "erl" && <button type="button" className="btn" id="ebReverse" title={t.edgeBar.reverse} onClick={() => reverseEdge(edge.id)}><Icon name="swap" /></button>}
            {<button type="button" className="btn" id="ebDelete" title={t.edgeBar.remove} onClick={deleteSelection}><Icon name="trash" /></button>}
        </div>
    );
}
