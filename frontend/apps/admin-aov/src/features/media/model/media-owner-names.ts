import type { MediaOwner } from "../components/media-owners"
import { normalize } from "@/lib/text"

/** Whitespace collapsed and lower case: the backend treats names equal under this as one owner. */
export function ownerKey(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase()
}

/** Letters and digits without accents, so a name typed without accents still matches. */
function folded(name: string) {
  return normalize(name)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** The owner whose name exactly matches, ignoring case and whitespace. */
export function exactOwner(name: string, owners: readonly MediaOwner[]) {
  const key = ownerKey(name)
  return key ? owners.find((owner) => ownerKey(owner.name) === key) : undefined
}

/**
 * The most used owner whose name looks like the typed one without being it: the same letters without accents, or one
 * name's words all appear in the other, e.g. "Garena" and a longer "Garena / ..." name.
 */
export function similarOwner(name: string, owners: readonly MediaOwner[]) {
  const typed = folded(name)
  if (!typed || exactOwner(name, owners)) return undefined
  const words = new Set(typed.split(" "))
  return owners.find((owner) => {
    const other = folded(owner.name)
    if (!other) return false
    if (other === typed) return true
    const otherWords = new Set(other.split(" "))
    return [...words].every((word) => otherWords.has(word)) || [...otherWords].every((word) => words.has(word))
  })
}
