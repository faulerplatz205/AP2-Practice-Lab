# Changelog

Newest entries at the top. The versions match the releases of the artifact.

## 2.4.0 – 2026-11-11

Everything the IHK Belegsatz and the exam sheets show can now be drawn the way it is printed there.

### Added

- **Connector** in the activity diagram: a circle with a letter; the flow ends at one connector and goes on at the one with the same letter. „Prüfen“ follows the jump and reports a connector without a counterpart, without a letter or with more than one arrow
- **Extension points** of a use case: listed in the panel, drawn below a line inside the ellipse; a double click below the line edits them
- **Note on a line:** with the arrow tool click a note and then a line, e.g. to put the condition next to an «extend». The dotted link ends in the middle of the line, follows it and goes when the line is deleted
- The **note** is offered with the elements of the use case, class and state machine diagram, where the Belegsatz shows it

### Changed

- **Network diagram node** as on the exam sheets: a box with number and name above duration, total and free float; FAZ and FEZ stand above its corners, SAZ and SEZ below them. The legend in the panel shows the same
- **Class:** without attributes and methods it is a plain box with its name; an abstract class carries `{abstract}` below its italic name

## 2.3.1 – 2026-11-11

Nested activation bars in the sequence diagram and one consistent shape for every control.

### Added

- **Nested activation bars:** an activation bar placed or dragged onto a running bar lands beside it, one step further right per level, and goes back onto the dashed line when the outer bar is gone. A self message drawn on a running bar brings its nested bar along and ends on it

### Changed

- **One corner system:** every button, field, tile and menu row has the same corner, floating bars, menus and cards the next larger one, dialogs the largest. Pills are gone (plan name, level chip, toast, badges), color swatches are squares like the other controls
- **„Prüfen“** looks like the buttons next to it, filled grey with the accent color only on its icon; the same for „Anleitung öffnen“ in the panel. Only the confirming button of a dialog stays filled with the accent color
- A selected chapter of the guide is tinted like every other selected control, menu rows are highlighted in grey

### Fixed

- **Sequence diagram:** a second activation bar could not be put onto one that was already there, both ended up on the same spot. The check no longer reports the nested bar of a self call as „ohne eingehende Nachricht“

## 2.3.0 – 2026-11-11

Editing like in a drawing tool: selection rectangle, visible brackets, text fields that grow, multiplicities right at the line, converting elements, and a new, quieter look.

### Added

- **Selection rectangle:** dragging on the empty canvas selects several elements; Shift+click adds or removes one, Ctrl+A selects everything. A selected group is moved, nudged, copied (with the lines between the copies), duplicated and deleted together, in one undo step. The canvas is moved with Space + drag, the middle or right mouse button, or one finger on a touch screen
- **Convert an element:** the bar next to a selected element turns it into another form of its kind: class, abstract class, interface, enumeration; action, send signal, accept signal, object node; initial, final and flow final node; fork bar horizontal or vertical; state and composite state; shallow and deep history; lifeline and actor lifeline; the operator of a combined fragment (alt, opt, loop …); ER entity, relationship and attribute kinds; rectangle, ellipse, diamond
- **Multiplicities at the line:** a selected association, aggregation or composition shows a field for each end right at the line (with suggestions 1, 0..1, *, 0..*, 1..*); a double click close to a line end edits that multiplicity in place
- **Bar at every line:** edit the label, reverse the direction, delete
- **Transitions:** the panel has one field each for event, guard and effect and builds `event [guard] / effect` from them
- **Abstract and static members:** a class row marked `{abstract}` is set in italics, `{static}` is underlined
- **Short explanation** of shallow and deep history in the panel

### Changed

