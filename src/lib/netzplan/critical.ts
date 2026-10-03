import type { Diagram, DiagramEdge, DiagramNode } from "../../types/diagram";
import { isActivity } from "../diagram";
import { num } from "../math";

/** Activity on the critical path: calculated and total float (GP) 0. */
export function isCritical(n: DiagramNode | undefined): boolean {
    return isActivity(n) && n.f.gp !== "" && num(n.f.gp) === 0 && n.f.faz !== "";
}

/** Arrow on the critical path: both ends critical and without a gap (FEZ = FAZ). */
export function isCriticalEdge(d: Diagram, e: DiagramEdge): boolean {
    const a = d.nodes.find(n => n.id === e.from), b = d.nodes.find(n => n.id === e.to);
    return isCritical(a) && isCritical(b) && isActivity(a) && isActivity(b) && num(a.f.fez) === num(b.f.faz);
}
