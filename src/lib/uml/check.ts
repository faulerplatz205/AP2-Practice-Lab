import type { Issue, IssueLevel, MarkSet } from "../../types/check";
import type { Diagram, DiagramEdge, DiagramMode, DiagramNode, NodeType, RelationKind } from "../../types/diagram";
import { inside, overlaps } from "../geometry";
import { FLOW_TYPES, RELATIONS, SEQUENCE_TYPES, isUml, lines } from "./types";
import { text } from "../../i18n/locale";
import { umlCheckText } from "../../i18n/check";
import { relationLabels, umlText } from "../../i18n/diagram";
import { checkEr, checkTables } from "../db/check";

export interface UmlCheckResult {
    items: Issue[];
    marks: MarkSet;
    /** Number of checked UML elements (without notes) */
    count: number;
    /** Detected diagram kinds, e.g. "kl" (class diagram) */
    kinds: Set<DiagramMode>;
}

/** Helpers that every rule group needs. Messages come from `t` (current language). */
export class Context {
    public readonly items: Issue[] = [];
    public readonly marks: MarkSet = new Set();
    public readonly kinds = new Set<DiagramMode>();
    public readonly edges: DiagramEdge[];
    public readonly t = text(umlCheckText);
    private readonly byId: Map<number, DiagramNode>;

    constructor(public readonly d: Diagram, public readonly nodes: DiagramNode[]) {
        this.byId = new Map(d.nodes.map(n => [ n.id, n ]));
        this.edges = d.edges.filter(e => this.byId.has(e.from) && this.byId.has(e.to));
    }

    public node(id: number): DiagramNode {
        return this.byId.get(id)!;
    }

    public kind(e: DiagramEdge): RelationKind {
        return e.kind ?? "flow";
    }

    /** Incoming edges without note links */
    public ins(n: DiagramNode): DiagramEdge[] {
        return this.edges.filter(e => e.to === n.id && this.kind(e) !== "anchor");
    }

    public outs(n: DiagramNode): DiagramEdge[] {
        return this.edges.filter(e => e.from === n.id && this.kind(e) !== "anchor");
    }

    public ofType(t: NodeType): DiagramNode[] {
        return this.d.nodes.filter(n => n.type === t);
    }

    public name(n: DiagramNode): string {
        return String(n.text || "").split("\n").pop()!.trim() || (isUml(n.type) ? text(umlText)[n.type].label : "");
    }

    public add(level: IssueLevel, text: string, n?: DiagramNode | null, tip?: string, edgeIds?: number[]): void {
        this.items.push({ level, text, tip, nodeId: n?.id, edgeId: edgeIds?.[0] });
        if (n) this.marks.add(`n:${n.id}`);
        edgeIds?.forEach(id => this.marks.add(`e:${id}`));
    }
}

