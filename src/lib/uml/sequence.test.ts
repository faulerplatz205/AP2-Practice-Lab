import { describe, expect, it } from "vitest";
import type { Diagram, DiagramNode } from "../../types/diagram";
import { messageY, moveMessage } from "./sequence";

const lifeline = (id: number, x: number, y: number, h: number): DiagramNode => ({ id, type: "lifeline", x, y, w: 130, h, fill: 0, text: "" });

function created(): Diagram {
    return {
        nodes: [ lifeline(1, 0, 0, 400), lifeline(2, 200, 250, 120) ],
        edges: [{ id: 3, from: 1, to: 2, label: "", kind: "create", y: 270 }, { id: 4, from: 2, to: 1, label: "", kind: "reply", y: 80 }],
        next: 5,
        cfg: { start: 0, mode: "seq" },
    };
}

describe("moveMessage", () => {
    it("moves a created lifeline down although it has its minimum length", () => {
        const d = created();
        moveMessage(d, d.edges[0], 330);
        expect(d.nodes[1]).toMatchObject({ y: 310, h: 120 });
        expect(messageY(d.edges[0], d.nodes[0], d.nodes[1])).toBe(330);
    });

    it("keeps the end of a created lifeline when its head moves up", () => {
        const d = created();
        moveMessage(d, d.edges[0], 190);
        expect(d.nodes[1]).toMatchObject({ y: 170, h: 200 });
    });

    it("keeps the messages sent by the created lifeline at their height", () => {
        const d = created(), before = messageY(d.edges[1], d.nodes[1], d.nodes[0]);
        moveMessage(d, d.edges[0], 250);
        expect(messageY(d.edges[1], d.nodes[1], d.nodes[0])).toBe(before);
    });
});
