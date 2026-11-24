import { profileSlug } from "@/features/community/model/profile-slug"

/** A season word and the one that follows it; `newYear` when that next season belongs to the year after. */
const NEXT_SEASON: Record<string, { next: string; newYear?: boolean }> = {
  xuân: { next: "Đông" },
  hè: { next: "Đông" },
  đông: { next: "Xuân", newYear: true },
  spring: { next: "Summer" },
  summer: { next: "Winter" },
  fall: { next: "Spring", newYear: true },
  autumn: { next: "Spring", newYear: true },
  winter: { next: "Spring", newYear: true },
}
const YEAR = /(?<!\d)20\d\d(?!\d)/g
const SEASON_WORD = /(?<=Mùa )(Xuân|Hè|Đông)(?!\p{L})|(?<!\p{L})(Spring|Summer|Fall|Autumn|Winter)(?!\p{L})/iu
const SEASON_NUMBER = /((?:Mùa|Season)\s+|(?<!\p{L})S)(\d{1,2})(?!\d)/iu

/**
 * The name proposed for the season after `name`: a season word moves on to the next one (spring 2026, then the second
 * split of 2026, then spring 2027), a plain year goes up by one, and a numbered season without a year goes up by one.
 * The editor can still rewrite it.
 */
export function nextSeasonName(name: string, year?: number) {
  const bumpYears = (text: string) => text.replace(YEAR, (value) => String(Number(value) + 1))
  const named = new RegExp(YEAR.source).test(name)

  const season = SEASON_WORD.exec(name)
  if (season && named) {
    const { next, newYear } = NEXT_SEASON[season[0].toLocaleLowerCase()]!
    const renamed = name.slice(0, season.index) + next + name.slice(season.index + season[0].length)
    return newYear ? bumpYears(renamed) : renamed
  }
  if (named) return bumpYears(name)
  if (SEASON_NUMBER.test(name))
    return name.replace(SEASON_NUMBER, (_, word: string, number: string) => `${word}${Number(number) + 1}`)
  return year ? `${name} ${year + 1}` : name
}

/** The year a name speaks of: its last one, so "2025-2026" reads as 2026. */
export const yearInName = (name: string) => name.match(YEAR)?.at(-1) ?? ""

/** The code suggested for a tournament name; null when the name has letters the code cannot carry. */
export const tournamentSlug = (name: string) => profileSlug(name.replace(/[–—‘’“”·]/g, " "))
