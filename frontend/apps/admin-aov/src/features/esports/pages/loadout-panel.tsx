import { useCallback, useEffect, useRef, useState } from "react"
import type { Catalog, GameContent, ObservationStatus, Participant, Side } from "@aov/community-contracts"
import { Clock3, EyeOff, Shield, Swords, TriangleAlert, Users, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Textarea } from "@aov/ui/components/textarea"
import { cn } from "@aov/ui/lib/utils"
import { EquipmentEditor } from "@/features/tournaments/equipment-editor"
import { LoadoutEditor, type ObservedAtControl } from "./loadout-editor"
import { HeroIcon, LaneIcon, TimeTag, VIDEO_MARK } from "../components/primitives"
import {
  canFillFromRoster,
  fillFromRoster,
  rosterOptionLabel,
  type RosterOption,
} from "../components/game/draft-editor"
import { ReferencePicker } from "../components/game/reference-picker"
import type { GameView, IconRef } from "../model/game-view"
import { LANE_LABELS } from "../model/labels"
import type { LoadoutPart } from "../model/loadout"
import { seatSide, type SeatKey } from "../model/timeline"
import { formatClock } from "@/lib/clock"

/** The game clock for the player position, and back to video time for display and seeking. */
export type LoadoutClock = {
  videoNow: number | null
  toGame: (videoSecond: number) => number | null
  toVideo: (gameSecond: number) => number
}

type Seat = { side: Side; index: number }
type ContentChange = (content: GameContent) => GameContent

/** A player and the part of their loadout to open on, as asked from the scoreboard. */
export type LoadoutTarget = { seat?: SeatKey; part?: LoadoutPart }

/**
 * Shows an edit at once and sends it as a change to the latest saved game. The panel used to draw only what the
 * service had answered and to send whole copies of a player, so a second edit made before the first was saved wrote
 * the first one away. When a save is refused the panel goes back to what is saved.
 */
function useOptimisticContent(content: GameContent, send: (change: ContentChange) => unknown) {
  const [local, setLocal] = useState(content)
  const shown = useRef(content)
  const saved = useRef(content)
  const pending = useRef(0)
  const refused = useRef(false)

  useEffect(() => {
    saved.current = content
    if (pending.current > 0) return
    shown.current = content
    setLocal(content)
  }, [content])

  const apply = useCallback(
    (change: ContentChange) => {
      const next = change(shown.current)
      if (next === shown.current) return
      shown.current = next
      setLocal(next)
      pending.current += 1
      void Promise.resolve(send(change)).then((accepted) => {
        pending.current -= 1
        if (accepted === false) refused.current = true
        if (pending.current > 0 || !refused.current) return
        refused.current = false
        shown.current = saved.current
        setLocal(saved.current)
      })
    },
    [send],
  )
  return [local, apply] as const
}

const STATUS_SHORT: Record<ObservationStatus, string> = {
  UNKNOWN: "chưa ghi",
  NOT_SHOWN: "không hiển thị",
  PARTIAL: "một phần",
  KNOWN: "rõ",
}

/**
 * Spells, emblems, arcana and equipment of each player, with the moment the broadcast showed them. Sources often show
 * one team's loadouts at a time, so a mark or a "not shown" status can be applied to the whole team at once.
 */
