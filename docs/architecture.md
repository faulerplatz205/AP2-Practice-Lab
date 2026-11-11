# Architecture

## Overview

AP2 Practice Lab is a React single-page app without a server. The drawing is one plain object (`Diagram`) inside the zustand store `useDiagram`. Every change produces a new immutable `doc` through immer, React re-renders the SVG from it, and a store subscription saves it to `localStorage`.

```text
Input (pointer, keyboard, panel, dialog)
  => action in src/state/actions.ts      (or a gesture handler in Canvas / LiveInput)
  => useDiagram.getState().change(recipe)
       pushHistory()                      undo snapshot, dirty = true (unless history: false)
       produce(doc, recipe + fitAll)      immer draft, then classes/objects/states fit their text
  => React re-renders                     Canvas/World, Panel, Sidebar read the store with selectors
  => subscription                         storage.write(KEYS.diagram, doc)
```

Logic that does not need React lives in `src/lib` and takes a `Diagram` as argument. Actions call it and decide what goes into the stores; components read the stores and call actions.

## Screen Layout

| Area | Component | Notes |
| --- | --- | --- |
| Top bar | `components/Toolbar/Toolbar.tsx` | workspace switch, tools, undo/redo, check, calculate, tidy, save, open, download menu, upload, achievements, guide, new, „Darstellung“ menu (language, theme, contrast, accent) |
| Left sidebar | `components/Sidebar/Sidebar.tsx` | diagram kind menu (`#modeBtn`), palette tiles (`.tile[data-k]`), relations, example (`#exBtn`), network diagram tools (Gantt, activity list, exercise; „Berechnen“ only in the top bar, `#bCalc`) |
| Canvas | `components/Canvas/Canvas.tsx` | `<svg id="svg">` with `World`, pointer handling, zoom, inline editor `#ed` |
| Right panel | `components/Panel/Panel.tsx` | priority: selection => check result => short help of the diagram kind. `#bPanel` folds it to a narrow strip (`useUi().panelOpen`, stored); `check()` unfolds it |
| Dialogs | `components/Dialogs/Modal.tsx` | renders `useUi().dialog`; one component per dialog type |
| Feedback | `components/Feedback/*` | toast, achievement/level popups, Rainer picture |
| Subnetting | `components/Subnet/SubnetView.tsx` | replaces sidebar, canvas and panel when `workspace === "subnet"` |

`App.tsx` shows the guide automatically on the very first visit (`KEYS.guideShown`). `main.tsx` loads a calculated sample network diagram when nothing was stored yet.

## Stores

| Store | File | Notes |
| --- | --- | --- |
| `useDiagram` | `state/diagramStore.ts` | drawing, undo/redo as JSON strings (max. 150), view, selection (`selection` = one node or edge, `multi` = several nodes from the selection rectangle, Shift+click or Ctrl+A), tool, palette preset, inline editor, `checkActive`, `dirty` |
| `useUi` | `state/uiStore.ts` | workspace, right panel folded or not (`panelOpen`), the one open dialog (`Dialog` union), toast, Rainer picture |
| `useAchievements` | `state/achievementStore.ts` | progress, popups; `unlock(id)`, `bump(counter)` |
| `usePlans` | `state/planStore.ts` | „Meine Pläne“; `persist()` writes list and current id together and returns `false` when storage is full |
| `useSubnet` | `state/subnetStore.ts` | subnet inputs and trainer, not persisted |
| `useTheme` | `state/themeStore.ts` | sets `data-theme`, `data-contrast` and `data-accent` on `<html>` |
| `useLocale` | `i18n/locale.ts` | sets `lang` on `<html>` |

Stores are read in components with selectors (`useDiagram(s => s.tool)`) and outside React with `getState()`.

## Rendering

- `World` (`components/Canvas/World.tsx`) draws the whole drawing. It is used for the canvas and, with `exporting`, for the PNG export (no selection, no check marks, no hit areas)
- Layer order: containers (system boundary, partition, package, fragment, node) at the back, then lifelines, then edges, then all other nodes. Critical edges are drawn on top
- `NodeView` draws activity nodes and generic shapes itself and hands UML types to `UmlShape`
- `EdgeView` gets its path from `edgeGeometry()` in `lib/uml/routing.ts` and its label positions from `placeLabels()` in `lib/uml/labels.ts`; `World` computes `routeContext()` and the labels once per drawing
- Arrowheads are SVG markers from `Markers.tsx`, each in four colors: normal, critical (`c`), warning (`w`), selected (`s`)
- Check marks come from `runCheck(doc).marks`: `"<node>:<field>"` for a red activity field, `"n:<node>"` for a dashed frame, `"e:<edge>"` for a dashed edge

## Edge Routing

`edgeGeometry(d, e, a, b, ctx)` in `lib/uml/routing.ts` picks the route. `ctx` (`routeContext()`) holds what needs the whole drawing: network diagram rails, activity diagram flow offsets and the chosen path of every control flow.

