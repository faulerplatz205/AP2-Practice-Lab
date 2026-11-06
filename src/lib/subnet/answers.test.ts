import { describe, expect, it } from "vitest";
import type { AnswerKind, ExerciseField, Tip } from "./exercises";
import { checkField, parseInteger } from "./answers";

const f = (answer: AnswerKind, solution: string, extra: Partial<ExerciseField> = {}): ExerciseField => ({ id: "x", key: "network", answer, solution, ...extra });

function accepts(field: ExerciseField, ...inputs: string[]): void {
    for (const input of inputs) expect(checkField(field, input).correct, `${input} for ${field.solution}`).toBe(true);
}

function tip(field: ExerciseField, input: string): Tip | null {
    return checkField(field, input).tip;
}

describe("checkField never crashes", () => {
    const garbage = [ "", " ", "abc", "////", "::::", "1.2.3", "1..2.3", "999.1.1.1", "-1", "2^99999", "0x", "🙂", "a/b/c", "1/2/3", "%%", "\u0000", "1".repeat(500), "ja nein" ];
    const kinds: [ AnswerKind, string ][] = [
        [ "ipv4", "10.0.0.0" ], [ "prefix", "/24" ], [ "mask", "255.255.255.0" ], [ "netmask", "/24" ], [ "integer", "62" ], [ "wildcard", "0.0.0.255" ],
        [ "cidr", "10.0.0.0/22" ], [ "choice", "yes" ], [ "hex", "1a" ], [ "ipv6Short", "2001:db8::1" ], [ "ipv6Full", "2001:0db8:0000:0000:0000:0000:0000:0001" ],
        [ "ipv6Net", "2001:db8:1:2::/64" ], [ "ipv6Any", "fe80::1" ], [ "iid", "21a:2bff:fe3c:4d5e" ],
    ];
    it("gives a tip for every broken input of every answer kind", () => {
        for (const [ answer, solution ] of kinds) {
            for (const input of garbage) {
                const result = checkField(f(answer, solution, { options: [ "yes", "no" ] }), input);
                expect(result.correct).toBe(false);
                expect(result.tip).toBeTruthy();
            }
        }
        expect(checkField(f("ipv4", "10.0.0.0"), undefined as unknown as string).tip).toBe("empty");
    });
});

describe("IPv4 answers", () => {
    it("accepts spaces and leading zeros", () => {
        accepts(f("ipv4", "192.168.1.0"), " 192.168.1.0 ", "192 . 168 . 1 . 0", "192.168.001.000");
    });
    it("accepts the network with its own prefix but nothing else", () => {
        const field = f("ipv4", "192.168.1.64", { prefix: 26 });
        accepts(field, "192.168.1.64/26");
        expect(tip(field, "192.168.1.64/24")).toBe("prefixSuffix");
        expect(tip(f("ipv4", "192.168.1.64"), "192.168.1.64/26")).toBe("prefixSuffix");
    });
    it("says what is wrong with the format", () => {
        const field = f("ipv4", "10.0.0.0");
        expect(tip(field, "10,0,0,0")).toBe("comma");
        expect(tip(field, "10.0.0")).toBe("octets");
        expect(tip(field, "10.0.0.256")).toBe("octetRange");
        expect(tip(field, "10.0.x.0")).toBe("format");
        expect(tip(field, "10.0.0.1")).toBe("wrong");
    });
    it("recognises typical mix-ups through traps", () => {
        const field = f("ipv4", "10.0.0.0", { traps: [{ value: "10.0.0.255", tip: "isBroadcast" }, { value: "10.0.0.17", tip: "isGivenAddress" }] });
        expect(tip(field, "10.0.0.255")).toBe("isBroadcast");
        expect(tip(field, "010.0.0.17")).toBe("isGivenAddress");
    });
});

describe("prefix and mask answers", () => {
    it("accepts /24 and 255.255.255.0 where both are valid", () => {
        accepts(f("netmask", "/24"), "/24", "24", " / 24", "255.255.255.0", "255.255.255.000");
        accepts(f("netmask", "/20"), "255.255.240.0");
    });
    it("keeps prefix and mask fields to their own notation with a clear tip", () => {
        accepts(f("prefix", "/26"), "26", "/26", "/026");
        expect(tip(f("prefix", "/26"), "255.255.255.192")).toBe("maskInsteadOfPrefix");
        expect(tip(f("prefix", "/26"), "/33")).toBe("prefixRange");
        accepts(f("mask", "255.255.240.0"), "255.255.240.0");
        expect(tip(f("mask", "255.255.240.0"), "/20")).toBe("prefixInsteadOfMask");
        expect(tip(f("mask", "255.255.240.0"), "0.0.15.255")).toBe("isWildcard");
        expect(tip(f("mask", "255.255.240.0"), "255.240.255.0")).toBe("maskNotContiguous");
        expect(tip(f("netmask", "/27"), "255.255.255.225")).toBe("maskNotContiguous");
        expect(tip(f("netmask", "/27"), "0.0.0.31")).toBe("isWildcard");
        expect(tip(f("netmask", "/27"), "/40")).toBe("prefixRange");
        expect(tip(f("netmask", "/27"), "/26")).toBe("wrong");
    });
    it("checks wildcards and catches the plain mask", () => {
        const field = f("wildcard", "0.0.15.255");
        accepts(field, "0.0.15.255", "000.000.015.255");
        expect(tip(field, "255.255.240.0")).toBe("isMask");
        expect(tip(field, "0.0.15.254")).toBe("wildcardNotContiguous");
        expect(tip(field, "0.0.7.255")).toBe("wrong");
        expect(tip(field, "/20")).toBe("format");
    });
    it("reads routes with prefix or mask", () => {
        const field = f("cidr", "172.16.8.0/22");
        accepts(field, "172.16.8.0/22", "172.16.8.0 /22", " 172.16.8.0 / 22 ", "172.16.8.0 255.255.252.0");
        expect(tip(field, "172.16.8.0")).toBe("cidrPrefix");
        expect(tip(field, "172.16.9.0/22")).toBe("hostBits");
        expect(tip(field, "172.16.8.0/21")).toBe("wrong");
        expect(tip(field, "172.16.8/22")).toBe("octets");
    });
});

