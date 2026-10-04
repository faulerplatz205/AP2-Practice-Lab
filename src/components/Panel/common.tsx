import { Fragment, type ReactElement, type ReactNode } from "react";
import type { DiagramNode } from "../../types/diagram";
import { useDiagram } from "../../state/diagramStore";
import { deleteSelection, duplicateSelection, endExercise, endNormExercise, select, setCountingMode, showNormSolution } from "../../state/actions";
import { isNormId } from "../../data/normalization";
import { dbText, normText } from "../../i18n/database";
import { FILLS } from "../../lib/constants";
import { findNode } from "../../lib/diagram";
import { useText } from "../../i18n/locale";
import { fillNames } from "../../i18n/diagram";
import { panelText } from "../../i18n/panel";

/** Renders a dictionary text with `**bold**` and `[[key]]` as <b> and <kbd>. */
export function Rich({ text }: { text: string }): ReactElement {
    const parts: ReactNode[] = text.split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\])/).map((part, i) => {
        if (part.startsWith("**")) return <b key={i}>{part.slice(2, -2)}</b>;
        if (part.startsWith("[[")) return <kbd key={i}>{part.slice(2, -2)}</kbd>;
        return <Fragment key={i}>{part}</Fragment>;
    });
    return <>{parts}</>;
}

export function Swatches({ node }: { node: DiagramNode }): ReactElement {
    const t = useText(panelText), names = useText(fillNames);
    return (
        <div className="field">{t.fillColor}
            <div className="sw">
                {FILLS.map((f, i) => (
                    <button key={i} type="button" data-fill={i} style={{ background: f.color }} title={names[i]} aria-label={names[i]} aria-pressed={node.fill === i}
                        onClick={() => useDiagram.getState().change(d => {
                            findNode(d, node.id)!.fill = i;
                        })} />
                ))}
            </div>
        </div>
    );
}

export function NodeActions(): ReactElement {
    const t = useText(panelText);
    return (
        <div className="row">
            <button className="btn ghost" id="pDup" onClick={duplicateSelection}>{t.duplicate}</button>
            <button className="btn ghost" id="pDel" onClick={deleteSelection}>{t.delete}</button>
        </div>
    );
}

export function BackToCheck(): ReactElement | null {
    const t = useText(panelText);
    const active = useDiagram(s => s.checkActive);
    if (!active) return null;
    return <button className="btn ghost" id="pBack" style={{ alignSelf: "flex-start" }} onClick={() => select(null)}>{t.backToCheck}</button>;
}

export function Heading({ eyebrow, title }: { eyebrow: string; title: string }): ReactElement {
    return <div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div>;
}

export function CountingMode(): ReactElement {
    const t = useText(panelText);
    const start = useDiagram(s => s.doc.cfg.start);
    return (
        <div className="field">{t.countingMode}
            <div className="seg" role="group" aria-label={t.countingMode}>
                <button type="button" data-start="0" aria-pressed={start === 0} onClick={() => setCountingMode(0)}>{t.startAt(0)}</button>
                <button type="button" data-start="1" aria-pressed={start === 1} onClick={() => setCountingMode(1)}>{t.startAt(1)}</button>
            </div>
        </div>
    );
}

export function NormBanner(): ReactElement | null {
    const t = useText(dbText), scenarios = useText(normText);
    const norm = useDiagram(s => s.doc.norm);
    if (!isNormId(norm?.id)) return null;
    return (
        <div className="banner" id="normBanner">
            <span><b>{t.exerciseRunning}</b> ({scenarios[norm.id].title})</span>
            <span>{norm.done ? <b>{t.solved}</b> : t.task}</span>
            <span><Rich text={t.rules} /></span>
            <div className="row">
                {!norm.shown && <button className="btn ghost" id="nSolution" onClick={showNormSolution}>{t.showSolution}</button>}
                <button className="btn ghost" id="nEnd" onClick={endNormExercise}>{t.endExercise}</button>
            </div>
        </div>
    );
}

export function ExerciseBanner(): ReactElement | null {
    const t = useText(panelText);
    const task = useDiagram(s => s.doc.task);
    if (!task) return null;
    return (
        <div className="banner">
            <span><b>{t.exerciseRunning}</b> ({task.mode === "calc" ? t.exerciseCalc : t.exerciseDraw}, {t.exerciseActivities(task.list.length)})</span>
            <div className="row"><button className="btn ghost" id="tEnd" onClick={endExercise}>{t.endExercise}</button></div>
        </div>
    );
}
