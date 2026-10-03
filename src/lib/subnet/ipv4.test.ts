import { describe, expect, it } from "vitest";
import {
    addressClass, analyzeIpv4, formatIpv4, maskToPrefix, parseCidr, parseIpv4, parsePrefixOrMask, prefixForHosts, prefixToMask, rangeKind, toBinary,
} from "./ipv4";

const ip = (text: string): number => parseIpv4(text)!;

describe("parseIpv4", () => {
    it("parses valid addresses", () => {
        expect(parseIpv4("192.168.1.10")).toBe(0xc0a8010a);
        expect(parseIpv4(" 0.0.0.0 ")).toBe(0);
        expect(parseIpv4("255.255.255.255")).toBe(0xffffffff);
        expect(parseIpv4("010.001.000.001")).toBe(ip("10.1.0.1"));
    });
    it("rejects invalid addresses", () => {
        for (const bad of [ "", "1.2.3", "1.2.3.4.5", "256.1.1.1", "1.2.3.-4", "a.b.c.d", "1..2.3", "1.2.3.4/24", "1234.1.1.1" ]) {
            expect(parseIpv4(bad), bad).toBeNull();
        }
    });
    it("round-trips through formatIpv4", () => {
        expect(formatIpv4(ip("172.16.45.130"))).toBe("172.16.45.130");
        expect(formatIpv4(0xffffffff)).toBe("255.255.255.255");
    });
});

describe("masks and prefixes", () => {
    it("converts prefixes to masks", () => {
        expect(formatIpv4(prefixToMask(0))).toBe("0.0.0.0");
        expect(formatIpv4(prefixToMask(21))).toBe("255.255.248.0");
        expect(formatIpv4(prefixToMask(26))).toBe("255.255.255.192");
        expect(formatIpv4(prefixToMask(32))).toBe("255.255.255.255");
    });
    it("converts masks to prefixes", () => {
        for (let p = 0; p <= 32; p++) expect(maskToPrefix(prefixToMask(p))).toBe(p);
    });
    it("rejects non-contiguous masks", () => {
        expect(maskToPrefix(ip("255.0.255.0"))).toBeNull();
        expect(maskToPrefix(ip("255.255.255.193"))).toBeNull();
        expect(maskToPrefix(ip("0.255.255.255"))).toBeNull();
        expect(parsePrefixOrMask("255.255.0.255")).toEqual({ ok: false, error: "maskNotContiguous" });
    });
    it("parses prefix or mask notation", () => {
        expect(parsePrefixOrMask("/26")).toEqual({ ok: true, value: 26 });
        expect(parsePrefixOrMask(" 26 ")).toEqual({ ok: true, value: 26 });
        expect(parsePrefixOrMask("255.255.255.192")).toEqual({ ok: true, value: 26 });
        expect(parsePrefixOrMask("33")).toEqual({ ok: false, error: "prefix" });
        expect(parsePrefixOrMask("255.255.255")).toEqual({ ok: false, error: "mask" });
        expect(parsePrefixOrMask("")).toEqual({ ok: false, error: "empty" });
    });
});

describe("parseCidr", () => {
    it("accepts CIDR, space separated mask and separate mask input", () => {
        const expected = { ok: true, value: { address: ip("192.168.1.10"), prefix: 26 } };
        expect(parseCidr("192.168.1.10/26")).toEqual(expected);
        expect(parseCidr("192.168.1.10 / 26")).toEqual(expected);
        expect(parseCidr("192.168.1.10 255.255.255.192")).toEqual(expected);
        expect(parseCidr("192.168.1.10", "255.255.255.192")).toEqual(expected);
        expect(parseCidr("192.168.1.10", "/26")).toEqual(expected);
    });
    it("reports what is wrong", () => {
        expect(parseCidr("")).toEqual({ ok: false, error: "empty" });
        expect(parseCidr("192.168.1/24")).toEqual({ ok: false, error: "address" });
        expect(parseCidr("192.168.1.10/40")).toEqual({ ok: false, error: "prefix" });
        expect(parseCidr("192.168.1.10")).toEqual({ ok: false, error: "empty" });
        expect(parseCidr("10.0.0.1 255.0.255.0")).toEqual({ ok: false, error: "maskNotContiguous" });
    });
});

