# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AP2 Practice Lab (formerly „AP2 Draw“) is a browser app for practising the written final examination part 2 (AP2) of the German apprenticeship *Fachinformatiker Anwendungsentwicklung*. It has two workspaces:

- **Draw** („Zeichnen“): network diagrams (Netzpläne), all common UML diagrams, ER models (Chen notation) and table models with a normalisation exercise up to 3NF, with automatic checks („Prüfen“), calculation, tidy layout, exercises, Gantt chart, activity list import, „Meine Pläne“ and file/PNG export
- **Subnetting**: IPv4 calculator, equal split and VLSM, IPv6 shortening/expanding, and a trainer with random exercises

Achievements, levels and a hidden „Rainer“ gallery (type `rainer` anywhere outside an input field) motivate practising. The UI speaks German (reference language) and English, with a light/dark/system theme. Both choices are remembered in `localStorage`.

The stack is React 19, TypeScript, zustand and immer, built with Vite and `vite-plugin-singlefile` into **one self-contained HTML file** that is published as a Claude Artifact. There is no server.

---

## Development Commands

### Running and Building

```bash
npm install            # once
npm start              # Vite dev server with hot reload (http://localhost:5173)
npm run build          # dist/index.html (full page) + dist/ap2-practice-lab.html (artifact)
npm run serve          # serve the production build (vite preview)
npm run typecheck      # tsc --noEmit
```

### Linting

```bash
npm run lint             # ESLint (flat config, @moritz-grimm/eslint-config + react-hooks)
npm run lint:fix         # ESLint with autofix
npm run markdownlint     # markdownlint-cli2 over all .md files
npm run markdownlint:fix # markdownlint with autofix
```

### Tests

```bash
npm run test:unit                    # Vitest, src/**/*.test.ts
npm run test:e2e                     # Playwright suites against dist/index.html (build first)
npm test                             # typecheck + unit + build + e2e
python3 tests/e2e/run.py uml rainer  # only suites whose name contains one of the words
```

The e2e suites need Python >= 3.10 with Playwright:

- **Locally:** `pip install playwright && python -m playwright install chromium` (or `pip install -r tests/requirements.txt`)
- **Claude cloud container:** Chromium is preinstalled; run with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npm run test:e2e`
- **Other URL:** `APP_URL=http://localhost:4173 python3 tests/e2e/run.py` tests a running server instead of `dist/index.html`

---

## Project Structure

```text
src/
  main.tsx            entry: loads the sample plan on the very first start, renders <App>
  App.tsx             layout: toolbar, then draw workspace (sidebar, canvas, panel) or subnet view
  components/         React components, one folder per screen area
    Canvas/           SVG canvas, World (whole drawing), NodeView, EdgeView, UmlShape, Markers, InlineEditor
    Dialogs/          Modal and all dialogs (plans, guide, Gantt, exercise, task list, image, achievements …)
    Feedback/         Toast, AchievementPopup, RainerEgg
    Panel/            right panel: properties of the selection, check result, short help
    Sidebar/          left sidebar: diagram kind, palette tiles, relations, example
    Subnet/           subnet workspace with the tabs Calculator, Split, IPv6, Trainer
    Toolbar/          top bar: workspace switch, tools, check, save, language, theme
  state/              zustand stores and actions (see Key Architectural Notes)
  lib/                pure logic without React (check, calculate, layout, routing, subnet, storage)
    netzplan/         graph, forward/backward pass, structure check, layout, exercises, task list
    uml/              node and relation types, check rules, edge routing, sizes, editable fields
    tidy/             „Sauber anordnen“ for every diagram kind (layered layout)
    subnet/           IPv4/IPv6 maths, split/VLSM, exercise generator and answer check (+ *.test.ts)
    db/               ER and table model rules, column syntax, normal forms (+ normalize.test.ts)
  i18n/               all user-visible texts, one file per area (see docs/i18n.md)
  data/               static data: diagram kinds and palettes (modes.ts), examples, normalisation scenarios, guide, Rainer gallery
  hooks/              useKeyboard (all shortcuts + easter egg), useSpaceKey
  types/              diagram.ts (stored data model), check.ts (check result)
  css/custom.css      all styles, colors only as tokens (see Theming)
static/img/rainer/    gallery pictures, inlined as data: URIs at build time
scripts/artifact.mjs  turns dist/index.html into the artifact fragment dist/ap2-practice-lab.html
tests/e2e/            Playwright suites test_*.py, run.py (runner), common.py (APP, out(), finish())
docs/                 developer knowledge base, see docs/README.md
```

