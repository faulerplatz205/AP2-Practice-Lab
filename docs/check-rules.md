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
- **Network diagram:** the structure allows calculating, every time field is filled in and right, no `error`, and no UML `warn` from other elements on the canvas. Structure warnings of the network diagram (number, isolated activity, several start/end activities, redundant or doubled arrow) block „correct“ as well, since an exam answer with them would lose points

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
| An initial node exists (state machine: on the top level, not only inside a composite state); with an accept signal without incoming arrow as start only a hint | error / info |
| Exactly one initial node (initial states inside composite states excepted) | warn |
| A final node exists (activity diagram); only flow finals is a warning | error / warn |
| No arrow into the initial node, exactly one out of it | error |
| No arrow out of a final node or flow final | error |
| Every final node is reached | warn |
| Action, state, signal and object node have an incoming arrow (accept signal excepted) | error |
| Action, signals and object node have an outgoing arrow (state excepted) | error |
| An action has at most one outgoing arrow | warn |
| An action has at most one incoming arrow (several paths meet in a merge diamond first, knowledge base) | warn |
| An action is labelled | warn |
| A decision has an incoming arrow | error |
| A decision has at least two outgoing arrows (one outgoing and several incoming is a merge) | error |
| A diamond is not decision and merge at once | warn |
| Every outgoing arrow of a decision has a guard in `[ ]` | error |
| Guards of one decision are distinct | error |
| Fork: 1 in, at least 2 out. Join: at least 2 in, 1 out | error |
| A connector has exactly one arrow, in or out | error |
| A connector with an incoming arrow has exactly one counterpart with the same letter and an outgoing arrow; one with an outgoing arrow has at least one counterpart with an incoming arrow. Reachability follows the jump | error |
| A connector carries a letter | warn |
| Only control flow arrows between flow elements | warn |
| A transition between states has an event (else it is a completion transition) | info |
| Two transitions leaving one state do not carry the same event and guard (self transitions included) | warn |
| Every element with an incoming arrow is reachable from the start | warn |
| A partition contains at least one flow element | warn |
| A join directly after a decision waits forever (deadlock) | error |
| A merge directly after a fork lets the flow run twice | warn |
| A guard `[ ]` only stands on an arrow leaving a decision | warn |
| The transition from an initial state has no trigger | warn |
| A history state lies inside a composite state; a composite state is not empty | warn |

### Use Case Diagram

| Rule | Level |
| --- | --- |
| At least one actor; actors and use cases have a name; no name twice | warn / error |
| Every use case has an actor or hangs on another use case via «include»/«extend» or generalisation | warn |
| No plain association between two use cases | warn |
| No «include»/«extend» cycle | error |
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
| An interface extending an interface uses generalisation (no warning) | — |
| No attribute twice in one class | warn |
| A boolean attribute starts with `is`, `has` or `can` (knowledge base) | info |
| Attributes are not public (constants in capitals excepted, knowledge base) | warn |
| An interface has no attributes except constants | warn |
| An operation has a return type (`: void` may be left out, as in IHK solutions) | info |
| Enum values carry no type and no visibility | warn |
| Members start with a lower case letter; identifiers contain no umlauts (knowledge base) | warn |
| Only class relations between classes, no control flow | warn |
| An association between classes has multiplicities | warn |

### Sequence Diagram

Rules follow the knowledge base article „Sequenzdiagramm“: time runs downwards, a reply answers a synchronous call and carries the return value, alternatives and loops are combined fragments with guards.

| Rule | Level |
| --- | --- |
| Every lifeline has at least one message (activations count for the lifeline below them) | warn |
| A lifeline has a name, no name twice, and is an object (`:Shop`, `korb : Warenkorb`), not an activity with spaces | warn |
| Every message is labelled; a synchronous or asynchronous call has parentheses (`reservieren(artikelNr)`) | warn |
| Messages run between lifelines or activations, within the lifeline's length | error |
| Only message arrows between lifelines | warn |
| A reply follows an earlier synchronous call in the other direction | error |
| A reply carries the return value, not the operation name again | warn |
| A synchronous call without a reply | info |
| An activation lies on a lifeline (nested bars beside it count) and starts with an incoming message, the nested bar of a self call with that self message (not on the lifeline that starts the interaction) | warn |
| An activation lasts until the reply to its call | warn |
| A destruction X lies on a lifeline, once, at its end; no message after it | warn / error |
| A «create» message points at the head of a lifeline, once; no message to that lifeline before it | error / warn |
| A state invariant lies on a lifeline and is written in braces (`{bestand >= 0}`) | warn |
| A fragment has a known operator (`alt`, `opt`, `loop`, `par`, `break`, `ref`, `critical`, `neg`, `assert`, `seq`, `strict`, `sd`); `loop(1,3)` may carry its bounds in the tab | warn |
| `alt`, `opt`, `loop` and `break` have a guard; every `alt` operand has one; no guard twice; `[else]` is the last operand | warn |
| `alt`, `par` have at least two operands, the others exactly one; operands lie inside a fragment | warn |
| A fragment encloses at least one message (except `ref` and the `sd` frame) | warn |

