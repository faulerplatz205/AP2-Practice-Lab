import { describe, expect, it } from "vitest";
import { DIFFICULTIES, EXERCISE_KINDS, type Exercise, type ExerciseKind, TOPIC_OF, checkExercise, generateExercise, nextKind, seededRandom } from "./exercises";
import { blockSize, formatIpv4, maskToPrefix, networkOf, parseCidr, parseIpv4, prefixForHosts, prefixToMask } from "./ipv4";
import { overlaps } from "./divide";
import { expandIpv6, ipv6Kind, ipv6Network, parseIpv6, parseMac, shortenIpv6 } from "./ipv6";
import { segmentNeed } from "./answers";
import { explain } from "./explain";

const SEEDS = 120;

const ip = (text: string): number => parseIpv4(text)!;

function solutions(ex: Exercise): Record<string, string> {
    return Object.fromEntries(ex.fields.map(x => [ x.id, x.solution ]));
}

function sol(ex: Exercise, id: string): string {
    const f = ex.fields.find(x => x.id === id);
    if (!f) throw new Error(`no field ${id} in ${JSON.stringify(ex)}`);
    return f.solution;
}

const prefixOf = (text: string): number => Number(text.replace("/", ""));

/** Runs `verify` on many tasks of `kind` for every difficulty. */
function each(kind: ExerciseKind, verify: (ex: Exercise) => void): void {
    for (const level of DIFFICULTIES) {
        const random = seededRandom(kind.length * 1000 + level.length);
        for (let k = 0; k < SEEDS; k++) {
            const ex = generateExercise(random, kind, level);
            expect(ex.task.kind).toBe(kind);
            verify(ex);
        }
    }
}

describe("every generator", () => {
    it("produces tasks whose own solutions pass the check, with unique field ids", () => {
        for (const kind of EXERCISE_KINDS) {
            each(kind, ex => {
                expect(ex.fields.length).toBeGreaterThan(0);
                expect(new Set(ex.fields.map(x => x.id)).size).toBe(ex.fields.length);
                expect(checkExercise(ex, solutions(ex)).allCorrect, JSON.stringify(ex)).toBe(true);
                expect(checkExercise(ex, {}).allCorrect).toBe(false);
                for (const f of ex.fields) for (const t of f.traps ?? []) if (t.value !== f.solution) expect(checkExercise(ex, { ...solutions(ex), [f.id]: t.value }).allCorrect).toBe(false);
                expect(explain(ex).length).toBeGreaterThan(0);
            });
        }
    });
    it("is deterministic with a seed and has a topic for every kind", () => {
        for (const kind of EXERCISE_KINDS) {
            expect(generateExercise(seededRandom(9), kind, "hard")).toEqual(generateExercise(seededRandom(9), kind, "hard"));
            expect(TOPIC_OF[kind]).toBeTruthy();
        }
    });
    it("keeps easy IPv4 tasks in the 4th octet and reaches other octets when hard", () => {
        const prefixes = (level: "easy" | "hard"): number[] => {
            const random = seededRandom(4);
            return Array.from({ length: 200 }, () => generateExercise(random, "networkBroadcast", level).task).map(t => t.kind === "networkBroadcast" ? t.prefix : 0);
        };
        expect(Math.min(...prefixes("easy"))).toBeGreaterThanOrEqual(24);
        expect(prefixes("hard").some(p => p < 16)).toBe(true);
    });
});

