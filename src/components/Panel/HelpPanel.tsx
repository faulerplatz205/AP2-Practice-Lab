import type { ReactElement } from "react";
import { useDiagram } from "../../state/diagramStore";
import { addExample, openGuide } from "../../state/actions";
import { MODES } from "../../data/modes";
import { useText } from "../../i18n/locale";
import { panelText } from "../../i18n/panel";
import { ActivityLegend } from "../ActivityLegend";
import { CountingMode, ExerciseBanner, NormBanner, Rich } from "./common";

export function HelpPanel(): ReactElement {
    const t = useText(panelText);
    const mode = useDiagram(s => s.doc.cfg.mode);
    const info = useText(MODES)[mode];
    if (mode !== "netz") {
        return <>
            <NormBanner />
            <div><div className="eyebrow">{info.label}</div><h2>{t.howTo}</h2></div>
            <ol className="tips">{info.tips.map(tip => <li key={tip}>{tip}</li>)}</ol>
            {info.example && <button className="btn ghost" id="hEx" style={{ alignSelf: "flex-start" }} onClick={() => addExample(info.example!)}>{t.showExample}</button>}
            <p><Rich text={t.modeHelp} /></p>
            <button className="btn primary" id="hGuide" style={{ alignSelf: "flex-start" }} onClick={() => openGuide(0)}>{t.openGuide}</button>
        </>;
    }
    return <>
        <ExerciseBanner />
        <div><div className="eyebrow">{t.netzplan}</div><h2>{t.howItWorks}</h2></div>
        <p>{t.netzplanIntro}</p>
        <button className="btn primary" id="hGuide" style={{ alignSelf: "flex-start" }} onClick={() => openGuide(0)}>{t.openGuide}</button>
        <CountingMode />
        <p><Rich text={t.netzplanTools} /></p>
        <ActivityLegend />
        <div className="keys">
            {t.keys.map(([ key, action ]) => <KeyRow key={key} keys={key} action={action} />)}
        </div>
        <p>{t.autosave}</p>
    </>;
}

function KeyRow({ keys, action }: { keys: string; action: string }): ReactElement {
    return <><kbd>{keys}</kbd><span>{action}</span></>;
}