### Configuration

- **vite.config.ts:** React plugin + `viteSingleFile()`, everything inlined (`assetsInlineLimit`), alias `@site` = repository root (used for `@site/static/img/...`), Vitest includes `src/**/*.test.ts`
- **tsconfig.json:** strict, `noUnusedLocals`, `noUnusedParameters`, `moduleResolution: bundler`, `jsx: react-jsx`
- **eslint.config.mjs:** re-exports `@moritz-grimm/eslint-config`, adds `react-hooks` rules, ignores `dist/` and `tests/output/`
- **.markdownlint.json:** `MD013`, `MD024`, `MD025`, `MD033` disabled
- **.claude/settings.json:** PostToolUse hook, runs `.claude/hooks/check-edit.mjs` after every Edit/Write (typecheck + ESLint for `.ts`/`.tsx`, markdownlint for `.md`)
- **.github/workflows/ci.yml:** typecheck, lint, markdownlint, unit tests, build, e2e on every push to `main` and every pull request

## Key Architectural Notes

### State

Six zustand stores in `src/state/`, plus the language store in `src/i18n/locale.ts`:

| Store | Hook | Holds | Persisted |
| --- | --- | --- | --- |
| `diagramStore.ts` | `useDiagram` | `doc` (the drawing), undo/redo, view, selection, tool, editor, `dirty`, `checkActive` | `doc` on every change |
| `uiStore.ts` | `useUi` | workspace, right panel open/folded, open dialog, toast, Rainer picture, mode menu | workspace, panel |
| `achievementStore.ts` | `useAchievements` | unlocked achievements, counters, guide chapters read, checked kinds, popups | all but popups |
| `planStore.ts` | `usePlans` | „Meine Pläne“ and the id of the open plan | yes |
| `subnetStore.ts` | `useSubnet` | inputs of all subnet tabs, trainer state | no (survives tab switches, not reloads) |
| `themeStore.ts` | `useTheme` | `system` / `light` / `dark` | yes |
| `i18n/locale.ts` | `useLocale` | `de` / `en` | yes |

### Changing the Drawing

- **Every** change of the drawing goes through `useDiagram.getState().change(recipe)`. The recipe mutates an immer draft. By default `change` first stores an undo snapshot (`pushHistory`, max. 150) and sets `dirty`. `{ history: false }` skips both
- `replace(doc)` swaps the whole drawing (open plan, import, new, exercise) and normalises it
- After every recipe, classes, objects and states are resized to their content (`fitToContent`)
- Continuous gestures (moving, resizing, dragging a message, typing in the panel) call `change(..., { history: !moved })`, so one gesture is exactly one undo step
- Autosave: a store subscription writes `doc` to `localStorage` whenever it changes
- Coordinates are world coordinates on a 10 px grid (`GRID`, `snap()`); `view = {x, y, z}` is only the camera

### Actions

`src/state/actions.ts` is the single place for operations (place, connect, edit, calculate, check, tidy, exercises, plans, import/export, Rainer). It connects the stores with the logic in `src/lib` and unlocks achievements. Components call these functions instead of changing stores themselves. Exceptions are the gestures listed above, which call `change()` directly. Image export lives in `state/exportImage.ts`, the subnet trainer functions in `state/subnetStore.ts`.

### Pure Logic in `src/lib`

Code in `src/lib` has no React and no store access, with two accepted exceptions: it reads the current language through `text()` to produce messages, and `storage.ts` wraps `localStorage`. Functions take a `Diagram` and either return a result or mutate the passed object in place (documented per function, e.g. `calculate(d)`), so they also run inside an immer recipe. New logic goes here and gets unit tests when it is pure (see `src/lib/subnet/*.test.ts`).

### Diagram Kinds

