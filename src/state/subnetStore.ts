import { create } from "zustand";
import { type Exercise, type ExerciseKind, type FieldResult, checkExercise, generateExercise } from "../lib/subnet";
import { bump, unlock } from "./achievementStore";
import { text } from "../i18n/locale";
import { subnetText } from "../i18n/subnet";

export type SubnetTab = "calc" | "split" | "ipv6" | "train";

export interface VlsmRow {
    key: number;
    name: string;
    hosts: string;
}

interface Trainer {
    kind: ExerciseKind | "mixed";
    exercise: Exercise | null;
    answers: Record<string, string>;
    results: FieldResult[] | null;
    revealed: boolean;
    solved: boolean;
    streak: number;
}

interface SubnetState extends Trainer {
    tab: SubnetTab;
    calcInput: string;
    calcMask: string;
    splitNetwork: string;
    splitCount: string;
    vlsmNetwork: string;
    vlsmRows: VlsmRow[];
    ipv6Input: string;
    set: (patch: Partial<Omit<SubnetState, "set">>) => void;
}

let rowKey = 0;

export function vlsmRow(name: string, hosts: string): VlsmRow {
    return { key: ++rowKey, name, hosts };
}

function defaultRows(): VlsmRow[] {
    const names = text(subnetText).departments;
    return [ vlsmRow(names.sales, "50"), vlsmRow(names.it, "20"), vlsmRow(names.admin, "10"), vlsmRow("WAN", "2") ];
}

/** Inputs survive switching tabs and workspaces, but not a reload. */
export const useSubnet = create<SubnetState>()(set => ({
    tab: "calc",
    calcInput: "192.168.1.10/26",
    calcMask: "",
    splitNetwork: "192.168.10.0/24",
    splitCount: "6",
    vlsmNetwork: "192.168.20.0/24",
    vlsmRows: defaultRows(),
    ipv6Input: "2001:0db8:0000:0000:0001:0000:0000:0001/64",
    kind: "mixed",
    exercise: null,
    answers: {},
    results: null,
    revealed: false,
    solved: false,
    streak: 0,
    set: (patch): void => set(patch),
}));

/** Called after an input change with whether it produced a result. */
export function calculated(valid: boolean): void {
    if (valid) unlock("subnet_first");
}

export function newExercise(): void {
    const { kind, set } = useSubnet.getState();
    set({ exercise: generateExercise(Math.random, kind === "mixed" ? undefined : kind), answers: {}, results: null, revealed: false, solved: false });
}

export function setAnswer(id: string, value: string): void {
    const s = useSubnet.getState();
    s.set({ answers: { ...s.answers, [id]: value } });
}

export function checkAnswers(): void {
    const s = useSubnet.getState();
    if (!s.exercise) return;
    const { results, allCorrect } = checkExercise(s.exercise, s.answers);
    if (allCorrect && !s.solved && !s.revealed) {
        s.set({ results, solved: true, streak: s.streak + 1 });
        unlock("subnet_ok");
        bump("subnets");
    } else {
        s.set({ results, streak: allCorrect || s.solved ? s.streak : 0 });
    }
}

export function revealSolution(): void {
    const s = useSubnet.getState();
    if (!s.exercise) return;
    s.set({ revealed: true, streak: s.solved ? s.streak : 0 });
}
