import { create } from "zustand";
import { produce } from "immer";
import type { Diagram, DiagramNode, NodeType, RelationKind } from "../types/diagram";
import { emptyDiagram, normalize } from "../lib/diagram";
import { fitToContent } from "../lib/uml/size";
import { KEYS, storage } from "../lib/storage";
import { useUi } from "./uiStore";
import { text } from "../i18n/locale";
import { messageText } from "../i18n/messages";

export type Selection = { kind: "node" | "edge"; id: number };

/** "select", "arrow" or the node type that the next click places. */
export type Tool = "select" | "arrow" | NodeType;

export interface View {
    x: number;
    y: number;
    z: number;
}

/** Floating text field for editing right on the canvas (double click). */
export interface EditorState {
    kind: "np" | "field" | "shape" | "edge";
    id: number;
    /** Edited field: activity field, text/attrs/ops of a node, or m1/m2 of an edge */
    key?: string;
    /** Fixed characters shown before and after the text, e.g. the brackets of a guard; they are added on apply */
    prefix?: string;
    suffix?: string;
    multi?: boolean;
    /** Position in world coordinates */
    x: number;
    y: number;
    w: number;
    h: number;
    fontSize: number;
    mono: boolean;
    align: "left" | "center";
    value: string;
    placeholder?: string;
}

interface DiagramState {
    doc: Diagram;
    undo: string[];
    redo: string[];
    /** Changes since the last save under „Meine Pläne“ (my plans) */
    dirty: boolean;
    view: View;
    selection: Selection | null;
    /** Several selected nodes (marquee, Shift+click, Ctrl+A); then `selection` is null. Never holds exactly one id. */
    multi: number[];
    tool: Tool;
    /** Initial values for the next placed element (e.g. interface) */
    toolPreset: Partial<DiagramNode> | null;
    /** Picked tile in the left sidebar, e.g. "m2" or "g0". The label is resolved at render time (language switch). */
    toolKey: string | null;
    relation: RelationKind | "auto";
    /** Arrow tool: clicked start node */
    pendingFrom: number | null;
    pendingY: number;
    /** The arrow was started from a handle or the node bar: after one arrow the tool returns to "select" */
    arrowOnce: boolean;
    checkActive: boolean;
    reveal: boolean;
    editor: EditorState | null;

    /** With `history` (default) an undo state is stored first and the plan is marked as unsaved. */
    change: (recipe: (d: Diagram) => void, options?: { history?: boolean }) => void;
    replace: (doc: Diagram, options?: { history?: boolean }) => void;
    pushHistory: () => void;
    undoStep: () => void;
    redoStep: () => void;
    set: (patch: Partial<Omit<DiagramState, "doc">>) => void;
}

const MAX_HISTORY = 150;

function initialDiagram(): { doc: Diagram; fromStorage: boolean } {
    const stored = storage.read<unknown>(KEYS.diagram);
    if (stored && Array.isArray((stored as Diagram).nodes)) return { doc: normalize(stored), fromStorage: true };
    return { doc: emptyDiagram(), fromStorage: false };
}

const initial = initialDiagram();
export const STARTED_FROM_STORAGE = initial.fromStorage;

const FITTED = new Set<NodeType>([ "class", "object", "state", "table", "sheet", "usecase" ]);

/** Sizes of classes, objects, states, tables and data tables follow their content. */
function fitAll(d: Diagram): void {
    for (const n of d.nodes) if (FITTED.has(n.type)) fitToContent(n);
}

/** Ids of all selected nodes: the marquee selection or the single selected node. */
export function selectedNodeIds(s: Pick<DiagramState, "selection" | "multi">): number[] {
    if (s.multi.length) return s.multi;
    return s.selection?.kind === "node" ? [ s.selection.id ] : [];
}

export const useDiagram = create<DiagramState>()((set, get) => ({
    doc: initial.doc,
    undo: [],
    redo: [],
    dirty: false,
    view: { x: 40, y: 40, z: 1 },
    selection: null,
    multi: [],
    tool: "select",
    toolPreset: null,
    toolKey: null,
    relation: "auto",
    pendingFrom: null,
    pendingY: 0,
    arrowOnce: false,
    checkActive: false,
    reveal: false,
    editor: null,

    pushHistory: (): void => set(s => ({ undo: [ ...s.undo, JSON.stringify(s.doc) ].slice(-MAX_HISTORY), redo: [], dirty: true })),

    change: (recipe, options): void => {
        if (options?.history !== false) get().pushHistory();
        set(s => ({ doc: produce(s.doc, (d: Diagram) => {
            recipe(d);
            fitAll(d);
        }) }));
    },

    replace: (doc, options): void => {
        if (options?.history !== false) get().pushHistory();
        set({ doc: produce(normalize(doc), fitAll), selection: null, multi: [], editor: null, pendingFrom: null, arrowOnce: false });
    },

    undoStep: (): void => {
        const { undo, redo, doc } = get();
        if (!undo.length) return;
        set({ undo: undo.slice(0, -1), redo: [ ...redo, JSON.stringify(doc) ], doc: normalize(JSON.parse(undo[undo.length - 1])), selection: null, multi: [], editor: null, dirty: true });
    },

    redoStep: (): void => {
        const { undo, redo, doc } = get();
        if (!redo.length) return;
        set({ redo: redo.slice(0, -1), undo: [ ...undo, JSON.stringify(doc) ], doc: normalize(JSON.parse(redo[redo.length - 1])), selection: null, multi: [], editor: null, dirty: true });
    },

    set: (patch): void => set(patch),
}));

// Autosave: every change goes straight into the browser storage
let autosaveWarned = false;
useDiagram.subscribe((state, prev) => {
    if (state.doc === prev.doc) return;
    const saved = storage.write(KEYS.diagram, state.doc);
    // tell the user once, instead of losing a large drawing silently on the next reload
    if (!saved && !autosaveWarned) {
        autosaveWarned = true;
        useUi.getState().notify(text(messageText).autosaveFailed);
    } else if (saved) autosaveWarned = false;
});
