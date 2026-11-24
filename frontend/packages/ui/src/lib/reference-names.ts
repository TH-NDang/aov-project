import type { EntityKind } from "@aov/ui/lib/reference-kinds"
import { everydayCapitals, everydayWords, gameNames, introductions, placeNames } from "@aov/ui/lib/reference-words"

/**
 * When a name in a running text (an introduction, a post, a comment) is taken for what it names. A wrong link is worse
 * than a missing one, so the shorter and plainer a name is, the more must speak for it. Game text has rules of its own:
 * there a name means the game's, in any letter case (see `createEntityIndex`).
 *
 * - `anyCase`: long enough to mean only one thing, however it is written.
 * - `written`: in the letter case of the record, or in capitals as a whole.
 * - `capitalised`: each word with a capital; other names are recorded in lower case.
 * - `code`: a short name in its capitals, outside a run of capitals.
 * - `word`: one proper noun, as recorded, that is no part of a longer name.
 * - `introduced`: only after a word that says what it is, as "team" or "hero" before the name does.
 * - `person`: introduced so, or as recorded beside one of their teams.
 * - `never`: only a reference made on purpose names it.
 */
export type NameRule = "anyCase" | "written" | "capitalised" | "code" | "word" | "introduced" | "person" | "never"

/** What a name is to its record: its name, its short name or another name it goes by. */
export type NameForm = "name" | "short" | "alias"

/** One spelling of dashes, apostrophes and spaces, so a name is found however the text types them. */
export const plainPunctuation = (text: string) =>
  text
    .normalize("NFC")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/\s/g, " ")

const wordCount = (name: string) => name.split(/\s+/).length
const gameKinds: ReadonlySet<EntityKind> = new Set(["item", "enchantment", "arcana", "spell", "mode"])

/** One word: capitals are a code, a shape no ordinary word has stands for itself, anything else needs introducing. */
function oneWordRule(name: string): NameRule {
  const letters = name.match(/\p{L}/gu)?.length ?? 0
  const capitals = name.match(/\p{Lu}/gu)?.length ?? 0
  if (/^[\p{Lu}\p{N}]+$/u.test(name))
    return name.length >= 3 && letters >= 2 && !everydayCapitals.has(name) ? "code" : "introduced"
  const unlikeAWord = capitals >= 2 || (capitals >= 1 && /\p{N}/u.test(name))
  return letters >= 3 && unlikeAWord ? "written" : "introduced"
}

/** "First Blood" and "Game Over" are teams too; a name that says it is a team, or shouts, is not such a phrase. */
const everydayPhrase = (name: string) =>
  name
    .split(/\s+/)
    .every((word) => !/^team$/i.test(word) && !/\p{Lu}{2}/u.test(word) && everydayWords.has(word.toLowerCase()))

export function nameRule(kind: EntityKind, name: string, form: NameForm = "name"): NameRule {
  const text = name.trim()
  // A name of digits reads as a number; one that opens with a sign cannot be told from the sign.
  if (!/\p{L}/u.test(text) || !/^[\p{L}\p{N}]/u.test(text) || gameNames.has(text.toLowerCase())) return "never"
  if (placeNames.has(text.toLowerCase())) return "introduced"
  const words = wordCount(text)
  if (kind === "player" || kind === "person") return [...text].length > 1 ? "person" : "never"
  if (kind === "hero")
    return words > 1
      ? "written"
      : form === "alias"
        ? "never"
        : everydayWords.has(text.toLowerCase())
          ? "introduced"
          : "word"
  if (gameKinds.has(kind))
    return words > 2 ? "anyCase" : words === 2 && /\s\p{Lu}/u.test(text) ? "written" : "introduced"
  if (kind === "team") {
    if (words === 1) return form === "alias" ? "never" : oneWordRule(text)
    if (everydayPhrase(text)) return "introduced"
    return form === "alias" ? "capitalised" : /\p{Lu}/u.test(text) ? "written" : "introduced"
  }
  return words > 2 ? "anyCase" : words === 2 ? "written" : oneWordRule(text)
}

