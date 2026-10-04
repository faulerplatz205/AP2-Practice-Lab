# Changelog

Newest entries at the top. The versions match the releases of the Claude Artifact.

## Unreleased

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
