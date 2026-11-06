import type { DepartmentId, DeviceId, Exercise, MistakeId } from "./exercises";
import { analyzeIpv4, blockSize, formatIpv4, networkOf, parseCidr, parseIpv4, prefixForHosts, prefixToMask } from "./ipv4";
import { type Ipv6Kind, eui64, expandIpv6, ipv6Kind, parseIpv6, parseMac, shortenIpv6 } from "./ipv6";
import { segmentNeed } from "./answers";

export type BinaryLabel = "address" | "mask" | "network" | "broadcast" | "wildcard" | "first" | "last" | DeviceId;

/** One line of the worked solution; the UI turns it into text. */
export type Step =
    | { kind: "binary"; prefix: number; rows: { label: BinaryLabel; value: number }[] }
    /** `octet` counts from 1; `maskValue` is the mask in that octet */
    | { kind: "block"; octet: number; maskValue: number; size: number }
    | { kind: "multiple"; octet: number; value: number; size: number; start: number }
    | { kind: "broadcast"; next: string; broadcast: string }
    | { kind: "hostFormula"; bits: number; hosts: number }
    | { kind: "range"; first: string; last: string }
    | { kind: "maskBits"; prefix: number; mask: string }
    | { kind: "borrow"; count: number; bits: number; prefix: number; subnets: number }
    | { kind: "needBits"; hosts: number; bits: number; prefix: number }
    | { kind: "nth"; nth: number; size: number; network: string }
    | { kind: "index"; offset: number; size: number; index: number }
    | { kind: "compare"; same: boolean }
    | { kind: "wildcard"; mask: string; wildcard: string }
    | { kind: "commonBits"; first: string; last: string; prefix: number }
    | { kind: "fit"; prefix: number; target: number; count: string }
    | { kind: "reserve"; percent: number }
    | { kind: "allocate"; id: DepartmentId; hosts: number; prefix: number; network: string }
    | { kind: "mistake"; mistake: MistakeId }
    | { kind: "ipv6Cut"; prefix: number; network: string }
    | { kind: "ipv6Short"; full: string; short: string }
    | { kind: "subnetId"; bits: number; id: string }
    | { kind: "ipv6Count"; bits: number; count: string }
    | { kind: "ipv6Nth"; nth: number; hex: string }
    | { kind: "ipv6Type"; type: Ipv6Kind }
    | { kind: "eui64"; mac: string; flipped: string; iid: string };

const ip = formatIpv4;

/** The octet in which the network changes, its mask value and the block size there. */
function blockStep(prefix: number): Step {
    const octet = Math.min(4, Math.max(1, Math.ceil(prefix / 8)));
    const maskValue = (prefixToMask(prefix) >>> (32 - octet * 8)) & 255;
    return { kind: "block", octet, maskValue, size: 256 - maskValue };
}

function networkSteps(address: number, prefix: number): Step[] {
    const info = analyzeIpv4(address, prefix);
    const block = blockStep(prefix);
    const steps: Step[] = [
        { kind: "binary", prefix, rows: [{ label: "address", value: address }, { label: "mask", value: info.mask }, { label: "network", value: info.network }, ...(info.broadcast === null ? [] : [{ label: "broadcast" as const, value: info.broadcast }]) ] },
        block,
    ];
    if (block.kind === "block" && block.size > 1) {
        const shift = 32 - block.octet * 8;
        steps.push({ kind: "multiple", octet: block.octet, value: (address >>> shift) & 255, size: block.size, start: (info.network >>> shift) & 255 });
    }
    if (info.broadcast !== null) steps.push({ kind: "broadcast", next: ip((info.broadcast + 1) >>> 0), broadcast: ip(info.broadcast) });
    return steps;
}

const hostFormula = (prefix: number): Step => ({ kind: "hostFormula", bits: 32 - prefix, hosts: blockSize(prefix) - 2 });

const maskBits = (prefix: number): Step => ({ kind: "maskBits", prefix, mask: ip(prefixToMask(prefix)) });

function needBits(hosts: number): Step {
    const prefix = prefixForHosts(hosts)!;
    return { kind: "needBits", hosts, bits: 32 - prefix, prefix };
}

function borrow(count: number, prefix: number): Step {
    const bits = Math.ceil(Math.log2(count));
    return { kind: "borrow", count, bits, prefix: prefix + bits, subnets: 2 ** bits };
}

function solution(exercise: Exercise, id: string): string {
    return exercise.fields.find(f => f.id === id)?.solution ?? "";
}

