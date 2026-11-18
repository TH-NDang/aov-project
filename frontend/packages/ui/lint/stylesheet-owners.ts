// Finds rules that style a class another stylesheet owns. The Wiki's and Stream's lint scripts run it over their own
// sheets, with the shared library's sheets as owners too.
//
// A class belongs to the sheet that declares it in a selector of one compound, such as `.wiki-footer-main` or
// `.wiki-footer-main[data-open]:hover`; a class two sheets declare belongs to neither. A class no sheet declares that way
// belongs to the library's sheets that name it, or else to every sheet that names it, so a modifier only ever written
// in context (`.wiki-feedback-trigger.with-label`) is not caught.
// A rule styles the classes of its subject, the last compound of its selector that names a class:
// `.wiki-hero-card .wiki-hero-glyph` styles the glyph, `.cp-tabs button::after` styles the tabs. Classes inside
// `:has()` and `:not()` only choose where the rule applies.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

export type Sheet = { path: string; text: string }

/** One rule that styles classes of other sheets: `classes` are the other sheets' classes it styles. */
export type ForeignRule = { sheet: string; line: number; selector: string; classes: string[]; owners: string[] }

type Selector = { sheet: string; line: number; text: string; compounds: string[] }

/** Every .css file under `folder`, read. */
export function sheets(folder: string): Sheet[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name)
    if (statSync(path).isDirectory()) return sheets(path)
    return name.endsWith(".css") ? [{ path, text: readFileSync(path, "utf8") }] : []
  })
}

/** At-rules whose blocks hold style rules; the others (@keyframes, @font-face, @theme…) hold no selectors. */
const GROUPING = new Set(["media", "supports", "layer", "container"])

/** The selectors of every style rule, with the line it starts on. Comments and strings are skipped. */
function selectors(sheet: Sheet, name: string): Selector[] {
  const text = sheet.text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
  const found: Selector[] = []
  const blocks: boolean[] = []
  let start = 0
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === '"' || char === "'") {
      index = text.indexOf(char, index + 1)
      if (index < 0) break
    } else if (char === "{") {
      const prelude = text.slice(start, index)
      const inert = blocks.includes(false)
      const at = prelude.trim().match(/^@([\w-]+)/)
      if (at) blocks.push(!inert && GROUPING.has(at[1]!))
      else {
        if (!inert) {
          const line = text.slice(0, start + prelude.length - prelude.trimStart().length).split("\n").length
          for (const part of split(prelude, ","))
            found.push({ sheet: name, line, text: part.replace(/\s+/g, " "), compounds: split(part, " >+~") })
        }
        blocks.push(false)
      }
      start = index + 1
    } else if (char === "}") {
      blocks.pop()
      start = index + 1
    } else if (char === ";") start = index + 1
  }
  return found
}

/** Splits at any of `separators` outside parentheses and brackets, dropping empty parts. A space means any space. */
function split(text: string, separators: string) {
  const parts = [""]
  let depth = 0
  for (const char of text) {
    if (char === "(" || char === "[") depth++
    else if (char === ")" || char === "]") depth--
    if (depth === 0 && (separators.includes(char) || (separators.includes(" ") && /\s/.test(char)))) parts.push("")
    else parts[parts.length - 1] += char
  }
  return parts.map((part) => part.trim()).filter(Boolean)
}

