/**
 * The documentation checker and generator behind `pnpm docs:check`, `pnpm docs:gen` and
 * `pnpm docs:owed`. The rules it enforces are written for readers in docs/README.md;
 * tests/docs/ pins them.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type Problem = { file: string; rule: string; detail: string };

type Kind = "system" | "runbook" | "decision" | "reference" | "generated" | "history" | "db" | "template" | "index" | "agent";

type Doc = { path: string; kind: Kind; text: string };

/** Documents that describe the present and must carry frontmatter. */
const CURRENT: ReadonlySet<Kind> = new Set(["system", "runbook", "decision", "reference", "generated"]);
/** Documents that may not carry ticket ids, dated marks or line numbers. */
const STRICT: ReadonlySet<Kind> = new Set(["system", "runbook", "reference"]);
/** Documents whose `covers` lists claim code. */
const CLAIMING: ReadonlySet<Kind> = new Set(["system", "runbook"]);

export const GENERATED_DIR = "docs/reference/generated";
export const INDEX_FILE = "docs/README.md";
const INDEX_START = "<!-- docs-index:start -->";
const INDEX_END = "<!-- docs-index:end -->";

/**
 * The issue tracker's team keys. An id such as `APP-123` belongs in a commit message or a
 * pull request, never in a document that describes the present. Set your tracker's keys.
 */
export const TICKET_KEYS: readonly string[] = ["APP"];

// ---------------------------------------------------------------- globs

/** `**` spans directories, `*` stays inside one segment, everything else is literal. */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; ) {
    if (glob.startsWith("**/", i)) {
      re += "(?:.*/)?";
      i += 3;
    } else if (glob.startsWith("**", i)) {
      re += ".*";
      i += 2;
    } else if (glob[i] === "*") {
      re += "[^/]*";
      i += 1;
    } else {
      re += glob[i].replace(/[.+?^${}()|[\]\\]/g, "\\$&");
      i += 1;
    }
  }
  return new RegExp(`^${re}$`);
}

function matcher(globs: readonly string[]): (file: string) => boolean {
  const res = globs.map(globToRegExp);
  return (file) => res.some((re) => re.test(file));
}

// ---------------------------------------------------------------- frontmatter

export type Frontmatter = { ok: true; summary: string | null; covers: string[]; body: string } | { ok: false; error: string };

const FRONTMATTER_KEYS = new Set(["summary", "covers"]);

