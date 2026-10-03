import { analyzeIpv4, formatIpv4, maskToPrefix, parseIpv4, parsePrefixOrMask, prefixForHosts, prefixToMask } from "./ipv4";
import { splitEqual, vlsm } from "./divide";
import { expandIpv6, parseIpv6, shortenIpv6, subnetCount } from "./ipv6";

export type ExerciseKind =
    | "networkBroadcast" | "hostRange" | "hostCount" | "maskToPrefix" | "prefixToMask"
    | "split" | "vlsm" | "ipv6Shorten" | "ipv6Expand" | "ipv6Subnets";

export const EXERCISE_KINDS: ExerciseKind[] = [
    "networkBroadcast", "hostRange", "hostCount", "maskToPrefix", "prefixToMask", "split", "vlsm", "ipv6Shorten", "ipv6Expand", "ipv6Subnets",
];

export type DepartmentId = "sales" | "it" | "admin" | "production" | "support" | "marketing" | "purchasing" | "management";

export const DEPARTMENTS: DepartmentId[] = [ "sales", "it", "admin", "production", "support", "marketing", "purchasing", "management" ];

export type ExerciseTask =
    | { kind: "networkBroadcast" | "hostRange"; address: string; prefix: number }
    /** `mask` is set when the task shows the dotted mask instead of the prefix */
    | { kind: "hostCount"; prefix: number; mask: string | null }
    | { kind: "maskToPrefix"; mask: string }
    | { kind: "prefixToMask"; prefix: number }
    /** `nth` counts from 1 */
    | { kind: "split"; network: string; prefix: number; count: number; nth: number }
    | { kind: "vlsm"; network: string; prefix: number; departments: { id: DepartmentId; hosts: number }[] }
    | { kind: "ipv6Shorten" | "ipv6Expand"; address: string }
    | { kind: "ipv6Subnets"; network: string; prefix: number; target: number };

export type FieldKey = "network" | "broadcast" | "firstHost" | "lastHost" | "hosts" | "mask" | "prefix" | "subnetCount" | "ipv6Short" | "ipv6Full";

/** `netmask` accepts a prefix or a dotted mask; `prefix` and `mask` only their own notation. */
export type AnswerKind = "ipv4" | "prefix" | "mask" | "netmask" | "integer" | "ipv6Short" | "ipv6Full";

export interface ExerciseField {
    id: string;
    key: FieldKey;
    answer: AnswerKind;
    solution: string;
    /** Index of the department in a VLSM task */
    group?: number;
}

export interface Exercise {
    task: ExerciseTask;
    fields: ExerciseField[];
}

export type Tip = "empty" | "format" | "maskNotContiguous" | "notShortened" | "notExpanded" | "wrong";

export interface FieldResult {
    id: string;
    correct: boolean;
    tip: Tip | null;
}

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

function int(random: Random, min: number, max: number): number {
    return min + Math.floor(random() * (max - min + 1));
}

function pick<T>(random: Random, list: readonly T[]): T {
    return list[Math.floor(random() * list.length)];
}

function shuffled<T>(random: Random, list: readonly T[]): T[] {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [ a[i], a[j] ] = [ a[j], a[i] ];
    }
    return a;
}

function field(key: FieldKey, answer: AnswerKind, solution: string, group?: number): ExerciseField {
    return { id: group === undefined ? key : `${key}${group}`, key, answer, solution, group };
}

/** Random address from a private range, with a prefix that fits into that range. */
function privateAddress(random: Random, minPrefix: number): { address: number; prefix: number } {
    const range = pick(random, [
        { base: 10 << 24, prefix: 8 },
        { base: (172 << 24 | 16 << 16) >>> 0, prefix: 12 },
        { base: (192 << 24 | 168 << 16) >>> 0, prefix: 16 },
    ]);
    const hostPart = Math.floor(random() * 2 ** (32 - range.prefix));
    return { address: range.base + hostPart, prefix: int(random, Math.max(minPrefix, range.prefix + 1), 30) };
}

function networkBroadcast(random: Random): Exercise {
    const { address, prefix } = privateAddress(random, 16);
    const info = analyzeIpv4(address, prefix);
    return {
        task: { kind: "networkBroadcast", address: formatIpv4(address), prefix },
        fields: [ field("network", "ipv4", formatIpv4(info.network)), field("broadcast", "ipv4", formatIpv4(info.broadcast!)) ],
    };
}

