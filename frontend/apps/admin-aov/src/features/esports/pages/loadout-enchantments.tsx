import { useMemo, useState } from "react"
import type { Catalog, EnchantmentAllocation, Loadout, Reference } from "@aov/community-contracts"
import { X } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { confirmAction } from "@/components/confirm-dialog"
import { Monogram } from "../components/primitives"
import { initials } from "../model/game-view"
import {
  TIER_NUMERALS,
  branchLabel,
  enchantmentBranches,
  enchantmentStatus,
  mainBranch,
  pickEnchantment,
  removeRecordedEnchantment,
  replacedMainPicks,
  withEnchantments,
} from "../model/loadout"
import { LoadoutSection, type Change, type ObservedAtControl } from "./loadout-section"

/**
 * The emblem set as the game lays it out: one main branch with a pick on each of its three tiers, and two secondary
 * picks from the other branches. Picks that cannot stand together replace each other, so the set stays one the
 * service accepts while it is being built.
 */
export function EnchantmentsEditor({
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

  return (
    <LoadoutSection
      part="enchantments"
      title="Phù hiệu"
      label="phù hiệu"
      status={enchantmentStatus(value.entries, value.status)}
      progress={`${value.entries.length}/5`}
      recorded={`${value.entries.length} phù hiệu`}
      hiddenText="Video không hiện phù hiệu của tuyển thủ này; không xem đây là chưa dùng phù hiệu."
      value={value}
      observedAt={observedAt}
      onChange={onChange}
    >
      <EnchantmentSlots
        entries={value.entries}
        byId={byId}
        onRemove={(entry) => onChange((loadout) => removeRecordedEnchantment(loadout, entry))}
      />

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
              <span className="w-12 shrink-0 pt-2 text-xs text-muted-foreground">Cấp {TIER_NUMERALS[tier - 1]}</span>
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
          <span className="text-muted-foreground">· hai ô: cấp I và II của một nhánh, hoặc cấp I của hai nhánh</span>
        </p>
        {branches
          .filter((code) => code !== (recorded ?? branch))
          .map((code) => (
            <div
              key={code}
              className="flex flex-col gap-1 @lg:flex-row @lg:items-start @lg:gap-2"
              data-secondary-branch={code}
            >
              <span className="shrink-0 text-xs text-muted-foreground @lg:w-20 @lg:pt-2">{branchLabel(code)}</span>
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
    </LoadoutSection>
  )
}

/** The five slots the game shows; an entry recorded outside them (older manual data) is listed after them. */
function EnchantmentSlots({
  entries,
  byId,
  onRemove,
}: {
  entries: EnchantmentAllocation[]
  byId: Map<string, Reference>
  onRemove: (entry: EnchantmentAllocation) => void
}) {
  const primary = entries.filter((entry) => entry.primary)
  const secondary = entries.filter((entry) => !entry.primary)
  const slots: { label: string; entry?: EnchantmentAllocation }[] = [
    ...[1, 2, 3].map((tier) => ({
      label: `Chính ${TIER_NUMERALS[tier - 1]}`,
      entry: primary.find((entry) => entry.tier === tier),
    })),
    { label: "Phụ", entry: secondary[0] },
    { label: "Phụ", entry: secondary[1] },
  ]
  const placed = new Set(slots.flatMap((slot) => (slot.entry ? [slot.entry] : [])))
  const extra = entries.filter((entry) => !placed.has(entry))

  return (
    <ul className="grid grid-cols-2 gap-1.5 @lg:grid-cols-5" aria-label="Phù hiệu đã ghi">
      {[...slots, ...extra.map((entry) => ({ label: entry.primary ? "Chính" : "Phụ", entry }))].map((slot, index) => {
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
                onClick={() => onRemove(slot.entry!)}
              >
                <X size={12} />
              </button>
            )}
          </li>
        )
      })}
    </ul>
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
