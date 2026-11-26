import { useEffect, useRef, type ReactNode, type RefObject } from "react"
import { Link } from "react-router"
import type { PublishedGame } from "@aov/community-contracts"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { EntityPageLink } from "../../../components/go-link"
import { PlaceBar, type Place } from "../../../components/place-trail"
import { Stage } from "../../../components/stage"
import { RoundLabel } from "../../../components/round-label"
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

export type Head = { tint: string; round: ReactNode; bestOf: number; teams: [HeadTeam, HeadTeam] }

/**
 * The head of a match of a competition's plan: its round, how many games decide it, and both sides in full. A side
 * still open is named in `locale`.
 */
export function matchHeadOf(entry: CompetitionMatch, locale: string): Head {
  const [a, b] = matchSides(entry, locale)
  const team = (side: MatchSide): HeadTeam => ({ ...side, name: side.fullName, shortName: side.name })
  return {
    tint: entry.competition.content.tournament.name,
    round: <RoundLabel entry={entry} label={matchRound(entry, locale)} />,
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

/** The pages above, and beside, for the bar that stands in for the head once it is scrolled away. */
type HeadBar = { places: Place[]; steps?: ReactNode }

const isScored = ([a, b]: [HeadTeam, HeadTeam]) => a.score != null && b.score != null

/**
 * The bar that stands in for what is at `at`, the head of a match or the room in its place, once it is scrolled away.
 * `told` is false while the video in the room has yet to tell the result.
 */
export function MatchBar({
  head: { teams },
  at,
  bar,
  told = true,
}: {
  head: Head
  at: RefObject<HTMLElement | null>
  bar: HeadBar
  told?: boolean
}): ReactNode | null {
  const wide = usePageLayout() === "wide"
  if (!wide) return null
  const [a, b] = teams
  return (
    <PlaceBar
      head={at}
      {...bar}
      name={`${a.name} ${told && isScored(teams) ? `${a.score}–${b.score}` : "vs"} ${b.name}`}
      mark={
        <>
          <StreamImage src={a.logoUrl} darkSrc={a.logoDarkUrl} logo name={a.name} />
          <StreamImage src={b.logoUrl} darkSrc={b.logoDarkUrl} logo name={b.name} />
        </>
      }
    />
  )
}

/**
 * What stands under the board. With `actions` a wide head puts them in the middle between the facts and `more`; a
 * narrow one puts them first, in a row of their own.
 */
function UnderBoard({ facts, actions, more }: { facts?: ReactNode; actions?: ReactNode; more?: ReactNode }) {
  const wide = usePageLayout() === "wide"
  if (wide && actions)
    return (
      <div className="tn-duel-row">
        <div className="tn-duel-facts">{facts}</div>
        <div className="tn-duel-actions">{actions}</div>
        <div className="tn-duel-facts">{more}</div>
      </div>
    )
  return (
    <>
      {actions && <div className="tn-duel-actions">{actions}</div>}
      {(facts || more) && (
        <div className="tn-duel-facts">
          {facts}
          {more}
        </div>
      )}
    </>
  )
}

/**
 * The head a match shares with each of its games: both teams large around the score, on a stage lit by both.
 * `trail` says where the match stands, `round` and `bestOf` say what the match is, `center` takes the place of the
 * score while there is none, `scoreNote` says what the score counts when the page is about one game. Under the board
 * stand `facts`, `actions` and `more`; `foot` closes it.
 */
export function MatchHead({
  head,
  trail,
  bar,
  center,
  scoreNote,
  facts,
  actions,
  more,
  foot,
}: {
  head: Head
  trail: ReactNode
  bar: HeadBar
  center?: ReactNode
  scoreNote?: string
  facts?: ReactNode
  actions?: ReactNode
  more?: ReactNode
  foot?: ReactNode
}) {
  const { tint, round, bestOf, teams } = head
  const [a, b] = teams
  const scored = isScored(teams)
  const at = useRef<HTMLDivElement>(null)
  return (
    <>
      <div ref={at} data-place-head="">
        <Stage
          tint={tint}
          lights={[
            { src: a.logoUrl, darkSrc: a.logoDarkUrl, at: "left" },
            { src: b.logoUrl, darkSrc: b.logoDarkUrl, at: "right" },
          ]}
          bleeds
          className="tn-duel"
        >
          <div className="tn-duel-trail">{trail}</div>
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
            <UnderBoard facts={facts} actions={actions} more={more} />
          </header>
          {foot}
        </Stage>
      </div>
      <MatchBar head={head} at={at} bar={bar} />
    </>
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
