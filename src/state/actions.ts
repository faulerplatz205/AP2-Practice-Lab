/**
 * UI actions. They connect the drawing (diagramStore), dialogs (uiStore),
 * achievements (achievementStore) and saved plans (planStore) with the logic in src/lib.
 * Components only call these functions and do not change the stores themselves.
 */
import type { ActivityKey, Diagram, DiagramEdge, DiagramMode, DiagramNode, NodeType, Point, RelationKind } from "../types/diagram";
import { ACTIVITY_CELLS, GRID } from "../lib/constants";
import { createNode, diagramBox, emptyDiagram, findEdge, findNode, isActivity, nextActivityNr, normalize, parsePlanFile } from "../lib/diagram";
import { relationEnds } from "../lib/db/columns";
import { fitToContent, fragmentTab } from "../lib/uml/size";
import { NORM_SCENARIOS, type NormScenarioId, isNormId } from "../data/normalization";
import { dbText, normText } from "../i18n/database";
import { contentFingerprint, runCheck } from "../lib/check";
import { calculate } from "../lib/netzplan/calculate";
import { createExercise } from "../lib/netzplan/exercise";
import { buildGraph } from "../lib/netzplan/graph";
import { layoutActivities } from "../lib/netzplan/layout";
import { buildFromRows, parseTaskList } from "../lib/netzplan/taskList";
import { fmt, num, snap } from "../lib/math";
import { arrangeTables, tidyDiagram } from "../lib/tidy/tidy";
import { onBorder } from "../lib/tidy/structure";
import { storage } from "../lib/storage";
import { type EditableField, fieldAt, fieldFor, fieldOrder } from "../lib/uml/fields";
import { edgeGeometry } from "../lib/uml/routing";
import { labelKey, placeLabels } from "../lib/uml/labels";
import { FRAME_TYPES, RELATIONS, SELF_TYPES, SEQUENCE_TYPES, UML_TYPES, autoRelation, isUml } from "../lib/uml/types";
import { SELF_DROP, activationAt, fragmentOf, headHeight, isLifeline, messageOffset, messageY, moveMessage, nearestLifeline, ownerOf, pinnedTarget, settleActivations } from "../lib/uml/sequence";
import { inside } from "../lib/geometry";
import { fileBaseName, requestCapability } from "../lib/downloads";
import { MODES, type ExampleKey, EXAMPLE_MODE, GENERIC_ITEMS, type PaletteItem } from "../data/modes";
import { insertExample } from "../data/examples";
import { RAINER_GALLERY, isRainer } from "../data/rainer";
import { GUIDE } from "../data/guide";
import { localeTag, text } from "../i18n/locale";
import { diagramText, modeRelationLabels, relationLabels, relationName } from "../i18n/diagram";
import { messageText } from "../i18n/messages";
import { BRACKETS, nodeAdornment, unwrap, wrap } from "../lib/uml/guards";
import { variantsOf } from "../lib/uml/variants";
import { type Tool, selectedNodeIds, useDiagram } from "./diagramStore";
import { notify, useUi } from "./uiStore";
import { bump, unlock, useAchievements } from "./achievementStore";
import { type SavedPlan, currentPlan, usePlans } from "./planStore";
import { fitView, toWorld } from "./viewport";

const doc = (): Diagram => useDiagram.getState().doc;
const mode = (): DiagramMode => doc().cfg.mode;
const msg = (): typeof messageText.de => text(messageText);

/* ---------- Tools ---------- */

export function setTool(tool: Tool): void {
    const keepPreset = isUml(tool as NodeType);
    useDiagram.getState().set({
        tool,
        pendingFrom: null,
        arrowOnce: false,
        ...(keepPreset ? {} : { toolPreset: null, toolKey: tool === "select" || tool === "arrow" ? null : useDiagram.getState().toolKey }),
    });
}

/**
 * Palette item of a tile key: "m<i>" = item of the diagram kind, "g<i>" = general shape.
 * Components pass the texts of the current language (`useText(MODES)`, `useText(GENERIC_ITEMS)`).
 */
export function tileItem(key: string, m: DiagramMode, modes = text(MODES), generic = text(GENERIC_ITEMS)): PaletteItem | undefined {
    const list = key.startsWith("m") ? modes[m].items : generic;
    return list[Number(key.slice(1))];
}

/** Picks a tile in the left sidebar (key: see `tileItem`). */
export function pickTile(key: string): void {
    const item = tileItem(key, mode());
    if (!item) return;
    useDiagram.getState().set({ tool: item.type, toolPreset: item.preset ?? null, toolKey: key, pendingFrom: null, arrowOnce: false });
}

export function pickRelation(kind: RelationKind | "auto"): void {
    useDiagram.getState().set({ relation: kind });
    if (kind !== "auto") setTool("arrow");
}

export function setMode(m: DiagramMode): void {
    useDiagram.getState().change(d => {
        d.cfg.mode = m;
    }, { history: false });
    setTool("select");
    useUi.getState().set({ modeMenuOpen: false });
}

/* ---------- Selection and editing ---------- */

export function select(kind: "node" | "edge" | null, id?: number): void {
    useDiagram.getState().set({ selection: kind && id !== undefined ? { kind, id } : null, multi: [] });
}

/** Selects several nodes; one id is a normal selection, none clears it. */
export function selectNodes(ids: number[]): void {
    const unique = [ ...new Set(ids) ].filter(id => findNode(doc(), id));
    if (unique.length < 2) return select(unique.length ? "node" : null, unique[0]);
    useDiagram.getState().set({ selection: null, multi: unique });
}

/** Shift+click: adds the node to the selection or takes it out. */
export function toggleSelected(id: number): void {
    const ids = selectedNodeIds(useDiagram.getState());
    selectNodes(ids.includes(id) ? ids.filter(x => x !== id) : [ ...ids, id ]);
}

export function selectAll(): void {
    selectNodes(doc().nodes.map(n => n.id));
}

/** Nodes that move or go along with `ids`: the content of containers, the parts of lifelines, ports of components. */
export function withCarried(ids: number[]): number[] {
    const all = new Set(ids);
    for (const id of ids) {
        const n = findNode(doc(), id);
        if (n) for (const c of carriedBy(n)) all.add(c);
    }
    return [ ...all ];
}

