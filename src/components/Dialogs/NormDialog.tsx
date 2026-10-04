import { type ReactElement, useState } from "react";
import { useUi } from "../../state/uiStore";
import { startNormExercise } from "../../state/actions";
import { NORM_IDS, type NormScenarioId } from "../../data/normalization";
import { useText } from "../../i18n/locale";
import { dialogText } from "../../i18n/dialogs";
import { dbText, normText } from "../../i18n/database";

export function NormDialog(): ReactElement {
    const t = useText(dbText), scenarios = useText(normText), common = useText(dialogText);
    const close = useUi(s => s.close);
    const [ id, setId ] = useState<NormScenarioId>("invoice");
    return <>
        <h3>{t.dialogTitle}</h3>
        <p>{t.dialogIntro}</p>
        <div className="opts">
            {NORM_IDS.map(k => (
                <label className="opt" key={k}>
                    <input type="radio" name="norm" value={k} data-norm={k} checked={id === k} onChange={() => setId(k)} />
                    <div><b>{scenarios[k].title}</b><span>{scenarios[k].description}</span></div>
                </label>
            ))}
        </div>
        <div className="row">
            <button className="btn primary" id="mGo" onClick={() => startNormExercise(id)}>{t.start}</button>
            <button className="btn" id="mClose" onClick={close}>{common.cancel}</button>
        </div>
    </>;
}
