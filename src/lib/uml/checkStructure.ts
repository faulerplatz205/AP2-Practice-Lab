import type { DiagramNode, RelationKind } from "../../types/diagram";
import { inside, overlaps } from "../geometry";
import { type Dictionary, text } from "../../i18n/locale";
import { structureCheckText } from "../../i18n/checkStructure";
import { RELATIONS, lines } from "./types";
import type { Context } from "./check";

type Texts = typeof structureCheckText extends Dictionary<infer T> ? T : never;

/** Rules for component, deployment and package diagrams plus extra class, object and state rules. See docs/check-rules.md. */
export function checkStructure(c: Context): void {
    const t = text(structureCheckText);
    checkComponents(c, t);
    checkDeployment(c, t);
    checkPackages(c, t);
    checkClasses(c, t);
    checkObjects(c, t);
    checkActivity(c, t);
    checkStates(c, t);
    checkUseCases(c, t);
}

/** The decision or fork a branch starts at: walks back over single-entry elements. */
function branchOrigin(c: Context, e: { from: number }): DiagramNode | undefined {
    const seen = new Set<number>();
    let n = c.node(e.from);
    while (!seen.has(n.id)) {
        if ((n.type === "decision" || n.type === "bar") && c.outs(n).length >= 2) return n;
        const ins = c.ins(n);
        if (ins.length !== 1) return undefined;
        seen.add(n.id);
        n = c.node(ins[0].from);
    }
    return undefined;
}

function checkActivity(c: Context, t: Texts): void {
    const isState = c.nodes.some(n => [ "state", "compstate", "history", "deephist" ].includes(n.type));
    if (isState || !c.nodes.some(n => [ "action", "bar", "decision", "signal", "accept", "objnode" ].includes(n.type))) return;
    const origins = (n: DiagramNode): DiagramNode[] => c.ins(n).map(e => branchOrigin(c, e)).filter((x): x is DiagramNode => !!x);
    const twice = (list: DiagramNode[], type: string): boolean => list.some((x, i) => x.type === type && list.indexOf(x) !== i);
    for (const b of c.ofType("bar")) {
        if (c.ins(b).length >= 2 && twice(origins(b), "decision")) c.add("error", t.deadlock, b, t.deadlockTip);
    }
    for (const d of c.ofType("decision")) {
        if (c.ins(d).length >= 2 && c.outs(d).length === 1 && twice(origins(d), "bar")) c.add("warn", t.forkIntoMerge, d, t.forkIntoMergeTip);
    }
    for (const e of c.edges) {
        if (c.kind(e) === "flow" && /\[[^\]]*\]/.test(e.label || "") && c.node(e.from).type !== "decision") c.add("warn", t.guardOutsideDecision, null, t.guardOutsideDecisionTip, [ e.id ]);
    }
}

function checkStates(c: Context, t: Texts): void {
    const states = c.ofType("state"), composites = c.ofType("compstate");
    for (const s of states) if (!trimmed(s)) c.add("warn", t.stateNoName, s, t.stateNoNameTip);
    if (!states.length && !composites.length) return;
    const parent = (n: DiagramNode): number => composites.filter(k => k !== n && inside(n, k)).sort((a, b) => a.w * a.h - b.w * b.h)[0]?.id ?? 0;
    duplicates(c, [ ...states, ...composites ], t.stateDuplicate, parent);
    for (const s of c.ofType("start")) {
        for (const e of c.outs(s)) {
            const label = (e.label || "").trim();
            if (label && !label.startsWith("/")) c.add("warn", t.initialTrigger, null, t.initialTriggerTip, [ e.id ]);
        }
    }
    for (const h of [ ...c.ofType("history"), ...c.ofType("deephist") ]) {
        if (!composites.some(k => inside(h, k))) c.add("warn", t.historyOutside, h, t.historyOutsideTip);
    }
    for (const k of composites) {
        if (!c.nodes.some(n => n !== k && (n.type === "state" || n.type === "compstate") && inside(n, k))) c.add("warn", t.compositeEmpty(c.name(k)), k, t.compositeEmptyTip);
    }
}

