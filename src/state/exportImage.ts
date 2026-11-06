import { createElement, type ReactElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { World } from "../components/Canvas/World";
import { Markers } from "../components/Canvas/Markers";
import { contentBox } from "../lib/uml/labels";
import { exportScale, resolveThemeVars, svgToCanvas } from "../lib/image";
import { safeFileName } from "../lib/downloads";
import { text } from "../i18n/locale";
import { messageText } from "../i18n/messages";
import { ganttText } from "../i18n/dialogs";
import { MODES } from "../data/modes";
import { useDiagram } from "./diagramStore";
import { notify, useUi } from "./uiStore";
import { currentPlan } from "./planStore";
import { unlock } from "./achievementStore";
import { fileBase } from "./actions";

/**
 * Renders SVG content to markup. Uses a detached client root (not
 * `renderToStaticMarkup`), because zustand serves the initial state to server
 * rendering, which would draw the texts in the language of the page load.
 */
function renderSvgMarkup(element: ReactElement): string {
    const container = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const root = createRoot(container);
    flushSync(() => root.render(element));
    const markup = container.innerHTML;
    root.unmount();
    return markup;
}

/** Title for the PDF and file name without extension: the plan name, else the diagram kind. */
export function exportName(): { title: string; file: string } {
    const plan = currentPlan();
    return plan
        ? { title: plan.name, file: safeFileName(plan.name) }
        : { title: text(MODES)[useDiagram.getState().doc.cfg.mode].label, file: fileBase() };
}

async function openImage(svg: string, width: number, height: number, scale: number, title: string, file: string): Promise<void> {
    try {
        const canvas = await svgToCanvas(resolveThemeVars(svg), width, height, scale);
        useUi.getState().open({ type: "image", url: canvas.toDataURL("image/png"), canvas, title, file });
    } catch {
        notify(text(messageText).imageFailed);
    }
}

/** The whole drawing in the light palette on white, or `null` when it is empty (with a toast). */
export async function drawingCanvas(): Promise<HTMLCanvasElement | null> {
    const { doc } = useDiagram.getState();
    const box = contentBox(doc);
    if (!box) {
        notify(text(messageText).planEmpty);
        return null;
    }
    unlock("export");
    const pad = 40, w = box.w + pad * 2, h = box.h + pad * 2, scale = exportScale(w, h);
    const inner = renderSvgMarkup(createElement(World, { doc, exporting: true }));
    const defs = renderSvgMarkup(createElement(Markers));
    return svgToCanvas(resolveThemeVars(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="${box.x - pad} ${box.y - pad} ${w} ${h}">` +
        `<defs>${defs}</defs><rect x="${box.x - pad}" y="${box.y - pad}" width="${w}" height="${h}" fill="#ffffff"/>${inner}</svg>`,
    ), w, h, scale);
}

/** Preview dialog with PNG, PDF and copy, for a drawing that could not be downloaded directly. */
export function openImageDialog(canvas: HTMLCanvasElement): void {
    const { title, file } = exportName();
    useUi.getState().open({ type: "image", url: canvas.toDataURL("image/png"), canvas, title, file });
}

const escapeXml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** The Gantt chart of the open dialog with its legend as an image. */
export async function exportGanttImage(): Promise<void> {
    const chart = document.querySelector<SVGSVGElement>(".gantt svg");
    if (!chart) return;
    unlock("export");
    const cw = Number(chart.getAttribute("width")), ch = Number(chart.getAttribute("height"));
    const names = [ ...document.querySelectorAll(".dlg .lg span") ].map(s => s.textContent ?? "");
    const fills = [ "var(--crit)", "var(--accent)", "url(#hatch)" ];
    const measure = document.createElement("canvas").getContext("2d")!;
    measure.font = "12px Arial, Helvetica, sans-serif";
    let x = 10, legend = "";
    const y = ch + 14;
    names.forEach((name, i) => {
        const outline = i === 2 ? " stroke=\"var(--muted)\" stroke-width=\"1\"" : "";
        legend += `<rect x="${x}" y="${y}" width="14" height="10" rx="2" fill="${fills[i]}"${outline}/>` +
            `<text x="${x + 20}" y="${y + 9.5}" font-size="12" font-family="var(--fui)" fill="var(--muted)">${escapeXml(name)}</text>`;
        x += 20 + measure.measureText(name).width + 22;
    });
    const w = cw + 40, h = (names.length ? ch + 34 : ch) + 40, scale = exportScale(w, h);
    const { title, file } = exportName();
    await openImage(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="-20 -20 ${w} ${h}">` +
        `<rect x="-20" y="-20" width="${w}" height="${h}" fill="#ffffff"/>${chart.innerHTML}${legend}</svg>`,
        w, h, scale, `${title} – ${text(ganttText).title}`, `${file}-gantt`,
    );
}
