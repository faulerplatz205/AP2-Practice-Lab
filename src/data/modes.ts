import type { DiagramMode, DiagramNode, NodeType, RelationKind } from "../types/diagram";
import type { Dictionary } from "../i18n/locale";
import { type ModeTexts, modeText } from "../i18n/modes";

export interface PaletteItem {
    type: NodeType;
    label: string;
    preset?: Partial<DiagramNode>;
}

export type ExampleKey = "activity" | "useCase" | "class" | "sequence" | "state" | "er" | "rel";

export interface ModeInfo {
    label: string;
    items: PaletteItem[];
    relations: RelationKind[];
    example?: ExampleKey;
    /** Short guide on the right when nothing is selected */
    tips: string[];
}

const item = (type: NodeType, label: string, preset?: Partial<DiagramNode>): PaletteItem => ({ type, label, preset });

/** General shapes, available in every diagram kind under „Allgemeine Formen“. */
function buildGenericItems(t: ModeTexts): PaletteItem[] {
    const i = t.items;
    return [ item("rect", i.rect), item("ellipse", i.ellipse), item("diamond", i.diamond), item("text", i.text), item("note", i.note) ];
}

/** New diagram kind: docs/new-diagram-type.md */
function buildModes(t: ModeTexts): Record<DiagramMode, ModeInfo> {
    const i = t.items, p = t.presets, m = t.modes;
    return {
        netz: {
            ...m.netz,
            items: [ item("np", i.activity) ],
            relations: [ "flow" ],
        },
        akt: {
            ...m.akt,
            items: [
                item("start", i.start), item("action", i.action), item("decision", i.decision),
                item("bar", i.forkJoin, { w: 200, h: 8 }), item("bar", i.barVertical, { w: 8, h: 120 }),
                item("end", i.end), item("flowend", i.flowEnd), item("signal", i.sendSignal), item("accept", i.acceptSignal),
                item("objnode", i.objectNode), item("lane", i.partition), item("connector", i.connector),
            ],
            relations: [ "flow", "anchor" ],
            example: "activity",
        },
        uc: {
            ...m.uc,
            items: [ item("actor", i.actor), item("usecase", i.useCase), item("boundary", i.boundary), item("note", i.note) ],
            relations: [ "assoc", "include", "extend", "inherit", "anchor" ],
            example: "useCase",
        },
        kl: {
            ...m.kl,
            items: [
                item("class", i.class),
                item("class", i.abstractClass, { stereo: "abstract", text: p.abstractClass }),
                item("class", i.interface, { stereo: "interface", text: p.interfaceName, attrs: "", ops: p.interfaceOps }),
                item("class", i.enumeration, { stereo: "enum", text: p.enumName, attrs: p.enumValues, ops: "" }),
                item("note", i.note),
            ],
            relations: [ "assoc", "dir", "inherit", "realize", "aggr", "comp", "dep", "anchor" ],
            example: "class",
        },
        seq: {
            ...m.seq,
            items: [ item("actline", i.actor), item("lifeline", i.lifeline), item("activation", i.activation), item("destroy", i.destroy), item("fragment", i.fragment), item("operand", i.operand),
                item("invariant", i.invariant), item("fragment", i.sdFrame, { text: "sd", attrs: p.sdName, w: 560, h: 420 }),
            ],
            relations: [ "msg", "async", "reply", "create", "anchor" ],
            example: "sequence",
        },
        zu: {
            ...m.zu,
            items: [
                item("start", i.startState), item("state", i.state),
                item("state", i.stateActivities, { attrs: p.stateActivities }),
                item("compstate", i.compositeState), item("history", i.history), item("deephist", i.deepHistory),
                item("decision", i.choice), item("end", i.endState), item("note", i.note),
            ],
            relations: [ "flow", "anchor" ],
            example: "state",
        },
        obj: {
            ...m.obj,
            items: [ item("object", i.object) ],
            relations: [ "assoc", "anchor" ],
        },
        komp: {
            ...m.komp,
            items: [ item("component", i.component), item("iface", i.iface), item("port", i.port) ],
            relations: [ "assoc", "require", "dep", "delegate", "anchor" ],
        },
        vert: {
            ...m.vert,
            items: [ item("node3d", i.node), item("node3d", i.executionEnvironment, { text: p.executionEnvironment, w: 260, h: 160 }), item("artifact", i.artifact) ],
            relations: [ "assoc", "deploy", "manifest", "dep", "anchor" ],
        },
        pak: {
            ...m.pak,
            items: [ item("package", i.package) ],
            relations: [ "import", "access", "merge", "dep", "anchor" ],
        },
        er: {
            ...m.er,
            items: [
                item("entity", i.entity), item("relship", i.relationship), item("erattr", i.attribute),
                item("erattr", i.keyAttribute, { stereo: "key", text: p.keyAttribute }),
                item("entity", i.weakEntity, { stereo: "weak", text: p.weakEntity }), item("relship", i.identRelationship, { stereo: "ident", text: p.identRelationship }),
                item("erattr", i.partialKey, { stereo: "partial", text: p.partialKey }), item("erattr", i.multiAttribute, { stereo: "multi", text: p.multiAttribute }),
                item("erattr", i.derivedAttribute, { stereo: "derived", text: p.derivedAttribute }),
            ],
            relations: [ "erl", "anchor" ],
            example: "er",
        },
        rel: {
            ...m.rel,
            items: [ item("table", i.table), item("sheet", i.sheet) ],
            relations: [ "fk", "anchor" ],
            example: "rel",
        },
        frei: {
            ...m.frei,
            items: buildGenericItems(t),
            relations: [ "flow", "assoc", "dep", "anchor" ],
        },
    };
}

export const GENERIC_ITEMS: Dictionary<PaletteItem[]> = {
    de: buildGenericItems(modeText.de),
    en: buildGenericItems(modeText.en),
};

export const MODES: Dictionary<Record<DiagramMode, ModeInfo>> = {
    de: buildModes(modeText.de),
    en: buildModes(modeText.en),
};

export const MODE_KEYS = Object.keys(MODES.de) as DiagramMode[];

export const EXAMPLE_MODE: Record<ExampleKey, DiagramMode> = { activity: "akt", useCase: "uc", class: "kl", sequence: "seq", state: "zu", er: "er", rel: "rel" };