function checkUseCases(c: Context, t: Texts): void {
    const actors = c.ofType("actor"), cases = c.ofType("usecase"), boundaries = c.ofType("boundary");
    if (!actors.length && !cases.length) return;
    if (cases.length && !actors.length) c.add("warn", t.noActors, null, t.noActorsTip);
    for (const u of cases) {
        if (!trimmed(u)) c.add("error", t.useCaseNoName, u, t.useCaseNoNameTip);
        if (boundaries.length && !boundaries.some(b => overlaps(u, b))) c.add("warn", t.useCaseOutsideBoundary(c.name(u)), u, t.useCaseOutsideBoundaryTip);
    }
    for (const a of actors) if (!trimmed(a)) c.add("error", t.actorNoName, a, t.actorNoNameTip);
    duplicates(c, cases, t.useCaseDuplicate);
    duplicates(c, actors, t.actorDuplicate);
    for (const e of c.edges) {
        if ([ "assoc", "dir" ].includes(c.kind(e)) && c.node(e.from).type === "usecase" && c.node(e.to).type === "usecase") c.add("warn", t.useCaseAssoc, null, t.useCaseAssocTip, [ e.id ]);
    }
    const links = c.edges.filter(e => c.kind(e) === "include" || c.kind(e) === "extend");
    for (const group of cycles(cases.map(u => u.id), id => links.filter(e => e.from === id && e.to !== id).map(e => e.to))) {
        c.add("error", t.includeCycle(group.map(id => c.name(c.node(id)))), c.node(group[0]), t.includeCycleTip);
    }
}

const trimmed = (n: DiagramNode): string => String(n.text || "").trim();

/** Strongly connected groups with more than one member (Tarjan). Self loops are ignored. */
export function cycles(ids: number[], next: (id: number) => number[]): number[][] {
    const index = new Map<number, number>(), low = new Map<number, number>(), onStack = new Set<number>();
    const stack: number[] = [], out: number[][] = [];
    let counter = 0;
    const visit = (v: number): void => {
        index.set(v, counter);
        low.set(v, counter++);
        stack.push(v);
        onStack.add(v);
        for (const w of next(v)) {
            if (!index.has(w)) {
                visit(w);
                low.set(v, Math.min(low.get(v)!, low.get(w)!));
            } else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
        }
        if (low.get(v) === index.get(v)) {
            const group: number[] = [];
            let w: number;
            do {
                w = stack.pop()!;
                onStack.delete(w);
                group.push(w);
            } while (w !== v);
            if (group.length > 1) out.push(group.reverse());
        }
    };
    for (const id of ids) if (!index.has(id)) visit(id);
    return out;
}

function duplicates(c: Context, nodes: DiagramNode[], message: (name: string) => string, scope: (n: DiagramNode) => number = () => 0): void {
    const seen = new Set<string>();
    for (const n of nodes) {
        const name = trimmed(n);
        if (!name) continue;
        const key = `${scope(n)}|${name.toLowerCase()}`;
        if (seen.has(key)) c.add("warn", message(name), n);
        seen.add(key);
    }
}

/** The component whose border the port sits on (the port's center lies within one port size of an edge). */
function portOwner(port: DiagramNode, components: DiagramNode[]): DiagramNode | undefined {
    const cx = port.x + port.w / 2, cy = port.y + port.h / 2, tol = Math.max(port.w, port.h);
    return components
        .filter(k => overlaps(port, k) || inside(port, k))
        .filter(k => {
            const inX = cx >= k.x - tol / 2 && cx <= k.x + k.w + tol / 2, inY = cy >= k.y - tol / 2 && cy <= k.y + k.h + tol / 2;
            const nearX = Math.min(Math.abs(cx - k.x), Math.abs(cx - k.x - k.w)) <= tol / 2;
            const nearY = Math.min(Math.abs(cy - k.y), Math.abs(cy - k.y - k.h)) <= tol / 2;
            return inX && inY && (nearX || nearY);
        })
        .sort((a, b) => a.w * a.h - b.w * b.h)[0];
}