export function placeNode(type: NodeType, p: Point, keepTool: boolean): void {
    const { toolPreset, change } = useDiagram.getState();
    let id = 0;
    change(d => {
        const n = createNode(d, type, p.x, p.y);
        if (toolPreset) {
            const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
            Object.assign(n, structuredClone(toolPreset));
            n.x = cx - n.w / 2;
            n.y = cy - n.h / 2;
        }
        if (isLifeline(n)) {
            // the click sets the head; further lifelines join the row of the first one and end at the same height
            const row = d.nodes.filter(isLifeline);
            n.y = row.length ? Math.min(...row.map(l => l.y)) : snap(p.y - headHeight(n) / 2);
            if (row.length) n.h = Math.max(n.h, Math.max(...row.map(l => l.y + l.h)) - n.y);
        }
        // parts of a lifeline land exactly on the nearest dashed line
        if (n.type === "activation" || n.type === "destroy" || n.type === "invariant") {
            const l = nearestLifeline(d.nodes, n.x + n.w / 2, 60);
            if (l) n.x = l.x + l.w / 2 - n.w / 2;
        }
        // a separator line spans the fragment it is placed in
        const frame = n.type === "operand" ? fragmentOf(n, d.nodes) : undefined;
        if (frame) {
            n.x = frame.x;
            n.w = frame.w;
        }
        d.nodes.push(n);
        // a bar placed onto a running bar is nested: it lands next to it
        if (n.type === "activation") settleActivations(d.nodes);
        id = n.id;
    });
    select("node", id);
    if (type === "np") unlock("first_node");
    if (isUml(type)) unlock("uml_first");
    if (!keepTool) setTool("select");
}

/** Deletes the selected edge, or all selected nodes with their lines, in one undo step. */
export function deleteSelection(): void {
    const state = useDiagram.getState(), { selection, change } = state;
    const nodeIds = selectedNodeIds(state);
    if (!selection && !nodeIds.length) return;
    change(d => {
        if (selection?.kind === "edge") {
            d.edges = d.edges.filter(e => e.id !== selection.id);
            dropLooseAnchors(d);
            return;
        }
        const ids = new Set(nodeIds);
        // a lifeline takes its activation bars, destruction X and state invariants with it
        for (const id of nodeIds) {
            const gone = findNode(d, id);
            if (gone && isLifeline(gone)) for (const n of d.nodes) if (n !== gone && ownerOf(n, d.nodes) === gone) ids.add(n.id);
            // the separator lines of a fragment go with it
            if (gone?.type === "fragment") for (const n of d.nodes) if (n.type === "operand" && fragmentOf(n, d.nodes) === gone) ids.add(n.id);
        }
        d.nodes = d.nodes.filter(n => !ids.has(n.id));
        d.edges = d.edges.filter(e => !ids.has(e.from) && !ids.has(e.to));
        dropLooseAnchors(d);
    });
    select(null);
}

/** Copied nodes and the lines between them. */
let clipboard: { nodes: DiagramNode[]; edges: DiagramEdge[] } | null = null;

export function copySelection(): void {
    const d = doc(), ids = new Set(selectedNodeIds(useDiagram.getState()));
    if (!ids.size) return;
    clipboard = structuredClone({ nodes: d.nodes.filter(n => ids.has(n.id)), edges: d.edges.filter(e => ids.has(e.from) && ids.has(e.to)) });
}

export function paste(): void {
    if (!clipboard?.nodes.length) return;
    const source = clipboard, ids: number[] = [];
    useDiagram.getState().change(d => {
        const map = new Map<number, number>();
        const nodes = source.nodes.map(src => {
            const n: DiagramNode = { ...structuredClone(src), id: d.next++, x: src.x + 30, y: src.y + 30 };
            if (isActivity(n) && !isNaN(parseInt(n.f.nr))) n.f.nr = nextActivityNr(d);
            map.set(src.id, n.id);
            d.nodes.push(n);
            ids.push(n.id);
            return n;
        });
        const edges = source.edges.map(e => ({ ...structuredClone(e), id: d.next++, from: map.get(e.from)!, to: map.get(e.to)! }));
        // a copied note stays on the copy of its line, or loses the line
        const lineIds = new Map(source.edges.map((e, i) => [ e.id, edges[i].id ]));
        for (const e of edges) {
            delete e.route;
            if (e.on !== undefined && lineIds.has(e.on)) e.on = lineIds.get(e.on);
            else delete e.on;
        }
        d.edges.push(...edges);
        // the next paste lands another step further
        clipboard = structuredClone({ nodes, edges });
    });
    selectNodes(ids);
}

export function duplicateSelection(): void {
    copySelection();
    paste();
}

export function nudgeSelection(dx: number, dy: number): void {
    const state = useDiagram.getState(), ids = new Set(withCarried(selectedNodeIds(state)));
    if (!ids.size) return;
    state.change(d => {
        for (const n of d.nodes) {
            if (!ids.has(n.id)) continue;
            n.x += dx * GRID;
            n.y += dy * GRID;
        }
    });
}

/** Turns the node into another form of its kind (see `variantsOf`), e.g. class => interface. */
export function convertNode(nodeId: number, variantId: string): void {
    const n = findNode(doc(), nodeId), variant = n && variantsOf(n, mode()).find(v => v.id === variantId);
    if (!variant || variant.current) return;
    useDiagram.getState().change(d => variant.apply(findNode(d, nodeId)!));
}

/* ---------- Arrows ---------- */

const GUARDS_YES = [ diagramText.de.guardYes, diagramText.en.guardYes ];
const GUARDS_NO = [ diagramText.de.guardNo, diagramText.en.guardNo ];

/** Yes, then no, then empty. Guards in either language count as used. */
function nextGuard(existing: string[]): string {
    const used = existing.map(l => (l || "").toLowerCase());
    const t = text(diagramText);
    if (!GUARDS_YES.some(g => used.includes(g))) return t.guardYes;
    if (!GUARDS_NO.some(g => used.includes(g))) return t.guardNo;
    return "[ ]";
}

/**
 * Adds an edge from the clicked start node to `toId`. `toId` = start node: self message (sequence), self transition
 * (state) or reflexive association (class, object). Between two states several transitions are allowed, they
 * usually differ in trigger and guard.
 */
export function connectTo(toId: number): void {
    const { pendingFrom, pendingY, relation, arrowOnce, change, set } = useDiagram.getState();
    set({ pendingFrom: null });
    if (pendingFrom === null) return;
    if (arrowOnce) {
        setTool("select");
        select("node", toId);
    }
    let first = findNode(doc(), pendingFrom), second = findNode(doc(), toId);
    if (!first || !second) return;
    // a message belongs to the lifelines, wherever the click landed: started on an activation bar it still keeps
    // its height when that bar is moved (the line docks on the bar by itself)
    if (relation === "auto" || RELATIONS[relation].seq) {
        if (first.type === "activation" || first.type === "invariant") first = ownerOf(first, doc().nodes) ?? first;
        if (second.type === "activation" || second.type === "invariant") second = ownerOf(second, doc().nodes) ?? second;
    }
    const kind = relation === "auto" ? autoRelation(first, second) : relation;
    // the symbol always lands on the element clicked second: the diamond of an aggregation or composition sits at
    // the start of the stored line, so that line runs from the second element (the whole) to the first (the part)
    const [ a, b ] = symbolAtStart(kind) ? [ second, first ] : [ first, second ];
    const isMessage = !!RELATIONS[kind].seq && SEQUENCE_TYPES.has(a.type) && SEQUENCE_TYPES.has(b.type);
    if (a.id === b.id && !isMessage && !SELF_TYPES.has(a.type)) return;
    // between two elements of a state machine several transitions are fine, they differ in trigger and guard
    const transition = kind === "flow" && (mode() === "zu" || (a.type === "state" && b.type === "state"));
    // recursive relationship: two lines between the same entity and diamond, in whatever direction they were drawn
    const recursive = kind === "erl" && [ a.type, b.type ].sort().join() === "entity,relship"
        && doc().edges.filter(x => (x.from === a.id && x.to === b.id) || (x.from === b.id && x.to === a.id)).length < 2;
    if (!isMessage && !transition && !recursive && doc().edges.some(x => x.from === a.id && x.to === b.id)) return;
    change(d => pushEdge(d, a, b, kind, pendingY));
    notify(msg().relationSet(relationName(text(relationLabels), text(modeRelationLabels), doc().cfg.mode, kind)));
    unlock("first_arrow");
}

