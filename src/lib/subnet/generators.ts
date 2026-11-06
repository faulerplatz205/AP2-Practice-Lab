import { analyzeIpv4, blockSize, formatIpv4, networkOf, parseIpv4, prefixForHosts, prefixToMask } from "./ipv4";
import { type Block, splitEqual, summarizeBlocks, vlsm } from "./divide";
import { type Ipv6, eui64, expandIpv6, ipv6Kind, ipv6Network, shortenIpv6, subnetCount } from "./ipv6";
import { segmentNeed, withReserve } from "./answers";
import { type Random, chance, int, pick, shuffled } from "./random";
import type {
    AnswerKind, DepartmentId, DeviceConfig, DeviceId, Difficulty, Exercise, ExerciseField, ExerciseKind, FieldKey, MistakeId, PlanEntry, ScenarioId, Tip, Trap,
} from "./exercises";

type Generator = (random: Random, level: Difficulty) => Exercise;

const ip = formatIpv4;

const cidr = (network: number, prefix: number): string => `${ip(network)}/${prefix}`;

const trap = (value: string, tip: Tip): Trap => ({ value, tip });

const variant = (random: Random): number => int(random, 0, 11);

function field(key: FieldKey, answer: AnswerKind, solution: string, extra: Omit<Partial<ExerciseField>, "id" | "key" | "answer" | "solution"> = {}): ExerciseField {
    return { id: extra.group === undefined ? key : `${key}${extra.group}`, key, answer, solution, ...extra };
}

const PRIVATE: Block[] = [ "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16" ].map(text => {
    const [ address, prefix ] = text.split("/");
    return { network: parseIpv4(address)!, prefix: Number(prefix) };
});

/** First octets of class A, B and C that are neither private nor special. */
const PUBLIC_FIRST_OCTETS = [ 2, 5, 31, 46, 62, 77, 81, 85, 91, 94, 109, 130, 134, 141, 145, 151, 176, 178, 185, 193, 195, 212, 217 ];

/** Address inside a range that still leaves room for `prefix`; on hard levels sometimes a public one. */
function randomAddress(random: Random, level: Difficulty, prefix: number): number {
    if (level === "hard" && chance(random, 0.3)) return ((pick(random, PUBLIC_FIRST_OCTETS) << 24) >>> 0) + int(random, 0, 2 ** 24 - 1);
    const ranges = PRIVATE.filter(r => r.prefix < prefix);
    const range = pick(random, ranges.length ? ranges : PRIVATE.slice(0, 1));
    return range.network + int(random, 0, blockSize(range.prefix) - 1);
}

function randomNetwork(random: Random, level: Difficulty, prefix: number): number {
    return networkOf(randomAddress(random, level, prefix), prefix);
}

/** Usable host address (not network, not broadcast) of a subnet with `prefix` ≤ 30. */
function hostIn(random: Random, network: number, prefix: number): number {
    return network + int(random, 1, blockSize(prefix) - 2);
}

/** Easy stays in the 4th octet, medium reaches the 3rd, hard mostly the 2nd and 3rd. */
function hostPrefix(random: Random, level: Difficulty): number {
    if (level === "easy") return int(random, 24, 30);
    if (level === "medium") return int(random, 16, 30);
    return chance(random, 0.7) ? int(random, 9, 23) : int(random, 24, 30);
}

const showMask = (random: Random, level: Difficulty): boolean => level !== "easy" && chance(random, 0.35);

/** Hosts that need exactly a block of `size` addresses. */
const hostsFor = (random: Random, size: number): number => int(random, Math.max(1, size / 2 - 1), size - 2);

function networkBroadcast(random: Random, level: Difficulty): Exercise {
    const prefix = hostPrefix(random, level);
    const info = analyzeIpv4(hostIn(random, randomNetwork(random, level, prefix), prefix), prefix);
    const given = ip(info.address), network = ip(info.network), broadcast = ip(info.broadcast!);
    return {
        task: { kind: "networkBroadcast", address: given, prefix, showMask: showMask(random, level), variant: variant(random) },
        fields: [
            field("network", "ipv4", network, { prefix, traps: [ trap(broadcast, "isBroadcast"), trap(given, "isGivenAddress") ] }),
            field("broadcast", "ipv4", broadcast, { traps: [ trap(network, "isNetwork"), trap(ip((info.broadcast! + 1) >>> 0), "isNextNetwork"), trap(given, "isGivenAddress") ] }),
        ],
    };
}