function checkComponents(c: Context, t: Texts): void {
    const components = c.ofType("component"), ifaces = c.ofType("iface"), ports = c.ofType("port");
    if (!components.length && !ifaces.length && !ports.length) return;
    c.kinds.add("komp");
    for (const k of components) if (!trimmed(k)) c.add("error", t.componentNoName, k, t.componentNoNameTip);
    duplicates(c, components, t.componentDuplicate);

    const owners = new Map<number, DiagramNode | undefined>(ports.map(p => [ p.id, portOwner(p, components) ]));
    for (const p of ports) if (!owners.get(p.id)) c.add("warn", t.portOffBorder, p, t.portOffBorderTip);
    /** A port acts for its component */
    const actor = (id: number): number | undefined => c.node(id).type === "component" ? id : owners.get(id)?.id;
    const isActor = (n: DiagramNode): boolean => n.type === "component" || n.type === "port";

    const provides = new Map<number, number[]>(), requires = new Map<number, number[]>();
    const push = (map: Map<number, number[]>, key: number, value: number | undefined): void => {
        if (value !== undefined) map.set(key, [ ...(map.get(key) ?? []), value ]);
    };
    for (const e of c.edges) {
        const k = c.kind(e), a = c.node(e.from), b = c.node(e.to);
        if (k === "anchor") continue;
        if (a.type === "iface" && b.type === "iface") c.add("error", t.interfaceToInterface, null, t.interfaceToInterfaceTip, [ e.id ]);
        if (a.type === "component" && b.type === "component" && k === "assoc") c.add("warn", t.componentsPlainLine(c.name(a), c.name(b)), null, t.componentsPlainLineTip, [ e.id ]);
        if (k === "require" && !(isActor(a) && b.type === "iface") && !(a.type === "iface" && isActor(b))) c.add("warn", t.requireWrongEnds, null, t.requireWrongEndsTip, [ e.id ]);
        if (k === "delegate") {
            const owner = a.type === "port" ? owners.get(a.id) : undefined;
            if (!owner || b === owner || !inside(b, owner)) c.add("warn", t.delegateWrong, null, t.delegateWrongTip, [ e.id ]);
        }
        const actorEnd = isActor(a) ? a : isActor(b) ? b : undefined, ifaceEnd = a.type === "iface" ? a : b.type === "iface" ? b : undefined;
        if (!actorEnd || !ifaceEnd) continue;
        if (k === "assoc" || k === "realize") {
            push(provides, ifaceEnd.id, actor(actorEnd.id));
            if (k === "realize" && a.type === "iface") c.add("warn", t.realizeFromInterface(c.name(ifaceEnd)), null, t.realizeFromInterfaceTip, [ e.id ]);
        }
        if (k === "dep" || k === "require") {
            if (a === actorEnd) push(requires, ifaceEnd.id, actor(actorEnd.id));
            else c.add("warn", t.interfaceDependsOn(c.name(ifaceEnd)), null, t.interfaceDependsOnTip, [ e.id ]);
        }
    }
    for (const i of ifaces) {
        if (!trimmed(i)) c.add("error", t.interfaceNoName, i, t.interfaceNoNameTip);
        const attached = c.edges.some(e => c.kind(e) !== "anchor" && ((e.from === i.id && isActor(c.node(e.to))) || (e.to === i.id && isActor(c.node(e.from)))));
        if (!attached) c.add("warn", t.interfaceUnconnected(c.name(i)), i, t.interfaceUnconnectedTip);
        else if (requires.has(i.id) && !provides.has(i.id)) c.add("error", t.interfaceNoProvider(c.name(i)), i, t.interfaceNoProviderTip);
    }

    // Inner parts are connected to the outside only through a port of the enclosing component
    for (const e of c.edges) {
        const k = c.kind(e);
        if (k === "anchor" || k === "delegate") continue;
        for (const [ x, y ] of [[ c.node(e.from), c.node(e.to) ], [ c.node(e.to), c.node(e.from) ]]) {
            if (x.type !== "component" && x.type !== "iface") continue;
            const outer = components.find(o => o !== x && inside(x, o) && y !== o && !inside(y, o) && owners.get(y.id) !== o);
            if (outer) {
                c.add("warn", t.crossBoundary(c.name(x), c.name(outer)), x, t.crossBoundaryTip, [ e.id ]);
                break;
            }
        }
    }

    // A requires I and B provides I => A depends on B
    const next = (id: number): number[] => {
        const out = c.edges.filter(e => c.kind(e) === "dep" && actor(e.from) === id && c.node(e.to).type !== "iface").map(e => actor(e.to)).filter((x): x is number => x !== undefined);
        for (const [ iface, users ] of requires) if (users.includes(id)) out.push(...(provides.get(iface) ?? []));
        return out.filter(x => x !== id);
    };
    for (const group of cycles(components.map(k => k.id), next)) {
        c.add("error", t.componentCycle(group.map(id => c.name(c.node(id)))), c.node(group[0]), t.componentCycleTip);
    }
}

