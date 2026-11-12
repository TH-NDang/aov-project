import { useMemo, useState, type ReactNode } from "react"
import type {
  ArcanaAllocation,
  Catalog,
  EnchantmentAllocation,
  Loadout,
  ObservationStatus,
  Participant,
  Reference,
} from "@aov/community-contracts"
import { EyeOff, Minus, Plus, X } from "lucide-react"
import { Textarea } from "@aov/ui/components/textarea"
import { cn } from "@aov/ui/lib/utils"
import { confirmAction } from "@/components/confirm-dialog"
import { initials } from "../model/game-view"
import {
  ARCANA_COLORS,
  STONES_PER_COLOR,
  TIER_NUMERALS,
  arcanaColorLocked,
  arcanaLabel,
  arcanaStatus,
  branchLabel,
  enchantmentBranches,
  enchantmentStatus,
  isArcanaColor,
  mainBranch,
  pickArcana,
  pickEnchantment,
  replacedMainPicks,
  stepArcana,
  stonesOf,
  type ArcanaColor,
} from "../model/loadout"
import { Monogram } from "../components/primitives"

/** Renders the control that records when the source showed a loadout; omitted where no clock is available. */
export type ObservedAtControl = (
  value: number | null | undefined,
  onChange: (second: number | null) => void,
  label: string,
) => ReactNode

/**
 * Every edit is a change applied to the latest value, never a copy of what was on screen, so two edits made before
 * the first one is saved cannot undo each other.
 */
type Change<T> = (change: (value: T) => T) => void

const withArcana = (loadout: Loadout<ArcanaAllocation>, entries: ArcanaAllocation[]): Loadout<ArcanaAllocation> =>
  entries === loadout.entries ? loadout : { ...loadout, entries, status: arcanaStatus(entries, loadout.status) }

const withEnchantments = (
  loadout: Loadout<EnchantmentAllocation>,
  entries: EnchantmentAllocation[],
): Loadout<EnchantmentAllocation> =>
  entries === loadout.entries ? loadout : { ...loadout, entries, status: enchantmentStatus(entries, loadout.status) }

/**
 * Where an entry sits now; entries are matched by what they are because positions shift between edits. Older data
 * holds rows without a name, which only their other fields tell apart, so an identical row is looked for first.
 */
function indexOfEntry<T extends { selection: { id?: string | null; name?: string | null } }>(
  entries: T[],
  target: T,
  same: (a: T, b: T) => boolean,
) {
  const named = (entry: T) =>
    (entry.selection.id ?? null) === (target.selection.id ?? null) &&
    (entry.selection.name ?? null) === (target.selection.name ?? null)
  const exact = entries.findIndex((entry) => named(entry) && JSON.stringify(entry) === JSON.stringify(target))
  return exact >= 0 ? exact : entries.findIndex((entry) => named(entry) && same(entry, target))
}

const without = <T,>(entries: T[], index: number) =>
  index < 0 ? entries : entries.filter((_, position) => position !== index)

function StatusChip({ status, progress }: { status: ObservationStatus; progress: string }) {
  const text =
    status === "KNOWN"
      ? `Đủ ${progress}`
      : status === "PARTIAL"
        ? `Một phần · ${progress}`
        : status === "NOT_SHOWN"
          ? "Nguồn không hiển thị"
          : "Chưa ghi"
  return (
    <span
      data-status={status}
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        status === "KNOWN" && "bg-[color-mix(in_oklch,var(--esp-live)_18%,transparent)] text-foreground",
        status === "PARTIAL" && "bg-[var(--esp-gold-soft)] text-foreground",
        (status === "UNKNOWN" || status === "NOT_SHOWN") && "bg-muted text-muted-foreground",
      )}
    >
      {text}
    </span>
  )
}

