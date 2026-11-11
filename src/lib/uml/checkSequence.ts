import type { DiagramEdge, DiagramNode } from "../../types/diagram";
import type { Context } from "./check";
import { inside } from "../geometry";
import { FRAGMENT_OPERATORS, RELATIONS, SEQUENCE_TYPES } from "./types";
import { activationAt, headHeight, isLifeline, messageY, ownerOf, pinnedTarget } from "./sequence";
import { text } from "../../i18n/locale";
import { seqCheckText } from "../../i18n/checkSequence";
import { umlText } from "../../i18n/diagram";

interface Message {
    e: DiagramEdge;
    y: number;
    /** Lifelines of sender and receiver (through activation bars and the destruction X) */
    from?: DiagramNode;
    to?: DiagramNode;
    label: string;
}

/** Operators with several operands, separated by dashed lines. */
const MULTI = new Set([ "alt", "par", "seq", "strict" ]);
/** Operators whose operand starts with a guard (loop also accepts `(min,max)`). */
const GUARDED = new Set([ "alt", "opt", "loop", "break" ]);
/** Fragments that need not enclose a message: a reference and the diagram frame. */
const NO_CONTENT = new Set([ "ref", "sd" ]);

const operation = (label: string): string => label.split("(")[0].trim().toLowerCase();

/** Guard `[…]` at the start; the default placeholder of a new fragment does not count. */
function hasGuard(s: string | undefined, loop: boolean): boolean {
    const v = String(s ?? "").trim();
    const placeholders = [ umlText.de.fragment.attrs, umlText.en.fragment.attrs ].map(x => String(x).toLowerCase());
    if (placeholders.includes(v.toLowerCase())) return false;
    return /^\[[^\]]*\S[^\]]*\]/.test(v) || (loop && /^\(\s*\d+\s*(,\s*(\d+|\*|n)\s*)?\)/i.test(v));
}

