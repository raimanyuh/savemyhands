import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Keep Vite's atomic transform cache inside the repository. Windows app
// sandboxes can reject rename operations in their virtualized OS temp folder.
const testTempDir = resolve(".tmp/vitest");
mkdirSync(testTempDir, { recursive: true });

export default defineConfig({
  cacheDir: ".vitest-cache",
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["**/*.test.ts"],
  },
});