export function LoadoutPanel({
  content: savedContent,
  view,
  catalog,
  roster,
  clock,
  target,
  error,
  onSeekGame,
  onChange,
}: {
  content: GameContent
  view: GameView
  catalog: Catalog
  /** Each team's registered players at this tournament, starters first. */
  roster: (teamId: string) => RosterOption[]
  clock?: LoadoutClock
  /** Opens on this player and part; a new object re-targets a panel that is already open. */
  target?: LoadoutTarget | null
  /** Why the last change was not saved. The save status of the page sits under this panel, so it is repeated here. */
  error?: string | null
  onSeekGame: (gameSecond: number) => void
  /** Resolves to `false` when the service refused the change. */
  onChange: (change: ContentChange) => unknown
}) {
  const seatOf = (key?: SeatKey): Seat | null => {
    if (!key) return null
    const index = view.sides[seatSide(key)].seats.findIndex((entry) => entry.key === key)
    return index < 0 ? null : { side: seatSide(key), index }
  }
  const [content, apply] = useOptimisticContent(savedContent, onChange)
  const [seat, setSeat] = useState<Seat>(() => seatOf(target?.seat) ?? { side: "BLUE", index: 0 })
  const [tab, setTab] = useState<"loadout" | "equipment">(target?.part === "equipment" ? "equipment" : "loadout")
  const root = useRef<HTMLDivElement>(null)
  const scrollTo = useRef<LoadoutPart | null>(target?.part ?? null)
  const side = content.sides.find((entry) => entry.side === seat.side) ?? content.sides[0]
  const participant = side?.participants[seat.index]
  // Those registered for this seat's lane come first; the roster already puts starters before substitutes.
  const members = side
    ? [...roster(side.teamId)].sort(
        (a, b) => Number(b.lane === participant?.lane) - Number(a.lane === participant?.lane),
      )
    : []
  // A mark taken before the game clock starts (draft, loading screen) is kept at 0:00.
  const nowGame = clock?.videoNow != null ? Math.max(0, Math.round(clock.toGame(clock.videoNow) ?? 0)) : null

  useEffect(() => {
    const wanted = seatOf(target?.seat)
    if (!wanted) return
    scrollTo.current = target?.part ?? null
    setSeat(wanted)
    setTab(target?.part === "equipment" ? "equipment" : "loadout")
    // Only a new request moves the panel; the lookup reads the seats of the same game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])
  useEffect(() => {
    if (!scrollTo.current) return
    const part = root.current?.querySelector(`[data-part="${scrollTo.current}"]`)
    scrollTo.current = null
    part?.scrollIntoView?.({ block: "nearest" })
  })

  const updateSeat = (target: Seat, change: (participant: Participant) => Participant) =>
    apply((current) => {
      const before = current.sides.find((entry) => entry.side === target.side)?.participants[target.index]
      const after = before && change(before)
      if (!before || !after || after === before) return current
      return {
        ...current,
        sides: current.sides.map((entry) =>
          entry.side !== target.side
            ? entry
            : {
                ...entry,
                participants: entry.participants.map((value, index) => (index === target.index ? after : value)),
              },
        ),
      }
    })
  const updateTeam = (code: Side, change: (participant: Participant) => Participant) =>
    apply((current) => ({
      ...current,
      sides: current.sides.map((entry) =>
        entry.side === code ? { ...entry, participants: entry.participants.map(change) } : entry,
      ),
    }))

  const observedAt: ObservedAtControl = (value, set, label) => (
    <ObservedAt value={value} label={label} nowGame={nowGame} clock={clock} onSeekGame={onSeekGame} onChange={set} />
  )
  const spellIcon = (participant: Participant): IconRef | null => {
    const match = catalog.spells.find((option) => option.id === participant.spell?.id)
    return participant.spell?.id || participant.spell?.name
      ? { id: participant.spell.id, name: participant.spell.name || match?.name || "", iconUrl: match?.iconUrl }
      : null
  }

  return (
    <div ref={root} className="space-y-4 p-4 text-sm">
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs"
        >
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-destructive" />
          <span>Thay đổi vừa rồi chưa lưu được, bảng đã quay về bản đã lưu. {error}</span>
        </p>
      )}
      {(["BLUE", "RED"] as const).map((code) => {
        const team = view.sides[code]
        return (
          <section key={code} data-side={code} className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="h-5 w-1 rounded-full bg-[var(--side)]" aria-hidden="true" />
              <span className="mr-1 text-xs font-semibold">{team.team.name}</span>
              {team.seats.map((entry, index) => {
                const selected = seat.side === code && seat.index === index
                const value = content.sides.find((item) => item.side === code)?.participants[index]
                return (
                  <button
                    key={entry.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSeat({ side: code, index })}
                    title={`${entry.playerName} · phụ trợ ${value?.spell?.name ? "đã ghi" : "chưa ghi"} · phù hiệu ${STATUS_SHORT[value?.enchantments.status ?? "UNKNOWN"]} · ngọc ${STATUS_SHORT[value?.arcana.status ?? "UNKNOWN"]}`}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border py-1 pr-2 pl-1 text-xs",
                      selected ? "border-[var(--side)] bg-[var(--side-soft)] font-semibold" : "hover:bg-muted",
                    )}
                  >
                    <HeroIcon hero={entry.hero} size={22} />
                    {value?.playerId ? (
                      <span className="max-w-20 truncate">{entry.playerName}</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">Chưa ghi</span>
                    )}
                    <SeatDots participant={value} />
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-1.5 pl-3 text-xs">
              {canFillFromRoster(content, roster, code) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  title="Điền các ô chưa ghi bằng người đăng ký ở giải đúng vị trí, ưu tiên đội hình chính. Ván có người vào thay vẫn cần sửa tay."
                  onClick={() => apply((current) => fillFromRoster(current, roster, code))}
                >
                  <Users size={13} /> Điền tuyển thủ theo đội hình
                </Button>
              )}
              {nowGame != null && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => updateTeam(code, (value) => ({ ...value, spellObservedAtSeconds: nowGame }))}
                  >
                    <Clock3 size={13} /> Mốc phụ trợ cả đội
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() =>
                      updateTeam(code, (value) => ({
                        ...value,
                        enchantments: { ...value.enchantments, observedAtSeconds: nowGame },
                      }))
                    }
                  >
                    <Clock3 size={13} /> Mốc phù hiệu cả đội
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() =>
                      updateTeam(code, (value) => ({
                        ...value,
                        arcana: { ...value.arcana, observedAtSeconds: nowGame },
                      }))
                    }
                  >
                    <Clock3 size={13} /> Mốc bảng ngọc cả đội
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                title="Áp dụng cho tuyển thủ chưa ghi phù hiệu"
                onClick={() =>
                  updateTeam(code, (value) =>
                    value.enchantments.status === "UNKNOWN"
                      ? { ...value, enchantments: { ...value.enchantments, status: "NOT_SHOWN", entries: [] } }
                      : value,
                  )
                }
              >
                <EyeOff size={13} /> Phù hiệu không hiển thị
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                title="Áp dụng cho tuyển thủ chưa ghi bảng ngọc"
                onClick={() =>
                  updateTeam(code, (value) =>
                    value.arcana.status === "UNKNOWN"
                      ? { ...value, arcana: { ...value.arcana, status: "NOT_SHOWN", entries: [] } }
                      : value,
                  )
                }
              >
                <EyeOff size={13} /> Bảng ngọc không hiển thị
              </Button>
            </div>
          </section>
        )
      })}

      {participant && (
        <section className="space-y-3 rounded-xl border p-3" data-side={seat.side} aria-label="Thông tin tuyển thủ">
          {/* Who played this seat is chosen here, from the team's registered players. */}
          <header className="flex flex-wrap items-center gap-2" data-part="player">
            <LaneIcon lane={participant.lane} size={16} className="text-[var(--side)]" />
            <select
              aria-label={`Tuyển thủ ${LANE_LABELS[participant.lane].name} của ${view.sides[seat.side].team.name}`}
              value={participant.playerId ?? ""}
              onChange={(event) => updateSeat(seat, (value) => ({ ...value, playerId: event.target.value || null }))}
              className={cn(
                "h-8 max-w-full min-w-44 rounded-md border bg-background px-2 text-sm font-semibold",
                !participant.playerId && "border-dashed border-amber-500 text-amber-600 dark:text-amber-400",
              )}
            >
              <option value="">Chưa ghi tuyển thủ</option>
              {participant.playerId && !members.some((member) => member.id === participant.playerId) && (
                <option value={participant.playerId}>{view.sides[seat.side].seats[seat.index]?.playerName}</option>
              )}
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {rosterOptionLabel(member, participant.lane)}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              {LANE_LABELS[participant.lane].name} · {participant.hero?.name || "chưa có tướng"}
            </span>
          </header>
          {!members.length && (
            <p className="text-xs text-muted-foreground">
              {view.sides[seat.side].team.name} chưa có đội hình đăng ký ở giải này nên chưa có ai để chọn. Thêm ở bước
              “Đội & đội hình” của giải.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2" data-part="spell">
            <span className="text-xs font-medium text-muted-foreground">Phụ trợ</span>
            <ReferencePicker
              label={`Phụ trợ của ${view.sides[seat.side].seats[seat.index]?.playerName ?? "tuyển thủ"}`}
              value={participant.spell}
              options={catalog.spells}
              onChange={(spell) =>
                updateSeat(seat, (value) => ({
                  ...value,
                  spell,
                  spellObservedAtSeconds: value.spellObservedAtSeconds ?? (spell.id || spell.name ? nowGame : null),
                }))
              }
            >
              <HeroIcon
                hero={spellIcon(participant)}
                size={32}
                className={cn(
                  "rounded-md",
                  !participant.spell?.id && !participant.spell?.name && "border border-dashed",
                )}
              />
            </ReferencePicker>
            <span className="text-sm">{participant.spell?.name || "Chưa ghi"}</span>
            {observedAt(
              participant.spellObservedAtSeconds,
              (spellObservedAtSeconds) => updateSeat(seat, (value) => ({ ...value, spellObservedAtSeconds })),
              "phụ trợ",
            )}
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Phần đang ghi">
            {(
              [
                { id: "loadout", label: "Phù hiệu & bảng ngọc", icon: Shield },
                {
                  id: "equipment",
                  label: participant.equipmentSnapshots.length
                    ? `Trang bị · ${participant.equipmentSnapshots.length} mốc`
                    : "Trang bị theo mốc",
                  icon: Swords,
                },
              ] as const
            ).map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={tab === entry.id}
                onClick={() => setTab(entry.id)}
                className={cn(
                  "flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition",
                  tab === entry.id ? "bg-background shadow-sm" : "text-muted-foreground",
                )}
              >
                <entry.icon size={14} /> {entry.label}
              </button>
            ))}
          </div>
          {tab === "loadout" ? (
            <LoadoutEditor
              key={`loadout-${seat.side}-${seat.index}`}
              participant={participant}
              catalog={catalog}
              observedAt={observedAt}
              onChange={(change) => updateSeat(seat, change)}
            />
          ) : (
            <EquipmentEditor
              key={`equipment-${seat.side}-${seat.index}`}
              participant={participant}
              catalog={catalog}
              nowGame={nowGame}
              // The editor answers with a whole player; only its own two lists are taken from that copy.
              onChange={(next) =>
                updateSeat(seat, (value) => ({
                  ...value,
                  equipmentSnapshots: next.equipmentSnapshots,
                  equipmentEvents: next.equipmentEvents,
                }))
              }
            />
          )}
          <PlayerNote
            key={`${seat.side}-${seat.index}`}
            value={participant.note ?? ""}
            onChange={(note) => updateSeat(seat, (value) => ({ ...value, note: note || undefined }))}
          />
        </section>
      )}
    </div>
  )
}

