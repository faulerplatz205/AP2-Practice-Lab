import { type Column, columnKey } from "./columns";

/** Functional dependency: the attributes on the left determine those on the right. */
export type Dependency = [ string[], string[] ];

export interface NormAttribute {
    /** Canonical id, also used in `Dependency` */
    id: string;
    /** Accepted column names, compared with `columnKey()`. [0] is the German, [1] the English display name. */
    names: string[];
}

/** A column of the source table that is not atomic (1NF), e.g. „Name“ for first and last name. */
export interface NonAtomic {
    names: string[];
    parts: string[];
}

export interface NormScenario {
    attributes: NormAttribute[];
    dependencies: Dependency[];
    nonAtomic?: NonAtomic[];
}

export interface NormTable {
    /** Node id, to mark the table */
    id: number;
    name: string;
    columns: Column[];
}

/** Language-independent result; the texts are built in `src/lib/db/check.ts`. */
export type NormFinding =
    | { kind: "nonAtomic"; table: NormTable; column: string; parts: string[] }
    | { kind: "repeating"; table: NormTable; columns: string[] }
    | { kind: "unknown"; table: NormTable; columns: string[] }
    | { kind: "missing"; attributes: string[] }
    | { kind: "keyTooSmall"; table: NormTable; columns: string[] }
    /** `columns`: key parts that are not needed */
    | { kind: "keyTooBig"; table: NormTable; columns: string[] }
    | { kind: "noKey"; table: NormTable }
    | { kind: "partial"; table: NormTable; key: string[]; columns: string[] }
    | { kind: "transitive"; table: NormTable; via: string[]; columns: string[] }
    | { kind: "redundant"; attribute: string; tables: NormTable[] };

export function closure(attrs: Iterable<string>, deps: Dependency[]): Set<string> {
    const result = new Set(attrs);
    let grew = true;
    while (grew) {
        grew = false;
        for (const [ lhs, rhs ] of deps) {
            if (lhs.every(a => result.has(a)) && rhs.some(a => !result.has(a))) {
                rhs.forEach(a => result.add(a));
                grew = true;
            }
        }
    }
    return result;
}

const covers = (set: Set<string>, attrs: Iterable<string>): boolean => [ ...attrs ].every(a => set.has(a));

/** All minimal subsets of `attrs` whose closure covers `attrs`. Tables are small, so all subsets are tried. */
export function candidateKeys(attrs: string[], deps: Dependency[]): string[][] {
    const keys: string[][] = [];
    const n = attrs.length;
    const subsets = Array.from({ length: 1 << n }, (_, mask) => attrs.filter((_a, i) => mask & (1 << i)))
        .sort((a, b) => a.length - b.length);
    for (const s of subsets) {
        if (keys.some(k => k.every(a => s.includes(a)))) continue;
        if (covers(closure(s, deps), attrs)) keys.push(s);
    }
    return keys;
}

/** Maps a column name to the scenario attribute it names. */
export function attributeOf(scenario: NormScenario, column: string): string | undefined {
    const key = columnKey(column);
    return scenario.attributes.find(a => a.id === key || a.names.some(x => columnKey(x) === key))?.id;
}

/**
 * Checks tables against the dependencies of a scenario: atomic columns (1NF), every attribute present,
 * key determines the table, no partial (2NF) and no transitive (3NF) dependency, no redundant copies.
 * Columns that do not belong to the scenario (e.g. an extra surrogate key) are left out of the analysis.
 */
