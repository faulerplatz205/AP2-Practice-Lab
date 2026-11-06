import { describe, expect, it } from "vitest";
import type { DiagramMode } from "../types/diagram";
import { KNOWLEDGE_BASE, knowledgeUrl } from "./knowledge";

const MODES: DiagramMode[] = [ "netz", "akt", "uc", "kl", "seq", "zu", "obj", "komp", "vert", "pak", "er", "rel", "frei" ];

describe("knowledgeUrl", () => {
    it("links every diagram kind except free drawing", () => {
        for (const mode of MODES) {
            for (const locale of [ "de", "en" ] as const) {
                const url = knowledgeUrl(mode, locale);
                if (mode === "frei") expect(url).toBeUndefined();
                else expect(url?.startsWith(`${KNOWLEDGE_BASE}${locale === "de" ? "/de" : ""}/docs/`)).toBe(true);
            }
        }
    });

    it("uses the article in the language of the UI", () => {
        expect(knowledgeUrl("er", "de")).toBe("https://knowledge.moritz-grimm.dev/de/docs/fundamentals/databases/er-model");
        expect(knowledgeUrl("er", "en")).toBe("https://knowledge.moritz-grimm.dev/docs/fundamentals/databases/er-model");
        expect(knowledgeUrl("obj", "de")).toMatch(/#objektdiagramm$/);
        expect(knowledgeUrl("obj", "en")).toMatch(/#object-diagram$/);
    });
});
