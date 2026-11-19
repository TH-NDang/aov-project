// Lint rules about Stream's source itself. They read files, so they run as `pnpm lint`, not as tests.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"
import { newRestyles, RESTYLE_HINT } from "../../../packages/ui/lint/stylesheet-owners.ts"
import { vietnameseInMarkup } from "../../../packages/ui/lint/vietnamese-in-markup.ts"
import { knownRestyles } from "./known-restyles.ts"

const app = join(import.meta.dirname, "..")
const source = join(app, "src")
const restyles = newRestyles(source, join(app, "../../packages/ui/src"), knownRestyles)

type Rule = { name: string; hint: string; files: string[]; offenders: (text: string, path: string) => string[] }

function files(folder: string, pattern: RegExp): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name)
    if (statSync(path).isDirectory()) return files(path, pattern)
    return pattern.test(name) ? [path] : []
  })
}

/** `features/<name>` for a file inside a feature, otherwise the top folder under src, such as `lib`. */
function layer(path: string) {
  const [top, feature] = relative(source, path).split(sep)
  return top === "features" ? `features/${feature}` : top!
}

function target(from: string, specifier: string) {
  const base = resolve(dirname(from), specifier)
  return ["", ".ts", ".tsx"].map((ext) => base + ext).find((path) => existsSync(path) && statSync(path).isFile())
}

const rules: Rule[] = [
  {
    name: "interface text in markup has an English counterpart",
    hint: 'Write the words as text("…", "…") from useStreamLocale, with the English beside the Vietnamese.',
    files: files(source, /\.tsx$/),
    offenders: vietnameseInMarkup,
  },
  {
    name: "shared folders never import a feature, and a feature never imports another one",
    hint: "Move what two features share to src/components (components) or src/lib (models, API and hooks).",
    files: files(source, /\.(tsx?)$/),
    offenders: (text, path) =>
      [...text.matchAll(/from\s+"(\.{1,2}\/[^"]+)"/g)].flatMap(([, specifier]) => {
        const imported = target(path, specifier!)
        if (!imported) return []
        const [own, theirs] = [layer(path), layer(imported)]
        return theirs.startsWith("features/") && own !== theirs && !path.startsWith(join(source, "App"))
          ? [` imports ${relative(source, imported)}`]
          : []
      }),
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
    rule.offenders(readFileSync(path, "utf8"), path).map((detail) => `  ${relative(app, path)}${detail}`),
  )
  if (found.length === 0) continue
  failed = true
  console.error(`✗ ${rule.name}\n${found.join("\n")}\n  ${rule.hint}`)
}
if (failed) process.exit(1)
console.log(`✓ ${rules.length} source rules pass`)
