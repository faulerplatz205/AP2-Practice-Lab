import { describe, expect, it } from "vitest";
import { EXERCISE_KINDS, type Exercise, type ExerciseField, checkExercise, checkField, generateExercise, parseInteger, seededRandom } from "./exercises";
import { analyzeIpv4, formatIpv4, parseIpv4, prefixToMask } from "./ipv4";
import { parseIpv6, shortenIpv6 } from "./ipv6";

const f = (answer: ExerciseField["answer"], solution: string): ExerciseField => ({ id: "x", key: "network", answer, solution });

function solutions(ex: Exercise): Record<string, string> {
    return Object.fromEntries(ex.fields.map(x => [ x.id, x.solution ]));
}

describe("generateExercise", () => {
    it("is deterministic with a seed", () => {
        expect(generateExercise(seededRandom(42))).toEqual(generateExercise(seededRandom(42)));
    });
    it("produces solvable tasks of every kind", () => {
        const random = seededRandom(7);
        for (const kind of EXERCISE_KINDS) {
            for (let k = 0; k < 50; k++) {
                const ex = generateExercise(random, kind);
                expect(ex.task.kind).toBe(kind);
                expect(ex.fields.length).toBeGreaterThan(0);
                expect(new Set(ex.fields.map(x => x.id)).size).toBe(ex.fields.length);
                expect(checkExercise(ex, solutions(ex)).allCorrect, JSON.stringify(ex)).toBe(true);
            }
        }
    });
    it("computes network and broadcast correctly", () => {
        const random = seededRandom(3);
        for (let k = 0; k < 30; k++) {
            const ex = generateExercise(random, "networkBroadcast");
            if (ex.task.kind !== "networkBroadcast") throw new Error();
            const info = analyzeIpv4(parseIpv4(ex.task.address)!, ex.task.prefix);
            expect(ex.fields.map(x => x.solution)).toEqual([ formatIpv4(info.network), formatIpv4(info.broadcast!) ]);
        }
    });
    it("asks for something to shorten in IPv6 tasks", () => {
        const random = seededRandom(11);
        for (let k = 0; k < 30; k++) {
            const ex = generateExercise(random, "ipv6Shorten");
            if (ex.task.kind !== "ipv6Shorten") throw new Error();
            expect(ex.fields[0].solution).toContain("::");
            expect(shortenIpv6(parseIpv6(ex.task.address)!)).toBe(ex.fields[0].solution);
        }
    });
    it("uses distinct block sizes in VLSM tasks so the order is unambiguous", () => {
        const random = seededRandom(5);
        for (let k = 0; k < 30; k++) {
            const ex = generateExercise(random, "vlsm");
            const prefixes = ex.fields.filter(x => x.key === "prefix").map(x => x.solution);
            expect(new Set(prefixes).size).toBe(3);
        }
    });
});

describe("checkField", () => {
    it("is tolerant of whitespace", () => {
        expect(checkField(f("ipv4", "10.0.0.0"), " 10 . 0 . 0 . 0 ").correct).toBe(true);
    });
    it("accepts prefixes with and without slash", () => {
        expect(checkField(f("prefix", "/26"), "26").correct).toBe(true);
        expect(checkField(f("prefix", "/26"), "/26").correct).toBe(true);
        expect(checkField(f("prefix", "/26"), "/27").tip).toBe("wrong");
        expect(checkField(f("prefix", "/26"), "255.255.255.192").tip).toBe("format");
    });
    it("accepts a dotted mask or a prefix for netmask fields", () => {
        expect(checkField(f("netmask", "/27"), "255.255.255.224").correct).toBe(true);
        expect(checkField(f("netmask", "/27"), "27").correct).toBe(true);
        expect(checkField(f("netmask", "/27"), "255.255.255.225").tip).toBe("maskNotContiguous");
    });
    it("wants a dotted mask for mask fields", () => {
        const mask = formatIpv4(prefixToMask(20));
        expect(checkField(f("mask", mask), "255.255.240.0").correct).toBe(true);
        expect(checkField(f("mask", mask), "/20").tip).toBe("format");
        expect(checkField(f("mask", mask), "255.240.255.0").tip).toBe("maskNotContiguous");
    });
    it("reads integers in several notations", () => {
        expect(checkField(f("integer", "65534"), "65.534").correct).toBe(true);
        expect(checkField(f("integer", "65536"), "2^16").correct).toBe(true);
        expect(checkField(f("integer", "65536"), "2**16").correct).toBe(true);
        expect(checkField(f("integer", "62"), "64").tip).toBe("wrong");
        expect(checkField(f("integer", "62"), "sechzig").tip).toBe("format");
        expect(parseInteger("18446744073709551616")).toBe(2n ** 64n);
    });
    it("checks IPv6 notation", () => {
        const short = f("ipv6Short", "2001:db8::1");
        expect(checkField(short, "2001:DB8::1").correct).toBe(true);
        expect(checkField(short, "2001:db8:0:0:0:0:0:1").tip).toBe("notShortened");
        expect(checkField(short, "2001:db8::2").tip).toBe("wrong");
        expect(checkField(short, "2001:db8:::1").tip).toBe("format");
        const full = f("ipv6Full", "2001:0db8:0000:0000:0000:0000:0000:0001");
        expect(checkField(full, "2001:0DB8:0000:0000:0000:0000:0000:0001").correct).toBe(true);
        expect(checkField(full, "2001:db8::1").tip).toBe("notExpanded");
    });
    it("reports empty answers", () => {
        expect(checkField(f("ipv4", "10.0.0.0"), "  ").tip).toBe("empty");
    });
});

describe("checkExercise", () => {
    it("marks each field", () => {
        const ex = generateExercise(seededRandom(1), "networkBroadcast");
        const answers = solutions(ex);
        answers.broadcast = "1.2.3.4";
        const { results, allCorrect } = checkExercise(ex, answers);
        expect(allCorrect).toBe(false);
        expect(results.map(r => r.correct)).toEqual([ true, false ]);
    });
});
