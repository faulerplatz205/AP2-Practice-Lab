import { type ReactElement, useMemo } from "react";
import { useDiagram } from "../../state/diagramStore";
import { useUi } from "../../state/uiStore";
import { Icon } from "../Icon";
import { runCheck } from "../../lib/check";
import { findEdge, findNode, isActivity } from "../../lib/diagram";
import { isUml } from "../../lib/uml/types";
import { ActivityPanel } from "./ActivityPanel";
import { CheckPanel } from "./CheckPanel";
import { EdgePanel } from "./EdgePanel";
import { HelpPanel } from "./HelpPanel";
import { ShapePanel } from "./ShapePanel";
import { UmlPanel } from "./UmlPanel";
import { useLocale, useText } from "../../i18n/locale";
import { panelText } from "../../i18n/panel";

/** Priority: selection > check result > short guide. */
export function Panel(): ReactElement {
    const doc = useDiagram(s => s.doc);
    const selection = useDiagram(s => s.selection);
    const checkActive = useDiagram(s => s.checkActive);
    const panelOpen = useUi(s => s.panelOpen);
    const t = useText(panelText);
    // The check messages are texts in the current language: recompute on a language switch
    const locale = useLocale(s => s.locale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const result = useMemo(() => checkActive ? runCheck(doc) : null, [ checkActive, doc, locale ]);

    let content: ReactElement;
    const node = selection?.kind === "node" ? findNode(doc, selection.id) : undefined;
    const edge = selection?.kind === "edge" ? findEdge(doc, selection.id) : undefined;
    const from = edge && findNode(doc, edge.from), to = edge && findNode(doc, edge.to);
    if (node) {
        content = isActivity(node) ? <ActivityPanel node={node} /> : isUml(node.type) ? <UmlPanel node={node} /> : <ShapePanel node={node} />;
    } else if (edge && from && to) {
        content = <EdgePanel edge={edge} from={from} to={to} />;
    } else if (result) {
        content = <CheckPanel result={result} />;
    } else {
        content = <HelpPanel />;
    }
    if (!panelOpen) {
        return (
            <aside className="panel folded" id="panel" aria-label={t.ariaLabel}>
                <PanelToggle open={false} title={t.unfold} />
            </aside>
        );
    }
    // key: rebuild the inputs when another element is selected
    return (
        <aside className="panel" id="panel" aria-label={t.ariaLabel} key={selection ? `${selection.kind}${selection.id}` : "none"}>
            <PanelToggle open title={t.fold} />
            {content}
        </aside>
    );
}

function PanelToggle({ open, title }: { open: boolean; title: string }): ReactElement {
    return (
        <button type="button" className="btn pfold" id="bPanel" title={title} aria-label={title} aria-expanded={open} onClick={() => useUi.getState().setPanelOpen(!open)}>
            <Icon name="chevron" size={16} />
        </button>
    );
}
