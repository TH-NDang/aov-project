import { useMemo, useState } from "react"
import type { ArcanaAllocation, Catalog, Loadout, Reference } from "@aov/community-contracts"
import { Minus, Plus, X } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { confirmAction } from "@/components/confirm-dialog"
import {
  ARCANA_COLORS,
  ARCANA_PAGE_TIER,
  STONES_PER_COLOR,
  TIER_NUMERALS,
  arcanaColorLocked,
  arcanaLabel,
  arcanaStatus,
  isArcanaColor,
  pickArcana,
  stepArcana,
  stonesOf,
  type ArcanaColor,
} from "../../model/loadout"
import {
  HiddenToggle,
  LoadoutStatus,
  NoteField,
  ReferenceIcon,
  indexOfEntry,
  without,
  type Change,
} from "./loadout-fields"

type Value = Loadout<ArcanaAllocation>

const withEntries = (loadout: Value, entries: ArcanaAllocation[]): Value =>
  entries === loadout.entries ? loadout : { ...loadout, entries, status: arcanaStatus(entries, loadout.status) }

const sameColor = (a: ArcanaAllocation, b: ArcanaAllocation) => a.color === b.color
const picked = "bg-[color-mix(in_oklch,var(--arcana)_16%,transparent)]"

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
  const control =
    "grid size-7 shrink-0 place-items-center rounded-md hover:bg-background/70 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
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

function ArcanaColumn({
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
  value: Value
  options: Reference[]
  byId: Map<string, Reference>
  className?: string
  onChange: Change<Value>
}) {
  const total = stonesOf(value.entries, color)
  const chosen = value.entries.filter((entry) => entry.color === color)
  const locked = arcanaColorLocked(value.entries, color)
  // Stones of a lower tier recorded before tier III became the only choice, or typed by hand, are not among the
  // buttons; they stay listed below so they can still be seen and removed.
  const elsewhere = chosen.filter((entry) => !options.some((stone) => stone.id === entry.selection.id))
  const steps = (entry: ArcanaAllocation, name: string) => (
    <StoneSteps
      name={name}
      entry={entry}
      full={total >= STONES_PER_COLOR}
      onStep={(delta) =>
        onChange((loadout) =>
          withEntries(loadout, stepArcana(loadout.entries, indexOfEntry(loadout.entries, entry, sameColor), delta)),
        )
      }
      onRemove={() =>
        onChange((loadout) =>
          withEntries(loadout, without(loadout.entries, indexOfEntry(loadout.entries, entry, sameColor))),
        )
      }
    />
  )

  return (
    <div data-arcana={color} className={cn("min-w-0", className)}>
      <div className="hidden items-center gap-2 border-b pb-1 @lg:flex">
        <span className="size-2.5 rounded-full bg-[var(--arcana)]" aria-hidden="true" />
        <span className="type-label">{label}</span>
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
      <div className="grid gap-0.5 pt-1">
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
                title={entry ? stone.name : `${stone.name}: lấy hết số viên còn trống của màu này`}
                onClick={() => onChange((loadout) => withEntries(loadout, pickArcana(loadout.entries, stone)))}
                className={cn(
                  "flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left text-xs leading-4 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40",
                  entry ? "font-semibold" : "hover:bg-muted disabled:hover:bg-transparent",
                )}
              >
                <ReferenceIcon reference={stone} name={name} size={24} />
                <span className="line-clamp-2 min-w-0 flex-1">{name}</span>
              </button>
              {entry && steps(entry, name)}
            </div>
          )
        })}
        {!options.length && (
          <p className="px-1.5 py-2 text-xs text-muted-foreground">Danh mục chưa có ngọc cấp III màu này.</p>
        )}
      </div>
      {elsewhere.length > 0 && (
        <ul className="mt-1 space-y-0.5 border-t pt-1" aria-label={`Ngọc ${label} đã ghi ngoài cấp III`}>
          {elsewhere.map((entry, index) => {
            const reference = byId.get(entry.selection.id ?? "")
            const name = arcanaLabel(entry.selection.name ?? reference?.name)
            return (
              <li
                key={entry.selection.id ?? `${entry.selection.name}-${index}`}
                className={cn("flex h-10 items-center gap-0.5 rounded-md pr-0.5 pl-1.5", picked)}
              >
                <ReferenceIcon reference={reference} name={name} size={24} />
                <span
                  className="min-w-0 flex-1 truncate pl-1.5 text-xs font-semibold"
                  title={entry.selection.name ?? name}
                >
                  {name}
                  {reference?.tier ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      (cấp {TIER_NUMERALS[reference.tier - 1]})
                    </span>
                  ) : null}
                </span>
                {steps(entry, name)}
              </li>
            )
          })}
        </ul>
      )}
      {locked && (
        <p className="px-1.5 pt-1 text-xs text-muted-foreground">
          Đã đủ {STONES_PER_COLOR} viên chia nhiều loại. Bớt một loại để thêm loại khác.
        </p>
      )}
    </div>
  )
}

