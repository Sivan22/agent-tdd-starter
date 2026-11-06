/**
 * One-click deployment: the Vercel build applies migrations only after the app has built, and
 * the README's Deploy button provisions Supabase through the Vercel Marketplace.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

describe("vercel.json", () => {
  it("builds the app, then applies migrations", () => {
    const config = JSON.parse(read("vercel.json")) as { buildCommand?: string };
    expect(config.buildCommand).toBe("pnpm build && bash scripts/migrate-production.sh");
  });
});

describe("the README's Deploy button", () => {
  const link = /\(https:\/\/vercel\.com\/new\/clone\?([^)\s]+)\)/.exec(read("README.md"));
  const params = new URLSearchParams(link?.[1] ?? "");

  it("clones a GitHub repository", () => {
    expect(params.get("repository-url")).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
  });

  it("provisions Supabase through the Vercel Marketplace", () => {
    expect(JSON.parse(params.get("stores") ?? "null")).toEqual([
      { type: "integration", integrationSlug: "supabase", productSlug: "supabase" },
    ]);
  });
});
