import { useState, type ReactNode } from "react"
import type { BuildPlace, BuildStep, Reference, Selection } from "@aov/community-contracts"
import { ArrowLeft, ArrowRight, ChevronLeft, Plus, Trash2 } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { formatClock } from "@/lib/clock"
import {
  BUILD_PLACES,
  BUILD_REFUSALS,
  MIN_TIER,
  buildPlace,
  itemKey,
  itemName,
  moveItem,
  recipeParts,
  removeItem,
  setTime,
  shiftItem,
  stepsAt,
  togglePart,
  upgradeItem,
  upgradesOf,
  type BuildEdit,
  type BuildRefusal,
  type ItemIndex,
} from "../../model/build"
import { ItemButton, ItemIcon } from "./build-item"
import { BuildTimeField } from "./build-time-field"
import { ItemPicker } from "./item-picker"

/** Applies one edit to the list and answers why it was refused, if it was. `done` says what it did. */
export type ApplyEdit = (edit: (steps: BuildStep[]) => BuildEdit, done: string) => BuildRefusal | null

/** The part of the menu an edit was asked for in, so the reason it is refused stands there. */
type Spot = "place" | "upgrade" | "parts" | "time"

function Part({ title, reason, children }: { title: string; reason?: string | null; children: ReactNode }) {
  return (
    <section className="space-y-1" aria-label={title}>
      <h5 className="type-label text-muted-foreground">{title}</h5>
      {children}
      <Reason>{reason}</Reason>
    </section>
  )
}

function Reason({ children }: { children?: string | null }) {
  return children ? (
    <p role="alert" className="text-xs text-destructive">
      {children}
    </p>
  ) : null
}

const iconButton =
  "grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground aria-disabled:opacity-30 aria-disabled:hover:bg-transparent"

/**
 * What can be done with one item of a build: its place and order, what it went into, what it came from and when the
 * player had it. Everything is done at once; a refused edit says why beside what asked for it.
 */
