import type { DiagramNode } from "../../types/diagram";
import type { Outline } from "../geometry";
import { UML_TYPES, isErRelationship, isUml } from "./types";

/** Outline that edges dock on. */
export function outline(n: DiagramNode): Outline {
    if (n.type === "ellipse" || n.type === "usecase" || (isUml(n.type) && UML_TYPES[n.type].round)) return "ellipse";
    if (n.type === "diamond" || n.type === "decision" || isErRelationship(n.type)) return "diamond";
    return "rect";
}
