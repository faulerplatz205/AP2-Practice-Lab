import { describe, expect, it } from "vitest";
import { fileBaseName, insideArtifact, mimeType, safeFileName } from "./downloads";

describe("downloads", () => {
    it("knows the media type of every download format", () => {
        expect(mimeType("plan.json")).toBe("application/json");
        expect(mimeType("bild.PNG")).toBe("image/png");
        expect(mimeType("a.b.pdf")).toBe("application/pdf");
        expect(mimeType("readme")).toBe("application/octet-stream");
    });

    it("is not inside an artifact without the artifact runtime", () => {
        expect(insideArtifact()).toBe(false);
    });

    it("builds safe file names", () => {
        expect(safeFileName("Plan: A/B?")).toBe("Plan- A-B-");
        expect(fileBaseName("ER-Modell", new Date(2026, 9, 5))).toBe("ap2lab-er-modell-2026-10-05");
    });
});
