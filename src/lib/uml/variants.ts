import type { DiagramMode, DiagramNode, NodeType, Stereotype } from "../../types/diagram";
import { defaultSize, minSize } from "../diagram";
import { snap } from "../math";
import { FRAGMENT_OPERATORS, UML_TYPES, isUml } from "./types";
import { text } from "../../i18n/locale";
import { umlText } from "../../i18n/diagram";
import { panelText } from "../../i18n/panel";
import { dbText } from "../../i18n/database";
import { modeText } from "../../i18n/modes";

/** Another form the selected element can be turned into, e.g. class => abstract class, action => send signal. */
export interface Variant {
    /** Stable id for tests and keys: "type:<type>", "stereo:<stereo>", "op:<operator>" or "turn" */
    id: string;
    label: string;
    current: boolean;
    /** Mutates the node (runs inside an immer recipe) */
    apply: (n: DiagramNode) => void;
}

/** Element types that can replace each other, per diagram kind. An activity start never becomes a state. */
const TYPE_GROUPS: Partial<Record<DiagramMode, NodeType[][]>> = {
    akt: [[ "start", "end", "flowend" ], [ "action", "signal", "accept", "objnode" ]],
    zu: [[ "start", "end" ], [ "state", "compstate" ], [ "history", "deephist" ]],
    seq: [[ "lifeline", "actline" ]],
};
const GENERIC_GROUP: NodeType[] = [ "rect", "ellipse", "diamond" ];

function defaultTexts(type: NodeType): string[] {
    return isUml(type) ? [ umlText.de[type].text, umlText.en[type].text ] : [];
}

/** Changes the type in place: the centre stays, the size only when both forms carry their text inside. */
function retype(n: DiagramNode, type: NodeType): void {
    const old = n.type, cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const plain = (t: NodeType): boolean => !isUml(t) || (!UML_TYPES[t].notext && !UML_TYPES[t].box && !UML_TYPES[t].carry);
    const sameShape = (plain(old) && plain(type)) || (isUml(old) && isUml(type) && !!UML_TYPES[old].carry && !!UML_TYPES[type].carry)
        || (isUml(old) && isUml(type) && !!UML_TYPES[old].round && !!UML_TYPES[type].round && UML_TYPES[old].w === UML_TYPES[type].w);
    if (defaultTexts(old).includes(n.text) && isUml(type)) n.text = text(umlText)[type].text;
    n.type = type;
    if (!sameShape) {
        const size = defaultSize(type);
        n.w = size.w;
        n.h = size.h;
        n.x = snap(cx) - n.w / 2;
        n.y = snap(cy) - n.h / 2;
    }
    const min = minSize(type);
    n.w = Math.max(n.w, min.w);
    n.h = Math.max(n.h, min.h);
}

function typeLabel(type: NodeType, mode: DiagramMode): string {
    const items = text(modeText).items;
    if (mode === "zu" && type === "start") return items.startState;
    if (mode === "zu" && type === "end") return items.endState;
    if (isUml(type)) return text(umlText)[type].label;
    return text(panelText).shapeNames[type as "rect" | "ellipse" | "diamond"];
}

function stereoVariants(n: DiagramNode, names: Record<string, string>): Variant[] {
    return Object.entries(names).map(([ stereo, label ]) => ({
        id: `stereo:${stereo}`, label, current: (n.stereo ?? "") === stereo,
        apply: (m: DiagramNode): void => {
            m.stereo = stereo as Stereotype;
        },
    }));
}

/** All forms of `n` in the diagram kind `mode`, the current one included; empty when there is nothing to switch to. */
export function variantsOf(n: DiagramNode, mode: DiagramMode): Variant[] {
    const db = text(dbText);
    if (n.type === "class") return stereoVariants(n, text(panelText).classKinds);
    if (n.type === "entity") return stereoVariants(n, db.entityKinds);
    if (n.type === "relship") return stereoVariants(n, db.relshipKinds);
    if (n.type === "erattr") return stereoVariants(n, db.attributeKinds);
    if (n.type === "fragment") {
        if (n.text === "sd") return [];
        return FRAGMENT_OPERATORS.filter(o => o !== "sd").map(o => ({
            id: `op:${o}`, label: o, current: n.text === o,
            apply: (m: DiagramNode): void => {
                m.text = o;
            },
        }));
    }
    if (n.type === "bar") {
        const items = text(modeText).items, upright = n.h > n.w;
        const turn = (m: DiagramNode): void => {
            const cx = m.x + m.w / 2, cy = m.y + m.h / 2;
            [ m.w, m.h ] = [ m.h, m.w ];
            m.x = snap(cx - m.w / 2);
            m.y = snap(cy - m.h / 2);
        };
        return [
            { id: "turn:h", label: items.forkJoin, current: !upright, apply: m => upright && turn(m) },
            { id: "turn:v", label: items.barVertical, current: upright, apply: m => !upright && turn(m) },
        ];
    }
    const group = GENERIC_GROUP.includes(n.type) ? GENERIC_GROUP : (TYPE_GROUPS[mode] ?? Object.values(TYPE_GROUPS).flat()).find(g => g.includes(n.type));
    if (!group) return [];
    return group.map(type => ({ id: `type:${type}`, label: typeLabel(type, mode), current: n.type === type, apply: (m: DiagramNode): void => retype(m, type) }));
}
