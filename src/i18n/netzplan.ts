import { defineText } from "./locale";
import type { ActivityKey } from "../types/diagram";

/**
 * Short labels of the fields in an activity node. German follows the IHK
 * exam, English uses the usual CPM terms (early/late start/finish, total/free float).
 */
export const fieldLabels = defineText<Record<ActivityKey, string>>(
    { faz: "FAZ", fez: "FEZ", saz: "SAZ", sez: "SEZ", gp: "GP", fp: "FP", nr: "Nr.", d: "D", name: "" },
    { faz: "ES", fez: "EF", saz: "LS", sez: "LF", gp: "TF", fp: "FF", nr: "No.", d: "D", name: "" },
);
