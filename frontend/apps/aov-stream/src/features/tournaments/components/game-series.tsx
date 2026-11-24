import { Link } from "react-router"
import type { PublishedGame } from "@aov/community-contracts"
import { LocalTime } from "@aov/ui/components/local-time"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { ThemedLogo } from "../../../components/themed-logo"
import { seriesRound, seriesTeams } from "../../../lib/tournament-model"
import { GameRow } from "./game-card"
import "./game-series.css"

/**
 * The games of one match in the games directory: the match with its score once, then a line per game. `competition`
 * names the competition, for a list that mixes several.
 */
export function GameSeries({ games, competition }: { games: PublishedGame[]; competition: boolean }) {
  const { languageTag } = useStreamLocale()
  const first = games[0]!
  const [a, b] = seriesTeams(first, languageTag)
  const round = seriesRound(first.series, languageTag)
  return (
    <section className="tn-series">
      <header>
        <h2>
          <Link to={`/matches/${encodeURIComponent(first.content.seriesId)}`}>
            <span data-lost={a.lost || undefined}>
              <StreamImage src={a.logoUrl} darkSrc={a.logoDarkUrl} logo name={a.shortName} />
              {a.shortName}
            </span>
            <b>{a.score != null && b.score != null ? `${a.score} – ${b.score}` : "vs"}</b>
            <span data-lost={b.lost || undefined}>
              <StreamImage src={b.logoUrl} darkSrc={b.logoDarkUrl} logo name={b.shortName} />
              {b.shortName}
            </span>
          </Link>
        </h2>
        <p>
          {competition && (
            <span>
              <ThemedLogo src={first.tournament.logoUrl} darkSrc={first.tournament.logoDarkUrl} />
              {first.tournament.name}
            </span>
          )}
          {round && <span>{round}</span>}
          {first.series.scheduledAt && (
            <span>
              <LocalTime
                value={first.series.scheduledAt}
                format={{ day: "2-digit", month: "2-digit", year: "numeric" }}
                locale={languageTag}
              />
            </span>
          )}
        </p>
      </header>
      <div className="tn-game-list">
        {games.map((game) => (
          <GameRow key={game.id} game={game} />
        ))}
      </div>
    </section>
  )
}