- `MODES` in `src/data/modes.ts` defines the thirteen kinds: items in the palette, allowed relations, optional example. Texts come from `src/i18n/modes.ts`
- Databases: ER model (`er`: `entity`, `relship`, `erattr`, line `erl` with the cardinality as label) and table model (`rel`: `table` with one column per line like `PK kundenNr INT`, `sheet` for sample data, line `fk` with 1/n in `m1`/`m2`). Rules in `src/lib/db/check.ts`, normal forms in `src/lib/db/normalize.ts`, exercise scenarios in `src/data/normalization.ts` (`Diagram.norm`)
- Node types: `np` (activity node of a network diagram), the generic shapes `rect`, `ellipse`, `diamond`, `text`, and all UML types in `UML_TYPES` (`src/lib/uml/types.ts`)
- Relations: `RELATIONS` in the same file; an edge without `kind` is `flow`
- Drawing a UML node: `components/Canvas/UmlShape.tsx`; editable areas: `lib/uml/fields.ts`; arrowheads: `components/Canvas/Markers.tsx`
- Adding a kind or element: `docs/new-diagram-type.md` or the skill `/new-element`

### Checking („Prüfen“)

- `runCheck(doc)` in `src/lib/check.ts` combines the network diagram check (`lib/netzplan/check.ts` + `solve.ts`) and the UML check (`lib/uml/check.ts`, which also runs the database rules of `lib/db/check.ts`). It returns `CheckResult` (`src/types/check.ts`) with issues, marks, counters and `ok`
- The check runs in `Panel` and `Canvas` via `useMemo` while `checkActive` is set; `actions.check()` only switches it on and rewards achievements
- All rules: `docs/check-rules.md`. A new rule is added there **and** in the code, plus a test case

### Internationalisation

Details in `docs/i18n.md`. The rules in short:

- Every visible text is defined in `src/i18n/*.ts` with `defineText(de, en)`. German is the reference, `en` must have exactly the same shape (type error otherwise)
- Texts with values are typed functions, never templates with placeholders
- React components use `const t = useText(dict)` (re-renders on switch). Everything else calls `text(dict)` at the moment it runs
- Persisted ids and keys are never translated or renamed (see **Persistence**)
- A user's drawing is never rewritten on a language switch; new elements get default texts in the current language

### Theming

