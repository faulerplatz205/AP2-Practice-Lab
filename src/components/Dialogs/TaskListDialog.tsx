import { type ReactElement, useRef, useState } from "react";
import { useDiagram } from "../../state/diagramStore";
import { useUi } from "../../state/uiStore";
import { buildFromTaskList } from "../../state/actions";
import { toTaskList } from "../../lib/netzplan/taskList";
import { useText } from "../../i18n/locale";
import { dialogText, taskListDialogText } from "../../i18n/dialogs";
import { copyText } from "./Modal";

export function TaskListDialog(): ReactElement {
    const t = useText(taskListDialogText), common = useText(dialogText);
    const close = useUi(s => s.close);
    const [ text, setText ] = useState(() => toTaskList(useDiagram.getState().doc));
    const [ alsoCalculate, setAlsoCalculate ] = useState(true);
    const [ error, setError ] = useState("");
    const field = useRef<HTMLTextAreaElement>(null);
    return <>
        <h3>{t.title}</h3>
        <p>{t.formatBefore}<b>{t.format}</b>{t.formatAfter}</p>
        <textarea id="mList" ref={field} spellCheck={false} value={text} onChange={e => setText(e.target.value)} placeholder={t.placeholder} />
        <label className="check"><input type="checkbox" id="mCalc" checked={alsoCalculate} onChange={e => setAlsoCalculate(e.target.checked)} /> {t.alsoCalculate}</label>
        <div className="err" id="mErr">{error}</div>
        <div className="row">
            <button className="btn primary" id="mBuild" onClick={() => setError(buildFromTaskList(text, alsoCalculate) ?? "")}>{t.build}</button>
            <button className="btn ghost" id="mCopyL" onClick={() => copyText(text, field.current, t.copied)}>{t.copy}</button>
            <span className="sep" />
            <button className="btn" id="mClose" onClick={close}>{common.cancel}</button>
        </div>
    </>;
}
