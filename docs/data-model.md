# Data Model

Types: `src/types/diagram.ts`. Everything in this file is stored or exported 1:1, so fields are never renamed.

## The Drawing (`Diagram`)

```ts
const doc: Diagram = {
    nodes: [ /* DiagramNode */ ],
    edges: [ /* DiagramEdge */ ],
    next: 42,                        // next free id for nodes and edges
    cfg: { start: 0, mode: "netz" },
    task: { mode: "calc", list: [], usedCalc: false, done: false }, // only during an exercise
};
```

### `cfg`

| Field | Values | Meaning |
| --- | --- | --- |
| `start` | `0` or `1` | counting mode of the network diagram |
| `mode` | `netz`, `akt`, `uc`, `kl`, `seq`, `zu`, `obj`, `komp`, `vert`, `pak`, `frei` | selected diagram kind, controls the left sidebar |

If `mode` is missing or unknown (older plans), `guessMode()` derives it from the node types.

| Key | Kind (de) | Kind (en) |
| --- | --- | --- |
| `netz` | Netzplan | network diagram |
| `akt` | Aktivitätsdiagramm | activity diagram |
| `uc` | Use-Case-Diagramm | use case diagram |
| `kl` | Klassendiagramm | class diagram |
| `seq` | Sequenzdiagramm | sequence diagram |
| `zu` | Zustandsdiagramm | state machine diagram |
| `obj` | Objektdiagramm | object diagram |
| `komp` | Komponentendiagramm | component diagram |
| `vert` | Verteilungsdiagramm | deployment diagram |
| `pak` | Paketdiagramm | package diagram |
| `frei` | Freies Zeichnen | free drawing |

### Nodes (`DiagramNode`)

| Field | Type | On | Meaning |
| --- | --- | --- | --- |
| `id` | number | all | unique in the drawing |
| `type` | string | all | `np`, `rect`, `ellipse`, `diamond`, `text` or a key of `UML_TYPES` |
| `x`, `y`, `w`, `h` | number | all | position and size in world coordinates |
| `fill` | 0 to 4 | all | fill color: default, blue, green, yellow, red (`FILLS`) |
| `text` | string | all | name or label, multi-line with `\n`; empty for `np` |
| `attrs` | string | `class`, `object`, `state`, `fragment` | attributes, attribute values, state activities or guard, one per line |
| `ops` | string | `class` | operations, one per line |
| `stereo` | string | `class` | empty, `abstract`, `interface` or `enum` |
| `align` | `"left"` | `text` | left-aligned text, e.g. for exercise texts |
| `f` | object | `np` | `nr`, `name`, `d`, `faz`, `fez`, `saz`, `sez`, `gp`, `fp`, all strings |

Network diagram values are strings because fields may be empty or wrong. `num()` reads them with comma or dot, `fmt()` writes at most two decimals with a decimal comma. The keys follow the German IHK terms: `faz`/`fez`/`saz`/`sez`/`gp`/`fp` = ES/EF/LS/LF/TF/FF.

UML node types: `class`, `object`, `actor`, `usecase`, `boundary`, `start`, `end`, `flowend`, `action`, `decision`, `bar`, `signal`, `accept`, `objnode`, `lane`, `state`, `lifeline`, `actline`, `activation`, `fragment`, `component`, `iface`, `node3d`, `artifact`, `package`, `note`.

### Edges (`DiagramEdge`)

| Field | Type | Meaning |
| --- | --- | --- |
| `id`, `from`, `to` | number | edge from node `from` to node `to` |
| `kind` | string | key of `RELATIONS`; missing means `flow` |
| `label` | string | label; edges leaving a decision always store it with `[ ]` |
| `y` | number | messages only: height relative to the top of the sender |
| `m1`, `m2` | string | multiplicity at the start and the end |

Relation kinds: `flow`, `assoc`, `dir`, `inherit`, `realize`, `aggr`, `comp`, `dep`, `include`, `extend`, `msg`, `async`, `reply`, `anchor` (note link).

### Exercise (`task`)

| Field | Meaning |
| --- | --- |
| `mode` | `calc` („Rechnen“: the plan is drawn) or `draw` („Zeichnen und rechnen“: only the activity list is given) |
| `list` | `{nr, name, d, pred}` rows of the activity list |
| `usedCalc` | „Berechnen“ was used; part of the drawing, so undo takes it back |
| `done` | already counted as solved |

## Browser Storage

All keys start with `netzplan-zeichner-v1` (`STORAGE_KEY`). Suffixes are in `KEYS` (`src/lib/storage.ts`).

| Key | Content |
| --- | --- |
| `netzplan-zeichner-v1` | current drawing (autosave on every change) |
| `netzplan-zeichner-v1-plans` | „Meine Pläne“: `{id, name, mode, created, updated, count, data}[]`, `data` is the drawing as JSON text |
| `netzplan-zeichner-v1-current` | id of the open plan, empty when none |
| `netzplan-zeichner-v1-ach` | `{u, c, g, k, lastOk}`: unlocked achievements with timestamp, counters, guide chapters read, checked UML kinds (mode keys), fingerprint of the last correct diagram |
| `netzplan-zeichner-v1-guide` | `"1"` once the guide was shown automatically |
| `netzplan-zeichner-v1-lang` | `de` or `en` |
| `netzplan-zeichner-v1-theme` | `system`, `light` or `dark` |
| `netzplan-zeichner-v1-workspace` | `draw` or `subnet` |

The subnet inputs and the trainer are not stored.

## Export File

Export writes the drawing with two extra fields:

```json
{ "app": "AP2 Practice Lab", "version": 1, "nodes": [], "edges": [], "next": 1, "cfg": { "start": 0, "mode": "netz" } }
```

Files from version 1 carry `"app": "AP2 Draw"`. Import accepts any JSON with `nodes` and `edges` arrays (`looksLikeDiagram`), removes `app` and `version`, normalises the rest and replaces the drawing. An import is undoable. The file name is the plan name or `ap2lab-<kind>-<yyyy>-<mm>-<dd>.json`.

## Compatibility

- `normalize()` in `src/lib/diagram.ts` runs on everything loaded (storage, plans, files, undo): missing arrays become empty, `next` is raised above every id, `cfg.start` falls back to 0, an unknown `cfg.mode` is guessed
- New fields get a default in `normalize()` or are read with `??`
- Existing fields are never renamed. If it cannot be avoided, `normalize()` translates the old field
- Achievement progress from versions before 2.0 stored German kind names in `k`; `LEGACY_KIND_NAMES` in `achievementStore.ts` maps them to mode keys
