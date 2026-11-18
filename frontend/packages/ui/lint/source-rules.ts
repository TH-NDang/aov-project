// Lint rules about the shared library's source. Every app shows these components, so the rules of the apps hold here
// too. They read files, so they run as `pnpm lint`, not as tests.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { knownRestyles } from "./known-restyles.ts"
import { newRestyles, RESTYLE_HINT } from "./stylesheet-owners.ts"

const library = join(import.meta.dirname, "..")
const source = join(library, "src")
const restyles = newRestyles(source, null, knownRestyles)

type Rule = { name: string; hint: string; files: string[]; offenders: (text: string, path: string) => string[] }

function files(folder: string, pattern: RegExp): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name)
    if (statSync(path).isDirectory()) return files(path, pattern)
    return pattern.test(name) ? [path] : []
  })
}

function pixels(value: number, unit: string) {
  return unit === "px" ? value : value * 16
}

const minimumPx = 12

const rules: Rule[] = [
  {
    name: "shared text is never smaller than 12px",
    hint: "Use text-xs (12px) or a type-* style.",
    files: files(source, /\.(tsx?|css)$/),
    offenders: (text) =>
      text.split("\n").flatMap((line, index) =>
        [
          // Tailwind arbitrary sizes such as text-[11px] or text-[0.65rem].
          ...line.matchAll(/text-\[(\d*\.?\d+)(px|rem|em)\]/g),
          // Inline styles and stylesheets such as fontSize: 10, fontSize: "10px" or font-size: 0.6rem.
          ...line.matchAll(/font-?[sS]ize:\s*["']?(\d*\.?\d+)(px|rem|em)?/g),
        ]
          .filter(([, value, unit = "px"]) => pixels(Number(value), unit) < minimumPx)
          .map(([match]) => `:${index + 1} ${match.trim()}`),
      ),
  },
  {
    name: "a stylesheet styles only the classes it owns",
    hint: RESTYLE_HINT,
    files: [...restyles.offenders.keys()],
    offenders: (_, path) => restyles.offenders.get(path) ?? [],
  },
  {
    name: "every known restyle is still there",
    hint: "Remove the entry from lint/known-restyles.ts: no rule styles that class from that sheet any more.",
    files: restyles.stale.length > 0 ? [join(import.meta.dirname, "known-restyles.ts")] : [],
    offenders: () => restyles.stale.map((key) => ` ${key}`),
  },
]

let failed = false
for (const rule of rules) {
  const found = rule.files.flatMap((path) =>
    rule.offenders(readFileSync(path, "utf8"), path).map((detail) => `  ${relative(library, path)}${detail}`),
  )
  if (found.length === 0) continue
  failed = true
  console.error(`✗ ${rule.name}\n${found.join("\n")}\n  ${rule.hint}`)
}
if (failed) process.exit(1)
console.log(`✓ ${rules.length} source rules pass`)
