import { describe, expect, it } from "vitest";
import type { DiagramNode } from "../../types/diagram";
import { BRACES, BRACKETS, formatTransition, nodeAdornment, parseTransition, unwrap, wrap } from "./guards";

const node = (type: DiagramNode["type"], text: string): DiagramNode => ({ id: 1, type, x: 0, y: 0, w: 100, h: 40, fill: 0, text });

describe("adornments", () => {
    it("wraps a text once and leaves an empty one empty", () => {
        expect(wrap("x > 0", BRACKETS)).toBe("[x > 0]");
        expect(wrap(" [x > 0] ", BRACKETS)).toBe("[x > 0]");
        expect(wrap("  ", BRACKETS)).toBe("");
        expect(wrap("[]", BRACKETS)).toBe("");
        expect(wrap("aktiv", BRACES)).toBe("{aktiv}");
    });

    it("unwraps only one pair", () => {
        expect(unwrap("[a[0] > 1]", BRACKETS)).toBe("a[0] > 1");
        expect(unwrap("else", BRACKETS)).toBe("else");
    });

    it("knows which node fields are guards", () => {
        expect(nodeAdornment(node("operand", "[else]"), "text")).toBe(BRACKETS);
        expect(nodeAdornment(node("invariant", "{ok}"), "text")).toBe(BRACES);
        expect(nodeAdornment(node("fragment", "alt"), "attrs")).toBe(BRACKETS);
        expect(nodeAdornment(node("fragment", "loop"), "attrs")).toBeNull();
        expect(nodeAdornment(node("fragment", "sd"), "attrs")).toBeNull();
        expect(nodeAdornment(node("fragment", "alt"), "text")).toBeNull();
        expect(nodeAdornment(node("state", "Aktiv"), "text")).toBeNull();
    });
});

describe("transition labels", () => {
    it("splits trigger, guard and effect", () => {
        expect(parseTransition("bezahlen() [betrag > 0] / buchen()")).toEqual({ trigger: "bezahlen()", guard: "betrag > 0", effect: "buchen()" });
        expect(parseTransition("[x > 0] / zaehlen()")).toEqual({ trigger: "", guard: "x > 0", effect: "zaehlen()" });
        expect(parseTransition("timeout / abbrechen()")).toEqual({ trigger: "timeout", guard: "", effect: "abbrechen()" });
        expect(parseTransition("start")).toEqual({ trigger: "start", guard: "", effect: "" });
        expect(parseTransition("")).toEqual({ trigger: "", guard: "", effect: "" });
    });

    it("keeps a slash inside the guard", () => {
        expect(parseTransition("[a / b > 2]")).toEqual({ trigger: "", guard: "a / b > 2", effect: "" });
    });

    it("formats the parts and survives a round trip", () => {
        expect(formatTransition({ trigger: "", guard: "x > 0", effect: "zaehlen()" })).toBe("[x > 0] / zaehlen()");
        expect(formatTransition({ trigger: "ev", guard: "", effect: "" })).toBe("ev");
        for (const label of [ "bezahlen() [betrag > 0] / buchen()", "[ja]", "ev / act()", "ev" ]) expect(formatTransition(parseTransition(label))).toBe(label);
    });
});
