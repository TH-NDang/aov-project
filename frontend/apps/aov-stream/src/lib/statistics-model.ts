import type { CompetitionStatistics, HeroCount } from "@aov/community-contracts"

export type HeroSort = "presence" | "picks" | "wins" | "bans"

export type HeroLine = HeroCount & {
  /** What the address calls the hero: its id, or the name of one recorded without an id. */
  key: string
  /** The games it was picked or banned in. */
  presence: number
  /** The share of its picks it won; null when it was never picked. */
  winRate: number | null
}

/** Where a hero's games open; a hero recorded without an id has none to filter by. */
export const heroHref = (competitionId: string, hero: Pick<HeroLine, "id">) =>
  `/competitions/${competitionId}?tab=stats&hero=${hero.id}`

/** A share in whole percent, the way a table of heroes reads. */
export const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

export function heroLines({ heroes }: Pick<CompetitionStatistics, "heroes">): HeroLine[] {
  return heroes.map((hero) => ({
    ...hero,
    key: hero.id ?? hero.name,
    presence: hero.picks + hero.bans,
    winRate: hero.picks > 0 ? hero.wins / hero.picks : null,
  }))
}

/**
 * The picks a win rate needs before it says something: one game in twenty, and five at least. A hero picked once and
 * won once is no champion of its competition.
 */
export const enoughPicks = (games: number) => Math.max(5, Math.ceil(games / 20))

const ORDER: Record<HeroSort, (line: HeroLine) => number> = {
  presence: (line) => line.presence,
  picks: (line) => line.picks,
  wins: (line) => line.winRate ?? -1,
  bans: (line) => line.bans,
}

/** Heroes from the most to the fewest; by win rate, those with too few picks for one come after the others. */
export function sortHeroes(lines: HeroLine[], sort: HeroSort, games: number): HeroLine[] {
  const enough = (line: HeroLine) => Number(sort !== "wins" || line.picks >= enoughPicks(games))
  return [...lines].sort(
    (a, b) =>
      enough(b) - enough(a) ||
      ORDER[sort](b) - ORDER[sort](a) ||
      b.presence - a.presence ||
      b.picks - a.picks ||
      a.name.localeCompare(b.name),
  )
}

/** The heroes that lead a competition: the most picked, the most banned and the one that won the most of its picks. */
export function heroLeaders(lines: HeroLine[], games: number) {
  const first = (sort: HeroSort, counts: (line: HeroLine) => boolean) =>
    sortHeroes(lines.filter(counts), sort, games)[0] ?? null
  return {
    picked: first("picks", (line) => line.picks > 0),
    banned: first("bans", (line) => line.bans > 0),
    winning: first("wins", (line) => line.picks >= enoughPicks(games)),
  }
}
