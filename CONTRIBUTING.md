# Contributing

## Workflow

1. Clone the repository, `npm install`, once for the browser tests `pip install playwright` and `python -m playwright install chromium`
2. `npm start` and make the change in `src/`. Texts only in `src/i18n/`, always in German and English
3. Run `npm test` (typecheck, unit tests, build, browser tests) and `npm run lint`
4. Look at the screenshots in `tests/output/`, for UI changes in the light and dark theme
5. Update the docs in `docs/` when behaviour changes
6. Commit message in the format from `CLAUDE.md`, section **Commit Messages**

`dist/` is not committed, `npm run build` creates it.

## With Claude Code

`CLAUDE.md` contains everything Claude needs to know about the project. A short instruction is enough. There are skills for recurring tasks:

- `/new-element communication diagram`
- `/publish`

After every edit a hook (`.claude/settings.json`) checks the changed file: TypeScript and ESLint for `.ts`/`.tsx`, markdownlint for `.md`.

## Welcome Contributions

- New check rules for typical exam mistakes, with a source or example from past AP2 exams
- More exercise kinds, e.g. for activity or class diagrams or new subnetting exercises
- Bug reports with steps to reproduce and a screenshot

## What Does Not Belong Here

- Changes to stored keys, field names or ids (see **Persistence** in `CLAUDE.md`). Otherwise users lose their plans and achievements
- External scripts or server dependencies. The app stays a single file
- Pictures that mock a person for their appearance or body
