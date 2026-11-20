import { useWarehouseText } from "./warehouse-view"
import { cardChangeKinds, WarehouseBadges as CatalogChangeBadges } from "./warehouse-view"
import type { CSSProperties } from "react"
import { ArrowUpRight, Check, Pencil } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import { cn } from "@aov/ui/lib/utils"
import { FilterTab, FilterTabs } from "@aov/ui/components/filter-tabs"
import { WarehouseAsset as HeroAsset } from "./warehouse-view"
import { enchantmentBranchColor } from "@aov/ui/lib/enchantment-colors"
import {
  enchantmentColumn,
  ENCHANTMENT_COLUMNS,
  warehouseText,
  type EnchantmentContent,
  type WarehouseEntry,
  type WarehouseMetadata,
} from "@aov/ui/lib/warehouse-content"

// The tier column is as wide as the branch emblem above it and starts at the same edge, so one line runs from the
// emblem down through the tier marks.
const rowClass = "grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3"
const railClass = "absolute left-1/2 w-0.5 -translate-x-1/2 bg-[var(--branch-color)] opacity-60"

export function EnchantmentBranches<E extends WarehouseEntry<EnchantmentContent>, B extends WarehouseMetadata>({
  records,
  branches,
  active,
  onSelect,
  onOpen,
  selectedId,
  locale,
  search,
  canWrite,
  onEditBranch,
  scoped = false,
}: {
  records: E[]
  branches: B[]
  active: string
  onSelect: (code: string) => void
  onOpen: (entry: E) => void
  selectedId: string
  locale: string
  search: string
  canWrite?: boolean
  onEditBranch?: (branch: B) => void
  scoped?: boolean
}) {
  const t = useWarehouseText()
  const shown =
    search || (scoped && !active)
      ? branches.filter((branch) => records.some((entry) => entry.content.branchCode === branch.code))
      : branches.filter((branch) => branch.code === active)
  return (
    <div className="space-y-5">
      <FilterTabs label={t("Các hệ phù hiệu", "Enchantment branches")}>
        {scoped && (
          <FilterTab active={!active} onClick={() => onSelect("")}>
            {t("Tất cả hệ", "All branches")}
          </FilterTab>
        )}
        {branches.map((branch) => {
          const text = warehouseText(branch.translations, locale)
          return (
            <Tooltip key={branch.code} delayDuration={250}>
              <TooltipTrigger asChild>
                <FilterTab
                  active={branch.code === active}
                  count={records.filter((entry) => entry.content.branchCode === branch.code).length}
                  onClick={() => onSelect(branch.code)}
                  aria-label={text?.name ?? branch.code}
                >
                  <HeroAsset
                    id={branch.iconAssetId}
                    alt=""
                    frameAspectRatio={1}
                    className="size-5 shrink-0 rounded-full border-0 bg-transparent"
                  />
                  {text?.name ?? branch.code}
                </FilterTab>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                sideOffset={10}
                collisionPadding={12}
                style={
                  {
                    "--branch-color": enchantmentBranchColor(branch),
                    borderColor: "color-mix(in srgb, var(--branch-color) 30%, var(--border))",
                  } as CSSProperties
                }
                className="max-w-60 rounded-xl border bg-popover px-3 py-2.5 text-left text-popover-foreground shadow-xl shadow-black/15 motion-reduce:animate-none [&_svg]:invisible"
              >
                <div className="flex items-center gap-2.5">
                  <span aria-hidden className="h-8 w-0.5 shrink-0 rounded-full bg-[var(--branch-color)]" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      {t("Hệ phù hiệu", "Branch")}
                    </p>
                    <p className="text-sm leading-5 font-semibold">{text?.name ?? branch.code}</p>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </FilterTabs>
      {shown.map((branch) => {
        const text = warehouseText(branch.translations, locale)
        const entries = records.filter((entry) => entry.content.branchCode === branch.code)
        const tiers = [1, 2, 3].filter(
          (tier) => (!scoped && !search) || entries.some((entry) => entry.content.tier === tier),
        )
        // Three places in every tier, each enchantment in the one its position names, so columns line up down the branch.
        const columns = Math.max(
          ENCHANTMENT_COLUMNS,
          ...tiers.map((tier) => entries.filter((entry) => entry.content.tier === tier).length),
        )
        return (
          <section
            key={branch.code}
            className="@container/enchantments overflow-hidden rounded-2xl border"
            style={
              {
                "--branch-color": enchantmentBranchColor(branch),
                "--branch-border": "color-mix(in srgb, var(--branch-color) 24%, var(--border))",
                "--branch-tint": "color-mix(in srgb, var(--branch-color) 8%, transparent)",
                borderColor: "var(--branch-border)",
              } as CSSProperties
            }
          >
            <header className="enchantment-branch-heading flex items-center gap-3 border-b border-[var(--branch-border)] bg-linear-to-r from-[var(--branch-tint)] to-transparent p-4 @min-[520px]/enchantments:px-5">
              <div className="relative grid size-12 shrink-0 place-items-center rounded-full border-2 border-[var(--branch-color)] bg-[radial-gradient(circle,var(--branch-tint),transparent_72%)] p-1.5 shadow-[0_0_14px_-2px_color-mix(in_srgb,var(--branch-color)_55%,transparent)]">
                {/* From under the emblem to the rule below the heading, where the tiers' line takes over. */}
                <span aria-hidden className={cn(railClass, "top-full h-[17px]")} />
                <HeroAsset
                  id={branch.iconAssetId}
                  alt=""
                  frameAspectRatio={1}
                  className="size-full border-0 bg-transparent"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="tracking-tight @min-[520px]/enchantments:text-lg type-section-title">
                  {text?.name ?? branch.code}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {entries.length} {t("phù hiệu", "enchantments")}
                </p>
              </div>
              {canWrite && (
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => onEditBranch?.(branch)}>
                  <Pencil className="size-3.5" />
                  <span className="sr-only @min-[520px]/enchantments:not-sr-only">
                    {t("Chỉnh sửa hệ", "Edit branch")}
                  </span>
                </Button>
              )}
            </header>
            <div className="px-4 pb-3 @min-[520px]/enchantments:px-5">
              {tiers.map((tier, tierIndex) => {
                const nodes = entries
                  .filter((entry) => entry.content.tier === tier)
                  .sort(
                    (a, b) => (a.content.position ?? 999) - (b.content.position ?? 999) || a.code.localeCompare(b.code),
                  )
                return (
                  <div key={tier} className={rowClass}>
                    <div className="relative">
                      {tierIndex !== tiers.length - 1 && (
                        <span aria-hidden className={cn(railClass, "top-10 bottom-0")} />
                      )}
                      <span aria-hidden className={cn(railClass, "top-0 h-10")} />
                      <div className="relative mt-4 flex flex-col items-center gap-1 bg-card py-1">
                        <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                          {t("Cấp", "Tier")}
                        </span>
                        <span className="grid size-7 place-items-center rounded-full border-2 border-[color-mix(in_srgb,var(--branch-color)_60%,transparent)] bg-card font-serif text-xs font-semibold text-foreground">
                          {["I", "II", "III"][tier - 1]}
                        </span>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "grid min-w-0 gap-1.5 @min-[520px]/enchantments:gap-2",
                        tierIndex !== tiers.length - 1 && "pb-3",
                      )}
                      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                      aria-label={t(
                        `Phù hiệu cấp ${["I", "II", "III"][tier - 1]}`,
                        `Tier ${["I", "II", "III"][tier - 1]} enchantments`,
                      )}
                    >
                      {nodes.map((entry) => {
                        const label = warehouseText(entry.content.translations, locale)
                        const selected = selectedId === entry.id
                        const changeKinds = cardChangeKinds(entry.changeKinds)
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => onOpen(entry)}
                            style={{ gridColumn: enchantmentColumn(entry.content.position) ?? undefined }}
                            aria-label={`${t("Xem", "View")} ${label?.name ?? entry.code}`}
                            aria-pressed={selected}
                            className={cn(
                              "enchantment-node group relative flex min-w-0 cursor-pointer flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-center transition-colors outline-none hover:border-[var(--branch-color)] hover:bg-[var(--branch-tint)] focus-visible:ring-2 focus-visible:ring-[var(--branch-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-card @min-[520px]/enchantments:px-2",
                              selected
                                ? "border-[var(--branch-color)] bg-[var(--branch-tint)]"
                                : "border-[var(--branch-border)] bg-[radial-gradient(90%_70%_at_50%_0%,var(--branch-tint),transparent_75%)]",
                            )}
                          >
                            {selected ? (
                              <Check
                                aria-hidden
                                className="absolute top-2 right-2 size-3.5 text-[var(--branch-color)]"
                              />
                            ) : (
                              <ArrowUpRight
                                aria-hidden
                                className="absolute top-2 right-2 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                              />
                            )}
                            <div className="grid size-10 max-w-full shrink-0 place-items-center rounded-full bg-[radial-gradient(circle,var(--branch-tint),transparent_70%)] @min-[520px]/enchantments:size-11">
                              <HeroAsset
                                id={entry.content.iconAssetId}
                                alt=""
                                frameAspectRatio={1}
                                className="size-9 max-w-full rounded-full border-0 bg-transparent transition-transform group-hover:scale-105 motion-reduce:transform-none @min-[520px]/enchantments:size-10"
                              />
                            </div>
                            <span
                              className="w-full truncate text-xs leading-4 font-semibold"
                              title={label?.name ?? entry.code}
                            >
                              {label?.name ?? entry.code}
                            </span>
                            {label?.summary && (
                              <span
                                className="w-full truncate text-xs leading-4 text-muted-foreground @min-[520px]/enchantments:text-xs"
                                title={label.summary}
                              >
                                {label.summary}
                              </span>
                            )}
                            {(entry.revision.state === "DRAFT" || !!changeKinds.length) && (
                              <div className="mt-auto flex w-full flex-wrap items-center justify-center gap-1 border-t border-border/50 pt-2">
                                {entry.revision.state === "DRAFT" && (
                                  <Badge variant="outline" className="text-xs">
                                    {entry.revision.effectiveFromPatchVariantId
                                      ? t("Nháp", "Draft")
                                      : t("Nháp · Chưa gắn patch", "Draft · No patch yet")}
                                  </Badge>
                                )}
                                <CatalogChangeBadges kinds={changeKinds} />
                              </div>
                            )}
                          </button>
                        )
                      })}
                      {!nodes.length && (
                        <p className="col-span-full rounded-xl border border-dashed py-8 text-center text-xs text-muted-foreground">
                          {t(
                            `Chưa có phù hiệu cấp ${["I", "II", "III"][tier - 1]}.`,
                            `No tier ${["I", "II", "III"][tier - 1]} enchantments yet.`,
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
