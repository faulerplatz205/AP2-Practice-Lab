import { create } from "zustand";
import { ACHIEVEMENTS, type Achievement, levelFor, xpFor } from "../lib/achievements";
import { KEYS, storage } from "../lib/storage";

interface Progress {
    /** Unlocked achievements: id => timestamp */
    unlocked: Record<string, number>;
    /** Counters such as tasks, quick, rainer, streak, guide, kinds */
    counters: Record<string, number>;
    guideRead: number[];
    /** UML diagram kinds that were checked without mistakes */
    checkedKinds: string[];
    /** Fingerprint of the last correct diagram (for the streak) */
    lastCorrect: string | null;
}

/** Stored shape. The short keys come from the first version and must stay, or existing progress is lost. */
interface StoredProgress {
    u: Record<string, number>;
    c: Record<string, number>;
    g: number[];
    k: string[];
    lastOk: string | null;
}

export type Popup = { key: number } & ({ kind: "achievement"; achievement: Achievement } | { kind: "level"; level: number });

interface AchievementState extends Progress {
    popups: Popup[];
    unlock: (id: string) => void;
    /** Increases a counter and unlocks the achievements that depend on it */
    bump: (counter: string, amount?: number) => void;
    update: (patch: Partial<Progress>) => void;
    dismissPopup: () => void;
}

/** Versions before 2.0 stored the German diagram names instead of the mode keys. */
const LEGACY_KIND_NAMES: Record<string, string> = {
    "Aktivitätsdiagramm": "akt", "Zustandsdiagramm": "zu", "Use-Case-Diagramm": "uc", "Klassendiagramm": "kl", "Sequenzdiagramm": "seq",
    "Objektdiagramm": "obj", "Komponentendiagramm": "komp", "Verteilungsdiagramm": "vert", "Paketdiagramm": "pak",
};

function load(): Progress {
    const d = storage.read<Partial<StoredProgress>>(KEYS.achievements);
    const checkedKinds = [ ...new Set((d?.k ?? []).map(k => LEGACY_KIND_NAMES[k] ?? k)) ];
    return { unlocked: d?.u ?? {}, counters: d?.c ?? {}, guideRead: d?.g ?? [], checkedKinds, lastCorrect: d?.lastOk ?? null };
}

function save(p: Progress): void {
    const stored: StoredProgress = { u: p.unlocked, c: p.counters, g: p.guideRead, k: p.checkedKinds, lastOk: p.lastCorrect };
    storage.write(KEYS.achievements, stored);
}

let popupKey = 0;

export const useAchievements = create<AchievementState>()((set, get) => ({
    ...load(),
    popups: [],

    unlock: (id): void => {
        const s = get();
        const a = ACHIEVEMENTS.find(x => x.id === id);
        if (!a || s.unlocked[id]) return;
        const before = levelFor(xpFor(s.unlocked)).level;
        const unlocked = { ...s.unlocked, [id]: Date.now() };
        const after = levelFor(xpFor(unlocked)).level;
        const popups: Popup[] = [ ...s.popups, { key: ++popupKey, kind: "achievement", achievement: a }];
        if (after > before) popups.push({ key: ++popupKey, kind: "level", level: after });
        set({ unlocked, popups });
    },

    bump: (counter, amount = 1): void => {
        const counters = { ...get().counters, [counter]: (get().counters[counter] ?? 0) + amount };
        set({ counters });
        ACHIEVEMENTS.filter(a => a.counter === counter && counters[counter] >= (a.target ?? Infinity)).forEach(a => get().unlock(a.id));
    },

    update: (patch): void => set(patch),
    dismissPopup: (): void => set(s => ({ popups: s.popups.slice(1) })),
}));

useAchievements.subscribe((s, prev) => {
    if (s.unlocked !== prev.unlocked || s.counters !== prev.counters || s.guideRead !== prev.guideRead || s.checkedKinds !== prev.checkedKinds || s.lastCorrect !== prev.lastCorrect) save(s);
});

export const unlock = (id: string): void => useAchievements.getState().unlock(id);
export const bump = (counter: string, amount?: number): void => useAchievements.getState().bump(counter, amount);
