import { CatalogChangeBadges } from "./catalog-changes"
import type { CSSProperties } from "react"
import { Check, Pencil } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { HeroAsset } from "../publishing/hero-content"
import { WarehouseCardHint } from "./warehouse-card-hint"
import { enchantmentBranchColor } from "./enchantment-colors"
import { warehouseText, type EnchantmentContent, type WarehouseEntry, type WarehouseMetadata } from "./warehouse-types"

const rowClass = "grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-x-5"
const railClass = "absolute left-1/2 w-px -translate-x-1/2 bg-[var(--branch-color)] opacity-65"

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
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Các hệ phù hiệu">
        {branches.map((branch) => {
          const text = warehouseText(branch.translations, locale)
          return (
            <button
              key={branch.code}
              type="button"
              onClick={() => onSelect(branch.code)}
              aria-pressed={branch.code === active}
              style={{ "--branch-color": enchantmentBranchColor(branch) } as CSSProperties}
              className={cn(
                "relative flex min-h-16 min-w-0 cursor-pointer items-center gap-2 rounded-xl p-2.5 text-left transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring",
                active === branch.code && "bg-accent/40",
              )}
            >
              <HeroAsset
                id={branch.iconAssetId}
                alt=""
                frameAspectRatio={1}
                className="size-10 shrink-0 rounded-full border-0 bg-transparent sm:size-12"
              />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block text-sm font-semibold">{text?.name ?? branch.code}</span>
                <span className="block text-xs text-muted-foreground">
                  {records.filter((entry) => entry.content.branchCode === branch.code).length} phù hiệu
                </span>
              </span>
              {active === branch.code && (
                <>
                  <Check className="size-4 shrink-0 text-[var(--branch-color)]" />
                  <span
                    aria-hidden
                    className="absolute right-3 bottom-0 left-3 h-0.5 rounded-full bg-[var(--branch-color)]"
                  />
                </>
              )}
            </button>
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
          <section key={branch.code} style={{ "--branch-color": enchantmentBranchColor(branch) } as CSSProperties}>
            <header className={rowClass}>
              <div className="relative flex justify-center pt-1">
                <span aria-hidden className={cn(railClass, "top-11 bottom-0 sm:top-13")} />
                <div
                  className="relative grid size-10 shrink-0 place-items-center rounded-full border bg-background p-1 sm:size-12"
                  style={{ borderColor: "var(--branch-color)" }}
                >
                  <HeroAsset
                    id={branch.iconAssetId}
                    alt=""
                    frameAspectRatio={1}
                    className="size-full rounded-full border-0 bg-transparent"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-3 pb-6">
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="font-semibold sm:text-lg">{text?.name ?? branch.code}</h2>
                </div>
                {canWrite && (
                  <Button variant="ghost" size="sm" onClick={() => onEditBranch(branch)}>
                    <Pencil className="size-4" />
                    <span className="sr-only sm:not-sr-only">Chỉnh sửa hệ</span>
                  </Button>
                )}
              </div>
            </header>
            {tiers.map((tier, tierIndex) => {
              const nodes = entries
                .filter((entry) => entry.content.tier === tier)
                .sort(
                  (a, b) => (a.content.position ?? 999) - (b.content.position ?? 999) || a.code.localeCompare(b.code),
                )
              return (
                <div key={tier} className={rowClass}>
                  <div className="relative">
                    <span
                      aria-hidden
                      className={cn(railClass, "top-0", tierIndex === tiers.length - 1 ? "h-12 sm:h-14" : "bottom-0")}
                    />
                    <span
                      className="absolute top-12 left-1/2 z-1 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-background font-serif text-sm font-semibold text-[var(--branch-color)] sm:top-14"
                      style={{ borderColor: "var(--branch-color)" }}
                    >
                      {["I", "II", "III"][tier - 1]}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "grid grid-cols-3 gap-1.5 py-4 sm:gap-3",
                      tierIndex !== tiers.length - 1 && "border-b",
                    )}
                    style={{ borderColor: "color-mix(in srgb, var(--branch-color) 22%, transparent)" }}
                    aria-label={`Phù hiệu cấp ${["I", "II", "III"][tier - 1]}`}
                  >
                    {nodes.map((entry) => {
                      const label = warehouseText(entry.content.translations, locale)
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => onOpen(entry)}
                          aria-label={`Xem ${label?.name ?? entry.code}`}
                          className={cn(
                            "group flex min-h-28 min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-center transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring sm:px-3",
                            selectedId === entry.id && "bg-primary/10",
                          )}
                        >
                          <HeroAsset
                            id={entry.content.iconAssetId}
                            alt=""
                            frameAspectRatio={1}
                            className="size-12 rounded-full border-0 bg-transparent transition-transform group-hover:scale-105 sm:size-16"
                          />
                          <span className="line-clamp-2 text-xs leading-4 font-medium sm:text-sm sm:leading-5">
                            {label?.name ?? entry.code}
                          </span>
                          {label?.summary && (
                            <span className="line-clamp-2 text-[11px] leading-4 text-muted-foreground sm:text-xs">
                              {label.summary}
                            </span>
                          )}
                          <div className="mt-auto flex flex-wrap items-center justify-center gap-2 pt-1">
                            {entry.revision.state === "DRAFT" && (
                              <Badge variant="outline" className="text-[10px]">
                                Nháp
                              </Badge>
                            )}
                            <CatalogChangeBadges kinds={entry.changeKinds ?? []} />
                            <WarehouseCardHint />
                          </div>
                        </button>
                      )
                    })}
                    {!nodes.length && (
                      <p className="col-span-full py-8 text-center text-xs text-muted-foreground">
                        Chưa có phù hiệu cấp {["I", "II", "III"][tier - 1]}.
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
