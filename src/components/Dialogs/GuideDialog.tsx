import type { ReactElement } from "react";
import { useUi } from "../../state/uiStore";
import { openGuide } from "../../state/actions";
import { GUIDE } from "../../data/guide";
import { useText } from "../../i18n/locale";
import { dialogText, guideDialogText } from "../../i18n/dialogs";

export function GuideDialog({ chapter }: { chapter: number }): ReactElement {
    const t = useText(guideDialogText), common = useText(dialogText), guide = useText(GUIDE);
    const close = useUi(s => s.close);
    const prev = guide[chapter - 1], next = guide[chapter + 1];
    return <>
        <h3>{t.title}</h3>
        <div className="guide">
            <nav className="gnav" aria-label={t.chapters}>
                {guide.map((g, k) => <button key={k} type="button" data-g={k} aria-current={k === chapter} onClick={() => openGuide(k)}>{g.title}</button>)}
            </nav>
            <div className="gbody">{guide[chapter].body}</div>
        </div>
        <div className="gfoot">
            {prev && <button className="btn ghost" id="gPrev" onClick={() => openGuide(chapter - 1)}>← {prev.title}</button>}
            <span className="sep" />
            {next && <button className="btn primary" id="gNext" onClick={() => openGuide(chapter + 1)}>{next.title} →</button>}
            <button className="btn" id="mClose" onClick={close}>{common.close}</button>
        </div>
    </>;
}
