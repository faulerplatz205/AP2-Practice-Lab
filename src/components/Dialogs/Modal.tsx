import { type ReactElement, useEffect, useRef } from "react";
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
    const box = useRef<HTMLDivElement>(null);
    const open = !!dialog;
    // focus moves into the dialog, Tab stays inside, and the opener gets the focus back on close
    useEffect(() => {
        if (!open) return;
        const opener = document.activeElement as HTMLElement | null, el = box.current;
        const focusable = (): HTMLElement[] => el ? [ ...el.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ].filter(x => !x.hasAttribute("disabled") && x.offsetParent !== null) : [];
        const title = el?.querySelector("h3, h2");
        if (el && title) {
            title.id ||= "dlgTitle";
            el.setAttribute("aria-labelledby", title.id);
        }
        if (el && !el.contains(document.activeElement)) (focusable()[0] ?? el).focus();
        const trap = (e: KeyboardEvent): void => {
            if (e.key !== "Tab") return;
            const list = focusable();
            if (!list.length) return;
            const first = list[0], last = list[list.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", trap);
        return (): void => {
            document.removeEventListener("keydown", trap);
            if (opener && document.contains(opener)) opener.focus();
        };
    }, [ open, dialog?.type ]);
    let body: ReactElement | null = null;
    switch (dialog?.type) {
        case "gantt": body = <GanttDialog />; break;
        case "taskList": body = <TaskListDialog />; break;
        case "exercise": body = <ExerciseDialog />; break;
        case "norm": body = <NormDialog />; break;
        case "plans": body = <PlansDialog />; break;
        case "saveAs": body = <SaveAsDialog then={dialog.then} />; break;
        case "discard": body = <DiscardDialog then={dialog.then} />; break;
        case "exportText": body = <ExportTextDialog filename={dialog.filename} data={dialog.data} />; break;
        case "image": body = <ImageDialog url={dialog.url} canvas={dialog.canvas} title={dialog.title} file={dialog.file} />; break;
        case "new": body = <NewDiagramDialog />; break;
        case "achievements": body = <AchievementsDialog tab={dialog.tab} />; break;
        case "guide": body = <GuideDialog chapter={dialog.chapter} />; break;
    }
    return (
        <div className="modal" id="modal" hidden={!dialog} onPointerDown={e => {
            if (e.target === e.currentTarget) close();
        }}>
            <div className={WIDE.has(dialog?.type ?? "") ? "dlg wide" : "dlg"} id="dlg" role="dialog" aria-modal="true" tabIndex={-1} ref={box}>{body}</div>
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