/** A note about one player in this game. Saved when the field is left, not on every key, since each save is a request. */
function PlayerNote({ value, onChange }: { value: string; onChange: (note: string) => void }) {
  const [text, setText] = useState(value)
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">Ghi chú tuyển thủ</span>
      <Textarea
        value={text}
        maxLength={2000}
        rows={2}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => text.trim() !== value.trim() && onChange(text.trim())}
      />
    </label>
  )
}

/** Three dots for spell, emblems and arcana: filled when recorded, hollow when not shown, faint when missing. */
function SeatDots({ participant }: { participant?: Participant }) {
  if (!participant) return null
  const dot = (state: "done" | "partial" | "hidden" | "todo", label: string) => (
    <span
      key={label}
      title={label}
      className={cn(
        "size-1.5 rounded-full",
        state === "done" && "bg-[var(--esp-live)]",
        state === "partial" && "bg-[var(--esp-gold)]",
        state === "hidden" && "ring-1 ring-muted-foreground",
        state === "todo" && "bg-muted-foreground/25",
      )}
    />
  )
  const loadout = (status: ObservationStatus) =>
    status === "KNOWN" ? "done" : status === "PARTIAL" ? "partial" : status === "NOT_SHOWN" ? "hidden" : "todo"
  return (
    <span className="flex gap-0.5" aria-hidden="true">
      {dot(participant.spell?.id || participant.spell?.name ? "done" : "todo", "Phụ trợ")}
      {dot(loadout(participant.enchantments.status), "Phù hiệu")}
      {dot(loadout(participant.arcana.status), "Bảng ngọc")}
    </span>
  )
}

