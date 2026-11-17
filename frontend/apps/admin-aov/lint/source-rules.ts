// Lint rules about the Admin source itself. They read files, so they run as `pnpm lint`, not as tests.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const app = join(import.meta.dirname, "..")
const source = join(app, "src")

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

// The admin reads on a 12/14/16/24 scale; see the type-* styles in packages/ui/src/styles/typography.css.
const minimumPx = 12

const rules: Rule[] = [
  {
    name: "admin text is never smaller than 12px",
    hint: "Use text-xs (12px) or a type-* style.",
    files: files(source, /\.(tsx?|css)$/),
    offenders: (text) =>
      text.split("\n").flatMap((line, index) =>
        [
          // Tailwind arbitrary sizes such as text-[11px] or text-[0.65rem].
          ...line.matchAll(/text-\[(\d*\.?\d+)(px|rem|em)\]/g),
          // Inline styles such as fontSize: 10, fontSize: "10px" or font-size: 0.6rem.
          ...line.matchAll(/font-?[sS]ize:\s*["']?(\d*\.?\d+)(px|rem|em)?/g),
        ]
          .filter(([, value, unit = "px"]) => pixels(Number(value), unit) < minimumPx)
          .map(([match]) => `:${index + 1} ${match.trim()}`),
      ),
  },
  {
    name: "admin never asks through the browser's own confirm box",
    hint: "Use confirmAction or confirmDiscard from components/confirm-dialog.",
    files: files(source, /\.tsx?$/),
    offenders: (text) => (text.includes("window.confirm") ? [""] : []),
  },
  {
    name: "esports viewer components and models stay free of admin-only modules",
    hint: "The public site reuses these folders; keep the admin API and session out of them.",
    files: ["components", "model"].flatMap((folder) => files(join(source, "features", "esports", folder), /\.tsx?$/)),
    offenders: (text) => [
      ...(/from "@\/(app|features\/tournaments|lib\/api)/.test(text) ? [" imports an admin module"] : []),
      ...(/tournamentApi|useSession/.test(text) ? [" reaches the admin API"] : []),
    ],
  },
]

let failed = false
for (const rule of rules) {
  const found = rule.files.flatMap((path) =>
    rule.offenders(readFileSync(path, "utf8"), path).map((detail) => `  ${relative(app, path)}${detail}`),
  )
  if (found.length === 0) continue
  failed = true
  console.error(`✗ ${rule.name}\n${found.join("\n")}\n  ${rule.hint}`)
}
if (failed) process.exit(1)
console.log(`✓ ${rules.length} source rules pass`)
