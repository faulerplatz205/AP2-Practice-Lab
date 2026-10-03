#!/usr/bin/env node
// Builds the Claude artifact fragment from dist/index.html: dist/ap2-practice-lab.html
// Publishing wraps the page in its own document skeleton, so this file only
// holds <title>, stylesheets, styles, the body content and the script.

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const full = readFileSync(join(dist, "index.html"), "utf8");

// Take the script out first: the bundle itself contains strings like "<style"
const scripts = [ ...full.matchAll(/<script type="module"[^>]*>[\s\S]*?<\/script>/g) ].map(m => m[0]);
if (!scripts.length) throw new Error("<script> missing in dist/index.html");
const html = scripts.reduce((rest, s) => rest.replace(s, ""), full);

const pick = (re, label) => {
    const all = [ ...html.matchAll(re) ].map(m => m[0]);
    if (!all.length) throw new Error(`${label} missing in dist/index.html`);
    return all;
};

const title = pick(/<title>[\s\S]*?<\/title>/g, "<title>");
const links = pick(/<link rel="(?:preconnect|stylesheet)"[^>]*>/g, "Google-Fonts-Link");
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g, "<style>");
const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1]?.replace(/<script[\s\S]*?<\/script>/g, "").trim();
if (!body) throw new Error("<body> missing in dist/index.html");

// Title first (only the first 8 KB are scanned for it), script last
const out = [ ...title, ...links, ...styles, body, ...scripts ].join("\n") + "\n";
writeFileSync(join(dist, "ap2-practice-lab.html"), out);
const size = statSync(join(dist, "ap2-practice-lab.html")).size;
if (size > 16 * 1024 * 1024) throw new Error("Artifact is larger than 16 MB");
console.log(`dist/ap2-practice-lab.html for the artifact written (${Math.round(size / 1024)} KB)`);
