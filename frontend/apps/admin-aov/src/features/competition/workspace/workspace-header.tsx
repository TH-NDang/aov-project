import { useState } from "react"
import {
  ChevronRight,
  CopyPlus,
  Ellipsis,
  ExternalLink,
  History,
  Redo2,
  RotateCcw,
  Save,
  Send,
  Trophy,
  Undo2,
} from "lucide-react"
import type { CompetitionView } from "@aov/community-contracts"
import { Avatar, AvatarFallback, AvatarImage } from "@aov/ui/components/avatar"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { publicSite } from "@/features/community/api/page-api"
import { StatusPill, TierBadge } from "@/features/esports/components/primitives"
import { tournamentDates } from "@/features/tournaments/components/tournament-metadata"
import { useThemedLogo } from "@/lib/themed-logo"
import type { DraftChange } from "../model/plan-draft"
import { STEP_LABELS, type WorkspaceStep } from "./model"
import { Chip, type Workspace } from "./parts"

export type HeaderActions = {
  save: () => void
  discard: () => void
  publish: () => void
  undo: () => void
  redo: () => void
  openHistory: () => void
  openCopy: () => void
}

/** The tournament's name and state, and everything that acts on the whole draft. */
export function WorkspaceHeader({
  ws,
  entry,
  notice,
  changes,
  pending,
  blocked,
  canUndo,
  canRedo,
  actions,
}: {
  ws: Workspace
  entry: CompetitionView
  notice: string
  /** What saving would write. */
  changes: DraftChange[]
  /** How many changes readers do not see yet. */
  pending: number
  blocked: boolean
  canUndo: boolean
  canRedo: boolean
  actions: HeaderActions
}) {
  const info = entry.content.tournament
  const logo = useThemedLogo(info.logoUrl, info.logoDarkUrl)
  const { access, dirty, busy } = ws
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-14 rounded-lg border bg-background">
          <AvatarImage src={logo.url} alt="" className="object-contain" data-logo-plate={logo.plate} />
          <AvatarFallback className="rounded-lg">
            <Trophy className="size-6" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="type-page-title">{info.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Chip tone={entry.publishedAt ? "ok" : "warn"}>{entry.publishedAt ? "Đã công bố" : "Bản nháp"}</Chip>
            <StatusPill status={info.status} />
            <TierBadge tier={info.tier} compact />
            {tournamentDates(info) && <Chip>{tournamentDates(info)}</Chip>}
            <Chip>{ws.plan.entrants.length} đội</Chip>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-meta" role="status">
          {busy ? "Đang ghi…" : dirty ? "" : notice || "Bản nháp đã lưu"}
        </span>
        {access.canWrite && dirty && !busy && <DraftChanges changes={changes} go={ws.go} />}
        {access.canWrite && (canUndo || canRedo) && (
          <span className="flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Hoàn tác thay đổi trong bản nháp"
              title="Hoàn tác (Ctrl+Z)"
              disabled={busy || !canUndo}
              onClick={actions.undo}
            >
              <Undo2 aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Làm lại thay đổi trong bản nháp"
              title="Làm lại (Ctrl+Shift+Z)"
              disabled={busy || !canRedo}
              onClick={actions.redo}
            >
              <Redo2 aria-hidden />
            </Button>
          </span>
        )}
        {access.canWrite && (
          <Button
            type="button"
            variant={entry.publishedAt && !dirty ? "outline" : "default"}
            disabled={busy || !dirty}
            title="Lưu bản nháp (Ctrl+S)"
            onClick={actions.save}
          >
            <Save aria-hidden /> Lưu bản nháp
          </Button>
        )}
        {access.canPublish && entry.publishedAt && (pending > 0 || dirty) && (
          <Button type="button" disabled={busy || blocked} onClick={actions.publish}>
            <Send aria-hidden /> Cập nhật bản công bố{pending ? ` · ${pending}` : ""}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Thao tác khác của giải" title="Thao tác khác">
              <Ellipsis aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {entry.publishedAt && (
              <DropdownMenuItem asChild>
                <a href={`${publicSite}/competitions/${entry.id}`} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden /> Xem trang công khai
                </a>
              </DropdownMenuItem>
            )}
            {access.canWrite && (
              <DropdownMenuItem onSelect={actions.openCopy}>
                <CopyPlus aria-hidden /> Chép thiết lập từ giải khác
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={actions.openHistory}>
              <History aria-hidden /> Lịch sử bản nháp
            </DropdownMenuItem>
            {access.canWrite && dirty && (
              <DropdownMenuItem onSelect={actions.discard}>
                <RotateCcw aria-hidden /> Bỏ thay đổi chưa lưu
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

/** How many changes wait to be saved, and each of them with the step it was made in. */
function DraftChanges({ changes, go }: { changes: DraftChange[]; go: (step: WorkspaceStep) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="type-label inline-flex h-9 items-center gap-1.5 rounded-md bg-(--aov-warning-soft) px-3 text-(--aov-warning)"
        >
          {changes.length || 1} thay đổi chưa lưu
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <ul className="max-h-80 overflow-y-auto">
          {changes.map((change, index) => (
            <li key={index} className="border-b last:border-b-0">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/60"
                onClick={() => {
                  setOpen(false)
                  go(change.step)
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="type-body block">{change.text}</span>
                  <span className="type-meta block">{STEP_LABELS[change.step]}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