const unquote = (s: string) => s.replace(/^(["'])(.*)\1$/, "$2");

export function parseFrontmatter(text: string): Frontmatter {
  if (!text.startsWith("---\n")) return { ok: false, error: "missing frontmatter" };
  const end = text.indexOf("\n---\n", 3);
  if (end === -1) return { ok: false, error: "unterminated frontmatter" };
  const body = text.slice(end + 5);
  let summary: string | null = null;
  const covers: string[] = [];
  let current: string | null = null;
  for (const line of text.slice(4, end).split("\n")) {
    if (!line.trim()) continue;
    const item = /^\s+-\s+(.+)$/.exec(line);
    if (item) {
      if (current !== "covers") return { ok: false, error: `list item outside covers: ${line.trim()}` };
      covers.push(unquote(item[1].trim()));
      continue;
    }
    const kv = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (!kv) return { ok: false, error: `unreadable frontmatter line: ${line}` };
    const [, key, value] = kv;
    if (!FRONTMATTER_KEYS.has(key)) return { ok: false, error: `unknown frontmatter key: ${key}` };
    current = key;
    if (key === "summary") summary = unquote(value.trim()) || null;
    else if (value.trim() && value.trim() !== "[]") return { ok: false, error: "covers must be a list" };
  }
  return { ok: true, summary, covers, body };
}

// ---------------------------------------------------------------- markdown

/**
 * Fenced code blocks, CommonMark-style: a fence closes only on the same character, at least as
 * long, with no info string. Returns the text with closed blocks blanked (line numbers kept) and
 * the line of an opener that never closes; that opener blanks nothing, so the text after it is
 * still checked.
 */
function fences(text: string): { stripped: string; unclosedLine: number | null } {
  const lines = text.split("\n");
  const blank = new Array<boolean>(lines.length).fill(false);
  let open: { at: number; char: string; len: number } | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(lines[i]);
    if (!open) {
      if (m && !(m[1][0] === "`" && m[2].includes("`"))) open = { at: i, char: m[1][0], len: m[1].length };
      continue;
    }
    if (m && m[1][0] === open.char && m[1].length >= open.len && m[2].trim() === "") {
      for (let j = open.at; j <= i; j += 1) blank[j] = true;
      open = null;
    }
  }
  return {
    stripped: lines.map((line, i) => (blank[i] ? "" : line)).join("\n"),
    unclosedLine: open === null ? null : open.at + 1,
  };
}

const stripFences = (text: string) => fences(text).stripped;

/** The anchor GitHub gives a heading. */
export function slug(heading: string): string {
  return heading
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

function headings(text: string): string[] {
  return [...stripFences(text).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)].map((m) => m[1]);
}

function title(text: string, file: string): string {
  const h1 = /^#\s+(.+?)\s*$/m.exec(stripFences(text));
  return h1 ? h1[1].replace(/`/g, "") : path.basename(file, ".md");
}

const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

// ---------------------------------------------------------------- content rules

function banned(): { rule: string; re: RegExp }[] {
  const keys = TICKET_KEYS.map((k) => k.replace(/[^A-Z0-9]/g, "")).filter(Boolean);
  return [
    ...(keys.length ? [{ rule: "ticket id", re: new RegExp(`\\b(?:${keys.join("|")})-\\d+\\b`, "g") }] : []),
    { rule: "pull request or issue number", re: /\b(?:PR|[Pp]ull request|[Ii]ssue)\s*#\d+\b/g },
    // Four-digit migration versions start with 0, which keeps years and counts out of the rule.
    { rule: "migration high-water claim", re: /\b(?:through|reaches|up to)\s+(?:migration\s+)?`?0\d{3}\b/g },
    { rule: "review-date banner", re: /\b[Rr]eviewed\b[^\n]{0,40}?\d{4}-\d{2}-\d{2}/g },
    { rule: "line-number citation", re: /\.(?:tsx?|mts|mjs|js|sql|sh|md|json):\d+\b|#L\d+\b/g },
  ];
}

export function bannedPatternHits(text: string): { rule: string; match: string; line: number }[] {
  const hits: { rule: string; match: string; index: number }[] = [];
  for (const { rule, re } of banned()) {
    for (const m of text.matchAll(re)) hits.push({ rule, match: m[0], index: m.index ?? 0 });
  }
  return hits.sort((a, b) => a.index - b.index).map((h) => ({ rule: h.rule, match: h.match, line: lineOf(text, h.index) }));
}

const REPO_DIR = /^(?:app|lib|components|scripts|supabase|tests|e2e|docs|public|\.github|\.claude)\//;
const REPO_ROOT_FILE =
  /^(?:proxy\.ts|next\.config\.ts|vercel\.json|package\.json|pnpm-workspace\.yaml|tsconfig\.json|eslint\.config\.mjs|components\.json|\.env\.example|\.gitleaks\.toml|AGENTS\.md|CLAUDE\.md|README\.md|playwright\.config\.ts|vitest\.config\.m?ts)$/;

/** Repository paths written in inline code. Commands and placeholders are skipped. */
export function backtickedRepoPaths(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    const raw = m[1].trim();
    if (/[\s<>{}…]|\.\.\./.test(raw)) continue;
    const p = raw.replace(/#.*$/, "").replace(/:\d+(?:-\d+)?$/, "");
    if (REPO_DIR.test(p) || REPO_ROOT_FILE.test(p)) out.push(p);
  }
  return out;
}

/** Repository document paths cited in source text; `…/node_modules/next/dist/docs/…` is another package's. */
export function citedDocPaths(text: string): { path: string; index: number }[] {
  return [...text.matchAll(/(?:(?<=\.\.\/)|(?<![\w./-]))docs\/[A-Za-z0-9_./-]+\.(?:md|sql|txt)\b/g)].map((m) => ({
    path: m[0],
    index: m.index ?? 0,
  }));
}

/** GitHub's `#L12` / `#L12-L40` anchors point at lines, not headings. */
export function isLineAnchor(anchor: string): boolean {
  return /^L\d+(?:-L\d+)?$/.test(anchor);
}

/** The URL a Next.js page or route handler serves. */
export function routeUrl(file: string): string {
  const segments = file.replace(/^app\//, "").split("/");
  segments.pop();
  return "/" + segments.filter((s) => !/^\(.*\)$/.test(s)).join("/");
}

export function owedDocs(
  changed: readonly string[],
  docs: readonly { path: string; covers: readonly string[] }[],
): { doc: string; files: string[] }[] {
  const touched = new Set(changed);
  return docs
    .filter((d) => d.covers.length > 0 && !touched.has(d.path))
    .map((d) => ({ doc: d.path, files: changed.filter(matcher(d.covers)) }))
    .filter((d) => d.files.length > 0)
    .sort((a, b) => a.doc.localeCompare(b.doc));
}

export function bucketsFromMigration(sql: string): string[] {
  const out: string[] = [];
  for (const statement of sql.matchAll(/insert\s+into\s+storage\.buckets\b([\s\S]*?);/gi)) {
    for (const tuple of statement[1].matchAll(/(?:\bvalues\s*|\)\s*,\s*)\(\s*'([a-z0-9-]+)'/gi)) out.push(tuple[1]);
  }
  return out;
}

export function envNamesIn(source: string): string[] {
  const found: { name: string; index: number }[] = [];
  const patterns = [
    /process\.env\.([A-Z][A-Z0-9_]*)/g,
    /Deno\.env\.get\(\s*["']([A-Z][A-Z0-9_]*)["']\s*\)/g,
    // A module may read through a local `env(name)` or `requiredEnv(name)` helper.
    /\b(?:env|requiredEnv)\(\s*["']([A-Z][A-Z0-9_]*)["']/g,
  ];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) found.push({ name: m[1], index: m.index ?? 0 });
  }
  // A function that takes `env = process.env` reads `env.NAME`.
  if (/\benv\s*(?::[^=)]+)?=\s*process\.env\b/.test(source)) {
    for (const m of source.matchAll(/\benv\.([A-Z][A-Z0-9_]*)/g)) found.push({ name: m[1], index: m.index ?? 0 });
  }
  // A computed key names every literal it can resolve to: process.env[a ? "X" : "Y"].
  for (const m of source.matchAll(/process\.env\[([^\]]+)\]/g)) {
    const start = (m.index ?? 0) + "process.env[".length;
    for (const lit of m[1].matchAll(/["']([A-Z][A-Z0-9_]*)["']/g)) found.push({ name: lit[1], index: start + (lit.index ?? 0) });
  }
  for (const m of source.matchAll(/\{([^{}]+)\}\s*=\s*process\.env\b/g)) {
    for (const part of m[1].split(",")) {
      const name = part.split(":")[0].trim();
      if (/^[A-Z][A-Z0-9_]*$/.test(name)) found.push({ name, index: m.index ?? 0 });
    }
  }
  const seen = new Set<string>();
  return found
    .sort((a, b) => a.index - b.index)
    .map((f) => f.name)
    .filter((n) => !seen.has(n) && seen.add(n) !== undefined);
}

// ---------------------------------------------------------------- repository

export function repoRoot(): string {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
}

/** Tracked and new (not ignored) files that exist on disk. */
export function repoFiles(root: string): string[] {
  const out = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  return [...new Set(out.split("\0").filter(Boolean))].filter((f) => fs.existsSync(path.join(root, f))).sort();
}

/** The code every document's `covers` must claim between them. */
const SURFACE = [
  /^app\/.*\.(?:tsx?|mts|mjs|js)$/,
  /^lib\//,
  /^components\//,
  /^scripts\//,
  /^supabase\/functions\//,
  /^(?:proxy\.ts|next\.config\.ts|vercel\.json)$/,
];
const inSurface = (f: string) => SURFACE.some((re) => re.test(f));

function kindOf(file: string): Kind | null {
  if (file === INDEX_FILE) return "index";
  if (file.startsWith(".claude/agents/") || file === "AGENTS.md" || file === "README.md") return "agent";
  if (!file.startsWith("docs/")) return null;
  const rest = file.slice("docs/".length);
  if (rest.startsWith("system/")) return "system";
  if (rest.startsWith("runbooks/")) return "runbook";
  if (rest.startsWith("decisions/")) return "decision";
  if (rest.startsWith("reference/generated/")) return "generated";
  if (rest.startsWith("reference/")) return "reference";
  if (rest.startsWith("db/")) return "db";
  if (rest.startsWith("_templates/")) return "template";
  return "history";
}

function loadDocs(root: string, files: readonly string[]): Doc[] {
  return files
    .filter((f) => f.endsWith(".md"))
    .flatMap((f) => {
      const kind = kindOf(f);
      return kind ? [{ path: f, kind, text: fs.readFileSync(path.join(root, f), "utf8") }] : [];
    });
}

function coverDocs(docs: readonly Doc[]): { path: string; covers: string[] }[] {
  return docs
    .filter((d) => CLAIMING.has(d.kind))
    .map((d) => {
      const fm = parseFrontmatter(d.text);
      return { path: d.path, covers: fm.ok ? fm.covers : [] };
    });
}

// ---------------------------------------------------------------- generator

const esc = (s: string) => s.replace(/\|/g, "\\|");
const rel = (fromFile: string, to: string) => path.posix.relative(path.posix.dirname(fromFile), to);
const header = (summary: string) => `---\nsummary: ${summary}\n---\n`;
const banner = (source: string) =>
  `Generated by \`pnpm docs:gen\` from ${source}. Do not edit by hand; \`pnpm docs:check\` fails when it is stale.\n`;
const table = (head: string, lines: string[], empty: string) => (lines.length ? `\n${head}\n${lines.join("\n")}\n` : `\n${empty}\n`);

function routesDoc(files: readonly string[], claims: { path: string; covers: string[] }[]): string {
  const out = `${GENERATED_DIR}/routes.md`;
  const matchers = claims.filter((c) => c.path.startsWith("docs/system/")).map((c) => ({ path: c.path, test: matcher(c.covers) }));
  const rows = files
    .filter((f) => /^app\/(?:.*\/)?(?:page\.tsx|route\.tsx?)$/.test(f))
    .map((f) => ({ url: routeUrl(f), kind: f.endsWith("page.tsx") ? "page" : "handler", file: f }))
    .sort((a, b) => a.url.localeCompare(b.url) || a.kind.localeCompare(b.kind));
  const lines = rows.map((r) => {
    const docs = matchers.filter((m) => m.test(r.file)).map((m) => `[${path.posix.basename(m.path, ".md")}](${rel(out, m.path)})`);
    return `| \`${esc(r.url)}\` | ${r.kind} | \`${esc(r.file)}\` | ${docs.join(", ") || "none"} |`;
  });
  return (
    header("Every page and route handler, its URL and the system document that covers it.") +
    "# Routes\n\n" +
    banner("the files under `app/`") +
    table("| URL | Kind | File | Documented in |\n| --- | --- | --- | --- |", lines, "There are no routes yet.")
  );
}

function envDoc(root: string, files: readonly string[]): string {
  const sources = files.filter(
    (f) =>
      /\.(?:tsx?|mts|mjs|js)$/.test(f) &&
      (/^(?:app|lib|components|scripts|supabase\/functions|tests|e2e)\//.test(f) ||
        /^(?:proxy\.ts|next\.config\.ts|playwright\.config\.ts|vitest\.config\.m?ts)$/.test(f)) &&
      !f.startsWith("scripts/docs/") &&
      !f.startsWith("tests/docs/"),
  );
  const readers = new Map<string, string[]>();
  for (const f of sources) {
    for (const name of envNamesIn(fs.readFileSync(path.join(root, f), "utf8"))) {
      readers.set(name, [...(readers.get(name) ?? []), f]);
    }
  }
  const examplePath = path.join(root, ".env.example");
  const example = new Set(
    fs.existsSync(examplePath) ? [...fs.readFileSync(examplePath, "utf8").matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]) : [],
  );
  const lines = [...readers.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, readIn]) => {
      const shown = readIn
        .slice(0, 3)
        .map((f) => `\`${esc(f)}\``)
        .join(", ");
      const more = readIn.length > 3 ? ` and ${readIn.length - 3} more` : "";
      return `| \`${name}\` | ${shown}${more} | ${example.has(name) ? "yes" : "no"} |`;
    });
  return (
    header("Every environment variable the code reads, where it is read, and whether .env.example lists it.") +
    "# Environment variables\n\n" +
    banner("`process.env` and `Deno.env` reads in the application, scripts, tests and root configs") +
    "\nWhat each variable means lives with the code that reads it and in the system document for that area.\n" +
    table("| Name | Read in | In `.env.example` |\n| --- | --- | --- |", lines, "The code reads no environment variables.")
  );
}

function cronsDoc(root: string, files: readonly string[]): string {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8")) as {
    crons?: { path: string; schedule: string }[];
  };
  const fileSet = new Set(files);
  const lines = (vercel.crons ?? []).map((c) => {
    const handler = `app${c.path}/route.ts`;
    return `| \`${c.path}\` | \`${c.schedule}\` | ${fileSet.has(handler) ? `\`${handler}\`` : "missing"} |`;
  });
  return (
    header("The scheduled jobs Vercel runs, their schedules (UTC) and handlers.") +
    "# Scheduled jobs\n\n" +
    banner("`vercel.json`") +
    "\nSchedules are cron expressions in UTC.\n" +
    table("| Path | Schedule | Handler |\n| --- | --- | --- |", lines, "There are no scheduled jobs.")
  );
}

function bucketsDoc(root: string, files: readonly string[]): string {
  const out = `${GENERATED_DIR}/buckets.md`;
  const created = new Map<string, string>();
  for (const f of files.filter((x) => /^supabase\/migrations\/\d{4}_[^/]+\.sql$/.test(x))) {
    for (const b of bucketsFromMigration(fs.readFileSync(path.join(root, f), "utf8"))) {
      if (!created.has(b)) created.set(b, f);
    }
  }
  const lines = [...created.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, migration]) => `| \`${bucket}\` | [${path.posix.basename(migration)}](${rel(out, migration)}) |`);
  return (
    header("Every storage bucket and the migration that creates it.") +
    "# Storage buckets\n\n" +
    banner("`storage.buckets` inserts in `supabase/migrations/`") +
    table("| Bucket | Created in |\n| --- | --- |", lines, "There are no storage buckets.")
  );
}

function scriptsDoc(root: string): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  const lines = Object.entries(pkg.scripts ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, cmd]) => `| \`${name}\` | \`${esc(cmd)}\` |`);
  return (
    header("Every package.json script and the command it runs.") +
    "# Package scripts\n\n" +
    banner("`package.json`") +
    table("| Script | Command |\n| --- | --- |", lines, "There are no package scripts.")
  );
}

