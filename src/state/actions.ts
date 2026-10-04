/**
 * UI actions. They connect the drawing (diagramStore), dialogs (uiStore),
 * achievements (achievementStore) and saved plans (planStore) with the logic in src/lib.
 * Components only call these functions and do not change the stores themselves.
 */
import type { ActivityKey, Diagram, DiagramEdge, DiagramMode, DiagramNode, NodeType, Point, RelationKind } from "../types/diagram";
import { ACTIVITY_CELLS, GRID } from "../lib/constants";
import { createNode, diagramBox, emptyDiagram, findEdge, findNode, isActivity, looksLikeDiagram, nextActivityNr, normalize } from "../lib/diagram";
import { relationEnds } from "../lib/db/columns";
import { fitToContent } from "../lib/uml/size";
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
import { fieldAt } from "../lib/uml/fields";
import { edgeGeometry } from "../lib/uml/routing";
import { RELATIONS, SEQUENCE_TYPES, UML_TYPES, autoRelation, isUml } from "../lib/uml/types";
import { inside } from "../lib/geometry";
import { fileBaseName, offerFile, safeFileName } from "../lib/downloads";
import { MODES, type ExampleKey, EXAMPLE_MODE, GENERIC_ITEMS, type PaletteItem } from "../data/modes";
import { insertExample } from "../data/examples";
import { RAINER_GALLERY } from "../data/rainer";
import { GUIDE } from "../data/guide";
import { localeTag, text } from "../i18n/locale";
import { diagramText, relationLabels } from "../i18n/diagram";
import { messageText } from "../i18n/messages";
import { type Tool, useDiagram } from "./diagramStore";
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
    useDiagram.getState().set({ tool: item.type, toolPreset: item.preset ?? null, toolKey: key, pendingFrom: null });
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
    useDiagram.getState().set({ selection: kind && id !== undefined ? { kind, id } : null });
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
        d.nodes.push(n);
        id = n.id;
    });
    select("node", id);
    if (type === "np") unlock("first_node");
    if (isUml(type)) unlock("uml_first");
    if (!keepTool) setTool("select");
}

export function deleteSelection(): void {
    const { selection, change } = useDiagram.getState();
    if (!selection) return;
    change(d => {
        if (selection.kind === "node") {
            d.nodes = d.nodes.filter(n => n.id !== selection.id);
            d.edges = d.edges.filter(e => e.from !== selection.id && e.to !== selection.id);
        } else {
            d.edges = d.edges.filter(e => e.id !== selection.id);
        }
    });
    select(null);
}

let clipboard: DiagramNode | null = null;

export function copySelection(): void {
    const { selection } = useDiagram.getState();
    if (selection?.kind === "node") clipboard = structuredClone(findNode(doc(), selection.id) ?? null);
}

export function paste(): void {
    if (!clipboard) return;
    const source = clipboard;
    let id = 0;
    useDiagram.getState().change(d => {
        const n: DiagramNode = { ...structuredClone(source), id: d.next++, x: source.x + 30, y: source.y + 30 };
        if (isActivity(n) && !isNaN(parseInt(n.f.nr))) n.f.nr = nextActivityNr(d);
        d.nodes.push(n);
        id = n.id;
        clipboard = structuredClone(n);
    });
    select("node", id);
}

export function duplicateSelection(): void {
    copySelection();
    paste();
}

