import type { ReactElement } from "react";
import type { Diagram, DiagramNode, NodeType } from "../../types/diagram";
import { useDiagram } from "../../state/diagramStore";
import { appendAfter } from "../../state/actions";
import { findNode } from "../../lib/diagram";
import { FLOW_TYPES, FRAGMENT_OPERATORS, UML_TYPES, isUml } from "../../lib/uml/types";
import { useText } from "../../i18n/locale";
import { umlText } from "../../i18n/diagram";
import { panelText } from "../../i18n/panel";
import { NodePreview } from "../Preview";
import { LiveInput, LiveTextarea } from "./LiveInput";
import { SizeFields } from "./SizeFields";
import { BackToCheck, Heading, NodeActions, Swatches } from "./common";

const BAR = { w: 200, h: 8 };

/** "Append next" in activity and state machine diagrams; on a decision "Add branch". */
function QuickAppend({ node: n }: { node: DiagramNode }): ReactElement | null {
    const t = useText(panelText);
    if (!FLOW_TYPES.has(n.type) || n.type === "end" || n.type === "flowend") return null;
    const labels: Partial<Record<NodeType, string>> = n.type === "state" ? t.appendState : t.appendFlow;
    const options = Object.entries(labels) as [NodeType, string][];
    return (
        <div className="field">{n.type === "decision" ? t.addBranch : t.appendNext}
            <div className="quick">
                {options.map(([ type, label ]) => (
                    <button key={type} type="button" className="btn ghost" data-q={type} onClick={() => appendAfter(n.id, type, type === "bar" ? BAR : undefined)}>
                        <NodePreview type={type} preset={type === "bar" ? BAR : undefined} />
                        <span>{label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export function UmlPanel({ node: n }: { node: DiagramNode }): ReactElement | null {
    const t = useText(panelText), uml = useText(umlText);
    if (!isUml(n.type)) return null;
    const info = UML_TYPES[n.type], label = uml[n.type].label;
    const write = (key: "text" | "attrs" | "ops") => (d: Diagram, v: string): void => {
        findNode(d, n.id)![key] = v;
    };
    const setValue = (key: "text" | "stereo", value: string): void => useDiagram.getState().change(d => {
        (findNode(d, n.id) as unknown as Record<string, string>)[key] = value;
    });
    const nameLabel = n.type === "lifeline" || n.type === "object" ? t.nameObject : t.name;

    let textField: ReactElement | null = null;
    if (!info.notext) {
        if (n.type === "fragment") {
            textField = <>
                <label className="field">{t.operator}
                    <select id="f-text" value={n.text} onChange={e => setValue("text", e.target.value)}>
                        {FRAGMENT_OPERATORS.map(o => <option key={o}>{o}</option>)}
                    </select>
                </label>
                <label className="field">{t.condition}<LiveInput id="f-attrs" placeholder={t.conditionPlaceholder} value={n.attrs ?? ""} write={write("attrs")} /></label>
            </>;
        } else if (n.type === "note" || n.type === "node3d") {
            textField = <label className="field">{t.text}<LiveTextarea id="f-text" value={n.text} write={write("text")} /></label>;
        } else {
            textField = <label className="field">{nameLabel}<LiveInput id="f-text" value={n.text} write={write("text")} /></label>;
        }
    }

    return <>
        <BackToCheck />
        <Heading eyebrow={label} title={String(n.text || "").split("\n").pop() || label} />
        <QuickAppend node={n} />
        {textField}
        {n.type === "class" && <>
            <label className="field">{t.kind}
                <select id="f-stereo" value={n.stereo ?? ""} onChange={e => setValue("stereo", e.target.value)}>
                    {Object.entries(t.classKinds).map(([ value, name ]) => <option key={value} value={value}>{name}</option>)}
                </select>
            </label>
            <label className="field">{n.stereo === "enum" ? t.enumValues : t.attributes}
                <LiveTextarea id="f-attrs" className="mono" placeholder="- name : String" value={n.attrs ?? ""} write={write("attrs")} />
            </label>
            {n.stereo !== "enum" && <label className="field">{t.methods}
                <LiveTextarea id="f-ops" className="mono" placeholder="+ getName() : String" value={n.ops ?? ""} write={write("ops")} />
            </label>}
            <p>{t.visibility}</p>
        </>}
        {n.type === "object" && <label className="field">{t.attributeValues}
            <LiveTextarea id="f-attrs" className="mono" placeholder={t.objectPlaceholder} value={n.attrs ?? ""} write={write("attrs")} />
        </label>}
        {n.type === "state" && <label className="field">{t.stateActivities}
            <LiveTextarea id="f-attrs" className="mono" placeholder={"entry / …\ndo / …\nexit / …"} value={n.attrs ?? ""} write={write("attrs")} />
        </label>}
        <SizeFields node={n} height={n.type !== "class" && n.type !== "object"} />
        {!info.notext && !info.box && n.type !== "note" && <Swatches node={n} />}
        <NodeActions />
    </>;
}
