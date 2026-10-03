import { parseIpv4 } from "./ipv4";

/** Eight 16-bit groups. */
export type Ipv6 = number[];

export type Ipv6Kind =
    | "unspecified" | "loopback" | "ipv4Mapped" | "documentation" | "linkLocal" | "uniqueLocal" | "multicast" | "globalUnicast" | "other";

function parseGroups(part: string, allowIpv4: boolean): number[] | null {
    if (part === "") return [];
    const groups: number[] = [];
    const items = part.split(":");
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (allowIpv4 && i === items.length - 1 && item.includes(".")) {
            const v4 = parseIpv4(item);
            if (v4 === null) return null;
            groups.push(v4 >>> 16, v4 & 0xffff);
        } else if (/^[0-9a-f]{1,4}$/i.test(item)) {
            groups.push(parseInt(item, 16));
        } else {
            return null;
        }
    }
    return groups;
}

/** Accepts full, shortened and IPv4-embedded notation (`::ffff:192.0.2.1`). */
export function parseIpv6(input: string): Ipv6 | null {
    const text = input.trim();
    if (!text || text.includes(":::")) return null;
    const halves = text.split("::");
    if (halves.length > 2) return null;
    if (halves.length === 1) {
        const groups = parseGroups(text, true);
        return groups?.length === 8 ? groups : null;
    }
    const head = parseGroups(halves[0], false), tail = parseGroups(halves[1], true);
    if (!head || !tail || head.length + tail.length > 7) return null;
    return [ ...head, ...Array<number>(8 - head.length - tail.length).fill(0), ...tail ];
}

export function parseIpv6Cidr(input: string): { address: Ipv6; prefix: number } | null {
    const [ addressText, prefixText, ...rest ] = input.trim().split("/");
    if (rest.length) return null;
    const address = parseIpv6(addressText);
    if (!address) return null;
    if (prefixText === undefined) return { address, prefix: 128 };
    if (!/^\s*\d{1,3}\s*$/.test(prefixText)) return null;
    const prefix = Number(prefixText);
    return prefix <= 128 ? { address, prefix } : null;
}

/** All 32 hex digits, lower case, e.g. `2001:0db8:0000:…`. */
export function expandIpv6(address: Ipv6): string {
    return address.map(g => g.toString(16).padStart(4, "0")).join(":");
}

/** RFC 5952: lower case, no leading zeros, the longest run of at least two zero groups (the first on a tie) becomes `::`. */
export function shortenIpv6(address: Ipv6): string {
    let bestStart = -1, bestLength = 1;
    for (let i = 0; i < 8;) {
        if (address[i] !== 0) {
            i++;
            continue;
        }
        let j = i;
        while (j < 8 && address[j] === 0) j++;
        if (j - i > bestLength) {
            bestStart = i;
            bestLength = j - i;
        }
        i = j;
    }
    const hex = address.map(g => g.toString(16));
    if (bestStart < 0) return hex.join(":");
    return `${hex.slice(0, bestStart).join(":")}::${hex.slice(bestStart + bestLength).join(":")}`;
}

export function ipv6Network(address: Ipv6, prefix: number): Ipv6 {
    return address.map((group, k) => {
        const bits = Math.min(16, Math.max(0, prefix - k * 16));
        return bits === 0 ? 0 : group & (0xffff << (16 - bits)) & 0xffff;
    });
}

/** Number of /64 subnets inside a prefix, 0 when the prefix is longer than /64. */
export function subnets64(prefix: number): bigint {
    return prefix > 64 ? 0n : 2n ** BigInt(64 - prefix);
}

/** Number of subnets of length `target` inside `prefix`. */
export function subnetCount(prefix: number, target: number): bigint {
    return target < prefix ? 0n : 2n ** BigInt(target - prefix);
}

function startsWith(address: Ipv6, network: string, prefix: number): boolean {
    const net = parseIpv6(network)!;
    return ipv6Network(address, prefix).every((g, k) => g === net[k]);
}

export function ipv6Kind(address: Ipv6): Ipv6Kind {
    if (address.every(g => g === 0)) return "unspecified";
    if (address.slice(0, 7).every(g => g === 0) && address[7] === 1) return "loopback";
    if (startsWith(address, "::ffff:0:0", 96)) return "ipv4Mapped";
    if (startsWith(address, "2001:db8::", 32)) return "documentation";
    if (startsWith(address, "fe80::", 10)) return "linkLocal";
    if (startsWith(address, "fc00::", 7)) return "uniqueLocal";
    if (startsWith(address, "ff00::", 8)) return "multicast";
    if (startsWith(address, "2000::", 3)) return "globalUnicast";
    return "other";
}
