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

/**
 * Breaks `s` at spaces into at most `maxLines` lines no wider than `maxW` at font size `size`.
 * Returns null when it does not fit (a word too wide or more lines needed).
 */
export function wrapToWidth(s: string, size: number, maxW: number, maxLines: number, weight = "600"): string[] | null {
    const lines: string[] = [];
    for (const word of s.trim().split(/\s+/)) {
        if (textWidth(word, size, weight) > maxW) return null;
        const last = lines.length ? lines[lines.length - 1] + " " + word : null;
        if (last !== null && textWidth(last, size, weight) <= maxW) lines[lines.length - 1] = last;
        else lines.push(word);
        if (lines.length > maxLines) return null;
    }
    return lines;
}

/**
 * Text of a fixed-size cell: one line, else up to two lines, shrinking the font down to `minSize`;
 * only when even that does not fit, the second line is cut with „…“.
 */
export function fitCellText(s: string, size: number, minSize: number, maxW: number, maxH: number, weight = "600"): { lines: string[]; size: number } {
    if (!s || textWidth(s, size, weight) <= maxW) return { lines: [ s ], size };
    for (let f = Math.min(size, maxH / 2.3); f >= minSize; f -= 0.5) {
        const lines = wrapToWidth(s, f, maxW, 2, weight);
        if (lines) return { lines, size: f };
    }
    const f = Math.max(minSize, Math.min(size, maxH / 2.3));
    const words = s.trim().split(/\s+/);
    let first = "";
    while (words.length && textWidth(first ? first + " " + words[0] : words[0], f, weight) <= maxW) first = first ? first + " " + words.shift()! : words.shift()!;
    let rest = words.join(" ");
    if (!first) {
        first = rest;
        rest = "";
    }
    const cut = (t: string): string => {
        if (textWidth(t, f, weight) <= maxW) return t;
        while (t.length > 1 && textWidth(t + "…", f, weight) > maxW) t = t.slice(0, -1);
        return t + "…";
    };
    return { lines: rest ? [ cut(first), cut(rest) ] : [ cut(first) ], size: f };
}
