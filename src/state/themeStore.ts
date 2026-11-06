import { create } from "zustand";
import { KEYS, storage } from "../lib/storage";

/** `system` follows the operating system setting. */
export type Theme = "system" | "light" | "dark";

/** `high`: stronger text, borders and focus rings (tokens in custom.css). */
export type Contrast = "normal" | "high";

/** `green` is the look of knowledge.moritz-grimm.dev (green in light, lime in dark). */
export type Accent = "blue" | "green";

export const THEMES: Theme[] = [ "system", "light", "dark" ];
export const CONTRASTS: Contrast[] = [ "normal", "high" ];
export const ACCENTS: Accent[] = [ "blue", "green" ];

function stored<T extends string>(key: string, allowed: T[]): T {
    const value = storage.readText(key);
    return allowed.includes(value as T) ? value as T : allowed[0];
}

interface ThemeState {
    theme: Theme;
    contrast: Contrast;
    accent: Accent;
    setTheme: (theme: Theme) => void;
    setContrast: (contrast: Contrast) => void;
    setAccent: (accent: Accent) => void;
}

export const useTheme = create<ThemeState>()(set => ({
    theme: stored(KEYS.theme, THEMES),
    contrast: stored(KEYS.contrast, CONTRASTS),
    accent: stored(KEYS.accent, ACCENTS),
    setTheme: (theme): void => set({ theme }),
    setContrast: (contrast): void => set({ contrast }),
    setAccent: (accent): void => set({ accent }),
}));

/** Sets `data-theme`, `data-contrast` and `data-accent` on <html>; the CSS tokens in custom.css react to them. Defaults remove the attribute. */
function apply({ theme, contrast, accent }: Pick<ThemeState, "theme" | "contrast" | "accent">): void {
    const root = document.documentElement.dataset;
    const set = (name: "theme" | "contrast" | "accent", value: string, fallback: string): void => {
        if (value === fallback) delete root[name];
        else root[name] = value;
    };
    set("theme", theme, "system");
    set("contrast", contrast, "normal");
    set("accent", accent, "blue");
}

apply(useTheme.getState());
useTheme.subscribe(s => {
    storage.write(KEYS.theme, s.theme);
    storage.write(KEYS.contrast, s.contrast);
    storage.write(KEYS.accent, s.accent);
    apply(s);
});
