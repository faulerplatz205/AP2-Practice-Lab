import type { DiagramEdge, DiagramNode } from "../../types/diagram";
import type { Context } from "../uml/check";
import { ER_TYPES } from "../uml/types";
import { type Column, columnKey, referencesTable, tableColumns } from "./columns";
import { type NormTable, checkNormalization } from "./normalize";
import { NORM_SCENARIOS, isNormId } from "../../data/normalization";
import { text } from "../../i18n/locale";
import { dbCheckText } from "../../i18n/database";

/** Chen: 1, n, m, c, mc, *, numbers, ranges like 0..1 and (min,max) */
const CARDINALITY = /^(?:[1nmc*]|mc|\d+|[0-9]+\.\.[0-9nm*]+|\(\s*[0-9nm*]+\s*,\s*[0-9nm*]+\s*\))$/i;
/** "many" ends of a table relationship */
const MANY = /^(?:[nm*]|[0-9]+\.\.[nm*]|0\.\.\*|1\.\.\*|\(\s*[0-9]+\s*,\s*[nm*]\s*\))$/i;

/** ER model in Chen notation: entities, relationships (diamonds), attributes and cardinalities. */
export function checkEr(c: Context): void {
    const t = text(dbCheckText);
    const entities = c.ofType("entity"), rels = c.ofType("relship"), attrs = c.ofType("erattr");
    if (!entities.length && !rels.length && !attrs.length) return;
    c.kinds.add("er");
    const touching = (n: DiagramNode): DiagramEdge[] => c.edges.filter(e => (e.from === n.id || e.to === n.id) && c.kind(e) !== "anchor");
    const other = (e: DiagramEdge, n: DiagramNode): DiagramNode => c.node(e.from === n.id ? e.to : e.from);

    const names = new Set<string>();
    for (const en of entities) {
        const name = String(en.text).trim();
        if (!name) c.add("error", t.entityNoName, en);
        else if (names.has(name.toLowerCase())) c.add("warn", t.entityDuplicate(name), en);
        names.add(name.toLowerCase());
        const hasKey = touching(en).some(e => other(e, en).type === "erattr" && other(e, en).stereo === "key");
        if (name && !hasKey) c.add("warn", t.entityNoKey(name), en, t.entityNoKeyTip);
    }
    for (const a of attrs) {
        const owners = touching(a).map(e => other(e, a)).filter(o => o.type === "entity" || o.type === "relship");
        if (!touching(a).length) c.add("error", t.attrUnconnected(c.name(a)), a, t.attrUnconnectedTip);
        else if (owners.length > 1) c.add("warn", t.attrManyOwners(c.name(a)), a, t.attrManyOwnersTip);
        if (a.stereo === "key" && owners.some(o => o.type === "relship")) c.add("warn", t.keyOnRelationship(c.name(a)), a, t.keyOnRelationshipTip);
    }
    for (const r of rels) {
        const name = String(r.text).trim();
        if (!name) c.add("warn", t.relshipNoName, r, t.relshipNoNameTip);
        const toEntities = touching(r).filter(e => other(e, r).type === "entity");
        if (toEntities.length < 2) c.add("error", t.relshipFewEntities(name || c.name(r), toEntities.length), r, t.relshipFewEntitiesTip);
        for (const e of toEntities) {
            const label = String(e.label || "").trim();
            if (!label) c.add("error", t.cardinalityMissing(c.name(other(e, r)), name || c.name(r)), null, t.cardinalityMissingTip, [ e.id ]);
            else if (!CARDINALITY.test(label)) c.add("warn", t.cardinalityInvalid(label), null, t.cardinalityInvalidTip, [ e.id ]);
        }
    }
    for (const e of c.edges.filter(x => ER_TYPES.has(c.node(x.from).type) && ER_TYPES.has(c.node(x.to).type))) {
        const a = c.node(e.from), b = c.node(e.to);
        if (c.kind(e) !== "erl" && c.kind(e) !== "anchor") c.add("warn", t.erLineKind, null, t.erLineKindTip, [ e.id ]);
        if (a.type === "entity" && b.type === "entity") c.add("error", t.entitiesDirect(c.name(a), c.name(b)), null, t.entitiesDirectTip, [ e.id ]);
        if (a.type === "relship" && b.type === "relship") c.add("error", t.relshipsDirect, null, t.relshipsDirectTip, [ e.id ]);
    }
}

interface ParsedTable {
    node: DiagramNode;
    name: string;
    columns: Column[];
}

