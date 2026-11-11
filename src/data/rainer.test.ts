import { describe, expect, it } from "vitest";
import { isRainer } from "./rainer";

describe("viewer called Rainer", () => {
    it("matches the name as a word, in any case", () => {
        for (const name of [ "Rainer", "rainer müller", "Hans-Rainer Schmidt", "RAINER" ]) expect(isRainer(name)).toBe(true);
        for (const name of [ "", "Trainer", "Rainerle", "Reiner", "Fabi" ]) expect(isRainer(name)).toBe(false);
    });
});