export function generatedFiles(root: string, files: readonly string[], docs: readonly Doc[]): Map<string, string> {
  const claims = coverDocs(docs);
  return new Map([
    [`${GENERATED_DIR}/routes.md`, routesDoc(files, claims)],
    [`${GENERATED_DIR}/env.md`, envDoc(root, files)],
    [`${GENERATED_DIR}/crons.md`, cronsDoc(root, files)],
    [`${GENERATED_DIR}/buckets.md`, bucketsDoc(root, files)],
    [`${GENERATED_DIR}/scripts.md`, scriptsDoc(root)],
  ]);
}

/** The generated part of docs/README.md: one line per document, grouped by kind. */
export function indexBlock(docs: readonly Doc[], generated: ReadonlyMap<string, string>): string {
  const texts = new Map(docs.map((d) => [d.path, d.text]));
  for (const [p, t] of generated) texts.set(p, t);
  const all = [...texts.keys()].filter((p) => p.startsWith("docs/") && p !== INDEX_FILE).sort();
  const entry = (p: string) => {
    const text = texts.get(p) ?? "";
    const fm = parseFrontmatter(text);
    const summary = fm.ok && fm.summary ? `: ${fm.summary}` : "";
    return `- [${title(fm.ok ? fm.body : text, p)}](${p.slice("docs/".length)})${summary}`;
  };
  const section = (heading: string, filter: (p: string) => boolean) => {
    const items = all.filter(filter);
    return items.length ? `### ${heading}\n\n${items.map(entry).join("\n")}\n` : "";
  };
  return [
    INDEX_START,
    "",
    section("System: how the app behaves now", (p) => kindOf(p) === "system"),
    section("Decisions: owner rulings", (p) => kindOf(p) === "decision"),
    section("Runbooks: procedures", (p) => kindOf(p) === "runbook"),
    section("Reference", (p) => kindOf(p) === "reference" || kindOf(p) === "generated"),
    section("Database", (p) => kindOf(p) === "db"),
    section("History: frozen records", (p) => kindOf(p) === "history"),
    INDEX_END,
  ]
    .filter((s) => s !== "")
    .join("\n");
}