function hostRange(random: Random, level: Difficulty): Exercise {
    const prefix = Math.min(30, hostPrefix(random, level) + (level === "hard" ? 0 : 1));
    const info = analyzeIpv4(hostIn(random, randomNetwork(random, level, prefix), prefix), prefix);
    return {
        task: { kind: "hostRange", address: ip(info.address), prefix, showMask: showMask(random, level), variant: variant(random) },
        fields: [
            field("firstHost", "ipv4", ip(info.firstHost), { traps: [ trap(ip(info.network), "isNetwork") ] }),
            field("lastHost", "ipv4", ip(info.lastHost), { traps: [ trap(ip(info.broadcast!), "isBroadcast") ] }),
            field("hosts", "integer", String(info.usableHosts), { traps: [ trap(String(info.totalAddresses), "countedAll") ] }),
        ],
    };
}

function hostCount(random: Random, level: Difficulty): Exercise {
    const prefix = level === "easy" ? int(random, 24, 30) : level === "medium" ? int(random, 18, 30) : int(random, 9, 30);
    const mask = level !== "easy" && chance(random, level === "hard" ? 0.7 : 0.5) ? ip(prefixToMask(prefix)) : null;
    return {
        task: { kind: "hostCount", prefix, mask, variant: variant(random) },
        fields: [ field("hosts", "integer", String(2 ** (32 - prefix) - 2), { traps: [ trap(String(2 ** (32 - prefix)), "countedAll") ] }) ],
    };
}

function maskPrefix(random: Random, level: Difficulty): number {
    if (level === "easy") return pick(random, [ 8, 16, 24, 25, 26, 27, 28, 29, 30 ]);
    return level === "medium" ? int(random, 16, 30) : int(random, 9, 23);
}

function maskToPrefixTask(random: Random, level: Difficulty): Exercise {
    const prefix = maskPrefix(random, level);
    return { task: { kind: "maskToPrefix", mask: ip(prefixToMask(prefix)), variant: variant(random) }, fields: [ field("prefix", "prefix", `/${prefix}`) ] };
}

function prefixToMaskTask(random: Random, level: Difficulty): Exercise {
    const prefix = maskPrefix(random, level);
    return {
        task: { kind: "prefixToMask", prefix, variant: variant(random) },
        fields: [ field("mask", "mask", ip(prefixToMask(prefix)), { traps: [ trap(ip(~prefixToMask(prefix) >>> 0), "isWildcard") ] }) ],
    };
}

function split(random: Random, level: Difficulty): Exercise {
    const prefix = level === "easy" ? 24 : level === "medium" ? pick(random, [ 16, 24 ]) : int(random, 12, 22);
    const network = randomNetwork(random, level === "hard" ? "medium" : level, prefix);
    const count = int(random, level === "easy" ? 2 : 3, level === "easy" ? 8 : level === "medium" ? 14 : 60);
    const nth = int(random, 2, count);
    const result = splitEqual(network, prefix, count);
    if (!result.ok) throw new Error("split exercise out of range");
    const subnet = result.subnets[nth - 1];
    return {
        task: { kind: "split", network: ip(network), prefix, count, nth, variant: variant(random) },
        fields: [
            field("prefix", "netmask", `/${result.prefix}`),
            field("network", "ipv4", ip(subnet.network), { prefix: result.prefix, traps: [ trap(ip(subnet.network - blockSize(result.prefix)), "zeroBased") ] }),
            field("broadcast", "ipv4", ip(subnet.broadcast!), { traps: [ trap(ip(subnet.broadcast! + 1), "isNextNetwork") ] }),
        ],
    };
}

function vlsmTask(random: Random, level: Difficulty): Exercise {
    const pool = level === "easy" ? [ 64, 32, 16, 8 ] : level === "medium" ? [ 128, 64, 32, 16, 8 ] : [ 128, 64, 32, 16, 8, 4 ];
    const blocks = shuffled(random, pool).slice(0, level === "hard" ? 4 : 3);
    const ids = shuffled(random, [ "sales", "it", "admin", "production", "support", "marketing", "purchasing", "management" ] as const).slice(0, blocks.length);
    const departments = ids.map((id, k) => ({ id, hosts: hostsFor(random, blocks[k]) }));
    const network = networkOf(parseIpv4("192.168.0.0")! + int(random, 0, 255) * 256, 24);
    const result = vlsm(network, 24, departments.map(d => ({ name: d.id, hosts: d.hosts })));
    const fields = departments.flatMap((_, k) => {
        const a = result.allocations.find(x => x.index === k)!;
        return [ field("network", "ipv4", ip(a.network), { group: k, prefix: a.prefix }), field("prefix", "netmask", `/${a.prefix}`, { group: k }) ];
    });
    return { task: { kind: "vlsm", network: ip(network), prefix: 24, departments, variant: variant(random) }, fields };
}

