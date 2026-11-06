import { text } from "../i18n/locale";
import { fileText } from "../i18n/files";

/** Exported images have no CSS variables, so `var(--…)` is replaced by these light theme values. Add new drawing tokens here. */
const LIGHT: Record<string, string> = {
    bg: "#ffffff", paper: "#ffffff", panel: "#ffffff", ink: "#1b2a38", muted: "#5f6e7b", line: "#cdd6de", grid: "#e2e8ed", grid2: "#d3dce4",
    accent: "#1d5fc4", "accent-ink": "#ffffff", "accent-soft": "#dde8f8", crit: "#cf3a2e",
    node: "#ffffff", blank: "#f1f4f6", ok: "#2c8a4b", warn: "#b97a0c", bad: "#f8cfca",
    f1: "#dbe9fb", f2: "#dcf1df", f3: "#fbf0c9", f4: "#f9dcd8",
    fui: "Arial, Helvetica, sans-serif", fmono: "Consolas, Menlo, monospace",
};

export function resolveThemeVars(svg: string): string {
    return svg.replace(/var\(--([\w-]+)\)/g, (_, k: string) => LIGHT[k] ?? "#000");
}

/** Up to triple resolution for sharp images, but at most 6000 px on the longer side. */
export function exportScale(width: number, height: number): number {
    return Math.max(1, Math.min(3, 6000 / Math.max(width, height, 1)));
}

/** Renders SVG text into a canvas. */
export function svgToCanvas(svg: string, width: number, height: number, scale = 2): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = (): void => {
            const canvas = document.createElement("canvas");
            canvas.width = width * scale;
            canvas.height = height * scale;
            canvas.getContext("2d")!.drawImage(img, 0, 0);
            resolve(canvas);
        };
        img.onerror = (): void => reject(new Error(text(fileText).imageFailed));
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error(text(fileText).pngFailed)), "image/png"));
}
