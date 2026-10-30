import { CatalogChangeBadges } from "./catalog-changes"
import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@aov/ui/components/collapsible"
import { cn } from "@aov/ui/lib/utils"
import { HeroAsset } from "../publishing/hero-content"
import { warehouseName, warehouseText, type ArcanaContent, type WarehouseEntry } from "./warehouse-types"
const colorStyles = { RED: "bg-rose-500", PURPLE: "bg-violet-500", GREEN: "bg-emerald-500" }
const gridClass = "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6"

export function ArcanaCollection({
  records,
  locale,
  selectedId,
  onOpen,
  revealLowerTiers = false,
}: {
  records: WarehouseEntry<ArcanaContent>[]
  locale: string
  selectedId: string
  onOpen: (entry: WarehouseEntry<ArcanaContent>) => void
  revealLowerTiers?: boolean
}) {
  const [openTiers, setOpenTiers] = useState<number[]>(revealLowerTiers ? [1, 2] : [])
  function cards(tier: number) {
    return records
      .filter((entry) => entry.content.tier === tier)
      .map((entry) => (
        <ArcanaCard
          key={entry.id}
          entry={entry}
          locale={locale}
          active={entry.id === selectedId}
          onOpen={() => onOpen(entry)}
        />
      ))
  }
  const highest = cards(3)
  return (
    <div className="space-y-3">
      {highest.length > 0 && (
        <section className="space-y-3" aria-label="Ngọc bậc III">
          <h2 className="px-3 py-2 text-sm font-semibold">
            Ngọc bậc III <span className="ml-1 text-muted-foreground">{highest.length}</span>
          </h2>
          <div className={gridClass}>{highest}</div>
        </section>
      )}
      {[2, 1].map((tier) => {
        const entries = cards(tier)
        if (!entries.length) return null
        const open = openTiers.includes(tier)
        return (
          <Collapsible
            key={tier}
            open={open}
            onOpenChange={(value) =>
              setOpenTiers((current) => (value ? [...current, tier] : current.filter((item) => item !== tier)))
            }
          >
            <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-3 text-left hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronDown
                aria-hidden
                className={cn("size-4 text-muted-foreground transition-transform", !open && "-rotate-90")}
              />
              <span className="text-sm font-semibold">Ngọc bậc {["I", "II"][tier - 1]}</span>
              <Badge variant="secondary" className="rounded-full tabular-nums">
                {entries.length}
              </Badge>
              <span className="ml-auto text-xs text-muted-foreground">{open ? "Thu gọn" : "Mở danh sách"}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className={cn(gridClass, "pt-2")}>{entries}</div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}

function ArcanaCard({
  entry,
  locale,
  active,
  onOpen,
}: {
  entry: WarehouseEntry<ArcanaContent>
  locale: string
  active: boolean
  onOpen: () => void
}) {
  const text = warehouseText(entry.content.translations, locale)
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Xem ${warehouseName(entry, locale)}`}
      title={entry.code}
      className={cn(
        "group flex min-w-0 cursor-pointer flex-col gap-3 rounded-2xl border bg-card p-3 text-left transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-primary bg-primary/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <HeroAsset
          id={entry.content.iconAssetId}
          alt=""
          frameAspectRatio={1}
          className="size-12 shrink-0 rounded-full"
        />
        <Badge variant="outline">
          <span className={cn("size-1.5 rounded-full", colorStyles[entry.content.color])} />
          {["I", "II", "III"][entry.content.tier - 1]}
        </Badge>
      </div>
      <div className="min-w-0 space-y-1">
        <p className="line-clamp-2 text-sm leading-5 font-medium">{text?.name || entry.code}</p>
      </div>
      <dl className="mt-auto space-y-1.5 border-t pt-2">
        {entry.content.stats.map((stat) => (
          <div key={stat.key} className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
            <dt className="text-muted-foreground">{text?.statLabels?.[stat.key] || stat.key}</dt>
            <dd className="font-medium tabular-nums">
              {stat.value > 0 ? "+" : ""}
              {stat.value}
              {stat.unit}
            </dd>
          </div>
        ))}
        {!entry.content.stats.length && <p className="text-xs text-muted-foreground">Chưa có chỉ số</p>}
      </dl>
      {(entry.revision.state === "DRAFT" || entry.changeKinds?.some((kind) => kind !== "DATA_BASELINE")) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {entry.revision.state === "DRAFT" && (
            <Badge variant="outline" className="w-fit text-[10px]">
              Nháp
            </Badge>
          )}
          <span className="ml-auto">
            <CatalogChangeBadges kinds={entry.changeKinds ?? []} hideBaseline />
          </span>
        </div>
      )}
    </button>
  )
}
