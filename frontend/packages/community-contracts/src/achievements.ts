import type { ProfileAchievement } from "./pages"

/** A final standing: the place, and the last place when it is shared ("5-8" is 5 to 8). */
export type AchievementStanding = { place: number; placeTo: number | null }
/** How an achievement ranks: a final standing or an individual award. */
export type AchievementRank = AchievementStanding | "AWARD"

/** Lower case without tone marks, single spaces and plain hyphens, so both languages and every dash read alike. */
const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim()

const standing = (place: number, placeTo: number | null = null): AchievementStanding => ({ place, placeTo })

/** Words that name a place on their own, in Vietnamese and in English. */
const NAMED_PLACES: [RegExp, AchievementStanding][] = [
  [/^(?:nha )?(?:vo dich|quan quan)$|^champions?$|^winners?$|^first(?: place)?$|^hang nhat$/, standing(1)],
  [/^a quan$|^runners?-? ?up$|^second(?: place)?$|^hang nhi$/, standing(2)],
  [/^third(?: place)?$|^hang ba$/, standing(3)],
  [/^fourth(?: place)?$|^hang (?:tu|bon)$/, standing(4)],
  [/^semi-? ?finalists?$|^ban ket$/, standing(3, 4)],
  [/^quarter-? ?finalists?$|^tu ket$/, standing(5, 8)],
]

/**
 * A place as a number or an ordinal ("5", "5th", "5th place"), optionally shared with a last place ("5-8", "5th-8th"),
 * also after the folded Vietnamese words for place and shared place ("hang 5-8", "dong hang 3").
 */
const NUMBERED_PLACE =
  /^(?:dong )?(?:hang )?(\d{1,3})(?:st|nd|rd|th)?(?:-(?:hang )?(\d{1,3})(?:st|nd|rd|th)?)?(?: place)?$/
/** "Top 8" is the shared standing of everyone out before the last four, as brackets count it: 5 to 8. */
const TOP = /^top (\d{1,3})$/

/**
 * Reads a final standing from the way it was written, in Vietnamese or English. Returns null for anything else, such
 * as an individual award ("MVP").
 */
export function readStanding(wording: string): AchievementStanding | null {
  const text = fold(wording)
  const named = NAMED_PLACES.find(([pattern]) => pattern.test(text))
  if (named) return named[1]
  const numbered = NUMBERED_PLACE.exec(text)
  if (numbered) {
    const place = Number(numbered[1])
    const placeTo = numbered[2] ? Number(numbered[2]) : null
    if (place < 1 || (placeTo != null && placeTo <= place)) return null
    return standing(place, placeTo)
  }
  const top = TOP.exec(text)
  const size = top ? Number(top[1]) : 0
  // Only a bracket size names a band of places; "top 6" or "top 1" says nothing a reader can trust.
  if (size >= 4 && (size & (size - 1)) === 0) return standing(size / 2 + 1, size)
  return null
}

/**
 * How an achievement ranks: its stored rank, or for a record written before ranks, its wording read by `readStanding`.
 * Wording that names no standing counts as an award, as it did before ranks existed.
 */
export function achievementRank(
  item: Pick<ProfileAchievement, "placement" | "place" | "placeTo" | "award">,
): AchievementRank {
  if (item.award) return "AWARD"
  if (item.place != null) return standing(item.place, item.placeTo ?? null)
  return readStanding(item.placement) ?? "AWARD"
}

/** Orders ranks best first: lower places first, an exact place before a shared one, awards after every standing. */
export function compareAchievementRanks(a: AchievementRank, b: AchievementRank) {
  if (a === "AWARD" || b === "AWARD") return (a === "AWARD" ? 1 : 0) - (b === "AWARD" ? 1 : 0)
  return a.place - b.place || (a.placeTo ?? a.place) - (b.placeTo ?? b.place)
}
