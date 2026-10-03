import type { achievementText } from "../i18n/achievements";

export interface Achievement {
    /** Stable id, stored in the browser. Never rename. */
    id: AchievementId;
    xp: number;
    /** Symbol (one character) */
    icon: string;
    hidden?: boolean;
    /** Counter that is increased, and the value that unlocks the achievement */
    counter?: string;
    target?: number;
}

export type AchievementId = keyof typeof achievementText.de;

/** All achievements. Names and descriptions live in src/i18n/achievements.ts, rules in docs/achievements.md */
export const ACHIEVEMENTS: Achievement[] = [
    { id: "first_node", xp: 10, icon: "▦" },
    { id: "first_arrow", xp: 10, icon: "→" },
    { id: "calc", xp: 15, icon: "∑" },
    { id: "check_ok", xp: 50, icon: "✓" },
    { id: "milestone", xp: 25, icon: "◆" },
    { id: "big", xp: 60, icon: "▤" },
    { id: "start1", xp: 40, icon: "1" },
    { id: "mental", xp: 100, icon: "✎" },
    { id: "architect", xp: 120, icon: "⌂" },
    { id: "tasks5", xp: 150, icon: "★", counter: "tasks", target: 5 },
    { id: "uml_first", xp: 10, icon: "◇" },
    { id: "act_ok", xp: 60, icon: "⇣" },
    { id: "uml_ok", xp: 50, icon: "✓" },
    { id: "uml_kinds", xp: 120, icon: "⊕", counter: "kinds", target: 4 },
    { id: "quick", xp: 20, icon: "»", counter: "quick", target: 10 },
    { id: "unbeatable", xp: 100, icon: "⚔", counter: "streak", target: 5 },
    { id: "list", xp: 20, icon: "≡" },
    { id: "layout", xp: 10, icon: "⊞" },
    { id: "gantt", xp: 10, icon: "▬" },
    { id: "export", xp: 15, icon: "▣" },
    { id: "guide", xp: 20, icon: "?", counter: "guide", target: 9 },
    { id: "subnet_first", xp: 10, icon: "/" },
    { id: "subnet_ok", xp: 40, icon: "∧" },
    { id: "subnet10", xp: 120, icon: "⌗", counter: "subnets", target: 10 },
    { id: "night", xp: 30, icon: "☾", hidden: true },
    { id: "rainer", xp: 50, icon: "R", hidden: true },
    { id: "rainer10", xp: 75, icon: "R", hidden: true, counter: "rainer", target: 10 },
];

/** XP needed for each level. Titles: src/i18n/achievements.ts */
export const LEVELS: number[] = [ 0, 40, 100, 190, 300, 440, 600, 800, 1000 ];

export interface LevelInfo {
    index: number;
    level: number;
    from: number;
    /** XP needed for the next level, `null` at the highest one */
    to: number | null;
    /** Progress towards the next level in percent */
    percent: number;
}

export function levelFor(xp: number): LevelInfo {
    let index = 0;
    LEVELS.forEach((min, k) => {
        if (xp >= min) index = k;
    });
    const from = LEVELS[index], to = LEVELS[index + 1] ?? null;
    return { index, level: index + 1, from, to, percent: to ? Math.round((xp - from) / (to - from) * 100) : 100 };
}

export function xpFor(unlocked: Record<string, number>): number {
    return ACHIEVEMENTS.filter(a => unlocked[a.id]).reduce((s, a) => s + a.xp, 0);
}
