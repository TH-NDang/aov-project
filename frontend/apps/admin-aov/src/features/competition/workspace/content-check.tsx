import { useState } from "react"
import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { LocalTime } from "@aov/ui/components/local-time"
import { cn } from "@aov/ui/lib/utils"
import type { ContentVerification } from "@aov/community-contracts"
import type { PartCheck } from "../model/content-checks"
import { Panel, Progress, type Workspace } from "./parts"

const MOMENT = { dateStyle: "short", timeStyle: "short" } as const

function Who({ mark }: { mark: ContentVerification }) {
  return (
    <>
      {mark.verifiedByName || "Không rõ người"} · <LocalTime value={mark.verifiedAt} format={MOMENT} />
    </>
  )
}

/**
 * Whether the person checked this part by hand: a mark of the version on screen, of an older one, or none. Only Admin
 * shows it. `compact` keeps it to an icon and a short word, for a row with little room.
 */
export function CheckMark({ ws, part, compact }: { ws: Workspace; part: string; compact?: boolean }) {
  const checks = ws.verification
  const row = checks?.of(part)
  if (!checks?.ready || !row) return null
  return <CheckControl row={row} blocked={checks.blocked} saving={checks.saving === part} compact={compact} ws={ws} />
}

function CheckControl({
  ws,
  row,
  blocked,
  saving,
  compact,
}: {
  ws: Workspace
  row: PartCheck
  blocked?: string
  saving: boolean
  compact?: boolean
}) {
  const checks = ws.verification!
  // Taking a check back needs the right to publish only; marking also needs the draft saved, so the mark names what
  // the person sees.
  const mayUndo = ws.access.canPublish && !saving
  const mayMark = !blocked && !saving
  if (row.state === "unchecked")
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!mayMark}
        title={blocked ?? `Đánh dấu ${row.label} đã kiểm chứng`}
        aria-label={`Đánh dấu ${row.label} đã kiểm chứng`}
        onClick={() => checks.mark(row)}
      >
        <ShieldQuestion aria-hidden />
        {compact ? "Kiểm chứng" : "Đánh dấu đã kiểm chứng"}
      </Button>
    )
  const checked = row.state === "checked"
  const Icon = checked ? ShieldCheck : ShieldAlert
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={saving}
          aria-label={`${row.label}: ${checked ? "đã kiểm chứng" : "đã đổi sau lần kiểm chứng"}`}
          className={cn(
            checked
              ? "bg-(--aov-success-soft) text-(--aov-success) hover:bg-(--aov-success-soft) hover:text-(--aov-success)"
              : "bg-(--aov-warning-soft) text-(--aov-warning) hover:bg-(--aov-warning-soft) hover:text-(--aov-warning)",
          )}
        >
          <Icon aria-hidden />
          {checked ? "Đã kiểm chứng" : compact ? "Đã đổi" : "Đã đổi sau kiểm chứng"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <p className="type-meta px-2 py-1.5">
          {checked ? "Đã kiểm chứng bản này: " : "Bản cũ được kiểm chứng: "}
          {row.mark && <Who mark={row.mark} />}
        </p>
        <DropdownMenuSeparator />
        {!checked && (
          <DropdownMenuItem disabled={!mayMark} onSelect={() => checks.mark(row)}>
            <ShieldCheck aria-hidden />
            {blocked ?? "Đánh dấu bản này đã kiểm chứng"}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem disabled={!mayUndo} onSelect={() => checks.unmark(row)}>
          <ShieldQuestion aria-hidden />
          Bỏ dấu kiểm chứng
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Parts listed before the rest wait behind a "show all" button: a season of sixteen teams would fill a phone. */
const WAITING_ROWS = 6
const ORDER = { changed: 0, unchecked: 1, checked: 2 } as const

/**
 * The parts of the tournament that still wait for a check, changed ones first, each with the way to it; every part,
 * checked ones too, on request.
 */
export function ContentChecksPanel({ ws }: { ws: Workspace }) {
  const [all, setAll] = useState(false)
  const checks = ws.verification
  if (!checks) return null
  const { total, checked, changed } = checks.totals
  const waiting = checks.parts.filter((row) => row.state !== "checked").sort((a, b) => ORDER[a.state] - ORDER[b.state])
  const shown = all ? checks.parts : waiting.slice(0, WAITING_ROWS)
  return (
    <Panel
      title="Kiểm chứng của bạn"
      icon={ShieldCheck}
      meta={checks.ready ? `${checked}/${total} phần` : undefined}
      label="Kiểm chứng của bạn"
    >
      {!checks.ready ? (
        <p className="type-meta px-4 py-3">Đang đọc các dấu kiểm chứng…</p>
      ) : (
        <>
          <div className="space-y-1.5 border-b px-4 py-3">
            <Progress value={checked} total={total} tone={total > 0 && checked === total ? "ok" : "gold"} />
            <p className="type-meta">
              {checked === total
                ? "Mọi phần đều đã được bạn kiểm chứng."
                : changed
                  ? `${changed} phần đã đổi sau lần kiểm chứng.`
                  : "Đánh dấu từng phần sau khi bạn đã tự đối chiếu với nguồn."}
            </p>
          </div>
          <ul>
            {shown.map((row) => (
              <li key={row.part} className="flex items-center gap-3 border-b px-4 py-2 last:border-b-0">
                <button
                  type="button"
                  title={`Mở ${row.label}`}
                  className="type-body min-w-0 flex-1 truncate text-left outline-none hover:underline focus-visible:underline"
                  onClick={() => ws.go(row.step, row.focus)}
                >
                  {row.label}
                </button>
                <CheckMark ws={ws} part={row.part} compact />
              </li>
            ))}
          </ul>
          {(all || shown.length < total) && (
            <div className="border-t px-2 py-1.5">
              <Button type="button" variant="ghost" size="sm" aria-expanded={all} onClick={() => setAll(!all)}>
                {all ? "Chỉ hiện phần chưa kiểm chứng" : `Xem cả ${total} phần`}
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  )
}
