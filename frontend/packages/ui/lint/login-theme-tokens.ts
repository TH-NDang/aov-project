// The Keycloak login theme runs outside the apps, so its stylesheet starts with a copy of the shared tokens between two
// marker comments. `pnpm lint` fails when the copy differs from tokens.css; to update it, run from packages/ui:
//   node --experimental-strip-types lint/login-theme-tokens.ts --write
import { readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const library = join(import.meta.dirname, "..")
export const loginStylesheet = resolve(
  library,
  "../../../backend/wiki-service/infra/local/keycloak-themes/aov-public/login/resources/css/aov-login.css",
)
const START =
  "/* Shared tokens: a copy of frontend/packages/ui/src/styles/tokens.css, written by lint/login-theme-tokens.ts. */"
const END = "/* End of the shared tokens. */"

/** The :root block of tokens.css between the markers. */
export function tokenBlock() {
  const tokens = readFileSync(join(library, "src/styles/tokens.css"), "utf8").replaceAll("\r\n", "\n")
  return `${START}\n${tokens.slice(tokens.indexOf(":root {")).trim()}\n${END}`
}

function copyRange(stylesheet: string) {
  const start = stylesheet.indexOf(START)
  const end = stylesheet.indexOf(END)
  return start < 0 || end < start ? null : { start, end: end + END.length }
}

/** What is wrong with the theme's copy of the tokens, if anything. */
export function loginTokenOffenders() {
  const stylesheet = readFileSync(loginStylesheet, "utf8").replaceAll("\r\n", "\n")
  const range = copyRange(stylesheet)
  if (!range) return [" has no copy of the shared tokens between its marker comments"]
  return stylesheet.slice(range.start, range.end) === tokenBlock() ? [] : [" holds an old copy of the shared tokens"]
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes("--write")) {
  const stylesheet = readFileSync(loginStylesheet, "utf8").replaceAll("\r\n", "\n")
  const range = copyRange(stylesheet)
  if (!range) throw new Error(`${loginStylesheet} has no marker comments for the shared tokens`)
  writeFileSync(loginStylesheet, stylesheet.slice(0, range.start) + tokenBlock() + stylesheet.slice(range.end))
  console.log(`Copied the shared tokens into ${loginStylesheet}`)
}
