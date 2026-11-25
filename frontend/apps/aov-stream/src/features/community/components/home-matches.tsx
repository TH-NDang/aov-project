import { Link } from "react-router"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionStatus, matchStrip } from "../../../lib/competition-model"
import { CompetitionLogo } from "../../../components/competition-card"
import { MatchCard } from "../../../components/match-card"
import { aheadCompetitions } from "../../../lib/directory-model"
import { competitionMatches } from "../../../lib/match-model"
import { competitionStatusLabels, dayRange, useFeaturedCompetitions } from "../../../components/community-ui"

/**
 * The first thing on the home page: matches on now, the next ones, then the latest results, in one row that scrolls
 * sideways. Nothing is rendered while no published competition has a dated match.
 */
export function HomeMatches() {
  const { text } = useStreamLocale()
  const competitions = useFeaturedCompetitions()
  if (competitions.isPending)
    return (
      <div className="tn-strip" role="status" aria-label={text("Đang tải trận đấu", "Loading matches")}>
        <div className="tn-strip-row">
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} className="hub-skeleton tn-strip-skeleton" />
          ))}
        </div>
      </div>
    )
  const entries = matchStrip(competitionMatches(competitions.data?.items ?? []))
  if (!entries.length) return null
  return (
    <section className="tn-strip" aria-labelledby="home-matches">
      <div className="tn-heading">
        <h2 id="home-matches">{text("Trận đấu", "Matches")}</h2>
        <Link to="/competitions?tab=schedule">
          {text("Lịch & kết quả", "Schedule & results")}
          <StreamIcon name="arrow" size={15} />
        </Link>
      </div>
      <div
        className="tn-strip-row"
        tabIndex={0}
        role="group"
        aria-label={text("Trận sắp diễn ra và kết quả mới nhất", "Upcoming matches and latest results")}
      >
        {entries.map((entry) => (
          <MatchCard key={`${entry.competition.id}:${entry.match.key}`} entry={entry} context />
        ))}
      </div>
    </section>
  )
}

/** The side column's list of competitions that are on or about to start, so the home page always leads to them. */
export function HomeCompetitions() {
  const { text } = useStreamLocale()
  const competitions = useFeaturedCompetitions()
  const items = aheadCompetitions(competitions.data?.items ?? []).slice(0, 5)
  if (!items.length) return null
  return (
    <section className="hub-card" aria-labelledby="home-competitions">
      <div className="hub-card-heading">
        <h2 id="home-competitions" className="hub-card-title">
          {text("Giải đang và sắp diễn ra", "Current and upcoming tournaments")}
        </h2>
        <Link to="/competitions" className="hub-card-more">
          {text("Tất cả", "All")}
        </Link>
      </div>
      <ul className="tn-mini-list">
        {items.map((view) => {
          const { tournament } = view.content
          const status = competitionStatus(view.content)
          return (
            <li key={view.id}>
              <Link to={`/competitions/${view.id}`}>
                <CompetitionLogo name={tournament.name} url={tournament.logoUrl} darkUrl={tournament.logoDarkUrl} />
                <span>
                  <strong>{tournament.name}</strong>
                  <small>
                    {status && <b data-status={status}>{competitionStatusLabels()[status]}</b>}
                    {dayRange(tournament.startsOn, tournament.endsOn, text("Chờ lịch", "To be scheduled"))}
                  </small>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
