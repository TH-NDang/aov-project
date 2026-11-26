import { useMemo } from "react"
import { useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { CompetitionView } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import { countGames, feedScope, gameFeed, heroByKey } from "../../../lib/game-feed"
import { heroRecords } from "../../../lib/hero-model"
import { statsPlace } from "../../../lib/statistics-routes"
import { teamRecords, type TeamRecord } from "../../../lib/team-draft-model"
import { lineupsQuery } from "../../../lib/tournament-api"
import type { StatsData } from "./stats-data"
import { StatsGames } from "./stats-games"
import { StatsHero } from "./stats-hero"
import { StatsHeroes } from "./stats-heroes"
import { StatsHighlights } from "./stats-highlights"
import { StatsParts } from "./stats-parts"
import { StatsTeam } from "./stats-team"
import { StatsTeams } from "./stats-teams"
import "./competition-statistics.css"

/** The games of a team in the period counted: none where it only played in others. */
function teamRecord({ feed, whole }: StatsData, teamId: string): TeamRecord | undefined {
  const known = (games: typeof feed) => teamRecords(games).find((record) => record.teamId === teamId)
  return known(feed) ?? (known(whole) && { teamId, games: [] })
}

/** The published games of a competition and what they add up to, for the period the address names. */
function useStatsData(view: CompetitionView, scope: string | null | undefined) {
  const lineups = useQuery(lineupsQuery(view.id))
  const whole = useMemo(() => (lineups.data ? gameFeed(view, lineups.data) : null), [view, lineups.data])
  const data = useMemo((): StatsData | null => {
    if (!whole) return null
    const { feed, period } = feedScope(whole, scope ?? null)
    return { view: whole.view, whole, feed, period, counted: countGames(feed.games), records: heroRecords(feed) }
  }, [whole, scope])
  return { data, lineups }
}

/**
 * The statistics of a competition: its heroes, its teams, what it is remembered by and a way to find its games. One hero
 * and one team have pages of their own. Everything is worked out from the published games, so every number leads to the
 * games it counts.
 */
export function CompetitionStatisticsTab({ view }: { view: CompetitionView }) {
  const { text } = useStreamLocale()
  const [params] = useSearchParams()
  const place = statsPlace(params)
  const { data, lineups } = useStatsData(view, place.scope)
  if (!data)
    return lineups.isError ? (
      <div className="hub-state" role="alert">
        <h2>{text("Chưa tải được thống kê", "The statistics could not be loaded")}</h2>
        <button type="button" className="cp-button" onClick={() => void lineups.refetch()}>
          {text("Thử lại", "Retry")}
        </button>
      </div>
    ) : (
      <div className="tn-comp-skeleton" role="status" aria-label={text("Đang tải thống kê…", "Loading statistics…")}>
        <span className="hub-skeleton" data-shape="rows" />
      </div>
    )
  const hero = heroByKey(data.whole, place.hero)
  const record = hero && (data.records.get(hero.key) ?? { hero, picks: [], bans: [] })
  const team = place.team ? teamRecord(data, place.team) : undefined
  return (
    <div className="tn-stats">
      {record ? (
        <StatsHero data={data} record={record} place={place} />
      ) : team ? (
        <StatsTeam data={data} record={team} place={place} />
      ) : (
        <>
          <StatsParts data={data} place={place} />
          {place.part === "teams" ? (
            <StatsTeams data={data} />
          ) : place.part === "highlights" ? (
            <StatsHighlights data={data} />
          ) : place.part === "games" ? (
            <StatsGames data={data} />
          ) : (
            <StatsHeroes data={data} />
          )}
        </>
      )}
    </div>
  )
}
