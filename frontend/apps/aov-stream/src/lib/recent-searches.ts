import { withSearch } from "./search-model.ts"

const key = "aov-stream-recent-searches"

/** What this reader searched for last on this device, newest first. Storage is optional: without it there are none. */
export function readRecentSearches(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) || "[]")
    return Array.isArray(stored) ? stored.filter((entry): entry is string => typeof entry === "string").slice(0, 6) : []
  } catch {
    return []
  }
}

export function rememberSearch(search: string) {
  try {
    localStorage.setItem(key, JSON.stringify(withSearch(readRecentSearches(), search)))
  } catch {
    /* The search still runs without a history. */
  }
}

export function forgetSearches() {
  try {
    localStorage.removeItem(key)
  } catch {
    /* Nothing was kept. */
  }
}
