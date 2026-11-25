import type { CompetitionView } from "@aov/community-contracts"
import { competitionChampion, type Champion, type ChampionTeam } from "./champion-model.ts"
import { competitionStatus } from "./competition-model.ts"
import { seasonRows } from "./directory-model.ts"

export type HonourSeason = {
  view: CompetitionView
  /** Who won it, once it is over and the winner is known. */
  champion: Champion | null
  /** Its qualifiers, wildcards and show matches. */
  parts: CompetitionView[]
}

/** The seasons of one year, newest first; a year that is not known comes last. */
export type HonourYear = { year: number | null; seasons: HonourSeason[] }

export type TitleCount = { team: ChampionTeam; count: number }

const yearOf = ({ content: { tournament } }: CompetitionView) =>
  tournament.year ?? (Number(tournament.startsOn?.slice(0, 4)) || null)

/** A circuit's seasons year by year with the champion of each, and the teams by how many of them they won. */
export function circuitHonours(views: CompetitionView[]): { years: HonourYear[]; titles: TitleCount[] } {
  const years: HonourYear[] = []
  const titles = new Map<string, TitleCount>()
  const rows = seasonRows(views)
  rows.forEach(({ view, part }, at) => {
    if (part) return
    const after = rows.findIndex((row, index) => index > at && !row.part)
    const parts = rows.slice(at + 1, after < 0 ? undefined : after).map((row) => row.view)
    const champion = competitionStatus(view.content) === "FINISHED" ? competitionChampion(view) : null
    const year = yearOf(view)
    const known = years.find((item) => item.year === year)
    if (known) known.seasons.push({ view, champion, parts })
    else years.push({ year, seasons: [{ view, champion, parts }] })
    if (champion) {
      const key = champion.winner.id ?? champion.winner.name.toLocaleLowerCase()
      const counted = titles.get(key)
      // The seasons come newest first, so a team keeps the name and the logo it has now.
      titles.set(key, { team: counted?.team ?? champion.winner, count: (counted?.count ?? 0) + 1 })
    }
  })
  return {
    years: years.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
    titles: [...titles.values()].sort((a, b) => b.count - a.count),
  }
}
