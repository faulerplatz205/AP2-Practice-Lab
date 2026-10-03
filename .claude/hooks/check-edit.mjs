#!/usr/bin/env node
// PostToolUse hook for Edit|Write. Reads the hook input from stdin and checks the changed file:
// .ts/.tsx => typecheck of the project + ESLint on the file, .md => markdownlint --fix on the file.
// Exit code 2 hands the errors back to Claude; everything else passes silently.

import { execFileSync } from "node:child_process";
import { relative } from "node:path";

let input = "";
for await (const chunk of process.stdin) input += chunk;

let file = "";
try {
    file = JSON.parse(input).tool_input?.file_path ?? "";
} catch {
    process.exit(0);
}

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const rel = relative(root, file);
if (!file || rel.startsWith("..") || /(^|[\\/])(node_modules|dist|tests[\\/]output)[\\/]/.test(rel)) process.exit(0);

const run = (args) => {
    try {
        execFileSync("npx", args, { cwd: root, stdio: "pipe", encoding: "utf8", shell: process.platform === "win32" });
        return "";
    } catch (e) {
        return `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e);
    }
};

const problems = [];
if (/\.(ts|tsx)$/.test(rel)) {
    const tsc = run([ "tsc", "--noEmit" ]);
    if (tsc) problems.push(`npm run typecheck:\n${tsc}`);
    const lint = run([ "eslint", rel ]);
    if (lint) problems.push(`eslint ${rel}:\n${lint}`);
} else if (/\.md$/.test(rel)) {
    const md = run([ "markdownlint-cli2", "--fix", rel ]);
    if (md) problems.push(`markdownlint ${rel}:\n${md}`);
}

if (problems.length) {
    process.stderr.write(problems.join("\n\n") + "\n");
    process.exit(2);
}