const guardText = (s: string | undefined): string => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** Rules: docs/check-rules.md, section „Sequence Diagram“. Messages in the current language. */
export function checkSequence(c: Context): void {
    const t = text(seqCheckText);
    const all = c.d.nodes;
    const lifelines = all.filter(isLifeline);
    if (!lifelines.length) return;
    c.kinds.add("seq");

    const messages: Message[] = c.edges.filter(e => RELATIONS[c.kind(e)]?.seq).map(e => {
        const a = c.node(e.from), b = c.node(e.to);
        return { e, y: messageY(e, a, b), from: ownerOf(a, all), to: ownerOf(b, all), label: (e.label || "").trim() };
    }).sort((p, q) => p.y - q.y);
    const touches = (m: Message, l: DiagramNode): boolean => m.from === l || m.to === l;

    const names = new Map<string, DiagramNode>();
    for (const l of lifelines) {
        if (!messages.some(m => touches(m, l))) c.add("warn", t.lifelineNoMessages(c.name(l)), l, t.lifelineNoMessagesTip);
        const name = String(l.text || "").trim(), key = name.replace(/\s+/g, "").toLowerCase();
        if (!name || name === ":") c.add("warn", t.lifelineNoName, l, t.lifelineNoNameTip);
        else if (l.type === "lifeline" && !name.includes(":") && /\s/.test(name)) c.add("warn", t.lifelineActivity(name), l, t.lifelineActivityTip);
        if (key && key !== ":" && names.has(key)) c.add("warn", t.lifelineDuplicate(name), l, t.lifelineDuplicateTip);
        names.set(key, l);
    }

    for (const m of messages) {
        const kind = c.kind(m.e), a = c.node(m.e.from), b = c.node(m.e.to);
        if (!SEQUENCE_TYPES.has(a.type) || !SEQUENCE_TYPES.has(b.type) || !m.from || !m.to) {
            c.add("error", t.messageBetweenLifelines, null, t.messageBetweenLifelinesTip, [ m.e.id ]);
            continue;
        }
        const outside = [ m.from, m.to ].some(l => !!l && pinnedTarget(m.e, b) !== "head" && (m.y < l.y + headHeight(l) || m.y > l.y + l.h));
        if (outside && c.node(m.e.to).type !== "destroy") c.add("error", t.messageOutside(m.label || "…"), null, t.messageOutsideTip, [ m.e.id ]);
        if (kind === "create") continue;
        if (!m.label) c.add("warn", t.messageNoName, null, t.messageNoNameTip, [ m.e.id ]);
        else if ((kind === "msg" || kind === "async") && !m.label.includes("(") && !m.label.startsWith("«")) c.add("warn", t.messageNoParens(m.label), null, t.messageNoParensTip, [ m.e.id ]);
    }
    for (const e of c.edges.filter(x => !RELATIONS[c.kind(x)].seq && c.kind(x) !== "anchor" && SEQUENCE_TYPES.has(c.node(x.from).type) && SEQUENCE_TYPES.has(c.node(x.to).type))) {
        c.add("warn", t.useMessageArrows, null, t.useMessageArrowsTip, [ e.id ]);
    }

    // calls and replies: each reply answers the nearest unanswered synchronous call above it in the other direction
    const answered = new Set<Message>();
    for (const r of messages.filter(m => c.kind(m.e) === "reply" && m.from && m.to && m.from !== m.to)) {
        const call = messages.filter(m => c.kind(m.e) === "msg" && !answered.has(m) && m.from === r.to && m.to === r.from && m.y < r.y && c.node(m.e.to).type !== "destroy").pop();
        if (!call) {
            c.add("error", t.replyNoCall(r.label || "…"), null, t.replyNoCallTip, [ r.e.id ]);
            continue;
        }
        answered.add(call);
        const receiver = activationAt(all, r.from!, call.y), caller = activationAt(all, r.to!, call.y);
        for (const [ bar, l ] of [[ receiver, r.from! ], [ caller, r.to! ]] as const) {
            if (bar && bar.y + bar.h < r.y - 2) c.add("warn", t.activationEndsEarly(c.name(l), r.label || "…"), bar, t.activationEndsEarlyTip, [ r.e.id ]);
        }
        if (r.label.includes("(") && operation(r.label) === operation(call.label)) c.add("warn", t.replyOperation(r.label), null, t.replyOperationTip, [ r.e.id ]);
    }
    for (const m of messages) {
        if (c.kind(m.e) === "msg" && m.from && m.to && m.from !== m.to && !answered.has(m) && c.node(m.e.to).type !== "destroy") {
            c.add("info", t.callNoReply(m.label || "…"), null, t.callNoReplyTip, [ m.e.id ]);
        }
    }

    for (const a of c.ofType("activation")) {
        const l = ownerOf(a, all);
        if (!l) {
            c.add("warn", t.activationOff, a, t.activationOffTip);
            continue;
        }
        // the lifeline that starts the interaction has no incoming message
        const initiator = !messages.some(m => m.to === l && m.from !== l);
        if (l.type === "lifeline" && !initiator && !messages.some(m => m.to === l && m.y >= a.y - 6 && m.y <= a.y + a.h)) c.add("warn", t.activationNoMessage(c.name(l)), a, t.activationNoMessageTip);
    }

    const destroyed = new Map<DiagramNode, DiagramNode>();
    for (const x of c.ofType("destroy")) {
        const l = ownerOf(x, all);
        if (!l) {
            c.add("warn", t.destroyOff, x, t.destroyOffTip);
            continue;
        }
        if (destroyed.has(l)) {
            c.add("warn", t.destroyTwice(c.name(l)), x);
            continue;
        }
        destroyed.set(l, x);
        if (l.y + l.h > x.y + x.h + 10) c.add("warn", t.destroyNotAtEnd(c.name(l)), l, t.destroyNotAtEndTip);
        const late = messages.filter(m => touches(m, l) && m.e.to !== x.id && m.y > x.y + x.h / 2 + 4);
        if (late.length) c.add("error", t.afterDestroy(c.name(l)), x, t.afterDestroyTip, late.map(m => m.e.id));
    }

    const created = new Set<DiagramNode>();
    for (const m of messages.filter(x => c.kind(x.e) === "create")) {
        const b = c.node(m.e.to);
        if (!pinnedTarget(m.e, b) || b.type !== "lifeline") {
            c.add("error", t.createTarget, null, t.createTargetTip, [ m.e.id ]);
            continue;
        }
        if (created.has(b)) {
            c.add("warn", t.createTwice(c.name(b)), b, "", [ m.e.id ]);
            continue;
        }
        created.add(b);
        const early = messages.filter(x => x !== m && touches(x, b) && x.y < m.y - 4);
        if (early.length) c.add("error", t.beforeCreate(c.name(b)), b, t.beforeCreateTip, early.map(x => x.e.id));
    }

    for (const v of c.ofType("invariant")) {
        const label = String(v.text || "").trim();
        if (!ownerOf(v, all)) c.add("warn", t.invariantOff, v, t.invariantOffTip);
        if (!/^\{.*\}$/s.test(label)) c.add("warn", t.invariantBraces(label || "…"), v, t.invariantBracesTip);
    }

    const fragments = c.ofType("fragment");
    const fragmentOf = (o: DiagramNode): DiagramNode | undefined =>
        fragments.filter(f => inside(o, f)).sort((p, q) => p.w * p.h - q.w * q.h)[0];
    const operands = new Map<DiagramNode, DiagramNode[]>(fragments.map(f => [ f, []]));
    for (const o of c.ofType("operand")) {
        const f = fragmentOf(o);
        if (f) operands.get(f)!.push(o);
        else c.add("warn", t.operandOutside, o, t.operandOutsideTip);
    }
    for (const f of fragments) {
        // `loop(1,3)` carries its bounds in the operator tab
        const op = String(f.text || "").trim().toLowerCase().replace(/\s*\(.*\)$/, ""), seps = operands.get(f)!.sort((p, q) => p.y - q.y);
        if (!FRAGMENT_OPERATORS.includes(op)) {
            c.add("warn", t.fragmentUnknown(String(f.text || "").trim() || "…"), f, t.fragmentUnknownTip);
            continue;
        }
        if (/\]\s*\[/.test(String(f.attrs ?? ""))) c.add("warn", t.operandsGlued(op), f, t.operandsGluedTip);
        const enclosed = messages.some(m => m.y > f.y + 22 && m.y < f.y + f.h
            && [ m.from, m.to ].some(l => l && l.x + l.w / 2 >= f.x && l.x + l.w / 2 <= f.x + f.w));
        if (!NO_CONTENT.has(op) && !enclosed) c.add("warn", t.fragmentEmpty(op), f, t.fragmentEmptyTip);
        if (GUARDED.has(op) && !hasGuard(f.attrs, op === "loop") && !(op === "loop" && /\(.*\)$/.test(String(f.text)))) c.add("warn", t.fragmentNoGuard(op), f, t.fragmentNoGuardTip);
        if (MULTI.has(op) && !seps.length) c.add("warn", t.altOneOperand(op), f, t.altOneOperandTip);
        if (!MULTI.has(op) && seps.length) c.add("warn", t.oneOperandOnly(op), seps[0], t.oneOperandOnlyTip);
        if (op !== "alt") continue;
        for (const s of seps) if (!hasGuard(s.text, false)) c.add("warn", t.operandNoGuard, s, t.operandNoGuardTip);
        const guards = [ f.attrs, ...seps.map(s => s.text) ].map(guardText).filter(Boolean);
        if (new Set(guards).size < guards.length) c.add("warn", t.guardDuplicate(op), f, t.guardDuplicateTip);
        const elseAt = guards.findIndex(g => g === "[else]");
        if (elseAt >= 0 && elseAt < guards.length - 1) c.add("warn", t.elseNotLast, f, t.elseNotLastTip);
    }
}
