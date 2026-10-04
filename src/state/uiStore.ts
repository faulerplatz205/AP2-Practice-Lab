import { create } from "zustand";
import { KEYS, storage } from "../lib/storage";

export type Workspace = "draw" | "subnet";

export type Dialog =
    | { type: "gantt" }
    | { type: "taskList" }
    | { type: "exercise" }
    | { type: "norm" }
    | { type: "plans" }
    | { type: "saveAs" }
    | { type: "discard"; then: () => void }
    | { type: "exportText"; filename: string; data: string }
    | { type: "image"; url: string; canvas: HTMLCanvasElement }
    | { type: "new" }
    | { type: "achievements"; tab: "ach" | "gal" }
    | { type: "guide"; chapter: number };

export interface Toast {
    text: string;
    /** Changes with every message so that the timer restarts */
    key: number;
}

/** Rainer picture on screen */
export interface Egg {
    image: string;
    pinned: boolean;
    key: number;
}

interface UiState {
    workspace: Workspace;
    dialog: Dialog | null;
    toast: Toast | null;
    egg: Egg | null;
    modeMenuOpen: boolean;
    /** Right panel expanded (folded: only a narrow strip with the toggle button) */
    panelOpen: boolean;
    open: (d: Dialog) => void;
    close: () => void;
    notify: (text: string) => void;
    set: (patch: Partial<Pick<UiState, "toast" | "egg" | "modeMenuOpen">>) => void;
    setWorkspace: (workspace: Workspace) => void;
    setPanelOpen: (panelOpen: boolean) => void;
}

let toastKey = 0;

function initialWorkspace(): Workspace {
    return storage.readText(KEYS.workspace) === "subnet" ? "subnet" : "draw";
}

export const useUi = create<UiState>()(set => ({
    workspace: initialWorkspace(),
    dialog: null,
    toast: null,
    egg: null,
    modeMenuOpen: false,
    panelOpen: storage.readText(KEYS.panel) !== "closed",
    open: (dialog): void => set({ dialog }),
    close: (): void => set({ dialog: null }),
    notify: (text): void => set({ toast: { text, key: ++toastKey } }),
    set: (patch): void => set(patch),
    setWorkspace: (workspace): void => {
        storage.write(KEYS.workspace, workspace);
        set({ workspace, modeMenuOpen: false });
    },
    setPanelOpen: (panelOpen): void => {
        storage.write(KEYS.panel, panelOpen ? "open" : "closed");
        set({ panelOpen });
    },
}));

export const notify = (text: string): void => useUi.getState().notify(text);