### Component Diagram

Code: `src/lib/uml/checkStructure.ts`, messages `structureCheckText` in `src/i18n/checkStructure.ts`. Reference: <https://knowledge.moritz-grimm.dev/de/docs/fundamentals/uml/component-diagram>. An interface (ball) is **provided** by a component through a solid line to the ball, and **required** through a socket line (`require`, half circle) or a dependency from the component to the ball. The knowledge base prefers ball and socket over a plain dependency.

| Rule | Level |
| --- | --- |
| A component has a name | error |
| Component names are unique | warn |
| An interface has a name | error |
| An interface is attached to at least one component | warn |
| A required interface is provided by a component | error |
| A dependency points from the component to the interface, not away from the interface | warn |
| A realisation leads from the component to the interface | warn |
| Two interfaces are not connected directly | error |
| Components are not connected by a plain line (use an interface or a dependency) | warn |
| No cyclic dependency between components, also through required and provided interfaces | error |
| A socket line (`require`) runs from a component or port to an interface | warn |
| A delegation runs between a port and a component | warn |
| A port sits on the border of its component | warn |
| Inner parts do not connect across the border of their component | warn |

### Deployment Diagram

Reference: <https://knowledge.moritz-grimm.dev/de/docs/fundamentals/uml/deployment-diagram>. The name of a node is every line of its text that is not a `«stereotype»`.

| Rule | Level |
| --- | --- |
| A node has a name | error |
| A node stereotype other than `«device»` or `«executionEnvironment»` is allowed but named | info |
| A device does not lie inside an execution environment (it is the other way round) | warn |
| Classes and components do not lie inside a node | warn |
| An artifact has a name | error |
| An artifact name is a file name (contains `.`, `:` or `/`) | warn |
| An artifact lies inside a node or has a dependency to a node (`«deploy»`); a `«manifest»` alone does not deploy it | warn |
| `«deploy»` runs from an artifact to a node, `«manifest»` from an artifact to a component or class | warn |
| A dependency between a node and an artifact points from the artifact to the node | warn |
| A communication path (line between two nodes) carries a protocol, e.g. `«HTTPS»` | warn |
| A communication path between two nodes has no arrowhead (nested nodes excepted) | warn |
| An artifact is not on a communication path | warn |

### Package Diagram

Reference: <https://knowledge.moritz-grimm.dev/de/docs/fundamentals/uml/further-uml-diagrams#paketdiagramm>.

| Rule | Level |
| --- | --- |
| A package has a name | error |
| Package names are unique within the same parent package | warn |
| A keyword on a dependency between packages is `«import»`, `«access»`, `«merge»` or `«use»` | warn |
| No dependency between a package and a package nested in it | warn |
| No cyclic dependency between packages | warn |
| `«import»`, `«access»` and `«merge»` only between packages | warn |

### Extra Class, Object and State Rules

Also in `checkStructure.ts`.

| Rule | Level |
| --- | --- |
| A multiplicity on an association, aggregation or composition between classes is valid (`1`, `0..1`, `*`, `1..*`, `2..5`, `n`, lists with `,`; lower bound not above the upper one) | warn |
| Object attributes carry values (`name = value`), not types (`name : Type`) | warn |
| A link between objects has no multiplicity | warn |
| A link between objects is a plain line without arrowhead (knowledge base) | info |
| No generalisation between objects | error |
| A state has a name | warn |

## Databases

