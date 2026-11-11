import { Fragment, type ReactElement, useSyncExternalStore } from "react";
import { textWidth } from "../../lib/textWidth";

interface MultilineProps {
    text: string;
    /** Centre (or left edge with `anchor="start"`) */
    x: number;
    /** Vertical centre of the text block */
    y: number;
    size: number;
    weight?: string;
    mono?: boolean;
    anchor?: "start" | "middle";
    /** Longer lines wrap at spaces */
    maxWidth?: number;
    underline?: boolean;
}

/** Texts are measured: render again once the web font has loaded. */
let fontsReady = typeof document === "undefined" || !document.fonts || document.fonts.status === "loaded";
function subscribeFonts(onChange: () => void): () => void {
    if (fontsReady) return () => undefined;
    let active = true;
    void document.fonts.ready.then(() => {
        fontsReady = true;
        if (active) onChange();
    });
    return () => {
        active = false;
    };
}
const getFontsReady = (): boolean => fontsReady;

function wrapRow(row: string, fits: (s: string) => boolean): string[] {
    if (fits(row)) return [ row ];
    const out: string[] = [];
    let line = "";
    for (let word of row.split(" ")) {
        while (word.length > 1 && !fits(word)) {
            let cut = word.length - 1;
            while (cut > 1 && !fits(word.slice(0, cut))) cut--;
            if (line) out.push(line);
            out.push(word.slice(0, cut));
            word = word.slice(cut);
            line = "";
        }
        const joined = line ? `${line} ${word}` : word;
        if (line && !fits(joined)) {
            out.push(line);
            line = word;
        } else {
            line = joined;
        }
    }
    if (line) out.push(line);
    return out;
}

export function MultilineText({ text, x, y, size, weight = "600", mono = false, anchor = "middle", maxWidth, underline, dashed = false }: MultilineProps & { dashed?: boolean }): ReactElement {
    useSyncExternalStore(subscribeFonts, getFontsReady, getFontsReady);
    const fits = (s: string): boolean => !maxWidth || textWidth(s, size, weight, mono) <= maxWidth;
    const rows = String(text).split("\n").flatMap(r => maxWidth ? wrapRow(r, fits) : [ r ]), lh = size * 1.25, y0 = y - (rows.length - 1) * lh / 2 + size * 0.35;
    return (
        <>
            <text x={x} y={y0} textAnchor={anchor} fontSize={size} fontWeight={weight} fontFamily={mono ? "var(--fmono)" : "var(--fui)"} fill="var(--ink)">
                {rows.map((row, i) => <tspan key={i} x={x} dy={i ? lh : undefined}>{row || " "}</tspan>)}
            </text>
            {underline && rows.map((row, i) => <Underline key={`u${i}`} text={row} x={x} y={y0 + i * lh} size={size} weight={weight} anchor={anchor} mono={mono} dashed={dashed} />)}
        </>
    );
}

interface UnderlineProps {
    text: string;
    x: number;
    /** Baseline of the text */
    y: number;
    size: number;
    weight?: string;
    anchor?: "start" | "middle";
    mono?: boolean;
}

/** Safari ignores text-decoration on SVG text. */
export function Underline({ text, x, y, size, weight = "600", anchor = "middle", mono = false, dashed = false }: UnderlineProps & { dashed?: boolean }): ReactElement | null {
    useSyncExternalStore(subscribeFonts, getFontsReady, getFontsReady);
    if (!text.trim()) return null;
    const w = textWidth(text, size, weight, mono), x1 = anchor === "middle" ? x - w / 2 : x, ly = y + size * 0.2;
    return <line className="ul" x1={x1} y1={ly} x2={x1 + w} y2={ly} stroke="var(--ink)" strokeWidth={Math.max(1, size / 13)} strokeDasharray={dashed ? "4 3" : undefined} />;
}

interface LinesProps {
    rows: string[];
    x: number;
    /** Baseline of the first line */
    y: number;
    size?: number;
    anchor?: "start" | "middle";
    weight?: string;
    /** Class members: a row marked {abstract} is set in italics, one marked {static} is underlined */
    members?: boolean;
}

/** Fixed line spacing of 17. */
export function TextLines({ rows, x, y, size = 13, anchor = "start", weight, members }: LinesProps): ReactElement {
    return <>{rows.map((row, i) => {
        const italic = members && /\{\s*abstract\s*\}/i.test(row), underlined = members && /\{\s*static\s*\}/i.test(row);
        return <Fragment key={i}>
            <text x={x} y={y + i * 17} textAnchor={anchor} fontSize={size} fontWeight={weight} fontStyle={italic ? "italic" : undefined} fontFamily="var(--fui)" fill="var(--ink)">{row || " "}</text>
            {underlined && <Underline text={row} x={x} y={y + i * 17} size={size} weight={weight ?? "400"} anchor={anchor} />}
        </Fragment>;
    })}</>;
}
