import { useRef } from "react"
import { Link } from "react-router"
import { LocalTime } from "@aov/ui/components/local-time"
import { readVideoLink } from "@aov/ui/lib/video-playback"
import { MatchTime } from "../../../components/match-time"
import { PlaceSteps, PlaceTrail, useSections, type Place, type Step } from "../../../components/place-trail"
import { competitionMark } from "../components/competition-mark"
import { StreamShell } from "../../../components/stream-shell"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { timeUntil } from "../../../lib/countdown"
import { mvpOf } from "../../../lib/crew-model"
import { competitionMatches, competitionMatchHref, type CompetitionMatch } from "../../../lib/match-model"
import { matchSides, scheduleParts } from "../../../lib/match-schedule"
import { shortCompetitionName } from "../../../lib/season-name"
import { plainNote } from "../../../lib/tournament-model"
import { useNow } from "../../../lib/use-now"
import type { WatchMatch } from "../../../lib/watch-types"
import { MatchCrew, MvpFact } from "../components/competition-people"
import { GameRow } from "../components/game-card"
import { MatchCompare } from "../components/match-compare"
import { MatchBar, MatchHead, SeriesTrack } from "../components/match-head"
import { matchStateLabels, matchStatus } from "../components/match-row"
import { PairGamesLink } from "../components/pair-games-link"
import { ScheduleDays } from "../components/schedule-list"
import { SeriesDraft } from "../components/series-draft"
import { useMatch, type Match } from "../components/use-match"
import { useMatchWatch, useRoom } from "../components/use-match-watch"
import { WatchRoom } from "../components/watch-room"
import { WatchStart } from "../components/watch-start"
import { StreamHead } from "../../../components/stream-head"
import "./match-page.css"

/** Other matches shown under a match: enough to see how both teams are doing without becoming a schedule. */
const OTHERS = 6

/**
 * The other matches of both teams in the same competition: the next ones first, then their latest results. It gives
 * a match without recorded games somewhere to go on from.
 */
function OtherMatches({ entry }: { entry: CompetitionMatch }) {
  const { text } = useStreamLocale()
  const teams = matchSides(entry).flatMap((side) => side.teamId ?? [])
  const { upcoming, results } = scheduleParts(
    competitionMatches([entry.competition]).filter(
      (other) =>
        other.match.key !== entry.match.key &&
        matchSides(other).some((side) => side.teamId != null && teams.includes(side.teamId)),
    ),
  )
  const ahead = upcoming.slice(0, OTHERS / 2)
  const played = results.slice(0, OTHERS - ahead.length)
  if (!ahead.length && !played.length) return null
  return (
    <section className="tn-schedule-part" aria-labelledby="match-others">
      <div className="tn-heading" data-flush="">
        <h2 id="match-others">
          {text("Trận khác của hai đội", "Other matches of the two teams")}{" "}
          <small>{text("trong giải này", "in this tournament")}</small>
        </h2>
      </div>
      <ScheduleDays entries={ahead} part="upcoming" />
      <ScheduleDays entries={played} part="results" />
    </section>
  )
}

/** What stands in place of the score: on now, or how long until the match starts. */
function MatchClock({ entry }: { entry: CompetitionMatch }) {
  const { text, languageTag } = useStreamLocale()
  const now = useNow()
  const status = matchStatus(entry, now)
  const left = timeUntil(Date.parse(entry.match.scheduledAt || ""), now, languageTag)
  return (
    <span className="tn-duel-when">
      {status === "LIVE" ? (
        <span className="tn-live">{text(...matchStateLabels.LIVE)}</span>
      ) : left ? (
        <strong>{left}</strong>
      ) : (
        <strong>{text(matchStateLabels[status][0], matchStateLabels[status][1])}</strong>
      )}
      {status !== "UNSCHEDULED" && (
        <span>
          <MatchTime entry={entry} />
        </span>
      )}
    </span>
  )
}