function hostRange(random: Random): Exercise {
    const { address, prefix } = privateAddress(random, 18);
    const info = analyzeIpv4(address, prefix);
    return {
        task: { kind: "hostRange", address: formatIpv4(address), prefix },
        fields: [
            field("firstHost", "ipv4", formatIpv4(info.firstHost)),
            field("lastHost", "ipv4", formatIpv4(info.lastHost)),
            field("hosts", "integer", String(info.usableHosts)),
        ],
    };
}

function hostCount(random: Random): Exercise {
    const prefix = int(random, 18, 30);
    const mask = random() < 0.5 ? formatIpv4(prefixToMask(prefix)) : null;
    return { task: { kind: "hostCount", prefix, mask }, fields: [ field("hosts", "integer", String(2 ** (32 - prefix) - 2)) ] };
}

function maskToPrefixTask(random: Random): Exercise {
    const prefix = int(random, 9, 30);
    return { task: { kind: "maskToPrefix", mask: formatIpv4(prefixToMask(prefix)) }, fields: [ field("prefix", "prefix", `/${prefix}`) ] };
}

function prefixToMaskTask(random: Random): Exercise {
    const prefix = int(random, 9, 30);
    return { task: { kind: "prefixToMask", prefix }, fields: [ field("mask", "mask", formatIpv4(prefixToMask(prefix))) ] };
}

function split(random: Random): Exercise {
    const base = pick(random, [
        { network: (192 << 24 | 168 << 16 | int(random, 0, 255) << 8) >>> 0, prefix: 24 },
        { network: (172 << 24 | int(random, 16, 31) << 16) >>> 0, prefix: 16 },
        { network: (10 << 24 | int(random, 0, 255) << 16) >>> 0, prefix: 16 },
        { network: (10 << 24) >>> 0, prefix: pick(random, [ 20, 22 ]) },
    ]);
    const count = int(random, 3, 14);
    const nth = int(random, 2, count);
    const result = splitEqual(base.network, base.prefix, count);
    if (!result.ok) throw new Error("split exercise out of range");
    const subnet = result.subnets[nth - 1];
    return {
        task: { kind: "split", network: formatIpv4(base.network), prefix: base.prefix, count, nth },
        fields: [
            field("prefix", "netmask", `/${result.prefix}`),
            field("network", "ipv4", formatIpv4(subnet.network)),
            field("broadcast", "ipv4", formatIpv4(subnet.broadcast!)),
        ],
    };
}

function vlsmTask(random: Random): Exercise {
    let hosts: number[];
    do {
        hosts = shuffled(random, [ int(random, 33, 120), int(random, 10, 60), int(random, 2, 29) ]);
    } while (new Set(hosts.map(prefixForHosts)).size < hosts.length);
    const ids = shuffled(random, DEPARTMENTS).slice(0, 3);
    const departments = ids.map((id, k) => ({ id, hosts: hosts[k] }));
    const network = (192 << 24 | 168 << 16 | int(random, 0, 255) << 8) >>> 0;
    const result = vlsm(network, 24, departments.map(d => ({ name: d.id, hosts: d.hosts })));
    const fields = departments.flatMap((_, k) => {
        const a = result.allocations.find(x => x.index === k)!;
        return [ field("network", "ipv4", formatIpv4(a.network), k), field("prefix", "netmask", `/${a.prefix}`, k) ];
    });
    return { task: { kind: "vlsm", network: formatIpv4(network), prefix: 24, departments }, fields };
}

/** Documentation prefix with leading zeros and zero runs, so that there is something to shorten. */
function randomIpv6(random: Random): number[] {
    const groups = [ 0x2001, 0x0db8 ];
    for (let k = 2; k < 8; k++) {
        const roll = random();
        groups.push(roll < 0.4 ? 0 : roll < 0.7 ? int(random, 1, 0xff) : roll < 0.85 ? int(random, 0x100, 0xfff) : int(random, 0x1000, 0xffff));
    }
    const runStart = int(random, 2, 5);
    const runLength = int(random, 2, 8 - runStart - 1);
    for (let k = runStart; k < runStart + runLength; k++) groups[k] = 0;
    return groups;
}

function ipv6Shorten(random: Random): Exercise {
    const address = randomIpv6(random);
    return { task: { kind: "ipv6Shorten", address: expandIpv6(address) }, fields: [ field("ipv6Short", "ipv6Short", shortenIpv6(address)) ] };
}