Colors exist only as tokens on `:root` in `src/css/custom.css` and are redefined for dark mode in **two** places: `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and `:root[data-theme="dark"]`. A new token goes into all three blocks; components never use literal colors. `useTheme` sets `data-theme` on `<html>` (`system` removes it). The PNG export replaces `var(--…)` with the light palette `LIGHT` in `src/lib/image.ts`; a new token used inside drawings must be added there too.

### Artifact Constraints

- Only scripts from cdnjs, jsdelivr, unpkg and stylesheets from Google Fonts may be loaded; everything else is inlined by the build. Images are imported (`import img from "@site/static/img/..."`) and become `data:` URIs
- `alert`, `confirm`, `prompt` and `window.print` do nothing in the viewer; confirmations are built into the page (e.g. the discard dialog)
- Downloads only work through the `downloads` capability (`window.claude.use("downloads")`, see `src/lib/downloads.ts`). Without it the export dialog shows the text for copying
- The layout must work at phone width without horizontal page scroll

## Persistence

All `localStorage` keys start with `netzplan-zeichner-v1` (`STORAGE_KEY` in `src/lib/constants.ts`). The name comes from the first version and is **never changed**: users would lose their plans and progress. Every access goes through `storage` in `src/lib/storage.ts`, which never throws; the app must work without storage.

| Suffix (`KEYS`) | Key | Content |
| --- | --- | --- |
| `diagram` | `netzplan-zeichner-v1` | current drawing (autosave) |
| `plans` | `…-plans` | „Meine Pläne“: `{id, name, mode, created, updated, count, data}` |
| `currentPlan` | `…-current` | id of the open plan |
| `achievements` | `…-ach` | `{u, c, g, k, lastOk}` |
| `guideShown` | `…-guide` | `"1"` after the guide was shown automatically |
| `locale` | `…-lang` | `de` or `en` |
| `theme` | `…-theme` | `system`, `light` or `dark` |
| `workspace` | `…-workspace` | `draw` or `subnet` |
| `panel` | `…-panel` | `open` or `closed` (right panel) |

Never rename, because they are stored or exported 1:1:

- **Storage prefix and suffixes:** as in the table above
- **Achievement fields:** `u` (unlocked id => timestamp), `c` (counters), `g` (guide chapters read), `k` (checked diagram kinds), `lastOk` (fingerprint of the last correct diagram). Versions before 2.0 stored German kind names in `k`; `LEGACY_KIND_NAMES` maps them on load
- **Node fields:** `id`, `type`, `x`, `y`, `w`, `h`, `fill`, `text`, `attrs`, `ops`, `stereo`, `align`, `f` with `nr`, `name`, `d`, `faz`, `fez`, `saz`, `sez`, `gp`, `fp`. Edge fields: `id`, `from`, `to`, `label`, `kind`, `y`, `m1`, `m2`. Diagram: `nodes`, `edges`, `next`, `cfg.start`, `cfg.mode`, `task`, `norm` (`id`, `shown`, `done`)
- **Mode keys:** `netz`, `akt`, `uc`, `kl`, `seq`, `zu`, `obj`, `komp`, `vert`, `pak`, `er`, `rel`, `frei`
- **Normalisation scenario ids:** `invoice`, `course`, `project`; ER attribute kinds in `stereo`: `key`, `multi`, `derived`
- **Node type ids:** `np`, `rect`, `ellipse`, `diamond`, `text` and every key of `UML_TYPES`; relation kinds: every key of `RELATIONS`
- **Achievement ids:** every `id` in `ACHIEVEMENTS` (`src/lib/achievements.ts`); counter names `tasks`, `kinds`, `quick`, `streak`, `guide`, `subnets`, `rainer`
- **Rainer gallery mapping:** the order of `RAINER_GALLERY` in `src/data/rainer.ts` (picture #n is unlocked by a fixed achievement, see `docs/achievements.md`)

New fields get a default in `normalize()` (`src/lib/diagram.ts`) or are read with `??`. Details: `docs/data-model.md`.

## Conventions

### Code Style

- Code, identifiers and comments in English. UI texts only in `src/i18n`
- Few comments: only where the code would be unclear otherwise (a rule, a workaround, a non-obvious unit). JSDoc on exported functions where the name does not say everything
- Explicit return types on functions, 4 spaces, double quotes, semicolons, spaces inside array brackets (`[ a, b ]`). ESLint enforces most of it
- React function components returning `ReactElement`; state read with selectors (`useDiagram(s => s.tool)`)
- `src/css/custom.css` keeps its compact one-rule-per-line style
- Do not reformat code in a change that does something else

### DOM Ids and Classes

The e2e suites drive the app through stable ids, classes and data attributes, for example `#bCheck`, `#bCalc`, `#bPanel`, `#bNew`, `#bOpen`, `#bSave`, `#bLang`, `#bTheme`, `#modeBtn`, `#exBtn`, `#panel`, `#toast`, `#planName`, `#lvl`, `#ed`, `#file`, `#subnetView`, `#sn*`, `.tile[data-k="m0"]`, `[data-mode]`, `[data-newmode]`, `[data-ws]`, `[data-tab]`, `[data-id]`, `[data-eid]`. Keep them when restructuring a component; search `tests/e2e/` before renaming one. New controls get a stable `id`, a `title` and a visible focus state.

### UI Texts

- German addresses the user with „du“, short and active: buttons say what happens („Prüfen“, „Speichern“), toasts confirm the result („Gespeichert.“)
- Error messages name the problem, the tip says how it is right
- IHK terminology in German (FAZ, FEZ, SAZ, SEZ, GP, FP, Vorgang, Aktion, Entscheidung, Gabelung, Vereinigung); English equivalents in `docs/i18n.md`
- The e2e suites assert German texts (default language); change a German text, then search `tests/e2e/` for it

### Rainer Gallery

The pictures in `static/img/rainer/` show a real person and are only used for the easter egg. New pictures go in as `rainer-NN.jpg` (max. 560 px edge, JPEG), get an entry at the end of `RAINER_GALLERY` and an unlocking achievement. Pictures that mock a person's body or appearance are not added.

## Testing Rules