function indexRegion(text: string): { before: string; block: string; after: string } | null {
  const start = text.indexOf(INDEX_START);
  const end = text.indexOf(INDEX_END);
  if (start === -1 || end === -1 || end < start) return null;
  return { before: text.slice(0, start), block: text.slice(start, end + INDEX_END.length), after: text.slice(end + INDEX_END.length) };
}

/** Writes the generated inventories and the docs/README.md index. Returns the files it changed. */
export function writeGenerated(root: string): string[] {
  const files = repoFiles(root);
  const docs = loadDocs(root, files);
  const generated = generatedFiles(root, files, docs);
  const changed: string[] = [];
  const write = (p: string, content: string) => {
    const abs = path.join(root, p);
    if (fs.existsSync(abs) && fs.readFileSync(abs, "utf8") === content) return;
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    changed.push(p);
  };
  for (const [p, content] of generated) write(p, content);
  const indexPath = path.join(root, INDEX_FILE);
  const region = fs.existsSync(indexPath) ? indexRegion(fs.readFileSync(indexPath, "utf8")) : null;
  if (region) write(INDEX_FILE, region.before + indexBlock(docs, generated) + region.after);
  return changed;
}

// ---------------------------------------------------------------- checks

function checkLinks(doc: Doc, root: string, problems: Problem[]): void {
  const dir = path.posix.dirname(doc.path);
  const text = stripFences(doc.text);
  const targets = [
    ...text.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g),
    ...text.matchAll(/^ {0,3}\[[^\]]+\]:\s*<?([^\s>]+)>?/gm),
  ];
  for (const m of targets) {
    const target = m[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const [file, anchor] = target.split("#");
    const resolved = file ? path.posix.normalize(path.posix.join(dir, decodeURIComponent(file))) : doc.path;
    const abs = path.join(root, resolved);
    if (file && !fs.existsSync(abs)) {
      problems.push({ file: doc.path, rule: "broken link", detail: `${target} (line ${lineOf(doc.text, m.index ?? 0)})` });
      continue;
    }
    if (!anchor || !resolved.endsWith(".md") || isLineAnchor(anchor)) continue;
    const targetText = file ? fs.readFileSync(abs, "utf8") : doc.text;
    if (!headings(targetText).map(slug).includes(decodeURIComponent(anchor))) {
      problems.push({ file: doc.path, rule: "broken anchor", detail: `${target} (line ${lineOf(doc.text, m.index ?? 0)})` });
    }
  }
}