/** Classes named in a compound. `direct` leaves out every bracket; otherwise only `:has()` and `:not()` are left out. */
function classes(compound: string, direct = false) {
  let kept = ""
  let depth = 0
  let skipFrom = -1
  for (let index = 0; index < compound.length; index++) {
    const char = compound[index]
    if (char === "(" || char === "[") {
      if (skipFrom < 0 && (direct || char === "[" || /:(has|not)$/.test(compound.slice(0, index)))) skipFrom = depth
      depth++
    } else if (char === ")" || char === "]") {
      depth--
      if (depth === skipFrom) {
        skipFrom = -1
        continue
      }
    }
    if (skipFrom < 0) kept += char
  }
  // Only prefixed names count: `dark` and other single words are states set by libraries, not a sheet's own classes.
  return [...kept.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((match) => match[1]!).filter((name) => name.includes("-"))
}

/**
 * The classes a rule styles, and whether owning one of them is enough: `.theirs.mine` styles the sheet's own element,
 * while each choice of `:is(.mine, .theirs)` is an element of its own.
 */
function subject(selector: Selector) {
  const compound = selector.compounds.findLast((part) => classes(part).length > 0)
  if (!compound) return { styled: [], anyOwned: true }
  const direct = classes(compound, true)
  return direct.length > 0 ? { styled: direct, anyOwned: true } : { styled: classes(compound), anyOwned: false }
}

/**
 * The rules of `checked` that style a class another sheet owns, including a declaration of a class another sheet
 * declares too. `owners` only lend their classes, such as the shared library's sheets. Paths are relative to `root`.
 */
export function foreignRules(checked: Sheet[], owners: Sheet[], root: string): ForeignRule[] {
  const name = (sheet: Sheet) => relative(root, sheet.path).replaceAll("\\", "/")
  const all = [...checked, ...owners].flatMap((sheet) => selectors(sheet, name(sheet)))

  const declared = new Map<string, Set<string>>()
  const named = new Map<string, Set<string>>()
  const add = (map: Map<string, Set<string>>, key: string, sheet: string) =>
    map.set(key, (map.get(key) ?? new Set()).add(sheet))
  for (const selector of all) {
    for (const compound of selector.compounds) for (const owned of classes(compound)) add(named, owned, selector.sheet)
    // `:where(.wiki-image)` declares the class too, without weight.
    const only = selector.compounds.length === 1 ? selector.compounds[0]! : null
    const base = only ? (classes(only, true).length > 0 ? classes(only, true) : classes(only)) : []
    if (base.length === 1) add(declared, base[0]!, selector.sheet)
  }
  const own = new Set(checked.map(name))
  // A class only named in context belongs to the shared library when the library names it: its components set it.
  const lent = (owned: string) => [...named.get(owned)!].filter((sheet) => !own.has(sheet))
  const owner = (owned: string) => {
    const declarers = declared.get(owned)
    if (declarers) return [...declarers]
    return lent(owned).length > 0 ? lent(owned) : [...named.get(owned)!]
  }

  const found: ForeignRule[] = []
  for (const selector of all) {
    if (!own.has(selector.sheet)) continue
    const { styled, anyOwned } = subject(selector)
    const others = (owned: string) => owner(owned).filter((sheet) => sheet !== selector.sheet)
    const mine = (owned: string) => others(owned).length < owner(owned).length
    // A class two sheets declare belongs to neither of them; one no sheet declares belongs to every sheet naming it.
    const shared = (owned: string) => declared.has(owned) && mine(owned) && others(owned).length > 0
    const foreign = anyOwned
      ? styled.some((owned) => mine(owned) && !shared(owned))
        ? []
        : styled
      : styled.filter((owned) => !mine(owned) || shared(owned))
    if (foreign.length === 0) continue
    const { sheet, line, text } = selector
    found.push({ sheet, line, selector: text, classes: foreign, owners: [...new Set(foreign.flatMap(others))] })
  }
  return found
}

/** How a known restyle is written in a package's list: the sheet, then the class it styles. */
export const restyleKey = (sheet: string, owned: string) => `${sheet} .${owned}`

export const RESTYLE_HINT =
  "Move the variation to the sheet that declares the class, behind a modifier its component sets: a prop that " +
  "writes a data attribute or a modifier class, or a custom property the owning sheet reads."

/**
 * The foreign rules of the sheets under `source`, minus the `known` ones, by sheet path; and the known entries that
 * no rule matches any more. The sheets under `library` lend their classes without being checked.
 */
export function newRestyles(source: string, library: string | null, known: readonly string[]) {
  const listed = new Set(known)
  const used = new Set<string>()
  const offenders = new Map<string, string[]>()
  for (const rule of foreignRules(sheets(source), library ? sheets(library) : [], source)) {
    const keys = rule.classes.map((owned) => restyleKey(rule.sheet, owned))
    keys.filter((key) => listed.has(key)).forEach((key) => used.add(key))
    if (keys.every((key) => listed.has(key))) continue
    const path = join(source, rule.sheet)
    const owners = rule.owners.map((owner) => owner.replace(/^(\.\.\/)+packages\/ui\/src\//, "@aov/ui/"))
    const detail = `:${rule.line} ${rule.selector}  (owned by ${owners.join(", ")})`
    offenders.set(path, [...(offenders.get(path) ?? []), detail])
  }
  return { offenders, stale: known.filter((key) => !used.has(key)) }
}
