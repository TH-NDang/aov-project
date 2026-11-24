import { useState } from "react"
import type { DocumentView, TournamentContent } from "@aov/community-contracts"
import { AlertTriangle, CircleDot, Layers, LoaderCircle, Trash2, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { Progress } from "@aov/ui/components/progress"
import { STATUS_LABELS } from "@/features/esports/model/labels"
import { STATUS_ORDER } from "../model/tournament-status"
import { RecordPicker } from "./record-picker"
import type { useTournamentChanges } from "./use-tournament-changes"

type Changes = ReturnType<typeof useTournamentChanges>

/** The actions on the ticked tournaments, docked at the bottom of the page; also how a run goes and how it ended. */
export function TournamentBulkBar({
  selected,
  changes,
  onClear,
}: {
  selected: DocumentView<TournamentContent>[]
  changes: Changes
  onClear: () => void
}) {
  const [attaching, setAttaching] = useState(false)
  const { progress, report } = changes
  if (!selected.length && !progress && !report) return null
  return (
    <div
      role="region"
      aria-label="Thao tác với giải đã chọn"
      className="sticky bottom-3 z-30 mx-auto grid w-fit max-w-full gap-2 rounded-xl border bg-popover px-3 py-2 shadow-lg"
    >
      {report && (
        <div role="alert" className="flex items-start gap-2 border-b pb-2">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-(--aov-warning)" />
          <div className="min-w-0 flex-1">
            <p className="type-body">
              {report.summary} {report.failures.length} giải chưa xong:
            </p>
            <ul className="mt-1 max-h-40 overflow-y-auto">
              {report.failures.map((row) => (
                <li key={row.id} className="type-meta">
                  <span className="text-foreground">{row.name}</span> · {row.reason}
                </li>
              ))}
            </ul>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Đóng báo cáo" onClick={changes.dismiss}>
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
      )}
      {progress ? (
        <div role="status" className="grid min-w-64 gap-2 py-1">
          <p className="type-body flex items-center gap-2">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            {progress.label} · {progress.done}/{progress.total}
          </p>
          <Progress aria-label={progress.label} value={(progress.done / progress.total) * 100} />
        </div>
      ) : (
        selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="type-body mr-1 tabular-nums">{selected.length} giải đã chọn</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <CircleDot aria-hidden="true" />
                  Đổi trạng thái
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {STATUS_ORDER.map((status) => (
                  <DropdownMenuItem key={status} onSelect={() => void changes.changeStatus(selected, status)}>
                    {STATUS_LABELS[status]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover open={attaching} onOpenChange={setAttaching}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Layers aria-hidden="true" />
                  Gắn vào giải chính
                </Button>
              </PopoverTrigger>
              <PopoverContent align="center" className="grid w-80 max-w-[calc(100vw-2rem)] gap-2">
                <span className="type-label">Giải chính</span>
                <RecordPicker
                  kind="tournaments"
                  label="Giải chính"
                  placeholder="Chọn giải chính"
                  value={null}
                  context={{ level: "MAIN" }}
                  exclude={selected.map((entry) => entry.id)}
                  onChange={(id, name) => {
                    setAttaching(false)
                    if (id) void changes.attach(selected, { id, name })
                  }}
                />
              </PopoverContent>
            </Popover>
            <Button type="button" variant="outline" size="sm" onClick={() => void changes.trash(selected)}>
              <Trash2 aria-hidden="true" className="text-destructive" />
              Đưa vào thùng rác
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              <X aria-hidden="true" />
              Bỏ chọn
            </Button>
          </div>
        )
      )}
    </div>
  )
}
