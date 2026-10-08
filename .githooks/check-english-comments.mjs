#!/usr/bin/env node
// Pre-commit check: code comments must be written in English.
// Scans only lines added in the staged diff, so existing code never blocks a commit.
// Bypass for a genuine exception: git commit --no-verify

import { execFileSync } from "node:child_process";

const CHECKED_ROOTS = ["backend/", "frontend/"];
const SKIPPED_PATHS = [/\/docs\//, /\/node_modules\//, /\/target\//, /\/dist\//, /\/generated\//];

// Comment syntax per file extension.
const SLASH = { line: ["//"], block: true };
const HASH = { line: ["#"], block: false };
const SYNTAX = {
  java: SLASH, kt: SLASH, ts: SLASH, tsx: SLASH, js: SLASH, jsx: SLASH, mjs: SLASH, cjs: SLASH,
  css: { line: [], block: true },
  scss: SLASH,
  sql: { line: ["--"], block: true },
  yml: HASH, yaml: HASH, properties: HASH, sh: HASH, toml: HASH, dockerfile: HASH,
  html: { line: [], block: false, xml: true },
  xml: { line: [], block: false, xml: true },
};

// Letters that only appear in Vietnamese (with diacritics) plus đ.
const VIETNAMESE =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/iu;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function extensionOf(path) {
  const name = path.split("/").pop().toLowerCase();
  if (name === "dockerfile") return "dockerfile";
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1);
}

function isCandidate(path) {
  if (!CHECKED_ROOTS.some((root) => path.startsWith(root))) return false;
  if (SKIPPED_PATHS.some((re) => re.test("/" + path))) return false;
  return extensionOf(path) in SYNTAX;
}

// Returns the comment text found on a line, or null if the line has no comment.
function commentPart(line, syntax) {
  const trimmed = line.trim();
  if (syntax.block) {
    if (trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("{/*")) return trimmed;
    const open = line.indexOf("/*");
    if (open !== -1) return line.slice(open);
  }
  if (syntax.xml) {
    const open = line.indexOf("<!--");
    if (open !== -1) return line.slice(open);
  }
  for (const marker of syntax.line) {
    let from = 0;
    while (true) {
      const at = line.indexOf(marker, from);
      if (at === -1) break;
      // Skip "://" in URLs such as https://example.com
      if (marker === "//" && at > 0 && line[at - 1] === ":") { from = at + 2; continue; }
      // For "#", only treat it as a comment at line start or after whitespace.
      if (marker === "#" && at > 0 && !/\s/.test(line[at - 1])) { from = at + 1; continue; }
      return line.slice(at);
    }
  }
  return null;
}

function addedLines(path) {
  const diff = git(["diff", "--cached", "-U0", "--no-color", "--", path]);
  const result = [];
  let lineNo = 0;
  for (const raw of diff.split("\n")) {
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { lineNo = Number(hunk[1]); continue; }
    if (raw.startsWith("+++")) continue;
    if (raw.startsWith("+")) { result.push({ lineNo, text: raw.slice(1) }); lineNo++; }
  }
  return result;
}

const staged = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])
  .split("\0")
  .filter(Boolean)
  .filter(isCandidate);

const violations = [];
for (const path of staged) {
  const syntax = SYNTAX[extensionOf(path)];
  for (const { lineNo, text } of addedLines(path)) {
    const comment = commentPart(text.normalize("NFC"), syntax);
    if (comment && VIETNAMESE.test(comment)) {
      violations.push(`  ${path}:${lineNo}: ${comment.trim().slice(0, 100)}`);
    }
  }
}

if (violations.length > 0) {
  console.error("\n[pre-commit] Code comments must be written in English (see AGENTS.md).");
  console.error("Vietnamese text found in comments:\n");
  console.error(violations.join("\n"));
  console.error("\nTranslate these comments, then commit again.");
  console.error("For a genuine exception: git commit --no-verify\n");
  process.exit(1);
}