/** The game second a loadout was seen, linked to the video, with a button to take the current position. */
function ObservedAt({
  value,
  label,
  nowGame,
  clock,
  onSeekGame,
  onChange,
}: {
  value: number | null | undefined
  label: string
  nowGame: number | null
  clock?: LoadoutClock
  onSeekGame: (gameSecond: number) => void
  onChange: (second: number | null) => void
}) {
  return (
    <span className="ml-auto inline-flex items-center gap-1 text-xs">
      {value != null ? (
        <>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 hover:bg-accent"
            title={`Xem lúc ${label} hiện trên video`}
            onClick={() => onSeekGame(value)}
          >
            <TimeTag kind="game" seconds={value} />
            {clock && <TimeTag kind="video" seconds={clock.toVideo(value)} className="text-xs opacity-75" />}
          </button>
          <button
            type="button"
            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label={`Xóa mốc ${label}`}
            onClick={() => onChange(null)}
          >
            <X size={12} />
          </button>
        </>
      ) : (
        <span className="text-muted-foreground">Chưa có mốc</span>
      )}
      {nowGame != null && (
        <Button size="sm" variant="outline" className="h-7" onClick={() => onChange(nowGame)}>
          <Clock3 size={12} /> Mốc {VIDEO_MARK} {formatClock(clock?.videoNow)}
        </Button>
      )}
    </span>
  )
}