/** Hangs the note the arrow was started on onto a line, e.g. the condition of an «extend». */
export function connectToEdge(edgeId: number): void {
    const { pendingFrom, arrowOnce, change, set } = useDiagram.getState();
    set({ pendingFrom: null });
    const note = pendingFrom === null ? undefined : findNode(doc(), pendingFrom), target = findEdge(doc(), edgeId);
    if (!note || note.type !== "note" || !target || target.on !== undefined) return;
    if (arrowOnce) setTool("select");
    if (doc().edges.some(x => x.on === edgeId && (x.from === note.id || x.to === note.id))) return;
    change(d => {
        d.edges.push({ id: d.next++, from: note.id, to: target.from, label: "", kind: "anchor", on: edgeId });
    });
    notify(msg().relationSet(relationName(text(relationLabels), text(modeRelationLabels), doc().cfg.mode, "anchor")));
}

/** Anchors of notes whose line was deleted go with it. */
function dropLooseAnchors(d: Diagram): void {
    d.edges = d.edges.filter(e => e.on === undefined || d.edges.some(x => x.id === e.on));
}

/** Relations whose only symbol is drawn at the start of the line (aggregation, composition). */
function symbolAtStart(kind: RelationKind): boolean {
    return !!RELATIONS[kind].start && !RELATIONS[kind].end;
}

function entityLines(d: Diagram, relId: number): DiagramEdge[] {
    return d.edges.filter(x => (x.from === relId || x.to === relId) && [ x.from, x.to ].some(id => findNode(d, id)?.type === "entity"));
}

function pushEdge(d: Diagram, a: DiagramNode, b: DiagramNode, kind: RelationKind, pendingY: number): void {
    const isMessage = !!RELATIONS[kind].seq && SEQUENCE_TYPES.has(a.type) && SEQUENCE_TYPES.has(b.type);
    const e: Diagram["edges"][number] = { id: d.next++, from: a.id, to: b.id, label: "", kind };
    if (isMessage) e.y = messageOffset(d.nodes, a, pendingY);
    // a self call made while a bar is running starts a nested bar: the call stack grows by one
    if (isMessage && a.id === b.id && isLifeline(a) && kind !== "reply") {
        const y = a.y + (e.y ?? 0);
        // `a` may come from outside the recipe; the bars are compared with the lifeline inside it
        const line = findNode(d, a.id);
        if (line && activationAt(d.nodes, line, y)) {
            const bar = createNode(d, "activation", a.x + a.w / 2, y);
            bar.y = y + SELF_DROP - 10;
            bar.h = 40;
            d.nodes.push(bar);
            settleActivations(d.nodes);
        }
    }
    if (a.type === "decision" && kind === "flow") {
        const outgoing = d.edges.filter(x => x.from === a.id);
        const isMerge = d.edges.filter(x => x.to === a.id).length > 1 && !outgoing.length;
        e.label = isMerge ? "" : nextGuard(outgoing.map(x => x.label));
    }
    // ER: the first entity line of a diamond gets 1, every further one n
    const rel = [ a, b ].find(n => n.type === "relship"), entity = [ a, b ].find(n => n.type === "entity");
    if (kind === "erl" && rel && entity) e.label = entityLines(d, rel.id).length ? "n" : "1";
    if (kind === "fk" && a.type === "table" && b.type === "table") [ e.m1, e.m2 ] = relationEnds(a, b);
    d.edges.push(e);
    if (isMessage && pinnedTarget(e, b)) moveMessage(d, e, pendingY);
}

/** Element created by "+" or by dropping a handle on empty space. */
export function successorType(type: NodeType, m: DiagramMode): NodeType | null {
    switch (type) {
        case "start": case "action": case "decision": case "bar": case "signal": case "accept": case "objnode": case "state": return m === "zu" ? "state" : "action";
        case "history": case "deephist": case "compstate": return "state";
        case "entity": return "relship";
        case "relship": return "entity";
        case "actor": return "usecase";
        case "lifeline": case "actline": return "lifeline";
        case "end": case "flowend": case "erattr": case "note": case "usecase": case "activation": case "destroy": case "iface": case "text": case "sheet": return null;
        default: return FRAME_TYPES.has(type) ? null : type;
    }
}

function overlapsNode(d: Diagram, r: DiagramNode): boolean {
    return d.nodes.some(n => n.id !== r.id && r.x < n.x + n.w + 20 && n.x < r.x + r.w + 20 && r.y < n.y + n.h + 20 && n.y < r.y + r.h + 20);
}

/** Without `p` the new element goes right of the source (below it in the activity diagram). One undo step. */
export function spawnFrom(fromId: number, p?: Point): void {
    const { relation, change } = useDiagram.getState();
    setTool("select");
    const src = findNode(doc(), fromId);
    const type = src && successorType(src.type, mode());
    if (!src || !type) return;
    if (!p && (mode() === "akt" || mode() === "zu")) return appendAfter(src.id, type);
    const sequence = SEQUENCE_TYPES.has(type);
    let id = 0;
    change(d => {
        const a = findNode(d, src.id)!;
        const n = createNode(d, type, p?.x ?? a.x + a.w + 90 + defaultWidth(type) / 2, p?.y ?? a.y + a.h / 2);
        if (sequence) n.y = a.y;
        while (!p && overlapsNode(d, n)) {
            if (sequence) n.x += snap(n.w + 40);
            else n.y += snap(n.h + 30);
        }
        d.nodes.push(n);
        const ys = d.edges.filter(e => e.y !== undefined && (e.from === a.id || e.to === a.id)).map(e => e.y!);
        const kind = relation === "auto" ? autoRelation(a, n) : relation;
        const [ from, to ] = symbolAtStart(kind) ? [ n, a ] : [ a, n ];
        pushEdge(d, from, to, kind, sequence ? a.y + (ys.length ? Math.max(...ys) + 40 : 60) : n.y);
        id = n.id;
    });
    select("node", id);
    bump("quick");
    if (isUml(type)) unlock("uml_first");
    if (type === "np") unlock("first_node");
    if (!(isUml(type) && UML_TYPES[type].notext)) openEditor(id, null);
}