export function BuildStepMenu({
  step,
  steps,
  index,
  duration,
  nowGame,
  onSeek,
  onEdit,
  onClose,
}: {
  step: BuildStep
  /** The whole list the item is in. */
  steps: BuildStep[]
  index: ItemIndex
  /** How long the game lasted, when known. */
  duration?: number | null
  /** The game second the video is at. */
  nowGame?: number | null
  onSeek?: (gameSecond: number) => void
  onEdit: ApplyEdit
  /** Called once the item is another one, or gone, with the key of the item the focus goes to. */
  onClose: (next?: string) => void
}) {
  const [choosing, setChoosing] = useState(false)
  const [refusal, setRefusal] = useState<{ spot: Spot; reason: BuildRefusal } | null>(null)
  const key = itemKey(step.item, index)
  const name = itemName(step.item, index)
  const tier = index.find(step.item)?.tier
  const listed = new Set(steps.map((entry) => itemKey(entry.item, index)))
  // One that is listed already takes this item over, so it is the likeliest.
  const upgrades = upgradesOf(step.item, index).sort((a, b) => Number(listed.has(b.id)) - Number(listed.has(a.id)))
  const recipe = recipeParts(step.item, index)
  const from = step.from ?? []
  const parts = [...recipe, ...from.filter((part) => !recipe.some((entry) => entry.id === itemKey(part, index)))]
  const row = stepsAt(steps, step.place)
  const at = row.indexOf(step)
  const reasonAt = (spot: Spot) => (refusal?.spot === spot ? BUILD_REFUSALS[refusal.reason] : null)

  const apply = (spot: Spot, edit: (steps: BuildStep[]) => BuildEdit, done: string) => {
    const reason = onEdit(edit, done)
    setRefusal(reason ? { spot, reason } : null)
    return !reason
  }
  const toggle = (part: Selection) => {
    const off = from.some((entry) => itemKey(entry, index) === itemKey(part, index))
    const done = `${name} ${off ? "không lên từ" : "lên từ"} ${itemName(part, index)}`
    return apply("parts", (current) => togglePart(current, key, part, index), done)
  }
  const upgrade = (target: Reference) => {
    const edit = (current: BuildStep[]) => upgradeItem(current, key, target, index)
    if (apply("upgrade", edit, `${name} đã lên ${target.name}`)) onClose(target.id)
  }
  const move = (to: BuildPlace) => {
    const edit = (current: BuildStep[]) => moveItem(current, key, to, index)
    apply("place", edit, `Đã chuyển ${name} sang “${buildPlace(to).label}”`)
  }
  const shift = (by: -1 | 1) => apply("place", (current) => shiftItem(current, key, by, index), `Đã đổi thứ tự ${name}`)
  const remove = () => {
    const beside = row[at + 1] ?? row[at - 1]
    if (apply("place", (current) => removeItem(current, key, index), `Đã bỏ ${name}`))
      onClose(beside && itemKey(beside.item, index))
  }

  if (choosing)
    return (
      <div className="flex max-h-[min(28rem,var(--radix-popover-content-available-height))] min-h-0 flex-col">
        <header className="flex items-center gap-1 px-1.5 pt-1.5">
          <button
            type="button"
            className={iconButton}
            aria-label={`Quay lại ${name}`}
            onClick={() => {
              setRefusal(null)
              setChoosing(false)
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-0 truncate text-sm font-semibold">{name} lên từ món nào?</span>
        </header>
        <ItemPicker
          label={`${name} lên từ`}
          index={index}
          partsOf={step.item}
          marks={new Map(from.map((part) => [itemKey(part, index), { label: "Đã chọn", here: true }]))}
          message={reasonAt("parts")}
          onPick={(part) => void toggle(part)}
        />
      </div>
    )

  return (
    <div className="space-y-3 p-3">
      <header className="flex items-center gap-2.5">
        <ItemIcon item={step.item} index={index} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold" title={name}>
            {name}
          </span>
          <span className="type-meta block">{tier ? `Cấp ${tier}` : "Chưa rõ cấp"}</span>
        </span>
        {row.length > 1 && (
          <span className="flex" role="group" aria-label="Thứ tự lên">
            {(
              [
                { by: -1, label: "Sớm hơn", icon: ArrowLeft, end: at === 0 },
                { by: 1, label: "Muộn hơn", icon: ArrowRight, end: at === row.length - 1 },
              ] as const
            ).map((entry) => (
              <button
                key={entry.by}
                type="button"
                aria-label={entry.label}
                title={entry.label}
                // Stays focusable at the end of the row, so the key that led there does not lose its place.
                aria-disabled={entry.end}
                onClick={() => shift(entry.by)}
                className={iconButton}
              >
                <entry.icon size={16} />
              </button>
            ))}
          </span>
        )}
        <button
          type="button"
          aria-label={`Bỏ ${name}`}
          title="Bỏ khỏi danh sách"
          onClick={remove}
          className={cn(iconButton, "hover:bg-destructive/10 hover:text-destructive")}
        >
          <Trash2 size={16} />
        </button>
      </header>

      <div className="space-y-1">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="group" aria-label={`Chỗ của ${name}`}>
          {BUILD_PLACES.map((entry) => (
            <button
              key={entry.code}
              type="button"
              aria-pressed={entry.code === step.place}
              title={entry.hint}
              onClick={() => move(entry.code)}
              className={cn(
                "h-8 rounded-md px-1 text-xs font-semibold",
                entry.code === step.place ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.short}
            </button>
          ))}
        </div>
        <Reason>{reasonAt("place")}</Reason>
      </div>

      {upgrades.length > 0 && (
        <Part title="Nâng lên" reason={reasonAt("upgrade")}>
          <div className="grid grid-cols-4 gap-1">
            {upgrades.map((target) => (
              <ItemButton
                key={target.id}
                item={target}
                index={index}
                note={listed.has(target.id) ? "đang có" : undefined}
                onClick={() => upgrade(target)}
              />
            ))}
          </div>
        </Part>
      )}

      {(tier !== MIN_TIER || parts.length > 0) && (
        <Part title="Lên từ" reason={reasonAt("parts")}>
          <div className="grid grid-cols-4 gap-1">
            {parts.map((part) => (
              <ItemButton
                key={itemKey(part, index)}
                item={part}
                index={index}
                pressed={from.some((entry) => itemKey(entry, index) === itemKey(part, index))}
                onClick={() => toggle(part)}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                setRefusal(null)
                setChoosing(true)
              }}
              className="flex min-w-0 flex-col items-center gap-1 rounded-md px-0.5 py-1.5 text-center text-xs leading-tight text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="grid size-9 place-items-center rounded-md border border-dashed border-muted-foreground/50">
                <Plus size={15} aria-hidden="true" />
              </span>
              Món khác
            </button>
          </div>
        </Part>
      )}

      <Part title="Thời điểm" reason={reasonAt("time")}>
        <BuildTimeField
          value={step.atSeconds ?? null}
          nowGame={nowGame}
          onSeek={onSeek}
          onCommit={(second) =>
            void apply(
              "time",
              (current) => setTime(current, key, second, duration, index),
              second === null ? `Đã bỏ thời điểm có ${name}` : `Đã ghi lúc có ${name}: ${formatClock(second)}`,
            )
          }
        />
      </Part>
    </div>
  )
}