/** A group without zeros, sometimes with leading zeros in the full form. */
function busyGroup(random: Random): number {
    const roll = random();
    return roll < 0.4 ? int(random, 1, 0xff) : roll < 0.7 ? int(random, 0x100, 0xfff) : int(random, 0x1000, 0xffff);
}

/** Groups such as 0100 or 3000, where only the leading zeros may go. */
const innerZeroGroup = (random: Random): number => int(random, 1, 15) << (4 * int(random, 1, 3));

function randomIpv6(random: Random, level: Difficulty): Ipv6 {
    const groups = [ 0x2001, 0x0db8, ...Array.from({ length: 6 }, () => busyGroup(random)) ];
    if (level === "hard") {
        const pattern = int(random, 0, 3);
        if (pattern === 0) {
            const first = int(random, 2, 3);
            groups[first] = groups[first + 1] = groups[6] = groups[7] = 0;
        } else if (pattern === 1) {
            groups[2] = 0;
            groups[4] = groups[5] = groups[6] = 0;
        } else if (pattern === 2) {
            groups[2] = innerZeroGroup(random);
            groups[7] = innerZeroGroup(random);
            groups[4] = groups[5] = 0;
        } else {
            groups.splice(0, 8, 0xfe80, 0, 0, 0, busyGroup(random), busyGroup(random), busyGroup(random), busyGroup(random));
        }
        return groups;
    }
    const runLength = level === "easy" ? int(random, 2, 4) : int(random, 2, 5);
    const runStart = int(random, 2, 8 - runLength);
    for (let k = runStart; k < runStart + runLength; k++) groups[k] = 0;
    if (level === "medium" && chance(random, 0.5)) groups[runStart > 3 ? 2 : 7] = 0;
    return groups;
}

function ipv6Shorten(random: Random, level: Difficulty): Exercise {
    const address = randomIpv6(random, level);
    return { task: { kind: "ipv6Shorten", address: expandIpv6(address), variant: variant(random) }, fields: [ field("ipv6Short", "ipv6Short", shortenIpv6(address)) ] };
}

function ipv6Expand(random: Random, level: Difficulty): Exercise {
    const address = randomIpv6(random, level);
    const short = shortenIpv6(address);
    return {
        task: { kind: "ipv6Expand", address: level === "hard" && chance(random, 0.5) ? short.toUpperCase() : short, variant: variant(random) },
        fields: [ field("ipv6Full", "ipv6Full", expandIpv6(address)) ],
    };
}

function ipv6Subnets(random: Random, level: Difficulty): Exercise {
    const [ prefix, target ] = level === "easy"
        ? pick(random, [[ 48, 64 ], [ 56, 64 ], [ 60, 64 ]])
        : level === "medium" ? pick(random, [[ 32, 48 ], [ 40, 48 ], [ 48, 56 ], [ 48, 64 ], [ 56, 64 ], [ 32, 56 ]])
            : pick(random, [[ 44, 64 ], [ 52, 64 ], [ 47, 64 ], [ 29, 48 ], [ 48, 62 ], [ 36, 60 ]]);
    const groups = ipv6Network([ 0x2001, 0x0db8, int(random, 0, 0xffff), int(random, 0, 0xffff), 0, 0, 0, 0 ], prefix);
    const count = subnetCount(prefix, target).toString();
    return {
        task: { kind: "ipv6Subnets", network: shortenIpv6(groups), prefix, target, variant: variant(random) },
        fields: [ field("subnetCount", "integer", count, { traps: [ trap(String(target - prefix), "isExponent") ] }) ],
    };
}

