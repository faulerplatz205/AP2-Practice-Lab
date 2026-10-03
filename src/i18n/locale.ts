import { create } from "zustand";
import { KEYS, storage } from "../lib/storage";

export type Locale = "de" | "en";

export const LOCALES: Locale[] = [ "de", "en" ];

/** `en` must have exactly the same shape as `de`, so a missing translation is a type error. */
export interface Dictionary<T> {
    de: T;
    en: T;
}

/** Defines a dictionary. German is the reference, English must match it. */
export function defineText<T>(de: T, en: NoInfer<T>): Dictionary<T> {
    return { de, en };
}

function initialLocale(): Locale {
    const stored = storage.readText(KEYS.locale);
    return stored === "en" ? "en" : "de";
}

interface LocaleState {
    locale: Locale;
    setLocale: (locale: Locale) => void;
}

/** Current UI language. Persisted in the browser, default German (it is a German exam trainer). */
export const useLocale = create<LocaleState>()(set => ({
    locale: initialLocale(),
    setLocale: (locale): void => set({ locale }),
}));

function applyLocale(locale: Locale): void {
    document.documentElement.lang = locale;
}

applyLocale(useLocale.getState().locale);
useLocale.subscribe(s => {
    storage.write(KEYS.locale, s.locale);
    applyLocale(s.locale);
});

/** Texts of a dictionary in the current language. For code outside of React components. */
export function text<T>(dict: Dictionary<T>): T {
    return dict[useLocale.getState().locale];
}

/** Texts of a dictionary in the current language. Re-renders when the language changes. */
export function useText<T>(dict: Dictionary<T>): T {
    return dict[useLocale(s => s.locale)];
}

/** Locale tag for number and date formatting. */
export function localeTag(): string {
    return useLocale.getState().locale === "en" ? "en-GB" : "de-DE";
}
