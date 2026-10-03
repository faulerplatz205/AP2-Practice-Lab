# Check Rules

„Prüfen“ (`runCheck()` in `src/lib/check.ts`) returns a list of issues. Every issue has a level:

| Level | Meaning | Effect |
| --- | --- | --- |
| `error` | wrong | the drawing is not correct; the streak for „Ihr werdet mich niemals besiegen“ is reset |
| `warn` | unclean or incomplete | see **When Is a Drawing Correct** |
| `info` | hint about the procedure | none |
| `ok` | shown on top of the panel when everything is correct | none |

Messages and tips come from `src/i18n/check.ts` in the language active while checking. The result itself never depends on the language.

## When Is a Drawing Correct

- **UML only (no activity node):** no `error` and no `warn`
- **Network diagram:** the structure allows calculating, every time field is filled in and right, no `error`, and no UML `warn` from other elements on the canvas. Structure warnings of the network diagram (number, isolated activity, several start/end activities, redundant arrow) are shown but do not block „correct“

## Network Diagram

Code: `src/lib/netzplan/check.ts` (structure, exercise), `src/lib/netzplan/solve.ts` (forward and backward pass), `src/lib/check.ts` (comparison).

### Structure

| Rule | Level | Blocks calculating |
| --- | --- | --- |
| At least one activity | error | yes |
| No cycle over the arrows | error | yes |
| Every activity has a duration, the duration is not negative | error | yes |
| Every number is present and unique | warn | no |
| No activity without an arrow (with more than one activity) | warn | no |
| Exactly one start and one end activity | warn | no |
| No redundant arrow: A => C is redundant when C already depends on A over another path | warn | no |

„Berechnen“ refuses to run while a blocking error exists and shows that error instead.

### Values

The app calculates the solution itself and compares every field (tolerance 1e-9).

| Field | Start at 0 | Start at 1 |
| --- | --- | --- |
| FAZ (ES) | largest FEZ of the predecessors, first activity 0 | largest FEZ of the predecessors + 1, first activity 1 |
| FEZ (EF) | FAZ + D | FAZ + D - 1 |
| SEZ (LF) | smallest SAZ of the successors, last activity: project end | smallest SAZ of the successors - 1, last activity: project end |
| SAZ (LS) | SEZ - D | SEZ - D + 1 |
| GP (TF) | SAZ - FAZ | SAZ - FAZ |
| FP (FF) | smallest FAZ of the successors - FEZ, last activity: project end - FEZ | smallest FAZ of the successors - FEZ - 1, last activity: project end - FEZ |

- Project end is the largest FEZ of all activities
- Every wrong field is marked red; the issue names the fields, the formula of the first wrong field (`ruleText`) and the correct values
- When there are wrong fields and the values mostly match the other counting mode, a `warn` points to it
- Empty fields produce one `warn` with their count
- Critical path: all activities with GP = 0; an arrow is critical when both ends are critical and FEZ of the predecessor equals FAZ of the successor (`lib/netzplan/critical.ts`)

### Exercise „Zeichnen und rechnen“

Only while `doc.task` exists. While one of these errors exists, the values are not compared (an `info` asks to fix the arrows first).

| Rule | Level |
| --- | --- |
| Every activity of the list is present | error |
| The duration matches the list | error |
| Every predecessor of the list has an arrow | error |
| No arrow that is not in the list | error |

## UML

Code: `src/lib/uml/check.ts`, function `checkUml()`. Notes and note links (`anchor`) are ignored. Each rule group also reports the detected diagram kinds (`kinds`), which count for the achievement „Diagramm-Sammler“.

### Activity and State Machine Diagram

Flow elements: start, end, flow final, action, decision, bar, send/accept signal, object node, state. The kind is `akt` when an activity element exists, `zu` when a state exists.

| Rule | Level |
| --- | --- |
| An initial node exists | error |
| Exactly one initial node | warn |
| A final node exists (activity diagram) | error |
| No arrow into the initial node, exactly one out of it | error |
| No arrow out of a final node or flow final | error |
| Every final node is reached | warn |
| Action, state, signal and object node have an incoming arrow (accept signal excepted) | error |
| Action, signals and object node have an outgoing arrow (state excepted) | error |
| An action has at most one outgoing arrow | warn |
| An action is labelled | warn |
| A decision has an incoming arrow | error |
| A decision has at least two outgoing arrows (one outgoing and several incoming is a merge) | error |
| A diamond is not decision and merge at once | warn |
| Every outgoing arrow of a decision has a guard in `[ ]` | error |
| Guards of one decision are distinct | error |
| Fork: 1 in, at least 2 out. Join: at least 2 in, 1 out | error |
| Only control flow arrows between flow elements | warn |
| A transition between states has an event | warn |
| Every element with an incoming arrow is reachable from the start | warn |
| A partition contains at least one flow element | warn |

### Use Case Diagram

| Rule | Level |
| --- | --- |
| Every use case has an actor or hangs on another use case via «include»/«extend» | warn |
| Every actor is connected | warn |
| «include» and «extend» only between use cases | error |
| Actor and use case are connected by an association (line without head) | warn |
| Actors among each other only by generalisation | warn |
| Actors are outside the system boundary | warn |
| Use cases do not stick out of the system boundary | warn |

### Class and Object Diagram

| Rule | Level |
| --- | --- |
| A class has a name | error |
| Class names are unique | warn |
| A class name starts with a capital letter (interfaces excepted) | warn |
| Attributes and operations have a visibility `+ - # ~` (enums excepted) | warn |
| Attributes have a type `name : Type` | warn |
| Operations have parentheses | warn |
| An interface has no private attributes | warn |
| A class is connected to an interface by realisation, not by generalisation | warn |
| Realisation only points to an interface | warn |
| No generalisation cycle | error |
| An object name has the form `name : Class` | warn |

### Sequence Diagram

| Rule | Level |
| --- | --- |
| Every lifeline has at least one message (activations count for the lifeline below them) | warn |
| Every message is labelled | warn |
| Messages run between lifelines or activations | error |
| Only message arrows between lifelines | warn |
| An activation lies on a lifeline | warn |

### Component, Deployment and Package Diagram

These kinds are detected (`komp`, `vert`, `pak`) and named in the result but have no rules yet.

## Subnetting Answers

Code: `checkField()` in `src/lib/subnet/exercises.ts`. Whitespace is ignored. Each field gets `correct` and, when wrong, a tip:

| Answer kind | Accepted | Tips |
| --- | --- | --- |
| `ipv4` | dotted decimal, leading zeros allowed | `format`, `wrong` |
| `prefix` | `/26` or `26` | `format`, `wrong` |
| `mask` | dotted mask only | `format`, `maskNotContiguous`, `wrong` |
| `netmask` | prefix or dotted mask | `format`, `maskNotContiguous`, `wrong` |
| `integer` | `1024`, `1.024`, `1 024`, `2^10`, `2**10` | `format`, `wrong` |
| `ipv6Short` | must be the RFC 5952 short form | `format`, `notShortened`, `wrong` |
| `ipv6Full` | must be all 32 hex digits | `format`, `notExpanded`, `wrong` |

An empty field gets the tip `empty`. The exercise is solved when every field is correct. Details: `docs/subnetting.md`.

## Adding a Rule

1. Add the rule to the matching table in this file
2. Implement it in `checkUml()` (with `c.add(level, text, node, tip, edgeIds)`) or in `checkStructure()`. The message names the mistake, the tip says how it is right; both go into `src/i18n/check.ts` in German and English
3. Check that every example still passes: `python3 tests/e2e/run.py uml`
4. Add a test case that triggers the rule
