/**
 * How well a hero's names answer a search, all of them already folded as the library folds text (no accents, lower
 * case): 0 when a name starts with it, 1 when a word inside a name does, 2 when it only shows somewhere in a name, and
 * undefined when it is not there. A lower number comes first in the results.
 */
export function heroSearchRank(names: readonly string[], needle: string): 0 | 1 | 2 | undefined {
  if (!needle) return 0
  let best: 0 | 1 | 2 | undefined
  for (const name of names) {
    if (name.startsWith(needle)) return 0
    if (name.split(/[\s'’-]+/).some((word) => word.startsWith(needle))) best = 1
    else if (best === undefined && name.includes(needle)) best = 2
  }
  return best
}
