import type { RosterMembershipContent } from "@aov/community-contracts"
import { Crown, Info, RotateCcw, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { Textarea } from "@aov/ui/components/textarea"
import { cn } from "@aov/ui/lib/utils"
import { NativeSelect } from "@/components/native-select"
import { LaneIcon, PlayerPhoto } from "@/features/esports/components/primitives"
import { LANE_LABELS, LANE_ORDER } from "@/lib/lanes"
import { lineChanged, type RosterLine } from "../model/roster-board-model"
import { ROSTER_STATUSES } from "../model/roster-model"
import { RESULT_VERIFICATIONS } from "./tournament-metadata"

const SHORT_STATUSES = [
  ["ACTIVE", "Chính"],
  ["SUBSTITUTE", "Dự bị"],
  ["INACTIVE", "Đã rời"],
] as const

/**
 * One player of the roster: lane, standing and the captain's crown are one click each, the source and dates wait behind
 * a button.
 */
export function RosterBoardRow({
  line,
  name,
  photoUrl,
  disabled,
  onChange,
  onCaptain,
  onRemove,
  onRestore,
}: {
  line: RosterLine
  name: string
  photoUrl?: string
  disabled: boolean
  onChange: (patch: Partial<RosterMembershipContent>) => void
  /** Makes this player the team's captain, or no longer one. */
  onCaptain: () => void
  onRemove: () => void
  onRestore: () => void
}) {
  const { content } = line
  const changed = lineChanged(line)
  const status = content.status ?? "UNKNOWN"
  const hasSource = !!content.sourceUrl?.trim()
  const captain = content.captain === true
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2 last:border-b-0",
        changed && "bg-(--aov-accent-soft)",
      )}
    >
      <span className={cn("flex min-w-40 flex-1 items-center gap-3", line.removed && "opacity-60")}>
        <PlayerPhoto name={name} url={photoUrl} size={36} />
        <span className="min-w-0">
          <span className={cn("type-body block truncate", line.removed && "line-through")}>{name}</span>
          <span className="type-meta block">
            {line.removed ? "Sẽ bỏ khỏi đội hình" : !line.stored ? "Mới thêm" : ROSTER_STATUSES[status]}
            {captain && !line.removed && " · Đội trưởng"}
          </span>
        </span>
        {!line.removed && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-pressed={captain}
            aria-label={`${name} là đội trưởng`}
            title={captain ? "Đội trưởng · bấm để bỏ" : "Chọn làm đội trưởng"}
            onClick={onCaptain}
            className={cn(
              "ml-auto shrink-0",
              captain ? "text-(--aov-warning)" : "text-muted-foreground/50 hover:text-(--aov-warning)",
            )}
          >
            <Crown aria-hidden className={cn(captain && "fill-current")} />
          </Button>
        )}
      </span>
      {line.removed ? (
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRestore}>
          <RotateCcw aria-hidden /> Giữ lại
        </Button>
      ) : (
        <>
          <span className="flex rounded-md border bg-background p-0.5" role="group" aria-label={`Vị trí của ${name}`}>
            {LANE_ORDER.map((lane) => (
              <button
                key={lane}
                type="button"
                disabled={disabled}
                aria-pressed={content.lane === lane}
                aria-label={LANE_LABELS[lane].name}
                title={LANE_LABELS[lane].name}
                onClick={() => onChange({ lane: content.lane === lane ? null : lane })}
                className={cn(
                  "grid size-8 place-items-center rounded transition-colors",
                  content.lane === lane ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <LaneIcon lane={lane} size={18} />
              </button>
            ))}
          </span>
          <span
            className="flex rounded-md border bg-background p-0.5"
            role="group"
            aria-label={`Trạng thái của ${name}`}
          >
            {SHORT_STATUSES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={disabled}
                aria-pressed={status === value}
                onClick={() => onChange({ status: status === value ? "UNKNOWN" : value })}
                className={cn(
                  "type-label h-8 rounded px-2.5 whitespace-nowrap",
                  status === value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </span>
          <Input
            aria-label={`Số áo của ${name}`}
            className="w-16 bg-background text-center"
            placeholder="Số áo"
            maxLength={20}
            disabled={disabled}
            value={content.jerseyNumber ?? ""}
            onChange={(event) => onChange({ jerseyNumber: event.target.value || null })}
          />
          <span className="flex items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  className={cn(hasSource && "text-(--aov-success)")}
                  aria-label={`Nguồn, thời gian và ghi chú của ${name}`}
                  title={RESULT_VERIFICATIONS[content.verification ?? "UNVERIFIED"]}
                >
                  <Info aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <LineDetails content={content} onChange={onChange} />
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label={`Bỏ ${name} khỏi đội hình`}
              title="Bỏ khỏi đội hình"
              onClick={onRemove}
            >
              <X aria-hidden />
            </Button>
          </span>
        </>
      )}
    </li>
  )
}

function LineDetails({
  content,
  onChange,
}: {
  content: RosterMembershipContent
  onChange: (patch: Partial<RosterMembershipContent>) => void
}) {
  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5">
        <span className="type-label">Nguồn kiểm chứng</span>
        <Input
          type="url"
          placeholder="https://…"
          maxLength={2048}
          value={content.sourceUrl ?? ""}
          onChange={(event) => onChange({ sourceUrl: event.target.value.trim() || null })}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="type-label">Mức kiểm chứng</span>
        <NativeSelect
          className="w-full"
          value={content.verification ?? "UNVERIFIED"}
          onChange={(event) =>
            onChange({ verification: event.target.value as RosterMembershipContent["verification"] })
          }
        >
          {Object.entries(RESULT_VERIFICATIONS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1.5">
          <span className="type-label">Từ ngày</span>
          <Input
            type="date"
            value={content.startsOn ?? ""}
            onChange={(event) => onChange({ startsOn: event.target.value || null })}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="type-label">Đến ngày</span>
          <Input
            type="date"
            value={content.endsOn ?? ""}
            onChange={(event) => onChange({ endsOn: event.target.value || null })}
          />
        </label>
      </div>
      <label className="grid gap-1.5">
        <span className="type-label">Ghi chú</span>
        <Textarea
          rows={2}
          maxLength={2000}
          value={content.note ?? ""}
          onChange={(event) => onChange({ note: event.target.value || null })}
        />
      </label>
    </div>
  )
}
