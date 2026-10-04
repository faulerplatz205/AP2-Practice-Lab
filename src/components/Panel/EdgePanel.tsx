import type { ReactElement } from "react";
import type { DiagramEdge, DiagramNode, RelationKind } from "../../types/diagram";
import { useDiagram } from "../../state/diagramStore";
import { deleteSelection, guardText, isGuard, wrapGuard } from "../../state/actions";
import { findEdge, isActivity } from "../../lib/diagram";
import { RELATIONS, RELATION_KINDS, isUml } from "../../lib/uml/types";
import { useText } from "../../i18n/locale";
import { relationLabels, umlText } from "../../i18n/diagram";
import { panelText } from "../../i18n/panel";
import { dbText } from "../../i18n/database";
import { LiveInput } from "./LiveInput";
import { BackToCheck, Heading } from "./common";

/** Display name of a node: activity number and name, or the last line of its text. */
function nodeName(n: DiagramNode, uml: typeof umlText.de): string {
    if (isActivity(n)) return `${n.f.nr} ${n.f.name}`;
    return String(n.text || "").split("\n").pop() || (isUml(n.type) ? uml[n.type].label : "");
}

export function EdgePanel({ edge: e, from, to }: { edge: DiagramEdge; from: DiagramNode; to: DiagramNode }): ReactElement {
    const t = useText(panelText), uml = useText(umlText), relations = useText(relationLabels);
    const kind = e.kind ?? "flow", rel = RELATIONS[kind];
    const guard = isGuard(e.id);
    const withMultiplicity = [ "assoc", "dir", "aggr", "comp", "fk" ].includes(kind);
    const db = useText(dbText);
    const change = useDiagram.getState().change;
    const label = rel.seq ? t.message : from.type === "decision" ? t.guardLabel : kind === "erl" ? db.cardinality : t.label;
    return <>
        <BackToCheck />
        <Heading eyebrow={t.connection} title={`${nodeName(from, uml)} → ${nodeName(to, uml)}`} />
        <label className="field">{t.kind}
            <select id="f-kind" value={kind} onChange={ev => change(d => {
                const x = findEdge(d, e.id)!;
                x.kind = ev.target.value as RelationKind;
                if (RELATIONS[x.kind].seq && x.y === undefined) x.y = 60;
            })}>
                {RELATION_KINDS.map(k => <option key={k} value={k}>{relations[k]}</option>)}
            </select>
        </label>
        <label className={guard ? "field guard" : "field"}>{label}
            <LiveInput id="f-label" placeholder={rel.seq ? t.messagePlaceholder : guard ? t.guardPlaceholder : kind === "erl" ? db.cardinalityPlaceholder : t.optional}
                value={guard ? guardText(e.label) : e.label || ""}
                write={(d, v) => {
                    findEdge(d, e.id)!.label = guard ? wrapGuard(v) : v;
                }} />
        </label>
        {withMultiplicity && <div className="fields">
            <label className={kind === "fk" ? "full" : "wide"}>{kind === "fk" ? db.cardinalityStart(nodeName(from, uml)) : t.multiplicityStart}<LiveInput id="f-m1" placeholder="1" value={e.m1 ?? ""} write={(d, v) => {
                findEdge(d, e.id)!.m1 = v;
            }} /></label>
            <label className={kind === "fk" ? "full" : undefined}>{kind === "fk" ? db.cardinalityStart(nodeName(to, uml)) : t.multiplicityEnd}<LiveInput id="f-m2" placeholder={kind === "fk" ? "n" : "0..*"} value={e.m2 ?? ""} write={(d, v) => {
                findEdge(d, e.id)!.m2 = v;
            }} /></label>
        </div>}
        {rel.seq && <p>{t.moveMessage}</p>}
        <div className="row">
            <button className="btn ghost" id="pRev" onClick={() => change(d => {
                const x = findEdge(d, e.id)!;
                [ x.from, x.to ] = [ x.to, x.from ];
            })}>{t.reverse}</button>
            <button className="btn ghost" id="pDel" onClick={deleteSelection}>{t.delete}</button>
        </div>
    </>;
}