function hostSubnet(random: Random, level: Difficulty): Exercise {
    const prefix = level === "easy" ? 24 : level === "medium" ? pick(random, [ 16, 20, 22, 24 ]) : int(random, 12, 20);
    const subPrefix = Math.min(30, prefix + (level === "easy" ? int(random, 1, 4) : level === "medium" ? int(random, 2, 6) : int(random, 3, 8)));
    const base = randomNetwork(random, level === "hard" ? "medium" : level, prefix);
    const index = int(random, 1, 2 ** (subPrefix - prefix));
    const network = base + (index - 1) * blockSize(subPrefix);
    const host = hostIn(random, network, subPrefix);
    const broadcast = network + blockSize(subPrefix) - 1;
    return {
        task: { kind: "hostSubnet", network: ip(base), prefix, subPrefix, host: ip(host), variant: variant(random) },
        fields: [
            field("subnetIndex", "integer", String(index), { traps: [ trap(String(index - 1), "zeroBased") ] }),
            field("network", "ipv4", ip(network), { prefix: subPrefix, traps: [ trap(ip(host), "isGivenAddress"), trap(ip(base), "wrong") ] }),
            field("broadcast", "ipv4", ip(broadcast), { traps: [ trap(ip(broadcast + 1), "isNextNetwork") ] }),
        ],
    };
}

const DEVICES: DeviceId[] = [ "pc1", "pc2", "pc3", "laptop", "printer", "server", "phone", "accessPoint" ];

function sameSubnet(random: Random, level: Difficulty): Exercise {
    const prefix = level === "easy" ? pick(random, [ 24, 24, 16 ]) : level === "medium" ? int(random, 25, 29) : int(random, 17, 23);
    const size = blockSize(prefix);
    const own = randomNetwork(random, level === "hard" ? "medium" : level, prefix);
    const same = chance(random, 0.5);
    const range = PRIVATE.find(r => networkOf(own, r.prefix) === r.network)!;
    const neighbours = [ own - size, own + size ].filter(n => networkOf(n, range.prefix) === range.network);
    const other = same ? own : pick(random, neighbours);
    const a = hostIn(random, own, prefix);
    let b = hostIn(random, other, prefix);
    while (b === a) b = hostIn(random, other, prefix);
    const ids = shuffled(random, DEVICES).slice(0, 2);
    return {
        task: { kind: "sameSubnet", hosts: [{ id: ids[0], address: ip(a) }, { id: ids[1], address: ip(b) }], prefix, showMask: showMask(random, level), variant: variant(random) },
        fields: [
            field("network", "ipv4", ip(own), { group: 0, prefix, traps: [ trap(ip(a), "isGivenAddress") ] }),
            field("network", "ipv4", ip(other), { group: 1, prefix, traps: [ trap(ip(b), "isGivenAddress") ] }),
            field("same", "choice", same ? "yes" : "no", { options: [ "yes", "no" ] }),
        ],
    };
}

const COMPANY_SEGMENTS: DepartmentId[] = [ "sales", "it", "admin", "production", "support", "marketing", "purchasing", "management", "servers", "voip", "guestWifi" ];

function hostsToPrefix(random: Random, level: Difficulty): Exercise {
    const max = level === "easy" ? 250 : level === "medium" ? 4000 : 60000;
    let hosts = int(random, 3, max);
    if (level !== "easy" && chance(random, level === "hard" ? 0.5 : 0.4)) {
        const bits = int(random, 3, Math.floor(Math.log2(max)));
        hosts = 2 ** bits - pick(random, [ 2, 1 ]);
    }
    const prefix = prefixForHosts(hosts)!;
    const traps = prefix < 30 && 2 ** (32 - prefix - 1) >= hosts ? [ trap(`/${prefix + 1}`, "forgotReserved") ] : [];
    return {
        task: { kind: "hostsToPrefix", hosts, segment: pick(random, COMPANY_SEGMENTS), variant: variant(random) },
        fields: [
            field("netmask", "netmask", `/${prefix}`, { traps }),
            field("hosts", "integer", String(2 ** (32 - prefix) - 2), { traps: [ trap(String(2 ** (32 - prefix)), "countedAll") ] }),
        ],
    };
}

function subnetsToPrefix(random: Random, level: Difficulty): Exercise {
    const prefix = level === "easy" ? 24 : level === "medium" ? pick(random, [ 16, 24 ]) : int(random, 9, 22);
    const count = int(random, 2, Math.min(level === "easy" ? 8 : level === "medium" ? 30 : 500, 2 ** (28 - prefix)));
    const network = randomNetwork(random, level === "hard" ? "medium" : level, prefix);
    const bits = Math.ceil(Math.log2(count));
    const newPrefix = prefix + bits;
    const hosts = 2 ** (32 - newPrefix) - 2;
    const minHosts = level !== "easy" && chance(random, 0.5) ? int(random, Math.max(2, Math.floor(hosts / 3)), hosts) : null;
    return {
        task: { kind: "subnetsToPrefix", network: ip(network), prefix, count, minHosts, variant: variant(random) },
        fields: [
            field("netmask", "netmask", `/${newPrefix}`),
            field("subnetCount", "integer", String(2 ** bits)),
            field("hosts", "integer", String(hosts), { traps: [ trap(String(hosts + 2), "countedAll") ] }),
        ],
    };
}

