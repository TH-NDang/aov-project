/**
 * How many columns a grid of `count` cards takes when it may use `limit` at most: rows that come out full where a
 * count allows it, and never a card alone on the last row where another count avoids it.
 */
function fillColumns(count: number, limit: number) {
  const most = Math.max(1, Math.min(limit, count))
  if (count % most === 0) return most
  if (most > 2 && count % (most - 1) === 0) return most - 1
  for (let columns = most; columns > 1; columns--) if (count % columns !== 1) return columns
  return most
}

/** The column counts for the widths a `data-fill` grid is laid out at; its stylesheet picks one by the room it has. */
export function fillStyle(count: number) {
  return {
    "--fill-2": fillColumns(count, 2),
    "--fill-3": fillColumns(count, 3),
    "--fill-4": fillColumns(count, 4),
  } as Record<string, number>
}