/** Worked solution of an exercise, step by step. */
export function explain(exercise: Exercise): Step[] {
    const task = exercise.task;
    switch (task.kind) {
        case "networkBroadcast":
            return networkSteps(parseIpv4(task.address)!, task.prefix);
        case "hostRange": {
            const info = analyzeIpv4(parseIpv4(task.address)!, task.prefix);
            return [ ...networkSteps(info.address, task.prefix), { kind: "range", first: ip(info.firstHost), last: ip(info.lastHost) }, hostFormula(task.prefix) ];
        }
        case "hostCount":
            return [ maskBits(task.prefix), hostFormula(task.prefix) ];
        case "maskToPrefix":
        case "prefixToMask": {
            const prefix = task.kind === "prefixToMask" ? task.prefix : Number(solution(exercise, "prefix").slice(1));
            return [ maskBits(prefix), { kind: "binary", prefix, rows: [{ label: "mask", value: prefixToMask(prefix) }] }];
        }
        case "split": {
            const step = borrow(task.count, task.prefix);
            const prefix = task.prefix + Math.ceil(Math.log2(task.count));
            const network = solution(exercise, "network"), broadcast = solution(exercise, "broadcast");
            return [ step, { kind: "nth", nth: task.nth, size: blockSize(prefix), network }, { kind: "broadcast", next: ip(parseIpv4(broadcast)! + 1), broadcast }];
        }
        case "vlsm":
        case "vlsmScenario": {
            const segments = task.kind === "vlsm" ? task.departments : task.segments;
            const reserve = task.kind === "vlsmScenario" ? task.reserve : 0;
            const steps: Step[] = reserve ? [{ kind: "reserve", percent: reserve }] : [];
            const allocations = segments.map((s, k) => ({ id: s.id, hosts: segmentNeed(s, reserve), prefix: Number(solution(exercise, `prefix${k}`).slice(1)), network: solution(exercise, `network${k}`) }));
            allocations.sort((a, b) => parseIpv4(a.network)! - parseIpv4(b.network)!);
            return [ ...steps, ...allocations.map(a => ({ kind: "allocate" as const, ...a })) ];
        }
        case "ipv6Shorten":
        case "ipv6Expand": {
            const value = parseIpv6(task.address)!;
            return [{ kind: "ipv6Short", full: expandIpv6(value), short: shortenIpv6(value) }];
        }
        case "ipv6Subnets":
            return [{ kind: "ipv6Count", bits: task.target - task.prefix, count: solution(exercise, "subnetCount") }];
        case "hostSubnet": {
            const host = parseIpv4(task.host)!, base = parseIpv4(task.network)!;
            const size = blockSize(task.subPrefix);
            const network = networkOf(host, task.subPrefix);
            return [ ...networkSteps(host, task.subPrefix), { kind: "index", offset: network - base, size, index: (network - base) / size + 1 }];
        }
        case "sameSubnet": {
            const [ a, b ] = task.hosts.map(h => parseIpv4(h.address)!);
            return [
                { kind: "binary", prefix: task.prefix, rows: [{ label: task.hosts[0].id, value: a }, { label: task.hosts[1].id, value: b }, { label: "mask", value: prefixToMask(task.prefix) }] },
                blockStep(task.prefix),
                { kind: "compare", same: networkOf(a, task.prefix) === networkOf(b, task.prefix) },
            ];
        }
        case "hostsToPrefix":
            return [ needBits(task.hosts), hostFormula(prefixForHosts(task.hosts)!) ];
        case "subnetsToPrefix": {
            const step = borrow(task.count, task.prefix);
            return [ step, hostFormula(task.prefix + Math.ceil(Math.log2(task.count))) ];
        }
        case "reverseMask": {
            const first = parseIpv4(task.network)!, last = parseIpv4(task.broadcast)!;
            const prefix = Number(solution(exercise, "netmask").slice(1));
            return [{ kind: "binary", prefix, rows: [{ label: "network", value: first }, { label: "broadcast", value: last }] }, { kind: "commonBits", first: task.network, last: task.broadcast, prefix }, hostFormula(prefix) ];
        }
        case "wildcard": {
            const mask = prefixToMask(task.prefix);
            return [ maskBits(task.prefix), { kind: "wildcard", mask: ip(mask), wildcard: task.wildcard }, { kind: "binary", prefix: task.prefix, rows: [{ label: "mask", value: mask }, { label: "wildcard", value: ~mask >>> 0 }] }];
        }
        case "summarize": {
            const blocks = task.networks.map(n => parseCidr(n)).flatMap(r => r.ok ? [ r.value ] : []);
            const first = Math.min(...blocks.map(b => b.address));
            const last = Math.max(...blocks.map(b => b.address + blockSize(b.prefix) - 1));
            const summary = parseCidr(solution(exercise, "summary"));
            const prefix = summary.ok ? summary.value.prefix : 0;
            return [{ kind: "binary", prefix, rows: [{ label: "first", value: first }, { label: "last", value: last }] }, { kind: "commonBits", first: ip(first), last: ip(last), prefix }];
        }
        case "routeContents":
            return [{ kind: "fit", prefix: task.prefix, target: task.target, count: solution(exercise, "subnetCount") }, blockStep(task.target) ];
        case "findMistake":
            return [{ kind: "mistake", mistake: solution(exercise, "mistake") as MistakeId }];
        case "ipv6Prefix": {
            const steps: Step[] = [{ kind: "ipv6Cut", prefix: task.prefix, network: solution(exercise, "ipv6Network") }];
            if (task.site !== null) steps.push({ kind: "subnetId", bits: task.prefix - task.site, id: solution(exercise, "subnetId") });
            return steps;
        }
        case "ipv6NthSubnet":
            return [{ kind: "ipv6Nth", nth: task.nth, hex: (task.nth - 1).toString(16) }, { kind: "ipv6Count", bits: 64 - task.prefix, count: (2n ** BigInt(64 - task.prefix)).toString() }];
        case "ipv6Type":
            return [{ kind: "ipv6Type", type: ipv6Kind(parseIpv6(task.address)!) }];
        case "eui64": {
            const mac = parseMac(task.mac)!;
            const flipped = [ mac[0] ^ 0x02, ...mac.slice(1) ];
            const hex = (bytes: number[]): string => bytes.map(b => b.toString(16).padStart(2, "0")).join(":");
            return [{ kind: "eui64", mac: hex(mac), flipped: hex(flipped), iid: eui64(mac).map(g => g.toString(16).padStart(4, "0")).join(":") }];
        }
    }
}