export function nudgeSelection(dx: number, dy: number): void {
    const { selection, change } = useDiagram.getState();
    if (selection?.kind !== "node") return;
    change(d => {
        const n = findNode(d, selection.id);
        if (!n) return;
        n.x += dx * GRID;
        n.y += dy * GRID;
    });
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

/** Adds an edge from the clicked start node to `toId`. `toId` = start node: self message in a sequence diagram. */
export function connectTo(toId: number): void {
    const { pendingFrom, pendingY, relation, change, set } = useDiagram.getState();
    set({ pendingFrom: null });
    if (pendingFrom === null) return;
    const a = findNode(doc(), pendingFrom), b = findNode(doc(), toId);
    if (!a || !b) return;
    const kind = relation === "auto" ? autoRelation(a, b) : relation;
    const isMessage = !!RELATIONS[kind].seq && SEQUENCE_TYPES.has(a.type) && SEQUENCE_TYPES.has(b.type);
    if (!isMessage && doc().edges.some(x => x.from === a.id && x.to === b.id)) return;
    change(d => {
        const e: Diagram["edges"][number] = { id: d.next++, from: a.id, to: b.id, label: "", kind };
        if (isMessage) e.y = Math.max(20, Math.min(a.h - 10, snap(pendingY - a.y)));
        if (a.type === "decision" && kind === "flow") {
            const outgoing = d.edges.filter(x => x.from === a.id);
            const isMerge = d.edges.filter(x => x.to === a.id).length > 1 && !outgoing.length;
            e.label = isMerge ? "" : nextGuard(outgoing.map(x => x.label));
        }
        // ER: the first entity line of a diamond gets 1, every further one n
        const rel = [ a, b ].find(n => n.type === "relship"), entity = [ a, b ].find(n => n.type === "entity");
        if (kind === "erl" && rel && entity) {
            const isEntityLine = (x: DiagramEdge): boolean => (x.from === rel.id || x.to === rel.id) && [ x.from, x.to ].some(id => findNode(d, id)?.type === "entity");
            e.label = d.edges.some(isEntityLine) ? "n" : "1";
        }
        if (kind === "fk" && a.type === "table" && b.type === "table") [ e.m1, e.m2 ] = relationEnds(a, b);
        d.edges.push(e);
    });
    notify(msg().relationSet(text(relationLabels)[kind]));
    unlock("first_arrow");
}

export function startConnection(fromId: number, y: number): void {
    useDiagram.getState().set({ pendingFrom: fromId, pendingY: y });
}

/* ---------- Editing on the canvas ---------- */

export function openEditor(nodeId: number, p: Point | null): void {
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
        const f = fieldAt(n, p);
        if (!f) return;
        if (n.type === "fragment" && f.key === "text") return; // The operator is picked from the list on the right
        const isList = !!f.multi && f.key !== "text";
        set({ editor: { kind: "field", id: n.id, key: f.key, multi: !!f.multi, x: n.x + (f.x ?? 0), y: n.y + f.y, w: f.w ?? n.w, h: f.h, fontSize: 13.5, mono: isList, align: isList ? "left" : "center", value: n[f.key] ?? "" } });
    } else {
        set({ editor: { kind: "shape", id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, fontSize: 14, mono: false, align: "center", value: n.text } });
    }
}

/** Edge leaving a decision: its label is a guard in [ ]. */
export function isGuard(edgeId: number): boolean {
    const e = findEdge(doc(), edgeId), a = e && findNode(doc(), e.from);
    return !!a && a.type === "decision" && (e.kind ?? "flow") === "flow";
}

export const guardText = (v: string): string => String(v || "").trim().replace(/^\[/, "").replace(/\]$/, "").trim();
export const wrapGuard = (v: string): string => guardText(v) ? `[${guardText(v)}]` : "";

export function openEdgeEditor(edgeId: number): void {
    const d = doc(), e = findEdge(d, edgeId);
    const a = e && findNode(d, e.from), b = e && findNode(d, e.to);
    if (!e || !a || !b) return;
    const g = edgeGeometry(d, e, a, b);
    const guard = isGuard(edgeId);
    useDiagram.getState().set({
        selection: { kind: "edge", id: e.id },
        editor: {
            kind: "edge", id: e.id, x: g.anc === "start" ? g.lx - 4 : g.anc === "end" ? g.lx - 136 : g.lx - 70, y: g.ly - 16, w: 140, h: 28,
            fontSize: 13, mono: false, align: "center", value: guard ? guardText(e.label) : e.label || "", placeholder: guard ? msg().guardPlaceholder : msg().labelPlaceholder,
        },
    });
}

