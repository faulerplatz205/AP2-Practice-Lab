let ctx: CanvasRenderingContext2D | null | undefined;
const families: Partial<Record<"ui" | "mono", string>> = {};

/** Rendered width of `s` in the app fonts; estimated from the character count where there is no canvas (tests). */
export function textWidth(s: string, size: number, weight = "600", mono = false): number {
    if (ctx === undefined) {
        try {
            ctx = document.createElement("canvas").getContext("2d");
        } catch {
            ctx = null;
        }
    }
    if (!ctx) return s.length * size * (mono || Number(weight) >= 600 ? 0.6 : 0.54);
    const key = mono ? "mono" : "ui";
    families[key] ??= getComputedStyle(document.documentElement).getPropertyValue(mono ? "--fmono" : "--fui").trim() || "sans-serif";
    ctx.font = `${weight} ${size}px ${families[key]}`;
    return ctx.measureText(s).width;
}

/** Width of the widest line of a multi-line text. */
export function blockWidth(s: string, size: number, weight = "600"): number {
    return Math.max(0, ...String(s).split("\n").map(line => textWidth(line, size, weight)));
}