function checkFlow(c: Context): void {
    const t = c.t;
    const flow = c.nodes.filter(n => FLOW_TYPES.has(n.type));
    if (!flow.length) return;
    const isState = c.nodes.some(n => n.type === "state");
    const isActivity = c.nodes.some(n => [ "action", "decision", "bar", "signal", "accept", "objnode" ].includes(n.type));
    if (isActivity) c.kinds.add("akt");
    if (isState) c.kinds.add("zu");

    const starts = c.ofType("start"), ends = [ ...c.ofType("end"), ...c.ofType("flowend") ];
    if (!starts.length) c.add("error", t.startMissing, null, t.startMissingTip);
    if (starts.length > 1) c.add("warn", t.manyStarts(starts.length), starts[1], t.manyStartsTip);
    if (!c.ofType("end").length && isActivity) c.add("error", t.endMissing, null, t.endMissingTip);

    for (const s of starts) {
        if (c.ins(s).length) c.add("error", t.arrowIntoStart, s, t.arrowIntoStartTip, c.ins(s).map(e => e.id));
        if (c.outs(s).length !== 1) c.add("error", c.outs(s).length ? t.startManyOut : t.startNoOut, s, t.startOutTip);
    }
    for (const e of ends) {
        if (c.outs(e).length) c.add("error", t.arrowOutOfEnd, e, t.arrowOutOfEndTip, c.outs(e).map(x => x.id));
        if (!c.ins(e).length) c.add("warn", t.endUnreached, e, t.endUnreachedTip);
    }
    for (const n of c.nodes.filter(x => [ "action", "state", "signal", "accept", "objnode" ].includes(x.type))) {
        if (!c.ins(n).length && n.type !== "accept") c.add("error", t.noIncoming(c.name(n)), n, t.noIncomingTip);
        if (!c.outs(n).length && n.type !== "state") c.add("error", t.noOutgoing(c.name(n)), n, t.noOutgoingTip);
        if (n.type === "action" && c.outs(n).length > 1) c.add("warn", t.actionManyOut(c.name(n), c.outs(n).length), n, t.actionManyOutTip);
        if (n.type === "action" && !String(n.text).trim()) c.add("warn", t.actionNoText, n, t.actionNoTextTip);
    }
    for (const dn of c.ofType("decision")) {
        const o = c.outs(dn), i = c.ins(dn);
        if (!i.length) c.add("error", t.decisionNoIn, dn);
        if (o.length === 1 && i.length >= 2) continue; // merge
        if (o.length < 2) {
            c.add("error", o.length ? t.decisionOneOut : t.decisionNoOut, dn, t.decisionOutTip);
            continue;
        }
        if (i.length > 1) c.add("warn", t.decisionAndMerge, dn, t.decisionAndMergeTip);
        const noGuard = o.filter(e => !/\[[^\]]+\]/.test(e.label || ""));
        if (noGuard.length) c.add("error", t.missingGuards(noGuard.length, noGuard.length === o.length), dn, t.missingGuardsTip, noGuard.map(e => e.id));
        const guards = o.map(e => (e.label || "").trim().toLowerCase()).filter(Boolean);
        if (new Set(guards).size < guards.length) c.add("error", t.duplicateGuard, dn, t.duplicateGuardTip);
    }
    for (const b of c.ofType("bar")) {
        const o = c.outs(b).length, i = c.ins(b).length;
        if (!((i === 1 && o >= 2) || (i >= 2 && o === 1))) c.add("error", t.barMismatch, b, t.barMismatchTip);
    }
    for (const e of c.edges.filter(x => c.kind(x) !== "flow" && c.kind(x) !== "anchor" && FLOW_TYPES.has(c.node(x.from).type) && FLOW_TYPES.has(c.node(x.to).type))) {
        c.add("warn", t.flowOnly, null, t.flowOnlyTip(text(relationLabels)[c.kind(e)]), [ e.id ]);
    }
    if (isState) {
        for (const e of c.edges.filter(x => c.node(x.from).type === "state" && c.node(x.to).type === "state" && !(x.label || "").trim())) {
            c.add("warn", t.transitionNoEvent, null, t.transitionNoEventTip, [ e.id ]);
        }
    }
    if (starts.length) {
        const seen = new Set(starts.map(s => s.id)), queue = [ ...seen ];
        while (queue.length) {
            const id = queue.shift()!;
            for (const e of c.edges.filter(x => x.from === id)) {
                if (!seen.has(e.to)) {
                    seen.add(e.to);
                    queue.push(e.to);
                }
            }
        }
        for (const n of flow.filter(x => !seen.has(x.id) && c.ins(x).length && x.type !== "accept")) c.add("warn", t.unreachable(c.name(n)), n, t.unreachableTip);
    }
    for (const l of c.ofType("lane")) {
        if (!flow.some(n => inside(n, l))) c.add("warn", t.emptyLane(c.name(l)), l, t.emptyLaneTip);
    }
}

function checkUseCase(c: Context): void {
    const t = c.t;
    const actors = c.ofType("actor"), cases = c.ofType("usecase");
    if (!actors.length && !cases.length) return;
    c.kinds.add("uc");
    for (const u of cases) {
        const direct = c.edges.some(e => (e.from === u.id && c.node(e.to).type === "actor") || (e.to === u.id && c.node(e.from).type === "actor"));
        const viaInclude = c.edges.some(e => [ "include", "extend" ].includes(c.kind(e)) && (e.from === u.id || e.to === u.id));
        if (!direct && !viaInclude) c.add("warn", t.useCaseNoActor(c.name(u)), u, t.useCaseNoActorTip);
    }
    for (const a of actors) if (!c.edges.some(e => e.from === a.id || e.to === a.id)) c.add("warn", t.actorUnconnected(c.name(a)), a);
    for (const e of c.edges) {
        const k = c.kind(e), a = c.node(e.from), b = c.node(e.to);
        if ((k === "include" || k === "extend") && (a.type !== "usecase" || b.type !== "usecase")) c.add("error", t.includeOnlyUseCases(k), null, t.includeOnlyUseCasesTip, [ e.id ]);
        if ([ a.type, b.type ].sort().join() === "actor,usecase" && k !== "assoc") c.add("warn", t.actorUseCaseLine, null, t.actorUseCaseLineTip, [ e.id ]);
        if (a.type === "actor" && b.type === "actor" && k !== "inherit") c.add("warn", t.actorsInherit, null, "", [ e.id ]);
    }
    for (const boundary of c.ofType("boundary")) {
        for (const a of actors) if (inside(a, boundary)) c.add("warn", t.actorInBoundary(c.name(a)), a, t.actorInBoundaryTip);
        for (const u of cases) if (!inside(u, boundary) && overlaps(u, boundary)) c.add("warn", t.useCaseOutside(c.name(u)), u);
    }
}

