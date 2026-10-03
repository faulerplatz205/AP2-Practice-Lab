---
name: new-element
description: Add a new UML element, relation kind or diagram kind to AP2 Practice Lab end to end, including palette, drawing, check rules, tidy layout, both languages, docs and tests
argument-hint: <what to add, e.g. "communication diagram" or "time signal in the activity diagram">
---

# New Element

Add the element, relation or diagram kind described in $ARGUMENTS.

## Before Starting

1. Read `CLAUDE.md`, especially **Changing the Drawing**, **Diagram Kinds**, **Checking**, **Internationalisation** and **Persistence**
2. Read `docs/new-diagram-type.md`. That file is the step list; this skill only adds what to watch out for
3. Clarify how the element looks in UML 2 and which rules apply to it. If unsure, ask instead of guessing
4. Pick the persisted ids now (node type, relation kind, mode key). They can never be renamed later, so they are short, lower case and English (existing German mode keys stay as they are)

## Implementation

Work through `docs/new-diagram-type.md` in order. While doing so:

- Types first: extend `UmlNodeType`, `RelationKind` or `DiagramMode` in `src/types/diagram.ts`, then let `npm run typecheck` show every `Record<…>` that is now incomplete (texts, sizes, guess mode, examples)
- Every new text goes into `src/i18n/*.ts` with `defineText(de, en)`. German first, English with exactly the same shape. No literal UI strings in components or `src/lib`
- Draw only with color tokens (`var(--ink)`, `var(--node)`, fills via `fill`), so light and dark theme and the PNG export work
- Every new check rule gets a German message naming the mistake and a tip saying how it is right, in both languages
- An existing example of the same diagram kind must still pass the check without errors or hints
- Try „Sauber anordnen“ with the new element
- Changes to the drawing only through `useDiagram.getState().change()` or an action in `src/state/actions.ts`

## Finishing

1. `npm run typecheck`, `npm run lint`, `npm run test:unit` green
2. `npm run build`, then `npm run test:e2e` (in the Claude cloud container with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`)
3. Add a test case to the matching suite (usually `tests/e2e/test_uml.py` or `tests/e2e/test_diagram_types.py`) that places the element and, for new rules, triggers each rule
4. Look at the screenshots in `tests/output/`, at least one showing the new element, in light and dark theme
5. Update `docs/check-rules.md`, the guide chapter „UML-Diagramme“ (`src/data/guide.tsx`, both languages) and `README.md` when something changes for users
6. Summarise briefly: what is new, which rules check it, what was tested