/** Closes the text field. With `value` the text is applied. */
export function closeEditor(value?: string): void {
    const { editor, change, set } = useDiagram.getState();
    if (!editor) return;
    set({ editor: null });
    if (value === undefined) return;
    const d = doc();
    if (editor.kind === "edge") {
        const e = findEdge(d, editor.id);
        const next = isGuard(editor.id) ? wrapGuard(value) : value;
        if (e && e.label !== next) {
            change(x => {
                findEdge(x, editor.id)!.label = next;
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

/** Double click: edit a node or edge; on an empty spot create a text field. */
export function handleDoubleClick(clientX: number, clientY: number): void {
    const el = document.elementFromPoint(clientX, clientY);
    const p = toWorld(clientX, clientY);
    const nodeEl = el?.closest<SVGElement>("[data-id]");
    if (nodeEl) return openEditor(Number(nodeEl.dataset.id), p);
    const edgeEl = el?.closest<SVGElement>("[data-eid]");
    if (edgeEl) return openEdgeEditor(Number(edgeEl.dataset.eid));
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
        notify(msg().storageFull);
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

export function savePlanAs(name: string): void {
    const plan = writePlan(null, name.trim() || defaultPlanName());
    if (!plan) return;
    useUi.getState().close();
    notify(msg().saved(plan.name));
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
    useDiagram.getState().replace(normalize(data));
    const { plans, persist } = usePlans.getState();
    persist(plans, plan.id);
    useDiagram.getState().set({ checkActive: false, dirty: false });
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
        writePlan(plan.id);
        then();
    } else {
        useUi.getState().open({ type: "saveAs" });
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

export function importText(text: string, fileName?: string): void {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        return notify(msg().invalidFile);
    }
    if (!looksLikeDiagram(data)) return notify(msg().invalidFile);
    const rest = { ...data as Record<string, unknown> };
    delete rest.app;
    delete rest.version;
    setTool("select");
    useDiagram.getState().replace(normalize(rest));
    useDiagram.getState().set({ checkActive: false });
    const { plans, persist } = usePlans.getState();
    persist(plans, null);
    useUi.getState().close();
    requestAnimationFrame(() => fitView());
    notify(fileName ? msg().imported(fileName) : msg().planLoaded);
}

export function importFile(file: File): void {
    if (!/\.json$/i.test(file.name) && file.type !== "application/json") return notify(msg().needJson);
    const reader = new FileReader();
    reader.onload = (): void => importText(typeof reader.result === "string" ? reader.result : "", file.name);
    reader.onerror = (): void => notify(msg().readFailed);
    reader.readAsText(file);
}

export function fileBase(): string {
    return fileBaseName(text(MODES)[mode()].label);
}

export async function exportFile(): Promise<void> {
    const data = JSON.stringify({ app: "AP2 Practice Lab", version: 1, ...doc() }, null, 1);
    const plan = currentPlan();
    const filename = safeFileName(plan ? plan.name : fileBase()) + ".json";
    const outcome = await offerFile(filename, data);
    if (outcome === "saved") return notify(msg().exported);
    if (outcome === "declined") return notify(msg().saveCancelled);
    if (outcome === "busy") return notify(msg().saveBusy);
    useUi.getState().open({ type: "exportText", filename, data });
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

let lastRainer = -1;

function pickRainer(): number {
    const { unlocked: done } = useAchievements.getState();
    const unlocked = RAINER_GALLERY.map((g, i) => done[g.unlockedBy] ? i : -1).filter(i => i >= 0);
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
    const info = isUml(n.type) ? UML_TYPES[n.type] : undefined;
    if (!info?.box && !info?.carry) return [];
    return doc().nodes.filter(m => m.id !== n.id && inside(m, n)).map(m => m.id);
}
