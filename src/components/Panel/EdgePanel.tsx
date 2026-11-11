import type { ReactElement } from "react";
import type { Diagram, DiagramEdge, DiagramNode, RelationKind } from "../../types/diagram";
import { useDiagram } from "../../state/diagramStore";
import { MULTIPLICITY_KINDS, deleteSelection, guardText, isGuard, isTransition, reverseEdge, wrapGuard } from "../../state/actions";
import { type Transition, formatTransition, parseTransition } from "../../lib/uml/guards";
import { findEdge, findNode, isActivity } from "../../lib/diagram";
import { RELATIONS, RELATION_KINDS, SEQUENCE_TYPES, isUml } from "../../lib/uml/types";
import { messageY, moveMessage } from "../../lib/uml/sequence";
import { useText } from "../../i18n/locale";
import { relationLabels, umlText } from "../../i18n/diagram";
import { panelText } from "../../i18n/panel";
import { dbText } from "../../i18n/database";
import { MODES } from "../../data/modes";
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
    const withMultiplicity = MULTIPLICITY_KINDS.includes(kind);
    const transition = isTransition(e.id), parts = parseTransition(e.label);
    const part = (key: keyof Transition) => (d: Diagram, v: string): void => {
        const x = findEdge(d, e.id)!;
        // typed brackets or a leading slash are not doubled
        const clean = key === "guard" ? guardText(v) : key === "effect" ? v.replace(/^\s*\/\s*/, "") : v;
        x.label = formatTransition({ ...parseTransition(x.label), [key]: clean });
    };
    const db = useText(dbText), modes = useText(MODES);
    const mode = useDiagram(s => s.doc.cfg.mode);
    const change = useDiagram.getState().change;
    // between lifelines only the message kinds make sense
    const between = SEQUENCE_TYPES.has(from.type) && SEQUENCE_TYPES.has(to.type);
    // only the relations of the current diagram kind (all in „Frei“), plus the line's own kind
    const allowed = mode === "frei" ? RELATION_KINDS : modes[mode].relations;
    const choices = RELATION_KINDS.filter(k => k === kind || (allowed.includes(k) && (!between || RELATIONS[k].seq)));
    const label = rel.seq ? t.message : from.type === "decision" ? t.guardLabel : kind === "erl" ? db.cardinality : t.label;
    return <>
        <BackToCheck />
        <Heading eyebrow={t.connection} title={`${nodeName(from, uml)} → ${nodeName(to, uml)}`} />
        <label className="field">{t.kind}
            <select id="f-kind" value={kind} onChange={ev => change(d => {
                const x = findEdge(d, e.id)!, a = findNode(d, x.from), b = findNode(d, x.to);
                const y = a && b && RELATIONS[kind].seq ? messageY(x, a, b) : undefined;
                x.kind = ev.target.value as RelationKind;
                // a kind without multiplicities must not keep drawing the old ones
                if (!MULTIPLICITY_KINDS.includes(x.kind)) {
                    delete x.m1;
                    delete x.m2;
                }
                if (RELATIONS[x.kind].seq && x.y === undefined) x.y = 60;
                if (y !== undefined && RELATIONS[x.kind].seq) moveMessage(d, x, y);
            })}>
                {choices.map(k => <option key={k} value={k}>{relations[k]}</option>)}
            </select>
        </label>
        {transition ? <>
            <label className="field">{t.trigger}<LiveInput id="f-trigger" placeholder={t.triggerPlaceholder} value={parts.trigger} write={part("trigger")} /></label>
            <label className="field guard">{t.guard}<LiveInput id="f-guard" placeholder={t.guardInnerPlaceholder} value={parts.guard} write={part("guard")} /></label>
            <label className="field slash">{t.effect}<LiveInput id="f-effect" placeholder={t.effectPlaceholder} value={parts.effect} write={part("effect")} /></label>
            <p>{t.transitionHint}</p>
        </> : <label className={guard ? "field guard" : "field"}>{label}
            <LiveInput id="f-label" placeholder={rel.seq ? t.messagePlaceholder : guard ? t.guardPlaceholder : kind === "erl" ? db.cardinalityPlaceholder : t.optional}
                value={guard ? guardText(e.label) : e.label || ""}
                write={(d, v) => {
                    findEdge(d, e.id)!.label = guard ? wrapGuard(v) : v;
                }} />
        </label>}
        {withMultiplicity && <div className="fields">
            <label className={kind === "fk" ? "full" : "wide"}>{kind === "fk" ? db.cardinalityStart(nodeName(from, uml)) : t.multiplicityStart}<LiveInput id="f-m1" placeholder="1" value={e.m1 ?? ""} write={(d, v) => {
                findEdge(d, e.id)!.m1 = v;
            }} /></label>
            <label className={kind === "fk" ? "full" : undefined}>{kind === "fk" ? db.cardinalityStart(nodeName(to, uml)) : t.multiplicityEnd}<LiveInput id="f-m2" placeholder={kind === "fk" ? "n" : "0..*"} value={e.m2 ?? ""} write={(d, v) => {
                findEdge(d, e.id)!.m2 = v;
            }} /></label>
        </div>}
        {withMultiplicity && kind !== "fk" && <p>{t.multiplicityHint}</p>}
        {rel.seq && <p>{t.moveMessage}</p>}
        <div className="row">
            <button className="btn ghost" id="pRev" onClick={() => reverseEdge(e.id)}>{t.reverse}</button>
            <button className="btn ghost" id="pDel" onClick={deleteSelection}>{t.delete}</button>
        </div>
    </>;
}
