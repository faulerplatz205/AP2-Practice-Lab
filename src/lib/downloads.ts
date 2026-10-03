/**
 * File download via the Claude artifact capability `downloads`.
 * Outside an artifact (or without permission) it does not exist; then
 * `getDownloads()` returns `null` and the app shows the text for copying.
 */

interface DownloadsCapability {
    save(request: { filename: string; data: string | Blob }): Promise<{ status: "saved" | "delivered" }>;
}

interface PermissionsCapability {
    state(name: string): Promise<string>;
    manage(): Promise<void>;
}

interface ClaudeRuntime {
    use(name: string): Promise<unknown>;
}

declare global {
    interface Window {
        claude?: ClaudeRuntime;
    }
}

function requestCapability<T>(name: string): Promise<T | null> {
    try {
        if (!window.claude?.use) return Promise.resolve(null);
        const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 4000));
        return Promise.race([ window.claude.use(name) as Promise<T | null>, timeout ]);
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
        pending = null;
        return d;
    });
    return pending;
}

export function getPermissions(): Promise<PermissionsCapability | null> {
    return requestCapability<PermissionsCapability>("permissions");
}

export type SaveOutcome = "saved" | "declined" | "busy" | "denied" | "unavailable";

/** Offers a file for saving. The user confirms in a dialog by Claude. */
export async function offerFile(filename: string, data: string | Blob): Promise<SaveOutcome> {
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
