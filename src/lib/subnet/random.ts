export type Random = () => number;

/** Small deterministic generator (mulberry32) for reproducible tasks in tests. */
export function seededRandom(seed: number): Random {
    let state = seed >>> 0;
    return (): number => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
    };
}

/** Whole number from `min` to `max`, both included. */
export function int(random: Random, min: number, max: number): number {
    return min + Math.floor(random() * (max - min + 1));
}

export function pick<T>(random: Random, list: readonly T[]): T {
    return list[Math.floor(random() * list.length)];
}

export function chance(random: Random, probability: number): boolean {
    return random() < probability;
}

export function shuffled<T>(random: Random, list: readonly T[]): T[] {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [ a[i], a[j] ] = [ a[j], a[i] ];
    }
    return a;
}
