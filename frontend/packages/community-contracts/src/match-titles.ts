/** What a match is in its stage. See spec 04, match titles. */
export type MatchTitleKind =
  | "ROUND_ROBIN"
  | "UPPER_SEMIFINAL"
  | "UPPER_FINAL"
  | "LOWER_ROUND"
  | "LOWER_SEMIFINAL"
  | "LOWER_FINAL"
  | "GRAND_FINAL"
  | "EXTRA"
/**
 * A match's title as a code and its numbers: `leg` and `round` for a round robin, `round` and `number` in the lower
 * bracket, `number` among the upper semifinals. Planned matches and the series they became carry the same title.
 */
export type MatchTitle = { kind: MatchTitleKind; leg?: number | null; round?: number | null; number?: number | null }
/** Picks the Vietnamese or the English words; Stream's `text` and `localeText(locale)` from `@aov/ui` both fit. */
export type TitleText = (vietnamese: string, english: string) => string

const numbered = (words: string, value?: number | null) => (value == null ? words : `${words} ${value}`)

/** Every kind in Vietnamese and in English, worded from its numbers. */
const WORDING: Record<MatchTitleKind, (title: MatchTitle) => readonly [vi: string, en: string]> = {
  ROUND_ROBIN: ({ leg, round }) => {
    const rounds = [numbered("Vòng", round), numbered("Round", round)] as const
    return leg == null ? rounds : [`Lượt ${leg} · ${rounds[0]}`, `Leg ${leg} · ${rounds[1]}`]
  },
  UPPER_SEMIFINAL: ({ number }) => [
    numbered("Bán kết nhánh thắng", number),
    numbered("Upper bracket semifinal", number),
  ],
  UPPER_FINAL: () => ["Chung kết nhánh thắng", "Upper bracket final"],
  LOWER_ROUND: ({ round, number }) => {
    const rounds = [`${numbered("Vòng", round)} nhánh thua`, numbered("Lower bracket round", round)] as const
    return number == null ? rounds : [`${rounds[0]} · ${number}`, `${rounds[1]} · ${number}`]
  },
  LOWER_SEMIFINAL: () => ["Bán kết nhánh thua", "Lower bracket semifinal"],
  LOWER_FINAL: () => ["Chung kết nhánh thua", "Lower bracket final"],
  GRAND_FINAL: () => ["Chung kết tổng", "Grand final"],
  EXTRA: () => ["Trận bổ sung", "Additional match"],
}

/** A title in the language `text` picks; a kind this app does not know yet reads as no title. */
export function matchTitleText(title: MatchTitle | null | undefined, text: TitleText): string | null {
  const wording = title ? (WORDING as Partial<typeof WORDING>)[title.kind] : undefined
  return wording ? text(...wording(title!)) : null
}

/**
 * What a planned match or a series is called: the name an editor typed, or else its title in the reader's language.
 * A record from before titles keeps the name it was stored with.
 */
export function matchName(
  match: { label?: string | null; name?: string | null; title?: MatchTitle | null },
  text: TitleText,
): string | null {
  return match.label?.trim() || match.name?.trim() || matchTitleText(match.title, text)
}