/** Says the source never showed this loadout, which is not the same as the player using nothing. */
function HiddenToggle({ hidden, label, onToggle }: { hidden: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={hidden}
      title={
        hidden
          ? `Bỏ đánh dấu để ghi ${label}`
          : `Đánh dấu khi video không hiện ${label}; khác với tuyển thủ không dùng gì`
      }
      onClick={onToggle}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs",
        hidden ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted",
      )}
    >
      <EyeOff size={13} /> Nguồn không hiển thị
    </button>
  )
}

/** A note typed freely and saved when the field is left, since every save is a request. */
function NoteField({ label, value, onCommit }: { label: string; value: string; onCommit: (note: string) => void }) {
  const [text, setText] = useState(value)
  return (
    <Textarea
      aria-label={label}
      placeholder="Ghi chú nguồn hoặc phần còn thiếu…"
      value={text}
      maxLength={1000}
      rows={2}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => text.trim() !== value.trim() && onCommit(text.trim())}
    />
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

function ArcanaColumn({
  color,
  label,
  value,
  options,
  byId,
  onChange,
}: {
  color: ArcanaColor
  label: string
  value: Loadout<ArcanaAllocation>
  options: Reference[]
  byId: Map<string, Reference>
  onChange: Change<Loadout<ArcanaAllocation>>
}) {
  const total = stonesOf(value.entries, color)
  const chosen = value.entries.filter((entry) => entry.color === color)
  const locked = arcanaColorLocked(value.entries, color)
  // Stones recorded from another tier, or typed by hand before, are not among the buttons of this tier.
  const elsewhere = chosen.filter((entry) => !options.some((stone) => stone.id === entry.selection.id))
  const same = (a: ArcanaAllocation, b: ArcanaAllocation) => a.color === b.color
  const step = (entry: ArcanaAllocation, delta: number) =>
    onChange((loadout) =>
      withArcana(loadout, stepArcana(loadout.entries, indexOfEntry(loadout.entries, entry, same), delta)),
    )
  const remove = (entry: ArcanaAllocation) =>
    onChange((loadout) => withArcana(loadout, without(loadout.entries, indexOfEntry(loadout.entries, entry, same))))
  const picked = "bg-[color-mix(in_oklch,var(--arcana)_16%,transparent)]"

  return (
    <div data-arcana={color} className="min-w-0 rounded-lg border">
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
        {!options.length && <p className="px-1.5 py-2 text-xs text-muted-foreground">Danh mục chưa có ngọc cấp này.</p>}
      </div>
      {elsewhere.length > 0 && (
        <ul className="space-y-0.5 border-t p-1" aria-label={`Ngọc ${label} đã ghi ngoài cấp đang xem`}>
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

/**
 * The arcana page: one column per colour, each stone a button carrying its picture and the stat a broadcast prints.
 * One click fills the colour, so the common page (one kind per colour) takes three clicks.
 */
function ArcanaEditor({
  value,
  catalog,
  observedAt,
  onChange,
}: {
  value: Loadout<ArcanaAllocation>
  catalog: Catalog
  observedAt?: ObservedAtControl
  onChange: Change<Loadout<ArcanaAllocation>>
}) {
  const [tier, setTier] = useState(3)
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
    <section data-part="arcana" className="space-y-2.5" aria-label="Bảng ngọc">
      <header className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">Bảng ngọc</h4>
        <StatusChip status={status} progress={`${total}/${STONES_PER_COLOR * 3}`} />
        <HiddenToggle hidden={hidden} label="bảng ngọc" onToggle={() => void toggleHidden()} />
        {observedAt?.(
          value.observedAtSeconds,
          (observedAtSeconds) => onChange((loadout) => ({ ...loadout, observedAtSeconds })),
          "bảng ngọc",
        )}
      </header>
      {hidden ? (
        <p className="text-xs text-muted-foreground">
          Video không hiện bảng ngọc của tuyển thủ này; không xem đây là bảng trống.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Cấp ngọc</span>
            <span className="inline-flex rounded-md bg-muted p-0.5" role="group" aria-label="Cấp ngọc">
              {[3, 2, 1].map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={tier === option}
                  onClick={() => setTier(option)}
                  className={cn(
                    "h-6 min-w-8 rounded px-2 text-xs font-semibold",
                    tier === option ? "bg-background shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {TIER_NUMERALS[option - 1]}
                </button>
              ))}
            </span>
            <span className="text-xs text-muted-foreground">
              Bấm một loại ngọc để lấy hết số viên còn trống của màu đó.
            </span>
          </div>
          <div className="grid gap-2 @lg:grid-cols-3">
            {ARCANA_COLORS.map((color) => (
              <ArcanaColumn
                key={color.code}
                color={color.code}
                label={color.label}
                value={value}
                byId={byId}
                options={catalog.arcana.filter((stone) => stone.color === color.code && stone.tier === tier)}
                onChange={onChange}
              />
            ))}
          </div>
          {uncoloured.length > 0 && (
            <ul className="space-y-1 rounded-lg border p-1.5" aria-label="Ngọc chưa rõ màu">
              {uncoloured.map((entry, index) => (
                <li key={index} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate">
                    {entry.selection.name || "Loại ngọc chưa rõ"} ×{entry.count} · chưa rõ màu
                  </span>
                  <button
                    type="button"
                    className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                    aria-label={`Bỏ ${entry.selection.name || "loại ngọc chưa rõ"}`}
                    onClick={() =>
                      onChange((loadout) =>
                        withArcana(
                          loadout,
                          without(
                            loadout.entries,
                            indexOfEntry(loadout.entries, entry, (a, b) => a.color === b.color),
                          ),
                        ),
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
        key={value.note ?? ""}
        label="Ghi chú bảng ngọc"
        value={value.note ?? ""}
        onCommit={(note) => onChange((loadout) => ({ ...loadout, note }))}
      />
    </section>
  )
}

function EnchantmentTile({
  enchantment,
  pressed,
  onClick,
}: {
  enchantment: Reference
  pressed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-enchantment={enchantment.code}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex w-20 flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-center text-xs leading-tight",
        pressed ? "border-[var(--esp-gold)] bg-[var(--esp-gold-soft)] font-semibold" : "hover:bg-muted",
      )}
    >
      <Monogram
        url={enchantment.iconUrl}
        label=""
        text={initials(enchantment.name).slice(0, 2)}
        size={34}
        className="rounded-full"
      />
      <span className="line-clamp-2">{enchantment.name}</span>
    </button>
  )
}

/**
 * The emblem set as the game lays it out: one main branch with a pick on each of its three tiers, and two secondary
 * picks from the other branches. Picks that cannot stand together replace each other, so the set stays one the
 * service accepts while it is being built.
 */
function EnchantmentsEditor({
  value,
  catalog,
  observedAt,
  onChange,
}: {
  value: Loadout<EnchantmentAllocation>
  catalog: Catalog
  observedAt?: ObservedAtControl
  onChange: Change<Loadout<EnchantmentAllocation>>
}) {
  const branches = useMemo(() => enchantmentBranches(catalog.enchantments), [catalog.enchantments])
  const byId = useMemo(() => new Map(catalog.enchantments.map((entry) => [entry.id, entry])), [catalog.enchantments])
  const recorded = mainBranch(value.entries)
  const [viewed, setViewed] = useState<string | null>(null)
  const branch = viewed ?? recorded ?? branches[0] ?? null
  const status = enchantmentStatus(value.entries, value.status)
  const hidden = status === "NOT_SHOWN"
  const primary = value.entries.filter((entry) => entry.primary)
  const secondary = value.entries.filter((entry) => !entry.primary)
  const chosen = (reference: Reference, main: boolean) =>
    value.entries.some((entry) => entry.selection.id === reference.id && entry.primary === main)
  const optionsOf = (code: string, tier: number) =>
    catalog.enchantments.filter((entry) => entry.branchCode === code && entry.tier === tier)
  const pick = (reference: Reference, main: boolean) =>
    onChange((loadout) => withEnchantments(loadout, pickEnchantment(loadout.entries, reference, main)))
  const pickMain = async (reference: Reference) => {
    const lost = chosen(reference, true) ? [] : replacedMainPicks(value.entries, reference)
    if (
      lost.length &&
      !(await confirmAction({
        title: `Đổi nhánh chính sang ${branchLabel(reference.branchCode)}?`,
        description: `${lost.length} phù hiệu chính đã ghi ở ${branchLabel(recorded)} sẽ bị bỏ. Ô phụ thuộc ${branchLabel(reference.branchCode)} cũng bị bỏ vì ô phụ phải khác nhánh chính.`,
        confirmLabel: "Đổi nhánh chính",
      }))
    )
      return
    pick(reference, true)
  }
  const remove = (entry: EnchantmentAllocation) =>
    onChange((loadout) => {
      const index = indexOfEntry(loadout.entries, entry, (a, b) => a.primary === b.primary && a.tier === b.tier)
      return withEnchantments(
        loadout,
        index < 0 ? loadout.entries : loadout.entries.filter((_, position) => position !== index),
      )
    })
  const toggleHidden = async () => {
    if (hidden) return onChange((loadout) => ({ ...loadout, status: "UNKNOWN" }))
    if (
      value.entries.length &&
      !(await confirmAction({
        title: "Đánh dấu nguồn không hiển thị phù hiệu?",
        description: `${value.entries.length} phù hiệu đã ghi của tuyển thủ này sẽ bị bỏ.`,
        confirmLabel: "Bỏ và đánh dấu",
      }))
    )
      return
    onChange((loadout) => ({ ...loadout, status: "NOT_SHOWN", entries: [] }))
  }
  // The five slots the game shows; an entry recorded outside them (older manual data) is listed after them.
  const slots: { label: string; entry?: EnchantmentAllocation }[] = [
    ...[1, 2, 3].map((tier) => ({
      label: `Chính ${TIER_NUMERALS[tier - 1]}`,
      entry: primary.find((entry) => entry.tier === tier),
    })),
    { label: "Phụ", entry: secondary[0] },
    { label: "Phụ", entry: secondary[1] },
  ]
  const placed = new Set(slots.flatMap((slot) => (slot.entry ? [slot.entry] : [])))
  const extra = value.entries.filter((entry) => !placed.has(entry))

  return (
    <section data-part="enchantments" className="space-y-2.5" aria-label="Phù hiệu">
      <header className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">Phù hiệu</h4>
        <StatusChip status={status} progress={`${value.entries.length}/5`} />
        <HiddenToggle hidden={hidden} label="phù hiệu" onToggle={() => void toggleHidden()} />
        {observedAt?.(
          value.observedAtSeconds,
          (observedAtSeconds) => onChange((loadout) => ({ ...loadout, observedAtSeconds })),
          "phù hiệu",
        )}
      </header>
      {hidden ? (
        <p className="text-xs text-muted-foreground">
          Video không hiện phù hiệu của tuyển thủ này; không xem đây là chưa dùng phù hiệu.
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-1.5 @lg:grid-cols-5" aria-label="Phù hiệu đã ghi">
            {[...slots, ...extra.map((entry) => ({ label: entry.primary ? "Chính" : "Phụ", entry }))].map(
              (slot, index) => {
                const name = slot.entry
                  ? slot.entry.selection.name || byId.get(slot.entry.selection.id ?? "")?.name || "Chưa rõ tên"
                  : null
                return (
                  <li
                    key={index}
                    data-filled={!!slot.entry || undefined}
                    className={cn(
                      "flex h-12 min-w-0 items-center gap-1.5 rounded-lg border py-1 pr-0.5 pl-1.5 text-xs",
                      !slot.entry && "border-dashed text-muted-foreground",
                    )}
                  >
                    {slot.entry && name ? (
                      <Monogram
                        url={byId.get(slot.entry.selection.id ?? "")?.iconUrl}
                        label=""
                        text={initials(name).slice(0, 2)}
                        size={26}
                        className="shrink-0 rounded-full"
                      />
                    ) : (
                      <span
                        className="grid size-[26px] shrink-0 place-items-center rounded-full border border-dashed"
                        aria-label="Chưa ghi"
                      >
                        ?
                      </span>
                    )}
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block text-muted-foreground">{slot.label}</span>
                      <span className="block truncate font-semibold" title={name ?? undefined}>
                        {name ?? "Chưa ghi"}
                      </span>
                    </span>
                    {slot.entry && name && (
                      <button
                        type="button"
                        className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Bỏ ${name}`}
                        onClick={() => remove(slot.entry!)}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </li>
                )
              },
            )}
          </ul>

          <div className="space-y-1.5 rounded-lg border p-2">
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Nhánh chính">
              <span className="mr-1 text-xs font-semibold">Nhánh chính</span>
              {branches.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={branch === code}
                  onClick={() => setViewed(code)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs",
                    branch === code ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {branchLabel(code)}
                  {recorded === code && (
                    <span className="size-1.5 rounded-full bg-[var(--esp-gold)]" title="Nhánh chính đang ghi" />
                  )}
                </button>
              ))}
            </div>
            {branch &&
              [1, 2, 3].map((tier) => (
                <div key={tier} className="flex items-start gap-2">
                  <span className="w-12 shrink-0 pt-2 text-xs text-muted-foreground">
                    Cấp {TIER_NUMERALS[tier - 1]}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {optionsOf(branch, tier).map((option) => (
                      <EnchantmentTile
                        key={option.id}
                        enchantment={option}
                        pressed={chosen(option, true)}
                        onClick={() => void pickMain(option)}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>

          <div className="space-y-1.5 rounded-lg border p-2">
            <p className="text-xs">
              <span className="font-semibold">Nhánh phụ</span>{" "}
              <span className="text-muted-foreground">
                · hai ô: cấp I và II của một nhánh, hoặc cấp I của hai nhánh
              </span>
            </p>
            {branches
              .filter((code) => code !== (recorded ?? branch))
              .map((code) => (
                <div key={code} className="flex items-start gap-2" data-secondary-branch={code}>
                  <span className="w-20 shrink-0 pt-2 text-xs text-muted-foreground">{branchLabel(code)}</span>
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                    {[1, 2].map((tier) => (
                      <div key={tier} className="flex items-start gap-1">
                        <span className="w-4 pt-2 text-xs text-muted-foreground">{TIER_NUMERALS[tier - 1]}</span>
                        {optionsOf(code, tier).map((option) => (
                          <EnchantmentTile
                            key={option.id}
                            enchantment={option}
                            pressed={chosen(option, false)}
                            onClick={() => pick(option, false)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
      <NoteField
        key={value.note ?? ""}
        label="Ghi chú phù hiệu"
        value={value.note ?? ""}
        onCommit={(note) => onChange((loadout) => ({ ...loadout, note }))}
      />
    </section>
  )
}

/** Emblems first, then arcana: the order a broadcast shows them and the order of the icons on the scoreboard. */
export function LoadoutEditor({
  participant,
  catalog,
  observedAt,
  onChange,
}: {
  participant: Participant
  catalog: Catalog
  observedAt?: ObservedAtControl
  onChange: Change<Participant>
}) {
  return (
    <div className="@container space-y-5">
      <EnchantmentsEditor
        value={participant.enchantments}
        catalog={catalog}
        observedAt={observedAt}
        onChange={(change) =>
          onChange((current) => {
            const enchantments = change(current.enchantments)
            return enchantments === current.enchantments ? current : { ...current, enchantments }
          })
        }
      />
      <ArcanaEditor
        value={participant.arcana}
        catalog={catalog}
        observedAt={observedAt}
        onChange={(change) =>
          onChange((current) => {
            const arcana = change(current.arcana)
            return arcana === current.arcana ? current : { ...current, arcana }
          })
        }
      />
    </div>
  )
}
