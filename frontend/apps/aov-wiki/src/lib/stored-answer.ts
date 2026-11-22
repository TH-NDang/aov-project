/**
 * The last answer of a query, kept in the browser so a returning reader sees it at once while it is read again. One
 * copy is kept per kind of answer: a new scope (another market, locale or version) replaces the previous one, so the
 * store never grows. Storage that is full, blocked or missing (a private window, the prerender job) simply keeps nothing.
 */

/** Bump when the shape of a stored answer changes, so an older copy is not read as the new one. */
const STORAGE_VERSION = 1

interface StoredCopy<T> {
  key: string
  savedAt: number
  data: T
}

function storage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

/** The stored copy of the answer named `kind` for the query `key`, read once per page load. */
export function storedAnswer<T>(kind: string, key: readonly unknown[]) {
  const name = `aov-wiki:${kind}:v${STORAGE_VERSION}`
  const identity = JSON.stringify(key)
  let read: StoredCopy<T> | null | undefined

  function copy() {
    if (read !== undefined) return read ?? undefined
    try {
      const raw = storage()?.getItem(name)
      const parsed = raw ? (JSON.parse(raw) as StoredCopy<T>) : null
      read = parsed && parsed.key === identity ? parsed : null
    } catch {
      read = null
    }
    return read ?? undefined
  }

  return {
    data: () => copy()?.data,
    savedAt: () => copy()?.savedAt,
    save(data: T) {
      const fresh: StoredCopy<T> = { key: identity, savedAt: Date.now(), data }
      read = fresh
      try {
        storage()?.setItem(name, JSON.stringify(fresh))
      } catch {
        // A full or blocked store only costs the next visit its head start.
      }
    },
  }
}
