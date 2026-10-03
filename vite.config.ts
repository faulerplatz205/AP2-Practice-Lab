/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";

// Everything is inlined into dist/index.html: a Claude artifact is a single file
// without external scripts or images. scripts/artifact.mjs turns it into the artifact.
export default defineConfig({
    plugins: [ react(), viteSingleFile() ],
    resolve: {
        alias: {
            "@site": fileURLToPath(new URL(".", import.meta.url)),
        },
    },
    build: {
        assetsInlineLimit: 100_000_000,
        cssCodeSplit: false,
        target: "es2022",
    },
    test: {
        include: [ "src/**/*.test.ts" ],
    },
});