function defaultWidth(type: NodeType): number {
    return isUml(type) ? UML_TYPES[type].w : 120;
}

/** The first attribute of an entity becomes its key. */
export function addAttribute(nodeId: number): void {
    let id = 0;
    useDiagram.getState().change(d => {
        const a = findNode(d, nodeId);
        if (!a) return;
        const attrs = d.edges.map(e => e.from === a.id ? e.to : e.to === a.id ? e.from : -1).map(i => findNode(d, i)).filter(n => n?.type === "erattr");
        const k = attrs.length;
        const off = (k % 2 ? 1 : -1) * (70 + Math.floor(k / 2) * 130);
        const n = createNode(d, "erattr", a.x + a.w / 2 + off, a.y - 70);
        while (overlapsNode(d, n)) n.y -= 60;
        if (a.type === "entity" && !attrs.some(x => x?.stereo === "key")) {
            n.stereo = "key";
            n.text = "ID";
        }
        d.nodes.push(n);
        pushEdge(d, n, a, "erl", n.y);
        id = n.id;
    });
    if (!id) return;
    select("node", id);
    bump("quick");
    openEditor(id, null);
}

/** 1:n => n:1. ER: swaps with the other entity line of the relationship. */
export function flipCardinality(edgeId: number): void {
    useDiagram.getState().change(d => {
        const e = findEdge(d, edgeId);
        if (!e) return;
        if ((e.kind ?? "flow") === "erl") {
            const other = partnerLine(d, e);
            if (other) [ e.label, other.label ] = [ other.label, e.label ];
            return;
        }
        [ e.m1, e.m2 ] = [ e.m2, e.m1 ];
    });
}

/** ER: the other entity line of a binary relationship. */
export function partnerLine(d: Diagram, e: DiagramEdge): DiagramEdge | undefined {
    if ((e.kind ?? "flow") !== "erl") return undefined;
    const relId = [ e.from, e.to ].find(id => findNode(d, id)?.type === "relship");
    const lines = relId === undefined ? [] : entityLines(d, relId);
    return lines.length === 2 && lines.some(x => x.id === e.id) ? lines.find(x => x.id !== e.id) : undefined;
}

export function canFlip(d: Diagram, e: DiagramEdge): boolean {
    return (e.kind ?? "flow") === "erl" ? !!partnerLine(d, e) : !!(e.m1 || e.m2);
}

export function setErPair(edgeId: number, own: string, other: string): void {
    useDiagram.getState().change(d => {
        const e = findEdge(d, edgeId), p = e && partnerLine(d, e);
        if (!e || !p) return;
        e.label = own;
        p.label = other;
    });
}

/** Swaps start and end of a line together with its multiplicities; a message keeps its height. */
export function reverseEdge(edgeId: number): void {
    useDiagram.getState().change(d => {
        const e = findEdge(d, edgeId), a = e && findNode(d, e.from), b = e && findNode(d, e.to);
        if (!e || !a || !b) return;
        const y = RELATIONS[e.kind ?? "flow"].seq ? messageY(e, a, b) : undefined;
        [ e.from, e.to ] = [ e.to, e.from ];
        if (e.m1 !== undefined || e.m2 !== undefined) [ e.m1, e.m2 ] = [ e.m2, e.m1 ];
        delete e.route;
        if (y !== undefined) moveMessage(d, e, y);
    });
}

export function startConnection(fromId: number, y: number): void {
    useDiagram.getState().set({ pendingFrom: fromId, pendingY: y });
}

/** With `y` the arrow is being dragged; without it the next clicked node is the target. */
export function beginArrowFrom(fromId: number, y?: number): void {
    const n = findNode(doc(), fromId);
    if (!n) return;
    useDiagram.getState().set({
        tool: y === undefined ? "arrow" : useDiagram.getState().tool,
        toolPreset: null, pendingFrom: n.id, pendingY: y ?? n.y + 60, arrowOnce: true,
    });
}

export function setErCardinality(edgeId: number, value: string): void {
    useDiagram.getState().change(d => {
        const e = findEdge(d, edgeId);
        if (e) e.label = value;
    });
}

export function setRelationEnds(edgeId: number, start: string, end: string): void {
    useDiagram.getState().change(d => {
        const e = findEdge(d, edgeId);
        if (e) [ e.m1, e.m2 ] = [ start, end ];
    });
}

/* ---------- Editing on the canvas ---------- */

export function openEditor(nodeId: number, p: Point | null, key?: EditableField["key"]): void {
    const n = findNode(doc(), nodeId);
    if (!n) return;
    const { set } = useDiagram.getState();
    set({ selection: { kind: "node", id: n.id } });
    if (isActivity(n)) {
        const rh = n.h / 4, cw = n.w / 3;
        let cell = ACTIVITY_CELLS.find(c => c.key === "name")!;
        if (p) {
            const r = Math.floor((p.y - n.y) / rh), c = Math.floor((p.x - n.x) / cw);
            cell = ACTIVITY_CELLS.find(x => x.row === r && c >= x.col && c < x.col + x.span) ?? cell;
        }
        set({ editor: { kind: "np", id: n.id, key: cell.key, x: n.x + cell.col * cw, y: n.y + cell.row * rh, w: cell.span * cw, h: rh, fontSize: 13, mono: cell.key !== "name", align: "center", value: n.f[cell.key] ?? "" } });
    } else if (isUml(n.type)) {
        const f = key ? fieldFor(n, key) : fieldAt(n, p);
        if (!f) return;
        if (n.type === "fragment" && f.key === "text") return; // the operator is picked in the bar next to the fragment
        const isList = !!f.multi && f.key !== "text";
        const adorn = nodeAdornment(n, f.key), value = n[f.key] ?? "";
        set({ editor: {
            kind: "field", id: n.id, key: f.key, multi: !!f.multi, x: n.x + (f.x ?? 0), y: n.y + f.y, w: f.w ?? n.w, h: f.h, fontSize: 13.5, mono: isList,
            align: isList || f.left ? "left" : "center", value: adorn ? unwrap(value, adorn) : value, ...(adorn ?? {}),
        } });
    } else {
        set({ editor: { kind: "shape", id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, fontSize: 14, mono: false, align: "center", value: n.text } });
    }
}

/** Transition of a state machine diagram: its label reads `trigger [guard] / effect`. */
export function isTransition(edgeId: number): boolean {
    const e = findEdge(doc(), edgeId);
    return !!e && (e.kind ?? "flow") === "flow" && mode() === "zu";
}

