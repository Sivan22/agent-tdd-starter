/**
 * `checkDocs` against a small throwaway repository with one planted defect per rule, so a check
 * that stops running cannot stay green.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkDocs, writeGenerated, type Problem } from "@/scripts/docs/model";

let root = "";
let problems: Problem[] = [];

const write = (rel: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};
const rulesFor = (file: string) =>
  problems
    .filter((p) => p.file === file)
    .map((p) => p.rule)
    .sort();

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "docs-check-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  write(".gitignore", "lib/secret/\n");
  write("vercel.json", '{"crons":[]}\n');
  write("package.json", '{"scripts":{}}\n');
  write("lib/a.ts", "export const a = 1;\n");
  write("lib/orphan.ts", "export const b = 2;\n");
  write("lib/cite.ts", '// see "../docs/gone.md"\nexport const c = 3;\n');
  write("docs/README.md", "# Documentation\n\n<!-- docs-index:start -->\n<!-- docs-index:end -->\n");
  write(
    "docs/system/a.md",
    [
      "---",
      "summary: A planted document.",
      "covers:",
      "  - lib/a.ts",
      "  - lib/cite.ts",
      "  - lib/nowhere/**",
      "---",
      "# A",
      "",
      "~~~",
      "```",
      "~~~",
      "Refunds (APP-123) are offsets.",
      "A [titled link](missing.md \"title\") and a [reference][r].",
      "A [line](../../lib/a.ts#L3) and a path `lib/nothere.ts`.",
      "An ignored file `lib/secret/keys.txt` and an ignored folder `lib/secret/`.",
      "",
      "[r]: missing-ref.md",
      "",
    ].join("\n"),
  );
  write("docs/system/b.md", "---\nsummary: Unclosed fence.\n---\n# B\n\n```\ncode\n\nThen APP-456 after it.\n");
  write("docs/decisions/c.md", "---\nsummary: A decision that claims code.\ncovers:\n  - lib/a.ts\n---\n# C\n");
  writeGenerated(root);
  problems = checkDocs(root);
});

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe("checkDocs on a planted tree", () => {
  it("reports every planted defect in a current document", () => {
    expect(rulesFor("docs/system/a.md")).toEqual(
      ["broken link", "broken link", "dead covers glob", "line-number citation", "missing path", "missing path", "ticket id"].sort(),
    );
  });

  it("reports an unclosed fence and still checks the text after it", () => {
    expect(rulesFor("docs/system/b.md")).toEqual(["ticket id", "unclosed code fence"]);
  });

  it("refuses covers outside system documents and runbooks", () => {
    expect(rulesFor("docs/decisions/c.md")).toEqual(["frontmatter"]);
  });

  it("reports unclaimed code and a citation of a missing document", () => {
    expect(rulesFor("lib/orphan.ts")).toEqual(["unclaimed code"]);
    expect(rulesFor("lib/cite.ts")).toEqual(["cites a missing document"]);
  });

  it("reports a generated inventory that no longer matches the code", () => {
    write("package.json", '{"scripts":{"hello":"echo hi"}}\n');
    expect(checkDocs(root).filter((p) => p.rule === "stale generated file").map((p) => p.file)).toEqual([
      "docs/reference/generated/scripts.md",
    ]);
  });
});
