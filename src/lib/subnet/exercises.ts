import { type Random, pick } from "./random";
import { GENERATORS } from "./generators";
import { checkPlan, checkField } from "./answers";

export { seededRandom, type Random } from "./random";
export { checkField, parseInteger } from "./answers";

export type ExerciseKind =
    | "networkBroadcast" | "hostRange" | "hostCount" | "maskToPrefix" | "prefixToMask"
    | "split" | "vlsm" | "ipv6Shorten" | "ipv6Expand" | "ipv6Subnets"
    | "hostSubnet" | "sameSubnet" | "hostsToPrefix" | "subnetsToPrefix" | "reverseMask" | "wildcard"
    | "summarize" | "routeContents" | "findMistake" | "vlsmScenario"
    | "ipv6Prefix" | "ipv6NthSubnet" | "ipv6Type" | "eui64";

/** Order of the kind menu: related kinds next to each other. */
export const EXERCISE_KINDS: ExerciseKind[] = [
    "networkBroadcast", "hostRange", "hostSubnet", "sameSubnet", "hostCount", "hostsToPrefix",
    "maskToPrefix", "prefixToMask", "reverseMask", "wildcard",
    "split", "subnetsToPrefix", "vlsm", "vlsmScenario", "summarize", "routeContents", "findMistake",
    "ipv6Shorten", "ipv6Expand", "ipv6Prefix", "ipv6Subnets", "ipv6NthSubnet", "ipv6Type", "eui64",
];

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTIES: Difficulty[] = [ "easy", "medium", "hard" ];

export type Topic = "basics" | "masks" | "subnetting" | "routing" | "troubleshooting" | "ipv6";

export const TOPICS: Topic[] = [ "basics", "masks", "subnetting", "routing", "troubleshooting", "ipv6" ];

export const TOPIC_OF: Record<ExerciseKind, Topic> = {
    networkBroadcast: "basics", hostRange: "basics", hostSubnet: "basics", sameSubnet: "basics", hostCount: "basics",
    hostsToPrefix: "masks", maskToPrefix: "masks", prefixToMask: "masks", reverseMask: "masks", wildcard: "masks",
    split: "subnetting", subnetsToPrefix: "subnetting", vlsm: "subnetting", vlsmScenario: "subnetting",
    summarize: "routing", routeContents: "routing", findMistake: "troubleshooting",
    ipv6Shorten: "ipv6", ipv6Expand: "ipv6", ipv6Prefix: "ipv6", ipv6Subnets: "ipv6", ipv6NthSubnet: "ipv6", ipv6Type: "ipv6", eui64: "ipv6",
};

export type DepartmentId =
    | "sales" | "it" | "admin" | "production" | "support" | "marketing" | "purchasing" | "management"
    | "servers" | "voip" | "guestWifi" | "teachers" | "pupils" | "library" | "computerLab" | "printers"
    | "headquarters" | "branchNorth" | "branchSouth" | "branchEast" | "branchWest" | "warehouse" | "wan1" | "wan2";

export const DEPARTMENTS: DepartmentId[] = [ "sales", "it", "admin", "production", "support", "marketing", "purchasing", "management" ];

export type ScenarioId = "company" | "school" | "branches";

export type DeviceId = "pc1" | "pc2" | "pc3" | "laptop" | "printer" | "server" | "phone" | "accessPoint";

export type MistakeId = "gatewayOutside" | "broadcastAsHost" | "networkAsHost" | "wrongMask" | "overlap" | "notAligned" | "outside";

export interface DeviceConfig {
    id: DeviceId;
    address: string;
    prefix: number;
    gateway: string;
}

export interface PlanEntry {
    id: DepartmentId;
    network: string;
    prefix: number;
}

