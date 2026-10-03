import { createElement, type ReactElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { World } from "../components/Canvas/World";
import { Markers } from "../components/Canvas/Markers";
import { diagramBox } from "../lib/diagram";
import { resolveThemeVars, svgToCanvas } from "../lib/image";
import { text } from "../i18n/locale";
import { messageText } from "../i18n/messages";
import { useDiagram } from "./diagramStore";
import { notify, useUi } from "./uiStore";
import { unlock } from "./achievementStore";

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

export async function exportImage(): Promise<void> {
    const { doc } = useDiagram.getState();
    const box = diagramBox(doc);
    if (!box) return notify(text(messageText).planEmpty);
    unlock("export");
    const pad = 30, w = box.w + pad * 2, h = box.h + pad * 2, scale = 2;
    const inner = renderSvgMarkup(createElement(World, { doc, exporting: true }));
    const defs = renderSvgMarkup(createElement(Markers));
    const svg = resolveThemeVars(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="${box.x - pad} ${box.y - pad} ${w} ${h}">` +
        `<defs>${defs}</defs><rect x="${box.x - pad}" y="${box.y - pad}" width="${w}" height="${h}" fill="#ffffff"/>${inner}</svg>`,
    );
    try {
        const canvas = await svgToCanvas(svg, w, h, scale);
        useUi.getState().open({ type: "image", url: canvas.toDataURL("image/png"), canvas });
    } catch {
        notify(text(messageText).imageFailed);
    }
}