/**
 * The arcana page: one column per colour, each stone a button carrying its picture and the stat a broadcast prints.
 * One click fills the colour, so the common page (one kind per colour) takes three clicks.
 */
export function ArcanaEditor({
  value,
  catalog,
  onChange,
}: {
  value: Value
  catalog: Catalog
  onChange: Change<Value>
}) {
  // Where the three columns do not fit side by side, one colour is shown at a time.
  const [colorShown, setColorShown] = useState<ArcanaColor>("RED")
  const byId = useMemo(() => new Map(catalog.arcana.map((stone) => [stone.id, stone])), [catalog.arcana])
  const status = arcanaStatus(value.entries, value.status)
  const hidden = status === "NOT_SHOWN"
  const total = value.entries.reduce((sum, entry) => sum + entry.count, 0)
  const uncoloured = value.entries.filter((entry) => !isArcanaColor(entry.color))
  const toggleHidden = async () => {
    if (hidden) return onChange((loadout) => ({ ...loadout, status: "UNKNOWN" }))
    if (
      value.entries.length &&
      !(await confirmAction({
        title: "Đánh dấu nguồn không hiển thị bảng ngọc?",
        description: `${value.entries.length} loại ngọc đã ghi của tuyển thủ này sẽ bị bỏ.`,
        confirmLabel: "Bỏ và đánh dấu",
      }))
    )
      return
    onChange((loadout) => ({ ...loadout, status: "NOT_SHOWN", entries: [] }))
  }

  return (
    <section data-part="arcana" className="@container space-y-2" aria-label="Bảng ngọc">
      <header className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1">
        <LoadoutStatus status={status} progress={`${total}/${STONES_PER_COLOR * ARCANA_COLORS.length}`} />
        <span className="ml-auto">
          <HiddenToggle hidden={hidden} label="bảng ngọc" onToggle={() => void toggleHidden()} />
        </span>
      </header>
      {hidden ? (
        <p className="text-sm text-muted-foreground">
          Video không hiện bảng ngọc của tuyển thủ này; không xem đây là bảng trống.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1 @lg:hidden" role="group" aria-label="Màu ngọc">
            {ARCANA_COLORS.map((color) => (
              <button
                key={color.code}
                type="button"
                data-arcana={color.code}
                aria-pressed={colorShown === color.code}
                onClick={() => setColorShown(color.code)}
                className={cn(
                  "flex h-8 items-center justify-center gap-1.5 rounded text-xs font-semibold focus-visible:outline-2 focus-visible:outline-ring",
                  colorShown === color.code ? "bg-background" : "text-muted-foreground",
                )}
              >
                <span className="size-2 rounded-full bg-[var(--arcana)]" aria-hidden="true" />
                {color.label}
                <span className="esp-num font-normal">
                  {stonesOf(value.entries, color.code)}/{STONES_PER_COLOR}
                </span>
              </button>
            ))}
          </div>
          <div className="grid gap-4 @lg:grid-cols-3">
            {ARCANA_COLORS.map((color) => (
              <ArcanaColumn
                key={color.code}
                color={color.code}
                label={color.label}
                className={colorShown === color.code ? undefined : "hidden @lg:block"}
                value={value}
                byId={byId}
                options={catalog.arcana.filter(
                  (stone) => stone.color === color.code && stone.tier === ARCANA_PAGE_TIER,
                )}
                onChange={onChange}
              />
            ))}
          </div>
          {uncoloured.length > 0 && (
            <ul className="space-y-1 border-t pt-2" aria-label="Ngọc chưa rõ màu">
              {uncoloured.map((entry, index) => (
                <li key={index} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate">
                    {entry.selection.name || "Loại ngọc chưa rõ"} ×{entry.count}, chưa rõ màu
                  </span>
                  <button
                    type="button"
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                    aria-label={`Bỏ ${entry.selection.name || "loại ngọc chưa rõ"}`}
                    onClick={() =>
                      onChange((loadout) =>
                        withEntries(loadout, without(loadout.entries, indexOfEntry(loadout.entries, entry, sameColor))),
                      )
                    }
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <NoteField
        label="Ghi chú bảng ngọc"
        value={value.note ?? ""}
        onCommit={(note) => onChange((loadout) => ({ ...loadout, note }))}
      />
    </section>
  )
}
