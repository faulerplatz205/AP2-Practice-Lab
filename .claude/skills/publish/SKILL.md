---
name: publish
description: Test, build and publish AP2 Practice Lab as an update of the existing Claude artifact
argument-hint: "[link to the existing artifact, default https://claude.ai/artifact/8gN6BVXa34YUPqtZECEp9f]"
---

# Publish

## 1. Check

1. Run `npm run typecheck`, `npm run lint` and `npm run test:unit`
2. Run `npm run build`. It writes `dist/index.html` and the artifact file `dist/ap2-practice-lab.html` and fails above 16 MB
3. Run `npm run test:e2e` (in the Claude cloud container with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). On any failure stop, report the failing checks and do not publish
4. Look at the screenshots in `tests/output/` that belong to the changed areas

## 2. Publish

1. Publish `dist/ap2-practice-lab.html` as an **update** of the existing artifact: the Artifact tool with `file_path` = `dist/ap2-practice-lab.html` and `url` = the link in $ARGUMENTS, or <https://claude.ai/artifact/8gN6BVXa34YUPqtZECEp9f> when none is given. Read the artifact first if this conversation has not read or published it yet
2. Never create a new artifact: it would have a different address and its own browser storage, so users would not find their plans and achievements there
3. The capability `downloads` stays declared. An update without `capabilities` keeps it; never pass `{}`

## 3. Finish

- Write one sentence about the new version: what changed for users
- Add an entry to `CHANGELOG.md` and raise `version` in `package.json` when it is a release
- Commit the changes (format: **Commit Messages** in `CLAUDE.md`). `dist/` is not committed
