import { GRID } from "./constants";

export function snap(v: number): number {
    return Math.round(v / GRID) * GRID;
}

/** Reads a number with a comma or a dot. Returns NaN for empty or invalid text. */
export function num(v: unknown): number {
    return parseFloat(String(v).replace(",", "."));
}

/** Writes a number with at most two decimals and a decimal comma. */
export function fmt(v: number): string {
    return String(Math.round(v * 100) / 100).replace(".", ",");
}

/** Compares numbers like "2" < "10" and "A" < "B". */
export function byNr(a: string, b: string): number {
    return String(a).localeCompare(String(b), "de", { numeric: true });
}

/** Shuffles a copy of the array (Fisher-Yates). */
export function shuffle<T>(list: readonly T[]): T[] {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ a[i], a[j] ] = [ a[j], a[i] ];
    }
    return a;
}

export function clamp(v: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, v));
}
