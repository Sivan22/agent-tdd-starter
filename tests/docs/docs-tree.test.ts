/**
 * The documentation tree obeys its own rules (docs/README.md): every current document carries
 * frontmatter, links and cited paths resolve, current-state documents carry no ticket ids or
 * dated marks, every part of the code is claimed by a document, and the generated inventories
 * match the code.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkDocs, formatProblems } from "@/scripts/docs/model";

const ROOT = path.resolve(import.meta.dirname, "../..");

describe("docs tree", () => {
  it("has no problems", () => {
    const problems = checkDocs(ROOT);
    expect(problems, formatProblems(problems)).toEqual([]);
  });
});
