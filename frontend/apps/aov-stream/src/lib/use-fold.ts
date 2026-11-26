import { useEntryState } from "./use-entry-state.ts"

/** Whether a list is long enough to fold, whether it is unfolded, and the way to change that. */
export type Fold = { folds: boolean; open: boolean; toggle: () => void }

/**
 * The first rows of a list until the reader asks for all of them, which the page remembers by the name of the list when
 * the reader comes back; a list called by another `name` starts folded. One row more than fits is shown rather than folded
 * away behind a button of its own height.
 */
export function useFold<T>(rows: T[], limit: number, name: string) {
  const [open, setOpen] = useEntryState<boolean>(`fold:${name}`, false)
  const folds = rows.length > limit + 1
  const whole = !folds || open
  return {
    folds,
    open,
    whole,
    /** How many rows are folded away. */
    rest: whole ? 0 : rows.length - limit,
    rows: whole ? rows : rows.slice(0, limit),
    toggle: () => setOpen(!open),
  }
}
