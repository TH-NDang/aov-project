import { CatalogChangeBadges } from "./catalog-changes"
import type { CSSProperties } from "react"
import { ArrowUpRight, Check, Pencil } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import { cn } from "@aov/ui/lib/utils"
import { HeroAsset } from "../publishing/hero-content"
import { enchantmentBranchColor } from "./enchantment-colors"
import { warehouseText, type EnchantmentContent, type WarehouseEntry, type WarehouseMetadata } from "./warehouse-types"

const rowClass = "grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 @min-[520px]/enchantments:gap-x-4"
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
      {scoped && (
        <Button size="sm" variant={!active ? "secondary" : "ghost"} aria-pressed={!active} onClick={() => onSelect("")}>
          Tất cả hệ
        </Button>
      )}
      <div className="flex flex-wrap gap-2" aria-label="Các hệ phù hiệu">
        {branches.map((branch) => {
          const text = warehouseText(branch.translations, locale)
          return (
            <Tooltip key={branch.code} delayDuration={250}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSelect(branch.code)}
                  aria-label={text?.name ?? branch.code}
                  aria-pressed={branch.code === active}
                  style={{ "--branch-color": enchantmentBranchColor(branch) } as CSSProperties}
                  className={cn(
                    "relative flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring",
                    active === branch.code && "bg-accent/40",
                  )}
                >
                  <HeroAsset
                    id={branch.iconAssetId}
                    alt=""
                    frameAspectRatio={1}
                    className="size-8 rounded-full border-0 bg-transparent"
                  />
                  {active === branch.code && (
                    <span
                      aria-hidden
                      className="absolute right-2 bottom-0 left-2 h-0.5 rounded-full bg-[var(--branch-color)]"
                    />
                  )}
                </button>
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
                    <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                      Hệ phù hiệu
                    </p>
                    <p className="text-sm leading-5 font-semibold">{text?.name ?? branch.code}</p>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
      {shown.map((branch) => {
        const text = warehouseText(branch.translations, locale)
        const entries = records.filter((entry) => entry.content.branchCode === branch.code)
        const tiers = [1, 2, 3].filter(
          (tier) => (!scoped && !search) || entries.some((entry) => entry.content.tier === tier),
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
                <h2 className="text-base font-semibold tracking-tight @min-[520px]/enchantments:text-lg">
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
            <div className="p-3 @min-[520px]/enchantments:p-5">
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
                        <span aria-hidden className={cn(railClass, "top-14 bottom-0")} />
                      )}
                      {tierIndex > 0 && <span aria-hidden className={cn(railClass, "top-0 h-14")} />}
                      <div className="relative mt-7 flex flex-col items-center gap-1 bg-card py-1">
                        <span className="text-[9px] font-medium tracking-widest text-muted-foreground uppercase">
                          Cấp
                        </span>
                        <span className="grid size-8 place-items-center rounded-full border border-[var(--branch-border)] bg-[var(--branch-tint)] font-serif text-sm font-semibold text-[var(--branch-color)]">
                          {["I", "II", "III"][tier - 1]}
                        </span>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "grid min-w-0 grid-cols-2 gap-2 @min-[520px]/enchantments:grid-cols-3 @min-[520px]/enchantments:gap-3",
                        tierIndex !== tiers.length - 1 && "pb-5",
                      )}
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
                              "group relative flex min-w-0 cursor-pointer flex-col items-center gap-2 rounded-xl border bg-background/50 px-2 py-3 text-center transition-colors outline-none hover:border-[var(--branch-color)] hover:bg-[var(--branch-tint)] focus-visible:ring-2 focus-visible:ring-[var(--branch-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-card @min-[520px]/enchantments:px-3",
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
                            <div className="grid size-16 place-items-center rounded-full bg-[radial-gradient(circle,var(--branch-tint),transparent_70%)]">
                              <HeroAsset
                                id={entry.content.iconAssetId}
                                alt=""
                                frameAspectRatio={1}
                                className="size-14 rounded-full border-0 bg-transparent transition-transform group-hover:scale-105 motion-reduce:transform-none"
                              />
                            </div>
                            <span className="line-clamp-2 text-sm leading-5 font-semibold">
                              {label?.name ?? entry.code}
                            </span>
                            {label?.summary && (
                              <span className="line-clamp-2 text-xs leading-4 text-muted-foreground">
                                {label.summary}
                              </span>
                            )}
                            {(entry.revision.state === "DRAFT" || !!entry.changeKinds?.length) && (
                              <div className="mt-auto flex w-full flex-wrap items-center justify-center gap-1 border-t border-border/50 pt-2">
                                {entry.revision.state === "DRAFT" && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Nháp
                                  </Badge>
                                )}
                                <CatalogChangeBadges kinds={entry.changeKinds ?? []} />
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
