# New Diagram Type or Element

Start with the types in `src/types/diagram.ts`. After extending a union, `npm run typecheck` lists most places that still need an entry, because texts and tables are typed as `Record<…>` over it.

Persisted ids (node type, relation kind, mode key) can never be renamed later. Pick short, lower-case ids.

## New Element in an Existing Diagram Kind

1. **Type:** add the id to `UmlNodeType` in `src/types/diagram.ts`
2. **Geometry and flags:** entry in `UML_TYPES` (`src/lib/uml/types.ts`):

   ```ts
   timer: { w: 40, h: 50, minW: 30, minH: 36 },
   ```

   | Field | Meaning |
   | --- | --- |
   | `w`, `h` | default size |
   | `minW`, `minH` | minimum size when resizing (default 40 x 24) |
   | `stereo` | initial stereotype (classes) |
   | `notext` | element has no text (e.g. initial node); no inline editor |
   | `round` | edges dock on a circle |
   | `box` | container: lies at the back and carries its content when moved |
   | `carry` | carries its content but is not at the very back (lifeline) |

3. **Texts:** name and default texts in `umlText` (`src/i18n/diagram.ts`), German and English: `label`, `text`, optional `attrs`, `ops`
4. **Drawing:** a `case` in `UmlShape` (`src/components/Canvas/UmlShape.tsx`). Colors only through the `fill` prop and tokens such as `var(--ink)`, so both themes and the PNG export work. The palette tile preview (`NodePreview`) reuses this drawing
5. **Editing:** in `fieldAt()` (`src/lib/uml/fields.ts`) decide which area a double click edits (`text`, `attrs`, `ops`)
6. **Panel:** if extra fields are needed, add them to `UmlPanel` (`src/components/Panel/UmlPanel.tsx`), with texts in `src/i18n/panel.ts`. Value changes go through `LiveInput`/`LiveTextarea` or `change()`
7. **Palette:** add `item(type, i.<label>, preset?)` to the diagram kind in `buildModes()` (`src/data/modes.ts`) and the label to `modeText.items` (`src/i18n/modes.ts`, both languages). A preset sets initial values, e.g. `item("class", i.interface, { stereo: "interface", … })`
8. **Group membership:** flow elements go into `FLOW_TYPES`, sequence elements into `SEQUENCE_TYPES` (`src/lib/uml/types.ts`); check `autoRelation()` for the default relation
9. **„Danach anhängen“:** flow elements that can be appended get an entry in `appendFlow`/`appendState` (`src/i18n/panel.ts`)
10. **Check rules:** in `checkUml()` (`src/lib/uml/check.ts`), messages in `umlCheckText` (`src/i18n/check.ts`), table in `docs/check-rules.md`
11. **Kind detection:** `guessMode()` in `src/lib/diagram.ts`, so stored plans without `cfg.mode` recognise the kind
12. **Tidy layout:** check that „Sauber anordnen“ (`src/lib/tidy/tidy.ts`) handles the element sensibly

## New Diagram Kind

1. Create the elements as above
2. Add the mode key to `DiagramMode` (`src/types/diagram.ts`) and to `ALL_MODES` in `src/lib/diagram.ts` (otherwise `normalize()` replaces it by a guess)
3. Label and short tips in `modeText.modes` (`src/i18n/modes.ts`), German and English
4. Entry in `buildModes()` (`src/data/modes.ts`): `items`, `relations`, optional `example`. The order of `MODES` is the order in the sidebar menu and the „Neu“ dialog
5. `guessMode()`: add the element types of the kind
6. In `checkUml()` report the kind with `c.kinds.add("<key>")`, so it counts for „Diagramm-Sammler“
7. Optional example:
   - key in `ExampleKey` and `EXAMPLE_MODE` (`src/data/modes.ts`)
   - structure in `buildExamples()` (`src/data/examples.ts`), texts in `src/i18n/examples.ts`
   - the example must pass the check without errors or hints (asserted by `tests/e2e/test_uml.py`)
8. Guide chapter „UML-Diagramme“ (`src/data/guide.tsx`, both languages) and `README.md`

## New Relation Kind

1. Add the id to `RelationKind` (`src/types/diagram.ts`)
2. Entry in `RELATIONS` (`src/lib/uml/types.ts`):

   ```ts
   msg: { end: "ah", seq: true },
   ```

   | Field | Meaning |
   | --- | --- |
   | `end`, `start` | arrowhead: `ah` filled, `op` open, `tr` hollow triangle, `dh` hollow diamond, `df` filled diamond |
   | `dash` | dash pattern, e.g. `"7 5"` |
   | `tag` | fixed text on the line, e.g. `"«include»"` |
   | `seq` | message in a sequence diagram (horizontal, draggable) |

3. Name in `relationLabels` (`src/i18n/diagram.ts`), German and English
4. Add it to `relations` of the diagram kinds that offer it (`src/data/modes.ts`)
5. A new arrowhead is defined in `Markers.tsx`, in all four color variants

## Finishing

```bash
npm run typecheck && npm run lint && npm run test:unit
npm run build && npm run test:e2e
```

Add a test case (usually `tests/e2e/test_uml.py` or `tests/e2e/test_diagram_types.py`), then look at the screenshots in `tests/output/`, in light and dark theme.