/** `variant` picks one of several phrasings; the UI takes it modulo the number of templates. */
export type ExerciseTask = { variant: number } & (
    | { kind: "networkBroadcast" | "hostRange"; address: string; prefix: number; showMask: boolean }
    /** `mask` is set when the task shows the dotted mask instead of the prefix */
    | { kind: "hostCount"; prefix: number; mask: string | null }
    | { kind: "maskToPrefix"; mask: string }
    | { kind: "prefixToMask"; prefix: number }
    /** `nth` counts from 1 */
    | { kind: "split"; network: string; prefix: number; count: number; nth: number }
    | { kind: "vlsm"; network: string; prefix: number; departments: { id: DepartmentId; hosts: number }[] }
    | { kind: "ipv6Shorten" | "ipv6Expand"; address: string }
    | { kind: "ipv6Subnets"; network: string; prefix: number; target: number }
    | { kind: "hostSubnet"; network: string; prefix: number; subPrefix: number; host: string }
    | { kind: "sameSubnet"; hosts: { id: DeviceId; address: string }[]; prefix: number; showMask: boolean }
    | { kind: "hostsToPrefix"; hosts: number; segment: DepartmentId }
    /** `minHosts` adds the second condition „at least n hosts per subnet“ */
    | { kind: "subnetsToPrefix"; network: string; prefix: number; count: number; minHosts: number | null }
    | { kind: "reverseMask"; network: string; broadcast: string }
    | { kind: "wildcard"; network: string; prefix: number; wildcard: string; reverse: boolean }
    /** `networks` in CIDR notation */
    | { kind: "summarize"; networks: string[] }
    | { kind: "routeContents"; network: string; prefix: number; target: number }
    | { kind: "findMistake"; setting: "devices"; devices: DeviceConfig[]; showMask: boolean }
    | { kind: "findMistake"; setting: "plan"; network: string; prefix: number; entries: PlanEntry[] }
    /** `name` indexes the company or school names of the scenario, `reserve` is a percentage (0 = none) */
    | { kind: "vlsmScenario"; scenario: ScenarioId; name: number; network: string; prefix: number; reserve: number; segments: { id: DepartmentId; hosts: number }[] }
    /** `site` is the prefix of the whole site when the subnet id is asked */
    | { kind: "ipv6Prefix"; address: string; prefix: number; site: number | null }
    /** `nth` counts from 1, the first subnet has the subnet id 0 */
    | { kind: "ipv6NthSubnet"; network: string; prefix: number; nth: number }
    | { kind: "ipv6Type"; address: string }
    | { kind: "eui64"; mac: string }
);

export type FieldKey =
    | "network" | "broadcast" | "firstHost" | "lastHost" | "hosts" | "mask" | "prefix" | "subnetCount" | "ipv6Short" | "ipv6Full"
    | "netmask" | "wildcard" | "subnetIndex" | "same" | "item" | "mistake" | "summary" | "firstNetwork" | "lastNetwork"
    | "ipv6Network" | "subnetId" | "addressType" | "interfaceId" | "linkLocal";

/**
 * `netmask` accepts a prefix or a dotted mask; `prefix` and `mask` only their own notation.
 * `cidr` is an address with prefix or mask, `ipv6Net` an IPv6 network with optional length,
 * `ipv6Any` any valid IPv6 notation, `iid` four hex groups, `hex` one hex number.
 */
export type AnswerKind =
    | "ipv4" | "prefix" | "mask" | "netmask" | "integer" | "ipv6Short" | "ipv6Full"
    | "wildcard" | "cidr" | "choice" | "hex" | "ipv6Net" | "ipv6Any" | "iid";

