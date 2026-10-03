export type ParseError = "empty" | "address" | "prefix" | "mask" | "maskNotContiguous";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: ParseError };

export type AddressClass = "A" | "B" | "C" | "D" | "E";

export type RangeKind =
    | "public" | "private" | "loopback" | "linkLocal" | "cgnat" | "thisNetwork"
    | "documentation" | "multicast" | "reserved" | "broadcast";

/** `p2p` is a /31 point-to-point link (RFC 3021), `host` a single /32 address. */
export type SpecialPrefix = "p2p" | "host" | null;

export interface Cidr {
    address: number;
    prefix: number;
}

export interface Ipv4Info {
    address: number;
    prefix: number;
    mask: number;
    wildcard: number;
    network: number;
    /** `null` for /31 and /32, which have no broadcast address. */
    broadcast: number | null;
    firstHost: number;
    lastHost: number;
    totalAddresses: number;
    usableHosts: number;
    addressClass: AddressClass;
    range: RangeKind;
    special: SpecialPrefix;
    /** The address had host bits set, i.e. it is not the network address itself. */
    isHostAddress: boolean;
}

const MAX = 0xffffffff;

function ok<T>(value: T): Parsed<T> {
    return { ok: true, value };
}

function fail<T>(error: ParseError): Parsed<T> {
    return { ok: false, error };
}

/** Accepts dotted decimal with optional leading zeros, e.g. `192.168.001.10`. */
export function parseIpv4(input: string): number | null {
    const parts = input.trim().split(".");
    if (parts.length !== 4) return null;
    let value = 0;
    for (const part of parts) {
        if (!/^\d{1,3}$/.test(part)) return null;
        const octet = Number(part);
        if (octet > 255) return null;
        value = value * 256 + octet;
    }
    return value;
}

export function formatIpv4(value: number): string {
    return [ 24, 16, 8, 0 ].map(shift => (value >>> shift) & 255).join(".");
}

export function prefixToMask(prefix: number): number {
    return prefix === 0 ? 0 : (MAX << (32 - prefix)) >>> 0;
}

/** Returns `null` for masks whose one bits are not contiguous, such as 255.0.255.0. */
export function maskToPrefix(mask: number): number | null {
    const inverted = ~mask >>> 0;
    if ((inverted & (inverted + 1)) !== 0) return null;
    return Math.clz32(inverted);
}

/** Accepts `/26`, `26` or a dotted mask such as `255.255.255.192`. */
export function parsePrefixOrMask(input: string): Parsed<number> {
    const text = input.replace(/\s+/g, "");
    if (!text) return fail("empty");
    const prefixMatch = /^\/?(\d{1,2})$/.exec(text);
    if (prefixMatch) {
        const prefix = Number(prefixMatch[1]);
        return prefix <= 32 ? ok(prefix) : fail("prefix");
    }
    const mask = parseIpv4(text);
    if (mask === null) return fail(text.includes(".") ? "mask" : "prefix");
    const prefix = maskToPrefix(mask);
    return prefix === null ? fail("maskNotContiguous") : ok(prefix);
}

/**
 * Accepts `192.168.1.10/26`, `192.168.1.10 /26`, `192.168.1.10 255.255.255.192`,
 * or the address alone together with a separate `maskInput`.
 */
export function parseCidr(input: string, maskInput = ""): Parsed<Cidr> {
    const text = input.trim();
    if (!text) return fail("empty");
    const [ addressPart, ...rest ] = text.split(/\s*\/\s*|\s+/);
    const address = parseIpv4(addressPart);
    if (address === null) return fail("address");
    const prefixText = rest.length ? (text.includes("/") ? `/${rest.join("")}` : rest.join("")) : maskInput;
    const prefix = parsePrefixOrMask(prefixText);
    return prefix.ok ? ok({ address, prefix: prefix.value }) : fail(prefix.error);
}

export function addressClass(address: number): AddressClass {
    const first = address >>> 24;
    if (first < 128) return "A";
    if (first < 192) return "B";
    if (first < 224) return "C";
    if (first < 240) return "D";
    return "E";
}

/** Prefix of the class A, B or C network, `null` for D and E. */
export function classfulPrefix(cls: AddressClass): number | null {
    return { A: 8, B: 16, C: 24, D: null, E: null }[cls];
}

const RANGES: { network: string; prefix: number; kind: RangeKind }[] = [
    { network: "255.255.255.255", prefix: 32, kind: "broadcast" },
    { network: "0.0.0.0", prefix: 8, kind: "thisNetwork" },
    { network: "10.0.0.0", prefix: 8, kind: "private" },
    { network: "100.64.0.0", prefix: 10, kind: "cgnat" },
    { network: "127.0.0.0", prefix: 8, kind: "loopback" },
    { network: "169.254.0.0", prefix: 16, kind: "linkLocal" },
    { network: "172.16.0.0", prefix: 12, kind: "private" },
    { network: "192.0.2.0", prefix: 24, kind: "documentation" },
    { network: "192.168.0.0", prefix: 16, kind: "private" },
    { network: "198.51.100.0", prefix: 24, kind: "documentation" },
    { network: "203.0.113.0", prefix: 24, kind: "documentation" },
    { network: "224.0.0.0", prefix: 4, kind: "multicast" },
    { network: "240.0.0.0", prefix: 4, kind: "reserved" },
];

export function inSubnet(address: number, network: number, prefix: number): boolean {
    const mask = prefixToMask(prefix);
    return ((address & mask) >>> 0) === ((network & mask) >>> 0);
}

export function rangeKind(address: number): RangeKind {
    const hit = RANGES.find(r => inSubnet(address, parseIpv4(r.network)!, r.prefix));
    return hit?.kind ?? "public";
}

export function networkOf(address: number, prefix: number): number {
    return (address & prefixToMask(prefix)) >>> 0;
}

export function blockSize(prefix: number): number {
    return 2 ** (32 - prefix);
}

/** Usable hosts: 2^(32-prefix) − 2, except /31 = 2 (RFC 3021) and /32 = 1. */
export function usableHosts(prefix: number): number {
    if (prefix === 32) return 1;
    if (prefix === 31) return 2;
    return blockSize(prefix) - 2;
}

export function analyzeIpv4(address: number, prefix: number): Ipv4Info {
    const mask = prefixToMask(prefix);
    const network = networkOf(address, prefix);
    const last = network + blockSize(prefix) - 1;
    const special: SpecialPrefix = prefix === 32 ? "host" : prefix === 31 ? "p2p" : null;
    return {
        address,
        prefix,
        mask,
        wildcard: ~mask >>> 0,
        network,
        broadcast: special ? null : last,
        firstHost: special ? network : network + 1,
        lastHost: special ? last : last - 1,
        totalAddresses: blockSize(prefix),
        usableHosts: usableHosts(prefix),
        addressClass: addressClass(address),
        range: rangeKind(address),
        special,
        isHostAddress: address !== network,
    };
}

/** 32 characters of `0` and `1`. */
export function toBits(value: number): string {
    return value.toString(2).padStart(32, "0");
}

/** Binary with dots between the octets, e.g. `11000000.10101000.00000001.00001010`. */
export function toBinary(value: number): string {
    return toBits(value).match(/.{8}/g)!.join(".");
}

/** Smallest prefix whose subnet holds `hosts` usable hosts (classic rule: network and broadcast are reserved). */
export function prefixForHosts(hosts: number): number | null {
    if (!Number.isInteger(hosts) || hosts < 1) return null;
    const bits = Math.max(2, Math.ceil(Math.log2(hosts + 2)));
    return bits > 32 ? null : 32 - bits;
}
