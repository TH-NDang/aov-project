import { useId, useState, type ReactNode } from "react"
import type { Reference, Side } from "@aov/community-contracts"
import { Clock3, Save, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { cn } from "@aov/ui/lib/utils"
import type { GameSeat, GameView } from "../../model/game-view"
import {
  ITEM_ACTION_LABELS,
  KIND_LABELS,
  OBJECTIVE_LABELS,
  inventoryAt,
  newEventId,
  objectiveActor,
  otherSide,
  seatSide,
  type ItemAction,
  type ObjectiveKind,
  type SeatKey,
  type TimelineEvent,
  type TimelineKind,
} from "../../model/timeline"
import { formatClock, parseClock } from "../../model/vod"
import { HeroIcon, ItemSlot, LaneIcon, TimeTag, VIDEO_MARK, VideoMark } from "../primitives"
import { KIND_ICONS } from "./event-text"

type Draft = {
  kind: TimelineKind
  time: string
  killer?: SeatKey
  victim?: SeatKey
  assists: SeatKey[]
  objective: ObjectiveKind
  side: Side
  by?: SeatKey
  seat?: SeatKey
  action: ItemAction
  slot: number
  item: string
  title: string
  noteSide?: Side
  note: string
}

/** Maps between the broadcast and the game clock when the game is synced to its video. */
export type VideoClock = {
  /** Current player position, when the player has reported one. */
  now: number | null
  toVideo: (gameSecond: number) => number
  /** Game second at a video position, or null outside the game. */
  toGame: (videoSecond: number) => number | null
}

function fromEvent(event: TimelineEvent | undefined, at: number, kind: TimelineKind, video?: VideoClock): Draft {
  const base: Draft = {
    kind: event?.kind ?? kind,
    time: formatClock(video ? (event ? video.toVideo(event.at) : (video.now ?? video.toVideo(at))) : (event?.at ?? at)),
    assists: [],
    objective: "DARK_SLAYER",
    side: "BLUE",
    action: "BUY",
    slot: 1,
    item: "",
    title: "",
    note: event?.note ?? "",
  }
  if (!event) return base
  switch (event.kind) {
    case "KILL":
      return { ...base, killer: event.killer, victim: event.victim, assists: event.assists }
    case "OBJECTIVE":
      return { ...base, objective: event.objective, side: event.side, by: event.by }
    case "ITEM":
      return { ...base, seat: event.seat, action: event.action, slot: event.slot, item: event.item?.name ?? "" }
    case "NOTE":
      return { ...base, title: event.title, noteSide: event.side }
  }
}

function SeatPicker({
  seats,
  selected,
  onToggle,
  disabled,
}: {
  seats: GameSeat[]
  selected: SeatKey[]
  onToggle: (seat: SeatKey) => void
  disabled?: (seat: GameSeat) => boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {seats.map((seat) => {
        const active = selected.includes(seat.key)
        const off = disabled?.(seat)
        return (
          <button
            key={seat.key}
            type="button"
            data-side={seat.side}
            disabled={off}
            aria-pressed={active}
            onClick={() => onToggle(seat.key)}
            title={`${seat.playerName} · ${seat.hero?.name ?? "Chưa chọn tướng"}`}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border border-l-[3px] border-l-[var(--side)] py-1 pr-2.5 pl-1 text-xs transition disabled:opacity-30",
              active ? "border-[var(--side)] bg-[var(--side-soft)] font-semibold" : "hover:bg-muted",
            )}
          >
            <HeroIcon hero={seat.hero} size={24} />
            <LaneIcon lane={seat.lane} size={12} className="text-[var(--side)]" />
            <span className="max-w-24 truncate">{seat.playerName}</span>
          </button>
        )
      })}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 @2xl:grid-cols-[120px_1fr] @2xl:items-start">
      <span className="pt-1 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Chips<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | undefined
  options: { value: T; label: string; side?: Side }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          data-side={option.side}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-7 rounded-full border px-3 text-xs font-medium transition",
            value === option.value
              ? option.side
                ? "border-[var(--side)] bg-[var(--side)] text-white"
                : "border-foreground bg-foreground text-background"
              : "hover:bg-muted",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Records one event at the current playhead; everything is optional except what makes the event meaningful. A synced
 * game is timed by its broadcast position, which is what the admin reads off the player, and stored as game time.
 */
export function EventComposer({
  game,
  at,
  video,
  knownDuration,
  items,
  editing,
  initialKind = "KILL",
  snapshotsFor,
  events,
  onSave,
  onCancel,
}: {
  game: GameView
  at: number
  video?: VideoClock
  /** Stored game duration, when known; recorded moments cannot go past it. */
  knownDuration: number | null
  items: Reference[]
  editing?: TimelineEvent
  initialKind?: TimelineKind
  snapshotsFor: (seat: SeatKey) => GameView["snapshots"][SeatKey]
  events: TimelineEvent[]
  onSave: (event: TimelineEvent) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(() => fromEvent(editing, at, initialKind, video))
  const listId = useId()
  const hintId = useId()
  const set = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }))
  const seats = [...game.sides.BLUE.seats, ...game.sides.RED.seats]
  const typed = parseClock(draft.time)
  const converted = typed === null ? null : video ? video.toGame(typed) : typed
  const second = converted === null ? null : Math.round(converted)
  // The API rejects moments after a known game duration; without one, only a day-long bound applies.
  const afterEnd = second !== null && second > (knownDuration ?? 86_400)
  const validTime = second !== null && !afterEnd
  const nowText = formatClock(video ? (video.now ?? video.toVideo(at)) : at)
  const killerSide = draft.killer ? seatSide(draft.killer) : draft.victim ? otherSide(seatSide(draft.victim)) : null
  const inventory = draft.seat
    ? inventoryAt(draft.seat, Math.max(0, (second ?? at) - 1), snapshotsFor(draft.seat) ?? [], events)
    : []
  const slotItem = inventory[draft.slot - 1]
  const ready =
    validTime &&
    (draft.kind === "KILL"
      ? !!(draft.killer || draft.victim)
      : draft.kind === "OBJECTIVE"
        ? true
        : draft.kind === "ITEM"
          ? !!draft.seat && (!!draft.item.trim() || (draft.action === "SELL" && !!slotItem))
          : !!draft.title.trim())

  function save() {
    if (!ready || second === null) return
    const base = {
      id: editing?.id ?? newEventId(),
      at: second,
      note: draft.note.trim() || undefined,
    }
    const reference = items.find((item) => item.name.toLocaleLowerCase() === draft.item.trim().toLocaleLowerCase())
    const event: TimelineEvent =
      draft.kind === "KILL"
        ? {
            ...base,
            kind: "KILL",
            killer: draft.killer,
            victim: draft.victim,
            assists: draft.assists.filter((seat) => seat !== draft.killer && seatSide(seat) === killerSide),
          }
        : draft.kind === "OBJECTIVE"
          ? { ...base, kind: "OBJECTIVE", objective: draft.objective, side: draft.side, by: draft.by }
          : draft.kind === "ITEM"
            ? {
                ...base,
                kind: "ITEM",
                seat: draft.seat!,
                action: draft.action,
                slot: draft.slot,
                item: draft.item.trim()
                  ? { id: reference?.id ?? null, name: reference?.name ?? draft.item.trim() }
                  : slotItem || undefined,
              }
            : { ...base, kind: "NOTE", title: draft.title.trim(), side: draft.noteSide }
    onSave(event)
  }

  return (
    <form
      className="@container space-y-4 p-4"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel()
      }}
      aria-label={editing ? "Sửa sự kiện" : "Ghi sự kiện mới"}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-0.5" role="group" aria-label="Loại sự kiện">
          {(["KILL", "OBJECTIVE", "ITEM", "NOTE"] as const).map((kind) => {
            const Icon = KIND_ICONS[kind]
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={draft.kind === kind}
                onClick={() => set({ kind })}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium",
                  draft.kind === kind ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon size={13} /> {KIND_LABELS[kind]}
              </button>
            )
          })}
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {video ? (
            <span>
              <VideoMark /> Mốc video
            </span>
          ) : (
            "⏱ Giờ trong trận"
          )}
          <Input
            value={draft.time}
            onChange={(event) => set({ time: event.target.value })}
            className={cn("esp-num h-8 w-24 text-center", !validTime && "border-destructive")}
            inputMode="numeric"
            aria-invalid={!validTime}
            aria-describedby={hintId}
          />
        </label>
        <Button type="button" size="sm" variant="outline" onClick={() => set({ time: nowText })}>
          <Clock3 size={13} /> Hiện tại ({video ? `${VIDEO_MARK} ` : ""}
          {nowText})
        </Button>
        <p id={hintId} className="w-full text-right text-[11px] text-muted-foreground" aria-live="polite">
          {typed === null ? (
            <span className="text-destructive">Nhập dạng phút:giây, ví dụ 1:02:30.</span>
          ) : second === null ? (
            <span className="text-destructive">Mốc này nằm trước khi ván {game.number} bắt đầu.</span>
          ) : afterEnd ? (
            <span className="text-destructive">Mốc này nằm sau khi ván {game.number} kết thúc.</span>
          ) : video ? (
            <>
              Lưu thành <TimeTag kind="game" seconds={second} className="font-semibold text-foreground" /> trong ván{" "}
              {game.number}
            </>
          ) : (
            "Ván chưa đồng bộ video nên nhập giờ trong trận."
          )}
        </p>
      </div>

      {draft.kind === "KILL" && (
        <>
          <Field label="Người hạ gục">
            <SeatPicker
              seats={seats}
              selected={draft.killer ? [draft.killer] : []}
              onToggle={(seat) =>
                set({
                  killer: draft.killer === seat ? undefined : seat,
                  victim: draft.victim && seatSide(draft.victim) === seatSide(seat) ? undefined : draft.victim,
                  assists: [],
                })
              }
            />
          </Field>
          <Field label="Bị hạ">
            <SeatPicker
              seats={seats}
              selected={draft.victim ? [draft.victim] : []}
              disabled={(seat) => !!killerSide && draft.killer !== undefined && seat.side === killerSide}
              onToggle={(seat) => set({ victim: draft.victim === seat ? undefined : seat })}
            />
          </Field>
          {draft.killer && (
            <Field label="Hỗ trợ">
              <SeatPicker
                seats={seats.filter((seat) => seat.side === killerSide && seat.key !== draft.killer)}
                selected={draft.assists}
                onToggle={(seat) =>
                  set({
                    assists: draft.assists.includes(seat)
                      ? draft.assists.filter((entry) => entry !== seat)
                      : [...draft.assists, seat],
                  })
                }
              />
            </Field>
          )}
        </>
      )}

      {draft.kind === "OBJECTIVE" && (
        <>
          <Field label="Mục tiêu">
            <Chips
              value={draft.objective}
              onChange={(objective) => set({ objective })}
              options={(Object.keys(OBJECTIVE_LABELS) as ObjectiveKind[]).map((value) => ({
                value,
                label: OBJECTIVE_LABELS[value],
              }))}
            />
          </Field>
          <Field label="Đội giành được">
            <Chips
              value={draft.side}
              onChange={(side) => set({ side, by: undefined })}
              options={(["BLUE", "RED"] as const).map((value) => ({
                value,
                label: game.sides[value].team.name,
                side: value,
              }))}
            />
          </Field>
          <Field label={`${objectiveActor(draft.objective)} (nếu rõ)`}>
            <SeatPicker
              seats={game.sides[draft.side].seats}
              selected={draft.by ? [draft.by] : []}
              onToggle={(seat) => set({ by: draft.by === seat ? undefined : seat })}
            />
          </Field>
        </>
      )}

      {draft.kind === "ITEM" && (
        <>
          <Field label="Tuyển thủ">
            <SeatPicker
              seats={seats}
              selected={draft.seat ? [draft.seat] : []}
              onToggle={(seat) => set({ seat: draft.seat === seat ? undefined : seat })}
            />
          </Field>
          <Field label="Thao tác">
            <Chips
              value={draft.action}
              onChange={(action) => set({ action })}
              options={(["BUY", "UPGRADE", "SELL"] as const).map((value) => ({
                value,
                label: ITEM_ACTION_LABELS[value],
              }))}
            />
          </Field>
          <Field label="Ô trang bị">
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 6 }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-pressed={draft.slot === index + 1}
                  onClick={() => set({ slot: index + 1 })}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg border p-1 text-[10px]",
                    draft.slot === index + 1 ? "border-[var(--esp-gold)] bg-[var(--esp-gold-soft)]" : "hover:bg-muted",
                  )}
                >
                  <ItemSlot item={draft.seat ? inventory[index] : undefined} index={index} size={30} />Ô {index + 1}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Trang bị">
            <Input
              list={listId}
              value={draft.item}
              onChange={(event) => set({ item: event.target.value })}
              placeholder={
                draft.action === "SELL" && slotItem
                  ? `Để trống: bán ${slotItem.name}`
                  : items.length
                    ? "Gõ để tìm trang bị…"
                    : "Tên trang bị"
              }
              className="h-8 max-w-sm"
            />
            <datalist id={listId}>
              {items.map((item) => (
                <option key={item.id} value={item.name} />
              ))}
            </datalist>
          </Field>
        </>
      )}

      {draft.kind === "NOTE" && (
        <>
          <Field label="Tiêu đề">
            <Input
              value={draft.title}
              onChange={(event) => set({ title: event.target.value })}
              placeholder="Ví dụ: Giao tranh tổng ở Tà thần, Pha cướp Rồng…"
              className="h-8"
              autoFocus
            />
          </Field>
          <Field label="Đội">
            <Chips
              value={draft.noteSide ?? ("NONE" as Side)}
              onChange={(value) => set({ noteSide: value === ("NONE" as Side) ? undefined : value })}
              options={[
                { value: "NONE" as Side, label: "Cả hai" },
                ...(["BLUE", "RED"] as const).map((value) => ({
                  value,
                  label: game.sides[value].team.name,
                  side: value,
                })),
              ]}
            />
          </Field>
        </>
      )}

      <Field label="Ghi chú">
        <Input
          value={draft.note}
          onChange={(event) => set({ note: event.target.value })}
          placeholder="Không bắt buộc"
          className="h-8"
        />
      </Field>

      <div className="flex items-center justify-end gap-2 border-t pt-3">
        <span className="mr-auto text-[11px] text-muted-foreground">Enter để lưu · Esc để đóng</span>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X size={14} /> Hủy
        </Button>
        <Button type="submit" size="sm" disabled={!ready}>
          <Save size={14} /> {editing ? "Cập nhật" : "Lưu sự kiện"}
        </Button>
      </div>
    </form>
  )
}
