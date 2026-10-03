import { create } from "zustand";
import { KEYS, storage } from "../lib/storage";

/** `system` follows the operating system setting. */
export type Theme = "system" | "light" | "dark";

const THEMES: Theme[] = [ "system", "light", "dark" ];

function initialTheme(): Theme {
    const stored = storage.readText(KEYS.theme);
    return THEMES.includes(stored as Theme) ? stored as Theme : "system";
}

interface ThemeState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    /** system → light → dark → system */
    cycleTheme: () => void;
}

export const useTheme = create<ThemeState>()((set, get) => ({
    theme: initialTheme(),
    setTheme: (theme): void => set({ theme }),
    cycleTheme: (): void => set({ theme: THEMES[(THEMES.indexOf(get().theme) + 1) % THEMES.length] }),
}));

/** Sets `data-theme` on <html>; the CSS tokens in custom.css react to it. */
function applyTheme(theme: Theme): void {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
}

applyTheme(useTheme.getState().theme);
useTheme.subscribe(s => {
    storage.write(KEYS.theme, s.theme);
    applyTheme(s.theme);
});