/** Name of a deployment node: all lines that are not a «stereotype». */
function nodeName(n: DiagramNode): string {
    return lines(n.text).map(l => l.trim()).filter(l => l && !/^«.*»$/.test(l)).join(" ");
}

function stereotypes(n: DiagramNode): string[] {
    return lines(n.text).map(l => /^\s*«(.*)»\s*$/.exec(l)?.[1].trim() ?? "").filter(Boolean);
}

const isDevice = (n: DiagramNode): boolean => stereotypes(n).some(s => s.toLowerCase() === "device");
const isEnvironment = (n: DiagramNode): boolean => stereotypes(n).some(s => /^execution\s*environment$/i.test(s));
const NODE_KEYWORDS = /^(device|execution\s*environment|executionenv)$/i;

function checkDeployment(c: Context, t: Texts): void {
    const nodes = c.ofType("node3d"), artifacts = c.ofType("artifact");
    if (!nodes.length && !artifacts.length) return;
    c.kinds.add("vert");
    const label = (n: DiagramNode): string => n.type === "node3d" ? nodeName(n) || c.name(n) : c.name(n);
    for (const n of nodes) {
        if (!nodeName(n)) c.add("error", t.nodeNoName, n, t.nodeNoNameTip);
        for (const s of stereotypes(n)) if (!NODE_KEYWORDS.test(s)) c.add("info", t.nodeStereotype(label(n), s), n, t.nodeStereotypeTip);
        if (isDevice(n)) {
            const env = nodes.find(o => o !== n && isEnvironment(o) && inside(n, o));
            if (env) c.add("warn", t.deviceInEnvironment(label(n), label(env)), n, t.deviceInEnvironmentTip);
        }
    }
    for (const x of [ ...c.ofType("class"), ...c.ofType("component") ]) {
        const node = nodes.find(n => inside(x, n));
        if (node) c.add("warn", t.logicalInNode(c.name(x), label(node)), x, t.logicalInNodeTip);
    }
    for (const a of artifacts) {
        const name = trimmed(a);
        if (!name) c.add("error", t.artifactNoName, a, t.artifactNoNameTip);
        else if (!/[.:/]/.test(name)) c.add("warn", t.artifactNoFile(name), a, t.artifactNoFileTip);
        const deployed = nodes.some(n => inside(a, n)) || c.outs(a).some(e => [ "dep", "deploy" ].includes(c.kind(e)) && c.node(e.to).type === "node3d");
        if (nodes.length && !deployed) c.add("warn", t.artifactNotDeployed(c.name(a)), a, t.artifactNotDeployedTip);
    }
    for (const e of c.edges) {
        const a = c.node(e.from), b = c.node(e.to), k = c.kind(e);
        if (a.type === "node3d" && b.type === "node3d") {
            if (k === "assoc" && !e.label.trim()) c.add("warn", t.pathNoProtocol(label(a), label(b)), null, t.pathNoProtocolTip, [ e.id ]);
            if ([ "dep", "dir", "flow", "deploy", "manifest" ].includes(k) && !inside(a, b) && !inside(b, a)) c.add("warn", t.pathArrow(label(a), label(b)), null, t.pathArrowTip, [ e.id ]);
        }
        if (k === "assoc" && [ a.type, b.type ].sort().join() === "artifact,node3d") {
            c.add("warn", t.pathToArtifact(c.name(a.type === "artifact" ? a : b)), null, t.pathToArtifactTip, [ e.id ]);
        }
        if ((k === "dep" || k === "deploy") && a.type === "node3d" && b.type === "artifact") c.add("warn", t.deployDirection(label(a)), null, t.deployDirectionTip, [ e.id ]);
        else if (k === "deploy" && !(a.type === "artifact" && b.type === "node3d") && !(a.type === "node3d" && b.type === "node3d")) c.add("warn", t.deployWrongEnds, null, t.deployWrongEndsTip, [ e.id ]);
        if (k === "manifest" && !(a.type === "artifact" && (b.type === "component" || b.type === "class"))) c.add("warn", t.manifestWrongEnds, null, t.manifestWrongEndsTip, [ e.id ]);
    }
}

