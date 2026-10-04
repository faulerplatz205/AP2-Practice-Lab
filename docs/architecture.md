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
| Top bar | `components/Toolbar/Toolbar.tsx` | workspace switch, tools, undo/redo, check, calculate, tidy, image, save, open, achievements, guide, new, language, theme |
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
| `useDiagram` | `state/diagramStore.ts` | drawing, undo/redo as JSON strings (max. 150), view, selection, tool, palette preset, inline editor, `checkActive`, `dirty` |
| `useUi` | `state/uiStore.ts` | workspace, right panel folded or not (`panelOpen`), the one open dialog (`Dialog` union), toast, Rainer picture |
| `useAchievements` | `state/achievementStore.ts` | progress, popups; `unlock(id)`, `bump(counter)` |
| `usePlans` | `state/planStore.ts` | „Meine Pläne“; `persist()` writes list and current id together and returns `false` when storage is full |
| `useSubnet` | `state/subnetStore.ts` | subnet inputs and trainer, not persisted |
| `useTheme` | `state/themeStore.ts` | sets `data-theme` on `<html>` |
| `useLocale` | `i18n/locale.ts` | sets `lang` on `<html>` |

Stores are read in components with selectors (`useDiagram(s => s.tool)`) and outside React with `getState()`.

## Rendering

- `World` (`components/Canvas/World.tsx`) draws the whole drawing. It is used for the canvas and, with `exporting`, for the PNG export (no selection, no check marks, no hit areas)
- Layer order: containers (system boundary, partition, package, fragment, node) at the back, then lifelines, then edges, then all other nodes. Critical edges are drawn on top
- `NodeView` draws activity nodes and generic shapes itself and hands UML types to `UmlShape`
- `EdgeView` gets its path from `edgeGeometry()` in `lib/uml/routing.ts`
- Arrowheads are SVG markers from `Markers.tsx`, each in four colors: normal, critical (`c`), warning (`w`), selected (`s`)
- Check marks come from `runCheck(doc).marks`: `"<node>:<field>"` for a red activity field, `"n:<node>"` for a dashed frame, `"e:<edge>"` for a dashed edge

## Edge Routing

`edgeGeometry(d, e, a, b)` in `lib/uml/routing.ts` picks the route:

| Case | Result |
| --- | --- |
| Message between lifelines | horizontal at height `e.y` relative to the sender |
| Control flow in activity or state machine diagrams | orthogonal, preferably top to bottom |
| Network diagram arrows | orthogonal; arrows sharing a predecessor or successor use a common vertical rail (`sharedRails`) |
| Activity, rectangle, text without UML meaning | elbow arrows |
| Everything else | straight line from outline to outline (`anchorPoint`: rectangle, ellipse, diamond) |

Every geometry returns the path and the label position, from which labels and multiplicities are placed.

## Events

- All pointer input runs over `pointerdown`, `pointermove` and `pointerup` on `#svg`. The drag type is `pan`, `move`, `resize`, `arrow` or `message`
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

- **PNG:** `state/exportImage.ts` renders `World` into a detached React root, replaces CSS variables with the light palette (`resolveThemeVars`, `lib/image.ts`) and draws the SVG into a canvas at double resolution
- **File:** `exportFile()` in `actions.ts` writes the drawing as JSON (see `docs/data-model.md`) and offers it via `offerFile()` (`lib/downloads.ts`). Without the `downloads` capability the dialog `exportText` shows the text for copying
- **Import:** file input `#file` (button in „Meine Pläne“) or a `.json` file dropped onto the canvas; `importFile()` reads it, `importText()` validates, normalises and replaces the drawing (undoable)

## Capabilities in the Claude Artifact

`lib/downloads.ts` requests `downloads` via `window.claude.use("downloads")` with a 4 s timeout and caches the result. Outside an artifact there is no `window.claude`; everything except saving files through the download dialog still works.
