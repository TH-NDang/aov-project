import { referenceTranslation, resolveEntityRoute, type EntityReference } from "@aov/ui/lib/entity-rich-text"
import { readRunningText, type RunningTextReferences } from "@aov/ui/lib/running-text"
import { DATA_LOCALE, referenceKey } from "@aov/ui/lib/running-text-names"

/** A record Stream links, where it opens and how the text first calls it. */
export type LinkedName = { key: string; entity: EntityReference; route: string; label: string }

/** A name Stream would link if the text wrote it as `expected`. */
export type MisspelledName = { key: string; entity: EntityReference; label: string; expected: string }

export type StreamReading = { linked: LinkedName[]; misspelled: MisspelledName[] }

const MOST_MISSPELLED = 5
const MOST_TRIES = 40
const wordCharacter = /[\p{L}\p{M}\p{N}_]/u

function linkedNames(text: string, references: RunningTextReferences) {
  const linked = new Map<string, LinkedName>()
  for (const node of readRunningText(text, references)) {
    if (node.type !== "reference") continue
    const key = referenceKey(node.entity.kind, node.entity.id)
    const route = resolveEntityRoute(node.entity, "stream")
    if (route && !linked.has(key)) linked.set(key, { key, entity: node.entity, route, label: node.label })
  }
  return linked
}

/** Where `name` stands as whole words in `text`, both in lower case. */
function wholeWordsAt(text: string, name: string) {
  for (let at = text.indexOf(name); at >= 0; at = text.indexOf(name, at + 1)) {
    if (!wordCharacter.test(text[at - 1] ?? "") && !wordCharacter.test(text[at + name.length] ?? "")) return at
  }
  return -1
}

/**
 * The names a text writes in another letter case than Stream asks for. The recognizer itself decides: a name counts
 * when the text with its own spelling links it and still links everything else.
 */
function misspelledNames(text: string, references: RunningTextReferences, linked: Map<string, LinkedName>) {
  const lower = text.toLowerCase()
  const misspelled: MisspelledName[] = []
  // A few letters change length in lower case, and positions would no longer match.
  if (lower.length !== text.length) return misspelled

  let tries = 0
  for (const entity of references.entities) {
    const key = referenceKey(entity.kind, entity.id)
    const own = linked.has(key) ? undefined : referenceTranslation(entity, DATA_LOCALE)
    if (!own) continue
    for (const expected of [own.name, ...(own.shortNames ?? []), ...own.aliases]) {
      const at = wholeWordsAt(lower, expected.toLowerCase())
      const label = text.slice(at, at + expected.length)
      if (at < 0 || label === expected) continue
      if (++tries > MOST_TRIES) return misspelled
      const respelled = linkedNames(text.slice(0, at) + expected + text.slice(at + expected.length), references)
      if (!respelled.has(key) || [...linked.keys()].some((other) => !respelled.has(other))) continue
      misspelled.push({ key, entity, label, expected })
      break
    }
    if (misspelled.length === MOST_MISSPELLED) break
  }
  return misspelled
}

export function readStreamText(text: string, references: RunningTextReferences): StreamReading {
  const linked = linkedNames(text, references)
  return { linked: [...linked.values()], misspelled: misspelledNames(text, references, linked) }
}
