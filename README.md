# AP2 Practice Lab

**English** | [Deutsch](README.de.md)

Practice app for the AP2, the second part of the final exam for IT specialists in application development in Germany. Network diagrams and UML diagrams are drawn, checked automatically and tidied up. There is also a subnetting workspace with a calculator and exercises, achievements with a level system and a hidden Rainer gallery.

The app is a single HTML file without a server. It runs as a Claude Artifact or directly in the browser.

**Online:** <https://claude.ai/artifact/8gN6BVXa34YUPqtZECEp9f>

## Features

- **Network diagram:** activity nodes in the standard exam layout (ES, EF, LS, LF, TF, FF), calculation, critical path, counting mode "start at 0" or "start at 1", Gantt chart, activity list (can also be pasted from Excel), random exercises "Calculate" and "Draw and calculate"
- **UML:** activity, use case, class, sequence, state, object, component, deployment and package diagrams, each with matching elements, relations and partly with an example. Plus free drawing with generic shapes
- **Databases:** ER model in Chen notation (entities, relationships, attributes, cardinalities) and table model with primary and foreign keys. A normalization exercise turns an unnormalized table into third normal form; "Check" names the violated normal form and why
- **Check:** calculation errors in a network diagram are marked field by field, with formula and correct value. For UML it finds typical exam mistakes, e.g. a missing final node, a decision without a guard or a use case without an actor. All rules: [docs/check-rules.md](docs/check-rules.md)
- **Tidy up:** arranges every diagram kind automatically
- **Subnetting:** IPv4 calculator with binary view, splitting a network into equal subnets, VLSM by host demand, shortening and expanding IPv6 addresses, exercises with a check per field
- **Achievements:** 27 achievements, 9 levels and a Rainer gallery with 9 unlockable pictures. Tip: type "rainer" anywhere
- **My plans:** save plans under a name in the browser, open, rename, delete
- **Export and import:** save a plan as a `.json` file and open it again (also by drag and drop), image as PNG
- **German and English:** switch with `DE`/`EN` at the top right
- **Light and dark:** theme like the system, always light or always dark

The browser remembers language, theme and workspace.

## Usage

### Online

Open the link above. That's all. On the first start a guide explains everything important; it can be opened again at any time via "Guide".

### Local

Requirement: Node.js 20 or newer.

```bash
npm install     # once
npm start       # dev server on http://localhost:5173
npm run build   # builds dist/index.html and dist/ap2-practice-lab.html
```

`dist/index.html` can then be opened directly in the browser.

## Development

```bash
npm run typecheck   # check TypeScript
npm run lint        # ESLint
npm run test:unit   # unit tests (Vitest)
npm run test:e2e    # browser tests (Playwright for Python, run npm run build first)
npm test            # everything together
```

Once for the browser tests:

```bash
pip install playwright
python -m playwright install chromium
```

Structure, rules and commands are in [CLAUDE.md](CLAUDE.md), details in [docs/](docs/README.md). So a short instruction is enough for Claude Code, e.g.:

- "Add a check rule for empty partitions to the activity diagram."
- "Add a communication diagram as a new diagram kind."
- "Make a subnetting exercise about supernetting."

The folder [.claude/skills](.claude/skills) holds ready-made workflows: `new-element` for new shapes or diagram kinds and `publish` for testing and publishing. How to contribute is described in [CONTRIBUTING.md](CONTRIBUTING.md).

## Structure

```text
src/
  components/   React components (canvas, bars, dialogs, subnetting)
  state/        zustand stores and actions
  lib/          logic without React (check, calculate, layout, subnetting)
  i18n/         all texts in German and English
  data/         diagram kinds, examples, guide, Rainer gallery
static/img/     pictures for the gallery
scripts/        artifact build
tests/e2e/      browser tests per area
docs/           developer knowledge base
```

## Privacy

Everything stays in the browser. Plans, achievements and settings are stored in the `localStorage` of the browser. There is no server and no tracking. Only the fonts are loaded from Google Fonts.
