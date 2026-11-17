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

/** The call starting at `start` (an opening parenthesis), up to its closing one. */
function call(text: string, start: number) {
  let depth = 0
  for (let index = start; index < text.length; index++) {
    if (text[index] === "(") depth++
    else if (text[index] === ")" && --depth === 0) return text.slice(start, index + 1)
  }
  return text.slice(start)
}

/** Mutations whose error the screen renders itself while the shared toast would show it too. */
function errorsShownTwice(text: string) {
  return [...text.matchAll(/const (\w+) = useMutation(?:<[^>]*>)?\(/g)]
    .filter((match) => {
      const options = call(text, match.index + match[0].length - 1)
      return !/silent:\s*true/.test(options) && new RegExp(`\\b${match[1]}\\.(error|isError)\\b`).test(text)
    })
    .map((match) => `:${text.slice(0, match.index).split("\n").length} ${match[1]}`)
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
    name: "a type-* role style is not combined with a text size or font weight",
    hint: "The role sets size and weight; drop text-{size} and font-{weight} from that element (AGENTS.md).",
    files: files(source, /\.tsx?$/),
    offenders: (text) =>
      text
        .split("\n")
        .flatMap((line, index) =>
          [...line.matchAll(/(["'`])([^"'`]*\btype-(?:page-title|section-title|body|label|meta)\b[^"'`]*)\1/g)]
            .filter(([, , classes]) =>
              /(?<![\w-])(font-(normal|medium|semibold|bold)|text-(xs|sm|base|lg|xl|\dxl|\[\d[^\]]*\]))(?![\w-])/.test(
                classes,
              ),
            )
            .map(() => `:${index + 1}`),
        ),
  },
  {
    name: "admin text stays on the 12/14/16/24 scale",
    hint: "Use text-xs, text-sm, text-base or text-2xl, or a type-* role; the brand wordmark is the one exception.",
    files: files(source, /\.(tsx?|css)$/),
    offenders: (text) =>
      text
        .split("\n")
        .flatMap((line, index) =>
          line.includes("AovWordmark")
            ? []
            : [
                ...line.matchAll(/(?<![\w-])text-(lg|xl|[3-9]xl)(?![\w-])/g),
                ...[...line.matchAll(/font-size:\s*(\d+)px/g)].filter(
                  ([, size]) => !["12", "14", "16", "24"].includes(size),
                ),
              ].map(([match]) => `:${index + 1} ${match}`),
        ),
  },
  {
    name: "admin uses only the font weights the font files provide",
    hint: "Use 400, 500, 600 or 700 (font-normal, font-medium, font-semibold, font-bold); see frontend/AGENTS.md.",
    files: files(source, /\.(tsx?|css)$/),
    offenders: (text) =>
      text
        .split("\n")
        .flatMap((line, index) =>
          [
            ...line.matchAll(/\bfont-(thin|extralight|light|extrabold|black)\b/g),
            ...line.matchAll(/font-weight:\s*(\d+)/g),
            ...line.matchAll(/\bfont-\[(\d+)\]/g),
          ]
            .filter(([, weight]) => !["400", "500", "600", "700"].includes(weight))
            .map(([match]) => `:${index + 1} ${match}`),
        ),
  },
  {
    name: "admin never asks through the browser's own confirm box",
    hint: "Use confirmAction or confirmDiscard from components/confirm-dialog.",
    files: files(source, /\.tsx?$/),
    offenders: (text) => (text.includes("window.confirm") ? [""] : []),
  },
  {
    name: "a mutation whose error the screen shows keeps the shared toast quiet",
    hint: "Add meta: { silent: true } to that useMutation, or leave the error to the toast (frontend/AGENTS.md).",
    files: files(source, /.tsx?$/),
    offenders: (text) => errorsShownTwice(text),
  },
  {
    name: "infinite lists find their next page with nextPageOf",
    hint: "Use getNextPageParam: nextPageOf from @aov/ui/lib/page-slice; it also stops on an empty page.",
    files: files(source, /\.tsx?$/),
    offenders: (text) =>
      text
        .split("\n")
        .flatMap((line, index) =>
          /getNextPageParam:/.test(line) && !/getNextPageParam: nextPageOf\b/.test(line) ? [`:${index + 1}`] : [],
        ),
  },
  {
    name: "admin writes numbers in the reader's locale or as the game writes them",
    hint: 'Use formatNumber from lib/text for interface numbers and formatGameNumber for figures of the game, never "vi-VN".',
    files: files(source, /\.tsx?$/),
    offenders: (text) =>
      text
        .split("\n")
        .flatMap((line, index) =>
          /toLocaleString\(\s*["']vi-VN["']|NumberFormat\(\s*["']vi-VN["']/.test(line) ? [`:${index + 1}`] : [],
        ),
  },
  {
    name: "admin folds accents for search in one place",
    hint: "Use normalize, matchesQuery or slugify from lib/text; a copy tends to forget the crossed d.",
    files: files(source, /\.tsx?$/).filter(
      (path) => !path.endsWith(join("lib", "text.ts")) && !path.endsWith(join("esports", "model", "name-key.ts")),
    ),
    offenders: (text) =>
      text
        .split("\n")
        .flatMap((line, index) => (/\.normalize\(\s*["']NFD["']\s*\)/.test(line) ? [`:${index + 1}`] : [])),
  },
  {
    name: "admin imports a name from the module that declares it",
    hint: "Import from the real module (often @aov/ui) and drop the re-export; two paths to one thing drift apart.",
    files: files(source, /\.tsx?$/),
    offenders: (text) =>
      [...text.matchAll(/^export\s+(type\s+)?(\*|\{[^}]*\})\s+from\s/gm)].map(
        (match) => `:${text.slice(0, match.index).split("\n").length}`,
      ),
  },
  {
    name: "admin makes ids with randomId",
    hint: "crypto.randomUUID is missing on plain-HTTP LAN addresses; use randomId from lib/random-id.",
    files: files(source, /\.tsx?$/).filter((path) => !path.endsWith(join("lib", "random-id.ts"))),
    offenders: (text) => (text.includes("crypto.randomUUID") ? [""] : []),
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