- **New look:** system font, filled controls, translucent bars floating over the canvas, a dot grid, softer corners and shadows, one accent color; all four themes (light, dark, high contrast, green) follow
- **Brackets are visible while typing:** guards of decisions, combined fragments and operands show `[ ]` around the text field, state invariants `{ }`; the panel shows the same
- **Text fields grow** with their text, wider for a long line and taller for more lines, and open where the label is drawn
- **The symbol lands on the element clicked second:** for an aggregation or composition the diamond now sits at the second class, like every arrowhead
- **Containers** (system boundary, partition, composite state, combined fragment, package, deployment node) are selected at their border or title; their inside stays free for the elements in it and for the selection rectangle. A combined fragment moves alone with its separator lines, activation bars stay on their lifelines
- **Sequence diagram:** the head of a lifeline moves up and down (its end and the messages stay); activation bars, destruction X and state invariants stay on a dashed line and snap to the nearest lifeline; an activation bar only changes its length; a separator line spans its fragment and goes with it; messages belong to the lifeline, wherever the arrow was started
- **State machine:** several transitions between any two elements, self transition on a composite state, appending from a start state, choice, history or composite state creates states
- **Edge labels** are drawn in front of the nodes and, when no free spot exists, take the least covered one; „Sauber anordnen“ leaves room for the labels of transitions
- A second press that turns into a drag moves the element instead of opening its text

### Fixed

- A guard typed in the panel lost its spaces and brackets while typing
- A transition leaving a choice put `/ effect` inside the guard brackets; opening and closing its text field damaged the label
- Transitions between two states close together ran through their own states or looked like self transitions
- A typed fragment condition could land in a message passing under the fragment header; a message close to a separator line could not be selected any more
- Multiplicities stayed on a line after its kind was changed to one without multiplicities
- With the arrow tool, a message ending on a lifeline hid the lifeline from the next click
- The head of a lifeline could be dragged down past its messages and activation bars, which changed the order of the messages; it now stops above the first one and stays on the grid
- A «create» message and the head of a created lifeline could not be moved down
- The menus „Darstellung“ and „Download“ pushed the toolbar out of view on wide screens and were cut off in landscape on phones; they now open below their button and scroll when the window is too low
- A flow running back up could pass through an action in between; it now runs around everything that lies between its two ends
- A label that found no free spot could be struck through by another line or lie on its own line; lines along the text now count more than lines crossing it
- The page had a margin of 8 px and was 8 px too high; on iPhone and iPad tapping a text field no longer zooms the page

## 2.2.0 – 2026-10-17

Subnet trainer with many new task types, cleaner arrows in every diagram kind, self transitions and reflexive relations, PDF export and the „Darstellung“ menu.

### Added

