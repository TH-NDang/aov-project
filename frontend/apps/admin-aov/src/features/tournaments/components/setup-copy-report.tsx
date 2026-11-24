import { CircleCheck, CircleDashed, CircleX, LoaderCircle, MinusCircle } from "lucide-react"
import { COPY_PART_LABELS } from "@/features/competition/model/copy-setup"
import { tournamentError } from "../api/tournament-api"
import type { PartOutcome } from "../model/setup-copy-runner"
import { partCount } from "./copy-source-fields"

const STATES: Record<PartOutcome["state"], { icon: typeof CircleCheck; label: string; className: string }> = {
  waiting: { icon: CircleDashed, label: "Đang chờ", className: "text-muted-foreground" },
  running: { icon: LoaderCircle, label: "Đang chép…", className: "animate-spin text-primary" },
  done: { icon: CircleCheck, label: "Đã chép", className: "text-(--aov-success)" },
  failed: { icon: CircleX, label: "Chưa chép được", className: "text-destructive" },
  skipped: { icon: MinusCircle, label: "Chưa chép vì chưa có đội tham dự", className: "text-(--aov-warning)" },
}

function detail(row: PartOutcome) {
  // A roster takes several writes, so a failure in between leaves some lines behind.
  if (row.part === "rosters" && row.total !== undefined && row.count !== row.total)
    return `${row.count ?? 0}/${row.total} tuyển thủ`
  return row.state === "done" ? partCount(row.part, row.count) : ""
}

/** What the setup copy has done so far, part by part, with the reason beside a part that failed. */
export function SetupCopyReport({ outcomes }: { outcomes: PartOutcome[] }) {
  return (
    <ul className="divide-y rounded-lg border" role="status">
      {outcomes.map((row) => {
        const { icon: Icon, label, className } = STATES[row.state]
        const count = detail(row)
        return (
          <li key={row.part} className="flex items-start gap-3 px-3 py-2.5">
            <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${className}`} />
            <span className="min-w-0 flex-1">
              <span className="type-body block">{COPY_PART_LABELS[row.part]}</span>
              <span className="type-meta block">{[label, count].filter(Boolean).join(" · ")}</span>
              {row.state === "failed" && (
                <span className="type-meta block text-destructive">{tournamentError(row.error)}</span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