/**
 * Edge leaving a decision of an activity diagram: its whole label is a guard in [ ]. A transition leaving a choice
 * of a state machine may also carry an effect, so there the brackets belong to the guard part only.
 */
export function isGuard(edgeId: number): boolean {
    const e = findEdge(doc(), edgeId), a = e && findNode(doc(), e.from);
    return !!a && a.type === "decision" && (e.kind ?? "flow") === "flow" && !isTransition(edgeId);
}

export const guardText = (v: string): string => unwrap(v, BRACKETS);
export const wrapGuard = (v: string): string => wrap(v, BRACKETS);

/** Relations that carry a multiplicity at both ends. */
export const MULTIPLICITY_KINDS: RelationKind[] = [ "assoc", "dir", "aggr", "comp", "fk" ];

/**
 * Text field on a line. Without `part` the label; "m1" / "m2" edit the multiplicity at the start / end, which is
 * also what a double click close to a line end of an association opens.
 */
export function openEdgeEditor(edgeId: number, part: "label" | "m1" | "m2" = "label"): void {
    const d = doc(), e = findEdge(d, edgeId);
    const a = e && findNode(d, e.from), b = e && findNode(d, e.to);
    if (!e || !a || !b) return;
    const g = edgeGeometry(d, e, a, b);
    if (part !== "label") {
        const spot = placeLabels(d).get(labelKey(e, part)), [ px, py ] = part === "m1" ? g.s : g.t;
        const x = spot ? (spot.a === "end" ? spot.x - 60 : spot.a === "middle" ? spot.x - 30 : spot.x) : px + 6, y = spot ? spot.y - 18 : py + 2;
        useDiagram.getState().set({
            selection: { kind: "edge", id: e.id }, multi: [],
            editor: { kind: "edge", id: e.id, key: part, x, y, w: 60, h: 26, fontSize: 12.5, mono: false, align: "center", value: e[part] ?? "", placeholder: part === "m1" ? "1" : "0..*" },
        });
        return;
    }
    const guard = isGuard(edgeId), transition = isTransition(edgeId);
    useDiagram.getState().set({
        selection: { kind: "edge", id: e.id }, multi: [],
        editor: {
            kind: "edge", id: e.id, key: "label", ...labelBox(d, e, g), h: 28,
            fontSize: 13, mono: false, value: guard ? guardText(e.label) : e.label || "",
            placeholder: guard ? msg().guardPlaceholder : transition ? msg().transitionPlaceholder : msg().labelPlaceholder, ...(guard ? BRACKETS : {}),
        },
    });
}

/** Where the label of a line is drawn (see `placeLabels`), as the box of its text field. */
function labelBox(d: Diagram, e: DiagramEdge, g: { lx: number; ly: number; anc?: "start" | "middle" | "end" }): { x: number; y: number; w: number; align: "left" | "center" } {
    const spot = (e.label ? placeLabels(d).get(labelKey(e, "label")) : undefined) ?? { x: g.lx, y: g.ly, a: g.anc ?? "middle" };
    const w = 140;
    if (spot.a === "start") return { x: spot.x - 7, y: spot.y - 17, w, align: "left" };
    return { x: spot.a === "end" ? spot.x - w + 7 : spot.x - w / 2, y: spot.y - 17, w, align: "center" };
}

/** Double click on a line: close to an end of a relation with multiplicities that multiplicity, else the label. */
function edgePartAt(edgeId: number, p: Point): "label" | "m1" | "m2" {
    const d = doc(), e = findEdge(d, edgeId);
    const a = e && findNode(d, e.from), b = e && findNode(d, e.to);
    if (!e || !a || !b || !MULTIPLICITY_KINDS.includes(e.kind ?? "flow")) return "label";
    const g = edgeGeometry(d, e, a, b), near = (q: [number, number]): number => Math.hypot(q[0] - p.x, q[1] - p.y);
    const total = Math.hypot(g.s[0] - g.t[0], g.s[1] - g.t[1]), reach = Math.min(46, total / 3);
    if (near(g.s) < reach && near(g.s) <= near(g.t)) return "m1";
    if (near(g.t) < reach) return "m2";
    return "label";
}

/** Closes the text field. With `value` the text is applied. */
export function closeEditor(value?: string): void {
    const { editor, change, set } = useDiagram.getState();
    if (!editor) return;
    set({ editor: null });
    if (value === undefined) return;
    const d = doc();
    const adorn = editor.prefix !== undefined && editor.suffix !== undefined ? { prefix: editor.prefix, suffix: editor.suffix } : null;
    if (adorn) value = wrap(value, adorn);
    if (editor.kind === "edge") {
        const e = findEdge(d, editor.id), key = (editor.key ?? "label") as "label" | "m1" | "m2";
        const next = key === "label" ? value : value.trim();
        if (e && (e[key] ?? "") !== next) {
            change(x => {
                findEdge(x, editor.id)![key] = next;
            });
        }
        return;
    }
    const n = findNode(d, editor.id);
    if (!n) return;
    const read = (m: DiagramNode): string | undefined => {
        if (editor.kind === "np") return m.f?.[editor.key as ActivityKey];
        if (editor.kind === "shape") return m.text;
        return m[editor.key as "text" | "attrs" | "ops"];
    };
    if ((read(n) ?? "") === value) return;
    change(x => {
        const m = findNode(x, editor.id)!;
        if (editor.kind === "np") m.f![editor.key as ActivityKey] = value;
        else if (editor.kind === "shape") m.text = value;
        else m[editor.key as "text" | "attrs" | "ops"] = value;
    });
}

/** Tab in an activity node: next (or with Shift previous) field. */
export function editNextCell(value: string, backwards: boolean): void {
    const { editor } = useDiagram.getState();
    if (editor?.kind !== "np") return;
    const id = editor.id, i = ACTIVITY_CELLS.findIndex(c => c.key === editor.key);
    closeEditor(value);
    const n = findNode(doc(), id)!;
    const next = ACTIVITY_CELLS[(i + (backwards ? ACTIVITY_CELLS.length - 1 : 1)) % ACTIVITY_CELLS.length];
    openEditor(id, { x: n.x + (next.col + 0.5) * n.w / 3, y: n.y + (next.row + 0.5) * n.h / 4 });
}

/**
 * Tab in a text field with neighbours: applies the text and opens the next (with Shift the previous) one, e.g.
 * from the name of a table to its columns, from the attributes of a class to its methods, or along a relation
 * from the start multiplicity over the label to the end multiplicity. Returns false when there is no neighbour,
 * so Tab keeps its usual meaning.
 */