function reverseMask(random: Random, level: Difficulty): Exercise {
    const prefix = hostPrefix(random, level);
    const network = randomNetwork(random, level, prefix);
    const total = blockSize(prefix);
    return {
        task: { kind: "reverseMask", network: ip(network), broadcast: ip(network + total - 1), variant: variant(random) },
        fields: [
            field("netmask", "netmask", `/${prefix}`),
            field("hosts", "integer", String(total - 2), { traps: [ trap(String(total), "countedAll") ] }),
        ],
    };
}

function wildcard(random: Random, level: Difficulty): Exercise {
    const prefix = hostPrefix(random, level);
    const network = randomNetwork(random, level, prefix);
    const reverse = level === "hard" ? chance(random, 0.5) : level === "medium" && chance(random, 0.3);
    const mask = prefixToMask(prefix), wildcardValue = ip(~mask >>> 0);
    const fields = reverse
        ? [ field("netmask", "netmask", `/${prefix}`), field("hosts", "integer", String(blockSize(prefix) - 2), { traps: [ trap(String(blockSize(prefix)), "countedAll") ] }) ]
        : [ field("wildcard", "wildcard", wildcardValue) ];
    return { task: { kind: "wildcard", network: ip(network), prefix, wildcard: wildcardValue, reverse, variant: variant(random) }, fields };
}

/** Splits `block` into `count` aligned pieces of at most `maxPrefix`. */
function partition(random: Random, block: Block, count: number, maxPrefix: number, equal: boolean): Block[] {
    if (equal) {
        const bits = Math.ceil(Math.log2(count));
        return Array.from({ length: 2 ** bits }, (_, k) => ({ network: block.network + k * blockSize(block.prefix + bits), prefix: block.prefix + bits }));
    }
    let pieces = [ block ];
    while (pieces.length < count) {
        const splittable = pieces.filter(p => p.prefix < maxPrefix);
        if (!splittable.length) break;
        const piece = pick(random, splittable);
        const half = { prefix: piece.prefix + 1 };
        pieces = pieces.flatMap(p => p === piece ? [{ network: p.network, ...half }, { network: p.network + blockSize(half.prefix), ...half }] : [ p ]);
    }
    return pieces.sort((a, b) => a.network - b.network);
}

function summarize(random: Random, level: Difficulty): Exercise {
    const prefix = level === "easy" ? int(random, 22, 23) : level === "medium" ? int(random, 19, 23) : int(random, 14, 22);
    const block = { network: randomNetwork(random, "medium", prefix), prefix };
    let pieces = level === "easy"
        ? partition(random, block, 2 ** (24 - prefix), 24, true)
        : level === "medium" ? partition(random, block, 2 ** int(random, 1, Math.min(3, 26 - prefix)), 26, true)
            : partition(random, block, int(random, 3, 6), Math.min(26, prefix + 5), false);
    if (level === "hard" && pieces.length > 3 && chance(random, 0.4)) {
        const dropped = int(random, 0, pieces.length - 1);
        pieces = pieces.filter((_, k) => k !== dropped);
    }
    const summary = summarizeBlocks(pieces);
    const shown = level === "hard" ? shuffled(random, pieces) : pieces;
    return {
        task: { kind: "summarize", networks: shown.map(p => cidr(p.network, p.prefix)), variant: variant(random) },
        fields: [ field("summary", "cidr", cidr(summary.network, summary.prefix)) ],
    };
}

function routeContents(random: Random, level: Difficulty): Exercise {
    const prefix = level === "easy" ? int(random, 21, 23) : level === "medium" ? int(random, 16, 23) : int(random, 10, 22);
    const target = level === "easy" ? 24 : Math.min(30, prefix + int(random, 1, level === "medium" ? 6 : 8));
    const network = randomNetwork(random, level === "hard" ? "medium" : level, prefix);
    const count = 2 ** (target - prefix);
    const last = network + (count - 1) * blockSize(target);
    return {
        task: { kind: "routeContents", network: ip(network), prefix, target, variant: variant(random) },
        fields: [
            field("subnetCount", "integer", String(count), { traps: [ trap(String(target - prefix), "isExponent") ] }),
            field("firstNetwork", "ipv4", ip(network), { prefix: target }),
            field("lastNetwork", "ipv4", ip(last), { prefix: target, traps: [ trap(ip(network + blockSize(prefix) - 1), "isBroadcast") ] }),
        ],
    };
}