function ipv6Expand(random: Random): Exercise {
    const address = randomIpv6(random);
    return { task: { kind: "ipv6Expand", address: shortenIpv6(address) }, fields: [ field("ipv6Full", "ipv6Full", expandIpv6(address)) ] };
}

function ipv6Subnets(random: Random): Exercise {
    const prefix = pick(random, [ 32, 40, 44, 48, 52, 56 ]);
    const target = pick(random, prefix < 48 ? [ 48, 56, 64 ] : [ 56, 64, 64 ].filter(t => t > prefix));
    const groups = [ 0x2001, 0x0db8, int(random, 0, 0xffff), 0, 0, 0, 0, 0 ];
    groups[2] &= prefix >= 48 ? 0xffff : (0xffff << (48 - prefix)) & 0xffff;
    if (prefix > 48) groups[3] = int(random, 0, 0xffff) & (0xffff << (64 - prefix)) & 0xffff;
    return {
        task: { kind: "ipv6Subnets", network: shortenIpv6(groups), prefix, target },
        fields: [ field("subnetCount", "integer", subnetCount(prefix, target).toString()) ],
    };
}

const GENERATORS: Record<ExerciseKind, (random: Random) => Exercise> = {
    networkBroadcast, hostRange, hostCount, maskToPrefix: maskToPrefixTask, prefixToMask: prefixToMaskTask, split, vlsm: vlsmTask, ipv6Shorten, ipv6Expand, ipv6Subnets,
};

export function generateExercise(random: Random = Math.random, kind: ExerciseKind = pick(random, EXERCISE_KINDS)): Exercise {
    return GENERATORS[kind](random);
}

/** Accepts `1024`, `1.024`, `1 024`, `2^10` and `2**10`. */
export function parseInteger(input: string): bigint | null {
    const text = input.replace(/[\s.,'_ ]/g, "");
    const power = /^(\d+)(?:\^|\*\*)(\d+)$/.exec(text);
    if (power) return BigInt(power[1]) ** BigInt(power[2]);
    return /^\d+$/.test(text) ? BigInt(text) : null;
}

const strip = (input: string): string => input.replace(/\s+/g, "");

export function checkField(f: ExerciseField, input: string): FieldResult {
    const result = (correct: boolean, tip: Tip | null): FieldResult => ({ id: f.id, correct, tip: correct ? null : tip });
    const answer = strip(input);
    if (!answer) return result(false, "empty");
    switch (f.answer) {
        case "ipv4": {
            const value = parseIpv4(answer);
            return value === null ? result(false, "format") : result(value === parseIpv4(f.solution), "wrong");
        }
        case "prefix": {
            const match = /^\/?(\d{1,2})$/.exec(answer);
            return match ? result(`/${Number(match[1])}` === f.solution, "wrong") : result(false, "format");
        }
        case "mask": {
            const value = parseIpv4(answer);
            if (value === null) return result(false, "format");
            if (maskToPrefix(value) === null) return result(false, "maskNotContiguous");
            return result(value === parseIpv4(f.solution), "wrong");
        }
        case "netmask": {
            const value = parsePrefixOrMask(answer);
            if (!value.ok) return result(false, value.error === "maskNotContiguous" ? "maskNotContiguous" : "format");
            const solution = parsePrefixOrMask(f.solution);
            return result(solution.ok && value.value === solution.value, "wrong");
        }
        case "integer": {
            const value = parseInteger(answer);
            return value === null ? result(false, "format") : result(value === parseInteger(f.solution), "wrong");
        }
        case "ipv6Short":
        case "ipv6Full": {
            const value = parseIpv6(answer);
            if (!value) return result(false, "format");
            if (expandIpv6(value) !== expandIpv6(parseIpv6(f.solution)!)) return result(false, "wrong");
            const notation = f.answer === "ipv6Short" ? "notShortened" : "notExpanded";
            return result(answer.toLowerCase() === f.solution, notation);
        }
    }
}

export function checkExercise(exercise: Exercise, answers: Record<string, string>): { results: FieldResult[]; allCorrect: boolean } {
    const results = exercise.fields.map(f => checkField(f, answers[f.id] ?? ""));
    return { results, allCorrect: results.every(r => r.correct) };
}