- **Self transitions and reflexive relations:** a state, class, object or table can be connected to itself: start the arrow (handle, node bar or arrow tool) and click the same element again, or drag a handle back onto it. The line is a loop around a free corner; several loops take different corners
- **Several transitions between two states:** a second arrow between the same states is allowed (different event or guard) and runs beside the first one; the check warns when two transitions leaving a state carry the same event and guard
- **Recursive ER relationship:** a second line between the same entity and relationship can be drawn in any direction
- **Table model, more ways to write keys:** besides `PK kundenNr INT` the columns may say `kundenNr INT (PK)`, `kundenNr INT PK`, `PRIMARY KEY`, `REFERENCES Kunde` or `↑kundenNr`; a foreign key named like table plus key (`kunde_id` => `Kunde` with `PK id`) is found as well
- **Self-referencing table:** a table with a line to itself (e.g. the superior of an employee) needs a foreign key, which may have its own name
- **Subnet trainer, many more task types:** which subnet a host belongs to, same subnet or not, smallest mask for n hosts or n subnets, mask from network and broadcast, wildcard mask both ways, route summarization and what a route contains, find the mistake in a device table or address plan, VLSM from a short scenario text (company, school, branches, with reserve and WAN links; every valid non-overlapping plan counts), IPv6 prefix and subnet ID, n-th /64, address type and EUI-64. Several phrasings per type
- **Subnet trainer, difficulty and mixing:** Leicht / Mittel / Schwer change the numbers (4th octet only up to class A/B and IPv6 traps); "Gemischt" never repeats the same type twice in a row
- **Subnet trainer, worked solution:** "Lösung zeigen" also shows the working: binary view with network and host bits, interesting octet and block size, formulas per type
- **Subnet trainer, smarter checking:** answers with spaces, leading zeros, /24 or 255.255.255.0, upper case IPv6 or another valid shortening are accepted; wrong input gets a tip that names the actual mistake (comma instead of dot, broadcast instead of network, wildcard instead of mask, counted network and broadcast as hosts …)
- **Arrows without switching tools:** a selected node shows four handles on its edge; drag one to the target node (or release and click the target). A small bar next to the node offers arrow, edit text, append next action (activity diagram) and delete. Key `A` with a selected node starts the arrow right from it; `C` is a second key for the arrow tool. After such an arrow the tool is back on "Select" and the target is selected
- **Cardinality on the line:** a selected ER line shows 1:1, 1:n, n:1 and n:m and sets both lines of the relationship at once; a table relation shows 1:n, n:1, 1:1. ⇄ swaps 1 and n on every line that has them (ER, table model, class diagram)
- **Save as PDF:** the image dialog saves the drawing as an A4 page with title and date. A status line says what is happening while saving
- **Gantt chart as image:** "As image" in the Gantt dialog saves the chart with its legend as PNG or PDF
- **One download button:** "Download" in the top bar asks for the format: plan as file (.json), image (.png) or PDF, plus "Copy image". "Upload" opens a plan file (.json); the file picker only offers .json, and an image or PDF gets an honest note that it cannot be opened again
- **Works as a normal website:** without the artifact runtime the browser downloads the file directly instead of showing text to copy. Inside the artifact downloads still go through the `downloads` capability
- **„Darstellung“ menu:** language, theme, contrast and accent color in one place at the right end of the top bar (replaces the separate DE/EN and theme buttons). **High contrast** makes text, borders, lines and focus rings stronger, in light and dark. The **accent color** green is the look of Moritz Grimm's knowledge base (green in light, lime in dark). Everything is remembered; exported images and PDFs keep the normal light palette
- **Knowledge base links:** the short help on the right links the matching article in Moritz Grimm's knowledge base (knowledge.moritz-grimm.dev) for every diagram kind except free drawing, in the language of the UI
- **Faster building:** drop a handle on empty space or click + in the node bar to create the matching next element in every diagram kind (entity => relationship, class => class, action => action, state => state, lifeline => lifeline with a message below the last one, package => package …), connected and ready for typing. In the ER model the node bar adds an attribute; the first one of an entity is the key

### Changed

- Arrows in activity and state machine diagrams never lie on top of each other or run through other shapes: there and back run as two parallel lines, slightly offset shapes get a straight line instead of a small kink, loops back up take the free side, and every other case takes the shortest free way over the side points of the shapes
- Two relations between the same classes, tables or use cases run as parallel straight lines when the shapes face each other, so arrowheads and diamonds keep their full size
- The arrow handles of a selected node are hollow, so an arrowhead under a handle stays visible
- The diagram kind menu and "New" show an action for the activity diagram and a state with activities for the state machine diagram (both showed the start node)
- "Tidy up" for the ER model: entities on a grid so related ones are neighbours, relationships between them, attributes around their entity where no line runs
- "Tidy up" for use case diagrams: columns from base to included or extending use case, ordered so lines stay short
- Lines that run through other shapes take a detour; several relations between the same elements fan out. "Tidy up" stores clean detours for the remaining cases
- Labels, cardinalities and multiplicities move to a free spot instead of covering lines or shapes
- Exported images are sharper (up to triple resolution)
- The separate "Image" button is gone; image, PDF and plan file are in the download menu. "Save" and "Open" (My plans in this browser) have their own disk and folder icons
- ER model: the cardinality sits next to the entity it belongs to (`Kunde 1 ◇ n Bestellung`), as in IHK solutions and Chen notation, instead of next to the diamond
- Importing a plan file checks every node and line: broken ones (unknown type, missing position, line to a missing node, duplicate id) are skipped and counted in the message instead of breaking the drawing; JSON that is no plan gets its own message

### Fixed

