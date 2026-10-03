import { type PointerEvent as ReactPointerEvent, type ReactElement, type WheelEvent as ReactWheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { DiagramEdge, DiagramNode, Point } from "../../types/diagram";
import { useDiagram } from "../../state/diagramStore";
import { carriedBy, closeEditor, connectTo, handleDoubleClick, importFile, placeNode, select, startConnection } from "../../state/actions";
import { registerCanvas, toWorld, zoomAt } from "../../state/viewport";
import { runCheck } from "../../lib/check";
import { findNode, minSize } from "../../lib/diagram";
import { snap } from "../../lib/math";
import { RELATIONS, SEQUENCE_TYPES } from "../../lib/uml/types";
import { useSpaceKey } from "../../hooks/useSpaceKey";
import { Markers } from "./Markers";
import { World } from "./World";
import { InlineEditor } from "./InlineEditor";
import { ZoomControls } from "./ZoomControls";
import { LevelChip } from "./LevelChip";
import { RelationBar } from "./RelationBar";
import { Hint } from "./Hint";
import { Toast } from "../Feedback/Toast";

type Drag =
    | { type: "pan"; sx: number; sy: number; vx: number; vy: number }
    | { type: "move"; id: number; carried: number[]; ox: number; oy: number; moved: boolean }
    | { type: "resize"; id: number; ox: number; oy: number; w: number; h: number; moved: boolean }
    | { type: "message"; edgeId: number; offset: number; moved: boolean }
    | { type: "arrow" };

/** Distance and time below which two clicks count as a double click. */
const DOUBLE_CLICK_MS = 450, DOUBLE_CLICK_PX = 8;

/** Detects double clicks from two `pointerdown` events: the native `dblclick` often gets lost after a re-render. */
export function Canvas(): ReactElement {
    const doc = useDiagram(s => s.doc);
    const view = useDiagram(s => s.view);
    const selection = useDiagram(s => s.selection);
    const tool = useDiagram(s => s.tool);
    const pendingFrom = useDiagram(s => s.pendingFrom);
    const checkActive = useDiagram(s => s.checkActive);
    const marks = useMemo(() => checkActive ? runCheck(doc).marks : undefined, [ checkActive, doc ]);

    const svgRef = useRef<SVGSVGElement>(null);
    const drag = useRef<Drag | null>(null);
    const lastDown = useRef<{ t: number; x: number; y: number } | null>(null);
    const [ panning, setPanning ] = useState(false);
    const [ cursor, setCursor ] = useState<Point | null>(null);
    const [ dropping, setDropping ] = useState(false);
    const spaceDown = useSpaceKey();

    const svgCallback = useCallback((el: SVGSVGElement | null) => {
        svgRef.current = el;
        registerCanvas(el);
    }, []);

    // Mouse wheel zooms; non-passive listener so that the page does not scroll
    useEffect(() => {
        const el = svgRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent): void => {
            e.preventDefault();
            const r = el.getBoundingClientRect();
            zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return (): void => el.removeEventListener("wheel", onWheel);
    }, []);

    const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>): void => {
        if (e.button === 2) return;
        const state = useDiagram.getState();
        const now = Date.now(), last = lastDown.current;
        const isDouble = e.button === 0 && !!last && now - last.t < DOUBLE_CLICK_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < DOUBLE_CLICK_PX;
        lastDown.current = { t: now, x: e.clientX, y: e.clientY };
        if (isDouble && state.tool === "select" && !spaceDown.current) {
            lastDown.current = null;
            e.preventDefault();
            closeEditor((document.getElementById("ed") as HTMLTextAreaElement | null)?.value);
            handleDoubleClick(e.clientX, e.clientY);
            return;
        }
        if (state.editor) closeEditor((document.getElementById("ed") as HTMLTextAreaElement | null)?.value);
        const p = toWorld(e.clientX, e.clientY);
        e.currentTarget.setPointerCapture(e.pointerId);
        const startPan = (): void => {
            drag.current = { type: "pan", sx: e.clientX, sy: e.clientY, vx: state.view.x, vy: state.view.y };
            setPanning(true);
        };
        if (e.button === 1 || spaceDown.current) return startPan();

        const target = e.target as Element;
        const nodeEl = target.closest<SVGElement>("[data-id]");

        if (state.tool !== "select" && state.tool !== "arrow") return placeNode(state.tool, p, e.shiftKey);

        if (state.tool === "arrow") {
            if (!nodeEl) return state.set({ pendingFrom: null });
            const id = Number(nodeEl.dataset.id);
            const pendingNode = state.pendingFrom !== null ? findNode(state.doc, state.pendingFrom) : undefined;
            if (state.pendingFrom === null) {
                startConnection(id, p.y);
                drag.current = { type: "arrow" };
            } else if (state.pendingFrom !== id) {
                connectTo(id);
            } else if (pendingNode && SEQUENCE_TYPES.has(pendingNode.type) && Math.abs(p.y - state.pendingY) > 12) {
                connectTo(id); // self message
            }
            return;
        }

        const handle = target.closest<SVGElement>("[data-handle]");
        if (handle) {
            const n = findNode(state.doc, Number(handle.dataset.handle))!;
            drag.current = { type: "resize", id: n.id, ox: p.x, oy: p.y, w: n.w, h: n.h, moved: false };
            return;
        }
        if (nodeEl) {
            const n = findNode(state.doc, Number(nodeEl.dataset.id))!;
            select("node", n.id);
            drag.current = { type: "move", id: n.id, carried: carriedBy(n), ox: p.x - n.x, oy: p.y - n.y, moved: false };
            return;
        }
        const edgeEl = target.closest<SVGElement>("[data-eid]");
        if (edgeEl) {
            const edge = state.doc.edges.find(x => x.id === Number(edgeEl.dataset.eid))!;
            select("edge", edge.id);
            const from = findNode(state.doc, edge.from);
            if (RELATIONS[edge.kind ?? "flow"].seq && from) drag.current = { type: "message", edgeId: edge.id, offset: p.y - (from.y + (edge.y ?? 60)), moved: false };
            return;
        }
        if (state.selection) select(null);
        startPan();
    };

    const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>): void => {
        const state = useDiagram.getState();
        const p = toWorld(e.clientX, e.clientY);
        if (state.tool === "arrow" && state.pendingFrom !== null) setCursor(p);
        const d = drag.current;
        if (!d) return;
        if (d.type === "pan") {
            state.set({ view: { ...state.view, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy } });
            return;
        }
        if (d.type === "message") {
            const edge = state.doc.edges.find(x => x.id === d.edgeId), from = edge && findNode(state.doc, edge.from);
            if (!edge || !from) return;
            const y = Math.max(20, Math.min(from.h - 10, snap(p.y - d.offset - from.y)));
            if (y === (edge.y ?? 60)) return;
            state.change(x => {
                (x.edges.find(k => k.id === d.edgeId) as DiagramEdge).y = y;
            }, { history: !d.moved });
            d.moved = true;
            return;
        }
        if (d.type === "move") {
            const n = findNode(state.doc, d.id);
            if (!n) return;
            const nx = snap(p.x - d.ox + n.w / 2) - n.w / 2, ny = snap(p.y - d.oy + n.h / 2) - n.h / 2;
            if (nx === n.x && ny === n.y) return;
            const dx = nx - n.x, dy = ny - n.y;
            state.change(x => {
                for (const m of x.nodes) {
                    if (m.id === d.id) {
                        m.x = nx;
                        m.y = ny;
                    } else if (d.carried.includes(m.id)) {
                        m.x += dx;
                        m.y += dy;
                    }
                }
            }, { history: !d.moved });
            d.moved = true;
            return;
        }
        if (d.type === "resize") {
            const n = findNode(state.doc, d.id);
            if (!n) return;
            const min = minSize(n.type);
            const w = Math.max(min.w, snap(d.w + p.x - d.ox)), h = Math.max(min.h, snap(d.h + p.y - d.oy));
            if (w === n.w && h === n.h) return;
            state.change(x => {
                const m = findNode(x, d.id) as DiagramNode;
                m.w = w;
                m.h = h;
            }, { history: !d.moved });
            d.moved = true;
        }
    };

    const endDrag = (e: ReactPointerEvent<SVGSVGElement>): void => {
        const d = drag.current, state = useDiagram.getState();
        if (d?.type === "arrow" && state.pendingFrom !== null && e.type === "pointerup") {
            // Arrow by dragging from node to node
            const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<SVGElement>("[data-id]");
            const pending = findNode(state.doc, state.pendingFrom);
            if (el && Number(el.dataset.id) !== state.pendingFrom) connectTo(Number(el.dataset.id));
            else if (el && pending && SEQUENCE_TYPES.has(pending.type) && Math.abs(toWorld(e.clientX, e.clientY).y - state.pendingY) > 12) connectTo(state.pendingFrom);
        }
        if (d?.type === "pan") setPanning(false);
        drag.current = null;
    };

    const pending = pendingFrom !== null ? findNode(doc, pendingFrom) : undefined;
    const t = `translate(${view.x} ${view.y}) scale(${view.z})`;

    return (
        <div
            className={clsx("canvas", dropping && "drop")}
            id="canvas"
            onDragOver={e => {
                if ([ ...e.dataTransfer.types ].includes("Files")) {
                    e.preventDefault();
                    setDropping(true);
                }
            }}
            onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
            }}
            onDrop={e => {
                e.preventDefault();
                setDropping(false);
                const file = e.dataTransfer.files[0];
                if (file) importFile(file);
            }}
        >
            <svg
                id="svg" ref={svgCallback} xmlns="http://www.w3.org/2000/svg"
                className={clsx((panning || spaceDown.current) && "pan", tool !== "select" && tool !== "arrow" && "add", tool === "arrow" && "arrow")}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
                onWheel={(e: ReactWheelEvent) => e.stopPropagation()}
            >
                <defs>
                    <pattern id="gridpat" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform={t}>
                        <path d="M10 0H0V10" fill="none" stroke="var(--grid)" strokeWidth={0.6 / view.z} />
                    </pattern>
                    <Markers />
                </defs>
                <rect width="100%" height="100%" fill="url(#gridpat)" />
                <g id="world" transform={t}>
                    <World doc={doc} selection={selection} pendingFrom={pendingFrom} marks={marks} />
                </g>
                <g id="overlay" transform={t}>
                    {pending && cursor && tool === "arrow" &&
                        <line x1={pending.x + pending.w / 2} y1={pending.y + pending.h / 2} x2={cursor.x} y2={cursor.y} pointerEvents="none" stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="5 4" />}
                </g>
            </svg>
            <InlineEditor />
            <Hint />
            <RelationBar />
            <LevelChip />
            <ZoomControls />
            <Toast />
        </div>
    );
}
