import { useEffect } from "react";
import { useDiagram } from "../state/diagramStore";
import { useUi } from "../state/uiStore";
import {
    beginArrowFrom, closeRainer, copySelection, deleteSelection, duplicateSelection, nudgeSelection, openEditor, paste, pickTile, savePlan, select, selectAll, setTool, showRainer, tidy,
} from "../state/actions";
import { findNode } from "../lib/diagram";
import { FRAME_TYPES } from "../lib/uml/types";
import type { DiagramMode, DiagramNode } from "../types/diagram";
import { GENERIC_ITEMS, MODES } from "../data/modes";
import { text } from "../i18n/locale";

const TOOL_KEYS: Record<string, "select" | "np" | "rect" | "ellipse" | "diamond" | "text" | "arrow"> = {
    v: "select", n: "np", r: "rect", e: "ellipse", d: "diamond", t: "text", a: "arrow", c: "arrow",
};

const SECRET = "rainer";

/** Select, arrow and the general shapes exist everywhere, other tools only in their kind's palette. */
function toolAllowed(tool: string, mode: DiagramMode): boolean {
    return tool === "select" || tool === "arrow" || text(GENERIC_ITEMS).some(i => i.type === tool) || text(MODES)[mode].items.some(i => i.type === tool);
}

function isFrame(n: DiagramNode | undefined): boolean {
    return !n || FRAME_TYPES.has(n.type);
}

/** All keyboard shortcuts. List: guide, chapter „Tastenkürzel“ (shortcuts). */
export function useKeyboard(): void {
    useEffect(() => {
        let typed = "";
        const onKey = (e: KeyboardEvent): void => {
            const tag = (e.target as HTMLElement).tagName;
            const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
            const ui = useUi.getState(), doc = useDiagram.getState();
            const ctrl = e.ctrlKey || e.metaKey;

            // Easter egg: works everywhere except in input fields, even with an open dialog
            if (!typing && e.key.length === 1 && !ctrl && !e.altKey) {
                typed = (typed + e.key.toLowerCase()).slice(-SECRET.length);
                if (typed === SECRET) {
                    typed = "";
                    e.preventDefault();
                    ui.close();
                    showRainer();
                    return;
                }
            }
            if (e.key === "Escape" && ui.egg) return closeRainer();
            if (e.key === "Escape" && ui.modeMenuOpen) return ui.set({ modeMenuOpen: false });
            if (e.key === "Escape" && ui.dialog) return ui.close();
            if (typing || ui.dialog || ui.workspace !== "draw") return;

            const k = e.key.toLowerCase();
            if (ctrl && k === "z") {
                e.preventDefault();
                if (e.shiftKey) doc.redoStep();
                else doc.undoStep();
            } else if (ctrl && k === "y") {
                e.preventDefault();
                doc.redoStep();
            } else if (ctrl && k === "s") {
                e.preventDefault();
                savePlan();
            } else if (ctrl && k === "o") {
                e.preventDefault();
                ui.open({ type: "plans" });
            } else if (ctrl && k === "a") {
                e.preventDefault();
                selectAll();
            } else if (ctrl && k === "c") {
                copySelection();
            } else if (ctrl && k === "v") {
                e.preventDefault();
                paste();
            } else if (ctrl && k === "d") {
                e.preventDefault();
                duplicateSelection();
            } else if (k === "delete" || k === "backspace") {
                if (doc.selection || doc.multi.length) {
                    e.preventDefault();
                    deleteSelection();
                }
            } else if (k === "escape") {
                if (doc.tool !== "select" || doc.pendingFrom !== null) setTool("select");
                else if (doc.selection || doc.multi.length) select(null);
            } else if (k === "enter" && doc.selection?.kind === "node") {
                e.preventDefault();
                openEditor(doc.selection.id, null);
            } else if (!ctrl && !e.altKey && /^[1-9]$/.test(k)) {
                pickTile(`m${Number(k) - 1}`);
            } else if (!ctrl && !e.altKey && k === "l") {
                tidy();
            } else if (!ctrl && !e.altKey && TOOL_KEYS[k] === "arrow" && doc.tool === "select" && doc.selection?.kind === "node" && !isFrame(findNode(doc.doc, doc.selection.id))) {
                beginArrowFrom(doc.selection.id);
            } else if (!ctrl && !e.altKey && TOOL_KEYS[k]) {
                // Only tools of the current diagram kind: „n“ (activity) belongs to the network diagram
                if (toolAllowed(TOOL_KEYS[k], doc.doc.cfg.mode)) setTool(TOOL_KEYS[k]);
            } else if ((doc.selection?.kind === "node" || doc.multi.length) && k.startsWith("arrow")) {
                e.preventDefault();
                const step = e.shiftKey ? 5 : 1;
                if (k === "arrowleft") nudgeSelection(-step, 0);
                if (k === "arrowright") nudgeSelection(step, 0);
                if (k === "arrowup") nudgeSelection(0, -step);
                if (k === "arrowdown") nudgeSelection(0, step);
            }
        };
        window.addEventListener("keydown", onKey);
        return (): void => window.removeEventListener("keydown", onKey);
    }, []);
}
