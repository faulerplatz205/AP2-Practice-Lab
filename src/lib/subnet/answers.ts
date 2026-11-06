import type { AnswerKind, DepartmentId, Exercise, ExerciseField, FieldResult, Tip } from "./exercises";
import { maskToPrefix, networkOf, parseCidr, parseIpv4, parsePrefixOrMask, prefixForHosts, blockSize } from "./ipv4";
import { overlaps } from "./divide";
import { expandIpv6, ipv6Network, parseIpv6 } from "./ipv6";

/** Larger exponents are no sensible answer and would only cost memory. */
const MAX_EXPONENT = 256;

/** Accepts `1024`, `1.024`, `1 024`, `2^10`, `2**10`, `2^6-2` and a trailing word such as `62 Hosts`. */
export function parseInteger(input: string): bigint | null {
    const text = input.replace(/[\s.,'_ ]/g, "").replace(/−/g, "-").replace(/(\d)[a-zäöüß]+$/i, "$1");
    const power = /^(\d+)(?:\^|\*\*)(\d+)(?:([+-])(\d+))?$/.exec(text);
    if (power) {
        if (Number(power[2]) > MAX_EXPONENT) return null;
        const value = BigInt(power[1]) ** BigInt(power[2]);
        if (!power[3]) return value;
        const result = power[3] === "+" ? value + BigInt(power[4]) : value - BigInt(power[4]);
        return result < 0n ? null : result;
    }
    return /^\d+$/.test(text) ? BigInt(text) : null;
}

interface Verdict {
    correct: boolean;
    tip: Tip | null;
    note?: Tip;
}

const right = (note?: Tip): Verdict => ({ correct: true, tip: null, note });
const wrong = (tip: Tip): Verdict => ({ correct: false, tip });

/** Tip of the first trap whose value `same` considers equal to the answer, otherwise `wrong`. */
function trapTip(f: ExerciseField, same: (value: string) => boolean): Tip {
    return f.traps?.find(t => same(t.value))?.tip ?? "wrong";
}

function compare(f: ExerciseField, correct: boolean, same: (value: string) => boolean): Verdict {
    return correct ? right() : wrong(trapTip(f, same));
}

/** Says why `text` is not a dotted IPv4 address. */
function ipv4Problem(text: string): Tip {
    if (text.includes(",")) return "comma";
    const parts = text.split(".");
    if (parts.length !== 4) return "octets";
    if (parts.some(p => !/^\d+$/.test(p))) return "format";
    return parts.some(p => Number(p) > 255) ? "octetRange" : "format";
}

function isMask(value: number): boolean {
    return maskToPrefix(value) !== null;
}

/** For a value that is no contiguous mask: maybe it is a wildcard. */
function maskProblem(value: number): Tip {
    return isMask(~value >>> 0) ? "isWildcard" : "maskNotContiguous";
}

function checkIpv4(f: ExerciseField, answer: string): Verdict {
    const suffix = /^(.*)\/(\d{1,2})$/.exec(answer);
    const text = suffix ? suffix[1] : answer;
    const value = parseIpv4(text);
    if (value === null) return wrong(ipv4Problem(text));
    if (suffix && Number(suffix[2]) !== f.prefix) return wrong("prefixSuffix");
    return compare(f, value === parseIpv4(f.solution), v => parseIpv4(v) === value);
}

function checkPrefix(f: ExerciseField, answer: string): Verdict {
    const match = /^\/?(\d+)$/.exec(answer);
    if (!match) return wrong(answer.includes(".") ? "maskInsteadOfPrefix" : "format");
    const prefix = Number(match[1]);
    if (prefix > 32) return wrong("prefixRange");
    return compare(f, `/${prefix}` === f.solution, v => v === `/${prefix}`);
}

function checkMask(f: ExerciseField, answer: string): Verdict {
    if (/^\/?\d{1,2}$/.test(answer)) return wrong("prefixInsteadOfMask");
    const value = parseIpv4(answer);
    if (value === null) return wrong(ipv4Problem(answer));
    if (!isMask(value)) return wrong(maskProblem(value));
    return compare(f, value === parseIpv4(f.solution), v => parseIpv4(v) === value);
}

function checkNetmask(f: ExerciseField, answer: string): Verdict {
    const solution = parsePrefixOrMask(f.solution);
    const match = /^\/?(\d+)$/.exec(answer);
    let prefix: number;
    if (match) {
        prefix = Number(match[1]);
        if (prefix > 32) return wrong("prefixRange");
    } else {
        const value = parseIpv4(answer);
        if (value === null) return wrong(ipv4Problem(answer));
        if (!isMask(value)) return wrong(maskProblem(value));
        prefix = maskToPrefix(value)!;
    }
    return compare(f, solution.ok && prefix === solution.value, v => {
        const trap = parsePrefixOrMask(v);
        return trap.ok && trap.value === prefix;
    });
}

function checkWildcard(f: ExerciseField, answer: string): Verdict {
    const value = parseIpv4(answer);
    if (value === null) return wrong(/^\/?\d{1,2}$/.test(answer) ? "format" : ipv4Problem(answer));
    if (!isMask(~value >>> 0)) return wrong(isMask(value) ? "isMask" : "wildcardNotContiguous");
    return compare(f, value === parseIpv4(f.solution), v => parseIpv4(v) === value);
}

/** Uses the raw input because the space between address and mask matters. */
function checkCidr(f: ExerciseField, raw: string): Verdict {
    const parsed = parseCidr(raw.trim());
    if (!parsed.ok) {
        switch (parsed.error) {
            case "empty": return wrong("cidrPrefix");
            case "address": return wrong(ipv4Problem(raw.trim().split(/[\s/]/)[0]));
            case "prefix": return wrong("prefixRange");
            case "maskNotContiguous": return wrong("maskNotContiguous");
            default: return wrong("format");
        }
    }
    const { address, prefix } = parsed.value;
    const solution = parseCidr(f.solution);
    if (!solution.ok) return wrong("wrong");
    if (address === solution.value.address && prefix === solution.value.prefix) return right();
    if (networkOf(address, prefix) !== address) return wrong("hostBits");
    return wrong(trapTip(f, v => {
        const trap = parseCidr(v);
        return trap.ok && trap.value.address === address && trap.value.prefix === prefix;
    }));
}

function checkInteger(f: ExerciseField, answer: string): Verdict {
    const value = parseInteger(answer);
    if (value === null) return wrong("format");
    return compare(f, value === parseInteger(f.solution), v => parseInteger(v) === value);
}

function parseHex(text: string): number | null {
    const match = /^(?:0x)?([0-9a-f]{1,4})$/i.exec(text);
    return match ? parseInt(match[1], 16) : null;
}

function checkHex(f: ExerciseField, answer: string): Verdict {
    const value = parseHex(answer);
    if (value === null) return wrong("format");
    return compare(f, value === parseHex(f.solution), v => parseHex(v) === value);
}

const CHOICE_WORDS: Record<string, string> = { ja: "yes", j: "yes", y: "yes", true: "yes", nein: "no", n: "no", false: "no" };

function checkChoice(f: ExerciseField, answer: string): Verdict {
    const text = answer.toLowerCase();
    const value = CHOICE_WORDS[text] ?? f.options?.find(o => o.toLowerCase() === text);
    if (value === undefined || !f.options?.includes(value)) return wrong("notAnOption");
    return compare(f, value === f.solution || !!f.accepted?.includes(value), v => v === value);
}

/** Says why `text` is not an IPv6 address. */
function ipv6Problem(text: string): Tip {
    if (text.includes("/")) return "prefixSuffix";
    if (/[^0-9a-f:.]/i.test(text)) return "ipv6Hex";
    if (text.includes(":::") || text.split("::").length > 2) return "ipv6DoubleColon";
    if (text.split(":").some(g => g.length > 4 && !g.includes("."))) return "ipv6GroupLength";
    return "ipv6Groups";
}

/** Why a correct but not canonical short form is not RFC 5952; `tieFirst` means it is as short as possible. */
function shorteningProblem(text: string, value: number[]): Tip {
    const halves = text.split("::");
    const written = halves.flatMap(h => h ? h.split(":") : []);
    if (written.some(g => g.length > 1 && g.startsWith("0"))) return "leadingZeros";
    const runs: { start: number; length: number }[] = [];
    for (let i = 0; i < 8; i++) {
        if (value[i] !== 0) continue;
        let j = i;
        while (j < 8 && value[j] === 0) j++;
        runs.push({ start: i, length: j - i });
        i = j;
    }
    const longest = Math.max(0, ...runs.map(r => r.length));
    if (halves.length === 1) return longest >= 2 ? "notShortened" : "leadingZeros";
    const compressed = 8 - written.length;
    if (compressed === 1) return "singleZero";
    if (compressed < longest) return "longestRun";
    return "tieFirst";
}

function checkIpv6(f: ExerciseField, answer: string): Verdict {
    const value = parseIpv6(answer);
    if (!value) return wrong(ipv6Problem(answer));
    const solution = parseIpv6(f.answer === "ipv6Net" ? f.solution.split("/")[0] : f.solution);
    if (!solution || expandIpv6(value) !== expandIpv6(solution)) return wrong("wrong");
    const lower = answer.toLowerCase();
    if (f.answer === "ipv6Full") return /^([0-9a-f]{4}:){7}[0-9a-f]{4}$/.test(lower) ? right() : wrong("notExpanded");
    if (f.answer === "ipv6Any") return right();
    if (lower === f.solution) return right(answer === lower ? undefined : "lowerCase");
    const problem = shorteningProblem(lower, value);
    return problem === "tieFirst" ? right("tieFirst") : wrong(problem);
}

function checkIpv6Net(f: ExerciseField, answer: string): Verdict {
    const [ networkText, prefixText ] = f.solution.split("/");
    const prefix = Number(prefixText);
    const parts = answer.split("/");
    if (parts.length > 2) return wrong("format");
    if (parts.length === 2 && Number(parts[1]) !== prefix) return wrong(/^\d{1,3}$/.test(parts[1]) ? "ipv6PrefixLength" : "format");
    const value = parseIpv6(parts[0]);
    if (!value) return wrong(ipv6Problem(parts[0]));
    const solution = expandIpv6(parseIpv6(networkText)!);
    if (expandIpv6(value) === solution) return right();
    return wrong(expandIpv6(ipv6Network(value, prefix)) === solution ? "hostBits6" : trapTip(f, v => {
        const trap = parseIpv6(v.split("/")[0]);
        return !!trap && expandIpv6(trap) === expandIpv6(value);
    }));
}

function parseIid(text: string): number[] | null {
    const groups = text.toLowerCase().replace(/^::/, "").split(":");
    if (groups.length !== 4 || groups.some(g => !/^[0-9a-f]{1,4}$/.test(g))) return null;
    return groups.map(g => parseInt(g, 16));
}

function checkIid(f: ExerciseField, answer: string): Verdict {
    const value = parseIid(answer);
    if (!value) return wrong("format");
    const same = (v: string): boolean => parseIid(v)?.join() === value.join();
    return compare(f, same(f.solution), same);
}

const CHECKS: Record<Exclude<AnswerKind, "cidr">, (f: ExerciseField, answer: string) => Verdict> = {
    ipv4: checkIpv4,
    prefix: checkPrefix,
    mask: checkMask,
    netmask: checkNetmask,
    wildcard: checkWildcard,
    integer: checkInteger,
    hex: checkHex,
    choice: checkChoice,
    ipv6Short: checkIpv6,
    ipv6Full: checkIpv6,
    ipv6Any: checkIpv6,
    ipv6Net: checkIpv6Net,
    iid: checkIid,
};

/** Never throws: every input, however broken, gets a verdict and a tip. */
export function checkField(f: ExerciseField, input: string): FieldResult {
    const raw = typeof input === "string" ? input : "";
    const answer = raw.replace(/\s+/g, "");
    let verdict: Verdict;
    if (!answer) verdict = wrong("empty");
    else if (f.answer === "cidr") verdict = checkCidr(f, raw);
    else verdict = CHECKS[f.answer](f, answer);
    const result: FieldResult = { id: f.id, correct: verdict.correct, tip: verdict.correct ? null : verdict.tip };
    if (verdict.note) result.note = verdict.note;
    return result;
}

/**
 * VLSM plans from a scenario: every prefix must be the smallest that fits, but any network is accepted
 * that is aligned to its block, lies inside the given network and overlaps no other segment.
 */
export function checkPlan(exercise: Exercise, answers: Record<string, string>): FieldResult[] {
    const task = exercise.task;
    if (task.kind !== "vlsmScenario") return exercise.fields.map(f => checkField(f, answers[f.id] ?? ""));
    const base = { network: parseIpv4(task.network)!, prefix: task.prefix };
    const results = exercise.fields.map(f => checkField(f, answers[f.id] ?? ""));
    const blocks = task.segments.map((_, k) => {
        const networkField = exercise.fields.findIndex(f => f.key === "network" && f.group === k);
        const prefixField = exercise.fields.findIndex(f => f.key === "prefix" && f.group === k);
        const prefix = prefixForHosts(segmentNeed(task.segments[k], task.reserve))!;
        const typed = (answers[exercise.fields[networkField].id] ?? "").replace(/\s+/g, "").replace(/\/\d{1,2}$/, "");
        return { networkField, prefixField, prefix, network: parseIpv4(typed) };
    });
    for (const [ k, b ] of blocks.entries()) {
        if (b.network === null) continue;
        const result = results[b.networkField];
        const own = { network: b.network, prefix: b.prefix };
        const tip: Tip | null = networkOf(b.network, b.prefix) !== b.network ? "planAligned"
            : b.network < base.network || b.network + blockSize(b.prefix) > base.network + blockSize(base.prefix) ? "planOutside"
                : blocks.some((o, j) => j !== k && o.network !== null && networkOf(o.network, o.prefix) === o.network && overlaps(own, { network: o.network, prefix: o.prefix })) ? "planOverlap"
                    : null;
        results[b.networkField] = { id: result.id, correct: tip === null, tip };
    }
    return results;
}

/** Hosts including a reserve in percent, rounded up. */
export function withReserve(hosts: number, reserve: number): number {
    return Math.ceil(hosts * (100 + reserve) / 100);
}

/** WAN links between two routers never get a reserve. */
export function segmentNeed(segment: { id: DepartmentId; hosts: number }, reserve: number): number {
    return segment.id === "wan1" || segment.id === "wan2" ? segment.hosts : withReserve(segment.hosts, reserve);
}
