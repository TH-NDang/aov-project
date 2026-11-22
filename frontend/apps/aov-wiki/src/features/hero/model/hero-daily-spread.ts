/**
 * Which heroes the library's portrait wall shows today: `count` places out of `total`, spread across the whole list
 * by a stride that shares no factor with it, starting at a place set by the day. Every hero comes round over the days,
 * and the wall does not line up neighbours in alphabetical order.
 */
export function dailySpread(total: number, day: number, count: number): number[] {
  if (total <= 0) return []
  const stride = strideFor(total)
  const start = (((day * 7) % total) + total) % total
  return Array.from({ length: Math.min(count, total) }, (_, index) => (start + index * stride) % total)
}

/** The first number from about a third of the list up that shares no factor with its length. */
function strideFor(total: number) {
  for (let stride = Math.max(1, Math.round(total / 3)); stride < total + Math.round(total / 3); stride++) {
    if (greatestCommonDivisor(stride, total) === 1) return stride
  }
  return 1
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b)
}
