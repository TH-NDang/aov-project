import { CatalogChangeBadges } from "./catalog-changes"
import type { CSSProperties } from "react"
import { ArrowUpRight, Check, Pencil } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import { cn } from "@aov/ui/lib/utils"
import { FilterTab, FilterTabs } from "@/components/filter-tabs"
import { HeroAsset } from "../publishing/hero-content"
import { enchantmentBranchColor } from "./enchantment-colors"
import { warehouseText, type EnchantmentContent, type WarehouseEntry, type WarehouseMetadata } from "./warehouse-types"

const rowClass = "grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 @min-[520px]/enchantments:gap-x-3"
const railClass = "absolute left-1/2 w-px -translate-x-1/2 bg-[var(--branch-color)] opacity-25"

export function EnchantmentBranches({
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
  records: WarehouseEntry<EnchantmentContent>[]
  branches: WarehouseMetadata[]
  active: string
  onSelect: (code: string) => void
  onOpen: (entry: WarehouseEntry<EnchantmentContent>) => void
  selectedId: string
  locale: string
  search: string
  canWrite: boolean
  onEditBranch: (branch: WarehouseMetadata) => void
  scoped?: boolean
}) {
  const shown =
    search || (scoped && !active)
      ? branches.filter((branch) => records.some((entry) => entry.content.branchCode === branch.code))
      : branches.filter((branch) => branch.code === active)
  return (
    <div className="space-y-5">
      <FilterTabs label="Các hệ phù hiệu">
        {scoped && (
          <FilterTab active={!active} onClick={() => onSelect("")}>
            Tất cả hệ
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
                    <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Hệ phù hiệu</p>
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
        const columns = Math.max(
          3,
          ...tiers.map((tier) => entries.filter((entry) => entry.content.tier === tier).length),
        )
        return (
          <section
            key={branch.code}
            className="@container/enchantments overflow-hidden rounded-2xl border bg-card"
            style={
              {
                "--branch-color": enchantmentBranchColor(branch),
                "--branch-border": "color-mix(in srgb, var(--branch-color) 24%, var(--border))",
                "--branch-tint": "color-mix(in srgb, var(--branch-color) 8%, transparent)",
                borderColor: "var(--branch-border)",
              } as CSSProperties
            }
          >
            <header className="flex items-center gap-3 border-b border-[var(--branch-border)] bg-linear-to-r from-[var(--branch-tint)] to-transparent p-4 @min-[520px]/enchantments:px-5">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-[var(--branch-border)] bg-background/60 p-2">
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
                <p className="text-xs text-muted-foreground">{entries.length} phù hiệu</p>
              </div>
              {canWrite && (
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => onEditBranch(branch)}>
                  <Pencil className="size-3.5" />
                  <span className="sr-only @min-[520px]/enchantments:not-sr-only">Chỉnh sửa hệ</span>
                </Button>
              )}
            </header>
            <div className="p-2 @min-[520px]/enchantments:p-3">
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
                      {tierIndex > 0 && <span aria-hidden className={cn(railClass, "top-0 h-10")} />}
                      <div className="relative mt-4 flex flex-col items-center gap-1 bg-card py-1">
                        <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Cấp</span>
                        <span className="grid size-6 place-items-center rounded-full border border-[var(--branch-border)] bg-[var(--branch-tint)] font-serif text-xs font-semibold text-[var(--branch-color)]">
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
                      aria-label={`Phù hiệu cấp ${["I", "II", "III"][tier - 1]}`}
                    >
                      {nodes.map((entry) => {
                        const label = warehouseText(entry.content.translations, locale)
                        const selected = selectedId === entry.id
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => onOpen(entry)}
                            aria-label={`Xem ${label?.name ?? entry.code}`}
                            aria-pressed={selected}
                            className={cn(
                              "group relative flex min-w-0 cursor-pointer flex-col items-center gap-1 rounded-lg border bg-background/50 px-1.5 py-2 text-center transition-colors outline-none hover:border-[var(--branch-color)] hover:bg-[var(--branch-tint)] focus-visible:ring-2 focus-visible:ring-[var(--branch-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-card @min-[520px]/enchantments:px-2",
                              selected ? "border-[var(--branch-color)] bg-[var(--branch-tint)]" : "border-border/60",
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
                            {(entry.revision.state === "DRAFT" ||
                              !!entry.changeKinds?.some((kind) => kind !== "DATA_BASELINE")) && (
                              <div className="mt-auto flex w-full flex-wrap items-center justify-center gap-1 border-t border-border/50 pt-2">
                                {entry.revision.state === "DRAFT" && (
                                  <Badge variant="outline" className="text-xs">
                                    Nháp
                                  </Badge>
                                )}
                                <CatalogChangeBadges kinds={entry.changeKinds ?? []} hideBaseline />
                              </div>
                            )}
                          </button>
                        )
                      })}
                      {!nodes.length && (
                        <p className="col-span-full rounded-xl border border-dashed py-8 text-center text-xs text-muted-foreground">
                          Chưa có phù hiệu cấp {["I", "II", "III"][tier - 1]}.
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
