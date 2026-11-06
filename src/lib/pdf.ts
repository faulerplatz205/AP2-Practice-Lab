/** Image data for the PDF: raw RGB compressed with deflate, or a JPEG. */
export interface PdfImage {
    width: number;
    height: number;
    data: Uint8Array;
    filter: "/FlateDecode" | "/DCTDecode";
}

const A4 = { short: 595.28, long: 841.89 }, MARGIN = 42.52;

/** Characters outside Latin-1 that the PDF standard fonts know (WinAnsiEncoding), others become "?". */
const WIN_ANSI: Record<number, number> = { 8364: 128, 8211: 150, 8212: 151, 8222: 132, 8220: 147, 8221: 148, 8230: 133 };

function winAnsi(s: string): number[] {
    return [ ...s ].map(ch => {
        const c = ch.codePointAt(0)!;
        return WIN_ANSI[c] ?? (c < 256 ? c : 63);
    });
}

/** Text for a PDF string literal: WinAnsi bytes with ( ) \ escaped. */
function pdfString(s: string): string {
    return winAnsi(s).map(c => (c === 40 || c === 41 || c === 92 ? "\\" : "") + String.fromCharCode(c)).join("");
}

function bytes(s: string): Uint8Array {
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 255;
    return out;
}

/** Image as PDF data: RGB on white with deflate where the browser can compress, JPEG otherwise. */
export async function canvasToPdfImage(canvas: HTMLCanvasElement): Promise<PdfImage> {
    const { width, height } = canvas;
    if (typeof CompressionStream === "function") {
        const rgba = canvas.getContext("2d")!.getImageData(0, 0, width, height).data, rgb = new Uint8Array(width * height * 3);
        for (let i = 0, j = 0; i < rgba.length; i += 4) {
            const alpha = rgba[i + 3] / 255;
            for (let k = 0; k < 3; k++) rgb[j++] = Math.round(rgba[i + k] * alpha + 255 * (1 - alpha));
        }
        const packed = await new Response(new Blob([ rgb ]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer();
        return { width, height, data: new Uint8Array(packed), filter: "/FlateDecode" };
    }
    const jpeg = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("jpeg")), "image/jpeg", 0.95));
    return { width, height, data: new Uint8Array(await jpeg.arrayBuffer()), filter: "/DCTDecode" };
}

/** One A4 page (landscape for wide images) with title, date, the image and a footer. */
export function buildPdf(image: PdfImage, title: string, date = new Date()): Blob {
    const landscape = image.width > image.height * 1.1;
    const pw = landscape ? A4.long : A4.short, ph = landscape ? A4.short : A4.long;
    const scale = Math.min((pw - 2 * MARGIN) / image.width, (ph - 2 * MARGIN - 46) / image.height, 0.4);
    const w = image.width * scale, h = image.height * scale, x = MARGIN + (pw - 2 * MARGIN - w) / 2, y = ph - MARGIN - 32 - h;
    const p2 = (n: number): string => String(n).padStart(2, "0");
    const day = `${p2(date.getDate())}.${p2(date.getMonth() + 1)}.${date.getFullYear()}`;
    const name = title.length > 80 ? title.slice(0, 79) + "…" : title;
    // Helvetica widths: digits 556, dot 278 (per 1000 units)
    const dayWidth = [ ...day ].reduce((s, c) => s + (c === "." ? 278 : 556), 0) * 9 / 1000;
    const f = (n: number): string => n.toFixed(2);
    const content = [
        `q ${f(w)} 0 0 ${f(h)} ${f(x)} ${f(y)} cm /Im0 Do Q`,
        `BT /F2 13 Tf 0.106 0.165 0.22 rg ${f(MARGIN)} ${f(ph - MARGIN - 12)} Td (${pdfString(name)}) Tj ET`,
        `BT /F1 9 Tf 0.373 0.431 0.482 rg ${f(pw - MARGIN - dayWidth)} ${f(ph - MARGIN - 11)} Td (${day}) Tj ET`,
        `0.804 0.839 0.871 RG 0.6 w ${f(MARGIN)} ${f(ph - MARGIN - 20)} m ${f(pw - MARGIN)} ${f(ph - MARGIN - 20)} l S`,
        `0.804 0.839 0.871 RG 0.6 w ${f(MARGIN)} ${f(MARGIN + 4)} m ${f(pw - MARGIN)} ${f(MARGIN + 4)} l S`,
        `BT /F1 8 Tf 0.373 0.431 0.482 rg ${f(MARGIN)} ${f(MARGIN - 8)} Td (AP2 Practice Lab) Tj ET`,
    ].join("\n");

    const parts: Uint8Array[] = [], offsets: number[] = [];
    let length = 0;
    const write = (chunk: string | Uint8Array): void => {
        const b = typeof chunk === "string" ? bytes(chunk) : chunk;
        parts.push(b);
        length += b.length;
    };
    const object = (id: number, ...body: (string | Uint8Array)[]): void => {
        offsets[id] = length;
        write(`${id} 0 obj\n`);
        body.forEach(write);
        write("\nendobj\n");
    };
    const stream = bytes(content);
    write("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    object(1, "<< /Type /Catalog /Pages 2 0 R >>");
    object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(pw)} ${f(ph)}] /Resources << /XObject << /Im0 5 0 R >> /Font << /F1 6 0 R /F2 7 0 R >> >> /Contents 4 0 R >>`);
    object(4, `<< /Length ${stream.length} >>\nstream\n`, stream, "\nendstream");
    object(5, `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ${image.filter} /Length ${image.data.length} >>\nstream\n`, image.data, "\nendstream");
    object(6, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    object(7, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    object(8, `<< /Title (${pdfString(name)}) /Producer (AP2 Practice Lab) >>`);
    const xref = length;
    write(`xref\n0 9\n0000000000 65535 f \n${offsets.slice(1).map(o => String(o).padStart(10, "0") + " 00000 n \n").join("")}`);
    write(`trailer\n<< /Size 9 /Root 1 0 R /Info 8 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: "application/pdf" });
}