function checkClasses(c: Context): void {
    const t = c.t;
    const classes = c.ofType("class");
    if (classes.length) {
        c.kinds.add("kl");
        const seen = new Set<string>();
        for (const cl of classes) {
            const name = String(cl.text).trim();
            if (!name) c.add("error", t.classNoName, cl);
            else if (seen.has(name)) c.add("warn", t.classDuplicate(name), cl);
            seen.add(name);
            if (name && /^[a-zäöü]/.test(name) && cl.stereo !== "interface") c.add("warn", t.classLowercase(name), cl, t.classLowercaseTip);
            if (cl.stereo === "enum") continue;
            const attrs = lines(cl.attrs).filter(l => l.trim()), ops = lines(cl.ops).filter(l => l.trim());
            const noVisibility = [ ...attrs, ...ops ].filter(l => !/^\s*[+\-#~]/.test(l)).length;
            const noType = attrs.filter(l => !/:/.test(l)).length;
            const noParens = ops.filter(l => !/\(.*\)/.test(l)).length;
            const label = name || t.classFallback;
            if (noVisibility) c.add("warn", t.noVisibility(label, noVisibility), cl, t.noVisibilityTip);
            if (noType) c.add("warn", t.noType(label, noType), cl, t.noTypeTip);
            if (noParens) c.add("warn", t.noParens(label, noParens), cl, t.noParensTip);
            if (cl.stereo === "interface" && attrs.some(l => /^\s*-/.test(l))) c.add("warn", t.interfacePrivate(name), cl, t.interfacePrivateTip);
        }
        const inheritance = c.edges.filter(e => [ "inherit", "realize" ].includes(c.kind(e)) && c.node(e.from).type === "class" && c.node(e.to).type === "class");
        for (const e of inheritance) {
            const target = c.node(e.to), from = c.name(c.node(e.from));
            if (c.kind(e) === "inherit" && target.stereo === "interface") c.add("warn", t.inheritInterface(from, c.name(target)), null, t.inheritInterfaceTip, [ e.id ]);
            if (c.kind(e) === "realize" && target.stereo !== "interface") c.add("warn", t.realizeClass(from, c.name(target)), null, t.realizeClassTip, [ e.id ]);
        }
        const parents = new Map<number, number[]>();
        for (const e of inheritance.filter(x => c.kind(x) === "inherit")) parents.set(e.from, [ ...(parents.get(e.from) ?? []), e.to ]);
        for (const cl of classes) {
            const stack = [ ...(parents.get(cl.id) ?? []) ], seen2 = new Set<number>();
            while (stack.length) {
                const x = stack.pop()!;
                if (x === cl.id) {
                    c.add("error", t.inheritanceCycle(c.name(cl)), cl, t.inheritanceCycleTip);
                    break;
                }
                if (!seen2.has(x)) {
                    seen2.add(x);
                    stack.push(...(parents.get(x) ?? []));
                }
            }
        }
    }
    for (const o of c.ofType("object")) {
        c.kinds.add("obj");
        if (!/:/.test(o.text)) c.add("warn", t.objectNoClass(c.name(o)), o, t.objectNoClassTip);
    }
}

function checkSequence(c: Context): void {
    const t = c.t;
    const lifelines = c.nodes.filter(n => n.type === "lifeline" || n.type === "actline");
    if (!lifelines.length) return;
    c.kinds.add("seq");
    const messages = c.edges.filter(e => RELATIONS[c.kind(e)]?.seq);
    const owner = (n: DiagramNode): DiagramNode | undefined =>
        n.type === "activation" ? lifelines.find(l => Math.abs(l.x + l.w / 2 - (n.x + n.w / 2)) < 14) : n;
    for (const l of lifelines) {
        if (!messages.some(e => owner(c.node(e.from)) === l || owner(c.node(e.to)) === l)) c.add("warn", t.lifelineNoMessages(c.name(l)), l);
    }
    for (const e of messages) {
        if (!(e.label || "").trim()) c.add("warn", t.messageNoName, null, t.messageNoNameTip, [ e.id ]);
        if (!SEQUENCE_TYPES.has(c.node(e.from).type) || !SEQUENCE_TYPES.has(c.node(e.to).type)) c.add("error", t.messageBetweenLifelines, null, "", [ e.id ]);
    }
    for (const e of c.edges.filter(x => !RELATIONS[c.kind(x)].seq && c.kind(x) !== "anchor" && SEQUENCE_TYPES.has(c.node(x.from).type) && SEQUENCE_TYPES.has(c.node(x.to).type))) {
        c.add("warn", t.useMessageArrows, null, t.useMessageArrowsTip, [ e.id ]);
    }
    for (const a of c.ofType("activation")) {
        const o = owner(a);
        if (!o || o === a) c.add("warn", t.activationOff, a, t.activationOffTip);
    }
}

/** Rules: docs/check-rules.md. Messages are in the current language; the result never depends on it. */
export function checkUml(d: Diagram): UmlCheckResult {
    const nodes = d.nodes.filter(n => isUml(n.type) && n.type !== "note");
    const c = new Context(d, nodes);
    if (!nodes.length) return { items: [], marks: c.marks, count: 0, kinds: c.kinds };
    checkFlow(c);
    checkUseCase(c);
    checkClasses(c);
    checkSequence(c);
    checkEr(c);
    checkTables(c);
    if (c.ofType("component").length || c.ofType("iface").length) c.kinds.add("komp");
    if (c.ofType("node3d").length || c.ofType("artifact").length) c.kinds.add("vert");
    if (c.ofType("package").length) c.kinds.add("pak");
    return { items: c.items, marks: c.marks, count: nodes.length, kinds: c.kinds };
}
