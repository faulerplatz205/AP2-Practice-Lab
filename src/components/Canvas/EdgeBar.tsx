import type { ReactElement } from "react";
import { useDiagram } from "../../state/diagramStore";
import { canFlip, flipCardinality, partnerLine, setErCardinality, setErPair, setRelationEnds } from "../../state/actions";
import { findEdge, findNode } from "../../lib/diagram";
import { edgeGeometry } from "../../lib/uml/routing";
import { useText } from "../../i18n/locale";
import { canvasText } from "../../i18n/canvas";

const ER_VALUES = [ "1", "n", "m" ];
const FK_VALUES: [string, string][] = [[ "1", "n" ], [ "n", "1" ], [ "1", "1" ]];
const ER_PAIRS: [string, string][] = [[ "1", "1" ], [ "1", "n" ], [ "n", "1" ], [ "n", "m" ]];

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
    const flip = canFlip(doc, edge);
    if (!isEr && !isFk && !flip) return null;

    const g = edgeGeometry(doc, edge, a, b);
    const style = { left: view.x + g.lx * view.z, top: view.y + (g.ly + 14) * view.z };
    const current = (edge.label ?? "").trim().toLowerCase();
    const partner = isEr ? partnerLine(doc, edge) : undefined;
    const entityName = (x: typeof edge): string => [ findNode(doc, x.from), findNode(doc, x.to) ].find(n => n?.type === "entity")?.text.replace(/\n/g, " ") ?? "";

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
            {flip && <>
                {(isEr || isFk) && <span className="sepv" />}
                <button type="button" className="btn" id="ebFlip" title={t.edgeBar.flip} onClick={() => flipCardinality(edge.id)}>⇄</button>
            </>}
        </div>
    );
}
