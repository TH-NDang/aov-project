import { gamesText } from "./feed-words.ts"
import { percent } from "./hero-model.ts"

type Say = (vi: string, en: string) => string

/** The games a share is written from, or a chart is drawn of; of fewer only the games themselves are told. */
export const ENOUGH_FOR_SHARE = 10

/**
 * A share in whole percent that says no more than is true: "100" is nothing short of all, and a share that belongs under
 * a limit stays under it.
 */
export function wholePercent(part: number, whole: number, below: number | null = null) {
  return Math.min(percent(part, whole), part < whole ? Math.min(below ?? 100, 100) - 1 : 100)
}

/** A share as a figure; one too small for a whole percent says so instead of reading as nothing. */
export function shareText(part: number, whole: number, below: number | null = null) {
  const share = wholePercent(part, whole, below)
  return part > 0 && share === 0 ? "<1%" : `${share}%`
}

/** How many of some games: as a share of them, or as the games themselves where there are too few for one. */
export const shareOrGames = (part: number, whole: number, text: Say, languageTag: string) =>
  whole >= ENOUGH_FOR_SHARE ? shareText(part, whole) : gamesText(part, text, languageTag)

/** A share, between nothing and one, inside a sentence; one that is neither never reads as either. */
export function shareWords(share: number, text: Say): string {
  const whole = Math.round(share * 100)
  if (whole === 0 && share > 0) return text("dưới 1%", "under 1%")
  if (whole === 100 && share < 1) return text("trên 99%", "over 99%")
  return `${whole}%`
}
