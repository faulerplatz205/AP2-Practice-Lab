import { describe, expect, it } from "vitest";
import { buildPdf } from "./pdf";

async function latin1(blob: Blob): Promise<string> {
    return String.fromCharCode(...new Uint8Array(await blob.arrayBuffer()));
}

describe("pdf", () => {
    it("writes a one-page PDF with a valid cross-reference table", async() => {
        const s = await latin1(buildPdf({ width: 2, height: 1, data: new Uint8Array([ 1, 2, 3, 4, 5, 6 ]), filter: "/FlateDecode" }, "Größe (Test) – €", new Date(2026, 9, 15)));
        expect(s.startsWith("%PDF-1.4")).toBe(true);
        expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
        expect(s).toContain("15.10.2026");
        expect(s).toContain("(Größe \\(Test\\) \u0096 \u0080)");
        const xref = Number(/startxref\n(\d+)/.exec(s)![1]);
        expect(s.slice(xref, xref + 4)).toBe("xref");
        [ ...s.matchAll(/(\d{10}) 00000 n/g) ].forEach((m, k) => {
            const offset = Number(m[1]), head = `${k + 1} 0 obj`;
            expect(s.slice(offset, offset + head.length)).toBe(head);
        });
    });

    it("uses landscape for wide images", async() => {
        const s = await latin1(buildPdf({ width: 300, height: 100, data: new Uint8Array(0), filter: "/DCTDecode" }, "x"));
        expect(s).toContain("/MediaBox [0 0 841.89 595.28]");
    });
});
