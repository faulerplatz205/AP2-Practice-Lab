# Achievements, Levels and Rainer Gallery

Code: `src/lib/achievements.ts` (list, levels), `src/state/achievementStore.ts` (progress, `unlock`, `bump`), `src/i18n/achievements.ts` (names, descriptions, level titles), `src/data/rainer.ts` (gallery). Triggers sit in `src/state/actions.ts`, `src/state/subnetStore.ts` and `src/state/exportImage.ts`.

## Achievements

27 achievements, 1340 XP in total. Ids and counter names are stored and never renamed.

| id | Name (de) | Condition | XP | Counter | Secret |
| --- | --- | --- | --- | --- | --- |
| `first_node` | Erster Vorgang | place an activity node | 10 | | |
| `first_arrow` | Verbunden | connect two nodes with the arrow tool (any diagram kind; „+“ and dragging into empty space do not count) | 10 | | |
| `calc` | Rechenknecht | „Berechnen“ succeeds | 15 | | |
| `check_ok` | Richtiger Netzplan | correct check (every field filled in, no error, no hint) of a drawing with at least one activity | 50 | | |
| `milestone` | Meilenstein | correct network diagram with an activity of duration 0 | 25 | | |
| `big` | Großprojekt | correct network diagram with at least 10 activities | 60 | | |
| `start1` | Andere Schule | correct network diagram with „Start bei 1“ | 40 | | |
| `mental` | Kopfrechner | solve a „Rechnen“ exercise without „Berechnen“ | 100 | | |
| `architect` | Architekt | solve a „Zeichnen und rechnen“ exercise without „Berechnen“ | 120 | | |
| `tasks5` | Dauerlerner | 5 network diagram exercises checked correctly (each counts once, „Berechnen“ allowed) | 150 | `tasks` = 5 | |
| `uml_first` | UML-Einsteiger | place the first UML, ER or table element (also by example, „+“ or „Danach anhängen“) | 10 | | |
| `act_ok` | Ablauf-Profi | correct check of a drawing that contains an activity diagram | 60 | | |
| `uml_ok` | Richtiges UML-Diagramm | UML diagram, ER or table model without errors and hints | 50 | | |
| `uml_kinds` | Diagramm-Sammler | 4 different kinds checked correctly (UML kinds, `er`, `rel`; not `netz`) | 120 | `kinds` = 4 | |
| `quick` | Schnellzeichner | append 10 elements: „+“ on the node bar, dragging an arrow into empty space, „Danach anhängen“/„Zweig hinzufügen“, „Attribut anhängen“ | 20 | `quick` = 10 | |
| `unbeatable` | Ihr werdet mich niemals besiegen | 5 different diagrams in a row without a mistake | 100 | `streak` = 5 | |
| `list` | Listenprofi | create a network diagram from an activity list | 20 | | |
| `layout` | Ordnung muss sein | „Sauber anordnen“ with at least one node | 10 | | |
| `gantt` | Gantt-Fan | open the Gantt chart (needs a calculable network diagram) | 10 | | |
| `export` | Fotograf | download PNG or PDF, copy the image, or save the Gantt chart as image (not the .json plan file) | 15 | | |
| `guide` | Leseratte | open every chapter of the guide | 20 | `guide` = 9 | |
| `subnet_first` | Netzwerker | enter a valid input in any subnet tool (calculator, split, VLSM, IPv6) | 10 | | |
| `subnet_ok` | Maskenträger | first trainer exercise answered completely right without showing the solution (earlier wrong attempts are fine) | 40 | | |
| `subnet10` | Subnetz-Profi | 10 trainer exercises answered completely right without showing the solution | 120 | `subnets` = 10 | |
| `night` | Nachtschicht | any correct check (network diagram, UML, ER, table model) while the local hour is 22, 23, 0, 1, 2, 3 or 4 | 30 | | yes |
| `rainer` | Rainer! | type „rainer“ | 50 | | |
| `rainer10` | Rainer-Fanclub | call Rainer 10 times (opening a gallery picture does not count) | 75 | `rainer` = 10 | |

### Dialog

