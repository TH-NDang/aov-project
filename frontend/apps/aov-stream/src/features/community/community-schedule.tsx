import { Link } from "react-router"
import { LocalTime } from "@aov/ui/components/local-time"
import { useUserTimeZone } from "@aov/ui/lib/time-zone"
import { useStreamLocale } from "../../components/stream-locale"
import { useFeaturedCompetitions } from "./community-ui"
import { MATCH_WINDOW, matchesToShow, scheduledMatches } from "./schedule-model"
import { competitionMatchHref } from "../tournaments/match-model"

const time: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }
const dayTime: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }

/** The side column's match list: what is on today, scores once entered, and an "under way" marker. */
export function TodaySchedule() {
  const { text, languageTag } = useStreamLocale()
  const competitions = useFeaturedCompetitions()
  const now = Date.now()
  const timeZone = useUserTimeZone()
  const { today, items } = matchesToShow(scheduledMatches(competitions.data?.items || [], languageTag), now, timeZone)
  if (!items.length) return null
  return (
    <section className="hub-card hub-card-padded" aria-labelledby="today-schedule">
      <div className="hub-card-heading">
        <h2 id="today-schedule" className="hub-card-title">
          {today ? text("Lịch hôm nay", "Today's schedule") : text("Sắp diễn ra", "Upcoming")}
        </h2>
        <Link to="/competitions?tab=schedule" className="hub-card-more">
          {text("Xem lịch đấu", "See schedule")}
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
                    <span className="cp-live-badge">{text("Đang diễn ra", "Ongoing")}</span>
                  ) : (
                    <LocalTime
                      value={match.at}
                      sourceTimeZone={match.timeZone}
                      format={today ? time : dayTime}
                      locale={languageTag}
                    />
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
