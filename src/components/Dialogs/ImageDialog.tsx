import { type ReactElement, useEffect, useState } from "react";
import { useUi } from "../../state/uiStore";
import { fileBase } from "../../state/actions";
import { getDownloads, offerFile } from "../../lib/downloads";
import { canvasToBlob } from "../../lib/image";
import { useText } from "../../i18n/locale";
import { dialogText, imageText } from "../../i18n/dialogs";

/** Which hint is shown below the image. Stored as a key so a language switch updates it. */
type Hint = "save" | "copy" | "none";

export function ImageDialog({ url, canvas }: { url: string; canvas: HTMLCanvasElement }): ReactElement {
    const t = useText(imageText), common = useText(dialogText);
    const close = useUi(s => s.close);
    const notify = useUi(s => s.notify);
    const [ canDownload, setCanDownload ] = useState(false);
    const [ hint, setHint ] = useState<Hint>("save");

    useEffect(() => {
        void getDownloads().then(d => {
            if (!d) return;
            setCanDownload(true);
            setHint("none");
        });
    }, []);

    const savePng = async(): Promise<void> => {
        const outcome = await offerFile(fileBase() + ".png", await canvasToBlob(canvas));
        notify(outcome === "saved" ? t.saved : outcome === "declined" ? t.declined : t.saveUnavailable);
    };
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
            {canDownload && <button className="btn primary" id="mPng" onClick={() => void savePng()}>{t.savePng}</button>}
            <button className={canDownload ? "btn ghost" : "btn primary"} id="mCopyImg" onClick={copy}>{t.copy}</button>
            <span className="sep" />
            <button className="btn" id="mClose" onClick={close}>{common.close}</button>
        </div>
        <p id="mImgHint">{hint === "save" ? t.saveHint : hint === "copy" ? t.copyUnavailable : ""}</p>
    </>;
}