const PACKAGE_KEYWORDS = new Set([ "import", "access", "merge", "use" ]);
const PACKAGE_RELATIONS = new Set<RelationKind>([ "dep", "import", "access", "merge" ]);

function checkPackages(c: Context, t: Texts): void {
    const packages = c.ofType("package");
    for (const e of c.edges) {
        const k = c.kind(e);
        if ((k === "import" || k === "access" || k === "merge") && (c.node(e.from).type !== "package" || c.node(e.to).type !== "package")) {
            c.add("warn", t.packageOnly(RELATIONS[k].tag ?? k), null, t.packageOnlyTip, [ e.id ]);
        }
    }
    if (!packages.length) return;
    c.kinds.add("pak");
    for (const p of packages) if (!trimmed(p)) c.add("error", t.packageNoName, p);
    // Same name is fine in different parents (shop::util and admin::util)
    const parent = (p: DiagramNode): number => packages.filter(o => o !== p && inside(p, o)).sort((a, b) => a.w * a.h - b.w * b.h)[0]?.id ?? 0;
    duplicates(c, packages, t.packageDuplicate, parent);

    const deps = c.edges.filter(e => PACKAGE_RELATIONS.has(c.kind(e)) && c.node(e.from).type === "package" && c.node(e.to).type === "package");
    for (const e of deps) {
        for (const m of e.label.matchAll(/«([^»]*)»/g)) {
            if (!PACKAGE_KEYWORDS.has(m[1].trim().toLowerCase())) c.add("warn", t.packageKeyword(m[1].trim()), null, t.packageKeywordTip, [ e.id ]);
        }
        const a = c.node(e.from), b = c.node(e.to);
        if (inside(a, b) || inside(b, a)) {
            const [ outer, inner ] = inside(a, b) ? [ b, a ] : [ a, b ];
            c.add("warn", t.packageNested(c.name(outer), c.name(inner)), null, t.packageNestedTip, [ e.id ]);
        }
    }
    const next = (id: number): number[] => deps.filter(e => e.from === id && e.to !== id).map(e => e.to);
    for (const group of cycles(packages.map(p => p.id), next)) {
        const ids = deps.filter(e => group.includes(e.from) && group.includes(e.to)).map(e => e.id);
        c.add("warn", t.packageCycle(group.map(id => c.name(c.node(id)))), c.node(group[0]), t.packageCycleTip, ids);
    }
}

const BOUND = /^(\d+|\*|[nm])$/i;

/** Whether `value` is a UML multiplicity like 1, 0..1, *, 1..*, n or a comma list of them. */
export function validMultiplicity(value: string): boolean {
    return value.split(",").every(part => {
        // constraints like {ordered} or {unique} may follow the multiplicity
        const p = part.replace(/\{[^}]*\}/g, "").trim().replace(/\s+/g, "");
        const range = /^(\d+)\.\.(\d+|\*|[nm])$/i.exec(p);
        if (range) return !/^\d+$/.test(range[2]) || Number(range[1]) <= Number(range[2]);
        return BOUND.test(p);
    });
}

