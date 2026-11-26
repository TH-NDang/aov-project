import { useEffect } from "react"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"
import { useEntryState } from "./use-entry-state.ts"

/**
 * The rows of a list in memory to draw, `step` more each time the reader scrolls to its end. How many are drawn belongs
 * to the entry of the history, so a reader who comes back finds them all at once, the row left among them where it
 * was. `name` tells one list from another: a new order or another question starts from its first rows.
 */
export function useKeptRows<T>(rows: readonly T[], name: string, step: number) {
  const [kept, keep] = useEntryState<number>(`rows:${name}`, 0)
  const revealed = useRevealedRows(rows, name, step, kept)
  const drawn = revealed.rows.length
  useEffect(() => {
    if (drawn > Math.max(kept, step)) keep(drawn)
  }, [drawn, kept, step, keep])
  return revealed
}
