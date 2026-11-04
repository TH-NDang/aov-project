import { Link } from "react-router"
import { useFeaturedCompetitions } from "./community-ui"
import { MATCH_WINDOW, matchesToShow, scheduledMatches } from "./schedule-model"
import { competitionMatchHref } from "../tournaments/match-model"

const time = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" })
const dayTime = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

/** The side column's match list: what is on today, scores once entered, and an "under way" marker. */
export function TodaySchedule() {
  const competitions = useFeaturedCompetitions()
  const now = Date.now()
  const { today, items } = matchesToShow(scheduledMatches(competitions.data?.items || []), now)
  if (!items.length) return null
  return (
    <section className="hub-card hub-card-padded" aria-labelledby="today-schedule">
      <div className="hub-card-heading">
        <h2 id="today-schedule" className="hub-card-title">
          {today ? "Lịch hôm nay" : "Sắp diễn ra"}
        </h2>
        <Link to="/competitions?tab=schedule" className="hub-card-more">
          Xem lịch đấu
        </Link>
      </div>
      <ul className="cp-schedule">
        {items.map((match) => {
          const scored = match.scoreA != null && match.scoreB != null
          const underway = !scored && match.at <= now && now < match.at + MATCH_WINDOW
          return (
            <li key={match.key}>
              <Link to={competitionMatchHref(match.competitionId, match.matchKey)}>
                <span className="cp-schedule-time">
                  {underway ? (
                    <span className="cp-live-badge">Đang diễn ra</span>
                  ) : (
                    (today ? time : dayTime).format(match.at)
                  )}
                </span>
                <span className="cp-schedule-match">
                  <strong>
                    {match.teamA} {scored ? `${match.scoreA} – ${match.scoreB}` : "vs"} {match.teamB}
                  </strong>
                  <small>{match.tournament}</small>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
