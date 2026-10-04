import type { ReactElement } from "react";
import { useUi } from "../../state/uiStore";
import { text } from "../../i18n/locale";
import { dialogText } from "../../i18n/dialogs";
import { AchievementsDialog } from "./AchievementsDialog";
import { DiscardDialog } from "./DiscardDialog";
import { ExerciseDialog } from "./ExerciseDialog";
import { ExportTextDialog } from "./ExportTextDialog";
import { GanttDialog } from "./GanttDialog";
import { GuideDialog } from "./GuideDialog";
import { ImageDialog } from "./ImageDialog";
import { NewDiagramDialog } from "./NewDiagramDialog";
import { NormDialog } from "./NormDialog";
import { PlansDialog } from "./PlansDialog";
import { SaveAsDialog } from "./SaveAsDialog";
import { TaskListDialog } from "./TaskListDialog";

const WIDE = new Set([ "gantt", "plans", "image", "new", "achievements", "guide" ]);

export function Modal(): ReactElement {
    const dialog = useUi(s => s.dialog);
    const close = useUi(s => s.close);
    let body: ReactElement | null = null;
    switch (dialog?.type) {
        case "gantt": body = <GanttDialog />; break;
        case "taskList": body = <TaskListDialog />; break;
        case "exercise": body = <ExerciseDialog />; break;
        case "norm": body = <NormDialog />; break;
        case "plans": body = <PlansDialog />; break;
        case "saveAs": body = <SaveAsDialog />; break;
        case "discard": body = <DiscardDialog then={dialog.then} />; break;
        case "exportText": body = <ExportTextDialog filename={dialog.filename} data={dialog.data} />; break;
        case "image": body = <ImageDialog url={dialog.url} canvas={dialog.canvas} />; break;
        case "new": body = <NewDiagramDialog />; break;
        case "achievements": body = <AchievementsDialog tab={dialog.tab} />; break;
        case "guide": body = <GuideDialog chapter={dialog.chapter} />; break;
    }
    return (
        <div className="modal" id="modal" hidden={!dialog} onPointerDown={e => {
            if (e.target === e.currentTarget) close();
        }}>
            <div className={WIDE.has(dialog?.type ?? "") ? "dlg wide" : "dlg"} id="dlg" role="dialog" aria-modal="true">{body}</div>
        </div>
    );
}

/** Copies text; if that is not possible, the text is selected instead. */
export function copyText(value: string, field: HTMLTextAreaElement | null, done: string): void {
    navigator.clipboard.writeText(value)
        .then(() => useUi.getState().notify(done))
        .catch(() => {
            field?.focus();
            field?.select();
            useUi.getState().notify(text(dialogText).textSelected);
        });
}
