// Lint rules about the shared library's source. Every app shows these components, so the rules of the apps hold here
// too. They read files, so they run as `pnpm lint`, not as tests.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const library = join(import.meta.dirname, "..")
const source = join(library, "src")

type Rule = { name: string; hint: string; files: string[]; offenders: (text: string) => string[] }

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
]

let failed = false
for (const rule of rules) {
  const found = rule.files.flatMap((path) =>
    rule.offenders(readFileSync(path, "utf8")).map((detail) => `  ${relative(library, path)}${detail}`),
  )
  if (found.length === 0) continue
  failed = true
  console.error(`✗ ${rule.name}\n${found.join("\n")}\n  ${rule.hint}`)
}
if (failed) process.exit(1)
console.log(`✓ ${rules.length} source rules pass`)