describe("IPv4 generators", () => {
    it("networkBroadcast and hostRange match the bit maths", () => {
        each("networkBroadcast", ex => {
            if (ex.task.kind !== "networkBroadcast") return;
            const mask = prefixToMask(ex.task.prefix), address = ip(ex.task.address);
            expect(sol(ex, "network")).toBe(formatIpv4((address & mask) >>> 0));
            expect(sol(ex, "broadcast")).toBe(formatIpv4((address | ~mask) >>> 0));
            expect(address).not.toBe((address & mask) >>> 0);
        });
        each("hostRange", ex => {
            if (ex.task.kind !== "hostRange") return;
            expect(ip(sol(ex, "lastHost")) - ip(sol(ex, "firstHost")) + 1).toBe(Number(sol(ex, "hosts")));
        });
    });
    it("hostSubnet finds the numbered subnet that contains the host", () => {
        each("hostSubnet", ex => {
            if (ex.task.kind !== "hostSubnet") return;
            const host = ip(ex.task.host), network = ip(sol(ex, "network"));
            expect(networkOf(host, ex.task.subPrefix)).toBe(network);
            expect(networkOf(network, ex.task.prefix)).toBe(ip(ex.task.network));
            expect((network - ip(ex.task.network)) / blockSize(ex.task.subPrefix) + 1).toBe(Number(sol(ex, "subnetIndex")));
            expect(ip(sol(ex, "broadcast"))).toBe(network + blockSize(ex.task.subPrefix) - 1);
        });
    });
    it("sameSubnet answers yes exactly when both networks are equal", () => {
        let yes = 0;
        each("sameSubnet", ex => {
            if (ex.task.kind !== "sameSubnet") return;
            const [ a, b ] = ex.task.hosts.map(h => networkOf(ip(h.address), (ex.task as { prefix: number }).prefix));
            expect(sol(ex, "network0")).toBe(formatIpv4(a));
            expect(sol(ex, "network1")).toBe(formatIpv4(b));
            expect(sol(ex, "same")).toBe(a === b ? "yes" : "no");
            if (a === b) yes++;
        });
        expect(yes).toBeGreaterThan(SEEDS / 2);
        expect(yes).toBeLessThan(SEEDS * 2.5);
    });
    it("hostsToPrefix picks the smallest fitting prefix and includes edge cases", () => {
        let edges = 0;
        each("hostsToPrefix", ex => {
            if (ex.task.kind !== "hostsToPrefix") return;
            const prefix = prefixOf(sol(ex, "netmask")), hosts = ex.task.hosts;
            expect(2 ** (32 - prefix) - 2).toBeGreaterThanOrEqual(hosts);
            expect(2 ** (32 - prefix - 1) - 2).toBeLessThan(hosts);
            if (Number.isInteger(Math.log2(hosts + 2)) || Number.isInteger(Math.log2(hosts + 1))) edges++;
        });
        expect(edges).toBeGreaterThan(20);
    });
    it("subnetsToPrefix borrows enough bits for both conditions", () => {
        each("subnetsToPrefix", ex => {
            if (ex.task.kind !== "subnetsToPrefix") return;
            const prefix = prefixOf(sol(ex, "netmask"));
            expect(2 ** (prefix - ex.task.prefix)).toBeGreaterThanOrEqual(ex.task.count);
            expect(2 ** (prefix - ex.task.prefix - 1)).toBeLessThan(ex.task.count);
            expect(Number(sol(ex, "hosts"))).toBeGreaterThanOrEqual(ex.task.minHosts ?? 0);
            expect(prefix).toBeLessThanOrEqual(30);
        });
    });
    it("reverseMask and wildcard are consistent with the mask", () => {
        each("reverseMask", ex => {
            if (ex.task.kind !== "reverseMask") return;
            expect(ip(ex.task.broadcast) - ip(ex.task.network) + 1).toBe(2 ** (32 - prefixOf(sol(ex, "netmask"))));
        });
        each("wildcard", ex => {
            if (ex.task.kind !== "wildcard") return;
            if (ex.task.reverse) expect(sol(ex, "netmask")).toBe(`/${ex.task.prefix}`);
            else expect(maskToPrefix(~ip(sol(ex, "wildcard")) >>> 0)).toBe(ex.task.prefix);
        });
    });
    it("summarize gives the smallest block that covers every network", () => {
        each("summarize", ex => {
            if (ex.task.kind !== "summarize") return;
            const summary = parseCidr(sol(ex, "summary"));
            if (!summary.ok) throw new Error();
            const { address, prefix } = summary.value;
            expect(networkOf(address, prefix)).toBe(address);
            const blocks = ex.task.networks.map(n => parseCidr(n)).map(r => r.ok ? r.value : null);
            expect(ex.task.networks.length).toBeGreaterThanOrEqual(2);
            for (const b of blocks) expect(networkOf(b!.address, prefix)).toBe(address);
            expect(blocks.every(b => networkOf(b!.address, prefix + 1) === networkOf(blocks[0]!.address, prefix + 1))).toBe(false);
        });
    });
    it("routeContents counts and names the first and last subnet", () => {
        each("routeContents", ex => {
            if (ex.task.kind !== "routeContents") return;
            const { network, prefix, target } = ex.task;
            expect(BigInt(sol(ex, "subnetCount"))).toBe(2n ** BigInt(target - prefix));
            expect(sol(ex, "firstNetwork")).toBe(network);
            expect(ip(sol(ex, "lastNetwork")) + blockSize(target)).toBe(ip(network) + blockSize(prefix));
        });
    });
    it("split and vlsm stay valid on every level", () => {
        each("split", ex => {
            if (ex.task.kind !== "split") return;
            expect(prefixOf(sol(ex, "prefix"))).toBeLessThanOrEqual(30);
        });
        each("vlsm", ex => {
            const prefixes = ex.fields.filter(x => x.key === "prefix").map(x => x.solution);
            expect(new Set(prefixes).size).toBe(prefixes.length);
        });
    });
});

