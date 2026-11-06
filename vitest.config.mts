import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
  test: {
    environment: "node",
    testTimeout: 20_000,
    // One file at a time: the RLS and database suites share one local stack.
    fileParallelism: false,
    // e2e/ holds Playwright specs; .worktrees/ holds other checkouts with their own runs.
    exclude: [...configDefaults.exclude, "**/.worktrees/**", "e2e/**"],
  },
});
