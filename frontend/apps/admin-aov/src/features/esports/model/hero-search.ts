import type { Reference } from "@aov/community-contracts"
import { compactKey, nameKey } from "./name-key"

/** A name from each of its words on, written together: the second word finds its hero too, typed spaces or not. */
function fromWords(name: string) {
  const words = nameKey(name).split(/[^a-z0-9]+/)
  return words.map((_, index) => words.slice(index).join(""))
}

/** How well a hero answers a typed key: its name begins with it, a word of it does, it holds it, its code does. */
function rank(option: Reference, key: string): number | null {
  const name = compactKey(option.name)
  if (name.startsWith(key)) return 0
  if (fromWords(option.name).some((rest) => rest.startsWith(key))) return 1
  if (name.includes(key)) return 2
  return compactKey(option.code).includes(key) ? 3 : null
}

/** The heroes that answer a typed text, the best answer first and equals in the order given; all of them without one. */
export function searchHeroes<T extends Reference>(options: T[], text: string): T[] {
  const key = compactKey(text)
  if (!key) return options
  return options
    .flatMap((option, index) => {
      const found = rank(option, key)
      return found === null ? [] : [{ option, found, index }]
    })
    .sort((a, b) => a.found - b.found || a.index - b.index)
    .map(({ option }) => option)
}

/** The hero a typed text spells out in full, whether or not the rules allow it. */
export function heroNamed<T extends Reference>(options: T[], text: string): T | null {
  const key = compactKey(text)
  if (!key) return null
  return options.find((option) => compactKey(option.name) === key || compactKey(option.code) === key) ?? null
}
