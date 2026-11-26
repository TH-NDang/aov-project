import type { ReactNode } from "react"
import { Button } from "@aov/ui/components/button"
import { TeamLogo } from "@/features/esports/components/primitives"
import type { FinalOutcome, FinalRow } from "./final-state"
import type { Workspace } from "./parts"

function Note({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-4 py-2.5">
      <div className="min-w-0 space-y-1.5">
        <p className="type-meta">{title}</p>
        {children}
      </div>
      {action}
    </li>
  )
}

/** Rows by the reason they share, in the order the reasons first appear. */
function byReason(rows: FinalRow[]) {
  const groups = new Map<string, FinalRow[]>()
  for (const row of rows) groups.set(row.reason ?? "", [...(groups.get(row.reason ?? "") ?? []), row])
  return [...groups]
}

/** Under the final table: the teams nothing places, the places nothing confirms and why teams share one. */
export function FinalNotes({ ws, outcome }: { ws: Workspace; outcome: FinalOutcome }) {
  const { rows, over, suggestions } = outcome
  // While the tournament goes on, a team without a place has simply not finished.
  const open = over ? byReason(rows.filter((row) => row.state === "OPEN")) : []
  const unconfirmed = byReason(rows.filter((row) => row.state === "RECORDED"))
  const { level } = suggestions
  if (!open.length && !unconfirmed.length && !level.length) return null
  return (
    <ul>
      {open.map(([reason, teams]) => (
        <Note key={`open-${reason}`} title={`Chưa rõ hạng của ${teams.length} đội. ${reason}.`}>
          <p className="flex flex-wrap gap-x-4 gap-y-1.5">
            {teams.map((row) => (
              <span key={row.key} className="type-body inline-flex items-center gap-2">
                <TeamLogo team={ws.team(row.teamId)} size={20} />
                {row.teamName}
              </span>
            ))}
          </p>
        </Note>
      ))}
      {unconfirmed.map(([reason, teams]) => (
        <Note
          key={`unconfirmed-${reason}`}
          title={`Không đối chiếu được ${teams.map((row) => row.teamName).join(", ")}. ${reason}.`}
        />
      ))}
      {level.length > 0 && (
        <Note
          title={`${level.map((stage) => stage.name).join(" và ")} chưa ghi tiêu chí phụ, nên các đội bằng điểm được xếp đồng hạng.`}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => ws.go("format", { stage: level[0]!.code, open: "stage" })}
            >
              Mở thể thức
            </Button>
          }
        />
      )}
    </ul>
  )
}