export function editNextField(value: string, backwards: boolean): boolean {
    const { editor } = useDiagram.getState();
    if (!editor) return false;
    if (editor.kind === "edge") {
        const e = findEdge(doc(), editor.id);
        if (!e || !MULTIPLICITY_KINDS.includes(e.kind ?? "flow")) return false;
        const order = EDGE_FIELDS, i = order.indexOf((editor.key ?? "label") as typeof order[number]);
        closeEditor(value);
        openEdgeEditor(editor.id, order[(i + (backwards ? order.length - 1 : 1)) % order.length]);
        return true;
    }
    if (editor.kind !== "field") return false;
    const n = findNode(doc(), editor.id);
    const order = n ? fieldOrder(n) : [];
    const i = order.indexOf(editor.key as EditableField["key"]);
    if (i < 0 || order.length < 2) return false;
    closeEditor(value);
    // closing may have grown the element (new columns), so the next field is placed on the updated element
    openEditor(editor.id, null, order[(i + (backwards ? order.length - 1 : 1)) % order.length]);
    return true;
}

/** Tab order of the text fields of a relation with multiplicities. */
const EDGE_FIELDS = [ "m1", "label", "m2" ] as const;

/** Double click: edit a node or edge; on an empty spot create a text field. */
export function handleDoubleClick(clientX: number, clientY: number): void {
    const el = document.elementFromPoint(clientX, clientY);
    const p = toWorld(clientX, clientY);
    // the head strip of a fragment (operator tab and guard) wins over a message or bar passing under it
    const header = doc().nodes.filter(n => n.type === "fragment" && p.x >= n.x && p.x <= n.x + n.w && p.y >= n.y && p.y <= n.y + 24).sort((a, b) => a.w * a.h - b.w * b.h)[0];
    if (header && !(header.text !== "sd" && p.x - header.x < fragmentTab(header).tabW)) return openEditor(header.id, p);
    const nodeEl = el?.closest<SVGElement>("[data-id]");
    if (nodeEl) return openEditor(Number(nodeEl.dataset.id), p);
    const edgeEl = el?.closest<SVGElement>("[data-eid]");
    if (edgeEl) return openEdgeEditor(Number(edgeEl.dataset.eid), edgePartAt(Number(edgeEl.dataset.eid), p));
    if (useDiagram.getState().tool !== "select") return;
    let id = 0;
    useDiagram.getState().change(d => {
        const n = createNode(d, "text", p.x, p.y);
        d.nodes.push(n);
        id = n.id;
    });
    openEditor(id, null);
}

/* ---------- Activity diagram: append next ---------- */

export function appendAfter(sourceId: number, type: NodeType, preset?: Partial<DiagramNode>): void {
    let id = 0;
    useDiagram.getState().change(d => {
        const src = findNode(d, sourceId)!;
        const outgoing = d.edges.filter(e => e.from === src.id);
        const children = outgoing.map(e => findNode(d, e.to)).filter((n): n is DiagramNode => !!n);
        const n = createNode(d, type);
        if (preset) Object.assign(n, preset);
        let x = src.x + src.w / 2;
        if (children.length) x = snap(Math.max(...children.map(k => k.x + k.w)) + 60 + n.w / 2);
        n.x = x - n.w / 2;
        n.y = children.length ? Math.min(...children.map(k => k.y)) : snap(src.y + src.h + 50);
        d.nodes.push(n);
        const label = src.type === "decision" ? nextGuard(outgoing.map(e => e.label)) : "";
        d.edges.push({ id: d.next++, from: src.id, to: n.id, label, kind: "flow" });
        id = n.id;
    });
    select("node", id);
    bump("quick");
    unlock("uml_first");
    if (!UML_TYPES[type as keyof typeof UML_TYPES]?.notext) openEditor(id, null);
}

/* ---------- Network diagram ---------- */

export function compute(): void {
    const { change, set } = useDiagram.getState();
    const preview = structuredClone(doc());
    const result = calculate(preview);
    if (!result.ok) {
        if (result.issue?.nodeId) set({ selection: { kind: "node", id: result.issue.nodeId } });
        notify(result.issue?.text ?? msg().calcImpossible);
        return;
    }
    change(d => {
        calculate(d);
        if (d.task) d.task.usedCalc = true;
    });
    unlock("calc");
    notify(msg().calculated(fmt(result.end), result.critical));
}

export function setCountingMode(start: 0 | 1): void {
    if (doc().cfg.start === start) return;
    useDiagram.getState().change(d => {
        d.cfg.start = start;
    });
    notify(msg().countingMode(start));
}

export function endExercise(): void {
    useDiagram.getState().change(d => {
        delete d.task;
    });
}

export function startExercise(kind: "calc" | "draw", count: number): void {
    const d = createExercise(kind, count, doc().cfg.start);
    useDiagram.getState().replace(d);
    useDiagram.getState().set({ checkActive: false });
    setTool("select");
    requestAnimationFrame(() => fitView());
    notify(kind === "calc" ? msg().newCalcTask : msg().newDrawTask);
}

/** Network diagram from an activity list. Returns an error message or `null`. */
export function buildFromTaskList(text: string, alsoCalculate: boolean): string | null {
    const { rows, errors } = parseTaskList(text);
    if (errors.length) return errors.slice(0, 6).join("\n");
    const next = structuredClone(doc());
    delete next.task;
    buildFromRows(next, rows, true);
    if (buildGraph(next).cyclic) return msg().listCycle;
    layoutActivities(next);
    if (alsoCalculate) calculate(next);
    next.cfg.mode = "netz";
    useDiagram.getState().replace(next);
    useDiagram.getState().set({ checkActive: false });
    useUi.getState().close();
    requestAnimationFrame(() => fitView());
    notify(msg().activitiesCreated(rows.length));
    unlock("list");
    return null;
}

/* ---------- Normalisation exercise ---------- */

/** New table model with the unnormalized source table of the scenario. */
export function startNormExercise(id: NormScenarioId): void {
    const d = emptyDiagram("rel", doc().cfg.start);
    const source = createNode(d, "sheet");
    const s = text(normText)[id];
    Object.assign(source, { text: s.caption, attrs: s.rows, x: 0, y: 0 });
    fitToContent(source);
    d.nodes.push(source);
    d.norm = { id };
    setTool("select");
    useDiagram.getState().replace(d);
    useDiagram.getState().set({ checkActive: false });
    const { persist, plans } = usePlans.getState();
    persist(plans, null);
    useUi.getState().close();
    requestAnimationFrame(() => fitView());
    notify(text(dbText).started);
}

/** Inserts the model solution right of the drawing. */
export function showNormSolution(): void {
    const id = doc().norm?.id;
    if (!isNormId(id)) return;
    const s = text(normText)[id];
    useDiagram.getState().change(d => {
        const box = diagramBox(d);
        const tables = s.solution.map(([ name, columns ]) => {
            const n = createNode(d, "table");
            Object.assign(n, { text: name, attrs: columns });
            d.nodes.push(n);
            return n;
        });
        for (const [ from, to ] of NORM_SCENARIOS[id].solutionEdges) {
            d.edges.push({ id: d.next++, from: tables[from].id, to: tables[to].id, label: "", kind: "fk", m1: "n", m2: "1" });
        }
        arrangeTables(d, tables, box ? box.x + box.w + 120 : 0, box ? box.y : 0);
        d.norm!.shown = true;
    });
    requestAnimationFrame(() => fitView());
    notify(text(dbText).solutionInserted);
}

