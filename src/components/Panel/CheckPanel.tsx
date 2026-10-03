import type { ReactElement } from "react";
import type { CheckResult, Issue } from "../../types/check";
import { useDiagram } from "../../state/diagramStore";
import { check, closeCheck, select } from "../../state/actions";
import { findEdge, findNode } from "../../lib/diagram";
import { fmt } from "../../lib/math";
import { MODES } from "../../data/modes";
import { useText } from "../../i18n/locale";
import { panelText } from "../../i18n/panel";
import { CountingMode, ExerciseBanner } from "./common";

const ICONS: Record<Issue["level"], string> = { error: "✕", warn: "!", ok: "✓", info: "i" };

/** `result` comes from the parent, which recomputes it when the language changes. */
export function CheckPanel({ result: c }: { result: CheckResult }): ReactElement {
    const t = useText(panelText), modes = useText(MODES);
    const reveal = useDiagram(s => s.reveal);
    const doc = useDiagram(s => s.doc);
    const kinds = c.kinds.map(k => modes[k].label);
    const items: Issue[] = c.ok
        ? [{ level: "ok", text: t.allCorrect, tip: c.isNetzplan ? t.projectSummary(fmt(c.duration ?? 0), c.criticalPath) : t.checked(kinds) }, ...c.items ]
        : c.items;
    const percent = c.total ? Math.round(c.right / c.total * 100) : 0;
    const jump = (it: Issue): void => {
        if (it.nodeId !== undefined && findNode(doc, it.nodeId)) select("node", it.nodeId);
        else if (it.edgeId !== undefined && findEdge(doc, it.edgeId)) select("edge", it.edgeId);
    };
    return <>
        <ExerciseBanner />
        <div>
            <div className="eyebrow">{t.checkResult}{kinds.length ? ` · ${kinds.join(", ")}` : ""}</div>
            <h2>{t.headline(c)}</h2>
        </div>
        {c.total > 0 && <>
            <div className="score"><b>{c.right}/{c.total}</b><span>{t.valuesRight}</span></div>
            <div className="meter"><i style={{ width: `${percent}%` }} /></div>
        </>}
        <div className="res">
            {items.map((it, i) => (
                <button key={i} type="button" className={`item ${it.level}`} data-i={i} onClick={() => jump(it)}>
                    <span className="ic">{ICONS[it.level]}</span>
                    <span>
                        {it.text}
                        {it.tip && <small>{it.tip}</small>}
                        {reveal && it.solution && <small className="solution">{t.solution(it.solution)}</small>}
                    </span>
                </button>
            ))}
        </div>
        {c.items.some(i => i.solution) && (
            <label className="check">
                <input type="checkbox" id="cRev" checked={reveal} onChange={e => useDiagram.getState().set({ reveal: e.target.checked })} /> {t.showSolution}
            </label>
        )}
        {c.isNetzplan && <CountingMode />}
        <div className="row">
            <button className="btn ghost" id="cAgain" onClick={check}>{t.checkAgain}</button>
            <button className="btn ghost" id="cClose" onClick={closeCheck}>{t.endCheck}</button>
        </div>
    </>;
}
