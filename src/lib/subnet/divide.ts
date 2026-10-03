import { blockSize, networkOf, prefixForHosts, prefixToMask, usableHosts } from "./ipv4";

export interface Subnet {
    network: number;
    prefix: number;
    mask: number;
    /** `null` for /31 and /32 */
    broadcast: number | null;
    firstHost: number;
    lastHost: number;
    usableHosts: number;
}

export function subnetAt(network: number, prefix: number): Subnet {
    const last = network + blockSize(prefix) - 1;
    const special = prefix >= 31;
    return {
        network,
        prefix,
        mask: prefixToMask(prefix),
        broadcast: special ? null : last,
        firstHost: special ? network : network + 1,
        lastHost: special ? last : last - 1,
        usableHosts: usableHosts(prefix),
    };
}

export type SplitResult =
    | { ok: true; prefix: number; borrowedBits: number; subnets: Subnet[] }
    | { ok: false; error: "count" | "tooMany" };

export const MAX_SPLIT = 4096;

/** Splits into the next power of two ≥ `count` equal subnets. */
export function splitEqual(address: number, prefix: number, count: number): SplitResult {
    if (!Number.isInteger(count) || count < 1 || count > MAX_SPLIT) return { ok: false, error: "count" };
    const borrowedBits = Math.ceil(Math.log2(count));
    const newPrefix = prefix + borrowedBits;
    if (newPrefix > 32) return { ok: false, error: "tooMany" };
    const network = networkOf(address, prefix), size = blockSize(newPrefix);
    const subnets = Array.from({ length: 2 ** borrowedBits }, (_, k) => subnetAt(network + k * size, newPrefix));
    return { ok: true, prefix: newPrefix, borrowedBits, subnets };
}

export interface HostRequirement {
    name: string;
    hosts: number;
}

export interface VlsmAllocation extends Subnet {
    name: string;
    neededHosts: number;
    /** Position in the input list */
    index: number;
}

export interface Block {
    network: number;
    prefix: number;
}

export interface VlsmResult {
    allocations: VlsmAllocation[];
    /** Requirements that did not fit, or that asked for an invalid host count */
    failed: (HostRequirement & { index: number })[];
    /** Free space after the last allocation, as aligned CIDR blocks */
    free: Block[];
    usedAddresses: number;
    totalAddresses: number;
}

/** Largest first; equal sizes keep their input order. */
export function vlsm(address: number, prefix: number, requirements: HostRequirement[]): VlsmResult {
    const start = networkOf(address, prefix), end = start + blockSize(prefix);
    const sorted = requirements
        .map((r, index) => ({ ...r, index, prefix: prefixForHosts(r.hosts) }))
        .sort((a, b) => (a.prefix ?? 33) - (b.prefix ?? 33) || a.index - b.index);
    const allocations: VlsmAllocation[] = [], failed: VlsmResult["failed"] = [];
    let cursor = start;
    for (const r of sorted) {
        if (r.prefix === null || r.prefix < prefix || cursor + blockSize(r.prefix) > end) {
            failed.push({ name: r.name, hosts: r.hosts, index: r.index });
            continue;
        }
        allocations.push({ ...subnetAt(cursor, r.prefix), name: r.name, neededHosts: r.hosts, index: r.index });
        cursor += blockSize(r.prefix);
    }
    return { allocations, failed, free: freeBlocks(cursor, end), usedAddresses: cursor - start, totalAddresses: end - start };
}

/** Covers [from, to) with the fewest aligned CIDR blocks. */
export function freeBlocks(from: number, to: number): Block[] {
    const blocks: Block[] = [];
    let cursor = from;
    while (cursor < to) {
        let size = cursor === 0 ? 2 ** 32 : 2 ** Math.min(32, countTrailingZeros(cursor));
        while (cursor + size > to) size /= 2;
        blocks.push({ network: cursor, prefix: 32 - Math.log2(size) });
        cursor += size;
    }
    return blocks;
}

function countTrailingZeros(value: number): number {
    let n = 0;
    while (n < 32 && value % 2 ** (n + 1) === 0) n++;
    return n;
}