export type Tip =
    | "empty" | "format" | "wrong"
    | "comma" | "octets" | "octetRange" | "prefixRange" | "prefixSuffix"
    | "maskNotContiguous" | "maskInsteadOfPrefix" | "prefixInsteadOfMask" | "isWildcard" | "isMask" | "wildcardNotContiguous"
    | "cidrPrefix" | "hostBits" | "notAnOption"
    | "notShortened" | "notExpanded" | "leadingZeros" | "singleZero" | "longestRun" | "tieFirst" | "lowerCase"
    | "ipv6Hex" | "ipv6DoubleColon" | "ipv6GroupLength" | "ipv6Groups" | "ipv6PrefixLength" | "hostBits6"
    | "isBroadcast" | "isNetwork" | "isGivenAddress" | "isNextNetwork" | "countedAll" | "forgotReserved"
    | "zeroBased" | "isExponent" | "subnetIdBits" | "flipBit"
    | "planAligned" | "planOutside" | "planOverlap";

/** A typical wrong answer with its own tip. */
export interface Trap {
    value: string;
    tip: Tip;
}

export interface ExerciseField {
    id: string;
    key: FieldKey;
    answer: AnswerKind;
    solution: string;
    /** Index of the department or device the field belongs to */
    group?: number;
    traps?: Trap[];
    /** Values a `choice` field offers */
    options?: string[];
    /** Further correct values of a `choice` field */
    accepted?: string[];
    /** Prefix that may follow an `ipv4` answer, e.g. `192.168.1.0/24` for a network address */
    prefix?: number;
}

export interface Exercise {
    task: ExerciseTask;
    fields: ExerciseField[];
}

export interface FieldResult {
    id: string;
    correct: boolean;
    tip: Tip | null;
    /** Hint on a correct answer, e.g. that RFC 5952 prefers another notation */
    note?: Tip;
}

export function generateExercise(random: Random = Math.random, kind: ExerciseKind = pick(random, EXERCISE_KINDS), level: Difficulty = "medium"): Exercise {
    return GENERATORS[kind](random, level);
}

/** Random kind from `kinds` that differs from `previous` whenever there is a choice. */
export function nextKind(random: Random, previous: ExerciseKind | null, kinds: readonly ExerciseKind[] = EXERCISE_KINDS): ExerciseKind {
    const choices = kinds.filter(k => k !== previous);
    return pick(random, choices.length ? choices : kinds);
}

export function checkExercise(exercise: Exercise, answers: Record<string, string>): { results: FieldResult[]; allCorrect: boolean } {
    const results = exercise.task.kind === "vlsmScenario"
        ? checkPlan(exercise, answers)
        : exercise.fields.map(f => checkField(f, answers[f.id] ?? ""));
    return { results, allCorrect: results.every(r => r.correct) };
}

/** Right and wrong first checks per kind, `[ right, wrong ]`. */
export type KindStats = Partial<Record<ExerciseKind, [ number, number ]>>;

export function recordResult(stats: KindStats, kind: ExerciseKind, correct: boolean): KindStats {
    const [ right, wrong ] = stats[kind] ?? [ 0, 0 ];
    return { ...stats, [kind]: correct ? [ right + 1, wrong ] : [ right, wrong + 1 ] };
}

/** Up to `limit` kinds with mistakes, the highest share of wrong answers first. */
export function weakKinds(stats: KindStats, limit = 4): ExerciseKind[] {
    const share = (k: ExerciseKind): number => {
        const [ right, wrong ] = stats[k] ?? [ 0, 0 ];
        return wrong / (right + wrong || 1);
    };
    return EXERCISE_KINDS.filter(k => (stats[k]?.[1] ?? 0) > 0).sort((a, b) => share(b) - share(a)).slice(0, limit);
}

export const ROUND_LENGTH = 10;

export interface RoundResult {
    kind: ExerciseKind;
    correct: boolean;
}

/** Right and total per topic, only topics that occurred, in the order of `TOPICS`. */
export function topicScores(results: RoundResult[]): { topic: Topic; right: number; total: number }[] {
    return TOPICS.map(topic => {
        const own = results.filter(r => TOPIC_OF[r.kind] === topic);
        return { topic, right: own.filter(r => r.correct).length, total: own.length };
    }).filter(s => s.total > 0);
}
