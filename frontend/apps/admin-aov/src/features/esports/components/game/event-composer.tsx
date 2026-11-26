import type { ObjectiveKind, Reference, Side } from "@aov/community-contracts"
import { useEffect, useEffectEvent, useId, useRef, useState, type ReactNode } from "react"
import { Clock3 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { cn } from "@aov/ui/lib/utils"
import { Segmented } from "@/components/segmented"
import { formatClock, parseClock } from "@/lib/clock"
import type { GameSeat, GameView } from "../../model/game-view"
import { nameKey } from "../../model/name-key"
import { OBJECTIVE_NAMES } from "../../model/quick-moment"
import {
  ITEM_ACTION_LABELS,
  KIND_LABELS,
  inventoryAt,
  newEventId,
  objectiveActor,
  otherSide,
  seatSide,
  type ItemAction,
  type ItemRef,
  type SeatKey,
  type SlotState,
  type TimelineEvent,
  type TimelineKind,
} from "../../model/timeline"
import { HeroIcon, ItemSlot, TeamLogo } from "../primitives"
import { ObjectiveIcon } from "./objective-icon"
import "./moments.css"

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

/** Where and for whom a new moment starts when it was asked for on the timeline rather than at the playhead. */
export type ComposerStart = { videoSecond?: number; side?: Side }

const KINDS = (["KILL", "OBJECTIVE", "ITEM", "NOTE"] as const).map((kind) => [kind, KIND_LABELS[kind]] as const)
const OBJECTIVES: readonly ObjectiveKind[] = ["TURRET", "ABYSSAL_DRAGON", "DARK_SLAYER", "BASE", "OTHER"]
const SIDES: readonly Side[] = ["BLUE", "RED"]

/** The longest title and note the service accepts. */
const MAX_TITLE = 120
const MAX_NOTE = 500

function fromEvent(
  event: TimelineEvent | undefined,
  at: number,
  kind: TimelineKind,
  video?: VideoClock,
  start?: ComposerStart,
): Draft {
  const videoNow = start?.videoSecond ?? video?.now ?? null
  const base: Draft = {
    kind: event?.kind ?? kind,
    time: formatClock(video ? (event ? video.toVideo(event.at) : (videoNow ?? video.toVideo(at))) : (event?.at ?? at)),
    assists: [],
    objective: "DARK_SLAYER",
    side: start?.side ?? "BLUE",
    noteSide: start?.side,
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

function Row({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className="esp-form-row" data-wide={wide || undefined} role="group" aria-label={label}>
      <span className="esp-form-label">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Pick({
  pressed,
  side,
  tight,
  onPress,
  children,
}: {
  pressed: boolean
  side?: Side
  tight?: boolean
  onPress: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="esp-form-pick"
      aria-pressed={pressed}
      data-side={side}
      data-tight={tight || undefined}
      onClick={onPress}
    >
      {children}
    </button>
  )
}

/** The ten players as two groups of five faces; those a row cannot take are faint and do nothing. */
function Faces({
  game,
  label,
  selected,
  off,
  onToggle,
}: {
  game: GameView
  label: string
  selected: readonly (SeatKey | undefined)[]
  off?: (seat: GameSeat) => boolean
  onToggle: (seat: SeatKey) => void
}) {
  return (
    <Row label={label} wide>
      <div className="esp-form-faces">
        {SIDES.map((side) => (
          <span key={side} data-side={side}>
            {game.sides[side].seats.map((seat) => {
              const name = `${seat.playerName}, ${seat.hero?.name ?? "chưa chọn tướng"}`
              return (
                <button
                  key={seat.key}
                  type="button"
                  className="esp-form-face"
                  data-seat={seat.key}
                  aria-label={name}
                  title={name}
                  aria-pressed={selected.includes(seat.key)}
                  disabled={off?.(seat)}
                  onClick={() => onToggle(seat.key)}
                >
                  <HeroIcon
                    hero={seat.hero}
                    size={30}
                    title=""
                    className="aspect-square h-auto! w-full! rounded-md ring-1 ring-[var(--side)]"
                  />
                </button>
              )
            })}
          </span>
        ))}
      </div>
    </Row>
  )
}

/** The team a moment belongs to, as two buttons; `none` offers a third for a moment of both. */
function Teams({
  game,
  value,
  none,
  onChange,
}: {
  game: GameView
  value: Side | null
  none?: string
  onChange: (side: Side | null) => void
}) {
  return (
    <Row label="Đội" wide>
      <div className="esp-form-picks">
        {none && (
          <Pick pressed={value === null} onPress={() => onChange(null)}>
            {none}
          </Pick>
        )}
        {SIDES.map((side) => (
          <Pick key={side} pressed={value === side} side={side} onPress={() => onChange(side)}>
            <TeamLogo team={game.sides[side].team} size={18} /> {game.sides[side].team.shortName}
          </Pick>
        ))}
      </div>
    </Row>
  )
}

type Fields = { game: GameView; draft: Draft; set: (change: Partial<Draft>) => void }

function KillFields({ game, draft, set }: Fields) {
  const scoring = draft.killer ? seatSide(draft.killer) : draft.victim ? otherSide(seatSide(draft.victim)) : null
  return (
    <>
      <Faces
        game={game}
        label="Hạ gục"
        selected={[draft.killer]}
        onToggle={(seat) =>
          set({
            killer: draft.killer === seat ? undefined : seat,
            victim: draft.victim && seatSide(draft.victim) === seatSide(seat) ? undefined : draft.victim,
            assists: [],
          })
        }
      />
      <Faces
        game={game}
        label="Bị hạ"
        selected={[draft.victim]}
        off={(seat) => !!draft.killer && seat.side === scoring}
        onToggle={(seat) =>
          set({ victim: draft.victim === seat ? undefined : seat, assists: draft.killer ? draft.assists : [] })
        }
      />
      <Faces
        game={game}
        label="Hỗ trợ"
        selected={draft.assists}
        off={(seat) => seat.side !== scoring || seat.key === draft.killer}
        onToggle={(seat) =>
          set({
            assists: draft.assists.includes(seat)
              ? draft.assists.filter((entry) => entry !== seat)
              : [...draft.assists, seat],
          })
        }
      />
    </>
  )
}

function ObjectiveFields({ game, draft, set }: Fields) {
  return (
    <>
      <Row label="Mục tiêu" wide>
        <div className="esp-form-picks">
          {OBJECTIVES.map((objective) => (
            <Pick key={objective} pressed={draft.objective === objective} onPress={() => set({ objective })}>
              <ObjectiveIcon objective={objective} size={18} /> {OBJECTIVE_NAMES[objective]}
            </Pick>
          ))}
        </div>
      </Row>
      <Teams game={game} value={draft.side} onChange={(side) => side && set({ side, by: undefined })} />
      <Faces
        game={game}
        label={objectiveActor(draft.objective)}
        selected={[draft.by]}
        off={(seat) => seat.side !== draft.side}
        onToggle={(seat) => set({ by: draft.by === seat ? undefined : seat })}
      />
    </>
  )
}

function ItemFields({
  game,
  draft,
  set,
  inventory,
  items,
  itemIcon,
  swapping,
}: Fields & {
  inventory: SlotState[]
  items: Reference[]
  itemIcon?: (item: ItemRef) => string | null | undefined
  /** A stored change of two slots, which is no purchase and cannot be recorded anew here. */
  swapping: boolean
}) {
  const listId = useId()
  const held = inventory[draft.slot - 1]
  const actions: readonly ItemAction[] = swapping ? ["BUY", "UPGRADE", "SELL", "SWAP"] : ["BUY", "UPGRADE", "SELL"]
  return (
    <>
      <Faces
        game={game}
        label="Tuyển thủ"
        selected={[draft.seat]}
        onToggle={(seat) => set({ seat: draft.seat === seat ? undefined : seat })}
      />
      <Row label="Thao tác" wide>
        <div className="esp-form-picks">
          {actions.map((action) => (
            <Pick key={action} pressed={draft.action === action} onPress={() => set({ action })}>
              {ITEM_ACTION_LABELS[action]}
            </Pick>
          ))}
        </div>
      </Row>
      <Row label="Ô" wide>
        <div className="esp-form-picks">
          {Array.from({ length: 6 }, (_, index) => {
            const item = draft.seat ? inventory[index] : undefined
            return (
              <Pick key={index} tight pressed={draft.slot === index + 1} onPress={() => set({ slot: index + 1 })}>
                <ItemSlot item={item} iconUrl={item ? itemIcon?.(item) : null} index={index} size={22} /> {index + 1}
              </Pick>
            )
          })}
        </div>
      </Row>
      {draft.action !== "SWAP" && (
        <Row label="Trang bị" wide>
          <Input
            list={listId}
            value={draft.item}
            onChange={(event) => set({ item: event.target.value })}
            aria-label="Trang bị"
            placeholder={draft.action === "SELL" && held ? `Để trống: bán ${held.name}` : "Tên trang bị"}
            className="h-8"
          />
          <datalist id={listId}>
            {items.map((item) => (
              <option key={item.id} value={item.name} />
            ))}
          </datalist>
        </Row>
      )}
    </>
  )
}

function NoteFields({ game, draft, set }: Fields) {
  return (
    <>
      <Row label="Tiêu đề" wide>
        <Input
          value={draft.title}
          maxLength={MAX_TITLE}
          onChange={(event) => set({ title: event.target.value })}
          aria-label="Tiêu đề"
          placeholder="Ví dụ: Pha cướp Rồng"
          className="h-8"
          autoFocus
        />
      </Row>
      <Teams
        game={game}
        value={draft.noteSide ?? null}
        none="Cả hai"
        onChange={(side) => set({ noteSide: side ?? undefined })}
      />
    </>
  )
}

/** What the form records at a second; `slotItem` is what the chosen slot holds, which a sale may leave unnamed. */
function eventOf(
  draft: Draft,
  second: number,
  editing: TimelineEvent | undefined,
  items: Reference[],
  slotItem: SlotState,
): TimelineEvent {
  const base = { id: editing?.id ?? newEventId(), at: second, note: draft.note.trim() || undefined }
  switch (draft.kind) {
    case "KILL": {
      const scoring = draft.killer ? seatSide(draft.killer) : draft.victim ? otherSide(seatSide(draft.victim)) : null
      return {
        ...base,
        kind: "KILL",
        killer: draft.killer,
        victim: draft.victim,
        assists: draft.assists.filter((seat) => seat !== draft.killer && seatSide(seat) === scoring),
      }
    }
    case "OBJECTIVE":
      return { ...base, kind: "OBJECTIVE", objective: draft.objective, side: draft.side, by: draft.by }
    case "ITEM": {
      const typed = draft.item.trim()
      const reference = items.find((item) => nameKey(item.name) === nameKey(typed))
      const before = editing?.kind === "ITEM" ? editing : null
      const swap = before?.action === "SWAP" ? before : null
      return {
        ...base,
        kind: "ITEM",
        seat: draft.seat!,
        action: draft.action,
        slot: draft.slot,
        stored: before?.stored,
        ...(draft.action === "SWAP" ? { toSlot: swap?.toSlot, item: swap?.item } : {}),
        ...(draft.action !== "SWAP"
          ? { item: typed ? { id: reference?.id ?? null, name: reference?.name ?? typed } : slotItem || undefined }
          : {}),
      }
    }
    case "NOTE":
      return { ...base, kind: "NOTE", title: draft.title.trim(), side: draft.noteSide }
  }
}

/**
 * Records one moment at the current playhead; everything is optional except what makes the moment meaningful. A synced
 * game is timed by its broadcast position, which is what the admin reads off the player, and stored as game time.
 */
export function EventComposer({
  game,
  at,
  video,
  knownDuration,
  items,
  itemIcon,
  editing,
  refused,
  initialKind = "KILL",
  start,
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
  itemIcon?: (item: ItemRef) => string | null | undefined
  editing?: TimelineEvent
  /** What was typed before its save was refused; the form opens with it instead of the stored moment. */
  refused?: TimelineEvent
  initialKind?: TimelineKind
  /** Position and team the timeline asked for; ignored when the form opens with a moment. */
  start?: ComposerStart
  snapshotsFor: (seat: SeatKey) => GameView["snapshots"][SeatKey]
  events: TimelineEvent[]
  onSave: (event: TimelineEvent) => void
  onCancel: () => void
}) {
  const shown = refused ?? editing
  const [draft, setDraft] = useState(() => fromEvent(shown, at, initialKind, video, shown ? undefined : start))
  const form = useRef<HTMLFormElement>(null)
  const hintId = useId()
  const set = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }))
  const typed = parseClock(draft.time)
  const converted = typed === null ? null : video ? video.toGame(typed) : typed
  const second = converted === null ? null : Math.round(converted)
  // The API rejects moments after a known game duration; without one, only a day-long bound applies.
  const afterEnd = second !== null && second > (knownDuration ?? 86_400)
  const problem =
    typed === null
      ? "Gõ giờ dạng phút:giây, ví dụ 1:02:30."
      : second === null
        ? `Mốc này nằm trước khi ván ${game.number} bắt đầu.`
        : afterEnd
          ? `Mốc này nằm sau khi ván ${game.number} kết thúc.`
          : null
  const inventory = draft.seat
    ? inventoryAt(draft.seat, Math.max(0, (second ?? at) - 1), snapshotsFor(draft.seat) ?? [], events)
    : []
  const slotItem = inventory[draft.slot - 1]
  const complete: Record<TimelineKind, boolean> = {
    KILL: !!(draft.killer || draft.victim),
    OBJECTIVE: true,
    ITEM: !!draft.seat && (!!draft.item.trim() || draft.action === "SWAP" || (draft.action === "SELL" && !!slotItem)),
    NOTE: !!draft.title.trim(),
  }
  const ready = !problem && complete[draft.kind]
  const save = () => {
    if (ready) onSave(eventOf(draft, second!, editing, items, slotItem))
  }

  // The form itself takes the focus, not a field, so the keys of the video keep working while it is open.
  useEffect(() => {
    if (!form.current?.contains(document.activeElement)) form.current?.focus({ preventScroll: true })
  }, [])
  // A press beside the form takes the focus out of it; Enter still saves where nothing else wants it.
  const onPageKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.defaultPrevented && event.target === document.body) save()
  })
  useEffect(() => {
    const listen = (event: KeyboardEvent) => onPageKey(event)
    window.addEventListener("keydown", listen)
    return () => window.removeEventListener("keydown", listen)
  }, [])

  return (
    <form
      ref={form}
      tabIndex={-1}
      className="esp-form"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
      // A face, a kind or a team pressed with the mouse leaves the focus where it was, so Enter still saves instead of
      // pressing that button again; one reached with Tab is still toggled by Space.
      onMouseDown={(event) => {
        if (event.target instanceof Element && event.target.closest("button")) event.preventDefault()
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation()
          onCancel()
        } else if (event.key === "Enter" && event.target === event.currentTarget) {
          event.preventDefault()
          save()
        }
      }}
      aria-label={editing ? "Sửa diễn biến" : "Ghi diễn biến mới"}
    >
      {/* Four kinds in the narrowest dock leave no room for the usual padding of the buttons. */}
      <div className="flex min-w-0 [&_button]:px-2">
        <Segmented label="Loại diễn biến" value={draft.kind} options={KINDS} onChange={(kind) => set({ kind })} />
      </div>
      <div className="esp-form-row" data-time>
        <span className="esp-form-label" aria-hidden="true">
          Lúc
        </span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="relative">
            {video && (
              <span
                aria-hidden="true"
                className="absolute top-1/2 left-2 -translate-y-1/2 text-xs text-muted-foreground"
              >
                ▸
              </span>
            )}
            <Input
              value={draft.time}
              onChange={(event) => set({ time: event.target.value })}
              className={cn("esp-num h-8 w-[84px] px-2", video && "pl-5")}
              inputMode="numeric"
              aria-label={video ? "Lúc, mốc video" : "Lúc, giờ trong ván"}
              aria-invalid={!!problem}
              aria-describedby={hintId}
            />
          </span>
          {video && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => set({ time: formatClock(video.now ?? video.toVideo(at)) })}
            >
              <Clock3 aria-hidden /> Lấy vị trí video
            </Button>
          )}
          <span id={hintId} aria-live="polite" className={cn("esp-num type-meta", problem && "text-destructive")}>
            {problem ??
              (video ? (
                <>
                  {formatClock(second)} <span className="sr-only">trong ván</span>
                </>
              ) : (
                "giờ trong ván"
              ))}
          </span>
        </div>
      </div>

      {draft.kind === "KILL" && <KillFields game={game} draft={draft} set={set} />}
      {draft.kind === "OBJECTIVE" && <ObjectiveFields game={game} draft={draft} set={set} />}
      {draft.kind === "ITEM" && (
        <ItemFields
          game={game}
          draft={draft}
          set={set}
          inventory={inventory}
          items={items}
          itemIcon={itemIcon}
          swapping={editing?.kind === "ITEM" && editing.action === "SWAP"}
        />
      )}
      {draft.kind === "NOTE" && <NoteFields game={game} draft={draft} set={set} />}

      <Row label="Ghi chú" wide>
        <Input
          value={draft.note}
          maxLength={MAX_NOTE}
          onChange={(event) => set({ note: event.target.value })}
          aria-label="Ghi chú"
          className="h-8"
        />
      </Row>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Hủy
        </Button>
        <Button type="submit" size="sm" disabled={!ready}>
          {editing ? "Cập nhật" : "Lưu diễn biến"}
        </Button>
      </div>
    </form>
  )
}
