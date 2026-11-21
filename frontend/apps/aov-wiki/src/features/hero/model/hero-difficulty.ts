/**
 * Where a difficulty rating falls on the five words a reader is given, from 1 (very easy) to 5 (very hard), whatever
 * scale the rating was recorded on. A half step rounds up, to the harder word.
 */
export function difficultyLevel(value: number, maximum: number) {
  return Math.min(5, Math.max(1, Math.round((value / maximum) * 5)))
}
