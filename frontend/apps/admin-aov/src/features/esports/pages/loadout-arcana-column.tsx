import type { ArcanaAllocation, Loadout, Reference } from "@aov/community-contracts"
import { Minus, Plus, X } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { Monogram } from "../components/primitives"
import { initials } from "../model/game-view"
import {
  STONES_PER_COLOR,
  TIER_NUMERALS,
  arcanaColorLocked,
  arcanaLabel,
  pickArcana,
  removeRecordedStone,
  stepRecordedStone,
  stonesOf,
  withArcana,
  type ArcanaColor,
} from "../model/loadout"
import type { Change } from "./loadout-section"

/** One colour of the arcana page: a button per tier III stone, its count and steppers on its own row once chosen. */
export function ArcanaColumn({
  color,
  label,
  value,
  options,
  byId,
  className,
  onChange,
}: {
  color: ArcanaColor
  label: string
  value: Loadout<ArcanaAllocation>
  options: Reference[]
  byId: Map<string, Reference>
  className?: string
  onChange: Change<Loadout<ArcanaAllocation>>
}) {
  const total = stonesOf(value.entries, color)
  const chosen = value.entries.filter((entry) => entry.color === color)
  const locked = arcanaColorLocked(value.entries, color)
  // Stones of a lower tier recorded before tier III became the only choice, or typed by hand, are not among the
  // buttons; they stay listed below so they can still be seen and removed.
  const elsewhere = chosen.filter((entry) => !options.some((stone) => stone.id === entry.selection.id))
  const step = (entry: ArcanaAllocation, delta: number) =>
    onChange((loadout) => stepRecordedStone(loadout, entry, delta))
  const remove = (entry: ArcanaAllocation) => onChange((loadout) => removeRecordedStone(loadout, entry))
  const picked = "bg-[color-mix(in_oklch,var(--arcana)_16%,transparent)]"

  return (
    <div data-arcana={color} className={cn("min-w-0 rounded-lg border", className)}>
      <div className="flex items-center gap-2 border-b px-2 py-1.5">
        <span className="size-2.5 rounded-full bg-[var(--arcana)]" aria-hidden="true" />
        <span className="text-xs font-semibold">{label}</span>
        <span
          className={cn(
            "esp-num ml-auto text-xs",
            total === STONES_PER_COLOR ? "font-semibold" : "text-muted-foreground",
          )}
          aria-label={`${label}: ${total} trên ${STONES_PER_COLOR} viên`}
        >
          {total}/{STONES_PER_COLOR}
        </span>
      </div>
      {/* The count and its steppers appear on the stone's own row, so no button moves while stones are picked. */}
      <div className="grid gap-0.5 p-1">
        {options.map((stone) => {
          const entry = chosen.find((candidate) => candidate.selection.id === stone.id)
          const name = arcanaLabel(stone.name)
          return (
            <div key={stone.id} className={cn("flex h-10 items-center gap-0.5 rounded-md pr-0.5", entry && picked)}>
              <button
                type="button"
                data-stone={stone.code}
                aria-pressed={!!entry}
                disabled={!entry && locked}
                title={stone.name}
                onClick={() => onChange((loadout) => withArcana(loadout, pickArcana(loadout.entries, stone)))}
                className={cn(
                  "flex h-10 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 text-left text-xs leading-tight disabled:opacity-40",
                  entry ? "font-semibold" : "hover:bg-muted disabled:hover:bg-transparent",
                )}
              >
                <ReferenceIcon reference={stone} name={name} size={22} />
                <span className="line-clamp-2 min-w-0 flex-1">{name}</span>
              </button>
              {entry && (
                <StoneSteps
                  name={name}
                  entry={entry}
                  full={total >= STONES_PER_COLOR}
                  onStep={(delta) => step(entry, delta)}
                  onRemove={() => remove(entry)}
                />
              )}
            </div>
          )
        })}
        {!options.length && (
          <p className="px-1.5 py-2 text-xs text-muted-foreground">Danh mục chưa có ngọc cấp III màu này.</p>
        )}
      </div>
      {elsewhere.length > 0 && (
        <ul className="space-y-0.5 border-t p-1" aria-label={`Ngọc ${label} đã ghi ngoài cấp III`}>
          {elsewhere.map((entry, index) => {
            const reference = byId.get(entry.selection.id ?? "")
            const name = arcanaLabel(entry.selection.name ?? reference?.name)
            return (
              <li
                key={entry.selection.id ?? `${entry.selection.name}-${index}`}
                className={cn("flex h-10 items-center gap-0.5 rounded-md pr-0.5 pl-1.5", picked)}
              >
                <ReferenceIcon reference={reference} name={name} size={22} />
                <span
                  className="min-w-0 flex-1 truncate pl-1.5 text-xs font-semibold"
                  title={entry.selection.name ?? name}
                >
                  {name}
                  {reference?.tier ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · cấp {TIER_NUMERALS[reference.tier - 1]}
                    </span>
                  ) : null}
                </span>
                <StoneSteps
                  name={name}
                  entry={entry}
                  full={total >= STONES_PER_COLOR}
                  onStep={(delta) => step(entry, delta)}
                  onRemove={() => remove(entry)}
                />
              </li>
            )
          })}
        </ul>
      )}
      {locked && (
        <p className="border-t px-2 py-1 text-xs text-muted-foreground">
          Đã đủ {STONES_PER_COLOR} viên chia nhiều loại. Bớt một loại để thêm loại khác.
        </p>
      )}
    </div>
  )
}

function ReferenceIcon({ reference, name, size }: { reference?: Reference; name: string; size: number }) {
  return (
    <Monogram
      url={reference?.iconUrl}
      label=""
      text={initials(name).slice(0, 2)}
      size={size}
      className="shrink-0 rounded-md"
    />
  )
}

/** Count, one stone more or less, and removal, beside the stone they act on. */
function StoneSteps({
  name,
  entry,
  full,
  onStep,
  onRemove,
}: {
  name: string
  entry: ArcanaAllocation
  full: boolean
  onStep: (delta: number) => void
  onRemove: () => void
}) {
  const control = "grid size-6 shrink-0 place-items-center rounded-md hover:bg-background/70 disabled:opacity-40"
  return (
    <>
      <button type="button" className={control} aria-label={`Bớt một viên ${name}`} onClick={() => onStep(-1)}>
        <Minus size={12} />
      </button>
      <span className="esp-num w-5 shrink-0 text-center text-xs font-semibold" aria-label={`${entry.count} viên`}>
        {entry.count}
      </span>
      <button
        type="button"
        className={control}
        aria-label={`Thêm một viên ${name}`}
        disabled={full}
        onClick={() => onStep(1)}
      >
        <Plus size={12} />
      </button>
      <button
        type="button"
        className={cn(control, "text-muted-foreground hover:text-foreground")}
        aria-label={`Bỏ ${name}`}
        onClick={onRemove}
      >
        <X size={12} />
      </button>
    </>
  )
}
