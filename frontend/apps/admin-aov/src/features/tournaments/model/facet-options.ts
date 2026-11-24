/** How many rows each value of a filter would leave beside the search and the other filters. */
export type FacetCounts = Readonly<Record<string, number>>

/** One choice of a filter: its value and what the list calls it, with its count. */
export type FacetOption = readonly [value: string, label: string]

/**
 * The choices worth offering for a filter: only values that find something, so no choice leads to an empty list. The
 * chosen value always stays, even when the other filters leave nothing of it, so the filter can show what it is set to.
 * `order` puts known values first in that order; the others follow by name, or by `compare`.
 */
export function facetOptions(
  counts: FacetCounts | undefined,
  chosen: string,
  labelOf: (value: string) => string,
  {
    order = [],
    compare = (a, b) => labelOf(a).localeCompare(labelOf(b), "vi"),
  }: { order?: readonly string[]; compare?: (a: string, b: string) => number } = {},
): FacetOption[] {
  const values = Object.keys(counts ?? {}).filter((value) => counts![value]! > 0)
  if (chosen && !values.includes(chosen)) values.push(chosen)
  const place = (value: string) => (order.includes(value) ? order.indexOf(value) : order.length)
  return values
    .sort((a, b) => place(a) - place(b) || compare(a, b))
    .map((value) => [value, counts ? `${labelOf(value)} (${counts[value] ?? 0})` : labelOf(value)])
}
