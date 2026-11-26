import { useQuery } from "@tanstack/react-query"
import type { CompetitionView, Lane, RosterMembershipContent } from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { CaptainBadge } from "../../../components/captain-badge"
import { EntityPageLink, GoLink } from "../../../components/go-link"
import { Stage } from "../../../components/stage"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionMatches, type CompetitionMatch } from "../../../lib/match-model"
import { statsHref } from "../../../lib/statistics-routes"
import { teamForm, teamRecord } from "../../../lib/standings-model"
import { statisticsQuery } from "../../../lib/tournament-api"
import { LANE_NAMES } from "../../../lib/tournament-model"
import { TeamStaff } from "./competition-people"
import { FormMarks } from "./form-marks"
import "./competition-teams.css"

const LANE_ORDER: Lane[] = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"]
const ROSTER_ORDER = ["ACTIVE", "SUBSTITUTE", "UNKNOWN", "INACTIVE"]

/** Starters in lane order, then substitutes, then those not confirmed and those who do not play. */
const rosterOrder = (row: RosterMembershipContent) =>
  ROSTER_ORDER.indexOf(row.status ?? "UNKNOWN") * 10 + (row.lane ? LANE_ORDER.indexOf(row.lane) : 9)

/**
 * One member of a roster: the lane as its mark, the nickname with the captain's mark, and the standing when it is not a
 * starter.
 */
function Member({ view, row }: { view: CompetitionView; row: RosterMembershipContent }) {
  const { text } = useStreamLocale()
  const lane = row.lane ? text(LANE_NAMES[row.lane][0], LANE_NAMES[row.lane][1]) : null
  const standing =
    row.status === "SUBSTITUTE"
      ? text("Dự bị", "Substitute")
      : row.status === "INACTIVE"
        ? text("Không thi đấu", "Inactive")
        : row.status === "ACTIVE"
          ? lane
          : text("Chưa xác nhận", "Unconfirmed")
  return (
    <li data-bench={(row.status && row.status !== "ACTIVE") || undefined}>
      <span className="tn-squad-lane" title={lane ?? text("Chưa rõ vị trí", "Unknown position")}>
        {row.lane ? <HeroLaneIcon lane={row.lane} size={20} label={lane!} /> : "?"}
      </span>
      <span className="tn-squad-name">
        <EntityPageLink
          kind="PLAYER"
          id={row.playerId}
          name={view.content.players[row.playerId]?.nickname || text("Tuyển thủ", "Player")}
        />
        {row.captain && <CaptainBadge />}
      </span>
      <small>{standing}</small>
    </li>
  )
}

/**
 * A team of a competition: its logo on a stage of its own light, how it is doing, its roster and its staff. Where the
 * competition counts published games, a team that has played leads to its own statistics.
 */
function Squad({
  view,
  teamId,
  entries,
  counted,
}: {
  view: CompetitionView
  teamId: string
  entries: CompetitionMatch[]
  counted: boolean
}) {
  const { text } = useStreamLocale()
  const { tournament, plan, teams, rosters, people } = view.content
  const team = teams[teamId]
  const name = team?.name || text("Đội chưa có thông tin", "No team information yet")
  const roster = rosters.filter((row) => row.teamId === teamId).sort((a, b) => rosterOrder(a) - rosterOrder(b))
  const record = teamRecord(entries, teamId)
  const withdrawn = plan.entrants.some((entrant) => entrant.teamId === teamId && entrant.status === "WITHDRAWN")
  return (
    <section className="tn-squad">
      <Stage
        tint={name}
        lights={[{ src: team?.logoUrl, darkSrc: team?.logoDarkUrl, at: "left" }]}
        className="tn-squad-head"
      >
        <StreamImage src={team?.logoUrl} darkSrc={team?.logoDarkUrl} logo name={team?.shortName || name} />
        <div>
          <h2>
            <EntityPageLink kind="TEAM" id={teamId} name={name} />
          </h2>
          {withdrawn ? (
            <span>{text("Đã rút lui", "Withdrawn")}</span>
          ) : record.played > 0 ? (
            <span>
              {text(`${record.won} thắng, ${record.lost} thua`, `${record.won} won, ${record.lost} lost`)}
              <FormMarks marks={teamForm(entries, teamId)} />
              {counted && (
                <GoLink
                  to={statsHref(view.id, { part: "teams", team: teamId })}
                  aria-label={text(`Thống kê của ${name} ở giải này`, `Statistics of ${name} in this tournament`)}
                >
                  {text("Thống kê", "Statistics")}
                </GoLink>
              )}
            </span>
          ) : null}
        </div>
      </Stage>
      {roster.length > 0 && (
        <ul className="tn-squad-roster">
          {roster.map((row) => (
            <Member key={`${row.playerId}:${row.lane}`} view={view} row={row} />
          ))}
        </ul>
      )}
      <TeamStaff staff={tournament.staff} teamId={teamId} people={people} />
    </section>
  )
}

/** The teams of a competition. Teams with a roster come first; one sentence says how many have none. */
export function CompetitionTeams({ view }: { view: CompetitionView }) {
  const { text } = useStreamLocale()
  const { plan, rosters } = view.content
  const statistics = useQuery(statisticsQuery(view.id))
  const counted = (statistics.data?.games ?? 0) > 0
  if (!plan.entrants.length)
    return (
      <div className="hub-state">
        <h2>{text("Chưa có đội tham dự được công bố", "No participating teams published yet")}</h2>
      </div>
    )
  const entries = competitionMatches([view])
  const listed = new Set(rosters.map((row) => row.teamId))
  const ordered = [...plan.entrants].sort((a, b) => Number(listed.has(b.teamId)) - Number(listed.has(a.teamId)))
  const without = plan.entrants.filter((entrant) => !listed.has(entrant.teamId)).length
  return (
    <div className="tn-stack">
      {without > 0 && (
        <p className="tn-quiet">
          {without === plan.entrants.length
            ? text("Đội hình của các đội chưa được công bố.", "The teams' rosters have not been published yet.")
            : text(
                `${without} trong ${plan.entrants.length} đội chưa công bố đội hình.`,
                `${without} of ${plan.entrants.length} teams have not published a roster yet.`,
              )}
        </p>
      )}
      <div className="tn-squads">
        {ordered.map((entrant) => (
          <Squad key={entrant.teamId} view={view} teamId={entrant.teamId} entries={entries} counted={counted} />
        ))}
      </div>
    </div>
  )
}
