import { type ReactElement, useRef } from "react";
import { useUi } from "../../state/uiStore";
import { currentPlan } from "../../state/planStore";
import { savePlanAs, suggestedPlanName } from "../../state/actions";
import { useText } from "../../i18n/locale";
import { dialogText, saveAsText } from "../../i18n/dialogs";

export function SaveAsDialog(): ReactElement {
    const t = useText(saveAsText), common = useText(dialogText);
    const close = useUi(s => s.close);
    const input = useRef<HTMLInputElement>(null);
    const save = (): void => savePlanAs(input.current?.value ?? "");
    return <>
        <h3>{currentPlan() ? t.saveAs : t.savePlan}</h3>
        <p>{t.intro}</p>
        <label className="field">{t.name}
            <input id="mName" ref={input} maxLength={80} defaultValue={suggestedPlanName()} autoFocus onFocus={e => e.currentTarget.select()}
                onKeyDown={e => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        save();
                    }
                }} />
        </label>
        <div className="row">
            <button className="btn primary" id="mDoSave" onClick={save}>{t.save}</button>
            <button className="btn" id="mClose" onClick={close}>{common.cancel}</button>
        </div>
    </>;
}
