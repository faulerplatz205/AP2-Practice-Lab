import { type ReactElement, useRef, useState } from "react";
import { useUi } from "../../state/uiStore";
import { getDownloads, offerFile } from "../../lib/downloads";
import { canvasToBlob } from "../../lib/image";
import { buildPdf, canvasToPdfImage } from "../../lib/pdf";
import { text, useText } from "../../i18n/locale";
import { dialogText, imageText } from "../../i18n/dialogs";

/** Which hint is shown below the image. Stored as a key so a language switch updates it. */
type Hint = "save" | "copy" | "none";

type Status = "saved" | "pdfSaved" | "declined" | "busy" | "denied" | "waiting" | "confirm" | "noWindow"
    | "saveUnavailable" | "pdfUnavailable" | "imageFailed" | "pdfFailed";

interface Format {
    ext: string;
    make: () => Promise<Blob>;
    saved: Status;
    unavailable: Status;
    failed: Status;
}

export function ImageDialog({ url, canvas, title, file }: { url: string; canvas: HTMLCanvasElement; title: string; file: string }): ReactElement {
    const t = useText(imageText), common = useText(dialogText);
    const close = useUi(s => s.close);
    const notify = useUi(s => s.notify);
    const [ hint, setHint ] = useState<Hint>("none");
    const [ status, setStatus ] = useState<Status | null>(null);
    const busy = useRef(false);

    const report = (s: Status): void => {
        setStatus(s);
        notify(text(imageText)[s]);
    };
    const save = async(format: Format): Promise<void> => {
        if (busy.current) return report("busy");
        busy.current = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            report("waiting");
            let data: Blob;
            try {
                data = await format.make();
            } catch {
                return report(format.failed);
            }
            if (await getDownloads()) report("confirm");
            // the save window of the viewer sometimes does not appear; free the buttons again
            timer = setTimeout(() => {
                setStatus("noWindow");
                busy.current = false;
            }, 20000);
            const outcome = await offerFile(file + format.ext, data);
            if (outcome === "unavailable" || outcome === "denied") setHint("save");
            report(outcome === "saved" ? format.saved : outcome === "declined" || outcome === "busy" || outcome === "denied" ? outcome : format.unavailable);
        } catch {
            report(format.unavailable);
        } finally {
            clearTimeout(timer);
            busy.current = false;
        }
    };
    const savePng = (): Promise<void> => save({ ext: ".png", make: () => canvasToBlob(canvas), saved: "saved", unavailable: "saveUnavailable", failed: "imageFailed" });
    const savePdf = (): Promise<void> => save({
        ext: ".pdf", make: async() => buildPdf(await canvasToPdfImage(canvas), title), saved: "pdfSaved", unavailable: "pdfUnavailable", failed: "pdfFailed",
    });
    const copy = (): void => {
        const fallback = (): void => setHint("copy");
        try {
            navigator.clipboard.write([ new ClipboardItem({ "image/png": canvasToBlob(canvas) }) ])
                .then(() => notify(t.copied))
                .catch(fallback);
        } catch {
            fallback();
        }
    };

    return <>
        <h3>{t.title}</h3>
        <img src={url} alt={t.preview} style={{ maxHeight: "52vh", objectFit: "contain" }} />
        <div className="row">
            <button className="btn primary" id="mPng" onClick={() => void savePng()}>{t.savePng}</button>
            <button className="btn primary" id="mPdf" onClick={() => void savePdf()}>{t.savePdf}</button>
            <button className="btn ghost" id="mCopyImg" onClick={copy}>{t.copy}</button>
            <span className="sep" />
            <button className="btn" id="mClose" onClick={close}>{common.close}</button>
        </div>
        {status && <p id="mImgStatus" role="status" className="status">{t[status]}</p>}
        <p id="mImgHint">{hint === "save" ? t.saveHint : hint === "copy" ? t.copyUnavailable : ""}</p>
    </>;
}