| Case | Result |
| --- | --- |
| Message between lifelines | horizontal at height `e.y` relative to the sender |
| Line of a node to itself (self transition, reflexive association, self-referencing table) | `selfGeometry`: a loop around a corner that is free of shapes, lines and other loops; further loops take the next free corner, then a wider ring |
| Control flow in activity or state machine diagrams | orthogonal, preferably top to bottom; straight when the shapes overlap enough; parallel flows between the same rows bend at different heights; flows there and back or several transitions between the same two boxes run side by side (`lane`, 20 px apart); loops back up take the side with fewer lines (`flowOffsets`). `routeFlows` then checks every flow in id order: when the usual path runs through a shape or closer than `LINE_GAP` along a flow chosen before, it takes the shortest orthogonal alternative over the side points (middle and ±20 px) that is free |
| Network diagram arrows | orthogonal; arrows sharing a predecessor or successor use a common vertical rail (`sharedRails`) |
| Activity, rectangle, text without UML meaning | elbow arrows |
| ER line | `erGeometry` (`lib/uml/detour.ts`): fans out when an entity takes part twice in a relationship, else straight or around shapes |
| Several relations between the same nodes | `parallelGeometry`: parallel straight lines 26 px apart when the shapes face each other widely enough, else each one bent to its own side |
| Straight line through another shape | `detourGeometry`: the first clear detour over one or two waypoints, or the route stored by „Sauber anordnen“ |
| Everything else | straight line from outline to outline (`anchorPoint`: rectangle, ellipse, diamond) |

Every geometry returns the path and a default label position. `placeLabels()` then moves labels, ER cardinalities and multiplicities to the first spot that covers no line, shape or other label. ER cardinalities start next to the entity end of their line (`erLabelSpots()` in `lib/uml/detour.ts`): in Chen notation as used in IHK solutions the number belongs to the entity it stands at (`Kunde 1 ◇ n Bestellung`: one customer, n orders).

`src/lib/uml/edgeAudit.test.ts` checks all of this: every diagram kind with two shapes at 63 relative positions and single, opposite, double and self lines, plus all examples before and after „Sauber anordnen“. No line may run through a shape, miss its outline, end too short for its arrowhead or run closer than 8 px along another line. `AUDIT_DUMP=out.html npx vitest run src/lib/uml/edgeAudit.test.ts` draws the problem cases (`AUDIT_PICK=<regex>` picks scenes by name).

„Sauber anordnen“ (`tidyDiagram`, `lib/tidy/`) lays out every kind and then calls `routeAll()` (`lib/uml/astar.ts`): relations whose line still runs through a shape get an orthogonal A* route, stored in `edge.route`. The ER model uses its own layout (`tidy/er.ts`): entities on a grid (`erGrid.ts`), relationships between them, attribute rows where no line runs (`erAttributes.ts`).

## Events

- All pointer input runs over `pointerdown`, `pointermove` and `pointerup` on `#svg`. The drag type is `pan`, `move`, `resize`, `arrow` or `message`. `arrow` also starts at the handles of a selected node (`data-port`); `beginArrowFrom()` and the flag `arrowOnce` return the tool to "select" after one arrow. `NodeBar` (next to the selected node) and `EdgeBar` (cardinality of ER lines and table relations) are HTML overlays above the SVG
- Double clicks are detected from two `pointerdown` events, because the native `dblclick` often gets lost after a re-render
- Containers (`box` or `carry` in `UML_TYPES`) carry every node that lies completely inside them when moved (`carriedBy()`)
- Space + drag pans the canvas (`useSpaceKey`), the wheel zooms around the pointer (`zoomAt`)
- Keyboard: `hooks/useKeyboard.ts`. Shortcuts are ignored while typing in a field, with an open dialog and in the subnet workspace. „rainer“ is detected everywhere outside input fields, also with an open dialog

## Editing on the Canvas

A double click opens the floating text field `#ed` (`InlineEditor`) above the right area. `EditorState.kind` says what is edited:

| `kind` | Edits |
| --- | --- |
| `np` | one field of an activity node (`key` = `faz`, `fez`, …); Tab jumps to the next field |
| `field` | `text`, `attrs` or `ops` of a UML element; the area comes from `fieldAt()` in `lib/uml/fields.ts` |
| `shape` | text of a generic shape |
| `edge` | label of an edge; edges leaving a decision get `[ ]` added automatically |

## Image and File Export

- **PNG:** `state/exportImage.ts` renders `World` into a detached React root, replaces CSS variables with the light palette (`resolveThemeVars`, `lib/image.ts`) and draws the SVG into a canvas at up to triple resolution (`exportScale`, at most 6000 px). `exportGanttImage()` does the same for the Gantt chart with its legend
- **PDF:** the image dialog turns the canvas into a one-page A4 PDF with title and date (`lib/pdf.ts`, written by hand, no library)
- **Download menu:** `download(format)` in `state/download.ts` builds the plan file (JSON, see `docs/data-model.md`), the PNG or the PDF and offers it via `offerFile()` (`lib/downloads.ts`), reporting the outcome as a toast. Inside the artifact without permission the plan file opens in the dialog `exportText` (text to copy) and an image in the preview dialog `image`. `copyImage()` puts the PNG on the clipboard
- **Import:** `importFile()` in `actions.ts` refuses images and PDFs with a note, reads `.json` and hands it to `parsePlanFile()` (`lib/diagram.ts`), which tells broken JSON from JSON that is no plan and lets `normalize()` drop broken nodes and edges (counted in the message)
- **Import:** file input `#file` (button in „Meine Pläne“) or a `.json` file dropped onto the canvas; `importFile()` reads it, `importText()` validates, normalises and replaces the drawing (undoable)

## Capabilities in the Artifact

`lib/downloads.ts` requests `downloads` via `window.claude.use("downloads")` with a 10 s timeout and caches the result. Outside an artifact there is no `window.claude` (`insideArtifact()` is false); then `offerFile()` downloads through a temporary object URL and `<a download>` (`browserDownload()`), so the app works as a plain website too.
