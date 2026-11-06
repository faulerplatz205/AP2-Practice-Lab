import { getDownloads, insideArtifact, offerFile, safeFileName } from "../lib/downloads";
import { canvasToBlob } from "../lib/image";
import { buildPdf, canvasToPdfImage } from "../lib/pdf";
import { text } from "../i18n/locale";
import { downloadText } from "../i18n/files";
import { messageText } from "../i18n/messages";
import { useDiagram } from "./diagramStore";
import { notify, useUi } from "./uiStore";
import { currentPlan } from "./planStore";
import { fileBase } from "./actions";
import { drawingCanvas, exportName, openImageDialog } from "./exportImage";

export type DownloadFormat = "json" | "png" | "pdf";

export const DOWNLOAD_FORMATS: DownloadFormat[] = [ "json", "png", "pdf" ];

interface PreparedFile {
    name: string;
    data: string | Blob;
    /** Fallback inside the artifact when saving is not possible */
    fallback: () => void;
}

/** The plan file: the drawing plus `app` and `version`, which import drops again. */
function planFile(): PreparedFile {
    const data = JSON.stringify({ app: "AP2 Practice Lab", version: 1, ...useDiagram.getState().doc }, null, 1);
    const plan = currentPlan();
    const name = safeFileName(plan ? plan.name : fileBase()) + ".json";
    return { name, data, fallback: () => useUi.getState().open({ type: "exportText", filename: name, data }) };
}

async function prepare(format: DownloadFormat): Promise<PreparedFile | null> {
    if (format === "json") return planFile();
    const canvas = await drawingCanvas();
    if (!canvas) return null;
    const { title, file } = exportName();
    const data = format === "png" ? await canvasToBlob(canvas) : buildPdf(await canvasToPdfImage(canvas), title);
    return { name: `${file}.${format}`, data, fallback: () => openImageDialog(canvas) };
}

let busy = false;

/** Downloads the plan in one format and reports the outcome as a toast. */
export async function download(format: DownloadFormat): Promise<void> {
    const t = text(downloadText);
    if (busy) return notify(t.busy);
    if (format === "json" && !useDiagram.getState().doc.nodes.length) return notify(text(messageText).nothingToSave);
    busy = true;
    // the save window of the viewer sometimes does not appear; free the menu again
    const timer = setTimeout(() => {
        busy = false;
        notify(text(downloadText).noWindow);
    }, 20000);
    try {
        let file: PreparedFile | null;
        try {
            file = await prepare(format);
        } catch {
            return notify(t.failed[format]);
        }
        if (!file) return;
        if (insideArtifact() && await getDownloads()) notify(t.confirm);
        const outcome = await offerFile(file.name, file.data);
        const now = text(downloadText);
        if (outcome === "saved") return notify(now.saved[format]);
        if (outcome === "declined" || outcome === "busy") return notify(now[outcome]);
        notify(now.unavailable);
        file.fallback();
    } finally {
        clearTimeout(timer);
        busy = false;
    }
}

/** Copies the drawing as PNG to the clipboard; where that is not allowed the preview dialog opens instead. */
export async function copyImage(): Promise<void> {
    const canvas = await drawingCanvas().catch(() => {
        notify(text(downloadText).failed.png);
        return null;
    });
    if (!canvas) return;
    try {
        await navigator.clipboard.write([ new ClipboardItem({ "image/png": canvasToBlob(canvas) }) ]);
        notify(text(downloadText).copied);
    } catch {
        openImageDialog(canvas);
    }
}
