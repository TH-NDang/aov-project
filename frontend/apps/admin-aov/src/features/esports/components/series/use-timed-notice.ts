import { useCallback, useEffect, useState } from "react"

/**
 * A note that clears itself `ms` after it is shown, such as what a key did or the undo of a move. Each showing is a
 * new note with its own id, even with the same text, so it is drawn and timed afresh.
 */
export function useTimedNotice<T extends object>(ms: number) {
  const [notice, setNotice] = useState<(T & { id: number }) | null>(null)
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), ms)
    return () => window.clearTimeout(timer)
  }, [notice, ms])
  const show = useCallback((value: T) => setNotice({ ...value, id: Date.now() }), [])
  const clear = useCallback(() => setNotice(null), [])
  return [notice, show, clear] as const
}

/** How long a quick change can be put back with one click. */
const UNDO_MS = 8000

/**
 * The undo of the last quick change of a game, such as a marker moved on the bar or a moment removed. The saver
 * belongs to the focused game, so a change can only be undone while that game is still the focused one.
 */
export function useUndoNotice(focusedGameId: string | undefined) {
  const [undo, offer, clear] = useTimedNotice<{ gameId: string; text: string; revert: () => void }>(UNDO_MS)
  const undoGame = undo?.gameId
  useEffect(() => {
    if (undoGame && undoGame !== focusedGameId) clear()
  }, [undoGame, focusedGameId, clear])
  return [undo, offer, clear] as const
}
