import { describe, expect, it } from "vitest";
import { expandIpv6, ipv6Kind, ipv6Network, parseIpv6, parseIpv6Cidr, shortenIpv6, subnetCount, subnets64 } from "./ipv6";

const v6 = (text: string): number[] => parseIpv6(text)!;

describe("parseIpv6", () => {
    it("parses full and shortened notation", () => {
        expect(v6("2001:0db8:0000:0000:0000:ff00:0042:8329")).toEqual([ 0x2001, 0xdb8, 0, 0, 0, 0xff00, 0x42, 0x8329 ]);
        expect(v6("2001:db8::ff00:42:8329")).toEqual([ 0x2001, 0xdb8, 0, 0, 0, 0xff00, 0x42, 0x8329 ]);
        expect(v6("::")).toEqual([ 0, 0, 0, 0, 0, 0, 0, 0 ]);
        expect(v6("::1")).toEqual([ 0, 0, 0, 0, 0, 0, 0, 1 ]);
        expect(v6("fe80::")).toEqual([ 0xfe80, 0, 0, 0, 0, 0, 0, 0 ]);
        expect(v6("FE80::ABCD")).toEqual([ 0xfe80, 0, 0, 0, 0, 0, 0, 0xabcd ]);
        expect(v6("1:2:3:4:5:6:7::")).toEqual([ 1, 2, 3, 4, 5, 6, 7, 0 ]);
    });
    it("parses an embedded IPv4 address at the end", () => {
        expect(v6("::ffff:192.0.2.1")).toEqual([ 0, 0, 0, 0, 0, 0xffff, 0xc000, 0x0201 ]);
    });
    it("rejects invalid addresses", () => {
        for (const bad of [ "", "1:2:3:4:5:6:7", "1:2:3:4:5:6:7:8:9", "1::2::3", ":::", "12345::", "g::1", ":1::", "1.2.3.4::", "1:2:3:4:5:6:7:8::" ]) {
            expect(parseIpv6(bad), bad).toBeNull();
        }
    });
    it("parses a prefix", () => {
        expect(parseIpv6Cidr("2001:db8::/48")).toEqual({ address: v6("2001:db8::"), prefix: 48 });
        expect(parseIpv6Cidr("2001:db8::")?.prefix).toBe(128);
        expect(parseIpv6Cidr("2001:db8::/129")).toBeNull();
        expect(parseIpv6Cidr("2001:db8::/x")).toBeNull();
    });
});

describe("RFC 5952 shortening", () => {
    it("drops leading zeros and compresses the longest zero run", () => {
        expect(shortenIpv6(v6("2001:0db8:0000:0000:0000:ff00:0042:8329"))).toBe("2001:db8::ff00:42:8329");
        expect(shortenIpv6(v6("2001:db8:0:0:1:0:0:0"))).toBe("2001:db8:0:0:1::");
    });
    it("takes the first run on a tie", () => {
        expect(shortenIpv6(v6("2001:db8:0:0:1:0:0:1"))).toBe("2001:db8::1:0:0:1");
    });
    it("does not compress a single zero group", () => {
        expect(shortenIpv6(v6("2001:db8:0:1:1:1:1:1"))).toBe("2001:db8:0:1:1:1:1:1");
    });
    it("handles all zero, loopback and lower case", () => {
        expect(shortenIpv6(v6("0:0:0:0:0:0:0:0"))).toBe("::");
        expect(shortenIpv6(v6("0:0:0:0:0:0:0:1"))).toBe("::1");
        expect(shortenIpv6(v6("2001:DB8::ABCD"))).toBe("2001:db8::abcd");
    });
    it("expands to 32 hex digits", () => {
        expect(expandIpv6(v6("2001:db8::1"))).toBe("2001:0db8:0000:0000:0000:0000:0000:0001");
    });
});

describe("prefixes", () => {
    it("computes the network address", () => {
        expect(shortenIpv6(ipv6Network(v6("2001:db8:abcd:1234:5678::1"), 48))).toBe("2001:db8:abcd::");
        expect(shortenIpv6(ipv6Network(v6("2001:db8:abcd:1234::1"), 52))).toBe("2001:db8:abcd:1000::");
        expect(shortenIpv6(ipv6Network(v6("2001:db8::1"), 128))).toBe("2001:db8::1");
        expect(shortenIpv6(ipv6Network(v6("2001:db8::1"), 0))).toBe("::");
    });
    it("counts /64 subnets", () => {
        expect(subnets64(48)).toBe(65536n);
        expect(subnets64(56)).toBe(256n);
        expect(subnets64(64)).toBe(1n);
        expect(subnets64(80)).toBe(0n);
        expect(subnets64(0)).toBe(2n ** 64n);
        expect(subnetCount(32, 48)).toBe(65536n);
    });
    it("knows address kinds", () => {
        expect(ipv6Kind(v6("::"))).toBe("unspecified");
        expect(ipv6Kind(v6("::1"))).toBe("loopback");
        expect(ipv6Kind(v6("fe80::1"))).toBe("linkLocal");
        expect(ipv6Kind(v6("fd12:3456::1"))).toBe("uniqueLocal");
        expect(ipv6Kind(v6("ff02::1"))).toBe("multicast");
        expect(ipv6Kind(v6("2001:db8::1"))).toBe("documentation");
        expect(ipv6Kind(v6("2a00:1450::1"))).toBe("globalUnicast");
        expect(ipv6Kind(v6("::ffff:10.0.0.1"))).toBe("ipv4Mapped");
    });
});