/** What stands around a name in its text. */
export type NameSurroundings = {
  before: string
  after: string
  /** The words right before are already a reference, so they are no part of this name. */
  afterReference: boolean
  /** A short name the records know, which a run of capitals may hold. */
  isCode: (word: string) => boolean
}

const wordBefore = (text: string) => text.match(/([\p{L}\p{M}\p{N}_'’.-]+)[^\S\n]+$/u)?.[1] ?? ""
const wordAfter = (text: string) => text.match(/^[^\S\n]+([\p{L}\p{M}\p{N}_'’.-]+)/u)?.[1] ?? ""

const introducedBy = new Map<string, RegExp>()

/** Whether the words right before a name say what kind of thing it is. */
export function isIntroduced(kind: EntityKind, before: string) {
  const words = introductions[kind]
  if (!words) return false
  let pattern = introducedBy.get(kind)
  if (!pattern) {
    pattern = new RegExp(`(?:^|[^\\p{L}\\p{M}\\p{N}_])(?:${words})[^\\S\\n]*:?[^\\S\\n]+["“'‘«(]?$`, "iu")
    introducedBy.set(kind, pattern)
  }
  return pattern.test(before.normalize("NFC"))
}

/** A capital on either side makes a name part of a longer one, unless that word only opens the sentence. */
function standsAlone({ before, after, afterReference }: NameSurroundings) {
  const joins = (word: string) => /^\p{Lu}/u.test(word) && !everydayWords.has(word.toLowerCase())
  return !(!afterReference && joins(wordBefore(before))) && !joins(wordAfter(after))
}

/** Inside a run of capitals, a heading say, a short name is written like every other word. */
function inCapitals({ before, after, isCode }: NameSurroundings) {
  const shouts = (word: string) =>
    /^\p{Lu}[\p{Lu}\p{N}]+$/u.test(word) && !everydayCapitals.has(word) && word !== "VS" && !isCode(word)
  return shouts(wordBefore(before)) || shouts(wordAfter(after))
}

/** How sure the text is of a name: a word that says what it is outweighs everything else. */
export type NameStrength = "introduced" | "plain"

export type RecognizableName = { kind: EntityKind; written: string; rule: NameRule }

/**
 * Whether `label`, found in a text, names `name`. `beside` says that a team of theirs is named in the same paragraph,
 * which is what a person's name needs when nothing introduces it.
 */
export function nameStrength(
  name: RecognizableName,
  label: string,
  around: NameSurroundings,
  beside: () => boolean,
): NameStrength | undefined {
  const text = plainPunctuation(label)
  const asRecorded = text === name.written
  const introduced = () => isIntroduced(name.kind, around.before)
  switch (name.rule) {
    case "anyCase":
      return "plain"
    case "written":
      return asRecorded || (text.includes(" ") && text === name.written.toUpperCase()) ? "plain" : undefined
    case "capitalised":
      return text.split(" ").every((word) => /^[\p{Lu}\p{N}]/u.test(word)) ? "plain" : undefined
    case "code":
      return asRecorded && !inCapitals(around) ? "plain" : undefined
    case "word":
      if (!asRecorded) return
      return introduced() ? "introduced" : standsAlone(around) ? "plain" : undefined
    case "introduced":
      return (asRecorded || gameKinds.has(name.kind)) && introduced() ? "introduced" : undefined
    case "person":
      if (!asRecorded) return
      if (introduced()) return "introduced"
      return [...text].length > 2 &&
        !everydayWords.has(text.toLowerCase()) &&
        !everydayCapitals.has(text) &&
        standsAlone(around) &&
        beside()
        ? "plain"
        : undefined
    default:
      return
  }
}

/** Web and e-mail addresses; a domain without a path may be a name, as "Hubber.gg" is. */
export const addressPattern =
  /(?:https?:\/\/|www\.)[^\s<>"“”]+|[\p{L}\p{N}._+-]+@[\p{L}\p{N}-]+\.[\p{L}\p{N}.-]+|(?<![\p{L}\p{N}_/@.-])(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?\/[^\s<>"“”]*/giu

/** An address without the punctuation of the sentence around it. */
export const trimAddress = (address: string) => address.replace(/[.,;:!?…'’)\]}»]+$/u, "")
