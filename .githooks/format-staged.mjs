#!/usr/bin/env node
// Formats staged files before each commit so every editor produces the same layout.
//
//   Java under backend/wiki-service/src  -> Spotless (backend/wiki-service/config/format/eclipse-formatter.xml)
//   Code under frontend/                 -> Prettier (frontend/.prettierrc.json), when installed
//
// A fully staged file is formatted and staged again. A partially staged file is formatted in the
// working tree only and the commit stops, so hunks you did not stage are never committed by accident.
// Skip once with: SKIP_FORMAT=1 git commit ...
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

if (process.env.SKIP_FORMAT === "1") {
  process.exit(0);
}

const JAVA_MODULE = "backend/wiki-service";
const FRONTEND = "frontend";
const PRETTIER_FILES = /\.(?:[cm]?[jt]sx?|json|css|html)$/;
const PRETTIER_SKIP = /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json)$/;
const MAVEN_BATCH = 25; // Keeps the command line short on Windows.

const root = git(["rev-parse", "--show-toplevel"]).trim();
process.chdir(root);

const staged = split(git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]));
const unstaged = new Set(split(git(["diff", "--name-only", "-z"])));

const javaFiles = staged.filter((f) => f.startsWith(`${JAVA_MODULE}/src/`) && f.endsWith(".java"));
const frontendFiles = staged.filter(
  (f) => f.startsWith(`${FRONTEND}/`) && PRETTIER_FILES.test(f) && !PRETTIER_SKIP.test(f),
);

if (javaFiles.length === 0 && frontendFiles.length === 0) {
  process.exit(0);
}

const before = new Map([...javaFiles, ...frontendFiles].map((f) => [f, hash(f)]));

if (javaFiles.length > 0) {
  formatJava(javaFiles);
}
if (frontendFiles.length > 0) {
  formatFrontend(frontendFiles);
}

const changed = [...before].filter(([f, digest]) => hash(f) !== digest).map(([f]) => f);
const restage = changed.filter((f) => !unstaged.has(f));
const partial = changed.filter((f) => unstaged.has(f));

if (restage.length > 0) {
  git(["add", "--", ...restage]);
  console.log(`[format] Formatted and re-staged ${restage.length} file(s).`);
}
if (partial.length > 0) {
  console.error(
    "[format] These files are partially staged and needed formatting. They were formatted in the working tree,\n" +
      "         but not staged. Review them (git diff), stage them, then commit again:",
  );
  for (const f of partial) {
    console.error(`  ${f}`);
  }
  process.exit(1);
}

function formatJava(files) {
  const moduleDir = path.join(root, JAVA_MODULE);
  const windows = process.platform === "win32";
  for (let i = 0; i < files.length; i += MAVEN_BATCH) {
    // Spotless matches each regex against the absolute path; accept both path separators.
    const patterns = files
      .slice(i, i + MAVEN_BATCH)
      .map((f) => ".*" + escapeRegex(f.slice(JAVA_MODULE.length + 1)).replaceAll("/", "[\\\\/]"))
      .join(",");
    const args = ["-q", "-B", "spotless:apply", `-DspotlessFiles=${patterns}`];
    const result = windows
      ? spawnSync("cmd.exe", ["/d", "/c", "mvnw.cmd", ...args], { cwd: moduleDir, encoding: "utf8" })
      : spawnSync("sh", ["./mvnw", ...args], { cwd: moduleDir, encoding: "utf8" });
    if (result.error || result.status !== 0) {
      console.error("[format] Spotless failed (syntax error, or Java/Maven not available):");
      console.error(result.error?.message ?? `${result.stdout}${result.stderr}`.trim().split("\n").slice(-30).join("\n"));
      console.error("[format] Fix the problem, or skip formatting once with: SKIP_FORMAT=1 git commit ...");
      process.exit(1);
    }
  }
}

function formatFrontend(files) {
  const frontendDir = path.join(root, FRONTEND);
  const prettier = path.join(frontendDir, "node_modules", "prettier", "bin", "prettier.cjs");
  if (!existsSync(prettier)) {
    console.warn("[format] Prettier is not installed in frontend/ (run: pnpm install); frontend files left as is.");
    return;
  }
  const relative = files.map((f) => f.slice(FRONTEND.length + 1));
  const result = spawnSync(
    process.execPath,
    [prettier, "--write", "--ignore-unknown", "--log-level", "warn", ...relative],
    { cwd: frontendDir, encoding: "utf8" },
  );
  if (result.error || result.status !== 0) {
    console.error("[format] Prettier failed:");
    console.error(result.error?.message ?? `${result.stdout}${result.stderr}`.trim());
    process.exit(1);
  }
}

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    console.error(`[format] git ${args.join(" ")} failed: ${result.stderr}`);
    process.exit(1);
  }
  return result.stdout;
}

function split(output) {
  return output.split("\0").filter(Boolean);
}

function hash(file) {
  return existsSync(file) ? createHash("sha1").update(readFileSync(file)).digest("hex") : "";
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