describe("integer, hex and choice answers", () => {
    it("reads integers in several notations", () => {
        accepts(f("integer", "65534"), "65534", "65.534", "65 534", "2^16-2", "2**16 - 2", "65534 Hosts");
        accepts(f("integer", "65536"), "2^16");
        expect(tip(f("integer", "62"), "sechzig")).toBe("format");
        expect(tip(f("integer", "62"), "-62")).toBe("format");
        expect(tip(f("integer", "62"), "64")).toBe("wrong");
        expect(tip(f("integer", "62", { traps: [{ value: "64", tip: "countedAll" }] }), "64")).toBe("countedAll");
        expect(parseInteger("18446744073709551616")).toBe(2n ** 64n);
        expect(parseInteger("2^999")).toBe(null);
    });
    it("reads hex with or without 0x and leading zeros", () => {
        accepts(f("hex", "1a"), "1a", "1A", "001a", "0x1A");
        expect(tip(f("hex", "1a"), "26")).toBe("wrong");
        expect(tip(f("hex", "1a"), "1g")).toBe("format");
    });
    it("accepts choices in German and English and further accepted values", () => {
        const yesNo = f("choice", "yes", { options: [ "yes", "no" ] });
        accepts(yesNo, "yes", "Ja", "j", "YES");
        expect(tip(yesNo, "nein")).toBe("wrong");
        expect(tip(yesNo, "vielleicht")).toBe("notAnOption");
        accepts(f("choice", "sales", { options: [ "sales", "it" ], accepted: [ "it" ] }), "sales", "it");
    });
});

describe("IPv6 answers", () => {
    const short = f("ipv6Short", "2001:db8::1:0:0:1");
    it("accepts upper case and notes it", () => {
        expect(checkField(short, "2001:DB8::1:0:0:1")).toEqual({ id: "x", correct: true, tip: null, note: "lowerCase" });
    });
    it("accepts the other zero run of equal length with a note", () => {
        expect(checkField(short, "2001:db8:0:0:1::1")).toEqual({ id: "x", correct: true, tip: null, note: "tieFirst" });
    });
    it("explains why a shortening is not complete", () => {
        expect(tip(short, "2001:0db8::1:0:0:1")).toBe("leadingZeros");
        expect(tip(short, "2001:db8:0:0:1:0:0:1")).toBe("notShortened");
        expect(tip(f("ipv6Short", "2001:db8::1"), "2001:db8:0::1")).toBe("longestRun");
        expect(tip(f("ipv6Short", "2001:db8:0:1:2:3:4:5"), "2001:db8::1:2:3:4:5")).toBe("singleZero");
        expect(tip(short, "2001:db8::2")).toBe("wrong");
    });
    it("says what is wrong with broken addresses", () => {
        expect(tip(short, "2001:db8:::1")).toBe("ipv6DoubleColon");
        expect(tip(short, "2001::db8::1")).toBe("ipv6DoubleColon");
        expect(tip(short, "2001:dg8::1")).toBe("ipv6Hex");
        expect(tip(short, "2001:db8:12345::1")).toBe("ipv6GroupLength");
        expect(tip(short, "2001:db8:1:2:3")).toBe("ipv6Groups");
        expect(tip(short, "2001:db8::1/64")).toBe("prefixSuffix");
    });
    it("wants all 32 digits for the full form", () => {
        const full = f("ipv6Full", "2001:0db8:0000:0000:0000:0000:0000:0001");
        accepts(full, "2001:0DB8:0000:0000:0000:0000:0000:0001", " 2001:0db8:0000:0000:0000:0000:0000:0001 ");
        expect(tip(full, "2001:db8::1")).toBe("notExpanded");
        expect(tip(full, "2001:db8:0:0:0:0:0:1")).toBe("notExpanded");
    });
    it("accepts any notation of a network, with or without its length", () => {
        const net = f("ipv6Net", "2001:db8:1:2::/64");
        accepts(net, "2001:db8:1:2::", "2001:db8:1:2::/64", "2001:0DB8:0001:0002:0000:0000:0000:0000", "2001:db8:1:2:0:0:0:0 / 64");
        expect(tip(net, "2001:db8:1:2::/48")).toBe("ipv6PrefixLength");
        expect(tip(net, "2001:db8:1:2::abcd")).toBe("hostBits6");
        expect(tip(net, "2001:db8:1:3::")).toBe("wrong");
    });
    it("checks interface ids and any address notation", () => {
        accepts(f("iid", "21a:2bff:fe3c:4d5e"), "021A:2BFF:FE3C:4D5E", "::21a:2bff:fe3c:4d5e");
        expect(tip(f("iid", "21a:2bff:fe3c:4d5e"), "21a:2bff:fe3c")).toBe("format");
        accepts(f("ipv6Any", "fe80::21a:2bff:fe3c:4d5e"), "FE80:0:0:0:21A:2BFF:FE3C:4D5E", "fe80:0000::021a:2bff:fe3c:4d5e");
    });
});
