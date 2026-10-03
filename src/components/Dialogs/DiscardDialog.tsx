import type { ReactElement } from "react";
import { useUi } from "../../state/uiStore";
import { currentPlan } from "../../state/planStore";
import { saveThen } from "../../state/actions";
import { useText } from "../../i18n/locale";
import { dialogText, discardText } from "../../i18n/dialogs";

export function DiscardDialog({ then }: { then: () => void }): ReactElement {
    const t = useText(discardText), common = useText(dialogText);
    const close = useUi(s => s.close);
    const plan = currentPlan();
    return <>
        <h3>{t.title}</h3>
        <p>{plan ? t.unsaved(plan.name) : t.notSavedYet}</p>
        <div className="row">
            <button className="btn primary" id="mY" onClick={() => saveThen(then)}>{t.saveAndContinue}</button>
            <button className="btn ghost" id="mN" onClick={then}>{t.dontSave}</button>
            <button className="btn" id="mC" onClick={close}>{common.cancel}</button>
        </div>
    </>;
}