/** True when git ignores the path: documents may name ignored local folders such as `e2e/.auth/`. */
function gitIgnores(root: string, p: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", "--no-index", p], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function pathExists(p: string, files: readonly string[], fileSet: ReadonlySet<string>, root: string): boolean {
  if (p.includes("*")) return files.some((f) => globToRegExp(p).test(f));
  if (fileSet.has(p)) return true;
  const dir = p.endsWith("/") ? p : `${p}/`;
  return files.some((f) => f.startsWith(dir)) || fs.existsSync(path.join(root, p)) || (p.endsWith("/") && gitIgnores(root, p));
}

export function checkDocs(root: string): Problem[] {
  const files = repoFiles(root);
  const fileSet = new Set(files);
  const docs = loadDocs(root, files);
  const problems: Problem[] = [];

  for (const doc of docs) {
    if (doc.kind === "template") continue;
    const fm = parseFrontmatter(doc.text);
    if (CURRENT.has(doc.kind)) {
      if (!fm.ok) problems.push({ file: doc.path, rule: "frontmatter", detail: fm.error });
      else if (!fm.summary) problems.push({ file: doc.path, rule: "frontmatter", detail: "summary is missing" });
      else if (fm.summary.length > 200) problems.push({ file: doc.path, rule: "frontmatter", detail: "summary is longer than 200 characters" });
      const body = fm.ok ? fm.body : doc.text;
      const h1s = stripFences(body).match(/^#\s+/gm)?.length ?? 0;
      if (h1s !== 1) problems.push({ file: doc.path, rule: "title", detail: `expected one "# " title, found ${h1s}` });
    }
    if (fm.ok && fm.covers.length && !CLAIMING.has(doc.kind)) {
      problems.push({ file: doc.path, rule: "frontmatter", detail: "only system documents and runbooks may claim code with covers" });
    }
    if (fm.ok) {
      for (const glob of fm.covers) {
        if (!files.some((f) => globToRegExp(glob).test(f))) problems.push({ file: doc.path, rule: "dead covers glob", detail: glob });
      }
    }

    checkLinks(doc, root, problems);

    if (CURRENT.has(doc.kind) || doc.kind === "index" || doc.kind === "agent") {
      const unclosed = fences(doc.text).unclosedLine;
      if (unclosed !== null) problems.push({ file: doc.path, rule: "unclosed code fence", detail: `opened on line ${unclosed}` });

      const own = doc.kind === "index" ? (indexRegion(doc.text)?.before ?? doc.text) : doc.text;
      for (const p of backtickedRepoPaths(stripFences(own))) {
        if (!pathExists(p, files, fileSet, root)) problems.push({ file: doc.path, rule: "missing path", detail: p });
      }
    }

    if (STRICT.has(doc.kind) || doc.kind === "index") {
      const own = doc.kind === "index" ? (indexRegion(doc.text)?.before ?? doc.text) : doc.text;
      for (const hit of bannedPatternHits(stripFences(own))) {
        problems.push({ file: doc.path, rule: hit.rule, detail: `${hit.match} (line ${hit.line})` });
      }
    }
  }

  // Every part of the code belongs to some document.
  const claims = coverDocs(docs);
  const claimed = matcher(claims.flatMap((c) => c.covers));
  for (const f of files.filter((x) => inSurface(x) && !claimed(x))) {
    problems.push({ file: f, rule: "unclaimed code", detail: "no system document or runbook lists it in covers" });
  }

  // Generated inventories and the index match the code.
  const generated = generatedFiles(root, files, docs);
  for (const [p, content] of generated) {
    const abs = path.join(root, p);
    if (!fs.existsSync(abs) || fs.readFileSync(abs, "utf8") !== content) {
      problems.push({ file: p, rule: "stale generated file", detail: "run pnpm docs:gen" });
    }
  }
  const index = docs.find((d) => d.path === INDEX_FILE);
  const region = index ? indexRegion(index.text) : null;
  if (!region) problems.push({ file: INDEX_FILE, rule: "index", detail: `missing ${INDEX_START} … ${INDEX_END}` });
  else if (region.block !== indexBlock(docs, generated)) problems.push({ file: INDEX_FILE, rule: "stale generated file", detail: "run pnpm docs:gen" });

  // Code that cites a document cites one that exists. Pushed migrations are never edited, so
  // their comments may name documents that have since moved.
  const citing = files.filter(
    (f) =>
      (/^(?:app|lib|components|scripts|tests|e2e|supabase|\.claude|\.github)\//.test(f) || /^[^/]+\.(?:ts|mts|mjs)$/.test(f)) &&
      !f.startsWith("supabase/migrations/") &&
      !f.startsWith("scripts/docs/") &&
      !f.startsWith("tests/docs/") &&
      /\.(?:tsx?|mts|mjs|js|sh|sql|md|ya?ml)$/.test(f),
  );
  for (const f of citing) {
    const text = fs.readFileSync(path.join(root, f), "utf8");
    for (const cited of citedDocPaths(text)) {
      if (!fileSet.has(cited.path)) problems.push({ file: f, rule: "cites a missing document", detail: `${cited.path} (line ${lineOf(text, cited.index)})` });
    }
  }

  return problems;
}

export function formatProblems(problems: readonly Problem[]): string {
  const byFile = new Map<string, Problem[]>();
  for (const p of problems) byFile.set(p.file, [...(byFile.get(p.file) ?? []), p]);
  return [...byFile.entries()].map(([file, ps]) => `${file}\n${ps.map((p) => `  ${p.rule}: ${p.detail}`).join("\n")}`).join("\n");
}

/** Files changed against `base`, staged, unstaged and new. */
export function changedFiles(root: string, base: string): string[] {
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  return [
    ...new Set([
      ...git(["diff", "--name-only", `${base}...HEAD`]),
      ...git(["diff", "--name-only", "HEAD"]),
      ...git(["ls-files", "--others", "--exclude-standard"]),
    ]),
  ].sort();
}

export function owedForRoot(root: string, base: string): { doc: string; files: string[] }[] {
  const files = repoFiles(root);
  return owedDocs(changedFiles(root, base), coverDocs(loadDocs(root, files)));
}