- Activity diagram: parallel arrows between the same rows no longer lie on top of each other; loops back up keep a distance
- Activity diagram: arrows into or out of a decision no longer run through the diamond when the other node lies above or below it
- "Reverse" swaps the multiplicities with the nodes, so they stay at the same table or class
- Long texts in shapes (action, use case, entity, relationship, attribute, rectangle, ellipse, diamond) wrap instead of running out of the shape
- Image export and "Show everything" include arrows, labels and multiplicities, so loops and labels at the edge are no longer cut off
- The arrow being drawn starts at the node edge instead of its center
- Key attributes, primary keys and object names are underlined in Safari too (drawn as a line), text wrapping measures the real font
- Attribute lines in the ER model no longer offer a cardinality
- ER example: "Bestellung n ◇ enthält ◇ m Artikel" instead of m and n swapped, so it matches the n:m button of the line bar

## 2.1.0 – 2026-10-04

First published version of the React rewrite (artifact version 12), together with the database kinds.

### Added

- **ER model** in Chen notation: entities, relationships (diamonds), attributes and key attributes, lines with cardinalities (1, n, m). New lines get 1 and n automatically. "Check" finds typical exam mistakes, e.g. entities connected without a relationship, missing cardinalities or a missing key attribute
- **Table model**: tables with one column per line (`PK customerNo INT`, `FK zip CHAR(5)`), relationships with 1 and n at the ends, data tables for sample data. "Check" finds a missing primary key, m:n without a junction table and foreign keys on the wrong side
- **Normalization exercise** (table model, "Exercise: 3rd normal form"): three scenarios with an unnormalized source table. "Check" uses the functional dependencies to name violations of 1NF, 2NF and 3NF per table; a model solution can be shown
- Examples for both kinds, "Tidy up" arranges them
- The right info panel can be collapsed with the arrow button in its top corner; the browser remembers the choice. "Check" expands it again to show the result

### Changed

- "Calculate" is only in the top bar, no longer also in the left sidebar

## 2.0.0 – 2026-10-03

Rewritten as a React app and renamed from "AP2 Draw" to **AP2 Practice Lab**. Saved plans, achievements and "My plans" from version 1 are kept.

### Added

- **Subnetting** workspace: IPv4 calculator with binary view, class and address range, splitting into equal subnets, VLSM by host demand, shortening and expanding IPv6, exercises of 10 kinds with a check per field and series
- 3 new achievements: "Networker", "Mask bearer", "Subnet pro" (now 27)
- UI in **German and English**, switchable with `DE`/`EN`
- **Theme switch**: like the system, light or dark
- Guide with a new chapter "Subnetting" (now 9 chapters)
- Language, theme and workspace are remembered in the browser

### Changed

- Tech: React 19, TypeScript, zustand and immer, built with Vite into a single HTML file
- Code, comments and developer docs in English
- Export files carry `"app": "AP2 Practice Lab"`; files from version 1 can still be opened
- Unit tests with Vitest for the subnetting logic, browser tests run against the Vite build

## 1.0.0 – 2026-10-03

First version as a repository ("AP2 Draw", vanilla JavaScript). Contains everything from artifact versions 1 to 11:

- Network diagram with nodes in the standard exam layout, calculation, field-by-field check, counting mode "start at 0" and "start at 1", critical path
- Gantt chart, activity list with Excel import, random exercises "Calculate" and "Draw and calculate"
- UML: activity, use case, class, sequence, state, object, component, deployment and package diagrams with check rules and examples
- Activity diagram with "Append next" and automatic `[ ]` around guards
- Left sidebar with diagram kind, matching elements and relations per kind
- "Tidy up" for all diagram kinds
- "My plans" in the browser, export and import as a file, PNG export
- 24 achievements, 9 levels, Rainer gallery with 9 pictures
- Guide with 8 chapters, light and dark theme, phone view

### Fixed During the Move to the Repository

- "Night shift" now also counts for correct UML diagrams, not only for network diagrams
- Removed leftovers of the old UML palette
