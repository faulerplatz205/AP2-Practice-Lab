import { type ReactElement, useState } from "react";
import { useUi } from "../../state/uiStore";
import { startExercise } from "../../state/actions";
import { useText } from "../../i18n/locale";
import { dialogText, exerciseDialogText } from "../../i18n/dialogs";

const SIZES = [ 6, 8, 10 ];

export function ExerciseDialog(): ReactElement {
    const t = useText(exerciseDialogText), common = useText(dialogText);
    const close = useUi(s => s.close);
    const [ kind, setKind ] = useState<"calc" | "draw">("calc");
    const [ size, setSize ] = useState(6);
    return <>
        <h3>{t.title}</h3>
        <p>{t.intro}</p>
        <div className="opts">
            <label className="opt">
                <input type="radio" name="tm" value="calc" checked={kind === "calc"} onChange={() => setKind("calc")} />
                <div><b>{t.calc}</b><span>{t.calcDescription}</span></div>
            </label>
            <label className="opt">
                <input type="radio" name="tm" value="draw" checked={kind === "draw"} onChange={() => setKind("draw")} />
                <div><b>{t.draw}</b><span>{t.drawDescription}</span></div>
            </label>
        </div>
        <div className="field">{t.size}
            <div className="seg" id="tSize">
                {SIZES.map(n => <button key={n} type="button" data-n={n} aria-pressed={size === n} onClick={() => setSize(n)}>{t.activities(n)}</button>)}
            </div>
        </div>
        <div className="row">
            <button className="btn primary" id="mGo" onClick={() => {
                close();
                startExercise(kind, size);
            }}>{t.create}</button>
            <button className="btn" id="mClose" onClick={close}>{common.cancel}</button>
        </div>
    </>;
}
