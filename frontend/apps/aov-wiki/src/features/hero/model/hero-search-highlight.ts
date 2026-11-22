/** A letter as the search compares it: without accents, the crossed d as a plain d, in lower case. */
function foldLetter(letter: string) {
  return letter.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase()
}

/**
 * Where a search shows in a name, as the start and end of the matching part of the name itself, so the name can be lit
 * there with its own accents kept. The search is compared as the library compares it, without accents; nothing is
 * returned when the name does not hold it.
 */
export function searchMatchRange(name: string, search: string): [number, number] | undefined {
  const needle = [...search.trim()].map(foldLetter).join("")
  if (!needle) return undefined
  // Each folded character remembers where its letter starts and ends in the name.
  let folded = ""
  const starts: number[] = []
  const ends: number[] = []
  let offset = 0
  for (const letter of name) {
    const plain = foldLetter(letter)
    folded += plain
    for (let index = 0; index < plain.length; index++) {
      starts.push(offset)
      ends.push(offset + letter.length)
    }
    offset += letter.length
  }
  const at = folded.indexOf(needle)
  return at < 0 ? undefined : [starts[at]!, ends[at + needle.length - 1]!]
}
