import { useEffect, useState } from "react"

/**
 * Playhead that survives reloads: a shared `?t=` link wins, otherwise the last position this browser watched.
 * Stored per game in localStorage as a viewer convenience only.
 */
export function useSavedPlayhead(gameId: string, fromLink: number | null, initialSecond = 0) {
  const key = `aov-esports:playhead:v1:${gameId}`
  const [at, setAt] = useState(() => {
    if (fromLink !== null) return fromLink
    try {
      const value = localStorage.getItem(key)
      const saved = value === null ? initialSecond : Number(value)
      return Number.isFinite(saved) && saved >= 0 ? saved : initialSecond
    } catch {
      return initialSecond
    }
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(key, String(Math.round(at)))
      } catch {
        // Private mode or blocked storage: progress simply is not remembered.
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [key, at])

  return [at, setAt] as const
}
