import { useMemo, useState } from "react"
import type { Catalog, EnchantmentAllocation, Loadout, Reference } from "@aov/community-contracts"
import { X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { confirmAction } from "@/components/confirm-dialog"
import {
  MAIN_EMBLEM_TIER,
  TIER_NUMERALS,
  branchLabel,
  enchantmentBranches,
  enchantmentStatus,
  lostEnchantments,
  mainBranch,
  pickEnchantment,
} from "../../model/loadout"
import {
  HiddenToggle,
  LoadoutStatus,
  NoteField,
  ReferenceIcon,
  chosenTile,
  indexOfEntry,
  without,
  type Change,
} from "./loadout-fields"

type Value = Loadout<EnchantmentAllocation>

const withEntries = (loadout: Value, entries: EnchantmentAllocation[]): Value =>
  entries === loadout.entries ? loadout : { ...loadout, entries, status: enchantmentStatus(entries, loadout.status) }

/** An emblem as a choice: its picture beside its name in a list that is read, under it in a grid of many. */
function EmblemTile({
  emblem,
  pressed,
  stacked,
  onClick,
}: {
  emblem: Reference
  pressed: boolean
  stacked?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-enchantment={emblem.code}
      aria-pressed={pressed}
      title={emblem.name}
      onClick={onClick}
      className={cn(
        "flex min-w-0 items-center rounded-md text-xs leading-4 focus-visible:outline-2 focus-visible:outline-ring",
        stacked ? "flex-col gap-1 px-0.5 py-1.5 text-center" : "min-h-11 gap-2 px-1.5 text-left",
        pressed ? chosenTile : "hover:bg-muted",
      )}
    >
      <ReferenceIcon reference={emblem} name={emblem.name} size={stacked ? 32 : 28} round />
      <span className="line-clamp-2 min-w-0">{emblem.name}</span>
    </button>
  )
}

/**
 * The emblems of a player. A broadcast mostly shows the main emblem of tier III alone, so the twelve of them come first;
 * all five slots are one press away, as the game lays them out: one main branch with a pick on each of its three tiers,
 * and two secondary picks from the other branches. Picks that cannot stand together replace each other, so the set stays
 * one the service accepts while it is being built.
 */
export function EnchantmentEditor({
  value,
  catalog,
  allSlots,
  onAllSlots,
  onChange,
}: {
  value: Value
  catalog: Catalog
  /** All five slots instead of the main emblem alone. */
  allSlots: boolean
  onAllSlots: (shown: boolean) => void
  onChange: Change<Value>
}) {
  const status = enchantmentStatus(value.entries, value.status)
  const hidden = status === "NOT_SHOWN"
  const pick = (emblem: Reference, main: boolean) =>
    onChange((loadout) => withEntries(loadout, pickEnchantment(loadout.entries, emblem, main)))
  const pickMain = async (emblem: Reference) => {
    // Another branch throws away what was recorded of the one before; one main emblem for another is a plain correction.
    const lost = lostEnchantments(value.entries, emblem)
    if (lost.length) {
      const to = branchLabel(emblem.branchCode)
      const accepted = await confirmAction({
        title: `Đổi nhánh chính sang ${to}?`,
        description: `${lost.length} phù hiệu đã ghi sẽ bị bỏ: ${lost.map(({ selection }) => selection.name || "chưa rõ tên").join(", ")}.`,
        confirmLabel: "Đổi nhánh chính",
      })
      if (!accepted) return
    }
    pick(emblem, true)
  }
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
  const parts = { value, catalog, onMain: (emblem: Reference) => void pickMain(emblem) }

  return (
    <section data-part="enchantments" className="space-y-2" aria-label="Phù hiệu">
      <header className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1">
        <LoadoutStatus status={status} progress={`${value.entries.length}/5`} />
        <span className="ml-auto flex flex-wrap justify-end">
          <HiddenToggle hidden={hidden} label="phù hiệu" onToggle={() => void toggleHidden()} />
          {!hidden && (
            <Button type="button" size="xs" variant="ghost" onClick={() => onAllSlots(!allSlots)}>
              {allSlots ? "Chỉ ô chính" : "Đủ năm ô"}
            </Button>
          )}
        </span>
      </header>
      {hidden ? (
        <p className="text-sm text-muted-foreground">
          Video không hiện phù hiệu của tuyển thủ này; không xem đây là chưa dùng phù hiệu.
        </p>
      ) : allSlots ? (
        <AllSlots {...parts} onSecondary={(emblem) => pick(emblem, false)} onChange={onChange} />
      ) : (
        <MainEmblems {...parts} />
      )}
      <NoteField
        label="Ghi chú phù hiệu"
        value={value.note ?? ""}
        onCommit={(note) => onChange((loadout) => ({ ...loadout, note }))}
      />
    </section>
  )
}

const chosen = (value: Value, emblem: Reference, main: boolean) =>
  value.entries.some((entry) => entry.selection.id === emblem.id && entry.primary === main)
const emblemsOf = (catalog: Catalog, branch: string, tier: number) =>
  catalog.enchantments.filter((entry) => entry.branchCode === branch && entry.tier === tier)

type PartsProps = { value: Value; catalog: Catalog; onMain: (emblem: Reference) => void }

/** The main emblem of tier III, branch by branch. */
function MainEmblems({ value, catalog, onMain }: PartsProps) {
  const branches = useMemo(() => enchantmentBranches(catalog.enchantments), [catalog.enchantments])
  return (
    <div className="@container space-y-1" role="group" aria-label="Phù hiệu chính cấp III">
      {branches.map((branch) => (
        <div key={branch} className="grid gap-x-2 @md:grid-cols-[112px_minmax(0,1fr)] @md:items-center">
          <span className="type-meta">{branchLabel(branch)}</span>
          <div className="grid grid-cols-3 gap-1">
            {emblemsOf(catalog, branch, MAIN_EMBLEM_TIER).map((emblem) => (
              <EmblemTile
                key={emblem.id}
                emblem={emblem}
                pressed={chosen(value, emblem, true)}
                onClick={() => onMain(emblem)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** The five slots the game shows, the main branch tier by tier and the other branches. */
function AllSlots({
  value,
  catalog,
  onMain,
  onSecondary,
  onChange,
}: PartsProps & { onSecondary: (emblem: Reference) => void; onChange: Change<Value> }) {
  const branches = useMemo(() => enchantmentBranches(catalog.enchantments), [catalog.enchantments])
  const recorded = mainBranch(value.entries)
  const [viewed, setViewed] = useState<string | null>(null)
  const branch = viewed ?? recorded ?? branches[0] ?? null
  return (
    <div className="@container space-y-3">
      <Slots value={value} catalog={catalog} onChange={onChange} />
      <div className="space-y-1.5 border-t pt-2">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Nhánh chính">
          <span className="type-label mr-1">Nhánh chính</span>
          {branches.map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={branch === code}
              onClick={() => setViewed(code)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs focus-visible:outline-2 focus-visible:outline-ring",
                branch === code ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {branchLabel(code)}
              {recorded === code && (
                <span className="size-1.5 rounded-full bg-foreground" title="Nhánh chính đang ghi" />
              )}
            </button>
          ))}
        </div>
        {branch &&
          TIER_NUMERALS.map((numeral, index) => (
            <div key={numeral} className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-1">
              <span className="type-meta pt-2">Cấp {numeral}</span>
              <div className="grid grid-cols-3 gap-1 @lg:grid-cols-5">
                {emblemsOf(catalog, branch, index + 1).map((emblem) => (
                  <EmblemTile
                    key={emblem.id}
                    emblem={emblem}
                    stacked
                    pressed={chosen(value, emblem, true)}
                    onClick={() => onMain(emblem)}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>
      <div className="space-y-2 border-t pt-2">
        <p
          className="type-label"
          title="Hai ô: cấp I và II của một nhánh, hoặc cấp I của hai nhánh"
          aria-label="Nhánh phụ, hai ô: cấp I và II của một nhánh, hoặc cấp I của hai nhánh"
        >
          Nhánh phụ
        </p>
        {branches
          .filter((code) => code !== (recorded ?? branch))
          .map((code) => (
            <div key={code} data-secondary-branch={code}>
              <span className="type-meta">{branchLabel(code)}</span>
              {[1, 2].map((tier) => (
                <div key={tier} className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-1">
                  <span className="type-meta pt-2">Cấp {TIER_NUMERALS[tier - 1]}</span>
                  <div className="grid grid-cols-3 gap-1 @lg:grid-cols-5">
                    {emblemsOf(catalog, code, tier).map((emblem) => (
                      <EmblemTile
                        key={emblem.id}
                        emblem={emblem}
                        stacked
                        pressed={chosen(value, emblem, false)}
                        onClick={() => onSecondary(emblem)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  )
}

/** What is recorded, slot by slot; an entry recorded outside the five, as older data holds, is listed after them. */
function Slots({ value, catalog, onChange }: { value: Value; catalog: Catalog; onChange: Change<Value> }) {
  const byId = useMemo(() => new Map(catalog.enchantments.map((entry) => [entry.id, entry])), [catalog.enchantments])
  const primary = value.entries.filter((entry) => entry.primary)
  const secondary = value.entries.filter((entry) => !entry.primary)
  const slots: { label: string; entry?: EnchantmentAllocation }[] = [
    ...TIER_NUMERALS.map((numeral, index) => ({
      label: `Chính ${numeral}`,
      entry: primary.find((entry) => entry.tier === index + 1),
    })),
    { label: "Phụ", entry: secondary[0] },
    { label: "Phụ", entry: secondary[1] },
  ]
  const placed = new Set(slots.map((slot) => slot.entry))
  const extra = value.entries
    .filter((entry) => !placed.has(entry))
    .map((entry) => ({ label: entry.primary ? "Chính" : "Phụ", entry }))
  const remove = (entry: EnchantmentAllocation) =>
    onChange((loadout) =>
      withEntries(
        loadout,
        without(
          loadout.entries,
          indexOfEntry(loadout.entries, entry, (a, b) => a.primary === b.primary && a.tier === b.tier),
        ),
      ),
    )
  return (
    <ul className="grid grid-cols-2 gap-x-2 @lg:grid-cols-5" aria-label="Phù hiệu đã ghi">
      {[...slots, ...extra].map((slot, index) => {
        const reference = byId.get(slot.entry?.selection.id ?? "")
        const name = slot.entry ? slot.entry.selection.name || reference?.name || "Chưa rõ tên" : null
        return (
          <li
            key={index}
            data-filled={!!slot.entry || undefined}
            className="flex h-11 min-w-0 items-center gap-2 text-xs"
          >
            {name ? (
              <ReferenceIcon reference={reference} name={name} size={26} round />
            ) : (
              <span
                className="grid size-[26px] shrink-0 place-items-center rounded-full border border-dashed text-muted-foreground"
                aria-hidden
              >
                ?
              </span>
            )}
            <span className="min-w-0 flex-1 leading-4">
              <span className="block text-muted-foreground">{slot.label}</span>
              <span className={cn("block truncate", name && "font-semibold")} title={name ?? undefined}>
                {name ?? "Chưa ghi"}
              </span>
            </span>
            {slot.entry && name && (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Bỏ ${name}`}
                onClick={() => remove(slot.entry!)}
              >
                <X aria-hidden />
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
