import { create } from "zustand";
import type { DiagramMode } from "../types/diagram";
import { KEYS, storage } from "../lib/storage";

/** A plan saved under „Meine Pläne“ (my plans). `data` is the drawing as JSON text. */
export interface SavedPlan {
    id: string;
    name: string;
    mode: DiagramMode;
    created: number;
    updated: number;
    count: number;
    data: string;
}

interface PlanState {
    plans: SavedPlan[];
    currentId: string | null;
    /** Stores the list and the current plan; `false` when the browser storage is full */
    persist: (plans: SavedPlan[], currentId: string | null) => boolean;
}

const rawPlans: unknown = storage.read<unknown>(KEYS.plans);
const isPlan = (p: unknown): p is SavedPlan => !!p && typeof p === "object" && typeof (p as SavedPlan).id === "string" && typeof (p as SavedPlan).data === "string";
// broken storage must never stop the app: only well-formed entries are kept
const storedPlans: SavedPlan[] = Array.isArray(rawPlans)
    ? rawPlans.filter(isPlan)
        .map(p => ({ ...p, name: String(p.name ?? ""), created: Number(p.created) || 0, updated: Number(p.updated) || 0, count: Number(p.count) || 0 }))
    : [];
const storedCurrent = storage.readText(KEYS.currentPlan) || null;

export const usePlans = create<PlanState>()(set => ({
    plans: storedPlans,
    currentId: storedPlans.some(p => p.id === storedCurrent) ? storedCurrent : null,
    persist: (plans, currentId): boolean => {
        const ok = storage.write(KEYS.plans, plans) && storage.write(KEYS.currentPlan, currentId ?? "");
        if (ok) set({ plans, currentId });
        return ok;
    },
}));

export function currentPlan(): SavedPlan | undefined {
    const { plans, currentId } = usePlans.getState();
    return plans.find(p => p.id === currentId);
}
