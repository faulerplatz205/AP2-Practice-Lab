import { type ReactElement, useState } from "react";
import clsx from "clsx";
import { useDiagram } from "../../state/diagramStore";
import { type SavedPlan, usePlans } from "../../state/planStore";
import { useUi } from "../../state/uiStore";
import { deletePlan, exportFile, openPlan, renamePlan, savePlan } from "../../state/actions";
import { MODES } from "../../data/modes";
import { localeTag, useText } from "../../i18n/locale";
import { dialogText, plansText } from "../../i18n/dialogs";
import { NodePreview } from "../Preview";

const when = (time: number): string => new Date(time).toLocaleString(localeTag(), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function PlanRow({ plan, current }: { plan: SavedPlan; current: boolean }): ReactElement {
    const t = useText(plansText), modes = useText(MODES);
    const [ renaming, setRenaming ] = useState(false);
    const [ confirmDelete, setConfirmDelete ] = useState(false);
    const info = modes[plan.mode] ?? modes.frei;
    const finishRename = (value: string): void => {
        renamePlan(plan.id, value);
        setRenaming(false);
    };
    return (
        <div className={clsx("prow", current && "cur")} data-pid={plan.id}>
            <button type="button" className="pmain" data-act="open" onClick={() => !renaming && openPlan(plan)}>
                <NodePreview type={info.items[0].type} preset={info.items[0].preset} />
                <span>
                    {renaming
                        ? <input className="pren" defaultValue={plan.name} maxLength={80} autoFocus onFocus={e => e.currentTarget.select()} onClick={e => e.stopPropagation()}
                            onKeyDown={e => {
                                e.stopPropagation();
                                if (e.key === "Enter") finishRename(e.currentTarget.value);
                                if (e.key === "Escape") setRenaming(false);
                            }}
                            onBlur={e => finishRename(e.currentTarget.value)} />
                        : <b>{plan.name}</b>}
                    <small>{info.label} · {t.elements(plan.count)} · {when(plan.updated)}</small>
                </span>
            </button>
            <div className="pact">
                <button type="button" className="btn ghost" data-act="ren" onClick={() => setRenaming(true)}>{t.rename}</button>
                <button type="button" className={clsx("btn ghost", confirmDelete && "danger")} data-act="del"
                    onClick={() => confirmDelete ? deletePlan(plan.id) : setConfirmDelete(true)}>
                    {confirmDelete ? t.confirmDelete : t.delete}
                </button>
            </div>
        </div>
    );
}

export function PlansDialog(): ReactElement {
    const t = useText(plansText), common = useText(dialogText);
    const plans = usePlans(s => s.plans);
    const currentId = usePlans(s => s.currentId);
    const hasContent = useDiagram(s => s.doc.nodes.length > 0);
    const close = useUi(s => s.close);
    return <>
        <h3>{t.title}</h3>
        {plans.length
            ? <>
                <p>{t.count(plans.length)}</p>
                <div className="plist">{plans.map(p => <PlanRow key={p.id} plan={p} current={p.id === currentId} />)}</div>
            </>
            : <p>{t.emptyBefore}<kbd>{t.emptyKey}</kbd>{t.emptyAfter}</p>}
        <div className="row">
            {hasContent && <button className="btn primary" id="mSaveNow" onClick={() => {
                close();
                savePlan();
            }}>{t.saveCurrent}</button>}
            <span className="sep" />
            <button className="btn ghost" id="mImport" onClick={() => document.getElementById("file")?.click()}>{t.importFile}</button>
            {hasContent && <button className="btn ghost" id="mExport" onClick={() => void exportFile()}>{t.exportFile}</button>}
            <button className="btn" id="mClose" onClick={close}>{common.close}</button>
        </div>
        <p style={{ fontSize: 12.5 }}>{t.storageNote}</p>
    </>;
}
