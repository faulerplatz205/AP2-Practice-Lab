import eslintConfig from "@moritz-grimm/eslint-config";
import reactHooks from "eslint-plugin-react-hooks";
import { globalIgnores } from "eslint/config";

export default [
    ...eslintConfig,
    {
        files: [ "**/*.{ts,tsx}" ],
        plugins: { "react-hooks": reactHooks },
        rules: {
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
        },
    },
    globalIgnores([ "dist/", "tests/output/" ]),
];