const DEVICE_MISTAKES: MistakeId[] = [ "gatewayOutside", "broadcastAsHost", "networkAsHost", "wrongMask" ];
const PLAN_MISTAKES: MistakeId[] = [ "overlap", "notAligned", "outside" ];

function deviceMistake(random: Random, level: Difficulty): Exercise {
    const prefix = level === "easy" ? 24 : level === "medium" ? int(random, 25, 28) : int(random, 19, 23);
    const network = randomNetwork(random, level === "hard" ? "medium" : level, prefix);
    const info = analyzeIpv4(network, prefix);
    const gateway = chance(random, 0.5) ? info.firstHost : info.lastHost;
    const ids = shuffled(random, DEVICES).slice(0, level === "easy" ? 3 : 4);
    const used = new Set([ gateway ]);
    const devices: DeviceConfig[] = ids.map(id => {
        let address = hostIn(random, network, prefix);
        while (used.has(address)) address = hostIn(random, network, prefix);
        used.add(address);
        return { id, address: ip(address), prefix, gateway: ip(gateway) };
    });
    const target = int(random, 0, devices.length - 1);
    const mistake = pick(random, level === "easy" ? DEVICE_MISTAKES.slice(0, 3) : DEVICE_MISTAKES);
    const device = devices[target];
    if (mistake === "gatewayOutside") device.gateway = ip(gateway + blockSize(prefix));
    if (mistake === "broadcastAsHost") device.address = ip(info.broadcast!);
    if (mistake === "networkAsHost") device.address = ip(network);
    if (mistake === "wrongMask") device.prefix = prefix - int(random, 1, 2);
    return {
        task: { kind: "findMistake", setting: "devices", devices, showMask: showMask(random, level), variant: variant(random) },
        fields: [
            field("item", "choice", device.id, { options: devices.map(d => d.id) }),
            field("mistake", "choice", mistake, { options: DEVICE_MISTAKES }),
        ],
    };
}

function planMistake(random: Random, level: Difficulty): Exercise {
    const prefix = level === "hard" ? pick(random, [ 22, 23 ]) : 24;
    const total = blockSize(prefix);
    const pool = [ 256, 128, 64, 32, 16, 8 ].filter(b => b < total);
    let blocks: number[];
    do {
        blocks = shuffled(random, pool).slice(0, level === "hard" ? 4 : 3).sort((a, b) => b - a);
    } while (blocks.reduce((s, b) => s + b, 0) + blocks[blocks.length - 1] > total);
    const network = randomNetwork(random, "medium", prefix);
    const ids = shuffled(random, COMPANY_SEGMENTS).slice(0, blocks.length);
    let cursor = network;
    const entries: PlanEntry[] = blocks.map((size, k) => {
        const entry = { id: ids[k], network: ip(cursor), prefix: 32 - Math.log2(size) };
        cursor += size;
        return entry;
    });
    const mistake = pick(random, PLAN_MISTAKES);
    const last = entries.length - 1, size = blocks[last];
    const accepted: string[] = [];
    if (mistake === "overlap") {
        const offset = int(random, 0, blocks[0] / size - 1) * size;
        entries[last].network = ip(network + offset);
        accepted.push(entries[0].id);
    }
    if (mistake === "notAligned") entries[last].network = ip(parseIpv4(entries[last].network)! + size / 2);
    if (mistake === "outside") entries[last].network = ip(parseIpv4(entries[last].network)! + total);
    return {
        task: { kind: "findMistake", setting: "plan", network: ip(network), prefix, entries, variant: variant(random) },
        fields: [
            field("item", "choice", entries[last].id, { options: entries.map(e => e.id), accepted }),
            field("mistake", "choice", mistake, { options: PLAN_MISTAKES }),
        ],
    };
}

function findMistake(random: Random, level: Difficulty): Exercise {
    return level !== "easy" && chance(random, 0.5) ? planMistake(random, level) : deviceMistake(random, level);
}