/** What the list of games says while it has none, by where the match stands. */
const NO_GAMES: Record<string, readonly [string, string]> = {
  LIVE: [
    "Trận đang diễn ra. Các ván đấu sẽ có ở đây sau khi được ghi nhận.",
    "The match is live. Its games appear here once recorded.",
  ],
  UPCOMING: [
    "Trận chưa diễn ra. Các ván đấu sẽ có ở đây sau khi trận kết thúc.",
    "The match has not been played. Its games appear here once it ends.",
  ],
  UNSCHEDULED: [
    "Trận chưa diễn ra. Các ván đấu sẽ có ở đây sau khi trận kết thúc.",
    "The match has not been played. Its games appear here once it ends.",
  ],
  PENDING: ["Chưa có ván nào của trận này được ghi nhận.", "No game of this match is recorded yet."],
  SCORED: ["Chưa có ván nào của trận này được ghi nhận.", "No game of this match is recorded yet."],
  FINISHED: ["Chưa có ván nào của trận này được ghi nhận.", "No game of this match is recorded yet."],
}

/** The games of a match, or what to expect of them while none is recorded. */
function MatchGames({ match, film }: { match: Match; film: WatchMatch | null }) {
  const { text } = useStreamLocale()
  const { entry, games, list, linkedSeriesId, series } = match
  const note = plainNote(series?.note || "")
  const link = series?.sourceUrl || entry?.competition.content.plan.sourceUrl
  // A video that can be watched here is what the head leads to.
  const video = link && readVideoLink(link)?.providerVideoId
  const source = video && film?.story.videos.includes(video) ? null : link
  return (
    <section className="tn-match-games" aria-labelledby="match-games">
      <div className="tn-heading" data-flush="">
        <h2 id="match-games">{text("Các ván đấu", "Games")}</h2>
        {entry && <PairGamesLink entry={entry} shown={list.length} />}
      </div>
      {linkedSeriesId && games.isPending ? (
        <div
          className="tn-game-list"
          role="status"
          aria-label={text("Đang tải các ván của trận", "Loading the games of this match")}
        >
          {Array.from({ length: 3 }, (_, index) => (
            <span key={index} className="hub-skeleton tn-game-skeleton" />
          ))}
        </div>
      ) : games.isError && !games.data ? (
        <p className="tn-quiet" role="alert">
          {text("Chưa tải được các ván của trận.", "The games of this match could not be loaded.")}{" "}
          <button type="button" onClick={() => void games.refetch()}>
            {text("Thử lại", "Retry")}
          </button>
        </p>
      ) : list.length ? (
        <div className="tn-game-list">
          {list.map((game) => (
            <GameRow key={game.id} game={game} />
          ))}
        </div>
      ) : (
        <p className="tn-quiet">{text(...NO_GAMES[entry ? matchStatus(entry) : "FINISHED"]!)}</p>
      )}
      {(note || source) && (
        <footer className="tn-footnote">
          {note && <p>{note}</p>}
          {source && (
            <a href={source} target="_blank" rel="noreferrer noopener">
              {text("Nguồn trận đấu", "Match source")} <StreamIcon name="external" size={13} />
            </a>
          )}
        </footer>
      )}
    </section>
  )
}

