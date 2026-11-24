import { useEffect, useRef, type ReactNode } from "react"
import { Link } from "react-router"
import type { PublishedGame } from "@aov/community-contracts"
import { EntityPageLink } from "../../../components/public-competitions"
import { Stage } from "../../../components/stage"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import type { CompetitionMatch } from "../../../lib/match-model"
import { matchRound, matchSides, type MatchSide } from "../../../lib/match-schedule"
import { gameWinner } from "../../../lib/series-model"
import { clock, seriesRound, seriesTeams } from "../../../lib/tournament-model"
import { TeamName } from "./match-row"
import "./match-head.css"

/** Full names longer than this give way to the short name under a logo on a narrow screen. */
const HEAD_NAME = 20

export type HeadTeam = {
  /** The registry team, whose page the name opens once it is published. */
  teamId?: string | null
  name: string
  shortName?: string
  logoUrl?: string | null
  logoDarkUrl?: string | null
  score: number | null
  won: boolean
  lost: boolean
  /** False while the place waits for a seed or for the result of another match. */
  known?: boolean
}

type Head = { tint: string; round: string | null; bestOf: number; teams: [HeadTeam, HeadTeam] }

/**
 * The head of a match of a competition's plan: its round, how many games decide it, and both sides in full. A side
 * still open is named in `locale`.
 */
export function matchHeadOf(entry: CompetitionMatch, locale: string): Head {
  const [a, b] = matchSides(entry, locale)
  const team = (side: MatchSide): HeadTeam => ({ ...side, name: side.fullName, shortName: side.name })
  return {
    tint: entry.competition.content.tournament.name,
    round: matchRound(entry, locale),
    bestOf: entry.match.bestOf,
    teams: [team(a), team(b)],
  }
}

/** The same head read from a published game, which carries its series, for a match opened without its competition. */
export function seriesHeadOf(game: PublishedGame, locale = "vi-VN"): Head {
  return {
    tint: game.tournament.name,
    round: seriesRound(game.series, locale),
    bestOf: game.series.bestOf,
    teams: seriesTeams(game, locale),
  }
}

function DuelTeam({ team, side }: { team: HeadTeam; side: "a" | "b" }) {
  const open = team.known === false
  const name = (
    <TeamName wide={team.name} compact={team.shortName && team.name.length > HEAD_NAME ? team.shortName : team.name} />
  )
  return (
    <span className="tn-duel-team" data-side={side} data-lost={team.lost || undefined} data-open={open || undefined}>
      {open ? (
        <span className="tn-duel-blank" aria-hidden="true" />
      ) : (
        <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} logo name={team.name} />
      )}
      <span>
        {team.teamId && !open ? (
          <EntityPageLink kind="TEAM" id={team.teamId} name={team.name}>
            {name}
          </EntityPageLink>
        ) : (
          name
        )}
      </span>
    </span>
  )
}

/**
 * The head a match shares with each of its games: both teams large around the score, on a stage lit by both.
 * `round` and `bestOf` say what the match is, `center` takes the place of the score while there is none, `scoreNote`
 * says what the score counts when the page is about one game, `facts` stand under the board and `foot` closes it.
 */
export function MatchHead({
  head: { tint, round, bestOf, teams },
  center,
  scoreNote,
  facts,
  foot,
}: {
  head: Head
  center?: ReactNode
  scoreNote?: string
  facts?: ReactNode
  foot?: ReactNode
}) {
  const [a, b] = teams
  const scored = a.score != null && b.score != null
  return (
    <Stage
      tint={tint}
      lights={[
        { src: a.logoUrl, darkSrc: a.logoDarkUrl, at: "left" },
        { src: b.logoUrl, darkSrc: b.logoDarkUrl, at: "right" },
      ]}
      className="tn-duel"
    >
      <header className="tn-duel-main">
        <p className="tn-duel-round">
          {round && <span>{round}</span>}
          <span>BO{bestOf}</span>
        </p>
        <h1 className="tn-duel-board">
          <DuelTeam team={a} side="a" />
          <span className="tn-duel-score">
            {scored ? (
              <>
                <b data-lost={a.lost || undefined}>{a.score}</b>
                <i aria-hidden="true">–</i>
                <b data-lost={b.lost || undefined}>{b.score}</b>
                {scoreNote && <small>{scoreNote}</small>}
              </>
            ) : (
              (center ?? <i>vs</i>)
            )}
          </span>
          <DuelTeam team={b} side="b" />
        </h1>
        {facts && <div className="tn-duel-facts">{facts}</div>}
      </header>
      {foot}
    </Stage>
  )
}

/**
 * The games of a match as the foot of its head: who won each and how long it took, after the match itself. Each opens
 * its game; the row scrolls sideways and keeps the page being read in view.
 */
export function SeriesTrack({
  games,
  overviewHref,
  active,
}: {
  games: PublishedGame[]
  overviewHref: string
  /** The game being read; absent on the page of the match. */
  active?: string
}) {
  const { text } = useStreamLocale()
  const strip = useRef<HTMLElement>(null)
  useEffect(() => {
    const row = strip.current
    const tab = row?.querySelector<HTMLElement>("[aria-current]")
    if (row && tab) row.scrollLeft = tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2
  }, [active, games.length])
  return (
    <nav ref={strip} className="tn-track" aria-label={text("Các ván trong trận", "Games in this match")}>
      <Link to={overviewHref} aria-current={!active ? "page" : undefined} data-overview="">
        <StreamIcon name="list" size={18} />
        <strong>{text("Cả trận", "Match")}</strong>
      </Link>
      {games.map((game) => {
        const { number, durationSeconds } = game.content
        const winner = gameWinner(game)
        const team = winner ? game.teams[winner] : undefined
        return (
          <Link key={game.id} to={`/games/${game.id}`} aria-current={active === game.id ? "page" : undefined}>
            {team ? (
              <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} logo name={team.shortName || team.name} />
            ) : (
              <StreamIcon name="clock" size={18} />
            )}
            <span>
              <strong>{text(`Ván ${number}`, `Game ${number}`)}</strong>
              <small>
                {team && <span className="sr-only">{text(`${team.name} thắng, `, `${team.name} won, `)}</span>}
                {durationSeconds ? clock(durationSeconds) : "–"}
              </small>
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