/** Name of an attribute or operation line: `- /alter : int` => `alter`, `+ getName() : String` => `getName`. */
export function memberName(line: string): string {
    return /^\s*[+\-#~]?\s*\/?\s*([^\s:(=[{]+)/.exec(line)?.[1] ?? "";
}

const CONSTANT = /^[A-Z][A-Z0-9_]*$/;
const UMLAUT = /[äöüÄÖÜß]/;
const CLASS_RELATIONS = new Set<RelationKind>([ "assoc", "dir", "aggr", "comp" ]);

function checkClasses(c: Context, t: Texts): void {
    const classes = c.ofType("class");
    for (const cl of classes) {
        const name = trimmed(cl), label = name || c.name(cl);
        const attrs = lines(cl.attrs).filter(l => l.trim()), ops = lines(cl.ops).filter(l => l.trim());
        if (cl.stereo === "enum") {
            if (attrs.some(l => /:/.test(l) || /^\s*[+\-#~]/.test(l))) c.add("warn", t.enumTyped(label), cl, t.enumTypedTip);
            continue;
        }
        if (cl.stereo === "interface") {
            if (attrs.some(l => !/^\s*-/.test(l) && !CONSTANT.test(memberName(l)))) c.add("warn", t.interfaceAttributes(label), cl, t.interfaceAttributesTip);
        } else {
            const open = attrs.filter(l => /^\s*\+/.test(l) && !CONSTANT.test(memberName(l))).length;
            if (open) c.add("warn", t.publicAttribute(label, open), cl, t.publicAttributeTip);
        }
        const noReturn = ops.filter(l => /\)/.test(l) && !/\)\s*:\s*\S/.test(l) && memberName(l) !== name).length;
        if (noReturn) c.add("info", t.noReturnType(label, noReturn), cl, t.noReturnTypeTip);
        const seen = new Set<string>(), twice = attrs.map(memberName).filter(Boolean).find(m => seen.has(m.toLowerCase()) || !seen.add(m.toLowerCase()));
        if (twice) c.add("warn", t.memberDuplicate(label, twice), cl, t.memberDuplicateTip);
        const flag = attrs.filter(l => /:\s*(boolean|bool)\b/i.test(l)).map(memberName).find(m => m && !/^(is|has|can)[A-ZÄÖÜ_]/.test(m));
        if (flag) c.add("info", t.booleanName(label, flag), cl, t.booleanNameTip);
        const upper = [ ...attrs, ...ops ].map(memberName).find(m => /^[A-ZÄÖÜ]/.test(m) && !CONSTANT.test(m) && m !== name);
        if (upper) c.add("warn", t.memberUppercase(label, upper), cl, t.memberUppercaseTip);
        if ([ name, ...attrs.map(memberName), ...ops.map(memberName) ].some(x => UMLAUT.test(x))) c.add("warn", t.umlautIdentifier(label), cl, t.umlautIdentifierTip);
    }
    for (const e of c.edges) {
        const a = c.node(e.from), b = c.node(e.to), k = c.kind(e);
        if (a.type !== "class" || b.type !== "class") continue;
        if (k === "flow" || RELATIONS[k]?.seq) c.add("warn", t.classFlowArrow, null, t.classFlowArrowTip, [ e.id ]);
        if (!CLASS_RELATIONS.has(k)) continue;
        for (const m of [ e.m1, e.m2 ]) {
            const value = (m ?? "").trim();
            if (value && !validMultiplicity(value)) c.add("warn", t.badMultiplicity(value), null, t.badMultiplicityTip, [ e.id ]);
        }
        // The whole end of an aggregation or composition may stay empty, the part end (target) needs a value
        const missing = k === "aggr" || k === "comp" ? !(e.m2 ?? "").trim() : !(e.m1 ?? "").trim() || !(e.m2 ?? "").trim();
        if (missing) c.add("warn", t.missingMultiplicity(c.name(a), c.name(b)), null, t.missingMultiplicityTip, [ e.id ]);
    }
}

function checkObjects(c: Context, t: Texts): void {
    const objects = c.ofType("object");
    if (!objects.length) return;
    for (const o of objects) {
        const typed = lines(o.attrs).filter(l => l.trim() && /:/.test(l) && !/=/.test(l)).length;
        if (typed) c.add("warn", t.objectAttributeType(c.name(o), typed), o, t.objectAttributeTypeTip);
    }
    for (const e of c.edges) {
        if (c.node(e.from).type !== "object" || c.node(e.to).type !== "object") continue;
        if ((e.m1 ?? "").trim() || (e.m2 ?? "").trim()) c.add("warn", t.linkMultiplicity, null, t.linkMultiplicityTip, [ e.id ]);
        if (c.kind(e) === "dir") c.add("info", t.linkArrow, null, t.linkArrowTip, [ e.id ]);
        if (c.kind(e) === "inherit") c.add("error", t.objectInherit, null, t.objectInheritTip, [ e.id ]);
    }
}

