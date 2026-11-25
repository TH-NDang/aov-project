import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { dayRange } from "../../../components/community-ui"
import { CompetitionClock, StatusBadge } from "../../../components/competition-card"
import { Crest } from "../../../components/crest"
import { EntityPageLink } from "../../../components/go-link"
import { useStreamLocale } from "../../../components/stream-locale"
import { circuitHonours, type HonourSeason } from "../../../lib/circuit-honours"
import { competitionStatus } from "../../../lib/competition-model"
import { seasonName, seasonOfYear, shortCompetitionName } from "../../../lib/season-name"
import "./circuit-honours.css"

/** Teams named by their titles; those after them have their seasons below. */
const TEAMS = 8

/**
 * A circuit as its roll of honour: the teams that won it most, then every season by year under its champion's crest.
 */
export function CircuitHonours({ views, circuit }: { views: CompetitionView[]; circuit: string }) {
  const { text } = useStreamLocale()
  const { years, titles } = circuitHonours(views)
  return (
    <>
      {titles.length > 1 && (
        <section className="tn-block">
          <div className="tn-heading">
            <h2>
              {text("Bảng vàng", "Roll of honour")} <small>{text("các mùa đã công bố", "published seasons")}</small>
            </h2>
          </div>
          <ol className="tn-titles-row">
            {titles.slice(0, TEAMS).map(({ team, count }) => (
              <li key={team.id ?? team.name}>
                <Crest team={team} />
                <strong>
                  {team.id ? (
                    <EntityPageLink kind="TEAM" id={team.id} name={team.name} plain>
                      {team.shortName || team.name}
                    </EntityPageLink>
                  ) : (
                    team.shortName || team.name
                  )}
                </strong>
                <span>{text(`${count} lần`, `${count} ${count === 1 ? "title" : "titles"}`)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className="tn-block">
        <div className="tn-heading">
          <h2>{text("Các mùa giải", "Seasons")}</h2>
        </div>
        <ol className="tn-honours">
          {years.map(({ year, seasons }) => (
            <li key={year ?? "unknown"}>
              <h3>{year ?? text("Chưa rõ năm", "Unknown year")}</h3>
              <ul>
                {seasons.map((season) => (
                  <HonourLine key={season.view.id} season={season} circuit={circuit} year={year} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}

function HonourLine({
  season: { view, champion, parts },
  circuit,
  year,
}: {
  season: HonourSeason
  circuit: string
  year: number | null
}) {
  const { text } = useStreamLocale()
  const { tournament } = view.content
  const status = competitionStatus(view.content)
  const named = seasonName(tournament.name, circuit)
  const days = dayRange(tournament.startsOn, tournament.endsOn, text("Chờ lịch", "To be scheduled"))
  return (
    <li className="tn-honour">
      <Link to={`/competitions/${view.id}`}>
        {champion ? <Crest team={champion.winner} /> : <span className="tn-honour-open" aria-hidden="true" />}
        <span>
          <span className="tn-honour-season">
            {(year ? seasonOfYear(named, year) : named) || shortCompetitionName(view)}
          </span>
          {champion ? (
            <>
              <strong>
                <span className="sr-only">{text("Nhà vô địch:", "Champion:")} </span>
                {champion.winner.name}
              </strong>
              <span>
                {champion.runnerUp
                  ? champion.score
                    ? text(
                        `thắng ${champion.score} ${champion.runnerUp.name}`,
                        `beat ${champion.runnerUp.name} ${champion.score}`,
                      )
                    : text(`á quân ${champion.runnerUp.name}`, `runner-up ${champion.runnerUp.name}`)
                  : days}
              </span>
            </>
          ) : (
            <>
              {status && status !== "FINISHED" && (
                <span className="tn-honour-state">
                  <StatusBadge status={status} size="small" />
                  <CompetitionClock entry={view} />
                </span>
              )}
              <span>{days}</span>
            </>
          )}
        </span>
      </Link>
      {parts.length > 0 && (
        <p>
          {parts.map((part) => (
            <Link key={part.id} to={`/competitions/${part.id}`} title={part.content.tournament.name}>
              {seasonName(part.content.tournament.name, tournament.name)}
            </Link>
          ))}
        </p>
      )}
    </li>
  )
}
