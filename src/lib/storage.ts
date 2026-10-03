import { STORAGE_KEY } from "./constants";

/** Never throws: in private mode, with full storage or blocked data it returns `null` or `false`. */
export const storage = {
    read<T>(suffix: string): T | null {
        try {
            const raw = localStorage.getItem(STORAGE_KEY + suffix);
            return raw === null ? null : JSON.parse(raw) as T;
        } catch {
            return null;
        }
    },
    readText(suffix: string): string | null {
        try {
            return localStorage.getItem(STORAGE_KEY + suffix);
        } catch {
            return null;
        }
    },
    write(suffix: string, value: unknown): boolean {
        try {
            localStorage.setItem(STORAGE_KEY + suffix, typeof value === "string" ? value : JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    },
};

/** Key suffixes. See docs/data-model.md */
export const KEYS = {
    diagram: "",
    plans: "-plans",
    currentPlan: "-current",
    achievements: "-ach",
    guideShown: "-guide",
    locale: "-lang",
    theme: "-theme",
    workspace: "-workspace",
} as const;
