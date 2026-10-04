import { create } from "zustand";
import { produce } from "immer";
import type { Diagram, DiagramNode, NodeType, RelationKind } from "../types/diagram";
import { emptyDiagram, normalize } from "../lib/diagram";
import { fitToContent } from "../lib/uml/size";
import { KEYS, storage } from "../lib/storage";

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
    /** Edited field: activity field or text/attrs/ops */
    key?: string;
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
    tool: Tool;
    /** Initial values for the next placed element (e.g. interface) */
    toolPreset: Partial<DiagramNode> | null;
    /** Picked tile in the left sidebar, e.g. "m2" or "g0". The label is resolved at render time (language switch). */
    toolKey: string | null;
    relation: RelationKind | "auto";
    /** Arrow tool: clicked start node */
    pendingFrom: number | null;
    pendingY: number;
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

const FITTED = new Set<NodeType>([ "class", "object", "state", "table", "sheet" ]);

/** Sizes of classes, objects, states, tables and data tables follow their content. */
function fitAll(d: Diagram): void {
    for (const n of d.nodes) if (FITTED.has(n.type)) fitToContent(n);
}

export const useDiagram = create<DiagramState>()((set, get) => ({
    doc: initial.doc,
    undo: [],
    redo: [],
    dirty: false,
    view: { x: 40, y: 40, z: 1 },
    selection: null,
    tool: "select",
    toolPreset: null,
    toolKey: null,
    relation: "auto",
    pendingFrom: null,
    pendingY: 0,
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
        set({ doc: produce(normalize(doc), fitAll), selection: null, editor: null, pendingFrom: null });
    },

    undoStep: (): void => {
        const { undo, redo, doc } = get();
        if (!undo.length) return;
        set({ undo: undo.slice(0, -1), redo: [ ...redo, JSON.stringify(doc) ], doc: normalize(JSON.parse(undo[undo.length - 1])), selection: null, editor: null, dirty: true });
    },

    redoStep: (): void => {
        const { undo, redo, doc } = get();
        if (!redo.length) return;
        set({ redo: redo.slice(0, -1), undo: [ ...undo, JSON.stringify(doc) ], doc: normalize(JSON.parse(redo[redo.length - 1])), selection: null, editor: null, dirty: true });
    },

    set: (patch): void => set(patch),
}));

// Autosave: every change goes straight into the browser storage
useDiagram.subscribe((state, prev) => {
    if (state.doc !== prev.doc) storage.write(KEYS.diagram, state.doc);
});
