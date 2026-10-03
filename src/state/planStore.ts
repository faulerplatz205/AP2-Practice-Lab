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

const storedPlans = storage.read<SavedPlan[]>(KEYS.plans) ?? [];
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
