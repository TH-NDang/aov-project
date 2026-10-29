import type { ReactNode } from "react"
import type { Lane, RosterStatus } from "@aov/community-contracts"
import { cn } from "@aov/ui/lib/utils"
import { LANE_ORDER } from "../model/labels"
import type { TeamView } from "../model/game-view"
import { LaneIcon, PlayerPhoto, RegionFlag, TeamLogo } from "./primitives"

export type RosterMember = { id: string; name: string; lane?: Lane | null; status?: RosterStatus; photoUrl?: string }
export type TeamEntry = { team: TeamView; members: RosterMember[] }

const STATUS_TEXT: Partial<Record<RosterStatus, string>> = {
  SUBSTITUTE: "Dự bị",
  INACTIVE: "Đã rời",
  UNKNOWN: "Chưa rõ",
}

const laneRank = (lane?: Lane | null) => (lane ? LANE_ORDER.indexOf(lane) : 9)
const statusRank = (status?: RosterStatus) =>
  ({ ACTIVE: 0, SUBSTITUTE: 1, UNKNOWN: 2, INACTIVE: 3 })[status ?? "UNKNOWN"]

export function ParticipantsGrid({
  entries,
  onTeam,
  teamAction,
}: {
  entries: TeamEntry[]
  onTeam?: (teamId: string) => void
  teamAction?: (team: TeamView) => ReactNode
}) {
  return (
    <div className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
      {entries.map(({ team, members }) => {
        const sorted = [...members].sort(
          (a, b) => statusRank(a.status) - statusRank(b.status) || laneRank(a.lane) - laneRank(b.lane),
        )
        return (
          <article key={team.id} className="overflow-hidden rounded-xl border bg-card">
            <header className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2.5">
              <TeamLogo team={team} size={36} />
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={onTeam ? () => onTeam(team.id) : undefined}
                disabled={!onTeam}
              >
                <span className="block truncate font-semibold">{team.name}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {team.shortName}
                  {team.country && <RegionFlag code={team.country} withName={false} />}
                </span>
              </button>
              {teamAction?.(team)}
            </header>
            {sorted.length ? (
              <ul className="divide-y">
                {sorted.map((member) => (
                  <li
                    key={member.id}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 text-sm",
                      member.status === "INACTIVE" && "text-muted-foreground line-through decoration-1",
                    )}
                  >
                    <PlayerPhoto name={member.name} url={member.photoUrl} size={24} />
                    <span className="min-w-0 flex-1 truncate font-medium">{member.name}</span>
                    {member.status && STATUS_TEXT[member.status] && (
                      <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground no-underline">
                        {STATUS_TEXT[member.status]}
                      </span>
                    )}
                    <span className="flex w-6 justify-end text-xs text-muted-foreground">
                      {member.lane ? <LaneIcon lane={member.lane} size={16} /> : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-4 text-sm text-muted-foreground">Chưa ghi đội hình đăng ký.</p>
            )}
          </article>
        )
      })}
    </div>
  )
}