Code: `src/lib/db/check.ts` (rules), `src/lib/db/normalize.ts` (normal forms), `src/lib/db/columns.ts` (column syntax). Messages: `dbCheckText` in `src/i18n/database.ts`.

### ER Model (Chen Notation)

Entities are rectangles, relationships diamonds, attributes ellipses; a key attribute is underlined (`stereo: "key"`). As in the knowledge base article „ER-Modell“, a weak entity has a double border (`stereo: "weak"`), its identifying relationship is a double diamond (`stereo: "ident"`) and its partial key has a dashed underline (`stereo: "partial"`); multivalued attributes have a double ellipse (`multi`), derived ones a dashed ellipse (`derived`). The cardinality of a line between entity and relationship is its `label` and is drawn next to the entity. Chen notation reads across the relationship: in `Kunde 1 ◇ bestellt ◇ n Bestellung` one customer places n orders, one order belongs to 1 customer. New lines get 1 on the first and n on every further line of a diamond.

| Rule | Level |
| --- | --- |
| Every entity has a name; no name twice | error / warn |
| Every entity has a key attribute | warn |
| A weak entity has no key of its own but a partial key | warn |
| A weak entity is connected to an identifying relationship | error |
| An identifying relationship connects a weak entity | warn |
| A partial key belongs to a weak entity | warn |
| Every attribute is attached; to at most one entity or relationship | error / warn |
| Key attributes belong to entities, not to relationships | warn |
| Every relationship has a name | warn |
| A relationship connects at least two entities (recursive: the same entity twice) | error |
| No direct line between two entities or between two relationships | error |
| Every line between entity and relationship has a cardinality | error |
| The cardinality is 1, n, m, c, mc, a number or `(min,max)` | warn |
| No UML range like `1..*` in a Chen diagram (knowledge base) | warn |
| No foreign key as an attribute: an attribute named like the key of another entity (knowledge base) | warn |
| Only plain lines (`erl`) between ER elements | warn |

### Table Model

A table lists one column per line: optional `PK`/`FK` (both for junction tables), the name, an optional data type (`PK kundenNr INT`, `FK plz CHAR(5)`, `name : VARCHAR(50)`). Names are compared with `columnKey()`: case, umlauts and separators do not matter, a trailing `Nummer`, `Number`, `No` or `Id` counts as `Nr`. Keys may also follow the name (`kundenNr INT (PK)`, `kundenNr INT PK`), be written in SQL (`PRIMARY KEY`, `FOREIGN KEY`, `REFERENCES Kunde`) or as `↑kundenNr` / `#kundenNr` for a foreign key (both markers as in the knowledge base article „Datenbankschema“). A foreign key points to a table when it names it after `REFERENCES`, has the name of one of its primary keys, or the table name plus that key (`kunde_id`, `kundenId` => `Kunde` with `PK id`; `fkPointsTo()`).

| Rule | Level |
| --- | --- |
| Every table has a name; no name twice | error / warn |
| Every table has columns and a primary key | error |
| No column twice in a table | error |
| A foreign key is named like a primary key of another table | warn |
| Tables linked by a foreign key are connected by a line | warn |
| A line has cardinalities at both ends | warn |
| No m:n line between two tables (junction table instead) | error |
| One of the two tables holds a foreign key to the other | error |
| The foreign key is in the table on the n side | warn |
| Only `fk` lines between tables | warn |

Data tables (`sheet`) are sample data and are not checked.

### Normalisation Exercise

The scenario (`src/data/normalization.ts`) defines the attributes of the source table with accepted names and the functional dependencies. `checkNormalization()` maps every column to an attribute and checks:

| Rule | Level |
| --- | --- |
| 1NF: no non-atomic column (e.g. „Teilnehmer“ for first and last name) | error |
| 1NF: no repeating group (numbered columns like `artikel1`, `artikel2`) | error |
| Every attribute of the source table appears in a table | error |
| The primary key determines all columns of its table | error |
| The primary key is minimal | warn |
| The columns of a table belong together (some candidate key consists of determinants) | error |
| 2NF: no non-key column depends on part of a composite key (one message per key part) | error |
| 3NF: no non-key column depends on another non-key column | error |
| A non-key column appears in one table only (otherwise it must be marked FK) | warn |
| Columns that are not in the source table (e.g. an extra running ID) | info |

Extra columns are left out of the analysis, so a surrogate key does not count as an error.

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
