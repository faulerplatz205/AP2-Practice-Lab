/**
 * File download. Inside the artifact through the capability `downloads`
 * (without permission `getDownloads()` returns `null` and the app shows a fallback).
 * On a normal website (no `window.claude`) as a plain browser download.
 */

interface DownloadsCapability {
    save(request: { filename: string; data: string | Blob }): Promise<{ status: "saved" | "delivered" }>;
}

interface PermissionsCapability {
    state(name: string): Promise<string>;
    manage(): Promise<void>;
}

interface ArtifactRuntime {
    use(name: string): Promise<unknown>;
}

declare global {
    interface Window {
        claude?: ArtifactRuntime;
    }
}

function requestCapability<T>(name: string): Promise<T | null> {
    try {
        if (!window.claude?.use) return Promise.resolve(null);
        const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 10000));
        // a rejected request (e.g. not granted) is treated like no permission, so the fallback still appears
        const request = Promise.resolve().then(() => window.claude!.use(name) as Promise<T | null>).catch(() => null);
        return Promise.race([ request, timeout ]);
    } catch {
        return Promise.resolve(null);
    }
}

let cached: DownloadsCapability | null = null;
let pending: Promise<DownloadsCapability | null> | null = null;

export function getDownloads(): Promise<DownloadsCapability | null> {
    if (cached) return Promise.resolve(cached);
    pending ??= requestCapability<DownloadsCapability>("downloads").then(d => {
        cached = d;
        return d;
    }).finally(() => {
        pending = null;
    });
    return pending;
}

export function getPermissions(): Promise<PermissionsCapability | null> {
    return requestCapability<PermissionsCapability>("permissions");
}

/** True inside the artifact viewer, where downloads need the capability. */
export function insideArtifact(): boolean {
    return typeof window !== "undefined" && typeof window.claude?.use === "function";
}

const MIME_TYPES: Record<string, string> = { json: "application/json", png: "image/png", pdf: "application/pdf" };

/** Media type by file extension, `application/octet-stream` for unknown ones. */
export function mimeType(filename: string): string {
    return MIME_TYPES[filename.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

/** Plain browser download through a temporary object URL. */
export function browserDownload(filename: string, data: string | Blob): boolean {
    try {
        const blob = typeof data === "string" ? new Blob([ data ], { type: mimeType(filename) }) : data;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.hidden = true;
        document.body.append(link);
        link.click();
        link.remove();
        // revoking right away can cancel the download in some browsers
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return true;
    } catch {
        return false;
    }
}

export type SaveOutcome = "saved" | "declined" | "busy" | "denied" | "unavailable";

/** Offers a file for saving. In the artifact the user confirms in a dialog of the viewer, on a website the browser downloads it. */
export async function offerFile(filename: string, data: string | Blob): Promise<SaveOutcome> {
    if (!insideArtifact()) return browserDownload(filename, data) ? "saved" : "unavailable";
    const dl = await getDownloads();
    if (!dl) return "unavailable";
    try {
        await dl.save({ filename, data });
        return "saved";
    } catch (e) {
        const code = (e as { code?: string } | null)?.code;
        if (code === "declined") return "declined";
        if (code === "rate_limited") return "busy";
        if (code === "not_granted") return "denied";
        return "unavailable";
    }
}

/** File name without extension, e.g. `ap2lab-klassendiagramm-2026-10-03` (from the mode label in the current language). */
export function fileBaseName(modeLabel: string, date = new Date()): string {
    const p = (n: number): string => String(n).padStart(2, "0");
    const slug = modeLabel.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").replace(/-+$/, "");
    return `ap2lab-${slug}-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function safeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|]+/g, "-");
}