const SCENARIO_SEGMENTS: Record<ScenarioId, DepartmentId[]> = {
    company: COMPANY_SEGMENTS,
    school: [ "teachers", "pupils", "library", "admin", "guestWifi", "computerLab", "printers", "management" ],
    branches: [ "headquarters", "branchNorth", "branchSouth", "branchEast", "branchWest", "warehouse" ],
};

function vlsmScenario(random: Random, level: Difficulty): Exercise {
    const scenario = pick(random, [ "company", "school", "branches" ] as const);
    const prefix = level === "hard" ? pick(random, [ 22, 23 ]) : 24;
    const total = blockSize(prefix);
    const reserve = level === "easy" ? 0 : pick(random, level === "medium" ? [ 0, 10, 20 ] : [ 10, 20, 25 ]);
    const wans = level === "easy" ? 0 : level === "medium" ? 1 : scenario === "branches" ? 2 : 1;
    const pool = (level === "hard" ? [ 256, 128, 64, 32, 16, 8 ] : [ 128, 64, 32, 16, 8 ]).filter(b => b < total);
    let blocks: number[];
    do {
        blocks = shuffled(random, pool).slice(0, level === "hard" ? 4 : 3);
    } while (blocks.reduce((s, b) => s + b, 0) + 4 * wans > total);
    const ids = shuffled(random, SCENARIO_SEGMENTS[scenario]).slice(0, blocks.length);
    const segments = [
        ...ids.map((id, k) => ({ id, hosts: hostsWithReserve(random, blocks[k], reserve) })),
        ...([ "wan1", "wan2" ] as const).slice(0, wans).map(id => ({ id, hosts: 2 })),
    ];
    const network = randomNetwork(random, "medium", prefix);
    const plan = vlsm(network, prefix, segments.map(s => ({ name: s.id, hosts: segmentNeed(s, reserve) })));
    if (plan.failed.length) throw new Error("vlsm scenario does not fit");
    const fields = segments.flatMap((_, k) => {
        const a = plan.allocations.find(x => x.index === k)!;
        return [ field("network", "ipv4", ip(a.network), { group: k, prefix: a.prefix }), field("prefix", "netmask", `/${a.prefix}`, { group: k }) ];
    });
    return { task: { kind: "vlsmScenario", scenario, name: int(random, 0, 11), network: ip(network), prefix, reserve, segments: segments.map(s => ({ id: s.id, hosts: s.hosts })), variant: variant(random) }, fields };
}

/** Hosts whose need including the reserve fills exactly a block of `size`. WAN links never get a reserve. */
function hostsWithReserve(random: Random, size: number, reserve: number): number {
    const options: number[] = [];
    for (let hosts = 1; hosts <= size; hosts++) if (prefixForHosts(withReserve(hosts, reserve)) === 32 - Math.log2(size)) options.push(hosts);
    return pick(random, options);
}

/** A documentation or unique local /48 site. */
function ipv6Site(random: Random): number[] {
    return chance(random, 0.6)
        ? [ 0x2001, 0x0db8, int(random, 0, 0xffff) ]
        : [ 0xfd00 | int(random, 0, 0xff), int(random, 0, 0xffff), int(random, 0, 0xffff) ];
}

function interfaceId(random: Random): number[] {
    return Array.from({ length: 4 }, () => chance(random, 0.25) ? 0 : busyGroup(random));
}

function ipv6Prefix(random: Random, level: Difficulty): Exercise {
    const address = [ ...ipv6Site(random), int(random, 0, 0xffff), ...interfaceId(random) ];
    const [ prefix, site ] = level === "easy" ? [ 64, null ] : level === "medium" ? [ 64, 48 ] : pick(random, [[ 64, 56 ], [ 52, null ], [ 60, null ], [ 44, null ], [ 56, 48 ]] as const);
    const network = ipv6Network(address, prefix);
    const shown = chance(random, 0.5) ? shortenIpv6(address) : expandIpv6(address);
    const fields = [ field("ipv6Network", "ipv6Net", `${shortenIpv6(network)}/${prefix}`) ];
    if (site !== null) {
        const bits = prefix - site;
        const id = Number((BigInt(network[3]) | BigInt(network[2]) << 16n) >> BigInt(64 - prefix) & ((1n << BigInt(bits)) - 1n));
        fields.push(field("subnetId", "hex", id.toString(16), { traps: [ trap(network[3].toString(16), "subnetIdBits") ] }));
    }
    return { task: { kind: "ipv6Prefix", address: level === "hard" && chance(random, 0.3) ? shown.toUpperCase() : shown, prefix, site, variant: variant(random) }, fields };
}

