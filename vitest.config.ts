import { defineConfig } from "vitest/config";
import path from "path";

// Vitest doesn't read tsconfig's `paths` on its own — every test file
// under src/app/**/*.test.ts that imports through the "@/..." alias
// (the same alias Next.js resolves for the actual app) needs this to
// even collect, let alone run. SEC-001: added when the first
// actions.test.ts file surfaced the gap.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    setupFiles: ["./vitest.setup.ts"],
  },
});