export function endNormExercise(): void {
    useDiagram.getState().change(d => {
        delete d.norm;
    });
}

/* ---------- Check ---------- */

export function check(): void {
    const d = doc();
    const result = runCheck(d);
    useDiagram.getState().set({ checkActive: true, selection: null });
    // The result is shown in the right panel, so a folded panel opens
    if (!useUi.getState().panelOpen) useUi.getState().setPanelOpen(true);
    const a = useAchievements.getState();
    if (result.ok) {
        const fingerprint = contentFingerprint(d);
        if (fingerprint !== a.lastCorrect) {
            a.update({ lastCorrect: fingerprint });
            bump("streak");
        }
    } else if (result.errors) {
        a.update({ lastCorrect: null, counters: { ...a.counters, streak: 0 } });
    }
    if (result.ok) rewardCheck(result.hasUml, result.kinds);
    const t = msg();
    if (result.ok && d.norm) {
        if (!d.norm.done) {
            useDiagram.getState().change(x => {
                x.norm!.done = true;
            }, { history: false });
        }
        return notify(text(dbText).solved);
    }
    notify(result.ok ? t.allCorrect : !result.errors && !result.isNetzplan ? t.onlyHints : result.errors ? t.errorsFound(result.errors) : t.incomplete);
}

function rewardCheck(isUmlDiagram: boolean, kinds: string[]): void {
    const d = doc(), a = useAchievements.getState();
    if (isUmlDiagram) {
        unlock("uml_ok");
        if (kinds.includes("akt")) unlock("act_ok");
        const checkedKinds = [ ...new Set([ ...a.checkedKinds, ...kinds ]) ];
        a.update({ checkedKinds, counters: { ...useAchievements.getState().counters, kinds: checkedKinds.length } });
        if (checkedKinds.length >= 4) unlock("uml_kinds");
    }
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 5) unlock("night");
    const activities = d.nodes.filter(isActivity);
    if (!activities.length) return;
    unlock("check_ok");
    if (activities.length >= 10) unlock("big");
    if (d.cfg.start === 1) unlock("start1");
    if (activities.some(n => num(n.f.d) === 0)) unlock("milestone");
    if (d.task && !d.task.done) {
        const usedCalc = d.task.usedCalc, kind = d.task.mode;
        useDiagram.getState().change(x => {
            x.task!.done = true;
        }, { history: false });
        bump("tasks");
        if (!usedCalc) unlock(kind === "calc" ? "mental" : "architect");
    }
}

export function closeCheck(): void {
    useDiagram.getState().set({ checkActive: false });
}

/* ---------- Tidy up, examples, new ---------- */

export function tidy(): void {
    if (!doc().nodes.length) {
        notify(msg().nothingToTidy);
        return;
    }
    // a network diagram with a cycle cannot be layered: say so instead of claiming it was tidied
    if (doc().nodes.some(n => n.type === "np") && buildGraph(doc()).cyclic) {
        notify(text(diagramText).layoutCycle);
        return;
    }
    useDiagram.getState().change(tidyDiagram);
    requestAnimationFrame(() => fitView());
    unlock("layout");
    notify(msg().tidied);
}

export function addExample(key: ExampleKey): void {
    setTool("select");
    let added: DiagramNode[] = [];
    useDiagram.getState().change(d => {
        d.cfg.mode = EXAMPLE_MODE[key];
        added = insertExample(d, key);
    });
    const xs = added.map(n => n.x), ys = added.map(n => n.y);
    const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...added.map(n => n.x + n.w)) - Math.min(...xs), h: Math.max(...added.map(n => n.y + n.h)) - Math.min(...ys) };
    requestAnimationFrame(() => fitView(box));
    notify(msg().exampleInserted);
    unlock("uml_first");
}

export function newDiagram(m: DiagramMode): void {
    setTool("select");
    useDiagram.getState().replace(emptyDiagram(m, doc().cfg.start));
    useDiagram.getState().set({ checkActive: false, view: { x: 40, y: 40, z: 1 } });
    const { persist, plans } = usePlans.getState();
    persist(plans, null);
    useUi.getState().close();
}

/* ---------- My plans ---------- */

const defaultPlanName = (): string => `${text(MODES)[mode()].label} ${new Date().toLocaleDateString(localeTag())}`;

function writePlan(id: string | null, name?: string): SavedPlan | null {
    const d = doc(), now = Date.now(), data = JSON.stringify(d);
    const { plans, persist } = usePlans.getState();
    let list = plans.slice(), plan = list.find(p => p.id === id);
    if (plan) {
        plan = { ...plan, data, updated: now, mode: d.cfg.mode, count: d.nodes.length, name: name ?? plan.name };
        list = list.map(p => p.id === plan!.id ? plan! : p);
    } else {
        plan = { id: "p" + now.toString(36) + Math.random().toString(36).slice(2, 6), name: name || defaultPlanName(), mode: d.cfg.mode, created: now, updated: now, count: d.nodes.length, data };
        list.unshift(plan);
    }
    list.sort((a, b) => b.updated - a.updated);
    if (!persist(list, plan.id)) {
        notify(storage.available() ? msg().storageFull : msg().storageBlocked);
        return null;
    }
    useDiagram.getState().set({ dirty: false });
    return plan;
}

export function savePlan(): void {
    if (!doc().nodes.length) return notify(msg().nothingToSave);
    const plan = currentPlan();
    if (plan) {
        if (writePlan(plan.id)) notify(msg().saved(plan.name));
        return;
    }
    useUi.getState().open({ type: "saveAs" });
}

/** Saves the drawing as a new plan; `then` runs afterwards (e.g. opening another plan). */
export function savePlanAs(name: string, then?: () => void): void {
    const plan = writePlan(null, name.trim() || defaultPlanName());
    if (!plan) return;
    useUi.getState().close();
    notify(msg().saved(plan.name));
    then?.();
}

export function suggestedPlanName(): string {
    const plan = currentPlan();
    return plan ? msg().copyName(plan.name) : defaultPlanName();
}

function loadPlanNow(plan: SavedPlan): void {
    let data: unknown;
    try {
        data = JSON.parse(plan.data);
    } catch {
        return notify(msg().planBroken);
    }
    setTool("select");
    // undo must not cross into the previous plan: Ctrl+Z, Ctrl+S would overwrite this plan with the other drawing
    useDiagram.getState().replace(normalize(data), { history: false });
    const { plans, persist } = usePlans.getState();
    persist(plans, plan.id);
    useDiagram.getState().set({ checkActive: false, dirty: false, undo: [], redo: [] });
    useUi.getState().close();
    requestAnimationFrame(() => fitView());
    notify(msg().opened(plan.name));
}

