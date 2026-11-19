import type { CompetitionView } from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-lane-icon"
import { StreamImage } from "../../components/stream-image"
import { useStreamLocale } from "../../components/stream-locale"
import { EntityPageLink } from "../../components/public-competitions"
import { LANE_NAMES } from "../../lib/tournament-model"
import { teamRoster } from "./competition-page-model"

/** The teams taking part, each with its roster for this competition. */
export function CompetitionTeams({ view }: { view: CompetitionView }) {
  const { text } = useStreamLocale()
  const { plan, teams, players, rosters } = view.content
  if (!plan.entrants.length)
    return (
      <div className="hub-state">
        <h2>{text("Chưa có đội tham dự được công bố", "No participating teams published yet")}</h2>
      </div>
    )
  const withoutRoster = plan.entrants.filter((entrant) => !rosters.some((row) => row.teamId === entrant.teamId)).length
  return (
    <div className="tn-stack">
      {withoutRoster > 0 && (
        <p className="cp-muted">
          {withoutRoster === plan.entrants.length
            ? text("Đội hình của các đội chưa được công bố.", "The teams' rosters have not been published yet.")
            : text(
                `${withoutRoster} trong ${plan.entrants.length} đội chưa công bố đội hình.`,
                `${withoutRoster} of ${plan.entrants.length} teams have not published a roster yet.`,
              )}
        </p>
      )}
      <div className="tn-team-grid">
        {plan.entrants.map((entrant) => {
          const team = teams[entrant.teamId]
          const name = team?.name || text("Đội chưa có thông tin", "No team information yet")
          const roster = teamRoster(rosters, entrant.teamId)
          return (
            <section className="tn-team-card" key={entrant.teamId}>
              <h2>
                <StreamImage src={team?.logoUrl} name={team?.shortName || name} />
                <EntityPageLink kind="TEAM" id={entrant.teamId} name={name} />
                {entrant.status === "WITHDRAWN" && <span className="cp-badge">{text("Đã rút lui", "Withdrawn")}</span>}
              </h2>
              {roster.length > 0 && (
                <ul>
                  {roster.map((row) => (
                    <li key={row.playerId} data-bench={(row.status && row.status !== "ACTIVE") || undefined}>
                      <span
                        className="tn-lane"
                        title={
                          row.lane
                            ? text(LANE_NAMES[row.lane][0], LANE_NAMES[row.lane][1])
                            : text("Chưa rõ vị trí", "Unknown position")
                        }
                      >
                        {row.lane ? (
                          <HeroLaneIcon
                            lane={row.lane}
                            size={18}
                            label={text(LANE_NAMES[row.lane][0], LANE_NAMES[row.lane][1])}
                          />
                        ) : (
                          "?"
                        )}
                      </span>
                      <EntityPageLink
                        kind="PLAYER"
                        id={row.playerId}
                        name={players[row.playerId]?.nickname || text("Tuyển thủ", "Player")}
                      />
                      <small>
                        {row.status === "SUBSTITUTE"
                          ? text("Dự bị", "Substitute")
                          : row.status === "INACTIVE"
                            ? text("Không thi đấu", "Inactive")
                            : row.status === "ACTIVE"
                              ? row.lane
                                ? text(LANE_NAMES[row.lane][0], LANE_NAMES[row.lane][1])
                                : ""
                              : text("Chưa xác nhận", "Unconfirmed")}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