/** Table model: keys, foreign keys and 1:n relationships; with a running exercise also the normal forms. */
export function checkTables(c: Context): void {
    const t = text(dbCheckText);
    const tables: ParsedTable[] = c.ofType("table").map(n => ({ node: n, name: String(n.text).trim(), columns: tableColumns(n) }));
    if (!tables.length && !c.ofType("sheet").length) return;
    c.kinds.add("rel");
    const pkOwners = (column: string, except: ParsedTable): ParsedTable[] =>
        tables.filter(x => x !== except && x.columns.some(k => k.pk && columnKey(k.name) === columnKey(column)));
    const linked = (a: ParsedTable, b: ParsedTable): boolean => c.edges.some(e => (e.from === a.node.id && e.to === b.node.id) || (e.from === b.node.id && e.to === a.node.id));

    const names = new Set<string>();
    for (const tb of tables) {
        const label = tb.name || c.name(tb.node);
        if (!tb.name) c.add("error", t.tableNoName, tb.node);
        else if (names.has(tb.name.toLowerCase())) c.add("warn", t.tableDuplicate(tb.name), tb.node);
        names.add(tb.name.toLowerCase());
        if (!tb.columns.length) {
            c.add("error", t.tableNoColumns(label), tb.node, t.tableNoColumnsTip);
            continue;
        }
        if (!tb.columns.some(k => k.pk)) c.add("error", t.tableNoPk(label), tb.node, t.tableNoPkTip);
        const seen = new Set<string>();
        for (const k of tb.columns) {
            const key = columnKey(k.name);
            if (key && seen.has(key)) c.add("error", t.columnDuplicate(label, k.name), tb.node);
            seen.add(key);
            if (!k.fk) continue;
            const targets = pkOwners(k.name, tb);
            if (!targets.length) c.add("warn", t.fkUnknown(label, k.name), tb.node, t.fkUnknownTip);
            else if (!targets.some(x => linked(tb, x))) c.add("warn", t.fkNoLine(label, targets[0].name || c.name(targets[0].node)), tb.node, t.fkNoLineTip);
        }
    }

    const byNode = new Map(tables.map(x => [ x.node.id, x ]));
    for (const e of c.edges.filter(x => byNode.has(x.from) && byNode.has(x.to) && c.kind(x) !== "anchor")) {
        const a = byNode.get(e.from)!, b = byNode.get(e.to)!, an = a.name || c.name(a.node), bn = b.name || c.name(b.node);
        if (c.kind(e) !== "fk") {
            c.add("warn", t.relLineKind, null, t.relLineKindTip, [ e.id ]);
            continue;
        }
        const m1 = String(e.m1 ?? "").trim(), m2 = String(e.m2 ?? "").trim();
        if (!m1 || !m2) c.add("warn", t.relationNoCardinality(an, bn), null, t.relationNoCardinalityTip, [ e.id ]);
        if (MANY.test(m1) && MANY.test(m2)) {
            c.add("error", t.relationMn(an, bn), null, t.relationMnTip, [ e.id ]);
            continue;
        }
        const aRefB = referencesTable(a.node, b.node), bRefA = referencesTable(b.node, a.node);
        if (!aRefB && !bRefA) c.add("error", t.relationNoFk(an, bn), null, t.relationNoFkTip, [ e.id ]);
        // the many end sits at the table that must hold the foreign key
        else if ((MANY.test(m1) && !aRefB && bRefA) || (MANY.test(m2) && !bRefA && aRefB)) c.add("warn", t.fkWrongSide(an, bn), null, t.fkWrongSideTip, [ e.id ]);
    }

    if (isNormId(c.d.norm?.id)) checkNormExercise(c, tables, c.d.norm.id);
}

function checkNormExercise(c: Context, tables: ParsedTable[], id: keyof typeof NORM_SCENARIOS): void {
    const t = text(dbCheckText), scenario = NORM_SCENARIOS[id];
    const label = (attr: string): string => scenario.attributes.find(a => a.id === attr)?.names[t.nameIndex] ?? attr;
    const labels = (attrs: string[]): string[] => attrs.map(label);
    const normTables: NormTable[] = tables.filter(x => x.columns.length).map(x => ({ id: x.node.id, name: x.name || c.name(x.node), columns: x.columns }));
    const node = (nt: NormTable): DiagramNode => c.node(nt.id);
    for (const f of checkNormalization(normTables, scenario)) {
        switch (f.kind) {
            case "nonAtomic": c.add("error", t.normNonAtomic(f.table.name, f.column), node(f.table), t.normNonAtomicTip(labels(f.parts))); break;
            case "repeating": c.add("error", t.normRepeating(f.table.name, f.columns), node(f.table), t.normRepeatingTip); break;
            case "unknown": c.add("info", t.normUnknown(f.table.name, f.columns), node(f.table), t.normUnknownTip); break;
            case "missing": c.add("error", t.normMissing(labels(f.attributes)), null, t.normMissingTip); break;
            case "keyTooSmall": c.add("error", t.normKeyTooSmall(f.table.name, labels(f.columns)), node(f.table), t.normKeyTooSmallTip); break;
            case "keyTooBig": c.add("warn", t.normKeyTooBig(f.table.name, labels(f.columns)), node(f.table), t.normKeyTooBigTip); break;
            case "noKey": c.add("error", t.normNoKey(f.table.name), node(f.table), t.normNoKeyTip); break;
            case "partial": c.add("error", t.normPartial(f.table.name, labels(f.key), labels(f.columns)), node(f.table), t.normPartialTip(labels(f.key), labels(f.columns))); break;
            case "transitive": c.add("error", t.normTransitive(f.table.name, labels(f.via), labels(f.columns)), node(f.table), t.normTransitiveTip(labels(f.via), labels(f.columns))); break;
            case "redundant": c.add("warn", t.normRedundant(label(f.attribute), f.tables.map(x => x.name)), node(f.tables[0]), t.normRedundantTip); break;
        }
    }
}
