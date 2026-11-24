import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { broadcastRoles, type GameSide, type PublishedGame } from "@aov/community-contracts"
import { MatchStatus } from "../../../components/match-card"
import { RoundLabel } from "../../../components/round-label"
import { Stage } from "../../../components/stage"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { crewGroups, mvpOf } from "../../../lib/crew-model"
import { competitionMatchHref, matchSeriesId, orderedMatchGames, type CompetitionMatch } from "../../../lib/match-model"
import { matchRound, matchSides, type MatchSide } from "../../../lib/match-schedule"
import { gameWinner } from "../../../lib/series-model"
import { matchGamesQuery } from "../../../lib/tournament-api"
import { clock, orderedParticipants, seriesSides } from "../../../lib/tournament-model"
import { ReferenceArt } from "./reference-art"
import "./match-peek.css"

function Team({ side }: { side: MatchSide }) {
  return (
    <span className="tn-peek-team" data-side={side.side} data-lost={side.lost || undefined}>
      <StreamImage src={side.logoUrl} darkSrc={side.logoDarkUrl} logo name={side.name} />
      <b title={side.fullName}>{side.brief}</b>
    </span>
  )
}

/**
 * Which team took each game, in order: a step towards its end of the line for every game won, so the line tells
 * whether a match was one-sided, traded blow for blow or turned around.
 */
function Duel({ games, teamA }: { games: PublishedGame[]; teamA: string | null }) {
  return (
    <span className="tn-peek-duel" aria-hidden="true">
      {games.map((game) => {
        const winner = gameWinner(game)
        return <i key={game.id} data-side={winner == null ? undefined : winner === teamA ? "a" : "b"} />
      })}
    </span>
  )
}

/** The five heroes of one side in lane order; the one the game's MVP played wears a star. */
function Faces({ game, side, slot }: { game: PublishedGame; side: GameSide; slot: "a" | "b" }) {
  const { text } = useStreamLocale()
  const { mvpPlayerId, winner } = game.content
  return (
    <span className="tn-peek-faces" data-slot={slot} data-lost={(winner && winner !== side.side) || undefined}>
      {orderedParticipants(side.participants).map((seat) => {
        const mvp = !!mvpPlayerId && seat.playerId === mvpPlayerId
        return (
          <span key={seat.lane} className="tn-peek-face" data-mvp={mvp || undefined}>
            <ReferenceArt catalog={game.catalog} kind="heroes" selection={seat.hero} />
            {mvp && <span className="sr-only">{text("MVP của ván", "MVP of the game")}</span>}
          </span>
        )
      })}
    </span>
  )
}

function Game({ game }: { game: PublishedGame }) {
  const { text } = useStreamLocale()
  const { number, durationSeconds, winner } = game.content
  const [first, second] = seriesSides(game)
  if (!first || !second) return null
  const won = winner === first.side ? "a" : winner === second.side ? "b" : undefined
  const name = (side: GameSide) => game.teams[side.teamId]?.name ?? ""
  return (
    <li data-won={won}>
      <Link to={`/games/${game.id}`}>
        <Faces game={game} side={first} slot="a" />
        <span className="tn-peek-clock">
          <b>{text(`Ván ${number}`, `Game ${number}`)}</b>
          <span>{durationSeconds ? clock(durationSeconds) : "–"}</span>
          {won && (
            <span className="sr-only">
              {text(`${name(won === "a" ? first : second)} thắng`, `${name(won === "a" ? first : second)} won`)}
            </span>
          )}
        </span>
        <Faces game={game} side={second} slot="b" />
      </Link>
    </li>
  )
}

/**
 * A match at a glance, without leaving the bracket: both teams on their stage, who took each game, then every game's
 * heroes. Its page has the rest.
 */
export function MatchPeek({ entry }: { entry: CompetitionMatch }) {
  const { text, languageTag } = useStreamLocale()
  const seriesId = matchSeriesId(entry)
  const query = useQuery(matchGamesQuery(seriesId))
  const games = seriesId ? orderedMatchGames(query.data ?? [], seriesId) : []
  const [a, b] = matchSides(entry, languageTag)
  const { content } = entry.competition
  const series = seriesId ? content.series[seriesId] : undefined
  const mvp = mvpOf(series?.mvpPlayerId, content.players)
  const casters = crewGroups(series?.broadcast, content.people, broadcastRoles)
    .filter((group) => group.role === "CASTER")
    .flatMap((group) => group.people.map((person) => person.name))
  return (
    <div className="tn-peek">
      <Stage
        tint={a.fullName}
        lights={[
          { src: a.logoUrl, darkSrc: a.logoDarkUrl, at: "left" },
          { src: b.logoUrl, darkSrc: b.logoDarkUrl, at: "right" },
        ]}
        className="tn-peek-stage"
      >
        <p className="tn-peek-round">
          <RoundLabel entry={entry} label={matchRound(entry, languageTag)} />
          <span>BO{entry.match.bestOf}</span>
          <MatchStatus entry={entry} />
        </p>
        <div className="tn-peek-teams">
          <Team side={a} />
          <span className="tn-peek-score">
            {a.score != null && b.score != null ? (
              <>
                <b data-won={a.won || undefined}>{a.score}</b>
                <span>–</span>
                <b data-won={b.won || undefined}>{b.score}</b>
              </>
            ) : (
              "vs"
            )}
          </span>
          <Team side={b} />
        </div>
        {games.length > 0 && <Duel games={games} teamA={a.teamId} />}
      </Stage>
      {games.length > 0 ? (
        <ol className="tn-peek-games">
          {games.map((game) => (
            <Game key={game.id} game={game} />
          ))}
        </ol>
      ) : (
        <p className="tn-peek-empty" role="status">
          {query.isLoading
            ? text("Đang tải các ván…", "Loading games…")
            : a.score != null
              ? text("Chưa có dữ liệu từng ván.", "No game data yet.")
              : text("Trận chưa diễn ra.", "This match has not been played.")}
        </p>
      )}
      <div className="tn-peek-foot">
        {(mvp || casters.length > 0) && (
          <p>
            {mvp && (
              <span>
                <StreamIcon name="spark" size={14} />
                MVP <b>{mvp.name}</b>
              </span>
            )}
            {casters.length > 0 && (
              <span>
                <StreamIcon name="message" size={14} />
                {casters.join(", ")}
              </span>
            )}
          </p>
        )}
        <Link to={competitionMatchHref(entry.competition.id, entry.match.key)}>
          {text("Mở trang trận", "Open the match")}
          <StreamIcon name="arrow" size={16} />
        </Link>
      </div>
    </div>
  )
}