describe("findMistake", () => {
    it("injects exactly the mistake it asks for", () => {
        each("findMistake", ex => {
            const task = ex.task;
            if (task.kind !== "findMistake") return;
            const mistake = sol(ex, "mistake"), item = sol(ex, "item");
            if (task.setting === "devices") {
                const normal = task.devices.filter(d => d.id !== item);
                const { prefix, gateway } = normal[0];
                expect(normal.every(d => d.prefix === prefix && d.gateway === gateway)).toBe(true);
                const network = networkOf(ip(gateway), prefix);
                for (const d of normal) {
                    expect(networkOf(ip(d.address), prefix)).toBe(network);
                    expect([ network, network + blockSize(prefix) - 1, ip(gateway) ]).not.toContain(ip(d.address));
                }
                const odd = task.devices.find(d => d.id === item)!;
                const problems = [
                    networkOf(ip(odd.gateway), prefix) !== network && "gatewayOutside",
                    ip(odd.address) === network + blockSize(prefix) - 1 && "broadcastAsHost",
                    ip(odd.address) === network && "networkAsHost",
                    odd.prefix !== prefix && "wrongMask",
                ].filter(Boolean);
                expect(problems).toEqual([ mistake ]);
            } else {
                const base = { network: ip(task.network), prefix: task.prefix };
                const blocks = task.entries.map(e => ({ id: e.id, network: ip(e.network), prefix: e.prefix }));
                const problemsOf = (b: typeof blocks[0]): string[] => [
                    networkOf(b.network, b.prefix) !== b.network && "notAligned",
                    (b.network < base.network || b.network + blockSize(b.prefix) > base.network + blockSize(base.prefix)) && "outside",
                    blocks.some(o => o !== b && overlaps(o, b)) && "overlap",
                ].filter((p): p is string => !!p);
                const faulty = blocks.filter(b => problemsOf(b).length);
                const accepted = [ item, ...ex.fields[0].accepted ?? [] ];
                expect(faulty.map(b => b.id).sort()).toEqual(accepted.slice().sort());
                for (const b of faulty) expect(problemsOf(b)).toEqual([ mistake ]);
            }
        });
    });
});

describe("vlsmScenario", () => {
    it("allocates every segment with the smallest prefix incl. reserve, inside the network, without overlap", () => {
        each("vlsmScenario", ex => {
            const task = ex.task;
            if (task.kind !== "vlsmScenario") return;
            const blocks = task.segments.map((s, k) => {
                const prefix = prefixOf(sol(ex, `prefix${k}`));
                expect(prefix).toBe(prefixForHosts(segmentNeed(s, task.reserve)));
                return { network: ip(sol(ex, `network${k}`)), prefix };
            });
            const base = ip(task.network);
            for (const [ k, b ] of blocks.entries()) {
                expect(networkOf(b.network, b.prefix)).toBe(b.network);
                expect(b.network >= base && b.network + blockSize(b.prefix) <= base + blockSize(task.prefix)).toBe(true);
                for (const o of blocks.slice(k + 1)) expect(overlaps(b, o)).toBe(false);
            }
        });
    });
    it("accepts any other valid plan and rejects overlapping or misaligned ones", () => {
        const random = seededRandom(77);
        for (let n = 0; n < 60; n++) {
            const ex = generateExercise(random, "vlsmScenario", "medium");
            if (ex.task.kind !== "vlsmScenario") throw new Error();
            const base = ip(ex.task.network), size = blockSize(ex.task.prefix);
            const answers = solutions(ex);
            const blocks = ex.task.segments.map((_, k) => ({ k, prefix: prefixOf(answers[`prefix${k}`]) })).sort((a, b) => a.prefix - b.prefix);
            let cursor = base + size;
            for (const b of blocks) {
                cursor -= blockSize(b.prefix);
                answers[`network${b.k}`] = formatIpv4(cursor);
            }
            expect(answers).not.toEqual(solutions(ex));
            expect(checkExercise(ex, answers).allCorrect).toBe(true);
            expect(cursor).toBeGreaterThanOrEqual(base);
            const results = checkExercise(ex, { ...answers, [`network${blocks[1].k}`]: answers[`network${blocks[0].k}`] }).results;
            expect(results.filter(r => r.tip === "planOverlap").length).toBe(2);
            const misaligned = checkExercise(ex, { ...answers, [`network${blocks[0].k}`]: formatIpv4(ip(answers[`network${blocks[0].k}`]) + 1) }).results;
            expect(misaligned.find(r => r.id === `network${blocks[0].k}`)?.tip).toBe("planAligned");
            const outside = checkExercise(ex, { ...answers, [`network${blocks[0].k}`]: formatIpv4(base + size) }).results;
            expect(outside.find(r => r.id === `network${blocks[0].k}`)?.tip).toBe("planOutside");
        }
    });
});