function ipv6NthSubnet(random: Random, level: Difficulty): Exercise {
    const prefix = level === "easy" ? 56 : level === "medium" ? 48 : pick(random, [ 48, 52, 56 ]);
    const site = ipv6Network([ ...ipv6Site(random), level === "easy" ? int(random, 0, 0xff) << 8 : 0, 0, 0, 0, 0 ], prefix);
    const max = Math.min(2 ** (64 - prefix), level === "easy" ? 16 : level === "medium" ? 300 : 4096);
    const nth = int(random, 2, max);
    const at = (n: number): string => `${shortenIpv6(site.map((g, k) => k === 3 ? g + n - 1 : g))}/64`;
    return {
        task: { kind: "ipv6NthSubnet", network: shortenIpv6(site), prefix, nth, variant: variant(random) },
        fields: [ field("ipv6Network", "ipv6Net", at(nth), { traps: [ trap(at(nth + 1), "zeroBased") ] }) ],
    };
}

function ipv6Type(random: Random, level: Difficulty): Exercise {
    const iid = interfaceId(random);
    const kinds = level === "easy" ? [ "linkLocal", "globalUnicast", "loopback" ] : [ "linkLocal", "globalUnicast", "uniqueLocal", "multicast", "loopback" ];
    const kind = pick(random, kinds);
    const address: Ipv6 =
        kind === "linkLocal" ? [ 0xfe80, 0, 0, 0, ...iid ]
            : kind === "uniqueLocal" ? [ pick(random, [ 0xfd00, 0xfc00 ]) | int(random, 0, 0xff), int(random, 0, 0xffff), int(random, 0, 0xffff), int(random, 0, 0xff), ...iid ]
                : kind === "multicast" ? [ pick(random, [ 0xff02, 0xff05, 0xff0e ]), 0, 0, 0, 0, 0, int(random, 0, 1), int(random, 1, 0xfb) ]
                    : kind === "loopback" ? [ 0, 0, 0, 0, 0, 0, 0, 1 ]
                        : [ int(random, 0x2001, 0x2a0f), int(random, 0x100, 0xffff), int(random, 0, 0xffff), int(random, 0, 0xffff), ...iid ];
    const type = ipv6Kind(address);
    const shown = level === "hard" && kind !== "loopback" && chance(random, 0.5) ? expandIpv6(address) : shortenIpv6(address);
    return {
        task: { kind: "ipv6Type", address: shown, variant: variant(random) },
        fields: [ field("addressType", "choice", type === "documentation" ? "globalUnicast" : type, { options: [ "globalUnicast", "linkLocal", "uniqueLocal", "multicast", "loopback" ] }) ],
    };
}

function eui64Task(random: Random, level: Difficulty): Exercise {
    const mac = Array.from({ length: 6 }, () => int(random, 0, 255));
    mac[0] &= 0xfc;
    const hex = mac.map(b => b.toString(16).padStart(2, "0"));
    const shownMac = level === "hard" && chance(random, 0.5) ? hex.join("-").toUpperCase() : hex.join(":");
    const iid = eui64(mac), unflipped = eui64([ mac[0] ^ 0x02, ...mac.slice(1) ]);
    const iidText = (g: number[]): string => g.map(x => x.toString(16)).join(":");
    return {
        task: { kind: "eui64", mac: shownMac, variant: variant(random) },
        fields: [
            field("interfaceId", "iid", iidText(iid), { traps: [ trap(iidText(unflipped), "flipBit") ] }),
            field("linkLocal", "ipv6Any", shortenIpv6([ 0xfe80, 0, 0, 0, ...iid ]), { traps: [ trap(shortenIpv6([ 0xfe80, 0, 0, 0, ...unflipped ]), "flipBit") ] }),
        ],
    };
}

export const GENERATORS: Record<ExerciseKind, Generator> = {
    networkBroadcast, hostRange, hostCount, maskToPrefix: maskToPrefixTask, prefixToMask: prefixToMaskTask, split, vlsm: vlsmTask,
    ipv6Shorten, ipv6Expand, ipv6Subnets, hostSubnet, sameSubnet, hostsToPrefix, subnetsToPrefix, reverseMask, wildcard,
    summarize, routeContents, findMistake, vlsmScenario, ipv6Prefix, ipv6NthSubnet, ipv6Type, eui64: eui64Task,
};
