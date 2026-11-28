import type { ReactNode } from "react"
import type { BuildRole, BuildStep, Selection } from "@aov/community-contracts"
import { ArrowRight, Shield } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { buildRole, itemKey, itemName, successor, type Fate, type ItemIndex } from "../../model/build"

/** What became of an item, as the catalogue marks one that is listed already. */
export const FATE_WORDS: Record<Fate, string> = { HELD: "Cuối ván", UPGRADED: "Đã lên", SOLD: "Đã bán" }

/** The number of a step, as the lines of other steps point to it. */
function StepNumber({ at, className }: { at: number; className?: string }) {
  return (
    <span
      className={cn(
        "esp-num inline-grid min-w-4.5 place-items-center rounded-full border px-1 leading-4 font-semibold",
        className,
      )}
    >
      {at + 1}
    </span>
  )
}

/** What the line under an item says: its tier where it is not finished, what became of it and what it came from. */
export function StepNotes({
  steps,
  at,
  fate,
  index,
}: {
  steps: BuildStep[]
  at: number
  fate: Fate
  index: ItemIndex
}) {
  const step = steps[at]!
  const position = (item: Selection) =>
    steps.findIndex((entry, earlier) => earlier < at && itemKey(entry.item, index) === itemKey(item, index))
  const next = successor(steps, at, index)
  const parts = (step.from ?? []).map((part) => ({ part, at: position(part) }))
  const gone = (step.replaces ?? []).map(position).filter((earlier) => earlier >= 0)
  const notes: ReactNode[] = []
  if (index.find(step.item)?.tier === 2) notes.push("Cấp 2")
  if (fate === "UPGRADED")
    notes.push(
      <span key="up" className="inline-flex items-center gap-1 text-(--aov-success)">
        <ArrowRight size={12} aria-hidden="true" /> lên <StepNumber at={next} />
      </span>,
    )
  if (fate === "SOLD")
    notes.push(
      <span key="sold" className="inline-flex items-center gap-1 text-(--aov-warning)">
        Đã bán {next >= 0 && <StepNumber at={next} />}
      </span>,
    )
  if (parts.length)
    notes.push(
      <span key="from" className="inline-flex items-center gap-1">
        Lên từ{" "}
        {parts.map(({ part, at: earlier }) =>
          earlier >= 0 ? (
            <StepNumber key={itemKey(part, index)} at={earlier} />
          ) : (
            <span key={itemKey(part, index)}>{itemName(part, index)}</span>
          ),
        )}
      </span>,
    )
  if (gone.length)
    notes.push(
      <span key="gone" className="inline-flex items-center gap-1">
        Thay{" "}
        {gone.map((earlier) => (
          <StepNumber key={earlier} at={earlier} />
        ))}
      </span>,
    )
  if (!notes.length) return null
  return (
    <span className="type-meta flex flex-wrap items-center gap-x-1">
      {notes.flatMap((note, position) => (position ? [<span key={`dot-${position}`}>·</span>, note] : [note]))}
    </span>
  )
}

/** The role of an item as a pill a press turns to the other one. */
export function RolePill({
  role,
  name,
  onChange,
}: {
  role: BuildRole
  name: string
  onChange: (role: BuildRole) => void
}) {
  const other: BuildRole = role === "CORE" ? "PROTECTIVE" : "CORE"
  return (
    <button
      type="button"
      aria-label={`${name}: ${buildRole(role).label}. Đổi sang ${buildRole(other).label}`}
      title={`${buildRole(role).hint}. Bấm để đổi sang ${buildRole(other).label}`}
      onClick={() => onChange(other)}
      className={cn(
        "inline-flex h-7 w-20 shrink-0 items-center justify-center gap-1 rounded-full text-xs font-semibold focus-visible:outline-2 focus-visible:outline-ring",
        role === "PROTECTIVE"
          ? "border border-(--aov-info) bg-(--aov-info-soft) text-(--aov-info)"
          : "bg-(--aov-warning-soft) text-(--aov-warning)",
      )}
    >
      {role === "PROTECTIVE" && <Shield size={12} fill="currentColor" aria-hidden="true" />}
      {buildRole(role).label}
    </button>
  )
}