describe("IPv6 generators", () => {
    it("shorten and expand tasks are inverse and hard ones contain traps", () => {
        let ties = 0;
        each("ipv6Shorten", ex => {
            if (ex.task.kind !== "ipv6Shorten") return;
            expect(shortenIpv6(parseIpv6(ex.task.address)!)).toBe(sol(ex, "ipv6Short"));
            if (/(^|:)0:0($|:)/.test(sol(ex, "ipv6Short"))) ties++;
        });
        expect(ties).toBeGreaterThan(0);
        each("ipv6Expand", ex => {
            if (ex.task.kind !== "ipv6Expand") return;
            expect(expandIpv6(parseIpv6(ex.task.address)!)).toBe(sol(ex, "ipv6Full"));
        });
    });
    it("ipv6Prefix cuts the address and reads the subnet id", () => {
        each("ipv6Prefix", ex => {
            const task = ex.task;
            if (task.kind !== "ipv6Prefix") return;
            const [ network, prefix ] = sol(ex, "ipv6Network").split("/");
            expect(Number(prefix)).toBe(task.prefix);
            expect(expandIpv6(ipv6Network(parseIpv6(task.address)!, task.prefix))).toBe(expandIpv6(parseIpv6(network)!));
            if (task.site !== null) {
                const value = parseIpv6(network)!;
                const bits = task.prefix - task.site;
                const id = Number(((BigInt(value[2]) << 16n | BigInt(value[3])) >> BigInt(64 - task.prefix)) & ((1n << BigInt(bits)) - 1n));
                expect(parseInt(sol(ex, "subnetId"), 16)).toBe(id);
            }
        });
    });
    it("ipv6NthSubnet counts from 1 inside the site", () => {
        each("ipv6NthSubnet", ex => {
            const task = ex.task;
            if (task.kind !== "ipv6NthSubnet") return;
            const site = parseIpv6(task.network)!, answer = parseIpv6(sol(ex, "ipv6Network").split("/")[0])!;
            expect(expandIpv6(ipv6Network(answer, task.prefix))).toBe(expandIpv6(site));
            expect(answer[3] - site[3]).toBe(task.nth - 1);
            expect(answer.slice(4).every(g => g === 0)).toBe(true);
        });
    });
    it("ipv6Type and eui64 match the address rules", () => {
        each("ipv6Type", ex => {
            if (ex.task.kind !== "ipv6Type") return;
            const kind = ipv6Kind(parseIpv6(ex.task.address)!);
            expect(sol(ex, "addressType")).toBe(kind === "documentation" ? "globalUnicast" : kind);
        });
        each("eui64", ex => {
            if (ex.task.kind !== "eui64") return;
            const mac = parseMac(ex.task.mac)!;
            const groups = sol(ex, "interfaceId").split(":").map(g => parseInt(g, 16));
            expect(groups[0] >> 8).toBe(mac[0] ^ 2);
            expect(groups[1] & 0xff).toBe(0xff);
            expect(groups[2] >> 8).toBe(0xfe);
            expect(groups[3] & 0xff).toBe(mac[5]);
            expect(sol(ex, "linkLocal").startsWith("fe80::")).toBe(true);
        });
    });
});

describe("nextKind", () => {
    it("never repeats the previous kind", () => {
        const random = seededRandom(1);
        let previous: ExerciseKind | null = null;
        const seen = new Set<ExerciseKind>();
        for (let k = 0; k < 500; k++) {
            const kind = nextKind(random, previous);
            expect(kind).not.toBe(previous);
            seen.add(kind);
            previous = kind;
        }
        expect(seen.size).toBe(EXERCISE_KINDS.length);
        expect(nextKind(random, "vlsm", [ "vlsm" ])).toBe("vlsm");
    });
});
