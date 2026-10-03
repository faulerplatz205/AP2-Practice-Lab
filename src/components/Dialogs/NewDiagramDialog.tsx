import type { ReactElement } from "react";
import { useDiagram } from "../../state/diagramStore";
import { useUi } from "../../state/uiStore";
import { newDiagram } from "../../state/actions";
import { MODES, MODE_KEYS } from "../../data/modes";
import { useText } from "../../i18n/locale";
import { dialogText, newDiagramText } from "../../i18n/dialogs";
import { NodePreview } from "../Preview";

export function NewDiagramDialog(): ReactElement {
    const t = useText(newDiagramText), common = useText(dialogText), modes = useText(MODES);
    const mode = useDiagram(s => s.doc.cfg.mode);
    const close = useUi(s => s.close);
    return <>
        <h3>{t.title}</h3>
        <p>{t.intro}</p>
        <div className="nm-grid">
            {MODE_KEYS.map(k => (
                <button key={k} type="button" data-newmode={k} onClick={() => newDiagram(k)}>
                    <NodePreview type={modes[k].items[0].type} preset={modes[k].items[0].preset} width={60} height={40} />
                    <span>{modes[k].label}</span>
                </button>
            ))}
        </div>
        <div className="row">
            <button className="btn primary" id="mYes" onClick={() => newDiagram(mode)}>{t.restart(modes[mode].label)}</button>
            <button className="btn ghost" id="mNo" onClick={close}>{common.cancel}</button>
        </div>
    </>;
}
