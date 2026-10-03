import { describe, expect, it } from "vitest";
import { freeBlocks, splitEqual, vlsm } from "./divide";
import { formatIpv4, parseIpv4 } from "./ipv4";

const ip = (text: string): number => parseIpv4(text)!;
const cidr = (b: { network: number; prefix: number }): string => `${formatIpv4(b.network)}/${b.prefix}`;

describe("splitEqual", () => {
    it("rounds up to the next power of two", () => {
        const r = splitEqual(ip("192.168.10.0"), 24, 6);
        if (!r.ok) throw new Error();
        expect(r.prefix).toBe(27);
        expect(r.borrowedBits).toBe(3);
        expect(r.subnets).toHaveLength(8);
        expect(cidr(r.subnets[2])).toBe("192.168.10.64/27");
        expect(formatIpv4(r.subnets[2].broadcast!)).toBe("192.168.10.95");
        expect(r.subnets[7].usableHosts).toBe(30);
    });
    it("uses the network address even if a host address is given", () => {
        const r = splitEqual(ip("10.1.2.3"), 16, 2);
        expect(r.ok && cidr(r.subnets[1])).toBe("10.1.128.0/17");
    });
    it("keeps one subnet for a count of 1 and reports errors", () => {
        const one = splitEqual(ip("10.0.0.0"), 8, 1);
        expect(one.ok && one.prefix).toBe(8);
        expect(splitEqual(ip("10.0.0.0"), 30, 8)).toEqual({ ok: false, error: "tooMany" });
        expect(splitEqual(ip("10.0.0.0"), 24, 0)).toEqual({ ok: false, error: "count" });
        expect(splitEqual(ip("10.0.0.0"), 24, 2.5)).toEqual({ ok: false, error: "count" });
    });
    it("supports /31 subnets without broadcast", () => {
        const r = splitEqual(ip("10.0.0.0"), 30, 2);
        expect(r.ok && r.subnets[0].broadcast).toBeNull();
    });
});

describe("vlsm", () => {
    it("allocates largest first and reports the rest", () => {
        const r = vlsm(ip("192.168.1.0"), 24, [
            { name: "Verwaltung", hosts: 20 },
            { name: "Vertrieb", hosts: 100 },
            { name: "Technik", hosts: 50 },
            { name: "WAN", hosts: 2 },
        ]);
        expect(r.failed).toEqual([]);
        expect(r.allocations.map(a => `${a.name} ${cidr(a)}`)).toEqual([
            "Vertrieb 192.168.1.0/25",
            "Technik 192.168.1.128/26",
            "Verwaltung 192.168.1.192/27",
            "WAN 192.168.1.224/30",
        ]);
        expect(r.allocations[0].index).toBe(1);
        expect(formatIpv4(r.allocations[2].broadcast!)).toBe("192.168.1.223");
        expect(r.free.map(cidr)).toEqual([ "192.168.1.228/30", "192.168.1.232/29", "192.168.1.240/28" ]);
        expect(r.usedAddresses).toBe(228);
        expect(r.totalAddresses).toBe(256);
    });
    it("keeps input order on equal sizes", () => {
        const r = vlsm(ip("10.0.0.0"), 24, [{ name: "a", hosts: 10 }, { name: "b", hosts: 12 }]);
        expect(r.allocations.map(a => a.name)).toEqual([ "a", "b" ]);
    });
    it("reports what does not fit and keeps going with smaller ones", () => {
        const r = vlsm(ip("192.168.1.0"), 24, [{ name: "a", hosts: 100 }, { name: "huge", hosts: 300 }, { name: "small", hosts: 10 }, { name: "b", hosts: 100 }]);
        expect(r.failed.map(f => f.name)).toEqual([ "huge", "small" ]);
        expect(r.allocations.map(a => `${a.name} ${cidr(a)}`)).toEqual([ "a 192.168.1.0/25", "b 192.168.1.128/25" ]);
        expect(r.free).toEqual([]);
    });
    it("rejects invalid host counts", () => {
        const r = vlsm(ip("192.168.1.0"), 24, [{ name: "zero", hosts: 0 }, { name: "ok", hosts: 5 }]);
        expect(r.failed.map(f => f.name)).toEqual([ "zero" ]);
        expect(cidr(r.allocations[0])).toBe("192.168.1.0/29");
    });
});

describe("freeBlocks", () => {
    it("covers a range with aligned blocks", () => {
        expect(freeBlocks(ip("10.0.0.0"), ip("10.0.1.0")).map(cidr)).toEqual([ "10.0.0.0/24" ]);
        expect(freeBlocks(ip("10.0.0.4"), ip("10.0.0.16")).map(cidr)).toEqual([ "10.0.0.4/30", "10.0.0.8/29" ]);
        expect(freeBlocks(0, 2 ** 32).map(cidr)).toEqual([ "0.0.0.0/0" ]);
        expect(freeBlocks(5, 5)).toEqual([]);
    });
});
