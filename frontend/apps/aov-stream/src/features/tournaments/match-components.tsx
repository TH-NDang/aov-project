import { Fragment, useEffect, useRef, type CSSProperties, type ReactNode } from "react"
import { Link } from "react-router"
import type { PublishedGame } from "@aov/community-contracts"
import { LocalTime } from "@aov/ui/components/local-time"
import { StreamImage } from "../../components/stream-image"
import { useStreamLocale } from "../../components/stream-locale"
import { hueOf } from "../../components/community-ui"
import { EntityPageLink } from "../../components/public-competitions"
import { matchUnderway } from "../../lib/competition-model"
import { competitionMatchHref, matchState, type CompetitionMatch } from "../../lib/match-model"
import { matchRound, matchSides, type MatchSide } from "../../lib/match-schedule"
import { seriesRound, seriesTeams, unbroken } from "../../lib/tournament-model"
import { ThemedLogo } from "@/components/themed-logo"

const clockTime: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }

/** Full names up to this length fit a row on a wide screen; longer ones keep the short name everywhere. */
const ROW_NAME = 24
/** Full names longer than this give way to the short name under a logo on a narrow screen. */
const HEAD_NAME = 20

/** A name with a longer form for wide screens and a shorter one for narrow screens, when the two differ. */
function TeamName({ wide, compact }: { wide: string; compact: string }) {
  if (wide === compact) return <>{unbroken(wide)}</>
  return (
    <>
      <span className="tn-name-wide">{unbroken(wide)}</span>
      <span className="tn-name-compact">{unbroken(compact)}</span>
    </>
  )
}

/** Where a match stands, in Vietnamese and in English. */
export const matchStateLabels = {
  LIVE: ["Đang diễn ra", "Ongoing"],
  FINISHED: ["Đã kết thúc", "Finished"],
  SCORED: ["Đã có tỷ số", "Score available"],
  UPCOMING: ["Sắp diễn ra", "Upcoming"],
  PENDING: ["Chờ kết quả", "Awaiting result"],
  UNSCHEDULED: ["Chờ lịch", "To be scheduled"],
} as const

/** Where a match stands in one word: on now, done, ahead, or waiting for its result or its date. */
export function matchStatus(entry: CompetitionMatch) {
  return matchUnderway(entry) ? "LIVE" : matchState(entry)
}

function FixtureTeam({ team }: { team: MatchSide }) {
  return (
    <span
      className="tn-fixture-team"
      data-side={team.side}
      data-won={team.won || undefined}
      data-lost={team.lost || undefined}
      data-open={!team.known || undefined}
    >
      {team.known ? (
        <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} name={team.name} />
      ) : (
        <span className="tn-fixture-blank" aria-hidden="true" />
      )}
      <strong title={team.fullName}>
        <TeamName wide={team.fullName.length <= ROW_NAME ? team.fullName : team.name} compact={team.name} />
      </strong>
    </span>
  )
}

/**
 * One match on a line of a schedule: its time, both teams around the score, its round and how many games decide it.
 * The whole row opens the match. `competition` adds the competition's name, for a list that mixes several.
 */
export function MatchRow({ entry, competition = false }: { entry: CompetitionMatch; competition?: boolean }) {
  const { text, languageTag } = useStreamLocale()
  const { match, competition: view } = entry
  const { plan, tournament } = view.content
  const [a, b] = matchSides(entry, languageTag)
  const status = matchStatus(entry)
  const round = matchRound(entry, languageTag)
  const meta = [
    status === "PENDING" && <em>{text(...matchStateLabels.PENDING)}</em>,
    round,
    competition && (
      <>
        <ThemedLogo src={tournament.logoUrl} darkSrc={tournament.logoDarkUrl} />
        {tournament.name}
      </>
    ),
  ].filter(Boolean)
  return (
    <Link
      className="tn-fixture"
      to={competitionMatchHref(view.id, match.key)}
      data-live={status === "LIVE" || undefined}
    >
      <span className="tn-fixture-time">
        <LocalTime
          value={match.scheduledAt}
          sourceTimeZone={plan.timezone}
          format={clockTime}
          locale={languageTag}
          fallback="–"
        />
      </span>
      <FixtureTeam team={a} />
      <span className="tn-fixture-score">
        {a.score != null && b.score != null ? (
          <>
            <b data-won={a.won || undefined} data-lost={a.lost || undefined}>
              {a.score}
            </b>
            <i aria-hidden="true">–</i>
            <b data-won={b.won || undefined} data-lost={b.lost || undefined}>
              {b.score}
            </b>
          </>
        ) : (
          <i>vs</i>
        )}
      </span>
      <FixtureTeam team={b} />
      <span className="tn-fixture-meta">
        {meta.map((item, index) => (
          <Fragment key={index}>
            {index > 0 && " · "}
            {item}
          </Fragment>
        ))}
      </span>
      <span className="tn-fixture-format">BO{match.bestOf}</span>
    </Link>
  )
}

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