describe("analyzeIpv4", () => {
    it("computes a typical exam example", () => {
        const info = analyzeIpv4(ip("172.16.45.130"), 21);
        expect(formatIpv4(info.network)).toBe("172.16.40.0");
        expect(formatIpv4(info.broadcast!)).toBe("172.16.47.255");
        expect(formatIpv4(info.firstHost)).toBe("172.16.40.1");
        expect(formatIpv4(info.lastHost)).toBe("172.16.47.254");
        expect(formatIpv4(info.mask)).toBe("255.255.248.0");
        expect(formatIpv4(info.wildcard)).toBe("0.0.7.255");
        expect(info.usableHosts).toBe(2046);
        expect(info.totalAddresses).toBe(2048);
        expect(info.addressClass).toBe("B");
        expect(info.range).toBe("private");
        expect(info.isHostAddress).toBe(true);
    });
    it("handles /31 as point-to-point link (RFC 3021)", () => {
        const info = analyzeIpv4(ip("10.0.0.7"), 31);
        expect(info.special).toBe("p2p");
        expect(info.broadcast).toBeNull();
        expect(formatIpv4(info.firstHost)).toBe("10.0.0.6");
        expect(formatIpv4(info.lastHost)).toBe("10.0.0.7");
        expect(info.usableHosts).toBe(2);
    });
    it("handles /32 as a single host", () => {
        const info = analyzeIpv4(ip("8.8.8.8"), 32);
        expect(info.special).toBe("host");
        expect(info.broadcast).toBeNull();
        expect(info.firstHost).toBe(info.lastHost);
        expect(info.usableHosts).toBe(1);
        expect(info.isHostAddress).toBe(false);
    });
    it("handles /0 and /30", () => {
        const all = analyzeIpv4(ip("1.2.3.4"), 0);
        expect(all.network).toBe(0);
        expect(all.broadcast).toBe(0xffffffff);
        expect(all.usableHosts).toBe(2 ** 32 - 2);
        expect(analyzeIpv4(ip("192.168.0.5"), 30).usableHosts).toBe(2);
    });
});

describe("classes and ranges", () => {
    it("knows the address classes", () => {
        expect(addressClass(ip("10.0.0.1"))).toBe("A");
        expect(addressClass(ip("127.255.0.1"))).toBe("A");
        expect(addressClass(ip("128.0.0.1"))).toBe("B");
        expect(addressClass(ip("191.255.0.1"))).toBe("B");
        expect(addressClass(ip("192.0.0.1"))).toBe("C");
        expect(addressClass(ip("224.0.0.1"))).toBe("D");
        expect(addressClass(ip("240.0.0.1"))).toBe("E");
    });
    it("recognises special ranges", () => {
        expect(rangeKind(ip("10.20.30.40"))).toBe("private");
        expect(rangeKind(ip("172.31.255.255"))).toBe("private");
        expect(rangeKind(ip("172.32.0.1"))).toBe("public");
        expect(rangeKind(ip("192.168.0.1"))).toBe("private");
        expect(rangeKind(ip("127.0.0.1"))).toBe("loopback");
        expect(rangeKind(ip("169.254.10.1"))).toBe("linkLocal");
        expect(rangeKind(ip("100.64.0.1"))).toBe("cgnat");
        expect(rangeKind(ip("100.127.255.255"))).toBe("cgnat");
        expect(rangeKind(ip("100.128.0.0"))).toBe("public");
        expect(rangeKind(ip("224.0.0.251"))).toBe("multicast");
        expect(rangeKind(ip("255.255.255.255"))).toBe("broadcast");
        expect(rangeKind(ip("203.0.113.9"))).toBe("documentation");
        expect(rangeKind(ip("8.8.8.8"))).toBe("public");
    });
});

describe("helpers", () => {
    it("writes binary with octet dots", () => {
        expect(toBinary(ip("192.168.1.10"))).toBe("11000000.10101000.00000001.00001010");
    });
    it("finds the smallest prefix for a host count", () => {
        expect(prefixForHosts(1)).toBe(30);
        expect(prefixForHosts(2)).toBe(30);
        expect(prefixForHosts(3)).toBe(29);
        expect(prefixForHosts(62)).toBe(26);
        expect(prefixForHosts(63)).toBe(25);
        expect(prefixForHosts(254)).toBe(24);
        expect(prefixForHosts(0)).toBeNull();
        expect(prefixForHosts(1.5)).toBeNull();
    });
});
