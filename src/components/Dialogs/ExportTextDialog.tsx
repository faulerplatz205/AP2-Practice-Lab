import { type ReactElement, useRef } from "react";
import { useUi } from "../../state/uiStore";
import { useText } from "../../i18n/locale";
import { dialogText, exportTextText } from "../../i18n/dialogs";
import { copyText } from "./Modal";

/** Fallback when this view does not allow downloads: text to copy. */
export function ExportTextDialog({ filename, data }: { filename: string; data: string }): ReactElement {
    const t = useText(exportTextText), common = useText(dialogText);
    const close = useUi(s => s.close);
    const field = useRef<HTMLTextAreaElement>(null);
    return <>
        <h3>{t.title}</h3>
        <p>{t.before}<code>{filename}</code>{t.after}</p>
        <textarea id="mJson" ref={field} spellCheck={false} readOnly value={data} />
        <div className="row">
            <button className="btn primary" id="mCopy" onClick={() => copyText(data, field.current, t.copied)}>{t.copy}</button>
            <button className="btn" id="mClose" onClick={close}>{common.close}</button>
        </div>
    </>;
}
