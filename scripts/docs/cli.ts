/**
 * pnpm docs:check [--only <file>…]  report every rule docs/README.md states; exit 1 on a problem
 * pnpm docs:gen                     rewrite docs/reference/generated/ and the docs/README.md index
 * pnpm docs:owed [base]             list documents whose covered code changed while they did not
 */
import path from "node:path";
import { checkDocs, formatProblems, owedForRoot, repoRoot, writeGenerated } from "./model";

const root = repoRoot();
const [command, ...args] = process.argv.slice(2);

if (command === "check") {
  const onlyAt = args.indexOf("--only");
  const only = onlyAt === -1 ? null : new Set(args.slice(onlyAt + 1).map((f) => path.relative(root, path.resolve(f))));
  const problems = checkDocs(root).filter((p) => !only || only.has(p.file));
  if (problems.length) {
    console.log(formatProblems(problems));
    console.log(`\n${problems.length} problem(s).`);
    process.exit(1);
  }
  console.log("docs: no problems.");
} else if (command === "gen") {
  const changed = writeGenerated(root);
  console.log(changed.length ? `docs: wrote ${changed.join(", ")}` : "docs: generated files are current.");
} else if (command === "owed") {
  const owed = owedForRoot(root, args[0] ?? "origin/main");
  if (!owed.length) console.log("docs: no document is owed.");
  for (const o of owed) console.log(`${o.doc}\n${o.files.map((f) => `  ${f}`).join("\n")}`);
} else {
  console.log("usage: tsx scripts/docs/cli.ts check [--only <file>…] | gen | owed [base]");
  process.exit(2);
}