export function MatchPage() {
  const { text, languageTag } = useStreamLocale()
  const match = useMatch()
  const { entry, head, beside, list, series, scheduledAt, tournamentId, competitionName, overview } = match
  // The competition names the MVP of each match; a match opened without it finds the player among its games.
  const mvp = mvpOf(series?.mvpPlayerId, entry?.competition.content.players, ...list.map((game) => game.players))
  const scored = head?.teams.every((team) => team.score != null)
  const { tournaments } = useSections()
  const competition = entry?.competition
  const up: Place = tournamentId
    ? {
        to: `/competitions/${tournamentId}?tab=matches`,
        name: competitionName || text("Giải đấu", "Tournament"),
        short: competition && shortCompetitionName(competition),
        mark: competition && competitionMark(competition.content.tournament),
      }
    : { to: "/competitions?tab=schedule", name: text("Lịch & kết quả", "Schedule & results") }
  const places = [tournaments, up]
  const { film, waiting, facts, address } = useMatchWatch(match, { up, mvp })
  const { room, onOpened } = useRoom(film, address)
  const told = useWatch((view) => view.done)
  const place = useRef<HTMLDivElement>(null)
  const step = (other: CompetitionMatch | null): Step | null => {
    if (!other) return null
    const [a, b] = matchSides(other, languageTag)
    return { to: competitionMatchHref(other.competition.id, other.match.key), name: `${a.name} – ${b.name}` }
  }
  const steps = beside && (
    <PlaceSteps
      label={text("Trận liền kề", "Matches before and after")}
      before={step(beside.before)}
      after={step(beside.after)}
    />
  )
  return (
    <StreamShell>
      <StreamHead
        title={`${head ? `${head.teams[0].name} vs ${head.teams[1].name}` : text("Trận đấu", "Match")} — AOV Stream`}
        description={
          head
            ? text(
                `${head.teams[0].name} gặp ${head.teams[1].name}${competitionName ? ` tại ${competitionName}` : ""}: tỷ số, đội hình và từng ván đấu Liên Quân Mobile.`,
                `${head.teams[0].name} against ${head.teams[1].name}${competitionName ? ` at ${competitionName}` : ""}: score, lineups and every Arena of Valor game.`,
              )
            : undefined
        }
      />
      <div className="tn-match-page">
        {match.loading ? (
          <div
            className="tn-duel-skeleton hub-skeleton"
            role="status"
            aria-label={text("Đang mở trận đấu", "Opening the match")}
          />
        ) : !head ? (
          <div className="hub-state" role="alert">
            <h1>{text("Chưa mở được trận đấu", "The match could not be opened")}</h1>
            <p>
              {text(
                "Trận chưa được xuất bản hoặc liên kết không còn dùng được.",
                "The match is not published, or the link no longer works.",
              )}
            </p>
            <div className="hub-state-actions">
              <button type="button" className="cp-button cp-primary" onClick={match.retry}>
                {text("Thử lại", "Retry")}
              </button>
              <Link className="cp-button" to="/competitions?tab=schedule">
                {text("Xem lịch và kết quả", "See schedule and results")}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="tn-match-top">
              {room && film && facts ? (
                <>
                  <div ref={place} className="tn-match-room" data-place-head="">
                    <WatchRoom match={film} facts={facts} />
                  </div>
                  <MatchBar head={head} at={place} bar={{ places, steps }} told={told} />
                </>
              ) : (
                <MatchHead
                  head={head}
                  trail={<PlaceTrail places={places} steps={steps} />}
                  bar={{ places, steps }}
                  center={entry && <MatchClock entry={entry} />}
                  facts={
                    scored &&
                    scheduledAt && (
                      <span>
                        <StreamIcon name="calendar" size={15} />
                        <LocalTime
                          value={scheduledAt}
                          sourceTimeZone={entry?.competition.content.plan.timezone}
                          locale={languageTag}
                        />
                      </span>
                    )
                  }
                  actions={
                    (film || waiting) && (
                      <WatchStart match={film} waiting={waiting} address={address} onOpened={onOpened} />
                    )
                  }
                  more={scored && mvp && <MvpFact label={text("MVP trận", "Match MVP")} player={mvp} />}
                  foot={list.length > 0 && <SeriesTrack games={list} overviewHref={overview} />}
                />
              )}
            </div>
            {/* Before a match, how the teams compare is what there is to read; after it, its games are. */}
            {entry && !scored && <MatchCompare entry={entry} />}
            <MatchGames match={match} film={film} />
            {list.length > 1 && (
              <SeriesDraft games={list} teamIds={[list[0]!.series.teamAId, list[0]!.series.teamBId]} />
            )}
            {entry && scored && <MatchCompare entry={entry} />}
            {entry && <MatchCrew crew={series?.broadcast} people={entry.competition.content.people} />}
            {entry && <OtherMatches entry={entry} />}
          </>
        )}
      </div>
    </StreamShell>
  )
}