type Head = { tint: string; kicker: string; teams: [HeadTeam, HeadTeam] }

/**
 * The head of a match of a competition's plan: its round, how many games decide it, and both sides in full. A side
 * still open is named in `locale`.
 */
export function matchHeadOf(entry: CompetitionMatch, locale: string): Head {
  const [a, b] = matchSides(entry, locale)
  const team = (side: MatchSide): HeadTeam => ({ ...side, name: side.fullName, shortName: side.name })
  return {
    tint: entry.competition.content.tournament.name,
    kicker: [matchRound(entry, locale), `BO${entry.match.bestOf}`].filter(Boolean).join(" · "),
    teams: [team(a), team(b)],
  }
}

/** The same head read from a published game, which carries its series, for a match opened without its competition. */
export function seriesHeadOf(game: PublishedGame, locale = "vi-VN"): Head {
  return {
    tint: game.tournament.name,
    kicker: [seriesRound(game.series, locale), `BO${game.series.bestOf}`].filter(Boolean).join(" · "),
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
        <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} name={team.name} />
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
 * The head a match shares with each of its games: both teams large around the score of the match, on the tint of the
 * competition. `kicker` names the round, `scoreNote` says what the score counts when the page is about one game, and
 * `children` are the facts under the board. `more` is a second group of facts: where the row is too narrow for both,
 * the group moves to the next line whole, so nothing ends up there alone.
 */
export function MatchHead({
  tint,
  kicker,
  teams: [a, b],
  scoreNote,
  children,
  more,
}: {
  tint: string
  kicker?: ReactNode
  teams: [HeadTeam, HeadTeam]
  scoreNote?: string
  children?: ReactNode
  more?: ReactNode
}) {
  const scored = a.score != null && b.score != null
  return (
    <header className="tn-duel hub-art" style={{ "--hub-hue": hueOf(tint) } as CSSProperties}>
      {kicker && <p className="hub-kicker">{kicker}</p>}
      <h1 className="tn-duel-board">
        <DuelTeam team={a} side="a" />
        <span className="tn-duel-score">
          {scored ? (
            <>
              <b data-lost={a.lost || undefined}>{a.score}</b>
              <i aria-hidden="true">–</i>
              <b data-lost={b.lost || undefined}>{b.score}</b>
            </>
          ) : (
            <i>vs</i>
          )}
          {scored && scoreNote && <small>{scoreNote}</small>}
        </span>
        <DuelTeam team={b} side="b" />
      </h1>
      {children && (
        <div className="tn-duel-facts">
          <div className="hub-banner-stats">{children}</div>
          {more && <div className="hub-banner-stats">{more}</div>}
        </div>
      )}
    </header>
  )
}

/**
 * The way between the games of a match: the match itself first, then each game by its number, on one row that scrolls
 * sideways and keeps the page being read in view.
 */
export function MatchTabs({
  games,
  overviewHref,
  active,
}: {
  games: { id: string; number: number }[]
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
    <nav ref={strip} className="tn-game-tabs" aria-label={text("Các ván trong trận", "Games in this match")}>
      <Link to={overviewHref} aria-current={!active ? "page" : undefined}>
        {text("Tổng quan trận", "Match overview")}
      </Link>
      {games.map((game) => (
        <Link key={game.id} to={`/games/${game.id}`} aria-current={active === game.id ? "page" : undefined}>
          {text(`Ván ${game.number}`, `Game ${game.number}`)}
        </Link>
      ))}
    </nav>
  )
}
