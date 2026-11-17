import { formatGameNumber } from "@aov/ui/lib/game-number"

/**
 * The stat as the game shows it, such as "150 | 20%", whatever the reader's locale. A percent nobody recorded stays
 * out.
 */
export function statText(stat: { baseValue: number | null; percentValue?: number | null }) {
  const number = stat.baseValue == null ? "" : formatGameNumber(stat.baseValue)
  return stat.percentValue == null ? number : `${number} | ${formatGameNumber(stat.percentValue)}%`
}
