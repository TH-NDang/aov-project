/**
 * `getNextPageParam` for endpoints that answer with a page slice. An empty page ends the list whatever the total says,
 * so automatic loading can never keep asking for pages that hold nothing.
 */
export function nextPageOf(last: { items: readonly unknown[]; page: number; size: number; totalElements: number }) {
  return last.items.length > 0 && (last.page + 1) * last.size < last.totalElements ? last.page + 1 : undefined
}
