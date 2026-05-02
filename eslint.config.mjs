import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Design handoff packages are reference material, not production code.
    // The JSX/CSS files in here are intentionally non-idiomatic — they
    // were authored against a Babel-in-browser setup with no build step.
    "design_handoff_*/**",
  ]),
]);

export default eslintConfig;