/** Opens a plan; asks first when there are unsaved changes. */
export function openPlan(plan: SavedPlan): void {
    const { dirty } = useDiagram.getState();
    if (dirty && doc().nodes.length && plan.id !== usePlans.getState().currentId) {
        useUi.getState().open({ type: "discard", then: () => loadPlanNow(plan) });
    } else {
        loadPlanNow(plan);
    }
}

/** "Save and continue" in the discard dialog */
export function saveThen(then: () => void): void {
    const plan = currentPlan();
    if (plan) {
        // when saving failed (storage full), stay in the dialog instead of discarding the changes
        if (writePlan(plan.id)) then();
    } else {
        useUi.getState().open({ type: "saveAs", then });
    }
}

export function renamePlan(id: string, name: string): void {
    const { plans, currentId, persist } = usePlans.getState();
    if (!name.trim()) return;
    persist(plans.map(p => p.id === id ? { ...p, name: name.trim() } : p), currentId);
}

export function deletePlan(id: string): void {
    const { plans, currentId, persist } = usePlans.getState();
    const plan = plans.find(p => p.id === id);
    persist(plans.filter(p => p.id !== id), currentId === id ? null : currentId);
    if (currentId === id) useDiagram.getState().set({ dirty: true });
    if (plan) notify(msg().deleted(plan.name));
}

/* ---------- File import and export ---------- */

export function importText(content: string, fileName?: string): void {
    const result = parsePlanFile(content);
    if (!result.ok) return notify(result.reason === "json" ? msg().brokenJson : msg().invalidFile);
    // a file dropped onto unsaved work asks first, like opening a plan
    const { dirty } = useDiagram.getState();
    if (dirty && doc().nodes.length && useUi.getState().dialog?.type !== "discard") {
        useUi.getState().open({ type: "discard", then: () => loadParsed(result.diagram, result.dropped, fileName) });
        return;
    }
    loadParsed(result.diagram, result.dropped, fileName);
}

function loadParsed(diagram: Diagram, dropped: number, fileName?: string): void {
    setTool("select");
    useDiagram.getState().replace(diagram);
    useDiagram.getState().set({ checkActive: false, dirty: false });
    const { plans, persist } = usePlans.getState();
    persist(plans, null);
    useUi.getState().close();
    requestAnimationFrame(() => fitView());
    const done = fileName ? msg().imported(fileName) : msg().planLoaded;
    notify(dropped ? `${done} ${msg().skipped(dropped)}` : done);
}

export function importFile(file: File): void {
    if (/\.(png|pdf|jpe?g)$/i.test(file.name) || /^(image\/|application\/pdf)/.test(file.type)) return notify(msg().notReopenable(file.name));
    if (!/\.json$/i.test(file.name) && file.type !== "application/json") return notify(msg().needJson);
    // a plan file from this app is a few KB; a huge file would freeze the page while parsing and laying out
    if (file.size > 5_000_000) return notify(msg().fileTooLarge(file.name));
    const reader = new FileReader();
    reader.onload = (): void => importText(typeof reader.result === "string" ? reader.result : "", file.name);
    reader.onerror = (): void => notify(msg().readFailed);
    reader.readAsText(file);
}

export function fileBase(): string {
    return fileBaseName(text(MODES)[mode()].label);
}

/* ---------- Dialogs ---------- */

export function openGuide(chapter = 0): void {
    const a = useAchievements.getState();
    if (!a.guideRead.includes(chapter)) {
        const guideRead = [ ...a.guideRead, chapter ];
        a.update({ guideRead, counters: { ...a.counters, guide: guideRead.length } });
        if (guideRead.length >= text(GUIDE).length) unlock("guide");
    }
    useUi.getState().open({ type: "guide", chapter });
}

export function openGantt(): void {
    const g = buildGraph(doc());
    const issue = calculate(structuredClone(doc()));
    if (!issue.ok || !g.nodes.length) return notify(!issue.ok && issue.issue ? issue.issue.text : msg().ganttImpossible);
    unlock("gantt");
    useUi.getState().open({ type: "gantt" });
}

/* ---------- Rainer ---------- */

/**
 * A viewer whose display name contains „Rainer“ sees the whole gallery. The name comes from the artifact viewer
 * (capability `user`, scope `profile`), is only compared and never stored; achievements and XP stay as they are.
 */
export async function greetRainer(): Promise<void> {
    const viewer = await requestCapability<{ me(): Promise<{ name: string }> }>("user");
    const name = viewer ? (await viewer.me().catch(() => ({ name: "" }))).name : "";
    if (!isRainer(name)) return;
    useUi.getState().set({ galleryOpen: true });
    notify(msg().rainerWelcome);
}

let lastRainer = -1;

function pickRainer(): number {
    const { unlocked: done } = useAchievements.getState();
    const all = useUi.getState().galleryOpen;
    const unlocked = RAINER_GALLERY.map((g, i) => all || done[g.unlockedBy] ? i : -1).filter(i => i >= 0);
    if (!unlocked.length) return 0;
    let candidates = unlocked.filter(i => i !== lastRainer);
    if (!candidates.length) candidates = unlocked;
    lastRainer = candidates[Math.floor(Math.random() * candidates.length)];
    return lastRainer;
}

let eggKey = 0;

/** Shows a Rainer picture. Without `index`: easter egg ("rainer" typed), counts for achievements. */
export function showRainer(index?: number, pinned = false): void {
    setTool("select");
    if (index === undefined) {
        unlock("rainer");
        bump("rainer");
    }
    const i = index ?? pickRainer();
    useUi.getState().set({ egg: { image: RAINER_GALLERY[i].image, pinned, key: ++eggKey } });
}

export function closeRainer(): void {
    useUi.getState().set({ egg: null });
}

/* ---------- Container ---------- */

/** Nodes that move along when a container is moved. */
export function carriedBy(n: DiagramNode): number[] {
    // a component takes the ports on its border along
    if (n.type === "component") return doc().nodes.filter(m => m.type === "port" && onBorder(m, n)).map(m => m.id);
    const nodes = doc().nodes;
    // a lifeline takes everything that sits on it, however far it sticks out
    if (isLifeline(n)) return nodes.filter(m => m.id !== n.id && ownerOf(m, nodes)?.id === n.id).map(m => m.id);
    // a fragment is only a frame: its separator lines and nested fragments follow, lifeline parts and messages stay
    if (n.type === "fragment") return nodes.filter(m => m.id !== n.id && (m.type === "fragment" ? inside(m, n) : m.type === "operand" && fragmentOf(m, nodes)?.id === n.id)).map(m => m.id);
    const info = isUml(n.type) ? UML_TYPES[n.type] : undefined;
    if (!info?.box && !info?.carry) return [];
    return nodes.filter(m => m.id !== n.id && inside(m, n)).map(m => m.id);
}