Every description in `achievementText` says exactly what triggers the achievement, matching the code. A locked secret achievement shows „Geheimes Achievement“ and its `hint` instead of name and description; `night` is the only secret one. Achievements with a counter show a progress bar with `count / target` until they are unlocked. Each achievement that unlocks a picture carries the badge „Schaltet Rainer #n frei“.

### Counters

`bump(counter)` raises a counter and unlocks every achievement whose `counter` reached its `target`. Two counters are set directly instead:

- **`kinds`:** the number of distinct UML kinds in `checkedKinds` after a correct UML check
- **`guide`:** the number of distinct chapters opened. `guide` unlocks when this reaches the number of chapters in `GUIDE` (`src/data/guide.tsx`); the `target` of 9 in `ACHIEVEMENTS` only drives the progress display. Adding a chapter means raising the target too

### Streak „Ihr werdet mich niemals besiegen“

- A correct check raises `streak` when the drawing differs from the last correct one (`contentFingerprint()`: types, texts, durations and edges, no positions)
- A check with at least one `error` resets `streak` to 0 and forgets the last fingerprint
- A check with only warnings changes nothing

### „Kopfrechner“ and „Architekt“

„Berechnen“ during an exercise sets `doc.task.usedCalc`. Because the flag is part of the drawing, undo takes it back. A correct check marks the task as `done`, raises `tasks` and unlocks `mental` (`calc` task) or `architect` (`draw` task) when `usedCalc` is not set.

### Subnetting

`subnet_ok` and `subnets` only count when the exercise is solved for the first time and the solution was not shown before. Showing the solution resets the trainer streak (shown in the UI, not stored).

## Levels

| Level | From XP | Title (de) | Title (en) |
| --- | --- | --- | --- |
| 1 | 0 | Azubi-Neuling | Apprentice rookie |
| 2 | 40 | Praktikant | Intern |
| 3 | 100 | Planer | Planner |
| 4 | 190 | Projektplaner | Project planner |
| 5 | 300 | Netzplan-Profi | Network pro |
| 6 | 440 | UML-Zeichner | UML drawer |
| 7 | 600 | Prüfungsreif | Exam ready |
| 8 | 800 | Projektleiter | Project lead |
| 9 | 1000 | AP2-Meister | AP2 master |

Thresholds: `LEVELS` in `src/lib/achievements.ts`, titles: `levelTitles` in `src/i18n/achievements.ts`. A level-up shows its own popup after the achievement popup.

## Rainer Gallery

Typing „rainer“ (case-insensitive, not in input fields, also with an open dialog) closes the dialog, unlocks `rainer`, raises the counter `rainer` and shows a random unlocked picture. The same picture never comes twice in a row. In the achievement dialog, tab „Rainer-Galerie“, unlocked pictures can be opened directly; this does not count as a call.

| Picture | File | Unlocked by |
| --- | --- | --- |
| #1 | `rainer-01.jpg` | `rainer` |
| #2 | `rainer-02.jpg` | `check_ok` |
| #3 | `rainer-03.jpg` | `uml_ok` |
| #4 | `rainer-04.jpg` | `act_ok` |
| #5 | `rainer-05.jpg` | `rainer10` |
| #6 | `rainer-06.jpg` | `unbeatable` |
| #7 | `rainer-07.jpg` | `mental` |
| #8 | `rainer-08.jpg` | `architect` |
| #9 | `rainer-09.jpg` | `night` |

A locked tile in the gallery shows the name of its achievement (or „Geheimes Achievement“), what to do (or the hint) and, if there is a counter, the progress.

The order of `RAINER_GALLERY` is the picture number shown to users. New pictures are only appended.

## Adding an Achievement

1. Add the entry to `ACHIEVEMENTS` in `src/lib/achievements.ts`: `id`, `xp`, `icon` (one character), optional `hidden`, `counter` and `target`
2. Add name and description to `achievementText` in `src/i18n/achievements.ts`, German and English. The type `AchievementId` comes from this dictionary
3. Call `unlock("id")` or `bump("counter")` where it happens, usually in `src/state/actions.ts`
4. Extend the table above; if the XP total changes noticeably, check the level thresholds
5. To unlock a picture: put it into `static/img/rainer/` (max. 560 px edge, JPEG), import it in `src/data/rainer.ts` and append it to `RAINER_GALLERY`
6. Add a check to `tests/e2e/test_achievements.py`
