/** Which rows of a list are ticked, and the row a range with Shift starts from. */
export type RowSelection = { ids: ReadonlySet<string>; anchor: string | null }

export const NO_SELECTION: RowSelection = { ids: new Set(), anchor: null }

/** The selection after a click on one row's box; with `range` every row between it and the last one clicked follows. */
export function toggledRow(
  selection: RowSelection,
  order: readonly string[],
  id: string,
  range: boolean,
): RowSelection {
  const ids = new Set(selection.ids)
  const selected = !ids.has(id)
  const from = range && selection.anchor !== null ? order.indexOf(selection.anchor) : -1
  const to = order.indexOf(id)
  const rows = from >= 0 && to >= 0 ? order.slice(Math.min(from, to), Math.max(from, to) + 1) : [id]
  for (const row of rows)
    if (selected) ids.add(row)
    else ids.delete(row)
  return { ids, anchor: id }
}

/** What a run over several rows could not change, with the reason in words. */
export type BulkFailure<T> = { item: T; error: unknown }

/**
 * Changes rows one after another, so each failure is known by itself and stops nothing else. `onProgress` hears how
 * many are behind it.
 */
export async function runOneByOne<T>(
  items: readonly T[],
  change: (item: T) => Promise<unknown>,
  onProgress: (done: number) => void = () => {},
): Promise<BulkFailure<T>[]> {
  const failures: BulkFailure<T>[] = []
  for (const [index, item] of items.entries()) {
    onProgress(index)
    try {
      await change(item)
    } catch (error) {
      failures.push({ item, error })
    }
  }
  onProgress(items.length)
  return failures
}
