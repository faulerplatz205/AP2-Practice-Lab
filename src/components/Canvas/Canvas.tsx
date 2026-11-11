import { type PointerEvent as ReactPointerEvent, type ReactElement, type WheelEvent as ReactWheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { Diagram, DiagramNode, Point, Rect } from "../../types/diagram";
import { selectedNodeIds, useDiagram } from "../../state/diagramStore";
import { beginArrowFrom, closeEditor, connectTo, connectToEdge, handleDoubleClick, importFile, placeNode, select, selectNodes, setTool, spawnFrom, startConnection, toggleSelected, withCarried } from "../../state/actions";
import { registerCanvas, toWorld, zoomAt } from "../../state/viewport";
import { runCheck } from "../../lib/check";
import { findNode, minSize } from "../../lib/diagram";
import { snap } from "../../lib/math";
import { RELATIONS, SELF_TYPES, SEQUENCE_TYPES, UML_TYPES, isUml } from "../../lib/uml/types";
import { outline } from "../../lib/uml/outline";
import { fragmentOf, headHeight, isLifeline, isMessage, messageOffset, messageY, moveMessage, nearestLifeline, nestedX, ownerOf, pinnedTarget, settleActivations } from "../../lib/uml/sequence";
import { GRID } from "../../lib/constants";
import { anchorPoint, inside, overlaps } from "../../lib/geometry";
import { useSpaceKey } from "../../hooks/useSpaceKey";
import { Markers } from "./Markers";
import { World } from "./World";
import { InlineEditor } from "./InlineEditor";
import { ZoomControls } from "./ZoomControls";
import { LevelChip } from "./LevelChip";
import { RelationBar } from "./RelationBar";
import { NodeBar } from "./NodeBar";
import { EdgeBar } from "./EdgeBar";
import { Hint } from "./Hint";
import { Toast } from "../Feedback/Toast";
import { useText } from "../../i18n/locale";
import { canvasText } from "../../i18n/canvas";

type Drag =
    | { type: "pan"; sx: number; sy: number; vx: number; vy: number }
    /** `ids`: every node that moves (the grabbed one, the rest of the selection and what they carry) */
    | { type: "move"; id: number; ids: number[]; group: boolean; ox: number; oy: number; moved: boolean }
    | { type: "marquee"; x: number; y: number; sx: number; sy: number; add: number[] }
    | { type: "resize"; id: number; ox: number; oy: number; w: number; h: number; moved: boolean }
    | { type: "message"; edgeId: number; offset: number; moved: boolean }
    | { type: "arrow"; port?: { sx: number; sy: number } };

/** Distance and time below which two clicks count as a double click. */
const DOUBLE_CLICK_MS = 450, DOUBLE_CLICK_PX = 8;

/** Pointer travel in px below which a press on the empty canvas is a click, not a selection rectangle. */
const CLICK_SLOP = 4;

/** Nodes caught by the selection rectangle: containers only when they lie inside it completely, everything else when touched. */
function nodesIn(d: Diagram, r: Rect): number[] {
    return d.nodes.filter(n => isUml(n.type) && UML_TYPES[n.type].box ? inside(n, r) : overlaps(n, r)).map(n => n.id);
}

/**
 * How far the head of a lifeline can follow a move by `dy`: down only until the line reaches its minimum length or
 * the head meets the first message, activation, X or invariant on it.
 */
function lifelineStep(d: Diagram, l: DiagramNode, dy: number): number {
    if (dy <= 0 || d.edges.some(e => e.kind === "create" && e.to === l.id)) return dy;
    let room = l.h - ((isUml(l.type) ? UML_TYPES[l.type].minH : undefined) ?? 120);
    const top = l.y + headHeight(l) + 10;
    for (const n of d.nodes) if (n.id !== l.id && ownerOf(n, d.nodes) === l) room = Math.min(room, n.y - top);
    for (const e of d.edges) {
        if (!isMessage(e)) continue;
        const a = findNode(d, e.from), b = findNode(d, e.to);
        if (a && b && (ownerOf(a, d.nodes) === l || ownerOf(b, d.nodes) === l)) room = Math.min(room, messageY(e, a, b) - top);
    }
    return Math.max(0, Math.min(dy, Math.floor(room / GRID) * GRID));
}

/**
 * Moves the head of a lifeline up or down. Its end and everything on it stay where they are, so the messages keep
 * their height; a created lifeline takes its «create» message along.
 */
function moveLifelineHead(d: Diagram, l: DiagramNode, dy: number): void {
    const created = d.edges.find(e => e.kind === "create" && e.to === l.id);
    if (created) return moveMessage(d, created, l.y + dy + headHeight(l) / 2);
    const step = lifelineStep(d, l, dy);
    l.y += step;
    l.h -= step;
    const top = headHeight(l) + 10;
    for (const e of d.edges) if (e.from === l.id && e.y !== undefined && RELATIONS[e.kind ?? "flow"].seq) e.y = Math.max(top, e.y - step);
}

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
    const double = useRef<{ x: number; y: number } | null>(null);
    const [ panning, setPanning ] = useState(false);
    const [ cursor, setCursor ] = useState<Point | null>(null);
    const [ dropping, setDropping ] = useState(false);
    const [ marquee, setMarquee ] = useState<Rect | null>(null);
    const multi = useDiagram(s => s.multi);
    const spaceDown = useSpaceKey();

    const svgCallback = useCallback((el: SVGSVGElement | null) => {
        svgRef.current = el;
        registerCanvas(el);
    }, []);

    useEffect(() => {
        if (pendingFrom === null) setCursor(null);
    }, [ pendingFrom ]);

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
        const state = useDiagram.getState();
        const now = Date.now(), last = lastDown.current;
        const isDouble = e.button === 0 && !!last && now - last.t < DOUBLE_CLICK_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < DOUBLE_CLICK_PX;
        lastDown.current = { t: now, x: e.clientX, y: e.clientY };
        // a second click on the same lifeline while drawing an arrow is a self message, not a double click
        // decided on release: a second press that turns into a drag moves the element instead of opening its text
        double.current = isDouble && state.tool === "select" && state.pendingFrom === null && !spaceDown.current ? { x: e.clientX, y: e.clientY } : null;
        if (double.current) lastDown.current = null;
        if (state.editor) closeEditor((document.getElementById("ed") as HTMLTextAreaElement | null)?.value);
        const p = toWorld(e.clientX, e.clientY);
        e.currentTarget.setPointerCapture(e.pointerId);
        const startPan = (): void => {
            drag.current = { type: "pan", sx: e.clientX, sy: e.clientY, vx: state.view.x, vy: state.view.y };
            setPanning(true);
        };
        if (e.button === 1 || e.button === 2 || spaceDown.current) return startPan();

        const target = e.target as Element;
        // with the arrow tool a line lying over a node (a message ending on the lifeline) must not hide the node
        const nodeEl = target.closest<SVGElement>("[data-id]") ?? (state.tool === "arrow"
            ? document.elementsFromPoint(e.clientX, e.clientY).map(x => x.closest<SVGElement>("#world [data-id]")).find(x => !!x) ?? null : null);

        if (state.tool !== "select" && state.tool !== "arrow") {
            // a quick click on the new element right afterwards selects or drags it, it is not a double click
            lastDown.current = null;
            return placeNode(state.tool, p, e.shiftKey);
        }

        if (state.tool === "arrow") {
            // a note hangs on a line as well: the arrow was started on the note and the click hits a line
            const lineEl = target.closest<SVGElement>("[data-eid]");
            if (lineEl && state.pendingFrom !== null && findNode(state.doc, state.pendingFrom)?.type === "note") return connectToEdge(Number(lineEl.dataset.eid));
            if (!nodeEl) {
                if (state.arrowOnce) setTool("select");
                else state.set({ pendingFrom: null });
                return;
            }
            const id = Number(nodeEl.dataset.id);
            const pendingNode = state.pendingFrom !== null ? findNode(state.doc, state.pendingFrom) : undefined;
            if (state.pendingFrom === null) {
                startConnection(id, p.y);
                drag.current = { type: "arrow" };
            } else if (state.pendingFrom !== id) {
                connectTo(id);
            } else if (pendingNode && SEQUENCE_TYPES.has(pendingNode.type) && Math.abs(p.y - state.pendingY) > 12) {
                connectTo(id); // self message
            } else if (pendingNode && SELF_TYPES.has(pendingNode.type)) {
                connectTo(id); // second click on the same state or class: self transition, reflexive association
            }
            return;
        }

        const handle = target.closest<SVGElement>("[data-handle]");
        if (handle) {
            const n = findNode(state.doc, Number(handle.dataset.handle))!;
            drag.current = { type: "resize", id: n.id, ox: p.x, oy: p.y, w: n.w, h: n.h, moved: false };
            return;
        }
        const port = target.closest<SVGElement>("[data-port]");
        if (port) {
            const id = Number(port.dataset.port);
            beginArrowFrom(id, p.y);
            setCursor(p);
            drag.current = { type: "arrow", port: { sx: e.clientX, sy: e.clientY } };
            return;
        }
        if (nodeEl) {
            const n = findNode(state.doc, Number(nodeEl.dataset.id))!;
            if (e.shiftKey || e.ctrlKey || e.metaKey) return toggleSelected(n.id);
            const group = state.multi.includes(n.id);
            if (!group) select("node", n.id);
            drag.current = { type: "move", id: n.id, ids: withCarried(group ? state.multi : [ n.id ]), group, ox: p.x - n.x, oy: p.y - n.y, moved: false };
            return;
        }
        const edgeEl = target.closest<SVGElement>("[data-eid]");
        if (edgeEl) {
            const edge = state.doc.edges.find(x => x.id === Number(edgeEl.dataset.eid))!;
            select("edge", edge.id);
            const from = findNode(state.doc, edge.from);
            const to = findNode(state.doc, edge.to);
            if (RELATIONS[edge.kind ?? "flow"].seq && from && to) drag.current = { type: "message", edgeId: edge.id, offset: p.y - messageY(edge, from, to), moved: false };
            return;
        }
        // a finger on the empty canvas moves it; the mouse draws a selection rectangle (Space, middle or right button pan)
        if (e.pointerType === "touch") {
            if (state.selection || state.multi.length) select(null);
            return startPan();
        }
        drag.current = { type: "marquee", x: p.x, y: p.y, sx: e.clientX, sy: e.clientY, add: e.shiftKey ? selectedNodeIds(state) : [] };
    };

    const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>): void => {
        const state = useDiagram.getState();
        const p = toWorld(e.clientX, e.clientY);
        if (state.pendingFrom !== null) setCursor(p);
        const d = drag.current;
        if (!d) return;
        if (d.type === "pan") {
            state.set({ view: { ...state.view, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy } });
            return;
        }
        if (d.type === "message") {
            const edge = state.doc.edges.find(x => x.id === d.edgeId), from = edge && findNode(state.doc, edge.from);
            if (!edge || !from) return;
            const to = findNode(state.doc, edge.to);
            if (!to) return;
            const target = snap(p.y - d.offset);
            if (pinnedTarget(edge, to) ? target === snap(messageY(edge, from, to)) : messageOffset(state.doc.nodes, from, target) === (edge.y ?? 60)) return;
            state.change(x => moveMessage(x, x.edges.find(k => k.id === d.edgeId)!, target), { history: !d.moved });
            d.moved = true;
            return;
        }
        if (d.type === "marquee") {
            if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < CLICK_SLOP && !marquee) return;
            const r: Rect = { x: Math.min(d.x, p.x), y: Math.min(d.y, p.y), w: Math.abs(p.x - d.x), h: Math.abs(p.y - d.y) };
            setMarquee(r);
            selectNodes([ ...d.add, ...nodesIn(state.doc, r) ]);
            return;
        }
        if (d.type === "move") {
            const n = findNode(state.doc, d.id);
            if (!n) return;
            let nx = snap(p.x - d.ox + n.w / 2) - n.w / 2, ny = snap(p.y - d.oy + n.h / 2) - n.h / 2;
            if (!d.group && (n.type === "activation" || n.type === "destroy" || n.type === "invariant")) {
                // parts of a lifeline stay on a dashed line: the nearest one, so they can change the lifeline but not float
                const l = nearestLifeline(state.doc.nodes, p.x - d.ox + n.w / 2, 70);
                if (n.type === "activation") ny = snap(p.y - d.oy);
                // a bar dragged onto a running bar lands next to it (nested)
                if (l) nx = n.type === "activation" ? nestedX(state.doc.nodes, n, l, ny) : l.x + l.w / 2 - n.w / 2;
            }
            // a separator line moves up and down inside its fragment
            if (!d.group && n.type === "operand" && fragmentOf(n, state.doc.nodes)) nx = n.x;
            // a single lifeline: sideways everything on it comes along, up and down only its head moves
            const head = !d.group && isLifeline(n);
            // its height changes while the head moves, so the top edge is what stays on the grid
            if (head) ny = snap(p.y - d.oy);
            if (nx === n.x && ny === n.y) return;
            const dx = nx - n.x, dy = ny - n.y;
            if (head && !dx && !lifelineStep(state.doc, n, dy)) return;
            state.change(x => {
                for (const m of x.nodes) {
                    if (!d.ids.includes(m.id)) continue;
                    m.x += dx;
                    if (!head) m.y += dy;
                }
                if (head && dy) moveLifelineHead(x, findNode(x, d.id)!, dy);
                if (n.type === "activation") settleActivations(x.nodes);
            }, { history: !d.moved });
            d.moved = true;
            return;
        }
        if (d.type === "resize") {
            const n = findNode(state.doc, d.id);
            if (!n) return;
            const min = minSize(n.type);
            // an activation bar only grows in length
            const w = n.type === "activation" ? n.w : Math.max(min.w, snap(d.w + p.x - d.ox)), h = Math.max(min.h, snap(d.h + p.y - d.oy));
            if (w === n.w && h === n.h) return;
            state.change(x => {
                const m = findNode(x, d.id) as DiagramNode;
                // the separator lines of a fragment keep its width
                if (m.type === "fragment") for (const o of x.nodes) if (o.type === "operand" && fragmentOf(o, x.nodes) === m) o.w = w;
                m.w = w;
                m.h = h;
                if (m.type === "activation") settleActivations(x.nodes);
            }, { history: !d.moved });
            d.moved = true;
        }
    };

    const endDrag = (e: ReactPointerEvent<SVGSVGElement>): void => {
        const d = drag.current, state = useDiagram.getState();
        const second = double.current;
        double.current = null;
        if (second && e.type === "pointerup" && d?.type !== "arrow" && Math.hypot(e.clientX - second.x, e.clientY - second.y) < CLICK_SLOP && !(d && "moved" in d && d.moved)) {
            if (d?.type === "pan") setPanning(false);
            setMarquee(null);
            drag.current = null;
            handleDoubleClick(e.clientX, e.clientY);
            return;
        }
        if (d?.type === "arrow" && state.pendingFrom !== null && e.type === "pointerup") {
            // Arrow by dragging from node to node
            const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<SVGElement>("[data-id]");
            const pending = findNode(state.doc, state.pendingFrom);
            if (el && Number(el.dataset.id) !== state.pendingFrom) connectTo(Number(el.dataset.id));
            else if (el && pending && SEQUENCE_TYPES.has(pending.type) && Math.abs(toWorld(e.clientX, e.clientY).y - state.pendingY) > 12) connectTo(state.pendingFrom);
            else if (d.port && Math.hypot(e.clientX - d.port.sx, e.clientY - d.port.sy) < 6) beginArrowFrom(state.pendingFrom);
            else if (el && d.port && pending && SELF_TYPES.has(pending.type) && Math.hypot(e.clientX - d.port.sx, e.clientY - d.port.sy) > 20) connectTo(state.pendingFrom); // handle dragged back onto its own node
            else if (d.port && !el) spawnFrom(state.pendingFrom, toWorld(e.clientX, e.clientY));
            else if (d.port) setTool("select");
        } else if (d?.type === "arrow" && d.port) setTool("select");
        if (d?.type === "pan") setPanning(false);
        if (d?.type === "marquee") {
            // a plain click on the empty canvas clears the selection
            if (!marquee && !d.add.length && (state.selection || state.multi.length)) select(null);
            setMarquee(null);
        }
        // a click (no drag) on one node of a group selects just that node
        if (d?.type === "move" && d.group && !d.moved && e.type === "pointerup") select("node", d.id);
        drag.current = null;
    };

    const pending = pendingFrom !== null ? findNode(doc, pendingFrom) : undefined;
    const anchor = pending && cursor ? anchorPoint(pending, outline(pending), cursor.x, cursor.y) : null;
    const t = `translate(${view.x} ${view.y}) scale(${view.z})`;
    const dropText = useText(canvasText).dropFile;

    return (
        <div
            className={clsx("canvas", dropping && "drop")}
            data-drop={dropText}
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
                className={clsx((panning || spaceDown.current) && "pan", tool !== "select" && tool !== "arrow" && "add", (tool === "arrow" || pendingFrom !== null) && "arrow")}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
                onWheel={(e: ReactWheelEvent) => e.stopPropagation()} onContextMenu={e => e.preventDefault()}
            >
                <defs>
                    <pattern id="gridpat" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform={t}>
                        <circle cx="10" cy="10" r={Math.min(1.6, 1 / Math.sqrt(view.z))} fill="var(--grid)" />
                    </pattern>
                    <Markers />
                </defs>
                <rect width="100%" height="100%" fill="url(#gridpat)" />
                <g id="world" transform={t}>
                    <World doc={doc} selection={selection} multi={multi} pendingFrom={pendingFrom} marks={marks} />
                </g>
                <g id="overlay" transform={t}>
                    {anchor && cursor &&
                        <line x1={anchor[0]} y1={anchor[1]} x2={cursor.x} y2={cursor.y} pointerEvents="none" stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="5 4" />}
                    {marquee && <rect id="marquee" className="marquee" x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} strokeWidth={1 / view.z} pointerEvents="none" />}
                </g>
            </svg>
            <InlineEditor />
            <Hint />
            <RelationBar />
            <NodeBar />
            <EdgeBar />
            <LevelChip />
            <ZoomControls />
            <Toast />
        </div>
    );
}
