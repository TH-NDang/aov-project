/**
 * The heroes this reader opened last, newest first, kept in this browser only so the quick switch can offer them again.
 * A convenience: where storage is missing or refused, the list is simply empty.
 */
const KEY = "wiki-recent-heroes"
const KEPT = 12

export function readRecentHeroes(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown
    return Array.isArray(value) ? value.filter((code): code is string => typeof code === "string") : []
  } catch {
    return []
  }
}

export function rememberHero(code: string) {
  try {
    const next = [code, ...readRecentHeroes().filter((entry) => entry !== code)].slice(0, KEPT)
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage refused: nothing is remembered.
  }
}
