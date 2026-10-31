import { useState } from "react"
import type { Catalog, GameContent, ObservationStatus, Participant, Side } from "@aov/community-contracts"
import { Clock3, EyeOff, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { LoadoutEditor, type ObservedAtControl } from "@/features/tournaments/loadout-editor"
import { HeroIcon, LaneIcon, TimeTag, VIDEO_MARK } from "../components/primitives"
import { ReferencePicker } from "../components/game/reference-picker"
import type { GameView, IconRef } from "../model/game-view"
import { LANE_LABELS } from "../model/labels"
import { formatClock } from "../model/vod"

/** The game clock for the player position, and back to video time for display and seeking. */
export type LoadoutClock = {
  videoNow: number | null
  toGame: (videoSecond: number) => number | null
  toVideo: (gameSecond: number) => number
}

type Seat = { side: Side; index: number }

const STATUS_SHORT: Record<ObservationStatus, string> = {
  UNKNOWN: "chưa ghi",
  NOT_SHOWN: "không hiển thị",
  PARTIAL: "một phần",
  KNOWN: "rõ",
}

/**
 * Spells, emblems and arcana of each player, with the moment the broadcast showed them. Sources often show one team's
 * loadouts at a time, so a mark or a "not shown" status can be applied to the whole team at once.
 */
export function LoadoutPanel({
  content,
  view,
  catalog,
  clock,
  onSeekGame,
  onChange,
}: {
  content: GameContent
  view: GameView
  catalog: Catalog
  clock?: LoadoutClock
  onSeekGame: (gameSecond: number) => void
  onChange: (change: (content: GameContent) => GameContent) => void
}) {
  const [seat, setSeat] = useState<Seat>({ side: "BLUE", index: 0 })
  const side = content.sides.find((entry) => entry.side === seat.side) ?? content.sides[0]
  const participant = side?.participants[seat.index]
  // A mark taken before the game clock starts (draft, loading screen) is kept at 0:00.
  const nowGame = clock?.videoNow != null ? Math.max(0, Math.round(clock.toGame(clock.videoNow) ?? 0)) : null

  const updateSeat = (target: Seat, change: (participant: Participant) => Participant) =>
    onChange((current) => ({
      ...current,
      sides: current.sides.map((entry) =>
        entry.side !== target.side
          ? entry
          : {
              ...entry,
              participants: entry.participants.map((value, index) => (index === target.index ? change(value) : value)),
            },
      ),
    }))
  const updateTeam = (code: Side, change: (participant: Participant) => Participant) =>
    onChange((current) => ({
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
    <div className="space-y-4 p-4 text-sm">
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
                    <span className="max-w-20 truncate">{entry.playerName}</span>
                    <SeatDots participant={value} />
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-1.5 pl-3 text-xs">
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
          <header className="flex flex-wrap items-center gap-2">
            <LaneIcon lane={participant.lane} size={16} className="text-[var(--side)]" />
            <span className="font-semibold">{view.sides[seat.side].seats[seat.index]?.playerName}</span>
            <span className="text-xs text-muted-foreground">
              {LANE_LABELS[participant.lane].name} · {participant.hero?.name || "chưa có tướng"}
            </span>
          </header>
          <div className="flex flex-wrap items-center gap-2">
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
          <LoadoutEditor
            participant={participant}
            catalog={catalog}
            observedAt={observedAt}
            onChange={(next) => updateSeat(seat, () => next)}
          />
        </section>
      )}
    </div>
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
