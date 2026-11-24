import type { CompetitionStage } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { TeamLogo } from "@/features/esports/components/primitives"
import type { Workspace } from "./parts"

/** Who plays a stage, such as the teams of one group. Nobody marked means every entrant. */
export function StageTeams({
  ws,
  stage,
  onChange,
}: {
  ws: Workspace
  stage: CompetitionStage
  onChange: (teamIds: string[]) => void
}) {
  const entrants = ws.plan.entrants.filter((entry) => entry.status !== "WITHDRAWN")
  const chosen = new Set(stage.teamIds ?? [])
  if (entrants.length < 3) return null
  const elsewhere = new Set(
    ws.plan.stages
      .filter((row) => row.code !== stage.code && row.format === stage.format)
      .flatMap((row) => row.teamIds ?? []),
  )
  const rest = entrants.filter((entry) => !elsewhere.has(entry.teamId)).map((entry) => entry.teamId)
  return (
    <fieldset className="space-y-3">
      <legend className="type-label text-muted-foreground">
        Đội của giai đoạn · {chosen.size || `cả ${entrants.length}`}
      </legend>
      <div className="flex flex-wrap gap-2">
        {entrants.map((entry) => {
          const team = ws.team(entry.teamId)
          const on = chosen.has(entry.teamId)
          return (
            <button
              key={entry.teamId}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onChange(
                  on
                    ? (stage.teamIds ?? []).filter((id) => id !== entry.teamId)
                    : [...(stage.teamIds ?? []), entry.teamId],
                )
              }
              className={cn(
                "type-body inline-flex min-h-10 items-center gap-2 rounded-md border px-3 transition-colors",
                on ? "border-primary bg-(--aov-accent-soft)" : "bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              <TeamLogo team={team} size={24} /> {team.name}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {elsewhere.size > 0 && rest.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(rest)}>
            Chọn {rest.length} đội chưa thuộc bảng khác
          </Button>
        )}
        {chosen.size > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
            Mọi đội tham dự
          </Button>
        )}
      </div>
    </fieldset>
  )
}
