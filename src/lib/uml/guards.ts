import type { DiagramNode } from "../../types/diagram";

/** Fixed characters around a text: the user types only the inside, the editor shows both ends. */
export interface Adornment {
    prefix: string;
    suffix: string;
}

export const BRACKETS: Adornment = { prefix: "[", suffix: "]" };
export const BRACES: Adornment = { prefix: "{", suffix: "}" };

/** The text without its adornment (one pair at most) and without surrounding spaces. */
export function unwrap(value: string, a: Adornment): string {
    let v = String(value ?? "").trim();
    if (v.startsWith(a.prefix)) v = v.slice(a.prefix.length);
    if (v.endsWith(a.suffix)) v = v.slice(0, -a.suffix.length);
    return v.trim();
}

/** The text inside its adornment; an empty text stays empty. */
export function wrap(value: string, a: Adornment): string {
    const inner = unwrap(value, a);
    return inner ? `${a.prefix}${inner}${a.suffix}` : "";
}

/** Fragment operators whose condition is a guard in [ ]. `loop` also takes `(min,max)` and is typed as it is. */
const GUARDED_OPERATORS = new Set([ "alt", "opt", "break" ]);

/** Adornment of a node field: guards of operands and fragments in [ ], state invariants in { }. */
export function nodeAdornment(n: DiagramNode, key: string): Adornment | null {
    if (n.type === "operand" && key === "text") return BRACKETS;
    if (n.type === "invariant" && key === "text") return BRACES;
    if (n.type === "fragment" && key === "attrs" && GUARDED_OPERATORS.has(String(n.text).trim().toLowerCase())) return BRACKETS;
    return null;
}

/** Parts of a transition label `trigger [guard] / effect`; every part may be empty. */
export interface Transition {
    trigger: string;
    guard: string;
    effect: string;
}

/**
 * Splits a transition label. The guard is the first [ ] pair, the effect follows the first slash after it
 * (or the first slash at all when there is no guard).
 */
export function parseTransition(label: string): Transition {
    const s = String(label ?? "").trim();
    const open = s.indexOf("["), close = open < 0 ? -1 : s.indexOf("]", open);
    if (open >= 0 && close > open) {
        const rest = s.slice(close + 1).trim();
        return { trigger: s.slice(0, open).trim(), guard: s.slice(open + 1, close).trim(), effect: rest.startsWith("/") ? rest.slice(1).trim() : rest };
    }
    const slash = s.indexOf("/");
    if (slash < 0) return { trigger: s, guard: "", effect: "" };
    return { trigger: s.slice(0, slash).trim(), guard: "", effect: s.slice(slash + 1).trim() };
}

export function formatTransition(t: Transition): string {
    const guard = t.guard.trim(), effect = t.effect.trim();
    return [ t.trigger.trim(), guard && `[${guard}]`, effect && `/ ${effect}` ].filter(Boolean).join(" ");
}