- `npm test` (or at least typecheck, lint, unit, build, e2e) must be green before every commit
- Screenshots of the last e2e run land in `tests/output/` (gitignored). Look at them after visual changes, in light and dark theme
- New pure logic gets a Vitest test next to it (`*.test.ts`); new UI behaviour gets checks in the matching `tests/e2e/test_*.py` suite (`ok(condition, "description")`, `finish(fails)` at the end)
- The `downloads` capability does not exist locally. `tests/e2e/test_file_export.py` shows how to mock it with `add_init_script`

## Publishing

1. Tests green, `npm run build`
2. Publish `dist/ap2-practice-lab.html` as an **update** of the existing artifact <https://claude.ai/artifact/8gN6BVXa34YUPqtZECEp9f> (Artifact tool with `url` set to that link). Updating keeps the link and the users' stored data; a new artifact has its own storage
3. The artifact declares the capability `downloads`. Omitting `capabilities` on an update keeps it
4. Add an entry to `CHANGELOG.md`

`dist/` is not committed; the build creates it. Details: `docs/publishing.md` or the skill `/publish`.

## Documentation

| File | Content |
| --- | --- |
| `docs/architecture.md` | data flow, stores, rendering, events, editing |
| `docs/data-model.md` | the drawing, storage keys, export file |
| `docs/check-rules.md` | all check rules: network diagram, UML, subnetting answers |
| `docs/achievements.md` | achievements, XP, levels, Rainer gallery |
| `docs/new-diagram-type.md` | new elements, relations, diagram kinds |
| `docs/subnetting.md` | subnet workspace and `src/lib/subnet` |
| `docs/i18n.md` | languages, `defineText`, terms |
| `docs/publishing.md` | build, test, publish the artifact |

When behaviour changes, update the matching doc file in the same commit.

### Markdown Formatting

- Every heading and every list is surrounded by blank lines
- Fenced code blocks always have a language
- Term lists use `- **Term:** explanation`
- Use `=>` instead of `→` in prose
- Every `.md` file ends with exactly one newline

## Commit Messages

- **Format:** A single lowercase subject line in imperative mood, no Conventional Commits prefix (`feat:`, `docs:`), no trailing full stop, no body
- **Verb:** `add` for a new feature, `update` for extending or changing one, `fix` for a bug, otherwise `refactor`, `move`, `rename`, `remove`
- **Area:** The feature or file in double quotes, e.g. `add "kommunikationsdiagramm" diagram kind`, `update "check-rules.md" to include empty partition rule`
- **Several changes:** Separate them with `;`, combine several areas with `&`
- **Languages:** When UI texts change, end with the affected languages in parentheses, `(de, en)`, `(de)` or `(en)`

Examples:

```text
add "subnetting" vlsm exercise (de, en)
update "aktivitätsdiagramm" check to include empty partitions (de, en)
fix "prüfen" counting mode hint for start at 1
update "achievements.md" & "data-model.md" to include subnet counters
```

In case of doubt, check `git log --format=%s` and follow the existing pattern.

## Current State and Open Ideas

Version 2.0.0, all checks green. Not published yet: the owner tests the ZIP locally first, gives feedback, and only then the artifact is published (see **Publishing**).

Known rough edges:

- At phone width the toolbar scrolls sideways (`.bar` has `overflow-x: auto`) instead of wrapping or collapsing into a menu
- Component, deployment and package diagrams are detected but have no check rules yet
- The subnet trainer streak is not persisted

Possible next features:

- UML exercises (e.g. „draw an activity diagram for this text“) like the network diagram exercises
- ER exercises („draw the ER model for this text“) and SQL exercises on the table model
- Crow's foot notation as an alternative for the ER model
- Check rules for component, deployment and package diagrams
- More subnetting exercise kinds (e.g. supernetting, „which subnet does this host belong to“)
- Compact toolbar for phones

## Technical Details

- **Node:** >= 20 (`engines`), CI uses 22
- **Python:** >= 3.10 with Playwright (e2e only)
- **React** 19, **TypeScript** ~5.8, **Vite** 8, **Vitest** 5, **zustand** 5, **immer** 11
- **Output:** `dist/ap2-practice-lab.html`, about 0.8 MB (limit 16 MB, checked by `scripts/artifact.mjs`)
- **Artifact:** <https://claude.ai/artifact/8gN6BVXa34YUPqtZECEp9f>
