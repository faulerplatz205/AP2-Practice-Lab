# Publishing

## Build

```bash
npm run build
```

1. `vite build` bundles everything (scripts, styles, images as `data:` URIs) into `dist/index.html` with `vite-plugin-singlefile`. Google Fonts stay an external stylesheet, which the artifact allows
2. `scripts/artifact.mjs` turns it into `dist/ap2-practice-lab.html`: `<title>` first (only the first 8 KB are scanned for it), then the font links, the styles, the body and the module script last. There is no `<!doctype>`, `<html>` or `<head>`, because publishing wraps the page in its own document skeleton. The script fails when the file is larger than 16 MB

`dist/index.html` is the complete page for local use and the e2e tests; `dist/ap2-practice-lab.html` is what gets published. `dist/` is gitignored.

## Steps

1. `npm run typecheck`, `npm run lint`, `npm run test:unit`
2. `npm run build`, then `npm run test:e2e`; all suites green
3. Look at the screenshots in `tests/output/` for the changed areas
4. Publish as Claude Artifact (below)
5. Add an entry to `CHANGELOG.md`, commit

The skill `/publish` runs these steps.

## As Claude Artifact

With Claude Code in the repository:

> Publish `dist/ap2-practice-lab.html` as an update of the existing artifact <https://claude.ai/artifact/8gN6BVXa34YUPqtZECEp9f>.

- **Always update the existing artifact:** a new artifact has a different address and its own browser storage, so users would not find their plans and achievements there
- **Capability `downloads`:** must stay declared, otherwise saving files does not work. An update without `capabilities` keeps it; passing `{}` would remove it
- **Open views:** load the new version on their next reload

## Without Claude

`dist/index.html` also works when opened directly in a browser or from any web space. Only saving through the download dialog is missing there; the app shows the text for copying instead. „Meine Pläne“ and everything else work everywhere.

## Size

The artifact may be at most 16 MB; currently it is about 0.8 MB. Most of it is React and the embedded pictures. New pictures are resized to at most 560 px edge before adding them.
