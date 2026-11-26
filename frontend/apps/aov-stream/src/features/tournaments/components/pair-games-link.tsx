import { useCallback, useMemo } from "react"
import { Link } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAhead } from "../../../components/on-demand"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText } from "../../../lib/feed-words"
import { findGames, NOTHING_ASKED } from "../../../lib/finder-model"
import { gameFeed } from "../../../lib/game-feed"
import type { CompetitionMatch } from "../../../lib/match-model"
import { matchSides } from "../../../lib/match-schedule"
import { statsHref } from "../../../lib/statistics-routes"
import { lineupsQuery } from "../../../lib/tournament-api"

/**
 * The way from a match to every published game its two teams played against each other in the competition, offered
 * where there are more than the `shown` games of the match. They are counted the way the finder finds them, from the
 * games of the competition, which are asked for once the page stands and the browser has nothing else to do.
 */
export function PairGamesLink({ entry, shown }: { entry: CompetitionMatch; shown: number }) {
  const { text, languageTag } = useStreamLocale()
  const view = entry.competition
  const [a, b] = matchSides(entry, languageTag)
  const client = useQueryClient()
  const ask = useCallback(() => void client.prefetchQuery(lineupsQuery(view.id)), [client, view.id])
  useAhead({ ask }, !!(a.teamId && b.teamId))
  const lineups = useQuery({ ...lineupsQuery(view.id), enabled: false })
  const feed = useMemo(() => (lineups.data?.games.length ? gameFeed(view, lineups.data) : null), [view, lineups.data])
  if (!feed || !a.teamId || !b.teamId) return null
  const question = { ...NOTHING_ASKED, team: a.teamId, opp: b.teamId }
  const every = findGames(feed.games, question).length
  if (every <= shown) return null
  const games = gamesText(every, text, languageTag)
  return (
    <Link to={statsHref(view.id, { question })}>
      {text(
        `${games} ${a.name} gặp ${b.name} ở giải này`,
        `${games} of ${a.name} against ${b.name} in this tournament`,
      )}
      <StreamIcon name="arrow" size={15} />
    </Link>
  )
}