export function checkNormalization(tables: NormTable[], scenario: NormScenario): NormFinding[] {
    const found: NormFinding[] = [];
    const deps = scenario.dependencies;
    const determinants = new Set(deps.flatMap(([ lhs ]) => lhs));
    const seen = new Map<string, { table: NormTable; key: boolean }[]>();

    for (const table of tables) {
        const attrs: string[] = [], keyAttrs: string[] = [], unknown: string[] = [];
        let surrogateKey = false;
        const byBase = new Map<string, string[]>();
        for (const c of table.columns) {
            const nonAtomic = scenario.nonAtomic?.find(x => x.names.some(nm => columnKey(nm) === columnKey(c.name)));
            if (nonAtomic) {
                found.push({ kind: "nonAtomic", table, column: c.name, parts: nonAtomic.parts });
                continue;
            }
            const numbered = /^(.*?)_?\d+$/.exec(c.name);
            const base = numbered && attributeOf(scenario, numbered[1]);
            if (base && !attributeOf(scenario, c.name)) {
                byBase.set(base, [ ...(byBase.get(base) ?? []), c.name ]);
                continue;
            }
            const id = attributeOf(scenario, c.name);
            if (!id) {
                unknown.push(c.name);
                if (c.pk) surrogateKey = true;
                continue;
            }
            if (!attrs.includes(id)) attrs.push(id);
            if (c.pk && !keyAttrs.includes(id)) keyAttrs.push(id);
            seen.set(id, [ ...(seen.get(id) ?? []), { table, key: c.pk || c.fk }]);
        }
        for (const columns of byBase.values()) found.push({ kind: "repeating", table, columns });
        if (unknown.length) found.push({ kind: "unknown", table, columns: unknown });
        if (!attrs.length) continue;

        if (keyAttrs.length && !surrogateKey && !covers(closure(keyAttrs, deps), attrs)) {
            const notDetermined = attrs.filter(a => !closure(keyAttrs, deps).has(a));
            found.push({ kind: "keyTooSmall", table, columns: notDetermined });
        }
        const keys = candidateKeys(attrs, deps);
        // A key made of attributes that determine nothing (e.g. two names) means the columns do not belong together
        if (!keys.some(k => k.every(a => determinants.has(a)))) {
            found.push({ kind: "noKey", table });
            continue;
        }
        const inner = keys.find(k => k.every(a => keyAttrs.includes(a)));
        if (!surrogateKey && inner && inner.length < keyAttrs.length) {
            found.push({ kind: "keyTooBig", table, columns: keyAttrs.filter(a => !inner.includes(a)) });
        }
        const prime = new Set(keys.flat());
        const nonPrime = attrs.filter(a => !prime.has(a));
        if (!nonPrime.length) continue;

        // 2NF: a non-key attribute depends on part of a composite key only; one finding per key part
        const partial = new Set<string>();
        for (const key of keys.filter(k => k.length > 1)) {
            for (let mask = 1; mask < (1 << key.length) - 1; mask++) {
                const part = key.filter((_a, i) => mask & (1 << i));
                const hit = nonPrime.filter(a => !partial.has(a) && closure(part, deps).has(a));
                hit.forEach(a => partial.add(a));
                if (hit.length) found.push({ kind: "partial", table, key: part, columns: hit });
            }
        }

        // 3NF: a non-key attribute depends on another non-key attribute
        const transitive = new Set<string>();
        let via: string[] = [];
        for (const [ lhs ] of deps) {
            if (!lhs.every(a => attrs.includes(a))) continue;
            if (keys.some(k => lhs.every(a => k.includes(a)))) continue;
            if (covers(closure(lhs, deps), attrs)) continue;
            const hit = nonPrime.filter(a => !lhs.includes(a) && !partial.has(a) && closure(lhs, deps).has(a));
            if (hit.length && !via.length) via = lhs;
            hit.forEach(a => transitive.add(a));
        }
        if (transitive.size) found.push({ kind: "transitive", table, via, columns: [ ...transitive ] });
    }

    const present = new Set(seen.keys());
    const missing = scenario.attributes.map(a => a.id).filter(id => !present.has(id));
    if (missing.length) found.push({ kind: "missing", attributes: missing });

    for (const [ attribute, places ] of seen) {
        const plain = places.filter(p => !p.key);
        if (places.length > 1 && plain.length > 0 && new Set(places.map(p => p.table.id)).size > 1) {
            found.push({ kind: "redundant", attribute, tables: places.map(p => p.table) });
        }
    }
    return found;
}
